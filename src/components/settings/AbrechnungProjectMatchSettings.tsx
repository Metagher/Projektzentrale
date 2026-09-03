import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { fmtDate } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import AbrechnungForm from '../shared/AbrechnungForm';
import type { Abrechnung } from '../../types/entities';

export default function AbrechnungProjectMatchSettings() {
  const matchAbrechnungenToProjects = useDataStore((s) => s.matchAbrechnungenToProjects);
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const confirm = useModalStore((s) => s.confirm);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ updated: number; unmatched: Abrechnung[] } | null>(null);
  const [editing, setEditing] = useState<Abrechnung | null>(null);

  async function run() {
    const sure = await confirm('Bei allen Abrechnungen mit Kunde ohne Projekt wird das Projekt gesetzt, wenn genau ein Projekt mit diesem Kundennamen existiert. Fortfahren?');
    if (!sure) return;
    setRunning(true);
    const next = await matchAbrechnungenToProjects();
    setResult(next);
    setRunning(false);
  }

  return <section className="card">
    <h3>Kunde → Projekt zuordnen</h3>
    <p className="settings-explanation">
      Setzt bei Abrechnungen mit Kunde, aber ohne Projekt (z. B. aus dem CSV-Import), automatisch das Projekt, sofern genau ein Projekt mit diesem Kundennamen existiert. Danach werden alle Abrechnungen angezeigt, bei denen das nicht möglich war – z. B. weil kein Projekt mit diesem Kundennamen existiert oder der Kundenname mehreren Projekten zugeordnet ist.
    </p>
    <button className="btn" disabled={running} onClick={run}>{running ? 'Ordnet zu…' : 'Jetzt zuordnen'}</button>
    {result && (
      <div className="validation-results" style={{ marginTop: 14 }}>
        <div className="validation-count">{result.updated} Abrechnung{result.updated === 1 ? '' : 'en'} zugeordnet · {result.unmatched.length} ohne eindeutiges Projekt</div>
        {result.unmatched.map((item) => <div className="validation-row" key={item.id}>
          <span className="validation-area">{item.kunde}</span>
          <div><strong>{fmtDate(item.datum)} · {item.art} · {formatEuro(item.wertCents)}</strong><small>{item.bemerkung || item.belegNr || ''}</small></div>
          <button className="btn secondary small" onClick={() => setEditing(item)}>Zuordnen</button>
        </div>)}
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
