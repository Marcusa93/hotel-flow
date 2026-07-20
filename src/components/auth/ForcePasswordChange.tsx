import { useState } from 'react';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useCompletePasswordChange } from '@/hooks/useAdminUsers';

const MIN_LENGTH = 8;

/**
 * Blocks the whole app until a user created by an admin replaces the
 * handed-over password with one only they know.
 */
export function ForcePasswordChange() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { toast } = useToast();
  const { signOut } = useAuth();
  const completeChange = useCompletePasswordChange();

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= MIN_LENGTH && password === confirm && !completeChange.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      await completeChange.mutateAsync(password);
      toast({
        title: 'Contraseña actualizada',
        description: 'Ya podés usar el sistema con normalidad.',
      });
    } catch (err) {
      toast({
        title: 'No se pudo cambiar la contraseña',
        description: err instanceof Error ? err.message : 'Intentá de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <CardTitle>Elegí tu contraseña</CardTitle>
          <CardDescription>
            Tu cuenta fue creada por un administrador. Por seguridad, definí una contraseña
            que solo vos conozcas antes de entrar al sistema.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Mínimo ${MIN_LENGTH} caracteres`}
              />
              {tooShort && (
                <p className="text-xs text-destructive">
                  Necesita al menos {MIN_LENGTH} caracteres.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Repetir contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Escribila de nuevo"
              />
              {mismatch && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {completeChange.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar y continuar
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
