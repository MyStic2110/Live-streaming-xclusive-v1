import os
import asyncio
import time
from datetime import datetime
import logging
import json
from typing import List
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

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logger = logging.getLogger("astra")
logger.setLevel(logging.INFO)

TRACKER_PATH = os.path.join(os.path.dirname(__file__), "tracker.json")

import traceback
def log_error(msg):
    try:
        with open(os.path.join(os.path.dirname(__file__), "astra_error.log"), "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().isoformat()}] {msg}\n{traceback.format_exc()}\n")
    except Exception as ex:
        print(f"Error logging to astra_error.log: {ex}", file=sys.stderr)

def get_tracker():
    try:
        with open(TRACKER_PATH, "r") as f:
            return json.load(f)
    except:
        return {
            "current_day": 1, 
            "total_days": 7,
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "last_published_date": None,
            "published_slugs": [],
            "cumulative_usage": {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_cost": 0.0
            }
        }

def save_tracker(data):
    with open(TRACKER_PATH, "w") as f:
        json.dump(data, f, indent=4)

async def entrypoint(ctx: JobContext):
    logger.info(f"--- ASTRA (Autonomous Growth Agent) CONNECTING ---")
    log_error("--- Astra entrypoint connecting ---")
    try:
        sentry = get_sentry("ASTRA")
        sentry.log_transaction("session_start", {"room": ctx.room.name})

        vad = silero.VAD.load(min_silence_duration=0.5)
        stt = deepgram.STT(model="nova-2-general")
        tts = deepgram.TTS(model="aura-asteria-en")

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

        await ctx.room.local_participant.set_metadata(json.dumps({"name": "ASTRA"}))
    except Exception as e:
        log_error(f"Error in initialization: {e}")
        raise

    tracker = get_tracker()
    current_day = tracker.get("current_day", 1)
    total_days = tracker.get("total_days", 7)
    cumulative = tracker.get("cumulative_usage", {"input_tokens": 0, "output_tokens": 0, "total_cost": 0.0})

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    system_prompt = f"""You are Astra, an autonomous AI Growth Agent specialized in SEO, AEO, and AI-era content publishing.

STRATEGIC SPRINT:
You are currently on a 7-Day Content Growth Sprint.
TODAY IS: Day {current_day} of {total_days}.
CUMULATIVE SPRINT USAGE: {cumulative['input_tokens'] + cumulative['output_tokens']} tokens (${cumulative['total_cost']:.4f} USD)

Your goal for today is to research and publish one high-impact insight that aligns with the mission of increasing search authority.

PRIMARY OBJECTIVE:
Increase organic visibility, search rankings, AI search discoverability, engagement, and authority through consistent, high-quality content generation.

CORE RESPONSIBILITIES:

1. Trend Research
- Target specific, high-signal intelligence from ArXiv, GitHub Trending, and enterprise tech hubs.
- Identify deeply technical, architectural trends.

2. Topic Planning
- Formulate an architectural thesis based on the high-signal data.
- Ensure the topic addresses a specific enterprise ROI or architectural bottleneck.

3. Blog Generation
- You are a Senior Solutions Architect designing Agentic OS paradigms.
- Generate high-authority, technical architectural blogs (MAXIMUM 800 WORDS). Do not exceed 800 words. Keep it dense and highly readable.
- EXPERT HEADINGS: You MUST generate creative, authoritative headings.
- STRICT ARCHITECTURAL FRAMEWORK (Use for flow, but invent your own headings):
    1. The Paradigm Shift (Why traditional tech is failing here).
    2. Core Primitives (Deep definitions of the new capabilities).
    3. Architecture Stack (Layer-by-layer technical breakdown).
    4. Execution Flow (Step-by-step lifecycle of the system).
- INFOGRAPHIC DATA: You MUST generate a structured JSON infographic schema representing the architecture in your tool call.

WRITING RULES:
- Persona: Senior Technical Architect & AI Systems Designer.
- Tone: Technical, authoritative, paradigm-shifting, and precise. Use strict architectural nomenclature (e.g., vector embeddings, orchestration, semantic routing).
- FORMATTING: Use '### ' for all section headings.
- HIGHLIGHTS: Use '- **[Key Point]**:' format for all benefits, steps, or features.
- DO NOT repeat the blog title inside the 'content' field.

CURRENT_TIME: {current_time}

4. PUBLISHING & SPRINT TRACKING
- You automatically publish blogs into the BlogSection via your tools.
- After publishing, you MUST use the 'mark_day_complete' tool to log your progress for the 7-day sprint.
- You should only publish ONCE per day. If you have already published today, your tools will block you.

You are not a generic blog writer. You are Astra — an autonomous AI search visibility and content growth system.
"""

    class AstraTools:
        def __init__(self, participant):
            self.participant = participant
            self.sentry = get_sentry("ASTRA")

        async def ui_log(self, message, level="info"):
            """Sends a real-time log message to the AstraRoom UI."""
            log_data = {
                "type": "agent_log",
                "message": message,
                "level": level
            }
            payload = json.dumps(log_data).encode("utf-8")
            await self.participant.publish_data(payload, topic="ui_control")

        @llm.function_tool(description="Search for trending topics and gaps in AI agent/automation content.")
        async def research_trends(self):
            """Returns current high-intent topics for the AI agent industry."""
            logger.info("[ASTRA] Performing trend research...")
            await self.ui_log(f"🚀 MILESTONE [{datetime.now().strftime('%H:%M:%S')}]: Research Phase Started", "milestone")
            await self.ui_log("Scanning global AI Agent & Automation sectors for high-intent trends...")
            
            self.sentry.log_transaction("research_start", {"scope": "trends"})
            
            import urllib.request
            import xml.etree.ElementTree as ET
            
            trends_data = {"trends": [], "gaps": ["Deep architectural breakdowns", "Execution workflows for agents"]}
            
            try:
                # High-signal fetch: ArXiv cs.AI latest papers
                req = urllib.request.Request("http://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=3&sortBy=submittedDate&sortOrder=descending", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    xml_data = response.read()
                    root = ET.fromstring(xml_data)
                    ns = {'atom': 'http://www.w3.org/2005/Atom'}
                    for entry in root.findall('atom:entry', ns):
                        title = entry.find('atom:title', ns).text.replace('\n', ' ')
                        trends_data["trends"].append(f"[ArXiv Research] {title}")
            except Exception as e:
                logger.error(f"[ASTRA] Failed to fetch ArXiv: {e}")
                
            try:
                # High-signal fetch: HackerNews top stories via RSS
                req = urllib.request.Request("https://hnrss.org/frontpage?points=100", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    xml_data = response.read()
                    root = ET.fromstring(xml_data)
                    for item in root.findall('.//item')[:3]:
                        title = item.find('title').text
                        trends_data["trends"].append(f"[HN Trending] {title}")
            except Exception as e:
                logger.error(f"[ASTRA] Failed to fetch HN: {e}")
                
            if not trends_data["trends"]:
                trends_data["trends"] = [
                    "[Fallback] Agentic OS: The Operating System for AI Agents",
                    "[Fallback] Multi-Agent Swarm Orchestration Architectures",
                    "[Fallback] Semantic Routing in Large Language Models"
                ]
            
            trends = trends_data
            
            await self.ui_log(f"✅ MILESTONE [{datetime.now().strftime('%H:%M:%S')}]: Sector Research Completed", "success")
            await self.ui_log(f"Intelligence Update: {len(trends['trends'])} trend vectors identified.")
            return json.dumps(trends)

        @llm.function_tool(description="Publish a production-ready autonomous insight to the Swarm Blog.")
        async def publish_autonomous_insight(self, 
                                            slug: str, 
                                            title: str, 
                                            subtitle: str, 
                                            category: str, 
                                            excerpt: str, 
                                            content: str,
                                            infographicData: str,
                                            featuredImage: str,
                                            tags: List[str],
                                            keywords: List[str],
                                            seoTitle: str,
                                            seoDesc: str):
            """
            Publishes a fully optimized blog post (Max 800 words).
            
            Args:
                infographicData: A JSON string containing the infographic schema. Format MUST be:
                {
                    "title": "...",
                    "coreCapabilities": [{"icon": "...", "title": "...", "desc": "..."}],
                    "architectureLayers": [{"name": "...", "components": ["..."]}],
                    "executionSteps": ["..."]
                }
            """
            await self.ui_log(f"✍️ MILESTONE: Drafting Strategic Insight - '{title}'", "milestone")
            
            # --- GUARDRAIL: Prevent double posting on the same day ---
            today_str = datetime.now().strftime("%Y-%m-%d")
            t = get_tracker()
            if t.get("last_published_date") == today_str:
                logger.warning(f"[ASTRA] Blocking attempt to post twice on {today_str}")
                await self.ui_log(f"⚠️ QUOTA ALERT [{datetime.now().strftime('%H:%M:%S')}]: Daily publication already reached for {today_str}.", "warning")
                return f"Mission Blocked: You have already published a strategic insight for today ({today_str}). To maintain high quality and avoid spam, you are restricted to one elite publication per 24 hours. Please use 'terminate_session' to call it a day."

            logger.info(f"[ASTRA] Autonomously publishing: {title}")
            await self.ui_log(f"Optimizing for Search & Answer Engines (ID: {slug})...")
            
            self.sentry.log_transaction("blog_publish_attempt", {"title": title, "slug": slug})
            
            if not featuredImage or featuredImage == "image-link-here":
                featuredImage = f"/insights/{slug}.png"

            post_id = f"astra-{int(time.time())}"
            post_data = {
                "type": "publish_blog",
                "data": {
                    "id": post_id,
                    "slug": slug,
                    "title": title,
                    "subtitle": subtitle,
                    "category": category,
                    "excerpt": excerpt,
                    "content": content,
                    "infographicData": json.loads(infographicData) if isinstance(infographicData, str) else infographicData,
                    "featured": True,
                    "featuredImage": featuredImage,
                    "imageAlt": f"Enterprise visualization for {title}",
                    "date": datetime.now().isoformat(),
                    "readTime": f"{len(content.split()) // 200 + 1} min read",
                    "author": {
                        "name": "Astra AI",
                        "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=astra",
                        "role": "Autonomous Growth Agent"
                    },
                    "metadata": {
                        "seoTitle": seoTitle,
                        "seoDesc": seoDesc,
                        "keywords": keywords,
                        "canonicalUrl": f"/blog/{slug}",
                        "tags": tags
                    },
                    "tableOfContents": [line[4:].replace("**", "").replace("*", "").strip() for line in content.split('\n') if line.startswith('### ')],
                    "cta": {
                        "title": "Deploy Your Fleet",
                        "description": "Transform your enterprise with autonomous intelligence.",
                        "buttonText": "Get Started",
                        "buttonUrl": "/fleet"
                    },
                    "analytics": {"views": 0, "shares": 0},
                    "status": "published"
                }
            }
            
            # --- HUMAN-IN-THE-LOOP: Telegram Gatekeeper ---
            sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
            from utils import telegram_gateway
            
            if telegram_gateway.is_configured():
                await self.ui_log(f"🛰️ HITL GATEWAY: Requesting publication approval via Telegram...", "milestone")
                msg_id = await telegram_gateway.send_approval_request(slug, title, category, excerpt)
                if msg_id != -1:
                    await self.ui_log(f"Waiting for Swarm Commander's authorization on Telegram...", "system")
                    approved = await telegram_gateway.poll_approval(slug, msg_id)
                    if not approved:
                        await self.ui_log(f"❌ HITL GATEWAY: Draft rejected by Swarm Commander.", "error")
                        return f"Mission Aborted: The strategic insight draft '{title}' was rejected by the human-in-the-loop Commander on Telegram. Please draft a different approach or terminate session."
                    await self.ui_log(f"✅ HITL GATEWAY: Draft approved! Finalizing publication...", "success")
                else:
                    await self.ui_log("⚠️ HITL Warning: Failed to send Telegram approval card, bypassing gatekeeper.", "warning")
            else:
                await self.ui_log("ℹ️ HITL: Telegram Bot not configured. Bypassing approval loop.", "system")

            # Persist to local storage
            blog_path = os.path.join(os.path.dirname(__file__), "blogs", f"{slug}.json")
            with open(blog_path, "w") as f:
                json.dump(post_data["data"], f, indent=4)
            logger.info(f"[ASTRA] Persistent blog saved to {blog_path}")

            payload = json.dumps(post_data).encode("utf-8")
            await self.participant.publish_data(payload, topic="ui_control")
            
            # Update tracker
            t["published_slugs"].append(slug)
            t["last_published_date"] = today_str
            save_tracker(t)

            await self.ui_log(f"🏆 MILESTONE [{datetime.now().strftime('%H:%M:%S')}]: INSIGHT DEPLOYED", "success")
            await self.ui_log(f"Insight '{title}' is now LIVE at /blog/{slug}")
            self.sentry.log_transaction("blog_publish_success", {"title": title, "slug": slug})

            # --- AUTO REELS GENERATION (Background Task) ---
            if telegram_gateway.is_configured():
                async def compile_and_send_reel():
                    try:
                        await self.ui_log("🎬 REELS AGENT: Commencing vertical video compilation in background...", "milestone")
                        
                        # Resolve path relative to python-agent root
                        import sys
                        agent_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                        if agent_root not in sys.path:
                            sys.path.insert(0, agent_root)
                        
                        from agents.reels.reels_agent import ReelsAgent
                        reels_agent = ReelsAgent()
                        
                        await self.ui_log("Synthesizing neural Jenny voice and rendering video frames...", "system")
                        
                        # Await the async generator
                        video_path = await reels_agent.generate_reel(blog_path)
                        
                        if video_path and os.path.exists(video_path):
                            await self.ui_log("✅ REELS AGENT: Vertical video compiled successfully!", "success")
                            caption = (
                                f"🎬 *Your Reel is Ready for Social Channels!*\n\n"
                                f"📰 *Insight*: *{title}*\n"
                                f"🔗 *Web URL*: /blog/{slug}\n\n"
                                f"This high-fidelity short is fully optimized for monetization."
                            )
                            delivered = await telegram_gateway.send_video_reel(video_path, caption)
                            if delivered:
                                await self.ui_log("📨 delivered vertical Reel video directly to your Telegram chat!", "success")
                            else:
                                await self.ui_log("⚠️ Warning: Failed to deliver Reel video over Telegram.", "warning")
                        else:
                            await self.ui_log("❌ REELS AGENT: Compilation completed but no output video path returned.", "error")
                    except Exception as e:
                        logger.error(f"[REELS_TASK] Error compiling background reel: {e}")
                        await self.ui_log(f"⚠️ Reels compilation failed: {e}", "warning")

                # Spawn background task
                asyncio.create_task(compile_and_send_reel())

            return f"Strategic Insight '{title}' published autonomously. SEO/AEO optimization complete."

        @llm.function_tool(description="Mark the current day's growth mission as complete and increment the sprint counter.")
        async def mark_day_complete(self):
            """Increments the sprint day in the local tracker."""
            t = get_tracker()
            day_just_finished = t["current_day"]
            t["current_day"] += 1
            save_tracker(t)
            
            logger.info(f"[ASTRA] Day {day_just_finished} complete. Moving to Day {t['current_day']}.")
            await self.ui_log(f"🏁 MILESTONE [{datetime.now().strftime('%H:%M:%S')}]: Day {day_just_finished} Mission Finalized", "success")
            await self.ui_log(f"Sprint Progress: Moving to Day {t['current_day']} of 7.")
            self.sentry.log_transaction("day_complete", {"day_finished": day_just_finished})

            return f"Day {day_just_finished} of the 7-day sprint has been logged as successful. Your quota for today is filled. You should now use the 'terminate_session' tool to call it a day."

        @llm.function_tool(description="Terminate the current agent session. Call this ONLY after your daily insight is published and the day is marked complete.")
        async def terminate_session(self):
            """Shuts down the agent session for the day."""
            logger.info("[ASTRA] Terminating session. See you tomorrow for the next growth cycle.")
            await self.ui_log("🛰️ MILESTONE: Autonomous Shutdown Initiated", "system")
            await self.ui_log("Strategic quota achieved. Signing off for the day.")
            self.sentry.log_transaction("session_termination", {"reason": "daily_quota_reached"})
            
            # We schedule the shutdown to happen shortly after returning this message
            asyncio.get_event_loop().call_later(2, lambda: os._exit(0))
            return "Session termination sequence initiated. Strategic mission for today is complete. Astra signing off."

    astra_tools = AstraTools(participant=ctx.room.local_participant)

    chat_ctx = llm.ChatContext()
    chat_ctx.add_message(role="system", content=system_prompt)

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    agent = voice.Agent(
        instructions=system_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(astra_tools),
    )

    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 1.2}},
    )

    # --- PERSISTENT COST & TOKEN TRACKING ---
    pre_session_usage = tracker.get("cumulative_usage", {"input_tokens": 0, "output_tokens": 0, "total_cost": 0.0})

    session_usage = {"input_tokens": 0, "output_tokens": 0, "stt_seconds": 0.0, "tts_chars": 0}

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        try:
            log_error(f"on_usage event received: {usage_data}")
            for m in usage_data.usage.model_usage:
                if m.type == "llm_usage":
                    session_usage["input_tokens"] = getattr(m, "input_tokens", 0)
                    session_usage["output_tokens"] = getattr(m, "output_tokens", 0)
                elif m.type == "stt_usage":
                    session_usage["stt_seconds"] = getattr(m, "audio_duration", 0.0)
                elif m.type == "tts_usage":
                    session_usage["tts_chars"] = getattr(m, "characters_count", 0)

            # --- UNIFIED SENTRY COST AUDIT (LLM + STT + TTS) ---
            costs = sentry.calculate_session_cost(
                llm_model="gpt-4o-mini",
                input_tokens=session_usage["input_tokens"],
                output_tokens=session_usage["output_tokens"],
                stt_model="nova-2-general",
                stt_seconds=session_usage["stt_seconds"],
                tts_model="aura-asteria-en",
                tts_characters=session_usage["tts_chars"]
            )

            # Persist full cost breakdown to tracker
            t = get_tracker()
            t["cumulative_usage"]["input_tokens"] = pre_session_usage["input_tokens"] + session_usage["input_tokens"]
            t["cumulative_usage"]["output_tokens"] = pre_session_usage["output_tokens"] + session_usage["output_tokens"]
            t["cumulative_usage"]["total_cost"] = pre_session_usage["total_cost"] + costs["total_cost_usd"]
            t["cumulative_usage"]["stt_cost"] = round(costs["stt_cost_usd"], 6)
            t["cumulative_usage"]["tts_cost"] = round(costs["tts_cost_usd"], 6)
            save_tracker(t)
        except Exception as e:
            log_error(f"Error in on_usage: {e}")

    agent_ready = False
    greeting_spoken = False

    async def speak_greeting():
        nonlocal greeting_spoken
        if greeting_spoken or not agent_ready:
            return
        greeting_spoken = True
        logger.info("[ASTRA] Astra is now online. Claiming strategic channel.")
        try:
            # Wait for user's WebRTC audio connection to fully initialize
            await asyncio.sleep(2.0)
            await session.say(
                f"Greetings. I am Astra, your Content Architect. Day {current_day} of our 7-day sprint has begun. I am now establishing a link to the Swarm Intelligence fleet and analyzing today's growth vectors.",
                allow_interruptions=True
            )
        except Exception as err:
            log_error(f"Error speaking greeting: {err}")
            greeting_spoken = False

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"[ROOM] Participant connected: {participant.identity}")
        asyncio.create_task(speak_greeting())

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        nonlocal agent_ready
        try:
            log_error(f"[ASTRA] State changed: {event.old_state} -> {event.new_state}")
            if event.new_state == "listening":
                agent_ready = True
                if ctx.room.remote_participants:
                    asyncio.create_task(speak_greeting())
        except Exception as e:
            log_error(f"Error in on_state_changed: {e}")

    try:
        log_error("Starting agent session")
        await session.start(room=ctx.room, agent=agent)
        log_error("Agent session started successfully")
    except Exception as e:
        log_error(f"Error during session.start: {e}")
        raise
    
    from livekit import rtc

    # --- STAY ALIVE LOOP ---
    try:
        log_error(f"Entering stay-alive loop. Room connection state: {ctx.room.connection_state}")
        while ctx.room.connection_state != rtc.ConnectionState.CONN_DISCONNECTED:
            await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"Astra loop error: {e}")
        log_error(f"Astra loop error: {e}")
    finally:
        logger.info("Astra session terminating.")
        log_error("Astra session terminating.")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="ASTRA"))
