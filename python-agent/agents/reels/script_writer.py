"""
ScriptWriter: LLM-powered 30-second vertical reel narration engine.

Uses OpenRouter to generate a human, narrative-driven script that:
  - Opens with the current market trend as a hook
  - Explains the real pain point clearly
  - Shows how Swarm solves it in simple language
  - Closes with a compelling CTA
"""
import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# Best model for creative, conversational short-form copy
SCRIPT_MODEL = "mistralai/mistral-nemo"  # Fast, creative, cost-effective


async def generate_reel_script(blog_data: dict) -> str:
    """
    Calls OpenRouter with the blog content and returns a punchy, narrative-driven
    30-second (≤80 words) reel script. Falls back to heuristic extraction on failure.
    """
    title = blog_data.get("title", "")
    excerpt = blog_data.get("excerpt", "")
    content = blog_data.get("content", "")[:2000]  # Limit input context

    system_prompt = """You are an expert short-form video scriptwriter specializing in 
AI and tech content for YouTube Shorts and Instagram Reels. Your scripts are:
- Conversational and energetic, never robotic or academic
- Structured logically: Hook → Trend → Pain Point → Swarm Solution → CTA
- Maximum 80 words (strict 30-second limit at natural speaking pace)
- Written in first-person plural "we" or second-person "you"
- Always mention how Swarm (an autonomous AI agent platform) solves the problem simply
- Highly paced with natural punctuation (like commas, periods, and ellipses) to create natural breathing pauses for the speaker.

CRITICAL: Write ONLY the spoken narration text. Never output structural labels like "Hook:", "[Hook]", "Trend:", "Pain Point:", "CTA:", or "Swarm Solution:". Just output pure flowing sentences that a human would say aloud."""

    user_prompt = f"""Write a 30-second YouTube Shorts narration script for this blog post.

TITLE: {title}
EXCERPT: {excerpt}
CONTENT PREVIEW:
{content}

SCRIPT STRUCTURE TO FOLLOW SILENTLY:
1. HOOK (first 3-5 seconds): Start with a bold trend statement or surprising fact that grabs attention immediately.
2. TREND (5-8 seconds): Describe what is currently shifting in the AI/tech landscape right now in 2026.
3. PAIN POINT (5-8 seconds): What is the exact bottleneck or problem businesses face today?
4. SWARM SOLUTION (10-12 seconds): How does Swarm's autonomous agent platform solve this simply and elegantly? Use plain language - no jargon.
5. CTA (3-5 seconds): End with "Build your first agent at Swarm dot ai" or similar compelling close.

CRITICAL RULES:
- Maximum 80 words total
- NEVER include labels like "Hook:", "[Hook]", "Trend:", "Pain Point:", "CTA:", or "Swarm Solution:". Just write the spoken script directly.
- Use commas, periods, and ellipses (e.g., "...") to insert natural breathing pauses.
- Sound like a real human creator, not a corporate press release
- Mention "Swarm" by name at least once in the solution
- Do NOT use bullet points, headers, or markdown - just flowing spoken sentences
- Make it feel urgent and exciting"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://swarm.ai",
                    "X-Title": "Swarm Reels Agent"
                },
                json={
                    "model": SCRIPT_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.85,
                    "max_tokens": 200
                }
            )

            if response.status_code == 200:
                data = response.json()
                script = data["choices"][0]["message"]["content"].strip()

                # Strip markdown (bold/italic) — TTS will speak asterisks literally otherwise
                import re
                script = re.sub(r"\*+", "", script)           # Remove ** and *
                script = re.sub(r"#+\s*", "", script)          # Remove # headers
                script = script.strip().strip('"')             # Strip surrounding quotes

                # Aggressively strip any structural labels (e.g. [Hook], Hook:, **CTA** -, etc.) anywhere in the script
                # Safely requires brackets, a colon, a dash, or line start to prevent stripping actual vocabulary words.
                label_pattern = re.compile(
                    r"(?:\[|\()?\s*(?:hook|trend|pain\s*point|pain|swarm\s*solution|solution|cta|call\s*to\s*action)\s*(?:\]|\))?\s*[:\-–]+\s*|"
                    r"(?:\[|\()+\s*(?:hook|trend|pain\s*point|pain|swarm\s*solution|solution|cta|call\s*to\s*action)\s*(?:\]|\))+\s*|"
                    r"^\s*(?:hook|trend|pain\s*point|pain|swarm\s*solution|solution|cta|call\s*to\s*action)\s*[:\-–]?\s*",
                    re.IGNORECASE | re.MULTILINE
                )
                script = label_pattern.sub("", script)

                # Collapse multiple newlines/spaces into single space (flatten to one paragraph) and remove all quotes
                script = re.sub(r"[\r\n]+", " ", script)
                script = script.replace('"', '').strip()
                script = re.sub(r"\s{2,}", " ", script)

                # Enforce 80-word hard cap
                words = script.split()
                if len(words) > 80:
                    script = " ".join(words[:80]) + "."

                print(f"[SCRIPT_WRITER] OK LLM script generated ({len(script.split())} words)")
                return script
            else:
                print(f"[SCRIPT_WRITER] WARN OpenRouter returned {response.status_code}: {response.text}")

    except Exception as e:
        print(f"[SCRIPT_WRITER] WARN LLM call failed: {e}")

    # Heuristic fallback (original logic)
    return _heuristic_fallback(blog_data)


def _heuristic_fallback(blog_data: dict) -> str:
    """Original regex-based key point extractor as a safe fallback."""
    import re
    title = blog_data.get("title", "")
    excerpt = blog_data.get("excerpt", "")
    content = blog_data.get("content", "")

    key_points = re.findall(r"\[Key Point\]:?\s*(.*?)(?=\n|\\n|$)", content)
    if not key_points:
        return f"The future of AI is autonomous. Today we explore {title}. {excerpt} Swarm makes it easy to build your first agent. Start today."

    cleaned = [kp.replace("**", "").replace("*", "").strip()
               for kp in key_points if len(kp.replace("**", "").strip().split()) > 5]

    script_parts = [f"The AI landscape is shifting. Here's what you need to know about {title}."]
    for kp in cleaned[:2]:
        script_parts.append(kp)
    script_parts.append("Swarm makes it simple to build agents that handle this for you. Visit Swarm dot ai to get started.")

    script = " ".join(script_parts)
    words = script.split()
    if len(words) > 80:
        script = " ".join(words[:80]) + "."
    return script
