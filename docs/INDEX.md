# Academy AI Platform (PM2) — Bộ Tài liệu Chuẩn
## Mục lục Tài liệu Kỹ thuật

**Dự án:** Academy AI Platform (PM2) — Kho dữ liệu tập trung và Cổng khai thác trợ lý ảo  
**Phạm vi:** On-premise, dữ liệu học viện, RAG + Text-to-SQL + ETL + quản trị  
**Phiên bản:** 1.0  
**Ngày tạo:** 2026-06-23  
**Cập nhật:** 2026-06-23  

---

## Nhóm A — Yêu cầu & Phân tích

| File | Nội dung | Dùng khi |
|------|----------|----------|
| [A1_SRS_AcademyAI.md](A_Requirements/A1_SRS_AcademyAI.md) | Đặc tả yêu cầu phần mềm cấp hệ thống: mục tiêu, phạm vi, yêu cầu chức năng và phi chức năng | Chốt phạm vi nền |
| [A2_UseCase_Specification.md](A_Requirements/A2_UseCase_Specification.md) | Đặc tả use case cốt lõi cho chat, tài liệu, quản trị, ETL và tự phục vụ | Thiết kế API, UI, test |
| [A3_RBAC_Matrix.md](A_Requirements/A3_RBAC_Matrix.md) | Ma trận phân quyền theo vai trò, phạm vi dữ liệu và điểm chặn kỹ thuật | Thiết kế bảo mật, audit |

---

## Nhóm B — Kiến trúc Kỹ thuật

| File | Nội dung | Đọc trước khi |
|------|----------|---------------|
| [B1_System_Architecture.md](B_Architecture/B1_System_Architecture.md) | Kiến trúc tổng thể service, topology 1 máy dev và 2 máy mục tiêu, ranh giới trách nhiệm | Bắt đầu dev backend/AI |
| [B2_Data_Architecture.md](B_Architecture/B2_Data_Architecture.md) | Thiết kế dữ liệu cho Postgres, MongoDB, Milvus, Redis, RabbitMQ và file storage | Làm schema, migration, pipeline |
| [B3_API_Contracts.md](B_Architecture/B3_API_Contracts.md) | Hợp đồng API hiện tại theo controller/service thật, có phân biệt public API, internal API và phần planned | Làm FE/BE integration |
| [B4_AI_Pipeline_Design.md](B_Architecture/B4_AI_Pipeline_Design.md) | Chuẩn pipeline ingest, RAG, safe refusal, multi-turn session context, Text-to-SQL, ETL sync | Làm AI/workers |
| [B5_Repo_Structure.md](B_Architecture/B5_Repo_Structure.md) | Quy ước cấu trúc repo, ownership theo service, nơi đặt source of truth và test | Onboarding và review |
| [B6_Component_Registry.md](B_Architecture/B6_Component_Registry.md) | Sổ đăng ký component: trạng thái, trách nhiệm, input/output, phụ thuộc, storage chạm tới và evidence kiểm chứng | Khi cần hiểu nhanh từng component |
| [B7_Sequence_Diagrams.md](B_Architecture/B7_Sequence_Diagrams.md) | Sequence diagram tách rõ luồng hiện tại và kiến trúc mục tiêu cho auth, chat RAG, ingest, SQL, admin policy, ETL | Trước khi sửa flow liên service |

---

## Nhóm C — UI/UX

| File | Nội dung | Dùng bởi |
|------|----------|----------|
| [C1_Screen_Inventory.md](C_UI_UX/C1_Screen_Inventory.md) | Danh mục màn hình với route, trạng thái, API phụ thuộc và cờ `implemented / partial / planned` | Frontend, QA, PM |

---

## Nhóm D — Vận hành & Triển khai

| File | Nội dung | Dùng bởi |
|------|----------|----------|
| [D1_Deployment_Architecture.md](D_Operations/D1_Deployment_Architecture.md) | Hiện trạng triển khai hiện tại, kiến trúc mục tiêu và known gaps của compose/topology | DevOps, backend |
| [D2_Environment_Config.md](D_Operations/D2_Environment_Config.md) | Quy ước `.env`, phân nhóm biến cấu hình và nguyên tắc quản lý secret | DevOps, backend |
| [D3_Test_Strategy.md](D_Operations/D3_Test_Strategy.md) | Chiến lược test unit, integration, E2E, smoke, regression cho toàn stack | QA, developer |
| [D4_Local_Dev_Runbook.md](D_Operations/D4_Local_Dev_Runbook.md) | Runbook local bám repo hiện tại, có tách `current implementation`, `target architecture` và `known gaps` | Onboarding |

---

## Nhóm E — Nghiệp vụ & Dữ liệu miền

| File | Nội dung | Dùng bởi |
|------|----------|----------|
| [E1_Academic_Data_Domain.md](E_Business/E1_Academic_Data_Domain.md) | Miền dữ liệu học viện: đào tạo, khảo thí, KHCN, thư viện và tự phục vụ | BA, data, backend |
| [E2_Document_Governance_RAG_Scope.md](E_Business/E2_Document_Governance_RAG_Scope.md) | Chuẩn phân loại tài liệu, bảo mật, versioning, citation và phạm vi RAG | Backend, AI, admin |
| [E3_ETL_Reporting_Spec.md](E_Business/E3_ETL_Reporting_Spec.md) | Chuẩn đồng bộ dữ liệu nguồn, lineage, error log và chỉ số điều hành ETL | Data, backend, admin |

---

## Nhóm F — Tích hợp & Chính sách giao tiếp

| File | Nội dung | Dùng bởi |
|------|----------|----------|
| [F1_Source_System_Connector_Contract.md](F_Integrations/F1_Source_System_Connector_Contract.md) | Hợp đồng connector nguồn PM, đặc biệt SQL Server read-only và metadata discovery | ETL, backend |
| [F2_Auth_Session_Token_Policy.md](F_Integrations/F2_Auth_Session_Token_Policy.md) | Chính sách access token, refresh token, session rotation và service-to-service key | Backend, security |
| [F3_Text_to_SQL_Safety_Contract.md](F_Integrations/F3_Text_to_SQL_Safety_Contract.md) | Quy chuẩn an toàn cho Text-to-SQL: prompt, catalog, validator, audit và format kết quả | AI, backend, QA |

---

## Nhóm G — Kế hoạch & Quyết định

| File | Nội dung | Dùng bởi |
|------|----------|----------|
| [G1_Sprint_Overview.md](G_Planning/G1_Sprint_Overview.md) | Bản đồ milestone M0-M6, mục tiêu từng chặng và trạng thái hiện tại | PM, toàn team |
| [G2_Task_Progress_Map.md](G_Planning/G2_Task_Progress_Map.md) | Bản đồ task đã xong, đang làm một phần và ưu tiên tiếp theo, rút gọn từ backlog chi tiết | PM, dev |
| [G3_Decision_Memory.md](G_Planning/G3_Decision_Memory.md) | Nhật ký quyết định kiến trúc/vận hành quan trọng để tránh mất ngữ cảnh | PM, dev, reviewer |
| [G4_Check_Tren/](G_Planning/G4_Check_Tren/README.md) | Cơ chế lưu vết khi AI đề xuất một hướng nhưng user/team điều chỉnh trước khi chốt | PM, dev, reviewer, AI assistant |

---

## Thứ tự đọc theo vai trò

### Backend Developer
```text
A1 → A3 → B1 → B2 → B3 → B4 → B6 → B7 → D2 → D4 → F2 → F3
```

### Frontend Developer
```text
A1 → A2 → B3 → C1 → G2
```

### AI / ML Engineer
```text
A1 → B1 → B2 → B4 → B6 → E2 → F3 → G3 → G4
```

### DevOps / Platform
```text
B1 → D1 → D2 → D4 → G1
```

### QA / Reviewer
```text
A1 → A2 → A3 → B7 → D3 → E2 → F3 → G2 → G4
```

---

## Mốc triển khai chính

| Milestone | Trọng tâm | Tài liệu cần đọc |
|-----------|-----------|------------------|
| M0 | Bootstrap repo, data platform, seed, smoke | A1, B1, B2, D4, G1 |
| M1 | LLM, embedding, rerank, profile AI | B1, B4, D1, D2 |
| M2 | Ingest, OCR, chunking, tài liệu | A2, B2, B4, B6, B7, E2 |
| M3 | RAG, citation, safe refusal, multi-turn | A2, B4, B6, B7, F3, D3 |
| M4 | Text-to-SQL read-only, curated catalog | B2, B3, F3 |
| M5 | Gateway, auth, RBAC, audit, ETL | A3, B3, E3, F2, G4 (khi có đổi hướng AI/thiết kế) |
| M6 | Web UI, admin operations, self-service | A2, C1, D3, G2, G4 (khi UI/admin flow bị điều chỉnh trước khi chốt) |

---

## Ghi chú

- Bộ tài liệu này là **bộ spec mới** cho dự án PM2, viết theo phong cách tài liệu chuẩn; không còn dùng `docs/INDEX.md` như danh mục file code trong repo.
- Backlog vận hành chi tiết vẫn giữ ở [task list.md](<task list.md>). Kế hoạch implementation nằm ở [plan.md](plan.md). Working memory kỹ thuật nằm ở [memory.md](memory.md).
- Các file trong nhóm A-G là **tài liệu định nghĩa chuẩn** cho tính năng và vận hành; khi docs khác code, cần cập nhật docs hoặc đánh dấu `planned`, không được âm thầm coi kiến trúc mục tiêu là trạng thái hiện tại.

- Nếu cần ghi lại thay đổi local hoặc flow xử lý docs/AI, dùng `docs/_local/LOCAL_DOC_CHANGE_LOG.md` và cập nhật log ngay sau khi hoàn thành một việc hoặc kết thúc một prompt.

---

*Bộ tài liệu này được tạo để thay thế index kiểu "repo map" trước đó bằng một bộ đặc tả chức năng và kỹ thuật có thể dùng làm tài liệu chuẩn cho phát triển, review và handover.*
