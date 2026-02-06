import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Booking, Guest, Room } from '@/types/hotel';

interface InvoiceGalleryProps {
    invoices: Array<{
        booking: Booking;
        guest?: Guest;
        room?: Room;
        total: number;
        date: Date;
        number: string;
    }>;
}

export function InvoiceGallery({ invoices }: InvoiceGalleryProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {invoices.map((inv) => (
                <div key={inv.number} className="group relative bg-white dark:bg-slate-900 rounded-[20px] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                    {/* Visual Header / Paper Effect - Official Navy/Gold Gradient */}
                    <div className="h-3 card-header-gradient" />

                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-lg text-slate-800 dark:text-white">Factura {inv.number}</h4>
                                <p className="text-xs text-muted-foreground">{format(inv.date, 'dd MMM yyyy')}</p>
                            </div>
                            <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                PDF
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Cliente</span>
                                <span className="font-medium truncate max-w-[120px]">{inv.guest?.fullName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Habitación</span>
                                <span className="font-medium">{inv.room?.roomNumber}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                                <span className="text-slate-800 dark:text-white font-bold">Total</span>
                                <span className="text-[hsl(43,80%,46%)] font-bold">${inv.total.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs border-[hsl(43,80%,46%)] text-[#003366] hover:bg-[rgba(212,160,23,0.08)] bg-white"
                            >
                                <Eye className="w-3 h-3 mr-1" /> Vista Previa
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-[#003366] hover:bg-[#005599] text-white text-xs shadow-md"
                            >
                                <Download className="w-3 h-3 mr-1" /> Descargar
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
