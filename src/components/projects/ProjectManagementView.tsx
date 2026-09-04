import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { useUiStore } from '../../store/uiStore';
import { useDragReorder } from '../../hooks/useDragReorder';
import { groupProjectsByCustomer, orderCustomerGroups } from '../../lib/projectGroups';
import RtfField from '../shared/RtfField';
import ContactsManager from './ContactsManager';
import type { Project, ProjectStatus, ProjectTyp } from '../../types/entities';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  aktiv: 'Aktiv',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
};

function ProjectEditor({ project, onClose }: { project: Project; onClose: () => void }) {
  const updateProject = useDataStore((state) => state.updateProject);
  const deleteProject = useDataStore((state) => state.deleteProject);
  const confirm = useModalStore((state) => state.confirm);
  const data = useDataStore((state) => state.cache[project.id]);
  const ensureProjectData = useDataStore((state) => state.ensureProjectData);
  const [name, setName] = useState(project.name);
  const [kunde, setKunde] = useState(project.kunde || '');
  const [kuerzel, setKuerzel] = useState(project.kuerzel || '');
  const [typ, setTyp] = useState<ProjectTyp>(project.typ);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [beschreibung, setBeschreibung] = useState(project.beschreibung || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureProjectData(project.id);
  }, [ensureProjectData, project.id]);

  async function save() {
    setSaving(true);
    await updateProject(project.id, { name: name.trim() || project.name, kunde: kunde.trim(), kuerzel: kuerzel.trim(), typ, status, beschreibung });
    setSaving(false);
    onClose();
  }

  async function remove() {
    const sure = await confirm(
      `Projekt „${project.name}“ wirklich unwiderruflich löschen? Alle Aufgaben, Kontakte, Kommunikation und Dokumentation des Projekts gehen verloren.`,
    );
    if (!sure) return;
    await deleteProject(project.id);
    onClose();
  }

  return (
    <section className="card project-admin-editor" aria-label={`${project.name} bearbeiten`}>
      <div className="project-admin-editor-head">
        <div><div className="eyebrow">Stammdaten bearbeiten</div><h3>{project.name}</h3></div>
        <button className="icon-btn" onClick={onClose}>Schließen</button>
      </div>
      <div className="field-grid">
        <div className="field"><label>Projektname</label><input value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="field"><label>Kunde</label><input value={kunde} onChange={(event) => setKunde(event.target.value)} /></div>
        <div className="field"><label>Kürzel</label><input value={kuerzel} onChange={(event) => setKuerzel(event.target.value)} placeholder="z. B. ABC" /></div>
        <div className="field">
          <label>Typ</label>
          <select value={typ} onChange={(event) => setTyp(event.target.value as ProjectTyp)}>
            <option value="Neukunde">Neukunde</option>
            <option value="Bestandskunde">Bestandskunde</option>
            <option value="Bestandskunde mit Echtläufen">Bestandskunde mit Echtläufen</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
            <option value="aktiv">Aktiv</option><option value="pausiert">Pausiert</option><option value="abgeschlossen">Abgeschlossen</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Kurzbeschreibung</label>
        <RtfField value={beschreibung} onChange={setBeschreibung} title="Kurzbeschreibung" placeholder="Kurzbeschreibung des Projekts erfassen…" />
      </div>
      <div className="btn-row">
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'Speichert…' : 'Änderungen speichern'}</button>
        <button className="btn secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn danger project-delete-btn" onClick={remove}>Projekt löschen</button>
      </div>
      {data ? <ContactsManager projectId={project.id} data={data} /> : <div className="loading-note">Ansprechpartner werden geladen…</div>}
    </section>
  );
}

function QuickVersion({ project }: { project: Project }) {
  const updateProject = useDataStore((state) => state.updateProject);
  const [version, setVersion] = useState(project.aktuelleVersion || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => setVersion(project.aktuelleVersion || ''), [project.aktuelleVersion]);

  async function save() {
    const next = version.trim();
    if (next === (project.aktuelleVersion || '')) return;
    await updateProject(project.id, { aktuelleVersion: next });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <div className="quick-version">
      <label htmlFor={`version-${project.id}`}>Version</label>
      <input id={`version-${project.id}`} value={version} placeholder="z. B. 4.12.3" onChange={(event) => setVersion(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      <span className="quick-version-state" aria-live="polite">{saved ? 'Gespeichert' : ''}</span>
    </div>
  );
}

export default function ProjectManagementView() {
  const projects = useDataStore((state) => state.projects);
  const newProjectForm = useModalStore((state) => state.newProjectForm);
  const createProject = useDataStore((state) => state.createProject);
  const reorderProjects = useDataStore((state) => state.reorderProjects);
  const reorderCustomerGroups = useDataStore((state) => state.reorderCustomerGroups);
  const updateProject = useDataStore((state) => state.updateProject);
  const customerOrder = useDataStore((state) => state.customerOrder);
  const selectedId = useUiStore((state) => state.selectedId);
  const goTo = useUiStore((state) => state.goTo);
  const [editingId, setEditingId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (selectedId) setEditingId(selectedId);
  }, [selectedId]);

  async function create() {
    const result = await newProjectForm();
    if (!result) return;
    const id = await createProject(result);
    setEditingId(id);
  }

  const all = projects || [];
  const groups = orderCustomerGroups(groupProjectsByCustomer(all), customerOrder);
  const editingProject = all.find((project) => project.id === editingId);
  const { getItemProps } = useDragReorder({
    getGroupKey: (id) => groups.find((g) => g.projects.some((p) => p.id === id))?.key || '',
    onDrop: (sourceId, targetId, placeAfter) => reorderProjects(sourceId, targetId, placeAfter),
  });
  const { getItemProps: getGroupProps } = useDragReorder({
    onDrop: (sourceKey, targetKey, placeAfter) => reorderCustomerGroups(sourceKey, targetKey, placeAfter),
  });

  return (
    <div className="main-inner">
      <header className="page-header project-admin-header">
        <div><div className="eyebrow">Zentrale Verwaltung</div><h2>Projekte verwalten</h2><p>Stammdaten anlegen und pflegen – getrennt von der operativen Projektarbeit.</p></div>
        <button className="btn" onClick={create}>＋ Neues Projekt</button>
      </header>
      {editingProject && <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Projekt bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Projektverwaltung</span><strong>{editingProject.name}</strong></div></div><ProjectEditor key={editingProject.id} project={editingProject} onClose={() => setEditingId(null)} /></div></div>}
      <div className="section-title">Alle Projekte ({all.length}) — nach Kunde gruppiert, Kunden und Projekte per Griff ziehbar</div>
      {projects === null && <div className="loading-note">Projekte werden geladen…</div>}
      {projects !== null && all.length === 0 && <div className="empty-state"><h3>Noch keine Projekte</h3><div>Lege dein erstes Projekt über die Schaltfläche oben an.</div></div>}
      {groups.map((group) => {
        const groupDragProps = getGroupProps(group.key);
        return (
        <section
          className={`project-admin-group${groupDragProps.className ? ` ${groupDragProps.className}` : ''}`}
          key={group.key}
          onDragOver={groupDragProps.onDragOver}
          onDragLeave={groupDragProps.onDragLeave}
          onDrop={groupDragProps.onDrop}
        >
          <div className="project-admin-group-label">
            <span
              className="drag-handle"
              draggable={groupDragProps.draggable}
              onDragStart={groupDragProps.onDragStart}
              onDragEnd={groupDragProps.onDragEnd}
              title="Ziehen zum Umsortieren der Kundengruppe"
            >
              ⠿
            </span>
            {group.label} <span>({group.projects.length})</span>
          </div>
          <div className="project-admin-list">
            {group.projects.map((project) => {
              const dragProps = getItemProps(project.id);
              return (
                <article
                  className={`project-admin-row${dragProps.className ? ` ${dragProps.className}` : ''}`}
                  key={project.id}
                  onDragOver={dragProps.onDragOver}
                  onDragLeave={dragProps.onDragLeave}
                  onDrop={dragProps.onDrop}
                >
                  <span
                    className="drag-handle"
                    draggable={dragProps.draggable}
                    onDragStart={dragProps.onDragStart}
                    onDragEnd={dragProps.onDragEnd}
                    title="Ziehen zum Umsortieren"
                  >
                    ⠿
                  </span>
                  <div className="project-admin-main"><span className={`status-dot ${project.status}`} /><div><strong>{project.name}</strong><div className="meta">{project.kunde || 'Kein Kunde'} · {project.typ}</div></div></div>
                  <QuickVersion project={project} />
                  <span className={`stamp ${project.status}`}>{STATUS_LABELS[project.status]}</span>
                  <div className="project-admin-actions">
                    <button className={`btn secondary small quickbar-visibility-btn${project.quickbarHidden ? ' hidden' : ''}`} onClick={() => updateProject(project.id, { quickbarHidden: !project.quickbarHidden })}>{project.quickbarHidden ? 'In Schnellwahl einblenden' : 'Aus Schnellwahl ausblenden'}</button>
                    <button className="btn secondary small" onClick={() => setEditingId(project.id)}>Stammdaten</button>
                    <button className="btn small" onClick={() => goTo('project', project.id)}>Projekt öffnen</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}
