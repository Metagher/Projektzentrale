import { useState } from 'react';
import { useProjectUiStore } from '../../store/projectUiStore';
import { useDataStore } from '../../store/dataStore';
import { fmtDate, slug, todayStr, waitingDurationLabel } from '../../lib/format';
import { localDateKey, nextWorkday } from '../../lib/workdays';
import { commLinkLabel } from '../../lib/format';
import LinkChipsView from '../shared/LinkChipsView';
import AfnChipsView from '../shared/AfnChipsView';
import type { Contact, Project, ProjectCache, Task } from '../../types/entities';
import { toExternalHref } from '../../lib/externalLinks';
import { exportTaskToPdf } from '../../lib/taskPdfExport';
import { useModalStore } from '../../store/modalStore';
import TimeTrackingButton from '../shared/TimeTrackingButton';
import { formatDuration } from '../../lib/timeTracking';
import TaskColorBadge from '../shared/TaskColorBadge';
import { copyPathToClipboard, normalizeExplorerBasePath, taskExplorerPath, toFileUrl } from '../../lib/explorerPaths';
import { taskDocumentationLabel } from '../../lib/taskDocumentation';

interface Props {
  task: Task;
  project: Project;
  contacts: Contact[];
  data: ProjectCache;
  onDelete: () => void;
}

export default function ProjectTaskRow({ task, project, contacts, data, onDelete }: Props) {
  const [copiedPath, setCopiedPath] = useState<'task' | 'project' | null>(null);
  const { setEditingTaskId, jumpToComm } = useProjectUiStore();
  const dashboardData = useDataStore((state) => state.dashboardData);
  const saveTask = useDataStore((state) => state.saveTask);
  const workdayOverrides = useDataStore((state) => state.workdayOverrides);
  const alert = useModalStore((state) => state.alert);
  const nextWorkdayKey = localDateKey(nextWorkday(new Date(`${todayStr()}T12:00:00`), workdayOverrides));
  const isPlannedDay = task.faelligAm === todayStr() || task.faelligAm === nextWorkdayKey;
  const dayTasks = isPlannedDay ? (dashboardData?.tasksWithDate || [])
    .filter((item) => item.faelligAm === task.faelligAm && (item.tagesSortierung ?? 999) < 999)
    .sort((a, b) => (a.tagesSortierung ?? 999) - (b.tagesSortierung ?? 999) || (a.erstelltAm || '').localeCompare(b.erstelltAm || '') || a.nr - b.nr) : [];
  const dailyRank = dayTasks.findIndex((item) => item.id === task.id) + 1;
  const externalHref = toExternalHref(task.fremdverknuepfung);
  const ticketHref = toExternalHref(task.ticketsystemVerknuepfung);
  const trackedMinutes = useDataStore((state) => state.timeEntries).filter((entry) => entry.projectId === project.id && entry.taskId === task.id).reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const explorerBasePath = normalizeExplorerBasePath(useDataStore((state) => state.explorerBasePath));
  const explorerTaskPath = taskExplorerPath(explorerBasePath, task);
  const explorerTaskUrl = toFileUrl(explorerTaskPath);
  const explorerBaseUrl = toFileUrl(explorerBasePath);

  async function copyExplorerPath(kind: 'task' | 'project') {
    const copied = await copyPathToClipboard(kind === 'task' ? explorerTaskPath : explorerBasePath);
    if (!copied) return;
    setCopiedPath(kind);
    window.setTimeout(() => setCopiedPath((current) => current === kind ? null : current), 1600);
  }

  return (
    <div
      className="list-item task-view-row"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-no-open]')) return;
        setEditingTaskId(task.id);
      }}
    >
      <div className="task-card-layout">
        <header className="task-card-head">
          <div className="task-card-identity">
            <div className="task-card-kicker">
              {task.farbe && <TaskColorBadge color={task.farbe} compact />}
              {dailyRank > 0 && <span className={`project-task-rank${task.faelligAm === todayStr() ? '' : ' next-workday'}`} title={task.faelligAm === todayStr() ? 'Tagesrang heute' : `Tagesrang am ${fmtDate(task.faelligAm)}`}>#{dailyRank}</span>}
              <span className="task-nr">{task.nr || '—'}</span>
            </div>
            <strong className="task-card-title">{task.titel}</strong>
          </div>
        </header>

        <div className="task-card-badges">
          <span className={`badge ${slug(task.status)}`}>{task.status === 'wartet' ? `wartet auf ${task.wartetAuf || 'jemanden'}${task.wartetSeit ? ` · ${waitingDurationLabel(task.wartetSeit)}` : ''}` : task.status}</span>
          {task.teilprojekt?.trim() && <span className="badge teilprojekt">{task.teilprojekt.trim()}</span>}
          {taskDocumentationLabel(task) && <span className="badge doku">{taskDocumentationLabel(task)}</span>}
          {task.naechsteBesprechung && <span className="badge meeting">Nächste Besprechung</span>}
          {task.afns && task.afns.length > 0 && <AfnChipsView afns={task.afns} />}
        </div>

        <div className="task-card-meta">
          <span><b>Fällig</b>{fmtDate(task.faelligAm)}</span>
          {!!task.termine?.length && <span><b>Termine</b>{task.termine.map(fmtDate).join(', ')}</span>}
          {contacts.length > 0 && <span><b>Ansprechpartner</b>{contacts.map((contact) => contact.name).join(', ')}</span>}
          {task.erstelltAm && <span><b>Erstellt</b>{fmtDate(task.erstelltAm.slice(0, 10))}</span>}
          {task.abgeschlossenAm && <span><b>Erledigt</b>{fmtDate(task.abgeschlossenAm.slice(0, 10))}</span>}
        </div>

        {(externalHref || ticketHref) && <div className="task-card-links" data-no-open>
          {externalHref && <a href={externalHref} target="_blank" rel="noreferrer">↗ Fremdlink</a>}
          {ticketHref && <a href={ticketHref} target="_blank" rel="noreferrer">↗ Ticket</a>}
        </div>}
        <div className="task-card-relations" data-no-open><LinkChipsView ids={task.commIds} items={data.comms} labelFn={commLinkLabel} onJump={jumpToComm} /></div>
        {explorerBasePath && <div className="task-explorer-paths" data-no-open>
          {explorerTaskUrl && <a href={explorerTaskUrl} target="_blank" rel="noreferrer" title={explorerTaskPath} onClick={() => copyExplorerPath('task')}>{copiedPath === 'task' ? 'Pfad kopiert' : 'Aufgabenordner öffnen'}</a>}
          {explorerBaseUrl && <a href={explorerBaseUrl} target="_blank" rel="noreferrer" title={explorerBasePath} onClick={() => copyExplorerPath('project')}>{copiedPath === 'project' ? 'Pfad kopiert' : 'Basisordner öffnen'}</a>}
        </div>}

        <footer className="task-card-actions" data-no-open>
          <button type="button" className={`meeting-task-toggle${task.naechsteBesprechung ? ' active' : ''}`} aria-pressed={!!task.naechsteBesprechung} title={task.naechsteBesprechung ? 'Vormerkung für die nächste Besprechung entfernen' : 'Für die nächste Besprechung vormerken'} onClick={() => void saveTask(project.id, { ...task, naechsteBesprechung: !task.naechsteBesprechung })}>Besprechung</button>
          {trackedMinutes > 0 && <span className="task-time-total">{formatDuration(trackedMinutes)}</span>}
          <TimeTrackingButton projectId={project.id} taskId={task.id} compact />
          <button type="button" className="icon-btn" onClick={async () => { try { exportTaskToPdf(project, task, contacts[0]); } catch (error) { await alert((error as Error).message); } }}>PDF</button>
          <button type="button" className="icon-btn" onClick={onDelete}>Löschen</button>
        </footer>
      </div>
    </div>
  );
}
