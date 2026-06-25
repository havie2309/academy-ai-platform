# G2 - Task Progress Map

## 1. Muc dich

- Tom tat nhanh cai gi da xong, cai gi moi lam mot phan va cai gi nen lam tiep.
- Day la lop doc nhanh; backlog day du van o [../task list.md](<../task list.md>).

## 2. Da hoan thanh dang ke

| Nhom | Noi dung |
|------|----------|
| Auth | Login, refresh cookie flow, logout, seed IAM, hash + salt + iterations |
| Chat | Session history, SSE, markdown, citation UI, RAG bridge |
| Documents | Upload, metadata validation, versioning, ingest status poll |
| AI | Grounding, access filter truoc retrieval, rerank/context budget, safe refusal, eval harness, SQL format/safety nen |
| Admin | Health view, policy editor, quota/token ops, account management, audit viewer/export, gateway hardening regression |
| ETL | Source/job/run schema, scheduler, transform/load, lineage/error log |

## 3. Hoan thanh mot phan

| Nhom | Phan da co | Phan con thieu |
|------|------------|----------------|
| Bootstrap M0 | compose, smoke, scripts, seed, data-service connectivity va user-management bootstrap da verify | `generate_seed.py` re-run, `up-ai.ps1`, quickstart 2 may |
| AI profile M1 | Ollama + embedding/rerank dev path | profile `ai` 2 may hoan chinh |
| Parent-child RAG | chunking/retrieval flow moi da co section-path on dinh, prefix embed, re-ingest cleanup, router `reject/task_assist`, gateway `normalizedRoles`, ACL push-down theo role/department truoc Milvus va metadata-rich rerank + context budget; regression test pass 2026-06-24 (`test_chunker`, `test_pipeline_parent_child`, `test_retrieval`, `test_main_citations`, `test_sql`, `test_rerank`) | live full-stack smoke voi Milvus that |
| Admin hardening | health, policy, quota/token usage, account status/session management, audit panel/detail/export trong `/admin`; admin API helper + Playwright coverage; gateway role-based rate-limit, refresh-cookie hardening va admin-route guard regression da verify 2026-06-24 | production hardening polish va observability ops |
| ETL integration | SQL Server connector co API | smoke nguon that, UI ETL |
| Self-service | co khung web-ui | chua co module nghiep vu day du |

## 4. Uu tien tiep theo nen lam

1. Dong cac viec M0 con ho: re-run `generate_seed.py`, bo sung `up-ai.ps1`, hoan thien quickstart 2 may.
2. Lam `K-04`: docs timeline/chunk preview sau khi nhanh RAG core da co router `reject/task_assist` + Milvus metadata push-down va gateway hardening da khoi xong.
3. Hoan thien profile `ai` va smoke 2 may de tranh mac ket o local-only.
4. Mo rong smoke/eval RAG tren data that sau khi core ACL + rerank/context da khép kín.

## 5. Quy tac cap nhat

- Khi pull code moi co thay doi hanh vi dang ke, cap nhat bang "Hoan thanh mot phan" truoc.
- Khi mot task chuyen tu partial sang done, dong bo lai ca file nay va `task list.md`.
