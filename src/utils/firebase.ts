import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence, type User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import type { DayData, ClinicMonthData, Staff, DetailItem } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyDP3vq2d3nVqzXhjoozal5Qh5WPK6o_8oM",
  authDomain: "shift-calendar-c92a9.firebaseapp.com",
  projectId: "shift-calendar-c92a9",
  storageBucket: "shift-calendar-c92a9.firebasestorage.app",
  messagingSenderId: "785151740664",
  appId: "1:785151740664:web:d60b9e6878aed5a150890d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ===== 認証 =====
export async function loginWithGoogle(): Promise<User> {
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ===== Firestore データ操作 =====
function getUserDocRef(uid: string, docName: string) {
  return doc(db, 'users', uid, 'data', docName);
}

function readUpdatedAt(raw: unknown): number {
  return typeof raw === 'number' ? raw : 0;
}

// シフトデータ
export async function saveShiftsToFirestore(uid: string, data: Record<string, DayData>, updatedAt: number = Date.now()): Promise<void> {
  await setDoc(getUserDocRef(uid, 'shifts'), { data, updatedAt }, { merge: true });
}

export async function loadShiftsFromFirestore(uid: string): Promise<{ data: Record<string, DayData>; updatedAt: number }> {
  const snap = await getDoc(getUserDocRef(uid, 'shifts'));
  if (snap.exists()) {
    const d = snap.data();
    return { data: d.data || {}, updatedAt: readUpdatedAt(d.updatedAt) };
  }
  return { data: {}, updatedAt: 0 };
}

// 眼科カレンダー
export async function saveClinicToFirestore(uid: string, data: Record<string, ClinicMonthData>, updatedAt: number = Date.now()): Promise<void> {
  await setDoc(getUserDocRef(uid, 'clinic'), { data, updatedAt }, { merge: true });
}

export async function loadClinicFromFirestore(uid: string): Promise<{ data: Record<string, ClinicMonthData>; updatedAt: number }> {
  const snap = await getDoc(getUserDocRef(uid, 'clinic'));
  if (snap.exists()) {
    const d = snap.data();
    return { data: d.data || {}, updatedAt: readUpdatedAt(d.updatedAt) };
  }
  return { data: {}, updatedAt: 0 };
}

// スタッフ
export async function saveStaffToFirestore(uid: string, staff: Staff[], updatedAt: number = Date.now()): Promise<void> {
  await setDoc(getUserDocRef(uid, 'staff'), { data: staff, updatedAt });
}

export async function loadStaffFromFirestore(uid: string): Promise<{ data: Staff[]; updatedAt: number }> {
  const snap = await getDoc(getUserDocRef(uid, 'staff'));
  if (snap.exists()) {
    const d = snap.data();
    return { data: d.data || [{ id: 'yotsuhashi', name: '四ツ橋' }], updatedAt: readUpdatedAt(d.updatedAt) };
  }
  return { data: [{ id: 'yotsuhashi', name: '四ツ橋' }], updatedAt: 0 };
}

// 友達の予定
export async function saveFriendToFirestore(uid: string, data: Record<string, DetailItem[]>, updatedAt: number = Date.now()): Promise<void> {
  await setDoc(getUserDocRef(uid, 'friend'), { data, updatedAt }, { merge: true });
}

export async function loadFriendFromFirestore(uid: string): Promise<{ data: Record<string, DetailItem[]>; updatedAt: number }> {
  const snap = await getDoc(getUserDocRef(uid, 'friend'));
  if (snap.exists()) {
    const d = snap.data();
    return { data: d.data || {}, updatedAt: readUpdatedAt(d.updatedAt) };
  }
  return { data: {}, updatedAt: 0 };
}

// ===== 友達の予定 共有（friendShares/{shareId}） =====
function getFriendShareDocRef(shareId: string) {
  return doc(db, 'friendShares', shareId);
}

export async function saveFriendShareToFirestore(shareId: string, data: Record<string, DetailItem[]>, updatedAt: number = Date.now()): Promise<void> {
  await setDoc(getFriendShareDocRef(shareId), { data, updatedAt }, { merge: true });
}

export async function loadFriendShareFromFirestore(shareId: string): Promise<{ exists: boolean; data: Record<string, DetailItem[]>; updatedAt: number }> {
  const snap = await getDoc(getFriendShareDocRef(shareId));
  if (snap.exists()) {
    const d = snap.data();
    return { exists: true, data: d.data || {}, updatedAt: readUpdatedAt(d.updatedAt) };
  }
  return { exists: false, data: {}, updatedAt: 0 };
}

export function subscribeFriendShare(shareId: string, cb: (p: { exists: boolean; data: Record<string, DetailItem[]>; updatedAt: number }) => void): () => void {
  return onSnapshot(getFriendShareDocRef(shareId), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      cb({ exists: true, data: d.data || {}, updatedAt: readUpdatedAt(d.updatedAt) });
    } else {
      cb({ exists: false, data: {}, updatedAt: 0 });
    }
  }, (err) => console.error('friendShare subscribe error:', err));
}

