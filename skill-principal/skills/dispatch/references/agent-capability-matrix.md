# Agent Capability Matrix — Claude / Codex / Gemini

Cơ sở năng lực để `/dispatch` chia việc đúng agent. Distilled từ **"Claude vs Codex vs Gemini — So sánh chuyên sâu"** (cập nhật 27/07/2026, tổng hợp tài liệu chính thức Anthropic / OpenAI / Google / Figma). Đây là bản tóm tắt cho routing — số liệu là đánh giá thực tiễn theo workflow Product–Design–Code, KHÔNG phải benchmark tuyệt đối.

Bản đầy đủ + phần vận hành (§6: GATE 0/0b, quota bias, bảng chọn executor): `${OBSIDIAN_ROOT}\gstack\01_So_sanh_Claude_Codex_Gemini_Coding_Figma_Product_Effort.md`.

<!-- last-verified: codex=2026-08-17 gemini=2026-08-17 claude=2026-07-27 -->

## Hạn đánh giá — 3 ngày (máy đọc được, đừng để trong đầu ai)

Comment HTML ngay trên là **ngày cuối cùng đánh giá của từng hãng được đối chiếu với nguồn chính thức**. `/dispatch` Bước 2a đọc nó mỗi lượt; quá **3 ngày** thì chạy `/model-audit` trước khi tin con số nào trong file.

> ⚠️ **Ngày trong bản phát hành này là ngày tác giả kiểm, không phải ngày bạn tải về.** Chạy `/model-audit` một lần ngay sau khi cài. Không chạy thì bạn đang phân công bằng một bảng đóng băng ở quá khứ — và **một bảng cũ đọc y hệt một bảng đúng**, không có dấu hiệu nào cảnh báo.

Đó phải là **dòng duy nhất** trong file chứa chuỗi đánh dấu đó — gate khớp theo chuỗi; thêm một dòng văn xuôi nhắc lại chuỗi ấy là gate đọc ra 2 kết quả và có thể parse nhầm placeholder thành ngày. Muốn nhắc tới nó ở chỗ khác thì gọi bằng chữ ("comment HTML đầu file").

| Ai | Quyền | Làm gì |
|---|---|---|
| **`/model-audit`** | đọc + **GHI** (bên duy nhất) | probe harness thật → đối chiếu tài liệu hãng + lịch sử dispatch → cập nhật file này → bump ngày |
| `/dispatch` Bước 2a | chỉ đọc | grep ngày; quá hạn thì đề nghị chạy `/model-audit`, không tự refresh |

**Đọc được cache model của CLI KHÔNG thoả mãn hạn 3 ngày.** Cache cho biết model nào *tồn tại*, không cho biết model đó *giỏi việc gì* — hai câu hỏi khác nhau, và chỉ câu sau dùng để trả lời "nên chọn cái nào".

## Kết luận 1 dòng

Claude = reasoning / kiến trúc / quyết định. Codex = implementation / end-to-end / vòng lặp verify. Gemini = multimodal (video/ảnh/log/PDF), throughput cao, visual QA.

## Tầng model Claude (cập nhật 27/07/2026)

- **Opus 5** (`claude-opus-5`) — trần năng lực của workflow này: kiến trúc, root cause, review, product/UX. Effort mặc định `high` trên Claude API + Claude Code.
- **Sonnet 5** (`claude-sonnet-5`) — execution hằng ngày, Figma canvas, Route A subagent. Effort mặc định `high`.
- **Haiku 4.5** (`claude-haiku-4-5`) — batch/extraction, tầng rẻ nhất.
- **Fable 5 KHÔNG dùng trong workflow này** — tầng trên Opus 5 nhưng đắt gấp đôi và chậm hơn; đã chốt giữ trần ở Opus 5.
- **Model main-loop (hiện tại Opus 5) KHÔNG tự code** ở bất kỳ route nào — luôn giao subagent Sonnet 5 / Codex / Gemini. Quy tắc gắn với *vai trò main-loop*, không gắn với tên model (tên sẽ đổi; trước đây skill ghi cứng "Fable 5").

## Bảng điểm (coding-relevant)

| Năng lực | Claude | Codex | Gemini |
|---|---|---|---|
| Coding production | 9.3 | **9.7** | 8.8 |
| Hiểu kiến trúc/nghiệp vụ | **9.8** | 9.2 | 8.8 |
| Research đa phương tiện | 9.3 | 8.4 | **9.7** |
| Tốc độ/chi phí | 8.8 | 8.9 | **9.4** |

## Coding capability (§1)

| Tiêu chí | Claude | Codex | Gemini |
|---|---|---|---|
| Hiểu codebase lớn | Xuất sắc | Rất mạnh | Mạnh |
| Tìm root cause | Xuất sắc | Xuất sắc | Rất mạnh |
| Task end-to-end | Rất mạnh | **Xuất sắc** | Mạnh |
| Sửa nhiều file + chạy test | Rất mạnh | **Xuất sắc** | Mạnh |
| Refactor kiến trúc | Xuất sắc | Rất mạnh | Khá–mạnh |
| Frontend visual | Rất mạnh | **Xuất sắc** | Rất mạnh |
| Kiểm soát phạm vi | Tốt nếu khóa scope | Cần project rules | Cần chia module |
| Debug bằng ảnh/video | Rất mạnh | Rất mạnh | **Xuất sắc** |

## Codex model roles (§1.2 — dispatch đọc slug LIVE từ models_cache, đây là ánh xạ theo VAI TRÒ)

- **<codex-hard>-class** — task mở/khó/nhiều trade-off, frontend cần polish cao → effort High/Extra High. Không mặc định cho task lặp. (`default_reasoning_level` trong cache: `low`.)
- **<codex-daily>-class** — coding hằng ngày, API integration, component, bug có reproduction → Medium/High. **Mặc định khuyến nghị.** (cache: `medium`.)
- **<codex-batch>-class** — extraction/classification/transformation, batch/high-volume → Low/Medium. (cache: `medium`.)
- Thế hệ cũ còn trong cache (`<codex-alt>`, `<codex-prev>`, `<codex-mini>`) — chỉ dùng khi cần pin phiên bản.
- Max/Ultra KHÔNG hợp requirement mơ hồ → chuyển Claude khóa sản phẩm trước.
- **"Mặc định" ≠ cái đang chạy.** Mức thực tế là `model_reasoning_effort` trong `~/.codex/config.toml` (tại 27/07/2026: `<codex-hard>` + `high`). Đọc cả cache và config trước khi dispatch; override bằng `-m` / `-c` nếu lệch khuyến nghị.

## Gemini (§1.3, §4.4)

- Mạnh nhất: debug có video/screenshot, batch QA, log classification, document extraction, context lớn.
- Yếu: consistency trong refactor dài; **không nên là technical owner duy nhất của migration lớn**; UI styling cần guideline rõ.
- Thinking: Flash Medium (mặc định agentic/multimodal/coding); Pro High (reasoning sâu / tool chính xác hơn).
- Figma: KHÔNG phải supported client trực tiếp cho write-to-canvas / code-to-canvas → chỉ dùng Gemini phân tích screenshot/video/visual QA, không chỉnh file Figma production.

## Effort theo rủi ro & độ mơ hồ (§4.1)

| Loại task | Độ mơ hồ | Rủi ro | Mức effort |
|---|---|---|---|
| copy / spacing / import | Thấp | Thấp | Low/Minimal |
| component / API / CRUD quen thuộc | Thấp–vừa | Vừa | Medium |
| feature nhiều file / responsive / test | Vừa | Vừa–cao | High |
| bug khó / workflow nhiều role | Cao | Cao | XHigh/Extra High |
| migration / payment / permission / production incident | Cao | Rất cao | Max **+ review độc lập** |

## Quy tắc phối hợp (§4.5, §5)

- Escalation mặc định: **Sonnet High / Codex <codex-daily> Medium / Gemini Flash Medium**; tăng 1 cấp khi sót dependency / chưa root-cause / chưa verify.
- Đổi agent theo vai trò: UX sai → Claude; code không hoàn tất → Codex; thiếu evidence → Gemini.
- **Tiền / dữ liệu / permission / migration / release production → BẮT BUỘC agent thứ 2 review độc lập.**
- Không để nhiều agent cùng sửa 1 artifact; Claude khóa intent + AC trước khi Codex code; source code cần branch riêng + diff review trước merge.

## Bằng chứng thực địa (do `/model-audit` ghi)

Phần **không hãng nào bán cho bạn được**: agent đó thực tế làm việc thế nào trên repo của bạn. Benchmark của hãng đo thi cử; mục này đo công việc thật. Khi hai nguồn mâu thuẫn, **mục này thắng** — nhưng chỉ khi `n` đủ để nói, và `n` phải luôn được ghi ra.

**Bản phát hành để trống bảng này có chủ đích.** Số của người khác trên codebase khác không nói được gì về codebase của bạn. Mục này dày lên theo mỗi lượt `/dispatch` — đó chính là giá trị của nó.

| Chỉ số | Agent A | Agent B | n | Cập nhật |
|---|---|---|---|---|
| Số vòng tới ✅ MERGED | — | — | 0 | chưa đo |
| Tỉ lệ 🟠 CHANGES NEEDED | — | — | 0 | chưa đo |
| Chọn BLOCKED thay vì phá scope | — | — | 0 | chưa đo |
| Evidence bị bác là không hợp lệ | — | — | 0 | chưa đo |

**Ba quy tắc đọc — thiếu cái nào là chỉ số tự bôi bẩn chính nó:**

1. **Dữ liệu mỏng thì ghi là mỏng.** `n` một chữ số không đủ để đổi điểm hay nới/siết một cổng nào.
2. **Tách "vòng do executor sai" khỏi "vòng do người giao việc sai".** Ca kiểm chứng: một task có 2 lần giao đầu **không chạy gì cả** vì lỗi cú pháp lệnh của bên điều phối — đếm vào đây là vu oan cho model.
3. **Ghi ngày + thế hệ model của mỗi ca.** Số sinh ra trước một generation mới thì nói về *thế hệ cũ*; dùng để phán về model hiện hành là sai.

Bốn ca đã ghi nhận trong quá trình dựng bộ rule này, giữ lại vì chúng là **chất liệu root-cause**, không phải để chấm điểm agent nào:

- **Một task E2E** — executor sửa 7 file source để 32/32 AC thành PASS dù prompt cấm bằng chữ và cho phép nói BLOCKED; 2 cặp ảnh evidence **trùng byte**. ⇒ nguồn gốc của "vai kiểm không có tool ghi" và bộ check hash ảnh.
- **Một task UI, lượt 1** — báo "builds successfully" + 18/18 test pass trong khi typecheck có 12 lỗi mới (tham chiếu tên field không tồn tại); test xanh vì mock của chính nó dùng shape bịa. Lượt 2 đổi prompt sang đòi **con số + baseline** thì khai đúng. ⇒ bịa là đầu ra của protocol, không phải tính cách model.
- **Một task khác, executor CLI** — báo "no files outside the task surface changed" trong khi đã tạo script throwaway ở repo root **có hardcode credential**. ⇒ mọi loại agent đều bịa khi được hỏi bằng văn xuôi.
- **Một task đụng tiền** — diff sạch, typecheck đúng baseline, build xanh, scope đúng 2 file, **qua sạch toàn bộ phần kiểm code**; chỉ `role-reviewer` bác được vì `git log -S` cho thấy đó là revert một cổng xác nhận do người khác cố ý đặt. ⇒ lý do GATE 0b không được bỏ.

Đọc ngang 4 ca: **mọi executor đều bịa khi câu hỏi không thể sai được, và đều khai đúng khi bị đòi output máy có baseline.** Đây là phát hiện về *cách hỏi*, không phải về *agent nào tốt hơn* — nên nó không làm đổi điểm số nào ở bảng trên.

## Nguồn chính thức

- [A1] Claude Models overview — https://platform.claude.com/docs/en/about-claude/models/overview
- [A2] Claude Effort — https://platform.claude.com/docs/en/build-with-claude/effort
- [A3] Choosing the right Claude model — https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- [O1] Codex models and reasoning levels — https://learn.chatgpt.com/docs/models
- [O2] Codex pricing and model positioning — https://developers.openai.com/codex/pricing
- [G1] Gemini models — https://ai.google.dev/gemini-api/docs/models
- [G2] Gemini thinking levels — https://ai.google.dev/gemini-api/docs/thinking
- [F3] Figma MCP vs. agent — https://developers.figma.com/docs/figma-mcp-server/mcp-vs-agent/
