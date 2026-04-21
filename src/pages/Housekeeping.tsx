import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Filter, Smartphone, Monitor } from 'lucide-react';
import { useHousekeepingOperations } from '@/hooks/domain/useHousekeepingOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  HousekeepingBoard,
  StaffPerformanceCard,
  MobileTaskList,
  TaskAlertBanner,
  CreateTaskDialog,
  EditTaskDialog
} from '@/components/housekeeping';
import { HousekeepingTask, HousekeepingStatus, TaskPriority } from '@/types/hotel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Housekeeping() {
  const { housekeepingTasks, addHousekeepingTask, updateHousekeepingTask, refetchHousekeepingTasks, isCreating } = useHousekeepingOperations();
  const { rooms } = useRoomOperations();

  const [floorFilter, setFloorFilter] = useState<'ALL' | string>('ALL');
  const [isMobileView, setIsMobileView] = useState(false);
  const [newAlertTasks, setNewAlertTasks] = useState<HousekeepingTask[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<HousekeepingTask | null>(null);

  // Dynamically get available floors from rooms
  const availableFloors = useMemo(() => {
    const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
    return floors;
  }, [rooms]);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Compare dates using local YYYY-MM-DD strings to avoid UTC/timezone mismatches
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todaysTasks = useMemo(() => {
    const todayStr = toLocalDate(new Date());
    return housekeepingTasks.filter(task => {
      const d = task.date instanceof Date ? task.date : new Date(task.date);
      return toLocalDate(d) === todayStr;
    });
  }, [housekeepingTasks]);

  // Track new checkout/urgent tasks for alerts (only today's tasks)
  useEffect(() => {
    const urgentTasks = todaysTasks.filter(t =>
      (t.priority === 'CHECKOUT' || t.priority === 'URGENT') &&
      t.status === 'TODO' &&
      !dismissedAlerts.has(t.id)
    );
    setNewAlertTasks(urgentTasks);
  }, [todaysTasks, dismissedAlerts]);

  const handleStatusChange = useCallback(async (
    taskId: string,
    newStatus: HousekeepingStatus,
    startedAt?: Date,
    completedAt?: Date
  ) => {
    // Auto-fill time tracking if the caller didn't supply it (e.g. the board).
    // Forward transitions stamp "now"; reverse transitions are handled in the
    // mutation (it clears timestamps when moving back to TODO or IN_PROGRESS).
    const now = new Date();
    const effectiveStartedAt = startedAt ?? (newStatus === 'IN_PROGRESS' ? now : undefined);
    const effectiveCompletedAt = completedAt ?? (newStatus === 'DONE' ? now : undefined);

    try {
      await updateHousekeepingTask(taskId, { status: newStatus }, rooms, effectiveStartedAt, effectiveCompletedAt);

      const statusMessages: Record<HousekeepingStatus, string> = {
        TODO: 'Tarea pendiente',
        IN_PROGRESS: '🧹 ¡Limpieza iniciada!',
        DONE: '✨ ¡Habitación lista!',
      };

      toast({
        title: statusMessages[newStatus],
        description: newStatus === 'DONE' ? 'Buen trabajo' : undefined,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la tarea',
        variant: 'destructive',
      });
    }
  }, [updateHousekeepingTask, rooms]);

  const handleCreateTask = useCallback(async (data: {
    roomId: string;
    priority: TaskPriority;
    assignedTo?: string;
    notes?: string;
  }) => {
    try {
      await addHousekeepingTask({
        roomId: data.roomId,
        date: new Date(),
        status: 'TODO',
        priority: data.priority,
        assignedTo: data.assignedTo,
        notes: data.notes,
      });
      toast({
        title: '✅ Tarea creada',
        description: 'Nueva tarea de limpieza agregada',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear la tarea',
        variant: 'destructive',
      });
      throw error;
    }
  }, [addHousekeepingTask]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchHousekeepingTasks?.();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleDismissAlerts = () => {
    const ids = new Set(newAlertTasks.map(t => t.id));
    setDismissedAlerts(prev => new Set([...prev, ...ids]));
  };

  const handleViewTask = (task: HousekeepingTask) => {
    // Dismiss the alert and scroll to tasks section
    handleDismissAlerts();
    const el = document.getElementById('housekeeping-board');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredRooms = floorFilter === 'ALL'
    ? rooms
    : rooms.filter(r => r.floor.toString() === floorFilter);

  // Dynamically get unique staff from today's tasks
  const staffMembers = useMemo(() => {
    const names = new Set<string>();
    todaysTasks.forEach(t => {
      if (t.assignedTo) names.add(t.assignedTo);
    });
    return Array.from(names);
  }, [todaysTasks]);

  // All known staff names (from all tasks, not just today) for autocomplete
  const allStaffNames = useMemo(() => {
    const names = new Set<string>();
    housekeepingTasks.forEach(t => {
      if (t.assignedTo) names.add(t.assignedTo);
    });
    return Array.from(names).sort();
  }, [housekeepingTasks]);

  const handleEditTask = useCallback(async (taskId: string, data: Partial<HousekeepingTask>) => {
    try {
      await updateHousekeepingTask(taskId, data, rooms);
      toast({
        title: '✅ Tarea actualizada',
        description: 'Los cambios se guardaron correctamente',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la tarea',
        variant: 'destructive',
      });
      throw new Error('update failed');
    }
  }, [updateHousekeepingTask, rooms]);

  const completedToday = todaysTasks.filter(t => t.status === 'DONE').length;
  const inProgressCount = todaysTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingCount = todaysTasks.filter(t => t.status === 'TODO').length;

  // Dirty rooms that don't have a task yet
  const dirtyRooms = rooms.filter(r => r.status === 'DIRTY');
  const dirtyWithoutTask = useMemo(() => {
    const roomsWithTask = new Set(todaysTasks.map(t => t.roomId));
    return dirtyRooms.filter(r => !roomsWithTask.has(r.id));
  }, [dirtyRooms, todaysTasks]);

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <TaskAlertBanner
        newTasks={newAlertTasks}
        rooms={rooms}
        onDismiss={handleDismissAlerts}
        onViewTask={handleViewTask}
        enableSound={true}
      />

      {/* Compact Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Limpieza
            </h1>
            <p className="text-muted-foreground text-sm">
              {dirtyRooms.length} habitaciones sucias · {todaysTasks.length} tareas hoy
            </p>
          </div>
          <div className="flex gap-2">
            <CreateTaskDialog
              rooms={rooms}
              staffSuggestions={allStaffNames}
              onCreateTask={handleCreateTask}
              isCreating={isCreating}
            />
            <div className="hidden md:flex bg-card/80 backdrop-blur-sm rounded-lg p-1 border">
              <Button variant="ghost" size="sm" className={cn(!isMobileView && "bg-background shadow-sm")} onClick={() => setIsMobileView(false)}>
                <Monitor className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className={cn(isMobileView && "bg-background shadow-sm")} onClick={() => setIsMobileView(true)}>
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>
            {!isMobileView && (
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-[130px] rounded-xl">
                  <SelectValue placeholder="Piso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los pisos</SelectItem>
                  {availableFloors.map((floor) => (
                    <SelectItem key={floor} value={floor.toString()}>Piso {floor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-slate-900 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">{dirtyRooms.length}</p>
            <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 font-semibold">Sucias</p>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-900 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{pendingCount}</p>
            <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 font-semibold">Pendientes</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{inProgressCount}</p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-semibold">Limpiando</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{completedToday}</p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold">Listas</p>
          </div>
        </div>
      </div>

      {/* Dirty rooms without tasks — alert banner */}
      {dirtyWithoutTask.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {dirtyWithoutTask.length} habitaciones sucias sin tarea asignada
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {dirtyWithoutTask.sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber)).map(room => (
              <button
                key={room.id}
                onClick={() => {
                  handleCreateTask({ roomId: room.id, priority: 'NORMAL' });
                }}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 rounded-xl px-3 py-2 text-sm font-bold text-orange-700 dark:text-orange-300 hover:shadow-md hover:scale-[1.03] transition-all active:scale-95"
              >
                <span className="text-lg">{room.roomNumber}</span>
                <span className="text-[10px] text-muted-foreground">P{room.floor}</span>
                <span className="text-[10px] text-orange-500">+ Crear</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile View */}
      {isMobileView ? (
        <MobileTaskList
          tasks={todaysTasks}
          rooms={rooms}
          onStatusChange={handleStatusChange}
          onEdit={setEditingTask}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      ) : (
        /* Desktop View */
        <>
          {/* Staff Stats Row — show ALL staff */}
          {staffMembers.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-8">
              {staffMembers.map(name => (
                <StaffPerformanceCard
                  key={name}
                  name={name}
                  completed={todaysTasks.filter(t => t.assignedTo === name && t.status === 'DONE').length}
                  total={Math.max(1, todaysTasks.filter(t => t.assignedTo === name).length)}
                />
              ))}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-center">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {Math.round((completedToday / Math.max(1, todaysTasks.length)) * 100)}% Completado Hoy
                </p>
              </div>
            </div>
          )}

          <div id="housekeeping-board" className="relative min-h-[500px] bg-slate-100/50 dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/60 shadow-inner">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                Tablero de Habitaciones
              </h3>
              <div className="flex gap-4 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400" /> Sucia</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> Limpiando</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Lista</div>
              </div>
            </div>

            <HousekeepingBoard
              rooms={filteredRooms}
              tasks={todaysTasks}
              onStatusChange={(taskId, status) => handleStatusChange(taskId, status)}
            />

            {filteredRooms.length === 0 && (
              <EmptyState icon={ClipboardList} title="No se encontraron habitaciones" />
            )}
          </div>
        </>
      )}

      {/* Edit Task Dialog */}
      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          task={editingTask}
          room={rooms.find(r => r.id === editingTask.roomId) || rooms[0]}
          rooms={rooms}
          staffSuggestions={allStaffNames}
          onSave={handleEditTask}
        />
      )}
    </div>
  );
}
