# D2 — Environment Config

## 1. Mục tiêu

- Tách cấu hình khỏi code.
- Biết biến nào thuộc root stack, biến nào thuộc platform, biến nào thuộc AI.
- Giảm lỗi "chạy local được nhưng không tái lập được".

## 2. File cấu hình chuẩn

| File | Vai trò |
|------|---------|
| `.env.example` | Cấu hình root cho docker/data stack |
| `.env` | Bản local thực thi, không commit |
| `services/platform/.env.example` | Cấu hình platform/chat/rag bridge/auth |
| `services/platform/.env` | Bản local của NestJS monorepo |

## 3. Nhóm biến chính

### Hạ tầng

- `POSTGRES_*`
- `MONGODB_*`
- `REDIS_*`
- `RABBITMQ_*`
- `MILVUS_*`

### Auth và session

- `JWT_*`
- `REFRESH_*` hoặc session TTL tương đương
- cookie config

### AI routing

- `LLM_PROVIDER`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `EMBEDDING_BASE_URL`
- `RERANK_BASE_URL`

### Chat và RAG

- cache TTL
- session context TTL
- top-k, rerank top-k
- refusal policy fetch key

### SQL route

- `SQL_READONLY_*`
- catalog/config cho curated schema

### API Gateway – Khả năng phục hồi (Resilience)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `RATE_LIMIT_AUTH` | `60` | Số request tối đa mỗi phút cho người dùng đã đăng nhập |
| `RATE_LIMIT_ANON` | `10` | Số request tối đa mỗi phút cho người dùng chưa đăng nhập |
| `LOAD_SHEDDING_MAX_CONCURRENT` | `100` | Số lượng request đồng thời tối đa trước khi từ chối với mã 503 |
| `CIRCUIT_FAILURE_THRESHOLD_<service>` | `5` | Số lần thất bại để mở circuit cho mỗi upstream (ví dụ: `CIRCUIT_FAILURE_THRESHOLD_CHAT`) |
| `CIRCUIT_TIMEOUT_<service>` | `30` | Số giây circuit giữ trạng thái `OPEN` trước khi chuyển sang `HALF_OPEN` |
| `CIRCUIT_HALFOPEN_MAX_<service>` | `1` | Số request tối đa được phép ở trạng thái `HALF_OPEN` cho mỗi upstream |

Các biến này được `api-gateway` sử dụng để bảo vệ các dịch vụ upstream khỏi quá tải và lỗi lan truyền.

## 4. Quy tắc quản lý secret

- Không commit `.env` thật.
- API key nội bộ và mật khẩu DB phải thay được theo môi trường.
- Internal key cho `admin-config` không được lộ ra client.
- Nếu cần chia sẻ local env giữa team, dùng template đã làm sạch secret.

## 5. Quy tắc thay đổi config

- Thêm biến mới phải cập nhật `.env.example` tương ứng.
- Nếu biến ảnh hưởng flow nghiệp vụ hoặc topology, cập nhật thêm `D1` hoặc `D4`.
- Nếu biến dùng chung giữa platform và Python service, cần ghi rõ owner và default.

## 6. Cấu hình tối thiểu để chạy local

| Nhóm | Tối thiểu |
|------|-----------|
| Auth | JWT secret, cookie settings |
| Data | Postgres, MongoDB |
| Chat dev | `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://localhost:11434`, `LLM_MODEL=qwen2.5:3b` |
| RAG dev | embedding/rerank base URL nếu bật `start-rag.ps1` |

## 7. Gaps hiện tại

- Tài liệu 2 máy còn cần chi tiết hóa thêm khi profile `ai` hoàn tất.
- Một số tuning connection pool/cache vẫn nằm trong code nhiều hơn tài liệu env.
