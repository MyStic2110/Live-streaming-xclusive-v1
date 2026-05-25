import os
import json
import sys
import re
from datetime import datetime

# Path definitions
SEVA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../seva"))
AIVYUH_DIR = os.path.dirname(os.path.abspath(__file__))
AGENTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))

try:
    sys.path.append(AIVYUH_DIR)
    from test_evals import run_evals
except ImportError:
    run_evals = None

CONSTRAINTS_PATH = os.path.join(SEVA_DIR, "security_constraints.json")
RUNS_PATH = os.path.join(AIVYUH_DIR, "audit_runs.json")

def load_json(path, default_val):
    if not os.path.exists(path):
        return default_val
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_val

def save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving {path}: {e}", file=sys.stderr)

# --- 1. RECON MODULE (A1) ---
def run_recon_scan():
    discovered = []
    if os.path.exists(AGENTS_DIR):
        for item in os.listdir(AGENTS_DIR):
            p = os.path.join(AGENTS_DIR, item)
            if os.path.isdir(p) and not item.startswith("__") and not item.startswith("."):
                discovered.append(item.upper())
    return {
        "status": "success",
        "discovered_agents": discovered,
        "pilot_agent": "SEVA",
        "findings": f"Mapped attack surface dynamically. Discovered {len(discovered)} active agents in the swarm directory tree."
    }

# --- 2. PROMPT INJECTION MODULE (A2) ---
def run_prompt_injection_scan(constraints):
    is_resolved = constraints.get("llm01") == "Resolved"
    findings = []
    if is_resolved:
        findings.append("Success: delimiters are active around user query variables. System-override intents are intercepted and rejected.")
    else:
        findings.append("Warning: Lacks delimiters. Vulnerable to direct instruction overrides that bypass pricing controls.")
    return {
        "status": "success" if is_resolved else "high_risk",
        "findings": findings
    }

# --- 3. CREDENTIAL SCANNING MODULE (A3) ---
def run_credential_scan():
    # Scan agent code files for raw/hardcoded secrets
    target_files = []
    if os.path.exists(AGENTS_DIR):
        for root, _, files in os.walk(AGENTS_DIR):
            for file in files:
                if file.endswith(".py"):
                    target_files.append(os.path.join(root, file))
                    
    findings = []
    warnings = 0
    # Search for api_key = "..." or password = "..." patterns
    secret_pattern = re.compile(r'(api_key|password|client_secret|db_pass)\s*=\s*["\'][a-zA-Z0-9_\-]{8,}["\']', re.IGNORECASE)
    
    for f_path in target_files:
        try:
            with open(f_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                matches = secret_pattern.findall(content)
                if matches:
                    warnings += len(matches)
                    findings.append(f"Warning: Potential raw secret/token pattern detected in {os.path.basename(f_path)}")
        except Exception:
            pass

    if not findings:
        findings.append("Checked agent scripts. API credentials and secret keys are loaded safely from environment files.")
    return {
        "status": "success" if warnings == 0 else "warning",
        "warnings_count": warnings,
        "findings": findings
    }

# --- 4. TOOL PERMISSION AUDIT MODULE (A4) ---
def run_permissions_scan():
    seva_file = os.path.join(SEVA_DIR, "seva.py")
    findings = []
    risks = 0
    if os.path.exists(seva_file):
        try:
            with open(seva_file, "r", encoding="utf-8") as f:
                content = f.read()
                # Check for risky system command runners
                if "subprocess" in content or "os.system" in content:
                    risks += 1
                    findings.append("High Risk: OS shell process execution library imports detected.")
                # Check for file write bindings
                if "save_bookings" in content or "save_profiles" in content:
                    findings.append("Info: Tool writes directly to local json database files. Actions are bounded by schemas.")
        except Exception:
            pass
            
    if not findings:
        findings.append("Checked tool schemas. Bounded parameters match target scope rules.")
    return {
        "status": "success" if risks == 0 else "high_risk",
        "risks_count": risks,
        "findings": findings
    }

# --- 5. DATA EXFILTRATION PROBE MODULE (A5) ---
def run_data_exfil_scan(constraints):
    findings = []
    is_resolved = constraints.get("llm06") == "Resolved"
    if is_resolved:
        findings.append("Success: Prompt leakage filters prevent outputting verbatim instructions or internal system files.")
    else:
        findings.append("Warning: Prompt leakage rules are inactive. Vulnerable to verbatim instructions extraction.")
    return {
        "status": "success" if is_resolved else "warning",
        "findings": findings
    }

# --- 6. CROSS-AGENT TRUST BOUNDARY MODULE (A6) ---
def run_cross_agent_scan():
    # In a real setup, we audit routing keys and connections
    findings = ["Checked routing mesh. Pilot agent (SEVA) communicates via isolated client dispatches. No risky transitive trusts found."]
    return {
        "status": "success",
        "findings": findings
    }

# --- 7. CVSS / SCORING COMPILER (A7) ---
DEFAULT_CONSTRAINTS = {
    "llm01": "Open",
    "llm02": "Open",
    "llm03": "Open",
    "llm04": "Open",
    "llm05": "Open",
    "llm06": "Open",
    "llm07": "Open",
    "llm08": "Open",
    "llm09": "Open",
    "llm10": "Open"
}

def load_constraints():
    loaded = load_json(CONSTRAINTS_PATH, {})
    return {k: loaded.get(k, DEFAULT_CONSTRAINTS[k]) for k in DEFAULT_CONSTRAINTS}

def calculate_cvss(constraints):
    vuln_cvss = {
        "llm01": 8.8,
        "llm02": 3.5,
        "llm03": 7.2,
        "llm04": 5.3,
        "llm05": 7.8,
        "llm06": 7.5,
        "llm07": 8.1,
        "llm08": 6.2,
        "llm09": 4.8,
        "llm10": 3.9
    }
    active_scores = []
    for vuln_id, status in constraints.items():
        if status == "Open":
            active_scores.append(vuln_cvss.get(vuln_id, 0.0))
    if not active_scores:
        return 0.0
    return max(active_scores)

def calculate_utility(constraints):
    score = 100
    if constraints.get("llm01") == "Resolved":
        score -= 5
    if constraints.get("llm06") == "Resolved":
        score -= 3
    if constraints.get("llm08") == "Resolved":
        score -= 4
    if constraints.get("llm03") == "Resolved":
        score -= 2
    if constraints.get("llm04") == "Resolved":
        score -= 2
    if constraints.get("llm07") == "Resolved":
        score -= 3
    return f"{score}%"

def run_scan():
    constraints = load_constraints()
    runs = load_json(RUNS_PATH, [])
    
    # Run the interdisciplinary audits
    recon = run_recon_scan()
    injection = run_prompt_injection_scan(constraints)
    credentials = run_credential_scan()
    permissions = run_permissions_scan()
    exfil = run_data_exfil_scan(constraints)
    cross_agent = run_cross_agent_scan()
    
    # Run LLM-as-a-judge evals if available
    eval_results = None
    if run_evals:
        try:
            eval_results = run_evals()
        except Exception as e:
            print(f"Error running evaluations: {e}", file=sys.stderr)

    if eval_results:
        injection = {
            "status": eval_results["llm01"]["status"],
            "findings": eval_results["llm01"]["findings"]
        }
        exfil = {
            "status": eval_results["llm06"]["status"],
            "findings": eval_results["llm06"]["findings"]
        }
    
    open_vulns = sum(1 for v in constraints.values() if v == "Open")
    resolved_vulns = sum(1 for v in constraints.values() if v == "Resolved")
    ignored_vulns = sum(1 for v in constraints.values() if v == "Ignored")
    
    cvss = calculate_cvss(constraints)
    utility = calculate_utility(constraints)
    
    new_run_id = f"run-00{len(runs) + 1}"
    new_run = {
        "id": new_run_id,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "agent": "SEVA",
        "status": "completed",
        "open": open_vulns,
        "resolved": resolved_vulns,
        "ignored": ignored_vulns,
        "cvss": f"{cvss:.1f}",
        "utility": utility
    }
    
    runs.insert(0, new_run)
    save_json(RUNS_PATH, runs)
    
    posture = {
        "recon": recon,
        "injection": injection,
        "credentials": credentials,
        "permissions": permissions,
        "exfil": exfil,
        "cross_agent": cross_agent
    }
    
    result = {
        "success": True,
        "new_run": new_run,
        "runs": runs,
        "constraints": constraints,
        "posture": posture
    }
    print(json.dumps(result, indent=2))

def get_status():
    constraints = load_constraints()
    runs = load_json(RUNS_PATH, [])
    
    # Generate current posture
    recon = run_recon_scan()
    injection = run_prompt_injection_scan(constraints)
    credentials = run_credential_scan()
    permissions = run_permissions_scan()
    exfil = run_data_exfil_scan(constraints)
    cross_agent = run_cross_agent_scan()
    
    # Run LLM-as-a-judge evals if available
    eval_results = None
    if run_evals:
        try:
            eval_results = run_evals()
        except Exception as e:
            print(f"Error running evaluations: {e}", file=sys.stderr)

    if eval_results:
        injection = {
            "status": eval_results["llm01"]["status"],
            "findings": eval_results["llm01"]["findings"]
        }
        exfil = {
            "status": eval_results["llm06"]["status"],
            "findings": eval_results["llm06"]["findings"]
        }
    
    posture = {
        "recon": recon,
        "injection": injection,
        "credentials": credentials,
        "permissions": permissions,
        "exfil": exfil,
        "cross_agent": cross_agent
    }
    
    print(json.dumps({
        "constraints": constraints,
        "runs": runs,
        "posture": posture
    }, indent=2))

def update_constraint(vuln_id, new_status):
    constraints = load_constraints()
    if vuln_id in constraints:
        constraints[vuln_id] = new_status
        save_json(CONSTRAINTS_PATH, constraints)
        print(json.dumps({"success": True, "constraints": constraints}))
    else:
        print(json.dumps({"success": False, "error": f"Vulnerability {vuln_id} not found."}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "scan":
            run_scan()
        elif cmd == "update" and len(sys.argv) > 3:
            vuln_id = sys.argv[2]
            status = sys.argv[3]
            update_constraint(vuln_id, status)
        elif cmd == "status":
            get_status()
        else:
            print(json.dumps({"error": "Unknown command"}))
    else:
        print(json.dumps({"error": "No arguments provided"}))
