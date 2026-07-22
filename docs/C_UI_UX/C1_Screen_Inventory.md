# C1 — Screen Inventory

## 1. Mục tiêu

- Liệt kê các màn hình người dùng và quản trị cần có trong PM2.
- Tạo chuẩn chung để frontend, backend và QA nói cùng một ngôn ngữ.
- Phân biệt rõ màn hình `implemented`, `partial` và `planned`.

## 2. Danh mục màn hình hiện tại và đích

| Mã | Màn hình | Route hiện tại / dự kiến | Đối tượng | Trạng thái chính | API phụ thuộc | Current status |
|----|----------|--------------------------|-----------|------------------|---------------|----------------|
| UI-01 | Login | `/login` | Mọi user | idle, submitting, error | auth login/refresh/logout | `implemented` |
| UI-02 | Chat | `/chat`, `/chat/:sessionId` | User thường, giảng viên, admin | empty, streaming, answered, refusal, error | chat session/message, RAG, SQL | `implemented` |
| UI-03 | Sidebar lịch sử chat | trong layout chat | User | loading, optimistic update, delete confirm | chat sessions | `implemented` |
| UI-04 | Docs workspace | `/docs` | User có quyền tài liệu | list, upload, ingest polling, download, delete, chunk preview, scope edit, compact card design, collapsible metadata, dropdown actions, **markdown file preview** | documents, ingest-status, chunks | `implemented` |
| UI-05 | Upload document modal | trong `/docs` | User có quyền upload | form, validating, uploading, queued; dropdown level lọc theo `maxSecurityLevel` | documents upload | `implemented` |
| UI-05b | Scope edit modal | trong `/docs` | Admin hoặc document owner | pre-filled form, saving | `PATCH /api/documents/:id/scope` | `implemented` |
| UI-06 | Admin health | `/admin` | admin | loading, partial-down, refreshed | gateway health | `implemented` |
| UI-07 | Admin policy editor | `/admin` | admin | loading, dirty, saved, conflict | admin-config | `implemented` |
| UI-08 | Admin audit panel | dự kiến trong `/admin` | admin-like | filtered list, detail panel, export | audit logs | `planned` |
| UI-09 | Settings | `/settings` | user | read, update sau này | profile/settings | `partial` |
| UI-10 | ETL console | dự kiến `/admin/etl` hoặc tab ETL trong `/admin` | admin/operator | empty, loading, configured, running, success, failed | `etl-sync` `/v1/etl/*` | `planned` |
| UI-11 | Self-service học viên/sinh viên | dự kiến `/portal`, `/self-service` hoặc cụm route tương đương | hoc_vien / user cuối | loading, empty, partial-data, permission-denied, success | domain APIs đào tạo/khảo thí/thông báo | `planned` |
| UI-12 | Quota / token / account ops | dự kiến `/admin/accounts`, `/admin/ops` hoặc tab quản trị tương đương | admin | loading, filter, save, disabled, error | quota/token/account APIs | `planned` |
| UI-13 | Admin Chat Monitoring | tab trong `/admin` | admin | loading, filter by user/date, view session detail, view messages | `GET /api/chat/admin/sessions` + messages | `implemented` |

## 3. Quy tắc trải nghiệm chính

### Chat

- Streaming phải hiển thị tiến trình rõ ràng.
- Citation phải nhóm theo tài liệu và cho thấy section/page/snippet.
- Refusal không được hiển thị như lỗi kỹ thuật.

### Documents

- Upload cần buộc người dùng chọn metadata bảo mật trước khi gửi.
- Trạng thái ingest phải dễ đọc: `queued`, `processing`, `completed`, `failed`.
- Version mới phải nhìn ra được đâu là bản latest.

### Admin

- Health, policy, audit phải nằm cùng một cụm điều hướng quản trị.
- Khi audit panel được triển khai, export phải luôn bám theo bộ lọc hiện tại.
- Các thao tác sửa policy phải hiển thị `version` và `updatedAt`.

## 4. Chi tiết các màn hình planned

### UI-10 — ETL console

- Route dự kiến: `/admin/etl` hoặc một tab ETL trong `/admin`
- Main states: source list, source detail, job config, run history, running, partial failure, empty state
- Required API dependency:
  - current repo: `etl-sync` service-level API `/v1/etl/*`
  - target: flow admin/gateway được chuẩn hóa
- Current status: `planned`

### UI-11 — Self-service học viên / user area

- Route dự kiến: `/portal` hoặc `/self-service`
- Main states: dashboard loading, không có dữ liệu, có dữ liệu một phần, permission denied, success
- Required API dependency:
  - domain APIs đào tạo/khảo thí/thông báo
  - auth + profile scope
- Current status: `planned`

### UI-12 — Quota / token / account ops

- Route dự kiến: `/admin/accounts`, `/admin/ops` hoặc module con trong `/admin`
- Main states: loading, filter/search, edit/save, disabled state, error state
- Required API dependency:
  - quota/token usage API
  - account management API
  - role/permission admin guard
- Current status: `planned`

## 5. Trạng thái bắt buộc cho QA

| Màn hình | Trạng thái cần test |
|----------|---------------------|
| Login | sai mật khẩu, token hết hạn, refresh thành công |
| Chat | stream thành công, refusal, rag lỗi, SQL bảng dài |
| Docs | upload hợp lệ, upload file sai, ingest failed, xóa version mới nhất |
| Admin health | một upstream down, reload, route bị chặn |
| Admin audit panel (planned) | khi có UI: lọc, mở detail, export JSON/CSV |

## 6. Khoảng trống hiện tại

- ETL console, self-service và quota/account ops chưa có UI hoàn chỉnh trong repo hiện tại.
- Audit API/helper đã có một phần ở backend và `web-ui/src/api/admin.ts`, nhưng `/admin` hiện chưa render viewer/detail/export.
- `Settings` hiện mới ở mức partial, chưa có quản trị profile/account đầy đủ.
