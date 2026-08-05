---
name: dispatch
description: Use when the user runs /dispatch with a US id (US-085), a US markdown file path, a GitHub issue URL, or a free-text task — routes work to Sonnet 5 self-code / Codex / Gemini (separate harness, isolated local worktree) for small tasks / direct Codex / Claude-plan-then-Codex, runs a US Gate (creates the Obsidian US before dispatching when the Task Tier Gate says Full US; micro tasks get a one-line entry in the active sprint file instead), creates a work branch, picks the executor + model, executes, verifies with build+tests, and syncs the Obsidian US file. Gemini executor: Claude creates a local worktree (with `.env.local` + `pnpm install` ready) and a self-contained prompt file saved under `gemini-task-prompts/<slug>.md` in the vault; user pastes it into their own Gemini/Antigravity session. Gemini only codes within scope and writes `_DONE.md` — it never commits/pushes/merges/writes to the vault. Claude is the sole verifier + committer + merger. /dispatch never shells out to `gemini exec` itself. Never uses the premium main-loop model (currently Opus 5) to write code. Triggers: "/dispatch", "dispatch US-", "dispatch issue".
---

# /dispatch — Điều phối Claude Plan / Codex Code

Workflow: nhận US/issue/task → phân loại độ phức tạp → **US Gate** (Bước 2c — tạo US trong vault nếu task đạt tier Full US) → tạo branch → thực thi (Sonnet 5, Codex, hoặc Gemini qua worktree cách ly — task nhỏ không dùng model main-loop) → verify → sync US → báo cáo. **DỪNG trước commit/PR code — không bao giờ tự commit** (executor Gemini là ngoại lệ: Claude commit + merge CỤC BỘ sau khi tự verify `_DONE.md`, xem Bước 6 + Quy tắc cứng — vẫn không tự push/PR).

Quy ước chi tiết cho executor Gemini: `${VAULT_ROOT}\docs\<epic>\<epic>_gemini-delegation-convention.md` — quy ước tái dùng cho mọi task giao Gemini, không riêng một epic.

Thiết kế gốc: `${OBSIDIAN_ROOT}\Plugin & Skill\Dispatch-Workflow-Design.md`.

## Bước 0 — Ngữ cảnh repo

1. Xác định repo root: `git rev-parse --show-toplevel`. Không phải git repo → dừng, báo user.
2. Đọc `CLAUDE.md` của repo (lệnh build/test, data boundary, verification guide) nếu chưa có trong context.
3. Nếu repo có `.agent-rules` (đọc ở **main repo root**, không phải worktree — `${REPO_ROOT}\.agent-rules`): đọc routing table, đọc rule file khớp với task.
   - **Vì sao main repo root:** `.agent-rules` + `.agent-rules.d/` nằm trong `.gitignore` nên **không tồn tại trong worktree** do `git worktree add` tạo ra. Đây cũng là lý do Bước 3.5 bắt buộc copy hai thứ này sang worktree Gemini, và prompt Codex/Gemini phải nói rõ chỗ đọc — nếu không, executor chạy trong worktree sẽ mù hoàn toàn về rule của repo.
4. **Phân giải biến đường dẫn.** Skill này KHÔNG hardcode đường dẫn máy — mọi path dùng biến, đọc giá trị thật từ `${REPO_ROOT}\.agent-rules.local` (mẫu: `.agent-rules.local.example`). Thiếu file đó mà task cần path ngoài repo → DỪNG, hỏi user; không được đoán.

   | Biến | Nghĩa | Mặc định nếu không khai báo |
   |---|---|---|
   | `${REPO_ROOT}` | Checkout chính của repo (không phải worktree) | `git rev-parse --show-toplevel` khi đang ở main checkout |
   | `${VAULT_ROOT}` | Thư mục project trong vault Obsidian (chứa `Sprints/`, `Templates/`, `docs/`) | — (bắt buộc khai báo nếu task chạm US/sprint) |
   | `${OBSIDIAN_ROOT}` | Thư mục gốc vault Obsidian (cha của `${VAULT_ROOT}`) — nơi chứa doc cross-project | thư mục cha của `${VAULT_ROOT}` |
   | `${SKILLS_DIR}` | Thư mục skill của agent | `~/.claude/skills` |
   | `${CODEX_HOME}` | Thư mục cấu hình Codex CLI | `~/.codex` |
   | `${WORKTREE_PARENT}` | Nơi đặt worktree cách ly | thư mục cha của `${REPO_ROOT}` |

## Bước 1 — Phân giải input

Theo dạng argument:

| Dạng | Cách xử lý |
|---|---|
| `US-\d+` | Tìm file sprint có `status: in-progress` trong `${VAULT_ROOT}\Sprints\*.md` → glob `Sprints\<Week>\US-xxx*\US-xxx*.md`. Không thấy → quét mọi `Sprints\Week-*\`. Vẫn không thấy → hỏi user đường dẫn. |
| Đường dẫn `.md` | Đọc trực tiếp. Nếu nằm trong `Sprints\<Week>\` → coi là US (có bước sync cuối). |
| GitHub issue URL / `#\d+` | `gh issue view <url-or-number> --json number,title,body,labels` (chạy trong repo). |
| Text tự do | Dùng nguyên văn làm spec. Tracking quyết định ở **Bước 2c (US Gate)** — không còn "bỏ hẳn sync US". |

Trích ra: **tiêu đề, mô tả/AC, danh sách task con (nếu có), labels, `{issue_number}`**.

- `{issue_number}`: GitHub issue URL/`#\d+` → lấy số issue trực tiếp. US file → đọc frontmatter `github_issue` nếu có (US thường link sẵn issue GitHub theo rule parent/child); không có → dùng số trong mã US (vd `US-085` → `85`). Text tự do không gắn issue nào → hỏi user số issue trong CÙNG lượt AskUserQuestion ở Bước 3 (option "Không có issue" → dùng `noissue`).

## Bước 2 — Phân loại route

Chấm tín hiệu từ nội dung spec + hiểu biết codebase (Grep/Glob nhanh để ước lượng file bị đụng nếu cần):

- **Route C (Lớn — Claude plan → duyệt → Codex)** nếu KHỚP BẤT KỲ:
  - Ước lượng đụng ≥3 file
  - Đụng shared layer: `httpClient`, auth adapter, `queryKeys`, shared repository/context, AuthProvider
  - Tích hợp API endpoint chưa có trong repo / contract chưa rõ ("cần hỏi BE")
  - AC mơ hồ, thiếu, hoặc mâu thuẫn
  - Side effect đa domain (owner + staff + customer flows)
- **Route A (Nhỏ — Sonnet 5 tự code, hoặc Codex)** nếu TẤT CẢ:
  - 1–2 file, thuần UI tweak (label, CSS, spacing, i18n string)
  - Không đụng data layer, không behavior mới
  - **KHÔNG bao giờ dùng model main-loop để code Route A** — luôn giao cho Sonnet 5 (subagent) hoặc Codex.
- **Route B (Vừa — Codex trực tiếp)**: mọi trường hợp còn lại.

**Nguyên tắc biên: lưỡng lự giữa 2 nhánh → chọn nhánh LỚN hơn** (nhánh lớn có cổng duyệt của user).

## Bước 2b — Executor đề xuất (căn cứ năng lực agent)

Route A/B/C ở trên chỉ đo **độ phức tạp**. Bước này chọn **executor phù hợp năng lực** — căn cứ tài liệu `references/agent-capability-matrix.md` (đọc file đó nếu cần chi tiết/nguồn). Kết quả ở đây là option **"(Recommended)"** đưa vào AskUserQuestion ở Bước 3.4; user vẫn quyết cuối.

Chấm theo thứ tự, DỪNG ở dòng đầu khớp:

```
GATE 0 — No-go Gemini (tuyệt đối): task đụng shared layer (auth / httpClient / queryKeys /
         AuthProvider) HOẶC AC mơ hồ / contract chưa rõ ("cần hỏi BE")
         → loại Gemini. Chỉ chọn giữa Sonnet 5 / Codex.
GATE 0b — Task đụng tiền / dữ liệu / permission / migration / production
         → đánh dấu "cần agent-2 review độc lập" (áp ở Bước 6, dù executor là ai).

TRỤC BẢN CHẤT (xét TRƯỚC độ phức tạp):
  • Đa phương tiện (input có video/ảnh/log/PDF) / batch lặp nhiều file giống nhau / visual QA
        → GEMINI  (thế mạnh thật: "debug bằng ảnh/video Xuất sắc", batch/throughput)
  • Refactor dài / đa file cần consistency chặt / migration
        → CODEX   (doc: Gemini dễ mất consistency trong refactor dài)
  • Cần reasoning kiến trúc / AC phải làm rõ trước
        → CLAUDE plan (Route C) → Codex

TRỤC CODE-THẲNG (spec rõ, verify được bằng build/test, không dính các dòng trên):
  • Route A, UI tweak thuần 1–2 file          → SONNET 5 (subagent)
  • Route B/C, spec rõ, KHÔNG shared-layer     → GEMINI   (đủ giỏi khi spec rõ + giải tỏa quota Claude/Codex)
  • Route B/C, cần suy luận/iteration          → CODEX    (implementation Xuất sắc; sync sửa rẻ)
```

**Vì sao ô "Route B/C spec rõ, code thuần" default Gemini dù Codex điểm cao hơn:** động lực chính là giải tỏa pool quota Claude/Codex (Gemini pool lớn hơn nhiều), và Gemini đủ tin cậy khi spec rõ. Đây là **quota bias** — chỉ áp ở đúng ô này, không bao giờ ghi đè GATE 0.

Quota bias phá thế hòa: khi Gemini và Codex ngang completion-confidence và cùng qua GATE 0 → nghiêng Gemini.

## Bước 2c — US Gate (có tạo US trong vault Obsidian hay không)

Nguyên tắc: **US là spec-IN, không phải record-OUT.** US được tạo TRƯỚC khi giao executor vì chính nó là văn bản nhúng nguyên văn vào prompt Codex/Gemini (cả hai không đọc được vault lẫn hội thoại này). **KHÔNG bao giờ retro-tạo US chỉ để lưu vết** — lưu vết là việc của GitHub issue body + dòng ad-hoc trong sprint file. Ngoại lệ duy nhất: escalation ở Bước 6 (gate chấm sai).

Gate này **agent tự quyết, KHÔNG hỏi user** (nguyên văn `task-sizing.md`: "Agent tự quyết theo gate, KHÔNG hỏi user từng lần"). Chỉ *nội dung* US draft mới cần duyệt, và duyệt tại cổng Route C — không thêm lượt AskUserQuestion nào.

**1. US đã tồn tại chưa?**

- Input `US-\d+` / US path → `US_EXISTS`.
- Input GitHub issue → **tìm US backlink trong vault trước khi kết luận là chưa có** (US thường đã link issue theo rule parent/child):
  ```bash
  grep -rlE "^(github_issue|dev_issue):.*#<issue_number>$" "${VAULT_ROOT}/Sprints" --include="US-*.md"
  ```
  Thấy → `US_EXISTS`, dùng US đó, KHÔNG tạo mới. Không thấy → sang mục 2.
- Text tự do → sang mục 2.

**2. Chạy Task Tier Gate** — đọc `.agent-rules.d/task-sizing.md` (§"Task Tier Gate"), KHÔNG copy tiêu chí vào file này (một nguồn duy nhất, tránh lệch). Kết quả: `MICRO` hoặc `US_NEEDED`.

**3. Xử lý theo nhánh:**

| Nhánh | Hành động |
|---|---|
| `US_EXISTS` | Không tạo gì mới. Cập nhật `status: in-progress` + `assignee` + Dispatch log ngay ở Bước 3.8 (không chờ Bước 7). **KHÔNG đổi route** — US đã được duyệt trước đó, đừng bắt duyệt lại. |
| `MICRO` | KHÔNG tạo file US, KHÔNG tạo folder trong `Sprints/<week>/`. Tracking = 1 dòng trong sprint file, ghi ở Bước 3.8. |
| `US_NEEDED` | Tạo US ngay tại bước này (mục 4) **và ép lên Route C** — cổng duyệt plan của Route C trở thành cổng duyệt US draft. Nhất quán với "lưỡng lự → chọn nhánh LỚN hơn" và với yêu cầu "story được duyệt trước khi code" của `obsidian-us-workflow.md` + CLAUDE.md. Đã là Route C thì không đổi gì. |

**4. `US_NEEDED` — tạo US theo thứ tự reserve-then-fill** (làm TRƯỚC Bước 3 để fail sớm, đừng fail sau khi đã dựng worktree + `pnpm install`):

a. **Kiểm tra sprint active tồn tại**: file trong `${VAULT_ROOT}/Sprints/*.md` có frontmatter `status: in-progress`. Không có → DỪNG, hỏi user (đúng một sprint được `in-progress` tại mọi thời điểm).

b. **Cấp id** = max hiện có + 1, quét toàn vault (id duy nhất toàn vault, không chỉ trong tuần):
```bash
ls -d "${VAULT_ROOT}"/Sprints/Week-*/US-* | sed 's#.*/US-##' | cut -d- -f1 | sort -n | tail -1
```

c. **Ghi ngay file stub** (frontmatter + tiêu đề, chưa cần AC đầy đủ):
`${VAULT_ROOT}/Sprints/<active-week>/US-0XX-<slug>/US-0XX-<slug>.md`
- **Folder name TRÙNG file basename** (vd `US-095-staff-stats/US-095-staff-stats.md`) — đây là quy ước thực tế từ Week-06 trở đi. Slug kebab tiếng Anh ≤5 từ, dùng lại slug của branch ở Bước 3.
- Vault chỉ là thư mục thường trên ổ đĩa: **ghi file = tạo folder**, không cần `mkdir`, không có bước reindex. `mkdir -p` chỉ cần khi folder phải tồn tại trước cho tiến trình khác ghi vào (vd `capture-evidence.mjs` xuất PNG).
- Ghi stub NGAY để **giữ chỗ id**: nhiều stream Codex/Gemini song song mà chỉ "đọc id kế tiếp" rồi mới ghi sau sẽ cấp trùng id.

d. **Fill nội dung** theo `.agent-rules.d/obsidian-us-workflow.md` mục 4 (frontmatter YAML `type/us_id/title/sprint/status/priority/created/author/assignee` + body `## 👤 User Story` / `## 🎯 Goal` / `## ✅ Acceptance Criteria (AC)` / `## 📋 Tasks / TODOs`). Tasks theo `.agent-rules.d/task-sizing.md` (category chuẩn + `(Xh)` 0.5–8h). Dùng `Templates/User_Story_Template.md` (đã đồng bộ 2026-07-28: frontmatter YAML + heading đúng convention + `## 🤖 Dispatch log`) — nhớ thay placeholder `US-XXX`/`Week-XX`. Nếu template có dấu hiệu lệch trở lại thì tin **US anh em gần nhất trong vault**, không tin template.

e. **Đăng ký vào sprint file active** — tạo folder KHÔNG phải là tracking. Thêm checkbox vào section `## 📋 Chi tiết mục tiêu (Epic Detail)`, đúng style đang dùng (wikilink tính từ `Sprints/`):
```markdown
- [ ] **US-0XX ([[Week-NN/US-0XX-<slug>/US-0XX-<slug>|US-0XX]]):** <tiêu đề ngắn> (**Xh**).
```

**US folder thuộc tuần TẠO RA nó, không phải tuần active.** Khi carry-over, sprint mới chỉ wikilink tới folder cũ — **KHÔNG di chuyển, KHÔNG copy folder** (xem `.agent-rules.d/carry-over.md`).

## Bước 3 — Tạo branch (mọi route, TRƯỚC khi sửa file)

1. `git status` — working tree bẩn → DỪNG, hỏi user xử lý (stash/commit/tiếp tục trên nhánh hiện tại) trước.
2. Suy `{type}`: label GitHub `bug` → `bug`; `enhancement`/`feature` → `feat`; nội dung nói hotfix/production → `hotfix`; US cải tiến → `feat`; sửa lỗi → `bug`. Không rõ → đưa vào câu hỏi ở mục 3.
3. Đặt tên đề xuất: `{type}/{issue_number}_{slug-kebab-ngắn-gọn}` (vd `bug/342_payout-tooltip-overlap`, `feat/358_staff-dashboard-statistics`). Slug từ tiêu đề, tiếng Anh, ≤5 từ. Dùng `_` để nối `{issue_number}` với slug (không dùng `-` ở vị trí đó, tránh lẫn với dấu nối trong slug). Không có issue (text tự do, user chọn "Không có issue") → `{type}/noissue_{slug}`.
4. AskUserQuestion MỘT lần: chọn **base branch** (options: `master`, `staging`, `dev` — chỉ liệt kê nhánh thật sự tồn tại trên origin + "Dùng nhánh hiện tại"), hiện tên nhánh đề xuất trong câu hỏi để user chỉnh qua Other nếu muốn.
   - **Executor đề xuất = kết quả Bước 2b** — đưa lên đầu danh sách và gắn "(Recommended)", các executor còn lại (không bị GATE 0 loại) làm option thay thế. Nêu 1 dòng lý do ngắn theo Bước 2b (vd "đa phương tiện → Gemini", "shared layer → Codex").
   - **Route A**: gộp câu hỏi executor vào CÙNG một lần AskUserQuestion (2 questions) — options theo Bước 2b trong `Sonnet 5 (subagent)` / `Gửi qua Codex` / `Gửi qua Gemini (harness riêng)` (bỏ Gemini nếu GATE 0 loại).
   - **Route B**: gộp câu hỏi executor (CÙNG lượt) — `Gửi qua Codex` / `Gửi qua Gemini (harness riêng)`, recommended theo Bước 2b (Gemini nếu spec rõ + không shared-layer; Codex nếu cần iteration/consistency hoặc GATE 0).
   - **Route C**: KHÔNG hỏi executor ở đây — hỏi gộp vào cổng duyệt plan (Bước 5, Route C bước 2): Codex / Gemini, recommended theo Bước 2b.
5. Tạo branch — tách theo executor (`git fetch origin <base>` trước trong mọi trường hợp):
   - **Route A/B, executor Sonnet 5 / Codex**: `git checkout -b <tên-nhánh> origin/<base>` (trừ khi user chọn nhánh hiện tại). Claude/Codex sẽ code ngay trong checkout này.
   - **Route A/B, executor Gemini**: Claude tạo **worktree cách ly cục bộ** ngay — path riêng nên KHÔNG đụng branch Claude đang đứng, không có nguy cơ `already checked out`:
     ```bash
     git worktree add <path-worktree-mới> -b <tên-nhánh> origin/<base>
     ```
     Path đặt cạnh repo chính (`${WORKTREE_PARENT}\<repo-name>-<slug>`). Sau đó, TRONG worktree mới:
     1. Copy `.env.local` (và file config untracked khác nếu repo cần) từ repo chính sang.
     2. **Copy `.agent-rules` + `.agent-rules.d/` từ repo chính sang** — hai thứ này bị `.gitignore` nên `git worktree add` KHÔNG mang theo; không copy thì executor trong worktree mù hoàn toàn về rule của repo (issue template, evidence, US workflow, task sizing):
        ```bash
        cp "<repo-chính>/.agent-rules" "<path-worktree>/.agent-rules"
        cp -r "<repo-chính>/.agent-rules.d" "<path-worktree>/.agent-rules.d"
        ```
     3. `pnpm install` (chạy nền — dùng chung pnpm store nên nhanh).
     4. Xác định **cụm file** task được phép sửa, đối chiếu với các stream Gemini/Codex khác đang chạy song song (nếu có) → phải RỜI nhau; liệt kê file cấm trong prompt ở Bước 5.
   - **Route C (executor chưa biết — quyết ở cổng duyệt plan)**: tạo branch pointer **không checkout** để không khoá lựa chọn executor: `git branch <tên-nhánh> origin/<base>`. Việc checkout (nếu Codex) hoặc tạo worktree cách ly (nếu Gemini) làm ở Bước 5 sau khi user chọn.
6. **Ghi nhớ base** — nhánh tích hợp/PR sau này target về đúng base này, không mặc định master.
7. **Executor = Gemini → xác nhận worktree đã sẵn sàng**: branch tồn tại (local, trong worktree mới), `.env.local` đã copy, **`.agent-rules` + `.agent-rules.d/` đã copy**, `pnpm install` đã xong. KHÔNG cần publish remote — Gemini (chạy trong harness riêng của user, Antigravity) chỉ cần **mở trực tiếp path worktree này**, không phải tự `git fetch`/`git worktree add`. Báo user path worktree đã sẵn sàng trước khi soạn prompt (Bước 5).
8. **Ghi trạng thái NGAY khi đã có branch — đừng chờ Bước 7.** Lý do §"Chống gián đoạn": phiên có thể chết bất cứ lúc nào; US còn `planned` trong khi branch/worktree đã tồn tại là "tình trạng không rõ ràng" cho phiên sau. Theo nhánh US Gate (Bước 2c):
   - **`US_EXISTS` / `US_NEEDED`** → sửa file US: `status: in-progress`, `assignee` theo executor đã chọn (format ở Bước 7), và thêm/cập nhật section:
     ```markdown
     ## 🤖 Dispatch log
     | Khi | Executor | Model/Effort | Branch (base) | Worktree | Trạng thái |
     |---|---|---|---|---|---|
     | 2026-07-28 14:10 | Gemini | (user chọn trong harness) | feat/358_staff-stats (staging) | ${WORKTREE_PARENT}\<repo>-staff-stats | 🟡 ASSIGNED |
     ```
     Worktree ghi **path tuyệt đối** (có ≥2 worktree song song thì tên nhánh không đủ phân biệt). Cập nhật lại dòng này ở mọi mốc của §"Chống gián đoạn", không chỉ lúc xong.
   - **`MICRO`** → 1 dòng vào `## 🔗 Ad-hoc PRs & Issues` của sprint file active. Format chuẩn trong `task-sizing.md` giả định đã có PR/issue, còn `/dispatch` dừng TRƯỚC commit/PR → dùng dạng trung gian "đang chạy":
     ```markdown
     - [ ] <title> (1h) — 🟡 dispatching · branch `bug/342_payout-tooltip` · Codex · wt `<path nếu executor Gemini>`
     ```
     **Chưa verify thì KHÔNG tick `[x]`** (checkbox = Dev done → script weekly report cộng giờ ngay). `/create-pr-issues` sẽ rewrite dòng này về format chuẩn của `task-sizing.md` (`- [x] … — PR #… · QA #… Testing · Dev #…`) khi PR/issue đã có.

## Bước 4 — Chọn model Codex (chỉ khi executor = Codex, mọi route)

Bỏ qua bước này nếu: executor = Sonnet 5 (Route A subagent, không gọi Codex), HOẶC executor = Gemini bất kỳ route nào (user tự chọn model trong harness Gemini riêng của họ — `/dispatch` không quản lý model Gemini).

Đọc LIVE, không hardcode:

```bash
python3 -c "import json,os;d=json.load(open(os.path.expanduser('~/.codex/models_cache.json'),encoding='utf-8'));[print(m['slug'],m.get('default_reasoning_level')) for m in d['models'] if m.get('visibility')!='hide']"
grep -E "^model|^model_reasoning_effort" ~/.codex/config.toml
```

Ánh xạ effort theo **rủi ro/độ mơ hồ** (doc §4.1/§4.3 — xem `references/agent-capability-matrix.md`), model đọc slug LIVE từ cache theo VAI TRÒ (<codex-daily>=daily default / <codex-hard>=khó-polish / <codex-batch>=batch), không hardcode:

| Loại task | Codex model-role | Effort |
|---|---|---|
| Route A (copy/CSS/import, executor=Codex) | <codex-batch>/<codex-daily> | `low` |
| Route B (component/API/CRUD/bug có repro) | <codex-daily> (default config.toml) | `medium` |
| Route B feature đa file/test | <codex-daily>/<codex-hard> | `high` |
| Route C (bug khó, trade-off, visual phức tạp) | <codex-hard> | `xhigh` (Extra High) |
| Migration/payment/permission/production | <codex-hard> | `max` + BẮT BUỘC agent-2 review (GATE 0b) |

- Route C: nêu 1 phương án model thay thế (frontier khác trong cache) ở cổng duyệt.
- Model trong config không còn trong cache → dùng slug đầu tiên visibility=list, báo user.
- Max/Ultra KHÔNG hợp requirement mơ hồ → nếu AC mơ hồ, GATE 0 đã ép Route C plan (Claude khóa sản phẩm trước), không nhảy thẳng Max.

## Bước 5 — Thực thi theo route

### Route A — Sonnet 5 tự code (mặc định) hoặc Codex

**KHÔNG tự sửa code bằng model main-loop hiện tại (Opus 5).** Theo executor đã chọn ở Bước 3.4:

- **Executor = Sonnet 5**: spawn subagent để code, đặt `model: "sonnet"` (Sonnet 5). Prompt subagent: nhúng TOÀN VĂN spec/US, liệt kê file trong scope, yêu cầu tuân chuẩn repo (data boundary, style xung quanh), chạy `pnpm build`, và **không commit**. Subagent sửa file trực tiếp trong repo rồi trả về danh sách file đổi + kết quả build. Dùng `agentType: "general-purpose"`. Xong → sang Bước 6.
- **Executor = Codex**: đi theo nhánh "Route B/C — Gọi Codex" bên dưới với effort `low` (model đã chọn ở Bước 4).
- **Executor = Gemini**: đi theo mục "Executor = Gemini — Worktree cách ly + prompt file" bên dưới. KHÔNG sang Bước 6-8 trong lượt này (xem lý do trong mục đó).

Không cần preview/test file mới (rule "UI tweaks: pnpm build only").

### Route C — Plan trước
1. Viết plan ngắn: mục tiêu, file sẽ đổi, thứ tự bước, rủi ro, định nghĩa done. Lưu `plan.md` vào **folder US** (`US_EXISTS` hoặc US vừa tạo ở Bước 2c — Route C luôn có US, vì `US_NEEDED` bị ép lên Route C và `MICRO` không bao giờ tới Route C). Nếu đang ở Route C mà nhánh gate là `MICRO` thì gate chấm sai → quay lại Bước 2c.
2. AskUserQuestion: duyệt plan (**+ duyệt US draft nếu US vừa tạo ở Bước 2c**) + chọn **executor** (`Gửi qua Codex` mặc định "(Recommended)" / `Gửi qua Gemini (harness riêng)`) + model/effort nếu Codex (Gemini không cần chọn model ở đây) — đây là cổng duyệt DUY NHẤT. User chỉnh → sửa plan rồi hỏi lại.
3. Duyệt xong, hoàn tất branch theo executor vừa chọn (branch mới chỉ là pointer, chưa checkout — xem Bước 3.5 Route C):
   - **Codex**: `git checkout <tên-nhánh>` để chiếm working tree, rồi dispatch như Route B nhưng nhúng plan vào prompt.
   - **Gemini**: tạo worktree cách ly cục bộ (`git worktree add <path> -b <tên-nhánh> origin/<base>`, copy `.env.local`, `pnpm install` — như Bước 3.5 Route A/B), rồi đi theo mục "Executor = Gemini — Worktree cách ly + prompt file" bên dưới, nhúng plan vào phần `<task>`.

### Route B/C — Gọi Codex

Soạn prompt (nhúng TOÀN VĂN spec/US/plan — Codex không đọc được file ngoài repo):

```
IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. Stay focused on repository code only.

<task>
[Toàn văn US/issue/task + plan nếu route C. Tiêu đề + AC + tasks.]
</task>

<repo_rules>
Read `.agent-rules` at the repo root first (routing table), then read the rule file it points to for this task. These are gitignored files that DO exist in your working directory — they are the repo's own conventions and they override your defaults.
If you will create/edit a GitHub issue or PR body, `.agent-rules.d/github-issue.md` is the ONLY source of truth for wording and body template — do not invent your own structure.
</repo_rules>

<action_safety>
- Only modify files within scope: [liệt kê vùng file/thư mục].
- Follow the repo data boundary: components -> hooks -> repositories -> adapter. Normalization lives in repositories only.
- No unrelated refactors, no dependency changes, no console.* (use the project logger).
- Do NOT commit. Leave changes in the working tree.
</action_safety>

<verification_loop>
Run `pnpm build` before reporting done. If it fails, fix and re-run. Report which files you changed and the build result.
</verification_loop>

Done means: [AC cụ thể] pass, build green, no files outside scope touched.
```

Chạy (Bash `timeout: 600000`; task lớn → `run_in_background: true`):

```bash
codex exec -s workspace-write -C "<repo-root>" -m <model> -c 'model_reasoning_effort="<effort>"' --json "<prompt>" < /dev/null 2>/tmp/codex-err.txt | python3 -u -c "
import sys, json
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    try:
        o=json.loads(line); t=o.get('type','')
        if t=='thread.started': print('SESSION_ID:'+o.get('thread_id',''),flush=True)
        elif t=='item.completed':
            i=o['item']; it=i.get('type',''); tx=i.get('text','')
            if it=='agent_message' and tx: print(tx,flush=True)
            elif it=='command_execution' and i.get('command'): print('[codex ran] '+i['command'],flush=True)
        elif t=='turn.completed':
            u=o.get('usage',{}); print('tokens:',u.get('input_tokens',0)+u.get('output_tokens',0),flush=True)
    except: pass
"
```

- Lưu `SESSION_ID` vào `.context/codex-session-id` (trong repo) để resume.
- Exit ≠ 0 hoặc timeout → đọc stderr, báo user nguyên văn lỗi. Gặp `unknown variant` trong models cache → đề xuất `npm install -g @openai/codex@latest`.
- Follow-up/sửa tiếp: `codex exec resume <SESSION_ID> "<chỉ thị delta>" ...` — chỉ gửi phần thay đổi, không lặp lại toàn bộ prompt.

### Executor = Gemini — Worktree cách ly + prompt file (harness riêng, KHÔNG tự chạy qua Bash)

Theo `<epic>_gemini-delegation-convention_260722` (quy ước tái dùng). Gemini chạy trong **harness/session riêng của user** (Antigravity) — không phải subprocess do Claude spawn qua Bash như Codex (`gemini exec ...` KHÔNG được tự gọi ở đây). Vai trò của `/dispatch` ở nhánh này: chuẩn bị worktree (đã làm ở Bước 3.5/Route C) + soạn **prompt file** đầy đủ ngữ cảnh, KHÔNG tự thực thi.

**Không cần publish remote / không cần Gemini tự git.** Vì Claude đã tạo worktree bằng path RIÊNG ở Bước 3 (không phải remote-only push), Gemini không cần `git fetch`/`git worktree add` — chỉ mở đúng path đó trong Antigravity. Điều này cũng loại bỏ hẳn rủi ro `already checked out` giữa các worktree Claude/Codex/Gemini dùng chung 1 object store của repo.

**Cụm file KHÔNG được đụng nhau khi chạy song song**: nếu đang có stream Codex/Gemini khác chạy trên cùng repo, liệt kê rõ file/thư mục stream kia đang giữ vào phần `Do NOT touch` trong prompt bên dưới.

**Nơi lưu prompt file** — theo thứ tự ưu tiên, KHÔNG hỏi user ở 3 nhánh dưới đây (ghi file là tạo folder, không cần `mkdir`):

1. **Task có US** (`US_EXISTS` / `US_NEEDED`) → `<folder US>/prompts/<slug>.md`. Folder US là **hub multi-agent**: `US-0XX-<slug>.md` (spec + Dispatch log) · `plan.md` (Route C) · `prompts/<slug>.md` · `_DONE-<slug>.md` (copy ở Bước 6) · evidence. Nhánh này KHÔNG hỏi user nơi lưu.
2. **Task cấp epic không có US** (vd <epic>) → `Acme/docs/<project-slug>/gemini-task-prompts/<slug>.md`, tạo `README.md` index nếu chưa có (mẫu: `Acme/docs/<epic>/gemini-task-prompts/README.md`) và thêm 1 dòng vào bảng "Index prompt hiện có".
3. **`MICRO`** (không US, không epic) → `Sprints/<active-week>/Ad-hoc Evidence/<slug>/prompt.md` — dùng chung folder với evidence của chính micro task đó, để 1 micro task = 1 folder.

Chỉ hỏi user nơi lưu khi cả ba đều không áp dụng được (vd không xác định được sprint active).

**Vì sao KHÔNG còn nhúng rule tạo issue/PR vào prompt**: theo quy ước mới, Gemini **không** commit/push/merge/mở PR/tạo issue — chỉ code trong scope rồi ghi `_DONE.md`. Toàn bộ git (commit, merge cục bộ) do Claude làm ở Bước 6 sau khi tự verify; push lên origin / mở PR / tạo issue (nếu task này có issue riêng, không phải 1 phần việc nhỏ trong epic) vẫn theo quy trình thường của `/dispatch` — hỏi user riêng, không tự động.

Soạn prompt theo template BẮT BUỘC (nhúng TOÀN VĂN spec/US/plan — Gemini không đọc được ngữ cảnh cuộc hội thoại này), lưu thành file `<slug>.md` ở nơi đã xác định trên:

```markdown
# Gemini/Antigravity task — <TÊN TASK>

> Mở thư mục này trong Antigravity: **`<WORKTREE PATH>`**
> (git worktree cách ly, branch `<BRANCH>`). Paste phần dưới vào Gemini.

---

You are working in `<WORKTREE PATH>` (git worktree of <repo>, branch `<BRANCH>`).
<1-2 câu bối cảnh dự án>. Bạn không có ký ức phiên trước; đọc kỹ trước khi sửa.

Stack: <stack>. Deps đã cài; `.env.local` có sẵn.

**Đọc rule của repo TRƯỚC khi sửa gì:** mở `.agent-rules` ở gốc worktree (bảng routing), rồi đọc file rule khớp với task trong `.agent-rules.d/`. Đây là file gitignored nhưng ĐÃ được copy sẵn vào worktree này — là quy ước riêng của repo và ưu tiên hơn thói quen mặc định của bạn. Nếu task đụng tới nội dung GitHub issue/PR thì `.agent-rules.d/github-issue.md` là nguồn DUY NHẤT về giọng văn và template — không tự chế cấu trúc khác.

**SCOPE — chỉ những file/khu vực này là của bạn:** <liệt kê file/thư mục ước lượng ở Bước 2>.
Do NOT touch: <liệt kê file các stream song song đang giữ, nếu có>. Không tạo/sửa file ngoài scope.

**Ngữ cảnh sẵn có (tái dùng, đừng làm lại):** <hook/repo/util đã có + chữ ký — tuân data boundary components -> hooks -> repositories -> adapter, normalization DTO chỉ ở repository>.

**Việc cần làm:** <toàn văn US/issue/task + plan nếu Route C — các bước cụ thể, đánh số>.

**Verify — build xanh KHÔNG phải bằng chứng type đúng:** bundler (vite/esbuild/swc) *strip* type chứ không *check*. Chỉ `tsc --noEmit` mới là bằng chứng. Chạy đủ ba: (1) typecheck — repo có **<N> lỗi tồn đọng** (baseline), target là về đúng <N> và **0 lỗi thuộc file của bạn**; (2) test targeted vùng đổi; (3) build. Không refactor ngoài phạm vi, không đổi dependency, không `console.*` (dùng logger project).

**RETURN (bắt buộc):** ghi `_DONE.md` ở gốc worktree (để untracked, KHÔNG commit). Quy tắc cho mọi ô: **dán nguyên văn output của máy, đừng viết lại bằng tính từ** — "typecheck passed" / "build xanh" / "tests pass" là câu không kiểm được nên coi như chưa khai. Bên điều phối re-run toàn bộ và đối chiếu từng con số.
- **Con số** tổng lỗi typecheck trước/sau + dòng grep xác nhận 0 lỗi thuộc file của bạn
- `git status --short` nguyên văn (căn cứ về scope, không phải câu "không đụng file ngoài scope")
- Dòng tổng kết pass/fail nguyên văn từ test runner
- File đã tạo/đổi · cách verify từng AC · follow-up (nếu có)
- **Cái gì bạn KHÔNG verify được và vì sao** — để trống ô này thì báo cáo không hợp lệ
- KHÔNG viết câu tổng quát tự khen ("no scope violation", "all clean"): chỉ khai đúng cái bạn thật sự chạy, kèm output. Không chạy được thì ghi BLOCKED, không suy luận từ việc đọc code rồi khai như đã kiểm.
- `## Đề xuất đổi rule` — **bắt buộc có mục này**, ghi `Không có` nếu không có. Rule nào chặn bạn / sai / không phủ tình huống thì ghi: file nào, đổi thành gì, tình huống rule hiện tại không xử lý được, kèm lệnh + output thật. **Đừng tự sửa file rule**, đừng lặng lẽ đi đường vòng.

Do NOT commit. Do NOT push. Do NOT merge. Do NOT ghi vào vault Obsidian.
```

Cập nhật index README (bảng "Index prompt hiện có") + board/tracking của epic nếu project có (vd live board trong `<epic>_agent-orchestration_...md`) → trạng thái 🟡 ASSIGNED. Repo/project không có board tương tự → bỏ qua, chỉ cần index README.

In cho user: đường dẫn file prompt vừa lưu + 1 dòng nhắc "mở worktree path ghi ở đầu file trong Antigravity, paste phần dưới `---` vào Gemini" (KHÔNG tự thực thi qua Bash). Bỏ qua Bước 6-8 trong lượt hiện tại (chưa có `_DONE.md` để verify).

**Tự động theo dõi, không chờ user quay lại báo:** ngay sau khi in prompt, chạy 1 lệnh Bash nền (`run_in_background: true`) poll `_DONE.md` mỗi 30s:

```bash
until [ -f "<path-worktree>/_DONE.md" ]; do sleep 30; done; echo "_DONE.md detected at $(date)"
```

- Nhiều worktree Gemini chạy song song → mỗi worktree 1 lệnh poll riêng (chạy nền độc lập), không gộp chung 1 lệnh.
- KHÔNG dùng foreground sleep-loop chặn session — luôn `run_in_background: true` rồi làm việc khác/để user tự dùng; harness sẽ báo khi lệnh nền hoàn tất (tức `_DONE.md` đã xuất hiện).
- Lệnh nền timeout/kết thúc trước khi Gemini xong (task dài) → phát hiện qua việc `_DONE.md` vẫn chưa có, chạy lại đúng lệnh until-loop trên để tiếp tục theo dõi, không cần hỏi user.
- User có thể vẫn tự báo "Gemini xong rồi" bất cứ lúc nào (không cần chờ tín hiệu nền) — khi đó kiểm tra `_DONE.md` ngay lập tức thay vì đợi vòng poll kế tiếp.
- Khi lệnh nền báo hoàn tất (đã thấy `_DONE.md`) → tự động sang Bước 6 (Executor = Gemini) mà KHÔNG cần user nhắc lại.

## Bước 6 — Verify (mọi route; executor = Gemini theo quy trình riêng ngay dưới đây)

**Ai verify — phân vai bằng cổng cứng, không bằng lời dặn.** Người kiểm mà có tool ghi thì sẽ vá cho xanh thay vì báo đỏ. Nên verify giao cho subagent định nghĩa sẵn **không có tool ghi** (xem `agents/`):

| Việc | Vai | Khi nào |
|---|---|---|
| typecheck/test/build/diff + scope | `role-verifier` (no write tools) | diff lớn hoặc nhiều bước kiểm; diff nhỏ thì bên điều phối tự chạy |
| hash ảnh + đối chiếu bảng PASS | `role-evidence-auditor` (model rẻ) | báo cáo có ảnh evidence hoặc bảng PASS/FAIL nhiều dòng |
| review nghiệp vụ (GATE 0b) | `role-reviewer` (no write tools) | task đụng tiền/dữ liệu/permission/migration/production |

`role-verifier` hỏi *"chạy có xanh không"*, `role-reviewer` hỏi *"xanh mà có đúng không"* — hai câu khác nhau, đừng gộp một vai. Vai trả `FAIL`/`CHANGES NEEDED` thì bên điều phối sửa hoặc giao lại executor, **không tự nới bar**.

**Verify BẰNG CHỨNG, không chỉ code (áp cho MỌI executor; bắt buộc khi báo cáo có bảng PASS/FAIL hoặc ảnh evidence).** Bước 6 vốn chỉ kiểm code — `diff`/scope/build/typecheck — nên một báo cáo bịa *bằng chứng* vẫn đi qua sạch sẽ. Năm check dưới đây đóng đúng chỗ đó:

1. **Hash mọi ảnh evidence**: `md5sum *.png | sort`. Hai file **trùng hash** mà được khai cho 2 AC / 2 trạng thái khác nhau ⇒ bằng chứng bịa → reject **cả bảng**, không chỉ hàng đó. Đã gặp thật: cùng một file ảnh chống lưng cho cả một AC ở màn quản trị lẫn một AC "đã kiểm cách ly dữ liệu giữa hai loại tài khoản".
2. **Đối chiếu cột evidence với LOẠI AC**: AC hành vi (click / nhập / reload / đăng nhập / đổi viewport) mà cột evidence ghi "static code review", "verified in code", "based on <cơ chế>" ⇒ **suy luận, không phải quan sát** → hàng đó là **BLOCKED, không phải PASS**. Executor hạ cấp âm thầm kênh xác minh nhưng giữ nguyên chữ PASS ở cột phán quyết là dạng bịa hay gặp nhất, và đọc rất giống báo cáo thật.
3. **Đếm ảnh khai vs file thật** trong thư mục. Khai mà không có file, hoặc file bé bất thường (đã gặp: một "ảnh" 9 byte, nội dung là chữ `Not Found` — tải ảnh từ URL issue thất bại) ⇒ chưa chạy thật. Ảnh input mà executor không mở được thì đừng trỏ bằng URL: **tải về, đính path tuyệt đối**; không có ảnh thì nói rõ là chưa có chứ đừng đoán hộ lỗi trong prompt — giả thuyết trong prompt sẽ quay lại thành "phát hiện" trong báo cáo.
4. **Ảnh chụp trên build đã bị executor patch = vô giá trị**: `git status` TRƯỚC khi tin bất kỳ ảnh nào. Task chỉ-test mà có file source bị sửa ⇒ cách ly toàn bộ ảnh vào `INVALID-<executor>-patched-build/`, revert patch, giao lại — kể cả ảnh trông đúng. **Lệnh cấm viết trong prompt KHÔNG đủ**: đã gặp ca prompt cấm rõ ràng, cho phép nói BLOCKED, executor vẫn sửa 7 file source để 32/32 AC thành PASS. Áp lực điền cho đủ bảng thắng lệnh cấm bằng chữ — nên bảng phải kiểm bằng máy.
5. **Câu tổng quát tự khen trong `_DONE.md` không tính là đã verify**: "không đụng file ngoài scope", "no repository imports", "all AC pass" — bên điều phối phải tự kiểm bằng `diff`/`grep`, hoặc coi như chưa khai.

**Relay đề xuất đổi rule (áp cho MỌI executor, chạy ngay sau khi đọc báo cáo).** Executor thường **không với tới được** thư mục rule dùng chung: nó làm trong worktree của repo product, còn rule/harness nằm ở repo khác, và prompt của nó thường cấm hẳn đọc thư mục config của agent. Nên tiếng nói của nó vào rule qua đúng một đường: mục `## Đề xuất đổi rule` trong báo cáo → bên điều phối chuyển tiếp. Ba điều kiện, thiếu một cái là relay biến thành cửa kiểm duyệt:

1. **Nguyên văn.** Copy y hệt lời executor, đặt trong blockquote. Chỉ được **thêm**, không được viết lại — chất liệu root-cause quý nhất là *agent nói bằng lời của nó rằng nó tưởng cái gì*, tóm tắt lại là mất đúng chỗ đó.
2. **Tách phần của bên điều phối.** Số đo đã chạy lại đặt trong mục riêng `## Verify`, KHÔNG trộn vào lời executor. Đây là điểm relay hơn cho ghi trực tiếp: câu khai được đính bằng chứng đã kiểm thay vì thành một bản tự báo cáo nữa.
3. **Không đồng ý thì vẫn phải ghi lại**, `status: rejected` + lý do. Rule bị phê bình phần lớn do bên điều phối viết, nên nó không được vừa là cổng vào vừa là quan toà.

**Cổng escalation `MICRO` → US (áp cho MỌI executor, chạy ngay khi thấy diff thật)**: nếu Bước 2c chấm `MICRO` mà diff thực tế đụng **≥3 file** HOẶC chạm **shared layer** (`httpClient`, auth adapter, `queryKeys`, AuthProvider, shared repository/context) HOẶC phát sinh câu hỏi BE → **DỪNG** theo rule "Escalation (chống lan man)" trong `task-sizing.md`:

1. Tạo US hồi tố theo Bước 2c mục 4 (dùng diff thật làm `## 📋 Tasks / TODOs`, code đã viết làm evidence).
2. Xoá dòng ad-hoc `🟡 dispatching` trong sprint file, thay bằng checkbox US trong `## 📋 Chi tiết mục tiêu (Epic Detail)`.
3. Báo user (scope đã phình so với lúc chấm gate), rồi mới tiếp phần verify bên dưới.

Đây là **trường hợp DUY NHẤT được retro-tạo US** — biện minh là gate đã chấm sai từ đầu, không phải để lưu vết.

### Executor = Gemini — verify + commit + merge cục bộ

Chạy khi lệnh poll nền báo `_DONE.md` đã xuất hiện (tự động, không cần user nhắc — xem "Tự động theo dõi" ở mục trên), HOẶC khi user tự báo Gemini đã xong trước khi poll kịp phát hiện. Không chạy trong lượt publish-prompt.

1. Đọc `_DONE.md` ở gốc worktree — **không tin báo cáo suông**. `_DONE.md` chứa secret (token/api_secret/password) → xoá file ngay, cảnh báo user rotate, không tiếp tục đọc như bình thường.
2. `git -C <worktree> diff` + `git -C <worktree> status` để xác nhận thực tế đã đổi gì — đối chiếu với tóm tắt trong `_DONE.md`.
3. Kiểm **scope**: đúng cụm file đã giao trong prompt (mục SCOPE), không đụng file trong `Do NOT touch`. File lạ ngoài scope → báo user trước khi đi tiếp, KHÔNG tự merge.
4. Tự chạy `pnpm build` (và test targeted nếu áp dụng) trong worktree — verify độc lập, không tin kết quả build ghi trong `_DONE.md`.
5. GATE 0b (nếu Bước 2b đã đánh dấu tiền/dữ liệu/permission/migration/production) → vẫn cần agent thứ 2 review độc lập trước khi coi là xong, như route thường.
6. **OK** (scope đúng + build/test xanh + GATE 0b đã qua nếu áp dụng) → commit trên branch trong worktree (message rõ ràng) → merge branch đó vào branch tích hợp hiện tại (branch chính Claude/user đang làm việc, **cục bộ — KHÔNG tự push lên origin**) → **copy `_DONE.md` về folder US thành `_DONE-<slug>.md` TRƯỚC khi xoá worktree** (nếu task có US; đã scan secret ở mục 1) → `git worktree remove <path>` + xoá branch đã merge xong → cập nhật index README + board (nếu project có) thành ✅ MERGED kèm commit hash.
   - Vì sao phải copy: `_DONE.md` là bản tự báo cáo duy nhất của executor, nằm untracked trong worktree và **mất sạch cùng `git worktree remove`**. Khi QA re-open sau vài tuần thì đây là thứ để đối chiếu executor đã (và chưa) test những gì.
7. **Fail** (scope sai hoặc build/test đỏ) → GIỮ NGUYÊN worktree (không xoá), đánh dấu index/board 🟠 CHANGES NEEDED, soạn prompt follow-up (thêm file `<slug>-followup.md` hoặc sửa đè, nhúng rõ lỗi/log) rồi lặp lại từ Bước 5 (Executor = Gemini).
8. Push lên origin / mở PR / tạo GitHub issue cho phần đã merge vẫn theo Quy tắc cứng chung của `/dispatch` (không tự động) — chỉ làm khi user yêu cầu riêng, không tự chạy tiếp ngay sau khi merge.

### Executor Sonnet 5 / Codex

1. `git status` + `git diff --stat` — xác nhận file đổi nằm trong scope. File lạ ngoài scope → báo user trước khi đi tiếp.
2. `pnpm build` (bắt buộc, kể cả Codex đã tự chạy — verify độc lập).
3. Test targeted theo vùng đổi (`pnpm test -- <pattern>` theo CLAUDE.md). Repo webapp-fe có ~65 test fail baseline: so **TÊN** test fail, chỉ tính regression khi xuất hiện tên mới.
4. Fail → báo rõ output, đề xuất resume phiên Codex kèm error log (route B/C) hoặc tự sửa (route A). KHÔNG lặng lẽ vá chồng.
4b. **GATE 0b — review độc lập bắt buộc**: nếu Bước 2b đánh dấu task đụng tiền/dữ liệu/permission/migration/production, sau khi build/test xanh vẫn phải có **agent thứ 2 review độc lập** trước khi coi là xong (doc §4.5). Cụ thể: executor Codex → Claude review diff (business rule, data integrity, permission); executor Sonnet 5 → đề xuất `codex review` hoặc Claude review. Ghi kết quả review vào báo cáo; chưa review xong thì báo "NOT_READY".
5. Nếu **task có US** (`US_EXISTS`/`US_NEEDED`) và thay đổi UI/UX hoặc user flow, đọc `.agent-rules.d/reports-export.md`, rồi lưu screenshot/video verification **trực tiếp vào folder chứa file US markdown** (nhánh `MICRO` → `Sprints/<active-week>/Ad-hoc Evidence/<slug>/`). Với `scripts/capture-evidence.mjs`, truyền `--us-file "<absolute-US-md>"`; nếu script không có trong Codex worktree do `.gitignore`, dùng `${REPO_ROOT}\scripts\capture-evidence.mjs`. Không dùng `%TEMP%`, scratchpad, `.gstack/` hoặc source repo làm nơi lưu cuối cùng.

## Bước 7 — Sync tracking (theo nhánh US Gate ở Bước 2c)

Điều kiện KHÔNG còn là "input là US file" mà là **nhánh gate**:

- `US_EXISTS` / `US_NEEDED` → sync US đầy đủ theo checklist dưới đây.
- `MICRO` → không có US để sync. Việc cần làm: cập nhật dòng ad-hoc trong `## 🔗 Ad-hoc PRs & Issues` từ `🟡 dispatching` → tick `- [x]` + giữ `(Xh)` thực tế (checkbox = Dev done, đã tự verify build/test ở Bước 6). Link PR/issue để trống cho `/create-pr-issues` điền sau. Evidence UI/flow lưu ở `Sprints/<active-week>/Ad-hoc Evidence/<slug>/`.

Mọi nhánh: chốt lại dòng cuối trong `## 🤖 Dispatch log` (hoặc dòng ad-hoc) sang trạng thái thật (✅ MERGED + commit hash / 🟠 CHANGES NEEDED / ⏸ chờ user commit+PR) — đừng để dòng cuối treo ở 🟡 ASSIGNED.

Executor = Gemini: SKIP ở lượt publish-prompt (chưa có gì để sync); chạy bình thường trong lượt Gemini báo xong SAU KHI đã verify + commit + merge xong ở Bước 6.

Theo `.agent-rules.d/obsidian-us-workflow.md` (đọc file này nếu chưa đọc):
- Tick `- [x]` các task đã xong + Evidence + section `### 💡 Giải thích thay đổi` (Why/How cho non-tech, tiếng Việt).
- Với UI/flow, thêm/cập nhật `## 📎 Evidence` và embed/link các file local nằm cạnh US markdown. GitHub `user-attachments` chỉ là bản upload; không được thay thế bản gốc trong folder US.
- Cập nhật `assignee` frontmatter đúng format, vd: `AI Agent (Codex, model: <codex-hard> (Extra High))` — map effort: xhigh→Extra High, high→High, medium→Medium, low→Low. Route A executor Sonnet 5 → `AI Agent (Claude Code, model: Sonnet 5)`; executor Codex → format Codex như trên (effort tương ứng); executor Gemini → `AI Agent (Gemini, model: <tự chọn trong harness riêng>)`, chỉ điền SAU khi Gemini báo xong + đã merge (không điền trước ở lượt publish-prompt). KHÔNG bao giờ ghi model main-loop làm executor code.
- 100% checkbox → frontmatter `status: done` + tick checkbox US trong file Sprint tuần (`Sprints/Week-XX.md`).

## Bước 8 — Báo cáo cuối

Bảng ngắn (Route A/B/C, executor Sonnet 5/Codex):

| Mục | Giá trị |
|---|---|
| Route | A/B/C + 1 dòng lý do |
| Model | model + effort (Route A: "Sonnet 5" hoặc Codex model+effort — không bao giờ model main-loop) |
| Branch | tên nhánh + base |
| Files | danh sách file đổi |
| Build/Test | kết quả + regression nếu có |
| Evidence | danh sách file local đã lưu trong folder US / lý do không thể chụp |
| US Gate | `US_EXISTS` (US-0XX sẵn có) / `US_NEEDED` (US-0XX vừa tạo + đã đăng ký sprint file) / `MICRO` (1 dòng ad-hoc, không tạo US) |
| Sync tracking | US đã tick gì + trạng thái cuối trong Dispatch log, hoặc dòng ad-hoc đã tick |
| Việc của bạn | commit + PR về `<base>` (workflow dừng ở đây theo thiết kế) |

Bảng rút gọn khi **executor = Gemini, lượt publish-prompt** (thay Bước 6-8 phía trên — chưa có gì để verify/sync):

| Mục | Giá trị |
|---|---|
| Route | A/B/C + 1 dòng lý do |
| Executor | Gemini (harness riêng — model do user tự chọn) |
| US Gate | `US_EXISTS` / `US_NEEDED` (US-0XX vừa tạo) / `MICRO` — kèm nơi đã ghi tracking |
| Worktree | path cục bộ đã tạo + branch + base — `.env.local` đã copy, `pnpm install` xong |
| Prompt file | đường dẫn file `.md` vừa lưu (`<folder US>/prompts/` nếu có US, epic docs nếu cấp epic, `Ad-hoc Evidence/<slug>/prompt.md` nếu micro) |
| Issue gốc | `#<issue_number>` hoặc "Không có — free text" (thông tin, KHÔNG nhúng rule tạo issue vào prompt Gemini nữa) |
| Việc của bạn | mở worktree path trong Antigravity, dán phần dưới `---` của prompt file vào Gemini; KHÔNG cần quay lại báo — Claude tự poll `_DONE.md` mỗi 30s (lệnh nền) và tự chuyển sang verify + commit + merge (Bước 6) khi phát hiện |

Bảng rút gọn khi **executor = Gemini, lượt Gemini báo xong** (sau khi Claude đã verify + commit + merge ở Bước 6):

| Mục | Giá trị |
|---|---|
| Route | A/B/C + 1 dòng lý do |
| Kết quả verify | scope đúng/sai, build/test kết quả, GATE 0b (nếu áp dụng) |
| Merge | ✅ MERGED (commit hash, đã merge vào branch nào) hoặc 🟠 CHANGES NEEDED (lý do + follow-up prompt) |
| Worktree | đã `git worktree remove` (nếu merge OK) hoặc còn giữ (nếu fail) |
| Index/Board | trạng thái đã cập nhật (nếu project có board) |
| US Gate | `US_EXISTS` (US-0XX sẵn có) / `US_NEEDED` (US-0XX vừa tạo + đã đăng ký sprint file) / `MICRO` (1 dòng ad-hoc, không tạo US) |
| Sync tracking | US đã tick gì + trạng thái cuối trong Dispatch log, hoặc dòng ad-hoc đã tick |
| Việc của bạn | push lên origin / mở PR / tạo issue khi bạn muốn — Claude không tự làm |

## Chống gián đoạn — cập nhật board liên tục (không chỉ ở checkpoint)

Phiên làm việc có thể dừng bất cứ lúc nào KHÔNG báo trước: hết quota/token, rớt mạng, crash, hoặc user chủ động đổi sang agent/model khác giữa chừng. Board Obsidian của project (vd `<epic>_agent-orchestration_*`: `Trạng thái hiện tại` + `TIMELINE` + `LIVE BOARD`) là nơi DUY NHẤT một phiên MỚI (Claude phiên khác, Codex, hay Gemini — không có ký ức hội thoại này) có thể đọc để tiếp tục ngay mà không cần hỏi lại từ đầu.

**Khi nào ghi — đừng chờ "xong việc" mới ghi 1 lần cuối:**
- Ngay sau khi tạo branch/worktree cho 1 task (trước khi giao executor).
- Ngay sau khi giao task cho executor (🟡 ASSIGNED) — dù Codex đang chạy nền hay vừa in prompt Gemini xong.
- Ngay sau MỖI lần verify + merge (✅/🟠) — không gộp nhiều task rồi ghi 1 lần cuối buổi.
- Trước khi bắt đầu 1 bước có thể chạy LÂU (Codex effort cao, chờ Gemini/user) — ghi rõ "đang chờ X" + cách resume nếu bị ngắt giữa chừng.
- Ngay khi phát hiện gotcha/bug/quyết định đáng giá cho phiên sau — đừng để dành đến cuối task mới ghi, phiên có thể dừng trước khi tới lúc đó.

**Ghi tối thiểu những gì** (để phiên mới đọc xong tiếp tục được ngay, không cần hỏi user lại):
- Worktree/path + branch đang dùng CHO TASK NÀY — path tuyệt đối nếu có nhiều worktree song song, đừng chỉ ghi tên nhánh (dễ nhầm khi có ≥2 worktree cùng repo).
- PR/branch đang mở trỏ base nào, đã merge tới đâu, còn gì local chưa push origin.
- Task nào đang 🟡/🔵 (ai giữ, giao lúc nào, bước tiếp theo cụ thể) — KHÔNG được để trống mục "Việc tiếp" nếu có task đang treo dở; nếu không có gì treo, ghi rõ ràng "không có task nào đang giao dở" (im lặng = tình trạng không rõ ràng cho phiên sau).
- Cách resume nếu là Codex (`codex exec resume <SESSION_ID>` + effort đã dùng) hoặc Gemini (worktree path, tên prompt file, đã thấy `_DONE.md` chưa).

Nếu project không có board riêng dạng agent-orchestration (task ngoài epic, US đơn lẻ) → nơi hạ cánh là **`## 🤖 Dispatch log` trong US** (Bước 3.8), hoặc **dòng ad-hoc trong sprint file** nếu nhánh gate là `MICRO`. KHÔNG coi `_DONE.md` là nơi lưu bền vững: nó untracked trong worktree và mất cùng `git worktree remove` — muốn giữ thì copy về folder US (Bước 6.6).

## Quy tắc cứng

- **US Gate (Bước 2c) chạy trên MỌI input, không chỉ US file.** `US = spec-IN`: tạo TRƯỚC khi giao executor, vì US là văn bản nhúng vào prompt Codex/Gemini. KHÔNG retro-tạo US để lưu vết (lưu vết = issue body + dòng ad-hoc sprint file); ngoại lệ duy nhất là escalation ở Bước 6 khi gate đã chấm sai.
- **Tier gate là của `.agent-rules.d/task-sizing.md`** — `/dispatch` chỉ gọi tới, KHÔNG copy tiêu chí vào SKILL.md (copy = hai nguồn lệch nhau). Gate agent tự quyết, không hỏi user; chỉ nội dung US draft mới cần duyệt và duyệt tại cổng Route C.
- **`US_NEEDED` + input không phải US → ép lên Route C** để tái dùng cổng duyệt sẵn có, giữ nguyên quy tắc "chỉ MỘT lượt AskUserQuestion ở route A/B". `US_EXISTS` KHÔNG đổi route.
- **Cấp US id theo reserve-then-fill**: quét max id toàn vault → **ghi file stub ngay** rồi mới làm việc khác. Nhiều stream song song mà chỉ đọc id rồi ghi sau sẽ cấp trùng id.
- **Kiểm tra sprint active TRƯỚC khi tạo branch/worktree** (Bước 2c.4a) — fail sớm, đừng fail sau khi đã `pnpm install`.
- **Folder US: name TRÙNG file basename** (`US-0XX-<slug>/US-0XX-<slug>.md`); ghi file là tạo folder (vault là thư mục thường, không cần `mkdir`, không có bước reindex). **Folder thuộc tuần TẠO RA nó** — carry-over chỉ wikilink, KHÔNG di chuyển/copy folder.
- **Cập nhật board Obsidian LIÊN TỤC, không chỉ ở checkpoint cuối** — xem §"Chống gián đoạn" ngay phía trên. Lý do: phiên có thể dừng bất cứ lúc nào (hết quota/token, rớt mạng, đổi agent giữa chừng) không báo trước; board phải luôn đủ để phiên mới tiếp tục mà không cần hỏi lại.
- KHÔNG commit, KHÔNG push code, KHÔNG tạo PR — kể cả khi user quên. Nhắc user tự làm hoặc yêu cầu riêng. **Ngoại lệ DUY NHẤT**: executor = Gemini → sau khi Claude tự verify `_DONE.md` + diff + build/test xanh (Bước 6), Claude được commit + merge **CỤC BỘ** (vào branch tích hợp hiện tại, KHÔNG push lên origin) — đây là quy ước riêng cho luồng worktree-cách-ly Gemini, không áp dụng cho Sonnet 5/Codex. Push lên origin / mở PR / tạo issue vẫn luôn hỏi user riêng, không tự động dù executor nào.
- KHÔNG dispatch Codex khi chưa tạo/chọn xong branch.
- **Build xanh KHÔNG phải bằng chứng type đúng, và test xanh KHÔNG phải bằng chứng shape đúng.** Ca kiểm chứng: executor báo "builds successfully", tick cả task "typecheck no new error", **18/18 test pass** — nhưng `tsc --noEmit` có **12 lỗi mới** vì component tham chiếu **tên field không tồn tại**. Hai lý do nó lọt, phải hiểu cả hai: (1) build dùng bundler nên **strip type mà không check**; (2) **test cũng xanh vì mock của chính executor dùng đúng shape bịa ra** — test đang *mã hoá cái bug* thay vì bắt nó. Khi reject phải yêu cầu sửa **cả test mock**, không chỉ component.
  Bắt buộc trong MỌI prompt executor: (a) nói thẳng "build xanh không phải bằng chứng type đúng, chỉ `tsc --noEmit` mới là"; (b) yêu cầu executor **in ra CON SỐ tổng lỗi typecheck** trước/sau + xác nhận 0 lỗi thuộc file của mình — không nhận câu "typecheck passed" suông; (c) cho biết **baseline số lỗi có sẵn** của repo để so, vì repo thật thường có lỗi type tồn đọng.
  Ở Bước 6 bên điều phối luôn tự chạy typecheck và **grep theo đường dẫn file trong diff** — đây là check bắt lỗi nhiều nhất trong thực tế, không được bỏ dù executor đã báo pass.
- **Bịa là đầu ra hợp lý của protocol, không phải tính cách của một model cụ thể.** Cùng một `_DONE.md`, khi prompt chỉ đòi **phán quyết bằng văn xuôi** ("build xanh", "PASS") thì executor bịa; khi prompt đòi **con số + baseline + câu "bên điều phối re-run tất cả"** thì nó khai đúng. Kiểm chứng trong CÙNG một task, cùng model: lượt 1 (đòi văn xuôi) bịa 6 nhóm field; lượt 2 (đòi con số, có baseline) khai đúng từng số, chạy lại khớp hết. Executor khác cũng bịa y hệt khi được hỏi kiểu đó (báo "no files outside the task surface changed" trong khi đã tạo một script throwaway ở repo root **có hardcode credential**). Vì vậy: **đừng sửa bằng cách dặn executor "đừng bịa" — sửa bằng cách làm cho câu khai có thể sai được (falsifiable).** Mọi ô trong `_DONE.md` phải là output máy dán vào mà bên điều phối re-run được.
- **Verify EVIDENCE, không chỉ code** — hash ảnh (trùng byte = bịa), AC hành vi mà evidence là "static code review" thì là BLOCKED chứ không PASS, `git status` trước khi tin ảnh (ảnh trên build đã patch = vô giá trị), câu tổng quát tự khen phải tự kiểm bằng `diff`/`grep`. Chi tiết ở Bước 6 §"Verify BẰNG CHỨNG". Lý do cần ghi thành rule: Bước 6 trước đây chỉ kiểm code, nên báo cáo bịa *bằng chứng* đi qua sạch.
- **Phân vai bằng agent definition, không bằng lời dặn trong prompt** (xem `agents/`). Frontmatter cho 3 thứ prompt không làm được: `tools` là allowlist **deny-by-omission** (cổng cứng), `effort` chỉ đặt được ở frontmatter, `model` dùng alias nên không phải sửa file khi lên generation mới. Vai kiểm/review/plan **không có tool ghi** — người kiểm mà sửa được code thì sẽ vá cho xanh. Ca kiểm chứng: prompt cấm rõ sửa file source, cho phép nói BLOCKED, executor vẫn sửa 7 file để 32/32 AC thành PASS. Đổi model/effort = sửa frontmatter, **KHÔNG truyền model ở call site**.
- **Executor phải có đường phản hồi về rule, và đường đó đi qua bên điều phối** vì executor không với tới được thư mục rule dùng chung (nó ở repo khác, và prompt executor thường cấm đọc thư mục config của agent). Mọi prompt executor bắt buộc có mục `## Đề xuất đổi rule` (ghi `Không có` nếu không có); Bước 6 relay theo 3 điều kiện: nguyên văn · tách phần verify của bên điều phối · không đồng ý vẫn phải ghi lại `status: rejected`. Điều kiện 3 vì rule bị phê bình phần lớn do bên điều phối viết — không được vừa là cổng vào vừa là quan toà.
- **File agent tự viết trả lời "vì sao nó làm vậy", không trả lời "nó có đúng không".** Áp cho `_DONE.md`, memory/brain riêng của agent, và cả đề xuất đổi rule: dùng làm **giả thuyết** root cause (nó tưởng shape dữ liệu là gì, đọc rule nào) — không bao giờ làm **phán quyết**.
- **Rule bắt được lỗi phải nằm trong file dùng chung, không nằm trong memory riêng của một agent.** Ca kiểm chứng: một báo cáo bịa lọt qua toàn bộ quy trình verify thành văn lúc đó (diff + scope + build + test đều xanh); thứ bắt được nó là memory riêng của một phiên, viết từ vụ trước đó. Agent khác chạy đúng protocol sẽ **merge code bịa**. Mỗi lần phát hiện một lớp bịa mới: hạ cánh vào file rule dùng chung **ngay trong lượt đó**.
- **Chọn executor theo năng lực (Bước 2b), không tùy tiện**: GATE 0 loại Gemini khỏi shared-layer (auth/httpClient/queryKeys/AuthProvider) và task AC mơ hồ; task đa phương tiện/batch/visual-QA ưu tiên Gemini; refactor-consistency-chặt/migration ưu tiên Codex. Quota bias (nghiêng Gemini) CHỈ áp ở ô "Route B/C spec rõ, code thuần, không shared-layer".
- **GATE 0b**: tiền/dữ liệu/permission/migration/production → bắt buộc agent-2 review độc lập trước khi coi là xong (Bước 6.4b), dù executor là ai.
- Chỉ MỘT lượt AskUserQuestion ở route A/B. Route B: 1-2 questions trong CÙNG lượt (base, + executor Codex/Gemini). Route A: 2 questions trong CÙNG một lượt gọi (base + executor Sonnet 5/Codex/Gemini). Route C thêm đúng MỘT cổng duyệt plan (gồm cả chọn executor Codex/Gemini).
- Route A KHÔNG bao giờ code bằng model main-loop — chỉ Sonnet 5 (subagent), Codex, hoặc Gemini (harness riêng). Quy tắc gắn với **vai trò main-loop**, không gắn tên model: main-loop hiện tại là Opus 5 (trước đây ghi cứng "Fable 5"); tên đổi thì sửa mô tả, đừng sửa quy tắc.
- Executor = Gemini: KHÔNG tự gọi `gemini exec` qua Bash (khác Codex) — Gemini chạy trong harness riêng do user tự điều khiển. Vai trò của `/dispatch` là: tạo worktree cách ly cục bộ (`.env.local` + `pnpm install` sẵn) + soạn prompt file lưu vào `gemini-task-prompts/<slug>.md` trong vault (không in thẳng ra chat như route khác) + dừng lại; sau đó verify `_DONE.md` + commit + merge cục bộ khi Gemini báo xong.
- **Gemini tuyệt đối KHÔNG commit/push/merge/mở PR/tạo issue/ghi vào vault** — chỉ code trong scope + ghi `_DONE.md`. Claude là bên DUY NHẤT merge + cập nhật vault/board (theo `<epic>_gemini-delegation-convention_260722`).
- **Cụm file không được đụng nhau khi chạy song song**: 2 executor (Codex/Gemini/Sonnet) không bao giờ sửa cùng 1 file cùng lúc — mỗi stream = 1 branch/worktree + 1 cụm file rời nhau, liệt kê file cấm ("Do NOT touch") trong prompt.
- **Migration**: agent (Gemini/Codex) chỉ được VIẾT file migration, KHÔNG tự apply (apply qua CLI interactive hoặc SQL Editor — việc riêng của user/Claude).
- **`_DONE.md` chứa secret** (token/api_secret/password) → Claude xoá file ngay sau khi đọc, cảnh báo user rotate; không giữ lại trong worktree.
- **Tự động phát hiện Gemini xong**: ngay sau khi in prompt cho Gemini, chạy lệnh Bash NỀN (`run_in_background: true`) poll `_DONE.md` mỗi 30s (`until [ -f "<worktree>/_DONE.md" ]; do sleep 30; done`) thay vì chờ user tự quay lại báo. Nhiều worktree song song → mỗi worktree 1 lệnh poll riêng. Không dùng sleep-loop chặn foreground.
- Windows: gh CLI luôn `--body-file` nếu cần ghi body dài (không `--body` inline) — áp dụng khi Claude tự soạn PR/issue (không còn áp dụng cho prompt Gemini vì Gemini không tự tạo PR/issue nữa).
