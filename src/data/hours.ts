// 営業時間データ（tamago-park-appから動的fetch）
const DATA_URL = 'https://park.tamago-ai-world.com/data/park-hours.json';

let cachedHours: Record<string, string> | null = null;
let fetchPromise: Promise<Record<string, string>> | null = null;

export async function fetchParkHours(): Promise<Record<string, string>> {
  if (cachedHours) return cachedHours;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(DATA_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      return res.json();
    })
    .then(data => {
      cachedHours = data;
      return data;
    })
    .catch(err => {
      console.error('Failed to load park hours:', err);
      fetchPromise = null;
      return {};
    });

  return fetchPromise;
}

export function getParkHours(): Record<string, string> {
  return cachedHours || {};
}
