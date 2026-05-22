import os
import sys
import asyncio
import time

# Set path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from tests.agent_integration import test_bi, test_bi2, test_lina, test_astra, test_vigil, test_nova

async def main():
    print("=" * 70)
    print("      CORTEX SWARM - INTEGRATION AGENTS STATUS SUITE")
    print("=" * 70)
    print("Initializing test suite...")
    
    t_start = time.time()
    
    # Run all tests concurrently
    results = await asyncio.gather(
        test_bi.run_test(),
        test_bi2.run_test(),
        test_lina.run_test(),
        test_astra.run_test(),
        test_vigil.run_test(),
        test_nova.run_test(),
        return_exceptions=True
    )
    
    elapsed = time.time() - t_start
    
    agents = ["BI (Cortex I)", "BI2 (Cortex II)", "Lina", "Astra", "Vigil", "Nova"]
    
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
