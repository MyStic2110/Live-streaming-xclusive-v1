import sys
import os

log_file = sys.argv[1] if len(sys.argv) > 1 else 'logs/swarm_master.log'

# Automatically create the logs folder or any parent directories if they do not exist
log_dir = os.path.dirname(log_file)
if log_dir and not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

try:
    with open(log_file, 'a', encoding='utf-8', errors='ignore') as f:
        for line in sys.stdin:
            sys.stdout.write(line)
            sys.stdout.flush()
            f.write(line)
            f.flush()
except KeyboardInterrupt:
    pass
