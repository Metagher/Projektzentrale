export interface StackedBarDatum {
  key: string;
  label: string;
  values: Map<string, number>;
  total: number;
}

interface Props {
  data: StackedBarDatum[];
  artOrder: string[];
  colorMap: Map<string, string>;
  formatValue: (value: number) => string;
  formatCompact: (value: number) => string;
}

/** Gestapeltes Balkendiagramm: pro Balken (z. B. Monat, Kalenderwoche) ein Segment je Buchungsart, plus Legende mit Summen und Anteilen. */
export default function AbrechnungStackedBarChart({ data, artOrder, colorMap, formatValue, formatCompact }: Props) {
  const max = Math.max(1, ...data.map((item) => item.total));
  const artsUsed = artOrder.filter((art) => data.some((item) => (item.values.get(art) || 0) > 0));
  const legendTotals = new Map<string, number>();
  data.forEach((item) => item.values.forEach((value, art) => legendTotals.set(art, (legendTotals.get(art) || 0) + value)));
  const grandTotal = data.reduce((sum, item) => sum + item.total, 0);

  if (data.length === 0) {
    return <div className="empty-state"><h3>Keine Daten</h3><div>Für diesen Zeitraum liegen keine Abrechnungen vor.</div></div>;
  }

  return (
    <>
      <div className="provision-chart">
        {data.map((item) => (
          <div key={item.key} className="provision-chart-bar" title={`${item.label}: ${formatValue(item.total)}`}>
            <span className="provision-chart-value">{formatCompact(item.total)}</span>
            <div className="stacked-bar-fill" style={{ height: `${Math.max(2, Math.round((item.total / max) * 100))}%` }}>
              {artsUsed.map((art) => {
                const value = item.values.get(art) || 0;
                if (value <= 0) return null;
                return <div key={art} className="stacked-bar-segment" style={{ flexGrow: value, background: colorMap.get(art) }} />;
              })}
            </div>
            <span className="provision-chart-label">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="day-project-legend">
        {artsUsed.map((art) => {
          const value = legendTotals.get(art) || 0;
          return (
            <div key={art}>
              <i style={{ background: colorMap.get(art) }} />
              <span>{art}</span>
              <strong>{formatValue(value)}</strong>
              <small>{grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0}%</small>
            </div>
          );
        })}
      </div>
    </>
  );
}
