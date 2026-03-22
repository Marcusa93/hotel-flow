
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Guest } from '@/types/hotel';
import { logAuditEvent } from './useCreateAuditLog';
import { createNotificationIfEnabled } from './useCreateNotification';

type CreateGuestParams = Omit<Guest, 'id' | 'createdAt'>;

export const useCreateGuest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (guestData: CreateGuestParams) => {
            const { data, error } = await supabase
                .from('guests')
                .insert({
                    full_name: guestData.fullName,
                    document_type: guestData.documentType,
                    document_id: guestData.documentId,
                    phone: guestData.phone,
                    email: guestData.email,
                    notes: guestData.notes,
                    country: guestData.country,
                    has_vehicle: guestData.hasVehicle ?? false,
                    vehicle_description: guestData.vehicleDescription,
                    license_plate: guestData.licensePlate,
                })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                fullName: data.full_name,
                documentType: data.document_type,
                documentId: data.document_id,
                email: data.email,
                phone: data.phone,
                notes: data.notes,
                country: data.country,
                hasVehicle: data.has_vehicle ?? false,
                vehicleDescription: data.vehicle_description,
                licensePlate: data.license_plate,
                createdAt: new Date(data.created_at)
            } as Guest;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['guests'] });
            logAuditEvent({
                entityType: 'guest',
                entityId: data.id,
                action: 'CREATE',
                description: `Huésped creado: ${data.fullName}`,
                newValues: { fullName: data.fullName, email: data.email, phone: data.phone, documentId: data.documentId },
            });

            createNotificationIfEnabled({
                type: 'info',
                category: 'booking',
                title: 'Nuevo huésped registrado',
                message: `${data.fullName} ha sido registrado en el sistema`,
                metadata: { guestId: data.id, guestName: data.fullName },
            });
        }
    });
};
