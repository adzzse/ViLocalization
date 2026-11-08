# Quy trình Việt hóa

## Workspace và các mốc chốt

Tạo project bằng `node scripts/workflow.mjs init <slug> <source-language>`.
Mọi lệnh chạy từ root repo; tham số project là đường dẫn, ví dụ `projects/my-game`.
Mỗi phiên bản game có project riêng. Game gốc giữ ở vị trí của bạn; bản sao text,
corpus, E/, build/ và ghi chú sống trong project. Chỉ làm việc với file thuộc phạm vi dịch.

| Mốc | Công việc | Điều kiện đi tiếp |
| --- | --- | --- |
| Khảo sát và spec | Xác định engine, nguồn chữ và các ô ngôn ngữ | SPEC.md ghi phạm vi, độ khả thi, phương án locale và các bước dịch |
| Extract | Corpus có ID theo vị trí; đọc và viết ngược text | Nguồn có hash; identity round trip giống byte hoặc tương đương ngữ nghĩa có giải thích |
| Duyệt spec | Gửi spec và bản đọc thoại nguồn nếu có | Người dùng duyệt phạm vi và hướng triển khai trước khi dịch thử |
| Research | Đọc text game, tra nguồn, xác minh nhân vật/quan hệ | Hồ sơ và relationships.md ghi bằng chứng và điểm chưa rõ |
| Cẩm nang | Xưng hô có hướng, giọng văn, glossary, tên riêng | STYLE_GUIDE.md được điền cho chính game này |
| Pilot | Một cảnh liên tục và UI có biến/thẻ; dựng và thử trong game | Token đúng; font và layout chấp nhận được trước khi dịch rộng |
| Dịch | Đọc theo cảnh, giữ câu nguồn, viết JSONL theo batch | Mỗi ID có bản dịch; chỗ chưa chắc nằm trong followups.md |
| QA | Cấu trúc, rồi nghĩa/xưng hô/thuật ngữ trên toàn bộ bản dịch | check không lỗi + ghi lại rà nội dung |
| Build | finalize, rebuild vào build/ | Đọc ngược bản dựng khớp final; file ngoài phạm vi không đổi |
| Playtest/patch | Thử UI, thoại, save/load, phụ đề; chuẩn bị rollback | Ghi cảnh đã thử, hash gốc, file patch, giới hạn còn lại |

Chỉ cài vào game hoặc phát hành khi nằm trong yêu cầu hiện tại. Giữ game đóng
khi thay file và giữ backup ngoài thư mục bản vá. Xuất patch chỉ gồm file đổi
và hướng dẫn cài/khôi phục; ghi rõ phiên bản game tương thích.

## Spec trước khi dịch

`init` chép sẵn [mẫu spec](../templates/game/SPEC.md) vào `SPEC.md`. Với game mới
hoặc khi mở rộng phạm vi, chuẩn bị nguồn và gửi `SPEC.md` cùng `dialogue.source.txt`
nếu có thoại trích được. Nếu game chỉ có text khác, gửi danh sách lô nguồn. Ghi rõ
những phần chưa trích được và lý do.

Chờ người dùng duyệt bản spec đã gửi trước khi dịch thử hoặc ghi bản dịch vào `E/`.
Ghi ngày, phạm vi và ô ngôn ngữ đã duyệt trong `PROGRESS.md`. Khi tiếp tục trong
phạm vi đó, dùng lại quyết định đã chốt. Nếu đổi phạm vi hoặc phương án ô ngôn ngữ,
trình spec cập nhật trước khi dịch phần thay đổi.

Đề xuất thêm ô Tiếng Việt khi engine có đường mở rộng locale phù hợp. Nếu dùng
một ô có sẵn, ghi rõ ô bị thay và ảnh hưởng đến các ngôn ngữ khác, giao diện và
lưu/tải. Ghi điểm chưa rõ cùng phép thử nhỏ cần làm. Các lệnh, hash và bằng chứng
chi tiết đặt ở `ENGINE.md`, tiến độ thực tế đặt ở `PROGRESS.md`.

## Tự chuẩn bị nguồn rồi giao agent

Phần chuẩn bị chạy bằng Node.js 22+ và công cụ của engine. Chạy các lệnh từ root ViLocalization.

1. **Tạo project.** Chạy `node scripts/workflow.mjs init my-game ja`, thay slug và mã
   ngôn ngữ nguồn cho đúng game. Nếu adapter có bước khởi tạo riêng, làm theo `ENGINE.md`.
   Khảo sát, điền `SPEC.md` và sao lưu dữ liệu nguồn trước khi trích xuất.
2. **Trích xuất.** Với JSON phẳng, chạy `node scripts/workflow.mjs extract projects/my-game D:/backup/strings.ja.json`.
   Với engine khác, chạy lệnh trích xuất trong `ENGINE.md`. Kiểm tra hash và round trip,
   rồi xác nhận `corpus.jsonl` có ID và ngữ cảnh. Adapter JSON phẳng mặc định gán `text`.
   Nếu đã xác minh một mục là thoại, bổ sung `kind: "dlg"`, cảnh và thứ tự trước khi chia lô.
3. **Chia lô và xuất bản đọc.** Chạy `node scripts/workflow.mjs batch projects/my-game`.
   Với corpus có thoại, chạy `node scripts/workflow.mjs export-dialogue projects/my-game`
   để tạo `dialogue.source.txt` cùng kiểu trình bày với `dialogue.txt`. Cột `VI` để trống.
   Nếu adapter có cột English riêng, đặt `dialogue.en.json` cạnh corpus trước khi xuất.
4. **Duyệt rồi giao agent dịch.** Duyệt `SPEC.md` và giao lô trong `B/`, manifest,
   phần cẩm nang liên quan và `dialogue.source.txt` để đối chiếu. Agent dịch từ
   nguyên văn và lưu theo ID vào `E/`.
5. **Dựng và đóng gói.** Dùng các lệnh [QA và tiếp tục](#qa-và-tiếp-tục) sau khi agent
   dịch và rà xong. Với engine riêng, dùng writer trong `ENGINE.md` thay cho lệnh
   `rebuild` mặc định. Mở lại gói để đối chiếu danh sách tệp và hash, kèm hướng dẫn
   phiên bản, cài đặt và hoàn tác.

## Corpus và bản dịch

`corpus.jsonl`: một object mỗi dòng, mỗi vị trí xuất hiện là một ID riêng:

```json
{"id":"chapter1:scene2:line3","key":"original-key","kind":"dlg","en":"Are you ready, {PLAYER}?","vi":"","speaker":"Mira","scene":"chapter1-scene2","order":3}
```

- `en`: nguyên văn nguồn, dù là Anh/Nhật/Hàn/Trung hoặc ngôn ngữ khác; không dịch qua tiếng Anh trung gian.
- `vi`: bản cũ để tham khảo; output vẫn cần có từng ID, kể cả giữ nguyên bản cũ.
- `kind`: `dlg`, `choice`, `text`. `speaker`, `scene`, `order` lấy từ dữ liệu game, không đoán từ câu trước.
- `group`: nhóm UI/tài liệu; `key`: khóa gốc. `tokens`: danh sách literal kỹ thuật riêng cần giữ nguyên số lần xuất hiện.
- Giữ hai dòng giống text nhưng khác ngữ cảnh thành hai ID; bản đầu không tự deduplicate/propagate.
- Với adapter flat JSON, giữ nguyên `id`, `key`, `en`; có thể bổ sung metadata ngữ cảnh trước chia lô.

`batch` dùng script VH nguyên gốc, mục tiêu khoảng 15.000 ký tự nguồn/lô và gom thoại
theo cảnh. Một cảnh lớn có thể tách lô; đọc cả lân cận trong corpus khi dịch phần tiếp.
`B/manifest.json` giữ danh sách ID; `B/*.txt` là bản xem cho người/agent. Nhãn `EN:`
cũng là nguồn bất kỳ ngôn ngữ. Các lô đã tạo được giữ nguyên khi resume.

Output: `E/b001_dialogue.part01.jsonl` hoặc tên batch thực tế trong manifest:

```json
{"id":"chapter1:scene2:line3","vi":"Sẵn sàng chưa, {PLAYER}?"}
```

Mỗi file có tối đa một dòng cho mỗi ID. File revision sắp xếp sau ghi đè dòng cũ,
ví dụ part01 → part02; dùng số có cùng độ dài. Chỉ sửa những ID cần sửa ở revision sau.
Xuống dòng thật dùng escape JSON `\n`; literal backslash+n dùng `\\n`.
Không cần và không được chuyển escape thêm một lần sau JSON.parse.

## QA và tiếp tục

```powershell
node scripts/workflow.mjs status projects/my-game
node scripts/workflow.mjs check projects/my-game
node scripts/workflow.mjs finalize projects/my-game
node scripts/workflow.mjs rebuild projects/my-game
```

`status` báo tiến độ kể cả khi còn thiếu. `check`/`finalize`/`rebuild` trả mã lỗi khác 0
khi chưa hợp lệ. Gate kiểm tra coverage manifest, ID sai/lặp, JSON lỗi, giá trị không
phải string, UTF-8 lỗi, bản dịch rỗng, placeholder phân biệt hoa/thường, thẻ theo thứ tự/thuộc tính,
timing, mã điều khiển và xuống dòng. `finalize` không dùng bản cũ để lấp dòng thiếu.
`rebuild` chặn final.json cũ hoặc đã bị sửa ngoài luồng và kiểm tra hash nguồn/corpus.
Printf không đánh số (`%s`, `%d`) phải giữ thứ tự đối số; dạng đánh số (`%1$s`, `%2$d`)
được đổi vị trí. Literal `%%` được giữ riêng, không coi phần sau là một đối số mới.

Khi QA đạt, `finalize` tự tạo `dialogue.txt` ở root project nếu có mục `dlg` trong
manifest. File theo thứ tự lô, giữ cảnh, ID, người nói, nguyên văn và bản Việt đã chốt.
Nếu nguồn là tiếng Anh thì nguyên văn hiện ở `EN`. Với nguồn khác, adapter có thể
xuất thêm `dialogue.en.json` cạnh corpus dưới dạng object `{ "ID": "tiếng Anh gốc" }`.
`EN` hiện `[Không có]` khi nguồn thiếu mục tiếng Anh. `dialogue.txt` dùng để đọc và
đối chiếu. Sửa bản dịch trong `E/`, rồi chạy lại `finalize` để cập nhật file.

Khi bàn giao, agent cập nhật [mẫu quan hệ nhân vật](../templates/game/relationships.md)
thành `relationships.md` cạnh `dialogue.txt`. Ghi quan hệ, xưng hô từng chiều và
ID nguồn hoặc cảnh làm bằng chứng. Đánh dấu mục suy luận hoặc chưa xác minh.

`qa.json` là các regex/rule của game: bổ sung engine tags, printf/control code hoặc
literal `tokens` trước pilot. Mặc định chưa bao phủ mọi ngữ pháp token của mọi engine.
Rule có thể báo nhầm với dấu ngoặc trong văn tự nhiên: xác nhận đó là text hay mã
trong ENGINE.md rồi sửa rule phù hợp. Rà ngữ nghĩa và font vẫn là bước riêng.

Trước nghỉ, cập nhật PROGRESS.md: lô/file đang làm, kết quả check, cảnh đã playtest,
followup và việc tiếp theo. Khi tiếp tục, đọc các file đó, xác nhận nguồn/phiên bản
và chạy status; dịch các ID thiếu, không tái tạo batch hay chạy lại paid job mù quáng.

## Thêm adapter engine

Adapter flat JSON là đường kiểm chứng tham chiếu: lưu bytes trong original/strings.json,
chặn duplicate key/UTF-8 lỗi, trích text, chứng minh identity rebuild giống byte,
rồi xuất bảng mới vào build/strings.vi.json. Khi có bản dịch, whitespace định dạng JSON
có thể đổi; tập key và mọi value được đối chiếu. Nó **không đọc JSON lồng nhau RPG Maker**.
Với MV, dùng `extract-mv <project> <www-directory>` và `rebuild` tích hợp;
[adapter MV](tools.md#rpg-maker-mv) giữ vị trí chuỗi, đọc ngược và đóng gói ZIP.
MZ và các plugin ngoài danh sách hỗ trợ cần khảo sát riêng.

Cho engine khác, viết reader/writer nhỏ cho đúng format được quan sát, theo ENGINE.md:

1. Sao lưu/hash toàn bộ file định thay; reader tạo corpus với vị trí, speaker/cảnh và thứ tự.
2. Writer dùng corpus chưa đổi phải tái tạo byte gốc, hoặc kiểm tra decoded equality
   và giải thích các byte metadata khác. Lưu lệnh/hash/kết quả để phiên sau kiểm chứng được.
3. Dùng `batch`/`check`/`finalize` chung. project.json để `adapter: null` cho đường custom;
   `rebuild` tích hợp sẽ từ chối, nên chạy writer riêng đã ghi trong ENGINE.md.
4. Writer đọc final.json, chỉ thay đúng vị trí, xuất vào build/, đọc lại để so với final
   và so sánh các trường ngoài text với nguồn. Giữ encoding, escape và code của engine.
5. Thêm fixture round trip/QA của format vào tests/ rồi thử lô pilot trong game.

Các bước census, canary, rà thoại, fitting, native QA và patch được hướng dẫn trong
[reference của skill](../.agents/skills/viet-hoa-game/references/translation-workflow.md).
Dùng [công cụ hỗ trợ](tools.md) khi cần fitting hoặc giải nén ASAR.
