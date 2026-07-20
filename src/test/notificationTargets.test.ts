import { describe, it, expect } from 'vitest';
import { targetRolesForCategory } from '@/hooks/useCreateNotification';

// Every notification used to broadcast to admin+reception, so cleaning notices
// reached everyone except the people who clean.

describe('targetRolesForCategory', () => {
    it('sends cleaning notices to housekeeping', () => {
        expect(targetRolesForCategory('housekeeping')).toContain('housekeeping');
    });

    it('keeps front-desk categories with reception', () => {
        for (const category of ['booking', 'payment', 'checkin', 'checkout'] as const) {
            expect(targetRolesForCategory(category)).toContain('reception');
        }
    });

    it('does not copy front-desk noise to housekeeping', () => {
        expect(targetRolesForCategory('payment')).not.toContain('housekeeping');
        expect(targetRolesForCategory('booking')).not.toContain('housekeeping');
    });

    it('always includes admin', () => {
        for (const category of ['housekeeping', 'booking', 'payment', 'checkin', 'checkout', 'promotion', 'system'] as const) {
            expect(targetRolesForCategory(category)).toContain('admin');
        }
    });
});
