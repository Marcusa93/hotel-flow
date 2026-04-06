
import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
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
  PieChart,
  Menu,
  Shield,
} from 'lucide-react';
import { useAppRole } from '@/context/AppRoleContext';
import { useUnreadCount } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'reception' | 'housekeeping' | 'auditor')[];
  badge?: string;
  readOnly?: boolean;
}

const navItems: NavItem[] = [
  // Dashboard - Vista general
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'reception'] },

  // Operaciones diarias
  { title: 'Reservas', href: '/bookings', icon: CalendarDays, roles: ['admin', 'reception'] },
  { title: 'Habitaciones', href: '/rooms', icon: BedDouble, roles: ['admin', 'reception', 'housekeeping'] },
  { title: 'Huéspedes', href: '/guests', icon: Users, roles: ['admin', 'reception'] },
  { title: 'Limpieza', href: '/housekeeping', icon: ClipboardList, roles: ['admin', 'housekeeping'] },

  // Finanzas
  { title: 'Finanzas', href: '/payments', icon: CreditCard, roles: ['admin', 'reception', 'auditor'], readOnly: true },
  { title: 'Gastos', href: '/expenses', icon: Receipt, roles: ['admin', 'reception', 'auditor'] },
  { title: 'Tarifas', href: '/rates', icon: Percent, roles: ['admin', 'reception'] },
  { title: 'Auditoría', href: '/audit-log', icon: Shield, roles: ['admin', 'auditor'], readOnly: true },

  // Sistema
  { title: 'Notificaciones', href: '/notifications', icon: Bell, roles: ['admin', 'reception'] },
  { title: 'Configuración', href: '/settings', icon: Settings, roles: ['admin', 'reception', 'housekeeping', 'auditor'] },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onCollapse?: () => void;
  isMobile?: boolean; // If true, never collapsed
  onNavigate?: () => void; // Called when a nav item is clicked (used to close mobile sheet)
}

function SidebarContent({ collapsed = false, onCollapse, isMobile = false, onNavigate }: SidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole } = useAppRole();
  const { data: unreadCount = 0 } = useUnreadCount();
  const filteredItems = navItems.filter(item => item.roles.includes(currentRole));
  const isAuditor = currentRole === 'auditor';

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className={cn(
        "flex items-center h-20 px-4 border-b border-white/10",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm overflow-hidden shrink-0">
            <img src="/logo.png" alt="Logo HM" className="w-full h-full object-cover" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex flex-col animate-fade-in">
              <span className="font-bold text-lg tracking-tight text-sidebar-foreground">HoMe</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/70">Panel de Control</span>
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

            const handleClick = isMobile && onNavigate ? (e: React.MouseEvent) => {
              e.preventDefault();
              onNavigate();
              navigate(item.href);
            } : undefined;

            const linkContent = (
              <Link
                to={item.href}
                onClick={handleClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden active:scale-[0.97]",
                  isActive
                    ? "bg-[rgba(255,255,255,0.12)] text-sidebar-foreground shadow-none"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10",
                  collapsed && !isMobile && "justify-center px-2"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200",
                  isActive ? "text-primary-foreground" : "group-hover:scale-110",
                )} />
                {(!collapsed || isMobile) && (
                  <>
                    <span className="flex-1 text-sm font-medium tracking-wide">{item.title}</span>
                    {item.href === '/notifications' && unreadCount > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-rose-500 text-white rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {showReadOnly && (
                      <span className="read-only-badge bg-black/5 dark:bg-white/10">Solo lectura</span>
                    )}
                  </>
                )}
                {collapsed && !isMobile && item.href === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold bg-rose-500 text-white rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {isActive && !collapsed && !isMobile && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full" />
                )}
              </Link>
            );

            if (collapsed && !isMobile) {
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

      {/* Collapse button (Desktop only) */}
      {!isMobile && (
        <div className="p-4 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapse}
            className={cn(
              "w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-white/10 data-[state=open]:bg-transparent",
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
      )}
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0",
        "bg-sidebar",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
    </aside >
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-sidebar-foreground hover:bg-white/10">
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 border-r-0 w-72 bg-sidebar text-sidebar-foreground">
        <SidebarContent isMobile={true} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
