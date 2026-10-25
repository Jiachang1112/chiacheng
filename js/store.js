// Firebase 連線層。SDK 用動態載入：就算 Google 的 CDN 連不上，網站仍會用預設內容顯示，不會整頁空白。
import { normalize, LS } from './data.js?v=20261025';

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
// Firestore 的 REST 回傳會把每個值包成 {stringValue: …}、{mapValue: …}，這裡還原成一般物件
function fromFs(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) {
    const o = {};
    const f = v.mapValue.fields || {};
    Object.keys(f).forEach((k) => { o[k] = fromFs(f[k]); });
    return o;
  }
  return null;
}

// 用一般的 GET 讀公開文件。SDK 讀取靠長連線（Listen/channel），Googlebot 轉譯網頁時這條連線會失敗，
// 結果 Google 看到的是預設內容、不是後台發布的內容；GET 是普通請求，爬蟲和一般瀏覽器都能順利讀到。
async function fetchRest() {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${SITE_DOC.join('/')}`;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 6000) : 0;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    if (res.status === 404) return null; // 還沒發布過
    if (!res.ok) throw new Error('rest ' + res.status);
    const doc = await res.json();
    return fromFs({ mapValue: { fields: doc.fields || {} } });
  } finally {
    clearTimeout(timer);
  }
}

// 回傳整理過的資料；雲端還沒有資料時回傳 null；連線失敗會丟錯誤
export async function loadPublished() {
  try {
    const raw = await fetchRest();
    return raw ? normalize(raw) : null;
  } catch (e) {
    // REST 失敗（網路、被擋）再退回 SDK
    const { m, db } = await firestore();
    const snap = await m.getDoc(m.doc(db, ...SITE_DOC));
    return snap.exists() ? normalize(snap.data()) : null;
  }
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
