-- ════════════════════════════════════════════════════════════════════
-- Backfill del vehículo del huésped desde sus reservas
--
-- El alta de reserva guardaba el vehículo en bookings pero nunca lo
-- copiaba a guests, así que la ficha del huésped mostraba "Sin vehículo
-- registrado" aunque en la reserva figurara el auto y la patente.
-- El código ya lo escribe en las dos tablas; esto recupera lo cargado
-- antes del arreglo.
--
-- Solo toca huéspedes que HOY no tienen vehículo: nunca pisa un dato
-- cargado a mano. Si tiene varias reservas con auto, gana la más nueva.
-- ════════════════════════════════════════════════════════════════════

UPDATE public.guests g
SET has_vehicle = TRUE,
    vehicle_description = COALESCE(g.vehicle_description, b.vehicle_description),
    license_plate = COALESCE(g.license_plate, b.license_plate)
FROM (
    SELECT DISTINCT ON (guest_id)
        guest_id, vehicle_description, license_plate
    FROM public.bookings
    WHERE has_vehicle IS TRUE
    ORDER BY guest_id, created_at DESC
) b
WHERE g.id = b.guest_id
  AND COALESCE(g.has_vehicle, FALSE) = FALSE;
