import { useState, useEffect } from 'react';
import type { TabType, DetailItem } from './types';
import MonthCalendar from './components/MonthCalendar';
import ClinicCalendar from './components/ClinicCalendar';
import FriendCalendar from './components/FriendCalendar';
import Settings from './components/Settings';
import {
  onAuthChange,
  loadShiftsFromFirestore, loadClinicFromFirestore, loadStaffFromFirestore, loadFriendFromFirestore,
  saveShiftsToFirestore, saveClinicToFirestore, saveStaffToFirestore, saveFriendToFirestore,
  loadFriendShareFromFirestore,
} from './utils/firebase';
import type { SyncType } from './utils/storage';
import {
  setCurrentUid, restoreToLocal, getLocalUpdatedAt, setLocalUpdatedAt,
  loadShifts, loadClinicData, loadStaff, loadFriendEvents,
  getFriendShareId, setFriendShareId, reconcilePersonalWithFriendLinks,
} from './utils/storage';
import { registerServiceWorker, checkAndFireReminders, requestNotificationPermission } from './utils/reminder';

// type単位でローカル/リモートの新しい方を採用する
async function reconcile<T>(
  uid: string,
  type: SyncType,
  remote: { data: T; updatedAt: number },
  remoteHasData: boolean,
  loadLocal: () => T,
  push: (uid: string, data: T, updatedAt: number) => Promise<void>,
): Promise<void> {
  const localUpdatedAt = getLocalUpdatedAt(type);

  if (remote.updatedAt > localUpdatedAt) {
    restoreToLocal(type, remote.data);
    setLocalUpdatedAt(type, remote.updatedAt);
    return;
  }

  if (localUpdatedAt > remote.updatedAt) {
    await push(uid, loadLocal(), localUpdatedAt);
    return;
  }

  // 両方0（移行期・旧データ）はリモートにデータがあれば従来通り復元
  if (localUpdatedAt === 0 && remoteHasData) {
    restoreToLocal(type, remote.data);
  }
}

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
          await reconcile(u.uid, 'shifts', shifts, Object.keys(shifts.data).length > 0, loadShifts, saveShiftsToFirestore);
          await reconcile(u.uid, 'clinic', clinic, Object.keys(clinic.data).length > 0, loadClinicData, saveClinicToFirestore);
          await reconcile(u.uid, 'staff', staff, staff.data.length > 0, loadStaff, saveStaffToFirestore);
          // 共有モード中は個人docとのreconcileをしない（共有docが正）
          if (!getFriendShareId()) {
            try {
              const friend: { data: Record<string, DetailItem[]>; updatedAt: number } = await loadFriendFromFirestore(u.uid);
              await reconcile(u.uid, 'friend', friend, Object.keys(friend.data).length > 0, loadFriendEvents, saveFriendToFirestore);
            } catch (err) {
              console.error('Firestore friend restore error:', err);
            }
          }
          reconcilePersonalWithFriendLinks();
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

  // 共有リンク（?share=）からの参加
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shareParam = params.get('share');
    if (!shareParam) return;
    history.replaceState(null, '', location.pathname);
    if (getFriendShareId() === shareParam) { setTab('friend'); return; }
    setFriendShareId(shareParam); // 先に設定して起動時reconcileと競合しないようにする
    (async () => {
      const res = await loadFriendShareFromFirestore(shareParam);
      if (res.exists) {
        restoreToLocal('friend', res.data);
        setLocalUpdatedAt('friend', res.updatedAt);
        reconcilePersonalWithFriendLinks();
        setTab('friend');
        setDataVersion(v => v + 1);
      } else {
        setFriendShareId(null);
        alert('共有リンクが無効です');
      }
    })();
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
