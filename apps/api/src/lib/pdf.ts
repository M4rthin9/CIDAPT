import { getEnv } from '../config';

// Gotenberg HTML → PDF endpoint
// Thai fonts: TH Sarabun New (government docs) + Anuphan (UI) baked into custom image

export async function htmlToPdf(html: string, filename: string): Promise<Buffer> {
  const env = getEnv();
  const gotenbergUrl = env.GOTENBERG_URL;

  const formData = new FormData();
  formData.append(
    'files',
    new Blob([html], { type: 'text/html' }),
    filename.replace(/\.pdf$/, '.html'),
  );

  const res = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Gotenberg returned ${res.status}: ${await res.text()}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
