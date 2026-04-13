// Supabase Edge Function: send-push
// Sends Web Push notifications using the web-push library
// Requires secrets: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BH02tKZzZ-2mV6Gg0GXkOLStmq1YCUZ6RuWdBdM67sDHP3WAnqrF8s8HQcZftFOaIxW_l70MPnxraespWIIA9-U';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = 'mailto:info@homeapp.com.ar';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      tag: tag || 'home-notification',
      icon: '/icon-192.png',
    });

    let sent = 0;
    const expired: string[] = [];

    // Send to all subscriptions concurrently
    const results = await Promise.allSettled(
      subscriptions.map(sub => sendPushToSubscription(sub, payload))
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
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired);
      if (deleteError) {
        console.error('Failed to clean up expired subscriptions:', deleteError);
      }
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
