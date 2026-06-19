import os
import glob
import time
from datetime import datetime

# Configure retention settings (default to 7 days retention)
LOG_RETENTION_DAYS = int(os.environ.get("LOG_RETENTION_DAYS", 7))
RETENTION_SECONDS = LOG_RETENTION_DAYS * 24 * 60 * 60

def clean_old_logs():
    print(f"[{datetime.now().isoformat()}] Starting scheduled enterprise log cleanup...")
    print(f"Retention configuration: {LOG_RETENTION_DAYS} days.")
    
    current_time = time.time()
    
    # Paths to scan - base_dir is inside 'scripts/'
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    
    scan_dirs = [
        os.path.join(root_dir, "python-agent", "swarm_logs"),
        os.path.join(root_dir, "logs")  # Organized central logs directory
    ]
    
    # 1. Purge rotated files and audit files older than retention policy
    # Match patterns for rotated audit/log files like: *.jsonl.1, *.log.1, etc.
    patterns = [
        "*.jsonl.*",
        "*.log.*"
    ]
    
    deleted_count = 0
    deleted_bytes = 0
    
    for s_dir in scan_dirs:
        if not os.path.exists(s_dir):
            continue
            
        for pat in patterns:
            search_path = os.path.join(s_dir, "**", pat)
            files = glob.glob(search_path, recursive=True)
            
            for file_path in files:
                try:
                    # Get modification time of file
                    file_mtime = os.path.getmtime(file_path)
                    age_seconds = current_time - file_mtime
                    
                    if age_seconds > RETENTION_SECONDS:
                        file_size = os.path.getsize(file_path)
                        os.remove(file_path)
                        deleted_count += 1
                        deleted_bytes += file_size
                        print(f"Deleted old rotated log: {os.path.basename(file_path)} ({file_size} bytes, age: {round(age_seconds / 86400, 1)} days)")
                except Exception as e:
                    print(f"Error checking/deleting file {file_path}: {e}")
                    
    # 2. Check and truncate master logs if they exceed safe size limits (e.g. 100MB)
    master_logs = [
        os.path.join(root_dir, "logs", "swarm_master.log"),
        os.path.join(root_dir, "logs", "backend_errors.log")
    ]
    
    MAX_MASTER_SIZE = 100 * 1024 * 1024 # 100MB
    for m_log in master_logs:
        if os.path.exists(m_log):
            try:
                size = os.path.getsize(m_log)
                if size > MAX_MASTER_SIZE:
                    print(f"Master log {os.path.basename(m_log)} ({size} bytes) exceeds limit (100MB). Truncating...")
                    with open(m_log, "w", encoding="utf-8") as f:
                        f.truncate(0)
            except Exception as e:
                print(f"Error handling master log {m_log}: {e}")

    print(f"[{datetime.now().isoformat()}] Log cleanup complete. Deleted {deleted_count} files, freed {deleted_bytes} bytes.")

if __name__ == "__main__":
    clean_old_logs()
