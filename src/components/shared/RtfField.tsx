import { useState, type MouseEvent } from 'react';
import { isEmptyHtml } from '../../lib/format';
import { handleAttachmentImageClick, useResolvedAttachmentHtml } from '../../lib/attachments';
import { useConnectionStore } from '../../store/connectionStore';
import { useModalStore } from '../../store/modalStore';
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
  const client = useConnectionStore((s) => s.client);
  const openImageLightbox = useModalStore((s) => s.openImageLightbox);
  const resolvedValue = useResolvedAttachmentHtml(client, value);

  function onPreviewClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).tagName === 'IMG') {
      handleAttachmentImageClick(event, openImageLightbox);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      {empty ? (
        <div className="rtf-field-preview empty" onClick={() => setOpen(true)}>
          <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            {placeholder || 'Klicken zum Hinzufügen…'}
          </span>
        </div>
      ) : (
        <div className="rtf-field-preview" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: resolvedValue }} />
      )}
      {open && (
        <RtfEditorModal
          title={title}
          initialHtml={resolvedValue}
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
