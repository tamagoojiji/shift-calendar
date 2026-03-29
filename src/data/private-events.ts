// 貸切イベントデータ（tamago-park-appから動的fetch）
export interface PrivateEvent {
  name: string;
  time: string;
}

const DATA_URL = 'https://tamagoojiji.github.io/tamago-park-app/data/private-events.json';

let cachedEvents: Record<string, PrivateEvent> | null = null;
let fetchPromise: Promise<Record<string, PrivateEvent>> | null = null;

export async function fetchPrivateEvents(): Promise<Record<string, PrivateEvent>> {
  if (cachedEvents) return cachedEvents;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(DATA_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      return res.json();
    })
    .then(data => {
      cachedEvents = data;
      return data;
    })
    .catch(err => {
      console.error('Failed to load private events:', err);
      fetchPromise = null;
      return {};
    });

  return fetchPromise;
}

export function getPrivateEvents(): Record<string, PrivateEvent> {
  return cachedEvents || {};
}

export function hasPrivateEvent(date: string): boolean {
  return date in getPrivateEvents();
}
