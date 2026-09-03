import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatDuration } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import { abrechnungStatus, ABRECHNUNG_STATUS_LABELS, ABRECHNUNG_STATUS_FILTER_OPTIONS } from '../../lib/abrechnungStatus';
import { resolveAbrechnungFilterPreset, sameResolvedFilter, EMPTY_ABRECHNUNG_FILTER } from '../../lib/abrechnungFilterPresets';
import { fmtDate } from '../../lib/format';
import AbrechnungForm from './AbrechnungForm';
import type { Abrechnung, Project } from '../../types/entities';

const STATUS_OPTIONS = ABRECHNUNG_STATUS_FILTER_OPTIONS;

export default function AbrechnungTable({ project }: { project: Project }) {
  const alle = useDataStore((s) => s.abrechnungen).filter((item) => item.projectId === project.id);
  const arten = useDataStore((s) => s.abrechnungsArten);
  const presets = useDataStore((s) => s.abrechnungFilterPresets);
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const deleteAbrechnung = useDataStore((s) => s.deleteAbrechnung);
  const [editing, setEditing] = useState<Abrechnung | null | 'new'>(null);
  const defaultPreset = presets.find((preset) => preset.isDefault);
  const initialFilter = defaultPreset ? resolveAbrechnungFilterPreset(defaultPreset) : EMPTY_ABRECHNUNG_FILTER;
  const [jahr, setJahr] = useState(initialFilter.jahr);
  const [monat, setMonat] = useState(initialFilter.monat);
  const [art, setArt] = useState(initialFilter.art);
  const [gehaltsMonatFilter, setGehaltsMonatFilter] = useState(initialFilter.gehaltsMonat);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]['id']>(initialFilter.status);

  function togglePreset(presetId: string) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    const resolved = resolveAbrechnungFilterPreset(preset);
    const active = sameResolvedFilter(resolved, { jahr, monat, art, gehaltsMonat: gehaltsMonatFilter, status });
    const next = active ? EMPTY_ABRECHNUNG_FILTER : resolved;
    setJahr(next.jahr);
    setMonat(next.monat);
    setArt(next.art);
    setGehaltsMonatFilter(next.gehaltsMonat);
    setStatus(next.status);
  }

  const jahre = useMemo(() => Array.from(new Set(alle.map((item) => item.datum.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [alle]);
  const gehaltsMonatOptionen = useMemo(() => Array.from(new Set(alle.map((item) => item.gehaltsMonat).filter((value): value is string => !!value))).sort((a, b) => b.localeCompare(a)), [alle]);

  const abrechnungen = alle
    .filter((item) => !jahr || item.datum.slice(0, 4) === jahr)
    .filter((item) => !monat || item.datum.slice(5, 7) === monat)
    .filter((item) => !art || item.art === art)
    .filter((item) => !gehaltsMonatFilter || item.gehaltsMonat === gehaltsMonatFilter)
    .filter((item) => status === 'alle' || abrechnungStatus(item) === status)
    .sort((a, b) => b.datum.localeCompare(a.datum));

  const totals = abrechnungen.reduce((acc, item) => ({
    minutes: acc.minutes + item.minutes,
    wertCents: acc.wertCents + item.wertCents,
    provisionCents: acc.provisionCents + item.provisionCents,
  }), { minutes: 0, wertCents: 0, provisionCents: 0 });
  const wartetAufFreigabe = abrechnungen.filter((item) => abrechnungStatus(item) === 'offen').length;
  const wartetAufRechnung = abrechnungen.filter((item) => abrechnungStatus(item) === 'freigegeben').length;

  return <section className="abrechnung-table">
    <div className="analytics-block-head">
      <div><h3>Abrechnung</h3><p>Leistung, Freigabe, Rechnung und Provision für dieses Projekt.</p></div>
      <button type="button" className="btn small" onClick={() => setEditing('new')}>+ Abrechnung erfassen</button>
    </div>
    {alle.length > 0 ? <>
      {presets.length > 0 && (
        <div className="abrechnung-preset-filter">
          {presets.map((preset) => <button key={preset.id} type="button" className={`btn secondary small${sameResolvedFilter(resolveAbrechnungFilterPreset(preset), { jahr, monat, art, gehaltsMonat: gehaltsMonatFilter, status }) ? ' active' : ''}`} onClick={() => togglePreset(preset.id)}>{preset.name}</button>)}
        </div>
      )}
      <div className="abrechnung-filters">
        <select value={jahr} onChange={(event) => setJahr(event.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select value={monat} onChange={(event) => setMonat(event.target.value)}>
          <option value="">Alle Monate</option>
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((m) => <option key={m} value={m}>{m}</option>)}
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
      </div>
      <div className="time-summary-grid">
        <article><span>Stunden</span><strong>{formatDuration(totals.minutes)}</strong></article>
        <article><span>Wert</span><strong>{formatEuro(totals.wertCents)}</strong></article>
        <article><span>Provision</span><strong>{formatEuro(totals.provisionCents)}</strong></article>
        <article><span>Wartet auf Freigabe</span><strong>{wartetAufFreigabe}</strong></article>
        <article><span>Freigegeben, noch nicht abgerechnet</span><strong>{wartetAufRechnung}</strong></article>
      </div>
      {abrechnungen.length > 0 ? (
        <div className="analytics-table-wrap">
          <table className="an-table">
            <thead><tr><th>Datum</th><th>Art</th><th>Stunden</th><th>Wert</th><th>Provision</th><th>Status</th><th>Rechnung</th><th>Gehaltsmonat</th></tr></thead>
            <tbody>
              {abrechnungen.map((item) => <tr key={item.id} className="clickable-row" onClick={() => setEditing(item)}>
                <td>{fmtDate(item.datum)}</td>
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
