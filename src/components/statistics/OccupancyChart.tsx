import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';

interface OccupancyChartProps {
    data: Array<{
        name: string;
        value: number;
    }>;
}

export function OccupancyChart({ data }: OccupancyChartProps) {
    const chartData = useMemo(() => {
        return data.map(item => ({
            ...item,
            fill: item.value > 80
                ? chartColors.emerald
                : item.value > 50
                    ? chartColors.blue
                    : chartColors.muted
        }));
    }, [data]);

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Ocupación por Categoría
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} horizontal={false} stroke={chartGrid.stroke} opacity={0.5} />
                            <XAxis
                                type="number"
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}%`}
                                hide
                            />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={100}
                                tick={chartAxis.tick}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={chartTooltip.contentStyle}
                                formatter={(value: number) => [`${value}%`, 'Ocupación']}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
