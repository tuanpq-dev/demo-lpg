# Test và chất lượng

Lệnh test, nơi đặt test, thêm test cho hàm mới, kiểm tra accessibility.

Tách nguyên văn từ `GUIDE.md` (28/10/2026) – số mục giữ như cũ (4m, 7b…) để tham chiếu cũ vẫn tìm được. Mục lục: [GUIDE.md](../../GUIDE.md).

## 7b. Test và chất lượng

**Lệnh**

| Lệnh | Làm gì |
|---|---|
| `npm test` | vitest chế độ watch (chạy lại khi sửa file) |
| `npm run test:run` | chạy hết test một lần (CI, trước khi commit) |
| `npm run test:coverage` | test + coverage cho thư mục logic (`src/features`, `src/data`, `src/lib`, `src/app/useTableFilters.ts`; báo cáo HTML ở `coverage/`) |
| `npm run lint` | ESLint 9: TypeScript + react-hooks + jsx-a11y (`eslint.config.js`) |
| `npm run typecheck` | `tsc -b --noEmit` (kể cả file test) |
| `npm run build` | typecheck + build production |

**Nơi đặt và đặt tên**
- Test nằm cạnh module: `src/lib/plantTime.ts` → `src/lib/plantTime.test.ts`; component → `src/components/Tabs/Tabs.test.tsx`.
- `*.test.ts` = test thuần, chạy môi trường node (nhanh). `*.test.tsx` cần DOM thì dòng đầu file ghi `// @vitest-environment jsdom`.
- Cấu hình: `vitest.config.ts` (gộp `vite.config.ts` nên alias `@/` dùng được); `src/test/setup.ts` nạp matcher jest-dom, dọn DOM, polyfill `matchMedia`/`ResizeObserver`/`scrollIntoView`.
- Tên test viết tiếng Việt, mô tả hành vi: `test('hạn = hôm nay → chưa quá hạn', …)`.

**Thêm test cho hàm mới**
1. Hàm logic viết **thuần**: nhận mọi thứ thay đổi theo thời gian/môi trường qua tham số (vd `now: Date`, `now: number`), không gọi `Date.now()`/`new Date()`/`localStorage` bên trong.
2. Tạo `<file>.test.ts` cạnh nó; có ca thường + ca biên (0, rỗng, âm, vượt giới hạn, ranh giới ngày/múi giờ, chạy lại hai lần…).
3. Hook: `renderHook` của Testing Library (cần router thì bọc `MemoryRouter`, xem `src/app/useTableFilters.test.tsx`).
4. Component: `render` + `userEvent` + truy vấn theo vai trò/tên (`getByRole('tab', { name: … })`) – đồng thời kiểm tra a11y.
5. `npm run test:run` và `npm run lint` phải sạch trước khi commit; hàm logic mới có test trong cùng commit.

**Node cho test:** máy dev hiện có Node 26 – 10 test dùng router (`createMemoryRouter`) lỗi `AbortSignal` (undici ↔ jsdom), không phải lỗi mã. Chạy bằng Node 20 (bản Netlify): `npx -p node@20 node node_modules/vitest/vitest.mjs run` (hoặc `nvm use 20`).

**Hiện có** (360 test FE + shared, 26/10/2026; backend 61 ở repo `../demo-lpg-server`): mức bồn → thể tích, giờ nhà máy + quá hạn bảo trì, validate cảnh (zod + luật), migration, mất tín hiệu, bộ lọc/đếm cảnh báo, `useTableFilters`, thao tác Editor (`ops`), `applyLive`, `announce`, `useReducedMotion`, `tokens`; component Tabs/SegmentedControl, Select, DataTable, modal tạo yêu cầu bảo trì.

**Kiểm tra accessibility**
- Tự động khi viết code: `npm run lint` (jsx-a11y: tên truy cập, nhãn ô nhập, không `tabindex` > 0, phần tử có click phải dùng được bằng phím).
- Theo trang: chạy axe-core (WCAG 2.1 A/AA) trên dev server bằng Playwright (script để ngoài repo, nạp `node_modules/axe-core/axe.min.js` vào trang rồi gọi `axe.run`). Lỗi serious/critical phải sửa; lỗi tương phản lệch Figma ghi vào `docs/decisions.md` để duyệt.
- Quy tắc: dialog dùng `useDialog` (bẫy focus, Esc, trả focus); vùng cuộn/bản đồ có `role="region"` + tên + `tabIndex={0}`; thông báo động qua `announce()` (aria-live polite); trạng thái luôn kèm chữ/icon, không chỉ màu; chuyển động tôn trọng `prefers-reduced-motion` (`useReducedMotion`, CSS toàn cục).
- Canvas 3D: danh sách thiết bị ẩn (`DeviceList` trong `SceneViewer.tsx`) – Tab vào thì hiện, Enter chọn thiết bị + đưa camera tới.

**Breakpoint** (`tailwind.config.ts` → `screens`; không viết `min-[…px]` tuỳ ý)

| Tên | Từ | Bố cục |
|---|---|---|
| (mặc định) | 0 | dùng được, không cần đẹp tuyệt đối; KPI 2 cột |
| `md` | 768 | KPI 3 cột |
| `lg` | 1024 | Editor cột bên hẹp; Tổng quan sidebar nằm dưới |
| `xl` | 1280 | bố cục đầy đủ: sidebar 326px bên phải, menu ngang chỉ icon (dưới mức này là nút Menu) |
| `wide` | 1520 | như Figma (frame 1565): menu đủ chữ, KPI một hàng, 4 biểu đồ một hàng |
| `3xl` | 1920 | nội dung tối đa `max-w-content` (1920px) căn giữa |

Bảng rộng: `DataTable minWidth` → cuộn ngang trong khung, `stickyFirst`/`stickyActions` giữ cột mã/cột "Xem". Ảnh chụp kiểm tra responsive để trong `scratch/` (đã gitignore).

**Kiểm tra đường dẫn trong GUIDE**: mọi đường dẫn file src/… (kể cả `packages/shared/src/…`) nhắc tới trong file này phải tồn tại (mẫu có <…> hoặc * bị bỏ qua) – chạy:
```bash
grep -oE '(packages/shared/)?src/[A-Za-z0-9_./-]+\.(tsx?|css|json)' GUIDE.md | sort -u | while read p; do [ -e "$p" ] || echo "THIẾU $p"; done
```

---
