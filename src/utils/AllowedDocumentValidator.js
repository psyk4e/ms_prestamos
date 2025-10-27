/**
 * Validador directo de documentos/imágenes
 * - Acepta solo imágenes estándar (escáner/cámara) y PDF
 * - Excluye formatos técnicos (TIFF, SVG, RAW, PSD, etc.)
 * - Implementación "cruda" sin opciones ni extensiones
 *
 * Formas de uso:
 *   - validateDocument({ mimetype, fileName, size, width, height })
 *   - validateFromUpload(upload) // multer: { mimetype, originalname, size }
 *   - validateFromMessage(messageInfo) // WhatsApp/n8n message
 */

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function normalizeMime(mime = '') {
  return String(mime).trim().toLowerCase();
}

function extractExtensionFromFileName(fileName = '') {
  const match = String(fileName).match(/\.[^./\\]+$/);
  return match ? match[0].toLowerCase() : '';
}

function getExtensionFromMime(mime) {
  const m = normalizeMime(mime);
  return MIME_TO_EXTENSION[m] || '';
}

function getTypeFromMime(mime) {
  const m = normalizeMime(mime);
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  return null;
}

function isAllowedMime(mime) {
  const m = normalizeMime(mime);
  if (!m) return { allowed: false, type: null, reason: 'Mimetype ausente o inválido' };
  if (!ALLOWED_MIME_TYPES.has(m)) return { allowed: false, type: null, reason: `Formato no soportado: ${m}` };
  return { allowed: true, type: getTypeFromMime(m) };
}

function validateDocument({ mimetype, fileName, size, width, height } = {}) {
  const res = isAllowedMime(mimetype);
  if (!res.allowed) return { allowed: false, reason: res.reason, type: null };

  const suggestedExtension = getExtensionFromMime(mimetype);
  const originalExtension = extractExtensionFromFileName(fileName);

  return {
    allowed: true,
    reason: 'OK',
    type: res.type,
    suggestedExtension,
    originalExtension,
    size,
    width,
    height,
  };
}

function validateFromUpload(upload = {}) {
  const info = {
    mimetype: upload.mimetype,
    fileName: upload.originalname,
    size: upload.size,
  };
  return validateDocument(info);
}

function validateFromMessage(messageInfo = {}) {
  let mimetype = '';
  let fileName = '';
  let size;
  let width;
  let height;

  if (messageInfo.documentMessage) {
    mimetype = messageInfo.documentMessage.mimetype || '';
    fileName = messageInfo.documentMessage.fileName || '';
    size = messageInfo.documentMessage.size;
  } else if (messageInfo.imageMessage) {
    mimetype = messageInfo.imageMessage.mimetype || '';
    width = messageInfo.imageMessage.width;
    height = messageInfo.imageMessage.height;
  }

  return validateDocument({ mimetype, fileName, size, width, height });
}

function ensureAllowedOrThrow(info) {
  const res = validateDocument(info);
  if (!res.allowed) throw new Error(res.reason || 'Archivo no permitido');
  return res;
}

module.exports = {
  validateDocument,
  validateFromUpload,
  validateFromMessage,
  ensureAllowedOrThrow,
  isAllowedMime,
  getExtensionFromMime,
  extractExtensionFromFileName,
};