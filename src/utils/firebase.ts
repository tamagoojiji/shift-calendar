import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence, type User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
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

// シフトデータ
export async function saveShiftsToFirestore(uid: string, data: Record<string, DayData>): Promise<void> {
  await setDoc(getUserDocRef(uid, 'shifts'), { data }, { merge: true });
}

export async function loadShiftsFromFirestore(uid: string): Promise<Record<string, DayData>> {
  const snap = await getDoc(getUserDocRef(uid, 'shifts'));
  if (snap.exists()) {
    return snap.data().data || {};
  }
  return {};
}

// 眼科カレンダー
export async function saveClinicToFirestore(uid: string, data: Record<string, ClinicMonthData>): Promise<void> {
  await setDoc(getUserDocRef(uid, 'clinic'), { data }, { merge: true });
}

export async function loadClinicFromFirestore(uid: string): Promise<Record<string, ClinicMonthData>> {
  const snap = await getDoc(getUserDocRef(uid, 'clinic'));
  if (snap.exists()) {
    return snap.data().data || {};
  }
  return {};
}

// スタッフ
export async function saveStaffToFirestore(uid: string, staff: Staff[]): Promise<void> {
  await setDoc(getUserDocRef(uid, 'staff'), { data: staff });
}

export async function loadStaffFromFirestore(uid: string): Promise<Staff[]> {
  const snap = await getDoc(getUserDocRef(uid, 'staff'));
  if (snap.exists()) {
    return snap.data().data || [{ id: 'yotsuhashi', name: '四ツ橋' }];
  }
  return [{ id: 'yotsuhashi', name: '四ツ橋' }];
}

// 友達の予定
export async function saveFriendToFirestore(uid: string, data: Record<string, DetailItem[]>): Promise<void> {
  await setDoc(getUserDocRef(uid, 'friend'), { data }, { merge: true });
}

export async function loadFriendFromFirestore(uid: string): Promise<Record<string, DetailItem[]>> {
  const snap = await getDoc(getUserDocRef(uid, 'friend'));
  if (snap.exists()) {
    return snap.data().data || {};
  }
  return {};
}

