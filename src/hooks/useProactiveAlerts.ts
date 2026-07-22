import { useEffect, useRef } from 'react';
import { addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAppRole } from '@/context/AppRoleContext';
import { targetRolesForCategory } from '@/hooks/useCreateNotification';
import type { NotificationCategory } from '@/hooks/useNotifications';

/**
 * Proactive alert engine — runs periodic checks and creates notifications
 * for critical operational situations:
 *
 * 1. Dirty rooms with check-in today
 * 2. Pending balance with checkout today/tomorrow
 * 3. Late check-outs (past checkout date, still CHECKED_IN)
 * 4. Rooms in maintenance with upcoming booking
 */

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const ALERT_PREFIX = '[AUTO]'; // Prefix to identify auto-generated alerts
const ARRIVAL_GRACE_MINUTES = 60; // How late a guest can be before recepción is alerted

async function sendPushNotification(
  title: string,
  body: string,
  category: NotificationCategory,
  url?: string
) {
  try {
    // invoke() no lanza si la función responde 4xx/5xx: devuelve { error }.
    // Sin mirarlo, un push rechazado era indistinguible de uno entregado.
    const { data, error } = await supabase.functions.invoke('send-push', {
      // Mismo público que la notificación en la app: sin esto, un aviso de saldo
      // pendiente le sonaba también al teléfono de limpieza.
      body: { title, body, url, tag: 'proactive-alert', targetRoles: targetRolesForCategory(category) },
    });
    if (error) {
      console.warn('[ProactiveAlerts] send-push falló:', error);
    } else if (data && data.sent === 0 && data.total > 0) {
      console.warn('[ProactiveAlerts] ninguna suscripción recibió el push:', data);
    }
  } catch (err) {
    console.warn('[ProactiveAlerts] Push send failed:', err);
  }
}

async function createAlertIfNew(
  category: string,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error',
  metadata: Record<string, unknown> = {},
  dedupeKey: string
) {
  // Check if we already created this alert today (avoid duplicates).
  // Local calendar day — toISOString() would shift to the next day after 21:00 in AR.
  const today = formatLocalDate(new Date());
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('title', title)
    .gte('created_at', `${today}T00:00:00`)
    .limit(1);

  if (existing && existing.length > 0) return; // Already alerted today

  await supabase.from('notifications').insert({
    type,
    category,
    title,
    message,
    metadata: { ...metadata, autoAlert: true, dedupeKey },
    is_read: false,
    // This insert bypasses useCreateNotification, so the routing has to be
    // applied here too — otherwise the DB default sends housekeeping alerts
    // to admin+reception only.
    target_roles: targetRolesForCategory(category as NotificationCategory),
  });

  // Also send push notification for warning/error alerts (fire-and-forget, don't block alert creation)
  if (type === 'warning' || type === 'error') {
    sendPushNotification(
      title.replace(ALERT_PREFIX + ' ', ''),
      message,
      category as NotificationCategory,
      '/notifications'
    );
  }
}

async function runProactiveChecks() {
  // Local calendar days — UTC dates are wrong between 21:00-24:00 in Argentina
  const today = formatLocalDate(new Date());
  const tomorrow = formatLocalDate(addDays(new Date(), 1));

  try {
    // Fetch all data we need in parallel
    const [roomsRes, bookingsRes, paymentsRes] = await Promise.all([
      supabase.from('rooms').select('id, room_number, floor, status'),
      supabase.from('bookings').select('id, guest_id, room_id, check_in_date, check_out_date, estimated_arrival_time, status, total_amount')
        .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING']),
      supabase.from('payments').select('booking_id, amount, status, discount_amount').eq('status', 'PAID'),
    ]);

    const rooms = roomsRes.data || [];
    const bookings = bookingsRes.data || [];
    const payments = paymentsRes.data || [];

    // Build lookup maps
    const roomMap = new Map(rooms.map(r => [r.id, r]));
    // Saldado = cobrado + descontado. Esta consulta va contra la base en snake_case,
    // así que no pasa por el mapper. Sin sumar discount_amount, una reserva pagada
    // con cupón dispara una alerta —y un push— por una deuda que no existe.
    const paidByBooking = new Map<string, number>();
    for (const p of payments) {
      if (p.booking_id) {
        const settled = Number(p.amount) + Number(p.discount_amount || 0);
        paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) || 0) + settled);
      }
    }

    // Fetch guest names for all active bookings
    const guestIds = [...new Set(bookings.map(b => b.guest_id).filter(Boolean))];
    const guestMap = new Map<string, string>();
    if (guestIds.length > 0) {
      const { data: guests } = await supabase
        .from('guests')
        .select('id, full_name')
        .in('id', guestIds);
      for (const g of (guests || [])) {
        guestMap.set(g.id, g.full_name);
      }
    }

    // ─── CHECK 1: Dirty rooms with check-in today ──────────────────
    const dirtyRooms = rooms.filter(r => r.status === 'DIRTY');
    const todayCheckins = bookings.filter(b =>
      b.check_in_date?.split('T')[0] === today &&
      (b.status === 'CONFIRMED' || b.status === 'PENDING')
    );

    for (const booking of todayCheckins) {
      const room = roomMap.get(booking.room_id);
      if (room && room.status === 'DIRTY') {
        const guestName = guestMap.get(booking.guest_id) || 'Huésped';
        await createAlertIfNew(
          'housekeeping',
          `${ALERT_PREFIX} Hab ${room.room_number} sucia — check-in hoy`,
          `La habitación ${room.room_number} está sucia y ${guestName} tiene check-in programado para hoy. Priorizar limpieza.`,
          'warning',
          { roomId: room.id, roomNumber: room.room_number, bookingId: booking.id, guestName },
          `dirty-checkin-${room.id}-${today}`
        );
      }
    }

    // ─── CHECK 2: Maintenance rooms with upcoming booking ──────────
    const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER');
    const upcomingBookings = bookings.filter(b =>
      (b.check_in_date?.split('T')[0] === today || b.check_in_date?.split('T')[0] === tomorrow) &&
      (b.status === 'CONFIRMED' || b.status === 'PENDING')
    );

    for (const booking of upcomingBookings) {
      const room = roomMap.get(booking.room_id);
      if (room && (room.status === 'MAINTENANCE' || room.status === 'OUT_OF_ORDER')) {
        const guestName = guestMap.get(booking.guest_id) || 'Huésped';
        const isToday = booking.check_in_date?.split('T')[0] === today;
        await createAlertIfNew(
          'system',
          `${ALERT_PREFIX} Hab ${room.room_number} en mantenimiento — reserva ${isToday ? 'hoy' : 'mañana'}`,
          `La habitación ${room.room_number} está en mantenimiento pero ${guestName} llega ${isToday ? 'hoy' : 'mañana'}. Se necesita reubicar o resolver urgente.`,
          'error',
          { roomId: room.id, roomNumber: room.room_number, bookingId: booking.id, guestName },
          `maintenance-booking-${room.id}-${today}`
        );
      }
    }

    // ─── CHECK 3: Late check-outs ──────────────────────────────────
    const lateCheckouts = bookings.filter(b =>
      b.status === 'CHECKED_IN' &&
      b.check_out_date?.split('T')[0] < today
    );

    for (const booking of lateCheckouts) {
      const room = roomMap.get(booking.room_id);
      const guestName = guestMap.get(booking.guest_id) || 'Huésped';
      const checkoutDate = booking.check_out_date?.split('T')[0];
      await createAlertIfNew(
        'checkout',
        `${ALERT_PREFIX} Check-out atrasado — ${guestName}`,
        `${guestName} (Hab ${room?.room_number || '?'}) debía hacer check-out el ${formatDate(checkoutDate)} y sigue alojado/a. Verificar situación.`,
        'warning',
        { bookingId: booking.id, guestName, roomNumber: room?.room_number },
        `late-checkout-${booking.id}-${today}`
      );
    }

    // ─── CHECK 4: Pending balance with check-out today/tomorrow ────
    const nearCheckouts = bookings.filter(b =>
      b.status === 'CHECKED_IN' &&
      (b.check_out_date?.split('T')[0] === today || b.check_out_date?.split('T')[0] === tomorrow)
    );

    for (const booking of nearCheckouts) {
      const paid = paidByBooking.get(booking.id) || 0;
      const pending = booking.total_amount - paid;
      if (pending > 0) {
        const room = roomMap.get(booking.room_id);
        const guestName = guestMap.get(booking.guest_id) || 'Huésped';
        const isToday = booking.check_out_date?.split('T')[0] === today;
        await createAlertIfNew(
          'payment',
          `${ALERT_PREFIX} Balance pendiente $${pending.toLocaleString('es-AR')} — ${guestName}`,
          `${guestName} (Hab ${room?.room_number || '?'}) tiene check-out ${isToday ? 'hoy' : 'mañana'} con $${pending.toLocaleString('es-AR')} sin cobrar.`,
          isToday ? 'error' : 'warning',
          { bookingId: booking.id, guestName, roomNumber: room?.room_number, amount: pending },
          `pending-balance-${booking.id}-${today}`
        );
      }
    }

    // ─── CHECK 5: Many dirty rooms (operational bottleneck) ────────
    if (dirtyRooms.length >= 3 && todayCheckins.length > 0) {
      await createAlertIfNew(
        'housekeeping',
        `${ALERT_PREFIX} ${dirtyRooms.length} habitaciones sucias con ${todayCheckins.length} check-ins hoy`,
        `Hay ${dirtyRooms.length} habitaciones sucias (${dirtyRooms.map(r => r.room_number).join(', ')}) y ${todayCheckins.length} llegadas programadas. Coordinar limpieza urgente.`,
        'warning',
        { dirtyCount: dirtyRooms.length, checkinCount: todayCheckins.length },
        `dirty-bottleneck-${today}`
      );
    }

    // ─── CHECK 6: Announced arrival hour already passed ────────────
    // Only fires for bookings where the guest actually gave an hour. The
    // hotel-wide check-in time is a policy, not a promise, so it is not used here.
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    for (const booking of todayCheckins) {
      const eta = booking.estimated_arrival_time;
      if (!eta) continue;

      const [h, m] = eta.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;

      // Grace period, so a guest stuck in traffic doesn't trigger an alert on the dot.
      if (minutesNow <= h * 60 + m + ARRIVAL_GRACE_MINUTES) continue;

      const room = roomMap.get(booking.room_id);
      const guestName = guestMap.get(booking.guest_id) || 'Huésped';
      await createAlertIfNew(
        'checkin',
        `${ALERT_PREFIX} ${guestName} no llegó a horario`,
        `${guestName} (Hab ${room?.room_number || '?'}) avisó que llegaba ~${eta} hs y todavía no hizo el check-in. Verificar si sigue en camino.`,
        'warning',
        { bookingId: booking.id, guestName, roomNumber: room?.room_number, estimatedArrivalTime: eta },
        `late-arrival-${booking.id}-${today}`
      );
    }

  } catch (err) {
    console.error('[ProactiveAlerts] Error running checks:', err);
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '?';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

/**
 * Hook to run proactive alert checks periodically.
 * Only runs for admin and reception roles.
 * Mounts once in MainLayout.
 */
export function useProactiveAlerts() {
  const { session } = useAuth();
  const { currentRole } = useAppRole();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Depend on the user id, not the session object — the session reference
  // changes on every token refresh and would re-arm the immediate check.
  const userId = session?.user?.id;

  useEffect(() => {
    // Only run for admin/reception
    if (!userId || (currentRole !== 'admin' && currentRole !== 'reception')) {
      return;
    }

    // Run immediately on mount (with small delay to not block render)
    const initialTimer = setTimeout(() => {
      runProactiveChecks();
    }, 5000);

    // Then run every 10 minutes
    intervalRef.current = setInterval(runProactiveChecks, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, currentRole]);
}
