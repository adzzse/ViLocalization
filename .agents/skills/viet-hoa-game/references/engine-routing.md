# Chọn công cụ theo bằng chứng engine

Đây là hướng khảo sát, không phải cam kết mọi engine đã có adapter chạy được.
Ghi dấu hiệu, version và hợp đồng extract/rebuild vào ENGINE.md trước khi thay dữ liệu.

| Dấu hiệu | Hướng khảo sát | Khả năng có sẵn trong ViLocalization |
| --- | --- | --- |
| Bảng JSON UTF-8 phẳng, mọi value là string | Đối chiếu key và nơi game nạp file | Adapter extract/rebuild hiện có |
| resources/app.asar, Electron/Tyrano | ASAR chứa data/scenario/scripts; theo resource loader | Script giải nén offline; parser/repack vẫn theo game |
| data/System.json hoặc www/data, js/rpg_*.js/rmmz_*.js | RPG Maker MV/MZ, event 101/401 và plugin | Cần adapter giữ block thoại và mã plugin; không đưa vào adapter JSON phẳng |
| Data/*.rvdata2, Game.rgss3a | RPG Maker VX Ace/Marshal/archive | Chọn đúng reader/writer theo format sau khi khảo sát |
| *_Data/Managed hoặc GameAssembly.dll + metadata | Unity Mono hoặc IL2CPP | Xác định text table/asset/hook; chọn công cụ theo build |
| Engine/, pak/utoc/ucas | Unreal | Xác định version/container và text locres/uasset |
| data.win/game.unx với FORM, GEN8, STRG | GameMaker | Điều tra literal theo occurrence; không đổi mọi chuỗi giống nhau |
| xp3, ypf/ystb, Scene.pck, pck | VN engines/Godot | Xác định container, encoding và byte spans trước khi chọn extractor |

Chỉ thêm tool/module đúng engine khi game cần, ghi nguồn, phiên bản, license và
dependency. [Công cụ có sẵn](../../../../docs/tools.md) là điểm bắt đầu;
chọn thêm extractor/repacker theo format và phiên bản đã quan sát được.

Đọc source trước khi đưa script mẫu vào project: thay đường dẫn hardcode bằng input
của game, kiểm import/dependency, output và identity round trip. Giữ license cho
từng tool, đặc biệt module bên thứ ba; không tải toàn app chỉ để lấy một script.
