import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

/** Componente que revienta con el error que le pasen */
const Boom = ({ error }: { error: Error }) => {
    throw error;
};

const staleChunkError = () =>
    new TypeError('Failed to fetch dynamically imported module: https://homeapp.com.ar/assets/Bookings-abc123.js');

const realBug = () => new TypeError("Cannot read properties of undefined (reading 'map')");

describe('ErrorBoundary', () => {
    let reload: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        sessionStorage.clear();
        reload = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, reload, href: '/' },
        });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('recarga sola cuando el deploy dejó vencido el código de una sección', () => {
        render(<ErrorBoundary><Boom error={staleChunkError()} /></ErrorBoundary>);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('no recarga dos veces seguidas: si recargar no alcanzó, muestra el error', () => {
        // Simula que ya hubo un auto-refresco hace un instante
        sessionStorage.setItem('chunk-reload-at', String(Date.now()));

        render(<ErrorBoundary><Boom error={staleChunkError()} /></ErrorBoundary>);

        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByText('Hay una versión nueva')).toBeInTheDocument();
    });

    it('vuelve a permitir el refresco pasada la ventana de enfriamiento', () => {
        sessionStorage.setItem('chunk-reload-at', String(Date.now() - 60_000));
        render(<ErrorBoundary><Boom error={staleChunkError()} /></ErrorBoundary>);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('un error real no dispara recargas — eso sería un bucle infinito', () => {
        render(<ErrorBoundary><Boom error={realBug()} /></ErrorBoundary>);

        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    });

    it('renderiza los hijos cuando no hay error', () => {
        render(<ErrorBoundary><p>contenido</p></ErrorBoundary>);
        expect(screen.getByText('contenido')).toBeInTheDocument();
        expect(reload).not.toHaveBeenCalled();
    });
});
