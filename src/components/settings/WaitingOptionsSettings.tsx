import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';

export default function WaitingOptionsSettings() {
  const options = useDataStore((state) => state.waitingOptions);
  const saveOptions = useDataStore((state) => state.saveWaitingOptions);
  const [value, setValue] = useState('');

  async function add() {
    const next = value.trim();
    if (!next || options.some((option) => option.toLocaleLowerCase('de') === next.toLocaleLowerCase('de'))) return;
    await saveOptions([...options, next]);
    setValue('');
  }

  return <section className="card"><h3>Grunddaten „Wartet auf“</h3><p className="settings-explanation">Diese festen Möglichkeiten stehen bei Aufgaben und beim Verschieben ins Kanban zur Auswahl.</p><div className="waiting-option-add"><input value={value} placeholder="z. B. Kunde oder IT-Abteilung" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} /><button className="btn" onClick={add}>Hinzufügen</button></div><div className="waiting-option-list">{options.length === 0 && <div className="empty-hint">Noch keine Möglichkeiten angelegt.</div>}{options.map((option) => <span key={option}>{option}<button aria-label={`${option} löschen`} onClick={() => saveOptions(options.filter((item) => item !== option))}>×</button></span>)}</div></section>;
}
