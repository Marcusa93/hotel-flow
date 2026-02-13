import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAppRole } from '@/context/AppRoleContext';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { useUpdateHotelSettings } from '@/hooks/useUpdateHotelSettings';
import { PageHeader } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole, HotelSettings } from '@/types/hotel';
import {
  Building2, Users, Palette, Bell, Shield, User,
  ClipboardList, Eye, Save, Loader2, Sun, Moon, Monitor,
  Mail, MessageCircle, CalendarCheck, CreditCard, LogIn, LogOut
} from 'lucide-react';

// --- Role Configuration ---
const roles: { value: UserRole; label: string; description: string; icon: React.ReactNode; permissions: string[] }[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acceso completo a todas las funcionalidades',
    icon: <Shield className="w-5 h-5" />,
    permissions: ['Dashboard', 'Reservas', 'Habitaciones', 'Huéspedes', 'Pagos', 'Gastos', 'Facturación', 'Tarifas', 'Estadísticas', 'Notificaciones', 'Configuración', 'Limpieza'],
  },
  {
    value: 'reception',
    label: 'Recepción',
    description: 'Gestión de reservas, huéspedes y pagos',
    icon: <User className="w-5 h-5" />,
    permissions: ['Dashboard', 'Reservas', 'Habitaciones', 'Huéspedes', 'Pagos', 'Tarifas', 'Configuración'],
  },
  {
    value: 'housekeeping',
    label: 'Limpieza',
    description: 'Solo acceso a habitaciones y limpieza',
    icon: <ClipboardList className="w-5 h-5" />,
    permissions: ['Habitaciones', 'Limpieza', 'Configuración'],
  },
  {
    value: 'auditor',
    label: 'Auditor',
    description: 'Estadísticas y pagos en modo lectura',
    icon: <Eye className="w-5 h-5" />,
    permissions: ['Pagos (lectura)', 'Gastos', 'Facturación (lectura)', 'Estadísticas (lectura)', 'Configuración'],
  },
];

export default function Settings() {
  const { currentRole, setCurrentRole, notificationSettings, updateNotificationSettings } = useAppRole();
  const { data: settings, isLoading } = useHotelSettings();
  const updateMutation = useUpdateHotelSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Hotel profile form
  const [hotelForm, setHotelForm] = useState({
    hotelName: '',
    address: '',
    phone: '',
    email: '',
    currency: 'ARS',
    timezone: 'America/Buenos_Aires',
  });

  // Notification form
  const [notifForm, setNotifForm] = useState({
    notificationEmailEnabled: true,
    notificationWhatsappEnabled: false,
    notificationSendOnBooking: true,
    notificationSendOnPayment: true,
    notificationSendOnCheckIn: true,
    notificationSendOnCheckOut: false,
  });

  // Sync forms when settings load
  useEffect(() => {
    if (settings) {
      setHotelForm({
        hotelName: settings.hotelName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        timezone: settings.timezone,
      });
      setNotifForm({
        notificationEmailEnabled: settings.notificationEmailEnabled,
        notificationWhatsappEnabled: settings.notificationWhatsappEnabled,
        notificationSendOnBooking: settings.notificationSendOnBooking,
        notificationSendOnPayment: settings.notificationSendOnPayment,
        notificationSendOnCheckIn: settings.notificationSendOnCheckIn,
        notificationSendOnCheckOut: settings.notificationSendOnCheckOut,
      });
    }
  }, [settings]);

  const handleSaveHotel = async () => {
    if (!settings) return;
    try {
      await updateMutation.mutateAsync({ id: settings.id, data: hotelForm });
      toast({ title: 'Configuración guardada', description: 'Los datos del hotel se actualizaron correctamente' });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios', variant: 'destructive' });
    }
  };

  const handleSaveNotifications = async () => {
    if (!settings) return;
    try {
      await updateMutation.mutateAsync({ id: settings.id, data: notifForm });
      updateNotificationSettings({
        emailEnabled: notifForm.notificationEmailEnabled,
        whatsappEnabled: notifForm.notificationWhatsappEnabled,
        sendOnBooking: notifForm.notificationSendOnBooking,
        sendOnPayment: notifForm.notificationSendOnPayment,
        sendOnCheckIn: notifForm.notificationSendOnCheckIn,
        sendOnCheckOut: notifForm.notificationSendOnCheckOut,
      });
      toast({ title: 'Notificaciones actualizadas', description: 'Las preferencias se guardaron correctamente' });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron guardar las preferencias', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajustes del sistema y preferencias del hotel"
      />

      <Tabs defaultValue="hotel" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="hotel" className="gap-2">
            <Building2 className="w-4 h-4 hidden sm:block" />
            Hotel
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Users className="w-4 h-4 hidden sm:block" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4 hidden sm:block" />
            Apariencia
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4 hidden sm:block" />
            Notificaciones
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Hotel Profile */}
        <TabsContent value="hotel">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Perfil del Hotel
              </CardTitle>
              <CardDescription>
                Información general del establecimiento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="hotelName">Nombre del Hotel</Label>
                      <Input
                        id="hotelName"
                        value={hotelForm.hotelName}
                        onChange={(e) => setHotelForm(prev => ({ ...prev, hotelName: e.target.value }))}
                        placeholder="Nombre del hotel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={hotelForm.email}
                        onChange={(e) => setHotelForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="info@hotel.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={hotelForm.phone}
                        onChange={(e) => setHotelForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+54 11 1234-5678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Moneda</Label>
                      <Select
                        value={hotelForm.currency}
                        onValueChange={(v) => setHotelForm(prev => ({ ...prev, currency: v }))}
                      >
                        <SelectTrigger id="currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                          <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="BRL">BRL - Real Brasileño</SelectItem>
                          <SelectItem value="CLP">CLP - Peso Chileno</SelectItem>
                          <SelectItem value="UYU">UYU - Peso Uruguayo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={hotelForm.address}
                        onChange={(e) => setHotelForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Dirección del hotel"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Zona Horaria</Label>
                      <Select
                        value={hotelForm.timezone}
                        onValueChange={(v) => setHotelForm(prev => ({ ...prev, timezone: v }))}
                      >
                        <SelectTrigger id="timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                          <SelectItem value="America/Santiago">Santiago (GMT-3)</SelectItem>
                          <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                          <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                          <SelectItem value="America/Montevideo">Montevideo (GMT-3)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveHotel} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Guardar Cambios
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Users & Roles */}
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Simulación de Rol</CardTitle>
              <CardDescription>
                Cambia el rol para ver cómo se adapta la interfaz según los permisos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={currentRole}
                onValueChange={(value) => setCurrentRole(value as UserRole)}
                className="grid gap-4 md:grid-cols-2"
              >
                {roles.map(role => (
                  <div key={role.value}>
                    <RadioGroupItem
                      value={role.value}
                      id={role.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={role.value}
                      className="flex items-start gap-4 rounded-lg border-2 p-4 cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        {role.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{role.label}</span>
                          {currentRole === role.value && (
                            <Badge variant="default" className="text-xs">Activo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Permisos por Rol</CardTitle>
              <CardDescription>
                Resumen de acceso a módulos según cada rol
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {roles.map(role => (
                  <div key={role.value} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-muted">{role.icon}</div>
                      <span className="font-medium text-sm">{role.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.map(perm => (
                        <Badge key={perm} variant="secondary" className="text-xs font-normal">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Appearance */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Tema Visual
              </CardTitle>
              <CardDescription>
                Personaliza la apariencia de la interfaz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Modo de Tema</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Claro', icon: Sun, desc: 'Fondo claro' },
                    { value: 'dark', label: 'Oscuro', icon: Moon, desc: 'Fondo oscuro' },
                    { value: 'system', label: 'Sistema', icon: Monitor, desc: 'Sigue tu OS' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:bg-muted/50 ${
                        theme === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <opt.icon className={`w-6 h-6 ${theme === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Identidad Visual</Label>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#003366] border-2 border-background shadow-sm" title="Deep Navy" />
                      <div className="w-8 h-8 rounded-full bg-[#005599] border-2 border-background shadow-sm" title="Light Navy" />
                      <div className="w-8 h-8 rounded-full bg-[#D4A017] border-2 border-background shadow-sm" title="Gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Deep Blue & Gold</p>
                      <p className="text-xs text-muted-foreground">Paleta de colores del hotel</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Preferencias de Notificaciones
              </CardTitle>
              <CardDescription>
                Configura cómo y cuándo recibir alertas del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Canales
                    </Label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-xs text-muted-foreground">Recibir notificaciones por correo electrónico</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifForm.notificationEmailEnabled}
                          onCheckedChange={(v) => setNotifForm(prev => ({ ...prev, notificationEmailEnabled: v }))}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">WhatsApp</p>
                            <p className="text-xs text-muted-foreground">Recibir alertas por WhatsApp</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifForm.notificationWhatsappEnabled}
                          onCheckedChange={(v) => setNotifForm(prev => ({ ...prev, notificationWhatsappEnabled: v }))}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Eventos
                    </Label>
                    <div className="space-y-4">
                      {[
                        { key: 'notificationSendOnBooking' as const, label: 'Nueva reserva', desc: 'Al crear o confirmar una reserva', icon: CalendarCheck, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
                        { key: 'notificationSendOnPayment' as const, label: 'Pago registrado', desc: 'Al recibir o registrar un pago', icon: CreditCard, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
                        { key: 'notificationSendOnCheckIn' as const, label: 'Check-In', desc: 'Cuando un huésped hace check-in', icon: LogIn, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
                        { key: 'notificationSendOnCheckOut' as const, label: 'Check-Out', desc: 'Cuando un huésped hace check-out', icon: LogOut, color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${item.color}`}>
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                          <Switch
                            checked={notifForm[item.key]}
                            onCheckedChange={(v) => setNotifForm(prev => ({ ...prev, [item.key]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveNotifications} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Guardar Preferencias
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <Label className="text-muted-foreground">Versión</Label>
              <p className="font-medium">1.0.0 (MVP)</p>
            </div>
            <div className="p-4 rounded-lg border">
              <Label className="text-muted-foreground">Ambiente</Label>
              <p className="font-medium">Desarrollo</p>
            </div>
            <div className="p-4 rounded-lg border">
              <Label className="text-muted-foreground">Backend</Label>
              <p className="font-medium text-emerald-600 dark:text-emerald-400">Supabase (Conectado)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
