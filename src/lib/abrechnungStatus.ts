import type { Abrechnung } from '../types/entities';

/**
 * Freigabe und Abrechnung sind zwei getrennte Schritte: die Freigabe erlaubt einer anderen
 * Abteilung, eine Rechnung zu stellen; erst ein eingetragenes Rechnungsdatum bedeutet, dass
 * intern tatsächlich eine Rechnung geschrieben wurde.
 */
export type AbrechnungStatus = 'offen' | 'freigegeben' | 'abgerechnet';

export function abrechnungStatus(item: Pick<Abrechnung, 'freigegeben' | 'rechnungsdatum'>): AbrechnungStatus {
  if (item.rechnungsdatum) return 'abgerechnet';
  if (item.freigegeben) return 'freigegeben';
  return 'offen';
}

export const ABRECHNUNG_STATUS_LABELS: Record<AbrechnungStatus, string> = {
  offen: 'offen',
  freigegeben: 'freigegeben',
  abgerechnet: 'abgerechnet',
};

/** 'offen_freigegeben' ist ein reiner Filterwert (noch nicht abgerechnet), kein möglicher Status eines einzelnen Eintrags. */
export type AbrechnungStatusFilter = AbrechnungStatus | 'alle' | 'offen_freigegeben';

export const ABRECHNUNG_STATUS_FILTER_OPTIONS: { id: AbrechnungStatusFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'offen', label: 'Nur offene' },
  { id: 'freigegeben', label: 'Nur freigegeben' },
  { id: 'offen_freigegeben', label: 'Offen + freigegeben' },
  { id: 'abgerechnet', label: 'Nur abgerechnet' },
];

export function matchesAbrechnungStatusFilter(item: Pick<Abrechnung, 'freigegeben' | 'rechnungsdatum'>, filter: AbrechnungStatusFilter): boolean {
  if (filter === 'alle') return true;
  const status = abrechnungStatus(item);
  if (filter === 'offen_freigegeben') return status !== 'abgerechnet';
  return status === filter;
}
