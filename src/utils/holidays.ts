// 日本の祝日判定
// 固定祝日 + 振替休日 + ハッピーマンデー + 春分・秋分

interface HolidayRule {
  month: number;
  day?: number;
  week?: number; // 第N週
  weekday?: number; // 曜日（1=月）
  name: string;
}

// 固定祝日
const FIXED_HOLIDAYS: HolidayRule[] = [
  { month: 1, day: 1, name: '元日' },
  { month: 2, day: 11, name: '建国記念の日' },
  { month: 2, day: 23, name: '天皇誕生日' },
  { month: 4, day: 29, name: '昭和の日' },
  { month: 5, day: 3, name: '憲法記念日' },
  { month: 5, day: 4, name: 'みどりの日' },
  { month: 5, day: 5, name: 'こどもの日' },
  { month: 8, day: 11, name: '山の日' },
  { month: 11, day: 3, name: '文化の日' },
  { month: 11, day: 23, name: '勤労感謝の日' },
];

// ハッピーマンデー
const HAPPY_MONDAY: HolidayRule[] = [
  { month: 1, week: 2, weekday: 1, name: '成人の日' },
  { month: 7, week: 3, weekday: 1, name: '海の日' },
  { month: 9, week: 3, weekday: 1, name: '敬老の日' },
  { month: 10, week: 2, weekday: 1, name: 'スポーツの日' },
];

// 春分の日（近似計算）
function getVernalEquinox(year: number): number {
  if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return 20; // fallback
}

// 秋分の日（近似計算）
function getAutumnalEquinox(year: number): number {
  if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return 23; // fallback
}

// 第N週の特定曜日の日付を取得
function getNthWeekday(year: number, month: number, nth: number, weekday: number): number {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === weekday) {
      count++;
      if (count === nth) return d;
    }
  }
  return 1;
}

// 指定年の祝日マップを生成
export function getHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  const addHoliday = (m: number, d: number, name: string) => {
    const key = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    holidays.set(key, name);
  };

  // 固定祝日
  for (const h of FIXED_HOLIDAYS) {
    addHoliday(h.month, h.day!, h.name);
  }

  // ハッピーマンデー
  for (const h of HAPPY_MONDAY) {
    const day = getNthWeekday(year, h.month, h.week!, h.weekday!);
    addHoliday(h.month, day, h.name);
  }

  // 春分・秋分
  addHoliday(3, getVernalEquinox(year), '春分の日');
  addHoliday(9, getAutumnalEquinox(year), '秋分の日');

  // 振替休日（祝日が日曜の場合、翌月曜が振替休日）
  const entries = [...holidays.entries()];
  for (const [dateStr, _name] of entries) {
    const d = new Date(dateStr);
    if (d.getDay() === 0) { // 日曜
      let next = new Date(d);
      next.setDate(next.getDate() + 1);
      // 翌日も祝日なら更に翌日
      let nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      while (holidays.has(nextKey)) {
        next.setDate(next.getDate() + 1);
        nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      }
      holidays.set(nextKey, '振替休日');
    }
  }

  // 国民の休日（祝日に挟まれた平日）
  const allDates = [...holidays.keys()].sort();
  for (let i = 0; i < allDates.length - 1; i++) {
    const d1 = new Date(allDates[i]);
    const d2 = new Date(allDates[i + 1]);
    const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 2) {
      const between = new Date(d1);
      between.setDate(between.getDate() + 1);
      const betweenKey = `${between.getFullYear()}-${String(between.getMonth() + 1).padStart(2, '0')}-${String(between.getDate()).padStart(2, '0')}`;
      if (!holidays.has(betweenKey) && between.getDay() !== 0) {
        holidays.set(betweenKey, '国民の休日');
      }
    }
  }

  return holidays;
}

// 祝日かどうか判定
export function isHoliday(dateStr: string): string | null {
  const year = Number(dateStr.slice(0, 4));
  const holidays = getHolidays(year);
  return holidays.get(dateStr) || null;
}
