import asyncio
from aivyuh import AivyuhSecurityTools

class MockParticipant:
    async def publish_data(self, payload, topic):
        pass

async def main():
    tools = AivyuhSecurityTools(MockParticipant())
    res = await tools.run_full_owasp_audit("bi")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
