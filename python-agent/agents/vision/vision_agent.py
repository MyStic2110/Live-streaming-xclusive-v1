import os
import asyncio
import logging
import csv
from datetime import datetime
from dotenv import load_dotenv
import cv2
import numpy as np
from livekit.agents import (
    JobContext,
    JobRequest,
    WorkerOptions,
    cli,
    llm,
    AgentSession,
    AutoSubscribe,
    voice,
    rtc
)
from livekit.plugins import silero, openai, deepgram

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Logger setup
logger = logging.getLogger("vision-agent")
logger.setLevel(logging.INFO)

# --- CONFIG ---
AGENT_NAME = "VONE"
BASE_DIR = os.path.dirname(__file__)
KNOWN_FACES_DIR = os.path.join(BASE_DIR, "known_faces")
LOGS_DIR = os.path.join(BASE_DIR, "logs")
MODELS_DIR = os.path.join(BASE_DIR, "models")
ATTENDANCE_FILE = os.path.join(LOGS_DIR, "attendance.csv")

# Model Paths
DETECTOR_MODEL = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
RECOGNIZER_MODEL = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

# Ensure directories exist
os.makedirs(KNOWN_FACES_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

# Initialize CSV if not exists
if not os.path.exists(ATTENDANCE_FILE):
    with open(ATTENDANCE_FILE, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["Timestamp", "Identity", "Status", "Confidence", "Snapshot"])

class VisionAgent:
    def __init__(self, ctx: JobContext, session: AgentSession):
        self.ctx = ctx
        self.session = session
        self.verified = False
        self.processing = False
        self.participant_identity = ""
        
        # Initialize Sentry
        self.sentry = get_sentry(AGENT_NAME)
        self.sentry.log_transaction("vision_init", {"agent": AGENT_NAME})
        
        # Initialize OpenCV Face Models
        # YuNet for detection
        self.detector = cv2.FaceDetectorYN.create(
            model=DETECTOR_MODEL,
            config="",
            input_size=(320, 320),
            score_threshold=0.9,
            nms_threshold=0.3,
            top_k=5000
        )
        # SFace for recognition
        self.recognizer = cv2.FaceRecognizerSF.create(
            model=RECOGNIZER_MODEL,
            config=""
        )

    async def speak(self, text: str):
        logger.info(f"VONE speaking: {text}")
        await self.session.say(text, allow_interruptions=False)

    def verify_face(self, frame: rtc.VideoFrame, identity: str):
        """Verify face using Pure OpenCV (YuNet + SFace)."""
        try:
            # Convert LiveKit VideoFrame to BGR
            rgba_buffer = frame.convert(rtc.VideoBufferType.RGBA)
            img = np.frombuffer(rgba_buffer.data, dtype=np.uint8).reshape((frame.height, frame.width, 4))
            img_bgr = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)

            # Update detector input size
            h, w, _ = img_bgr.shape
            self.detector.setInputSize((w, h))
            
            # Detect face
            _, faces = self.detector.detect(img_bgr)
            if faces is None:
                return {"status": "NO_FACE"}

            # Align and extract features from the first detected face
            face_aligned = self.recognizer.alignCrop(img_bgr, faces[0])
            live_feature = self.recognizer.feature(face_aligned)

            # Look for reference image
            ref_path = os.path.join(KNOWN_FACES_DIR, f"{identity.lower()}.jpg")
            if not os.path.exists(ref_path):
                return {"status": "NO_REF", "detected": True}

            # Load and process reference
            ref_img = cv2.imread(ref_path)
            if ref_img is None:
                return {"status": "ERROR", "msg": "Failed to load reference image"}
                
            self.detector.setInputSize((ref_img.shape[1], ref_img.shape[0]))
            _, ref_faces = self.detector.detect(ref_img)
            if ref_faces is None:
                return {"status": "ERROR", "msg": "No face found in reference image"}
                
            ref_aligned = self.recognizer.alignCrop(ref_img, ref_faces[0])
            ref_feature = self.recognizer.feature(ref_aligned)

            # Compare features (Cosine similarity)
            t_compare = self.sentry.start_latency_timer()
            cosine_score = self.recognizer.match(live_feature, ref_feature, cv2.FaceRecognizerSF_FR_COSINE)
            self.sentry.stop_latency_timer(t_compare, "biometric_compare")
            
            # Threshold for SFace (Cosine) is usually around 0.363
            threshold = 0.363
            confidence = max(0, cosine_score / 1.0)
            
            # Save snapshot
            snap_name = f"{identity}_{datetime.now().strftime('%H%M%S')}.jpg"
            snap_path = os.path.join(LOGS_DIR, snap_name)
            cv2.imwrite(snap_path, img_bgr)
            
            return {
                "status": "SUCCESS" if cosine_score > threshold else "FAILED",
                "confidence": confidence,
                "score": cosine_score,
                "snapshot": snap_name
            }
        except Exception as e:
            logger.error(f"OpenCV Vision Error: {str(e)}")
            return {"status": "ERROR", "msg": str(e)}

    async def process_video_track(self, track: rtc.RemoteVideoTrack):
        logger.info(f"Subscribed to video track: {track.sid}")
        await asyncio.sleep(2)
        await self.speak("Vision system online. Please face the camera for biometric scan.")
        
        video_stream = rtc.VideoStream(track)
        async for frame_event in video_stream:
            if self.verified or self.processing:
                continue
                
            self.processing = True
            loop = asyncio.get_event_loop()
            res = await loop.run_in_executor(None, self.verify_face, frame_event.frame, self.participant_identity)
            
            if res["status"] == "SUCCESS":
                self.verified = True
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                with open(ATTENDANCE_FILE, 'a', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow([timestamp, self.participant_identity, "VERIFIED", f"{res['confidence']:.2f}", res["snapshot"]])
                
                await self.speak(f"Biometric confirmed. Welcome {self.participant_identity}. Logging shift and ending session.")
                self.sentry.log_transaction("biometric_success", {"identity": self.participant_identity, "confidence": res["confidence"]})
                await asyncio.sleep(3)
                await self.ctx.room.disconnect()
                break
            
            elif res["status"] == "NO_REF":
                await self.speak("I can see you, but no reference profile exists for your identity.")
                self.sentry.log_transaction("access_denied", {"reason": "no_reference", "identity": self.participant_identity})
                self.processing = False
                await asyncio.sleep(5)
            
            elif res["status"] == "NO_FACE":
                self.processing = False 
                await asyncio.sleep(0.5)
            
            else:
                self.processing = False
                await asyncio.sleep(0.5)

async def entrypoint(ctx: JobContext):
    logger.info(f"--- V-ONE (OPENCV) CONNECTING (ROOM: {ctx.room.name}) ---")
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    
    participant = None
    while not participant:
        for p in ctx.room.remote_participants.values():
            if p.identity:
                participant = p
                break
        await asyncio.sleep(0.5)

    # Setup Session
    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )
    tts_plugin = deepgram.TTS(model="aura-stella-en")
    vad_plugin = silero.VAD.load()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    session = AgentSession(vad=vad_plugin, stt=deepgram.STT(), llm=llm_plugin, tts=tts_plugin)
    session.chat_ctx.append(message=llm.ChatMessage(role="system", content=[f"CURRENT_TIME: {current_time}"]))
    
    vision = VisionAgent(ctx, session)
    vision.participant_identity = participant.identity

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_VIDEO:
            asyncio.create_task(vision.process_video_track(track))

    await session.start(room=ctx.room)
    await vision.speak(f"Biometrics initialized. Welcome back {participant.identity}.")

async def request_fnc(req: JobRequest):
    await req.accept()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, request_fnc=request_fnc, agent_name=AGENT_NAME))
