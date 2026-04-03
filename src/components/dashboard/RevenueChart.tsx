import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';
import { useRevenueStats } from '@/hooks/useRevenueStats';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function RevenueChart() {
    const [days, setDays] = useState<7 | 30>(7);
    const { data: revenueStats, isLoading } = useRevenueStats(days);

    const data = (revenueStats || []).map(stat => ({
        name: days === 7
            ? format(new Date(stat.date), 'EEE', { locale: es })
            : format(new Date(stat.date), 'dd/MM'),
        value: stat.revenue,
    }));

    const total = data.reduce((s, d) => s + d.value, 0);

    if (isLoading) {
        return <Skeleton className="h-[360px] w-full rounded-xl" />;
    }

    return (
        <Card className="border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <CardTitle className="text-lg">Ingresos</CardTitle>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                            ${total.toLocaleString('es-AR')}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                        <Button
                            size="sm"
                            variant={days === 7 ? 'default' : 'ghost'}
                            className={cn("h-7 text-xs rounded-md", days === 7 && 'shadow-sm')}
                            onClick={() => setDays(7)}
                        >
                            7 días
                        </Button>
                        <Button
                            size="sm"
                            variant={days === 30 ? 'default' : 'ghost'}
                            className={cn("h-7 text-xs rounded-md", days === 30 && 'shadow-sm')}
                            onClick={() => setDays(30)}
                        >
                            30 días
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorRevenueGraph" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColors.revenue} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColors.revenue} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} vertical={false} stroke={chartGrid.stroke} opacity={0.4} />
                        <XAxis
                            dataKey="name"
                            stroke={chartAxis.tick.fill}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={days === 30 ? 4 : 0}
                        />
                        <YAxis
                            stroke={chartAxis.tick.fill}
                            fontSize={chartAxis.tick.fontSize}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            dx={-10}
                            width={45}
                        />
                        <Tooltip
                            contentStyle={chartTooltip.contentStyle}
                            formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']}
                            cursor={{ stroke: chartColors.revenue, strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={chartColors.revenue}
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorRevenueGraph)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
