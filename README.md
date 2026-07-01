
# Academy AI Platform (PM2)

Kho dữ liệu tập trung và Cổng khai thác trợ lý ảo — on-premise, Qwen2.5-3B.

---

## Yêu cầu

- **Docker Desktop** — chạy Postgres, MongoDB, (tuỳ chọn) Milvus/Redis/RabbitMQ
- **Node.js LTS** (≥ 20) + npm — backend NestJS & frontend Vite
- **[Ollama](https://ollama.com/download)** — chạy LLM `qwen2.5:3b` local
- **Python 3.12** (chỉ cần cho RAG/embedding sau này)
- **Tesseract OCR & Poppler** (bắt buộc nếu chạy `document-processor` local để OCR file scan)
  - **Tesseract** (kèm gói tiếng Việt `vie`): [Hướng dẫn cài Windows](#cai-dat-tesseract-va-poppler)
  - **Poppler** (`pdf2image` dùng để chuyển PDF sang ảnh)
- **Git**

### Cài đặt Tesseract và Poppler (chỉ khi chạy document-processor local)

**Tesseract OCR**:
1. Tải installer: [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
2. Chạy file `.exe`, tại màn hình **Select Additional Languages** → chọn **Vietnamese (vie)**.
3. Thêm đường dẫn `Tesseract-OCR` vào biến môi trường `PATH` (hoặc để `pytesseract` tự tìm).

**Poppler** (cho `pdf2image`):
1. Tải bản mới nhất: [oschwartz10612/poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases)
2. Giải nén vào thư mục, ví dụ `C:\Users\<user>\AppData\Local\Programs\poppler-24.08.0\`
3. Thêm thư mục `bin` (ví dụ `C:\...\poppler-24.08.0\bin`) vào biến môi trường `PATH`.

---

## Chạy môi trường dev (1 máy) — từng bước

> Lệnh dưới đây dùng **PowerShell** trên Windows. Mở **nhiều terminal** vì backend gồm 3 service + frontend chạy song song.

### 1. Clone & cấu hình env

```powershell
git clone https://github.com/havie2309/academy-ai-platform.git
cd academy-ai-platform

# env cho stack docker (root)
cp .env.example .env

# env cho backend NestJS (Postgres/Mongo/JWT/LLM)
cp services/platform/.env.example services/platform/.env
```

Mặc định `services/platform/.env` đã trỏ LLM về Ollama local:

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5:3b
```

> Muốn dùng OpenAI cloud thay vì local: đổi `LLM_PROVIDER=openai` và điền `OPENAI_API_KEY`.

### 2. Cài model local (Ollama)

```powershell
# tải model (~2GB), chỉ cần 1 lần
ollama pull qwen2.5:3b

# kiểm tra Ollama đang chạy ở cổng 11434
curl.exe http://localhost:11434/api/tags
```

> Muốn lưu model vào thư mục repo `models/ollama`: đặt biến môi trường (User)
> `OLLAMA_MODELS = E:\ai-platform\models\ollama\models` rồi khởi động lại Ollama.
> Xem chi tiết tại [`models/README.md`](models/README.md).

### 3. Bật hạ tầng (Docker)

```powershell
# bật toàn bộ stack code-profile (postgres, mongodb, milvus, redis, rabbitmq...)
./scripts/up-code.ps1

# hoặc tối thiểu cho chat: chỉ cần Postgres + Mongo
docker compose --profile code up -d postgres mongodb
```

> Nếu `up-code.ps1` báo lỗi bind cổng `3001`, nghĩa là local `user-management`
> đang chạy sẵn trên máy. Dừng process đó hoặc quay về Mode A trong runbook.

Seed tài khoản đăng nhập (chạy 1 lần sau khi Postgres khoẻ):

```powershell
./scripts/seed-iam.ps1
# Ví dụ tài khoản: admin / BGD / p2_01 / 676156 / GV5976  —  mật khẩu: 123456
```

### 4. Chạy backend (NestJS monorepo — 3 terminal)

```powershell
cd services/platform
npm install   # lần đầu

# Terminal A — API Gateway (cổng 3000, proxy /api/* sang các service)
npm run start:dev api-gateway

# Terminal B — User Management / Auth (cổng 3001, cần Postgres)
npm run start:dev user-management

# Terminal C — Chat + RAG (cổng 3002, cần MongoDB + Ollama)
npm run start:dev chat
```

### 5. Chạy frontend (Vite + React)

```powershell
cd services/web-ui
npm install   # lần đầu
npm run dev   # mở http://localhost:5173
```

### 6. RAG pipeline (tùy chọn — để chat trích dẫn tài liệu đã upload)

```powershell
# Bật MongoDB + RabbitMQ + Milvus (Milvus cần etcd + minio)
docker compose --profile code up -d mongodb rabbitmq milvus etcd minio

# Khởi động 4 Python service (mở 4 cửa sổ riêng)
./scripts/start-rag.ps1
```

| Service | Cổng | Vai trò |
|---|---|---|
| embedding-server | 8001 | Vector hóa chunk (fastembed, 384 chiều dev) |
| rerank-server | 8002 | Cross-encoder rerank (chọn context top-k) |
| rag-engine | 8000 | Truy xuất chunk + filter phân quyền + rerank |
| document-processor | 8003 | Extract → chunk → embed → Milvus + Mongo |

Sau khi upload tài liệu (`.txt`, `.md`, `.pdf`) trên trang **Tài liệu**, badge **Đã index** xuất hiện khi ingest xong. Chat sẽ dùng citation thật từ kho tài liệu.

### 7. Truy cập

- Web UI: **http://localhost:5173**
- API Gateway: **http://localhost:3000** (frontend gọi `/api/*` qua proxy của Vite/Gateway)

Smoke test nhanh sau khi app đã chạy:

```powershell
./scripts/health.ps1
./scripts/smoke-app.ps1
```

---

## Bản đồ cổng (dev)

| Thành phần | Cổng | Ghi chú |
|---|---|---|
| Web UI (Vite) | 5173 | `npm run dev` trong `services/web-ui` |
| API Gateway | 3000 | proxy `/api/auth`, `/api/chat` |
| User Management / Auth | 3001 | cần Postgres |
| Chat + RAG | 3002 | cần MongoDB + Ollama (+ RAG services cho citation thật) |
| Ollama (LLM) | 11434 | `qwen2.5:3b` |
| embedding-server | 8001 | vector hóa chunk |
| rerank-server | 8002 | cross-encoder rerank |
| rag-engine | 8000 | retrieval + phân quyền + rerank |
| document-processor | 8003 | ingest pipeline |
| Postgres | 5433 | map ra `5432` trong container |
| MongoDB | 27017 | hội thoại & tin nhắn chat |

---

## Scripts

| Script | Mô tả |
|---|---|
| `./scripts/up-code.ps1` | Bật stack Docker (profile `code`) |
| `./scripts/down.ps1` | Tắt toàn bộ stack |
| `./scripts/logs.ps1` | Xem logs realtime |
| `./scripts/health.ps1` | Kiểm tra health HTTP của web-ui/gateway/user-management/chat/Ollama (`-IncludeDocker` để xem thêm `docker compose ps`) |
| `./scripts/seed-iam.ps1` | Seed tài khoản đăng nhập vào Postgres |
| `./scripts/smoke-app.ps1` | Smoke test end-to-end qua gateway: health, login, `/users/me`, chat session create/delete, logout |
| `./scripts/start-rag.ps1` | Khởi động embedding + rag-engine + document-processor |

---

## Khắc phục sự cố thường gặp

- **`EADDRINUSE` cổng 3000/3001/3002** — còn tiến trình cũ. Tìm & kill:
  ```powershell
  netstat -ano | Select-String ":3002"
  taskkill /PID <pid> /F
  ```
- **Chat trả lỗi 400/503** — kiểm tra MongoDB (`docker compose --profile code up -d mongodb`) và Ollama (`curl.exe http://localhost:11434/api/tags`) đang chạy.
- **`ollama` không nhận lệnh** — Ollama chưa có trong PATH hoặc server chưa khởi động; mở app Ollama hoặc chạy `ollama serve`.
- **Đăng nhập sai** — chạy lại `./scripts/seed-iam.ps1` (cần Postgres đang chạy).

---

## Cấu trúc repo

```
services/
  platform/           # NestJS: api-gateway, rbac, audit, ...
  rag-engine/         # Python: RAG engine
  embedding-server/   # Python: BGE-M3
  document-processor/ # Python: ingest pipeline
  etl-sync/           # Python: ETL
  web-ui/             # Vite + React (M6)
  llm-server/         # Ollama (M1)
libs/
  ai-clients/         # Client LLM/embedding/rerank
  schemas/            # Request/response schema
  prompts/            # Prompt template
  policies/           # Guardrail/policy
data/sample-docs/     # Tài liệu mẫu
eval/                 # Bộ eval
docs/                 # memory.md, plan.md, task list.md
```

---

## Topology

- **Hiện tại:** 1 máy Windows/Ubuntu, profile `code`
- **Nghiệm thu:** 2 máy — Máy nền tảng + Máy mô hình (Qwen2.5-3B)

Khi có Máy mô hình: cập nhật `.env`:
```env
LLM_BASE_URL=http://<IP_MAY_MO_HINH>:11434
EMBEDDING_BASE_URL=http://<IP_MAY_MO_HINH>:8001
```
