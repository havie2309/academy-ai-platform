# Kiến trúc hệ thống & triển khai — PM2 Kho dữ liệu tập trung & Cổng khai thác trợ lý ảo

---

## 1. Giới thiệu & định vị

- Tên: **Kho dữ liệu tập trung và Cổng khai thác trợ lý ảo (PM2)**.
- Hai bài toán: (1) tập trung/chuẩn hóa/khai thác dữ liệu đào tạo–khảo thí–KHCN–điều hành; (2) cổng trợ lý ảo truy vấn bằng ngôn ngữ tự nhiên có kiểm soát quyền và citation.
- Định vị: **công cụ hỗ trợ**, không thay thế thẩm quyền chuyên môn/phê duyệt/chấm điểm; mọi đầu ra AI phải được người dùng kiểm tra trước khi dùng chính thức.
- Quy mô: < 1.000 tài khoản, < 100 CCU; on-premise tuyệt đối trên mạng nội bộ; không phụ thuộc Internet khi chạy thực tế.

---

## 2. Quy tắc triển khai — chi tiết

### 2.1. Nguyên tắc thiết kế bắt buộc

1. **Full parity** theo yêu cầu nghiệp vụ — không cắt chức năng, chỉ triển khai theo phase.
2. **Model chính là Qwen3-8B** — mọi luồng AI phải tối ưu, benchmark và nghiệm thu với Qwen3-8B.
3. **OpenAI-compatible API** — mọi service AI giao tiếp qua HTTP API chuẩn hóa.
4. **On-premise first** — không có dependency Internet khi chạy runtime.
5. **Kiến trúc phân tầng** — giao diện / xử lý / dữ liệu tách biệt; platform **NestJS**, AI/pipeline **Python**, LLM **Ollama**.
6. **Cấu hình tách khỏi code** — endpoint, model name, prompt, policy, RBAC, secret đi qua file cấu hình + `admin-config`; secrets không commit vào repo.
7. **Bảo mật là mặc định** — RBAC, row-level filter, audit, SQL guardrail, metadata access filter là bắt buộc.
8. **Tái lập được** — Docker Compose dev/test; topology chuẩn **2 máy** (Máy nền tảng + Máy mô hình).

---

## 3. Kiến trúc hệ thống — chi tiết

### 3.1. Mô hình hạ tầng

**Logic (3 tầng)** — không đổi theo số máy vật lý:

```text
Client Segment
  └─ Trình duyệt người dùng nội bộ → HTTPS / API Gateway
Server Segment
  ├─ Tầng giao diện     : web-ui (Vite + React)
  ├─ Tầng xử lý         : NestJS (gateway, admin, IAM, audit, workflow, notification)
  │                       Python (rag-engine, document-processor, etl-sync)
  │                       (+ llm-server Ollama, embedding-server qua HTTP nội bộ)
  └─ Tầng dữ liệu       : Postgres 16, MongoDB, Milvus, Redis, RabbitMQ, File Storage
```

**Vật lý dev/test (2 máy)** — **Máy nền tảng** (máy code chính) + **Máy mô hình** (build/serving AI).

```text
[Máy nền tảng]                     HTTP nội bộ              [Máy mô hình]
 web-ui, NestJS platform, ──► LLM / Embedding / Rerank ◄──  llm-server (Ollama, Qwen3-8B)
 rag-engine, doc-processor,       (OpenAI-compatible)        embedding-server (Python, BGE-M3)
 etl-sync                                                      rerank (tùy chọn)
 Postgres, Mongo, Milvus,
 Redis, RabbitMQ, File Storage
```

### 3.2. Phân stack (đã chốt)

| Stack | Service / module |
| ----- | ---------------- |
| **NestJS** | `api-gateway`, `admin-config`, `user-management`, `audit`, `rbac`, `workflow`, `notification` |
| **Python 3.12** | `rag-engine`, `embedding-server`, `document-processor`, `etl-sync` |
| **Ollama** | `llm-server` (Qwen3-8B, OpenAI-compatible API) |
| **Vite + React** | `web-ui` |

NestJS chạy trên **Máy nền tảng** (monorepo `services/platform/`); `api-gateway` là điểm vào HTTPS duy nhất, gọi nội bộ các module còn lại.

### 3.3. Service — công nghệ & trách nhiệm chi tiết

| Service | Stack | Trách nhiệm |
| ------- | ----- | ----------- |
| `web-ui` | Vite + React | Chat, citation, upload, dashboard, self-service; route theo role |
| `api-gateway` | NestJS | Routing, JWT, throttling, proxy tới Python AI & module Nest nội bộ; **điểm vào duy nhất từ client** |
| `user-management` | NestJS | IAM: user, profile, đơn vị, gán role |
| `rbac` | NestJS | Permission matrix, row-level policy, inject `access_scope` |
| `audit` | NestJS | Audit log immutable: chat, SQL, upload, config, ETL |
| `admin-config` | NestJS | Prompt, temperature, rerank weight, policy, blacklist/safe refusal — có version |
| `workflow` | NestJS | Luồng phê duyệt / trạng thái nghiệp vụ (nếu có) |
| `notification` | NestJS | Thông báo in-app, hook sự kiện từ RabbitMQ |
| `rag-engine` | Python | Router `rag/sql/reject/task-assist`, retrieval, rerank, grounding, citation, SQL orchestration |
| `embedding-server` | Python + BGE-M3 | Embedding 1024 chiều cho query/chunk |
| `document-processor` | Python worker | OCR/extract/chunk/embed qua RabbitMQ; ghi Mongo + Milvus |
| `etl-sync` | Python worker | Batch/event/manual sync; transform; load Postgres/Mongo; lineage |
| `llm-server` | **Ollama** | Sinh text Qwen3-8B qua OpenAI-compatible API |


### 3.4. Giao tiếp liên service

- Đồng bộ: REST / OpenAI-compatible HTTP API.
- **Cross-host (Máy nền tảng → Máy mô hình):** `rag-engine`, `document-processor`, `libs/ai-clients` gọi `LLM_BASE_URL`, `EMBEDDING_BASE_URL`, `RERANK_BASE_URL` qua mạng nội bộ — không bind localhost khi chạy 2 máy.
- Bất đồng bộ: AMQP qua RabbitMQ (chỉ trên Máy nền tảng).
- Cache/context: Redis. Truy vấn dữ liệu: Postgres, MongoDB, Milvus (Máy nền tảng).

### 3.5. Luồng xử lý chuẩn — chi tiết

Hai cột **Máy nền tảng** / **Máy mô hình** — bước nào để trống = không tham gia. Gọi giữa hai máy qua HTTP nội bộ.

#### Chat / RAG


| Bước | Máy nền tảng                                                             | Máy mô hình                                                                     |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1    | User → `api-gateway`: xác thực, gắn `role` / `don_vi` / `muc_mat_toi_da` |                                                                                 |
| 2    | `rag-engine`: phân loại ý định                                           |                                                                                 |
| 3    | Milvus search (filter quyền) → MongoDB lấy chunk/source                  | `embedding-server` embed query → `rerank` → `llm-server` sinh đáp án + citation |
| 4    | `api-gateway`: audit, trả kết quả                                        |                                                                                 |


#### Text-to-SQL


| Bước | Máy nền tảng                                | Máy mô hình                                    |
| ---- | ------------------------------------------- | ---------------------------------------------- |
| 1    | `rag-engine`: chọn nhánh SQL                |                                                |
| 2    |                                             | `llm-server`: sinh SQL từ curated schema/views |
| 3    | SQL guardrail → thực thi Postgres read-only |                                                |
| 4    | Format kết quả, audit → UI                  |                                                |


#### Document ingest


| Bước | Máy nền tảng                                   | Máy mô hình                     |
| ---- | ---------------------------------------------- | ------------------------------- |
| 1    | Upload UI/Gateway → job RabbitMQ               |                                 |
| 2    | `document-processor`: OCR / extract / chunk    | `embedding-server`: embed chunk |
| 3    | MongoDB + Milvus: lưu catalog / chunk / vector |                                 |
| 4    | Cập nhật trạng thái ingest                     |                                 |


### 3.6. Màn hình bắt buộc (UI)


| Nhóm              | Nội dung                                                   |
| ----------------- | ---------------------------------------------------------- |
| User chat         | Chat streaming, citation click-through, source preview     |
| User self-service | Bảng điểm, lịch học, lịch thi, đăng ký học, thông báo      |
| Doc workspace     | Upload, trạng thái ingest, tra cứu tài liệu                |
| Quiz & summary    | Sinh quiz, làm quiz, xem đáp án, tóm tắt tài liệu          |
| Admin dashboard   | Health, latency, queue depth, ETL trạng thái, GPU          |
| Admin audit       | Audit log, SQL audit, policy event                         |
| Admin config      | Prompt, temperature, rerank weight, blacklist/safe refusal |


### 3.7. API & contract bắt buộc

**Contract chat có citation**

```json
{
  "request": { "session_id": "string", "message": "string", "attachments": ["doc_id?"] },
  "response": {
    "route": "rag|sql|reject|task_assist",
    "answer": "string",
    "citations": [{ "doc_id": "string", "chunk_id": "string", "title": "string", "page": 1, "snippet": "string" }],
    "sql_result": null,
    "rejected_reason": null
  }
}
```

**Contract ingest tài liệu**

```json
{
  "request": {
    "file_name": "string",
    "doc_type": "pdf|docx|pptx|xlsx|txt",
    "don_vi": "string",
    "muc_mat": "public|internal|restricted|confidential",
    "source_system": "manual_upload|etl|library|training"
  },
  "response": { "doc_id": "string", "ingest_job_id": "string", "status": "queued|processing|completed|failed" }
}
```

**Schema metadata tài liệu/chunk**

- `tai_lieu`: `doc_id`, `title`, `doc_type`, `source_system`, `don_vi`, `muc_mat`, `status`, `file_path`, `version`, `created_at`, `updated_at`.
- `chunk`: `chunk_id`, `doc_id`, `text`, `page`, `section_path`, `don_vi`, `muc_mat`, `embedding_ref`, `created_at`.

**Schema audit log**
`audit_id`, `user_id`, `role`, `action_type` (`chat/sql/upload/config_change/etl_run/...`), `input_payload`, `route`, `sql_generated`, `citations`, `result_status` (`success/blocked/error`), `created_at`.

**Schema ETL job**
`etl_job_id`, `source_system`, `sync_mode` (`batch/event/manual`), `source_range`, `status` (`queued/running/completed/failed`), `record_in`/`record_out`, `error_summary`, `lineage_ref`.

---

## 4. Mô hình dữ liệu — chi tiết

### 4.1. Vai trò từng kho


| Kho          | Vai trò đã chốt                                                          |
| ------------ | ------------------------------------------------------------------------ |
| Postgres 16  | CSDL master: dữ liệu quan hệ, user, role, audit, ETL, cấu hình nghiệp vụ |
| MongoDB 7    | Metadata Catalog: tài liệu, chunk, pipeline status, flexible metadata    |
| Milvus ≥ 2.4 | Chỉ mục vector: semantic search + filtered retrieval                     |
| Redis        | Session, cache, hội thoại, state tạm                                     |
| RabbitMQ     | Hàng đợi ingest, ETL, job nền                                            |
| File Storage | Bản gốc tài liệu, versioning, lưu trữ lâu dài                            |


### 4.2. Loại dữ liệu chính


| Nhóm                | Mô tả                                                          | Nơi lưu                |
| ------------------- | -------------------------------------------------------------- | ---------------------- |
| Có cấu trúc         | Học viên, lớp, môn học, điểm, khảo thí, KHCN, user, audit, ETL | Postgres 16            |
| Phi cấu trúc        | PDF/DOCX/PPTX/XLSX/TXT, luận văn, giáo trình, quy chế          | File Storage + MongoDB |
| Chỉ mục ngữ nghĩa   | Embedding 1024 chiều + metadata lọc quyền                      | Milvus                 |
| Phiên & cache       | Session chat, context, token cache, queue status tạm           | Redis                  |
| Message bất đồng bộ | Ingest, ETL, job nền, thông báo                                | RabbitMQ               |


### 4.3. Mô hình dữ liệu logic


| Miền        | Thực thể chính                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM         | `users`, `roles`, `permissions`, `user_role_map`, `access_scope`                                                                                               |
| Audit       | `audit_logs`, `sql_audit`, `policy_events`, `prompt_change_log`                                                                                                |
| Đào tạo     | `hoc_vien`, `giang_vien`, `lop`, `mon_hoc`, `chuong_trinh_dao_tao`, `ke_hoach_giang_day`, `diem`, `hoc_bong`, `canh_cao`, `luan_van`, `tot_nghiep`, `van_bang` |
| Khảo thí    | `de_thi`, `dap_an`, `pho_diem`, `khao_sat`, `thi_tuyen_sinh`, `tu_danh_gia_ctdt`                                                                               |
| KHCN        | `ly_lich_khoa_hoc`, `de_tai_nckh`, `giao_trinh`, `bao_tap_chi`, `danh_muc_khcn`                                                                                |
| Thư viện    | `sach_tai_lieu`, `muon_tra`, `the_ban_doc`                                                                                                                     |
| Tài liệu AI | `tai_lieu`, `chunk`, `embedding_ref`, `ingest_job`, `ocr_result`, `doc_access_policy`                                                                          |
| ETL         | `etl_job`, `etl_run`, `etl_source`, `etl_lineage`, `etl_error_log`                                                                                             |


### 4.4. Chính sách dữ liệu

- Mọi bản ghi/chunk phải có `don_vi`, `muc_mat`, `source_system`, `source_id`.
- Text-to-SQL chỉ truy vấn qua tài khoản read-only và schema/view cho phép.
- LLM chỉ nhận context đã lọc quyền ở tầng ứng dụng.

---

## 5. Kiến trúc triển khai — chi tiết

### 5.1. Đóng gói

Docker + Docker Compose cho dev/test. Cấu hình tách khỏi code; secrets không commit.

### 5.2. Dev/Test — topology 2 máy (chuẩn)

> **Máy nền tảng** — máy code chính: phát triển ứng dụng, API, UI, pipeline dữ liệu, toàn bộ kho DB.  
> **Máy mô hình** — máy build và serving model AI (LLM, embedding, rerank).  
> Compose profile: `code` = Máy nền tảng · `ai` = Máy mô hình.


| Máy              | Vai trò                                         | Service / thành phần                                                                                                                              |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Máy nền tảng** | Máy code chính — app, API, UI, pipeline dữ liệu | `web-ui`; NestJS (`api-gateway`, `admin-config`, `user-management`, `audit`, `rbac`, `workflow`, `notification`); Python (`rag-engine`, `document-processor`, `etl-sync`); Postgres, MongoDB, Milvus, Redis, RabbitMQ, File Storage |
| **Máy mô hình**  | Build & serving model AI                        | `llm-server` (**Ollama**, Qwen3-8B), `embedding-server` (Python, BGE-M3), rerank (tùy chọn); GPU khuyến nghị |


**Compose:** `docker-compose.yml` + profile `code` / `ai`. Cùng repo; mỗi máy chạy profile tương ứng.

**Biến môi trường (Máy nền tảng → Máy mô hình):**


| Biến                 | Ví dụ                          | Dùng bởi                           |
| -------------------- | ------------------------------ | ---------------------------------- |
| `LLM_BASE_URL`       | `http://<host-model>:11434/v1` | `rag-engine`, `libs/ai-clients`    |
| `EMBEDDING_BASE_URL` | `http://<host-model>:8081/v1`  | `rag-engine`, `document-processor` |
| `RERANK_BASE_URL`    | `http://<host-model>:8082`     | `rag-engine`                       |


**DoD triển khai:** mỗi máy mới dựng được từ README; smoke test pass **intra-host** và **Máy nền tảng → Máy mô hình** (embed + chat completion).

> *Gộp 1 máy (dev local):* chạy cả hai profile trên một host — chỉ để thử nhanh, không thay topology chuẩn.

### 5.3. Production

- Kiến trúc 3 tầng (Client/Server); model chính = `Qwen3-8B`; frontend = Vite + React.
- TLS nội bộ giữa các tầng; API Gateway là điểm vào duy nhất.

### 5.4. Stack & phiên bản đã chốt


| Thành phần       | Lựa chọn                                                            |
| ---------------- | ------------------------------------------------------------------- |
| LLM serving      | **Ollama** (`llm-server`)                                           |
| LLM model (dev)  | **`qwen2.5:3b`** — 1 máy ~16 GB RAM (`LLM_MODEL` trong `.env`)      |
| LLM model (nghiệm thu) | **Qwen3-8B** — Máy mô hình riêng                              |
| Platform API     | **NestJS** + TypeScript                                             |
| AI / data workers | **Python 3.12** (`rag-engine`, `embedding-server`, `document-processor`, `etl-sync`) |
| Embedding        | BGE-M3                                                              |
| Rerank           | bge-reranker / cross-encoder tương đương                            |
| Frontend         | Vite + React + React Router                                         |
| Relational DB    | Postgres 16                                                         |
| Metadata catalog | MongoDB 7                                                           |
| Vector DB        | Milvus ≥ 2.4                                                        |
| Cache/session    | Redis                                                               |
| Queue            | RabbitMQ                                                            |
| OCR/extraction   | MinerU + PaddleOCR + PyMuPDF + python-docx + python-pptx + openpyxl |
| Packaging        | Docker + Docker Compose                                             |


### 5.5. Cấu trúc repo

```text
pm2/
├── docker-compose.yml · .env.example · README.md
├── infra/        (postgres, mongo, milvus, redis, rabbitmq)
├── services/
│   ├── web-ui/
│   ├── platform/     (NestJS: api-gateway, admin-config, user-management,
│   │                  audit, rbac, workflow, notification)
│   ├── rag-engine/   (Python)
│   ├── embedding-server/ (Python)
│   ├── document-processor/ (Python)
│   ├── etl-sync/     (Python)
│   └── llm-server/   (Ollama)
├── libs/         (python: ai-clients, schemas, prompts, policies)
├── data/         (seed, sample-docs, fixtures)
├── eval/         (rag, sql, security, uat)
└── docs/         (memory.md, task list.md, plan.md)
```

---

## 6. Bảo mật, RBAC, audit, ETL — chi tiết

### 6.1. Bảo mật

- On-premise tuyệt đối, không gọi Internet runtime.
- API Gateway là điểm vào duy nhất từ client; TLS nội bộ giữa các tầng ở production.
- Secrets không commit vào repo.

### 6.2. Role model & access level


| Vai trò                   | Quyền / access mặc định                          |
| ------------------------- | ------------------------------------------------ |
| `Admin`                   | Toàn quyền quản trị: cấu hình, audit, ETL, IAM   |
| `BGD`                     | Báo cáo & dữ liệu tổng hợp cấp cao               |
| `P2`                      | Đào tạo, chương trình, học viên, thống kê        |
| `P7`                      | Khảo thí, đề thi, phổ điểm, tuyển sinh           |
| `GiangVien`               | Học liệu, quiz, giáo án, NCKH theo đơn vị        |
| `HocVien` / `SinhVien`    | Self-service theo chính chủ + học liệu được phép |
| `CanBo` / `NghienCuuVien` | Theo phạm vi công tác                            |



| Mức mật        | Ý nghĩa             |
| -------------- | ------------------- |
| `public`       | Công khai nội bộ    |
| `internal`     | Nội bộ đơn vị       |
| `restricted`   | Hạn chế             |
| `confidential` | Mật / cần quyền cao |


### 6.3. Audit

- Ghi: ai, khi nào, hỏi gì, truy xuất gì, SQL gì, kết quả gì, branch xử lý nào.
- Phải truy ngược được từ câu trả lời AI → tài liệu → chunk → pipeline → người dùng.

### 6.4. ETL

- 3 cơ chế: Batch Sync, Event-driven Sync, Upload thủ công.
- Mọi run phải có lineage và trạng thái đồng bộ.

### 6.5. SQL guardrail (Text-to-SQL)

- Chỉ cho phép `SELECT`, đúng 1 statement, bắt buộc `LIMIT`.
- Chặn `;`, DDL, DML, transaction control, comment injection, function nguy hiểm.
- Timeout mặc định 10 giây; chỉ thực thi qua account read-only.
- Chỉ truy cập curated views, không truy cập raw tables khi không cần thiết.

---

## 7. Danh mục chức năng & use case

### 7.1. Nhóm chức năng cấp module


| Nhóm                | Nội dung                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Đào tạo             | Hồ sơ HV/GV, CTĐT, kế hoạch HL/GD, điểm, học bổng/cảnh cáo, luận văn/đồ án, tốt nghiệp, văn bằng                       |
| Khảo thí & ĐBCL     | Đề thi, đáp án, phổ điểm, bảo mật đề thi, khảo sát, thi tuyển sinh, tự đánh giá CTĐT                                   |
| KHCN                | Lý lịch KH, đề tài NCKH, giáo trình, báo/tạp chí/danh mục KHCN                                                         |
| Thư viện            | Sách/tài liệu, mượn trả, thẻ bạn đọc                                                                                   |
| Tự phục vụ HV/SV    | Thông báo, chương trình, bảng điểm, TKB, lịch thi, đăng ký học/lại/thi lại                                             |
| GenAI/RAG           | Multi-turn RAG, Text-to-SQL, tóm tắt tài liệu mật, OCR, từ chối an toàn                                                |
| Tương tác đa chiều  | Tóm tắt, bài tập, quiz, tiến trình học, soạn giáo án, phân tích, báo cáo, tìm kiếm, chatbot cá nhân, quản lý tài khoản |
| Quản trị & Hệ thống | RBAC/row-level, ETL, audit, cấu hình AI                                                                                |


### 7.2. Use case chuẩn


| ID       | Tên                             | Ghi nhớ triển khai                  |
| -------- | ------------------------------- | ----------------------------------- |
| UC-DT-01 | Truy vấn lịch trình giảng dạy   | RAG + SQL                           |
| UC-DT-02 | Truy vấn tài liệu học tập       | RAG + tóm tắt + citation            |
| UC-DT-03 | Quản lý khung chương trình      | CRUD + quyền P2                     |
| UC-DT-04 | Phân tích kết quả học tập       | SQL/report + UI                     |
| UC-KT-01 | Truy xuất ngân hàng câu hỏi     | Search + metadata filter            |
| UC-KT-02 | Phân tích phổ điểm              | SQL/report + dashboard              |
| UC-KT-03 | Kiểm tra bảo mật đề thi         | Audit + truy vết log                |
| UC-KT-04 | Hỗ trợ tạo đề cương ôn tập      | RAG + generation                    |
| UC-KH-01 | Truy vấn đề tài NCKH            | Search + tổng hợp                   |
| UC-KH-02 | Tóm tắt luận văn/luận án        | OCR/extract + summarize             |
| UC-KH-03 | Thống kê số lượng bài báo       | SQL/report                          |
| UC-KH-04 | Gợi ý hướng nghiên cứu          | RAG + phân tích xu hướng            |
| UC-AI-01 | Hỏi đáp đa miền                 | Router + multi-turn                 |
| UC-AI-02 | Text-to-SQL                     | Guardrail chặt, read-only           |
| UC-AI-03 | Tóm tắt tài liệu mật            | On-premise                          |
| UC-AI-04 | Trích xuất OCR                  | MinerU + PaddleOCR                  |
| UC-AI-05 | Phản hồi từ chối an toàn        | Policy + classifier                 |
| UC-QT-01 | Quản lý người dùng & phân quyền | RBAC + row-level                    |
| UC-QT-02 | Đồng bộ dữ liệu ETL             | Batch/event/manual                  |
| UC-QT-03 | Audit log toàn hệ thống         | Immutable, truy vết đủ              |
| UC-QT-04 | Cấu hình tham số AI             | Prompt, temperature, rerank, policy |


---

## 8. Chất lượng & eval


| Nhóm chỉ số      | Ngưỡng mục tiêu                                   |
| ---------------- | ------------------------------------------------- |
| Healthcheck      | 100% service có endpoint health                   |
| RAG latency p95  | Theo baseline đo với Qwen3-8B, đủ dùng nội bộ     |
| SQL latency p95  | Trong ngưỡng chấp nhận, không vượt timeout        |
| Citation quality | Mỗi câu RAG có citation truy ngược được           |
| SQL safety       | 100% câu DDL/DML/multi-statement bị chặn          |
| RBAC correctness | 100% test quyền pass                              |
| ETL lineage      | 100% run có source lineage                        |
| OCR quality      | Bộ kiểm chuẩn ingest không vỡ cấu trúc quan trọng |


Bộ eval bắt buộc: RAG eval · SQL eval · Security/red-team eval · OCR/doc ingest eval · UAT theo module.

---

## 9. Risk

### 9.1. Rủi ro & giảm thiểu


| Rủi ro                          | Mức        | Giảm thiểu                                           |
| ------------------------------- | ---------- | ---------------------------------------------------- |
| Qwen3-8B yếu ở câu phức tạp/SQL | Trung bình | Tăng grounding, rerank, view curation, eval liên tục |
| Full parity tạo backlog lớn     | Cao        | Chia phase rõ, giữ traceability, không scope mờ      |
| Dữ liệu đa nguồn thiếu chuẩn    | Cao        | ETL transform + lineage + audit                      |
| OCR sai tài liệu phức tạp       | Trung bình | Fallback extractor + manual review bucket            |
| SQL sinh sai/nguy hiểm          | Cao        | Guardrail nhiều lớp + read-only + SQL audit          |
| Rò rỉ do sai filter quyền       | Rất cao    | Access filter trước retrieval và trước SQL execution |


### 9.2. Giả định

- Bộ tài liệu dev này là chuẩn làm việc nội bộ cho dev/PM/AI/data.

