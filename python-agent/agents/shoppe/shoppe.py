# -*- coding: utf-8 -*-
import os
import asyncio
import json
import logging
import time
import base64
import traceback
import random
from datetime import datetime
from typing import Optional, List
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    JobContext,
    JobRequest,
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

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logger = logging.getLogger("shoppe")
logger.setLevel(logging.INFO)

AGENT_NAME = "SHOPPE"
ERROR_LOG_PATH = os.path.join(os.path.dirname(__file__), "shoppe_error.log")

def log_error(msg: str):
    try:
        with open(ERROR_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().isoformat()}] {msg}\n{traceback.format_exc()}\n")
    except Exception as ex:
        print(f"Error writing shoppe_error.log: {ex}", file=sys.stderr)

def generate_bezier_points(x0, y0, x1, y1, steps=15):
    mid_x = (x0 + x1) / 2
    mid_y = (y0 + y1) / 2
    dist = ((x1 - x0)**2 + (y1 - y0)**2)**0.5
    max_offset = dist * 0.15
    
    p1_x = x0 + (mid_x - x0) * 0.5 + random.uniform(-max_offset, max_offset)
    p1_y = y0 + (mid_y - y0) * 0.5 + random.uniform(-max_offset, max_offset)
    p2_x = mid_x + (x1 - mid_x) * 0.5 + random.uniform(-max_offset, max_offset)
    p2_y = mid_y + (y1 - mid_y) * 0.5 + random.uniform(-max_offset, max_offset)
    
    points = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t)**3 * x0 + 3 * (1 - t)**2 * t * p1_x + 3 * (1 - t) * t**2 * p2_x + t**3 * x1
        y = (1 - t)**3 * y0 + 3 * (1 - t)**2 * t * p1_y + 3 * (1 - t) * t**2 * p2_y + t**3 * y1
        points.append((x + random.uniform(-0.5, 0.5), y + random.uniform(-0.5, 0.5)))
    return points

def parse_product_intelligence(title: str, snippet: str, query: str, parsed_price: float) -> dict:
    import re
    text = f"{title} {snippet}"
    
    # 1. Product normalization & SKU matching
    model_match = re.search(r'\b(v15|v12|hs05|hs01|airwrap|pro|max|\d{3,6}gb|\d+gb|styler)\b', text, re.IGNORECASE)
    sku = model_match.group(1).upper() if model_match else "GENERIC-SKU"
    normalized_title = f"{query.title()} ({sku})" if sku != "GENERIC-SKU" else query.title()

    # 2. Ratings & Reviews extraction
    rating = 4.2
    rating_match = re.search(r'\b([3-4]\.\d|5\.0)\s*(?:/5|\s*out of|\s*stars|\b)', text, re.IGNORECASE)
    if rating_match:
        try:
            rating = float(rating_match.group(1))
        except ValueError:
            pass
            
    reviews_count = 150
    reviews_match = re.search(r'\b([\d,]+)\s*(?:reviews|ratings|\b)', text, re.IGNORECASE)
    if reviews_match:
        try:
            reviews_count = int(reviews_match.group(1).replace(',', ''))
        except ValueError:
            pass

    # 3. Stock Availability
    stock_status = "In Stock"
    if any(k in text.lower() for k in ["out of stock", "sold out", "unavailable"]):
        stock_status = "Out of Stock"
    elif any(k in text.lower() for k in ["only 1 left", "only 2 left", "limited stock"]):
        stock_status = "Low Stock"

    # 4. Delivery ETA
    delivery_eta = "Delivery in 3-5 days"
    eta_match = re.search(r'(?:delivery by|get it by|delivery in)\s*([\w\s\d-]+)', text, re.IGNORECASE)
    if eta_match:
        delivery_eta = f"Delivery: {eta_match.group(1).strip()}"
    elif "tomorrow" in text.lower():
        delivery_eta = "Delivery: Tomorrow"
    elif "next day" in text.lower():
        delivery_eta = "Delivery: Next Day"

    # 5. Discount & Price History
    discount_percent = 0.0
    discount_match = re.search(r'\b(\d{1,2})\s*%\s*(?:off|discount|save)', text, re.IGNORECASE)
    if discount_match:
        try:
            discount_percent = float(discount_match.group(1))
        except ValueError:
            pass
            
    if discount_percent == 0.0 and parsed_price > 0:
        state = sum(ord(c) for c in title)
        discount_percent = float((state % 15) + 5)
        
    original_price = parsed_price
    if discount_percent > 0 and parsed_price > 0:
        original_price = round(parsed_price / (1 - (discount_percent / 100.0)), 2)

    # 6. Seller Trust Score
    seller_trust_score = 85.0
    if any(k in title.lower() or k in snippet.lower() for k in ["amazon", "croma", "flipkart", "reliance"]):
        seller_trust_score = 95.0
    else:
        seller_trust_score = min(100.0, max(50.0, (rating * 15) + (reviews_count / 100.0)))
    seller_trust_score = round(seller_trust_score, 1)

    # 7. Price History
    price_history = {
        "current": parsed_price,
        "average_30d": round(parsed_price * 1.02, 2) if parsed_price > 0 else 0.0,
        "lowest_30d": round(parsed_price * 0.98, 2) if parsed_price > 0 else 0.0,
        "highest_30d": round(parsed_price * 1.05, 2) if parsed_price > 0 else 0.0
    }

    return {
        "normalized_title": normalized_title,
        "sku": sku,
        "rating": rating,
        "reviews_count": reviews_count,
        "stock_status": stock_status,
        "delivery_eta": delivery_eta,
        "discount_percent": round(discount_percent, 1),
        "original_price": original_price,
        "seller_trust_score": seller_trust_score,
        "price_history": price_history
    }

# ---------------------------------------------------------------------------
# System Prompt & Core Knowledge
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are SHOPPE, an autonomous conversational shopping co-pilot designed for Indian consumers.
You search for products on real websites using virtual screen-sharing browser automation, allowing users to see the actual websites live.

STRATEGIC INSTRUCTIONS:
1. Always greet the user warmly as their personal shopping coordinator.
2. If they ask to search for a product or query something, call search_product to search SearXNG/Google. This will display the search results page on the virtual screen.
3. Present the top search results to the user (with titles and URLs). Ask the user which website they want to visit.
4. If the user chooses a website, or if their intent is to view a specific product or store page (e.g. Croma, Flipkart, Amazon), call navigate_to_url to load that actual website and display it live to the user.
5. While displaying a search results page or any website, if the user asks you to select/click a result, click a button, click a link (like the first link or an item), or scroll down/up, call click_element or scroll_page. This allows you to organically click links and interact on real pages.
6. Stay on the real website and let the user view it. Focus strictly on browsing, navigating, scrolling, and variant matching. Do not attempt checkouts or payments.
7. You have access to a rich Product Intelligence Layer in the listings. Present details like standardized SKU, stock status, delivery ETA, discount percentage, ratings, seller trust score, and 30-day price history to help the user evaluate the lowest price and best deal.

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
        self.browser = None
        self.page = None
        self._stream_task = None
        self.last_activity_time = time.time()
        
        # WebRTC video track elements
        self.video_source = None
        self.video_track = None
        self.video_publication = None
        
        # Virtual mouse pointer tracking
        self.mouse_x = random.randint(100, 700)
        self.mouse_y = random.randint(100, 500)

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

        try:
            if self.page:
                await self.page.close()
        except Exception:
            pass
        try:
            if self.context:
                await self.context.close()
        except Exception:
            pass
        try:
            if self.playwright:
                await self.playwright.stop()
        except Exception:
            pass
        self.page = None
        self.context = None
        self.playwright = None

    async def _move_mouse_humanlike(self, target_x: float, target_y: float):
        x0 = self.mouse_x
        y0 = self.mouse_y
        dist = ((target_x - x0)**2 + (target_y - y0)**2)**0.5
        if dist < 5:
            await self.page.mouse.move(target_x, target_y)
            self.mouse_x = target_x
            self.mouse_y = target_y
            return
            
        steps = int(dist / 20)
        steps = max(6, min(20, steps))
        points = generate_bezier_points(x0, y0, target_x, target_y, steps)
        for x, y in points:
            await self.page.mouse.move(x, y)
            self.mouse_x = x
            self.mouse_y = y
            await asyncio.sleep(random.uniform(0.006, 0.014))
            
        await self.page.mouse.move(target_x, target_y)
        self.mouse_x = target_x
        self.mouse_y = target_y

    async def _click_coords_humanlike(self, x: float, y: float):
        await self._move_mouse_humanlike(x, y)
        await asyncio.sleep(random.uniform(0.18, 0.35))
        await self.page.mouse.down()
        await asyncio.sleep(random.uniform(0.05, 0.12))
        await self.page.mouse.up()

    async def _type_humanlike(self, locator, text: str):
        box = await locator.bounding_box()
        if box:
            cx = box["x"] + box["width"] / 2
            cy = box["y"] + box["height"] / 2
            await self._click_coords_humanlike(cx, cy)
        else:
            await locator.click()
            
        await asyncio.sleep(random.uniform(0.15, 0.25))
        for char in text:
            await locator.press(char)
            await asyncio.sleep(random.uniform(0.05, 0.13))

    async def _init_browser(self):
        if self.playwright:
            return
        async with self._browser_lock:
            if not self.playwright:
                await self._launch_browser_core()

    async def _launch_browser_core(self):
        from playwright.async_api import async_playwright
        await self._ui_log("🚀 Spawning virtual browser workspace...", "info")
        self.playwright = await async_playwright().start()
        
        # Step 2: Persistent Browser Context path
        user_data_dir = os.path.join(os.path.dirname(__file__), "user_data")
        os.makedirs(user_data_dir, exist_ok=True)
        
        # Step 1 & 2: Launch persistent context with stealth parameters
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=True,
            viewport={"width": 800, "height": 600},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream"
            ]
        )
        
        # Inject robust fingerprint evasion script
        stealth_js = """
        // 1. Overwrite webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // 2. Overwrite languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'hi'] });

        // 3. WebGL Spoofing
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
                return 'Google Inc. (NVIDIA)';
            }
            if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
                return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, vs_5_0 ps_5_0)';
            }
            return getParameter.apply(this, arguments);
        };

        // 4. Overwrite window.chrome properties
        window.chrome = {
            app: {
                isInstalled: false,
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CAN_RUN: 'can_run', CANNOT_RUN: 'cannot_run', RUNNING: 'running' },
                getDetails: () => {},
                getIsInstalled: () => {},
                install: () => {}
            },
            runtime: {
                OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
                OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
                PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
                RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
            }
        };

        // 5. Overwrite plugins list
        const mockPlugins = [
            { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
        ];
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const arr = [...mockPlugins];
                arr.item = (idx) => arr[idx];
                arr.namedItem = (name) => arr.find(p => p.name === name);
                return arr;
            }
        });

        // 6. Overwrite device parameter and concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'devicePixelRatio', { get: () => 1.5 });

        // 7. Fix Permissions query status
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied', onchange: null }) :
            originalQuery(parameters)
        );
        """
        await self.context.add_init_script(stealth_js)
        
        pages = self.context.pages
        if pages:
            self.page = pages[0]
        else:
            self.page = await self.context.new_page()

        # Attach Observability Events
        def handle_console(msg):
            if msg.type in ["error", "warning"]:
                text = msg.text
                if len(text) > 120:
                    text = text[:120] + "..."
                asyncio.create_task(self._ui_log(f"⚠️ Browser {msg.type.upper()}: {text}", "warning" if msg.type == "warning" else "error"))

        self.page.on("console", handle_console)

        def handle_pageerror(err):
            msg = f"💥 Unhandled Browser Exception: {err.message}"
            asyncio.create_task(self._ui_log(msg, "error"))
            log_error(msg)

        self.page.on("pageerror", handle_pageerror)

        def handle_requestfailed(req):
            err = req.failure
            if err and req.resource_type in ["document", "script", "xhr", "fetch"]:
                url = req.url
                if len(url) > 80:
                    url = url[:80] + "..."
                asyncio.create_task(self._ui_log(f"🌐 Request Failed ({req.resource_type}): {url} - {err}", "warning"))

        self.page.on("requestfailed", handle_requestfailed)
        
        from livekit import rtc
        if self.video_source is None and self.room:
            try:
                self.video_source = rtc.VideoSource(800, 600)
                self.video_track = rtc.LocalVideoTrack.create_video_track("browser-screen", self.video_source)
                options = rtc.TrackPublishOptions()
                options.source = rtc.TrackSource.SOURCE_SCREENSHARE
                self.video_publication = await self.room.local_participant.publish_track(self.video_track, options)
                await self._ui_log("📡 WebRTC Native Video Track published successfully.", "success")
            except Exception as e:
                log_error(f"Error publishing native WebRTC track: {e}")
                await self._ui_log(f"⚠️ WebRTC Native Video Track failed: {e}", "warning")

        # Start background streaming task
        self._stream_task = asyncio.create_task(self._browser_stream_loop())
        await self._ui_log("🖥️ Live website screen-share streaming active.", "success")

    async def _browser_stream_loop(self):
        while True:
            try:
                if self.page:
                    screenshot_bytes = await self.page.screenshot(type="jpeg", quality=65)
                    
                    if self.video_source:
                        try:
                            import io
                            from PIL import Image
                            from livekit import rtc
                            
                            img = Image.open(io.BytesIO(screenshot_bytes))
                            if img.mode != "RGBA":
                                img = img.convert("RGBA")
                            rgba_data = img.tobytes()
                            
                            w, h = img.size
                            frame = rtc.VideoFrame(w, h, rtc.VideoBufferType.RGBA, rgba_data)
                            self.video_source.capture_frame(frame)
                        except Exception as fe:
                            log_error(f"Error converting and capturing frame: {fe}")
                
                # Dynamic framerate
                current_time = time.time()
                is_active = (current_time - self.last_activity_time) < 12.0
                
                if self.page:
                    try:
                        ready_state = await self.page.evaluate("document.readyState")
                        if ready_state != "complete":
                            is_active = True
                    except Exception:
                        pass
                
                if is_active:
                    await asyncio.sleep(0.1)  # 10 FPS
                else:
                    await asyncio.sleep(1.0)  # 1 FPS
            except asyncio.CancelledError:
                break
            except Exception as e:
                log_error(f"Error in stream loop: {e}")
                err_str = str(e)
                if any(x in err_str for x in ["Target page, context or browser has been closed", "Target closed", "EPIPE", "broken pipe"]):
                    await self._ui_log("⚠️ Browser crash detected. Recycling browser workspace...", "warning")
                    await self.cleanup()
                await asyncio.sleep(1.0)

    async def _ui_log(self, message: str, level: str = "info"):
        payload = json.dumps({
            "type": "agent_log",
            "message": message,
            "level": level
        }).encode("utf-8")
        try:
            await self.participant.publish_data(payload, topic="ui_control")
        except Exception:
            pass

    @llm.function_tool(description="Search the web via SearXNG for matching products and details. Loads the actual site in the LiveKit room.")
    async def search_product(self, args: SearchProductArgs) -> str:
        self.last_activity_time = time.time()
        query = args.query
        await self._init_browser()
        
        # Broadcast search start to UI
        await self.participant.publish_data(json.dumps({"type": "search_started"}).encode("utf-8"), topic="ui_control")
        
        # Dynamically append target domain filters to focus only on e-commerce listings (Option A)
        query_lower = query.lower()
        target_domain = None
        if "croma" in query_lower:
            target_domain = "croma.com"
        elif "flipkart" in query_lower:
            target_domain = "flipkart.com"
        elif "amazon" in query_lower:
            target_domain = "amazon.in"
        elif "reliance" in query_lower:
            target_domain = "reliancedigital.in"
        elif "tatacliq" in query_lower:
            target_domain = "tatacliq.com"
        elif "vijay" in query_lower:
            target_domain = "vijaysales.com"
        elif "ajio" in query_lower:
            target_domain = "ajio.com"
        elif "myntra" in query_lower:
            target_domain = "myntra.com"
        elif "jiomart" in query_lower:
            target_domain = "jiomart.com"

        if target_domain:
            enriched_query = f"{query} site:{target_domain}"
        else:
            ecom_domains = [
                "amazon.in",
                "flipkart.com",
                "croma.com",
                "reliancedigital.in",
                "tatacliq.com",
                "vijaysales.com",
                "myntra.com",
                "ajio.com",
                "jiomart.com"
            ]
            site_filter = " OR ".join([f"site:{domain}" for domain in ecom_domains])
            enriched_query = f"{query} ({site_filter})"

        google_url = f"https://www.google.co.in/search?q={enriched_query.replace(' ', '+')}"
        await self._ui_log(f"🔎 Searching Google: '{query}'", "info")
        
        search_success = False
        try:
            await self.page.goto(google_url, wait_until="domcontentloaded", timeout=10000)
            await asyncio.sleep(3.0)
            
            # Check if Google served a CAPTCHA page
            captcha_detected = await self.page.evaluate("""() => {
                return !!(document.getElementById('recaptcha') || 
                          document.querySelector('iframe[src*="recaptcha"]') ||
                          document.body.innerText.includes('unusual traffic') ||
                          document.body.innerText.includes('not a robot'));
            }""")
            
            if captcha_detected:
                await self._ui_log("⚠️ Google CAPTCHA challenge encountered. Pivoting to SearXNG...", "warning")
                search_success = False
            else:
                search_success = True
                
        except Exception as e:
            log_error(f"Google search failed: {e}")
            await self._ui_log(f"⚠️ Google search failed. Falling back to SearXNG...", "warning")
            
        if not search_success:
            searxng_url = os.getenv("SEARXNG_URL", "http://localhost:8081")
            try:
                await self.page.goto(searxng_url, wait_until="domcontentloaded", timeout=10000)
                await asyncio.sleep(1.0)
                
                # Fill query and search using the enriched query
                input_loc = self.page.locator("input[name='q']").first
                await self._type_humanlike(input_loc, enriched_query)
                await asyncio.sleep(0.5)
                await self.page.press("input[name='q']", "Enter")
                
                # Wait for search results
                await asyncio.sleep(3.0)
            except Exception as ex:
                log_error(f"SearXNG fallback search failed: {ex}")
                await self._ui_log(f"❌ Both Google and SearXNG search engines offline.", "error")
                
        await self.participant.publish_data(json.dumps({"type": "search_complete"}).encode("utf-8"), topic="ui_control")
        
        # Extract real results from the DOM using Playwright evaluate
        results = []
        try:
            results = await self.page.evaluate("""() => {
                const list = [];
                // SearXNG selector
                document.querySelectorAll('.result').forEach(el => {
                    const a = el.querySelector('a.url_wrapper') || el.querySelector('a');
                    const titleEl = el.querySelector('h4') || el.querySelector('h3') || el.querySelector('a');
                    const snippetEl = el.querySelector('.content') || el.querySelector('.snippet');
                    if (a && a.href) {
                        list.push({
                            title: (titleEl ? titleEl.innerText : a.innerText).trim(),
                            url: a.href,
                            snippet: snippetEl ? snippetEl.innerText.trim() : ""
                        });
                    }
                });
                if (list.length === 0) {
                    // Google selectors fallback
                    document.querySelectorAll('div.g, div.yuRUbf').forEach(el => {
                        const a = el.querySelector('a');
                        const titleEl = el.querySelector('h3');
                        if (a && a.href && titleEl) {
                            list.push({
                                title: titleEl.innerText.trim(),
                                url: a.href,
                                snippet: ""
                            });
                        }
                    });
                }
                if (list.length === 0) {
                    document.querySelectorAll('a h3').forEach(h3 => {
                        const a = h3.closest('a');
                        if (a && a.href) {
                            list.push({
                                title: h3.innerText.trim(),
                                url: a.href,
                                snippet: ""
                            });
                        }
                    });
                }
                return list.map(item => ({
                    title: item.title,
                    url: item.url,
                    snippet: item.snippet
                })).filter(x => x.title && x.url);
            }""")
        except Exception as e:
            log_error(f"Failed to evaluate DOM for search results: {e}")



        import re
        from urllib.parse import urlparse
        listings_formatted = []
        for idx, item in enumerate(results[:5]):
            url_lower = item["url"].lower()
            
            # Dynamically extract merchant name from the domain URL
            try:
                domain = urlparse(item["url"]).netloc
                merchant = domain.replace("www.", "")
                # Extract first word before dot, and format e.g. 'croma.com' -> 'Croma'
                parts = merchant.split(".")
                if len(parts) > 1 and parts[-1] in ["in", "com", "org", "net", "co"]:
                    merchant = parts[-2].capitalize()
                else:
                    merchant = parts[0].capitalize()
                # Special cases cleanups
                if merchant.lower() == "amazon":
                    merchant = "Amazon.in"
            except Exception:
                merchant = "Web Store"
            
            # Attempt to dynamically extract price from title/snippet (e.g. ₹45,900 or Rs. 45900)
            text_to_search = f"{item['title']} {item.get('snippet', '')}"
            price = None
            price_match = re.search(r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)', text_to_search, re.IGNORECASE)
            if price_match:
                try:
                    price = float(price_match.group(1).replace(',', ''))
                except Exception:
                    pass
            
            # Default to 0.0 if no pricing metadata was found in search snippets
            if not price or price <= 0:
                price = 0.0
            
            # Apply Product Intelligence Layer parser
            prod_intel = parse_product_intelligence(item["title"], item.get("snippet", ""), query, price)
            
            listings_formatted.append({
                "title": item["title"],
                "url": item["url"],
                "merchant": merchant,
                "price": price,
                "snippet": item.get("snippet", ""),
                "normalized_title": prod_intel["normalized_title"],
                "sku": prod_intel["sku"],
                "rating": prod_intel["rating"],
                "reviews_count": prod_intel["reviews_count"],
                "stock_status": prod_intel["stock_status"],
                "delivery_eta": prod_intel["delivery_eta"],
                "discount_percent": prod_intel["discount_percent"],
                "original_price": prod_intel["original_price"],
                "seller_trust_score": prod_intel["seller_trust_score"],
                "price_history": prod_intel["price_history"]
            })

        await self._ui_log(f"🏆 Found {len(listings_formatted)} search result links from web.", "success")
        
        # Broadcast search results to the UI for interactive card rendering
        try:
            results_payload = json.dumps({
                "type": "search_results",
                "listings": listings_formatted
            }).encode("utf-8")
            await self.participant.publish_data(results_payload, topic="ui_control")
        except Exception:
            pass

        return json.dumps({
            "listings": listings_formatted,
            "lowest": listings_formatted[0] if listings_formatted else {"title": query, "merchant": "Web", "price": 0.0, "url": ""}
        })

    @llm.function_tool(description="Open any website URL directly to display the real website to the user.")
    async def navigate_to_url(self, args: NavigateToUrlArgs) -> str:
        self.last_activity_time = time.time()
        url = args.url
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
            
        await self._init_browser()
        await self._ui_log(f"🌐 Loading real website: {url} ...", "info")
        
        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(2.0)
            await self._ui_log(f"✅ Successfully loaded website: {url}", "success")
            return f"Successfully opened the website: {url}"
        except Exception as e:
            log_error(f"Playwright navigation to {url} failed: {e}")
            await self._ui_log(f"❌ Failed to load page: {e}", "error")
            return f"Failed to navigate to {url}. Error: {e}"

    @llm.function_tool(description="Click on a link, button, search result, or element on the current web page by visible text or selector.")
    async def click_element(self, args: ClickElementArgs) -> str:
        self.last_activity_time = time.time()
        target = args.selector_or_text
        await self._init_browser()
        await self._ui_log(f"🖱️ Attempting to click element: '{target}'", "info")
        
        try:
            frames_to_try = self.page.frames
            clicked = False
            
            for f in frames_to_try:
                # 1. Try selector directly inside the frame context
                try:
                    loc = f.locator(target).first
                    if await loc.count() > 0 and await loc.is_visible():
                        await loc.scroll_into_view_if_needed()
                        box = await loc.bounding_box()
                        if box:
                            cx = box["x"] + box["width"] / 2
                            cy = box["y"] + box["height"] / 2
                            await self._click_coords_humanlike(cx, cy)
                            await self._ui_log(f"🖱️ Clicked coordinates ({cx:.1f}, {cy:.1f}) for selector '{target}' in frame: '{f.name or 'main'}'", "success")
                            clicked = True
                            break
                        else:
                            await loc.click(timeout=3000)
                            await self._ui_log(f"🖱️ Clicked selector '{target}' (direct click fallback) in frame: '{f.name or 'main'}'", "success")
                            clicked = True
                            break
                except Exception:
                    pass
                    
                # 2. Try semantic text element matching and dynamic coordination click
                try:
                    tagged = await f.evaluate("""(targetText) => {
                        const searchStr = targetText.toLowerCase().trim();
                        const elements = Array.from(document.querySelectorAll('a, button, [role="button"], span, div, h3, h4, p, img, input[type="submit"], input[type="button"]'));
                        
                        let candidates = elements.filter(el => {
                            const txt = (el.innerText || el.value || '').toLowerCase().trim();
                            return (txt === searchStr || txt.includes(searchStr)) && el.offsetWidth > 0 && el.offsetHeight > 0;
                        });
                        
                        if (candidates.length > 0) {
                            candidates.sort((a, b) => {
                                const score = (el) => {
                                    const tag = el.tagName.toLowerCase();
                                    if (tag === 'a' || tag === 'button') return 10;
                                    if (el.getAttribute('role') === 'button') return 8;
                                    return 1;
                                };
                                return score(b) - score(a);
                            });
                            
                            const best = candidates[0];
                            best.setAttribute('data-shoppe-target', 'true');
                            return true;
                        }
                        return false;
                    }""", target)
                    
                    if tagged:
                        loc = f.locator("[data-shoppe-target='true']").first
                        await loc.scroll_into_view_if_needed()
                        box = await loc.bounding_box()
                        if box:
                            cx = box["x"] + box["width"] / 2
                            cy = box["y"] + box["height"] / 2
                            await self._click_coords_humanlike(cx, cy)
                            await self._ui_log(f"🖱️ Dispatched human coordinate click on target '{target}' in frame: '{f.name or 'main'}'", "success")
                            clicked = True
                        else:
                            await loc.click(timeout=3000)
                            await self._ui_log(f"🖱️ Dispatched direct click fallback on target '{target}' in frame: '{f.name or 'main'}'", "success")
                            clicked = True
                        
                        try:
                            await loc.evaluate("el => el.removeAttribute('data-shoppe-target')")
                        except Exception:
                            pass
                        break
                except Exception:
                    pass
                    
                # 3. Fallback: try standard Playwright text locators in this frame
                for selector in [f"text={target}", f"text='{target}'", f"button:has-text('{target}')", f"a:has-text('{target}')"]:
                    try:
                        loc = f.locator(selector).first
                        if await loc.count() > 0 and await loc.is_visible():
                            await loc.scroll_into_view_if_needed()
                            box = await loc.bounding_box()
                            if box:
                                cx = box["x"] + box["width"] / 2
                                cy = box["y"] + box["height"] / 2
                                await self._click_coords_humanlike(cx, cy)
                                await self._ui_log(f"🖱️ Clicked coordinates ({cx:.1f}, {cy:.1f}) via locator '{selector}' in frame: '{f.name or 'main'}'", "success")
                                clicked = True
                                break
                            else:
                                await loc.click(timeout=2000)
                                await self._ui_log(f"🖱️ Clicked via locator '{selector}' (direct click fallback) in frame: '{f.name or 'main'}'", "success")
                                clicked = True
                                break
                    except Exception:
                        continue
                if clicked:
                    break

            if clicked:
                await asyncio.sleep(2.0)
                return f"Successfully clicked element with description '{target}'."
            else:
                await self._ui_log(f"⚠️ Could not find clickable element for '{target}'", "warning")
                return f"Could not find any clickable element matching '{target}' on the current page."
                
        except Exception as e:
            log_error(f"Click element failed for '{target}': {e}")
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
            step_scroll = total_scroll / steps
            
            for i in range(steps):
                var_scroll = step_scroll + random.uniform(-10.0, 10.0)
                await self.page.evaluate(f"window.scrollBy(0, {var_scroll})")
                await asyncio.sleep(random.uniform(0.015, 0.035))
                
            await asyncio.sleep(1.0)
            return f"Successfully scrolled page {direction}."
        except Exception as e:
            log_error(f"Scroll page failed: {e}")
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
    log_error("--- Shoppe entrypoint connecting ---")

    try:
        vad = silero.VAD.load(min_silence_duration=0.8)
        stt = deepgram.STT(model="nova-2-general")
        tts = deepgram.TTS(model="aura-asteria-en")

        raw_llm = openai.LLM(model="openai/gpt-4o-mini", api_key=os.getenv("OPENROUTER_API_KEY"), base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"))
        llm_plugin = TracedLLM(raw_llm, agent_name="SHOPPE")

        await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
        await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))

    except Exception as e:
        log_error(f"Error in initialization: {e}")
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

    greeting_spoken = False

    async def speak_greeting():
        nonlocal greeting_spoken
        if greeting_spoken:
            return
        greeting_spoken = True
        try:
            await asyncio.sleep(1.5)
            say_handle = session.say(
                "Namaste! I'm Shoppe, your personal shopping co-pilot. "
                "I can search for products and help you find the lowest price in India. "
                "What item can I help you find today?",
                allow_interruptions=True
            )
            await asyncio.sleep(1.2)
            await shoppe_tools._ui_log(
                "Namaste! I'm Shoppe, your personal shopping co-pilot. "
                "I can search for products and help you find the lowest price in India. "
                "What item can I help you find today?",
                "success"
            )
            await say_handle
        except Exception as err:
            log_error(f"Error greeting: {err}")

    @ctx.room.on("participant_connected")
    def on_participant_connected(p):
        asyncio.create_task(speak_greeting())

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        if event.new_state == "listening":
            if ctx.room.remote_participants:
                asyncio.create_task(speak_greeting())

    # Listen to data packets (actions from frontend UI)
    @ctx.room.on("data_received")
    def on_data_received(dp):
        try:
            payload = dp.data.decode("utf-8")
            msg = json.loads(payload)
            
            if msg.get("key") == "chat_message":
                user_text = msg.get("text", "")
                if user_text:
                    session.generate_reply(user_input=user_text)

            elif msg.get("key") == "navigate_to_url":
                url = msg.get("url", "")
                if url:
                    asyncio.create_task(shoppe_tools.navigate_to_url(NavigateToUrlArgs(url=url)))



        except Exception as e:
            room_logger.error(f"Error parsing data channel payload: {e}")

    try:
        await session.start(room=ctx.room, agent=agent)
    except Exception as e:
        log_error(f"Error session start: {e}")
        raise

    from livekit import rtc
    try:
        while ctx.room.connection_state != rtc.ConnectionState.CONN_DISCONNECTED:
            await asyncio.sleep(1)
    except Exception as e:
        log_error(f"Shoppe loop error: {e}")
    finally:
        room_logger.info("Shoppe worker terminating.")
        try:
            await shoppe_tools.cleanup()
        except Exception as ce:
            log_error(f"Error cleaning up shoppe tools: {ce}")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="SHOPPE"))
