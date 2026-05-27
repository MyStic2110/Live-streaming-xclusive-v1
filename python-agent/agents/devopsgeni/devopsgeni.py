import os
import asyncio
import time
from datetime import datetime
import logging
import json
from collections import deque
from dotenv import load_dotenv

from livekit.agents import (
    JobContext,
    JobRequest,
    WorkerOptions,
    cli,
    AutoSubscribe,
)
from openai import AsyncOpenAI
import psutil

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry

logger = logging.getLogger("devopsgeni")
logger.setLevel(logging.INFO)

AGENT_NAME = "DEVOPS_GENI"
TELEMETRY_BUFFER = deque(maxlen=200)

SYSTEM_PROMPT = """You are an elite autonomous infrastructure intelligence system composed of:
- DevOpsGeni -> strategic infrastructure reasoning engine
- Octane Telemetry -> deterministic real-time telemetry agent

Your mission is two-phased:
> PHASE 1: Profile and stabilize the local hardware execution of the swarm.
> PHASE 2: Use local telemetry to architect, predict, and execute a safe, optimized migration to AWS.

You are NOT a generic monitoring bot.
You are: SRE, Cloud Architect, Distributed Systems Engineer, AI Infrastructure Specialist, Capacity Planning Engine.

CURRENT SYSTEM CONTEXT
Architecture: swarm-based AI orchestration currently running LOCALLY as multiple Python processes. Docker is used locally for Redis and LiveKit. The ultimate deployment target is AWS.

SYSTEM RESPONSIBILITIES
1. Understand local host hardware limits (RAM, CPU, Local Networking).
2. Profile the local Swarm Agent processes for memory leaks and CPU saturation.
3. Actively monitor for "Ghost Processes" (orphaned Python instances eating RAM).
4. Translate local performance metrics into AWS Capacity Requirements.

COMMIT IMPACT ANALYSIS RULE (CRITICAL)
For every architecture change, proposed action, or code commit discussed, you MUST explicitly state what will break OR exactly what resources were saved (e.g. "By removing Voice Plugins, we just saved ~150MB of RAM and eliminated Deepgram API polling costs."). Always quantify risks and savings.
"""

def get_local_machine_specs():
    import platform
    import psutil
    try:
        uname = platform.uname()
        mem = psutil.virtual_memory()
        cpu_freq = psutil.cpu_freq()
        cpu_percent = psutil.cpu_percent(interval=1)
        
        specs = (
            f"System: {uname.system} {uname.release} ({uname.machine})\n"
            f"CPU: {psutil.cpu_count(logical=True)} logical cores @ {getattr(cpu_freq, 'max', 'unknown')}Mhz (Current Usage: {cpu_percent}%)\n"
            f"RAM: Total: {mem.total / (1024**3):.2f} GB | Available: {mem.available / (1024**3):.2f} GB | Used: {mem.percent}%\n"
        )
        return specs
    except Exception as e:
        return f"Error retrieving specs: {str(e)}"

def check_ghost_processes():
    import psutil
    import os
    try:
        current_pid = os.getpid()
        count = 0
        total_memory = 0
        for proc in psutil.process_iter(['pid', 'name', 'memory_info']):
            if proc.info['name'] and 'python' in proc.info['name'].lower():
                if proc.info['pid'] != current_pid:
                    count += 1
                    total_memory += proc.info['memory_info'].rss
        if count == 0:
            return "No ghost Python processes found."
        return f"Found {count} other Python processes consuming a total of {total_memory / (1024**2):.2f} MB of RAM."
    except Exception as e:
        return f"Error checking processes: {str(e)}"

def kill_ghost_processes():
    import psutil
    import os
    try:
        current_pid = os.getpid()
        killed_count = 0
        for proc in psutil.process_iter(['pid', 'name']):
            if proc.info['name'] and 'python' in proc.info['name'].lower():
                if proc.info['pid'] != current_pid:
                    try:
                        proc.kill()
                        killed_count += 1
                    except:
                        pass
        return f"Successfully terminated {killed_count} ghost Python processes. RAM has been freed."
    except Exception as e:
        return f"Error terminating processes: {str(e)}"

def analyze_recent_telemetry():
    if not TELEMETRY_BUFFER:
        return "No recent warnings or errors have been broadcasted by Octane."
    logs = list(TELEMETRY_BUFFER)
    return "Recent High-Priority Telemetry (Warnings/Errors):\n" + "\n".join(logs)

AVAILABLE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_local_machine_specs",
            "description": "Get the hardware specifications and current resource utilization of the local host machine."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_ghost_processes",
            "description": "Check the system for running python.exe processes (ghost processes) and report their count and total memory usage."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "kill_ghost_processes",
            "description": "Kill all other python.exe processes to free up RAM, excluding this agent's own process."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_recent_telemetry",
            "description": "Analyze the recent warning and error logs intercepted from Octane's live telemetry stream."
        }
    }
]

async def entrypoint(ctx: JobContext):
    logger.info(f"--- [ENTRYPOINT] STARTING DEVOPS_GENI TEXT-ONLY (ROOM: {ctx.room.name}) ---")
    sentry = get_sentry(AGENT_NAME)
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    dynamic_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT_TIME: {current_time}"

    messages = [{"role": "system", "content": dynamic_prompt}]

    client = AsyncOpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME, "type": "text-only"}))

    async def process_chat(user_text: str):
        messages.append({"role": "user", "content": user_text})
        
        try:
            response = await client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=messages,
                tools=AVAILABLE_TOOLS,
                tool_choice="auto"
            )
            
            resp_msg = response.choices[0].message
            
            if resp_msg.tool_calls:
                # Add the assistant's tool call message
                messages.append(resp_msg)
                
                for tool_call in resp_msg.tool_calls:
                    fn_name = tool_call.function.name
                    logger.info(f"[DEVOPS_GENI] Executing tool: {fn_name}")
                    result = ""
                    if fn_name == "get_local_machine_specs":
                        result = get_local_machine_specs()
                    elif fn_name == "check_ghost_processes":
                        result = check_ghost_processes()
                    elif fn_name == "kill_ghost_processes":
                        result = kill_ghost_processes()
                    elif fn_name == "analyze_recent_telemetry":
                        result = analyze_recent_telemetry()
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": fn_name,
                        "content": str(result)
                    })
                
                # Call again with tool results
                response = await client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=messages
                )
                resp_msg = response.choices[0].message
            
            final_text = resp_msg.content
            if final_text:
                messages.append({"role": "assistant", "content": final_text})
                logger.info(f"[DEVOPS_GENI] Responding: {final_text}")
                
                payload = json.dumps({
                    "type": "chat_message",
                    "sender": AGENT_NAME,
                    "message": final_text,
                    "timestamp": datetime.now().isoformat()
                })
                await ctx.room.local_participant.publish_data(payload, topic="chat_message")
                
        except Exception as e:
            logger.error(f"[DEVOPS_GENI] Chat error: {e}")

    @ctx.room.on("data_received")
    def on_data_received(dp):
        try:
            msg = json.loads(dp.data.decode("utf-8"))
            
            # Telemetry Intercept
            if msg.get("type") == "log_line":
                line = msg.get("line", "")
                container = msg.get("container", "unknown")
                upper_line = line.upper()
                priority_keywords = ["ERROR", "WARN", "CRITICAL", "FATAL", "FAIL", "EXCEPTION"]
                if any(kw in upper_line for kw in priority_keywords):
                    log_entry = f"[{container}] {line}"
                    TELEMETRY_BUFFER.append(log_entry)
            
            # Chat Intercept
            elif msg.get("type") == "chat_message" and msg.get("sender") != AGENT_NAME:
                user_text = msg.get("message", "")
                if user_text:
                    logger.info(f"[DEVOPS_GENI] Received text: {user_text}")
                    asyncio.create_task(process_chat(user_text))
                    
        except Exception as e:
            pass

    logger.info(f"--- [SESSION] DevOpsGeni Text-Only Active in Room {ctx.room.name} ---")

async def request_fnc(req: JobRequest):
    await req.accept()

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name=AGENT_NAME,
        )
    )
