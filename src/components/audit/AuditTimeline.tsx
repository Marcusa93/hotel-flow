import { useState } from 'react';
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
}

const entityIcons: Record<AuditEntityType, any> = {
  booking: CalendarDays,
  guest: Users,
  room: BedDouble,
  payment: CreditCard,
  invoice: Receipt,
  housekeeping_task: ClipboardList,
  rate: Percent,
  expense: Receipt,
  hotel_settings: Settings,
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

function AuditLogEntry({ log, index }: { log: AuditLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = entityIcons[log.entityType] || Activity;
  const hasDetails = Object.keys(log.oldValues).length > 0 || Object.keys(log.newValues).length > 0;

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
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {entityLabels[log.entityType]}
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
            {expanded ? 'Ocultar detalles' : 'Ver detalles'}
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
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-2">
                {Object.keys(log.newValues).length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-sans font-medium">Nuevos valores:</span>
                    <pre className="mt-1 whitespace-pre-wrap text-foreground/80">
                      {JSON.stringify(log.newValues, null, 2)}
                    </pre>
                  </div>
                )}
                {Object.keys(log.oldValues).length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-sans font-medium">Valores anteriores:</span>
                    <pre className="mt-1 whitespace-pre-wrap text-foreground/80">
                      {JSON.stringify(log.oldValues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
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

export function AuditTimeline({ logs, isLoading, maxItems }: AuditTimelineProps) {
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
    </div>
  );
}
