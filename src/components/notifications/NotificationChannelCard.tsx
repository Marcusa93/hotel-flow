import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Mail, MessageSquare, Check, AlertCircle } from 'lucide-react';

interface NotificationChannelCardProps {
    type: 'EMAIL' | 'WHATSAPP';
    isEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    stats: {
        sent: number;
        failed: number;
    };
}

export function NotificationChannelCard({ type, isEnabled, onToggle, stats }: NotificationChannelCardProps) {
    const isEmail = type === 'EMAIL';

    return (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-300 border-2",
            isEnabled
                ? (isEmail ? "border-blue-400/50 bg-blue-50/50 dark:bg-blue-900/10" : "border-emerald-400/50 bg-emerald-50/50 dark:bg-emerald-900/10")
                : "border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40"
        )}>
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        isEmail ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"
                    )}>
                        {isEmail ? <Mail className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                    </div>
                    <Switch checked={isEnabled} onCheckedChange={onToggle} />
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        {isEmail ? 'Email Automático' : 'WhatsApp Business'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10">
                        {isEmail
                            ? 'Envío de confirmaciones y facturas por correo electrónico.'
                            : 'Mensajería instantánea para check-in y concierge digital.'
                        }
                    </p>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 text-xs">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{stats.sent} Enviados</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{stats.failed} Fallidos</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
