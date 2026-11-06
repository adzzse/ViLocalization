# Cẩm nang Việt hóa

Trạng thái: cần nghiên cứu trước khi dịch.

## Bối cảnh và giọng văn
Ghi thể loại, thời đại, giọng kể, mức độ trang trọng và cách xử lý hài hước/chửi thề theo bản gốc.

## Xưng hô
Ghi quy ước chung ở đây. Tra `relationships.md` để lấy xưng hô theo cặp và theo cảnh.
Khi thiếu bằng chứng về giới tính hoặc quan hệ, dùng tên, chức danh hoặc lược chủ ngữ.
Ghi câu cần xác minh vào `followups.md`.

## Tên và thuật ngữ
Chốt trong glossary.tsv; ghi rõ nhóm giữ nguyên, dịch nghĩa hoặc phiên âm.
Phân biệt chúng ta/chúng tôi theo phạm vi người nghe. Tách giọng thoại, tài liệu và UI.

## Kỹ thuật
Giữ đúng ID, biến, mã điều khiển, thẻ, mốc phụ đề và xuống dòng theo qa.json.
Trong JSONL, xuống dòng thật ghi bằng escape JSON `\n`; chuỗi hai ký tự backslash+n ghi `\\n`.
Thêm mã riêng của engine vào qa.json hoặc trường tokens của dòng nguồn trước lô thử.

## Ví dụ từ game
Ghi câu gốc, bản dịch đã duyệt, ngữ cảnh và lý do để các lô sau làm theo.

## Quyết định bổ sung
| Ngày | Quyết định | ID/cảnh liên quan | Lý do |
| --- | --- | --- | --- |
