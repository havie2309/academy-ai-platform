# D3 — Test Strategy

## 1. Mục tiêu

- Có chiến lược test đủ chặt cho auth, tài liệu, RAG, SQL, admin và ETL.
- Ưu tiên regression cho các luồng đã nhiều lần thay đổi gần đây.

## 2. Tầng test

| Tầng | Trọng tâm |
|------|-----------|
| Unit | Logic service, validator, helper, formatter |
| Integration | Giao tiếp giữa service với DB/cache/queue hoặc AI endpoint giả lập |
| E2E | Flow người dùng qua gateway/web-ui |
| Smoke | Kiểm chứng nhanh sau pull/merge/deploy |
| Eval | Chất lượng RAG/SQL/OCR theo bộ ca đo |

## 3. Bộ test bắt buộc theo vùng

| Vùng | Yêu cầu tối thiểu |
|------|-------------------|
| Auth | login, refresh, logout, invalid token, session revoke |
| Chat | session list/create/delete, stream, refusal, fallback |
| Documents | upload, ingest status, delete, versioning |
| RAG | retrieval, citation mapping, safe refusal, session context |
| SQL | validator, format table, readonly execution path |
| Admin | health view, policy load/save, audit read/filter/detail API; audit UI/export là phần planned |
| ETL | source CRUD, discovery, scheduler, transform/load, lineage |

## 4. Evidence hiện có nên giữ

- `scripts/smoke-app.ps1`
- Playwright admin/chat specs
- Python tests cho `rag-engine`, `document-processor`, `etl-sync`
- Build pass cho `services/platform` và `services/web-ui`

## 5. Cổng chặn trước merge

- Không merge thay đổi contract lớn nếu chưa có test hoặc evidence smoke.
- Thay đổi chunking/retrieval phải có regression cho citation.
- Thay đổi auth/session phải có ít nhất unit + smoke hoặc E2E.
- Thay đổi admin page phải có build và E2E tương ứng.

## 6. Ưu tiên test sắp tới

| Mức | Nội dung |
|-----|----------|
| Cao | Parent-child re-ingest/retrieval/citation |
| Cao | `up-code.ps1` full stack verify |
| Cao | Milvus metadata push-down và access filter |
| Trung bình | Quota/token usage admin ops sau khi có UI |
| Trung bình | SQL Server connector với nguồn thật |

## 7. Định nghĩa "đủ tin cậy"

- Không chỉ build pass; phải có bằng chứng hành vi đúng.
- Với AI flow, test cần kiểm chứng structure và policy nhiều hơn là câu văn cụ thể.
