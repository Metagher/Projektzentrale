export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}

export function slug(status: string): string {
  return status.toLowerCase().replace(/\s+/g, '-');
}

export function defLevel(level: number | undefined): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, level || 1)) as 1 | 2 | 3;
}

export function hasEchtlauf(p: { typ: string }): boolean {
  return p.typ === 'Neukunde' || p.typ === 'Bestandskunde mit Echtläufen';
}

export function toLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(97 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let res = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      res += sym;
      n -= val;
    }
  }
  return res || 'I';
}

export function projectCode(p: { id: string; createdAt: string }): string {
  const d = new Date(p.createdAt || Date.now());
  return 'P-' + d.getFullYear().toString().slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-' + p.id.slice(-4).toUpperCase();
}

export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function truncateText(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '\n…[gekürzt]…' : str;
}

export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  return htmlToPlainText(html).length === 0;
}
