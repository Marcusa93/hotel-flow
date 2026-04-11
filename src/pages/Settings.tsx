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

import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole, HotelSettings } from '@/types/hotel';
import {
  Building2, Users, Palette, Shield, User,
  ClipboardList, Eye, Save, Loader2, Sun, Moon, Monitor, Bell
} from 'lucide-react';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';

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
  const { currentRole } = useAppRole();
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
    checkInTime: '14:00',
    checkOutTime: '11:00',
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
        checkInTime: settings.checkInTime || '14:00',
        checkOutTime: settings.checkOutTime || '11:00',
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajustes del sistema y preferencias del hotel"
      />

      <Tabs defaultValue="hotel" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="hotel" className="gap-2">
            <Building2 className="w-4 h-4 hidden sm:block" />
            Hotel
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4 hidden sm:block" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Users className="w-4 h-4 hidden sm:block" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4 hidden sm:block" />
            Apariencia
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
                    <div className="space-y-2">
                      <Label htmlFor="checkInTime">Hora de Check-in</Label>
                      <Input
                        id="checkInTime"
                        type="time"
                        value={hotelForm.checkInTime}
                        onChange={(e) => setHotelForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkOutTime">Hora de Check-out</Label>
                      <Input
                        id="checkOutTime"
                        type="time"
                        value={hotelForm.checkOutTime}
                        onChange={(e) => setHotelForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                      />
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

        {/* TAB 2: Notifications */}
        <TabsContent value="notifications">
          <PushNotificationSettings />
        </TabsContent>

        {/* TAB 3: Users & Roles */}
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tu Rol</CardTitle>
              <CardDescription>
                Tu rol fue asignado por un administrador y determina los módulos a los que tenés acceso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {roles.map(role => {
                  const isCurrentRole = currentRole === role.value;
                  return (
                    <div
                      key={role.value}
                      className={`flex items-start gap-4 rounded-lg border-2 p-4 transition-all ${
                        isCurrentRole
                          ? 'border-primary bg-primary/5'
                          : 'border-border opacity-40'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        {role.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{role.label}</span>
                          {isCurrentRole && (
                            <Badge variant="default" className="text-xs">Tu rol</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      </Tabs>

      {/* Credits */}
      <Card>
        <CardContent className="py-6">
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Desarrollado por <span className="font-semibold text-foreground">Digital Amenities</span>
            </p>
            <p className="text-xs text-muted-foreground">v{__APP_VERSION__}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
