# G1 — Sprint Overview

## 1. Cách đọc

- PM2 hiện quản trị tiến độ theo milestone M0-M6.
- File này dùng từ "sprint overview" theo phong cách bộ mẫu, nhưng nội dung bám theo milestone thực tế của repo.

## 2. Tổng quan lộ trình

| Mốc | Trọng tâm | Trạng thái 2026-06-23 |
|-----|-----------|------------------------|
| M0 | Bootstrap repo, compose, seed, smoke, data nền | Gần xong, còn vài bước verify vận hành |
| M1 | LLM/embedding/rerank profile | Một phần, đang dùng cấu hình dev |
| M2 | Ingest, OCR, chunking, index | Phần lớn đã có, đang polish parent-child |
| M3 | RAG, citation, refusal, multi-turn | Phần lớn đã có |
| M4 | Text-to-SQL read-only | Đã có nền an toàn và format |
| M5 | Gateway, auth, RBAC, audit, ETL | Đa số lõi đã có, còn admin ops và hardening |
| M6 | Web UI, self-service, admin hoàn chỉnh | Chat/docs/admin đang tiến tốt, phần self-service còn thiếu |

## 3. Trình tự phụ thuộc

```text
M0 -> M1 -> M2 -> M3
          \-> M4
M3 + M4 -> M5 -> M6
```

## 4. Thành quả nổi bật đã có

- Auth qua gateway với access + refresh token.
- Chat đa lượt, SSE, citation UI, refusal policy.
- Upload tài liệu, ingest queue, OCR/extract đa định dạng.
- ETL schema, scheduler, transform/load, lineage.
- Admin health, policy editor; audit read API/helper đã có nhưng audit viewer/export UI vẫn còn thiếu.

## 5. Các mốc cần khóa tiếp

| Ưu tiên | Nội dung |
|---------|----------|
| Cao | Verify full stack bootstrap M0 |
| Cao | Hoàn tất kiểm chứng parent-child chunking/retrieval |
| Cao | Quota/token/account ops cho admin |
| Trung bình | Profile `ai` 2 máy hoàn chỉnh |
| Trung bình | UI ETL và self-service |

## 6. Tài liệu liên quan

- Bản đồ task chi tiết: [G2_Task_Progress_Map.md](G2_Task_Progress_Map.md)
- Backlog đầy đủ: [../task list.md](<../task list.md>)
