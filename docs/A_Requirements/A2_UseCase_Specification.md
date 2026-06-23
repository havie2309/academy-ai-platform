# A2 — Use Case Specification

## 1. Nguyên tắc viết use case

- Use case ở đây là luồng cốt lõi cần được hỗ trợ end-to-end.
- Mỗi use case phải map được vào API, UI và test case.
- Khi code mới pull về làm thay đổi flow, phải cập nhật lại file này trước hoặc cùng lúc với backlog.

## 2. Danh sách use case chính

| ID | Actor | Mục tiêu | Preconditions | Kết quả mong đợi |
|----|-------|----------|---------------|------------------|
| UC-01 | User | Đăng nhập hệ thống | Có tài khoản hợp lệ | Nhận access token + refresh token, vào đúng route |
| UC-02 | User | Tạo phiên chat và hỏi đáp đa lượt | Đăng nhập, chat service khả dụng | Tạo session, lưu message, có lịch sử |
| UC-03 | User | Hỏi đáp tài liệu có citation | Tài liệu đã index và người dùng có quyền | Nhận answer + citations + snippet |
| UC-04 | User | Gửi câu hỏi SQL tự nhiên | Có quyền dùng SQL route và catalog sẵn sàng | Trả kết quả bảng hoặc từ chối an toàn |
| UC-05 | User | Upload tài liệu mới | Đăng nhập và có quyền upload | Tạo document, enqueue ingest, poll được trạng thái |
| UC-06 | User | Tải/xóa phiên bản tài liệu | Là owner hoặc có quyền cao hơn | Giữ version history, bản latest cập nhật đúng |
| UC-07 | Admin | Xem health toàn hệ thống | Có role admin | Thấy trạng thái gateway và upstream |
| UC-08 | Admin | Chỉnh policy safe refusal | Có role admin | Policy mới được version hóa và áp dụng runtime |
| UC-09 | Admin | Xem/export audit log | Có role admin hoặc reviewer | Lọc, xem detail, tải JSON/CSV |
| UC-10 | ETL operator | Tạo connector nguồn | Có thông tin kết nối hợp lệ | Lưu source, ping/test được |
| UC-11 | ETL operator | Chạy batch sync | Source active và mapping hợp lệ | Tạo run, load dữ liệu, ghi lineage |
| UC-12 | System | Từ chối truy cập không hợp lệ | Query bị chặn hoặc user vượt quyền | Trả lỗi chuẩn, không rò dữ liệu |

## 3. Luồng chính cho các use case trọng tâm

### UC-03 — Hỏi đáp tài liệu có citation

1. Người dùng gửi câu hỏi từ `ChatPage`.
2. Gateway xác thực JWT và chuyển tiếp ngữ cảnh người dùng.
3. `rag-engine` route câu hỏi sang nhánh RAG.
4. Query được embed, retrieve chunk, lọc quyền, rerank, dựng context.
5. LLM sinh câu trả lời và danh sách chunk đã dùng.
6. Hệ thống map chunk sang document citation và trả về UI.

Luồng thay thế:

- Nếu policy chặn: route `refusal`.
- Nếu không có tài liệu phù hợp: trả câu trả lời thiếu căn cứ hoặc từ chối an toàn theo policy.
- Nếu `rag-engine` lỗi: chat service có thể trả lỗi tường minh thay vì bịa câu trả lời.

### UC-05 — Upload và ingest tài liệu

1. Người dùng chọn file và metadata bảo mật.
2. Backend validate loại file, dung lượng, access policy.
3. Hệ thống lưu file gốc, checksum, version và metadata tài liệu.
4. Queue ingest được publish qua RabbitMQ hoặc fallback path.
5. Worker extract/OCR, chunk, embed, upsert MongoDB + Milvus.
6. UI poll `ingest-status` cho tới khi hoàn tất hoặc thất bại.

### UC-09 — Xem/export audit log

1. Admin mở `AdminPage` và chọn bộ lọc.
2. UI gọi API audit list.
3. Backend trả danh sách log và metadata lọc.
4. Admin mở chi tiết một log để xem input/output/old/new value.
5. Admin export JSON hoặc CSV theo bộ lọc hiện tại.

## 4. Mapping use case sang module

| Use case | Backend chính | UI chính | Test bắt buộc |
|----------|---------------|----------|---------------|
| UC-01 | `user-management`, `api-gateway` | `LoginPage` | login + refresh + logout |
| UC-02 | `chat`, `redis`, `mongodb` | `ChatPage`, sidebar | session create/send/delete |
| UC-03 | `rag-engine`, `chat`, `document-processor` | `ChatPage` | citation + refusal regression |
| UC-04 | `rag-engine`, `sql_catalog`, Postgres RO | `ChatPage` | SQL safety + format test |
| UC-05 | `chat/documents`, RabbitMQ, `document-processor` | `DocsPage` | upload + ingest + status poll |
| UC-07/08/09 | `admin-config`, `audit`, `api-gateway` | `AdminPage` | Playwright admin suite |
| UC-10/11 | `etl-sync` | Admin ETL screen sau này | ETL unit/integration tests |

## 5. Điểm cần theo dõi

- Parent-child chunking vừa được đưa vào flow ingest/retrieval và cần nghiệm thu lại theo UC-03, UC-05.
- Quota/token usage và account management chưa hoàn tất nên chưa có use case quản trị vận hành đầy đủ.
- Self-service học viên/sinh viên mới có khung UI, chưa đủ use case nghiệp vụ sâu.
