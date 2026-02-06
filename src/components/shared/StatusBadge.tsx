import { cn } from '@/lib/utils';
import { RoomStatus, BookingStatus, PaymentStatus, HousekeepingStatus } from '@/types/hotel';

type StatusType = RoomStatus | BookingStatus | PaymentStatus | HousekeepingStatus;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  // Room Status
  AVAILABLE: { label: 'Disponible', className: 'status-available' },
  OCCUPIED: { label: 'Ocupada', className: 'status-occupied' },
  DIRTY: { label: 'Sucia', className: 'status-dirty' },
  MAINTENANCE: { label: 'Mantenimiento', className: 'status-maintenance' },
  OUT_OF_ORDER: { label: 'Fuera de servicio', className: 'status-out-of-order' },
  // Booking Status
  PENDING: { label: 'Pendiente', className: 'booking-pending' },
  CONFIRMED: { label: 'Confirmada', className: 'booking-confirmed' },
  CHECKED_IN: { label: 'Check-in', className: 'booking-checked-in' },
  CHECKED_OUT: { label: 'Check-out', className: 'booking-checked-out' },
  CANCELLED: { label: 'Cancelada', className: 'booking-cancelled' },
  NO_SHOW: { label: 'No Show', className: 'booking-no-show' },
  // Payment Status
  PAID: { label: 'Pagado', className: 'payment-paid' },
  FAILED: { label: 'Fallido', className: 'payment-failed' },
  REFUNDED: { label: 'Reembolsado', className: 'payment-refunded' },
  // Housekeeping Status
  TODO: { label: 'Pendiente', className: 'booking-pending' },
  IN_PROGRESS: { label: 'En progreso', className: 'booking-confirmed' },
  DONE: { label: 'Completado', className: 'payment-paid' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: '' };
  
  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}
