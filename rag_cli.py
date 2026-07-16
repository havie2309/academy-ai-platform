#!/usr/bin/env python3
"""
Lightweight RAG Engine CLI Tester - Fully Self-Contained.
- Automatically starts ONLY essential data containers (MongoDB, Milvus, Redis).
- Automatically starts AI services: embedding, rerank, rag-engine, AND Ollama.
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
import argparse
import threading
from typing import Any, Dict, Optional, List

try:
    import requests
except ImportError:
    print("Missing 'requests'. Install: pip install requests")
    sys.exit(1)

# ----- Configuration -------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(PROJECT_ROOT, "rag_logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Service endpoints
EMBEDDING_URL = "http://localhost:8001/health"
RERANK_URL = "http://localhost:8002/health"
RAG_URL = "http://localhost:8000/health"
RAG_CHAT_URL = "http://localhost:8000/v1/chat"
OLLAMA_API_TAGS = "http://localhost:11434/api/tags"


def load_secret_from_platform_env() -> str:
    """Read GATEWAY_INTERNAL_SHARED_SECRET from services/platform/.env."""
    env_path = os.path.join(PROJECT_ROOT, "services", "platform", ".env")
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GATEWAY_INTERNAL_SHARED_SECRET="):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        return parts[1].strip()
    except FileNotFoundError:
        pass
    # Fallback to system env for flexibility
    return os.getenv("GATEWAY_INTERNAL_SHARED_SECRET", "")


# Read internal secret from services/platform/.env (or env var fallback)
INTERNAL_SECRET = load_secret_from_platform_env()

SERVICE_READY_TIMEOUT = 300  # 5 minutes
CHECK_INTERVAL = 2

# Track background processes and their log files
background_processes: List[subprocess.Popen] = []
log_files: List[str] = []


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
    """
    Start ONLY essential data containers for RAG:
    - PostgreSQL: policy event and SQL query audit
    - MongoDB: document/chunk metadata
    - Milvus: vector search (plus its dependencies etcd + minio)
    - Redis: cache and session context
    Skips Postgres and RabbitMQ to save RAM.
    """
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


def launch_service(path: str, port: int, name: str) -> None:
    """Launch a FastAPI service using Python 3.12, printing logs to console and file."""
    if check_health(f"http://localhost:{port}/health"):
        print(f"  {name} already running on port {port}.")
        return

    cwd = os.path.join(PROJECT_ROOT, path)
    log_path = os.path.join(LOG_DIR, f"{name}.log")
    log_files.append(log_path)
    print(f"Launching {name} on port {port}... (log: {log_path})")

    cmd = [
        "py", "-3.12", "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", str(port)
    ]

    # Open log file for writing
    log_file = open(log_path, "w", encoding="utf-8")
    log_file.write(f"=== Starting {name} at {time.ctime()} ===\n")
    log_file.flush()

    # Start the process with pipe for stdout/stderr
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,  # line buffered
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if platform.system() == "Windows" else 0,
        start_new_session=platform.system() != "Windows",
    )
    background_processes.append(proc)

    # Start a thread to read stdout and print to console + log file
    def reader_thread(proc: subprocess.Popen, log_file, name: str):
        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            # Write to log file
            log_file.write(line)
            log_file.flush()
        proc.stdout.close()

    thread = threading.Thread(target=reader_thread, args=(proc, log_file, name), daemon=True)
    thread.start()


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


def ensure_environment() -> bool:
    """Check and start minimal data containers + AI services + Ollama."""
    # 1. Minimal data layer (only MongoDB, Milvus, Redis)
    print("Checking minimal data containers...")
    if not check_health("http://localhost:27017") and not check_health("http://localhost:27018"):
        run_up_code()
    else:
        print("  Data containers seem ready.")

    # 2. Ollama (must be ready before rag-engine starts)
    print("Checking Ollama...")
    ollama_ok = check_health(OLLAMA_API_TAGS)
    if not ollama_ok:
        launch_ollama()
        if not wait_for_service(OLLAMA_API_TAGS, "Ollama", os.path.join(LOG_DIR, "ollama.log")):
            print("ERROR: Ollama failed to start.")
            return False
    else:
        print("  Ollama is ready.")

    # 3. AI services (embedding, rerank, rag)
    print("Checking AI services...")
    embed_ok = check_health(EMBEDDING_URL)
    rerank_ok = check_health(RERANK_URL)
    rag_ok = check_health(RAG_URL)

    if not embed_ok or not rerank_ok or not rag_ok:
        print("  Starting missing AI services...")
        if not embed_ok:
            launch_service("services/embedding-server", 8001, "embedding-server")
        if not rerank_ok:
            launch_service("services/rerank-server", 8002, "rerank-server")
        if not rag_ok:
            launch_service("services/rag-engine", 8000, "rag-engine")

        print("Waiting for services to become ready...")
        time.sleep(5)
        all_ok = True
        if not embed_ok:
            embed_log = os.path.join(LOG_DIR, "embedding-server.log")
            if not wait_for_service(EMBEDDING_URL, "embedding-server", embed_log):
                all_ok = False
        if not rerank_ok:
            rerank_log = os.path.join(LOG_DIR, "rerank-server.log")
            if not wait_for_service(RERANK_URL, "rerank-server", rerank_log):
                all_ok = False
        if not rag_ok:
            rag_log = os.path.join(LOG_DIR, "rag-engine.log")
            if not wait_for_service(RAG_URL, "rag-engine", rag_log):
                all_ok = False
        if not all_ok:
            print("ERROR: Some AI services failed to start. Check logs in ./rag_logs/")
            return False
    else:
        print("  All AI services are already running.")

    print("All services are ready!\n")
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

    # Build headers – send secret if configured
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
