# G2 - Task Progress Map

## 1. Muc dich

- Tom tat nhanh cai gi da xong, cai gi moi lam mot phan va cai gi nen lam tiep.
- Day la lop doc nhanh; backlog day du van o [../task list.md](<../task list.md>).

## 2. Da hoan thanh dang ke

| Nhom | Noi dung |
|------|----------|
| Auth | Login, refresh cookie flow, logout, seed IAM, hash + salt + iterations |
| Chat | Session history, SSE, markdown, citation UI, RAG bridge, **real token streaming, persistent streaming messages, polling fallback** |
| Documents | Upload, metadata validation, versioning, ingest status poll, **scope edit sau upload (K-15)**, **upload level restriction theo role (D-14)** |
| AI | Grounding, access filter truoc retrieval, rerank/context budget, safe refusal, eval harness, SQL format/safety nen, **real token streaming, persistent streaming messages, refusal message replacement** |
| Admin | Health view, policy editor, quota/token ops, account management, audit viewer/export, gateway hardening regression, **chat monitoring (K-13)**, security alerts dashboard (K-18) |
| ETL | Source/job/run schema, scheduler, transform/load, lineage/error log |
| Sample docs | Topic-aligned adversarial triples (2 normal + 1 adversarial per topic); richer corpus with exam papers, answer keys, question banks, revision outlines, announcements, guidelines, meeting minutes. (`generate_sample_docs.py`) |
| SQL schema | Extended `login_logs` event types; added `reason` column to `policy_events`; updated `v_diem_mon` view with `ma_lop`. |
| Guardrail policy | Switched default to **semantic** (threshold 0.88) with absolute keyword fallback (e.g., "mật khẩu hệ thống"). |
| DML rejection | Added DML detection and dedicated `dml_denied` route with a clear refusal message. |
| Retrieval | Added security boost for internal/restricted docs; hard rerank threshold (`RERANK_KEEP_MIN_SCORE`); tracking of `max_score`. |
| UI | Admin users now see rerank scores in citation cards (normalized and sorted). |
| Dev tools | Added `rag-cli.py` – interactive CLI tester with `--debug` flag; improved `start-dev.ps1` (Ollama logging) and `stop-dev.ps1` (kill by port). |
| Audit/security | Normalized `'anonymous'` user ID to `null` in `audit_log` and `security_alerts` to avoid FK violations. |
| AI | J-01: Tóm tắt tài liệu (parent chunks + cache MongoDB + sinh ngầm + streaming) |
| AI | J-03: Sinh quiz và giải thích đáp án (Phase 1: generate + display + export; Phase 2: interactive quiz taking/grading pending) |
| UI | DocsPage UX overhaul: removed ingest timeline, added collapsible metadata, consolidated secondary actions into dropdown menu. |
| UI | Added shared document preview modal with mammoth DOCX rendering, PDF iframe, and TXT preview. |
| UI | CitationList now clickable – opens document preview modal from chat. |
| UI | Chunk preview modal now highlights overlapping text between adjacent chunks with soft amber background. |
| Backend | rag-engine now returns `original_name` and `mime_type` in citation responses for frontend file type detection. |
| UI/UX | Document preview now supports two modes: original file preview (DocsPage) and markdown chunk preview (ChatPage citations). Clicking a citation highlights the exact parent chunk with amber background. |
| Backend | `GET /api/documents/:id/chunks` now supports `chunkType` parameter (`child`/`parent`) and increased limit to 1000. |

## 3. Hoan thanh mot phan

| Nhom | Phan da co | Phan con thieu |
|------|------------|----------------|
| Bootstrap M0 | compose, smoke, scripts, seed, data-service connectivity va user-management bootstrap da verify | `generate_seed.py` re-run, `up-ai.ps1`, quickstart 2 may |
| AI profile M1 | Ollama + embedding/rerank dev path | profile `ai` 2 may hoan chinh |
| Parent-child RAG | chunking/retrieval flow moi da co section-path on dinh, prefix embed, re-ingest cleanup, router `reject/task_assist`, gateway `normalizedRoles`, ACL push-down theo role/department truoc Milvus va metadata-rich rerank + context budget; regression test pass 2026-06-24 (`test_chunker`, `test_pipeline_parent_child`, `test_retrieval`, `test_main_citations`, `test_sql`, `test_rerank`) | live full-stack smoke voi Milvus that |
| Admin hardening | health, policy, quota/token usage, account status/session management, audit panel/detail/export trong `/admin`; admin API helper + Playwright coverage; gateway role-based rate-limit, refresh-cookie hardening va admin-route guard regression da verify 2026-06-24; chat monitoring tab (K-13); scope management docs (K-15, D-14) | production hardening polish; admin log viewer (K-14) chua co |
| ETL integration | SQL Server connector co API | smoke nguon that, UI ETL |
| Self-service | co khung web-ui | chua co module nghiep vu day du |
| Chat streaming & persistence | Real token streaming, persistent streaming messages (`status` field), polling fallback, immediate loading feedback, citation retention on refusal | Live stream resumption after full page reload (accepted trade-off – polling provides good fallback) |
| AI profile M1 | Đã có script `start-remote-ai.ps1` và cập nhật `rag_cli.py` để hỗ trợ remote AI endpoints (LLM, embedding, rerank) qua biến môi trường. Thêm `RERANK_SCORE_FIELD` để linh hoạt với nhiều loại rerank server. | Profile `ai` trong docker-compose và smoke test chính thức cho topology 2 máy (A-08, A-09) vẫn đang ở trạng thái `planned`. |

## 4. Uu tien tiep theo nen lam

1. Dong cac viec M0 con ho: re-run `generate_seed.py`, bo sung `up-ai.ps1`, hoan thien quickstart 2 may.
2. **K-14** Admin Log Viewer: xem service logs (rag-engine, document-processor, etl-sync) tu dashboard.
3. **K-16** Hoan tat pagination va list limit trong admin dashboard.
4. Hoan thien profile `ai` va smoke 2 may de tranh mac ket o local-only.
5. Mo rong smoke/eval RAG tren data that sau khi core ACL + rerank/context da khép kín.

## 5. Quy tac cap nhat

- Khi pull code moi co thay doi hanh vi dang ke, cap nhat bang "Hoan thanh mot phan" truoc.
- Khi mot task chuyen tu partial sang done, dong bo lai ca file nay va `task list.md`.
