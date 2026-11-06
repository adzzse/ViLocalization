# Spec Việt hóa — <game và phiên bản>

## Khảo sát

- **Engine game** — <tên engine, phiên bản và nơi game nạp chữ>
- **Môi trường chạy desktop** — <runtime hoặc nền tảng chạy, phiên bản nếu có và đường dẫn bản cài>
- **Nguyên văn dùng để dịch** — <ngôn ngữ và bằng chứng>
- **Ngôn ngữ game đã có** — <các lựa chọn và chất lượng nguồn tham chiếu nếu ảnh hưởng bản dịch>
- **Phạm vi** — <thoại, UI, phụ đề, ảnh hoặc nhóm khác. Ghi phần ngoài phạm vi hoặc chưa kiểm kê>

## Độ khả thi và ô ngôn ngữ

- **Đánh giá** — <khả thi, cần xác minh hoặc đang vướng. Nêu bằng chứng ngắn về trích xuất, dựng lại, font hoặc giới hạn engine>
- **Cách đưa tiếng Việt vào game** — <thêm ô Tiếng Việt, thay ô nào, hoặc cần thử thêm>
- **Lý do và ảnh hưởng** — <game hỗ trợ thêm ô đến đâu, ngôn ngữ nào bị thay, ảnh hưởng UI và lưu/tải cần kiểm tra>

## Quy trình thực hiện

1. **Tự chuẩn bị nguồn.** Tạo project bằng `init`, sao lưu nguồn và xác nhận hash. Ghi
   lệnh trích xuất của engine trong `ENGINE.md` và kiểm tra dựng lại nguyên bản. Chạy
   `batch`, rồi `export-dialogue` để có `B/` và `dialogue.source.txt` nếu có thoại.
2. **Duyệt spec.** Gửi `SPEC.md` và bản đọc nguồn cho người dùng. Chờ duyệt trước
   khi dịch thử hoặc ghi bản dịch vào `E/`.
3. **Giao agent dịch.** Đưa agent corpus, lô cần xử lý và cẩm nang. Chốt xưng hô, thuật
   ngữ và thử từng đường nạp trước khi dịch rộng. Agent ghi bản dịch theo ID vào `E/`
   và rà nghĩa, thuật ngữ, token kỹ thuật.
4. **Dựng và đóng gói.** Chạy `check` rồi `finalize` để có `final.json` và bản đối chiếu
   `dialogue.txt`. Bàn giao `relationships.md` cạnh bản thoại. Dùng writer đúng
   engine để xuất vào `build/`, đọc lại kết quả và đóng gói các tệp runtime đã đổi
   kèm hướng dẫn cài, hoàn tác và trạng thái playtest.

Lệnh và đầu vào từng bước có trong [hướng dẫn chạy thủ công](../../docs/workflow.md#tự-chuẩn-bị-nguồn-rồi-giao-agent).

**Kết quả cần giao** — <spec, bản thử hoặc bản vá, kèm tiêu chí đạt tương ứng>

**Điểm cần chốt trước khi dịch** — <quyết định của người dùng hoặc phép thử còn thiếu>
