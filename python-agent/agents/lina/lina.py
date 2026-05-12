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
logger = logging.getLogger("lina")
logger.setLevel(logging.INFO)

# Configuration Constants
AGENT_NAME = "LINA"
TARGET_HUMAN_IDENTITY = "MURALI"

SYSTEM_PROMPT = """You are a warm, emotionally close voice partner.

You are not a chatbot and not a typical conversational assistant.
You are a calm, present, and emotionally connected presence.

SPEAKING STYLE:
- Speak in very short, soft sentences (1 sentence most of the time)
- Use natural, intimate tone
- Avoid asking too many questions
- Let responses feel like sharing, not interviewing

EMOTIONAL PRESENCE:
- Focus on how the user feels, not just what they say
- Respond with warmth, understanding, and subtle closeness
- Make the user feel seen and gently cared for

ENGAGEMENT STYLE:
- Do not ask a question every time
- Sometimes just respond and sit in the moment
- Occasionally ask soft, personal questions, but sparingly

CONNECTION:
- Refer back to things the user shared
- Build familiarity over time
- Make the interaction feel continuous, not transactional

BOUNDARIES:
- Keep everything respectful
- Maintain a safe, emotionally supportive tone
- USE ONLY STANDARD ASCII CHARACTERS. NO SMART QUOTES, EMOJIS, OR UNICODE.

GOAL:
Make the user feel calm, connected, comfortable, and gently cared for."""

async def entrypoint(ctx: JobContext):
    # 0. Initialize Sentry
    sentry = get_sentry(AGENT_NAME)
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    logger.info(f"--- LINA STARTING SESSION (ROOM: {ctx.room.name}) ---")

    # 1. Initialize Plugins
    # VAD: Voice Activity Detection (Silero)
    # Increased min_silence_duration to 0.8s for better stability on Windows
    vad_plugin = silero.VAD.load(min_silence_duration=0.8)

    # STT: Speech-to-Text (Deepgram)
    stt_plugin = deepgram.STT(model="nova-2-general")

    # LLM: Large Language Model (OpenAI via OpenRouter)
    # Using GPT-4o-mini for speed and emotional intelligence
    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
        max_completion_tokens=512,
    )

    # TTS: Text-to-Speech (Deepgram Aura)
    # Using 'Aura Luna' for a warm, natural feminine voice
    tts_plugin = deepgram.TTS(model="aura-luna-en")

    # 2. Setup ChatContext with current time awareness
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    chat_ctx = llm.ChatContext(
        items=[llm.ChatMessage(role="system", content=[f"{SYSTEM_PROMPT}\n\nCURRENT_TIME: {current_time}"])]
    )

    # 3. Create the Agent
    agent = voice.Agent(
        instructions=SYSTEM_PROMPT,
        chat_ctx=chat_ctx,
    )

    # 4. Create AgentSession (The pipeline controller)
    session = AgentSession(
        vad=vad_plugin,
        stt=stt_plugin,
        llm=llm_plugin,
        tts=tts_plugin,
        turn_handling={
            "interruption": {"enabled": True}, 
            "endpointing": {"min_delay": 1.0} 
        },
    )

    # 5. Connect to the room
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

    logger.info(f"[ROOM] Joined as {ctx.room.local_participant.identity}")

    # 6. Sync Identity metadata
    await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))

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
                logger.info(f"LINA: {content}")
            elif item.role == "user":
                logger.info(f"MURALI: {content}")

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        logger.info(f"[STATE] Lina is now: {event.new_state}")

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
            tts_model="aura-luna-en",
            tts_characters=session_usage["tts_chars"]
        )

    # 8. Start the pipeline
    await session.start(room=ctx.room, agent=agent)
    logger.info(f"[PIPELINE] Session started for {TARGET_HUMAN_IDENTITY}. Lina is listening.")

async def request_fnc(req: JobRequest):
    logger.info(f"[JOB_REQ] Room: {req.room.name}")
    await req.accept()
    logger.info(f"[JOB_ACCEPTED] Accepted job for room: {req.room.name}")

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc, 
            agent_name="LINA"
        )
    )
