import { useProjectUiStore } from '../../store/projectUiStore';
import { useDataStore } from '../../store/dataStore';
import { fmtDate, isEmptyHtml, slug, todayStr } from '../../lib/format';
import { localDateKey, nextWorkday } from '../../lib/workdays';
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
  const colorLabels = useDataStore((state) => state.taskColorLabels);
  const dashboardData = useDataStore((state) => state.dashboardData);
  const workdayOverrides = useDataStore((state) => state.workdayOverrides);
  const nextWorkdayKey = localDateKey(nextWorkday(new Date(`${todayStr()}T12:00:00`), workdayOverrides));
  const isPlannedDay = task.faelligAm === todayStr() || task.faelligAm === nextWorkdayKey;
  const dayTasks = isPlannedDay ? (dashboardData?.tasksWithDate || [])
    .filter((item) => item.faelligAm === task.faelligAm)
    .sort((a, b) => (a.tagesSortierung ?? 999) - (b.tagesSortierung ?? 999) || (a.erstelltAm || '').localeCompare(b.erstelltAm || '') || a.nr - b.nr) : [];
  const dailyRank = dayTasks.findIndex((item) => item.id === task.id) + 1;

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
          {task.farbe && <span className={`task-color-swatch task-color-${task.farbe}`} title={colorLabels[task.farbe]} />}
          <span className={`prio-dot prio-${slug(task.prioritaet || 'should')}`} style={{ display: 'inline-block', marginRight: 4 }} />
          {dailyRank > 0 && <span className={`project-task-rank${task.faelligAm === todayStr() ? '' : ' next-workday'}`} title={task.faelligAm === todayStr() ? 'Tagesrang heute' : `Tagesrang am ${fmtDate(task.faelligAm)}`}>#{dailyRank}</span>}
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
