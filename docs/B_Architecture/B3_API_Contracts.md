# B3 — API Contracts

## 1. Mục tiêu

- Ghi lại contract API theo **controller/service hiện có trong repo**, không theo giả định kiến trúc tương lai.
- Tách rõ:
  - public API qua `api-gateway`
  - internal/service-level API
  - phần đã chạy được so với phần mới ở mức `partial` hoặc `planned`

## 2. Current implementation

- Client hiện đi qua `api-gateway` ở prefix `/api/*`.
- `rag-engine` có API riêng và hiện được `chat` gọi trực tiếp qua `RAG_ENGINE_URL`.
- `etl-sync` có FastAPI riêng ở `/v1/etl/*`, chưa đi qua gateway/web-ui như một flow hoàn chỉnh.
- Một số internal path tồn tại ở service layer nhưng bị chặn khỏi public gateway, ví dụ `/api/admin-config/internal/*`.

## 3. Target architecture

- `api-gateway` tiếp tục là entrypoint chính cho client.
- ETL dự kiến sẽ được quản trị qua admin UI/gateway thay vì gọi trực tiếp service-level API.
- Internal API vẫn nên giữ tách biệt với public API; không public hóa chỉ vì route đã tồn tại trong service.

## 4. Public API qua gateway

### 4.1. Gateway health

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/health` | Public | Không body | Health tổng hợp các upstream đã gắn vào gateway | Upstream down vẫn có thể trả `200` với trạng thái `down` trong payload | `implemented` |

### 4.2. Auth và user

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `POST` | `/api/auth/login` | Public | `{ username, password }` | `{ access_token, user }` + refresh cookie HttpOnly | Sai credential -> `401` | `implemented` |
| `POST` | `/api/auth/refresh` | Public + refresh cookie | Không body bắt buộc; đọc cookie refresh | `{ access_token, user }` + rotated refresh cookie | Thiếu/invalid refresh -> `401`, cookie bị clear | `implemented` |
| `POST` | `/api/auth/logout` | JWT | Không body bắt buộc; dùng access token + refresh cookie hiện tại nếu có | Kết quả revoke/logout + clear cookie | Thiếu JWT -> `401` | `implemented` |
| `GET` | `/api/users/me` | JWT | Không body | Hồ sơ user hiện tại | JWT invalid -> `401` | `implemented` |

### 4.3. Chat

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/chat/sessions` | JWT | Không body | Danh sách session của user hiện tại | `401` nếu thiếu JWT | `implemented` |
| `POST` | `/api/chat/sessions` | JWT | `{ title? }` | Session mới | `401` nếu thiếu JWT | `implemented` |
| `GET` | `/api/chat/sessions/:sessionId` | JWT | `sessionId` trên path | Chi tiết session | Session không thuộc user hoặc không tồn tại -> `404`/`403` tùy service layer | `implemented` |
| `DELETE` | `/api/chat/sessions/:sessionId` | JWT | `sessionId` trên path | Kết quả xóa session | Không tìm thấy hoặc không thuộc user -> lỗi từ service | `implemented` |
| `GET` | `/api/chat/sessions/:sessionId/messages` | JWT | `sessionId` trên path | Danh sách message của session. **Trả về `status` field:** `'loading' | 'streaming' | 'completed' | 'error'` | Session không hợp lệ -> lỗi từ service | `implemented` |
| `POST` | `/api/chat/sessions/:sessionId/messages` | JWT | `{ content }` | `{ answer, citations, route? }` và message persistence | `503` nếu downstream AI lỗi; service có thể fallback một phần tùy flow | `implemented` |
| `POST` | `/api/chat/sessions/:sessionId/messages/stream` | JWT | `{ content }` | SSE `meta` (có `assistant_message_id`), `token`, `done`, `error` | SSE/downstream lỗi -> event `error` hoặc HTTP lỗi trước khi stream | `implemented` |

**Chat Message DTO:**

```typescript
interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  citations?: ChatCitation[]
  route?: string
  error?: boolean
  status?: 'loading' | 'streaming' | 'completed' | 'error'
}
```

**Stream Meta Event Payload:**

```typescript
interface StreamMetaPayload {
  user_message: ChatMessage
  citations: ChatCitation[]
  route: string
  assistant_message_id: string  // ID của assistant message đã được tạo trên server
}
```

### 4.4. Documents

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/documents` | JWT | Không body | Danh sách document user có thể thấy | `401` nếu thiếu JWT | `implemented` |
| `POST` | `/api/documents` | JWT | Multipart `file` + `title?`, `category?`, `security_level?`, `scope_type?`, `access_role_codes?`, `access_department_codes?`, `access_user_ids?` | Metadata document mới, ingest state khởi tạo | Validate metadata/file -> `400` | `implemented` |
| `GET` | `/api/documents/:id/ingest-status` | JWT | `id` trên path | `{ status, stage, chunkCount, error, ... }` | Không đủ quyền / không tồn tại -> lỗi service | `implemented` |
| `GET` | `/api/documents/:id/file` | JWT | `id` trên path | Stream file gốc với header `Content-Disposition` | Không đủ quyền / không tồn tại -> lỗi service | `implemented` |
| `DELETE` | `/api/documents/:id` | JWT | `id` trên path | Kết quả xóa; có logic promote version trước nếu cần | Không đủ quyền -> `403`; không tồn tại -> `404` | `implemented` |
| `GET` | `/api/documents/vung-du-lieu` | JWT | Không body | Thống kê/nhóm dữ liệu theo logic documents service | Contract còn mỏng ở mức docs, nhưng route tồn tại | `implemented` |
| `GET` | `/api/documents/security-level-stats` | JWT | Không body | Thống kê theo `securityLevel` | Contract còn mỏng ở mức docs, nhưng route tồn tại | `implemented` |
| `GET` | `/api/documents/preview/:role` | JWT admin-like | `role` trên path | Preview quyền truy cập tài liệu cho role được chỉ định | User không phải admin-like -> `403` | `implemented` |
| `GET` | `/api/documents/:id/chunks` | JWT | `id` trên path, query `limit` (mặc định 5, tối đa 20) | `{ chunks: [{ id, text, index, section_path, page, created_at }], total }` | Không đủ quyền -> `403`; không tìm thấy -> `404` | `implemented` |

### 4.5. Admin config

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/admin-config/health` | Public | Không body | `{ status, service }` | Không đáng kể | `implemented` |
| `GET` | `/api/admin-config/rag-policy` | JWT admin-like | Không body | Policy hiện tại + version metadata | Không đủ quyền -> `403` | `implemented` |
| `PUT` | `/api/admin-config/rag-policy` | JWT admin-like | `{ enabled?, blacklistKeywords?, safeRefusalMessage?, reason? }` | Policy mới sau khi save + version tăng | Không đủ quyền -> `403`; payload sai -> `400` | `implemented` |

Ghi chú:

- `/api/admin-config/internal/*` **không phải public API**. Gateway hiện chủ động trả `404` cho prefix này để tránh lộ internal route.

### 4.6. Audit

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/audit/health` | Public | Không body | `{ status, service }` | Không đáng kể | `implemented` |
| `GET` | `/api/audit/logs` | JWT admin-like | Query `status?`, `action?`, `resourceType?`, `userId?`, `resourceId?`, `from?`, `to?`, `limit?` | Danh sách audit rows | Không đủ quyền -> `403` | `implemented` |
| `GET` | `/api/audit/logs/:id` | JWT admin-like | `id` trên path | Chi tiết một audit row hoặc `null` | Không đủ quyền -> `403` | `implemented` |

### 4.7. RBAC

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/rbac/health` | Public | Không body | `{ status, service }` | Không đáng kể | `implemented` |
| `GET` | `/api/rbac/me` | JWT | Không body | Access scope hiện tại của user | `401` nếu thiếu JWT | `implemented` |
| `GET` | `/api/rbac/matrix` | JWT admin-like | Không body | Role/permission matrix | Không đủ quyền -> `403` | `implemented` |
| `POST` | `/api/rbac/check` | JWT | `{ permissionCode?, resource?, action? }` | Kết quả kiểm tra quyền | Payload thiếu hoặc không đủ quyền -> lỗi service | `implemented` |
| `POST` | `/api/rbac/row-filter` | JWT | `{ resource, action?, categoryCode? }` | Predicate/filter cho downstream | Payload không hợp lệ -> lỗi service | `implemented` |

## 5. Service-level và internal APIs

### 5.1. RAG engine service routes

Các route này tồn tại ở `rag-engine` và hiện được `chat` gọi trực tiếp qua `RAG_ENGINE_URL`. Chúng **không phải** contract chính cho client web thông thường.

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/health` | Không có JWT tại service layer | Không body | `{ status, service, ... }` | Dùng cho health nội bộ | `implemented` |
| `POST` | `/v1/retrieve` | User context trong body hoặc header gateway | `{ query, user? }` | Thành công: `{ citations: [...], route: "rag" }`; nếu bị safe-refusal: `{ citations: [], route: "refusal", message, blocked_keyword? }` | Thiếu user context -> `401`; retrieval lỗi -> `503` | `implemented` |
| `POST` | `/v1/sql` | User context trong body hoặc header gateway | `{ query, sessionId?, messages?, user? }` | Thành công: `{ answer, route: "sql", row_count }`; nếu bị safe-refusal: `{ answer, citations: [], route: "refusal", blocked_keyword? }` | Thiếu user context -> `401`; guardrail/scope deny -> `403`; pipeline/LLM lỗi -> `502` | `implemented` |
| `POST` | `/v1/chat` | User context trong body hoặc header gateway | `{ query, sessionId?, messages, user }` | `{ answer, citations, route }` - **Citations luôn được trả về, kể cả khi answer là refusal** | Thiếu user context -> `401`; AI/downstream lỗi -> `5xx` | `implemented` |
| `POST` | `/v1/chat/stream` | User context trong body hoặc header gateway | `{ query, sessionId?, messages, user }` | SSE `meta` (citations gửi ngay sau retrieval), `token` (real token streaming), `done`, `error` | Stream error -> event `error` hoặc HTTP lỗi | `implemented` |

Ghi chú:

- Gateway có proxy `/api/rag/*` sang `rag-engine`, nhưng current UI path chính vẫn là `web-ui -> api-gateway -> chat -> rag-engine`.
- **Real streaming**: `/v1/chat/stream` sử dụng `stream_chat` để yield token-by-token từ LLM, không buffer toàn bộ response.
- **Citations persistence**: Citations được gửi trong sự kiện `meta` ngay sau retrieval và **không bị xóa** dù câu trả lời là refusal.

### 5.2. Admin-config internal route

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/api/admin-config/internal/rag-policy` | Internal key `x-admin-config-key` | Không body | Policy hiện tại | Gateway public chặn `404`; gọi sai key -> `401`; thiếu env -> `503` | `implemented` |

### 5.3. ETL sync service routes

Các route dưới đây hiện là **service-level API** ở `etl-sync`. Chúng chưa được nối thành public product API hoàn chỉnh qua gateway/web-ui.

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `GET` | `/health` | Không có auth tại FastAPI layer | Không body | `{ status, service, backend, store }` | Dùng như health nội bộ | `implemented` |
| `GET` | `/v1/etl/overview` | Không có auth tại FastAPI layer | Không body | Tổng quan source/job/run | Hiện nên coi là internal/admin-only | `partial` |
| `POST` | `/v1/etl/sources` | Không có auth tại FastAPI layer | `sourceId?`, `sourceSystem`, `displayName`, `sourceKind`, `connectionConfig`, `active` | Source đã tạo, password được mask | Lỗi store -> `500`; source invalid -> `4xx` | `partial` |
| `GET` | `/v1/etl/sources` | Không có auth tại FastAPI layer | Không body | Danh sách source, password được mask | Hiện nên coi là internal/admin-only | `partial` |
| `GET` | `/v1/etl/sources/{source_id}` | Không có auth tại FastAPI layer | `source_id` trên path | Chi tiết source, password được mask | Không tồn tại -> `404` | `partial` |
| `POST` | `/v1/etl/jobs` | Không có auth tại FastAPI layer | `jobId?`, `sourceId`, `domainCode`, `syncMode`, `targetTable?`, `targetCollection?`, `scheduleCron?`, `jobConfig`, `status`, `createdBy?` | Job đã tạo | Lỗi store -> `4xx/5xx` | `partial` |
| `GET` | `/v1/etl/jobs` | Không có auth tại FastAPI layer | Không body | Danh sách jobs | Hiện nên coi là internal/admin-only | `partial` |
| `GET` | `/v1/etl/jobs/{job_id}` | Không có auth tại FastAPI layer | `job_id` trên path | Chi tiết job | Không tồn tại -> `404` | `partial` |
| `POST` | `/v1/etl/jobs/{job_id}/runs` | Không có auth tại FastAPI layer | `runId?`, `sourceRange`, `triggerType`, `triggeredBy?` | Run mới | Không tồn tại -> `404` | `partial` |
| `GET` | `/v1/etl/runs` | Không có auth tại FastAPI layer | Query `jobId?` | Danh sách runs | Hiện nên coi là internal/admin-only | `partial` |
| `GET` | `/v1/etl/runs/{run_id}` | Không có auth tại FastAPI layer | `run_id` trên path | Chi tiết run | Không tồn tại -> `404` | `partial` |
| `POST` | `/v1/etl/runs/{run_id}/status` | Không có auth tại FastAPI layer | `{ status, recordIn?, recordOut?, errorSummary?, sourceRange? }` | Run sau cập nhật | Không tồn tại -> `404` | `partial` |
| `POST` | `/v1/etl/runs/{run_id}/lineage` | Không có auth tại FastAPI layer | `sourceSystem`, `sourceTable?`, `sourcePk?`, `targetTable?`, `targetPk?`, `targetCollection?`, `targetDocumentId?`, `operation`, `status`, `payloadHash?`, `note?` | Lineage record đã thêm | Không tồn tại -> `404` | `partial` |
| `POST` | `/v1/etl/runs/{run_id}/errors` | Không có auth tại FastAPI layer | `sourceSystem`, `stage`, `errorCode?`, `errorMessage`, `detail`, `retryable` | Error record đã thêm | Không tồn tại -> `404` | `partial` |

### 5.4. ETL SQL Server connector routes

| Method | Path | Auth | Request shape summary | Response shape summary | Error notes | Status |
|--------|------|------|-----------------------|------------------------|-------------|--------|
| `POST` | `/v1/etl/sources/{source_id}/sqlserver/ping` | Không có auth tại FastAPI layer | `source_id` trên path | Kết quả ping/readiness của connector | Source missing -> `404`; connector invalid -> `400` | `partial` |
| `GET` | `/v1/etl/sources/{source_id}/sqlserver/tables` | Không có auth tại FastAPI layer | Query `schemaName?` | Danh sách tables | Source missing -> `404`; connector invalid -> `400` | `partial` |
| `GET` | `/v1/etl/sources/{source_id}/sqlserver/tables/{table_name}/columns` | Không có auth tại FastAPI layer | `source_id`, `table_name`, query `schemaName` | Danh sách cột | Source missing -> `404`; connector invalid -> `400` | `partial` |
| `POST` | `/v1/etl/sources/{source_id}/sqlserver/read` | Không có auth tại FastAPI layer | `{ schemaName, tableName, columns, limit, cursorColumn?, cursorValue?, orderBy?, descending }` | Sample rows / batch rows read-only | Read-only violation -> `403`; connector invalid -> `400` | `partial` |

## 6. Chuẩn lỗi và trạng thái

### 6.1. Lỗi

| Mã | Ý nghĩa trong current implementation |
|----|--------------------------------------|
| `400` | Input không hợp lệ, metadata/file sai, connector request sai |
| `401` | Thiếu JWT, JWT hết hạn, refresh token invalid, thiếu internal key hoặc thiếu user context |
| `403` | Có đăng nhập nhưng không đủ quyền; connector read-only violation |
| `404` | Tài nguyên không tồn tại hoặc internal route bị ẩn khỏi gateway |
| `422` | SQL không vượt validator hoặc payload không qua schema validation |
| `503` | Downstream AI/config service chưa sẵn sàng |

### 6.2. Nhãn trạng thái dùng trong file này

- `implemented`: route đã tồn tại và đang là contract dùng được ở current repo
- `partial`: route đã có nhưng chưa đi vào product flow hoàn chỉnh, hoặc còn thiếu auth/gateway/web-ui integration
- `planned`: chưa có route thật trong repo hiện tại

### 6.3. Ghi chú về refusal và citations

- Khi LLM trả lời "không tìm thấy thông tin", câu trả lời được thay thế bằng một thông báo giải thích rõ ràng hơn, và **các citations luôn được giữ lại** (không bị xóa).
- Trong streaming endpoint (`/v1/chat/stream`), citations được gửi ngay trong sự kiện `meta` (sau retrieval, trước khi generation bắt đầu) và không bị xóa dù nội dung câu trả lời là refusal.
- Frontend sử dụng `status` field để hiển thị loading/streaming/completed states và duy trì UI consistency sau reload/navigation.

## 7. Quy tắc cập nhật file này

- Khi route/controller thật thay đổi, cập nhật file này trước hoặc cùng PR.
- Không thêm endpoint "suy ra từ kiến trúc"; chỉ ghi route đã có trong source hoặc đánh dấu rõ `planned`.
- Nếu một flow chỉ mới ở target architecture, không mô tả nó như current implementation.
