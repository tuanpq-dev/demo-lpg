import { Button } from '@/components';
import { StatusLayout } from './StatusLayout';

export type ServerErrorPageProps = {
  error?: unknown;
  withHeader?: boolean;
};

/** 500 "Đã có lỗi": lỗi render / lỗi không lường trước bắt ở `errorElement` của router. */
export default function ServerErrorPage({ error, withHeader }: ServerErrorPageProps) {
  const detail = import.meta.env.DEV && error ? (error instanceof Error ? (error.stack ?? error.message) : String(error)) : null;
  return (
    <StatusLayout
      code="500"
      title="Đã có lỗi"
      heading="Trang gặp lỗi không mong muốn"
      withHeader={withHeader}
      message={
        <>
          <p>Thử tải lại trang. Nếu vẫn lỗi, báo quản trị viên kèm thời điểm và thao tác vừa làm.</p>
          {detail && <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-sm text-fg-muted">{detail}</pre>}
        </>
      }
      actions={
        <>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
          <Button onClick={() => window.location.assign('/overview')}>Về Tổng quan</Button>
        </>
      }
    />
  );
}
