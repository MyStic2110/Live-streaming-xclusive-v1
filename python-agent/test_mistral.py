import asyncio
import os
from dotenv import load_dotenv
from livekit.plugins import mistralai
from livekit.agents import llm

async def test_mistral():
    load_dotenv()
    
    llm_plugin = mistralai.LLM(model="mistral-small-latest")
    print("Sending chat request...")
    
    chat_ctx = llm.ChatContext(
        items=[llm.ChatMessage(role="user", content=["Say hello world in 3 words."])]
    )
    
    try:
        stream = llm_plugin.chat(chat_ctx=chat_ctx)
        async for chunk in stream:
            if chunk.delta.content:
                print(chunk.delta.content, end="", flush=True)
        print("\nRequest completed.")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_mistral())
