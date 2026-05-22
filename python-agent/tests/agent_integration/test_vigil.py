import os
import sys
import asyncio

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from tests.agent_integration.helpers import get_openai_client
from agents.vigil.vigil import SYSTEM_PROMPT

async def run_test():
    try:
        client = get_openai_client()
        # Since Vigil is strictly instructed to start the call with the greeting when the user connects:
        # We test that the system prompt produces that exact greeting.
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Hello"}
        ]
        
        response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            max_tokens=150
        )
        
        response_text = response.choices[0].message.content
        
        # Verify greeting conforms to audit prompt
        if "Senior Cybersecurity Auditor" in response_text and "Incident Response maturity assessment" in response_text:
            return True, f"Success! Vigil's greeting: {response_text.strip()}"
        else:
            return False, f"Greeting did not contain cybersecurity auditor branding: {response_text}"
            
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
