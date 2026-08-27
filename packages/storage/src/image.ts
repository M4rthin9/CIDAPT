import sharp from 'sharp';

const WIDTH_LADDER = [480, 768, 1024, 1536, 2048];

export interface ImageLadder {
  original: { buffer: Buffer; width: number; height: number };
  variants: Array<{ width: number; buffer: Buffer; format: string }>;
}

export async function generateImageLadder(
  input: Buffer,
  widths: number[] = WIDTH_LADDER,
): Promise<ImageLadder> {
  const metadata = await sharp(input).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  const variants: ImageLadder['variants'] = [];

  for (const width of widths) {
    if (width >= originalWidth) continue;

    const buffer = await sharp(input)
      .resize(width, undefined, { fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();

    variants.push({ width, buffer, format: 'webp' });
  }

  return {
    original: { buffer: input, width: originalWidth, height: originalHeight },
    variants,
  };
}

export function getImageKey(productId: string, width: number, format: string): string {
  return `products/${productId}/${width}w.${format}`;
}
