# Nguồn và phần tái sử dụng

Đối chiếu ngày 2026-11-04. Commit cố định ở sources.lock.json; clone local trong tools/
để đọc source, không được đưa nguyên hai repository vào Git của ViLocalization.

| Nguồn | Commit | Dùng ở đây |
| --- | --- | --- |
| [kann420/VH-Workflow-Skill](https://github.com/kann420/VH-Workflow-Skill/tree/1edff3bb871c198ba8955e6152c3e3b7d7b9bec8) | 1edff3bb871c198ba8955e6152c3e3b7d7b9bec8 | Research trước, hồ sơ nhân vật/xưng hô, cẩm nang theo game, corpus, chia lô theo cảnh, QA và round trip |
| [dazedanon/DazedTL](https://github.com/dazedanon/DazedTL/tree/942029800374c586de02d720704d450bfeb6ac52) | 942029800374c586de02d720704d450bfeb6ac52 | Pilot, scope/coverage, không gộp dòng chỉ vì giống text, helper/app boundary, checkpoint, playtest, patch |

## Mã và license

`vendor/vh-workflow/build_batches.cjs` là bản sao nguyên nội dung
`skills/game-localization-vi/scripts/build_batches.js` từ commit VH bên trên;
chỉ đổi đuôi sang .cjs để giữ CommonJS trong repo dùng ESM.
Thông báo MIT được giữ nguyên ở [VH-Workflow-Skill.txt](../vendor/licenses/VH-Workflow-Skill.txt).
Cẩm nang/skill/quy trình ở đây được viết thích nghi từ phương pháp upstream.

Không copy mã runtime DazedTL vào workflow; giữ clone nguyên trạng để dùng tùy chọn.
Giữ thông báo nguồn MIT của nó tại [DazedTL.txt](../vendor/licenses/DazedTL.txt).
License này chỉ nói về hai nguồn công cụ, không cấp quyền đối với tài sản của game.

## Lựa chọn khi thích nghi

- Skill ở `.agents/skills/` cho phạm vi repo; không cài global hay thay cấu hình Codex.
- Mặc định một agent tuần tự. Chỉ song song khi được yêu cầu; mỗi worker sở hữu lô/file riêng.
- Clone mới bật core.longpaths trong cấu hình riêng của clone để Git Windows lấy đủ đường dẫn dài; không sửa cấu hình Git toàn máy.
- Giữ tên `en` để tương thích batch builder, nhưng không ép nguồn phải là tiếng Anh.
- Không dùng validator/finalizer upstream làm release gate: validator của nguồn in lỗi
  mà không đặt failure exit code và so sánh token sau khi lowercase; finalizer có
  thể ghi output khi còn rejected rows. Gate riêng kiểm tra đúng hoa/thường, coverage,
  revision và cấu trúc trước khi finalize/rebuild.
- Mỗi occurrence giữ ID riêng; không dùng dupOf/link tự động vì ngữ cảnh có thể khác.
- DazedTL là tích hợp tùy chọn qua app/helper của nó, không import engine nội bộ
  và không tự suy diễn schema/API tương thích với corpus này.

## Cập nhật nguồn

Đọc diff/changelog và phạm vi language support trước khi đổi commit trong sources.lock.json.
`npm run setup:tools` chặn clone sai commit hoặc có thay đổi thay vì reset dữ liệu.
Chủ động review clone và checkout commit mới sau khi đã bảo toàn thay đổi local.
Khi cập nhật batch builder: copy file mới, giữ license, chạy test/demo và cập nhật
ghi chú nguồn. Không thay đổi pin chỉ để lấy latest mà chưa kiểm chứng lại.
