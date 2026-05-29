import os
from livekit.plugins import openai

def get_observyze_llm(model="openai/gpt-4o-mini"):
    """
    Initializes the OpenAI LLM plugin routed through the Observyze proxy for Swarm telemetry.
    Can be toggled back to standard OpenRouter by setting ENABLE_OBSERVYZE=false.
    """
    enable_observyze = os.getenv("ENABLE_OBSERVYZE", "true").lower() == "true"
    
    observyze_key = os.getenv("OBSERVYZE_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    openrouter_base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    if enable_observyze and observyze_key:
        return openai.LLM(
            model=model,
            api_key=observyze_key,
            base_url="https://api.observyze.com/api/v1/proxy/openrouter/v1",
            extra_headers={"x-provider-key": openrouter_key} if openrouter_key else {},
            timeout=60.0
        )
    else:
        # Fallback to standard OpenRouter
        if not openrouter_key:
            raise ValueError("OPENROUTER_API_KEY is missing for fallback")
            
        return openai.LLM(
            model=model,
            api_key=openrouter_key,
            base_url=openrouter_base_url,
            timeout=60.0
        )
