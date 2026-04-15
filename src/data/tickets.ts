// チケット価格データ（tamago-park-appから動的fetch）
const DATA_URL = 'https://park.tamago-ai-world.com/data/ticket-prices.json';

let cachedPrices: Record<string, number> | null = null;
let fetchPromise: Promise<Record<string, number>> | null = null;

export async function fetchTicketPrices(): Promise<Record<string, number>> {
  if (cachedPrices) return cachedPrices;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(DATA_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      return res.json();
    })
    .then(data => {
      cachedPrices = data;
      return data;
    })
    .catch(err => {
      console.error('Failed to load ticket prices:', err);
      fetchPromise = null;
      return {};
    });

  return fetchPromise;
}

export function getTicketPrices(): Record<string, number> {
  return cachedPrices || {};
}

// 価格帯の色分け用
export function getPriceLevel(price: number): 'low' | 'mid' | 'high' | 'peak' {
  if (price <= 8900) return 'low';
  if (price <= 9400) return 'mid';
  if (price <= 9900) return 'high';
  return 'peak';
}

// 価格フォーマット
export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`;
}

// カレンダーセル用短縮表示
export function formatPriceShort(price: number): string {
  return `${(price / 1000).toFixed(1)}k`;
}
