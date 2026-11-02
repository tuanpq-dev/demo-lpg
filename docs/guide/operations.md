# Vận hành – chi tiết thiết bị (`/operations/devices/:deviceId`)

Hai loại thiết bị (`kind`): **E-101A – máy hóa hơi LPG** (ảnh người dùng 31/10/2026, `scratch/figma-ref/op-device-*.png`) và **PLC-SCADA – hệ thống PLC/SCADA** (Figma bản sao `A88YJ2BRhICDDdeu2rtRg1` node `168:4689`, dựng theo ảnh chụp – `scratch/figma-ref/op-device-2/`; mục 6).

## 1. URL

| URL | Kết quả |
|---|---|
| `/operations` · `/operations/overview` (link cũ của menu) · `/operations/devices` | → `/operations/devices/E-101A` (`DEFAULT_OPERATION_DEVICE` trong `src/app/assetRoutes.ts` – file nhẹ, router dùng được) |
| `/operations/devices/e-101a?…` | → `/operations/devices/E-101A?…` (giữ query) |
| `/operations/devices/plc-scada` | → `/operations/devices/PLC-SCADA` (hệ thống PLC/SCADA) |
| `/operations/devices/XYZ` | "Không tìm thấy thiết bị" + nút "Mở E-101A" |
| `/operations/:assetId` (link cũ 5D) | → `/map/:assetId` (không đổi) |

Menu "Vận hành" → mục con đầu (`operation-main`, nhãn "Vận hành") trỏ `/operations/devices`; sáng cho mọi `/operations/devices/*`. Breadcrumb "Vận hành / Giám sát thiết bị / Chi tiết thiết bị - E-101A" (hai mục đầu chưa có trang → không link).

## 2. Luồng dữ liệu

```
DeviceDetailRoute (chuẩn hoá mã / không tìm thấy) → DeviceDetailPage   src/pages/operations/DeviceDetailPage.tsx
  khung chung (header, tải/lỗi) → theo `data.kind`: VaporizerView.tsx · PlcScadaView.tsx; thẻ cột phải chung: DeviceSideCards.tsx
  useOperationDevice(id)                       src/data/operationDevice.ts
    ├─ fetchOperationDevice → mocks/operations.ts   cấu hình TĨNH: tham số + ngưỡng, PLC, nhật ký, số tạm
    ├─ useLiveData(tag tham số + PLC + trạng thái chạy E-101A/E-101B)
    └─ useAlertList (store cảnh báo chung, module nhẹ)
  useMaintenance → deriveMaintenanceSummary (trang tài sản) → deriveDeviceMaintenance
  hàm thuần src/features/operations/device.ts (có test): readParam · paramStatus · limitText · ageText · runState ·
    standbyReadiness · connectionView · lostSensorCount · mockHistory/tagSeed/trendTicks · logTimeLabel
```

- **Một nguồn**: tên tag ở `VAPORIZER_TAGS` (`features/live/tags.ts` – thêm `inletTemperature` TT-200, `outletPressure` PT-202, `efficiency` E-101A.EFF, `outletFlow` FT-201); số nền ở `mocks/scenes/live.ts`; ngưỡng ở `mocks/operations.ts`. `src/mocks/operations.test.ts` so ngưỡng áp suất với binding cảnh 3D (PT-201 ở E-101A, PT-202 ở C-101) và biên dưới nhiệt độ ra với cảnh báo ALT-00126 (50 °C).
- **Số liệu thật của mock, KHÔNG chép số trong ảnh**: TT-201 ≈ 45,6 °C (khớp Tổng quan + ALT-00126) → "Nhiệt độ ra" **Thấp** (vàng), ảnh vẽ 58,4 °C "Bình thường". Cảnh báo liên quan / bảo trì lấy từ store chung (ALT-00126, PT-201…; MT-00126 Lê Thị C hạn 1 ngày) – khác các mục minh hoạ trong ảnh.
- **Mất tín hiệu** (bad / ≥ 10 s / thiếu tag): KPI "—" + "Mất tín hiệu", bảng chữ xám, sơ đồ icon tín hiệu, PLC "Mất tín hiệu", biểu đồ điểm "Bây giờ" = null (nhãn cuối đường ẩn, không lùi về số cũ). "Cảm biến lỗi" = số tag tham số đang mất tín hiệu.
- **Xu hướng 60 phút**: lịch sử GIẢ LẬP xác định theo phút (`mockHistory` quanh số nền), điểm cuối = số trực tiếp. TODO API lịch sử tag.
- **Số tạm** (ghi chú trong tooltip/chữ ẩn): "Chế độ vận hành: SCADA từ xa" (chưa có tag chế độ điều khiển), "Hạng mục chi tiết" ở thẻ Bảo trì (phạm vi bảo dưỡng định kỳ của thiết bị – chưa có kế hoạch bảo trì từ API; KHÔNG đổi checklist MT-00126 vì test luồng nghiệm thu dùng bản ghi đó). Nhật ký vận hành = mock theo `minutesAgo` (giờ tính từ `now`).

## 3. Vùng – component

| Vùng | Component | Ghi chú |
|---|---|---|
| Header | `PageHeader` + ô chọn "Thiết bị" cạnh tiêu đề (`titleEnd`, đổi trang) + `InfoChip` (Tên, Khu vực, PLC) + `StatusPill` (Trạng thái) + `RefreshButton accent` | PLC/SCADA = trạng thái nguồn trực tiếp (`connectionView`). Đang dùng `actions`; đổi sang `actionItems` (gom Tên/Khu vực/PLC vào "Thêm" < md) khi nhánh `fix/header-mobile` vào main |
| KPI | 4 `KpiCard` icon đầu | Trạng thái thiết bị = tag `E-101A.STATE`, dòng phụ = E-101B |
| Trái | `VaporizerDiagram` (SVG, cuộn ngang < 640 px) · `DualTrendChart` (2 thang, ngưỡng, nhãn cuối) · `DataTable` 6 tham số | Ngưỡng biểu đồ = `limits.warn` của tham số |
| Phải | `MetricListCard` (`headerVariant="divided"`, dòng `separated`) · `AlertItem layout="bar"` · Card Bảo trì · danh sách PLC · `EventTimeline variant="schedule"` | Bấm cảnh báo → `/alerts?alert=<id>&range=30d`; "Xem tất cả" → `/alerts?q=E-101A&range=30d`; "Xem lịch sử bảo trì" → `/maintenance?q=E-101A` |

## 4. Thêm thiết bị khác

1. Cùng loại máy hóa hơi: thêm mục vào `operationDevices` (`src/mocks/operations.ts`); loại mới: thêm kiểu `kind` mới (như `PlcScadaDeviceMock`) vào `AnyOperationDevice` (`data/operationDevice.ts`) + `deviceLiveTags` + một `*View.tsx`. Sau đó + tag vào `features/live/tags.ts` + số nền/jitter vào `mocks/scenes/live.ts`.
2. Sơ đồ hiện chỉ có `VaporizerDiagram` – thiết bị loại khác cần component sơ đồ riêng (chọn theo loại trong trang).
3. Thêm test trong `mocks/operations.test.ts` nếu ngưỡng trùng binding cảnh 3D / cảnh báo.

## 5. Chưa làm

- Danh sách "Giám sát thiết bị" (breadcrumb mục 2) – chờ thiết kế.
- API: cấu hình thiết bị, lịch sử tag, nhật ký vận hành, chế độ điều khiển, kế hoạch bảo trì (docs/decisions.md).

## 6. Hệ thống PLC/SCADA (`/operations/devices/PLC-SCADA`)

| Lớp | File | Ghi chú |
|---|---|---|
| Tag | `features/live/tags.ts` `PLC_SCADA_TAGS` | Chẩn đoán GIẢ ĐỊNH: `PLC-01.HEARTBEAT` (ok/lost), `PLC-01.LINK` · `SCADA-01.LINK` (active/down), `PLC-01.LATENCY` (s), `PLC-01.PKT_LOSS` (%), `PLC-01.TAG_OK`, `PLC-01.MODE` (scada-remote/local), `HIST-01.SYNC` (ok/failed). Số nền: `mocks/scenes/live.ts` |
| Mock | `mocks/operations.ts` `plcScadaDevices` | 6 nhóm nguồn (tag thật của V-101, E-101A/B, PR-101, tuyến chính, gas, báo cháy) → `monitoredTags` 21; ngưỡng độ trễ 3 s, mất gói 5 %, tối thiểu 18 tag; `relatedKinds: ['sensor-signal-lost']`; uptime, hạng mục bảo trì, nhật ký = số tạm |
| Logic thuần | `features/operations/plcScada.ts` (+ test) | `readStateTag`/`stateView` (tag chuỗi, mất tín hiệu → xám), `plcStatus`/`scadaStatus`, `tagAvailability`, `sourceState`, `plcScadaRows` (9 dòng bảng), `uptimeText` |
| Dữ liệu | `data/operationDevice.ts` | `AnyOperationDevice`, `deviceLiveTags`, `plcLatencyHistory`, `deriveDeviceAlerts(…, kinds)` |
| Component | `components/PlcScadaDiagram` | Sơ đồ kết nối (nút nguồn → PLC → SCADA/HMI) |
| Trang | `pages/operations/PlcScadaView.tsx` | KPI (PLC, SCADA, tag khả dụng, độ trễ) · sơ đồ · xu hướng 60 phút (độ trễ + % tag khả dụng, ngưỡng 3 s) · bảng · trạng thái nhanh (PLC, SCADA, cảnh báo nghiêm trọng, tag lỗi, đồng bộ, chế độ, thời gian hoạt động liên tục) · cảnh báo · bảo trì (+ "Bảo trì tiếp theo") · dữ liệu PLC/SCADA · nhật ký |

- **Đổi thiết bị**: ô "Thiết bị ( mã )" CẠNH TIÊU ĐỀ (`PageHeader titleEnd`, rộng cố định 200 px – không xô vị trí khi chip Tên/Khu vực đổi độ rộng theo thiết bị; Select `filter` `fullWidth`, `OPERATION_DEVICE_OPTIONS` – mọi thiết bị có trang, chỉ mã vì tên đã ở chip "Tên") → `/operations/devices/<mã>` giữ query. Thay cho màn danh sách "Giám sát thiết bị" tới khi có thiết kế (questions 13.5, 13.8).
- **Thử mất tín hiệu** (dev, console): `__liveSimulator.setBad(['PT-101','PLC-01.HEARTBEAT'])` → tag khả dụng 20/21, nút "Bồn LPG V-101" xám, PLC "Mất tín hiệu".


## 7. Nhật ký vận hành (`/operations/logs`)

Figma bản sao `A88YJ2BRhICDDdeu2rtRg1` node `64:418` (code bị cắt + 13 icon: `scratch/figma-ref/op-logs/`, chỉ máy dev). Sai khác: docs/figma-diffs.md mục "Nhật ký vận hành"; câu hỏi: docs/questions.md mục 14. **Cột phải 25 % chưa dựng** (chưa có dữ liệu Figma).

| Lớp | File | Ghi chú |
|---|---|---|
| Logic thuần | `src/features/operations/logs.ts` (+ test) | Kiểu `OperationLogEvent` (4 loại · 3 mức · 5 trạng thái + nhãn), `alertToLogEvent` (cảnh báo store → dòng nhật ký: Nghiêm trọng/Cao → Cao, Trung bình/Thấp → Trung bình; Chưa xác nhận → Chưa xử lý, Đã xử lý → Đang theo dõi), `inLogRange` (bỏ sự kiện tương lai), `deriveLogKpis` (tổng, ↑ so với hôm qua CÙNG GIỜ – chỉ khoảng Hôm nay, % vận hành, cảnh báo chưa xử lý, số người thao tác, số thiết bị mất kết nối), `LOG_PARAMS` + `matchLogEvent` (tìm không dấu), `byNewestEvent`, `logTimeText`, `logsToCsv` |
| Mock | `src/mocks/operationLogs.ts` (+ test) | `buildOperationLogs(now)` – 31 ngày, khe 10 phút, chọn mẫu bằng PRNG theo (ngày, khe) → xác định, qua giờ chỉ thêm khe mới. Kịch bản: FT-102 (lùi 24 phút) + TT-305 (lùi 95 phút) mất kết nối **chưa xử lý** (không phải tag trực tiếp – test khoá), F-202 đang theo dõi (lùi 7 phút). Không sinh cảnh báo |
| Dữ liệu | `src/data/operationLogs.ts` | `useOperationLogs(now)` = mock + `useAlertList` (store cảnh báo nhẹ); lỗi/tải ở một nguồn → cả trang; "Làm mới" tải lại cả hai |
| Trang | `src/pages/operations/OperationLogsPage.tsx` (+ test) | Header: `DateRangeSelect` (khoảng – KPI + bảng) · `ExportButton` (CSV dòng đang lọc) · `RefreshButton accent` · `LiveDataButton`. 5 `KpiCard compact` (`valueNote` cùng dòng số). Card: `FilterBar` (tìm · Khu vực · Loại sự kiện · phễu = Xoá bộ lọc giữ khoảng) + `DataTable` 10 dòng/trang (mức = `StatusDot` + chữ; mã cảnh báo = link `/alerts?alert=<id>[&range=7d|30d]`; trạng thái = `Badge status` nhãn riêng; ⋮ `aria-disabled`) |

- URL: `?q=` `range` (today/7d/30d, mặc định today) `area` `category` (operation/alert/user-action/connection) `page`. KPI chỉ theo `range`, không theo bộ lọc bảng.
- Thử nhanh (dev): `/operations/logs` · `/operations/logs?category=alert` (= KPI "Cảnh báo phát sinh") · `/operations/logs?q=mat tin hieu` (2 dòng Chưa xử lý) · `/operations/logs?range=7d` (dòng cũ có nhãn "Hôm qua"/ngày). `?now=2026-11-02T18:30` để mọi cảnh báo mock hôm nay đã phát sinh (giờ cảnh báo mock cố định – trước giờ đó các dòng "tương lai" bị ẩn).
- Chưa làm: cột phải, menu ⋮, bấm dòng; API (docs/decisions.md "Nhật ký vận hành").

## 8. AI mô phỏng sự cố (`/operations/ai-simulation`)

Ảnh người dùng gửi 02/11/2026 (Figma: bản sao hết lượt MCP, file "Kết quả mô phỏng" không có quyền) – `scratch/figma-ref/ai-sim/` (full, header, banner, kpi, scenario-list, right-column; chỉ máy dev). Sai khác: docs/figma-diffs.md mục "AI mô phỏng sự cố"; câu hỏi: docs/questions.md mục 15.

| Lớp | File | Ghi chú |
|---|---|---|
| Logic thuần | `src/features/simulation/scenarios.ts` (+ test) | Kiểu `Scenario` (nhóm · rủi ro · trạng thái ready/needs-config · biến PLC hiển thị · tag SCADA tham chiếu · ngưỡng · bước phản ứng + mục tiêu giây), `SimulationRun`. `tagHealth` (21 tag: khả dụng / lỗi = bad / mất kết nối = thiếu tag / cũ ≥ 10 s + giờ cập nhật cuối), `runBlocker` (thiếu mapping → chưa có số liệu → tag mất tín hiệu), `simulateScenario` (XÁC ĐỊNH: tổng giây các bước ≤ mục tiêu → Đạt, ngược lại Cần cải thiện), `lastRunOf`, `runTimeText`, `agoText`, `deriveSimulationKpis`, `aiSuggestion` (luật + độ tin cậy giả định 60 % thông số khả dụng + 40 % kịch bản chạy trong 7 ngày), `SIMULATION_PARAMS` + `matchScenario` |
| Mock | `src/mocks/simulation.ts` (+ test) | 5 kịch bản (tag từ `features/live/tags.ts`, biến PLC theo `PLC_REPORT_TAGS`; ngưỡng khớp ALT-00128 / ALT-00126 – test khoá); 4 lượt mẫu (3 hôm nay, SC-004 Cần cải thiện 95 s > 60 s) |
| Dữ liệu | `src/data/simulation.ts` | `useSimulation()` = kịch bản + lịch sử (store) + `useLiveData` (21 tag `plcScadaDevices['PLC-SCADA'].monitoredTags` + tag kịch bản). `runSimulation(id, by)` – trễ giả lập 900 ms, thêm vào lịch sử; KHÔNG ghi store cảnh báo / thiết bị (test khoá). Quyền `simulation:run` (operator) |
| Trang | `src/pages/operations/AiSimulationPage.tsx` (+ test) · `simulation/ScenarioCard.tsx` · `simulation/SimulationSideCards.tsx` | Header (Lịch sử → focus "Lịch sử gần đây"; Cấu hình / Tạo kịch bản khoá – chờ thiết kế) · `EmergencyBanner tone="warning"` tĩnh · 4 `KpiCard` · `FilterBar inline standalone` (nhóm · rủi ro · trạng thái · khu vực; phễu = Xoá bộ lọc) · thẻ kịch bản (`InfoGrid` chi tiết mở/đóng `aria-expanded`; "Chạy mô phỏng" `aria-busy`, khoá kèm lý do `aria-describedby`; thiếu mapping → `Button outline-warning` "Cấu hình trước khi chạy" khoá) · cột phải 380 px (`xl`) / 484 px (`wide`): Góp ý AI · Dữ liệu PLC/SCADA · Lịch sử gần đây (4 lượt mới nhất) · Quy tắc an toàn |

- URL: `?q=` `group` (gas-leak/pressure/equipment/communication/fire) `status` (ready/needs-config) `risk` (critical/high/medium) `area`.
- Mất tín hiệu so `ts` với giờ THẬT (`Date.now()`), không theo `?now=`. KPI / giờ hiển thị theo `useNow` (giờ nhà máy).
- Thử nhanh (dev): `/operations/ai-simulation?now=2026-11-02T18:13` (gần ảnh: 5 · 3 · 1 · 21/21, độ tin cậy 92 %) · bấm "Chạy mô phỏng" SC-003 → lịch sử + KPI · console `__liveSimulator.setBad(['PT-201'])` → SC-003 khoá "PT-201 mất tín hiệu", khối PLC "Thiếu dữ liệu" · `?status=needs-config` → chỉ SC-005.
- Chưa làm: màn kết quả / chi tiết một lượt mô phỏng, cấu hình kịch bản + mapping, tạo kịch bản tùy chỉnh, lịch sử đầy đủ; dịch vụ AI thật; API (docs/decisions.md "AI mô phỏng sự cố").
