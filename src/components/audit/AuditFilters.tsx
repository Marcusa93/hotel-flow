import { Filter, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangeSelector } from '@/components/statistics/DateRangeSelector';
import type { AuditAction, AuditEntityType } from '@/types/hotel';

interface AuditFiltersProps {
  entityType?: AuditEntityType;
  action?: AuditAction;
  dateRange: { from: Date; to: Date };
  searchQuery?: string;
  onEntityTypeChange: (value: AuditEntityType | undefined) => void;
  onActionChange: (value: AuditAction | undefined) => void;
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onSearchChange?: (value: string) => void;
  onClear: () => void;
}

const entityTypeOptions: { value: AuditEntityType; label: string }[] = [
  { value: 'booking', label: 'Reservas' },
  { value: 'guest', label: 'Huéspedes' },
  { value: 'room', label: 'Habitaciones' },
  { value: 'payment', label: 'Pagos' },
  { value: 'invoice', label: 'Facturas' },
  { value: 'housekeeping_task', label: 'Limpieza' },
  { value: 'rate', label: 'Tarifas' },
  { value: 'expense', label: 'Gastos' },
  { value: 'hotel_settings', label: 'Configuración' },
];

const actionOptions: { value: AuditAction; label: string }[] = [
  { value: 'CREATE', label: 'Creación' },
  { value: 'UPDATE', label: 'Actualización' },
  { value: 'DELETE', label: 'Eliminación' },
  { value: 'STATUS_CHANGE', label: 'Cambio de Estado' },
];

export function AuditFilters({
  entityType,
  action,
  dateRange,
  searchQuery,
  onEntityTypeChange,
  onActionChange,
  onDateRangeChange,
  onSearchChange,
  onClear,
}: AuditFiltersProps) {
  const hasFilters = entityType || action || searchQuery;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />

      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar en descripción..."
            value={searchQuery || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 text-xs pl-7 w-[180px]"
          />
        </div>
      )}

      <Select
        value={entityType || '_all'}
        onValueChange={(v) => onEntityTypeChange(v === '_all' ? undefined : v as AuditEntityType)}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="Entidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas las entidades</SelectItem>
          {entityTypeOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={action || '_all'}
        onValueChange={(v) => onActionChange(v === '_all' ? undefined : v as AuditAction)}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Acción" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas las acciones</SelectItem>
          {actionOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangeSelector
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={onClear}>
          <X className="w-3 h-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
