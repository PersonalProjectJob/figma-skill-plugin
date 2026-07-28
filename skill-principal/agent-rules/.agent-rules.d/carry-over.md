# Incomplete User Story Carry-Over & Change History Rule

When a sprint is closed/transitioned (see Sprint Transition rule in `.agent-rules.d/obsidian-us-workflow.md`), every User Story that is **not Done** (checkbox unchecked in the sprint file, or US frontmatter `status` ≠ `done`) MUST be carried over to the next sprint — work is never silently dropped.

1. **Move the US to the next sprint:**
   - Update the US file frontmatter `sprint:` to the new week (e.g. `sprint: "[[Week-04]]"`).
   - Add it to the new sprint file under a `### Carry-over (từ Week-XX)` epic, with the note `(carried over from Week-XX — <reason>)`.
   - Remove/uncheck it from the closed sprint's active epic list (keep it visible in the closed sprint only as historical record if desired, but it must appear as active in the new sprint).
2. **Ask the user for the reason (MANDATORY before finalizing the move):**
   - The Agent MUST ask the user *why* the US was not completed (e.g. blocker, deprioritized, scope change, dependency on BE, ran out of time). Do NOT invent a reason.
   - Use this reason verbatim in both the carry-over note and the change-history entry.
3. **Record change history in the US file:**
   - Each carried-over US file MUST contain a `## 🕘 Lịch sử thay đổi (Change History)` section (append, never overwrite previous entries) using a table:

     ```markdown
     ## 🕘 Lịch sử thay đổi (Change History)
     | Ngày | Từ Sprint | Sang Sprint | Lý do (user) | Người thực hiện |
     |------|-----------|-------------|--------------|-----------------|
     | 2026-06-22 | Week-03 | Week-04 | <lý do user cung cấp> | <author/agent> |
     ```
   - Optionally add frontmatter fields `carried_over_from` and `carry_over_count` for tracking how many times a US has slipped.
4. **Repeated slips:** if a US is carried over 3+ times, flag it to the user and recommend re-scoping or splitting it.
