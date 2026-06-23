# F2 — Auth, Session & Token Policy

## 1. Mục tiêu

- Chuẩn hóa cách xác thực và duy trì phiên người dùng.
- Giảm rủi ro token dài hạn, replay và lẫn lộn giữa public API với internal API.

## 2. Mô hình token

| Loại | TTL mục tiêu | Lưu ở đâu | Mục đích |
|------|--------------|-----------|----------|
| Access token | ngắn hạn, khoảng 15 phút | frontend runtime | gọi API public |
| Refresh token | dài hơn, khoảng 7 ngày | HttpOnly cookie | đổi access token mới |

## 3. Quy tắc session

- Mỗi login tạo session mới.
- Refresh phải rotate token và cập nhật session.
- Logout phải revoke session hiện tại.
- Refresh token chỉ lưu dạng hash trong DB.

## 4. Chính sách credential

- Password người dùng phải được hash kèm salt và iteration count.
- Seed local có thể đơn giản về mật khẩu mẫu nhưng không bỏ qua cơ chế hash chuẩn.
- Service-to-service dùng internal key riêng, không dùng access token người dùng.

## 5. Public vs internal route

| Loại route | Cách bảo vệ |
|------------|-------------|
| Public API | JWT + role/scope guard |
| Refresh | HttpOnly cookie + session validation |
| Internal config route | Internal key |
| Hidden internal route | Không expose qua gateway public nếu không cần |

## 6. Audit tối thiểu

- login thành công/thất bại
- refresh
- logout
- revoke session
- thay đổi policy auth nếu có

## 7. Gaps còn lại

- CRUD user và quản lý tài khoản chưa hoàn tất.
- Rate limit và security abuse scenario cần tăng cường thêm.
