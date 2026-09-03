---
name: agent-team
description: >-
  Use when a coding task deserves more than one agent at once but not your full
  delivery pipeline — the right approach is genuinely uncertain (algorithm, data
  shape, gnarly refactor) and the task needs no ticket, no spec document and no
  pre-approved screenshot. Not for tasks touching money, data integrity,
  permission, migration or production. Triggers "/agent-team", "agent team",
  "team cross-check", "gọi team", "nhiều agent cùng làm".
---

# agent-team — nhiều agent cùng một task, phản biện chéo

Làn **thực thi trực tiếp**: gọi một nhóm agent làm ngay, bỏ phần paperwork của pipeline đầy đủ.

Điều duy nhất khiến skill này đáng tồn tại: **N phương án song song rồi phản biện chéo**. Không phải
"chạy nhiều agent cho nhanh" — N agent luôn *đắt hơn*, chỉ có thể *đúng hơn*.

## Cổng vào

### 4 câu đá lên pipeline đầy đủ — YES nào cũng đá

1. Task đụng **tiền / toàn vẹn dữ liệu / permission / migration / release production**?
2. Cần **ảnh hoặc thiết kế được duyệt trước khi code**?
3. Cần **ticket / spec doc** để người khác tra lại sau?
4. Đây là **một stream của task đã bị tách song song** (cần bảng fence tài nguyên runtime)?

Bốn câu là *cùng một câu*: **việc cần để lại dấu vết cho người khác thì không đi làn nhanh.**

### 1 câu đá về tay bạn

**Đọc trực tiếp N diff có rẻ hơn dựng team không?** Vài chục dòng mỗi phương án thì bạn đọc thẳng là
xong; spawn team lúc đó chỉ thêm vòng, thêm tiền, thêm thời gian.

Đây không phải lời khuyên suông — nó ra từ baseline test của chính skill này (xem §Baseline). Với 3
phương án 41/96/22 dòng, agent không có skill chọn tự đọc 159 dòng và tự chốt, lý do nó đưa ra:
*round-robin phản biện giữa 3 tác giả tốn thời gian hơn là đọc 159 dòng.* Đánh giá đó **đúng**. Skill này
chỉ có lãi khi phương án dài hoặc rối đến mức đọc hết là công việc thật.

## Bước 0 — Probe cách ly TRƯỚC khi hứa gì với user

Tier cạnh tranh cần N agent ghi **cùng một file** mà không thấy nhau. Không có cách ly thật ⇒ chúng ghi
đè lẫn nhau, và đây là kiểu hỏng tệ nhất: **merge sạch, typecheck xanh, không có lỗi đỏ nào, dữ liệu sai.**

Mỗi harness gọi cờ này một tên khác (một tham số `isolation`, một chế độ `workspace`, hoặc worktree bạn
tự dựng trước khi gọi). Ba việc, theo thứ tự:

1. Tra tên cờ trong harness bạn đang dùng.
2. **Probe thật**: spawn 1 agent với cờ đó, rồi từ ngoài kiểm nó đang ở đâu (`git -C <workspace> rev-parse
   --abbrev-ref HEAD`, hoặc ghi 1 file rồi xem nó có xuất hiện ở cây chính không).
3. Cờ có trong tài liệu **không** chứng minh nó chạy. Probe fail ⇒ **không chạy tier cạnh tranh**; hạ
   xuống tier Nhanh và nói với user là hạ vì lý do gì.

Đừng "chạy thử xem sao" với N agent cùng ghi một cây.

## Bước 1 — Chốt hình dạng team (hỏi user)

Hỏi một lượt. Đề xuất theo *độ bất định của cách làm*, không theo độ dài task:

| Tier | Hình dạng | Cần cách ly | Dùng khi |
|---|---|---|---|
| **Nhanh** (mặc định) | 1 executor + 1 reviewer + 1 spec-author mù | không | Đã biết làm thế nào, muốn cặp mắt thứ hai. Rẻ và nhanh nhất. |
| **Cạnh tranh** | 2–3 executor + phản biện chéo | **có** | Chưa chắc cách nào đúng: thuật toán, shape dữ liệu, refactor rối. |
| **Tối đa** | 4–5 executor + phản biện chéo | **có** | Bất định ở tầng thuật toán. Đắt: N executor + N×(N−1) lượt đọc diff. Nói rõ chi phí rồi mới chạy. |

**Trần cứng: 5 agent mỗi vai.** Quá đó thì context loãng và giao tiếp nghẽn nhanh hơn phần lợi thu được.

## Vai và quyền tool

Phân quyền theo **hai trục độc lập** — đây là phần cốt lõi, không phải chi tiết cấu hình:

| Vai | Thấy code? | Có tool ghi? | Việc |
|---|---|---|---|
| **Executor** ×N | code của mình | **có** | Viết code. Tier cạnh tranh: mỗi người một định hướng khác nhau. |
| **Spec-author** | **KHÔNG** — chỉ thấy public contract | **có** | Viết 1 spec dùng chung để chấm cả N phương án. |
| **Reviewer / trọng tài** | **có** — toàn bộ N diff | **KHÔNG** | Chốt bản thắng. Hỏi *"xanh mà có đúng không"*. |
| **Verifier** | có | **KHÔNG** | Chạy typecheck/test/diff, dán output máy. Hỏi *"chạy có xanh không"*. |
| **Reporter** | có | chỉ ghi file báo cáo | Tổng hợp. Không phán xét, không chạy test. |

**Không ai được vừa thấy code vừa sửa được nó, trừ executor.** Lý do không phải sạch sẽ hình thức: một
agent được lệnh bằng chữ "chỉ báo cáo, không sửa" **vẫn sẽ sửa** khi cách nhanh nhất để mọi thứ xanh là
sửa code. Lệnh bằng chữ bỏ qua được; **thiếu tool thì không**. Cấp tool theo allowlist, và nếu harness có
denylist thì đặt luôn lớp thứ hai.

## Bước 2 — Giao việc

- **Chốt public contract TRƯỚC khi spawn**: tên export, type in/out, và mọi quyết định nghiệp vụ mà cả N
  phương án phải trả lời giống nhau (ví dụ: hai khoảng chạm nhau `prevEnd === nextStart` có gộp không).
  Chốt sau ⇒ N phương án khác nhau ở *đặc tả*, và phản biện chéo mất nghĩa. Chốt trước còn gỡ thế bí cho
  người đang bị block: họ code theo contract ngay, thân hàm nào thắng cũng không đổi call site.
- Mỗi executor nhận **cùng một spec nguyên văn**, nhưng **một định hướng khác nhau** ghi rõ trong prompt:
  (a) hiệu năng/độ phức tạp · (b) toàn vẹn dữ liệu & type-safety · (c) lỗi biên/idempotency/retry.
  Không ghi định hướng thì bạn nhận về N bản gần trùng và trả tiền N lần cho 1 phương án.

## Bước 3 — Bài kiểm do người mù viết

**Tác giả không được tự soạn đề thi mình sẽ thi.**

Giao **một** agent chưa đọc phương án nào — chỉ thấy public contract — viết **một** spec file dùng chung:
input rỗng · 1 phần tử · biên chạm nhau · phần tử độ dài 0 · phần tử bị chứa trọn · trùng lặp · input đảo
thứ tự · input xen kẽ · `null`/open-ended · start/end nghịch · và **không mutate input** (cả array lẫn
object bên trong).

Rồi chạy **cùng file đó** trên cả N phương án. Đây là thứ duy nhất phân biệt được N bản đều "xanh".

**N bản đều báo test xanh là 0 tín hiệu, không phải N tín hiệu** — mỗi bản đang chạy test của chính nó.
Kiểm từng bản đã chạy **lệnh gì**: một lượt test lọc theo đúng file spec của nó thì không phải là chạy suite.

## Bước 4 — Chốt phương án: TRỌNG TÀI, không phải bầu cử

Executor nộp phản biện chéo (lỗi biên, rủi ro hiệu năng, khả năng bảo trì). **Người chốt không phải họ.**

- Diff ngắn: orchestrator tự đọc tự chốt là **hợp lệ và thường là đúng**.
- Diff dài/rối, hoặc cần dấu vết độc lập: dùng vai reviewer (không có tool ghi).

Cả hai trường hợp: **người đã viết diff không bao giờ là người chốt diff đó.**

Thứ tự tiêu chí: qua được spec dùng chung → người sau đọc lại được → hiệu năng **chỉ khi có nhu cầu đo được**.

Chọn **một** bản thắng:
- Bản thắng thiếu một case mà bản khác có ⇒ **sửa bản thắng**, đừng đổi bản. Sửa là một dòng; đổi bản là
  đổi luôn toàn bộ chi phí bảo trì.
- Muốn ghép mảnh nhiều phương án ⇒ đó là **code mới chưa ai verify**. Giao executor viết bản ghép rồi chạy
  lại Bước 3–4. Không tự tay ghép rồi ship.
- Thu hoạch từ bản thua: **chỉ lấy test case**, không lấy code.

## Bước 5 — Verify

- Verifier (không có tool ghi) chạy trên **diff thắng**: typecheck, test, `git status --short`, đối chiếu
  scope. Đừng miễn trừ bước này vì "task nhỏ" — miễn trừ kiểu đó gắn với 1 executor, không gắn với N.
- **Đọc kết quả test theo TÊN test, không theo số.** Chụp baseline trên commit gốc **trước** khi team
  chạy, rồi so tên fail mới vs cũ. Repo nào có fail sẵn thì đếm số là vô nghĩa, và gần như repo thật nào
  cũng có.
- **Build xanh không thay được typecheck.** Nhiều bundler không resolve identifier, nên build xanh vẫn có
  thể thiếu import.
- Số đo nào vào báo cáo thì **orchestrator chạy lại**, không lấy lời khai của subagent. Và không đưa số
  không đo được vào báo cáo — "memory footprint" của một lượt chạy unit test là ví dụ: không có cách lấy.

## Bước 6 — Báo cáo rồi DỪNG

Reporter viết, không phải người đã chốt. 4 phần: (1) bảng so sánh + bản thắng và **vì sao** · (2) ma trận
phản biện chéo, ai chỉ ra lỗi gì cho ai · (3) output máy của verifier nguyên văn · (4) file cần merge.

**DỪNG trước commit/PR.** Làn nhanh nhanh ở chỗ bỏ paperwork, không ở chỗ tự commit.

## Red flags — dừng lại, bạn đang hợp lý hoá

| Câu bạn đang định nói | Thực tế |
|---|---|
| "N agent đều báo xanh, chọn bản gọn nhất" | N bản tự chạy test của mình = 0 tín hiệu. Cần spec dùng chung do người mù viết. |
| "Để các agent tự thống nhất cho nhanh" | Người viết code duyệt code của chính mình. |
| "Tôi ghép phần hay nhất của A và B" | Bản ghép là code chưa ai verify. Giao executor viết, verify lại. |
| "Cho tester quyền ghi để nó tự thêm test" | Thấy code + có quyền ghi = vá cho xanh. Tách 2 vai. |
| "Task nhỏ, bỏ verifier" | Miễn trừ đó gắn với 1 executor, không gắn với N. |
| "Đụng tiền nhưng chỉ sửa 1 dòng, chạy làn nhanh luôn" | Cổng vào câu 1. Lên pipeline đầy đủ. |
| "Probe cách ly fail nhưng chắc vẫn chạy được" | N agent ghi cùng một cây = bug im lặng, không phải lỗi đỏ. |
| "Cứ gọi team cho khách quan" | Cổng "đá về tay bạn". Diff ngắn thì đọc thẳng rẻ hơn. |

## Baseline — skill này được kiểm trước khi viết

Chạy 1 scenario với agent **không có skill**: 3 phương án song song cho cùng một hàm, cả 3 đều typecheck
sạch và test xanh, kèm áp lực thời gian. Giả thuyết cần kiểm: agent sẽ để các executor tự bầu chọn bản thắng.

**Giả thuyết SAI.** Agent không có skill vẫn tự: không tin 3 dấu xanh (*"3 agent tự chạy test của mình
không phải 3 tín hiệu, là 0"*), dựng một agent thứ 4 **mù** để viết spec dùng chung, từ chối cho 3 tác giả
chấm chéo nhau, từ chối ghép 3 thiết kế, và dừng trước commit.

Hai thứ baseline dạy ra, và đã thành nội dung của skill:

1. **Cơ chế spec-author mù** (Bước 3) — do baseline tự phát minh, tốt hơn bản thiết kế ban đầu. Nó giải
   đồng thời hai đầu: người viết đề *có* quyền ghi nhưng **mù** với code; người kiểm *thấy* code nhưng
   **không** có quyền ghi.
2. **Cổng "đá về tay bạn"** (§Cổng vào) — baseline chỉ ra rằng với diff ngắn thì dựng team là lỗ.

Còn "executor tự bầu" là lỗi của **bản thiết kế đầu tiên**, không phải failure mode agent tự nhiên mắc.
Ghi lại ở đây để lần sau không ai phồng nó thành một rule to: nó đã được kiểm, và agent không mắc.

Bài học chung, không riêng skill này: **viết rule cho một failure mode chưa đo là tự thêm việc.** Chạy
baseline không có guidance trước; control không thể hiện lỗi thì không có gì cần sửa.
