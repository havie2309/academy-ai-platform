# E1 — Academic Data Domain

## 1. Mục tiêu

- Xác định các miền dữ liệu mà PM2 phải bao phủ.
- Tạo ngôn ngữ chung giữa ETL, backend nghiệp vụ, RAG và UI.

## 2. Miền dữ liệu chính

| Miền | Nội dung |
|------|----------|
| Đào tạo | học viên, giảng viên, lớp, môn học, chương trình, kế hoạch giảng dạy, điểm |
| Khảo thí & ĐBCL | đề thi, đáp án, lịch thi, phổ điểm, tuyển sinh, khảo sát |
| KHCN | đề tài, công bố, giáo trình, hồ sơ khoa học |
| Thư viện | đầu sách, tài liệu, mượn trả, thẻ bạn đọc |
| Điều hành / quản trị | user, role, audit, policy, ETL, cấu hình hệ thống |
| Tài liệu phi cấu trúc | PDF, DOCX, PPTX, XLSX, TXT và các tệp nghiệp vụ khác |

## 3. Nguyên tắc modeling

- Mọi bản ghi phải gắn được với đơn vị hoặc phạm vi khai thác.
- Dữ liệu có cấu trúc ưu tiên đưa vào Postgres.
- Tài liệu gốc và metadata khai thác RAG đi theo mô hình document catalog riêng.
- Mọi mã định danh từ hệ nguồn phải được bảo tồn để phục vụ lineage.

## 4. Thực thể quan trọng theo miền

### Đào tạo

- `hoc_vien`
- `giang_vien`
- `lop`
- `mon_hoc`
- `chuong_trinh_dao_tao`
- `diem`

### Khảo thí

- `de_thi`
- `dap_an`
- `pho_diem`
- `lich_thi`

### KHCN

- `de_tai_nckh`
- `giao_trinh`
- `bai_bao`
- `ly_lich_khoa_hoc`

### Tài liệu dùng cho AI

- `documents`
- `document_versions`
- `document_chunks`
- `processing_jobs`

## 5. Góc nhìn sản phẩm

- Người dùng cuối không quan tâm DB nào chứa dữ liệu; họ quan tâm câu trả lời đúng phạm vi và truy ngược được nguồn.
- Vì vậy domain này phải phục vụ đồng thời hai chế độ:
  - query có cấu trúc qua SQL curated
  - query phi cấu trúc qua RAG

## 6. Phần đã có và phần còn thiếu

- Đã có nền auth, chat, tài liệu, ETL, audit, admin.
- Module đào tạo/khảo thí/KHCN mới có schema và định hướng, chưa đủ API/UI nghiệp vụ chuyên sâu.
