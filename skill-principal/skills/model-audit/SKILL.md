---
name: model-audit
description: Use when the user wants to re-check what the connected coding agents can actually do right now and refresh the agent capability profile — "/model-audit", "cập nhật đánh giá model", "kiểm lại năng lực agent". Probes the REAL local harness of each connected agent (CLI config, model cache, auth, hooks — noting that GUI-based agents carry no model info locally at all), reads the official vendor docs for capability/pricing/thinking levels, mines the actual dispatch history for field evidence, then reconciles all three against references/agent-capability-matrix.md, updates it, and bumps last-verified even when nothing changed. Run manually — /dispatch Bước 2a only READS the resulting date, it never refreshes. Purpose: dispatch phân công đúng agent vì hồ sơ phản ánh thực tế, không phải marketing của hãng.
---

# /model-audit — Kiểm lại năng lực agent, cập nhật hồ sơ

Chạy **chủ động, khi bạn thấy cần** (mốc tham khảo: ≥3 ngày kể từ `last-verified`). `/dispatch` Bước 2a chỉ **đọc** ngày và cảnh báo khi quá hạn — nó không tự làm mới.

Tách như vậy là cố ý: cổng đọc phải rẻ (1 lệnh `grep`) vì chạy mọi lượt dispatch; việc làm mới tốn nhiều lượt fetch nên phải do người dùng khởi động, không chen ngang giữa lúc đang giao việc.

**Hồ sơ (file duy nhất được sửa):** `../dispatch/references/agent-capability-matrix.md`

## Phạm vi

Mặc định audit **mọi agent đã kết nối**. `/model-audit <tên-agent>` để giới hạn. Agent chạy làm main-loop không có harness ngoài để probe — phần đó chỉ đối chiếu tài liệu hãng, và chỉ khi user hỏi thẳng.

## Ba nguồn, KHÔNG được thay thế nhau

| Nguồn | Trả lời câu gì | Sai lầm hay gặp |
|---|---|---|
| **Harness thật trên máy** (Bước 1) | *máy này đang chạy cái gì, kênh giao việc còn sống không* | Tin file mô tả host là hiện trạng — nó là **bản khai đã ghi**, phải probe lại mới biết còn đúng |
| **Tài liệu hãng** (Bước 2) | *model nào tồn tại, giỏi gì, giá bao nhiêu, thinking level nào* | Coi bài blog ra mắt là đánh giá khách quan |
| **Lịch sử dispatch thật** (Bước 3) | *trên repo NÀY, agent đó thực tế làm được gì* | Bỏ qua vì "ít dữ liệu" — đây là nguồn duy nhất không ai bán hàng cho bạn |

Thiếu nguồn 3 thì hồ sơ chỉ là bản chép lại marketing của hãng. Đó đúng là thứ skill này sinh ra để không xảy ra.

## Bước 1 — Probe harness thật

Hai loại agent, probe khác nhau — đừng áp cùng một checklist:

### 1a. Agent chạy qua CLI

```bash
<agent-cli> --version
# config đang dùng: model + mức reasoning/effort
# cache model: slug khả dụng + default level + context window + thời điểm fetch
# auth: file credential còn không
```

Bốn câu chấm:

1. **Model đang cấu hình có còn trong cache không?** Không còn ⇒ lần dispatch tới sẽ lỗi.
2. **Mức effort có khớp VAI TRÒ của model đang chọn không?** Đây là chỗ lệch âm thầm nhất: chạy model tầng-batch ở effort cao nhất là trả tiền reasoning cho việc cơ học; chạy model tầng-khó ở effort thấp nhất là phí năng lực. Cache thường có `default_reasoning_level` của từng slug để so.
3. **Cache cũ bao nhiêu?** Cache cũ nhiều ngày + `client_version` thấp hơn CLI hiện tại ⇒ có thể có generation mới mà máy chưa thấy → đề xuất cập nhật CLI.
4. **`context_window`** của dòng đang dùng — con số này dùng để báo token, **không được hardcode** ở bất kỳ đâu.

⚠️ **Hai bẫy đo, áp cho MỌI CLI** (kiểm chứng thật, suýt dẫn tới kết luận ngược):

- `<tool> --version` là **lệnh local, không chạm API** → nó trả về bình thường ngay cả khi tài khoản đã bị chặn hoàn toàn. Không dùng được để test auth/tier.
- Invocation thật có thể trả **`exit=0` NGAY CẢ KHI auth thất bại**; lỗi chỉ nằm ở stderr. ⇒ **grep stderr tìm chuỗi lỗi, đừng bao giờ tin `$?`.**

### 1b. Agent chạy trong GUI/IDE riêng

```bash
# file mô tả host: kênh giao việc, thư mục skill, file hook, file auth
# hook còn đăng ký không + script hook còn tồn tại không
# auth còn hạn không
```

⚠️ **Harness của agent GUI thường KHÔNG chứa thông tin model nào cả** — model do user chọn trong giao diện, không có file nào trên máy khai nó. Đã kiểm chứng: file config chỉ có vài top-level key, không key nào về model; state cũng không chứa slug nào.

Nên ở loại này, probe harness trả lời **"kênh giao việc còn sống và còn bị ràng buộc không"**, còn **"model nào tốt"** hoàn toàn phải lấy từ Bước 2. Đừng cố suy model từ file local — không có.

Ba câu chấm:

1. **Hook enforcement còn đăng ký không?** Với agent không đọc được file rule toàn cục, hook là **tầng always-on duy nhất** tới được nó. Mất hook = mọi ràng buộc chỉ còn nằm trong prompt file ⇒ báo user ngay, mức nghiêm trọng cao.
2. **Auth còn hạn không?** Mất auth thì worktree dựng xong cũng vô dụng.
3. **Thư mục skill / config MCP** còn đúng path khai trong file mô tả host không.

## Bước 2 — Tài liệu hãng (chỉ hãng trong phạm vi)

Danh sách nguồn ở cuối hồ sơ. Tối thiểu: danh sách model (**cột stable/preview** — đừng khuyến nghị bản preview cho code production) · mức reasoning/thinking + default · giá.

**Luôn đọc trang thinking/reasoning levels kể cả khi không có model mới.** Kiểm chứng: nó đã một lần chứa thông tin quyết định mà bài ra mắt **không** nói — một model mới **mất tầng thinking rẻ nhất** mà thế hệ trước có, tức nó không còn là lựa chọn đúng cho việc batch dù mới hơn. Không trang nào khác nói điều đó.

Khi đọc bài ra mắt, nhớ đó là **tài liệu bán hàng**: số benchmark là của chính hãng, chưa có bên thứ ba kiểm chứng, và **không nêu limitation là đặc trưng thể loại chứ không phải dữ kiện**. Đưa vào hồ sơ thì đưa kèm nhãn đó.

## Bước 3 — Bằng chứng thực địa (nguồn quan trọng nhất, hay bị bỏ nhất)

Đây là thứ phân biệt hồ sơ của **bạn** với bảng benchmark của hãng: agent đó thực tế làm việc thế nào trên repo của bạn.

Nguồn: inbox phản hồi rule · task file `.agent-tasks/` · dòng dispatch log trong spec · báo cáo `_DONE.md` đã copy lại.

| Chỉ số | Vì sao đáng tin hơn benchmark |
|---|---|
| Số vòng trung bình tới ✅ MERGED | đo "sửa một lần xong hay phải quay lại 3 lần" |
| Tỉ lệ 🟠 CHANGES NEEDED theo executor | đo độ tin cậy thật, không phải điểm thi |
| Chọn BLOCKED thay vì phá scope | đo thứ quan trọng nhất khi giao việc tự động |
| Loại lỗi lặp lại | cho biết agent **hiểu sai cái gì** — không benchmark nào nói |

**Ba quy tắc đọc, thiếu cái nào là chỉ số tự bôi bẩn chính nó:**

1. **Dữ liệu mỏng thì ghi là mỏng.** Ghi `n=<số>` cạnh mọi nhận định. `n` một chữ số **không** đủ để đổi điểm hay nới/siết một cổng nào.
2. **Tách "vòng do executor sai" khỏi "vòng do người giao việc sai".** Kiểm chứng: một task có 2 lần giao đầu **không chạy gì cả** vì lỗi cú pháp lệnh của bên điều phối — đếm vào đây là vu oan cho model.
3. **Ghi ngày + thế hệ model của mỗi ca.** Số sinh ra trước một generation mới thì nói về **thế hệ cũ**; dùng để phán về model hiện hành là sai. Không ghi ngày thì vài tuần sau không ai phân biệt được.

## Bước 4 — Đối chiếu 3 nguồn, ghi bảng lệch

Bảng lệch là **đầu ra chính**, không phải phần phụ. Ba loại lệch, xử lý khác nhau — **đừng gộp**:

- **Hồ sơ sai** (tài liệu hãng đã đổi) ⇒ sửa hồ sơ.
- **Máy sai** (config trỏ model không còn tồn tại, hook mất, auth hết hạn) ⇒ **báo user, KHÔNG tự sửa** cấu hình máy. Skill này chỉ có quyền ghi hồ sơ.
- **Cả hai đều đúng, chỉ là user chọn khác khuyến nghị** ⇒ **không phải lỗi**. Hỏi một câu; là chủ đích thì ghi vào hồ sơ như ghi chú vận hành để lần sau không báo lại.

Loại thứ ba hay bị chấm nhầm thành loại thứ hai. Kiểm chứng: một cấu hình chạy model tầng-rẻ ở effort cao nhất trông như drift, cho tới khi đọc bảng giá — model đó rẻ hơn tầng trên **10×**, nên "model rẻ nhất + cho nó nghĩ nhiều" là chiến lược hợp lý, không phải nhầm lẫn.

## Bước 5 — Cập nhật hồ sơ + bump ngày

1. Sửa hồ sơ theo bảng lệch.
2. Cập nhật `last-verified` — **bump kể cả khi không có gì đổi**. "Đã kiểm ngày X, không đổi" là thông tin; để ngày cũ thì lần sau dispatch lại báo quá hạn và bạn đi kiểm lại đúng thứ vừa kiểm.
3. Chỉ bump **hãng thực sự đã kiểm** trong lượt này.
4. Đó phải là **dòng duy nhất trong file chứa chuỗi đánh dấu ấy** — gate của dispatch khớp theo chuỗi; viết lại chuỗi đó trong văn xuôi là gate đọc ra 2 kết quả và parse nhầm placeholder thành ngày.
5. Điểm số chỉ được đổi khi **nêu được căn cứ**: số benchmark cụ thể, hoặc `n=` từ Bước 3. Không có căn cứ thì giữ số cũ — điểm trôi theo cảm tính còn tệ hơn điểm cũ có ghi ngày.

## Bước 6 — Báo cáo

Harness từng agent · tài liệu hãng có gì đổi · bằng chứng thực địa kèm `n=` · bảng lệch 3 loại · mục đã sửa + `last-verified` mới · **cấu hình máy cần user tự sửa**.

Đóng lại bằng **một câu về phân công**: thay đổi lần này có làm đổi khuyến nghị executor/model của `/dispatch` không, và đổi ở ô nào. Không đổi thì nói thẳng "không đổi phân công" — đó là kết quả hợp lệ và thường gặp nhất.

## Ranh giới

- **Chỉ ghi đúng một file**: hồ sơ năng lực. Không sửa config CLI, hook, hay file định nghĩa vai.
- **Không đổi GATE 0 / GATE 0b / quota bias** — đó là policy của `/dispatch`, không phải kiến thức về model. Benchmark agentic đo *hoàn thành task*, **không** đo thứ GATE 0 thật sự chặn (consistency xuyên suốt refactor dài, làm technical owner duy nhất của migration). Nới GATE dựa vào chúng là suy diễn ngoài dữ liệu. Thấy dữ liệu đáng nới thì **đề xuất** kèm điều kiện kiểm chứng cụ thể (vd "sau ≥5 task Route B/C mà `role-verifier` không ghi nhận lỗi consistency"), để user quyết.
- Không commit. Báo user file đã đổi.
- Không kiểm được nguồn nào ⇒ ghi rõ nguồn nào trượt và lý do, **không** bump ngày của hãng đó.
