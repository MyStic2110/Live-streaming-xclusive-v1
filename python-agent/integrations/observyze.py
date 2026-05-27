import os
from livekit.plugins import openai

def get_observyze_llm(model="openai/gpt-4o-mini"):
    """
    Initializes the OpenAI LLM plugin routed through the Observyze proxy for Swarm telemetry.
    """
    api_key = os.getenv("OBSERVYZE_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        raise ValueError("OBSERVYZE_API_KEY environment variable is missing")

    return openai.LLM(
        model=model,
        api_key=api_key,
        base_url="https://api.observyze.com/api/v1/proxy/openrouter/v1",
        extra_headers={"x-provider-key": openrouter_key} if openrouter_key else {}
    )
