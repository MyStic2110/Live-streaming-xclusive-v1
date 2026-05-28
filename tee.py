import sys
import os

log_file = sys.argv[1] if len(sys.argv) > 1 else 'swarm_master.log'

try:
    with open(log_file, 'a', encoding='utf-8', errors='ignore') as f:
        for line in sys.stdin:
            sys.stdout.write(line)
            sys.stdout.flush()
            f.write(line)
            f.flush()
except KeyboardInterrupt:
    pass
