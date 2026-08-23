import { fmtDate } from './format';
import type { Contact, Project, Task } from '../types/entities';

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

function addRichSection(parent: HTMLElement, title: string, html: string | undefined, emptyText: string) {
  const section = parent.ownerDocument.createElement('section');
  section.className = 'content-section';
  addText(section, 'h2', title);
  const content = parent.ownerDocument.createElement('div');
  content.className = 'rich-content';
  if (html?.trim()) content.appendChild(safeRichContent(parent.ownerDocument, html));
  else addText(content, 'p', emptyText, 'empty');
  section.appendChild(content);
  parent.appendChild(section);
}

export function exportTaskToPdf(project: Project, task: Task, contact?: Contact) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Das Exportfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Anwendung erlauben.');
  popup.opener = null;
  const doc = popup.document;
  doc.title = `Aufgabe ${task.nr || ''} - ${task.titel}`;
  const style = doc.createElement('style');
  style.textContent = `
    @page{size:A4;margin:17mm 16mm 18mm}*{box-sizing:border-box}body{margin:0;color:#171717;background:#fff;font:10.5pt/1.55 Arial,sans-serif}main{max-width:178mm;margin:auto}.document-head{padding-bottom:9mm;border-bottom:2px solid #111}.eyebrow{margin-bottom:2mm;color:#666;font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:23pt;line-height:1.15}h2{margin:0 0 4mm;font-size:12pt;text-transform:uppercase;letter-spacing:.05em}.project{margin-top:2mm;color:#555;font-size:10pt}.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin:7mm 0}.meta{padding:3mm;background:#f4f4f4;border-left:2px solid #111}.meta span{display:block;color:#666;font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.meta strong{display:block;margin-top:1mm;font-size:9.5pt}.tags{display:flex;flex-wrap:wrap;gap:2mm;margin-top:4mm}.tag{padding:1mm 2.5mm;border:1px solid #aaa;border-radius:10mm;font-size:8pt}.content-section{margin:8mm 0;break-inside:avoid-page}.rich-content{padding:5mm;border:1px solid #ddd;border-radius:2mm}.rich-content>:first-child{margin-top:0}.rich-content>:last-child{margin-bottom:0}.rich-content h1,.rich-content h2,.rich-content h3,.rich-content h4{margin:4mm 0 2mm;font-size:11pt;text-transform:none;letter-spacing:0}.rich-content a{color:#111}.empty{color:#888;font-style:italic}.history{margin-top:9mm}.history-entry{position:relative;margin:0 0 5mm;padding:0 0 5mm 8mm;border-bottom:1px solid #ddd;break-inside:avoid-page}.history-entry:before{content:'';position:absolute;left:1mm;top:2mm;width:2.5mm;height:2.5mm;background:#111;border-radius:50%}.history-head{display:flex;align-items:baseline;justify-content:space-between;gap:4mm;margin-bottom:2mm}.history-head h3{margin:0;font-size:11pt}.history-head time{color:#666;font-size:8pt}.history-entry .rich-content{padding:0;border:0}.links{margin-top:7mm;padding-top:4mm;border-top:1px solid #ddd;font-size:8.5pt}.links a{display:block;color:#111;word-break:break-all}.footer{margin-top:12mm;padding-top:3mm;border-top:1px solid #bbb;color:#777;font-size:7.5pt}.no-print{margin:0 0 8mm;padding:4mm;background:#111;color:#fff;text-align:center}.no-print button{margin-left:4mm;padding:2mm 4mm;background:#fff;border:0;border-radius:1mm;font-weight:700;cursor:pointer}@media print{.no-print{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  doc.head.appendChild(style);
  const toolbar = doc.createElement('div'); toolbar.className = 'no-print'; toolbar.textContent = 'PDF-Vorschau';
  const printButton = doc.createElement('button'); printButton.textContent = 'Als PDF speichern / Drucken'; printButton.onclick = () => popup.print(); toolbar.appendChild(printButton); doc.body.appendChild(toolbar);
  const main = doc.createElement('main');
  const header = doc.createElement('header'); header.className = 'document-head'; addText(header, 'div', 'Projektaufgabe', 'eyebrow'); addText(header, 'h1', task.titel); addText(header, 'div', `${project.name}${project.kunde ? ` · ${project.kunde}` : ''}`, 'project'); main.appendChild(header);
  const meta = doc.createElement('div'); meta.className = 'meta-grid';
  [['Aufgabennummer', `#${task.nr || '—'}`], ['Status', task.status], ['Fällig am', fmtDate(task.faelligAm)], ['Ansprechpartner', contact?.name || '—'], ['Erstellt am', fmtDate(task.erstelltAm?.slice(0, 10))], ['Abgeschlossen am', task.abgeschlossenAm ? fmtDate(task.abgeschlossenAm.slice(0, 10)) : '—']].forEach(([label, value]) => { const box = doc.createElement('div'); box.className = 'meta'; addText(box, 'span', label); addText(box, 'strong', value); meta.appendChild(box); });
  main.appendChild(meta);
  const tags = doc.createElement('div'); tags.className = 'tags'; if (task.teilprojekt) addText(tags, 'span', `Teilprojekt: ${task.teilprojekt}`, 'tag'); (task.afns || []).forEach((afn) => addText(tags, 'span', `AFN ${afn}`, 'tag')); if (task.wartetAuf) addText(tags, 'span', `Wartet auf: ${task.wartetAuf}`, 'tag'); if (task.wartetSeit) addText(tags, 'span', `Wartet seit: ${fmtDate(task.wartetSeit)}`, 'tag'); if (task.naechsteBesprechung) addText(tags, 'span', 'Für nächste Besprechung vorgemerkt', 'tag'); if (tags.childNodes.length) main.appendChild(tags);
  addRichSection(main, 'Anforderung', task.anforderung, 'Keine Anforderung hinterlegt.');
  addRichSection(main, 'Aktueller Stand', task.aktuellerStand, 'Kein aktueller Stand hinterlegt.');
  const historySection = doc.createElement('section'); historySection.className = 'history'; addText(historySection, 'h2', 'Verlauf');
  const history = (task.verlauf || []).slice().sort((a, b) => b.datum.localeCompare(a.datum) || b.updatedAt.localeCompare(a.updatedAt));
  if (!history.length) addText(historySection, 'p', 'Noch keine Verlaufseinträge.', 'empty');
  history.forEach((entry) => { const article = doc.createElement('article'); article.className = 'history-entry'; const head = doc.createElement('div'); head.className = 'history-head'; addText(head, 'h3', entry.titel); addText(head, 'time', fmtDate(entry.datum)); article.appendChild(head); const content = doc.createElement('div'); content.className = 'rich-content'; content.appendChild(safeRichContent(doc, entry.content)); article.appendChild(content); historySection.appendChild(article); });
  main.appendChild(historySection);
  const links = doc.createElement('section'); links.className = 'links';
  [[task.fremdverknuepfung, 'Fremdverknüpfung'], [task.ticketsystemVerknuepfung, 'Ticketsystem']].forEach(([href, label]) => { if (!href) return; const link = doc.createElement('a'); link.href = /^https?:\/\//i.test(href) ? href : `https://${href}`; link.textContent = `${label}: ${href}`; links.appendChild(link); });
  if (links.childNodes.length) main.appendChild(links);
  addText(main, 'footer', `Erstellt aus der Projektzentrale · ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, 'footer');
  doc.body.appendChild(main);
  popup.focus();
  popup.setTimeout(() => popup.print(), 250);
}
