import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// El mail de recuperación de Supabase no pide contraseña nueva: crea una sesión
// y suelta al usuario adentro. Lo que se prueba acá es que la app lo frene y le
// haga elegir una, porque si no entra igual y la sigue sin saber.

let auth = {
    session: { user: { id: 'u1' } },
    loading: false,
    passwordRecovery: false,
    clearPasswordRecovery: vi.fn(),
    signOut: vi.fn(),
};
let rol = { mustChangePassword: false, profileLoading: false };

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/context/AppRoleContext', () => ({ useAppRole: () => rol }));
vi.mock('@/hooks/useAdminUsers', () => ({
    useCompletePasswordChange: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { ProtectedRoute } = await import('@/components/auth/ProtectedRoute');

const pintar = () => render(
    <MemoryRouter>
        <ProtectedRoute><div>la app</div></ProtectedRoute>
    </MemoryRouter>,
);

beforeEach(() => {
    auth = { ...auth, passwordRecovery: false, loading: false, session: { user: { id: 'u1' } } };
    rol = { mustChangePassword: false, profileLoading: false };
});

describe('volver a entrar después de olvidar la contraseña', () => {
    it('el que llega por el mail de recuperación no entra hasta elegir una nueva', () => {
        auth = { ...auth, passwordRecovery: true };
        pintar();

        expect(screen.getByText('Elegí tu contraseña')).toBeInTheDocument();
        expect(screen.getByText(/mail de recuperación/i)).toBeInTheDocument();
        expect(screen.queryByText('la app')).not.toBeInTheDocument();
    });

    it('la cuenta con contraseña temporal sigue bloqueada igual que antes', () => {
        rol = { mustChangePassword: true, profileLoading: false };
        pintar();

        expect(screen.getByText('Elegí tu contraseña')).toBeInTheDocument();
        // Y le habla de su caso, no del mail: son dos situaciones distintas.
        expect(screen.getByText(/creada por un administrador/i)).toBeInTheDocument();
        expect(screen.queryByText('la app')).not.toBeInTheDocument();
    });

    it('con la contraseña ya elegida, la app se usa normal', () => {
        pintar();

        expect(screen.getByText('la app')).toBeInTheDocument();
        expect(screen.queryByText('Elegí tu contraseña')).not.toBeInTheDocument();
    });

    it('la recuperación manda aunque el perfil todavía esté cargando', () => {
        // profileLoading apaga el chequeo de la contraseña temporal. Si la
        // recuperación dependiera de eso, el link dejaría pasar mientras carga.
        auth = { ...auth, passwordRecovery: true };
        rol = { mustChangePassword: false, profileLoading: true };
        pintar();

        expect(screen.getByText('Elegí tu contraseña')).toBeInTheDocument();
        expect(screen.queryByText('la app')).not.toBeInTheDocument();
    });
});
