import os
import sys
import asyncio
import time

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from swarm_commander_in_action import test_bi, test_bi2, test_lina, test_astra, test_nova, test_rehearsal, test_seva

async def main():
    # Prompt user for input if no cmd-line argument is passed
    if len(sys.argv) > 1:
        choice = sys.argv[1].strip().lower()
    else:
        print("=" * 70)
        print("          SWARM COMMANDER IN ACTION - TEST SELECTION")
        print("=" * 70)
        print("Select which agent to test:")
        print("1. BI (Cortex I - MySQL)")
        print("2. BI2 (Cortex II - MongoDB)")
        print("3. Lina (Emotion Agent)")
        print("4. Astra (Growth Sprint Agent)")
        print("5. Nova (IPL Strategic Copilot)")
        print("6. Rehearsal (Speech Coaching Agent)")
        print("7. Seva (Service OS Agent)")
        print("8. All (Run all tests concurrently)")
        print("-" * 70)
        
        try:
            choice_input = input("Enter choice (1-8 or agent name) [default: 8]: ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\nAborting.")
            sys.exit(1)
            
        if not choice_input:
            choice = "all"
        elif choice_input in ["1", "bi", "cortex i", "cortex 1", "cortex1"]:
            choice = "bi"
        elif choice_input in ["2", "bi2", "cortex ii", "cortex 2", "cortex2"]:
            choice = "bi2"
        elif choice_input in ["3", "lina"]:
            choice = "lina"
        elif choice_input in ["4", "astra"]:
            choice = "astra"
        elif choice_input in ["5", "nova"]:
            choice = "nova"
        elif choice_input in ["6", "rehearsal"]:
            choice = "rehearsal"
        elif choice_input in ["7", "seva"]:
            choice = "seva"
        elif choice_input in ["8", "all"]:
            choice = "all"
        else:
            choice = choice_input

    # Map choices to run functions
    test_map = {
        "bi": (test_bi.run_test, "BI (Cortex I)"),
        "bi2": (test_bi2.run_test, "BI2 (Cortex II)"),
        "lina": (test_lina.run_test, "Lina"),
        "astra": (test_astra.run_test, "Astra"),

        "nova": (test_nova.run_test, "Nova"),
        "rehearsal": (test_rehearsal.run_test, "Rehearsal"),
        "seva": (test_seva.run_test, "Seva"),
    }
    
    print("\n" + "=" * 70)
    print("      CORTEX SWARM - INTEGRATION AGENTS STATUS SUITE")
    print("=" * 70)
    
    t_start = time.time()
    
    if choice == "all":
        print("Initializing all tests concurrently...")
        tasks = [item[0]() for item in test_map.values()]
        agents = [item[1] for item in test_map.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    elif choice in test_map:
        print(f"Running test for agent: {test_map[choice][1]}...")
        agents = [test_map[choice][1]]
        try:
            res = await test_map[choice][0]()
            results = [res]
        except Exception as e:
            results = [e]
    else:
        print(f"Unknown agent or option: '{choice}'")
        sys.exit(1)
        
    elapsed = time.time() - t_start
    
    print("\n" + "-" * 70)
    print(f"{'AGENT NAME':<18} | {'STATUS':<6} | {'MESSAGE'}")
    print("-" * 70)
    
    all_passed = True
    for agent, res in zip(agents, results):
        if isinstance(res, Exception):
            status = "FAIL"
            msg = f"Crash: {str(res)}"
            all_passed = False
        else:
            success, msg = res
            status = "PASS" if success else "FAIL"
            if not success:
                all_passed = False
        
        # Trim message to fit console layout
        msg_preview = msg[:50] + "..." if len(msg) > 50 else msg
        print(f"{agent:<18} | {status:<6} | {msg_preview}")
        
    print("-" * 70)
    print(f"Total time elapsed: {elapsed:.2f} seconds")
    print(f"Overall Result: {'SUCCESS - System is Stable!' if all_passed else 'FAILURE - Action Required'}")
    print("=" * 70)
    
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    asyncio.run(main())
