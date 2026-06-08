import os
import json
import time
import uuid
import logging
import asyncio
from typing import Dict, Any, Tuple, List

logger = logging.getLogger("swarm_copilot.session_manager")


class SessionIntelligence:
    """Represents the lightweight conversational intelligence state of a chat session."""

    def __init__(self, session_id: str):
        self.session_id: str = session_id
        self.created_at: float = time.time()
        self.last_active: float = time.time()
        self.intent_funnel: str = "general_faq"
        self.primary_interests: List[str] = []
        self.last_vertical: str = "faq"
        self.target_integration: str = ""
        self.memory_summary: str = ""
        self.turn_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "last_active": self.last_active,
            "state": {
                "intent_funnel": self.intent_funnel,
                "primary_interests": self.primary_interests,
                "context_keys": {
                    "last_vertical": self.last_vertical,
                    "target_integration": self.target_integration
                }
            },
            "memory_summary": self.memory_summary,
            "turn_count": self.turn_count
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionIntelligence":
        session = cls(data["session_id"])
        session.created_at = data.get("created_at", time.time())
        session.last_active = data.get("last_active", time.time())
        
        state = data.get("state", {})
        session.intent_funnel = state.get("intent_funnel", "general_faq")
        session.primary_interests = state.get("primary_interests", [])
        
        context_keys = state.get("context_keys", {})
        session.last_vertical = context_keys.get("last_vertical", "faq")
        session.target_integration = context_keys.get("target_integration", "")
        
        session.memory_summary = data.get("memory_summary", "")
        session.turn_count = data.get("turn_count", 0)
        return session


class SessionManager:
    """
    Manages active user sessions.
    Uses an in-memory cache for ultra-low latency, and writes updates asynchronously
    to disk in a separate thread pool to prevent blocking the event loop.
    """

    def __init__(self, sessions_dir: str, ttl_seconds: int = 1800) -> None:
        """
        Args:
            sessions_dir: Path to directory where session JSONs are persisted.
            ttl_seconds: Session Time-To-Live (inactivity timeout) in seconds. Default 30 minutes.
        """
        self.sessions_dir = sessions_dir
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, SessionIntelligence] = {}
        
        # Ensure directories exist
        os.makedirs(self.sessions_dir, exist_ok=True)

    async def create_session(self) -> Tuple[str, SessionIntelligence]:
        """
        Initializes a brand new session with a random unique ID.
        
        Returns:
            A tuple of (session_id, SessionIntelligence object).
        """
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        session = SessionIntelligence(session_id)
        
        self.cache[session_id] = session
        await self.save_session(session_id, session)
        
        logger.info(f"Initialized new session: {session_id}")
        return session_id, session

    async def load_session(self, session_id: str) -> SessionIntelligence:
        """
        Loads session intelligence from memory or disk, enforcing TTL expiration.
        
        Args:
            session_id: The unique session identifier.
            
        Returns:
            The active SessionIntelligence object.
        """
        now = time.time()
        
        # 1. Check in-memory cache
        if session_id in self.cache:
            session = self.cache[session_id]
            # Verify TTL
            if now - session.last_active > self.ttl_seconds:
                logger.info(f"Session {session_id} expired in memory cache.")
                await self.delete_session(session_id)
                # Create a fresh one
                _, fresh_session = await self.create_session()
                return fresh_session
            
            # Update last active timestamp
            session.last_active = now
            return session

        # 2. Check disk persistence
        file_path = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(file_path):
            try:
                # Read file in executor thread pool to keep I/O non-blocking
                data = await asyncio.to_thread(self._read_file_sync, file_path)
                session = SessionIntelligence.from_dict(data)
                
                # Verify TTL
                if now - session.last_active > self.ttl_seconds:
                    logger.info(f"Session {session_id} expired on disk.")
                    await self.delete_session(session_id)
                    _, fresh_session = await self.create_session()
                    return fresh_session
                
                # Cache and return
                session.last_active = now
                self.cache[session_id] = session
                return session
                
            except Exception as e:
                logger.error(f"Failed to read session file {file_path}: {e}")

        # 3. Fallback: Create a new session if not found anywhere
        logger.info(f"Session ID {session_id} not found. Creating fresh session.")
        _, fresh_session = await self.create_session()
        return fresh_session

    async def save_session(self, session_id: str, session: SessionIntelligence) -> None:
        """
        Saves session intelligence to cache and asynchronously schedules a disk write.
        """
        session.last_active = time.time()
        self.cache[session_id] = session
        
        file_path = os.path.join(self.sessions_dir, f"{session_id}.json")
        data = session.to_dict()
        
        try:
            # Write to disk in executor thread pool
            await asyncio.to_thread(self._write_file_sync, file_path, data)
        except Exception as e:
            logger.error(f"Failed to save session file asynchronously: {e}")

    async def delete_session(self, session_id: str) -> None:
        """
        Clears session from memory and deletes its persistent file from disk.
        """
        if session_id in self.cache:
            del self.cache[session_id]
            
        file_path = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(file_path):
            try:
                await asyncio.to_thread(os.remove, file_path)
                logger.info(f"Deleted persistent session file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete session file {file_path}: {e}")

    def _read_file_sync(self, path: str) -> Dict[str, Any]:
        """Synchronous file read helper for the thread pool."""
        with open(path, "r") as f:
            return json.load(f)

    def _write_file_sync(self, path: str, data: Dict[str, Any]) -> None:
        """Synchronous file write helper for the thread pool."""
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
