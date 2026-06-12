import ast
import json
from pathlib import Path

# ==========================================
# NIST AI RMF 1.0 - Evidence Patterns
# ==========================================
CONTROL_PATTERNS = {
    # GOVERN
    "GV-1.1": { "positive": ["check_compliance", "verify_regulatory", "legal_hold", "gdpr", "hipaa", "export_control"] },
    "GV-1.2": { "positive": ["TrustworthyAI", "enforce_policy", "ai_ethics", "validate_characteristics"] },
    "GV-1.3": { "positive": ["risk_tolerance", "calculate_risk_tier", "get_risk_profile"] },
    "GV-1.4": { "positive": ["establish_controls", "risk_framework", "set_risk_boundary"] },
    "GV-1.5": { "positive": ["logger", "log_transaction", "audit_log", "periodic_review", "session_usage_updated"] },
    "GV-1.6": { "positive": ["ModelRegistry", "system_inventory", "register_model", "discover_assets"] },
    "GV-1.7": { "positive": ["decommission", "phase_out", "sunset_model", "revoke_deployment"] },
    "GV-2.1": { "positive": ["role_required", "require_approval", "RBAC", "assign_owner", "escalation_path"] },
    "GV-2.2": { "positive": ["training_status", "verify_certification", "SecurityTraining"] },
    "GV-2.3": { "positive": ["exec_signoff", "leadership_approval", "board_review"] },
    "GV-3.1": { "positive": ["diversity_check", "inclusive_team", "stakeholder_review"] },
    "GV-3.2": { "positive": ["equity_policy", "inclusion_metrics"] },
    "GV-4.1": { "positive": ["culture_survey", "risk_awareness"] },
    "GV-4.2": { "positive": ["report_concern", "whistleblower", "flag_anomaly", "raise_issue"] },
    "GV-4.3": { "positive": ["escalate_to_exec", "notify_leadership", "critical_alert"] },
    "GV-5.1": { "positive": ["stakeholder_feedback", "external_review", "actor_engagement"] },
    "GV-5.2": { "positive": ["adjudicate_feedback", "incorporate_review", "update_from_feedback"] },
    "GV-6.1": { "positive": ["third_party_audit", "vendor_risk", "supply_chain_check", "verify_vendor"] },
    "GV-6.2": { "positive": ["vendor_contingency", "fallback_provider", "circuit_breaker"] },

    # MAP
    "MAP-1.1": { "positive": ["intended_use", "validate_context", "check_deployment_setting"] },
    "MAP-1.2": { "positive": ["scientific_integrity", "actor_capability_check"] },
    "MAP-1.3": { "positive": ["align_mission", "org_priority_check"] },
    "MAP-1.4": { "positive": ["business_value", "roi_calculator"] },
    "MAP-1.5": { "positive": ["risk_appetite", "tolerance_threshold"] },
    "MAP-1.6": { "positive": ["system_limits", "boundary_condition", "guardrail", "enforce_limits"] },
    "MAP-2.1": { "positive": ["task_definition", "expected_output", "validate_input_schema"] },
    "MAP-2.2": { "positive": ["test_requirements", "assert_measurable", "testable_condition"] },
    "MAP-2.3": { "positive": ["identify_risks", "threat_model", "known_vulnerabilities"] },
    "MAP-2.4": { "positive": ["data_lineage", "provenance", "track_dataset", "dataset_version"] },
    "MAP-2.5": { "positive": ["impact_assessment", "negative_impact_check", "harm_potential"] },
    "MAP-2.6": { "positive": ["system_architecture", "dependency_graph", "hardware_spec"] },
    "MAP-3.1": { "positive": ["expected_benefit", "utility_score"] },
    "MAP-3.2": { "positive": ["cost_benefit_analysis", "alternative_solution_check"] },
    "MAP-3.3": { "positive": ["define_metrics", "evaluation_methodology"] },
    "MAP-3.4": { "positive": ["deployment_context", "operational_constraint", "env_requirements"] },
    "MAP-3.5": { "positive": ["human_in_the_loop", "hitl", "human_oversight", "override_control"] },
    "MAP-4.1": { "positive": ["map_third_party_risk", "external_api_risk", "vendor_data_scan"] },
    "MAP-4.2": { "positive": ["map_interdependencies", "component_integration_test"] },
    "MAP-5.1": { "positive": ["likelihood_score", "magnitude_assessment", "impact_matrix"] },
    "MAP-5.2": { "positive": ["track_emerging_impact", "ongoing_impact_monitor"] },

    # MEASURE
    "MEAS-1.1": { "positive": ["assess_measurement_approach", "validate_metrics"] },
    "MEAS-1.2": { "positive": ["calculate_metrics", "accuracy_score", "precision", "recall"] },
    "MEAS-1.3": { "positive": ["independent_eval", "red_team", "external_audit"] },
    "MEAS-2.1": { "positive": ["test_validity", "test_reliability", "cross_validation"] },
    "MEAS-2.2": { "positive": ["safety_check", "toxicity_filter", "content_moderation"] },
    "MEAS-2.3": { "positive": ["security_scan", "resilience_test", "fuzz_test", "adversarial_defense"] },
    "MEAS-2.4": { "positive": ["accountability_log", "transparency_report", "model_card"] },
    "MEAS-2.5": { "positive": ["explainability", "shap_values", "lime", "interpret_model"] },
    "MEAS-2.6": { "positive": ["tokenize", "detokenize", "redact", "mask", "SecurelytixClient", "anonymize", "differential_privacy"] },
    "MEAS-2.7": { "positive": ["fairness_metric", "disparate_impact", "bias_mitigation", "demographic_parity"] },
    "MEAS-2.8": { "positive": ["carbon_footprint", "energy_usage", "compute_efficiency"] },
    "MEAS-2.9": { "positive": ["track_risk_over_time", "historical_risk_trend"] },
    "MEAS-2.10": { "positive": ["CostGuard", "broadcast_usage", "monitoring", "prod_evaluation", "telemetry"] },
    "MEAS-2.11": { "positive": ["human_ai_interaction", "ux_measurement", "usability_test"] },
    "MEAS-2.12": { "positive": ["kpi_tracking", "performance_indicator"] },
    "MEAS-2.13": { "positive": ["evaluate_measurement_efficacy", "update_metrics"] },
    "MEAS-3.1": { "positive": ["integrate_eval_results", "update_risk_register"] },
    "MEAS-3.2": { "positive": ["data_quality_check", "assess_dataset", "update_tracking_data"] },
    "MEAS-3.3": { "positive": ["communicate_tracking", "export_risk_report"] },
    "MEAS-4.1": { "positive": ["review_measurement", "utility_assessment"] },
    "MEAS-4.2": { "positive": ["incorporate_user_feedback", "operator_insights"] },
    "MEAS-4.3": { "positive": ["update_methodology", "document_metric_changes"] },

    # MANAGE
    "MAN-1.1": { "positive": ["go_no_go_decision", "proceed_check", "achieves_objective"] },
    "MAN-1.2": { "positive": ["prioritize_risk", "sort_by_impact", "triage_vulnerability"] },
    "MAN-1.3": { "positive": ["mitigate_risk", "transfer_risk", "accept_risk", "risk_response_plan"] },
    "MAN-1.4": { "positive": ["residual_risk", "post_mitigation_score"] },
    "MAN-2.1": { "positive": ["allocate_resources", "execute_treatment"] },
    "MAN-2.2": { "positive": ["apply_guardrails", "system_modification", "enforce_controls"] },
    "MAN-2.3": { "positive": ["handle_unknown_risk", "emergent_risk_procedure"] },
    "MAN-2.4": { "positive": ["safe_decommission", "graceful_degradation", "kill_switch"] },
    "MAN-3.1": { "positive": ["manage_vendor_risk", "third_party_policy_enforcement"] },
    "MAN-3.2": { "positive": ["vendor_audit", "assess_third_party_compliance"] },
    "MAN-4.1": { "positive": ["post_deployment_monitor", "session_usage_updated", "CostGuard"] },
    "MAN-4.2": { "positive": ["incident_response", "trigger_alert", "handle_breach", "page_on_call"] },
    "MAN-4.3": { "positive": ["disclosure_plan", "notify_users", "communicate_incident"] }
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
class ControlEvaluator:

    def __init__(self):
        pass

    def evaluate_control(self, evidence_result):

        confidence = evidence_result.get(
            "confidence",
            0
        )

        evidence_count = len(
            evidence_result.get(
                "evidence",
                []
            )
        )

        if confidence >= 80:
            return {
                **evidence_result,
                "status": "PASS",
                "score": 5
            }

        if confidence >= 30:

            return {
                **evidence_result,
                "status": "PARTIAL",
                "score": 3
            }

        return {
            **evidence_result,
            "status": "FAIL",
            "score": 0
        }

    def evaluate(self, evidence_results):

        controls = []

        for result in evidence_results:

            controls.append(
                self.evaluate_control(
                    result
                )
            )

        return controls

    def summarize(self, controls):

        passed = 0
        partial = 0
        failed = 0

        total_score = 0
        max_score = 0

        for control in controls:

            max_score += 5

            total_score += control["score"]

            if control["status"] == "PASS":
                passed += 1

            elif control["status"] == "PARTIAL":
                partial += 1

            else:
                failed += 1

        overall = round(
            (
                total_score /
                max_score
            ) * 100,
            2
        )

        return {
            "controls_evaluated":
                len(controls),

            "passed":
                passed,

            "partial":
                partial,

            "failed":
                failed,

            "score":
                overall
        }

    def risk_tier(self, score):

        if score >= 90:
            return "LOW"

        if score >= 75:
            return "MEDIUM"

        if score >= 60:
            return "HIGH"

        return "CRITICAL"


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
                        "code": code[:200]  # Truncating extremely long lines
                    })

        raw_result = {
            "control": control_id,
            "confidence": min(100, len(evidence) * 25),
            "evidence": evidence
        }

        evaluator = ControlEvaluator()
        return evaluator.evaluate_control(raw_result)

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
    
    engine = EvidenceEngine()
    
    # Automatically generate a list of ALL 75 controls from the dictionary
    all_controls = list(engine.patterns.keys())
    
    # Ensure "agent.py" exists in your working directory to avoid FileNotFoundError
    try:
        results = engine.evaluate("agent.py", all_controls)
        print(json.dumps(results, indent=2))
    except FileNotFoundError:
        print("Error: The target file 'agent.py' was not found in the current directory.")
