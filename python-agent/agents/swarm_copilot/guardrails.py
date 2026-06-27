import os
import re
import logging
from typing import Tuple, List, Set

logger = logging.getLogger("swarm_copilot.guardrails")


class GuardrailException(Exception):
    """Base exception class for Guardrail violations and errors."""
    pass


class InputGuardrail:
    """
    Tier 1 & Tier 2: Input Guardrail.
    Validates user query string for PII, secrets, credentials, and connection strings.
    """

    def __init__(self) -> None:
        # Pre-compile regex patterns for maximum runtime efficiency.
        
        # 1. Database Connection Strings (e.g. mongodb://, postgresql://, mysql://, redis://)
        # Catches connection strings with or without credentials
        self.db_url_pattern = re.compile(
            r"\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis(?:s)?|sqlite|mssql|amqp(?:s)?):\/\/"
            r"(?:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_%-]+)?@)?[^\s]+\b",
            re.IGNORECASE
        )
        
        # 2. Credit Cards (Luhn-like length check: 13 to 16 digits)
        self.credit_card_pattern = re.compile(r"\b(?:\d[ -]*?){13,16}\b")
        
        # 3. High-Entropy Secrets & API Keys (Alphanumeric/dashes/underscores of 32+ characters)
        # Excludes standard emails by ensuring no '@' exists in the sequence
        self.secret_pattern = re.compile(r"\b[a-zA-Z0-9_-]{32,}\b")
        
        # 4. System Environment/Credential Snippets
        self.env_snippet_pattern = re.compile(
            r"\b(?:ENV_|PASSWORD|SECRET_KEY|DB_)\w*\b",
            re.IGNORECASE
        )
        
        # 5. Common Prompt Injection Signatures
        self.jailbreak_patterns = [
            re.compile(r"ignore (?:all )?previous instructions", re.IGNORECASE),
            re.compile(r"reveal your system prompt", re.IGNORECASE),
            re.compile(r"act as", re.IGNORECASE),
            re.compile(r"developer mode", re.IGNORECASE),
            re.compile(r"\bDAN\b"),
            re.compile(r"override security", re.IGNORECASE)
        ]

        # 6. Email validation pattern (to explicitly allow emails and prevent false-positives in secret checks)
        self.email_pattern = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")

    def validate(self, query: str) -> Tuple[bool, str]:
        """
        Scans a user query for security violations.
        
        Args:
            query: The raw string query from the user.
            
        Returns:
            A tuple of (is_safe, refusal_message).
        """
        try:
            # First, check for prompt injection / jailbreak attempts
            for pattern in self.jailbreak_patterns:
                if pattern.search(query):
                    logger.warning("Input guardrail triggered: Jailbreak signature detected.")
                    return False, "I can only answer questions related to the Swarm Agentic Platform."

            # Check for database connection strings
            if self.db_url_pattern.search(query):
                logger.warning("Input guardrail triggered: Database connection string detected.")
                return False, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."

            # Check for credit card numbers
            if self.credit_card_pattern.search(query):
                logger.warning("Input guardrail triggered: Credit card pattern detected.")
                return False, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."

            # Check for environment credentials variables
            if self.env_snippet_pattern.search(query):
                # Verify it's not just a general query and has an assignment or suspicious suffix
                if "=" in query or ":" in query:
                    logger.warning("Input guardrail triggered: Environment credential snippet detected.")
                    return False, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."

            # Check for secrets/keys (excluding valid emails to prevent false-positives)
            # Find all words that are 32+ characters
            potential_secrets = self.secret_pattern.findall(query)
            for secret in potential_secrets:
                # If it's a valid email, allow it
                if self.email_pattern.match(secret):
                    continue
                logger.warning("Input guardrail triggered: High-entropy secret detected.")
                return False, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."

            return True, ""
            
        except Exception as e:
            logger.error(f"Error executing input guardrails validation: {e}")
            # Fail closed: reject query if guardrails raise an error
            return False, "I can only answer questions related to the Swarm Agentic Platform."


class OutputGuardrail:
    """
    Tier 5: Output Guardrail.
    Verifies that the generated LLM response is safe, free of competitor mentions,
    has only valid links, and doesn't leak prompt details.
    """

    def __init__(self) -> None:
        self.competitors = ["crewai", "autogen", "langchain", "semantic kernel"]
        
        # Regex to extract URLs from output
        self.url_pattern = re.compile(
            r"https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?"
        )
        
        # Instruction leakage patterns
        self.leak_patterns = [
            re.compile(r"approved_knowledge", re.IGNORECASE),
            re.compile(r"system prompt", re.IGNORECASE),
            re.compile(r"internal instruction", re.IGNORECASE),
            re.compile(r"<approved_knowledge>", re.IGNORECASE)
        ]

    def verify(self, generated_response: str, allowed_urls: Set[str]) -> str:
        """
        Audits the generated LLM response.
        
        Args:
            generated_response: The raw response text returned by the LLM.
            allowed_urls: A set of verified URLs that are present in the loaded context.
            
        Returns:
            The verified (and potentially rewritten) response string.
        """
        try:
            response_lower = generated_response.lower()

            # 1. Check for competitor mentions
            if any(competitor in response_lower for competitor in self.competitors):
                logger.warning("Output guardrail triggered: Competitor mention found.")
                return "Please evaluate platforms based on your business requirements. I can explain Swarm capabilities and features."

            # 2. Check for system instruction leakages
            for pattern in self.leak_patterns:
                if pattern.search(generated_response):
                    logger.warning("Output guardrail triggered: System instruction leakage detected.")
                    return "I can only answer questions related to the Swarm Agentic Platform."

            # 3. Verify URLs to prevent link hallucinations
            found_urls = self.url_pattern.findall(generated_response)
            for url in found_urls:
                # Clean trailing punctuation from URL match
                clean_url = url.rstrip(".,;!)?]}")
                
                # Check if the URL exists in our allowed set.
                # If not, rewrite it to the root domain.
                if clean_url not in allowed_urls:
                    logger.warning(f"Output guardrail triggered: Hallucinated URL detected: {clean_url}")
                    # Replace the specific hallucinated URL with the root platform domain
                    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
                    generated_response = generated_response.replace(url, frontend_url)

            return generated_response

        except Exception as e:
            logger.error(f"Error executing output guardrails verification: {e}")
            return "I can only answer questions related to the Swarm Agentic Platform."
