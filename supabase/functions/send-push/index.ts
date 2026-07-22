// Supabase Edge Function: send-push
// Sends Web Push notifications using the web-push library
// Requires secrets: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

// Sin fallback a propósito: tenía la pública de un par viejo hardcodeada, así
// que si el secret faltaba se firmaba con una clave que no era la del navegador
// y los push se perdían en silencio.
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = 'mailto:info@homeapp.com.ar';

// 8080 es el puerto del dev server (vite.config.ts): sin él los push nunca
// salen al probar en local, el navegador corta la respuesta por CORS.
const ALLOWED_ORIGINS = ['https://homeapp.com.ar', 'https://www.homeapp.com.ar', 'http://localhost:8080', 'http://localhost:4000', 'http://localhost:5173'];

function makeCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// Configure web-push with VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Send push to a single subscription
async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<{ success: boolean; endpoint: string; status?: number; error?: string }> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const result = await webpush.sendNotification(pushSubscription, payload, {
      TTL: 86400, // 24 hours
    });

    return { success: true, endpoint: subscription.endpoint, status: result.statusCode };
  } catch (err: any) {
    const statusCode = err.statusCode || 0;

    // 404 or 410 means subscription expired — should be cleaned up
    if (statusCode === 404 || statusCode === 410) {
      return { success: false, endpoint: subscription.endpoint, status: statusCode, error: 'expired' };
    }

    return {
      success: false,
      endpoint: subscription.endpoint,
      status: statusCode,
      error: err.body || String(err),
    };
  }
}

serve(async (req) => {
  const cors = makeCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { userId, targetRoles, excludeUserId, title, body, url, tag } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // A quién le llega: un usuario puntual, los que tienen ciertos roles, o
    // todos. Sin targetRoles un aviso de cobro le sonaba también al teléfono de
    // limpieza, que no tiene nada que hacer con eso.
    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (Array.isArray(targetRoles) && targetRoles.length > 0) {
      const { data: profiles, error: rolesError } = await supabase
        .from('profiles')
        .select('id')
        .in('role', targetRoles);

      if (rolesError) {
        return new Response(JSON.stringify({ error: rolesError.message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const ids = (profiles || []).map((p: { id: string }) => p.id);
      if (ids.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, total: 0, message: 'No users in target roles' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      query = query.in('user_id', ids);
    }

    const { data: allSubscriptions, error: dbError } = await query;

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Quien hizo la acción no necesita que le suene el teléfono por su propia
    // acción: acaba de hacerla y está mirando la pantalla.
    const subscriptions = excludeUserId
      ? (allSubscriptions || []).filter(s => s.user_id !== excludeUserId)
      : (allSubscriptions || []);

    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: 0, message: 'No subscriptions found' }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Prepare payload
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      tag: tag || 'home-notification',
      icon: '/icon-192.png',
    });

    let sent = 0;
    const expired: string[] = [];
    // Los rechazos del servicio de push se descartaban en silencio: la respuesta
    // decía sent:0 y no había forma de saber por qué. Un 403 acá es casi siempre
    // par VAPID que no coincide con el de la suscripción del navegador.
    const failures: { status: number; error: string }[] = [];

    // Send to all subscriptions concurrently
    const results = await Promise.allSettled(
      subscriptions.map(sub => sendPushToSubscription(sub, payload))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        failures.push({ status: 0, error: String(result.reason).slice(0, 300) });
        continue;
      }
      if (result.value.success) {
        sent++;
      } else if (result.value.error === 'expired') {
        expired.push(result.value.endpoint);
      } else {
        failures.push({
          status: result.value.status || 0,
          error: String(result.value.error || '').slice(0, 300),
        });
      }
    }

    // Sin el endpoint: es una URL-capacidad, quien la tenga puede notificar al
    // dispositivo. El status y el cuerpo del error alcanzan para diagnosticar.
    if (failures.length > 0) {
      console.error('[send-push] envíos rechazados:', JSON.stringify(failures));
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired);
      if (deleteError) {
        console.error('Failed to clean up expired subscriptions:', deleteError);
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        total: subscriptions.length,
        expired: expired.length,
        failed: failures.length,
        failures,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
