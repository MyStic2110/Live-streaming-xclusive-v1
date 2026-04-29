import asyncio
import os
from dotenv import load_dotenv
from livekit.plugins import mistralai

load_dotenv()

async def test_tts():
    try:
        tts = mistralai.TTS(voice="en_paul_neutral")
        print("Generating audio...")
        stream = tts.synthesize("Hello, this is a test.")

        async for chunk in stream:
            print("Got audio chunk")
            break
            
        print("Test completed successfully.")
    except Exception as e:
        print("TTS test failed:", e)

if __name__ == "__main__":
    asyncio.run(test_tts())
