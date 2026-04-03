import { Plus, Download, FileSpreadsheet, Users, BedDouble, Repeat, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Guest } from '@/types/hotel';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { escapeHtml, cn } from '@/lib/utils';

interface GuestsHeaderProps {
    guestCount: number;
    guests: Guest[];
    hotelName: string;
    onNewGuest: () => void;
    hostedCount?: number;
    frequentCount?: number;
    totalSpend?: number;
}

export function GuestsHeader({ guestCount, guests, hotelName, onNewGuest, hostedCount = 0, frequentCount = 0, totalSpend = 0 }: GuestsHeaderProps) {
    const hotelSlug = hotelName.toLowerCase().replace(/\s+/g, '_');

    const handleExportCSV = () => {
        const headers = ['Nombre', 'Email', 'Teléfono', 'Tipo Doc', 'Documento', 'País', 'Notas', 'Fecha Registro'];
        const rows = guests.map(guest => [
            guest.fullName,
            guest.email || '',
            guest.phone,
            guest.documentType || '',
            guest.documentId || '',
            guest.country || '',
            (guest.notes || '').replace(/"/g, '""').replace(/\n/g, ' '),
            format(new Date(guest.createdAt), 'dd/MM/yyyy'),
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `huespedes_${hotelSlug}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        toast({
            title: 'Exportado',
            description: `${guests.length} huéspedes exportados a CSV`,
        });
    };

    const handlePrintList = () => {
        const printWindow = window.open('', '', 'width=900,height=700');
        if (!printWindow) {
            toast({ title: 'Error', description: 'No se pudo abrir la ventana de impresión.', variant: 'destructive' });
            return;
        }
        const h = escapeHtml;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Listado de Huéspedes - ${h(hotelName)}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; color: #1e293b; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #4f46e5; }
                    .logo { font-size: 28px; font-weight: 700; color: #4f46e5; }
                    .logo-sub { font-size: 14px; color: #64748b; margin-top: 4px; }
                    .date { text-align: right; font-size: 12px; color: #64748b; }
                    .count { font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                    tr:hover { background: #f8fafc; }
                    .name { font-weight: 600; color: #1e293b; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
                    @media print { body { padding: 15px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div><div class="logo">${h(hotelName)}</div><div class="logo-sub">Listado de Huéspedes</div></div>
                    <div class="date"><div>Generado: ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}</div><div class="count">${guests.length} huéspedes</div></div>
                </div>
                <table>
                    <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Documento</th><th>País</th><th>Registro</th></tr></thead>
                    <tbody>
                        ${guests.map(g => `<tr><td class="name">${h(g.fullName)}</td><td>${h(g.email) || '-'}</td><td>${h(g.phone)}</td><td>${g.documentId ? `${h(g.documentType)} ${h(g.documentId)}` : '-'}</td><td>${h(g.country) || '-'}</td><td>${format(new Date(g.createdAt), 'dd/MM/yyyy')}</td></tr>`).join('')}
                    </tbody>
                </table>
                <div class="footer">${h(hotelName)} - Sistema de Gestión Hotelera</div>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <div className="space-y-3 mb-2">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                        Huéspedes
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {guestCount} registrados en el sistema
                    </p>
                </div>
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-xl h-9 w-9 shrink-0">
                                <Download className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleExportCSV}>
                                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handlePrintList}>
                                <Download className="w-4 h-4 mr-2" /> Imprimir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={onNewGuest} className="rounded-xl px-5 shadow-lg shadow-primary/20 shrink-0">
                        <Plus className="w-4 h-4 mr-1.5" />
                        <span className="hidden sm:inline">Nuevo Huésped</span>
                        <span className="sm:hidden">Nuevo</span>
                    </Button>
                </div>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <StatPill icon={Users} value={guestCount} label="Total" color="slate" />
                <StatPill icon={BedDouble} value={hostedCount} label="Hospedados" color="emerald" />
                <StatPill icon={Repeat} value={frequentCount} label="Frecuentes" color="amber" />
                <StatPill icon={DollarSign} value={`$${totalSpend > 1000 ? `${(totalSpend / 1000).toFixed(0)}k` : totalSpend}`} label="Facturado" color="violet" />
            </div>
        </div>
    );
}

function StatPill({ icon: Icon, value, label, color }: {
    icon: typeof Users;
    value: string | number;
    label: string;
    color: 'slate' | 'emerald' | 'amber' | 'violet';
}) {
    const colors = {
        slate: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
        violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    };
    return (
        <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0',
            colors[color],
        )}>
            <Icon className="w-3.5 h-3.5" />
            <span className="font-extrabold text-sm">{value}</span>
            <span className="opacity-70 hidden sm:inline">{label}</span>
        </div>
    );
}
