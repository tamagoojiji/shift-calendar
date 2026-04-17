# shift-calendar

勤務表カレンダーPWA（Vite + React + TypeScript）。

## デプロイ（重要）

GitHub Pages は **`gh-pages` ブランチから配信**。`main` に push しても反映されない。

```bash
npm run build
npx gh-pages -d dist -m "Updates"
```

本番URL: https://tamagoojiji.github.io/shift-calendar/

## 動作確認

本番に新しいコードが含まれているかの確認:

```bash
curl -s https://tamagoojiji.github.io/shift-calendar/ | grep -oE 'assets/index-[^"]+\.js'
curl -s https://tamagoojiji.github.io/shift-calendar/assets/index-XXXX.js | grep -o "<確認したい文字列>"
```

## PWAキャッシュ

`public/sw.js` はfetchキャッシュしていない（通知用のみ）。ただしブラウザ/iOSホーム画面のPWAキャッシュは別。デプロイ後に反映されない時は、タブを閉じて開き直し or ホーム画面から再追加が必要。

## 通知（アラーム）

`src/utils/reminder.ts` で管理。`ReminderTiming = 'prev22' | '60min' | '30min'`。localStorage `shift_reminders` に保存し、`checkAndFireReminders()` を定期実行して通知発火。
