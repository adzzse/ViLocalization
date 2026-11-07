# ViLocalization

Workspace để dịch game từ ngôn ngữ khác sang tiếng Việt cùng coding agent.
Mỗi game có cẩm nang xưng hô, hồ sơ nhân vật, thuật ngữ, các lô dịch và QA riêng.
Mặc định dịch trực tiếp bằng agent đang dùng, không cần thêm API key.
Các công cụ chia lô, QA, fitting và giải nén được quản lý ngay trong repo.

Luồng **khảo sát → chuẩn bị nguồn → duyệt spec → research → cẩm nang → lô thử → dịch → QA → rebuild → playtest → patch**.

## Bắt đầu

Cần **Node.js 22+**. Các công cụ fitting/ASAR cần thêm **Python 3.10+**, chỉ dùng thư viện chuẩn.
Không cần cài dependency npm/pip.

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
Game ở <đường dẫn>. Chuẩn bị dialogue.source.txt nếu có thoại và gửi SPEC.md.
Đề xuất thêm ô Tiếng Việt hay dùng ô sẵn có. Chờ tôi duyệt spec rồi mới dịch.
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

## Công cụ và kiểm chứng

```powershell
npm run check:sources
npm run test:tools
```

Các công cụ nằm trong `vendor/`, kèm license và SHA256
ở `sources.lock.json`. `check:sources` kiểm tra file local, không truy cập mạng hay clone repo.

Skill hiện tại dùng thêm census/coverage, canary, rà thoại theo cảnh, fitting, kiểm tra
save/load và kiểm chứng patch. Các công cụ hỗ trợ:

- `scripts/fit_text.py`: gợi ý ngắt dòng theo width/số hàng, không sửa file đầu vào.
- `vendor/asar/unpack_asar.py`: giải nén ASAR offline ra thư mục mới, giữ archive nguồn.
- `scripts/wolf_rpg.py`: cầu nối WOLF RPG trên Windows bằng WolfTL đã ghim phiên bản;
  kiểm tra round trip từng byte, xuất corpus và đọc ngược bản dựng. Xem [lệnh WOLF RPG](docs/tools.md#wolf-rpg-trên-windows).

- [Workflow, schema và adapter engine](docs/workflow.md)
- [Dùng các công cụ hỗ trợ](docs/tools.md)
- [Nguồn, thay đổi so với upstream và license](docs/sources.md)

## Dữ liệu và giới hạn

`projects/`, `tools/`, `.env*` và checkpoint đều được Git bỏ qua.
Repo này chứa workflow, mẫu và test; **hãy backup bản dịch trong projects/ riêng**.
Không đưa file game hay API key lên repo workflow.

Lệnh `workflow.mjs extract/rebuild` tích hợp chỉ hỗ trợ **JSON phẳng UTF-8 có value là string**.
WOLF RPG có đường riêng qua WolfTL cho dữ liệu rời vượt qua kiểm tra round trip;
database và chuỗi runtime cần rà chọn trước khi chia lô, font/playtest vẫn kiểm theo game.
RPG Maker, Ren'Py, Unity, Unreal… cần adapter/công cụ phù hợp sau khi khảo sát game;
chưa có cam kết extract/repack tự động cho mọi engine.
QA kiểm tra cấu trúc, không chứng minh dịch đúng nghĩa hay font hiển thị đúng.
Chưa có game thật được cài hoặc playtest trong lần setup này.
