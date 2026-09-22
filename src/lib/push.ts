import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

export interface PushSubscriptionItem {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  subscribedAt: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

const dataDir = path.join(process.cwd(), 'data');
const vapidFilePath = path.join(dataDir, 'vapid.json');
const subscriptionsFilePath = path.join(dataDir, 'push_subscriptions.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Ottiene o genera automaticamente le chiavi VAPID.
 * Dà precedenza a variabili d'ambiente (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
 * In assenza, persiste chiavi auto-generate in /data/vapid.json.
 */
export function getVapidKeys(): { publicKey: string; privateKey: string } {
  const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate };
  }

  ensureDataDir();

  if (fs.existsSync(vapidFilePath)) {
    try {
      const raw = fs.readFileSync(vapidFilePath, 'utf-8');
      const keys = JSON.parse(raw);
      if (keys.publicKey && keys.privateKey) {
        return keys;
      }
    } catch {
      // Rigenera in caso di file corrotto
    }
  }

  // Genera nuova coppia VAPID
  const newKeys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(vapidFilePath, JSON.stringify(newKeys, null, 2), 'utf-8');
  } catch (err) {
    console.error('Errore scrittura chiavi VAPID in /data/vapid.json:', err);
  }

  return newKeys;
}

let isVapidConfigured = false;
function configureWebPush() {
  if (isVapidConfigured) return;
  const keys = getVapidKeys();
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@preventivi3d.local';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  isVapidConfigured = true;
}

/**
 * Ottiene tutte le sottoscrizioni push salvate
 */
export function getStoredSubscriptions(): PushSubscriptionItem[] {
  ensureDataDir();
  if (!fs.existsSync(subscriptionsFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(subscriptionsFilePath, 'utf-8');
    return JSON.parse(raw) as PushSubscriptionItem[];
  } catch {
    return [];
  }
}

/**
 * Salva una nuova sottoscrizione Push
 */
export function saveSubscription(sub: webpush.PushSubscription, userAgent?: string): boolean {
  ensureDataDir();
  const list = getStoredSubscriptions();
  const existsIndex = list.findIndex(item => item.endpoint === sub.endpoint);

  const item: PushSubscriptionItem = {
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    userAgent: userAgent || 'Browser Sconosciuto',
    subscribedAt: new Date().toISOString(),
  };

  if (existsIndex >= 0) {
    list[existsIndex] = item;
  } else {
    list.push(item);
  }

  fs.writeFileSync(subscriptionsFilePath, JSON.stringify(list, null, 2), 'utf-8');
  return true;
}

/**
 * Rimuove una sottoscrizione Push tramite endpoint
 */
export function removeSubscription(endpoint: string): boolean {
  ensureDataDir();
  const list = getStoredSubscriptions();
  const filtered = list.filter(item => item.endpoint !== endpoint);
  if (filtered.length !== list.length) {
    fs.writeFileSync(subscriptionsFilePath, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}

/**
 * Invia una notifica push a tutte le sottoscrizioni registrate
 */
export async function sendPushNotificationToAll(payload: PushPayload): Promise<{
  successCount: number;
  failureCount: number;
  total: number;
}> {
  configureWebPush();
  const list = getStoredSubscriptions();
  if (list.length === 0) {
    return { successCount: 0, failureCount: 0, total: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  const expiredEndpoints: string[] = [];

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/preventivi',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || `quote-${Date.now()}`,
  });

  await Promise.all(
    list.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          jsonPayload,
          {
            TTL: 86400, // 24 ore di vita della notifica se offline
            urgency: 'high',
          }
        );
        successCount++;
      } catch (err: unknown) {
        failureCount++;
        const webPushErr = err as { statusCode?: number };
        // 404 Not Found o 410 Gone indicano che la sottoscrizione è scaduta o revocata
        if (webPushErr.statusCode === 410 || webPushErr.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  // Pulisci automaticamente le sottoscrizioni scadute
  if (expiredEndpoints.length > 0) {
    const updated = list.filter(item => !expiredEndpoints.includes(item.endpoint));
    fs.writeFileSync(subscriptionsFilePath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  return {
    successCount,
    failureCount,
    total: list.length,
  };
}
