import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';

export default function AbrechnungsArtenSettings() {
  const arten = useDataStore((state) => state.abrechnungsArten);
  const faktoren = useDataStore((state) => state.abrechnungsFaktoren);
  const saveArten = useDataStore((state) => state.saveAbrechnungsArten);
  const saveFaktoren = useDataStore((state) => state.saveAbrechnungsFaktoren);
  const linkedDefaultArt = useDataStore((state) => state.abrechnungLinkedDefaultArt);
  const saveLinkedDefaultArt = useDataStore((state) => state.saveAbrechnungLinkedDefaultArt);
  const [newArt, setNewArt] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(arten.map((art) => [art, faktoren[art] !== undefined ? String(faktoren[art]) : ''])));
  }, [arten, faktoren]);

  async function addArt() {
    const next = newArt.trim();
    if (!next || arten.some((art) => art.toLocaleLowerCase('de') === next.toLocaleLowerCase('de'))) return;
    await saveArten([...arten, next]);
    setNewArt('');
  }

  async function removeArt(art: string) {
    await saveArten(arten.filter((item) => item !== art));
    const rest = { ...faktoren };
    delete rest[art];
    await saveFaktoren(rest);
  }

  async function commitFaktor(art: string) {
    const raw = drafts[art]?.trim();
    const parsed = raw ? Number(raw.replace(',', '.')) : NaN;
    const next = { ...faktoren };
    if (raw && Number.isFinite(parsed)) next[art] = parsed;
    else delete next[art];
    await saveFaktoren(next);
  }

  return <section className="card">
    <h3>Abrechnungsarten</h3>
    <p className="settings-explanation">Diese Arten stehen bei der Erfassung einer Abrechnung zur Auswahl (z. B. VO für Termin vor Ort, MODUL für Modulverkauf, BO für Büroarbeit, ÜST für Überstunden, MM für Provision von Kollegen). Mit einem Provisionsfaktor wird die Provision beim Erfassen automatisch aus dem Wert berechnet (Provision = Wert × Faktor ÷ 100) – im Formular lässt sich das Ergebnis jederzeit überschreiben. Ohne Faktor bleibt die Provision frei einzutragen.</p>
    <div className="abrechnungsarten-list">
      {arten.map((art) => <div key={art} className="abrechnungsarten-row">
        <span>{art}</span>
        <span className="abrechnungsarten-faktor">
          <input type="number" min="0" step="0.1" value={drafts[art] ?? ''} placeholder="kein Faktor" onChange={(event) => setDrafts((current) => ({ ...current, [art]: event.target.value }))} onBlur={() => commitFaktor(art)} />
          <small>%</small>
        </span>
        <button type="button" className="icon-btn" aria-label={`${art} löschen`} onClick={() => removeArt(art)}>Löschen</button>
      </div>)}
    </div>
    <div className="waiting-option-add">
      <input value={newArt} placeholder="z. B. Schulung" onChange={(event) => setNewArt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addArt(); }} />
      <button className="btn" onClick={addArt}>Hinzufügen</button>
    </div>
    <div className="field" style={{ marginTop: 16, maxWidth: 280 }}>
      <label>Vorbelegte Art bei Erfassung aus Aufgabe/Kommunikation</label>
      <select value={arten.includes(linkedDefaultArt) ? linkedDefaultArt : ''} onChange={(event) => saveLinkedDefaultArt(event.target.value)}>
        {!arten.includes(linkedDefaultArt) && <option value="" disabled>— auswählen —</option>}
        {arten.map((art) => <option key={art} value={art}>{art}</option>)}
      </select>
    </div>
  </section>;
}
