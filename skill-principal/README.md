# skill-principal — điều phối nhiều AI coding agent bằng file, không bằng lời

Bộ quy tắc + một skill điều phối, dùng để chạy **3 AI coding agent song song** (Claude / Codex / Gemini) trên cùng một codebase mà không đụng nhau, không mất spec khi phiên chết, không để agent tự merge, và **không tin báo cáo "đã xong" của chính chúng**.

Gần như toàn bộ package là markdown — agent đọc file, file quyết định hành vi. Hai script Bash/Node duy nhất là hai **cổng chạy được**, vì có những quy ước mà viết ra chữ thì không đủ.

```
skill-principal/
├── skills/dispatch/SKILL.md          # skill điều phối (workflow 8 bước + 4 cổng)
├── skills/dispatch/references/
│   └── agent-capability-matrix.md    # dữ liệu để chọn executor — CÓ HẠN, xem last-verified
├── skills/model-audit/SKILL.md       # làm mới hồ sơ trên: probe harness thật +
│                                     # tài liệu hãng + lịch sử dispatch. Chạy chủ động.
├── agents/                           # 6 vai + cổng cứng bằng `tools` allowlist
│   ├── role-planner.md               # plan + chia stream, không ghi file
│   ├── role-executor.md              # vai duy nhất có Edit
│   ├── role-verifier.md              # "chạy có xanh không" — không tool ghi
│   ├── role-reviewer.md              # "xanh mà có đúng không" — không tool ghi
│   ├── role-evidence-auditor.md      # hash ảnh, đối chiếu bảng PASS (model rẻ)
│   └── role-reporter.md              # báo cáo + relay phản hồi rule (Write, KHÔNG Edit)
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

## Cách giải: 17 nguyên tắc

Tám nguyên tắc đầu là về **giao việc** (ai làm, làm ở đâu, spec ở đâu). Nguyên tắc 9–12 là về **không tin kết quả trả về** — chúng sinh ra sau khi bốn báo cáo "đã xong" liên tiếp hoá ra là bịa, và sau khi hiểu ra rằng bịa không phải tính cách của một model mà là đầu ra hợp lý khi câu khai không thể sai được.

Nguyên tắc 13–17 là lớp mới nhất, về **chạy nhiều agent thật sự song song và giữ cho quy trình không tự mục theo thời gian**: state phải sống ngoài hội thoại, fence phải với tới cả tài nguyên runtime chứ không chỉ file, cổng kiểm không được có đường mặc định bỏ qua, người viết báo cáo không được là người bị phê bình, và bảng đánh giá agent phải có hạn sử dụng.

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
| 13 | **State công việc nằm trong repo, không nằm trong hội thoại** — `.agent-tasks/<id>.md`; hết lượt mà chưa xong thì **bắt buộc handoff** | Bên điều phối vừa planner vừa verifier vừa committer ⇒ SPOF thật. Hết quota giữa dòng là không ai nhặt lên tiếp được: mở repo ra không thấy dấu vết nào của việc đang chạy | `SKILL.md` Bước 0.6 |
| 14 | **Fence theo FILE là KHÔNG đủ — phải fence cả tài nguyên chia sẻ ở RUNTIME** | Hai stream không đụng chung file nào, `git merge` **sạch tuyệt đối**, không lỗi type — nhưng cùng ghi một key cache với hai shape khác nhau ⇒ tính năng chết im lặng. Xung đột ngữ nghĩa giữa 2 file *khác nhau* không sinh conflict marker nào | `SKILL.md` Bước 2e |
| 15 | **Sàn kiểm tối thiểu — mọi diff qua vai kiểm; miễn trừ phải sống sót phản tỉnh trên DIFF THẬT** | "Diff nhỏ thì tự chạy" tạo ra một đường mặc định **không có vai kiểm nào**. Task nhỏ phồng thành task lớn là chuyện thường, nên miễn trừ cấp lúc chấm route phải được xét lại lúc có diff | `SKILL.md` Bước 6.0 |
| 16 | **Người viết báo cáo không phải người bị phê bình** — `role-reporter` relay nguyên văn phản hồi về rule | Rule bị phê bình phần lớn do bên điều phối viết ra; để nó vừa nhận vừa diễn đạt lại là để bên bị phê bình cầm bút. Trước đây chỉ vá bằng thủ tục, nay vá bằng phân công | `agents/role-reporter.md` |
| 17 | **Hồ sơ năng lực có HẠN, và lỗi đã ghi nhận phải quay lại prompt** | Model mới đảo định vị cả một dòng model chỉ sau vài tuần, mà **bảng cũ đọc y hệt bảng đúng**. Và hồ sơ chỉ có ích nếu failure mode của *đúng executor sắp giao* được dịch thành ràng buộc trong prompt — đọc mà không nhúng = bằng không đọc | `SKILL.md` Bước 2a + 2b · `skills/model-audit/` |

Ba thứ chống gián đoạn đi kèm: **task file** (state máy đọc, sống trong repo), **Dispatch log** (branch + worktree path tuyệt đối + bước tiếp theo), và **giao thức `_PROGRESS.md` / `_DONE.md`** — agent phụ ghi log tiến trình append-only để bên điều phối tail được, thay vì chỉ poll một tín hiệu nhị phân "xong chưa" (khi đó "đang chạy" và "đã treo 20 phút" nhìn giống hệt nhau).

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

**Điều chỉnh cho bối cảnh của bạn**: package này KHÔNG đòi vault. Mặc định chạy được trên repo trần — tracking bằng issue + PR. Vault Obsidian (hoặc `docs/` trong repo) là cấu hình thêm nếu bạn có. GitHub Projects làm board và `pnpm build` làm cổng verify cũng thay được như cũ — phần nguyên tắc thì không phụ thuộc chúng.

## Giới hạn — đọc trước khi dùng

- Gắn với công cụ mid-2026 (Claude Code, Codex CLI, Gemini/Antigravity). Tên model và cờ CLI sẽ lỗi thời trước phần nguyên tắc.
- Viết bằng tiếng Việt vì team dùng tiếng Việt. Phần rule về "viết cho người không đọc code" cố tình giữ nguyên ngôn ngữ gốc.
- Đây là **bản vô danh hoá** từ một dự án thật, không phải mã nguồn khách hàng — xem [NOTICE.md](NOTICE.md) trước khi publish thêm.

## License

MIT (xem [LICENSE](LICENSE) — điền tên bạn trước khi publish).
