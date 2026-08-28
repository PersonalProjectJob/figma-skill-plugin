# Reports Export Rule

Whenever the user requests to export a report or walkthrough, or when a tester agent completes a test run:

1. ALWAYS save or copy the markdown report to the evidence folder of the repo/project you're working in:
   - **If this repo has a vault configured** (`${VAULT_ROOT}` set — see `dispatch/SKILL.md` Bước 0.5), use the appropriate folder in the Obsidian vault:
     a. **Sprint-level reports** (e.g., weekly reports, general QA reports): `${VAULT_ROOT}\Sprints\<week-name>\Reports\`
     b. **US-specific reports** (e.g., test plans, walkthroughs): the directory that contains the US markdown file, normally `${VAULT_ROOT}\Sprints\<week-name>\<US-folder>\`.
     c. **Micro/ad-hoc task without a US**: `${VAULT_ROOT}\Sprints\<active-week>\Ad-hoc Evidence\<issue-slug>\`.
   - **No vault configured**: attach directly to the GitHub issue/PR — that is the canonical storage location, not a fallback.
2. If browser live tests, E2E flows, manual walkthroughs, PR drafting, or issue creation generate screenshots/video (`.png`, `.jpg`, `.mp4`, `.webm`), save the original files directly into the destination above. GitHub `user-attachments` is a distribution copy, not the local source of truth.
3. A temp/scratch directory may be used only when a tool cannot target the destination directly. Before reporting completion or uploading to GitHub, copy the artifact into the canonical persistent destination you selected above (vault or issue/PR attachment), verify it exists there, and use that persistent file for upload. Never leave the only copy in `%TEMP%`, a scratchpad, `.gstack/`, or the source repo.
4. **Expected Full US structure**:

   ```text
   US-093-staff-self-unlink-salon/
   ├── US-093-staff-self-unlink-salon.md
   ├── US-093--staff-salons--current--before.png
   ├── US-093--staff-salons--expected--unlink-button.png
   └── qa-report.md
   ```

5. **Evidence naming convention (MANDATORY for screenshots/video)** — so any later agent can FIND the right evidence deterministically instead of guessing:

   ```
   <US-ID hoặc issue-slug>--<screen-slug>--<current|expected>--<mô-tả-ngắn>.<ext>
   ```

   - `<screen-slug>`: theo mục "Screen slug" trong `.agent-rules.d/screen-registry.md` (vd `dashboard-staff`, `staff-qr`, `login`).
   - `current` = trạng thái đang có (trước khi sửa); `expected` = trạng thái mong muốn/sau khi sửa.
   - Thêm hậu tố viewport khi có nhiều bản: `--mobile` / `--desktop` (vd `US-012--dashboard-settings--current--nut-luu-bi-che--mobile.png`).
   - Ảnh chụp theo step của walkthrough vẫn giữ số step nếu cần, nhưng ảnh nào đại diện cho trạng thái một màn hình thì PHẢI theo convention trên.

6. Add or update a `## 📎 Evidence` section in the US markdown/report and reference the local files by filename (Obsidian embed/link). For ad-hoc evidence, link the evidence directory or files from the active sprint's ad-hoc entry.
7. Do not commit evidence media into the source repo, including `docs/issue-assets/`. That directory is legacy read-only lookup.

This keeps test evidence colocated with the corresponding story, makes the US folder useful as the unit-of-work container, and keeps GitHub uploads traceable to a persistent local original.
