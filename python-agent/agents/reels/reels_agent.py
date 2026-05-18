import os
import json
import asyncio
import sys
from audio_composer import AudioComposer
from video_composer import VideoComposer

class ReelsAgent:
    def __init__(self, voice="en-US-GuyNeural"):
        self.audio_composer = AudioComposer(voice=voice)
        self.video_composer = VideoComposer()
        
        # Setup directories
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_dir = os.path.join(self.base_dir, "output")
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Paths for temporary compile items
        self.scratch_dir = os.path.join(self.base_dir, "../../scratch")
        os.makedirs(self.scratch_dir, exist_ok=True)

    def extract_narration_script(self, blog_data: dict) -> str:
        """
        Heuristically compiles a high-tempo, 30-second technical script (~70-80 words)
        by extracting and concatenating heading summaries and [Key Point] take-aways.
        """
        title = blog_data.get("title", "")
        excerpt = blog_data.get("excerpt", "")
        content = blog_data.get("content", "")

        # Extract [Key Point] sentences using regex
        import re
        key_points = re.findall(r"\[Key Point\]:?\s*(.*?)(?=\n|\\n|$)", content)
        
        if not key_points:
            # Fallback to excerpt
            return f"Welcome to Swarm Insights. Today we dive into {title}. {excerpt}"

        # Clean key points
        cleaned_points = []
        for kp in key_points:
            # Strip bold marks and colons
            clean = kp.replace("**", "").replace("*", "").strip()
            # Stop if sentence is too long
            if len(clean.split()) > 5:
                cleaned_points.append(clean)

        # Assemble script (approx 2-3 key points for a 30s limit)
        script_parts = [
            f"Analyzing technical insights for: {title}.",
        ]
        
        # Add top 2-3 key points
        for kp in cleaned_points[:3]:
            script_parts.append(kp)
            
        script_text = " ".join(script_parts)
        
        # Truncate to maximum 80 words to strictly enforce the 30-second limit
        words = script_text.split()
        if len(words) > 80:
            script_text = " ".join(words[:80]) + "."
            
        return script_text

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
        
        # 1. Compile 30s Script
        script = self.extract_narration_script(blog_data)
        print(f"[REELS_AGENT] Compiled Narration Script ({len(script.split())} words):\n--> \"{script}\"")

        # Define output and temp files
        temp_audio = os.path.join(self.scratch_dir, f"temp_{slug}_narration.mp3")
        temp_vtt = os.path.join(self.scratch_dir, f"temp_{slug}_subs.vtt")
        output_mp4 = os.path.join(self.output_dir, f"{slug}_reel.mp4")

        # 2. Synthesize Speech & Word Boundary Timings
        print("[REELS_AGENT] Synthesizing zero-cost neural voice narration...")
        word_timings = await self.audio_composer.generate_narration(script, temp_audio, temp_vtt)
        
        if not word_timings:
            raise RuntimeError("Failed to generate voice timings or subtitle files.")

        # 3. Locate Custom Blog Illustration
        # Try to locate the featured image in public assets folder
        featured_image = blog_data.get("featuredImage", "")
        # Resolve to standard frontend public folder path on disk
        public_dir = os.path.abspath(os.path.join(self.base_dir, "../../../frontend/public"))
        img_path = os.path.abspath(os.path.join(public_dir, featured_image.lstrip("/")))

        print(f"[REELS_AGENT] Resolving visual asset path:\n--> {img_path}")

        # 4. Compile and Render Vertical Reel
        self.video_composer.compile_reel(img_path, temp_audio, word_timings, output_mp4)

        # 5. Automatically copy to Frontend Public Reels for live preview
        import shutil
        frontend_reels_dir = os.path.join(public_dir, "reels")
        os.makedirs(frontend_reels_dir, exist_ok=True)
        frontend_reel_path = os.path.join(frontend_reels_dir, f"{slug}_reel.mp4")
        shutil.copy2(output_mp4, frontend_reel_path)
        print(f"[REELS_AGENT] Synced vertical reel to frontend assets:\n--> {frontend_reel_path}")

        # Cleanup temporary audio & subtitle files
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
        if os.path.exists(temp_vtt):
            os.remove(temp_vtt)

        print(f"\n[REELS_AGENT] SUCCESS! Your 30s vertical reel is ready at:\n--> {output_mp4}\n")
        return output_mp4

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reels_agent.py <path_to_blog_json>")
        sys.exit(1)

    blog_path = sys.argv[1]
    agent = ReelsAgent()
    asyncio.run(agent.generate_reel(blog_path))
