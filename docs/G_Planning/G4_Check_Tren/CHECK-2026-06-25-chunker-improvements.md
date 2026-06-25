# CHECK-2026-06-25 — Cải tiến chunker: xử lý toàn bộ section & word‑aware overlap

## Date
- 2026-06-25

## Related component
- `document-processor` (chunker)
- Ingest pipeline

## Related docs/code files
- `services/document-processor/app/chunker.py`
- `services/platform/.env.example`
- `docs/B_Architecture/B2_Data_Architecture.md`
- `docs/B_Architecture/B4_AI_Pipeline_Design.md`
- `docs/task list.md`

## Context
- Supervisor trước đó yêu cầu không tạo parent cho `Phần`/`Chương` để tránh parent quá lớn (ghi nhận trong CHECK-2026-06-24-supervisor-rag-improvements.md).
- AI đã triển khai bằng cách `continue` khi gặp `section_type in {"phan", "chuong"}`.

## Initial AI proposal
- Giữ nguyên việc bỏ qua `Phần`/`Chương` và chỉ tạo parent cho `Điều`/`Mục`.
- Overlap dùng ký tự cố định (không quan tâm biên từ).

## Problems in the initial proposal
- Tài liệu không có `Điều`/`Mục` (chỉ có `Chương`) bị mất toàn bộ nội dung (chỉ giữ được dòng tiêu đề đầu).
- Overlap cắt từ giữa, tạo các chunk vô nghĩa (ví dụ: "Thông báo về lịch" → "báo về lịch", "về lịch"...).

## User/team feedback
- User báo lỗi: "The chunker make 5 child nodes out of a simple 'Thông báo về lịch thi', fix that"
- User yêu cầu: "Make it chunk by word as well"
- User cũng phát hiện nội dung các chương bị bỏ qua hoàn toàn và yêu cầu sửa.

## Final agreed direction
1. **Xóa bỏ việc skip `Phần`/`Chương`**: tất cả section được xử lý, tạo parent node (truncated nếu cần) để không mất nội dung.
2. **Word‑aware overlap**:
   - Thêm `_prev_word_boundary` và `_next_word_boundary` để điều chỉnh start/end của chunk.
   - Nếu toàn bộ text ≤ max_size, trả về một chunk duy nhất.
   - Giới hạn overlap tối đa ½ max_size để tránh tạo quá nhiều chunk nhỏ.
3. **Cập nhật env**: thêm `CHUNK_MAX_PARENT_SIZE` và `CHUNK_MAX_CHILD_SIZE` (thay vì chỉ `CHUNK_MAX_SIZE`).

## Rationale
- Bỏ skip đảm bảo không mất dữ liệu, phù hợp với yêu cầu "full parity".
- Word‑aware overlap cải thiện chất lượng chunk (không cắt từ) và giúp retrieval tốt hơn.
- Short‑text guard tránh chunk hóa quá mức cho đoạn ngắn.

## Impact
- `chunker.py` được sửa đổi lớn: thêm helpers, sửa logic trong `chunk_document_parent_child` và `chunk_by_length`.
- `.env.example` được bổ sung cặp biến mới.
- Các docs (`B2`, `B4`, `task list`) được cập nhật để phản ánh hành vi mới.

## Follow-up tasks
- Re‑ingest các tài liệu đã có để áp dụng chunking mới.
- Xem xét thêm test cho word‑boundary và việc xử lý section.

## Lesson for future AI/code assistant runs
- Khi supervisor đưa ra yêu cầu tránh parent lớn, cần cân nhắc cả trường hợp tài liệu không có cấp nhỏ hơn – không nên bỏ qua hoàn toàn mà có thể truncate hoặc giới hạn.
- Word‑boundary là yếu tố quan trọng cho chunking; cần kiểm tra kỹ output trước khi merge.
- Nếu user phát hiện vấn đề qua UI preview, điều đó chứng tỏ preview rất hữu ích; nên ưu tiên các công cụ kiểm tra trực quan.