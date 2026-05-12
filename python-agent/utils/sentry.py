import os
import json
import logging
import time
from datetime import datetime
from typing import Dict, Any, List

# --- CONFIG ---
LOGS_DIR = os.path.join(os.path.dirname(__file__), "../swarm_logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# Price per 1M tokens (Approximate OpenAI rates for GPT-4o-mini)
PRICING = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "default": {"input": 0.50, "output": 1.50}
}

class SwarmSentry:
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = os.path.join(LOGS_DIR, f"{agent_name.lower()}_audit.jsonl")
        
        # Setup agent-specific logger
        self.logger = logging.getLogger(f"sentry.{agent_name}")
        self.logger.setLevel(logging.INFO)
        
        # Guardrail Settings
        self.prohibited_keywords = ["password", "secret_key", "internal_db_admin", "drop table", "delete from"]
        
        # Turn Detection / Linguistic Heuristics
        self.hanging_words = ["and", "but", "so", "because", "the", "a", "or", "if", "when", "um", "uh"]
        self.incomplete_punctuation = [",", "...", "-"]

    def is_thought_complete(self, text: str) -> bool:
        """
        Linguistic check to see if the user has likely finished their thought.
        Returns True if complete, False if it sounds like a pause.
        """
        clean_text = text.strip().lower()
        if not clean_text:
            return False
            
        words = clean_text.split()
        last_word = words[-1]
        
        # 1. Check for hanging conjunctions/filler
        if last_word in self.hanging_words:
            self.log_transaction("turn_detection", {"status": "holding", "reason": "hanging_word", "text": clean_text})
            return False
            
        # 2. Check for trailing punctuation that implies more is coming
        if any(clean_text.endswith(p) for p in self.incomplete_punctuation):
            self.log_transaction("turn_detection", {"status": "holding", "reason": "punctuation", "text": clean_text})
            return False
            
        # 3. Length check: Extremely short snippets (1-2 words) often need more context
        # Special Exception for NOVA: It's a copilot that handles short navigation commands.
        if self.agent_name.upper() == "NOVA":
            if len(words) < 2: # Still hold single-word filler unless it's a keyword
                if not any(clean_text.startswith(w) for w in ["yes", "no", "ok", "stop", "nova", "exit", "scores"]):
                    return False
        else:
            if len(words) < 3 and not any(clean_text.startswith(w) for w in ["yes", "no", "ok", "stop", "nova", "cortex"]):
                return False


        return True

    def log_transaction(self, event_type: str, data: Dict[str, Any]):
        """Append a structured event to the local audit log."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "agent": self.agent_name,
            "session": self.session_id,
            "type": event_type,
            **data
        }
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate the cost of an LLM transaction in USD."""
        rates = PRICING.get(model, PRICING["default"])
        input_cost = (input_tokens / 1_000_000) * rates["input"]
        output_cost = (output_tokens / 1_000_000) * rates["output"]
        total = input_cost + output_cost
        
        self.log_transaction("cost_audit", {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": total
        })
        return total

    def check_guardrails(self, text: str) -> bool:
        """
        Simple keyword-based guardrail. 
        Returns True if SAFE, False if BLOCKED.
        """
        text_lower = text.lower()
        for kw in self.prohibited_keywords:
            if kw in text_lower:
                self.log_transaction("guardrail_violation", {
                    "violation": kw,
                    "input_text": text[:100] + "..." # Truncate for privacy
                })
                self.logger.warning(f"GUARDRAIL VIOLATION: Blocked content containing '{kw}'")
                return False
        return True

    def validate_tool_args(self, tool_name: str, args: Dict[str, Any]) -> bool:
        """
        Ensures tool arguments don't contain malicious patterns.
        """
        # Basic SQL injection check for database tools
        if "sql" in tool_name.lower() or "query" in tool_name.lower():
            for val in args.values():
                if isinstance(val, str):
                    if any(cmd in val.lower() for cmd in ["drop", "truncate", "delete", "grant"]):
                        self.log_transaction("security_alert", {
                            "tool": tool_name,
                            "malicious_args": args
                        })
                        return False
        return True

    def start_latency_timer(self):
        return time.perf_counter()

    def stop_latency_timer(self, start_time: float, stage: str):
        elapsed = time.perf_counter() - start_time
        self.log_transaction("performance_audit", {
            "stage": stage,
            "latency_ms": round(elapsed * 1000, 2)
        })
        return elapsed

# Singleton-style usage helper
_sentries = {}

def get_sentry(agent_name: str) -> SwarmSentry:
    if agent_name not in _sentries:
        _sentries[agent_name] = SwarmSentry(agent_name)
    return _sentries[agent_name]
