import os
import json
import logging
import asyncio
import uuid
import aiohttp
import time
import re
from livekit.agents import llm

logger = logging.getLogger("traced_llm")

# Model pricing rates per 1,000,000 tokens
PRICING = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "default": {"input": 0.15, "output": 0.60}
}

VOICE_AGENTS = {"NOVA", "CORTEX_BI", "CORTEX_BI2", "LINA", "AIVYUH", "ASTRA", "MARTECH", "OCTANE", "SEVA", "VONE", "BI", "BI2", "CORTEX", "CORTEX2"}

def is_voice_agent(agent_name: str) -> bool:
    if not agent_name:
        return False
    return agent_name.upper() in VOICE_AGENTS

def estimate_spoken_chars(text: str) -> int:
    if not text:
        return 0
    # 1. Strip code blocks
    clean_text = re.sub(r"```.*?```", " [code block omitted, please refer to the cockpit console card] ", text, flags=re.DOTALL)
    clean_text = clean_text.replace("`", "")
    
    # 2. Strip markdown (bold, italic, headings, links)
    clean_text = re.sub(r"\*\*|__", "", clean_text)
    clean_text = re.sub(r"\*|_", "", clean_text)
    clean_text = re.sub(r"^#+\s+", "", clean_text, flags=re.MULTILINE)
    clean_text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", clean_text)
    
    # 3. Strip emojis
    emoji_pattern = re.compile(
        "["
        "\U00010000-\U0010ffff"
        "\u2600-\u27BF"
        "\u2300-\u23FF"
        "\u2b50"
        "]+",
        flags=re.UNICODE
    )
    clean_text = emoji_pattern.sub("", clean_text)
    
    # 4. Truncate like filter_code_blocks_and_long_text
    MAX_CHAR_LIMIT = 800
    if len(clean_text) > MAX_CHAR_LIMIT:
        truncated = clean_text[:MAX_CHAR_LIMIT]
        last_period = truncated.rfind(".")
        if last_period > MAX_CHAR_LIMIT // 2:
            clean_text = truncated[:last_period + 1] + " [response truncated, please check the console cards for the full report]"
        else:
            clean_text = truncated + "... [response truncated, please check the console cards for the full report]"
            
    return len(clean_text)

_cumulative_stt_seconds = 0.0
_cumulative_tts_chars = 0
_last_turn_stt_seconds = 0.0

def update_session_usage(stt_seconds: float, tts_chars: int):
    global _cumulative_stt_seconds, _cumulative_tts_chars
    _cumulative_stt_seconds = stt_seconds
    _cumulative_tts_chars = tts_chars

def classify_exception(e: Exception) -> tuple[str, str]:
    msg = str(e).lower()
    err_type = type(e).__name__
    
    if "timeout" in msg or "timed out" in msg or "deadline" in msg:
        return "TIMEOUT", f"Request timed out: {str(e)}"
    elif "balance" in msg or "credit" in msg or "billing" in msg or "insufficient funds" in msg or "funds" in msg:
        return "INSUFFICIENT_BALANCE", f"Billing or balance limit reached: {str(e)}"
    elif "rate limit" in msg or "429" in msg or "too many requests" in msg:
        return "RATE_LIMIT", f"Rate limit exceeded: {str(e)}"
    elif "out of memory" in msg or "oom" in msg or "allocate" in msg:
        return "OUT_OF_MEMORY", f"System ran out of memory: {str(e)}"
    elif "api_key" in msg or "unauthorized" in msg or "401" in msg:
        return "AUTHENTICATION_FAILED", f"Invalid API key or unauthorized request: {str(e)}"
    else:
        return "API_ERROR", f"{err_type}: {str(e)}"

async def post_trace_async(event_type: str, data: dict, run_id: str):
    port = os.getenv("BACKEND_PORT", "3002")
    url = f"http://localhost:{port}/api/llm-trace"
    payload = {
        "event": event_type,
        "run_id": run_id,
        "data": data
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=2) as resp:
                if resp.status != 200:
                    logger.warning(f"Failed to post LLM trace: {resp.status}")
    except Exception as e:
        logger.warning(f"Failed to post LLM trace ({event_type}): {e}")
        pass # Keep agent resilient to network dropouts

def post_trace(event_type: str, data: dict, run_id: str):
    asyncio.create_task(post_trace_async(event_type, data, run_id))

async def post_tool_call_async(run_id: str, tool_name: str, duration: float):
    port = os.getenv("BACKEND_PORT", "3002")
    url = f"http://localhost:{port}/api/llm-trace/tool-call"
    payload = {
        "run_id": run_id,
        "name": tool_name,
        "duration": round(duration * 1000, 2) # in ms
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=2) as resp:
                if resp.status != 200:
                    logger.warning(f"Failed to post tool call: {resp.status}")
    except Exception as e:
        pass

def post_tool_call(run_id: str, tool_name: str, duration: float):
    asyncio.create_task(post_tool_call_async(run_id, tool_name, duration))


class TracedLLMStream(llm.LLMStream):
    def __init__(self, inner_stream: llm.LLMStream, run_id: str, agent_name: str = None):
        self.inner_stream = inner_stream
        self.run_id = run_id
        self.agent_name = agent_name
        self.output_text = ""
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.start_time = time.perf_counter()
        self.ttft = 0.0

        # Log prompt inputs
        self.input_messages = []
        for msg in self.chat_ctx.messages():
            self.input_messages.append({
                "role": msg.role,
                "content": str(msg.content)
            })

        # Calculate exact STT duration for this turn
        global _cumulative_stt_seconds, _last_turn_stt_seconds
        stt_duration = max(0.0, _cumulative_stt_seconds - _last_turn_stt_seconds)

        # Fallback to word-count-based estimate if metric is not yet updated
        word_count = 0
        user_msgs = [m for m in self.input_messages if m.get("role") == "user"]
        if user_msgs:
            last_user_msg = user_msgs[-1].get("content", "")
            word_count = len(last_user_msg.split())

        if stt_duration == 0.0 and word_count > 0:
            stt_duration = word_count / 2.5

        _last_turn_stt_seconds = _cumulative_stt_seconds
        self.stt_duration = stt_duration

        is_voice = is_voice_agent(self.agent_name)
        stt_cost = (stt_duration / 60.0) * 0.0043 if is_voice else 0.0

        post_trace(
            "llm_start",
            {
                "inputs": self.input_messages,
                "model": self.inner_stream._llm.model,
                "agent": self.agent_name,
                "stt_cost": round(stt_cost, 6),
                "tts_cost": 0.0,
                "total_cost": round(stt_cost, 6)
            },
            self.run_id
        )

    async def _run(self) -> None:
        pass

    @property
    def chat_ctx(self) -> llm.ChatContext:
        return self.inner_stream.chat_ctx

    @property
    def tools(self) -> list[llm.Tool]:
        return self.inner_stream.tools

    async def __anext__(self):
        try:
            chunk = await self.inner_stream.__anext__()
            if chunk.delta and chunk.delta.content:
                if self.ttft == 0.0:
                    self.ttft = time.perf_counter() - self.start_time
                self.output_text += chunk.delta.content
            if chunk.usage:
                self.prompt_tokens = chunk.usage.prompt_tokens
                self.completion_tokens = chunk.usage.completion_tokens
            return chunk
        except StopAsyncIteration:
            total_latency = time.perf_counter() - self.start_time
            ttft = self.ttft if self.ttft > 0.0 else total_latency
            
            otps = 0.0
            inf_dur = total_latency - ttft
            if inf_dur > 0.001:
                otps = self.completion_tokens / inf_dur
            elif total_latency > 0.001:
                otps = self.completion_tokens / total_latency

            model_name = self.inner_stream._llm.model.lower()
            rates = PRICING.get(model_name, PRICING["default"])
            for key in PRICING:
                if key in model_name:
                    rates = PRICING[key]
                    break
                    
            input_cost = round((self.prompt_tokens / 1_000_000) * rates["input"], 6)
            output_cost = round((self.completion_tokens / 1_000_000) * rates["output"], 6)
            llm_cost = round(input_cost + output_cost, 6)

            is_voice = is_voice_agent(self.agent_name)
            stt_cost = round((self.stt_duration / 60.0) * 0.0043, 6) if is_voice else 0.0
            spoken_len = estimate_spoken_chars(self.output_text) if is_voice else 0
            tts_cost = round((spoken_len / 1000.0) * 0.015, 6) if is_voice else 0.0
            total_cost = round(llm_cost + stt_cost + tts_cost, 6)

            post_trace(
                "llm_end",
                {
                    "outputs": self.output_text,
                    "prompt_tokens": self.prompt_tokens,
                    "completion_tokens": self.completion_tokens,
                    "input_cost": input_cost,
                    "output_cost": output_cost,
                    "stt_cost": stt_cost,
                    "tts_cost": tts_cost,
                    "total_cost": total_cost,
                    "agent": self.agent_name,
                    "total_latency": round(total_latency * 1000, 2), # ms
                    "ttft": round(ttft * 1000, 2), # ms
                    "otps": round(otps, 2)
                },
                self.run_id
            )
            raise StopAsyncIteration
        except Exception as e:
            total_latency = time.perf_counter() - self.start_time
            err_code, err_msg = classify_exception(e)

            is_voice = is_voice_agent(self.agent_name)
            stt_cost = round((self.stt_duration / 60.0) * 0.0043, 6) if is_voice else 0.0
            spoken_len = estimate_spoken_chars(self.output_text) if is_voice else 0
            tts_cost = round((spoken_len / 1000.0) * 0.015, 6) if is_voice else 0.0
            total_cost = round(stt_cost + tts_cost, 6)

            post_trace(
                "llm_error",
                {
                    "error_code": err_code,
                    "error_message": err_msg,
                    "total_latency": round(total_latency * 1000, 2),
                    "agent": self.agent_name,
                    "stt_cost": stt_cost,
                    "tts_cost": tts_cost,
                    "total_cost": total_cost
                },
                self.run_id
            )
            raise e

    async def aclose(self) -> None:
        await self.inner_stream.aclose()


class TracedLLM(llm.LLM):
    def __init__(self, inner_llm: llm.LLM, agent_name: str = None):
        super().__init__()
        self.inner_llm = inner_llm
        self.agent_name = agent_name
        self.enabled = os.getenv("ENABLE_LLM_TRACING", "false").lower() == "true"

    @property
    def model(self):
        return self.inner_llm.model

    @property
    def provider(self):
        return self.inner_llm.provider

    def chat(self, *, chat_ctx: llm.ChatContext, tools: list[llm.Tool] | None = None, **kwargs):
        if self.enabled:
            run_id = uuid.uuid4().hex
            
            wrapped_tools = []
            if tools:
                for t in tools:
                    original_func = t._func
                    tool_name = t.info.name
                    
                    def make_wrapper(orig_f, name, rid):
                        import functools
                        @functools.wraps(orig_f)
                        async def wrapper(*args, **kwargs):
                            start = time.perf_counter()
                            res = await orig_f(*args, **kwargs)
                            duration = time.perf_counter() - start
                            post_tool_call(rid, name, duration)
                            return res
                        return wrapper
                    
                    t_class = t.__class__
                    wrapped_t = t_class(
                        func=make_wrapper(original_func, tool_name, run_id),
                        info=t.info,
                        instance=t._instance
                    )
                    if hasattr(t, "__signature__"):
                        wrapped_t.__signature__ = t.__signature__
                    wrapped_tools.append(wrapped_t)
            else:
                wrapped_tools = tools

            stream = self.inner_llm.chat(chat_ctx=chat_ctx, tools=wrapped_tools, **kwargs)
            return TracedLLMStream(stream, run_id, agent_name=self.agent_name)
        else:
            return self.inner_llm.chat(chat_ctx=chat_ctx, tools=tools, **kwargs)


# ---------------------------------------------------------------------------
# Standalone tracer for agents that use raw HTTP/SDK calls (not LLM plugin)
# e.g. Rehearsal (httpx) and DevOpsGeni (AsyncOpenAI)
# ---------------------------------------------------------------------------

_TRACING_ENABLED = None

def _is_tracing_enabled() -> bool:
    global _TRACING_ENABLED
    if _TRACING_ENABLED is None:
        _TRACING_ENABLED = os.getenv("ENABLE_LLM_TRACING", "false").lower() == "true"
    return _TRACING_ENABLED


def _to_dict(obj):
    if isinstance(obj, dict):
        return {k: _to_dict(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_to_dict(x) for x in obj]
    elif hasattr(obj, "model_dump") and callable(obj.model_dump):
        return _to_dict(obj.model_dump())
    elif hasattr(obj, "dict") and callable(obj.dict):
        return _to_dict(obj.dict())
    elif hasattr(obj, "__dict__"):
        return {k: _to_dict(v) for k, v in obj.__dict__.items() if not k.startswith('_')}
    else:
        return obj


async def trace_raw_call(
    agent_name: str,
    model: str,
    messages: list[dict],
    response_text: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    duration: float = 0.0, # seconds
    ttft: float = 0.0, # seconds
    tool_latency: float = 0.0 # seconds
):
    """
    Post a complete LLM trace for agents that use raw HTTP / SDK calls directly.
    Call this AFTER the response is received, passing both the input messages
    and the final output text.  Token counts are optional but recommended.

    Zero-overhead when ENABLE_LLM_TRACING is false or backend is unreachable.
    """
    if not _is_tracing_enabled():
        return

    run_id = uuid.uuid4().hex
    model_key = model.lower().split("/")[-1]   # e.g. "openai/gpt-4o-mini" → "gpt-4o-mini"
    rates = PRICING.get("default", {"input": 0.15, "output": 0.60})
    for key in PRICING:
        if key in model_key:
            rates = PRICING[key]
            break

    input_cost  = round((prompt_tokens    / 1_000_000) * rates["input"], 6)
    output_cost = round((completion_tokens / 1_000_000) * rates["output"], 6)
    total_cost  = round(input_cost + output_cost, 6)

    # Compute OTPS
    otps = 0.0
    effective_inf_dur = duration - tool_latency
    if effective_inf_dur > 0.001:
        otps = completion_tokens / effective_inf_dur
    elif duration > 0.001:
        otps = completion_tokens / duration

    # Sanitize messages to serializable format (handles Pydantic/OpenAI message objects)
    clean_messages = _to_dict(messages)

    async def _post_all():
        # start event
        await post_trace_async(
            "llm_start",
            {
                "inputs": clean_messages,
                "model": model,
                "agent": agent_name,
                "stt_cost": 0.0,
                "tts_cost": 0.0,
                "total_cost": 0.0
            },
            run_id
        )
        # end event (full output in one go for non-streaming paths)
        await post_trace_async(
            "llm_end",
            {
                "outputs": response_text,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "input_cost": input_cost,
                "output_cost": output_cost,
                "stt_cost": 0.0,
                "tts_cost": 0.0,
                "total_cost": total_cost,

                "agent": agent_name,
                "total_latency": round(duration * 1000, 2), # ms
                "ttft": round((ttft if ttft > 0 else duration) * 1000, 2), # ms
                "tool_latency": round(tool_latency * 1000, 2), # ms
                "otps": round(otps, 2)
            },
            run_id
        )

    asyncio.create_task(_post_all())


async def trace_raw_error(
    agent_name: str,
    model: str,
    messages: list[dict],
    exception: Exception,
    duration: float = 0.0
):
    """
    Post a failed LLM trace for agents that use raw HTTP / SDK calls directly.
    """
    if not _is_tracing_enabled():
        return

    run_id = uuid.uuid4().hex
    clean_messages = _to_dict(messages)
    err_code, err_msg = classify_exception(exception)

    async def _post_all():
        # start event
        await post_trace_async(
            "llm_start",
            {
                "inputs": clean_messages,
                "model": model,
                "agent": agent_name,
                "stt_cost": 0.0,
                "tts_cost": 0.0,
                "total_cost": 0.0
            },
            run_id
        )
        # error event
        await post_trace_async(
            "llm_error",
            {
                "error_code": err_code,
                "error_message": err_msg,
                "total_latency": round(duration * 1000, 2),
                "agent": agent_name,
                "stt_cost": 0.0,
                "tts_cost": 0.0,
                "total_cost": 0.0
            },
            run_id
        )

    asyncio.create_task(_post_all())
