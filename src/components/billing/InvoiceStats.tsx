import { FileText, CircleDollarSign, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Invoice } from '@/types/hotel';

interface InvoiceStatsProps {
    invoices: Invoice[];
}

export function InvoiceStats({ invoices }: InvoiceStatsProps) {
    const totalInvoices = invoices.length;
    const issuedInvoices = invoices.filter(i => i.status === 'ISSUED' || i.status === 'PAID').length;
    const paidAmount = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);
    const pendingAmount = invoices.filter(i => i.status === 'ISSUED' || i.status === 'DRAFT').reduce((sum, i) => sum + i.total, 0);
    const overdueCount = invoices.filter(i => i.status === 'OVERDUE').length;

    const stats = [
        {
            label: 'Total Facturas',
            value: totalInvoices,
            sublabel: `${issuedInvoices} emitidas`,
            icon: FileText,
            color: 'indigo',
            gradient: 'from-indigo-500 to-violet-500',
        },
        {
            label: 'Facturado Total',
            value: `$${paidAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
            sublabel: 'Cobrado',
            icon: CircleDollarSign,
            color: 'emerald',
            gradient: 'from-emerald-500 to-teal-500',
        },
        {
            label: 'Por Cobrar',
            value: `$${pendingAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
            sublabel: 'Pendiente',
            icon: Clock,
            color: 'amber',
            gradient: 'from-amber-500 to-orange-500',
        },
        {
            label: 'Vencidas',
            value: overdueCount,
            sublabel: overdueCount > 0 ? 'Requieren atención' : 'Sin vencidas',
            icon: AlertCircle,
            color: 'rose',
            gradient: 'from-rose-500 to-pink-500',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
                <Card
                    key={stat.label}
                    className="group relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-white/20 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                >
                    {/* Gradient accent */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />

                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                                    {stat.label}
                                </p>
                                <p className="num-display text-2xl font-bold text-slate-900 dark:text-white">
                                    {stat.value}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stat.sublabel}
                                </p>
                            </div>
                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                                <stat.icon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
