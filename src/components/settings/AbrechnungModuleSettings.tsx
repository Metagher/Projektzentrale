import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';

export default function AbrechnungModuleSettings() {
  const module = useDataStore((state) => state.abrechnungsModule);
  const saveModule = useDataStore((state) => state.saveAbrechnungsModule);
  const [neu, setNeu] = useState('');

  async function add() {
    const next = neu.trim();
    if (!next || module.some((item) => item.toLocaleLowerCase('de') === next.toLocaleLowerCase('de'))) return;
    await saveModule([...module, next]);
    setNeu('');
  }

  return <section className="card">
    <h3>Module</h3>
    <p className="settings-explanation">Feste Liste der bei Abrechnungen mit Art „MODUL“ verkauften Module. Neu eingetragene Module werden beim Erfassen automatisch hier ergänzt; hier lassen sich Tippfehler bereinigen oder Module entfernen.</p>
    <div className="waiting-option-add">
      <input value={neu} placeholder="z. B. EDI DESADV" onChange={(event) => setNeu(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} />
      <button className="btn" onClick={add}>Hinzufügen</button>
    </div>
    <div className="waiting-option-list">
      {module.length === 0 && <div className="empty-hint">Noch keine Module angelegt.</div>}
      {module.map((name) => <span key={name}>{name}<button aria-label={`${name} löschen`} onClick={() => saveModule(module.filter((item) => item !== name))}>×</button></span>)}
    </div>
  </section>;
}
