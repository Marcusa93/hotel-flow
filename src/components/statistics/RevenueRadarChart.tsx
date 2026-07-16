import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';

export interface RevenueBySourceDatum {
    subject: string;
    /** Amount in currency units */
    A: number;
}

interface RevenueRadarChartProps {
    /** Real revenue grouped by source (e.g. payment method). Empty → no-data state. */
    data?: RevenueBySourceDatum[];
}

export function RevenueRadarChart({ data = [] }: RevenueRadarChartProps) {
    const hasData = data.some(d => d.A > 0);
    const maxValue = Math.max(...data.map(d => d.A), 1);

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Ingresos por Método de Pago
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[280px] w-full">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                                <PolarGrid stroke={chartGrid.stroke} strokeDasharray={chartGrid.strokeDasharray} />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={{ fontSize: 11, fill: chartAxis.tick.fill }}
                                />
                                <PolarRadiusAxis angle={30} domain={[0, maxValue]} hide />
                                <Radar
                                    name="Ingresos"
                                    dataKey="A"
                                    stroke={chartColors.primary}
                                    strokeWidth={2}
                                    fill={chartColors.primary}
                                    fillOpacity={0.3}
                                />
                                <Tooltip
                                    contentStyle={chartTooltip.contentStyle}
                                    formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                            <p className="text-sm">Sin ingresos registrados en el período</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
