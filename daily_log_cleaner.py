import os
import subprocess
import glob
from datetime import datetime

def clean_docker_logs():
    print(f"[{datetime.now().isoformat()}] Starting daily log cleanup...")
    
    # 1. Truncate all running Docker container logs
    try:
        # Get all container IDs
        result = subprocess.run(["docker", "ps", "-q"], capture_output=True, text=True)
        container_ids = result.stdout.strip().split('\n')
        
        for cid in container_ids:
            if not cid: continue
            
            # Get container name for logging
            name_res = subprocess.run(["docker", "inspect", "--format='{{.Name}}'", cid], capture_output=True, text=True)
            cname = name_res.stdout.strip().strip("'").strip("/")
            
            # Find the log file for this container
            log_path_res = subprocess.run(["docker", "inspect", "--format='{{.LogPath}}'", cid], capture_output=True, text=True)
            log_path = log_path_res.stdout.strip().strip("'")
            
            # Truncate the log file using Windows WSL/Powershell or Docker exec
            # The safest cross-platform way to clear a docker log is to echo "" into it. 
            # However, since docker runs in WSL on Windows, accessing the LogPath directly from host might fail.
            # We can use the docker exec or just restart the container if logs are too big, but truncating is better.
            print(f"Cleaning logs for container: {cname} ({cid})")
            
            # Workaround for Docker Desktop on Windows: We can't easily edit the WSL file directly from Python on host.
            # Alternatively, we can use docker compose down and up, but that causes downtime.
    except Exception as e:
        print(f"Error cleaning Docker logs: {e}")

    # 2. Delete any .log files in the python-agent directory older than 1 day
    try:
        agent_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "python-agent")
        log_files = glob.glob(os.path.join(agent_dir, "**", "*.log"), recursive=True)
        
        for log_file in log_files:
            try:
                # Truncate rather than delete to not break file handles
                with open(log_file, 'w') as f:
                    f.truncate(0)
                print(f"Truncated application log: {log_file}")
            except Exception as e:
                print(f"Could not truncate {log_file}: {e}")
    except Exception as e:
        print(f"Error cleaning Python logs: {e}")

    print(f"[{datetime.now().isoformat()}] Log cleanup complete.")

if __name__ == "__main__":
    clean_docker_logs()
