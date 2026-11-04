# Dùng DazedTL cùng ViLocalization

Đây là công cụ tùy chọn, được clone vào tools/DazedTL theo sources.lock.json.
Workflow Node/agent trực tiếp vẫn chạy khi chưa khởi động DazedTL.

## Mở app trên Windows

```powershell
npm run setup:tools
& .\tools\DazedTL\START.bat
```

Launcher upstream tự tải runtime/dependency ở lần đầu (README upstream ước tính khoảng
300 MB), có thể tạo shortcut và dữ liệu ứng dụng. Chạy khi muốn dùng app;
lần setup repo này chỉ clone và kiểm tra source, chưa chạy installer/GUI của DazedTL.
Python hệ thống không phải runtime được bảo đảm cho app; dùng launcher upstream.

## Chọn đường dịch

1. Trong **Project → Open a game**, chọn bản game làm việc, giữ bản gốc độc lập.
2. Chọn **Languages** của game, target **Vietnamese**, kiểm tra source chính xác.
3. Với RPG Maker MV/MZ/VX Ace và cặp ngôn ngữ app hỗ trợ, **Guided steps** có
   Set up → Context → Translate → Check → Release. Settings chứa provider/key nếu dùng API.
4. Với engine khác hoặc muốn dùng agent: **Assistant-led → Options → Assistant only**
   để không cần thêm API key; hoặc API Batch/Live API nếu bạn đã chọn provider và duyệt chi phí.
5. Chọn **Copy starting prompt**, đưa vào agent có quyền đọc folder game và tools/DazedTL.
   Giữ app mở. Áp dụng research, STYLE_GUIDE.md và glossary của project ViLocalization
   vào guidance của game trước khi dịch; không đưa key vào prompt/file dự án.
6. Dùng **Text QA / Playtest** khi app hỗ trợ game, rồi **Release** tạo patch ZIP chỉ gồm file đổi.
   Ghi phiên bản/hash, backup và kết quả thử vào ENGINE.md/PROGRESS.md.

README và contract tại commit đã pin còn dựa nhiều vào phân biệt hệ chữ/census tiếng Nhật.
README upstream ghi **cặp ngôn ngữ cùng hệ chữ chưa được hỗ trợ**. Vì thế không giả định
English → Vietnamese đã chạy đúng trong Guided/API; dùng đường agent + adapter của
ViLocalization cho cặp này, hoặc xác minh hỗ trợ thực tế trước một dự án mới.
Japanese/Chinese → Vietnamese có hệ chữ khác nhưng vẫn cần pilot; chưa được kiểm thử ở đây.

## Giao tiếp agent ↔ app

Đọc task/starting prompt do app tạo và `tools/DazedTL/docs/translation-contract.md`.
Dùng **đúng command prefix do app sinh** cùng `scripts/project.py`; bắt đầu bằng
lệnh read-only `state`. Helper đọc connection của app đang chạy; không tự tạo hoặc
copy agent-connection.json, token hay port. Việc apply đi qua gateway/checkpoint của app.

Nếu mất kết nối hoặc mất reply sau mutation/paid job: đọc state và run đã lưu
trước khi retry. Cần app hoạt động và loopback truy cập được. Repo này không tự
duyệt ước tính tiền, chạy paid job, publish hay cài patch.

Schema của app là `version: 1, units: [...]` với `source`, `scene` và các quy tắc
scope riêng. Corpus VH là JSONL với `en`. Hai schema không tự tương thích; giữ
chung cẩm nang/thuật ngữ, chỉ chuyển đổi bằng adapter có kiểm tra ID và coverage.

Nguồn chính: [README](https://github.com/dazedanon/DazedTL/blob/942029800374c586de02d720704d450bfeb6ac52/README.md),
[user guide](https://github.com/dazedanon/DazedTL/blob/942029800374c586de02d720704d450bfeb6ac52/docs/user-guide.md),
[adapter contract](https://github.com/dazedanon/DazedTL/blob/942029800374c586de02d720704d450bfeb6ac52/docs/translation-contract.md).
