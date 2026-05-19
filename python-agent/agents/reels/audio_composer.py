import os
import re
import asyncio
import edge_tts

class AudioComposer:
    def __init__(self, voice="en-US-JennyNeural", rate="-14%"):
        self.voice = voice
        self.rate = rate  # Negative = slower, more breathing room between words

    async def generate_narration(self, text: str, audio_path: str, vtt_path: str) -> list:
        """
        Synthesizes script text into an MP3 file and generates a corresponding VTT subtitle file.
        Returns a list of word boundary timings calculated using sentence timing distribution.
        """
        # Clean text by removing all double quotes to prevent Windows CLI parsing crashes
        text = text.replace('"', '').strip()
        
        # Call edge-tts to synthesize audio — rate slowed for natural pacing
        communicate = edge_tts.Communicate(text, self.voice, rate=self.rate)
        await communicate.save(audio_path)
        
        # Resolve absolute path to edge-tts executable
        base_dir = os.path.dirname(os.path.abspath(__file__))
        edge_tts_path = os.path.abspath(os.path.join(base_dir, "..", "..", "venv", "Scripts", "edge-tts.exe"))
        
        if not os.path.exists(edge_tts_path):
            edge_tts_path = os.path.abspath(os.path.join(os.getcwd(), "venv", "Scripts", "edge-tts.exe"))
            
        if not os.path.exists(edge_tts_path):
            # Check global Python installation Scripts folder (e.g. Program Files)
            import sys
            edge_tts_path = os.path.join(os.path.dirname(sys.executable), "Scripts", "edge-tts.exe")
            
        if not os.path.exists(edge_tts_path):
            # Check User AppData Scripts folder dynamically across any Python versions
            import glob
            user_home = os.path.expanduser("~")
            candidates = glob.glob(os.path.join(user_home, "AppData", "Roaming", "Python", "Python*", "Scripts", "edge-tts.exe"))
            if candidates:
                edge_tts_path = candidates[0]
                
        if not os.path.exists(edge_tts_path):
            edge_tts_path = "edge-tts"

        proc = await asyncio.create_subprocess_exec(
            edge_tts_path,
            "--voice", self.voice,
            f"--rate={self.rate}",
            "--text", text,
            "--write-subtitles", vtt_path,
            "--write-media", audio_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()

        # Parse VTT file to calculate word boundaries
        return self.parse_vtt_to_word_timings(vtt_path)

    def parse_vtt_to_word_timings(self, vtt_path: str) -> list:
        """
        Parses a WebVTT file, extracts sentence blocks, and distributes timing
        evenly among words to generate precise word-by-word timestamps.
        """
        if not os.path.exists(vtt_path):
            print(f"[AUDIO] Warning: VTT file {vtt_path} not found.")
            return []

        with open(vtt_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Regex to parse WebVTT blocks
        # Example block:
        # 1
        # 00:00:00,050 --> 00:00:02,250
        # Astra is an autonomous agent.
        pattern = re.compile(
            r"(\d+)\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3}) --> (\d{2}):(\d{2}):(\d{2})[,.](\d{3})\n(.*?)(?=\n\n|\n*$)",
            re.DOTALL
        )

        word_timings = []

        def time_to_sec(h, m, s, ms):
            return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

        matches = pattern.findall(content)
        for match in matches:
            _, sh, sm, ss, sms, eh, em, es, ems, text = match
            start_sec = time_to_sec(sh, sm, ss, sms)
            end_sec = time_to_sec(eh, em, es, ems)
            duration = end_sec - start_sec
            
            # Clean and split words
            sentence_text = text.replace("\n", " ").strip()
            words = [w.strip() for w in sentence_text.split(" ") if w.strip()]
            
            if not words:
                continue

            # Distribute duration evenly among words
            word_duration = duration / len(words)
            for idx, word in enumerate(words):
                w_start = start_sec + (idx * word_duration)
                w_end = w_start + word_duration
                word_timings.append({
                    "word": word,
                    "start": round(w_start, 3),
                    "end": round(w_end, 3)
                })

        return word_timings
