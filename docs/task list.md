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
| Hạ tầng  | A-02 · `docker-compose.yml` + profile `code` (Máy nền tảng) kèm healthcheck      | M0  | `[-]`   | profile `code`, 7 data services + `user-management` (3001); Postgres **5433**; Mongo mount init; `user-management` **Dockerfile build OK** (Node 22); **chưa** verify `up-code.ps1` full stack với container `user-management` |
| Hạ tầng  | A-03 · `.env.example` Máy nền tảng: DB, MQ, `LLM_BASE_URL`, `EMBEDDING_BASE_URL` | M0  | `[x]`   | DB/MQ/Redis/Milvus + `LLM_*`, `EMBEDDING_*`, `RERANK_*`; `JWT_*`, `CHAT_*`, `OPENAI_*` (server-only); `services/platform/.env.example` |
| Hạ tầng  | A-04 · Logging JSON và correlation ID middleware (shared lib)                    | M0  | `[x]`   | `src/common/logger.middleware.ts` + `common.module.ts`; `CommonModule` import vào 8 Nest apps; `npm run build` pass |
| Hạ tầng  | A-05 · Scripts: `up-code`, `up-ai`, `down`, `logs`, `health`                     | M0  | `[-]`   | `scripts/up-code.ps1`, `down.ps1`, `logs.ps1`, **`health.ps1`** (HTTP health web-ui/gateway/user-management/chat/Ollama, có `-IncludeDocker`), **`smoke-app.ps1`** (smoke E2E qua gateway/login/chat + **RBAC scope, admin-config, audit read, safe refusal, admin-only deny, hidden internal route**), **`seed-iam.ps1`** (docker cp UTF-8), **`start-app.ps1`** (1 lệnh bật Postgres/Mongo + 3 backend + static web-ui từ build), **`start-rag.ps1`** (bootstrap `embedding-server` `:8001`, `rerank-server` `:8002`, `rag-engine` `:8000` + venv/Python 3.12); vẫn thiếu `up-ai.ps1` |
| Tài liệu | A-06 · Quickstart 2 máy (README): Máy nền tảng + hướng dẫn Máy mô hình           | M0  | `[-]`   | `README.md` **dev 1 máy chi tiết** (prereq, clone, env, cài Ollama `qwen2.5:3b`, Docker infra, BE/FE startup, port map, troubleshooting); topology 2 máy ghi chú ngắn; thiếu hướng dẫn chi tiết Máy mô hình |
| Test     | A-07 · Smoke test profile `code` — bootstrap Máy nền tảng end-to-end             | M0  | `[x]`   | Dev smoke **pass** (2026-06-16/18): `scripts/smoke-app.ps1` verify web-ui `:5173`, `GET /api/health` (6 upstream), login `admin/123456`, `GET /api/users/me`, RBAC `/api/rbac/me` + row-filter, admin-config read, audit read, safe refusal `route=refusal`, admin-only deny, hidden internal route 404, `GET /api/chat/sessions`, create/delete smoke session, logout; `scripts/health.ps1` tóm tắt health HTTP app local |
| Hạ tầng  | A-08 · Profile `ai` (Máy mô hình): compose services AI, `.env.ai.example`        | M1  |         |          |
| Test     | A-09 · Smoke test cross-host: Máy nền tảng → Máy mô hình (embed + chat)          | M1  |         |          |


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
| Dữ liệu | C-01 · Postgres migration baseline (IAM, audit, nghiệp vụ core) | M0  | `[x]`   | **Reorg main** (`reorg-postgres`): `01-dimensions.sql`, `02-iam.sql`, `03-core-entities.sql`, `04-khao-thi.sql`, `09-indexes.sql`, **`15-auth-refresh-sessions.sql`**; `user_sessions` đã có `refresh_token_hash` + `last_refreshed_at`; audit/documents; mount `/docker-entrypoint-initdb.d` |
| Dữ liệu | C-02 · MongoDB catalog schema tài liệu, chunk, ingest job       | M0  | `[x]`   | `infra/mongodb/init/01-schema.js` + `02-config.js`; mount `./infra/mongodb/init:/docker-entrypoint-initdb.d` trong `docker-compose.yml` |
| Dữ liệu | C-03 · Milvus collection và metadata filter                     | M0  | `[-]`   | `document-processor/app/milvus_store.py` auto-create collection `document_chunks` (`chunk_id`, `document_id`, `security_rank`, `vector`) + COSINE index; `rag-engine/app/milvus_search.py` search top-k thật; access filter hiện áp sau khi fetch Mongo (`can_view_chunk`), chưa push-down metadata filter đầy đủ |
| Dữ liệu | C-04 · Redis session, cache, connection pool                    | M0  | `[-]`   | `services/platform/src/common/redis/redis.module.ts` + `redis.service.ts` tạo Redis layer dùng chung; `services/platform/apps/chat/src/chat/chat.cache.ts` có session/rate-limit cache; `services/rag-engine/app/cache.py` cache embedding/retrieval và session context; `services/rag-engine/app/retrieval.py` đã đọc/ghi retrieval cache thật. **Chưa** thấy connection pool/tuning vận hành và wiring đầy đủ cho toàn bộ chat flow |
| Dữ liệu | C-05 · RabbitMQ exchange/queue ingest và DLQ                    | M0  | `[x]`   | `document-processor/app/consumer.py` declare queue + **DLQ** (`x-dead-letter-routing-key`), republish retry với `retryCount`, dead-letter sau `INGEST_MAX_RETRIES`; `services/platform/apps/chat/src/ingest/ingest-queue.service.ts` đã connect RabbitMQ, `assertQueue()` rồi `sendToQueue()` trực tiếp từ platform/chat, giữ HTTP fallback khi broker chưa sẵn sàng; test `services/document-processor/tests/test_consumer.py` |
| Dữ liệu | C-06 · Seed dữ liệu nghiệp vụ mẫu và user đa role               | M0  | `[-]`   | IAM **done**: `12-seed-iam.sql` bcrypt + `generate_seed.py` synced; `seed-iam.ps1`; users admin/gv001/hv001/p2; **chưa** validate full re-run generator → 11–14 |
| Dữ liệu | C-07 · Bộ tài liệu mẫu `data/sample-docs/` đa định dạng         | M0  | `[x]`   | `data/sample-docs/` hiện có corpus mẫu thật `DOC-0001`…`DOC-0010` với nhiều định dạng (`.txt`, `.pdf`, `.docx`); `infra/mongodb/init/03-seed-tai-lieu.js` seed catalog `isSample=true`; `infra/mongodb/init/04-process-samples.js` + `services/document-processor/app/sample_consumer.py` đã nối hàng đợi xử lý sample docs |
| Bảo mật | C-08 · User `pm2_readonly` cho Text-to-SQL                      | M4  | `[x]`   | `infra/postgres/init/17-text-to-sql-readonly.sql` tạo role `pm2_readonly`, grant `USAGE` schema `sql_curated` + `SELECT` trên curated views; `services/platform/.env.example` + `services/rag-engine/app/config.py` đã có `SQL_READONLY_*` |
| Test    | C-09 · Test health và connectivity data platform                | M0  |         |          |


---

## D. Document ingest, OCR, chunking, vector hóa


| Loại    | Mô tả                                                   | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | D-01 · Metadata chuẩn và validation `doc_access_policy` | M2  | `[x]`   | `services/platform/apps/chat/src/documents/documents.service.ts` sanitize + validate `securityLevel/scopeType/access_*` ngay lúc upload; `services/document-processor/app/pipeline.py` `_validate_job()` lặp lại validation ở worker để job ingest không đi tiếp với metadata sai; có test `services/document-processor/tests/test_pipeline_validation.py` |
| Backend | D-02 · Worker RabbitMQ: consume, ack, retry, DLQ        | M2  | `[x]`   | `services/document-processor/app/consumer.py` declare queue + DLQ, `ack` khi xong, republish retry với `retryCount`, dead-letter sau `INGEST_MAX_RETRIES`; `services/document-processor/main.py` enqueue qua RabbitMQ và fallback background khi bật `INGEST_ALLOW_DIRECT_FALLBACK`; có test `services/document-processor/tests/test_consumer.py` |
| AI      | D-03 · Adapter PyMuPDF — PDF text-native                | M2  | `[x]`   | `services/document-processor/app/extract.py` dùng `fitz` (PyMuPDF) đọc PDF text-native; pipeline ingest gọi trực tiếp extractor này trước khi xét OCR fallback |
| AI      | D-04 · Adapter MinerU + PaddleOCR — PDF scan/ảnh        | M2  | `[x]`   | `extract.py` ưu tiên native text, sau đó thử **MinerU CLI** (`mineru -p <input> -o <output> -b pipeline`) nếu môi trường có cài, rồi fallback sang `PaddleOCR`; có regression test cho nhánh ưu tiên MinerU và nhánh fallback OCR trong `services/document-processor/tests/test_extract.py`; local hiện **chưa cài MinerU/PaddleOCR binary** nên mới verify bằng unit test path thay vì smoke runtime thật |
| AI      | D-05 · Adapter DOCX, PPTX, XLSX                         | M2  | `[x]`   | `services/document-processor/app/extract.py` hỗ trợ `.docx` (`docx2txt`), `.pptx` (parse slide XML), `.xlsx` (parse workbook/shared strings/worksheet XML); `services/platform/apps/chat/src/documents/documents.storage.ts` + `services/web-ui/src/pages/DocsPage.tsx` mở upload cho PDF/DOCX/PPTX/XLSX/TXT; có test `services/document-processor/tests/test_extract.py` |
| AI      | D-06 · Hybrid chunking, overlap, giữ cấu trúc           | M2  | `[x]`   | `services/document-processor/app/chunker.py` split theo **Phần / Chương / Điều / Mục**, nhận cả biến thể OCR không dấu `Phan/Chuong/Dieu/Muc`, prefix `section_path` vào chunk text, và chuyển sang line-based chunking khi phát hiện bảng/tabular text để giữ hàng/cột; có test `services/document-processor/tests/test_chunker.py` |
| AI      | D-07 · Prefix ngữ cảnh trước khi embed                  | M2  | `[x]`   | `chunker.py` prefix `section_path` vào chunk text qua `_with_section_prefix()` trước khi embed; `pipeline.py` embed trực tiếp `c.text` và đồng thời lưu `metadata.sectionPath` trong Mongo để truy vết |
| AI      | D-08 · Batch embed, upsert Milvus, sync catalog MongoDB | M2  | `[x]`   | `services/document-processor/app/pipeline.py` batch embed qua `embedding-server`, retry theo `EMBEDDING_MAX_RETRIES` + backoff, validate số vector trả về, insert Milvus và sync `document_chunks` Mongo + `milvusVectorId`, rồi xóa chunk/vector stale của cùng `documentId` bằng `delete_document_except()` để re-ingest không để lại orphan/zombie vectors; có test `services/document-processor/tests/test_pipeline_batching.py` |
| Backend | D-09 · Pipeline status machine và API poll status       | M2  | `[x]`   | `pipeline.py` cập nhật `processing_jobs` + `documents.ingestStatus/ingestStage/chunkCount/ingestError/updatedAt`; `services/platform/apps/chat/src/documents/documents.service.ts` có `GET /api/documents/:id/ingest-status`; `services/web-ui/src/pages/DocsPage.tsx` poll mỗi 3s để cập nhật badge/trạng thái/chunk count |
| Backend | D-10 · API upload multipart, enqueue, lưu File Storage  | M2  | `[x]`   | **REST documents** trong app `chat`: upload multipart (Multer, **PDF/DOCX/PPTX/XLSX/TXT**, 50MB), file lưu `data/uploads/`, metadata Mongo; sau upload `IngestQueueService` ưu tiên publish RabbitMQ trực tiếp từ platform/chat, fallback HTTP `/v1/process` nếu broker chưa sẵn sàng; list/download/delete + JWT guard + phân quyền |
| Backend | D-11 · Versioning file gốc và checksum                  | M2  | `[x]`   | `services/platform/apps/chat/src/documents/documents.service.ts` tính `sha256` file upload, sinh `documentKey`, tăng `version`, đánh dấu `isLatestVersion`, lưu `previousVersionDocId`, mirror lịch sử vào collection `document_versions`, và promote bản trước đó khi xóa bản mới nhất; DTO web-ui đã expose `file_checksum/version/is_latest_version` |
| Test    | D-12 · Regression ingest và eval OCR                    | M2  | `[x]`   | `services/document-processor/tests/` hiện có regression cho chunking, extractor PDF/DOCX/PPTX/XLSX, OCR fallback, Rabbit retry/DLQ và job validation; chạy `python -m unittest discover -s tests -p "test_*.py" -v` pass **20 tests**. Build `services/platform` và `services/web-ui` cũng pass sau thay đổi ingest/docs UI |


---

## E. RAG multi-turn, citation, safe refusal


| Loại    | Mô tả                                                 | MS  | Tiến độ | Evidence |
| ------- | ----------------------------------------------------- | --- | ------- | -------- |
| AI      | E-01 · Router ý định rag / sql / reject / task-assist | M3  | `[-]`   | `services/rag-engine/app/router.py` đã classify `rag` vs `sql` theo keyword; `services/rag-engine/main.py` route `/v1/chat` và `/v1/chat/stream` sang SQL pipeline khi phù hợp; **chưa** có nhánh `reject` / `task-assist` riêng |
| AI      | E-02 · Query embed, Milvus top-k, Mongo fetch chunk   | M3  | `[-]`   | `rag-engine/app/retrieval.py` đã embed query qua `embedding-server`, search Milvus top-k, fetch `document_chunks` từ Mongo và trả citations |
| AI      | E-03 · Access filter trước retrieval                  | M3  | `[-]`   | `rag-engine/app/access.py` enforce `securityLevel` + `scopeType` + owner/role/department/custom trước khi trả chunk; chưa có row-filter đồng bộ với Postgres policy |
| AI      | E-04 · Rerank cross-encoder và chọn context           | M3  | `[-]`   | `rerank-server` (`POST /v1/rerank`, fastembed `TextCrossEncoder`); `rag-engine/app/rerank.py` gọi rerank sau Milvus+access filter, chọn top `RERANK_TOP_K` chunk cho LLM; `rag-engine/app/citation_select.py` giới hạn `MAX_CHUNKS_PER_DOC` để tránh 1 tài liệu nuốt hết context; có `services/rag-engine/tests/test_retrieval.py`; fallback vector order khi rerank lỗi; `start-rag.ps1` khởi động `:8002` |
| AI      | E-05 · Grounding prompt và sinh đáp án có citation    | M3  | `[x]`   | Grounding + sinh đáp án trong `rag-engine/app/generate.py` (SYSTEM_PROMPT tiếng Việt, chỉ dùng tài liệu, safe refusal); parser/output contract nhận **`used_chunk_ids` + `reference_chunk_ids`**; cleanup answer chặn JSON tail / fenced block / heading `Nguồn tham khảo` / dòng `chunk_id=` bị leak; retry relaxed + retry expand khi model over-refuse hoặc trả lời quá cụt; chọn citation theo used/reference ids và fallback lexical-overlap khi model không trả id; có regression test `services/rag-engine/tests/test_generate.py` + `services/rag-engine/tests/test_main_citations.py` |
| AI      | E-06 · Multi-turn context Redis                       | M3  | `[x]`   | `services/platform/apps/chat/src/chat/chat.service.ts` nay hydrate history từ `ChatCacheService` trước khi fallback về Mongo, ghi lại `chat:session:*` sau mỗi turn và clear khi xóa session; `services/platform/apps/chat/src/rag/rag.service.ts` truyền thêm `sessionId`; `services/rag-engine/main.py` hydrate/update cùng session context cho route `rag/sql/refusal`; env `CHAT_SESSION_CONTEXT_TTL`/`CHAT_SESSION_CONTEXT_MAX_MESSAGES` đã vào cấu hình; test `services/platform/apps/chat/src/chat/chat.service.spec.ts` + `services/rag-engine/tests/test_main_citations.py` pass |
| Bảo mật | E-07 · Safe refusal và blacklist từ `admin-config`    | M3  | `[x]`   | `services/rag-engine/app/safe_refusal.py` load policy từ `admin-config` (cache TTL + fallback mặc định), normalize keyword không phân biệt hoa thường/dấu, chặn trước retrieval/SQL/chat/stream trong `services/rag-engine/main.py`; `services/platform/apps/admin-config/src/admin-config.service.ts` giữ blacklist + safe refusal có version; có test `services/rag-engine/tests/test_safe_refusal.py`, `test_main_citations.py`; smoke blocked query qua gateway trả `route=refusal` |
| Backend | E-08 · `rag-engine` Python service, health, chat API  | M3  | `[x]`   | FastAPI `rag-engine` orchestrate full RAG: `/health`, `/v1/retrieve`, **`/v1/chat`** (retrieve→grounding→LLM→`{answer, citations}`) và **`/v1/chat/stream`** (SSE meta→token→done); LLM provider ollama/openai trong `app/generate.py` + grounding prompt + safe refusal; `app/config.py` load `services/platform/.env`. `chat` app gọi `RagService.chat`/`chatStream` rồi proxy SSE, giữ session/history/title ở NestJS, fallback LLM nội bộ khi engine lỗi; citations strip `text` (chỉ dùng cho LLM, không lộ ra client) |
| Test    | E-09 · Eval RAG                                       | M3  | `[x]`   | `eval/rag_cases.json` thêm corpus câu hỏi thật cho các nhóm **citation / fallback / refusal**; `services/rag-engine/app/rag_eval.py` load case + chấm answer/citation/refusal + summary; `services/rag-engine/tests/test_rag_eval.py` chạy fixture qua flow `/v1/chat` bằng mock retrieval/LLM để verify selection/source contract end-to-end; pass `python -m unittest discover -s tests -p "test_rag_eval.py" -v` |


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
| Backend | G-01 · `api-gateway` NestJS — JWT, routing, proxy Python AI  | M5  | `[x]`   | Proxy `/api/auth`, `/api/users` → `user-management`; proxy `/api/chat`, `/api/documents` → `chat` `:3002`; **proxy `/api/rag/*` / `/api/rbac/*` / `/api/admin-config/*` / `/api/audit/*`** qua service tương ứng; protected routes verify **access JWT** ngay tại gateway, public giữ `login`/`refresh`; gateway forward `x-gateway-user-*` headers + scope headers; SSE-friendly timeouts + tắt upstream keep-alive (`http.Agent keepAlive:false`); health upstream có `userManagement` + `chat` + `rbac` + `adminConfig` + `audit` + `rag`; build pass + test `gateway-auth.spec.ts` pass (2026-06-18) |
| Backend | G-02 · `rbac` NestJS — role model, permission matrix         | M5  | `[x]`   | App `services/platform/apps/rbac/` có `/api/rbac/me`, `/matrix`, `/check`, `/row-filter`; load role + permission matrix trực tiếp từ Postgres, normalize alias role `HocVien/GV`; có test `rbac.controller.spec.ts` + `access-scope.spec.ts`; build `services/platform` pass (2026-06-18) |
| Backend | G-03 · `rbac` — inject `access_scope` cho downstream         | M5  | `[x]`   | `services/platform/src/common/access-scope.ts` resolve `normalizedRoles`, `scopeMaHv`, `scopeMaGv`; gateway attach `x-gateway-access-scope`, `x-gateway-scope-ma-hv`, `x-gateway-scope-ma-gv`; `chat` → `rag-engine` propagate scope fields cho retrieval/SQL; test `gateway-auth.spec.ts`, `access-scope.spec.ts`, `services/rag-engine/tests/test_main_citations.py` pass |
| Bảo mật | G-04 · Row-level filter (NestJS `rbac` + Postgres policy)    | M5  | `[x]`   | `rbac.service.ts` trả predicate self-scope cho `hoc_vien` / `diem` / `ket_qua_hoc_ky` / curated views và scope giảng viên; `documents` filter theo `role_category_policies`; `infra/postgres/init/19-user-scope-bindings.sql` thêm `user_scope_bindings`; `services/rag-engine/app/sql_resolve.py` + `sql_scope.py` đồng bộ resolve/inject filter cho Text-to-SQL |
| Backend | G-05 · `audit` NestJS — audit log immutable                  | M5  | `[x]`   | App `services/platform/apps/audit/` expose `/api/audit/logs`; `services/platform/apps/api-gateway/src/gateway-audit.ts` ghi audit cho request protected; `services/platform/src/common/audit-log.ts` reuse path ghi log; `infra/postgres/init/18-security-services.sql` thêm trigger chặn sửa/xóa `audit_log`; test `audit.controller.spec.ts` pass |
| Backend | G-06 · `user-management` NestJS — user, profile, đơn vị, IAM | M5  | `[x]`   | `auth/` + `user/`: login/logout/me/**refresh**; JWT + bcrypt; access JWT `15m` + refresh token `7d` qua **HttpOnly cookie**; `user_sessions` lưu hash refresh token, rotate/revoke session + `login_logs`; Docker image build OK; E2E login qua gateway (2026-06-15); role codes khớp seed; **chưa** CRUD user |
| Backend | G-07 · Rate limit và throttling theo role (gateway)          | M5  |         |          |
| Backend | G-08 · `admin-config` NestJS — CRUD prompt/policy có version | M5  | `[x]`   | App `services/platform/apps/admin-config/` có `GET/PUT /api/admin-config/rag-policy` + `GET /internal/rag-policy`; lưu `admin_configs` + `prompt_change_log`, tăng `version`, audit khi sửa policy; internal endpoint bắt buộc `ADMIN_CONFIG_INTERNAL_KEY`; test `admin-config.controller.spec.ts` pass |
| Backend | G-09 · `workflow` NestJS — luồng phê duyệt / trạng thái      | M5  |         |          |
| Backend | G-10 · `notification` NestJS — in-app, hook RabbitMQ         | M6  |         |          |
| Backend | G-12 · Chat service — session/message Mongo, LLM multi-turn | M5  | `[x]`   | App `chat` `:3002`; Mongo `chat_sessions`/`chat_messages`; CRUD session/message + auto-title; **SSE stream endpoint** (`/messages/stream`: `meta`/`token`/`done`/`error`) + non-stream; **LLM provider abstraction** (`getLlmConfig`/`streamLlm`/`callLlm`) — switch `LLM_PROVIDER` Ollama(local `qwen2.5:3b`)↔OpenAI, mặc định Ollama; đã hook `RagService` để lấy citations từ `rag-engine` và fallback stub khi engine lỗi/chưa chạy; JWT; gateway proxy `/api/chat`; build pass. **Chưa:** service trong `docker-compose`, RAG quality/rerank hoàn thiện |
| Test    | G-11 · Penetration test auth, RBAC, audit                    | M5  | `[-]`   | `scripts/smoke-app.ps1` đã cover login/logout, hidden internal route, RBAC scope, admin-only deny, safe refusal, audit read; có thêm test `gateway-auth.spec.ts`, `access-scope.spec.ts`, `rbac.controller.spec.ts`, `audit.controller.spec.ts`. **Còn thiếu** abuse/rate-limit scenario, refresh/session attack case và browser-assisted security test |


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
| UI   | K-04 · Doc workspace: upload, ingest timeline              | M6  | `[-]`   | `DocsPage.tsx` + `api/docs.ts` gọi REST thật — list/upload/xem/tải/xóa; modal upload chọn danh mục + tiêu đề + **mức mật** + **đối tượng được xem**; đã nhận **PDF/DOCX/PPTX/XLSX/TXT** ở cả frontend (`accept`, validate trước submit) và backend (`documents.storage.ts`); có badge ingest status, stage, chunk count và poll `ingest-status`; chưa có timeline chi tiết/chunk preview |
| UI   | K-05 · Self-service pages                                  | M6  |         |          |
| UI   | K-06 · Quiz và summary UI                                  | M6  |         |          |
| UI   | K-07 · Admin audit viewer và export                        | M6  | `[x]`   | `services/web-ui/src/pages/AdminPage.tsx` thêm audit viewer thật: filter theo `status/action/resource/user`, danh sách log, panel chi tiết `old_value/new_value`, export `JSON/CSV`; `services/web-ui/src/api/admin.ts` gọi `/api/audit/logs` + `/logs/:id`; `services/platform/apps/audit/src/audit.service.ts` hỗ trợ thêm filter `userId/resourceId/from/to` và nâng cap limit; Playwright `services/web-ui/tests/e2e/admin.spec.ts` pass |
| UI   | K-08 · Admin health view (gọi API gateway)                 | M6  | `[x]`   | `services/web-ui/src/pages/AdminPage.tsx` gọi `fetchGatewayHealth()` thật và render đủ 6 upstream `userManagement/chat/rbac/adminConfig/audit/rag`, summary card, trạng thái `up/down`, reload health; bỏ dashboard mock cũ cho nhánh admin health |
| UI   | K-09 · Admin AI config editor                              | M6  | `[x]`   | `AdminPage.tsx` load/save `admin-config/rag-policy`: bật/tắt safe refusal, sửa blacklist keyword, refusal message, reason cập nhật, preview metadata/version/updated-at; route guard/menu admin dùng role code normalize để hoạt động với backend thật |
| UI   | K-10 · Quota/token usage và quản lý tài khoản              | M6  |         |          |
| Test | K-11 · E2E UI và accessibility checklist                   | M6  | `[x]`   | `scripts/smoke-app.ps1` cover API smoke; `docs/accessibility-checklist.md` có checklist manual; thêm browser automation `services/web-ui/tests/e2e/admin.spec.ts` và `chat.spec.ts` cho login mock auth, admin health/config editor, chat stream/citation/session delete; verify pass `2 passed` (2026-06-18) |


---

## L. Traceability — use case chuẩn


| Loại      | Mô tả                            | MS       | Tiến độ | Evidence |
| --------- | -------------------------------- | -------- | ------- | -------- |
| Nghiệp vụ | UC-DT-01..04 — đào tạo           | M3/M4/M6 |         |          |
| Nghiệp vụ | UC-KT-01..04 — khảo thí          | M3/M4/M6 |         |          |
| Nghiệp vụ | UC-KH-01..04 — KHCN              | M2/M3/M6 |         |          |
| AI        | UC-AI-01..05 — GenAI/RAG         | M2–M4    | `[-]`   | Phase 1 **done:** chat LLM local (`qwen2.5:3b`) + history (**G-12** `[x]`, **K-12** `[x]`); Phase 2 **partial→gần xong:** ingest/OCR/chunk/embed (**D-01..D-12** `[x]`), RAG retrieve/rerank/grounding (**E-02..E-05**, **E-08** `[x]`), multi-turn Redis E2E (**E-06** `[x]`), safe refusal (**E-07** `[x]`), eval harness (**E-09** `[x]`); Text-to-SQL read-only + format UX (**F-01..F-08** `[x]`); **còn:** E-01 reject/task-assist, Milvus metadata push-down (C-03) |
| Quản trị  | UC-QT-01..04 — quản trị hệ thống | M0/M5/M6 | `[-]`   | JWT login + refresh cookie (**K-02** `[x]`, **G-06** `[x]`); admin health live + AI policy editor (**K-08** `[x]`, **K-09** `[x]`); audit viewer/export (**K-07** `[x]`); RBAC/audit backend (**G-02..G-05** `[x]`); browser automation smoke (**K-11** `[x]`); **còn:** quota/token/account ops (**K-10**), penetration/rate-limit (**G-07**, **G-11**) |


---

## M. Traceability — bao phủ use case đầu vào


| Loại      | Mô tả                   | MS  | Workstream | Tiến độ | Evidence |
| --------- | ----------------------- | --- | ---------- | ------- | -------- |
| Nghiệp vụ | Nhóm Đào tạo            | M6  | I, F       | `[-]`   | Schema + seed core (`13-seed-core.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm Khảo thí & ĐBCL    | M6  | I          | `[-]`   | Schema + seed (`14-seed-khao-thi.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm KHCN               | M6  | I, D       |         |          |
| Nghiệp vụ | Nhóm Thư viện           | M6  | I          |         |          |
| UI        | Nhóm Tự phục vụ HV/SV   | M6  | K, I       | `[-]`   | K-01 `[x]`, K-02 `[x]`, **K-12** `[x]`; K-04 docs workspace đã upload/list/download/delete + ingest status poll + hỗ trợ **PDF/DOCX/PPTX/XLSX/TXT** ở FE/BE |
| AI        | Nhóm Trợ lý ảo nâng cao | M6  | J, K       | `[-]`   | Phase 1 chat+history `[x]` (G-12, K-12); Phase 2 **gần xong:** K-03 citation/SSE + SQL table render, ingest/index pipeline (D `[x]`), RAG+SQL+safe refusal (E/F `[x]` phần lớn), admin health/policy (K-08/K-09 `[x]`), Playwright smoke (K-11 `[x]`); **chưa:** J-01..J-06 nâng cao |


### Quy tắc kiểm soát phạm vi

- Mọi use case trong phạm vi dự án phải map vào ít nhất một dòng traceability.
- Không dùng `TBD` / `làm sau` / `defer`.
- Mọi thay đổi phạm vi cập nhật đồng thời section L, M, deliverable và lộ trình milestone.
- Thay đổi topology (1 máy ↔ 2 máy): cập nhật topology, kế hoạch hạ tầng M0/M1 và workstream A–B cùng lúc.

---

## Ưu tiên tiếp theo (cập nhật 2026-06-18 — ingest/RAG/SQL/RBAC/admin bundle done; tiếp M0 bootstrap + admin ops)

### Chat Phase 1 ✅ → Phase 2 (RAG + SQL) ✅ gần xong

| # | Task | Trạng thái |
| - | ---- | ---------- |
| ~~C1~~ | ~~**G-12**~~ | `[x]` chat service + LLM local `qwen2.5:3b` (switch Ollama↔OpenAI) |
| ~~C2~~ | ~~**K-12**~~ | `[x]` UI history sidebar/route/load/send/delete |
| ~~C3~~ | ~~**K-03 UI**~~ | `[x]` SSE + markdown sanitize + citation cards group theo tài liệu/section/snippet |
| ~~C4~~ | ~~**G-01**~~ | `[x]` JWT verify gateway; proxy `rag-engine` + forward user context header |
| ~~C5~~ | ~~**E-05 / K-03**~~ | `[x]` polish citation/source formatting, tăng độ rõ cho câu trả lời nhiều điều kiện và regression test structured output |
| ~~C6~~ | ~~**E-09**~~ | `[x]` eval RAG corpus + harness citation/refusal |
| ~~C7~~ | ~~**G-02..G-05 / E-07 / K-08 / K-09 / K-11**~~ | `[x]` RBAC + audit + admin-config + safe refusal + admin UI + Playwright smoke |

**Trạng thái chat hiện tại** — Nền chat/RAG + SQL read-only + policy/RBAC an toàn đã nối end-to-end qua gateway; ingest/OCR/chunk/embed (D), multi-turn Redis (E-06) và Text-to-SQL (F) đã nghiệm thu v1. Phần còn thiếu rõ nhất: **K-10** (quota/token/account ops), **K-04** phase 2 (timeline/chunk preview), **E-01** (reject/task-assist) và **C-03** (Milvus metadata push-down).

**Lộ trình chat**

```
[K-12 UI] ──► [G-12 API + Mongo] ──► [LLM provider: Ollama/OpenAI]
                      │
                      ▼ (D + E + F v1 done)
              [E-08 rag-engine] ──► [K-03 citation/SSE/SQL table]
                      │
                      ▼ (còn K-10 admin ops, K-04 docs timeline, J advanced features)
              [K-04 docs timeline] · [J advanced features]
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

### Tiếp — RBAC + eval + UI ops (M5/M6)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| ~~7~~ | ~~**G-01**~~ | `[x]` JWT verify gateway; proxy `rag-engine` |
| 8 | **G-12** (ops) | Thêm `chat` vào `docker-compose` profile `code` |
| ~~9~~ | ~~**G-02..G-05**~~ | `[x]` RBAC service, `access_scope`, row filter, audit log |
| 10 | **K-04** | Doc workspace Phase 2: timeline chi tiết, chunk preview, UX ingest tốt hơn |
| ~~11~~ | ~~**K-07**~~ | `[x]` Admin audit viewer + export đã nối audit read API vào UI |
| 12 | **G-06** (mở rộng) | CRUD user, profile, đơn vị; flow refresh token đã xong |
| ~~13~~ | ~~**E-09**~~ | `[x]` Eval RAG: corpus `eval/rag_cases.json` + helper `app/rag_eval.py` + test fixture end-to-end cho citation/refusal |
| ~~14~~ | ~~**K-11**~~ | `[x]` Playwright `admin.spec.ts` + `chat.spec.ts` + `docs/accessibility-checklist.md` |
| 15 | **K-10** | Quota/token usage và quản lý tài khoản cho dashboard admin |

### Sau — AI pipeline + nâng cao (M1–M6)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 16 | **B-01..B-07** | Ollama Qwen2.5-3B production profile `ai`, embedding BGE-M3, rerank production model |
| ~~17~~ | ~~**D-01..D-12**~~ | `[x]` ingest pipeline: OCR, chunk, embed, Milvus, versioning, regression tests |
| 18 | **E-01 / C-03** | Router reject/task-assist, Milvus metadata push-down |
| 19 | **K-10 / G-07 / G-11** | Quota ops, rate limit, penetration hardening |

### Đã xong gần đây

- **H-06 + E-06 + K-07 hoàn tất** (2026-06-19) — `etl-sync` nay transform/validate/load thật xuống Postgres + Mongo với lineage/error rõ ràng; chat service hydrate history từ Redis trước khi fallback Mongo và `rag-engine` đồng bộ cùng `sessionId`/context; AdminPage có audit viewer thật, panel chi tiết và export JSON/CSV; test `services/etl-sync/tests/test_etl_sync.py`, `services/platform/apps/chat/src/chat/chat.service.spec.ts`, `services/platform/apps/audit/src/audit.service.spec.ts`, `services/rag-engine/tests/test_main_citations.py`, Playwright `admin.spec.ts`, build `services/platform` + `services/web-ui` đều pass |

