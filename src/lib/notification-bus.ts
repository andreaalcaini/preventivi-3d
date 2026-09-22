import { EventEmitter } from 'events';

export interface LabNotification {
  id: string;
  type: 'quote_request';
  title: string;
  projectName: string;
  clientName: string;
  clientContact: string;
  totalCalculated: number;
  material: string;
  timestamp: number;
  dateStr: string;
  trackingUrl: string;
}

// Global Singleton per preservare l'event bus durante l'hot-reloading o tra route
declare global {
  var __labNotificationEmitter: EventEmitter | undefined;
  var __labNotificationRecent: LabNotification[] | undefined;
}

const emitter = globalThis.__labNotificationEmitter || new EventEmitter();
globalThis.__labNotificationEmitter = emitter;
// Permette listener multipli senza warning
emitter.setMaxListeners(100);

const recentNotifications = globalThis.__labNotificationRecent || [];
globalThis.__labNotificationRecent = recentNotifications;

export function broadcastLabNotification(notification: Omit<LabNotification, 'id' | 'timestamp'>): LabNotification {
  const fullItem: LabNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  recentNotifications.unshift(fullItem);
  if (recentNotifications.length > 20) {
    recentNotifications.pop();
  }

  emitter.emit('notification', fullItem);
  return fullItem;
}

export function subscribeToLabNotifications(callback: (notification: LabNotification) => void) {
  emitter.on('notification', callback);
  return () => {
    emitter.off('notification', callback);
  };
}

export function getRecentLabNotifications(limit = 10): LabNotification[] {
  return recentNotifications.slice(0, limit);
}
