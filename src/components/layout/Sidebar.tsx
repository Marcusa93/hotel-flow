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
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">Hotel PMS</span>
            <span className="text-xs text-sidebar-foreground/60">Panel de Control</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-2 space-y-1">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.href;
            const showReadOnly = isAuditor && item.readOnly;
            
            const linkContent = (
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-primary" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-sidebar-primary")} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-sm font-medium">{item.title}</span>
                    {showReadOnly && (
                      <span className="read-only-badge">Solo lectura</span>
                    )}
                  </>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
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
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            collapsed && "px-2"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-sm">Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
