import { useState } from 'react';
import { uid } from '../../lib/format';
import { useDataStore } from '../../store/dataStore';

export default function ProjectTimeTypeSettings() {
  const types = useDataStore((state) => state.projectTimeTypes);
  const saveTypes = useDataStore((state) => state.saveProjectTimeTypes);
  const [value, setValue] = useState('');

  async function add() {
    const name = value.trim();
    if (!name || types.some((type) => type.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'))) return;
    await saveTypes([...types, { id: uid(), name }]);
    setValue('');
  }

  return <section id="project-time-type-settings" className="card">
    <h3>Zeittypen für Projektzeit</h3>
    <p className="settings-explanation">Für jeden Zeittyp erscheint im Projektkopf ein eigener Start-Button. Aufgabenzeiten bleiben davon getrennt.</p>
    <div className="waiting-option-add"><input value={value} placeholder="z. B. Abstimmung, Dokumentation oder Schulung" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void add(); }} /><button className="btn" onClick={() => void add()}>Hinzufügen</button></div>
    <div className="waiting-option-list">{types.map((type) => <span key={type.id}>{type.name}<button disabled={types.length === 1} aria-label={`${type.name} löschen`} title={types.length === 1 ? 'Mindestens ein Zeittyp ist erforderlich' : 'Zeittyp löschen'} onClick={() => void saveTypes(types.filter((item) => item.id !== type.id))}>×</button></span>)}</div>
  </section>;
}
