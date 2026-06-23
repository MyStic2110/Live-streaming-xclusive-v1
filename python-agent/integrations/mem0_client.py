import os
import logging
from mem0 import Memory

logger = logging.getLogger("swarm_copilot.mem0_client")

class Mem0Client:
    """
    Local-first wrapper for Mem0 Memory.
    Uses in-process Qdrant for semantic vector store, local SQLite for metadata,
    local sentence-transformers for text embeddings, and OpenRouter for fact extraction.
    """
    def __init__(self, db_path: str = None, vector_db_path: str = None) -> None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Resolve directory paths for local databases
        if not db_path:
            db_path = os.path.join(base_dir, "sessions", "mem0_metadata.db")
        if not vector_db_path:
            vector_db_path = os.path.join(base_dir, "sessions", "mem0_vector_db")

        # Create directories if absent
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        os.makedirs(vector_db_path, exist_ok=True)

        # Retrieve OpenRouter API Key (required by Mem0 to extract facts from turns)
        api_key = os.getenv("OPENROUTER_API_KEY", "mock_key")
        
        # Configure Mem0 locally
        custom_instructions = (
            "You are the memory manager for the Swarm Customer Success & Onboarding Copilot.\n"
            "Extract and save only the following information:\n"
            "1. User Profile Details: Name, job title/role (e.g., DevOps Engineer), company, industry, or active application profile.\n"
            "2. Infrastructure & Deployment Preferences: On-prem, private VPC, cloud setup, hybrid, or specific hardware/GPU partitions.\n"
            "3. Integration Goals: Specific platforms the user wants to connect (e.g., Slack, GitHub, Jira, custom webhooks).\n"
            "4. Compliance & Security Targets: Requirements like SOC2, GDPR, OWASP compliance, or specific scanner runs.\n"
            "5. Specific Swarm Agents of Interest: Prebuilt agents the user is evaluating (e.g., Astra, DevOps Geni, LINA, BI).\n"
            "6. Custom Pricing Preferences: Budget constraints, custom quote requests, or subscription tier goals.\n\n"
            "Exclude:\n"
            "- Casual chit-chat, standard greetings ('hello', 'how are you'), and conversational filler.\n"
            "- Generic informational questions (e.g., 'What is SOC2' - do not store this as a memory fact unless they specify they need it for themselves).\n"
            "- Sensitive credentials, passwords, raw API keys, or credit card numbers."
        )

        # Vector store: prefer a Qdrant SERVER (supports concurrent access from the
        # Node CLI bridge and the in-process agent) when QDRANT_URL/QDRANT_HOST is
        # set; otherwise fall back to embedded on-disk Qdrant (SINGLE process only —
        # a second concurrent client will fail to acquire the storage lock).
        qdrant_url = os.getenv("QDRANT_URL")
        qdrant_host = os.getenv("QDRANT_HOST")
        if qdrant_url:
            qdrant_cfg = {"url": qdrant_url}
        elif qdrant_host:
            qdrant_cfg = {"host": qdrant_host, "port": int(os.getenv("QDRANT_PORT", "6333"))}
        else:
            qdrant_cfg = {"path": vector_db_path}
        qdrant_cfg.update({"collection_name": "memories", "embedding_model_dims": 384})
        self.qdrant_mode = "server" if (qdrant_url or qdrant_host) else "embedded"

        config = {
            "vector_store": {
                "provider": "qdrant",
                "config": qdrant_cfg
            },
            "db": {
                "provider": "sqlite",
                "config": {
                    "path": db_path
                }
            },
            "embedder": {
                "provider": "huggingface",
                "config": {
                    "model": "sentence-transformers/all-MiniLM-L6-v2"
                }
            },
            "llm": {
                "provider": "openai",
                "config": {
                    "model": "gpt-4o-mini",
                    "openai_base_url": "https://openrouter.ai/api/v1",
                    "api_key": api_key
                }
            },
            "custom_instructions": custom_instructions
        }
        
        self.init_error = None
        try:
            self.memory = Memory.from_config(config)
            logger.info(f"Mem0 Memory initialized successfully (qdrant: {self.qdrant_mode}).")
        except Exception as e:
            logger.error(f"Failed to initialize Mem0 Memory from config: {e}")
            self.memory = None
            self.init_error = str(e)

    def add_interaction(self, user_id: str, query: str, response: str) -> None:
        """Asynchronously extracts and persists facts from a conversation turn."""
        if not self.memory:
            return
        
        interaction = f"User: {query}\nAgent: {response}"
        try:
            self.memory.add(interaction, user_id=user_id)
            logger.info(f"Interaction logged to Mem0 for user/session: {user_id}")
        except Exception as e:
            logger.error(f"Failed to save interaction to Mem0 memory: {e}")

    def get_relevant_facts(self, user_id: str, query: str) -> list:
        """Retrieves semantic facts matching the user query."""
        if not self.memory:
            return []
        
        try:
            results = self.memory.search(query=query, filters={"user_id": user_id})
            
            # Mem0 search can return a dictionary or a list depending on state
            if isinstance(results, dict) and "results" in results:
                results = results["results"]
                
            facts = []
            if isinstance(results, list):
                for res in results:
                    if isinstance(res, dict):
                        # Support multiple Mem0 version result keys
                        fact = res.get("memory", res.get("fact", ""))
                        if fact:
                            facts.append(fact)
            
            logger.info(f"Retrieved {len(facts)} facts from Mem0 for query '{query[:30]}'")
            return facts
        except Exception as e:
            logger.error(f"Failed to search memories in Mem0: {e}")
            return []
