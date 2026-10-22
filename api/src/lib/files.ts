// Images in R2: avatars, banners, team pictures and tournament logos. Checked by their bytes,
// not by the name or the type the browser claims.

import type { Env } from '../env';
import { ApiError, bad, randomId } from './util';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** Reads `file` from a form, checks it and stores it under `<folder>/<random>`. Returns the key. */
export async function storeImage(env: Env, form: FormData, folder: string): Promise<string> {
  const file = form.get('file');
  if (!file || typeof file === 'string') throw bad('Wähl ein Bild aus.', 'invalid_file');
  if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'Bilder dürfen bis 5 MB gross sein.', 'file_too_large');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) throw new ApiError(415, 'Bilder müssen PNG, JPG oder WebP sein.', 'invalid_file_type');
  const key = `${folder}/${randomId('img')}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  return key;
}

export async function dropImage(env: Env, key: string | null) {
  if (key) await env.FILES.delete(key);
}
