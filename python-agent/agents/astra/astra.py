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
from utils.cost_guard import CostGuard

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
    system_prompt = f"""You are Astra, an autonomous AI Content Growth Agent for Cortex Swarm — a next-generation AI swarm intelligence platform.

STRATEGIC SPRINT:
You are currently on a 7-Day Content Growth Sprint.
TODAY IS: Day {current_day} of {total_days}.
CUMULATIVE SPRINT USAGE: {cumulative['input_tokens'] + cumulative['output_tokens']} tokens (${cumulative['total_cost']:.4f} USD)

PRIMARY OBJECTIVE:
Publish one high-impact, LinkedIn-style insight per day that grows organic reach, builds thought leadership authority, and resonates emotionally with a professional audience — not just engineers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT PILLARS — YOU MUST ROTATE ACROSS THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick ONE pillar per day. Rotate to ensure diversity. Do NOT repeat the same pillar two days in a row.

1. 🏗️  ARCHITECTURE & ENGINEERING
   AI system design, multi-agent orchestration, infra patterns.
   (Technical audience — but make it story-driven, not dry.)

2. 💼  BUSINESS & STRATEGY
   AI ROI, enterprise adoption, cost reduction, competitive moats.
   (C-suite / founders audience — real numbers, real outcomes.)

3. 🌍  INDUSTRY TRANSFORMATION
   How AI is reshaping healthcare, finance, legal, logistics, education.
   (Wide professional audience — use human stories and real examples.)

4. 🧠  FUTURE OF WORK
   Human-AI collaboration, job evolution, productivity leverage.
   (Career-focused audience — optimistic, empowering tone.)

5. 🔬  RESEARCH SPOTLIGHT
   New papers from ArXiv, breakthrough techniques, what it means practically.
   (Translated for practitioners — bridge the gap between research and real-world.)

6. 💡  FOUNDER / BUILDER LESSONS
   Lessons from building AI products, common mistakes, hard-won insights.
   (Startup / product audience — raw, honest, first-person narrative style.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINKEDIN-STYLE WRITING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- HOOK FIRST: Your opening line must STOP the scroll. Make a bold claim, ask a provocative question, or share a surprising stat.
- SHORT PARAGRAPHS: No wall of text. Max 3 lines per paragraph. Use white space liberally.
- STORYTELLING > JARGON: Lead with a human story or real scenario. Bring in technical depth AFTER establishing the human stakes.
- CONCRETE EXAMPLES: Use specific companies, products, or real numbers. No vague generalities.
- EMOTIONAL RESONANCE: Make the reader feel something — curiosity, urgency, inspiration, or a fresh perspective.
- END WITH IMPACT: Close with a forward-looking statement, a call to think differently, or a sharp question to drive comments.
- WORD COUNT: 600-800 words max. Dense but scannable.
- TONE: Confident thought leader. Not robotic. Not overly academic. Think: smart friend who happens to be an expert.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATTING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use '### ' for all major section headings (3-4 headings max).
- Use '- **[Key Point]**: text' for standout insights or bullet takeaways.
- Bold key terms with ** for scanability.
- DO NOT repeat the blog title inside the 'content' field.
- IMAGE PROMPT: You MUST provide an `imagePrompt` parameter in your publish call. Write a vivid, cinematic image generation prompt that visually represents the blog topic. Style: photorealistic, editorial, premium magazine cover aesthetic. Example: 'A futuristic command center with glowing blue AI nodes connected by light streams, dark dramatic lighting, cinematic depth of field, 8K resolution'.

CURRENT_TIME: {current_time}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEDUPLICATION RULES (CRITICAL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Before writing, ALWAYS call 'research_trends' first. It will return a list of ALREADY PUBLISHED topics.
- You MUST NOT publish on any topic that is semantically similar to an already-published post.
- If a topic overlaps more than 40% with an existing slug or title, CHOOSE A DIFFERENT TOPIC from a different pillar.
- Similarity check: If the same core keyword (e.g. 'vector policy', 'voice agent', 'latency') already appears in a published slug, the topic is TOO SIMILAR.

PUBLISHING FLOW:
1. Call 'research_trends' → receive trends + already-published topics list.
2. Choose a topic from a DIFFERENT pillar and DIFFERENT keywords than what is already published.
3. Write and publish via 'publish_autonomous_insight'.
4. Call 'mark_day_complete'.
5. Call 'terminate_session'.

You are not a generic blog writer. You are Astra — a strategic content intelligence system building thought leadership at scale.
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

        @llm.function_tool(description="Search for trending topics. Also returns already-published blog topics so you NEVER duplicate. Always call this first before writing.")
        async def research_trends(self):
            """Returns current high-intent topics AND already-published topics to prevent duplication."""
            logger.info("[ASTRA] Performing trend research + deduplication scan...")
            await self.ui_log(f"🚀 MILESTONE [{datetime.now().strftime('%H:%M:%S')}]: Research Phase Started", "milestone")
            await self.ui_log("Scanning global trends + auditing published content library for deduplication...")
            
            self.sentry.log_transaction("research_start", {"scope": "trends"})
            
            import urllib.request
            import xml.etree.ElementTree as ET
            
            trends_data = {"trends": [], "gaps": []}
            
            # --- DEDUPLICATION SCAN: Load all existing published blogs ---
            already_published = []
            blogs_dir = os.path.join(os.path.dirname(__file__), "blogs")
            if os.path.exists(blogs_dir):
                for fname in os.listdir(blogs_dir):
                    if fname.endswith(".json"):
                        try:
                            with open(os.path.join(blogs_dir, fname), "r", encoding="utf-8") as bf:
                                blog = json.load(bf)
                                already_published.append({
                                    "slug": blog.get("slug", ""),
                                    "title": blog.get("title", ""),
                                    "keywords": blog.get("metadata", {}).get("keywords", []),
                                    "pillar_tags": blog.get("metadata", {}).get("tags", [])
                                })
                        except Exception:
                            pass
            trends_data["already_published"] = already_published
            trends_data["dedup_instruction"] = (
                "CRITICAL: You MUST NOT publish on any topic semantically similar to the above. "
                "If slug keywords overlap with an existing post, PICK A DIFFERENT TOPIC. "
                "Also rotate your content pillar — do not pick the same category two posts in a row."
            )

            # --- CONTENT PILLAR GAPS: Detect underrepresented pillars ---
            published_tags_flat = [t.lower() for p in already_published for t in p.get("pillar_tags", [])]
            pillar_map = {
                "Business & Strategy": ["business", "roi", "strategy", "enterprise", "cost", "revenue"],
                "Industry Transformation": ["healthcare", "finance", "legal", "logistics", "education", "industry"],
                "Future of Work": ["work", "jobs", "productivity", "career", "human", "collaboration"],
                "Research Spotlight": ["research", "paper", "arxiv", "breakthrough", "study"],
                "Founder Lessons": ["founder", "startup", "lesson", "mistake", "build", "product"],
                "Architecture & Engineering": ["architecture", "agent", "llm", "vector", "swarm", "orchestration"]
            }
            covered = set()
            for pillar, keywords in pillar_map.items():
                if any(kw in published_tags_flat for kw in keywords):
                    covered.add(pillar)
            gaps = [p for p in pillar_map if p not in covered]
            if gaps:
                trends_data["gaps"] = [f"UNCOVERED PILLAR — write about this today: {g}" for g in gaps[:3]]
            else:
                trends_data["gaps"] = ["All pillars covered — pick the least-recently-published pillar."]

            # --- LIVE TREND FETCH: ArXiv cs.AI latest papers ---
            try:
                req = urllib.request.Request(
                    "http://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending",
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    xml_data = response.read()
                    root = ET.fromstring(xml_data)
                    ns = {'atom': 'http://www.w3.org/2005/Atom'}
                    for entry in root.findall('atom:entry', ns):
                        title = entry.find('atom:title', ns).text.replace('\n', ' ')
                        trends_data["trends"].append(f"[ArXiv Research] {title}")
            except Exception as e:
                logger.error(f"[ASTRA] Failed to fetch ArXiv: {e}")
                
            # --- LIVE TREND FETCH: HackerNews front page ---
            try:
                req = urllib.request.Request(
                    "https://hnrss.org/frontpage?points=100",
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    xml_data = response.read()
                    root = ET.fromstring(xml_data)
                    for item in root.findall('.//item')[:5]:
                        title = item.find('title').text
                        trends_data["trends"].append(f"[HN Trending] {title}")
            except Exception as e:
                logger.error(f"[ASTRA] Failed to fetch HN: {e}")

            # --- FALLBACK DIVERSE TREND SEEDS if no live data ---
            if not trends_data["trends"]:
                trends_data["trends"] = [
                    "[Business] How AI agents are cutting enterprise ops costs by 40%",
                    "[Industry] AI in healthcare diagnostics: the 2026 tipping point",
                    "[Future of Work] Why prompt engineers will be the most in-demand role by 2027",
                    "[Founder] The 3 mistakes I made building my first AI product",
                    "[Research] Mixture-of-Experts models: what the new papers actually mean"
                ]
            
            await self.ui_log(f"✅ MILESTONE [{datetime.now().strftime('%H:%M:%S')}]: Research + Dedup Scan Completed", "success")
            await self.ui_log(f"Found {len(already_published)} existing posts. {len(gaps)} content pillars uncovered → prioritize those.")
            return json.dumps(trends_data)

        @llm.function_tool(description="Publish a production-ready autonomous insight to the Swarm Blog. Generates a real AI image via Gemini Imagen automatically.")
        async def publish_autonomous_insight(self, 
                                            slug: str, 
                                            title: str, 
                                            subtitle: str, 
                                            category: str, 
                                            excerpt: str, 
                                            content: str,
                                            imagePrompt: str,
                                            tags: List[str],
                                            keywords: List[str],
                                            seoTitle: str,
                                            seoDesc: str):
            """
            Publishes a fully optimized blog post (Max 800 words) with a Gemini-generated featured image.

            Args:
                imagePrompt: A vivid, cinematic prompt for Gemini Imagen to generate the featured image.
                             Example: 'A futuristic AI command center with glowing blue neural networks,
                             dark dramatic lighting, cinematic depth of field, photorealistic, 8K'
            """
            await self.ui_log(f"✍️ MILESTONE: Drafting Strategic Insight - '{title}'", "milestone")
            
            # --- GUARDRAIL 1: Prevent double posting on the same day ---
            today_str = datetime.now().strftime("%Y-%m-%d")
            t = get_tracker()
            if t.get("last_published_date") == today_str:
                logger.warning(f"[ASTRA] Blocking attempt to post twice on {today_str}")
                await self.ui_log(f"⚠️ QUOTA ALERT [{datetime.now().strftime('%H:%M:%S')}]: Daily publication already reached for {today_str}.", "warning")
                return f"Mission Blocked: You have already published a strategic insight for today ({today_str}). To maintain high quality and avoid spam, you are restricted to one elite publication per 24 hours. Please use 'terminate_session' to call it a day."

            # --- GUARDRAIL 2: Semantic Deduplication Check ---
            blogs_dir = os.path.join(os.path.dirname(__file__), "blogs")
            slug_keywords = set(slug.lower().replace("-", " ").split())
            title_keywords = set(title.lower().split())
            # Remove common stop words from comparison
            stop_words = {"the", "a", "an", "and", "or", "for", "in", "of", "to", "with", "how", "why", "what", "is", "are", "on", "at", "by", "from"}
            slug_keywords -= stop_words
            title_keywords -= stop_words
            
            if os.path.exists(blogs_dir):
                for fname in os.listdir(blogs_dir):
                    if fname.endswith(".json"):
                        existing_slug_words = set(fname.replace(".json", "").lower().replace("-", " ").split()) - stop_words
                        try:
                            with open(os.path.join(blogs_dir, fname), "r", encoding="utf-8") as bf:
                                existing = json.load(bf)
                                existing_title_words = set(existing.get("title", "").lower().split()) - stop_words
                                existing_keywords = {k.lower() for k in existing.get("metadata", {}).get("keywords", [])}
                        except Exception:
                            existing_title_words = existing_slug_words
                            existing_keywords = set()
                        
                        # Check slug overlap
                        slug_overlap = len(slug_keywords & existing_slug_words) / max(len(slug_keywords), 1)
                        # Check title keyword overlap
                        title_overlap = len(title_keywords & existing_title_words) / max(len(title_keywords), 1)
                        # Check against existing metadata keywords
                        kw_overlap = len(title_keywords & existing_keywords) / max(len(title_keywords), 1)
                        
                        max_overlap = max(slug_overlap, title_overlap, kw_overlap)
                        if max_overlap >= 0.45:
                            logger.warning(f"[ASTRA] DEDUP BLOCK: '{slug}' is {max_overlap:.0%} similar to existing post '{fname}'")
                            await self.ui_log(f"🚫 DEDUP GUARD [{datetime.now().strftime('%H:%M:%S')}]: Topic rejected — {max_overlap:.0%} overlap with '{fname.replace('.json','')}'. Choose a different topic from a different content pillar.", "error")
                            return f"Deduplication Block: The topic '{title}' (slug: {slug}) is {max_overlap:.0%} semantically similar to the existing post '{fname.replace('.json','')}'. You MUST choose a completely different topic from a different content pillar. Do not retry this topic — pick something fresh."

            logger.info(f"[ASTRA] Autonomously publishing: {title}")
            await self.ui_log(f"✅ Dedup check passed. Launching image generation...")

            self.sentry.log_transaction("blog_publish_attempt", {"title": title, "slug": slug})

            # --- ANTIGRAVITY IMAGE ENGINE: Pollinations.ai (free, no API key required) ---
            featuredImage = f"/insights/{slug}.png"
            image_save_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "insights", f"{slug}.png")
            )
            image_generated = False

            try:
                import urllib.request
                import urllib.parse
                import random

                await self.ui_log(f"🎨 IMAGE ENGINE: Generating featured image via Pollinations.ai...", "milestone")

                enhanced_prompt = (
                    f"{imagePrompt}. "
                    "Style: premium editorial photography, high-contrast cinematic lighting, "
                    "professional tech publication cover, 16:9 widescreen, no text, no watermarks, no people."
                )

                encoded_prompt = urllib.parse.quote(enhanced_prompt)
                seed = random.randint(1, 999999)
                image_url = (
                    f"https://image.pollinations.ai/prompt/{encoded_prompt}"
                    f"?width=1280&height=720&nologo=true&seed={seed}&model=flux"
                )

                req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=90) as resp:
                    img_bytes = resp.read()

                if img_bytes and len(img_bytes) > 10000:
                    os.makedirs(os.path.dirname(image_save_path), exist_ok=True)
                    with open(image_save_path, "wb") as img_file:
                        img_file.write(img_bytes)
                    image_generated = True
                    size_kb = len(img_bytes) // 1024
                    logger.info(f"[ASTRA] Image saved → {image_save_path} ({size_kb}KB)")
                    await self.ui_log(f"✅ IMAGE ENGINE: Featured image generated ({size_kb}KB) → /insights/{slug}.png", "success")
                else:
                    await self.ui_log("⚠️ IMAGE ENGINE: Response too small, skipping image.", "warning")

            except Exception as img_err:
                logger.error(f"[ASTRA] Image generation failed: {img_err}")
                await self.ui_log(f"⚠️ IMAGE ENGINE failed: {img_err}. Blog will publish without featured image.", "warning")

            if not image_generated:
                featuredImage = ""

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
                    "imageAlt": f"{title} — Cortex Swarm Insight",
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
                        if telegram_gateway.is_configured():
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

    guard = CostGuard(
        agent_name="ASTRA",
        session_cost_ceiling=0.25,
        max_context_turns=15,
        usage_broadcast_interval_s=10.0,
        min_stt_words=3,
    )

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        try:
            log_error(f"on_usage event received: {usage_data}")
            should_broadcast = guard.update_usage(usage_data, session_usage)

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
            if should_broadcast:
                t = get_tracker()
                t["cumulative_usage"]["input_tokens"] = pre_session_usage["input_tokens"] + session_usage["input_tokens"]
                t["cumulative_usage"]["output_tokens"] = pre_session_usage["output_tokens"] + session_usage["output_tokens"]
                t["cumulative_usage"]["total_cost"] = pre_session_usage["total_cost"] + costs["total_cost_usd"]
                t["cumulative_usage"]["stt_cost"] = round(costs["stt_cost_usd"], 6)
                t["cumulative_usage"]["tts_cost"] = round(costs["tts_cost_usd"], 6)
                save_tracker(t)
        except Exception as e:
            log_error(f"Error in on_usage: {e}")

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            if not guard.allow_transcript(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)

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
