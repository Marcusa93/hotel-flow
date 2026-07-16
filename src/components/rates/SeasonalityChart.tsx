import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Rate } from '@/types/hotel';
import { useMemo } from 'react';
import { format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';

interface SeasonalityChartProps {
    rates: Rate[];
}

export function SeasonalityChart({ rates }: SeasonalityChartProps) {
    // Derive the base price from real rate data (avg of the active rates' prices).
    const basePrice = useMemo(() => {
        const prices = rates
            .filter(r => r.isActive && typeof r.price === 'number' && r.price > 0)
            .map(r => r.price as number);
        if (prices.length === 0) return null;
        return prices.reduce((sum, p) => sum + p, 0) / prices.length;
    }, [rates]);

    const data = useMemo(() => {
        if (basePrice === null) return [];
        const yearMonths = eachMonthOfInterval({
            start: startOfYear(new Date()),
            end: endOfYear(new Date())
        });

        return yearMonths.map(month => {
            const monthIdx = month.getMonth();
            let multiplier = 1.0;

            // Summer (Southern Hemisphere)
            if (monthIdx <= 1) multiplier = 1.4; // Jan, Feb
            if (monthIdx === 11) multiplier = 1.3; // Dec

            // Winter Break
            if (monthIdx === 6) multiplier = 1.3; // July

            return {
                month: format(month, 'MMM', { locale: es }),
                price: Math.round(basePrice * multiplier)
            };
        });
    }, [basePrice]);

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Proyección estimada de precios
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    {data.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">
                            Cargá tarifas para ver una proyección estacional
                        </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColors.gold} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chartColors.gold} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} vertical={false} stroke={chartGrid.stroke} opacity={0.5} />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tick={chartAxis.tick}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value}`}
                                tick={chartAxis.tick}
                            />
                            <Tooltip
                                contentStyle={chartTooltip.contentStyle}
                                formatter={(value: number) => [`$${value}`, 'Precio Promedio']}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={chartColors.gold}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorPrice)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
