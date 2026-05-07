import asyncio
import os
import sys
from dotenv import load_dotenv

# Add current dir to path to import lina
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from lina import EdgeTTS
except ImportError as e:
    print(f"Failed to import EdgeTTS from lina: {e}")
    sys.exit(1)

async def test_edge_tts():
    load_dotenv()
    
    print("Initializing EdgeTTS...")
    tts = EdgeTTS(voice="en-US-AvaNeural")
    
    print("Synthesizing 'Hello, this is a test from Edge TTS'...")
    try:
        stream = tts.synthesize("Hello, this is a test from Edge TTS")
        
        chunk_count = 0
        async for chunk in stream:
            chunk_count += 1
            if chunk_count == 1:
                print(f"Received first audio chunk! Frame size: {len(chunk.frame.data)} bytes")
        
        if chunk_count > 0:
            print(f"Test completed successfully. Received {chunk_count} chunks.")
        else:
            print("Test failed: No chunks received.")
            
    except Exception as e:
        print(f"TTS test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_edge_tts())
