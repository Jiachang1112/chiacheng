// 前台與後台共用：預設資料、資料格式整理（normalize）、小工具
// 資料存在 Firestore 的 portfolio/site_data_v1，整份網站內容就是一個物件。

export const SCHEMA = 2;

export const STATUS = {
  live: '上線中',
  wip: '開發中',
  maintain: '維護中',
  archived: '已封存',
};

export const SECTION_KEYS = ['about', 'work', 'stack', 'devlog', 'links', 'contact'];
export const SECTION_LABELS = {
  about: '關於',
  work: '作品',
  stack: '技術',
  devlog: '日誌',
  links: '連結',
  contact: '聯絡',
};

// 配色：墨水（文字）、原子筆（連結與重點）、螢光筆（滑過與標記）
export const THEME_PRESETS = [
  { id: 'ballpoint', name: '原子筆藍', ink: '#1a2146', accent: '#2f45d1', mark: '#ffe56a' },
  { id: 'ink', name: '墨黑', ink: '#1c1c1f', accent: '#b3261e', mark: '#ffe56a' },
  { id: 'forest', name: '墨綠', ink: '#13332c', accent: '#0b7a5c', mark: '#e4f58a' },
  { id: 'berry', name: '莓紅', ink: '#3b1630', accent: '#b3245f', mark: '#ffd3e4' },
];

export const PAPER = '#fdfdfb';

// 搜尋結果（Google）與分享卡片用的標題與說明：沒填就用姓名與首頁文字自動產生。
// 前台套用到 <title>／<meta>，後台「搜尋結果」頁用同一個函式畫預覽，兩邊才不會不一致。
export function seoText(d) {
  const s = d.settings;
  return {
    title: s.siteTitle || `${d.hero.name} · 作品集`,
    desc: s.metaDescription || [d.hero.tagline, d.hero.intro].filter(Boolean).join(' ').slice(0, 120),
    titleAuto: !s.siteTitle,
    descAuto: !s.metaDescription,
  };
}

// ============ 預設內容（雲端沒有資料、或連不上時使用） ============
export const DEFAULT_DATA = {
  hero: {
    name: '洪嘉成',
    avatar: '',
    tagline: '白天忙別的事，晚上讓這些專案繼續跑。',
    intro: '自學開發者，這裡收著我目前還在維護、實際上線中的專案 — 從 LINE 機器人到 AI 代理系統都有。',
  },
  about: {
    body:
      '我喜歡把生活裡遇到的小麻煩，變成一個真的能上線用的小工具 — 提醒自己的 LINE 機器人、幫忙記帳的小工具、還在半夜爬起來修 bug 的日記 app。\n\n這一頁列的是目前還在維護、實際部署中的專案，技術細節、心得跟更完整的自我介紹，之後會持續補上。',
  },
  contact: {
    email: '',
    github: 'https://github.com/Jiachang1112',
    other: [],
  },
  logs: [
    {
      date: '2026-08-22',
      title: '',
      content: '網站開發者日誌正式上線囉！可以在這裡記錄一些隨筆或是開發進度更新。',
      pinned: false,
    },
  ],
  stack: [
    { title: '訊息與 AI', items: ['LINE Messaging API', 'Gemini API', 'Google AI Studio', 'Dify'] },
    { title: '資料庫', items: ['Firebase', 'Supabase', 'Neon'] },
    { title: '部署與託管', items: ['Render', 'Vercel', 'Zeabur', 'Cloudflare Pages', 'Cloudflare Workers', 'GitHub Pages'] },
    { title: '排程・通知・其他', items: ['Upstash QStash', 'cron-job.org', 'UptimeRobot', 'Formspree', 'Brevo', 'Workers KV', 'Google Cloud', 'Oracle Cloud'] },
  ],
  projects: [
    {
      category: 'LINE 機器人・自動化',
      name: 'my-line-bot',
      tagline: '串接 Gemini 的 LINE 聊天機器人',
      desc: '用 LINE Messaging API 打造的聊天機器人，後端串接 Gemini API 處理對話。另外做了一個用量儀表板，追蹤每日、每月的 API 用量，避免超過免費額度。部署在 Render，設有健康檢查端點。',
      tech: ['LINE Messaging API', 'Gemini API', 'Render'],
      links: {},
    },
    {
      category: 'LINE 機器人・自動化',
      name: 'Line reminder',
      tagline: '到時間就用 LINE 提醒你',
      desc: 'LINE 提醒功能機器人，用 Upstash QStash 排程推播訊息，資料存在 Neon（Postgres），另外架了一層 Cloudflare Workers 當 webhook proxy 增加穩定度。同時部署在 Zeabur 和 Render 兩個平台。',
      tech: ['LINE Messaging API', 'Upstash QStash', 'Neon', 'Cloudflare Workers', 'Zeabur'],
      links: { github: 'https://github.com/Jiachang1112/line-reminder' },
    },
    {
      category: 'LINE 機器人・自動化',
      name: '搶機（oracle-grabber）',
      tagline: '自動搶 Oracle Cloud 免費機器',
      desc: '監控並自動嘗試建立 Oracle Cloud「Always Free」方案的運算資源，用 cron-job.org 定時觸發重試，解決免費額度常態性缺貨、搶不到的問題。',
      tech: ['cron-job.org', 'Oracle Cloud'],
      links: {},
    },
    {
      category: 'AI 專案',
      name: 'AI-Assistant',
      tagline: '網頁版 AI 助理',
      desc: '網頁版的 AI 助理應用，串接 Gemini／Google AI Studio，做了對話紀錄後台可以回顧歷史對話。部署在 Render，另外用 UptimeRobot 監控服務是否正常運作。',
      tech: ['Gemini API', 'Firebase', 'Render', 'UptimeRobot'],
      links: {},
    },
    {
      category: 'AI 專案',
      name: 'ai-agents',
      tagline: '用 Dify 打造的 AI 代理系統',
      desc: '用 Dify 建構的 AI 代理（agent）系統，把 LINE 當作互動介面，還串了圖片生成功能。部署在 Vercel。',
      tech: ['Dify', 'LINE Messaging API', 'Vercel', 'Google AI Studio'],
      links: {},
    },
    {
      category: '生活與工具',
      name: 'journal',
      tagline: '雲端日記本',
      desc: '線上日記本的雲端版本，有自己的管理後台整理內容，另外做了一個優惠券管理系統模組。',
      tech: ['Firebase'],
      links: { github: 'https://github.com/Jiachang1112/journal' },
    },
    {
      category: '生活與工具',
      name: '我的專屬時光日記',
      tagline: '另一款日記類應用',
      desc: '另一個獨立的日記專案，一樣用 Firebase 做資料儲存，跟 journal 是不同時期做的兩次嘗試。',
      tech: ['Firebase'],
      links: { github: 'https://github.com/Jiachang1112/Jiachang-diary' },
    },
    {
      category: '生活與工具',
      name: 'Travel Pro',
      tagline: '旅遊行程規劃工具',
      desc: '旅遊規劃／行程管理工具，有後台可以管理內容，前端部署在 GitHub Pages，資料存 Firebase。',
      tech: ['Firebase', 'GitHub Pages'],
      links: { github: 'https://github.com/Jiachang1112/travel' },
    },
    {
      category: '生活與工具',
      name: 'gathering-point',
      tagline: '揪團集合地點協調工具',
      desc: '幫朋友、社團協調「約在哪裡見面」的小工具。這個專案的細節還在補充中。',
      tech: [],
      links: {},
      status: 'wip',
    },
    {
      category: '生活與工具',
      name: 'Jiachang',
      tagline: '個人雲端儲存空間',
      desc: '自己架設的雲端檔案儲存服務，附管理後台，資料庫用 Firebase。',
      tech: ['Firebase'],
      links: { github: 'https://github.com/Jiachang1112/Jiachang' },
    },
    {
      category: '生活與工具',
      name: 'SuperTool',
      tagline: '線上下單＋記帳的多功能工具',
      desc: '整合線上下單與記帳功能的多功能工具，後端同時用了 Firebase 和 Supabase，並設有 GitHub 自動部署流程與監視頁面。',
      tech: ['Firebase', 'Supabase', 'Google Cloud'],
      links: {},
    },
    {
      category: '網站作品・接案',
      name: '嘉成攝影',
      tagline: '一頁式攝影作品集網站',
      desc: '一頁式的攝影作品集網站，聯絡表單串接 Formspree，部署在 Cloudflare。',
      tech: ['Formspree', 'Cloudflare Pages'],
      links: {},
    },
    {
      category: '網站作品・接案',
      name: 'Eddie',
      tagline: '網站設計範本產生器',
      desc: '自己做的網站設計範本產生工具，其中一個實際案例是幫別人做的個人作品集網站。',
      tech: ['HTML/CSS'],
      links: { github: 'https://github.com/Jiachang1112/Eddie' },
    },
    {
      category: '基礎建設',
      name: 'chiacheng1112.com',
      tagline: '這個作品集網站本身',
      desc: '純靜態網站（HTML + CSS + JS），內容存在 Firebase，由自己的後台管理。',
      tech: ['HTML/CSS/JS', 'Firebase', 'Cloudflare'],
      links: { github: 'https://github.com/Jiachang1112/chiacheng', demo: 'https://chiacheng.vercel.app' },
    },
    {
      category: '基礎建設',
      name: 'chiacheng email send',
      tagline: '網站寄信服務',
      desc: '幫 chiacheng1112.com 處理寄信功能的後端服務，用 Brevo 的 SMTP，部署在 Vercel。',
      tech: ['Brevo', 'Vercel'],
      links: {},
    },
    {
      category: '基礎建設',
      name: 'temp-email',
      tagline: '臨時信箱系統',
      desc: '臨時（拋棄式）電子信箱系統，部署在 Cloudflare Workers，用 Workers KV 存資料。',
      tech: ['Cloudflare Workers', 'Workers KV'],
      links: { demo: 'https://temp-email.bruce9811123.workers.dev' },
    },
  ],
};

// ============ 小工具 ============
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, d = '') => (typeof v === 'string' ? v : v == null ? d : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);

export const clone = (v) => JSON.parse(JSON.stringify(v));

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function hash36(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 只允許 http(s)、mailto、tel；沒寫通訊協定的網址自動補 https://
export function safeUrl(u) {
  const s = str(u).trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  if (/\s/.test(s)) return '';
  return 'https://' + s.replace(/^\/+/, '');
}

// 圖片網址：http(s) 或 data:image
export function safeImg(u) {
  const s = str(u).trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

export function host(u) {
  try {
    return new URL(safeUrl(u)).hostname.replace(/^www\./, '');
  } catch (e) {
    return str(u);
  }
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(s) {
  const t = str(s);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.replace(/-/g, '.') : t;
}

// 很小的 Markdown：段落、換行、**粗體**、`程式碼`、[文字](網址)、- 清單
export function mdLite(src) {
  const inline = (t) =>
    t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const blocks = esc(str(src)).replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).filter(Boolean);
  return blocks
    .map((b) => {
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*]\s+/, '')) + '</li>').join('') + '</ul>';
      }
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    })
    .join('');
}

// ============ 顏色 ============
function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');

export function mixHex(a, b, t) {
  // t = a 的比例
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return toHex(A[0] * t + B[0] * (1 - t), A[1] * t + B[1] * (1 - t), A[2] * t + B[2] * (1 - t));
}

export function luminance(h) {
  const [r, g, b] = hexToRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// 依主題算出前台用到的 CSS 變數
export function themeVars(theme) {
  const t = theme || THEME_PRESETS[0];
  // 手寫字型筆畫細，次要文字的對比要比一般標準更高一點
  let dim = mixHex(t.ink, PAPER, 0.72);
  for (let w = 0.72; contrast(dim, PAPER) < 6 && w < 1; w += 0.05) dim = mixHex(t.ink, PAPER, w);
  const onAccent = contrast(t.accent, '#ffffff') >= contrast(t.accent, t.ink) ? '#ffffff' : t.ink;
  return {
    '--paper': PAPER,
    '--ink': t.ink,
    '--dim': dim,
    '--rule': mixHex(t.ink, PAPER, 0.15),
    '--accent': t.accent,
    '--on-accent': onAccent,
    '--mark': t.mark,
  };
}

// ============ 資料整理 ============
function toList(v) {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，、]/) : [];
  const out = [];
  list.forEach((x) => {
    const s = str(x).trim();
    if (s && !out.includes(s)) out.push(s);
  });
  return out;
}

function withIds(list, prefix, keyFn) {
  const used = new Set();
  return list.map((it) => {
    let id = typeof it.id === 'string' && it.id ? it.id : prefix + hash36(keyFn(it));
    const base = id;
    let n = 2;
    while (used.has(id)) id = base + '_' + n++;
    used.add(id);
    return { ...it, id };
  });
}

function normProject(p) {
  p = isObj(p) ? p : {};
  const links = isObj(p.links) ? p.links : {};
  return {
    id: str(p.id),
    category: str(p.category).trim() || '未分類',
    name: str(p.name),
    tagline: str(p.tagline),
    desc: str(p.desc),
    tech: toList(p.tech),
    links: { github: str(links.github).trim(), demo: str(links.demo).trim() },
    status: STATUS[p.status] ? p.status : 'live',
    featured: p.featured === true,
    year: str(p.year).trim(),
    cover: str(p.cover).trim(),
  };
}

function normSettings(s) {
  s = isObj(s) ? s : {};
  const t = isObj(s.theme) ? s.theme : {};
  const P = THEME_PRESETS[0];
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(str(v)) ? str(v).toLowerCase() : d);
  const seen = new Set();
  const sections = arr(s.sections)
    .filter((x) => isObj(x) && SECTION_KEYS.includes(x.key) && !seen.has(x.key) && seen.add(x.key))
    .map((x) => ({ key: x.key, visible: x.visible !== false }));
  SECTION_KEYS.forEach((k) => {
    if (!seen.has(k)) sections.push({ key: k, visible: true });
  });
  const w = isObj(s.work) ? s.work : {};
  const cf = isObj(s.contactForm) ? s.contactForm : {};
  const h = isObj(s.hero) ? s.hero : {};
  return {
    siteTitle: str(s.siteTitle).trim(),
    metaDescription: str(s.metaDescription).trim(),
    theme: { ink: hex(t.ink, P.ink), accent: hex(t.accent, P.accent), mark: hex(t.mark, P.mark) },
    footerText: str(s.footerText).trim(),
    sections,
    work: {
      defaultSort: ['default', 'az', 'category'].includes(w.defaultSort) ? w.defaultSort : 'default',
      showSearch: w.showSearch !== false,
      expandFirst: w.expandFirst === true,
    },
    contactForm: { enabled: cf.enabled === true, notice: str(cf.notice).trim() },
    hero: { showCard: h.showCard !== false },
  };
}

// 把任何來源（舊版雲端資料、匯入的 JSON、預設值）整理成固定格式。
// 舊版資料（沒有 schema 欄位）缺的部分會用預設內容補上，跟舊網站的行為一致。
export function normalize(input) {
  const D = DEFAULT_DATA;
  const src = isObj(input) ? input : {};
  const legacy = !(src.schema >= 2);

  const hero = isObj(src.hero) ? src.hero : {};
  const about = isObj(src.about) ? src.about : {};
  const contact = isObj(src.contact) ? src.contact : {};

  let projects = arr(src.projects);
  if (!Array.isArray(src.projects) || (legacy && projects.length === 0)) projects = D.projects;
  const stack = Array.isArray(src.stack) ? src.stack : D.stack;
  const logs = arr(src.logs);

  return {
    schema: SCHEMA,
    hero: {
      name: str(hero.name, D.hero.name),
      avatar: str(hero.avatar),
      tagline: str(hero.tagline, D.hero.tagline),
      intro: str(hero.intro, D.hero.intro),
    },
    about: { body: str(about.body, D.about.body) },
    contact: {
      email: str(contact.email).trim(),
      github: str(contact.github).trim(),
      other: arr(contact.other)
        .map((o) => ({ label: str(o && o.label).trim(), url: str(o && o.url).trim() }))
        .filter((o) => o.url),
    },
    stack: withIds(
      stack.map((g) => ({ id: str(g && g.id), title: str(g && g.title), items: toList(g && g.items) })),
      's_',
      (g) => g.title
    ),
    projects: withIds(projects.map(normProject), 'p_', (p) => p.category + '|' + p.name),
    logs: withIds(
      logs.map((l) => ({
        id: str(l && l.id),
        date: str(l && l.date).trim(),
        title: str(l && l.title),
        content: str(l && l.content),
        pinned: !!(l && l.pinned === true),
      })),
      'l_',
      (l) => l.date + '|' + l.content.slice(0, 40)
    ),
    links: withIds(
      arr(src.links).map((l) => ({ id: str(l && l.id), title: str(l && l.title), url: str(l && l.url).trim(), note: str(l && l.note) })),
      'k_',
      (l) => l.title + '|' + l.url
    ),
    settings: normSettings(src.settings),
    updatedAt: str(src.updatedAt),
  };
}

// 比對「內容是否一樣」用，忽略發布時間
export function fingerprint(d) {
  return JSON.stringify({ ...d, updatedAt: '' });
}

export function countTech(projects) {
  const set = new Set();
  projects.forEach((p) => (p.tech || []).forEach((t) => set.add(t.toLowerCase())));
  return set.size;
}

export function allTech(data) {
  // 每個技術被幾個專案用到（不分大小寫）
  const map = new Map();
  data.projects.forEach((p) =>
    p.tech.forEach((t) => {
      const k = t.toLowerCase();
      const cur = map.get(k) || { name: t, n: 0 };
      cur.n++;
      map.set(k, cur);
    })
  );
  return [...map.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'zh-Hant'));
}

export function isEmail(s) {
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(s || ''));
}

// 某個區塊有沒有內容可以顯示（沒內容的區塊前台會自動隱藏）
export function sectionHasContent(d, key) {
  switch (key) {
    case 'about': return !!d.about.body.trim();
    case 'work': return d.projects.length > 0;
    case 'stack': return d.stack.some((g) => g.items.length);
    case 'devlog': return d.logs.some((l) => l.content.trim() || l.title.trim());
    case 'links': return d.links.some((l) => safeUrl(l.url));
    case 'contact': return !!(isEmail(d.contact.email) || safeUrl(d.contact.github) || d.contact.other.some((o) => safeUrl(o.url)) || d.settings.contactForm.enabled);
    default: return false;
  }
}

export const LS = {
  cache: 'chiacheng_site_cache_v2',
  draft: 'chiacheng_admin_draft_v2',
  activity: 'chiacheng_admin_activity_v1',
};
