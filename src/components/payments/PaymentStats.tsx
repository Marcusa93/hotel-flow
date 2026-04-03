import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, AlertCircle } from 'lucide-react';

interface PaymentStatsProps {
    totalPaid: number;
    totalPending: number;
    totalFailed?: number;
}

export function PaymentStats({ totalPaid, totalPending, totalFailed = 0 }: PaymentStatsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 backdrop-blur-md overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <DollarSign className="w-24 h-24 text-emerald-500" />
                </div>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Ingresos Totales</span>
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-100">
                        ${totalPaid.toLocaleString('es-AR')}
                    </p>
                    <p className="text-sm text-emerald-600/60 dark:text-emerald-400/60 mt-1">
                        Cobrado este mes
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 backdrop-blur-md overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Clock className="w-24 h-24 text-amber-500" />
                </div>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium mb-2">
                        <Clock className="w-4 h-4" />
                        <span>Pendiente de Cobro</span>
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight text-amber-900 dark:text-amber-100">
                        ${totalPending.toLocaleString('es-AR')}
                    </p>
                    <p className="text-sm text-amber-600/60 dark:text-amber-400/60 mt-1">
                        Por cobrar
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 backdrop-blur-md">
                <CardContent className="p-6 flex flex-col justify-center h-full">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Tasa de Éxito</p>
                            <p className="text-2xl font-bold mt-1">98.5%</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    {totalFailed > 0 && (
                        <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md w-fit">
                            <AlertCircle className="w-3 h-3" />
                            {totalFailed} pagos fallidos
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
