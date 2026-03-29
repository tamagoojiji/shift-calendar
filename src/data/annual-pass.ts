// 年パス除外日データ
// 除外日の日付をSetで管理

function expandRange(year: number, month: number, ranges: [number, number][]): string[] {
  const dates: string[] = [];
  const mm = String(month).padStart(2, '0');
  for (const [start, end] of ranges) {
    for (let d = start; d <= end; d++) {
      dates.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
    }
  }
  return dates;
}

const excludedDates: string[] = [
  // 2026年3月: 14〜16, 20〜30
  ...expandRange(2026, 3, [[14, 16], [20, 30]]),
  // 2026年4月: なし
  // 2026年5月: 1〜6
  ...expandRange(2026, 5, [[1, 6]]),
  // 2026年6月: なし
  // 2026年7月: 18〜20
  ...expandRange(2026, 7, [[18, 20]]),
  // 2026年8月: 6〜23
  ...expandRange(2026, 8, [[6, 23]]),
  // 2026年9月: 12〜13, 19〜28
  ...expandRange(2026, 9, [[12, 13], [19, 28]]),
  // 2026年10月: 3〜5, 10〜12, 17〜19, 23〜26, 30〜31
  ...expandRange(2026, 10, [[3, 5], [10, 12], [17, 19], [23, 26], [30, 31]]),
  // 2026年11月: 1〜3, 7〜8, 21〜23
  ...expandRange(2026, 11, [[1, 3], [7, 8], [21, 23]]),
  // 2026年12月: 19〜20, 25〜31
  ...expandRange(2026, 12, [[19, 20], [25, 31]]),
  // 2027年1月: 2〜3, 10
  ...expandRange(2027, 1, [[2, 3], [10, 10]]),
  // 2027年2月: 11, 21
  ...expandRange(2027, 2, [[11, 11], [21, 21]]),
  // 2027年3月: 18〜31
  ...expandRange(2027, 3, [[18, 31]]),
  // 2027年4月: 29〜30
  ...expandRange(2027, 4, [[29, 30]]),
  // 2027年5月: 1〜5
  ...expandRange(2027, 5, [[1, 5]]),
];

export const annualPassExcluded = new Set(excludedDates);

// カレンダー表示用: 除外日なら "除外日" を返す
export function getAnnualPassStatus(date: string): string | null {
  if (annualPassExcluded.has(date)) return '除外日';
  return '利用可';
}
