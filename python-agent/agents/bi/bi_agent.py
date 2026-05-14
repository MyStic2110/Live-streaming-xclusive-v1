import os
import asyncio
from datetime import datetime
import logging
import json
import re
import aiomysql
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    JobContext, 
    JobRequest, 
    WorkerOptions, 
    cli, 
    llm, 
    AgentSession, 
    AutoSubscribe, 
    voice
)
from livekit.plugins import silero, openai, deepgram

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Logger setup
logger = logging.getLogger("cortex-bi")
logger.setLevel(logging.INFO)

# --- GLOBAL SCHEMA CACHE ---
CACHE_FILE = os.path.join(os.path.dirname(__file__), "schema_cache.json")
SCHEMA_CACHE = {} 

SYSTEM_PROMPT = """You are 'Cortex', an elite Business Intelligence Analyst.
Your goal is to provide high-precision insights from the MySQL database using your INTENT LAYER.

--- INTENT LAYER PROTOCOL ---
For every user request, you MUST perform these steps internally:
1. CLASSIFY INTENT: Determine if the user wants Data (SELECT), Schema (DESCRIBE), or general insight.
2. EXTRACT ENTITIES: Map user terms to specific tables/columns in the SCHEMA_CACHE.
3. ROUTE: Determine the most efficient SQL path (e.g., single table vs. join).
4. CONFIDENCE SCORE: 
   - If confidence is HIGH (>80%): Execute the query immediately.
   - If confidence is LOW (<80%): Ask for clarification before querying.

--- OPERATIONAL RULES ---
- Use the provided SCHEMA_CACHE as your primary source of truth for table and column names.
- ONLY EXECUTE 'SELECT' QUERIES. No modifications (INSERT, UPDATE, DELETE).
- If a user asks a question that spans multiple tables, use the SCHEMA_CACHE to find the joining keys (Primary/Foreign keys).

--- STYLE ---
- Professional, precise, and analytical.
- Speak in plain text ONLY. ASCII only.
- If a query returns no results, explain why based on the data structure.

GREETING:
"Cortex is online. I have mapped your database schema and my intent engine is primed. How can I help you navigate your data today?"
"""

# --- DATABASE HANDLER ---
class MySQLHandler:
    def __init__(self):
        self.host = os.getenv("MYSQL_HOST")
        self.user = os.getenv("MYSQL_USER")
        self.password = os.getenv("MYSQL_PASSWORD")
        self.db = os.getenv("MYSQL_DB")
        self.port = int(os.getenv("MYSQL_PORT", 3306))

    async def get_connection(self):
        return await aiomysql.connect(
            host=self.host, user=self.user, password=self.password,
            db=self.db, port=self.port
        )

    async def initialize_schema(self, force_refresh=False):
        global SCHEMA_CACHE
        
        # Load from disk if possible
        if not force_refresh and os.path.exists(CACHE_FILE):
            logger.info("[INIT] Loading 'Brain' from schema_cache.json...")
            try:
                with open(CACHE_FILE, "r") as f:
                    SCHEMA_CACHE = json.load(f)
                logger.info(f"[INIT] Brain loaded successfully. ({len(SCHEMA_CACHE)} tables)")
                return
            except Exception as e:
                logger.error(f"[INIT] Failed to load disk cache: {e}")

        logger.info("[INIT] Performing Warm Boot (Schema Discovery)...")
        try:
            conn = await self.get_connection()
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SHOW TABLES")
                tables = await cur.fetchall()
                for table_entry in tables:
                    table_name = list(table_entry.values())[0]
                    await cur.execute(f"DESCRIBE {table_name}")
                    columns = await cur.fetchall()
                    SCHEMA_CACHE[table_name] = [col['Field'] for col in columns]
                
            # Save to disk
            with open(CACHE_FILE, "w") as f:
                json.dump(SCHEMA_CACHE, f, indent=2)
            
            logger.info(f"[INIT] Schema mapped and saved to {CACHE_FILE}")
            conn.close()
        except Exception as e:
            logger.error(f"[INIT] Warm Boot failed: {e}")

    async def execute_query(self, query):
        # Sentry Guardrail
        if not get_sentry("BI").validate_tool_args("sql_query", {"query": query}):
            logger.warning(f"[SENTRY_BLOCK] Illegal query attempt: {query}")
            return "ERROR: Security violation. Only read-only SELECT queries are permitted."

        try:
            t_start = get_sentry("BI").start_latency_timer()
            conn = await self.get_connection()
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(query)
                result = await cur.fetchall()
                get_sentry("BI").stop_latency_timer(t_start, "mysql_query")
                get_sentry("BI").log_transaction("sql_success", {"query": query, "rows": len(result)})
                return json.dumps(result, indent=2)
        except Exception as e:
            return f"Database Error: {str(e)}"
        finally:
            if 'conn' in locals(): conn.close()

# --- AGENT SETUP ---
VAD_PLUGIN = silero.VAD.load(min_silence_duration=0.8)
STT_PLUGIN = deepgram.STT(model="nova-2-general")
TTS_PLUGIN = deepgram.TTS(model="aura-hera-en")

# --- WORKER INITIALIZATION ---
db = MySQLHandler()

async def prewarm_schema():
    await db.initialize_schema()

async def entrypoint(ctx: JobContext):
    # Initialize Sentry
    sentry = get_sentry("BI")
    sentry.log_transaction("session_start", {"room": ctx.room.name})

    logger.info(f"--- CORTEX BI CONNECTING (ROOM: {ctx.room.name}) ---")
    
    # Schema is already loaded globally!
    if not SCHEMA_CACHE:
        await db.initialize_schema() # Fallback if global failed

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    # Inject the pre-warmed schema and current time
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    dynamic_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT_TIME: {current_time}\n\nCURRENT DATABASE SCHEMA:\n{json.dumps(SCHEMA_CACHE, indent=2)}"
    
    chat_ctx = llm.ChatContext()
    chat_ctx.append(role="system", text=dynamic_prompt)

    # --- TOOL REGISTRATION ---
    class BITools:
        @llm.function_tool(description="Query the database for information. ONLY SELECT queries allowed.")
        async def query_data(self, sql_query: str):
            logger.info(f"[BI_QUERY] Executing: {sql_query}")
            return await db.execute_query(sql_query)

    bi_tools = BITools()
    fnc_ctx = llm.ToolContext(tools=llm.find_function_tools(bi_tools))

    agent = voice.Agent(
        instructions=dynamic_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(bi_tools),
    )

    session = AgentSession(
        vad=VAD_PLUGIN,
        stt=STT_PLUGIN,
        llm=llm_plugin,
        tts=TTS_PLUGIN,
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 2.0}},
    )

    # --- RESOURCE TRACKING ---
    usage = {
        "input_tokens": 0, "output_tokens": 0, 
        "stt_seconds": 0.0, "tts_chars": 0,
        "total_cost": 0.0
    }

    async def broadcast_usage():
        await ctx.room.local_participant.set_metadata(json.dumps({
            "name": "CORTEX",
            "usage": usage
        }))

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        # The usage_data.usage.model_usage is a list of LLM/STT/TTS usage objects
        for m in usage_data.usage.model_usage:
            if m.type == "llm_usage":
                usage["input_tokens"] = getattr(m, "input_tokens", 0)
                usage["output_tokens"] = getattr(m, "output_tokens", 0)
            elif m.type == "stt_usage":
                usage["stt_seconds"] = getattr(m, "audio_duration", 0.0)
            elif m.type == "tts_usage":
                usage["tts_chars"] = getattr(m, "characters_count", 0)
        
        # --- UNIFIED SENTRY COST AUDIT (LLM + STT + TTS) ---
        sentry.calculate_session_cost(
            llm_model="gpt-4o-mini",
            input_tokens=usage["input_tokens"],
            output_tokens=usage["output_tokens"],
            stt_model="nova-2-general",
            stt_seconds=usage["stt_seconds"],
            tts_model="aura-hera-en",
            tts_characters=usage["tts_chars"]
        )
        usage["total_cost"] = round(
            (usage["input_tokens"] / 1_000_000 * 0.15) + (usage["output_tokens"] / 1_000_000 * 0.60) +
            (usage["stt_seconds"] / 60 * 0.0043) + (usage["tts_chars"] / 1000 * 0.015), 6
        )
        logger.info(f"[COST_AUDIT] LLM+STT+TTS Total: ${usage['total_cost']} | Tokens: {usage['input_tokens']+usage['output_tokens']}")
        asyncio.create_task(broadcast_usage())

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
            break
        except Exception as e:
            logger.warning(f"LiveKit connection attempt {attempt} failed: {e}")
            if attempt == max_retries:
                raise
            await asyncio.sleep(2 ** attempt)

    await broadcast_usage() # Initial broadcast

    await session.start(room=ctx.room, agent=agent)
    logger.info("[PIPELINE] Cortex BI is active and using pre-warmed schema.")

    # --- REAL-TIME LOGGING ---
    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            # --- SEMANTIC ENDPOINTING ---
            if not sentry.is_thought_complete(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            content = item.content[0] if isinstance(item.content, list) else item.content
            if item.role == "assistant":
                logger.info(f"CORTEX: {content}")
            elif item.role == "user":
                logger.info(f"USER: {content}")

async def request_fnc(req: JobRequest):
    await req.accept()

# Background task to warm up schema on startup
def run_warmup():
    loop = asyncio.get_event_loop()
    loop.create_task(prewarm_schema())

if __name__ == "__main__":
    # Start the warmup task before the worker blocks
    asyncio.get_event_loop().call_soon(run_warmup)
    
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc, 
            agent_name="BI"
        )
    )
