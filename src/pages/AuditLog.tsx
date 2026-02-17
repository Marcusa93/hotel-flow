import { useState, useMemo } from 'react';
import { useAuditLogOperations } from '@/hooks/domain/useAuditLogOperations';
import { PageHeader, KPICard } from '@/components/shared';
import { AuditTimeline, AuditFilters, AuditActivityChart } from '@/components/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  FileSpreadsheet,
  PlusCircle,
  RefreshCw,
  ArrowLeftRight,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { subMonths } from 'date-fns';
import type { AuditAction, AuditEntityType } from '@/types/hotel';

const PAGE_SIZE = 50;

export default function AuditLog() {
  const { toast } = useToast();

  // Filter state
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

  // Client-side search filter
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return auditLogs;
    const q = searchQuery.toLowerCase();
    return auditLogs.filter(log =>
      log.description.toLowerCase().includes(q) ||
      log.userEmail?.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q)
    );
  }, [auditLogs, searchQuery]);

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
      toast({
        title: 'Excel generado',
        description: `${filteredLogs.length} registros exportados`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo generar el archivo',
        variant: 'destructive',
      });
    }
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Actividad"
        description={`${filteredLogs.length} eventos registrados${searchQuery ? ' (filtrados)' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <Download className="w-3.5 h-3.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Creaciones"
          value={actionCounts.CREATE}
          icon={<PlusCircle className="w-5 h-5" />}
          iconColor="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextColor="text-emerald-600 dark:text-emerald-400"
          variant="success"
        />
        <KPICard
          title="Actualizaciones"
          value={actionCounts.UPDATE}
          icon={<RefreshCw className="w-5 h-5" />}
          iconColor="bg-blue-100 dark:bg-blue-900/30"
          iconTextColor="text-blue-600 dark:text-blue-400"
          variant="primary"
        />
        <KPICard
          title="Cambios de Estado"
          value={actionCounts.STATUS_CHANGE}
          icon={<ArrowLeftRight className="w-5 h-5" />}
          iconColor="bg-amber-100 dark:bg-amber-900/30"
          iconTextColor="text-amber-600 dark:text-amber-400"
          variant="warning"
        />
        <KPICard
          title="Eliminaciones"
          value={actionCounts.DELETE}
          icon={<Trash2 className="w-5 h-5" />}
          iconColor="bg-rose-100 dark:bg-rose-900/30"
          iconTextColor="text-rose-600 dark:text-rose-400"
          variant="danger"
        />
      </div>

      {/* Activity Chart */}
      {auditLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Actividad diaria
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
