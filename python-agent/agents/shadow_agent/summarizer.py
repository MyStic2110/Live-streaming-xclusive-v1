import os
import re
import logging
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("shadow_summarizer")
logging.basicConfig(level=logging.INFO)

def generate_audit(transcript_path: str) -> str:
    """
    Reads a diarized meeting transcript log, sends it to OpenRouter GPT-4o-mini,
    and structures it into a premium Daily Structural Audit Markdown file.
    """
    if not os.path.exists(transcript_path):
        logger.error(f"Transcript path not found: {transcript_path}")
        return ""
    
    logger.info(f"Reading transcript from: {transcript_path}")
    with open(transcript_path, "r", encoding="utf-8") as f:
        transcript_content = f.read().strip()
        
    if not transcript_content:
        logger.warning("Transcript file is empty. Skipping summary.")
        return ""
    
    # Initialize OpenRouter / OpenAI client
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("OPENROUTER_API_KEY is not defined in .env")
        return ""
        
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key
    )
    
    prompt = f"""
You are the elite "Shadow Agent" - an autonomous headless meeting auditor in the Swarm Fleet.
Your job is to read raw, diarized meeting transcripts and produce an ultra-premium, executive-grade "Daily Structural Audit" in Markdown.

RAW DIARIZED TRANSCRIPT:
\"\"\"
{transcript_content}
\"\"\"

Output a highly polished Markdown report containing:
1. # 👥 DAILY STRUCTURAL AUDIT: [MEETING TOPIC] (Provide a concise, high-impact topic name based on the content)
2. A premium metadata card block listing Date, Platform, and estimated Speaker count.
3. 🎯 Semantic Highlights: A summary of the core discussion themes and strategic context.
4. 💡 Decisions Made: Bulleted list of verified decisions and resolutions agreed upon during the call, listing key participants if known.
5. 📝 Action Items: Bulleted checkbox list of actionable tasks, assigned owners, and any stated timelines.
6. 🔍 Conversation Structural Timeline: A breakdown of how the topics shifted or resolved chronologically.

Ensure the markdown is rich, clean, professional, and directly actionable. Never add chatty introduction or out-of-character lines, start directly with the markdown structure.
"""

    logger.info("Submitting transcript to OpenRouter for Daily Structural Audit...")
    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional enterprise meeting auditor that formats clean structural reports."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        audit_content = response.choices[0].message.content
        
        # Create audits directory if not exists
        audits_dir = os.path.join(os.path.dirname(transcript_path), "audits")
        os.makedirs(audits_dir, exist_ok=True)
        
        # Write audit file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        audit_filename = f"daily_structural_audit_{timestamp}.md"
        audit_path = os.path.join(audits_dir, audit_filename)
        
        with open(audit_path, "w", encoding="utf-8") as out:
            out.write(audit_content)
            
        logger.info(f"Daily Structural Audit successfully created: {audit_path}")
        return audit_path
        
    except Exception as e:
        logger.error(f"Failed to generate AI audit: {e}")
        return ""

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        generate_audit(sys.argv[1])
    else:
        print("Usage: python summarizer.py <transcript_path>")
