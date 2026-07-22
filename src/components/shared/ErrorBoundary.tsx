import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** Optional fallback to render. If omitted, uses the default error card. */
    fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/** Momento del último auto-refresco, para no entrar en un bucle de recargas */
const RELOAD_KEY = 'chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * ¿El error es que no se pudo bajar el código de una sección?
 *
 * Cada página se carga con lazy(), y Vite le pone un hash al nombre del archivo.
 * Al desplegar, los archivos se regeneran con hashes nuevos y los viejos
 * desaparecen. Quien tenía la app abierta sigue con el HTML anterior en memoria,
 * que apunta a nombres que ya no existen: entrar a una sección que todavía no
 * había visitado da 404. No es un error de la app, es una versión vencida.
 */
const isStaleChunkError = (error: Error): boolean =>
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i
        .test(`${error?.name} ${error?.message}`);

/** Un solo intento por ventana: si recargar tampoco alcanza, mostrar el error. */
const canAutoReload = (): boolean => {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        return Date.now() - last > RELOAD_COOLDOWN_MS;
    } catch {
        // Modo incógnito o storage bloqueado: mejor no recargar a ciegas
        return false;
    }
};

/**
 * Catches unhandled errors from its children and shows a graceful fallback
 * instead of letting a rendering exception nuke the entire app.
 *
 * Class component because React's official error-boundary API only exists
 * on classes (componentDidCatch / getDerivedStateFromError).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Una versión vencida se arregla sola trayendo el HTML nuevo, que apunta
        // a los archivos correctos. Reintentar sin recargar no sirve: React
        // cachea la promesa rechazada y vuelve a fallar con el mismo archivo.
        if (isStaleChunkError(error) && canAutoReload()) {
            try {
                sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
            } catch {
                // sin storage no se puede llevar la cuenta, pero recargar igual sirve
            }
            window.location.reload();
            return;
        }

        // Best-effort telemetry — keep console noise low in production.
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    reset = () => {
        // Un chunk vencido no se recupera reintentando el render: hay que volver
        // a pedir el HTML.
        if (this.state.error && isStaleChunkError(this.state.error)) {
            window.location.reload();
            return;
        }
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        if (this.props.fallback) {
            return this.props.fallback(error, this.reset);
        }

        // Una versión vencida no es una falla: alcanza con recargar. Decir "algo
        // salió mal" asusta al recepcionista en el mostrador por nada.
        const isStale = isStaleChunkError(error);

        return (
            <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
                <div className="max-w-md w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-lg p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {isStale ? 'Hay una versión nueva' : 'Algo salió mal'}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {isStale
                            ? 'La aplicación se actualizó mientras la tenías abierta. Recargá para seguir; no se perdió nada de lo que guardaste.'
                            : 'Ocurrió un error inesperado. Podés reintentar o volver al inicio.'}
                    </p>
                    {import.meta.env.DEV && (
                        <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-900/5 dark:bg-slate-100/5 p-3 text-left text-[11px] text-slate-600 dark:text-slate-400">
                            {error.message}
                        </pre>
                    )}
                    <div className="mt-6 flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={this.reset}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {isStale ? 'Recargar' : 'Reintentar'}
                        </Button>
                        <Button size="sm" onClick={() => { window.location.href = '/'; }}>
                            <Home className="w-4 h-4 mr-2" />
                            Volver al inicio
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
