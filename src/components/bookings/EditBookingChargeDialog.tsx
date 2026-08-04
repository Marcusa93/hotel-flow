import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, DollarSign, Hash, FileText } from 'lucide-react';
import { useUpdateBookingCharge } from '@/hooks/useUpdateBookingCharge';
import { MANUAL_CHARGE_CATEGORIES } from '@/lib/constants';
import type { BookingCharge, ChargeCategory } from '@/types/hotel';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const chargeSchema = z.object({
    category: z.string().min(1, 'Selecciona una categoría'),
    description: z.string().min(2, 'Descripción requerida'),
    amount: z.coerce.number().positive('Monto debe ser mayor a 0'),
    quantity: z.coerce.number().int().min(1, 'Cantidad mínima: 1'),
});

type ChargeFormData = z.infer<typeof chargeSchema>;

interface EditBookingChargeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    charge: BookingCharge;
}

/**
 * Corregir un cargo mal cargado.
 *
 * Antes había que borrarlo y volver a cargarlo, que además de dos pasos pierde la
 * hora en que se consumió de verdad —la que después sirve para discutir con el
 * huésped qué se tomó y cuándo—.
 */
export function EditBookingChargeDialog({ open, onOpenChange, charge }: EditBookingChargeDialogProps) {
    const updateCharge = useUpdateBookingCharge();
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Las noches que agregó "Extender estadía" no cambian de rubro: son
     * alojamiento, el check-out las mira por la categoría para saber cuáles
     * devolver, y ALOJAMIENTO ni siquiera está entre las que se cargan a mano.
     * El monto y las noches sí se corrigen.
     */
    const isLodging = charge.category === 'ALOJAMIENTO';

    const form = useForm<ChargeFormData>({
        resolver: zodResolver(chargeSchema),
        defaultValues: {
            category: charge.category,
            description: charge.description,
            amount: charge.amount,
            quantity: charge.quantity,
        },
    });

    // Reabrir sobre otro cargo tiene que traer el otro cargo, no el anterior.
    useEffect(() => {
        if (open) {
            form.reset({
                category: charge.category,
                description: charge.description,
                amount: charge.amount,
                quantity: charge.quantity,
            });
        }
    }, [open, charge, form]);

    const watchAmount = Number(form.watch('amount')) || 0;
    const watchQuantity = Number(form.watch('quantity')) || 1;
    const subtotal = watchAmount * watchQuantity;
    const originalSubtotal = charge.amount * charge.quantity;

    const onSubmit = async (data: ChargeFormData) => {
        setIsSubmitting(true);
        try {
            await updateCharge.mutateAsync({
                chargeId: charge.id,
                // La categoría del alojamiento no viaja: dejarla editable sacaría
                // esas noches del radar del check-out anticipado.
                ...(isLodging ? {} : { category: data.category as ChargeCategory }),
                description: data.description,
                amount: data.amount,
                quantity: data.quantity,
            });

            toast({
                title: 'Cargo corregido',
                description: `${data.description} — $${subtotal.toLocaleString('es-AR')}`,
            });
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'Error al corregir el cargo',
                description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-5 h-5" />
                        Corregir cargo
                    </DialogTitle>
                    <DialogDescription>
                        Estaba cargado como ${originalSubtotal.toLocaleString('es-AR')}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría *</FormLabel>
                                    {isLodging ? (
                                        <>
                                            <FormControl>
                                                <Input readOnly tabIndex={-1} value="🛏 Alojamiento" className="bg-muted text-muted-foreground" />
                                            </FormControl>
                                            <FormDescription className="text-xs">
                                                Son noches agregadas con "Extender estadía". El rubro no
                                                se cambia; el precio por noche y la cantidad sí.
                                            </FormDescription>
                                        </>
                                    ) : (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar categoría" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {MANUAL_CHARGE_CATEGORIES.map(cat => (
                                                    <SelectItem key={cat.value} value={cat.value}>
                                                        {cat.icon} {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input className="pl-10" {...field} />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{isLodging ? 'Precio por noche ($) *' : 'Monto ($) *'}</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="number" step="0.01" min="0" className="pl-10" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{isLodging ? 'Noches' : 'Cantidad'}</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="number" min="1" step="1" className="pl-10" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-primary/10">
                            <span className="text-sm text-muted-foreground">Subtotal</span>
                            <span className="text-lg font-bold text-primary">
                                {subtotal !== originalSubtotal && (
                                    <span className="text-sm font-normal text-muted-foreground line-through mr-2">
                                        ${originalSubtotal.toLocaleString('es-AR')}
                                    </span>
                                )}
                                ${subtotal.toLocaleString('es-AR')}
                            </span>
                        </div>

                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
