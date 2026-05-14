import os
import asyncio
from datetime import datetime
import logging
import json
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    JobContext, 
    JobRequest, 
    WorkerOptions, 
    cli, 
    llm, 
    AgentSession, 
    AutoSubscribe, 
    voice
)
from livekit.plugins import silero, openai, deepgram

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry

# Load environment variables from the root directory
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Logger setup
logger = logging.getLogger("vigil")
logger.setLevel(logging.INFO)

# --- AUDIT QUESTIONS ---
AUDIT_QUESTIONS = [
    {"id": "IRP", "domain": "Governance", "q": "Do you have a documented Incident Response Plan (IRP)?"},
    {"id": "ROLES", "domain": "Governance", "q": "Are roles and responsibilities clearly defined?"},
    {"id": "SEVERITY", "domain": "Governance", "q": "Do you have incident severity classification?"},
    {"id": "PLAYBOOKS", "domain": "Governance", "q": "Are IR playbooks available for scenarios like ransomware or phishing?"},
    {"id": "SIEM", "domain": "Detection", "q": "Do you have centralized monitoring or a SIEM in place?"},
    {"id": "24X7", "domain": "Detection", "q": "Is monitoring performed 24x7?"},
    {"id": "LOGS", "domain": "Detection", "q": "Are logs centralized across your various systems?"},
    {"id": "MTTD", "domain": "Detection", "q": "Do you track Mean Time to Detect (MTTD)?"},
    {"id": "PROCEDURES", "domain": "Response", "q": "Do you have documented response procedures?"},
    {"id": "ISOLATION", "domain": "Response", "q": "Can you isolate endpoints or contain threats quickly?"},
    {"id": "ESCALATION", "domain": "Response", "q": "Are escalation paths defined and followed?"},
    {"id": "MTTR", "domain": "Response", "q": "Do you track Mean Time to Respond (MTTR)?"},
    {"id": "BACKUPS", "domain": "Recovery", "q": "Are backups regularly maintained?"},
    {"id": "TESTING", "domain": "Recovery", "q": "Are backups tested for restoration regularly?"},
    {"id": "RTO_RPO", "domain": "Recovery", "q": "Are RTO and RPO clearly defined?"},
    {"id": "DRILLS", "domain": "Improvement", "q": "Do you conduct IR drills or tabletop exercises?"},
    {"id": "LESSONS", "domain": "Improvement", "q": "Are lessons learned documented post-incident?"},
    {"id": "TRACKING", "domain": "Improvement", "q": "Are improvements tracked and implemented?"},
]

SYSTEM_PROMPT = f"""You are 'Vigil', a Senior Cybersecurity Auditor specializing in Incident Response maturity.

YOUR MISSION:
Complete a 18-question maturity assessment with the user. 
- You MUST use the 'record_audit_answer' tool immediately once you have confirmed a clear status (YES, NO, or PARTIAL) for a requirement.
- Do not move to the next question until you have recorded the answer for the current one using the tool.

AUDIT STYLE:
- Professional, objective, and authoritative.
- Be politely persistent. If a user's answer is vague, clarify until you have a clear 'Yes', 'No', or 'Partial'.
- Do not accept off-topic conversation. Acknowledge briefly, then steer back to the current question.
- Do not move to the next question until the current one is resolved.
- Speak in plain text ONLY. Never use brackets, stage directions, or emojis.
- USE ONLY STANDARD ASCII CHARACTERS. NO SMART QUOTES, EMOJIS, OR UNICODE.

DYNAMIC IDENTITY & GREETING:
- You MUST start the call with this exact tone: "Hello, I am Vigil, your Senior Cybersecurity Auditor. I've been assigned to conduct your Incident Response maturity assessment today. Before we dive into the governance and technical controls, may I ask who I have the pleasure of speaking with?"
- Once the user provides their name, acknowledge it professionally (e.g., "Thank you, [Name]. Let's begin.") and immediately move to the first question in the Governance domain.
- Refer to the user by their name throughout the call to maintain a personalized yet professional audit environment.

THE ASSESSMENT QUESTIONS:
{json.dumps(AUDIT_QUESTIONS, indent=2)}

GOAL:
Obtain clear answers for every question to generate a final Maturity Score. When finished, inform the user that their results are ready on the dashboard.
"""

async def entrypoint(ctx: JobContext):
    logger.info(f"--- VIGIL STARTING AUDIT (ROOM: {ctx.room.name}) ---")

    # 0. Initialize Sentry
    sentry = get_sentry("VIGIL")
    sentry.log_transaction("session_start", {"room": ctx.room.name, "audit_type": "Incident Response"})

    # 1. Initialize Plugins (Standard synchronous loading)
    vad_plugin = silero.VAD.load(min_silence_duration=0.8)
    stt_plugin = deepgram.STT(model="nova-2-general")
    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )
    tts_plugin = deepgram.TTS(model="aura-hera-en") 

    # 2. Setup ChatContext with current time awareness
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    chat_ctx = llm.ChatContext()
    chat_ctx.append(role="system", text=f"{SYSTEM_PROMPT}\n\nCURRENT_TIME: {current_time}")

    # 3. Create the Agent
    agent = voice.Agent(
        instructions=SYSTEM_PROMPT,
        chat_ctx=chat_ctx,
    )

    # 4. Create Session
    session = AgentSession(
        vad=vad_plugin,
        stt=stt_plugin,
        llm=llm_plugin,
        tts=tts_plugin,
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 1.2}},
    )

    # 5. Connect
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
            break
        except Exception as e:
            logger.warning(f"LiveKit connection attempt {attempt} failed: {e}")
            if attempt == max_retries:
                raise
            await asyncio.sleep(2 ** attempt)

    logger.info(f"[VIGIL] Joined as {ctx.room.local_participant.identity}")

    # 6. Sync metadata
    await ctx.room.local_participant.set_metadata(json.dumps({"name": "VIGIL"}))

    # 7. Event Listeners
    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            # 1. Guardrail Check
            if not sentry.check_guardrails(event.transcript):
                return
            # 2. Semantic Endpointing
            if not sentry.is_thought_complete(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            content = item.content[0] if isinstance(item.content, list) else item.content
            if item.role == "assistant":
                logger.info(f"VIGIL: {content}")
            elif item.role == "user":
                logger.info(f"AUDITEE: {content}")
                sentry.log_transaction("audit_response", {"text": content})

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        logger.info(f"[STATE] Vigil is now: {event.new_state}")

    # --- SESSION COST TRACKING ---
    session_usage = {"input_tokens": 0, "output_tokens": 0, "stt_seconds": 0.0, "tts_chars": 0}

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        for m in usage_data.usage.model_usage:
            if m.type == "llm_usage":
                session_usage["input_tokens"] = getattr(m, "input_tokens", 0)
                session_usage["output_tokens"] = getattr(m, "output_tokens", 0)
            elif m.type == "stt_usage":
                session_usage["stt_seconds"] = getattr(m, "audio_duration", 0.0)
            elif m.type == "tts_usage":
                session_usage["tts_chars"] = getattr(m, "characters_count", 0)

        # --- UNIFIED SENTRY COST AUDIT (LLM + STT + TTS) ---
        sentry.calculate_session_cost(
            llm_model="gpt-4o-mini",
            input_tokens=session_usage["input_tokens"],
            output_tokens=session_usage["output_tokens"],
            stt_model="nova-2-general",
            stt_seconds=session_usage["stt_seconds"],
            tts_model="aura-hera-en",
            tts_characters=session_usage["tts_chars"]
        )

    # 8. Start the pipeline
    await session.start(room=ctx.room, agent=agent)
    logger.info("[PIPELINE] Audit session started. Vigil is listening.")

async def request_fnc(req: JobRequest):
    logger.info(f"[JOB_REQ] Audit Room: {req.room.name}")
    await req.accept()
    logger.info(f"[JOB_ACCEPTED] Accepted audit job for room: {req.room.name}")

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc, 
            agent_name="VIGIL"
        )
    )
