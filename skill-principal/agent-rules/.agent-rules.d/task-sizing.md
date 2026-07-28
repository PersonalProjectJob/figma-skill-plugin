# Task Creation, Sizing & Estimation Rule

When creating tasks/TODOs for any User Story in Obsidian:

1. **Enforce Task Granularity**:
   - Tasks must be detailed and appropriately sized. Avoid tasks that are too granular (under 0.5h) or too broad/large (above 8h).
   - The allowed duration range for any task is **0.5 hour to 8 hours**.
2. **Standard Task Categories**:
   - For standard feature implementations, always structure the checklist using these standard categories:
     - `Figma Design` (e.g., `Thiết kế giao diện trên Figma (Xh)`)
     - `FE Build UI` (e.g., `Xây dựng UI Frontend (Xh)`)
     - `Integrate API` (e.g., `Tích hợp API (Xh)`)
     - `Automation Test` (e.g., `Viết automation test (Xh)`)
   - You may add custom tasks as needed (e.g. `BE Development (Xh)`, `Database Migration (Xh)`) but they must respect the same sizing and estimate notation.
3. **Estimate Format**:
   - Always append the estimated duration in parentheses at the end of the task description: `(Xh)` or `(X.Xh)`.
   - E.g.:
     - `- [ ] Thiết kế giao diện trên Figma (3h)`
     - `- [ ] Xây dựng UI Frontend (4.5h)`
     - `- [ ] Tích hợp API (2h)`
     - `- [ ] Viết automation test (1.5h)`
4. **Time Tracking Automation**:
   - The weekly report script will parse these checkbox lines and sum up the hours of all completed tasks (`- [x]`) to calculate the member's weekly hours. Ensure all completed tasks have correct time notations.

---

## Task Tier Gate — Micro Task vs Full US (2026-07-14)

Trước khi tạo US cho bất kỳ yêu cầu nào, chạy gate sau. Chỉ cần **MỘT** tiêu chí rơi vào cột Full US → bắt buộc tạo US theo `.agent-rules.d/obsidian-us-workflow.md`. Agent tự quyết theo gate, KHÔNG hỏi user từng lần.

| Tiêu chí | Micro Task (KHÔNG tạo US) | Full US (pipeline chuẩn) |
|---|---|---|
| Estimate tổng | < 2h | ≥ 2h |
| Phạm vi | 1 surface, ≤ 2 files | Multi-file / shared layer (auth, httpClient, repository, context) |
| Bản chất | Copy/i18n, UI tweak, config, bug có repro rõ | Feature mới, đổi business logic, cần Figma, cần hỏi BE về API contract |
| Session | Xong trong 1 phiên | Kéo dài nhiều phiên |

### Micro Task lane

- **KHÔNG** tạo file US, **KHÔNG** tạo folder trong `Sprints/<week>/`. Spec/context = body của GitHub issue theo template trong `github-issue.md` (Màn hình / Vị trí / Thiết bị / Hiện tại / Ảnh hưởng / Mong muốn / Minh họa). Nội dung phải đủ rõ để member hiểu và triển khai mà không cần hỏi lại.
- Issues vẫn tạo **parent + child** qua `/create-pr-issues`: parent Item Type **Task** (QA/QC verify, assignee **cả `qa-owner` + `dev-owner`**), child Item Type **Dev Task** (personal report, assignee chỉ `dev-owner`). Khi Dev Task **Done** → parent Task chuyển **Testing** để QA/QC vào test; QA pass mới chuyển parent → Done trên board.
- Evidence (screenshot/video) của micro task lưu tại `Sprints/<active-week>/Ad-hoc Evidence/<issue-slug>/`, sau đó upload bản đó lên GitHub `user-attachments` và link từ sprint file. `docs/issue-assets/` chỉ dùng tra cứu legacy; không thêm file mới.
- **Escalation (chống lan man)**: đang làm mà scope phình — chạm business logic, thêm file thứ 3, phát sinh câu hỏi BE — thì **DỪNG**, promote lên Full US trước khi code tiếp.
- **Rollup cuối tuần**: nếu ≥3 micro tasks cùng một chủ đề trong tuần → đề xuất gom thành 1 US hồi tố hoặc 1 Backlog issue tổng (hỏi user chọn, không tự quyết).

### Trình bày trong Obsidian (sprint file active)

Mỗi micro task = **1 dòng** trong section `## 🔗 Ad-hoc PRs & Issues` của sprint file active (tạo section nếu chưa có):

```markdown
- [x] <title> (0.5h) — PR [#101](pr-url) · QA [#102](issue-url) `Testing` · Dev [#103](issue-url)
```

- Checkbox `[x]` = **Dev Task done** (agent code + tự verify xong) → script weekly report cộng giờ `(Xh)` ngay, không chờ QA.
- `(Xh)` = effort của Dev Task, tuân sizing 0.5h–8h như mọi task.
- Badge sau issue QA = mirror status của **parent Task** trên board: `Testing` → `Done ✅` / `Re-Open ⚠️`. **Board là source of truth** — agent sync badge mỗi khi được invoke mà có chạm sprint file (dùng `gh` check các parent còn `Testing`).
- QA fail (`Re-Open ⚠️`): thêm dòng con fix ngay dưới, giờ fix được tính thêm:
  `  - [x] Fix QA feedback: <mô tả> (0.5h)`
- **Sprint ownership:** dòng ad-hoc `[x] ... (Xh)` chỉ tồn tại trong sprint nơi phần Dev được thực hiện và chỉ được tính giờ một lần. Không copy dòng này sang `## 🔗 Ad-hoc PRs & Issues` của sprint mới.
- Sprint closeout mà parent còn `Code Review`, `Testing`, `In Progress` hoặc `Re-Open`: giữ dòng gốc trong sprint cũ; nếu cần theo dõi ở sprint mới, thêm **bullet thường** vào section `## 🧪 QA Follow-up từ Week-XX (không tính giờ)` — không checkbox, không notation `(Xh)`.
- Nếu QA fail trong sprint mới và phát sinh công sửa code mới, thêm một micro task mới trong `## 🔗 Ad-hoc PRs & Issues` của sprint mới với effort thực tế của phần fix; link lại parent/Dev issue cũ để giữ traceability.
