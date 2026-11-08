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

## RPG Maker MV

Node.js 22+ để extract/QA; Python 3.10+ có trên PATH khi rebuild để tạo và đọc lại ZIP.
Không cần npm/pip dependency. Truyền thư mục `www` chứa `data/`, `js/` của MV;
adapter kiểm `Utils.RPGMAKER_NAME` và từ chối MZ. Project phải nằm ngoài thư mục game.

```powershell
node scripts/workflow.mjs init my-mv-1-0 en
node scripts/workflow.mjs extract-mv projects/my-mv-1-0 "D:/Games/MyGame/www"
node scripts/workflow.mjs batch projects/my-mv-1-0
node scripts/workflow.mjs export-dialogue projects/my-mv-1-0
```

Chuẩn bị/duyệt spec và cẩm nang trước khi ghi bản dịch vào `E/`. Pipeline revision,
QA và finalize dùng các lệnh hiện có:

```powershell
node scripts/workflow.mjs check projects/my-mv-1-0
node scripts/workflow.mjs finalize projects/my-mv-1-0
node scripts/workflow.mjs rebuild projects/my-mv-1-0
```

**Nguồn được chọn:**

- Map/CommonEvents/Troops: khối 101+401, 105+405; một khối là một occurrence `dlg`,
  giữ số dòng và thứ tự slot. ID gắn file/event/page/command của đúng build nguồn.
- Choice 102: một occurrence cho mỗi lựa chọn, đồng thời ghi các nhãn 402 khớp
  nguyên văn cùng nhánh. Nhãn không khớp làm extract thất bại để rà nguồn.
- Map displayName; tên/profile/nickname Actor; name/description database đã chọn;
  State messages; System terms, loại trang bị/kỹ năng/nguyên tố, currencyUnit/gameTitle.
  Tên event, switch/variable, asset paths, note tags và script không được dịch tự động.
- Galv_QuestLog: tên quest, từng objective/resolution và dòng mô tả trong file
  `Folder`/`File` đang cấu hình (thư mục `quest/` hoặc `data/`), giữ ID/category,
  dấu phân cách và xuống dòng. Dấu `:` trong tên quest bị chặn vì parser runtime
  dùng dấu này để tách ID. Các đoạn resolution phân cách bằng `|` giữ riêng.
- `plugins.js` phải là `var $plugins = <JSON array>;`; không eval JavaScript.
  Chọn các nhãn UI của Galv_QuestLog và RecipeCrafting đang bật, cùng tên category
  Galv. Các giá trị công thức, đường dẫn, màu category và plugin tắt giữ nguyên.

`mv-report.json` ghi số occurrence theo nguồn/loại, lệnh script hoặc dòng thoại
không có header bị bỏ qua, các plugin chưa kiểm kê text và TXT chưa có parser.
`dlg` đếm khối thoại; `choice` đếm lựa chọn hiển thị, không cộng thêm bản sao 402.
Report này không chứng minh đã kiểm kê hết game: ảnh, text sinh động, lời trong
script, `Recipes.txt`, hints ngoài `www` và text plugin khác còn ngoài phạm vi.
Giữ nguồn chưa hỗ trợ trong census của game; không dịch mọi string trong JSON.

**QA và tính toàn vẹn:**

- `original/mv/` giữ byte/hash của dữ liệu được đọc cùng các file JS/font và TXT
  trong các thư mục được khảo sát. Corpus được đối chiếu lại với nguồn ở mỗi lệnh;
  giữ nguyên ID, targets và metadata nguồn. Không tái dùng ID qua phiên bản mới
  chỉ vì vị trí giống nhau.
- QA MV luôn kiểm mã escape/đối số, thứ tự, số lần xuất hiện, `%1` và markup
  được hỗ trợ; tên mã `c`/`C` tương đương. Mã lạ được bảo vệ nguyên dạng sau chuẩn
  hóa tên, chưa chứng minh hiểu hết cú pháp plugin. Payload namebox được giữ nguyên.
- Sai ngoặc/biến/control là lỗi; đổi màu/cỡ chữ là warning để rà trình bày.
  `check/status` trả số và mẫu warnings. Nguyên văn vốn có mã hỏng được giữ nguyên
  sẽ có warning; bản dịch sửa chữ nhưng vẫn mang cú pháp hỏng bị chặn.
- Generic QA vẫn chạy; extract chỉ bỏ hai rule backslash mặc định xung đột với
  bộ kiểm MV. Không thay quy tắc chung của các engine khác. Số dòng phải được giữ;
  adapter này chưa hỗ trợ thêm/bớt command để phân trang lại.
- Writer chỉ thay span chuỗi đã chọn, giữ BOM/CRLF và byte ngoài các span đó;
  JSON duplicate keys/UTF-8 hỏng bị từ chối. Dữ liệu số không bị serialize lại.
  Đọc ngược phải khớp tất cả occurrence trong final. Font, layout, rà ngôn ngữ và
  playtest vẫn cần thực hiện riêng.

**Gói bàn giao:** `build/mv-patch/` chứa file runtime đã đổi dưới `www/`,
`patch-manifest.json`, `INSTALL.txt` và `patch.zip`. Python `zipfile` tạo ZIP theo
allowlist, mở lại và đối chiếu tên file/bytes/CRC. Backup và file không đổi không
đi vào payload. Manifest ghi hash trước/sau, hash compatibility của nguồn đã
chụp và `playtest: not-run`; không chứa đường dẫn game cá nhân.

Rebuild yêu cầu thư mục game nguồn vẫn truy cập được và toàn bộ file đã chụp
khớp hash; nguồn đổi phải tạo project mới. Nếu chuyển máy, đặt lại nguồn tại
đường dẫn cũ hoặc trích xuất project mới, không sửa manifest để bỏ qua guard.
Đích đã tồn tại bị từ chối; giữ/chuyển build trước sang tên milestone khác trước
khi dựng lại. Không có installer tự động: kiểm compatibility hash, đóng game,
backup các file sẽ ghi đè ra nơi riêng rồi mới cài khi được yêu cầu. Rollback bằng
backup đã kiểm hash; giữ saves riêng. Hash chỉ ràng buộc nguồn đã chụp, không
chứng minh tương thích mọi ảnh, audio hoặc bản game khác.

## WOLF RPG trên Windows

`scripts/wolf_rpg.py` dùng WolfTL v0.6.2 có sẵn trong `vendor/wolftl/`, chạy offline
và xác minh SHA256 trước mỗi lần gọi. Cần Windows, Python 3.10+ và Node.js 22+;
không cần cài package npm/pip. Nguồn và giấy phép ở [sources.md](sources.md),
quyết định chọn công cụ ở [nghiên cứu WOLF RPG](research/wolf-rpg-reader-writer.md).

Khởi tạo project mới cho từng phiên bản, rồi truyền thư mục `Data` đã giải nén:

```powershell
node scripts/workflow.mjs init my-wolf-1-0 en
python -X utf8 scripts/wolf_rpg.py extract projects/my-wolf-1-0 "D:/Games/MyWolf/Data"
```

Đổi `en` theo ngôn ngữ thực tế. Công cụ sao chép CommonEvent.dat, Game.dat nếu có,
các cặp database `.dat`/`.project` và map `.mps` vào `original/wolf/`.
WolfTL chỉ chạy trên bản sao. Trước khi xuất corpus, công cụ yêu cầu danh sách
file dựng lại khớp đầy đủ và **giống từng byte**; map bị WolfTL bỏ qua cũng làm
bước này thất bại. File không xử lý trong BasicData được liệt kê ở `wolf-report.json`.

`corpus.jsonl` mặc định chọn Message 101, Choices 102, Picture 150 kiểu text và
tiêu đề/thông báo trong Game.dat. Mỗi vị trí có ID, file, đường dẫn trường,
cảnh và thứ tự riêng; chưa có bằng chứng speaker thì giữ `unknown`.
Các mã WOLF (kể cả biến lồng nhau) được ghi vào `tokens`; qa.json được bổ sung
kiểm thứ tự mã điều khiển hiển thị. Giữ nguyên cả `tokens` khi rà/chọn corpus.
Writer kiểm lại toàn bộ chuỗi mã theo thứ tự bằng bộ đọc ngoặc cân bằng, gồm
cả đối số lồng nhau mà regex QA chung không phân tích đầy đủ.
`review-candidates.jsonl` chứa các string argument khác, tên record và value
chuỗi database, gồm cả identifier, đường dẫn asset và comment. Rà trường/ngữ cảnh,
chép **nguyên dòng đã chọn** sang corpus trước khi `batch`; giữ ID, key và en.
Tên font, tên trường schema và metadata editor không thuộc danh sách cần dịch mặc định.

Chuẩn bị spec, bản đọc thoại nguồn và cẩm nang theo workflow trước khi dịch:

```powershell
node scripts/workflow.mjs batch projects/my-wolf-1-0
node scripts/workflow.mjs export-dialogue projects/my-wolf-1-0
```

Sau khi có bản dịch trong `E/`, dùng QA/finalize hiện có và writer riêng:

```powershell
node scripts/workflow.mjs check projects/my-wolf-1-0
node scripts/workflow.mjs finalize projects/my-wolf-1-0
python -X utf8 scripts/wolf_rpg.py rebuild projects/my-wolf-1-0 projects/my-wolf-1-0/build/pilot-01
```

Project giữ `adapter: null`; lệnh Node `rebuild` dành cho flat JSON sẽ từ chối.
Writer WOLF kiểm hash nguồn/dump, ID/nguyên văn corpus, QA và tính mới của final.json;
sau đó đọc ngược toàn bộ JSON để so cả text lẫn các trường còn lại. Output phải là
**thư mục mới trong build/**. Chọn tên khác cho lượt dựng tiếp theo.
Gói chứa chỉ file runtime đã đổi dưới `data/` và `patch-manifest.json` kèm hash
trước/sau; chưa cài vào game. Bản identity không đổi chữ sẽ tạo manifest với 0 file.

Giới hạn: đây chưa phải census toàn bộ game. Chữ trong ảnh, metadata chưa xử lý,
lookup theo tên và chuỗi runtime cần khảo sát riêng. Archive `.wolf` phải được
chuẩn bị thành dữ liệu rời trước. Game mã hóa/nén hoặc serializer đổi byte sẽ bị
gate identity từ chối, kể cả khi WolfTL có thể đọc chúng. Legacy CP932 có thể
round trip nhưng không chứa đầy đủ dấu Việt; đọc ngược sẽ chặn chữ bị mất hoặc đổi.
Chỉ chốt hỗ trợ một game sau canary/font/layout và save/load trên bản sao.

## Kiểm tra và cập nhật

```powershell
npm run check:sources
npm run test:tools
```

Hai lệnh chạy offline. Python tests gồm các regressions fitting gốc và fixture ASAR
tự tạo; chúng không thay thế việc thử trên một game thật.

Chỉ thêm tool/script đúng nhu cầu khi gặp engine cụ thể; đọc dependency và license,
kiểm tra input/output và chứng minh round trip trước khi dùng với text game.
