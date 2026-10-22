// A small PDF writer for the results export: A4 pages of text in Helvetica, nothing else.
// Text is encoded as WinAnsi (Windows-1252), which covers German and French; other characters
// become "?".

const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function encode(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    out.push(cp < 0x80 || (cp >= 0xa0 && cp <= 0xff) ? cp : CP1252[cp] ?? 63);
  }
  return out;
}

/** A PDF string literal: (…) with \, ( and ) escaped, as Latin-1 characters of the WinAnsi bytes. */
function literal(text: string) {
  return '(' + encode(text).map((b) => (b === 0x5c || b === 0x28 || b === 0x29 ? '\\' + String.fromCharCode(b) : String.fromCharCode(b))).join('') + ')';
}

// Average Helvetica widths (per 1000 units) are close enough to wrap lines.
const avgWidth = (size: number, bold: boolean) => size * (bold ? 0.56 : 0.52);

export type Line = { text: string; size?: number; bold?: boolean; gap?: number; indent?: number; muted?: boolean };

export function renderPdf(title: string, lines: Line[]): Uint8Array {
  const W = 595;
  const H = 842;
  const M = 56;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = H - M;
  const newPage = () => {
    if (ops.length) pages.push(ops.join('\n'));
    ops = [];
    y = H - M;
  };
  const footer = (n: number) => `BT /F1 8 Tf 0.4 0.4 0.4 rg ${M} 28 Td ${literal(`${title} · Seite ${n}`)} Tj ET`;

  for (const l of lines) {
    const size = l.size ?? 10;
    const bold = !!l.bold;
    const indent = l.indent ?? 0;
    const max = Math.max(10, Math.floor((W - 2 * M - indent) / avgWidth(size, bold)));
    // Wrap at spaces.
    const words = l.text.split(' ');
    const wrapped: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > max && cur) {
        wrapped.push(cur);
        cur = w;
      } else cur = (cur + ' ' + w).trim();
    }
    wrapped.push(cur);
    y -= l.gap ?? 0;
    for (const text of wrapped) {
      if (y - size < M) newPage();
      y -= size * 1.35;
      const color = l.muted ? '0.35 0.35 0.4 rg' : '0.04 0.04 0.06 rg';
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} ${M + indent} ${y.toFixed(1)} Td ${literal(text)} Tj ET`);
    }
  }
  newPage();

  const objects: string[] = [];
  const add = (body: string) => objects.push(body) ;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PAGES');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  pages.forEach((content, i) => {
    const stream = `${content}\n${footer(i + 1)}`;
    add(`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const contentRef = objects.length;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentRef} 0 R >>`);
    kids.push(objects.length);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  add(`<< /Title ${literal(title)} /Producer (Planary Tournament) >>`);
  const info = objects.length;

  // Byte offsets: every character here is one byte (Latin-1).
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
