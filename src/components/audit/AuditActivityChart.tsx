import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';
import type { AuditLog } from '@/types/hotel';

interface AuditActivityChartProps {
  logs: AuditLog[];
  dateRange: { from: Date; to: Date };
}

export function AuditActivityChart({ logs, dateRange }: AuditActivityChartProps) {
  const data = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

    const countsByDay = new Map<string, { CREATE: number; UPDATE: number; DELETE: number; STATUS_CHANGE: number }>();
    days.forEach(day => {
      countsByDay.set(format(day, 'yyyy-MM-dd'), { CREATE: 0, UPDATE: 0, DELETE: 0, STATUS_CHANGE: 0 });
    });

    logs.forEach(log => {
      const dayKey = format(startOfDay(log.createdAt), 'yyyy-MM-dd');
      const entry = countsByDay.get(dayKey);
      if (entry) {
        entry[log.action]++;
      }
    });

    return Array.from(countsByDay.entries()).map(([date, counts]) => ({
      date,
      label: format(new Date(date), 'dd MMM', { locale: es }),
      Creaciones: counts.CREATE,
      Actualizaciones: counts.UPDATE,
      'Cambios Estado': counts.STATUS_CHANGE,
      Eliminaciones: counts.DELETE,
    }));
  }, [logs, dateRange]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} stroke={chartGrid.stroke} />
        <XAxis
          dataKey="label"
          tick={{ ...chartAxis.tick, fontSize: 10 }}
          interval={data.length > 14 ? Math.floor(data.length / 7) : 0}
        />
        <YAxis
          tick={{ ...chartAxis.tick, fontSize: 10 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ ...chartTooltip.contentStyle, fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Creaciones" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Actualizaciones" stackId="a" fill="#3b82f6" />
        <Bar dataKey="Cambios Estado" stackId="a" fill="#f59e0b" />
        <Bar dataKey="Eliminaciones" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
