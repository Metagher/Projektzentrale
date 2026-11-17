const TYPOGRAPHY_PROPERTIES = ['font-size', 'font-family', 'font', 'line-height', 'letter-spacing'];

/** Removes typography imported from Word, Outlook, websites, etc. while retaining semantic formatting. */
export function normalizeRichTextTypography(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = document.body.firstElementChild as HTMLElement | null;
  if (!root) return html;

  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    TYPOGRAPHY_PROPERTIES.forEach((property) => element.style.removeProperty(property));
    element.removeAttribute('size');
    element.removeAttribute('face');
  });

  return root.innerHTML;
}

/** Wandelt einfachen Text (z.B. aus einem externen Posteingang) in das Mindestmaß an HTML um,
 * das die Rich-Text-Felder der App erwarten — ein Absatz je Zeilenumbruch-Block. */
export function plainTextToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<p>' + escaped.replace(/\n+/g, '</p><p>') + '</p>';
}

const INBOX_HTML_ALLOWED_TAGS = new Set(['p', 'br', 'ul', 'ol', 'li', 'h3', 'strong', 'em', 'a']);

function hasHtmlTag(text: string): boolean {
  return /<[a-z][a-z0-9]*(\s[^>]*)?\/?>|<\/[a-z][a-z0-9]*\s*>/i.test(text);
}

function unwrapOrStrip(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style') {
    element.remove();
    return;
  }
  Array.from(element.children).forEach((child) => unwrapOrStrip(child as HTMLElement));
  if (INBOX_HTML_ALLOWED_TAGS.has(tag)) {
    Array.from(element.attributes).forEach((attr) => {
      if (!(tag === 'a' && attr.name === 'href')) element.removeAttribute(attr.name);
    });
  } else {
    while (element.firstChild) element.parentNode!.insertBefore(element.firstChild, element);
    element.remove();
  }
}

/** Entfernt alles außer der Whitelist (p, br, ul, ol, li, h3, strong, em, a) aus HTML-Text aus dem
 * Posteingang — nicht erlaubte Tags werden entfernt, ihr Textinhalt bleibt erhalten; nicht
 * erlaubte Attribute (außer href bei a) werden gestrichen. */
function sanitizeInboxHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';
  // Nur die Kinder des Wrapper-divs bereinigen, nie das div selbst (sonst würde unwrapOrStrip es
  // als nicht erlaubtes Tag entfernen und wir verlieren den Container, aus dem wir am Ende
  // innerHTML lesen).
  Array.from(root.children).forEach((child) => unwrapOrStrip(child as HTMLElement));
  return root.innerHTML;
}

/** Posteingang-Freitextfelder (inhalt/beschreibung) ins Rich-Text-Format der App bringen: enthält
 * der Text bereits HTML-Tags, wird er auf eine Whitelist sanitisiert und unverändert übernommen
 * (so wie der RTF-Editor selbst speichert); enthält er kein einziges Tag, wird er als reiner Text
 * maskiert und Zeilenumbrüche werden zu <br>. */
export function inboxTextToHtml(text: string): string {
  if (hasHtmlTag(text)) return sanitizeInboxHtml(text);
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}
