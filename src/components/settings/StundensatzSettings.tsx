import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatEuro, euroInputToCents } from '../../lib/money';

export default function StundensatzSettings() {
  const stundensaetze = useDataStore((state) => state.stundensaetze);
  const saveStundensaetze = useDataStore((state) => state.saveStundensaetze);
  const [value, setValue] = useState('');

  async function add() {
    const cents = euroInputToCents(value);
    if (!cents || stundensaetze.includes(cents)) { setValue(''); return; }
    await saveStundensaetze([...stundensaetze, cents]);
    setValue('');
  }

  return <section className="card">
    <h3>Stundensätze</h3>
    <p className="settings-explanation">Vordefinierte Stundensätze für die Schnellberechnung im Abrechnungsformular: ein Klick auf einen Satz setzt Wert = Stundensatz × Stunden.</p>
    <div className="waiting-option-add">
      <input value={value} placeholder="z. B. 95,00" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} />
      <button className="btn" onClick={add}>Hinzufügen</button>
    </div>
    <div className="waiting-option-list">
      {stundensaetze.length === 0 && <div className="empty-hint">Noch keine Stundensätze angelegt.</div>}
      {stundensaetze.map((cents) => <span key={cents}>{formatEuro(cents)}/h<button aria-label={`${formatEuro(cents)}/h löschen`} onClick={() => saveStundensaetze(stundensaetze.filter((item) => item !== cents))}>×</button></span>)}
    </div>
  </section>;
}
