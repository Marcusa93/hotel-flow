import { describe, it, expect } from 'vitest';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';

// The Monto field shows an es-AR grouped string while the form keeps a number.

describe('formatPesosInput', () => {
    it('groups thousands the Argentine way', () => {
        expect(formatPesosInput(160000)).toBe('160.000');
        expect(formatPesosInput(1500)).toBe('1.500');
        expect(formatPesosInput(999)).toBe('999');
    });

    it('shows cents only when there are any, padded to two digits', () => {
        expect(formatPesosInput(160000)).toBe('160.000');
        expect(formatPesosInput(1500.5)).toBe('1.500,50');
        expect(formatPesosInput(1500.25)).toBe('1.500,25');
    });

    it('renders an empty field for zero and missing values', () => {
        expect(formatPesosInput(0)).toBe('');
        expect(formatPesosInput(null)).toBe('');
        expect(formatPesosInput(undefined)).toBe('');
        expect(formatPesosInput(NaN)).toBe('');
    });
});

describe('parsePesosInput', () => {
    it('groups digits as they are typed', () => {
        expect(parsePesosInput('160000')).toEqual({ display: '160.000', value: 160000 });
        expect(parsePesosInput('1')).toEqual({ display: '1', value: 1 });
    });

    it('ignores characters that are not digits', () => {
        expect(parsePesosInput('$160.000')).toEqual({ display: '160.000', value: 160000 });
        expect(parsePesosInput('abc50')).toEqual({ display: '50', value: 50 });
    });

    it('keeps a comma the user is still typing', () => {
        // Without this the decimal separator gets swallowed mid-keystroke.
        expect(parsePesosInput('1500,')).toEqual({ display: '1.500,', value: 1500 });
        expect(parsePesosInput('1500,5')).toEqual({ display: '1.500,5', value: 1500.5 });
    });

    it('allows at most one comma and two decimals', () => {
        expect(parsePesosInput('15,00,99').display).toBe('1.500,99');
        expect(parsePesosInput('10,999').display).toBe('10,99');
    });

    it('drops leading zeros', () => {
        expect(parsePesosInput('007')).toEqual({ display: '7', value: 7 });
    });

    it('returns an empty field when everything is erased', () => {
        expect(parsePesosInput('')).toEqual({ display: '', value: 0 });
    });
});
