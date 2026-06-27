import os
import sys
import socket
import urllib.request
import json
from datetime import datetime

# Define color constants for console output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# Handle Windows terminal color enablement
if sys.platform == "win32":
    os.system("color")

def check_port(host, port, timeout=2.0):
    """Attempt a raw TCP connection to a host and port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

def check_http_endpoint(url, timeout=2.0):
    """Attempt a GET request to an HTTP endpoint and verify 2xx response."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SwarmOpsHealthcheck/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = response.status
            if 200 <= status < 300:
                return True, f"HTTP {status}"
            return False, f"HTTP {status}"
    except Exception as e:
        return False, str(e)

def run_diagnostics():
    print(f"{BOLD}{CYAN}================================================================{RESET}")
    print(f"{BOLD}{CYAN}             SWARM AGENT OPS ENTERPRISE HEALTH DIAGNOSTIC        {RESET}")
    print(f"{BOLD}{CYAN}================================================================{RESET}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("Scanning active platform components...\n")

    # Define targets to check
    # Format: (Friendly Name, Host, Port, Check Type, Check Target)
    targets = [
        ("PostgreSQL Database", "127.0.0.1", 5433, "socket", None),
        ("Redis Cache Store", "127.0.0.1", 6379, "socket", None),
        ("LiveKit Server", "127.0.0.1", 7880, "socket", None),
        ("Securelytix Tokenizer", "127.0.0.1", 8080, "socket", None),
        ("SearxNG Search engine", "127.0.0.1", 8081, "socket", None),
        ("Qdrant Vector Database", "127.0.0.1", 6333, "http", "http://127.0.0.1:6333/collections"),
        ("Mem0 Sidecar Daemon", "127.0.0.1", 8770, "http", "http://127.0.0.1:8770/health"),
        ("Node.js Backend Server", "127.0.0.1", 3002, "http", "http://127.0.0.1:3002/api/whitelabel/config")
    ]

    all_passed = True
    print(f"{BOLD}{'Component Name':<30} | {'Status':<10} | {'Details / Diagnosis':<30}{RESET}")
    print("-" * 80)

    for name, host, port, method, endpoint in targets:
        status_text = ""
        is_up = False
        details = ""

        # Step 1: Basic port check
        port_open = check_port(host, port)
        
        if port_open:
            if method == "socket":
                is_up = True
                details = f"TCP port {port} open and accepting connections."
            elif method == "http" and endpoint:
                http_up, details = check_http_endpoint(endpoint)
                if http_up:
                    is_up = True
                else:
                    details = f"Port open but HTTP check failed: {details}"
        else:
            details = f"Connection refused on TCP port {port}. Service likely offline."

        if is_up:
            status_text = f"{GREEN}ONLINE{RESET}"
            print(f"{name:<30} | {status_text:<19} | {details:<30}")
        else:
            all_passed = False
            status_text = f"{RED}OFFLINE{RESET}"
            print(f"{name:<30} | {status_text:<19} | {RED}{details:<30}{RESET}")

    # File integrity check of Python Agent structure
    print(f"\n{BOLD}Verifying codebase structures and static assets...{RESET}")
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(scripts_dir)
    
    agent_dir = os.path.join(root_dir, "python-agent")
    knowledge_path = os.path.join(agent_dir, "knowledge", "agents.json")
    
    if os.path.exists(knowledge_path):
        try:
            with open(knowledge_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            agents = data.get("agent_details", [])
            print(f"[{GREEN}OK{RESET}] Loaded knowledge base agents.json. Found {len(agents)} registered agents.")
            
            missing_agents = []
            for agent in agents:
                agent_id = agent.get("id")
                # Exclude pseudo-agents
                if agent_id in ["bi", "bi2", "martech", "reels"]:
                    # These might map differently
                    continue
                # Search path for agent script file
                possible_paths = [
                    os.path.join(agent_dir, "agents", agent_id, f"{agent_id}.py"),
                    os.path.join(agent_dir, "agents", agent_id, f"{agent_id}_agent.py")
                ]
                if not any(os.path.exists(p) for p in possible_paths):
                    missing_agents.append(agent_id)
            
            if missing_agents:
                print(f"[{YELLOW}WARN{RESET}] The following registered agents do not have script source files in python-agent/agents/: {missing_agents}")
            else:
                print(f"[{GREEN}OK{RESET}] All registered agent source scripts verified intact.")
        except Exception as e:
            print(f"[{RED}FAIL{RESET}] Failed to parse/read agents.json: {e}")
    else:
        print(f"[{RED}FAIL{RESET}] Missing core knowledge file agents.json at: {knowledge_path}")

    print(f"\n{BOLD}{CYAN}================================================================{RESET}")
    if all_passed:
        print(f"{BOLD}{GREEN}           DIAGNOSTIC STATUS: ALL CRITICAL SERVICES ONLINE     {RESET}")
    else:
        print(f"{BOLD}{RED}           DIAGNOSTIC STATUS: DEGRADED / OFFLINE SERVICES DETECTED {RESET}")
    print(f"{BOLD}{CYAN}================================================================{RESET}")

if __name__ == "__main__":
    run_diagnostics()
