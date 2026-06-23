# G4 — Check-tren

## 1. Check-tren là gì

`Check-tren` là cơ chế lưu vết khi AI/code assistant đề xuất một hướng triển khai hoặc thiết kế, nhưng user/team đã sửa, nắn lại hoặc đổi hướng trước khi chốt.

Nói ngắn gọn:

- Git commit ghi **file nào đã đổi**
- `G3_Decision_Memory.md` ghi **quyết định cuối cùng là gì**
- `Check-tren` ghi **quá trình từ đề xuất ban đầu của AI đến hướng cuối cùng được đồng thuận**

## 2. Khi nào phải tạo file Check-tren

Tạo một file Check-tren khi có đủ hai điều kiện:

1. AI/code assistant đã đề xuất một hướng implementation, architecture, documentation hoặc workflow.
2. User/team đã chỉnh hướng, bác bỏ một phần, hoặc yêu cầu đổi sang hướng khác trước khi chốt.

Ví dụ thường gặp:

- AI hiểu sai mục đích tài liệu và cần viết lại theo chuẩn khác.
- AI muốn đổi storage/component flow nhưng user/team giữ source of truth cũ.
- AI đề xuất UI/API/AI flow mới nhưng team yêu cầu bám theo chuẩn nội bộ khác.

## 3. Quy ước đặt tên

```text
CHECK-YYYY-MM-DD-short-title.md
```

Ví dụ:

```text
CHECK-2026-06-23-initial-docs-standard.md
```

## 4. Nội dung bắt buộc

Mỗi file Check-tren phải có:

- Bối cảnh
- Đề xuất ban đầu của AI
- Vấn đề trong đề xuất ban đầu
- Feedback của user/team
- Hướng cuối cùng được chốt
- Lý do chọn hướng đó
- File tài liệu/code bị ảnh hưởng
- Bài học cho các lần chạy AI sau

## 5. Quan hệ với Git commit và Decision Memory

### Git commit

- Trả lời câu hỏi: "Đã đổi file nào?"
- Phù hợp để xem diff kỹ thuật.

### `G3_Decision_Memory.md`

- Trả lời câu hỏi: "Quyết định cuối cùng là gì?"
- Phù hợp để nhớ các nguyên tắc đã chốt.

### `Check-tren`

- Trả lời câu hỏi: "AI đã đề xuất gì, bị chỉnh ở đâu, và vì sao?"
- Phù hợp để tránh lặp lại cùng một lỗi hiểu sai trong các lần hỗ trợ sau.

## 6. Quy tắc bắt buộc

- Bất kỳ khi nào AI đề xuất implementation/design và user/team chỉnh hướng trước khi phê duyệt cuối, phải thêm một file Check-tren.
- Không dùng Check-tren để thay thế commit history hoặc decision memory; đây là lớp trace bổ sung.
- Trước khi AI/code assistant đề xuất thay đổi lớn, cần đọc:
  - `docs/INDEX.md`
  - nhóm `B1` đến `B7`
  - `G3_Decision_Memory.md`
  - các file liên quan trong `G4_Check_Tren/`

## 7. File trong thư mục này

- [TEMPLATE.md](TEMPLATE.md): mẫu chuẩn để tạo file mới
- [CHECK-2026-06-23-initial-docs-standard.md](CHECK-2026-06-23-initial-docs-standard.md): ví dụ đầu tiên
- [CHECK-2026-06-23-docs-review-alignment.md](CHECK-2026-06-23-docs-review-alignment.md): ví dụ cho đợt review buộc docs quay về bám implementation thật
