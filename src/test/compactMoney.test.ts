import { describe, it, expect } from 'vitest';
import { formatCompactMoney } from '@/lib/utils';

// Stat cards and chart axes abbreviate the amount. The whole point is reading
// the magnitude at a glance, so the unit has to step up past a million.

describe('formatCompactMoney', () => {
    it('steps up to millions instead of piling on thousands', () => {
        expect(formatCompactMoney(1603000)).toBe('$1,6M');
        expect(formatCompactMoney(12400000)).toBe('$12,4M');
    });

    it('drops the decimal when the millions are exact', () => {
        expect(formatCompactMoney(2000000)).toBe('$2M');
    });

    it('switches unit at the rounded value, not the raw one', () => {
        // 999.500 rounds to 1000 thousands: "$1000k" would defeat the purpose.
        expect(formatCompactMoney(999500)).toBe('$1M');
        expect(formatCompactMoney(999400)).toBe('$999k');
    });

    it('keeps thousands below a million', () => {
        expect(formatCompactMoney(84000)).toBe('$84k');
        expect(formatCompactMoney(1500)).toBe('$2k');
    });

    it('shows small amounts in full', () => {
        expect(formatCompactMoney(850)).toBe('$850');
        expect(formatCompactMoney(0)).toBe('$0');
    });

    it('keeps the sign on negatives and falls back to zero on junk', () => {
        expect(formatCompactMoney(-1603000)).toBe('-$1,6M');
        expect(formatCompactMoney(null)).toBe('$0');
        expect(formatCompactMoney(undefined)).toBe('$0');
        expect(formatCompactMoney(NaN)).toBe('$0');
    });
});
