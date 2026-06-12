import ast
import json
import sys
import re
from pathlib import Path

class ControlApplicabilityEngine:
    def __init__(self):
        # Mapped rules (34 subcategories)
        self.rules = {
            "GV-1.4": {
                "required_when": [
                    "READ_DB",
                    "WRITE_DB",
                    "DELETE_DB",
                    "PAYMENTS"
                ]
            },
            "GV-2.2": {
                "required_when": [
                    "TOOLS"
                ]
            },
            "GV-3.1": {
                "required_when": [
                    "READ_DB",
                    "WRITE_DB",
                    "RAG",
                    "MCP"
                ]
            },
            "GV-4.2": {
                "required_when": [
                    "PII_ACCESS"
                ]
            },
            "GV-5.1": {
                "required_when": [
                    "MCP"
                ]
            },
            "GV-6.1": {
                "required_when": [
                    "MEMORY"
                ]
            },
            "GV-6.2": {
                "required_when": [
                    "PAYMENTS",
                    "DELETE_DB",
                    "ADMIN_ACCESS"
                ]
            },
            "MAP-1.3": {
                "required_when": [
                    "READ_DB",
                    "WRITE_DB",
                    "RAG"
                ]
            },
            "MAP-1.4": {
                "required_when": [
                    "TOOLS"
                ]
            },
            "MAP-1.5": {
                "required_when": [
                    "MCP"
                ]
            },
            "MAP-2.1": {
                "required_when": [
                    "PII_ACCESS"
                ]
            },
            "MAP-3.2": {
                "required_when": [
                    "PAYMENTS"
                ]
            },
            "MAP-5.1": {
                "required_when": [
                    "MEMORY"
                ]
            },
            "MAP-5.2": {
                "required_when": [
                    "AGENT_DELEGATION"
                ]
            },
            "MEAS-1.1": {
                "required_when": [
                    "TOOLS"
                ]
            },
            "MEAS-1.2": {
                "required_when": [
                    "INTERNET_ACCESS",
                    "TOOLS"
                ]
            },
            "MEAS-1.3": {
                "required_when": [
                    "PII_ACCESS",
                    "READ_DB",
                    "MCP"
                ]
            },
            "MEAS-2.1": {
                "required_when": [
                    "RAG",
                    "INTERNET_ACCESS"
                ]
            },
            "MEAS-2.2": {
                "required_when": [
                    "TOOLS"
                ]
            },
            "MEAS-2.3": {
                "required_when": [
                    "ADMIN_ACCESS",
                    "WRITE_DB"
                ]
            },
            "MEAS-2.4": {
                "required_when": [
                    "MCP"
                ]
            },
            "MEAS-2.5": {
                "required_when": [
                    "TOOLS"
                ]
            },
            "MEAS-2.6": {
                "required_when": [
                    "READ_DB",
                    "WRITE_DB",
                    "PAYMENTS"
                ]
            },
            "MEAS-2.7": {
                "required_when": [
                    "READ_DB",
                    "WRITE_DB",
                    "PAYMENTS"
                ]
            },
            "MEAS-3.1": {
                "required_when": [
                    "PII_ACCESS"
                ]
            },
            "MEAS-4.2": {
                "required_when": [
                    "MEMORY"
                ]
            },
            "MEAS-4.3": {
                "required_when": [
                    "AGENT_DELEGATION"
                ]
            },
            "MAN-1.1": {
                "required_when": [
                    "PAYMENTS",
                    "WRITE_DB",
                    "DELETE_DB",
                    "ADMIN_ACCESS"
                ]
            },
            "MAN-1.2": {
                "required_when": [
                    "PAYMENTS",
                    "WRITE_DB",
                    "DELETE_DB"
                ]
            },
            "MAN-1.3": {
                "required_when": [
                    "WRITE_DB",
                    "DELETE_DB"
                ]
            },
            "MAN-1.4": {
                "required_when": [
                    "PII_ACCESS",
                    "PAYMENTS"
                ]
            },
            "MAN-2.1": {
                "required_when": [
                    "PAYMENTS",
                    "WRITE_DB",
                    "DELETE_DB"
                ]
            },
            "MAN-2.2": {
                "required_when": [
                    "READ_DB",
                    "WRITE_DB",
                    "PAYMENTS"
                ]
            },
            "MAN-2.4": {
                "required_when": [
                    "PAYMENTS",
                    "ADMIN_ACCESS"
                ]
            }
        }

        # Rationales for the 41 unmapped subcategories
        self.unmapped_rationales = {
            "GV-1.1": "Managed at the organizational level; the company legal team monitors and documents AI compliance requirements.",
            "GV-1.2": "Handled at the organizational level via standard corporate policies and developer training guidelines.",
            "GV-1.3": "Determined by executive leadership and the risk management committee at the corporate level.",
            "GV-1.5": "Conducted via periodic, organization-wide compliance audits and reviews.",
            "GV-1.6": "Maintained centrally in the company's master software registry and CMDB.",
            "GV-1.7": "Defined in the standard IT lifecycle and system decommissioning policies.",
            "GV-2.1": "Defined in the organizational chart, job descriptions, and team charters.",
            "GV-2.3": "Executive leadership maintains ultimate oversight and sign-off on AI deployments.",
            "GV-3.2": "Administered by HR and the DEI committee through company-wide policies.",
            "GV-4.1": "Promoted through company-wide training and leadership-led awareness initiatives.",
            "GV-4.3": "Governed by corporate incident response and escalation protocols.",
            "GV-5.2": "Managed via corporate feedback channels, customer support teams, and user relations.",
            "MAP-1.1": "Documented in the product requirement documents (PRD) and agent charter.",
            "MAP-1.2": "Evaluated during the R&D and model selection phase before agent development.",
            "MAP-1.6": "Defined in the system design documentation and model cards.",
            "MAP-2.2": "Specified in the QA testing suite and validation frameworks.",
            "MAP-2.3": "Identified during the initial project threat modeling and risk assessment phases.",
            "MAP-2.4": "Governed by corporate data lake policies and database ingestion pipelines.",
            "MAP-2.5": "Evaluated in the project's Privacy and Algorithmic Impact Assessments.",
            "MAP-2.6": "Documented in the infrastructure architecture diagram and Terraform files.",
            "MAP-3.1": "Defined in the project business case and ROI analysis.",
            "MAP-3.3": "Established in the model performance evaluation and monitoring guidelines.",
            "MAP-3.4": "Defined in the cloud deployment guide and infrastructure limits.",
            "MAP-3.5": "Outlined in the User Experience (UX) design and operational runbooks.",
            "MAP-4.1": "Managed via vendor risk assessment and third-party procurement reviews.",
            "MAP-4.2": "Documented in the system architecture diagrams and dependency trees.",
            "MEAS-2.8": "Monitored at the cloud provider/data center level (carbon offset tracking).",
            "MEAS-2.9": "Managed via the Jira/Linear tracking board and risk register.",
            "MEAS-2.10": "Monitored via Datadog, Prometheus, or Grafana dashboards.",
            "MEAS-2.11": "Evaluated via user experience feedback and interaction analytics.",
            "MEAS-2.12": "Defined in Key Performance Indicators (KPIs) and Service Level Objectives (SLOs).",
            "MEAS-2.13": "Reviewed periodically by the data science and engineering leadership teams.",
            "MEAS-3.2": "Managed under data governance and quality assurance guidelines.",
            "MEAS-3.3": "Shared via regular executive status reports and stakeholder updates.",
            "MEAS-4.1": "Assessed during quarterly business and technology reviews.",
            "MAN-2.3": "Covered by the general incident management and disaster recovery plans.",
            "MAN-3.1": "Governed by vendor service level agreements (SLAs) and contract terms.",
            "MAN-3.2": "Conducted via SOC2 Type II audits and vendor security questionnaires.",
            "MAN-4.1": "Handled via automated application performance monitoring (APM) tools.",
            "MAN-4.2": "Governed by the corporate cybersecurity and operational incident response plans.",
            "MAN-4.3": "Managed by the corporate communications and public relations teams."
        }

    def evaluate(self, capabilities):
        applicable = []
        non_applicable = []
        unmapped = list(self.unmapped_rationales.keys())
        
        control_map = {}

        # 1. Process Mapped Rules
        for control_id, config in self.rules.items():
            required = config["required_when"]
            matched_caps = [cap for cap in required if cap in capabilities]

            if matched_caps:
                applicable.append(control_id)
                control_map[control_id] = {
                    "status": "applicable",
                    "rationale": f"Applicable because the agent has the following required capabilities: {', '.join(matched_caps)}."
                }
            else:
                non_applicable.append(control_id)
                control_map[control_id] = {
                    "status": "non-applicable",
                    "rationale": f"Not applicable because the agent lacks any of the required capabilities: {', '.join(required)}."
                }

        # 2. Process Unmapped Rules
        for control_id, rationale in self.unmapped_rationales.items():
            control_map[control_id] = {
                "status": "unmapped",
                "rationale": rationale
            }

        return {
            "applicable_controls": applicable,
            "non_applicable_controls": non_applicable,
            "applicable_count": len(applicable),
            "non_applicable_count": len(non_applicable),
            "unmapped_count": len(unmapped),
            "control_map": control_map
        }


class AgentAnalyzer(ast.NodeVisitor):

    def __init__(self):
        self.data = {
            "agent_name": None,
            "voice": False,
            "database": False,
            "write_db": False,
            "delete_db": False,
            "pii": False,
            "mcp": False,
            "rag": False,
            "payments": False,
            "email": False,
            "filesystem": False,
            "internet": False,
            "code_execution": False,
            "multi_agent": False,
            "logging": False,
            "human_loop": False,
            "tools": False,
            "memory": False,
            "agent_delegation": False,
            "admin_access": False,
            "external_services": set()
        }

    def visit_Assign(self, node):

        for target in node.targets:

            if isinstance(target, ast.Name):

                if target.id == "SYSTEM_PROMPT":
                    self.data["agent_name"] = "UNKNOWN_AGENT"

        self.generic_visit(node)

    def visit_Call(self, node):

        try:

            code = ast.unparse(node).lower()

            # database

            if "aiomysql" in code:
                self.data["database"] = True
                self.data["external_services"].add("DATABASE")

            # pii

            if "securelytix" in code:
                self.data["pii"] = True

            # voice

            if "deepgram.stt" in code:
                self.data["voice"] = True

            if "deepgram.tts" in code:
                self.data["voice"] = True

            # llm

            if "openrouter" in code:
                self.data["internet"] = True
                self.data["external_services"].add("OPENROUTER")

            if "deepgram" in code:
                self.data["external_services"].add("DEEPGRAM")

            # filesystem

            if "open(" in code:
                self.data["filesystem"] = True

            # human interaction

            if "agentsession" in code:
                self.data["human_loop"] = True

            # telegram

            if "telegram" in code:
                self.data["human_loop"] = True
                self.data["external_services"].add("TELEGRAM")

            # searxng

            if "searx" in code:
                self.data["internet"] = True
                self.data["external_services"].add("SEARXNG")

        except:
            pass

        self.generic_visit(node)


class ScopeEngine:

    def determine_type(self, features):

        if features.get("database"):
            return "BI_AGENT"

        if features.get("payments"):
            return "FINANCE_AGENT"

        return "GENERAL_AGENT"

    def determine_autonomy(self, features):

        if features.get("voice") and features.get("human_loop"):
            return "A1"

        if features.get("multi_agent") or features.get("agent_delegation"):
            return "A4"

        return "A2"

    def determine_capabilities(self, f):

        caps = []

        if f.get("database"):
            caps.append("READ_DB")
        if f.get("write_db"):
            caps.append("WRITE_DB")
        if f.get("delete_db"):
            caps.append("DELETE_DB")
        if f.get("payments"):
            caps.append("PAYMENTS")
        if f.get("email"):
            caps.append("EMAIL")
        if f.get("filesystem"):
            caps.append("FILESYSTEM")
        if f.get("voice"):
            caps.append("VOICE")
        if f.get("pii"):
            caps.append("PII_ACCESS")
        if f.get("internet"):
            caps.append("INTERNET_ACCESS")
        if f.get("tools"):
            caps.append("TOOLS")
        if f.get("mcp"):
            caps.append("MCP")
        if f.get("rag"):
            caps.append("RAG")
        if f.get("memory"):
            caps.append("MEMORY")
        if f.get("agent_delegation"):
            caps.append("AGENT_DELEGATION")
        if f.get("admin_access"):
            caps.append("ADMIN_ACCESS")

        return caps

    def determine_data_classes(self, f):

        classes = ["INTERNAL"]

        if f.get("pii"):
            classes.append("PII")

        return classes

    def determine_risk(self, f):

        score = 0

        if f.get("pii"):
            score += 15

        if f.get("database"):
            score += 10

        if f.get("internet"):
            score += 10

        if f.get("payments"):
            score += 30

        if score >= 40:
            return "HIGH"

        if score >= 20:
            return "MEDIUM"

        return "LOW"


def has_word(word, text):
    return bool(re.search(r'\b' + re.escape(word) + r'\b', text))

def has_any_word(words, text):
    return any(has_word(w, text) for w in words)

def analyze_agent(file_path):

    source = Path(file_path).read_text(
        encoding="utf-8"
    )

    tree = ast.parse(source)

    analyzer = AgentAnalyzer()

    analyzer.visit(tree)

    # Post-process with precise word-boundary source code checks
    source_lower = source.lower()
    
    is_database = has_any_word(["aiomysql", "mysql", "postgres", "postgresql"], source_lower) or (has_word("db", source_lower) and not "dicebear" in source_lower)
    
    analyzer.data["database"] = is_database
    analyzer.data["write_db"] = is_database and any(x in source_lower for x in ["insert", "update", "upsert", "write"])
    analyzer.data["delete_db"] = is_database and any(x in source_lower for x in ["delete", "drop", "truncate"])
    
    analyzer.data["pii"] = "securelytix" in source_lower or has_word("pii", source_lower)
    analyzer.data["voice"] = any(x in source_lower for x in ["deepgram.stt", "deepgram.tts"]) or has_any_word(["voice", "speech"], source_lower)
    analyzer.data["internet"] = any(x in source_lower for x in ["openrouter", "httpx", "requests", "urllib", "searx"])
    
    analyzer.data["tools"] = "@llm.function_tool" in source_lower or "function_tool" in source_lower
    analyzer.data["mcp"] = has_word("mcp", source_lower)
    analyzer.data["rag"] = has_word("rag", source_lower) or any(x in source_lower for x in ["vector_db", "pinecone", "qdrant", "chroma"])
    analyzer.data["memory"] = has_any_word(["memory", "chat_history"], source_lower)
    analyzer.data["agent_delegation"] = has_any_word(["delegate", "subagent", "router"], source_lower)
    analyzer.data["admin_access"] = has_any_word(["admin", "superuser"], source_lower)
    
    # Avoid matches in string descriptions or logs for payments/emails unless they import or act on them
    analyzer.data["payments"] = has_any_word(["stripe", "paypal", "checkout"], source_lower) or (has_word("payment", source_lower) and not "pine-labs" in source_lower)
    analyzer.data["email"] = has_any_word(["smtp", "send_mail"], source_lower) or (has_word("mail", source_lower) and not "gmail" in source_lower)
    
    analyzer.data["filesystem"] = "open(" in source_lower or has_word("pathlib", source_lower)
    analyzer.data["human_loop"] = "agentsession" in source_lower or "telegram" in source_lower

    if "telegram" in source_lower:
        analyzer.data["external_services"].add("TELEGRAM")
    if "searx" in source_lower:
        analyzer.data["external_services"].add("SEARXNG")
    if "openrouter" in source_lower:
        analyzer.data["external_services"].add("OPENROUTER")
    if "deepgram" in source_lower:
        analyzer.data["external_services"].add("DEEPGRAM")
    if is_database:
        analyzer.data["external_services"].add("DATABASE")

    features = analyzer.data

    engine = ScopeEngine()

    capabilities = engine.determine_capabilities(features)

    # Run ControlApplicabilityEngine
    control_engine = ControlApplicabilityEngine()
    control_result = control_engine.evaluate(capabilities)

    agent_name_key = Path(file_path).parent.name.lower().strip()
    agent_mappings = {
        "aivyuh": ("SECURITY_AUDITOR", "SECURITY"),
        "astra": ("GROWTH_SPRINT", "MARKETING_AND_SEO"),
        "bi": ("CORTEX_BI_I", "BUSINESS_INTELLIGENCE"),
        "bi2": ("CORTEX_BI_II", "DATABASE_ANALYTICS"),
        "devopsgeni": ("DEVOPS_AUTOMATION", "DEVOPS_AND_SRE"),
        "lina": ("WELLNESS_COACH", "CUSTOMER_WELLNESS"),
        "martech": ("MARKETING_TECH", "MARKETING"),
        "nist": ("COMPLIANCE_AUDITOR", "COMPLIANCE"),
        "nova": ("SPORTS_STRATEGIST", "SPORTS_ANALYTICS"),
        "octane": ("METRICS_TRACER", "INFRASTRUCTURE"),
        "reels": ("CONTENT_CREATION", "MEDIA_CREATION"),
        "rehearsal": ("PACE_COACH", "EMPLOYEE_TRAINING"),
        "seva": ("CUSTOMER_SUPPORT", "CUSTOMER_SERVICE"),
        "swarm_copilot": ("SWARM_ORCHESTRATOR", "SWARM_COORDINATION")
    }
    mapped_type, mapped_func = agent_mappings.get(agent_name_key, ("GENERAL_AGENT", "GENERAL"))

    result = {
        "agent_name":
            Path(file_path).parent.name,

        "agent_type":
            mapped_type,

        "business_function":
            mapped_func,

        "autonomy":
            engine.determine_autonomy(features),

        "risk_tier":
            engine.determine_risk(features),

        "capabilities":
            capabilities,

        "data_classes":
            engine.determine_data_classes(features),

        "external_reach":
            list(features.get("external_services")),

        "applicable_controls":
            control_result["applicable_controls"],

        "non_applicable_controls":
            control_result["non_applicable_controls"],

        "applicable_count":
            control_result["applicable_count"],

        "non_applicable_count":
            control_result["non_applicable_count"],
        
        "control_map":
            control_result["control_map"]
    }

    # Save to agent's local folder
    agent_dir = Path(file_path).parent
    control_map_path = agent_dir / "control_map.json"
    with open(control_map_path, "w", encoding="utf-8") as f:
        json.dump(control_result, f, indent=4)

    return result

if __name__ == "__main__":
    AGENT_FILES = {
        "aivyuh": "agents/aivyuh/aivyuh.py",
        "astra": "agents/astra/astra.py",
        "bi": "agents/bi/bi_agent.py",
        "bi2": "agents/bi2/bi2_agent.py",
        "devopsgeni": "agents/devopsgeni/devopsgeni.py",
        "lina": "agents/lina/lina.py",
        "martech": "agents/martech/martech_agent.py",
        "nist": "agents/nist/nist.py",
        "nova": "agents/nova/nova.py",
        "octane": "agents/octane/octane.py",
        "reels": "agents/reels/reels_agent.py",
        "rehearsal": "agents/rehearsal/rehearsal.py",
        "seva": "agents/seva/seva.py",
        "swarm_copilot": "agents/swarm_copilot/copilot.py"
    }

    results = []
    base_dir = Path(__file__).parent
    
    for name, relative_path in AGENT_FILES.items():
        full_path = base_dir / relative_path
        if full_path.exists():
            print(f"Analyzing {name} agent from {relative_path}...", file=sys.stderr)
            res = analyze_agent(full_path)
            res["agent_name"] = name
            results.append(res)
        else:
            print(f"Warning: File not found for agent '{name}' at {relative_path}", file=sys.stderr)

    # Output to stdout
    print(json.dumps(results))
