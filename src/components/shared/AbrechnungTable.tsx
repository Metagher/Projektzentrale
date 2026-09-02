import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatDuration } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { fmtDate } from '../../lib/format';
import AbrechnungForm from './AbrechnungForm';
import type { Abrechnung, Project } from '../../types/entities';

export default function AbrechnungTable({ project }: { project: Project }) {
  const abrechnungen = useDataStore((s) => s.abrechnungen).filter((item) => item.projectId === project.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const deleteAbrechnung = useDataStore((s) => s.deleteAbrechnung);
  const [editing, setEditing] = useState<Abrechnung | null | 'new'>(null);

  const totals = abrechnungen.reduce((acc, item) => ({
    minutes: acc.minutes + item.minutes,
    wertCents: acc.wertCents + item.wertCents,
    provisionCents: acc.provisionCents + item.provisionCents,
  }), { minutes: 0, wertCents: 0, provisionCents: 0 });
  const offen = abrechnungen.filter((item) => !item.freigegeben);

  return <section className="abrechnung-table">
    <div className="analytics-block-head">
      <div><h3>Abrechnung</h3><p>Leistung, Freigabe, Rechnung und Provision für dieses Projekt.</p></div>
      <button type="button" className="btn small" onClick={() => setEditing('new')}>+ Abrechnung erfassen</button>
    </div>
    {abrechnungen.length > 0 ? <>
      <div className="time-summary-grid">
        <article><span>Stunden</span><strong>{formatDuration(totals.minutes)}</strong></article>
        <article><span>Wert</span><strong>{formatEuro(totals.wertCents)}</strong></article>
        <article><span>Provision</span><strong>{formatEuro(totals.provisionCents)}</strong></article>
        <article><span>Noch nicht freigegeben</span><strong>{offen.length}</strong></article>
      </div>
      <div className="analytics-table-wrap">
        <table className="an-table">
          <thead><tr><th>Datum</th><th>Art</th><th>Stunden</th><th>Wert</th><th>Provision</th><th>Freigabe</th><th>Rechnung</th><th>Gehaltsmonat</th></tr></thead>
          <tbody>
            {abrechnungen.map((item) => <tr key={item.id} className="clickable-row" onClick={() => setEditing(item)}>
              <td>{fmtDate(item.datum)}</td>
              <td>{item.art}</td>
              <td>{formatDuration(item.minutes)}</td>
              <td>{formatEuro(item.wertCents)}</td>
              <td>{formatEuro(item.provisionCents)}</td>
              <td>{item.freigegeben ? <span className="badge freigegeben">freigegeben</span> : <span className="badge offen">offen</span>}</td>
              <td>{item.rechnungsdatum ? fmtDate(item.rechnungsdatum) : '–'}</td>
              <td>{item.gehaltsMonat || '–'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </> : <div className="empty-state"><h3>Noch keine Abrechnung erfasst</h3><div>Erfasse Leistung, Wert und Provision für dieses Projekt.</div></div>}
    {editing && <AbrechnungForm
      entry={editing === 'new' ? undefined : editing}
      fixedProjectId={project.id}
      fixedKunde={project.kunde}
      onSave={async (entry) => { await saveAbrechnung(entry); setEditing(null); }}
      onDelete={editing !== 'new' ? async () => { await deleteAbrechnung((editing as Abrechnung).id); setEditing(null); } : undefined}
      onClose={() => setEditing(null)}
    />}
  </section>;
}
