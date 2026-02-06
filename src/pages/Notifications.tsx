import { useState } from 'react';
import { Send, Settings2 } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationChannelCard, NotificationTimeline } from '@/components/notifications';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function Notifications() {
  const { notificationLogs, notificationSettings, updateNotificationSettings } = useHotel();

  // Mock stats
  const emailStats = {
    sent: notificationLogs.filter(l => l.type === 'email' && l.status === 'sent').length,
    failed: notificationLogs.filter(l => l.type === 'email' && l.status === 'failed').length
  };

  const whatsappStats = {
    sent: notificationLogs.filter(l => l.type === 'whatsapp' && l.status === 'sent').length,
    failed: notificationLogs.filter(l => l.type === 'whatsapp' && l.status === 'failed').length
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Centro de Comunicación"
        description="Gestión omnicanal de mensajes"
        actions={
          <Button variant="outline" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Configuración Avanzada
          </Button>
        }
      />

      {/* Channel Config - Visual Cards */}
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Canales Activos</h3>
      <div className="grid gap-6 md:grid-cols-2 animate-in slide-in-from-bottom-4 duration-500">
        <NotificationChannelCard
          type="EMAIL"
          isEnabled={notificationSettings.emailEnabled}
          onToggle={(checked) => updateNotificationSettings({ emailEnabled: checked })}
          stats={emailStats}
        />
        <NotificationChannelCard
          type="WHATSAPP"
          isEnabled={notificationSettings.whatsappEnabled}
          onToggle={(checked) => updateNotificationSettings({ whatsappEnabled: checked })}
          stats={whatsappStats}
        />
      </div>

      <Separator className="my-6" />

      {/* Main Content Split */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Timeline Feed */}
        <Card className="lg:col-span-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Feed de Actividad</CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                Últimas 24h
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <NotificationTimeline logs={notificationLogs} />
          </CardContent>
        </Card>

        {/* Quick Actions / Testing */}
        <div className="space-y-6">
          <Card className="border-indigo-200 dark:border-indigo-900 bg-gradient-to-b from-indigo-50/50 to-white/50 dark:from-indigo-950/20 dark:to-slate-900/20">
            <CardHeader>
              <CardTitle className="text-base text-indigo-900 dark:text-indigo-100">Prueba Rápida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => alert('Email enviado')}>
                <Send className="w-4 h-4 mr-2" /> Enviar Email Test
              </Button>
              <Button variant="outline" className="w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30" onClick={() => alert('WhatsApp enviado')}>
                <Send className="w-4 h-4 mr-2" /> Enviar WhatsApp Test
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-0">
            <CardContent className="p-6">
              <h4 className="font-bold mb-2">Consejo Pro</h4>
              <p className="text-sm text-slate-300">
                Activa las notificaciones de WhatsApp para aumentar la tasa de lectura en un 80% respecto al Email.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
