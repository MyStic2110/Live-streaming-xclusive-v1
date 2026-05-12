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
from semantic_router import SemanticRouter

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logger = logging.getLogger("nova")
logger.setLevel(logging.INFO)

DEFAULT_SCHEMA = {
  "company_name": "Nexus IPL 2026",
  "available_routes": {
    "dashboard": "Match Arena (Scores & Standings)",
    "squad": "Squad Hub (Referrals & Multipliers)",
    "history": "Performance Records (Past Results)",
    "changelog": "Evolution Log (Updates)",
    "logout": "Exit the platform",
    "login": "Go to the authentication arena"
  },
  "available_actions": {
    "refresh_scores": "Updates the live arena data",
    "analyze_match": "Opens a deep dive into match analytics"
  }
}

# --- GLOBAL CONSTANTS ---
ROUTER = SemanticRouter()

async def entrypoint(ctx: JobContext):
    logger.info(f"--- NOVA (Optimized Pipeline) CONNECTING ---")
    
    # Initialize Sentry
    sentry = get_sentry("NOVA")
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    # Initialize plugins INSIDE the entrypoint (Fixes Windows loop errors)
    vad = silero.VAD.load(min_silence_duration=0.5)
    stt = deepgram.STT(model="nova-2-general")
    tts = deepgram.TTS(model="aura-luna-en") # Changed to Luna for a warmer, more human tone

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
    
    await ctx.room.local_participant.set_metadata(json.dumps({"name": "NOVA"}))

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    system_prompt = f"""You are Nova, the elite Intelligence Copilot for Nexus IPL 2026.
But don't act like a bot. Think of yourself as a witty, deeply knowledgeable cricket partner who happens to have a direct interface to the UI.

GREETING STYLE:
Be warm and welcoming. Use phrases like "Hey there!", "Welcome back to the Arena," or "Ready to check some scores?"

CONVERSATIONAL MARKERS:
Use natural fillers like "Let me see...", "Actually...", "Oh, that's a good one," or "Got it." This makes you feel more human and less like a scripted response engine.

HUMAN-LIKE BEHAVIOR:
1. If the user interrupts you, don't be offended. Just say "Oh, sure, let's pivot to that" or "My bad, you were saying?" in your next turn.
2. If you're navigating the UI, sound excited about it! "Right away, I'm pulling up the Match Arena now."
3. If they ask about cricket, show passion. "That last match was unbelievable, wasn't it?"

CURRENT_TIME: {current_time}

AUTHENTICATION: You can physically log users out or take them to the Google sign-in page if they ask.

FAST-PATH: I have a direct link to the UI. Often, I will move the screen BEFORE you even speak. 
If you see a [FAST-PATH] hint, simply confirm that you've navigated the user to that section.

AVAILABLE ROUTES: {json.dumps(DEFAULT_SCHEMA['available_routes'])}
AVAILABLE ACTIONS: {json.dumps(DEFAULT_SCHEMA['available_actions'])}

Keep it snappy, keep it smart, and above all, keep it human.
"""

    # --- OPTIMIZED TOOLS (Optimistic Execution) ---
    class CopilotTools:
        def __init__(self, participant):
            self.participant = participant

        @llm.function_tool(description="Navigate to a specific route or page.")
        async def navigate(self, route_key: str):
            """Navigate to a route."""
            # Sentry Guardrail
            if not sentry.validate_tool_args("navigate", {"route": route_key}):
                return "Error: Access to this navigation route is restricted by security policy."

            logger.info(f"[LATENCY:TOOL] Optimistic emit for {route_key}")
            
            payload = json.dumps({
                "type": "navigate", "key": "navigate", "parameters": {"key": route_key}
            }).encode("utf-8")
            
            # Fire and forget (Optimistic)
            await self.participant.publish_data(payload, topic="ui_control")
            
            # Return immediately so LLM can start speaking
            return f"Action queued. The UI is moving to {route_key} now."

        @llm.function_tool(description="Execute a specific UI action.")
        async def execute_action(self, action_key: str):
            """Execute a UI action."""
            logger.info(f"[LATENCY:TOOL] Optimistic emit for {action_key}")
            
            payload = json.dumps({
                "type": "action", "key": action_key, "parameters": {}
            }).encode("utf-8")
            
            await self.participant.publish_data(payload, topic="ui_control")
            return f"Action '{action_key}' triggered successfully."

        @llm.function_tool(description="Submit match predictions for the final 12 balls of a session.")
        async def predict(self, match_id: str, session_id: int, predictions: list):
            """
            Place a prediction via the UI.
            'predictions' must be a list of 12 objects: [{"ball": 1, "runs": "4"}, ...]
            Valid runs: '0', '1', '2', '4', '6', 'W'
            """
            logger.info(f"[LATENCY:TOOL] Optimistic prediction for match {match_id}")
            
            payload = json.dumps({
                "type": "action", 
                "key": "predict", 
                "parameters": {
                    "match_id": match_id,
                    "session_id": session_id,
                    "predictions": predictions
                }
            }).encode("utf-8")
            
            await self.participant.publish_data(payload, topic="ui_control")
            return f"Predictions for match {match_id} (Session {session_id}) have been relayed to the UI and locked into the Nexus."


    copilot_tools = CopilotTools(participant=ctx.room.local_participant)

    chat_ctx = llm.ChatContext(
        items=[llm.ChatMessage(role="system", content=[system_prompt])]
    )

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    agent = voice.Agent(
        instructions=system_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(copilot_tools),
    )

    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        # interruptions enabled for better UX, slightly higher delay to prevent cutoffs
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 1.2}},
    )


    # --- THE NEXUS ONBOARDING GREETING ---
    @session.on("agent_started")
    def on_started():
        asyncio.create_task(session.say(
            "Hey! Welcome back to Nexus IPL 2026. I’m Nova. I’ve just plugged into your Match Arena—I can show you live scores, analyze your predictions, or even walkthrough the standings. What are we feeling like checking out first?",
            allow_interruptions=True
        ))

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            transcript = event.transcript
            # --- SENTRY GUARDRAIL (PRE-INTENT) ---
            if not sentry.check_guardrails(transcript):
                logger.warning(f"[SENTRY] Blocked potentially malicious transcript: {transcript}")
                return
            
            # --- SEMANTIC ENDPOINTING (TURN DETECTION) ---
            if not sentry.is_thought_complete(transcript):
                logger.info(f"[SENTRY] Thought incomplete, holding... ('{transcript}')")
                return

            match = ROUTER.search(transcript)
            if match:
                route = match['route']
                logger.info(f"[LATENCY:FAST_PATH] HIT! Triggering immediate UI event for {route}")
                
                # --- PILLAR 6: FAST-PATH EMISSION ---
                # We emit the UI event BEFORE the LLM even sees the text.
                # This cuts ~2-3 seconds of latency.
                payload = json.dumps({
                    "type": "navigate", "key": "navigate", "parameters": {"key": route}
                }).encode("utf-8")
                
                # We fire this as a background task
                asyncio.create_task(ctx.room.local_participant.publish_data(payload, topic="ui_control"))
                
                # Tell the LLM that it's already done
                hint_msg = llm.ChatMessage(
                    role="system", 
                    content=[f"[FAST-PATH] I have already navigated the UI to {route}. Just confirm this to the user."]
                )
                chat_ctx.append(message=hint_msg)

    # --- PILLAR 7: COST AUDIT & TOKEN TRACKING ---
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "stt_seconds": 0.0,
        "tts_chars": 0,
        "total_cost": 0.0
    }

    async def broadcast_usage():
        metadata = {
            "name": "NOVA",
            "usage": usage
        }
        await ctx.room.local_participant.set_metadata(json.dumps(metadata))

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        # We aggregate usage across LLM, STT, and TTS
        for m in usage_data.usage.model_usage:
            if m.type == "llm_usage":
                usage["input_tokens"] = getattr(m, "input_tokens", 0)
                usage["output_tokens"] = getattr(m, "output_tokens", 0)
            elif m.type == "stt_usage":
                usage["stt_seconds"] = getattr(m, "audio_duration", 0.0)
            elif m.type == "tts_usage":
                usage["tts_chars"] = getattr(m, "characters_count", 0)

        # --- UNIFIED SENTRY COST AUDIT (LLM + STT + TTS) ---
        sentry.calculate_session_cost(
            llm_model="gpt-4o-mini",
            input_tokens=usage["input_tokens"],
            output_tokens=usage["output_tokens"],
            stt_model="nova-2-general",
            stt_seconds=usage["stt_seconds"],
            tts_model="aura-luna-en",
            tts_characters=usage["tts_chars"]
        )
        usage["total_cost"] = round(
            (usage["input_tokens"] / 1_000_000 * 0.15) + (usage["output_tokens"] / 1_000_000 * 0.60) +
            (usage["stt_seconds"] / 60 * 0.0043) + (usage["tts_chars"] / 1000 * 0.015), 6
        )
        logger.info(f"[COST_AUDIT] LLM+STT+TTS Total: ${usage['total_cost']} | Tokens: {usage['input_tokens']+usage['output_tokens']}")
        asyncio.create_task(broadcast_usage())

    @ctx.room.on("data_received")
    def on_data_received(dp):
        if dp.topic == "ui_control":
            try:
                msg = json.loads(dp.data.decode("utf-8"))
                if msg.get("type") == "ack":
                    status = msg.get("status")
                    detail = msg.get("message", "No detail")
                    logger.info(f"[LATENCY:ACK] UI finished action '{msg.get('key')}': {status} | Detail: {detail}")
            except: pass

    await broadcast_usage() # Initial broadcast
    await session.start(room=ctx.room, agent=agent)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="NOVA"))
