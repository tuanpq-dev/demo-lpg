# Vận hành – chi tiết thiết bị (`/operations/devices/:deviceId`)

Theo ảnh người dùng gửi 31/10/2026 (`scratch/figma-ref/op-device-{header,kpi,left,right,full}.png`, chỉ máy dev; chưa có node Figma). Một thiết bị: **E-101A – máy hóa hơi LPG**.

## 1. URL

| URL | Kết quả |
|---|---|
| `/operations` · `/operations/overview` (link cũ của menu) · `/operations/devices` | → `/operations/devices/E-101A` (`DEFAULT_OPERATION_DEVICE` trong `src/app/assetRoutes.ts` – file nhẹ, router dùng được) |
| `/operations/devices/e-101a?…` | → `/operations/devices/E-101A?…` (giữ query) |
| `/operations/devices/XYZ` | "Không tìm thấy thiết bị" + nút "Mở E-101A" |
| `/operations/:assetId` (link cũ 5D) | → `/map/:assetId` (không đổi) |

Menu "Vận hành" → mục con đầu (`operation-main`, nhãn "Vận hành") trỏ `/operations/devices`; sáng cho mọi `/operations/devices/*`. Breadcrumb "Vận hành / Giám sát thiết bị / Chi tiết thiết bị - E-101A" (hai mục đầu chưa có trang → không link).

## 2. Luồng dữ liệu

```
DeviceDetailRoute (chuẩn hoá mã / không tìm thấy) → DeviceDetailPage   src/pages/operations/DeviceDetailPage.tsx
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
| Header | `PageHeader` + `InfoChip` (Tên, Khu vực, PLC) + `StatusPill` (Trạng thái) + `RefreshButton accent` | PLC/SCADA = trạng thái nguồn trực tiếp (`connectionView`). Đang dùng `actions`; đổi sang `actionItems` (gom Tên/Khu vực/PLC vào "Thêm" < md) khi nhánh `fix/header-mobile` vào main |
| KPI | 4 `KpiCard` icon đầu | Trạng thái thiết bị = tag `E-101A.STATE`, dòng phụ = E-101B |
| Trái | `VaporizerDiagram` (SVG, cuộn ngang < 640 px) · `DualTrendChart` (2 thang, ngưỡng, nhãn cuối) · `DataTable` 6 tham số | Ngưỡng biểu đồ = `limits.warn` của tham số |
| Phải | `MetricListCard` (`headerVariant="divided"`, dòng `separated`) · `AlertItem layout="bar"` · Card Bảo trì · danh sách PLC · `EventTimeline variant="schedule"` | Bấm cảnh báo → `/alerts?alert=<id>&range=30d`; "Xem tất cả" → `/alerts?q=E-101A&range=30d`; "Xem lịch sử bảo trì" → `/maintenance?q=E-101A` |

## 4. Thêm thiết bị khác

1. Thêm mục vào `operationDevices` (`src/mocks/operations.ts`) + tag vào `features/live/tags.ts` + số nền/jitter vào `mocks/scenes/live.ts`.
2. Sơ đồ hiện chỉ có `VaporizerDiagram` – thiết bị loại khác cần component sơ đồ riêng (chọn theo loại trong trang).
3. Thêm test trong `mocks/operations.test.ts` nếu ngưỡng trùng binding cảnh 3D / cảnh báo.

## 5. Chưa làm

- Danh sách "Giám sát thiết bị" (breadcrumb mục 2) – chờ thiết kế.
- API: cấu hình thiết bị, lịch sử tag, nhật ký vận hành, chế độ điều khiển, kế hoạch bảo trì (docs/decisions.md).
