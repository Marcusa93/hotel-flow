import type { HousekeepingTask, Room } from '@/types/hotel';

/**
 * Si la habitación está en condiciones de recibir al huésped.
 *
 * El check-in nunca se bloquea: recepción a veces sabe algo que el sistema no
 * (la mucama terminó y todavía no lo cargó, el huésped acepta esperar). Lo que
 * faltaba era el aviso: la habitación 501 estaba en limpieza y el check-in
 * pasaba sin decir nada.
 */

export type RoomWarningSeverity = 'warning' | 'critical';

export interface RoomCheckInWarning {
  /** 'critical' es la habitación que no se puede usar; 'warning', la que todavía no está lista. */
  severity: RoomWarningSeverity;
  title: string;
  message: string;
}

/**
 * La limpieza abierta de la habitación: primero la que se está haciendo ahora,
 * después la más reciente sin terminar. Sirve para nombrar a quién la tiene.
 */
function getOpenCleaning(
  roomId: string,
  tasks: HousekeepingTask[]
): HousekeepingTask | undefined {
  return tasks
    .filter((t) => t.roomId === roomId && t.status !== 'DONE')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'IN_PROGRESS' ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })[0];
}

/**
 * El aviso a mostrar antes de un check-in, o null si la habitación está lista.
 *
 * `housekeepingTasks` es opcional: sin ellas el estado de la habitación alcanza
 * para avisar, y con ellas el mensaje además dice quién está limpiando.
 */
export function getRoomCheckInWarning(
  room: Room | undefined | null,
  housekeepingTasks: HousekeepingTask[] = []
): RoomCheckInWarning | null {
  if (!room) return null;

  const label = room.roomNumber ? `La habitación ${room.roomNumber}` : 'La habitación';
  const cleaning = getOpenCleaning(room.id, housekeepingTasks);
  const by = cleaning?.assignedTo ? ` (a cargo de ${cleaning.assignedTo})` : '';

  switch (room.status) {
    case 'OUT_OF_ORDER':
      return {
        severity: 'critical',
        title: 'Habitación fuera de servicio',
        message: `${label} está marcada como fuera de servicio. Revisá que se pueda usar antes de alojar al huésped.`,
      };

    case 'MAINTENANCE':
      return {
        severity: 'critical',
        title: 'Habitación en mantenimiento',
        message: `${label} está en mantenimiento. Verificá que esté habilitada antes del ingreso.`,
      };

    case 'OCCUPIED':
      // La reserva todavía no hizo check-in pero la habitación figura ocupada:
      // o el huésped anterior no tiene el check-out hecho, o el estado quedó viejo.
      return {
        severity: 'critical',
        title: 'Habitación ocupada',
        message: `${label} figura ocupada. Confirmá que el huésped anterior ya se retiró y tiene el check-out hecho.`,
      };

    case 'DIRTY':
      if (cleaning?.status === 'IN_PROGRESS') {
        return {
          severity: 'warning',
          title: 'Habitación en limpieza',
          message: `${label} se está limpiando en este momento${by}. Esperá a que termine o confirmá que ya quedó lista.`,
        };
      }
      return {
        severity: 'warning',
        title: cleaning ? 'Habitación pendiente de limpieza' : 'Habitación sucia',
        message: cleaning
          ? `${label} tiene una limpieza pendiente${by}: todavía no fue limpiada desde la última salida.`
          : `${label} está marcada como sucia: todavía no fue limpiada desde la última salida.`,
      };

    default:
      // Disponible pero con la mucama adentro: alguien marcó la habitación limpia
      // antes de que la tarea se cerrara.
      if (cleaning?.status === 'IN_PROGRESS') {
        return {
          severity: 'warning',
          title: 'Habitación en limpieza',
          message: `${label} figura disponible, pero tiene una limpieza en curso${by}.`,
        };
      }
      return null;
  }
}

/** El texto del botón que confirma: con aviso, dice que se sigue igual. */
export function checkInConfirmLabel(warning: RoomCheckInWarning | null | undefined): string {
  return warning ? 'Check-in de todas formas' : 'Confirmar Check-in';
}
