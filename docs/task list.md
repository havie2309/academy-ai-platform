# Danh sách công việc triển khai — PM2 full-parity dùng Qwen3-8B

> Stack: **NestJS** (platform) · **Python** (AI/workers) · **Ollama** (`llm-server`)

## Quy ước


| Cột           | Ý nghĩa                                                        |
| ------------- | -------------------------------------------------------------- |
| **Milestone** | M0–M6 hoặc `—` nếu xuyên suốt nhiều giai đoạn                  |
| **Tiến độ**   | `[ ]` chưa xong · `[-]` đang làm / một phần · `[x]` hoàn thành |
| **Evidence**  | Bằng chứng nghiệm thu — điền khi xong task                     |


---

## A. Bootstrap repo, Docker Compose, config


| Loại     | Mô tả                                                                            | MS  | Tiến độ | Evidence |
| -------- | -------------------------------------------------------------------------------- | --- | ------- | -------- |
| Hạ tầng  | A-01 · Khởi tạo repo, README, `.gitignore`, cấu trúc NestJS + Python + Ollama    | M0  | `[x]`   | `README.md`, `.gitignore`, `docs/`, `libs/`, `services/platform/`, 4 Python services, `web-ui/`, `llm-server/` placeholder, `data/`, `eval/`; **`models/`** (ollama, inference) + **`training/`** (datasets, configs, runs, checkpoints, exports) scaffold + README + `.gitkeep`; `.gitignore` bỏ weight/artifact (PR #13) |
| Hạ tầng  | A-01b · NestJS monorepo `services/platform/` — gateway + modules scaffold        | M0  | `[x]`   | `nest-cli.json` + **9 apps** (thêm `chat`); `npm run build` pass (2026-06-15) |
| Hạ tầng  | A-01c · Python service template (`rag-engine`, workers) + shared `libs/`         | M0  | `[x]`   | 4 FastAPI template (`main.py` `/health`, `Dockerfile`, `requirements.txt`); `services/platform/libs/` — `ai-clients`, `schemas`, `prompts`, `policies` (Python stubs); repo `libs/` vẫn `.gitkeep` |
| Hạ tầng  | A-02 · `docker-compose.yml` + profile `code` (Máy nền tảng) kèm healthcheck      | M0  | `[-]`   | profile `code`, 7 data services + `user-management` (3001); Postgres **5433**; Mongo mount init; `user-management` **Dockerfile build OK** (Node 22); **chưa** verify `up-code.ps1` full stack với container `user-management` |
| Hạ tầng  | A-03 · `.env.example` Máy nền tảng: DB, MQ, `LLM_BASE_URL`, `EMBEDDING_BASE_URL` | M0  | `[x]`   | DB/MQ/Redis/Milvus + `LLM_*`, `EMBEDDING_*`, `RERANK_*`; `JWT_*`, `CHAT_*`, `OPENAI_*` (server-only); `services/platform/.env.example` |
| Hạ tầng  | A-04 · Logging JSON và correlation ID middleware (shared lib)                    | M0  | `[x]`   | `src/common/logger.middleware.ts` + `common.module.ts`; `CommonModule` import vào 8 Nest apps; `npm run build` pass |
| Hạ tầng  | A-05 · Scripts: `up-code`, `up-ai`, `down`, `logs`, `health`                     | M0  | `[-]`   | `scripts/up-code.ps1`, `down.ps1`, `logs.ps1`, **`health.ps1`** (HTTP health web-ui/gateway/user-management/chat/Ollama, có `-IncludeDocker`), **`smoke-app.ps1`** (smoke E2E qua gateway/login/chat), **`seed-iam.ps1`** (docker cp UTF-8), **`start-app.ps1`** (1 lệnh bật Postgres/Mongo + 3 backend + static web-ui từ build), **`start-rag.ps1`** (bootstrap `embedding-server` `:8001`, `rerank-server` `:8002`, `rag-engine` `:8000` + venv/Python 3.12); vẫn thiếu `up-ai.ps1` |
| Tài liệu | A-06 · Quickstart 2 máy (README): Máy nền tảng + hướng dẫn Máy mô hình           | M0  | `[-]`   | `README.md` **dev 1 máy chi tiết** (prereq, clone, env, cài Ollama `qwen2.5:3b`, Docker infra, BE/FE startup, port map, troubleshooting) (PR #14); topology 2 máy ghi chú ngắn; thiếu hướng dẫn chi tiết Máy mô hình |
| Test     | A-07 · Smoke test profile `code` — bootstrap Máy nền tảng end-to-end             | M0  | `[x]`   | Dev smoke **pass** (2026-06-16): `scripts/smoke-app.ps1` verify web-ui `:5173`, `GET /api/health`, login `admin/123456`, `GET /api/users/me`, `GET /api/chat/sessions`, create/delete smoke session, logout; `scripts/health.ps1` tóm tắt health HTTP app local |
| Hạ tầng  | A-08 · Profile `ai` (Máy mô hình): compose services AI, `.env.ai.example`        | M1  |         |          |
| Test     | A-09 · Smoke test cross-host: Máy nền tảng → Máy mô hình (embed + chat)          | M1  |         |          |


---

## B. LLM / Embedding / Rerank services


| Loại    | Mô tả                                                                          | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------------------------------ | --- | ------- | -------- |
| AI      | B-01 · `llm-server` **Ollama** — Qwen3-8B, chat completions, models, streaming | M1  | `[-]`   | **Ollama local chạy `qwen2.5:3b`** (dev) — chat service gọi qua OpenAI-compatible API, streaming OK; `LLM_PROVIDER=ollama` (PR #14); **chưa** Qwen3-8B trên Máy mô hình + profile `ai` |
| AI      | B-02 · `embedding-server` Python — BGE-M3, embeddings 1024 chiều               | M1  | `[-]`   | FastAPI `embedding-server` có `/health`, `/v1/embeddings`; dùng `fastembed` model `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, **384 chiều dev**; `rag-engine` + `document-processor` đã gọi thật; chưa lên BGE-M3/1024 |
| AI      | B-03 · Rerank service và HTTP wrapper                                          | M1  |         |          |
| AI      | B-04 · `libs/ai-clients` — client thống nhất LLM/embedding/rerank              | M1  |         |          |
| AI      | B-05 · Fallback, timeout, retry, circuit-breaker                               | M1  |         |          |
| Hạ tầng | B-06 · Hoàn thiện profile `ai` trên Máy mô hình — build/pull Qwen3-8B, BGE-M3  | M1  |         |          |
| Test    | B-07 · Contract test 3 endpoint và latency baseline                            | M1  |         |          |


---

## C. Postgres / MongoDB / Milvus / Redis / RabbitMQ


| Loại    | Mô tả                                                           | MS  | Tiến độ | Evidence |
| ------- | --------------------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | C-01 · Postgres migration baseline (IAM, audit, nghiệp vụ core) | M0  | `[x]`   | **Reorg main** (`reorg-postgres`): `01-dimensions.sql`, `02-iam.sql`, `03-core-entities.sql`, `04-khao-thi.sql`, `09-indexes.sql`; audit/documents; mount `/docker-entrypoint-initdb.d` |
| Dữ liệu | C-02 · MongoDB catalog schema tài liệu, chunk, ingest job       | M0  | `[x]`   | `infra/mongodb/init/01-schema.js` + `02-config.js`; mount `./infra/mongodb/init:/docker-entrypoint-initdb.d` trong `docker-compose.yml` (PR #6) |
| Dữ liệu | C-03 · Milvus collection và metadata filter                     | M0  | `[-]`   | `document-processor/app/milvus_store.py` auto-create collection `document_chunks` (`chunk_id`, `document_id`, `security_rank`, `vector`) + COSINE index; `rag-engine/app/milvus_search.py` search top-k thật; access filter hiện áp sau khi fetch Mongo (`can_view_chunk`), chưa push-down metadata filter đầy đủ |
| Dữ liệu | C-04 · Redis session, cache, connection pool                    | M0  |         |          |
| Dữ liệu | C-05 · RabbitMQ exchange/queue ingest và DLQ                    | M0  | `[-]`   | `document-processor/app/consumer.py` đã có durable queue consume, `basic_qos`, `ack`/`nack(requeue=false)` và startup background consumer; chưa có exchange/DLQ topology rõ ràng và publisher RabbitMQ trực tiếp từ platform |
| Dữ liệu | C-06 · Seed dữ liệu nghiệp vụ mẫu và user đa role               | M0  | `[-]`   | IAM **done**: `12-seed-iam.sql` bcrypt + `generate_seed.py` synced (PR #9); `seed-iam.ps1`; users admin/gv001/hv001/p2; **chưa** validate full re-run generator → 11–14 |
| Dữ liệu | C-07 · Bộ tài liệu mẫu `data/sample-docs/` đa định dạng         | M0  |         |          |
| Bảo mật | C-08 · User `pm2_readonly` cho Text-to-SQL                      | M4  |         |          |
| Test    | C-09 · Test health và connectivity data platform                | M0  |         |          |


---

## D. Document ingest, OCR, chunking, vector hóa


| Loại    | Mô tả                                                   | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | D-01 · Metadata chuẩn và validation `doc_access_policy` | M2  | `[-]`   | **Phân quyền 2 trục** khi upload: `securityLevel` (public/internal/restricted/confidential) + `scopeType` (all/role/department/custom) lưu Mongo metadata; enforce `canView` ở list/download/delete (PR #15); **chưa** validate đầy đủ theo Postgres `doc_access_policy` + ingest |
| Backend | D-02 · Worker RabbitMQ: consume, ack, retry, DLQ        | M2  | `[-]`   | `document-processor` có consumer chạy nền (`run_consumer_in_background`), parse job JSON, `ack` khi xong và `nack` khi lỗi; chưa có retry policy/DLQ đầy đủ |
| AI      | D-03 · Adapter PyMuPDF — PDF text-native                | M2  | `[-]`   | `document-processor/app/extract.py` dùng `fitz` (PyMuPDF) để extract text PDF text-native; đã hỗ trợ `.pdf`, `.txt`, `.md`, `.csv`; chưa có fallback scan/OCR |
| AI      | D-04 · Adapter MinerU + PaddleOCR — PDF scan/ảnh        | M2  |         |          |
| AI      | D-05 · Adapter DOCX, PPTX, XLSX                         | M2  |         |          |
| AI      | D-06 · Hybrid chunking, overlap, giữ cấu trúc           | M2  | `[-]`   | `document-processor/app/chunker.py` đã chunk theo `max_size` + overlap; pipeline dùng thật; mặc định `CHUNK_MAX_SIZE=400` trong `document-processor/app/config.py`; đã verify reindex thủ công `DOC01_quy_dinh_thi_hk2_2025_2026` từ **2 → 4 chunks**; chưa giữ heading/section/table theo kiểu hybrid structure-aware |
| AI      | D-07 · Prefix ngữ cảnh trước khi embed                  | M2  |         |          |
| AI      | D-08 · Batch embed, upsert Milvus, sync catalog MongoDB | M2  | `[-]`   | `document-processor/app/pipeline.py` embed batch qua `embedding-server`, xóa vector cũ theo `document_id`, insert Milvus và sync `document_chunks` Mongo + `milvusVectorId`; chưa có retry/batch tuning/eval |
| Backend | D-09 · Pipeline status machine và API poll status       | M2  | `[-]`   | `processing_jobs` + fields `ingestStatus/ingestStage/chunkCount/ingestError` đã cập nhật trong Mongo; có `GET /api/documents/:id/ingest-status`; `DocsPage` poll mỗi 3s để cập nhật badge/trạng thái/chunk count |
| Backend | D-10 · API upload multipart, enqueue, lưu File Storage  | M2  | `[x]`   | **REST documents** trong app `chat`: upload multipart (Multer, **PDF-only** + 50MB), file lưu `data/uploads/`, metadata Mongo; sau upload gọi `IngestQueueService` submit job sang `document-processor` `/v1/process`, lỗi queue được phản ánh vào `ingestStatus=failed`; list/download/delete + JWT guard + phân quyền (PR #15) |
| Backend | D-11 · Versioning file gốc và checksum                  | M2  |         |          |
| Test    | D-12 · Regression ingest và eval OCR                    | M2  |         |          |


---

## E. RAG multi-turn, citation, safe refusal


| Loại    | Mô tả                                                 | MS  | Tiến độ | Evidence |
| ------- | ----------------------------------------------------- | --- | ------- | -------- |
| AI      | E-01 · Router ý định rag / sql / reject / task-assist | M3  |         |          |
| AI      | E-02 · Query embed, Milvus top-k, Mongo fetch chunk   | M3  | `[-]`   | `rag-engine/app/retrieval.py` đã embed query qua `embedding-server`, search Milvus top-k, fetch `document_chunks` từ Mongo và trả citations |
| AI      | E-03 · Access filter trước retrieval                  | M3  | `[-]`   | `rag-engine/app/access.py` enforce `securityLevel` + `scopeType` + owner/role/department/custom trước khi trả chunk; chưa có row-filter đồng bộ với Postgres policy |
| AI      | E-04 · Rerank cross-encoder và chọn context           | M3  | `[-]`   | `rerank-server` (`POST /v1/rerank`, fastembed `TextCrossEncoder`); `rag-engine/app/rerank.py` gọi rerank sau Milvus+access filter, chọn top `RERANK_TOP_K` chunk cho LLM; fallback vector order khi rerank lỗi; `start-rag.ps1` khởi động `:8002` |
| AI      | E-05 · Grounding prompt và sinh đáp án có citation    | M3  | `[-]`   | Grounding + sinh đáp án nằm trong `rag-engine/app/generate.py` (SYSTEM_PROMPT tiếng Việt, chỉ dùng tài liệu, safe refusal); LLM nhận **toàn bộ chunk `text`** sau rerank (E-04); stream/non-stream persist citations + route `rag`; **còn** cần siết parser/output contract vì model đôi lúc trả lẫn prose + JSON làm raw JSON lọt lên UI |
| AI      | E-06 · Multi-turn context Redis                       | M3  |         |          |
| Bảo mật | E-07 · Safe refusal và blacklist từ `admin-config`    | M3  |         |          |
| Backend | E-08 · `rag-engine` Python service, health, chat API  | M3  | `[x]`   | FastAPI `rag-engine` orchestrate full RAG: `/health`, `/v1/retrieve`, **`/v1/chat`** (retrieve→grounding→LLM→`{answer, citations}`) và **`/v1/chat/stream`** (SSE meta→token→done); LLM provider ollama/openai trong `app/generate.py` + grounding prompt + safe refusal; `app/config.py` load `services/platform/.env`. `chat` app gọi `RagService.chat`/`chatStream` rồi proxy SSE, giữ session/history/title ở NestJS, fallback LLM nội bộ khi engine lỗi; citations strip `text` (chỉ dùng cho LLM, không lộ ra client) |
| Test    | E-09 · Eval RAG                                       | M3  |         |          |


---

## F. Text-to-SQL


| Loại    | Mô tả                                                | MS  | Tiến độ | Evidence |
| ------- | ---------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | F-01 · Curated views theo miền nghiệp vụ             | M4  |         |          |
| AI      | F-02 · Schema prompt compact và few-shot             | M4  |         |          |
| AI      | F-03 · SQL generation qua Qwen3-8B                   | M4  |         |          |
| Bảo mật | F-04 · Guardrail SELECT-only, LIMIT, no DDL/DML      | M4  |         |          |
| Bảo mật | F-05 · Execute read-only, timeout, row filter inject | M4  |         |          |
| Backend | F-06 · Result formatter cho UI                       | M4  |         |          |
| Bảo mật | F-07 · SQL audit log                                 | M4  |         |          |
| Test    | F-08 · Eval SQL và security                          | M4  |         |          |


---

## G. NestJS platform — gateway, IAM, RBAC, audit, config


| Loại    | Mô tả                                                        | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------------ | --- | ------- | -------- |
| Backend | G-01 · `api-gateway` NestJS — JWT, routing, proxy Python AI  | M5  | `[-]`   | Proxy `/api/auth`, `/api/users` → `user-management`; proxy `/api/chat` → `chat` `:3002` (SSE-friendly timeouts, proxy đăng ký trước Nest routes qua `ExpressAdapter`); **fix lỗi 400 chập chờn SSE** = tắt upstream keep-alive (`http.Agent keepAlive:false`) ở gateway + Vite proxy (PR #14); health upstream user-management + chat; login E2E pass; PR **#9/#12/#13/#14**; **chưa** JWT verify gateway, proxy RAG/Python |
| Backend | G-02 · `rbac` NestJS — role model, permission matrix         | M5  |         |          |
| Backend | G-03 · `rbac` — inject `access_scope` cho downstream         | M5  | `[-]`   | JWT enrich `department` + `max_security_level` (user-management auth + jwt.strategy 2 app); `req.user` mang đủ claim để phân quyền tài liệu (PR #15); **chưa** service `rbac` riêng |
| Bảo mật | G-04 · Row-level filter (NestJS `rbac` + Postgres policy)    | M5  |         |          |
| Backend | G-05 · `audit` NestJS — audit log immutable                  | M5  |         |          |
| Backend | G-06 · `user-management` NestJS — user, profile, đơn vị, IAM | M5  | `[x]`   | `auth/` + `user/`: login/logout/me; JWT + bcrypt; sessions + login_logs; Docker image build OK; E2E login qua gateway (PR **#9**, 2026-06-15); role codes khớp seed; **chưa** CRUD user |
| Backend | G-07 · Rate limit và throttling theo role (gateway)          | M5  |         |          |
| Backend | G-08 · `admin-config` NestJS — CRUD prompt/policy có version | M5  |         |          |
| Backend | G-09 · `workflow` NestJS — luồng phê duyệt / trạng thái      | M5  |         |          |
| Backend | G-10 · `notification` NestJS — in-app, hook RabbitMQ         | M6  |         |          |
| Backend | G-12 · Chat service — session/message Mongo, LLM multi-turn | M5  | `[x]`   | App `chat` `:3002`; Mongo `chat_sessions`/`chat_messages`; CRUD session/message + auto-title; **SSE stream endpoint** (`/messages/stream`: `meta`/`token`/`done`/`error`) + non-stream; **LLM provider abstraction** (`getLlmConfig`/`streamLlm`/`callLlm`) — switch `LLM_PROVIDER` Ollama(local `qwen2.5:3b`)↔OpenAI, mặc định Ollama (PR #14); đã hook `RagService` để lấy citations từ `rag-engine` và fallback stub khi engine lỗi/chưa chạy; JWT; gateway proxy `/api/chat`; build pass. **Chưa:** service trong `docker-compose`, RAG quality/rerank hoàn thiện |
| Test    | G-11 · Penetration test auth, RBAC, audit                    | M5  |         |          |


---

## H. ETL & data connector từ hệ PM nguồn


| Loại | Mô tả                                                | MS  | Tiến độ | Evidence |
| ---- | ---------------------------------------------------- | --- | ------- | -------- |
| ETL  | H-01 · `etl-sync` service và schema job/run/lineage  | M0  |         |          |
| ETL  | H-02 · Connector read-only tới SQL Server nguồn      | M5  |         |          |
| ETL  | H-03 · Batch sync (cron)                             | M5  |         |          |
| ETL  | H-04 · Event-driven sync                             | M5  |         |          |
| ETL  | H-05 · Manual sync trigger (admin API)               | M5  |         |          |
| ETL  | H-06 · Transform, validate, load Postgres và MongoDB | M5  |         |          |
| UI   | H-07 · Dashboard ETL status và error log (admin)     | M6  |         |          |
| Test | H-08 · Test ETL lineage và recovery                  | M6  |         |          |


---

## I. Module nghiệp vụ (Đào tạo / Khảo thí / KHCN / Thư viện / Tự phục vụ)


| Loại      | Mô tả                                       | MS  | Tiến độ | Evidence |
| --------- | ------------------------------------------- | --- | ------- | -------- |
| Nghiệp vụ | I-01 · Module Đào tạo                       | M6  |         |          |
| Nghiệp vụ | I-02 · Module Khảo thí & ĐBCL               | M6  | `[-]`   | DB: `04-khao-thi.sql` + `14-seed-khao-thi.sql`; **chưa** API NestJS, ingest, UI nghiệp vụ |
| Nghiệp vụ | I-03 · Module KHCN                          | M6  |         |          |
| Nghiệp vụ | I-04 · Module Thư viện                      | M6  |         |          |
| Nghiệp vụ | I-05 · Module tự phục vụ học viên/sinh viên | M6  |         |          |
| Test      | I-06 · Test nghiệp vụ chéo module           | M6  |         |          |


---

## J. Tính năng cổng trợ lý ảo nâng cao


| Loại | Mô tả                                            | MS  | Tiến độ | Evidence |
| ---- | ------------------------------------------------ | --- | ------- | -------- |
| AI   | J-01 · Tóm tắt tài liệu (kể cả tài liệu hạn chế) | M6  |         |          |
| AI   | J-02 · Hỗ trợ bài tập, giải thích từng bước      | M6  |         |          |
| AI   | J-03 · Sinh, làm, chấm quiz và giải thích đáp án | M6  |         |          |
| AI   | J-04 · Tiến trình học và soạn giáo án            | M6  |         |          |
| AI   | J-05 · Phân tích xu hướng và báo cáo sơ khai     | M6  |         |          |
| AI   | J-06 · Tìm kiếm ngữ nghĩa và chatbot cá nhân     | M6  |         |          |
| Test | J-07 · Red-team và kiểm thử chức năng nâng cao   | M6  |         |          |


---

## K. Web UI + Admin UI


| Loại | Mô tả                                                      | MS  | Tiến độ | Evidence |
| ---- | ---------------------------------------------------------- | --- | ------- | -------- |
| UI   | K-01 · Scaffold Vite + React + React Router, layout, theme | M6  | `[x]`   | `services/web-ui/` — Vite 8 + React 19 + Router 7 + Tailwind 4; `ChatLayout`, `Sidebar`; routes `/chat` `/docs` `/admin` `/settings` `/login`; brand **EduMind** |
| UI   | K-02 · Auth pages, JWT storage, route guard theo role      | M6  | `[x]`   | JWT E2E qua gateway; login/logout; guard Admin/BGD/P2/P7; role codes khớp seed; PR **#9** (2026-06-15) |
| UI   | K-12 · Chat history — session list, resume, persist        | M6  | `[x]`   | `ChatSessionContext` + `Sidebar` list/delete; `/chat/:sessionId`; `ChatPage` load/send; auto-title qua G-12; bỏ ephemeral state + proxy OpenAI client. **Ổn định (PR #13):** sidebar optimistic (`upsertSession`), giữ list khi list API lỗi tạm, dedupe refresh + guard stale, bỏ reload thừa sau khi gửi (skip-load), không văng về home khi load lỗi; `npm run build` pass (2026-06-15). **Chưa:** smoke/E2E tự động (K-11) |
| UI   | K-03 · Chat page: SSE streaming, markdown, citation RAG    | M6  | `[-]`   | **UI done:** SSE client (`chatApi.streamMessage`), markdown sanitize (`react-markdown`+`remark-gfm`+`rehype-sanitize`, `ChatMarkdown.tsx`), citation chips (`CitationList.tsx`); **stream error UX**: giữ câu hỏi user + bubble lỗi đỏ khi stream lỗi; SSE chạy ổn với LLM local sau fix keep-alive. Citation hiện lấy từ `rag-engine` khi có, fallback stub khi engine lỗi/chưa chạy; **còn** case raw JSON từ model bị render ra UI nếu parser structured output trượt, và citation quality/rerank chưa hoàn chỉnh |
| UI   | K-04 · Doc workspace: upload, ingest timeline              | M6  | `[-]`   | `DocsPage.tsx` + `api/docs.ts` gọi REST thật — list/upload/xem/tải/xóa; modal upload chọn danh mục + tiêu đề + **mức mật** + **đối tượng được xem**; **chỉ nhận PDF** ở cả frontend (`accept=.pdf`, validate trước submit) và backend (`documents.storage.ts`); có badge ingest status, stage, chunk count và poll `ingest-status`; chưa có timeline chi tiết/chunk preview |
| UI   | K-05 · Self-service pages                                  | M6  |         |          |
| UI   | K-06 · Quiz và summary UI                                  | M6  |         |          |
| UI   | K-07 · Admin audit viewer và export                        | M6  |         |          |
| UI   | K-08 · Admin health view (gọi API gateway)                 | M6  | `[-]`   | `AdminPage.tsx` — `fetchGatewayHealth()`; upstream `userManagement` + `chat`; stats/queries vẫn mock |
| UI   | K-09 · Admin AI config editor                              | M6  |         |          |
| UI   | K-10 · Quota/token usage và quản lý tài khoản              | M6  |         |          |
| Test | K-11 · E2E UI và accessibility checklist                   | M6  |         |          |


---

## L. Traceability — use case chuẩn


| Loại      | Mô tả                            | MS       | Tiến độ | Evidence |
| --------- | -------------------------------- | -------- | ------- | -------- |
| Nghiệp vụ | UC-DT-01..04 — đào tạo           | M3/M4/M6 |         |          |
| Nghiệp vụ | UC-KT-01..04 — khảo thí          | M3/M4/M6 |         |          |
| Nghiệp vụ | UC-KH-01..04 — KHCN              | M2/M3/M6 |         |          |
| AI        | UC-AI-01..05 — GenAI/RAG         | M2–M4    | `[-]`   | Phase 1 **done:** chat LLM local (`qwen2.5:3b`) + history (**G-12** `[x]`, **K-12** `[x]`); Phase 2 **partial:** embedding + retrieve + rerank + grounded chat + access filter + ingest/index pipeline (B-02, D-08, E-02, E-03, E-04, E-05, E-08) |
| Quản trị  | UC-QT-01..04 — quản trị hệ thống | M0/M5/M6 | `[-]`   | JWT login + admin dashboard prototype (K-02 `[x]`, K-08 `[-]`, G-06 `[x]`); PR #9 merged |


---

## M. Traceability — bao phủ use case đầu vào


| Loại      | Mô tả                   | MS  | Workstream | Tiến độ | Evidence |
| --------- | ----------------------- | --- | ---------- | ------- | -------- |
| Nghiệp vụ | Nhóm Đào tạo            | M6  | I, F       | `[-]`   | Schema + seed core (`13-seed-core.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm Khảo thí & ĐBCL    | M6  | I          | `[-]`   | Schema + seed (`14-seed-khao-thi.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm KHCN               | M6  | I, D       |         |          |
| Nghiệp vụ | Nhóm Thư viện           | M6  | I          |         |          |
| UI        | Nhóm Tự phục vụ HV/SV   | M6  | K, I       | `[-]`   | K-01 `[x]`, K-02 `[x]`, **K-12** `[x]`; K-04 docs workspace đã upload/list/download/delete + ingest status poll + chặn file ngoài PDF ở FE/BE |
| AI        | Nhóm Trợ lý ảo nâng cao | M6  | J, K       | `[-]`   | Phase 1 chat+history `[x]` (G-12, K-12); Phase 2 partial: K-03/E citations qua `rag-engine`, ingest/index đang nối tiếp |


### Quy tắc kiểm soát phạm vi

- Mọi use case trong phạm vi dự án phải map vào ít nhất một dòng traceability.
- Không dùng `TBD` / `làm sau` / `defer`.
- Mọi thay đổi phạm vi cập nhật đồng thời section L, M, deliverable và lộ trình milestone.
- Thay đổi topology (1 máy ↔ 2 máy): cập nhật topology, kế hoạch hạ tầng M0/M1 và workstream A–B cùng lúc.

---

## Ưu tiên tiếp theo (cập nhật 2026-06-16 — local LLM + docs phân quyền)

### Chat Phase 1 ✅ → Phase 2 (RAG)

| # | Task | Trạng thái |
| - | ---- | ---------- |
| ~~C1~~ | ~~**G-12**~~ | `[x]` chat service + LLM local `qwen2.5:3b` (switch Ollama↔OpenAI) |
| ~~C2~~ | ~~**K-12**~~ | `[x]` UI history sidebar/route/load/send/delete |
| ~~C3~~ | ~~**K-03 UI**~~ | `[-]` SSE + markdown sanitize + citation chips (đã hook `rag-engine`; còn parse structured output/citation polish) |
| **C4** | **G-01** | JWT verify gateway; proxy `rag-engine` sau |
| **C5** | **E-05 / K-03** | Siết structured output parse, tránh lộ raw JSON và làm gọn nguồn tham khảo |

**Lộ trình chat**

```
[K-12 UI] ──► [G-12 API + Mongo] ──► [LLM provider: Ollama/OpenAI]
                      │
                      ▼ (D + E đang làm một phần)
              [E-08 rag-engine] ──► [K-03 citation/SSE]
```

### Ngay — đóng M0 bootstrap

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 1 | **A-02** | Verify `.\scripts\up-code.ps1` full stack — `user-management` container + Postgres |
| ~~2~~ | ~~**A-07**~~ | `[x]` script smoke tự động qua gateway + chat session cleanup |
| 3 | **A-05** | Bổ sung `up-ai.ps1`; health app local đã xong |
| 4 | **A-06** | README quickstart 2 máy (Máy nền tảng + Máy mô hình) |
| 5 | **C-09** | Test connectivity: Mongo, Redis, RabbitMQ, Milvus |
| 6 | **C-06** | Chạy thử `generate_seed.py` → validate output 11–14 không regress IAM |

### Tiếp — gateway + UI polish (M5/M6)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 7 | **G-01** | JWT verify gateway; proxy `rag-engine` |
| 8 | **G-12** (ops) | Thêm `chat` vào `docker-compose` profile `code` |
| 9 | **G-02..G-05** | RBAC service, `access_scope`, row filter, audit log |
| 10 | **K-04** | Doc workspace Phase 2: timeline chi tiết, chunk preview, UX ingest tốt hơn |
| 11 | **K-08** | Admin health — bỏ mock stats, hiển thị services thật |
| 12 | **G-06** (mở rộng) | CRUD user, profile, đơn vị |
| 13 | **K-03** | RAG chat polish: structured-output cleanup, citation quality, bỏ raw JSON leak |
| 14 | **K-11** | E2E UI smoke (login → chat history → send message) |

### Sau — AI pipeline (M1–M3)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 15 | **B-01..B-07** | Ollama Qwen3-8B, embedding BGE-M3, rerank, profile `ai` |
| 16 | **D-01..D-12** | Ingest pipeline: OCR, chunk, embed, Milvus |
| 17 | **E-01..E-09** | Hoàn thiện RAG multi-turn, citation, safe refusal trên nền pipeline hiện có |
| 18 | **F-01..F-08** | Text-to-SQL read-only |

### Đã xong gần đây

- **Phase 2 ingest/RAG local** (2026-06-16) — `embedding-server` có `/v1/embeddings`; `rerank-server` có `/v1/rerank`; `rag-engine` có `/v1/retrieve`, `/v1/chat`, `/v1/chat/stream`; `document-processor` extract → chunk(`400`) → embed → Milvus + Mongo; `chat` đã đi qua `rag-engine` full turn (fallback LLM nội bộ khi engine lỗi); `DocsPage` poll `ingest-status`
- **Chunk config + reindex verify** (2026-06-16) — `document-processor` dùng mặc định `CHUNK_MAX_SIZE=400`; reindex thủ công `DOC01_quy_dinh_thi_hk2_2025_2026` đã tăng từ **2** lên **4** chunks
- **Docs upload PDF-only** (2026-06-16) — frontend `DocsPage` và backend `documents.storage.ts` đều chặn file không phải `.pdf`; tài liệu `.docx` cũ giữ trạng thái ingest lỗi như kỳ vọng
- **Scripts vận hành local** (2026-06-16) — thêm `start-app.ps1` (1 lệnh bật stack từ build, seed tùy chọn) và `start-rag.ps1` (bootstrap 3 Python services)
- **A-07 smoke automation** (2026-06-16) — thêm `health.ps1` (HTTP app health) và `smoke-app.ps1` (web-ui, gateway health, login, `/users/me`, chat session create/delete, logout)
- **PR #14 merged → main** (2026-06-16) — chat dùng **LLM local Ollama `qwen2.5:3b`** (provider switch Ollama↔OpenAI), **stream error UX** (giữ câu hỏi + bubble lỗi đỏ), **fix lỗi 400 chập chờn SSE** (tắt upstream keep-alive ở gateway + Vite), README dev 1 máy chi tiết
- **PR #15 open** (`feat/phan-quyen-tai-lieu`) — trang **Tài liệu functional**: REST upload/list/xem/tải/xóa (Multer, `data/uploads/` + Mongo metadata), **phân quyền 2 trục** (mức mật + đối tượng được xem) enforce ở list/download/delete; upload đã submit ingest job + có trạng thái xử lý/chunk count trên UI; JWT enrich `department` + `max_security_level`
- PR **#12/#13 merged** — chat service + SSE + UI history; **K-03 UI** (SSE/markdown/citation chips) `[-]`; fix ổn định chat (sidebar optimistic, dedupe refresh, bỏ reload thừa, không văng về home); gateway proxy qua `ExpressAdapter`; scaffold `models/` + `training/` + `.gitignore` (2026-06-15)
- **G-12** `[x]`, **K-12** `[x]` — chat history Phase 1: Mongo sessions/messages, provider switch Ollama/OpenAI, UI sidebar/route/persist
- PR **#9 merged** — JWT auth, gateway proxy, web-ui, IAM seed bcrypt
- **G-06** `[x]`, **K-02** `[x]` — login E2E qua gateway
- Dev stack: Postgres `:5433` + gateway `:3000` + user-management `:3001` + chat `:3002` + web-ui `:5173`
