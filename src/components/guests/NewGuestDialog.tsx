import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Phone, CreditCard } from 'lucide-react';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const guestSchema = z.object({
    fullName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(6, 'Teléfono debe tener al menos 6 caracteres'),
    documentId: z.string().optional(),
    notes: z.string().optional(),
});

type GuestFormData = z.infer<typeof guestSchema>;

interface NewGuestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewGuestDialog({ open, onOpenChange }: NewGuestDialogProps) {
    const { addGuest } = useGuestOperations();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<GuestFormData>({
        resolver: zodResolver(guestSchema),
        defaultValues: {
            fullName: '',
            email: '',
            phone: '',
            documentId: '',
            notes: '',
        },
    });

    const onSubmit = async (data: GuestFormData) => {
        setIsSubmitting(true);

        try {
            await addGuest({
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                documentId: data.documentId,
                notes: data.notes,
            });

            toast({
                title: 'Huésped creado',
                description: `${data.fullName} fue registrado exitosamente`,
            });

            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating guest:', error);
            toast({
                title: 'Error al crear huésped',
                description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Nuevo Huésped
                    </DialogTitle>
                    <DialogDescription>
                        Registra un nuevo huésped en la base de datos
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Full Name */}
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre completo *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Juan Pérez"
                                                className="pl-10"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Email */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="email"
                                                placeholder="juan@ejemplo.com"
                                                className="pl-10"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Phone */}
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="tel"
                                                placeholder="+54 11 1234-5678"
                                                className="pl-10"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Document ID */}
                        <FormField
                            control={form.control}
                            name="documentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Documento (opcional)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="DNI / Pasaporte"
                                                className="pl-10"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Notes */}
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas (opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Preferencias, alergias, información adicional..."
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto"
                            >
                                {isSubmitting ? 'Guardando...' : 'Guardar Huésped'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
