import { useMemo, useState } from 'react';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import type { Abrechnung } from '../../types/entities';

function compactEuro(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('de-DE')} €`;
}

interface Props {
  abrechnungen: Abrechnung[];
  /** Nach welchem Datum die Monate gebildet werden: Leistungsdatum (item.datum) oder Gehaltsmonat. */
  basis: 'leistungsdatum' | 'gehaltsmonat';
}

export default function AbrechnungProvisionChart({ abrechnungen, basis }: Props) {
  const monthLabel = basis === 'gehaltsmonat' ? formatGehaltsMonat : (month: string) => { const [year, m] = month.split('-'); return `${m}/${year.slice(2)}`; };

  const jahre = useMemo(() => {
    const values = abrechnungen
      .map((item) => (basis === 'gehaltsmonat' ? item.gehaltsMonat : item.datum.slice(0, 7)))
      .filter((value): value is string => !!value);
    return Array.from(new Set(values.map((value) => value.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  }, [abrechnungen, basis]);
  const [jahr, setJahr] = useState('');

  const monate = useMemo(() => {
    const map = new Map<string, number>();
    abrechnungen.forEach((item) => {
      const month = basis === 'gehaltsmonat' ? item.gehaltsMonat : item.datum.slice(0, 7);
      if (!month || (jahr && month.slice(0, 4) !== jahr)) return;
      map.set(month, (map.get(month) || 0) + item.provisionCents);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [abrechnungen, jahr, basis]);

  const max = Math.max(1, ...monate.map(([, cents]) => cents));
  const total = monate.reduce((sum, [, cents]) => sum + cents, 0);
  const title = basis === 'gehaltsmonat' ? 'Provision pro Monat (Gehaltsmonat)' : 'Provision pro Monat (Leistungsdatum)';
  const subtitle = basis === 'gehaltsmonat' ? 'Monat der Gehaltsauszahlung' : 'Monat der erbrachten Leistung';

  return (
    <div className="provision-chart-wrap">
      <div className="analytics-block-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle} · {jahr || 'gesamter Zeitraum'} · Summe {formatEuro(total)}</p>
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
