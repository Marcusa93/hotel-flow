import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Phone, CreditCard, Globe, Car } from 'lucide-react';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { COUNTRIES, DOCUMENT_TYPES } from '@/lib/constants';
import type { DocumentType } from '@/types/hotel';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

const guestSchema = z.object({
    fullName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().min(6, 'Teléfono debe tener al menos 6 caracteres'),
    documentType: z.string().optional(),
    documentId: z.string().optional(),
    country: z.string().optional(),
    notes: z.string().optional(),
    hasVehicle: z.boolean().optional(),
    vehicleDescription: z.string().optional(),
    licensePlate: z.string().optional(),
});

type GuestFormData = z.infer<typeof guestSchema>;

interface NewGuestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewGuestDialog({ open, onOpenChange }: NewGuestDialogProps) {
    const { addGuest } = useGuestOperations();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVehicle, setShowVehicle] = useState(false);

    const form = useForm<GuestFormData>({
        resolver: zodResolver(guestSchema),
        defaultValues: {
            fullName: '',
            email: '',
            phone: '',
            documentType: 'DNI',
            documentId: '',
            country: '',
            notes: '',
            hasVehicle: false,
            vehicleDescription: '',
            licensePlate: '',
        },
    });

    const onSubmit = async (data: GuestFormData) => {
        setIsSubmitting(true);

        try {
            await addGuest({
                fullName: data.fullName,
                email: data.email || '',
                phone: data.phone,
                documentType: (data.documentType as DocumentType) || undefined,
                documentId: data.documentId || undefined,
                country: data.country || undefined,
                notes: data.notes || undefined,
                hasVehicle: data.hasVehicle ?? false,
                vehicleDescription: data.hasVehicle ? data.vehicleDescription : undefined,
                licensePlate: data.hasVehicle ? data.licensePlate?.toUpperCase() : undefined,
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
                        Registra un nuevo huésped en el sistema
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
                                            <Input placeholder="Juan Pérez" className="pl-10" autoFocus {...field} />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Document Type + Document ID */}
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            <FormField
                                control={form.control}
                                name="documentType"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Tipo Doc.</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {DOCUMENT_TYPES.map(dt => (
                                                    <SelectItem key={dt.value} value={dt.value}>
                                                        {dt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="documentId"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-3">
                                        <FormLabel>Nro. Documento</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input placeholder="12345678" className="pl-10" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Phone + Email */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono *</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="tel" placeholder="+54 11 1234-5678" className="pl-10" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email <span className="text-muted-foreground text-xs">(opcional)</span></FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="email" placeholder="juan@ejemplo.com" className="pl-10" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Country */}
                        <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>País / Nacionalidad</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                                    <SelectValue placeholder="Seleccionar país" />
                                                </div>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {COUNTRIES.map(c => (
                                                <SelectItem key={c.value} value={c.value}>
                                                    {c.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                    <FormLabel>Notas <span className="text-muted-foreground text-xs">(opcional)</span></FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Preferencias, alergias, información adicional..." rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Vehicle */}
                        <div className="space-y-3">
                            <FormField
                                control={form.control}
                                name="hasVehicle"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(checked) => {
                                                    field.onChange(checked);
                                                    setShowVehicle(!!checked);
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                                            <Car className="w-4 h-4" />
                                            Tiene vehículo
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            {showVehicle && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border bg-muted/30">
                                    <FormField
                                        control={form.control}
                                        name="vehicleDescription"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Descripción del vehículo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: Toyota Corolla Gris" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="licensePlate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Patente</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Ej: AB 123 CD"
                                                        {...field}
                                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                        className="font-mono uppercase"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                {isSubmitting ? 'Guardando...' : 'Guardar Huésped'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
