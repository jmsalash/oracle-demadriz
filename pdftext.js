// A PDF's text, pulled out in the browser with PDF.js: no key, and the file never leaves this computer.
export const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
export const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
export const loadPdfjsFromCdn = () => import(/* webpackIgnore: true */ PDFJS_URL);

// Lines are rebuilt from the text pieces' positions; pages are joined by a blank line.
export async function pdfToText(data, { loadPdfjs = loadPdfjsFromCdn } = {}) {
  const pdfjs = await loadPdfjs();
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    let line = '', lines = [], lastY = null;
    for (const it of items) {
      if (typeof it.str !== 'string') continue;
      const y = it.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ''; lastY = null; } else if (y !== undefined) lastY = y;
    }
    lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
  }
  return pages.filter(Boolean).join('\n\n').trim();
}
