#!/usr/bin/env node
/**
 * Firestore config/gemini ドキュメントにGemini APIキーを登録するスクリプト
 * 使い方: node scripts/set-gemini-key.mjs YOUR_API_KEY
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDP3vq2d3nVqzXhjoozal5Qh5WPK6o_8oM",
  authDomain: "shift-calendar-c92a9.firebaseapp.com",
  projectId: "shift-calendar-c92a9",
  storageBucket: "shift-calendar-c92a9.firebasestorage.app",
  messagingSenderId: "785151740664",
  appId: "1:785151740664:web:d60b9e6878aed5a150890d"
};

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('使い方: node scripts/set-gemini-key.mjs YOUR_GEMINI_API_KEY');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
  await setDoc(doc(db, 'config', 'gemini'), { apiKey }, { merge: true });
  console.log('Gemini APIキーをFirestoreに登録しました');
  process.exit(0);
} catch (err) {
  console.error('エラー:', err.message);
  process.exit(1);
}
