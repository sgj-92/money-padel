// ===================== PICTURES AS ONE PDF =====================
// A whole pack, or a whole deck, saved as one PDF file: one page per
// picture, each page exactly the picture's shape (a 1080 x 1350 slide is a
// 4:5 page; a tall module sheet is a tall page). The pictures are the same
// ones CardPainter draws for sharing, embedded as JPEG, so the PDF shows
// what the pictures show. No library: a PDF of images is a short, fixed
// structure, written here.
//
// Pure: bytes in, bytes out. No page, no app state.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PdfDoc = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // The community (config/club.js): the page's, or Money Padel in Node.
  const club = () => (typeof CLUB !== 'undefined' ? CLUB : require('../../config/club.js').CLUB);
  'use strict';

  // 1080 px wide is 540 pt (7.5 in): print-sized, and the same scale for
  // every page so slides and sheets line up.
  const PT_PER_PX = 0.5;

  const ascii = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };

  // Text for the document's Title: UTF-16BE with a byte-order mark, as hex,
  // so a name with an accent or a dash survives.
  function textString(s) {
    let hex = 'FEFF';
    for (const ch of String(s)) {
      const cp = ch.codePointAt(0);
      const units = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
      units.forEach((u) => { hex += u.toString(16).toUpperCase().padStart(4, '0'); });
    }
    return `<${hex}>`;
  }

  const num = (n) => String(Math.round(n * 100) / 100);

  // pages: [{ jpeg: Uint8Array, width, height }] (pixels) -> Uint8Array.
  function build(pages, { title = '', author = club().name } = {}) {
    if (!Array.isArray(pages) || !pages.length) throw new Error('PdfDoc: no pages');
    pages.forEach((p, i) => {
      if (!(p.jpeg instanceof Uint8Array) || p.jpeg[0] !== 0xff || p.jpeg[1] !== 0xd8) throw new Error(`PdfDoc: page ${i + 1} is not a JPEG`);
      if (!(p.width > 0 && p.height > 0)) throw new Error(`PdfDoc: page ${i + 1} has no size`);
    });

    // Objects: 1 catalog, 2 page tree, 3 info, then per page: page, content, image.
    const chunks = [];
    const offsets = [];
    let length = 0;
    const put = (part) => { const b = typeof part === 'string' ? ascii(part) : part; chunks.push(b); length += b.length; };
    const obj = (n, body) => { offsets[n] = length; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };

    put('%PDF-1.4\n');
    put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // a binary comment: "this file has binary data"

    const pageRef = (i) => 4 + i * 3;
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => put(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageRef(i)} 0 R`).join(' ')}] >>`));
    obj(3, () => put(`<< /Title ${textString(title)} /Author ${textString(author)} /Producer ${textString(club().name)} >>`));

    pages.forEach((p, i) => {
      const w = p.width * PT_PER_PX, h = p.height * PT_PER_PX;
      const page = pageRef(i), content = page + 1, image = page + 2;
      const draw = `q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q`;
      obj(page, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`));
      obj(content, () => { put(`<< /Length ${draw.length} >>\nstream\n`); put(draw); put('\nendstream'); });
      obj(image, () => {
        put(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
        put(p.jpeg);
        put('\nendstream');
      });
    });

    const count = 3 + pages.length * 3;
    const xref = length;
    let table = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= count; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    put(table);
    put(`trailer\n<< /Size ${count + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(length);
    let at = 0;
    chunks.forEach((c) => { out.set(c, at); at += c.length; });
    return out;
  }

  return { PT_PER_PX, build, textString };
});
