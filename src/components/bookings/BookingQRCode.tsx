import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Share2 } from 'lucide-react';
import { useRef, useCallback } from 'react';

interface BookingQRCodeProps {
  bookingId: string;
  guestName: string;
  roomNumber: string;
  checkInDate: string;
}

export function BookingQRCode({ bookingId, guestName, roomNumber, checkInDate }: BookingQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const checkinUrl = `${window.location.origin}/quick-checkin/${bookingId}`;

  const handleDownload = useCallback(() => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 480;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // QR code centered
      ctx.drawImage(img, 50, 30, 300, 300);

      // Text below
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(guestName, 200, 370);
      ctx.font = '14px system-ui';
      ctx.fillStyle = '#666666';
      ctx.fillText(`Hab. ${roomNumber} · Check-in: ${checkInDate}`, 200, 395);
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#999999';
      ctx.fillText('HoMe — Hotel Management', 200, 430);

      const link = document.createElement('a');
      link.download = `checkin-${roomNumber}-${guestName.split(' ')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }, [guestName, roomNumber, checkInDate]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check-in: ${guestName}`,
          text: `Check-in rápido para ${guestName}, Hab. ${roomNumber}. Check-in: ${checkInDate}`,
          url: checkinUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(checkinUrl);
      // Could use toast here but keeping it simple
    }
  }, [checkinUrl, guestName, roomNumber, checkInDate]);

  return (
    <Card className="glass border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" />
          QR Check-in Rápido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div ref={qrRef} className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={checkinUrl}
              size={160}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[220px]">
            Escaneá este código en recepción para hacer check-in instantáneo
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" />
              Descargar
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleShare}>
              <Share2 className="w-3.5 h-3.5" />
              Compartir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
