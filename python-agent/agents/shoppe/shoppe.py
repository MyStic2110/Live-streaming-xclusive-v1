# -*- coding: utf-8 -*-
import os
import asyncio
import json
import logging
import time
import random
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    JobContext,
    WorkerOptions,
    cli,
    llm,
    AgentSession,
    AutoSubscribe,
    voice,
)
from livekit.plugins import silero, deepgram, openai
from pydantic import BaseModel, Field
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry
from utils.cost_guard import CostGuard, filter_code_blocks_and_long_text
from utils.traced_llm import TracedLLM
try:
    # When run as a script, this file's own directory is on sys.path.
    from price_compare import fetch_price_comparison, pick_lowest, summarize_comparison
except ImportError:
    from agents.shoppe.price_compare import fetch_price_comparison, pick_lowest, summarize_comparison

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logger = logging.getLogger("shoppe")
logger.setLevel(logging.INFO)

AGENT_NAME = "SHOPPE"

# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are SHOPPE, an autonomous conversational shopping co-pilot designed for Indian consumers.
You search for products on real websites using virtual screen-sharing browser automation, allowing users to see the actual websites live.

STRATEGIC INSTRUCTIONS:
1. Always greet the user warmly as their personal shopping coordinator.
2. If they ask to search for a product or query something, call search_product to search SearXNG/Google. This will display the search results page on the virtual screen.
3. Present the top search results to the user (with titles and URLs). If the search_product result includes a "comparison_summary" and a "lowest" merchant, state the GENUINE cheapest option and the price difference out loud (e.g. "Cheapest is ₹X at Flipkart, ₹Y less than Amazon"). Never claim a "lowest price" you were not actually given. Then ask the user which website they want to visit.
4. If the user chooses a website, or if their intent is to view a specific product or store page (e.g. Croma, Flipkart, Amazon), call navigate_to_url to load that actual website and display it live to the user.
5. While displaying a search results page or any website, if the user asks you to select/click a result, click a button, click a link (like the first link or an item), or scroll down/up, call click_element or scroll_page.
6. Stay on the real website and let the user view it. Focus strictly on browsing, navigating, scrolling, and variant matching. Do not attempt checkouts or payments.

CRITICAL INTERACTION RULES:
- You MUST pause, stop executing tools, and wait for the user's response/confirmation after presenting search results. Do NOT automatically navigate to a URL without the user explicitly telling you to do so.
- After every tool execution (like search_product, navigate_to_url, or click_element), you must pause, report the outcome briefly, and wait for the user to speak or respond.
- Never chain multiple tool calls in a single turn. Do one operation, update the screen, and wait.
"""

class SearchProductArgs(BaseModel):
    query: str = Field(description="The product name or search query.")

class NavigateToUrlArgs(BaseModel):
    url: str = Field(description="The destination website URL (e.g. Amazon, Flipkart, Croma, Ajio, Tata Cliq, Myntra, Reliance Digital, Vijay Sales, or any other e-commerce website).")

class ClickElementArgs(BaseModel):
    selector_or_text: str = Field(description="The visible text or CSS selector of the link, button, search result, or item to click on the current page.")

class ScrollPageArgs(BaseModel):
    direction: str = Field(description="The direction to scroll: 'down' or 'up'.")

# ---------------------------------------------------------------------------
# Shoppe tools
# ---------------------------------------------------------------------------
class ShoppeTools:
    def __init__(self, participant, session, room=None):
        self.participant = participant
        self.session = session
        self.room = room
        self.sentry = get_sentry(AGENT_NAME)

        # Playwright instances
        self.playwright = None
        self.context = None  # ponytail: declared here — fixes AttributeError in cleanup()
        self.page = None
        self._stream_task = None
        self.last_activity_time = time.time()

        # WebRTC video track elements
        self.video_source = None
        self.video_track = None
        self.video_publication = None

        # Mutex lock to serialize browser launching
        self._browser_lock = asyncio.Lock()

    async def cleanup(self):
        try:
            if self.video_publication and self.room:
                await self.room.local_participant.unpublish_track(self.video_publication.sid)
        except Exception:
            pass
        self.video_source = None
        self.video_track = None
        self.video_publication = None

        for obj, method in [(self.page, "close"), (self.context, "close"), (self.playwright, "stop")]:
            try:
                if obj:
                    await getattr(obj, method)()
            except Exception:
                pass
        self.page = None
        self.context = None
        self.playwright = None

        # ponytail: clean up ephemeral browser profile
        profile_dir = getattr(self, "_session_user_data_dir", None)
        if profile_dir:
            import shutil
            shutil.rmtree(profile_dir, ignore_errors=True)
            self._session_user_data_dir = None

    async def _init_browser(self):
        if self.playwright:
            return
        async with self._browser_lock:
            if not self.playwright:
                await self._launch_browser_core()

    async def _launch_browser_core(self):
        import tempfile, uuid
        from playwright.async_api import async_playwright
        from playwright_stealth import stealth_async  # ponytail: replaces 70-line manual JS fingerprint block

        await self._ui_log("🚀 Spawning virtual browser workspace...", "info")
        self.playwright = await async_playwright().start()

        # ponytail: per-session ephemeral dir — fixes multi-worker Chromium file-lock collision
        self._session_user_data_dir = tempfile.mkdtemp(prefix=f"shoppe_{uuid.uuid4().hex[:8]}_")

        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=self._session_user_data_dir,
            headless=True,
            viewport={"width": 800, "height": 600},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
            ]
        )

        pages = self.context.pages
        self.page = pages[0] if pages else await self.context.new_page()

        # ponytail: one call replaces the 70-line stealth JS block
        await stealth_async(self.page)

        # Observability events
        def handle_console(msg):
            if msg.type in ["error", "warning"]:
                text = msg.text[:120] + "..." if len(msg.text) > 120 else msg.text
                asyncio.create_task(self._ui_log(f"⚠️ Browser {msg.type.upper()}: {text}", "warning" if msg.type == "warning" else "error"))

        def handle_pageerror(err):
            logger.error("💥 Unhandled Browser Exception: %s", err.message)
            asyncio.create_task(self._ui_log(f"💥 Unhandled Browser Exception: {err.message}", "error"))

        def handle_requestfailed(req):
            if req.failure and req.resource_type in ["document", "script", "xhr", "fetch"]:
                url = req.url[:80] + "..." if len(req.url) > 80 else req.url
                asyncio.create_task(self._ui_log(f"🌐 Request Failed ({req.resource_type}): {url} - {req.failure}", "warning"))

        self.page.on("console", handle_console)
        self.page.on("pageerror", handle_pageerror)
        self.page.on("requestfailed", handle_requestfailed)

        if self.video_source is None and self.room:
            try:
                self.video_source = rtc.VideoSource(800, 600)
                self.video_track = rtc.LocalVideoTrack.create_video_track("browser-screen", self.video_source)
                options = rtc.TrackPublishOptions()
                options.source = rtc.TrackSource.SOURCE_SCREENSHARE
                self.video_publication = await self.room.local_participant.publish_track(self.video_track, options)
                await self._ui_log("📡 WebRTC Native Video Track published successfully.", "success")
            except Exception as e:
                logger.exception("Error publishing native WebRTC track")
                await self._ui_log(f"⚠️ WebRTC Native Video Track failed: {e}", "warning")

        self._stream_task = asyncio.create_task(self._browser_stream_loop())
        await self._ui_log("🖥️ Live website screen-share streaming active.", "success")

    async def _browser_stream_loop(self):
        while True:
            try:
                if self.page and self.video_source:
                    screenshot_bytes = await self.page.screenshot(type="jpeg", quality=50)
                    try:
                        import io
                        from PIL import Image
                        img = Image.open(io.BytesIO(screenshot_bytes))
                        if img.mode != "RGBA":
                            img = img.convert("RGBA")
                        w, h = img.size
                        frame = rtc.VideoFrame(w, h, rtc.VideoBufferType.RGBA, img.tobytes())
                        self.video_source.capture_frame(frame)
                    except Exception:
                        pass  # drop frame — don't crash the loop

                is_active = (time.time() - self.last_activity_time) < 12.0
                await asyncio.sleep(0.1 if is_active else 2.0)  # 10 FPS active → 0.5 FPS idle

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Error in stream loop")
                if any(x in str(e) for x in ["Target page, context or browser has been closed", "Target closed", "EPIPE", "broken pipe"]):
                    await self._ui_log("⚠️ Browser crash detected. Recycling browser workspace...", "warning")
                    await self.cleanup()
                await asyncio.sleep(1.0)

    async def _ui_log(self, message: str, level: str = "info"):
        payload = json.dumps({"type": "agent_log", "message": message, "level": level}).encode("utf-8")
        try:
            await self.participant.publish_data(payload, topic="ui_control")
        except Exception:
            pass

    async def _goto_and_stabilize(self, url: str, timeout: int = 12000):
        """ponytail: wait for real page stability instead of arbitrary asyncio.sleep."""
        await self.page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        try:
            await self.page.wait_for_load_state("networkidle", timeout=4000)
        except Exception:
            pass  # timeout is fine — page is usable already

    @llm.function_tool(description="Search the web via SearXNG for matching products and details. Loads the actual site in the LiveKit room.")
    async def search_product(self, args: SearchProductArgs) -> str:
        import re
        from urllib.parse import urlparse

        self.last_activity_time = time.time()
        query = args.query
        await self._init_browser()

        await self.participant.publish_data(json.dumps({"type": "search_started"}).encode("utf-8"), topic="ui_control")

        domain_map = {
            "croma": "croma.com", "flipkart": "flipkart.com", "amazon": "amazon.in",
            "reliance": "reliancedigital.in", "tatacliq": "tatacliq.com",
            "vijay": "vijaysales.com", "ajio": "ajio.com", "myntra": "myntra.com",
            "jiomart": "jiomart.com",
        }
        query_lower = query.lower()
        target_domain = next((d for k, d in domain_map.items() if k in query_lower), None)

        if target_domain:
            enriched_query = f"{query} site:{target_domain}"
        else:
            site_filter = " OR ".join(f"site:{d}" for d in domain_map.values())
            enriched_query = f"{query} ({site_filter})"

        google_url = f"https://www.google.co.in/search?q={enriched_query.replace(' ', '+')}"
        await self._ui_log(f"🔎 Searching Google: '{query}'", "info")

        search_success = False
        try:
            await self._goto_and_stabilize(google_url, timeout=10000)
            captcha_detected = await self.page.evaluate("""() => {
                return !!(document.getElementById('recaptcha') ||
                          document.querySelector('iframe[src*="recaptcha"]') ||
                          document.body.innerText.includes('unusual traffic') ||
                          document.body.innerText.includes('not a robot'));
            }""")
            search_success = not captcha_detected
            if not search_success:
                await self._ui_log("⚠️ Google CAPTCHA challenge encountered. Pivoting to SearXNG...", "warning")
        except Exception:
            logger.exception("Google search failed")
            await self._ui_log("⚠️ Google search failed. Falling back to SearXNG...", "warning")

        if not search_success:
            searxng_url = os.getenv("SEARXNG_URL", "http://localhost:8081")
            try:
                await self._goto_and_stabilize(searxng_url, timeout=10000)
                input_loc = self.page.locator("input[name='q']").first
                await input_loc.fill(enriched_query)  # ponytail: fill() over char-by-char loop
                await self.page.press("input[name='q']", "Enter")
                await self.page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                logger.exception("SearXNG fallback search failed")
                await self._ui_log("❌ Both Google and SearXNG search engines offline.", "error")

        await self.participant.publish_data(json.dumps({"type": "search_complete"}).encode("utf-8"), topic="ui_control")

        results = []
        try:
            results = await self.page.evaluate("""() => {
                const list = [];
                document.querySelectorAll('.result').forEach(el => {
                    const a = el.querySelector('a.url_wrapper') || el.querySelector('a');
                    const titleEl = el.querySelector('h4') || el.querySelector('h3') || el.querySelector('a');
                    const snippetEl = el.querySelector('.content') || el.querySelector('.snippet');
                    if (a && a.href) list.push({
                        title: (titleEl ? titleEl.innerText : a.innerText).trim(),
                        url: a.href,
                        snippet: snippetEl ? snippetEl.innerText.trim() : ""
                    });
                });
                if (!list.length) {
                    document.querySelectorAll('div.g, div.yuRUbf').forEach(el => {
                        const a = el.querySelector('a'), h3 = el.querySelector('h3');
                        if (a && h3) list.push({ title: h3.innerText.trim(), url: a.href, snippet: "" });
                    });
                }
                if (!list.length) {
                    document.querySelectorAll('a h3').forEach(h3 => {
                        const a = h3.closest('a');
                        if (a) list.push({ title: h3.innerText.trim(), url: a.href, snippet: "" });
                    });
                }
                return list.filter(x => x.title && x.url);
            }""")
        except Exception:
            logger.exception("Failed to evaluate DOM for search results")

        # ponytail: stripped fabricated parse_product_intelligence — return only real DOM data
        listings_formatted = []
        for item in results[:5]:
            try:
                parts = urlparse(item["url"]).netloc.replace("www.", "").split(".")
                merchant = parts[-2].capitalize() if len(parts) > 1 and parts[-1] in ["in", "com", "org", "net", "co"] else parts[0].capitalize()
                if merchant.lower() == "amazon":
                    merchant = "Amazon.in"
            except Exception:
                merchant = "Web Store"

            price = 0.0
            m = re.search(r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)', f"{item['title']} {item.get('snippet', '')}", re.IGNORECASE)
            if m:
                try:
                    price = float(m.group(1).replace(',', ''))
                except Exception:
                    pass

            listings_formatted.append({
                "title": item["title"],
                "url": item["url"],
                "merchant": merchant,
                "price": price,
                "snippet": item.get("snippet", ""),
            })

        await self._ui_log(f"🏆 Found {len(listings_formatted)} search result links from web.", "success")

        # --- Structured price comparison ---------------------------------------
        # Pull real per-merchant prices so we can report the GENUINE cheapest
        # option instead of guessing from the first search result. Falls back to
        # the scraped listings above when no SERPAPI_KEY / no structured data.
        comparison_summary = ""
        try:
            structured = await fetch_price_comparison(query)
        except Exception:
            logger.exception("Price comparison fetch failed")
            structured = []

        if structured:
            listings_formatted = [{
                "title": l.title, "url": l.url, "merchant": l.merchant,
                "price": l.price, "snippet": "", "rating": l.rating, "source": "api",
            } for l in structured]
            comparison_summary = summarize_comparison(structured)
            lowest = pick_lowest(structured)
            lowest_payload = (
                {"title": lowest.title, "url": lowest.url, "merchant": lowest.merchant, "price": lowest.price}
                if lowest else None
            )
            await self._ui_log(f"💰 {comparison_summary}", "success")
        else:
            # No structured data: compute the TRUE lowest from any scraped prices
            # (the old code wrongly used the first result as "lowest").
            priced = [x for x in listings_formatted if x.get("price") and x["price"] > 0]
            lowest_payload = min(priced, key=lambda x: x["price"]) if priced else None

        if lowest_payload is None:
            lowest_payload = listings_formatted[0] if listings_formatted else {"title": query, "merchant": "Web", "price": 0.0, "url": ""}

        try:
            await self.participant.publish_data(
                json.dumps({
                    "type": "search_results",
                    "listings": listings_formatted,
                    "comparison": comparison_summary,
                    "lowest": lowest_payload,
                }).encode("utf-8"),
                topic="ui_control"
            )
        except Exception:
            pass

        return json.dumps({
            "listings": listings_formatted,
            "lowest": lowest_payload,
            "comparison_summary": comparison_summary,
        })

    @llm.function_tool(description="Open any website URL directly to display the real website to the user.")
    async def navigate_to_url(self, args: NavigateToUrlArgs) -> str:
        self.last_activity_time = time.time()
        url = args.url
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        await self._init_browser()
        await self._ui_log(f"🌐 Loading real website: {url} ...", "info")

        try:
            await self._goto_and_stabilize(url, timeout=15000)  # ponytail: networkidle replaces sleep(2)
            await self._ui_log(f"✅ Successfully loaded website: {url}", "success")
            return f"Successfully opened the website: {url}"
        except Exception as e:
            logger.exception("Playwright navigation failed")
            await self._ui_log(f"❌ Failed to load page: {e}", "error")
            return f"Failed to navigate to {url}. Error: {e}"

    @llm.function_tool(description="Click on a link, button, search result, or element on the current web page by visible text or selector.")
    async def click_element(self, args: ClickElementArgs) -> str:
        self.last_activity_time = time.time()
        target = args.selector_or_text
        await self._init_browser()
        await self._ui_log(f"🖱️ Attempting to click element: '{target}'", "info")

        page = self.page  # ponytail: local ref guards against mid-operation browser crash
        if not page:
            return "Browser not ready."

        try:
            clicked = False
            for f in page.frames:
                # 1. Direct selector
                try:
                    loc = f.locator(target).first
                    if await loc.count() > 0 and await loc.is_visible():
                        await loc.scroll_into_view_if_needed()
                        await loc.click(timeout=3000)  # ponytail: locator.click() replaces 80-line bezier mouse
                        await self._ui_log(f"🖱️ Clicked selector '{target}' in frame: '{f.name or 'main'}'", "success")
                        clicked = True
                        break
                except Exception:
                    pass

                # 2. Semantic text match
                try:
                    tagged = await f.evaluate("""(t) => {
                        const s = t.toLowerCase().trim();
                        const els = Array.from(document.querySelectorAll('a, button, [role="button"], span, div, h3, h4, p, input[type="submit"], input[type="button"]'));
                        const hits = els.filter(el => {
                            const txt = (el.innerText || el.value || '').toLowerCase().trim();
                            return (txt === s || txt.includes(s)) && el.offsetWidth > 0 && el.offsetHeight > 0;
                        });
                        if (!hits.length) return false;
                        hits.sort((a, b) => {
                            const score = el => ['a','button'].includes(el.tagName.toLowerCase()) ? 10 : el.getAttribute('role') === 'button' ? 8 : 1;
                            return score(b) - score(a);
                        });
                        hits[0].setAttribute('data-shoppe-target', 'true');
                        return true;
                    }""", target)

                    if tagged:
                        loc = f.locator("[data-shoppe-target='true']").first
                        await loc.scroll_into_view_if_needed()
                        await loc.click(timeout=3000)
                        await self._ui_log(f"🖱️ Clicked target '{target}' in frame: '{f.name or 'main'}'", "success")
                        clicked = True
                        try:
                            await loc.evaluate("el => el.removeAttribute('data-shoppe-target')")
                        except Exception:
                            pass
                        break
                except Exception:
                    pass

                # 3. Playwright text locator fallbacks
                for sel in [f"text={target}", f"text='{target}'", f"button:has-text('{target}')", f"a:has-text('{target}')"]:
                    try:
                        loc = f.locator(sel).first
                        if await loc.count() > 0 and await loc.is_visible():
                            await loc.scroll_into_view_if_needed()
                            await loc.click(timeout=2000)
                            await self._ui_log(f"🖱️ Clicked via '{sel}' in frame: '{f.name or 'main'}'", "success")
                            clicked = True
                            break
                    except Exception:
                        continue
                if clicked:
                    break

            if clicked:
                await asyncio.sleep(2.0)
                return f"Successfully clicked element with description '{target}'."
            await self._ui_log(f"⚠️ Could not find clickable element for '{target}'", "warning")
            return f"Could not find any clickable element matching '{target}' on the current page."

        except Exception as e:
            logger.exception("Click element failed")
            return f"Failed to click element: {e}"

    @llm.function_tool(description="Scroll the current web page down or up to view more content.")
    async def scroll_page(self, args: ScrollPageArgs) -> str:
        self.last_activity_time = time.time()
        direction = args.direction.lower()
        await self._init_browser()
        await self._ui_log(f"📜 Scrolling page {direction} smoothly...", "info")

        try:
            total_scroll = 420 if direction == "down" else -420
            steps = random.randint(6, 10)
            for _ in range(steps):
                await self.page.evaluate(f"window.scrollBy(0, {total_scroll / steps + random.uniform(-10.0, 10.0)})")
                await asyncio.sleep(random.uniform(0.015, 0.035))
            await asyncio.sleep(1.0)
            return f"Successfully scrolled page {direction}."
        except Exception as e:
            logger.exception("Scroll page failed")
            return f"Failed to scroll page: {e}"


class RoomLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        return f"[Room: {self.extra.get('room', 'N/A')}] {msg}", kwargs

# ---------------------------------------------------------------------------
# Worker entrypoint
# ---------------------------------------------------------------------------
async def entrypoint(ctx: JobContext):
    room_logger = RoomLoggerAdapter(logger, {"room": ctx.room.name})
    room_logger.info("--- SHOPPE SHOPPING AGENT CONNECTING ---")

    try:
        vad = silero.VAD.load(min_silence_duration=0.8)
        stt = deepgram.STT(model="nova-2-general")
        tts = deepgram.TTS(model="aura-asteria-en")
        raw_llm = openai.LLM(
            model="openai/gpt-4o-mini",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        )
        llm_plugin = TracedLLM(raw_llm, agent_name="SHOPPE")
        await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
        await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))
    except Exception:
        logger.exception("Error in initialization")
        raise

    chat_ctx = llm.ChatContext()
    shoppe_tools = ShoppeTools(participant=ctx.room.local_participant, session=None, room=ctx.room)

    agent = voice.Agent(
        turn_handling={"interruption": {"mode": "vad"}},
        instructions=SYSTEM_PROMPT,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(shoppe_tools),
    )

    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        tts_text_transforms=[filter_code_blocks_and_long_text, voice.text_transforms.filter_markdown, voice.text_transforms.filter_emoji],
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 1.5}},
    )

    # ponytail: asyncio.Event prevents double-greeting race condition (replaces bare bool flag)
    _greeting_event = asyncio.Event()

    async def speak_greeting():
        if _greeting_event.is_set():
            return
        _greeting_event.set()
        try:
            await asyncio.sleep(1.5)
            say_handle = session.say(
                "Namaste! I'm Shoppe, your personal shopping co-pilot. "
                "I can search for products and help you find the lowest price in India. "
                "What item can I help you find today?",
                allow_interruptions=True,
            )
            await asyncio.sleep(1.2)
            await shoppe_tools._ui_log(
                "Namaste! I'm Shoppe, your personal shopping co-pilot. "
                "I can search for products and help you find the lowest price in India. "
                "What item can I help you find today?",
                "success",
            )
            await say_handle
        except Exception:
            logger.exception("Error greeting")

    @ctx.room.on("participant_connected")
    def on_participant_connected(p):
        asyncio.create_task(speak_greeting())

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        if event.new_state == "listening" and ctx.room.remote_participants:
            asyncio.create_task(speak_greeting())

    @ctx.room.on("data_received")
    def on_data_received(dp):
        try:
            msg = json.loads(dp.data.decode("utf-8"))
            if msg.get("key") == "chat_message" and msg.get("text"):
                session.generate_reply(user_input=msg["text"])
            elif msg.get("key") == "navigate_to_url" and msg.get("url"):
                asyncio.create_task(shoppe_tools.navigate_to_url(NavigateToUrlArgs(url=msg["url"])))
        except Exception as e:
            room_logger.error(f"Error parsing data channel payload: {e}")

    try:
        await session.start(room=ctx.room, agent=agent)
    except Exception:
        logger.exception("Error session start")
        raise

    try:
        while ctx.room.connection_state != rtc.ConnectionState.CONN_DISCONNECTED:
            await asyncio.sleep(1)
    except Exception:
        logger.exception("Shoppe loop error")
    finally:
        room_logger.info("Shoppe worker terminating.")
        try:
            await shoppe_tools.cleanup()
        except Exception:
            logger.exception("Error cleaning up shoppe tools")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="SHOPPE"))
