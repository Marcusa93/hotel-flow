import { useRef } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Label suelto y no FormLabel: el comprobante no es un campo del formulario
// —viaja aparte, subido después del pago— así que no tiene estado que mostrar.
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  RECEIPT_INPUT_ACCEPT,
  formatFileSize,
  isImageReceipt,
  resolveReceiptMime,
  validateReceiptFile,
} from '@/lib/paymentAttachments';

interface ReceiptFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Elige los comprobantes antes de que el pago exista. Los archivos quedan en
 * memoria y se suben recién cuando el pago se registra: subirlos antes dejaría
 * el bucket lleno de comprobantes de cobros que nadie terminó de confirmar.
 */
export function ReceiptFilePicker({ files, onChange, disabled }: ReceiptFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    // El input se limpia siempre: sin esto, elegir el mismo archivo dos veces
    // seguidas no dispara el change y parece que no pasó nada.
    event.target.value = '';
    if (picked.length === 0) return;

    const accepted: File[] = [];
    for (const file of picked) {
      const problem = validateReceiptFile(file);
      if (problem) {
        toast({ title: 'Archivo rechazado', description: problem, variant: 'destructive' });
        continue;
      }
      const isDuplicate = files.some(f => f.name === file.name && f.size === file.size);
      if (!isDuplicate) accepted.push(file);
    }

    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Paperclip className="w-4 h-4" />
        Comprobante (opcional)
      </Label>

      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_INPUT_ACCEPT}
        multiple
        className="hidden"
        onChange={handleSelect}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        <Paperclip className="w-4 h-4 mr-2" />
        {files.length === 0 ? 'Adjuntar captura o PDF' : 'Adjuntar otro'}
      </Button>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, index) => {
            const Icon = isImageReceipt(resolveReceiptMime(file)) ? ImageIcon : FileText;
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
              >
                <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1" title={file.name}>{file.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  aria-label={`Quitar ${file.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Imágenes o PDF, hasta 10 MB. Desde el teléfono se puede sacar la foto en el momento.
      </p>
    </div>
  );
}
