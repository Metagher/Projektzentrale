import { useMemo, useState } from 'react';
import { formatDuration } from '../../lib/timeTracking';
import { isoWeekInfo } from '../../lib/analytics';
import { abrechnungStatus } from '../../lib/abrechnungStatus';
import { resolveArtOrder, buildArtColorMap } from '../../lib/abrechnungArtColors';
import AbrechnungStackedBarChart, { type StackedBarDatum } from './AbrechnungStackedBarChart';
import type { Abrechnung } from '../../types/entities';

/** Nur diese Buchungsarten zählen als "abgerechnete Stunden" im Sinne dieser Auswertung. */
const BILLED_HOURS_ARTEN = ['BO', 'VO', 'MODUL', 'INT', 'DL'];

function compactHours(minutes: number): string {
  return `${(minutes / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`;
}

/** Abgerechnete Stunden je Kalenderwoche und Jahr, beschränkt auf BO/VO/MODUL/INT/DL, gruppiert nach Leistungsdatum. */
export default function AbrechnungWeeklyHoursChart({ abrechnungen, arten }: { abrechnungen: Abrechnung[]; arten: string[] }) {
  const billed = useMemo(
    () => abrechnungen.filter((item) => BILLED_HOURS_ARTEN.includes(item.art) && abrechnungStatus(item) === 'abgerechnet'),
    [abrechnungen]
  );

  const jahre = useMemo(
    () => Array.from(new Set(billed.map((item) => isoWeekInfo(item.datum).year))).sort((a, b) => b - a).map(String),
    [billed]
  );
  const [jahr, setJahr] = useState(() => String(new Date().getFullYear()));

  // Gleiche Reihenfolge/Farben wie in den übrigen Abrechnungs-Diagrammen, damit z. B. "BO" überall dieselbe Farbe hat.
  const artOrder = useMemo(() => resolveArtOrder(arten, billed.map((item) => item.art)), [arten, billed]);
  const colorMap = useMemo(() => buildArtColorMap(artOrder), [artOrder]);

  const data: StackedBarDatum[] = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    billed.forEach((item) => {
      const { year, week } = isoWeekInfo(item.datum);
      if (jahr && String(year) !== jahr) return;
      const key = `${year}-${String(week).padStart(2, '0')}`;
      const values = map.get(key) || new Map<string, number>();
      values.set(item.art, (values.get(item.art) || 0) + item.minutes);
      map.set(key, values);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, values]) => ({
        key,
        label: `KW ${key.slice(5)}`,
        values,
        total: Array.from(values.values()).reduce((sum, value) => sum + value, 0),
      }));
  }, [billed, jahr]);

  const total = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="provision-chart-wrap">
      <div className="analytics-block-head">
        <div>
          <h3>Abgerechnete Stunden je Kalenderwoche</h3>
          <p>Nach Leistungsdatum, nur BO/VO/MODUL/INT/DL · {jahr || 'gesamter Zeitraum'} · Summe {formatDuration(total)}</p>
        </div>
        <select value={jahr} onChange={(event) => setJahr(event.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      <AbrechnungStackedBarChart data={data} artOrder={artOrder} colorMap={colorMap} formatValue={formatDuration} formatCompact={compactHours} />
    </div>
  );
}
