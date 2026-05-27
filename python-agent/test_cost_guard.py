import sys
import os
import time
from unittest.mock import MagicMock

sys.path.append(os.path.dirname(__file__))

# Setup basic logging to see the guard's output
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("test")

# Import the CostGuard from utils
try:
    from utils.cost_guard import CostGuard
    from livekit.agents import llm
except ImportError as e:
    print(f"Failed to import required modules: {e}")
    print("Ensure you are running this from the python-agent root and livekit is installed.")
    sys.exit(1)

def run_tests():
    print("\n" + "="*50)
    print("RUNNING COST GUARD RESTRICTION TESTS")
    print("="*50 + "\n")

    # Initialize a test guard
    guard = CostGuard(
        agent_name="TEST_AGENT",
        session_cost_ceiling=0.05,  # Very low ceiling for easy testing ($0.05)
        max_context_turns=2,        # Small context for easy pruning
        usage_broadcast_interval_s=2.0, # 2 seconds throttle
        min_stt_words=3,
        extra_command_words={"book", "pay", "nova"}
    )

    print("\n--- TEST 1: STT Noise Gating ---")
    
    # 1.1 Pure noise (should block)
    noise = "um"
    allowed = guard.allow_transcript(noise)
    print(f"Result for '{noise}': {'ALLOWED X' if allowed else 'BLOCKED OK'}")

    # 1.2 Too short, not a command (should block)
    short = "hello"
    allowed = guard.allow_transcript(short)
    print(f"Result for '{short}': {'ALLOWED X' if allowed else 'BLOCKED OK'}")

    # 1.3 Too short, but IS a command (should allow)
    command = "nova"
    allowed = guard.allow_transcript(command)
    print(f"Result for '{command}': {'ALLOWED OK' if allowed else 'BLOCKED X'}")

    # 1.4 Normal sentence (should allow)
    sentence = "what is the weather today"
    allowed = guard.allow_transcript(sentence)
    print(f"Result for '{sentence}': {'ALLOWED OK' if allowed else 'BLOCKED X'}")

    print("\n--- TEST 2: Context Pruning ---")
    
    chat_ctx = llm.ChatContext()
    chat_ctx.add_message(role="system", content="System Prompt")
    
    # Add 6 turns (12 messages)
    for i in range(6):
        chat_ctx.add_message(role="user", content=f"User {i}")
        chat_ctx.add_message(role="assistant", content=f"Assistant {i}")

    print(f"Before Pruning: {len(chat_ctx.messages())} messages")
    # Max turns is 2, so it should keep 1 system + 4 conversation msgs = 5 msgs
    removed = guard.prune_context(chat_ctx)
    print(f"Pruned {removed} messages.")
    print(f"After Pruning: {len(chat_ctx.messages())} messages (Expected: 5)")
    if len(chat_ctx.messages()) == 5:
        print("Context Pruning Test: PASSED OK")
    else:
        print("Context Pruning Test: FAILED X")


    print("\n--- TEST 3: Metadata Broadcast Throttling ---")
    
    usage_dict = {"input_tokens": 0, "output_tokens": 0, "stt_seconds": 0.0, "tts_chars": 0}
    
    # Create mock usage data
    class MockUsageData:
        class Usage:
            model_usage = []
        usage = Usage()
    
    mock_data = MockUsageData()
    
    print("Call 1 (0s): Should Broadcast")
    should_broadcast = guard.update_usage(mock_data, usage_dict)
    print(f"Result: {'YES OK' if should_broadcast else 'NO X'}")

    print("Call 2 (Immediate): Should Block (throttled)")
    should_broadcast = guard.update_usage(mock_data, usage_dict)
    print(f"Result: {'YES X' if should_broadcast else 'NO OK'}")

    print("Sleeping 2.1 seconds...")
    time.sleep(2.1)

    print("Call 3 (after 2s delay): Should Broadcast")
    should_broadcast = guard.update_usage(mock_data, usage_dict)
    print(f"Result: {'YES OK' if should_broadcast else 'NO X'}")


    print("\n--- TEST 4: Session Cost Ceiling Enforcement ---")
    
    # Let's simulate a massive token surge that exceeds $0.05
    # $0.05 / $0.60 per 1M output tokens = ~83,000 output tokens
    
    class HighUsageData:
        class Usage:
            class MockModelUsage:
                type = "llm_usage"
                input_tokens = 0
                output_tokens = 100_000 # Costs $0.06
            model_usage = [MockModelUsage()]
        usage = Usage()

    print("Injecting 100,000 output tokens ($0.06 spend)...")
    guard.update_usage(HighUsageData(), usage_dict)
    
    # The ceiling should now be exceeded. 
    # STT should now block ALL transcripts.
    print(f"Is Ceiling Exceeded: {'YES OK' if guard.is_ceiling_exceeded else 'NO X'}")
    
    allowed = guard.allow_transcript("This is a perfectly valid long sentence that should be blocked now.")
    print(f"Test STT while ceiling exceeded: {'ALLOWED X' if allowed else 'BLOCKED OK'}")

    print("\n" + "="*50)
    print("ALL TESTS COMPLETED")
    print("="*50 + "\n")

if __name__ == "__main__":
    run_tests()
