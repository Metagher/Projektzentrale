import { useMemo } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatDuration } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { formatGehaltsMonat } from '../../lib/gehaltsmonat';
import { meaningfulBelegNr } from '../../lib/abrechnungCsv';
import type { Abrechnung } from '../../types/entities';

interface BelegSum {
  belegNr: string;
  provisionCents: number;
  kunden: Set<string>;
  ids: string[];
  abgeglichenCount: number;
}

/** Fasst Abrechnungen pro Gehaltsmonat und Belegnummer zusammen ("gesammelte Abrechnung"). */
export default function AbrechnungGehaltsmonateSection({ abrechnungen }: { abrechnungen: Abrechnung[] }) {
  const setAbrechnungenAbgeglichen = useDataStore((s) => s.setAbrechnungenAbgeglichen);

  const gehaltsMonate = useMemo(() => {
    const map = new Map<string, { minutes: number; provisionCents: number; belege: Map<string, BelegSum> }>();
    abrechnungen.forEach((item) => {
      if (!item.gehaltsMonat) return;
      const current = map.get(item.gehaltsMonat) || { minutes: 0, provisionCents: 0, belege: new Map<string, BelegSum>() };
      current.minutes += item.minutes;
      current.provisionCents += item.provisionCents;
      // Ohne Belegnummer wird je Kunde eine eigene Zeile geführt statt alle Kunden in einer Zeile zusammenzufassen.
      // Platzhalter wie "-" (z. B. aus dem Altexport) zählen dabei als "ohne Belegnummer".
      const normalizedBelegNr = meaningfulBelegNr(item.belegNr);
      const key = normalizedBelegNr || `ohne-beleg:${item.kunde}`;
      const beleg = current.belege.get(key) || { belegNr: normalizedBelegNr || '', provisionCents: 0, kunden: new Set<string>(), ids: [], abgeglichenCount: 0 };
      beleg.provisionCents += item.provisionCents;
      beleg.ids.push(item.id);
      if (item.abgeglichen) beleg.abgeglichenCount += 1;
      if (item.kunde) beleg.kunden.add(item.kunde);
      current.belege.set(key, beleg);
      map.set(item.gehaltsMonat, current);
    });
    return Array.from(map.entries())
      .map(([month, sums]) => [month, {
        minutes: sums.minutes,
        provisionCents: sums.provisionCents,
        items: Array.from(sums.belege.values())
          .map((beleg) => ({
            belegNr: beleg.belegNr,
            provisionCents: beleg.provisionCents,
            kunden: Array.from(beleg.kunden).sort((a, b) => a.localeCompare(b, 'de')),
            ids: beleg.ids,
            abgeglichen: beleg.abgeglichenCount === beleg.ids.length,
            teilweiseAbgeglichen: beleg.abgeglichenCount > 0 && beleg.abgeglichenCount < beleg.ids.length,
          }))
          .sort((a, b) => {
            if (!a.belegNr && !b.belegNr) return a.kunden.join(', ').localeCompare(b.kunden.join(', '), 'de');
            if (!a.belegNr) return -1;
            if (!b.belegNr) return 1;
            return a.belegNr.localeCompare(b.belegNr, 'de', { numeric: true });
          }),
      }] as const)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [abrechnungen]);

  if (gehaltsMonate.length === 0) {
    return <div className="empty-state"><h3>Keine Gehaltsmonate</h3><div>Sobald ein Rechnungsdatum eingetragen wird, erscheint hier der zugehörige Gehaltsmonat.</div></div>;
  }

  return (
    <div className="analytics-table-wrap">
      <table className="an-table">
        <thead><tr><th>Gehaltsmonat</th><th>Stunden</th><th>Provision</th><th>Belegnummer → Provision</th></tr></thead>
        <tbody>
          {gehaltsMonate.map(([month, sums]) => <tr key={month}>
            <td>{formatGehaltsMonat(month)}</td>
            <td>{formatDuration(sums.minutes)}</td>
            <td>{formatEuro(sums.provisionCents)}</td>
            <td>{sums.items.length ? (
              <ul className="belegnr-list">
                {sums.items.map((item) => <li key={`${item.belegNr}|${item.kunden.join(',')}`} className={item.abgeglichen ? 'done' : undefined}>
                  <input
                    type="checkbox"
                    checked={item.abgeglichen}
                    ref={(el) => { if (el) el.indeterminate = item.teilweiseAbgeglichen; }}
                    onChange={() => setAbrechnungenAbgeglichen(item.ids, !item.abgeglichen)}
                    title="Mit Gehaltsabrechnung abgeglichen"
                  />
                  <span className="belegnr-num">{item.belegNr || '–'}</span>
                  <span className="belegnr-amount">{formatEuro(item.provisionCents)}</span>
                  <small>{item.kunden.join(', ')}</small>
                </li>)}
              </ul>
            ) : '–'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}
