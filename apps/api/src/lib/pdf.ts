import { getEnv } from '../config.js';

// Gotenberg HTML → PDF endpoint
// Thai fonts: TH Sarabun New (government docs) + Anuphan (UI) baked into custom image

export async function htmlToPdf(html: string, filename: string): Promise<Buffer> {
  const env = getEnv();
  const gotenbergUrl = env.GOTENBERG_URL;

  const formData = new FormData();
  // Gotenberg's Chromium route requires the entry document to be named
  // `index.html` — any other name is rejected with 400 "no index.html". The
  // document name the caller wants travels in Gotenberg-Output-Filename.
  formData.append('files', new Blob([html], { type: 'text/html' }), 'index.html');

  const res = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    headers: { 'Gotenberg-Output-Filename': filename.replace(/\.pdf$/, '') },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Gotenberg returned ${res.status}: ${await res.text()}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
