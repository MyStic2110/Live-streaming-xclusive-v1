import os
import json
import logging
from typing import Tuple, List, Set, Dict, Any, Callable, Awaitable
from .guardrails import InputGuardrail, OutputGuardrail
from .session_manager import SessionManager, SessionIntelligence
from .router import ContextRouter
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from integrations.securelytix import SecurelytixClient
from integrations.mem0_client import Mem0Client

logger = logging.getLogger("swarm_copilot.copilot")


class SwarmCopilot:
    """
    Main orchestrator for the Swarm Agentic Lab Customer Success Copilot.
    Coordinates input validation, stateful context routing, dynamic prompt compilation,
    LLM generation, output safety auditing, and session memory updates.
    """

    def __init__(
        self,
        knowledge_dir: str,
        prompts_dir: str,
        sessions_dir: str,
        llm_caller: Callable[[str, str], Awaitable[str]] = None
    ) -> None:
        """
        Args:
            knowledge_dir: Path to directory containing knowledge base JSONs.
            prompts_dir: Path to directory containing prompt text files.
            sessions_dir: Path to directory containing transient session files.
            llm_caller: An async callable function to invoke the LLM. 
                        Takes (system_prompt, user_query) and returns LLM response string.
        """
        self.knowledge_dir = knowledge_dir
        self.prompts_dir = prompts_dir
        self.sessions_dir = sessions_dir
        
        # Initialize sub-modules
        self.input_guardrail = InputGuardrail()
        self.output_guardrail = OutputGuardrail()
        self.router = ContextRouter(knowledge_dir)
        self.session_manager = SessionManager(sessions_dir)
        self.securelytix = SecurelytixClient()
        self.mem0 = Mem0Client()
        
        self.llm_caller = llm_caller
        
        # Preload static system prompts into memory for zero-disk latency during requests
        self.prompt_cache: Dict[str, str] = {}
        self.preload_prompts()

    def preload_prompts(self) -> None:
        """Reads all prompt files from prompts_dir into memory on startup."""
        os.makedirs(self.prompts_dir, exist_ok=True)
        
        required_prompts = [
            "base_rules.txt",
            "pricing_agent.txt",
            "dev_agent.txt",
            "security_agent.txt",
            "master_agent.txt",
            "crawler_agent.txt",
            "github_agent.txt"
        ]
        
        for name in required_prompts:
            path = os.path.join(self.prompts_dir, name)
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        self.prompt_cache[name] = f.read()
                        logger.info(f"Preloaded prompt template: {name}")
                except Exception as e:
                    logger.error(f"Failed to read prompt file {path}: {e}")
            else:
                logger.warning(f"Required prompt file {name} is missing in {self.prompts_dir}. Using fallback defaults.")
                self.prompt_cache[name] = ""

    async def handle_message(self, user_query: str, session_id: str = None) -> Tuple[str, str]:
        """
        Processes a chat request asynchronously.
        
        Args:
            user_query: The incoming text query from the customer.
            session_id: Optional active session ID. If None, initiates a new session.
            
        Returns:
            A tuple of (response_text, active_session_id).
        """
        # 1. Tier 1 / Tier 2: Input Guardrails (Pre-LLM validation)
        is_safe, refusal_message = self.input_guardrail.validate(user_query)
        
        if not is_safe:
            # If a session ID is not passed, create a transient one so the client stays stateful
            if not session_id:
                session_id, _ = await self.session_manager.create_session()
            return refusal_message, session_id

        # 2. Stateful Session Init / Loading
        if not session_id:
            session_id, session = await self.session_manager.create_session()
            # If user query is empty (just opened the chat), return standard welcome message
            if not user_query.strip():
                welcome = "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?"
                session.memory_summary = "Copilot greeted the user."
                await self.session_manager.save_session(session_id, session)
                return welcome, session_id
        else:
            session = await self.session_manager.load_session(session_id)

        # 2b. Redirect technical / DevOps security queries to DevOps Geni
        query_lower = user_query.lower()
        tech_keywords = [
            "scanner", "sast", "failed", "vulnerability", "vulnerabilities", "owasp",
            "audit runs", "audit history", "security audits", "security audit", "live audit",
            "scan runs", "scan history", "live scan", "logs"
        ]
        if any(kw in query_lower for kw in tech_keywords):
            redirection = (
                "According to Swarm Trust and Security Portal, technical scans, live agent audits, "
                "and vulnerability reports are managed by our DevOps Geni infrastructure agent. "
                "As your Customer Success Copilot, I can assist you with onboarding, high-level compliance queries (like SOC2 or GDPR), "
                "pricing philosophy, and supported integrations. Please launch the DevOps Geni agent to review live scans."
            )
            session.turn_count += 1
            self._update_session_memory(session, user_query, redirection)
            await self.session_manager.save_session(session_id, session)
            return redirection, session_id

        # 2c. Intercept greetings directly in Python (avoid LLM refusal/cost)
        query_clean = user_query.lower().strip().rstrip("!?.")
        greetings = {"hi", "hello", "hey", "yo", "greetings", "good morning", "good afternoon", "good evening"}
        if query_clean in greetings:
            greeting_msg = "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?"
            session.turn_count += 1
            self._update_session_memory(session, user_query, greeting_msg)
            await self.session_manager.save_session(session_id, session)
            return greeting_msg, session_id

        # 3. Tier 3: Stateful Option B Context Retrieval
        # Fall back to session's last active vertical if no keywords match in current query
        context_json, matched_verticals, allowed_urls, is_explicit = self.router.route(
            query=user_query,
            last_vertical=session.last_vertical
        )

        # Retrieve relevant semantic memories from Mem0
        memories = self.mem0.get_relevant_facts(user_id=session_id, query=user_query)

        # 4. Tier 4: Dynamic System Prompt Selection & Compilation
        compiled_system_prompt = self._compile_prompt(matched_verticals, context_json, session, memories)

        # 5. LLM Call
        raw_response = ""
        if self.llm_caller:
            try:
                try:
                    tokenized_system_prompt = await self.securelytix.tokenize(compiled_system_prompt)
                    tokenized_user_query = await self.securelytix.tokenize(user_query)
                    tokenized_user_query = await self.securelytix.detokenize_dates(tokenized_user_query)
                    tokenized_system_prompt = await self.securelytix.detokenize_dates(tokenized_system_prompt)
                except Exception as tokenize_err:
                    logger.error(f"Securelytix tokenization failed: {tokenize_err}. Failing open.")
                    tokenized_system_prompt = compiled_system_prompt
                    tokenized_user_query = user_query
                
                raw_response = await self.llm_caller(tokenized_system_prompt, tokenized_user_query)
            except Exception as e:
                logger.error(f"LLM call failed: {e}")
                raw_response = "I cannot find verified information about that in the Swarm knowledge base."
        else:
            # Fallback mock LLM response for local offline execution & testing
            raw_response = self._mock_llm_generation(matched_verticals, context_json, user_query)

        # 6. Tier 5: Output Safety Auditing
        try:
            detokenized_response = await self.securelytix.detokenize(raw_response)
        except Exception as e:
            logger.error(f"Response detokenization failed: {e}")
            detokenized_response = raw_response
        safe_response = self.output_guardrail.verify(detokenized_response, allowed_urls)

        # 6. Save turn to local Mem0 memory
        self.mem0.add_interaction(user_id=session_id, query=user_query, response=safe_response)

        # 7. Session Intelligence Memory Updates
        session.turn_count += 1
        if is_explicit and matched_verticals:
            # Update the last matched vertical (exclude 'faq' if other topics are present)
            valid_verticals = [v for v in matched_verticals if v != "faq"]
            if valid_verticals:
                session.last_vertical = valid_verticals[0]
                if session.last_vertical not in session.primary_interests:
                    session.primary_interests.append(session.last_vertical)

        # Update lightweight memory summary
        self._update_session_memory(session, user_query, safe_response)
        
        # Async Save session state to disk
        await self.session_manager.save_session(session_id, session)

        return safe_response, session_id

    def _compile_prompt(self, matched_verticals: List[str], context_json: str, session: SessionIntelligence, memories: List[str] = None) -> str:
        """Assembles the final system prompt dynamically based on matched intents."""
        base_rules = self.prompt_cache.get("base_rules.txt", "")
        
        # Select micro-prompt
        if len(matched_verticals) == 1:
            vertical = matched_verticals[0]
            if vertical == "pricing":
                agent_prompt = self.prompt_cache.get("pricing_agent.txt", "")
            elif vertical in ["integrations", "features", "agents"]:
                agent_prompt = self.prompt_cache.get("dev_agent.txt", "")
            elif vertical == "security":
                agent_prompt = self.prompt_cache.get("security_agent.txt", "")
            elif vertical == "crawled_knowledge":
                agent_prompt = self.prompt_cache.get("crawler_agent.txt", "")
            elif vertical == "github_knowledge":
                agent_prompt = self.prompt_cache.get("github_agent.txt", "")
            else:
                agent_prompt = self.prompt_cache.get("master_agent.txt", "")
        else:
            # Multiple verticals matched (Option B) or default fallback
            agent_prompt = self.prompt_cache.get("master_agent.txt", "")

        # Format memories
        memory_str = "None"
        if memories:
            memory_str = "\n".join(f"- {fact}" for fact in memories)

        # Structure final prompt template
        prompt_parts = [
            base_rules,
            "\n",
            agent_prompt,
            "\n## ACTIVE USER SESSION STATE:",
            f"Active interests: {', '.join(session.primary_interests)}",
            f"Prior conversation context: {session.memory_summary or 'None'}",
            f"Retrieved User Context / Persistent Preferences:\n{memory_str}",
            "\n## APPROVED KNOWLEDGE CONTEXT (TRUSTED DATA):",
            "<approved_knowledge>",
            context_json,
            "</approved_knowledge>"
        ]
        
        return "\n".join(prompt_parts)

    def _update_session_memory(self, session: SessionIntelligence, query: str, response: str) -> None:
        """Updates the session's lightweight memory summary with the latest turn details."""
        # Strip long parts of responses to keep it minimal and cheap
        short_query = query[:80] + ("..." if len(query) > 80 else "")
        short_response = response[:120] + ("..." if len(response) > 120 else "")
        
        new_memory = f"Q: {short_query} | A: {short_response}"
        
        if not session.memory_summary:
            session.memory_summary = new_memory
        else:
            # Keep only the last two turns to prevent prompt context bloating
            lines = session.memory_summary.split("\n")
            lines.append(new_memory)
            # Retain maximum of 2 memory lines
            session.memory_summary = "\n".join(lines[-2:])

    def _mock_llm_generation(self, verticals: List[str], context_json: str, query: str = "") -> str:
        """Helper to generate local offline responses when no external LLM client is configured."""
        query_clean = query.lower().strip().rstrip("!?.")
        greetings = {"hi", "hello", "hey", "yo", "greetings", "good morning", "good afternoon", "good evening"}
        if query_clean in greetings:
            return "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?"

        try:
            context_dict = json.loads(context_json)
        except Exception:
            context_dict = {}

        if not context_dict:
            return "I cannot find verified information about that in the Swarm knowledge base."

        # Pricing vertical answer
        if "pricing" in context_dict:
            pricing = context_dict["pricing"]
            philosophy = pricing.get("philosophy", {}).get("title", "")
            contact = pricing.get("contact", {})
            name = contact.get("name", "Murali Dharan")
            phone = contact.get("phone", "+91 97913 88549")
            return f"According to Swarm Pricing guide, we do not offer fixed subscription tiers. Our philosophy is: '{philosophy}'. For custom pricing, please contact our Founder, {name}, at {phone}."

        # Integrations vertical answer
        if "integrations" in context_dict:
            integrations = context_dict["integrations"]
            principles = integrations.get("design_principles", [])
            systems = integrations.get("supported_systems", [])
            return f"According to Swarm Developer Documentation, Swarm is {' and '.join(principles)}. We integrate with your existing systems: {', '.join(systems)}. Philosophy: Stop Renting Intelligence. Own Your Intelligence."

        # Security vertical answer
        if "security" in context_dict:
            sec = context_dict["security"]
            query_lower = query.lower()
            
            # Check if this is an audit/owasp track query
            if any(kw in query_lower for kw in ["owasp", "audit", "scan", "run", "history", "tracker", "report"]):
                return (
                    "According to Swarm Trust and Security Portal, technical scans, live agent audits, "
                    "and vulnerability reports are managed by our DevOps Geni infrastructure agent. "
                    "As your Customer Success Copilot, I can assist you with onboarding, high-level compliance queries (like SOC2 or GDPR), "
                    "pricing philosophy, and supported integrations. Please launch the DevOps Geni agent to review live scans."
                )

            # Check if this is a deployment or hardware query
            if any(kw in query_lower for kw in ["deploy", "deployment", "onprem", "vpc", "privatecloud", "hybrid", "hardware", "tier"]):
                governed = sec.get("governed_deployment", {})
                models = governed.get("models", {})
                model_names = [m.get("title", "") for m in models.values()]
                hardware = sec.get("hardware_requirements_by_tier", {})
                tier_gpus = [t.get("recommended_gpu", "") for t in hardware.values()]
                
                return (
                    f"According to Swarm Trust and Security Portal, Swarm Agentic Lab offers Governed Deployment "
                    f"models: {', '.join(model_names)}. All components operate inside your controlled infrastructure. "
                    f"Hardware options range from Tier 1 ({tier_gpus[0]} for development) up to Tier 3 ({tier_gpus[2]} for hyper-scale swarms)."
                )

            # Otherwise return standard compliance info
            data_residency = sec.get("data_residency", [])
            compliance_desc = sec.get("compliance", {}).get("description", "")
            return f"According to Swarm Trust and Security Portal, Swarm runs within your own environment: {', '.join(data_residency[:3])}. Compliance: {compliance_desc}"

        # Agents vertical answer
        if "agents" in context_dict:
            query_lower = query.lower()
            if "astra" in query_lower:
                return (
                    "According to Swarm Documentation, Astra is a production-ready agent designed to automate content creation and trend research. "
                    "It can search the web, research current trends, publish insights, and send real-time logs."
                )
            elif "devops" in query_lower or "geni" in query_lower:
                return (
                    "According to Swarm Documentation, DevOps Geni is our automated infrastructure agent designed to audit, scan, and deploy agents safely. "
                    "For active security audits, SAST scanner results, or system log auditing, please launch the DevOps Geni agent."
                )
            
            agents = context_dict["agents"]
            agent_details = agents.get("agent_details", [])
            if agent_details:
                clean_agents = []
                for a in agent_details:
                    caps = []
                    for cap in a.get("capabilities", []):
                        if ":" in cap:
                            caps.append(cap.split(":", 1)[1].strip())
                        else:
                            caps.append(cap)
                    caps_str = ", ".join(caps)
                    clean_agents.append(f"{a['name']} (Capabilities: {caps_str})")
                return f"According to Swarm Documentation, pre-built agents include: {'; '.join(clean_agents)}."
            return "According to Swarm Documentation, we support pre-built agents."

        # Fallback FAQ
        if "faq" in context_dict:
            faq = context_dict["faq"]
            general = faq.get("general_faqs", [])
            if general:
                return f"According to Swarm FAQ, {general[0]['answer']}"

        return "I cannot find verified information about that in the Swarm knowledge base."
