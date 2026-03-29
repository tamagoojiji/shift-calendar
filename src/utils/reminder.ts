// リマインダー（通知）管理

export type ReminderTiming = 'prev22' | '60min' | '30min';

export interface ReminderEntry {
  eventId: string;      // DetailItem.id
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM
  content: string;
  timings: ReminderTiming[];  // 選択された通知タイミング
  notified: string[];   // 通知済みタグ一覧
}

export const TIMING_LABELS: Record<ReminderTiming, string> = {
  prev22: '前日22時',
  '60min': '1時間前',
  '30min': '30分前',
};

const STORAGE_KEY = 'shift_reminders';

// リマインダー一覧を取得
export function getReminders(): ReminderEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// リマインダー保存
function saveReminders(reminders: ReminderEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

// リマインダー追加・更新
export function setReminder(eventId: string, date: string, time: string, content: string, timings: ReminderTiming[]) {
  const reminders = getReminders();
  const idx = reminders.findIndex(r => r.eventId === eventId && r.date === date);
  if (idx >= 0) {
    reminders[idx].timings = timings;
    reminders[idx].time = time;
    reminders[idx].content = content;
  } else {
    reminders.push({ eventId, date, time, content, timings, notified: [] });
  }
  saveReminders(reminders);
}

// リマインダー削除
export function removeReminder(eventId: string, date: string) {
  const reminders = getReminders().filter(r => !(r.eventId === eventId && r.date === date));
  saveReminders(reminders);
}

// リマインダー取得
export function getReminder(eventId: string, date: string): ReminderEntry | undefined {
  return getReminders().find(r => r.eventId === eventId && r.date === date);
}

// リマインダーがあるか確認
export function hasReminder(eventId: string, date: string): boolean {
  const r = getReminder(eventId, date);
  return !!r && r.timings.length > 0;
}

// 通知権限リクエスト
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Service Worker登録
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/shift-calendar/sw.js');
    } catch (e) {
      console.error('SW registration failed:', e);
    }
  }
}

// 通知チェック＆発火（定期実行用）
export async function checkAndFireReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const reminders = getReminders();
  let updated = false;

  for (const r of reminders) {
    if (!r.time) continue;

    const eventDate = new Date(`${r.date}T${r.time}:00`);
    if (isNaN(eventDate.getTime())) continue;

    const diffMs = eventDate.getTime() - now.getTime();
    const diffMin = diffMs / 60000;

    // 前日22時
    if (r.timings.includes('prev22')) {
      const prevDay22 = new Date(eventDate);
      prevDay22.setDate(prevDay22.getDate() - 1);
      prevDay22.setHours(22, 0, 0, 0);
      const tag = `prev22_${r.eventId}_${r.date}`;
      if (!r.notified.includes(tag) && now >= prevDay22 && diffMs > 0) {
        await showNotification('📅 明日の予定', `${r.time} ${r.content}`, tag);
        r.notified.push(tag);
        updated = true;
      }
    }

    // 1時間前
    if (r.timings.includes('60min')) {
      const tag = `60min_${r.eventId}_${r.date}`;
      if (!r.notified.includes(tag) && diffMin <= 60 && diffMin > 30) {
        await showNotification('⏰ 1時間前', `${r.time} ${r.content}`, tag);
        r.notified.push(tag);
        updated = true;
      }
    }

    // 30分前
    if (r.timings.includes('30min')) {
      const tag = `30min_${r.eventId}_${r.date}`;
      if (!r.notified.includes(tag) && diffMin <= 30 && diffMin > 0) {
        await showNotification('🔔 30分前', `${r.time} ${r.content}`, tag);
        r.notified.push(tag);
        updated = true;
      }
    }
  }

  // 過去のイベントを削除
  const cleaned = reminders.filter(r => {
    if (!r.time) return true;
    const eventDate = new Date(`${r.date}T${r.time}:00`);
    return eventDate.getTime() > now.getTime();
  });

  if (updated || cleaned.length !== reminders.length) {
    saveReminders(cleaned);
  }
}

// 通知表示
async function showNotification(title: string, body: string, tag: string) {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
  } catch {
    new Notification(title, { body, tag });
  }
}
