import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';

interface RevenueChartProps {
    data: { name: string; value: number }[];
    isLoading?: boolean;
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
    if (isLoading) {
        return <Skeleton className="col-span-full lg:col-span-4 h-[400px] w-full rounded-xl" />;
    }
    return (
        <Card className="col-span-full lg:col-span-4 h-[400px] border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur">
            <CardHeader>
                <CardTitle className="text-lg">Ingresos</CardTitle>
                <CardDescription>Rendimiento diario esta semana</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
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
                            fontSize={chartAxis.tick.fontSize}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke={chartAxis.tick.fill}
                            fontSize={chartAxis.tick.fontSize}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                            dx={-10}
                        />
                        <Tooltip
                            contentStyle={chartTooltip.contentStyle}
                            cursor={{ stroke: chartColors.revenue, strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={chartColors.revenue}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRevenueGraph)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
