# Báo cáo định kỳ (`/reports`)

Màn "Báo cáo vận hành định kỳ" (ảnh thiết kế `scratch/figma-ref/reports-*.png`, chưa có node Figma), màn **Chi tiết báo cáo ngày** (`/reports/daily/:code`, mục 5P) và **phần dùng chung cho mọi màn báo cáo** ngày / tháng / quý / năm. Mục lục: [GUIDE.md](../../GUIDE.md).

## 5O-1. Tách lớp – cái gì dùng lại được

| Lớp | File | Dùng lại thế nào |
|---|---|---|
| Kỳ báo cáo (thuần) | `src/features/reports/period.ts` | `REPORT_PERIODS`, `PERIOD_CONFIG` (nhãn tab, tiền tố mã, đơn vị mốc "mốc/ngày/tháng/quý", tiêu đề cột kỳ), `periodRange`/`periodContains`/`periodKeyOf`, `periodLabel`, `reportCode`, `weekdayVi`, `DAILY_CHECKPOINTS` |
| Trạng thái (thuần) | `src/features/reports/status.ts` | `ReportRecord` (kỳ + mốc kiểm tra + người kiểm tra/duyệt + chữ ký lưu); trạng thái **suy dẫn** `completionOf` (Đang thực hiện / Hoàn thành / Thiếu dữ liệu), `signatureOf`, nhóm tách rời `reportState` (in-progress · missing-data · awaiting · signed), `awaitingStep` (Inspector → Approver → TAP; bị trả lại / chưa gửi → Inspector), `missingCheckpoints` (mốc tới hạn chưa có dữ liệu), `progressText`, `missingText` |
| Số liệu (thuần) | `src/features/reports/derive.ts` | `deriveReportKpis` (tổng = tổng 4 nhóm), `deriveAwaitingByStep`, `deriveMonthProgress` (báo cáo NGÀY của tháng hiện tại), `deriveUpcomingDeadlines` (`DEADLINE_RULES` tuần/tháng/quý/năm – giả định), `deriveTodayActions` |
| Lọc bảng (thuần) | `src/features/reports/filter.ts` | `reportParams(defaultTab)` (URL: `tab q date shift completion signature inspector approver size page`), `matchReport` (ngày → báo cáo có kỳ chứa ngày đó; `signature=awaiting` = chờ duyệt + bị trả lại; tìm không dấu), `sortReports`, `distinctOptions` |
| Component thuần | `src/components/MetricListCard`, `ScheduleList`, `ActionItemList` | Thẻ nhãn–số (+ thanh tiến độ, chip đếm, link) · lịch có ô ngày · hộp việc cần xử lý. Biến thể mới: `KpiCard compact outlined` theo mọi tone, `Badge count tone="warning"`, `Tabs countMax`, `FilterBar layout="inline"` + `leading` + `onClear`, `Select hideAllInTrigger`, `DatePicker hideLabel`, `DataTable pagination.pageSizeOptions` |
| Khối trang báo cáo | `src/pages/reports/shared/` | `ReportKpiRow` (5 KPI viền màu) · `ReportSummaryCards` (4 thẻ) · `ReportTableSection` (tab + dòng ⓘ + lọc + bảng; cột theo tab) · `useReportTable(rows, now, defaultTab)` · `ReportBadges` (CompletionBadge, SignatureBadge) |
| Màn | `src/pages/reports/ReportsPage.tsx` | Ghép các khối, tab mở sẵn `daily`, ghi chú từng tab, "Xem tất cả" / "Xử lý ngay" |
| Dữ liệu | `src/data/reports.ts` (`useReports`, `fetchReports`) · `src/mocks/reports.ts` (`buildReports(now)`) | Mock sinh theo ngày hiện tại: mọi báo cáo từ 1/1 năm nay tới hôm nay |

**Làm màn báo cáo khác** (vd báo cáo bảo trì định kỳ): giữ `ReportRecord` + `features/reports`, tạo `src/data/<x>Reports.ts` (store riêng), trang mới ghép `ReportKpiRow` / `ReportSummaryCards` / `ReportTableSection` với `useReportTable(rows, now, '<tab mặc định>')`, truyền `tabs` nếu không cần đủ 6 tab, `tabNotes` riêng. Kỳ mới (vd tuần): thêm vào `REPORT_PERIODS` + `PERIOD_CONFIG` + nhánh trong `periodRange`/`periodKeyOf`/`periodLabel`/`reportCode` (test `period.test.ts`).

## 5O-2. Quy tắc trạng thái

- **Hoàn thành** không lưu: kỳ chưa qua (hôm nay giờ nhà máy ≤ ngày cuối kỳ) → Đang thực hiện; qua rồi → đủ mốc = Hoàn thành, thiếu = Thiếu dữ liệu.
- Mốc: ngày = 6 giờ kiểm tra; tháng = từng ngày (đạt khi báo cáo ngày đủ dữ liệu); quý = 3 tháng (đạt khi báo cáo tháng đã ký); năm = 4 quý. Báo cáo tháng có ngày thiếu dữ liệu → tháng đó Thiếu dữ liệu.
- **Chữ ký** chỉ có nghĩa khi Hoàn thành; trước đó luôn "Chưa gửi ký". "Chờ xác nhận" = Hoàn thành mà chưa ký đủ (chờ duyệt, bị trả lại, chưa gửi).
- "Cần xử lý hôm nay": báo cáo hôm nay có mốc đã tới hạn chưa nhập (danger) → bị trả lại (danger, mới nhất trước) → mốc hôm nay cần xác minh (warning). "Xử lý ngay" = lọc bảng theo mã (tab Tất cả) + cuộn tới bảng + `announce`.
- "Xem tất cả" (Chờ xác nhận) = `?tab=all&signature=awaiting`. "Xóa bộ lọc" giữ `tab` + `size`.

## 5O-3. Thử nhanh

| URL (dev, `VITE_AUTH=off npx vite`) | Thấy |
|---|---|
| `/reports?now=2026-06-24T18:30` | Gần đúng ảnh: KPI 184 · 4 · 6 · 166 · 8; Chờ xác nhận 2/2/2; Tiến độ tháng 06 19/24; lịch T6 26 / T3 30 / T3 30; 3 việc cần xử lý; dòng 24/06 "5/6 mốc (83%)", 21/06 Thiếu dữ liệu, 20/06 Bị trả lại |
| `/reports?now=2026-06-24T17:00` | Hôm nay thiếu mốc 16:00 (mốc vừa tới hạn gần nhất luôn để trống – demo) |
| `…&tab=monthly` · `…&tab=signed` | Báo cáo tháng (Tháng 05 Thiếu dữ liệu) · biểu mẫu đã ký |
| `/playground#reports` | Mục 18 – component dùng chung đặt cạnh ảnh thiết kế |

Kịch bản mock (số ngày lùi từ hôm nay) ở đầu `src/mocks/reports.ts`: chờ ký `AWAITING`, thiếu mốc `MISSING`, cần xác minh `TODAY_VERIFY`. Test khoá kịch bản: `src/mocks/reports.test.ts`.

## 5O-4. Chưa làm / chờ

- Chi tiết báo cáo THÁNG/QUÝ/NĂM (👁 các dòng đó vẫn `aria-disabled`, mã là chữ), menu ⋮, nút lọc nâng cao (icon phễu trong ảnh) – chờ thiết kế (`docs/questions.md` mục 12). Báo cáo ngày đã có màn chi tiết (5P).
- API: `docs/decisions.md` ("Báo cáo – hợp đồng API cần bổ sung"). Báo cáo tuần chỉ có trong lịch, chưa có tab/bản ghi.
- Ký: có bước **Người kiểm tra** của báo cáo ngày (5Q). Trả lại, Người duyệt / TAP ký, nhập mốc: chưa có luồng.

## 5P. Chi tiết báo cáo ngày (`/reports/daily/:code`)

Figma `A88YJ2BRhICDDdeu2rtRg1` (bản sao) frame `117:4250`; chỉ lấy 3 node: `117:4367` (5 thẻ), `117:4609` (dòng số liệu), `117:4603` (dòng nhóm). Header, dải mốc, thanh lọc, header bảng **suy ra** từ component có sẵn. Ảnh + ghi chú: `scratch/figma-ref/report-daily-*` (chỉ máy dev).

| Lớp | File | Ghi chú |
|---|---|---|
| Logic thuần | `src/features/reports/daily.ts` (+ test) | `DAILY_GROUPS`, `checkpointStates` (Đã xác nhận / Cần xác minh / Chưa có dữ liệu / Chưa tới hạn), `readingLevel` + `cellState` (ngưỡng qua `paramStatus` của màn Vận hành: low/high = Cảnh báo, danger = Bất thường), `rowResult` (mức xấu nhất – ô thiếu KHÔNG đổi kết quả), `formatReading` ("77,1"), `standardText` ("10–90%", "< 10 %LEL", "—"), `signedSteps`, `deriveDailyCards` (5 thẻ), `flaggedReadings`, `DAILY_DETAIL_PARAMS` + `matchReadingRow` |
| Mock | `src/mocks/dailyReport.ts` (+ test) | `DAILY_ITEMS` (14 hạng mục, 5 nhóm; tag lấy từ `features/live/tags.ts` – thêm `MAIN_LINE_TAGS.flow` = FT-101), `buildDailyReadings(report, now)` – số xác định theo ngày; mốc `done=false` → null. Kịch bản lùi 2 ngày GS-02 12:00 = 13 % LEL (Cảnh báo), lùi 9 ngày áp suất bồn 14:00 = 14,3 bar (Bất thường) |
| Dữ liệu | `src/data/dailyReport.ts` | `useDailyReport(code)` đọc CÙNG store `useReports` (trạng thái/chữ ký khớp danh sách) → `loading · error · not-found · success`; `reportDetailPath(r)` (chỉ báo cáo ngày), `findDailyReport` (mã không phân biệt hoa thường) |
| Khối dùng lại | `src/pages/reports/shared/ReportStatCards.tsx` | Hàng thẻ viền màu + vạch trái 3px (dùng được cho chi tiết tháng/quý/năm) |
| Khối màn | `src/pages/reports/daily/CheckpointTimeline.tsx`, `DailyReadingsTable.tsx` | Dải 6 mốc · bảng 11 cột (DataTable `groupBy` + `gridLines` + `density="dense"` + `className` theo dòng) |
| Trang | `src/pages/reports/DailyReportDetailPage.tsx` (+ test) | Header (mã · thứ, ngày · ca · người kiểm tra/duyệt · cập nhật + 2 badge) → 5 thẻ → dải mốc → card "Số liệu kiểm tra theo mốc" (chú giải ký hiệu, thanh lọc, bảng) |

- **Ký hiệu ô giờ**: icon sóng cyan = số đo tự động (SCADA) · chấm tím `verify` = đọc tại chỗ, kèm dòng "XM hiện trường" (dòng cao hơn) · "—" = chưa có dữ liệu (ô nền `bg-app` nếu mốc đã tới hạn) / chưa tới hạn. Icon trong ô là trang trí; nghĩa đọc qua chú giải + chữ ẩn ("– Cảnh báo", "Chưa có dữ liệu").
- **Lọc** (URL `replace`): `q` (hạng mục/thiết bị, không dấu) · `group` (V-101/E-101/PR-101/FT-101/GS) · `result` (normal/warning/abnormal/no-data); "Xóa bộ lọc". Ô **Ngày báo cáo** chuyển sang `/reports/daily/<mã ngày đó>` giữ query.
- **Vào màn**: danh sách `/reports` – mã báo cáo ngày là link, 👁 là link (`aria-label="Xem báo cáo <mã>"`).
- **Ghi nhận mốc** (5R): nút "Ghi nhận mốc HH:mm" ở header (mốc thiếu sớm nhất) + nút "Ghi nhận" trên mốc "Chưa có dữ liệu" của dải mốc → `?record=<mốc>`.

| URL (dev, `VITE_AUTH=off npx vite`) | Thấy |
|---|---|
| `/reports/daily/BCVH-N-24062026?now=2026-06-24T18:30` | Gần ảnh: 5/6 mốc 83 %, thiếu 18:00, 0 bất thường, 0/3 chữ ký; thẻ "Dữ liệu đã xác nhận" = 4 mốc (14:00 cần xác minh – kịch bản chung của danh sách) |
| `/reports/daily/BCVH-N-22062026?now=2026-06-24T18:30` | GS-02 lúc 12:00 Cảnh báo, đủ 6 mốc, đã ký 3/3 |
| `/reports/daily/BCVH-N-15062026?now=2026-06-24T18:30` | Áp suất bồn 14:00 Bất thường (thẻ đỏ) |
| `/reports/daily/BCVH-N-21062026?now=2026-06-24T18:30` | Thiếu 16:00, 18:00 (Thiếu dữ liệu) |
| `/reports/daily/XYZ` | "Không tìm thấy báo cáo" + "Về danh sách báo cáo" |

Chưa làm: nhập/sửa mốc, xác minh, ký/trả lại, xuất báo cáo (chưa biết nút header – `docs/questions.md` 12.10); API `GET /reports/:code/readings` (docs/decisions.md).

## 5Q. Ký xác nhận – bước Người kiểm tra (modal "Hoàn thành nhận xét & ký xác nhận")

Ảnh thiết kế 02/11/2026 (chưa có node Figma) – `scratch/figma-ref/report-sign/` (full, header, left, pdf-card, signer-card, footer). Sai khác: docs/figma-diffs.md; câu hỏi: docs/questions.md 12.14–12.17.

| Lớp | File | Ghi chú |
|---|---|---|
| Logic thuần | `src/features/reports/sign.ts` (+ test) | `canInspectorSign` (báo cáo NGÀY, `awaitingStep = inspector`: chờ ký / bị trả lại / chưa gửi) · `signConditions` 8 điều kiện (thứ tự đọc cột trái → phải, nhãn đổi theo lý do) + `signReady` · `openSensorFaults` (cảnh báo `sensor-signal-lost` trong ngày báo cáo, chưa `resolved`/`done`) · `approvalFlow` (3 bước + dòng phụ) · `inspectorSignStatus`, `draftVersionLabel`, `formatSignTime` · `applyInspectorSign` → chờ Người duyệt + `signLog` · hằng `DAILY_SHIFT_HOURS`, `SIGN_ROLE_LABEL`, `SIGN_PIN_REQUIRED = false` |
| Dữ liệu | `src/data/reportSign.ts` | `useReportSignData(report)` (số đo + lỗi cảm biến từ store cảnh báo) · `signDailyReport(id, input)` kiểm LẠI điều kiện từ dữ liệu hiện tại rồi `replaceReport` (store `useReports` – danh sách + chi tiết cùng cập nhật) |
| Mock | `src/mocks/reports.ts` · `src/mocks/dailyReport.ts` | `shiftRemark` ở mọi báo cáo ngày đủ mốc; bị trả lại có `reason`. Ô ngoài ngưỡng có `notes` (lùi 2, 9 ngày); **lùi 4 ngày (bị trả lại) GS-03 10:00 = 12 % LEL CHƯA ghi chú** → modal khoá |
| Modal | `src/pages/reports/sign/ReportSignModal.tsx` (+ test) | Trái: thẻ thông tin (mã · ngày/ca · loại · người · badge trạng thái + lý do trả lại) → "Điều kiện ký xác nhận" → "Luồng phê duyệt" (`WorkflowStepper vertical marker="dot"`). Phải: thẻ biểu mẫu bản nháp (Xem trước = chi tiết ngày ở thẻ mới, giữ `?now`; Tải PDF khoá) → thẻ "Xác nhận của người kiểm tra" (mã ký password – không lưu, ghi chú, ô tick trách nhiệm). Footer: Hủy · Quay lại chỉnh sửa (→ chi tiết ngày) · Ký (`aria-disabled` + `aria-describedby` = danh sách điều kiện chưa đạt) |
| Màn | `ReportsPage.tsx` · `shared/ReportTableSection.tsx` | Nút bút ký (`Ký xác nhận <mã>`) ở cột Thao tác dòng `canSign`; `?sign=<mã>` mở modal (mã lạ / đã qua bước / thiếu quyền `report:sign` → bỏ qua). Ký xong: đóng modal, bỏ `sign`, `announce` |

| URL (dev, `VITE_AUTH=off npx vite`) | Thấy |
|---|---|
| `/reports?now=2026-06-24T18:10&tab=all&sign=BCVH-N-29052026` | Gần ảnh: chờ Người kiểm tra (Phạm Văn D), 6/8 điều kiện – xem trước biểu mẫu + tick → nút Ký bật → ký → "Chờ duyệt ký" bước Người duyệt |
| `/reports?now=2026-06-24T18:10&tab=all&sign=BCVH-N-20062026` | Bị trả lại + lý do; "Còn 1 bất thường chưa ghi chú: GS-03 lúc 10:00" → không ký được |
| `/reports?…&sign=BCVH-N-23062026` | Không mở (đã qua bước Người kiểm tra) |

Chưa làm: màn nhập nhận xét cuối ca / ghi chú bất thường (cần thiết kế), Người duyệt / TAP ký, trả lại, xuất PDF, kiểm mã ký; ký báo cáo hôm nay trước hết ngày (12.15).

## 5R. Ghi nhận mốc kiểm tra (modal "Ghi nhận mốc kiểm tra HH:mm")

Figma bản sao `A88YJ2BRhICDDdeu2rtRg1`: frame `126:8506`, modal `126:7966` (1080 × 2510). Đã gọi 3 lần (metadata thưa của cả frame, ảnh modal, `get_design_context` bảng Bồn chứa `126:8062`) – lưu ở `scratch/figma-ref/report-record/` (`modal-126-7966.png`, `modal-tree.txt` = cây lớp + chữ, `code.tsx` = metadata, icon bút chì). Trang nền của frame là bản thiết kế MỚI của chi tiết báo cáo ngày (nút "Ghi nhận mốc 18:00", dải mốc có người/giờ xác nhận, luồng ký 3 bước, lịch sử) – CHƯA làm, chỉ lấy modal.

| Lớp | File | Ghi chú |
|---|---|---|
| Logic thuần | `src/features/reports/record.ts` (+ test) | Kiểu `CheckpointSnapshot` (bồn · 2 máy hóa hơi · 3 điều áp · 3 đường cấp · gas tham chiếu · báo cháy · PLC). Giá trị hiệu lực = nhập tay ?? IoT; `valueSource` (iot · field = đồng hồ khi IoT có số · manual = IoT mất · missing); `valueState`/`valueStateLabel` (ngưỡng `readingLevel`, gas "An toàn"); `recordQuality` (4 thẻ); `sensorSummary` (đường cấp = 1 cảm biến); `recordGroups` 7 nhóm (đủ giá trị; báo cháy/PLC cần PLC kết nối) + `recordProgress` + `recordBlockers` (nhóm thiếu + nhận xét bắt buộc); `appendRemark`; `inventoryNm3` (hệ số GIẢ ĐỊNH 14,7); `canRecordCheckpoint` (mốc tới hạn chưa có dữ liệu); `manualForDaily`; `applyCheckpointRecord` (mốc done, `checkpointLog`) |
| Mock | `src/mocks/checkpointRecord.ts` (+ test) | `buildCheckpointSnapshot(report, mốc, now)` – mức / áp suất / nhiệt độ bồn dùng `dailyItemReading` (CÙNG số bảng ngày); còn lại theo số ảnh ± dao động. **Lùi 3 ngày: áp suất bồn mất kết nối** (phải nhập đồng hồ cơ). Tên tag PLC: `PLC_REPORT_TAGS` (features/live/tags.ts) |
| Mock bảng ngày | `src/mocks/dailyReport.ts` | Tách `dailyItemReading`; `buildDailyReadings` dùng số nhập tay của `checkpointLog[mốc].manual` |
| Dữ liệu | `src/data/checkpointRecord.ts` | `fetchCheckpointSnapshot`; nháp sessionStorage `demo-lpg:report-record-draft:<mã>@<mốc>` (nhận xét + nhập tay, KHÔNG tệp); `recordCheckpoint` kiểm lại rồi `replaceReport` |
| Modal | `src/pages/reports/daily/CheckpointRecordModal.tsx` (+ test, `.form.test`) · `CheckpointRecordSections.tsx` · `record/` (`RecordChrome` = dải thông tin / tab / chân, `RecordSections` = tổng quan / nhóm thiết bị / nhận xét + tệp / tóm tắt, `useCheckpointRecordForm` = reducer + useFormModal, `useSectionNav` = tab theo cuộn) | Header (tiêu đề + dải Mã BC/Ngày/Ca/Mốc/Người kiểm tra) · 8 tab (cuộn tới mục, tab theo mục đang xem) · thanh "IoT đã tự điền" + chú giải · 4 thẻ · Bồn (DataTable, "Nhập giá trị đồng hồ cơ" bật ô nhập mọi dòng; ô IoT mất luôn là ô nhập) + "Dữ liệu tính toán" · Máy hóa hơi · Điều áp · Lưu lượng · Gas & Báo cháy · PLC & cảm biến · Nhận xét (chip gợi ý nối câu, bắt buộc) · Ảnh & tài liệu (`FileDropzone`, chỉ trong phiên) · thẻ tóm tắt · footer (thanh % nhóm, Hủy · Lưu bản nháp · Lưu và tiếp tục sau · Xác nhận mốc – `aria-disabled` + lý do) |
| Màn | `DailyReportDetailPage.tsx` · `daily/CheckpointTimeline.tsx` (`onRecord`) | `?record=<mốc>`; mốc lạ / đã có dữ liệu / thiếu quyền `report:record` → không mở. Hủy khi có thay đổi → hỏi "Bỏ thay đổi (và xóa nháp)" |

| URL (dev, `VITE_AUTH=off npx vite`) | Thấy |
|---|---|
| `/reports/daily/BCVH-N-24062026?now=2026-06-24T18:30&record=18:00` | Gần ảnh: IoT ổn định, 7/7 nhóm, 100 %, chỉ thiếu nhận xét |
| `/reports/daily/BCVH-N-21062026?now=2026-06-24T18:30&record=16:00` | Áp suất bồn "Mất kết nối" – ô nhập; Kết nối IoT "Gián đoạn"; nhập số + nhận xét → xác nhận → bảng 16:00 = số nhập tay |

Chưa làm: trang nền mới của chi tiết ngày; khung "AI Insights" (có trong lớp Figma nhưng không hiện trên ảnh chụp – bỏ); ghi nhận lại mốc "Cần xác minh"; upload tệp; icon riêng cho ô nhập tay trong bảng ngày.

