import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Cargando...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── KPI Card Skeleton ───────────────────────────────────────────────

interface KPISkeletonProps {
  count?: number;
  columns?: 2 | 3 | 4 | 5;
}

export function KPICardSkeleton({ count = 4, columns = 4 }: KPISkeletonProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
    5: 'md:grid-cols-2 lg:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-6 shadow-sm space-y-3"
        >
          <div className="flex justify-between items-start">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Table Skeleton ──────────────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function TableSkeleton({ rows = 5, columns = 5, showHeader = true }: TableSkeletonProps) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {showHeader && (
        <div className="border-b bg-muted/30 px-6 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      )}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-6 py-4 flex items-center gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={cn(
                  'h-4 flex-1',
                  colIdx === 0 && 'max-w-[200px]',
                  colIdx === columns - 1 && 'max-w-[100px]'
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── List / Feed Skeleton ────────────────────────────────────────────

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
}

export function ListSkeleton({ items = 5, showAvatar = true }: ListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Chart Skeleton ──────────────────────────────────────────────────

interface ChartSkeletonProps {
  height?: string;
}

export function ChartSkeleton({ height = 'h-[300px]' }: ChartSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 shadow-sm', height)}>
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="flex items-end gap-2 h-[calc(100%-80px)]">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page Skeleton (Full page with KPIs + Table) ─────────────────────

interface PageSkeletonProps {
  kpiCount?: number;
  tableRows?: number;
}

export function PageSkeleton({ kpiCount = 4, tableRows = 5 }: PageSkeletonProps) {
  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* KPIs */}
      <KPICardSkeleton count={kpiCount} />

      {/* Table */}
      <TableSkeleton rows={tableRows} />
    </div>
  );
}
