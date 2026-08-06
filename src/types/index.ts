// 勤務先
export type DayShiftType = 'eye' | 'facility' | 'off' | 'eye_am' | null; // 眼科 / 施設 / 休み / 眼科(午前)
export type NightShiftPlace = 'katano' | 'hirakata' | 'kadoma' | 'moriguchi' | 'hazushi' | null; // 交野/枚方/門真/守口/外し
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
  time: string; // HH:MM（開始時間。空なら終日）
  endTime?: string; // HH:MM（終了時間。任意）
  content: string;
  url?: string;
  color?: string; // 表示色。友達の予定で使用
}

// 友達の予定の選択可能な色（先頭 = 既定）
export const FRIEND_EVENT_COLORS = ['#9C27B0', '#E91E63', '#1E88E5', '#F57C00'];

// 眼科スタッフ
export interface Staff {
  id: string;
  name: string;
}

// 眼科スタッフのシフトパターン
export type ClinicShiftPattern = 'am' | 'pm' | 'am_pm' | 'am_ten' | 'am_pm_ten' | 'late' | 'off' | null; // 午前/午後/全日/午前(10時〜)/全日(10時〜)/11:30〜/休み

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
  eye: '#4CAF50',      // 緑（眼科）
  eye_am: '#4CAF50',   // 緑（眼科・午前）
  facility: '#FB8C00', // オレンジ（施設）
  katano: '#1565C0',   // 青（交野）
  hirakata: '#00838F', // ティール（枚方）
  kadoma: '#5E35B1',   // 紫（門真）
  moriguchi: '#3949AB', // インディゴ（守口）
  hazushi: '#78909C',   // グレー（外し）
  off: '#E57373',      // ピンク（休み）
};

// 施設の表示名
export const SHIFT_LABELS: Record<string, string> = {
  eye: '眼科',
  eye_am: '眼科', // カレンダー上は「眼科」表示
  facility: '施設',
  off: '休み',
  katano: '交野',
  hirakata: '枚方',
  kadoma: '門真',
  moriguchi: '守口',
  hazushi: '外し',
};

// タブ
export type TabType = 'calendar' | 'clinic' | 'friend' | 'settings';
