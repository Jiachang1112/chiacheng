// 後台用到的 Firebase 操作：登入、讀寫網站內容、版本紀錄、訊息
import { authKit, firestore, SITE_DOC } from '../store.js';

const clean = (o) => JSON.parse(JSON.stringify(o)); // 去掉 undefined，Firestore 不接受

// 把 Firebase 的錯誤碼翻成看得懂的話
export function explain(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-credential': '帳號或密碼不正確。',
    'auth/invalid-login-credentials': '帳號或密碼不正確。',
    'auth/wrong-password': '帳號或密碼不正確。',
    'auth/user-not-found': '帳號或密碼不正確。',
    'auth/invalid-email': 'Email 格式不正確。',
    'auth/missing-password': '請輸入密碼。',
    'auth/too-many-requests': '嘗試次數太多，請稍後再試，或用「忘記密碼」重設。',
    'auth/network-request-failed': '網路連線失敗，請確認網路後再試。',
    'auth/user-disabled': '這個帳號已被停用。',
    'permission-denied': '沒有權限。請確認登入的是管理員帳號，並已在 Firebase 套用專案裡的 firestore.rules。',
    'unavailable': '連不上 Firebase，請確認網路後再試。',
    'unauthenticated': '登入已過期，請重新登入。',
    'resource-exhausted': '超過 Firebase 的用量限制，請稍後再試。',
    'app/too-big': '資料太大，超過 Firestore 單一文件的限制。請縮小頭像或刪掉不需要的內容。',
  };
  if (map[code]) return map[code];
  if (err && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically/i.test(err.message || '')) {
    return '無法載入 Firebase 程式庫，請確認網路（或關閉會擋 Google 資源的外掛）後重新整理。';
  }
  return '發生未預期的錯誤：' + ((err && (err.message || err.code)) || '未知');
}

// ============ 登入 ============
export async function watchAuth(cb) {
  const { m, auth } = await authKit();
  return m.onAuthStateChanged(auth, cb);
}

export async function login(email, password, remember) {
  const { m, auth } = await authKit();
  await m.setPersistence(auth, remember ? m.browserLocalPersistence : m.browserSessionPersistence);
  return m.signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const { m, auth } = await authKit();
  return m.signOut(auth);
}

export async function resetPassword(email) {
  const { m, auth } = await authKit();
  return m.sendPasswordResetEmail(auth, email);
}

// ============ 網站內容 ============
// 回傳雲端原始資料；還沒有資料時回傳 null
export async function fetchSite() {
  const { m, db } = await firestore();
  const snap = await m.getDoc(m.doc(db, ...SITE_DOC));
  return snap.exists() ? snap.data() : null;
}

export async function saveSite(data) {
  const { m, db } = await firestore();
  await m.setDoc(m.doc(db, ...SITE_DOC), clean(data));
}

// ============ 版本紀錄 ============
const HISTORY = 'portfolio_history';
const KEEP = 20;

export async function saveHistory(data, label) {
  const { m, db } = await firestore();
  const json = JSON.stringify(clean(data));
  await m.addDoc(m.collection(db, HISTORY), {
    savedAt: new Date().toISOString(),
    label: label || '',
    size: new Blob([json]).size,
    json,
  });
  // 只留最近 KEEP 筆
  const q = m.query(m.collection(db, HISTORY), m.orderBy('savedAt', 'desc'), m.limit(KEEP + 20));
  const snap = await m.getDocs(q);
  const old = snap.docs.slice(KEEP);
  await Promise.all(old.map((d) => m.deleteDoc(m.doc(db, HISTORY, d.id))));
}

export async function listHistory() {
  const { m, db } = await firestore();
  const q = m.query(m.collection(db, HISTORY), m.orderBy('savedAt', 'desc'), m.limit(KEEP));
  const snap = await m.getDocs(q);
  return snap.docs.map((d) => {
    const v = d.data();
    return { id: d.id, savedAt: v.savedAt, label: v.label || '', size: v.size || 0, json: v.json };
  });
}

// ============ 訊息收件匣 ============
export async function listMessages() {
  const { m, db } = await firestore();
  const q = m.query(m.collection(db, 'messages'), m.orderBy('createdAt', 'desc'), m.limit(200));
  const snap = await m.getDocs(q);
  return snap.docs.map((d) => {
    const v = d.data();
    const t = v.createdAt && v.createdAt.toDate ? v.createdAt.toDate().toISOString() : '';
    return { id: d.id, name: v.name || '', email: v.email || '', message: v.message || '', read: v.read === true, createdAt: t };
  });
}

export async function setMessageRead(id, read) {
  const { m, db } = await firestore();
  await m.updateDoc(m.doc(db, 'messages', id), { read });
}

export async function deleteMessage(id) {
  const { m, db } = await firestore();
  await m.deleteDoc(m.doc(db, 'messages', id));
}

// 舊版 admin.html 寫進 links 集合的連結
export async function fetchLegacyLinks() {
  const { m, db } = await firestore();
  const snap = await m.getDocs(m.collection(db, 'links'));
  return snap.docs.map((d) => {
    const v = d.data();
    return { title: v.title || '', url: v.url || '' };
  }).filter((l) => l.url);
}
