# B1 — System Architecture

## 1. Mục tiêu kiến trúc

- Tách rõ tầng giao diện, tầng xử lý và tầng dữ liệu.
- Cho phép chạy local 1 máy để phát triển nhanh nhưng không làm lệch kiến trúc mục tiêu 2 máy.
- Đảm bảo AI, ETL và tài liệu dùng chung chính sách bảo mật, audit và config.

## 2. Bản đồ service

| Nhóm | Thành phần | Vai trò |
|------|------------|---------|
| Web | `services/web-ui` | UI cho login, chat, docs, admin, settings |
| Platform | `api-gateway`, `user-management`, `chat`, `rbac`, `audit`, `admin-config`, `workflow`, `notification` | API domain và cổng vào chính |
| AI/workers | `rag-engine`, `document-processor`, `embedding-server`, `rerank-server`, `etl-sync` | Retrieval, ingest, ETL, vector/rerank |
| Data | Postgres, MongoDB, Milvus, Redis, RabbitMQ, file storage | Lưu dữ liệu, vector, cache, queue |
| LLM | Ollama | Serving `qwen2.5:3b` ở dev và hướng chuẩn Qwen2.5-3B |

## 3. Topology chuẩn

### Dev hiện tại

- 1 máy chạy `web-ui`, NestJS services, Python services, Postgres, MongoDB, Milvus, Redis, RabbitMQ và Ollama.
- Mục tiêu là tối ưu vòng lặp phát triển, không phải topology production.

### Topology mục tiêu

| Máy | Thành phần |
|-----|------------|
| Máy nền tảng | Web UI, NestJS, `rag-engine`, `document-processor`, `etl-sync`, Postgres, MongoDB, Milvus, Redis, RabbitMQ |
| Máy mô hình | Ollama, `embedding-server`, `rerank-server` |

## 4. Luồng request chuẩn

### Chat / RAG

1. UI gọi gateway.
2. Gateway xác thực JWT và chuyển tiếp ngữ cảnh user.
3. Chat service lưu/hydrate session.
4. `rag-engine` route `rag/sql/refusal`.
5. Nếu RAG: retrieve, filter, rerank, generate, citation.
6. Kết quả được trả lại UI qua REST hoặc SSE.

### Document ingest

1. UI upload file + metadata.
2. Chat/documents service lưu file và record tài liệu.
3. Job được publish qua RabbitMQ.
4. `document-processor` extract/OCR/chunk/embed.
5. MongoDB và Milvus được cập nhật.

### ETL

1. Admin/operator tạo connector nguồn.
2. `etl-sync` ping/discover metadata.
3. Batch sync chạy theo lịch hoặc trigger.
4. Transform/load đẩy dữ liệu vào Postgres/MongoDB.
5. `etl_runs`, `etl_lineage`, `etl_error_logs` ghi đầy đủ.

## 5. Ranh giới trách nhiệm

| Thành phần | Không nên làm |
|------------|---------------|
| `web-ui` | Không tự giữ logic quyền hay quyết định business-critical ngoài UI guard |
| `api-gateway` | Không ôm business logic sâu; chủ yếu auth, proxy, chuẩn hóa entry |
| `chat` | Không tự phát minh retrieval; gọi `rag-engine` khi cần |
| `rag-engine` | Không tự cấp quyền; chỉ dùng scope được gateway/chat truyền xuống |
| `document-processor` | Không được bỏ qua validation metadata bảo mật |
| `etl-sync` | Không được chạy SQL ghi trực tiếp vào nguồn |

## 6. Cross-cutting concern

- Correlation id và audit.
- Retry/fallback có kiểm soát.
- Cache session/context ở Redis.
- Config động của refusal/prompt qua `admin-config`.
- Chuẩn lỗi thống nhất giữa gateway, chat, rag, docs và admin.
- **Rate limiting, circuit breaker và load shedding** – được triển khai tại `api-gateway` sử dụng Redis để lưu trạng thái phân tán, bảo vệ upstream khỏi quá tải và lỗi lan truyền.

## 7. Rủi ro kiến trúc cần nhớ

- Parent-child chunking đang thay đổi cách persist/retrieve, cần regression toàn flow.
- SQL route dễ rủi ro nếu catalog và validator không đi cùng nhau.
- Khi chuyển từ 1 máy sang 2 máy, timeout và base URL phải được kiểm tra lại bằng smoke cross-host.
