# B7 — Sequence Diagrams

## 1. Mục đích

- Ghi lại các luồng liên service quan trọng để review trước khi đổi flow.
- Tách rõ **Current implementation** và **Target architecture** để tránh nhầm luồng planned là luồng đã có trong repo.

## 2. Current implementation

### 2.1. Login + refresh token + logout

```mermaid
sequenceDiagram
    actor User
    participant UI as web-ui
    participant GW as api-gateway
    participant UM as user-management
    participant PG as Postgres

    User->>UI: Nhập username/password
    UI->>GW: POST /api/auth/login
    GW->>UM: Forward login request
    UM->>PG: Verify user + ghi user_sessions/login_logs
    UM-->>GW: access token + Set-Cookie refresh token
    GW-->>UI: Login success

    UI->>GW: POST /api/auth/refresh (cookie)
    GW->>UM: Forward refresh request
    UM->>PG: Verify session + rotate refresh token
    UM-->>GW: access token mới + refresh cookie mới
    GW-->>UI: Refresh success

    UI->>GW: POST /api/auth/logout
    GW->>UM: Forward logout request
    UM->>PG: Revoke current session
    UM-->>GW: Logout success
    GW-->>UI: Logged out
```

- Happy path: login -> refresh -> logout đi trọn qua gateway và `user-management`.
- Security/audit checkpoint: session lưu ở Postgres; refresh token rotate/revoke.
- Failure/fallback note: sai credential hoặc session hết hạn -> `401`; không có fallback im lặng.

### 2.2. Chat RAG với citation

```mermaid
sequenceDiagram
    actor User
    participant UI as web-ui
    participant GW as api-gateway
    participant Chat as chat (NestJS)
    participant RAG as rag-engine
    participant Access as Access Filter
    participant Embed as embedding-server
    participant Milvus as Milvus
    participant Mongo as MongoDB
    participant Rerank as rerank-server
    participant Ollama as Ollama

    User->>UI: Nhập câu hỏi
    UI->>GW: POST /chat/:sessionId/messages
    GW->>Chat: Forward + JWT + scope (ma_hv, ma_gv, roles)
    
    Chat->>RAG: POST /v1/chat (query, sessionId, user)
    
    RAG->>RAG: Safe refusal check
    
    alt Safe refusal
        RAG-->>Chat: route: refusal
    else RAG flow
        RAG->>Access: Resolve permitted docIds from Mongo
        Note over Access: Filter by securityLevel, scopeType,<br/>role/department/owner/custom
        
        RAG->>Embed: Embed query
        Embed-->>RAG: Query vector
        
        RAG->>Milvus: Search with expr: "document_id in [...]"
        Milvus-->>RAG: Candidate chunks (pre-filtered)
        
        RAG->>Mongo: Fetch chunk metadata
        RAG->>RAG: can_view_chunk() defense-in-depth
        RAG->>Rerank: Rerank candidates
        Rerank-->>RAG: Ranked chunks
        
        RAG->>RAG: Build Markdown context
        RAG->>Ollama: Generate grounded answer
        Ollama-->>RAG: Answer + used_chunk_ids
        
        RAG->>RAG: Map chunks → document citations
        RAG-->>Chat: Answer + citations
    end
```

- Happy path: query đi qua embed -> vector search -> Mongo filter -> rerank -> generate -> citation.
- Security/audit checkpoint: scope người dùng phải theo xuyên suốt từ gateway tới `rag-engine`.
- Failure/fallback note: nếu `rag-engine` unreachable trước khi stream, `chat` có thể fallback một phần; nếu policy chặn -> route `refusal`.

### 2.3. Document upload + ingest + indexing

```mermaid
sequenceDiagram
    actor User
    participant UI as web-ui
    participant GW as api-gateway
    participant DOCAPI as chat/documents
    participant MQ as RabbitMQ
    participant DOC as document-processor
    participant EMB as embedding-server
    participant MG as MongoDB
    participant MV as Milvus

    User->>UI: Chọn file + metadata bảo mật
    UI->>GW: POST /api/documents (multipart)
    GW->>DOCAPI: Verify JWT + forward upload
    DOCAPI->>DOCAPI: Validate metadata + checksum + version
    DOCAPI->>MG: Lưu document metadata / ingest state
    DOCAPI->>MQ: Publish ingest job
    MQ-->>DOC: Deliver job
    DOC->>DOC: Extract/OCR + parent-child chunking
    DOC->>EMB: Embed child chunks
    EMB-->>DOC: Vectors
    DOC->>MG: Upsert chunks + processing status
    DOC->>MV: Upsert vectors
    DOC-->>MG: Mark ingest completed
    UI->>GW: Poll /api/documents/:id/ingest-status
    GW->>DOCAPI: Get status
    DOCAPI->>MG: Read ingest status
    DOCAPI-->>GW: Status response
    GW-->>UI: completed/failed
```

- Happy path: upload -> queue -> worker -> embed -> Mongo/Milvus -> poll status.
- Security/audit checkpoint: metadata bảo mật được validate ở cả API và worker.
- Failure/fallback note: nếu RabbitMQ chưa sẵn sàng, publish path có HTTP fallback; nếu ingest lỗi, UI đọc `failed` + error.

### 2.4. Text-to-SQL read-only query

```mermaid
sequenceDiagram
    actor User
    participant UI as web-ui
    participant GW as api-gateway
    participant CHAT as chat
    participant RAG as rag-engine
    participant OLLAMA as Ollama
    participant PGRO as Postgres pm2_readonly
    participant PGA as Postgres sql_query_audit

    User->>UI: Hỏi dữ liệu bằng ngôn ngữ tự nhiên
    UI->>GW: POST /api/chat/sessions/:id/messages
    GW->>CHAT: Verify JWT + forward scope
    CHAT->>RAG: POST /v1/chat
    RAG->>RAG: Route sang SQL
    RAG->>OLLAMA: Generate SQL từ catalog curated
    OLLAMA-->>RAG: SQL draft
    RAG->>RAG: Validate SQL (readonly, single statement, LIMIT)
    RAG->>PGRO: Execute SQL bằng pm2_readonly
    PGRO-->>RAG: Rows
    RAG->>PGA: Ghi SQL audit
    RAG-->>CHAT: Bảng kết quả + metadata
    CHAT-->>GW: Chat response
    GW-->>UI: Render bảng
```

- Happy path: route SQL -> generate -> validate -> execute readonly -> format result.
- Security/audit checkpoint: validator chặn DDL/DML và thực thi qua `pm2_readonly`.
- Failure/fallback note: SQL không hợp lệ hoặc user không đủ quyền -> từ chối rõ ràng; không fallback sang query thô.

### 2.5. Admin cập nhật AI policy + audit log

```mermaid
sequenceDiagram
    actor Admin
    participant UI as web-ui
    participant GW as api-gateway
    participant AC as admin-config
    participant PG as Postgres
    participant AUDH as writeAuditLog helper
    participant RAG as rag-engine

    Admin->>UI: Sửa policy safe refusal / blacklist
    UI->>GW: PUT /api/admin-config/rag-policy
    GW->>AC: Verify admin role + forward request
    AC->>PG: Update admin_configs + prompt_change_log + version
    AC->>AUDH: Ghi audit qua helper dùng chung
    AUDH->>PG: Insert audit row
    AC-->>GW: Policy saved
    GW-->>UI: Save success + version mới
    RAG->>AC: GET /api/admin-config/internal/rag-policy với internal key
    AC->>PG: Read current policy
    AC-->>RAG: Policy current version
```

- Happy path: admin cập nhật policy, DB version tăng, audit ghi qua helper, `rag-engine` đọc policy mới.
- Security/audit checkpoint: chỉ admin-like được sửa; internal policy route dùng key riêng và bị chặn khỏi public gateway.
- Failure/fallback note: nếu save lỗi thì policy cũ giữ nguyên; nếu internal fetch lỗi, `rag-engine` dùng cache/fallback an toàn.

### 2.6. ETL source sync + lineage/error log

```mermaid
sequenceDiagram
    actor Operator
    participant ETL as etl-sync
    participant SRC as source system
    participant PG as Postgres
    participant MG as MongoDB

    Operator->>ETL: POST /v1/etl/sources or /v1/etl/jobs
    ETL->>PG: Lưu source/job metadata
    Operator->>ETL: Trigger run hoặc scheduler chạy
    ETL->>SRC: Ping/discover/read batch
    SRC-->>ETL: Source rows
    ETL->>ETL: Transform + validate
    ETL->>PG: Upsert target rows / etl_runs / etl_lineage
    ETL->>MG: Upsert target collection nếu job yêu cầu
    ETL->>PG: Ghi etl_error_logs cho row lỗi
    ETL-->>Operator: Run status + load summary
```

- Happy path: source -> run -> transform -> load -> lineage/error summary.
- Security/audit checkpoint: connector read-only; password response phải được mask.
- Failure/fallback note: hiện service-level API chưa có auth ở FastAPI layer; row lỗi được cô lập thay vì làm rơi cả batch nếu có thể.

## 3. Target architecture / planned

### 3.1. Two-machine AI topology

```mermaid
sequenceDiagram
    participant AppHost as May nen tang
    participant ModelHost as May mo hinh

    AppHost->>ModelHost: LLM_BASE_URL / EMBEDDING_BASE_URL / RERANK_BASE_URL
    ModelHost-->>AppHost: chat completion / embedding / rerank result
```

- Planned state: app stack và AI serving tách máy.
- Không phải current implementation của `docker-compose.yml`.

### 3.2. Admin policy qua dedicated audit service

```mermaid
sequenceDiagram
    actor Admin
    participant GW as api-gateway
    participant AC as admin-config
    participant AU as audit service
    participant PG as Postgres

    Admin->>GW: PUT /api/admin-config/rag-policy
    GW->>AC: Forward request
    AC->>PG: Update policy + version
    AC->>AU: Gửi audit event riêng
    AU->>PG: Persist audit row
```

- Đây là **target/planned direction** nếu sau này tách rõ đường ghi audit thành service chuyên trách.
- Không mô tả nó như current implementation; current repo đang ghi qua helper dùng chung.

### 3.3. ETL qua admin console/gateway

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin ETL console
    participant GW as api-gateway
    participant ETL as etl-sync

    Admin->>UI: Tạo source / trigger run
    UI->>GW: Request admin ETL
    GW->>ETL: Forward internal/admin request
    ETL-->>GW: Run status / lineage summary
    GW-->>UI: Render dashboard
```

- Đây là **target/planned** cho khi web-ui có ETL console đầy đủ.
- Current repo mới có service-level API `etl-sync`, chưa có flow web-ui/gateway hoàn chỉnh cho ETL.

## 4. Ghi chú

- Khi implementation thay đổi, cập nhật cả `B3`, `B6`, `B7` cùng nhau.
- Nếu một sơ đồ chỉ đúng ở mức đích kiến trúc, ghi rõ `Target architecture / planned`, không đặt trong `Current implementation`.
