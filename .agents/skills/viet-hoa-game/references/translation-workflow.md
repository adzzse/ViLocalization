# Các mốc kiểm chứng bản dịch

Thực hiện trong workspace ViLocalization, dùng corpus/E/ và cẩm nang của game.
Đọc [docs/tools.md](../../../../docs/tools.md) khi cần công cụ fitting hoặc giải nén ASAR.

## Census và nguồn

Lập bảng các file/nhóm chứa text người chơi thấy: thoại, choice, UI, database,
script/plugin, text runtime và ảnh thuộc phạm vi được yêu cầu. Ghi count theo vị trí
xuất hiện, ID ổn định, hash nguồn, speaker/scene và các vùng chưa đọc được vào ENGINE.md.
Đếm các dòng chưa dịch trong tổng số. Không gộp chỉ vì hai nhân vật nói cùng text.

Tách rõ tổng đã phát hiện và tổng đã kiểm kê đầy đủ; `status` chỉ kiểm coverage của
corpus hiện có, không chứng minh đã extract hết game. Mục bỏ qua cần vị trí và lý do
như identifier, comment hoặc asset name; text chưa truy cập được vẫn là khoảng trống.
Không dùng bộ lọc chữ Nhật làm census cho nguồn Anh/Hàn/Trung hoặc game nhiều ngôn ngữ.

## Canary theo đường nạp chữ

Sau identity round trip, đổi thử một mục dễ nhận ra cho mỗi đường game đọc chữ,
kể cả đường phát hiện khi mở rộng pilot. Chọn mục có biến hoặc markup nếu nguồn có.
Đọc ngược bản dựng và đối chiếu với loader để xác nhận đúng trường, khóa hoặc chỉ số,
ô ngôn ngữ nếu có và token. Ghi kết quả theo từng đường trước khi dịch hàng loạt.
Nếu việc chạy game nằm trong yêu cầu hiện tại, thử hiển thị và thay biến trên bản sao,
rồi khôi phục và đối chiếu hash. Nếu chỉ kiểm tra tĩnh, ghi playtest còn chờ và tiếp
tục các phần độc lập.

## Context và rà thoại

Lấy speaker từ nameplate/event/face code có bằng chứng; giữ unknown nếu chưa rõ.
Giữ scene, người nghe, alias và thời điểm lộ danh tính. Research đi vào các file hiện có:
research_story.md, character_bible.md, STYLE_GUIDE.md và glossary.tsv.

Nếu người dùng cung cấp phần game trước/bản dịch tham khảo, giữ nguồn đó read-only.
Chỉ tái dùng khi text gốc, speaker và ngữ cảnh khớp; giải quyết thuật ngữ mâu thuẫn
trong glossary trước khi dịch. Chưa có quyết định thì ghi followups.md.

Dịch một mạch hội thoại, đọc thoại và phụ đề tiếng Việt theo thứ tự cảnh để rà cách
đáp, nhịp, xưng hô và giọng nhân vật. Đối chiếu từng câu với nguồn để giữ nghĩa,
độ mơ hồ và cảm xúc. Xác minh các mục giống nguyên văn trước khi chốt.
Giữ thói quen nói/tiếng cười có bằng chứng; không áp lối viết tiếng Anh hoặc chuyển
âm tiếng Nhật thành quy tắc toàn cục cho tiếng Việt. Đọc lân cận hai bên khi cảnh bị chia lô.

Đối chiếu thuật ngữ theo glossary. So số lượng, điều kiện hoàn thành và tên vật phẩm
giữa nhiệm vụ, UI và thoại liên quan. Nếu các nguồn mâu thuẫn, giữ thông tin của
từng dòng và ghi ID vào followups.md để xác minh. Ghi lô hoặc cảnh đã rà trong PROGRESS.md.

## Fitting theo renderer

Xác định hộp cố định, cuộn, phân trang hay tự co giãn. Đo width và số hàng cùng lúc,
riêng cho tiêu đề/body/icon/dynamic values; đo chuỗi sau thay biến và font dấu Việt.
Giảm width có thể làm vượt chiều cao. Khi không vừa, rút gọn câu có kiểm nghĩa,
phân trang hoặc sửa đúng widget theo phạm vi đã cho phép.

Fitter cell-width chỉ tạo đề xuất ngắt dòng; dùng NFC, mask token đúng engine và
kiểm QA lại trước khi đưa revision vào E/. Chỉ thay xuống dòng khi renderer cho phép
và qa.json/ENGINE.md đã ghi quy tắc đó. Bản vừa số cell chưa chứng minh vừa pixel.

## Native QA, patch và tiếp tục

Khi playtest bản vá, chọn kiểm tra theo diff. Với UI/database, mở màn hình dùng dữ
liệu đã sửa. Với thoại, thử kích hoạt cảnh, thay biến và lưu/tải liên quan.
Ghi cảnh/build/hash đã thử, fixture tổng hợp và phần chưa thử; không gộp độ phủ text,
độ phủ layout và tiến độ chơi thành một phần trăm duy nhất.

Patch chỉ lấy allowlist file runtime đã đổi, kèm hướng dẫn phiên bản/cài/rollback.
Mở lại archive để kiểm tên file, CRC/hash và loại workspace, API key, game gốc,
logs, saves, test fixture. Thử cài/khôi phục trên bản sao khớp phiên bản khi được yêu cầu.
Đừng đưa spoiler vào commit/release note. Publish vẫn theo yêu cầu riêng.

Lưu milestone vào PROGRESS.md với hash nguồn và cẩm nang, lô hoặc file đang làm,
canary, ID còn vướng và lô hoặc cảnh cần xử lý tiếp. Khi bàn giao, báo riêng bốn mục sau:

- **Đã dịch trong corpus** — số vị trí đã dịch trên tổng số, đếm từ file thật.
- **Đã rà ngôn ngữ** — lô hoặc cảnh đã đối chiếu nguyên văn và phần còn chờ.
- **Đã playtest** — bản dựng và màn hình hoặc cảnh đã thử. Nếu mới kiểm tra tĩnh, ghi playtest còn chờ.
- **Nguồn chữ còn ngoài gói hoặc chưa kiểm kê** — vị trí hoặc nhóm nguồn và lý do.

Chỉ dùng nhãn **dịch toàn bộ** khi census bao phủ phạm vi người dùng yêu cầu và
mọi vị trí thuộc phạm vi đó đã dịch.

Khi resume, đối chiếu nguồn, guidance và output; nguồn/cẩm nang đổi thì rà phần ảnh
hưởng, không tái dùng kết quả cũ chỉ vì tên file hoặc câu chữ giống nhau.
