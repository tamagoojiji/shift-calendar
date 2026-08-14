import type { DayData, ClinicMonthData, Staff, DetailItem } from '../types';
import { FRIEND_EVENT_COLORS } from '../types';
import { saveShiftsToFirestore, saveClinicToFirestore, saveStaffToFirestore, saveFriendToFirestore, saveFriendShareToFirestore } from './firebase';
import { getReminder, setReminder, removeReminder } from './reminder';

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

// 個人予定 ⇔ 友達の予定のリンク
export function generateLinkId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyDay(date: string): DayData {
  return { date, dayShift: null, nightShift: null, nightTime: null, isOff: false, details: [] };
}

export function findPersonalItemByLinkId(linkId: string): { date: string; item: DetailItem } | null {
  const all = loadShifts();
  for (const date of Object.keys(all)) {
    const item = (all[date]?.details || []).find(d => d.linkId === linkId);
    if (item) return { date, item };
  }
  return null;
}

export function findFriendItemByLinkId(linkId: string): { date: string; item: DetailItem } | null {
  const all = loadFriendEvents();
  for (const date of Object.keys(all)) {
    const item = (all[date] || []).find(d => d.linkId === linkId);
    if (item) return { date, item };
  }
  return null;
}

// リンク相手を作成/更新（source = itemが属する側）
export function upsertLinkedCounterpart(source: 'personal' | 'friend', date: string, item: DetailItem): void {
  const linkId = item.linkId;
  if (!linkId) return;

  if (source === 'personal') {
    const all = loadFriendEvents();
    let oldDate: string | null = null;
    let existing: DetailItem | undefined;
    for (const d of Object.keys(all)) {
      const found = (all[d] || []).find(e => e.linkId === linkId);
      if (found) { oldDate = d; existing = found; break; }
    }

    if (existing && oldDate) {
      const updated: DetailItem = { ...existing, time: item.time, endTime: item.endTime, content: item.content, url: item.url };
      if (oldDate === date) {
        all[date] = (all[date] || []).map(e => (e.linkId === linkId ? updated : e));
      } else {
        all[oldDate] = (all[oldDate] || []).filter(e => e.linkId !== linkId);
        all[date] = [...(all[date] || []), updated];
      }
    } else {
      all[date] = [...(all[date] || []), {
        id: Date.now().toString(),
        linkId,
        time: item.time,
        endTime: item.endTime,
        content: item.content,
        url: item.url,
        color: FRIEND_EVENT_COLORS[0],
      }];
    }
    saveFriendEvents(all);
    return;
  }

  const all = loadShifts();
  let oldDate: string | null = null;
  let existing: DetailItem | undefined;
  for (const d of Object.keys(all)) {
    const found = (all[d]?.details || []).find(e => e.linkId === linkId);
    if (found) { oldDate = d; existing = found; break; }
  }

  if (existing && oldDate) {
    const updated: DetailItem = { ...existing, time: item.time, endTime: item.endTime, content: item.content, url: item.url };
    if (oldDate === date) {
      all[date].details = (all[date].details || []).map(e => (e.linkId === linkId ? updated : e));
    } else {
      all[oldDate].details = (all[oldDate].details || []).filter(e => e.linkId !== linkId);
      const target = all[date] || emptyDay(date);
      target.details = [...(target.details || []), updated];
      all[date] = target;
      const reminder = getReminder(existing.id, oldDate);
      if (reminder) {
        removeReminder(existing.id, oldDate);
        if (updated.time) setReminder(existing.id, date, updated.time, updated.content, reminder.timings);
      }
    }
  } else {
    const target = all[date] || emptyDay(date);
    target.details = [...(target.details || []), {
      id: Date.now().toString(),
      linkId,
      time: item.time,
      endTime: item.endTime,
      content: item.content,
      url: item.url,
    }];
    all[date] = target;
  }
  saveShifts(all);
}

// リンク相手を削除（削除履歴には積まない）
export function removeLinkedCounterpart(source: 'personal' | 'friend', linkId: string): void {
  if (source === 'personal') {
    const all = loadFriendEvents();
    let hit = false;
    for (const d of Object.keys(all)) {
      const next = (all[d] || []).filter(e => e.linkId !== linkId);
      if (next.length !== (all[d] || []).length) { all[d] = next; hit = true; }
    }
    if (hit) saveFriendEvents(all);
    return;
  }

  const all = loadShifts();
  let hit = false;
  for (const d of Object.keys(all)) {
    const details = all[d]?.details || [];
    const target = details.find(e => e.linkId === linkId);
    if (!target) continue;
    all[d].details = details.filter(e => e.linkId !== linkId);
    removeReminder(target.id, d);
    hit = true;
  }
  if (hit) saveShifts(all);
}

// リンク解除（両方のアイテムは残す）
export function unlinkPair(source: 'personal' | 'friend', date: string, itemId: string): void {
  let linkId: string | undefined;

  if (source === 'personal') {
    const all = loadShifts();
    const item = (all[date]?.details || []).find(d => d.id === itemId);
    if (!item?.linkId) return;
    linkId = item.linkId;
    delete item.linkId;
    saveShifts(all);
  } else {
    const all = loadFriendEvents();
    const item = (all[date] || []).find(d => d.id === itemId);
    if (!item?.linkId) return;
    linkId = item.linkId;
    delete item.linkId;
    saveFriendEvents(all);
  }

  if (source === 'personal') {
    const all = loadFriendEvents();
    let hit = false;
    for (const d of Object.keys(all)) {
      (all[d] || []).forEach(e => {
        if (e.linkId === linkId) { delete e.linkId; hit = true; }
      });
    }
    if (hit) saveFriendEvents(all);
  } else {
    const all = loadShifts();
    let hit = false;
    for (const d of Object.keys(all)) {
      (all[d]?.details || []).forEach(e => {
        if (e.linkId === linkId) { delete e.linkId; hit = true; }
      });
    }
    if (hit) saveShifts(all);
  }
}

// 友達ストア差し替え後、個人側のリンク済み予定を追従させる（友達ストアには書かない）
export function reconcilePersonalWithFriendLinks(): void {
  const friendAll = loadFriendEvents();
  const friendMap = new Map<string, { date: string; item: DetailItem }>();
  Object.keys(friendAll).forEach(date => {
    (friendAll[date] || []).forEach(item => {
      if (item.linkId) friendMap.set(item.linkId, { date, item });
    });
  });

  const shifts = loadShifts();
  let changed = false;

  Object.keys(shifts).forEach(date => {
    const day = shifts[date];
    if (!day) return;
    for (const item of [...(day.details || [])]) {
      if (!item.linkId) continue;
      const counterpart = friendMap.get(item.linkId);

      if (!counterpart) {
        day.details = (day.details || []).filter(d => d.id !== item.id);
        addDeletedEvent(item, date, 'personal');
        removeReminder(item.id, date);
        changed = true;
        continue;
      }

      const f = counterpart.item;
      const newDate = counterpart.date;
      const same = item.time === f.time
        && (item.endTime || '') === (f.endTime || '')
        && item.content === f.content
        && (item.url || '') === (f.url || '')
        && newDate === date;
      if (same) continue;

      const updated: DetailItem = { ...item, time: f.time, endTime: f.endTime, content: f.content, url: f.url };
      if (newDate === date) {
        day.details = (day.details || []).map(d => (d.id === item.id ? updated : d));
      } else {
        day.details = (day.details || []).filter(d => d.id !== item.id);
        const target = shifts[newDate] || emptyDay(newDate);
        target.details = [...(target.details || []), updated];
        shifts[newDate] = target;
        const reminder = getReminder(item.id, date);
        if (reminder) {
          removeReminder(item.id, date);
          if (updated.time) setReminder(item.id, newDate, updated.time, updated.content, reminder.timings);
        }
      }
      changed = true;
    }
  });

  if (changed) saveShifts(shifts);
}
