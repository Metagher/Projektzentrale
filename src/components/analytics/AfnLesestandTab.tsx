import { useEffect, useState } from 'react';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { fmtDate, todayStr } from '../../lib/format';

function afnLogSorted(log: { datum: string; nummer: number }[]) {
  return log.slice().sort((a, b) => a.datum.localeCompare(b.datum));
}

export default function AfnLesestandTab() {
  const { afnLog, loadAfnLog, saveAfnLogEntry } = useAnalyticsStore();

  useEffect(() => {
    loadAfnLog();
  }, [loadAfnLog]);

  if (afnLog === undefined) {
    return <div className="loading-note">Lade AFN-Lesestand…</div>;
  }

  const sorted = afnLogSorted(afnLog);
  const last = sorted[sorted.length - 1];
  const today = todayStr();
  const todayEntry = sorted.find((e) => e.datum === today);

  return (
    <>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 6px' }}>
        Zuletzt gelesene AFN-Nummer der Firma, Historie und tägliche Anzahl gelesener Nummern.
      </div>
      <div className="stat-row">
        <div className="stat-card">
          <div className="num">{last ? last.nummer : '–'}</div>
          <div className="label">Letzte gelesene Nummer</div>
        </div>
        <div className="stat-card">
          <div className="num">{last ? fmtDate(last.datum) : '–'}</div>
          <div className="label">Zuletzt eingetragen am</div>
        </div>
        <div className="stat-card">
          <div className="num">{sorted.length}</div>
          <div className="label">Einträge gesamt</div>
        </div>
      </div>
      <div className="section-title">Neue Nummer eintragen</div>
      <AfnLogForm todayEntry={todayEntry} today={today} onSave={saveAfnLogEntry} />
      <div className="section-title">Historie</div>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <h3>Noch keine Einträge</h3>
          <div>Trage oben die zuletzt gelesene AFN-Nummer ein.</div>
        </div>
      ) : (
        <table className="an-table">
          <tbody>
            <tr>
              <th>Datum</th>
              <th>Nummer</th>
              <th>Gelesen</th>
            </tr>
            {sorted
              .slice()
              .reverse()
              .map((e, i) => {
                const idxInSorted = sorted.length - 1 - i;
                const prev = sorted[idxInSorted - 1];
                const diff = prev ? e.nummer - prev.nummer : null;
                return (
                  <tr key={e.datum}>
                    <td>{fmtDate(e.datum)}</td>
                    <td>{e.nummer}</td>
                    <td>{diff === null ? '–' : diff}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </>
  );
}

function AfnLogForm({
  todayEntry,
  today,
  onSave,
}: {
  todayEntry: { datum: string; nummer: number } | undefined;
  today: string;
  onSave: (datum: string, nummer: number) => Promise<boolean>;
}) {
  const [datum, setDatum] = useState(todayEntry ? todayEntry.datum : today);
  const [nummer, setNummer] = useState(todayEntry ? String(todayEntry.nummer) : '');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!datum || nummer === '') {
      setError('Bitte Datum und Nummer angeben.');
      return;
    }
    const n = parseInt(nummer, 10);
    if (Number.isNaN(n)) {
      setError('Die Nummer muss eine ganze Zahl sein.');
      return;
    }
    setError(null);
    const ok = await onSave(datum, n);
    if (!ok) setError('Der Eintrag konnte nicht gespeichert werden.');
  }

  return (
    <>
      <div className="afn-log-form">
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        <input
          type="number"
          placeholder="Letzte gelesene Nummer"
          value={nummer}
          onChange={(e) => setNummer(e.target.value)}
        />
        <button className="btn" onClick={handleSave}>
          Eintragen
        </button>
      </div>
      {error && (
        <div className="ai-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </>
  );
}
