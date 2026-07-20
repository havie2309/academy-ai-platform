## D2 — Environment Config

### 1. Mục tiêu

- Tách cấu hình khỏi code.
- Biết biến nào thuộc root stack, biến nào thuộc platform, biến nào thuộc AI.
- Giảm lỗi "chạy local được nhưng không tái lập được".

---

### 2. File cấu hình chuẩn

| File | Vai trò |
|------|---------|
| `.env.example` | Cấu hình root cho docker/data stack |
| `.env` | Bản local thực thi, không commit |
| `services/platform/.env.example` | Cấu hình platform/chat/rag bridge/auth |
| `services/platform/.env` | Bản local của NestJS monorepo |

---

### 3. Nhóm biến chính

#### Hạ tầng (Infrastructure)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `POSTGRES_HOST` | `127.0.0.1` | Host PostgreSQL |
| `POSTGRES_PORT` | `5433` | Port PostgreSQL |
| `POSTGRES_DB` | `pm2` | Tên database |
| `POSTGRES_USER` | `pm2_user` | Tên user |
| `POSTGRES_PASSWORD` | `pm2pass` | Mật khẩu user |
| `MONGO_URI` | `mongodb://pm2_user:pm2pass@localhost:27017/pm2?authSource=admin` | Connection string MongoDB |
| `MONGO_DB` | `pm2` | Tên database MongoDB |
| `REDIS_HOST` | `127.0.0.1` | Host Redis |
| `REDIS_PORT` | `6379` | Port Redis |
| `REDIS_PASSWORD` | (rỗng) | Mật khẩu Redis |
| `REDIS_DB` | `0` | Database index Redis |
| `RABBITMQ_HOST` | `127.0.0.1` | Host RabbitMQ |
| `RABBITMQ_PORT` | `5672` | Port RabbitMQ |
| `RABBITMQ_USER` | `pm2_user` | Tên user RabbitMQ |
| `RABBITMQ_PASSWORD` | `pm2pass` | Mật khẩu RabbitMQ |
| `MILVUS_HOST` | `localhost` | Host Milvus |
| `MILVUS_PORT` | `19530` | Port Milvus |
| `MILVUS_COLLECTION` | `document_chunks` | Tên collection Milvus |

---

#### Auth và Session

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `JWT_SECRET` | (bắt buộc) | Secret key cho JWT |
| `JWT_EXPIRES_IN` | `15m` | Thời gian hết hạn access token |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Thời gian hết hạn refresh token |
| `COOKIE_DOMAIN` | (rỗng) | Domain cho cookie (dùng khi 2 máy) |
| `COOKIE_SAMESITE` | `lax` | SameSite policy cho cookie |
| `COOKIE_SECURE` | `false` | Chỉ gửi cookie qua HTTPS |

---

#### AI Routing

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `LLM_PROVIDER` | `ollama` | Provider cho LLM (`ollama`/`openai`) |
| `LLM_BASE_URL` | `http://localhost:11434` | Endpoint cho LLM (OpenAI-compatible) |
| `LLM_MODEL` | `qwen2.5:3b` | Model cho LLM |
| `LLM_FALLBACK_PROVIDER` | (rỗng) | Provider fallback |
| `LLM_FALLBACK_BASE_URL` | (rỗng) | Endpoint fallback |
| `LLM_FALLBACK_MODEL` | (rỗng) | Model fallback |
| `LLM_TIMEOUT` | `120` | Timeout (giây) cho LLM |
| `OPENAI_API_KEY` | (rỗng) | API key cho OpenAI (nếu dùng) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model khi dùng OpenAI |
| `EMBEDDING_BASE_URL` | `http://localhost:8001` | Endpoint cho embedding service |
| `RERANK_BASE_URL` | `http://localhost:8002` | Endpoint cho rerank service |
| `RERANK_ENABLED` | `true` | Bật/tắt rerank |
| `RERANK_SCORE_FIELD` | (rỗng) | Tên field score từ rerank server (mặc định thử `score`, `relevance_score`, etc.) |
| `RAG_ENGINE_URL` | `http://localhost:8000` | URL của rag-engine (dùng bởi chat service) |

---

#### Document Processor (Ingest)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `CHUNK_MAX_PARENT_SIZE` | `1000` | Số ký tự tối đa cho parent chunk (cấp section) |
| `CHUNK_MAX_CHILD_SIZE` | `200` | Số ký tự tối đa cho child chunk (đơn vị embedding) |
| `CHUNK_OVERLAP` | `0.2` | Tỷ lệ overlap giữa các chunk (0.0–1.0) |
| `INGEST_QUEUE` | `ingest.jobs` | Tên queue RabbitMQ cho ingest jobs |
| `EMBEDDING_DIM` | `384` | Số chiều vector (phải khớp với model embedding) |
| `ALLOW_ADVERSARIAL_DOCS` | `true` | Cho phép document adversarial trong retrieval |

---

#### Chat và RAG

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `CHAT_SESSION_CONTEXT_TTL` | `3600` | TTL (giây) cho context chat trong Redis |
| `CHAT_SESSION_CONTEXT_MAX_MESSAGES` | `20` | Số message tối đa giữ trong context |
| `RETRIEVAL_TOP_K` | `60` | Số chunk lấy từ Milvus trước rerank |
| `RERANK_TOP_K` | `8` | Số chunk giữ lại sau rerank |
| `RERANK_SCORE_MIN` | `-0.5` | Ngưỡng tối thiểu cho rerank score |
| `RERANK_SCORE_DELTA` | `2.0` | Khoảng cách cho phép so với top score |
| `MAX_CHUNKS_PER_DOC` | `3` | Số chunk tối đa từ một document |
| `RERANK_DOC_MAX_CHARS` | `1800` | Số ký tự tối đa gửi cho reranker mỗi chunk |
| `RAG_CONTEXT_MAX_CHARS` | `1800` | Số ký tự tối đa đưa vào LLM context |
| `VECTOR_SCORE_MIN` | `-100` | Ngưỡng tối thiểu cho vector score |

---

#### Guardrail (Safe Refusal)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `GUARDRAIL_FUZZY_ENABLED` | `true` | Bật fuzzy keyword matching |
| `GUARDRAIL_FUZZY_THRESHOLD` | `0.85` | Ngưỡng tương tự fuzzy |
| `GUARDRAIL_SEMANTIC_ENABLED` | `false` | Bật semantic guardrail (embedding-based) |
| `GUARDRAIL_SEMANTIC_THRESHOLD` | `0.78` | Ngưỡng cosine similarity cho semantic |
| `GUARDRAIL_SEMANTIC_TIMEOUT_SECONDS` | `5` | Timeout (giây) cho semantic guardrail |
| `GUARDRAIL_LLM_ENABLED` | `false` | Bật LLM-based guardrail |
| `GUARDRAIL_HEURISTIC_POLICY_ENABLED` | `true` | Bật heuristic policy judge |
| `ADMIN_CONFIG_URL` | `http://127.0.0.1:3004` | URL của admin-config service |
| `ADMIN_CONFIG_CACHE_TTL_SECONDS` | `30` | TTL cache policy (giây) |

---

#### Summarization (J-01)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SUMMARY_MAX_CHARS` | `1500` | Số ký tự tối đa lấy từ tài liệu để tóm tắt |
| `SUMMARY_LLM_PROVIDER` | `ollama` | Provider cho tóm tắt (ollama/openai) |
| `SUMMARY_LLM_BASE_URL` | `http://localhost:11434` | Endpoint cho tóm tắt |
| `SUMMARY_LLM_MODEL` | `qwen2.5:3b` | Model cho tóm tắt |
| `SUMMARY_LLM_FALLBACK_PROVIDER` | (rỗng) | Fallback provider (tùy chọn) |
| `SUMMARY_LLM_FALLBACK_BASE_URL` | (rỗng) | Fallback endpoint (tùy chọn) |
| `SUMMARY_LLM_FALLBACK_MODEL` | (rỗng) | Fallback model (tùy chọn) |
| `SUMMARY_LLM_RETRY_ATTEMPTS` | `2` | Số lần thử lại khi lỗi |
| `SUMMARY_LLM_TIMEOUT` | `60` | Timeout (giây) cho tóm tắt |

---

#### Text-to-SQL

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SQL_LLM_PROVIDER` | `ollama` | Provider cho SQL generation |
| `SQL_LLM_BASE_URL` | `http://localhost:11434` | Endpoint cho SQL generation |
| `SQL_LLM_MODEL` | `qwen2.5:3b` | Model cho SQL generation |
| `SQL_OPENAI_MODEL` | `gpt-4o-mini` | Model khi dùng OpenAI cho SQL |
| `SQL_FEW_SHOT_ENABLED` | `true` | Bật few-shot examples trong prompt |
| `SQL_READONLY_USER` | `pm2_readonly` | User read-only cho Postgres |
| `SQL_READONLY_PASSWORD` | `pm2_readonly_pass` | Password cho read-only user |
| `SQL_STATEMENT_TIMEOUT_MS` | `10000` | Timeout (ms) cho SQL query |
| `SQL_DEFAULT_LIMIT` | `100` | Số hàng mặc định |
| `SQL_MAX_LIMIT` | `100` | Số hàng tối đa |
| `SQL_AUDIT_ENABLED` | `true` | Bật ghi audit cho SQL |

---

#### API Gateway — Resilience

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `RATE_LIMIT_AUTH` | `60` | Số request tối đa mỗi phút cho user đã đăng nhập |
| `RATE_LIMIT_ANON` | `10` | Số request tối đa mỗi phút cho user chưa đăng nhập |
| `RATE_LIMIT_WINDOW` | `60` | Time window (giây) của Redis bucket rate-limit |
| `RATE_LIMIT_ROLE_ADMIN` | `180` | Giới hạn/phút cho `ADMIN` |
| `RATE_LIMIT_ROLE_BGD` | `180` | Giới hạn/phút cho `BGD` |
| `RATE_LIMIT_ROLE_P2` | `120` | Giới hạn/phút cho `P2` |
| `RATE_LIMIT_ROLE_P7` | `90` | Giới hạn/phút cho `P7` |
| `RATE_LIMIT_ROLE_GIANG_VIEN` | `90` | Giới hạn/phút cho `GIANG_VIEN` |
| `RATE_LIMIT_ROLE_HOC_VIEN` | `60` | Giới hạn/phút cho `HOC_VIEN` |
| `LOAD_SHEDDING_MAX_CONCURRENT` | `100` | Số request đồng thời tối đa trước khi gateway từ chối với mã `503` |
| `LOAD_SHEDDING_RETRY_AFTER` | `1` | Giá trị `Retry-After` (giây) trả về khi load shedding `503` |
| `CIRCUIT_FAILURE_THRESHOLD_<service>` | `5` | Số lần thất bại để mở circuit cho mỗi upstream |
| `CIRCUIT_TIMEOUT_<service>` | `30` | Số giây circuit giữ trạng thái `OPEN` trước khi chuyển sang `HALF_OPEN` |
| `CIRCUIT_HALFOPEN_MAX_<service>` | `1` | Số request tối đa được phép ở trạng thái `HALF_OPEN` cho mỗi upstream |

---

#### Internal Gateway Auth

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `GATEWAY_INTERNAL_SHARED_SECRET` | (rỗng) | Secret cho internal calls giữa gateway và rag-engine. Để trống trong dev để bỏ qua check. |
| `ADMIN_CONFIG_INTERNAL_KEY` | (rỗng) | Internal key cho admin-config service |

---

### 4. Quy tắc quản lý secret

- Không commit `.env` thật.
- API key nội bộ và mật khẩu DB phải thay được theo môi trường.
- Internal key cho `admin-config` không được lộ ra client.
- Nếu cần chia sẻ local env giữa team, dùng template đã làm sạch secret.

---

### 5. Quy tắc thay đổi config

- Thêm biến mới phải cập nhật `.env.example` tương ứng.
- Nếu biến ảnh hưởng flow nghiệp vụ hoặc topology, cập nhật thêm `D1` hoặc `D4`.
- Nếu biến dùng chung giữa platform và Python service, cần ghi rõ owner và default.

---

### 6. Cấu hình tối thiểu để chạy local

| Nhóm | Tối thiểu |
|------|-----------|
| Auth | JWT secret, cookie settings |
| Data | Postgres, MongoDB |
| Chat dev | `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://localhost:11434`, `LLM_MODEL=qwen2.5:3b` |
| RAG dev | embedding/rerank base URL nếu bật `start-rag.ps1` |

---

### 7. Gaps hiện tại

- Tài liệu 2 máy còn cần chi tiết hóa thêm khi profile `ai` hoàn tất.
- Một số tuning connection pool/cache vẫn nằm trong code nhiều hơn tài liệu env.
- Remote AI host đã có script hỗ trợ (`start-remote-ai.ps1`) nhưng chưa có profile `ai` trong docker-compose.
