import type { ReactNode } from 'react';
import { AlertAssignSection } from './AlertAssignSection';
import { AlertDrawerSection } from './AlertDrawerSection';
import { AssetSection } from './AssetSection';
import { AssignSection } from './AssignSection';
import { BusinessSection } from './BusinessSection';
import { EditorSection } from './EditorSection';
import { FormsSection } from './FormsSection';
import { ChartsTableSection } from './ChartsTableSection';
import { LayoutSection } from './LayoutSection';
import { MaintenanceDetailSection } from './MaintenanceDetailSection';
import { NavigationSection } from './NavigationSection';
import { AlertUpdateSection } from './AlertUpdateSection';
import { PrimitivesSection } from './PrimitivesSection';
import { ProgressUpdateSection } from './ProgressUpdateSection';
import { ReportsSection } from './ReportsSection';
import { ReviewSection } from './ReviewSection';
import { SceneSection } from './SceneSection';
import { TokensSection } from './TokensSection';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h2 className="border-b border-line/30 pb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PlaygroundPage() {
  return (
    <div className="mx-auto flex max-w-[1565px] flex-col gap-12 px-page py-8">
      <header>
        <h1 className="text-3xl font-bold">Component Playground</h1>
        <p className="text-base text-fg-secondary">Digital Twin 2026 – đối chiếu với Figma</p>
      </header>

      <Section
        id="reports"
        title="18. Báo cáo định kỳ (ảnh thiết kế): KpiCard viền màu, MetricListCard, ScheduleList, ActionItemList, badge trạng thái, FilterBar inline"
      >
        <ReportsSection />
      </Section>

      <Section
        id="alert-update"
        title="17. Cập nhật xử lý (áp suất theo ảnh, gas, cháy) + xác nhận đóng cảnh báo: modal, InspectionTable, BeforeAfterReadings, Checkbox card"
      >
        <AlertUpdateSection />
      </Section>

      <Section
        id="alert-assign"
        title="16. Phân công xử lý cảnh báo (ảnh thiết kế): modal một / hàng loạt / đổi người, thẻ đầu, StaffPickerCard có xét ca, StaffFilters"
      >
        <AlertAssignSection />
      </Section>

      <Section
        id="alert-drawer"
        title="15. Chi tiết cảnh báo (ảnh thiết kế): drawer, ThresholdGauge, WorkflowStepper dọc, Checklist plain, KpiCard lg, Button danger, StaffList compact"
      >
        <AlertDrawerSection />
      </Section>

      <Section id="assign" title="14. Phân công người xử lý (ảnh thiết kế): modal, StaffList/StaffPickerCard, Switch, Avatar">
        <AssignSection />
      </Section>

      <Section
        id="review"
        title="13. Nghiệm thu bảo trì (ảnh thiết kế): modal Gửi yêu cầu nghiệm thu, modal Nghiệm thu, biến thể StatusOptionGroup/Checklist/Badge/KpiCard"
      >
        <ReviewSection />
      </Section>

      <Section
        id="progress-update"
        title="12. Cập nhật tiến độ bảo trì (ảnh thiết kế): modal, StatusOptionCard, ProgressSlider, UploadTile, cờ Tạm dừng/Gặp sự cố"
      >
        <ProgressUpdateSection />
      </Section>

      <Section id="maintenance-detail" title="11. Chi tiết yêu cầu bảo trì (ảnh MT-00128): stepper, checklist, ghi chú, tệp, hạn chót, phân công">
        <MaintenanceDetailSection />
      </Section>

      <Section id="asset" title="10. Chi tiết tài sản (GĐ 5D): hình cắt bồn, lớp tồn chứa, KPI dense, bảo trì">
        <AssetSection />
      </Section>

      <Section id="editor" title="9. Scene Editor (3D-3): NumberField, Vec3Field, TreeView, Checkbox có nhãn, icon">
        <EditorSection />
      </Section>

      <Section id="scene" title="8. Cảnh 3D (3D-1 Viewer)">
        <SceneSection />
      </Section>

      <Section id="forms" title="7. Form, Modal, Drawer & Bảo trì">
        <FormsSection />
      </Section>

      <Section id="charts" title="6. Chart & bảng">
        <ChartsTableSection />
      </Section>

      <Section id="business" title="5. Nghiệp vụ (đợt 1)">
        <BusinessSection />
      </Section>

      <Section id="layout" title="4. Layout">
        <LayoutSection />
      </Section>

      <Section id="navigation" title="3. Form & điều hướng">
        <NavigationSection />
      </Section>

      <Section id="primitives" title="2. Primitives">
        <PrimitivesSection />
      </Section>

      <Section id="tokens" title="1. Design tokens">
        <TokensSection />
      </Section>
    </div>
  );
}
