import type { DayData, ClinicMonthData, Staff } from '../types';

const STORAGE_KEYS = {
  shifts: 'shift_calendar_data',
  clinic: 'shift_clinic_data',
  staff: 'shift_staff_list',
};

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
}
