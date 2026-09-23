import { useMemo, useState } from 'react';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import { resolveArtOrder, buildArtColorMap } from '../../lib/abrechnungArtColors';
import AbrechnungStackedBarChart, { type StackedBarDatum } from './AbrechnungStackedBarChart';
import type { Abrechnung } from '../../types/entities';

function compactEuro(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('de-DE')} €`;
}

function monthLabelFor(month: string, basis: 'leistungsdatum' | 'gehaltsmonat'): string {
  if (basis === 'gehaltsmonat') return formatGehaltsMonat(month);
  const [year, m] = month.split('-');
  return `${m}/${year.slice(2)}`;
}

interface Props {
  abrechnungen: Abrechnung[];
  arten: string[];
  /** Nach welchem Datum die Monate gebildet werden: Leistungsdatum (item.datum) oder Gehaltsmonat. */
  basis: 'leistungsdatum' | 'gehaltsmonat';
}

/** Auswertung aller Buchungsarten pro Monat (Provision), wahlweise nach Leistungs- oder Gehaltsmonat gruppiert. */
export default function AbrechnungArtMonatChart({ abrechnungen, arten, basis }: Props) {
  const jahre = useMemo(() => {
    const values = abrechnungen
      .map((item) => (basis === 'gehaltsmonat' ? item.gehaltsMonat : item.datum.slice(0, 7)))
      .filter((value): value is string => !!value);
    return Array.from(new Set(values.map((value) => value.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  }, [abrechnungen, basis]);
  const [jahr, setJahr] = useState(() => String(new Date().getFullYear()));

  const scoped = useMemo(() => abrechnungen.filter((item) => {
    const month = basis === 'gehaltsmonat' ? item.gehaltsMonat : item.datum.slice(0, 7);
    return !!month && (!jahr || month.slice(0, 4) === jahr);
  }), [abrechnungen, jahr, basis]);

  const artOrder = useMemo(() => resolveArtOrder(arten, scoped.map((item) => item.art)), [arten, scoped]);
  const colorMap = useMemo(() => buildArtColorMap(artOrder), [artOrder]);

  const data: StackedBarDatum[] = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    scoped.forEach((item) => {
      const month = (basis === 'gehaltsmonat' ? item.gehaltsMonat : item.datum.slice(0, 7))!;
      const values = map.get(month) || new Map<string, number>();
      values.set(item.art, (values.get(item.art) || 0) + item.provisionCents);
      map.set(month, values);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, values]) => ({
        key: month,
        label: monthLabelFor(month, basis),
        values,
        total: Array.from(values.values()).reduce((sum, value) => sum + value, 0),
      }));
  }, [scoped, basis]);

  const total = data.reduce((sum, item) => sum + item.total, 0);
  const title = basis === 'gehaltsmonat' ? 'Buchungsarten pro Gehaltsmonat' : 'Buchungsarten pro Leistungsmonat';
  const subtitle = basis === 'gehaltsmonat' ? 'Provision je Monat der Gehaltsauszahlung, aufgeschlüsselt nach Buchungsart' : 'Provision je Monat der erbrachten Leistung, aufgeschlüsselt nach Buchungsart';

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
      <AbrechnungStackedBarChart data={data} artOrder={artOrder} colorMap={colorMap} formatValue={formatEuro} formatCompact={compactEuro} />
    </div>
  );
}
