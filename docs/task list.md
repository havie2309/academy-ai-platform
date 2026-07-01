# Danh sách công việc triển khai — PM2 full-parity dùng Qwen2.5-3B

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
| Hạ tầng  | A-01 · Khởi tạo repo, README, `.gitignore`, cấu trúc NestJS + Python + Ollama    | M0  | `[x]`   | `README.md`, `.gitignore`, `docs/`, `libs/`, `services/platform/`, 4 Python services, `web-ui/`, `llm-server/` placeholder, `data/`, `eval/`; **`models/`** (ollama, inference) + **`training/`** (datasets, configs, runs, checkpoints, exports) scaffold + README + `.gitkeep`; `.gitignore` bỏ weight/artifact |
| Hạ tầng  | A-01b · NestJS monorepo `services/platform/` — gateway + modules scaffold        | M0  | `[x]`   | `nest-cli.json` + **9 apps** (thêm `chat`); `npm run build` pass (2026-06-15) |
| Hạ tầng  | A-01c · Python service template (`rag-engine`, workers) + shared `libs/`         | M0  | `[x]`   | 4 FastAPI template (`main.py` `/health`, `Dockerfile`, `requirements.txt`); `services/platform/libs/` — `ai-clients`, `schemas`, `prompts`, `policies` (Python stubs); repo `libs/` vẫn `.gitkeep` |
| Hạ tầng  | A-02 · `docker-compose.yml` + profile `code` (Máy nền tảng) kèm healthcheck      | M0  | `[x]`   | profile `code`, 7 data services + `user-management` (3001); Postgres **5433**; Mongo mount init; `up-code.ps1` re-check 2026-06-24 đã dựng/create đúng `pm2_user_management`; khi cổng `3001` bị local service chiếm, script nay báo rõ port collision; probe container alternate-port xác nhận image/service boot được với Postgres |
| Hạ tầng  | A-03 · `.env.example` Máy nền tảng: DB, MQ, `LLM_BASE_URL`, `EMBEDDING_BASE_URL` | M0  | `[x]`   | DB/MQ/Redis/Milvus + `LLM_*`, `EMBEDDING_*`, `RERANK_*`; `JWT_*`, `CHAT_*`, `OPENAI_*` (server-only); `services/platform/.env.example` |
| Hạ tầng  | A-04 · Logging JSON và correlation ID middleware (shared lib)                    | M0  | `[x]`   | `src/common/logger.middleware.ts` + `common.module.ts`; `CommonModule` import vào 8 Nest apps; `npm run build` pass |
| Hạ tầng  | A-05 · Scripts: `up-code`, `up-ai`, `down`, `logs`, `health`                     | M0  | `[-]`   | `scripts/up-code.ps1`, `down.ps1`, `logs.ps1`, **`health.ps1`** (HTTP health web-ui/gateway/user-management/chat/Ollama, có `-IncludeDocker`), **`smoke-app.ps1`** (smoke E2E qua gateway/login/chat + **RBAC scope, admin-config, audit read, safe refusal, admin-only deny, hidden internal route**), **`seed-iam.ps1`** (docker cp UTF-8; account examples đã đồng bộ lại seed thật), **`start-app.ps1`** (1 lệnh bật Postgres/Mongo + 3 backend + static web-ui từ build), **`start-rag.ps1`** (bootstrap `embedding-server` `:8001`, `rerank-server` `:8002`, `rag-engine` `:8000` + venv/Python 3.12), **`start-dev.ps1`** (1 lệnh mở local `api-gateway`/`user-management`/`chat` + các Python AI service + `web-ui`); `up-code.ps1` nay báo rõ khi đụng cổng `3001`; vẫn thiếu `up-ai.ps1` |
| Tài liệu | A-06 · Quickstart 2 máy (README): Máy nền tảng + hướng dẫn Máy mô hình           | M0  | `[-]`   | `README.md` **dev 1 máy chi tiết** (prereq, clone, env, cài Ollama `qwen2.5:3b`, Docker infra, BE/FE startup, port map, troubleshooting); topology 2 máy ghi chú ngắn; thiếu hướng dẫn chi tiết Máy mô hình |
| Test     | A-07 · Smoke test profile `code` — bootstrap Máy nền tảng end-to-end             | M0  | `[x]`   | Dev smoke **pass** (2026-06-16/18): `scripts/smoke-app.ps1` verify web-ui `:5173`, `GET /api/health` (6 upstream), login `admin/123456`, `GET /api/users/me`, RBAC `/api/rbac/me` + row-filter, admin-config read, audit read, safe refusal `route=refusal`, admin-only deny, hidden internal route 404, `GET /api/chat/sessions`, create/delete smoke session, logout; `scripts/health.ps1` tóm tắt health HTTP app local |
| Hạ tầng  | A-08 · Profile `ai` (Máy mô hình): compose services AI, `.env.ai.example`        | M1  |         |          |
| Test     | A-09 · Smoke test cross-host: Máy nền tảng → Máy mô hình (embed + chat)          | M1  |         |          |
| Hạ tầng  | A-10 · Cấu hình cookie domain cho 2-node deployment (cookie.domain, SameSite, Secure) | M0 |     | Cấu hình `.env` với `COOKIE_DOMAIN=.domain.com`, `COOKIE_SAMESITE=None`, `COOKIE_SECURE=true`; smoke cross-subdomain pass |


---

## B. LLM / Embedding / Rerank services


| Loại    | Mô tả                                                                          | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------------------------------ | --- | ------- | -------- |
| AI      | B-01 · `llm-server` **Ollama** — Qwen2.5-3B, chat completions, models, streaming | M1  | `[-]`   | **Ollama local chạy `qwen2.5:3b`** (dev) — chat service gọi qua OpenAI-compatible API, streaming OK; `LLM_PROVIDER=ollama`; **chưa** profile `ai` / topology 2 máy đầy đủ |
| AI      | B-02 · `embedding-server` Python — BGE-M3, embeddings 1024 chiều               | M1  | `[-]`   | FastAPI `embedding-server` có `/health`, `/v1/embeddings`; dùng `fastembed` model `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, **384 chiều dev**; `rag-engine` + `document-processor` đã gọi thật; chưa lên BGE-M3/1024 |
| AI      | B-03 · Rerank service và HTTP wrapper                                          | M1  | `[-]`   | `services/rerank-server/main.py` — FastAPI `POST /v1/rerank`, `fastembed.TextCrossEncoder` (dev `Xenova/ms-marco-MiniLM-L-6-v2`); `rag-engine/app/rerank.py` gọi qua HTTP; `start-rag.ps1` bootstrap `:8002`; **chưa** production model `bge-reranker-v2-m3` + profile `ai` |
| AI      | B-04 · `libs/ai-clients` — client thống nhất LLM/embedding/rerank              | M1  |         |          |
| AI      | B-05 · Fallback, timeout, retry, circuit-breaker                               | M1  |         |          |
| Hạ tầng | B-06 · Hoàn thiện profile `ai` trên Máy mô hình — build/pull Qwen2.5-3B, BGE-M3  | M1  |         |          |
| Test    | B-07 · Contract test 3 endpoint và latency baseline                            | M1  |         |          |


---

## C. Postgres / MongoDB / Milvus / Redis / RabbitMQ


| Loại    | Mô tả                                                           | MS  | Tiến độ | Evidence |
| ------- | --------------------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | C-01 · Postgres migration baseline (IAM, audit, nghiệp vụ core) | M0  | `[x]`   | **Reorg main** (`reorg-postgres`): `01-dimensions.sql`, `02-iam.sql`, `03-core-entities.sql`, `04-khao-thi.sql`, `09-indexes.sql`, **`15-auth-refresh-sessions.sql`**; `02-iam.sql` nay có thêm `password_salt`, `hash_iterations`, `hash_algorithm`; `user_sessions` đã có `refresh_token_hash` + `last_refreshed_at`; audit/documents; mount `/docker-entrypoint-initdb.d` |
| Dữ liệu | C-02 · MongoDB catalog schema tài liệu, chunk, ingest job       | M0  | `[x]`   | `infra/mongodb/init/01-schema.js` + `02-config.js`; mount `./infra/mongodb/init:/docker-entrypoint-initdb.d` trong `docker-compose.yml` |
| Dữ liệu | C-03 · Milvus collection và metadata filter                     | M0  | `[x]`   | `document-processor/app/milvus_store.py` giữ metadata vector tối thiểu (`chunk_id`, `document_id`, `security_rank`, `vector`); `rag-engine/app/access.py` resolve tập `docId` được phép xem từ Mongo `documents`; `rag-engine/app/milvus_search.py` nhận `expr`; `rag-engine/app/retrieval.py` push-down `document_id in [...]` vào Milvus trước khi fetch Mongo, vẫn giữ `can_view_chunk` làm defense-in-depth; regression `services/rag-engine/tests/test_retrieval.py` pass (2026-06-24) |
| Dữ liệu | C-04 · Redis session, cache, connection pool                    | M0  | `[-]`   | `services/platform/src/common/redis/redis.module.ts` + `redis.service.ts` tạo Redis layer dùng chung; `services/platform/apps/chat/src/chat/chat.cache.ts` có session/rate-limit cache; `services/rag-engine/app/cache.py` cache embedding/retrieval và session context; `services/rag-engine/app/retrieval.py` đã đọc/ghi retrieval cache thật. **Chưa** thấy connection pool/tuning vận hành và wiring đầy đủ cho toàn bộ chat flow |
| Dữ liệu | C-05 · RabbitMQ exchange/queue ingest và DLQ                    | M0  | `[x]`   | `document-processor/app/consumer.py` declare queue + **DLQ** (`x-dead-letter-routing-key`), republish retry với `retryCount`, dead-letter sau `INGEST_MAX_RETRIES`; `services/platform/apps/chat/src/ingest/ingest-queue.service.ts` đã connect RabbitMQ, `assertQueue()` rồi `sendToQueue()` trực tiếp từ platform/chat, giữ HTTP fallback khi broker chưa sẵn sàng; test `services/document-processor/tests/test_consumer.py` |
| Dữ liệu | C-06 · Seed dữ liệu nghiệp vụ mẫu và user đa role + Password hashing nâng cấp | M0 | `[-]`   | IAM **partial done**: `generate_seed.py` + `12-seed-iam.sql` đã chuyển sang `pbkdf2_sha256` + `password_salt` + `hash_iterations=100000`, đồng bộ lại các seed `11–14`; `seed-iam.ps1`; fresh DB seed end-to-end re-verify 2026-06-24 trên disposable Postgres: `users=74`, `roles=6`, `permissions=16`, `hoc_vien=50`, `exam_banks=15`, `user_sessions` table tồn tại; ví dụ login thật `admin/BGD/p2_01/676156`. **Cần:** migrate sang Argon2id (dual-hash strategy); **chưa** validate full re-run generator |
| Dữ liệu | C-07 · Bộ tài liệu mẫu `data/sample-docs/` đa định dạng         | M0  | `[x]`   | `data/sample-docs/` hiện có corpus mẫu thật `DOC-0001`…`DOC-0010` với nhiều định dạng (`.txt`, `.pdf`, `.docx`); `infra/mongodb/init/03-seed-tai-lieu.js` seed catalog `isSample=true`; `infra/mongodb/init/04-process-samples.js` + `services/document-processor/app/sample_consumer.py` đã nối hàng đợi xử lý sample docs |
| Bảo mật | C-08 · User `pm2_readonly` cho Text-to-SQL                      | M4  | `[x]`   | `infra/postgres/init/17-text-to-sql-readonly.sql` tạo role `pm2_readonly`, grant `USAGE` schema `sql_curated` + `SELECT` trên curated views; `services/platform/.env.example` + `services/rag-engine/app/config.py` đã có `SQL_READONLY_*` |
| Test    | C-09 · Test health và connectivity data platform                | M0  | `[x]`   | Connectivity pass 2026-06-24: Mongo `db.adminCommand({ ping: 1 })`, Redis `PONG`, RabbitMQ `rabbitmq-diagnostics ping`, Milvus connect OK và `list_collections()` trả `document_chunks` |


---

## D. Document ingest, OCR, chunking, vector hóa


| Loại    | Mô tả                                                   | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | D-01 · Metadata chuẩn và validation `doc_access_policy` | M2  | `[x]`   | `services/platform/apps/chat/src/documents/documents.service.ts` sanitize + validate `securityLevel/scopeType/access_*` ngay lúc upload; `services/document-processor/app/pipeline.py` `_validate_job()` lặp lại validation ở worker để job ingest không đi tiếp với metadata sai; có test `services/document-processor/tests/test_pipeline_validation.py` |
| Backend | D-02 · Worker RabbitMQ: consume, ack, retry, DLQ        | M2  | `[x]`   | `services/document-processor/app/consumer.py` declare queue + DLQ, `ack` khi xong, republish retry với `retryCount`, dead-letter sau `INGEST_MAX_RETRIES`; `services/document-processor/main.py` enqueue qua RabbitMQ và fallback background khi bật `INGEST_ALLOW_DIRECT_FALLBACK`; có test `services/document-processor/tests/test_consumer.py` |
| AI      | D-03 · Adapter PyMuPDF — PDF text-native                | M2  | `[x]`   | `services/document-processor/app/extract.py` dùng `fitz` (PyMuPDF) đọc PDF text-native; pipeline ingest gọi trực tiếp extractor này trước khi xét OCR fallback |
| AI      | D-04 · Adapter MinerU + PaddleOCR — PDF scan/ảnh        | M2  | `[x]`   | `extract.py` ưu tiên native text, sau đó thử **MinerU CLI** (`mineru -p <input> -o <output> -b pipeline`) nếu môi trường có cài, rồi fallback sang `PaddleOCR`; có regression test cho nhánh ưu tiên MinerU và nhánh fallback OCR trong `services/document-processor/tests/test_extract.py`; local hiện **chưa cài MinerU/PaddleOCR binary** nên mới verify bằng unit test path thay vì smoke runtime thật |
| AI      | D-05 · Adapter DOCX, PPTX, XLSX                         | M2  | `[x]`   | `services/document-processor/app/extract.py` hỗ trợ `.docx` (`docx2txt`), `.pptx` (parse slide XML), `.xlsx` (parse workbook/shared strings/worksheet XML); `services/platform/apps/chat/src/documents/documents.storage.ts` + `services/web-ui/src/pages/DocsPage.tsx` mở upload cho PDF/DOCX/PPTX/XLSX/TXT; có test `services/document-processor/tests/test_extract.py` |
| AI      | D-06 · Hybrid chunking, overlap, giữ cấu trúc           | M2  | `[x]`   | `services/document-processor/app/chunker.py` tách section ổn định theo `Phần/Chương/Điều/Mục`, giữ `section_path`, dựng `parent_nodes` + `child_nodes` kèm `child_ids` / `parent_preview`, và wrapper `chunk_document`/`chunk_text`. **Cải tiến mới (2026-06-25):** xử lý tất cả section bao gồm `Phần`/`Chương` (không bỏ qua); áp dụng word‑aware overlap để không cắt từ; chunk ngắn được giữ nguyên một chunk duy nhất. |
| AI      | D-07 · Prefix ngữ cảnh trước khi embed                  | M2  | `[x]`   | `services/document-processor/app/pipeline.py` đã khôi phục bước prefix ngữ cảnh tường minh trước khi embed qua `_with_section_prefix()` / `_child_embedding_text()`: mỗi child chunk embed kèm `section_path` + `parent_preview`, thay vì chỉ trông chờ retrieval child→parent; có regression `services/document-processor/tests/test_pipeline_parent_child.py` và re-run pass 2026-06-24 |
| AI      | D-08 · Batch embed, upsert Milvus, sync catalog MongoDB | M2  | `[x]`   | `services/document-processor/app/pipeline.py` batch embed trên `child_nodes`, insert parent vào Mongo, insert vector child vào Milvus rồi backfill `milvusVectorId`, cleanup stale parent/child sau re-ingest và rollback partial index qua `services/document-processor/app/milvus_store.py::delete_chunk_ids()` nếu Milvus/index lỗi; test `test_pipeline_parent_child.py` + `test_pipeline_batching.py` pass, trong đó `test_pipeline_parent_child.py` đã re-run pass 2026-06-24 |
| Backend | D-09 · Pipeline status machine và API poll status       | M2  | `[x]`   | `pipeline.py` cập nhật `processing_jobs` + `documents.ingestStatus/ingestStage/chunkCount/ingestError/updatedAt`; `services/platform/apps/chat/src/documents/documents.service.ts` có `GET /api/documents/:id/ingest-status`; `services/web-ui/src/pages/DocsPage.tsx` poll mỗi 3s để cập nhật badge/trạng thái/chunk count |
| Backend | D-10 · API upload multipart, enqueue, lưu File Storage  | M2  | `[x]`   | **REST documents** trong app `chat`: upload multipart (Multer, **PDF/DOCX/PPTX/XLSX/TXT**, 50MB), file lưu `data/uploads/`, metadata Mongo; sau upload `IngestQueueService` ưu tiên publish RabbitMQ trực tiếp từ platform/chat, fallback HTTP `/v1/process` nếu broker chưa sẵn sàng; list/download/delete + JWT guard + phân quyền |
| Backend | D-11 · Versioning file gốc và checksum                  | M2  | `[x]`   | `services/platform/apps/chat/src/documents/documents.service.ts` tính `sha256` file upload, sinh `documentKey`, tăng `version`, đánh dấu `isLatestVersion`, lưu `previousVersionDocId`, mirror lịch sử vào collection `document_versions`, và promote bản trước đó khi xóa bản mới nhất; DTO web-ui đã expose `file_checksum/version/is_latest_version` |
| Test    | D-12 · Regression ingest và eval OCR                    | M2  | `[x]`   | `services/document-processor/tests/` hiện có regression cho chunking, extractor PDF/DOCX/PPTX/XLSX, OCR fallback, Rabbit retry/DLQ và job validation; chạy `python -m unittest discover -s tests -p "test_*.py" -v` pass **20 tests**. Build `services/platform` và `services/web-ui` cũng pass sau thay đổi ingest/docs UI |
| AI      | D-13 · Nghiên cứu chunking DOCX: chuyển sang PDF trước khi extract để detect heading tốt hơn | M2 | `[ ]` | Evaluate với MinerU trên file DOCX phức tạp; so sánh chất lượng heading detection so với phương pháp hiện tại |
| Bảo mật | D-14 · Validate upload security level theo role: chặn user upload tài liệu vượt quá security level được phép | M2 | `[ ]` | `documents.service.ts` kiểm tra `securityLevel` vs `user.maxUploadSecurityLevel`; trả `403` nếu vượt quá |


---

## E. RAG multi-turn, citation, safe refusal


| Loại    | Mô tả                                                 | MS  | Tiến độ | Evidence |
| ------- | ----------------------------------------------------- | --- | ------- | -------- |
| AI      | E-01 · Router ý định rag / sql / reject / task-assist | M3  | `[x]`   | `services/rag-engine/app/router.py` classify `sql`, `rag`, `reject`, `task_assist`; `services/rag-engine/main.py` xử lý riêng `reject` và `task_assist` cho cả `/v1/chat` lẫn `/v1/chat/stream`; `services/rag-engine/app/generate.py` thêm prompt/LLM path riêng cho task-assist; regression `services/rag-engine/tests/test_sql.py` + `test_main_citations.py` pass (2026-06-24) |
| AI      | E-02 · Query embed, Milvus top-k, Mongo fetch chunk   | M3  | `[x]`   | `rag-engine/app/retrieval.py` embed query qua `embedding-server`, search **child chunks** trong Milvus, fetch child docs từ Mongo rồi resolve `parentId` để lấy **parent chunks** làm citation; đã fix flow giữ `query_text` cho rerank/filter/cache, sắp parent theo child hit mạnh nhất và có regression `services/rag-engine/tests/test_retrieval.py`; re-run pass 2026-06-24 |
| AI      | E-03 · Access filter trước retrieval                  | M3  | `[x]`   | `services/rag-engine/main.py` đọc `x-gateway-normalized-roles`; `services/rag-engine/app/access.py` chuẩn hóa alias role (`GV`/`HV`/`Giang Vien`/`Hoc Vien`) + token department trước khi build Mongo ACL query để push-down tập `document_id` vào Milvus, đồng thời vẫn giữ `can_view_chunk` làm hậu kiểm. Regression `services/rag-engine/tests/test_retrieval.py` + `test_main_citations.py` pass; full `services/rag-engine` suite pass 2026-06-24 (`45 passed`) |
| AI      | E-04 · Rerank cross-encoder và chọn context           | M3  | `[x]`   | `services/rag-engine/app/rerank.py` nay dựng candidate giàu metadata (`title/section/source`) trước khi gọi rerank và áp `RERANK_DOC_MAX_CHARS`; `services/rag-engine/app/retrieval.py` thêm `limit_context_budget()` để chặn context quá dài theo `RAG_CONTEXT_MAX_CHARS` sau rerank/filters/per-doc cap. Regression `services/rag-engine/tests/test_rerank.py` pass; full `services/rag-engine` suite pass 2026-06-24 (`45 passed`) |
| AI      | E-05 · Grounding prompt và sinh đáp án có citation    | M3  | `[x]`   | Như cũ, thêm bước xây dựng context dạng Markdown phân cấp (`# Title`, `## Section Path`) để tận dụng khả năng đọc cấu trúc của Qwen. Nghiệm thu: gửi câu hỏi qua UI, câu trả lời xuất hiện với citation đúng nguồn. (2026‑06‑24) |
| AI      | E-06 · Multi-turn context Redis                       | M3  | `[x]`   | `services/platform/apps/chat/src/chat/chat.service.ts` nay hydrate history từ `ChatCacheService` trước khi fallback về Mongo, ghi lại `chat:session:*` sau mỗi turn và clear khi xóa session; `services/platform/apps/chat/src/rag/rag.service.ts` truyền thêm `sessionId`; `services/rag-engine/main.py` hydrate/update cùng session context cho route `rag/sql/refusal`; env `CHAT_SESSION_CONTEXT_TTL`/`CHAT_SESSION_CONTEXT_MAX_MESSAGES` đã vào cấu hình; test `services/platform/apps/chat/src/chat/chat.service.spec.ts` + `services/rag-engine/tests/test_main_citations.py` pass |
| Bảo mật | E-07 · Safe refusal và blacklist từ `admin-config`    | M3  | `[x]`   | `services/rag-engine/app/safe_refusal.py` load policy từ `admin-config` (cache TTL + fallback mặc định), normalize keyword không phân biệt hoa thường/dấu, chặn trước retrieval/SQL/chat/stream trong `services/rag-engine/main.py`; `services/platform/apps/admin-config/src/admin-config.service.ts` giữ blacklist + safe refusal có version; có test `services/rag-engine/tests/test_safe_refusal.py`, `test_main_citations.py`; smoke blocked query qua gateway trả `route=refusal` |
| Backend | E-08 · `rag-engine` Python service, health, chat API  | M3  | `[x]`   | FastAPI `rag-engine` orchestrate full RAG: `/health`, `/v1/retrieve`, **`/v1/chat`** (retrieve→grounding→LLM→`{answer, citations}`) và **`/v1/chat/stream`** (SSE meta→token→done); LLM provider ollama/openai trong `app/generate.py` + grounding prompt + safe refusal; `app/config.py` load `services/platform/.env`. `chat` app gọi `RagService.chat`/`chatStream` rồi proxy SSE, giữ session/history/title ở NestJS, fallback LLM nội bộ khi engine lỗi; citations strip `text` (chỉ dùng cho LLM, không lộ ra client) |
| Test    | E-09 · Eval RAG                                       | M3  | `[x]`   | `eval/rag_cases.json` thêm corpus câu hỏi thật cho các nhóm **citation / fallback / refusal**; `services/rag-engine/app/rag_eval.py` load case + chấm answer/citation/refusal + summary; `services/rag-engine/tests/test_rag_eval.py` chạy fixture qua flow `/v1/chat` bằng mock retrieval/LLM để verify selection/source contract end-to-end; pass `python -m unittest discover -s tests -p "test_rag_eval.py" -v` |
| AI      | E-10 · Nâng cấp AI Policy từ keyword-based lên semantic/context-based | M3 | `[ ]` | Thêm semantic router + embedding-based classification để phát hiện vi phạm dựa trên ngữ nghĩa thay vì chỉ từ khóa |
| AI      | E-11 · RAG priority scoring: Database → Document security level → public | M3 | `[ ]` | Hybrid retrieval với priority scoring: dữ liệu có cấu trúc từ database (cao nhất), tài liệu confidential/restricted (trung bình), tài liệu public (thấp nhất) |


---

## F. Text-to-SQL


| Loại    | Mô tả                                                | MS  | Tiến độ | Evidence |
| ------- | ---------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | F-01 · Curated views theo miền nghiệp vụ             | M4  | `[x]`   | `infra/postgres/init/16-text-to-sql-views.sql` tạo schema `sql_curated` và 5 view `v_hoc_vien_gpa`, `v_diem_mon`, `v_ket_qua_hoc_ky`, `v_lop_hoc_phan_giang_day`, `v_lich_thi_tong_quan`; **không** expose raw exam question tables |
| AI      | F-02 · Schema prompt compact và few-shot             | M4  | `[x]`   | `services/rag-engine/app/sql_catalog.py` thêm `CURATED_VIEW_DESCRIPTIONS`, `SQL_FEW_SHOT_EXAMPLES`, `build_schema_prompt()` + `build_few_shot_prompt()`; `services/rag-engine/app/sql_generate.py` build prompt riêng qua `build_sql_messages()`; `services/rag-engine/app/sql_templates.py` có fast-path GPA / bảng điểm / kết quả học kỳ / lịch dạy / cảnh báo |
| AI      | F-03 · SQL generation qua Qwen2.5-3B                 | M4  | `[x]`   | `services/rag-engine/app/sql_generate.py` tách target `SQL_LLM_PROVIDER` / `SQL_LLM_BASE_URL` / `SQL_LLM_MODEL`; `services/platform/.env.example` pin `SQL_LLM_MODEL=qwen2.5:3b`; smoke local qua Ollama hiện có vẫn sinh `SELECT ... LIMIT 1` hợp lệ (2026-06-18) |
| Bảo mật | F-04 · Guardrail SELECT-only, LIMIT, no DDL/DML      | M4  | `[x]`   | `services/rag-engine/app/sql_guardrail.py` enforce single `SELECT`, bắt buộc `LIMIT`, whitelist curated views, chặn comment / DDL / DML / function nguy hiểm; `services/rag-engine/tests/test_sql.py` cover các case deny |
| Bảo mật | F-05 · Execute read-only, timeout, row filter inject | M4  | `[x]`   | `services/rag-engine/app/sql_execute.py` set `statement_timeout`, `default_transaction_read_only=on` và `transaction(readonly=True)` qua `pm2_readonly`; `services/rag-engine/app/sql_resolve.py` enrich `scopeMaHv` / `scopeMaGv`; `services/rag-engine/app/sql_scope.py` inject filter theo alias/view, thay thế filter sai từ user input và chặn giảng viên hỏi `v_lich_thi_tong_quan`; smoke full `run_sql_query()` cho HV `666106` pass (2026-06-18) |
| Backend | F-06 · Result formatter cho UI                       | M4  | `[x]`   | `services/rag-engine/app/sql_format.py` — GPA 1 dòng → **câu khẳng định** tiếng Việt (vd. *"Học viên **…** có GPA tích lũy hệ 4 là **3,87**…"*); nhiều dòng → bảng markdown header **tiếng Việt** qua `column_label()` (`sql_catalog.py`); số `Decimal` hiển thị dấu phẩy; `/v1/sql` + route `sql` trong `/v1/chat`/stream; `chat.service.ts` persist `route` và stream answer SQL; web-ui `ChatMarkdown.tsx` mở schema `rehype-sanitize` cho `<table>` + style bảng GFM (2026-06-18) |
| Bảo mật | F-07 · SQL audit log                                 | M4  | `[x]`   | `infra/postgres/init/16-text-to-sql-views.sql` tạo bảng `sql_query_audit`; `services/rag-engine/app/sql_audit.py` ghi `user`, `question`, `generated_sql`, `guarded_sql`, `status`, `row_count`, `latency_ms`; pipeline audit cả allow/deny/error |
| Test    | F-08 · Eval SQL và security                          | M4  | `[x]`   | `eval/sql_cases.json` làm corpus eval; `services/rag-engine/tests/test_sql.py`, `test_sql_eval.py`, `test_sql_format.py`, `test_sql_generate.py`, `test_sql_resolve.py` cover route / guardrail / scope / formatter / prompt / resolve; `python -m unittest discover -s services/rag-engine/tests -p "test_sql*.py" -v` pass **21 tests** (2026-06-18) |


---

## G. NestJS platform — gateway, IAM, RBAC, audit, config


| Loại    | Mô tả                                                        | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------------ | --- | ------- | -------- |
| Backend | G-01 · `api-gateway` NestJS — JWT, routing, proxy Python AI  | M5  | `[x]`   | Proxy `/api/auth`, `/api/users` → `user-management`; proxy `/api/chat`, `/api/documents` → `chat` `:3002`; **proxy `/api/rag/*` / `/api/rbac/*` / `/api/admin-config/*` / `/api/audit/*` / `/api/etl/*`** qua service tương ứng; protected routes verify **access JWT** ngay tại gateway, public giữ `login`/`refresh`; gateway forward `x-gateway-user-*` headers + scope headers + `x-gateway-session-id`; ETL proxy rewrite `/api/etl` → `/v1/etl`, attach internal auth header, SSE-friendly timeouts và tắt upstream keep-alive (`http.Agent keepAlive:false`); build pass + test `gateway-auth.spec.ts`, `etl-internal-auth.spec.ts` pass (2026-06-29) |
| Backend | G-02 · `rbac` NestJS — role model, permission matrix         | M5  | `[x]`   | App `services/platform/apps/rbac/` có `/api/rbac/me`, `/matrix`, `/check`, `/row-filter`; load role + permission matrix trực tiếp từ Postgres, normalize alias role `HocVien/GV`; có test `rbac.controller.spec.ts` + `access-scope.spec.ts`; build `services/platform` pass (2026-06-18) |
| Backend | G-03 · `rbac` — inject `access_scope` cho downstream         | M5  | `[x]`   | `services/platform/src/common/access-scope.ts` resolve `normalizedRoles`, `scopeMaHv`, `scopeMaGv`; gateway attach `x-gateway-access-scope`, `x-gateway-scope-ma-hv`, `x-gateway-scope-ma-gv`; `chat` → `rag-engine` propagate scope fields cho retrieval/SQL; test `gateway-auth.spec.ts`, `access-scope.spec.ts`, `services/rag-engine/tests/test_main_citations.py` pass |
| Bảo mật | G-04 · Row-level filter (NestJS `rbac` + Postgres policy)    | M5  | `[x]`   | `rbac.service.ts` trả predicate self-scope cho `hoc_vien` / `diem` / `ket_qua_hoc_ky` / curated views và scope giảng viên; `documents` filter theo `role_category_policies`; `infra/postgres/init/19-user-scope-bindings.sql` thêm `user_scope_bindings`; `services/rag-engine/app/sql_resolve.py` + `sql_scope.py` đồng bộ resolve/inject filter cho Text-to-SQL |
| Backend | G-05 · `audit` NestJS — audit log immutable                  | M5  | `[x]`   | App `services/platform/apps/audit/` expose `/api/audit/logs`; `services/platform/apps/api-gateway/src/gateway-audit.ts` ghi audit cho request protected; `services/platform/src/common/audit-log.ts` reuse path ghi log; `infra/postgres/init/18-security-services.sql` thêm trigger chặn sửa/xóa `audit_log`; test `audit.controller.spec.ts` pass |
| Backend | G-06 · `user-management` NestJS — user, profile, đơn vị, IAM | M5 | `[x]` | `auth/` + `user/`: login/logout/me/**refresh**; verify password bằng `pbkdf2_sha256` + `password_salt` + `hash_iterations`; access JWT `15m` + refresh token `7d` qua **HttpOnly cookie**; `user_sessions` lưu hash refresh token, rotate/revoke session + `login_logs`; Docker image build OK; E2E login qua gateway (2026-06-15); role codes khớp seed; **Cần:** thêm token format validation (checksum/prefix) tại gateway; **chưa** CRUD user |
| Backend | G-07 · Rate limit và throttling theo role (gateway)          | M5  | `[x]`   | `services/platform/apps/api-gateway/src/rate-limit.ts` nay resolve policy theo `normalizedRoles` (`ADMIN/BGD/P2/P7/GIANG_VIEN/HOC_VIEN`) với env `RATE_LIMIT_ROLE_*`, fallback `RATE_LIMIT_AUTH`; anonymous đi theo IP bucket riêng thay vì dùng user `anonymous` chung, đồng thời trả `X-RateLimit-*` + `Retry-After`. Regression `gateway-auth.spec.ts` + `rate-limit.spec.ts` pass, build `services/platform` pass (2026-06-24) |
| Backend | G-08 · `admin-config` NestJS — CRUD prompt/policy có version | M5  | `[x]`   | App `services/platform/apps/admin-config/` có `GET/PUT /api/admin-config/rag-policy` + `GET /internal/rag-policy`; lưu `admin_configs` + `prompt_change_log`, tăng `version`, audit khi sửa policy; internal endpoint bắt buộc `ADMIN_CONFIG_INTERNAL_KEY`; test `admin-config.controller.spec.ts` pass |
| Backend | G-09 · `workflow` NestJS — luồng phê duyệt / trạng thái      | M5  |         |          |
| Backend | G-10 · `notification` NestJS — in-app, hook RabbitMQ         | M6  |         |          |
| Backend | G-12 · Chat service — session/message Mongo, LLM multi-turn | M5  | `[x]`   | App `chat` `:3002`; Mongo `chat_sessions`/`chat_messages`; CRUD session/message + auto-title; **SSE stream endpoint** (`/messages/stream`: `meta`/`token`/`done`/`error`) + non-stream; **LLM provider abstraction** (`getLlmConfig`/`streamLlm`/`callLlm`) — switch `LLM_PROVIDER` Ollama(local `qwen2.5:3b`)↔OpenAI, mặc định Ollama; đã hook `RagService` để lấy citations từ `rag-engine` và fallback stub khi engine lỗi/chưa chạy; JWT; gateway proxy `/api/chat`; build pass. **Chưa:** service trong `docker-compose`, RAG quality/rerank hoàn thiện |
| Test    | G-11 · Penetration test auth, RBAC, audit                    | M5  | `[x]`   | Ngoài `scripts/smoke-app.ps1` + các spec RBAC/audit sẵn có, đã bổ sung `rate-limit.spec.ts` (abuse `429`, role policy, fail-open Redis), `load-shedding.spec.ts` (saturation `503`, release counter khi reject/close), `gateway-audit.spec.ts` (privileged probe → alert + revoke session), `audit.service.spec.ts`, `audit.controller.spec.ts`, `auth.controller.spec.ts` (invalid/replayed refresh token bị clear cookie). Verify pass 2026-06-29: Jest 6 suite/21 test + build `services/platform`, `services/web-ui` pass |
| Bảo mật | G-13 · Thêm format validation cho access token trước khi truy vấn DB/memory | M5 | `[ ]` | Gateway kiểm tra cấu trúc token (prefix, base64, JWT header/payload) trước khi xác thực; từ chối nếu không đúng format |
| Bảo mật | G-14 · Giảm TTL access token xuống 5 phút (tùy chọn nâng cao) | M5 | `[ ]` | Cấu hình `JWT_EXPIRES_IN=5m`; đảm bảo refresh flow hoạt động tốt với TTL ngắn |
| Bảo mật | G-15 · Shared access-token revocation và session revoke consistency | M5 | `[x]` | `services/platform/src/common/token-revocation.service.ts` dùng Redis shared store cho marker `revoked session` và `revoke-all after`; gateway kiểm tra revocation theo cùng một logic và **fail-closed** khi Redis trả dữ liệu lỗi/không tin cậy; logout, revoke session hiện tại và admin revoke toàn bộ session đều đẩy marker đúng. Regression `token-revocation.service.spec.ts`, `gateway-auth.spec.ts` pass (2026-06-29) |
| Bảo mật | G-16 · ETL internal-only route protection và gateway network hardening | M5 | `[x]` | Flow app đi `web-ui → api-gateway → etl-sync`; gateway inject internal ETL secret header, ETL verify nội bộ thay vì cho gọi admin API trực tiếp; `services/platform/apps/api-gateway/src/network-policy.ts` hỗ trợ restricted path + country policy config, hiện có thể để disabled-by-default cho production tới khi có trusted geo source. Test `etl-internal-auth.spec.ts`, `network-policy.spec.ts` pass (2026-06-29) |
| Bảo mật | G-17 · Security alerts + auto response backend | M5 | `[x]` | Thêm `infra/postgres/init/19-security-alerts.sql`, `security-alerts.service.ts`, `security-response.service.ts`; alert tạo từ `login_failed_burst`, `gateway.revoked_token_reuse`, `gateway.rate_limit_hit`, `gateway.network_policy_blocked`, `gateway.denied_burst`, `gateway.privileged_probe`; hỗ trợ auto action `temporary_lock`, `revoke_session`, `lock_account`; audit service expose `/api/audit/security-alerts*`. Verify pass qua `gateway-audit.spec.ts`, `audit.service.spec.ts`, `audit.controller.spec.ts`, build pass (2026-06-29) |

---

## H. ETL & data connector từ hệ PM nguồn


| Loại | Mô tả                                                | MS  | Tiến độ | Evidence |
| ---- | ---------------------------------------------------- | --- | ------- | -------- |
| ETL  | H-01 · `etl-sync` service và schema job/run/lineage  | M0  | `[x]`   | `infra/postgres/init/20-etl-sync.sql` tạo `etl_sources`, `etl_jobs`, `etl_runs`, `etl_lineage`, `etl_error_logs` + index; `services/etl-sync/main.py` nâng từ `/health` thành ETL API cơ bản (`/v1/etl/sources`, `/jobs`, `/runs`, `/lineage`, `/errors`) với store `memory/postgres`; `scripts/start-rag.ps1` đã khởi động thêm `etl-sync :8004`; test pass `services/rag-engine/.venv/Scripts/python.exe -m unittest discover -s services/etl-sync/tests -p "test_*.py" -v` |
| ETL  | H-02 · Connector read-only tới SQL Server nguồn      | M5  | `[-]`   | `services/etl-sync/app/connectors/sqlserver.py` thêm connector SQL Server read-only: `ping` quyền, khám phá `tables/columns`, và đọc sample rows qua structured `SELECT TOP` query builder thay vì SQL thô; `services/etl-sync/main.py` mở API `/v1/etl/sources/{id}/sqlserver/*`; source response mask `connectionConfig.password`; test pass `services/rag-engine/.venv/Scripts/python.exe -m unittest discover -s services/etl-sync/tests -p "test_*.py" -v`. **Chưa** smoke với SQL Server nguồn thật / credential thật |
| ETL  | H-03 · Batch sync (cron)                             | M5  | `[x]`   | `services/etl-sync/app/batch_sync.py` chạy cron 5-field + incremental theo `nextCursor`, chống trigger trùng slot bằng `scheduledFor`, và nay gọi luôn `BatchLoadProcessor` để transform/validate/load batch xuống đích; `etl_runs.source_range.loadSummary` ghi kết quả load; test scheduler `services/etl-sync/tests/test_etl_sync.py` pass |
| ETL  | H-04 · Event-driven sync                             | M5  |         |          |
| ETL  | H-05 · Manual sync trigger (admin API)               | M5  |         |          |
| ETL  | H-06 · Transform, validate, load Postgres và MongoDB | M5  | `[x]`   | `services/etl-sync/app/transform_load.py` thêm `BatchLoadProcessor`: hỗ trợ `fieldMappings/requiredFields/staticFields`, validate row sau transform, upsert sang `targetTable` Postgres theo `targetKeyColumns`, upsert sang `targetCollection` MongoDB, ghi `etl_lineage` applied/skipped và `etl_error_logs` cho row lỗi; test `test_batch_load_processor_*` pass trong `services/etl-sync/tests/test_etl_sync.py` |
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
| UI   | K-02 · Auth pages, JWT storage, route guard theo role      | M6  | `[x]`   | JWT E2E qua gateway; login/logout + refresh token flow; `fetchWithAuth` auto-refresh 1 lần khi `401` qua `/api/auth/refresh` (cookie **HttpOnly**); guard Admin/BGD/P2/P7; role codes khớp seed; auth refresh polish (2026-06-18) |
| UI   | K-12 · Chat history — session list, resume, persist        | M6  | `[x]`   | `ChatSessionContext` + `Sidebar` list/delete; `/chat/:sessionId`; `ChatPage` load/send; auto-title qua G-12; bỏ ephemeral state + proxy OpenAI client. **Ổn định:** sidebar optimistic (`upsertSession`), giữ list khi list API lỗi tạm, dedupe refresh + guard stale, bỏ reload thừa sau khi gửi (skip-load), không văng về home khi load lỗi; `npm run build` pass (2026-06-15). Browser automation cho login/chat/session đã có ở K-11 |
| UI   | K-03 · Chat page: SSE streaming, markdown, citation RAG    | M6  | `[x]`   | SSE client (`chatApi.streamMessage`), markdown sanitize (`react-markdown`+`remark-gfm`+`rehype-sanitize`, `ChatMarkdown.tsx` — **GFM table** allowlist `table/thead/tbody/tr/th/td` + CSS viền/scroll ngang cho kết quả SQL), **citation cards đã polish** trong `CitationList.tsx`: group theo tài liệu, giữ nhiều chunk cùng doc, badge section/page, snippet preview, ẩn source khi trùng title; stream error UX giữ câu hỏi user + bubble lỗi đỏ; `section_path` đi xuyên `rag-engine` → `chat` → web-ui; `npm.cmd run build` pass (2026-06-18) |
| UI   | K-04 · Doc workspace: upload, ingest timeline, chunk preview | M6  | [x]   | DocsPage.tsx + api/docs.ts gọi REST thật — list/upload/xem/tải/xóa; modal upload chọn danh mục + tiêu đề + **mức mật** + **đối tượng được xem**; đã nhận **PDF/DOCX/PPTX/XLSX/TXT** ở cả frontend (`accept`, validate trước submit) và backend (`documents.storage.ts`); có badge ingest status, stage, chunk count và poll `ingest-status`; **đã có timeline hiển thị các giai đoạn `queued → extract → chunk → embed → index → done` và modal xem preview 5 chunks đầu tiên qua API mới `GET /api/documents/:id/chunks`** |
| UI   | K-05 · Self-service pages                                  | M6  | `[x]`   | `services/web-ui/src/pages/AccountPage.tsx` + `services/web-ui/src/api/account.ts`: thêm tab **Hồ sơ tài khoản** cho mọi user đăng nhập; self-service xem/cập nhật hồ sơ, đổi mật khẩu, đăng xuất khỏi thiết bị khác. `services/platform/apps/user-management/src/user/users.controller.ts` + `users.service.ts` thêm `/api/users/me/account`, `/api/users/me/change-password`, `/api/users/me/logout-other-sessions`; `Sidebar` đưa `Hồ sơ tài khoản` lên trên `Cài đặt`, còn `Cài đặt hệ thống` chỉ cho `ADMIN`. Verify pass: `npm.cmd run build` (`services/web-ui`), `npm.cmd test -- --runTestsByPath apps\user-management\src\auth\auth.service.spec.ts apps\user-management\src\user\users.service.spec.ts`, `npm.cmd run build` (`services/platform`) (2026-06-30) |
| UI   | K-06 · Quiz và summary UI                                  | M6  |         |          |
| UI   | K-07 · Admin audit viewer và export                        | M6  | `[x]`   | `services/web-ui/src/components/admin/AdminAuditSection.tsx` + `services/web-ui/src/pages/AdminPage.tsx` nay render list/filter/detail/export JSON/CSV trong `/admin` qua `adminApi.getAuditLogs/getAuditLog`; build `services/web-ui` pass (`npm.cmd run build`) và Playwright `services/web-ui/tests/e2e/admin.spec.ts` pass (2026-06-24) |
| UI   | K-08 · Admin health view (gọi API gateway)                 | M6  | `[x]`   | `services/web-ui/src/pages/AdminPage.tsx` gọi `fetchGatewayHealth()` thật và render đủ 6 upstream `userManagement/chat/rbac/adminConfig/audit/rag`, summary card, trạng thái `up/down`, reload health; bỏ dashboard mock cũ cho nhánh admin health |
| UI   | K-09 · Admin AI config editor                              | M6  | `[x]`   | `AdminPage.tsx` load/save `admin-config/rag-policy`: bật/tắt safe refusal, sửa blacklist keyword, refusal message, reason cập nhật, preview metadata/version/updated-at; route guard/menu admin dùng role code normalize để hoạt động với backend thật |
| UI   | K-10 · Quota/token usage và quản lý tài khoản              | M6  | `[x]`   | `services/platform/apps/user-management/src/user/users.controller.ts` + `users.service.ts`: `GET /api/users/admin/overview`, `GET /api/users/admin/accounts`, `PATCH /api/users/admin/accounts/:userId/status`, `POST /api/users/admin/accounts/:userId/revoke-sessions`; `services/web-ui/src/components/admin/AdminOpsSection.tsx` render overview/account actions trong `/admin`; build `services/platform` + `services/web-ui` pass, Playwright `services/web-ui/tests/e2e/admin.spec.ts` pass (2026-06-24) |
| Test | K-11 · E2E UI và accessibility checklist                   | M6  | `[x]`   | `scripts/smoke-app.ps1` cover API smoke; `docs/accessibility-checklist.md` có checklist manual; thêm browser automation `services/web-ui/tests/e2e/admin.spec.ts` và `chat.spec.ts` cho login mock auth, admin health/config editor, chat stream/citation/session delete; verify pass `2 passed` (2026-06-18) |
| UI | K-13 · Admin Chat Monitoring: xem chat history/session của các user khác | M6 | `[ ]` | Admin có thể filter theo user, date range, xem chi tiết session và messages; có phân quyền và audit |
| UI | K-14 · Admin Log Viewer: xem logs của các service (rag-engine, document-processor, etl-sync) | M6 | `[x]` | `services/platform/apps/audit/src/service-logs.ts` + route `GET /api/audit/service-logs` cho admin-only log viewer; `services/web-ui/src/components/admin/AdminServiceLogsSection.tsx` trong tab technical cho filter `service / level / from / to / search / limit`; scripts `start-rag.ps1`, `start-dev.ps1`, `start-platform-dev.ps1` dùng `scripts/run-with-log.ps1` để ghi log timestamped vào `runtime-logs` (vẫn đọc fallback `.tmp-startlogs` khi cần); verify pass `npm.cmd test -- apps/audit/src/audit.service.spec.ts apps/audit/src/audit.controller.spec.ts apps/api-gateway/src/gateway-auth.spec.ts apps/api-gateway/src/token-revocation.service.spec.ts apps/user-management/src/auth/jwt.strategy.spec.ts`, `npm.cmd run build` (`services/platform`, `services/web-ui`) |
| UI | K-15 · Admin Scope Management: gán/sửa vùng dữ liệu (access scope) cho tài liệu và tài khoản | M6 | `[ ]` | Admin có thể chỉnh sửa `securityLevel`, `scopeType`, danh sách được phép của tài liệu sau upload; API `PATCH /api/documents/:id/scope` |
| UI | K-16 · Admin Dashboard UX: chuyển sang tab view, pagination, giới hạn hiển thị | M6 | `[-]` | `AdminPage.tsx` đã chuyển sang tab view `operations / security / users / policy / technical`, giảm scrolling ở dashboard quản trị; **còn thiếu** pagination/list limit đồng nhất, tách thêm monitor/log tabs chuyên biệt và polish UX khi danh sách dài |
| UI | K-17 · K-04 phase 2: timeline chi tiết, chunk preview (đã có) | M6 | `[x]` | `DocsPage.tsx` đã có timeline hiển thị các giai đoạn `queued → extract → chunk → embed → index → done` và modal xem preview 5 chunks đầu tiên qua API `GET /api/documents/:id/chunks` |
| UI | K-18 · Admin Security Alerts dashboard | M6 | `[x]` | `services/web-ui/src/components/admin/AdminSecurityAlertsSection.tsx` + `services/web-ui/src/pages/AdminPage.tsx` thêm tab `Security Alerts`; gọi `adminApi.getSecurityAlerts/getSecurityAlert/updateSecurityAlertStatus`, cho phép xem severity/status/event count/auto action/payload và thao tác `acknowledge / resolve / reopen`. Build `services/web-ui` pass (2026-06-29) |

---

## L. Traceability — use case chuẩn


| Loại      | Mô tả                            | MS       | Tiến độ | Evidence |
| --------- | -------------------------------- | -------- | ------- | -------- |
| Nghiệp vụ | UC-DT-01..04 — đào tạo           | M3/M4/M6 |         |          |
| Nghiệp vụ | UC-KT-01..04 — khảo thí          | M3/M4/M6 |         |          |
| Nghiệp vụ | UC-KH-01..04 — KHCN              | M2/M3/M6 |         |          |
| AI        | UC-AI-01..05 — GenAI/RAG         | M2–M4    | `[-]`   | Phase 1 **done:** chat LLM local (`qwen2.5:3b`) + history (**G-12** `[x]`, **K-12** `[x]`); Phase 2 **core done:** ingest/OCR/chunk/embed (**D-01..D-12** `[x]`, gồm parent-child chunking/prefix/re-ingest cleanup), RAG retrieve/rerank/grounding (**E-01..E-09** `[x]`, gồm access filter theo role chuẩn hóa + context budget sau rerank), multi-turn Redis E2E (**E-06** `[x]`), safe refusal (**E-07** `[x]`), eval harness (**E-09** `[x]`); Text-to-SQL read-only + format UX (**F-01..F-08** `[x]`); **còn:** smoke live full-stack với Milvus thật / profile `ai` 2 máy và mở rộng corpus eval |
| Quản trị  | UC-QT-01..04 — quản trị hệ thống | M0/M5/M6 | `[-]`   | JWT login + refresh cookie (**K-02** `[x]`, **G-06** `[x]`); **account self-service** (**K-05** `[x]`) cho hồ sơ/mật khẩu/phiên; admin health live + AI policy editor (**K-08** `[x]`, **K-09** `[x]`); admin quota/token/account ops (**K-10** `[x]`); audit UI/detail/export (**K-07** `[x]`); **security alerts dashboard** (**K-18** `[x]`); **service log viewer** (**K-14** `[x]`); RBAC/audit backend (**G-02..G-05** `[x]`); gateway/token hardening (**G-07**, **G-11**, **G-15**, **G-16**, **G-17**) `[x]`; admin dashboard UX tab view (**K-16**) `[-]`; **Còn thiếu:** admin chat monitoring (**K-13**), admin scope management (**K-15**) |


---

## M. Traceability — bao phủ use case đầu vào


| Loại      | Mô tả                   | MS  | Workstream | Tiến độ | Evidence |
| --------- | ----------------------- | --- | ---------- | ------- | -------- |
| Nghiệp vụ | Nhóm Đào tạo            | M6  | I, F       | `[-]`   | Schema + seed core (`13-seed-core.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm Khảo thí & ĐBCL    | M6  | I          | `[-]`   | Schema + seed (`14-seed-khao-thi.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm KHCN               | M6  | I, D       |         |          |
| Nghiệp vụ | Nhóm Thư viện           | M6  | I          |         |          |
| UI        | Nhóm Tự phục vụ HV/SV   | M6  | K, I       | `[-]`   | K-01 `[x]`, K-02 `[x]`, **K-12** `[x]`, **K-05** `[x]`; K-04 docs workspace đã upload/list/download/delete + ingest status poll + hỗ trợ **PDF/DOCX/PPTX/XLSX/TXT** ở FE/BE; user thường đã có trang tự quản lý hồ sơ/mật khẩu/phiên riêng |
| AI        | Nhóm Trợ lý ảo nâng cao | M6  | J, K       | `[-]`   | Phase 1 chat+history `[x]` (G-12, K-12); Phase 2 **gần xong:** K-03 citation/SSE + SQL table render, ingest/index pipeline (**D `[x]`, parent-child chunk/retrieval đã có regression path riêng**), RAG+SQL+safe refusal (E/F `[x]` phần lớn), admin health/policy (K-08/K-09 `[x]`), Playwright smoke (K-11 `[x]`); **chưa:** J-01..J-06 nâng cao |


### Quy tắc kiểm soát phạm vi

- Mọi use case trong phạm vi dự án phải map vào ít nhất một dòng traceability.
- Không dùng `TBD` / `làm sau` / `defer`.
- Mọi thay đổi phạm vi cập nhật đồng thời section L, M, deliverable và lộ trình milestone.
- Thay đổi topology (1 máy ↔ 2 máy): cập nhật topology, kế hoạch hạ tầng M0/M1 và workstream A–B cùng lúc.

---

## Ưu tiên tiếp theo (cập nhật 2026-06-30 — account self-service + document ACL alignment đã xong và đã verify)

### Chat Phase 1 ✅ → Phase 2 (RAG + SQL) ✅ core done

| # | Task | Trạng thái |
| - | ---- | ---------- |
| ~~C1~~ | ~~**G-12**~~ | `[x]` chat service + LLM local `qwen2.5:3b` (switch Ollama↔OpenAI) |
| ~~C2~~ | ~~**K-12**~~ | `[x]` UI history sidebar/route/load/send/delete |
| ~~C3~~ | ~~**K-03 UI**~~ | `[x]` SSE + markdown sanitize + citation cards group theo tài liệu/section/snippet |
| ~~C4~~ | ~~**G-01**~~ | `[x]` JWT verify gateway; proxy `rag-engine` + forward user context header |
| ~~C5~~ | ~~**E-05 / K-03**~~ | `[x]` polish citation/source formatting, tăng độ rõ cho câu trả lời nhiều điều kiện và regression test structured output |
| ~~C6~~ | ~~**E-09**~~ | `[x]` eval RAG corpus + harness citation/refusal |
| ~~C7~~ | ~~**G-02..G-05 / E-07 / K-08 / K-09 / K-11**~~ | `[x]` RBAC + audit + admin-config + safe refusal + admin UI + Playwright smoke |
| ~~C8~~ | ~~**K-04 / K-17**~~ | `[x]` docs workspace timeline chi tiết + chunk preview đã xong |
| ~~C9~~ | ~~**G-15 / G-16 / G-17 / K-18**~~ | `[x]` shared revocation, ETL internal auth/network hardening, security alerts + admin dashboard |

**Trạng thái chat hiện tại** — Nền chat/RAG + SQL read-only + policy/RBAC an toàn đã nối end-to-end qua gateway; parent-child chunking / retrieval đã ổn định với `section_path`, prefix ngữ cảnh trước embed, cleanup re-ingest, router `reject/task_assist`, Milvus metadata push-down theo `document_id`, access filter theo role chuẩn hóa từ gateway và context budget sau rerank. Nhánh quản trị đã khép thêm shared token revocation, gateway/ETL hardening và Security Alerts trong Admin Dashboard. Phần còn thiếu rõ nhất lúc này là bootstrap 2 máy / profile `ai`, CRUD quản trị sâu hơn, ETL admin flow hoàn chỉnh và các admin tool monitoring/logging còn lại.

**Lộ trình chat**

```
[K-12 UI] ──► [G-12 API + Mongo] ──► [LLM provider: Ollama/OpenAI]
                      │
                      ▼ (D + E + F core done)
              [E-08 rag-engine] ──► [K-03 citation/SSE/SQL table]
                      │
                      ▼
              [K-04 docs workspace] · [J advanced AI features]
```

### Ngay — đóng M0/M1 polish

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| ~~1~~ | ~~**A-02**~~ | `[x]` `up-code.ps1` verify xong; `user-management` bootstrap OK, chỉ cần tránh local port `3001` collision |
| ~~2~~ | ~~**A-07**~~ | `[x]` script smoke tự động qua gateway + chat session cleanup |
| 3 | **A-05** | Bổ sung `up-ai.ps1`; `health.ps1`, `start-dev.ps1`, `start-rag.ps1` đã xong |
| 4 | **A-06** | README quickstart 2 máy (Máy nền tảng + Máy mô hình) |
| ~~5~~ | ~~**C-09**~~ | `[x]` Connectivity pass: Mongo, Redis, RabbitMQ, Milvus |
| 6 | **C-06** | Chạy thử `generate_seed.py` → validate output 11–14 không regress IAM |
| 7 | **B-06 / B-07** | Hoàn thiện profile `ai`, contract test và smoke cross-host cho LLM/embedding/rerank |

### Tiếp — Admin / Security / ETL (M5/M6)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| ~~8~~ | ~~**G-01**~~ | `[x]` JWT verify gateway; proxy `rag-engine`, `etl-sync`, forward user context header |
| 9 | **G-12** (ops) | Thêm `chat` vào `docker-compose` profile `code` |
| ~~10~~ | ~~**G-15 / G-16 / G-17**~~ | `[x]` Shared revocation, ETL internal auth/network hardening, Security Alerts backend |
| ~~11~~ | ~~**K-07 / K-10 / K-18**~~ | `[x]` Audit viewer/export, quota-token-account ops, Security Alerts dashboard |
| 12 | **G-06** (mở rộng) | CRUD user, đơn vị; self-service profile/password/session đã xong, còn admin CRUD sâu |
| 13 | **H-04 / H-05** | Event-driven sync + manual sync trigger cho ETL |
| 14 | **H-07 / H-08** | ETL admin dashboard status/error log + test lineage/recovery |
| 15 | **K-13** | Admin chat monitoring: xem session/message của user khác |
| ~~16~~ | ~~**K-14**~~ | `[x]` Admin log viewer cho `rag-engine`, `document-processor`, `etl-sync` |
| 17 | **K-15** | Admin scope management cho tài liệu và account |
| 18 | **K-16** | Hoàn tất pagination, list limit và tách thêm monitor/log tabs trong admin dashboard |
| 19 | **D-14** | Validate upload security level theo role khi upload tài liệu |

### Sau — Domain modules / AI nâng cao (M1–M6)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 20 | **B-01..B-07** | Ollama Qwen2.5-3B production profile `ai`, embedding BGE-M3, rerank production model |
| ~~21~~ | ~~**D-06..D-08 / E-02**~~ | `[x]` parent-child chunking + retrieval đã có regression cho `section_path`, prefix embed, re-ingest cleanup/rollback và parent citation |
| ~~22~~ | ~~**E-01 / C-03**~~ | `[x]` Router `reject/task_assist` trong `rag-engine` + Milvus search expr `document_id in [...]` dựa trên ACL Mongo; test `test_sql.py`, `test_main_citations.py`, `test_retrieval.py` pass |
| ~~23~~ | ~~**G-07 / G-11**~~ | `[x]` role-aware rate limit, load-shedding cleanup và auth/admin hardening regression |
| 24 | **I-01..I-06** | API/UI nghiệp vụ cho Đào tạo / Khảo thí / KHCN / Thư viện |
| 25 | **J-01..J-07** | Tóm tắt tài liệu, hỗ trợ bài tập, quiz, giáo án, semantic search nâng cao, red-team |

### Đã xong gần đây

- **K-05 + K-04/UI ACL alignment hoàn tất** (2026-06-30) — thêm trang **Hồ sơ tài khoản** cho mọi user đăng nhập với API self-service đổi họ tên / đổi mật khẩu / đăng xuất thiết bị khác; `Cài đặt hệ thống` được tách lại thành khu vực admin-only. Đồng thời form tài liệu giữ lại 2 trường chính **Mức mật** + **Đối tượng được xem**, bỏ metadata AI gây rối và thống nhất nguyên tắc: AI chỉ dùng tài liệu khi chính user đó vốn đã có quyền xem tài liệu. Verify pass: `npm.cmd run build` (`services/web-ui`), `npm.cmd test -- --runTestsByPath apps\user-management\src\auth\auth.service.spec.ts apps\user-management\src\user\users.service.spec.ts`, `npm.cmd run build` (`services/platform`) |
- **G-15 + G-16 + G-17 + K-18 hoàn tất** (2026-06-29) — đã thêm shared access-token revocation dùng Redis shared store, gateway fail-closed khi dữ liệu revoke lỗi, ETL internal auth header + restricted-path network policy, cùng hệ Security Alerts end-to-end từ gateway/auth → audit service → Admin Dashboard (`acknowledge / resolve / reopen`). Verify pass: `npm.cmd test -- --runInBand gateway-auth.spec.ts gateway-audit.spec.ts audit.service.spec.ts audit.controller.spec.ts network-policy.spec.ts rate-limit.spec.ts`, `npm.cmd run build` (`services/platform`, `services/web-ui`) |
- **G-07 + G-11 hoàn tất** (2026-06-24) — `api-gateway` rate-limit đúng theo role thật với env `RATE_LIMIT_ROLE_*`, anonymous bucket tách theo IP, thêm `X-RateLimit-*`/`Retry-After`; `load-shedding` release lại concurrent counter khi reject hoặc client đóng sớm; `AuthController.refresh` có regression cho invalid/replayed refresh token và web `RequireAuth` đã fix bug coi mọi route bắt đầu bằng `/` là public, kèm Playwright chặn non-admin vào `/admin` |
- **E-03 + E-04 hoàn tất** (2026-06-24) — `rag-engine` nhận `x-gateway-normalized-roles`, chuẩn hóa alias role/department trước khi build Mongo ACL query để push-down `document_id` vào Milvus và vẫn giữ hậu kiểm `can_view_chunk`; lớp rerank/context được siết thêm bằng candidate giàu metadata (`title/section/source`), giới hạn `RERANK_DOC_MAX_CHARS` và budget tổng `RAG_CONTEXT_MAX_CHARS` trước khi đưa vào grounding |
- **K-10 hoàn tất** (2026-06-24) — `user-management` có thêm admin endpoints `/api/users/admin/overview`, `/api/users/admin/accounts`, đổi trạng thái tài khoản và revoke toàn bộ refresh sessions; `web-ui` render `AdminOpsSection` ngay trong `/admin` với overview quota/token/account usage, filter account và action lock/inactivate/activate/revoke |
- **K-07 hoàn tất** (2026-06-24) — `web-ui` có thêm `AdminAuditSection` trong `/admin`: filter `status/action/resourceType/userId/resourceId/from/to`, xem chi tiết bản ghi audit và export JSON/CSV qua cùng endpoint `GET /api/audit/logs` (limit export 500 dòng theo backend cap) |
- **A-02 + C-09 re-verify, C-06 seed fresh DB pass** (2026-06-24) — `up-code.ps1` đã verify lại path dựng profile `code`; script nay báo rõ port collision và probe container alternate-port xác nhận `user-management` boot được với Postgres. Connectivity Mongo/Redis/RabbitMQ/Milvus đều pass; fresh DB seed trên disposable Postgres pass với `users=74`, `roles=6`, `permissions=16`, `hoc_vien=50`, `exam_banks=15` |

