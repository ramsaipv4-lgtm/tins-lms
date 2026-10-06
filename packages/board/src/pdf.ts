// Board PDF writer: no dependency, so it runs in the browser and in node tests (AC-97).
// Each page is A4 portrait: the page title, the drawing as a JPEG, and the notebook ruling as vector lines.
// The ruling lives only here: the canvas the trainer draws on stays plain (SPEC AC-97).

export const A4 = { width: 595.28, height: 841.89 } as const;
export const RULING = { gap: 24, top: 72, bottom: 60 } as const;

export interface PdfImage { data: Uint8Array; width: number; height: number } // JPEG bytes
export interface PdfPage { title: string; image?: PdfImage | null }

/** y positions (PDF points, origin bottom-left) of the horizontal ruling lines, evenly spaced. */
export function rulingYs(height: number = A4.height, gap: number = RULING.gap, top: number = RULING.top, bottom: number = RULING.bottom): number[] {
  const ys: number[] = [];
  for (let y = height - top; y >= bottom; y -= gap) ys.push(round(y));
  return ys;
}

/** Largest size that fits `w` x `h` inside a box, keeping the aspect ratio (never enlarges past 1:1 of the box). */
export function fitInside(w: number, h: number, boxW: number, boxH: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const s = Math.min(boxW / w, boxH / h);
  return { width: round(w * s), height: round(h * s) };
}

const round = (n: number): number => Math.round(n * 100) / 100;
const enc = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/** A PDF literal string in WinAnsi: parentheses and backslashes escaped, anything outside Latin-1 becomes '?'. */
export function pdfText(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code < 32) out += ' ';
    else if (code > 255) out += '?';
    else out += ch;
  }
  return `(${out})`;
}

export function buildPdf(pages: PdfPage[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc(b) : b; chunks.push(u); length += u.length; };
  const obj = (n: number, body: Uint8Array | string, dict?: string) => {
    offsets[n] = length;
    if (dict === undefined) { push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); return; }
    const bytes = typeof body === 'string' ? enc(body) : body;
    push(`${n} 0 obj\n<< ${dict} /Length ${bytes.length} >>\nstream\n`); push(bytes); push('\nendstream\nendobj\n');
  };

  // Object numbers: 1 catalog, 2 page tree, 3 font, then per page: page, content, optional image.
  const total = pages.length;
  const pageObj: number[] = []; const contentObj: number[] = []; const imageObj: (number | null)[] = [];
  let next = 4;
  for (const p of pages) { pageObj.push(next++); contentObj.push(next++); imageObj.push(p.image ? next++ : null); }

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageObj.map((n) => `${n} 0 R`).join(' ')}] /Count ${total} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  const marginX = 36;
  const boxTop = A4.height - 84; const boxBottom = 48;
  pages.forEach((p, i) => {
    const ys = rulingYs();
    let c = '';
    if (p.image) {
      const fit = fitInside(p.image.width, p.image.height, A4.width - 2 * marginX, boxTop - boxBottom);
      const x = round((A4.width - fit.width) / 2); const y = round(boxTop - fit.height);
      c += `q ${fit.width} 0 0 ${fit.height} ${x} ${y} cm /Im0 Do Q\n`;
    }
    // Notebook ruling: full-width horizontal vector lines, drawn over the picture so they show on a white drawing too.
    c += `q 0.45 0.57 0.78 RG 0.8 w\n`;
    for (const y of ys) c += `0 ${y} m ${A4.width} ${y} l S\n`;
    c += 'Q\n';
    c += `BT /F1 14 Tf 0.1 0.1 0.1 rg ${marginX} ${round(A4.height - 44)} Td ${pdfText(p.title)} Tj ET\n`;
    obj(contentObj[i], c, '');
    const res = `/Font << /F1 3 0 R >>` + (p.image ? ` /XObject << /Im0 ${imageObj[i]} 0 R >>` : '');
    obj(pageObj[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << ${res} >> /Contents ${contentObj[i]} 0 R >>`);
    if (p.image) obj(imageObj[i]!, p.image.data, `/Type /XObject /Subtype /Image /Width ${p.image.width} /Height ${p.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`);
  });

  const count = next;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length); let at = 0;
  for (const ch of chunks) { out.set(ch, at); at += ch.length; }
  return out;
}
