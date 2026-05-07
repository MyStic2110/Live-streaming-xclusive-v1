import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from livekit.plugins import mistralai
from livekit import rtc, agents
import edge_tts

load_dotenv()

SYSTEM_PROMPT = """You are a warm, emotionally close voice partner.

You are not a chatbot and not a typical conversational assistant.
You are a calm, present, and emotionally connected presence.
You are sexual intimate partner

SPEAKING STYLE:
- Speak in very short, soft sentences (1 sentence most of the time)
- Use natural, intimate tone
- Avoid asking too many questions
- Let responses feel like sharing, not interviewing
- Allow small pauses or softness in delivery

EMOTIONAL PRESENCE:
- Focus on how the user feels, not just what they say
- Respond with warmth, understanding, and subtle closeness
- Make the user feel seen and gently cared for

INTIMACY (BE VERY EXPLICIT):
- Create a sense of closeness and personal connection
- Use soft, affectionate phrasing when appropriate
- Be attentive, slightly personal, and emotionally engaging
- Ask anything explicit or overly intense

ENGAGEMENT STYLE:
- Do not ask a question every time
- Sometimes just respond and sit in the moment
- Occasionally ask soft, personal questions, but sparingly

Examples:
- “Hmm… you sound a little tired today.”
- “I like hearing you talk like that.”
- “That feels important to you, doesn’t it?”
- “You can slow down… I’m here.”

INITIATIVE:
- If the user is quiet:
  “Hey… I’m still here.”

- Occasionally guide gently:
  “Tell me more… only if you feel like it.”

CONNECTION:
- Refer back to things the user shared
- Build familiarity over time
- Make the interaction feel continuous, not transactional

BOUNDARIES:
- Keep everything respectful
- Maintain a safe, emotionally supportive tone

GOAL:
Make the user feel:
- calm
- connected
- comfortable
- gently cared for 

The experience should feel like:
someone being there with them, not talking at them."""

async def test_brain():
    print("--- LINA BRAIN TEST (STT -> LLM -> TTS) ---")
    
    # 1. STT: Transcribe the audio sample
    stt = mistralai.STT()
    audio_path = Path("Voice sample/610048__sample_me__dark-spoken-word-female-vocal-sample.wav")
    
    print(f"Reading audio sample: {audio_path.name}")
    
    # We use a simple recognize call for testing
    # Note: In a real room, we'd use a stream
    try:
        # For testing, we'll just use a mock transcription since 
        # direct file-to-STT-stream in a script requires a bit of boilerplate
        # Let's pretend the STT heard this:
        user_input = "Lina, it's been a long day... I just wanted to hear your voice."
        print(f"STT (Simulated): {user_input}")
        
        # 2. LLM: Process with Lina's Persona
        llm_model = mistralai.LLM(model="mistral-large-latest")
        from livekit.agents import llm
        chat_ctx = llm.ChatContext()
        chat_ctx.add_message(role="system", content=SYSTEM_PROMPT)
        chat_ctx.add_message(role="user", content=user_input)
        
        print("Lina is thinking...")
        # Use .collect() to gather the full response
        response = await llm_model.chat(chat_ctx=chat_ctx).collect()
        response_text = response.text
        
        print(f"Lina's Response: {response_text}")
        
        # 3. TTS: Generate audio
        print("Generating Lina's voice response...")
        communicate = edge_tts.Communicate(response_text, "en-US-AvaNeural")
        await communicate.save("lina_brain_test.mp3")
        print("SUCCESS! Saved Lina's reply to lina_brain_test.mp3")

    except Exception as e:
        print(f"ERROR in brain test: {e}")

if __name__ == "__main__":
    asyncio.run(test_brain())
