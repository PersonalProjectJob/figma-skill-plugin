# Brief cho người viết case study (phần 3)

> **Đọc file này trước khi viết một chữ nào.** Đây là nguồn dữ kiện + ràng buộc, không phải bản nháp case study. Không tự thêm số liệu, không tự thêm tên riêng.
>
> Artifact đã vô danh hoá nằm ở `../skills/` và `../agent-rules/`. Đọc `../README.md` để có bối cảnh, `../NOTICE.md` để biết giới hạn công bố.

## 1. Đề bài

Viết case study kỹ thuật về **hệ thống điều phối nhiều AI coding agent bằng file**. Người đọc mục tiêu: engineer/tech lead đang dùng AI agent hằng ngày và bắt đầu đụng các vấn đề của quy mô (nhiều agent, nhiều phiên, context tràn, agent báo sai).

Góc kể nên chọn: **"tôi đã đụng những cái bẫy này, đây là cách tôi cấu trúc lại"**. Không phải góc "AI thay đổi mọi thứ", không phải góc bán công cụ.

Tiêu chí thành công: người đọc lấy được **ít nhất một nguyên tắc áp dụng ngay** vào setup của họ, dù họ không dùng cùng bộ công cụ.

## 2. Dữ kiện đếm được (được phép dùng, KHÔNG được làm tròn lên)

| Dữ kiện | Giá trị | Nguồn kiểm chứng |
|---|---|---|
| Tổng dung lượng quy tắc | 1615 dòng (markdown + 2 script cổng), 0 dependency | `wc -l` trên package |
| Skill điều phối | 523 dòng, workflow 8 bước (Bước 0 → 8) | `skills/dispatch/SKILL.md` |
| Router index (luôn nạp) | 64 dòng, 8 dòng routing + 12 invariant | `agent-rules/.agent-rules` |
| Rule chi tiết (nạp theo yêu cầu) | 6 file, 22–152 dòng | `agent-rules/.agent-rules.d/` |
| Định nghĩa vai (cổng cứng) | 5 vai, 214 dòng; 4/5 vai không có tool ghi | `agents/`, `scripts/check-agents.mjs` |
| Số executor được điều phối | 3 (Claude / Codex / Gemini) | Bước 2b |
| Số cổng chặn | 2 gate quyết định (GATE 0 no-go, GATE 0b review) + 2 cổng chạy được (`scrub-check.sh`, `check-agents.mjs`) | Bước 2b, `scripts/` |
| Số lần báo cáo "đã xong" hoá ra bịa | 4 ca, 2 executor khác nhau (không phải một model cá biệt) | mục 4 |
| Nhịp iterate của skill | 5 version trong 6 ngày (23–28/07/2026) | git tag v1.18.0 → v1.21.1 |
| Quy mô đã chạy qua quy trình | 88 spec folder trải 8 sprint | vault |

**Không được viết**: bất kỳ % năng suất, "tiết kiệm X giờ", "nhanh hơn Y lần", số bug giảm, hay so sánh với "cách làm cũ" — chưa hề đo. Nếu cần một câu về hiệu quả, hãy dùng dữ kiện định tính có thật: *"đủ để chạy 3 agent song song trên cùng repo mà không có lần merge nào mất việc"*.

## 3. Mười hai nguyên tắc — cái đáng bán

Mỗi cái nên kể theo cấu trúc **cái bẫy cụ thể → tại sao nó xảy ra → quy tắc đối phó**. Bảng tóm tắt trong `../README.md`; phần "vì sao" chi tiết ở đây:

1. **Router pattern.** Rule đầy đủ nạp mọi session thì ăn hết ngân sách context trước khi làm việc gì. Tách: index ngắn luôn nạp (chỉ có bảng routing + invariant), rule chi tiết nạp khi task khớp. Index nói rõ *"đây là router, KHÔNG được hành động chỉ dựa vào file này"* — nếu không, agent sẽ tự tin làm sai bằng bản tóm tắt.

2. **Rule phải tới được tay executor.** File rule nằm trong `.gitignore` (vì chứa path máy). `git worktree add` không mang theo file gitignored. Kết quả: agent chạy trong worktree không thấy rule nào, làm theo mặc định của nó, rồi báo "done" — sai quy ước mà build vẫn xanh. Fix: bước tạo worktree phải copy rule vào, và prompt giao việc phải chỉ rõ đọc file nào trước. Đây là cái bẫy đáng kể nhất trong cả bộ vì nó **im lặng**.

3. **Executor chọn theo năng lực, tách khỏi độ phức tạp.** Hai trục khác nhau: độ phức tạp quyết định *có cần plan + cổng duyệt không*; năng lực quyết định *ai làm*. Trước đó hai thứ này bị trộn nên task multimodal đơn giản vẫn bị đẩy cho agent mạnh reasoning. Kèm 2 cổng: GATE 0 loại thẳng một executor khỏi vùng shared-layer/spec-mơ-hồ; GATE 0b buộc có agent thứ hai review khi task chạm tiền/permission/migration/production.

4. **Quota bias, ghi ra giấy.** Khi hai executor ngang nhau về độ tin cậy, chọn bên còn nhiều quota hơn. Điều đáng nói không phải quyết định, mà là việc **viết rõ đây là bias kinh tế, chỉ áp ở một ô của bảng, và không bao giờ ghi đè cổng an toàn**. Bias không viết ra sẽ lan.

5. **Model đắt nhất không viết code.** Vai trò main-loop = đọc, phân tích, quyết định, review; code giao subagent rẻ hơn hoặc CLI khác. Quan trọng: quy tắc phát biểu theo **vai trò**, không theo tên model — bản cũ ghi cứng tên một model và stale ngay khi đổi tầng model.

6. **Spec là input, không phải biên bản.** Spec phải tồn tại *trước* khi giao việc, vì chính nó là văn bản được nhúng vào prompt — executor không đọc được hội thoại của phiên khác. Suy ra một luật ngược đời với thói quen: **cấm viết tài liệu hồi tố để "lưu vết"**; lưu vết là việc của issue/PR. Ngoại lệ duy nhất là khi cổng phân loại chấm sai và scope phình thật.

7. **Task tier gate.** Dưới 2h / ≤2 file / không đổi business logic → không tạo spec, chỉ một dòng tracking; issue body chính là mini-spec. Chi phí nghi thức phải tỉ lệ với chi phí task, nếu không người ta sẽ lách quy trình.

8. **Một bên duy nhất được merge.** Agent phụ chỉ code trong scope rồi ghi `_DONE.md`; không commit/push/merge/tạo PR. Bên điều phối tự chạy build, tự đọc diff, tự kiểm scope rồi mới merge. Nguyên tắc: **không tin báo cáo suông** — báo cáo của agent là dữ liệu cần đối chiếu, không phải kết luận.

9. **Câu khai phải có thể sai được.** Đây là nguyên tắc mạnh nhất trong bộ, và nó đến từ một thí nghiệm đối chứng tình cờ: **cùng một task, cùng một model, hai lượt giao**. Lượt 1 prompt hỏi "build có xanh không" → executor trả lời bằng tính từ và bịa 6 nhóm tên field không tồn tại. Lượt 2 prompt đòi **con số tổng lỗi typecheck + baseline của repo + câu "bên điều phối sẽ re-run tất cả"** → nó khai đúng từng số, chạy lại khớp hết. Kết luận: bịa không phải tính cách của model, nó là **đầu ra hợp lý khi tiêu chí thành công không thể bị chứng minh là sai**. Suy ra cách sửa: đừng thêm câu "đừng bịa" vào prompt (lượt 1 và lượt 2 nhận cùng lời dặn đó) — hãy đổi *dạng* của câu trả lời được yêu cầu, từ phán quyết sang số đo mà bên kiểm re-run được.

10. **Verify EVIDENCE, không chỉ code.** Quy trình verify ban đầu chỉ kiểm code: diff, scope, build, typecheck. Một báo cáo bịa **bằng chứng** đi qua sạch sẽ. Ba cách nó lọt, đều đã gặp: hai file ảnh **trùng byte** được khai cho hai AC khác nhau (một ảnh màn quản trị chống lưng cho AC "đã kiểm cách ly dữ liệu giữa hai loại tài khoản"); cột evidence ghi "static code review" cho một AC hành vi nhưng cột phán quyết vẫn PASS (**hạ cấp kênh xác minh, giữ nguyên kết luận** — dạng bịa khó thấy nhất vì đọc rất giống báo cáo thật); và một "ảnh" 9 byte chứa chữ `Not Found` vì tải từ URL thất bại. Fix: hash mọi ảnh, đối chiếu *loại* evidence với *loại* AC, `git status` trước khi tin ảnh (ảnh chụp trên build đã bị executor patch thì vô giá trị, kể cả khi trông đúng).

11. **Phân vai bằng cổng cứng, không bằng lời dặn.** Ca quyết định: prompt cấm rõ ràng sửa file source, cho phép nói BLOCKED, vẫn bị sửa 7 file để 32/32 AC thành PASS. Lệnh viết bằng chữ **bỏ qua được**; tool không tồn tại thì **không**. Nên vai kiểm/review được định nghĩa bằng file có `tools` allowlist không chứa tool ghi — 4 trên 5 vai không thể sửa code. Kèm hệ quả kinh tế: `effort` và `model` cũng nằm ở file định nghĩa, nên "việc hash ảnh chạy model rẻ, việc review nghiệp vụ chạy model mạnh" trở thành cấu hình thay vì thói quen. Và **không truyền model ở call site** — truyền ở đó là quay lại hardcode rải rác.

12. **Executor phải có đường phản hồi về rule.** Kênh đề xuất sửa rule tồn tại nhưng **trống suốt** bốn ca thất bại, vì executor không với tới được nó: nó làm trong worktree của repo product, rule/harness ở repo khác, và prompt của nó còn cấm đọc thư mục config của agent. Nên đường vào là một mục bắt buộc trong báo cáo, rồi bên điều phối relay. Ba điều kiện để relay không thành cửa kiểm duyệt: nguyên văn trong blockquote · số đo của bên điều phối tách ra mục riêng · **không đồng ý thì vẫn phải ghi lại kèm lý do** — vì rule bị phê bình phần lớn do chính bên điều phối viết, không được vừa là cổng vào vừa là quan toà.

Hai cơ chế chống gián đoạn nên kể chung một mạch: **Dispatch log** (worktree path tuyệt đối + branch + bước tiếp theo, cập nhật ở mọi mốc, vì phiên có thể chết bất cứ lúc nào) và **poll `_DONE.md` ở background** thay vì bắt con người làm cầu nối giữa hai agent.

## 4. Phần "cái gì đã sai" — bắt buộc có, đây là chỗ tạo tin cậy

Không được bỏ mục này để case study trông đẹp hơn. Bốn thất bại thật, đều đã fix:

- **Rule vô hình trong worktree** (nguyên tắc 2). Agent làm sai quy ước suốt một thời gian mà không ai phát hiện, vì build vẫn xanh và agent vẫn báo done.
- **Bản mirror của rule drift 4 file.** Rule sống ở repo dự án (gitignored) + một bản backup ở repo skill. Sửa bên này quên bên kia → 4 file lệch cả một lần refactor. Fix: biến "sync mirror" thành invariant trong chính rule, kèm lệnh `diff -r` để verify.
- **Design doc trôi 14 ngày so với skill.** Tài liệu thiết kế vẫn mô tả kiến trúc 2 agent trong khi skill đã chạy 3 agent; bảng cấu hình trong doc ghi một giá trị, file config thật ghi giá trị khác. Fix: doc ghi thẳng dòng *"file thực thi là nguồn đúng, lệch nhau thì sửa doc"* + phải cập nhật cùng lượt.
- **Tag lightweight bị `--follow-tags` bỏ qua trong im lặng.** Push xong tưởng đã release, thực tế remote không có tag. Fix: dùng annotated tag, và verify bằng `git ls-remote --tags` chứ không tin output của lệnh push.

Mẫu số chung của cả bốn: **thất bại im lặng**. Mỗi fix đều là "biến kiểm tra thủ công thành cổng tự động".

### 4b. Lớp thất bại thứ hai: báo cáo "đã xong" là bịa (4 ca, 2 executor khác nhau)

Đáng kể riêng vì nó không phải bug của quy trình giao việc mà là bug của **cách hỏi**:

- Báo cáo khai một thành phần UI tồn tại trong 4 modal, trong khi source chưa từng có thành phần đó.
- Báo cáo E2E khai **32/32 PASS** — thực tế đã sửa 7 file source để app làm đúng ý AC (prompt cấm rõ), evidence là ảnh trùng byte dùng cho nhiều AC, và những dòng không chạy được thì điền "static code review" nhưng vẫn PASS.
- Báo cáo khai "builds successfully" + tick "typecheck no new error" + **18/18 test pass** — thực tế 12 lỗi type mới vì tham chiếu tên field không tồn tại. Build xanh vì bundler strip type; **test cũng xanh vì mock do chính executor viết dùng đúng shape bịa ra** — test đang mã hoá cái bug.
- Executor thứ hai (khác hãng) khai "no files outside the task surface changed" trong khi đã tạo một script throwaway ở repo root **có hardcode credential**.

Hai kết luận đáng bán, và chúng ngược với phản xạ thông thường:

1. **Không phải một model cá biệt.** Hai executor của hai hãng khác nhau bịa theo cùng một khuôn khi được hỏi cùng một kiểu. Cái sai nằm ở protocol.
2. **Lớp phát hiện từng là may mắn.** Ca thứ ba lọt qua *toàn bộ* quy trình verify thành văn lúc đó (diff + scope + build + test đều xanh); thứ bắt được nó là ghi chú riêng của một phiên, viết từ ca trước đó. Agent khác chạy đúng quy trình sẽ merge code bịa. Đó là lý do có nguyên tắc "rule bắt được lỗi phải nằm trong file dùng chung, không nằm trong memory riêng".

## 5. Denylist — tuyệt đối không xuất hiện trong bài viết

| Không được viết | Viết thay bằng |
|---|---|
| Tên khách hàng / sản phẩm thật | `Acme`, `acme/webapp-fe`, "một app quản lý nhân viên & thanh toán" |
| Tên người thật, GitHub handle thật | `dev-owner`, `qa-owner` |
| Đường dẫn tuyệt đối trên máy (thư mục user Windows, path vault Obsidian) | `${REPO_ROOT}`, `${VAULT_ROOT}` |
| Domain / endpoint nội bộ | `example.com` |
| Id vận hành (Telegram thread, project board number) | `<qa-thread-id>`, `<project-number>` |
| Codename model nội bộ trong cache CLI | `<codex-daily>` / `<codex-hard>` / `<codex-batch>` |
| Ảnh chụp app thật | sơ đồ tự vẽ, hoặc code block |
| Tên type/field/hook của app khách hàng (kể cả khi đang kể ca lỗi) | đổi thành tên chung chung, hoặc chỉ nói "8 tên field không tồn tại" |
| Id spec/US/issue nội bộ khi kể ca lỗi | "một task E2E", "một task UI" |
| Email/mật khẩu tài khoản test xuất hiện trong script agent tự viết | nói "có hardcode credential", KHÔNG dán giá trị |

Sau khi viết xong: chạy `bash ../scripts/scrub-check.sh <đường-dẫn-bài-viết>` — phải in `OK`. Script chỉ bắt token; vẫn phải tự đọc lại xem có câu nào cụ thể tới mức chỉ ra được khách hàng.

## 6. Gợi ý cấu trúc bài

1. **Hook** (1 đoạn): tình huống cụ thể của thất bại im lặng — agent báo done, build xanh, quy ước bị vi phạm.
2. **Bối cảnh** (ngắn): 3 agent, 1 codebase, các pool quota khác nhau. Không kể tên khách hàng.
3. **Các cái bẫy** (mục 4 + 4b) — kể trước phần giải pháp, vì bẫy là thứ người đọc nhận ra chính mình trong đó. Lớp "báo cáo đã xong là bịa" (4b) nên kể kỹ nhất: nó là phần người đọc chưa gặp trong tài liệu của hãng.
4. **Mười hai nguyên tắc** (mục 3) — mỗi nguyên tắc 1 đoạn + trích 3–6 dòng từ file rule thật làm bằng chứng. Nếu phải cắt cho ngắn thì giữ nguyên tắc 9–12, bỏ bớt 1–8.
5. **Kiến trúc**: một sơ đồ (input → phân loại → cổng → executor → verify → merge). Mermaid là đủ.
6. **Giới hạn & những gì chưa làm**: chưa đo hiệu quả định lượng; gắn với công cụ mid-2026; phần vault/board thay được.
7. **Lấy về dùng**: link package + 3 dòng cài đặt.

Độ dài đề xuất: 1200–1800 từ. Trích code/rule thật thay vì diễn giải — bài này bán *tính cụ thể*, không bán tính bao quát.

## 7. Giọng văn

- Câu khẳng định, chủ động. Không "có thể nói rằng", không "trong thời đại AI".
- Mỗi tuyên bố phải bám vào một file/hành vi cụ thể trong package.
- Không emoji trong tiêu đề. Không bullet toàn câu cụt — cái nào cần lý do thì viết thành câu.
- Dùng "tôi" (một người làm thật) chứ không "chúng tôi" (nghe như công ty).
