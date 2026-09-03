import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatDuration } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import { abrechnungStatus, matchesAbrechnungStatusFilter, ABRECHNUNG_STATUS_LABELS, ABRECHNUNG_STATUS_FILTER_OPTIONS } from '../../lib/abrechnungStatus';
import { resolveAbrechnungFilterPreset, sameResolvedFilter, EMPTY_ABRECHNUNG_FILTER } from '../../lib/abrechnungFilterPresets';
import { fmtDate } from '../../lib/format';
import { meaningfulBelegNr } from '../../lib/abrechnungCsv';
import AbrechnungForm from '../shared/AbrechnungForm';
import AbrechnungProvisionChart from './AbrechnungProvisionChart';
import type { Abrechnung } from '../../types/entities';

const STATUS_OPTIONS = ABRECHNUNG_STATUS_FILTER_OPTIONS;

const SECTIONS = [
  { id: 'eintraege', label: 'Einträge' },
  { id: 'gehaltsmonate', label: 'Gehaltsmonate' },
  { id: 'module', label: 'Module' },
  { id: 'diagramm', label: 'Diagramm' },
] as const;

export default function AbrechnungOverview() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]['id']>('eintraege');
  const abrechnungen = useDataStore((s) => s.abrechnungen);
  const projects = useDataStore((s) => s.projects) || [];
  const arten = useDataStore((s) => s.abrechnungsArten);
  const presets = useDataStore((s) => s.abrechnungFilterPresets);
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const deleteAbrechnung = useDataStore((s) => s.deleteAbrechnung);
  const setAbrechnungenAbgeglichen = useDataStore((s) => s.setAbrechnungenAbgeglichen);
  const [editing, setEditing] = useState<Abrechnung | null | 'new'>(null);
  const defaultPreset = presets.find((preset) => preset.isDefault);
  const initialFilter = defaultPreset ? resolveAbrechnungFilterPreset(defaultPreset) : EMPTY_ABRECHNUNG_FILTER;
  const [jahr, setJahr] = useState(initialFilter.jahr);
  const [monat, setMonat] = useState(initialFilter.monat);
  const [kunde, setKunde] = useState('');
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
    .filter((item) => matchesAbrechnungStatusFilter(item, status))
    .sort((a, b) => b.datum.localeCompare(a.datum));

  const totals = filtered.reduce((acc, item) => ({
    minutes: acc.minutes + item.minutes,
    wertCents: acc.wertCents + item.wertCents,
    provisionCents: acc.provisionCents + item.provisionCents,
  }), { minutes: 0, wertCents: 0, provisionCents: 0 });

  const gehaltsMonate = useMemo(() => {
    const map = new Map<string, { minutes: number; provisionCents: number; belege: Map<string, { belegNr: string; provisionCents: number; kunden: Set<string>; ids: string[]; abgeglichenCount: number }> }>();
    abrechnungen.forEach((item) => {
      if (!item.gehaltsMonat) return;
      const current = map.get(item.gehaltsMonat) || { minutes: 0, provisionCents: 0, belege: new Map<string, { belegNr: string; provisionCents: number; kunden: Set<string>; ids: string[]; abgeglichenCount: number }>() };
      current.minutes += item.minutes;
      current.provisionCents += item.provisionCents;
      // Ohne Belegnummer wird je Kunde eine eigene Zeile geführt statt alle Kunden in einer Zeile zusammenzufassen.
      // Platzhalter wie "-" (z. B. aus dem Altexport) zählen dabei als "ohne Belegnummer".
      const normalizedBelegNr = meaningfulBelegNr(item.belegNr);
      const key = normalizedBelegNr || `ohne-beleg:${item.kunde}`;
      const beleg = current.belege.get(key) || { belegNr: normalizedBelegNr || '', provisionCents: 0, kunden: new Set<string>(), ids: [], abgeglichenCount: 0 };
      beleg.provisionCents += item.provisionCents;
      beleg.ids.push(item.id);
      if (item.abgeglichen) beleg.abgeglichenCount += 1;
      if (item.kunde) beleg.kunden.add(item.kunde);
      current.belege.set(key, beleg);
      map.set(item.gehaltsMonat, current);
    });
    return Array.from(map.entries())
      .map(([month, sums]) => [month, {
        minutes: sums.minutes,
        provisionCents: sums.provisionCents,
        items: Array.from(sums.belege.values())
          .map((beleg) => ({
            belegNr: beleg.belegNr,
            provisionCents: beleg.provisionCents,
            kunden: Array.from(beleg.kunden).sort((a, b) => a.localeCompare(b, 'de')),
            ids: beleg.ids,
            abgeglichen: beleg.abgeglichenCount === beleg.ids.length,
            teilweiseAbgeglichen: beleg.abgeglichenCount > 0 && beleg.abgeglichenCount < beleg.ids.length,
          }))
          .sort((a, b) => {
            if (!a.belegNr && !b.belegNr) return a.kunden.join(', ').localeCompare(b.kunden.join(', '), 'de');
            if (!a.belegNr) return -1;
            if (!b.belegNr) return 1;
            return a.belegNr.localeCompare(b.belegNr, 'de', { numeric: true });
          }),
      }] as const)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [abrechnungen]);

  const moduleAuswertung = useMemo(() => {
    const map = new Map<string, { anzahl: number; wertCents: number; provisionCents: number }>();
    abrechnungen.forEach((item) => {
      if (item.art !== 'MODUL' || !item.modul) return;
      const current = map.get(item.modul) || { anzahl: 0, wertCents: 0, provisionCents: 0 };
      current.anzahl += 1;
      current.wertCents += item.wertCents;
      current.provisionCents += item.provisionCents;
      map.set(item.modul, current);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].wertCents - a[1].wertCents);
  }, [abrechnungen]);

  return (
    <section className="abrechnung-overview">
      <div className="analytics-block-head">
        <div className="analytics-section-intro" style={{ marginBottom: 0 }}>
          <div className="analytics-scope-label">Provisions- und Rechnungscontrolling</div>
          <h3>Abrechnung</h3>
          <p>Leistung, Freigabe zur Rechnungsstellung, Rechnungsdatum und Provision – projekt- oder kundenbezogen, unabhängig von Excel.</p>
        </div>
        <button type="button" className="btn small" onClick={() => setEditing('new')}>+ Abrechnung erfassen</button>
      </div>
      <div className="analytics-subtabs" role="tablist" aria-label="Bereich der Abrechnung">
        {SECTIONS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={section === tab.id} className={`analytics-subtab${section === tab.id ? ' active' : ''}`} onClick={() => setSection(tab.id)}>{tab.label}</button>)}
      </div>
      {section === 'eintraege' && <>
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
      </>}
      {section === 'gehaltsmonate' && (
        gehaltsMonate.length > 0 ? (
          <div className="analytics-table-wrap">
            <table className="an-table">
              <thead><tr><th>Gehaltsmonat</th><th>Stunden</th><th>Provision</th><th>Belegnummer → Provision</th></tr></thead>
              <tbody>
                {gehaltsMonate.map(([month, sums]) => <tr key={month}>
                  <td>{formatGehaltsMonat(month)}</td>
                  <td>{formatDuration(sums.minutes)}</td>
                  <td>{formatEuro(sums.provisionCents)}</td>
                  <td>{sums.items.length ? (
                    <ul className="belegnr-list">
                      {sums.items.map((item) => <li key={`${item.belegNr}|${item.kunden.join(',')}`} className={item.abgeglichen ? 'done' : undefined}>
                        <input
                          type="checkbox"
                          checked={item.abgeglichen}
                          ref={(el) => { if (el) el.indeterminate = item.teilweiseAbgeglichen; }}
                          onChange={() => setAbrechnungenAbgeglichen(item.ids, !item.abgeglichen)}
                          title="Mit Gehaltsabrechnung abgeglichen"
                        />
                        <span className="belegnr-num">{item.belegNr || '–'}</span>
                        <span className="belegnr-amount">{formatEuro(item.provisionCents)}</span>
                        <small>{item.kunden.join(', ')}</small>
                      </li>)}
                    </ul>
                  ) : '–'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><h3>Keine Gehaltsmonate</h3><div>Sobald ein Rechnungsdatum eingetragen wird, erscheint hier der zugehörige Gehaltsmonat.</div></div>
        )
      )}
      {section === 'module' && (
        moduleAuswertung.length > 0 ? (
          <div className="analytics-table-wrap">
            <table className="an-table">
              <thead><tr><th>Modul</th><th>Anzahl</th><th>Wert</th><th>Provision</th></tr></thead>
              <tbody>
                {moduleAuswertung.map(([name, sums]) => <tr key={name}>
                  <td>{name}</td>
                  <td>{sums.anzahl}</td>
                  <td>{formatEuro(sums.wertCents)}</td>
                  <td>{formatEuro(sums.provisionCents)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><h3>Keine Modulverkäufe</h3><div>Sobald eine Abrechnung mit Art „MODUL“ ein Modul hinterlegt hat, erscheint hier die Auswertung.</div></div>
        )
      )}
      {section === 'diagramm' && <AbrechnungProvisionChart abrechnungen={abrechnungen} />}
      {editing && <AbrechnungForm
        entry={editing === 'new' ? undefined : editing}
        onSave={async (entry) => { await saveAbrechnung(entry); setEditing(null); }}
        onDelete={editing !== 'new' ? async () => { await deleteAbrechnung((editing as Abrechnung).id); setEditing(null); } : undefined}
        onClose={() => setEditing(null)}
      />}
    </section>
  );
}
