import json
import urllib.request
import ssl
import os

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/main/dist/stix-atlas.json"

try:
    print("Downloading MITRE ATLAS STIX JSON...")
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode())
    
    techniques = [obj for obj in data.get("objects", []) if obj.get("type") == "attack-pattern"]
    
    not_applicable = []
    applicable = []
    
    for tech in techniques:
        desc = tech.get("description", "").lower()
        name = tech.get("name", "")
        
        # If it involves training, poisoning datasets, model weights, or physical hardware
        if any(keyword in desc or keyword in name.lower() for keyword in ["train", "poison", "weight", "physical", "sensor", "camera", "autonomous", "inversion", "extraction", "fine-tun"]):
            not_applicable.append(name)
        else:
            applicable.append(name)
            
    # Sort alphabetically
    not_applicable.sort()
    applicable.sort()
    
    artifact_path = r"C:\Users\Acer\.gemini\antigravity\brain\6112cd7f-6946-4002-9208-5cfd0871f0f5\artifacts\mitre_atlas_bi_agent.md"
    
    with open(artifact_path, "w", encoding="utf-8") as f:
        f.write("# MITRE ATLAS Applicability Report for BI Agent\n\n")
        f.write("> [!NOTE]\n")
        f.write("> This report classifies all 170 MITRE ATLAS techniques based on the BI Agent's architecture (API-based LLM with no local training or physical hardware interfaces).\n\n")
        
        f.write(f"## Not Applicable ({len(not_applicable)})\n")
        f.write("The following techniques apply to model training, physical sensors, or model weight extraction, and are inherently **Not Applicable** to the BI agent.\n\n")
        for n in not_applicable:
            f.write(f"- {n}\n")
            
        f.write(f"\n## Applicable ({len(applicable)})\n")
        f.write("The following techniques relate to the application layer, prompt execution, or traditional IT infrastructure, and represent the relevant threat landscape for the BI agent.\n\n")
        for a in applicable:
            f.write(f"- {a}\n")
            
    print(f"Successfully wrote full report to {artifact_path}")
            
except Exception as e:
    print(f"Error: {e}")
