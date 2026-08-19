import { escapeHtml, fmtDateTime } from './format';
import type { Project, ProjectDocumentationArea } from '../types/entities';

function filenamePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '-').replace(/^-+|-+$/g, '') || 'projekt';
}

function safeRichHtml(value: string): string {
  const documentNode = new DOMParser().parseFromString(value, 'text/html');
  documentNode.querySelectorAll('script, iframe, object, embed, link, meta').forEach((node) => node.remove());
  documentNode.body.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
      if ((attribute.name === 'href' || attribute.name === 'src') && /^\s*javascript:/i.test(attribute.value)) element.removeAttribute(attribute.name);
    });
  });
  return documentNode.body.innerHTML;
}

export function exportCurrentProjectStatus(project: Project, areas: ProjectDocumentationArea[]): void {
  const generatedAt = new Date();
  const sections = areas.map((area) => {
    const content = area.current.content?.trim() ? safeRichHtml(area.current.content) : '<p><em>Noch kein aktueller Projektstand erfasst.</em></p>';
    const afns = area.current.afns?.length ? `<div class="afn"><strong>AFN:</strong> ${area.current.afns.map(escapeHtml).join(', ')}</div>` : '';
    const updated = area.current.updatedAt ? `Zuletzt aktualisiert: ${escapeHtml(fmtDateTime(area.current.updatedAt))}` : 'Noch nicht aktualisiert';
    return `<section><h2>${escapeHtml(area.name)}</h2><div class="meta">${updated}</div>${afns}<div class="content">${content}</div></section>`;
  }).join('');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(project.name)} – Aktueller Projektstand</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{max-width:900px;margin:0 auto;color:#111;background:#fff;font:11pt/1.5 Arial,sans-serif}header{padding-bottom:18px;border-bottom:3px solid #000}h1{margin:0;font-size:25pt}header p{margin:5px 0 0;color:#555}section{padding:22px 0;border-bottom:1px solid #aaa;break-inside:avoid}h2{margin:0 0 3px;font-size:16pt}.meta{color:#666;font-size:9pt}.afn{margin:10px 0;padding:7px 9px;color:#fff;background:#000;font-size:9pt}.content{margin-top:13px}.content p:first-child{margin-top:0}.content img{max-width:100%}footer{margin-top:22px;color:#777;font-size:8pt}@media print{body{max-width:none}}
  </style></head><body><header><h1>${escapeHtml(project.name)}</h1><p>Aktueller Projektstand${project.kunde ? ` · ${escapeHtml(project.kunde)}` : ''}</p></header>${sections}<footer>Exportiert am ${escapeHtml(new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(generatedAt))} · Projektzentrale</footer></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filenamePart(project.name)}-aktueller-projektstand.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
