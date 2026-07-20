#!/usr/bin/env python3
"""
Lightweight RAG Engine CLI Tester - Fully Self-Contained.
- Loads .env files (root .env and services/platform/.env) with priority.
- Automatically starts ONLY essential data containers (Postgres, MongoDB, Milvus, Redis).
- Starts admin-config (NestJS) to serve guardrail policies.
- Always starts rag-engine locally.
- Optionally starts embedding, rerank, and Ollama locally unless remote URLs are provided.
- Logs service output to ./rag_logs/ for debugging.
- On exit, kills all spawned processes and runs `docker compose down`.
- Sends internal secret header if GATEWAY_INTERNAL_SHARED_SECRET is set in env.
"""

import os
import sys
import subprocess
import time
import atexit
import signal
import platform
import threading
from typing import Any, Dict, Optional, List

try:
    import requests
except ImportError:
    print("Missing 'requests'. Install: pip install requests")
    sys.exit(1)

# ----- Load .env files ------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

ENV_FILES = [
    os.path.join(PROJECT_ROOT, "services", "platform", ".env"),
    os.path.join(PROJECT_ROOT, ".env"),
]

def load_env_files():
    loaded = False
    for env_file in ENV_FILES:
        if os.path.isfile(env_file):
            print(f"[Env] Loading from {env_file}")
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip()
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]
                        os.environ[key] = value
            loaded = True
            break
    if not loaded:
        print("[Env] No .env file found; using system environment variables.")
    if not os.getenv("GATEWAY_INTERNAL_SHARED_SECRET"):
        secret = load_secret_from_platform_env()
        if secret:
            os.environ["GATEWAY_INTERNAL_SHARED_SECRET"] = secret

def load_secret_from_platform_env() -> str:
    """Read GATEWAY_INTERNAL_SHARED_SECRET from services/platform/.env."""
    env_path = os.path.join(PROJECT_ROOT, "services", "platform", ".env")
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GATEWAY_INTERNAL_SHARED_SECRET="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return os.getenv("GATEWAY_INTERNAL_SHARED_SECRET", "")

load_env_files()

# ----- Configuration -------------------------------------------------
LOG_DIR = os.path.join(PROJECT_ROOT, "rag_logs")
os.makedirs(LOG_DIR, exist_ok=True)

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434").rstrip('/')
EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL", "http://localhost:8001").rstrip('/')
RERANK_BASE_URL = os.getenv("RERANK_BASE_URL", "http://localhost:8002").rstrip('/')
RAG_ENGINE_URL = os.getenv("RAG_ENGINE_URL", "http://localhost:8000").rstrip('/')
ADMIN_CONFIG_URL = os.getenv("ADMIN_CONFIG_URL", "http://localhost:3004").rstrip('/')

EMBEDDING_HEALTH = f"{EMBEDDING_BASE_URL.replace('/v1', '')}/health"
RERANK_HEALTH = f"{RERANK_BASE_URL.replace('/v1', '')}/health"
RAG_HEALTH = f"{RAG_ENGINE_URL.replace('/v1', '')}/health"
ADMIN_CONFIG_HEALTH = f"{ADMIN_CONFIG_URL.replace('/v1', '')}/api/admin-config/health"
RAG_CHAT_URL = f"{RAG_ENGINE_URL.replace('/v1', '')}/v1/chat"
OLLAMA_API_TAGS = f"{LLM_BASE_URL.replace('/v1', '')}/api/tags"

INTERNAL_SECRET = os.getenv("GATEWAY_INTERNAL_SHARED_SECRET", "")

SERVICE_READY_TIMEOUT = 300  # 5 minutes
CHECK_INTERVAL = 2

# Track background processes and their log files
background_processes: List[subprocess.Popen] = []
log_files: List[str] = []

# Skip local AI services (embedding, rerank, Ollama) if remote URLs are provided.
# rag-engine and admin-config are always started locally.
SKIP_LOCAL_AI = (
    (LLM_BASE_URL != "http://localhost:11434") or
    (EMBEDDING_BASE_URL != "http://localhost:8001") or
    (RERANK_BASE_URL != "http://localhost:8002")
)

# ----- Cleanup -------------------------------------------------------
def cleanup() -> None:
    """Kill background processes and stop/remove Docker containers."""
    print("\n[Cleanup] Shutting down...")

    for proc in background_processes:
        if proc.poll() is None:
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
            except Exception:
                pass
    background_processes.clear()

    try:
        subprocess.run(
            ["docker", "compose", "--profile", "code", "down"],
            check=False,
            capture_output=True,
            text=True,
        )
        print("[Cleanup] Containers stopped and removed.")
    except Exception:
        print("[Cleanup] Could not run docker compose down; you may need to stop containers manually.")
    print("[Cleanup] Done. Goodbye!")

atexit.register(cleanup)

def signal_handler(sig, frame):
    sys.exit(0)
signal.signal(signal.SIGINT, signal_handler)

# ----- Startup helpers -----------------------------------------------
def run_up_code() -> None:
    """Start ONLY essential data containers for RAG: Postgres, MongoDB, Milvus, Redis."""
    print("Starting minimal data containers (Postgres, MongoDB, Milvus, Redis)...")
    services = ["postgres", "mongodb", "milvus", "etcd", "minio", "redis"]
    try:
        subprocess.run(
            ["docker", "compose", "up", "-d"] + services,
            check=True,
            capture_output=True,
            text=True,
        )
        print("  Minimal data containers started.")
        time.sleep(5)
    except subprocess.CalledProcessError as e:
        print(f"docker compose failed with exit code {e.returncode}")
        print(f"stderr: {e.stderr}")
        sys.exit(1)
    except Exception as e:
        print(f"Failed to start containers: {e}")
        sys.exit(1)

def check_health(url: str) -> bool:
    try:
        r = requests.get(url, timeout=3)
        return r.status_code == 200
    except Exception:
        return False

def wait_for_service(url: str, name: str, log_path: str) -> bool:
    print(f"  Waiting for {name} (timeout: {SERVICE_READY_TIMEOUT}s)...", end="", flush=True)
    for _ in range(SERVICE_READY_TIMEOUT // CHECK_INTERVAL):
        if check_health(url):
            print(" ready.")
            return True
        print(".", end="", flush=True)
        time.sleep(CHECK_INTERVAL)
    print(" TIMEOUT")
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()[-10:]
            if lines:
                print(f"\n  Last lines from {name} log:")
                for line in lines:
                    print(f"    {line.strip()}")
    except Exception:
        pass
    return False

def launch_service(path: str, port: int, name: str, command: list) -> None:
    """Launch a service (Python or Node) with logging, using cmd.exe /c."""
    if check_health(f"http://localhost:{port}/health"):
        print(f"  {name} already running on port {port}.")
        return

    cwd = os.path.join(PROJECT_ROOT, path)
    log_path = os.path.join(LOG_DIR, f"{name}.log")
    log_files.append(log_path)
    print(f"Launching {name} on port {port}... (log: {log_path})")

    log_file = open(log_path, "w", encoding="utf-8")
    log_file.write(f"=== Starting {name} at {time.ctime()} ===\n")
    log_file.flush()

    # Use cmd.exe /c to run the command – avoids PowerShell execution policy issues
    cmd = ["cmd.exe", "/c"] + command

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
        shell=False,
    )
    background_processes.append(proc)


def launch_python_service(path: str, port: int, name: str):
    """Launch a FastAPI service using Python 3.12."""
    cmd = [
        "py", "-3.12", "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", str(port)
    ]
    launch_service(path, port, name, cmd)


def launch_nest_service(name: str, port: int):
    """Launch a NestJS service using npm run start:dev."""
    cmd = ["npm.cmd", "run", "start:dev", name]
    launch_service("services/platform", port, name, cmd)


def launch_ollama() -> None:
    """Launch Ollama server as a background process."""
    if check_health(OLLAMA_API_TAGS):
        print("  Ollama already running.")
        return

    log_path = os.path.join(LOG_DIR, "ollama.log")
    log_files.append(log_path)
    print(f"Launching Ollama server... (log: {log_path})")

    cmd = ["ollama", "serve"]
    log_file = open(log_path, "w", encoding="utf-8")
    log_file.write(f"=== Starting Ollama at {time.ctime()} ===\n")
    log_file.flush()

    if platform.system() == "Windows":
        proc = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        proc = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    background_processes.append(proc)

# ----- Core environment check ----------------------------------------
def ensure_environment() -> bool:
    """Check and start minimal data containers + admin-config + AI services."""
    # Minimal data layer (only MongoDB, Milvus, Redis, Postgres)
    print("Checking minimal data containers...")
    if not check_health("http://localhost:27017") and not check_health("http://localhost:27018"):
        run_up_code()
    else:
        print("  Data containers seem ready.")

    # Start admin-config if not running (needed for guardrail policies)
    if not check_health(ADMIN_CONFIG_HEALTH):
        print("Starting admin-config service (for guardrail policies)...")
        launch_nest_service("admin-config", 3004)
        if not wait_for_service(ADMIN_CONFIG_HEALTH, "admin-config", os.path.join(LOG_DIR, "admin-config.log")):
            print("ERROR: admin-config failed to start.")
            return False
    else:
        print("  admin-config is already running.")

    # Always start rag-engine locally
    if not check_health(RAG_HEALTH):
        launch_python_service("services/rag-engine", 8000, "rag-engine")
        if not wait_for_service(RAG_HEALTH, "rag-engine", os.path.join(LOG_DIR, "rag-engine.log")):
            print("ERROR: rag-engine failed to start.")
            return False
    else:
        print("  rag-engine is already running.")

    if SKIP_LOCAL_AI:
        print("  Skipping local embedding, rerank, Ollama (remote URLs detected).")
        for url, name in [(EMBEDDING_HEALTH, "embedding"),
                          (RERANK_HEALTH, "rerank"),
                          (OLLAMA_API_TAGS, "LLM")]:
            if not check_health(url):
                print(f"  Warning: {name} not reachable at {url}.")
        return True

    # Otherwise start local embedding, rerank, Ollama
    print("Checking local AI services...")
    embed_ok = check_health(EMBEDDING_HEALTH)
    rerank_ok = check_health(RERANK_HEALTH)
    ollama_ok = check_health(OLLAMA_API_TAGS)

    if not ollama_ok:
        launch_ollama()
        if not wait_for_service(OLLAMA_API_TAGS, "Ollama", os.path.join(LOG_DIR, "ollama.log")):
            print("ERROR: Ollama failed to start.")
            return False

    if not embed_ok:
        launch_python_service("services/embedding-server", 8001, "embedding-server")
        if not wait_for_service(EMBEDDING_HEALTH, "embedding-server", os.path.join(LOG_DIR, "embedding-server.log")):
            print("ERROR: embedding-server failed to start.")
            return False

    if not rerank_ok:
        launch_python_service("services/rerank-server", 8002, "rerank-server")
        if not wait_for_service(RERANK_HEALTH, "rerank-server", os.path.join(LOG_DIR, "rerank-server.log")):
            print("ERROR: rerank-server failed to start.")
            return False

    print("All local AI services are ready!\n")
    return True

# ----- Core CLI functions --------------------------------------------
def send_query(query: str, session_id: str = "cli-session") -> Optional[Dict[str, Any]]:
    payload = {
        "query": query,
        "sessionId": session_id,
        "messages": [],
        "user": {
            "userId": "cli-tester",
            "username": "cli-tester",
            "roles": ["admin"],
            "department": "P2",
            "maxSecurityLevel": 4,
            "scopeMaHv": None,
            "scopeMaGv": None,
        },
    }

    headers = {}
    if INTERNAL_SECRET:
        headers["x-gateway-internal-secret"] = INTERNAL_SECRET

    try:
        resp = requests.post(RAG_CHAT_URL, json=payload, headers=headers, timeout=300)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] RAG engine not reachable. Is it running?")
        return None
    except requests.exceptions.Timeout:
        print("\n[ERROR] Request timed out. LLM may be slow.")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"\n[ERROR] HTTP {e.response.status_code}: {e.response.text[:200]}")
        return None
    except Exception as e:
        print(f"\n[ERROR] {e}")
        return None

def display_response(data: Dict[str, Any]) -> None:
    if not data:
        return
    print("\n" + "=" * 80)
    print("[ANSWER]")
    print(data.get("answer", "No answer."))
    print("\n[CITATIONS]")
    citations = data.get("citations", [])
    if not citations:
        print("  (No citations)")
    else:
        for i, c in enumerate(citations, 1):
            title = c.get("title", "Unknown")
            section = c.get("section_path", "N/A")
            snippet = c.get("snippet", "").replace("\n", " ")[:120]
            rerank_score = c.get("rerank_score")
            vector_score = c.get("score")
            security_level = c.get("security_level", "public")
            print(f"  [{i}] 📄 {title}")
            if section != "N/A":
                print(f"      Section: {section}")
            if snippet:
                print(f"      Snippet: \"{snippet}...\"")
            if rerank_score is not None:
                print(f"      Rerank Score: {rerank_score:.3f}")
            if vector_score is not None:
                print(f"      Vector Score: {vector_score:.3f}")
            print(f"      Security: {security_level}")
            if c.get("chunk_id"):
                print(f"      Chunk ID: {c['chunk_id']}")
            if c.get("doc_id"):
                print(f"      Doc ID: {c['doc_id']}")
    print(f"\n[ROUTE] {data.get('route', 'N/A')}")
    print("=" * 80)

def main():
    if not ensure_environment():
        sys.exit(1)

    print("PM2 RAG CLI (Minimal Containers, Lightweight)")
    print("Type 'exit' to quit. Press Ctrl+C to abort (auto-cleanup will run).\n")
    session_id = "cli-session"
    while True:
        try:
            q = input("You: ").strip()
            if q.lower() in ("exit", "quit", "q"):
                break
            if not q:
                continue
            resp = send_query(q, session_id)
            display_response(resp)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Unexpected: {e}")

if __name__ == "__main__":
    main()
