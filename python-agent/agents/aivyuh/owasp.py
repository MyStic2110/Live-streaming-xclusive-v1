import ast
import json
from pathlib import Path

# ==========================================
# OWASP Top 10 for LLM Applications - Evidence Patterns
# ==========================================
CONTROL_PATTERNS = {
    # LLM01: Prompt Injection
    "LLM01": { "positive": ["sanitize_prompt", "prompt_guard", "system_prompt_isolation", "input_validation", "NeMoGuardrails"] },
    
    # LLM02: Insecure Output Handling
    "LLM02": { "positive": ["sanitize_output", "escape_html", "xss_filter", "output_validation", "DOMPurify"] },
    
    # LLM03: Training Data Poisoning
    "LLM03": { "positive": ["verify_data_hash", "data_provenance", "anomaly_detection", "outlier_removal", "dataset_integrity_check"] },
    
    # LLM04: Model Denial of Service
    "LLM04": { "positive": ["rate_limit", "max_tokens", "timeout", "throttle", "resource_cap"] },
    
    # LLM05: Supply Chain Vulnerabilities
    "LLM05": { "positive": ["verify_model_signature", "check_sbom", "scan_dependencies", "checksum", "model_hash"] },
    
    # LLM06: Sensitive Information Disclosure
    "LLM06": { "positive": ["tokenize_pii", "redact", "mask_sensitive", "scrub_pii", "DataLossPrevention", "anonymize"] },
    
    # LLM07: Insecure Plugin Design
    "LLM07": { "positive": ["plugin_auth", "validate_plugin_input", "oauth", "least_privilege_plugin", "verify_plugin_signature"] },
    
    # LLM08: Excessive Agency
    "LLM08": { "positive": ["require_human_approval", "hitl", "restrict_permissions", "rbac", "agent_authorization"] },
    
    # LLM09: Overreliance
    "LLM09": { "positive": ["verify_citations", "cross_check_fact", "confidence_score", "disclaimer", "human_review", "grounding"] },
    
    # LLM10: Model Theft
    "LLM10": { "positive": ["api_key_auth", "watermark_model", "restrict_api_access", "obfuscate_weights", "rate_limit_inference"] }
}

# ==========================================
# AST Evidence Collection Logic
# ==========================================
class EvidenceCollector(ast.NodeVisitor):
    def __init__(self):
        self.matches = []

    def visit_Call(self, node):
        try:
            code = ast.unparse(node)
            self.matches.append({
                "line": node.lineno,
                "code": code
            })
        except:
            pass
        self.generic_visit(node)

    def visit_Assign(self, node):
        try:
            code = ast.unparse(node)
            self.matches.append({
                "line": node.lineno,
                "code": code
            })
        except:
            pass
        self.generic_visit(node)

# ==========================================
# Core Engine
# ==========================================
class EvidenceEngine:
    def __init__(self):
        self.patterns = CONTROL_PATTERNS

    def scan_file(self, file_path):
        source = Path(file_path).read_text(encoding="utf-8")
        tree = ast.parse(source)
        collector = EvidenceCollector()
        collector.visit(tree)
        return collector.matches

    def evaluate_control(self, control_id, findings):
        config = self.patterns.get(control_id, {})
        positives = config.get("positive", [])
        evidence = []

        for finding in findings:
            code = finding["code"]
            for pattern in positives:
                if pattern.lower() in code.lower():
                    evidence.append({
                        "line": finding["line"],
                        "match": pattern,
                        "code": code[:200]  # Truncates extremely long lines for cleaner output
                    })

        if evidence:
            return {
                "control": control_id,
                "status": "PASS",
                "confidence": min(100, len(evidence) * 25),
                "evidence": evidence
            }

        return {
            "control": control_id,
            "status": "FAIL",
            "confidence": 0,
            "evidence": []
        }

    def evaluate(self, file_path, controls):
        findings = self.scan_file(file_path)
        results = []
        for control in controls:
            results.append(
                self.evaluate_control(control, findings)
            )
        return results

# ==========================================
# Execution / Test Block
# ==========================================
if __name__ == "__main__":
    import sys
    engine = EvidenceEngine()
    
    # Automatically generate a list of ALL OWASP LLM controls from the dictionary
    all_controls = list(engine.patterns.keys())
    
    # Ensure target file exists in your working directory to avoid FileNotFoundError
    target = sys.argv[1] if len(sys.argv) > 1 else "agent.py"
    try:
        results = engine.evaluate(target, all_controls)
        print(json.dumps(results, indent=2))
    except FileNotFoundError:
        print(f"Error: The target file '{target}' was not found.")
