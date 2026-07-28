import { describe, it, expect } from 'vitest';
import { getRoomCheckInWarning, checkInConfirmLabel } from '@/lib/roomReadiness';
import type { HousekeepingTask, Room, RoomStatus } from '@/types/hotel';

const habitacion = (status: RoomStatus): Room => ({
    id: 'r-501',
    roomNumber: '501',
    roomTypeId: 'rt-1',
    floor: 5,
    status,
});

const limpieza = (over: Partial<HousekeepingTask> = {}): HousekeepingTask => ({
    id: 't-1',
    roomId: 'r-501',
    date: new Date(2026, 6, 28),
    status: 'TODO',
    priority: 'CHECKOUT',
    ...over,
});

describe('getRoomCheckInWarning', () => {
    it('no avisa nada cuando la habitación está lista', () => {
        expect(getRoomCheckInWarning(habitacion('AVAILABLE'))).toBeNull();
    });

    it('avisa la habitación sucia sin bloquear', () => {
        // El caso que llegó de producción: la 501 estaba sin limpiar y el
        // check-in pasaba sin decir nada.
        const warning = getRoomCheckInWarning(habitacion('DIRTY'));

        expect(warning?.severity).toBe('warning');
        expect(warning?.message).toContain('501');
    });

    it('dice que la limpieza está en curso y quién la tiene', () => {
        const warning = getRoomCheckInWarning(habitacion('DIRTY'), [
            limpieza({ status: 'IN_PROGRESS', assignedTo: 'Ana' }),
        ]);

        expect(warning?.title).toBe('Habitación en limpieza');
        expect(warning?.message).toContain('Ana');
    });

    it('avisa igual si alguien marcó la habitación disponible con la limpieza abierta', () => {
        // Pasa cuando la habitación se marca limpia desde Habitaciones y la tarea
        // del tablero queda viva: la mucama sigue adentro.
        const warning = getRoomCheckInWarning(habitacion('AVAILABLE'), [
            limpieza({ status: 'IN_PROGRESS' }),
        ]);

        expect(warning?.title).toBe('Habitación en limpieza');
    });

    it('la limpieza terminada no genera aviso', () => {
        expect(
            getRoomCheckInWarning(habitacion('AVAILABLE'), [limpieza({ status: 'DONE' })])
        ).toBeNull();
    });

    it('ignora las limpiezas de otras habitaciones', () => {
        expect(
            getRoomCheckInWarning(habitacion('AVAILABLE'), [
                limpieza({ roomId: 'r-502', status: 'IN_PROGRESS' }),
            ])
        ).toBeNull();
    });

    it('trata mantenimiento, fuera de servicio y ocupada como aviso fuerte', () => {
        for (const status of ['MAINTENANCE', 'OUT_OF_ORDER', 'OCCUPIED'] as const) {
            expect(getRoomCheckInWarning(habitacion(status))?.severity).toBe('critical');
        }
    });

    it('sin habitación no inventa un aviso', () => {
        expect(getRoomCheckInWarning(undefined)).toBeNull();
    });
});

describe('checkInConfirmLabel', () => {
    it('avisa en el botón que el check-in sigue igual', () => {
        expect(checkInConfirmLabel(getRoomCheckInWarning(habitacion('DIRTY')))).toBe(
            'Check-in de todas formas'
        );
        expect(checkInConfirmLabel(null)).toBe('Confirmar Check-in');
    });
});
