import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, MessageSquare, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { NotificationLog } from '@/types/hotel';

interface NotificationTimelineProps {
    logs: NotificationLog[];
}

export function NotificationTimeline({ logs }: NotificationTimelineProps) {
    return (
        <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6 pl-2">
                {logs.map((log, index) => (
                    <div key={log.id} className="relative flex gap-4">
                        {/* Timeline Line */}
                        {index !== logs.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-[-24px] w-px bg-slate-200 dark:bg-slate-800" />
                        )}

                        {/* Icon */}
                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
                            {log.type === 'email' ? (
                                <Mail className="h-5 w-5 text-blue-500" />
                            ) : (
                                <MessageSquare className="h-5 w-5 text-emerald-500" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-1 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                    {log.type === 'email' ? 'Email Enviado' : 'WhatsApp Enviado'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {format(new Date(log.createdAt), 'dd MMM HH:mm', { locale: es })}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Para: <span className="font-medium">{log.recipient}</span>
                            </p>
                            <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-xs text-muted-foreground italic">
                                "{log.subject}"
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                                {log.status === 'sent' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" /> Entregado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">
                                        <XCircle className="w-3 h-3" /> Fallido
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
