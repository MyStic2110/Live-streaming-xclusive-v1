import os
import json
import re
import logging
from typing import Dict, Any, List, Set, Tuple

logger = logging.getLogger("swarm_copilot.router")


def _normalize(text: str) -> str:
    """Lowercase and strip all non-alphanumeric characters.
    
    Ensures 'DevOps Geni', 'devops-geni', 'DEVOPS_GENI', 'devopsgeni'
    all collapse to the same token for comparison.
    """
    return re.sub(r"[^a-z0-9]", "", text.lower())


class ContextRouter:
    """
    Tier 3 & Tier 4: Context Router.
    Analyzes queries to route them to the correct vertical JSON knowledge bases.
    Implements Option B (multiple vertical matching) and session state fallbacks.
    """

    def __init__(self, knowledge_dir: str) -> None:
        """
        Args:
            knowledge_dir: Absolute path to the directory containing knowledge JSONs.
        """
        self.knowledge_dir = knowledge_dir
        self.kb_cache: Dict[str, Any] = {}
        self.url_extractor = re.compile(
            r"https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?"
        )
        
        # Initialize and preload all vertical JSON files into memory on startup
        self.preload_knowledge_base()

        # Define keyword matrices for each vertical.
        # NOTE: Do NOT manually list casing/spacing variants — the matching engine
        # normalizes both the query and each keyword via _normalize() before
        # comparing, so "DevOps Geni", "devops-geni", "DEVOPS GENI", and
        # "devopsgeni" all match the single canonical slug "devopsgeni".
        self.mapping: Dict[str, List[str]] = {
            "pricing": [
                "price", "pricing", "cost", "tier", "subscription", "plan", "freetrial",
                "enterprise", "pay", "billing", "discount", "license"
            ],
            "integrations": [
                "slack", "github", "webhook", "api", "integration", "connect",
                "integrate", "notification", "workflowtrigger"
            ],
            "security": [
                "soc2", "gdpr", "compliance", "encryption", "privacy", "secure",
                "dataresidency", "sso", "saml", "tls", "aes256", "auth",
                "owasp", "audit", "scanner", "scan", "runs", "history",
                "deploy", "deployment", "governed", "onprem", "onpremises",
                "privatecloud", "hybrid", "vpc", "kubernetes", "k8s",
                "dockercompose", "hardware", "requirements"
            ],
            "features": [
                "workflow", "capabilities", "limit", "run", "platform",
                "create", "delete", "humanintheloop", "designer", "sandbox"
            ],
            "agents": [
                # intent keywords
                "agent", "prebuilt", "builtin", "listagents", "whatagents", "showagents",
                # agent IDs (normalized — spaces/dashes/underscores handled by _normalize)
                "astra",
                "devopsgeni",       # DevOps Geni / devops-geni / DEVOPS GENI
                "aivyuh",           # Aivyuh / AI Vyuh / ai-vyuh
                "nova",
                "seva",
                "octane",
                "reels",
                "rehearsal",        # Silent Rehearsal
                "silentrehearsal",
                "shadowagent",      # Shadow Agent
                "lina",
                "martech",
                "vision",
                "weatheragent",     # Weather Agent
                "cortex",           # BI / Cortex / Cortex II
                "bi",
            ]
        }

    def preload_knowledge_base(self) -> None:
        """Loads all JSON vertical files from the knowledge directory into memory."""
        try:
            if not os.path.exists(self.knowledge_dir):
                logger.warning(f"Knowledge directory {self.knowledge_dir} does not exist. Initializing empty.")
                return

            for file_name in os.listdir(self.knowledge_dir):
                if file_name.endswith(".json"):
                    vertical = file_name.replace(".json", "")
                    file_path = os.path.join(self.knowledge_dir, file_name)
                    
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            self.kb_cache[vertical] = json.load(f)
                            logger.info(f"Preloaded knowledge vertical: {vertical}")
                    except Exception as e:
                        logger.error(f"Failed to read JSON file {file_path}: {e}")
                        
        except Exception as e:
            logger.error(f"Error preloading knowledge base: {e}")

    def route(self, query: str, last_vertical: str = "faq") -> Tuple[str, List[str], Set[str]]:
        """
        Determines the matching verticals for a query, extracts matching JSON,
        and aggregates allowed URLs.
        
        Args:
            query: User's search query.
            last_vertical: Fallback vertical from session memory.
            
        Returns:
            A tuple containing:
                1. Serialized JSON string of the combined vertical contexts.
                2. A list of matched vertical names.
                3. A set of allowed URLs parsed from the matched context.
        """
        query_lower = query.lower()
        query_norm = _normalize(query)          # e.g. "DevOps Geni" -> "devopsgeni"
        query_clean = query_lower.strip().rstrip("!?.")
        greetings = {"hi", "hello", "hey", "yo", "greetings", "goodmorning", "goodafternoon", "goodevening"}
        is_greeting = _normalize(query_clean) in greetings
        matched_verticals: List[str] = []

        # 1. Match query against keywords using normalized comparison so that
        #    casing, spaces, dashes, and underscores never cause a miss.
        #    e.g. "DevOps Geni" / "devops-geni" / "DEVOPS_GENI" all match "devopsgeni".
        for vertical, keywords in self.mapping.items():
            for keyword in keywords:
                kw_norm = _normalize(keyword)
                # Check normalized full-query substring match OR word-boundary match in original
                if kw_norm in query_norm or keyword.lower() in query_lower:
                    matched_verticals.append(vertical)
                    break

        # 2. State-based Fallback:
        # If no keywords matched, check if we can fall back to the last active vertical.
        # Otherwise, fall back to general FAQ.
        if not matched_verticals:
            if last_vertical in self.kb_cache and not is_greeting:
                logger.info(f"No direct keywords matched. Falling back to session vertical: {last_vertical}")
                matched_verticals = [last_vertical]
            else:
                logger.info("No keywords or session fallback matched. Routing to default: faq")
                matched_verticals = ["faq"]

        # 3. Retrieve and merge vertical JSON contexts
        merged_context: Dict[str, Any] = {}
        allowed_urls: Set[str] = set()

        for vertical in matched_verticals:
            if vertical in self.kb_cache:
                vertical_data = self.kb_cache[vertical].copy()
                if vertical == "security":
                    aivyuh_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "aivyuh"))
                    runs_path = os.path.join(aivyuh_dir, "audit_runs.json")
                    history_path = os.path.join(aivyuh_dir, "audit_history.json")
                    
                    if os.path.exists(runs_path):
                        try:
                            with open(runs_path, "r", encoding="utf-8") as f:
                                vertical_data["live_audit_runs"] = json.load(f)
                        except Exception:
                            pass
                    if os.path.exists(history_path):
                        try:
                            with open(history_path, "r", encoding="utf-8") as f:
                                vertical_data["live_audit_history"] = json.load(f)
                        except Exception:
                            pass
                merged_context[vertical] = vertical_data
                
                # Strip 'methods' from agent_details before sending to the LLM.
                # The methods array contains raw function signatures (internal API
                # details) that bloat context by ~25% without helping customer answers.
                # URL extraction happens above on the full data so no URLs are lost.
                if vertical == "agents" and "agent_details" in vertical_data:
                    slim_data = dict(vertical_data)
                    slim_data["agent_details"] = [
                        {k: v for k, v in agent.items() if k != "methods"}
                        for agent in vertical_data["agent_details"]
                    ]
                    merged_context[vertical] = slim_data
                
                # Extract all URLs from this vertical payload to compile our whitelist
                # for the Tier 5 output guardrail url verifier.
                serialized_chunk = json.dumps(vertical_data)
                urls = self.url_extractor.findall(serialized_chunk)
                for url in urls:
                    # Clean trailing characters that might be caught
                    allowed_urls.add(url.rstrip(".,;!)?]}\\"))

        # Add the base platform domain to allowed URLs
        allowed_urls.add("https://swarm.ai")
        allowed_urls.add("https://docs.swarm.ai")

        return json.dumps(merged_context, indent=2), matched_verticals, allowed_urls
