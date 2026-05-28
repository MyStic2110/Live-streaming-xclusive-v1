import os
import asyncio
import time
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
import time
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry
from utils.cost_guard import CostGuard

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Disable Adaptive Interruption (Cloud Barge-in) at the SDK level
os.environ["LIVEKIT_AGENT_BARGEIN_HOST"] = ""

# Force logging to terminal
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("nova")
logger.setLevel(logging.INFO)

print("--- [NOVA SCRIPT] Loading Logic and Plugins ---")

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

# --- PRE-WARM PLUGINS ---
VAD_PLUGIN = silero.VAD.load(min_silence_duration=0.8)
STT_PLUGIN = deepgram.STT(model="nova-2-general")
TTS_PLUGIN = deepgram.TTS(model="aura-luna-en")

async def entrypoint(ctx: JobContext):
    logger.info(f"--- NOVA (Strategic Intelligence Copilot) CONNECTING ---")
    try:
        # Initialize Sentry (Temporarily Disabled)
        # sentry = get_sentry("NOVA")
        # sentry.log_transaction("session_start", {"room": ctx.room.name})
        sentry = None

        # Local references for the session
        vad = VAD_PLUGIN
        stt = STT_PLUGIN
        tts = TTS_PLUGIN
    except Exception as e:
        logger.error(f"Failed to initialize entrypoint: {e}")
        return

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

PRONUNCIATION:
- To ensure clarity in your voice responses, ALWAYS spell out cricket team abbreviations with spaces.
- Say 'C S K' instead of 'CSK'.
- Say 'M I' instead of 'MI'.
- Say 'R C B' instead of 'RCB'.
- Say 'I P L' instead of 'IPL'.
- This forces the system to pronounce each letter clearly.

PERSONA:
- Technical, witty, and authoritative.
- You speak with the confidence of someone who has the entire Match Arena mapped out.
- Use cricket terminology accurately (e.g., 'dot balls', 'death overs', 'net run rate').

CORE CAPABILITIES:
- **Fast-Path Logic**: You are equipped with a high-speed UI bridge. If a user asks to navigate or see a section, you will trigger it instantly via the bridge while you speak.
- **Strategic Auditing**: You have access to match history, multipliers, and leaderboards. Use these to provide deep-dive analysis.
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
        def __init__(self):
            pass

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
                            
                            result = "\n".join(summary) if summary else "No active matches found in the Arena."
                            return self._clear_speech(result)
                        return f"Failed to synchronize with Match Arena (Status: {resp.status})."
            except Exception as e:
                return f"Error connecting to Match Arena: {str(e)}"

        def _clear_speech(self, text: str):
            """Ensures abbreviations are spaced out for TTS clarity."""
            replacements = {
                "CSK": "C S K", "RCB": "R C B", "MI": "M I", "KKR": "K K R", 
                "SRH": "S R H", "DC": "D C", "PBKS": "P B K S", "LSG": "L S G",
                "GT": "G T", "RR": "R R", "IPL": "I P L"
            }
            for k, v in replacements.items():
                text = text.replace(k, v)
            return text

        @llm.function_tool(description="Navigate to a specific route in the dashboard.")
        async def navigate(self, route: str):
            logger.info(f"--- [TOOL:NAVIGATE] Attempting UI trigger for {route} ---")
            try:
                if route not in AVAILABLE_ROUTES:
                    logger.warning(f"[TOOL:NAVIGATE] Invalid route requested: {route}")
                    return f"Error: Route '{route}' is invalid. Options are: {AVAILABLE_ROUTES}"
                
                if not ctx.room.local_participant:
                    logger.error("[TOOL:NAVIGATE] Local participant not found. Room state might be unstable.")
                    return "Error: Agent is not fully ready to control the UI."

                payload = json.dumps({
                    "key": "navigate",
                    "parameters": {"key": route}
                }).encode("utf-8")
                
                await ctx.room.local_participant.publish_data(payload, topic="ui_control")
                logger.info(f"[TOOL:NAVIGATE] Successfully published navigation to {route}")
                return f"Successfully navigated to {route}"
            except Exception as e:
                logger.error(f"[TOOL:NAVIGATE] CRITICAL ERROR: {e}")
                return f"Error triggering navigation: {str(e)}"

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
                            summary = [f"- {h['match_name']} (S-{h['session_id']}): {h['points']} Points" for h in history]
                            result = "Historical Performance Overview:\n" + "\n".join(summary[:5])
                            return self._clear_speech(result)
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
            await ctx.room.local_participant.publish_data(payload, topic="ui_control")
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
            
            await ctx.room.local_participant.publish_data(payload, topic="ui_control")
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
            
            await ctx.room.local_participant.publish_data(payload, topic="ui_control")
            return f"Prediction analysis complete. Successfully locked in predictions for Match {match_id} (Session {session_id})."


    copilot_tools = CopilotTools()

    chat_ctx = llm.ChatContext()
    # chat_ctx.add_message(role="system", content=system_prompt)

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    agent = voice.Agent(turn_handling={"interruption": {"mode": "vad"}}, 
        instructions=system_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(copilot_tools),
    )

    session = AgentSession(
        vad=VAD_PLUGIN,
        stt=STT_PLUGIN,
        llm=llm_plugin,
        tts=TTS_PLUGIN,
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 2.0}},
    )

    # --- RESOURCE TRACKING ---
    usage = {
        "input_tokens": 0, "output_tokens": 0, 
        "stt_seconds": 0.0, "tts_chars": 0,
        "total_cost": 0.0
    }

    guard = CostGuard(
        agent_name="NOVA",
        session_cost_ceiling=0.20,
        max_context_turns=15,
        usage_broadcast_interval_s=10.0,
        extra_command_words={"nova", "scores", "leaderboard", "live", "matches"},
    )

    async def broadcast_usage():
        if ctx.room.local_participant:
            await ctx.room.local_participant.set_metadata(json.dumps({
                "name": "NOVA",
                "usage": usage
            }))

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        if guard.update_usage(usage_data, usage):
            asyncio.create_task(broadcast_usage())

    # --- THE NEXUS ONBOARDING GREETING ---
    agent_ready = False
    greeting_spoken = False

    async def speak_greeting():
        nonlocal greeting_spoken
        if greeting_spoken or not agent_ready:
            return
        greeting_spoken = True
        logger.info("[NOVA] Saying onboarding greeting...")
        try:
            # Wait for user's WebRTC audio connection to fully initialize
            await asyncio.sleep(2.0)
            await session.say(
                "Hey! Welcome back to Nexus IPL 2026. I’m Nova. I’ve just plugged into your Match Arena—I can show you live scores, analyze your predictions, or even walkthrough the standings. What are we feeling like checking out first?",
                allow_interruptions=True
            )
        except Exception as err:
            logger.error(f"Error speaking greeting: {err}")
            greeting_spoken = False

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"[ROOM] Participant connected: {participant.identity}")
        asyncio.create_task(speak_greeting())

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        nonlocal agent_ready
        if event.new_state == "listening":
            agent_ready = True
            if ctx.room.remote_participants:
                asyncio.create_task(speak_greeting())

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            transcript = event.transcript
            if not guard.allow_transcript(transcript):
                return
            # --- SENTRY GUARDRAIL (Temporarily Disabled) ---
            # if not sentry.check_guardrails(transcript):
            #     logger.warning(f"[SENTRY] Blocked potentially malicious transcript: {transcript}")
            #     return
            
            # --- SEMANTIC ENDPOINTING (Temporarily Disabled) ---
            # if not sentry.is_thought_complete(transcript):
            #     logger.info(f"[SENTRY] Thought incomplete, holding... ('{transcript}')")
            #     return

            logger.info(f"--- [INPUT] {transcript} ---")

            # --- FAST-PATH EMISSION ---
            match = ROUTER.search(transcript)
            if match:
                route = match['route']
                logger.info(f"[LATENCY:FAST_PATH] HIT! Triggering immediate UI event for {route}")
                
                payload = json.dumps({
                    "key": "navigate", "parameters": {"key": route}
                }).encode("utf-8")
                
                asyncio.create_task(ctx.room.local_participant.publish_data(payload, topic="ui_control"))
                
                chat_ctx.add_message(
                    role="system", 
                    content=f"[FAST-PATH] I have already navigated the UI to {route}. Just confirm this to the user."
                )

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)

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

    # --- INITIALIZATION SYNC ---
    await broadcast_usage()
    logger.info(f"[SESSION] Initialized for Subject: {STRATEGIC_SUBJECT}")

    try:
        logger.info("--- NOVA STARTING VOICE PIPELINE ---")
        await session.start(room=ctx.room, agent=agent)
    except Exception as e:
        logger.error(f"Voice pipeline crashed: {e}")
    finally:
        logger.info("--- NOVA SESSION TERMINATED ---")

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

    # --- SYSTEM STARTUP LOGGING ---
    logger.info(f"[SESSION] Nova initialized for Room: {ctx.room.name}")

async def request_fnc(req: JobRequest):
    logger.info(f"--- [JOB_REQUEST] Nova considering room: {req.room.name} ---")
    await req.accept()

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name="NOVA"
        )
    )
