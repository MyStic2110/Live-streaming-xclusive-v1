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
from moviepy.audio.fx import AudioFadeOut

def wrap_text(text, max_chars=22):
    """Utility to wrap text cleanly by maximum character count."""
    words = text.split()
    lines = []
    current_line = []
    current_len = 0
    for word in words:
        if current_len + len(word) + 1 > max_chars:
            lines.append(" ".join(current_line))
            current_line = [word]
            current_len = len(word)
        else:
            current_line.append(word)
            current_len += len(word) + 1
    if current_line:
        lines.append(" ".join(current_line))
    return lines

class VideoComposer:
    def __init__(self, width=1080, height=1920):
        self.width = width
        self.height = height
        # Use default Windows Bold font or standard fallback
        self.font_path = "C:\\Windows\\Fonts\\arialbd.ttf"
        if not os.path.exists(self.font_path):
            self.font_path = "arial.ttf" # Local directory fallback

    def create_dynamic_grid_bg(self, duration) -> VideoClip:
        """
        Generates a beautiful slowly shifting slate-indigo gradient background
        with dynamic floating glowing particles to make the backdrop feel alive.
        """
        w, h = self.width, self.height
        
        def make_frame(t):
            # Slow color wave translation
            phase = t * 0.3
            b_shift = int(25 * np.sin(phase))
            g_shift = int(12 * np.cos(phase * 0.8))
            
            img = Image.new("RGB", (w, h))
            draw = ImageDraw.Draw(img)
            
            # Step by 6 pixels vertically to optimize MoviePy rendering speed significantly
            for y in range(0, h, 6):
                r = int(15 + (28 - 15) * (y / h))
                g = int(22 + (25 - 22 + g_shift) * (y / h))
                b = int(35 + (68 - 35 + b_shift) * (y / h))
                
                # Clip values securely to RGB boundaries
                r = max(0, min(255, r))
                g = max(0, min(255, g))
                b = max(0, min(255, b))
                
                draw.rectangle([0, y, w, y + 6], fill=(r, g, b))
                
            # Render a cyber grid layer (horizontal & vertical lines)
            grid_color = (59, 130, 246, 15) # very transparent blue
            for gx in range(100, w, 100):
                draw.line([(gx, 0), (gx, h)], fill=grid_color, width=1)
            for gy in range(100, h, 100):
                draw.line([(0, gy), (w, gy)], fill=grid_color, width=1)
                
            # Draw glowing floating constellation particles
            for i in range(16):
                # Deterministic math based on time t & node index
                seed_x = int((w * (i * 0.13 + t * 0.025)) % w)
                seed_y = int((h * (i * 0.19 + t * 0.015)) % h)
                
                size = int(8 + 5 * np.sin(t * 1.8 + i))
                alpha = int(110 + 90 * np.sin(t * 2.2 + i))
                alpha = max(0, min(255, alpha))
                
                # Outer glow ring
                draw.ellipse(
                    [seed_x - size - 4, seed_y - size - 4, seed_x + size + 4, seed_y + size + 4],
                    fill=(59, 130, 246, int(alpha * 0.3))
                )
                # Inner bright dot
                draw.ellipse(
                    [seed_x - size, seed_y - size, seed_x + size, seed_y + size],
                    fill=(6, 182, 212, alpha)
                )

            # Draw outer glow boundary border
            draw.rectangle([30, 30, w - 30, h - 30], outline=(59, 130, 246, 75), width=3)
            return np.array(img)
            
        clip = VideoClip(make_frame, duration=duration)
        return clip

    def create_header_overlay(self, duration, title="", category="") -> VideoClip:
        """
        Creates an elegant, glassmorphic card header containing a glowing category
        badge and a beautifully word-wrapped, anti-aliased title.
        """
        w, h = self.width, self.height
        category = (category or "SWARM TECH").upper()
        title = title or "Autonomous Swarm Intelligence"
        
        # Wrap title to avoid clipping
        title_lines = wrap_text(title, max_chars=22)
        
        def make_frame(t):
            img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            try:
                badge_font = ImageFont.truetype("C:\\Windows\\Fonts\\consola.ttf", 26)
                title_font = ImageFont.truetype(self.font_path, 46)
            except:
                badge_font = ImageFont.load_default()
                title_font = ImageFont.load_default()

            y_start = 100
            card_height = 290
            
            # 1. Draw modern Glassmorphic Card
            draw.rounded_rectangle(
                [60, y_start, w - 60, y_start + card_height],
                radius=24,
                fill=(17, 24, 39, 175), # Dark slate translucent
                outline=(59, 130, 246, 100), # Neon blue border
                width=2
            )
            
            # 2. Draw glowing Category Badge Pill
            badge_text = f" {category} "
            try:
                bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
                b_w = bbox[2] - bbox[0]
            except:
                b_w = len(badge_text) * 16
                
            draw.rounded_rectangle(
                [90, y_start + 35, 90 + b_w + 10, y_start + 80],
                radius=10,
                fill=(30, 58, 138, 220), # Deep solid blue
                outline=(6, 182, 212, 220), # Bright cyan border
                width=2
            )
            draw.text((95, y_start + 42), badge_text, fill=(6, 182, 212, 255), font=badge_font)
            
            # 3. Draw wrapped Title Lines
            for idx, line in enumerate(title_lines[:2]):
                draw.text(
                    (90, y_start + 105 + idx * 60), 
                    line, 
                    fill=(255, 255, 255, 255), 
                    font=title_font,
                    stroke_width=2,
                    stroke_fill=(0, 0, 0, 200)
                )
                
            return np.array(img)

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def create_image_card_clip(self, img_path, duration) -> VideoClip:
        """
        Creates a centered image clip inside a styled rounded card with drop shadows
        and a smooth Ken Burns scale zoom effect.
        Accepts either a single image path (str) or a list of image paths for slideshow mode.
        """
        # Delegate to slideshow if a list is passed
        if isinstance(img_path, list):
            return self.create_slideshow_clip(img_path, duration)

        if not os.path.exists(img_path):
            print(f"[VIDEO] Warning: Visual asset {img_path} not found.")
            return VideoClip(lambda t: np.zeros((self.height, self.width, 4)), duration=duration)

        pil_img = Image.open(img_path).convert("RGBA")
        
        # Dimensions matching a premium vertical layout
        target_width = 900
        aspect_ratio = pil_img.height / pil_img.width
        target_height = int(target_width * aspect_ratio)
        pil_img_resized = pil_img.resize((target_width, target_height), Image.Resampling.LANCZOS)

        def make_frame(t):
            overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Smooth scale zoom (1.0 to 1.12 over duration)
            zoom = 1.0 + 0.12 * (t / duration)
            w_zoom = int(target_width * zoom)
            h_zoom = int(target_height * zoom)
            
            zoomed_img = pil_img_resized.resize((w_zoom, h_zoom), Image.Resampling.LANCZOS)
            
            # Center-crop zoomed image
            dx = (w_zoom - target_width) // 2
            dy = (h_zoom - target_height) // 2
            cropped_img = zoomed_img.crop((dx, dy, dx + target_width, dy + target_height))
            
            # Create rounded card with transparent borders
            mask = Image.new("L", (target_width, target_height), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.rounded_rectangle([0, 0, target_width, target_height], radius=24, fill=255)
            
            rounded_card = Image.new("RGBA", (target_width, target_height))
            rounded_card.paste(cropped_img, (0, 0), mask=mask)
            
            x_start = (self.width - target_width) // 2
            y_start = 750
            
            # Draw premium glass border behind the image card
            draw.rounded_rectangle(
                [x_start - 6, y_start - 6, x_start + target_width + 6, y_start + target_height + 6],
                radius=28,
                fill=(0, 0, 0, 80),
                outline=(59, 130, 246, 120), # Cyan-blue outline
                width=3
            )

            # Paste card
            overlay.paste(rounded_card, (x_start, y_start), mask=rounded_card)
            return np.array(overlay)

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def create_slideshow_clip(self, img_paths: list, duration: float) -> VideoClip:
        """
        Creates a full-frame slideshow from multiple images with smooth crossfade
        transitions and a Ken Burns zoom effect per slide.
        Each slide fills the entire 1080x1920 canvas.
        """
        # Filter out missing files
        valid_paths = [p for p in img_paths if os.path.exists(p)]
        if not valid_paths:
            print("[VIDEO] Warning: No valid slide images found for slideshow.")
            return VideoClip(lambda t: np.zeros((self.height, self.width, 3)), duration=duration)

        n = len(valid_paths)
        slide_duration = duration / n          # seconds per slide
        crossfade = min(0.4, slide_duration * 0.2)  # 0.4s crossfade max

        print(f"[VIDEO] Slideshow: {n} slides × {slide_duration:.2f}s each, crossfade={crossfade:.2f}s")

        # Pre-load, crop-to-fill, and resize all slides to full canvas size (9:16 aspect ratio)
        w, h = self.width, self.height
        slides = []
        for p in valid_paths:
            img = Image.open(p).convert("RGB")
            
            # Crop to fill 9:16 aspect ratio
            img_w, img_h = img.size
            target_aspect = w / h  # 1080/1920 = 0.5625
            current_aspect = img_w / img_h
            
            if current_aspect > target_aspect:
                # Image is too wide (horizontal) - crop sides
                new_w = int(img_h * target_aspect)
                left = (img_w - new_w) // 2
                img = img.crop((left, 0, left + new_w, img_h))
            else:
                # Image is too tall (vertical) - crop top/bottom
                new_h = int(img_w / target_aspect)
                top = (img_h - new_h) // 2
                img = img.crop((0, top, img_w, top + new_h))
                
            img_resized = img.resize((w, h), Image.Resampling.LANCZOS)
            slides.append(np.array(img_resized))

        def make_frame(t):
            # Determine which slide we're on
            slide_idx = min(int(t / slide_duration), n - 1)
            time_in_slide = t - slide_idx * slide_duration

            # Ken Burns slow zoom per slide (1.0 → 1.06)
            zoom = 1.0 + 0.06 * (time_in_slide / slide_duration)
            cur = slides[slide_idx]
            zh = int(h * zoom)
            zw = int(w * zoom)
            zoomed = np.array(Image.fromarray(cur).resize((zw, zh), Image.Resampling.BILINEAR))
            dy = (zh - h) // 2
            dx = (zw - w) // 2
            frame = zoomed[dy:dy + h, dx:dx + w]

            # Crossfade into next slide near the end of current slide
            if slide_idx < n - 1 and time_in_slide > (slide_duration - crossfade):
                alpha = (time_in_slide - (slide_duration - crossfade)) / crossfade
                alpha = max(0.0, min(1.0, alpha))
                nxt = slides[slide_idx + 1]
                frame = (frame * (1 - alpha) + nxt * alpha).astype(np.uint8)

            # 1. Apply Chromatic Aberration (3px edge prism shift)
            r = np.roll(frame[:, :, 0], 3, axis=1)
            g = frame[:, :, 1]
            b = np.roll(frame[:, :, 2], -3, axis=1)
            frame_ca = np.stack([r, g, b], axis=2)

            # 2. Apply Dynamic Film Grain (random micro-noise)
            noise = np.random.randint(-6, 6, frame_ca.shape, dtype=np.int16)
            grained = np.clip(frame_ca.astype(np.int16) + noise, 0, 255).astype(np.uint8)

            return grained

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def create_kinetic_captions(self, word_timings, duration) -> VideoClip:
        """
        Pillow-based single-word + next-word karaoke kinetic caption engine.
        Applies a tactile pop scale transition and thick readable outlines.
        """
        def make_frame(t):
            img = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            try:
                base_font = ImageFont.truetype(self.font_path, 68)
            except:
                base_font = ImageFont.load_default()

            # Find active spoken word
            active_idx = -1
            for idx, wt in enumerate(word_timings):
                if wt["start"] <= t <= wt["end"]:
                    active_idx = idx
                    break

            if active_idx == -1:
                for idx, wt in enumerate(word_timings):
                    if wt["start"] <= t:
                        active_idx = idx

            if active_idx != -1:
                active_wt = word_timings[active_idx]
                w_start = active_wt["start"]
                
                # Pop scale factor: bounces to 1.25x and settles back in 0.15 seconds
                time_into_word = t - w_start
                pop_factor = 1.0
                if 0 <= time_into_word < 0.15:
                    pop_factor = 1.25 - 0.25 * (time_into_word / 0.15)
                
                active_word = active_wt["word"].upper()
                next_word = ""
                if active_idx + 1 < len(word_timings):
                    next_word = word_timings[active_idx + 1]["word"].upper()

                # Dynamic sizing for active popping word
                active_font_size = int(84 * pop_factor)
                try:
                    a_font = ImageFont.truetype(self.font_path, active_font_size)
                    a_bbox = draw.textbbox((0, 0), active_word, font=a_font)
                    a_w = a_bbox[2] - a_bbox[0]
                    a_h = a_bbox[3] - a_bbox[1]
                except:
                    a_w = len(active_word) * 45
                    a_h = 75
                    a_font = base_font

                y_pos = 1480
                
                if next_word:
                    # Space out active word and next word (karaoke flow)
                    try:
                        n_bbox = draw.textbbox((0, 0), next_word, font=base_font)
                        n_w = n_bbox[2] - n_bbox[0]
                        n_h = n_bbox[3] - n_bbox[1]
                    except:
                        n_w = len(next_word) * 35
                        n_h = 60

                    spacing = 50
                    total_w = a_w + n_w + spacing
                    start_x = (self.width - total_w) // 2
                    
                    # 1. Spoken Word (Popping Energetic Gold)
                    draw.text(
                        (start_x, y_pos - a_h // 2), 
                        active_word, 
                        fill=(255, 230, 0, 255), 
                        font=a_font,
                        stroke_width=7,
                        stroke_fill=(0, 0, 0, 255)
                    )
                    
                    # 2. Next Spoken Word (Semi-transparent white)
                    draw.text(
                        (start_x + a_w + spacing, y_pos - n_h // 2), 
                        next_word, 
                        fill=(255, 255, 255, 150), 
                        font=base_font,
                        stroke_width=5,
                        stroke_fill=(0, 0, 0, 255)
                    )
                else:
                    # Single final word centered
                    start_x = (self.width - a_w) // 2
                    draw.text(
                        (start_x, y_pos - a_h // 2), 
                        active_word, 
                        fill=(255, 230, 0, 255), 
                        font=a_font,
                        stroke_width=7,
                        stroke_fill=(0, 0, 0, 255)
                    )

            return np.array(img)

        clip = VideoClip(make_frame, duration=duration)
        return clip

    def compile_reel(self, bg_img_path, voice_audio_path, word_timings, output_path, title="", category="", bg_music_path=None):
        """
        Synthesizes all layers into a stunning high-fidelity vertical MP4 reel using MoviePy and FFmpeg.
        bg_img_path can be a single image path (str) or a list of image paths for a slideshow reel.
        When a list is provided, slides fill the full canvas with crossfade transitions (no static bg needed).
        If bg_music_path is provided, it is looped/subclipped, volume-scaled, faded, and mixed with the voice narration.
        """
        print("[VIDEO] Loading voice audio track...")
        voice_audio = AudioFileClip(voice_audio_path)
        duration = voice_audio.duration

        print("[VIDEO] Rendering premium visual layers...")

        slideshow_mode = isinstance(bg_img_path, list) and len(bg_img_path) > 1

        if slideshow_mode:
            # Full-canvas slideshow — no separate background or image card overlay needed
            print(f"[VIDEO] Slideshow mode: {len(bg_img_path)} slides detected.")
            slide_clip = self.create_slideshow_clip(bg_img_path, duration)
            caption_clip = self.create_kinetic_captions(word_timings, duration)

            print("[VIDEO] Mixing audio tracks...")
            audio_clips = [voice_audio]
            if bg_music_path and os.path.exists(bg_music_path):
                try:
                    # Load, adjust volume to 8% to prevent overtaking narration, apply 1.5s fadeout
                    bg_music = AudioFileClip(bg_music_path).subclipped(0, duration).with_volume_scaled(0.08).with_effects([AudioFadeOut(1.5)])
                    audio_clips.append(bg_music)
                    print("[VIDEO] Ambient background music track mixed successfully.")
                except Exception as ex:
                    print(f"[VIDEO] Warning: Failed to mix background music track ({ex})")

            final_audio = CompositeAudioClip(audio_clips)

            print("[VIDEO] Composing slideshow vertical video layers...")
            final_video = CompositeVideoClip([
                slide_clip,
                caption_clip
            ]).with_audio(final_audio)
        else:
            # Single image mode (original behaviour)
            bg_clip = self.create_dynamic_grid_bg(duration)
            header_clip = self.create_header_overlay(duration, title=title, category=category)
            img_clip = self.create_image_card_clip(bg_img_path, duration)
            caption_clip = self.create_kinetic_captions(word_timings, duration)

            print("[VIDEO] Mixing audio tracks...")
            audio_clips = [voice_audio]
            if bg_music_path and os.path.exists(bg_music_path):
                try:
                    bg_music = AudioFileClip(bg_music_path).subclipped(0, duration).with_volume_scaled(0.08).with_effects([AudioFadeOut(1.5)])
                    audio_clips.append(bg_music)
                    print("[VIDEO] Ambient background music track mixed successfully.")
                except Exception as ex:
                    print(f"[VIDEO] Warning: Failed to mix background music track ({ex})")

            final_audio = CompositeAudioClip(audio_clips)

            print("[VIDEO] Composing full vertical video layers...")
            final_video = CompositeVideoClip([
                bg_clip,
                header_clip,
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

        print("[VIDEO] Compilation complete!")

    def compile_face_reel(self, avatar_clip, voice_audio_path, word_timings, output_path, title="", category=""):
        """
        Synthesizes layers into a vertical MP4 reel featuring an animated talking face avatar.
        """
        print("[VIDEO] Loading voice audio track...")
        voice_audio = AudioFileClip(voice_audio_path)
        duration = voice_audio.duration

        print("[VIDEO] Rendering premium visual layers...")
        bg_clip = self.create_dynamic_grid_bg(duration)
        header_clip = self.create_header_overlay(duration, title=title, category=category)
        
        # Position the avatar clip nicely in the center/upper-center
        avatar_positioned = avatar_clip.with_position(("center", 600)).with_duration(duration)
        
        caption_clip = self.create_kinetic_captions(word_timings, duration)

        print("[VIDEO] Mixing audio tracks...")
        final_audio = CompositeAudioClip([voice_audio])
        
        print("[VIDEO] Composing full vertical video layers (with Face Avatar)...")
        final_video = CompositeVideoClip([
            bg_clip,
            header_clip,
            avatar_positioned,
            caption_clip
        ]).with_audio(final_audio)

        print(f"[VIDEO] Compiling final vertical face reel to: {output_path}")
        final_video.write_videofile(
            output_path,
            fps=24,
            codec="libx264",
            audio_codec="aac",
            threads=4,
            logger='bar'
        )

        print("[VIDEO] Compilation complete!")

