import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Users,
  CreditCard,
  Receipt,
  BarChart3,
  ClipboardList,
  Bell,
  Settings,
  PieChart,
  Percent,
  Moon,
  Sun,
  LogOut,
  Shield,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';

// ─── Navigation Items ────────────────────────────────────────────────

const navPages = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'Navegación', keywords: ['inicio', 'panel', 'resumen'] },
  { title: 'Reservas', href: '/bookings', icon: CalendarDays, group: 'Operaciones', keywords: ['booking', 'reserva'] },
  { title: 'Disponibilidad', href: '/availability', icon: PieChart, group: 'Operaciones', keywords: ['ocupacion', 'libre', 'calendario', 'fecha', 'agenda', 'timeline'] },
  { title: 'Habitaciones', href: '/rooms', icon: BedDouble, group: 'Operaciones', keywords: ['room', 'cuarto', 'suite'] },
  { title: 'Huéspedes', href: '/guests', icon: Users, group: 'Operaciones', keywords: ['guest', 'cliente', 'pasajero'] },
  { title: 'Limpieza', href: '/housekeeping', icon: ClipboardList, group: 'Operaciones', keywords: ['housekeeping', 'limpio', 'sucio'] },
  { title: 'Pagos', href: '/payments', icon: CreditCard, group: 'Finanzas', keywords: ['pago', 'cobro', 'dinero'] },
  { title: 'Gastos', href: '/expenses', icon: Receipt, group: 'Finanzas', keywords: ['gasto', 'costo', 'proveedor'] },
  { title: 'Facturación', href: '/billing', icon: Receipt, group: 'Finanzas', keywords: ['factura', 'invoice', 'comprobante'] },
  { title: 'Tarifas', href: '/rates', icon: Percent, group: 'Finanzas', keywords: ['tarifa', 'precio', 'rate'] },
  { title: 'Estadísticas', href: '/statistics', icon: BarChart3, group: 'Reportes', keywords: ['reporte', 'stats', 'analisis'] },
  { title: 'Auditoría', href: '/audit-log', icon: Shield, group: 'Reportes', keywords: ['audit', 'auditoria', 'actividad', 'historial', 'log'] },
  { title: 'Notificaciones', href: '/notifications', icon: Bell, group: 'Sistema', keywords: ['alerta', 'aviso'] },
  { title: 'Configuración', href: '/settings', icon: Settings, group: 'Sistema', keywords: ['config', 'ajustes', 'preferencias'] },
];

// ─── Component ───────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { signOut } = useAuth();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms } = useRoomOperations();

  const [search, setSearch] = useState('');

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // ─── Live Search Results ─────────────────────────────────────────

  const searchResults = useMemo(() => {
    if (search.length < 2) return { bookings: [], guests: [], rooms: [] };

    const q = search.toLowerCase();

    const matchedBookings = bookings
      .filter(b => {
        const guest = guests.find(g => g.id === b.guestId);
        const guestName = guest ? guest.fullName.toLowerCase() : '';
        return guestName.includes(q) || b.id.toLowerCase().includes(q) || b.status.toLowerCase().includes(q);
      })
      .slice(0, 5);

    const matchedGuests = guests
      .filter(g => {
        return g.fullName.toLowerCase().includes(q) || (g.email || '').toLowerCase().includes(q) || (g.phone || '').includes(q);
      })
      .slice(0, 5);

    const matchedRooms = rooms
      .filter(r => {
        return r.roomNumber.toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
      })
      .slice(0, 5);

    return { bookings: matchedBookings, guests: matchedGuests, rooms: matchedRooms };
  }, [search, bookings, guests, rooms]);

  const hasSearchResults = searchResults.bookings.length > 0 || searchResults.guests.length > 0 || searchResults.rooms.length > 0;

  // ─── Handlers ────────────────────────────────────────────────────

  const goTo = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleTheme = (theme: string) => {
    setTheme(theme);
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
  };

  // ─── Grouped pages ──────────────────────────────────────────────

  const groups = useMemo(() => {
    const grouped: Record<string, typeof navPages> = {};
    navPages.forEach(page => {
      if (!grouped[page.group]) grouped[page.group] = [];
      grouped[page.group].push(page);
    });
    return grouped;
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar páginas, reservas, huéspedes, habitaciones..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>

        {/* Live Data Results */}
        {hasSearchResults && (
          <>
            {searchResults.guests.length > 0 && (
              <CommandGroup heading="Huéspedes">
                {searchResults.guests.map((guest) => (
                  <CommandItem
                    key={`guest-${guest.id}`}
                    onSelect={() => goTo(`/guests/${guest.id}`)}
                    className="flex items-center gap-3"
                  >
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{guest.fullName}</span>
                      <span className="text-xs text-muted-foreground">{guest.email || guest.phone || 'Sin contacto'}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchResults.bookings.length > 0 && (
              <CommandGroup heading="Reservas">
                {searchResults.bookings.map((booking) => {
                  const guest = guests.find(g => g.id === booking.guestId);
                  return (
                    <CommandItem
                      key={`booking-${booking.id}`}
                      onSelect={() => goTo(`/bookings/${booking.id}`)}
                      className="flex items-center gap-3"
                    >
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{guest ? guest.fullName : 'Reserva'}</span>
                        <span className="text-xs text-muted-foreground">
                          {booking.status} · {new Date(booking.checkInDate).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {searchResults.rooms.length > 0 && (
              <CommandGroup heading="Habitaciones">
                {searchResults.rooms.map((room) => (
                  <CommandItem
                    key={`room-${room.id}`}
                    onSelect={() => goTo('/rooms')}
                    className="flex items-center gap-3"
                  >
                    <BedDouble className="w-4 h-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Hab. {room.roomNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        Piso {room.floor} · {room.status}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
          </>
        )}

        {/* Navigation Pages */}
        {Object.entries(groups).map(([group, pages]) => (
          <CommandGroup key={group} heading={group}>
            {pages.map((page) => (
              <CommandItem
                key={page.href}
                onSelect={() => goTo(page.href)}
                keywords={page.keywords}
              >
                <page.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                {page.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        {/* Quick Actions */}
        <CommandGroup heading="Acciones rápidas">
          <CommandItem onSelect={() => handleTheme('light')} keywords={['claro', 'light', 'tema']}>
            <Sun className="w-4 h-4 mr-2 text-muted-foreground" />
            Tema claro
          </CommandItem>
          <CommandItem onSelect={() => handleTheme('dark')} keywords={['oscuro', 'dark', 'tema']}>
            <Moon className="w-4 h-4 mr-2 text-muted-foreground" />
            Tema oscuro
          </CommandItem>
          <CommandItem onSelect={handleSignOut} keywords={['cerrar', 'logout', 'salir']}>
            <LogOut className="w-4 h-4 mr-2 text-destructive" />
            <span className="text-destructive">Cerrar sesión</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// ─── Hook for keyboard shortcut ──────────────────────────────────────

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { open, setOpen };
}
