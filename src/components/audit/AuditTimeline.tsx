import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Users,
  BedDouble,
  CreditCard,
  Receipt,
  ClipboardList,
  Percent,
  Settings,
  ChevronDown,
  ChevronRight,
  Activity,
  DollarSign,
  ExternalLink,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AuditLog, AuditEntityType, AuditAction } from '@/types/hotel';

interface AuditTimelineProps {
  logs: AuditLog[];
  isLoading?: boolean;
  maxItems?: number;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
}

const entityIcons: Record<AuditEntityType, any> = {
  booking: CalendarDays,
  guest: Users,
  room: BedDouble,
  payment: CreditCard,
  invoice: Receipt,
  housekeeping_task: ClipboardList,
  rate: Percent,
  expense: DollarSign,
  hotel_settings: Settings,
  booking_charge: ShoppingCart,
};

const entityLabels: Record<AuditEntityType, string> = {
  booking: 'Reserva',
  guest: 'Huésped',
  room: 'Habitación',
  payment: 'Pago',
  invoice: 'Factura',
  housekeeping_task: 'Limpieza',
  rate: 'Tarifa',
  expense: 'Gasto',
  hotel_settings: 'Config.',
  booking_charge: 'Cargo de Reserva',
};

const entityRoutes: Partial<Record<AuditEntityType, string>> = {
  booking: '/bookings',
  guest: '/guests',
  room: '/rooms',
  payment: '/payments',
  invoice: '/billing',
  housekeeping_task: '/housekeeping',
  rate: '/rates',
  expense: '/expenses',
};

const actionColors: Record<AuditAction, string> = {
  CREATE: 'bg-emerald-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-rose-500',
  STATUS_CHANGE: 'bg-amber-500',
};

const actionBadgeVariants: Record<AuditAction, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  DELETE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  STATUS_CHANGE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const actionLabels: Record<AuditAction, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio Estado',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DiffViewer({ oldValues, newValues }: { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }) {
  const hasOld = Object.keys(oldValues).length > 0;
  const hasNew = Object.keys(newValues).length > 0;

  if (!hasOld && !hasNew) return null;

  // Only new values — compact list
  if (!hasOld && hasNew) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs space-y-1">
        <span className="text-muted-foreground font-sans font-medium text-[11px]">Valores:</span>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mt-1">
          {Object.entries(newValues).map(([key, value]) => (
            <div key={key} className="contents">
              <span className="text-muted-foreground font-mono">{key}</span>
              <span className="text-foreground/80 truncate font-mono">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Side-by-side diff
  const allKeys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])];

  return (
    <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs space-y-1 overflow-x-auto">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-1 min-w-0">
        <span className="text-muted-foreground font-sans font-medium text-[11px] pb-1 border-b border-border/50">Anterior</span>
        <span className="border-b border-border/50" />
        <span className="text-muted-foreground font-sans font-medium text-[11px] pb-1 border-b border-border/50">Nuevo</span>
        {allKeys.map(key => {
          const oldVal = oldValues[key];
          const newVal = newValues[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          return (
            <div key={key} className="contents">
              <div className={`truncate font-mono ${changed ? 'text-rose-600 dark:text-rose-400 line-through' : 'text-foreground/60'}`}>
                <span className="text-muted-foreground mr-1">{key}:</span>
                {oldVal !== undefined ? formatValue(oldVal) : '—'}
              </div>
              <ArrowRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${changed ? 'text-amber-500' : 'text-muted-foreground/40'}`} />
              <div className={`truncate font-mono ${changed ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-foreground/60'}`}>
                {newVal !== undefined ? formatValue(newVal) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditLogEntry({ log, index }: { log: AuditLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const Icon = entityIcons[log.entityType] || Activity;
  const hasDetails = Object.keys(log.oldValues).length > 0 || Object.keys(log.newValues).length > 0;
  const route = entityRoutes[log.entityType];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.3 }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {/* Timeline line */}
      <div className="absolute left-[17px] top-10 bottom-0 w-px bg-border last:hidden" />

      {/* Dot */}
      <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${actionColors[log.action]} shadow-sm`}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 ${actionBadgeVariants[log.action]}`}>
              {actionLabels[log.action]}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 gap-1 ${route ? 'cursor-pointer hover:bg-accent transition-colors' : ''}`}
              onClick={route ? () => navigate(route) : undefined}
            >
              {entityLabels[log.entityType]}
              {route && <ExternalLink className="w-2.5 h-2.5" />}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatDistanceToNow(log.createdAt, { addSuffix: true, locale: es })}
          </span>
        </div>

        <p className="text-sm text-foreground leading-snug mb-1">{log.description}</p>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{format(log.createdAt, 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          {log.userEmail && <span>{log.userEmail}</span>}
          {log.userRole && <span className="capitalize">{log.userRole}</span>}
        </div>

        {hasDetails && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 text-[11px] text-muted-foreground hover:text-foreground px-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
            {expanded ? 'Ocultar cambios' : 'Ver cambios'}
          </Button>
        )}

        <AnimatePresence>
          {expanded && hasDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <DiffViewer oldValues={log.oldValues} newValues={log.newValues} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditTimeline({ logs, isLoading, maxItems, showLoadMore, onLoadMore }: AuditTimelineProps) {
  const displayLogs = maxItems ? logs.slice(0, maxItems) : logs;

  if (isLoading) return <TimelineSkeleton />;

  if (displayLogs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sin actividad"
        description="No se encontraron registros de actividad con los filtros seleccionados."
      />
    );
  }

  return (
    <div className="space-y-0">
      {displayLogs.map((log, index) => (
        <AuditLogEntry key={log.id} log={log} index={index} />
      ))}
      {showLoadMore && (
        <div className="pt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Cargar más registros
          </Button>
        </div>
      )}
    </div>
  );
}
