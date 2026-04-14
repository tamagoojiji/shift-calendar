import { useState } from 'react';
import { SHIFT_COLORS } from '../types';
import { logout, loginWithGoogle, auth } from '../utils/firebase';
import { saveSettingsToFirestore } from '../utils/firebase';
import { loadDeletedEvents, removeDeletedEvent, getDay, saveDay, getParkDayEvents, saveParkDayEvents } from '../utils/storage';
import type { DeletedEvent } from '../utils/storage';

export default function Settings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('shift_gemini_key') || '');
  const [saved, setSaved] = useState(false);
  const [deletedEvents, setDeletedEvents] = useState<DeletedEvent[]>(loadDeletedEvents);
  const user = auth.currentUser;

  const restoreEvent = (index: number) => {
    const evt = deletedEvents[index];
    if (evt.source === 'personal') {
      const day = getDay(evt.date);
      day.details = [...(day.details || []), evt.item];
      saveDay(day);
    } else {
      const events = getParkDayEvents(evt.date);
      saveParkDayEvents(evt.date, [...events, evt.item]);
    }
    removeDeletedEvent(index);
    setDeletedEvents(loadDeletedEvents());
  };

  const handleSave = async () => {
    localStorage.setItem('shift_gemini_key', apiKey.trim());
    // Firestoreにも保存
    if (user) {
      try {
        await saveSettingsToFirestore(user.uid, { geminiKey: apiKey.trim() });
      } catch (err) {
        console.error('Settings sync error:', err);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <div className="settings">
      <h2 className="settings-title">設定</h2>

      {/* アカウント */}
      <div className="settings-section">
        <h3>アカウント（クラウドバックアップ）</h3>
        {user ? (
          <>
            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
              {user.displayName} ({user.email})
            </div>
            <div style={{ fontSize: '11px', color: '#4CAF50', marginBottom: '8px' }}>クラウド同期: 有効</div>
            <button className="settings-logout-btn" onClick={handleLogout}>
              ログアウト
            </button>
          </>
        ) : (
          <>
            <p className="settings-desc">Googleログインするとデータがクラウドに自動バックアップされます。ログインなしでも使えます。</p>
            <button className="login-btn" style={{ marginTop: '8px' }} onClick={async () => {
              try { await loginWithGoogle(); window.location.reload(); } catch (err) { alert('ログインに失敗しました。Safariブラウザから開いてお試しください。'); }
            }}>
              Googleでログイン
            </button>
          </>
        )}
      </div>

      {/* Gemini APIキー */}
      <div className="settings-section">
        <h3>Gemini APIキー</h3>
        <p className="settings-desc">画像読み取り（シフト・イベント）に使用します。</p>
        <input
          type="password"
          className="settings-input"
          placeholder="AIzaSy..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
        <button className="settings-save-btn" onClick={handleSave}>
          {saved ? '保存しました' : '保存'}
        </button>
        {localStorage.getItem('shift_gemini_key') && (
          <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>設定済み</div>
        )}
      </div>

      {/* 色凡例 */}
      <div className="settings-section">
        <h3>色設定</h3>
        <div className="settings-colors">
          {Object.entries(SHIFT_COLORS).map(([key, color]) => (
            <div key={key} className="settings-color-item">
              <span className="settings-color-dot" style={{ background: color }} />
              <span>{
                key === 'eye' ? '眼科' :
                key === 'facility' ? '施設' :
                key === 'katano' ? '交野' :
                key === 'hirakata' ? '枚方' :
                key === 'kadoma' ? '門真' :
                key === 'moriguchi' ? '守口' :
                key === 'hazushi' ? '外し' :
                key === 'off' ? '休み' : key
              }</span>
            </div>
          ))}
        </div>
      </div>

      {/* 削除済みイベント復元 */}
      <div className="settings-section">
        <h3>削除済みイベント（直近10件）</h3>
        {deletedEvents.length === 0 ? (
          <p className="settings-desc">削除済みイベントはありません</p>
        ) : (
          <div className="deleted-events-list">
            {deletedEvents.map((evt, i) => (
              <div key={i} className="deleted-event-item">
                <div className="deleted-event-info">
                  <span className="deleted-event-date">{evt.date}</span>
                  <span className="deleted-event-source">{evt.source === 'personal' ? '個人' : 'パーク'}</span>
                  <span className="deleted-event-content">{evt.item.time ? `${evt.item.time} ` : ''}{evt.item.content}</span>
                </div>
                <button className="deleted-event-restore" onClick={() => restoreEvent(i)}>復元</button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
