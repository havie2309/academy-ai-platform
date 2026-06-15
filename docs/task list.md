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
| Hạ tầng  | A-01 · Khởi tạo repo, README, `.gitignore`, cấu trúc NestJS + Python + Ollama    | M0  | `[x]`   | `README.md`, `.gitignore`, `docs/`, `libs/`, `services/platform/`, 4 Python services, `web-ui/`, `llm-server/` placeholder, `data/`, `eval/` |
| Hạ tầng  | A-01b · NestJS monorepo `services/platform/` — gateway + modules scaffold        | M0  | `[x]`   | `nest-cli.json` + **9 apps** (thêm `chat`); `npm run build` pass (2026-06-15) |
| Hạ tầng  | A-01c · Python service template (`rag-engine`, workers) + shared `libs/`         | M0  | `[x]`   | 4 FastAPI template (`main.py` `/health`, `Dockerfile`, `requirements.txt`); `services/platform/libs/` — `ai-clients`, `schemas`, `prompts`, `policies` (Python stubs); repo `libs/` vẫn `.gitkeep` |
| Hạ tầng  | A-02 · `docker-compose.yml` + profile `code` (Máy nền tảng) kèm healthcheck      | M0  | `[-]`   | profile `code`, 7 data services + `user-management` (3001); Postgres **5433**; Mongo mount init; `user-management` **Dockerfile build OK** (Node 22); **chưa** verify `up-code.ps1` full stack với container `user-management` |
| Hạ tầng  | A-03 · `.env.example` Máy nền tảng: DB, MQ, `LLM_BASE_URL`, `EMBEDDING_BASE_URL` | M0  | `[x]`   | DB/MQ/Redis/Milvus + `LLM_*`, `EMBEDDING_*`, `RERANK_*`; `JWT_*`, `CHAT_*`, `OPENAI_*` (server-only); `services/platform/.env.example` |
| Hạ tầng  | A-04 · Logging JSON và correlation ID middleware (shared lib)                    | M0  | `[x]`   | `src/common/logger.middleware.ts` + `common.module.ts`; `CommonModule` import vào 8 Nest apps; `npm run build` pass |
| Hạ tầng  | A-05 · Scripts: `up-code`, `up-ai`, `down`, `logs`, `health`                     | M0  | `[-]`   | `scripts/up-code.ps1`, `down.ps1`, `logs.ps1`, `health.ps1`, **`seed-iam.ps1`** (docker cp UTF-8); thiếu `up-ai.ps1` |
| Tài liệu | A-06 · Quickstart 2 máy (README): Máy nền tảng + hướng dẫn Máy mô hình           | M0  | `[-]`   | `README.md` quickstart 1 máy + scripts; topology 2 máy ghi chú ngắn; thiếu hướng dẫn chi tiết Máy mô hình |
| Test     | A-07 · Smoke test profile `code` — bootstrap Máy nền tảng end-to-end             | M0  | `[-]`   | Dev smoke **pass** (2026-06-15): Postgres + gateway `:3000` health **ok** + user-management `:3001` + login `admin/123456` qua gateway; PR **#9 merged**; chưa script tự động |
| Hạ tầng  | A-08 · Profile `ai` (Máy mô hình): compose services AI, `.env.ai.example`        | M1  |         |          |
| Test     | A-09 · Smoke test cross-host: Máy nền tảng → Máy mô hình (embed + chat)          | M1  |         |          |


---

## B. LLM / Embedding / Rerank services


| Loại    | Mô tả                                                                          | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------------------------------ | --- | ------- | -------- |
| AI      | B-01 · `llm-server` **Ollama** — Qwen3-8B, chat completions, models, streaming | M1  |         |          |
| AI      | B-02 · `embedding-server` Python — BGE-M3, embeddings 1024 chiều               | M1  |         |          |
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
| Dữ liệu | C-03 · Milvus collection và metadata filter                     | M0  |         |          |
| Dữ liệu | C-04 · Redis session, cache, connection pool                    | M0  |         |          |
| Dữ liệu | C-05 · RabbitMQ exchange/queue ingest và DLQ                    | M0  |         |          |
| Dữ liệu | C-06 · Seed dữ liệu nghiệp vụ mẫu và user đa role               | M0  | `[-]`   | IAM **done**: `12-seed-iam.sql` bcrypt + `generate_seed.py` synced (PR #9); `seed-iam.ps1`; users admin/gv001/hv001/p2; **chưa** validate full re-run generator → 11–14 |
| Dữ liệu | C-07 · Bộ tài liệu mẫu `data/sample-docs/` đa định dạng         | M0  |         |          |
| Bảo mật | C-08 · User `pm2_readonly` cho Text-to-SQL                      | M4  |         |          |
| Test    | C-09 · Test health và connectivity data platform                | M0  |         |          |


---

## D. Document ingest, OCR, chunking, vector hóa


| Loại    | Mô tả                                                   | MS  | Tiến độ | Evidence |
| ------- | ------------------------------------------------------- | --- | ------- | -------- |
| Dữ liệu | D-01 · Metadata chuẩn và validation `doc_access_policy` | M2  |         |          |
| Backend | D-02 · Worker RabbitMQ: consume, ack, retry, DLQ        | M2  |         |          |
| AI      | D-03 · Adapter PyMuPDF — PDF text-native                | M2  |         |          |
| AI      | D-04 · Adapter MinerU + PaddleOCR — PDF scan/ảnh        | M2  |         |          |
| AI      | D-05 · Adapter DOCX, PPTX, XLSX                         | M2  |         |          |
| AI      | D-06 · Hybrid chunking, overlap, giữ cấu trúc           | M2  |         |          |
| AI      | D-07 · Prefix ngữ cảnh trước khi embed                  | M2  |         |          |
| AI      | D-08 · Batch embed, upsert Milvus, sync catalog MongoDB | M2  |         |          |
| Backend | D-09 · Pipeline status machine và API poll status       | M2  |         |          |
| Backend | D-10 · API upload multipart, enqueue, lưu File Storage  | M2  |         |          |
| Backend | D-11 · Versioning file gốc và checksum                  | M2  |         |          |
| Test    | D-12 · Regression ingest và eval OCR                    | M2  |         |          |


---

## E. RAG multi-turn, citation, safe refusal


| Loại    | Mô tả                                                 | MS  | Tiến độ | Evidence |
| ------- | ----------------------------------------------------- | --- | ------- | -------- |
| AI      | E-01 · Router ý định rag / sql / reject / task-assist | M3  |         |          |
| AI      | E-02 · Query embed, Milvus top-k, Mongo fetch chunk   | M3  |         |          |
| AI      | E-03 · Access filter trước retrieval                  | M3  |         |          |
| AI      | E-04 · Rerank cross-encoder và chọn context           | M3  |         |          |
| AI      | E-05 · Grounding prompt và sinh đáp án có citation    | M3  |         |          |
| AI      | E-06 · Multi-turn context Redis                       | M3  |         |          |
| Bảo mật | E-07 · Safe refusal và blacklist từ `admin-config`    | M3  |         |          |
| Backend | E-08 · `rag-engine` Python service, health, chat API  | M3  | `[ ]`   | **Phase 2 chat:** thay OpenAI trong G-12; contract `session_id` + citation (`docs/memory.md`); phụ thuộc D + B |
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
| Backend | G-01 · `api-gateway` NestJS — JWT, routing, proxy Python AI  | M5  | `[-]`   | Proxy `/api/auth`, `/api/users` → `user-management`; proxy `/api/chat` → `chat` `:3002`; health upstream user-management + chat; login E2E pass (2026-06-15); PR **#9**; **chưa** JWT verify gateway, proxy RAG/Python |
| Backend | G-02 · `rbac` NestJS — role model, permission matrix         | M5  |         |          |
| Backend | G-03 · `rbac` — inject `access_scope` cho downstream         | M5  |         |          |
| Bảo mật | G-04 · Row-level filter (NestJS `rbac` + Postgres policy)    | M5  |         |          |
| Backend | G-05 · `audit` NestJS — audit log immutable                  | M5  |         |          |
| Backend | G-06 · `user-management` NestJS — user, profile, đơn vị, IAM | M5  | `[x]`   | `auth/` + `user/`: login/logout/me; JWT + bcrypt; sessions + login_logs; Docker image build OK; E2E login qua gateway (PR **#9**, 2026-06-15); role codes khớp seed; **chưa** CRUD user |
| Backend | G-07 · Rate limit và throttling theo role (gateway)          | M5  |         |          |
| Backend | G-08 · `admin-config` NestJS — CRUD prompt/policy có version | M5  |         |          |
| Backend | G-09 · `workflow` NestJS — luồng phê duyệt / trạng thái      | M5  |         |          |
| Backend | G-10 · `notification` NestJS — in-app, hook RabbitMQ         | M6  |         |          |
| Backend | G-12 · Chat service — session/message Mongo, OpenAI multi-turn | M5  | `[x]`   | App `chat` `:3002`; Mongo `chat_sessions`/`chat_messages`; CRUD session/message + auto-title; `OPENAI_API_KEY` server-only (`chat.service.ts`); JWT; gateway proxy `/api/chat`; `npm run build chat` pass (2026-06-15). **Chưa:** service trong `docker-compose`, swap RAG (E-08) |
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
| UI   | K-12 · Chat history — session list, resume, persist        | M6  | `[x]`   | `ChatSessionContext` + `Sidebar` list/delete; `/chat/:sessionId`; `ChatPage` load/send; auto-title qua G-12 + `refreshSessions`; bỏ ephemeral state + proxy OpenAI client; `npm run build` web-ui pass (2026-06-15). **Chưa:** smoke/E2E tự động (K-11) |
| UI   | K-03 · Chat page: SSE streaming, markdown, citation RAG    | M6  | `[ ]`   | **Sau E-08:** SSE, markdown, citation RAG; hiện plain text qua OpenAI tạm (G-12) |
| UI   | K-04 · Doc workspace: upload, ingest timeline              | M6  | `[-]`   | `DocsPage.tsx` — mock list, search/filter, stats; nút Upload disabled; **chưa** backend ingest |
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
| AI        | UC-AI-01..05 — GenAI/RAG         | M2–M4    | `[-]`   | Phase 1 **done:** chat OpenAI + history (**G-12** `[x]`, **K-12** `[x]`); Phase 2: RAG (E-08, K-03) |
| Quản trị  | UC-QT-01..04 — quản trị hệ thống | M0/M5/M6 | `[-]`   | JWT login + admin dashboard prototype (K-02 `[x]`, K-08 `[-]`, G-06 `[x]`); PR #9 merged |


---

## M. Traceability — bao phủ use case đầu vào


| Loại      | Mô tả                   | MS  | Workstream | Tiến độ | Evidence |
| --------- | ----------------------- | --- | ---------- | ------- | -------- |
| Nghiệp vụ | Nhóm Đào tạo            | M6  | I, F       | `[-]`   | Schema + seed core (`13-seed-core.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm Khảo thí & ĐBCL    | M6  | I          | `[-]`   | Schema + seed (`14-seed-khao-thi.sql`); chưa API/UI |
| Nghiệp vụ | Nhóm KHCN               | M6  | I, D       |         |          |
| Nghiệp vụ | Nhóm Thư viện           | M6  | I          |         |          |
| UI        | Nhóm Tự phục vụ HV/SV   | M6  | K, I       | `[-]`   | K-01 `[x]`, K-02 `[x]`, **K-12** `[x]`; K-04 docs prototype |
| AI        | Nhóm Trợ lý ảo nâng cao | M6  | J, K       | `[-]`   | Phase 1 chat+history `[x]` (G-12, K-12); K-03/E RAG sau ingest |


### Quy tắc kiểm soát phạm vi

- Mọi use case trong phạm vi dự án phải map vào ít nhất một dòng traceability.
- Không dùng `TBD` / `làm sau` / `defer`.
- Mọi thay đổi phạm vi cập nhật đồng thời section L, M, deliverable và lộ trình milestone.
- Thay đổi topology (1 máy ↔ 2 máy): cập nhật topology, kế hoạch hạ tầng M0/M1 và workstream A–B cùng lúc.

---

## Ưu tiên tiếp theo (cập nhật 2026-06-15 — G-12/K-12 done)

### Chat Phase 1 ✅ → Phase 2 (RAG)

| # | Task | Trạng thái |
| - | ---- | ---------- |
| ~~C1~~ | ~~**G-12**~~ | `[x]` chat service + OpenAI server-side |
| ~~C2~~ | ~~**K-12**~~ | `[x]` UI history sidebar/route/load/send/delete |
| **C3** | **G-01** | JWT verify gateway; proxy `rag-engine` sau |
| **Sau** | **K-03 + E-08** | Ingest/RAG → citation + SSE |

**Lộ trình chat**

```
[K-12 UI] ──► [G-12 API + Mongo] ──► OpenAI (key tạm)
                      │
                      ▼ (sau D + E ingest/RAG)
              [E-08 rag-engine] ──► [K-03 citation/SSE]
```

### Ngay — đóng M0 bootstrap

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 1 | **A-02** | Verify `.\scripts\up-code.ps1` full stack — `user-management` container + Postgres |
| 2 | **A-07** | Script smoke tự động: health gateway, login, `GET /users/me` |
| 3 | **A-05** | Bổ sung `up-ai.ps1`; hoàn thiện `health.ps1` |
| 4 | **A-06** | README quickstart 2 máy (Máy nền tảng + Máy mô hình) |
| 5 | **C-09** | Test connectivity: Mongo, Redis, RabbitMQ, Milvus |
| 6 | **C-06** | Chạy thử `generate_seed.py` → validate output 11–14 không regress IAM |

### Tiếp — gateway + UI polish (M5/M6)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 7 | **G-01** | JWT verify gateway; proxy `rag-engine` |
| 8 | **G-12** (ops) | Thêm `chat` vào `docker-compose` profile `code` |
| 9 | **G-02..G-05** | RBAC service, `access_scope`, row filter, audit log |
| 10 | **K-04** | Doc upload + ingest timeline (nối D-10) |
| 11 | **K-08** | Admin health — bỏ mock stats, hiển thị services thật |
| 12 | **G-06** (mở rộng) | CRUD user, profile, đơn vị |
| 13 | **K-03** | RAG chat (SSE, markdown, citation) — **sau** ingest + E-08 |
| 14 | **K-11** | E2E UI smoke (login → chat history → send message) |

### Sau — AI pipeline (M1–M3)

| # | Task | Mô tả ngắn |
| - | ---- | ---------- |
| 15 | **B-01..B-07** | Ollama Qwen3-8B, embedding BGE-M3, rerank, profile `ai` |
| 16 | **D-01..D-12** | Ingest pipeline: OCR, chunk, embed, Milvus |
| 17 | **E-01..E-09** | RAG multi-turn, citation, safe refusal → thay OpenAI trong G-12 |
| 18 | **F-01..F-08** | Text-to-SQL read-only |

### Đã xong gần đây

- **G-12** `[x]`, **K-12** `[x]` — chat history Phase 1: Mongo sessions/messages, OpenAI server-only, UI sidebar/route/persist (2026-06-15)
- PR **#9 merged** — JWT auth, gateway proxy, web-ui, IAM seed bcrypt
- **G-06** `[x]`, **K-02** `[x]` — login E2E qua gateway
- Dev stack: Postgres `:5433` + gateway `:3000` + user-management `:3001` + chat `:3002` + web-ui `:5173`
