# Quy trình Việt hóa

## Workspace và các mốc chốt

Tạo project bằng `node scripts/workflow.mjs init <slug> <source-language>`.
Mọi lệnh chạy từ root repo; tham số project là đường dẫn, ví dụ `projects/my-game`.
Mỗi phiên bản game có project riêng. Game gốc giữ ở vị trí của bạn; bản sao text,
corpus, E/, build/ và ghi chú sống trong project. Chỉ làm việc với file thuộc phạm vi dịch.

| Mốc | Công việc | Điều kiện đi tiếp |
| --- | --- | --- |
| Khảo sát | Tên/phiên bản, ngôn ngữ, engine, text, archive, font, mod đang có | ENGINE.md ghi đúng phạm vi và công cụ |
| Extract | Corpus có ID theo vị trí; đọc và viết ngược text | Nguồn có hash; identity round trip giống byte hoặc tương đương ngữ nghĩa có giải thích |
| Research | Đọc text game, tra nguồn, xác minh nhân vật/quan hệ | research_story.md + character_bible.md có bằng chứng và điểm chưa rõ |
| Cẩm nang | Xưng hô có hướng, giọng văn, glossary, tên riêng | STYLE_GUIDE.md được điền cho chính game này |
| Pilot | Một cảnh liên tục và UI có biến/thẻ; dựng và thử trong game | Token đúng; font và layout chấp nhận được trước khi dịch rộng |
| Dịch | Đọc theo cảnh, giữ câu nguồn, viết JSONL theo batch | Mỗi ID có bản dịch; chỗ chưa chắc nằm trong followups.md |
| QA | Cấu trúc, rồi nghĩa/xưng hô/thuật ngữ trên toàn bộ bản dịch | check không lỗi + ghi lại rà nội dung |
| Build | finalize, rebuild vào build/ | Đọc ngược bản dựng khớp final; file ngoài phạm vi không đổi |
| Playtest/patch | Thử UI, thoại, save/load, phụ đề; chuẩn bị rollback | Ghi cảnh đã thử, hash gốc, file patch, giới hạn còn lại |

Chỉ cài vào game hoặc phát hành khi nằm trong yêu cầu hiện tại. Giữ game đóng
khi thay file và giữ backup ngoài thư mục bản vá. Xuất patch chỉ gồm file đổi
và hướng dẫn cài/khôi phục; ghi rõ phiên bản game tương thích.

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

Cho engine khác, viết reader/writer nhỏ cho đúng format được quan sát, theo ENGINE.md:

1. Sao lưu/hash toàn bộ file định thay; reader tạo corpus với vị trí, speaker/cảnh và thứ tự.
2. Writer dùng corpus chưa đổi phải tái tạo byte gốc, hoặc kiểm tra decoded equality
   và giải thích các byte metadata khác. Lưu lệnh/hash/kết quả để phiên sau kiểm chứng được.
3. Dùng `batch`/`check`/`finalize` chung. project.json để `adapter: null` cho đường custom;
   `rebuild` tích hợp sẽ từ chối, nên chạy writer riêng đã ghi trong ENGINE.md.
4. Writer đọc final.json, chỉ thay đúng vị trí, xuất vào build/, đọc lại để so với final
   và so sánh các trường ngoài text với nguồn. Giữ encoding, escape và code của engine.
5. Thêm fixture round trip/QA của format vào tests/ rồi thử lô pilot trong game.

Các bước census, canary, rà thoại, fitting, native QA và patch từ DazedTL đã được
thích nghi trong [reference của skill](../.agents/skills/viet-hoa-game/references/dazed-workflow.md).
Dùng [công cụ độc lập đã tách](dazedtl.md) khi cần; workflow không phụ thuộc app/helper DazedTL.
