import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Download, MoreHorizontal, Send, CheckCircle, XCircle } from 'lucide-react';
import { Invoice, Guest, Room } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface InvoiceGalleryProps {
    invoices: Invoice[];
    getInvoiceInfo: (invoice: Invoice) => { guest?: Guest; room?: Room };
    onViewInvoice?: (invoice: Invoice) => void;
    onDownloadPDF?: (invoice: Invoice) => void;
    onStatusChange?: (invoiceId: string, newStatus: Invoice['status']) => void;
}

const statusConfig: Record<Invoice['status'], { label: string; color: string }> = {
    DRAFT: { label: 'Borrador', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    ISSUED: { label: 'Emitida', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    PAID: { label: 'Pagada', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    CANCELLED: { label: 'Anulada', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    OVERDUE: { label: 'Vencida', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export function InvoiceGallery({ invoices, getInvoiceInfo, onViewInvoice, onDownloadPDF, onStatusChange }: InvoiceGalleryProps) {
    if (invoices.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    No hay facturas
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Crea tu primera factura seleccionando una reserva completada
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {invoices.map((invoice) => {
                const { guest, room } = getInvoiceInfo(invoice);
                const statusInfo = statusConfig[invoice.status];

                return (
                    <div
                        key={invoice.id}
                        className="group relative bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                    >
                        {/* Gradient Header Strip */}
                        <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500" />

                        <div className="p-5">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-white">
                                        {invoice.invoiceNumber}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(invoice.issueDate), "dd MMM yyyy", { locale: es })}
                                    </p>
                                </div>
                                <Badge className={cn('text-xs border', statusInfo.color)}>
                                    {statusInfo.label}
                                </Badge>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Cliente</span>
                                    <span className="font-medium truncate max-w-[140px]">{guest?.fullName || 'Sin asignar'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Habitación</span>
                                    <span className="font-medium">{room?.roomNumber || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Items</span>
                                    <span className="font-medium">{invoice.items?.length || 0}</span>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center py-3 border-t border-dashed border-slate-200 dark:border-slate-700 mb-4">
                                <span className="text-slate-800 dark:text-white font-semibold">Total</span>
                                <span className="text-xl font-bold text-indigo-600">
                                    ${invoice.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs"
                                    onClick={() => onViewInvoice?.(invoice)}
                                >
                                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                                    Ver
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="px-2">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onDownloadPDF?.(invoice)}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Descargar PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {invoice.status === 'DRAFT' && (
                                            <DropdownMenuItem onClick={() => onStatusChange?.(invoice.id, 'ISSUED')}>
                                                <Send className="w-4 h-4 mr-2 text-blue-600" />
                                                Emitir
                                            </DropdownMenuItem>
                                        )}
                                        {invoice.status === 'ISSUED' && (
                                            <DropdownMenuItem onClick={() => onStatusChange?.(invoice.id, 'PAID')}>
                                                <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                                                Marcar Pagada
                                            </DropdownMenuItem>
                                        )}
                                        {(invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && (
                                            <DropdownMenuItem onClick={() => onStatusChange?.(invoice.id, 'CANCELLED')}>
                                                <XCircle className="w-4 h-4 mr-2 text-rose-500" />
                                                Anular
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
