# Nguồn và phần tái sử dụng

Phiên bản nguồn được cố định trong sources.lock.json. File cần dùng được lưu trực
tiếp trong vendor/; manifest chỉ là provenance/hash, không hướng dẫn clone ứng dụng.

| Nguồn | Commit | Phần dùng ở đây |
| --- | --- | --- |
| [kann420/VH-Workflow-Skill](https://github.com/kann420/VH-Workflow-Skill/tree/1edff3bb871c198ba8955e6152c3e3b7d7b9bec8) | 1edff3bb871c198ba8955e6152c3e3b7d7b9bec8 | Research, xưng hô, cẩm nang, corpus, batch builder và round trip |
| [dazedanon/DazedTL](https://github.com/dazedanon/DazedTL/tree/942029800374c586de02d720704d450bfeb6ac52) | 942029800374c586de02d720704d450bfeb6ac52 | Skill/methodology, fitting và script giải nén ASAR độc lập |

## File được lấy

| File local | File upstream | Trạng thái |
| --- | --- | --- |
| vendor/vh-workflow/build_batches.cjs | skills/game-localization-vi/scripts/build_batches.js | Nguyên nội dung, đổi đuôi để giữ CommonJS |
| vendor/dazedtl/text-fitting/layout.py | backend/dazedtl/engine/data/skills/game-translation/tools/Text Fitting/layout.py | Giữ nguyên |
| vendor/dazedtl/text-fitting/test_layout.py | cùng thư mục upstream, test_layout.py | Giữ nguyên |
| vendor/dazedtl/asar/unpack_asar.py | backend/dazedtl/engine/data/skills/game-translation/tools/Game Archives/Electron ASAR/unpack_asar.py | Có sửa, mô tả bên dưới |

Manifest lưu SHA256 file upstream tại commit đã pin và file được dùng hiện tại.
`.gitattributes` giữ bytes vendor nguyên khi checkout để hash nhất quán giữa Windows/Linux.
MIT notice: [VH](../vendor/licenses/VH-Workflow-Skill.txt), [DazedTL](../vendor/licenses/DazedTL.txt).
License công cụ không cấp quyền đối với tài sản game.

## Phần đã thích nghi

Skill và reference được viết lại cho nguồn bất kỳ → tiếng Việt, dùng file project
hiện có. Tham khảo các nguồn DazedTL đã pin:

- `backend/dazedtl/engine/data/skills/game-translation/SKILL.md`
- `backend/dazedtl/engine/data/skills/setup-generic-game/SKILL.md`
- `game-translation/references/{progress-reporting,text-fitting,playtesting-and-release,glossary-and-prompts,reference-translations}.md` dưới cùng thư mục skills.

Các mốc census/canary/context/dialogue/fitting/native QA/patch đi vào
[reference của skill](../.agents/skills/viet-hoa-game/references/dazed-workflow.md).
Không sao chép chỉ thị gọi DAZEDTL_ROOT, project.py hay các game mẫu có đường dẫn tuyệt đối.
Phần workflow áp dụng trực tiếp trong Codex; scripts Python chỉ dùng thư viện chuẩn.

Thay đổi ở ASAR: từ chối output đã tồn tại; preflight header/path/range/collision,
link và sidecar trước khi ghi. Lỗi UTF-8/header bị từ chối. Link và thiếu sidecar
không bị đổi thành file văn bản hoặc bị bỏ qua âm thầm. Chưa thêm repacker.
`scripts/fit_text.py` là CLI nhỏ của ViLocalization bọc fitter gốc, chỉ xuất đề xuất.
CLI thử các số hàng cho phép khi ước lượng upstream bỏ sót phương án vừa hộp;
module vendor vẫn giữ nguyên và được kiểm bằng bộ regression gốc.

Giữ tên trường `en` cho batch builder, nghĩa là source bất kỳ ngôn ngữ. Mỗi occurrence
có ID riêng. Gate Node hiện có giữ token đúng hoa/thường, coverage, revision và cấu trúc;
không dùng validator/finalizer upstream có thể chỉ in rejected rows mà vẫn ghi output.

## Cập nhật một phần

1. Chọn đúng commit và file raw cần dùng; đọc diff, dependency và license của file đó.
2. Bảo toàn sửa đổi local, cập nhật file chọn cùng cặp upstream/current SHA256 trong manifest.
3. Chạy npm test, npm run demo, npm run test:tools; review và thử game nếu thay adapter.

`npm run check:sources` kiểm file local offline. Không có setup tự clone hai repo,
tự tải binary/runtime hoặc mở app. Công cụ chuyên engine chỉ thêm khi có game cần.
