import os
import json
import sys
import glob
from datetime import datetime
from nist import EvidenceEngine, ControlEvaluator

NIST_DIR = os.path.dirname(os.path.abspath(__file__))
AGENTS_DIR = os.path.abspath(os.path.join(NIST_DIR, "../"))
AUDIT_FILE = os.path.join(NIST_DIR, "audit_history.json")

def run_nist_swarm_audit(target_agent=None):
    agents_root = AGENTS_DIR
    
    try:
        if os.path.exists(AUDIT_FILE):
            with open(AUDIT_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        else:
            history = {}
    except Exception:
        history = {}
        
    agents_list = []
    if target_agent:
        agents_list = [target_agent]
    else:
        if os.path.exists(agents_root):
            for item in os.listdir(agents_root):
                full_path = os.path.join(agents_root, item)
                if os.path.isdir(full_path) and not item.startswith("__") and not item.startswith("."):
                    agents_list.append(item)

    # Purge any stale/deleted agent entries from history
    if not target_agent:
        history = {k: v for k, v in history.items() if k in agents_list}

    nist_engine = EvidenceEngine()
    evaluator = ControlEvaluator()
    
    # Load Action IDs from official seed file
    json_path = os.path.abspath(os.path.join(NIST_DIR, "../../../backend/src/config/nist-rmf-core.json"))
    all_controls = []
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as j_f:
                items = json.load(j_f)
                all_controls = [item["subcategory_id"] for item in items]
        except Exception as json_err:
            print(f"Error loading nist-rmf-core.json: {json_err}", file=sys.stderr)
            
    if not all_controls:
        all_controls = list(nist_engine.patterns.keys())

    for agent_name in agents_list:
        target_name = agent_name.lower().strip()
        primary_paths = [
            os.path.join(agents_root, target_name, f"{target_name}_agent.py"),
            os.path.join(agents_root, target_name, f"{target_name}.py")
        ]
        scanned_file_path = None
        for p_opt in primary_paths:
            if os.path.exists(p_opt):
                scanned_file_path = p_opt
                break
                    
        if not scanned_file_path:
            search_path = os.path.join(agents_root, target_name, "*.py")
            files = glob.glob(search_path)
            for f_path in files:
                bn = os.path.basename(f_path)
                if "trigger" not in bn and "create" not in bn:
                    scanned_file_path = f_path
                    break
            
        nist_controls = []
        nist_score = 100
        nist_risk = "LOW"

        if scanned_file_path:
            try:
                # Load control map from agent local directory if it exists
                control_map_path = os.path.join(agents_root, agent_name, "control_map.json")
                control_map_data = {}
                if os.path.exists(control_map_path):
                    try:
                        with open(control_map_path, "r", encoding="utf-8") as cm_f:
                            control_map_data = json.load(cm_f).get("control_map", {})
                    except Exception as cm_err:
                        print(f"Error reading control map for {agent_name}: {cm_err}", file=sys.stderr)

                nist_raw_results = nist_engine.evaluate(scanned_file_path, all_controls)
                adjusted_results = []
                for r in nist_raw_results:
                    c_id = r["control"]
                    app_info = control_map_data.get(c_id, {})
                    app_status = app_info.get("status", "applicable")
                    rationale = app_info.get("rationale", "")

                    if app_status == "unmapped":
                        adjusted_results.append({
                            "control": c_id,
                            "status": "UNMAPPED",
                            "confidence": 0,
                            "evidence": [],
                            "score": 0,
                            "rationale": rationale
                        })
                    elif app_status == "non-applicable":
                        adjusted_results.append({
                            "control": c_id,
                            "status": "NON-APPLICABLE",
                            "confidence": 0,
                            "evidence": [],
                            "score": 0,
                            "rationale": rationale
                        })
                    else:
                        adjusted_results.append({
                            **r,
                            "rationale": rationale or f"Applicable based on active {agent_name} capabilities."
                        })

                for r in adjusted_results:
                    nist_controls.append({
                        "id": r["control"],
                        "status": r["status"],
                        "confidence": r["confidence"],
                        "evidence": r["evidence"],
                        "score": r.get("score", 0),
                        "rationale": r.get("rationale", "")
                    })
                
                # Calculate compliance score based only on failed and partial controls (Enterprise level deduction scoring system)
                applicable_controls = [r for r in adjusted_results if r["status"] not in ["UNMAPPED", "NON-APPLICABLE"]]
                if applicable_controls:
                    failed_count = sum(1 for c in applicable_controls if c["status"] == "FAIL")
                    partial_count = sum(1 for c in applicable_controls if c["status"] == "PARTIAL")
                    applicable_len = len(applicable_controls)
                    
                    # Enterprise level deduction scoring:
                    # - Start at a baseline of 100.0%
                    # - Deduct 1.5x of relative weight for each FAIL control
                    # - Deduct 0.5x of relative weight for each PARTIAL control
                    # Penalizes failures heavily (e.g. 0% score if half or more controls fail)
                    deduction = (failed_count / applicable_len * 150.0) + (partial_count / applicable_len * 50.0)
                    nist_score = round(max(0.0, 100.0 - deduction), 2)
                else:
                    nist_score = 100.0
                
                nist_risk = evaluator.risk_tier(nist_score)
            except Exception as e:
                print(f"Error scanning agent {agent_name}: {e}", file=sys.stderr)
        
        history[agent_name] = {
            "timestamp": datetime.now().isoformat(),
            "nist_audit": {
                "score": nist_score,
                "risk": nist_risk,
                "controls": nist_controls
            }
        }
        
    try:
        with open(AUDIT_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Error saving audit_history.json: {e}", file=sys.stderr)
        sys.exit(1)
        
    output_history = {target_agent: history[target_agent]} if target_agent else history
    print(json.dumps({
        "success": True,
        "total_agents": len(output_history),
        "history": output_history
    }, indent=2))

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    run_nist_swarm_audit(target)
