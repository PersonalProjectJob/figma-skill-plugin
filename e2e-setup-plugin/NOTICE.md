# NOTICE — phạm vi và giới hạn của package này

**Đây là một skill quy trình, không phải mã nguồn của khách hàng.**

Package này chứa **cách làm việc** với AI coding agent để tự dựng năng lực chạy browser E2E + chụp/đóng
gói evidence, được trích và vô danh hoá từ một dự án thật:

- Không có mã nguồn sản phẩm, schema, dữ liệu, credential, hay tài sản thiết kế nào của khách hàng.
- Không có tên khách hàng, tên nhân sự, repo, domain, hay id vận hành (issue/US) nào. Mọi chỗ như vậy đã
  thay bằng placeholder chung hoặc mô tả trừu tượng. Cổng kiểm: `bash ../skill-principal/scripts/scrub-check.sh skills LICENSE NOTICE.md README-entry.md` (dùng lại script của package `skill-principal` trong cùng repo — không copy thêm bản thứ hai).
- Ảnh chụp/evidence thật **không** được đưa vào package: chúng là ảnh app thật và có thể chứa dữ liệu
  người dùng thật.
- `skills/e2e-kit/login.json` chứa selector CSS ví dụ — không phải của app thật nào, chỉ minh hoạ cách
  điền cho project của bạn. Đọc form login thật của bạn rồi sửa lại trước khi dùng `--login ui`.

## Trước khi publish công khai (nếu bạn fork/sửa tiếp)

1. Điền tên bạn vào `LICENSE`.
2. Chạy scrub-check ở trên — phải `OK`.
3. Đọc lại bằng mắt một lượt: script chỉ bắt token trong denylist, không bắt được ngữ cảnh nhận dạng
   được (một câu chuyện quá cụ thể vẫn có thể chỉ ra khách hàng).
4. Nếu bạn thêm ví dụ/incident thật của project bạn vào tài liệu, đổi id/tên cụ thể thành mô tả chung
   ("một task E2E", "một agent khác") trước khi commit.

## Nguồn gốc và tính thời điểm

Skill này được phát triển và chỉnh sửa liên tục trong quá trình dùng thật (giữa 2026) với Playwright-core
+ vài CLI coding agent hiện tại (Claude Code, Codex CLI, Gemini/Antigravity). Tên model/cờ CLI sẽ lỗi
thời trước phần kiến trúc + nguyên tắc — đọc phần nguyên tắc trong `SKILL.md`/`DESIGN.md`, thay công cụ
theo thời của bạn.
