# Obsidian Sprint & User Story Workflow Rule

> ⚠️ File này chỉ áp dụng cho **profile VAULT** (repo có cấu hình thư mục tài liệu ngoài repo — xem `dispatch/SKILL.md` Bước 0.5). Repo không có vault thì bỏ qua toàn bộ file này: spec sống trong `docs/` của repo hoặc trong issue body.

> **Trước khi tạo US**: chạy **Task Tier Gate** trong `.agent-rules.d/task-sizing.md`. Micro task (< 2h, không đổi business logic) KHÔNG tạo US/folder — chỉ ghi 1 dòng vào section `## 🔗 Ad-hoc PRs & Issues` của sprint file active theo format trong `task-sizing.md`. Khi closeout, micro task đã hoàn thành Dev chỉ được tính giờ trong sprint nơi Dev thực hiện. Nếu QA/review còn mở, sprint mới chỉ theo dõi bằng bullet thường trong `## 🧪 QA Follow-up từ Week-XX (không tính giờ)`, không dùng checkbox và không ghi `(Xh)`.

> **US là spec-IN, không phải record-OUT** (áp dụng cho MỌI agent: Claude, Codex, Gemini/Antigravity). US phải được viết **TRƯỚC** khi bắt đầu code, vì nó là văn bản được nhúng nguyên văn vào prompt giao cho executor — executor không đọc được vault lẫn hội thoại của phiên khác. **KHÔNG retro-tạo US chỉ để lưu vết** công việc đã làm: lưu vết là việc của GitHub issue body + dòng ad-hoc trong sprint file. Ngoại lệ duy nhất được tạo US hồi tố: tier gate chấm "micro" nhưng scope phình thật (≥3 file / chạm shared layer / phát sinh câu hỏi BE) — xem "Escalation" trong `task-sizing.md`.

> **Agent đang thực thi US phải ghi `## 🤖 Dispatch log` trong file US** — bảng `Khi | Executor | Model/Effort | Branch (base) | Worktree | Trạng thái`, worktree ghi **path tuyệt đối**. Ghi NGAY khi tạo branch/worktree (đồng thời set `status: in-progress` + `assignee`), rồi cập nhật ở mỗi mốc: giao executor → verify → merge. Lý do: phiên agent có thể dừng bất cứ lúc nào (hết quota, rớt mạng, user đổi agent) và đây là nơi DUY NHẤT một phiên MỚI đọc được để tiếp tục. Không dùng `_DONE.md` trong worktree làm nơi lưu bền vững — nó untracked và mất cùng `git worktree remove`; muốn giữ thì copy về folder US thành `_DONE-<slug>.md` trước khi xoá worktree.

When an Agent needs to create, edit, or checklist tasks/TODOs:

1. **Detect Current Sprint**: Scan files in the Obsidian vault `${VAULT_ROOT}\Sprints\` folder. Find the file containing `status: in-progress` in its frontmatter. Extract the week/sprint number from the filename (e.g., `Week-02` -> `Week-02`).
2. **Verify API Specifications**: When creating a User Story in Obsidian, the Agent **MUST** check the documentation and specs in the `API/` folder at the repository root (e.g., under `API/jun 2026/` or `API/update/`) to ensure the user story always aligns with the correct and latest API version.
3. **Locate User Stories**: All User Stories for the active week must be stored in the directory
   `${VAULT_ROOT}\Sprints\<week-name>\<US-name>\`, where **the folder name is identical to the markdown basename**:
   `Sprints/Week-09/US-095-staff-self-unlink/US-095-staff-self-unlink.md`.
   - Slug: kebab-case English, ≤5 words; reuse the work-branch slug when the US is created by `/dispatch`.
   - The vault is a plain filesystem folder — **writing the file creates the folder** (no `mkdir`, no reindex step). `mkdir -p` is only needed when a folder must exist before an external writer fills it (e.g. `capture-evidence.mjs` emitting PNGs into `Ad-hoc Evidence/<slug>/`).
   - `US-009/US-009-name.md` (folder = id only) is the legacy Week-02 shape. Do not create new folders that way.
   - **A US folder belongs to the week it was CREATED in.** On carry-over the new sprint only wikilinks to it — never move or copy the folder (see `.agent-rules.d/carry-over.md`).
   - US ids are unique vault-wide. Allocate with reserve-then-fill: scan the max existing id across **all** week folders, then write the stub file immediately so parallel agent streams cannot claim the same id.
   - **Creating the folder is NOT tracking.** Register the new US as a checkbox in the active sprint file, section `## 📋 Chi tiết mục tiêu (Epic Detail)`, using the wikilink style already in use (path is relative to `Sprints/`):
     `- [ ] **US-0XX ([[Week-NN/US-0XX-<slug>/US-0XX-<slug>|US-0XX]]):** <short title> (**Xh**).`
     Carried-over rows keep the original week in the link and add `*(carried over from Week-XX)*`.
4. **User Story Properties (Frontmatter)**:
   - Each User Story file must contain frontmatter properties: `type: user-story`, `us_id`, `title`, `sprint`, `status`, `priority`, `created`, `author`, and `assignee`.
   - **Author**: The creator/writer of the User Story. If a person, use their Git username (e.g. `dev-owner` — the active GitHub account & repo collaborator). If created by an AI Agent, specify the agent name and the exact model using the format: `AI Agent (<agent-name>, model: <model-name> (<model-variant>))`.
   - **Assignee**: The person or agent implementing the User Story. If a person, use their Git username (e.g. `dev-owner`). If assigned to an AI Agent, specify the agent name and exact model in the same format. NOTE: `legacy-account` is NOT a collaborator on `acme/webapp-fe` — GitHub silently drops it as an assignee; use `dev-owner`.
   - **AI Agent Model Format**:
     - `model-name` must be the exact active model family/name, not a generic or shortened label.
     - `model-variant` must be the exact active variant/configuration shown by the tool, such as `Extra High`.
     - Current Codex example: `author: "AI Agent (Codex, model: <codex-alt> (Extra High))"` and `assignee: "AI Agent (Codex, model: <codex-alt> (Extra High))"`.
     - Antigravity example: `author: "AI Agent (Antigravity, model: Gemini 3.5 Flash (intelligent))"`.
     - Do not use vague labels such as `GPT-5` when the exact model/configuration is known.
   - **Content Structure (Body)**: The markdown body MUST strictly follow this standard Agile structure:
     1. `## 👤 User Story` (Format: "Là một [đối tượng], tôi muốn [hành động] để [lợi ích]").
     2. `## 🎯 Goal` (Core business/user objective).
     3. `## ✅ Acceptance Criteria (AC)` (Checklist of specific completion conditions).
     4. `## 📋 Tasks / TODOs` (The breakdown of tasks to implement).
     5. `## 🤖 Dispatch log` (required as soon as an AI agent starts executing — see the Dispatch log note at the top of this file).
     6. `## 📎 Evidence` + `### 💡 Giải thích thay đổi` (added when tasks get checked — see item 5 below).
     - Starting point: copy `${VAULT_ROOT}\Templates\User_Story_Template.md` (kept in sync with this rule; it also carries the optional API Mapping / FE Surface / Grill Checklist sections) and replace its `US-XXX` / `Week-XX` placeholders.
   - **GitHub Syncing**: When creating or pushing a User Story to a GitHub Issue (e.g., using `gh issue create`), the Agent **MUST** strip the YAML frontmatter (`---` block) from the ticket body before pushing to prevent messy rendering on GitHub.
5. **Task Completion Checklist & Evidence**:
   - Each User Story file must contain a `## 📋 Tasks / TODOs` section with checkbox items (e.g. `- [ ] Task name`).
   - When an Agent completes a task and marks it as completed (`- [x]`), it **MUST** append or attach clear **Evidence** in the User Story file and link it:
     a. **For UI/UX or Flow changes (including E2E / browser live tests)**: Save screenshots/video (`.png`, `.jpg`, `.mp4`, `.webm`) directly in the same folder as the US markdown, then reference them under `## 📎 Evidence`. GitHub `user-attachments` does not replace the local original. Follow `.agent-rules.d/reports-export.md` for naming and the exact folder structure.
     b. **Non-tech Explanation**: Provide a detailed explanation in a dedicated section (e.g., `### 💡 Giải thích thay đổi`) answering:
        - **Tại sao lại thay đổi? (Why)**: Lý do thực hiện thay đổi là gì (lỗi gì cần sửa, tính năng mới mang lại lợi ích gì cho người dùng).
        - **Thay đổi như thế nào? (How)**: Mô tả cách hệ thống hoạt động sau thay đổi bằng ngôn ngữ đơn giản, dễ hiểu nhất cho người non-tech (tránh từ ngữ quá kỹ thuật).
   - **Cross-File Auto-Sync**: Once all tasks in the US file are checked (`- [x]`) — whether checked by the Agent or manually by the User — the Agent must immediately and automatically ensure:
     a. The US file frontmatter is updated to `status: done`.
     b. The corresponding checkbox for this US in the active Sprint tracking file (e.g., `Sprints/Week-05.md`) is checked (e.g., change `- [ ] **US-10**:` to `- [x] **US-10**:`).
     c. *Verification*: The Agent must aggressively scan for this state whenever invoked. If it notices a US has all tasks checked but the Sprint file still shows it as incomplete, the Agent must proactively sync and fix it.
6. **Sprint Closeout**:
   - When all US checkboxes in the active Sprint file are checked (`- [x]`), the Agent must:
     a. Update the Sprint file frontmatter to `status: completed`.
     b. Send a final notification to the Telegram Thread <qa-thread-id> reporting the successful completion of the sprint, along with test summaries.
7. **Demo & Feedback Section**:
   - At the end of a sprint or after a demo session, a demo scenario and feedback note should be created in the sprint folder (e.g., `Sprints/Week-03/Kịch bản demo và feedback <Date>.md`).
   - The active Sprint file (e.g., `Sprints/Week-03.md`) must be updated to include a `## 💬 Demo & Feedback` section that links to and embeds the feedback note (e.g., `![[Week-XX/Kịch bản demo và feedback <Date>]]`).
8. **Single Active Sprint & Sprint Transition (drives the Dashboard "Current Sprint Goal")**:
   - The Dashboard "Current Sprint Goal" panel (`00_Dashboard/000_Dashboard.md`) is a Dataview query filtering `type = "sprint" AND status = "in-progress"`. Therefore **exactly ONE sprint file may have `status: in-progress` at any time.**
   - **Sprint status lifecycle:** `planning` → `in-progress` → `completed`. Only `in-progress` appears on the Dashboard.
   - **When creating or starting the next week's sprint (e.g. adding `Week-04.md` while `Week-03` is active), the Agent MUST atomically transition statuses in the same change:**
     a. Set the **previous** in-progress sprint → `status: completed` (set its `end_date` if missing).
     b. Set the **new** sprint → `status: in-progress` (not `planning` — `planning` is for a sprint that is drafted but not yet started).
     c. **Carry over** any unchecked US from the previous sprint into the new sprint's epic list with a `(carried over from Week-XX)` note, so incomplete work is not lost when the old sprint is closed. Follow `.agent-rules.d/carry-over.md` for the full carry-over procedure.
   - **Verification:** after the transition, the Dashboard query must return exactly one row, and it must be the new sprint. Before finishing, confirm no two sprint files share `status: in-progress`.
9. **Sprint Auto-Sync Boilerplate**:
   - Whenever creating a NEW Sprint file (e.g., `Sprints/Week-07.md`), the Agent MUST insert the standard DataviewJS Auto-Sync script at the very top of the file (right below the frontmatter), so it auto-loads immediately when the user accesses the page.
   - This script ensures 100% automated two-way sync between US checkboxes and the Sprint file when the user views the Sprint file.
   - **The script lives in the vault template** — copy its content verbatim (the `### ⚙️ Auto-Sync Script (Do not edit)` heading and the ```dataviewjs block) from:
     `${VAULT_ROOT}\Templates\sprint-autosync-script.md`
   - Do NOT rewrite or "improve" the script; copy it as-is.
