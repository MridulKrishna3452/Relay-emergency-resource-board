import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, ApiError } from '../api/client';
import type { RequestInput } from '../api/types';

/**
 * Offline outbox: new requests made while offline are stored in localStorage
 * and sent automatically when the browser comes back online.
 */
export interface QueuedRequest {
  tempId: string;
  queuedAt: string;
  userId: string;
  data: RequestInput;
}

const KEY = 'relay:outbox';
const listeners = new Set<() => void>();
let cache: QueuedRequest[] | null = null;

function read(): QueuedRequest[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    cache = [];
  }
  return cache!;
}

function write(items: QueuedRequest[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / disabled */
  }
  listeners.forEach((l) => l());
}

export function enqueueRequest(userId: string, data: RequestInput) {
  const item: QueuedRequest = { tempId: `offline-${Date.now()}`, queuedAt: new Date().toISOString(), userId, data };
  write([...read(), item]);
  return item;
}

export function useOutbox() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
  );
}

let syncing = false;

/**
 * Sends queued requests for the given user. Returns counts of sent/failed items.
 * Items rejected by validation are dropped (and reported) so they don't block the queue.
 */
export async function flushOutbox(userId: string): Promise<{ sent: number; dropped: string[] }> {
  if (syncing || !navigator.onLine) return { sent: 0, dropped: [] };
  syncing = true;
  let sent = 0;
  const dropped: string[] = [];
  try {
    for (const item of read().filter((i) => i.userId === userId)) {
      try {
        await api.createRequest(item.data);
        sent++;
        write(read().filter((i) => i.tempId !== item.tempId));
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
          dropped.push(`${item.data.title}: ${e.message}`);
          write(read().filter((i) => i.tempId !== item.tempId));
        } else {
          break; // still offline or server down: try again later
        }
      }
    }
  } finally {
    syncing = false;
  }
  return { sent, dropped };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
