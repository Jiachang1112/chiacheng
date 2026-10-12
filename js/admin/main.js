// 後台入口：登入、外框、路由、發布流程、即時預覽
import * as core from './core.js';
import * as cloud from './cloud.js';
import { $, $$, esc, debounce, toast, openModal, confirmDialog, fmtDateTime } from './ui.js';
import { normalize } from '../data.js';
import dashboard from './views/dashboard.js';
import profile from './views/profile.js';
import projects from './views/projects.js';
import stack from './views/stack.js';
import logs from './views/logs.js';
import links from './views/links.js';
import appearance from './views/appearance.js';
import messages, { refreshUnread } from './views/messages.js';
import backup from './views/backup.js';

const { state } = core;
const app = $('#app');

// anchor：預覽畫面要捲到哪個區塊
const VIEWS = [
  { key: 'dashboard', label: '總覽', view: dashboard, anchor: '#top' },
  { key: 'profile', label: '基本資料', view: profile, anchor: '#top' },
  { key: 'projects', label: '專案', view: projects, anchor: '#work' },
  { key: 'stack', label: '技術', view: stack, anchor: '#stack' },
  { key: 'logs', label: '日誌', view: logs, anchor: '#devlog' },
  { key: 'links', label: '連結', view: links, anchor: '#links' },
  { key: 'appearance', label: '外觀', view: appearance, anchor: '#top' },
  { key: 'messages', label: '訊息', view: messages, anchor: '#contact', badge: true },
  { key: 'backup', label: '備份與紀錄', view: backup, anchor: '#top' },
];

const PV_KEY = 'chiacheng_admin_preview_v1';
const safeLS = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 略過 */ } },
};

// ============ 登入 ============
function showLogin(note = '') {
  document.title = '登入 · 後台';
  app.innerHTML = `
  <main class="login">
    <form id="lf" novalidate>
      <h1>後台登入</h1>
      <p class="hint">管理作品集網站的內容。</p>
      <div class="field"><label for="lemail">Email</label><input id="lemail" type="email" autocomplete="username" required></div>
      <div class="field"><label for="lpw">密碼</label><input id="lpw" type="password" autocomplete="current-password" required></div>
      <label class="check"><input type="checkbox" id="lremember" checked> 在這台裝置保持登入</label>
      <p class="err" id="lerr" role="alert"${note ? '' : ' hidden'}>${esc(note)}</p>
      <p class="ok-s" id="lok" role="status" hidden></p>
      <button type="submit" class="btn btn-primary btn-block" id="lgo">登入</button>
      <button type="button" class="linkish" id="lforgot">忘記密碼</button>
    </form>
    <a class="login-back" href="./">回到網站</a>
  </main>`;
  const form = $('#lf');
  const err = $('#lerr');
  const ok = $('#lok');
  const say = (msg, good) => {
    err.hidden = !!good || !msg;
    ok.hidden = !good;
    (good ? ok : err).textContent = msg;
  };
  $('#lemail').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#lemail').value.trim();
    const pw = $('#lpw').value;
    if (!email || !pw) return say('請輸入 Email 和密碼。');
    const btn = $('#lgo');
    btn.disabled = true;
    btn.textContent = '登入中…';
    say('');
    try {
      await cloud.login(email, pw, $('#lremember').checked);
      // 成功後由 onAuthStateChanged 接手
    } catch (ex) {
      say(cloud.explain(ex));
      btn.disabled = false;
      btn.textContent = '登入';
      $('#lpw').select();
    }
  });
  $('#lforgot').addEventListener('click', async () => {
    const email = $('#lemail').value.trim();
    if (!email) {
      say('先在上面輸入你的 Email，再按「忘記密碼」。');
      return $('#lemail').focus();
    }
    try {
      await cloud.resetPassword(email);
      say('如果這個 Email 有註冊，重設密碼的信已經寄出，請到信箱查看。', true);
    } catch (ex) {
      say(cloud.explain(ex));
    }
  });
}

function showBootError(msg) {
  app.innerHTML = `<main class="login"><div class="boot-err"><h1>無法開啟後台</h1><p class="err">${esc(msg)}</p><button type="button" class="btn btn-primary" onclick="location.reload()">重新整理</button></div></main>`;
}

// ============ 外框 ============
let pv = null; // 預覽面板
let subscribed = false;
let current = VIEWS[0];

const routeKey = () => (location.hash.match(/^#\/([a-z]+)/) || [])[1] || 'dashboard';

function buildShell() {
  document.title = '後台';
  app.innerHTML = `
  <div class="shell" id="shell">
    <aside class="side" id="side" aria-label="主選單">
      <div class="brand"><strong>作品集後台</strong><small>${esc(state.user.email || '')}</small></div>
      <nav>
        ${VIEWS.map((v) => `<a href="#/${v.key}" data-key="${v.key}">${esc(v.label)}${v.badge ? '<span class="badge" data-badge="' + v.key + '" hidden></span>' : ''}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <button type="button" class="linkish" id="newTab">在新分頁預覽草稿</button>
        <a href="./" target="_blank" rel="noopener">開啟網站</a>
        <button type="button" class="linkish" id="logout">登出</button>
      </div>
    </aside>
    <div class="side-back" id="sideBack"></div>
    <div class="main">
      <header class="top">
        <button type="button" class="btn-icon menu" id="menu" aria-label="開啟選單" aria-controls="side" aria-expanded="false">☰</button>
        <h1 id="vt"></h1>
        <span class="status" id="status" role="status"></span>
        <span class="grow"></span>
        <button type="button" class="btn btn-sm pv-toggle" id="pvToggle" aria-pressed="false">即時預覽</button>
        <button type="button" class="btn btn-sm" id="discard">放棄變更</button>
        <button type="button" class="btn btn-primary" id="publish">發布</button>
      </header>
      <div id="loadErr" class="banner err" role="alert" hidden></div>
      <div class="work" id="work">
        <main class="view-scroll" id="scroll"><div id="view"></div></main>
        <aside class="preview" id="pv" aria-label="即時預覽">
          <div class="pv-bar">
            <div class="seg" role="group" aria-label="預覽尺寸">
              <button type="button" data-w="390" aria-pressed="false">手機</button>
              <button type="button" data-w="820" aria-pressed="false">平板</button>
              <button type="button" data-w="1280" aria-pressed="true" class="on">桌機</button>
            </div>
            <span class="hint">未發布的草稿，會即時更新。</span>
          </div>
          <div class="pv-stage" id="pvStage"><iframe id="pvFrame" title="網站預覽" tabindex="-1"></iframe></div>
        </aside>
      </div>
    </div>
  </div>`;

  // ---- 預覽面板 ----
  const frame = $('#pvFrame');
  const stage = $('#pvStage');
  pv = { frame, ready: false, width: 1280, on: false, loaded: false };
  const fit = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    const s = Math.min(1, w / pv.width);
    frame.style.width = pv.width + 'px';
    frame.style.height = h / s + 'px';
    frame.style.transform = `scale(${s})`;
    frame.style.marginLeft = Math.max(0, (w - pv.width * s) / 2) + 'px';
  };
  new ResizeObserver(fit).observe(stage);
  pv.fit = fit;

  const setPreview = (on) => {
    pv.on = on;
    $('#work').classList.toggle('with-pv', on);
    $('#pvToggle').setAttribute('aria-pressed', String(on));
    $('#pvToggle').classList.toggle('on', on);
    safeLS.set(PV_KEY, on ? '1' : '0');
    if (on && !pv.loaded) {
      pv.loaded = true;
      frame.src = './index.html?embed=1';
    }
    requestAnimationFrame(fit);
  };
  $('#pvToggle').addEventListener('click', () => setPreview(!pv.on));
  $('.pv-bar .seg', app).addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    pv.width = +b.dataset.w;
    $$('.pv-bar .seg button', app).forEach((x) => {
      const on = x === b;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    fit();
  });
  const wide = window.matchMedia('(min-width: 1180px)');
  const saved = safeLS.get(PV_KEY);
  if (wide.matches && saved !== '0') setPreview(true);
  wide.addEventListener('change', (e) => { if (!e.matches && pv.on) setPreview(false); });

  // ---- 選單（手機） ----
  const side = $('#side');
  const toggleMenu = (open) => {
    side.classList.toggle('open', open);
    $('#sideBack').classList.toggle('open', open);
    $('#menu').setAttribute('aria-expanded', String(open));
  };
  $('#menu').addEventListener('click', () => toggleMenu(!side.classList.contains('open')));
  $('#sideBack').addEventListener('click', () => toggleMenu(false));
  side.addEventListener('click', (e) => { if (e.target.closest('nav a')) toggleMenu(false); });

  // ---- 按鈕 ----
  $('#newTab').addEventListener('click', () => {
    core.flushDraft();
    window.open('./index.html?preview=1', '_blank', 'noopener');
  });
  $('#logout').addEventListener('click', async () => {
    core.flushDraft();
    await cloud.logout();
  });
  $('#publish').addEventListener('click', startPublish);
  $('#discard').addEventListener('click', async () => {
    if (!state.published || !state.dirty) return;
    if (await confirmDialog({ title: '放棄變更', message: '草稿裡尚未發布的修改都會消失，回到目前線上的版本。', confirmLabel: '放棄變更', danger: true })) {
      core.discardDraft();
      toast('已回到線上版本', 'ok');
    }
  });

  if (!subscribed) {
    subscribed = true;
    core.subscribe((why) => {
      if (!$('#shell')) return;
      if (why === 'draft') {
        updateStatus();
        pushPreview();
      } else if (why === 'unread') {
        updateBadges();
      } else {
        renderView(true);
        updateStatus();
        pushPreview();
      }
    });
    window.addEventListener('hashchange', () => { if ($('#shell')) renderView(false); });
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'chiacheng-ready' || !pv) return;
      if (e.source !== pv.frame.contentWindow) return;
      pv.ready = true;
      pushPreview.flush();
      gotoPreview();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        core.flushDraft();
        toast(state.dirty ? '草稿已存在這台裝置。要讓訪客看到，請按「發布」。' : '目前沒有未發布的變更。');
      }
    });
    window.addEventListener('pagehide', () => core.flushDraft());
    document.addEventListener('visibilitychange', () => { if (document.hidden) core.flushDraft(); });
  }
}

// ============ 畫面 ============
function renderView(keepScroll) {
  const key = routeKey();
  current = VIEWS.find((v) => v.key === key) || VIEWS[0];
  if (current.key !== key) {
    history.replaceState(null, '', '#/' + current.key);
  }
  const scroller = $('#scroll');
  const top = keepScroll ? scroller.scrollTop : 0;
  const root = document.createElement('div');
  root.className = 'view';
  $('#view').replaceChildren(root);
  current.view.render(root);
  scroller.scrollTop = top;
  $('#vt').textContent = current.label;
  document.title = current.label + ' · 後台';
  $$('.side nav a', app).forEach((a) => {
    const on = a.dataset.key === current.key;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (!keepScroll) gotoPreview();
}

function updateStatus() {
  const st = $('#status');
  const pubBtn = $('#publish');
  const dis = $('#discard');
  const banner = $('#loadErr');
  let cls = 'ok';
  let text = '已是最新';
  if (state.loadError) {
    cls = 'err';
    text = '暫時無法發布';
  } else if (state.isNew) {
    cls = 'warn';
    text = '雲端還沒有資料';
  } else if (state.dirty) {
    cls = 'warn';
    text = '有尚未發布的變更';
  }
  st.className = 'status ' + cls;
  st.innerHTML = `<i class="dot"></i>${esc(text)}`;
  const can = state.canPublish && (state.dirty || state.isNew);
  pubBtn.disabled = !can;
  pubBtn.title = !state.canPublish ? '讀不到線上資料，為了避免蓋掉原本的內容，暫時不能發布。' : can ? '' : '沒有需要發布的變更';
  dis.disabled = !state.published || !state.dirty;
  banner.hidden = !state.loadError;
  if (state.loadError) banner.textContent = `讀不到線上資料：${state.loadError} 你仍然可以編輯草稿，但在讀得到之前不能發布。重新整理頁面可以再試一次。`;
}

function updateBadges() {
  $$('[data-badge]', app).forEach((b) => {
    const n = b.dataset.badge === 'messages' ? state.unread : 0;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
  });
}

// ============ 預覽同步 ============
const pushPreview = debounce(() => {
  if (!pv || !pv.on || !pv.ready || !pv.frame.contentWindow) return;
  pv.frame.contentWindow.postMessage({ type: 'chiacheng-draft', data: normalize(state.draft) }, location.origin);
}, 150);

function gotoPreview() {
  if (!pv || !pv.on || !pv.ready || !pv.frame.contentWindow) return;
  // 先等這一輪的草稿畫完，再捲動
  setTimeout(() => pv.frame.contentWindow.postMessage({ type: 'chiacheng-goto', hash: current.anchor }, location.origin), 60);
}

// ============ 發布流程 ============
let publishing = false;

async function startPublish() {
  if (publishing) return;
  if (!state.canPublish) return toast('讀不到線上資料，為了避免蓋掉原本的內容，暫時不能發布。', 'err');
  const draft = normalize(state.draft);
  const { errors, warnings } = core.validate(draft);
  if (errors.length) {
    openModal({
      title: '還不能發布',
      size: 'sm',
      body: `<p class="modal-text">請先處理這些問題：</p><ul class="difflist">${errors.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`,
      footer: [{ label: '知道了', kind: 'primary' }],
    });
    return;
  }
  const lines = core.diffSummary(state.published, draft);
  if (!lines.length && !state.isNew) {
    lines.push('內容沒有明顯差異（可能只調整了細節）');
  }
  const body = document.createElement('div');
  body.innerHTML = `
    <p class="modal-text">${state.isNew ? '這會是雲端的第一份資料。' : '這些變更會立刻出現在網站上：'}</p>
    <ul class="difflist">${lines.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    ${warnings.length ? `<div class="banner warn"><strong>提醒（不影響發布）</strong><ul>${warnings.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="field"><label for="pubLabel">版本備註（選填）</label><input id="pubLabel" maxlength="60" placeholder="例如：新增三個專案" value="${esc(lines.length && lines.length < 3 ? lines.join('；').slice(0, 60) : '')}"></div>`;
  openModal({
    title: '發布到網站',
    body,
    footer: [
      { label: '取消' },
      {
        label: '發布',
        kind: 'primary',
        onClick: async (api) => {
          const label = $('#pubLabel', body).value.trim();
          api.setBusy(true, '發布中…');
          publishing = true;
          try {
            // 發布前確認線上版本沒有被別處改過
            const stamp = await core.remoteStamp();
            if (!state.isNew && stamp !== state.base) {
              api.setBusy(false);
              const go = await askOverwrite(stamp);
              if (!go) return false;
              api.setBusy(true, '發布中…');
            }
            const r = await core.publish(label || lines.join('；').slice(0, 60));
            toast('已發布。網站已更新。', 'ok');
            if (!r.historyOk) toast('網站已更新，但發布紀錄沒有存成功（不影響網站）。', 'err');
          } catch (ex) {
            api.setBusy(false);
            toast(cloud.explain(ex), 'err');
            return false;
          } finally {
            publishing = false;
          }
        },
      },
    ],
  });
}

function askOverwrite(stamp) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title: '線上版本已被更新',
      size: 'sm',
      closable: false,
      body: `<p class="modal-text">你開始編輯之後，網站在 ${esc(stamp ? fmtDateTime(stamp) : '稍早')} 又被發布過一次（可能來自另一台裝置或另一個分頁）。繼續發布會蓋掉那次的內容。</p><p class="hint">建議先取消，到「備份與紀錄」匯出線上版本，再重新整理後台，確認要保留哪些修改。</p>`,
      footer: [
        { label: '取消', kind: 'primary', onClick: () => { answered = true; resolve(false); } },
        { label: '仍然覆蓋', kind: 'danger', onClick: () => { answered = true; resolve(true); } },
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

// ============ 啟動 ============
function offerPendingDraft() {
  const p = state.pendingDraft;
  if (!p) return;
  openModal({
    title: '找到沒發布的草稿',
    size: 'sm',
    closable: false,
    body: `<p class="modal-text">這台裝置上有一份 ${esc(fmtDateTime(p.savedAt))} 儲存的草稿，內容和線上版本不同。要繼續編輯它嗎？</p><p class="hint">選擇「捨棄」會用目前線上的版本開始。</p>`,
    footer: [
      { label: '捨棄草稿', onClick: () => core.dropPendingDraft() },
      { label: '繼續編輯草稿', kind: 'primary', onClick: () => core.adoptPendingDraft() },
    ],
  });
}

let booting = '';
async function onUser(user) {
  if (!user) {
    booting = '';
    state.user = null;
    showLogin();
    return;
  }
  if (booting === user.uid) return;
  booting = user.uid;
  state.user = user;
  app.innerHTML = '<div class="boot">載入中…</div>';
  try {
    await core.load();
  } catch (e) {
    booting = '';
    return showBootError(cloud.explain(e));
  }
  buildShell();
  updateStatus();
  renderView(false);
  offerPendingDraft();
  refreshUnread().then(updateBadges);
}

if (!location.hash) history.replaceState(null, '', '#/dashboard');
app.innerHTML = '<div class="boot">載入中…</div>';
cloud.watchAuth(onUser).catch((e) => showBootError(cloud.explain(e)));
