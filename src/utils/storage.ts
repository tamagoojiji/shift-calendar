import type { DayData, ClinicMonthData, Staff, DetailItem } from '../types';
import { saveShiftsToFirestore, saveClinicToFirestore, saveStaffToFirestore, saveFriendToFirestore, saveFriendShareToFirestore } from './firebase';

const STORAGE_KEYS = {
  shifts: 'shift_calendar_data',
  clinic: 'shift_clinic_data',
  staff: 'shift_staff_list',
  friend: 'friend_events_data',
};

export type SyncType = 'shifts' | 'clinic' | 'staff' | 'friend';

const UPDATED_AT_KEY = 'shift_sync_updated_at';

// type別の最終更新時刻（ローカル）
export function getLocalUpdatedAt(type: SyncType): number {
  try {
    const raw = localStorage.getItem(UPDATED_AT_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, unknown>;
    const v = map[type];
    return typeof v === 'number' ? v : 0;
  } catch {
    return 0;
  }
}

export function setLocalUpdatedAt(type: SyncType, ts: number = Date.now()): void {
  let map: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(UPDATED_AT_KEY);
    if (raw) map = JSON.parse(raw) || {};
  } catch {
    map = {};
  }
  map[type] = ts;
  localStorage.setItem(UPDATED_AT_KEY, JSON.stringify(map));
}

// 現在ログイン中のユーザーID
let currentUid: string | null = null;

export function setCurrentUid(uid: string | null) {
  currentUid = uid;
}

// 友達の予定の共有ID（設定されていれば共有モード）
const FRIEND_SHARE_ID_KEY = 'friend_share_id';

export function getFriendShareId(): string | null {
  return localStorage.getItem(FRIEND_SHARE_ID_KEY);
}

export function setFriendShareId(id: string | null): void {
  if (id) localStorage.setItem(FRIEND_SHARE_ID_KEY, id);
  else localStorage.removeItem(FRIEND_SHARE_ID_KEY);
}

const syncTimers: Partial<Record<SyncType, ReturnType<typeof setTimeout>>> = {};
const pendingSyncData: Partial<Record<SyncType, unknown>> = {};

async function runSync(type: SyncType, data: unknown) {
  const uid = currentUid;
  const shareId = type === 'friend' ? getFriendShareId() : null;
  if (!uid && !shareId) return;
  try {
    // undefinedフィールドを除去（Firestoreはundefinedを受け付けない）
    const clean = JSON.parse(JSON.stringify(data));
    const updatedAt = getLocalUpdatedAt(type);
    if (type === 'shifts' && uid) await saveShiftsToFirestore(uid, clean as Record<string, DayData>, updatedAt);
    else if (type === 'clinic' && uid) await saveClinicToFirestore(uid, clean as Record<string, ClinicMonthData>, updatedAt);
    else if (type === 'staff' && uid) await saveStaffToFirestore(uid, clean as Staff[], updatedAt);
    else if (type === 'friend') {
      if (shareId) await saveFriendShareToFirestore(shareId, clean as Record<string, DetailItem[]>, updatedAt);
      else if (uid) await saveFriendToFirestore(uid, clean as Record<string, DetailItem[]>, updatedAt);
    }
  } catch (err) {
    console.error('Firestore sync error:', err);
  }
}

// Firestoreへの非同期保存（バックグラウンド）
function syncToFirestore(type: SyncType, data: unknown) {
  if (!currentUid && !(type === 'friend' && getFriendShareId())) return;

  // デバウンス用
  if (syncTimers[type]) clearTimeout(syncTimers[type]);
  pendingSyncData[type] = data;
  syncTimers[type] = setTimeout(() => {
    delete syncTimers[type];
    const pending = pendingSyncData[type];
    delete pendingSyncData[type];
    void runSync(type, pending);
  }, 2000); // 2秒デバウンス
}

// 保留中のデバウンスを打ち切って即座に同期
export function flushPendingSync(): void {
  (Object.keys(syncTimers) as SyncType[]).forEach((type) => {
    const timer = syncTimers[type];
    if (timer) clearTimeout(timer);
    delete syncTimers[type];
    const pending = pendingSyncData[type];
    delete pendingSyncData[type];
    if (pending !== undefined) void runSync(type, pending);
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushPendingSync();
});
window.addEventListener('pagehide', () => {
  flushPendingSync();
});

// シフトデータ
export function loadShifts(): Record<string, DayData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.shifts);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveShifts(data: Record<string, DayData>): void {
  localStorage.setItem(STORAGE_KEYS.shifts, JSON.stringify(data));
  setLocalUpdatedAt('shifts');
  syncToFirestore('shifts', data);
}

export function getDay(date: string): DayData {
  const all = loadShifts();
  return all[date] || {
    date,
    dayShift: null,
    nightShift: null,
    nightTime: null,
    isOff: false,
    details: [],
  };
}

export function saveDay(day: DayData): void {
  const all = loadShifts();
  all[day.date] = day;
  saveShifts(all);
}

// 眼科カレンダー
export function loadClinicData(): Record<string, ClinicMonthData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clinic);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveClinicData(data: Record<string, ClinicMonthData>): void {
  localStorage.setItem(STORAGE_KEYS.clinic, JSON.stringify(data));
  setLocalUpdatedAt('clinic');
  syncToFirestore('clinic', data);
}

// スタッフ
export function loadStaff(): Staff[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.staff);
    return raw ? JSON.parse(raw) : [{ id: 'yotsuhashi', name: '四ツ橋' }];
  } catch {
    return [{ id: 'yotsuhashi', name: '四ツ橋' }];
  }
}

export function saveStaff(staff: Staff[]): void {
  localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(staff));
  setLocalUpdatedAt('staff');
  syncToFirestore('staff', staff);
}

// 削除履歴（直近10件）
export interface DeletedEvent {
  item: DetailItem;
  date: string;
  source: 'personal' | 'friend';
  deletedAt: number;
}

export function loadDeletedEvents(): DeletedEvent[] {
  try {
    const raw = localStorage.getItem('deleted_events');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedEvent(item: DetailItem, date: string, source: 'personal' | 'friend'): void {
  const list = loadDeletedEvents();
  list.unshift({ item, date, source, deletedAt: Date.now() });
  // 直近10件だけ保持
  localStorage.setItem('deleted_events', JSON.stringify(list.slice(0, 10)));
}

export function removeDeletedEvent(index: number): void {
  const list = loadDeletedEvents();
  list.splice(index, 1);
  localStorage.setItem('deleted_events', JSON.stringify(list));
}

// 友達の予定（個人イベントとは独立）
export function loadFriendEvents(): Record<string, DetailItem[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.friend);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveFriendEvents(data: Record<string, DetailItem[]>): void {
  localStorage.setItem(STORAGE_KEYS.friend, JSON.stringify(data));
  setLocalUpdatedAt('friend');
  syncToFirestore('friend', data);
}

export function getFriendDayEvents(date: string): DetailItem[] {
  const all = loadFriendEvents();
  return all[date] || [];
}

export function saveFriendDayEvents(date: string, events: DetailItem[]): void {
  const all = loadFriendEvents();
  all[date] = events;
  saveFriendEvents(all);
}

// 共通の表示月（全タブで共有）
export function getSavedMonth(): { year: number; month: number } {
  try {
    const saved = localStorage.getItem('shift_current_month');
    if (saved) {
      const { year, month } = JSON.parse(saved);
      if (year && month) return { year, month };
    }
  } catch {}
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function saveCurrentMonth(year: number, month: number): void {
  localStorage.setItem('shift_current_month', JSON.stringify({ year, month }));
}

// Firestoreからローカルにデータ復元（type単位）
export function restoreToLocal(type: SyncType, data: unknown): void {
  localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(data));
}
