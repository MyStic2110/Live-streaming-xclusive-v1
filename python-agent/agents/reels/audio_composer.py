import os
import re
import asyncio
import edge_tts

class AudioComposer:
    def __init__(self, voice="en-US-GuyNeural"):
        self.voice = voice

    async def generate_narration(self, text: str, audio_path: str, vtt_path: str) -> list:
        """
        Synthesizes script text into an MP3 file and generates a corresponding VTT subtitle file.
        Returns a list of word boundary timings calculated using sentence timing distribution.
        """
        # Clean text
        text = text.strip()
        
        # Call edge-tts to synthesize audio and generate sentence-level subtitles
        communicate = edge_tts.Communicate(text, self.voice)
        await communicate.save(audio_path)
        
        # Run edge-tts CLI to generate the VTT file for precise sentence boundaries
        # We can run it programmatically or write it out.
        # Calling edge-tts command line directly is the most robust way to write subtitles.
        cmd = f'venv\\Scripts\\edge-tts.exe --voice {self.voice} --text "{text}" --write-subtitles "{vtt_path}" --write-media "{audio_path}"'
        proc = await asyncio.create_subprocess_shell(
            cmd,
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
