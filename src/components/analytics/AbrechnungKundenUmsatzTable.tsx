import { useMemo, useState } from 'react';
import { formatEuro } from '../../lib/money';
import { abrechnungStatus } from '../../lib/abrechnungStatus';
import { resolveArtOrder, buildArtColorMap } from '../../lib/abrechnungArtColors';
import type { Abrechnung } from '../../types/entities';

interface KundeRow {
  kunde: string;
  wertCents: number;
  artCents: Map<string, number>;
}

function ArtShare({ row, artOrder, colorMap }: { row: KundeRow; artOrder: string[]; colorMap: Map<string, string> }) {
  const used = artOrder.filter((art) => (row.artCents.get(art) || 0) > 0);
  return (
    <>
      <div className="art-share-bar">
        {used.map((art) => {
          const value = row.artCents.get(art) || 0;
          return <span key={art} style={{ flexGrow: value, background: colorMap.get(art) }} title={`${art}: ${formatEuro(value)}`} />;
        })}
      </div>
      <div className="art-share-labels">
        {used.map((art) => {
          const value = row.artCents.get(art) || 0;
          const pct = row.wertCents > 0 ? Math.round((value / row.wertCents) * 100) : 0;
          return <span key={art}><i style={{ background: colorMap.get(art) }} />{art} {pct}%</span>;
        })}
      </div>
    </>
  );
}

/** Umsatz je Kunde und Jahr mit Anteil der Buchungsart in %, ausschließlich auf Basis bereits abgerechneter (mit Rechnungsdatum versehener) Einträge. */
export default function AbrechnungKundenUmsatzTable({ abrechnungen, arten }: { abrechnungen: Abrechnung[]; arten: string[] }) {
  const abgerechnet = useMemo(() => abrechnungen.filter((item) => abrechnungStatus(item) === 'abgerechnet' && item.rechnungsdatum), [abrechnungen]);

  const jahre = useMemo(
    () => Array.from(new Set(abgerechnet.map((item) => item.rechnungsdatum!.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [abgerechnet]
  );
  const [jahr, setJahr] = useState(() => String(new Date().getFullYear()));

  const scoped = useMemo(
    () => abgerechnet.filter((item) => !jahr || item.rechnungsdatum!.slice(0, 4) === jahr),
    [abgerechnet, jahr]
  );

  const artOrder = useMemo(() => resolveArtOrder(arten, scoped.map((item) => item.art)), [arten, scoped]);
  const colorMap = useMemo(() => buildArtColorMap(artOrder), [artOrder]);

  const rows: KundeRow[] = useMemo(() => {
    const map = new Map<string, KundeRow>();
    scoped.forEach((item) => {
      const row = map.get(item.kunde) || { kunde: item.kunde, wertCents: 0, artCents: new Map<string, number>() };
      row.wertCents += item.wertCents;
      row.artCents.set(item.art, (row.artCents.get(item.art) || 0) + item.wertCents);
      map.set(item.kunde, row);
    });
    return Array.from(map.values()).sort((a, b) => b.wertCents - a.wertCents);
  }, [scoped]);

  const totalRow: KundeRow = useMemo(() => {
    const artCents = new Map<string, number>();
    let wertCents = 0;
    rows.forEach((row) => {
      wertCents += row.wertCents;
      row.artCents.forEach((value, art) => artCents.set(art, (artCents.get(art) || 0) + value));
    });
    return { kunde: 'Summe', wertCents, artCents };
  }, [rows]);

  return (
    <div className="provision-chart-wrap">
      <div className="analytics-block-head">
        <div>
          <h3>Umsatz je Kunde</h3>
          <p>Auf Basis abgerechneter Rechnungen · {jahr || 'gesamter Zeitraum'} · Summe {formatEuro(totalRow.wertCents)}</p>
        </div>
        <select value={jahr} onChange={(event) => setJahr(event.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      {rows.length > 0 ? (
        <div className="analytics-table-wrap">
          <table className="an-table">
            <thead><tr><th>Kunde</th><th>Umsatz</th><th>Anteil nach Buchungsart</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.kunde}>
                <td>{row.kunde}</td>
                <td>{formatEuro(row.wertCents)}</td>
                <td><ArtShare row={row} artOrder={artOrder} colorMap={colorMap} /></td>
              </tr>)}
            </tbody>
            <tfoot>
              <tr>
                <th>{totalRow.kunde}</th>
                <th>{formatEuro(totalRow.wertCents)}</th>
                <th><ArtShare row={totalRow} artOrder={artOrder} colorMap={colorMap} /></th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="empty-state"><h3>Keine Daten</h3><div>Für diesen Zeitraum liegen keine abgerechneten Rechnungen vor.</div></div>
      )}
    </div>
  );
}
