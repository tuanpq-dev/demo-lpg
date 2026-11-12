# demo-lpg – Digital Twin 2026 (Plant Control)

> **Không ghi log dài vào CLAUDE.md** (file này nạp vào MỌI phiên – giữ < 150 dòng). Log sai khác Figma ghi `docs/figma-diffs.md`, quyết định / nhật ký giai đoạn ghi `docs/decisions.md`, câu hỏi designer/khách ghi `docs/questions.md`, luồng code + bảng component + mã mock thử ghi `docs/guide/<luồng>.md`.
> **Không đọc toàn bộ GUIDE.md; chỉ mở file `docs/guide/<luồng>.md` liên quan** (GUIDE.md chỉ là mục lục). Khi đổi luồng nào thì cập nhật file của luồng đó.

## 1. Dự án và stack
- Dashboard giám sát hệ thống LPG: Tổng quan · Cảnh báo · Bảo trì · Chi tiết tài sản · Chỉnh sửa bản đồ 3D (Scene Editor – menu Cài đặt ⚙ trên header, `/settings/map-editor`). Dựng từ Figma, dữ liệu mock (thay bằng API sau).
- Vite 6 · React 18 · TS strict · Tailwind 3.4 · react-router 7 · chart SVG tự vẽ (`components/TrendChart`, không thư viện chart) · three + R3F + drei (chunk lazy `SceneViewer`) · postprocessing (lazy) · zod 4 · zustand + zundo (chỉ Editor). Alias `@/` → `src/`.
- npm workspaces: gốc = frontend; `packages/shared` (`@demo-lpg/shared`, kiểu + zod dùng chung). **Backend ở repo riêng `../demo-lpg-server`** (NestJS + Prisma/PostgreSQL, có CLAUDE.md riêng) phụ thuộc shared qua `file:../demo-lpg/packages/shared` → không đổi tên/di chuyển `packages/shared`.
- Deploy SPA: **chỉ Vercel** `vercel.json` (build, `dist`, `VITE_AUTH=off` cho demo tĩnh; mọi route trừ `/assets/*` → `/index.html` – chunk cũ phải 404 để app tự tải lại; `/assets/*` cache immutable; **header bảo mật** – CSP `script-src 'self'` không `eval`, nosniff, chống iframe… – khai ở `vercel.json`, bản xem trước của Vite gửi cùng bộ đó nên `npm run test:e2e` chạy dưới đúng CSP). Không thêm `public/_redirects`; giữ `base` Vite `/`. Giám sát lỗi: `VITE_SENTRY_DSN` (bỏ trống = tắt, `src/lib/monitoring.ts`).

## 2. Lệnh
- `npm run dev` · `npm run typecheck` · `npm run lint` (ESLint + `prettier --check`) · `npm run format` · `npm run build` · `npx vite preview --port 4317`.
- Không backend: `VITE_AUTH=off npx vite` (phiên giả admin). Backend: trong `../demo-lpg-server` (`npm run db:up` · `npm run dev`).
- Trước commit / MR: `npm run check` (= lint + typecheck + test + build – job `verify` của GitLab CI `.gitlab-ci.yml`; job `e2e` = `npm run test:e2e`). Node ghim 20/22 (`.nvmrc` = 20, `engines`). **Test tối thiểu** (`npm test`, vitest, node): CHỈ logic thuần có hậu quả nghiệp vụ nếu sai (API client, store, quy trình cảnh báo/bảo trì, điều kiện ký, mất tín hiệu, giờ nhà máy, quyền, mock khớp hợp đồng – bảng trong README.md); KHÔNG test giao diện (smoke test trình duyệt). Bộ 1165 test cũ đã xoá 10/11/2026 – không khôi phục hàng loạt.
- `npm ci` khi dev server đang chạy hỏng giữa chừng → dừng dev server trước.
- Smoke test trình duyệt: `npm run test:e2e` (`@playwright/test` 1.64.1 ghim cứng – trùng image CI; `e2e/smoke.spec.ts`, chạy trên `vite preview`); máy dev dùng trình duyệt có sẵn: `PW_CHROMIUM_PATH=` Edge `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` / Linux `/usr/bin/brave-browser`. Script kiểm riêng (so pixel, đo CLS chi tiết) vẫn để ngoài repo (scratchpad). Thêm trang / luồng mới → thêm vào `PAGES` hoặc `luồng chính`.

## 3. Cấu trúc thư mục chính (chi tiết: `GUIDE.md` mục 2 + `docs/guide/app-structure.md` Phụ lục A)
| Thư mục | Nội dung |
|---|---|
| `src/components/<Name>/` | Component thuần (không import router/data, trừ PageHeader dùng `<Link>`); barrel `src/components/index.ts`. TextField/Textarea/DatePicker/NumberField trong `FormField/` |
| `src/app/` | Nối router: `navigation.ts`, `Page.tsx`, `auth/` (`AuthProvider`, `RequireAuth`, `useCan`), `ConnectedPlantMap`, `LiveAnnouncer`, `useTableFilters`, `assetRoutes.ts` |
| `src/pages/<màn>/` | `overview`, `alerts` (drawer + panel theo loại + modal), `maintenance`, `asset`, `operations` (chi tiết thiết bị), `reports` (`shared/` = khối dùng chung mọi màn báo cáo), `editor`, `login`, `errors` (403/404/500 + `RouteError`), `shared` (khối dùng chung nhiều màn: modal tạo bảo trì, tệp đính kèm) |
| `src/data/` | Lớp dữ liệu theo màn (hook `useOverviewData`/`useAlerts`/`useMaintenance`…, hàm `derive*`), `live/` (nguồn số liệu trực tiếp), `scene.ts`, `sceneRepository.ts` |
| `src/features/<miền>/` | Logic THUẦN: `alerts/` (workflow, bands, fire, gauge, assign, inspection, pressure, update, close), `maintenance/`, `staff/`, `live/` (`tags.ts` = tên tag giả định – MỘT chỗ), `reports/` (kỳ, trạng thái suy dẫn, lọc), `tank/`, `scene/`, `scene-editor/`, `auth/` |
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
- **KHÔNG đặt ảnh thiết kế trong `public/` hay `src/`** (bị deploy công khai) – chỉ `scratch/figma-ref/` (playground đã xoá 10/11/2026). Sau build kiểm `dist/` không có đường dẫn figma. (15 ảnh cũ vẫn còn trong lịch sử git – chưa viết lại lịch sử.)
- Figma tự mâu thuẫn: **ưu tiên screenshot**, nhưng kiểm `opacity-*`/`hidden` trên node và node cha trước khi kết luận lệch. Lệch nhỏ (bo góc, khoảng cách, sắc màu, cỡ chữ 1–2 px) → tự chuẩn hoá về token và **ghi vào `docs/figma-diffs.md`** (đúng nhóm màn). Chỉ hỏi khi đổi ý nghĩa, hành vi hoặc bố cục lớn.

## 5. Quy ước bắt buộc (bản đầy đủ: docs/guide/design-system.md (Phụ lục B))
- **Tái sử dụng trước khi viết mới**; thiếu biến thể → thêm prop/variant vào component có sẵn. Không truyền qua `className` class màu/cỡ chữ trùng loại với class nội bộ.
- **Không hardcode màu**: token ở `src/styles/tokens.css`, map trong `tailwind.config.ts` (palette mặc định Tailwind đã tắt; độ trong suốt `bg-danger/10`). Chart/SVG lấy màu qua `useTokenColors()`.
  - Nền `bg-app|header|canvas`, `surface[-raised|-sunken|-muted|-chip]` · viền `line` (/10, /30), `line-card`, `line-divider` · chữ `fg[-secondary|-muted|-label|-inverse|-disabled]` · `primary`, `accent`, `info` · `success[-strong]`, `live`, `warning[-soft]`, `neutral`.
  - **Bốn token đỏ**: `danger` = viền/nền mờ/chấm/icon · `danger-text` = MỌI chữ đỏ cỡ thường · `danger-strong` = số lớn (≥ 24 px / ≥ 18.66 px đậm) · `danger-solid` = nền đặc chữ trắng. ESLint chặn `text-danger` trần và độ mờ trên chữ đỏ.
  - **Số**: dấu chấm thập phân + dấu phẩy hàng nghìn (12,450.5) qua `formatNumber` (`src/lib/number.ts`); ESLint chặn `toLocaleString('en|vi…')` cho số và `.replace('.', ',')`.
  - Cỡ chữ `2xs` 10 · `xs` 11 · `sm` 12 · `base` 14 · `md` 16 · `lg` 18 · `xl` 24 · `2xl`/`kpi` 28 · `3xl` 32. Bo góc `xs` 2 · `sm` 4 · `md` 6 · `lg` 8 · `xl` 12.
- **Breakpoint** (`tailwind.config.ts`, không viết `min-[…px]`): `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `wide` 1520 · `3xl` 1920. ≥ `wide` như Figma 1565; nội dung tối đa `max-w-content` 1920; bảng rộng cuộn ngang trong khung.
- **Đặt tên**: prop thống nhất `variant`, `tone`, `size: sm|md`, `label`, `className`; giá trị domain tiếng Anh kebab-case, nhãn tiếng Việt; JSDoc ghi node Figma / ảnh.
- **Không `eval` / `new Function`** (CSP): zod đặt `jitless` (`src/api/schemas.ts`, `features/scene/zodJitless.ts`); thư viện mới cần `eval` là smoke test báo vi phạm CSP.
- **Dữ liệu**: danh sách lớn (cảnh báo, bảo trì) đọc theo HÌNH DẠNG API – `data/<miền>Api.ts` (một `fetch*` mỗi endpoint, `useQuery` + `revision` phiên bản store, `keepPrevious`) → `data/mockServer/*` (tải lười, lọc / trang / đếm bằng hàm thuần `features/<miền>/query.ts`); KHÔNG tải toàn bộ danh sách để đếm / lọc ở trang (bảng: `useFilterParams` + `useRecordSelection`). Trang chỉ đọc qua hook trong `src/data/*`, không import `src/mocks` trực tiếp (ESLint chặn ở features/components/app/lib/pages); kiểu dữ liệu ở `src/features/<miền>/types.ts`; dữ liệu sửa được dùng `createCollectionStore`; số suy dẫn tính bằng `derive*` từ cùng danh sách; trang có 3 trạng thái loading · error (Card danger + "Thử lại") · success. Trang chờ ĐỦ dữ liệu (kể cả truy vấn của thẻ phụ) rồi mới dựng nội dung – không dựng trước bằng danh sách rỗng / chữ thế chỗ (trang đổi chiều cao, tiêu đề đổi chữ = nháy); dữ liệu cả trang dùng `useQuery(…, { remember })` để quay lại trang có ngay. Bảng có lọc → `useTableFilters` (tham số `*_PARAMS as const`, đồng bộ URL `replace`); modal/drawer mở qua query.
- **Dữ liệu trực tiếp**: `TagValue`/`LiveData` qua `useLiveData`/`useLiveStatus`; **mất tín hiệu** (bad, ≥ 10 s không cập nhật, thiếu tag) → "Mất tín hiệu" xám, KHÔNG hiện số cũ (`tagSignal(tv, Date.now())` lúc render). Tên tag giả định chỉ ở `features/live/tags.ts`.
- **Modal có form**: chỉ mount khi mở, state khởi tạo bằng hàm của `useState`; nháp form → `createSessionDraft` (sessionStorage, try/catch).
- **Comment**: giải thích code (làm gì / vì sao), không ghi lịch sử thay đổi, ngày, nhãn giai đoạn – lịch sử ở git + `docs/decisions.md`; nguồn thiết kế = node Figma / đường dẫn ảnh.
- **Lint/format**: Prettier (`.prettierrc.json`, LF – `.gitattributes`), ESLint có rule dựa trên type (`no-floating-promises`, `no-misused-promises` – handler async bọc `() => void f()`), `consistent-type-imports`, `no-console` (chỉ warn/error), mọi `eslint-disable` phải có `-- lý do`. Ngưỡng `complexity` 20 / 400 dòng/file / 200 dòng/hàm ở mức warn = backlog tách nhỏ, code mới không phình thêm. TS bật `noUncheckedIndexedAccess` (cả `packages/shared`). Hàm thuần nhận `now` qua tham số; "hôm nay" theo giờ nhà máy (`plantTime`).
- **Accessibility** (WCAG 2.1 A/AA, axe không còn lỗi critical/serious ngoài màu chờ duyệt): component controlled; role chuẩn (tablist, radiogroup, listbox, combobox, dialog); roving tabindex (`useRovingFocus`); `:focus-visible` outline accent; dialog dùng `useDialog` (focus trap, Esc ở document, có ngăn xếp, trả focus); có `onClick` → `<button>`; focus sau render bằng effect; khoá mà vẫn đọc được lý do → `aria-disabled` + `aria-describedby`; thông báo động qua `announce()`; không `tabindex` > 0; vùng cuộn = `role="region"` + tên + `tabIndex={0}`; ESLint jsx-a11y sạch; `prefers-reduced-motion` tôn trọng (cả 3D).
- **Gọi API** (timeout 15 s, GET tự thử lại 2 lần khi lỗi tạm thời, huỷ bằng `signal`): chỉ qua `api.request(path, { schema: (s) => s.XxxSchema, … })` (schema ở `src/api/schemas.ts`, `zod/mini`, TẢI LƯỜI – code tải đầu chỉ `import type`), mọi response validate zod; lỗi là `ApiError` có `code` (UI rẽ nhánh theo `code`); access token chỉ trong bộ nhớ; quyền FE (`useCan`) chỉ là UX. Chi tiết: docs/guide/backend-auth.md (mục 9) + Phụ lục D. Mock trả qua `fromMock(endpoint, schema, …)` (`data/contract.ts`): dev + test kiểm theo đúng schema đó; schema khớp kiểu TS kiểm lúc biên dịch (`api/schemaCheck.ts`).
- **Trường FE-only** của cảnh báo/bảo trì: KHÔNG sửa `packages/shared` – thêm vào `ALERT_FE_ONLY_FIELDS` / `FE_ONLY_FIELDS`, ghi endpoint cần có vào `docs/decisions.md`.
- Không commit/push khi chưa được yêu cầu; nhánh mới tách từ `main`.

## 6. Trạng thái hiện tại (12/11/2026)
- Mọi giai đoạn đã merge vào `main` (không còn nhánh tính năng chưa commit). Nhật ký từng giai đoạn, số đo, quyết định: `docs/decisions.md`.
- Màn đã có: Tổng quan + bản đồ 3D, Cảnh báo (drawer theo loại, phân công, cập nhật xử lý, đóng), Bảo trì (danh sách, chi tiết, tiến độ, nghiệm thu, phân công), Chi tiết tài sản, Báo cáo vận hành (danh sách, chi tiết ngày, ký – bước Người kiểm tra, ghi nhận mốc), Vận hành (chi tiết thiết bị, PLC/SCADA, nhật ký, AI mô phỏng: danh sách / cấu hình / theo dõi / kết quả), Chỉnh sửa bản đồ 3D (`/settings/map-editor`), đăng nhập / phân quyền (BE-1).
- Cảnh báo, Bảo trì, Báo cáo đọc theo hình dạng API (phân trang / lọc / KPI ở mock server, response kiểm schema ở dev/test); Nhật ký vận hành (≤ 30 ngày), sự kiện trang tài sản còn lọc ở client.
- Số đo gần nhất: JS route (gzip) `/overview` 138,6 KB · `/alerts` ~150 · `/maintenance` 155 · `/map` 167 · `/editor` 175; lint 0 warning; không file code nào > 400 dòng (trừ `src/mocks`).
- Dựng theo ảnh / chờ thiết kế: cột phải Nhật ký vận hành (questions 14.1), màn mô phỏng SC-002…005 (questions 16), Xuất PDF (khoá).

## 7. Việc tiếp theo
- Nối API thật cho `fetch*` trong `src/data/*` (endpoint cần có: `docs/decisions.md`); schema zod cho Vận hành / Mô phỏng (cảnh báo, bảo trì, báo cáo đã có – `src/api/*Schemas.ts`); chuyển action ghi sang "gửi → nhận bản ghi từ server"; `WebSocketLiveSource`; backend SceneRepository (`/api/scenes`); upload tệp; job theo dõi sau xử lý cảnh báo.
- Báo cáo: chi tiết tháng/quý/năm + ký/trả lại/nhập mốc + nút header chi tiết ngày (chờ thiết kế, `docs/questions.md` mục 12). Bản đồ 3D toàn nhà máy cho `/map` (nếu cần); ống 3D: kéo điểm theo Y, tự đi ống tránh thiết bị, nhánh chữ T.
- Kỹ thuật: CI trên git.tbo.vn (chưa có runner – chỉ chạy gitlab.com).
- Thay TempIcons + ảnh dự phòng khi có asset (danh sách: `docs/decisions.md` mục TODO). Chờ designer/khách: `docs/questions.md`.

## 8. Tài liệu khác (không tự nạp – mở khi cần)
| File | Khi nào đọc |
|---|---|
| `GUIDE.md` | Mục lục: cách chạy, bản đồ thư mục, bảng luồng → file |
| `docs/guide/<luồng>.md` | `app-structure` (route, mẹo tìm code, giả lập/TODO) · `design-system` (quy ước đầy đủ, bảng component) · `overview-map-3d` (Tổng quan, 3D, Editor, chi tiết tài sản) · `reports` (báo cáo định kỳ + phần dùng chung) · `live-data` · `alerts` · `maintenance` (kèm mã mock để thử) · `operations` (Vận hành – chi tiết thiết bị) · `backend-auth` – mở đúng file khi làm luồng đó |
| `docs/figma-diffs.md` | Trước khi so ảnh / sửa giao diện một màn: mọi sai khác Figma đã chuẩn hoá (nhóm theo màn) + nguồn ảnh tham chiếu |
| `docs/decisions.md` | Nhật ký từng giai đoạn (số test, bundle, script kiểm), kiến trúc 3D + Scene Editor, TODO kỹ thuật, màu đã duyệt, hợp đồng API cần bổ sung |
| `docs/questions.md` | Câu hỏi chờ designer/khách + phương án đang dùng tạm (nhóm theo màn) |
