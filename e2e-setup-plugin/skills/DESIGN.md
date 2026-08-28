# DESIGN — skill `e2e-setup`

> Bản public, viết lại gọn từ một package nội bộ đã dùng thật trong production. Số liệu cụ thể (byte
> ảnh, tên repo, domain) đã bỏ — phần còn lại là kiến trúc + lý do, cái vẫn đúng khi đổi sang project của
> bạn. Xem `NOTICE.md` cho phạm vi anonymize.

## 1. Vấn đề

Ba dữ kiện thường gặp ở một repo frontend hiện đại:

1. `tests/`/`scripts/` (chứa script chụp evidence riêng của repo, nếu có) hay bị `.gitignore` ⇒ mọi
   worktree do `git worktree add` tạo cho một coding agent (Codex, Gemini/Antigravity...) **không có**
   script đó, dù nó tồn tại ở checkout chính.
2. Lệnh `test:e2e` khai trong `package.json` nhiều khi trỏ vào một file không còn tồn tại (script đổi
   tên, người viết lại quên sửa `package.json`) — không phải vấn đề của skill này, nhưng hay bị nhầm
   là "không có E2E" khi thực ra chỉ là entrypoint chết.
3. Năng lực thật thì gần như luôn có sẵn trên máy: `playwright-core`/`puppeteer` nằm trong
   `node_modules` của checkout chính, và Chrome/Edge (hoặc bundle Chromium của Playwright) đã cài trong
   cache máy.

Khoảng cách giữa (1)+(2) và (3) là nguồn của một lớp lỗi rất cụ thể: agent được giao "chụp ảnh cho tôi
xem", báo "tôi là text-based AI, không chạy được browser", trả về 0 ảnh — trong khi một agent KHÁC chạy
Playwright headless thành công ngay trên **cùng máy, cùng file, cùng phiên**. Vấn đề không phải năng lực
thiếu, mà là **không ai giao công cụ + nói rõ agent được phép dùng nó**.

Một rule kiểu "agent được phép chạy browser, và bằng chứng phải là output máy" chỉ nói *được làm gì*;
không có cơ chế nào ép nó *thực thi* — người điều phối vẫn phải tự nhớ, tự đoán mỗi lần. Skill này là cơ
chế đó.

## 2. Đối chiếu tham chiếu ngoài (rút gọn)

| Nguồn | Lấy gì | Không lấy gì |
|---|---|---|
| Các skill Playwright/test kiểu "test-skills" cho coding agent đa nền tảng (Claude/Codex/Cursor/Antigravity) | Đóng gói `SKILL.md` + `references/`, kit tự chứa là nguồn sự thật duy nhất | Các skill đó thường giả định runner (Playwright) **đã cài sẵn** — đúng cái lỗ package này phải vá, nên không copy giả định đó |
| Playwright MCP server | Ý tưởng drive UI bằng accessibility tree thay vì toạ độ pixel | Không làm xương sống: một subagent chỉ có tool Bash sẽ không thấy MCP, và nhiều sandbox mặc định chặn MCP hoặc chặn browser khởi động |
| Sandbox của các CLI coding agent (mặc định no-network + workspace-write) | Phải sinh đúng cờ/quyền để browser khởi động được trong sandbox đó | — |
| "Browser subagent" native của một số IDE agent (chụp ảnh/video làm artifact review được) | Không dựa vào nó một mình — ca lỗi ở mục 1 xảy ra chính vì agent tự hạ cấp khi prompt không nói rõ nó được phép dùng | — |

Kết luận: các skill Playwright bên ngoài dạy **cách viết test**. Không cái nào lo **năng lực chạy được
trong đúng workspace của agent đang cầm việc, trên đúng host đó** — đó là vị trí của skill này.

## 3. Contract

```
/e2e-setup [<workspace>] [--host codex|antigravity|claude] [--target <url|file|dev>] [--for <task-id>]
```

- `workspace` mặc định = cwd. `--host` mặc định = tự dò.
- Trả về đúng ba thứ:
  1. `<workspace>/.e2e/REPORT.md` — state-in-file, để một phiên/agent khác tiếp nhận giữa dòng.
  2. Verdict ra stdout: `READY` | `PARTIAL` | `BLOCKED`.
  3. `<workspace>/.e2e/PROMPT-BLOCK.md` — đoạn nhúng thẳng vào prompt executor.

**Non-goal (YAGNI)**: không viết test suite cho feature, không CI, không cài package vào project, không
sửa `package.json`/`.gitignore` của repo đích.

## 4. Kiến trúc — 3 pha, 2 binary, 1 kit

Toàn bộ logic dò nằm **một chỗ** (`e2e-kit/resolve.mjs`); mọi binary/script khác chỉ gọi vào đó — không
có bản sao thứ hai của luật dò.

```
e2e-setup/
  SKILL.md / DESIGN.md
  bin/e2e-probe.mjs           # Pha 1 — read-only, luôn exit 0
  bin/e2e-provision.mjs       # Pha 2 + 3 — rải kit rồi chạy cổng smoke
  e2e-kit/
    resolve.mjs               # nguồn duy nhất của logic dò
    smoke.mjs                 # cổng NĂNG LỰC: launch → goto → PNG → JSON → exit code
    flow.mjs                  # cổng LUỒNG: chuỗi bước người-thật (xem §6)
    capture.mjs                # chụp evidence; uỷ quyền script riêng của repo khi có
    publish.mjs                # đóng gói .png/.md → .zip → GitHub Release, trả URL (xem §7)
    login.json                 # cấu hình form login — file DUY NHẤT phụ thuộc 1 project cụ thể
    flows/{_TEMPLATE,login-form-interaction,login-owner}.json
    hosts/{codex,antigravity,claude}.md
    env.local.example
    PROMPT-BLOCK.tmpl.md
```

### 4.1 Pha 1 — Probe (read-only)

Dò ba trục rồi leo ladder. Mỗi bậc phải in output thật, không in phán đoán.

**Trục host**: đọc env marker của từng CLI (biến `CODEX_*`, `CLAUDECODE`...); một số host (IDE agent
không có CLI riêng) không có marker đáng tin ⇒ trả `unknown`, truyền `--host` tay để có ghi chú đúng.

**Trục workspace**: `git rev-parse --git-dir --git-common-dir --show-toplevel`. `git-dir ≠
git-common-dir` ⇒ worktree.

**Trục target**: `http(s)://…` ⇒ url; file `.html` tồn tại ⇒ file; còn lại ⇒ dev server (port đọc từ
`vite.config.*`/`package.json`, fallback 3000).

**Ladder** (dừng ở bậc đầu tiên đủ dùng):

| Bậc | Kiểm | Ghi chú |
|---|---|---|
| 1 | script chụp evidence riêng của workspace (`scripts/capture-evidence.mjs`, hoặc path trong `E2E_CAPTURE_SCRIPT`) | có ⇒ dùng, giữ nguyên convention/auth riêng của nó |
| 2 | `<ws>/node_modules/{playwright,playwright-core,puppeteer,cypress}` | |
| 3 | `node_modules` của **repo gốc** theo path tuyệt đối | worktree chưa cài dependency thì bậc 2 rỗng mà năng lực vẫn có — path suy ra từ `git-common-dir`, không hardcode |
| 4 | cache máy: `PLAYWRIGHT_BROWSERS_PATH`, `%LOCALAPPDATA%\ms-playwright`, `~/.cache/ms-playwright`, `~/Library/Caches/ms-playwright` | chọn rev cao nhất; ưu tiên `chromium_headless_shell-*` rồi `chromium-*` |
| 5 | Chrome/Edge đã cài (channel) | |
| 6 | MCP server điều khiển browser, nếu host có | tuỳ chọn |

### 4.2 Pha 2 — Provision (chỉ ghi trong `<workspace>/.e2e/`)

- **Copy, không junction/symlink.** Worktree bị xoá là link đứt; kit vài KB nên copy tự chứa rẻ hơn một
  lớp gián tiếp có thể vỡ.
- **Sạch git bằng `.git/info/exclude`, không sửa `.gitignore`.** Không đổi repo mà `git status` vẫn
  trắng. Worktree dùng chung `info/exclude` với repo gốc (`git rev-parse --git-common-dir`) — dòng thêm
  vào ảnh hưởng cả repo gốc, nhưng local-only/untracked/idempotent nên vẫn chấp nhận được.
- **Không copy secret.** `.e2e/env.json` chỉ ghi TÊN biến cần + có/thiếu, không bao giờ giá trị.

### 4.3 Pha 3 — Prove (cổng)

`smoke.mjs --target <resolved>` phải exit 0 **và** để lại PNG có thật; số byte đọc bằng `statSync` trong
cùng lượt — không tin số cũ từ lần chạy trước.

| Verdict | Điều kiện | Hệ quả |
|---|---|---|
| `READY` | smoke exit 0, PNG tồn tại, size khớp đĩa | Được phép viết yêu cầu ảnh vào prompt executor |
| `PARTIAL` | browser mở được nhưng target không tới được / thiếu secret | KHÔNG dùng để tick "đã verify UI" |
| `BLOCKED` | hết ladder, không có runner hoặc không có browser | Hợp lệ; phải kèm output từng bậc đã thử |

## 5. Xử lý lỗi

- Không có runner **hoặc** không có browser ⇒ `BLOCKED`, in từng bậc kèm path đã thử. Đề xuất
  `npx playwright install chromium` (ghi vào cache máy, không vào project) — không đề xuất lệnh cài
  dependency vào `package.json`.
- Target không tới được ⇒ `PARTIAL` + lệnh khởi động dev server đọc từ `package.json`.
- Thiếu secret ⇒ `PARTIAL` + danh sách TÊN biến thiếu, không bao giờ in giá trị.
- Mọi exception trong `e2e-probe.mjs` bị bắt và biến thành một bậc ladder `error`; probe **luôn exit 0**.

## 6. Cổng LUỒNG `flow.mjs`

`smoke.mjs` chỉ `goto` + chụp — chứng minh "máy mở được browser", không chứng minh đã tới trạng thái chỉ
tồn tại sau khi bấm (modal, form lỗi, giỏ có món, luồng nhiều bước). `flow.mjs` là cổng riêng cho việc
đó, và engine **cưỡng chế** bốn ràng buộc (không phải khuyến nghị trong tài liệu):

1. Chỉ có verb tương tác thật (`click`/`fill`/`select`/`press`/`hover`/`check`/`scroll`/`reload`) —
   không có verb set state hay gọi hàm render nội bộ, nên không có cửa nào để inject state giả.
2. Mỗi `shot` phải có ≥1 bước chứng minh (`waitFor`/`expectText`/`expectVisible`/`expectUrl`/
   `expectUrlNot`) kể từ lần chụp trước — thiếu thì `FLOW_FAILED` và **ảnh không được tạo**.
3. Flow phải có ≥1 tương tác — chỉ `goto`+`shot` là smoke đội lốt luồng người dùng, cũng `FLOW_FAILED`.
4. Shot sau scroll phải có `expectVisible` (xác nhận target nằm trong viewport) sau lần scroll cuối —
   `waitFor` trơn không tính; thiếu thì `FLOW_FAILED`, vì cuộn xong mà không chứng minh lại vị trí
   thì ảnh có thể đang chụp đúng vùng màn hình sai. Shot manifest ghi lại `scrollY`, target/method
   scroll, expectation và readiness để đối chiếu ngược được ảnh với đúng trạng thái đã chứng minh.

Flow trượt ⇒ ảnh của lượt đó bị dồn sang `out/<flow>/REJECTED/`, đổi tên `REJECTED-*` — giữ lại để debug
nhưng không ở dạng dán được thẳng vào issue/PR như bằng chứng thật. Mỗi lượt flow còn ghi `trace.zip`
(Playwright trace) + video `.webm`.

**Secret trong flow file**: dùng `${TEN_BIEN}`, engine nội suy từ env/`.env.local` lúc chạy, đánh dấu
bước đó `valueMasked: true`, không bao giờ đưa giá trị vào output.

**Trục môi trường**: nếu project của bạn có nhiều môi trường (dev/staging) trỏ API khác nhau dù host
giống nhau, `--env` chọn cùng lúc bộ credential + base URL + API base kỳ vọng, và mỗi lượt smoke/flow đối
chiếu host API trang thật sự gọi với API mong đợi — lệch (cùng họ domain, khác host) ⇒ `ENV_MISMATCH`,
ảnh bị cách ly; không gọi API app nào thì ghi nhận "không xác nhận được", không kết luận sai.

## 7. `publish.mjs` — đóng gói evidence thành URL chia sẻ được

Skill chỉ lo *chụp*; nơi lưu ảnh cuối cùng thường là do bạn tự quyết (Obsidian, Notion, một thư mục nội
bộ...). `publish.mjs` thêm một lựa chọn portable, không cần setup tài khoản mới: đóng gói folder evidence
thành `.zip` rồi upload lên **GitHub Release assets** của repo bạn chỉ định, dùng `gh` CLI đã login sẵn.

Bốn quyết định đáng nói (rút từ một vòng test thật + sửa lại, không phải lý thuyết):

1. **Repo publish PHẢI được truyền rõ ràng** (`--repo`, hoặc field `repo` trong `.e2e/env.json` do
   `e2e-provision.mjs` ghi từ chính workspace app) — **không tự dò từ `--evidence-dir`**. Lý do: nơi bạn
   lưu evidence (một vault ghi chú, một thư mục Notion sync…) rất có thể là **một git repo khác**, có
   remote GitHub của riêng nó — tự dò ở đó có thể publish nhầm sang một repo hoàn toàn không liên quan.
   Thiếu cả hai nguồn ⇒ FAIL rõ ràng, không đoán.
2. **Tag mặc định theo tuần ISO** (`qa-evidence-2026-W35`, tính từ giờ hệ thống) — không dùng 1 release
   evergreen duy nhất, tránh trang release phình dần vô hạn qua nhiều tháng.
3. **Lọc đuôi file evidence-like trước khi zip** (`.png/.jpg/.md/.zip/.webm/...`); file khác đuôi bị loại
   và **báo rõ trong output**, không im lặng bỏ qua. File tên khớp pattern hay dùng cho secret (`.env`,
   `token`, `credential`, `password`, `apikey`, `.pem`, `.key`...) làm **FAIL cứng toàn bộ lượt chạy** —
   không có cờ để bỏ qua. (Bẫy đã gặp lúc test: bộ lọc "bỏ file ẩn" ban đầu vô tình loại `.env` TRƯỚC khi
   bước kiểm secret kịp thấy nó — file "biến mất" êm thay vì làm cả lượt FAIL. Sửa bằng cách để bước kiểm
   secret chạy trên toàn bộ file, kể cả dotfile, rồi mới lọc đuôi.)
4. **Không viết gì vào `--evidence-dir`** — zip và manifest tự sinh (khi folder chưa có `.md` mô tả) đều
   dựng trong một thư mục tạm hệ thống, xoá sau khi upload xong. Ảnh evidence gốc của bạn không bị mutate.

In ra 1 dòng `✅ Uploaded: <url>` trước JSON đầy đủ. Repo private ⇒ URL đó chỉ mở được trong browser đã
login GitHub có quyền vào repo, hoặc qua `gh release download`/`gh api ...Accept: application/octet-stream`
— `curl` ẩn danh sẽ báo 404 giả, không phải bằng chứng link hỏng.

## 8. Persona: người vận hành qua 1 coding agent, không tự gõ lệnh

Nếu người dùng thật của skill này chủ yếu ra yêu cầu bằng ngôn ngữ tự nhiên và để một coding agent gọi
script + đọc output thay họ, "hiệu suất" của skill không chỉ là tốc độ chạy — mà là số lượt agent phải
hỏi lại, và số token nó phải đọc để relay đúng cho người dùng. Áp khi mở rộng skill này:

1. Mọi script in đúng 1 dòng tóm tắt Ở ĐẦU output trước khi in JSON/markdown chi tiết.
2. Config (platform lưu ảnh, target môi trường mặc định) chốt sẵn — đừng bắt hỏi lại mỗi lượt.
3. Thêm năng lực bằng lệnh mới độc lập, đừng bắt học lại quy trình cũ.
4. Lỗi phải kèm lệnh sửa cụ thể, vì agent sẽ dán nguyên văn cho người dùng.
5. Idempotent khi bị gọi lại (retry mạng/timeout).
6. Không đẻ thêm file rời không lý do — giữ số file agent phải quét khi tổng hợp báo cáo nhỏ.

## 8b. `env-writer.mjs` — thiếu tài khoản thì hỏi, không bảo user tự tạo file

Thiết kế trước đó (§7 + phần "Tài khoản cho automation" trong `SKILL.md`) giả định con người sẽ tự mở
`.env.local` ra sửa khi probe báo thiếu. Với persona ở §8, giả định đó là điểm nghẽn: người dùng không tự
sửa file được, nên "báo thiếu rồi dừng" = việc không bao giờ tự xong. `env-writer.mjs` đổi luồng thành:
probe báo thiếu ⇒ agent hỏi ngay trong chat ⇒ user trả lời ⇒ agent tự ghi file ⇒ tiếp tục ngay.

Ba quyết định an toàn, cùng tinh thần "chỉ đọc TÊN biến" đã có từ đầu:

1. **Đọc credential qua STDIN (JSON), không qua `--argv`** — argv lộ qua process list/Task Manager;
   STDIN thì không.
2. **Không bao giờ in giá trị ra output** — chỉ xác nhận bằng TÊN biến đã ghi, và `SKILL.md` cấm rõ việc
   "echo lại giá trị để user xác nhận".
3. **Ghi vào `.env.local` của repo gốc, tự suy ra kể cả khi gọi từ worktree** — tái dùng cùng logic phân
   loại workspace mà phần đọc secret đã dùng, để không tạo ra một file cấu hình thứ hai mà không script
   nào khác trong kit tìm tới.

Acceptance đã chạy thật: dựng 1 cặp git repo gốc + worktree thật, gọi script từ worktree — file được ghi
đúng vào `.env.local` của repo gốc, worktree không có file này. Gọi lại với giá trị khác cho cùng role ⇒
2 dòng cũ được cập nhật tại chỗ, không nhân bản; thêm role khác ⇒ dòng mới, role cũ giữ nguyên. Thiếu
`--role` và STDIN không phải JSON hợp lệ đều thoát mã 1 với lỗi rõ ràng. Không có giá trị password nào
xuất hiện trên stdout/stderr/JSON trong toàn bộ các lượt test.

## 8c. Verb `scroll` trong `flow.mjs`

Trước bản này, danh sách verb tương tác thật thiếu `scroll` — một khoảng trống thật: trang cần lướt để
kích hoạt lazy-load/sticky-header/infinite-scroll trước khi bấm là tình huống phổ biến. Ba dạng, cùng
nguyên tắc "chỉ dùng sự kiện input tổng hợp thật, không `page.evaluate`":

```json
{ "scroll": "down" }                                            // mouse.wheel(), ~600px
{ "scroll": { "y": 1200 } }                                      // mouse.wheel(), pixel tuỳ chỉnh
{ "scroll": { "to": { "role": "button", "name": "Xem thêm" } } } // scrollIntoViewIfNeeded()
```

`scrollIntoViewIfNeeded()` được chấp nhận dù không dispatch sự kiện wheel — nó vẫn là API tương tác chuẩn
của Playwright (cùng tầng với `click()`/`fill()`), không phải gọi hàm render nội bộ của app.

Acceptance đã chạy thật (mở ảnh ra xem, không chỉ tin exit code): dựng 1 trang HTML cao 4000px với một
khối ở đầu trang và 1 nút đặt sâu bên dưới. Chụp trước khi lướt (chỉ thấy khối đầu trang), lướt theo pixel
rồi chụp (nút đã lộ ra), lướt lên rồi lướt-tới-đúng-nút rồi chụp (nút xuất hiện lại), bấm nút rồi chụp lần
cuối. Verdict `FLOW_VERIFIED`, `interactions: 4` — mở cả 4 ảnh ra xem xác nhận đúng vị trí từng bước.

## 8d. Mode 2 — test theo test case (`testcase-parse.mjs` + `testcase-report.mjs`)

Mode 1 (§7, chỉ chụp evidence theo 1 flow đã viết) vẫn giữ nguyên. Mode 2 là một lối đi THÊM VÀO cho khi
đã có sẵn 1 danh sách test case (không phải flow JSON) và muốn biết case nào PASS/FAIL, gom theo mức độ
nghiêm trọng — mượn taxonomy 4×7 kiểu QA phổ biến (severity: critical/high/medium/low; category:
visual/functional/ux/content/performance/console/accessibility).

**Kiến trúc — parse (máy) → dịch (agent) → chạy (engine cũ, không đổi) → gom (máy):**

```
test-case.md (bảng Bước / Kết quả mong đợi)
      │  testcase-parse.mjs — parse xác định, KHÔNG suy luận
      ▼
{ id, feature, environment, route, severity, category, steps: [{n, action, expected}] }
      │  AGENT dịch — DUY NHẤT bước có suy luận tự do trong toàn luồng
      ▼
flow.json (verb thật + expectText/expectVisible)
      │  flow.mjs — Y NGUYÊN, không sửa để "nới" cho test case
      ▼
verdict (FLOW_VERIFIED/FLOW_FAILED/...) + stdout lưu ra file
      │  testcase-report.mjs — gom xác định, KHÔNG chấm lại
      ▼
results.json (tích luỹ) + results.md (bảng sắp theo severity)
```

Quyết định cốt lõi: **verdict của 1 test case = verdict của `flow.mjs`** chạy flow đã dịch ra từ nó —
không tự chấm điểm lại "bước nào coi như đã chứng minh". `flow.mjs` đã cưỡng chế điều đó (không shot nào
lọt qua mà chưa `expectVisible`/`expectText`), nên PASS của Mode 2 có cùng độ tin cậy với PASS của Mode 1.

**Vì sao KHÔNG tính health score 0-100** như một số công cụ QA tự crawl toàn app: điểm đó chỉ có ý nghĩa
khi quét được TOÀN BỘ app (đủ dữ liệu để tính điểm tổng đại diện). Mode 2 chỉ chạy đúng tập test case
được đưa vào — tính điểm từ 1 tập con nhỏ sẽ là số bịa trông như số thật. Thay vào đó chỉ đếm PASS/FAIL
theo severity + bảng sắp theo mức độ nghiêm trọng.

**Acceptance đã chạy thật (cả đường pass lẫn fail, không chỉ đọc code khai xong):**

| Ca | Kết quả |
|---|---|
| Parse test case 3 bước, đủ metadata | JSON đúng `severity: high`, `category: functional`, 3 steps |
| Parse thiếu severity/category | Mặc định `medium`/`functional` + `warnings`, vẫn `ok:true` |
| Parse severity/category sai chính tả | Bị từ chối, rơi về mặc định + cảnh báo rõ giá trị nào sai |
| Parse không có bảng nào | `ok:false`, thoát mã 1, lý do rõ ràng |
| Dịch tay 3 bước → flow.json, chạy qua `flow.mjs` trên 1 trang HTML lưu bằng `localStorage` (bước 3 cần verb `reload` — xem §8e) | `FLOW_VERIFIED`, exit 0 |
| `testcase-report.mjs` ghi case PASS | `✅ PASS`, đúng `severity` vào `results.json` |
| Test case thứ 2 CỐ Ý sai (`expectText` 1 chuỗi không tồn tại) | `FLOW_FAILED` thật (không phải giả lập), exit 3 |
| `testcase-report.mjs` ghi case FAIL (đọc từ stdout đã lưu, KHÔNG có file audit vì flow FAIL) | `❌ FAIL`, đúng `severity` |
| `--render` xuất bảng tổng hợp 2 test case | Case `critical` (FAIL) hiện **trước** case `high` (PASS) — đúng thứ tự ưu tiên sửa |

## 8e. Verb `reload` — thêm giữa chừng khi test thật lộ ra thiếu

Ví dụ test case đầu tiên dùng để verify Mode 2 ("lưu cài đặt, tải lại trang, kiểm giá trị còn nguyên")
cần 1 hành động `flow.mjs` chưa hỗ trợ: tải lại trang. Phát hiện ngay lúc test thật (không phải lúc thiết
kế), vì bước dịch flow.json không có verb nào khớp "Tải lại trang". Thêm `case 'reload'` dùng
`page.reload()` thật — cùng tầng với `click`/`fill` (API tương tác chuẩn của Playwright), không phải
`page.evaluate` gọi `location.reload()` qua code app.

## 9. Giới hạn đã biết

- Gắn với công cụ tại một thời điểm (giữa 2026): Playwright-core, các CLI coding agent hiện tại. Tên
  cờ/CLI của các hãng sẽ lỗi thời trước khi phần nguyên tắc lỗi thời — đọc phần nguyên tắc, thay công cụ
  theo thời của bạn.
- `login.json` là file duy nhất phụ thuộc form login của một project cụ thể — copy skill sang project
  khác thì việc đầu tiên là sửa lại đúng file này.
- Chưa đo được publish.mjs ở quy mô dùng thật nhiều tháng (tag theo tuần có phình không, có cần dọn định
  kỳ không) — mới verify đúng một vòng end-to-end thật + các đường lỗi chính.
