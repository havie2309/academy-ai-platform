# G3 — Decision Memory

## 1. Mục đích

- Ghi lại các quyết định nền để người mới vào dự án không phải suy luận lại từ commit và chat log.

## 2. Nhật ký quyết định

| ID | Quyết định | Lý do | Trạng thái |
|----|------------|-------|------------|
| DEC-PM2-01 | On-premise first; runtime mục tiêu không phụ thuộc Internet | Phù hợp bài toán nội bộ và bảo mật dữ liệu học viện | Active |
| DEC-PM2-02 | Giữ kiến trúc đích 2 máy nhưng cho phép dev 1 máy | Tăng tốc bootstrap, vẫn không lệch topology mục tiêu | Active |
| DEC-PM2-03 | `api-gateway` là cổng vào chính cho client | Chuẩn hóa auth, audit và routing | Active |
| DEC-PM2-04 | Auth dùng access token ngắn hạn + refresh/session revocation model | Cân bằng UX và an toàn | Active |
| DEC-PM2-05 | Chat history hiện bám MongoDB; Redis chỉ là cache/context | Khớp source of truth hiện có trong docs/code | Active |
| DEC-PM2-06 | RAG answers phải giữ citation chain truy ngược được | Tránh trả lời mơ hồ và phục vụ audit/kiểm chứng | Active |
| DEC-PM2-07 | Text-to-SQL chỉ chạy read-only và phải qua validator | Giảm rủi ro query phá dữ liệu | Active |
| DEC-PM2-08 | Policy AI/safe refusal lấy từ `admin-config` và được version hóa | Cho phép đổi hướng an toàn mà không hard-code trong AI service | Active |
| DEC-PM2-09 | AI/provider URL và config không được hard-code vào flow nghiệp vụ | Giữ khả năng đổi topology, model và môi trường | Active |
| DEC-PM2-10 | Chuyển sang parent-child chunking cho ingest/RAG | Cải thiện ngữ nghĩa citation và retrieval | In progress |
| DEC-PM2-11 | Dùng ETL lineage và error log như bằng chứng đồng bộ | Phục vụ audit và debug nguồn | Active |
| DEC-PM2-12 | Check-tren là bắt buộc khi AI đề xuất bị user/team đổi hướng trước khi chốt | Giữ được reasoning trace, không chỉ commit diff | Active |
| DEC-PM2-13 | Tài liệu phải tách rõ `current implementation` và `target architecture` | Tránh trình bày kiến trúc mục tiêu như thể đã có trong repo | Active |
| DEC-PM2-14 | Khi docs mâu thuẫn với code, phải cập nhật docs hoặc đánh dấu `planned/partial`; không được âm thầm coi planned là implemented | Giữ docs đủ tin cậy để dev/reviewer/AI dùng làm source of truth | Active |
| DEC-PM2-15 | Mọi đợt chỉnh docs lớn do review redirect phải tạo file `Check-tren` riêng | Giữ trace cho các lần AI cần học lại cách bám implementation thật | Active |
| DEC-PM2-16 | API Gateway triển khai rate limiting, circuit breaker và load shedding sử dụng Redis | Bảo vệ hệ thống khỏi quá tải và lỗi lan truyền; sử dụng Redis để lưu trạng thái phân tán cho circuit breaker, rate limit và concurrent counter | Active |
| DEC-PM2-17 | MongoDB dùng lazy-init module-level `MongoClient`; Postgres dùng `asyncpg.create_pool()` wired vào FastAPI lifespan | Tránh tạo mới connection mỗi request; PyMongo pool tự quản lý bên trong `MongoClient` nên chỉ cần một instance duy nhất per process; lazy init tránh fork-safety bug khi dùng gunicorn `--preload` | Active |
| DEC-PM2-18 | Nâng cấp password hashing từ PBKDF2-SHA256 lên Argon2id | Phương pháp hiện tại (SHA-256 + salt) không còn được khuyến nghị; Argon2id là chuẩn hiện đại | Planned |
| DEC-PM2-19 | Nâng cấp AI Policy từ keyword-based lên semantic/context-based | Blacklist keyword không đủ mạnh; cần hiểu ngữ cảnh câu hỏi để chặn chính xác hơn | Planned |
| DEC-PM2-20 | Admin có thể xem chat history/session của các user khác | Phục vụ giám sát, kiểm tra, phát hiện bất thường; chỉ dành cho Admin và được audit đầy đủ | Planned |
| DEC-PM2-21 | RAG priority scoring: Database → Document security level → public | Dữ liệu có cấu trúc từ database tin cậy nhất, tài liệu public có độ tin cậy thấp nhất | Planned |
| DEC-PM2-22 | Thêm format validation cho access token trước khi truy vấn DB | Tối ưu performance, từ chối token sai format ngay tại gateway | Planned |
| DEC-PM2-23 | Admin Dashboard chuyển sang tab view | Cải thiện UX, giảm scrolling, dễ điều hướng | Planned |
| DEC-PM2-24 | Dùng Tesseract OCR làm fallback cho scanned PDF thay vì PaddleOCR | PaddleOCR quá nặng (1.5 GB RAM) và khó cài đặt trên Windows; Tesseract nhẹ (~150 MB RAM), hỗ trợ tiếng Việt tốt, ổn định trên CPU | Active |
| DEC-PM2-25 | Child chunks được làm sạch Markdown; parent chunks giữ raw Markdown | Child chunks dùng để embedding (Markdown là noise), parent chunks dùng cho LLM grounding (Markdown là structural cues) | Active |
| DEC-PM2-26 | Ưu tiên cut tại sentence boundary (`.!?`) khi chunking, với grace zone 20% | Tránh cut giữa câu, cải thiện chất lượng embedding và RAG, tương thích với Qwen2.5-3B | Active |
| DEC-PM2-27 | Persistent streaming messages: tạo assistant message ngay khi bắt đầu stream với `status: 'streaming'` | Cho phép phục hồi trạng thái sau reload/navigation; cải thiện UX khi mất kết nối SSE | Active |
| DEC-PM2-28 | Polling fallback cho SSE bị mất: frontend poll mỗi 3s khi message có `status: 'streaming'` | Đảm bảo câu trả lời vẫn xuất hiện ngay cả khi SSE bị ngắt; tránh over‑engineering với resumable streams | Active |
| DEC-PM2-29 | Luôn hiển thị citations và thay thế refusal message bằng văn bản giải thích rõ hơn | Tăng tính minh bạch và tin cậy; người dùng hiểu hệ thống đã tìm kiếm dù không tìm thấy câu trả lời trực tiếp | Active |
| DEC-PM2-30 | Giảm `RAG_CONTEXT_MAX_CHARS` từ 6000 xuống 1800 và điều chỉnh retrieval/rerank config | Cải thiện first-token latency và tổng thời gian generation trên CPU | Active |

## 3. Hệ quả thực tế

- Mọi thay đổi auth phải xét cả gateway, user-management, cookie flow và UI refresh.
- Mọi thay đổi tài liệu phải xét API upload, worker ingest, Mongo, Milvus và citation UI.
- Mọi thay đổi policy AI phải xét `admin-config`, cache và refusal behavior.
- Mọi thay đổi lớn do AI đề xuất nhưng bị chỉnh hướng phải có thêm một file ở `G4_Check_Tren/`.
- Nếu một tài liệu mô tả kiến trúc đích, tài liệu đó phải tự ghi rõ đây là `target/planned`.

## 4. Quy tắc thêm quyết định mới

- Chỉ thêm khi quyết định ảnh hưởng nhiều file hoặc nhiều team.
- Mỗi mục phải ghi rõ lý do và trạng thái.
- Nếu quyết định thay thế cái cũ, cập nhật trạng thái của mục cũ thay vì để cả hai cùng "Active".

## 5. Nguồn bổ sung

- Working memory chi tiết hơn: [../memory.md](../memory.md)
- Kế hoạch và tiến độ: [G1_Sprint_Overview.md](G1_Sprint_Overview.md), [G2_Task_Progress_Map.md](G2_Task_Progress_Map.md)
- Lưu vết reasoning/change trace của AI: [G4_Check_Tren/README.md](G4_Check_Tren/README.md)
