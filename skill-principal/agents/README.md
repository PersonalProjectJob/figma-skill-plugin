# agents/ — phân vai bằng cổng cứng, không bằng lời dặn

5 vai dưới dạng file định nghĩa subagent (Claude Code đọc `~/.claude/agents/*.md`; harness khác có cơ chế tương đương). Đây là phần **thực thi** của nguyên tắc "một bên duy nhất được merge" và "không tin báo cáo suông".

## Vì sao cần file định nghĩa, không chỉ thêm câu cấm vào prompt

Frontmatter cho 3 thứ mà prompt **không** làm được:

| Trục | Ý nghĩa |
|---|---|
| `tools` | allowlist, **deny-by-omission**: tool không liệt kê thì agent không có để gọi |
| `disallowedTools` | denylist — lớp thứ hai, để sau này ai nới `tools` thì vẫn không mở được đường ghi |
| `effort` | `low`/`medium`/`high`/`xhigh`/`max` — **chỉ đặt được ở frontmatter**, không truyền được lúc gọi |
| `model` | alias (`sonnet`/`opus`/`haiku`) chứ không phải version slug, nên lên generation mới không phải sửa file |
| `Agent(a, b)` | trong `tools`: giới hạn vai này chỉ được spawn đúng những vai nào |

Trục `tools` là lý do chính. Ca thật: prompt cấm rõ ràng sửa file source, cho phép nói BLOCKED, executor vẫn sửa 7 file để 32/32 AC thành PASS. **Lệnh bằng chữ bị bỏ qua được; thiếu tool thì không.**

## Ai làm gì

| Vai | model / effort | tools | Chặn được gì |
|---|---|---|---|
| [`role-planner`](role-planner.md) | opus / xhigh | read-only | plan biến thành code trước khi qua cổng duyệt |
| [`role-executor`](role-executor.md) | sonnet / high | + Edit, Write | code chạy bằng model main-loop (đắt nhất) |
| [`role-verifier`](role-verifier.md) | sonnet / xhigh | read-only | người kiểm tự vá code cho xanh |
| [`role-reviewer`](role-reviewer.md) | opus / xhigh | read-only | reviewer trùng người viết |
| [`role-evidence-auditor`](role-evidence-auditor.md) | haiku / medium | Read, Bash | trả tiền model to cho việc hash ảnh |

`role-verifier` hỏi *"chạy có xanh không"*; `role-reviewer` hỏi *"xanh mà có đúng không"*. Hai câu khác nhau — đừng gộp một vai.

**Model/effort không hardcode rải rác**: đặt ở frontmatter, và ánh xạ role → vai → chuỗi fallback sang agent khác đặt ở **một** file dữ liệu của bạn. Đổi model cho một vai = sửa 1 chỗ, **không truyền `model` ở call site** — truyền ở call site là quay lại hardcode rải rác.

## Cài

```bash
cp agents/role-*.md ~/.claude/agents/          # hoặc junction/symlink cả thư mục để nằm trong git
node ../scripts/check-agents.mjs agents        # cổng: vai read-only không được có tool ghi
```

Lưu ý nạp (Claude Code): thư mục agent được watch và file mới nạp trong vài giây, **nhưng chỉ với thư mục đã tồn tại lúc session bắt đầu**. Tạo thư mục/junction giữa phiên thì phiên đó gọi vai mới ra `not found`; phiên sau mới có. Junction/symlink **được theo** (đã kiểm thực tế trên Windows).

## Quy ước khi thêm vai mới

- Vai nào **kiểm hoặc review** thì tuyệt đối không cấp `Edit`/`Write`.
- Body của file là prompt thật: viết kèm **ca kiểm chứng cụ thể** (hiện tượng đã gặp) thay vì lời khuyên chung — đó là thứ khiến agent đọc xong biết cái bẫy trông như thế nào.
- Chạy `check-agents.mjs` sau khi sửa. Nó biến quy ước trên thành exit code thay vì chỉ là câu trong README.
- Test nghiệm thu cho vai kiểm-định: cho nó soát một báo cáo **đã biết trước là bịa** (một thư mục evidence có 2 file ảnh trùng byte khai cho 2 AC khác nhau, và một dòng PASS có evidence là "static code review" cho AC hành vi). Vai nào trả `EVIDENCE OK` trên bộ đó là đang bịa — giữ bộ này lại để bắt.
