import { useState } from 'react';
import {
    Sheet,
    SheetContent,
} from '@/components/ui/sheet';
import { Guest } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Phone, X, Edit, Save, MessageCircle, FileSpreadsheet, Download, Calendar, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUpdateGuest } from '@/hooks/useUpdateGuest';
import { useDeleteGuest } from '@/hooks/useDeleteGuest';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GuestDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    guest?: Guest;
    onDeleted?: () => void;
}

export function GuestDetailsDrawer({ isOpen, onClose, guest, onDeleted }: GuestDetailsDrawerProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Guest>>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const updateGuestMutation = useUpdateGuest();
    const deleteGuestMutation = useDeleteGuest();

    if (!guest) return null;

    const initials = guest.fullName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleStartEdit = () => {
        setEditData({
            fullName: guest.fullName,
            email: guest.email,
            phone: guest.phone,
            documentId: guest.documentId,
            country: guest.country,
            notes: guest.notes,
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        try {
            await updateGuestMutation.mutateAsync({
                id: guest.id,
                data: editData,
            });
            toast({
                title: '✅ Huésped actualizado',
                description: 'Los datos se guardaron correctamente',
            });
            setIsEditing(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo actualizar el huésped',
                variant: 'destructive',
            });
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditData({});
    };

    const handleDeleteGuest = async () => {
        try {
            await deleteGuestMutation.mutateAsync(guest.id);
            toast({
                title: '🗑️ Huésped eliminado',
                description: `${guest.fullName} fue eliminado del sistema`,
            });
            setShowDeleteConfirm(false);
            onClose();
            onDeleted?.();
        } catch (error) {
            toast({
                title: 'Error al eliminar',
                description: 'No se pudo eliminar el huésped. Puede tener reservas asociadas.',
                variant: 'destructive',
            });
        }
    };

    const handleWhatsApp = () => {
        const message = encodeURIComponent(
            `Hola! ${guest.fullName} somos del Hotel Metropolitano. Nos comunicamos contigo por lo siguiente:`
        );
        const phone = guest.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

    const handleEmail = () => {
        const subject = encodeURIComponent('Hotel Metropolitano - Información');
        const body = encodeURIComponent(
            `Estimado/a ${guest.fullName},\n\nNos comunicamos desde Hotel Metropolitano.\n\n`
        );
        window.open(`mailto:${guest.email}?subject=${subject}&body=${body}`, '_blank');
    };

    const handleExportExcel = () => {
        // Create CSV content
        const headers = ['Nombre', 'Email', 'Teléfono', 'Documento', 'País', 'Notas', 'Fecha Registro'];
        const data = [
            guest.fullName,
            guest.email,
            guest.phone,
            guest.documentId || '',
            guest.country || '',
            (guest.notes || '').replace(/"/g, '""'),
            format(new Date(guest.createdAt), 'dd/MM/yyyy'),
        ];

        const csvContent = [
            headers.join(','),
            data.map(d => `"${d}"`).join(','),
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `huesped_${guest.fullName.replace(/\s+/g, '_')}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        toast({
            title: '📊 Exportado',
            description: 'Archivo CSV descargado',
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-xl p-0 bg-white/95 backdrop-blur-xl border-l border-white/20 shadow-2xl">
                {/* Header */}
                <div className="relative h-48 bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-8 flex flex-col justify-end overflow-hidden">
                    {/* Abstract BG */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-32 pointer-events-none"></div>

                    <div className="relative z-10 flex items-end gap-6">
                        {/* Initials Circle */}
                        <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 shadow-xl">
                            <span className="text-3xl font-bold text-white">{initials}</span>
                        </div>
                        <div className="mb-2 flex-1">
                            {isEditing ? (
                                <Input
                                    value={editData.fullName || ''}
                                    onChange={e => setEditData({ ...editData, fullName: e.target.value })}
                                    className="text-2xl font-bold bg-white/20 border-white/30 text-white placeholder:text-white/50"
                                />
                            ) : (
                                <h2 className="text-3xl font-bold tracking-tight">{guest.fullName}</h2>
                            )}
                            <p className="text-white/70 font-mono text-sm mt-1">{guest.email}</p>
                        </div>
                    </div>

                    {/* Close Button */}
                    <div className="absolute top-4 right-4">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-white/10 hover:bg-white/20 text-white">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Edit Toggle */}
                    <div className="absolute top-4 left-4">
                        {!isEditing ? (
                            <Button variant="ghost" size="sm" onClick={handleStartEdit} className="rounded-full bg-white/10 hover:bg-white/20 text-white">
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveEdit} className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white" disabled={updateGuestMutation.isPending}>
                                    <Save className="w-4 h-4 mr-2" />
                                    Guardar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="rounded-full bg-white/10 hover:bg-white/20 text-white">
                                    Cancelar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <ScrollArea className="h-[calc(100vh-192px)] p-8">
                    <div className="grid gap-8">
                        {/* Personal Info */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Información Personal</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Documento</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editData.documentId || ''}
                                            onChange={e => setEditData({ ...editData, documentId: e.target.value })}
                                            placeholder="DNI/Pasaporte"
                                        />
                                    ) : (
                                        <p className="font-medium">{guest.documentId || 'No registrado'}</p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Teléfono</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editData.phone || ''}
                                            onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                            placeholder="+54 11 1234 5678"
                                        />
                                    ) : (
                                        <p className="font-medium">{guest.phone}</p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editData.email || ''}
                                            onChange={e => setEditData({ ...editData, email: e.target.value })}
                                            placeholder="email@ejemplo.com"
                                        />
                                    ) : (
                                        <p className="font-medium truncate">{guest.email}</p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Nacionalidad</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editData.country || ''}
                                            onChange={e => setEditData({ ...editData, country: e.target.value })}
                                            placeholder="Argentina"
                                        />
                                    ) : (
                                        <p className="font-medium">{guest.country || 'No registrada'}</p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50 col-span-2">
                                    <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Cliente Desde
                                    </Label>
                                    <p className="font-medium">{format(new Date(guest.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* Notes Section */}
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas y Referencias</h3>
                            </div>
                            {isEditing ? (
                                <Textarea
                                    value={editData.notes || ''}
                                    onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                    placeholder="Añadir notas, preferencias, referencias..."
                                    className="min-h-[120px]"
                                />
                            ) : (
                                <div className={cn(
                                    "p-4 rounded-xl border text-sm leading-relaxed",
                                    guest.notes
                                        ? "border-amber-200 bg-amber-50 text-amber-900"
                                        : "border-slate-200 bg-slate-50 text-slate-500 italic"
                                )}>
                                    {guest.notes || "Sin notas adicionales para este huésped. Haz clic en 'Editar' para añadir."}
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* Contact Actions */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Comunicación</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={handleWhatsApp}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white"
                                >
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    WhatsApp
                                </Button>
                                <Button
                                    onClick={handleEmail}
                                    variant="outline"
                                    className="w-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                >
                                    <Mail className="w-4 h-4 mr-2" />
                                    Enviar Email
                                </Button>
                            </div>
                        </section>

                        <Separator />

                        {/* Export Actions */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Exportar</h3>
                            <div className="flex gap-3">
                                <Button
                                    onClick={handleExportExcel}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    Exportar CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        // Print-friendly version
                                        const printWindow = window.open('', '', 'width=600,height=800');
                                        if (!printWindow) return;
                                        printWindow.document.write(`
                                            <!DOCTYPE html>
                                            <html>
                                            <head>
                                                <title>Ficha de Huésped - ${guest.fullName}</title>
                                                <style>
                                                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
                                                    .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
                                                    .logo { font-size: 24px; font-weight: 700; color: #4f46e5; }
                                                    .logo-sub { font-size: 12px; color: #64748b; }
                                                    .title { font-size: 28px; font-weight: 700; margin: 0; }
                                                    .subtitle { color: #64748b; margin: 4px 0 0; }
                                                    .section { margin: 24px 0; }
                                                    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 12px; }
                                                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                                                    .field { background: #f8fafc; padding: 12px; border-radius: 8px; }
                                                    .field-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
                                                    .field-value { font-weight: 500; }
                                                    .notes { background: #fef3c7; padding: 16px; border-radius: 8px; color: #92400e; }
                                                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
                                                </style>
                                            </head>
                                            <body>
                                                <div class="header">
                                                    <div>
                                                        <div class="logo">Hotel Metropolitano</div>
                                                        <div class="logo-sub">Ficha de Huésped</div>
                                                    </div>
                                                </div>
                                                <h1 class="title">${guest.fullName}</h1>
                                                <p class="subtitle">${guest.email}</p>
                                                
                                                <div class="section">
                                                    <div class="section-title">Información Personal</div>
                                                    <div class="grid">
                                                        <div class="field">
                                                            <div class="field-label">Documento</div>
                                                            <div class="field-value">${guest.documentId || 'No registrado'}</div>
                                                        </div>
                                                        <div class="field">
                                                            <div class="field-label">Teléfono</div>
                                                            <div class="field-value">${guest.phone}</div>
                                                        </div>
                                                        <div class="field">
                                                            <div class="field-label">Nacionalidad</div>
                                                            <div class="field-value">${guest.country || 'No registrada'}</div>
                                                        </div>
                                                        <div class="field">
                                                            <div class="field-label">Cliente Desde</div>
                                                            <div class="field-value">${format(new Date(guest.createdAt), 'dd/MM/yyyy')}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                ${guest.notes ? `
                                                <div class="section">
                                                    <div class="section-title">Notas y Referencias</div>
                                                    <div class="notes">${guest.notes}</div>
                                                </div>
                                                ` : ''}
                                                
                                                <div class="footer">
                                                    Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })} - Hotel Metropolitano
                                                </div>
                                            </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                        printWindow.focus();
                                        setTimeout(() => printWindow.print(), 250);
                                    }}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Imprimir Ficha
                                </Button>
                            </div>
                        </section>

                        <Separator />

                        {/* Danger Zone */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-4">Zona de Peligro</h3>
                            {!showDeleteConfirm ? (
                                <Button
                                    variant="outline"
                                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar Huésped
                                </Button>
                            ) : (
                                <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-red-700 text-sm">¿Eliminar a {guest.fullName}?</p>
                                            <p className="text-xs text-red-600 mt-1">
                                                Esta acción no se puede deshacer. Si el huésped tiene reservas asociadas, la eliminación podría fallar.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={handleDeleteGuest}
                                            disabled={deleteGuestMutation.isPending}
                                        >
                                            {deleteGuestMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 mr-2" />
                                            )}
                                            {deleteGuestMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => setShowDeleteConfirm(false)}
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
