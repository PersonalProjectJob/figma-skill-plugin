# GitHub Issue Creation Rule (Team Agile)

When the user asks to create a GitHub issue (bug, feature request, change request, testing task), the Agent MUST follow this flow:

1. **Agile Traceability (đúng flow Team Agile)**:
   - Every issue MUST trace back to its origin: a User Story (`US-XXX`) in the active Sprint, a PR, or a QA/test finding. Include the reference in the issue body footer (`Refs US-XXX` / `Refs #<PR>`).
   - Issues created from a PR's tasks MUST use the `/create-pr-issues` skill (`${SKILLS_DIR}\create-pr-issues\SKILL.md`) — it owns the project-board mechanics: Project Acme App (#<project-number>) constants, field IDs (Status, Item Type, Week, Effort, Due Date), current-week iteration query, batch GraphQL mutations, and assignee rules.
   - **Existing origin issue = parent (2026-07-14)**: if the work already traces to an existing GitHub issue (user supplied the issue URL — e.g. via `/dispatch <issue-url>`; PR body says `Closes/Fixes/Resolves/Refs #N`; or the US frontmatter has `github_issue`/`backlog_issue`), do NOT create a new parent issue. Connect child issues directly to that existing issue via the sub-issues API, ensure it is on the board (Status → Testing when code is done awaiting QA; keep its existing Item Type; assign `qa-owner` + `dev-owner`; no Effort), and comment the child list + `Refs #<PR>` on it instead of rewriting its body. Only when NO origin issue exists does the agent create a new parent (Backlog/Task) per `/create-pr-issues`.
   - Standalone issues (not from a PR) reuse the SAME mechanics from `/create-pr-issues`: create with `gh issue create --body-file` (NEVER inline `--body` on Windows), add to the project board, set all 5 fields, assign by Item Type — **Backlog & Task → both `qa-owner` + `dev-owner`** (QA-QC verify), **Dev Task & others → `dev-owner` only** (NOT `legacy-account` — GitHub silently drops non-collaborators), and verify with `gh issue view <N> --json assignees`.
   - **Micro tasks** (per the Task Tier Gate in `.agent-rules.d/task-sizing.md`) have NO US — the issue body written with the template below IS the mini-spec, so the fields `Hiện tại`, `Ảnh hưởng`, and `Mong muốn` must be complete enough for a member to understand the change without extra context. Trace with `Refs #<PR>`.

2. **Refinement Gate (trước khi viết issue)**:
   - If the problem or requirement is vague, underspecified, or still an idea ("nên làm gì đó với X"), the Agent MUST first refine it with the gstack `/office-hours` skill (brainstorm/forcing-questions) — do NOT draft an issue from a fuzzy idea. `/grill-me` remains the gate for implementation-plan decisions; `/office-hours` is the gate for shaping the issue itself.
   - The refined outcome (screen context + current problem + impact + expected outcome) feeds directly into the template below.

3. **Issue Body Template (MANDATORY — member scan nhanh, non-tech đọc được)**:
   - **Write for a stranger**: the issue may be assigned to someone with ZERO context from the original conversation. The body must be self-contained and understandable without asking the author anything — no internal shorthand, no "như đã bàn", no linking to a chat. If the assignee would have to ask "cụ thể là gì?", the body is not done.
   - **Member-first wording**: write the title and body in plain Vietnamese for this repo. Describe the visible problem and outcome; do not expose file paths, component names, props, code symbols, or implementation jargon in the issue body.
   - **`Màn hình` field — TRA CỨU, KHÔNG ĐOÁN**: map changed code/requirement to the member-facing screen name via `.agent-rules.d/screen-registry.md` (route → tên màn hình → screen-slug). If the screen is missing from the registry, add the row (correct format, name matching the UI label in `src/locales/vi.json`) as part of the same task.
   - **UI changes**: name the exact screen/route, tab/area/element, and viewport. For a visual/layout issue, include a current-state screenshot; include an expected screenshot/mockup when one exists. Vague phrasing like "chỉnh lại UI cho đẹp" is NOT acceptable.
   - **Non-UI changes**: use `Màn hình` for the affected user journey/system surface, `Vị trí` for the affected step/rule, and `Thiết bị: Tất cả` when viewport does not matter (dùng đúng chữ `Tất cả` tiếng Việt, không dùng `All`).
   - **No duplicate sections**: do not repeat `Hiện tại` in a separate problem section or repeat `Mong muốn` in a requirement/result section.
   - **Do not add** `Cách kiểm tra`, `Acceptance Criteria`, `Test Scope`, `Changes`, or developer/technical-note sections to the GitHub issue.
   - **Title**: use a clear member-facing outcome phrase. Do not use prefixes like `[Bug]`/`[Testing]`; labels and Item Type carry that meaning.
   - Body MUST follow exactly this structure (strip any YAML frontmatter if content comes from an Obsidian US file):

     ```markdown
     - **Màn hình:** <tên màn hình hoặc user journey>
     - **Vị trí:** <tab/khu vực/element hoặc bước trong flow>
     - **Thiết bị:** <Desktop / Mobile / Tất cả>
     - **Hiện tại:** <vấn đề đang xảy ra>
     - **Ảnh hưởng:** <member bị ảnh hưởng như thế nào>
     - **Mong muốn:** <kết quả sau khi sửa>

     ## 🖼 Minh họa

     ### Hiện tại
     <screenshot hoặc `Chưa có ảnh` nếu thay đổi không trực quan>

     ### Mong muốn
     <screenshot/mockup nếu có, nếu không ghi `Không có`>

     Refs US-XXX / Refs #<PR>
     ```
   - **5-second scan gate**: before creation, confirm the first six lines alone tell a member where the issue is, what is happening, who is affected, and what outcome is expected.

3b. **Cách viết `Hiện tại` / `Mong muốn` (2026-07-27) — trực quan, đi thẳng vào thay đổi cần làm**:
   - Hai field này là phần member đọc kỹ nhất. Viết theo **thứ nhìn thấy được trên màn hình**, không viết trừu tượng.
   - **`Hiện tại`** phải nêu đủ 3 mảnh: **ở đâu** (tab/khu vực/loại bản ghi) + **member làm gì** + **màn hình phản hồi ra sao** (chữ gì hiện lên, nút nào bật/tắt, lỗi màu gì). Trích đúng nguyên văn chữ đang hiển thị trên UI khi có.
   - **`Mong muốn`** phải mô tả **thay đổi nhìn thấy được**: phần tử nào đổi thành gì, trạng thái nào hiện/ẩn/khoá, chữ hiển thị mới là gì. Không dừng ở "không còn lỗi" / "hoạt động đúng" — đó không phải output dùng được.
   - **Vẫn giữ nguyên lệnh cấm kỹ thuật**: không tên file, component, props, hook, endpoint, tên biến, tên trạng thái trong code. "Đi thẳng vào cách cần sửa" nghĩa là cụ thể ở tầng **giao diện**, không phải tầng code. Không thêm technical note.

   Ví dụ đạt chuẩn:

   ```markdown
   - **Hiện tại:** Ở tab "Đơn hàng", MỌI đơn đều hiện nút "Xác nhận đã nhận hàng". Bấm vào đơn khách chưa thanh toán thì hiện báo lỗi đỏ "Không thể xác nhận".
   - **Ảnh hưởng:** Member tưởng thao tác hỏng, bấm lại nhiều lần rồi nhắn hỏi support.
   - **Mong muốn:** Chỉ đơn khách ĐÃ thanh toán mới hiện nút "Xác nhận đã nhận hàng". Đơn chưa thanh toán hiển thị chữ xám "Chờ khách thanh toán", không bấm được.
   ```

   Cùng vấn đề đó viết KHÔNG đạt (mơ hồ, member không biết phải làm gì):

   ```markdown
   - **Hiện tại:** Member bấm xác nhận nhưng giao dịch không được ghi nhận.
   - **Mong muốn:** Member không còn gặp lỗi khi xác nhận đơn.
   ```

   | Viết hỏng | Sửa thành |
   |---|---|
   | "Nút bị lỗi" | "Bấm nút X hiện báo lỗi đỏ '<nguyên văn>'" |
   | "Hiển thị sai" | "Cột <tên cột> đang hiện <giá trị sai>, phải hiện <giá trị đúng>" |
   | "Cải thiện UX màn hình này" | "Gộp 2 nút <A>/<B> thành 1 dropdown <tên>" |
   | "Xử lý đúng trạng thái" | "Trạng thái <tên hiển thị> thì khoá nút, hiện chữ xám '<nội dung>'" |

## PR Body Template (bắt buộc mọi lần gh pr create)

Mọi lần tạo/sửa Pull Request (`gh pr create`/`gh pr edit`) trong repo `webapp-fe` đều BẮT BUỘC tuân thủ cấu trúc `Summary / Evidence / Testing` tiếng Việt (KHÔNG dùng template kỹ thuật mặc định tiếng Anh `Summary / Changes / Test plan`):

```markdown
## Summary

**Branch:** `<branch-name>`
**Feedback:** <link issue feedback gốc, vd acme/webapp#N> (bỏ dòng này nếu không có)
**Issue:** <link issue gốc đã tồn tại trước PR> (bỏ dòng này nếu chưa có issue)

<2-4 câu mô tả vấn đề + thay đổi, tiếng Việt, dễ hiểu cho người không đọc code>

## Evidence

| Mục | Trước | Sau |
|-----|-------|-----|
| <hạng mục 1> | <ảnh/link hoặc `Chưa có ảnh — <lý do>`> | <ảnh/link hoặc `Chưa có ảnh — <lý do>`> |

## Testing

- <build/test đã chạy + kết quả, vd `pnpm build` pass>
- <phần CHƯA verify được + lý do cụ thể (thiếu credentials, thiếu môi trường, route bị gate...)> — KHÔNG được im lặng bỏ qua mục này

Refs #<issue liên quan>
Closes #<issue mà PR này đóng, nếu có>
```

**Quy tắc bắt buộc:**
- PR Evidence table rỗng hoặc ghi 'Chưa có ảnh' KHÔNG được coi là Evidence Discovery đã chạy — bất kỳ GitHub issue nào tạo sau từ PR này vẫn PHẢI tự chạy lại độc lập toàn bộ 4 bước Evidence Discovery, không được kế thừa trạng thái rỗng từ PR.
- **Evidence**: áp dụng đúng Evidence Discovery bên dưới — không bốc đại, không bỏ qua nếu ảnh có thể chụp được. Nếu không chụp được, ghi rõ lý do thay vì để trống.
- **Testing**: PHẢI nêu rõ nếu agent CHƯA tự verify UI thật (thiếu tài khoản, thiếu môi trường, không truy cập được route).

4. **Evidence Discovery (BẮT BUỘC trước khi viết `## 🖼 Minh họa` — không được bốc đại ảnh)**:
   - **Ảnh `Hiện tại` — thứ tự tìm, dừng ở bước đầu tiên có kết quả**:
     1. Thư mục US trong Obsidian (`Sprints/<week>/<US>/`): match theo `<screen-slug>` trong tên file (naming convention ở `reports-export.md`) hoặc ảnh được reference trong walkthrough/report của US.
     2. `docs/issue-assets/` có sẵn trong repo: match theo `<screen-slug>`.
     3. **Tự chụp** bằng `scripts/capture-evidence.mjs` (repo webapp-fe): nếu script không có trong Codex worktree do `.gitignore`, dùng bản `${REPO_ROOT}\scripts\capture-evidence.mjs`. Với issue tạo từ PR, `Hiện tại` = trạng thái TRƯỚC PR (chạy base branch qua `git worktree` hoặc chụp môi trường test đang chạy code cũ); với ticket standalone, `Hiện tại` = code hiện tại. Full US dùng `--us-file <absolute-US-md>` để script lưu thẳng cạnh file US; micro task dùng `--out <active-week>\Ad-hoc Evidence\<issue-slug>`. Lưu file theo naming convention.
     4. Cả 3 bước bất khả thi (thiếu test account, màn hình cần dữ liệu không seed được...) → ghi `Chưa có ảnh — cần drag-drop thủ công trên GitHub` và nêu rõ lý do trong phần báo cáo cho user.
   - **Ảnh `Mong muốn` — BẮT BUỘC với mọi issue có thay đổi nhìn thấy được trên màn hình** (2026-07-27). Chỉ issue logic/API/rule thuần không đổi giao diện mới được ghi `Không có`. Không chụp được thì phải nêu lý do cụ thể, không để trống.
   - **Thang ưu tiên**:
     1. Đã có mockup/design thật (Pencil `.pen`, Figma, ảnh từ US) → dùng luôn.
     2. **Màn hình đã có code → throwaway patch + chụp thật (đường mặc định).** Giao Codex/Gemini (chọn executor theo Bước 2b của `/dispatch`) sửa tạm UI trong **worktree riêng** để thể hiện đúng trạng thái mong muốn, chạy dev server, chụp bằng `capture-evidence.mjs`, rồi **vứt patch** (không commit, xoá worktree) — chỉ giữ ảnh. Ràng buộc bắt buộc trong prompt giao agent:
        - **Chỉ sửa đúng phần mô tả trong `Mong muốn`.** Không refactor, không đổi component/token/spacing khác, không thêm dependency.
        - Tái dùng component + design token có sẵn của project; không tự chế style mới. Không đụng component master dùng chung.
        - Chụp **cùng route, cùng viewport, cùng dữ liệu** với ảnh `Hiện tại` để hai ảnh so được 1:1.
        - Ảnh không chứa dữ liệu khách thật, token, thanh devtools.
        - Micro task mà throwaway patch ≈ chính fix đó → làm fix thật luôn qua `/dispatch` rồi đi luồng `/create-pr-issues`, đừng mockup.
     3. **Màn hình/flow CHƯA có code** → wireframe Pencil MCP (skill `product-designer`, `export_nodes` ra PNG) hoặc `/design-shotgun` (đọc `DESIGN.md` của repo). Ảnh sinh ở bậc này **PHẢI gắn nhãn ngay dưới ảnh**:

        ```markdown
        > ⚠️ Ảnh phác thảo hướng giao diện — KHÔNG phải spec pixel-perfect. Bám design system thật khi làm.
        ```

     4. Issue không đổi giao diện → ghi `Không có`.
   - **Ranh giới dùng model sinh ảnh**: `/design-shotgun` CHỈ được dùng ở bậc 3 (chưa có code) và bắt buộc kèm nhãn phác thảo. Tuyệt đối KHÔNG dùng model sinh ảnh tự do (DALL-E, gpt-image...) cho màn hình đã có code — sai design system, chữ biến dạng, dễ bị hiểu nhầm là spec thật. Màn hình đã có code thì luôn là bậc 2.
   - **Verify trước khi dùng**: mở/đọc lại ảnh đã chọn để xác nhận đúng màn hình + đúng trạng thái mô tả trong `Hiện tại`/`Mong muốn`; ảnh không chứa dữ liệu khách thật, token, hay thanh devtools.

5. **Attachments Upload (cách đính kèm file — cập nhật 2026-07-16)**:
   - Source of truth for evidence stays in the canonical Obsidian destination defined by `.agent-rules.d/reports-export.md`: Full US → folder chứa file US; micro task → `Ad-hoc Evidence/<issue-slug>/` trong sprint active.
   - **KHÔNG commit ảnh/video evidence vào source code** (kể cả `docs/issue-assets/` — quy tắc permalink SHA cũ đã bỏ). Repo private không render inline ảnh commit-trong-repo, và asset làm phình repo/history.
   - Ảnh chụp tự động (`scripts/capture-evidence.mjs`) phải lưu **trực tiếp vào Obsidian** bằng `--us-file` hoặc `--out` canonical. Temp/scratch chỉ là fallback kỹ thuật; nếu phải dùng, copy vào canonical destination và verify file trước khi upload. **Evidence trong PR/issue phải hiển thị ảnh inline** — đưa bản persistent lên GitHub theo thứ tự:
     1. **Browser automation (ưu tiên):** Claude-in-Chrome với Chrome đã login GitHub → mở PR/issue → Edit body/ô comment → `file_upload` PNG vào textarea markdown → GitHub host thành URL `https://github.com/user-attachments/assets/<uuid>` (render inline) → chèn vào đúng ô `Trước`/`Sau`/`Minh họa` → Save → verify body có `user-attachments`.
     2. **Fallback thủ công:** không có browser/session → ghi `Chưa có ảnh — cần drag-drop thủ công trên GitHub` kèm **path file đã chụp** để user kéo-thả; sau đó có thể `gh pr edit --body-file` tái dùng URL `user-attachments` vừa sinh để chỉnh format.
   - Ảnh đã có sẵn trên GitHub (`user-attachments` URL từ issue/comment khác) → embed lại trực tiếp; nếu evidence này được dùng để hoàn tất một Full US và chưa có bản local, tải/copy một bản vào folder US khi có thể.
   - `docs/issue-assets/` còn tồn tại trong repo chỉ là legacy — dùng để TRA CỨU ảnh cũ (Evidence Discovery bước 2), không thêm file mới vào đó.
   - NEVER attach files containing secrets, tokens, real customer data, or credentials.

6. **After Creation (sync back)**:
   - Add the issue URL to the corresponding US file in Obsidian (e.g. under `## 📋 Tasks / TODOs` or a `**GitHub Issue:**` line) so the sprint tracking stays linked both ways.
   - Add/update `## 📎 Evidence` in the US markdown (or the ad-hoc sprint entry) with local filenames/links. Verify every newly captured image/video exists in the canonical Obsidian folder; a GitHub URL alone does not satisfy local evidence storage.
   - If the issue was created from a PR, verify the issue appears on the project board with all 5 fields set before reporting DONE.

7. **Evidence Capture Safeguards (Quản lý Port & Môi trường)**:
   - Trước khi sử dụng script `scripts/capture-evidence.mjs` để chụp ảnh minh họa, Agent BẮT BUỘC tuân thủ các bước kiểm tra an toàn sau:
   - **Checklist 1 (Môi trường)**: Kiểm tra biến môi trường `.env.local` xem URL API (ví dụ `VITE_API_BASE_URL`) đang trỏ vào DEV hay Staging. Đảm bảo tài khoản login (Owner/Staff) mà script sử dụng ĐỒNG BỘ với môi trường đó.
   - **Checklist 2 (Xác minh UI & Port)**: KHÔNG dựa vào mặc định `localhost:3000`. Script hiện đã được nâng cấp tự động quét các cổng Vite phổ biến (3000, 3001, 5173). Tuy nhiên, nếu Agent phát hiện cảnh báo có service cũ bị treo, phải chủ động báo người dùng hoặc truyền chính xác `--base-url http://localhost:PORT` của server đang chứa code mới nhất.
   - **Checklist 3 (Tránh Mock ID)**: KHÔNG dùng các ID giả (như `ITEM001`) để truy cập thẳng vào URL Detail nếu trang đó có logic cross-validation (kiểm tra tồn tại ID trong danh sách thật). Phải dùng Playwright click động vào các Element có thật trên giao diện để tránh bị Fallback/Redirect làm sai lệch ảnh chụp.
