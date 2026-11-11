import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, buttonClass, type BreadcrumbItem } from '@/components';
import { SIMULATION_REFERENCE_TAGS, type useSimulation } from '@/data/simulation';
import { suggestionConfidence, tagHealth, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import NotFoundPage from '../../errors/NotFoundPage';

/** Khối dùng chung của 4 màn AI mô phỏng (danh sách · cấu hình · theo dõi · kết quả). */

type LiveData = ReturnType<typeof useSimulation>['liveData'];
type TagHealth = ReturnType<typeof tagHealth>;

/** Nút "Quay lại …" ở header (ghost + mũi tên). */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={buttonClass('ghost')}>
      <ArrowLeftIcon size={16} />
      {label}
    </Link>
  );
}

/** Mã kịch bản trên URL không có trong danh sách. */
export function ScenarioNotFound({
  scenarioId,
  scenarios,
  breadcrumb,
  actions,
}: {
  scenarioId: string;
  scenarios: readonly Scenario[];
  breadcrumb: BreadcrumbItem[];
  actions: React.ReactNode;
}) {
  return (
    <NotFoundPage
      title="Không tìm thấy kịch bản"
      breadcrumb={breadcrumb}
      message={`Không có kịch bản mô phỏng "${scenarioId}". Kịch bản đang có: ${scenarios.map((s) => s.code).join(', ')}.`}
      actions={actions}
    />
  );
}

/** Khoá nội dung của tình trạng tag – `tagHealth` trả object mới mỗi lần gọi nên không dùng làm dependency được. */
export const healthKeyOf = (h: TagHealth) => (h ? `${h.ok}/${h.bad}/${h.missing}/${h.stale}` : 'pending');

/**
 * Tình trạng 21 tag tham chiếu + khoá nội dung. So `ts` với giờ THẬT (không theo `?now=`) – CLAUDE.md "Dữ liệu trực tiếp".
 */
export function referenceHealth(live: LiveData) {
  const health = tagHealth(SIMULATION_REFERENCE_TAGS, live, Date.now());
  return { health, healthKey: healthKeyOf(health) };
}

/** Độ tin cậy gợi ý AI (công thức màn danh sách) – chỉ tính lại khi nội dung tag hoặc phút đổi, không nhảy mỗi giây. */
export function useSuggestionConfidence(scenarios: readonly Scenario[], runs: readonly SimulationRun[], live: LiveData, now: number) {
  const { health, healthKey } = referenceHealth(live);
  const minute = Math.floor(now / 60_000);
  return useMemo(
    () => (health ? suggestionConfidence(scenarios, runs, health, new Date(minute * 60_000)) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `healthKey` đại diện `health` (object mới mỗi lần gọi)
    [scenarios, runs, healthKey, minute],
  );
}

/** Thời điểm của lần phân tích: giữ nguyên tới khi `result` (gợi ý) đổi tham chiếu. */
export function useAnalyzedAt(result: unknown, now: Date): Date {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý chỉ theo `result`, không theo đồng hồ
  return useMemo(() => now, [result]);
}
