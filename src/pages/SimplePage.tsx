import { PageHeader } from '@/components';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';

/** Trang chưa có thiết kế chi tiết trong Figma (Bản đồ nội khu, Báo cáo). */
export default function SimplePage({ section, title }: { section: string; title: string }) {
  return (
    <Page pageHeader={<PageHeader breadcrumb={[{ label: section }, { label: title }]} title={title} />}>
      <Placeholder label={`${title} – chưa có thiết kế`} height={480} />
    </Page>
  );
}
