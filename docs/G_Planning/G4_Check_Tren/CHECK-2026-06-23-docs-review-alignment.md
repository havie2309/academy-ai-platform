# CHECK-2026-06-23 — docs-review-alignment

## Date

- 2026-06-23

## Related component

- Bộ tài liệu `docs/`
- Lớp mô tả API, deployment, component registry, sequence diagrams

## Related docs/code files

- `docs/INDEX.md`
- `docs/B_Architecture/B3_API_Contracts.md`
- `docs/B_Architecture/B6_Component_Registry.md`
- `docs/B_Architecture/B7_Sequence_Diagrams.md`
- `docs/C_UI_UX/C1_Screen_Inventory.md`
- `docs/D_Operations/D1_Deployment_Architecture.md`
- `docs/D_Operations/D4_Local_Dev_Runbook.md`
- `docs/G_Planning/G3_Decision_Memory.md`

## Context

- Bộ docs đã tồn tại và nhìn bề ngoài khá đầy đủ.
- Tuy nhiên review chỉ ra rằng một số phần của docs đang mô tả rộng hơn implementation thật trong repo hiện tại.

## Initial AI proposal

- Xây bộ spec tương đối đầy đủ để làm source of truth cho PM2.
- Dùng docs như một lớp mô tả chuẩn ở mức hệ thống, component và planning.

## Problems in the initial proposal

- Một số chỗ deployment docs mô tả như thể `ai` profile và full app compose đã sẵn sàng.
- API contracts còn rút gọn quá mức, chưa bám đúng route/controller thực.
- Component registry chưa phủ hết `workflow`, `notification`, `platform scaffold`.
- Sequence diagrams có chỗ dùng flow khái niệm thay cho current implementation.

## User/team feedback

- Deployment docs, API contracts, component registry và sequence diagrams phải được kéo về khớp implementation thật trong repo.
- Docs phải tách rõ `current implementation` và `target architecture`.
- Code phải giữ nguyên; chỉ sửa docs.

## Final agreed direction

- Cập nhật docs để bám current repo state.
- Tách rõ phần current và target trong deployment docs và sequence diagrams.
- Viết lại API contracts theo route/controller/service thật.
- Bổ sung status `implemented / partial / stub / planned` cho component registry.
- Giữ source code untouched.

## Rationale

- Nếu docs được dùng như source of truth cho AI/code assistant mà không bám implementation thật, các đề xuất sau sẽ tiếp tục lệch hướng.
- Cần biến docs thành tài liệu đáng tin cậy hơn, thay vì chỉ là mô tả đẹp ở mức ý tưởng.

## Impact

- `INDEX.md` được sửa mô tả và link backlog.
- `B3`, `B6`, `B7`, `C1`, `D1`, `D4`, `G3` được cập nhật để bám implementation hiện tại hơn.
- Quy tắc `Check-tren` được dùng thêm cho một lần review-driven correction thực tế.

## Follow-up tasks

- Khi có thay đổi route/controller hoặc compose profile mới, cập nhật lại `B3`, `D1`, `D4`.
- Khi ETL/admin/self-service được làm thật, cập nhật `C1`, `B6`, `B7`.
- Khi có thêm đợt AI bị team chỉnh hướng lớn, tiếp tục tạo file Check-tren mới.

## Lesson for future AI/code assistant runs

- Trước khi xem docs là source of truth, phải kiểm tra ít nhất một vòng với implementation thật.
- Khi docs và code khác nhau, không được tự chọn kiến trúc đẹp hơn; phải:
  - cập nhật docs,
  - hoặc đánh dấu rõ `partial/planned`,
  - hoặc mở `Needs decision` nếu chưa chốt.
