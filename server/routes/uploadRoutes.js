import express from 'express';
import path from 'path';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireRole, requireAuth } from '../middleware/authorize.js';
import { saveImage, StorageError, MAX_UPLOAD_BYTES } from '../services/storage.js';

const router = express.Router();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// Files are held in memory and handed to the storage service (local disk or
// Vercel Blob), which also checks the actual bytes are an image.
function imageFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_MIME.has(file.mimetype) && (ALLOWED_EXT.has(ext) || !ext)) {
    return cb(null, true);
  }
  cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
}

const mb = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

function uploadHandler({ maxBytes, folder, tooBig }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 }, fileFilter: imageFileFilter });
  return (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? tooBig : err.message || 'Upload failed';
        return res.status(400).json({ success: false, message });
      }
      if (!req.file) return res.status(400).json({ success: false, message: 'Please choose an image file to upload' });
      try {
        const url = await saveImage(req.file.buffer, { folder });
        res.status(201).json({ success: true, url });
      } catch (e) {
        if (e instanceof StorageError) return res.status(e.message.startsWith('That file') ? 400 : 503).json({ success: false, message: e.message });
        console.error('[uploads] save failed:', e);
        res.status(502).json({ success: false, message: 'Could not store the image. Please try again.' });
      }
    });
  };
}

router.post('/image', requireRole('ADMIN', 'SALES_MANAGER'), uploadHandler({
  maxBytes: MAX_UPLOAD_BYTES, folder: 'catalog', tooBig: `Image must be ${mb(MAX_UPLOAD_BYTES)} or smaller`
}));

// Profile photos: any signed-in user (customers and staff), smaller limit.
const avatarLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Please try again later.' } });

router.post('/avatar', requireAuth, avatarLimiter, uploadHandler({
  maxBytes: 3 * 1024 * 1024, folder: 'avatars', tooBig: 'Profile photos must be 3 MB or smaller'
}));

export default router;
