import sys
import os
import json
from dotenv import load_dotenv

# Ensure python path matches root of python-agent
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from integrations.mem0_client import Mem0Client

def main():
    # Load environment variables (.env) from python-agent directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(dotenv_path=os.path.join(base_dir, ".env"))
    
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Invalid arguments. Usage: mem0_cli.py <action> <user_id> <query> [response]"}))
        sys.exit(1)
        
    action = sys.argv[1]
    user_id = sys.argv[2]
    
    # Initialize Mem0 client. If the memory backend is unavailable (e.g. the
    # embedded Qdrant lock is held by another process), fail LOUDLY with a
    # non-zero exit so the Node bridge logs a real error instead of silently
    # believing a dropped write succeeded.
    client = Mem0Client()
    if client.memory is None:
        print(json.dumps({
            "error": client.init_error or "mem0 memory backend unavailable",
            "memory_unavailable": True
        }))
        sys.exit(3)

    if action == "add":
        query = sys.argv[3]
        response = sys.argv[4] if len(sys.argv) > 4 else ""
        client.add_interaction(user_id=user_id, query=query, response=response)
        print(json.dumps({"success": True}))
        
    elif action == "search":
        query = sys.argv[3]
        facts = client.get_relevant_facts(user_id=user_id, query=query)
        print(json.dumps({"facts": facts}))
        
    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
