import asyncio
import os
from dotenv import load_dotenv
from livekit.plugins import openai
from livekit.agents import llm

load_dotenv()

async def test_llm():
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    
    print("Testing OpenRouter Gemini Flash...")
    try:
        model = openai.LLM(
            model="google/gemini-flash-1.5",
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
        )
        
        chat_ctx = llm.ChatContext()
        chat_ctx.messages.append(llm.ChatMessage(role="user", content="Say hello"))
        
        print("Sending request...")
        stream = model.chat(chat_ctx=chat_ctx)
        
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                print(f"Chunk: {content}")
            
        print("Test finished successfully!")
    except Exception as e:
        print(f"LLM Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_llm())
