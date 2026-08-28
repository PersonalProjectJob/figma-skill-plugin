### Host: Gemini / Antigravity

**Bạn ĐƯỢC PHÉP chạy browser headless.** Đây là mục quan trọng nhất của file này, vì lỗi đã xảy ra thật:
một task yêu cầu 2 PNG + rect + overflow, và agent Gemini trả `_DONE.md` khai mình là "text-based AI",
metrics `N/A`, 0 PNG. Một agent khác (Codex) sau đó chạy Playwright headless trên **cùng máy, cùng file**
và ra kết quả đầy đủ trong một lượt. Năng lực luôn có sẵn; cái thiếu là quyền được nói rõ.

`No dependency changes` chỉ cấm sửa `package.json`/lockfile. Không cấm: dùng runner đã cài · viết script
tạm · chạy browser headless · tải browser binary vào cache máy.

**Hai đường, dùng cái nào cũng được, nhưng phải là luồng thật:**

1. **Browser Subagent native của Antigravity** — chụp ảnh/quay video thành artifact review được. Dùng khi
   bạn đang ở trong IDE.
2. **CLI trong worktree** (đường mà `.e2e/` này dựng sẵn) — chắc chắn hoạt động cả khi subagent không
   khả dụng:

```bash
node "<workspace>/.e2e/smoke.mjs" --workspace "<workspace>"
```

**Inject state KHÔNG tính là E2E.** Gọi thẳng hàm render nội bộ qua `page.evaluate(...)`, set biến state,
dựng DOM giả — rồi đo trên đó — bỏ qua đúng phần dễ hỏng nhất (event handler, điều kiện render, thứ tự
state, routing). Phải drive bằng `click`/`fill`/`selectOption`/điều hướng route thật. Không drive được ⇒
báo `BLOCKED`, nói rõ chặn ở bước nào. Nộp kết quả inject như thông tin bổ sung thì phải dán nhãn
`PARTIAL — state injected, không phải luồng thật` và **không** tick Visual DoD bằng nó.

**Bắt buộc ghi log tiến trình trong lúc làm**, không dồn tới cuối: append `_PROGRESS.md` ở gốc worktree
theo dạng `HH:MM [THINKING|WORKING] <mô tả>`, ngay khi bắt đầu và sau mỗi bước có ý nghĩa.

**Bàn giao sạch:** xoá script tạm / `.out` / `test-results/` bạn tạo ra; chạy `git status --short` và dán
nguyên văn vào `_DONE.md`. `.e2e/` đã được đăng ký trong `.git/info/exclude` nên không hiện — đừng xoá
nó. Không commit/push/merge/mở PR/tạo issue. Trong vault chỉ được ghi file `.png` vào đúng path đã chỉ
định, tuyệt đối không sửa/tạo file `.md`.

**Số phải khớp đĩa:** mọi byte size / số ảnh / rect bạn viết ra phải là số vừa đọc trong lượt này. Người
verify sẽ `stat` lại.
