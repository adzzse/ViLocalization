# Phần tái sử dụng từ DazedTL

ViLocalization lấy phương pháp và các file cụ thể từ DazedTL. Toàn bộ thao tác chạy
trong skill/script của repo; không cần app, launcher, project.py, endpoint hay full clone.
Nguồn/commit/hash ở sources.lock.json, MIT notice ở vendor/licenses/DazedTL.txt.

## Workflow và skill

Skill `$viet-hoa-game` đã tích hợp các mốc từ game-translation/setup-generic-game:

- Census text theo occurrence, phân biệt coverage đã phát hiện với đã kiểm kê đầy đủ.
- Canary để thử đúng field/loader trước khi dịch rộng; identity/source hash để resume.
- Hồ sơ speaker có bằng chứng, nguồn phần game trước, rà thoại theo cảnh và đối chiếu nguồn.
- Fitting theo cả width và số hàng; kiểm riêng font tiếng Việt, biến runtime và từng vùng UI.
- Native QA theo thay đổi, save/load và kiểm allowlist/hash của patch, giữ giới hạn kiểm chứng rõ.

Hướng dẫn chi tiết nằm trong [reference của skill](../.agents/skills/viet-hoa-game/references/dazed-workflow.md).
Mẫu PROGRESS.md ghi census, canary và native QA cùng tiến độ lô.
Đường dịch mặc định vẫn là agent trực tiếp; không mang bộ lọc census tiếng Nhật hay
giới hạn cặp hệ chữ của app vào corpus tiếng Việt này.

## Fitting độc lập

Python 3.10+, không pip dependency. Đặt một message trong file UTF-8 rồi chạy:

```powershell
python -X utf8 scripts/fit_text.py --input projects/my-game/message.txt --width 40 --lines 3
```

Lệnh in JSON gồm text đề xuất, rows, widest_cells, fits và `approximate: true`.
Exit 0 khi vừa giới hạn cell; exit 1 khi không vừa; input lỗi trả mã khác 0.
Không ghi đè input, corpus hay E/. Đề xuất chuẩn hóa NFC để đo chữ Việt nhất quán.

Module gốc `vendor/dazedtl/text-fitting/layout.py` giữ nguyên các hàm reflow,
fit_width, fit_box, line_count, widest và restore_indent. Bản test upstream được giữ lại.
Width là cell ước lượng, không phải pixel/font metrics. Với markup/control code,
adapter của game cần mask token thành atom không có khoảng trắng trước fitting,
restore token và chạy QA sau đó. Chỉ áp dụng revision ngắt dòng khi ENGINE.md/qa.json
cho phép; công cụ không tự sửa quy tắc giữ newline. Cần đo renderer/font thật để chốt layout.

## Giải nén ASAR độc lập

```powershell
python -X utf8 vendor/dazedtl/asar/unpack_asar.py C:/Games/MyGame/resources/app.asar projects/my-game/decoded
```

Nếu game có file rời cạnh archive, truyền `--unpacked-dir <app.asar.unpacked>`.
Thư mục output phải chưa tồn tại. Script kiểm header, phạm vi offset/size, đường dẫn
và tên trùng trước khi ghi; giữ archive đầu vào. Sidecar phải khớp size khai báo.
Link ASAR và sidecar bị thiếu sẽ báo
lỗi thay vì xuất kết quả thiếu mà coi như đầy đủ. Bản tách có thay đổi bảo vệ output
so với upstream, được ghi trong docs/sources.md.

Đây là giải nén container, chưa phải extract corpus hay repack/inject của Tyrano/Electron.
Chọn parser theo resource loader, giữ encoding/byte spans và chứng minh round trip
trước khi dịch. Xem [engine routing](../.agents/skills/viet-hoa-game/references/engine-routing.md).

## Kiểm tra và cập nhật

```powershell
npm run check:sources
npm run test:tools
```

Hai lệnh chạy offline. Python tests gồm các regressions fitting gốc và fixture ASAR
tự tạo; chúng không thay thế việc thử trên một game thật.

Chỉ lấy thêm file/script/skill đúng nhu cầu khi gặp engine cụ thể, đọc dependency
và license trước khi dùng. Helper UI, provider queue, checkpoint gateway và updater
của app chưa được port thành tính năng độc lập ở đây; việc clone app không nằm trong setup.
