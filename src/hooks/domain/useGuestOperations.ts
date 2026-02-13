import { useCallback } from 'react';
import { useGuests } from '@/hooks/useGuests';
import { useCreateGuest } from '@/hooks/useCreateGuest';
import { useUpdateGuest } from '@/hooks/useUpdateGuest';
import { useDeleteGuest } from '@/hooks/useDeleteGuest';
import type { Guest } from '@/types/hotel';

export function useGuestOperations() {
  const { data: guests = [], isLoading } = useGuests();
  const createGuestMutation = useCreateGuest();
  const updateGuestMutation = useUpdateGuest();
  const deleteGuestMutation = useDeleteGuest();

  const addGuest = useCallback(
    async (guestData: Omit<Guest, 'id' | 'createdAt'>) => {
      return await createGuestMutation.mutateAsync(guestData);
    },
    [createGuestMutation]
  );

  const updateGuest = useCallback(
    async (id: string, data: Partial<Guest>) => {
      await updateGuestMutation.mutateAsync({ id, data });
    },
    [updateGuestMutation]
  );

  const deleteGuest = useCallback(
    async (id: string) => {
      await deleteGuestMutation.mutateAsync(id);
    },
    [deleteGuestMutation]
  );

  return {
    guests,
    isLoading,
    addGuest,
    updateGuest,
    deleteGuest,
    isCreating: createGuestMutation.isPending,
    isUpdating: updateGuestMutation.isPending,
    isDeleting: deleteGuestMutation.isPending,
  };
}
