# A1 — SRS Academy AI Platform

## 1. Mục tiêu

- Xây dựng một nền tảng dữ liệu tập trung cho học viện, gom dữ liệu có cấu trúc và phi cấu trúc vào cùng một hệ thống khai thác.
- Cung cấp cổng trợ lý ảo on-premise để người dùng hỏi đáp tài liệu, tra cứu dữ liệu, nhận câu trả lời có citation và bị chặn khi vượt quyền.
- Chuẩn hóa các lớp bảo mật bắt buộc: JWT, RBAC, audit, safe refusal, SQL read-only, document access policy.

## 2. Stakeholder

| Nhóm | Kỳ vọng chính |
|------|---------------|
| Ban điều hành / admin | Theo dõi sức khỏe hệ thống, audit, cấu hình AI, ETL, quản trị tài khoản |
| Phòng đào tạo / P2 | Khai thác dữ liệu học viên, chương trình, lịch học, học liệu |
| Phòng khảo thí / P7 | Tra cứu ngân hàng đề, phổ điểm, dữ liệu khảo thí có kiểm soát |
| Giảng viên | Hỏi đáp tài liệu, tóm tắt học liệu, tạo câu hỏi/quiz, tra cứu nguồn |
| Học viên / sinh viên | Tự phục vụ: hỏi đáp tài liệu, lịch học, kết quả, thông báo trong phạm vi được cấp |
| Team kỹ thuật | Vận hành stack ổn định, truy vết lỗi và triển khai an toàn |

## 3. Phạm vi

### Trong phạm vi

- Đăng nhập, refresh token, session rotation, logout, role-based access.
- Upload tài liệu, ingest, OCR/extract, chunking, indexing, versioning.
- Chat đa lượt với RAG, citation, safe refusal, route SQL read-only.
- Trang admin cho health, policy AI, audit, ETL status.
- Đồng bộ dữ liệu nguồn bằng ETL read-only, có lineage và error log.

### Ngoài phạm vi giai đoạn hiện tại

- SSO doanh nghiệp, IAM liên thông ngoài hệ thống.
- Workflow nghiệp vụ đầy đủ cho mọi phòng ban.
- Chức năng học tập nâng cao như sinh giáo án/quiz/report ở mức production-complete.
- Triển khai Internet-facing hoặc cloud-hosted runtime.

## 4. Yêu cầu chức năng

| Mã | Yêu cầu |
|----|---------|
| FR-01 | Người dùng đăng nhập bằng username/password, nhận access token và refresh token riêng biệt |
| FR-02 | Hệ thống lưu session và cho phép rotate/revoke refresh token |
| FR-03 | Người dùng upload PDF/DOCX/PPTX/XLSX/TXT và theo dõi trạng thái ingest |
| FR-04 | Worker phải extract, OCR khi cần, chunk, embed và đồng bộ MongoDB + Milvus |
| FR-05 | Chat phải hỗ trợ multi-turn, trả lời có citation khi route RAG |
| FR-06 | Hệ thống phải từ chối câu hỏi bị chặn bởi policy hoặc không đủ quyền |
| FR-07 | Text-to-SQL chỉ chạy trên catalog read-only và ghi audit đầy đủ |
| FR-08 | Admin có thể xem health, sửa policy AI, xem/export audit log |
| FR-09 | ETL phải hỗ trợ batch sync, metadata discovery, transform/load, lineage, error log |
| FR-10 | Web UI phải có login, chat, docs workspace, admin page, settings |

## 5. Yêu cầu phi chức năng

| Mã | Yêu cầu |
|----|---------|
| NFR-01 | On-premise first; runtime không phụ thuộc Internet |
| NFR-02 | Mọi request quan trọng phải truy vết được qua audit/correlation id |
| NFR-03 | Mọi truy cập dữ liệu phải đi qua lớp kiểm soát quyền theo vai trò và phạm vi |
| NFR-04 | Mỗi service chính phải có health endpoint và smoke path |
| NFR-05 | Thành phần AI phải thay được model/provider qua config mà không sửa flow nghiệp vụ |
| NFR-06 | Dự án phải chạy được local 1 máy và có lộ trình rõ sang topology 2 máy |
| NFR-07 | Test regression phải có cho chat, RAG, ingest, ETL và admin flows chính |

## 6. Ràng buộc kỹ thuật

- Platform backend dùng NestJS monorepo.
- AI/workers dùng Python 3.12 và giao tiếp HTTP/AMQP.
- LLM dev hiện tại dùng Ollama `qwen2.5:3b`; hướng nghiệm thu giữ chuẩn Qwen2.5-3B.
- Data stack gồm Postgres, MongoDB, Milvus, Redis, RabbitMQ và file storage local.

## 7. Tiêu chí nghiệm thu cấp hệ thống

- Login, refresh, logout và JWT guard chạy end-to-end qua gateway.
- Tài liệu upload được index và chat trích dẫn lại đúng nguồn.
- Query vượt policy hoặc ngoài quyền bị từ chối rõ ràng.
- ETL tạo được run, lineage và log lỗi có thể xem lại.
- Admin xem được health, audit và thay được policy AI không cần sửa code.

## 8. Source of truth hiện tại

- Backlog chi tiết: [../task list.md](<../task list.md>)
- Kế hoạch triển khai: [../plan.md](../plan.md)
- Ghi chú vận hành: [../memory.md](../memory.md)
