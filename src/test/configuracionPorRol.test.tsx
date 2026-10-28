import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { UserRole } from '@/types/hotel';

// Limpieza entra a Configuración por una sola cosa: el interruptor de las
// notificaciones push, que es lo que hace sonar su teléfono cuando le asignan
// una habitación. Vivía detrás de una pantalla que su rol no podía abrir, así
// que el aviso nunca le llegaba. Lo que se prueba acá es que entre, que caiga
// derecho en lo suyo, y que no vea el resto.

let rol: UserRole = 'admin';

vi.mock('@/context/AppRoleContext', () => ({ useAppRole: () => ({ currentRole: rol }) }));
vi.mock('@/hooks/useHotelSettings', () => ({
    useHotelSettings: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('@/hooks/useUpdateHotelSettings', () => ({
    useUpdateHotelSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/usePushNotifications', () => ({
    usePushNotifications: () => ({
        permission: 'default', isSubscribed: false, isSupported: true,
        subscribe: vi.fn(), unsubscribe: vi.fn(), isLoading: false,
    }),
}));

const { default: Settings } = await import('@/pages/Settings');

const pintar = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><Settings /></MemoryRouter>
    </QueryClientProvider>,
);

const pestaña = (nombre: RegExp) => screen.queryByRole('tab', { name: nombre });

beforeEach(() => { rol = 'admin'; });

describe('Configuración según el rol', () => {
    it('limpieza ve sólo lo suyo', () => {
        rol = 'housekeeping';
        pintar();

        expect(pestaña(/notificaciones/i)).toBeInTheDocument();
        expect(pestaña(/apariencia/i)).toBeInTheDocument();

        expect(pestaña(/hotel/i)).not.toBeInTheDocument();
        expect(pestaña(/roles/i)).not.toBeInTheDocument();
        expect(pestaña(/usuarios/i)).not.toBeInTheDocument();
    });

    it('y entra parada en Notificaciones, que es a lo que viene', () => {
        rol = 'housekeeping';
        pintar();

        expect(pestaña(/notificaciones/i)).toHaveAttribute('data-state', 'active');
    });

    it('el admin sigue viendo todo', () => {
        pintar();

        for (const p of [/hotel/i, /notificaciones/i, /roles/i, /usuarios/i, /apariencia/i]) {
            expect(pestaña(p)).toBeInTheDocument();
        }
    });

    it('recepción ve todo menos usuarios', () => {
        rol = 'reception';
        pintar();

        expect(pestaña(/hotel/i)).toBeInTheDocument();
        expect(pestaña(/roles/i)).toBeInTheDocument();
        expect(pestaña(/usuarios/i)).not.toBeInTheDocument();
    });
});
