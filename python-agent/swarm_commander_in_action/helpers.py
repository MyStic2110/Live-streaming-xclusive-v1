import os
import sys
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load env variables from root/python-agent
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env")))

def get_openai_client():
    api_key = os.getenv("OPENROUTER_API_KEY")
    base_url = os.getenv("OPENROUTER_BASE_URL")
    if not api_key:
        raise ValueError("Missing OPENROUTER_API_KEY environment variable")
    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url
    )
