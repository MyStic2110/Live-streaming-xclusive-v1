import asyncio
import os
from dotenv import load_dotenv
from livekit.plugins import mistralai
from livekit import rtc

load_dotenv()

async def test_stt():
    print("Testing Mistral STT API call...")
    try:
        stt = mistralai.STT(model="voxtral-mini-latest")
        
        # Create a dummy silent audio frame to trigger the API
        frame = rtc.AudioFrame(
            data=bytes(24000 * 2), # 1 second of 16-bit silence
            sample_rate=24000,
            num_channels=1,
            samples_per_channel=24000
        )
        
        stream = stt.stream()
        stream.push_frame(frame)
        stream.end_input()
        
        print("Waiting for response...")
        async for event in stream:
            print(f"Got event: {event}")
            
        print("Test finished successfully!")
    except Exception as e:
        print(f"Mistral STT Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_stt())
