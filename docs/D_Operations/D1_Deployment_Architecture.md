# D1 — Deployment Architecture

## 1. Mục tiêu

- Mô tả đúng trạng thái triển khai hiện có của repo, không nhầm với kiến trúc mục tiêu.
- Tách rõ cái gì đã chạy được hôm nay và cái gì mới là hướng triển khai sau này.

## 2. Current implementation

### 2.1. Topology hiện tại của repo

- Luồng dev chính hiện đang xoay quanh **1 máy**.
- `api-gateway` là entrypoint cho client ở tầng ứng dụng.
- `docker-compose.yml` hiện chỉ có **profile `code`**.
- Profile `code` container hóa một **tập con** của hệ thống, không phải toàn bộ app stack.

### 2.2. Thành phần đang có trong `docker-compose.yml`

| Thành phần | Trạng thái hiện tại | Ghi chú |
|------------|---------------------|---------|
| Postgres | Có trong profile `code` | Volume + init scripts |
| MongoDB | Có trong profile `code` | Volume + init scripts |
| Milvus | Có trong profile `code` | Phụ thuộc `etcd` + `minio` |
| etcd | Có trong profile `code` | Phụ trợ cho Milvus |
| minio | Có trong profile `code` | Phụ trợ cho Milvus |
| Redis | Có trong profile `code` | Cache/session |
| RabbitMQ | Có trong profile `code` | Ingest queue |
| `user-management` | Có trong profile `code` | App service duy nhất đang được container hóa trong compose |

### 2.3. Thành phần hiện chưa được compose hóa trong repo

| Thành phần | Cách chạy hiện tại |
|------------|--------------------|
| `api-gateway` | Local NestJS process |
| `chat` | Local NestJS process |
| `rbac` | Local NestJS process |
| `admin-config` | Local NestJS process |
| `audit` | Local NestJS process |
| `web-ui` | Local Vite dev server |
| `rag-engine` | Local Python process |
| `document-processor` | Local Python process |
| `embedding-server` | Local Python process |
| `rerank-server` | Local Python process |
| `etl-sync` | Local Python process |
| Ollama | Runtime cục bộ bên ngoài compose, đi qua `LLM_BASE_URL` |

### 2.4. Ý nghĩa thực tế

- `./scripts/up-code.ps1` hiện chạy `docker compose --profile code up -d`, nên sẽ dựng cả **data services** và **container `user-management`**.
- Khi dev local bằng NestJS watch mode, team thường vẫn chạy `api-gateway`, `chat`, `rbac`, `admin-config`, `audit` từ terminal riêng.
- Vì vậy tài liệu triển khai cần coi đây là **mô hình lai**: một phần hạ tầng nằm trong compose, phần còn lại chạy local.

## 3. Target architecture

### 3.1. Mục tiêu kiến trúc

- Mục tiêu vẫn là **2 máy**:
  - **Máy nền tảng**: web-ui, NestJS services, `rag-engine`, `document-processor`, `etl-sync`, data stack
  - **Máy mô hình**: Ollama, `embedding-server`, `rerank-server`

### 3.2. Điều cần lưu ý

- `ai` profile là **mục tiêu/planned**, chưa có trong `docker-compose.yml` hiện tại.
- Khi nhắc đến 2 máy hoặc `ai` profile trong các tài liệu khác, phải gắn nhãn rõ là **target/planned**, không được mô tả như phần đã có sẵn trong repo.

## 4. Known gaps

| Gap | Tình trạng hiện tại |
|-----|---------------------|
| `ai` profile trong compose | Chưa có |
| Full compose cho toàn bộ app services | Chưa có |
| Smoke cross-host 2 máy | Chưa có evidence đóng |
| Hướng dẫn triển khai 2 máy chi tiết | Chưa hoàn tất |
| Tài liệu chạy local dễ đụng cổng 3001 | Có rủi ro nếu vừa chạy compose `user-management` vừa chạy local `user-management` |

## 5. Network và dữ liệu bền vững

- Client chỉ nên đi qua `api-gateway` và `web-ui`.
- `rag-engine`, `chat`, `document-processor` và các service AI hiện giao tiếp qua URL cấu hình.
- Data persistence hiện bám vào volume của Postgres, MongoDB, Milvus, Redis, RabbitMQ trong compose; file upload lưu ở thư mục local của repo/app runtime.

## 6. Kiểm tra sau triển khai

- `scripts/health.ps1`
- `scripts/smoke-app.ps1`
- Health riêng cho `rag-engine`, `embedding-server`, `rerank-server`, `etl-sync`
- Nếu kiểm tra RAG đầy đủ: upload -> ingest -> chat citation

## 7. Quy tắc cập nhật tài liệu này

- Nếu `docker-compose.yml` thêm service/profile mới, cập nhật ngay phần `Current implementation`.
- Nếu chỉ mới chốt thiết kế nhưng chưa có trong repo, ghi ở `Target architecture`, không đưa lên `Current implementation`.
