# Agent Capability Matrix — Claude / Codex / Gemini

Cơ sở năng lực để `/dispatch` chia việc đúng agent. Distilled từ **"Claude vs Codex vs Gemini — So sánh chuyên sâu"** (cập nhật 27/07/2026, tổng hợp tài liệu chính thức Anthropic / OpenAI / Google / Figma). Đây là bản tóm tắt cho routing — số liệu là đánh giá thực tiễn theo workflow Product–Design–Code, KHÔNG phải benchmark tuyệt đối.

Bản đầy đủ + phần vận hành (§6: GATE 0/0b, quota bias, bảng chọn executor): `${OBSIDIAN_ROOT}\gstack\01_So_sanh_Claude_Codex_Gemini_Coding_Figma_Product_Effort.md`.

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

## Nguồn chính thức

- [A1] Claude Models overview — https://platform.claude.com/docs/en/about-claude/models/overview
- [A2] Claude Effort — https://platform.claude.com/docs/en/build-with-claude/effort
- [A3] Choosing the right Claude model — https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- [O1] Codex models and reasoning levels — https://learn.chatgpt.com/docs/models
- [O2] Codex pricing and model positioning — https://developers.openai.com/codex/pricing
- [G1] Gemini models — https://ai.google.dev/gemini-api/docs/models
- [G2] Gemini thinking levels — https://ai.google.dev/gemini-api/docs/thinking
- [F3] Figma MCP vs. agent — https://developers.figma.com/docs/figma-mcp-server/mcp-vs-agent/
