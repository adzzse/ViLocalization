# ViLocalization

Workspace để dịch game từ ngôn ngữ khác sang tiếng Việt cùng coding agent.
Mỗi game có cẩm nang xưng hô, hồ sơ nhân vật, thuật ngữ, các lô dịch và QA riêng.
Mặc định dịch trực tiếp bằng agent đang dùng, không cần thêm API key.
DazedTL là đường tùy chọn cho xử lý game và dịch qua provider của bạn.

Luồng: **khảo sát → extract/round trip → research → cẩm nang → lô thử → dịch → QA → rebuild → playtest → patch**.

## Bắt đầu

Cần **Node.js 22+**. Git chỉ cần khi lấy công cụ tham khảo. Không có dependency npm cần cài.

```powershell
npm test
npm run demo
```

Demo dùng dữ liệu mẫu tự tạo, kiểm tra round trip giống từng byte, áp bản dịch mẫu,
QA rồi tạo `strings.vi.json` trong `.codex/task-state/demo-*/demo/build/`.
Lệnh in ra đường dẫn chính xác; chạy lại tạo lượt demo mới.

## Bắt đầu game đầu tiên

Mở project này trong Codex rồi gửi:

```text
Dùng $viet-hoa-game để Việt hóa game <tên + phiên bản> từ <ngôn ngữ>.
Game ở <đường dẫn>. Hãy khảo sát engine, text và font, lập corpus và
chứng minh round trip trước; nghiên cứu xưng hô rồi dịch thử một cảnh.
```

Skill nằm tại `.agents/skills/viet-hoa-game/SKILL.md`, theo
[vị trí skill riêng của repo trong tài liệu OpenAI](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills).
Nếu chưa thấy skill, mở chat mới tại repo hoặc yêu cầu agent đọc trực tiếp file đó.
Đường thủ công để thử với bảng JSON phẳng:

```powershell
node scripts/workflow.mjs init my-game en
node scripts/workflow.mjs extract projects/my-game examples/flat-json/strings.en.json
node scripts/workflow.mjs batch projects/my-game
node scripts/workflow.mjs status projects/my-game
```

Điền research/cẩm nang trước khi dịch. Với dữ liệu demo, có thể dùng bản dịch mẫu:

```powershell
Copy-Item examples/flat-json/b001_text.part01.jsonl projects/my-game/E/
node scripts/workflow.mjs check projects/my-game
node scripts/workflow.mjs finalize projects/my-game
node scripts/workflow.mjs rebuild projects/my-game
```

Kết quả ở `projects/my-game/build/strings.vi.json`; nguồn trong `original/` không bị thay.
`en` trong corpus là tên trường kế thừa của VH, chứa nguyên văn ngôn ngữ nguồn bất kỳ.
Thay `en` ở lệnh init bằng `ja`, `ko`, `zh-CN`… theo game.

## Công cụ tham khảo

```powershell
npm run setup:tools
```

Clone hai nguồn về `tools/` theo commit trong `sources.lock.json`.
Lệnh không chạy installer, không reset clone hiện có và không gọi API dịch.
Workflow cốt lõi chạy offline mà không cần các clone này.

- [Workflow, schema và adapter engine](docs/workflow.md)
- [Dùng DazedTL](docs/dazedtl.md)
- [Nguồn, thay đổi so với upstream và license](docs/sources.md)

## Dữ liệu và giới hạn

`projects/`, `tools/`, `.env*` và checkpoint đều được Git bỏ qua.
Repo này chứa workflow, mẫu và test; **hãy backup bản dịch trong projects/ riêng**.
Không đưa file game hay API key lên repo workflow.

Adapter dựng sẵn chỉ hỗ trợ **JSON phẳng UTF-8 có value là string**.
RPG Maker, Ren'Py, Unity, Unreal… cần adapter/công cụ phù hợp sau khi khảo sát game;
chưa có cam kết extract/repack tự động cho mọi engine.
QA kiểm tra cấu trúc, không chứng minh dịch đúng nghĩa hay font hiển thị đúng.
Chưa có game thật được cài hoặc playtest trong lần setup này.
