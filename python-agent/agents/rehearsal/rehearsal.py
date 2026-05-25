import os
import asyncio
import json
import time
import logging
from typing import AsyncIterable
from dotenv import load_dotenv
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
from livekit.plugins import silero, deepgram
from speech_analyser import SpeechAnalyser

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("rehearsal")

AGENT_NAME = "REHEARSAL"
SYSTEM_PROMPT = """You are The Rehearsal, a professional speech coaching agent. When the user greets you or says they are ready to start, greet them back briefly, introduce yourself as their speech coach, and state you are ready to listen. During the rehearsal, listen silently while the user speaks and do not interrupt or respond to their content. Your only job is to listen and analyse. When asked to deliver a critique, you speak with authority, warmth, and precision like a world-class speaking coach. Keep all spoken responses concise and impactful."""


class SilentRehearsalAgent(voice.Agent):
    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool],
        model_settings: voice.ModelSettings,
    ) -> AsyncIterable[llm.ChatChunk | str]:
        if False:
            yield ""
        return


async def entrypoint(ctx: JobContext):
    shutdown_event = asyncio.Event()

    logger.info("=========================================")
    logger.info("--- THE REHEARSAL AGENT CONNECTING ---")
    logger.info("[JOB_START] Job accepted. Connecting to assigned room.")
    logger.info("=========================================")

    # Instantiate plugins fresh inside the entrypoint to avoid "Session is closed" reuse errors
    logger.info("[PLUGINS] Loading VAD Silero model...")
    vad_plugin = silero.VAD.load(min_silence_duration=0.6)
    
    logger.info("[PLUGINS] Initializing Deepgram STT (nova-2-general)...")
    stt_plugin = deepgram.STT(model="nova-2-general")
    
    logger.info("[PLUGINS] Initializing Deepgram TTS (aura-luna-en)...")
    tts_plugin = deepgram.TTS(model="aura-luna-en")

    # Connect to room
    logger.info("[ROOM] Connecting to LiveKit room with AutoSubscribe.SUBSCRIBE_ALL...")
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
            break
        except Exception as e:
            logger.warning(f"[ROOM] LiveKit connection attempt {attempt} failed: {e}")
            if attempt == max_retries:
                raise
            await asyncio.sleep(2 ** attempt)

    room_name = ctx.room.name
    logger.info(
        f"[ROOM] Connection verified. Room active: {room_name} | "
        f"Worker ID: {ctx.room.local_participant.identity}"
    )
    
    # Set agent name in metadata
    await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))
    logger.info(f"[METADATA] Local agent participant metadata sync: {AGENT_NAME}")

    analyser = SpeechAnalyser()
    review_triggered = False
    welcome_spoken = [False]  # mutable flag: welcome TTS fires exactly once on agent->listening

    agent = SilentRehearsalAgent(instructions=SYSTEM_PROMPT)

    logger.info("[SESSION] Creating AgentSession...")
    session = AgentSession(
        vad=vad_plugin,
        stt=stt_plugin,
        tts=tts_plugin,
        turn_handling={
            "interruption": {"enabled": False},
            "endpointing": {"min_delay": 3.0}
        },
    )

    async def publish_metrics_loop():
        """Broadcast live metrics to frontend every 2 seconds."""
        logger.info("[METRICS_LOOP] Starting broadcast loop (runs every 2s)...")
        while not review_triggered:
            try:
                words = analyser.total_words()
                if words > 0:
                    metrics_payload = analyser.snapshot()
                    logger.debug(f"[METRICS_LOOP] Broadcasting snapshot to frontend: {metrics_payload}")
                    payload = json.dumps({
                        "type": "rehearsal_metrics",
                        **metrics_payload
                    }).encode("utf-8")
                    await ctx.room.local_participant.publish_data(payload, topic="rehearsal_metrics")
            except Exception as e:
                logger.warning(f"[METRICS_LOOP] Failed to publish metrics: {e}")
            await asyncio.sleep(2)
        logger.info("[METRICS_LOOP] Loop stopped because review was triggered.")

    async def run_critique():
        nonlocal review_triggered
        review_triggered = True
        logger.info("=========================================")
        logger.info("[CRITIQUE] Starting critique analysis engine...")
        logger.info("=========================================")

        # Notify frontend that critique is being generated
        status_payload = json.dumps({"type": "critique_status", "status": "generating"}).encode("utf-8")
        await ctx.room.local_participant.publish_data(status_payload, topic="rehearsal_critique")
        logger.info("[CRITIQUE] Sent status payload (generating) to topic 'rehearsal_critique'")

        prompt = analyser.critique_prompt()
        logger.info(f"[CRITIQUE] Feeding prompt to OpenRouter:\n{prompt}")

        try:
            import httpx
            headers = {
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json"
            }
            body = {
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1000
            }
            
            logger.info("[CRITIQUE] Posting HTTP request to OpenRouter API...")
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{os.getenv('OPENROUTER_BASE_URL')}/chat/completions",
                    headers=headers,
                    json=body
                )
                
                raw = resp.json()["choices"][0]["message"]["content"].strip()
                logger.info(f"[CRITIQUE] Raw LLM reply received: {raw[:300]}...")

                # Strip markdown fences if any
                if raw.startswith("```"):
                    parts = raw.split("```")
                    raw = parts[1]
                    if raw.startswith("json"):
                        raw = raw[4:].strip()

                critique = json.loads(raw)
                logger.info(f"[CRITIQUE] Parsed JSON successfully! Score={critique.get('score')}")

                # 1. Publish full visual critique JSON to frontend
                payload = json.dumps({"type": "rehearsal_critique", **critique}).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload, topic="rehearsal_critique")
                logger.info("[CRITIQUE] Published visual critique JSON payload to topic 'rehearsal_critique'")

                # 2. Speak the critique via TTS (wrapped so playout errors are non-fatal)
                tts_script = analyser.tts_critique(critique)
                logger.info(f"[CRITIQUE] Synthesizing speech for critique script:\n{tts_script}")
                try:
                    await session.say(tts_script, allow_interruptions=False)
                    logger.info("[CRITIQUE] Speech synthesis finished [OK]")
                except Exception as tts_err:
                    logger.warning(f"[CRITIQUE] TTS playout failed (non-fatal, visual critique already sent): {tts_err}")

        except Exception as e:
            logger.error(f"[CRITIQUE] Critique generation crashed: {e}", exc_info=True)
            err_payload = json.dumps({
                "type": "rehearsal_critique",
                "error": str(e)
            }).encode("utf-8")
            await ctx.room.local_participant.publish_data(err_payload, topic="rehearsal_critique")

    # -- Timing state
    _last_final_end = [None]
    _interim_seen = [False]

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        """HOP-3: Deepgram STT fires this after transcribing audio frames from VAD."""
        if review_triggered:
            logger.info("[HOP-3][STT_EVENT] Skipping - review already triggered.")
            return

        now = time.time()
        text = event.transcript.strip()
        # Promoted to INFO so this is always visible in console
        logger.info(f"[HOP-3][STT_EVENT] user_input_transcribed fired | is_final={event.is_final} | text='{text}'")

        if not event.is_final:
            # Interim: detect pause onset + stream caption
            if not _interim_seen[0]:
                logger.info("[HOP-3][STT_EVENT] First interim of new utterance - triggering pause detector.")
                analyser.on_interim_start(now)
                _interim_seen[0] = True

            caption_payload = json.dumps({
                "type": "caption",
                "text": text,
                "is_final": False
            }).encode("utf-8")

            logger.info(f"[HOP-3->4][STT_EVENT] Publishing INTERIM caption to topic='caption': '{text}'")
            asyncio.create_task(
                ctx.room.local_participant.publish_data(caption_payload, topic="caption")
            )
        else:
            # Final: feed analyser + send final caption
            if text:
                logger.info(f"[HOP-3][STT_EVENT] FINAL segment confirmed: '{text}'")
                start_est = _last_final_end[0] if _last_final_end[0] else now - 1.0
                logger.info(f"[HOP-3->ANALYSER] Feeding segment to SpeechAnalyser: start={start_est:.2f}, end={now:.2f}")
                analyser.on_final(text, start_est, now)
                _last_final_end[0] = now
                _interim_seen[0] = False

                caption_payload = json.dumps({
                    "type": "caption",
                    "text": text,
                    "is_final": True
                }).encode("utf-8")

                logger.info(f"[HOP-3->4][STT_EVENT] Publishing FINAL caption to topic='caption'.")
                asyncio.create_task(
                    ctx.room.local_participant.publish_data(caption_payload, topic="caption")
                )
                logger.info(f"[HOP-3][STT_EVENT] Session total words so far: {analyser.total_words()}")
            else:
                logger.info("[HOP-3][STT_EVENT] Final event had empty transcript - skipping.")

    @ctx.room.on("data_received")
    def on_data(dp):
        try:
            msg = json.loads(dp.data.decode("utf-8"))
            logger.info(f"[DATA_RECEIVED] Msg arrived: {msg}")
            if msg.get("key") == "end_session":
                logger.info("[DATA_RECEIVED] MATCHED key 'end_session'. Shutting down rehearsal session.")
                shutdown_event.set()
            elif msg.get("key") == "stop_review":
                logger.info("[DATA_RECEIVED] MATCHED key 'stop_review'!")
                if not review_triggered:
                    logger.info("[DATA_RECEIVED] Launching critique task.")
                    asyncio.create_task(run_critique())
                else:
                    logger.info("[DATA_RECEIVED] Critique was already triggered; ignoring duplicate.")
        except Exception as e:
            logger.warning(f"[DATA_RECEIVED] Non-JSON payload or parsing error: {e}")

    @session.on("user_state_changed")
    def on_user_state_changed(event: voice.UserStateChangedEvent):
        """HOP-2: VAD triggers this when user starts/stops speaking."""
        logger.info(f"[HOP-2][VAD_EVENT] User state: {event.old_state} -> {event.new_state}")
        if event.new_state == "speaking":
            logger.info("[HOP-2][VAD_EVENT] [OK] VAD confirmed: user IS speaking. Waiting for HOP-3 (STT).")
        elif event.new_state == "listening":
            logger.info("[HOP-2][VAD_EVENT] User stopped speaking. STT final segment should follow.")

    @session.on("agent_state_changed")
    def on_agent_state_changed(event: voice.AgentStateChangedEvent):
        """Logs when the agent switches between initializing / listening / speaking / thinking."""
        logger.info(f"[AGENT_STATE] Agent state: {event.old_state} -> {event.new_state}")
        if event.new_state == "listening":
            logger.info("[AGENT_STATE] [OK] Agent is now LISTENING - audio pipeline is warm.")
            # Fire welcome speech the FIRST time the agent reaches 'listening'.
            # Using create_task so a playout error cannot crash the entrypoint.
            if not welcome_spoken[0]:
                welcome_spoken[0] = True
                logger.info("[AGENT_STATE] Scheduling welcome TTS via create_task...")
                async def _speak_welcome():
                    try:
                        logger.info("[TTS] Speaking welcome message...")
                        await session.say(
                            "The Rehearsal is ready. Start speaking whenever you like. "
                            "Press Stop and Review when you are done and I will give you a full breakdown.",
                            allow_interruptions=False
                        )
                        logger.info("[TTS] Welcome message playout complete [OK]")
                    except Exception as e:
                        logger.warning(f"[TTS] Welcome playout failed (non-fatal): {e}")
                asyncio.create_task(_speak_welcome())
        elif event.new_state == "speaking":
            logger.info("[AGENT_STATE] [AUDIO] Agent is now speaking via TTS.")

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        logger.info(f"[ROOM] Participant disconnected: {participant.identity}")

        async def shutdown_if_empty():
            await asyncio.sleep(0.5)
            if not ctx.room.remote_participants:
                logger.info("[ROOM] No remote participants remain. Ending rehearsal worker.")
                shutdown_event.set()

        asyncio.create_task(shutdown_if_empty())

    async def _on_shutdown():
        logger.info("[SHUTDOWN] LiveKit shutdown callback triggered. Setting shutdown event.")
        shutdown_event.set()

    ctx.add_shutdown_callback(_on_shutdown)

    # Start metrics broadcast loop
    asyncio.create_task(publish_metrics_loop())

    try:
        logger.info("[SESSION] Invoking session.start(room, agent)...")
        await session.start(room=ctx.room, agent=agent)
        logger.info("[SESSION] session.start complete. Welcome TTS will fire on first agent_state_changed->listening.")

        # Keep the room job alive until the user explicitly leaves or disconnects.
        await shutdown_event.wait()
            
    except Exception as e:
        logger.error(f"[SESSION] Fatal session error: {e}", exc_info=True)
    finally:
        try:
            await session.aclose()
        except Exception as e:
            logger.warning(f"[SESSION] Session cleanup warning: {e}")
        logger.info("=========================================")
        logger.info("--- THE REHEARSAL SESSION TERMINATED ---")
        logger.info("=========================================")


async def request_fnc(req: JobRequest):
    logger.info(f"[JOB_REQ] Accepted incoming job req: {req.room.name}")
    await req.accept()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name=AGENT_NAME
        )
    )
