import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScanLine, Camera, XCircle } from 'lucide-react';

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRScannerDialog({ open, onOpenChange }: QRScannerDialogProps) {
  const navigate = useNavigate();
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) {
      // Cleanup when dialog closes
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
      setError(null);
      setScanning(false);
      return;
    }

    // Dynamic import to avoid loading the library upfront
    let cancelled = false;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled || !scannerRef.current) return;

        const scannerId = 'qr-scanner-reader';
        // Ensure element exists
        if (!document.getElementById(scannerId)) {
          const el = document.createElement('div');
          el.id = scannerId;
          scannerRef.current.appendChild(el);
        }

        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            // Check if it's a valid check-in URL
            const match = decodedText.match(/\/quick-checkin\/([a-f0-9-]+)/i);
            if (match) {
              html5QrCode.stop().catch(() => {});
              onOpenChange(false);
              navigate(`/quick-checkin/${match[1]}`);
            }
          },
          () => { /* ignore scan failures */ }
        );

        setScanning(true);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message?.includes('NotAllowed')
              ? 'Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.'
              : 'No se pudo iniciar la cámara. Verificá que tu dispositivo tenga cámara disponible.'
          );
        }
      }
    };

    // Small delay to let dialog animate open
    const timer = setTimeout(startScanner, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    };
  }, [open, navigate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Escanear QR de Check-in
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
              <Button variant="outline" size="sm" onClick={() => { setError(null); onOpenChange(false); }}>
                Cerrar
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={scannerRef}
                className="rounded-lg overflow-hidden bg-black min-h-[300px] flex items-center justify-center"
              >
                {!scanning && (
                  <div className="flex flex-col items-center gap-2 text-white/60">
                    <Camera className="w-8 h-8 animate-pulse" />
                    <p className="text-sm">Iniciando cámara...</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Apuntá la cámara al código QR de la reserva
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
