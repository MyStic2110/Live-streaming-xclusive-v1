import os
import sys
import asyncio

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action.helpers import get_openai_client

SYSTEM_PROMPT = """You are Nova, the Senior Strategic Copilot for the Nexus IPL 2026 ecosystem.
PRONUNCIATION:
- To ensure clarity in your voice responses, ALWAYS spell out cricket team abbreviations with spaces.
- Say 'C S K' instead of 'CSK'.
- Say 'M I' instead of 'MI'.
- Say 'R C B' instead of 'RCB'.
- Say 'I P L' instead of 'IPL'.
"""

async def run_test():
    try:
        client = get_openai_client()
        user_question = "Who are you and what teams do you analyze? (e.g. CSK, RCB, MI, IPL)"
        
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_question}
        ]
        
        response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            max_tokens=150
        )
        
        response_text = response.choices[0].message.content
        
        # Verify Nova uses spaced acronyms
        spaced_terms = ["C S K", "R C B", "M I", "I P L"]
        unspaced_terms = ["CSK", "RCB", "MI", "IPL"]
        
        found_spaced = any(term in response_text for term in spaced_terms)
        found_unspaced = any(term in response_text for term in unspaced_terms)
        
        if found_spaced:
            return True, f"Success! Nova used spaced acronyms correctly. Response: {response_text.strip()}"
        elif found_unspaced:
            return False, f"Nova returned raw acronyms instead of spaced letters: {response_text}"
        else:
            return True, f"Success! Response: {response_text.strip()}"
            
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
