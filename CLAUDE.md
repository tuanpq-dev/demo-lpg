# demo-lpg – Digital Twin 2026 (Plant Control)

> **Không ghi log dài vào CLAUDE.md** (file này nạp vào MỌI phiên – giữ < 150 dòng). Log sai khác Figma ghi `docs/figma-diffs.md`, quyết định / nhật ký giai đoạn ghi `docs/decisions.md`, câu hỏi designer/khách ghi `docs/questions.md`, luồng code + bảng component + mã mock thử ghi `docs/guide/<luồng>.md`.
> **Không đọc toàn bộ GUIDE.md; chỉ mở file `docs/guide/<luồng>.md` liên quan** (GUIDE.md chỉ là mục lục). Khi đổi luồng nào thì cập nhật file của luồng đó.

## 1. Dự án và stack
- Dashboard giám sát hệ thống LPG: Tổng quan · Cảnh báo · Bảo trì · Chi tiết tài sản · Scene Editor 3D. Dựng từ Figma, dữ liệu mock (thay bằng API sau).
- Vite 5 · React 18 · TS strict · Tailwind 3.4 · react-router 6 · recharts · three + R3F + drei (chunk lazy `SceneViewer`) · postprocessing (lazy) · zod · zustand + zundo (chỉ Editor). Alias `@/` → `src/`.
- npm workspaces: gốc = frontend; `packages/shared` (`@demo-lpg/shared`, kiểu + zod dùng chung). **Backend ở repo riêng `../demo-lpg-server`** (NestJS + Prisma/PostgreSQL, có CLAUDE.md riêng) phụ thuộc shared qua `file:../demo-lpg/packages/shared` → không đổi tên/di chuyển `packages/shared`.
- Deploy SPA Netlify: `netlify.toml` (một nguồn cấu hình, `/*` → `/index.html` 200, Node 20, `VITE_AUTH = "off"` cho demo tĩnh). Không thêm `public/_redirects`; giữ `base` Vite `/`.

## 2. Lệnh
- `npm run dev` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm test` (watch) · `npm run test:run` (gồm `packages/shared`) · `npm run test:coverage` · `npx vite preview --port 4317`.
- Không backend: `VITE_AUTH=off npx vite` (phiên giả admin). Backend: trong `../demo-lpg-server` (`npm run db:up` · `npm run dev`).
- Trước commit: `npm run test:run`, `npm run lint`, `npm run typecheck`. Node 22 chạy được cả bộ; Node 26 lỗi `AbortSignal` (undici ↔ jsdom) → dùng `npx -p node@20 node node_modules/vitest/vitest.mjs run`.
- Lỗi có sẵn (cả trên `main` sạch): 2 test `MaintenanceDetailPage` (luồng nghiệm thu) fail. `npm ci` khi dev server đang chạy hỏng giữa chừng → dừng dev server trước.
- Test trình duyệt: playwright-core cài trong scratchpad (không thêm dependency), Linux dùng `/usr/bin/brave-browser`; script ngoài repo.

## 3. Cấu trúc thư mục chính (chi tiết: `GUIDE.md` mục 2 + `docs/guide/app-structure.md` Phụ lục A)
| Thư mục | Nội dung |
|---|---|
| `src/components/<Name>/` | Component thuần (không import router/data, trừ PageHeader dùng `<Link>`); barrel `src/components/index.ts`. TextField/Textarea/DatePicker/NumberField trong `FormField/` |
| `src/app/` | Nối router: `navigation.ts`, `Page.tsx`, `auth/` (`AuthProvider`, `RequireAuth`, `useCan`), `ConnectedPlantMap`, `LiveAnnouncer`, `useTableFilters`, `assetRoutes.ts` |
| `src/pages/<màn>/` | `overview`, `alerts` (drawer + panel theo loại + modal), `maintenance`, `asset`, `operations` (chi tiết thiết bị), `reports` (`shared/` = khối dùng chung mọi màn báo cáo), `editor`, `login`, `playground` (mục 1–18) |
| `src/data/` | Lớp dữ liệu theo màn (hook `useOverviewData`/`useAlerts`/`useMaintenance`…, hàm `derive*`), `live/` (nguồn số liệu trực tiếp), `scene.ts`, `sceneRepository.ts` |
| `src/features/<miền>/` | Logic THUẦN có test: `alerts/` (workflow, bands, fire, gauge, assign, inspection, pressure, update, close), `maintenance/`, `staff/`, `live/` (`tags.ts` = tên tag giả định – MỘT chỗ), `reports/` (kỳ, trạng thái suy dẫn, lọc), `tank/`, `scene/`, `scene-editor/`, `auth/` |
| `src/mocks/` | Dữ liệu mẫu từ Figma; `alertKinds.ts` = cấu hình theo LOẠI cảnh báo; `scenes/*.json` cảnh 3D |
| `src/api/` | `client.ts` (fetch wrapper, refresh 401 một luồng), `types.ts` (hợp đồng API + zod, FE tự định nghĩa), `auth.ts` |
| `src/lib/` · `src/styles/` | Tiện ích (`cn`, `useDialog`, `plantTime`, `demoNow`, `sessionDraft`, `announce`…) · `tokens.css`, `global.css` |
| `scratch/` | gitignore, CHỈ máy dev: `figma-ref/` (ảnh thiết kế), ảnh chụp kiểm tra |
| `docs/` | `figma-diffs.md`, `decisions.md`, `questions.md`, `guide/` |
- Route: data router `createBrowserRouter`; chuyển hướng cố định bằng `loader: () => redirect(…)` (không `<Navigate>`); mọi route trừ `/login` `/register` `/pending` nằm trong `RequireAuth`. Danh sách route + query đầy đủ: docs/guide/app-structure.md (Phụ lục A).
- Khi thêm/đổi luồng, component, asset 3D, scene → cập nhật `docs/guide/<luồng>.md` tương ứng (component → `design-system.md`); backend/xác thực → `docs/guide/backend-auth.md`.

## 4. Figma
- File key `stJtcbE3XGzA4WFrJFE1un`. Màn: `53:11` Tổng quan · `70:2809` Cảnh báo · `70:3964` Bảo trì.
- **File gốc HẾT QUOTA MCP (seat View) → KHÔNG gọi trên `stJtcbE3…`.** Bản sao `A88YJ2BRhICDDdeu2rtRg1`: **02/11/2026 hết lượt MCP gói Starter** (thử lại 1 lần khi cần; lỗi giới hạn → dùng ảnh người dùng gửi). Khi gọi được thì TIẾT KIỆM: chỉ `get_design_context` node con (không `get_metadata`/cả frame), ≤ 2–3 lần/màn, lỗi kết nối → dừng hỏi; lưu kết quả vào `scratch/figma-ref/`. Nguồn: ảnh trong `scratch/figma-ref/` (danh sách ảnh: `docs/figma-diffs.md` mục "Nguồn tham chiếu"), ảnh/SVG người dùng gửi trong chat; thiếu thông số → đọc pixel rồi map về token gần nhất.
- **KHÔNG đặt ảnh thiết kế trong `public/`** (bị deploy công khai) – chỉ `scratch/figma-ref/`; playground tham chiếu bằng `import.meta.env.DEV ? '/scratch/figma-ref/…' : undefined`. Sau build kiểm `dist/` không có đường dẫn figma. (15 ảnh cũ vẫn còn trong lịch sử git – chưa viết lại lịch sử.)
- Figma tự mâu thuẫn: **ưu tiên screenshot**, nhưng kiểm `opacity-*`/`hidden` trên node và node cha trước khi kết luận lệch. Lệch nhỏ (bo góc, khoảng cách, sắc màu, cỡ chữ 1–2 px) → tự chuẩn hoá về token và **ghi vào `docs/figma-diffs.md`** (đúng nhóm màn). Chỉ hỏi khi đổi ý nghĩa, hành vi hoặc bố cục lớn.

## 5. Quy ước bắt buộc (bản đầy đủ: docs/guide/design-system.md (Phụ lục B))
- **Tái sử dụng trước khi viết mới**; thiếu biến thể → thêm prop/variant vào component có sẵn. Không truyền qua `className` class màu/cỡ chữ trùng loại với class nội bộ.
- **Không hardcode màu**: token ở `src/styles/tokens.css`, map trong `tailwind.config.ts` (palette mặc định Tailwind đã tắt; độ trong suốt `bg-danger/10`). Chart/SVG lấy màu qua `useTokenColors()`.
  - Nền `bg-app|header|canvas`, `surface[-raised|-sunken|-muted|-chip]` · viền `line` (/10, /30), `line-card`, `line-divider` · chữ `fg[-secondary|-muted|-label|-inverse|-disabled]` · `primary`, `accent`, `info` · `success[-strong]`, `live`, `warning[-soft]`, `neutral`.
  - **Bốn token đỏ**: `danger` = viền/nền mờ/chấm/icon · `danger-text` = MỌI chữ đỏ cỡ thường · `danger-strong` = số lớn (≥ 24 px / ≥ 18.66 px đậm) · `danger-solid` = nền đặc chữ trắng. ESLint chặn `text-danger` trần và độ mờ trên chữ đỏ.
  - Cỡ chữ `2xs` 10 · `xs` 11 · `sm` 12 · `base` 14 · `md` 16 · `lg` 18 · `xl` 24 · `2xl`/`kpi` 28 · `3xl` 32. Bo góc `xs` 2 · `sm` 4 · `md` 6 · `lg` 8 · `xl` 12.
- **Breakpoint** (`tailwind.config.ts`, không viết `min-[…px]`): `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `wide` 1520 · `3xl` 1920. ≥ `wide` như Figma 1565; nội dung tối đa `max-w-content` 1920; bảng rộng cuộn ngang trong khung.
- **Đặt tên**: prop thống nhất `variant`, `tone`, `size: sm|md`, `label`, `className`; giá trị domain tiếng Anh kebab-case, nhãn tiếng Việt; JSDoc ghi node Figma / ảnh.
- **Dữ liệu**: trang chỉ đọc qua hook trong `src/data/*`, không import `src/mocks` trực tiếp; dữ liệu sửa được dùng `createCollectionStore`; số suy dẫn tính bằng `derive*` từ cùng danh sách; trang có 3 trạng thái loading · error (Card danger + "Thử lại") · success. Bảng có lọc → `useTableFilters` (tham số `*_PARAMS as const`, đồng bộ URL `replace`); modal/drawer mở qua query.
- **Dữ liệu trực tiếp**: `TagValue`/`LiveData` qua `useLiveData`/`useLiveStatus`; **mất tín hiệu** (bad, ≥ 10 s không cập nhật, thiếu tag) → "Mất tín hiệu" xám, KHÔNG hiện số cũ (`tagSignal(tv, Date.now())` lúc render). Tên tag giả định chỉ ở `features/live/tags.ts`.
- **Modal có form**: chỉ mount khi mở, state khởi tạo bằng hàm của `useState`; nháp form → `createSessionDraft` (sessionStorage, try/catch).
- **Test**: hàm logic mới có test trong cùng commit, đặt cạnh module (`x.test.ts`; DOM → `*.test.tsx` + `// @vitest-environment jsdom`). Hàm thuần nhận `now` qua tham số; "hôm nay" theo giờ nhà máy (`plantTime`). Có ca biên. Component test truy vấn theo vai trò/tên. Lỗi thật test tìm ra → sửa hàm, không sửa test cho khớp lỗi; đổi test có chủ đích → ghi lý do.
- **Accessibility** (WCAG 2.1 A/AA, axe không còn lỗi critical/serious ngoài màu chờ duyệt): component controlled; role chuẩn (tablist, radiogroup, listbox, combobox, dialog); roving tabindex (`useRovingFocus`); `:focus-visible` outline accent; dialog dùng `useDialog` (focus trap, Esc ở document, có ngăn xếp, trả focus); có `onClick` → `<button>`; focus sau render bằng effect; khoá mà vẫn đọc được lý do → `aria-disabled` + `aria-describedby`; thông báo động qua `announce()`; không `tabindex` > 0; vùng cuộn = `role="region"` + tên + `tabIndex={0}`; ESLint jsx-a11y sạch; `prefers-reduced-motion` tôn trọng (cả 3D).
- **Gọi API**: chỉ qua `api.request(path, { schema, … })`, mọi response validate zod; lỗi là `ApiError` có `code` (UI rẽ nhánh theo `code`); access token chỉ trong bộ nhớ; quyền FE (`useCan`) chỉ là UX. Chi tiết: docs/guide/backend-auth.md (mục 9) + Phụ lục D.
- **Trường FE-only** của cảnh báo/bảo trì: KHÔNG sửa `packages/shared` – thêm vào `ALERT_FE_ONLY_FIELDS` / `FE_ONLY_FIELDS`, ghi endpoint cần có vào `docs/decisions.md`.
- Không commit/push khi chưa được yêu cầu; nhánh mới tách từ `main`.

## 6. Trạng thái hiện tại (28/10/2026)
- ✅ Đã duyệt: GĐ0–4B (tokens → primitives → form → layout/router → nghiệp vụ → chart/bảng), 5A Tổng quan, 5B Cảnh báo, 5C Bảo trì, 3D-1/1b/1c/2.
- 🔍 Chờ review (chi tiết: `docs/decisions.md` mục Roadmap): 3D-3/3D-4 Editor + ống, ground-plane, Live data, a11y/responsive, BE-1 + FE-API, 5D–5H (tài sản, chi tiết/tiến độ/nghiệm thu/phân công bảo trì), 5I–5L (drawer + phân công cảnh báo), 5M cập nhật xử lý áp suất, 5N quy trình đóng cảnh báo + khung cập nhật chung, **5O Báo cáo vận hành định kỳ + phần dùng chung báo cáo** (nhánh `feat/reports`, chưa commit – docs/guide/reports.md).
- 🔍 **Vận hành – chi tiết thiết bị E-101A** (31/10, nhánh `feat/operation-device`, chưa commit – docs/guide/operations.md): `/operations/devices/:id`, số liệu theo mock chung (khác ảnh – docs/figma-diffs.md), vitest 751, bundle chính 127,11 KB gzip.
- 🔍 **Chi tiết báo cáo ngày** (01/11, nhánh `feat/report-daily-detail`, chưa commit – docs/guide/reports.md 5P): `/reports/daily/:code`, Figma bản sao 117:4250, DataTable `groupBy`, token `verify` chờ duyệt; vitest 791, bundle chính 128,58 KB gzip.
- 🔍 **Ký xác nhận báo cáo ngày – bước Người kiểm tra** (02/11, nhánh `feat/report-sign-modal`, chưa commit – docs/guide/reports.md 5Q): modal mở bằng `?sign=<mã>` từ nút bút ký trên `/reports`; 8 điều kiện ở `features/reports/sign.ts`; vitest 816, bundle chính 127,12 KB gzip, chunk ReportsPage 9,7 KB.
- 🔍 **Ghi nhận mốc kiểm tra** (02/11, cùng nhánh `feat/report-sign-modal` – docs/guide/reports.md 5R): modal Figma bản sao 126:7966 mở bằng `?record=<mốc>` trên chi tiết ngày; logic `features/reports/record.ts`; vitest 841, bundle chính 127,65 KB gzip, chunk DailyReportDetailPage 12,4 KB.
- 🔍 **Vận hành – hệ thống PLC/SCADA** (02/11, nhánh `feat/operation-plc-scada`, chưa commit – docs/guide/operations.md mục 6): `/operations/devices/PLC-SCADA`, Figma bản sao 168:4689 (dựng theo ảnh chụp), trang tách theo `kind` (VaporizerView / PlcScadaView); vitest 863, bundle chính 128,12 KB gzip, chunk DeviceDetailPage 12,6 KB.
- 🔍 **Nhật ký vận hành** (02/11, trên `main`, chưa commit – docs/guide/operations.md mục 7): `/operations/logs`, Figma bản sao 64:418 (code bị cắt, **cột phải 25 % chưa dựng** – questions 14.1); cảnh báo lấy từ store chung, sự kiện khác = mock theo ngày; vitest 890, bundle chính 130,80 KB gzip (`main` 129,87), chunk OperationLogsPage 5,8 KB.
- 🔍 **AI mô phỏng sự cố** (02/11, trên `main`, chưa commit – docs/guide/operations.md mục 8): `/operations/ai-simulation` dựng theo 6 ẢNH (Figma không đọc được); dữ liệu PLC = 21 tag của màn PLC/SCADA, mô phỏng xác định chỉ ghi lịch sử (không đụng cảnh báo); màn kết quả/cấu hình chờ thiết kế (questions 15); vitest 920, bundle chính 131,19 KB gzip, chunk AiSimulationPage 8,5 KB.
- Số đo gần nhất (29/10, 5O): vitest 708 (`--testTimeout=30000`; test drawer/modal Cảnh báo chập chờn khi chạy cả bộ – có cả trên `main`); bundle chính 125,30 KB gzip, chunk ReportsPage 6,8 KB; SceneViewer ~254 KB, PostEffects ~80 KB, recharts ~118 KB (chỉ Tổng quan).

## 7. Việc tiếp theo
- ⚠ **Ưu tiên cao**: header tràn ngang ở 390 px trên MỌI trang (trang nền ~605 px) – dưới `md` gom NavTabs/actions của PageHeader vào menu; kiểm 390/768 mọi trang.
- Nút chuông header lỗi axe `label-content-name-mismatch` (mọi trang); số chuông còn tĩnh – derive từ cảnh báo chưa xác nhận.
- Nối API thật cho `fetch*` trong `src/data/*` (hợp đồng cần bổ sung: `docs/decisions.md`); `WebSocketLiveSource`; backend SceneRepository (`/api/scenes`); upload tệp; job theo dõi sau xử lý cảnh báo.
- Báo cáo: chi tiết tháng/quý/năm + ký/trả lại/nhập mốc + nút header chi tiết ngày (chờ thiết kế, `docs/questions.md` mục 12), màn báo cáo khác dùng `pages/reports/shared`. Bản đồ 3D toàn nhà máy cho `/map` (nếu cần); ống 3D: kéo điểm theo Y, tự đi ống tránh thiết bị, nhánh chữ T có cấu trúc.
- `plant-map.png` 7.5 MB → WebP/AVIF; thay TempIcons + ảnh dự phòng khi có asset (danh sách: `docs/decisions.md` mục TODO).
- Chờ designer/khách: `docs/questions.md`.

## 8. Tài liệu khác (không tự nạp – mở khi cần)
| File | Khi nào đọc |
|---|---|
| `GUIDE.md` | Mục lục: cách chạy, bản đồ thư mục, bảng luồng → file |
| `docs/guide/<luồng>.md` | `app-structure` (route, mẹo tìm code, giả lập/TODO) · `design-system` (quy ước đầy đủ, bảng component) · `overview-map-3d` (Tổng quan, 3D, Editor, chi tiết tài sản) · `reports` (báo cáo định kỳ + phần dùng chung) · `live-data` · `alerts` · `maintenance` (kèm mã mock để thử) · `operations` (Vận hành – chi tiết thiết bị) · `backend-auth` · `testing` – mở đúng file khi làm luồng đó |
| `docs/figma-diffs.md` | Trước khi so ảnh / sửa giao diện một màn: mọi sai khác Figma đã chuẩn hoá (nhóm theo màn) + nguồn ảnh tham chiếu |
| `docs/decisions.md` | Nhật ký từng giai đoạn (số test, bundle, script kiểm), kiến trúc 3D + Scene Editor, TODO kỹ thuật, màu đã duyệt, hợp đồng API cần bổ sung |
| `docs/questions.md` | Câu hỏi chờ designer/khách + phương án đang dùng tạm (nhóm theo màn) |
