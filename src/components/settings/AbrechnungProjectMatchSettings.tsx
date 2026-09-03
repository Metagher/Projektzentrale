import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { fmtDate } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import AbrechnungForm from '../shared/AbrechnungForm';
import type { Abrechnung } from '../../types/entities';

export default function AbrechnungProjectMatchSettings() {
  const projects = useDataStore((s) => s.projects) || [];
  const matchAbrechnungenToProjects = useDataStore((s) => s.matchAbrechnungenToProjects);
  const assignAbrechnungenToProject = useDataStore((s) => s.assignAbrechnungenToProject);
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const confirm = useModalStore((s) => s.confirm);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ updated: number; unmatched: Abrechnung[] } | null>(null);
  const [editing, setEditing] = useState<Abrechnung | null>(null);
  const [groupProjectChoice, setGroupProjectChoice] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, Abrechnung[]>();
    result.unmatched.forEach((item) => {
      const key = item.kunde.trim() || '(ohne Kunde)';
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries())
      .map(([kunde, items]) => ({ kunde, items: items.sort((a, b) => a.datum.localeCompare(b.datum)), wertCents: items.reduce((sum, item) => sum + item.wertCents, 0) }))
      .sort((a, b) => a.kunde.localeCompare(b.kunde, 'de'));
  }, [result]);

  async function run() {
    const sure = await confirm('Bei allen Abrechnungen mit Kunde ohne Projekt wird das Projekt gesetzt, wenn genau ein Projekt mit diesem Kundennamen existiert. Fortfahren?');
    if (!sure) return;
    setRunning(true);
    const next = await matchAbrechnungenToProjects();
    setResult(next);
    setRunning(false);
  }

  async function assignGroup(kunde: string, ids: string[]) {
    const projectId = groupProjectChoice[kunde];
    if (!projectId) return;
    const project = projects.find((item) => item.id === projectId);
    const sure = await confirm(`${ids.length} Abrechnung${ids.length === 1 ? '' : 'en'} von „${kunde}“ dem Projekt „${project?.name}“ zuordnen?`);
    if (!sure) return;
    await assignAbrechnungenToProject(ids, projectId);
    setResult((current) => current ? { ...current, updated: current.updated + ids.length, unmatched: current.unmatched.filter((item) => !ids.includes(item.id)) } : current);
  }

  return <section className="card">
    <h3>Kunde → Projekt zuordnen</h3>
    <p className="settings-explanation">
      Setzt bei Abrechnungen mit Kunde, aber ohne Projekt (z. B. aus dem CSV-Import), automatisch das Projekt, sofern genau ein Projekt mit diesem Kundennamen existiert. Danach werden alle Abrechnungen gruppiert nach Kunde angezeigt, bei denen das nicht möglich war – z. B. weil kein Projekt mit diesem Kundennamen existiert oder der Kundenname mehreren Projekten zugeordnet ist. Für jeden Kunden lässt sich ein Projekt auswählen und allen zugehörigen Abrechnungen auf einmal zuweisen.
    </p>
    <button className="btn" disabled={running} onClick={run}>{running ? 'Ordnet zu…' : 'Jetzt zuordnen'}</button>
    {result && (
      <div className="validation-results" style={{ marginTop: 14 }}>
        <div className="validation-count">{result.updated} Abrechnung{result.updated === 1 ? '' : 'en'} zugeordnet · {result.unmatched.length} ohne eindeutiges Projekt</div>
        {groups.map((group) => {
          const ids = group.items.map((item) => item.id);
          return <div className="kunde-project-group" key={group.kunde}>
            <div className="kunde-project-group-head">
              <div><strong>{group.kunde}</strong><small>{group.items.length} Abrechnung{group.items.length === 1 ? '' : 'en'} · {formatEuro(group.wertCents)}</small></div>
              <div className="kunde-project-group-assign">
                <select value={groupProjectChoice[group.kunde] || ''} onChange={(event) => setGroupProjectChoice((current) => ({ ...current, [group.kunde]: event.target.value }))}>
                  <option value="">— Projekt auswählen —</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                <button className="btn secondary small" disabled={!groupProjectChoice[group.kunde]} onClick={() => assignGroup(group.kunde, ids)}>Allen zuweisen</button>
              </div>
            </div>
            {group.items.map((item) => <div className="validation-row" key={item.id}>
              <span className="validation-area">{item.kunde}</span>
              <div><strong>{fmtDate(item.datum)} · {item.art} · {formatEuro(item.wertCents)}</strong><small>{item.bemerkung || item.belegNr || ''}</small></div>
              <button className="btn secondary small" onClick={() => setEditing(item)}>Zuordnen</button>
            </div>)}
          </div>;
        })}
      </div>
    )}
    {editing && <AbrechnungForm
      entry={editing}
      onSave={async (entry) => {
        await saveAbrechnung(entry);
        setEditing(null);
        setResult((current) => current ? { ...current, unmatched: current.unmatched.filter((item) => item.id !== entry.id) } : current);
      }}
      onClose={() => setEditing(null)}
    />}
  </section>;
}
