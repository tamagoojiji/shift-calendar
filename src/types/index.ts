// 勤務先
export type DayShiftType = 'eye' | 'facility' | null; // 眼科 / 施設
export type NightShiftPlace = 'katano' | 'hirakata' | 'kadoma' | 'moriguchi' | null; // 交野/枚方/門真/守口
export type NightShiftTime = '17' | '20' | null;

// 1日のシフトデータ
export interface DayData {
  date: string; // YYYY-MM-DD
  dayShift: DayShiftType;
  nightShift: NightShiftPlace;
  nightTime: NightShiftTime;
  isOff: boolean; // 休み
  details: DetailItem[];
}

// 詳細予定
export interface DetailItem {
  id: string;
  time: string; // HH:MM
  content: string;
}

// 眼科スタッフ
export interface Staff {
  id: string;
  name: string;
}

// 眼科スタッフのシフトパターン
export type ClinicShiftPattern = 'am' | 'pm' | 'am_pm' | 'late' | 'off' | null; // 午前/午後/午前+午後/11:30〜/休み

// 眼科カレンダーの1日データ
export interface ClinicDayData {
  [staffId: string]: ClinicShiftPattern;
}

// 月単位の眼科カレンダー
export interface ClinicMonthData {
  [date: string]: ClinicDayData; // key: YYYY-MM-DD
}

// 施設の色設定
export const SHIFT_COLORS: Record<string, string> = {
  eye: '#E91E63',      // ピンク（眼科）
  facility: '#4CAF50', // 緑（施設）
  katano: '#9C27B0',   // 紫（交野）
  hirakata: '#2196F3', // 青（枚方）
  kadoma: '#FF9800',   // オレンジ（門真）
  moriguchi: '#F44336', // 赤（守口）
  off: '#9E9E9E',      // グレー（休み）
};

// 施設の表示名
export const SHIFT_LABELS: Record<string, string> = {
  eye: '眼科',
  facility: '施設',
  katano: '交野',
  hirakata: '枚方',
  kadoma: '門真',
  moriguchi: '守口',
};

// タブ
export type TabType = 'calendar' | 'clinic' | 'import' | 'settings';
