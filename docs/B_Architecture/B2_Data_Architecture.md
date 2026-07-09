# B2 — Data Architecture

## 1. Nguyên tắc dữ liệu

- Mỗi loại dữ liệu nằm ở kho phù hợp nhất thay vì ép vào một DB duy nhất.
- Dữ liệu có cấu trúc, metadata tài liệu, vector và cache phải liên kết được với nhau qua id ổn định.
- Mọi luồng AI phải truy ngược được dữ liệu nguồn để audit và citation.

## 2. Vai trò từng kho

| Kho | Nhiệm vụ chính |
|-----|----------------|
| Postgres | IAM, auth sessions, audit, ETL metadata, catalog SQL curated, dữ liệu quan hệ nghiệp vụ |
| MongoDB | Documents catalog, processing jobs, chunks, chat sessions/messages phụ trợ |
| Milvus | Vector index cho retrieval tài liệu |
| Redis | Chat session cache, retrieval cache, session context TTL |
| RabbitMQ | Ingest queue, retry, DLQ, job nền |
| File storage | File gốc, versioning, checksum lineage |

## 3. Thực thể cốt lõi

### Auth và quản trị

- `users`
- `user_sessions`
- `login_logs`
- `admin_configs`
- `prompt_change_log`
- `audit_logs`

### Tài liệu và RAG

- `documents`
- `document_versions`
- `processing_jobs`
- `document_chunks`
- `chat_sessions`
- `chat_messages`

### ETL

- `etl_sources`
- `etl_jobs`
- `etl_runs`
- `etl_lineage`
- `etl_error_logs`

### SQL read-only

- `sql_catalog_entries`
- curated views trong schema `sql_curated`
- readonly role `pm2_readonly`
- **View `v_diem_mon` đã được cập nhật để bao gồm `ma_lop`** (từ `hoc_vien`), hỗ trợ truy vấn theo lớp.

## 4. Chuẩn metadata tài liệu

| Trường | Ý nghĩa |
|--------|---------|
| `documentId` / `documentKey` | Định danh logic và nhóm version |
| `version`, `isLatestVersion` | Điều khiển vòng đời file |
| `fileChecksum` | Dấu vết chống trùng và kiểm chứng re-ingest |
| `securityLevel` | `public/internal/restricted/confidential` |
| `scopeType` | `public`, `role`, `department`, `owner`, `custom` |
| `allowedRoleCodes`, `allowedDepartmentCodes`, `allowedUserIds` | Danh sách cấp quyền tường minh |
| `ingestStatus`, `ingestStage`, `chunkCount`, `ingestError` | Trạng thái pipeline |

## 5. Parent-child chunking

- Parent chunk biểu diễn section hoặc đơn vị ngữ nghĩa lớn.
- Child chunk là đơn vị retrieve/embedding chính.
- Retrieval search child ở Milvus, sau đó map ngược về parent để tạo citation rõ nghĩa hơn.
- `section_path`, `parent_preview`, `parent_id` là metadata bắt buộc để UI và citation hiểu được cấu trúc nguồn.

## 6. Data lineage bắt buộc

| Luồng | Dấu vết tối thiểu |
|-------|-------------------|
| Upload tài liệu | user -> file -> document -> version -> processing job -> chunk/vector |
| Chat RAG | user -> session -> question -> retrieved chunks -> answer -> citations |
| SQL | user -> prompt -> SQL generated -> validator result -> rows returned |
| ETL | source -> job -> run -> transformed rows -> target rows -> error logs |

## 7. Chính sách dữ liệu

- Token/secret không lưu plain text trong DB.
- Refresh token lưu hash; password seed phải có salt + iterations.
- SQL runtime chỉ dùng credential read-only.
- Metadata bảo mật của tài liệu phải được validate ở cả API và worker.

## 8. Gaps cần tiếp tục đóng

- Push-down filter đầy đủ xuống Milvus thay vì chỉ hậu kiểm ở Mongo.
- Rà lại cleanup/sync khi re-ingest parent-child.
- Chuẩn hóa thêm phần domain tables cho đào tạo, khảo thí, KHCN khi module nghiệp vụ đi sâu hơn.
