import { describe, it, expect } from 'vitest';
import { mapBooking, mapExpense, mapRate, mapInvoice, bookingToRow } from '@/lib/mappers';
import { formatLocalDate } from '@/lib/utils';

// DATE columns arrive from PostgREST as plain "YYYY-MM-DD" strings.
// Parsing them with new Date() would yield UTC midnight, which in any
// UTC- timezone (e.g. Argentina, UTC-3) displays as the PREVIOUS day.

describe('DATE column parsing (timezone safety)', () => {
    it('mapBooking parses check-in/check-out as local midnight', () => {
        const booking = mapBooking({
            id: '1',
            guest_id: 'g',
            room_id: 'r',
            check_in_date: '2026-07-15',
            check_out_date: '2026-07-18',
            adults: 2,
            children: 0,
            status: 'CONFIRMED',
            total_amount: 100,
            created_at: '2026-07-01T12:00:00Z',
        });
        expect(booking.checkInDate.getFullYear()).toBe(2026);
        expect(booking.checkInDate.getMonth()).toBe(6); // July
        expect(booking.checkInDate.getDate()).toBe(15); // NOT 14
        expect(booking.checkInDate.getHours()).toBe(0); // local midnight
        expect(booking.checkOutDate.getDate()).toBe(18);
    });

    it('mapExpense parses the expense date as local midnight', () => {
        const expense = mapExpense({
            id: '1',
            date: '2026-07-15',
            expense_type: 'SERVICES',
            amount: '1500.50',
            description: 'test',
            created_at: '2026-07-15T12:00:00Z',
        });
        expect(expense.date.getDate()).toBe(15);
        expect(expense.date.getHours()).toBe(0);
        expect(expense.amount).toBe(1500.5);
    });

    it('mapRate parses start/end dates as local midnight', () => {
        const rate = mapRate({
            id: '1',
            room_type_id: 'rt',
            start_date: '2026-01-01',
            end_date: '2026-01-31',
            price: 50000,
            label: 'Base',
            is_active: true,
        });
        expect(rate.startDate.getDate()).toBe(1);
        expect(rate.endDate.getDate()).toBe(31);
    });

    it('mapInvoice parses issue/due dates as local midnight', () => {
        const invoice = mapInvoice({
            id: '1',
            invoice_number: 'FAC-2026-00001',
            booking_id: 'b',
            guest_id: 'g',
            issue_date: '2026-07-15',
            due_date: '2026-07-30',
            status: 'DRAFT',
            subtotal: '100',
            tax_rate: '21',
            tax_amount: '21',
            total: '121',
        });
        expect(invoice.issueDate.getDate()).toBe(15);
        expect(invoice.dueDate?.getDate()).toBe(30);
    });
});

describe('DATE column writing (timezone safety)', () => {
    it('bookingToRow writes the local calendar day, not the UTC day', () => {
        // Local midnight — in UTC+ timezones toISOString() would move to the previous day
        const row = bookingToRow({
            checkInDate: new Date(2026, 6, 15, 0, 0, 0),
            checkOutDate: new Date(2026, 6, 18, 23, 59, 0),
        });
        expect(row.check_in_date).toBe('2026-07-15');
        expect(row.check_out_date).toBe('2026-07-18');
    });

    it('round-trips a booking date without shifting days', () => {
        const original = '2026-12-31';
        const booking = mapBooking({
            id: '1', guest_id: 'g', room_id: 'r',
            check_in_date: original, check_out_date: original,
            adults: 1, children: 0, status: 'CONFIRMED', total_amount: 0,
            created_at: '2026-01-01T00:00:00Z',
        });
        const row = bookingToRow({ checkInDate: booking.checkInDate });
        expect(row.check_in_date).toBe(original);
    });
});

describe('formatLocalDate', () => {
    it('formats using local calendar fields with zero padding', () => {
        expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(formatLocalDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    });
});
