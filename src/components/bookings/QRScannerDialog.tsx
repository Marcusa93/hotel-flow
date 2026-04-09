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

const SCANNER_ID = 'qr-scanner-reader';

export function QRScannerDialog({ open, onOpenChange }: QRScannerDialogProps) {
  const navigate = useNavigate();
  const html5QrCodeRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear().catch(() => {});
        html5QrCodeRef.current = null;
      }
      setError(null);
      setScanning(false);
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled) return;

        // Wait for the DOM element to exist
        const el = document.getElementById(SCANNER_ID);
        if (!el) return;

        const html5QrCode = new Html5Qrcode(SCANNER_ID);
        html5QrCodeRef.current = html5QrCode;

        // Get available cameras and pick the best one
        let cameraId: string | { facingMode: string } = { facingMode: 'environment' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length > 0) {
            // Prefer back camera, fallback to first available
            const backCam = cameras.find(c =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('trasera') ||
              c.label.toLowerCase().includes('environment')
            );
            cameraId = backCam?.id || cameras[cameras.length - 1].id;
          }
        } catch {
          // getCameras failed, use facingMode fallback
        }

        if (cancelled) return;

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
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

        if (!cancelled) setScanning(true);
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || '';
          if (msg.includes('NotAllowed') || msg.includes('Permission')) {
            setError('Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.');
          } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
            setError('No se encontró ninguna cámara. Verificá que tu dispositivo tenga una cámara disponible.');
          } else {
            setError('No se pudo iniciar la cámara. Intentá cerrar y volver a abrir el escáner.');
          }
        }
      }
    };

    // Delay to let dialog animate open and DOM render
    const timer = setTimeout(startScanner, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear().catch(() => {});
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
              <div className="rounded-lg overflow-hidden bg-black min-h-[300px] relative">
                <div id={SCANNER_ID} className="w-full" />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
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
