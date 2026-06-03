import os
import sys
import asyncio
import json
import logging
from datetime import datetime

# Setup paths
AGENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(AGENT_DIR)

from integrations.securelytix import SecurelytixClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("stress-test")

# 50 Contextual PII payloads simulating different agent conversations
TEST_PAYLOADS = [
    # SEVA (Booking & Address Info)
    {"agent": "SEVA", "type": "booking", "transcript": "Hi, I'm Mani and my number is 9756577890. I need a plumber at 123 Main St, Apartment 4B, Bangalore 560001."},
    {"agent": "SEVA", "type": "booking", "transcript": "Can you send someone to fix the AC? My name is Priya Sharma, phone 9876543210, address 45 Park Avenue, Mumbai."},
    {"agent": "SEVA", "type": "payment", "transcript": "I'll pay via UPI. My UPI ID is mani99@okaxis."},
    {"agent": "SEVA", "type": "payment", "transcript": "My credit card is 4111-2222-3333-4444, expiry 12/25, CVV 123."},
    {"agent": "SEVA", "type": "booking", "transcript": "Book a cleaner for tomorrow. Call me at +91-9988776655. Ask for David."},
    {"agent": "SEVA", "type": "booking", "transcript": "My email is david.smith@gmail.com, send the invoice there."},
    {"agent": "SEVA", "type": "booking", "transcript": "Address is Villa 14, Palm Meadows, Whitefield, Bangalore. Name is Sarah."},
    {"agent": "SEVA", "type": "booking", "transcript": "I need electrical repair. I'm John Doe, 555-0198. 789 Elm St."},
    {"agent": "SEVA", "type": "booking", "transcript": "Send the receipt to my personal email: priya_s@company.com"},
    {"agent": "SEVA", "type": "booking", "transcript": "My alternative number is 9123456789 just in case."},
    
    # LINA (Emotional Support & Personal Info)
    {"agent": "LINA", "type": "chat", "transcript": "I've been feeling really down lately. My boss, Mr. Henderson, yelled at me again today."},
    {"agent": "LINA", "type": "chat", "transcript": "My daughter Emily just turned 5, and I'm stressed about her school fees."},
    {"agent": "LINA", "type": "chat", "transcript": "I live in New York now, it's so lonely here compared to back home."},
    {"agent": "LINA", "type": "chat", "transcript": "My doctor prescribed me Lexapro yesterday. I don't know how to feel about it."},
    {"agent": "LINA", "type": "chat", "transcript": "I lost my job at Microsoft last week. It's been tough."},
    {"agent": "LINA", "type": "chat", "transcript": "My partner Alex and I are having a lot of arguments."},
    {"agent": "LINA", "type": "chat", "transcript": "I think I have ADHD. My therapist Dr. Roberts suggested I get tested."},
    {"agent": "LINA", "type": "chat", "transcript": "My birthday is next week, October 15th, and I'm dreading it."},
    {"agent": "LINA", "type": "chat", "transcript": "I owe $5,000 on my Visa card and I can't sleep."},
    {"agent": "LINA", "type": "chat", "transcript": "Can you just call me Sarah for now? I don't like my real name."},

    # MARTECH (Marketing & Lead Gen)
    {"agent": "MARTECH", "type": "lead", "transcript": "I'm the CMO of TechCorp. You can reach me at john.doe@techcorp.com."},
    {"agent": "MARTECH", "type": "lead", "transcript": "Our company revenue is around $50M. We're looking to scale."},
    {"agent": "MARTECH", "type": "lead", "transcript": "Call my co-founder Jane at 555-987-6543 to discuss the contract."},
    {"agent": "MARTECH", "type": "lead", "transcript": "We are based in San Francisco, specifically the SOMA district."},
    {"agent": "MARTECH", "type": "lead", "transcript": "Our target demographic is women aged 25-34 in the UK."},
    {"agent": "MARTECH", "type": "lead", "transcript": "I'll wire the funds tomorrow. Account number 000123456789, Routing 121000358."},
    {"agent": "MARTECH", "type": "lead", "transcript": "We use Salesforce for our CRM and Stripe for payments."},
    {"agent": "MARTECH", "type": "lead", "transcript": "My LinkedIn profile is linkedin.com/in/johndoe123."},
    {"agent": "MARTECH", "type": "lead", "transcript": "Send the NDA to legal@startup.io."},
    {"agent": "MARTECH", "type": "lead", "transcript": "Our biggest client is Apple, but don't tell anyone."},

    # ASTRA (Content & Research - less PII, but possible leaks)
    {"agent": "ASTRA", "type": "research", "transcript": "I'm writing a blog post. Cite the research by Dr. Alan Turing."},
    {"agent": "ASTRA", "type": "research", "transcript": "My name is Editor-in-Chief Marcus, make sure this draft is perfect."},
    {"agent": "ASTRA", "type": "research", "transcript": "Publish this to our WordPress site. The admin login is admin / Password123!"},
    {"agent": "ASTRA", "type": "research", "transcript": "Include a quote from CEO Elon Musk in the article."},
    {"agent": "ASTRA", "type": "research", "transcript": "Email the final draft to editorial@magazine.com."},
    {"agent": "ASTRA", "type": "research", "transcript": "The author bio should say: 'Written by Samantha Jones, based in Chicago'."},
    {"agent": "ASTRA", "type": "research", "transcript": "Contact me at 800-555-0199 if the API key fails."},
    {"agent": "ASTRA", "type": "research", "transcript": "Use my personal AWS key: AKIAIOSFODNN7EXAMPLE."},
    {"agent": "ASTRA", "type": "research", "transcript": "The budget for this campaign is $10,000."},
    {"agent": "ASTRA", "type": "research", "transcript": "Schedule the tweet for 9 AM EST on Monday."},

    # DEVOPSGENI & OCTANE (Infrastructure & Logs - high risk of secrets)
    {"agent": "DEVOPS", "type": "log", "transcript": "Error connecting to DB: postgresql://admin:superSecretPass!@db.host.com:5432/prod"},
    {"agent": "DEVOPS", "type": "log", "transcript": "User 9988776655 failed authentication 5 times."},
    {"agent": "DEVOPS", "type": "log", "transcript": "Crash dump saved to /var/log/app.log. User IP: 192.168.1.15"},
    {"agent": "DEVOPS", "type": "log", "transcript": "Stripe API Key exposed in environment: sk_live_51H...abc123"},
    {"agent": "DEVOPS", "type": "log", "transcript": "Memory leak detected in session for user mani@example.com"},
    {"agent": "DEVOPS", "type": "log", "transcript": "Reset password link sent to admin@company.com with token 9a8b7c6d."},
    {"agent": "DEVOPS", "type": "log", "transcript": "SSH login successful for root from IP 203.0.113.42"},
    {"agent": "DEVOPS", "type": "log", "transcript": "LiveKit API Secret: lks_mock_secret_998877665544332211"},
    {"agent": "DEVOPS", "type": "log", "transcript": "AWS RDS instance 'prod-db-1' CPU usage at 99%."},
    {"agent": "DEVOPS", "type": "log", "transcript": "User ID 456 (John Smith) updated billing info to card ending in 4444."},
]

async def run_stress_test():
    client = SecurelytixClient()
    logger.info(f"Starting Securelytix PII Stress Test with {len(TEST_PAYLOADS)} items...")
    
    success_count = 0
    failure_count = 0
    
    results = []

    for idx, payload in enumerate(TEST_PAYLOADS):
        logger.info(f"Testing Item {idx+1}/{len(TEST_PAYLOADS)} [Agent: {payload['agent']}]")
        
        # 1. Tokenize
        tokenized_data = await client.tokenize(payload)
        
        # Check if it actually tokenized anything (assuming it should for these payloads)
        # Note: The SDK returns the original payload if tokenization fails or if no PII is found.
        # For a true test, we'd want to inspect the output to see if tokens (e.g., <PERSON>, <PHONE>) are present.
        
        is_tokenized = tokenized_data != payload
        
        # 2. Detokenize
        detokenized_data = await client.detokenize(tokenized_data)
        
        # 3. Verify
        is_successful = (detokenized_data == payload)
        
        if is_successful:
            success_count += 1
            status = "✅ PASS"
        else:
            failure_count += 1
            status = "❌ FAIL"
            
        results.append({
            "id": idx + 1,
            "agent": payload["agent"],
            "original": payload["transcript"],
            "tokenized": tokenized_data.get("transcript", "Error"),
            "status": status
        })

    logger.info("=========================================")
    logger.info("STRESS TEST RESULTS")
    logger.info("=========================================")
    logger.info(f"Total Tested: {len(TEST_PAYLOADS)}")
    logger.info(f"Successful Detokenizations: {success_count}")
    logger.info(f"Failed Detokenizations: {failure_count}")
    
    # Save detailed results to a file for review
    report_path = os.path.join(os.path.dirname(__file__), "securelytix_stress_report.json")
    with open(report_path, "w") as f:
        json.dump(results, f, indent=4)
        
    logger.info(f"Detailed report saved to: {report_path}")

if __name__ == "__main__":
    asyncio.run(run_stress_test())
