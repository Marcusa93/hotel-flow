import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface ErrorToastOptions {
    title?: string;
    description?: string;
    /** If provided, a "Reintentar" action is rendered on the toast. */
    onRetry?: () => void;
    /** Custom label for the retry button. */
    retryLabel?: string;
}

/**
 * Standardized destructive toast. When `onRetry` is set, the toast includes
 * a "Reintentar" button so the user can re-run the failed action without
 * navigating back to it. Keeps error UX consistent across the app.
 */
export function errorToast({
    title = 'Error',
    description = 'La acción no pudo completarse.',
    onRetry,
    retryLabel = 'Reintentar',
}: ErrorToastOptions = {}) {
    toast({
        variant: 'destructive',
        title,
        description,
        action: onRetry ? (
            <ToastAction altText={retryLabel} onClick={onRetry}>
                {retryLabel}
            </ToastAction>
        ) : undefined,
    });
}

/**
 * Convenience: wraps an async function so that, on failure, a retry toast
 * is shown referencing the same action. Returns the result of `fn` on
 * success, or undefined on failure (the retry is the user-facing recovery).
 */
export async function runWithRetryToast<T>(
    fn: () => Promise<T>,
    options: Omit<ErrorToastOptions, 'onRetry'> & { onRetry?: () => void }
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (err) {
        const description = options.description
            ?? (err instanceof Error ? err.message : 'La acción no pudo completarse.');
        errorToast({
            ...options,
            description,
            onRetry: options.onRetry ?? (() => void runWithRetryToast(fn, options)),
        });
        return undefined;
    }
}
