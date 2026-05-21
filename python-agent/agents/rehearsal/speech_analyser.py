import time
import re
import logging
from statistics import stdev

FILLER_WORDS = {"um", "uh", "like", "you know", "so", "basically", "literally", "right", "okay"}

logger = logging.getLogger("speech_analyser")
logger.setLevel(logging.INFO)


class SpeechAnalyser:
    def __init__(self):
        self.segments = []       # [{"text", "start", "end", "words"}]
        self.pauses = []         # [float]  pause durations in seconds
        self.filler_hits = []    # [{"word", "timestamp"}]
        self.session_start = time.time()
        self._last_final_end = None
        self._interim_started = False
        logger.info("[ANALYSER] SpeechAnalyser initialized.")

    # -- Called when first interim word arrives (signals start of new utterance)
    def on_interim_start(self, timestamp: float):
        if self._last_final_end is not None and not self._interim_started:
            pause = timestamp - self._last_final_end
            if pause > 0.4:
                self.pauses.append(round(pause, 2))
                logger.info(f"[ANALYSER] Detected silence pause: {pause:.2f}s")
        self._interim_started = True

    # -- Called on every final STT segment
    def on_final(self, text: str, start_time: float, end_time: float):
        text = text.strip()
        if not text:
            return
        words = text.split()
        word_count = len(words)

        # Filler detection
        text_lower = text.lower()
        new_fillers = []
        for filler in FILLER_WORDS:
            pattern = r'\b' + re.escape(filler) + r'\b'
            hits = re.findall(pattern, text_lower)
            for _ in hits:
                self.filler_hits.append({"word": filler, "timestamp": start_time})
                new_fillers.append(filler)

        self.segments.append({
            "text": text,
            "start": start_time,
            "end": end_time,
            "words": word_count
        })
        logger.info(f"[ANALYSER] on_final segment appended: words={word_count}, fillers_found={new_fillers}")
        self._last_final_end = end_time
        self._interim_started = False

    # -- Metrics ----------------------------------------------------------------

    def total_words(self) -> int:
        return sum(s["words"] for s in self.segments)

    def elapsed(self) -> float:
        return time.time() - self.session_start

    def wpm(self) -> float:
        """Rolling WPM over the last 30 seconds of spoken segments."""
        now = time.time()
        cutoff = now - 30
        recent = [s for s in self.segments if s["end"] >= cutoff]
        if not recent:
            return 0.0
        words = sum(s["words"] for s in recent)
        duration = recent[-1]["end"] - recent[0]["start"]
        if duration <= 0:
            return 0.0
        calculated_wpm = round((words / duration) * 60, 1)
        logger.debug(f"[ANALYSER] Calculated WPM={calculated_wpm} (words={words}, duration={duration:.2f}s)")
        return calculated_wpm

    def filler_ratio(self) -> float:
        total = self.total_words()
        if total == 0:
            return 0.0
        ratio = round(len(self.filler_hits) / total * 100, 1)
        logger.debug(f"[ANALYSER] Calculated filler ratio={ratio}% (fillers={len(self.filler_hits)}, words={total})")
        return ratio

    def longest_pause(self) -> float:
        return round(max(self.pauses), 1) if self.pauses else 0.0

    def pace_wobble(self) -> str:
        if len(self.segments) < 3:
            return "calibrating"
        chunk_wpms = []
        for seg in self.segments:
            dur = seg["end"] - seg["start"]
            if dur > 0:
                chunk_wpms.append((seg["words"] / dur) * 60)
        if len(chunk_wpms) < 2:
            return "stable"
        try:
            sd = stdev(chunk_wpms)
        except Exception:
            return "stable"
        if sd < 20:
            wobble = "stable"
        elif sd < 45:
            wobble = "moderate"
        else:
            wobble = "erratic"
        logger.debug(f"[ANALYSER] Calculated pace wobble: std_dev={sd:.2f} -> {wobble}")
        return wobble

    def snapshot(self) -> dict:
        snap = {
            "wpm": self.wpm(),
            "filler_ratio": self.filler_ratio(),
            "filler_count": len(self.filler_hits),
            "longest_pause": self.longest_pause(),
            "pace_wobble": self.pace_wobble(),
            "total_words": self.total_words(),
            "elapsed": round(self.elapsed()),
        }
        logger.info(f"[ANALYSER] Snapshot taken: {snap}")
        return snap

    def full_transcript(self) -> str:
        lines = []
        for seg in self.segments:
            ts = self._fmt_ts(seg["start"])
            lines.append(f"[{ts}] {seg['text']}")
        return "\n".join(lines)

    def critique_prompt(self) -> str:
        snap = self.snapshot()
        filler_bd = {}
        for f in self.filler_hits:
            filler_bd[f["word"]] = filler_bd.get(f["word"], 0) + 1
        filler_str = ", ".join(f"{k}: {v}" for k, v in filler_bd.items()) or "none"

        prompt = f"""You are a world-class speech coach. Analyse this speech session and respond ONLY in valid JSON with no markdown fences.

TRANSCRIPT (with timestamps):
{self.full_transcript()}

METRICS:
- Duration: {snap['elapsed']}s
- Average WPM: {snap['wpm']} (ideal: 130-150)
- Filler Words: {snap['filler_count']} total ({filler_str})
- Filler Ratio: {snap['filler_ratio']}%
- Longest Pause: {snap['longest_pause']}s
- Pace Consistency: {snap['pace_wobble']}
- Total Words: {snap['total_words']}

Respond ONLY with this exact JSON (no extra text, no markdown):
{{
  "score": <integer 0-100>,
  "summary": "<one sentence overall impression>",
  "top_3_fixes": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "landed": [{{"timestamp": "<MM:SS>", "note": "<what worked>"}}],
  "didnt_land": [{{"timestamp": "<MM:SS>", "note": "<what didn't work>"}}]
}}"""
        logger.info("[ANALYSER] Generated critique prompt for LLM.")
        return prompt

    def tts_critique(self, critique: dict) -> str:
        score = critique.get("score", 0)
        summary = critique.get("summary", "")
        fixes = critique.get("top_3_fixes", [])
        lines = [f"Session complete. Your score is {score} out of 100. {summary}"]
        if fixes:
            lines.append("Your three biggest areas to fix are:")
            for i, fix in enumerate(fixes, 1):
                lines.append(f"{i}. {fix}")
        return " ".join(lines)

    def _fmt_ts(self, seconds: float) -> str:
        m = int(seconds // 60)
        s = int(seconds % 60)
        return f"{m:02d}:{s:02d}"
