# Hợp đồng engine

Adapter có sẵn: flat JSON UTF-8 `{ "id": "source text" }`; không dùng trực tiếp cho JSON lồng nhau của RPG Maker.
Với game thật, ghi engine/phiên bản, vị trí text, encoding, archive, công cụ extract/rebuild và font.

## Lệnh và kiểm chứng
Ghi lệnh trích xuất, rebuild, so sánh dữ liệu chưa dịch và so sánh bản dịch với final.json.
Giữ source và ID ổn định; thêm speaker/scene/order từ bằng chứng trong game.
Mỗi vị trí xuất hiện có ID riêng, kể cả khi nội dung giống nhau.

## Font và layout
Kiểm tra đầy đủ dấu tiếng Việt, NFC, font fallback, độ rộng hộp thoại, số dòng và phụ đề.
Giới hạn ký tự không thay thế đo độ rộng thực tế.

## Cài, rollback và cập nhật game
Ghi danh sách file thay đổi, hash/phiên bản gốc, nơi backup và cách khôi phục.
Đóng game trước khi cài bản vá đã được yêu cầu. Kiểm tra save/load và cảnh mẫu sau khi cài.
Khi game cập nhật: giữ bản cũ, tạo project mới, chỉ tái dùng bản dịch sau khi đối chiếu ID + source + ngữ cảnh.
