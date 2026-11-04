# Công cụ hỗ trợ Việt hóa

Các công cụ chạy trực tiếp trong workspace. Manifest sources.lock.json giữ SHA256
để kiểm tra file local; giấy phép nằm trong vendor/licenses/.

## Workflow và skill

Skill `$viet-hoa-game` hướng dẫn các mốc:

- Census text theo occurrence, phân biệt coverage đã phát hiện với đã kiểm kê đầy đủ.
- Canary để thử đúng field/loader trước khi dịch rộng; identity/source hash để resume.
- Hồ sơ speaker có bằng chứng, nguồn phần game trước, rà thoại theo cảnh và đối chiếu nguồn.
- Fitting theo cả width và số hàng; kiểm riêng font tiếng Việt, biến runtime và từng vùng UI.
- Native QA theo thay đổi, save/load và kiểm allowlist/hash của patch, giữ giới hạn kiểm chứng rõ.

Hướng dẫn chi tiết nằm trong [reference của skill](../.agents/skills/viet-hoa-game/references/translation-workflow.md).
Mẫu PROGRESS.md ghi census, canary và native QA cùng tiến độ lô.
Đường dịch mặc định là agent trực tiếp. Corpus hỗ trợ ngôn ngữ nguồn bất kỳ;
census của game phải dùng quy tắc tương ứng với ngôn ngữ đó.

## Fitting độc lập

Python 3.10+, không pip dependency. Đặt một message trong file UTF-8 rồi chạy:

```powershell
python -X utf8 scripts/fit_text.py --input projects/my-game/message.txt --width 40 --lines 3
```

Lệnh in JSON gồm text đề xuất, rows, widest_cells, fits và `approximate: true`.
Exit 0 khi vừa giới hạn cell; exit 1 khi không vừa; input lỗi trả mã khác 0.
Không ghi đè input, corpus hay E/. Đề xuất chuẩn hóa NFC để đo chữ Việt nhất quán.

Module `vendor/text-fitting/layout.py` cung cấp các hàm reflow,
fit_width, fit_box, line_count, widest và restore_indent. Bản test upstream được giữ lại.
Width là cell ước lượng, không phải pixel/font metrics. Với markup/control code,
adapter của game cần mask token thành atom không có khoảng trắng trước fitting,
restore token và chạy QA sau đó. Chỉ áp dụng revision ngắt dòng khi ENGINE.md/qa.json
cho phép; công cụ không tự sửa quy tắc giữ newline. Cần đo renderer/font thật để chốt layout.

## Giải nén ASAR độc lập

```powershell
python -X utf8 vendor/asar/unpack_asar.py C:/Games/MyGame/resources/app.asar projects/my-game/decoded
```

Nếu game có file rời cạnh archive, truyền `--unpacked-dir <app.asar.unpacked>`.
Thư mục output phải chưa tồn tại. Script kiểm header, phạm vi offset/size, đường dẫn
và tên trùng trước khi ghi; giữ archive đầu vào. Sidecar phải khớp size khai báo.
Link ASAR và sidecar bị thiếu sẽ báo
lỗi thay vì xuất kết quả thiếu mà coi như đầy đủ.

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

Chỉ thêm tool/script đúng nhu cầu khi gặp engine cụ thể; đọc dependency và license,
kiểm tra input/output và chứng minh round trip trước khi dùng với text game.
