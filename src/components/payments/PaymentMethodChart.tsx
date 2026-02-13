import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Payment } from '@/types/hotel';
import { useMemo } from 'react';
import { paymentMethodColors, chartTooltip } from '@/lib/chartTheme';

interface PaymentMethodChartProps {
    payments: Payment[];
}

const METHOD_LABELS = {
    CARD: 'Tarjeta',
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    OTHER: 'Otro'
};

export function PaymentMethodChart({ payments }: PaymentMethodChartProps) {
    const data = useMemo(() => {
        const counts = payments.reduce((acc, p) => {
            const method = p.method as keyof typeof paymentMethodColors;
            acc[method] = (acc[method] || 0) + p.amount;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(counts)
            .map(([method, value]) => ({
                name: METHOD_LABELS[method as keyof typeof METHOD_LABELS],
                value,
                color: paymentMethodColors[method as keyof typeof paymentMethodColors] || paymentMethodColors.OTHER
            }))
            .filter(item => item.value > 0);
    }, [payments]);

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Métodos de Pago
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={chartTooltip.contentStyle}
                                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
