// 「搜尋結果」頁：改 Google 搜尋結果裡看到的標題與說明，並即時預覽它們的長相。
// 首頁與 /work/、/stack/、/devlog/、/contact/ 各有自己的標題與說明。
import { state, mutate } from '../core.js';
import { $, $$, esc, fld, bindPaths, setPath, getPath, blockHead } from '../ui.js';
import { seoText, SEO_PAGES, SECTION_LABELS } from '../../data.js';

const LABEL = { key: 'seo', label: '修改搜尋結果的標題與說明' };
const SITE_HOST = 'chiacheng1112.com'; // 和網頁裡的 canonical 一致
const PV_KEY = 'chiacheng_admin_serp_view';

const store = {
  get() { try { return localStorage.getItem(PV_KEY); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(PV_KEY, v); } catch (e) { /* 略過 */ } },
};

let cur = ''; // 目前編輯哪一頁：'' 是首頁

const pathsOf = (page) => (page
  ? { title: `settings.seoPages.${page}.title`, desc: `settings.seoPages.${page}.desc` }
  : { title: 'settings.siteTitle', desc: 'settings.metaDescription' });
const urlOf = (page) => `https://${SITE_HOST}${page ? '/' + page + '/' : ''}`;
const crumbOf = (page) => `https://${SITE_HOST}${page ? ' › ' + page : ''}`;

// 中文字算 1，英數字大約半個字寬
function units(str) {
  let n = 0;
  for (const ch of String(str)) n += ch.charCodeAt(0) > 0x2e7f ? 1 : 0.55;
  return n;
}
const round = (n) => Math.round(n);

function titleNote(t) {
  const u = units(t);
  if (u <= 28) return { cls: 'ok-s', text: '長度剛好，電腦與手機都會完整顯示。' };
  if (u <= 34) return { cls: 'warn-s', text: '電腦版後面可能被「…」截掉，手機會換成兩行。' };
  return { cls: 'warn-s', text: '太長了，後面會被「…」截掉。建議縮短到 28 字內。' };
}
function descNote(t) {
  const u = units(t);
  if (u <= 58) return { cls: 'ok-s', text: '長度剛好，電腦與手機都會完整顯示。' };
  if (u <= 80) return { cls: 'warn-s', text: '電腦版會完整顯示，手機後面可能被截掉。重要的話放前面。' };
  return { cls: 'warn-s', text: '太長了，電腦與手機都會被截掉。建議 60 字內，重點放在前面。' };
}

const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>';

// 舊草稿可能還沒有 seoPages，先補齊再寫入
function ensure(x, page) {
  if (!page) return;
  if (!x.settings.seoPages || typeof x.settings.seoPages !== 'object') x.settings.seoPages = {};
  if (!x.settings.seoPages[page]) x.settings.seoPages[page] = { title: '', desc: '' };
}

const seoView = {
  title: '搜尋結果',
  render(root) {
    const box = document.createElement('div');
    root.replaceChildren(box);
    const d = state.draft;
    const view = store.get() === 'desktop' ? 'desktop' : 'mobile';
    const P = pathsOf(cur);
    // 沒填時會自動產生的文字，拿來當輸入框的提示
    const blank = { ...d, settings: { ...d.settings, siteTitle: '', metaDescription: '', seoPages: {} } };
    const auto = seoText(blank, cur);
    const tabs = [['', '首頁'], ...SEO_PAGES.map((k) => [k, SECTION_LABELS[k]])];

    box.innerHTML = `
    <section class="block">
      ${blockHead('標題與說明', '這兩段字就是 Google 搜尋結果裡的藍色標題，和標題下面那一小段說明。每個頁面各自設定，下方預覽會跟著你打的字即時變化。')}
      <div class="seg seo-tabs" role="group" aria-label="要編輯哪一頁">
        ${tabs.map(([k, l]) => `<button type="button" data-pg="${k}" aria-pressed="${k === cur}" class="${k === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}
      </div>
      <p class="hint seo-url">網址：<code>${esc(urlOf(cur))}</code></p>
      <div class="seo-fields">
        ${fld('標題', `<input id="seoTitle" data-path="${P.title}" value="${esc(getPath(d, P.title) || '')}" placeholder="${esc(auto.title)}" maxlength="60" autocomplete="off">`, '<span id="tCount"></span> <button type="button" class="linkish" data-clear="title">改回自動產生</button>')}
        ${fld('說明', `<textarea id="seoDesc" data-path="${P.desc}" rows="3" maxlength="200" placeholder="${esc(auto.desc)}">${esc(getPath(d, P.desc) || '')}</textarea>`, '<span id="dCount"></span> <button type="button" class="linkish" data-clear="desc">改回自動產生</button>')}
      </div>
      <p class="hint" id="autoNote"></p>
    </section>

    <section class="block">
      ${blockHead('搜尋結果預覽', '大小和換行都照 Google 實際的樣子算，所以哪裡會被截掉看得出來。', `<div class="seg seo-dev" role="group" aria-label="預覽裝置"><button type="button" data-v="mobile" aria-pressed="${view === 'mobile'}" class="${view === 'mobile' ? 'on' : ''}">手機</button><button type="button" data-v="desktop" aria-pressed="${view === 'desktop'}" class="${view === 'desktop' ? 'on' : ''}">電腦</button></div>`)}
      <div class="serp-stage" id="serpStage"><div class="serp-fit" id="serpFit">
        <div class="serp serp-${view}" id="serp">
          <div class="serp-site"><span class="serp-ico">${GLOBE}</span><span class="serp-who"><b>${SITE_HOST}</b><small>${esc(crumbOf(cur))}</small></span></div>
          <div class="serp-title" id="pvTitle"></div>
          <div class="serp-desc" id="pvDesc"></div>
        </div>
      </div></div>
    </section>

    <section class="block">
      ${blockHead('分享到 LINE、Facebook 的卡片', '有人把這一頁的網址貼到聊天室或社群時，會用同一組標題與說明，加上 assets/og.png 這張圖。')}
      <div class="share-card" id="shareCard">
        <img src="assets/og.png" alt="" width="1200" height="630">
        <div class="share-body"><small>${SITE_HOST}</small><b id="shTitle"></b><span id="shDesc"></span></div>
      </div>
    </section>

    <section class="block">
      ${blockHead('改完之後怎麼讓 Google 更新')}
      <ol class="seo-steps">
        <li>改好標題與說明，按右上角「發布」。預覽框與前台分頁標題會立刻更新。</li>
        <li>到 Google Search Console，貼上這一頁的網址 <code>${esc(urlOf(cur))}</code>，按「要求建立索引」。<a class="btn btn-sm" href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">開啟 Search Console</a></li>
        <li>等 Google 重新抓取，通常幾天內會換成新的。搜尋結果裡現在看到的舊文字，是 Google 以前抓到的版本。</li>
      </ol>
      <p class="hint">Google 會自己決定顯示哪一段字，不一定完全照你寫的，但清楚、有包含關鍵字的標題與說明通常會被採用。</p>
    </section>`;

    const fit = $('#serpFit', box);
    const stage = $('#serpStage', box);
    const serp = $('#serp', box);

    // 預覽卡片有固定寬度才能照實際換行；容器比它窄時整張縮小，而不是讓文字重新換行
    const scale = () => {
      const w = serp.offsetWidth;
      if (!w) return;
      fit.style.transform = '';
      fit.style.width = w + 'px';
      const full = fit.offsetWidth; // 含左右內距
      const avail = stage.clientWidth;
      const k = avail ? Math.min(1, avail / full) : 1;
      if (k < 1) fit.style.transform = `scale(${k})`;
      stage.style.height = Math.ceil(fit.offsetHeight * k) + 'px';
    };

    const update = () => {
      const t = seoText(state.draft, cur);
      $('#pvTitle', box).textContent = t.title;
      $('#pvDesc', box).textContent = t.desc || '（還沒有說明，搜尋結果會由 Google 自己從網頁內容挑一段。）';
      $('#shTitle', box).textContent = t.title;
      $('#shDesc', box).textContent = t.desc;

      const tn = titleNote(t.title);
      const dn = t.desc ? descNote(t.desc) : { cls: 'warn-s', text: '沒有說明。' };
      $('#tCount', box).innerHTML = `${round(units(t.title))} 字　<span class="${tn.cls}">${esc(tn.text)}</span>`;
      $('#dCount', box).innerHTML = `${round(units(t.desc))} 字　<span class="${dn.cls}">${esc(dn.text)}</span>`;

      const miss = [];
      if (t.titleAuto) miss.push('標題');
      if (t.descAuto) miss.push('說明');
      $('#autoNote', box).textContent = miss.length
        ? `目前沒填${miss.join('和')}，預覽用的是自動產生的版本（灰色提示字就是）。想要更準確的文字，直接在上面欄位打字。`
        : '';
      $$('[data-clear]', box).forEach((b) => { b.hidden = !getPath(state.draft, P[b.dataset.clear]); });
      scale();
    };

    bindPaths(box, (path, v) => {
      mutate(LABEL, (x) => { ensure(x, cur); setPath(x, path, v); });
      update();
    });

    box.addEventListener('click', (e) => {
      const c = e.target.closest('[data-clear]');
      if (c) {
        const path = P[c.dataset.clear];
        mutate(LABEL, (x) => { ensure(x, cur); setPath(x, path, ''); });
        const el = $(`[data-path="${path}"]`, box);
        if (el) { el.value = ''; el.focus(); }
        update();
        return;
      }
      const pg = e.target.closest('.seo-tabs button[data-pg]');
      if (pg) {
        cur = pg.dataset.pg;
        seoView.render(root);
        return;
      }
      const b = e.target.closest('.seo-dev button[data-v]');
      if (b) {
        const v = b.dataset.v;
        store.set(v);
        serp.className = `serp serp-${v}`;
        $$('.seo-dev button', box).forEach((x) => {
          const on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', String(on));
        });
        scale();
      }
    });

    update();
    if (window.ResizeObserver) new ResizeObserver(scale).observe(stage);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scale);
  },
};

export default seoView;
