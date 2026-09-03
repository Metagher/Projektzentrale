import { useMemo, useState } from 'react';
import { formatEuro } from '../../lib/money';
import type { Abrechnung } from '../../types/entities';

function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${m}/${year.slice(2)}`;
}

function compactEuro(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('de-DE')} €`;
}

export default function AbrechnungProvisionChart({ abrechnungen }: { abrechnungen: Abrechnung[] }) {
  const jahre = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.datum.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [abrechnungen]);
  const [jahr, setJahr] = useState('');

  const monate = useMemo(() => {
    const map = new Map<string, number>();
    abrechnungen
      .filter((item) => !jahr || item.datum.slice(0, 4) === jahr)
      .forEach((item) => {
        const month = item.datum.slice(0, 7);
        map.set(month, (map.get(month) || 0) + item.provisionCents);
      });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [abrechnungen, jahr]);

  const max = Math.max(1, ...monate.map(([, cents]) => cents));
  const total = monate.reduce((sum, [, cents]) => sum + cents, 0);

  return (
    <div className="provision-chart-wrap">
      <div className="analytics-block-head">
        <div>
          <h3>Provision pro Monat</h3>
          <p>Nach Leistungsdatum · {jahr || 'gesamter Zeitraum'} · Summe {formatEuro(total)}</p>
        </div>
        <select value={jahr} onChange={(event) => setJahr(event.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      {monate.length > 0 ? (
        <div className="provision-chart">
          {monate.map(([month, cents]) => (
            <div key={month} className="provision-chart-bar" title={`${monthLabel(month)}: ${formatEuro(cents)}`}>
              <span className="provision-chart-value">{compactEuro(cents)}</span>
              <div className="provision-chart-fill" style={{ height: `${Math.max(2, Math.round((cents / max) * 100))}%` }} />
              <span className="provision-chart-label">{monthLabel(month)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state"><h3>Keine Daten</h3><div>Für diesen Zeitraum liegen keine Abrechnungen vor.</div></div>
      )}
    </div>
  );
}
