import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;

const SW_URL = '/sw.js';

/** Clé publique du serveur d'alertes (publique par nature ; la clé privée reste dans les secrets Supabase). */
const vapidKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PushState = 'unsupported' | 'needs-install' | 'not-configured' | 'denied' | 'off' | 'on';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function toKey(base64Url: string) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SW_URL)) ?? navigator.serviceWorker.register(SW_URL);
}

/** Situation de cet appareil : alertes impossibles, à installer d'abord (iPhone), refusées, désactivées ou actives. */
export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // L'iPhone n'expose les notifications qu'une fois le site ajouté à l'écran d'accueil.
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (!vapidKey()) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await existing?.pushManager.getSubscription();
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Demande l'autorisation, abonne l'appareil et l'enregistre pour l'utilisateur connecté. */
export async function enablePush(db: Db) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'Les notifications ont été refusées pour ce site. Autorisez-les dans les réglages du navigateur.' };
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey()) }));
  const json = subscription.toJSON();
  const { error } = await db.rpc('register_push_subscription', {
    target_endpoint: subscription.endpoint,
    target_p256dh: json.keys?.p256dh ?? '',
    target_auth: json.keys?.auth ?? '',
    target_user_agent: navigator.userAgent,
  });
  return { error: error ? error.message : null };
}

/** Retire cet appareil (abonnement du navigateur et ligne en base). */
export async function disablePush(db: Db) {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return { error: null };
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
  return { error: error ? error.message : null };
}
