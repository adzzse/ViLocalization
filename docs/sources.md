# Quản lý công cụ và giấy phép

Công cụ được lưu trực tiếp trong vendor/. sources.lock.json nhóm file theo chức
năng, ghi đường dẫn local và SHA256; `npm run check:sources` kiểm tra offline.
Metadata không tham gia nạp module hay chọn quy trình dịch.

## Công cụ hiện có

| Thành phần | File | Giấy phép |
| --- | --- | --- |
| Chia lô | vendor/vh-workflow/build_batches.cjs | [MIT](../vendor/licenses/VH-Workflow-Skill.txt) |
| Fitting chữ | vendor/text-fitting/layout.py và test_layout.py | [MIT](../vendor/licenses/python-tools-MIT.txt) |
| Giải nén ASAR | vendor/asar/unpack_asar.py | [MIT](../vendor/licenses/python-tools-MIT.txt) |

Thông báo bản quyền và toàn văn license phải được giữ khi phân phối mã có nguồn
gốc bên thứ ba. Giấy phép công cụ không cấp quyền đối với tài sản game.
Batch builder giữ thông tin nguồn riêng trong manifest; công cụ Python được quản
lý bằng phiên bản file local, hash và license.

## Hành vi cần bảo toàn

- Batch builder gom thoại theo cảnh và giữ ID; trường en chứa ngôn ngữ nguồn bất kỳ.
- ASAR kiểm tra header, đường dẫn, vùng dữ liệu, tên trùng, link và size sidecar trước
  khi ghi; chỉ chấp nhận thư mục output mới và giữ archive nguồn.
- Fitting chỉ xuất đề xuất. CLI thử các số hàng cho phép khi ước lượng ban đầu bỏ
  sót phương án vừa hộp; module lõi được kiểm bằng bộ regression đi kèm.
- Gate Node giữ token đúng hoa/thường, coverage, revision và cấu trúc trước rebuild.

## Cập nhật

Giữ thay đổi local, đọc diff/dependency/license rồi cập nhật SHA256 của file được
đổi trong manifest. `upstream_sha256` là hash phiên bản nhập ban đầu;
`modified: false` yêu cầu file vẫn trùng hash đó. Giữ bytes vendor nguyên qua
checkout để kết quả nhất quán trên Windows/Linux.

Chạy npm test, npm run demo và npm run test:tools. Nếu đổi adapter, chứng minh round
trip và kiểm lại phần game bị ảnh hưởng. Xem [cách dùng công cụ](tools.md) và
[quy trình kiểm chứng](../.agents/skills/viet-hoa-game/references/translation-workflow.md).
