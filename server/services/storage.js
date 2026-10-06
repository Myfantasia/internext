import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

// Where uploaded images live.
//   - Vercel (or anywhere BLOB_READ_WRITE_TOKEN is set): Vercel Blob. Serverless
//     functions have a read-only, throw-away disk, so files must go to storage.
//   - Otherwise: the local uploads/ folder, served at /uploads by server/index.js.
// Callers get back a URL to store on the product/brand/user record either way.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '../../uploads');

export function storageProvider() {
  return process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'local';
}

// Vercel caps a function's request body at about 4.5 MB.
export const MAX_UPLOAD_BYTES = process.env.VERCEL ? 4 * 1024 * 1024 : 8 * 1024 * 1024;

const SIGNATURES = [
  { type: 'image/jpeg', ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: '.png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/gif', ext: '.gif', test: (b) => b.subarray(0, 6).toString('ascii') === 'GIF87a' || b.subarray(0, 6).toString('ascii') === 'GIF89a' },
  { type: 'image/webp', ext: '.webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' }
];

// Trust the file's bytes, not its name or the browser-supplied type.
export function detectImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((s) => s.test(buffer)) || null;
}

export class StorageError extends Error {}

export async function saveImage(buffer, { folder = 'uploads' } = {}) {
  const kind = detectImage(buffer);
  if (!kind) throw new StorageError('That file is not a valid JPEG, PNG, WebP or GIF image.');
  const name = `${randomUUID()}${kind.ext}`;

  if (storageProvider() === 'vercel-blob') {
    // Imported lazily so local development doesn't need the package loaded.
    const { put } = await import('@vercel/blob');
    const blob = await put(`${folder}/${name}`, buffer, { access: 'public', contentType: kind.type, addRandomSuffix: false });
    return blob.url;
  }

  if (process.env.VERCEL) {
    throw new StorageError('Image storage is not set up on this deployment. Connect a Vercel Blob store to the project, then redeploy.');
  }
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, name), buffer);
  return `/uploads/${name}`;
}
