import asyncio
import sys
import os

from aivyuh import AivyuhSecurityTools

class MockParticipant:
    async def publish_data(self, payload, topic):
        # Decode the JSON payload to show what the UI would see
        import json
        data = json.loads(payload.decode('utf-8'))
        print(f"[UI DASHBOARD] {data['level'].upper()}: {data['message']}")

async def main():
    tools = AivyuhSecurityTools(MockParticipant())
    agents_to_scan = [
        "devopsgeni", "martech", "nova", "octane", "reels", 
        "rehearsal", "seva", "shadow_agent", "vision", "weather_agent"
    ]
    
    for agent in agents_to_scan:
        print("\n" + "="*50)
        print(f"RUNNING FULL OWASP SCAN ON: {agent}")
        print("="*50 + "\n")
        res = await tools.run_full_owasp_audit(agent)
        print(res)

if __name__ == "__main__":
    asyncio.run(main())
