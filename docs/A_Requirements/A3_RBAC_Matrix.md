# A3 — RBAC Matrix

## 1. Mục tiêu

- Chặn truy cập sai quyền ở cả gateway, service nghiệp vụ, dữ liệu tài liệu và SQL route.
- Tách rõ quyền hệ thống, quyền theo phòng ban và quyền theo owner/document scope.
- Dùng ma trận này làm chuẩn cho API guard, UI guard và test bảo mật.

## 2. Vai trò mục tiêu

| Vai trò | Mô tả | Ghi chú |
|---------|-------|---------|
| `admin` | Quản trị hệ thống toàn phần | Seed hiện có |
| `bgd` | Ban giám đốc, xem báo cáo tổng hợp | Role đích |
| `p2` | Phòng đào tạo | Seed hiện có |
| `p7` | Phòng khảo thí và ĐBCL | Role đích |
| `giang_vien` | Giảng viên | Seed hiện có dưới dạng `gv001` |
| `hoc_vien` | Học viên / sinh viên | Seed hiện có dưới dạng `hv001` |
| `service_internal` | Service-to-service | Dùng internal key, không dùng qua UI |

## 3. Mức bảo mật dữ liệu tài liệu

| Mức | Ý nghĩa | Quy tắc cơ bản |
|-----|---------|----------------|
| `public` | Công khai nội bộ | Mọi user đăng nhập có thể xem |
| `internal` | Nội bộ đơn vị | Cùng vai trò hoặc cùng đơn vị được xem |
| `restricted` | Hạn chế | Cần role/owner/custom allow list |
| `confidential` | Mật | Chỉ admin hoặc danh sách cấp quyền rõ ràng |

## 4. Ma trận quyền nghiệp vụ

| Tài nguyên / hành động | admin | bgd | p2 | p7 | giang_vien | hoc_vien |
|------------------------|-------|-----|----|----|------------|----------|
| Đăng nhập, refresh, logout | Y | Y | Y | Y | Y | Y |
| Chat thường | Y | Y | Y | Y | Y | Y |
| RAG trên tài liệu `public/internal` | Y | Y | Y | Y | Y | Theo quyền |
| RAG trên tài liệu `restricted/confidential` | Y | Theo cấp | Theo phạm vi | Theo phạm vi | Theo phạm vi | N |
| Upload tài liệu | Y | N | Y | Y | Y | Theo policy |
| Xóa/version tài liệu không phải owner | Y | N | Theo đơn vị | Theo đơn vị | N | N |
| Gọi Text-to-SQL | Y | Theo policy | Theo policy | Theo policy | N hoặc giới hạn | N |
| Xem health hệ thống | Y | Xem tổng quát | N | N | N | N |
| Sửa policy AI | Y | N | N | N | N | N |
| Xem/export audit log | Y | Xem tổng quát | N | N | N | N |
| Tạo/chạy connector ETL | Y | N | Theo phân công | Theo phân công | N | N |
| Quản trị tài khoản/role | Y | N | N | N | N | N |

## 5. Điểm chặn kỹ thuật bắt buộc

| Lớp | Cơ chế |
|-----|--------|
| Gateway | JWT verify, route guard, role normalization |
| Service chat | Kiểm tra quyền phiên chat, tài liệu, session owner |
| RAG engine | Access filter theo `securityLevel`, `scopeType`, owner/role/department/custom list |
| Documents | Validate metadata bảo mật khi upload và khi worker xử lý |
| Text-to-SQL | Chỉ dùng catalog curated + readonly credential |
| Admin internal endpoints | Bắt buộc internal key riêng, không public route |

## 6. Quy tắc test tối thiểu

- User thường không thấy route admin.
- User ngoài quyền không đọc được tài liệu `restricted/confidential`.
- Query bị chặn phải trả về refusal hoặc 403/404 phù hợp, không lộ metadata nhạy cảm.
- Admin thay policy phải sinh audit log.
- SQL route chỉ hoạt động với vai trò được cấp.

## 7. Ghi chú triển khai hiện tại

- UI hiện đã có guard theo `admin`, `bgd`, `p2`, `p7`; nhưng seed local mới phủ tối thiểu `admin`, `gv001`, `hv001`, `p2`.
- Ma trận này là chuẩn đích; backlog cần tiếp tục đóng các khoảng trống về quota, user CRUD và penetration testing.
