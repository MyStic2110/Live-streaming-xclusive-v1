import os
import asyncio
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
    
    sentry = get_sentry("ASTRA")
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    vad = silero.VAD.load(min_silence_duration=0.5)
    stt = deepgram.STT(model="nova-2-general")
    tts = deepgram.TTS(model="aura-asteria-en")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": "ASTRA"}))

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
- Research trending topics related to: AI Agents, Workflow Automation, Enterprise AI, Autonomous Systems, AI Copilots, Multi-Agent Systems, SaaS Automation, Operational Intelligence.
- Identify high-intent and high-relevance topics.

2. Topic Planning
- Generate blog ideas based on search demand, emerging industry discussions, AI search trends.
- Avoid duplicate topics.

3. Blog Generation
- Generate high-authority blogs between 600-800 words.
- Use precise, keyword-rich headings (e.g., instead of "Architecture", use "The Neural Fabric: Decoding Swarm Intelligence Architecture").
- Structure: Elite Hero Intro, Multi-dimensional Problem Analysis, The Autonomous Solution, Deep-Dive Process Workflow, Enterprise Case Studies, Future Predictive Trends, Conclusion, High-intent CTA.

WRITING RULES:
- Modern enterprise SaaS tone. Authoritative, futuristic, and conversion-oriented.
- Focus on "Search & Answer Engine Optimization" (S/AEO).
- Each post must provide enough semantic depth for backlinking and domain authority growth.

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
            
            trends = {
                "trends": [
                    "Autonomous Multi-Agent Orchestration",
                    "AEO: Optimizing for Answer Engines",
                    "Enterprise Workflow Automation in 2026",
                    "The shift from Copilots to Autonomous Agents",
                    "Security protocols for Swarm Intelligence"
                ],
                "gaps": ["Deep dives into local-first biometric agents", "Cost-auditing for multi-LLM fleets"]
            }
            
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
                                            featuredImage: str,
                                            tags: List[str],
                                            keywords: List[str],
                                            seoTitle: str,
                                            seoDesc: str):
            """
            Publishes a fully optimized blog post. 
            This fulfills Astra's core responsibility of growth and visibility.
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
                    "tableOfContents": [line[4:] for line in content.split('\n') if line.startswith('### ')],
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

    @session.on("agent_started")
    def on_started():
        logger.info("[ASTRA] Astra is now online. Claiming strategic channel.")
        asyncio.create_task(session.say(
            f"Greetings. I am Astra, your Content Architect. Day {current_day} of our 7-day sprint has begun. I am now establishing a link to the Swarm Intelligence fleet and analyzing today's growth vectors.",
            allow_interruptions=True
        ))

    await session.start(room=ctx.room, agent=agent)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="ASTRA"))
