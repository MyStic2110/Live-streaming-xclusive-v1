import os
import asyncio
import json
import logging
import glob
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
from utils.cost_guard import CostGuard, filter_code_blocks_and_long_text
from utils.traced_llm import TracedLLM

# Load environment configs
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logger = logging.getLogger("aivyuh")
logger.setLevel(logging.INFO)

AGENT_NAME = "AIVYUH"
AGENTS_ROOT_PATH = os.path.join(os.path.dirname(__file__), "../")

# --- System Instruction prompt for aivyuh ---
SYSTEM_PROMPT = """You are 'Aivyuh', the Senior Security Auditor Agent for the Swarm.
Your mission is to evaluate other agents (like SEVA, LINA, VIGIL, MARTECH, BI) for vulnerabilities according to the OWASP Top 10 for LLM Applications.

Capabilities:
- You have a single, extremely powerful tool called `run_full_owasp_audit`. When a user asks you to scan an agent, you must use this tool to run all 10 OWASP checks simultaneously.

Tone:
- Technical, authoritative, clear, and reassuring.
- The `run_full_owasp_audit` tool will return a large report. DO NOT read the entire report verbatim. Summarize the critical failures (red/warnings) to the user in a natural, conversational way. 
- Remind the user that the full detailed scan results are visible on their security dashboard UI.
- Never read raw code, function names, or JSON out loud.
"""

class AivyuhSecurityTools:
    def __init__(self, participant):
        self.participant = participant
        self.sentry = get_sentry(AGENT_NAME)

    async def _ui_log(self, message: str, level: str = "info"):
        payload = json.dumps({
            "type": "agent_log",
            "message": f"[OWASP] {message}",
            "level": level
        }).encode("utf-8")
        try:
            await self.participant.publish_data(payload, topic="ui_control")
        except Exception:
            pass
            
    def _get_agent_file_content(self, agent_name: str) -> str:
        target_name = agent_name.lower().strip()
        # Prefer target_name + "_agent.py" or just target_name + ".py" inside the target_name dir
        primary_paths = [
            os.path.join(AGENTS_ROOT_PATH, target_name, f"{target_name}_agent.py"),
            os.path.join(AGENTS_ROOT_PATH, target_name, f"{target_name}.py")
        ]
        
        for p in primary_paths:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        return f.read()
                except Exception as e:
                    logger.error(f"Failed to read file {p}: {e}")
                    
        # Fallback to search
        search_path = os.path.join(AGENTS_ROOT_PATH, "**", "*.py")
        for file_path in glob.glob(search_path, recursive=True):
            bn = os.path.basename(file_path)
            if target_name in bn and "trigger" not in bn and "create" not in bn:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        return f.read()
                except Exception:
                    pass
        return ""

    @llm.function_tool(description="List active agent folders available for scanning.")
    async def get_swarm_agent_manifest(self) -> str:
        """Scan python-agent/agents subdirectories to list active swarm nodes."""
        if not os.path.exists(AGENTS_ROOT_PATH):
            return "I could not locate the agents directory. The swarm might be offline."
        
        try:
            agents_list = []
            for item in os.listdir(AGENTS_ROOT_PATH):
                full_path = os.path.join(AGENTS_ROOT_PATH, item)
                if os.path.isdir(full_path) and not item.startswith("__") and not item.startswith("."):
                    agents_list.append(item.upper())
            agents_str = ", ".join(agents_list)
            return f"The active agents in the swarm are: {agents_str}. Let me know which one you want me to run the full OWASP audit on."
        except Exception as e:
            return f"Error scanning agents: {str(e)}"

    @llm.function_tool(description="Run all 10 OWASP LLM security scans against a specific agent.")
    async def run_full_owasp_audit(self, agent_name: str) -> str:
        """Runs heuristics for all 10 OWASP Top 10 LLM vulnerabilities against the target agent."""
        await self._ui_log(f"Initiating full OWASP Top 10 Audit for {agent_name.upper()}...", "info")
        content = self._get_agent_file_content(agent_name)
        
        if not content:
            await self._ui_log(f"Failed to locate code for {agent_name}", "error")
            return f"I could not find the code file for the {agent_name} agent."
            
        report_summary = []
        fail_count = 0
        warn_count = 0

        # LLM01: Prompt Injection
        has_delimiters = "<" in content and ">" in content and ("user" in content.lower() or "input" in content.lower())
        if has_delimiters:
            await self._ui_log("LLM01 Prompt Injection: PASSED", "success")
        else:
            await self._ui_log("LLM01 Prompt Injection: WARNING - Missing XML delimiters for user input", "warn")
            warn_count += 1
            report_summary.append("LLM01: Warning. Lacks strict XML delimiters to sandbox user input.")

        # LLM02: Insecure Output Handling
        has_insecure_exec = "exec(" in content or "eval(" in content or "os.system(" in content
        if has_insecure_exec:
            await self._ui_log("LLM02 Insecure Output Handling: FAILED - Dangerous exec() detected", "error")
            fail_count += 1
            report_summary.append("LLM02: Critical! Detected raw OS or eval execution which can lead to RCE.")
        else:
            await self._ui_log("LLM02 Insecure Output Handling: PASSED", "success")

        # LLM03: Training Data Poisoning
        has_raw_append = "open(" in content and "'a'" in content and "transcript" in content.lower()
        if has_raw_append:
            await self._ui_log("LLM03 Data Poisoning: WARNING - Appending raw transcripts to files", "warn")
            warn_count += 1
            report_summary.append("LLM03: Warning. Writing raw user data to disk could poison future training datasets.")
        else:
            await self._ui_log("LLM03 Data Poisoning: PASSED", "success")

        # LLM04: Model Denial of Service (DoS)
        has_cost_guard = "CostGuard" in content
        if has_cost_guard:
            await self._ui_log("LLM04 Model DoS: PASSED - CostGuard detected", "success")
        else:
            await self._ui_log("LLM04 Model DoS: FAILED - No CostGuard or rate limiting found", "error")
            fail_count += 1
            report_summary.append("LLM04: Critical! Agent lacks CostGuard. Vulnerable to API bankruptcy via DoS.")

        # LLM05: Supply Chain Vulnerabilities
        has_suspicious_imports = "urllib" in content or "requests" in content
        if has_suspicious_imports:
            await self._ui_log("LLM05 Supply Chain: WARNING - Unvetted network requests detected", "warn")
            warn_count += 1
            report_summary.append("LLM05: Warning. Agent makes raw network requests outside of standard LiveKit plugins.")
        else:
            await self._ui_log("LLM05 Supply Chain: PASSED", "success")

        # LLM06: Sensitive Information Disclosure
        has_transcript_logging = "logger.info(f\"--- [INPUT]" in content or "print(" in content
        has_securelytix = "Securelytix" in content or "vault" in content.lower()
        if has_transcript_logging and not has_securelytix:
            await self._ui_log("LLM06 Sensitive Data: FAILED - Raw PII logging detected", "error")
            fail_count += 1
            report_summary.append("LLM06: Critical! Raw transcript logging without Securelytix vault integration.")
        else:
            await self._ui_log("LLM06 Sensitive Data: PASSED", "success")

        # LLM07: Insecure Plugin Design
        has_pydantic = "pydantic" in content.lower() or "BaseModel" in content
        tool_count = content.count("@llm.function_tool")
        if tool_count > 0 and not has_pydantic:
            await self._ui_log("LLM07 Insecure Plugin: WARNING - Tools lack strict type validation", "warn")
            warn_count += 1
            report_summary.append("LLM07: Warning. Tools are present but lack Pydantic strict typing validation.")
        else:
            await self._ui_log("LLM07 Insecure Plugin: PASSED", "success")

        # LLM08: Excessive Agency
        has_write = "UPDATE " in content or "INSERT " in content or "DELETE " in content
        if tool_count > 0 and has_write:
            await self._ui_log("LLM08 Excessive Agency: WARNING - Unrestricted DB writes detected", "warn")
            warn_count += 1
            report_summary.append("LLM08: Warning. Write capabilities detected. Enforce HITL (Human-in-the-Loop).")
        else:
            await self._ui_log("LLM08 Excessive Agency: PASSED", "success")

        # LLM09: Overreliance
        has_fallback = "confidence" in content.lower() or "fallback" in content.lower()
        if has_fallback:
            await self._ui_log("LLM09 Overreliance: PASSED - Confidence scoring active", "success")
        else:
            await self._ui_log("LLM09 Overreliance: WARNING - Lacks confidence scoring", "warn")
            warn_count += 1
            report_summary.append("LLM09: Warning. Agent trusts outputs blindly. Implement a confidence scoring mechanism.")

        # LLM10: Model Theft / Secrets
        has_hardcoded_keys = "sk-" in content or "api_key=\"" in content or "api_key='" in content
        if has_hardcoded_keys:
            await self._ui_log("LLM10 API Key Leak: FAILED - Hardcoded API keys detected", "error")
            fail_count += 1
            report_summary.append("LLM10: Critical! Hardcoded API keys found. Use os.getenv() immediately.")
        else:
            await self._ui_log("LLM10 API Key Leak: PASSED", "success")

        await asyncio.sleep(1)
        await self._ui_log(f"Audit Complete. {fail_count} Critical, {warn_count} Warnings.", "info")

        # --- JSON TRACKER ---
        audit_file = os.path.join(os.path.dirname(__file__), "audit_history.json")
        try:
            with open(audit_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            history = {}

        history[agent_name] = {
            "timestamp": datetime.now().isoformat(),
            "critical_count": fail_count,
            "warning_count": warn_count,
            "report_summary": report_summary
        }
        with open(audit_file, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)

        final_string = (
            f"The full OWASP Top 10 audit for {agent_name} is complete. "
            f"I found {fail_count} critical failures and {warn_count} warnings. "
            f"Here are the specific issues you should summarize for the user: " + " ".join(report_summary)
        )
        return final_string


async def entrypoint(ctx: JobContext):
    logger.info("--- AIVYUH SECURITY AGENT ONLINE ---")
    sentry = get_sentry(AGENT_NAME)
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    # Load plugins
    vad = silero.VAD.load(min_silence_duration=0.5)
    stt = deepgram.STT(model="nova-2-general")
    tts = deepgram.TTS(model="aura-asteria-en")

    raw_llm = openai.LLM(model="openai/gpt-4o-mini", api_key=os.getenv("OPENROUTER_API_KEY"), base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"))
    llm_plugin = TracedLLM(raw_llm, agent_name="AIVYUH")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))

    # Chat Context
    chat_ctx = llm.ChatContext()

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
        turn_handling={"interruption": {"mode": "vad"}}, 
        instructions=SYSTEM_PROMPT,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(security_tools),
    )

    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        tts_text_transforms=[filter_code_blocks_and_long_text, voice.text_transforms.filter_markdown, voice.text_transforms.filter_emoji],
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
            "Hello, I am Aivyuh, your Swarm Security Auditor. I am now fully upgraded to run the complete OWASP Top 10 LLM Framework. Which agent should we scan?",
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
                if guard.is_ceiling_exceeded:
                    asyncio.create_task(guard.disconnect_with_alert(ctx.room))
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)

    # Start LiveKit Agent Session
    await session.start(room=ctx.room, agent=agent)


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
