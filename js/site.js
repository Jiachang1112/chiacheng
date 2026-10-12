// 前台：讀取資料、產生頁面、捲動淡入。
import {
  DEFAULT_DATA, SECTION_LABELS, STATUS,
  normalize, fingerprint, esc, safeUrl, safeImg, host, mdLite, fmtDate, themeVars, countTech, isEmail, sectionHasContent,
} from './data.js';
import { loadPublished, readCache, writeCache, readDraft, sendMessage } from './store.js';

const params = new URLSearchParams(location.search);
// live：一般瀏覽；embed：被後台的即時預覽嵌入；preview：後台「在新分頁預覽」
const MODE = params.has('embed') ? 'embed' : params.has('preview') ? 'preview' : 'live';
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const app = document.getElementById('app');

let DATA = null;
let RV = 'reveal'; // 產生 HTML 時使用；資料更新時改成 'reveal in'，避免已經看到的內容再淡入一次
const view = { q: '', cat: 'all', sort: 'default', sortTouched: false, open: new Set(), openInit: false };

// ============ 小工具 ============
const $ = (sel, root = document) => root.querySelector(sel);

function nameUnits(name) {
  let u = 0;
  for (const ch of String(name)) u += /[⺀-鿿＀-￯]/.test(ch) ? 1 : 0.58;
  return Math.max(2, u);
}

function hasContent(key) {
  return sectionHasContent(DATA, key);
}

// ============ 各區塊 ============
function heroHtml() {
  const d = DATA;
  const n = d.projects.length;
  const up = d.projects.filter((p) => p.status === 'live' || p.status === 'maintain').length;
  const t = countTech(d.projects);
  const facts = n
    ? `共 <b>${n}</b> 個專案${up ? `，其中 <b>${up}</b> 個上線或維護中` : ''}${t ? `；用過 <b>${t}</b> 項技術` : ''}。`
    : '';
  const photo = safeImg(d.hero.avatar);
  return `
  <section class="hero${photo ? ' has-photo' : ''}" id="hero">
    <div class="wrap hero-grid">
      <div>
        <h1 class="hero-name ${RV}" style="--u:${nameUnits(d.hero.name).toFixed(2)}">${esc(d.hero.name)}</h1>
        ${d.hero.tagline ? `<p class="hero-tagline ${RV}" style="--i:1">${esc(d.hero.tagline)}</p>` : ''}
        ${d.hero.intro ? `<p class="hero-intro ${RV}" style="--i:2">${esc(d.hero.intro).replace(/\n/g, '<br>')}</p>` : ''}
        ${facts ? `<p class="hero-facts ${RV}" style="--i:3">${facts}</p>` : ''}
      </div>
      ${photo ? `<figure class="hero-photo ${RV}" style="--i:2"><img src="${esc(photo)}" alt="${esc(d.hero.name)}"></figure>` : ''}
    </div>
  </section>`;
}

function aboutHtml() {
  return `
  <section class="sec" id="about"><div class="wrap">
    <div class="sec-head ${RV}"><h2>${SECTION_LABELS.about}</h2></div>
    <div class="about-body md ${RV}">${mdLite(DATA.about.body)}</div>
  </div></section>`;
}

function sortedProjects(list) {
  const a = list.slice();
  if (view.sort === 'az') a.sort((x, y) => x.name.localeCompare(y.name, 'zh-Hant'));
  else if (view.sort === 'category') a.sort((x, y) => x.category.localeCompare(y.category, 'zh-Hant'));
  else a.sort((x, y) => (y.featured ? 1 : 0) - (x.featured ? 1 : 0));
  return a;
}

function filteredProjects() {
  let list = DATA.projects;
  if (view.cat !== 'all') list = list.filter((p) => p.category === view.cat);
  const q = view.q.trim().toLowerCase();
  if (q) {
    list = list.filter((p) =>
      [p.name, p.tagline, p.desc, p.category, ...p.tech].some((s) => String(s).toLowerCase().includes(q))
    );
  }
  return sortedProjects(list);
}

function rowHtml(p, i) {
  const open = view.open.has(p.id);
  const gh = safeUrl(p.links.github);
  const demo = safeUrl(p.links.demo);
  const links = [];
  if (gh) links.push(`<a href="${esc(gh)}" target="_blank" rel="noopener">GitHub</a>`);
  if (demo) links.push(`<a href="${esc(demo)}" target="_blank" rel="noopener">查看網站</a>`);
  if (!links.length) links.push('<span class="d-none">目前沒有公開連結</span>');
  const cover = safeImg(p.cover);
  const state = [STATUS[p.status], p.year].filter(Boolean).join('　');
  return `
  <li class="row ${RV}" style="--i:${i < 6 ? i : 0}" data-id="${esc(p.id)}">
    <button type="button" class="row-head" aria-expanded="${open}" aria-controls="d-${i}">
      <span class="r-main">
        <span class="r-name">${esc(p.name)}</span>
        ${p.tagline ? `<span class="r-tag">${esc(p.tagline)}</span>` : ''}
      </span>
      <span class="r-meta">
        <span class="r-cat">${esc(p.category)}</span>
        <span class="r-state">${esc(state)}${p.featured ? '　精選' : ''}</span>
      </span>
      <span class="r-icon" aria-hidden="true"></span>
    </button>
    <div class="row-detail${open ? ' open' : ''}" id="d-${i}">
      <div class="row-detail-in">
        ${cover ? `<img class="d-cover" src="${esc(cover)}" alt="${esc(p.name)} 的畫面" loading="lazy">` : ''}
        ${p.desc ? `<p class="d-desc">${esc(p.desc)}</p>` : ''}
        ${p.tech.length ? `<p class="d-tech"><b>使用</b>${p.tech.map((i) => `<span class="it">${esc(i)}</span>`).join('、')}</p>` : ''}
        <div class="d-links">${links.join('')}</div>
      </div>
    </div>
  </li>`;
}

function workListHtml() {
  const list = filteredProjects();
  if (!list.length) return `<li class="empty">找不到符合的專案，換個關鍵字或分類試試。</li>`;
  return list.map(rowHtml).join('');
}

function workHtml() {
  const s = DATA.settings.work;
  const cats = [];
  DATA.projects.forEach((p) => {
    const c = cats.find((x) => x.name === p.category);
    if (c) c.n++;
    else cats.push({ name: p.category, n: 1 });
  });
  if (view.cat !== 'all' && !cats.some((c) => c.name === view.cat)) view.cat = 'all';
  if (!view.sortTouched) view.sort = s.defaultSort;
  if (s.expandFirst && !view.openInit && DATA.projects.length) {
    view.open.add(sortedProjects(DATA.projects)[0].id);
  }
  view.openInit = true;

  const tools = s.showSearch
    ? `
    <div class="tools ${RV}">
      <label class="search"><span class="sr">搜尋專案</span><input type="search" id="q" value="${esc(view.q)}" placeholder="搜尋專案或技術" autocomplete="off"></label>
      <div class="filters" role="group" aria-label="依分類篩選">
        <button type="button" class="flt" data-cat="all" aria-pressed="${view.cat === 'all'}">全部<small>${DATA.projects.length}</small></button>
        ${cats.map((c) => `<button type="button" class="flt" data-cat="${esc(c.name)}" aria-pressed="${view.cat === c.name}">${esc(c.name)}<small>${c.n}</small></button>`).join('')}
      </div>
      <label class="sort"><span class="sr">排序方式</span>
        <select id="sort">
          <option value="default"${view.sort === 'default' ? ' selected' : ''}>預設排序</option>
          <option value="az"${view.sort === 'az' ? ' selected' : ''}>名稱排序</option>
          <option value="category"${view.sort === 'category' ? ' selected' : ''}>分類排序</option>
        </select>
      </label>
    </div>`
    : '';

  return `
  <section class="sec" id="work"><div class="wrap">
    <div class="sec-head ${RV}"><h2>${SECTION_LABELS.work}</h2><span class="sec-note">點一下專案，展開詳細介紹</span></div>
    ${tools}
    <ol class="index" id="workList">${workListHtml()}</ol>
  </div></section>`;
}

function stackHtml() {
  const groups = DATA.stack.filter((g) => g.items.length);
  return `
  <section class="sec" id="stack"><div class="wrap">
    <div class="sec-head ${RV}"><h2>${SECTION_LABELS.stack}</h2><span class="sec-note">用過、串過、部署過的工具</span></div>
    <div class="stack">
      ${groups.map((g, i) => `<div class="${RV}" style="--i:${i}"><h3>${esc(g.title)}</h3><p>${g.items.map((i) => `<span class="it">${esc(i)}</span>`).join('、')}</p></div>`).join('')}
    </div>
  </div></section>`;
}

function devlogHtml() {
  const logs = DATA.logs
    .filter((l) => l.content.trim() || l.title.trim())
    .slice()
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
  return `
  <section class="sec" id="devlog"><div class="wrap">
    <div class="sec-head ${RV}"><h2>${SECTION_LABELS.devlog}</h2></div>
    <div class="logs">
      ${logs.map((l, i) => `
      <article class="log ${RV}" style="--i:${i < 3 ? i : 0}">
        <div class="log-date">${esc(fmtDate(l.date))}</div>
        <div>
          ${l.title ? `<h3>${esc(l.title)}${l.pinned ? '<span class="pin">置頂</span>' : ''}</h3>` : l.pinned ? '<h3><span class="pin" style="margin-left:0">置頂</span></h3>' : ''}
          <div class="log-body md">${mdLite(l.content)}</div>
        </div>
      </article>`).join('')}
    </div>
  </div></section>`;
}

function linksHtml() {
  const list = DATA.links.filter((l) => safeUrl(l.url));
  return `
  <section class="sec" id="links"><div class="wrap">
    <div class="sec-head ${RV}"><h2>${SECTION_LABELS.links}</h2></div>
    <ul class="linklist">
      ${list.map((l, i) => `
      <li class="${RV}" style="--i:${i < 5 ? i : 0}"><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">
        <span class="ll-title">${esc(l.title || host(l.url))}</span>
        <span class="ll-note">${esc(l.note)}</span>
        <span class="ll-host">${esc(host(l.url))}</span>
      </a></li>`).join('')}
    </ul>
  </div></section>`;
}

function contactHtml() {
  const c = DATA.contact;
  const rows = [];
  if (isEmail(c.email)) rows.push(['Email', `mailto:${c.email}`, c.email, false]);
  const gh = safeUrl(c.github);
  if (gh) rows.push(['GitHub', gh, gh.replace(/^https?:\/\//, ''), true]);
  c.other.forEach((o) => {
    const u = safeUrl(o.url);
    if (u) rows.push([o.label || host(u), u, u.replace(/^https?:\/\//, ''), true]);
  });
  const cf = DATA.settings.contactForm;
  const form = cf.enabled
    ? `
    <form class="form ${RV}" id="contactForm" novalidate>
      <h3>留個訊息給我</h3>
      ${cf.notice ? `<p>${esc(cf.notice)}</p>` : ''}
      <label>名字<input name="name" maxlength="80" autocomplete="name" required></label>
      <label>Email（要回信給你用）<input name="email" type="email" maxlength="120" autocomplete="email" required></label>
      <label>想說的話<textarea name="message" maxlength="2000" required></textarea></label>
      <div class="hp" aria-hidden="true"><label>網站<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <button class="btn" type="submit">送出訊息</button>
      <div class="form-msg" role="status"></div>
    </form>`
    : '';
  return `
  <section class="sec" id="contact"><div class="wrap">
    <div class="sec-head ${RV}"><h2>${SECTION_LABELS.contact}</h2></div>
    ${rows.length ? `<div class="contacts">
      ${rows.map(([label, href, val, ext], i) => `
      <a class="c-row ${RV}" style="--i:${i}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>
        <span class="c-label">${esc(label)}</span><span class="c-val">${esc(val)}</span>
      </a>`).join('')}
    </div>` : ''}
    ${form}
  </div></section>`;
}

const SECTIONS = { about: aboutHtml, work: workHtml, stack: stackHtml, devlog: devlogHtml, links: linksHtml, contact: contactHtml };

function build() {
  const d = DATA;
  const secs = d.settings.sections.filter((s) => s.visible && hasContent(s.key));
  const nav = secs.map((s) => `<a href="#${s.key}">${SECTION_LABELS[s.key]}</a>`).join('');
  return `
  <a class="skip" href="#main">跳到主要內容</a>
  <header class="top" id="top"><div class="top-in">
    <a class="brand" href="#hero">${esc(d.hero.name)}</a>
    <nav class="nav" aria-label="頁面區塊">${nav}</nav>
  </div></header>
  <main id="main">
    ${heroHtml()}
    ${secs.map((s) => SECTIONS[s.key]()).join('')}
  </main>
  <footer class="foot"><div class="wrap foot-in">
    <span>© ${new Date().getFullYear()} ${esc(d.hero.name)}${d.settings.footerText ? '　' + esc(d.settings.footerText) : ''}</span>
    <span><a href="#top">回到頂端</a>　<a href="admin.html">管理</a></span>
  </div></footer>
  ${MODE === 'preview' ? '<div class="pv-bar"><span>預覽草稿，尚未發布到網站。</span><a href="index.html">離開預覽</a></div>' : ''}`;
}

// ============ 畫面更新 ============
function applyMeta() {
  const s = DATA.settings;
  const root = document.documentElement;
  const vars = themeVars(s.theme);
  Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
  document.title = s.siteTitle || `${DATA.hero.name} · 作品集`;
  const meta = $('meta[name="description"]');
  if (meta && s.metaDescription) meta.setAttribute('content', s.metaDescription);
  const tc = $('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', vars['--paper']);
}

let io = null;
function observeReveals() {
  const els = [...app.querySelectorAll('.reveal:not(.in)')];
  if (!els.length) return;
  if (REDUCE || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return;
  }
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((e) => {
    // 比螢幕高很多的區塊永遠湊不到 15%，直接顯示
    if (e.getBoundingClientRect().height > innerHeight * 1.4) e.classList.add('in');
    else io.observe(e);
  });
}

function paint(data, { instant = false } = {}) {
  DATA = data;
  RV = instant ? 'reveal in' : 'reveal';
  const y = window.scrollY;
  const keep = app.offsetHeight;
  if (io) io.disconnect();
  applyMeta();
  if (keep) app.style.minHeight = keep + 'px';
  app.innerHTML = build();
  observeReveals();
  app.style.minHeight = '';
  if (y) window.scrollTo({ top: y, behavior: 'instant' });
  RV = 'reveal';
}

function updateWorkList() {
  const list = $('#workList');
  if (!list) return;
  const prev = RV;
  RV = 'reveal in';
  list.innerHTML = workListHtml();
  RV = prev;
}

// ============ 互動 ============
app.addEventListener('click', (e) => {
  const head = e.target.closest('.row-head');
  if (head) {
    const li = head.closest('.row');
    const id = li.dataset.id;
    const open = head.getAttribute('aria-expanded') !== 'true';
    head.setAttribute('aria-expanded', String(open));
    $('.row-detail', li).classList.toggle('open', open);
    if (open) view.open.add(id);
    else view.open.delete(id);
    return;
  }
  const flt = e.target.closest('.flt');
  if (flt) {
    view.cat = flt.dataset.cat;
    app.querySelectorAll('.flt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === view.cat)));
    updateWorkList();
  }
});

app.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    view.q = e.target.value;
    updateWorkList();
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'sort') {
    view.sort = e.target.value;
    view.sortTouched = true;
    updateWorkList();
  }
});

app.addEventListener('submit', async (e) => {
  if (e.target.id !== 'contactForm') return;
  e.preventDefault();
  const form = e.target;
  const msg = $('.form-msg', form);
  const btn = $('button[type="submit"]', form);
  const say = (t, err) => {
    msg.textContent = t;
    msg.classList.toggle('err', !!err);
  };
  if (MODE !== 'live') return say('預覽模式不會送出訊息。', true);
  const f = new FormData(form);
  if (String(f.get('website') || '').trim()) return say('已送出，謝謝你！'); // 機器人填了隱藏欄位，假裝成功
  const name = String(f.get('name') || '').trim();
  const email = String(f.get('email') || '').trim();
  const message = String(f.get('message') || '').trim();
  if (!name) return say('請填寫名字。', true);
  if (!isEmail(email)) return say('Email 格式不正確。', true);
  if (message.length < 5) return say('訊息至少要 5 個字。', true);
  try {
    const last = Number(localStorage.getItem('chiacheng_msg_last') || 0);
    if (Date.now() - last < 60000) return say('剛剛才送出過，請一分鐘後再試。', true);
  } catch (err) { /* 無痕模式讀不到就略過 */ }
  btn.disabled = true;
  say('送出中…');
  try {
    await sendMessage({ name, email, message });
    try { localStorage.setItem('chiacheng_msg_last', String(Date.now())); } catch (err) { /* 略過 */ }
    form.reset();
    say('已送出，謝謝你！我會盡快回覆。');
  } catch (err) {
    say('現在送不出去，請改用上面的聯絡方式。', true);
  } finally {
    btn.disabled = false;
  }
});

// ============ 啟動 ============
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const defaults = () => normalize(DEFAULT_DATA);

(async function main() {
  if (MODE === 'embed') {
    // 後台即時預覽：等後台把草稿傳進來
    paint(defaults(), { instant: true });
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin) return;
      const m = e.data || {};
      if (m.type === 'chiacheng-draft' && m.data) paint(normalize(m.data), { instant: true });
      if (m.type === 'chiacheng-goto' && typeof m.hash === 'string' && /^#[a-z]+$/.test(m.hash)) {
        const el = $(m.hash);
        if (el) el.scrollIntoView({ block: 'start' });
      }
    });
    parent.postMessage({ type: 'chiacheng-ready' }, location.origin);
    return;
  }

  if (MODE === 'preview') {
    paint(readDraft() || readCache() || defaults());
    return;
  }

  const cached = readCache();
  const remote = loadPublished().then((d) => d || null).catch(() => undefined); // undefined = 連線失敗

  if (cached) {
    // 有快取：先秒開，雲端資料不一樣再悄悄換掉
    paint(cached);
    const r = await remote;
    if (r) {
      if (fingerprint(r) !== fingerprint(cached)) paint(r, { instant: true });
      writeCache(r);
    }
    return;
  }

  // 第一次造訪：最多等 1.5 秒拿雲端資料，拿不到就先用預設內容
  const first = await Promise.race([remote, sleep(1500).then(() => 'timeout')]);
  if (first && first !== 'timeout') {
    paint(first);
    writeCache(first);
    return;
  }
  paint(defaults());
  remote.then((late) => {
    if (late) {
      paint(late, { instant: true });
      writeCache(late);
    }
  });
})();
