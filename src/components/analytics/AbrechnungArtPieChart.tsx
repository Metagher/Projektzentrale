import { useMemo, useState } from 'react';
import { formatEuro } from '../../lib/money';
import type { Abrechnung } from '../../types/entities';

const COLORS = ['#1f5f8b', '#b4532a', '#2f7d55', '#7b4fa3', '#a47a18', '#2b7a78', '#9b3d54', '#52616b'];

export default function AbrechnungArtPieChart({ abrechnungen }: { abrechnungen: Abrechnung[] }) {
  const jahre = useMemo(() => Array.from(new Set(abrechnungen.map((item) => item.datum.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [abrechnungen]);
  const [jahr, setJahr] = useState('');

  const rows = useMemo(() => {
    const map = new Map<string, number>();
    abrechnungen
      .filter((item) => !jahr || item.datum.slice(0, 4) === jahr)
      .forEach((item) => map.set(item.art, (map.get(item.art) || 0) + item.provisionCents));
    return Array.from(map.entries())
      .filter(([, cents]) => cents > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([art, cents], index) => ({ art, cents, color: COLORS[index % COLORS.length] }));
  }, [abrechnungen, jahr]);

  const total = rows.reduce((sum, row) => sum + row.cents, 0);
  let cursor = 0;
  const stops = total > 0 ? rows.map((row) => {
    const start = (cursor / total) * 360;
    cursor += row.cents;
    const end = (cursor / total) * 360;
    return `${row.color} ${start}deg ${end}deg`;
  }).join(', ') : '';

  return (
    <div className="provision-chart-wrap">
      <div className="analytics-block-head">
        <div>
          <h3>Verteilung nach Art</h3>
          <p>Anteil an der Provision · {jahr || 'gesamter Zeitraum'} · Summe {formatEuro(total)}</p>
        </div>
        <select value={jahr} onChange={(event) => setJahr(event.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      {total > 0 ? (
        <div className="day-project-share">
          <div className="day-donut" style={{ background: `conic-gradient(${stops})` }}>
            <span>{formatEuro(total)}</span>
          </div>
          <div className="day-project-legend">
            {rows.map((row) => <div key={row.art}>
              <i style={{ background: row.color }} />
              <span>{row.art}</span>
              <strong>{formatEuro(row.cents)}</strong>
              <small>{Math.round((row.cents / total) * 100)}%</small>
            </div>)}
          </div>
        </div>
      ) : (
        <div className="empty-state"><h3>Keine Daten</h3><div>Für diesen Zeitraum liegen keine Abrechnungen vor.</div></div>
      )}
    </div>
  );
}
