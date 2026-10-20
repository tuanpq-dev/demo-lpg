import { useState } from 'react';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChecklistEditor,
  CloseIcon,
  Combobox,
  DatePicker,
  FileDropzone,
  FileIcon,
  FormField,
  GripIcon,
  Icon,
  PaperclipIcon,
  PeopleIcon,
  PlusIcon,
  SegmentedControl,
  SendIcon,
  ShieldIcon,
  SparkleIcon,
  TemplateIcon,
  ToolsIcon,
  UploadIcon,
  newChecklistItem,
  type AttachedFile,
  type ChecklistItem,
} from '@/components';
import { CHECKLIST_TEMPLATES, FORM_PRIORITY_OPTIONS, PEOPLE } from '@/data/maintenance';

const tempIcons = [
  ['ToolsIcon', ToolsIcon],
  ['UploadIcon', UploadIcon],
  ['FileIcon', FileIcon],
  ['PaperclipIcon', PaperclipIcon],
  ['ShieldIcon', ShieldIcon],
  ['SparkleIcon', SparkleIcon],
  ['CheckCircleIcon', CheckCircleIcon],
  ['SendIcon', SendIcon],
  ['GripIcon', GripIcon],
  ['PeopleIcon', PeopleIcon],
  ['TemplateIcon', TemplateIcon],
  ['PlusIcon', PlusIcon],
  ['CloseIcon', CloseIcon],
  ['ArrowRightIcon', ArrowRightIcon],
  ['AlertTriangleIcon', AlertTriangleIcon],
] as const;

/** Các phần của modal "Tạo yêu cầu bảo trì" – đặt riêng để thử từng component. */
export function ModalPartsDemo() {
  const people = PEOPLE.map((p) => ({ value: p.name, label: p.name, meta: p.department }));
  const [lead, setLead] = useState<string | null>('Nguyễn Văn A');
  const [collab, setCollab] = useState<string[]>(['Trần Thị B']);
  const [device, setDevice] = useState<string | null>('V-101');
  const [prio, setPrio] = useState('critical');
  const [start, setStart] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>(CHECKLIST_TEMPLATES[0].items.map((t) => newChecklistItem(t)));
  const [files, setFiles] = useState<AttachedFile[]>([{ id: 'f1', name: 'Quy_trinh_kiem_tra_van_PSV.pdf', size: 2_516_582 }]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-[1000px] grid-cols-2 gap-4">
        <FormField label="Thiết bị (Combobox đơn + kính lúp)">
          {({ id, labelId }) => (
            <Combobox
              id={id}
              labelledBy={labelId}
              leading={<Icon name="search" box={16} />}
              placeholder="Tìm mã thiết bị…"
              options={['V-101', 'V-102', 'GS-01', 'E-101A', 'P-101A'].map((d) => ({ value: d, label: d }))}
              value={device}
              onChange={setDevice}
              clearable={false}
            />
          )}
        </FormField>
        <FormField label="Mức độ ưu tiên (SegmentedControl field)">
          {({ id, labelId }) => (
            <SegmentedControl variant="field" id={id} labelledBy={labelId} label="Mức độ ưu tiên" options={FORM_PRIORITY_OPTIONS} value={prio} onChange={setPrio} />
          )}
        </FormField>
        <FormField label="Người phụ trách chính (Combobox + avatar)">
          {({ id, labelId }) => (
            <Combobox id={id} labelledBy={labelId} showAvatar placeholder="Chọn người phụ trách…" options={people} value={lead} onChange={setLead} />
          )}
        </FormField>
        <FormField label="Người phối hợp (Combobox nhiều + chip)">
          {({ id, labelId }) => (
            <Combobox multiple id={id} labelledBy={labelId} showAvatar leading={<PeopleIcon />} placeholder="Tìm kiếm nhân sự…" options={people} value={collab} onChange={setCollab} />
          )}
        </FormField>
        <DatePicker type="datetime-local" label="DatePicker datetime-local" value={start} onChange={setStart} />
      </div>
      <ChecklistEditor items={items} onChange={setItems} templates={CHECKLIST_TEMPLATES} className="max-w-[1000px]" />
      <FileDropzone files={files} onChange={setFiles} className="max-w-[480px]" />
      <div>
        <h4 className="mb-2 text-sm font-semibold text-fg-secondary">Icon tạm (TempIcons – chưa có asset Figma)</h4>
        <ul className="flex flex-wrap gap-4">
          {tempIcons.map(([name, C]) => (
            <li key={name} className="flex w-24 flex-col items-center gap-1 text-2xs text-fg-muted/70">
              <C className="text-fg" />
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
