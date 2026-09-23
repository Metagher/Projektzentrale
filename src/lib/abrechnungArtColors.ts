const COLORS = ['#1f5f8b', '#b4532a', '#2f7d55', '#7b4fa3', '#a47a18', '#2b7a78', '#9b3d54', '#52616b', '#c2554e', '#4a6fa5'];

/**
 * Reiht alle in den Daten tatsächlich vorkommenden Buchungsarten hinter die konfigurierte
 * Reihenfolge ein, damit auch nicht (mehr) konfigurierte Werte (z. B. aus Altdaten) in
 * Diagrammen und Legenden auftauchen statt stillschweigend zu fehlen.
 */
export function resolveArtOrder(configuredArten: string[], presentArten: Iterable<string>): string[] {
  const order = [...configuredArten];
  const extra = Array.from(new Set(presentArten)).filter((art) => !order.includes(art)).sort((a, b) => a.localeCompare(b, 'de'));
  return [...order, ...extra];
}

/** Weist jeder Buchungsart anhand ihrer Position in artOrder eine feste Farbe zu, damit dieselbe Art in allen Diagrammen gleich eingefärbt ist. */
export function buildArtColorMap(artOrder: string[]): Map<string, string> {
  const map = new Map<string, string>();
  artOrder.forEach((art, index) => map.set(art, COLORS[index % COLORS.length]));
  return map;
}
