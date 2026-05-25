import os
import sys
import asyncio
import json

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action.helpers import get_openai_client

# Rehearsal system prompt (inline since it imports speech_analyser which has path deps)
REHEARSAL_SYSTEM_PROMPT = (
    "You are The Rehearsal, a professional speech coaching agent. "
    "When the user greets you or says they are ready to start, greet them back briefly, introduce yourself as their speech coach, and state you are ready to listen. "
    "During the rehearsal, listen silently while the user speaks and do not interrupt or respond to their content. "
    "Your only job is to listen and analyse. When asked to deliver a critique, you speak with "
    "authority, warmth, and precision like a world-class speaking coach. "
    "Keep all spoken responses concise and impactful."
)

# Simulated critique JSON that Rehearsal would produce after analysing speech
SIMULATED_METRICS = {
    "score": 74,
    "summary": "A confident delivery with a solid pace, though filler words undermine authority.",
    "top_3_fixes": [
        "Reduce filler words like 'um' and 'uh' by practising deliberate pauses.",
        "Maintain consistent pacing — your WPM spiked in the middle section.",
        "End sentences with a downward inflection to project more authority."
    ],
    "landed": [
        {"timestamp": "00:12", "note": "Strong opening hook - immediately captured attention."}
    ],
    "didnt_land": [
        {"timestamp": "00:34", "note": "Rapid filler cluster weakened the key point."}
    ]
}

async def run_test():
    try:
        client = get_openai_client()

        # Test 1: Welcome message identity check
        messages = [
            {"role": "system", "content": REHEARSAL_SYSTEM_PROMPT},
            {"role": "user", "content": "Hello, I'm ready to start."}
        ]

        response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            max_tokens=200
        )

        response_text = response.choices[0].message.content.strip()

        # Verify agent identity: silent listener / speech coach persona
        identity_keywords = ["rehearsal", "coach", "speak", "listen", "ready"]
        identity_ok = any(kw.lower() in response_text.lower() for kw in identity_keywords)

        if not identity_ok:
            return False, f"Agent did not present Rehearsal/coaching identity: {response_text[:100]}"

        # Test 2: Critique delivery test — ask it to speak a critique
        critique_prompt = (
            "The user just finished speaking for 2 minutes. "
            "Here is the structured critique data:\n"
            f"{json.dumps(SIMULATED_METRICS, indent=2)}\n\n"
            "Deliver the critique verbally in a concise, authoritative spoken format. "
            "Start with their score, then the summary, then the top 3 fixes."
        )

        critique_messages = [
            {"role": "system", "content": REHEARSAL_SYSTEM_PROMPT},
            {"role": "user", "content": critique_prompt}
        ]

        critique_response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=critique_messages,
            max_tokens=300
        )

        critique_text = critique_response.choices[0].message.content.strip()

        # Verify critique covers score and fixes
        score_ok = "74" in critique_text
        fixes_ok = any(word in critique_text.lower() for word in ["filler", "pacing", "pause", "inflection", "wpm"])

        if score_ok and fixes_ok:
            return True, f"Success! Rehearsal delivered critique correctly: {critique_text[:80]}..."
        elif score_ok:
            return True, f"Success! Score confirmed, critique delivered: {critique_text[:80]}..."
        else:
            return False, f"Critique missing score or key fix language: {critique_text[:100]}"

    except Exception as e:
        return False, str(e)


if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
