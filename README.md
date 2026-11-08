# ViLocalization

Workspace để dịch game từ ngôn ngữ khác sang tiếng Việt cùng coding agent. Mỗi game có cẩm nang xưng hô, hồ sơ nhân vật, thuật ngữ, các lô dịch và QA riêng. Mặc định dịch trực tiếp bằng agent đang dùng, không cần thêm API key. Các công cụ chia lô, QA, fitting và giải nén được quản lý ngay trong repo.

Luồng **khảo sát → chuẩn bị nguồn → duyệt spec → research → cẩm nang → lô thử → dịch → QA → rebuild → playtest → patch**.

## Cài đặt

- **Node.js 22+**
- **Python 3.10+** nếu dùng fitting, giải nén ASAR, đóng gói MV hoặc WOLF RPG

Tải repo rồi mở thư mục `ViLocalization`  :
```powershell
git clone https://github.com/adzzse/ViLocalization.git
cd ViLocalization
```
Không cần chạy `npm install` hay `pip install`. Đường dịch mặc định dùng trực tiếp agent, không yêu cầu API key riêng.

## Bắt đầu game đầu tiên

Mở project /ViLocalization rồi gửi:
```text
Dùng $viet-hoa-game để Việt hóa game <tên + phiên bản> từ <ngôn ngữ> <đường dẫn>.
```

Skill nằm tại `.agents/skills/viet-hoa-game/SKILL.md`, theo [vị trí skill riêng của repo trong tài liệu OpenAI](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). Nếu chưa thấy skill, mở chat mới tại repo hoặc yêu cầu agent đọc trực tiếp file đó. Đường thủ công để thử với bảng JSON phẳng:

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

Kết quả ở `projects/my-game/build/strings.vi.json`; nguồn trong `original/` không bị thay. `en` trong corpus là tên trường kế thừa của VH, chứa nguyên văn ngôn ngữ nguồn bất kỳ. Thay `en` ở lệnh init bằng `ja`, `ko`, `zh-CN`… theo game.

## Công cụ hỗ trợ

Các công cụ nằm trong `vendor/`, kèm license và SHA256 ở `sources.lock.json` để đối chiếu file local.

Skill hiện tại dùng thêm census/coverage, canary, rà thoại theo cảnh, fitting, kiểm tra save/load và kiểm chứng patch. Các công cụ hỗ trợ:

- `scripts/fit_text.py`: gợi ý ngắt dòng theo width/số hàng, không sửa file đầu vào.
- `vendor/asar/unpack_asar.py`: giải nén ASAR offline ra thư mục mới, giữ archive nguồn.
- `scripts/wolf_rpg.py`: cầu nối WOLF RPG trên Windows bằng WolfTL đã ghim phiên bản; kiểm tra round trip từng byte, xuất corpus và đọc ngược bản dựng. Xem [lệnh WOLF RPG](docs/tools.md#wolf-rpg-trên-windows).
- `node scripts/workflow.mjs extract-mv`: đọc RPG Maker MV, gồm thoại/choice/database, Galv quests và các tham số plugin được chọn; `rebuild` xuất patch ZIP kèm hash. Xem [phạm vi và lệnh MV](docs/tools.md#rpg-maker-mv).

- [Workflow, schema và adapter engine](docs/workflow.md)
- [Dùng các công cụ hỗ trợ](docs/tools.md)
- [Nguồn, thay đổi so với upstream và license](docs/sources.md)

## Bàn giao và tiếp tục bản dịch

- **Clone repo chỉ nhận workflow, không nhận bản dịch đang làm.** Muốn người khác tiếp tục, gửi riêng toàn bộ `projects/<slug>/`, gồm nguồn, bản dịch trong `E/`, cẩm nang và tiến độ; giữ backup độc lập của thư mục này.
- Người nhận cần đúng phiên bản game và cập nhật đường dẫn theo máy mình. Mở repo, chỉ rõ thư mục project cần tiếp tục và yêu cầu dùng `$viet-hoa-game`.
- `tools/` bị Git bỏ qua; bàn giao riêng công cụ bổ sung cần cho game nếu có, kèm hướng dẫn và license tương ứng. Giữ `.agents/`, `vendor/` và các license đi kèm khi chia sẻ repo.
- Không gửi cấu hình cá nhân hay API key. Kiểm tra kết quả trong `build/` và backup file game trước khi cài bản Việt hóa.
