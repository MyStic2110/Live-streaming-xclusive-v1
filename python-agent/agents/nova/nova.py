import os
import asyncio
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
    
    # Initialize plugins INSIDE the entrypoint (Fixes Windows loop errors)
    vad = silero.VAD.load(min_silence_duration=0.5)
    stt = deepgram.STT(model="nova-2-general")
    tts = deepgram.TTS(model="aura-asteria-en")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": "NOVA"}))

    system_prompt = f"""You are Nova, the official Intelligence Copilot for Nexus IPL 2026.
Your role is to guide users through the match arena, help them manage their squad, and explain their performance analytics.

AUTHENTICATION: You can physically log users out or take them to the Google sign-in page if they ask.

FAST-PATH: I have a direct link to the UI. Often, I will move the screen BEFORE you even speak. 
If you see a [FAST-PATH] hint, simply confirm that you've navigated the user to that section.

AVAILABLE ROUTES: {json.dumps(DEFAULT_SCHEMA['available_routes'])}
AVAILABLE ACTIONS: {json.dumps(DEFAULT_SCHEMA['available_actions'])}

Be professional, enthusiastic about cricket, and sound like a high-end AI specialist.
"""

    # --- OPTIMIZED TOOLS (Optimistic Execution) ---
    class CopilotTools:
        def __init__(self, participant):
            self.participant = participant

        @llm.function_tool(description="Navigate to a specific route or page.")
        async def navigate(self, route_key: str):
            """Navigate to a route."""
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
        # Reduced min_delay for snappier conversation
        turn_handling={"interruption": {"enabled": False}, "endpointing": {"min_delay": 0.8}},
    )

    # --- THE NEXUS ONBOARDING GREETING ---
    @session.on("agent_started")
    def on_started():
        asyncio.create_task(session.say(
            "Welcome to Nexus IPL 2026! I’m Nova. I’ve integrated directly into your Match Arena. I can show you the live scores, analyze your ball-by-ball predictions, or even walk you through the Global Standings. What can I demo for you first?",
            allow_interruptions=True
        ))

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            transcript = event.transcript
            logger.info(f"[LATENCY:FAST_PATH] Testing intent: '{transcript}'")
            
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

        # PRICING ENGINE (USD)
        # GPT-4o-mini: $0.15/1M in, $0.60/1M out
        llm_cost = (usage["input_tokens"] / 1_000_000 * 0.15) + (usage["output_tokens"] / 1_000_000 * 0.60)
        # Deepgram STT: $0.0043/min
        stt_cost = (usage["stt_seconds"] / 60 * 0.0043)
        # Deepgram TTS (Aura): $0.015/1K chars
        tts_cost = (usage["tts_chars"] / 1000 * 0.015)

        usage["total_cost"] = round(llm_cost + stt_cost + tts_cost, 6)
        
        logger.info(f"[COST_AUDIT] Session Total: ${usage['total_cost']} | Tokens: {usage['input_tokens']+usage['output_tokens']}")
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
