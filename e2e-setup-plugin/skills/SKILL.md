---
name: e2e-setup
description: >-
  Use when an agent needs to run browser E2E, take evidence screenshots, or
  measure anything at runtime in a workspace that may not have the tooling —
  a fresh git worktree handed to Codex/Gemini, a folder outside the repo, or a
  repo whose test scripts are gitignored. Probes host + workspace + target,
  climbs the discovery ladder (repo capture script → workspace node_modules →
  main-repo node_modules → machine browser cache → installed Chrome/Edge),
  copies a self-contained kit into `<workspace>/.e2e/`, then PROVES it by
  running a real headless smoke and only reports READY when a PNG exists on
  disk. Emits a prompt block to embed in the executor prompt. Triggers
  "/e2e-setup", "setup E2E", "dựng E2E cho worktree", "agent không chạy được
  browser", "provision evidence tooling".
---

# /e2e-setup — Dựng năng lực E2E cho workspace của executor

Rule nền của skill này chỉ gồm 2 câu, viết ra để mọi agent trong org đọc cùng một chỗ (bạn có thể để
trong `AGENTS.md`/`CLAUDE.md` hoặc một rule file riêng — skill này không đòi vị trí cụ thể): **agent được
phép chạy browser headless để tự chụp/verify**, và **bằng chứng = output máy do chính lượt chạy này sinh
ra (PNG có thật + byte đọc lại từ đĩa), không phải "đã kiểm tra, trông ổn"**. Skill này trả lời câu còn
lại: **workspace này có công cụ hay không — và chứng minh bằng máy.**

Vì sao cần: nhiều repo có `tests/`/`scripts/` nằm trong `.gitignore`, nên mọi worktree do
`git worktree add` tạo cho Codex/Gemini **không có** script chụp evidence riêng của repo (nếu có). Năng
lực thì vẫn luôn có sẵn (`playwright-core` trong `node_modules` repo gốc + browser trong cache máy).
Khoảng cách đó chính là một ca thật: prompt đòi ảnh, executor báo "tôi không chạy được browser", 0 PNG —
trong khi một agent khác chạy được ngay trên cùng máy, cùng file.

**Không trùng skill nào khác:** `feature-focused-tester` viết test cho feature; skill này chỉ lo *có chạy
được không*. Chạy skill này **trước**, rồi mới tới test.

## Khi nào chạy

- `/dispatch` Bước 3.5 vừa tạo worktree cho Codex/Gemini và task có Visual Gate.
- Trước khi viết bất kỳ yêu cầu "chụp N ảnh" nào vào prompt executor.
- Target nằm ngoài repo (landing page whitelabel, prototype HTML rời).
- Một agent vừa báo "không chạy được browser" — chạy skill này để biết đó là thật hay là tự hạ cấp.

## Quy trình

### Bước 1 — Probe (read-only, không ghi gì)

```bash
node "${SKILL_DIR}/bin/e2e-probe.mjs" "<workspace>" [--host codex|antigravity|claude] [--target <url|file|dev>]
```

Luôn exit 0 — probe không bao giờ được là nguyên nhân làm hỏng một lượt dispatch. Đọc bảng nó in ra:
`capable: CÓ` thì đi tiếp Bước 2; `KHÔNG` thì đọc ladder xem thiếu bậc nào.

Ba trục nó dò, và cái bạn phải để ý ở mỗi trục:

| Trục | Để ý |
|---|---|
| host | Antigravity **không có** env marker đáng tin ⇒ trả `unknown`. Muốn có mục ghi chú host đúng thì truyền `--host antigravity`. Claude được xét **trước** Codex vì phiên Claude Code có plugin codex-companion vẫn mang `CODEX_COMPANION_*` trong env |
| workspace | `worktree` ⇒ bậc 3 của ladder (mượn `node_modules` repo gốc) là bậc quyết định. Repo gốc **suy ra từ `git-common-dir`**, không hardcode |
| target | `dev` ⇒ cần dev server chạy trước. `file` ⇒ không cần gì. `url` ⇒ staging/prod |

### Bước 2 — Provision + cổng smoke

```bash
node "${SKILL_DIR}/bin/e2e-provision.mjs" "<workspace>" [--host …] [--target …] [--for US-xxx]
```

Nó rải kit vào `<workspace>/.e2e/`, đăng ký `.e2e/` vào `.git/info/exclude`, ghi `env.json` (**chỉ tên
biến**, không bao giờ giá trị), rồi **chạy smoke thật** và ghi `REPORT.md` + `PROMPT-BLOCK.md`.

Exit code = verdict: `0` READY · `2` PARTIAL · `1` BLOCKED.

### Bước 3 — Đọc verdict, và làm đúng theo nó

**Verdict của provision nói về NĂNG LỰC, không nói về luồng.** `READY` nghĩa là *"máy này mở được browser
và tới được target"* — nó **không** nghĩa là đã verify bất cứ luồng người dùng nào. Đừng đọc lẫn hai thứ.

| Verdict | Nghĩa | Bạn được làm gì |
|---|---|---|
| `READY` | smoke exit 0, PNG có thật trên đĩa, byte đã `stat` lại | Được phép viết yêu cầu ảnh/số đo runtime vào prompt executor |
| `PARTIAL` | browser mở được nhưng target không tới được, hoặc thiếu secret | **Không** được tick Visual DoD bằng nó. Sửa cái thiếu (thường là bật dev server) rồi chạy lại |
| `BLOCKED` | hết ladder: không runner hoặc không browser | Kết quả **hợp lệ**. Không được lặng lẽ thay bằng đọc code tĩnh rồi vẫn tick PASS |

### Bước 3b — Muốn bằng chứng như người thật dùng: chạy `flow.mjs`

`smoke.mjs` chỉ `goto` + chụp, nên nó **không tới được** trạng thái chỉ tồn tại sau khi bấm: modal mở
bằng button, form ở trạng thái lỗi, giỏ hàng có món, luồng `date → time → specialist`. Muốn chụp đúng
những trạng thái đó thì phải đi bằng `flow.mjs`.

```bash
node "<workspace>/.e2e/flow.mjs" --flow <tên> --workspace "<workspace>"
```

Flow là một file JSON trong `.e2e/flows/` (mẫu: `_TEMPLATE.json`). Engine **cưỡng chế** bốn ràng buộc —
không phải lời khuyên trong tài liệu mà là điều kiện để exit 0:

1. **Chỉ có verb tương tác thật** (`click`/`fill`/`select`/`press`/`hover`/`check`/`scroll`/`reload`).
   Không có verb nào set state hay gọi hàm render nội bộ — inject state không phải E2E, nên engine không
   mở cửa cho nó. `scroll` dùng `mouse.wheel()` (sự kiện input tổng hợp thật, giống click) hoặc
   `scrollIntoViewIfNeeded()` khi lướt tới một phần tử cụ thể — không dùng
   `page.evaluate(() => scrollTo(...))`. Ba dạng:
   `{"scroll":"down"}` · `{"scroll":{"y":1200}}` · `{"scroll":{"to":{"role":"button","name":"..."}}}`.
   `reload` gọi `page.reload()` — hành động thật (giống người bấm F5), khác với `goto` lại cùng URL
   (không kích hoạt đúng vòng đời load); dùng để kiểm dữ liệu có còn bền sau khi tải lại trang hay không.
2. **Mỗi `shot` phải có ≥1 bước chứng minh** (`waitFor`/`expectText`/`expectVisible`/`expectUrl`/
   `expectUrlNot`) kể từ lần chụp trước. Thiếu ⇒ `FLOW_FAILED` và **ảnh không được tạo**. `settle` là
   chờ trơn, **không** tính là chứng minh.
3. **Flow phải có ≥1 tương tác.** Chỉ `goto` + `shot` ⇒ `FLOW_FAILED` với lý do "đây là smoke đội lốt
   luồng người dùng".
4. **Shot sau scroll phải có expectation sau lần scroll cuối.** Cuộn xong rồi chụp mà không chứng minh
   lại vị trí thì ảnh có thể đang chụp đúng vùng màn hình sai (cuộn hụt, cuộn quá, hoặc phần tử đích
   chưa kịp vào khung hình) — trông vẫn giống bằng chứng thật nhưng không chứng minh được gì. Chỉ
   `expectVisible` mới thoả — engine đòi đúng verb đó **và** xác nhận target thật sự nằm trong
   viewport; `waitFor` trơn không tính. Thiếu ⇒ `FLOW_FAILED`. Shot manifest ghi lại `scrollY`,
   target/method scroll, expectation và readiness của lần chụp đó — để người đọc đối chiếu ngược được
   ảnh với đúng trạng thái đã chứng minh, không chỉ tin vào tên file.

| Verdict flow | Exit | Nghĩa |
|---|---|---|
| `FLOW_VERIFIED` | 0 | Đi hết luồng, mọi ảnh đều đã chứng minh trạng thái |
| `FLOW_FAILED` | 3 | Một bước trượt, hoặc vi phạm ràng buộc 2/3/4. **Ảnh của lượt đó bị dồn sang `out/<flow>/REJECTED/` và đổi tên `REJECTED-*`** — để debug được mà không ai dán nhầm vào issue |
| `TARGET_UNREACHABLE` | 2 | Không port nào phục vụ app (đã dò 3000/3001/3002/5173/5174) |
| `BLOCKED` | 1 | Không có runner/browser |

Ngoài ảnh, mỗi lượt flow còn ghi **trace Playwright** (`trace.zip`, mở bằng `npx playwright show-trace`)
và **video** `.webm` — người review xem lại được cả đường đi, không chỉ tấm ảnh cuối.

**Selector — ưu tiên theo thứ tự**: `role` (accessibility tree, bền nhất) → `text` → `label` /
`placeholder` / `testId` → `css` (cửa thoát, bị đếm vào `escapeHatchSelectors` trong output để reviewer
thấy flow đang dựa vào cấu trúc DOM bao nhiêu).

**Secret trong flow**: đừng viết thẳng. Dùng `"${E2E_OWNER_EMAIL}"` — engine nội suy từ env/`.env.local`,
đánh dấu bước đó `valueMasked: true`, và **không bao giờ** đưa giá trị vào output.

**Đăng nhập**: `--login ui` đăng nhập qua form thật rồi cache `storageState` vào `.e2e/state/<role>.json`
(hạn 8h, hết hạn tự login lại). Đây là điểm khác `scripts/capture-evidence.mjs`: script đó signin qua API
rồi nhét token vào localStorage — hợp lệ để *tới* một màn hình, nhưng **không** chứng minh luồng đăng
nhập. Cần chứng minh luồng login thì dùng flow, đừng dùng đường token.

⚠️ `.e2e/state/*.json` **chứa session thật**. Nó nằm trong `.e2e/` nên đã được `.git/info/exclude` che,
nhưng đừng copy nó ra ngoài, đừng đính vào issue.

Chạy đủ bốn viewport bằng một lệnh (mỗi viewport là context mới và tự đi lại toàn bộ flow):

```bash
node "<workspace>/.e2e/flow.mjs" --flow <tên> --workspace "<workspace>" \
  --viewport all --evidence-root "<TaskFolder>"
```

Lệnh này tự gọi `bundle.mjs` sau khi 4/4 flow xanh.

### Bước 3c — Bundle local bắt buộc: `FEATURE.md` + manifest + checksum + ZIP

Nếu đã có evidence từ runner khác **và runner đó tạo `run.json` tương thích trong từng folder
viewport**, chạy bundle riêng:

```bash
node "<workspace>/.e2e/bundle.mjs" --evidence-dir "<TaskFolder>" \
  --feature "<tên tính năng>" --environment staging --route "/route"
```

Bundle chỉ PASS khi bốn folder viewport đều có PNG và `run.json` mang verdict `FLOW_VERIFIED`, với số
shot khớp số PNG. Nó viết `FEATURE.md`, `manifest.json`,
`SHA256SUMS.txt` vào TaskFolder và tạo `<TaskFolder>.zip` ở cạnh folder. Đây là đầu ra bàn giao cốt lõi;
không cần GitHub/OAuth và phù hợp user chỉ muốn chụp, lưu, nén rồi đọc mô tả tính năng.

### Bước 3d — Muốn ảnh có URL để dán vào issue/PR: `publish.mjs` (zip + GitHub Release)

Quyết định thiết kế: platform lưu evidence = **zip + GitHub Release assets**. Không dùng Google
Drive/Sheet — lý do đã cân nhắc: Drive/Sheet cần bạn tự làm OAuth consent trong browser trước (agent
không tự cấp quyền được), còn GitHub Release dùng đúng `gh` CLI đã login sẵn, không cần setup gì thêm.

⚠️ **Repo private ⇒ URL asset KHÔNG phải "ai có link đều mở được".** Đo thật trên một repo private:
`curl` ẩn danh (có/không kèm bearer token) vào `browser_download_url` → **404**; chỉ
`gh release download` hoặc `gh api -H "Accept: application/octet-stream" .../releases/assets/<id>`
(cùng phiên `gh` đã login) mới tải được. Trên thực tế URL vẫn mở được bình thường **trong tab browser
đã đăng nhập GitHub với quyền vào repo** (đúng cách hầu hết team đang mở link `user-attachments`) — chỉ
đừng kỳ vọng dán link đó cho người ngoài chưa có quyền truy cập repo, và đừng dùng `curl`/script không
auth để verify link "sống" (sẽ báo 404 giả, không phải link hỏng). Repo public thì URL mở tự do như bình
thường.

```bash
node "<workspace>/.e2e/publish.mjs" --evidence-dir "<folder chứa .png/.md vừa chụp>" \
  [--repo owner/name] [--tag qa-evidence-2026-Wxx] [--slug <ten>]
```

- **Đóng gói TRƯỚC, không tự chụp** — chạy sau `capture.mjs`/`flow.mjs`, nhận một folder đã có ảnh.
  Không có `.md` mô tả sẵn trong folder ⇒ tự sinh `MANIFEST.md` liệt kê file + số byte, rồi zip cùng ảnh.
  Cả manifest lẫn zip dựng trong **thư mục tạm hệ thống** — `--evidence-dir` KHÔNG bao giờ bị viết vào
  (không mutate folder US/evidence gốc trong vault).
- **Repo KHÔNG tự dò từ `--evidence-dir`** (đã sửa 2026-08-24 — xem `DESIGN.md` §12.4 để đọc lý do:
  evidence-dir thường là 1 folder trong Obsidian vault, và vault đó **là 1 git repo khác** có remote
  GitHub của riêng nó, hoàn toàn không liên quan repo app). Thứ tự resolve: `--repo` → field `repo` trong
  `.e2e/env.json` (do `e2e-provision.mjs` ghi từ chính workspace app lúc provision) → thiếu cả hai thì
  **FAIL rõ ràng**, không đoán.
- **`--tag` mặc định theo tuần ISO** (`qa-evidence-2026-W35`, tính từ giờ hệ thống) — tránh 1 release
  evergreen phình dần mãi. Muốn gom theo US thì truyền tag riêng (`--tag qa-evidence-US-093`).
- **Lọc file trước khi zip**: chỉ nhận đuôi evidence-like (`.png/.jpg/.md/.zip/.webm/...`), file khác đuôi
  bị loại và **báo rõ trong output** (`excluded: [...]`), không im lặng bỏ qua. File tên khớp pattern
  secret (`.env`, `token`, `credential`, `password`, `apikey`, `.pem`, `.key`...) làm **FAIL cứng toàn bộ
  lượt chạy** — không có cờ nào để bỏ qua cảnh báo này.
- **`--clobber` khi upload** — gọi lại nhiều lần (retry sau lỗi mạng) không bị lỗi "asset đã tồn tại". Zip
  tạm bị xoá sau khi upload thành công; giữ lại (kèm path trong lỗi) nếu upload thất bại để debug.
- In ra **1 dòng đầu `✅ Uploaded: <url>`** trước JSON đầy đủ — xem lý do ở mục "Tối ưu cho người vận
  hành qua Claude Code" ngay dưới.
- Không cài package mới: zip bằng `Compress-Archive` (Windows) hoặc `zip` (posix) — công cụ hệ thống có
  sẵn, không đụng `package.json`/lockfile của project.

### Bước 3d-bis — Ảnh render INLINE trong issue/PR body: `gh release upload` PNG trực tiếp

`publish.mjs` ở trên **zip** cả folder evidence lại — đúng cho mục đích bundle tải về, nhưng URL `.zip` đó
**KHÔNG** render thành `<img>` khi nhúng bằng markdown `![]()` (GitHub chỉ auto-render ảnh khi asset TỰ nó
là file ảnh). Khi mục tiêu là nhúng đúng 1 ảnh **inline vào body issue hoặc PR** (thay cho upload qua
browser), dùng trực tiếp `gh release upload` với file `.png` gốc, KHÔNG qua `publish.mjs`:

```bash
# 1) Tạo/dùng lại 1 GitHub Release làm nơi chứa asset (tag tuỳ ý)
gh release create <tag> --repo <owner>/<repo> --title "<tag>" --notes "Evidence assets" \
  || true   # bỏ qua lỗi nếu release đã tồn tại

# 2) Upload thẳng file .png (không zip) — --clobber để chạy lại không lỗi "asset đã tồn tại"
gh release upload <tag> "<path/to/screenshot.png>" --repo <owner>/<repo> --clobber

# 3) Lấy URL asset rồi nhúng bằng markdown image syntax vào body issue/PR
gh release view <tag> --repo <owner>/<repo> --json assets -q '.assets[].url'
# → https://github.com/<owner>/<repo>/releases/download/<tag>/<file>.png
# Nhúng: ![mô tả ngắn](https://github.com/<owner>/<repo>/releases/download/<tag>/<file>.png)
```

**Đã verify thật:** post 1 comment test chứa `![...](...png)` trỏ vào release asset, rồi đọc lại qua
`gh api .../issues/comments/<id> -H "Accept: application/vnd.github.html+json" -q '.body_html'` — GitHub
trả về đúng thẻ `<img src="..." style="max-width: 100%;">` bọc trong `<a>`, tức **render inline thật**,
không phải chỉ là link tải về. Toàn bộ quy trình chỉ dùng `gh` CLI đã login sẵn — **không cần browser,
không cần cookie, không cần đăng nhập lại**. Cùng caveat repo private như `publish.mjs` ở trên: chỉ người
xem đã đăng nhập GitHub với quyền vào repo mới thấy ảnh render — `curl` ẩn danh vẫn 404.

**Không dùng cho việc này (đã thử, KHÔNG hoạt động trong sandbox agent):** import cookie trình duyệt thật
(Edge/Chrome) vào một headless session rồi paste/upload ảnh qua trình duyệt — về lý thuyết đúng hướng
"Claude-in-Chrome", nhưng trong môi trường sandbox của agent thì bước decrypt cookie/khởi động server
trình duyệt headed **crash lặp lại**, và tiến trình đó **không giữ được sống giữa các lệnh riêng biệt**
của agent. Đừng đi hướng này để "tự động hoá upload ảnh GitHub" — dùng `gh release upload` ở trên, rẻ
hơn, không phụ thuộc trình duyệt, và đã verify hoạt động.

### Bước 3e — Test theo test case (Mode 2): `testcase-parse.mjs` + `testcase-report.mjs`

**Mode 1** (Bước 3b/3c/3d ở trên — chỉ chụp evidence theo 1 flow đã viết) **vẫn giữ nguyên, không đổi**. Mode 2 là một
lối đi THÊM VÀO, dùng khi có sẵn 1 danh sách test case (không phải flow JSON) và muốn biết case nào
PASS/FAIL, gom theo mức độ nghiêm trọng — mượn taxonomy 4×7 kiểu QA phổ biến
(`critical/high/medium/low` × `visual/functional/ux/content/performance/console/accessibility`), không
tự chế thang điểm mới.

**Định dạng file test case** — Markdown, KHÔNG phải flow JSON (để QA/PM viết được mà không cần biết cú
pháp kỹ thuật):

```markdown
# TC-001: Lưu cài đặt tài khoản thành công

- **Feature:** Dashboard Settings
- **Environment:** staging
- **Route:** /dashboard/settings
- **Severity nếu fail:** high
- **Category:** functional

| # | Bước | Kết quả mong đợi |
|---|------|-------------------|
| 1 | Vào trang cài đặt | Thấy tiêu đề "Cài đặt tài khoản" |
| 2 | Bấm nút "Lưu thay đổi" | Chữ "Đã lưu" hiện ra |
| 3 | Tải lại trang | Giá trị vừa lưu vẫn còn nguyên |
```

Quy trình 3 bước — **rigor của Mode 1 áp dụng y nguyên, không bị hạ chuẩn**:

1. **Parse (máy làm, xác định)**:
   ```bash
   node "<workspace>/.e2e/testcase-parse.mjs" --file "<test-case>.md"
   ```
   Chỉ đọc bảng + metadata ra JSON có cấu trúc — **không** đoán hành động, không chạy browser. Thiếu
   Severity/Category hoặc giá trị không khớp enum ⇒ dùng mặc định (`medium`/`functional`) kèm `warnings`,
   không hard-fail (đây là chất lượng report, không phải điều kiện chạy được). Không có bảng nào parse
   được ⇒ FAIL rõ ràng.
2. **Dịch (AGENT làm, đây là phần suy luận tự do DUY NHẤT trong luồng)**: đọc JSON ở bước 1, với MỖI dòng
   dịch `Bước` thành đúng 1 verb thật (`click`/`fill`/`scroll`/`reload`...) và `Kết quả mong đợi` thành
   đúng 1 bước chứng minh (`expectText`/`expectVisible`), viết ra 1 `flow.json` bình thường, rồi chạy qua
   **chính `flow.mjs` hiện có** — không có engine song song, không có đường tắt. Dòng nào dịch không ra
   (mơ hồ, không tìm thấy phần tử) ⇒ để nguyên cho `flow.mjs` FAIL tự nhiên, đừng tự chế 1 hành động đoán
   mò để "cho qua".
3. **Gom kết quả (máy làm, xác định)**:
   ```bash
   node "<workspace>/.e2e/flow.mjs" --flow <generated>.json --workspace "<workspace>" \
     --out "<out-dir>" > "<out-dir>/flow-output.json" 2>&1
   node "<workspace>/.e2e/testcase-report.mjs" --testcase <parsed-testcase.json> \
     --run "<out-dir>/flow-output.json" --results-file "<TaskFolder>/testcase-results.json" --render
   ```
   Verdict của từng test case = **verdict của `flow.mjs`**, không tự chấm lại. **`--run` phải trỏ tới
   TOÀN BỘ stdout của `flow.mjs` đã lưu ra file** (`> file.json`), không chỉ file audit riêng mà flow.mjs
   tự ghi khi PASS — vì file đó **không tồn tại** khi flow FAIL, và ghi nhận một test case FAIL bắt buộc
   phải đọc được từ stdout đã lưu. Chạy nhiều lần với nhiều test case sẽ **tích luỹ** vào cùng 1
   `--results-file` (cùng id thì cập nhật, khác id thì thêm). `--render` xuất `<results-file>.md`: tổng
   số pass/fail, bảng theo severity, bảng chi tiết sắp theo mức độ nghiêm trọng (case nghiêm trọng nhất
   luôn hiện trước).
4. **Đóng gói (tuỳ chọn)**: muốn zip lại kèm ảnh thì dùng cơ chế đóng gói evidence sẵn có trên folder của
   các test case đã chạy — cơ chế đó không cần biết gì về test case, chỉ thấy 1 folder ảnh như mọi khi.

Vì sao KHÔNG tính điểm 0-100 kiểu health score: điểm đó chỉ có ý nghĩa khi quét được TOÀN BỘ app; Mode 2
chỉ chạy đúng tập test case được đưa vào — tính điểm từ 1 tập con nhỏ sẽ là số bịa trông như số thật.

### Bước 3f — Log tổng hợp cho manager: `log-append.mjs`

`bundle.mjs` chỉ tạo `FEATURE.md`/`manifest.json` **trong evidence folder của riêng lượt đó**. Không ai
muốn mở N folder bundle khác nhau để biết feature nào vừa được test — cần 1 file duy nhất, mới → cũ,
manager đọc lướt là hiểu ngay. Chạy ngay sau `bundle.mjs` thành công:

```bash
node "<workspace>/.e2e/log-append.mjs" --evidence-dir "<TaskFolder>" [--token "<executor tự báo cáo>"]
```

- **Ghi vào đâu:** `<SKILL_ROOT>/log/LOG.md` — tức thư mục cài đặt của chính skill này — **KHÔNG** trong
  `workspace/.e2e/`. Lý do: evidence của một task nằm trong `.e2e/out/` của một worktree cụ thể, và
  worktree đó **sẽ bị xoá** (`git worktree remove`) — log phải sống ở một nơi bền, ngoài mọi worktree, để
  cộng dồn được qua nhiều task/nhiều lượt chạy khác nhau. `e2e-provision.mjs` ghi path này vào
  `.e2e/env.json` (field `skillLogRoot`) lúc provision; `log-append.mjs` tự đọc field đó — không cần
  truyền tay trừ khi muốn ép chỗ khác (`--log-dir`).
- **Ảnh thumbnail được COPY, không link.** Mỗi shot PNG được copy sang `log/thumbs/<feature>-<timestamp>/`
  cạnh `LOG.md` — độc lập hoàn toàn với `evidenceDir` gốc (sẽ mất khi worktree bị xoá). Không resize
  (tránh thêm dependency) — hiển thị nhỏ trong bảng qua chính khổ ảnh gốc, Markdown renderer nào hỗ trợ
  `![]()` trong bảng đều co giãn theo cột.
- **Định dạng entry, mới lên đầu file:**
  ```markdown
  ## <feature> - Aug 25 2026 - 3m12s / token: không đo được (main-loop không có tool đọc lại token)

  - Environment: dev
  - Route: /dashboard/settings
  - ZIP: `82366705 bytes`, SHA-256: `3385cf1c...`

  | Shot (click mở URL lúc chụp) | Desktop (1440x900) | Tablet Portrait (768x1024) | Tablet Landscape (1024x768) | Mobile (375x812) |
  |---|---|---|---|---|
  | **01-settings-page**<br>[https://app.example.com/dashboard/settings](https://app.example.com/dashboard/settings) | ![](thumbs/.../desktop--01-settings-page-desktop.png) | ... | ... | ... |
  ```
  Tên entry theo quy tắc: `"<tính năng> - <tháng ngày năm, ví dụ Aug 25 2026> - <tổng thời gian và token
  tiêu hao>"`. Cột **Shot** hiện tên (bold) rồi xuống dòng hiện **nguyên văn URL** đầy đủ ngay dưới tên —
  không giấu URL sau text label, để URL luôn nhìn thấy được ngay trong bảng. URL đó là `page.url()` đúng
  lúc chụp — `flow.mjs` ghi `url` vào mỗi shot (`shots.push({ label, url: page.url(), ... })`, rồi truyền
  tiếp qua `run.json`/`manifest.json`); flow cũ chưa có field này thì `log-append.mjs` in rõ `_(không ghi
  được URL — flow.mjs cũ, chạy lại)_` thay label, không suy đoán link. Header mỗi viewport ghi kèm kích
  thước thật theo đúng preset của `flow.mjs` (không tự chế số khác).
- **Thời gian: SỐ THẬT, không suy đoán.** Lấy từ tổng `elapsedMs` của 4 viewport trong `manifest.json`
  (chính là thời gian `flow.mjs` thực chạy) — không phải thời gian toàn phiên chat.
- **Token: KHÔNG BAO GIỜ bịa.** Một agent main-loop thường không có tool đọc lại tổng token của chính nó
  trong phiên đang chạy. Mặc định ghi `không đo được (...)`; chỉ có số thật khi truyền `--token` với số
  do executor khác (chạy tách biệt, tự báo cáo usage của chính nó) cung cấp.
- Không có shot nào đọc được trên đĩa (bundle rỗng/hỏng) ⇒ FAIL rõ, không ghi entry rác vào log.
- **Bền qua worktree, KHÔNG đồng bộ qua máy khác — quyết định thiết kế, không phải bug.** Đo thật bằng 2
  worktree khác nhau trên CÙNG máy: cả hai cùng ghi đúng vào 1 `LOG.md` (verify qua `skillLogRoot` trong
  `env.json` của từng worktree). Nhưng `SKILL_ROOT` tính từ vị trí file `e2e-provision.mjs` **đang chạy
  trên chính máy đó** — một máy khác dù cũng cài skill này giống vậy thì vẫn ra một `log/` cục bộ, hoàn
  toàn riêng, không tự thấy entry của máy khác. `log/` của skill hiện **untracked trong git** (không có
  trong `.gitignore`, chỉ chưa từng commit) — mỗi máy tự cộng dồn log riêng của nó theo đúng thiết kế: ưu
  tiên đơn giản (không cần đồng bộ mạng/conflict resolution) hơn là một log tập trung. Muốn đổi hướng này
  thì đây là chỗ sửa (track `log/` vào git + tự commit/push/pull trong `log-append.mjs`, hoặc chỉ sync
  `LOG.md` không kèm `thumbs/`).
- **Máy/sandbox không có bản cài của skill này (executor chạy remote, khác máy với người đã chạy
  `e2e-provision.mjs`) ⇒ `log-append.mjs` FAIL rõ, không tạo log rác, không throw stacktrace thô.**
  `skillLogRoot` trong `.e2e/env.json` là 1 path TUYỆT ĐỐI trên máy đã chạy provision — nó chỉ có nghĩa
  khi `log-append.mjs` cũng chạy trên chính máy đó. Chạy ở máy/sandbox khác (path đó không tồn tại/không
  ghi được ở đây) ⇒ `mkdirSync` bị bắt lỗi và báo rõ: dùng `--log-dir <path ghi được trên chính máy này>`,
  hoặc bỏ hẳn bước `log-append.mjs` — `bundle.mjs` (Bước 3c) vẫn đủ `FEATURE.md`/`manifest.json`/ZIP mà
  không cần log tổng hợp. Executor không tự "sáng tác" 1 `--log-dir` cho qua; hỏi lại bên gọi nếu cần log
  tổng hợp thật cho lượt chạy remote đó.

## Tối ưu cho người vận hành qua Claude Code (persona: low-tech, Claude Code là nền tảng chính)

Ghi chú thiết kế 2026-08-24: người dùng thật của skill này trong phần lớn trường hợp **không tự tay gõ
lệnh** — họ ra yêu cầu bằng tiếng Việt tự nhiên, Claude Code là bên gọi `bin/*.mjs`/`e2e-kit/*.mjs` và
đọc output thay họ. "Hiệu suất" ở đây không chỉ là tốc độ chạy, mà là **số lượt hỏi lại + số token
Claude Code phải đọc để relay đúng cho user**. Áp các nguyên tắc sau khi mở rộng skill này:

1. **Một lệnh, một dòng trả lời.** Mọi script phải in đúng 1 dòng tóm tắt Ở ĐẦU output (`✅ Uploaded: …`,
   `E2E READY — …`) trước khi in JSON/markdown chi tiết. Claude Code relay được ngay dòng đầu cho user
   mà không cần đọc hết JSON — giảm token đọc ngược, đúng nguyên tắc "Kỷ luật token" của `/dispatch`.
2. **Config một lần, đừng hỏi lại mỗi lượt.** Platform lưu ảnh (zip+GitHub) và target mặc định
   (staging) đã chốt — script tự dùng default đó, không hỏi user chọn lại. Chỉ hỏi khi thật sự có
   quyết định mới cần user (đổi platform, đổi repo).
3. **Không thêm bước thủ công mới.** `publish.mjs` là một lệnh độc lập THÊM VÀO SAU capture, không bắt
   sửa lại `capture.mjs`/`flow.mjs` — Claude Code chỉ cần nhớ thêm đúng 1 lệnh, không phải học lại quy
   trình.
4. **Lỗi phải actionable, không phải stacktrace thô.** Mọi `fail()` phải kèm lệnh cụ thể để sửa (theo
   đúng convention ladder đã có ở `resolve.mjs`) — vì Claude Code sẽ dán nguyên văn lỗi đó cho user, lỗi
   mơ hồ thì user cũng không đoán được phải làm gì tiếp.
5. **Idempotent khi bị gọi lại.** Claude Code có thể retry sau lỗi mạng/timeout — `--clobber` khi upload
   + tên file có timestamp để hai lượt liên tiếp không đè nhầm ảnh của nhau.
6. **Báo cáo ngắn, không tạo thêm file rời khó tìm.** Kết quả publish nằm trong đúng JSON trả về của
   chính lệnh đó — không ghi thêm file `.log`/`.json` mới vào `.e2e/` mà không có lý do, tránh phình số
   file Claude Code phải quét khi tổng hợp báo cáo.

### Môi trường — default là staging, đổi bằng `--env`

`E2E_TARGET` trong `.env.local` là default (**hiện tại: `staging`**). Đổi cho **một lượt** bằng `--env`,
áp cho mọi entry point:

```bash
node .../e2e-provision.mjs "<ws>" --env dev
node "<ws>/.e2e/flow.mjs" --flow <ten> --env dev
```

`--env` thắng `E2E_TARGET`, và nó chọn **cùng lúc ba thứ**: bộ credential (`E2E_<ENV>_<ROLE>_*`), base URL
(`E2E_<ENV>_BASE_URL`), và API base kỳ vọng (`E2E_<ENV>_API_BASE`).

**Một số project phân biệt môi trường bằng *build mode*, không bằng host** — ví dụ `pnpm dev` và
`pnpm dev:staging` cùng chạy `localhost:3000` nhưng trỏ hai API khác nhau. Nếu project của bạn cũng vậy,
hệ quả là **ảnh chụp hai môi trường trông y hệt nhau**, nên khớp đúng API host mới là bằng chứng đáng
tin, không phải chỉ nhìn URL trình duyệt. Vì vậy:

- Probe/report luôn in **đúng lệnh khởi động** cho môi trường đang nhắm (`pnpm dev:staging` khi
  `E2E_TARGET=staging`). Không có script `dev:<env>` riêng thì nó cảnh báo là `pnpm dev` có thể trỏ API khác.
- Mỗi lượt smoke/flow **quan sát host API mà trang thật sự gọi** rồi đối chiếu với `E2E_<ENV>_API_BASE`:

| Kết quả | Nghĩa | Hệ quả |
|---|---|---|
| `apiHostVerified: true` | trang gọi đúng API của môi trường đang nhắm | bằng chứng dùng được |
| `apiHostMismatch: true` | trang gọi API **cùng họ domain nhưng khác host** ⇒ chắc chắn sai môi trường | flow → `ENV_MISMATCH` (exit 4), ảnh bị cách ly; provision → `PARTIAL` |
| cả hai `false` + `envNote` | lượt đó trang không gọi API app nào ⇒ **không xác nhận được** | không kết luận sai; đọc `envNote` rồi tự quyết |

Chỉ so trong **cùng họ domain** của API mong đợi. Host thứ ba (stripe, analytics, font) không nói gì về
môi trường — tính chúng vào là kết luận sai, và đó là lỗi đã bị bắt trong lúc test.

### Chưa biết chụp ở đâu — hỏi trước khi chạy (Yêu cầu mơ hồ)

Khi user chỉ chat ngắn gọn như "chụp hình", "chụp màn hình", "chạy e2e" mà không chỉ rõ URL, route hay môi trường:

Agent **PHẢI hỏi user** để xác định phạm vi chụp thay vì tự ý chọn ngầm, đưa ra các options:
1. **Qua URL cụ thể** (ví dụ: `https://staging.example.com/dashboard/settings`...)
2. **Qua môi trường**: Staging, Dev/Test, hoặc Production
3. **Qua file HTML** có đường dẫn cụ thể trên máy
4. **Mặc định web đang chạy trên máy** (dev server `localhost:3000` / `pnpm dev`)

### Chưa có `.env.local` hoặc thiếu đúng role cần dùng — HỎI NGAY, đừng bảo user tự tạo file

**Quy tắc cứng:** khi probe/provision báo thiếu credential cho role mà task đang cần, agent **PHẢI tự
động hỏi ngay trong câu trả lời** ("cần tài khoản test role X trên môi trường Y — cho tôi email +
password") **rồi tự ghi file khi user trả lời** — **KHÔNG BAO GIỜ** trả lời kiểu "bạn hãy tự mở
`.env.local` và điền vào". Người vận hành qua 1 coding agent không tự sửa file được (đó là toàn bộ lý do
skill này tồn tại) — bảo họ tự làm là đẩy việc ngược lại đúng chỗ skill phải gánh.

```bash
echo '{"email":"<email user vừa gửi>","password":"<password user vừa gửi>"}' | \
  node "<workspace>/.e2e/env-writer.mjs" --role owner [--env dev|staging] --workspace "<workspace>"
```

- **Hỏi qua text thường trong câu trả lời, KHÔNG dùng công cụ hỏi trắc nghiệm** — đây là nhập liệu tự do
  có secret, không phải chọn 1 trong N lựa chọn.
- **Đọc credential từ STDIN, không qua argv** — tránh lộ password qua process list/Task Manager. Agent
  tự ghép JSON từ câu trả lời của user rồi pipe vào lệnh trên, không gõ password thành một `--flag`.
- Script **idempotent**: role đã có thì cập nhật đúng 2 dòng, không tạo bản trùng; role khác giữ nguyên.
  Ghi vào `.env.local` của **repo gốc** (tự suy ra, kể cả khi bạn đang gọi từ worktree) — khớp đúng nơi
  mọi script khác trong kit đọc, không tạo file cấu hình thứ hai lạc chỗ.
- **Không bao giờ in giá trị password ra output hoặc echo lại cho user để "xác nhận".** Xác nhận bằng
  cách nói tên biến đã ghi (`✅ Đã thêm E2E_DEV_OWNER_EMAIL + E2E_DEV_OWNER_PASSWORD`), không lặp giá trị.
- **Nhắc lại đúng 1 lần**: chỉ tài khoản test trên dev/staging, không bao giờ tài khoản merchant/nhân
  viên thật — quy tắc này không đổi dù việc tạo file giờ tự động.
- Sau khi ghi xong: chạy lại `e2e-probe.mjs` để xác nhận role đã "dùng được", rồi **tiếp tục ngay** task
  gốc — không cần thêm lượt hỏi "có muốn tiếp tục không".

### Tài khoản cho automation — khai ở `.env.local` của repo gốc

Mẫu đầy đủ: `e2e-kit/env.local.example`. Ba điều cần biết:

**Role là tự do.** Thêm một role mới (`manager`, `customer`, `cashier`…) chỉ là thêm 2 dòng vào
`.env.local`, không sửa file nào trong kit. Gọi bằng `--role <tên>`.

**Có trục môi trường.** Đặt `E2E_TARGET=dev` thì kit ưu tiên nhóm `E2E_DEV_*`, không có thì rơi về dạng
phẳng `E2E_<ROLE>_*`:

| Dạng | Khi nào dùng |
|---|---|
| `E2E_<ROLE>_EMAIL` / `_PASSWORD` | tài khoản dùng chung mọi môi trường |
| `E2E_<ENV>_<ROLE>_EMAIL` / `_PASSWORD` | tài khoản riêng cho dev / staging / test |

`E2E_TARGET` + `E2E_<ENV>_BASE_URL` còn được dùng làm target mặc định khi không truyền `--target` — tức
`.env.local` là nguồn sự thật, không phải cờ dòng lệnh.

**Chỉ khai ở repo gốc là đủ.** Worktree không có `.env.local` (git worktree không mang file bị ignore),
nhưng kit đọc `.env.local` của repo gốc theo path tuyệt đối.

Kiểm sau khi sửa — probe in **tên** biến chứ không in giá trị:

```bash
node "${SKILL_DIR}/bin/e2e-probe.mjs" "<repo>"
```

Đọc dòng `role dùng được` và bảng tài khoản. Ba nhãn cần chú ý:

- `THIẾU NỬA` — khai email mà quên password (hoặc ngược lại). Đây là lỗi hay gặp nhất, và role đó **không
  dùng được**.
- `không khớp E2E_TARGET` — cặp biến đầy đủ nhưng thuộc môi trường khác cái đang nhắm ⇒ **không script nào
  đọc tới**. Đổi `E2E_TARGET` hoặc chấp nhận nó nằm im.
- `(phẳng)` — dùng được ở mọi `E2E_TARGET`.

**An toàn, không thoả hiệp:** chỉ tài khoản test trên dev/staging, không bao giờ tài khoản merchant thật.
`resolve.mjs` (dùng cho probe/report) **chỉ đọc tên biến**, không đọc giá trị — trừ whitelist tường minh
không phải secret (`E2E_TARGET`, `E2E_API_BASE`, `E2E_*_BASE_URL`). Chỉ `flow.mjs` đọc *giá trị*, và chỉ
để đưa vào `locator.fill()`; bước đó bị đánh dấu `valueMasked: true` và báo cáo chỉ ghi **tên** biến đã
dùng (`usedVars`).

### Bước 4 — Giao công cụ kèm khi đòi ảnh

Copy nguyên khối `<e2e_capability>` trong `<workspace>/.e2e/PROMPT-BLOCK.md` vào prompt executor. Khối
đó đã chứa: path tuyệt đối, lệnh chạy sẵn, đoạn "bạn ĐƯỢC PHÉP chạy browser", luật bằng chứng, và ghi
chú riêng theo host.

**Verdict ≠ `READY` ⇒ cấm viết yêu cầu ảnh vào prompt.** Đòi artifact mà không giao được cơ chế tạo ra nó
thì executor sẽ hoặc bịa, hoặc từ chối — cả hai đều tốn một vòng.

## Luật cứng

- **Không in `READY` mà không dán stdout của smoke + số byte vừa `stat`.** Verdict là output máy, không
  phải lời khai. Skill tự hạ `READY` xuống `PARTIAL` khi smoke exit 0 mà PNG không đọc được.
- **Chỉ ghi trong `<workspace>/.e2e/`** (+ một dòng `.e2e/` trong `.git/info/exclude`). Không sửa
  `package.json`, không sửa `.gitignore`, không cài package vào project.
- **Không bao giờ ghi giá trị secret.** `.e2e/env.json` chỉ chứa tên biến và trạng thái có/thiếu.
- **Thiếu browser ⇒ đề xuất `npx playwright install chromium`, không đề xuất `pnpm add`.** Lệnh đó ghi
  vào cache máy chứ không vào project nên không phạm `no dependency changes`. Dưới sandbox mặc định của
  Codex thì nó vẫn không chạy được (cần network + ghi ngoài workspace) — khi đó `BLOCKED` là đúng.
- **`.e2e/` không phải rác cần dọn.** Nó đã untracked qua `info/exclude`; executor đừng xoá.
- **Chụp trúng màn login mà flow không cố ý ⇒ luôn FAIL, không bao giờ PASS.** Ca thật đã gặp: route đích
  cần đăng nhập, flow không dùng `"login": "ui"` (hoặc thiếu credential), app redirect về `/login`, một
  `expectVisible` chung chung (vd `body`, logo/header xuất hiện ở cả 2 trang) vẫn "đạt" ⇒ ảnh /login được
  lưu và báo `FLOW_VERIFIED` như thể đã chụp đúng màn. Engine tự so `page.url()` với `route` trong
  `login.json` ngay tại mỗi `shot` — khớp thì FAIL cứng kèm lý do actionable (thiếu `"login": "ui"` hay
  thiếu credential), bất kể proof step trước đó có "đạt" hay không. **Agent đọc được lỗi này thì dừng lại
  hỏi user credential/role, KHÔNG tự chụp màn login rồi báo hoàn thành.** Flow nào cố ý chụp chính màn
  login (vd bài tự-kiểm `login-form-interaction.json`) phải khai `"allowLoginRoute": true` ở flow-level
  hoặc step-level để tắt guard này.
- **Bốn viewport chuẩn, mỗi viewport là một browser context mới.** Desktop `1440x900` (DSF 1); tablet
  portrait `768x1024`, tablet landscape `1024x768`, mobile `375x812` (ba loại sau DSF 2, `isMobile:true`,
  `hasTouch:true`). Không tái dùng business state (session/giỏ hàng/form đang điền...) từ viewport trước
  — mỗi viewport phải tự đi lại toàn bộ flow từ đầu. Mobile/tablet phải đi đủ sub-screen/tab tương đương
  desktop — không dừng ở màn hình đầu rồi coi là xong; runner không ép một layout cụ thể nào, để mỗi
  breakpoint tự quyết định layout thật của nó.

## Cấu trúc

```
e2e-setup/
  SKILL.md                    # file này
  DESIGN.md                   # spec + đối chiếu tham chiếu ngoài + acceptance
  bin/e2e-probe.mjs           # Pha 1 — read-only, luôn exit 0
  bin/e2e-provision.mjs       # Pha 2 + 3 — rải kit rồi chạy cổng smoke
  log/                        # KHÔNG copy vào workspace — sống cố định ở đây, bền qua mọi task
    LOG.md                    # log tổng hợp, mới → cũ, do log-append.mjs ghi (Bước 3f)
    thumbs/<feature>-<ts>/    # bản copy PNG bền, độc lập với evidenceDir gốc
  e2e-kit/
    resolve.mjs               # nguồn DUY NHẤT của logic dò
    readiness.mjs             # gate network/loader/font/image dùng chung, không mutate UI
    smoke.mjs                 # cổng NĂNG LỰC: launch → goto → PNG → JSON → exit code
    flow.mjs                  # cổng LUỒNG: chuỗi bước người-thật, 4 ràng buộc cưỡng chế
    capture.mjs               # uỷ quyền capture-evidence.mjs khi có; không thì tự chụp
    bundle.mjs                # bundle local bắt buộc: FEATURE + manifest + checksum + ZIP
    log-append.mjs             # ghi 1 entry lên đầu log/LOG.md (bền, ngoài workspace) — Bước 3f
    publish.mjs               # đóng gói .png/.md thành .zip + upload GitHub Release, trả URL
    env-writer.mjs             # ghi credential (hỏi trong chat, KHÔNG bảo user tự tạo file) vào .env.local
    testcase-parse.mjs         # Mode 2: đọc file test case (.md, KHÔNG phải flow JSON) ra JSON có cấu trúc
    testcase-report.mjs        # Mode 2: gom verdict test case (= verdict flow.mjs) theo severity/category
    login.json                # cấu hình form login (file DUY NHẤT phụ thuộc repo cụ thể)
    flows/_TEMPLATE.json      # mẫu flow, tài liệu inline
    flows/login-form-interaction.json   # bài tự-kiểm engine: không cần credential, không side effect
    flows/login-owner.json    # đăng nhập thật qua UI, secret lấy qua nội suy
    hosts/{codex,antigravity,claude}.md
    PROMPT-BLOCK.tmpl.md
```

Sửa `flow.mjs` thì chạy lại bài tự-kiểm trước khi coi là xong:

```bash
node "<workspace>/.e2e/flow.mjs" --flow login-form-interaction
```

Logic dò nằm **một chỗ** (`resolve.mjs`) và cả hai binary lẫn hai script trong kit đều gọi vào đó. Sửa
luật dò thì sửa đúng một file — đừng thêm bản sao thứ hai ở chỗ khác.

## Ladder (tham khảo nhanh)

| Bậc | Kiểm | Ghi chú |
|---|---|---|
| 1 | `scripts/capture-evidence.mjs` của workspace (đổi tên khác thì set env `E2E_CAPTURE_SCRIPT=<path>`) | có ⇒ `capture.mjs` **uỷ quyền** cho nó, giữ nguyên naming convention/auth flow riêng của script đó |
| 2 | `<ws>/node_modules/{playwright,playwright-core,puppeteer,cypress}` | |
| 3 | `node_modules` **repo gốc** theo path tuyệt đối | bậc quyết định cho worktree; thiếu bậc này là nguồn của mọi BLOCKED giả |
| 4 | `PLAYWRIGHT_BROWSERS_PATH`, `%LOCALAPPDATA%\ms-playwright`, `~/.cache/ms-playwright` | rev cao nhất; `chromium_headless_shell-*` trước `chromium-*` |
| 5 | Chrome/Edge đã cài | |
| 6 | `@playwright/mcp` | tuỳ chọn, chỉ host có MCP; subagent `nx-*` chỉ có Bash nên không dùng được |

`chrome-headless-shell` **không chạy headed**. Skill đánh dấu `supportsHeaded: false`; cần chụp headed
thì phải rơi xuống `chromium-*` hoặc channel.

## Liên quan

- Rule "được phép chạy browser + bằng chứng là gì" (xem đoạn mở đầu file này) — nơi bạn lưu rule đó
  (repo rule file, `AGENTS.md`, wiki nội bộ...) nên trỏ tới skill này ở đúng vị trí "có công cụ hay
  không, và chứng minh bằng máy" trong quy trình của bạn.
- Nếu bạn có một skill/quy trình điều phối nhiều agent (kiểu `/dispatch`): gọi skill này ngay sau khi tạo
  worktree cho executor và trước khi viết yêu cầu "chụp ảnh" vào prompt.
- Nếu bạn có một skill viết test cho feature đã sửa: chạy skill đó **sau** skill này (khác vai — skill
  này chỉ lo năng lực chạy, không viết test).

## Ranh giới hai cổng — đừng lẫn

| | `smoke.mjs` | `flow.mjs` |
|---|---|---|
| Trả lời câu | "máy này chạy được browser không?" | "đi hết luồng người dùng được không?" |
| Tới được trạng thái sau khi bấm | **không** | có |
| Dùng để tick Visual DoD | **không** | có |
| Chi phí | ~4s | tuỳ luồng |

Provision chạy `smoke` tự động vì đó là cổng rẻ và phải luôn xanh. `flow` do người viết flow gọi — skill
không tự đoán luồng nghiệp vụ của anh.
