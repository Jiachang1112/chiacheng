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
// 裝置偵測在 <head> 的 js/device.js 完成；萬一那支檔案沒載入，退回只看視窗寬度
const Dev = window.Device || {
  current: () => (innerWidth <= 720 ? 'mobile' : 'desktop'),
  mode: () => 'auto',
  set() {},
  onChange() {},
};
const isMobile = () => Dev.current() === 'mobile';

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
// 每個區塊都是兩欄：左邊是標題（桌機會跟著捲動），右邊是內容
function sec(key, note, body) {
  return `
  <section class="sec" id="${key}"><div class="wrap sec-grid">
    <div class="sec-head ${RV}"><h2><span>${SECTION_LABELS[key]}</span></h2>${note ? `<p class="sec-note">${note}</p>` : ''}</div>
    <div class="sec-body">${body}</div>
  </div></section>`;
}

// 首頁右側「正在線上運作」：精選的排前面，其餘照後台的順序
function liveProjects() {
  const live = DATA.projects.filter((p) => p.status === 'live' || p.status === 'maintain');
  return { total: live.length, list: live.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 6) };
}

function noteCardHtml(hasWork) {
  if (!DATA.settings.hero.showCard) return '';
  const { total, list } = liveProjects();
  if (!list.length) return '';
  const t = countTech(DATA.projects);
  return `
  <aside class="notecard ${RV}" style="--i:2" aria-labelledby="nc-t">
    <span class="tape" aria-hidden="true"></span>
    <div class="nc-head"><h2 id="nc-t">正在線上運作</h2><span class="nc-count">${total}</span></div>
    <ul class="nc-list">
      ${list.map((p) => `
      <li><a href="#work" data-open="${esc(p.id)}"><i class="dot ${esc(p.status)}" aria-hidden="true"></i><span class="nc-txt"><span class="nc-name">${esc(p.name)}</span>${p.tagline ? `<span class="nc-tag">${esc(p.tagline)}</span>` : ''}</span></a></li>`).join('')}
    </ul>
    <p class="nc-foot">共 ${DATA.projects.length} 個專案${t ? `，用過 ${t} 項技術` : ''}。${hasWork ? ' <a href="#work">看全部</a>' : ''}</p>
  </aside>`;
}

function heroHtml(secs) {
  const d = DATA;
  const photo = safeImg(d.hero.avatar);
  const has = (k) => secs.some((s) => s.key === k);
  const ctas = [];
  if (has('work')) ctas.push('<a class="btn" href="#work">看作品</a>');
  if (has('contact')) ctas.push('<a class="btn-link" href="#contact">聯絡我</a>');
  return `
  <section class="hero" id="hero">
    <div class="wrap hero-grid">
      <div class="hero-main">
        <h1 class="hero-name ${RV}" style="--u:${nameUnits(d.hero.name).toFixed(2)}">${esc(d.hero.name)}</h1>
        ${d.hero.tagline ? `<p class="hero-tagline ${RV}" style="--i:1">${esc(d.hero.tagline)}</p>` : ''}
        ${d.hero.intro ? `<p class="hero-intro ${RV}" style="--i:2">${esc(d.hero.intro).replace(/\n/g, '<br>')}</p>` : ''}
        ${ctas.length ? `<div class="hero-cta ${RV}" style="--i:3">${ctas.join('')}</div>` : ''}
      </div>
      <div class="hero-side">
        ${photo ? `<figure class="hero-photo ${RV}" style="--i:1"><span class="tape" aria-hidden="true"></span><img src="${esc(photo)}" alt="${esc(d.hero.name)}"></figure>` : ''}
        ${noteCardHtml(has('work'))}
      </div>
    </div>
  </section>`;
}

function aboutHtml() {
  return sec('about', '', `<div class="about-body md ${RV}">${mdLite(DATA.about.body)}</div>`);
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
  if (demo) links.push(`<a href="${esc(demo)}" target="_blank" rel="noopener">查看網站<span aria-hidden="true"> ↗</span></a>`);
  if (gh) links.push(`<a href="${esc(gh)}" target="_blank" rel="noopener">GitHub<span aria-hidden="true"> ↗</span></a>`);
  const cover = safeImg(p.cover);
  const state = [STATUS[p.status], p.year].filter(Boolean).join('・');
  const did = 'd-' + p.id;
  return `
  <li class="row ${RV}" style="--i:${i < 6 ? i : 0}" data-id="${esc(p.id)}">
    <button type="button" class="row-head" aria-expanded="${open}" aria-controls="${esc(did)}">
      <i class="dot ${esc(p.status)}" aria-hidden="true"></i>
      <span class="r-main">
        <span class="r-name">${esc(p.name)}${p.featured ? '<span class="pin">精選</span>' : ''}</span>
        ${p.tagline ? `<span class="r-tag">${esc(p.tagline)}</span>` : ''}
      </span>
      <span class="r-meta">
        <span class="r-cat">${esc(p.category)}</span>
        <span class="r-state">${esc(state)}</span>
      </span>
      <span class="r-icon" aria-hidden="true"></span>
    </button>
    <div class="row-detail${open ? ' open' : ''}" id="${esc(did)}" role="region" aria-label="${esc(p.name)} 的介紹">
      <div class="row-clip"><div class="row-detail-in${links.length ? '' : ' solo'}">
        <div class="d-main">
          ${cover ? `<img class="d-cover" src="${esc(cover)}" alt="${esc(p.name)} 的畫面" loading="lazy">` : ''}
          ${p.desc ? `<p class="d-desc">${esc(p.desc)}</p>` : '<p class="d-desc d-none">還沒有詳細介紹。</p>'}
          ${p.tech.length ? `<ul class="d-tech" aria-label="使用的技術">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        </div>
        ${links.length ? `<div class="d-side">${links.join('')}</div>` : ''}
      </div></div>
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
      <label class="sort"><span class="sr">排序方式</span>
        <select id="sort">
          <option value="default"${view.sort === 'default' ? ' selected' : ''}>預設排序</option>
          <option value="az"${view.sort === 'az' ? ' selected' : ''}>名稱排序</option>
          <option value="category"${view.sort === 'category' ? ' selected' : ''}>分類排序</option>
        </select>
      </label>
      <div class="filters" role="group" aria-label="依分類篩選">
        <button type="button" class="flt" data-cat="all" aria-pressed="${view.cat === 'all'}">全部<small>${DATA.projects.length}</small></button>
        ${cats.map((c) => `<button type="button" class="flt" data-cat="${esc(c.name)}" aria-pressed="${view.cat === c.name}">${esc(c.name)}<small>${c.n}</small></button>`).join('')}
      </div>
    </div>`
    : '';

  return sec('work', `${DATA.projects.length} 個專案。點一下看介紹。`, `${tools}<ol class="index" id="workList">${workListHtml()}</ol>`);
}

function stackHtml() {
  const groups = DATA.stack.filter((g) => g.items.length);
  return sec('stack', '用過、串過、部署過的工具。', `
    <dl class="stack">
      ${groups.map((g, i) => `<div class="${RV}" style="--i:${i}"><dt>${esc(g.title)}</dt><dd>${g.items.map((t) => `<span class="it">${esc(t)}</span>`).join('、')}</dd></div>`).join('')}
    </dl>`);
}

function devlogHtml() {
  const logs = DATA.logs
    .filter((l) => l.content.trim() || l.title.trim())
    .slice()
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
  return sec('devlog', `${logs.length} 篇`, `
    <div class="logs">
      ${logs.map((l, i) => `
      <article class="log ${RV}" style="--i:${i < 3 ? i : 0}">
        <div class="log-date">${esc(fmtDate(l.date))}</div>
        <div>
          ${l.title ? `<h3>${esc(l.title)}${l.pinned ? '<span class="pin">置頂</span>' : ''}</h3>` : l.pinned ? '<h3><span class="pin" style="margin-left:0">置頂</span></h3>' : ''}
          <div class="log-body md">${mdLite(l.content)}</div>
        </div>
      </article>`).join('')}
    </div>`);
}

function linksHtml() {
  const list = DATA.links.filter((l) => safeUrl(l.url));
  return sec('links', '', `
    <ul class="linklist">
      ${list.map((l, i) => `
      <li class="${RV}" style="--i:${i < 5 ? i : 0}"><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">
        <span class="ll-title">${esc(l.title || host(l.url))}</span>
        <span class="ll-note">${esc(l.note)}</span>
        <span class="ll-host">${esc(host(l.url))}<span aria-hidden="true"> ↗</span></span>
      </a></li>`).join('')}
    </ul>`);
}

function contactRows() {
  const c = DATA.contact;
  const rows = [];
  if (isEmail(c.email)) rows.push(['Email', `mailto:${c.email}`, c.email, false]);
  const gh = safeUrl(c.github);
  if (gh) rows.push(['GitHub', gh, gh.replace(/^https?:\/\//, ''), true]);
  c.other.forEach((o) => {
    const u = safeUrl(o.url);
    if (u) rows.push([o.label || host(u), u, u.replace(/^https?:\/\//, ''), true]);
  });
  return rows;
}

function contactHtml() {
  const rows = contactRows();
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
  return sec('contact', '', `
    ${rows.length ? `<div class="contacts">
      ${rows.map(([label, href, val, ext], i) => `
      <a class="c-row ${RV}" style="--i:${i}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>
        <span class="c-label">${esc(label)}</span><span class="c-val">${esc(val)}</span>
      </a>`).join('')}
    </div>` : ''}
    ${form}`);
}

const SECTIONS = { about: aboutHtml, work: workHtml, stack: stackHtml, devlog: devlogHtml, links: linksHtml, contact: contactHtml };

// 手動切換版面：現在是手機版就提供「電腦版」，反之亦然；手動選過之後多一個「自動偵測」
function switchHtml() {
  if (MODE === 'embed') return '';
  const mob = isMobile();
  return `<button type="button" data-switch="${mob ? 'desktop' : 'mobile'}">${mob ? '電腦版' : '手機版'}</button>${Dev.mode() !== 'auto' ? '<button type="button" data-switch="auto">自動偵測</button>' : ''}`;
}

function footHtml(secs) {
  const d = DATA;
  const nav = secs.map((s) => `<a href="#${s.key}">${SECTION_LABELS[s.key]}</a>`).join('');
  const rows = contactRows().slice(0, 3);
  return `
  <footer class="foot"><div class="wrap">
    <div class="foot-grid">
      <div class="foot-id"><strong>${esc(d.hero.name)}</strong>${d.hero.tagline ? `<p>${esc(d.hero.tagline)}</p>` : ''}</div>
      ${nav ? `<nav class="foot-nav" aria-label="頁尾選單">${nav}</nav>` : ''}
      ${rows.length ? `<div class="foot-contact">${rows.map(([label, href, val, ext]) => `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(label)}</a>`).join('')}</div>` : ''}
    </div>
    <div class="foot-base">
      <span>© ${new Date().getFullYear()} ${esc(d.hero.name)}${d.settings.footerText ? '　' + esc(d.settings.footerText) : ''}</span>
      <span><span class="foot-sw" data-sw>${switchHtml()}</span><a href="#top">回到頂端 <span aria-hidden="true">↑</span></a><a href="admin.html">管理</a></span>
    </div>
  </div></footer>`;
}

// 手機版的底部導覽：首頁＋最多兩個常用區塊＋「目錄」
const DOCK_PRIORITY = ['work', 'contact', 'about', 'devlog', 'links', 'stack'];
function dockHtml(secs) {
  const keys = DOCK_PRIORITY.filter((k) => secs.some((s) => s.key === k)).slice(0, 2);
  const order = secs.map((s) => s.key).filter((k) => keys.includes(k));
  return `
  <nav class="dock" aria-label="快速切換">
    <a href="#hero" data-dock="hero"><span>首頁</span></a>
    ${order.map((k) => `<a href="#${k}" data-dock="${k}"><span>${SECTION_LABELS[k]}</span></a>`).join('')}
    <button type="button" data-menu aria-haspopup="dialog"><span>目錄</span></button>
  </nav>`;
}

function build() {
  const d = DATA;
  const secs = d.settings.sections.filter((s) => s.visible && hasContent(s.key));
  const nav = secs.map((s) => `<a href="#${s.key}">${SECTION_LABELS[s.key]}</a>`).join('');
  return `
  <a class="skip" href="#main">跳到主要內容</a>
  <header class="top" id="top"><div class="top-in">
    <a class="brand" href="#hero">${esc(d.hero.name)}</a>
    <nav class="nav" aria-label="頁面區塊">${nav}</nav>
    <span class="top-now" id="topNow" aria-hidden="true"></span>
  </div></header>
  <main id="main">
    ${heroHtml(secs)}
    ${secs.map((s) => SECTIONS[s.key]()).join('')}
  </main>
  ${footHtml(secs)}
  ${dockHtml(secs)}
  ${MODE === 'preview' ? '<div class="pv-bar"><span>預覽草稿，尚未發布到網站。</span><a href="index.html">離開預覽</a></div>' : ''}`;
}

// ============ 畫面更新 ============
function setMeta(sel, attr, value) {
  const el = $(sel);
  if (el && value) el.setAttribute(attr, value);
}

function applyMeta() {
  const s = DATA.settings;
  const root = document.documentElement;
  const vars = themeVars(s.theme);
  Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
  const title = s.siteTitle || `${DATA.hero.name} · 作品集`;
  const desc = s.metaDescription || [DATA.hero.tagline, DATA.hero.intro].filter(Boolean).join(' ').slice(0, 120);
  document.title = title;
  setMeta('meta[name="description"]', 'content', desc);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', desc);
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', desc);
  setMeta('meta[name="theme-color"]', 'content', vars['--paper']);
  const ld = $('#ld');
  if (ld && MODE === 'live') {
    const same = [safeUrl(DATA.contact.github), ...DATA.contact.other.map((o) => safeUrl(o.url))].filter(Boolean);
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: DATA.hero.name,
      url: 'https://chiacheng1112.com/',
      description: desc,
      ...(same.length ? { sameAs: same } : {}),
    });
  }
}

// 捲到哪個區塊，頂欄（電腦）／底部導覽與頂欄小標（手機）就標出對應項目
let spy = null;
let currentKey = 'hero';
function markActive(key) {
  currentKey = key;
  app.querySelectorAll('.nav a').forEach((a) => {
    const on = a.getAttribute('href') === '#' + key;
    if (on) {
      a.setAttribute('aria-current', 'true');
      // 選單比螢幕寬時可以左右滑，讓目前的項目留在中間
      const nav = a.parentElement;
      if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: REDUCE ? 'auto' : 'smooth' });
    } else a.removeAttribute('aria-current');
  });
  app.querySelectorAll('[data-dock]').forEach((a) => {
    if (a.dataset.dock === key) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  const now = $('#topNow');
  if (now) now.textContent = key === 'hero' ? '' : SECTION_LABELS[key] || '';
}

function observeNav() {
  if (spy) spy.disconnect();
  if (!('IntersectionObserver' in window)) return;
  const ids = ['hero', ...[...app.querySelectorAll('.nav a')].map((a) => a.getAttribute('href').slice(1))];
  spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) markActive(en.target.id);
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) spy.observe(el);
  });
  markActive(currentKey);
}

// 手機頂欄底下的閱讀進度線
let ticking = false;
function onScroll() {
  if (ticking || !isMobile()) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const top = $('#top');
    if (!top) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    top.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(3) : '0');
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

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
  observeNav();
  syncAria();
  onScroll();
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

// ============ 手機：底部面板（專案介紹、目錄） ============
const sheet = { el: null, pn: null, open: false, pushed: false, ignorePop: 0, opener: null };

function visibleSecs() {
  return DATA.settings.sections.filter((s) => s.visible && hasContent(s.key));
}

function ensureSheet() {
  if (sheet.el) return sheet;
  const el = document.createElement('div');
  el.className = 'sheet';
  el.hidden = true;
  el.innerHTML = `
    <div class="sheet-bd" data-close></div>
    <div class="sheet-pn" role="dialog" aria-modal="true" aria-labelledby="sheet-t" tabindex="-1">
      <div class="sheet-hd">
        <span class="sheet-grip" aria-hidden="true"></span>
        <h2 class="sheet-t" id="sheet-t"></h2>
        <button type="button" class="sheet-x" data-close>關閉</button>
      </div>
      <div class="sheet-body"></div>
      <div class="sheet-ft" hidden></div>
    </div>`;
  document.body.appendChild(el);
  sheet.el = el;
  sheet.pn = $('.sheet-pn', el);
  sheet.title = $('.sheet-t', el);
  sheet.body = $('.sheet-body', el);
  sheet.ft = $('.sheet-ft', el);

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return closeSheet();
    const go = e.target.closest('[data-sheet-go]');
    if (go) return openProjectSheet(go.dataset.sheetGo);
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      const key = jump.dataset.jump;
      closeSheet();
      requestAnimationFrame(() => {
        const t = document.getElementById(key);
        if (key === 'hero') window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
        else if (t) t.scrollIntoView({ block: 'start', behavior: REDUCE ? 'auto' : 'smooth' });
      });
    }
  });

  // 往下拖標題列就能關掉
  const hd = $('.sheet-hd', el);
  let drag = null;
  hd.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0 };
    sheet.pn.style.transition = 'none';
    try { hd.setPointerCapture(e.pointerId); } catch (err) { /* 略過 */ }
  });
  hd.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    sheet.pn.style.setProperty('--ty', drag.dy + 'px');
  });
  const end = () => {
    if (!drag) return;
    const { dy, t } = drag;
    drag = null;
    sheet.pn.style.transition = '';
    sheet.pn.style.removeProperty('--ty');
    const v = dy / Math.max(1, performance.now() - t);
    if (dy > 110 || (dy > 36 && v > 0.55)) closeSheet();
  };
  hd.addEventListener('pointerup', end);
  hd.addEventListener('pointercancel', end);

  document.addEventListener('keydown', (e) => {
    if (!sheet.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSheet();
    } else if (e.key === 'Tab') {
      const f = [...sheet.pn.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.pn)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  return sheet;
}

function showSheet({ title, body, footer }, opener) {
  const s = ensureSheet();
  s.title.innerHTML = title;
  s.body.innerHTML = body;
  s.body.scrollTop = 0;
  s.ft.innerHTML = footer || '';
  s.ft.hidden = !footer;
  if (s.open) return;
  s.opener = opener || document.activeElement;
  s.el.hidden = false;
  s.open = true;
  document.documentElement.classList.add('sheet-open');
  app.inert = true;
  if (MODE !== 'embed') {
    try {
      history.scrollRestoration = 'manual';
      history.pushState({ sheet: 1 }, '');
      s.pushed = true;
    } catch (err) { s.pushed = false; }
  }
  // 兩個 frame 之後才加上 .in，滑入動畫才會出現
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!s.open) return;
    s.el.classList.add('in');
    s.pn.focus({ preventScroll: true });
  }));
}

function closeSheet() {
  const s = sheet;
  if (!s.el || !s.open) return;
  s.open = false;
  s.el.classList.remove('in');
  s.pn.style.removeProperty('--ty');
  document.documentElement.classList.remove('sheet-open');
  app.inert = false;
  const done = () => { if (!s.open) s.el.hidden = true; };
  if (REDUCE) done();
  else setTimeout(done, 340);
  if (s.pushed) {
    s.pushed = false;
    s.ignorePop++;
    history.back();
    setTimeout(() => { s.ignorePop = 0; }, 600);
  }
  const o = s.opener;
  s.opener = null;
  if (o && o.isConnected) o.focus({ preventScroll: true });
}

// 手機按「返回」時，先關掉面板，而不是離開網站
window.addEventListener('popstate', () => {
  if (sheet.ignorePop > 0) {
    sheet.ignorePop--;
    return;
  }
  if (sheet.open) {
    sheet.pushed = false;
    closeSheet();
  }
});

function openProjectSheet(id, opener) {
  const p = DATA.projects.find((x) => x.id === id);
  if (!p) return;
  let list = filteredProjects();
  let i = list.findIndex((x) => x.id === id);
  if (i < 0) {
    list = sortedProjects(DATA.projects);
    i = list.findIndex((x) => x.id === id);
  }
  const prev = list[i - 1];
  const next = list[i + 1];
  const gh = safeUrl(p.links.github);
  const demo = safeUrl(p.links.demo);
  const cover = safeImg(p.cover);
  const state = [STATUS[p.status], p.year].filter(Boolean).join('・');
  const links = [];
  if (demo) links.push(`<a class="btn" href="${esc(demo)}" target="_blank" rel="noopener">查看網站<span aria-hidden="true"> ↗</span></a>`);
  if (gh) links.push(`<a class="btn btn-alt" href="${esc(gh)}" target="_blank" rel="noopener">GitHub<span aria-hidden="true"> ↗</span></a>`);
  const nav = (q, label) => (q
    ? `<button type="button" class="sh-nav" data-sheet-go="${esc(q.id)}"><small>${label}</small><span>${esc(q.name)}</span></button>`
    : '<span></span>');
  showSheet({
    title: `${esc(p.name)}${p.featured ? '<span class="pin">精選</span>' : ''}`,
    body: `
      <p class="sh-meta"><i class="dot ${esc(p.status)}" aria-hidden="true"></i><span>${esc(state)}</span><span>${esc(p.category)}</span></p>
      ${p.tagline ? `<p class="sh-tag">${esc(p.tagline)}</p>` : ''}
      ${cover ? `<img class="d-cover" src="${esc(cover)}" alt="${esc(p.name)} 的畫面">` : ''}
      ${p.desc ? `<p class="d-desc">${esc(p.desc)}</p>` : '<p class="d-desc d-none">還沒有詳細介紹。</p>'}
      ${p.tech.length ? `<ul class="d-tech" aria-label="使用的技術">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${links.length ? `<div class="sh-links">${links.join('')}</div>` : ''}`,
    footer: prev || next ? nav(prev, '上一個') + nav(next, '下一個') : '',
  }, opener);
}

function openMenuSheet(opener) {
  const secs = visibleSecs();
  const count = {
    work: `${DATA.projects.length} 個專案`,
    stack: `${DATA.stack.filter((g) => g.items.length).length} 類`,
    devlog: `${DATA.logs.filter((l) => l.content.trim() || l.title.trim()).length} 篇`,
    links: `${DATA.links.filter((l) => safeUrl(l.url)).length} 個`,
  };
  const rows = contactRows().slice(0, 2);
  showSheet({
    title: '目錄',
    body: `
      <nav class="menu" aria-label="全部區塊">
        <a href="#hero" data-jump="hero"><span>首頁</span></a>
        ${secs.map((s) => `<a href="#${s.key}" data-jump="${s.key}"${currentKey === s.key ? ' aria-current="true"' : ''}><span>${SECTION_LABELS[s.key]}</span>${count[s.key] ? `<small>${count[s.key]}</small>` : ''}</a>`).join('')}
      </nav>
      ${rows.length ? `<div class="sh-links">${rows.map(([label, href, val, ext], i) => `<a class="btn${i ? ' btn-alt' : ''}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(label)}</a>`).join('')}</div>` : ''}
      <p class="menu-sw" data-sw>${switchHtml()}</p>`,
  }, opener);
}

// 手機上列的點擊是開面板，不是展開；螢幕閱讀器也要聽到對的說明
function syncAria() {
  const mob = isMobile();
  app.querySelectorAll('.row-head').forEach((h) => {
    if (mob) {
      h.setAttribute('aria-haspopup', 'dialog');
      h.removeAttribute('aria-expanded');
    } else {
      h.removeAttribute('aria-haspopup');
      h.setAttribute('aria-expanded', String(view.open.has(h.closest('.row').dataset.id)));
    }
  });
}

function updateSwitch() {
  document.querySelectorAll('[data-sw]').forEach((el) => { el.innerHTML = switchHtml(); });
}

document.addEventListener('click', (e) => {
  const sw = e.target.closest('[data-switch]');
  if (sw) Dev.set(sw.dataset.switch);
});

Dev.onChange(() => {
  closeSheet();
  updateSwitch();
  syncAria();
  onScroll();
});

// ============ 互動 ============
function openProject(id) {
  view.q = '';
  view.cat = 'all';
  view.open.add(id);
  const q = $('#q');
  if (q) q.value = '';
  app.querySelectorAll('.flt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === 'all')));
  updateWorkList();
  const li = [...app.querySelectorAll('.row')].find((r) => r.dataset.id === id);
  if (li) li.scrollIntoView({ block: 'center', behavior: REDUCE ? 'auto' : 'smooth' });
}

app.addEventListener('click', (e) => {
  if (e.target.closest('[data-menu]')) {
    openMenuSheet(e.target.closest('[data-menu]'));
    return;
  }
  if (e.target.closest('[data-dock="hero"]')) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
    return;
  }
  const jump = e.target.closest('[data-open]');
  if (jump && isMobile()) {
    e.preventDefault();
    openProjectSheet(jump.dataset.open, jump);
    return;
  }
  if (jump && $('#workList')) {
    e.preventDefault();
    openProject(jump.dataset.open);
    return;
  }
  const head = e.target.closest('.row-head');
  if (head) {
    const li = head.closest('.row');
    const id = li.dataset.id;
    if (isMobile()) {
      openProjectSheet(id, head);
      return;
    }
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
