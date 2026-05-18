import asyncio
import os
import json
import logging
import base64
import re
from datetime import datetime
from playwright.async_api import async_playwright
from dotenv import load_dotenv
from deepgram import AsyncDeepgramClient
from deepgram.core.events import EventType

try:
    from agents.shadow_agent.summarizer import generate_audit
except ImportError:
    try:
        from summarizer import generate_audit
    except ImportError:
        def generate_audit(path):
            print(f"Skipping summary generation, import failed: {path}")

load_dotenv()

# Logger setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("shadow_bot")

async def join_meeting(url: str):
    # Initialize Deepgram v7 async client
    dg_client = AsyncDeepgramClient(api_key=os.getenv("DEEPGRAM_API_KEY"))
    
    transcript_file = f"transcript_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    # Transcription handler
    async def on_message(result):
        try:
            if hasattr(result, "channel") and result.channel.alternatives:
                sentence = result.channel.alternatives[0].transcript
                if len(sentence) > 0:
                    logger.info(f"--- [TRANSCRIPT] {sentence} ---")
                    with open(transcript_file, "a") as f:
                        f.write(f"{datetime.now().strftime('%H:%M:%S')}: {sentence}\n")
        except Exception as e:
            logger.error(f"Error parsing transcript: {e}")

    # Use the v1 listen connect
    async with dg_client.listen.v1.connect(
        model="nova-2",
        language="en-US",
        smart_format=True,
        diarize=True,
    ) as dg_socket:
        
        asyncio.create_task(dg_socket.start_listening())
        dg_socket.on(EventType.MESSAGE, on_message)

        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--use-fake-ui-for-media-stream",
                    "--use-fake-device-for-media-stream",
                    "--allow-file-access-from-files",
                    "--disable-gesture-requirement-for-media-playback"
                ]
            )
            
            context = await browser.new_context(
                permissions=["microphone", "camera"],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            )
            
            page = await context.new_page()
            
            # Pipe browser console to terminal
            page.on("console", lambda msg: logger.debug(f"[BROWSER] {msg.text}"))
            
            # --- ZOOM URL BYPASS TRANSFORMATION ---
            if "zoom.us" in url:
                # Bypass prompt for native zoom client by forcing direct web join
                url = re.sub(r'/j/(\d+)', r'/wc/join/\1', url)
                logger.info(f"[SHADOW] Transformed Zoom URL to Web Client: {url}")

            logger.info(f"--- [SHADOW] Navigating to: {url} ---")
            await page.goto(url)
            
            # --- GOOGLE MEET FLOW ---
            if "meet.google.com" in url:
                logger.info("[SHADOW] Detected Google Meet. Handling initial join flow...")
                try:
                    await page.wait_for_selector("text='Got it'", timeout=5000)
                    await page.click("text='Got it'")
                except: pass
                
                try:
                    join_button = await page.wait_for_selector("span:has-text('Join now'), span:has-text('Ask to join')", timeout=15000)
                    await join_button.click()
                    logger.info("[SHADOW] Clicked Join button.")
                except Exception as e:
                    logger.error(f"[SHADOW] Failed to find Join button: {e}")

            # --- ZOOM WEB JOIN FLOW ---
            elif "zoom.us" in url:
                logger.info("[SHADOW] Detected Zoom Meeting. Handling Web Client join flow...")
                try:
                    name_input = await page.wait_for_selector("input#input-to-join, input[name='name']", timeout=20000)
                    await name_input.fill("Shadow Swarm Observer")
                    logger.info("[SHADOW] Entered name in Zoom Form.")
                    
                    join_btn = await page.wait_for_selector("button.btn-join, button:has-text('Join')", timeout=10000)
                    await join_btn.click()
                except Exception as e:
                    logger.error(f"[SHADOW] Zoom initial step failed: {e}")
                    
                # Handle password input if prompted
                try:
                    pwd_input = await page.wait_for_selector("input#input-passcode, input[name='password']", timeout=5000)
                    from urllib.parse import urlparse, parse_qs
                    parsed_url = urlparse(url)
                    pwd_params = parse_qs(parsed_url.query).get('pwd', [''])
                    pwd = pwd_params[0] if pwd_params else ""
                    if pwd:
                        await pwd_input.fill(pwd)
                        logger.info("[SHADOW] Auto-filled Zoom passcode from URL query.")
                        submit_btn = await page.wait_for_selector("button:has-text('Join')", timeout=5000)
                        await submit_btn.click()
                except Exception as e:
                    logger.debug(f"[SHADOW] Zoom Passcode not requested or failed: {e}")
                    
                # Terms consent if prompted
                try:
                    agree_btn = await page.wait_for_selector("button:has-text('I Agree'), button:has-text('Agree')", timeout=5000)
                    await agree_btn.click()
                except: pass

            # --- AUDIO CAPTURE INJECTION ---
            async def on_audio_chunk(source, chunk_b64):
                try:
                    missing_padding = len(chunk_b64) % 4
                    if missing_padding:
                        chunk_b64 += '=' * (4 - missing_padding)
                    audio_data = base64.b64decode(chunk_b64)
                    await dg_socket.send_media(audio_data)
                except Exception as e:
                    logger.error(f"Error sending audio to Deepgram: {e}")

            await page.expose_binding("on_audio_chunk", on_audio_chunk)

            # Add init script so it persists
            await page.add_init_script("""
                console.log("[SHADOW] Init script loaded.");
                window.startAudioCapture = async () => {
                    console.log("[SHADOW] Starting audio capture...");
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        console.log("[SHADOW] MediaStream acquired.");
                        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                        mediaRecorder.ondataavailable = async (event) => {
                            if (event.data.size > 0) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64data = reader.result.split(',')[1];
                                    window.on_audio_chunk("mic", base64data);
                                };
                                reader.readAsDataURL(event.data);
                            }
                        };
                        mediaRecorder.start(250);
                        console.log("[SHADOW] MediaRecorder started.");
                    } catch (err) {
                        console.error("[SHADOW] Failed to start audio capture:", err);
                    }
                };
            """)
            
            # Re-navigate to bind script securely
            await page.goto(url)
            
            # --- RE-TRIGGER GOOGLE MEET OR ZOOM AUDIO CAPTURE ---
            if "meet.google.com" in url:
                logger.info("[SHADOW] Handling Meet post-load Join...")
                try:
                    await page.wait_for_selector("text='Got it'", timeout=5000)
                    await page.click("text='Got it'")
                except: pass
                
                try:
                    join_button = await page.wait_for_selector("span:has-text('Join now'), span:has-text('Ask to join')", timeout=15000)
                    await join_button.click()
                    await asyncio.sleep(2)
                    await page.evaluate("window.startAudioCapture()")
                except Exception as e:
                    logger.error(f"[SHADOW] Meet trigger capture failed: {e}")
                    
            elif "zoom.us" in url:
                logger.info("[SHADOW] Handling Zoom post-load Web Join...")
                try:
                    name_input = await page.wait_for_selector("input#input-to-join, input[name='name']", timeout=15000)
                    await name_input.fill("Shadow Swarm Observer")
                    join_btn = await page.wait_for_selector("button.btn-join, button:has-text('Join')", timeout=10000)
                    await join_btn.click()
                    
                    # Handle password input if prompted
                    try:
                        pwd_input = await page.wait_for_selector("input#input-passcode, input[name='password']", timeout=5000)
                        from urllib.parse import urlparse, parse_qs
                        parsed_url = urlparse(url)
                        pwd_params = parse_qs(parsed_url.query).get('pwd', [''])
                        pwd = pwd_params[0] if pwd_params else ""
                        if pwd:
                            await pwd_input.fill(pwd)
                            submit_btn = await page.wait_for_selector("button:has-text('Join')", timeout=5000)
                            await submit_btn.click()
                    except: pass
                    
                    try:
                        agree_btn = await page.wait_for_selector("button:has-text('I Agree'), button:has-text('Agree')", timeout=5000)
                        await agree_btn.click()
                    except: pass
                    
                    # Wait for interface workspace and trigger mic capture
                    await asyncio.sleep(6)
                    await page.evaluate("window.startAudioCapture()")
                except Exception as e:
                    logger.error(f"[SHADOW] Zoom trigger capture failed: {e}")

            logger.info(f"[SHADOW] Bot is in the meeting room. Recording session...")
            
            # Record session duration (e.g. 5 minutes for test/real sessions)
            await asyncio.sleep(300) 
            
            await dg_socket.send_finalize()
            await browser.close()
            logger.info("[SHADOW] Session complete. Commencing AI post-summarization...")
            
            # Generate Daily Structural Audit using LLM pipeline
            audit_file = generate_audit(transcript_file)
            if audit_file:
                logger.info(f"[SHADOW] Daily Structural Audit generated successfully: {audit_file}")

if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "https://meet.google.com/test-link"
    asyncio.run(join_meeting(url))
