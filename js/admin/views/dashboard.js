import { state, validate } from '../core.js';
import { esc, ago, fmtDateTime, blockHead } from '../ui.js';
import { STATUS, SECTION_LABELS, allTech, sectionHasContent, safeUrl, isEmail } from '../../data.js';

// 內容健康檢查：每一項都附上要去哪裡修
function checks(d) {
  const out = [];
  const add = (ok, text, href, level = 'warn') => out.push({ ok, text, href, level });

  const v = validate(d);
  v.errors.forEach((t) => add(false, t, '#/projects', 'err'));
  v.warnings.forEach((t) => add(false, t, '#/projects'));

  add(!!d.hero.tagline.trim() && !!d.hero.intro.trim(), '首頁的標語與簡介都有填', '#/profile');
  add(!!d.hero.avatar, '有放頭像（沒有也可以，首頁會只顯示文字）', '#/profile');
  add(!!(isEmail(d.contact.email) || d.settings.contactForm.enabled), '訪客有辦法聯絡你（Email 或聯絡表單）', '#/profile');

  const noDesc = d.projects.filter((p) => !p.desc.trim()).length;
  add(!noDesc, noDesc ? `${noDesc} 個專案還沒有說明` : '每個專案都有說明', '#/projects');
  const noTech = d.projects.filter((p) => !p.tech.length).length;
  add(!noTech, noTech ? `${noTech} 個專案還沒填技術標籤` : '每個專案都有技術標籤', '#/projects');
  const noLink = d.projects.filter((p) => !safeUrl(p.links.github) && !safeUrl(p.links.demo)).length;
  add(!noLink, noLink ? `${noLink} 個專案沒有任何連結` : '每個專案都有連結', '#/projects');

  const hidden = d.settings.sections.filter((s) => s.visible && !sectionHasContent(d, s.key)).map((s) => SECTION_LABELS[s.key]);
  add(!hidden.length, hidden.length ? `「${hidden.join('、')}」沒有內容，前台不會顯示` : '所有開啟的區塊都有內容', '#/appearance');

  const m = d.settings.metaDescription;
  add(!!m && m.length <= 120, !m ? '還沒有填網站說明，搜尋結果會顯示預設文字' : m.length > 120 ? '網站說明太長，搜尋結果會被截掉' : '網站說明長度剛好', '#/profile');
  return out;
}

// 簡單的橫條圖：一個色相，數字直接寫在條旁邊
function bars(rows, unit) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return `<ol class="bars">${rows.map((r) => `
    <li title="${esc(r.name)}：${r.n} ${unit}">
      <span class="bar-name">${esc(r.name)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(r.n / max) * 100}%"></span></span>
      <span class="bar-n">${r.n}</span>
    </li>`).join('')}</ol>`;
}

export default {
  title: '總覽',
  render(root) {
    const d = state.draft;
    const list = checks(d);
    const todo = list.filter((c) => !c.ok);

    const cats = new Map();
    d.projects.forEach((p) => cats.set(p.category, (cats.get(p.category) || 0) + 1));
    const catRows = [...cats.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    const techRows = allTech(d).slice(0, 10);

    const byStatus = Object.keys(STATUS).map((k) => [STATUS[k], d.projects.filter((p) => p.status === k).length]).filter(([, n]) => n);
    const featured = d.projects.filter((p) => p.featured).length;
    const pub = state.published;

    root.innerHTML = `
    <section class="block">
      ${blockHead('目前狀態')}
      <p class="status-line">${
        state.loadError ? `<span class="err">讀不到線上資料：${esc(state.loadError)}</span>` :
        state.isNew ? '雲端還沒有資料，第一次發布後網站才會使用這裡的內容。' :
        state.dirty ? '草稿有尚未發布的修改。' : '草稿和線上版本一樣。'
      }${pub && pub.updatedAt ? ` 線上版本最後發布於 ${esc(fmtDateTime(pub.updatedAt))}（${esc(ago(pub.updatedAt))}）。` : ''}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="#/projects">管理專案</a>
        <a class="btn" href="#/logs">寫日誌</a>
        <a class="btn" href="#/appearance">調整外觀</a>
        <a class="btn" href="/" target="_blank" rel="noopener">開啟網站</a>
      </div>
    </section>

    <section class="block">
      ${blockHead('內容檢查', todo.length ? `有 ${todo.length} 件事可以處理。` : '一切都看起來很好。')}
      <ul class="checklist">${list.map((c) => `
        <li class="${c.ok ? 'ok' : c.level}">
          <span class="ck" aria-hidden="true">${c.ok ? '✓' : c.level === 'err' ? '!' : '○'}</span>
          <span class="ck-t">${esc(c.text)}</span>
          ${c.ok ? '' : `<a href="${c.href}">去修改</a>`}
        </li>`).join('')}</ul>
    </section>

    <section class="block">
      ${blockHead('內容一覽')}
      <ul class="overview">
        <li><a href="#/projects">專案</a><span>${d.projects.length} 個${featured ? `，${featured} 個精選` : ''}${byStatus.length ? '；' + byStatus.map(([k, n]) => `${esc(k)} ${n}`).join('、') : ''}</span></li>
        <li><a href="#/stack">技術</a><span>${d.stack.length} 個分類，共 ${d.stack.reduce((s, g) => s + g.items.length, 0)} 項</span></li>
        <li><a href="#/logs">日誌</a><span>${d.logs.length} 篇${d.logs.some((l) => l.pinned) ? '，有置頂' : ''}</span></li>
        <li><a href="#/links">連結</a><span>${d.links.length} 個</span></li>
        <li><a href="#/messages">訊息</a><span>${state.unread ? `${state.unread} 則未讀` : d.settings.contactForm.enabled ? '沒有未讀' : '聯絡表單關閉中'}</span></li>
      </ul>
    </section>

    ${d.projects.length ? `
    <div class="two-col">
      <section class="block">
        ${blockHead('各分類的專案數')}
        ${bars(catRows, '個專案')}
      </section>
      <section class="block">
        ${blockHead('最常用的技術', '依專案的技術標籤統計，最多列十項。')}
        ${techRows.length ? bars(techRows, '個專案') : '<p class="empty-s">專案還沒有填技術標籤。</p>'}
      </section>
    </div>` : ''}

    <section class="block">
      ${blockHead('最近的操作', '只記錄在這個瀏覽器，換裝置不會同步。')}
      ${state.activity.length ? `<ul class="actlist">${state.activity.slice(0, 8).map((a) => `<li><span>${esc(a.label)}</span><time title="${esc(fmtDateTime(new Date(a.t).toISOString()))}">${esc(ago(new Date(a.t).toISOString()))}</time></li>`).join('')}</ul>` : '<p class="empty-s">還沒有操作紀錄。</p>'}
    </section>`;
  },
};
