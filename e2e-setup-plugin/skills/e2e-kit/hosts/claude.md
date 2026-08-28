### Host: Claude Code (main loop hoặc subagent `nx-*`)

Hai đường khác nhau, chọn theo vai:

**Main loop (có Browser pane).** Ưu tiên tool native: `preview_start` (`{name}` cho dev server từ
`.claude/launch.json`, `{url}` cho site/file), rồi `read_page` / `computer` / `read_console_messages`.
**Không** dùng Bash để chạy dev server — đó là việc của `preview_start`.

**Subagent `nx-executor` / `nx-verifier` / `nx-evidence-auditor`: chỉ có Bash.** Không thấy Browser pane,
không thấy MCP. Đường duy nhất là CLI:

```bash
node "<workspace>/.e2e/smoke.mjs" --workspace "<workspace>"
node "<workspace>/.e2e/capture.mjs" --url "<url>" --out "<absolute.png>" --viewport both
```

Đây là lý do kit này tồn tại dạng script chứ không dạng MCP server.

**Ranh giới vai:** `nx-verifier` và `nx-reviewer` không có tool ghi — chúng **chạy** smoke và **đọc** ảnh,
không được tự vá code cho xanh. Ảnh do executor tạo; verifier `stat` lại và mở lại để đối chiếu.

**Số phải khớp đĩa.** `pnpm build` xanh không phải bằng chứng type (build strip type) — cần
`tsc --noEmit`. Đọc code rồi suy ra UI sẽ trông thế nào là review tĩnh, không phải verification.
