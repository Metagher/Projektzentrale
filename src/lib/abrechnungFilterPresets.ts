import type { AbrechnungStatusFilter } from './abrechnungStatus';

/**
 * Gespeicherte Filterkombination für die Abrechnungsseiten (Projekt und Global). Jahr, Monat
 * und Gehaltsmonat können auf 'aktuell' stehen, damit sich das Preset bei jedem Aufruf auf den
 * jeweils aktuellen Zeitraum bezieht, statt mit einem festen Wert zu veralten.
 */
export interface AbrechnungFilterPreset {
  id: string;
  name: string;
  /** '' = alle Jahre, 'aktuell' = aktuelles Jahr, sonst festes Jahr (YYYY). */
  jahr: string;
  /** '' = alle Monate, 'aktuell' = aktueller Monat, sonst fester Monat (MM). */
  monat: string;
  /** '' = alle Arten, sonst feste Abrechnungsart. */
  art: string;
  /** '' = alle Gehaltsmonate, 'aktuell' = aktueller Gehaltsmonat, sonst fester Wert (YYYY-MM). */
  gehaltsMonat: string;
  status: AbrechnungStatusFilter;
  isDefault?: boolean;
}

export interface ResolvedAbrechnungFilter {
  jahr: string;
  monat: string;
  art: string;
  gehaltsMonat: string;
  status: AbrechnungStatusFilter;
}

/** Löst 'aktuell' anhand von referenceDate (Default: heute) in feste Werte auf. */
export function resolveAbrechnungFilterPreset(preset: AbrechnungFilterPreset, referenceDate = new Date()): ResolvedAbrechnungFilter {
  const year = String(referenceDate.getFullYear());
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return {
    jahr: preset.jahr === 'aktuell' ? year : preset.jahr,
    monat: preset.monat === 'aktuell' ? month : preset.monat,
    art: preset.art,
    gehaltsMonat: preset.gehaltsMonat === 'aktuell' ? `${year}-${month}` : preset.gehaltsMonat,
    status: preset.status,
  };
}

export function sameResolvedFilter(a: ResolvedAbrechnungFilter, b: ResolvedAbrechnungFilter): boolean {
  return a.jahr === b.jahr && a.monat === b.monat && a.art === b.art && a.gehaltsMonat === b.gehaltsMonat && a.status === b.status;
}

export const EMPTY_ABRECHNUNG_FILTER: ResolvedAbrechnungFilter = { jahr: '', monat: '', art: '', gehaltsMonat: '', status: 'alle' };

/** Stellt sicher, dass höchstens ein Preset als Standard markiert ist (das zuletzt markierte gewinnt). */
export function normalizeAbrechnungFilterPresets(presets: AbrechnungFilterPreset[]): AbrechnungFilterPreset[] {
  const lastDefaultIndex = presets.map((p) => !!p.isDefault).lastIndexOf(true);
  return presets.map((preset, index) => ({ ...preset, isDefault: index === lastDefaultIndex }));
}
