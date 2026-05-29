"""
ReelsAgent: Autonomous pipeline to convert a blog JSON into a 30-second vertical reel.

Pipeline:
  1. ScriptWriter (LLM) → Hook-driven narration script
  2. AudioComposer (edge-tts) → Neural voice .mp3 + word timings
  3. VideoComposer (MoviePy) → Vertical 9:16 .mp4 with dynamic captions
  4. Auto-sync to frontend/public/reels/ for live preview
"""
import os
import json
# requests import removed – using Gemini‑generated image fallback
import asyncio
import sys

from audio_composer import AudioComposer
from video_composer import VideoComposer
from script_writer import generate_reel_script


class ReelsAgent:
    def __init__(self, voice="en-US-JennyNeural"):
        # Jenny: warm, conversational, natural — ideal for storytelling reels
        self.audio_composer = AudioComposer(voice=voice)
        self.video_composer = VideoComposer()

        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_dir = os.path.join(self.base_dir, "output")
        os.makedirs(self.output_dir, exist_ok=True)

        self.scratch_dir = os.path.join(self.base_dir, "../../scratch")
        os.makedirs(self.scratch_dir, exist_ok=True)

    async def generate_reel(self, blog_json_path: str) -> str:
        """
        Coordinates the entire local pipeline to digest a blog and output a vertical reel.
        """
        if not os.path.exists(blog_json_path):
            raise FileNotFoundError(f"Blog JSON file not found: {blog_json_path}")

        print(f"\n[REELS_AGENT] Reading blog: {os.path.basename(blog_json_path)}")
        with open(blog_json_path, "r", encoding="utf-8") as f:
            blog_data = json.load(f)

        slug = blog_data.get("slug", "swarm-reel")

        # ── Step 1: Generate LLM-powered narration script ─────────────────────
        print("[REELS_AGENT] Generating narrative script via LLM...")
        script = await generate_reel_script(blog_data)
        safe_script = script.encode('ascii', 'ignore').decode('ascii')
        print(f"[REELS_AGENT] Script ({len(script.split())} words):\n--> \"{safe_script}\"")

        # ── Define temp and output paths ───────────────────────────────────────
        temp_audio = os.path.join(self.scratch_dir, f"temp_{slug}_narration.mp3")
        temp_vtt   = os.path.join(self.scratch_dir, f"temp_{slug}_subs.vtt")
        output_mp4 = os.path.join(self.output_dir, f"{slug}_reel.mp4")

        # ── Step 2: Synthesize neural voice narration ─────────────────────────
        print("[REELS_AGENT] Synthesizing neural voice narration (Jenny)...")
        word_timings = await self.audio_composer.generate_narration(script, temp_audio, temp_vtt)

        if not word_timings:
            raise RuntimeError("Failed to generate voice timings or subtitle files.")

        # ── Step 3: Resolve visual assets ─────────────────────────────────────
        # ── Step 3: Resolve Visual Slides & Outro Branding ────────────────────
        slide_images = blog_data.get("slideImages", [])
        public_dir = os.path.abspath(os.path.join(self.base_dir, "../../../frontend/public"))

        resolved_slides = []
        if slide_images:
            for p in slide_images:
                if os.path.exists(p):
                    resolved_slides.append(os.path.abspath(p))
                else:
                    rel_path = os.path.abspath(os.path.join(public_dir, p.lstrip("/")))
                    if os.path.exists(rel_path):
                        resolved_slides.append(rel_path)
            
        if not resolved_slides:
            # Fall back to single featured image
            featured_image_path = self._resolve_featured_image(blog_data)
            resolved_slides.append(featured_image_path)

        # Inject the Swarm Agentic Lab Outro Branding card at the end of the slideshow
        outro_path = os.path.abspath(os.path.join(public_dir, "insights/swarm_agentic_lab_outro.png"))
        if os.path.exists(outro_path):
            print("[REELS_AGENT] Appending Swarm Agentic Lab Outro branding slide.")
            resolved_slides.append(outro_path)
        else:
            # Fallback path if not copied yet
            local_outro = os.path.abspath(os.path.join(self.base_dir, "swarm_agentic_lab_outro.png"))
            if os.path.exists(local_outro):
                resolved_slides.append(local_outro)

        print(f"[REELS_AGENT] Slideshow mode: {len(resolved_slides)} slides resolved.")
        img_path = resolved_slides

        # ── Step 4: Resolve & Download Background Music ───────────────────────
        bg_music_path = os.path.join(self.scratch_dir, "tech_ambient_bg.mp3")
        if not os.path.exists(bg_music_path):
            print("[REELS_AGENT] Downloading royalty-free background music track...")
            try:
                import urllib.request
                music_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
                urllib.request.urlretrieve(music_url, bg_music_path)
                print("[REELS_AGENT] Background music downloaded successfully!")
            except Exception as e:
                print(f"[REELS_AGENT] Warning: Music download failed ({e}) — compiling without music.")
                bg_music_path = None

        # ── Step 5: Compile vertical reel ─────────────────────────────────────
        print("[REELS_AGENT] Compiling vertical 9:16 reel with dynamic captions & background music...")
        self.video_composer.compile_reel(
            img_path, 
            temp_audio, 
            word_timings, 
            output_mp4,
            title=blog_data.get("title", ""),
            category=blog_data.get("category", ""),
            bg_music_path=bg_music_path
        )

        # ── Step 6: Sync to frontend public assets ────────────────────────────
        import shutil
        public_dir = os.path.abspath(os.path.join(self.base_dir, "../../../frontend/public"))
        frontend_reels_dir = os.path.join(public_dir, "reels")
        os.makedirs(frontend_reels_dir, exist_ok=True)
        frontend_reel_path = os.path.join(frontend_reels_dir, f"{slug}_reel.mp4")
        shutil.copy2(output_mp4, frontend_reel_path)
        print(f"[REELS_AGENT] Synced to frontend:\n--> {frontend_reel_path}")

        # ── Cleanup temp files ────────────────────────────────────────────────
        for f in [temp_audio, temp_vtt]:
            if os.path.exists(f):
                os.remove(f)

        print(f"\n[REELS_AGENT] SUCCESS! Vertical reel ready at:\n--> {output_mp4}\n")
        return output_mp4

    def _resolve_featured_image(self, blog_data: dict) -> str:
        """Resolve featured image path from blog data, with fallback."""
        featured_image = blog_data.get("featuredImage", "")
        public_dir = os.path.abspath(os.path.join(self.base_dir, "../../../frontend/public"))
        img_path = os.path.abspath(os.path.join(public_dir, featured_image.lstrip("/")))
        if not featured_image or not os.path.exists(img_path):
            img_path = r"C:\Users\Acer\.gemini\antigravity\brain\cda27265-3c7f-4279-8c71-d20ff46ed2dd\abstract_tech_bg_1779277336065.png"
            print(f"[REELS_AGENT] Using Gemini-generated fallback image for reel: {img_path}")
        return img_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reels_agent.py <path_to_blog_json>")
        sys.exit(1)

    blog_path = sys.argv[1]
    agent = ReelsAgent()
    asyncio.run(agent.generate_reel(blog_path))
