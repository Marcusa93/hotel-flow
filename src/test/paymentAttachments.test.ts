import { describe, it, expect } from 'vitest';
import {
  MAX_RECEIPT_BYTES,
  buildReceiptPath,
  fileExtension,
  formatFileSize,
  isImageReceipt,
  missingReceiptWarning,
  resolveReceiptMime,
  validateReceiptFile,
} from '@/lib/paymentAttachments';

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe('fileExtension', () => {
  it('devuelve la extensión en minúsculas', () => {
    expect(fileExtension('comprobante.PDF')).toBe('pdf');
    expect(fileExtension('IMG_0001.jpeg')).toBe('jpeg');
  });

  it('soporta nombres con varios puntos', () => {
    expect(fileExtension('transferencia.2026.07.28.png')).toBe('png');
  });

  it('devuelve vacío cuando no hay extensión usable', () => {
    expect(fileExtension('comprobante')).toBe('');
    expect(fileExtension('comprobante.')).toBe('');
    // Un archivo oculto de Unix no tiene extensión, tiene nombre
    expect(fileExtension('.gitignore')).toBe('');
  });
});

describe('resolveReceiptMime', () => {
  it('usa el tipo que declara el navegador', () => {
    expect(resolveReceiptMime(file('a.jpg', 'image/jpeg'))).toBe('image/jpeg');
    expect(resolveReceiptMime(file('a.pdf', 'application/pdf'))).toBe('application/pdf');
  });

  it('cae a la extensión cuando el navegador no declara nada', () => {
    // El caso real: HEIC de iPhone llega con type vacío
    expect(resolveReceiptMime(file('IMG_4821.HEIC', ''))).toBe('image/heic');
    expect(resolveReceiptMime(file('recibo.pdf', ''))).toBe('application/pdf');
  });

  it('ignora un tipo que el bucket no acepta y mira la extensión', () => {
    expect(resolveReceiptMime(file('captura.png', 'application/octet-stream'))).toBe('image/png');
  });

  it('devuelve vacío cuando no hay forma de reconocerlo', () => {
    expect(resolveReceiptMime(file('planilla.xlsx', 'application/vnd.ms-excel'))).toBe('');
    expect(resolveReceiptMime(file('sin-extension', ''))).toBe('');
  });
});

describe('validateReceiptFile', () => {
  it('acepta imágenes y PDF dentro del límite', () => {
    expect(validateReceiptFile(file('a.jpg', 'image/jpeg', 500_000))).toBeNull();
    expect(validateReceiptFile(file('a.pdf', 'application/pdf', 2_000_000))).toBeNull();
    expect(validateReceiptFile(file('IMG.HEIC', '', 3_000_000))).toBeNull();
  });

  it('rechaza lo que no es imagen ni PDF', () => {
    expect(validateReceiptFile(file('planilla.xlsx', 'application/vnd.ms-excel'))).toMatch(/no es una imagen ni un PDF/);
  });

  it('rechaza por tamaño y dice cuánto pesa', () => {
    const problem = validateReceiptFile(file('foto.jpg', 'image/jpeg', MAX_RECEIPT_BYTES + 1));
    expect(problem).toMatch(/máximo/);
    expect(problem).toContain('foto.jpg');
  });

  it('acepta justo el límite', () => {
    expect(validateReceiptFile(file('foto.jpg', 'image/jpeg', MAX_RECEIPT_BYTES))).toBeNull();
  });

  it('rechaza un archivo vacío', () => {
    expect(validateReceiptFile(file('foto.jpg', 'image/jpeg', 0))).toMatch(/vacío/);
  });
});

describe('buildReceiptPath', () => {
  it('cuelga el archivo del pago y conserva la extensión', () => {
    const path = buildReceiptPath('pago-123', 'IMG_0001.JPG');
    expect(path).toMatch(/^pago-123\/[\w-]+\.jpg$/);
  });

  it('no repite la ruta para el mismo nombre', () => {
    const a = buildReceiptPath('pago-123', 'captura.png');
    const b = buildReceiptPath('pago-123', 'captura.png');
    expect(a).not.toBe(b);
  });

  it('deja afuera el nombre original, que puede traer barras y acentos', () => {
    const path = buildReceiptPath('pago-123', 'transferencia 10/07 señá.pdf');
    // Una barra de más partiría la ruta en una carpeta que nadie pidió
    expect(path.split('/')).toHaveLength(2);
    expect(path).not.toContain('señá');
  });

  it('funciona sin extensión', () => {
    expect(buildReceiptPath('pago-123', 'comprobante')).toMatch(/^pago-123\/[\w-]+$/);
  });
});

describe('formatFileSize', () => {
  it('usa la unidad que corresponde', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1_500_000)).toBe('1,4 MB');
  });

  it('usa la coma decimal', () => {
    expect(formatFileSize(MAX_RECEIPT_BYTES)).toBe('10,0 MB');
  });
});

describe('isImageReceipt', () => {
  it('separa las imágenes del PDF', () => {
    expect(isImageReceipt('image/jpeg')).toBe(true);
    expect(isImageReceipt('application/pdf')).toBe(false);
    expect(isImageReceipt(undefined)).toBe(false);
  });
});

describe('missingReceiptWarning', () => {
  it('avisa en transferencia y QR sin comprobante', () => {
    expect(missingReceiptWarning('TRANSFER', 0)).toMatch(/Transferencia sin comprobante/);
    expect(missingReceiptWarning('QR', 0)).toMatch(/QR sin comprobante/);
  });

  it('se calla cuando ya hay uno adjunto', () => {
    expect(missingReceiptWarning('TRANSFER', 1)).toBeNull();
  });

  it('no avisa en los métodos cuyo respaldo no es un papel', () => {
    expect(missingReceiptWarning('CASH', 0)).toBeNull();
    expect(missingReceiptWarning('CREDIT', 0)).toBeNull();
    // Cargar a cuenta corriente no es un cobro: no hay comprobante que pedir
    expect(missingReceiptWarning('CUENTA_CORRIENTE', 0)).toBeNull();
  });
});
