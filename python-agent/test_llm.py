import asyncio
import os
from dotenv import load_dotenv
from livekit.plugins import mistralai
from livekit.agents import llm

load_dotenv()

async def test_llm():
    print("Testing Mistral LLM API call...")
    try:
        model = mistralai.LLM(model="mistral-large-latest")
        # Correct way to build ChatContext in v1.5.7
        chat_ctx = llm.ChatContext()
        chat_ctx.messages.append(llm.ChatMessage(role="user", content="Say hello"))
        
        print(f"Sending request with key: {os.getenv('MISTRAL_API_KEY')[:5]}...")
        stream = model.chat(chat_ctx=chat_ctx)
        
        received = False
        async for chunk in stream:
            received = True
            print(f"Chunk: {chunk.choices[0].delta.content}")
            
        if not received:
            print("No chunks received!")
        else:
            print("Test finished successfully!")
    except Exception as e:
        print(f"Mistral LLM Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_llm())
