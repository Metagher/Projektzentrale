import { useMemo } from 'react';
import { formatEuro } from '../../lib/money';
import { formatDuration } from '../../lib/timeTracking';
import { abrechnungStatus } from '../../lib/abrechnungStatus';
import type { Abrechnung } from '../../types/entities';

/** Gesamtbetrag offener und freigegebener (noch nicht abgerechneter) Datensätze, unabhängig von Jahr/Monat. */
export default function AbrechnungStatusTotals({ abrechnungen }: { abrechnungen: Abrechnung[] }) {
  const { offen, freigegeben } = useMemo(() => {
    const totals = { minutes: 0, wertCents: 0, provisionCents: 0, count: 0 };
    const offen = { ...totals };
    const freigegeben = { ...totals };
    abrechnungen.forEach((item) => {
      const bucket = abrechnungStatus(item) === 'offen' ? offen : abrechnungStatus(item) === 'freigegeben' ? freigegeben : null;
      if (!bucket) return;
      bucket.minutes += item.minutes;
      bucket.wertCents += item.wertCents;
      bucket.provisionCents += item.provisionCents;
      bucket.count += 1;
    });
    return { offen, freigegeben };
  }, [abrechnungen]);

  return (
    <div className="analytics-kpi-grid">
      <article>
        <strong>{formatEuro(offen.wertCents)}</strong>
        <span>Offen · Betrag</span>
        <small>{offen.count} Einträge · {formatDuration(offen.minutes)} · Provision {formatEuro(offen.provisionCents)}</small>
      </article>
      <article>
        <strong>{formatEuro(freigegeben.wertCents)}</strong>
        <span>Freigegeben · Betrag</span>
        <small>{freigegeben.count} Einträge · {formatDuration(freigegeben.minutes)} · Provision {formatEuro(freigegeben.provisionCents)}</small>
      </article>
    </div>
  );
}
