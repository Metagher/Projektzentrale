import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatDuration } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import { abrechnungStatus, ABRECHNUNG_STATUS_LABELS } from '../../lib/abrechnungStatus';
import { fmtDate } from '../../lib/format';
import AbrechnungForm from '../shared/AbrechnungForm';
import type { Abrechnung } from '../../types/entities';

const STATUS_OPTIONS = [
  { id: 'alle', label: 'Alle' },
  { id: 'offen', label: 'Nur offene' },
  { id: 'freigegeben', label: 'Nur freigegeben' },
  { id: 'abgerechnet', label: 'Nur abgerechnet' },
] as const;

export default function AbrechnungOverview() {
  const abrechnungen = useDataStore((s) => s.abrechnungen);
  const projects = useDataStore((s) => s.projects) || [];
  const arten = useDataStore((s) => s.abrechnungsArten);
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const deleteAbrechnung = useDataStore((s) => s.deleteAbrechnung);
  const [editing, setEditing] = useState<Abrechnung | null | 'new'>(null);
  const [jahr, setJahr] = useState('');
  const [monat, setMonat] = useState('');
  const [kunde, setKunde] = useState('');
  const [art, setArt] = useState('');
  const [gehaltsMonatFilter, setGehaltsMonatFilter] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]['id']>('alle');

  const projectName = new Map(projects.map((project) => [project.id, project.name]));
  const kunden = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.kunde).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de')), [abrechnungen]);
  const jahre = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.datum.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [abrechnungen]);
  const gehaltsMonatOptionen = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.gehaltsMonat).filter((value): value is string => !!value))).sort((a, b) => b.localeCompare(a)), [abrechnungen]);

  const filtered = abrechnungen
    .filter((item) => !jahr || item.datum.slice(0, 4) === jahr)
    .filter((item) => !monat || item.datum.slice(5, 7) === monat)
    .filter((item) => !kunde || item.kunde === kunde)
    .filter((item) => !art || item.art === art)
    .filter((item) => !gehaltsMonatFilter || item.gehaltsMonat === gehaltsMonatFilter)
    .filter((item) => status === 'alle' || abrechnungStatus(item) === status)
    .sort((a, b) => b.datum.localeCompare(a.datum));

  const totals = filtered.reduce((acc, item) => ({
    minutes: acc.minutes + item.minutes,
    wertCents: acc.wertCents + item.wertCents,
    provisionCents: acc.provisionCents + item.provisionCents,
  }), { minutes: 0, wertCents: 0, provisionCents: 0 });

  const gehaltsMonate = useMemo(() => {
    const map = new Map<string, { minutes: number; provisionCents: number; belege: Map<string, { provisionCents: number; kunden: Set<string> }> }>();
    abrechnungen.forEach((item) => {
      if (!item.gehaltsMonat) return;
      const current = map.get(item.gehaltsMonat) || { minutes: 0, provisionCents: 0, belege: new Map<string, { provisionCents: number; kunden: Set<string> }>() };
      current.minutes += item.minutes;
      current.provisionCents += item.provisionCents;
      if (item.belegNr) {
        const beleg = current.belege.get(item.belegNr) || { provisionCents: 0, kunden: new Set<string>() };
        beleg.provisionCents += item.provisionCents;
        if (item.kunde) beleg.kunden.add(item.kunde);
        current.belege.set(item.belegNr, beleg);
      }
      map.set(item.gehaltsMonat, current);
    });
    return Array.from(map.entries())
      .map(([month, sums]) => [month, {
        minutes: sums.minutes,
        provisionCents: sums.provisionCents,
        items: Array.from(sums.belege.entries())
          .map(([belegNr, beleg]) => ({ belegNr, provisionCents: beleg.provisionCents, kunden: Array.from(beleg.kunden).sort((a, b) => a.localeCompare(b, 'de')) }))
          .sort((a, b) => a.belegNr.localeCompare(b.belegNr, 'de', { numeric: true })),
      }] as const)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [abrechnungen]);

  return (
    <section className="abrechnung-overview">
      <div className="analytics-section-intro">
        <div className="analytics-scope-label">Provisions- und Rechnungscontrolling</div>
        <h3>Abrechnung</h3>
        <p>Leistung, Freigabe zur Rechnungsstellung, Rechnungsdatum und Provision – projekt- oder kundenbezogen, unabhängig von Excel.</p>
      </div>
      <div className="abrechnung-filters">
        <select value={jahr} onChange={(event) => setJahr(event.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select value={monat} onChange={(event) => setMonat(event.target.value)}>
          <option value="">Alle Monate</option>
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={kunde} onChange={(event) => setKunde(event.target.value)}>
          <option value="">Alle Kunden</option>
          {kunden.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={art} onChange={(event) => setArt(event.target.value)}>
          <option value="">Alle Arten</option>
          {arten.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={gehaltsMonatFilter} onChange={(event) => setGehaltsMonatFilter(event.target.value)}>
          <option value="">Alle Gehaltsmonate</option>
          {gehaltsMonatOptionen.map((value) => <option key={value} value={value}>{formatGehaltsMonat(value)}</option>)}
        </select>
        <div className="abrechnung-freigabe-filter">
          {STATUS_OPTIONS.map((option) => <button key={option.id} type="button" className={`btn secondary small${status === option.id ? ' active' : ''}`} onClick={() => setStatus(option.id)}>{option.label}</button>)}
        </div>
        <button type="button" className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setEditing('new')}>+ Abrechnung erfassen</button>
      </div>
      <div className="time-summary-grid">
        <article><span>Stunden</span><strong>{formatDuration(totals.minutes)}</strong></article>
        <article><span>Wert</span><strong>{formatEuro(totals.wertCents)}</strong></article>
        <article><span>Provision</span><strong>{formatEuro(totals.provisionCents)}</strong></article>
        <article><span>Einträge</span><strong>{filtered.length}</strong></article>
      </div>
      {filtered.length > 0 ? (
        <div className="analytics-table-wrap">
          <table className="an-table">
            <thead><tr><th>Datum</th><th>Kunde / Projekt</th><th>Art</th><th>Stunden</th><th>Wert</th><th>Provision</th><th>Status</th><th>Rechnung</th><th>Gehaltsmonat</th></tr></thead>
            <tbody>
              {filtered.map((item) => <tr key={item.id} className="clickable-row" onClick={() => setEditing(item)}>
                <td>{fmtDate(item.datum)}</td>
                <td>{item.kunde}{item.projectId && projectName.get(item.projectId) ? ` · ${projectName.get(item.projectId)}` : ''}</td>
                <td>{item.art}</td>
                <td>{formatDuration(item.minutes)}</td>
                <td>{formatEuro(item.wertCents)}</td>
                <td>{formatEuro(item.provisionCents)}</td>
                <td><span className={`badge ${abrechnungStatus(item)}`}>{ABRECHNUNG_STATUS_LABELS[abrechnungStatus(item)]}</span></td>
                <td>{item.rechnungsdatum ? fmtDate(item.rechnungsdatum) : '–'}</td>
                <td>{formatGehaltsMonat(item.gehaltsMonat) || '–'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state"><h3>Keine Abrechnungen für diese Filter</h3><div>Passe die Filter an oder erfasse einen neuen Eintrag.</div></div>
      )}
      {gehaltsMonate.length > 0 && (
        <div className="analytics-table-wrap" style={{ marginTop: 20 }}>
          <table className="an-table">
            <thead><tr><th>Gehaltsmonat</th><th>Stunden</th><th>Provision</th><th>Belegnummer → Provision</th></tr></thead>
            <tbody>
              {gehaltsMonate.map(([month, sums]) => <tr key={month}>
                <td>{formatGehaltsMonat(month)}</td>
                <td>{formatDuration(sums.minutes)}</td>
                <td>{formatEuro(sums.provisionCents)}</td>
                <td>{sums.items.length ? (
                  <ul className="belegnr-list">
                    {sums.items.map((item) => <li key={item.belegNr}><span>{item.belegNr}</span><span>{formatEuro(item.provisionCents)}</span><small>{item.kunden.join(', ')}</small></li>)}
                  </ul>
                ) : '–'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      {editing && <AbrechnungForm
        entry={editing === 'new' ? undefined : editing}
        onSave={async (entry) => { await saveAbrechnung(entry); setEditing(null); }}
        onDelete={editing !== 'new' ? async () => { await deleteAbrechnung((editing as Abrechnung).id); setEditing(null); } : undefined}
        onClose={() => setEditing(null)}
      />}
    </section>
  );
}
