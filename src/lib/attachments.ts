import { useEffect, useState, type MouseEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Privater Storage-Bucket für Bild-Anhänge (z.B. an Kommunikationseinträgen) — RLS lässt nur den
 * eigenen Nutzer lesen/schreiben (Pfad beginnt mit der eigenen user_id), siehe schema.sql. */
export const ATTACHMENTS_BUCKET = 'projektzentrale-anhaenge';

/** Signierte URLs sind nur kurz gültig, damit sie nie dauerhaft in der Notiz landen (siehe
 * stripAttachmentImageSrc) — eine Stunde reicht zum Anzeigen bequem aus. */
const SIGNED_URL_TTL_SECONDS = 3600;

const PLACEHOLDER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120">' +
      '<rect width="100%" height="100%" fill="#eee" stroke="#ccc" stroke-dasharray="4"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#888">Bild nicht gefunden</text>' +
      '</svg>',
  );

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const ANHANG_PFAD_RE = /data-anhang-pfad="([^"]*)"/;

function hasAttachmentImage(html: string): boolean {
  return html.includes('data-anhang-pfad');
}

function extractAttachmentPaths(html: string): string[] {
  const paths = new Set<string>();
  const matches = html.match(IMG_TAG_RE) || [];
  matches.forEach((tag) => {
    const m = tag.match(ANHANG_PFAD_RE);
    if (m?.[1]) paths.add(m[1]);
  });
  return Array.from(paths);
}

function withoutSrc(imgTag: string): string {
  return imgTag.replace(/\s(src|data-anhang-fehlt)="[^"]*"/g, '');
}

/** Setzt für jedes <img data-anhang-pfad="..."> das src-Attribut auf die übergebene signierte URL
 * (oder einen Platzhalter, falls die Datei fehlt/kein Treffer) — ersetzt ein eventuell schon
 * vorhandenes src (z.B. eine abgelaufene URL aus einer alten Anzeige) komplett. */
function applySignedUrls(html: string, urlByPath: Map<string, string | null>): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const m = tag.match(ANHANG_PFAD_RE);
    if (!m?.[1]) return tag;
    const url = urlByPath.get(m[1]);
    const base = withoutSrc(tag).replace(/\s*\/?>$/, '');
    return url ? `${base} src="${url}">` : `${base} src="${PLACEHOLDER_SVG}" data-anhang-fehlt="1">`;
  });
}

/** Löst alle data-anhang-pfad-Bilder in RTF-HTML (z.B. einer Kommunikations-Notiz) zu zeitlich
 * begrenzten src-URLs auf, rein zum Anzeigen (Vorschau, Editor-Startinhalt). Enthält html keinen
 * Anhang, wird html unverändert und ohne Netzwerk-Roundtrip zurückgegeben. */
export function useResolvedAttachmentHtml(client: SupabaseClient | null, html: string): string {
  const [resolved, setResolved] = useState(html);

  useEffect(() => {
    if (!client || !hasAttachmentImage(html)) {
      setResolved(html);
      return;
    }
    let cancelled = false;
    const paths = extractAttachmentPaths(html);
    client.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (cancelled) return;
        const urlByPath = new Map<string, string | null>();
        (data || []).forEach((entry, i) => urlByPath.set(paths[i], entry?.signedUrl || null));
        setResolved(applySignedUrls(html, urlByPath));
      });
    return () => {
      cancelled = true;
    };
  }, [client, html]);

  return resolved;
}

/** Entfernt vor dem Speichern das src (und einen eventuellen Fehlend-Marker) wieder von allen
 * data-anhang-pfad-Bildern, damit nie eine ablaufende signierte URL dauerhaft in der Notiz landet
 * — data-anhang-pfad bleibt die einzige dauerhafte Quelle der Wahrheit. */
export function stripAttachmentImageSrc(html: string): string {
  if (!hasAttachmentImage(html)) return html;
  return html.replace(IMG_TAG_RE, (tag) => (tag.includes('data-anhang-pfad') ? withoutSrc(tag) : tag));
}

/** Click-Handler für Container, die per dangerouslySetInnerHTML gerendertes RTF-HTML anzeigen:
 * Klick auf ein aufgelöstes Anhang-Bild (nicht den Platzhalter) öffnet es vergrößert. */
export function handleAttachmentImageClick(event: MouseEvent<HTMLElement>, openLightbox: (url: string, alt: string) => void) {
  const target = event.target as HTMLElement;
  if (target.tagName !== 'IMG' || !target.hasAttribute('data-anhang-pfad') || target.hasAttribute('data-anhang-fehlt')) return;
  const src = target.getAttribute('src');
  if (src) openLightbox(src, target.getAttribute('alt') || '');
}
