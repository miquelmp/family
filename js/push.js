// Activació dels avisos en aquest mòbil.

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const toBytes = (base64Url) =>
  Uint8Array.from(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
    char.charCodeAt(0),
  );

export async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Demana permís i registra el mòbil. Retorna null si la persona no dona permís. */
export async function subscribeToPush(publicKey) {
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toBytes(publicKey),
  });
}

/**
 * Treu del tauler del mòbil les notificacions ja llegides a l'app,
 * i ajusta el número de la icona.
 */
export async function syncNotifications(unreadTags) {
  if ('setAppBadge' in navigator) {
    await navigator.setAppBadge(unreadTags.length).catch(() => {});
  }
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const shown = await registration.getNotifications();
  for (const notification of shown) {
    if (!unreadTags.includes(notification.tag)) notification.close();
  }
}

export function subscriptionRow(subscription, memberId) {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint, member_id: memberId, p256dh: keys.p256dh, auth: keys.auth };
}
