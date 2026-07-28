import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInDays } from 'date-fns';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { getOccupancyPricing, bookingDiscountRatio } from '@/lib/occupancyPricing';
import type { Booking } from '@/types/hotel';
import type { CheckInOccupancyValue } from '@/components/bookings/CheckInOccupancy';

/**
 * La ocupación real del check-in y lo que sale cobrar por ella.
 *
 * Se toma con una cantidad de gente y a veces entra otra. Como acá el precio lo
 * define cuánta gente entra, corregirlo al ingreso es corregir la plata, así
 * que el total se rearma con la ocupación que quede confirmada.
 */
export function useCheckInOccupancy(booking: Booking | undefined | null) {
  const { rooms, roomTypes } = useRoomOperations();
  const updateBookingMutation = useUpdateBooking();

  const initial = useMemo<CheckInOccupancyValue>(
    () => ({
      adults: booking?.adults ?? 1,
      children: booking?.children ?? 0,
      infants: booking?.infants ?? 0,
    }),
    [booking?.adults, booking?.children, booking?.infants]
  );

  const [value, setValue] = useState<CheckInOccupancyValue>(initial);

  // Al abrir el diálogo con otra reserva, se arranca de lo que dice esa reserva
  // y no de lo que quedó tecleado en la anterior.
  useEffect(() => setValue(initial), [booking?.id, initial]);

  const room = rooms.find(r => r.id === booking?.roomId);
  const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);

  const nights = booking
    ? Math.max(0, differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)))
    : 0;

  const pricing = getOccupancyPricing(roomTypes, roomType, value);

  // El tramo con el que se tomó la reserva. Es el punto de comparación.
  const bookedPricing = getOccupancyPricing(roomTypes, roomType, {
    adults: booking?.adults ?? 0,
    children: booking?.children ?? 0,
  });

  const currentTotal = booking?.totalAmount ?? 0;

  // El total se mueve por la diferencia entre tramos, no se rearma desde la
  // tarifa de hoy. Si se recalculara de cero, una reserva tomada hace dos meses
  // cambiaría de precio sola al hacer el check-in porque la tarifa subió en el
  // medio: lo que se pactó se respeta, y solo se corrige lo que causó recepción.
  // El descuento que traía se aplica también a la diferencia.
  const nightlyDelta =
    pricing && bookedPricing ? pricing.nightlyPrice - bookedPricing.nightlyPrice : 0;
  const newTotal =
    currentTotal +
    Math.round(nights * nightlyDelta * (1 - bookingDiscountRatio(booking ?? {})));

  const hasChanged =
    !!booking &&
    (value.adults !== booking.adults ||
      value.children !== booking.children ||
      value.infants !== (booking.infants ?? 0) ||
      newTotal !== currentTotal);

  /** Guarda la ocupación y el total. No hace nada si nadie tocó nada. */
  const persist = useCallback(async () => {
    if (!booking || !hasChanged) return;
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      adults: value.adults,
      children: value.children,
      infants: value.infants,
      totalAmount: newTotal,
    });
  }, [booking, hasChanged, updateBookingMutation, value, newTotal]);

  return {
    value,
    setValue,
    pricing,
    nights,
    currentTotal,
    newTotal,
    hasChanged,
    maxGuests: roomType?.maxGuests,
    persist,
  };
}
