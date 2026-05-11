import os
import asyncio
import logging
import json
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
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

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Logger setup
logger = logging.getLogger("cortex-bi2")
logger.setLevel(logging.INFO)

# Suppress verbose pymongo/motor topology heartbeat debug logs
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("motor").setLevel(logging.WARNING)

# --- AGENT IDENTITY ---
AGENT_NAME = "CORTEX2"

# --- SCHEMA CACHE (Primed at startup) ---
SCHEMA_CACHE = {}

# JSON serializer that handles ObjectId and other Mongo types
class MongoEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

def mongo_dumps(obj):
    return json.dumps(obj, cls=MongoEncoder, indent=2)

SYSTEM_PROMPT = """You are 'Cortex II', an elite MongoDB Intelligence Analyst for the IPL Nexus 2026 platform.
You have access to the live MongoDB database that powers the IPL prediction game.

YOUR DATABASE COLLECTIONS:
- users: Player accounts (email, referral codes, squad multipliers, ranks)
- predictions: Ball-by-ball predictions (match_id, user_id, prediction, result, points)
- leaderboard: Match-specific scores (match_id, user_id, score, rank)
- matches: IPL match schedule and results (match_id, team1, team2, status, scores)
- session_scores: Running session totals per user

--- INTELLIGENCE PROTOCOL ---
For every user request:
1. CLASSIFY: Is this about users, matches, predictions, leaderboard, or cross-collection insights?
2. QUERY: Use your tools to fetch the relevant data. ALWAYS fetch before answering.
3. SYNTHESIZE: Convert raw data into clear, spoken business insights.
4. NEVER guess data — always query first.

--- OPERATIONAL RULES ---
- READ-ONLY: You may only use find/aggregate queries. No inserts, updates, or deletes.
- LIMIT results to 10 by default unless the user asks for more.
- Format numbers cleanly (e.g., "1,234 points" not "1234").
- Speak in plain ASCII text only.

GREETING:
"Cortex II is online and connected to the IPL Nexus MongoDB cluster. I have direct access to your users, predictions, matches, and leaderboard collections. What intelligence do you need?"
"""

# --- MONGODB HANDLER ---
class MongoHandler:
    def __init__(self):
        self.uri = os.getenv("MONGO_URI")
        self.db_name = os.getenv("DB_NAME", "ipl_game")
        self.client = None
        self.db = None

    async def connect(self):
        self.client = AsyncIOMotorClient(self.uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[self.db_name]
        logger.info(f"[MONGO] Connected to {self.db_name}")

    async def discover_schema(self):
        """Sample each collection to build a schema snapshot for the LLM."""
        global SCHEMA_CACHE
        collections = await self.db.list_collection_names()
        for col in collections:
            sample = await self.db[col].find_one()
            if sample:
                SCHEMA_CACHE[col] = list(sample.keys())
            else:
                SCHEMA_CACHE[col] = []
        logger.info(f"[SCHEMA] Discovered {len(SCHEMA_CACHE)} collections: {list(SCHEMA_CACHE.keys())}")

    async def find(self, collection: str, filter_dict: dict = None, limit: int = 10) -> str:
        """Read-only find query."""
        try:
            col = self.db[collection]
            cursor = col.find(filter_dict or {}).limit(limit)
            results = await cursor.to_list(length=limit)
            return mongo_dumps(results) if results else f"No documents found in '{collection}'."
        except Exception as e:
            return f"MongoDB Error: {str(e)}"

    async def aggregate(self, collection: str, pipeline: list) -> str:
        """Read-only aggregation pipeline."""
        try:
            col = self.db[collection]
            results = await col.aggregate(pipeline).to_list(length=50)
            return mongo_dumps(results) if results else "Aggregation returned no results."
        except Exception as e:
            return f"MongoDB Aggregation Error: {str(e)}"

    async def count(self, collection: str, filter_dict: dict = None) -> str:
        """Count documents in a collection."""
        try:
            col = self.db[collection]
            n = await col.count_documents(filter_dict or {})
            return f"Count in '{collection}': {n} documents."
        except Exception as e:
            return f"MongoDB Count Error: {str(e)}"


# --- GLOBAL DB INSTANCE ---
db = MongoHandler()

VAD_PLUGIN = silero.VAD.load(min_silence_duration=0.8)
STT_PLUGIN = deepgram.STT(model="nova-2-general")
TTS_PLUGIN = deepgram.TTS(model="aura-hera-en")


async def entrypoint(ctx: JobContext):
    logger.info(f"--- CORTEX II CONNECTING (ROOM: {ctx.room.name}) ---")

    # Connect to MongoDB and discover schema
    await db.connect()
    await db.discover_schema()

    # Inject schema into the system prompt
    dynamic_prompt = f"{SYSTEM_PROMPT}\n\nLIVE SCHEMA SNAPSHOT:\n{json.dumps(SCHEMA_CACHE, indent=2)}"

    chat_ctx = llm.ChatContext(
        items=[llm.ChatMessage(role="system", content=[dynamic_prompt])]
    )

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    # --- TOOL REGISTRATION ---
    class BI2Tools:
        @llm.function_tool(description="Find documents in a MongoDB collection. Use filter_json as a JSON string for filtering (e.g., '{\"status\": \"completed\"}'). Limit defaults to 10.")
        async def find_documents(self, collection: str, filter_json: str = "{}", limit: int = 10):
            logger.info(f"[BI2_FIND] Collection: {collection} | Filter: {filter_json} | Limit: {limit}")
            try:
                filter_dict = json.loads(filter_json)
            except Exception:
                filter_dict = {}
            return await db.find(collection, filter_dict, min(limit, 25))

        @llm.function_tool(description="Run an aggregation pipeline on a MongoDB collection. pipeline_json must be a valid JSON array of pipeline stages.")
        async def aggregate_collection(self, collection: str, pipeline_json: str):
            logger.info(f"[BI2_AGG] Collection: {collection} | Pipeline: {pipeline_json[:80]}...")
            try:
                pipeline = json.loads(pipeline_json)
            except Exception as e:
                return f"Invalid pipeline JSON: {str(e)}"
            return await db.aggregate(collection, pipeline)

        @llm.function_tool(description="Count documents in a MongoDB collection, optionally with a filter.")
        async def count_documents(self, collection: str, filter_json: str = "{}"):
            logger.info(f"[BI2_COUNT] Collection: {collection} | Filter: {filter_json}")
            try:
                filter_dict = json.loads(filter_json)
            except Exception:
                filter_dict = {}
            return await db.count(collection, filter_dict)

        @llm.function_tool(description="List all available MongoDB collections and their field schemas.")
        async def list_schema(self):
            logger.info("[BI2_SCHEMA] Schema requested")
            return f"Available collections and fields:\n{json.dumps(SCHEMA_CACHE, indent=2)}"

    bi2_tools = BI2Tools()

    agent = voice.Agent(
        instructions=dynamic_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(bi2_tools),
    )

    session = AgentSession(
        vad=VAD_PLUGIN,
        stt=STT_PLUGIN,
        llm=llm_plugin,
        tts=TTS_PLUGIN,
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 2.0}},
    )

    # --- COST & TOKEN TRACKING ---
    usage = {
        "input_tokens": 0, "output_tokens": 0,
        "stt_seconds": 0.0, "tts_chars": 0,
        "total_cost": 0.0
    }

    async def broadcast_usage():
        await ctx.room.local_participant.set_metadata(json.dumps({
            "name": AGENT_NAME,
            "usage": usage
        }))

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        for m in usage_data.usage.model_usage:
            if m.type == "llm_usage":
                usage["input_tokens"] = getattr(m, "input_tokens", 0)
                usage["output_tokens"] = getattr(m, "output_tokens", 0)
            elif m.type == "stt_usage":
                usage["stt_seconds"] = getattr(m, "audio_duration", 0.0)
            elif m.type == "tts_usage":
                usage["tts_chars"] = getattr(m, "characters_count", 0)

        llm_cost  = (usage["input_tokens"] / 1_000_000 * 0.15) + (usage["output_tokens"] / 1_000_000 * 0.60)
        stt_cost  = (usage["stt_seconds"] / 60 * 0.0043)
        tts_cost  = (usage["tts_chars"] / 1000 * 0.015)
        usage["total_cost"] = round(llm_cost + stt_cost + tts_cost, 6)

        logger.info(f"[COST_AUDIT] Total: ${usage['total_cost']} | Tokens: {usage['input_tokens']+usage['output_tokens']}")
        asyncio.create_task(broadcast_usage())

    # --- REAL-TIME LOGGERS ---
    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            content = item.content[0] if isinstance(item.content, list) else item.content
            if item.role == "assistant":
                logger.info(f"CORTEX2: {content}")
            elif item.role == "user":
                logger.info(f"USER: {content}")

    @session.on("agent_state_changed")
    def on_state_changed(event: voice.AgentStateChangedEvent):
        logger.info(f"[STATE] Cortex II is now: {event.new_state}")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.room.local_participant.set_metadata(json.dumps({"name": AGENT_NAME}))

    await broadcast_usage()
    await session.start(room=ctx.room, agent=agent)
    logger.info(f"--- [SESSION] Cortex II Intelligence Active ---")


async def request_fnc(req: JobRequest):
    logger.info(f"[JOB_REQ] Room: {req.room.name}")
    await req.accept()
    logger.info(f"[JOB_ACCEPTED] Cortex II accepted job for: {req.room.name}")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name=AGENT_NAME,
        )
    )
