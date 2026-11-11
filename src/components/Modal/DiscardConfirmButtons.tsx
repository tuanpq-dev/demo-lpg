import type { Ref } from 'react';
import { Button } from '../Button';

export type DiscardConfirmButtonsProps = {
  /** Nút "Tiếp tục sửa" nhận focus khi hỏi (`useFormModal` tự focus qua ref này). */
  keepEditingRef: Ref<HTMLButtonElement>;
  onKeepEditing: () => void;
  onDiscard: () => void;
  hasDraft: boolean;
  keepLabel?: string;
  /** Nhãn nút bỏ khi đang có nháp đã lưu. */
  draftDiscardLabel?: string;
};

/** Chân modal form khi hỏi "bỏ thay đổi?": Tiếp tục sửa · Bỏ thay đổi (và xóa nháp). Đi cùng `useFormModal`. */
export function DiscardConfirmButtons({
  keepEditingRef,
  onKeepEditing,
  onDiscard,
  hasDraft,
  keepLabel = 'Tiếp tục sửa',
  draftDiscardLabel = 'Bỏ thay đổi và xóa nháp',
}: DiscardConfirmButtonsProps) {
  return (
    <>
      <Button ref={keepEditingRef} variant="subtle" onClick={onKeepEditing}>
        {keepLabel}
      </Button>
      <Button variant="primary" onClick={onDiscard}>
        {hasDraft ? draftDiscardLabel : 'Bỏ thay đổi'}
      </Button>
    </>
  );
}
