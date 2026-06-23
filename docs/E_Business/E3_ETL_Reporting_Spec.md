# E3 — ETL & Reporting Spec

## 1. Mục tiêu

- Chuẩn hóa cách PM2 đồng bộ dữ liệu nguồn và quan sát được chất lượng đồng bộ.
- Tạo đầu vào đáng tin cho module nghiệp vụ, SQL curated và dashboard quản trị.

## 2. Loại sync

| Loại | Mục đích |
|------|----------|
| Batch sync | Đồng bộ định kỳ theo lịch |
| Manual sync | Chạy tay khi cần kiểm thử hoặc backfill |
| Event-driven sync | Giai đoạn sau, khi hệ nguồn hỗ trợ |

## 3. Hợp đồng tối thiểu của một ETL source

- tên nguồn
- loại connector
- cấu hình kết nối
- mapping trường
- khóa nhận diện record đích
- trạng thái active/inactive
- lịch chạy hoặc trigger mode

## 4. Dấu vết bắt buộc

| Bảng / artifact | Vai trò |
|-----------------|---------|
| `etl_sources` | metadata source |
| `etl_jobs` | định nghĩa job |
| `etl_runs` | từng lần chạy |
| `etl_lineage` | record-level hoặc batch-level lineage |
| `etl_error_logs` | lỗi transform/load |

## 5. Quy tắc transform/load

- Không ghi đè bừa nếu thiếu khóa mapping.
- Row lỗi phải bị cô lập và ghi log, không làm rơi cả batch nếu có thể.
- Response sau load phải có `loadSummary`.
- Password trong response source luôn bị mask.

## 6. Chỉ số vận hành ETL

| Chỉ số | Ý nghĩa |
|--------|---------|
| `runs succeeded / failed` | độ ổn định |
| `rows read / loaded / skipped / errored` | chất lượng đồng bộ |
| `last_success_at` | freshness |
| `lineage coverage` | khả năng truy vết |

## 7. Kết nối với reporting

- Reporting dạng SQL cần dữ liệu curated sau ETL.
- Dashboard admin ETL nên đọc từ `etl_runs` và `etl_error_logs`.
- Khi triển khai self-service/report nâng cao, ETL freshness phải được đưa vào metadata hiển thị.

## 8. Khoảng trống hiện tại

- Chưa smoke với SQL Server nguồn thật.
- Chưa có UI ETL hoàn chỉnh trên web-ui.
- Event-driven sync mới ở mức định hướng.
