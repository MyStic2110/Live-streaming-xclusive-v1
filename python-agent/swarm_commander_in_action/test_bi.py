import os
import sys
import json
import asyncio

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action.helpers import get_openai_client
from agents.bi.bi_agent import MySQLHandler, SYSTEM_PROMPT, CACHE_FILE

async def run_test():
    try:
        db = MySQLHandler()
        await db.initialize_schema()
        
        with open(CACHE_FILE, "r") as f:
            schema_cache = json.load(f)

        client = get_openai_client()
        user_question = "How many users are registered in the authentication_userregistration table?"
        dynamic_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT DATABASE SCHEMA:\n{json.dumps(schema_cache, indent=2)}"
        
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "query_data",
                    "description": "Query the database for information. ONLY SELECT queries allowed.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "sql_query": {
                                "type": "string",
                                "description": "The exact SQL select query to run."
                            }
                        },
                        "required": ["sql_query"]
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
            return False, "Agent did not generate a tool call to query database."
        
        tool_call = message.tool_calls[0]
        if tool_call.function.name != "query_data":
            return False, f"Agent called wrong tool: {tool_call.function.name}"
            
        args = json.loads(tool_call.function.arguments)
        sql = args.get("sql_query")
        
        # Execute query on local MySQL DB
        result = await db.execute_query(sql)
        
        # Send it back to LLM to get the response
        messages.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": [
                {
                    "id": tool_call.id,
                    "type": "function",
                    "function": {
                        "name": "query_data",
                        "arguments": tool_call.function.arguments
                    }
                }
            ]
        })
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "name": "query_data",
            "content": result
        })
        
        final_response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages
        )
        response_text = final_response.choices[0].message.content
        
        if "653" in response_text:
            return True, f"Success! Answered correctly: {response_text.strip()}"
        else:
            return False, f"Expected user count 653 in response, got: {response_text}"
            
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    success, msg = asyncio.run(run_test())
    print(f"Status: {'PASS' if success else 'FAIL'} | Details: {msg}")
    sys.exit(0 if success else 1)
