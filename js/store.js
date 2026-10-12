// Firebase 連線層。SDK 用動態載入：就算 Google 的 CDN 連不上，網站仍會用預設內容顯示，不會整頁空白。
import { normalize, LS } from './data.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const firebaseConfig = {
  apiKey: 'AIzaSyAxObm0QEV7Zk9rMI6SbsCRXHKc765YxIk',
  authDomain: 'chiacheng-3f785.firebaseapp.com',
  projectId: 'chiacheng-3f785',
  storageBucket: 'chiacheng-3f785.firebasestorage.app',
  messagingSenderId: '557068915414',
  appId: '1:557068915414:web:a9ab0209daa743487def77',
  measurementId: 'G-CV97Q9XXTC',
};

// 網站內容存放位置（沿用舊版，不要改，否則會讀不到原本的資料）
export const SITE_DOC = ['portfolio', 'site_data_v1'];

// 失敗時清掉快取，下次可以重試
function once(fn) {
  let p = null;
  return () => {
    if (!p) {
      p = fn().catch((e) => {
        p = null;
        throw e;
      });
    }
    return p;
  };
}

const getApp = once(async () => {
  const m = await import(SDK + 'firebase-app.js');
  return m.initializeApp(firebaseConfig);
});

export const firestore = once(async () => {
  const [app, m] = await Promise.all([getApp(), import(SDK + 'firebase-firestore.js')]);
  return { m, db: m.getFirestore(app) };
});

export const authKit = once(async () => {
  const [app, m] = await Promise.all([getApp(), import(SDK + 'firebase-auth.js')]);
  return { m, auth: m.getAuth(app) };
});

// ============ 前台讀取 ============
// 回傳整理過的資料；雲端還沒有資料時回傳 null；連線失敗會丟錯誤
export async function loadPublished() {
  const { m, db } = await firestore();
  const snap = await m.getDoc(m.doc(db, ...SITE_DOC));
  return snap.exists() ? normalize(snap.data()) : null;
}

export function readCache() {
  try {
    const raw = localStorage.getItem(LS.cache);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

export function writeCache(data) {
  try {
    localStorage.setItem(LS.cache, JSON.stringify(data));
  } catch (e) {
    /* 容量滿了就算了 */
  }
}

// 後台「在新分頁預覽」用：讀本機草稿
export function readDraft() {
  try {
    const raw = localStorage.getItem(LS.draft);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && obj.data ? normalize(obj.data) : null;
  } catch (e) {
    return null;
  }
}

// 聯絡表單 → messages 集合（需要 firestore.rules 允許建立）
export async function sendMessage({ name, email, message }) {
  const { m, db } = await firestore();
  await m.addDoc(m.collection(db, 'messages'), {
    name,
    email,
    message,
    createdAt: m.serverTimestamp(),
  });
}
