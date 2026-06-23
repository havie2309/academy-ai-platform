# CHECK-2026-06-23 — initial-docs-standard

## Date

- 2026-06-23

## Related component

- Bộ tài liệu `docs/`
- Lớp định hướng cho AI/code assistant

## Related docs/code files

- `docs/INDEX.md`
- `docs/B_Architecture/B6_Component_Registry.md`
- `docs/B_Architecture/B7_Sequence_Diagrams.md`
- `docs/G_Planning/G3_Decision_Memory.md`
- `docs/G_Planning/G4_Check_Tren/README.md`
- `docs/G_Planning/G4_Check_Tren/TEMPLATE.md`

## Context

- Dự án đã có bộ docs chuẩn ban đầu trong `docs/`.
- Tuy nhiên bộ docs này chưa đủ mạnh cho việc hiểu hệ thống ở cấp component và chưa có cơ chế lưu vết khi AI bị chỉnh hướng trước khi chốt.

## Initial AI proposal

- Tạo `docs/INDEX.md` theo kiểu bộ spec chuẩn và dựng các nhóm tài liệu A-G.

## Problems in the initial proposal

- Chưa có component-level registry để AI/dev/reviewer nhìn nhanh trách nhiệm từng phần.
- Chưa có sequence diagram cho các flow liên service quan trọng.
- Chưa có cơ chế `Check-tren` để lưu vết reasoning trace khi AI bị user/team điều chỉnh hướng.

## User/team feedback

- Cần tăng độ chi tiết tài liệu kỹ thuật cho từng component.
- Cần thêm `B6_Component_Registry.md`.
- Cần thêm `B7_Sequence_Diagrams.md`.
- Cần có cơ chế `G4_Check_Tren/` với README, template và ví dụ đầu tiên.

## Final agreed direction

- Thêm `B6 Component Registry`.
- Thêm `B7 Sequence Diagrams`.
- Thêm thư mục `G4_Check_Tren/` gồm README, template và sample đầu tiên.
- Giữ nguyên source code; chỉ tăng cường tài liệu.

## Rationale

- Bộ docs phải đủ cho AI/code assistant hiểu hệ thống ở mức component trước khi đề xuất thay đổi.
- Cần tách rõ ba lớp: quyết định cuối (`G3`), diff file (Git), và reasoning/change trace (`Check-tren`).

## Impact

- `docs/INDEX.md` được mở rộng để link tới `B6`, `B7`, `G4`.
- Thứ tự đọc theo vai trò và bảng milestone được cập nhật.
- `G3_Decision_Memory.md` được nối thêm rule về Check-tren và các quyết định nền bắt buộc.

## Follow-up tasks

- Khi có thay đổi lớn ở auth/chat/RAG/ETL/admin flow, cập nhật thêm file Check-tren tương ứng nếu AI từng bị chỉnh hướng.
- Dùng `B6` và `B7` như checkpoint bắt buộc trước khi đề xuất refactor liên service.

## Lesson for future AI/code assistant runs

- Trước khi đề xuất thay đổi kiến trúc hoặc code lớn, phải đọc:
  - `docs/INDEX.md`
  - `B1` đến `B7`
  - `G3_Decision_Memory.md`
  - các file liên quan trong `G4_Check_Tren/`
- Không được xem `docs/INDEX.md` như repo map đơn thuần khi team đã yêu cầu bộ spec chuẩn.
