import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * P6 acceptance — "Thai renders correctly in generated PDF (font check)".
 *
 * A pixel diff would only prove that *something* was drawn. What actually
 * distinguishes correct Thai from tofu is which font Chromium resolved: if
 * TH Sarabun New / Sarabun is missing from the Gotenberg image, Chromium falls
 * back to a Latin face and every Thai codepoint renders as a .notdef box. So
 * the check asserts on the PDF's embedded font set — the real failure mode.
 *
 * Needs the compose stack: GOTENBERG_URL=http://127.0.0.1:3010 (dev overlay).
 * Skipped when unset so the unit suite stays hermetic.
 */
const GOTENBERG_URL = process.env.GOTENBERG_URL;
const d = GOTENBERG_URL ? describe : describe.skip;

async function renderPdf(html: string): Promise<Buffer> {
  const form = new FormData();
  form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
  const res = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
  });
  expect(res.status, await res.clone().text()).toBe(200);
  return Buffer.from(await res.arrayBuffer());
}

// PDF font resources survive as plain `/BaseFont /ABCDEF+Name` entries even when
// the content streams are compressed, so a byte scan is enough.
function baseFonts(pdf: Buffer): string[] {
  const names = pdf.toString('latin1').match(/\/BaseFont\s*\/([#+A-Za-z0-9._-]+)/g) ?? [];
  return names.map((n) => n.replace(/^\/BaseFont\s*\//, ''));
}

d('P6 — Thai PDF font check (Gotenberg)', () => {
  it('renders Thai text with the Sarabun face, not a Latin fallback', async () => {
    const html = `<!doctype html><html lang="th"><head><meta charset="UTF-8"><style>
      body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 16px; }
    </style></head><body>
      <h1>ใบกำกับภาษี / ใบเสร็จรับเงิน</h1>
      <p>กรมราชทัณฑ์ — ผลิตภัณฑ์ฝีมือผู้ต้องขัง</p>
      <p>ภาษีมูลค่าเพิ่ม ๗% รวมในราคาแล้ว</p>
    </body></html>`;

    const pdf = await renderPdf(html);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const fonts = baseFonts(pdf);
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.some((f) => /Sarabun/i.test(f))).toBe(true);
  }, 60_000);

  it('renders the real tax-invoice template with the Thai face', async () => {
    const template = readFileSync(
      join(import.meta.dirname, '../templates/tax-invoice.html'),
      'utf-8',
    );
    const pdf = await renderPdf(template);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(baseFonts(pdf).some((f) => /Sarabun/i.test(f))).toBe(true);
  }, 60_000);
});
