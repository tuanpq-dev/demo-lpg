import { PageHeader } from '@/components';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';

/**
 * Trang chưa có thiết kế/nội dung (vd Vận hành, Nhật ký vận hành, AI mô phỏng sự cố).
 * Breadcrumb "section / title"; section trùng title → chỉ một mục.
 */
export default function SimplePage({ section, title }: { section?: string; title: string }) {
  const breadcrumb = section && section !== title ? [{ label: section }, { label: title }] : [{ label: title }];
  return (
    <Page pageHeader={<PageHeader breadcrumb={breadcrumb} title={title} />}>
      <Placeholder label={`${title} – chưa có nội dung`} height={480} />
    </Page>
  );
}
