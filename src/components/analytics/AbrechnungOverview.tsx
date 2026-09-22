import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatDuration } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import { abrechnungStatus, matchesAbrechnungStatusFilter, ABRECHNUNG_STATUS_LABELS, ABRECHNUNG_STATUS_FILTER_OPTIONS } from '../../lib/abrechnungStatus';
import { resolveAbrechnungFilterPreset, sameResolvedFilter, EMPTY_ABRECHNUNG_FILTER } from '../../lib/abrechnungFilterPresets';
import { fmtDate } from '../../lib/format';
import AbrechnungForm from '../shared/AbrechnungForm';
import AbrechnungGehaltsmonateSection from './AbrechnungGehaltsmonateSection';
import AbrechnungProvisionChart from './AbrechnungProvisionChart';
import AbrechnungArtPieChart from './AbrechnungArtPieChart';
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
  const setAbrechnungenRechnung = useDataStore((s) => s.setAbrechnungenRechnung);
  const [editing, setEditing] = useState<Abrechnung | null | 'new'>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchRechnungsdatum, setBatchRechnungsdatum] = useState('');
  const [batchBelegNr, setBatchBelegNr] = useState('');
  const [applyingBatch, setApplyingBatch] = useState(false);
  const defaultPreset = presets.find((preset) => preset.isDefault);
  const initialFilter = defaultPreset ? resolveAbrechnungFilterPreset(defaultPreset) : EMPTY_ABRECHNUNG_FILTER;
  const [jahr, setJahr] = useState(initialFilter.jahr);
  const [monat, setMonat] = useState(initialFilter.monat);
  const [kunde, setKunde] = useState('');
  const [art, setArt] = useState(initialFilter.art);
  const [gehaltsMonatFilter, setGehaltsMonatFilter] = useState(initialFilter.gehaltsMonat);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]['id']>(initialFilter.status);
  const [sortBy, setSortBy] = useState<'datum' | 'kunde'>('datum');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(column: 'datum' | 'kunde') {
    if (sortBy === column) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(column); setSortDir(column === 'datum' ? 'desc' : 'asc'); }
  }

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

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((current) => {
      const allSelected = filtered.length > 0 && filtered.every((item) => current.has(item.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((item) => item.id));
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBatchRechnungsdatum('');
    setBatchBelegNr('');
  }

  async function applyBatch() {
    if (!batchRechnungsdatum || selectedIds.size === 0 || applyingBatch) return;
    setApplyingBatch(true);
    await setAbrechnungenRechnung(Array.from(selectedIds), { rechnungsdatum: batchRechnungsdatum, belegNr: batchBelegNr });
    setApplyingBatch(false);
    clearSelection();
  }

  const projectName = new Map(projects.map((project) => [project.id, project.name]));
  const kundeProjektLabel = (item: Abrechnung) => `${item.kunde}${item.projectId && projectName.get(item.projectId) ? ` · ${projectName.get(item.projectId)}` : ''}`;
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
    .sort((a, b) => {
      const cmp = sortBy === 'kunde' ? kundeProjektLabel(a).localeCompare(kundeProjektLabel(b), 'de') : a.datum.localeCompare(b.datum);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const selectedKunden = useMemo(
    () => Array.from(new Set(abrechnungen.filter((item) => selectedIds.has(item.id)).map((item) => item.kunde).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de')),
    [abrechnungen, selectedIds]
  );

  const totals = filtered.reduce((acc, item) => ({
    minutes: acc.minutes + item.minutes,
    wertCents: acc.wertCents + item.wertCents,
    provisionCents: acc.provisionCents + item.provisionCents,
  }), { minutes: 0, wertCents: 0, provisionCents: 0 });

  const moduleVerkaeufe = useMemo(() => abrechnungen.filter((item) => item.art === 'MODUL' && item.modul), [abrechnungen]);
  const moduleKunden = useMemo(() => Array.from(new Set(moduleVerkaeufe.map((item) => item.kunde).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de')), [moduleVerkaeufe]);
  const moduleJahre = useMemo(() => Array.from(new Set(moduleVerkaeufe.map((item) => item.datum.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [moduleVerkaeufe]);
  const [moduleJahr, setModuleJahr] = useState('');
  const [moduleKunde, setModuleKunde] = useState('');

  const moduleAuswertung = useMemo(() => {
    const map = new Map<string, { anzahl: number; wertCents: number; provisionCents: number }>();
    moduleVerkaeufe
      .filter((item) => !moduleJahr || item.datum.slice(0, 4) === moduleJahr)
      .filter((item) => !moduleKunde || item.kunde === moduleKunde)
      .forEach((item) => {
        const current = map.get(item.modul!) || { anzahl: 0, wertCents: 0, provisionCents: 0 };
        current.anzahl += 1;
        current.wertCents += item.wertCents;
        current.provisionCents += item.provisionCents;
        map.set(item.modul!, current);
      });
    return Array.from(map.entries()).sort((a, b) => b[1].wertCents - a[1].wertCents);
  }, [moduleVerkaeufe, moduleJahr, moduleKunde]);

  const moduleTotals = moduleAuswertung.reduce((acc, [, sums]) => ({
    anzahl: acc.anzahl + sums.anzahl,
    wertCents: acc.wertCents + sums.wertCents,
    provisionCents: acc.provisionCents + sums.provisionCents,
  }), { anzahl: 0, wertCents: 0, provisionCents: 0 });

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
        {selectedIds.size > 0 && (
          <div className="abrechnung-batch-bar">
            <span>{selectedIds.size} Einträge ausgewählt{selectedKunden.length > 1 ? ` · ${selectedKunden.length} Kunden` : selectedKunden.length === 1 ? ` · ${selectedKunden[0]}` : ''}</span>
            <div className="field"><label>Rechnungsdatum</label><input type="date" value={batchRechnungsdatum} onChange={(event) => setBatchRechnungsdatum(event.target.value)} /></div>
            <div className="field"><label>Belegnummer</label><input value={batchBelegNr} onChange={(event) => setBatchBelegNr(event.target.value)} placeholder="Optional" /></div>
            <button type="button" className="btn small" disabled={!batchRechnungsdatum || applyingBatch} onClick={applyBatch}>{applyingBatch ? 'Speichert…' : 'Übernehmen'}</button>
            <button type="button" className="btn secondary small" onClick={clearSelection}>Auswahl aufheben</button>
          </div>
        )}
        {filtered.length > 0 ? (
          <div className="analytics-table-wrap">
            <table className="an-table an-table-selectable">
              <thead><tr><th><input type="checkbox" checked={filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id))} onChange={toggleSelectAllFiltered} /></th><th className="sortable-col" onClick={() => toggleSort('datum')}>Datum{sortBy === 'datum' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th><th className="sortable-col" onClick={() => toggleSort('kunde')}>Kunde / Projekt{sortBy === 'kunde' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th><th>Art</th><th>Stunden</th><th>Wert</th><th>Provision</th><th>Status</th><th>Rechnung</th><th>Gehaltsmonat</th></tr></thead>
              <tbody>
                {filtered.map((item) => <tr key={item.id} className={`clickable-row${selectedIds.has(item.id) ? ' selected' : ''}`} onClick={() => setEditing(item)}>
                  <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} /></td>
                  <td>{fmtDate(item.datum)}</td>
                  <td>{kundeProjektLabel(item)}</td>
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
      {section === 'gehaltsmonate' && <AbrechnungGehaltsmonateSection abrechnungen={abrechnungen} />}
      {section === 'module' && <>
        <div className="abrechnung-filters">
          <select value={moduleJahr} onChange={(event) => setModuleJahr(event.target.value)}>
            <option value="">Alle Jahre</option>
            {moduleJahre.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select value={moduleKunde} onChange={(event) => setModuleKunde(event.target.value)}>
            <option value="">Alle Kunden</option>
            {moduleKunden.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {moduleAuswertung.length > 0 ? (
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
              <tfoot>
                <tr>
                  <th>Summe</th>
                  <th>{moduleTotals.anzahl}</th>
                  <th>{formatEuro(moduleTotals.wertCents)}</th>
                  <th>{formatEuro(moduleTotals.provisionCents)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state"><h3>Keine Modulverkäufe</h3><div>Sobald eine Abrechnung mit Art „MODUL“ ein Modul hinterlegt hat, erscheint hier die Auswertung.</div></div>
        )}
      </>}
      {section === 'diagramm' && <>
        <AbrechnungProvisionChart abrechnungen={abrechnungen} basis="leistungsdatum" />
        <AbrechnungProvisionChart abrechnungen={abrechnungen} basis="gehaltsmonat" />
        <AbrechnungArtPieChart abrechnungen={abrechnungen} />
      </>}
      {editing && <AbrechnungForm
        entry={editing === 'new' ? undefined : editing}
        onSave={async (entry) => { await saveAbrechnung(entry); setEditing(null); }}
        onDelete={editing !== 'new' ? async () => { await deleteAbrechnung((editing as Abrechnung).id); setEditing(null); } : undefined}
        onClose={() => setEditing(null)}
      />}
    </section>
  );
}
