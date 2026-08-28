<!--
  PROMPT-BLOCK.tmpl.md — mẫu đoạn NHÚNG VÀO PROMPT EXECUTOR.
  e2e-provision.mjs điền placeholder rồi ghi ra <workspace>/.e2e/PROMPT-BLOCK.md.
  Dispatcher copy nguyên khối `<e2e_capability>` dưới đây vào prompt Codex/Gemini.
-->

# PROMPT BLOCK — verdict `{{VERDICT}}`

> Sinh lúc {{GENERATED_AT}} cho `{{FOR}}`. Copy nguyên khối bên dưới vào prompt executor.
> Verdict **không phải `READY`** ⇒ **không được** viết yêu cầu ảnh/số đo runtime vào prompt
> (`evidence-discipline.mdc` §3: cấm đòi artifact mà không giao cơ chế tạo ra artifact đó).

```text
<e2e_capability verdict="{{VERDICT}}">
Workspace của bạn ĐÃ ĐƯỢC dựng sẵn năng lực chạy browser. Đã kiểm bằng máy, không phải phỏng đoán.

  workspace      : {{WORKSPACE}}   ({{WORKSPACE_KIND}})
  target          : {{TARGET_KIND}} → {{TARGET_URL}}
  runner          : {{RUNNER}}
                    ({{RUNNER_BORROWED}})
  browser         : {{BROWSER}}
  chụp headed     : {{BROWSER_HEADED}}
  capture script  : {{CAPTURE_SCRIPT}}
  secrets thiếu   : {{SECRETS_MISSING}}

BẠN ĐƯỢC PHÉP chạy browser headless. "No dependency changes" chỉ cấm sửa package.json/lockfile —
không cấm dùng runner đã cài, viết script tạm, hay chạy browser.

Cổng tự kiểm (chạy trước khi báo xong, dán nguyên văn output vào báo cáo):

  {{SMOKE_CMD}}

Chụp first view tĩnh (chỉ là ảnh định hướng/smoke, KHÔNG được kết luận feature tương tác PASS):

  {{CAPTURE_CMD}}

Chụp trạng thái CHỈ TỒN TẠI SAU KHI BẤM — phải đi bằng flow. Lệnh dưới tự chạy lại toàn bộ flow
trong context mới trên 4 viewport, lưu đúng cây thư mục, rồi tạo FEATURE.md + manifest + checksum + ZIP:

  node "{{FLOW_SCRIPT}}" --flow <ten> --workspace "{{WORKSPACE}}" --viewport all --evidence-root "<TaskFolder>"

Bundle local ở trên là BẮT BUỘC và đủ để bàn giao. GitHub Release chỉ là bước publish TÙY CHỌN khi
user cần URL cho team đã đăng nhập GitHub:

  {{PUBLISH_CMD}}

In ra 1 dòng `✅ Uploaded: <url>` — dán nguyên dòng đó vào báo cáo cùng với ảnh. Không tự nghĩ ra
platform khác (Drive/Imgur/...); zip + GitHub Release là quyết định đã chốt.

Repo private ⇒ URL đó KHÔNG mở được bằng `curl` ẩn danh (404 giả, không phải link hỏng) — chỉ mở được
trong browser đã login GitHub có quyền vào repo, hoặc qua `gh release download`/`gh api ... Accept:
application/octet-stream`. Đừng tự ý coi 404 từ curl là publish thất bại.

Flow là file JSON trong {{FLOWS_DIR}} (mẫu `_TEMPLATE.json`; bài tự-kiểm `login-form-interaction`).
Engine CƯỠNG CHẾ bốn điều, không phải khuyên:
  1. chỉ có verb tương tác thật (click/fill/select/press/scroll/reload) — không có cửa nào để inject state;
  2. mọi `shot` phải có bước chứng minh (waitFor/expect*) kể từ lần chụp trước, thiếu thì KHÔNG ra ảnh;
  3. flow phải có >=1 tương tác — chỉ goto+shot thì bị báo là smoke đội lốt luồng người dùng.
  4. ảnh sau scroll phải có expectVisible (bounding box giao viewport thật) sau lần scroll cuối; manifest ghi scrollY, target
     và expectation để reviewer biết phần tử thật sự đã được đưa vào viewport trước khi click/chụp.
Flow trượt => ảnh của lượt đó bị dồn sang out/<flow>/REJECTED/ — ĐỪNG dùng chúng làm bằng chứng.
Mỗi lượt flow còn ghi trace.zip + video .webm — nộp kèm khi báo cáo.

Secret trong flow: dùng dạng nội suy ${TEN_BIEN}, KHÔNG viết giá trị thật vào file flow.

Target là dev server thì khởi động trước: {{DEV_COMMAND}}

Thiếu credential cho role cần dùng (`secrets thiếu` ở trên có tên) ⇒ **HỎI NGAY trong câu trả lời của
bạn** ("cần tài khoản test role X, cho tôi email + password") — **ĐỪNG** báo lại cho người điều phối là
"thiếu secret" rồi dừng. Nhận được câu trả lời thì tự ghi bằng lệnh dưới (đọc secret qua STDIN, không
qua argv), rồi chạy lại probe để xác nhận, rồi tiếp tục ngay, không hỏi thêm:

```bash
echo '{"email":"<email>","password":"<password>"}' | node "{{WORKSPACE}}/.e2e/env-writer.mjs" --role <role> --workspace "{{WORKSPACE}}"
```

Không bao giờ echo lại giá trị password trong báo cáo — chỉ nói tên biến đã ghi.

Luật bằng chứng, không có ngoại lệ:
- Bằng chứng = output máy do CHÍNH lượt chạy này sinh ra, dán nguyên văn, kèm lệnh và exit code.
- verdict "{{VERDICT}}" ở trên nói về NĂNG LỰC (mở được browser), KHÔNG phải đã verify luồng nào.
- KHÔNG tính là bằng chứng: "đã kiểm tra, hiển thị ổn" · kích thước/hash ảnh · `pnpm build` xanh ·
  đọc code rồi suy ra UI trông thế nào.
- Inject state hoặc sửa DOM/CSS qua page.evaluate/inline style/script KHÔNG phải E2E. Phải drive bằng
  click/fill/scroll/điều hướng route thật. Read-only metrics như scrollY được phép ghi vào manifest.
  Không drive được ⇒ báo BLOCKED, nói rõ chặn ở bước nào — BLOCKED trung thực > xong bằng chứng rỗng.
- Mọi con số bạn viết (byte, số ảnh, rect) phải là số vừa đọc từ đĩa trong lượt này. Người verify
  sẽ stat lại; lệch số là cả báo cáo bị trả lại.
- Vị trí lưu & Clickable link: tự suy ra folder từ US/task/vault khi context đã có. Chỉ hỏi khi không
  suy ra được hoặc lựa chọn vị trí làm thay đổi phạm vi bàn giao; không hỏi lại quyết định đã có.
  Khi lưu file (kể cả mặc định), BẮT BUỘC trả clickable link Markdown `[tên_file.png](file:///C:/path/to/file.png)`
  để click mở được ngay trong browser / app.
- Chuẩn Viewport: Desktop 1440x900, Tablet gồm Portrait 768x1024 & Landscape 1024x768 (scale 2), Mobile tối thiểu 375x812 (scale 2).
  Trên Mobile & Tablet: BẮT BUỘC chụp đầy đủ các sub-screens / tabs con, không chỉ dừng ở menu ngoài.
- Kiểm tra Network & Data Loaded: readiness gate phải báo rõ networkidle timeout, loader thật
  (spinner/progressbar/skeleton/aria-busy), font và image settling; cấm catch rồi bỏ qua timeout.
- Tổ chức thư mục lưu: BẮT BUỘC theo cấu trúc TaskFolder -> `desktop/`, `tablet/` (`landscape/`, `portrait/`), `mobile/`.
- Navbar/sidebar phải phản ánh UI thật. Nếu fixed element sai trong ảnh thì báo bug sản phẩm hoặc chụp
  viewport/segment phù hợp; tuyệt đối không sửa CSS của trang trước khi chụp.
- Bàn giao sạch: xoá script tạm, chạy `git status --short`, dán nguyên văn. Thư mục `.e2e/` đã được
  đăng ký trong .git/info/exclude nên không hiện trong git status — ĐỪNG xoá nó.

{{HOST_NOTES}}
</e2e_capability>
```
