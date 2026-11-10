import { fmtDate, fmtDateTime, isEmptyHtml, taskLinkLabel } from './format';
import { formatDuration } from './timeTracking';
import { formatEuro } from './money';
import { contactLinkLabel, linkedContactIds } from './contacts';
import { abrechnungStatus, ABRECHNUNG_STATUS_LABELS } from './abrechnungStatus';
import { taskDocumentationLabel } from './taskDocumentation';
import type {
  Abrechnung,
  Contact,
  CustomerModule,
  DocEntryValue,
  DocSectionDef,
  ErpModule,
  Project,
  ProjectCache,
  ProjectDocumentationArea,
  ProjectModuleConfig,
  ProjectStatusEntry,
  ProjectTimeType,
  TimeEntry,
} from '../types/entities';

const CURRENT_STATE_KEY = '_currentProjectState';
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

function addRichContent(parent: HTMLElement, html: string | undefined, emptyText: string) {
  const content = parent.ownerDocument.createElement('div');
  content.className = 'rich-content';
  if (html?.trim()) content.appendChild(safeRichContent(parent.ownerDocument, html));
  else addText(content, 'p', emptyText, 'empty');
  parent.appendChild(content);
  return content;
}

function addSection(main: HTMLElement, title: string, countLabel?: string) {
  const section = main.ownerDocument.createElement('section');
  section.className = 'report-section';
  const head = main.ownerDocument.createElement('div');
  head.className = 'section-head';
  addText(head, 'h2', title);
  if (countLabel) addText(head, 'span', countLabel, 'section-count');
  section.appendChild(head);
  main.appendChild(section);
  return section;
}

function addTags(parent: HTMLElement, tags: string[]) {
  if (!tags.length) return;
  const wrap = parent.ownerDocument.createElement('div');
  wrap.className = 'tags';
  tags.forEach((tag) => addText(wrap, 'span', tag, 'tag'));
  parent.appendChild(wrap);
}

function addTable(parent: HTMLElement, headers: string[], rows: string[][], emptyText: string) {
  const table = parent.ownerDocument.createElement('table');
  const thead = parent.ownerDocument.createElement('thead');
  const headRow = parent.ownerDocument.createElement('tr');
  headers.forEach((header) => addText(headRow, 'th', header));
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = parent.ownerDocument.createElement('tbody');
  if (!rows.length) {
    const row = parent.ownerDocument.createElement('tr');
    const cell = parent.ownerDocument.createElement('td');
    cell.colSpan = headers.length;
    cell.className = 'empty';
    cell.textContent = emptyText;
    row.appendChild(cell);
    tbody.appendChild(row);
  } else {
    rows.forEach((cells) => {
      const row = parent.ownerDocument.createElement('tr');
      cells.forEach((cell) => addText(row, 'td', cell));
      tbody.appendChild(row);
    });
  }
  table.appendChild(tbody);
  parent.appendChild(table);
}

function contactNames(contacts: Contact[], ids: string[]): string {
  const names = contacts.filter((contact) => ids.includes(contact.id)).map(contactLinkLabel);
  return names.join(', ');
}

const STYLE = `
  @page{size:A4;margin:16mm 15mm 17mm}
  *{box-sizing:border-box}
  body{margin:0;color:#171717;background:#fff;font:9.5pt/1.5 Arial,sans-serif}
  main{max-width:181mm;margin:auto}
  .document-head{padding-bottom:9mm;border-bottom:3px solid #111}
  .eyebrow{margin-bottom:2mm;color:#666;font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
  h1{margin:0;font-size:24pt;line-height:1.15}
  .project-sub{margin-top:2mm;color:#555;font-size:10.5pt}
  .summary{margin-top:4mm;color:#666;font-size:8.5pt}
  .meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:7mm 0}
  .meta{padding:3mm;background:#f4f4f4;border-left:2px solid #111}
  .meta span{display:block;color:#666;font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .meta strong{display:block;margin-top:1mm;font-size:9.5pt}
  .tags{display:flex;flex-wrap:wrap;gap:2mm;margin-top:3mm}
  .tag{padding:1mm 2.5mm;border:1px solid #aaa;border-radius:10mm;font-size:7.5pt}
  .report-section{margin-top:11mm;break-before:page}
  .section-head{display:flex;align-items:baseline;justify-content:space-between;gap:4mm;margin-bottom:5mm;padding-bottom:2mm;border-bottom:2px solid #111}
  .section-head h2{margin:0;font-size:15pt;text-transform:uppercase;letter-spacing:.03em}
  .section-count{color:#666;font-size:8.5pt}
  h3{margin:0 0 2mm;font-size:11pt}
  h4{margin:4mm 0 1.5mm;font-size:9.5pt;text-transform:uppercase;letter-spacing:.04em;color:#555}
  .entry{margin:0 0 6mm;padding-bottom:5mm;border-bottom:1px solid #ddd;break-inside:avoid-page}
  .entry:last-child{border-bottom:0}
  .entry-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:3mm;margin-bottom:2mm}
  .entry-head time{color:#555;font-size:8.5pt;font-weight:700}
  .badge{padding:0.5mm 2.5mm;border:1px solid #111;border-radius:10mm;font-size:7.5pt;font-weight:700;text-transform:uppercase}
  .rich-content{font-size:9.3pt}
  .rich-content>:first-child{margin-top:0}
  .rich-content>:last-child{margin-bottom:0}
  .rich-content h1,.rich-content h2,.rich-content h3,.rich-content h4{margin:3mm 0 1.5mm;font-size:10pt;text-transform:none;letter-spacing:0}
  .rich-content a{color:#111}
  .empty{color:#888;font-style:italic}
  .sub-entry{margin:3mm 0 3mm 4mm;padding-left:3mm;border-left:2px solid #ddd;break-inside:avoid-page}
  .area-block{margin-bottom:8mm}
  table{width:100%;border-collapse:collapse;margin-bottom:3mm;break-inside:auto}
  th,td{padding:1.8mm 2.2mm;border:1px solid #ccc;text-align:left;vertical-align:top;font-size:8pt}
  th{background:#eee;font-size:7pt;text-transform:uppercase;letter-spacing:.03em}
  tr{break-inside:avoid}
  .folder-heading{margin:5mm 0 2mm;font-size:9pt;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:.03em}
  .links{margin-top:2mm;font-size:8pt;color:#444}
  .footer{margin-top:12mm;padding-top:3mm;border-top:1px solid #bbb;color:#777;font-size:7.5pt}
  .no-print{margin:0 0 8mm;padding:4mm;background:#111;color:#fff;text-align:center}
  .no-print button{margin-left:4mm;padding:2mm 4mm;background:#fff;border:0;border-radius:1mm;font-weight:700;cursor:pointer}
  @media print{.no-print{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

export interface FullProjectExportInput {
  project: Project;
  data: ProjectCache;
  docDefs: DocSectionDef[];
  timeEntries: TimeEntry[];
  abrechnungen: Abrechnung[];
  modules: ErpModule[];
  customerModules: CustomerModule[];
  projectTimeTypes: ProjectTimeType[];
}

export function exportFullProjectToPdf({ project, data, docDefs, timeEntries, abrechnungen, modules, customerModules, projectTimeTypes }: FullProjectExportInput) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Das Exportfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Anwendung erlauben.');
  popup.opener = null;
  const doc = popup.document;
  doc.title = `${project.name} - Projektakte`;
  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.appendChild(style);
  const toolbar = doc.createElement('div');
  toolbar.className = 'no-print';
  toolbar.textContent = 'PDF-Vorschau';
  const printButton = doc.createElement('button');
  printButton.textContent = 'Als PDF speichern / Drucken';
  printButton.onclick = () => popup.print();
  toolbar.appendChild(printButton);
  doc.body.appendChild(toolbar);

  const main = doc.createElement('main');

  // Deckblatt
  const header = doc.createElement('header');
  header.className = 'document-head';
  addText(header, 'div', 'Projektakte · Gesamtexport', 'eyebrow');
  addText(header, 'h1', project.name);
  addText(header, 'div', [project.kunde, project.typ, project.status].filter(Boolean).join(' · '), 'project-sub');
  addText(header, 'div', `Erstellt am ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, 'summary');
  main.appendChild(header);

  const metaGrid = doc.createElement('div');
  metaGrid.className = 'meta-grid';
  [
    ['Kürzel', project.kuerzel || '—'],
    ['Angelegt am', fmtDate(project.createdAt?.slice(0, 10))],
    ['Aktuelle Version', project.aktuelleVersion || '—'],
    ['Teilprojekte', data.subprojects.length ? data.subprojects.map((sp) => sp.name).join(', ') : '—'],
  ].forEach(([label, value]) => {
    const box = doc.createElement('div');
    box.className = 'meta';
    addText(box, 'span', label);
    addText(box, 'strong', value);
    metaGrid.appendChild(box);
  });
  main.appendChild(metaGrid);

  addText(main, 'div', `${data.tasks.length} Aufgaben · ${data.comms.length} Kommunikationseinträge · ${data.contacts.length} Kontakte · ${data.notes.length} Notizen · ${timeEntries.length} Zeitbuchungen (${formatDuration(timeEntries.reduce((sum, e) => sum + e.durationMinutes, 0))}) · ${abrechnungen.length} Abrechnungen`, 'summary');
  addRichContent(main, project.beschreibung, 'Keine Projektinfo hinterlegt.');

  // Kontakte
  const contactsSection = addSection(main, 'Kontakte', `${data.contacts.length} Einträge`);
  if (!data.contacts.length) addText(contactsSection, 'p', 'Keine Kontakte hinterlegt.', 'empty');
  data.contacts.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).forEach((contact) => {
    const entry = doc.createElement('article');
    entry.className = 'entry';
    const head = doc.createElement('div');
    head.className = 'entry-head';
    addText(head, 'h3', contact.name);
    if (contact.rolle) addText(head, 'span', contact.rolle, 'badge');
    entry.appendChild(head);
    addText(entry, 'div', [contact.telefon, contact.email].filter(Boolean).join(' · ') || '—', 'links');
    if (!isEmptyHtml(contact.notiz)) addRichContent(entry, contact.notiz, '');
    contactsSection.appendChild(entry);
  });

  // Aufgaben
  const tasksSection = addSection(main, 'Aufgaben', `${data.tasks.length} Einträge`);
  if (!data.tasks.length) addText(tasksSection, 'p', 'Keine Aufgaben vorhanden.', 'empty');
  data.tasks.slice().sort((a, b) => (a.nr || 0) - (b.nr || 0)).forEach((task) => {
    const entry = doc.createElement('article');
    entry.className = 'entry';
    const head = doc.createElement('div');
    head.className = 'entry-head';
    addText(head, 'time', `#${task.nr || '—'}`);
    addText(head, 'h3', task.titel);
    addText(head, 'span', task.status, 'badge');
    entry.appendChild(head);
    const tags: string[] = [];
    if (task.teilprojekt) tags.push(`Teilprojekt: ${task.teilprojekt}`);
    if (task.kategorie) tags.push(task.kategorie);
    if (task.faelligAm) tags.push(`Fällig: ${fmtDate(task.faelligAm)}`);
    (task.termine || []).forEach((termin) => tags.push(`Termin: ${fmtDate(termin)}`));
    const contactLabel = contactNames(data.contacts, linkedContactIds(task));
    if (contactLabel) tags.push(`Ansprechpartner: ${contactLabel}`);
    if (task.wartetAuf) tags.push(`Wartet auf: ${task.wartetAuf}${task.wartetSeit ? ` (seit ${fmtDate(task.wartetSeit)})` : ''}`);
    (task.afns || []).forEach((afn) => tags.push(`AFN ${afn}`));
    if (taskDocumentationLabel(task)) tags.push(taskDocumentationLabel(task));
    if (task.naechsteBesprechung) tags.push('Für nächste Besprechung vorgemerkt');
    const moduleNames = (task.moduleIds || []).map((id) => modules.find((m) => m.id === id)?.name).filter(Boolean) as string[];
    if (moduleNames.length) tags.push(`Module: ${moduleNames.join(', ')}`);
    addTags(entry, tags);
    addText(entry, 'div', `Erstellt: ${fmtDate(task.erstelltAm?.slice(0, 10))}${task.abgeschlossenAm ? ` · Abgeschlossen: ${fmtDate(task.abgeschlossenAm.slice(0, 10))}` : ''}`, 'links');
    if (!isEmptyHtml(task.anforderung)) { addText(entry, 'h4', 'Anforderung'); addRichContent(entry, task.anforderung, ''); }
    if (!isEmptyHtml(task.aktuellerStand)) { addText(entry, 'h4', 'Aktueller Stand'); addRichContent(entry, task.aktuellerStand, ''); }
    const verlauf = (task.verlauf || []).slice().sort((a, b) => b.datum.localeCompare(a.datum) || b.updatedAt.localeCompare(a.updatedAt));
    if (verlauf.length) {
      addText(entry, 'h4', 'Verlauf');
      verlauf.forEach((item) => {
        const sub = doc.createElement('div');
        sub.className = 'sub-entry';
        addText(sub, 'div', `${fmtDate(item.datum)} · ${item.titel}`, 'links');
        addRichContent(sub, item.content, '');
        entry.appendChild(sub);
      });
    }
    const history = (task.history || []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (history.length) {
      addText(entry, 'h4', 'Änderungsprotokoll');
      history.forEach((item) => addText(entry, 'div', `${fmtDateTime(item.timestamp)} · ${item.text}`, 'links'));
    }
    const links: string[] = [];
    if (task.fremdverknuepfung) links.push(`Fremdverknüpfung: ${task.fremdverknuepfung}`);
    if (task.ticketsystemVerknuepfung) links.push(`Ticketsystem: ${task.ticketsystemVerknuepfung}`);
    if (links.length) addText(entry, 'div', links.join(' · '), 'links');
    tasksSection.appendChild(entry);
  });

  // Kommunikation
  const commsSection = addSection(main, 'Kommunikation', `${data.comms.length} Einträge`);
  const sortedComms = data.comms.slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
  if (!sortedComms.length) addText(commsSection, 'p', 'Keine Kommunikationseinträge vorhanden.', 'empty');
  sortedComms.forEach((comm) => {
    const entry = doc.createElement('article');
    entry.className = 'entry';
    const head = doc.createElement('div');
    head.className = 'entry-head';
    addText(head, 'time', fmtDate(comm.datum));
    addText(head, 'span', comm.kanal, 'badge');
    addText(head, 'h3', comm.betreff || '(kein Betreff)');
    entry.appendChild(head);
    const tags: string[] = [];
    const contactLabel = contactNames(data.contacts, linkedContactIds(comm));
    if (contactLabel) tags.push(contactLabel);
    if (comm.teilprojekt) tags.push(`Teilprojekt: ${comm.teilprojekt}`);
    (comm.afns || []).forEach((afn) => tags.push(`AFN ${afn}`));
    addTags(entry, tags);
    addRichContent(entry, comm.notiz, 'Keine Notiz hinterlegt.');
    const linkedTasks = data.tasks.filter((task) => (comm.taskIds || []).includes(task.id));
    if (linkedTasks.length) addText(entry, 'div', `Verknüpfte Aufgaben: ${linkedTasks.map(taskLinkLabel).join(', ')}`, 'links');
    commsSection.appendChild(entry);
  });

  // Dokumentation
  const storedAreas = (data.doc._documentationAreas as ProjectDocumentationArea[] | undefined) || [];
  const legacyCurrent = (data.doc[CURRENT_STATE_KEY] as DocEntryValue | undefined) || { content: '', updatedAt: null, afns: [] };
  const areas = storedAreas.length ? storedAreas : [{ id: 'general', name: 'Allgemein', current: legacyCurrent }];
  const statusHistory = (data.doc._statusHistory as ProjectStatusEntry[] | undefined) || [];
  const docSection = addSection(main, 'Dokumentation', `${areas.length} Bereich(e)`);
  areas.forEach((area) => {
    const block = doc.createElement('div');
    block.className = 'area-block';
    addText(block, 'h3', area.name);
    addText(block, 'div', area.current.updatedAt ? `Aktueller Stand · zuletzt aktualisiert ${fmtDateTime(area.current.updatedAt)}` : 'Aktueller Stand · noch nicht erfasst', 'links');
    addRichContent(block, area.current.content, 'Noch kein aktueller Stand erfasst.');
    const history = statusHistory.filter((item) => (item.bereichId || 'general') === area.id).slice().sort((a, b) => b.datum.localeCompare(a.datum) || b.updatedAt.localeCompare(a.updatedAt));
    if (history.length) {
      addText(block, 'h4', 'Verlauf');
      history.forEach((item) => {
        const sub = doc.createElement('div');
        sub.className = 'sub-entry';
        addText(sub, 'div', `${fmtDate(item.datum)} · ${item.titel}`, 'links');
        addRichContent(sub, item.content, '');
        block.appendChild(sub);
      });
    }
    docSection.appendChild(block);
  });
  const legacyEntries = docDefs.flatMap((definition) => {
    const entry = data.doc[definition.id];
    return entry && !Array.isArray(entry) && (entry.content || entry.afns?.length) ? [{ definition, entry }] : [];
  });
  if (legacyEntries.length) {
    addText(docSection, 'h3', 'Archiv (ältere Dokumentationsvorlagen)');
    legacyEntries.forEach(({ definition, entry }) => {
      const sub = doc.createElement('div');
      sub.className = 'sub-entry';
      addText(sub, 'div', definition.title, 'links');
      addRichContent(sub, entry.content, '');
      docSection.appendChild(sub);
    });
  }

  // Notizen
  const notesSection = addSection(main, 'Notizen', `${data.notes.length} Einträge`);
  if (!data.notes.length) addText(notesSection, 'p', 'Keine Notizen vorhanden.', 'empty');
  else {
    const folderName = (folderId: string | null | undefined) => (folderId ? data.noteFolders.find((f) => f.id === folderId)?.name || 'Unbekannter Ordner' : 'Ohne Ordner');
    const groups = new Map<string, typeof data.notes>();
    data.notes.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).forEach((note) => {
      const key = folderName(note.folderId);
      groups.set(key, [...(groups.get(key) || []), note]);
    });
    groups.forEach((notes, name) => {
      addText(notesSection, 'div', name, 'folder-heading');
      notes.forEach((note) => {
        const entry = doc.createElement('article');
        entry.className = 'entry';
        const head = doc.createElement('div');
        head.className = 'entry-head';
        addText(head, 'h3', note.titel);
        if (note.pinned) addText(head, 'span', 'Angeheftet', 'badge');
        entry.appendChild(head);
        addText(entry, 'div', `Zuletzt aktualisiert: ${fmtDateTime(note.updatedAt)}`, 'links');
        addRichContent(entry, note.inhalt, '');
        notesSection.appendChild(entry);
      });
    });
  }

  // Module
  const customerModuleRows = customerModules.filter((item) => item.kunde === project.kunde)
    .map((assignment) => ({ assignment, module: modules.find((item) => item.id === assignment.moduleId) }))
    .filter((row): row is { assignment: CustomerModule; module: ErpModule } => !!row.module);
  const moduleSection = addSection(main, 'Module', `${customerModuleRows.length} Einträge`);
  if (!customerModuleRows.length) addText(moduleSection, 'p', 'Keine Module zugeordnet.', 'empty');
  addTable(
    moduleSection,
    ['Obermodul', 'Modul', 'Vertrag / Angebot', 'Einrichtung', 'Projektdetails', 'Notizen'],
    customerModuleRows.map(({ assignment, module }) => {
      const parentName = modules.find((item) => item.id === module.parentId)?.name || module.name;
      const config: ProjectModuleConfig | undefined = data.moduleConfigs.find((item) => item.moduleId === module.id);
      return [
        parentName,
        module.name,
        `${assignment.commercialStatus === 'vertrag' ? 'Im Vertrag enthalten' : 'Nachlizenzierung'}${assignment.offerNumber ? ` (${assignment.offerNumber})` : ''}`,
        config?.einrichtungsstatus || 'nicht begonnen',
        config?.einrichtungsdetails || '—',
        config?.notizen || assignment.notizen || '—',
      ];
    }),
    'Keine Module zugeordnet.',
  );

  // Echtlauf-Zeitplan / Meilensteine
  const milestoneSection = addSection(main, 'Echtlauf-Zeitplan', `${data.timeline.length} Meilensteine`);
  if (!data.timeline.length) addText(milestoneSection, 'p', 'Keine Meilensteine vorhanden.', 'empty');
  data.timeline.slice().sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999')).forEach((milestone) => {
    const entry = doc.createElement('article');
    entry.className = 'entry';
    const head = doc.createElement('div');
    head.className = 'entry-head';
    addText(head, 'time', fmtDate(milestone.datum));
    addText(head, 'h3', milestone.titel);
    addText(head, 'span', milestone.status, 'badge');
    entry.appendChild(head);
    if (!isEmptyHtml(milestone.notiz)) addRichContent(entry, milestone.notiz, '');
    milestoneSection.appendChild(entry);
  });

  // Updates
  const updateSection = addSection(main, 'Update-Historie', `${data.updates.length} Einträge`);
  const sortedUpdates = data.updates.slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
  if (!sortedUpdates.length) addText(updateSection, 'p', 'Keine Update-Einträge vorhanden.', 'empty');
  sortedUpdates.forEach((update) => {
    const entry = doc.createElement('article');
    entry.className = 'entry';
    const head = doc.createElement('div');
    head.className = 'entry-head';
    addText(head, 'time', fmtDate(update.datum));
    addText(head, 'h3', update.titel);
    if (update.revision) addText(head, 'span', update.revision, 'badge');
    entry.appendChild(head);
    addRichContent(entry, update.beschreibung, '');
    updateSection.appendChild(entry);
  });

  // Zeiterfassung
  const timeSection = addSection(main, 'Zeiterfassung', `${timeEntries.length} Buchungen · ${formatDuration(timeEntries.reduce((sum, e) => sum + e.durationMinutes, 0))}`);
  addTable(
    timeSection,
    ['Datum', 'Start', 'Ende', 'Dauer', 'Zuordnung', 'Notiz'],
    timeEntries.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((entry) => {
      const task = entry.taskId ? data.tasks.find((item) => item.id === entry.taskId) : undefined;
      const typeName = entry.timeTypeName || projectTimeTypes.find((type) => type.id === entry.timeTypeId)?.name;
      const assignment = task ? `Aufgabe #${task.nr} · ${task.titel}` : typeName || '—';
      return [
        fmtDate(entry.startedAt.slice(0, 10)),
        new Date(entry.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        new Date(entry.endedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        formatDuration(entry.durationMinutes),
        assignment,
        entry.note || '—',
      ];
    }),
    'Keine Zeitbuchungen vorhanden.',
  );

  // Abrechnungen
  const abrechnungSection = addSection(main, 'Abrechnungen', `${abrechnungen.length} Einträge`);
  addTable(
    abrechnungSection,
    ['Datum', 'Art', 'Dauer', 'Wert', 'Provision', 'Status', 'Teilprojekt', 'Bemerkung'],
    abrechnungen.slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || '')).map((item) => {
      const details: string[] = [];
      if (item.modul) details.push(`Modul: ${item.modul}`);
      if (item.tageVorOrt) details.push(`${item.tageVorOrt} Tag(e) vor Ort`);
      if (item.reisekostenCents) details.push(`Reisekosten ${formatEuro(item.reisekostenCents)}`);
      if (item.fahrzeitMinutes) details.push(`Fahrzeit ${formatDuration(item.fahrzeitMinutes)}`);
      if (item.belegNr) details.push(`Beleg ${item.belegNr}`);
      if (item.bemerkung) details.push(item.bemerkung);
      return [
        fmtDate(item.datum),
        item.art,
        formatDuration(item.minutes),
        formatEuro(item.wertCents),
        formatEuro(item.provisionCents),
        `${ABRECHNUNG_STATUS_LABELS[abrechnungStatus(item)]}${item.rechnungsdatum ? ` (${fmtDate(item.rechnungsdatum)})` : ''}`,
        item.teilprojekt || '—',
        details.join(' · ') || '—',
      ];
    }),
    'Keine Abrechnungen vorhanden.',
  );

  // KI-Zusammenfassung
  if (data.aiSummary?.points.length) {
    const aiSection = addSection(main, 'KI-Zusammenfassung', `aktualisiert ${fmtDateTime(data.aiSummary.generatedAt)}`);
    const list = doc.createElement('ul');
    data.aiSummary.points.forEach((point) => addText(list, 'li', point));
    aiSection.appendChild(list);
  }

  addText(main, 'footer', `Erstellt aus der Projektzentrale · ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, 'footer');
  doc.body.appendChild(main);
  popup.focus();
  popup.setTimeout(() => popup.print(), 250);
}
