import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInDays } from 'date-fns';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { useRates } from '@/hooks/useRates';
import {
  getOccupancyPricing,
  bookingDiscountRatio,
  resolveCheckInTotal,
} from '@/lib/occupancyPricing';
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
  const { data: rates = [] } = useRates();
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

  // La promoción de la reserva, para reaplicarla sobre el tramo nuevo en vez de
  // escalarla por proporción (hay promos de precio plano que no son proporcionales).
  const promo = booking?.rateId ? rates.find(r => r.id === booking.rateId) ?? null : null;

  const newTotal =
    pricing && bookedPricing
      ? resolveCheckInTotal({
          agreedTotal: currentTotal,
          nights,
          tierNightly: pricing.nightlyPrice,
          bookedTierNightly: bookedPricing.nightlyPrice,
          promo,
          discountRatio: bookingDiscountRatio(booking ?? {}),
        })
      : currentTotal;

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

  /**
   * Vuelve a lo que dice la reserva. El diálogo de BookingDetail no se desmonta
   * al cerrarse, así que sin esto lo que se tanteó con los +/- y se descartó con
   * "Volver" seguía ahí la próxima vez que se abría, listo para cobrarse.
   */
  const reset = useCallback(() => setValue(initial), [initial]);

  return {
    value,
    setValue,
    reset,
    pricing,
    nights,
    currentTotal,
    newTotal,
    hasChanged,
    maxGuests: roomType?.maxGuests,
    persist,
  };
}
