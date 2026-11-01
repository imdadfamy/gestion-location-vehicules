import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import webpush from 'npm:web-push@3.6.7';

/**
 * Envoie sur les appareils d'un utilisateur la notification qui vient d'être créée pour lui.
 * Appelée par le déclencheur `notifications_push` (sans JWT : l'identifiant de notification, aléatoire,
 * n'est utilisable qu'une fois et seulement dans les 10 minutes suivant sa création).
 */
const pageFor = (type: string | null) => {
  if (type === 'reservation') return '/app/reservations';
  if (type === 'transfer') return '/app/transfers';
  return '/app/notifications';
};

Deno.serve(async request => {
  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) return Response.json({ skipped: 'Clés VAPID non configurées.' });

    const { notification_id: notificationId } = await request.json();
    if (typeof notificationId !== 'string') return Response.json({ error: 'Identifiant manquant.' }, { status: 400 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: notification } = await admin
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('push_sent_at', null)
      .gte('created_at', recent)
      .select('user_id,title,message,entity_type')
      .maybeSingle();
    if (!notification) return Response.json({ skipped: 'Déjà envoyée ou expirée.' });

    const { data: devices } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', notification.user_id);
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@fima-auto.example', publicKey, privateKey);
    const payload = JSON.stringify({ title: notification.title, body: notification.message, url: pageFor(notification.entity_type) });

    let sent = 0;
    for (const device of devices ?? []) {
      try {
        await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (error) {
        // Appareil désinscrit ou expiré : on le retire pour ne plus l'essayer.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', device.id);
      }
    }
    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 500 });
  }
});
