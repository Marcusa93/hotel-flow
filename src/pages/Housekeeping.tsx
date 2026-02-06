import { useState } from 'react';
import { ClipboardList, Check, Clock, Play, User } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HousekeepingStatus } from '@/types/hotel';

export default function Housekeeping() {
  const { housekeepingTasks, rooms, roomTypes, updateHousekeepingTask } = useHotel();
  const [filter, setFilter] = useState<HousekeepingStatus | 'ALL'>('ALL');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysTasks = housekeepingTasks.filter(task => {
    const taskDate = new Date(task.date);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate.getTime() === today.getTime();
  });

  const filteredTasks = filter === 'ALL' 
    ? todaysTasks 
    : todaysTasks.filter(t => t.status === filter);

  const getRoomInfo = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    const roomType = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : null;
    return { room, roomType };
  };

  const handleStatusChange = (taskId: string, newStatus: HousekeepingStatus) => {
    updateHousekeepingTask(taskId, { status: newStatus });
  };

  const todoCount = todaysTasks.filter(t => t.status === 'TODO').length;
  const inProgressCount = todaysTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const doneCount = todaysTasks.filter(t => t.status === 'DONE').length;

  // Dirty rooms that need tasks
  const dirtyRooms = rooms.filter(r => r.status === 'DIRTY');
  const dirtyRoomsWithoutTasks = dirtyRooms.filter(r => 
    !todaysTasks.some(t => t.roomId === r.id)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Limpieza"
        description={`${todaysTasks.length} tareas para hoy`}
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter('ALL')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{todaysTasks.length}</p>
              </div>
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${filter === 'TODO' ? 'border-accent' : ''}`} onClick={() => setFilter('TODO')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-accent">{todoCount}</p>
              </div>
              <Clock className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${filter === 'IN_PROGRESS' ? 'border-primary' : ''}`} onClick={() => setFilter('IN_PROGRESS')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Progreso</p>
                <p className="text-2xl font-bold text-primary">{inProgressCount}</p>
              </div>
              <Play className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${filter === 'DONE' ? 'border-status-available' : ''}`} onClick={() => setFilter('DONE')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold text-status-available">{doneCount}</p>
              </div>
              <Check className="w-8 h-8 text-status-available" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dirty rooms alert */}
      {dirtyRoomsWithoutTasks.length > 0 && (
        <Card className="border-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-accent">Habitaciones Sucias Sin Tarea Asignada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dirtyRoomsWithoutTasks.map(room => (
                <Badge key={room.id} variant="outline" className="text-accent border-accent">
                  Hab. {room.roomNumber}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No hay tareas"
          description={filter === 'ALL' ? 'No hay tareas de limpieza para hoy' : 'No hay tareas con este estado'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map(task => {
            const { room, roomType } = getRoomInfo(task.roomId);
            
            return (
              <Card key={task.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">Hab. {room?.roomNumber}</CardTitle>
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{roomType?.name}</Badge>
                    <span className="text-xs text-muted-foreground">Piso {room?.floor}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.assignedTo && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{task.assignedTo}</span>
                    </div>
                  )}
                  
                  {task.notes && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      {task.notes}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {task.status === 'TODO' && (
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleStatusChange(task.id, 'DONE')}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Completar
                      </Button>
                    )}
                    {task.status === 'DONE' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1"
                        disabled
                      >
                        <Check className="w-4 h-4 mr-1 text-status-available" />
                        Completada
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
