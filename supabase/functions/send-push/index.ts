import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import webpush from 'npm:web-push@3.6.7';

/**
 * Envoie des notifications push, appelée par les déclencheurs de la base (sans JWT : l'identifiant
 * aléatoire n'est utilisable qu'une fois et seulement dans les 10 minutes suivant sa création).
 *  - `notification_id` : notification d'un membre de l'équipe → ses appareils.
 *  - `event_id`        : étape d'un transfert → les téléphones des clients qui suivent ce transfert.
 */
const pageFor = (type: string | null) => {
  if (type === 'reservation') return '/app/reservations';
  if (type === 'transfer') return '/app/transfers';
  return '/app/notifications';
};

const CLIENT_MESSAGES: Record<string, Record<string, string>> = {
  fr: {
    confirmed: 'Votre transfert est confirmé.',
    assigned: 'Un chauffeur est assigné à votre transfert.',
    en_route: 'Votre chauffeur est en route.',
    arrived: 'Votre chauffeur est arrivé et vous attend.',
    done: 'Transfert terminé. Merci de votre confiance !',
    cancelled: 'Votre transfert a été annulé.',
  },
  en: {
    confirmed: 'Your transfer is confirmed.',
    assigned: 'A driver has been assigned to your transfer.',
    en_route: 'Your driver is on the way.',
    arrived: 'Your driver has arrived and is waiting for you.',
    done: 'Transfer completed. Thank you for your trust!',
    cancelled: 'Your transfer has been cancelled.',
  },
};

type Device = { id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async request => {
  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) return Response.json({ skipped: 'Clés VAPID non configurées.' });

    const { notification_id: notificationId, event_id: eventId } = await request.json();
    if (typeof notificationId !== 'string' && typeof eventId !== 'string') return Response.json({ error: 'Identifiant manquant.' }, { status: 400 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@fima-auto.example', publicKey, privateKey);

    /** Envoie `payload` à chaque appareil ; retire ceux qui sont désinscrits ou expirés. */
    const deliver = async (devices: Device[], table: string, payload: (device: Device) => string) => {
      let sent = 0;
      for (const device of devices) {
        try {
          await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload(device), { TTL: 3600 });
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await admin.from(table).delete().eq('id', device.id);
        }
      }
      return sent;
    };

    if (typeof eventId === 'string') {
      const { data: event } = await admin
        .from('transfer_events')
        .update({ push_sent_at: new Date().toISOString() })
        .eq('id', eventId)
        .is('push_sent_at', null)
        .gte('created_at', recent)
        .select('transfer_id,status')
        .maybeSingle();
      if (!event) return Response.json({ skipped: 'Déjà envoyée ou expirée.' });
      const { data: transfer } = await admin.from('transfer_requests').select('reference').eq('id', event.transfer_id).maybeSingle();
      const { data: devices } = await admin.from('transfer_push_subscriptions').select('id,endpoint,p256dh,auth,lang').eq('transfer_id', event.transfer_id);
      if (!transfer) return Response.json({ skipped: 'Transfert introuvable.' });
      const langOf = new Map((devices ?? []).map(device => [device.id, device.lang as string]));
      const sent = await deliver((devices ?? []) as Device[], 'transfer_push_subscriptions', device => {
        const lang = langOf.get(device.id) === 'en' ? 'en' : 'fr';
        return JSON.stringify({
          title: `${lang === 'en' ? 'Transfer' : 'Transfert'} ${transfer.reference}`,
          body: CLIENT_MESSAGES[lang][event.status] ?? transfer.reference,
          url: `${lang === 'en' ? '/en' : ''}/suivi-transfert?ref=${transfer.reference}`,
        });
      });
      return Response.json({ sent });
    }

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
    const payload = JSON.stringify({ title: notification.title, body: notification.message, url: pageFor(notification.entity_type) });
    return Response.json({ sent: await deliver((devices ?? []) as Device[], 'push_subscriptions', () => payload) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 500 });
  }
});
