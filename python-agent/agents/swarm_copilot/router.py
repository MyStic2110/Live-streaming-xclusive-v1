import os
import json
import re
import logging
from typing import Dict, Any, List, Set, Tuple
from fastembed import TextEmbedding

logger = logging.getLogger("swarm_copilot.router")


def _normalize(text: str) -> str:
    """Lowercase and strip all non-alphanumeric characters.
    
    Ensures 'DevOps Geni', 'devops-geni', 'DEVOPS_GENI', 'devopsgeni'
    all collapse to the same token for comparison.
    """
    return re.sub(r"[^a-z0-9]", "", text.lower())

def _get_query_words(query: str, ignored_words: set) -> list:
    if not query:
        return []
    processed = query.lower()
    months = {
        "january": "01", "jan": "01",
        "february": "02", "feb": "02",
        "march": "03", "mar": "03",
        "april": "04", "apr": "04",
        "may": "05",
        "june": "06", "jun": "06",
        "july": "07", "jul": "07",
        "august": "08", "aug": "08",
        "september": "09", "sep": "09",
        "october": "10", "oct": "10",
        "november": "11", "nov": "11",
        "december": "12", "dec": "12"
    }
    for month, num in months.items():
        processed = re.sub(rf"\b{month}\b", f"{month} {num}", processed)
        
    words = re.split(r"[^a-z0-9]+", processed)
    query_words = []
    for w in words:
        if not w:
            continue
        if (len(w) > 3 or (w.isdigit() and len(w) == 2)) and w not in ignored_words:
            query_words.append(w)
    return query_words

def is_follow_up_query(query: str) -> bool:
    """Detects if the query is a follow-up to a previous topic."""
    query_lower = query.lower()
    words = set(re.split(r"[^a-z0-9]+", query_lower))
    follow_up_tokens = {
        "it", "that", "this", "they", "them", "these", "those",
        "more", "detail", "details", "explain", "elaborate", "why", "how",
        "yes", "no", "ok", "okay", "sure", "tell", "show", "get", "describe",
        "previous", "above", "below", "following", "latter", "former"
    }
    if words.intersection(follow_up_tokens):
        return True
    
    if any(query_lower.startswith(prefix) for prefix in ["is ", "are ", "can ", "could ", "would ", "does ", "do ", "should ", "will ", "what "]):
        return True
        
    return False


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

        # Initialize fastembed semantic router
        try:
            self.embedder = TextEmbedding()
            self.vertical_descriptions = {
                "pricing": "Pricing tiers, enterprise subscriptions, custom contracts, plans, billing cycles, discounts, licensing fees, costs, free trial details.",
                "integrations": "Integrations with external services, connecting tools, webhooks, Slack alerts, GitHub status syncs, APIs, and automated triggers.",
                "security": "Security audits, compliance standards, SOC2, GDPR, data residency policies, encryption keys, SSO/SAML authorization, zero-trust deployment options, private cloud VPC installation requirements.",
                "features": "Core platform capabilities, workflow designers, run limits, human-in-the-loop validation, sandbox execution, visual builders, and platform limits.",
                "agents": "Custom built-in AI agents, including Astra, DevOps Geni, Aivyuh, Nova, Seva, Octane, and Silent Rehearsal. List and capabilities of different specialized agents in the fleet.",
                "crawled_knowledge": "Web crawled information from our public blogs, social media posts, reels, articles, stories, podcasts, research insights, and video scripts.",
                "github_knowledge": "GitHub repository files, directory paths, source code implementation files, Git branches, pulls, commits, clones, and function definitions."
            }
            self.vertical_embeddings = {}
            for vertical, desc in self.vertical_descriptions.items():
                self.vertical_embeddings[vertical] = list(self.embedder.embed([desc]))[0].tolist()
            logger.info("Initialized local fastembed intent router successfully.")
        except Exception as e:
            self.embedder = None
            logger.error(f"Failed to initialize local fastembed intent router: {e}")

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
            ],
            "crawled_knowledge": [
                "blog", "blogs", "post", "posts", "reel", "reels", "script", "scripts",
                "article", "articles", "idea", "ideas", "freeform", "insight", "insights",
                "writeup", "writeups", "socialmedia", "rehearsal", "podcast"
            ],
            "github_knowledge": [
                "github", "git", "repo", "repository", "codebase", "source code", "implementation",
                "functions", "code", "file", "directories", "branch", "pull", "clone"
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

    def route(self, query: str, last_vertical: str = "faq") -> Tuple[str, List[str], Set[str], bool]:
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

        # 1.5. Tier 2: Slow Path (Semantic Embeddings)
        if not matched_verticals and not is_greeting and len(query.strip()) > 3 and self.embedder:
            try:
                query_vector = list(self.embedder.embed([query]))[0].tolist()
                best_vertical = None
                best_score = -1.0
                
                for vertical, vec in self.vertical_embeddings.items():
                    score = sum(q * v for q, v in zip(query_vector, vec))
                    if score > best_score:
                        best_score = score
                        best_vertical = vertical
                
                if best_score > 0.50 and best_vertical:
                    logger.info(f"[SEMANTIC ROUTER] Matched vertical '{best_vertical}' with score: {best_score:.4f}")
                    matched_verticals.append(best_vertical)
            except Exception as e:
                logger.error(f"Semantic embedding routing failed: {e}")

        ignored_words = {
            "swarm", "copilot", "platform", "platforms", "agent", "agents", "cortex", "system", "systems",
            "what", "where", "when", "which", "who", "whom", "how", "why", "please", "would",
            "could", "should", "does", "do", "doing", "done", "will", "shall", "their", "there",
            "about", "information", "question", "query", "details", "explain", "describe", "support",
            "data", "stored", "sources", "source", "file", "files", "code", "database", "db", "json",
            "many", "much", "find", "search", "show", "list", "get", "using", "use", "user", "users",
            "create", "deploy", "setup", "onboarding", "success", "customer", "build", "integration",
            "integrations", "feature", "features", "pricing", "security", "audit", "scanner", "scan",
            "runs", "history", "analytics",
            "call", "calls", "phone", "number", "numbers", "email", "emails", "send", "sending", "sent",
            "write", "writing", "written", "news", "today", "yesterday", "tomorrow", "again", "stx",
            "token", "tokens", "tokenization", "key", "keys", "secret", "secrets", "password", "passwords",
            "credential", "credentials", "id", "ids", "uuid", "uuids"
        }

        # Dynamic matching for crawled knowledge based on terms inside pages
        if "crawled_knowledge" in self.kb_cache and "pages" in self.kb_cache["crawled_knowledge"]:
            query_words = _get_query_words(query, ignored_words)
            if query_words:
                has_match = any(
                    any(
                        re.search(rf"\b{re.escape(word)}\b", page.get("title", ""), re.IGNORECASE) or
                        re.search(rf"\b{re.escape(word)}\b", page.get("content", ""), re.IGNORECASE)
                        for word in query_words
                    )
                    for page in self.kb_cache["crawled_knowledge"]["pages"]
                )
                if has_match and "crawled_knowledge" not in matched_verticals:
                    matched_verticals.append("crawled_knowledge")

        # Dynamic matching for GitHub knowledge based on terms inside pages/files
        if "github_knowledge" in self.kb_cache and "pages" in self.kb_cache["github_knowledge"]:
            query_words = _get_query_words(query, ignored_words)
            if query_words:
                has_match = any(
                    any(
                        re.search(rf"\b{re.escape(word)}\b", page.get("title", ""), re.IGNORECASE) or
                        re.search(rf"\b{re.escape(word)}\b", page.get("content", ""), re.IGNORECASE)
                        for word in query_words
                    )
                    for page in self.kb_cache["github_knowledge"]["pages"]
                )
                if has_match and "github_knowledge" not in matched_verticals:
                    matched_verticals.append("github_knowledge")

        # 2. State-based Fallback:
        # If no keywords matched, check if we can fall back to the last active vertical.
        # Otherwise, fall back to general FAQ.
        is_explicit = len(matched_verticals) > 0

        # 2. State-based Fallback:
        # If no keywords matched, check if we can fall back to the last active vertical.
        # Otherwise, fall back to general FAQ.
        if not matched_verticals:
            if last_vertical in self.kb_cache and not is_greeting and is_follow_up_query(query):
                logger.info(f"No direct keywords matched. Query is follow-up. Falling back to session vertical: {last_vertical}")
                matched_verticals = [last_vertical]
            else:
                logger.info("No keywords or session fallback matched (or not a follow-up). Routing to default: faq")
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
                elif vertical in ["crawled_knowledge", "github_knowledge"] and "pages" in vertical_data:
                    query_words = _get_query_words(query, ignored_words)
                    relevant_pages = []
                    for page in vertical_data["pages"]:
                        title_lower = page.get("title", "").lower()
                        content_lower = page.get("content", "").lower()
                        matches = 0
                        for word in query_words:
                            if word in title_lower:
                                matches += 3
                            if word in content_lower:
                                matches += 1
                        if matches > 0:
                            page_copy = dict(page)
                            page_copy["relevanceScore"] = matches
                            relevant_pages.append(page_copy)
                    relevant_pages.sort(key=lambda x: x["relevanceScore"], reverse=True)
                    vertical_data["pages"] = [
                        {k: v for k, v in p.items() if k != "relevanceScore"}
                        for p in relevant_pages[:3]
                    ]
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

        return json.dumps(merged_context, indent=2), matched_verticals, allowed_urls, is_explicit
