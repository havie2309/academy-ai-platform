# D4 — Local Dev Runbook

## 1. Mục tiêu

- Giúp dev mới chạy repo đúng với trạng thái hiện tại của codebase.
- Tránh nhầm giữa mode chạy hiện có và kiến trúc mục tiêu trong tương lai.

## 2. Current implementation

### 2.1. Điều kiện tiên quyết

- Docker Desktop
- Node.js LTS
- Python 3.12
- Ollama
- Git
- **Tesseract OCR** (kèm `vie` language pack) và **Poppler** — bắt buộc nếu chạy `document-processor` local và muốn OCR file scan.
  - Hướng dẫn cài đặt chi tiết xem trong `README.md` mục "Cài đặt Tesseract và Poppler".

### 2.2. Chuẩn bị môi trường

1. Clone repo.
2. Tạo `.env` từ `.env.example`.
3. Tạo `services/platform/.env` từ `services/platform/.env.example`.
4. Pull model Ollama dev nếu dùng chat local.

### 2.3. Hai mode chạy local đang tồn tại

#### Mode A — Khuyến nghị khi dev app local

Chạy **data services** bằng Docker, còn app/services chạy local.

```powershell
docker compose --profile code up -d postgres mongodb redis rabbitmq milvus etcd minio
./scripts/seed-iam.ps1
```

Sau đó:

- NestJS platform: chạy local bằng terminal riêng hoặc `.\scripts\start-platform-dev.ps1`
- Web UI: `cd services/web-ui; npm run dev`
- Python AI services: `.\scripts\start-rag.ps1`
- Ollama: chạy cục bộ theo `LLM_BASE_URL`

#### Mode B — Dùng `up-code.ps1` đúng trạng thái repo hiện tại

```powershell
./scripts/up-code.ps1
```

Mode này hiện chạy toàn bộ profile `code`, bao gồm cả **container `user-management`**.

Nếu dùng Mode B:

- Không chạy thêm `user-management` local trên cổng `3001` cùng lúc.
- Nếu thấy lỗi bind `3001`, nghĩa là local `user-management` chưa tắt hẳn.
- Có thể vẫn chạy local `api-gateway`, `chat`, `rbac`, `admin-config`, `audit`, `web-ui`, `rag-engine` và các Python service khác.

### 2.4. Thứ tự khởi động khuyến nghị

#### Lõi app hiện tại

1. Bật data services theo Mode A hoặc Mode B.
2. Seed IAM: `./scripts/seed-iam.ps1`
3. Chạy platform services local:
   - `.\scripts\start-platform-dev.ps1`
   - hoặc thủ công từng app NestJS
4. Chạy web-ui:
   - `cd services/web-ui`
   - `npm run dev`
5. Nếu cần RAG đầy đủ:
   - `.\scripts\start-rag.ps1`

### 2.5. Cổng dev cần nhớ

| Thành phần | Cổng / ghi chú |
|------------|----------------|
| `api-gateway` | `3000` |
| `user-management` | `3001` |
| `chat` | `3002` |
| `rbac` | `3003` |
| `admin-config` | `3004` |
| `audit` | `3005` |
| `rag-engine` | `8000` |
| `embedding-server` | `8001` |
| `rerank-server` | `8002` |
| `document-processor` | `8003` |
| `etl-sync` | `8004` |
| web-ui | Mặc định hiện tại trong `vite.config.ts` là `5174`, trừ khi override env |

### 2.6. Bước xác minh

- `./scripts/health.ps1`
- `./scripts/smoke-app.ps1`
- Đăng nhập bằng seed account
- Tạo/xóa chat session
- Nếu test RAG: upload tài liệu và hỏi lại nội dung đã index

### 2.7. Công cụ kiểm thử RAG

- `rag-cli.py` – chạy tương tác, tự động khởi động các container cần thiết (PostgreSQL, MongoDB, Milvus, Redis) và các service AI (embedding, rerank, rag-engine, Ollama).
- Logs được ghi vào `./rag_logs/`.

## 3. Target architecture

- Mục tiêu sau này vẫn là tách **máy nền tảng** và **máy mô hình**.
- `ai` profile và smoke cross-host là phần **planned**, chưa phải mode chuẩn đang có trong repo.
- Khi có profile/container chính thức cho máy mô hình, file này phải bổ sung thêm runbook riêng cho mode 2 máy.

## 4. Known gaps

| Gap | Tình trạng hiện tại |
|-----|---------------------|
| `ai` profile | Chưa có trong compose |
| Full app stack chạy hết bằng Docker | Chưa có |
| `user-management` compose vs local | Có nguy cơ đụng cổng nếu chạy đồng thời |
| Port web-ui trong tài liệu cũ | Một số chỗ còn ghi `5173`, nhưng Vite config hiện mặc định `5174` |

## 5. Lỗi thường gặp

| Triệu chứng | Hướng xử lý |
|------------|-------------|
| Cổng 3000/3001/3002 bị chiếm | Kiểm tra xem có đang chạy cùng lúc container và local process không |
| Chat lỗi 400/503 | Kiểm tra MongoDB, Ollama, `rag-engine` |
| Upload xong nhưng không index | Kiểm tra RabbitMQ, `document-processor`, Milvus |
| Citation trống | Kiểm tra sample docs đã ingest xong chưa |
| Refresh/login lỗi | Kiểm tra seed IAM, cookie config, và container/local mode đang dùng |
| `pdf2image` báo lỗi `Unable to get page count. Is poppler installed and in PATH?` | Poppler chưa được cài hoặc chưa có trong PATH. Tải poppler và thêm thư mục `bin` vào PATH, hoặc cài đặt trong code bằng `pdf2image.config.set_path_to_poppler()`. |
| `pytesseract` báo lỗi `TesseractNotFoundError` | Tesseract chưa được cài hoặc `tesseract.exe` chưa có trong PATH. Cài Tesseract và đảm bảo chọn gói `Vietnamese (vie)`. |

## 6. Quy tắc local branch

- Trước khi pull, commit hoặc stash thay đổi local.
- Khi code pull về đụng flow lớn, đọc lại `docs/INDEX.md`, `G2`, `G3` và các file `Check-tren` liên quan trước khi sửa tiếp.
- Không dùng local dev state làm chuẩn nếu chưa qua smoke tối thiểu.
