import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';

export default function ExplorerPathSettings() {
  const explorerBasePath = useDataStore((state) => state.explorerBasePath);
  const saveExplorerBasePath = useDataStore((state) => state.saveExplorerBasePath);
  const [value, setValue] = useState(explorerBasePath);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(explorerBasePath), [explorerBasePath]);

  async function save() {
    if (value.trim() === explorerBasePath) return;
    await saveExplorerBasePath(value);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return <section className="card">
    <h3>Aufgabenordner</h3>
    <p className="settings-explanation">Globaler Basisordner, unter dem pro Aufgaben-ID (Aufgabennummer) ein Unterordner mit den zugehörigen Dateien liegt. Von jeder Aufgabe aus lässt sich damit direkt in ihren Ordner springen.</p>
    <div className="field">
      <label>Basisordner</label>
      <input value={value} onChange={(event) => setValue(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} placeholder="z. B. C:\\Users\\name\\Documents\\Global\\13_Projektzentrale oder \\\\Server\\Freigabe\\Projekte" />
      <small className="field-help">{saved ? 'Gespeichert.' : 'Erwarteter Aufgabenordner: <Basisordner>\\<Aufgabennummer>.'}</small>
    </div>
  </section>;
}
