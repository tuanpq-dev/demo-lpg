# Báo cáo định kỳ (`/reports`)

Màn "Báo cáo vận hành định kỳ" (ảnh thiết kế `scratch/figma-ref/reports-*.png`, chưa có node Figma) và **phần dùng chung cho mọi màn báo cáo** ngày / tháng / quý / năm. Mục lục: [GUIDE.md](../../GUIDE.md).

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

- Màn chi tiết báo cáo (nút 👁 và ⋮ đang `aria-disabled`, mã báo cáo là chữ – không phải link), nút lọc nâng cao (icon phễu trong ảnh) – chờ thiết kế (`docs/questions.md` mục 12).
- API: `docs/decisions.md` ("Báo cáo – hợp đồng API cần bổ sung"). Báo cáo tuần chỉ có trong lịch, chưa có tab/bản ghi.
- Ký / trả lại / nhập mốc: chưa có luồng (chỉ hiển thị).
