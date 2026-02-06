import { useState } from 'react';
import { Bell, Mail, MessageSquare, Send } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StubIndicator, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

export default function Notifications() {
  const { notificationLogs, notificationSettings, updateNotificationSettings } = useHotel();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        description="Configuración de alertas y comunicaciones"
        actions={
          <StubIndicator message="Envíos simulados" />
        }
      />

      {/* Settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Configuración de Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-enabled" className="font-medium">Notificaciones por Email</Label>
                <p className="text-sm text-muted-foreground">Enviar emails automáticos</p>
              </div>
              <Switch 
                id="email-enabled"
                checked={notificationSettings.emailEnabled}
                onCheckedChange={(checked) => updateNotificationSettings({ emailEnabled: checked })}
              />
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Al crear reserva</Label>
                <Switch 
                  checked={notificationSettings.sendOnBooking}
                  onCheckedChange={(checked) => updateNotificationSettings({ sendOnBooking: checked })}
                  disabled={!notificationSettings.emailEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Al registrar pago</Label>
                <Switch 
                  checked={notificationSettings.sendOnPayment}
                  onCheckedChange={(checked) => updateNotificationSettings({ sendOnPayment: checked })}
                  disabled={!notificationSettings.emailEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Al hacer check-in</Label>
                <Switch 
                  checked={notificationSettings.sendOnCheckIn}
                  onCheckedChange={(checked) => updateNotificationSettings({ sendOnCheckIn: checked })}
                  disabled={!notificationSettings.emailEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Al hacer check-out</Label>
                <Switch 
                  checked={notificationSettings.sendOnCheckOut}
                  onCheckedChange={(checked) => updateNotificationSettings({ sendOnCheckOut: checked })}
                  disabled={!notificationSettings.emailEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Configuración de WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="whatsapp-enabled" className="font-medium">Notificaciones por WhatsApp</Label>
                <p className="text-sm text-muted-foreground">Enviar mensajes automáticos</p>
              </div>
              <Switch 
                id="whatsapp-enabled"
                checked={notificationSettings.whatsappEnabled}
                onCheckedChange={(checked) => updateNotificationSettings({ whatsappEnabled: checked })}
              />
            </div>
            <Separator />
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <StubIndicator message="Integración con WhatsApp Business API pendiente" />
              <p className="text-sm text-muted-foreground mt-2">
                Esta funcionalidad requiere configurar la API de WhatsApp Business
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Historial de Notificaciones
            </CardTitle>
            <Badge variant="outline">{notificationLogs.length} registros</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notificationLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(log.createdAt), 'dd/MM/yy HH:mm', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {log.type === 'email' ? (
                        <Mail className="w-3 h-3" />
                      ) : (
                        <MessageSquare className="w-3 h-3" />
                      )}
                      {log.type === 'email' ? 'Email' : 'WhatsApp'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.recipient}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === 'sent' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                      {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Fallido' : 'Pendiente'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Test notification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enviar Notificación de Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => alert('Email de prueba enviado (simulado)')}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar Email de Prueba
            </Button>
            <Button variant="outline" onClick={() => alert('WhatsApp de prueba enviado (simulado)')}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Enviar WhatsApp de Prueba
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
