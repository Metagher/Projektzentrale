import { useEffect, useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { uid } from '../../lib/format';
import { ABRECHNUNG_STATUS_FILTER_OPTIONS } from '../../lib/abrechnungStatus';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import type { AbrechnungFilterPreset } from '../../lib/abrechnungFilterPresets';

const MAX_PRESETS = 3;

export default function AbrechnungFilterPresetSettings() {
  const presets = useDataStore((s) => s.abrechnungFilterPresets);
  const arten = useDataStore((s) => s.abrechnungsArten);
  const abrechnungen = useDataStore((s) => s.abrechnungen);
  const savePresets = useDataStore((s) => s.saveAbrechnungFilterPresets);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setNameDrafts(Object.fromEntries(presets.map((preset) => [preset.id, preset.name])));
  }, [presets]);

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentGehaltsMonat = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const jahre = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.datum.slice(0, 4)))).filter((year) => year !== currentYear).sort((a, b) => b.localeCompare(a)), [abrechnungen, currentYear]);
  const gehaltsMonate = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.gehaltsMonat).filter((value): value is string => !!value))).filter((value) => value !== currentGehaltsMonat).sort((a, b) => b.localeCompare(a)), [abrechnungen, currentGehaltsMonat]);

  function update(id: string, patch: Partial<AbrechnungFilterPreset>) {
    savePresets(presets.map((preset) => (preset.id === id ? { ...preset, ...patch } : preset)));
  }

  function commitName(id: string) {
    const name = (nameDrafts[id] ?? '').trim() || 'Filter';
    update(id, { name });
  }

  function addPreset() {
    if (presets.length >= MAX_PRESETS) return;
    const preset: AbrechnungFilterPreset = { id: uid(), name: `Filter ${presets.length + 1}`, jahr: '', monat: '', art: '', gehaltsMonat: '', status: 'alle', isDefault: presets.length === 0 };
    savePresets([...presets, preset]);
  }

  function removePreset(id: string) {
    savePresets(presets.filter((preset) => preset.id !== id));
  }

  return <section className="card">
    <h3>Standardfilter Abrechnung</h3>
    <p className="settings-explanation">
      Bis zu {MAX_PRESETS} Filter-Presets für die Abrechnungsseiten (Projekt und Global), dort per Klick an- und abwählbar. Jahr, Monat und Gehaltsmonat können auf „aktuell“ stehen, damit sich der Filter immer auf den laufenden Zeitraum bezieht statt auf einen festen Wert. Ein Preset ist als Standard markiert und wird beim Öffnen der Seite direkt angewendet.
    </p>
    <div className="abrechnungsarten-list">
      {presets.map((preset) => <div key={preset.id} className="abrechnung-filter-preset-row">
        <input value={nameDrafts[preset.id] ?? ''} placeholder="Name" onChange={(event) => setNameDrafts((current) => ({ ...current, [preset.id]: event.target.value }))} onBlur={() => commitName(preset.id)} />
        <select value={preset.jahr} onChange={(event) => update(preset.id, { jahr: event.target.value })}>
          <option value="">Alle Jahre</option>
          <option value="aktuell">Aktuelles Jahr</option>
          <option value={currentYear}>{currentYear} (fest)</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select value={preset.monat} onChange={(event) => update(preset.id, { monat: event.target.value })}>
          <option value="">Alle Monate</option>
          <option value="aktuell">Aktueller Monat</option>
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((month) => <option key={month} value={month}>{month}</option>)}
        </select>
        <select value={preset.art} onChange={(event) => update(preset.id, { art: event.target.value })}>
          <option value="">Alle Arten</option>
          {arten.map((art) => <option key={art} value={art}>{art}</option>)}
        </select>
        <select value={preset.gehaltsMonat} onChange={(event) => update(preset.id, { gehaltsMonat: event.target.value })}>
          <option value="">Alle Gehaltsmonate</option>
          <option value="aktuell">Aktueller Gehaltsmonat</option>
          <option value={currentGehaltsMonat}>{formatGehaltsMonat(currentGehaltsMonat)} (fest)</option>
          {gehaltsMonate.map((value) => <option key={value} value={value}>{formatGehaltsMonat(value)}</option>)}
        </select>
        <select value={preset.status} onChange={(event) => update(preset.id, { status: event.target.value as AbrechnungFilterPreset['status'] })}>
          {ABRECHNUNG_STATUS_FILTER_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <label className="abrechnung-filter-preset-default">
          <input type="radio" name="abrechnung-filter-preset-default" checked={!!preset.isDefault} onChange={() => savePresets(presets.map((item) => ({ ...item, isDefault: item.id === preset.id })))} /> Standard
        </label>
        <button type="button" className="icon-btn" aria-label={`${preset.name} löschen`} onClick={() => removePreset(preset.id)}>Löschen</button>
      </div>)}
    </div>
    {presets.length < MAX_PRESETS && <button type="button" className="btn secondary small" onClick={addPreset}>+ Filter hinzufügen</button>}
  </section>;
}
