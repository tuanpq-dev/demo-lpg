# demo-lpg – Digital Twin 2026 (Plant Control)

## 1. Dự án
- Dashboard giám sát hệ thống LPG (Tổng quan · Cảnh báo · Bảo trì), dựng từ Figma, dữ liệu mock có thể thay bằng API.
- Stack: Vite 5 · React 18 · TypeScript strict · Tailwind 3.4 · react-router 6 · recharts 2.13 · clsx · three 0.170 + @react-three/fiber 8 + drei 9 (chỉ trong chunk lazy `SceneViewer`) · @react-three/postprocessing 2.19 (chỉ trong chunk lazy `PostEffects`) · zod 3.23 (chỉ trong chunk lazy `parse`) · zustand 5 + zundo 2 (chỉ trong chunk lazy `EditorPage`). Alias `@/` → `src/`.
- Lệnh: `npm run dev` · `npm run typecheck` · `npm run build` · `npx vite preview --port 4317`.
- Deploy SPA (Netlify): `netlify.toml` (build + publish `dist` + Node 20 + `/*` → `/index.html` 200); chỉ một nguồn cấu hình (không thêm `public/_redirects`).
- Lý do: history router (`createBrowserRouter`) – host tĩnh không có file cho `/alerts`… nên gõ URL/F5 sẽ 404 nếu không trả `index.html`; giữ `base` của Vite là `/`, không đặt `basename`.
- Test tương tác: playwright-core + Edge cài sẵn (`channel: 'msedge'`; máy Linux: `npm i playwright-core` trong scratchpad + `executablePath: '/usr/bin/brave-browser'`), script để ngoài repo (scratchpad), không thêm dependency. Module thuần (parse, specs, data) test được trong trang qua `page.evaluate(() => import('/src/…ts'))` trên dev server.
- Cấu trúc:
  - `src/components/<Name>/`: component thuần (không import router, trừ PageHeader dùng `<Link>`); barrel `src/components/index.ts`.
  - `src/app/`: nối router: `navigation.ts` (menu), `Page.tsx` (AppLayout + header theo URL), `HeaderActions.tsx`, `useTableFilters.ts`, `kpi.tsx`, `Placeholder.tsx`, `ConnectedPlantMap.tsx` (nạp cảnh theo `sceneId` → PlantMap 3D), `editorAccess.ts` (quyền vào /editor).
  - `src/data/`: lớp dữ liệu theo màn: `overview.ts` (`map` chỉ cho ảnh 2.5D), `alerts.ts`, `maintenance.ts`, `scene.ts` (`useSceneConfig(sceneId)`, `fetchScene`, `SCENE_IDS`, `isSampleScene`, `useSceneList`, `SENSOR_TAGS`, `useLiveData`), `sceneRepository.ts` (`SceneRepository` + `LocalStorageRepository`).
  - `src/mocks/`: dữ liệu mẫu từ Figma; `mocks/scenes/`: `{sceneId}.json` (khu-bon-lpg, tram-chiet-nap – gồm views + nhãn), `live.ts` (số liệu giả lập).
  - `src/features/scene/`: cảnh 3D (mục 6): `types`, `fields`, `geometry` (`resolveScene`), `markers`, `parse` (zod, lazy), `colors` (+ `inverseToneMap`), `ground` (thuần: độ cao đáy thế giới, `mayFloat`), `migrate` (thuần: định dạng cũ → hiện tại), `look` (thông số ánh sáng/bloom/nét viền), `quality` (preset), `pulse`, `PipeMesh`, `SceneViewer` (default export, lazy), `EditTools` (`GROUND_PLANE`/`groundHit`, kéo trên sàn `startGroundDrag`, gizmo xoay/scale, chọn bằng tia/vùng, viền sàn, vạch chân), `editConstants` (thuần: MIME kéo thả, snap, vùng sàn, ngưỡng tia sàn), `PostEffects` (lazy), `assets/` (`specs` thuần + `registry` + component asset + `parts` (thang, lan can, bích…) + `materials`).
  - `src/features/scene-editor/`: logic Editor thuần/không UI (mục 6b): `store` (zustand + zundo), `ops` (biến đổi SceneConfig), `validate`, `draft` (tự lưu nháp).
  - `src/lib/`: `cn`, `useRovingFocus`, `useNow`, `tokens` (màu cho SVG/chart), `useDialog`, `createCollectionStore`, `useElementSize`.
  - `src/pages/`: `overview/`, `alerts/`, `maintenance/` (gồm `CreateMaintenanceModal.tsx`), `editor/` (Scene Editor: `EditorPage`, `EditorViewport`, `AssetLibrary`, `Outliner`, `PropertiesPanel`, `ViewsPanel`, `ValidationPanel`, `dialogs`, `useEditorActions`, `AssetGlyph`), `playground/`, `SimplePage.tsx`.
  - `src/assets/digital-twin/`: SVG/PNG từ Figma, đăng ký trong `index.ts`.
  - `src/styles/`: `tokens.css`, `global.css`.
  - `public/figma-ref/`: ảnh tham chiếu.
- Route (data router `createBrowserRouter` – cần cho `useBlocker`): `/overview` `/alerts` `/maintenance` `/map` `/reports` (placeholder) `/editor` (chỉ khi `?edit=1` hoặc `VITE_SCENE_EDITOR=true`, không thì về `/overview` – TODO phân quyền thật) `/playground`; `/` và route lạ → `/overview`. Trang có chart lazy-load (`src/main.tsx`). `/overview?map=3d` bật bản đồ 3D (mặc định ảnh 2.5D); nút 2.5D/3D góc dưới trái bản đồ đổi query (`replace`). `?edit=1` (dev) bật chế độ sửa cảnh 3D. `?quality=low|medium|high` ghi đè preset 3D (mặc định auto). `/overview?scene=<id>` mở cảnh khác (mẫu hoặc lưu từ Editor) – luôn 3D; về 2.5D thì bỏ `scene`. Dev: `?exposure=1.2` thử exposure; `window.__sceneGl` = renderer (đếm draw call), `window.__sceneThree` = scene three (đo hộp bao), `window.__sceneR3f()` = store R3F (camera/controls cho test).

- Khi thêm/đổi luồng, component, asset 3D, scene thì cập nhật GUIDE.md (mục 4–6).

## 2. Figma
- File key `stJtcbE3XGzA4WFrJFE1un`. Màn: `53:11` Tổng quan · `70:2809` Cảnh báo · `70:3964` Bảo trì.
- **MCP đã HẾT QUOTA (seat View, 6 lần/tháng) → KHÔNG gọi Figma MCP.** Nguồn thay thế:
  - **Lâu dài:** ảnh chụp trong `public/figma-ref/` (`53-11-overview.png`, `70-2809-alerts.png`, `70-3964-maintenance.png`, các crop node) và ảnh thiết kế modal `mt-create-modal-design.png`.
  - **Cache design context** (có thể mất khi đổi phiên): `C:/Users/ptuan/AppData/Local/Temp/claude/f--TEMPO-demo-lpg/0d061ac4-b5cd-4d25-bf82-aad81de290f4/scratchpad/figma/{53-11,70-2809,70-3964}.part0.txt`. Mỗi file bị cắt ở 100KB: 53:11 cắt sau 53:498, 70:3964 cắt ở 70:5402.
  - Ảnh hoặc SVG người dùng gửi trong chat.
  - Khi thiếu thông số: đọc pixel từ ảnh chụp rồi map về token gần nhất, kích thước lấy từ metadata.

## 3. Quy ước
- **Tái sử dụng trước khi viết mới.** Thiếu biến thể thì thêm prop/variant vào component có sẵn.
- **Không hardcode màu:** token ở `src/styles/tokens.css` (CSS var dạng kênh RGB), map trong `tailwind.config.ts`. Palette mặc định của Tailwind đã tắt; độ trong suốt dùng `bg-danger/10`, `border-line/30`. Chart/SVG lấy màu qua `useTokenColors()` (`src/lib/tokens.ts`).
- **Token:**
  - Nền: `bg-app|header|canvas`, `surface[-raised|-sunken|-muted|-chip]`.
  - Viền: `line` (/10, /30, 100%), `line-card`, `line-divider`.
  - Chữ: `fg[-secondary|-muted|-label|-inverse|-disabled]`.
  - Thương hiệu: `primary`, `accent`, `info`.
  - Trạng thái: `success[-strong]`, `live`, `warning[-soft]`, `danger[-strong]`, `neutral`.
  - Chữ: `2xs` 10 · `xs` 11 · `sm` 12 · `base` 14 · `md` 16 · `lg` 18 · `xl` 24 · `2xl`/`kpi` 28 · `3xl` 32. Bo góc: `xs` 2 · `sm` 4 · `md` 6 · `lg` 8 · `xl` 12.
- **Figma tự mâu thuẫn:**
  - Ưu tiên screenshot; nhưng trước khi kết luận lệch, kiểm tra `opacity-*`/`hidden` trên node và các node cha.
  - Sai khác nhỏ (bo góc, khoảng cách, sắc màu, cỡ chữ lệch 1–2px): tự chuẩn hóa về token rồi ghi log ở mục 8.
  - Chỉ hỏi khi thay đổi ý nghĩa, hành vi hoặc bố cục lớn.
- **Đặt tên:** thư mục `components/<PascalCase>/` + `index.ts` (ngoại lệ: TextField/Textarea/DatePicker nằm trong `FormField/`). Prop thống nhất: `variant`, `tone`, `size: sm|md`, `label` (aria), `className`. Giá trị domain viết tiếng Anh kebab-case, nhãn hiển thị tiếng Việt (ghi đè bằng `children`). JSDoc ghi node Figma.
- **Tránh xung đột class:** không truyền qua `className` class màu/cỡ chữ trùng loại với class nội bộ của component; thêm prop/variant thay vào đó.
- **Accessibility:**
  - Component điều khiển controlled (`value`/`onChange`).
  - Roving tabindex (`useRovingFocus`): Tabs và Segmented dùng `auto`, NavTabs dùng `manual`.
  - Role chuẩn: tablist, radiogroup, listbox, combobox, dialog.
  - `:focus-visible` hiển thị outline accent.
  - Dialog dùng `useDialog`: giữ focus, Esc lắng nghe ở document, khoá cuộn, trả focus khi đóng.
  - Có `onClick` thì render thành `<button>`; callback trả về `id`.
  - Focus sau render bằng effect, không dùng `requestAnimationFrame`.
- **Dữ liệu:**
  - Trang chỉ đọc qua hook `useOverviewData()` / `useAlerts()` / `useMaintenance()` (`src/data/*`), không import `src/mocks` trực tiếp. Dữ liệu sửa được dùng `createCollectionStore` (store chung, mutation optimistic).
  - Mọi số liệu suy dẫn (KPI, thẻ ưu tiên, số đếm tab, lịch) tính từ cùng một danh sách bằng các hàm `derive*`, không hardcode.
  - Trang xử lý đủ 3 trạng thái: loading (Placeholder) · error (Card danger + nút "Thử lại") · success.
- **Bảng có lọc → `useTableFilters`** (`src/app/useTableFilters.ts`):
  - Khai báo tham số bằng hằng `*_PARAMS as const`; bộ lọc, trang, bản ghi đang mở và lựa chọn dòng đồng bộ URL (`replace`).
  - Modal/drawer mở qua query (`?open=`, `?alert=`, `?create=1&device=&from=`).
- **Modal có form:** chỉ mount khi mở, khởi tạo state bằng hàm khởi tạo của `useState` (tránh nháy giá trị cũ).

## 4. Component đã có (`src/components/…`)
| Component | Mô tả |
|---|---|
| Icon / TempIcons / EditorIcons | `<Icon name>` từ assets Figma · `Icon/TempIcons.tsx` là SVG tạm (chỉ có trong ảnh) · `Icon/EditorIcons.tsx` icon tạm cho Editor (công cụ, ẩn/khoá, tệp, undo/redo) |
| Button | primary/ghost/icon/toolbar/overlay/link, sm/md, `pressed` |
| Badge | severity (sm/md) · status (unacknowledged/pending/assigned/in-progress/review/done) · count |
| StatusDot, StatusPill | Chấm trạng thái (circle/square, pulse) · pill trạng thái hệ thống |
| Card, Divider, ProgressBar | Khung card (bar/plain header, tone, radius) · đường kẻ · thanh tiến độ |
| NavTabs, Tabs, SegmentedControl | Menu chính · tabs gạch chân + chip đếm · nhóm chọn 1 (overlay/field + tone, overlay `size` sm/md) |
| SearchInput, Select, Combobox | Ô tìm kiếm · dropdown (filter/button/field, side) · combobox tìm kiếm đơn/nhiều + avatar/chip |
| FormField (+TextField, Textarea, DatePicker, NumberField, Vec3Field) | Nhãn/lỗi/gợi ý chung · ô nhập · date/datetime-local · ô số (chốt khi Enter/blur/↑↓, kẹp min/max, integer, unit, `onClear` = về mặc định, `hideLabel`/`size sm`/`prefix`) · 3 ô X/Y/Z (`only` = chỉ hiện một số trục, vd `[0, 2]`) |
| Checkbox, ChecklistEditor, FileDropzone | Checkbox (indeterminate; `showLabel` = nhãn chữ bên cạnh) · checklist kéo thả/Alt+↑↓/mẫu · kéo thả tệp |
| TreeView | Cây chọn nhiều (ARIA tree): Ctrl/⌘ đảo, Shift dải, phím ↑↓←→ Home End Space Enter, F2/double-click đổi tên (trả lỗi → giữ ô), `renderActions` bên phải dòng; không controlled thì nhớ nhánh đóng |
| FilterBar, DataTable, Pagination | Thanh lọc · bảng (chọn dòng, header sticky, thao tác, rỗng) · phân trang |
| AppHeader, PageHeader, AppLayout | Header 60px · breadcrumb/tiêu đề/actions · layout full/sidebar 326px/`workspace` (cao đúng 1 màn hình, nội dung tự cuộn – /editor) |
| KpiCard, SystemHealthCard | KPI (default/danger/with-progress/compact) · độ tin cậy hệ thống |
| AlertItem, AlertCard, PriorityTaskCard | Dòng cảnh báo sidebar · thẻ cảnh báo ưu tiên · thẻ việc bảo trì ưu tiên |
| AssetRow/AssetWatchlist, EventTimeline/RecentEventsCard | Theo dõi thiết bị · timeline (event/schedule + location) |
| ChartCard, AreaTrendChart, LineTrendChart, CategoryBarList, DonutGauge | Khung chart + tooltip · area/line 24h · thanh theo khu vực · donut |
| PlantMap, MapMarker | Thuần. `renderer="image"`: ảnh 2.5D + markers/views do trang truyền · `"three"`: nhận `scene` + `liveData` + `onSelect` (+ `editable`, `quality`, `onFallback`), views/nhãn lấy từ cảnh, SceneViewer lazy. Chung controls, `onRendererChange` → nút 2.5D/3D, `notice` → thông báo nhỏ cạnh nút; marker callout/side/tag, tone thêm `neutral` (offline), `translucent` (nền /85 + blur, dùng ở 3D). Nạp cảnh theo id: `ConnectedPlantMap` (src/app) |
| DetailDrawer, AlertDetailDrawer, Modal | Drawer chi tiết bên phải · drawer cảnh báo · modal md/lg/xl (icon, footerStart, form) |

Xem trực quan và các biến thể tại `/playground` (mục 1–9, đặt cạnh ảnh tham chiếu; mục 8 = cảnh 3D: chọn cảnh, "Mô phỏng sự cố", "Chế độ sửa", id đã chọn; mục 9 = component Editor: NumberField, Vec3Field, TreeView, Checkbox có nhãn, icon).

## 5. Roadmap
- ✅ GĐ0 Tokens · GĐ1 Primitives · GĐ2 Form & điều hướng · GĐ3 Layout + router · GĐ4A Nghiệp vụ · GĐ4B Chart & bảng.
- ✅ 5A `/overview`: KPI, PlantMap, 4 chart, sidebar.
- ✅ 5B `/alerts`: thẻ ưu tiên, KPI, Tabs, FilterBar, bảng, thao tác hàng loạt, drawer, xuất CSV.
- ✅ 5C `/maintenance`: KPI theo tháng, việc ưu tiên, bảng 7 tab + cờ Quá hạn, lịch sắp tới, drawer chuyển bước, modal tạo yêu cầu đầy đủ theo ảnh thiết kế (AI mock, checklist, tệp, lưu nháp), liên kết từ /alerts.
- 🔍 **fix/editor-ground-plane** (20/10/2026, chờ review): pivot tâm đáy cho mọi asset + `elevation` + `schemaVersion` 2 (migrate 2 cảnh mẫu); kéo object bằng pointer events trên `GROUND_PLANE` (chỉ X/Z), xoay chỉ Y, scale giữ đáy; Elevation/Đặt xuống sàn/Căn hàng; cảnh báo mặt sàn; vạch chân (G).
- ✅ **3D-1 Viewer** (đã duyệt + chỉnh vòng 2, 19/10/2026): SceneViewer đọc `SceneConfig` JSON v2, PlantMap `renderer="three"` + toggle 2.5D/3D, mock `khu-bon-lpg.json` + `useLiveData`.
- ✅ **3D-1b** (19/10/2026): asset có `paramsSchema` + `params`, ports/bounds theo params; validate zod; cảnh theo `sceneId` + cảnh mẫu 2 `tram-chiet-nap`; dev mode `?edit=1` (kéo/xoay, snap, Copy JSON).
- ✅ **3D-1c** (19/10/2026): PlantMap thuần (`scene` prop) + `ConnectedPlantMap`; `SceneConfig.views[]` + `objects[].marker` (nhãn tự sinh), bỏ presets; bỏ chọn khi click vùng trống + hint.
- ✅ **3D-2** (19/10/2026, đã duyệt): tinh chỉnh theo ảnh Figma, không đổi SceneConfig/API: ánh sáng + ACES + vignette; vật liệu "clay" + nét viền mực + chi tiết asset; ống lõi sáng + vỏ trong mờ + vòng khớp + Bloom; Outline hover/chọn, danger chỉ viền; preset quality auto + fallback 2.5D khi WebGL lỗi.
- 🔍 **3D-3 Scene Editor** (20/10/2026, chờ review): `/editor` – thư viện asset (bấm/kéo thả), canvas dùng chung SceneViewer + Q W E R/snap/lưới/khung vừa, Properties (id/nhãn/transform/params/bindings + ngưỡng/nhãn bản đồ/đường bao hàng rào/thuộc tính cảnh), Outliner (chọn nhiều, ẩn, khoá, đổi id), chọn vùng, nhân bản/copy/dán/xoá, undo/redo (zundo), views, kiểm tra hợp lệ, SceneRepository (localStorage) + autosave nháp + chặn rời trang; Viewer `?scene=`.
- ⏳ Tiếp: **3D-4** vẽ ống (pipes + object gắn ống) · backend SceneRepository · trang `/map`, `/reports`.
- Test ground-plane (scratchpad `e2e/`, phiên d1bdb515… – Linux, playwright-core cài trong scratchpad + Brave `/usr/bin/brave-browser`): `diagnose.mjs` (hộp bao three từng asset: min.y = 0 cả 12 loại), `compare.mjs` 10/10 (2 cảnh mẫu trước/sau migrate: vị trí 31 object + 23 ống khớp; chỉ khác chân thang hết lún), `ground.mjs` 54/54 (kéo ở polar 0.4/0.8/1.2/1.45 + xoay camera giữa lúc kéo → y = elevation; |dot| < 0.05 bỏ frame; Alt tắt snap; Esc huỷ; thả 8 loại asset đáy y = 0; kéo nhóm 3 loại khác elevation; undo/redo; scale giữ đáy; gizmo xoay chỉ Y; Elevation/Đặt xuống sàn/cảnh báo/căn hàng; G; export→import; import v1 migrate), `overview.mjs` 3/3 (`?map=3d` + sửa nhanh `?edit=1`), `floorcolor.mjs` (mesh sàn mới không đổi màu, ±1/255).
- Test 3D-3 (scratchpad `e2e/`, phiên 8abaf5c7…): `editor.mjs` 54/54 (quyền vào, thêm bằng click/kéo thả, undo/redo, Ctrl+D/C/V, Delete, Q W E R + không chạy khi gõ, properties/params/góc/binding/nhãn, đổi id F2 + lỗi trùng, ẩn/khoá, Shift+kéo chọn vùng, kéo gizmo nhóm = 1 bước undo, sửa object không kéo camera, views, cảnh báo ngoài sàn, lưu v1→v2, autosave + khôi phục, chặn rời trang, export, import lỗi zod/cú pháp, mở cảnh mẫu → Lưu thành bản mới, Viewer `?scene=`); `rebuild.mjs` (dựng lại khu-bon-lpg chỉ bằng UI, 154 thao tác → export so mock: 12/12 object không gắn ống khớp hoàn toàn, id/tên/camera/ngưỡng/views khớp; khác: version, 8 ống + 3 object gắn ống – thuộc 3D-4); `build2.mjs` 7/7 (cảnh `kho-3-bon`: 3 bồn + 2 cụm bơm, nhân bản nhóm, mở ở Viewer); `pg-editor.mjs` (playground mục 9).
- Test cuối 3D-2 (scratchpad `e2e/`, phiên 8abaf5c7…): `scene3d.mjs` 27/27, `scene-edit.mjs` 41/41 (3D-2: neo nhãn V-101 dời lên cửa người chui → công thức gốc gizmo trong test đã cập nhật), `overview.mjs`, `tooltip.mjs`, `nogl.mjs` (tắt WebGL → về 2.5D + thông báo; playground báo trong khung), `fps.mjs`/`calls.mjs` (FPS/draw call ở 2560×1440), `shot.mjs`/`hover.mjs` (ảnh so Figma). Phiên 56174141…: `/maintenance` 80/80, `/alerts` 44/44. `nav.mjs`/`layout.mjs` (17/10) đã cũ: lỗi strict-mode do playground/maintenance có 2 nav/aria-current.

## 6. Kiến trúc 3D (quyết định)
- **Hợp đồng dữ liệu** (`src/features/scene/types.ts`, không phụ thuộc three; đơn vị m, Y lên, mặt đất y = 0):
  ```ts
  type Vec3 = [number, number, number];
  interface SceneConfig { id: string; name: string; version: number /* số lần lưu */; schemaVersion: 2 /* định dạng; thiếu = 1 → migrateScene */;
    camera?: SceneCamera;                                      // camera mặc định ("Toàn cảnh")
    views?: SceneView[];                                       // trống → chỉ "Toàn cảnh"
    thresholds?: Record<string, Thresholds>;                   // ngưỡng mặc định theo trường (level, pressure…)
    objects: SceneObject[]; pipes: Pipe[] }
  interface SceneCamera { position: Vec3; zoom: number; target: Vec3 }   // zoom = px/m ở khung rộng 1146px, tự co theo bề rộng
  interface SceneView { id: string; label: string; objectIds?: string[]; camera?: SceneCamera }   // một trong hai; không có → camera mặc định
  interface SceneObject { id: string; asset: AssetType;
    params?: Record<string, number>;        // theo paramsSchema của asset (thiếu → mặc định)
    position?: Vec3;                        // bắt buộc trừ khi có attach; position[1] luôn = elevation
    elevation?: number;                     // độ cao đáy so với sàn (m), mặc định 0; bỏ qua khi attach
    rotation?: Vec3 /* Euler XYZ rad */; scale?: Vec3;
    attach?: { pipe: string; t: number };   // gắn lên ống tại tỉ lệ chiều dài t (0..1), trục X theo hướng ống
    path?: Vec3[];                          // asset theo đoạn (fence): polyline cục bộ, điểm cuối = đầu → khép kín
    label?: string;
    marker?: { variant?: 'callout' | 'side' | 'tag'; tone?: 'accent' | 'success' | 'warning'; title?: string; field?: string };
    bindings?: Record<string, Binding> }    // chỉ equipment
  type Binding = string | ({ tag: string } & Thresholds);   // "LT-101" hoặc { tag: "PT-201", warn: 5, danger: 6 }
  interface Thresholds { warn?: number; danger?: number; lowWarn?: number; lowDanger?: number }
  interface Pipe { id: string; from?: string; to?: string /* "objectId.port" – nối vào đầu/cuối points */;
    points: Vec3[] /* điểm gấp, toạ độ thế giới */; radius?: number /* mặc định 0.18 */; flowTag?: string }
  type AssetType = (typeof ASSET_TYPES)[number];
    // equipment: tank-horizontal, tank-vertical, pump, valve, filter, vaporizer, tanker-truck, loading-station, flow-meter
    // environment: building, canopy, fence
  type LiveData = Record<string, number | string>;   // theo tag
  ```
- **Quy ước pivot + độ cao** (fix/editor-ground-plane):
  - Mọi asset có gốc tại **tâm đáy**, y = 0 cục bộ là mặt sàn, hình học không xuống dưới 0 (`bounds.min[1] = 0`). Asset lệch → bọc geometry trong `<group position-y>` dịch lên cho min.y = 0 (van/đồng hồ: `VALVE_AXIS` 0.27 / `FLOW_METER_AXIS` 0.4 = `spec.inline.axisY`; cổng + bounds dời theo).
  - `SceneObject.elevation?` (m, mặc định 0) = độ cao đáy; `position[1]` luôn bằng nó (zod báo lỗi nếu lệch). Object gắn ống: đáy = tâm ống − `inline.axisY` (tính trong `resolveScene`).
  - `SceneConfig.schemaVersion` (định dạng, hiện = `SCENE_SCHEMA_VERSION` 2) khác `version` (số lần lưu). `migrateScene` (`migrate.ts`, thuần) chạy trước zod ở mọi đường nạp (parse, Import, nháp): v1 → v2 = position[1] → elevation, van/đồng hồ đứng riêng hạ `axisY` (giữ nguyên hình), version + 1.
- **Category** (`ASSET_SPECS[type].category`): `equipment` = hover/click/bindings/trạng thái; `environment` (nhà xưởng, mái che, hàng rào) = chỉ bối cảnh: không có handler (nên không chặn tia chọn thiết bị bên dưới), `parse` báo lỗi nếu có bindings, marker neo vào nó không click được.
- **Asset = spec thuần + component**:
  - `assets/specs.ts` (không three/React – dùng được ở parse/Editor): `{ label, category, idPrefix (quy ước id Editor), paramsSchema: Record<name, { label, default, min?, max?, unit?, integer? }>, dataFields, layout(params, obj) → { ports, bounds, labelAnchor? } }`. `resolveParams(obj)` gộp mặc định; `assetLayout(obj)` → cổng/hộp bao theo params.
  - Spec `inline?: { axisY }` (van 0.27, đồng hồ 0.4): asset lắp trên ống – trục ống cao axisY trên đáy, được phép elevation > 0.
  - Tham số hiện có: tank-horizontal `length, diameter` · tank-vertical `height, diameter` · building `width, depth, height, floors` · canopy `length, depth, height, bays` · fence `height, postSpacing` · vaporizer `plates`; asset khác chưa có tham số.
  - `assets/registry.ts`: `ASSETS[type] = spec + component` (component nhận `{ params, path }`). Vật liệu dùng chung theo (offline × hover), tối đa 4 bộ (`MaterialsProvider`, xem mục Vật liệu), dispose khi unmount.
  - Thêm asset = tên vào `ASSET_TYPES` (types.ts) + spec + component.
- **Validate** (`parse.ts`, zod, chỉ import động trong `fetchScene`): `migrateScene` trước, rồi cấu trúc strict (`schemaVersion` phải = 2, `position[1]` = `elevation`) (trường lạ = lỗi) + kiểm tra tham chiếu: asset không tồn tại (liệt kê loại có), id object/ống trùng, thiếu position/attach, attach tới ống không có, pipe `from/to` tới object không có hoặc cổng không có (liệt kê cổng của asset theo params), params sai tên/ngoài min–max/không nguyên, bindings trên environment, fence thiếu path, `marker.field` không có binding, view trỏ object không có / id view trùng / dùng cả objectIds lẫn camera. Kiểm tra tham chiếu chỉ chạy khi cấu trúc đã hợp lệ. Ném `SceneConfigError` liệt kê mọi lỗi "đường dẫn: thông báo"; `ConnectedPlantMap` hiện Card danger + "Thử lại" (+ "Về bản đồ 2.5D").
- **Nạp cảnh** (`data/scene.ts`): `import.meta.glob('../mocks/scenes/*.json')` → mỗi cảnh một chunk; `fetchScene(sceneId)` (id lạ → lỗi liệt kê cảnh có) → `parseSceneConfig`; `useSceneConfig(sceneId)` theo mẫu QueryState. Khi có API: thay thân `fetchScene` bằng `fetch('/api/scenes/:id')`.
- **Tách thuần / nối dữ liệu**: PlantMap (components) không import data – nhận `scene` đã nạp. `ConnectedPlantMap` (src/app) = `useSceneConfig(sceneId)` + 3 trạng thái (Placeholder · Card danger · PlantMap), dùng ở Tổng quan (`SCENE_ID` trong trang) và playground. `useOverviewData().map` chỉ phục vụ ảnh 2.5D; 3D lấy số liệu từ `useLiveData`.
- **Chế độ sửa của SceneViewer** (`edit: SceneEditState`, `EditTools.tsx`) – dùng bởi Editor `/editor` (đầy đủ) và PlantMap `editable` (sửa nhanh 1 object, Tổng quan `?edit=1`, playground "Chế độ sửa"):
  - `SceneEditState = { selected: string[]; mode: 'select'|'translate'|'rotate'|'scale'; snap?; grid?; hidden?; locked?; floor?; onSelect(ids, 'replace'|'toggle'|'add'); onTransform(changes[]); onDropAsset?(asset, at) }`.
  - **Mặt sàn**: `GROUND_PLANE = Plane((0,1,0), 0)`; mọi điểm kéo/thả = `groundHit(ray)` (`ray.intersectPlane`), null khi |dot(tia, pháp tuyến)| < 0.05 (`GROUND_GRAZING_DOT`), không cắt sàn, hoặc ngoài ±120 m (`GROUND_WORK_LIMIT`) → bỏ frame. Mesh sàn (màu `scene-ground`, bù tone mapping như nền), lớp bóng, vùng sáng, lưới chỉ để nhìn (`raycast` null).
  - **Di chuyển (W)** = pointer events tự viết (`startGroundDrag`, gọi từ `onPointerDownCapture` của SceneViewer), không TransformControls: nắm object (không phím bổ trợ) → offset = giao điểm sàn − X/Z; di chuột → X/Z = giao điểm − offset, snap 0.5 m (giữ Alt = tắt), **y giữ = elevation**; nhóm dời cùng một delta (object được nắm bám lưới); chỉ bắt đầu khi chuột đi > 3 px; OrbitControls tắt (`controls.enabled`) trong lúc kéo; thả → `onTransform` 1 lần; Esc huỷ. Không chặn sự kiện nên R3F vẫn ghi pointerdown cho click. Vòng + chữ thập trên sàn ở tâm nhóm (`MoveHandle`).
  - Click object = replace, Ctrl/⌘/Shift+click = toggle; **Shift+kéo** trên canvas = chọn vùng (chặn OrbitControls/R3F ở capture; hộp bao chiếu lên màn hình giao hình chữ nhật), Shift+click không kéo = toggle bằng tia. Bỏ qua object ẩn/khoá; object khoá không hover/click trên canvas.
  - Gizmo `EditGizmo` (chỉ xoay/scale): TransformControls gắn **pivot** (1 object: tại object; nhóm: trọng tâm đã snap). Xoay chỉ quanh Y (15°); scale (0.1) quanh gốc = tâm đáy nên đáy giữ tại elevation, nhóm giãn khoảng cách X/Z (y từng object giữ nguyên). Thả chuột → `onTransform` 1 lần. Bỏ qua object `attach`/khoá/ẩn. `applyTransforms` luôn lấy lại position[1] từ elevation.
  - Thả asset (HTML5 DnD, `SCENE_ASSET_MIME`) → `groundHit` + snap (Alt = tắt) → `onDropAsset`, y = 0. `grid: false` ẩn lưới + vạch chân; `floor` vẽ viền nét đứt vùng sàn ±60 m (`FLOOR_HALF_SIZE`).
  - Vạch chân (`SelectionFootprints`, bật cùng lưới – phím G): đáy hộp bao chiếu xuống sàn (nét đứt), đường đứng đáy → sàn khi elevation ≠ 0, nhãn "đáy ±x m" (đỏ khi lún; `data-ground-gap`).
  - Handle thêm: `fit(ids?)` (trống = mọi object), `getCamera()` (SceneCamera, zoom quy về 1146px), `pickGround(x?, y?)` (trống = tâm khung), `toScreen(p)`.
  - Camera rig chỉ bay khi đổi view / kích thước / camera cảnh / id cảnh (`frameKey`) – sửa object KHÔNG kéo camera về khung cũ. Cảnh không có `camera` → "Toàn cảnh" = khung vừa mọi object (Editor tạo cảnh mới không đặt camera).
- **Chế độ sửa nhanh của PlantMap** (`PlantMap editable`):
  - Bản nháp `SceneConfig` trong PlantMapThree (khởi tạo lại khi đổi `scene`); chọn 1 object (kể cả environment, nhãn).
  - Bỏ chọn: Esc, hoặc click vùng trống (`onPointerMissed`) – bỏ qua nếu gizmo đang kéo/vừa thả < 300 ms (`dragging-changed` → ref), nếu chuột đã di chuyển > 4px từ pointerdown (xoay/pan camera), hoặc nếu đích click không phải canvas (R3F nghe ở div bọc canvas nên click lên nhãn HTML cũng tới đây). Hint nhỏ góc dưới phải.
  - Object chỉ nhận click có đích là canvas (click lên nhãn không chọn nhầm object nằm sau nhãn).
  - Dùng chung cơ chế của SceneViewer: Di chuyển = kéo trên sàn (giữ elevation, snap 0.5 m); Xoay = gizmo quanh Y, snap 15°. Thả chuột → cập nhật nháp → ống nối cổng tự đi theo.
  - Object `attach` không kéo được (báo trên thanh sửa). "Copy JSON" = `JSON.stringify(nháp, null, 2)` (làm tròn 3 số lẻ vị trí, 4 số lẻ góc; bỏ rotation toàn 0). Chưa lưu, chưa thêm/xoá object.
- **Hàng rào** dựng theo đoạn từ `path`: cọc (cách ≤ postSpacing + mỗi đỉnh), 3 thanh ngang mỗi đoạn và song đứng mảnh đều instanced (3 draw call mỗi hàng rào).
- **Gắn ống** (`resolveScene` trong `geometry.ts`): đặt object thường → dựng đường cong ống (cổng from/to) → đặt object `attach` bằng `curve.getPointAt(t)` + hướng tiếp tuyến. Dùng cho FT-101 và van XV-101/102. TubeGeometry dùng chung đường cong đó.
- **Trạng thái** (`fields.ts`): ngưỡng KHÔNG hardcode, ưu tiên binding > `config.thresholds[field]`; `FIELD_META` chỉ giữ nhãn/đơn vị/số lẻ và nghĩa chuỗi state (fault → danger, offline…). Object lấy trạng thái xấu nhất của các binding; thiếu toàn bộ tag → offline.
- **Hiển thị trạng thái** (KHÔNG tô cả khối): nét viền mực của object đổi tone – hover `primary` (+ emissive primary 0.14), chọn `primary` đậm hơn, warning `warning`, danger `danger-strong` HDR **pulse chậm** (2.4 s, `pulse.ts`, đồng pha với vòng sáng sàn) + vòng sáng đỏ mờ dưới sàn (texture độ sáng × `danger-strong`, blending cộng) + ⚠ ở nhãn; frameloop `always` khi có danger. Offline → vật liệu tối 55%, nét nhạt, nhãn tone `neutral`. Preset có postprocessing thêm **Outline** (`PostEffects`): hover `primary` (edgeStrength 4, blur), chọn `primary` (9, xRay) + hộp bao; mỗi Outline một `selectionLayer` riêng (11/12). Danger không dùng Outline (luôn có selection → thêm depth pass mỗi frame).
- **Nhãn 3D tự sinh** (`markers.ts` → `objectMarker`): object có `marker` → `MapMarker` trong drei `<Html>` ở `labelAnchor`. Tiêu đề = `marker.title ?? label ?? id`; giá trị = trường `marker.field` (mặc định binding đầu tiên) từ liveData (tag → "—" khi chưa có số liệu). Tone khai báo khi bình thường (success kèm chấm); warning/danger/offline ghi đè tone + ⚠. Không có `marker` → không nhãn, hover → tooltip số liệu. 3D không còn nhãn đặt theo % (chỉ renderer ảnh).
- **PlantMap API**: ảnh = `image, markers, views (focus), view, onViewChange`; 3D = `scene, liveData, editable` – view (`scene.views`) quản lý nội bộ: `objectIds` → bay vừa khít (tối đa 2× toàn cảnh), `camera` → bay tới camera cố định. Chung: `onSelect(id)` (ảnh: id marker · 3D: id object), `onRendererChange`. Zoom ±1.3×, giới hạn 0.6–4× toàn cảnh, phím `+`/`-`/`0`.
- **Camera**: Orthographic, azimuth ~42°, cao ~30° (khớp ảnh Figma); OrbitControls polar 0.35–1.2 rad, damping, zoomToCursor; bay bằng lerp mũ (rate 5, damp) giữa các view.
- **Look** (`look.ts`, một chỗ để chỉnh; màu vẫn từ token):
  - Renderer: ACESFilmic + sRGB, `SCENE_EXPOSURE` = 0.78 (`?exposure=` ở dev). Có composer → `ToneMapping` effect mode 6 (ACES; mặc định của effect là AgX) cùng exposure; nền khi đó = `inverseToneMap(scene-ground)` để sau ACES vẫn đúng token (chỉ khi composer đã mount – `onActive`).
  - Ánh sáng: hemisphere 1.3 (trời `text-primary`, đất `bg-header` → vùng khuất ngả xanh) + key trắng trung tính 2.1 hướng (0.42, 0.82, 0.38) – trên cao phía camera, bóng rơi ra sau vật như Figma. Shadow PCF (`shadows="percentage"`) radius 4, bias −0.0005, normalBias 0.02, vùng ±55 m; **shadow map tĩnh** (`ShadowUpdates`: autoUpdate off, cập nhật khi cảnh/preset đổi; chế độ sửa cập nhật liên tục). Mái che `userData.noCastShadow` (Figma vẽ thiết bị dưới mái vẫn sáng).
  - Sàn: shadowMaterial (màu `bg-header`, opacity 0.5) + vùng sáng giữa sàn (texture falloff × `scene-grid`, additive 0.22) + drei Grid; vignette CSS `.scene-vignette` (global.css, `scene-ground` /0.38–0.62 ở rìa).
  - Số đo đạt (pixel, so Figma 53:244): thân bồn #A7B0B7 (Figma #9D9EA4–#A8AAB2), bồn xe #AEB6BC (#B4B4BA), sàn giữa #0C1827 (#0A1827), rìa #0A1523 (#081323).
- **Vật liệu** (`materials.tsx`, dùng chung theo offline × hover, ≤ 4 bộ; MeshStandard + polygonOffset để nét viền không z-fight): `body` asset 1.0 rough 0.86 · `concrete` 0.7 rough 0.96 · `metal` neutral 0.86 rough 0.5 metal 0.22 · `shiny` (thân bồn xe) 1.04 rough 0.32 metal 0.28 · `cab` (cabin/tủ, tối hơn) 0.76 · `dark` surface-muted · `rubber` (lốp) line · `glass` line rough 0.22 · `glow` emissive `scene-flow` 1.6 (vòng sáng van/FT, đèn trạm nạp). Không dùng env map (metalness thấp).
- **Nét viền mực** (Figma vẽ kiểu minh hoạ): `useInkEdges` gộp EdgesGeometry (≥ 32°) của mọi mesh thường trong object thành **1 LineSegments/object** (bỏ InstancedMesh, `userData.noEdges`); vật liệu nét dùng chung theo tone (`bg-header` opacity 0.55; hover/chọn/danger nhân HDR để bloom bắt). Không raycast. Mesh phụ trợ (vòng sáng sàn) `userData = { noEdges, noShadow }`.
- **Chi tiết asset** (`assets/parts.tsx`: `Railing`, `Ladder` (có lồng), `Flange`, `Nozzle`, `ReliefValve`, `GlowRing`; phần lặp instanced): V-101 – mối hàn vòng, tấm đệm + yên thép trên bệ bê tông, cửa người chui + tay đòn, 2 van an toàn, ống đo mức, biển tên, sàn thao tác + lan can + thang lồng (`tankHorizontalPlatform` trong specs; bounds/labelAnchor theo đó – chấm nhãn trên cửa người chui). Bồn đứng: sàn vành khăn + lan can + thang lồng. Xe bồn: cabin `cab` (kính, lưới, cản, gương, bậc), sắt-xi, lốp + mâm instanced, chắn bùn, bồn `shiny` + đai, lối đi + lan can, thang sau. Hàng rào: cọc + 3 thanh + song đứng mảnh (3 draw call). Mái che: cột có bản đế, úp nóc, máng xối. Nhà xưởng: tường chắn mái, bậu cửa sổ, khung/mái hắt cửa, ống thoát nước, thiết bị mái. Bơm: bích, chụp khớp nối, gân động cơ. Lọc/hoá hơi: bích, tay đòn, lan can, thang.
- **Token màu** (nhóm `scene-*` trong một block của tokens.css): lệch < 5% (khoảng cách RGB) so với token sẵn có thì alias (`scene-ground` = bg-app, `scene-grid` = line, `scene-asset` = neutral); chỉ `scene-flow` #94D9C4 là màu mới (gần nhất lệch 9.9%, primary/success > 20%). 3D-2 không thêm màu mới: dùng thêm `text-primary` (trời), `bg-header` (đất/bóng/nét viền), `primary` (hover/chọn); key light trắng trung tính (không nhuộm).
- **Ống**: Catmull-Rom tension 0.1 + chèn điểm sát góc (bo 2.5×r); **lõi** (0.6r, `scene-flow` emissive + emissiveMap vệt sáng chạy theo `flowTag`, 200 m³/h = 1.6 m/s; cường độ 1.35 khi chảy / 0.7) + **vỏ** trong mờ (r, opacity 0.55, emissive 0.18) + **vòng sáng khớp nối** instanced ở 2 đầu mỗi cung bo và 2 đầu ống (emissive 1.1). Không bloom (preset low) → thêm ống quầng additive 2r.
- **Bloom** (`PostEffects`): mipmapBlur, ngưỡng 0.55 (mặt sáng nhất của bồn ~0.46 tuyến tính → không loá), smoothing 0.1, intensity 1.1, radius 0.8.
- **Preset chất lượng** (`quality.ts`; prop `quality` của SceneViewer/PlantMap, Tổng quan `?quality=`; root có `data-scene-quality`):

  | | high | medium | low |
  |---|---|---|---|
  | Bóng đổ | 2048 | 2048 (tĩnh nên không tốn mỗi frame; 1024 + blur gây lấm tấm) | tắt |
  | Postprocessing (Bloom + Outline + ToneMapping) | có; buffer HalfFloat, MSAA ×4, bloom 8 mức | có; buffer 8 bit, không MSAA/SMAA, bloom 5 mức | không (tone mapping renderer, quầng ống giả, hover = nét mực) |
  | dpr | [1, 1.5] | [1, 1.25] | 1 |

  - `'auto'` (mặc định): bắt đầu high; drei `PerformanceMonitor` bounds [48, 58] FPS hạ/nâng một bậc; dao động 3 lần → chốt mức thấp hơn (high→medium).
  - FPS ở 2560×1440 (canvas 2134×587, Intel Iris Xe, không vsync; máy đo nhiễu ±20%): trước 3D-2 ~114 · high ~36 · **medium ~62** · low ~77 · auto → chốt medium ~60. Draw call/frame (low): 67 → 39 sau khi gộp nét viền.
- **Dự phòng WebGL**: SceneViewer kiểm tra WebGL trước (`isWebGLAvailable`), bọc Canvas bằng ErrorBoundary, nghe `webglcontextlost` → `onWebGLError(lý do)`. PlantMap `onFallback`: Tổng quan chuyển về 2.5D (bỏ `?map`) + `notice` cạnh nút 2.5D/3D; bấm 3D lại thì thử lại. Không truyền `onFallback` (playground) → thông báo ngay trong khung.
- **Hiệu năng**: SceneViewer lazy (three/drei ở chunk ~254KB gzip; postprocessing ở chunk `PostEffects` ~80KB gzip, chỉ tải khi preset bật; zod ở chunk `parse` ~15KB gzip; barrel `@/features/scene` không kéo three/zod/postprocessing), `frameloop` = always khi có ống chảy hoặc danger, ngược lại demand; instancing cho hàng rào (cọc/thanh/song), lan can, bậc/lồng thang, gân động cơ, lá trao đổi nhiệt, cửa sổ + bậu, bánh xe + mâm, vòng khớp ống; nét viền gộp 1 draw call/object.
- **Bước tiếp theo**: 3D-4 vẽ ống trong Editor (ports của `ASSET_SPECS` để nối, điểm gấp snap, object gắn ống `attach`).

## 6b. Scene Editor `/editor` (3D-3)
- **Nguyên tắc**: Editor và Viewer dùng chung `SceneConfig`; canvas là SceneViewer (lazy) nhận cảnh từ store – không tự nạp dữ liệu; Editor chỉ giữ thêm state UI ngoài cảnh. Không đổi hợp đồng dữ liệu.
- **Quyền vào**: `canUseEditor(search)` (`app/editorAccess.ts`) = `VITE_SCENE_EDITOR === 'true'` hoặc `?edit=1`; không có → `/overview`. TODO: phân quyền thật theo vai trò khi có backend.
- **Bố cục** (`AppLayout variant="workspace"`): thanh tệp (Cảnh mới · Mở… · Lưu · Lưu thành bản mới… · Import/Export JSON · Undo/Redo · "Xem ở Tổng quan") | trái 264px: Thư viện asset (nhóm Thiết bị/Bối cảnh, tìm theo tên/loại/tiền tố) + Cây object | giữa: canvas + thanh công cụ nổi + thanh trạng thái (tên, id, version, Đã lưu/Chưa lưu, số object, số đang chọn, lỗi/cảnh báo, nguồn) | phải 340px: Tabs Thuộc tính · Góc nhìn · Kiểm tra.
- **Store** (`features/scene-editor/store.ts`):
  - `useSceneDoc` (zustand + zundo `temporal`): chỉ `scene`, `partialize`, `equality` theo tham chiếu, `limit 200`. Mỗi thao tác = 1 `setScene` = 1 bước; kéo gizmo commit 1 lần khi thả; ô số/chữ chốt khi Enter/blur. `loadScene` (thay + xoá lịch sử), `setSceneSilently` (lưu/tăng version không ghi lịch sử).
  - `useEditorUi`: `selection, tool, snap, grid, hidden, locked, clipboard, source ('new'|'saved'|'sample'), saved, previewView`. **Chưa lưu** = `scene !== saved` (so tham chiếu → undo về đúng bản đã lưu là "Đã lưu").
- **Thao tác thuần** (`ops.ts`): `setElevation(ids, h)` (0 = Đặt xuống sàn), `alignObjects(ids, 'x'|'z')` (mốc = object chọn đầu: cùng toạ độ trục kia + elevation; tâm cách đều giữa đầu–cuối, trùng toạ độ → cách bề rộng lớn nhất + 1 m), `cleanObject` đồng bộ position[1] = elevation và bỏ elevation 0; `nextObjectId` theo `ASSET_SPECS[asset].idPrefix` (equipment `V-101…` 3 chữ số từ 101, environment `FN-01…`, lấy số nhỏ nhất chưa dùng), `createObject` (tâm khung hoặc điểm thả, snap 0.5 m; hàng rào mặc định khung 6×4 khép kín), `removeObjects` (dọn view.objectIds, bỏ `from/to` của ống trỏ tới), `renameObject` (cập nhật view + `from/to "id.cổng"`; id `[A-Za-z0-9_-]+`), `cloneObjects` (nhân bản/dán: id mới, dời 1 m; gắn ống: t + 0.05), `applyTransforms`, `cleanObject` (bỏ rotation 0, scale 1, params/bindings rỗng), view (`addView/updateView/removeView`, id = slug tên), `normalizeScene` (thứ tự khoá như file mock – dùng khi lưu/xuất).
- **Properties**: 1 object – id (đổi kèm tham chiếu), nhãn, **vị trí trên sàn X/Z** (`Vec3Field only={[0,2]}`), **Elevation** (snap 0.25 m khi bật snap, gợi ý "Đáy cách sàn …"/lún/lơ lửng) + "Đặt xuống sàn", **góc xoay quanh Y** (độ; có nghiêng X/Z từ JSON → cảnh báo + "Bỏ nghiêng"), scale (object gắn ống: chọn ống + t), form tham số sinh từ `paramsSchema` (min/max/integer/unit, trống = mặc định), đường bao hàng rào (điểm X/Z, khép kín), bindings theo `dataFields` (Combobox tag từ `SENSOR_TAGS` + "Ngưỡng riêng" 4 ô), nhãn bản đồ (kiểu, tone, tiêu đề, trường giá trị); nhiều object – tóm tắt + "Căn chỉnh" (Căn hàng theo X/Z, Elevation cả nhóm, Đặt xuống sàn) + nhân bản/xoá; không chọn – thuộc tính cảnh (id, tên, version, camera mặc định: lấy góc nhìn hiện tại hoặc nhập số / bỏ = tự khung vừa, ngưỡng theo trường).
- **Outliner** (`TreeView`): nhóm Thiết bị/Bối cảnh; Ctrl/⌘ đảo, Shift chọn dải; nút ẩn (không vẽ, không chọn trên canvas) và khoá (không chọn/kéo trên canvas) – state UI, không lưu vào cảnh; F2/double-click đổi id.
- **Góc nhìn**: "Lưu góc nhìn hiện tại thành view" (đặt tên → camera), sửa tên + id, Xem (bay thử), "Gán object đang chọn" (→ objectIds, bỏ camera), "Gán góc nhìn hiện tại" (→ camera, bỏ objectIds), xoá.
- **Kiểm tra** (`validate.ts`, không chặn lưu nháp): lỗi = mọi issue của schema zod dùng chung (`validateSceneConfig` trong `parse.ts`: id trùng, asset không tồn tại, cổng/ống, params…); cảnh báo = binding trỏ tag không có trong `SENSOR_TAGS`, object nằm ngoài vùng sàn ±60 m, **mặt sàn** (`ground.ts`, hộp bao spec sau xoay + scale): lún dưới sàn (đáy < 0), đáy ≠ elevation (xoay X/Z, scale âm), lơ lửng (elevation > 0 mà asset không `inline`). Bấm dòng → chọn + bay tới object.
- **Lưu trữ** (`data/sceneRepository.ts`): `interface SceneRepository { list(); load(id); has(id); save(scene); remove(id) }`, bản `LocalStorageRepository` (key `demo-lpg:scene:<id>` + chỉ mục `demo-lpg:scenes`; `load` qua zod). Khi có API: viết bản HTTP cùng interface, đổi `sceneRepository`. `fetchScene` (Viewer) tìm cảnh mẫu trước rồi tới kho → `/overview?scene=<id>` mở cảnh lưu từ Editor.
  - Lưu: version = bản trong kho + 1 (chưa có = 1); cảnh mẫu (chỉ đọc) hoặc id trùng mẫu → hộp "Lưu thành bản mới" (id `[a-z0-9-]+`, báo ghi đè nếu id đã có). Lưu xong ghi `?scene=` (giữ `?edit=1`), xoá nháp.
  - Import JSON: `JSON.parse` + `validateSceneConfig` – lỗi → hộp liệt kê "đường dẫn: thông báo", cảnh hiện tại giữ nguyên; hợp lệ → mở như cảnh chưa lưu. Export JSON: `normalizeScene` → tải `<id>.json`.
  - Tự lưu nháp mỗi 3 s (`draft.ts`, key riêng `demo-lpg:editor-draft`) khi có thay đổi; mở lại `/editor` → hỏi Khôi phục / Bỏ bản nháp. Rời trang khi chưa lưu: `beforeunload` + `useBlocker` (hộp "Rời Scene Editor?").
- **Phím tắt** (không chạy khi focus ở input/textarea/select/contenteditable hoặc đang có hộp thoại; riêng Ctrl+S chạy cả trong ô nhập – blur ô để chốt rồi lưu):

  | Phím | Thao tác |
  |---|---|
  | Q / W / E / R | Chọn / Di chuyển trên sàn (kéo object, Alt = tắt snap, Esc = huỷ) / Xoay quanh Y / Scale |
  | Ctrl+Z · Ctrl+Shift+Z (Ctrl+Y) | Hoàn tác · Làm lại |
  | Ctrl+D · Ctrl+C · Ctrl+V | Nhân bản · Copy (+ clipboard hệ thống dạng JSON) · Dán (dời 1 m mỗi lần) |
  | Delete / Backspace | Xoá đang chọn |
  | Ctrl+A · Esc | Chọn tất cả (trừ ẩn/khoá) · Bỏ chọn |
  | F · G · Ctrl+S | Khung hình vừa (đang chọn, trống = tất cả) · Bật/tắt lưới + vạch chân/khoảng cách đáy · Lưu |
  | Chuột | Click chọn · Ctrl+click đảo · Shift+kéo chọn vùng · (W) kéo object = dời trên sàn · kéo trái vùng trống xoay · kéo phải dời khung · cuộn zoom · kéo asset từ thư viện vào canvas |
- **Test hook (dev)**: `window.__sceneEditor = { doc, ui, viewer }` (store + SceneViewerHandle), cùng `__sceneThree`/`__sceneR3f` của SceneViewer – không có ở bản build.

## 7. TODO / chờ designer
- Chưa có thiết kế (đang dựng theo token, cần designer): drawer chi tiết, thanh thao tác hàng loạt, form/modal (có ảnh nhưng chưa có node), checkbox checked, badge "Đã phân công"/"Chờ nghiệm thu", trang `/map` và `/reports`.
- **Cần xác nhận:**
  - ALT-00127 dùng GS-01 hay GS-04.
  - MT-00128/127: nội dung giữa thẻ và bảng khác nhau (đang theo thẻ).
  - Ý nghĩa "Chờ tiếp nhận" khi đã có người phụ trách.
  - Hàng chart Tổng quan để opacity 70% có cố ý không.
  - Figma kéo giãn ảnh bản đồ ~14%: có cố ý không.
- **Thay khi có asset:** TempIcons, chevron phân trang, icon ghim vị trí, bản active của icon nav Bản đồ/Vận hành/Báo cáo.
- **Kỹ thuật:**
  - "Góp ý từ AI" là mock (`suggestForRequest` trong `src/data/maintenance.ts`).
  - Tệp đính kèm chưa upload thật.
  - `plant-map.png` 7.5MB → nên chuyển WebP/AVIF.
  - Nối API thật cho `fetch*` trong `src/data/*`; `useLiveData` → WebSocket/SSE.
  - 3D: asset hiện là khối hình học đơn giản (thay bằng model glTF khi có); token màu 3D chưa phản ứng đổi theme (app chỉ có theme tối).
  - 3D-2 còn lệch Figma: ống mảnh hơn (bán kính dữ liệu 0.18 m, Figma ~0.3 m); Figma có giàn ống nhỏ song song, cụm bơm/lọc dày đặc hơn, nhà xưởng nhiều thiết bị mái hơn (nội dung cảnh – cần thêm object/pipe trong JSON); cabin xe Figma bo tròn, chi tiết hơn; chưa có AO (n8ao có sẵn theo postprocessing nhưng tốn); nền Figma có nét blueprint mờ góc trên trái; vật hơi xanh hơn Figma (b−r ≈ 10 so với 7, do token `neutral`); Figma không vẽ hover/chọn (đang dựng theo token).
  - Nhãn 3D chưa tự né đè (3 view hiện tại không đè); high ~36 FPS trên Iris Xe (auto tự hạ medium).
  - Chế độ sửa nhanh của PlantMap (`?edit=1` ở Tổng quan): vẫn chỉ Copy JSON – dùng `/editor` để sửa đầy đủ.
  - Editor (3D-3): chưa vẽ/sửa ống và object gắn ống (3D-4) – dựng lại khu-bon-lpg thiếu 8 ống + XV-101/FT-101/XV-102; xoá object chỉ bỏ `from/to` của ống trỏ tới (ống còn < 2 điểm → lỗi ở bảng Kiểm tra); ống không đi theo khi đang kéo (cập nhật lúc thả); hàng rào/điểm gấp ống không tự dời theo object.
  - Mặt sàn: 7 bơm/lọc trong 2 cảnh mẫu có elevation 0.3 (dữ liệu cũ y = 0.3 để khớp cổng ống) → bảng Kiểm tra cảnh báo "lơ lửng"; cần quyết định: thêm bệ (tham số/asset) hay hạ xuống sàn + dời điểm ống. Cảnh báo mặt sàn dùng hộp bao spec (đã chỉnh theo đo thật), không phải mesh. Kéo trên sàn chưa khoá trục (X hoặc Z) và chưa kéo được object gắn ống dọc ống.
  - Editor: chưa có backend (localStorage, 1 bản nháp chung); quyền vào bằng `?edit=1`/env (chưa phân quyền thật); danh sách tag = khoá của mock số liệu (`SENSOR_TAGS`, thay bằng GET /api/tags) và Combobox chỉ chọn tag có trong danh sách (tag lạ chỉ vào được qua Import, hiện cảnh báo); ẩn/khoá chỉ là state phiên, không lưu; Outliner chọn nhiều bằng Ctrl/Shift+click (chưa kéo chuột quét dòng); chưa có camera numeric cho view (chỉ "Gán góc nhìn hiện tại").
  - Bundle chính tăng ~15 KB gzip do chuyển sang data router (`createBrowserRouter`) để dùng `useBlocker`.

## 8. Log sai khác Figma đã chuẩn hóa
- Màu cảnh 3D (đọc pixel ảnh 53:244): #061123 → bg-app, #343C4C → line, #C1C0C8 → neutral (alias, lệch < 5%); `scene-flow` #94D9C4 là token mới.
- 3D-2: hướng sáng suy từ ảnh (mặt trên sáng nhất ~#B4B4BA, mặt đứng ~#9x, hốc ngả xanh, bóng gần như không thấy phía trước vật) → key trên cao phía camera + hemisphere mạnh; mái che không đổ bóng; nhãn 3D nền trong mờ (/85 + blur) thay vì đặc như Figma (yêu cầu 3D-2).
- Màu gần trùng gộp về token: `#DDE3E7`/`#DEE3E7`, `#BBC9CF`/`#BDC8D2`, `#FFBB43`/`#FFC247`, `#B9C8DE`→neutral, `#10B981`→success, `#E42427`→danger-strong, `#DAC419`→warning; viền đỏ KPI → `danger-strong/50`.
- Khoảng cách/cỡ chữ: padding/gap Tổng quan 30/31→32px; mô tả trang 14px; breadcrumb 15→14px; bo góc KPI compact 6→8px; tiêu đề card Lịch 20→16px; badge thẻ ưu tiên 14px→`Badge md`; viền thẻ ưu tiên đồng nhất (trái 3px + tone/30).
- Nội dung: "nghiệm"→"nghiêm"; "Giátrị"→"Giá trị"; Mã CB trống → ALT-00124; layer ẩn "Đang chạy" (opacity-0) bỏ; "Đang xử lý" (bảng bảo trì) → "Đang thực hiện"; MT-00128 quá hạn theo thẻ (−2 ngày); ngày Bảo trì tính tương đối (Figma: hôm nay = 15/10).
- Dữ liệu: KPI, số đếm và tab đều tính từ data (không dùng số tĩnh Figma); thanh tiêu thụ theo `max = 170`.
- Hành vi: ảnh bản đồ giữ đúng tỉ lệ (Figma giãn ~14%); hàng chart giữ opacity 70%; nút "Hôm nay" bên Bảo trì mặc định "Tất cả thời gian"; Tabs Cảnh báo thêm chip đếm + phân trang; bộ lọc Cảnh báo = Mức độ/Khu vực/Thiết bị/Thời gian.
- Form bảo trì: mức ưu tiên 3 nút (Thường = medium); thêm * cho Thiết bị và Hạn; tổng quan ghi "Nghiêm trọng" thay "Critical"; loại trong form dùng nhãn đầy đủ (bảng dùng nhãn ngắn).
