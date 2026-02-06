import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Users,
  CreditCard,
  BarChart3,
  Receipt,
  Bell,
  Settings,
  Percent,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Building2,
  Menu,
  PieChart
} from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'reception' | 'housekeeping' | 'auditor')[];
  badge?: string;
  readOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'reception'] },
  { title: 'Disponibilidad', href: '/availability', icon: PieChart, roles: ['admin', 'reception'] },
  { title: 'Reservas', href: '/bookings', icon: CalendarDays, roles: ['admin', 'reception'] },
  { title: 'Calendario', href: '/calendar', icon: CalendarDays, roles: ['admin', 'reception'] },
  { title: 'Habitaciones', href: '/rooms', icon: BedDouble, roles: ['admin', 'reception', 'housekeeping'] },
  { title: 'Huéspedes', href: '/guests', icon: Users, roles: ['admin', 'reception'] },
  { title: 'Pagos', href: '/payments', icon: CreditCard, roles: ['admin', 'reception', 'auditor'], readOnly: true },
  { title: 'Tarifas', href: '/rates', icon: Percent, roles: ['admin', 'reception'] },
  { title: 'Estadísticas', href: '/statistics', icon: BarChart3, roles: ['admin', 'auditor'], readOnly: true },
  { title: 'Facturación', href: '/billing', icon: Receipt, roles: ['admin', 'auditor'], readOnly: true },
  { title: 'Limpieza', href: '/housekeeping', icon: ClipboardList, roles: ['admin', 'housekeeping'] },
  { title: 'Notificaciones', href: '/notifications', icon: Bell, roles: ['admin'] },
  { title: 'Configuración', href: '/settings', icon: Settings, roles: ['admin', 'reception', 'housekeeping', 'auditor'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentRole } = useHotel();

  const filteredItems = navItems.filter(item => item.roles.includes(currentRole));
  const isAuditor = currentRole === 'auditor';

  return (
    <aside

      // Fixed Navy Background for Sidebar
      className={cn(
        "flex flex-col border-r border-[#003366] transition-all duration-300",
        "bg-[#003366] text-white", // Enforcing Navy background and White text
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-20 px-4 border-b border-white/10",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm overflow-hidden shrink-0">
            <img src="/logo.png" alt="Logo HM" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-fade-in">
              <span className="font-bold text-lg tracking-tight text-white">Hotel Manager</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-white/70">Panel de Control</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-6">
        <nav className="px-3 space-y-1.5">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.href;
            const showReadOnly = isAuditor && item.readOnly;

            const linkContent = (
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-[rgba(255,255,255,0.12)] text-white shadow-none"
                    : "text-white/70 hover:text-white hover:bg-white/10",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200",
                  isActive ? "text-primary-foreground" : "group-hover:scale-110",
                )} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-sm font-medium tracking-wide">{item.title}</span>
                    {showReadOnly && (
                      <span className="read-only-badge bg-black/5 dark:bg-white/10">Solo lectura</span>
                    )}
                  </>
                )}
                {isActive && !collapsed && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full" />
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2 glass border-none shadow-xl">
                    {item.title}
                    {showReadOnly && <span className="read-only-badge">Solo lectura</span>}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>
      </ScrollArea>

      {/* Collapse button */}
      <div className="p-4 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5 data-[state=open]:bg-transparent",
            collapsed && "px-2 justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium uppercase tracking-wider">Colapsar Menú</span>
            </>
          )}
        </Button>
      </div>
    </aside >
  );
}
