import { useProjectUiStore } from '../../store/projectUiStore';
import { fmtDate, isEmptyHtml, slug } from '../../lib/format';
import { commLinkLabel } from '../../lib/format';
import LinkChipsView from '../shared/LinkChipsView';
import AfnChipsView from '../shared/AfnChipsView';
import type { Contact, ProjectCache, Task } from '../../types/entities';

interface Props {
  task: Task;
  contact: Contact | undefined;
  data: ProjectCache;
  onDelete: () => void;
}

export default function ProjectTaskRow({ task, contact, data, onDelete }: Props) {
  const { setEditingTaskId, jumpToComm } = useProjectUiStore();

  return (
    <div
      className="list-item task-view-row"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-no-open]')) return;
        setEditingTaskId(task.id);
      }}
    >
      <div className="top-row">
        <div>
          <span className={`prio-dot prio-${slug(task.prioritaet || 'should')}`} style={{ display: 'inline-block', marginRight: 4 }} />
          <span className="task-nr">{task.nr || '—'}</span>
          <strong>{task.titel}</strong>
          <span className={`badge ${slug(task.status)}`} style={{ marginLeft: 6 }}>
            {task.status}
          </span>
          {task.doku && (
            <span className="badge doku" style={{ marginLeft: 4 }}>
              Doku
            </span>
          )}
          {task.afns && task.afns.length > 0 && <AfnChipsView afns={task.afns} />}
          <div className="meta">
            Fällig: {fmtDate(task.faelligAm)} {contact && `· ${contact.name}`}
            {task.erstelltAm && ` · Erstellt: ${fmtDate(task.erstelltAm.slice(0, 10))}`}
            {task.abgeschlossenAm && ` · Erledigt: ${fmtDate(task.abgeschlossenAm.slice(0, 10))}`}
          </div>
          {task.status === 'wartet' && <div className="wartet-auf-note">⏳ Wartet auf: {task.wartetAuf || '—'}</div>}
          {!isEmptyHtml(task.beschreibung) && (
            <div className="rtf-content rtf-field-preview-compact" style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: task.beschreibung }} />
          )}
          {!isEmptyHtml(task.notizen) && (
            <>
              <div className="meta" style={{ marginTop: 4, color: 'var(--violet)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Interne Notiz
              </div>
              <div className="rtf-content rtf-field-preview-compact" dangerouslySetInnerHTML={{ __html: task.notizen }} />
            </>
          )}
          <div data-no-open>
            <LinkChipsView ids={task.commIds} items={data.comms} labelFn={commLinkLabel} onJump={jumpToComm} />
          </div>
        </div>
        <div className="actions" data-no-open>
          <button className="icon-btn" onClick={onDelete}>
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}
