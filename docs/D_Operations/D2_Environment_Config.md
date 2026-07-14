# D2 - Environment Config

## 1. Muc tieu

- Tach cau hinh khoi code.
- Biet bien nao thuoc root stack, bien nao thuoc platform, bien nao thuoc AI.
- Giam loi "chay local duoc nhung khong tai lap duoc".

## 2. File cau hinh chuan

| File | Vai tro |
|------|---------|
| `.env.example` | Cau hinh root cho docker/data stack |
| `.env` | Ban local thuc thi, khong commit |
| `services/platform/.env.example` | Cau hinh platform/chat/rag bridge/auth |
| `services/platform/.env` | Ban local cua NestJS monorepo |

## 3. Nhom bien chinh

### Ha tang

- `POSTGRES_*`
- `MONGO_*`
- `REDIS_*`
- `RABBITMQ_*`
- `MILVUS_*`

### Auth va session

- `JWT_*`
- `REFRESH_*` hoac session TTL tuong duong
- cookie config

### AI routing

- `LLM_PROVIDER`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `EMBEDDING_BASE_URL`
- `RERANK_BASE_URL`

### Chat va RAG

- cache TTL
- session context TTL
- `RETRIEVAL_TOP_K=20` (mặc định trước đây 30)
- `RERANK_TOP_K=6` (trước đây 8)
- `RERANK_SCORE_MIN` – đã giảm từ -8 xuống -2 để áp dụng tighter filtering (cùng với `RERANK_SCORE_DELTA`).
- `MAX_CHUNKS_PER_DOC=3`
- `RERANK_DOC_MAX_CHARS=1800`: giới hạn độ dài mỗi candidate trước khi gọi rerank
- `RAG_CONTEXT_MAX_CHARS=1800` (trước đây 6000) – giảm để tăng tốc generation và cải thiện first-token latency
- refusal policy fetch key

### Guardrail

- `GUARDRAIL_SEMANTIC_THRESHOLD` – mặc định 0.88 (được đặt trong code, có thể ghi đè qua env).
- `GUARDRAIL_FUZZY_ENABLED` – vẫn giữ true.
- `GUARDRAIL_HEURISTIC_POLICY_ENABLED` – true.
- `GUARDRAIL_LLM_ENABLED` – false.

### SQL route

- `SQL_READONLY_*`
- catalog/config cho curated schema

### API Gateway - Resilience

| Bien | Mac dinh | Mo ta |
|------|----------|-------|
| `RATE_LIMIT_AUTH` | `60` | So request toi da moi phut cho nguoi dung da dang nhap khi khong co policy role rieng |
| `RATE_LIMIT_ANON` | `10` | So request toi da moi phut cho nguoi dung chua dang nhap |
| `RATE_LIMIT_WINDOW` | `60` | Time window (giay) cua Redis bucket rate-limit |
| `RATE_LIMIT_ROLE_ADMIN` | `180` | Gioi han/phut cho `ADMIN`; gateway uu tien policy role theo thu tu role |
| `RATE_LIMIT_ROLE_BGD` | `180` | Gioi han/phut cho `BGD` |
| `RATE_LIMIT_ROLE_P2` | `120` | Gioi han/phut cho `P2` |
| `RATE_LIMIT_ROLE_P7` | `90` | Gioi han/phut cho `P7` |
| `RATE_LIMIT_ROLE_GIANG_VIEN` | `90` | Gioi han/phut cho `GIANG_VIEN` |
| `RATE_LIMIT_ROLE_HOC_VIEN` | `60` | Gioi han/phut cho `HOC_VIEN` |
| `LOAD_SHEDDING_MAX_CONCURRENT` | `100` | So request dong thoi toi da truoc khi gateway tu choi voi ma `503` |
| `LOAD_SHEDDING_RETRY_AFTER` | `1` | Gia tri `Retry-After` (giay) tra ve khi load shedding `503` |
| `CIRCUIT_FAILURE_THRESHOLD_<service>` | `5` | So lan that bai de mo circuit cho moi upstream, vi du `CIRCUIT_FAILURE_THRESHOLD_CHAT` |
| `CIRCUIT_TIMEOUT_<service>` | `30` | So giay circuit giu trang thai `OPEN` truoc khi chuyen sang `HALF_OPEN` |
| `CIRCUIT_HALFOPEN_MAX_<service>` | `1` | So request toi da duoc phep o trang thai `HALF_OPEN` cho moi upstream |

Cac bien nay duoc `api-gateway` su dung de bao ve upstream khoi qua tai va loi lan truyen.

### Summarization (J-01)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SUMMARY_MAX_CHARS` | `1500` | Số ký tự tối đa lấy từ tài liệu để tóm tắt |
| `SUMMARY_LLM_PROVIDER` | `ollama` | Provider cho tóm tắt (ollama/openai) |
| `SUMMARY_LLM_BASE_URL` | `http://localhost:11434` | Endpoint cho tóm tắt |
| `SUMMARY_LLM_MODEL` | `qwen2.5:3b` | Model cho tóm tắt |
| `SUMMARY_LLM_FALLBACK_PROVIDER` | - | Fallback provider (tùy chọn) |
| `SUMMARY_LLM_FALLBACK_BASE_URL` | - | Fallback endpoint (tùy chọn) |
| `SUMMARY_LLM_FALLBACK_MODEL` | - | Fallback model (tùy chọn) |
| `SUMMARY_LLM_RETRY_ATTEMPTS` | `2` | Số lần thử lại khi lỗi |
| `SUMMARY_LLM_TIMEOUT` | `60` | Timeout (giây) cho tóm tắt |

## 4. Quy tac quan ly secret

- Khong commit `.env` that.
- API key noi bo va mat khau DB phai thay duoc theo moi truong.
- Internal key cho `admin-config` khong duoc lo ra client.
- Neu can chia se local env giua team, dung template da lam sach secret.

## 5. Quy tac thay doi config

- Them bien moi phai cap nhat `.env.example` tuong ung.
- Neu bien anh huong flow nghiep vu hoac topology, cap nhat them `D1` hoac `D4`.
- Neu bien dung chung giua platform va Python service, can ghi ro owner va default.

## 6. Cau hinh toi thieu de chay local

| Nhom | Toi thieu |
|------|-----------|
| Auth | JWT secret, cookie settings |
| Data | Postgres, MongoDB |
| Chat dev | `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://localhost:11434`, `LLM_MODEL=qwen2.5:3b` |
| RAG dev | embedding/rerank base URL neu bat `start-rag.ps1` |

## 7. Gaps hien tai

- Tai lieu 2 may con can chi tiet hoa them khi profile `ai` hoan tat.
- Mot so tuning connection pool/cache van nam trong code nhieu hon tai lieu env.
