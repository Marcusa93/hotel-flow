/**
 * Comprobantes de pago: validación del archivo y armado de la ruta en Storage.
 *
 * Todo lo de acá es puro a propósito —no toca Supabase ni el DOM— para poder
 * probar los límites sin subir nada.
 */

/** Bucket privado. Se sirve con URLs firmadas, nunca con la URL pública. */
export const RECEIPT_BUCKET = 'comprobantes';

/** Igual que el file_size_limit del bucket: si no coinciden, el aviso lindo
 *  aparece recién después de subir 10 MB por la red del hotel. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** Lo que acepta el bucket. Cambiar acá obliga a cambiar la migración. */
const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

/** El navegador a veces manda type vacío (HEIC de iPhone, algún Android), así
 *  que la extensión es el segundo camino para reconocer el archivo. */
const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

/** Para el input. `image/*` habilita la cámara en el teléfono. */
export const RECEIPT_INPUT_ACCEPT = 'image/*,application/pdf,.pdf,.heic,.heif';

/**
 * Los métodos donde el comprobante es la única prueba de que la plata entró.
 * En efectivo el respaldo es la caja; en transferencia y QR, el papel.
 */
export const METHODS_EXPECTING_RECEIPT = ['TRANSFER', 'QR'] as const;

/** Extensión en minúsculas y sin punto. Cadena vacía si el nombre no tiene. */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 1 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

interface ReceiptFileLike {
  name: string;
  type: string;
  size: number;
}

/**
 * El tipo con el que se sube. Se resuelve por extensión cuando el navegador no
 * lo declara: el bucket rechaza lo que no esté en su lista, y un
 * "application/octet-stream" caería ahí aunque el archivo sea un JPG.
 */
export function resolveReceiptMime(file: ReceiptFileLike): string {
  const declared = (file.type || '').toLowerCase();
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(declared)) return declared;
  return EXTENSION_MIME_TYPES[fileExtension(file.name)] ?? '';
}

/** El mensaje del problema, o null si el archivo sirve. */
export function validateReceiptFile(file: ReceiptFileLike): string | null {
  if (file.size === 0) {
    return `"${file.name}" está vacío.`;
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return `"${file.name}" pesa ${formatFileSize(file.size)} y el máximo es ${formatFileSize(MAX_RECEIPT_BYTES)}.`;
  }
  if (!resolveReceiptMime(file)) {
    return `"${file.name}" no es una imagen ni un PDF.`;
  }
  return null;
}

/**
 * La ruta dentro del bucket: `<pago>/<aleatorio>.<ext>`.
 *
 * El nombre original no va en la ruta —se guarda en la fila— porque dos
 * comprobantes se llaman "IMG_0001.jpg" bastante seguido, y porque un nombre
 * con acentos o barras arma rutas que después no se pueden pedir.
 */
export function buildReceiptPath(paymentId: string, fileName: string): string {
  const ext = fileExtension(fileName);
  return `${paymentId}/${randomId()}${ext ? `.${ext}` : ''}`;
}

function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Navegador viejo o contexto sin crypto: alcanza con no repetir dentro del pago.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Se ve al lado del nombre del archivo. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  // Un decimal: "1,4 MB" dice algo, "1 MB" y "2 MB" para todo no.
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

/** Las imágenes se muestran; el PDF se abre. */
export function isImageReceipt(mimeType: string | undefined): boolean {
  return (mimeType || '').startsWith('image/');
}

/**
 * El aviso del cartel de confirmar. No bloquea: recepción cobra y el huésped le
 * manda el comprobante cinco minutos después, y trabar el cobro por eso sería
 * peor que registrarlo sin respaldo.
 */
export function missingReceiptWarning(method: string, attachmentCount: number): string | null {
  if (attachmentCount > 0) return null;
  if (!(METHODS_EXPECTING_RECEIPT as readonly string[]).includes(method)) return null;
  return method === 'QR'
    ? 'Cobro por QR sin comprobante adjunto. Se puede agregar después desde el historial de pagos.'
    : 'Transferencia sin comprobante adjunto. Se puede agregar después desde el historial de pagos.';
}
