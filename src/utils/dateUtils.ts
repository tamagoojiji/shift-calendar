// 月の日数を取得
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 月の初日の曜日（0=日曜）
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

// YYYY-MM-DD形式の文字列を生成
export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 曜日取得（0=日, 6=土）
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

// 前日のdate stringを返す
export function getPrevDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// 今日の日付
export function getToday(): string {
  const d = new Date();
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// 曜日ラベル
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
