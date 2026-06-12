
# Academy AI Platform (PM2)

Kho dữ liệu tập trung và Cổng khai thác trợ lý ảo — on-premise, Qwen3-8B.

---

## Yêu cầu

- Docker Desktop
- Node.js LTS
- Python 3.12
- Git

---

## Quickstart — 1 máy (hiện tại)

```bash
# 1. Clone repo
git clone https://github.com/havie2309/academy-ai-platform.git
cd academy-ai-platform

# 2. Tạo file .env
cp .env.example .env

# 3. Bật stack
./scripts/up-code.ps1

# 4. Kiểm tra health
./scripts/health.ps1
```

---

## Scripts

| Script | Mô tả |
|---|---|
| `./scripts/up-code.ps1` | Bật toàn bộ stack |
| `./scripts/down.ps1` | Tắt toàn bộ stack |
| `./scripts/logs.ps1` | Xem logs realtime |
| `./scripts/health.ps1` | Kiểm tra trạng thái container |

---

## Cấu trúc repo

```
services/
  platform/           # NestJS: api-gateway, rbac, audit, ...
  rag-engine/         # Python: RAG engine
  embedding-server/   # Python: BGE-M3
  document-processor/ # Python: ingest pipeline
  etl-sync/           # Python: ETL
  web-ui/             # Vite + React (M6)
  llm-server/         # Ollama (M1)
libs/
  ai-clients/         # Client LLM/embedding/rerank
  schemas/            # Request/response schema
  prompts/            # Prompt template
  policies/           # Guardrail/policy
data/sample-docs/     # Tài liệu mẫu
eval/                 # Bộ eval
docs/                 # memory.md, plan.md, task list.md
```

---

## Topology

- **Hiện tại:** 1 máy Windows/Ubuntu, profile `code`
- **Nghiệm thu:** 2 máy — Máy nền tảng + Máy mô hình (Qwen3-8B)

Khi có Máy mô hình: cập nhật `.env`:
```env
LLM_BASE_URL=http://<IP_MAY_MO_HINH>:11434
EMBEDDING_BASE_URL=http://<IP_MAY_MO_HINH>:8001
```