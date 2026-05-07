import asyncio
import os
from dotenv import load_dotenv
from livekit.plugins import mistralai

load_dotenv()

async def test_stt():
    print("Testing Mistral STT initialization...")
    try:
        stt = mistralai.STT(model="voxtral-mini-latest")
        print("Mistral STT initialized successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_stt())
