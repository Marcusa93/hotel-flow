import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapHousekeepingTask } from '@/lib/mappers';
import { useCreateHousekeepingTask } from '@/hooks/useCreateHousekeepingTask';
import { useUpdateHousekeepingTask } from '@/hooks/useUpdateHousekeepingTask';
import { useUpdateRoom } from '@/hooks/useUpdateRoom';
import type { HousekeepingTask, HousekeepingStatus, Room } from '@/types/hotel';

function useHousekeepingTasks() {
  return useQuery({
    queryKey: ['housekeepingTasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapHousekeepingTask);
    },
  });
}

export function useHousekeepingOperations() {
  const {
    data: housekeepingTasks = [],
    isLoading,
    refetch: refetchHousekeepingTasks,
  } = useHousekeepingTasks();
  const createTaskMutation = useCreateHousekeepingTask();
  const updateTaskMutation = useUpdateHousekeepingTask();
  const updateRoomMutation = useUpdateRoom();

  const addHousekeepingTask = useCallback(
    async (taskData: Omit<HousekeepingTask, 'id'>) => {
      return await createTaskMutation.mutateAsync({
        roomId: taskData.roomId,
        date: taskData.date instanceof Date ? taskData.date : undefined,
        assignedTo: taskData.assignedTo,
        priority: taskData.priority,
        notes: taskData.notes,
        checkoutTriggered: taskData.checkoutTriggered,
      });
    },
    [createTaskMutation]
  );

  const updateHousekeepingTask = useCallback(
    async (
      id: string,
      data: Partial<HousekeepingTask>,
      rooms?: Room[],
      startedAt?: Date,
      completedAt?: Date
    ) => {
      await updateTaskMutation.mutateAsync({ id, data, startedAt, completedAt });

      // Side effects: sync room status with task status
      const task = housekeepingTasks.find((t) => t.id === id);
      if (task && rooms) {
        const room = rooms.find((r) => r.id === task.roomId);
        if (room) {
          if (data.status === 'DONE' && room.status === 'DIRTY') {
            // Task completed → room available
            await updateRoomMutation.mutateAsync({
              id: task.roomId,
              status: 'AVAILABLE',
            });
          } else if (
            (data.status === 'IN_PROGRESS' || data.status === 'TODO') &&
            room.status === 'AVAILABLE' &&
            task.status === 'DONE'
          ) {
            // Task reverted from DONE → room back to dirty
            await updateRoomMutation.mutateAsync({
              id: task.roomId,
              status: 'DIRTY',
            });
          }
        }
      }
    },
    [updateTaskMutation, housekeepingTasks, updateRoomMutation]
  );

  return {
    housekeepingTasks,
    isLoading,
    addHousekeepingTask,
    updateHousekeepingTask,
    refetchHousekeepingTasks,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
  };
}
