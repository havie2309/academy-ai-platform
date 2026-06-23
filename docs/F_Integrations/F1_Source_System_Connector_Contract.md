# F1 — Source System Connector Contract

## 1. Mục tiêu

- Xác định cách PM2 nói chuyện với hệ nguồn mà không làm tăng rủi ro ghi sai dữ liệu.
- Chuẩn connector phải đủ dùng cho metadata discovery, sample read và batch sync.

## 2. Nguyên tắc

- Read-only từ hệ nguồn.
- Không cho UI gửi SQL raw để chạy trực tiếp.
- Mọi lần đọc dữ liệu phải truy vết được qua `etl_runs` và `etl_lineage`.

## 3. Connector ưu tiên hiện tại

| Loại | Trạng thái |
|------|------------|
| SQL Server read-only | Đã có nền connector và API discovery/sample |
| Các nguồn khác | Chưa chuẩn hóa |

## 4. Hợp đồng source

| Trường | Ý nghĩa |
|--------|---------|
| `sourceId` | định danh nguồn |
| `sourceType` | ví dụ `sqlserver` |
| `connectionConfig` | host, port, db, user, password masked khi trả ra |
| `mappings` | field mapping và target |
| `schedule` | cron hoặc manual |
| `isActive` | bật/tắt nguồn |

## 5. Hợp đồng thao tác

| Thao tác | Kết quả mong đợi |
|----------|------------------|
| Ping | Xác thực nguồn reachable và credential hợp lệ |
| Discover tables | Trả bảng khả dụng |
| Discover columns | Trả schema cột |
| Sample rows | Trả sample có giới hạn, không dùng query tùy ý |
| Batch sync | Tạo run, transform/load, lưu lineage |

## 6. Ràng buộc an toàn

- Không lưu plain password trong response API.
- Không mở quyền write-back về nguồn.
- Không cho phép multi-statement hoặc ad-hoc SQL từ người dùng web.

## 7. Tiêu chí sẵn sàng tích hợp thật

- Ping được nguồn thật.
- Đọc được metadata thật.
- Chạy một batch sync nhỏ có lineage và không lộ secret.
