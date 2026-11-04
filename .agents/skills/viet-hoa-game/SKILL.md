---
name: viet-hoa-game
description: Việt hóa game từ ngôn ngữ khác sang tiếng Việt, biên tập bản dịch hoặc tiếp tục các lô dịch trong ViLocalization. Dùng khi làm việc với corpus, xưng hô, thuật ngữ, QA và đóng gói bản dịch game; không dùng cho dịch văn bản ngoài game.
---

# Việt hóa game

Các đường dẫn dưới đây tính từ root repository, ba cấp trên thư mục skill này.
Đọc [workflow](../../../docs/workflow.md) khi bắt đầu một game hoặc cần hợp đồng corpus/lệnh.
Khi chọn engine/công cụ, đọc [engine routing](references/engine-routing.md).
Khi bắt đầu, tiếp tục hoặc chốt game, đọc [các mốc kiểm chứng bản dịch](references/translation-workflow.md)
để làm census/canary, rà thoại, fitting và kiểm chứng patch trực tiếp trong workspace.

1. Xác định game, phiên bản, ngôn ngữ nguồn, engine, thư mục text và phạm vi.
   Dùng project hiện có khi tiếp tục; đọc PROGRESS.md, ENGINE.md và chạy `status`
   để đối chiếu manifest/edits trước khi giao hoặc dịch thêm lô.
2. Trích xuất bằng adapter phù hợp. Giữ source bytes, hash và ID theo vị trí xuất hiện.
   Chứng minh identity round trip trước khi dịch. Adapter flat JSON có sẵn chỉ xử lý
   object UTF-8 với mọi value là string. Với định dạng khác, đọc mục adapter trong workflow.
3. Nghiên cứu corpus và nguồn đáng tin, ghi research_story.md và character_bible.md.
   Bằng chứng trong game ưu tiên hơn tóm tắt web. Tách xác nhận, suy luận và chưa rõ.
   Ghi quan hệ và xưng hô có hướng vào STYLE_GUIDE.md; thuật ngữ vào glossary.tsv.
   Giữ danh tính/giới tính chưa rõ là unknown, dùng tên/chức danh hoặc lược chủ ngữ khi thích hợp.
4. Chia lô theo cảnh và loại text. Dịch thử một cảnh + UI có biến/mã trước khi dịch rộng.
   Đọc lại cẩm nang, hồ sơ và glossary cho mỗi lô. Dịch ngữ nghĩa, giọng nhân vật,
   văn nói/văn viết; giữ nguyên mọi token kỹ thuật theo qa.json và ENGINE.md.
   Trường `en` là text nguồn từ bất kỳ ngôn ngữ nào, không phải yêu cầu dịch qua tiếng Anh.
5. Ghi mỗi ID của lô một dòng JSON `{"id":"...","vi":"..."}` vào
   `E/<batch>.part01.jsonl`. Sửa bằng revision có số đệm như part02, part03;
   file sắp xếp sau ghi đè bản cũ. Giữ câu cần xác minh trong followups.md.
   Dịch tuần tự mặc định. Nếu được yêu cầu dùng subagent, giao file/lô riêng,
   chia sẻ cẩm nang; người phụ trách rà lại các câu ảnh hưởng quan hệ/cốt truyện.
6. Chạy check, sửa mọi lỗi và rà nội dung theo cảnh. QA tự động chỉ kiểm tra cấu trúc;
   đọc lại nghĩa, xưng hô, glossary và các dòng giống bản gốc trước khi chốt.
   Chạy finalize rồi rebuild. Dùng [công cụ hỗ trợ](../../../docs/tools.md)
   khi cần fitting/giải nén ASAR; giữ các phép đo, source và output trong project của game.
7. Xuất patch vào build/, đối chiếu phạm vi thay đổi và thử game: font dấu Việt,
   tràn chữ, UI, phụ đề, save/load. Giữ backup/hash và rollback theo ENGINE.md.
   Chỉ cài/publish theo yêu cầu hiện tại. Ghi PROGRESS.md với file/lô, kiểm chứng
   còn hiệu lực, điểm chưa rõ và bước tiếp theo; báo rõ phần chưa playtest.

Nguồn phương pháp và license: [docs/sources.md](../../../docs/sources.md).
