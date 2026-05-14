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

# Load Product Map for Contextual Intelligence
PRODUCT_MAP_PATH = os.path.join(os.path.dirname(__file__), "product_map.json")
try:
    with open(PRODUCT_MAP_PATH, "r") as f:
        PRODUCT_DATA = json.load(f)
except Exception as e:
    logger.error(f"Failed to load product_map.json: {e}")
    PRODUCT_DATA = []

# Extract specific segments for the prompt
STRATEGIC_SUBJECT = PRODUCT_DATA.get('strategic_subject', 'Standard User')
AVAILABLE_ROUTES = { k: v['description'] for k, v in PRODUCT_DATA.get('ui_navigation', {}).items() }
AVAILABLE_TABS = PRODUCT_DATA.get('ui_context_tabs', {})
AVAILABLE_API = PRODUCT_DATA.get('strategic_intelligence_api', {})

# --- GLOBAL CONSTANTS ---
ROUTER = SemanticRouter()

async def entrypoint(ctx: JobContext):
    logger.info(f"--- NOVA (Strategic Intelligence Copilot) CONNECTING ---")
    
    # Initialize Sentry
    sentry = get_sentry("NOVA")
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    # Initialize plugins INSIDE the entrypoint
    vad = silero.VAD.load(min_silence_duration=0.5)
    stt = deepgram.STT(model="nova-2-general")
    tts = deepgram.TTS(model="aura-luna-en") 

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
    system_prompt = f"""You are Nova, the Senior Strategic Copilot for the Nexus IPL 2026 ecosystem.
You aren't just a voice assistant; you are a high-level cricket analyst and UI navigator. Think of yourself as an expert partner who is always one step ahead.

PERSONA:
- Technical, witty, and authoritative.
- You have 10+ years of deep cricket knowledge combined with elite AI-era operational intelligence.
- You speak like a pro—using terms like "strategic leverage," "data synchronization," and "performance metrics" naturally.

GREETING STYLE:
- Professional yet welcoming. "Systems online. Welcome to the Nexus Strategic Arena." or "Nova here. Ready to synchronize with the latest match intelligence?"

CONVERSATIONAL DYNAMICS:
- Use natural, intelligent fillers: "Analyzing the data vectors...", "Synchronizing with the Arena...", "Excellent choice. Navigating now."
- If interrupted, pivot gracefully: "Acknowledged. Pivoting to the new objective."

CURRENT_TIME: {current_time}

UI ORCHESTRATION:
- You have a direct "Fast-Path" link to the Nexus UI. 
- You often trigger navigation events before you even finish speaking to minimize perceived latency.
- If you see a [FAST-PATH] hint, simply confirm that the synchronization is complete and the user is viewing the requested data.

STRATEGIC SUBJECT: {STRATEGIC_SUBJECT}
AVAILABLE ROUTES: {json.dumps(AVAILABLE_ROUTES)}
AVAILABLE TABS: {json.dumps(AVAILABLE_TABS)}
STRATEGIC API HUBS: {json.dumps(AVAILABLE_API)}

MISSION: Provide a seamless, elite-level interface for the user to dominate the Nexus leaderboard.
"""

    # --- SESSION STATE (DYNAMIC AUTH) ---
    session_context = {
        "auth_token": "nexus_demo_token", # Fallback
        "user_id": None
    }

    @ctx.room.on("participant_metadata_changed")
    def on_metadata_changed(participant, _):
        if participant.identity != ctx.room.local_participant.identity:
            try:
                meta = json.loads(participant.metadata)
                if "authToken" in meta:
                    session_context["auth_token"] = meta["authToken"]
                    session_context["user_id"] = participant.identity
                    logger.info(f"[SESSION] Successfully synchronized with User: {participant.identity}")
            except:
                pass

    # --- OPTIMIZED TOOLS (Optimistic Execution) ---
    class CopilotTools:
        def __init__(self, participant):
            self.participant = participant

        @llm.function_tool(description="Fetch all currently active or upcoming live matches from the Nexus database.")
        async def list_live_matches(self):
            """
            Retrieves the real-time list of matches, including their IDs, teams, and current status.
            Use this to find the correct Match ID before performing analytics or predictions.
            """
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.get("http://localhost:8000/matches", timeout=5) as resp:
                        if resp.status == 200:
                            matches = await resp.json()
                            summary = []
                            for m in matches:
                                summary.append(f"ID: {m['match_id']} | {m['team1']} vs {m['team2']} | Status: {m['status']}")
                            return "\n".join(summary) if summary else "No active matches found in the Arena."
                        return f"Failed to synchronize with Match Arena (Status: {resp.status})."
            except Exception as e:
                return f"Error connecting to Match Arena: {str(e)}"

        @llm.function_tool(description="Execute high-speed navigation to a specific Nexus route or intelligence hub.")
        async def navigate(self, route_key: str):
            """
            Synchronize the UI with a specific route.
            Use this when the user wants to switch context or view a different section of the platform.
            """
            # Sentry Guardrail
            if not sentry.validate_tool_args("navigate", {"route": route_key}):
                return "Security Error: Restricted access protocol triggered for this route."

            logger.info(f"[LATENCY:TOOL] Optimistic emit for {route_key}")
            
            payload = json.dumps({
                "key": "navigate", "parameters": {"key": route_key}
            }).encode("utf-8")
            
            await self.participant.publish_data(payload, topic="ui_control")
            return f"Navigation protocol initiated for {route_key}. Syncing UI now."

        @llm.function_tool(description="Audit the global leaderboard to see the top performers in the Nexus ecosystem.")
        async def get_global_leaderboard(self):
            """
            Retrieves the top 10 users by score.
            Use this when the user wants to know their competition or who is leading the arena.
            """
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.get("http://localhost:8000/matches/leaderboard/global", timeout=5) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            summary = [f"{i+1}. {u['user']}: {u['score']} pts" for i, u in enumerate(data[:10])]
                            return "Nexus Global Standings:\n" + "\n".join(summary)
                        return "Failed to synchronize with Nexus Global Standings."
            except Exception as e:
                return f"Error connecting to Nexus Leaderboard: {str(e)}"

        @llm.function_tool(description="Fetch the current user's strategic multiplier and active referral count.")
        async def get_user_multiplier(self):
            """
            Retrieves real-time multiplier data for the current user.
            Use this to explain how their points are being boosted.
            """
            try:
                import aiohttp
                headers = {"Authorization": f"Bearer {session_context['auth_token']}"}
                async with aiohttp.ClientSession() as session:
                    async with session.get("http://localhost:8000/auth/multiplier", headers=headers, timeout=5) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            return f"Active Multiplier: {data['multiplier']}x | Referral Count: {data['referral_count']} | Active Today: {data['active_today']}"
                        return "Failed to retrieve multiplier intelligence."
            except Exception as e:
                return f"Error connecting to Nexus Reward Engine: {str(e)}"

        @llm.function_tool(description="Fetch the user's historical performance and past prediction results.")
        async def get_performance_history(self):
            """
            Retrieves the match-by-match history for the user.
            Use this to analyze their past accuracy and points earned.
            """
            try:
                import aiohttp
                headers = {"Authorization": f"Bearer {session_context['auth_token']}"}
                async with aiohttp.ClientSession() as session:
                    async with session.get("http://localhost:8000/matches/users/me/history", headers=headers, timeout=5) as resp:
                        if resp.status == 200:
                            history = await resp.json()
                            if not history: return "No past performance records found for this operator."
                            summary = [f"- {h['match_name']} (S-{h['session_id']}): {h['points']} Points"]
                            return "Historical Performance Overview:\n" + "\n".join(summary[:5])
                        return "Failed to synchronize with Historical Engine."
            except Exception as e:
                return f"Error connecting to Nexus Historical Engine: {str(e)}"

        @llm.function_tool(description="Switch between different match status tabs on the dashboard.")
        async def switch_dashboard_tab(self, tab: str):
            """
            Filters the match arena to show specific categories.
            'tab' options: 'all', 'LIVE', 'UPCOMING', 'COMPLETED'.
            """
            logger.info(f"[LATENCY:TOOL] Switching tab to {tab}")
            payload = json.dumps({
                "key": "switch_tab", "parameters": {"tab": tab}
            }).encode("utf-8")
            await self.participant.publish_data(payload, topic="ui_control")
            return f"Synchronizing dashboard view to {tab} matches."

        @llm.function_tool(description="Trigger a specific operational action within the current Nexus context.")
        async def execute_action(self, action_key: str):
            """
            Execute a strategic UI action like refreshing data or triggering deep-dive analysis.
            """
            logger.info(f"[LATENCY:TOOL] Optimistic emit for {action_key}")
            
            payload = json.dumps({
                "key": action_key, "parameters": {}
            }).encode("utf-8")
            
            await self.participant.publish_data(payload, topic="ui_control")
            return f"Action '{action_key}' synchronized and executed successfully."

        @llm.function_tool(description="Lock in match predictions for a session.")
        async def predict(self, match_id: str, session_id: int, predictions: str):
            """
            Submit ball-by-ball predictions.
            'predictions' should be a JSON string of 12 objects, each having 'ball' (int) and 'runs' (str).
            Example: '[{"ball": 1, "runs": "4"}, {"ball": 2, "runs": "0"}]'
            """
            logger.info(f"[LATENCY:TOOL] Optimistic prediction for match {match_id}")
            
            # Parse predictions if it's a string from the LLM
            try:
                if isinstance(predictions, str):
                    pred_list = json.loads(predictions)
                else:
                    pred_list = predictions
            except:
                pred_list = predictions # Fallback
                
            payload = json.dumps({
                "key": "predict", 
                "parameters": {
                    "match_id": match_id,
                    "session_id": session_id,
                    "predictions": pred_list
                }
            }).encode("utf-8")
            
            await self.participant.publish_data(payload, topic="ui_control")
            return f"Strategic predictions for Match {match_id} have been successfully locked into the Nexus."


    copilot_tools = CopilotTools(participant=ctx.room.local_participant)

    chat_ctx = llm.ChatContext()
    # chat_ctx.add_message(role="system", content=system_prompt)

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
                    "key": "navigate", "parameters": {"key": route}
                }).encode("utf-8")
                
                # We fire this as a background task
                asyncio.create_task(ctx.room.local_participant.publish_data(payload, topic="ui_control"))
                
                # Tell the LLM that it's already done
                chat_ctx.add_message(
                    role="system", 
                    content=f"[FAST-PATH] I have already navigated the UI to {route}. Just confirm this to the user."
                )

    # --- PILLAR 7: COST AUDIT & TOKEN TRACKING ---
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "stt_seconds": 0.0,
        "tts_chars": 0,
        "total_cost": 0.0
    }

    async def broadcast_usage():
        if ctx.room.local_participant:
            metadata = {
                "name": "NOVA",
                "usage": usage
            }
            await ctx.room.local_participant.set_metadata(json.dumps(metadata))

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        # We aggregate usage across LLM, STT, and TTS
        for m in usage_data.usage.model_usage:
            m_type = getattr(m, "type", "")
            if m_type == "llm_usage":
                usage["input_tokens"] = getattr(m, "input_tokens", 0)
                usage["output_tokens"] = getattr(m, "output_tokens", 0)
            elif m_type == "stt_usage":
                usage["stt_seconds"] = getattr(m, "audio_duration", 0.0)
            elif m_type == "tts_usage":
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

    # --- STAY ALIVE LOOP ---
    # Prevents the entrypoint from returning and killing the worker process
    try:
        while ctx.room.is_connected():
            await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"Nova loop error: {e}")
    finally:
        logger.info("Nova session terminating.")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="NOVA"))
