import os
import asyncio
import time
from datetime import datetime
import logging
import json
import re
from typing import AsyncIterable
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
import time
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry
from utils.cost_guard import CostGuard
from integrations.securelytix import SecurelytixClient

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
- BIG DATA GUARD: If a request requires querying a large table without specific filters (which could return massive amounts of data), treat it as LOW CONFIDENCE. Ask the user for confirmation or request specific filters before executing the query.

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
                
                # Protect context window from massive row counts
                if len(result) > 50:
                    result = list(result[:50])
                    result.append({"WARNING": "Results truncated at 50 rows to protect context window. Please use LIMIT or refine your WHERE clause."})

                
                # Tokenize PII fields in the result set using Securelytix
                if result:
                    vault = SecurelytixClient()
                    result = await vault.tokenize(result)

                return json.dumps(result, indent=2)
        except Exception as e:
            return f"Database Error: {str(e)}"
        finally:
            if 'conn' in locals(): conn.close()

async def detokenize_stream(text_stream: AsyncIterable[str]) -> AsyncIterable[str]:
    from integrations.securelytix import SecurelytixClient
    vault = SecurelytixClient()
    buffer = ""
    
    async def process_tokens(text: str) -> str:
        tokens = list(set(re.findall(r'([a-zA-Z0-9_\-\.\@]+_stx)', text)))
        if not tokens:
            return text
            
        payload = []
        for token in tokens:
            payload.append({
                "original_token": token,
                "email": token,
                "full_name": token,
                "phoneNo": token,
                "name": token,
                "first_name": token,
                "last_name": token,
                "value": token
            })
            
        res_list = await vault.detokenize(payload, suppress_partial_warning=True)
        if isinstance(res_list, list):
            for item in res_list:
                token = item.get("original_token")
                if token:
                    for k, v in item.items():
                        if v and v != token and k != "original_token":
                            text = text.replace(token, str(v))
                            break
        return text

    async for chunk in text_stream:
        buffer += chunk
        while True:
            match = re.search(r'([\s]+)', buffer)
            if not match:
                break
            
            idx = match.start()
            word = buffer[:idx]
            delimiter = match.group(1)
            
            if "_stx" in word:
                word = await process_tokens(word)
                
            yield word + delimiter
            buffer = buffer[idx + len(delimiter):]

    if buffer:
        if "_stx" in buffer:
            buffer = await process_tokens(buffer)
        yield buffer

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

    llm_plugin = openai.LLM(model="openai/gpt-4o-mini", api_key=os.getenv("OPENROUTER_API_KEY"), base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"))

    # Inject the pre-warmed schema and current time
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    dynamic_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT_TIME: {current_time}\n\nCURRENT DATABASE SCHEMA:\n{json.dumps(SCHEMA_CACHE, indent=2)}"
    
    chat_ctx = llm.ChatContext()
    # voice.Agent will automatically add the `instructions` as a system message, 
    # so we don't need to manually add it here to avoid duplication.

    # --- TOOL REGISTRATION ---
    class BITools:
        @llm.function_tool(description="Query the database for information. ONLY SELECT queries allowed.")
        async def query_data(self, sql_query: str):
            logger.info(f"[BI_QUERY] Executing: {sql_query}")
            return await db.execute_query(sql_query)

    bi_tools = BITools()
    fnc_ctx = llm.ToolContext(tools=llm.find_function_tools(bi_tools))

    agent = voice.Agent(turn_handling={"interruption": {"mode": "vad"}}, 
        instructions=dynamic_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(bi_tools),
    )

    session = AgentSession(
        vad=VAD_PLUGIN,
        stt=STT_PLUGIN,
        llm=llm_plugin,
        tts=TTS_PLUGIN,
        tts_text_transforms=[voice.text_transforms.filter_markdown, detokenize_stream],
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

    guard = CostGuard(
        agent_name="CORTEX",
        session_cost_ceiling=0.20,
        max_context_turns=15,
        usage_broadcast_interval_s=10.0,
        min_stt_words=3,
    )

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        sentry.calculate_session_cost(
            llm_model="gpt-4o-mini",
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            stt_model="nova-2-general",
            stt_seconds=usage.get("stt_seconds", 0.0),
            tts_model="aura-hera-en",
            tts_characters=usage.get("tts_chars", 0)
        )
        if guard.update_usage(usage_data, usage):
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
            if not guard.allow_transcript(event.transcript):
                return
            # --- SEMANTIC ENDPOINTING ---
            if not sentry.is_thought_complete(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)
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
