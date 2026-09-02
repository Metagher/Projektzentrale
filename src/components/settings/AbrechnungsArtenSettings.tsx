import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';

export default function AbrechnungsArtenSettings() {
  const arten = useDataStore((state) => state.abrechnungsArten);
  const saveArten = useDataStore((state) => state.saveAbrechnungsArten);
  const [value, setValue] = useState('');

  async function add() {
    const next = value.trim();
    if (!next || arten.some((art) => art.toLocaleLowerCase('de') === next.toLocaleLowerCase('de'))) return;
    await saveArten([...arten, next]);
    setValue('');
  }

  return <section className="card"><h3>Abrechnungsarten</h3><p className="settings-explanation">Diese Arten stehen bei der Erfassung einer Abrechnung zur Auswahl (z. B. VO für Termin vor Ort, MODUL für Modulverkauf, BO für Büroarbeit, ÜST für Überstunden, MM für Provision von Kollegen).</p><div className="waiting-option-add"><input value={value} placeholder="z. B. Schulung" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} /><button className="btn" onClick={add}>Hinzufügen</button></div><div className="waiting-option-list">{arten.length === 0 && <div className="empty-hint">Noch keine Arten angelegt.</div>}{arten.map((art) => <span key={art}>{art}<button aria-label={`${art} löschen`} onClick={() => saveArten(arten.filter((item) => item !== art))}>×</button></span>)}</div></section>;
}
