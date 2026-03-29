import { useState, useMemo } from 'react';
import { useAuditLogOperations } from '@/hooks/domain/useAuditLogOperations';
import { PageHeader } from '@/components/shared';
import { AuditTimeline, AuditFilters, AuditActivityChart } from '@/components/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Download, FileSpreadsheet, RefreshCw, BarChart3, Users, Target,
  ShieldAlert, BedDouble, CalendarDays, CreditCard, User,
} from 'lucide-react';
import { subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AuditAction, AuditEntityType } from '@/types/hotel';

const PAGE_SIZE = 50;

const ENTITY_LABELS: Record<string, { label: string; icon: typeof BedDouble }> = {
  booking: { label: 'Reservas', icon: CalendarDays },
  payment: { label: 'Pagos', icon: CreditCard },
  room: { label: 'Habitaciones', icon: BedDouble },
  guest: { label: 'Huéspedes', icon: User },
  housekeeping_task: { label: 'Limpieza', icon: BedDouble },
  invoice: { label: 'Facturas', icon: CreditCard },
  rate: { label: 'Tarifas', icon: Target },
  expense: { label: 'Gastos', icon: CreditCard },
};

export default function AuditLog() {
  const { toast } = useToast();

  const [entityType, setEntityType] = useState<AuditEntityType | undefined>();
  const [action, setAction] = useState<AuditAction | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { auditLogs, isLoading, actionCounts, refetch } = useAuditLogOperations({
    entityType,
    action,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    limit: 500,
  });

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return auditLogs;
    const q = searchQuery.toLowerCase();
    return auditLogs.filter(log =>
      log.description.toLowerCase().includes(q) ||
      log.userEmail?.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q)
    );
  }, [auditLogs, searchQuery]);

  // ── SMART METRICS ──

  // Activity by entity type (sorted by count)
  const entityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of auditLogs) {
      counts[log.entityType] = (counts[log.entityType] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [auditLogs]);

  // Top users by activity
  const topUsers = useMemo(() => {
    const counts: Record<string, { email: string; role: string; count: number }> = {};
    for (const log of auditLogs) {
      const key = log.userEmail || 'sistema';
      if (!counts[key]) counts[key] = { email: key, role: log.userRole || '?', count: 0 };
      counts[key].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [auditLogs]);

  // Risk indicators
  const riskIndicators = useMemo(() => {
    const deletions = actionCounts.DELETE;
    const statusChanges = actionCounts.STATUS_CHANGE;
    const total = auditLogs.length;
    const deleteRate = total > 0 ? (deletions / total) * 100 : 0;

    // Most modified single entity
    const entityModCounts: Record<string, number> = {};
    for (const log of auditLogs) {
      const key = `${log.entityType}:${log.entityId}`;
      entityModCounts[key] = (entityModCounts[key] || 0) + 1;
    }
    const hotEntity = Object.entries(entityModCounts).sort(([, a], [, b]) => b - a)[0];

    return {
      deletions,
      deleteRate: deleteRate.toFixed(1),
      statusChanges,
      hotEntityKey: hotEntity?.[0],
      hotEntityCount: hotEntity?.[1] || 0,
    };
  }, [auditLogs, actionCounts]);

  const clearFilters = () => {
    setEntityType(undefined);
    setAction(undefined);
    setSearchQuery('');
    setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
    setVisibleCount(PAGE_SIZE);
  };

  const handleExportExcel = async () => {
    try {
      const { exportAuditLogsToExcel } = await import('@/lib/exportUtils');
      exportAuditLogsToExcel({ auditLogs: filteredLogs, dateRange });
      toast({ title: 'Excel generado', description: `${filteredLogs.length} registros exportados` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el archivo', variant: 'destructive' });
    }
  };

  const handleLoadMore = () => setVisibleCount(prev => prev + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Actividad"
        description={`${filteredLogs.length} eventos registrados${searchQuery ? ' (filtrados)' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", isLoading && "animate-spin")} />
              Actualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <Download className="w-3.5 h-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* ── SMART METRICS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Actividad por área */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Target className="w-4 h-4" /> Actividad por área
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {entityBreakdown.map(([type, count]) => {
              const config = ENTITY_LABELS[type] || { label: type, icon: Target };
              const pct = auditLogs.length > 0 ? (count / auditLogs.length) * 100 : 0;
              return (
                <div key={type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <config.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-8 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
            {entityBreakdown.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Usuarios más activos */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" /> Usuarios más activos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {topUsers.map((user, i) => (
              <div key={user.email} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-slate-300"
                  )}>
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{user.email.split('@')[0]}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{user.role}</Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{user.count}</span>
              </div>
            ))}
            {topUsers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Indicadores de riesgo */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="w-4 h-4" /> Indicadores clave
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Eliminaciones</span>
              <Badge variant={riskIndicators.deletions > 10 ? "destructive" : "secondary"} className="text-xs">
                {riskIndicators.deletions} ({riskIndicators.deleteRate}%)
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cambios de estado</span>
              <span className="text-xs font-mono font-bold">{riskIndicators.statusChanges}</span>
            </div>
            {riskIndicators.hotEntityCount > 3 && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Entidad con más cambios: {riskIndicators.hotEntityCount} modificaciones
                </p>
                <p className="text-amber-600 dark:text-amber-400 text-[10px] mt-0.5">
                  {riskIndicators.hotEntityKey?.split(':')[0]} #{riskIndicators.hotEntityKey?.split(':')[1]?.slice(0, 8)}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total eventos</span>
              <span className="text-xs font-mono font-bold">{auditLogs.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      {auditLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Actividad diaria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditActivityChart logs={auditLogs} dateRange={dateRange} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <AuditFilters
            entityType={entityType}
            action={action}
            dateRange={dateRange}
            searchQuery={searchQuery}
            onEntityTypeChange={(v) => { setEntityType(v); setVisibleCount(PAGE_SIZE); }}
            onActionChange={(v) => { setAction(v); setVisibleCount(PAGE_SIZE); }}
            onDateRangeChange={(r) => { setDateRange(r); setVisibleCount(PAGE_SIZE); }}
            onSearchChange={(v) => { setSearchQuery(v); setVisibleCount(PAGE_SIZE); }}
            onClear={clearFilters}
          />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Línea de tiempo
            {filteredLogs.length > visibleCount && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Mostrando {Math.min(visibleCount, filteredLogs.length)} de {filteredLogs.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline
            logs={filteredLogs}
            isLoading={isLoading}
            maxItems={visibleCount}
            showLoadMore={filteredLogs.length > visibleCount}
            onLoadMore={handleLoadMore}
          />
        </CardContent>
      </Card>
    </div>
  );
}
