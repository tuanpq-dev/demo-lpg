import { Suspense, lazy, type ComponentProps } from 'react';
import { preloadWhenIdle } from '@/lib/whenIdle';
import type { AssignModal as AssignT } from './AssignModal';
import type { ProgressUpdateModal as ProgressT } from './ProgressUpdateModal';
import type { ReviewModal as ReviewT } from './ReviewModal';
import type { SubmitReviewModal as SubmitT } from './SubmitReviewModal';
import type { CreateMaintenanceModal as CreateT } from '../shared/maintenance/CreateMaintenanceModal';

/*
 * Modal bảo trì (tiến độ, gửi nghiệm thu, nghiệm thu, phân công, tạo yêu cầu) chỉ cần khi mở → chunk LƯỜI, dùng chung cho danh
 * sách và trang chi tiết; mỗi modal một Suspense riêng (đang tải không ẩn tạm phần khác của trang). Trang gọi
 * `preloadMaintenanceModals` sau khi có dữ liệu để lần mở đầu không phải chờ mạng.
 */
const loaders = {
  progress: () => import('./ProgressUpdateModal'),
  submit: () => import('./SubmitReviewModal'),
  review: () => import('./ReviewModal'),
  assign: () => import('./AssignModal'),
  create: () => import('../shared/maintenance/CreateMaintenanceModal'),
};

const LazyProgress = lazy(() => loaders.progress().then((m) => ({ default: m.ProgressUpdateModal })));
const LazySubmit = lazy(() => loaders.submit().then((m) => ({ default: m.SubmitReviewModal })));
const LazyReview = lazy(() => loaders.review().then((m) => ({ default: m.ReviewModal })));
const LazyAssign = lazy(() => loaders.assign().then((m) => ({ default: m.AssignModal })));
const LazyCreate = lazy(() => loaders.create().then((m) => ({ default: m.CreateMaintenanceModal })));

export const ProgressUpdateModal = (p: ComponentProps<typeof ProgressT>) => (
  <Suspense fallback={null}>
    <LazyProgress {...p} />
  </Suspense>
);
export const SubmitReviewModal = (p: ComponentProps<typeof SubmitT>) => (
  <Suspense fallback={null}>
    <LazySubmit {...p} />
  </Suspense>
);
export const ReviewModal = (p: ComponentProps<typeof ReviewT>) => (
  <Suspense fallback={null}>
    <LazyReview {...p} />
  </Suspense>
);
export const AssignModal = (p: ComponentProps<typeof AssignT>) => (
  <Suspense fallback={null}>
    <LazyAssign {...p} />
  </Suspense>
);
export const CreateMaintenanceModal = (p: ComponentProps<typeof CreateT>) => (
  <Suspense fallback={null}>
    <LazyCreate {...p} />
  </Suspense>
);

/** Nạp trước mọi modal lúc trình duyệt rảnh (trả hàm huỷ – dùng làm cleanup của effect). */
export const preloadMaintenanceModals = () => preloadWhenIdle(...Object.values(loaders));
