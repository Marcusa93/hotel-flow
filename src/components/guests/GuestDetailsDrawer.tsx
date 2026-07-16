import { useState, useMemo } from 'react';
import {
    Sheet,
    SheetContent,
} from '@/components/ui/sheet';
import { Guest, DocumentType } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Mail, X, Edit, Save, FileSpreadsheet, Download, Calendar, Trash2, AlertTriangle, Loader2, Hotel, CreditCard, Globe, Car } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUpdateGuest } from '@/hooks/useUpdateGuest';
import { useDeleteGuest, GuestHasBookingsError } from '@/hooks/useDeleteGuest';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { COUNTRIES, DOCUMENT_TYPES } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, escapeHtml, formatLastNameFirst, getInitials } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    CHECKED_IN: 'Check-in',
    CHECKED_OUT: 'Check-out',
    CANCELLED: 'Cancelada',
    NO_SHOW: 'No Show',
};

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    CHECKED_IN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    CHECKED_OUT: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    NO_SHOW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

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
    const { bookings } = useBookingOperations();
    const { payments } = usePaymentOperations();
    const { rooms } = useRoomOperations();
    const { data: hotelSettings } = useHotelSettings();
    const hotelName = hotelSettings?.hotelName || 'Hotel';

    // Guest bookings & payments — hooks must be before any early return
    const guestBookings = useMemo(() =>
        guest
            ? bookings
                .filter(b => b.guestId === guest.id)
                .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
            : [],
        [bookings, guest?.id]
    );

    const guestPayments = useMemo(() => {
        const bookingIds = new Set(guestBookings.map(b => b.id));
        return payments.filter(p => bookingIds.has(p.bookingId));
    }, [payments, guestBookings]);

    const totalPaid = guestPayments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalBilled = guestBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const pendingBalance = Math.max(0, totalBilled - totalPaid);

    if (!guest) return null;

    const initials = getInitials(guest.fullName);
    const displayName = formatLastNameFirst(guest.fullName);

    const handleStartEdit = () => {
        setEditData({
            fullName: guest.fullName,
            email: guest.email,
            phone: guest.phone,
            documentType: guest.documentType,
            documentId: guest.documentId,
            country: guest.country,
            notes: guest.notes,
            hasVehicle: guest.hasVehicle,
            vehicleDescription: guest.vehicleDescription,
            licensePlate: guest.licensePlate,
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        // Basic validation before persisting
        const fullName = (editData.fullName || '').trim();
        if (!fullName) {
            toast({ title: 'Datos inválidos', description: 'El nombre no puede estar vacío.', variant: 'destructive' });
            return;
        }
        const email = (editData.email || '').trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast({ title: 'Datos inválidos', description: 'El email no tiene un formato válido.', variant: 'destructive' });
            return;
        }
        const phone = (editData.phone || '').trim();
        if (phone && phone.length < 6) {
            toast({ title: 'Datos inválidos', description: 'El teléfono debe tener al menos 6 caracteres.', variant: 'destructive' });
            return;
        }
        try {
            await updateGuestMutation.mutateAsync({
                id: guest.id,
                data: editData,
            });
            toast({ title: 'Huésped actualizado', description: 'Los datos se guardaron correctamente' });
            setIsEditing(false);
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo actualizar el huésped', variant: 'destructive' });
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditData({});
    };

    const handleDeleteGuest = async () => {
        try {
            await deleteGuestMutation.mutateAsync(guest.id);
            toast({ title: 'Huésped eliminado', description: `${guest.fullName} fue eliminado del sistema` });
            setShowDeleteConfirm(false);
            onClose();
            onDeleted?.();
        } catch (error) {
            const message = error instanceof GuestHasBookingsError
                ? error.message
                : 'No se pudo eliminar el huésped. Intente nuevamente.';
            toast({ title: 'Error al eliminar', description: message, variant: 'destructive' });
        }
    };

    const handleExportExcel = () => {
        const headers = ['Nombre', 'Email', 'Teléfono', 'Tipo Doc', 'Documento', 'País', 'Vehículo', 'Patente', 'Notas', 'Fecha Registro'];
        const data = [
            guest.fullName,
            guest.email || '',
            guest.phone,
            guest.documentType || '',
            guest.documentId || '',
            guest.country || '',
            guest.vehicleDescription || '',
            guest.licensePlate || '',
            guest.notes || '',
            format(new Date(guest.createdAt), 'dd/MM/yyyy'),
        ];

        const csvContent = [
            headers.join(','),
            data.map(d => `"${String(d).replace(/"/g, '""')}"`).join(','),
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `huesped_${guest.fullName.replace(/\s+/g, '_')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Exportado', description: 'Archivo CSV descargado' });
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=600,height=800');
        if (!printWindow) {
            toast({ title: 'Error', description: 'No se pudo abrir la ventana de impresión. Verifique el bloqueador de popups.', variant: 'destructive' });
            return;
        }
        const h = escapeHtml;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ficha de Huésped - ${h(guest.fullName)}</title>
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
                        <div class="logo">${h(hotelName)}</div>
                        <div class="logo-sub">Ficha de Huésped</div>
                    </div>
                </div>
                <h1 class="title">${h(guest.fullName)}</h1>
                <p class="subtitle">${h(guest.email)}</p>
                <div class="section">
                    <div class="section-title">Información Personal</div>
                    <div class="grid">
                        <div class="field">
                            <div class="field-label">Documento</div>
                            <div class="field-value">${guest.documentId ? `${h(guest.documentType)} ${h(guest.documentId)}` : 'No registrado'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Teléfono</div>
                            <div class="field-value">${h(guest.phone)}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Nacionalidad</div>
                            <div class="field-value">${h(guest.country) || 'No registrada'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Cliente Desde</div>
                            <div class="field-value">${format(new Date(guest.createdAt), 'dd/MM/yyyy')}</div>
                        </div>
                    </div>
                </div>
                ${guest.hasVehicle ? `
                <div class="section">
                    <div class="section-title">Vehículo</div>
                    <div class="grid">
                        <div class="field">
                            <div class="field-label">Descripción</div>
                            <div class="field-value">${h(guest.vehicleDescription) || 'Sin descripción'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Patente</div>
                            <div class="field-value">${h(guest.licensePlate) || 'Sin patente'}</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                ${guest.notes ? `
                <div class="section">
                    <div class="section-title">Notas y Referencias</div>
                    <div class="notes">${h(guest.notes)}</div>
                </div>
                ` : ''}
                <div class="footer">
                    Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })} - ${h(hotelName)}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    const docLabel = guest.documentType
        ? DOCUMENT_TYPES.find(dt => dt.value === guest.documentType)?.label || guest.documentType
        : '';

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-xl p-0 bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl">
                {/* Header */}
                <div className="relative h-48 bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-8 flex flex-col justify-end overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-32 pointer-events-none"></div>

                    <div className="relative z-10 flex items-end gap-6">
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
                                <h2 className="text-3xl font-bold tracking-tight">{displayName}</h2>
                            )}
                            <p className="text-white/70 font-mono text-sm mt-1">{guest.email || 'Sin email'}</p>
                        </div>
                    </div>

                    <div className="absolute top-4 right-4">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-white/10 hover:bg-white/20 text-white">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-muted/30">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Documento</Label>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <Select
                                                value={editData.documentType || 'DNI'}
                                                onValueChange={v => setEditData({ ...editData, documentType: v as DocumentType })}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DOCUMENT_TYPES.map(dt => (
                                                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                value={editData.documentId || ''}
                                                onChange={e => setEditData({ ...editData, documentId: e.target.value })}
                                                placeholder="Número"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    ) : (
                                        <p className="font-medium">
                                            {guest.documentId ? `${docLabel} ${guest.documentId}` : 'No registrado'}
                                        </p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-muted/30">
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
                                <div className="p-4 rounded-xl border bg-muted/30">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                                    {isEditing ? (
                                        <Input
                                            value={editData.email || ''}
                                            onChange={e => setEditData({ ...editData, email: e.target.value })}
                                            placeholder="email@ejemplo.com"
                                        />
                                    ) : (
                                        <p className="font-medium truncate">{guest.email || 'No registrado'}</p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-muted/30">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Nacionalidad</Label>
                                    {isEditing ? (
                                        <Select
                                            value={editData.country || ''}
                                            onValueChange={v => setEditData({ ...editData, country: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COUNTRIES.map(c => (
                                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <p className="font-medium">{guest.country || 'No registrada'}</p>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl border bg-muted/30 col-span-2">
                                    <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Cliente Desde
                                    </Label>
                                    <p className="font-medium">{format(new Date(guest.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* Vehicle Section */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                <Car className="w-3.5 h-3.5" /> Vehículo
                            </h3>
                            {isEditing ? (
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            checked={editData.hasVehicle ?? false}
                                            onCheckedChange={(checked) => setEditData({ ...editData, hasVehicle: !!checked })}
                                        />
                                        <Label className="cursor-pointer text-sm">Tiene vehículo</Label>
                                    </div>
                                    {editData.hasVehicle && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/30">
                                            <div>
                                                <Label className="text-xs text-muted-foreground mb-1 block">Descripción</Label>
                                                <Input
                                                    value={editData.vehicleDescription || ''}
                                                    onChange={e => setEditData({ ...editData, vehicleDescription: e.target.value })}
                                                    placeholder="Ej: Toyota Corolla Gris"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground mb-1 block">Patente</Label>
                                                <Input
                                                    value={editData.licensePlate || ''}
                                                    onChange={e => setEditData({ ...editData, licensePlate: e.target.value.toUpperCase() })}
                                                    placeholder="Ej: AB 123 CD"
                                                    className="h-8 text-sm font-mono uppercase"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : guest.hasVehicle ? (
                                <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Car className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-sm">{guest.vehicleDescription || 'Vehículo sin descripción'}</p>
                                        {guest.licensePlate && (
                                            <p className="text-xs font-mono bg-muted px-2 py-0.5 rounded inline-block tracking-wider">
                                                {guest.licensePlate}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50 border rounded-xl bg-muted/10">
                                    <Car className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-sm">Sin vehículo registrado</p>
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* Notes Section */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Notas y Referencias</h3>
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
                                        ? "border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200"
                                        : "border-border bg-muted/30 text-muted-foreground italic"
                                )}>
                                    {guest.notes || "Sin notas adicionales. Haz clic en 'Editar' para añadir."}
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* Booking History */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Historial de Reservas ({guestBookings.length})
                            </h3>
                            {guestBookings.length === 0 ? (
                                <div className="p-4 rounded-xl border bg-muted/30 text-center">
                                    <Hotel className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                                    <p className="text-sm text-muted-foreground">Sin reservas registradas</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {guestBookings.slice(0, 5).map(booking => {
                                        const room = rooms.find(r => r.id === booking.roomId);
                                        return (
                                            <div key={booking.id} className="p-3 rounded-xl border bg-muted/30 flex justify-between items-center gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        Hab. {room?.roomNumber || '?'} &middot; {format(new Date(booking.checkInDate), 'dd/MM')} al {format(new Date(booking.checkOutDate), 'dd/MM/yy')}
                                                    </p>
                                                    <Badge variant="outline" className={cn("text-[10px] mt-1 border-0", STATUS_COLORS[booking.status] || '')}>
                                                        {STATUS_LABELS[booking.status] || booking.status}
                                                    </Badge>
                                                </div>
                                                <p className="font-semibold text-sm whitespace-nowrap">
                                                    ${booking.totalAmount.toLocaleString('es-AR')}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {guestBookings.length > 5 && (
                                        <p className="text-xs text-muted-foreground text-center pt-1">
                                            +{guestBookings.length - 5} reservas más
                                        </p>
                                    )}
                                </div>
                            )}
                        </section>

                        <Separator />

                        {/* Payment Summary */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Resumen de Pagos</h3>
                            <div className="grid grid-cols-2 gap-3"> {/* 2 cols OK here — small cards */}
                                <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-900/20 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Total Pagado</p>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        ${totalPaid.toLocaleString('es-AR')}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-900/20 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Saldo Pendiente</p>
                                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                        ${pendingBalance.toLocaleString('es-AR')}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <Separator />

                            {/* Export Actions */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Exportar</h3>
                            <div className="flex gap-3">
                                <Button onClick={handleExportExcel} variant="outline" className="flex-1">
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    Exportar CSV
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Imprimir Ficha
                                </Button>
                            </div>
                        </section>

                        <Separator />

                        {/* Danger Zone */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-4">Zona de Peligro</h3>
                            {(() => {
                                const guestBookings = bookings.filter(b => b.guestId === guest.id);
                                const activeBookings = guestBookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW' && b.status !== 'CHECKED_OUT');
                                const hasActiveBookings = activeBookings.length > 0;

                                if (!showDeleteConfirm) {
                                    return (
                                        <Button
                                            variant="outline"
                                            className="w-full border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300"
                                            onClick={() => setShowDeleteConfirm(true)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar Huésped
                                        </Button>
                                    );
                                }

                                return (
                                    <div className="p-4 rounded-xl border-2 border-red-200 dark:border-red-800/30 bg-red-50 dark:bg-red-900/20 space-y-3">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-red-700 dark:text-red-400 text-sm">¿Eliminar a {guest.fullName}?</p>
                                                {hasActiveBookings ? (
                                                    <div className="mt-2 p-2 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700">
                                                        <p className="text-xs font-medium text-red-700 dark:text-red-300">
                                                            ⚠ Este huésped tiene {activeBookings.length} reserva{activeBookings.length > 1 ? 's' : ''} activa{activeBookings.length > 1 ? 's' : ''} ({activeBookings.map(b => b.status === 'CHECKED_IN' ? 'Hospedado' : STATUS_LABELS[b.status]).join(', ')}).
                                                        </p>
                                                        <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">
                                                            No se puede eliminar hasta que las reservas estén finalizadas o canceladas.
                                                        </p>
                                                    </div>
                                                ) : guestBookings.length > 0 ? (
                                                    <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">
                                                        Este huésped tiene {guestBookings.length} reserva{guestBookings.length > 1 ? 's' : ''} en el historial. Se eliminará el huésped pero las reservas quedarán registradas.
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">
                                                        Esta acción no se puede deshacer.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="flex-1"
                                                onClick={handleDeleteGuest}
                                                disabled={deleteGuestMutation.isPending || hasActiveBookings}
                                            >
                                                {deleteGuestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                                {deleteGuestMutation.isPending ? 'Eliminando...' : hasActiveBookings ? 'No disponible' : 'Sí, eliminar'}
                                            </Button>
                                            <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                                                Cancelar
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </section>
                    </div>
                </ScrollArea>

                {/* Sticky footer when editing */}
                {isEditing && (
                    <div className="sticky bottom-0 p-4 border-t bg-background/95 backdrop-blur-sm flex gap-3 z-10">
                        <Button onClick={handleSaveEdit} className="flex-1 bg-emerald-500 hover:bg-emerald-600" disabled={updateGuestMutation.isPending}>
                            {updateGuestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            {updateGuestMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                        <Button variant="outline" onClick={handleCancelEdit}>
                            Cancelar
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
