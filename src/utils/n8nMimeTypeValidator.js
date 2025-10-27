/**
 * Validador simple para n8n: una sola función que valida el mimetype
 * - Acepta solo imágenes estándar (jpeg/jpg/png/webp) y PDF
 * - Retorna un objeto con allowed, reason, type y extension
 * - Similar en estilo a n8nFileNameGenerator: una función principal
 */

const ALLOWED = new Set([
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

function getExtension(mime) {
  return MIME_TO_EXTENSION[normalizeMime(mime)] || '.bin';
}

function getType(mime) {
  const m = normalizeMime(mime);
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  return null;
}

function validateMimeTypeForN8N(messageInfo = {}) {
  const mimetype = messageInfo?.documentMessage?.mimetype
    || messageInfo?.imageMessage?.mimetype
    || '';

  const m = normalizeMime(mimetype);
  if (!m) {
    return { allowed: false, reason: 'Mimetype ausente o inválido', type: null, extension: '.bin', mimetype };
  }

  if (!ALLOWED.has(m)) {
    return { allowed: false, reason: `Formato no soportado: ${m}`, type: null, extension: '.bin', mimetype };
  }

  return {
    allowed: true,
    reason: 'OK',
    type: getType(m),
    extension: getExtension(m),
    mimetype: m,
  };
}

module.exports = {
  validateMimeTypeForN8N,
};