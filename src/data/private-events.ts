// 貸切イベントデータ
export interface PrivateEvent {
  name: string;
  time: string;
}

export const privateEvents: Record<string, PrivateEvent> = {
  '2026-01-17': { name: 'グランロイヤル限定貸切', time: '20:00~22:00' },
  '2026-01-18': { name: 'グランロイヤル限定貸切', time: '20:00~22:00' },
  '2026-02-14': { name: 'ベネフィット・ステーション貸切', time: '20:00~22:00' },
  '2026-02-28': { name: 'セブンイレブン加盟店共済会クラブオフ貸切', time: '20:00~22:00' },
  '2026-03-06': { name: '三井住友カード貸切ナイト', time: '19:00~22:00' },
  '2026-03-14': { name: 'NTTドコモ一部エリア貸切', time: '閉園後2時間' },
  '2026-03-27': { name: 'JCBプレミアムナイト', time: '19:00~22:00' },
  '2026-03-28': { name: 'ユニ春 学生限定アトラクション貸切', time: '20:00~' },
  '2026-03-29': { name: 'ユニ春 学生限定アトラクション貸切', time: '20:00~' },
  '2026-06-05': { name: 'J:COM貸切プレミアムナイト', time: '19:00~22:00' },
  '2026-07-03': { name: 'ハッピープラス貸切ナイト（年パスプラス会員限定）', time: '20:00~22:00' },
};

// 貸切有無チェック
export function hasPrivateEvent(date: string): boolean {
  return date in privateEvents;
}
