import os
import json
import asyncio
import sys
import shutil

from audio_composer import AudioComposer
from video_composer import VideoComposer
from script_writer import generate_reel_script
from avatar_helper import AvatarHelper

class ReelsFaceAgent:
    def __init__(self, voice="en-US-JennyNeural"):
        self.audio_composer = AudioComposer(voice=voice)
        self.video_composer = VideoComposer()
        
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_dir = os.path.join(self.base_dir, "output")
        os.makedirs(self.output_dir, exist_ok=True)

        self.scratch_dir = os.path.join(self.base_dir, "../../scratch")
        os.makedirs(self.scratch_dir, exist_ok=True)
        
        # Path to the generated Gemini avatar image
        fallback_avatar_path = r"C:\\Users\\Acer\\.gemini\\antigravity\\brain\\cda27265-3c7f-4279-8c71-d20ff46ed2dd\\reels_girl_avatar_1779284575336.png"
        self.avatar_helper = AvatarHelper(fallback_avatar_path)

    async def generate_reel(self, blog_json_path: str) -> str:
        """
        Coordinates the entire local pipeline to digest a blog and output a vertical face reel.
        """
        if not os.path.exists(blog_json_path):
            raise FileNotFoundError(f"Blog JSON file not found: {blog_json_path}")

        print(f"\n[REELS_FACE_AGENT] Reading blog: {os.path.basename(blog_json_path)}")
        with open(blog_json_path, "r", encoding="utf-8") as f:
            blog_data = json.load(f)

        slug = blog_data.get("slug", "swarm-reel")

        # ── Step 1: Generate LLM-powered narration script
        print("[REELS_FACE_AGENT] Generating narrative script via LLM...")
        script = await generate_reel_script(blog_data)
        safe_script = script.encode('ascii', 'ignore').decode('ascii')
        print(f"[REELS_FACE_AGENT] Script ({len(script.split())} words):\n--> \"{safe_script}\"")

        # ── Define temp and output paths
        temp_audio = os.path.join(self.scratch_dir, f"temp_face_{slug}_narration.mp3")
        temp_vtt   = os.path.join(self.scratch_dir, f"temp_face_{slug}_subs.vtt")
        output_mp4 = os.path.join(self.output_dir, f"{slug}_face_reel.mp4")

        # ── Step 2: Synthesize neural voice narration
        print("[REELS_FACE_AGENT] Synthesizing neural voice narration (Jenny)...")
        word_timings = await self.audio_composer.generate_narration(script, temp_audio, temp_vtt)

        if not word_timings:
            raise RuntimeError("Failed to generate voice timings or subtitle files.")

        # ── Step 3: Resolve Avatar
        print("[REELS_FACE_AGENT] Resolving photo-realistic avatar...")
        avatar_img_path = self.avatar_helper.generate_avatar_image(
            "Ultra-realistic close-up portrait video of a person delivering perfectly synchronized lip-sync dialogue with highly natural mouth movement and expressive facial animation. Maintain subtle smile with direct eye contact toward the camera, creating an emotionally engaging and cinematic presence. Slow natural head tilts while speaking, combined with calm and relaxed facial movement. Natural blinking patterns with soft realistic eye expressions. Confident facial expression with a slight smirk, transitioning smoothly between emotions based on the audio tone. Raised eyebrows occasionally for emphasis and expressive storytelling. Smooth and accurate lip-syncing with emotionally responsive mouth movement, perfectly aligned to speech and audio timing. Gentle nodding while talking to create realistic conversational energy. Natural laughter moments with bright authentic expressions and soft cheek movement. Serious cinematic look gradually transitioning into a warm smile. Eyes subtly following camera movement while maintaining strong viewer connection. Playful wink and cheeky facial reactions at suitable moments. Emotional facial reactions dynamically synced with dialogue, including curiosity, confidence, happiness, and thoughtful pauses. Intense eye contact with cinematic portrait lighting and aesthetically pleasing close-up framing. Smooth facial motion optimized for reels and short-form vertical content. Realistic skin texture, soft lighting reflections, detailed eyes, natural breathing motion, subtle jaw movement, expressive cheeks, realistic eyelash movement, cinematic depth of field, premium influencer-style aesthetics, ultra-detailed facial animation, photorealistic expressions, emotionally engaging performance, smooth transitions between moods, modern social media reel style, high realism, cinematic close-up composition, elegant face dynamics, natural human micro-expressions, realistic blinking intervals, perfectly synchronized lips, immersive emotional delivery, and polished AI-generated portrait video quality."
        )
        
        # ── Step 4: Generate Deepfake Avatar Clip using Wav2Lip
        print("[REELS_FACE_AGENT] Generating Wav2Lip deepfake avatar...")
        avatar_clip = self.avatar_helper.create_wav2lip_avatar(avatar_img_path, temp_audio)

        # ── Step 5: Compile vertical reel
        print("[REELS_FACE_AGENT] Compiling vertical 9:16 face reel with dynamic captions...")
        self.video_composer.compile_face_reel(
            avatar_clip, 
            temp_audio, 
            word_timings, 
            output_mp4,
            title=blog_data.get("title", ""),
            category=blog_data.get("category", "")
        )

        # ── Step 6: Sync to frontend public assets
        public_dir = os.path.abspath(os.path.join(self.base_dir, "../../../frontend/public"))
        frontend_reels_dir = os.path.join(public_dir, "reels")
        os.makedirs(frontend_reels_dir, exist_ok=True)
        frontend_reel_path = os.path.join(frontend_reels_dir, f"{slug}_face_reel.mp4")
        shutil.copy2(output_mp4, frontend_reel_path)
        print(f"[REELS_FACE_AGENT] Synced to frontend:\n--> {frontend_reel_path}")

        # ── Cleanup temp files
        for f in [temp_audio, temp_vtt]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except:
                    pass

        print(f"\n[REELS_FACE_AGENT] SUCCESS! Vertical face reel ready at:\n--> {output_mp4}\n")
        return output_mp4


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reels_face_agent.py <path_to_blog_json>")
        sys.exit(1)

    blog_path = sys.argv[1]
    agent = ReelsFaceAgent()
    asyncio.run(agent.generate_reel(blog_path))
