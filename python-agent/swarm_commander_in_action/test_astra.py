import os
import sys
import asyncio

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action.helpers import get_openai_client

# Define Astra's system prompt mock representing the core persona
SYSTEM_PROMPT = """You are Astra, an autonomous AI Growth Agent specialized in SEO, AEO, and AI-era content publishing.
STRATEGIC SPRINT:
You are currently on a 7-Day Content Growth Sprint.
PRIMARY OBJECTIVE:
Increase organic visibility, search rankings, AI search discoverability, engagement, and authority through consistent, high-quality content generation.
"""

async def run_test():
    try:
        client = get_openai_client()
        user_question = "What is your main objective and how do you achieve it?"
        
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
        
        # Verify Astra's persona and core topics (SEO, search authority, content growth) are mentioned
        has_keywords = any(kw in response_text.lower() for kw in ["seo", "aeo", "visibility", "search", "organic", "content", "growth"])
        if not has_keywords:
            return False, f"Astra response did not address growth/SEO/visibility keywords: {response_text}"
            
        return True, f"Success! Astra's response: {response_text.strip()}"
        
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
