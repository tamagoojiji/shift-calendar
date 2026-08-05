import { useState } from 'react';
import { SHIFT_COLORS } from '../types';
import { logout, loginWithGoogle, auth } from '../utils/firebase';
import { loadDeletedEvents, removeDeletedEvent, getDay, saveDay, getFriendDayEvents, saveFriendDayEvents } from '../utils/storage';
import type { DeletedEvent } from '../utils/storage';

// 旧実装の source:'park' レコードは表示・復元の対象外
function loadValidDeletedEvents(): DeletedEvent[] {
  return loadDeletedEvents().filter(e => e.source === 'personal' || e.source === 'friend');
}

export default function Settings() {
  const [deletedEvents, setDeletedEvents] = useState<DeletedEvent[]>(loadValidDeletedEvents);
  const user = auth.currentUser;

  const restoreEvent = (index: number) => {
    const evt = deletedEvents[index];
    if (evt.source === 'personal') {
      const day = getDay(evt.date);
      day.details = [...(day.details || []), evt.item];
      saveDay(day);
    } else {
      const events = getFriendDayEvents(evt.date);
      saveFriendDayEvents(evt.date, [...events, evt.item]);
    }
    // フィルタでindexがずれるため、保存済みリスト側の位置をdeletedAt+idで特定
    const rawIndex = loadDeletedEvents().findIndex(e => e.deletedAt === evt.deletedAt && e.item.id === evt.item.id);
    if (rawIndex >= 0) removeDeletedEvent(rawIndex);
    setDeletedEvents(loadValidDeletedEvents());
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
                  <span className="deleted-event-source">{evt.source === 'personal' ? '個人' : '友達'}</span>
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
