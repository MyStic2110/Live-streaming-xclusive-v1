import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import (
    ImageClip,
    AudioFileClip,
    CompositeAudioClip,
    CompositeVideoClip,
    VideoClip
)

class VideoComposer:
    def __init__(self, width=1080, height=1920):
        self.width = width
        self.height = height
        # Use default Windows Bold font or standard fallback
        self.font_path = "C:\\Windows\\Fonts\\arialbd.ttf"
        if not os.path.exists(self.font_path):
            self.font_path = "arial.ttf" # Local directory fallback

    def create_gradient_bg(self, duration) -> ImageClip:
        """
        Creates a dark slate-to-indigo vertical gradient background clip.
        """
        w, h = self.width, self.height
        bg = Image.new("RGB", (w, h))
        draw = ImageDraw.Draw(bg)
        
        # Draw gradient
        for y in range(h):
            # Gradient transition from (17, 24, 39) slate-900 to (30, 27, 75) indigo-950
            r = int(17 + (30 - 17) * (y / h))
            g = int(24 + (27 - 24) * (y / h))
            b = int(39 + (75 - 39) * (y / h))
            draw.line([(0, y), (w, y)], fill=(r, g, b))

        # Add decorative grid lines or glowing borders
        draw.rectangle([20, 20, w - 20, h - 20], outline=(59, 130, 246, 50), width=2)
        
        # Save temp bg frame
        temp_bg_path = "scratch_temp_bg.png"
        bg.save(temp_bg_path)
        
        clip = ImageClip(temp_bg_path).with_duration(duration)
        return clip

    def create_scrolling_logs_overlay(self, duration) -> VideoClip:
        """
        Creates an overlay of scrolling terminal status logs for a futuristic swarm look.
        """
        log_lines = [
            "[SENTRY] system operational check OK",
            "[ASTRA] digesting content vectors...",
            "[CORTEX] BI intelligence link live",
            "[SENTRY] latency budget 380ms enforced",
            "[VONE] biometric verification active",
            "[ASTRA] script narration generated successfully",
            "[SENTRY] dynamic token cost tracking synced",
            "[REELS] compiling local open-source composition",
            "[SENTRY] cost transaction recorded: $0.0004",
            "[SWARM] all nodes in sync. ready for execution."
        ]

        def make_frame(t):
            img = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            try:
                font = ImageFont.truetype("C:\\Windows\\Fonts\\consola.ttf", 24)
            except:
                font = ImageFont.load_default()

            # Scrolling logic based on time t
            scroll_offset = int((t * 50) % 300)
            
            y_start = 250
            draw.text((60, y_start - 40), "SWARM LOG FEED // OPERATIONAL STATE", fill=(59, 130, 246, 180), font=font)
            draw.line([(60, y_start - 10), (900, y_start - 10)], fill=(59, 130, 246, 80), width=1)

            for i, line in enumerate(log_lines):
                y = y_start + (i * 35) - scroll_offset
                if y_start - 10 < y < 650:
                    # Fade out toward borders
                    alpha = int(255 * (1.0 - abs(y - 450) / 250))
                    alpha = max(0, min(255, alpha))
                    draw.text((80, y), line, fill=(16, 185, 129, alpha), font=font) # neon green

            # Renders a sleek header text
            try:
                header_font = ImageFont.truetype(self.font_path, 40)
            except:
                header_font = ImageFont.load_default()
            
            draw.text((60, 80), "SWARM INSIGHTS", fill=(255, 255, 255, 255), font=header_font)
            draw.text((60, 135), "DAY 5 // AUTONOMOUS REEL", fill=(59, 130, 246, 255), font=header_font)

            return np.array(img)

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def create_caption_overlay(self, word_timings, duration) -> VideoClip:
        """
        Pillow-based word-by-word dynamic kinetic caption overlay to bypass ImageMagick.
        """
        def make_frame(t):
            img = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            try:
                font = ImageFont.truetype(self.font_path, 54)
            except:
                font = ImageFont.load_default()

            # Find currently active word
            active_idx = -1
            for idx, wt in enumerate(word_timings):
                if wt["start"] <= t <= wt["end"]:
                    active_idx = idx
                    break

            if active_idx == -1:
                # If no word matches precisely, find the closest previous word
                for idx, wt in enumerate(word_timings):
                    if wt["start"] <= t:
                        active_idx = idx

            if active_idx != -1:
                # Get a window of 4 words (2 before, active, 1 after) to keep center aligned
                start_win = max(0, active_idx - 2)
                end_win = min(len(word_timings), start_win + 4)
                word_window = word_timings[start_win:end_win]
                
                # Render subtitle centered horizontally
                total_text_width = 0
                word_positions = []
                
                for wt in word_window:
                    w = wt["word"]
                    try:
                        bbox = draw.textbbox((0, 0), w, font=font)
                        w_width = bbox[2] - bbox[0]
                    except:
                        w_width = len(w) * 30
                    word_positions.append((w, w_width, wt == word_timings[active_idx]))
                    total_text_width += w_width + 20 # 20px word spacing

                # Draw subtitle background container
                y_pos = 1450
                draw.rounded_rectangle(
                    [self.width // 2 - total_text_width // 2 - 30, y_pos - 20, 
                     self.width // 2 + total_text_width // 2 + 30, y_pos + 80],
                    radius=15,
                    fill=(17, 24, 39, 200) # Dark gray glassmorphic pill
                )

                # Draw words
                current_x = self.width // 2 - total_text_width // 2
                for word, w_width, is_active in word_positions:
                    fill_color = (6, 182, 212, 255) if is_active else (255, 255, 255, 255) # Cyan if active, else White
                    draw.text((current_x, y_pos), word, fill=fill_color, font=font)
                    current_x += w_width + 20

            return np.array(img)

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def create_image_zoom_clip(self, img_path, duration) -> VideoClip:
        """
        Creates a centered image clip with a smooth Ken Burns scale zoom effect.
        """
        if not os.path.exists(img_path):
            print(f"[VIDEO] Warning: Visual asset {img_path} not found.")
            # Fallback black container
            return VideoClip(lambda t: np.zeros((540, 960, 3)), duration=duration)

        pil_img = Image.open(img_path).convert("RGBA")
        # Resize to fit vertical screen center nicely
        target_width = 900
        aspect_ratio = pil_img.height / pil_img.width
        target_height = int(target_width * aspect_ratio)
        pil_img_resized = pil_img.resize((target_width, target_height), Image.Resampling.LANCZOS)

        def make_frame(t):
            # Create a transparent overlay of full canvas size
            overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Linear Zoom Factor: scales from 1.0 to 1.15 over the video
            zoom = 1.0 + 0.15 * (t / duration)
            w_zoom = int(target_width * zoom)
            h_zoom = int(target_height * zoom)
            
            zoomed_img = pil_img_resized.resize((w_zoom, h_zoom), Image.Resampling.LANCZOS)
            
            # Crop to original resized dimensions to keep boundary clean
            dx = (w_zoom - target_width) // 2
            dy = (h_zoom - target_height) // 2
            cropped_img = zoomed_img.crop((dx, dy, dx + target_width, dy + target_height))
            
            # Draw premium drop shadow & glowing border around image container
            x_start = (self.width - target_width) // 2
            y_start = 750
            
            draw.rectangle(
                [x_start - 8, y_start - 8, x_start + target_width + 8, y_start + target_height + 8],
                outline=(59, 130, 246, 150), width=4 # glowing neon blue border
            )

            # Paste image in the center
            overlay.paste(cropped_img, (x_start, y_start))
            return np.array(overlay)

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def compile_reel(self, bg_img_path, voice_audio_path, word_timings, output_path):
        """
        Assembles all components into a vertical MP4 reel using MoviePy and FFmpeg.
        """
        print("[VIDEO] Loading voice audio track...")
        voice_audio = AudioFileClip(voice_audio_path)
        duration = voice_audio.duration

        print("[VIDEO] Creating visual assets...")
        bg_clip = self.create_gradient_bg(duration)
        log_clip = self.create_scrolling_logs_overlay(duration)
        img_clip = self.create_image_zoom_clip(bg_img_path, duration)
        caption_clip = self.create_caption_overlay(word_timings, duration)

        print("[VIDEO] Mixing audio tracks...")
        # Clean background audio mix (MoviePy supports mixing automatically)
        final_audio = CompositeAudioClip([voice_audio])
        
        print("[VIDEO] Composing full vertical video layers...")
        final_video = CompositeVideoClip([
            bg_clip,
            log_clip,
            img_clip,
            caption_clip
        ]).with_audio(final_audio)

        print(f"[VIDEO] Compiling final vertical reel to: {output_path}")
        final_video.write_videofile(
            output_path,
            fps=24,
            codec="libx264",
            audio_codec="aac",
            threads=4,
            logger='bar'
        )

        # Cleanup temporary background image
        if os.path.exists("scratch_temp_bg.png"):
            os.remove("scratch_temp_bg.png")

        print("[VIDEO] Compilation complete!")
