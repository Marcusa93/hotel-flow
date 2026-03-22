import { Plus, FileSpreadsheet, Download } from 'lucide-react';
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
import { escapeHtml } from '@/lib/utils';

interface GuestsHeaderProps {
    guestCount: number;
    guests: Guest[];
    hotelName: string;
    onNewGuest: () => void;
}

export function GuestsHeader({ guestCount, guests, hotelName, onNewGuest }: GuestsHeaderProps) {
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
            toast({ title: 'Error', description: 'No se pudo abrir la ventana de impresión. Verifique el bloqueador de popups.', variant: 'destructive' });
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
                    <div>
                        <div class="logo">${h(hotelName)}</div>
                        <div class="logo-sub">Listado de Huéspedes</div>
                    </div>
                    <div class="date">
                        <div>Generado: ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}</div>
                        <div class="count">${guests.length} huéspedes registrados</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Documento</th>
                            <th>País</th>
                            <th>Registro</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guests.map(g => `
                            <tr>
                                <td class="name">${h(g.fullName)}</td>
                                <td>${h(g.email) || '-'}</td>
                                <td>${h(g.phone)}</td>
                                <td>${g.documentId ? `${h(g.documentType)} ${h(g.documentId)}` : '-'}</td>
                                <td>${h(g.country) || '-'}</td>
                                <td>${format(new Date(g.createdAt), 'dd/MM/yyyy')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    ${h(hotelName)} - Sistema de Gestión Hotelera
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    Huéspedes
                </h1>
                <p className="text-muted-foreground mt-1 text-sm font-medium">
                    Base de datos de fidelización ({guestCount} registrados)
                </p>
            </div>
            <div className="flex gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="rounded-full px-4">
                            <Download className="w-4 h-4 mr-2" />
                            Exportar
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Exportar a Excel (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handlePrintList}>
                            <Download className="w-4 h-4 mr-2" />
                            Imprimir Listado
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    onClick={onNewGuest}
                    className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                    size="lg"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nuevo Huésped
                </Button>
            </div>
        </div>
    );
}
