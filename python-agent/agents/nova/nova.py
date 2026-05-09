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
  "company_name": "Generic SaaS Co",
  "available_routes": {
    "dashboard": "Navigates to the main dashboard",
    "settings": "Navigates to the user settings page",
    "billing": "Navigates to the billing and invoices page"
  },
  "available_actions": {
    "logout": "Logs the user out of the application",
    "create_project": "Opens the modal to create a new project",
    "switch_dark_mode": "Toggles the application theme to dark mode"
  }
}

# --- GLOBAL PLUGINS (Pre-warmed for latency) ---
VAD_PLUGIN = silero.VAD.load(min_silence_duration=0.5) # Sharper VAD
STT_PLUGIN = deepgram.STT(model="nova-2-general")
TTS_PLUGIN = deepgram.TTS(model="aura-asteria-en") 
ROUTER = SemanticRouter()

async def entrypoint(ctx: JobContext):
    logger.info(f"--- NOVA (Optimized Pipeline) CONNECTING ---")
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": "NOVA"}))

    system_prompt = f"""You are Nova, an AI SaaS Copilot. 
Your job is to translate user commands into UI actions.

FAST-PATH ENABLED: The system may sometimes navigate the UI before you even speak. 
If you see a [FAST-PATH] hint, just confirm that you've navigated there.

AVAILABLE ROUTES: {json.dumps(DEFAULT_SCHEMA['available_routes'])}
AVAILABLE ACTIONS: {json.dumps(DEFAULT_SCHEMA['available_actions'])}
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
        vad=VAD_PLUGIN,
        stt=STT_PLUGIN,
        llm=llm_plugin,
        tts=TTS_PLUGIN,
        # Reduced min_delay for snappier conversation
        turn_handling={"interruption": {"enabled": False}, "endpointing": {"min_delay": 0.8}},
    )

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

    @ctx.room.on("data_received")
    def on_data_received(dp):
        if dp.topic == "ui_control":
            try:
                msg = json.loads(dp.data.decode("utf-8"))
                if msg.get("type") == "ack":
                    logger.info(f"[LATENCY:ACK] UI finished action '{msg.get('key')}': {msg.get('status')}")
            except: pass

    await session.start(room=ctx.room, agent=agent)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="NOVA"))
