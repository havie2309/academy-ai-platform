# Academy AI Platform (PM2)

Kho dữ liệu tập trung và Cổng khai thác trợ lý ảo — on-premise.

- **Dev (1 máy, ~16 GB RAM):** Ollama `qwen2.5:3b`
- **Nghiệm thu:** Qwen3-8B trên Máy mô hình riêng

## Quickstart (1 máy Ubuntu)

```bash
cp .env.example .env
docker compose --profile code up -d
docker compose --profile code ps

# Ollama LLM dev (nhẹ RAM)
ollama pull qwen2.5:3b
ollama run qwen2.5:3b
```

## Cấu trúc repo
services/
platform/       # NestJS: api-gateway, rbac, audit, ...
rag-engine/     # Python: RAG engine
embedding-server/  # Python: BGE-M3
document-processor/ # Python: ingest pipeline
etl-sync/       # Python: ETL
web-ui/         # Vite + React (M6)
llm-server/     # Ollama placeholder (M1)
libs/             # Shared: ai-clients, schemas, prompts, policies
data/sample-docs/ # Tài liệu mẫu
eval/             # Bộ eval
docs/             # memory.md, plan.md, task list.md

## Topology

- **Giai đoạn hiện tại:** 1 máy Ubuntu, profile `code`, LLM dev `qwen2.5:3b` (`LLM_MODEL` trong `.env`)
- **Nghiệm thu:** 2 máy (Máy nền tảng + Máy mô hình), đổi `LLM_MODEL` → Qwen3-8B