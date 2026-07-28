# Screen Registry — Map code → Màn hình member-facing (TEMPLATE)

> **Mục đích**: nguồn tra cứu duy nhất để agent điền field `**Màn hình:**` trong GitHub issue và chọn route khi chụp evidence. Agent **TRA CỨU, KHÔNG ĐOÁN** tên màn hình từ file path.
>
> **Quy tắc tên**: tên màn hình phải khớp label mà người dùng nhìn thấy trên UI (sidebar/menu — nguồn: file i18n của project, vd `src/locales/<lang>.json`, keys `*.nav.*`). Khi label UI đổi, cập nhật registry trong cùng PR.
>
> **Cách map từ PR**: file thay đổi → tìm Route component sở hữu nó trong router của app → tra dòng tương ứng dưới đây. Component dùng chung nhiều màn hình → liệt kê MỌI màn hình bị ảnh hưởng, hoặc dùng tên user journey.
>
> Đây là living doc — thiếu màn hình nào thì agent tự thêm dòng (đúng format) trong lần dùng đầu, không chờ được giao.

> ⚠️ **File này trong package public chỉ là template.** Bản gốc là bảng kiểm kê ~60 màn hình của một app cụ thể — đã lược bỏ vì không mang giá trị tái dùng. Điền registry của app bạn theo format dưới đây.

## Vì sao registry đáng tồn tại (phần nguyên tắc, đây mới là thứ tái dùng được)

Agent gọi tên màn hình theo **tên file/component** (`StaffDetailPage`, `TipsTable`) trong khi người đọc issue gọi theo **label trên UI** ("Chi tiết nhân viên", "Giao dịch"). Không có bảng map, agent sẽ tự phát minh tên màn hình — và issue trở nên vô dụng với người không đọc code. Registry biến việc "đoán" thành việc "tra cứu", đồng thời cho evidence-capture biết cần mở route nào.

## Format

| Màn hình (label UI) | Route | Screen-slug (đặt tên file evidence) | Route component | Ghi chú |
|---|---|---|---|---|
| Đăng nhập | `/signin` | `signin` | `SignInPage` | Public, không cần auth |
| Trang chủ | `/` | `home` | `HomePage` | |
| Danh sách nhân viên | `/staff` | `staff-list` | `StaffListPage` | |
| Chi tiết nhân viên | `/staff/:id` | `staff-detail` | `StaffDetailPage` | Cần dữ liệu seed |

## Quy ước

- **Screen-slug** dùng cho tên file evidence: `<issue-or-us>--<screen-slug>--<state>--<viewport>.png` (xem `reports-export.md`).
- Nhóm màn hình theo vùng auth (Public / Đã đăng nhập / Theo vai trò) để agent biết cần tài khoản nào khi chụp.
- Màn hình chỉ tồn tại ở một viewport (vd chỉ mobile) → ghi rõ trong cột Ghi chú; ảnh evidence phải khớp viewport đó.
