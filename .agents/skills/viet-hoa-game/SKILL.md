---
name: viet-hoa-game
description: Việt hóa game từ ngôn ngữ khác sang tiếng Việt, biên tập bản dịch hoặc tiếp tục các lô dịch trong ViLocalization. Dùng khi làm việc với corpus, xưng hô, thuật ngữ, QA và đóng gói bản dịch game; không dùng cho dịch văn bản ngoài game.
---

# Việt hóa game

Các đường dẫn dưới đây tính từ root repository, ba cấp trên thư mục skill này.
Đọc [workflow](../../../docs/workflow.md) khi bắt đầu một game hoặc cần hợp đồng corpus/lệnh.
Khi chọn engine/công cụ, đọc [engine routing](references/engine-routing.md).
Khi kiểm kê, thử đường nạp chữ, rà bản dịch, fitting hoặc bàn giao, đọc mục tương ứng
trong [các mốc kiểm chứng bản dịch](references/translation-workflow.md).

Codex dịch và biên tập trực tiếp từ nguyên văn. Dùng công cụ cho trích xuất, chia lô,
QA và đóng gói. Chỉ dùng model hoặc dịch vụ dịch khác khi người dùng yêu cầu hoặc
chấp thuận rõ ràng, kể cả khi chạy cục bộ.

1. Xác định game, phiên bản, ngôn ngữ nguồn, engine, thư mục text và phạm vi.
   Trước khi dịch lần đầu hoặc mở rộng phạm vi, lập hoặc cập nhật `SPEC.md` theo
   [mẫu spec](../../../templates/game/SPEC.md) và tóm tắt hướng đề xuất cho người dùng.
   Dùng project hiện có khi tiếp tục; đọc PROGRESS.md, ENGINE.md và chạy `status`
   để đối chiếu manifest/edits trước khi giao hoặc dịch thêm lô.
2. Trích xuất bằng adapter phù hợp. Giữ source bytes, hash và ID theo vị trí xuất hiện.
   Chứng minh identity round trip trước khi dịch. Adapter flat JSON có sẵn chỉ xử lý
   object UTF-8 với mọi value là string. Với định dạng khác, đọc mục adapter trong workflow.
3. Nghiên cứu corpus và nguồn đáng tin, ghi research_story.md và character_bible.md.
   Bằng chứng trong game ưu tiên hơn tóm tắt web. Tách xác nhận, suy luận và chưa rõ.
   Ghi quan hệ và xưng hô có hướng vào STYLE_GUIDE.md; thuật ngữ vào glossary.tsv.
   Giữ danh tính/giới tính chưa rõ là unknown, dùng tên/chức danh hoặc lược chủ ngữ khi thích hợp.
4. Chia lô theo cảnh và loại text. Dịch thử một cảnh và UI có biến hoặc mã nếu có.
   Chỉ dịch hàng loạt từ một đường nạp chữ sau khi bản thử của đường đó qua đọc ngược.
   Đọc nguyên văn từ `B/<lô>.txt`. Khi cần thêm ngữ cảnh, tra `corpus.jsonl` theo ID
   hoặc theo cảnh, gồm phần liền kề nếu cảnh bị chia lô.
   Nạp phần cẩm nang, hồ sơ và glossary liên quan đến lô. Đọc lại khi đổi tuyến
   nhân vật hoặc khi hướng dẫn thay đổi. Giữ đúng giọng, văn phong và các token
   kỹ thuật theo qa.json và ENGINE.md.
   Trường `en` là text nguồn từ bất kỳ ngôn ngữ nào, không phải yêu cầu dịch qua tiếng Anh.
5. Ghi mỗi ID của lô một dòng JSON `{"id":"...","vi":"..."}` vào
   `E/<batch>.part01.jsonl`. Sửa bằng revision có số đệm như part02, part03;
   file sắp xếp sau ghi đè bản cũ. Giữ câu cần xác minh trong followups.md.
   Dịch tuần tự mặc định. Nếu được yêu cầu dùng subagent, giao file/lô riêng,
   chia sẻ cẩm nang; người phụ trách rà lại các câu ảnh hưởng quan hệ/cốt truyện.
6. Chạy `check` và sửa lỗi cấu trúc. Khi xem kết quả kiểm tra hoặc build, lấy số đếm,
   ID lỗi và đoạn log liên quan. Mở log đầy đủ khi cần chẩn đoán.
   Rà ngôn ngữ riêng theo cảnh và đối chiếu các chỉ dẫn chơi giữa nhiệm vụ, UI
   và thoại liên quan. Ghi phần đã rà và phần còn vướng
   trước khi chạy `finalize` rồi `rebuild`. Dùng [công cụ hỗ trợ](../../../docs/tools.md)
   khi cần fitting/giải nén ASAR; giữ các phép đo, source và output trong project của game.
7. Xuất patch vào build/ và đối chiếu phạm vi thay đổi. Thử font dấu Việt, tràn chữ,
   UI, phụ đề và lưu/tải trên bản sao khi việc chạy game nằm trong phạm vi yêu cầu.
   Giữ backup, hash và cách rollback theo ENGINE.md. Chỉ cài hoặc publish theo yêu cầu.
   Ghi PROGRESS.md và bàn giao riêng số mục đã dịch, phần đã rà ngôn ngữ, phần đã
   playtest và nguồn chữ còn ngoài gói hoặc chưa kiểm kê.

Nguồn phương pháp và license: [docs/sources.md](../../../docs/sources.md).
