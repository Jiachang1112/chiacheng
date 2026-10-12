// 後台的資料中心：草稿、發布、變更比對、操作紀錄
import { normalize, fingerprint, clone, DEFAULT_DATA, LS, safeUrl, uid } from '../data.js';
import * as cloud from './cloud.js';
import { debounce } from './ui.js';

export const state = {
  user: null,
  published: null,   // 目前線上版本（整理過）；讀不到時是 null
  draft: null,       // 正在編輯的草稿
  base: '',          // 草稿是以哪一版的發布時間為基礎
  isNew: false,      // 雲端還沒有任何資料
  dirty: false,      // 草稿和線上版本不一樣
  canPublish: false,
  loadError: '',
  pendingDraft: null, // 開啟後台時發現的本機草稿
  unread: 0,
  activity: [],
};

const subs = new Set();
export const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
export const emit = (why) => subs.forEach((fn) => fn(why));
export const rerender = () => emit('rerender');

// ============ 草稿 ============
function recompute() {
  state.dirty = !state.published || fingerprint(normalize(state.draft)) !== fingerprint(state.published);
}

const persistDraft = debounce(() => {
  try {
    if (!state.dirty) localStorage.removeItem(LS.draft);
    else localStorage.setItem(LS.draft, JSON.stringify({ base: state.base, savedAt: new Date().toISOString(), data: state.draft }));
  } catch (e) { /* 空間不足就略過 */ }
}, 300);
export const flushDraft = () => persistDraft.flush();

function readLocalDraft() {
  try {
    const raw = localStorage.getItem(LS.draft);
    const o = raw ? JSON.parse(raw) : null;
    return o && o.data ? o : null;
  } catch (e) {
    return null;
  }
}

// info：'修改了什麼' 或 { key, label }（同一個 key 在短時間內只記一筆）
export function mutate(info, fn) {
  fn(state.draft);
  recompute();
  persistDraft();
  logActivity(info);
  emit('draft');
}

export function replaceDraft(data, label) {
  state.draft = normalize(clone(data));
  recompute();
  persistDraft();
  if (label) logActivity(label);
  emit('replace');
}

// ============ 操作紀錄（只存在這台裝置） ============
function loadActivity() {
  try {
    state.activity = JSON.parse(localStorage.getItem(LS.activity) || '[]');
  } catch (e) {
    state.activity = [];
  }
}
function logActivity(info) {
  if (!info) return;
  const it = typeof info === 'string' ? { key: info, label: info } : info;
  const now = Date.now();
  const last = state.activity[0];
  if (last && last.key === it.key && now - last.t < 5 * 60 * 1000) {
    last.t = now;
    last.label = it.label;
  } else {
    state.activity.unshift({ t: now, key: it.key, label: it.label });
    state.activity = state.activity.slice(0, 60);
  }
  try { localStorage.setItem(LS.activity, JSON.stringify(state.activity)); } catch (e) { /* 略過 */ }
}

// ============ 載入 ============
export async function load() {
  loadActivity();
  state.loadError = '';
  state.pendingDraft = null;
  let raw = null;
  let ok = true;
  try {
    raw = await cloud.fetchSite();
  } catch (e) {
    ok = false;
    state.loadError = cloud.explain(e);
  }
  const saved = readLocalDraft();
  if (ok) {
    state.isNew = !raw;
    state.published = normalize(raw || DEFAULT_DATA);
    state.base = raw ? raw.updatedAt || '' : '';
    state.canPublish = true;
    state.draft = clone(state.published);
    if (saved && fingerprint(normalize(saved.data)) !== fingerprint(state.published)) state.pendingDraft = saved;
  } else {
    // 讀不到線上資料：不能發布，避免用預設內容蓋掉真正的資料
    state.published = null;
    state.canPublish = false;
    state.base = '';
    state.draft = normalize(saved ? saved.data : DEFAULT_DATA);
  }
  recompute();
  emit('load');
}

export function adoptPendingDraft() {
  if (!state.pendingDraft) return;
  state.draft = normalize(state.pendingDraft.data);
  state.pendingDraft = null;
  recompute();
  emit('replace');
}

export function dropPendingDraft() {
  state.pendingDraft = null;
  try { localStorage.removeItem(LS.draft); } catch (e) { /* 略過 */ }
}

// ============ 發布 ============
export async function remoteStamp() {
  const raw = await cloud.fetchSite();
  return raw ? raw.updatedAt || '' : '';
}

export async function publish(label) {
  const data = normalize(state.draft);
  data.updatedAt = new Date().toISOString();
  if (new Blob([JSON.stringify(data)]).size > 900 * 1024) {
    const e = new Error('too big');
    e.code = 'app/too-big';
    throw e;
  }
  await cloud.saveSite(data);
  let historyOk = true;
  try {
    await cloud.saveHistory(data, label);
  } catch (e) {
    historyOk = false;
  }
  state.published = data;
  state.base = data.updatedAt;
  state.isNew = false;
  state.canPublish = true;
  state.draft = clone(data);
  recompute();
  persistDraft();
  try { localStorage.setItem(LS.cache, JSON.stringify(data)); } catch (e) { /* 略過 */ }
  logActivity('發布到網站');
  emit('publish');
  return { historyOk };
}

export function discardDraft() {
  if (!state.published) return;
  replaceDraft(state.published, '放棄草稿，回到線上版本');
}

// ============ 檢查 ============
const URLISH = (v) => !v || !!safeUrl(v);

export function validate(d) {
  const errors = [];
  const warnings = [];
  if (!d.hero.name.trim()) errors.push('首頁姓名不能是空的。');
  const noName = d.projects.filter((p) => !p.name.trim()).length;
  if (noName) errors.push(`有 ${noName} 個專案沒有名稱。`);

  const badUrl = [];
  d.projects.forEach((p) => {
    if (!URLISH(p.links.github)) badUrl.push(`專案「${p.name || '未命名'}」的 GitHub 網址`);
    if (!URLISH(p.links.demo)) badUrl.push(`專案「${p.name || '未命名'}」的網站網址`);
  });
  d.links.forEach((l) => {
    if (!safeUrl(l.url)) badUrl.push(`連結「${l.title || '未命名'}」的網址`);
  });
  if (d.contact.github && !URLISH(d.contact.github)) badUrl.push('聯絡資訊的 GitHub 網址');
  if (badUrl.length) warnings.push('這些網址格式有問題，前台不會顯示：' + badUrl.join('、') + '。');

  const names = new Map();
  d.projects.forEach((p) => {
    const k = p.name.trim().toLowerCase();
    if (k) names.set(k, (names.get(k) || 0) + 1);
  });
  const dup = [...names.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dup.length) warnings.push('有重複的專案名稱：' + dup.join('、') + '。');

  if (d.contact.email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(d.contact.email)) warnings.push('Email 格式看起來不正確，前台不會顯示。');
  if (d.logs.some((l) => !l.date)) warnings.push('有日誌沒有填日期。');
  return { errors, warnings };
}

// ============ 變更摘要 ============
function listDiff(label, a, b) {
  const am = new Map(a.map((x) => [x.id, x]));
  const bm = new Map(b.map((x) => [x.id, x]));
  const added = b.filter((x) => !am.has(x.id)).length;
  const removed = a.filter((x) => !bm.has(x.id)).length;
  const changed = b.filter((x) => am.has(x.id) && JSON.stringify(am.get(x.id)) !== JSON.stringify(x)).length;
  const keptA = a.filter((x) => bm.has(x.id)).map((x) => x.id).join();
  const keptB = b.filter((x) => am.has(x.id)).map((x) => x.id).join();
  const parts = [];
  if (added) parts.push(`新增 ${added}`);
  if (changed) parts.push(`修改 ${changed}`);
  if (removed) parts.push(`刪除 ${removed}`);
  if (keptA !== keptB) parts.push('調整順序');
  return parts.length ? `${label}：${parts.join('、')}` : '';
}

export function diffSummary(a, b) {
  if (!a) return ['（無法和線上版本比對）'];
  const out = [];
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!same(a.hero, b.hero) || !same(a.about, b.about) || !same(a.contact, b.contact)) out.push('基本資料已修改');
  [['專案', 'projects'], ['技術分類', 'stack'], ['日誌', 'logs'], ['連結', 'links']].forEach(([label, key]) => {
    const line = listDiff(label, a[key], b[key]);
    if (line) out.push(line);
  });
  if (!same(a.settings, b.settings)) out.push('外觀與區塊設定已修改');
  return out;
}

export { uid };
