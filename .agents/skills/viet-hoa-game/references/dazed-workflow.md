# Các mốc dịch thích nghi từ DazedTL

Đây là quy trình chạy trực tiếp trong ViLocalization. Dùng corpus/E/ và cẩm nang
hiện có; các bước dưới đây không gọi app, project.py, DAZEDTL_ROOT hoặc endpoint.
Đọc [docs/dazedtl.md](../../../../docs/dazedtl.md) khi cần công cụ Python đã tách.

## Census và nguồn

Lập bảng các file/nhóm chứa text người chơi thấy: thoại, choice, UI, database,
script/plugin, text runtime và ảnh thuộc phạm vi được yêu cầu. Ghi count theo vị trí
xuất hiện, ID ổn định, hash nguồn, speaker/scene và các vùng chưa đọc được vào ENGINE.md.
Đếm các dòng chưa dịch trong tổng số. Không gộp chỉ vì hai nhân vật nói cùng text.

Tách rõ tổng đã phát hiện và tổng đã kiểm kê đầy đủ; `status` chỉ kiểm coverage của
corpus hiện có, không chứng minh đã extract hết game. Mục bỏ qua cần vị trí và lý do
như identifier, comment hoặc asset name; text chưa truy cập được vẫn là khoảng trống.
Không dùng bộ lọc chữ Nhật làm census cho nguồn Anh/Hàn/Trung hoặc game nhiều ngôn ngữ.

## Canary trước bulk

Sau identity round trip, đổi thử vài câu dễ nhận ra trong bản build: tiêu đề, nút,
tên map và một câu có token. Đọc ngược output để chứng minh đúng field/loader/index.
Nếu việc chạy/cài game nằm trong yêu cầu hiện tại, thử bản sao game và xác nhận
hiển thị rồi khôi phục/hash. Nếu chưa thể chạy, ghi kiểm tra native còn pending;
tiếp tục phần độc lập, không coi canary tĩnh là đã playtest.

## Context và rà thoại

Lấy speaker từ nameplate/event/face code có bằng chứng; giữ unknown nếu chưa rõ.
Giữ scene, người nghe, alias và thời điểm lộ danh tính. Research đi vào các file hiện có:
research_story.md, character_bible.md, STYLE_GUIDE.md và glossary.tsv.

Nếu người dùng cung cấp phần game trước/bản dịch tham khảo, giữ nguồn đó read-only.
Chỉ tái dùng khi text gốc, speaker và ngữ cảnh khớp; giải quyết thuật ngữ mâu thuẫn
trong glossary trước khi dịch. Chưa có quyết định thì ghi followups.md.

Dịch một mạch hội thoại, đọc tiếng Việt theo thứ tự để rà cách đáp, nhịp và giọng
nhân vật, rồi đối chiếu từng câu với nguồn để giữ nghĩa, độ mơ hồ và cảm xúc.
Giữ thói quen nói/tiếng cười có bằng chứng; không áp lối viết tiếng Anh hoặc chuyển
âm tiếng Nhật thành quy tắc toàn cục cho tiếng Việt. Đọc lân cận hai bên khi cảnh bị chia lô.
Rà này là một phần của biên tập, không mặc định gọi thêm API cho toàn game.

## Fitting theo renderer

Xác định hộp cố định, cuộn, phân trang hay tự co giãn. Đo width và số hàng cùng lúc,
riêng cho tiêu đề/body/icon/dynamic values; đo chuỗi sau thay biến và font dấu Việt.
Giảm width có thể làm vượt chiều cao. Khi không vừa, rút gọn câu có kiểm nghĩa,
phân trang hoặc sửa đúng widget theo phạm vi đã cho phép.

Fitter cell-width chỉ tạo đề xuất ngắt dòng; dùng NFC, mask token đúng engine và
kiểm QA lại trước khi đưa revision vào E/. Chỉ thay xuống dòng khi renderer cho phép
và qa.json/ENGINE.md đã ghi quy tắc đó. Bản vừa số cell chưa chứng minh vừa pixel.

## Native QA, patch và tiếp tục

Thử pilot trước khi dịch rộng. Sau đó chọn kiểm tra theo diff: UI/database cần màn
hình dùng dữ liệu ấy; thoại cần trigger, substitution và save/load liên quan.
Ghi cảnh/build/hash đã thử, fixture tổng hợp và phần chưa thử; không gộp độ phủ text,
độ phủ layout và tiến độ chơi thành một phần trăm duy nhất.

Patch chỉ lấy allowlist file runtime đã đổi, kèm hướng dẫn phiên bản/cài/rollback.
Mở lại archive để kiểm tên file, CRC/hash và loại workspace, API key, game gốc,
logs, saves, test fixture. Thử cài/khôi phục trên bản sao khớp phiên bản khi được yêu cầu.
Đừng đưa spoiler vào commit/release note. Publish vẫn theo yêu cầu riêng.

Lưu milestone vào PROGRESS.md với count từ file thật, census đã audited hay chưa,
source/guidance hash, lô/file đang làm, canary/native QA, blocker và bước tiếp theo.
Khi resume, đối chiếu nguồn, guidance và output; nguồn/cẩm nang đổi thì rà phần ảnh
hưởng, không tái dùng kết quả cũ chỉ vì tên file hoặc câu chữ giống nhau.
