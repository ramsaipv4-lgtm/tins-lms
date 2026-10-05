// A very small PDF writer (A4, Helvetica) for the college outputs: brand header band, text lines, tables
// and a vector QR code. No dependency; the QR matrix comes from the `qrcode` package the app already ships.
export interface Brand { primary: string; text: string }
export interface OrgInfo { name: string; brand?: { colours?: { primary?: string; text?: string } } | null }

const W = 595, H = 842, M = 48;

export function brandOf(org: OrgInfo): Brand {
  const c = org.brand?.colours ?? {};
  return { primary: /^#[0-9a-f]{6}$/i.test(c.primary ?? '') ? c.primary! : '#1d4ed8', text: /^#[0-9a-f]{6}$/i.test(c.text ?? '') ? c.text! : '#111827' };
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
}
const clean = (s: string): string => s.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');

export class Pdf {
  pages: string[][] = [];
  y = H - M;
  brand: Brand;
  header: { org: string; title: string; subtitle?: string };
  constructor(org: OrgInfo, title: string, subtitle?: string) {
    this.brand = brandOf(org);
    this.header = { org: org.name, title, subtitle };
    this.newPage();
  }
  private get ops(): string[] { return this.pages[this.pages.length - 1]; }
  newPage(): void {
    this.pages.push([]);
    this.y = H - M;
    const first = this.pages.length === 1;
    this.rect(0, H - 40, W, 40, this.brand.primary);
    this.text(M, H - 26, this.header.org, 14, true, '#ffffff');
    this.y = H - 40 - 28;
    if (first) {
      this.text(M, this.y, this.header.title, 20, true, this.brand.text); this.y -= 22;
      if (this.header.subtitle) { this.text(M, this.y, this.header.subtitle, 11, false, this.brand.text); this.y -= 18; }
      this.y -= 6;
    }
  }
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  text(x: number, y: number, s: string, size = 11, bold = false, color = '#111827'): void {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${clean(s)}) Tj ET`);
  }
  line(s: string, size = 11, bold = false): void {
    if (this.y < M + 20) this.newPage();
    const max = Math.floor((W - 2 * M) / (size * 0.5));
    const words = s.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > max) { this.text(M, this.y, cur, size, bold, this.brand.text); this.y -= size + 5; if (this.y < M + 20) this.newPage(); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    this.text(M, this.y, cur, size, bold, this.brand.text); this.y -= size + 5;
  }
  gap(n = 8): void { this.y -= n; }
  table(head: string[], rows: string[][], widths?: number[]): void {
    const total = W - 2 * M;
    const ws = widths ?? head.map(() => total / head.length);
    const draw = (cells: string[], bold: boolean, shade: boolean) => {
      if (this.y < M + 24) { this.newPage(); }
      if (shade) this.rect(M, this.y - 4, total, 18, this.brand.primary);
      let x = M + 4;
      cells.forEach((cell, i) => {
        const max = Math.max(3, Math.floor(ws[i] / 5.6));
        this.text(x, this.y, cell.length > max ? cell.slice(0, max - 1) + '.' : cell, 10, bold, shade ? '#ffffff' : this.brand.text);
        x += ws[i];
      });
      this.y -= 18;
    };
    draw(head, true, true);
    rows.forEach((r) => draw(r, false, false));
  }
  // `modules[row][col]` is true for a dark module.
  qr(modules: boolean[][], x: number, y: number, size: number): void {
    const n = modules.length, cell = size / n;
    this.rect(x - 4, y - 4, size + 8, size + 8, '#ffffff');
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules[r][c]) this.rect(x + c * cell, y + (n - 1 - r) * cell, cell + 0.2, cell + 0.2, '#000000');
  }
  build(): Uint8Array {
    const objs: string[] = [];
    const add = (s: string) => { objs.push(s); return objs.length; };
    const catalog = add(''); const pagesObj = add(''); const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const kids: number[] = [];
    for (const ops of this.pages) {
      const body = ops.join('\n');
      const content = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(out);
  }
}

export function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
}

// Hands a generated file to the browser as a download.
export function download(name: string, data: string | Uint8Array, type: string): void {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
