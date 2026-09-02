import { useRef, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { parseAbrechnungCsv, readCsvFileAsText, type AbrechnungCsvResult } from '../../lib/abrechnungCsv';
import { fmtDate } from '../../lib/format';
import { formatEuro } from '../../lib/money';

export default function AbrechnungCsvImportSettings() {
  const arten = useDataStore((s) => s.abrechnungsArten);
  const saveArten = useDataStore((s) => s.saveAbrechnungsArten);
  const importAbrechnungen = useDataStore((s) => s.importAbrechnungen);
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AbrechnungCsvResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const text = await readCsvFileAsText(file);
      const result = parseAbrechnungCsv(text);
      if (!result.rows.length) {
        await alert('Keine verwertbaren Zeilen gefunden. Erwartet wird eine Semikolon-getrennte Datei mit den Spalten LD, Kunde, Art, Stunden, Wert (wie der AUA-Export).');
      } else {
        setPreview(result);
        setFileName(file.name);
      }
    } catch (error) {
      await alert(error instanceof Error ? error.message : 'Datei konnte nicht gelesen werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!preview || busy) return;
    const neueArten = preview.arten.filter((art) => !arten.includes(art));
    const sure = await confirm(
      `${preview.rows.length} Abrechnung(en) aus "${fileName}" importieren? Bereits vorhandene Einträge aus einem früheren Import derselben Datei werden aktualisiert statt dupliziert.` +
      (neueArten.length ? ` Neue Abrechnungsart(en) werden angelegt: ${neueArten.join(', ')}.` : ''),
    );
    if (!sure) return;
    setBusy(true);
    if (neueArten.length) await saveArten([...arten, ...neueArten]);
    const { added, updated } = await importAbrechnungen(preview.rows);
    setBusy(false);
    setPreview(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    await alert(`Import abgeschlossen: ${added} neue Abrechnung(en), ${updated} aktualisiert.`);
  }

  const totals = preview?.rows.reduce((acc, item) => ({ minutes: acc.minutes + item.minutes, wertCents: acc.wertCents + item.wertCents }), { minutes: 0, wertCents: 0 });
  const datumRange = preview?.rows.length ? [preview.rows.reduce((min, item) => item.datum < min ? item.datum : min, preview.rows[0].datum), preview.rows.reduce((max, item) => item.datum > max ? item.datum : max, preview.rows[0].datum)] : undefined;
  const neueArten = preview ? preview.arten.filter((art) => !arten.includes(art)) : [];

  return <section className="card">
    <h3>Abrechnungen aus CSV importieren</h3>
    <p className="settings-explanation">
      Import des historischen Semikolon-getrennten Exports (Spalten LD, Freigabe, RD, Gjahr, Gmonat, Kunde, Art, TageVO, ArtMod, Stunden, Wert, Prov, VK60_NR, Bemerkung, RKs, Fahrzeit). Ein wiederholter Import derselben Datei aktualisiert bereits importierte Zeilen statt sie zu duplizieren.
    </p>
    <input
      ref={fileInputRef}
      type="file"
      accept=".csv,text/csv"
      disabled={busy}
      onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) await handleFile(file);
      }}
    />
    {preview && totals && datumRange && (
      <div className="csv-import-preview">
        <div className="time-summary-grid">
          <article><span>Zeilen</span><strong>{preview.rows.length}</strong></article>
          <article><span>Zeitraum</span><strong>{fmtDate(datumRange[0])} – {fmtDate(datumRange[1])}</strong></article>
          <article><span>Kunden</span><strong>{preview.kunden.length}</strong></article>
          <article><span>Wert gesamt</span><strong>{formatEuro(totals.wertCents)}</strong></article>
          {preview.skipped > 0 && <article><span>Übersprungen</span><strong>{preview.skipped}</strong></article>}
        </div>
        {neueArten.length > 0 && <p className="field-help">Neue Abrechnungsart(en) werden beim Import angelegt: {neueArten.join(', ')}</p>}
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={handleImport}>{busy ? 'Importiert…' : `${preview.rows.length} Abrechnung(en) importieren`}</button>
          <button className="btn secondary" disabled={busy} onClick={() => { setPreview(null); setFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Abbrechen</button>
        </div>
      </div>
    )}
  </section>;
}
