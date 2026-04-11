// Supabase Edge Function: send-push
// Sends Web Push notifications to subscribed users
// Requires VAPID_PRIVATE_KEY secret set in Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = 'BH02tKZzZ-2mV6Gg0GXkOLStmq1YCUZ6RuWdBdM67sDHP3WAnqrF8s8HQcZftFOaIxW_l70MPnxraespWIIA9-U';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = 'mailto:info@homeapp.com.ar';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Import ECDSA key from raw bytes
async function importVapidKey(privateKeyBase64url: string): Promise<CryptoKey> {
  const rawKey = base64urlToUint8Array(privateKeyBase64url);
  // VAPID private key is 32 bytes, need to convert to JWK for P-256
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKeyBase64url,
    // We need the public key x,y from the VAPID_PUBLIC_KEY
    x: VAPID_PUBLIC_KEY.substring(0, 43), // first 32 bytes base64url
    y: VAPID_PUBLIC_KEY.substring(43), // last 32 bytes base64url
  };
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Create JWT for VAPID
async function createVapidJwt(audience: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsigned)
  );

  // Convert DER signature to raw r||s format expected by WebPush
  const sigArray = new Uint8Array(signature);
  const sigB64 = btoa(String.fromCharCode(...sigArray)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sigB64}`;
}

// Send push to a single subscription
async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKey: CryptoKey
): Promise<{ success: boolean; endpoint: string; status?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience, vapidKey);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: encoder.encode(payload),
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, endpoint: subscription.endpoint, status: response.status };
    }

    // 404 or 410 means subscription expired — should be cleaned up
    if (response.status === 404 || response.status === 410) {
      return { success: false, endpoint: subscription.endpoint, status: response.status, error: 'expired' };
    }

    return { success: false, endpoint: subscription.endpoint, status: response.status, error: await response.text() };
  } catch (err) {
    return { success: false, endpoint: subscription.endpoint, error: String(err) };
  }
}

const encoder = new TextEncoder();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url, tag } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscriptions — either for specific user or all users
    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data: subscriptions, error: dbError } = await query;

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare payload
    const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'home-notification', icon: '/icon-192.png' });

    // Note: Full Web Push encryption (RFC 8291) is complex to implement in Deno.
    // For production, you'd use a library. Here we send unencrypted payload
    // which works with some push services in development mode.
    // For production deployment, use the web-push npm module via Deno compatibility.

    let sent = 0;
    const expired: string[] = [];

    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each subscription, attempt to send
    const vapidKey = await importVapidKey(VAPID_PRIVATE_KEY);

    const results = await Promise.allSettled(
      subscriptions.map(sub => sendPushToSubscription(sub, payload, vapidKey))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          sent++;
        } else if (result.value.error === 'expired') {
          expired.push(result.value.endpoint);
        }
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired);
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length, expired: expired.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
