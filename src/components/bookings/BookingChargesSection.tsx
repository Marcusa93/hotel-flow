import { useState } from 'react';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { useBookingCharges } from '@/hooks/useBookingCharges';
import { useDeleteBookingCharge } from '@/hooks/useDeleteBookingCharge';
import { CHARGE_CATEGORIES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { NewBookingChargeDialog } from './NewBookingChargeDialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BookingChargesSectionProps {
    bookingId: string;
}

export function BookingChargesSection({ bookingId }: BookingChargesSectionProps) {
    const { data: charges = [], isLoading } = useBookingCharges(bookingId);
    const deleteCharge = useDeleteBookingCharge();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const totalCharges = charges.reduce((sum, c) => sum + c.amount * c.quantity, 0);

    const getCategoryInfo = (category: string) => {
        return CHARGE_CATEGORIES.find(c => c.value === category) || { label: category, icon: '📋' };
    };

    const handleDelete = async (chargeId: string) => {
        try {
            await deleteCharge.mutateAsync({ chargeId, bookingId });
            toast({
                title: 'Cargo eliminado',
                description: 'El cargo fue eliminado correctamente.',
            });
        } catch (error) {
            toast({
                title: 'Error al eliminar',
                description: error instanceof Error ? error.message : 'No se pudo eliminar el cargo.',
                variant: 'destructive',
            });
        }
    };

    return (
        <>
            <Card className="glass border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-orange-500" />
                            Consumos / Extras
                        </CardTitle>
                        <CardDescription>Cargos adicionales de la estadía</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
                    ) : charges.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-xl">
                            <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-muted-foreground text-sm">Sin consumos registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {charges.map(charge => {
                                const catInfo = getCategoryInfo(charge.category);
                                const lineTotal = charge.amount * charge.quantity;
                                return (
                                    <div
                                        key={charge.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-background/40 hover:bg-background/60 transition-colors border border-transparent hover:border-border/50"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <span className="text-lg flex-shrink-0">{catInfo.icon}</span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                                        {catInfo.label}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm font-medium truncate mt-0.5">{charge.description}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(charge.createdAt), "d MMM, HH:mm", { locale: es })}
                                                    {charge.quantity > 1 && (
                                                        <span className="ml-2">
                                                            ${charge.amount.toLocaleString('es-AR')} × {charge.quantity}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                            <span className="font-bold text-sm">
                                                ${lineTotal.toLocaleString('es-AR')}
                                            </span>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Eliminar cargo?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Se eliminará "{charge.description}" (${lineTotal.toLocaleString('es-AR')}). Esta acción no se puede deshacer.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(charge.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                );
                            })}

                            <Separator />

                            <div className="flex justify-between items-center px-3 py-2">
                                <span className="text-sm font-medium text-muted-foreground">Total consumos</span>
                                <span className="text-lg font-bold">${totalCharges.toLocaleString('es-AR')}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <NewBookingChargeDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                bookingId={bookingId}
            />
        </>
    );
}
