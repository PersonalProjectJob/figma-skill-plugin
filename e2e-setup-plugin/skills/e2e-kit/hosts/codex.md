### Host: Codex CLI

**Bạn ĐƯỢC PHÉP chạy browser headless.** `No dependency changes` chỉ cấm sửa `package.json`/lockfile —
không cấm dùng runner đã cài, viết script tạm, hay chạy browser (`evidence-discipline.mdc` §1).

**Cạm bẫy sandbox — đọc trước khi kết luận BLOCKED.** Mặc định Codex chạy `sandbox_mode` không có network
và chỉ ghi được trong workspace. Browser startup trong sandbox mặc định của Codex desktop chết với
`listen EPERM: operation not permitted` ([openai/codex#16174](https://github.com/openai/codex/issues/16174)) —
đây là sandbox chặn, **không phải** thiếu năng lực.

Nếu launch chết vì `EPERM`/`listen`, phiên phải được khởi động lại với quyền rộng hơn (user chạy, không
phải bạn tự đổi config):

```bash
codex -a on-request -s workspace-write -c 'sandbox_workspace_write.network_access=true'
```

Vẫn chết thì `--sandbox danger-full-access`. Config bền ở `$CODEX_HOME/config.toml` (mặc định
`~/.codex/config.toml`) — **đừng tự sửa**, báo user.

**Cái vẫn chạy được dưới sandbox mặc định:**

- đọc browser binary trong `%LOCALAPPDATA%\ms-playwright` (ngoài workspace, nhưng là **đọc**);
- ghi `.e2e/out/*.png` trong workspace;
- `file://` target và `http://localhost` khi network_access đã bật.

**Cái KHÔNG chạy được dưới sandbox mặc định:** `npx playwright install` (cần network + ghi ngoài
workspace). Thiếu browser binary ⇒ báo `BLOCKED` và để user cài, đừng cố lách.

**Log tiến trình:** dùng `update_plan` — đã có sẵn, không cần `_PROGRESS.md`.
