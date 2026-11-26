# GUIDE – Đọc code demo-lpg theo luồng

Tài liệu cho người mới: đọc theo **luồng** (URL → dữ liệu → màn hình) thay vì mở file ngẫu nhiên.
GUIDE.md chỉ là **mục lục**: cách chạy, bản đồ thư mục, rồi mỗi luồng 1–2 dòng + link tới `docs/guide/<luồng>.md`. **Chỉ mở file của luồng đang làm**, không đọc hết.

> Test: bộ TỐI THIỂU (`npm test` – logic thuần có hậu quả nghiệp vụ, bảng trong `README.md`) + smoke test trình duyệt (`npm run test:e2e`) + GitLab CI. Trang `/playground`, bộ unit test cũ, `devScenarios` và cấu hình Netlify đã xoá (10/11/2026) – nhắc tới chúng trong `docs/guide/*` là **lịch sử**. Quy ước bắt buộc: [`CLAUDE.md`](CLAUDE.md) · sai khác Figma: [`docs/figma-diffs.md`](docs/figma-diffs.md) · quyết định/nhật ký: [`docs/decisions.md`](docs/decisions.md).

---

## 1. Dự án làm gì

- Dashboard giám sát hệ thống LPG "Digital Twin 2026 – Plant Control": **Tổng quan**, **Cảnh báo**, **Bảo trì**, **Báo cáo** vận hành, **Vận hành** (chi tiết thiết bị, nhật ký, AI mô phỏng), **Chi tiết tài sản** (`/map/:assetId` – tab "Bản đồ nội khu", hiện có V-101).
- Dựng theo Figma (file `stJtcbE3XGzA4WFrJFE1un`); ảnh tham chiếu trong `scratch/figma-ref/` – **chỉ ở máy dev** (gitignore). KHÔNG đặt ảnh thiết kế trong `public/` (bị deploy công khai).
- Dữ liệu hiện là **mock** (`src/mocks/`), đi qua lớp `src/data/` để sau thay bằng API mà không sửa UI.
- Bản đồ nhà máy có 2 kiểu: ảnh 2.5D (mặc định) và cảnh 3D (three.js) dựng từ JSON `SceneConfig`.
- Có **Chỉnh sửa bản đồ 3D** (Scene Editor, `/settings/map-editor` – menu Cài đặt ⚙ trên header) để dựng/sửa cảnh 3D, lưu tạm trong localStorage.

**Chạy**

| Lệnh / URL | Tác dụng |
|---|---|
| `npm run dev` | Dev server Vite (mặc định http://localhost:5173); gọi backend thẳng ở `VITE_API_URL` (`.env.development`: http://localhost:3000) qua CORS |
| Backend | Repo riêng `../demo-lpg-server` (`npm run db:up` + `npm run dev` ở đó) – mục 9 |
| `/login` · `/register` · `/pending` | Đăng nhập · đăng ký · "đang chờ duyệt" (mọi trang khác cần đăng nhập; `VITE_AUTH=off` = bỏ đăng nhập, phiên giả admin) |
| `npm run build` · `npm run typecheck` | Build production (gồm `tsc -b`) · chỉ kiểm tra kiểu |
| `/overview?map=3d` | Bản đồ 3D thay cho ảnh 2.5D |
| `/overview?map=3d&edit=1` | Chế độ sửa nhanh trên bản đồ (kéo/xoay, Copy JSON) – chỉ engineer/admin |
| `/overview?map=3d&quality=low` | Ép preset 3D `low` / `medium` / `high` (mặc định tự chọn theo FPS) |
| `/overview?scene=tram-chiet-nap` | Mở cảnh 3D khác (cảnh mẫu hoặc cảnh lưu từ Editor), luôn ở 3D |
| `/overview?map=3d&focus=V-101` | Mở 3D và bay tới object (thêm chế độ xem "<nhãn object>") – nút "Xem trên bản đồ" của trang chi tiết |
| `/map` · `/map/V-101` | Tab "Bản đồ nội khu": `/map` mở thẳng chi tiết "Bồn LPG V-101" (như ảnh 5D). `/map/v-101` → `/map/V-101`; mã lạ → "Không tìm thấy tài sản"; `/operations/V-101` (link cũ) → `/map/V-101`; `?hide=alert,sensor` ẩn loại sự kiện; `?create=1` mở modal tạo yêu cầu bảo trì |
| `/settings/map-editor` | Chỉnh sửa bản đồ 3D – chỉ engineer/admin (quyền `scene:write`; `VITE_AUTH=off` = phiên giả admin nên vào được, build thêm `VITE_SCENE_EDITOR=false` để chỉ mở khi có `?edit=1`). `/editor` (link cũ) → chuyển hướng |
| `/operations` · `/operations/devices/E-101A` | Menu "Vận hành": chi tiết máy hóa hơi E-101A (ảnh op-device-*.png); mã khác kiểu chữ → mã chuẩn; mã lạ → "Không tìm thấy thiết bị" – docs/guide/operations.md |
| `/reports?now=2026-06-24T18:30` | Báo cáo vận hành định kỳ, dữ liệu gần đúng ảnh thiết kế (`?now=` chỉ dev) – docs/guide/reports.md |

- Deploy (**chỉ Vercel**): `vercel.json` (build `VITE_AUTH=off npm run build`, publish `dist`, mọi route trừ `/assets/*` → `/index.html` – chunk cũ phải 404 để app tự tải lại; `/assets/*` cache immutable; header bảo mật CSP…) – không thêm file `_redirects` vào `public/`. Node: 20.x hoặc 22.x (`engines`).
- Lý do: app là SPA dùng history router (`createBrowserRouter` trong `src/main.tsx`), host tĩnh không có file `/alerts` nên gõ thẳng URL hoặc F5 sẽ 404 nếu thiếu luật trả `index.html` cho React Router xử lý; vì vậy `base` trong `vite.config.ts` phải để mặc định `/`.

---

## 2. Bản đồ thư mục

```
src/
├─ main.tsx            khai báo route (createBrowserRouter)
├─ app/                "keo" nối router + dữ liệu vào component
├─ pages/              mỗi màn một thư mục (overview, alerts, maintenance, asset, operations, reports, editor, login, errors, shared)
├─ components/         component THUẦN (không import router/data), barrel index.ts
├─ widgets/            component NGHIỆP VỤ một miền (thẻ cảnh báo, sơ đồ thiết bị, chọn nhân sự…), barrel index.ts
├─ data/               hook + hàm dữ liệu, gom theo miền (alerts/, maintenance/, reports/, operations/, scene/, live/…)
├─ mocks/              dữ liệu giả từ Figma; mocks/scenes/*.json = cảnh 3D
├─ scene3d/            vẽ 3D (React Three Fiber, tải lười): PlantMap, SceneViewer, asset, công cụ sửa
├─ features/scene/     phần thuần của cảnh 3D: kiểu SceneConfig, validate, hình học, ống
├─ features/scene-editor/  logic Editor (store, ops, validate, nháp)
├─ features/<miền>/    logic THUẦN theo miền (alerts, maintenance, reports, staff, auth, simulation…)
├─ features/live/      kiểu số liệu trực tiếp, quy tắc mất tín hiệu, tags.ts (tên tag giả định – một chỗ)
├─ features/tank/      volume.ts (mức → % thể tích), layers.ts (3 lớp trong bồn)
├─ api/                gọi backend: client (fetch + refresh 401), schema zod hợp đồng API, auth
├─ hooks/              hook dùng chung (useQuery, useDialog, useNow…)
├─ lib/                tiện ích thuần, KHÔNG hook (cn, number, plantTime, createCollectionStore…)
├─ assets/digital-twin/    SVG/PNG từ Figma + sổ đăng ký icon
└─ styles/             tokens.css (màu, bo góc…) + global.css

packages/shared/       kiểu + schema zod dùng chung FE/BE (scene, live, alerts, maintenance, roles, auth)
```

| Thư mục | Chứa gì | Khi nào cần vào |
|---|---|---|
| `src/main.tsx` | Danh sách route, lazy-load trang | Thêm trang / đổi đường dẫn |
| `src/app/` | `Page.tsx` (`AppFrame` khung + header dựng một lần, `Page` thân trang), `navigation.ts` (menu), `settingsRoutes.ts` (menu Cài đặt), `auth/` (`AuthProvider`, `RequireAuth`, `useCan`), `useTableFilters.ts`, `useRecordSelection.ts`, `kpi.tsx`, `HeaderActions.tsx`, `ConnectedPlantMap.tsx`, `AssetModelPanel.tsx` (mô hình 3D tài sản + ảnh dự phòng), `editorAccess.ts`, `LiveAnnouncer.tsx`, `OfflineBanner.tsx`, `ToastHost.tsx`, `Placeholder.tsx` | Nối component với URL/dữ liệu; thêm tab menu |
| `src/pages/` | Trang ghép component: `overview/`, `alerts/`, `maintenance/`, `asset/` (`AssetDetailPage`), `operations/` (chi tiết thiết bị, nhật ký, AI mô phỏng), `reports/` (`ReportsPage` + khối dùng chung `shared/`), `editor/` (Chỉnh sửa bản đồ 3D), `login/`, `errors/` (403/404/500), `shared/` (khối dùng chung nhiều màn) – màn không import màn khác (chỉ `shared/`, `errors/`) | Sửa bố cục/hành vi một màn |
| `src/components/` | 40+ component thuần, mỗi cái một thư mục `<Tên>/` | Sửa giao diện dùng chung |
| `src/widgets/` | 17 component nghiệp vụ (được dùng hằng số / hàm thuần của `features`), mỗi cái một thư mục `<Tên>/` | Sửa thẻ / sơ đồ / bảng của một miền |
| `src/data/` | Theo miền: `src/data/alerts/`, `src/data/maintenance/`, `src/data/reports/`, `src/data/operations/`, `src/data/scene/` (+ `repository.ts`), `src/data/live/`, `src/data/mockServer/`; miền một file: `overview.ts`, `assetDetail.ts`, `staff.ts` | Đổi nguồn dữ liệu, bộ lọc, số liệu suy dẫn |
| `src/mocks/` | `src/mocks/overview.ts`, `src/mocks/alerts.ts`, `src/mocks/maintenance.ts`, `src/mocks/assets.ts` (thông số tĩnh tài sản + sự kiện), `src/mocks/reports.ts` (báo cáo sinh theo ngày hiện tại), `src/mocks/types.ts`, `src/mocks/scenes/` (cảnh 3D + số liệu giả `live.ts`) | Sửa/thêm dữ liệu giả |
| `src/scene3d/` | Vẽ 3D: `PlantMap`, `SceneViewer`, asset thiết bị, công cụ sửa của Editor | Hình dáng / ánh sáng / tương tác bản đồ 3D |
| `src/features/scene/` | Phần thuần: kiểu `SceneConfig`, validate zod, migrate, hình học, ống | Đổi dữ liệu / quy tắc cảnh 3D |
| `src/features/scene-editor/` | Store undo/redo, thao tác thuần, kiểm tra, nháp | Logic của Chỉnh sửa bản đồ 3D |
| `src/lib/` | Tiện ích thuần / store ngoài React: `cn`, `number` (`formatNumber`, `withUnit`, `pad2`), `plantTime`, `createCollectionStore`, `tokens`, `toast`, `announce` | Viết tiện ích dùng lại (không phải hook) |
| `src/hooks/` | Hook dùng chung: `useQuery`, `useDialog`, `useRovingFocus`, `useNow`, `useFormModal`, `useTokenColors`, `useToasts`, `useAnnounce`, `useReducedMotion`… | Viết hook dùng lại nhiều màn (hook riêng một màn để cạnh màn đó) |
| `src/assets/digital-twin/` | Icon + ảnh bản đồ, đăng ký trong `src/assets/digital-twin/index.ts` | Thêm icon từ Figma |
| `src/styles/` | `tokens.css`, `global.css` | Đổi màu/token |
| `scratch/figma-ref/` (gitignore, chỉ máy dev) | Ảnh chụp Figma để so; ảnh người dùng gửi không có node (`mt-*-design.png`, `asset-v101-design.png`). Trước 27/10/2026 nằm ở `public/figma-ref/` (đã xoá; vẫn còn trong lịch sử git) | Đối chiếu thiết kế |
| `packages/shared/src/` | Hợp đồng dữ liệu FE/BE: `scene/` (SceneConfig, specs, migrate, parse), `live.ts`, `alerts.ts`, `maintenance.ts`, `roles.ts`, `auth.ts`. FE dùng mã nguồn (alias), backend (repo riêng) dùng bản build `dist/` | Đổi kiểu dữ liệu dùng chung, thêm quyền |
| `src/api/` | Gọi backend: `client.ts` (fetch wrapper, lỗi có kiểu, refresh khi 401), `types.ts` (types + zod của hợp đồng API), `auth.ts` (phiên đăng nhập) | Thêm endpoint, đổi hợp đồng API |
| `src/app/auth/`, `src/features/auth/`, `src/pages/login/` | `AuthProvider`/`useAuth`/`useCan`, `RequireAuth`; logic thuần (phiên, quyền, thông báo lỗi); trang `/login`, `/register`, `/pending` | Đổi luồng/giao diện đăng nhập |

---

## 3. Luồng (mỗi luồng một file – mở file liên quan khi làm)

| Luồng | Nội dung | File |
|---|---|---|
| Cấu trúc app | Từ URL đến màn hình (4a), thêm trang + tab, mẹo tìm code (7), chỗ còn giả lập/TODO (8), cấu trúc thư mục + route/query chi tiết (Phụ lục A) | [docs/guide/app-structure.md](docs/guide/app-structure.md) |
| Design system | Quy ước (3), token → primitive → nghiệp vụ (4g), **bảng component** (6), quy ước đầy đủ (Phụ lục B), bảng component tóm tắt (Phụ lục C) | [docs/guide/design-system.md](docs/guide/design-system.md) |
| Tổng quan + bản đồ 3D | Luồng dữ liệu Tổng quan (4b), bản đồ 3D (4e), chế độ sửa + Scene Editor (4f), chi tiết tài sản `/map/:assetId` (4h); thêm KPI / asset 3D / ống / cổng / scene | [docs/guide/overview-map-3d.md](docs/guide/overview-map-3d.md) |
| Số liệu trực tiếp | `TagValue`/`LiveData`, mất tín hiệu, nguồn mock → WebSocket, thêm tag (4b – live) | [docs/guide/live-data.md](docs/guide/live-data.md) |
| Cảnh báo | Danh sách /alerts (4c), drawer theo loại áp suất/gas/cháy (4m), phân công (4n), cập nhật xử lý khung chung áp suất/gas/cháy (4o), xác nhận đóng + tab Chờ đóng (4p); **bảng mã mock để thử** | [docs/guide/alerts.md](docs/guide/alerts.md) |
| Bảo trì | Model + quá hạn + modal tạo (4d), chi tiết yêu cầu (4i), tiến độ (4j), nghiệm thu (4k), phân công (4l); **mã mock để thử** | [docs/guide/maintenance.md](docs/guide/maintenance.md) |
| Vận hành – thiết bị, nhật ký, AI mô phỏng | `/operations/devices/E-101A`: URL, luồng dữ liệu (tag/ngưỡng một nguồn, số tạm), vùng ↔ component, thêm thiết bị · `/operations/logs` Nhật ký vận hành (mục 7) · `/operations/ai-simulation` AI mô phỏng sự cố (mục 8) | [docs/guide/operations.md](docs/guide/operations.md) |
| Báo cáo định kỳ | `/reports`: tách lớp dùng chung ngày/tháng/quý/năm (5O-1), quy tắc trạng thái (5O-2), **URL thử với `?now=`** (5O-3), chưa làm (5O-4) | [docs/guide/reports.md](docs/guide/reports.md) |
| Đăng nhập + backend | Biến môi trường, chạy cùng backend, hợp đồng API, luồng đăng nhập, gọi endpoint mới (9a–9f, Phụ lục D) | [docs/guide/backend-auth.md](docs/guide/backend-auth.md) |
| Chất lượng code | `npm run lint` (ESLint + Prettier), `npm run typecheck`, `npm run build`; smoke test trình duyệt ngoài repo | [CLAUDE.md](CLAUDE.md) mục 2 + 5 |

Tham chiếu cũ dạng "GUIDE 4m" / "GUIDE mục 6" vẫn tìm được: số mục giữ nguyên trong file của luồng. Đổi luồng nào → cập nhật file của luồng đó (và dòng tương ứng ở bảng trên nếu phạm vi đổi).
