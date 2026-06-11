# Academy AI Platform (PM2)

Kho dữ liệu tập trung và Cổng khai thác trợ lý ảo — on-premise, Qwen3-8B.

## Quickstart (1 máy Ubuntu)

```bash
cp .env.example .env
docker compose --profile code up -d
docker compose --profile code ps
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

- **Giai đoạn hiện tại:** 1 máy Ubuntu, profile `code`
- **Nghiệm thu:** 2 máy (Máy nền tảng + Máy mô hình), Qwen3-8B