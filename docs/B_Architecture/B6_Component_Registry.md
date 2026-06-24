# B6 — Component Registry

## 1. Mục đích

- Tạo một bảng tra cứu nhanh cho từng component trong hệ thống.
- Giúp dev, reviewer và AI/code assistant biết component nào nhận gì, trả gì, phụ thuộc gì và đụng vào kho dữ liệu nào.
- Không thay thế tài liệu chi tiết hơn như `B2`, `B3`, `B4`; file này là lớp định vị nhanh cấp component.

## 2. Bảng component

| Status | Component | Repo path | Main responsibility | Input | Output | Dependencies | Storage/data touched | Test/smoke evidence |
|--------|-----------|-----------|---------------------|-------|--------|--------------|----------------------|---------------------|
| `partial` | `web-ui` | `services/web-ui/` | Giao diện login, chat, docs, admin, settings | User action; gateway API; SSE | UI render; request API; stream event handling | `api-gateway`; browser runtime | Trạng thái trình duyệt; access token runtime phía client; refresh cookie do backend quản lý | `npm run build`; `services/web-ui/tests/e2e/admin.spec.ts`; `chat.spec.ts` |
| `implemented` | `api-gateway` | `services/platform/apps/api-gateway/` | Điểm vào chính cho client; verify JWT; proxy route; chuẩn hóa entrypoint | HTTP từ web-ui/client; access token; request context | HTTP tới service nội bộ; health; lỗi chuẩn hóa | `user-management`; `chat`; `rbac`; `audit`; `admin-config`; `rag-engine` | Không là source of truth dữ liệu lâu dài; ghi audit qua service chung | `scripts/smoke-app.ps1`; health gateway trong `health.ps1` |
| `partial` | `user-management` | `services/platform/apps/user-management/` | Login, refresh, logout, `/me`, session revoke; phần CRUD user còn thiếu | Username/password; refresh cookie; JWT request | Access token; refresh cookie; profile | Postgres; gateway; auth helpers | Postgres `users`, `user_sessions`, `login_logs` | E2E login qua gateway; `docs/task list.md` G-06 evidence |
| `implemented` | `chat` | `services/platform/apps/chat/` | CRUD session/message; SSE; bridge sang RAG; upload docs | User message; `sessionId`; file upload; JWT context | Chat answer; citation payload; document metadata; ingest request | MongoDB; Redis; `rag-engine`; RabbitMQ; Ollama/openai-compatible API; gateway | **MongoDB là source of truth cho `chat_sessions` và `chat_messages`**; Redis cache/context; file upload local | `services/platform/apps/chat/src/chat/chat.service.spec.ts`; `scripts/smoke-app.ps1`; `chat.spec.ts` |
| `implemented` | `rbac` | `services/platform/apps/rbac/` | Tính scope, permission matrix, row-filter cho downstream | User identity; role codes; resource check | Scope hiện hành; check quyền; predicate/filter | Postgres; gateway | Postgres role/permission matrix; `user_scope_bindings` | `rbac.controller.spec.ts`; `access-scope.spec.ts`; smoke `/api/rbac/me` |
| `partial` | `audit` | `services/platform/apps/audit/` | Health + đọc audit log list/detail cho admin; `web-ui` đã có panel filter/detail/export client-side trong `/admin`, nhưng backend vẫn chưa có export route riêng | Filter query; admin request | Audit health/list/detail data | Postgres; gateway | Postgres `audit_log` và bảng liên quan | `services/platform/apps/audit/src/audit.service.spec.ts`; Playwright `services/web-ui/tests/e2e/admin.spec.ts` |
| `implemented` | `admin-config` | `services/platform/apps/admin-config/` | Lưu/version hóa policy AI và endpoint nội bộ cho `rag-engine` | Admin update; internal fetch key | Policy hiện hành; version metadata | Postgres; helper audit log; `rag-engine` | Postgres `admin_configs`, `prompt_change_log` | `admin-config.controller.spec.ts`; Playwright `admin.spec.ts` |
| `stub` | `workflow` | `services/platform/apps/workflow/` | Scaffold module cho workflow; hiện mới ở mức placeholder | HTTP vào controller scaffold | Placeholder response | NestJS app scaffold | Chưa có storage nghiệp vụ được tài liệu hóa như source of truth | Controller/service scaffold hiện có; chưa có smoke nghiệp vụ riêng |
| `stub` | `notification` | `services/platform/apps/notification/` | Scaffold module cho notification; hiện mới ở mức placeholder | HTTP vào controller scaffold | Placeholder response | NestJS app scaffold | Chưa có storage nghiệp vụ được tài liệu hóa như source of truth | Controller/service scaffold hiện có; chưa có smoke nghiệp vụ riêng |
| `stub` | `platform app scaffold` | `services/platform/apps/platform/` | App scaffold/demo gốc của monorepo | HTTP tới `/health`, `/chat` mock | Health và mock response | NestJS app scaffold | Không phải source of truth nghiệp vụ chính | `app.controller.spec.ts` trong scaffold |
| `partial` | `rag-engine` | `services/rag-engine/` | Route `rag/sql/reject/task_assist/refusal`; retrieval; rerank; grounding; SQL guard; session context | Chat question; user scope; policy; sessionId | Answer; citations; SQL result; refusal response | `embedding-server`; `rerank-server`; Ollama; MongoDB; Milvus; Redis; Postgres RO; `admin-config` | MongoDB chunk/document metadata; Milvus vector; Redis retrieval/context cache; Postgres readonly/query audit path | `services/rag-engine/tests/test_main_citations.py`; `test_sql_format.py`; `test_retrieval.py`; `test_safe_refusal.py` |
| `partial` | `document-processor` | `services/document-processor/` | Extract/OCR; chunk; embed; index; cập nhật ingest state | Ingest job; file path; metadata | Chunks; vectors; ingest status; retry/DLQ behavior | RabbitMQ; `embedding-server`; MongoDB; Milvus; file storage | MongoDB `processing_jobs` và chunk metadata; Milvus vectors; file uploads local | `services/document-processor/tests/test_consumer.py`; `test_extract.py`; `test_pipeline_validation.py` |
| `partial` | `embedding-server` | `services/embedding-server/` | Cung cấp embedding HTTP cho query/chunk | Text list; embedding request | Vector embedding | Model runtime; `rag-engine`; `document-processor` | Không giữ source of truth nghiệp vụ; xử lý vector tạm thời | `start-rag.ps1` smoke; evidence B-02 trong `docs/task list.md` |
| `partial` | `rerank-server` | `services/rerank-server/` | Cung cấp rerank HTTP cho retrieval | Query + candidate chunks | Danh sách scored candidates | `rag-engine`; model runtime | Không giữ source of truth nghiệp vụ | `start-rag.ps1` smoke; `services/rag-engine/tests/test_retrieval.py` |
| `partial` | `etl-sync` | `services/etl-sync/` | Quản lý source/job/run; connector; scheduler; transform/load; lineage | ETL source config; schedule; batch data | Run status; load summary; lineage; error logs | Postgres; MongoDB; connector nguồn; scheduler | Postgres `etl_sources`, `etl_jobs`, `etl_runs`, `etl_lineage`, `etl_error_logs`; MongoDB target collections khi mapping yêu cầu | `services/etl-sync/tests/test_etl_sync.py`; `start-rag.ps1` bật `:8004` |
| `implemented` | `Postgres` | `infra/postgres/init/` | Nguồn chuẩn cho IAM, auth session, audit, ETL metadata, curated SQL | SQL migration; app queries; ETL load | Bản ghi quan hệ; readonly views; audit | `user-management`; `rbac`; `audit`; `admin-config`; `etl-sync`; `rag-engine` | `users`, `user_sessions`, `audit_log`, `admin_configs`, `etl_*`, `sql_curated` | Init scripts `02-iam.sql`, `15-auth-refresh-sessions.sql`, `17-text-to-sql-readonly.sql`; smoke auth |
| `implemented` | `MongoDB` | `infra/mongodb/init/` | Nguồn chuẩn cho catalog tài liệu, chunk metadata, processing job và chat history | Document metadata; chat session/message; ingest updates | Catalog, chunk metadata, chat sessions/messages | `chat`; `document-processor`; `rag-engine`; `etl-sync` | `documents`, `document_versions`, `processing_jobs`, `document_chunks`, `chat_sessions`, `chat_messages` | `infra/mongodb/init/01-schema.js`; README chat requirement; G-12 evidence |
| `partial` | `Milvus` | `services/document-processor/app/milvus_store.py`; `services/rag-engine/app/milvus_search.py` | Vector index cho child chunk retrieval, có nhận expr `document_id in [...]` từ ACL Mongo để push-down access filter | Embedded child chunks; query vector | Top-k vector matches | `document-processor`; `rag-engine`; Mongo metadata filter | Collection `document_chunks`; vector metadata tối thiểu (`chunk_id`, `document_id`, `security_rank`) | `docs/task list.md` C-03 evidence; retrieval tests ở `rag-engine` |
| `partial` | `Redis` | `services/platform/src/common/redis/`; `services/rag-engine/app/cache.py` | Cache session/context và retrieval cache | SessionId; message history; retrieval key | Cached context; TTL state | `chat`; `rag-engine` | Redis keys cho `chat:session:*`, retrieval cache, session context | `chat.service.spec.ts`; E-06 evidence trong `docs/task list.md` |
| `implemented` | `RabbitMQ` | `docker-compose.yml`; `services/platform/apps/chat/src/ingest/`; `services/document-processor/app/consumer.py` | Queue ingest, retry, DLQ | Ingest publish request | Queue message; retry; dead-letter | `chat`; `document-processor` | Queue ingest và DLQ; không là source of truth nghiệp vụ | `test_consumer.py`; ingest queue logs; `start-rag.ps1` |
| `partial` | `Ollama` | `services/llm-server/` (placeholder); runtime qua `LLM_BASE_URL` | Serving LLM OpenAI-compatible cho chat/RAG/SQL dev | Prompt; chat/sql generation request | Generated text/stream | `chat`; `rag-engine`; local model runtime | Model artifact ngoài source code; không là source of truth nghiệp vụ | README local runbook; B-01/B-03/F-03 evidence trong `docs/task list.md` |

## 3. Rules for AI/code assistant

- Đọc `docs/INDEX.md` trước để biết bộ tài liệu nào là source of truth.
- Khi đụng một component, đọc thêm `B2`, `B3`, `B4` và hàng tương ứng trong file này trước khi đề xuất sửa code.
- Không tự đổi kho lưu trữ của component nếu docs hiện tại đã chốt. Ví dụ: chat history hiện bám MongoDB; Redis chỉ là cache.
- Nếu thấy docs và code mâu thuẫn mà chưa có quyết định rõ, ghi `Needs decision` vào tài liệu liên quan và tham chiếu `G3_Decision_Memory.md`, không âm thầm chọn một hướng mới.
- Mọi đề xuất AI bị user/team chỉnh hướng trước khi chốt phải tạo một file dưới `G4_Check_Tren/`.
- Khi một component đang ở `partial`, `stub` hoặc `planned`, không được mô tả nó như một capability đã hoàn thiện.

## 4. Common mistakes to avoid

- Nhầm `Redis` là source of truth của chat thay vì cache/context.
- Nhầm `Milvus` là kho metadata tài liệu; metadata chuẩn đang ở MongoDB.
- Ghi thẳng route nghiệp vụ vào `api-gateway` thay vì để service domain xử lý.
- Xem `Ollama` hay `embedding-server` như nơi lưu dữ liệu nghiệp vụ.
- Đổi contract API mà không cập nhật `B3`.
- Đổi flow AI/refusal/SQL/ingest mà không cập nhật `B4`.
- Xem `workflow` hoặc `notification` như module đã xong, trong khi hiện mới là scaffold/stub.

## 5. Checklist cập nhật tài liệu khi component đổi

- API change -> cập nhật `B3_API_Contracts.md`
- Data/storage change -> cập nhật `B2_Data_Architecture.md`
- AI/RAG/ingest/SQL/refusal change -> cập nhật `B4_AI_Pipeline_Design.md`
- Deployment/env change -> cập nhật `D1_Deployment_Architecture.md`, `D2_Environment_Config.md`, `D4_Local_Dev_Runbook.md`
- UI flow change -> cập nhật `C1_Screen_Inventory.md`
- Architectural decision -> cập nhật `G3_Decision_Memory.md`
- AI steering/change trace -> tạo file mới trong `G4_Check_Tren/`
