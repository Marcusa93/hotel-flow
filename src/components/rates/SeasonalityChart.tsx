import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Rate } from '@/types/hotel';
import { useMemo } from 'react';
import { format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

interface SeasonalityChartProps {
    rates: Rate[];
}

export function SeasonalityChart({ rates }: SeasonalityChartProps) {
    const data = useMemo(() => {
        // Normalize rates to a monthly average or trend
        // For visual purposes, we'll project the "Standard" rate or average active rate behavior
        const yearMonths = eachMonthOfInterval({
            start: startOfYear(new Date()),
            end: endOfYear(new Date())
        });

        return yearMonths.map(month => {
            // Mock logic: Seasonality curve (High seasons: Jan/Feb + Jul, Low: May/Jun)
            const monthIdx = month.getMonth();
            let multiplier = 1.0;

            // Summer (Southern Hemisphere)
            if (monthIdx <= 1) multiplier = 1.4; // Jan, Feb
            if (monthIdx === 11) multiplier = 1.3; // Dec

            // Winter Break
            if (monthIdx === 6) multiplier = 1.3; // July

            // Base price reference (e.g. $100 or avg of rates)
            const basePrice = 120;

            return {
                month: format(month, 'MMM', { locale: es }),
                price: Math.round(basePrice * multiplier)
            };
        });
    }, [rates]);

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Proyección de Precios (Estacionalidad 2026)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value}`}
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.5)',
                                    borderRadius: '12px',
                                    fontWeight: 'bold',
                                    color: '#0f172a'
                                }}
                                formatter={(value: number) => [`$${value}`, 'Precio Promedio']}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorPrice)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
