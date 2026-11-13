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
