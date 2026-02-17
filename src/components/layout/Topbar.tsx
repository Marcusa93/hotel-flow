import { Search, User, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { MobileSidebar } from './Sidebar';
import { CommandPalette, useCommandPalette } from './CommandPalette';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { useDashboardStats } from '@/hooks/domain/useDashboardStats';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/notifications';

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
  const { currentRole } = useAppRole();
  const { stats } = useDashboardStats();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  const displayName = user?.email?.split('@')[0] || 'Usuario';
  const displayEmail = user?.email || '';

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-sidebar border-b border-sidebar-border/20 shadow-sm gap-4">
      {/* Mobile Menu Trigger */}
      <MobileSidebar />

      {/* Search Trigger → Command Palette */}
      <button
        onClick={() => setCommandOpen(true)}
        className="flex items-center gap-3 flex-1 max-w-md hidden md:flex px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer group"
      >
        <Search className="w-4 h-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70" />
        <span className="text-sm text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60">
          Buscar reservas, huéspedes, habitaciones...
        </span>
        <kbd className="ml-auto hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-sidebar-foreground/20 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/40">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Right side */}
      <div className="flex items-center gap-3 text-sidebar-foreground">
        {/* Quick stats */}
        <div className="hidden lg:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-sidebar-foreground/60">Ocupación:</span>
            <span className="font-semibold text-sidebar-foreground">{stats.occupancyRate.toFixed(0)}%</span>
          </div>
          <div className="w-px h-4 bg-sidebar-foreground/20" />
          <div className="flex items-center gap-2">
            <span className="text-sidebar-foreground/60">Check-ins hoy:</span>
            <span className="font-semibold text-sidebar-foreground">{stats.checkInsToday}</span>
          </div>
        </div>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10 h-9 w-9">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Cambiar tema</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="w-4 h-4 mr-2" />
              Claro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="w-4 h-4 mr-2" />
              Oscuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="w-4 h-4 mr-2" />
              Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Bell */}
        <NotificationBell />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-sidebar-foreground" />
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium capitalize">{displayName}</span>
                <Badge variant="outline" className={`text-xs border-white/20 text-sidebar-foreground ${roleColors[currentRole].replace('bg-primary', 'bg-white/20')}`}>
                  {roleLabels[currentRole]}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="capitalize">{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">{displayEmail}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
