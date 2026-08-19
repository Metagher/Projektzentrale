import { useRef, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { useModalStore } from '../../store/modalStore';
import { exportAllDataToCsv, parseImportCsv } from '../../lib/csv';

export default function DataView() {
  const importAllData = useDataStore((s) => s.importAllData);
  const goTo = useUiStore((s) => s.goTo);
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = parseImportCsv(text);
    if (!result.ok) {
      await alert(result.error);
      return;
    }
    const sure = await confirm(
      'Der Import ersetzt ALLE aktuellen Daten (Projekte, Ansprechpartner, Kommunikation, Dokumentation, Aufgaben, Zeitpläne und Updates) durch den Inhalt dieser Datei. Dieser Schritt kann nicht rückgängig gemacht werden. Fortfahren?',
    );
    if (!sure) return;
    setImporting(true);
    await importAllData(result.data);
    setImporting(false);
    goTo('dashboard');
    await alert(`Import abgeschlossen: ${result.data.projects.length} Projekt(e) geladen.`);
  }

  return (
    <div className="main-inner">
      <h2>CSV Import / Export</h2>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 22px', maxWidth: 640 }}>
        Sichere alle Daten (Projekte, Ansprechpartner, Kommunikation, Dokumentation, Aufgaben, Echtlauf-Zeitpläne und
        Oberpunkte) in einer einzigen CSV-Datei, oder lade eine zuvor exportierte Datei wieder hoch.
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>Export</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: '0 0 12px' }}>
          Lädt eine CSV-Datei mit dem gesamten aktuellen Datenbestand herunter.
        </p>
        <button className="btn" onClick={() => exportAllDataToCsv()}>
          CSV exportieren
        </button>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>Import</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: '0 0 12px' }}>
          Achtung: Der Import ersetzt alle aktuell gespeicherten Daten durch den Inhalt der Datei. Am besten vorher
          einen aktuellen Export als Sicherung herunterladen.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={importing}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleImportFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      </div>
    </div>
  );
}
