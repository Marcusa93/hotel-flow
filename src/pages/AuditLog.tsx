import { useState } from 'react';
import { useAuditLogOperations } from '@/hooks/domain/useAuditLogOperations';
import { PageHeader, KPICard } from '@/components/shared';
import { AuditTimeline, AuditFilters } from '@/components/audit';
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
  Shield,
  Download,
  FileSpreadsheet,
  PlusCircle,
  RefreshCw,
  ArrowLeftRight,
  Trash2,
} from 'lucide-react';
import { subMonths } from 'date-fns';
import type { AuditAction, AuditEntityType } from '@/types/hotel';

export default function AuditLog() {
  const { toast } = useToast();

  // Filter state
  const [entityType, setEntityType] = useState<AuditEntityType | undefined>();
  const [action, setAction] = useState<AuditAction | undefined>();
  const [dateRange, setDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  const { auditLogs, isLoading, actionCounts, refetch } = useAuditLogOperations({
    entityType,
    action,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const clearFilters = () => {
    setEntityType(undefined);
    setAction(undefined);
    setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
  };

  const handleExportExcel = async () => {
    try {
      const { exportAuditLogsToExcel } = await import('@/lib/exportUtils');
      exportAuditLogsToExcel({ auditLogs, dateRange });
      toast({
        title: 'Excel generado',
        description: `${auditLogs.length} registros exportados`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el archivo',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Actividad"
        subtitle={`${auditLogs.length} eventos registrados`}
        icon={Shield}
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
          icon={PlusCircle}
          color="emerald"
        />
        <KPICard
          title="Actualizaciones"
          value={actionCounts.UPDATE}
          icon={RefreshCw}
          color="blue"
        />
        <KPICard
          title="Cambios de Estado"
          value={actionCounts.STATUS_CHANGE}
          icon={ArrowLeftRight}
          color="amber"
        />
        <KPICard
          title="Eliminaciones"
          value={actionCounts.DELETE}
          icon={Trash2}
          color="rose"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <AuditFilters
            entityType={entityType}
            action={action}
            dateRange={dateRange}
            onEntityTypeChange={setEntityType}
            onActionChange={setAction}
            onDateRangeChange={setDateRange}
            onClear={clearFilters}
          />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline
            logs={auditLogs}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
