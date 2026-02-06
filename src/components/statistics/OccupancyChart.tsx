import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';

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
            // Dynamic color based on occupancy level
            fill: item.value > 80 ? '#10b981' : item.value > 50 ? '#3b82f6' : '#64748b'
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
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
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
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.5)',
                                    borderRadius: '12px',
                                    fontWeight: 'bold',
                                    color: '#0f172a'
                                }}
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
