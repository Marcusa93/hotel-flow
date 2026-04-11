import { Bell, BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function PushNotificationSettings() {
  const { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Notificaciones Push
          </CardTitle>
          <CardDescription>
            Tu navegador no soporta notificaciones push. Intentá desde Chrome o Safari en tu celular.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notificaciones Push
        </CardTitle>
        <CardDescription>
          Recibí alertas en tu celular o desktop aunque no tengas la app abierta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <Smartphone className="w-8 h-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {isSubscribed ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isSubscribed
                ? 'Vas a recibir alertas de check-outs atrasados, pagos pendientes y más'
                : permission === 'denied'
                  ? 'Bloqueaste las notificaciones en tu navegador. Revisá la configuración del sitio.'
                  : 'Activá las notificaciones para recibir alertas importantes en tiempo real'}
            </p>
          </div>
          <Badge variant={isSubscribed ? 'default' : 'secondary'}>
            {isSubscribed ? 'ON' : 'OFF'}
          </Badge>
        </div>

        {permission === 'denied' ? (
          <p className="text-xs text-destructive">
            Las notificaciones están bloqueadas. Para activarlas, hacé click en el candado de la barra de direcciones y permití notificaciones.
          </p>
        ) : isSubscribed ? (
          <Button variant="outline" onClick={unsubscribe} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellOff className="w-4 h-4 mr-2" />}
            Desactivar notificaciones
          </Button>
        ) : (
          <Button onClick={subscribe} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellRing className="w-4 h-4 mr-2" />}
            Activar notificaciones push
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
