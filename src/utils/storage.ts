import type { DayData, ClinicMonthData, Staff, DetailItem } from '../types';
import { saveShiftsToFirestore, saveClinicToFirestore, saveStaffToFirestore, saveSettingsToFirestore } from './firebase';

const STORAGE_KEYS = {
  shifts: 'shift_calendar_data',
  clinic: 'shift_clinic_data',
  staff: 'shift_staff_list',
};

// 現在ログイン中のユーザーID
let currentUid: string | null = null;

export function setCurrentUid(uid: string | null) {
  currentUid = uid;
}

// Firestoreへの非同期保存（バックグラウンド）
function syncToFirestore(type: 'shifts' | 'clinic' | 'staff' | 'settings', data: unknown) {
  if (!currentUid) return;
  const uid = currentUid;

  // デバウンス用
  if (syncTimers[type]) clearTimeout(syncTimers[type]);
  syncTimers[type] = setTimeout(async () => {
    try {
      if (type === 'shifts') await saveShiftsToFirestore(uid, data as Record<string, DayData>);
      else if (type === 'clinic') await saveClinicToFirestore(uid, data as Record<string, ClinicMonthData>);
      else if (type === 'staff') await saveStaffToFirestore(uid, data as Staff[]);
      else if (type === 'settings') await saveSettingsToFirestore(uid, data as Record<string, string>);
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  }, 2000); // 2秒デバウンス
}

const syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

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
  syncToFirestore('staff', staff);
}

// パークイベント（個人イベントとは独立）
export function loadParkEvents(): Record<string, DetailItem[]> {
  try {
    const raw = localStorage.getItem('park_events_data');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveParkEvents(data: Record<string, DetailItem[]>): void {
  localStorage.setItem('park_events_data', JSON.stringify(data));
}

export function getParkDayEvents(date: string): DetailItem[] {
  const all = loadParkEvents();
  return all[date] || [];
}

export function saveParkDayEvents(date: string, events: DetailItem[]): void {
  const all = loadParkEvents();
  all[date] = events;
  saveParkEvents(all);
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

// Firestoreからローカルにデータ復元
export function restoreToLocal(shifts: Record<string, DayData>, clinic: Record<string, ClinicMonthData>, staff: Staff[]) {
  if (Object.keys(shifts).length > 0) {
    localStorage.setItem(STORAGE_KEYS.shifts, JSON.stringify(shifts));
  }
  if (Object.keys(clinic).length > 0) {
    localStorage.setItem(STORAGE_KEYS.clinic, JSON.stringify(clinic));
  }
  if (staff.length > 0) {
    localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(staff));
  }
}
