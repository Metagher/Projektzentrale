import { fmtDate, taskLinkLabel } from './format';
import { contactLinkLabel, linkedContactIds } from './contacts';
import type { Comm, Contact, Project, Task } from '../types/entities';

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'CODE', 'PRE']);

function safeRichContent(targetDocument: Document, html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html || '', 'text/html');
  const fragment = targetDocument.createDocumentFragment();
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(targetDocument.createTextNode(node.textContent || '')); return; }
    if (!(node instanceof Element)) return;
    if (!ALLOWED_TAGS.has(node.tagName)) { node.childNodes.forEach((child) => copy(child, parent)); return; }
    const element = targetDocument.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) { element.setAttribute('href', href); element.setAttribute('target', '_blank'); }
    }
    node.childNodes.forEach((child) => copy(child, element));
    parent.appendChild(element);
  }
  parsed.body.childNodes.forEach((node) => copy(node, fragment));
  return fragment;
}

function addText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string) {
  const element = parent.ownerDocument.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

export function exportCommsToPdf(project: Project, comms: Comm[], contacts: Contact[], tasks: Task[]) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Das Exportfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Anwendung erlauben.');
  popup.opener = null;
  const doc = popup.document;
  doc.title = `Kommunikation - ${project.name}`;
  const style = doc.createElement('style');
  style.textContent = `
    @page{size:A4;margin:17mm 16mm 18mm}*{box-sizing:border-box}body{margin:0;color:#171717;background:#fff;font:10.5pt/1.55 Arial,sans-serif}main{max-width:178mm;margin:auto}.document-head{padding-bottom:9mm;border-bottom:2px solid #111}.eyebrow{margin-bottom:2mm;color:#666;font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:23pt;line-height:1.15}.project{margin-top:2mm;color:#555;font-size:10pt}.summary{margin-top:4mm;color:#666;font-size:8.5pt}.entry{margin:8mm 0;padding-bottom:6mm;border-bottom:1px solid #ddd;break-inside:avoid-page}.entry-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:3mm;margin-bottom:3mm}.entry-head .channel{padding:1mm 2.5mm;border:1px solid #111;border-radius:10mm;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.entry-head time{color:#555;font-size:9pt;font-weight:700}.entry-head .contacts{color:#555;font-size:9pt}.entry-head .tag{padding:0.5mm 2.5mm;background:#f0f0f0;border-radius:10mm;font-size:7.5pt}.entry h2{margin:0 0 3mm;font-size:12.5pt}.rich-content{font-size:9.5pt}.rich-content>:first-child{margin-top:0}.rich-content>:last-child{margin-bottom:0}.rich-content h1,.rich-content h2,.rich-content h3,.rich-content h4{margin:3mm 0 1.5mm;font-size:10.5pt}.rich-content a{color:#111}.empty{color:#888;font-style:italic}.links{margin-top:3mm;font-size:8.5pt;color:#444}.footer{margin-top:12mm;padding-top:3mm;border-top:1px solid #bbb;color:#777;font-size:7.5pt}.no-print{margin:0 0 8mm;padding:4mm;background:#111;color:#fff;text-align:center}.no-print button{margin-left:4mm;padding:2mm 4mm;background:#fff;border:0;border-radius:1mm;font-weight:700;cursor:pointer}@media print{.no-print{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  doc.head.appendChild(style);
  const toolbar = doc.createElement('div'); toolbar.className = 'no-print'; toolbar.textContent = 'PDF-Vorschau';
  const printButton = doc.createElement('button'); printButton.textContent = 'Als PDF speichern / Drucken'; printButton.onclick = () => popup.print(); toolbar.appendChild(printButton); doc.body.appendChild(toolbar);

  const main = doc.createElement('main');
  const header = doc.createElement('header'); header.className = 'document-head';
  addText(header, 'div', 'Kommunikationsverlauf', 'eyebrow');
  addText(header, 'h1', project.name);
  addText(header, 'div', project.kunde || '', 'project');
  addText(header, 'div', `${comms.length} Einträge · Erstellt am ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, 'summary');
  main.appendChild(header);

  const sorted = comms.slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
  if (!sorted.length) {
    addText(main, 'p', 'Keine Kommunikationseinträge vorhanden.', 'empty');
  }
  sorted.forEach((c) => {
    const article = doc.createElement('article'); article.className = 'entry';
    const head = doc.createElement('div'); head.className = 'entry-head';
    addText(head, 'span', c.kanal, 'channel');
    addText(head, 'time', fmtDate(c.datum));
    const entryContacts = contacts.filter((contact) => linkedContactIds(c).includes(contact.id));
    if (entryContacts.length) addText(head, 'span', entryContacts.map(contactLinkLabel).join(', '), 'contacts');
    if (c.teilprojekt?.trim()) addText(head, 'span', c.teilprojekt.trim(), 'tag');
    (c.afns || []).forEach((afn) => addText(head, 'span', `AFN ${afn}`, 'tag'));
    article.appendChild(head);
    addText(article, 'h2', c.betreff || '(kein Betreff)');
    const content = doc.createElement('div'); content.className = 'rich-content';
    if (c.notiz?.trim()) content.appendChild(safeRichContent(doc, c.notiz));
    else addText(content, 'p', 'Keine Notiz hinterlegt.', 'empty');
    article.appendChild(content);
    const linkedTasks = tasks.filter((task) => (c.taskIds || []).includes(task.id));
    if (linkedTasks.length) addText(article, 'div', `Verknüpfte Aufgaben: ${linkedTasks.map(taskLinkLabel).join(', ')}`, 'links');
    main.appendChild(article);
  });

  addText(main, 'footer', `Erstellt aus der Projektzentrale · ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, 'footer');
  doc.body.appendChild(main);
  popup.focus();
  popup.setTimeout(() => popup.print(), 250);
}
