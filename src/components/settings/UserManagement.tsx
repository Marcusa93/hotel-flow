import { useState } from 'react';
import { Loader2, ShieldAlert, UserPlus, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAppUsers, useCreateAppUser } from '@/hooks/useAdminUsers';
import type { UserRole } from '@/types/hotel';

const MIN_PASSWORD_LENGTH = 8;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  reception: 'Recepción',
  housekeeping: 'Limpieza',
  auditor: 'Auditor',
  pending: 'Sin acceso',
};

const ASSIGNABLE: { value: UserRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Administrador', hint: 'Acceso total, incluida la configuración' },
  { value: 'reception', label: 'Recepción', hint: 'Reservas, huéspedes, habitaciones y caja' },
  { value: 'housekeeping', label: 'Limpieza', hint: 'Solo el tablero de tareas y habitaciones' },
  { value: 'auditor', label: 'Auditor', hint: 'Finanzas y auditoría, sin poder modificar' },
];

export function UserManagement() {
  const { data: users, isLoading, error } = useAppUsers();
  const createUser = useCreateAppUser();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = emailValid && passwordValid && !!role && !createUser.isPending;

  const reset = () => {
    setEmail(''); setFullName(''); setPassword(''); setRole('');
  };

  const handleCreate = async () => {
    if (!canSubmit || !role) return;
    try {
      await createUser.mutateAsync({
        email: email.trim(),
        password,
        fullName: fullName.trim() || undefined,
        role,
      });
      toast({
        title: 'Usuario creado',
        description: `${email.trim()} ya puede entrar. Se le va a pedir que cambie la contraseña.`,
      });
      reset();
      setOpen(false);
    } catch (err) {
      toast({
        title: 'No se pudo crear el usuario',
        description: err instanceof Error ? err.message : 'Intentá de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Usuarios del sistema</CardTitle>
            <CardDescription>
              Creá la cuenta, elegí el rol y pasale las credenciales. Al entrar por primera vez
              el sistema le va a pedir que defina su propia contraseña.
            </CardDescription>
          </div>

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button className="shrink-0">
                <UserPlus className="w-4 h-4 mr-2" />
                Nuevo usuario
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo usuario</DialogTitle>
                <DialogDescription>
                  La contraseña que elijas es temporal: la persona la cambia al primer ingreso.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="persona@hotel.com"
                  />
                  {email.length > 0 && !emailValid && (
                    <p className="text-xs text-destructive">El email no tiene un formato válido.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-name">Nombre completo (opcional)</Label>
                  <Input
                    id="user-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-password">Contraseña temporal</Label>
                  <Input
                    id="user-password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  />
                  {password.length > 0 && !passwordValid && (
                    <p className="text-xs text-destructive">
                      Necesita al menos {MIN_PASSWORD_LENGTH} caracteres.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-role">Rol</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                    <SelectTrigger id="user-role">
                      <SelectValue placeholder="Elegí un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <span className="font-medium">{r.label}</span>
                          <span className="text-muted-foreground"> — {r.hint}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!canSubmit}>
                  {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear usuario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando usuarios...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive py-6">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>No se pudieron cargar los usuarios: {(error as Error).message}</span>
            </div>
          )}

          {!isLoading && !error && (
            <div className="divide-y divide-border">
              {(users || []).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.fullName || u.email || 'Sin nombre'}</div>
                    {u.fullName && u.email && (
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {u.mustChangePassword && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <KeyRound className="w-3 h-3" />
                        Contraseña pendiente
                      </Badge>
                    )}
                    <Badge variant={u.role === 'pending' ? 'destructive' : 'secondary'}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                  </div>
                </div>
              ))}

              {(users || []).length === 0 && (
                <p className="text-sm text-muted-foreground py-6">
                  Todavía no hay usuarios cargados.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
