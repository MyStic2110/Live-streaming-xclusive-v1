import os
import sys
import asyncio

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action.helpers import get_openai_client
from agents.seva.seva import build_system_prompt

async def run_test():
    try:
        client = get_openai_client()
        system_prompt = build_system_prompt()
        
        # Test 1: Booking request should trigger request for phone number first
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "I need to book a plumber for tomorrow morning."}
        ]
        
        response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            max_tokens=150
        )
        
        response_text = response.choices[0].message.content
        
        # According to SEVA conversation rules: "ALWAYS ask for the user's phone number first before booking anything."
        has_phone_request = any(kw in response_text.lower() for kw in ["phone", "number", "contact", "mobile", "no.", "फ़ोन", "नंबर"])
        if not has_phone_request:
            return False, f"SEVA did not request the user's phone number first: {response_text}"
            
        return True, f"Success! SEVA correctly asked for phone number: {response_text.strip()}"
        
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
