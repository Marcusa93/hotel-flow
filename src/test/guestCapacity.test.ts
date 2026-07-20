import { describe, it, expect } from 'vitest';

// react-hook-form's watch() returns the raw input value, and <Input type="number">
// hands back a string. z.coerce.number() only runs at validation time, so the
// booking dialogs must coerce before doing arithmetic — otherwise "2" + "0"
// concatenates into "20" and triggers a bogus "capacidad excedida" warning.

/** Mirrors the coercion applied in NewBookingDialog / EditBookingDialog. */
const watchedNumber = (raw: unknown): number => Number(raw) || 0;

const totalGuests = (adults: unknown, children: unknown): number =>
    watchedNumber(adults) + watchedNumber(children);

describe('guest count from number inputs', () => {
    it('adds string values numerically instead of concatenating', () => {
        expect(totalGuests('2', '0')).toBe(2);
        expect(totalGuests('3', '1')).toBe(4);
        expect(totalGuests('1', '2')).toBe(3);
    });

    it('does not flag over-capacity for a party that fits', () => {
        const maxGuests = 4;
        expect(totalGuests('2', '0') > maxGuests).toBe(false);
        expect(totalGuests('4', '0') > maxGuests).toBe(false);
    });

    it('still flags a genuine over-capacity party', () => {
        const maxGuests = 4;
        expect(totalGuests('4', '2') > maxGuests).toBe(true);
    });

    it('treats empty and missing values as zero', () => {
        expect(totalGuests('', '')).toBe(0);
        expect(totalGuests(undefined, undefined)).toBe(0);
        expect(totalGuests('2', '')).toBe(2);
    });

    it('compares equal to the numeric value stored on the booking', () => {
        // "2" !== 2 made the edit dialog report Adultos as changed on every render.
        expect(watchedNumber('2')).toBe(2);
        expect(watchedNumber('2') !== 2).toBe(false);
    });
});
