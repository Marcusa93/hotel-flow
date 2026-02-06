import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Payment } from '@/types/hotel';
import { useMemo } from 'react';
import { format, subDays, startOfDay, isSameDay, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface PaymentRevenueChartProps {
    payments: Payment[];
}

export function PaymentRevenueChart({ payments }: PaymentRevenueChartProps) {
    const data = useMemo(() => {
        const today = new Date();
        const last30Days = eachDayOfInterval({
            start: subDays(today, 29),
            end: today
        });

        return last30Days.map(day => {
            const dailyTotal = payments
                .filter(p => isSameDay(new Date(p.date), day) && p.status === 'PAID')
                .reduce((sum, p) => sum + p.amount, 0);

            return {
                date: day,
                dateStr: format(day, 'dd MMM', { locale: es }),
                amount: dailyTotal
            };
        });
    }, [payments]);

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm col-span-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Flujo de Ingresos (Últimos 30 días)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis
                                dataKey="dateStr"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                minTickGap={30}
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
                                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']}
                                labelFormatter={(label) => `Fecha: ${label}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="#10b981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
