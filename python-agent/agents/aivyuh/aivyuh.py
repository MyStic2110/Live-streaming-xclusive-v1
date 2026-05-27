import os
import asyncio
import json
import logging
import time
from datetime import datetime
from typing import List, Dict

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    JobContext,
    JobRequest,
    WorkerOptions,
    cli,
    llm,
    AgentSession,
    AutoSubscribe,
    voice,
)
from livekit.plugins import silero, deepgram, openai

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry
from utils.cost_guard import CostGuard

# Load environment configs
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logger = logging.getLogger("aivyuh")
logger.setLevel(logging.INFO)

AGENT_NAME = "AIVYUH"
RUNS_LEDGER_PATH = os.path.join(os.path.dirname(__file__), "audit_runs.json")
AGENTS_ROOT_PATH = os.path.join(os.path.dirname(__file__), "../")

# --- Default Audit History Loader/Saver ---
def load_runs_ledger() -> List[Dict]:
    if not os.path.exists(RUNS_LEDGER_PATH):
        default_runs = [
            {
                "id": "run-001",
                "date": "2026-05-25 10:15",
                "agent": "SEVA",
                "status": "completed",
                "open": 4,
                "resolved": 0,
                "ignored": 0,
                "cvss": "8.8",
                "utility": "100%"
            }
        ]
        save_runs_ledger(default_runs)
        return default_runs
    try:
        with open(RUNS_LEDGER_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_runs_ledger(data: List[Dict]):
    with open(RUNS_LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# --- System Instruction prompt for aivyuh ---
SYSTEM_PROMPT = """You are 'aivyuh', the Senior Security Auditor Agent for this agent swarm.
Your mission is to evaluate other agents (like SEVA, LINA, VIGIL, MARTECH, BI) for vulnerabilities listed under the OWASP LLM Top 10 guidelines (Prompt Injection, Sensitive Info Disclosure, Excessive Agency, etc.).

Capabilities:
1. You have tools to query the active vulnerability runs ledger and update security postures.
2. You help the user audit system instructions, showing how wrapping user queries in tags or adding strict refusal rules prevents direct overrides.
3. You advocate for a Human-in-the-Loop model, reminding the user that automated prompt fixes must be reviewed and tested to avoid breaking agent functionality (regression).

Tone:
- Technical, authoritative, clear, and reassuring.
- Highlight specific vulnerability classes like LLM01 (Prompt Injection) or LLM06 (Sensitive Info Disclosure).
"""

class AivyuhSecurityTools:
    def __init__(self, participant):
        self.participant = participant
        self.sentry = get_sentry(AGENT_NAME)

    async def _ui_log(self, message: str, level: str = "info"):
        payload = json.dumps({
            "type": "agent_log",
            "message": message,
            "level": level
        }).encode("utf-8")
        try:
            await self.participant.publish_data(payload, topic="ui_control")
        except Exception:
            pass

    @llm.function_tool(description="List active agent folders and retrieve metadata.")
    async def get_swarm_agent_manifest(self) -> str:
        """Scan python-agent/agents subdirectories to list active swarm nodes."""
        if not os.path.exists(AGENTS_ROOT_PATH):
            return json.dumps({"error": "Swarm agents directory not found."})
        
        try:
            agents_list = []
            for item in os.listdir(AGENTS_ROOT_PATH):
                full_path = os.path.join(AGENTS_ROOT_PATH, item)
                if os.path.isdir(full_path) and not item.startswith("__") and not item.startswith("."):
                    agents_list.append(item.upper())
            return json.dumps({"active_agents": agents_list, "pilot_node": "SEVA"})
        except Exception as e:
            return json.dumps({"error": str(e)})

    @llm.function_tool(description="Retrieve logs of past security runs and audit executions.")
    async def get_security_run_history(self) -> str:
        """Returns list of past audit reports from audit_runs.json."""
        runs = load_runs_ledger()
        await self._ui_log(f"📋 Retrieved {len(runs)} security runs from ledger.", "info")
        return json.dumps({"runs": runs})

    @llm.function_tool(description="Logs a new security run and returns the evaluated threats.")
    async def log_security_audit_run(
        self,
        agent_name: str,
        open_vulns: int,
        resolved_vulns: int,
        ignored_vulns: int,
        cvss_score: float,
        utility_score: str
    ) -> str:
        """Logs a new audit checkpoint run.
        Args:
            agent_name: Name of target agent checked (e.g., 'SEVA').
            open_vulns: Total remaining open vulnerabilities.
            resolved_vulns: Total approved and fixed vulnerabilities.
            ignored_vulns: Total muted vulnerabilities.
            cvss_score: Highest risk CVSS score.
            utility_score: Core utility functionality score (e.g., '95%').
        """
        runs = load_runs_ledger()
        new_run_id = f"run-00{len(runs) + 1}"
        new_run = {
            "id": new_run_id,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "agent": agent_name.upper(),
            "status": "completed",
            "open": open_vulns,
            "resolved": resolved_vulns,
            "ignored": ignored_vulns,
            "cvss": str(cvss_score),
            "utility": utility_score
        }
        runs.insert(0, new_run)
        save_runs_ledger(runs)
        
        await self._ui_log(f"🛡️ Logged run {new_run_id} for {agent_name} with CVSS {cvss_score}", "success")
        return json.dumps({"success": True, "logged_run": new_run})


async def entrypoint(ctx: JobContext):
    logger.info("--- AIVYUH SECURITY AGENT ONLINE ---")
    sentry = get_sentry(AGENT_NAME)
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    # Load plugins
    vad = silero.VAD.load(min_silence_duration=0.5)
    stt = deepgram.STT(model="nova-2-general")
    tts = deepgram.TTS(model="aura-asteria-en")

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))

    # Chat Context
    chat_ctx = llm.ChatContext()
    chat_ctx.add_message(role="system", content=SYSTEM_PROMPT)

    usage = {
        "input_tokens": 0, "output_tokens": 0,
        "stt_seconds": 0.0, "tts_chars": 0, "total_cost": 0.0
    }
    guard = CostGuard(
        agent_name="AIVYUH",
        session_cost_ceiling=0.15,
        max_context_turns=15,
        usage_broadcast_interval_s=10.0,
        min_stt_words=3,
    )

    async def broadcast_usage():
        await ctx.room.local_participant.set_metadata(json.dumps({
            "name": AGENT_NAME,
            "usage": usage
        }))

    security_tools = AivyuhSecurityTools(participant=ctx.room.local_participant)

    agent = voice.Agent(
        instructions=SYSTEM_PROMPT,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(security_tools),
    )

    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        turn_handling={
            "interruption": {"enabled": True},
            "endpointing": {"min_delay": 1.4}
        },
    )

    # greeting speech
    greeting_spoken = False

    async def speak_greeting():
        nonlocal greeting_spoken
        if greeting_spoken:
            return
        greeting_spoken = True
        await asyncio.sleep(1.5)
        await session.say(
            "Hello, I am aivyuh, your Swarm Security Auditor. I monitor security rules, prompt injections, and tool scopes. "
            "How can I help you audit your agents today?",
            allow_interruptions=True
        )

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        asyncio.create_task(speak_greeting())

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        if event.new_state == "listening" and ctx.room.remote_participants:
            asyncio.create_task(speak_greeting())

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        if guard.update_usage(usage_data, usage):
            asyncio.create_task(broadcast_usage())

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            if not guard.allow_transcript(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)

    # Start LiveKit Agent Session
    await session.start(room=ctx.room, agent=agent)

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        if guard.update_usage(usage_data, usage):
            asyncio.create_task(broadcast_usage())

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            if not guard.allow_transcript(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)

    # stay alive
    from livekit import rtc as _rtc
    while ctx.room.connection_state != _rtc.ConnectionState.CONN_DISCONNECTED:
        await asyncio.sleep(1)


async def request_fnc(req: JobRequest) -> None:
    logger.info(f"[AIVYUH] Received job request for room: {req.room.name}")
    await req.accept()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name=AGENT_NAME,
        )
    )
