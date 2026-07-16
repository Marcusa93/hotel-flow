import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton React Query client.
 * Lives outside the React tree so non-component code (e.g. AuthContext.signOut)
 * can clear the cache when the user logs out.
 */
export const queryClient = new QueryClient();
