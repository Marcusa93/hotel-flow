import { Card, CardContent } from '@/components/ui/card';
import { Receipt, AlertCircle, CheckCircle2 } from 'lucide-react';

export function BillingStats() {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border-indigo-500/20 backdrop-blur-md">
                <CardContent className="p-6 flex flex-col justify-center">
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Facturado (Mes)
                    </p>
                    <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-2">$1.2M</p>
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-slate-200 dark:border-slate-800">
                <CardContent className="p-6 flex flex-col justify-center">
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Emitidas
                    </p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-2">142</p>
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-slate-200 dark:border-slate-800">
                <CardContent className="p-6 flex flex-col justify-center">
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        IVA Recaudado
                    </p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-2">$252k</p>
                    <p className="text-xs text-muted-foreground">21% sobre base</p>
                </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-slate-200 dark:border-slate-800">
                <CardContent className="p-6 flex flex-col justify-center">
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Notas de Crédito
                    </p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-2">$12k</p>
                </CardContent>
            </Card>
        </div>
    );
}
