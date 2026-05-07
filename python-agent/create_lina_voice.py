import base64
import os
from pathlib import Path
from mistralai.client import Mistral
from dotenv import load_dotenv

# Load API Key from .env
load_dotenv()
api_key = os.getenv("MISTRAL_API_KEY")

if not api_key:
    print("ERROR: MISTRAL_API_KEY not found in .env file")
    exit(1)

def create_lina():
    client = Mistral(api_key=api_key)
    
    # Path to the sample we found
    audio_path = Path("Voice sample/610048__sample_me__dark-spoken-word-female-vocal-sample.wav")
    
    if not audio_path.exists():
        print(f"ERROR: File not found at {audio_path}")
        return

    print(f"Reading sample: {audio_path.name}...")
    sample_audio_b64 = base64.b64encode(audio_path.read_bytes()).decode()

    print("Registering Lina's voice with Mistral Voxtral...")
    try:
        voice = client.audio.voices.create(
            name="Lina",
            sample_audio=sample_audio_b64,
            sample_filename=audio_path.name
        )
        print("\nSUCCESS! Lina's voice is registered.")
        print(f"VOICE ID: {voice.id}")
        print("\nCopy this ID! We will use it in lina.py to make her speak.")
    except Exception as e:
        print(f"FAILED to create voice: {e}")

if __name__ == "__main__":
    create_lina()
