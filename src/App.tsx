import { useState, useEffect } from 'react';
import type { TabType, DetailItem } from './types';
import MonthCalendar from './components/MonthCalendar';
import ClinicCalendar from './components/ClinicCalendar';
import FriendCalendar from './components/FriendCalendar';
import Settings from './components/Settings';
import { onAuthChange, loadShiftsFromFirestore, loadClinicFromFirestore, loadStaffFromFirestore, loadFriendFromFirestore } from './utils/firebase';
import { setCurrentUid, restoreToLocal } from './utils/storage';
import { registerServiceWorker, checkAndFireReminders, requestNotificationPermission } from './utils/reminder';

export default function App() {
  const [tab, setTab] = useState<TabType>('calendar');
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    // 3秒でタイムアウト（Firebase初期化が遅い場合）
    const timeout = setTimeout(() => setLoading(false), 3000);

    const unsubscribe = onAuthChange(async (u) => {
      clearTimeout(timeout);
      if (u) {
        setCurrentUid(u.uid);
        try {
          const shifts = await loadShiftsFromFirestore(u.uid);
          const clinic = await loadClinicFromFirestore(u.uid);
          const staff = await loadStaffFromFirestore(u.uid);
          let friend: Record<string, DetailItem[]> = {};
          try {
            friend = await loadFriendFromFirestore(u.uid);
          } catch (err) {
            console.error('Firestore friend restore error:', err);
          }
          restoreToLocal(shifts, clinic, staff, friend);
          // Firestore復元後にコンポーネントを再マウントさせる
          setDataVersion(v => v + 1);
        } catch (err) {
          console.error('Firestore restore error:', err);
        }
      } else {
        setCurrentUid(null);
      }
      setLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, []);

  // Service Worker登録 & リマインダー定期チェック
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
    // 初回チェック
    checkAndFireReminders();
    // 1分ごとにチェック
    const interval = setInterval(checkAndFireReminders, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-content">
        {tab === 'calendar' && <MonthCalendar key={dataVersion} />}
        {tab === 'clinic' && <ClinicCalendar key={dataVersion} />}
        {tab === 'friend' && <FriendCalendar key={dataVersion} />}
        {tab === 'settings' && <Settings />}
      </div>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${tab === 'calendar' ? 'active' : ''}`}
          onClick={() => setTab('calendar')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">カレンダー</span>
        </button>
        <button
          className={`nav-item ${tab === 'clinic' ? 'active' : ''}`}
          onClick={() => setTab('clinic')}
        >
          <span className="nav-icon">🏥</span>
          <span className="nav-label">眼科</span>
        </button>
        <button
          className={`nav-item ${tab === 'friend' ? 'active' : ''}`}
          onClick={() => setTab('friend')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">友達</span>
        </button>
        <button
          className={`nav-item ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">設定</span>
        </button>
      </nav>
    </div>
  );
}
