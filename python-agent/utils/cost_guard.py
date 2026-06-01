"""
utils/cost_guard.py — Swarm-wide LLM Cost Countermeasures
==========================================================
Shared utility imported by all voice pipeline agents to enforce:
  1. Throttled usage broadcast   — prevents metadata spam every second
  2. Context window pruning      — caps conversation history to N turns
  3. STT noise gating            — blocks ghost/noise transcriptions from reaching the LLM
  4. Session cost ceiling        — hard-stop once spend exceeds a threshold

Usage example (inside any agent's entrypoint):
    from utils.cost_guard import CostGuard

    guard = CostGuard(
        agent_name="SEVA",
        session_cost_ceiling=0.15,
        max_context_turns=15,
        usage_broadcast_interval_s=10.0,
        min_stt_words=3,
    )

    @session.on("session_usage_updated")
    def on_usage(usage_data):
        if guard.update_usage(usage_data, usage_dict):
            asyncio.create_task(broadcast_usage())   # only called when throttle passes

    @session.on("user_input_transcribed")
    def on_stt(event):
        if event.is_final:
            if not guard.allow_transcript(event.transcript):
                return
            ...                                       # process normally

    @session.on("conversation_item_added")
    def on_item(event):
        ...
        guard.prune_context(chat_ctx)                 # call after every item
"""

import time
import logging
import os
import json
import asyncio
from collections import deque
from livekit.agents import llm, voice

logger = logging.getLogger("cost_guard")

# ---------------------------------------------------------------------------
# Noise blacklist — single-word transcriptions that are pure mic noise
# ---------------------------------------------------------------------------
_NOISE_BLACKLIST = frozenset({
    "um", "uh", "hmm", "hm", "ah", "oh", "eh", "er",
    "spect", "okay", "ok", "right", "yeah", "yep", "nope",
    "mhm", "mm", "mmm", "huh", "tch", "hah", "ha", "hey",
    "ey", "yo", "so", "well", "like", "just", "the", "a",
})

# Short command words that ARE meaningful even if < min_stt_words
_COMMAND_WORDS = frozenset({
    "yes", "no", "stop", "start", "list", "stream", "pause",
    "help", "cancel", "confirm", "back", "next", "show", "go",
})


class CostGuard:
    """
    Drop-in cost guardrail for LiveKit voice agents.

    Parameters
    ----------
    agent_name : str
        Human-readable name used in log messages.
    session_cost_ceiling : float
        Maximum USD spend per session before LLM calls are blocked.
    max_context_turns : int
        Maximum conversation turns (user+assistant pairs) kept in history.
    usage_broadcast_interval_s : float
        Minimum seconds between usage metadata broadcasts.
    min_stt_words : int
        Minimum word count for a transcript to pass to the LLM.
    extra_noise_words : set[str]
        Additional words to add to the noise blacklist for this agent.
    extra_command_words : set[str]
        Additional short words that should bypass the word-count gate.
    """

    def __init__(
        self,
        agent_name: str,
        session_cost_ceiling: float = 0.15,
        max_context_turns: int = 15,
        usage_broadcast_interval_s: float = 10.0,
        min_stt_words: int = 3,
        extra_noise_words: set = None,
        extra_command_words: set = None,
    ):
        self.agent_name = agent_name
        
        # Override with .env variables if they exist
        env_specific = os.getenv(f"{agent_name.upper()}_COST_CEILING")
        env_global = os.getenv("DEFAULT_COST_CEILING")
        
        if env_specific:
            self.session_cost_ceiling = float(env_specific)
        elif env_global:
            self.session_cost_ceiling = float(env_global)
        else:
            self.session_cost_ceiling = session_cost_ceiling
            
        self.max_context_turns = max_context_turns
        self.usage_broadcast_interval_s = usage_broadcast_interval_s
        self.min_stt_words = min_stt_words

        self._noise_set = _NOISE_BLACKLIST | (extra_noise_words or set())
        self._command_set = _COMMAND_WORDS | (extra_command_words or set())

        self._last_broadcast_ts: float = 0.0
        self._cost_ceiling_exceeded: bool = False

        logger.info(
            f"[COST_GUARD] Initialized for {agent_name} | "
            f"ceiling=${session_cost_ceiling} | max_turns={max_context_turns} | "
            f"broadcast_interval={usage_broadcast_interval_s}s | min_words={min_stt_words}"
        )

    # ------------------------------------------------------------------
    # 1. Throttled usage tracking
    # ------------------------------------------------------------------

    def update_usage(self, usage_data: voice.SessionUsageUpdatedEvent, usage_dict: dict) -> bool:
        """
        Parse usage event into usage_dict and apply cost-ceiling check.

        Returns True  → throttle window has passed; caller should broadcast.
        Returns False → within throttle window; skip this broadcast cycle.
        """
        for m in usage_data.usage.model_usage:
            if m.type == "llm_usage":
                usage_dict["input_tokens"]  = getattr(m, "input_tokens", 0)
                usage_dict["output_tokens"] = getattr(m, "output_tokens", 0)
            elif m.type == "stt_usage":
                usage_dict["stt_seconds"] = getattr(m, "audio_duration", 0.0)
            elif m.type == "tts_usage":
                usage_dict["tts_chars"] = getattr(m, "characters_count", 0)

        # Recalculate total cost (stored back into dict)
        llm_cost = (
            usage_dict.get("input_tokens",  0) / 1_000_000 * 0.15 +
            usage_dict.get("output_tokens", 0) / 1_000_000 * 0.60
        )
        stt_cost = usage_dict.get("stt_seconds", 0.0) / 60 * 0.0043
        tts_cost = usage_dict.get("tts_chars",   0)   / 1000 * 0.015
        usage_dict["total_cost"] = round(llm_cost + stt_cost + tts_cost, 6)

        # Cost ceiling check
        if (
            usage_dict["total_cost"] >= self.session_cost_ceiling
            and not self._cost_ceiling_exceeded
        ):
            self._cost_ceiling_exceeded = True
            logger.warning(
                f"[COST_GUARD][{self.agent_name}] SESSION COST CEILING REACHED: "
                f"${usage_dict['total_cost']:.4f} >= ${self.session_cost_ceiling}. "
                f"Further LLM calls will be blocked."
            )

        # Throttle broadcast
        now = time.monotonic()
        if now - self._last_broadcast_ts >= self.usage_broadcast_interval_s:
            self._last_broadcast_ts = now
            logger.info(
                f"[COST_GUARD][{self.agent_name}] Spend: ${usage_dict['total_cost']} | "
                f"Tokens: {usage_dict.get('input_tokens', 0) + usage_dict.get('output_tokens', 0)}"
            )
            return True   # caller should broadcast

        return False  # skip broadcast this cycle

    # ------------------------------------------------------------------
    # 2. Context window pruning
    # ------------------------------------------------------------------

    def prune_context(self, chat_ctx: llm.ChatContext) -> int:
        """
        Trim chat_ctx to keep at most max_context_turns conversation turns.
        System prompt messages are always preserved.

        Returns the number of messages removed (0 if nothing was pruned).
        """
        messages = chat_ctx.messages()
        system_msgs = [m for m in messages if m.role == "system"]
        convo_msgs  = [m for m in messages if m.role != "system"]

        max_convo = self.max_context_turns * 2   # each turn = user + assistant
        if len(convo_msgs) <= max_convo:
            return 0

        removed = len(convo_msgs) - max_convo
        trimmed = convo_msgs[removed:]

        chat_ctx._items.clear()
        chat_ctx._items.extend(system_msgs + trimmed)

        logger.info(
            f"[COST_GUARD][{self.agent_name}] Context pruned: -{removed} msgs. "
            f"Remaining: {len(trimmed)} convo + {len(system_msgs)} system msgs."
        )
        return removed

    # ------------------------------------------------------------------
    # 3. STT noise gate
    # ------------------------------------------------------------------

    def allow_transcript(self, transcript: str) -> bool:
        """
        Returns True if the transcript should be passed to the LLM.
        Returns False if it looks like noise / too short / ceiling exceeded.

        Logs the reason for any block so operators can audit easily.
        """
        text = transcript.strip()
        if not text:
            return False

        # Hard block: cost ceiling exceeded
        if self._cost_ceiling_exceeded:
            logger.warning(
                f"[COST_GUARD][{self.agent_name}] LLM BLOCKED — cost ceiling exceeded. "
                f"Dropped: '{text}'"
            )
            return False

        clean = text.lower().strip(".,!?;:-\"'")
        words = clean.split()

        # Single-word noise blacklist
        if len(words) == 1 and clean in self._noise_set:
            logger.info(
                f"[COST_GUARD][{self.agent_name}] Noise transcript blocked (blacklist): '{text}'"
            )
            return False

        # Below minimum word count — but allow known command words through
        if len(words) < self.min_stt_words:
            if any(w in self._command_set for w in words):
                return True   # short but meaningful command
            logger.info(
                f"[COST_GUARD][{self.agent_name}] Short transcript blocked "
                f"({len(words)} words < {self.min_stt_words} minimum): '{text}'"
            )
            return False

        return True

    # ------------------------------------------------------------------
    # 4. Cost ceiling status
    # ------------------------------------------------------------------

    @property
    def is_ceiling_exceeded(self) -> bool:
        """True once the session cost ceiling has been hit."""
        return self._cost_ceiling_exceeded

    async def disconnect_with_alert(self, room):
        """Sends a data packet to the UI and disconnects the room."""
        if not room:
            return
            
        try:
            payload = json.dumps({"type": "COST_CEILING_EXCEEDED"}).encode("utf-8")
            await room.local_participant.publish_data(payload)
            logger.info(f"[COST_GUARD][{self.agent_name}] Sent COST_CEILING_EXCEEDED to UI.")
            await asyncio.sleep(1.0)  # Give UI time to receive
            await room.disconnect()
        except Exception as e:
            logger.error(f"[COST_GUARD] Error disconnecting room: {e}")
