import { state, mutate, rerender } from '../core.js';
import { $, $$, esc, fld, bindPaths, setPath, moveItem, blockHead } from '../ui.js';
import { THEME_PRESETS, PAPER, SECTION_LABELS, contrast, sectionHasContent } from '../../data.js';

const LABEL = { key: 'appearance', label: '修改外觀設定' };

function ratioRow(name, a, b, need, note) {
  const r = contrast(a, b);
  const ok = r >= need;
  return `<li class="${ok ? 'ok-s' : 'warn-s'}"><span>${esc(name)}</span><b>${r.toFixed(1)} : 1</b><span>${ok ? '清楚' : '偏淡'}${note ? '，' + esc(note) : ''}</span></li>`;
}

export default {
  title: '外觀',
  render(root) {
    const d = state.draft;
    const th = d.settings.theme;
    const activePreset = THEME_PRESETS.find((p) => p.ink === th.ink && p.accent === th.accent && p.mark === th.mark);

    root.innerHTML = `
    <section class="block">
      ${blockHead('配色', '整個網站只用三種顏色：墨水是文字、原子筆是連結與重點、螢光筆是滑過時的底色。紙張固定是米白色。')}
      <div class="presets" role="group" aria-label="配色範本">
        ${THEME_PRESETS.map((p) => `
        <button type="button" class="preset${activePreset && activePreset.id === p.id ? ' on' : ''}" data-preset="${p.id}" aria-pressed="${activePreset && activePreset.id === p.id}">
          <span class="swatch" style="background:${PAPER}">
            <i style="background:${p.ink}"></i><i style="background:${p.accent}"></i><i style="background:${p.mark}"></i>
          </span>
          <span>${esc(p.name)}</span>
        </button>`).join('')}
      </div>
      <div class="form-grid three">
        ${fld('墨水', `<input type="color" data-path="settings.theme.ink" value="${th.ink}">`)}
        ${fld('原子筆', `<input type="color" data-path="settings.theme.accent" value="${th.accent}">`)}
        ${fld('螢光筆', `<input type="color" data-path="settings.theme.mark" value="${th.mark}">`)}
      </div>
      <ul class="ratios" id="ratios" aria-label="對比檢查"></ul>
    </section>

    <section class="block">
      ${blockHead('區塊順序與顯示', '決定首頁各區塊的先後。沒有內容的區塊，就算勾選了顯示，前台也會自動隱藏。')}
      <div class="rlist wide" id="secs"></div>
    </section>

    <section class="block">
      ${blockHead('作品清單')}
      <div class="form-grid">
        ${fld('預設排序', `<select data-path="settings.work.defaultSort">
          <option value="default"${d.settings.work.defaultSort === 'default' ? ' selected' : ''}>照後台的順序</option>
          <option value="az"${d.settings.work.defaultSort === 'az' ? ' selected' : ''}>名稱 A → Z</option>
          <option value="category"${d.settings.work.defaultSort === 'category' ? ' selected' : ''}>依分類</option>
        </select>`, '訪客仍可以自己切換。')}
        <div class="field"><label>選項</label>
          <label class="check"><input type="checkbox" data-path="settings.work.showSearch"${d.settings.work.showSearch ? ' checked' : ''}> 顯示搜尋欄與分類篩選</label>
          <label class="check"><input type="checkbox" data-path="settings.work.expandFirst"${d.settings.work.expandFirst ? ' checked' : ''}> 預設展開第一個專案</label>
        </div>
      </div>
    </section>

    <section class="block">
      ${blockHead('頁尾')}
      ${fld('頁尾文字', `<input data-path="settings.footerText" value="${esc(d.settings.footerText)}" maxlength="120" placeholder="留空會顯示「© 年份 姓名」">`)}
    </section>

    <section class="block">
      ${blockHead('聯絡表單', '開啟後，聯絡區塊會多一個留言表單，訪客的留言會出現在後台的「訊息」。')}
      <label class="check"><input type="checkbox" data-path="settings.contactForm.enabled"${d.settings.contactForm.enabled ? ' checked' : ''}> 在首頁顯示聯絡表單</label>
      ${fld('表單上方的說明', `<input data-path="settings.contactForm.notice" value="${esc(d.settings.contactForm.notice)}" maxlength="120" placeholder="例如：通常一到兩天內回覆">`)}
      <p class="hint">表單要能送出，需要先把專案裡的 <code>firestore.rules</code> 貼到 Firebase 主控台並發布，否則訪客送出時會失敗。</p>
    </section>`;

    // ---- 對比檢查 ----
    const drawRatios = () => {
      const t = state.draft.settings.theme;
      $('#ratios', root).innerHTML =
        ratioRow('墨水在紙上', t.ink, PAPER, 7, '文字') +
        ratioRow('原子筆在紙上', t.accent, PAPER, 4.5, '連結') +
        ratioRow('墨水在螢光筆上', t.ink, t.mark, 4.5, '滑過時的文字');
    };
    drawRatios();

    $('.presets', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const p = THEME_PRESETS.find((x) => x.id === b.dataset.preset);
      mutate(LABEL, (x) => { x.settings.theme = { ink: p.ink, accent: p.accent, mark: p.mark }; });
      rerender();
    });

    // ---- 區塊 ----
    const secs = $('#secs', root);
    const drawSecs = () => {
      const list = state.draft.settings.sections;
      secs.innerHTML = list.map((s, i) => {
        const empty = !sectionHasContent(state.draft, s.key);
        return `
        <div class="rrow sec" data-i="${i}">
          <label class="check"><input type="checkbox" data-path="settings.sections.${i}.visible"${s.visible ? ' checked' : ''}> ${esc(SECTION_LABELS[s.key])}</label>
          <span class="sec-note">${empty ? '目前沒有內容，前台不會顯示' : s.visible ? '' : '已隱藏'}</span>
          <span class="rbtns">
            <button type="button" class="btn-icon" data-act="up" aria-label="上移"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="btn-icon" data-act="down" aria-label="下移"${i === list.length - 1 ? ' disabled' : ''}>↓</button>
          </span>
        </div>`;
      }).join('');
    };
    drawSecs();
    secs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = +b.closest('.sec').dataset.i;
      mutate(LABEL, (x) => moveItem(x.settings.sections, i, b.dataset.act === 'up' ? -1 : 1));
      drawSecs();
      const again = $(`.sec[data-i="${i + (b.dataset.act === 'up' ? -1 : 1)}"] [data-act="${b.dataset.act}"]`, secs);
      if (again && !again.disabled) again.focus();
    });
    // 勾選時只更新說明文字，避免重畫後失去鍵盤焦點
    secs.addEventListener('input', (e) => {
      const row = e.target.closest('.sec');
      if (!row) return;
      setTimeout(() => {
        const s = state.draft.settings.sections[+row.dataset.i];
        const empty = !sectionHasContent(state.draft, s.key);
        $('.sec-note', row).textContent = empty ? '目前沒有內容，前台不會顯示' : s.visible ? '' : '已隱藏';
      }, 0);
    });

    bindPaths(root, (path, v) => {
      mutate(LABEL, (x) => setPath(x, path, v));
      if (path.startsWith('settings.theme.')) {
        drawRatios();
        // 手動調色之後，不再屬於任何範本
        $$('.preset.on', root).forEach((p) => { p.classList.remove('on'); p.setAttribute('aria-pressed', 'false'); });
      }
    });
  },
};
