"""
Mem0 sidecar — a long-lived HTTP daemon around Mem0Client.

The Node copilot bridge used to spawn `mem0_cli.py` once per request, which
reloaded PyTorch + the HuggingFace embedder and re-acquired the embedded Qdrant
storage lock on every call (slow, and a source of lock contention). This sidecar
boots a single Mem0Client at startup and serves search/add over HTTP, so those
heavyweight resources are loaded exactly once.

Built on the standard-library http.server only — no new framework dependencies.

Endpoints:
    GET  /health  -> {"status": "ok", "memory_ready": bool, "qdrant_mode": str}
    POST /search  <- {"user_id": "...", "query": "..."}            -> {"facts": [...]}
    POST /add     <- {"user_id": "...", "query": "...", "response": "..."} -> {"success": true}
"""

import sys
import os
import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv

# Ensure the python-agent root is importable (matches mem0_cli.py behaviour).
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

# Load environment variables (.env) from the python-agent directory BEFORE
# importing the client so Mem0/Qdrant/embedder config resolves correctly.
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

from integrations.mem0_client import Mem0Client  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [mem0_sidecar] %(levelname)s %(message)s",
)
logger = logging.getLogger("mem0_sidecar")

# Instantiate the Mem0 client ONCE at boot. This pays the PyTorch + embedder load
# and the embedded Qdrant lock acquisition a single time for the daemon's life.
client = Mem0Client()

# The embedded Qdrant + sqlite backend is not guaranteed thread-safe, and the
# server is threaded, so serialize all memory operations behind one lock.
_mem_lock = threading.Lock()


class Mem0Handler(BaseHTTPRequestHandler):
    # Silence the default noisy per-request stderr logging; we log explicitly.
    def log_message(self, fmt, *args):
        return

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        # Lightweight readiness probe for the Node bridge.
        if self.path == "/health":
            self._send_json(200, {
                "status": "ok",
                "memory_ready": client.memory is not None,
                "qdrant_mode": getattr(client, "qdrant_mode", None),
            })
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        try:
            payload = self._read_json()
        except Exception as e:  # noqa: BLE001 - report any malformed body
            self._send_json(400, {"error": f"invalid JSON body: {e}"})
            return

        # If the memory backend never initialized, fail loudly (mirrors the old
        # CLI's non-zero exit) so the Node bridge logs a real error instead of
        # believing a dropped write succeeded.
        if client.memory is None:
            self._send_json(503, {
                "error": client.init_error or "mem0 memory backend unavailable",
                "memory_unavailable": True,
            })
            return

        if self.path == "/search":
            user_id = payload.get("user_id")
            query = payload.get("query", "")
            if not user_id:
                self._send_json(400, {"error": "user_id is required"})
                return
            with _mem_lock:
                facts = client.get_relevant_facts(user_id=user_id, query=query)
            self._send_json(200, {"facts": facts})

        elif self.path == "/add":
            user_id = payload.get("user_id")
            query = payload.get("query", "")
            response = payload.get("response", "")
            if not user_id:
                self._send_json(400, {"error": "user_id is required"})
                return
            with _mem_lock:
                client.add_interaction(user_id=user_id, query=query, response=response)
            self._send_json(200, {"success": True})

        else:
            self._send_json(404, {"error": f"unknown endpoint: {self.path}"})


def main():
    host = os.getenv("MEM0_SIDECAR_HOST", "127.0.0.1")
    port = int(os.getenv("MEM0_SIDECAR_PORT", "8770"))

    if client.memory is None:
        logger.warning(
            "Mem0 backend failed to initialize: %s. Sidecar will start and "
            "return 503 until the backend becomes available.",
            client.init_error,
        )
    else:
        logger.info("Mem0 backend ready (qdrant: %s).", getattr(client, "qdrant_mode", "?"))

    server = ThreadingHTTPServer((host, port), Mem0Handler)
    logger.info("mem0 sidecar listening on http://%s:%d", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        logger.info("mem0 sidecar shut down.")


if __name__ == "__main__":
    main()
