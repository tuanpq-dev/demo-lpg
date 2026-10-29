# Sai khác Figma đã chuẩn hóa

Log các chỗ code CỐ Ý khác ảnh/Figma (chuyển nguyên văn từ CLAUDE.md mục 8 ngày 28/10/2026, nhóm theo màn). Ghi mục mới vào đúng nhóm, mới nhất lên đầu nhóm. Câu hỏi còn chờ designer/khách: `docs/questions.md`.

## Nguồn tham chiếu Figma (nguyên văn CLAUDE.md mục 2)

- File key `stJtcbE3XGzA4WFrJFE1un`. Màn: `53:11` Tổng quan · `70:2809` Cảnh báo · `70:3964` Bảo trì.
- **MCP đã HẾT QUOTA (seat View, 6 lần/tháng) → KHÔNG gọi Figma MCP.** Nguồn thay thế:
  - **Lâu dài (chỉ máy dev):** ảnh chụp trong `scratch/figma-ref/` (`53-11-overview.png`, `70-2809-alerts.png`, `70-3964-maintenance.png`, các crop node), ảnh thiết kế modal `mt-create-modal-design.png` và trang chi tiết tài sản `asset-v101-design.png` (919×790, ~0,59× khung 1565 – cỡ chữ/khoảng cách là ước lượng; không có node), chi tiết yêu cầu bảo trì `mt-detail-design.png` (1565×2665, thu từ ảnh 2× người dùng gửi; không có node – số đo ước lượng gom trong `tokens.css` khối "Layout chi tiết yêu cầu bảo trì"), modal cập nhật tiến độ `mt-progress-modal-design.png` (1242×952 có bóng, modal ~1160 px; không có node), modal phân công `mt-assign-modal-design.png` (1565×1175 = cả trang, thu ×1/2 từ ảnh 2× – đã làm, mục 5H). Hai modal nghiệm thu (`mt-submit-review-modal-design.png`, `mt-review-modal-design.png`, 1156 px, thu ×1/3 từ ảnh 3×) nằm ở **`scratch/figma-ref/`** (gitignore, chỉ máy dev) – ảnh thiết kế mới KHÔNG đặt trong `public/` (bị deploy công khai); playground chỉ tham chiếu khi `import.meta.env.DEV`.
  - **Cache design context** (có thể mất khi đổi phiên): `C:/Users/ptuan/AppData/Local/Temp/claude/f--TEMPO-demo-lpg/0d061ac4-b5cd-4d25-bf82-aad81de290f4/scratchpad/figma/{53-11,70-2809,70-3964}.part0.txt`. Mỗi file bị cắt ở 100KB: 53:11 cắt sau 53:498, 70:3964 cắt ở 70:5402.
  - Màn Báo cáo (29/10/2026, ảnh người dùng gửi, không có node): `reports-design.png` (cả trang 1565×1239), crop ×3 `reports-header.png`, `reports-kpi.png`, `reports-summary-cards.png`, `reports-table.png`.
  - Ảnh hoặc SVG người dùng gửi trong chat.
  - Khi thiếu thông số: đọc pixel từ ảnh chụp rồi map về token gần nhất, kích thước lấy từ metadata.

## Cảnh báo (/alerts)

- **Modal "Phân công xử lý cảnh báo" (ảnh `scratch/figma-ref/alert-assign-modal-design.png`, ALT-00128, 27/10/2026):**
  - **Chức danh / chuyên môn / tên lấy từ STAFF** (một nguồn với modal bảo trì), khác ảnh: Nguyễn Văn A ảnh "Nhân viên vận hành • Khu bồn LPG", Ca 1 → STAFF "Kỹ sư cơ khí • Chuyên gia Van/Bồn", Ca 2; "Trần Minh B – Kỹ thuật viên bảo trì • Thiết bị áp suất" → Trần Bình "Kỹ thuật viên cơ khí • Thiết bị áp lực"; "Lê Hoàng C – Nhân viên an toàn • Rò rỉ khí & an toàn" → Lê Thị C "Kỹ thuật viên đo lường • Cảm biến" (người an toàn trong STAFF là Trần Thị B – "Chuyên viên an toàn • Hệ thống PCCC"). Dòng phụ = "chức danh • chuyên môn" (ảnh lẫn chuyên môn với khu).
  - **"Đang làm việc" → "Bận"**, "Không trong ca" → **"Ngoài ca"** (bộ nhãn chung Sẵn sàng / Bận / Ngoài ca). Ngoài ca thắng Bận; chip tải việc vẫn hiện.
  - **"Giá trị hiện tại" → "Lúc cảnh báo"** (11.8 bar là giá trị BẢN GHI, không phải số trực tiếp); loại không có số (mất tín hiệu, bơm chuyển trạng thái) ẩn ô này.
  - **Ô "Gửi thông báo khẩn cấp ngay" tick sẵn THEO MỨC ĐỘ** (chỉ khi Nghiêm trọng; hàng loạt: có ≥ 1 Nghiêm trọng) – ảnh luôn tick; thêm dòng "Chưa gửi được – chờ backend".
  - **Người Ngoài ca VẪN chọn được** (ảnh: thẻ Lê Hoàng C mờ như bị khoá) – thẻ "mờ" bằng viền đứt + nền trong + tên chữ phụ, KHÔNG opacity (chữ đạt AA), kèm cảnh báo không chặn.
  - Ảnh chọn sẵn Nguyễn Văn A → phân công mới KHÔNG chọn sẵn ai (như modal bảo trì); đổi người chọn sẵn người hiện tại.
  - Số việc tính từ dữ liệu cảnh báo (đã giao chưa xác nhận + đang xử lý): Nguyễn Văn A 2 (ảnh 1), Trần Bình 0 (ảnh "Trần Minh B" 3).
  - Thứ tự danh sách = gợi ý (cùng khu/chuyên môn → Sẵn sàng → Bận → Ngoài ca), không theo ảnh. Ca hiển thị = ca mặc định của người.
  - Chip trạng thái/ca/tải việc dùng `Badge tag` có viền (ảnh: chữ + icon trơn); avatar tròn `Avatar` (ảnh vuông bo góc). Badge mức độ `chip` + ▲ (ảnh viền đỏ nhỏ). Nút "Nháp" `subtle`, "Hủy" `plain` như modal bảo trì.
  - **Phần thêm ngoài ảnh:** dòng giải thích thứ tự sắp xếp, chip gợi ý "Cùng khu · Đúng chuyên môn", vùng lọc (phòng ban, ca, chỉ người trong ca), ô "Lý do đổi người" (đổi người), khối "Sẽ đổi người"/"Bỏ qua" + thẻ "Đã chọn N cảnh báo" (hàng loạt), khối cảnh báo (vàng) + lý do chặn (đỏ), gợi ý dưới ô ghi chú, xác nhận "Bỏ thay đổi" ở chân.
  - Kích thước: ảnh 4× (modal ≈ 1080 px) → `Modal size="xl"` 1072; cột 3fr/2fr; cột phải là khung viền như ảnh.
- **Drawer BÁO CHÁY (ảnh `scratch/figma-ref/alert-drawer-fire-design.png`, FIR-00018, 27/10/2026):**
  - **Badge mức độ:** 3 ảnh dùng 3 kiểu khác nhau (áp suất chip thường, gas "CAO" viết hoa, cháy "• NGHIÊM TRỌNG" viết hoa có chấm + viền) → MỘT kiểu `Badge severity size="chip"` (như drawer áp suất) cho cả 3 loại.
  - **Giờ:** ảnh "Thời gian: 14:32:15 hôm nay" nhưng tiến trình "Phát hiện (14:32:40)" / "Gửi thông báo (14:32:49)" → phát hiện = thời gian cảnh báo, gửi thông báo = +3 s (quy tắc mock chung); tiến trình dùng nhãn quá khứ đã duyệt ("Đã phát hiện (…)"). Mock phát sinh "3 phút trước"; header ghi ngày giờ thật (không chữ "hôm nay").
  - **Tên khu:** "Khu máy hóa hơi (FZ-02)" → tên chung "Trạm hóa hơi" + mã ("Trạm hóa hơi (FZ-02)", `AREA_CODES`); tiêu đề "…tại khu máy hóa hơi" → "…tại trạm hóa hơi".
  - **"Hoạt động"** (Trạng thái đầu báo, mơ hồ) → tách: báo động "Đang báo động" (chữ đỏ) / "Đã phục hồi" + dòng nhỏ "Thiết bị: Trực tuyến / Mất kết nối / Lỗi".
  - **E-101A 68 °C** trùng nhiệt độ đầu báo → nhiệt độ MÁY là tag riêng TT-201 (~45,6 °C), "Đang hoạt động".
  - **GS-02** lặp ở cả "Tín hiệu liên quan" và "Thiết bị liên quan", và khác khu so với drawer gas (GS-02 thuộc Khu nạp xuất) → cảm biến gas trạm hóa hơi là tag mới **GS-05**, chỉ ở "Tín hiệu liên quan"; dòng "Cảm biến Gas GS-02 · Trực tuyến" bỏ khỏi "Thiết bị liên quan".
  - Nút "Xác nhận cảnh báo" ảnh #D34957 → `danger-solid` #B42034 (chữ trắng ≥ 4.5:1). Người phụ trách "Trực ca" = nhóm mặc định của loại (`defaultOwner`) + chữ nhỏ "(chưa phân công cá nhân)" – không ghi vào `assignee`.
  - Cỡ chữ: số nhiệt độ 24 px (`text-xl`), nhãn 12 px, tiêu đề khối 14 px – theo `InfoGrid variant="pairs"`; "Cập nhật cuối" 14 px.
  - **Phần thêm ngoài ảnh:** dòng "Lúc cảnh báo: 68°C" dưới số live; banner xác nhận chéo "Nhiều tín hiệu cùng báo, nguy cơ cháy cao" (khói / gas ≥ cấp 1 / nút nhấn – nút nhấn ghi rõ "Nút nhấn khẩn cấp đã được kích hoạt"); "Nhật ký (n)" + "Lưu ghi chú" (khung chung); chân sau xác nhận / sau khi đóng; modal "Cập nhật xử lý" báo cháy; modal "Quy trình ứng phó cháy" (bản nháp + danh bạ); "Tạo yêu cầu bảo trì" sau báo động giả.
- **Drawer cảnh báo KHÍ GAS (ảnh `scratch/figma-ref/alert-drawer-gas-design.png`, 27/10/2026):**
  - Tiêu đề "Áp suất bồn V-101 vượt ngưỡng" + thiết bị V-101 trong ảnh là chép nhầm từ drawer áp suất → dữ liệu thật ALT-00127: "Cảnh báo rò rỉ Gas nhẹ", GS-04 (chốt GS-04 – bảng Figma; đóng câu GS-01/GS-04).
  - Khu vực "Khu vực nạp LPG" (ảnh) → "Khu nạp xuất" (danh sách khu chung `AREAS`).
  - Dòng cảm biến thứ 3 thiếu tên ("8% LEL") → GS-03; badge "Theo dõi" → "Bình thường" (theo bands, 8 < 10).
  - "+11%" → "+11% LEL"; mọi giá trị một định dạng "25% LEL" (`formatMeasure`) – ảnh lẫn "25%" + "LEL" nhỏ ở số lớn (giữ kiểu số lớn "25%" + "LEL" nhỏ).
  - Badge mức độ "CAO" viết hoa → "Cao" (cùng Badge severity của drawer áp suất / bảng).
  - Ngày "12/10/2026" → ngày thật (ALT-00127 phát sinh 6 phút trước, mock tương đối).
  - Thang: ảnh dải chuyển màu → màu đặc theo token (success · warning/60 · warning · danger), mốc "40 (ESD)" chữ `danger-text` (4.84:1); nhãn vạch nền surface viền primary.
  - Dòng cảm biến gây cảnh báo: ảnh nền sáng hơn → vạch trái 3px theo mức + chữ đậm (nền `surface-muted` làm chữ đỏ mức ESD < 4.5:1); badge mức lót nền đặc.
  - Nút "Cập nhật xử lý" màu xanh nhạt = token `info` có sẵn (Button `variant="info"`, không màu mới).
  - Chỉ số 4 cột: nhãn 12px có thể xuống 2 dòng ở 440px ("Giá trị trước đó", "T/G vượt ngưỡng") – ảnh một dòng (drawer ảnh rộng hơn).
  - **Phần thêm ngoài ảnh:** dòng "Lúc cảnh báo: x" dưới số live; "Đã về dưới ngưỡng"/"Mất tín hiệu" ở chỉ số; Tiến trình + Ghi chú + Nhật ký (thu gọn); modal "Cập nhật xử lý" (điều kiện khoá "Đã xử lý xong" là bổ sung an toàn); modal "Yêu cầu hỗ trợ"; câu banner khi ≥ ESD.
- **Drawer chi tiết cảnh báo (ảnh `scratch/figma-ref/alert-drawer-design.png`, 27/10/2026):**
  - "Giá trị hiện tại" → **"Giá trị lúc cảnh báo"** (số bản ghi) + dòng "Hiện tại: x bar" live PT-101 (ngoài ảnh; "Mất tín hiệu" khi stale). Cảnh báo "dưới ngưỡng": ô phải ghi "Ngưỡng tối thiểu".
  - Tiến trình (đã duyệt 27/10/2026): bước ĐÃ XONG dùng thì quá khứ + giờ cho MỌI bước – ảnh "Phát hiện (10:45:22)" / "Gửi thông báo (10:45:25)" → "Đã phát hiện (10:45:22)" / "Đã gửi thông báo (10:45:25)"; "Đã xác nhận (…)", "Đã xử lý (…)", "Hoàn thành (…)". Bước đang chờ giữ tên trạng thái: ảnh "Chờ xác nhận" → "Chưa xác nhận" (cùng badge/tab/KPI), "Đang xử lý".
  - Hướng dẫn xử lý trước khi xác nhận (đã duyệt): ô khoá bằng `aria-disabled` (vẫn Tab tới) + dòng gợi ý "Xác nhận cảnh báo để bắt đầu xử lý." (ảnh không có dòng này, ô không khoá).
  - Thanh đo bật/tắt theo LOẠI cảnh báo (`ALERT_KINDS[kind].gauge`; `level-drop` = tắt – cảnh báo tốc độ thay đổi) thay vì đoán theo số âm; tắt → câu "Cảnh báo tốc độ thay đổi – không dùng thang đo ngưỡng.".
  - Thời gian ảnh "12/10/2026" → ngày thật của bản ghi (mock ngày tương đối: hôm nay).
  - "Xác minh trạng thái van PR-101" → "van PSV-101" (van an toàn của bồn trong dữ liệu, `SAFETY_VALVES`).
  - "Tên: Bồn chứa LPG" → tên tài sản "Bồn LPG V-101" (`assets.ts`); "Trạng thái" + áp suất + nhiệt độ là số trực tiếp (ảnh "Cảnh báo", 11.8 bar, 31.6 °C – tĩnh).
  - Khu vực: ảnh "Khu bồn LPG" ↔ bảng cảnh báo Figma 70:3032 "Bồn chứa" → gộp về "Khu bồn LPG" cho mọi bản ghi (`AREAS`).
  - Thanh đo: ảnh không theo tỉ lệ (vạch ~89 %, đổi màu ~70 %) → thang 0 → nguy hiểm × 1.2 (0–14.4 bar, đổi màu tại ngưỡng 10.5 = 73 %, vạch 11.8 = 82 %); không có đoạn vàng (chờ duyệt). Nhãn vạch: nền trắng chữ `danger-solid` (ảnh chữ đỏ nhạt hơn – đủ tương phản trên nền trắng).
  - Nút "Xác nhận cảnh báo" nền #D34957 → `danger-solid` #B42034 (chữ trắng 5.07:1). Nút chính cao 44px (`Button size="lg"`), hai nút phụ `subtle` 36px.
  - ALT-00128 đã có MT-00128 (`sourceAlertId`) → nút phải là "Xem MT-00128" thay "Tạo yêu cầu bảo trì" như ảnh (không tạo trùng).
  - Badge mức độ: `chip` 14px chữ thường (ảnh đậm); badge trạng thái `md` (ảnh to + đậm hơn). Tiêu đề mục 18px `fg-secondary` (cùng modal bảo trì; ảnh ~16px). Số thông số 24px (`text-xl`; ảnh ~28px – ô hẹp). Icon nguyên nhân dùng asset `danger`.
  - Khối "Thiết bị liên quan" 14px (ảnh ~16px) để "Trạng thái: Bình thường" không xuống dòng ở 440px.
  - **Phần thêm ngoài ảnh:** gợi ý khoá ở Hướng dẫn ("Xác nhận cảnh báo để bắt đầu…"), giờ tick cạnh bước, "Nhật ký (n)" thu gọn dưới Tiến trình, danh sách ghi chú + "Lưu ghi chú" + gợi ý dưới ô, lỗi "Nhập ghi chú kết quả xử lý…", chân sau xác nhận/hoàn thành, nút "Đổi người phụ trách" khi đã có người, mép trái `border-primary/40` (ảnh có vạch sáng), hộp "Phân công xử lý" (StaffList compact) và "Đánh dấu hoàn thành" hàng loạt (chưa có thiết kế).

### Cảnh báo / Modal cập nhật áp suất

- **Modal "Cập nhật xử lý cảnh báo áp suất" (ảnh `scratch/figma-ref/alert-pressure-update-modal-design.png`, ALT-00128, 28/10/2026):**
  - **Hai danh sách hạng mục được GỘP**: "Kết quả kiểm tra thiết bị" (modal) = "Hướng dẫn xử lý" (drawer) – MỘT danh sách theo loại (`ALERT_KINDS[kind].steps`), một nguồn dữ liệu (`guide`). Chữ theo ảnh modal (6 hạng mục); 3 bước cũ của ảnh drawer đổi chữ ("Kiểm tra đồng hồ áp suất cơ tại hiện trường" → "Đối chiếu PT-101 với đồng hồ cơ", "Xác minh trạng thái van PSV-101" → "Kiểm tra van an toàn PSV-101", "Sẵn sàng kích hoạt hệ thống làm mát / xả áp thủ công" → "Kiểm tra hệ thống làm mát"), giữ id.
  - **Bỏ cột checkbox** của bảng (trạng thái đủ nghĩa); chip trạng thái của ảnh → ô chọn (Chưa kiểm tra / Đạt / Có vấn đề / Không áp dụng); ghi chú sửa inline (ảnh "…").
  - "Kiểm tra bộ điều áp PR-" (ảnh bị cắt) → "Kiểm tra bộ điều áp PR-101".
  - "Vấn đề phát sinh": ảnh có HAI ô "Không có vấn đề phát sinh" → giữ một (5 ô, "Khác" đứng riêng hàng cuối).
  - Thời gian bắt đầu "10:45 24/10/2023" → ngày giờ thật của bản ghi ("HH:mm:ss - dd/mm/yyyy" như drawer); "Giá trị phát hiện" → "Giá trị lúc cảnh báo" (cùng drawer); "V-101 – Bồn chứa LPG" → tên tài sản "Bồn LPG V-101".
  - Thông số: "Sau" của áp suất = số trực tiếp (ảnh 10.8 – vẫn trên ngưỡng 10.5, theo luật mới không đóng được); 11.8 bar ảnh tô đỏ → **vàng** (warning) vì < mức nguy hiểm 12 của cấu hình (đỏ chỉ khi ≥ nguy hiểm); số kèm đơn vị trong ô ("11.8 bar", ảnh chỉ số cho áp suất); một chữ số lẻ.
  - **Giờ kiểm tra lại tự tính** = lúc lưu + thời gian theo dõi (ảnh "14 : 36" là ô nhập); chỉ sửa được khi "Tùy chỉnh"; khối theo dõi khoá khi chưa chọn "Đã xử lý". Mục tiêu "< 10. 0 bar" → "< 10 bar" (ô số tiền tố "<").
  - **Điều kiện khoá "Đã xử lý"** (ngoài ảnh): live < ngưỡng cảnh báo VÀ sau xử lý < ngưỡng; mất tín hiệu → đồng hồ cơ + số đo tay. "Hệ thống đã trở về bình thường" khoá cùng điều kiện.
  - ~~Modal chỉ áp dụng loại áp suất bồn; gas/cháy giữ modal gọn~~ → từ 5N (28/10/2026) là khung chung `AlertUpdateModal` cho áp suất / gas / cháy (xem mục dưới); `pressure-high` dùng "Đánh dấu đã xử lý" (→ Đã xử lý, chờ đóng).
  - Ô trạng thái/vấn đề/theo dõi dùng `StatusOptionGroup` inline có chấm radio (ảnh chữ giữa, không chấm); ô được chọn viền + nền primary nhạt như ảnh. Thẻ đầu 4 cột (`InfoGrid`, ảnh 5 cột); badge trạng thái thay chữ xanh "Đang xử lý". Thẻ tệp: ảnh viền trắng → `AttachmentCard fluid` dùng chung.
  - **Phần thêm ngoài ảnh:** lý do khoá dưới 5 ô trạng thái, ô lý do + danh sách người hỗ trợ (Tạm dừng / Cần hỗ trợ), dòng giải thích Trước/Sau, gợi ý dưới mục xác minh, khối mâu thuẫn, gợi ý "Chuyển sang Cần hỗ trợ", ô mô tả "Khác", dòng "Tự tạo lại cảnh báo… chờ backend", khối cảnh báo (vàng) + lý do chặn (đỏ), xác nhận "Bỏ thay đổi" ở chân, dòng "Bản nháp đã được khôi phục.", cờ Tạm dừng/Cần hỗ trợ và "Đang theo dõi đến …" ở drawer + bảng.

### Cảnh báo / Modal cập nhật – gas và cháy dựng theo khung áp suất (28/10/2026, 5N)

- Chưa có thiết kế riêng cho modal cập nhật gas / cháy → dựng theo **khung Figma áp suất** (cùng thứ tự khối, cùng component); tiêu đề theo loại ("Cập nhật xử lý cảnh báo rò rỉ khí" / "… báo cháy"). Modal gọn cũ (`GasUpdateModal`, `FireUpdateModal`, không có thiết kế) bỏ. Câu hỏi thiết kế riêng: `docs/questions.md`.
- Gas: thông số = GS-04 + từng cảm biến gas cùng khu (một dòng/cảm biến, màu theo bands); nguồn xác minh đổi chữ "Đồng hồ cơ" → "Máy đo cầm tay"; 4 mục xác minh mới (không ràng buộc).
- Cháy: 6 ô trạng thái (ô "Đã xử lý" tách "Đã xử lý sự cố" / "Báo động giả", lưới 3 cột thay 5); không có "Nguồn xác minh" (chỉ số cảm biến, ô Sau không nhập tay); dòng khói SD-02 hiện CHỮ trạng thái ("Bình thường" / "Báo động") thay số; "Giá trị mục tiêu" hiện "Không có mục tiêu số".

### Cảnh báo / Modal xác nhận đóng + tab "Chờ đóng" (ảnh `scratch/figma-ref/alert-close-modal-{header,body,footer}.png`, 28/10/2026)

- **Nguyên nhân "Trôi cảm biến" (ảnh modal đóng) không khớp mục xác minh của modal cập nhật**: modal cập nhật không có mục/nguyên nhân chọn sẵn "Trôi cảm biến" (gần nhất là xác minh "Cảm biến PT-101 có sai lệch"; nguyên nhân là ô nhập tự do). Modal đóng hiện nguyên văn ô "Nguyên nhân xử lý" đã nhập – playground mục 17 điền "Trôi cảm biến" để khớp ảnh.
- **Áp suất sau xử lý: ảnh modal đóng 9.8 bar vs ảnh modal cập nhật 10.8 bar** (cùng ALT-00128). 10.8 ≥ ngưỡng 10.5 → theo luật không chọn được "Đã xử lý", nên modal đóng chỉ có thể hiện số < ngưỡng; dữ liệu dùng số đã lưu ở lần cập nhật ("Sau" của dòng chính, thiếu → `closingReading`). Playground dùng 9.8 như ảnh đóng.
- **Thời gian theo dõi ở HAI nơi** (khối "Theo dõi sau xử lý" của modal cập nhật + select "Thời gian theo dõi sau xử lý" của modal đóng): chỉ lưu MỘT giá trị (`followUp`) – modal đóng điền sẵn số phút đã chọn, sửa được (đổi → tính lại từ lúc lưu). Ảnh "2 Giờ (Mặc định)" vs cấu hình áp suất mặc định 30 phút → nhãn "(Mặc định)" gắn theo cấu hình loại (ALT-00128 hiện "30 phút (Mặc định)"; mẫu ảnh có 2 giờ đã chọn nên hiện "2 Giờ"). Nhãn "Giờ" viết hoa theo ảnh.
- 3 mục có `*` là điều kiện HỆ THỐNG (tự tick, không bấm được); ảnh cho tick tay. Mục sai: không tick được + lý do (vàng) + link cảnh báo liên quan dưới mục. Thêm dòng chú thích "Mục có * do hệ thống kiểm tra…".
- Icon tam giác ở thẻ đầu: ảnh viền đỏ → icon `danger` đặc có sẵn (cùng drawer). Ô tick: màu `info` (token Checkbox chung) thay xanh ngọc ảnh. Nhãn mục "Nguyên nhân:" / "Hành động:" và thẻ con theo token (bo `lg`/`md`, viền `line-card`); thẻ đầu không có viền trái màu.
- Nút "Xác nhận đóng cảnh báo": ảnh nền xanh ngọc mờ (trông như đang khoá) → Button `primary` + `aria-disabled` (mờ 50 %) đến khi đủ 3 điều kiện + ghi chú + người đóng hợp lệ; lý do khoá hiện dưới thân ("Chưa đóng được – còn thiếu: …"). "Hủy" đưa về cùng cụm nút bên phải như ảnh.
- **Phần thêm ngoài ảnh:** gợi ý dưới ô ghi chú và select theo dõi, cảnh báo "người đóng phải khác người xử lý" (mức Nghiêm trọng), dòng lý do khoá, vùng thông báo. Thời gian thẻ đầu "10:45 → 11:30" = giờ cảnh báo → giờ Đã xử lý (`resolvedAt`).
- **Tab "Chờ đóng" (ngoài Figma 70:3005)** giữa "Đang xử lý" và "Đã hoàn thành" cho trạng thái Đã xử lý; 5 KPI giữ như Figma (Đã xử lý không vào ô KPI nào). Badge "Đã xử lý" xanh (như ảnh đóng), "Hoàn thành" trung tính (bảng Figma ghi "Đã hoàn thành" xanh cho dòng đã xong). Thao tác hàng loạt "Đánh dấu hoàn thành" → "Đóng cảnh báo". Chip "Đến giờ kiểm tra lại" (vàng) dưới badge khi hết giờ theo dõi.

## Bảo trì (/maintenance)

- **Modal "Phân công người xử lý" (ảnh `mt-assign-modal-design.png`, 27/10/2026):**
  - Trạng thái "Chờ phân công" (ảnh) → nhãn hiện tại của app "Chờ tiếp nhận" (`STATUS_LABEL`).
  - Tiêu đề "Kiểm tra van an toàn PSV-101" (ảnh) ≠ MT-00128 "Kiểm tra van an toàn V-101" → hiện tiêu đề bản ghi (playground dùng tiêu đề ảnh).
  - Nền trang trong ảnh là bản cũ ("Quá hạn 2 ngày", 128 yêu cầu) – trang thật hiện dữ liệu hiện tại ("Hết hạn hôm nay").
  - Avatar ô trắng giữ chỗ → chữ cái đầu theo token (`Avatar`).
  - Dòng "Gửi thông báo đẩy và SMS…" không có công tắc trong ảnh → thêm `Switch` (bật = primary) + dòng phụ "Chưa gửi được – chờ backend".
  - Ảnh chọn sẵn Nguyễn Văn A → KHÔNG chọn sẵn ai (yêu cầu); lọc ca ảnh đặt sẵn "Ca 2" → mặc định "Tất cả ca".
  - Ca: trang chi tiết MT-00128 ghi Ca 1, ảnh modal Ca 2 → modal giữ ca của bản ghi (Ca 1), nên chọn Nguyễn Văn A + bắt đầu 14:00 hiện cảnh báo "không thuộc Ca 1".
  - Tên nhân sự giữ như dữ liệu yêu cầu mẫu (Trần Bình, Lê Thị C…) – ảnh "Trần Minh B", "Lê Hoàng C"; số việc tính từ dữ liệu (Nguyễn Văn A 3 đang làm (1 quá hạn) → Bận, ảnh "1 Đang làm · Sẵn sàng").
  - Chip "x đang làm (y quá hạn)": có quá hạn → cả chip tone danger (ảnh viền đỏ) + lót nền đặc (tương phản ≥ 4.5:1 cả khi thẻ được chọn); chữ thường "đang làm"/"quá hạn" (ảnh viết hoa "Đang làm"/"Quá hạn").
  - Bắt đầu/Hạn chót: ô ngày giờ gốc (`datetime-local`, định dạng theo trình duyệt, `color-scheme: dark`) – ảnh "Hôm nay, 14:00" + icon lịch/đồng hồ.
  - **Cỡ nhãn ô cột phải: giữ FormField dùng chung 12px** (ảnh phân công ~16px). Đã đối chiếu ảnh modal Tạo yêu cầu (`mt-create-modal-design.png`): nhãn nhỏ, khớp FormField 12px → chỉ ảnh phân công lệch, không đổi FormField toàn app.
  - Cảnh báo lệch ca thêm nút "Đổi sang Ca …" (ngoài ảnh); modal giữ ca của bản ghi. Badge mức độ `md` có icon (ảnh nhỏ hơn, viền). Không có icon bảng kẹp trước "Trạng thái:".
  - **Phần thêm ngoài ảnh:** khối cảnh báo (vàng) và khối lý do chặn (đỏ) dưới cột phải; ô "Lý do đổi người xử lý" (chế độ đổi người, tiêu đề modal "Đổi người xử lý"); gợi ý dưới ô ghi chú; empty state + "Xóa bộ lọc"; xác nhận "Bỏ thay đổi" ở chân modal; nút "Hủy" ở chân trái như ảnh.
  - Kích thước: ảnh modal ≈ 1090 px → `Modal size="xl"` 1072; cột trái/phải 2fr/3fr (ảnh ≈ 552/840).
- **Hai modal nghiệm thu (ảnh `mt-submit-review-modal-design.png` / `mt-review-modal-design.png`, 27/10/2026):**
  - Hai tên người nghiệm thu khác nhau (Trần Hoàng Nam / Trần Văn B) → MỘT người nhất quán: chọn khi gửi = hiện ở modal nghiệm thu (đăng nhập thật: người đang đăng nhập). Cả hai tên có trong `REVIEWERS` (mock). Ô chọn không có avatar tròn như ảnh. Ô chỉ đọc ở modal nghiệm thu ghi "tên (chức danh)".
  - Nguyên nhân khác nhau giữa hai modal ("Độ trễ cảm biến do bụi bẩn…" vs "Trễ tín hiệu cảm biến hành trình…") → một nguồn `submission.cause`.
  - Modal Gửi không có ô **Biện pháp** (modal Nghiệm thu lại hiển thị) → thêm ô Biện pháp bắt buộc, trải ngang dưới hàng Checklist/Nguyên nhân.
  - Checklist "7/7" với tên mục khác checklist MT-00128 (7 mục khác, 1 N/A) → luôn dùng checklist THẬT của yêu cầu; mock MT-00109 mang đúng 7 tên mục trong ảnh để so ảnh.
  - "Ngưỡng: 30." (dấu chấm thừa; ngưỡng nhiệt độ chưa có trong ảnh) → "Ngưỡng: 40" lấy từ cấu hình tag (`alarms.temperature.warn` V-101), định dạng số bỏ số 0/dấu chấm thừa.
  - Tiêu đề "Kiểm tra van an toàn PSV-101" (ảnh) ≠ MT-00128 "Kiểm tra van an toàn V-101" → hiện tiêu đề của bản ghi (playground dùng tiêu đề ảnh).
  - Thiết bị "V-101 – Bồn chứa LPG" → tên tài sản "Bồn LPG V-101" (`assets.ts`).
  - **Phần thêm ngoài ảnh:** danh sách mục thiếu dưới thẻ đầu (khi chưa đủ điều kiện), gợi ý dưới ô (người nghiệm thu, thời gian, ý kiến), dòng "số liệu trực tiếp – được chụp lại lúc gửi", câu cảnh báo "Chưa khắc phục", dòng "Hiện tại: …" (live) dưới số đã chụp, dòng "Cảm biến: …" dưới trạng thái van, dòng tóm tắt + tình trạng + người gửi dưới Chi tiết kết quả, xác nhận "Bỏ thay đổi" ở chân modal.
  - Ô Áp suất/Nhiệt độ ở modal Gửi: số trực tiếp (trắng khi bình thường, vàng/đỏ khi vượt ngưỡng; ảnh 9.8 bar / 29.4 °C tĩnh). Cảm biến/Van xả là ô chọn (ảnh: chữ xanh tĩnh). Ở modal Nghiệm thu số chụp xanh khi dưới ngưỡng (như ảnh).
  - "Thời gian đề nghị": ô datetime gốc (ảnh "Hôm nay, 15:30" + icon lịch), **mặc định = lúc mở modal + 30 phút, làm tròn lên mốc 15 phút** (`defaultProposedAt(now)`, giờ nhà máy; vd mở 14:58 → 15:30), sửa được, không bắt buộc. "Thời gian theo dõi thêm" mặc định 2 giờ (như ảnh), khoá khi không chọn Đạt.
  - Kích thước: ảnh 3× (modal ≈ 1080 px) → `Modal size="xl"` 1072; ô kết quả cao ~50 px (`layout="inline"`), ô tình trạng ~76 px như modal tiến độ; footer modal Gửi "Hủy" chữ trơn + "Lưu nháp" `subtle` (ảnh viền) như modal tiến độ; "Hủy bỏ" modal Nghiệm thu = `subtle` (ảnh viền). Ô "Đạt yêu cầu" giữ `primary`; chữ "Không đạt" `danger-text` cả khi chưa chọn (axe đạt ở cả hai trạng thái).
- **Modal "Cập nhật tiến độ bảo trì" (ảnh `mt-progress-modal-design.png`, 26/10/2026):**
  - Hai số tiến độ trong ảnh (ô "Tiến độ" 28 % vs thanh "Tiến độ hoàn thành" 50 %): ô = tiến độ báo cáo gần nhất (`reportedProgress`, thiếu → tiến độ checklist), thanh = giá trị đang báo (mặc định = ô, làm tròn bước 5). Tiến độ checklist giữ riêng: dòng "Checklist x/y · Mở checklist" dưới thanh (ảnh không có checklist trong modal – phần thêm theo yêu cầu).
  - **Phần thêm ngoài Figma:** nút kéo tròn 16 px trên thanh tiến độ (ảnh chỉ có thanh, không nút kéo) – để thấy được là kéo được và có chỗ hiện viền focus; dòng gợi ý dưới ô nội dung; nhãn "Chưa tải lên máy chủ" + nút bỏ tệp trên thẻ tệp tạm; xác nhận "Bỏ các thay đổi chưa lưu?" ở chân modal; dòng "Bản nháp" khi mở lại nháp.
  - "Hoàn thành" map sang **Chờ nghiệm thu** (`review`), không phải Hoàn thành; chọn ô này đặt thanh = 100 % (sửa được) và bắt buộc nội dung. Từ "Đã phân công" ô này bị khoá (phải bắt đầu trước – không nhảy bước).
  - Kích thước: modal ảnh ~1160 px → `Modal size="xl"` 1072 px; header modal giữ nền `surface-raised` của Modal (ảnh cùng nền thân); các tiêu đề mục đồng nhất `fg-secondary` 18 px (ảnh "Ảnh và tài liệu" trắng, các mục khác xám); "Lưu nháp" = Button `subtle` (ảnh: viền xám, nền trong); "Hủy" = Button `plain` mới. Thẻ tệp giãn đều 4 cột (ảnh ~255 px) thay vì 235 px cố định.
  - Màu ô trạng thái khi chọn: Đang thực hiện/Hoàn thành `primary` (như ảnh), Tạm dừng `warning`, Gặp sự cố `danger` (ảnh không vẽ). Hạn chót đỏ khi quá hạn hoặc còn ≤ 2 giờ (`NEAR_DUE_MS`); hạn khác ngày ghi thêm "dd/mm".
- **Chi tiết yêu cầu bảo trì MT-00128 (ảnh, 26/10/2026):**
  - Dữ liệu: tiêu đề "PSV-101" (danh sách 70:3964) → "V-101" theo ảnh chi tiết; khu vực "Khu bồn LPG" (khác "Bồn chứa" của các bản ghi V-101 khác → bộ lọc Khu vực có thêm mục); MT-00128 đổi sang chưa phân công + hạn 16:00 hôm nay → thẻ ưu tiên ở /maintenance không còn "Quá hạn 2 ngày" như Figma danh sách; MT-00118 (bản ghi bổ sung) dời hạn −1 ngày để KPI "Quá hạn" giữ 04 lúc đầu ngày. Phòng ban dùng danh mục "Bảo trì Cơ khí" (ảnh "Bảo trì cơ khí").
  - Quá hạn theo GIỜ: KPI "Quá hạn" ở /maintenance đổi trong ngày (mock: 04 trước 14:00 → 05 → 06 từ 16:00 → 08 lúc 23:59:59); Figma danh sách ghi 05 – không ép số mock cho khớp.
  - "Cảnh báo liên quan": nhãn "Hiện tại" → "Lúc cảnh báo" (giá trị lúc phát sinh, không phải số trực tiếp); nội dung lấy từ ALT-00128 ("Áp suất bồn V-101 vượt ngưỡng", ảnh "Áp suất V-101 vượt ngưỡng cảnh báo 1"). Badge mức độ nhỏ dạng viền (`outline`).
  - "Thiết bị liên quan": số trực tiếp PT-101/TT-101 + mức % thể tích (không phải 11,8 bar / 25 °C / 65 %); tên = tên tài sản "Bồn LPG V-101" (ảnh "Bồn chứa LPG"); chấm theo tag xấu nhất (ảnh chấm vàng cạnh áp suất đỏ).
  - Tiến độ checklist 2/6 · 33 % (bỏ mục Không áp dụng; ảnh 2/7 · 28 %); lịch sử ghi "Nghiêm trọng" (ảnh "Critical"); giờ checklist/ghi chú dạng 24 h "10:15" (ảnh "10:15 AM", lịch sử ảnh lại dùng 24 h); nhãn mục N/A bỏ "(Không áp dụng)" trong chữ vì đã có chip.
  - "Loại công việc" = nhãn loại của form + "(Khẩn cấp)" khi Nghiêm trọng → "Kiểm tra / Hiệu chuẩn (Khẩn cấp)" (ảnh "Kiểm tra định kỳ (Khẩn cấp)"); badge "Bảo trì khẩn cấp" suy từ mức Nghiêm trọng.
  - Kích thước: đồng hồ ~40 px → token `3xl` 32 px (quá hạn `2xl`); badge header đã sửa về 14 px thường (`Badge severity size="chip"`, cùng cỡ status/tag md); khoảng cách hàng InfoGrid đều 20 px (ảnh hàng 3–4 thưa hơn – không đều); thẻ tệp 235×110 (đo lại trên ảnh 1565). **Phần thêm ngoài Figma:** nút "← Quay lại danh sách" ở góc phải header (ảnh không có – đã duyệt; nằm cùng hàng tiêu đề nên không đổi chiều cao header/vị trí stepper ở 1565). Dưới 1280 px ô "Hạn chót" lên đầu (Figma chỉ có khung 1565).
  - Màu (đọc pixel): vạch checklist #22D3EE = `primary`; bong bóng ghi chú #232A34 = `surface-muted/60`; nền card #0B1626 → giữ `surface`; dải "Hạn hoàn thành" ảnh #370812 đỏ sẫm hơn `danger-strong/15` (không tạo token mới).
- Form bảo trì: mức ưu tiên 3 nút (Thường = medium); thêm * cho Thiết bị và Hạn; tổng quan ghi "Nghiêm trọng" thay "Critical"; loại trong form dùng nhãn đầy đủ (bảng dùng nhãn ngắn).

## Chi tiết tài sản (/map/:assetId)

- **Chi tiết tài sản V-101 (ảnh, 23/10/2026):**
  - Số trong hình cắt (21,08 % / 76,02 %) khác bảng (21,8 % / 76,2 %) → dùng số bảng; mọi % hiển thị 1 chữ số lẻ, dấu chấm (ảnh: hình cắt dùng dấu phẩy, bảng dùng dấu chấm).
  - "Mức bồn" trong ảnh = 76,2 % = đúng số "LPG lỏng" → đổi định nghĩa: **Mức bồn = % thể tích toàn bộ chất lỏng (LPG + nước)** ≈ 78,2 % (cùng cách tính KPI "Mức bồn V-101" ở Tổng quan), có tooltip ⓘ; chờ bảng dung tích thật.
  - Thể tích suy từ kích thước: D 1,9 × L 4,8 m = 13,61 m³ → LPG 10,4 m³ · nước 0,27 m³ khớp ảnh, pha hơi ra 3,0 m³ (ảnh 2,9). Số dao động theo mock live (LT-101 ±0,3).
  - Kích thước V-101 ở cảnh Tổng quan (mặc định 4,4 × 11 m) khác trang chi tiết (1,9 × 4,8 m) – xem docs/guide/app-structure.md (mục 8).
  - "Tồn kho 152,0 Nm³" khác KPI Tồn kho Tổng quan (152,340 Nm³ toàn nhà máy) và không suy ra được từ 10,4 m³ lỏng → giữ số ảnh, đánh dấu số tạm.
  - Ngày bảo trì ảnh là năm 2024 (15/9/2024, 12/3/2024) → tính từ dữ liệu bảo trì theo ngày tương đối: tiếp theo = việc chưa xong có hạn sớm nhất (hiện MT-00109 quá hạn 4 ngày → hiện "Quá hạn"), gần nhất = MT-00100 (thêm vào mock, hoàn thành −46 ngày).
  - "Tự chuẩn chẩn đoán" → "Tự chẩn đoán". Cảnh báo liên quan lấy từ danh sách cảnh báo (ALT-00128/116/112) thay vì 3 dòng mẫu trong ảnh.
  - Hình cắt vẽ phẳng theo token (ảnh là render 3D bóng bẩy), giữ đúng tỉ lệ dài/đường kính nên dẹt hơn ảnh. Màu: LPG `info`, pha hơi `neutral`, nước `warning`; loại sự kiện: Cảm biến `info`, Vận hành `warning`, Hệ thống `fg-secondary`, Cảnh báo `danger`.
  - Figma 53:470 (Cảnh báo ưu tiên Tổng quan) ghi "PT-101 – Áp suất đầu vào hóa hơi cao" → đổi thành PT-201 vì PT-101 nay là áp suất bồn V-101 (đã duyệt); mock cảnh báo ALT-00113 cũng chuyển PT-201.

## Báo cáo (/reports)

- **Báo cáo vận hành định kỳ (ảnh 29/10/2026, 5O):**
  - **Số liệu ảnh tự mâu thuẫn → tính từ danh sách:** tab "Tất cả" 186 ≠ 176 + 6 + 2 + 1 = 185; 1/1 → 24/6 chỉ có 175 ngày (ảnh 176); KPI 186 = 4 + 6 + 168 + 8 coi 4 nhóm là tách rời → app giữ tách rời, với `?now=2026-06-24T18:30` ra 184 / ngày 175 / đã ký 166; Đang thực hiện 4, Chờ xác nhận 6 (2/2/2), Thiếu dữ liệu 8, Tiến độ tháng 06 19/24 khớp ảnh. "Đang thực hiện 4" (KPI, mọi kỳ) vs "1" (thẻ tháng, chỉ báo cáo ngày tháng 06) – không mâu thuẫn.
  - Dòng 24/06: ảnh "5/6 mốc, thiếu 18:00, cập nhật 14:05" – mốc 16:00 đã có lúc 14:05 là vô lý → mock lấy mốc theo giờ hiện tại (18:30 → cập nhật 16:05). Người duyệt 18–23/06 xoay vòng 2 người (ảnh không theo quy luật). Ảnh hiện 7 dòng nhưng ghi "1-10" → hiện đủ 10.
  - Mô tả trang chép từ Bảo trì ("…tiến độ bảo trì thiết bị…") → viết lại cho báo cáo (docs/questions.md 12.1).
  - "Lịch báo cáo sắp tới": ảnh chỉ dòng quý ghi "17:00 - 30/06/2026" → mọi dòng chỉ "Hạn chót: HH:mm" (ngày đã ở ô ngày; trình đọc màn hình nghe "Thứ 3, 30/06/2026").
  - "Rows per page" → "Số dòng mỗi trang" (`<select>` gốc 10/20/50); "Hiển thị 1-10 của 175" giữ dạng ảnh. Ô ngày `mm/dd/yyyy` là ô ngày gốc của trình duyệt (định dạng theo máy người xem, như ảnh).
  - Thanh lọc: ảnh có ô có/không mũi tên → mọi ô lọc là Select có mũi tên, chưa chọn chỉ hiện nhãn (`hideAllInTrigger`); có "Tất cả" trong danh sách để bỏ từng lọc. Bỏ icon phễu (chưa biết chức năng – 12.4). "Xóa bộ lọc" mờ khi không có lọc.
  - Thẻ: tiêu đề `text-md` 16 (ảnh ~18) theo Card chung; KPI dùng `compact dense` (số 28 đậm, dòng phụ 11 ~ ảnh 12). Viền KPI: primary/80, warning/80, success/70; viền đỏ giữ `danger-strong/50` như KPI "Quá hạn" Bảo trì (ảnh hơi sáng hơn).
  - Badge bảng dùng `Badge tag sm` (10 px đậm, cao 18) – ảnh ~11 px, cao ~20. Mã báo cáo một dòng (ảnh xuống dòng sau "BCVH-N-" do cột hẹp); mã tô `info` như ảnh nhưng là chữ, không phải link (chưa có màn chi tiết).
  - Dòng ⓘ dưới tab đổi theo tab (ảnh chỉ có câu của tab ngày; câu các tab khác là app tự viết). Số đếm tab đang chọn tô `info` như ảnh.

## Bản đồ 3D

- Màu cảnh 3D (đọc pixel ảnh 53:244): #061123 → bg-app, #343C4C → line, #C1C0C8 → neutral (alias, lệch < 5%); `scene-flow` #94D9C4 là token mới.
- 3D-2: hướng sáng suy từ ảnh (mặt trên sáng nhất ~#B4B4BA, mặt đứng ~#9x, hốc ngả xanh, bóng gần như không thấy phía trước vật) → key trên cao phía camera + hemisphere mạnh; mái che không đổ bóng; nhãn 3D nền trong mờ (/85 + blur) thay vì đặc như Figma (yêu cầu 3D-2).

## Chung toàn app (màu, khoảng cách, nội dung, responsive, form)

- Nội dung: "nghiệm"→"nghiêm"; "Giátrị"→"Giá trị"; Mã CB trống → ALT-00124; layer ẩn "Đang chạy" (opacity-0) bỏ; "Đang xử lý" (bảng bảo trì) → "Đang thực hiện"; MT-00128 quá hạn theo thẻ (−2 ngày); ngày Bảo trì tính tương đối (Figma: hôm nay = 15/10).
- Responsive (Figma chỉ có 1565): dưới 1520px KPI Cảnh báo/Bảo trì/Tổng quan 3 cột (hết cắt chữ), menu chỉ icon 1280–1519, nút Menu dưới 1280; bảng cuộn ngang trong khung thay vì ép cột.
- Tương phản (26/10/2026, đã duyệt – sai khác CÓ CHỦ ĐÍCH): chữ đỏ `danger-text` #DC6D79 sáng hơn Figma #D34957 ~20 % – áp cho MỌI chữ đỏ cỡ thường, kể cả chỗ Figma dùng #FA2439 mờ 70–80 % ("Active", "Xem chi tiết", "PT-201") (viền/nền/icon giữ màu cũ); nền đặc có chữ trắng `danger-solid` #B42034 (tối hơn #D34957 của Figma); "Xem chi tiết" KPI Cảnh báo luôn gạch chân + "→" (Figma chỉ chữ); số chuông nền nhạt hơn + viền mảnh; chữ menu chưa chọn `fg-secondary/70` (#8994A0) – **hơi ngả xanh** so với xám trung tính Figma (#737373 opacity 70 → #55595E).
- Hành vi: ảnh bản đồ giữ đúng tỉ lệ (Figma giãn ~14%); hàng chart giữ opacity 70%; nút "Hôm nay" bên Bảo trì mặc định "Tất cả thời gian"; Tabs Cảnh báo thêm chip đếm + phân trang; bộ lọc Cảnh báo = Mức độ/Khu vực/Thiết bị/Thời gian.
- Màu gần trùng gộp về token: `#DDE3E7`/`#DEE3E7`, `#BBC9CF`/`#BDC8D2`, `#FFBB43`/`#FFC247`, `#B9C8DE`→neutral, `#10B981`→success, `#E42427`→danger-strong, `#DAC419`→warning; viền đỏ KPI → `danger-strong/50`.
- Khoảng cách/cỡ chữ: padding/gap Tổng quan 30/31→32px; mô tả trang 14px; breadcrumb 15→14px; bo góc KPI compact 6→8px; tiêu đề card Lịch 20→16px; badge thẻ ưu tiên 14px→`Badge md`; viền thẻ ưu tiên đồng nhất (trái 3px + tone/30).
- Dữ liệu: KPI, số đếm và tab đều tính từ data (không dùng số tĩnh Figma); thanh tiêu thụ theo `max = 170`.
- Tương phản (21/10/2026, lệch nhỏ tự chuẩn hoá): `text-fg-muted/60` → `/65` (ΔE 3.4, 4.46 → 5.0:1), `text-fg-secondary/50` → `/60` (placeholder/giá trị trống của Select, 3.5 → 4.5:1). Màu lệch lớn chờ duyệt – mục 7.
