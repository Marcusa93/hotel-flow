import { useState } from 'react';
import { ClipboardList, Filter } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { HousekeepingBoard, StaffPerformanceCard } from '@/components/housekeeping';
import { HousekeepingTask, HousekeepingStatus } from '@/types/hotel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Housekeeping() {
  const { housekeepingTasks, rooms, updateHousekeepingTask } = useHotel();
  const [floorFilter, setFloorFilter] = useState<'ALL' | string>('ALL');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysTasks = housekeepingTasks.filter(task => {
    const taskDate = new Date(task.date);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate.getTime() === today.getTime();
  });

  const handleStatusChange = (taskId: string, newStatus: HousekeepingStatus) => {
    updateHousekeepingTask(taskId, { status: newStatus });
  };

  // Mock staff (usually would come from context)
  const staffMembers = [
    { name: 'Maria G.', id: '1' },
    { name: 'Carlos R.', id: '2' },
  ];

  const filteredRooms = floorFilter === 'ALL'
    ? rooms
    : rooms.filter(r => r.floor.toString() === floorFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones de Limpieza"
        description="Tablero visual de estado de habitaciones"
        actions={
          <div className="flex gap-2">
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-[140px] bg-white/50 backdrop-blur-sm border-white/20">
                <SelectValue placeholder="Piso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los pisos</SelectItem>
                <SelectItem value="1">Piso 1</SelectItem>
                <SelectItem value="2">Piso 2</SelectItem>
                <SelectItem value="3">Piso 3</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="bg-white/50 backdrop-blur-sm">
              <Filter className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
        }
      />

      {/* Staff Stats Row */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StaffPerformanceCard
          name="Maria Gonzalez"
          completed={todaysTasks.filter(t => t.assignedTo?.includes("Maria") && t.status === 'DONE').length}
          total={Math.max(1, todaysTasks.filter(t => t.assignedTo?.includes("Maria")).length)}
        />
        <StaffPerformanceCard
          name="Carlos Ruiz"
          completed={todaysTasks.filter(t => t.assignedTo?.includes("Carlos") && t.status === 'DONE').length}
          total={Math.max(1, todaysTasks.filter(t => t.assignedTo?.includes("Carlos")).length)}
        />
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-center">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {Math.round((todaysTasks.filter(t => t.status === 'DONE').length / Math.max(1, todaysTasks.length)) * 100)}% Completado Hoy
          </p>
        </div>
      </div>

      <div className="relative min-h-[500px] bg-slate-100/50 dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/60 shadow-inner">
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
          onStatusChange={handleStatusChange}
        />

        {filteredRooms.length === 0 && (
          <EmptyState icon={ClipboardList} title="No se encontraron habitaciones" />
        )}
      </div>
    </div>
  );
}
