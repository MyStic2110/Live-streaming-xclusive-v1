import os
import numpy as np
from PIL import Image, ImageDraw
from moviepy import ImageClip, VideoClip, AudioFileClip
import math

class AvatarHelper:
    def __init__(self, fallback_image_path):
        self.fallback_image_path = fallback_image_path

    def generate_avatar_image(self, prompt: str) -> str:
        """
        Selects a random high-quality photorealistic influencer avatar from the influencers folder.
        """
        import random
        base_dir = os.path.dirname(os.path.abspath(__file__))
        influencers_dir = os.path.join(base_dir, "influencers")
        
        if os.path.exists(influencers_dir):
            images = [os.path.join(influencers_dir, f) for f in os.listdir(influencers_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            if images:
                selected_avatar = random.choice(images)
                print(f"[AVATAR_HELPER] Randomly selected photorealistic influencer avatar: {selected_avatar}")
                return selected_avatar
                
        print(f"[AVATAR_HELPER] Fallback: using local high-quality avatar: {self.fallback_image_path}")
        return self.fallback_image_path

    def create_wav2lip_avatar(self, image_path: str, audio_path: str) -> VideoClip:
        """
        Runs the open-source Wav2Lip model locally on the CPU to generate a high-quality 
        deepfake talking head. This will take significantly longer on CPU.
        """
        import subprocess
        import sys
        
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Avatar image not found: {image_path}")
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        print("[AVATAR_HELPER] Launching Wav2Lip Deepfake Engine (Warning: This may take 30-60 minutes on CPU)...")
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        wav2lip_dir = os.path.join(base_dir, "Wav2Lip")
        output_mp4 = os.path.join(base_dir, "temp_wav2lip_output.mp4")
        
        # Build command for Wav2Lip inference.py
        inference_script = os.path.join(wav2lip_dir, "inference.py")
        checkpoint = os.path.join(wav2lip_dir, "checkpoints", "wav2lip_gan.pth")
        
        command = [
            sys.executable, inference_script,
            "--checkpoint_path", checkpoint,
            "--face", image_path,
            "--audio", audio_path,
            "--outfile", output_mp4,
            "--pads", "0", "20", "0", "0"  # padding to include chin
        ]
        
        # Run inference
        try:
            result = subprocess.run(command, cwd=wav2lip_dir, check=True, capture_output=True, text=True)
            print("[AVATAR_HELPER] Wav2Lip rendering complete!")
        except subprocess.CalledProcessError as e:
            print(f"[AVATAR_HELPER] ERROR running Wav2Lip:")
            print(e.stderr)
            raise RuntimeError("Wav2Lip failed to generate the lip-sync video.")
            
        if not os.path.exists(output_mp4):
            raise FileNotFoundError("Wav2Lip finished but output file was not found.")
            
        print("[AVATAR_HELPER] Loading Wav2Lip result into VideoClip...")
        # Load the generated deepfake
        from moviepy import VideoFileClip
        clip = VideoFileClip(output_mp4)
        
        return clip

if __name__ == "__main__":
    # Test script standalone
    print("AvatarHelper is ready.")
