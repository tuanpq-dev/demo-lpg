# Câu hỏi cho designer / khách – Digital Twin LPG

Xuất từ `CLAUDE.md` mục 7 ngày 27/10/2026, nhóm theo màn. Mỗi câu ghi phương án app **đang dùng tạm** để mọi người trả lời theo kiểu "giữ" / "đổi thành …".
Ảnh tham chiếu nằm ở `scratch/figma-ref/` (chỉ máy dev). Các sai khác nhỏ đã tự chuẩn hoá (cỡ chữ, khoảng cách, màu gần token) không lặp lại ở đây – xem `docs/figma-diffs.md`.

Ký hiệu: **[D]** = hỏi designer · **[K]** = hỏi khách / PO · ~~gạch~~ = đã duyệt, chỉ cần xác nhận lại.

---

## 1. Chung toàn app

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 1.1 | [D] Chữ đỏ toàn app sáng hơn Figma ~20 % để đạt tương phản AA. Designer có đồng ý không? | Chữ: `danger-text` #DC6D79. Viền, nền, icon vẫn #D34957. Nền đặc có chữ trắng: `danger-solid` #B42034 (tối hơn). PO đã duyệt 26/10. |
| 1.2 | [D] Chữ menu chưa chọn (Figma 2.43:1, không đạt) | `fg-secondary/70` #8994A0 (5.56:1), hơi ngả xanh so với xám trung tính của Figma. |
| 1.3 | [D] Menu "Vận hành" có mũi tên dropdown – menu con gồm những gì? | Khách chốt 30/10: Vận hành · Nhật ký vận hành · AI mô phỏng sự cố (`/operations/overview|logs|ai-simulation`, tạm dùng `SimplePage`). Chưa có thiết kế dropdown – dựng theo kiểu menu tài khoản; chevron Figma màu tối (#3B4048, ảnh `<img>`) nay mục đã bật – cần icon chevron sáng hơn. |
| 1.4 | [D] Các phần **chưa có thiết kế**: trang 404, thanh thao tác hàng loạt (+ hộp "Đánh dấu hoàn thành" / "Phân công xử lý" của cảnh báo), chân drawer cảnh báo sau khi xác nhận, checkbox đã tick, badge "Đã phân công" / "Chờ nghiệm thu", trang `/map` (bản đồ toàn nhà máy), `/reports`, Scene Editor. | Dựng theo token sẵn có, cùng ngôn ngữ với các màn đã có ảnh. |
| 1.5 | [D] Các form/modal mới có ảnh, chưa có node Figma – cần node để lấy số đo chính xác. | Số đo ước lượng từ ảnh, gom trong `tokens.css`. |
| 1.6 | [D] Icon chỉ có trong ảnh (AlertCircle, History, Map, Focus, Info, chevron phân trang, ghim vị trí, bản active của icon nav Bản đồ/Vận hành/Báo cáo) | Icon SVG tạm (`TempIcons`). |
| 1.7 | [K] Số liệu chất lượng "uncertain" (không chắc chắn) hiển thị thế nào? | Hiển thị như số bình thường. |

## 2. Tổng quan (`/overview`, Figma 53:11)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 2.1 | [D] Hàng chart để opacity 70 % – có cố ý không? | Giữ 70 % như Figma. |
| 2.2 | [D] Figma kéo giãn ảnh bản đồ ~14 % – có cố ý không? | Giữ đúng tỉ lệ ảnh (không giãn). |
| 2.3 | [K] KPI "Mức bồn V-101" là % chiều cao hay % thể tích? | % **thể tích** quy đổi từ LT-101 (~78,2 %, khớp bảng lớp ở trang V-101). Figma ghi số tĩnh 76,02. |
| 2.4 | [K] Bảng dung tích bồn (strapping table) | Công thức bồn trụ nằm, bỏ qua đáy elip. |
| 2.5 | [K] Tên tag SCADA thật (INV-TOTAL, PT-100, FQ-100, LT-101, LT-101W, PT-101, TT-101, PT-201…) | Tên giả định, gom một chỗ (`features/live/tags.ts`). |
| 2.6 | [D] Cảnh 3D còn lệch Figma: ống mảnh hơn (0,18 m so với ~0,3 m), thiếu giàn ống nhỏ, cụm bơm/lọc thưa hơn, cabin xe chưa bo tròn, chưa có nét blueprint góc trái. Có cần bám sát hơn không? | Đang dựng theo dữ liệu cảnh hiện có. Hover/chọn tự dựng theo token (Figma không vẽ). |

## 3. Chi tiết tài sản V-101 (`/map/V-101`, ảnh 5D)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 3.1 | [K] Định nghĩa "Tồn kho" (Nm³) của một bồn | Giữ 152,0 Nm³ như ảnh, đánh dấu là số tạm (tooltip ghi chú). |
| 3.2 | [K] Định nghĩa "Dự kiến N ngày", "Sức khỏe thiết bị", "Tình trạng hồ sơ" | Số tĩnh như ảnh (12 ngày, 98 %, 100 %), đánh dấu số tạm. |
| 3.3 | [K] "V-101 DOME" là nhiệt độ vòm hay nhiệt độ LPG? | Dùng TT-101 (nhiệt độ LPG). |
| 3.4 | [K] "Mức bồn" trong ảnh (76,2 %) trùng số "LPG lỏng" | Mức bồn = % thể tích toàn bộ chất lỏng (LPG + nước) ≈ 78,2 %, có tooltip ⓘ. |
| 3.5 | [D] "Đăng nhập hệ thống" được xếp loại **Cảnh báo** trong bảng sự kiện – có đúng không? | Giữ như ảnh. |
| 3.6 | [D] Chú thích ảnh chỉ có 3 loại, nhưng bảng có thêm loại "Hệ thống" | Đã thêm "Hệ thống" vào chú thích (màu `fg-secondary`). |
| 3.7 | [K] Kích thước thật của V-101 | Trang chi tiết: D 1,9 × L 4,8 m (suy từ ảnh). Cảnh Tổng quan vẫn vẽ 4,4 × 11 m (chưa thống nhất). |
| 3.8 | [D] Mô hình 3D: ảnh vẽ khung thép + lan can, mô hình có sàn thao tác + yên bê tông (trông to so với bồn nhỏ) | Dùng asset bồn chung của cảnh 3D. |

## 4. Cảnh báo – danh sách và drawer chi tiết (`/alerts`, Figma 70:2809 + ảnh drawer 27/10)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 4.1 | [D] Đổi "Giá trị hiện tại" thành **"Giá trị lúc cảnh báo"** (số của bản ghi, không đổi theo thời gian) và thêm dòng nhỏ "Hiện tại: x bar" (số trực tiếp) – đúng ý chưa? | Đã đổi như trên. Mất tín hiệu thì hiện "Hiện tại: Mất tín hiệu". |
| 4.2 | [D] Ảnh ghi thời gian 12/10/2026 | Ngày thật của bản ghi (mock dùng ngày tương đối: ALT-00128 = hôm nay). |
| 4.3 | [D/K] Ảnh ghi "Xác minh trạng thái van **PR-101**" – dữ liệu van an toàn của V-101 là **PSV-101**. PR-101 là van khác (van điều áp?) hay ghi nhầm? | Dùng PSV-101. |
| 4.4 | [D] Thang thanh đo: ảnh không theo tỉ lệ nào (vạch 11.8 ở ~89 %, đổi màu ở ~70 %). Có cần **đoạn vàng** 10,5–12 (từ ngưỡng cảnh báo đến ngưỡng nguy hiểm) không? | Thang 0 → mức nguy hiểm × 1,2 (V-101: 0–14,4 bar). Xanh tới 10,5, đỏ từ 10,5. Không có đoạn vàng. Giá trị vượt thang thì nới thang tới giá trị × 1,05. |
| 4.5 | [D] Nút "Xác nhận cảnh báo": ảnh nền #D34957, chữ trắng chỉ đạt 4.0:1 | Nền `danger-solid` #B42034 (5.07:1), tối hơn ảnh. |
| 4.6 | [D] Chân drawer sau khi xác nhận / hoàn thành **không có trong ảnh** | Đang xử lý: nút "Đánh dấu đã xử lý" (nền primary). Hoàn thành: dòng "Cảnh báo đã xử lý xong lúc HH:MM", chỉ xem. |
| 4.7 | ~~[D] Tên bước tiến trình~~ – PO đã duyệt, designer chỉ cần xác nhận kiểu chữ | Bước đã xong: thì quá khứ + giờ ("Đã phát hiện (10:45:22)", "Đã gửi thông báo", "Đã xác nhận", "Đã xử lý", "Hoàn thành"). Bước đang chờ giữ tên trạng thái ("Chưa xác nhận"; ảnh ghi "Chờ xác nhận"). |
| 4.8 | ~~[K] Tick hướng dẫn trước khi xác nhận~~ – PO đã duyệt | Khoá (vẫn Tab tới được) + dòng gợi ý "Xác nhận cảnh báo để bắt đầu xử lý." |
| 4.9 | [K] Ai được phân công cảnh báo? Người nhận có cần xác nhận không? | Toàn bộ nhân sự, kể cả trưởng ca và quản lý (khác bảo trì: chỉ kỹ thuật viên + kỹ sư). Phân công không đổi trạng thái, không cần người nhận xác nhận. |
| 4.10 | [K] "Đánh dấu đã xử lý" có cần người khác duyệt (như nghiệm thu bảo trì) không? | Không cần duyệt. Bắt buộc ghi chú kết quả. |
| 4.11 | [D] Ô ghi chú: ảnh chỉ có ô nhập | Đã thêm: danh sách ghi chú đã lưu, nút "Lưu ghi chú", mục thu gọn "Nhật ký (n)" dưới Tiến trình. Cần vị trí và kiểu chính thức. |
| 4.12 | [K] Đa số cảnh báo chưa gắn tag cảm biến, nên chưa có "Hiện tại" và thông số thiết bị | Chỉ ALT-00128 (PT-101) và ALT-00113 (PT-201) có tag. Cảnh báo khác ghi "Chưa có số liệu trực tiếp" và dùng ngưỡng của bản ghi. |
| 4.13 | [K] Danh sách nguyên nhân / hướng dẫn xử lý theo từng loại cảnh báo | Danh mục mock (`ALERT_PLAYBOOKS`, 15 loại). Loại "tốc độ thay đổi" (mức giảm %/h) không vẽ thang đo. |
| 4.14 | [D] Khu vực: ảnh drawer ghi "Khu bồn LPG", bảng Figma 70:3032 ghi "Bồn chứa" | Gộp về "Khu bồn LPG" cho mọi bản ghi (cảnh báo + bảo trì). |
| 4.15 | ~~[K] ALT-00127 dùng GS-01 hay GS-04~~ – đã chốt 27/10/2026 | GS-04 (bảng Figma + ảnh drawer gas). MT-00127 "GS-01" không trỏ tới cảnh báo này nên giữ. |
| 4.16 | [D] Hộp "Phân công xử lý" và hộp "Đánh dấu hoàn thành" hàng loạt chưa có thiết kế | Phân công: danh sách nhân sự gọn (tên, chức danh • phòng ban, số cảnh báo đang xử lý). Hoàn thành hàng loạt: một ghi chú chung, chỉ áp dụng dòng Đang xử lý, báo số dòng bỏ qua. |

### 4b. Drawer cảnh báo KHÍ GAS (ảnh 27/10/2026, ALT-00127)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 4b.1 | [K] Mức % LEL: ảnh vẽ 0–10 bình thường · 10–20 cấp 1 · 20–40 cấp 2 · ≥ 40 ESD; dữ liệu cũ ghi ngưỡng 20% LEL. Chốt mức nào? | Theo ảnh (cấu hình `GAS_BANDS`, đổi một chỗ). |
| 4b.2 | [D] Cảm biến GS-03 8% LEL ảnh ghi "Theo dõi" – theo mức trên là "Bình thường" | "Bình thường" (theo mức, không thêm mức "Theo dõi"). |
| 4b.3 | [K] "Đã xử lý xong" chỉ cho khi nồng độ trực tiếp < ngưỡng cấp 1 (mất tín hiệu → bắt buộc nhập số đo lại < cấp 1) – bổ sung an toàn ngoài Figma | Đang khoá như trên, có ghi lý do. |
| 4b.4 | [D] Màu nút "Cập nhật xử lý" (xanh nhạt) khác nút chính drawer áp suất | Token `info` #87CFFF (trùng màu ảnh). |
| 4b.5 | [K] "T/G vượt ngưỡng" tính từ lúc nào? | Từ lúc phát sinh cảnh báo (vượt ngưỡng bản ghi 20% LEL), khi nồng độ còn ≥ ngưỡng; về dưới → "Đã về dưới ngưỡng". |
| 4b.6 | [K] "Yêu cầu hỗ trợ" gửi cho ai? Chọn nhiều người? Có gửi thông báo đẩy/SMS? | Một người: trưởng ca/quản lý + bộ phận An toàn – HSE; thêm làm người phối hợp + ghi lịch sử; chưa gửi thông báo (chờ backend). |
| 4b.7 | [D] Ảnh không có Tiến trình / Ghi chú / Nhật ký | Giữ, thu gọn mặc định. |
| 4b.8 | [K] Drawer gas không có nút "Phân công" | Phân công qua thao tác hàng loạt ở bảng. |
| 4b.9 | [D] Ảnh: tiêu đề "Áp suất bồn V-101…" + thiết bị V-101 (chép từ drawer áp suất), badge "CAO" viết hoa, khu "Khu vực nạp LPG", ngày 12/10/2026, dòng cảm biến thứ 3 thiếu tên | Dữ liệu thật ALT-00127 (rò rỉ gas, GS-04), "Cao", "Khu nạp xuất", ngày thật, GS-03. |
| 4b.10 | [D] Dòng cảm biến gây cảnh báo: ảnh nền sáng hơn | Vạch trái theo mức + chữ đậm (nền sáng làm chữ đỏ mức ESD không đủ tương phản). |
| 4b.11 | [K] Tag thật của cảm biến gas và danh sách cảm biến theo khu | Tag giả định GS-01…GS-04 ở Khu nạp xuất. |

### 4c. Drawer BÁO CHÁY (ảnh 27/10/2026, FIR-00018)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 4c.1 | [K] Loại đầu báo HD-02 và nhiệt độ báo động | Giả định 57 °C (đầu báo nhiệt cố định phổ biến), đặt trong cấu hình đầu báo. |
| 4c.2 | [K] Quy trình ứng phó cháy (modal "Xem quy trình khẩn cấp") | 7 bước do dev soạn tạm, hiển thị nhãn "Bản nháp, cần bộ phận An toàn duyệt" ngay trong modal. Cần bộ phận An toàn duyệt. |
| 4c.3 | [K] Số điện thoại Trưởng ca / Đội PCCC nội bộ / An toàn – HSE | Hiện "Chờ khách cung cấp" (không đặt số giả). Cứu hỏa 114 có số. |
| 4c.4 | [D] Chân drawer sau khi xác nhận và sau khi đóng không có trong ảnh | Sau xác nhận: "Cập nhật xử lý" + Phân công/Đổi người + "Xem quy trình khẩn cấp". Sau "Báo động giả": "Đã đóng – báo động giả lúc HH:MM" + "Tạo yêu cầu bảo trì" (điền sẵn "Kiểm tra đầu báo HD-02"). |
| 4c.5 | [D] Modal "Cập nhật xử lý" (Tiếp tục / Đã xử lý sự cố / Báo động giả) và modal "Quy trình ứng phó cháy" chưa có thiết kế | Dựng theo token, cùng kiểu modal "Cập nhật xử lý" của gas. |
| 4c.6 | [K] Chỉ đóng cảnh báo khi đầu báo đã phục hồi; mất tín hiệu → bắt buộc xác nhận đã kiểm tra tại chỗ (bổ sung an toàn ngoài Figma) | Đang khoá như trên, có ghi lý do. Ghi chú bắt buộc cho cả 3 lựa chọn. |
| 4c.7 | [K] Xác nhận chéo: khi nào báo "Nhiều tín hiệu cùng báo, nguy cơ cháy cao"? | Khi khói báo động, gas ≥ 10% LEL (cấp 1) hoặc nút nhấn đã kích hoạt (ghi rõ). Banner không có trong ảnh. |
| 4c.8 | [D] Ba ảnh drawer dùng 3 kiểu badge mức độ khác nhau | Một kiểu (chip chữ thường như drawer áp suất) cho cả 3. |
| 4c.9 | [D] Giờ: "14:32:15 hôm nay" vs tiến trình "Phát hiện (14:32:40)" / "Gửi thông báo (14:32:49)" | Phát hiện = thời gian cảnh báo, gửi thông báo = +3 s. |
| 4c.10 | [D] Tên khu "Khu máy hóa hơi (FZ-02)" khác "Trạm hóa hơi" đang dùng ở các màn khác | "Trạm hóa hơi (FZ-02)". Cần danh mục mã khu báo cháy cho các khu khác. |
| 4c.11 | [D] Trạng thái đầu báo "Hoạt động" (mơ hồ) | Tách: báo động (Đang báo động / Đã phục hồi) + thiết bị (Trực tuyến / Mất kết nối / Lỗi). |
| 4c.12 | [D] E-101A 68 °C trùng nhiệt độ đầu báo; GS-02 lặp ở hai khối và khác khu so với drawer gas | Nhiệt độ máy dùng tag riêng (TT-201). Gas trạm hóa hơi là GS-05, chỉ ở "Tín hiệu liên quan". |
| 4c.13 | [K] Tag thật của đầu báo nhiệt/khói/nút nhấn/trạng thái máy; thống kê báo động giả hiển thị ở đâu | Tag giả định (HD-02, SD-02, MCP-02, GS-05). Kết quả đóng (đã xử lý / báo động giả) được lưu nhưng chưa có màn thống kê. |

## 5. Bảo trì – danh sách (`/maintenance`, Figma 70:3964)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 5.1 | [K] Ý nghĩa "Chờ tiếp nhận" khi bản ghi đã có người phụ trách | Giữ trạng thái như dữ liệu. Trạng thái và người phụ trách độc lập. |
| 5.2 | [D] MT-00128 / MT-00127: nội dung ở thẻ ưu tiên và ở bảng khác nhau | Theo nội dung thẻ. |
| 5.3 | [K] Ảnh modal phân công dùng "Chờ phân công" – có đổi tên trạng thái "Chờ tiếp nhận" cho toàn app không? | Giữ "Chờ tiếp nhận". |

## 6. Bảo trì – chi tiết yêu cầu (`/maintenance/:id`, ảnh MT-00128)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 6.1 | [D] Layer chứa stepper chưa xác nhận. Có muốn làm nổi bước đang chờ không? | Giữ như ảnh (chỉ vạch chạy tới) + đánh dấu bước hiện tại cho trình đọc màn hình. |
| 6.2 | [D] Ngày tạo 15/10/2023 trong khi hạn là "hôm nay" và ghi chú "Hôm nay 10:50" | Mock dùng ngày tương đối (hôm nay). |
| 6.3 | [D] Trạng thái "Chờ tiếp nhận", chưa phân công, nhưng checklist đã xong 2 việc và có ghi chú siêu âm | Mock giữ như ảnh. Checklist nay chỉ tick được khi Đã phân công / Đang thực hiện. |
| 6.4 | [D] Số V-101 ở ảnh (11,8 bar, 65 %, 25 °C) khác trang V-101 (số trực tiếp) | "Thiết bị liên quan" dùng số trực tiếp. Khối cảnh báo ghi "Lúc cảnh báo" (11,8 bar khớp ALT-00128). |
| 6.5 | [D] Công thức tiến độ "2/7 · 28 %" (có một mục Không áp dụng) | 2/6 · 33 % (bỏ mục Không áp dụng). |
| 6.6 | [D] Lịch sử ghi "Critical" bằng tiếng Anh | "Nghiêm trọng". |
| 6.7 | [D] "Nguyen Abc" là tên giữ chỗ? | Dùng tên nhân sự trong dữ liệu. |
| 6.8 | [D] Chấm vàng nằm cạnh áp suất đỏ | Chấm theo tag xấu nhất (đỏ khi có tag đỏ). |
| 6.9 | [D] "Rectangle 2" là thanh cuộn mẫu? | Bỏ qua, không style thanh cuộn riêng. |
| 6.10 | [D] Xác nhận Hủy: câu chữ? Nút xác nhận có cần màu nguy hiểm riêng? Lý do chọn sẵn hay nhập tự do, có bắt buộc không? | Nút primary "Xác nhận hủy" + "Giữ yêu cầu". Lý do bắt buộc, nhập tự do. |
| 6.11 | [D] Xem tệp: xem trước trong modal (ảnh/PDF nhúng), mở tab mới hay tải về? Có cần thumbnail trên thẻ tệp? | Modal giữ chỗ "Dữ liệu mẫu". Tải xuống ra tệp `.txt` mẫu. Chưa có thumbnail. |
| 6.12 | ~~[D] Modal Phân công gồm trường nào~~ – đã có ảnh thiết kế (5H). Câu còn lại xem mục 9. | Theo ảnh modal phân công. |

## 7. Bảo trì – modal "Cập nhật tiến độ"

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 7.1 | [D] Đổi nhãn ô "Hoàn thành" thành **"Báo hoàn thành"**? (Chọn ô này chỉ chuyển sang bước gửi nghiệm thu, chưa hoàn thành ngay.) | Giữ chữ "Hoàn thành" như ảnh. |
| 7.2 | [D] Ảnh có hai số tiến độ khác nhau (ô "Tiến độ" 28 % và thanh 50 %) | Ô = tiến độ báo cáo gần nhất; thanh = giá trị đang báo. |
| 7.3 | [D] Màu ô Tạm dừng / Gặp sự cố khi được chọn (ảnh chỉ vẽ ô "Đang thực hiện" được chọn) | Tạm dừng: warning. Gặp sự cố: danger. |
| 7.4 | [K] Tạm dừng / Gặp sự cố có cần danh sách lý do chọn sẵn không? | Nhập tự do, bắt buộc. |
| 7.5 | [D] Xác nhận "Hủy" trong modal chưa có thiết kế | Hộp "Bỏ các thay đổi chưa lưu?" dựng theo token. |

## 8. Bảo trì – modal "Gửi yêu cầu nghiệm thu" và "Nghiệm thu"

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 8.1 | [D] Hai modal ghi hai tên người nghiệm thu khác nhau (Trần Hoàng Nam / Trần Văn B) | Một người thống nhất: người chọn khi gửi = người hiện ở modal nghiệm thu (đăng nhập thật thì là người đang đăng nhập). |
| 8.2 | [D] Nguyên nhân ở hai modal khác nhau | Một nguồn duy nhất (nguyên nhân nhập khi gửi). |
| 8.3 | [D] Modal Gửi thiếu ô **Biện pháp**, trong khi modal Nghiệm thu có hiển thị | Đã thêm ô Biện pháp (bắt buộc) dưới hàng Checklist/Nguyên nhân. Cần vị trí và kiểu chính thức. |
| 8.4 | [K] Ngưỡng nhiệt độ: ảnh ghi "Ngưỡng: 30.", cấu hình V-101 là 40 °C | "Ngưỡng: 40" lấy từ cấu hình tag. |
| 8.5 | [K] Áp suất / nhiệt độ ở modal Gửi: chụp số trực tiếp, hay để kỹ thuật viên nhập tay số đo hiện trường? | Chụp số trực tiếp lúc gửi. |
| 8.6 | [K] "Cảm biến" / "Van xả": danh sách giá trị chính thức? (Ảnh chỉ có chữ xanh.) | Ô chọn: Bình thường / Cần theo dõi / Lỗi · Ổn định / Rò rỉ / Kẹt. |
| 8.7 | [D] Màu các ô "Theo dõi thêm", "Chưa khắc phục", "Cần bổ sung" khi được chọn | warning / danger / warning. |
| 8.8 | [K] Danh sách "Thời gian theo dõi thêm"? Có cần cảnh báo khi hết thời gian theo dõi? | Không / 2 / 4 / 8 / 24 giờ, mặc định 2 giờ. Chưa có cảnh báo khi hết. |
| 8.9 | [K] "Không đạt" có cần tạo yêu cầu mới thay vì trả về Đang thực hiện? | Trả về Đang thực hiện + cờ "Không đạt nghiệm thu". |
| 8.10 | [D] Modal Gửi dùng "Hủy" chữ trơn, modal Nghiệm thu dùng "Hủy bỏ" có viền – thống nhất? | Giữ như từng ảnh. |
| 8.11 | [K] "Thời gian đề nghị" mặc định (ảnh "Hôm nay, 15:30") | Lúc mở modal + 30 phút, làm tròn lên mốc 15 phút. Sửa được, không bắt buộc. |

## 9. Bảo trì – modal "Phân công người xử lý"

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 9.1 | [K] Role Vận hành (trưởng ca, vd Hoàng Minh E) có nhận việc bảo trì không? | Không có trong danh sách phân công và form tạo yêu cầu (vẫn nghiệm thu được). |
| 9.2 | [K] Ngưỡng "Bận" và cách đếm "đang làm" (có tính Chờ nghiệm thu / người phối hợp không?) | Bận khi ≥ 3 việc. "Đang làm" = Đã phân công + Đang thực hiện của người phụ trách chính. |
| 9.3 | [D] Chip ca màu xanh nghĩa là gì? | Ca của người khớp ca làm việc đang chọn. |
| 9.4 | [K] Công tắc gửi thông báo: mặc định bật hay tắt? Có gửi khi đổi người không? | Có công tắc (ảnh chỉ có dòng chữ). Chưa gửi được – chờ backend. |
| 9.5 | [D] "Bắt đầu dự kiến" / "Hạn chót": ảnh hiện "Hôm nay, 14:00" kèm icon | Ô ngày giờ gốc của trình duyệt (nền tối). |
| 9.6 | [K] Ảnh chọn sẵn Nguyễn Văn A | Không chọn sẵn ai (theo yêu cầu). |
| 9.7 | [D] Ca của bản ghi (Ca 1 ở trang chi tiết) khác ca trong ảnh modal (Ca 2) | Giữ ca của bản ghi. Chỉ điền ca mặc định của người được chọn khi bản ghi chưa có ca. Có nút "Đổi sang Ca …". |
| 9.8 | [K] Đổi người khi Đang thực hiện: người mới có cần xác nhận lại không? | Không. Giữ tiến độ và trạng thái, bắt buộc lý do đổi. |
| 9.9 | [D] Nhãn trạng thái màu vàng cho mọi trạng thái, hay đổi màu theo trạng thái? | Vàng (warning) cho mọi trạng thái, như ảnh. |


## 10. Cảnh báo – modal "Cập nhật xử lý cảnh báo áp suất" (ảnh 28/10/2026, ALT-00128)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 10.1 | [K] Tag + ngưỡng áp suất SAU bộ điều áp PR-101 | Tag GIẢ ĐỊNH `PT-103` (PT-102 đã là áp suất đẩy bơm P-101A + cảm biến của ALT-00122). Chưa có ngưỡng nên số không tô màu. |
| 10.2 | [D][K] Ảnh ghi 10.8 bar "sau xử lý" – vẫn trên ngưỡng 10.5: ảnh chỉ minh hoạ, hay luật đóng phải khác? | Không đóng được khi sau xử lý ≥ ngưỡng cảnh báo. |
| 10.3 | [K] Điều kiện khoá "Đã xử lý" (bổ sung an toàn ngoài Figma) có đúng ý? | Live < ngưỡng cảnh báo **và** sau xử lý < ngưỡng; mất tín hiệu → nguồn có đồng hồ cơ + số đo tay < ngưỡng. |
| 10.4 | [K] Có bắt buộc kiểm đủ hạng mục mới được đóng không? | Không chặn – chỉ cảnh báo, nêu tên hạng mục "Có vấn đề" và hạng mục chưa kiểm tra. |
| 10.5 | [K] Mục tiêu theo dõi chuẩn là bao nhiêu, theo bồn hay theo loại cảnh báo? | `< 10 bar` từ cấu hình loại (`ALERT_KINDS['tank-overpressure'].update.followUp.target`). |
| 10.6 | [K] Danh mục chính thức của "Nguồn xác minh" và "Vấn đề phát sinh" | Cảm biến (SCADA) / Đồng hồ cơ / Cả hai · Không có / Cần thêm nhân sự / Không thể tiếp cận / Thiếu dữ liệu / Khác. |
| 10.7 | [D] Ngày "24/10/2023" trong ảnh | Ngày giờ thật của bản ghi. |
| 10.8 | [D] Drawer áp suất nay hiện 6 hạng mục (một nguồn với modal) thay vì 3 bước như ảnh drawer – đồng ý? | 6 hạng mục, chữ theo ảnh modal. |
| 10.9 | [K] Hết giờ theo dõi: tự tạo lại cảnh báo khi vượt mục tiêu? Nhắc người chịu trách nhiệm? | Chỉ hiển thị "Đang theo dõi đến HH:MM" – TODO backend. |
| 10.10 | [K] "Cần hỗ trợ" có cần chọn nhiều người? | Một người (như "Yêu cầu hỗ trợ" của gas). |
| 10.11 | [K] Có cần modal này cho `pressure-high` (PT-201, áp suất đầu vào hóa hơi)? | Không – dùng "Đánh dấu đã xử lý"; từ 5N đi Đã xử lý → đóng qua modal đóng như mọi loại (bỏ ngoại lệ). |
| 10.12 | [K] **Hỏi khách:** ALT-00128 mức "Nghiêm trọng" nhưng giá trị 11.8 bar < mức nguy hiểm 12 bar của V-101 (cấu hình tag: cảnh báo 10.5 / nguy hiểm 12). Mức độ cảnh báo tính từ ngưỡng nào – hay ngưỡng nguy hiểm thật của V-101 thấp hơn 12? | Giữ mức "Nghiêm trọng" của bản ghi (như Figma); màu số theo ngưỡng cấu hình → 11.8 tô vàng (warning), chỉ ≥ 12 mới đỏ. |

## 11. Cảnh báo – quy trình đóng: modal "Xác nhận đóng cảnh báo" + khung cập nhật chung (ảnh 28/10/2026)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 11.1 | [K] **Ai được đóng cảnh báo?** Có cần vai trò riêng (trưởng ca / kỹ sư an toàn)? | Ai có quyền `alert:acknowledge`. Mức Nghiêm trọng: người đóng phải KHÁC người xử lý (`resolvedBy`); mức khác người xử lý tự đóng được. Chưa đăng nhập: người hiện tại = "Admin". Kiểm tra vai trò: TODO backend. |
| 11.2 | [D][K] **Ý nghĩa "Tiếp tục theo dõi"**: chỉ gia hạn theo dõi (vẫn chờ đóng), hay mở lại xử lý? Hết giờ thì sao? | Giữ Đã xử lý (chờ đóng) + MỘT giá trị theo dõi (`followUp`, tính lại từ lúc lưu nếu đổi thời gian); ghi chú không bắt buộc; hết giờ → chip "Đến giờ kiểm tra lại" ở drawer + bảng. Không tự mở lại. |
| 11.3 | [D] **Tab cho trạng thái Đã xử lý (chờ đóng)**: Figma chỉ có Tất cả / Chưa xác nhận / Đang xử lý / Đã hoàn thành | Thêm tab "Chờ đóng" giữa "Đang xử lý" và "Đã hoàn thành"; 5 KPI giữ như Figma (Đã xử lý không vào ô nào) – có cần ô KPI "Chờ đóng"? |
| 11.4 | [D] **Thiết kế riêng cho modal cập nhật gas / cháy?** | Dựng theo khung Figma áp suất: gas (thông số GS-04 + cảm biến cùng khu, 4 mục xác minh, mục tiêu < 10 % LEL), cháy (6 ô: "Đã xử lý sự cố" / "Báo động giả"; nhiệt độ HD-02, khói SD-02, gas GS-05; không có mục tiêu số). |
| 11.5 | [K] "Không còn cảnh báo liên quan đang hoạt động": phạm vi cùng thiết bị hay cùng KHU? | Cùng thiết bị HOẶC cùng khu, chỉ tính Chưa xác nhận / Đang xử lý. Hệ quả: ALT-00128 không đóng được khi Khu bồn LPG còn ALT-00123 / ALT-00122 mở. |
| 11.6 | [K] "Thiết bị đã trở về trạng thái ổn định" kiểm theo gì? | Tín hiệu chính đọc được + tín hiệu phụ không vượt ngưỡng cảnh báo (cháy: đầu báo trực tuyến + đã phục hồi, khói không báo động). Loại không có số trực tiếp → coi là đạt, ghi chú "theo kết quả xử lý đã ghi". |
| 11.7 | [D] Ảnh modal đóng: "Trôi cảm biến", 9.8 bar – khác ảnh modal cập nhật (10.8 bar, không có "Trôi cảm biến") | Hiện đúng dữ liệu đã nhập ở modal cập nhật (docs/figma-diffs.md). |
| 11.8 | [K] Đóng hàng loạt có cần cho cảnh báo Nghiêm trọng không? | Có, nhưng bỏ qua dòng mà người đóng là người xử lý; chỉ dòng đủ 3 điều kiện hệ thống; một ghi chú kết luận chung. |

## 12. Báo cáo vận hành định kỳ (`/reports`, ảnh 29/10/2026)

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 12.1 | [D] Mô tả trang trong ảnh chép từ Bảo trì ("Theo dõi, phân công và quản lý tiến độ bảo trì thiết bị…") | "Theo dõi tiến độ, chữ ký và dữ liệu thiếu của báo cáo vận hành ngày, tháng, quý và năm trong hệ thống LPG". |
| 12.2 | [D] Số trong ảnh không khớp nhau (Tất cả 186 vs 185; ngày 176 vs 175 ngày từ 1/1; đã ký 168) | Mọi số tính từ danh sách; 4 nhóm Đang thực hiện / Chờ xác nhận / Đã ký / Thiếu dữ liệu tách rời, tổng = KPI Tổng. |
| 12.3 | [D] Màn chi tiết báo cáo (nút 👁, bấm mã), menu ⋮ có những thao tác gì? | 👁 và ⋮ hiện nhưng khoá (`aria-disabled`, "chờ thiết kế"); mã là chữ màu info. |
| 12.4 | [D] Icon phễu cạnh "Xóa bộ lọc" làm gì? | Chưa đặt (không có chức năng). |
| 12.5 | [K] Quy trình ký: Người kiểm tra → Người duyệt → Ban TAP? "Bị trả lại" quay về ai? "Chờ xác nhận" có tính báo cáo bị trả lại / chưa gửi ký không? | Đúng thứ tự trên; bị trả lại / chưa gửi → chờ Người kiểm tra; cả hai tính vào Chờ xác nhận. |
| 12.6 | [K] Báo cáo tháng/quý/năm "đủ mốc" nghĩa là gì? Có tính báo cáo ngày đã ký hay chỉ cần đủ dữ liệu? | Tháng: mỗi ngày đủ dữ liệu là một mốc; quý: mỗi tháng đã ký; năm: mỗi quý đã ký. |
| 12.7 | [K] Hạn nộp: tuần (thứ Sáu 17:00), tháng (ngày cuối 12:00), quý (ngày cuối 17:00), năm (31/12 17:00)? Có báo cáo tuần thật không (ảnh có "Báo cáo tuần 4" trong lịch nhưng không có tab tuần)? | Như vế đầu; báo cáo tuần chỉ có trong lịch, chưa có bản ghi/tab. |
| 12.8 | [K] Mã báo cáo tháng/quý/năm, ca vận hành (chỉ "Ca 1"?), danh sách người kiểm tra/duyệt | `BCVH-T-062026`, `BCVH-Q-22026`, `BCVH-NAM-2026`; mọi báo cáo ngày "Ca 1"; người: mock 3 kiểm tra + 2 duyệt. |
| 12.9 | [D][K] "Thiếu mốc" trong "Cần xử lý hôm nay": mốc đã quá giờ chưa nhập, hay mọi mốc còn lại trong ngày? "Xử lý ngay" dẫn tới đâu? | Chỉ mốc đã tới giờ mà chưa có dữ liệu. "Xử lý ngay" lọc bảng theo mã báo cáo; "Xem tất cả" lọc Chờ xác nhận. |

## Phụ lục – nguyên văn "Cần xác nhận" từ CLAUDE.md mục 7 (chuyển 28/10/2026)

Gồm cả phần chưa có ở các mục trên (modal "Phân công xử lý cảnh báo", modal "Cập nhật xử lý cảnh báo áp suất").

- **Cần xác nhận** (bản tổng hợp gửi designer/khách, nhóm theo màn + phương án tạm: `docs/questions.md`; cập nhật lại khi mục này đổi):
  - **Chi tiết yêu cầu bảo trì (ảnh MT-00128) – hỏi designer:** (1) layer chứa stepper chưa xác nhận; có muốn làm nổi bước đang chờ không (ảnh chỉ có vạch chạy tới, đang giữ như ảnh + `aria-current`); (2) ngày tạo 15/10/2023 trong khi hạn "hôm nay" và ghi chú "Hôm nay 10:50" (mock dùng hôm nay); (3) trạng thái "Chờ tiếp nhận", chưa phân công, stepper bước 1 nhưng checklist đã xong 2 việc và có ghi chú siêu âm (mock giữ như ảnh; nay checklist chỉ tick được khi Đã phân công/Đang thực hiện); (4) số V-101 ở ảnh (11,8 bar, 65 %, 25 °C) khác trang V-101 (9,2 bar, 76,2 %, 28,6 °C) – trang dùng số trực tiếp, 11,8 bar khớp ALT-00128 nên cảnh báo ghi "Lúc cảnh báo"; (5) công thức tiến độ "2/7 · 28 %" (2/7 = 28,6 %, có mục Không áp dụng) – đang dùng 2/6 · 33 %; (6) lịch sử ghi "Critical" tiếng Anh; (7) "Nguyen Abc" là tên giữ chỗ; (8) menu "Vận hành" có mũi tên dropdown, chưa rõ menu con; (9) modal Phân công / Hủy / Xem tệp chưa có thiết kế (dựng tối giản theo token); (10) chấm vàng cạnh áp suất đỏ (đang chấm theo tag xấu nhất); (11) "Rectangle 2" = thanh cuộn mẫu – bỏ qua, không style thanh cuộn riêng; (12) **modal Phân công**: trường nào (người phụ trách / phòng ban / ca trực – hiện 3 Select, chọn người tự điền phòng ban), có chọn người phối hợp và ghi chú bàn giao không; (13) **xác nhận Hủy**: câu chữ, nút xác nhận có cần màu nguy hiểm riêng (hiện nút primary "Xác nhận hủy" + "Giữ yêu cầu"), lý do có cần danh sách lý do chọn sẵn hay bắt buộc; (14) **xem tệp**: xem trước trong modal (ảnh/PDF nhúng) hay mở tab mới / tải về, có cần thumbnail trên thẻ tệp; (15) **chữ đỏ toàn app sáng hơn Figma ~20 %** (`danger-text` #DC6D79 thay #D34957 cho chữ, vì a11y AA) – viền/nền/icon vẫn #D34957; nền đặc có chữ trắng dùng `danger-solid` #B42034 (tối hơn) – đã duyệt, cần designer xác nhận; (16) chữ menu chưa chọn đổi sang `fg-secondary/70` (hơi ngả xanh) vì Figma 2.43:1.
  - **Modal "Cập nhật tiến độ" – hỏi designer:** (1) đề xuất đổi nhãn ô "Hoàn thành" → **"Báo hoàn thành"** (chọn ô này chỉ chuyển "Chờ nghiệm thu", không hoàn thành ngay; hiện giữ chữ như ảnh); (2) hai số tiến độ khác nhau trong ảnh (ô "Tiến độ" 28 % vs thanh 50 %) – đang hiểu ô = tiến độ báo cáo gần nhất, thanh = giá trị đang báo; (3) màu ô Tạm dừng (warning) / Gặp sự cố (danger) khi được chọn – ảnh chỉ vẽ ô "Đang thực hiện" được chọn; (4) có cần lý do chọn sẵn cho Tạm dừng/Gặp sự cố; (5) hộp "Nghiệm thu đạt" / "Yêu cầu làm lại" và xác nhận Hủy trong modal chưa có thiết kế (dựng theo token).
  - **Hai modal nghiệm thu (ảnh 27/10/2026) – hỏi designer:** (1) hai tên người nghiệm thu khác nhau ("Trần Hoàng Nam (Quản lý vận hành)" ở modal Gửi, "Trần Văn B (Quản lý)" ở modal Nghiệm thu) – đang dùng MỘT người: người chọn khi gửi = người hiện ở modal nghiệm thu (đăng nhập thật: người đang đăng nhập); (2) nguyên nhân khác nhau giữa hai modal – đang lấy một nguồn (`submission.cause`); (3) modal Gửi thiếu ô **Biện pháp** trong khi modal Nghiệm thu hiển thị Biện pháp – đã thêm ô Biện pháp (bắt buộc) dưới hàng Checklist/Nguyên nhân, cần vị trí/kiểu chính thức; (4) ngưỡng nhiệt độ ảnh "Ngưỡng: 30." – cấu hình V-101 hiện là cảnh báo 40 °C, đang hiện "Ngưỡng: 40" từ cấu hình tag: ngưỡng đúng là bao nhiêu; (5) áp suất/nhiệt độ ở modal Gửi: chụp số trực tiếp (đang làm) hay cho kỹ thuật viên nhập tay số đo hiện trường; (6) "Cảm biến"/"Van xả" ảnh chỉ là chữ xanh – đang là ô chọn (Bình thường/Cần theo dõi/Lỗi · Ổn định/Rò rỉ/Kẹt): danh sách giá trị chính thức?; (7) màu ô "Theo dõi thêm"/"Chưa khắc phục" và "Cần bổ sung" khi được chọn (ảnh chỉ vẽ ô đầu được chọn – đang warning/danger/warning); (8) danh sách "Thời gian theo dõi thêm" (đang Không/2/4/8/24 giờ) và có cần cảnh báo khi hết theo dõi; (9) "Không đạt" có cần tạo yêu cầu mới thay vì trả về Đang thực hiện; (10) "Hủy" modal Gửi chữ trơn còn "Hủy bỏ" modal Nghiệm thu có viền – thống nhất?; (11) "Thời gian đề nghị" ảnh điền sẵn "Hôm nay, 15:30" – đang mặc định lúc mở + 30 phút làm tròn lên 15 phút: quy tắc này có đúng ý không.
  - **Modal "Phân công người xử lý" (ảnh 27/10/2026) – hỏi designer / khách:** (1) trạng thái "Chờ phân công" trong ảnh – app dùng "Chờ tiếp nhận" (có cần đổi tên trạng thái toàn app không); (2) **role Vận hành (trưởng ca, vd Hoàng Minh E) có nhận việc bảo trì không** – hiện không còn trong danh sách phân công/form tạo yêu cầu (vẫn nghiệm thu được); (3) ngưỡng Bận (đang 3 việc đang làm) và "đang làm" có tính Chờ nghiệm thu/người phối hợp không (đang: không); (4) chip ca xanh nghĩa là gì (đang: khớp ca làm việc đang chọn); (5) công tắc thông báo – ảnh chỉ có dòng chữ: mặc định bật hay tắt, có gửi khi đổi người không; (6) "Bắt đầu dự kiến"/"Hạn chót" ảnh hiện "Hôm nay, 14:00" có icon – đang dùng ô ngày giờ gốc; (7) ảnh chọn sẵn Nguyễn Văn A – yêu cầu là KHÔNG chọn sẵn (đang không chọn sẵn); (8) ca của bản ghi (Ca 1 ở trang chi tiết MT-00128) khác ca trong ảnh modal (Ca 2) – modal giữ ca của bản ghi, chỉ điền ca mặc định của người khi bản ghi chưa có ca; (9) đổi người khi Đang thực hiện có cần người mới xác nhận lại không; (10) nhãn trạng thái màu vàng cho mọi trạng thái hay theo trạng thái.
  - **Drawer chi tiết cảnh báo (ảnh 27/10/2026) – hỏi designer / khách:** (1) đổi "Giá trị hiện tại" → **"Giá trị lúc cảnh báo"** (số của bản ghi, không đổi theo thời gian) + dòng nhỏ "Hiện tại: x bar" (live) – đúng ý chưa; (2) ảnh ghi thời gian 12/10/2026 – mock tính theo ngày tương đối (ALT-00128 = hôm nay); (3) ảnh "Xác minh trạng thái van PR-101" – dữ liệu van an toàn V-101 là **PSV-101** (đang dùng PSV-101): PR-101 là van khác (van điều áp?) hay ghi nhầm; (4) **thang thanh đo**: ảnh không khớp tỉ lệ nào (vạch 11.8 ở ~89 %, đổi màu ở ~70 %) – đang 0 → mức nguy hiểm × 1.2 (V-101: 0–14.4 bar, 10.5 ở 73 %); có cần **đoạn vàng** 10.5–12 (cảnh báo → nguy hiểm) không; (5) nút "Xác nhận cảnh báo" ảnh nền #D34957 chữ trắng (4.0:1) → đổi `danger-solid` #B42034 (5.07:1) – tối hơn ảnh; (6) **chân drawer sau khi xác nhận / hoàn thành không có trong ảnh** (đang: "Đánh dấu đã xử lý" nền primary → "Cảnh báo đã xử lý xong lúc HH:MM"); (7) ~~tên bước tiến trình~~ – PO đã duyệt 27/10/2026: bước xong thì quá khứ + giờ, bước chờ = tên trạng thái (mục 8), designer chỉ cần xác nhận lại kiểu chữ; (8) ~~tick trước khi xác nhận~~ – PO đã duyệt: khoá (aria-disabled + gợi ý) tới khi xác nhận; (9) ai được phân công cảnh báo (đang toàn bộ STAFF, kể cả trưởng ca/quản lý) và phân công có cần người nhận xác nhận; (10) "Đánh dấu đã xử lý" có cần người khác duyệt (như nghiệm thu bảo trì); (11) ô Ghi chú: ảnh chỉ có ô nhập – đã thêm danh sách ghi chú + nút "Lưu ghi chú" + "Nhật ký (n)" thu gọn: vị trí/kiểu chính thức; (12) cảnh báo không có tag (đa số mock) chưa có "Hiện tại"/thông số thiết bị – cần danh sách tag thật cho mọi cảnh báo.
  - **Drawer cảnh báo KHÍ GAS (ảnh 27/10/2026) – hỏi designer / khách:** (1) **bands % LEL** 0–10 bình thường · 10–20 cấp 1 · 20–40 cấp 2 · ≥ 40 ESD (theo ảnh) – dữ liệu cũ ghi ngưỡng 20% LEL: chốt mức nào (đặt ở `GAS_BANDS`); (2) ảnh GS-03 8% LEL ghi "Theo dõi" – theo bands là "Bình thường" (đang theo bands, không thêm mức "Theo dõi"); (3) "Đã xử lý xong" chỉ khi nồng độ live < ngưỡng cấp 1 (mất tín hiệu → bắt buộc số đo lại < cấp 1) – **bổ sung an toàn ngoài Figma**, đúng ý chưa; (4) màu nút "Cập nhật xử lý" (ảnh xanh nhạt = token `info`, khác nút chính primary của drawer áp suất); (5) "T/G vượt ngưỡng" = thời gian từ lúc phát sinh cảnh báo (vượt ngưỡng bản ghi 20% LEL) khi live còn ≥ ngưỡng – hay tính theo cấp 1 (10)?; (6) "Yêu cầu hỗ trợ" gửi cho ai (đang: trưởng ca/quản lý + An toàn – HSE), chọn nhiều người không, có cần gửi thông báo đẩy/SMS (TODO backend); (7) Tiến trình/Ghi chú/Nhật ký không có trong ảnh – đang giữ, thu gọn mặc định; (8) panel gas không có "Phân công" – phân công qua thao tác hàng loạt ở bảng, đúng ý chưa; (9) tag thật của cảm biến gas + danh sách cảm biến theo khu.
  - **Drawer BÁO CHÁY (ảnh FIR-00018, 27/10/2026) – hỏi designer / khách:** (1) **loại đầu báo HD-02 và nhiệt độ báo động** – đang giả định 57 °C (`HEAT_DETECTORS['HD-02'].alarmAt`, cấu hình tag); (2) **quy trình ứng phó cháy trong modal "Xem quy trình khẩn cấp" là BẢN NHÁP do dev soạn** (7 bước, nhãn "Bản nháp, cần bộ phận An toàn duyệt" trong modal) – cần bộ phận An toàn duyệt nội dung; (3) **danh bạ nội bộ** Trưởng ca / Đội PCCC nội bộ / An toàn – HSE: "Chờ khách cung cấp" (không đặt số giả), chỉ Cứu hỏa 114 có số; (4) chân drawer sau khi xác nhận (Cập nhật xử lý + Phân công/Đổi người + Xem quy trình) và sau khi đóng ("Đã đóng – báo động giả" + Tạo yêu cầu bảo trì) KHÔNG có trong ảnh; (5) modal "Cập nhật xử lý" báo cháy và "Quy trình ứng phó cháy" chưa có thiết kế (dựng theo token); (6) điều kiện đóng (đầu báo phải phục hồi; mất tín hiệu → xác nhận kiểm tra tại chỗ) là bổ sung an toàn ngoài Figma – đúng ý chưa; (7) xác nhận chéo: gas tính từ cấp 1 (10 % LEL) – đúng ngưỡng chưa; (8) danh mục mã khu báo cháy (hiện chỉ FZ-02 = Trạm hóa hơi); (9) tag thật của đầu báo/khói/nút nhấn/trạng thái máy; thống kê báo động giả (`resolution`) hiển thị ở đâu (chưa có màn).
  - **Modal "Cập nhật xử lý cảnh báo áp suất" (ảnh 28/10/2026) – hỏi designer / khách:** (1) **tag + ngưỡng áp suất sau bộ điều áp PR-101** – đang dùng tag GIẢ ĐỊNH `PT-103` (PT-102 đã dùng cho bơm P-101A + ALT-00122), chưa có ngưỡng nên không tô màu; (2) **ảnh ghi 10.8 bar "sau xử lý" – vẫn trên ngưỡng 10.5** → theo luật mới KHÔNG đóng được: ảnh minh hoạ hay luật đóng phải khác?; (3) điều kiện khoá "Đã xử lý" (live < ngưỡng cảnh báo **và** sau xử lý < ngưỡng; mất tín hiệu → đồng hồ cơ + số đo tay) là bổ sung an toàn ngoài Figma – đúng ý chưa; (4) có bắt buộc kiểm đủ hạng mục mới được đóng không (đang: chỉ cảnh báo, không chặn); (5) mục tiêu theo dõi mặc định `< 10.0 bar` (cấu hình) – chuẩn là bao nhiêu, theo bồn hay theo loại; (6) danh mục chính thức của nguồn xác minh (Cảm biến (SCADA) / Đồng hồ cơ / Cả hai) và vấn đề phát sinh; (7) ngày "24/10/2023" trong ảnh – đang dùng ngày thật của bản ghi; (8) "Hướng dẫn xử lý" của drawer nay = 6 hạng mục của modal (một nguồn) – drawer dài hơn ảnh drawer (3 bước): đồng ý không; (9) cảnh báo "theo dõi" có cần tự tạo lại cảnh báo khi vượt mục tiêu (TODO backend) và nhắc người chịu trách nhiệm khi hết giờ; (10) "Cần hỗ trợ" có cần chọn nhiều người (đang một, như "Yêu cầu hỗ trợ" của gas); (11) modal áp suất chưa có cho `pressure-high` (PT-201) – có cần không.
  - **Modal "Phân công xử lý cảnh báo" (ảnh 27/10/2026) – hỏi designer / khách:** (1) **lịch ca thật** – "Ngoài ca" đang tính theo ca MẶC ĐỊNH của từng người (`STAFF.defaultShift`) + giờ hiện tại, chưa có lịch ca theo ngày/đổi ca; (2) **khu phụ trách + chuyên môn của nhân sự** và **chuyên môn theo loại cảnh báo** là mock tạm do dev đặt (`STAFF.areas/skills`, `ALERT_KINDS[kind].skills`) – cần danh mục thật; (3) ngưỡng Bận (3 cảnh báo, dùng chung với bảo trì) và có tính cảnh báo của người phối hợp không (đang: không); (4) ô "Gửi thông báo khẩn cấp ngay" chỉ giao diện – kênh gửi (đẩy/SMS/gọi), gửi cả người phối hợp không (TODO backend); (5) vùng lọc nhân sự (nút icon trong ảnh) chưa có thiết kế – đang mở ngay dưới ô tìm: phòng ban, ca, "Chỉ người đang trong ca"; (6) ô "Lý do đổi người", khối "Sẽ đổi người"/"Bỏ qua" (hàng loạt), thẻ đầu hàng loạt, khối cảnh báo/lý do chặn chưa có thiết kế; (7) người được phân công cảnh báo có cần xác nhận nhận việc không; (8) chip gợi ý "Cùng khu · Đúng chuyên môn" và dòng giải thích thứ tự sắp xếp là phần thêm ngoài ảnh – giữ không.
  - Trang chi tiết tài sản: "Đăng nhập hệ thống" xếp loại **Cảnh báo** trong bảng sự kiện (ảnh) – có đúng không (mock giữ nguyên; loại đổi ở `mocks/assets.ts`, nhãn/màu ở `EVENT_TYPE_META`/`EVENT_TONE`); chú thích ảnh chỉ 3 loại nhưng bảng có "Hệ thống" (đã thêm vào chú thích, màu `fg-secondary`).
  - Chi tiết tài sản: định nghĩa "Tồn kho" (Nm³) của một bồn, "Dự kiến N ngày", "Sức khỏe thiết bị", "Tình trạng hồ sơ", "V-101 DOME" (nhiệt độ vòm hay nhiệt độ LPG – đang dùng TT-101).
  - MT-00128/127: nội dung giữa thẻ và bảng khác nhau (đang theo thẻ).
  - Ý nghĩa "Chờ tiếp nhận" khi đã có người phụ trách.
  - Hàng chart Tổng quan để opacity 70% có cố ý không.
  - Figma kéo giãn ảnh bản đồ ~14%: có cố ý không.
