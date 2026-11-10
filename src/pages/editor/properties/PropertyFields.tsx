/** Khối dùng chung của bảng thuộc tính Editor: Section, ô nhập commit khi rời ô, kiểu cập nhật object. */
import { useEffect, useState, type ReactNode } from 'react';
import { TextField } from '@/components';
import type { SceneObject } from '@/features/scene/types';

export const DEG = 180 / Math.PI;

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-line/30 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** TextField chốt khi rời ô/Enter (1 lần sửa = 1 bước undo); `onCommit` trả lỗi → giữ chữ + báo lỗi. */
export function CommitTextField({
  label,
  value,
  onCommit,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => string | undefined | void;
  hint?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setText(value);
    setError(undefined);
  }, [value]);
  const commit = () => {
    if (text === value) return setError(undefined);
    setError(onCommit(text) || undefined);
  };
  return (
    <TextField
      label={label}
      value={text}
      onChange={setText}
      error={error}
      hint={hint}
      placeholder={placeholder}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setText(value);
      }}
    />
  );
}

export type Update = (fn: (o: SceneObject) => SceneObject) => void;
