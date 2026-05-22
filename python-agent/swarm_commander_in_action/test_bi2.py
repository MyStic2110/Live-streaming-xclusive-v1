import os
import sys
import json
import asyncio

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action.helpers import get_openai_client
from agents.bi2 import bi2_agent
from agents.bi2.bi2_agent import MongoHandler, SYSTEM_PROMPT

async def run_test():
    try:
        # Initialize MongoDB connection
        db = MongoHandler()
        await db.connect()
        await db.discover_schema()
        
        # Access SCHEMA_CACHE via bi2_agent module globals
        schema_cache = bi2_agent.SCHEMA_CACHE

        client = get_openai_client()
        user_question = "How many documents are there in the matches collection?"
        
        dynamic_prompt = f"{SYSTEM_PROMPT}\n\nLIVE SCHEMA SNAPSHOT:\n{json.dumps(schema_cache, indent=2)}"
        
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "count_documents",
                    "description": "Count documents in a MongoDB collection, optionally with a filter.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "collection": {
                                "type": "string",
                                "description": "The name of the collection to count documents in."
                            },
                            "filter_json": {
                                "type": "string",
                                "description": "A JSON string filter for filtering the count."
                            }
                        },
                        "required": ["collection"]
                    }
                }
            }
        ]
        
        messages = [
            {"role": "system", "content": dynamic_prompt},
            {"role": "user", "content": user_question}
        ]
        
        response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        
        choice = response.choices[0]
        message = choice.message
        
        if not message.tool_calls:
            return False, "Agent did not generate a tool call to count documents."
        
        tool_call = message.tool_calls[0]
        if tool_call.function.name != "count_documents":
            return False, f"Agent called wrong tool: {tool_call.function.name}"
            
        args = json.loads(tool_call.function.arguments)
        collection = args.get("collection")
        filter_json = args.get("filter_json", "{}")
        
        try:
            filter_dict = json.loads(filter_json)
        except Exception:
            filter_dict = {}
            
        # Execute count on local Mongo DB handler
        result = await db.count(collection, filter_dict)
        
        # Send it back to LLM to get the response
        messages.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": [
                {
                    "id": tool_call.id,
                    "type": "function",
                    "function": {
                        "name": "count_documents",
                        "arguments": tool_call.function.arguments
                    }
                }
            ]
        })
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "name": "count_documents",
            "content": result
        })
        
        final_response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages
        )
        response_text = final_response.choices[0].message.content
        
        if "68" in response_text:
            return True, f"Success! Answered correctly: {response_text.strip()}"
        else:
            return False, f"Expected count 68 in response, got: {response_text}"
            
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
