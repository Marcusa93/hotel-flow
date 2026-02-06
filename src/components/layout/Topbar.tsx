import { Bell, Search, User, LogOut } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const roleLabels = {
  admin: 'Administrador',
  reception: 'Recepción',
  housekeeping: 'Limpieza',
  auditor: 'Auditor',
};

const roleColors = {
  admin: 'bg-primary text-primary-foreground',
  reception: 'bg-chart-1 text-white',
  housekeeping: 'bg-chart-3 text-white',
  auditor: 'bg-chart-4 text-white',
};

export function Topbar() {
  const { currentRole, getDashboardStats } = useHotel();
  const stats = getDashboardStats();

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-[#003366] border-b border-white/10 shadow-sm">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
          <Input
            placeholder="Buscar reservas, huéspedes, habitaciones..."
            className="pl-10 bg-white/10 border-0 text-white placeholder:text-white/50 focus-visible:ring-1 focus-visible:ring-white/30"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 text-white">
        {/* Quick stats */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-white/70">Ocupación:</span>
            <span className="font-semibold text-white">{stats.occupancyRate.toFixed(0)}%</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-white/70">Check-ins hoy:</span>
            <span className="font-semibold text-white">{stats.checkInsToday}</span>
          </div>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10 hover:text-white">
              <Bell className="w-5 h-5" />
              {(stats.dirtyRooms > 0 || stats.pendingPayments > 0) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Alertas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stats.dirtyRooms > 0 && (
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{stats.dirtyRooms} habitaciones sucias</span>
                  <span className="text-xs text-muted-foreground">Requieren limpieza</span>
                </div>
              </DropdownMenuItem>
            )}
            {stats.maintenanceRooms > 0 && (
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{stats.maintenanceRooms} en mantenimiento</span>
                  <span className="text-xs text-muted-foreground">Fuera de servicio</span>
                </div>
              </DropdownMenuItem>
            )}
            {stats.pendingPayments > 0 && (
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Pagos pendientes</span>
                  <span className="text-xs text-muted-foreground">
                    ${stats.pendingPayments.toLocaleString('es-AR')} por cobrar
                  </span>
                </div>
              </DropdownMenuItem>
            )}
            {stats.checkInsToday > 0 && (
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{stats.checkInsToday} check-ins hoy</span>
                  <span className="text-xs text-muted-foreground">Esperando llegada</span>
                </div>
              </DropdownMenuItem>
            )}
            {stats.checkOutsToday > 0 && (
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{stats.checkOutsToday} check-outs hoy</span>
                  <span className="text-xs text-muted-foreground">Salidas programadas</span>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-white hover:bg-white/10 hover:text-white">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">Usuario Demo</span>
                <Badge variant="outline" className={`text-xs border-white/20 text-white ${roleColors[currentRole].replace('bg-primary', 'bg-white/20')}`}>
                  {roleLabels[currentRole]}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
