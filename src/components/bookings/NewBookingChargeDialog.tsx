import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Receipt, DollarSign, Hash, FileText } from 'lucide-react';
import { useCreateBookingCharge } from '@/hooks/useCreateBookingCharge';
import { CHARGE_CATEGORIES } from '@/lib/constants';
import type { ChargeCategory } from '@/types/hotel';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { MinibarQuickAdd } from './MinibarQuickAdd';

const chargeSchema = z.object({
    category: z.string().min(1, 'Selecciona una categoría'),
    description: z.string().min(2, 'Descripción requerida'),
    amount: z.coerce.number().positive('Monto debe ser mayor a 0'),
    quantity: z.coerce.number().int().min(1, 'Cantidad mínima: 1'),
});

type ChargeFormData = z.infer<typeof chargeSchema>;

interface NewBookingChargeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookingId: string;
}

export function NewBookingChargeDialog({ open, onOpenChange, bookingId }: NewBookingChargeDialogProps) {
    const createCharge = useCreateBookingCharge();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ChargeFormData>({
        resolver: zodResolver(chargeSchema),
        defaultValues: {
            category: '',
            description: '',
            amount: 0,
            quantity: 1,
        },
    });

    const watchAmount = form.watch('amount');
    const watchQuantity = form.watch('quantity');
    const subtotal = (watchAmount || 0) * (watchQuantity || 1);

    const onSubmit = async (data: ChargeFormData) => {
        setIsSubmitting(true);
        try {
            await createCharge.mutateAsync({
                bookingId,
                category: data.category as ChargeCategory,
                description: data.description,
                amount: data.amount,
                quantity: data.quantity,
            });

            toast({
                title: 'Cargo registrado',
                description: `${data.description} — $${subtotal.toLocaleString('es-AR')}`,
            });

            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating charge:', error);
            toast({
                title: 'Error al registrar cargo',
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
                        <Receipt className="w-5 h-5" />
                        Nuevo Cargo
                    </DialogTitle>
                    <DialogDescription>
                        Agregar consumos del minibar o un cargo manual
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="minibar" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-3">
                        <TabsTrigger value="minibar">🍫 Minibar</TabsTrigger>
                        <TabsTrigger value="manual">📋 Manual</TabsTrigger>
                    </TabsList>

                    {/* Minibar quick-add tab */}
                    <TabsContent value="minibar" className="max-h-[55vh] overflow-y-auto">
                        <MinibarQuickAdd
                            bookingId={bookingId}
                            onDone={() => onOpenChange(false)}
                        />
                    </TabsContent>

                    {/* Manual charge tab */}
                    <TabsContent value="manual">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                {/* Category */}
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Categoría *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar categoría" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {CHARGE_CATEGORIES.map(cat => (
                                                        <SelectItem key={cat.value} value={cat.value}>
                                                            {cat.icon} {cat.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Description */}
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descripción *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input placeholder="Ej: 2 botellas de agua" className="pl-10" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Amount + Quantity */}
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Monto ($) *</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            placeholder="0.00"
                                                            className="pl-10"
                                                            {...field}
                                                        />
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
                                                <FormLabel>Cantidad</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Subtotal */}
                                {subtotal > 0 && (
                                    <div className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-primary/10">
                                        <span className="text-sm text-muted-foreground">Subtotal</span>
                                        <span className="text-lg font-bold text-primary">${subtotal.toLocaleString('es-AR')}</span>
                                    </div>
                                )}

                                <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4">
                                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                        {isSubmitting ? 'Guardando...' : 'Agregar Cargo'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
