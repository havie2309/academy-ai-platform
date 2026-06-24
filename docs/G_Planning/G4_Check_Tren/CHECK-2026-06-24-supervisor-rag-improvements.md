# CHECK-2026-06-24 — Cải tiến RAG theo phản hồi của Supervisor

## Ngày

- 2026-06-24

## Thành phần liên quan

- `document-processor` (chunking, embedding)
- `rag-engine` (sinh ngữ cảnh cho LLM)
- `rerank-server` (mô hình reranker)

## File docs/code liên quan

- `services/document-processor/app/chunker.py`
- `services/document-processor/app/pipeline.py`
- `services/rag-engine/app/generate.py`
- `services/rerank-server/main.py`
- `docs/task list.md`
- `docs/G_Planning/G2_Task_Progress_Map.md`

*(Lưu ý: Không cập nhật `B4_AI_Pipeline_Design.md` trong đợt này vì các thay đổi mang tính chi tiết implementation, không làm thay đổi luồng kiến trúc tổng thể đã được mô tả.)*

## Bối cảnh

Supervisor đã review pipeline RAG hiện tại và chỉ ra 4 điểm yếu cần cải thiện trước khi tiếp tục phát triển:

1.  **Parent Node quá lớn**: Node cha có thể là cả một "Chương", dễ gây hiện tượng "Lost in the Middle" với Qwen2.5‑3B.
2.  **Thiếu metadata cho embedding**: Node con được vector hóa dưới dạng text thô, không kèm theo tên tài liệu hay `section_path`.
3.  **Reranker yếu**: Đang dùng `Xenova/ms-marco-MiniLM-L-6-v2` (80 MB), không đủ mạnh cho văn bản pháp lý/kỹ thuật tiếng Việt.
4.  **Context phẳng**: LLM nhận danh sách chunk phẳng, mất cấu trúc phân cấp của tài liệu.

## Đề xuất ban đầu của AI

AI ban đầu chỉ đề xuất nâng cấp mô hình Reranker và giữ nguyên các thành phần khác, vì cho rằng việc thay đổi embedding model sẽ tốn chi phí re-index. Đề xuất này chưa đề cập đến việc giới hạn parent node, inject metadata hay xây dựng context dạng Markdown.

## Vấn đề trong đề xuất ban đầu

- Chưa giải quyết triệt để vấn đề "Lost in the Middle" do parent node quá lớn.
- Chưa cải thiện chất lượng vector space (vì thiếu metadata ngữ cảnh).
- LLM vẫn nhận context phẳng, không tận dụng được khả năng đọc hiểu cấu trúc của Qwen2.5.

## Phản hồi từ người dùng/team

Supervisor yêu cầu cụ thể:

- Chỉ tạo parent node tại cấp `Điều/Mục` (không tạo ở `Phần/Chương`).
- Inject metadata (`title`, `section_path`) vào text của child node trước khi embedding.
- Nâng cấp Reranker lên một cross-encoder mạnh hơn, hỗ trợ đa ngữ cảnh (ví dụ `bge-reranker-large` hoặc tương đương).
- Xây dựng context gửi vào LLM dưới dạng Markdown có cấu trúc (`# Title`, `## Section Path`).

Đồng thời, do hệ thống sắp được chuyển sang topology 2 máy (Máy nền tảng + Máy mô hình), team quyết định **giữ nguyên embedding model hiện tại** (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`) và sẽ nâng cấp lên `BAAI/bge-m3` khi có máy mô hình riêng.

## Hướng cuối cùng được chốt

1.  **`chunker.py`**: Sửa logic để chỉ `Điều` và `Mục` tạo parent node. `Phần`/`Chương` chỉ được lưu vào metadata (`chapter_header`) và hierarchy path, không làm flush section.
2.  **`pipeline.py`**: Trước khi gọi embedding, prepend chuỗi `[Văn bản: {title}] -> [Vị trí: {section_path}] -> [Nội dung]: {child_text}` vào mỗi child node.
3.  **`rerank-server/main.py`**: Chuyển model mặc định từ `Xenova/ms-marco-MiniLM-L-6-v2` sang `jinaai/jina-reranker-v2-base-multilingual` (1.11 GB, hỗ trợ đa ngữ, được hỗ trợ bởi thư viện `fastembed`).
4.  **`generate.py`**: Xây dựng lại context thành cấu trúc Markdown phân cấp (gộp theo `title` và `section_path`) thay vì danh sách phẳng.

## Lý do chọn hướng đó

- Các thay đổi về chunking và context trực tiếp giải quyết các điểm yếu về chất lượng RAG mà supervisor chỉ ra.
- Nâng cấp reranker mang lại lợi ích lớn nhất về độ chính xác với chi phí bộ nhớ chấp nhận được (~1.1 GB) và **không yêu cầu re-index**.
- Giữ embedding model hiện tại là quyết định thực tế, tránh làm việc hai lần trước khi chuyển sang topology 2 máy.
- Việc test trên môi trường hiện tại (1 máy, 16 GB RAM) cho thấy tổng tài nguyên vẫn ổn định sau các thay đổi.

## Tác động

- **`chunker.py`**: Logic tạo parent được viết lại hoàn toàn.
- **`pipeline.py`**: Thêm bước enrich text trước embedding.
- **`generate.py`**: Hàm `build_messages` được sửa để tạo context Markdown.
- **`rerank-server/main.py`**: Model mặc định thay đổi.
- **`task list.md`** và **`G2_Task_Progress_Map.md`**: Cập nhật trạng thái các task `D-06`, `D-07`, `E-04`, `E-05` thành `[x]` (hoàn thành).

**Nghiệm thu**:  
- Chạy thành công luồng ingest bộ tài liệu mẫu.
- Gọi `/v1/retrieve` trả về `200 OK` với danh sách chunk (không còn lỗi `503`).
- Gọi `/v1/chat/stream` trả về câu trả lời có grounding và citation chính xác.
- *Lưu ý*: Chưa viết unit test mới cho `test_chunker.py` trong commit này, việc nghiệm thu dựa trên smoke test end‑to‑end thủ công.

## Công việc tiếp theo

- Khi chuyển sang topology 2 máy, cập nhật `embedding-server` lên `BAAI/bge-m3`, thay đổi Milvus lên 1024 chiều (drop collection và re-ingest).
- (Khuyến nghị) Bổ sung unit test cho logic parent-child mới trong `test_chunker.py` để bảo vệ khỏi regression sau này.

## Bài học cho các lần chạy AI sau

- Khi supervisor đưa ra hướng dẫn cụ thể về chất lượng RAG, cần ưu tiên thay đổi theo thứ tự: **cấu trúc chunking → enrich dữ liệu đầu vào → nâng cấp model → tối ưu prompt/context**.
- Việc re-index không phải là rào cản trong giai đoạn test; tuy nhiên, nếu sắp có thay đổi hạ tầng lớn (topology 2 máy), có thể giữ model hiện tại để tránh lãng phí công sức.
- Luôn kiểm tra model có được hỗ trợ bởi thư viện hay không (`fastembed.list_supported_models()`) trước khi đổi model trong code.
- **Không giả định có unit test nếu chưa viết** – bằng chứng nghiệm thu phải dựa trên kết quả kiểm thử chức năng thực tế (smoke test, inspect database, API response).