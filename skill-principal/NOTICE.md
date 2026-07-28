# NOTICE — phạm vi và giới hạn của package này

**Đây là một template quy trình, không phải mã nguồn của khách hàng.**

Package này chứa **cách làm việc** với AI coding agent, được trích và vô danh hoá từ một dự án thật:

- Không có mã nguồn sản phẩm, schema, dữ liệu, credential, hay tài sản thiết kế nào của khách hàng.
- Không có tên khách hàng, tên nhân sự, repo, endpoint, hay id vận hành nào. Mọi chỗ như vậy đã thay bằng placeholder (`acme/webapp-fe`, `dev-owner`, `<qa-thread-id>`, `${VAULT_ROOT}`...). Cổng kiểm tra: `bash scripts/scrub-check.sh`.
- Ảnh chụp/evidence **không** được đưa vào package: chúng là ảnh app thật và có thể chứa dữ liệu người dùng thật.
- Các con số nêu trong tài liệu là số đếm được từ artifact (số dòng, số version, số file), **không** phải chỉ số năng suất suy diễn.

## Trước khi publish công khai

1. Điền tên bạn vào `LICENSE`.
2. Chạy `bash scripts/scrub-check.sh` — phải `OK`.
3. Đọc lại bằng mắt một lượt: script chỉ bắt được token trong denylist, không bắt được ngữ cảnh nhận dạng được (một câu chuyện quá cụ thể vẫn có thể chỉ ra khách hàng).
4. Publish trong một **repo mới**. Không đổi repo nội bộ sang public: git history vẫn giữ nguyên mọi thứ đã scrub ở HEAD.
5. Nếu muốn nêu tên khách hàng trong phần narrative, xin xác nhận bằng văn bản trước — phần artifact vẫn nên giữ vô danh.

## Nguồn gốc và tính thời điểm

Quy trình này được phát triển và chỉnh sửa liên tục trong quá trình làm việc thật, không phải thiết kế trên giấy. Vì vậy nó gắn với công cụ tại một thời điểm (mid-2026): Claude Code, Codex CLI, Gemini/Antigravity, TanStack-based frontend. Tên model và cờ CLI sẽ lỗi thời trước phần nguyên tắc — đọc phần nguyên tắc, thay công cụ theo thời của bạn.
