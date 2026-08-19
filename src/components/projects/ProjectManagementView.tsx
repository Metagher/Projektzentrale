import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { useUiStore } from '../../store/uiStore';
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
  const [typ, setTyp] = useState<ProjectTyp>(project.typ);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [beschreibung, setBeschreibung] = useState(project.beschreibung || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureProjectData(project.id);
  }, [ensureProjectData, project.id]);

  async function save() {
    setSaving(true);
    await updateProject(project.id, { name: name.trim() || project.name, kunde: kunde.trim(), typ, status, beschreibung });
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

  const sorted = (projects || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const editingProject = sorted.find((project) => project.id === editingId);

  return (
    <div className="main-inner">
      <header className="page-header project-admin-header">
        <div><div className="eyebrow">Zentrale Verwaltung</div><h2>Projekte verwalten</h2><p>Stammdaten anlegen und pflegen – getrennt von der operativen Projektarbeit.</p></div>
        <button className="btn" onClick={create}>＋ Neues Projekt</button>
      </header>
      {editingProject && <ProjectEditor key={editingProject.id} project={editingProject} onClose={() => setEditingId(null)} />}
      <div className="section-title">Alle Projekte ({sorted.length})</div>
      <div className="project-admin-list">
        {projects === null && <div className="loading-note">Projekte werden geladen…</div>}
        {projects !== null && sorted.length === 0 && <div className="empty-state"><h3>Noch keine Projekte</h3><div>Lege dein erstes Projekt über die Schaltfläche oben an.</div></div>}
        {sorted.map((project) => (
          <article className="project-admin-row" key={project.id}>
            <div className="project-admin-main"><span className={`status-dot ${project.status}`} /><div><strong>{project.name}</strong><div className="meta">{project.kunde || 'Kein Kunde'} · {project.typ}</div></div></div>
            <QuickVersion project={project} />
            <span className={`stamp ${project.status}`}>{STATUS_LABELS[project.status]}</span>
            <div className="project-admin-actions">
              <button className="btn secondary small" onClick={() => setEditingId(project.id)}>Stammdaten</button>
              <button className="btn small" onClick={() => goTo('project', project.id)}>Projekt öffnen</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
