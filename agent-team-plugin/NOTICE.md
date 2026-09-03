# NOTICE — phạm vi và giới hạn của package này

**Đây là một skill quy trình, không phải mã nguồn của khách hàng.**

Package này chứa **cách điều phối** một nhóm AI coding agent cùng làm một task rồi phản biện chéo, được
trích và vô danh hoá từ một dự án thật:

- Không có mã nguồn sản phẩm, schema, dữ liệu, credential, hay tài sản thiết kế nào của khách hàng.
- Không có tên khách hàng, tên nhân sự, repo, domain, hay id vận hành (issue/ticket) nào. Mọi chỗ như vậy
  đã thay bằng mô tả trừu tượng — vai được **định nghĩa inline** trong `skills/SKILL.md` thay vì trỏ vào
  file cấu hình của harness nội bộ, nên skill dùng được độc lập. Cổng kiểm:
  `bash ../skill-principal/scripts/scrub-check.sh skills LICENSE NOTICE.md plugin.json` (dùng lại script
  của package `skill-principal` trong cùng repo — không copy thêm bản thứ hai).
- **Số đo runtime của một harness cụ thể không được đưa vào package.** Bản nội bộ có bảng đếm tool call
  đo từ log phiên làm việc thật; đó là dữ liệu sử dụng cá nhân, không thuộc về đây. Phần giữ lại là
  *nguyên tắc*: cờ cách ly có trong tài liệu không chứng minh nó chạy — tự probe (Bước 0).
- Ví dụ trong tài liệu (`mergeOverlappingPayoutWindows`, các số 41/96/22 dòng) là ví dụ **tổng hợp** dùng
  cho baseline test, không phải hàm hay diff của app thật nào.

## Trước khi publish công khai (nếu bạn fork/sửa tiếp)

1. Điền tên bạn vào `LICENSE`.
2. Chạy scrub-check ở trên — phải `OK`.
3. Đọc lại bằng mắt một lượt: script chỉ bắt token trong denylist, không bắt được ngữ cảnh nhận dạng được
   (một câu chuyện quá cụ thể vẫn có thể chỉ ra khách hàng).
4. Nếu bạn thêm incident thật của project bạn vào tài liệu, đổi id/tên cụ thể thành mô tả chung
   ("một task refactor", "một agent khác") trước khi commit. Bản nội bộ của skill này dẫn 3 incident theo
   id — chúng **đã** được thay bằng mô tả hiện tượng ở đây, đừng paste lại từ bản nội bộ.

## Nguồn gốc và tính thời điểm

Skill được phát triển trong quá trình dùng thật (giữa 2026) với vài CLI/IDE coding agent hiện tại. Tên
tham số cách ly, tên tool spawn subagent và tên model **sẽ lỗi thời trước phần nguyên tắc** — đó là lý do
Bước 0 dạy cách *probe* cờ cách ly thay vì ghi cứng tên cờ của một harness.

Phần `§Baseline` không phải trang trí: nó ghi lại một failure mode **đã được kiểm và bác bỏ**, để người
đọc sau không viết thêm rule cho một lỗi mà agent không mắc. Nếu bạn sửa skill này, giữ nguyên thói quen
đó — chạy baseline không có guidance trước, control không thể hiện lỗi thì không có gì cần sửa.
