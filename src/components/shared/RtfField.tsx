import { useState } from 'react';
import { isEmptyHtml } from '../../lib/format';
import RtfEditorModal from './RtfEditorModal';

interface Props {
  value: string;
  onChange: (html: string) => void;
  title: string;
  placeholder?: string;
}

export default function RtfField({ value, onChange, title, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const empty = isEmptyHtml(value);

  return (
    <>
      {empty ? (
        <div className="rtf-field-preview empty" onClick={() => setOpen(true)}>
          <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            {placeholder || 'Klicken zum Hinzufügen…'}
          </span>
        </div>
      ) : (
        <div className="rtf-field-preview" onClick={() => setOpen(true)} dangerouslySetInnerHTML={{ __html: value }} />
      )}
      {open && (
        <RtfEditorModal
          title={title}
          initialHtml={value}
          onCancel={() => setOpen(false)}
          onSave={(html) => {
            onChange(html);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
