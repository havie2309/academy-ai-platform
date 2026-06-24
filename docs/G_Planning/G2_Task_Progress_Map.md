# G2 — Task Progress Map

## 1. Mục đích

- Tóm tắt nhanh cái gì đã xong, cái gì mới làm một phần và cái gì nên làm tiếp.
- Đây là lớp đọc nhanh; backlog đầy đủ vẫn ở [../task list.md](<../task list.md>).

## 2. Đã hoàn thành đáng kể

| Nhóm | Nội dung |
|------|----------|
| Auth | Login, refresh cookie flow, logout, seed IAM, hash + salt + iterations |
| Chat | Session history, SSE, markdown, citation UI, RAG bridge |
| Documents | Upload, metadata validation, versioning, ingest status poll |
| AI | Grounding, safe refusal, eval harness, SQL format/safety nền |
| Admin | Health view, policy editor |
| ETL | Source/job/run schema, scheduler, transform/load, lineage/error log |

## 3. Hoàn thành một phần

| Nhóm | Phần đã có | Phần còn thiếu |
|------|------------|----------------|
| Bootstrap M0 | compose, smoke, scripts, seed | verify `up-code.ps1` full stack, connectivity checklist |
| AI profile M1 | Ollama + embedding/rerank dev path | profile `ai` 2 máy hoàn chỉnh |
| Parent-child RAG | Đã hoàn thiện parent‑child chunking: chỉ tạo parent tại Điều/Mục; bổ sung unit test `test_chunker.py` pass. | ~~regression end-to-end~~ (đã smoke‑test end‑to‑end thành công) |
| Admin ops | health, policy, audit backend/API helper | audit panel/detail/export trong `/admin`, quota/token usage, account management |
| ETL integration | SQL Server connector có API | smoke nguồn thật, UI ETL |
| Self-service | có khung web-ui | chưa có module nghiệp vụ đầy đủ |

## 4. Ưu tiên tiếp theo nên làm

1. Đóng các việc M0 còn hở: verify full stack, connectivity, seed fresh DB.
2. Nghiệm thu lại parent-child ingest/retrieval/citation trước khi build thêm tính năng AI mới.
3. Làm `K-10` admin quota/token/account ops vì đây là lỗ hổng rõ nhất ở phần quản trị.
4. Hoàn thiện profile `ai` và smoke 2 máy để tránh mắc kẹt ở local-only.

## 5. Quy tắc cập nhật

- Khi pull code mới có thay đổi hành vi đáng kể, cập nhật bảng "Hoàn thành một phần" trước.
- Khi một task chuyển từ partial sang done, đồng bộ lại cả file này và `task list.md`.
