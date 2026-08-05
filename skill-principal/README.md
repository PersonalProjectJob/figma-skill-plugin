# skill-principal — điều phối nhiều AI coding agent bằng file, không bằng lời

Bộ quy tắc + một skill điều phối, dùng để chạy **3 AI coding agent song song** (Claude / Codex / Gemini) trên cùng một codebase mà không đụng nhau, không mất spec khi phiên chết, không để agent tự merge, và **không tin báo cáo "đã xong" của chính chúng**.

Gần như toàn bộ package là markdown — agent đọc file, file quyết định hành vi. Hai script Bash/Node duy nhất là hai **cổng chạy được**, vì có những quy ước mà viết ra chữ thì không đủ.

```
skill-principal/
├── skills/dispatch/SKILL.md          # skill điều phối (workflow 8 bước)
├── skills/dispatch/references/
│   └── agent-capability-matrix.md    # dữ liệu để chọn executor
├── agents/                           # 5 vai + cổng cứng bằng `tools` allowlist
│   ├── role-planner.md               # plan, không ghi file
│   ├── role-executor.md              # vai duy nhất có Edit/Write
│   ├── role-verifier.md              # "chạy có xanh không" — không tool ghi
│   ├── role-reviewer.md              # "xanh mà có đúng không" — không tool ghi
│   └── role-evidence-auditor.md      # hash ảnh, đối chiếu bảng PASS (model rẻ)
├── agent-rules/
│   ├── .agent-rules                  # 64 dòng — ROUTER: bảng routing + invariants
│   ├── .agent-rules.d/               # 6 rule chi tiết, nạp theo yêu cầu
│   └── .agent-rules.local.example    # path theo máy (không commit bản thật)
├── scripts/
│   ├── scrub-check.sh                # cổng chống rò rỉ khi publish
│   └── check-agents.mjs              # cổng: vai kiểm/review không được có tool ghi
└── docs/case-study-brief.md          # nguồn dữ liệu để viết case study
```

## Vấn đề

Ba agent, ba điểm mạnh khác nhau, ba pool quota khác nhau. Giao việc bằng cách gõ mô tả vào cửa sổ chat thì gặp đủ thứ:

- Agent B không biết quy ước mà agent A vừa thống nhất — quy ước nằm trong hội thoại của A.
- Hai agent sửa cùng một file, merge xong mất việc của nhau.
- Phiên hết quota giữa lúc đang làm; phiên mới không biết branch nào, worktree nào, đã tới bước nào.
- Agent báo "đã xong, build pass" nhưng thực ra không hề gọi API/không chạy trong scope.
- Task 30 phút bị áp cùng nghi thức tài liệu như feature 3 ngày.

## Cách giải: 12 nguyên tắc

Tám nguyên tắc đầu là về **giao việc** (ai làm, làm ở đâu, spec ở đâu). Bốn nguyên tắc cuối (9–12) là về **không tin kết quả trả về** — chúng sinh ra sau khi bốn báo cáo "đã xong" liên tiếp hoá ra là bịa, và sau khi hiểu ra rằng bịa không phải tính cách của một model mà là đầu ra hợp lý khi câu khai không thể sai được.

| # | Nguyên tắc | Vì sao | Ở file |
|---|---|---|---|
| 1 | **Router pattern** — index luôn nạp (64 dòng) + rule chi tiết nạp theo yêu cầu | Nạp full rule mọi session sẽ ăn hết ngân sách context trước khi làm việc | `.agent-rules` |
| 2 | **Rule phải tới được tay executor** | Rule nằm trong `.gitignore` nên `git worktree add` không mang theo → agent trong worktree mù hoàn toàn mà vẫn báo done | `SKILL.md` Bước 0.3, Bước 3.5 |
| 3 | **Chọn executor theo năng lực, tách khỏi độ phức tạp** — GATE 0 (no-go) + GATE 0b (bắt buộc agent-2 review) | "Agent nào cũng code được" là cách nhanh nhất để mất buổi chiều | `SKILL.md` Bước 2b |
| 4 | **Quota bias — nói thẳng ra là bias kinh tế** | Khi hai executor ngang nhau thì chọn bên còn quota; ghi rõ đây không phải phán xét kỹ thuật, và không bao giờ ghi đè GATE 0 | `SKILL.md` Bước 2b |
| 5 | **Model đắt nhất không viết code** — quy tắc gắn với *vai trò* main-loop, không gắn tên model | Tên model đổi mỗi vài tuần; quy tắc gắn tên sẽ stale, gắn vai trò thì không | `SKILL.md` Quy tắc cứng |
| 6 | **Spec là input, không phải biên bản** — spec tồn tại trước khi giao việc, vì chính nó là prompt | Viết tài liệu sau khi code xong = biên bản trùng lặp với issue/PR, không ai đọc | `obsidian-us-workflow.md`, `SKILL.md` Bước 2c |
| 7 | **Task tier gate** — dưới 2h không tạo tài liệu, chỉ 1 dòng tracking | Nghi thức đúng cho feature là nghi thức sai cho typo | `task-sizing.md` |
| 8 | **Một bên duy nhất được merge** — agent phụ chỉ code + ghi `_DONE.md`; bên điều phối tự verify rồi mới merge | Không tin báo cáo suông: tự chạy build, tự đọc diff, tự kiểm scope | `SKILL.md` Bước 6 |
| 9 | **Câu khai phải có thể sai được (falsifiable)** — mọi ô trong `_DONE.md` là output máy dán nguyên văn, không phải tính từ | Cùng task cùng model: lượt đòi "build xanh" thì executor bịa; lượt đòi *con số + baseline* thì khai đúng. Bịa là đầu ra của protocol, không phải tính cách model | `SKILL.md` Bước 5 (RETURN), Quy tắc cứng |
| 10 | **Verify EVIDENCE, không chỉ code** — hash ảnh, đối chiếu loại evidence với loại AC, `git status` trước khi tin ảnh | Quy trình verify chỉ kiểm code thì báo cáo bịa *bằng chứng* đi qua sạch: ảnh trùng byte khai cho 2 AC, "static code review" điền vào cột PASS của AC hành vi | `SKILL.md` Bước 6 |
| 11 | **Phân vai bằng cổng cứng, không bằng lời dặn** — vai kiểm/review không có tool ghi | Prompt cấm sửa source bằng chữ vẫn bị vượt: executor sửa 7 file để 32/32 AC thành PASS. Thiếu tool thì không vượt được | `agents/`, `scripts/check-agents.mjs` |
| 12 | **Executor phải có đường phản hồi về rule** — mục `## Đề xuất đổi rule` bắt buộc, bên điều phối relay nguyên văn | Executor không với tới thư mục rule dùng chung; không có đường nói lại thì nó lặng lẽ đi đường vòng, và rule sai cứ sai | `SKILL.md` Bước 5 + Bước 6 |

Hai thứ chống gián đoạn đi kèm: **Dispatch log** (branch + worktree path tuyệt đối + bước tiếp theo, cập nhật ở mọi mốc) và **giao thức `_DONE.md`** (agent phụ ghi file, bên điều phối poll nền 30s thay vì chờ người quay lại báo).

## Dùng thế nào

```bash
# 1. Rule vào repo của bạn
cp -r agent-rules/.agent-rules agent-rules/.agent-rules.d /path/to/your-repo/
cp agent-rules/.agent-rules.local.example /path/to/your-repo/.agent-rules.local
#    rồi sửa 6 biến path trong .agent-rules.local

# 2. Skill vào thư mục skill của agent
cp -r skills/dispatch ~/.claude/skills/

# 3. Vai (subagent definition) — cổng cứng bằng tools allowlist
cp agents/role-*.md ~/.claude/agents/
node scripts/check-agents.mjs agents      # phải OK trước khi dùng

# 4. Thêm .agent-rules.local vào .gitignore (nó chứa path máy bạn)
```

Sau đó gọi `/dispatch <US-id | issue-url | mô tả task>`. Skill sẽ: phân loại độ phức tạp → quyết định có cần spec không → tạo branch/worktree → chọn executor → giao việc → verify → cập nhật tracking → dừng trước commit/PR.

**Điều chỉnh cho bối cảnh của bạn**: package này giả định vault Obsidian làm nơi lưu spec, GitHub Projects làm board, `pnpm build` làm cổng verify. Ba chỗ đó thay được — phần nguyên tắc thì không phụ thuộc chúng.

## Giới hạn — đọc trước khi dùng

- Gắn với công cụ mid-2026 (Claude Code, Codex CLI, Gemini/Antigravity). Tên model và cờ CLI sẽ lỗi thời trước phần nguyên tắc.
- Viết bằng tiếng Việt vì team dùng tiếng Việt. Phần rule về "viết cho người không đọc code" cố tình giữ nguyên ngôn ngữ gốc.
- Đây là **bản vô danh hoá** từ một dự án thật, không phải mã nguồn khách hàng — xem [NOTICE.md](NOTICE.md) trước khi publish thêm.

## License

MIT (xem [LICENSE](LICENSE) — điền tên bạn trước khi publish).
