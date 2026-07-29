import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useUiStore } from '../../../store/uiStore';
import { useModalStore } from '../../../store/modalStore';
import RtfField from '../../shared/RtfField';
import type { Project, ProjectStatus, ProjectTyp } from '../../../types/entities';

export default function UebersichtTab({ project }: { project: Project }) {
  const updateProject = useDataStore((s) => s.updateProject);
  const deleteProject = useDataStore((s) => s.deleteProject);
  const goTo = useUiStore((s) => s.goTo);
  const confirm = useModalStore((s) => s.confirm);

  const [name, setName] = useState(project.name);
  const [kunde, setKunde] = useState(project.kunde || '');
  const [typ, setTyp] = useState<ProjectTyp>(project.typ);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [beschreibung, setBeschreibung] = useState(project.beschreibung || '');

  async function handleSave() {
    await updateProject(project.id, {
      name: name.trim() || project.name,
      kunde: kunde.trim(),
      typ,
      status,
      beschreibung,
    });
  }

  async function handleDelete() {
    const sure = await confirm(
      `Projekt "${project.name}" wirklich unwiderruflich löschen? Alle zugehörigen Daten (Ansprechpartner, Kommunikation, Dokumentation, Aufgaben) gehen verloren.`,
    );
    if (!sure) return;
    await deleteProject(project.id);
    goTo('dashboard');
  }

  return (
    <div className="card">
      <div className="field-grid">
        <div className="field">
          <label>Projektname</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Kunde</label>
          <input value={kunde} onChange={(e) => setKunde(e.target.value)} />
        </div>
        <div className="field">
          <label>Typ</label>
          <select value={typ} onChange={(e) => setTyp(e.target.value as ProjectTyp)}>
            <option value="Neukunde">Neukunde</option>
            <option value="Bestandskunde">Bestandskunde</option>
            <option value="Bestandskunde mit Echtläufen">Bestandskunde mit Echtläufen</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            <option value="aktiv">Aktiv</option>
            <option value="pausiert">Pausiert</option>
            <option value="abgeschlossen">Abgeschlossen</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Kurzbeschreibung</label>
        <RtfField
          value={beschreibung}
          onChange={setBeschreibung}
          title="Kurzbeschreibung"
          placeholder="Klicken, um eine Kurzbeschreibung zu erfassen…"
        />
      </div>
      <div className="btn-row">
        <button className="btn" onClick={handleSave}>
          Speichern
        </button>
        <button className="btn danger" onClick={handleDelete}>
          Projekt löschen
        </button>
      </div>
    </div>
  );
}
