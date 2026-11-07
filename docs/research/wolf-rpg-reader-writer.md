# WOLF RPG: lựa chọn bộ đọc/ghi cho ViLocalization

Khảo sát nguồn ngày 2026-11-07. Tài liệu này ghi bằng chứng từ README, source và
GitHub API; không khẳng định đã chạy thành công trên một game. Các phép thử dữ liệu
thật và kết quả tích hợp thuộc checkpoint của tác vụ.

## Đề xuất

Ưu tiên **WolfTL v0.6.2 + bridge JSON nhỏ** thay vì viết lại parser nhị phân.
WolfTL đã xử lý CommonEvent, database/schema và map; bridge chỉ chuyển những
trường đã phân loại sang corpus theo occurrence, rồi áp `final.json` vào bản dump
sao chép trước khi repack. Cách này giữ workflow/chia lô/QA hiện có và tránh thêm
Ruby hoặc các dependency Python chỉ phục vụ CLI. Đây là lựa chọn triển khai;
khả năng dùng được với từng game vẫn phải được chứng minh bằng round trip.
[WolfTL README](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/README.md),
[CLI source](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfTL.cpp).

## Phiên bản và nguồn cần pin

| Mục | Giá trị đã kiểm tra |
| --- | --- |
| Release | `v0.6.2` |
| Commit của tag | `77aca5017170d1c22190e695c60e4c9de75773e4` |
| Binary Windows | `WolfTL.exe`, 1,484,288 byte |
| SHA-256 GitHub asset | `a66ffcdb8efa6340b6003cb0afe0cb2bcf3aba5c14499d0b67f8fb868bcfc276` |
| Giấy phép công bố | MIT, Copyright (c) 2024 Sinflower |

Nguồn: [release API](https://api.github.com/repos/Sinflower/WolfTL/releases/tags/v0.6.2),
[tag ref](https://api.github.com/repos/Sinflower/WolfTL/git/ref/tags/v0.6.2),
[binary release](https://github.com/Sinflower/WolfTL/releases/download/v0.6.2/WolfTL.exe),
[LICENSE tại tag](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/LICENSE).
`main` hiện ở `bfc38fc2735ab4f7f7ddbec8d57b7fef65f0712f`; không dùng commit main
để mô tả chính xác binary của tag. Release note v0.6.2 ghi sửa xử lý Game.dat và
thêm kiểm tra map không hợp lệ.

## Hợp đồng CLI và tác động đến dữ liệu

Source của tag hỗ trợ cú pháp mới sau; README còn ví dụ positional mode cũ:

```text
WolfTL.exe DATA_PATH OUTPUT_PATH --create
WolfTL.exe DATA_PATH OUTPUT_PATH --patch
```

- `--create` tạo `OUTPUT_PATH/dump/mps`, `dump/db`, `dump/common` và JSON Game.dat.
- `--patch` đọc dump rồi ghi file runtime dưới `OUTPUT_PATH/patched/data`.
- `--skip-game_dat` bỏ đọc, xuất và ghi Game.dat.
- `--inplace` đổi đích ghi thành thư mục input; bridge không cần dùng cờ này.
- `--save_uncompressed`/`-s` tạo debug dump tại `uncompressed` dưới working directory;
  bridge không cần dùng cờ này.
- Constructor ở đường mặc định chỉ nạp dữ liệu; các đường ghi nằm ở ToJson/Patch/Dump.
  Source không có bước sửa Game.exe hay Game.ini trong luồng này. Vẫn cần đối chiếu
  hash input trước/sau khi thực thi, vì kiểm source không thay thế quan sát runtime.

Nguồn: [WolfTL.cpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfTL.cpp),
[WolfRPG.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/WolfRPG.hpp),
[WolfDataBase.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/WolfDataBase.hpp).

## Định dạng và giới hạn ảnh hưởng đến bridge

1. **Legacy và Unicode:** `MagicNumber` nhận byte `0x55` tại vị trí chỉ định để
   nhận diện Unicode; `FileCoder` có nhánh UTF-8 và Shift-JIS/CP932. Trạng thái
   `s_isUTF8` là static global, không lưu riêng cho mỗi object runtime. Dataset trộn
   encoding cần kiểm riêng, không được coi là hỗ trợ chỉ vì từng file đọc được.
   Nhánh Windows ghi CP932 qua `WideCharToMultiByte` không yêu cầu lỗi khi ký tự
   không biểu diễn được; tiếng Việt đầy đủ trên runtime legacy cần giải pháp
   renderer/encoding riêng, không chỉ chèn UTF-8 vào file CP932.
   [FileCoder.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/FileCoder.hpp).
2. **CommonEvent version:** WolfTL giữ byte version riêng, thay vì chỉ nhận đúng
   một header Unicode cố định. `0x93`/`0xCC` đi vào nhánh nén v3.5; byte version
   khác được giữ khi ghi. Điều này phù hợp hơn với header `...c9` đã quan sát ở
   game hiện tại, nhưng chưa chứng minh parser xử lý mọi record của game đó.
   [CommonEvents.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/CommonEvents.hpp).
3. **Map bị bỏ qua âm thầm:** `loadMaps` quét `.mps` đệ quy nhưng bắt
   `WolfRPGException` rồi bỏ file. Bridge phải đối chiếu danh sách input/dump;
   exit code 0 không chứng minh đã kiểm kê mọi map.
   [WolfRPG.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/WolfRPG.hpp).
4. **Database discovery:** lấy cặp `.project`/`.dat` trong BasicData, trừ
   `SysDataBaseBasic.project`. Schema, tên field, dữ liệu số và các string value
   được xuất chung; không được coi mọi string là văn bản người chơi thấy.
   [WolfRPG.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/WolfRPG.hpp),
   [Database.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/Database.hpp).
5. **Command JSON có cả dữ liệu kỹ thuật:** `code`, `codeStr`, `stringArgs`,
   `intArgs`; common event thêm `index`, map page dùng `list`. Các string có thể
   là path, comment, label hoặc điều kiện so sánh. Message 101 và Choices 102 có
   thể phân loại trực tiếp; Picture 150 cần kiểm loại picture, còn SetString,
   Database/CommonEvent arguments cần bằng chứng về cách dùng. Giữ metadata
   nguyên vẹn và chỉ sửa JSON pointer đã chọn.
   [Command.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/Command.hpp),
   [Map.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/Map.hpp).
6. **Archive và font:** WolfTL đọc `.dat`/`.project`/`.mps`, không thay thế bước
   giải nén `.wolf`. Game.dat JSON gồm title/message và font; dịch title hay đổi
   font là quyết định riêng, không tự dịch tên font. Repack/readback không chứng
   minh font, fitting, save/load hay engine đã render tiếng Việt đúng.
   [README](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/README.md),
   [GameDat.hpp](https://github.com/Sinflower/WolfTL/blob/77aca5017170d1c22190e695c60e4c9de75773e4/WolfTL/WolfRPG/GameDat.hpp).

## Những lựa chọn đã so sánh

- **wolftrans_py:** Python port ở commit
  `d9b900434a2e0bfa6a8a6b30314c90afd10ade02`; có core parser các format cần thiết
  và tùy chọn UTF-8. Tuy nhiên CommonEvents chỉ chấp nhận magic Unicode kết thúc
  `0x90`, khác `0xc9` đã quan sát; decoder có nhánh bỏ byte lỗi và writer có nhánh
  fallback encoding, nên không dùng nguyên trạng cho yêu cầu lossless. CLI thêm
  ruamel.yaml/colorama; LICENSE công bố Unlicense trong khi setup.py vẫn ghi MIT.
  [README](https://github.com/UserUnknownFactor/wolftrans_py/blob/d9b900434a2e0bfa6a8a6b30314c90afd10ade02/README.md),
  [CommonEvents](https://github.com/UserUnknownFactor/wolftrans_py/blob/d9b900434a2e0bfa6a8a6b30314c90afd10ade02/wolfrpg/common_events.py),
  [FileCoder](https://github.com/UserUnknownFactor/wolftrans_py/blob/d9b900434a2e0bfa6a8a6b30314c90afd10ade02/wolfrpg/filecoder.py),
  [requirements](https://github.com/UserUnknownFactor/wolftrans_py/blob/d9b900434a2e0bfa6a8a6b30314c90afd10ade02/requirements.txt),
  [LICENSE](https://github.com/UserUnknownFactor/wolftrans_py/blob/d9b900434a2e0bfa6a8a6b30314c90afd10ade02/LICENSE),
  [setup.py](https://github.com/UserUnknownFactor/wolftrans_py/blob/d9b900434a2e0bfa6a8a6b30314c90afd10ade02/setup.py).
- **Wolf Trans Ruby gốc:** MPL-2.0, bản README đang ở commit
  `dcf5d7625868e38597e161bf1e3f383841785de1` năm 2017; cần Ruby và CLI cảnh báo
  xóa output nếu đã tồn tại. Không chọn luồng này cho tích hợp mới.
  [README](https://github.com/elizagamedev/wolftrans/blob/dcf5d7625868e38597e161bf1e3f383841785de1/README.md),
  [LICENSE](https://github.com/elizagamedev/wolftrans/blob/dcf5d7625868e38597e161bf1e3f383841785de1/LICENSE).
- **Translator++/WolfJS:** tác giả công bố tự nhận version và điều khiển read/write
  encoding từ WolfJS 1.2, nhưng đây là lựa chọn ứng dụng lớn hơn, chưa xác lập được
  package parser độc lập có hợp đồng/giấy phép phù hợp trong phạm vi khảo sát này.
  [Changelog chính chủ](https://dreamsavior.net/translator-ver-5-10-31-automatic-character-encoding-for-wolf-rpg-engine/).

## Điều kiện chấp nhận tích hợp

Mã hiển thị WOLF phân biệt hoa/thường, gồm cả mã đơn không có ngoặc như
`\>`, `\.`, `\^`, `\E`, dạng có dấu như `\f+[n]`, biến `\v1[n]` và biến lồng nhau.
Cầu nối giữ literal trong `tokens` từng occurrence và bổ sung kiểm thứ tự vào QA;
đọc ngược binary đơn thuần không phát hiện việc người dịch vô tình xóa mã.
Nguồn: [manual special words của engine](https://smokingwolf.github.io/tool_wolf_rpg_editor/help/06specialword.html).

- Binary/dependency được pin nguồn, hash và license; lệnh offline sau khi chuẩn bị.
- Input giữ nguyên hash; output mới tách khỏi game và save.
- Đối chiếu inventory của `.mps` và cặp database với dump, báo rõ nguồn còn thiếu.
- Identity round trip giống byte cho format đã nhận; nếu có normalize/decrypt,
  báo file và lý do cụ thể, đồng thời kiểm decoded equality và metadata ngoài text.
- Thử chuỗi tiếng Việt tổng hợp với token, xuống dòng, dấu ngoặc và độ dài khác
  nguồn; repack rồi trích lại phải khớp chính xác.
- Fixture tự tạo kiểm malformed/missing IDs, stale source/hash và chỉ sửa trường
  allowlist. Không đưa dữ liệu game thật vào test/repo.
- Báo riêng phạm vi parser đã chứng minh và phần runtime/font chưa playtest.
