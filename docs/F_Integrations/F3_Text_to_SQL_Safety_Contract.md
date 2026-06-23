# F3 — Text-to-SQL Safety Contract

## 1. Mục tiêu

- Cho phép hỏi dữ liệu bằng ngôn ngữ tự nhiên nhưng không đánh đổi an toàn dữ liệu.
- Biến SQL route thành một năng lực bị giới hạn rõ ràng, không phải cửa sau vào DB.

## 2. Nguyên tắc cứng

- Chỉ `SELECT`.
- Chỉ một statement.
- Chỉ chạy bằng credential read-only.
- Chỉ truy cập catalog curated.
- Mọi lần chạy phải có audit.

## 3. Input cho model

Model chỉ được thấy:

- schema/view curated
- mô tả cột
- quy tắc business chính
- yêu cầu format SQL

Model không được thấy:

- password
- bảng raw không nằm trong catalog
- quyền ghi hoặc lệnh DDL/DML

## 4. Chuỗi kiểm soát

1. Router xác định đây là câu hỏi SQL.
2. LLM sinh SQL nháp.
3. Validator chặn keyword nguy hiểm, multi-statement, comment injection, thiếu `LIMIT`.
4. Chỉ khi pass mới thực thi bằng `pm2_readonly`.
5. Kết quả được format thành bảng thân thiện và ghi audit.

## 5. Điều kiện chặn

| Tình huống | Hành vi |
|-----------|---------|
| Có `INSERT/UPDATE/DELETE/ALTER/DROP` | từ chối |
| Nhiều statement hoặc có `;` | từ chối |
| Không map được với catalog curated | từ chối |
| User không được cấp SQL route | từ chối |
| DB/read-only path không sẵn sàng | báo lỗi hệ thống, không bịa câu trả lời |

## 6. Kết quả trả ra UI

- Trả bảng dễ đọc.
- Nếu cần, có thể kèm mô tả ngắn bằng tiếng Việt.
- Không được lộ SQL nhạy cảm hoặc metadata ngoài phạm vi khi UI không yêu cầu.

## 7. Regression bắt buộc

- Câu hỏi hợp lệ tạo SQL đúng format.
- Câu hỏi độc hại bị chặn 100%.
- Kết quả bảng dài vẫn render tốt ở chat UI.
- Audit log giữ được prompt, route và trạng thái validator.
