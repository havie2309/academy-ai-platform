# B5 — Repo Structure

## 1. Mục đích

- Giúp người mới biết file nào là spec, file nào là implementation, file nào là vận hành.
- Giảm tình trạng sửa sai tầng hoặc bỏ sót test khi code được pull về nhiều nhánh.

## 2. Cấu trúc cấp cao

```text
docs/                 tài liệu chuẩn, backlog, memory
infra/                init DB và hạ tầng dữ liệu
scripts/              script chạy local, smoke, health, seed
services/platform/    NestJS monorepo
services/web-ui/      React/Vite frontend
services/rag-engine/  retrieval, SQL route, refusal
services/document-processor/ ingest + OCR + chunk + embed
services/etl-sync/    connector + scheduler + transform/load
services/embedding-server/ embedding HTTP service
services/rerank-server/ rerank HTTP service
data/                 sample docs và fixture dữ liệu
eval/                 bộ eval/regression AI
```

## 3. Ownership đề xuất

| Đường dẫn | Ownership chính |
|----------|------------------|
| `docs/A_*` đến `docs/G_*` | PM + tech lead |
| `services/platform/` | Backend/platform |
| `services/web-ui/` | Frontend |
| `services/rag-engine/`, `document-processor/`, `embedding-server/`, `rerank-server/` | AI/ML + backend |
| `services/etl-sync/` | Data/ETL |
| `infra/`, `scripts/` | Platform/DevOps |

## 4. Source of truth theo chủ đề

| Chủ đề | Source of truth |
|--------|-----------------|
| Yêu cầu, chuẩn tính năng | `docs/A_*`, `docs/E_*`, `docs/F_*` |
| Kiến trúc | `docs/B_*`, `docs/D1_*` |
| Backlog chi tiết | `docs/task list.md` |
| Kế hoạch triển khai | `docs/plan.md` |
| Working memory / handover | `docs/memory.md` |
| Runtime config mẫu | `.env.example`, `services/platform/.env.example` |

## 5. Quy tắc chỉnh sửa

- Khi thay đổi flow nghiệp vụ hoặc contract, cập nhật `docs/` trước hoặc cùng PR.
- Không dùng `docs/INDEX.md` như danh mục file code; đó là cổng vào của bộ spec.
- Nếu code pull về làm đổi hành vi đáng kể, cập nhật ít nhất `G2_Task_Progress_Map.md` và `G3_Decision_Memory.md`.

## 6. Quy tắc test đi kèm code

- Sửa service nào thì ưu tiên test trong chính service đó.
- Thay đổi contract UI/API phải có build hoặc E2E tương ứng.
- Thay đổi pipeline AI phải có regression test hoặc evidence smoke cụ thể.
