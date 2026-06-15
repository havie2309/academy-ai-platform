# Models (inference) — local storage

Thư mục mount cho **model phục vụ inference** (Ollama LLM, embedding, rerank). **Không commit weight** vào Git.

## Cấu trúc

| Path | Mục đích |
|------|----------|
| `ollama/` | Bind volume Docker Ollama hoặc symlink tới `~/.ollama/models` |
| `inference/` | Weight tải về (BGE-M3, rerank, GGUF…) nếu không dùng Ollama |

## Dev — Qwen2.5 3B (giai đoạn 1 máy)

```bash
# Cài Ollama trên host (Ubuntu/WSL), model lưu mặc định ~/.ollama/models
ollama pull qwen2.5:3b

# Kiểm tra
ollama list
curl http://localhost:11434/v1/models
```

`.env` (services/platform):

```env
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5:3b
```

## Docker (profile `ai` — sau này)

Mount `models/ollama` → `/root/.ollama` trong container `llm-server`.

## Quy tắc

- File lớn (`.gguf`, `.bin`, `.safetensors`, blob Ollama) **chỉ ở local**.
- Chỉ commit `README.md` và `.gitkeep` trong repo.
