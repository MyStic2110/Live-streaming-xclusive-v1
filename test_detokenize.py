import asyncio
import sys
import os

# Append python-agent to sys.path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__), "python-agent"))

from agents.bi.bi_agent import detokenize_stream

async def mock_stream():
    # Simulate LLM chunked output
    chunks = [
        "The email ",
        "address is: ",
        "nahx@op",
        "xrstn.jja_stx",
        ". ",
        "Please let me know if ",
        "you need anything else."
    ]
    for chunk in chunks:
        yield chunk
        await asyncio.sleep(0.01)

async def test():
    from integrations.securelytix import SecurelytixClient
    vault = SecurelytixClient()
    
    # 1. Generate a fresh token under the current API key
    res = await vault.tokenize({"value": "super_secret@test.com"})
    fresh_token = res.get("value")
    print(f"Generated fresh token: {fresh_token}")
    
    # 2. Mock the stream with the fresh token
    async def mock_stream():
        chunks = ["The email ", "address is: ", fresh_token[:5], fresh_token[5:], ". ", "Please let me know if ", "you need anything else."]
        import asyncio
        for chunk in chunks:
            yield chunk
            await asyncio.sleep(0.01)

    print("\nTesting detokenize_stream...")
    
    result = ""
    async for detokenized_chunk in detokenize_stream(mock_stream()):
        print(f"Received chunk: '{detokenized_chunk}'")
        result += detokenized_chunk
        
    print(f"\nFinal Assembled Text:\n{result}")

if __name__ == "__main__":
    asyncio.run(test())
