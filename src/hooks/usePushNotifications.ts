import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Par VAPID del proyecto. La privada vive como secret en Supabase
// (VAPID_PRIVATE_KEY) y la usa la función send-push para firmar; esta pública
// tiene que ser la del MISMO par o el navegador se suscribe contra una firma
// que el servidor no puede generar.
const VAPID_PUBLIC_KEY = 'BD1HprL48j3X06HVSoNAkL3ANTG9ku9wgO4Hqg_autTO6TBrYK1MtNmq_-ElAn6-pvgcMKc4wXtO7M8ajCQYGtk';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * ¿Esta suscripción se creó con el par VAPID que usamos hoy?
 *
 * El navegador conserva las suscripciones viejas y las devuelve como válidas,
 * pero el servicio de push rechaza la firma con 403 si el par cambió. Sin este
 * chequeo el dispositivo queda mudo para siempre y la app igual dice
 * "notificaciones activadas".
 */
function matchesCurrentVapidKey(subscription: PushSubscription): boolean {
  const raw = subscription.options?.applicationServerKey;
  if (!raw) return false;

  const actual = new Uint8Array(raw);
  const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  if (actual.length !== expected.length) return false;

  return actual.every((byte, i) => byte === expected[i]);
}

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check current state on mount
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PushPermission);

    // Check if already subscribed.
    // Una suscripción de un par VAPID anterior existe pero está muerta: contarla
    // como activa deja el interruptor en "sí" mientras los push se pierden.
    // Mostrarla como inactiva hace que un toque la rehaga.
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub && matchesCurrentVapidKey(sub));
    });
  }, []);

  // Register service worker on first load
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || permission === 'unsupported') return false;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      // Una suscripción de un par VAPID anterior se reusaba tal cual y el push
      // se perdía en silencio. Se rehace: primero se borra la fila vieja (con su
      // endpoint, que está por cambiar) para no dejarla huérfana en la tabla.
      if (subscription && !matchesCurrentVapidKey(subscription)) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Save subscription to Supabase
      const subJson = subscription.toJSON();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

      if (error) {
        console.error('Error saving push subscription:', error);
        setLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      setLoading(false);
      return false;
    }
  }, [user, permission]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        // Remove from DB
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    isSupported: permission !== 'unsupported',
  };
}
