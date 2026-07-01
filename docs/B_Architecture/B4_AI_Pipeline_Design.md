# B4 — AI Pipeline Design

## 1. Mục tiêu

- Chuẩn hóa toàn bộ luồng AI quanh bốn trục: ingest, retrieval, generation và guardrail.
- Cho phép nâng model hoặc tối ưu pipeline mà không làm vỡ contract với platform/web-ui.

## 2. Pipeline ingest

1. Nhận job từ documents API.
2. Validate metadata bảo mật.
3. Extract native text trước; fallback OCR khi cần:
   - Ưu tiên: Native text (PyMuPDF cho PDF, python-docx cho DOCX)
   - Fallback 1: MinerU (nếu được cài đặt và bật)
   - Fallback 2: **Tesseract OCR** (nhẹ, chạy CPU, hỗ trợ tiếng Việt)
   - Fallback 3: PaddleOCR (nặng, yêu cầu GPU, hiện đang disabled)
4. Chunk theo parent-child:
   - **Parent chunk**: giữ nguyên text (bao gồm Markdown headers) để LLM grounding
   - **Child chunk**: được làm sạch Markdown syntax (`#`, `**`, `_`, `[link](url)`, ...) để embedding sạch hơn
5. Embed child chunks.
6. Upsert metadata vào MongoDB, vector vào Milvus.
7. Cập nhật `processing_jobs` và `documents`.

## 3. Pipeline RAG

1. Nhận câu hỏi và user scope.
2. Classify route.
3. Nếu route `rag`: embed query, retrieve top-k child chunks.
4. Filter theo quyền truy cập tài liệu.
5. Rerank, chọn context.
6. **Streaming generation**: Gọi `stream_chat` (yield token-by-token) thay vì chờ full response. Đầu ra là plain text, không yêu cầu JSON.
7. Resolve citations từ chunk sang document/section/page.
8. Citations được gửi trong sự kiện `meta` ngay sau retrieval và **không bị xóa** nếu câu trả lời là refusal.

## 4. Multi-turn session context

- Chat service giữ cache phiên ở Redis để giảm phụ thuộc vào Mongo cho mọi lượt hỏi.
- `rag-engine` nhận `sessionId` và duy trì context window giới hạn bằng TTL + số message tối đa.
- Khi xóa session, cache và nguồn lưu lâu dài phải đồng bộ sạch.

## 5. Safe refusal

- Policy đọc từ `admin-config`.
- Chặn sớm ở `rag-engine` trước retrieval/SQL/generation.
- Từ chối phải trả về route rõ ràng để UI phân biệt với lỗi hệ thống.
- Blacklist keyword chỉ là lớp ngoài; cần kết hợp scope và business rule.
- **Refusal message replacement**: Khi LLM kết luận "không tìm thấy thông tin", câu trả lời được thay thế bằng thông báo giải thích rõ ràng hơn và **các citations được giữ lại** để minh bạch với người dùng.

## 6. Text-to-SQL

1. Router nhận diện câu hỏi SQL.
2. Prompt chỉ thấy catalog curated và quy tắc readonly.
3. SQL generated đi qua validator.
4. Chỉ khi pass validator mới thực thi bằng user `pm2_readonly`.
5. Kết quả được format thành bảng và audit lại.

## 7. ETL pipeline

1. Quản trị source.
2. Ping/discover bảng, cột, sample rows.
3. Scheduler tạo run theo cron hoặc trigger.
4. Transform theo mapping.
5. Load Postgres/Mongo.
6. Ghi `etl_lineage` và `etl_error_logs`.

## 8. Regression bắt buộc

| Nhánh | Phải có bằng chứng |
|-------|---------------------|
| Extract/OCR | PDF native, scan, DOCX, PPTX, XLSX |
| Chunking | Parent-child, section path, overlap |
| Retrieval | Citation đúng nguồn, access filter hoạt động |
| Refusal | Query bị chặn trả route `refusal`; citations không bị xóa khi refusal |
| SQL | Validator chặn câu nguy hiểm, format bảng đúng |
| ETL | Mapping, load, lineage, retry/error log |
| Streaming | Real token streaming hoạt động, UI cập nhật từng token |

## 9. Điểm đang chuyển trạng thái

- Parent-child retrieval là hướng mới và cần được xem là chuẩn đích.
- Metadata push-down cho vector search chưa hoàn toàn hoàn tất.
- Các tính năng AI nâng cao như quiz/summary/report phải tái sử dụng cùng guardrail và audit chain này.
- Persistent streaming messages và polling fallback đã được triển khai để đảm bảo UI consistency sau reload/navigation.
