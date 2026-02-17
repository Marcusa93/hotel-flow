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
  CreateTaskDialog
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
    try {
      await updateHousekeepingTask(taskId, { status: newStatus }, rooms, startedAt, completedAt);

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

  const completedToday = todaysTasks.filter(t => t.status === 'DONE').length;
  const inProgressCount = todaysTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingCount = todaysTasks.filter(t => t.status === 'TODO').length;

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

      <PageHeader
        title="Operaciones de Limpieza"
        description={isMobileView ? "Tu lista de tareas" : "Tablero visual de estado de habitaciones"}
        actions={
          <div className="flex gap-2">
            {/* Create Task Button */}
            <CreateTaskDialog
              rooms={rooms}
              onCreateTask={handleCreateTask}
              isCreating={isCreating}
            />

            {/* View Toggle */}
            <div className="hidden md:flex bg-card/80 backdrop-blur-sm rounded-lg p-1 border">
              <Button
                variant="ghost"
                size="sm"
                className={cn(!isMobileView && "bg-background shadow-sm")}
                onClick={() => setIsMobileView(false)}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(isMobileView && "bg-background shadow-sm")}
                onClick={() => setIsMobileView(true)}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>

            {!isMobileView && (
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-[140px] bg-card/80 backdrop-blur-sm border">
                  <SelectValue placeholder="Piso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los pisos</SelectItem>
                  {availableFloors.map((floor) => (
                    <SelectItem key={floor} value={floor.toString()}>
                      Piso {floor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      {/* Quick Stats (visible in both views) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl p-3 text-center border border-rose-200/50 dark:border-rose-800/30">
          <p className="text-2xl font-bold text-rose-600">{pendingCount}</p>
          <p className="text-xs text-rose-600/70 font-medium">Pendientes</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-center border border-amber-200/50 dark:border-amber-800/30">
          <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
          <p className="text-xs text-amber-600/70 font-medium">En progreso</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 text-center border border-emerald-200/50 dark:border-emerald-800/30">
          <p className="text-2xl font-bold text-emerald-600">{completedToday}</p>
          <p className="text-xs text-emerald-600/70 font-medium">Listas hoy</p>
        </div>
      </div>

      {/* Mobile View */}
      {isMobileView ? (
        <MobileTaskList
          tasks={todaysTasks}
          rooms={rooms}
          onStatusChange={handleStatusChange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      ) : (
        /* Desktop View */
        <>
          {/* Staff Stats Row */}
          {staffMembers.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              {staffMembers.slice(0, 2).map(name => (
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
    </div>
  );
}
