import { useHotel } from '@/context/HotelContext';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UserRole } from '@/types/hotel';
import { User, Shield, ClipboardList, Eye, Building2 } from 'lucide-react';

const roles: { value: UserRole; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'admin', 
    label: 'Administrador', 
    description: 'Acceso completo a todas las funcionalidades',
    icon: <Shield className="w-5 h-5" />
  },
  { 
    value: 'reception', 
    label: 'Recepción', 
    description: 'Gestión de reservas, huéspedes y pagos',
    icon: <User className="w-5 h-5" />
  },
  { 
    value: 'housekeeping', 
    label: 'Limpieza', 
    description: 'Solo acceso a habitaciones y limpieza',
    icon: <ClipboardList className="w-5 h-5" />
  },
  { 
    value: 'auditor', 
    label: 'Auditor', 
    description: 'Estadísticas y pagos en modo lectura',
    icon: <Eye className="w-5 h-5" />
  },
];

export default function Settings() {
  const { currentRole, setCurrentRole } = useHotel();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajustes del sistema y preferencias"
      />

      {/* Role selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulación de Rol</CardTitle>
          <CardDescription>
            Cambia el rol para ver cómo se adapta la interfaz según los permisos.
            En producción esto estaría controlado por autenticación real.
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

      {/* Hotel info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Información del Hotel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Nombre</Label>
              <p className="font-medium">Hotel Demo</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Dirección</Label>
              <p className="font-medium">Av. Principal 123, Ciudad</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Teléfono</Label>
              <p className="font-medium">+54 11 1234-5678</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">info@hoteldemo.com</p>
            </div>
          </div>
          <Separator />
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Esta es una aplicación de demostración. Todos los datos son simulados y se reinician al recargar la página.
              En producción, estos ajustes se guardarían en la base de datos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System info */}
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
              <p className="font-medium text-muted-foreground">Mock (sin conexión)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
