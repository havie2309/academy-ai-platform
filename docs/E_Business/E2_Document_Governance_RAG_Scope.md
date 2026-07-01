# E2 — Document Governance & RAG Scope

## 1. Mục tiêu

- Xác định tài liệu nào được ingest, ai được xem, và citation phải trông như thế nào.
- Tránh biến RAG thành kho trả lời không kiểm soát.

## 2. Phân loại tài liệu

| Loại | Ví dụ |
|------|-------|
| Học liệu | giáo trình, slide, đề cương |
| Quy chế / văn bản | quy định học vụ, quy trình nội bộ |
| Tài liệu khảo thí | ngân hàng câu hỏi, đáp án, hướng dẫn chấm |
| Tài liệu KHCN | đề tài, báo cáo, luận văn |
| Tài liệu vận hành | SOP, runbook, báo cáo nội bộ |

## 3. Metadata bắt buộc

- `title`
- `docType`
- `securityLevel`
- `scopeType`
- `ownerUserId`
- `departmentCode`
- `sourceSystem`
- `version`
- `fileChecksum`

## 4. Quy tắc truy cập

| Tình huống | Quy tắc |
|-----------|---------|
| Tài liệu `public` | User đăng nhập có thể xem và dùng cho RAG |
| `internal` | Theo đơn vị hoặc vai trò |
| `restricted` | Cần allow list hoặc ownership rõ |
| `confidential` | Chỉ role cao hoặc nhóm được chỉ định |

## 5. Quy tắc citation

- Mỗi câu trả lời RAG phải ưu tiên trích dẫn tài liệu cụ thể.
- Citation tối thiểu gồm tên tài liệu, section/path hoặc page, snippet.
- Nếu model không trả `used_chunk_ids`, hệ thống được phép fallback chọn citation theo overlap nhưng phải giữ nguồn hợp lệ.
- **Khi LLM kết luận không tìm thấy thông tin, citations vẫn được hiển thị** kèm thông báo giải thích:
  *"Tôi không tìm thấy câu trả lời trực tiếp cho câu hỏi của bạn trong các tài liệu đã tìm kiếm. Tuy nhiên, đây là những phần liên quan nhất mà tôi đã xem xét:"*
  Điều này giúp người dùng hiểu hệ thống đã tìm kiếm và minh bạch về những gì đã được xem xét.

## 6. Versioning và vòng đời tài liệu

1. Upload mới tạo checksum và version.
2. `documentKey` gom các version của cùng một logical document.
3. Chỉ một bản `isLatestVersion=true`.
4. Xóa bản latest phải promote bản trước nếu tồn tại.
5. Re-ingest phải cập nhật lại chunk/vector và không để citation trỏ về dữ liệu mồ côi.

## 7. Phạm vi RAG

- Chỉ dùng tài liệu đã qua ingest thành công.
- Không dùng dữ liệu ngoài quyền user, kể cả khi vector search match rất cao.
- RAG không thay thế SQL cho dữ liệu có cấu trúc cần tính chính xác cao.

## 8. Điểm cần khóa tiếp

- Xác nhận đầy đủ cleanup parent-child khi re-ingest.
- Đẩy thêm metadata filter xuống Milvus thay vì chỉ lọc hậu kỳ.
- Bổ sung UI chunk preview/timeline để kiểm tra nguồn tốt hơn.
