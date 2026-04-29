import asyncio
import aiohttp
import json
import logging
from typing import Optional, AsyncIterable
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, JobRequest, WorkerOptions, cli, llm, AgentSession, room_io, stt
from livekit.agents.voice import Agent, ModelSettings
from livekit.plugins import mistralai, silero

load_dotenv()

# Fix for Windows SSL issues in aiohttp
import ssl
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

logger = logging.getLogger("mistral-agent")
logger.setLevel(logging.INFO)

# --- CONFIGURATION ---
ROOM_NAME             = "ai_room_MURALI"
TARGET_HUMAN_IDENTITY = "MURALI"
AGENT_NAME            = "WEATHER AGENT FOR INDIA"
# ---------------------

class CustomAgent(Agent):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    async def stt_node(self, audio: AsyncIterable[rtc.AudioFrame], model_settings: ModelSettings) -> Optional[AsyncIterable[stt.SpeechEvent]]:
        async def filtered_audio():
            async for frame in audio:
                # insert custom audio preprocessing here
                yield frame
        
        async for event in Agent.default.stt_node(self, filtered_audio(), model_settings):
            # insert custom text postprocessing here 
            yield event

async def entrypoint(ctx: JobContext):
    shutdown_event = asyncio.Event()
    
    try:
        # Initialize VAD (Voice Activity Detection)
        vad_plugin = silero.VAD.load(min_silence_duration=0.5)
        logger.info("Silero VAD loaded successfully")

        # Initialize ChatContext with a system message
        chat_ctx = llm.ChatContext(
            items=[
                llm.ChatMessage(
                    role="system",
                    content=["You are Florence, a professional and helpful AI assistant for the Xclusive Pro platform."],
                )
            ]
        )

        # Create the AgentSession
        session = AgentSession(
            vad=vad_plugin,
            stt=mistralai.STT(model="voxtral-mini-latest"),
            llm=mistralai.LLM(model="mistral-large-latest"),
            tts=mistralai.TTS(voice="en_paul_neutral"),
        )

        # Connect to the room
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        
        # Sync the new identity to the UI
        logger.info(f"Syncing agent identity: {AGENT_NAME}")
        await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))

        # Initialize the Agent logic
        agent = CustomAgent(
            instructions="You are Florence, a professional and helpful AI assistant for the Xclusive Pro platform.",
            chat_ctx=chat_ctx,
        )

        # 1. Create a manual AudioSource for the greeting (MATCHING MISTRAL 24kHz)
        audio_source = rtc.AudioSource(24000, 1) 
        track = rtc.LocalAudioTrack.create_audio_track("agent_mic", audio_source)
        
        # 2. Publish the track to the room
        logger.info("Publishing manual audio track...")
        options = rtc.TrackPublishOptions()
        options.source = rtc.TrackSource.SOURCE_MICROPHONE
        publication = await ctx.room.local_participant.publish_track(track, options)
        logger.info(f"✅ Audio track published: {publication.sid}")

        # Greet the user manually
        async def greet():
            await asyncio.sleep(2.0)
            logger.info("Florence is generating greeting audio...")
            try:
                # Initialize TTS directly
                tts_plugin = mistralai.TTS(voice="en_paul_neutral")
                audio_stream = tts_plugin.synthesize("Hello! I am Florence, your AI assistant. How can I help you today?")
                
                logger.info("Pushing audio frames to room...")
                async for chunk in audio_stream:
                    if hasattr(audio_source, "capture_frame"):
                        await audio_source.capture_frame(chunk.frame)
                    else:
                        await audio_source.push_frame(chunk.frame)
                
                logger.info("✅ Manual greeting completed.")
                
                # --- NEW: Funny Weather Report after Greeting ---
                await weather_report()
            except Exception as e:
                logger.error(f"❌ Manual greeting error: {e}")

        async def weather_report():
            logger.info("Asking LLM for a funny weather report...")
            try:
                llm_plugin = mistralai.LLM(model="mistral-large-latest")
                tts_plugin = mistralai.TTS(voice="en_paul_neutral")
                
                weather_prompt = (
                    "Generate a funny, crisp, 5-second weather report for a digital AI world, specifically based in India. "
                    "Make witty jokes about the high-heat data centers in Bangalore, the digital monsoons, and 'cloud computing' in the Indian sky. "
                    "Mention 'raining data'. Keep it sharp, witty, and uniquely Indian."
                )
                
                # Use ChatContext for the LLM request (Robust method)
                weather_ctx = llm.ChatContext()
                weather_ctx.add_message(role="user", content=weather_prompt)
                
                # Use the built-in .collect() to gather the full response
                logger.info("Generating weather report...")
                weather_response = await llm_plugin.chat(chat_ctx=weather_ctx).collect()
                weather_text = weather_response.text
                
                if not weather_text:
                    weather_text = "The weather is digital and sunny today!"
                
                logger.info(f"FULL WEATHER REPORT GENERATED:\n{weather_text}")
                
                logger.info(f"Speaking funny weather: {weather_text[:50]}...")
                weather_stream = tts_plugin.synthesize(weather_text)
                async for chunk in weather_stream:
                    if hasattr(audio_source, "capture_frame"):
                        await audio_source.capture_frame(chunk.frame)
                    else:
                        await audio_source.push_frame(chunk.frame)
                logger.info("✅ Weather report completed.")
            except Exception as e:
                logger.error(f"❌ Weather report error: {e}")

        asyncio.create_task(greet())

        # Now start the AgentSession for the rest of the conversation
        logger.info("Starting AgentSession for conversation...")
        await session.start(room=ctx.room, agent=agent)

        # Agent leaves only when participant disconnects
        @ctx.room.on("participant_disconnected")
        def on_participant_disconnected(p):
            if p.identity.startswith(TARGET_HUMAN_IDENTITY):
                logger.info(f"Participant {p.identity} left — agent shutting down.")
                shutdown_event.set()

        # Handle explicit shutdown
        ctx.add_shutdown_callback(lambda: shutdown_event.set())
        
        # Wait for shutdown event
        await shutdown_event.wait()
        
        # Cleanup
        await session.aclose()
        
    except Exception as e:
        logger.error(f"CRITICAL ERROR in entrypoint: {e}", exc_info=True)
    finally:
        logger.info(f"Job finished for room: {ctx.room.name}")

async def request_fnc(req: JobRequest) -> None:
    logger.info(f"Received job request for room: {req.room.name}")
    logger.info("Temporarily accepting ALL jobs for testing")
    await req.accept()

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name=AGENT_NAME,
        )
    )
