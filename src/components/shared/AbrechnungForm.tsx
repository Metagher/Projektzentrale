import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { uid, todayStr } from '../../lib/format';
import { centsToEuroInput, formatEuro, numberInputToCents } from '../../lib/money';
import { formatGehaltsMonat, gehaltsMonatFromDate, parseGehaltsMonatInput } from '../../lib/gehaltsmonat';
import { taskLinkLabel, commLinkLabel } from '../../lib/format';
import type { Abrechnung } from '../../types/entities';

function minutesToHoursInput(minutes: number) { return minutes ? (minutes / 60).toFixed(2) : ''; }
function hoursInputToMinutes(value: string) { const parsed = Number(value.replace(',', '.')); return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0; }

interface Props {
  entry?: Abrechnung;
  /** Im Projekt-Kontext: Projekt und Kunde sind fest vorgegeben, keine Auswahl. */
  fixedProjectId?: string;
  fixedKunde?: string;
  /** Beim Erfassen aus einer Aufgabe/einem Kommunikationseintrag heraus: Verknüpfung wird fest gesetzt. */
  fixedTaskId?: string;
  fixedCommId?: string;
  onSave: (entry: Abrechnung) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export default function AbrechnungForm({ entry, fixedProjectId, fixedKunde, fixedTaskId, fixedCommId, onSave, onDelete, onClose }: Props) {
  const projects = useDataStore((s) => s.projects) || [];
  const arten = useDataStore((s) => s.abrechnungsArten);
  const faktoren = useDataStore((s) => s.abrechnungsFaktoren);
  const stundensaetze = useDataStore((s) => s.stundensaetze);
  const linkedDefaultArt = useDataStore((s) => s.abrechnungLinkedDefaultArt);
  const abrechnungsModule = useDataStore((s) => s.abrechnungsModule);
  const saveAbrechnungsModule = useDataStore((s) => s.saveAbrechnungsModule);
  const cache = useDataStore((s) => s.cache);
  const confirm = useModalStore((s) => s.confirm);

  const [projectId, setProjectId] = useState(entry?.projectId ?? fixedProjectId ?? '');
  const [taskId] = useState(entry?.taskId ?? fixedTaskId);
  const [commId] = useState(entry?.commId ?? fixedCommId);
  const [kunde, setKunde] = useState(entry?.kunde ?? fixedKunde ?? '');
  const [datum, setDatum] = useState(entry?.datum || todayStr());
  const [art, setArt] = useState(entry?.art || ((fixedTaskId || fixedCommId) && arten.includes(linkedDefaultArt) ? linkedDefaultArt : arten[0]) || '');
  const [hours, setHours] = useState(entry ? minutesToHoursInput(entry.minutes) : '');
  const [wert, setWert] = useState(entry ? centsToEuroInput(entry.wertCents) : '');
  const [provision, setProvision] = useState(entry ? centsToEuroInput(entry.provisionCents) : '');
  const [provisionOverridden, setProvisionOverridden] = useState(!!entry);
  const [freigegeben, setFreigegeben] = useState(entry?.freigegeben || false);
  const [rechnungsdatum, setRechnungsdatum] = useState(entry?.rechnungsdatum || '');
  const [gehaltsMonatText, setGehaltsMonatText] = useState(formatGehaltsMonat(entry?.gehaltsMonat));
  const [gehaltsMonatOverridden, setGehaltsMonatOverridden] = useState(() => {
    if (!entry?.gehaltsMonat) return false;
    return entry.gehaltsMonat !== (entry.rechnungsdatum ? gehaltsMonatFromDate(entry.rechnungsdatum) : '');
  });
  const [belegNr, setBelegNr] = useState(entry?.belegNr || '');
  const [bemerkung, setBemerkung] = useState(entry?.bemerkung || '');
  const [teilprojekt, setTeilprojekt] = useState(entry?.teilprojekt || '');
  const [tageVorOrt, setTageVorOrt] = useState(entry?.tageVorOrt ? String(entry.tageVorOrt) : '');
  const [reisekosten, setReisekosten] = useState(entry?.reisekostenCents ? centsToEuroInput(entry.reisekostenCents) : '');
  const [fahrzeit, setFahrzeit] = useState(entry?.fahrzeitMinutes ? minutesToHoursInput(entry.fahrzeitMinutes) : '');
  const [modul, setModul] = useState(entry?.modul || '');
  const [addingModul, setAddingModul] = useState(false);
  const [newModulName, setNewModulName] = useState('');
  const [saving, setSaving] = useState(false);

  const projectLocked = !!fixedProjectId;
  const valid = !!datum && !!art && !!kunde.trim();
  const faktor = faktoren[art];
  const linkedTask = taskId && projectId ? cache[projectId]?.tasks.find((task) => task.id === taskId) : undefined;
  const linkedComm = commId && projectId ? cache[projectId]?.comms.find((comm) => comm.id === commId) : undefined;
  // Falls der gespeicherte Wert (Altdaten) nicht mehr in der festen Liste steht, trotzdem als Option anbieten.
  const modulOptionen = modul && !abrechnungsModule.includes(modul) ? [...abrechnungsModule, modul].sort((a, b) => a.localeCompare(b, 'de')) : abrechnungsModule;

  useEffect(() => {
    if (provisionOverridden || faktor === undefined) return;
    const wertCents = numberInputToCents(wert);
    setProvision(centsToEuroInput(Math.round((wertCents * faktor) / 100)));
  }, [wert, faktor, provisionOverridden]);

  useEffect(() => {
    if (gehaltsMonatOverridden || !rechnungsdatum) return;
    setGehaltsMonatText(formatGehaltsMonat(gehaltsMonatFromDate(rechnungsdatum)));
  }, [rechnungsdatum, gehaltsMonatOverridden]);

  function selectProject(id: string) {
    setProjectId(id);
    const project = projects.find((item) => item.id === id);
    if (project) setKunde(project.kunde);
  }

  function blurGehaltsMonat() {
    const parsed = parseGehaltsMonatInput(gehaltsMonatText);
    if (parsed) setGehaltsMonatText(formatGehaltsMonat(parsed));
  }

  function applyStundensatz(stundensatzCents: number) {
    setWert(centsToEuroInput(Math.round((stundensatzCents * hoursInputToMinutes(hours)) / 60)));
  }

  async function addModul() {
    const next = newModulName.trim();
    if (!next) return;
    if (!abrechnungsModule.some((item) => item.toLocaleLowerCase('de') === next.toLocaleLowerCase('de'))) {
      await saveAbrechnungsModule([...abrechnungsModule, next]);
    }
    setModul(next);
    setNewModulName('');
    setAddingModul(false);
  }

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    await onSave({
      id: entry?.id || uid(),
      projectId: projectId || undefined,
      taskId,
      commId,
      kunde: kunde.trim(),
      datum,
      art,
      minutes: hoursInputToMinutes(hours),
      wertCents: numberInputToCents(wert),
      provisionCents: numberInputToCents(provision),
      freigegeben,
      rechnungsdatum: freigegeben ? (rechnungsdatum || undefined) : undefined,
      gehaltsMonat: parseGehaltsMonatInput(gehaltsMonatText) || undefined,
      belegNr: belegNr.trim() || undefined,
      bemerkung: bemerkung.trim() || undefined,
      teilprojekt: teilprojekt.trim() || undefined,
      tageVorOrt: art === 'VO' && tageVorOrt ? Number(tageVorOrt) : undefined,
      reisekostenCents: art === 'VO' && reisekosten ? numberInputToCents(reisekosten) : undefined,
      fahrzeitMinutes: art === 'VO' && fahrzeit ? hoursInputToMinutes(fahrzeit) : undefined,
      modul: art === 'MODUL' ? modul.trim() || undefined : undefined,
      createdAt: entry?.createdAt || new Date().toISOString(),
    });
    setSaving(false);
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!(await confirm('Diese Abrechnung löschen?'))) return;
    await onDelete();
  }

  return (
    <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Abrechnung erfassen">
      <div className="task-edit-dialog">
        <div className="task-edit-dialog-head"><div><span>Abrechnung</span><strong>{entry ? 'Abrechnung bearbeiten' : 'Abrechnung erfassen'}</strong></div></div>
        {(linkedTask || linkedComm) && (
          <div className="field-help" style={{ marginBottom: 10 }}>
            🔗 Verlinkt mit {[linkedTask ? `Aufgabe ${taskLinkLabel(linkedTask)}` : null, linkedComm ? `Kommunikation ${commLinkLabel(linkedComm)}` : null].filter(Boolean).join(' · ')}
          </div>
        )}
        <div className="field-grid">
          <div className="field"><label>Leistungsdatum</label><input type="date" value={datum} onChange={(event) => setDatum(event.target.value)} /></div>
          <div className="field">
            <label>Art</label>
            <select value={art} onChange={(event) => setArt(event.target.value)}>
              {arten.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          {!projectLocked && (
            <div className="field">
              <label>Projekt</label>
              <select value={projectId} onChange={(event) => selectProject(event.target.value)}>
                <option value="">— ohne Projekt —</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Kunde</label>
            {projectLocked
              ? <input value={kunde} readOnly />
              : <input value={kunde} onChange={(event) => setKunde(event.target.value)} placeholder="z. B. Überstunden" />}
          </div>
          <div className="field"><label>Stunden</label><input type="number" min="0" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" /></div>
          <div className="field">
            <label>Wert (€)</label>
            <input type="number" min="0" step="0.01" value={wert} onChange={(event) => setWert(event.target.value)} placeholder="0,00" />
            {stundensaetze.length > 0 && (
              <div className="stundensatz-quick">
                {stundensaetze.map((cents) => <button key={cents} type="button" className="btn secondary small" onClick={() => applyStundensatz(cents)}>{formatEuro(cents)}/h</button>)}
              </div>
            )}
          </div>
          <div className="field">
            <label>Provision (€)</label>
            <input type="number" min="0" step="0.01" value={provision} onChange={(event) => { setProvision(event.target.value); setProvisionOverridden(true); }} placeholder="0,00" />
            {faktor !== undefined && (
              provisionOverridden
                ? <small className="field-help">Manuell angepasst · <button type="button" className="link-btn" onClick={() => setProvisionOverridden(false)}>automatisch berechnen ({faktor}%)</button></small>
                : <small className="field-help">Automatisch berechnet ({faktor}% von Wert)</small>
            )}
          </div>
          <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(event) => setTeilprojekt(event.target.value)} placeholder="Optional" /></div>
        </div>
        {art === 'VO' && (
          <div className="field-grid">
            <div className="field"><label>Tage vor Ort</label><input type="number" min="0" step="1" value={tageVorOrt} onChange={(event) => setTageVorOrt(event.target.value)} /></div>
            <div className="field"><label>Reisekosten (€)</label><input type="number" min="0" step="0.01" value={reisekosten} onChange={(event) => setReisekosten(event.target.value)} placeholder="0,00" /></div>
            <div className="field"><label>Fahrzeit (Stunden)</label><input type="number" min="0" step="0.25" value={fahrzeit} onChange={(event) => setFahrzeit(event.target.value)} /></div>
          </div>
        )}
        {art === 'MODUL' && (
          <div className="field">
            <label>Modul</label>
            {addingModul ? (
              <div className="stundensatz-quick" style={{ marginTop: 0 }}>
                <input value={newModulName} onChange={(event) => setNewModulName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addModul(); }} placeholder="z. B. EDI DESADV" autoFocus />
                <button type="button" className="btn secondary small" onClick={addModul}>Übernehmen</button>
                <button type="button" className="btn secondary small" onClick={() => { setAddingModul(false); setNewModulName(''); }}>Abbrechen</button>
              </div>
            ) : (
              <>
                <select value={modul} onChange={(event) => setModul(event.target.value)}>
                  <option value="">— auswählen —</option>
                  {modulOptionen.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <small className="field-help"><button type="button" className="link-btn" onClick={() => setAddingModul(true)}>+ neues Modul anlegen</button></small>
              </>
            )}
          </div>
        )}
        <div className="field-grid">
          <label className="doku-check-field"><input type="checkbox" checked={freigegeben} onChange={(event) => setFreigegeben(event.target.checked)} /> Zur Rechnungsstellung freigegeben</label>
          <div className="field"><label>Rechnungsdatum</label><input type="date" value={rechnungsdatum} disabled={!freigegeben} onChange={(event) => setRechnungsdatum(event.target.value)} /></div>
          <div className="field">
            <label>Gehaltsmonat</label>
            <input value={gehaltsMonatText} onChange={(event) => { setGehaltsMonatText(event.target.value); setGehaltsMonatOverridden(true); }} onBlur={blurGehaltsMonat} placeholder="MM/YYYY" />
            {rechnungsdatum && (
              gehaltsMonatOverridden
                ? <small className="field-help">Manuell angepasst · <button type="button" className="link-btn" onClick={() => setGehaltsMonatOverridden(false)}>Rechnungsmonat übernehmen</button></small>
                : <small className="field-help">Vorschlag aus Rechnungsdatum</small>
            )}
          </div>
          <div className="field"><label>Belegnummer</label><input value={belegNr} onChange={(event) => setBelegNr(event.target.value)} placeholder="Optional" /></div>
        </div>
        <div className="field"><label>Bemerkung</label><input value={bemerkung} onChange={(event) => setBemerkung(event.target.value)} placeholder="Optional" /></div>
        <div className="btn-row">
          <button className="btn" disabled={!valid || saving} onClick={handleSave}>{saving ? 'Speichert…' : 'Speichern'}</button>
          <button className="btn secondary" onClick={onClose}>Abbrechen</button>
          {onDelete && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={handleDelete}>Löschen</button>}
        </div>
      </div>
    </div>
  );
}
