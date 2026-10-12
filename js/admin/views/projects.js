import { state, mutate, rerender } from '../core.js';
import { $, $$, esc, fld, openModal, confirmDialog, chipInput, toast, moveItem, blockHead } from '../ui.js';
import { STATUS, uid, clone, safeUrl, safeImg, allTech } from '../../data.js';

// 篩選條件放在模組變數裡，重新繪製後還在
const ui = { q: '', cat: 'all', status: 'all', sort: 'manual', sel: new Set() };

const LABEL = (name) => ({ key: 'project:' + name, label: `修改專案「${name || '未命名'}」` });
const LIST_LABEL = { key: 'projects', label: '調整專案清單' };

function categories() {
  const out = [];
  state.draft.projects.forEach((p) => { if (!out.includes(p.category)) out.push(p.category); });
  return out;
}

function techSuggestions() {
  const set = new Set(allTech(state.draft).map((t) => t.name));
  state.draft.stack.forEach((g) => g.items.forEach((i) => set.add(i)));
  return [...set];
}

function visible() {
  let list = state.draft.projects.map((p, i) => ({ p, i }));
  if (ui.cat !== 'all') list = list.filter(({ p }) => p.category === ui.cat);
  if (ui.status !== 'all') list = list.filter(({ p }) => p.status === ui.status);
  const q = ui.q.trim().toLowerCase();
  if (q) list = list.filter(({ p }) => [p.name, p.tagline, p.desc, p.category, ...p.tech].some((s) => String(s).toLowerCase().includes(q)));
  if (ui.sort === 'name') list.sort((a, b) => a.p.name.localeCompare(b.p.name, 'zh-Hant'));
  else if (ui.sort === 'category') list.sort((a, b) => a.p.category.localeCompare(b.p.category, 'zh-Hant'));
  else if (ui.sort === 'status') list.sort((a, b) => Object.keys(STATUS).indexOf(a.p.status) - Object.keys(STATUS).indexOf(b.p.status));
  return list;
}

const filtering = () => ui.q.trim() || ui.cat !== 'all' || ui.status !== 'all' || ui.sort !== 'manual';

// ============ 編輯視窗 ============
function openEditor(id) {
  const isNew = !id;
  const idx = isNew ? -1 : state.draft.projects.findIndex((p) => p.id === id);
  if (!isNew && idx < 0) return;
  const cats = categories();
  const src = isNew
    ? {
        id: uid(), category: ui.cat !== 'all' ? ui.cat : cats[cats.length - 1] || '未分類', name: '', tagline: '', desc: '',
        tech: [], links: { github: '', demo: '' }, status: 'live', featured: false, year: '', cover: '',
      }
    : clone(state.draft.projects[idx]);

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      ${fld('名稱', `<input id="e-name" value="${esc(src.name)}" maxlength="80" required><p class="err" id="e-name-err" hidden>請填寫專案名稱。</p>`)}
      ${fld('一句話標語', `<input id="e-tagline" value="${esc(src.tagline)}" maxlength="100">`)}
    </div>
    <div class="form-grid">
      ${fld('分類', `<input id="e-cat" list="e-catlist" value="${esc(src.category)}" maxlength="40"><datalist id="e-catlist">${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>`, '輸入新名稱就會建立新分類。')}
      ${fld('狀態', `<select id="e-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${src.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`)}
    </div>
    <div class="form-grid">
      ${fld('年份（選填）', `<input id="e-year" value="${esc(src.year)}" maxlength="9" placeholder="2026">`)}
      <div class="field"><label>精選</label><label class="check"><input type="checkbox" id="e-feat"${src.featured ? ' checked' : ''}> 放在作品列表的最前面</label></div>
    </div>
    ${fld('詳細介紹', `<textarea id="e-desc" rows="5">${esc(src.desc)}</textarea>`, '展開專案時顯示。')}
    ${fld('使用的技術', '<div id="e-tech"></div>', '輸入後按 Enter 加入。可以從建議清單挑選。')}
    <div class="form-grid">
      ${fld('GitHub 網址', `<input id="e-gh" value="${esc(src.links.github)}" placeholder="https://github.com/…"><p class="err" id="e-gh-err" hidden>網址格式不正確。</p>`)}
      ${fld('網站網址', `<input id="e-demo" value="${esc(src.links.demo)}" placeholder="https://…"><p class="err" id="e-demo-err" hidden>網址格式不正確。</p>`)}
    </div>
    ${fld('封面圖網址（選填）', `<input id="e-cover" value="${esc(src.cover)}" placeholder="https://…/screenshot.png"><p class="err" id="e-cover-err" hidden>請填入 http(s) 開頭的圖片網址。</p>`, '展開專案時顯示在最上方。')}`;

  const tech = chipInput($('#e-tech', body), { values: src.tech, suggestions: techSuggestions() });

  const save = () => {
    const v = (sel) => $(sel, body).value.trim();
    const err = (sel, bad) => { $(sel, body).hidden = !bad; return bad; };
    const name = v('#e-name');
    const gh = v('#e-gh');
    const demo = v('#e-demo');
    const cover = v('#e-cover');
    let bad = false;
    if (err('#e-name-err', !name)) { bad = true; $('#e-name', body).focus(); }
    if (err('#e-gh-err', gh && !safeUrl(gh))) bad = true;
    if (err('#e-demo-err', demo && !safeUrl(demo))) bad = true;
    if (err('#e-cover-err', cover && !safeImg(cover))) bad = true;
    if (bad) return false;
    const out = {
      id: src.id,
      category: v('#e-cat') || '未分類',
      name,
      tagline: v('#e-tagline'),
      desc: $('#e-desc', body).value.trim(),
      tech: tech.values,
      links: { github: gh ? safeUrl(gh) : '', demo: demo ? safeUrl(demo) : '' },
      status: $('#e-status', body).value,
      featured: $('#e-feat', body).checked,
      year: v('#e-year'),
      cover,
    };
    mutate(isNew ? { key: 'projects', label: `新增專案「${name}」` } : LABEL(name), (d) => {
      if (isNew) d.projects.push(out);
      else d.projects[d.projects.findIndex((p) => p.id === src.id)] = out;
    });
    toast(isNew ? '已新增專案（草稿）' : '已更新專案（草稿）', 'ok');
    rerender();
  };

  const footer = [];
  if (!isNew) {
    footer.push({
      label: '刪除專案', kind: 'danger',
      onClick: async (api) => {
        if (await confirmDialog({ title: '刪除專案', message: `確定要刪除「${esc(src.name)}」嗎？這只會影響草稿，發布前都還可以用「放棄變更」救回來。`, confirmLabel: '刪除', danger: true })) {
          mutate({ key: 'projects', label: `刪除專案「${src.name}」` }, (d) => d.projects.splice(d.projects.findIndex((p) => p.id === src.id), 1));
          ui.sel.delete(src.id);
          rerender();
          return true;
        }
        return false;
      },
    });
  }
  footer.push({ label: '取消' }, { label: '儲存', kind: 'primary', onClick: save });
  const m = openModal({ title: isNew ? '新增專案' : '編輯專案', body, footer, size: 'lg' });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && !e.target.classList.contains('chip-in')) {
      e.preventDefault();
      if (save() !== false) m.close();
    }
  });
}

// ============ 主畫面 ============
export default {
  title: '專案',
  render(root) {
    const cats = categories();
    if (ui.cat !== 'all' && !cats.includes(ui.cat)) ui.cat = 'all';
    // 已經不存在的選取項目清掉
    const ids = new Set(state.draft.projects.map((p) => p.id));
    ui.sel.forEach((id) => { if (!ids.has(id)) ui.sel.delete(id); });

    root.innerHTML = `
    <div class="toolbar">
      <input type="search" id="pq" placeholder="搜尋名稱、介紹、技術" value="${esc(ui.q)}" aria-label="搜尋專案">
      <select id="pcat" aria-label="分類">
        <option value="all">全部分類</option>
        ${cats.map((c) => `<option value="${esc(c)}"${ui.cat === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <select id="pstatus" aria-label="狀態">
        <option value="all">全部狀態</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${ui.status === k ? ' selected' : ''}>${v}</option>`).join('')}
      </select>
      <select id="psort" aria-label="排序">
        <option value="manual"${ui.sort === 'manual' ? ' selected' : ''}>手動順序</option>
        <option value="name"${ui.sort === 'name' ? ' selected' : ''}>名稱</option>
        <option value="category"${ui.sort === 'category' ? ' selected' : ''}>分類</option>
        <option value="status"${ui.sort === 'status' ? ' selected' : ''}>狀態</option>
      </select>
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" id="pnew">新增專案</button>
    </div>
    <div class="bulk" id="bulk" hidden></div>
    <p class="count" id="pcount"></p>
    <div class="table-wrap"><table class="table" id="ptable"><thead><tr>
      <th class="c-sel"><input type="checkbox" id="pall" aria-label="全選目前列出的專案"></th>
      <th>專案</th><th class="c-cat">分類</th><th>狀態</th><th class="c-tags">內容</th><th>精選</th><th class="c-acts">操作</th>
    </tr></thead><tbody></tbody></table></div>`;

    const tbody = $('tbody', root);

    const drawBulk = () => {
      const bulk = $('#bulk', root);
      const n = ui.sel.size;
      bulk.hidden = !n;
      if (!n) return;
      bulk.innerHTML = `
        <strong>已選 ${n} 個</strong>
        <button type="button" class="btn btn-sm" data-bulk="cat">變更分類</button>
        <button type="button" class="btn btn-sm" data-bulk="status">變更狀態</button>
        <button type="button" class="btn btn-sm" data-bulk="feat">設為精選</button>
        <button type="button" class="btn btn-sm" data-bulk="unfeat">取消精選</button>
        <button type="button" class="btn btn-sm btn-danger" data-bulk="del">刪除</button>
        <button type="button" class="btn btn-sm btn-ghost" data-bulk="clear">取消選取</button>`;
    };

    const drawTable = () => {
      const list = visible();
      const canMove = !filtering();
      $('#pcount', root).textContent = `顯示 ${list.length} 個，共 ${state.draft.projects.length} 個專案。${canMove ? '' : '（篩選或排序時無法調整順序）'}`;
      $('#pall', root).checked = list.length > 0 && list.every(({ p }) => ui.sel.has(p.id));
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-s">${state.draft.projects.length ? '沒有符合條件的專案。' : '還沒有專案。按右上角「新增專案」開始。'}</td></tr>`;
        drawBulk();
        return;
      }
      tbody.innerHTML = list.map(({ p, i }, n) => `
      <tr data-id="${esc(p.id)}">
        <td class="c-sel" data-label=""><input type="checkbox" data-sel="${esc(p.id)}" aria-label="選取 ${esc(p.name)}"${ui.sel.has(p.id) ? ' checked' : ''}></td>
        <td class="c-main" data-label="專案"><button type="button" class="linkish" data-act="edit">${esc(p.name || '（未命名）')}</button><span class="sub">${esc(p.tagline)}</span><span class="sub cat-sub">${esc(p.category)}</span></td>
        <td data-label="分類" class="c-cat">${esc(p.category)}</td>
        <td data-label="狀態">${STATUS[p.status]}${p.year ? `　${esc(p.year)}` : ''}</td>
        <td data-label="內容" class="c-tags">${p.tech.length} 項技術${p.links.github ? '　GitHub' : ''}${p.links.demo ? '　網站' : ''}${!p.desc ? '<span class="warn-s">　缺介紹</span>' : ''}</td>
        <td data-label="精選"><label class="check"><input type="checkbox" data-feat="${esc(p.id)}"${p.featured ? ' checked' : ''} aria-label="精選 ${esc(p.name)}"></label></td>
        <td class="c-acts" data-label="">
          <button type="button" class="btn-icon" data-act="up" aria-label="上移"${!canMove || i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="btn-icon" data-act="down" aria-label="下移"${!canMove || i === state.draft.projects.length - 1 ? ' disabled' : ''}>↓</button>
          <button type="button" class="btn btn-sm" data-act="edit">編輯</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="dup">複製</button>
          <button type="button" class="btn-icon danger" data-act="del" aria-label="刪除 ${esc(p.name)}">×</button>
        </td>
      </tr>`).join('');
      drawBulk();
    };
    drawTable();

    // ---- 篩選 ----
    $('#pq', root).addEventListener('input', (e) => { ui.q = e.target.value; drawTable(); });
    $('#pcat', root).addEventListener('change', (e) => { ui.cat = e.target.value; drawTable(); });
    $('#pstatus', root).addEventListener('change', (e) => { ui.status = e.target.value; drawTable(); });
    $('#psort', root).addEventListener('change', (e) => { ui.sort = e.target.value; drawTable(); });
    $('#pnew', root).addEventListener('click', () => openEditor(null));

    // ---- 列上的操作 ----
    tbody.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const tr = b.closest('tr');
      const id = tr.dataset.id;
      const idx = state.draft.projects.findIndex((p) => p.id === id);
      const p = state.draft.projects[idx];
      const act = b.dataset.act;
      if (act === 'edit') openEditor(id);
      if (act === 'up' || act === 'down') {
        mutate(LIST_LABEL, (d) => moveItem(d.projects, idx, act === 'up' ? -1 : 1));
        drawTable();
        const again = $(`tr[data-id="${CSS.escape(id)}"] [data-act="${act}"]`, tbody);
        if (again && !again.disabled) again.focus();
      }
      if (act === 'dup') {
        mutate({ key: 'projects', label: `複製專案「${p.name}」` }, (d) => d.projects.splice(idx + 1, 0, { ...clone(p), id: uid(), name: p.name + '（副本）', featured: false }));
        toast('已複製，放在原專案下方', 'ok');
        drawTable();
      }
      if (act === 'del') {
        if (await confirmDialog({ title: '刪除專案', message: `確定要刪除「${esc(p.name)}」嗎？這只會影響草稿，發布前都還可以用「放棄變更」救回來。`, confirmLabel: '刪除', danger: true })) {
          mutate({ key: 'projects', label: `刪除專案「${p.name}」` }, (d) => d.projects.splice(idx, 1));
          ui.sel.delete(id);
          rerender();
        }
      }
    });
    tbody.addEventListener('change', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const id = tr.dataset.id;
      if (e.target.matches('[data-sel]')) {
        if (e.target.checked) ui.sel.add(id);
        else ui.sel.delete(id);
        $('#pall', root).checked = visible().every(({ p }) => ui.sel.has(p.id));
        drawBulk();
      }
      if (e.target.matches('[data-feat]')) {
        const p = state.draft.projects.find((x) => x.id === id);
        mutate(LABEL(p.name), () => { p.featured = e.target.checked; });
      }
    });
    $('#pall', root).addEventListener('change', (e) => {
      visible().forEach(({ p }) => { if (e.target.checked) ui.sel.add(p.id); else ui.sel.delete(p.id); });
      drawTable();
    });

    // ---- 批次操作 ----
    $('#bulk', root).addEventListener('click', async (e) => {
      const b = e.target.closest('[data-bulk]');
      if (!b) return;
      const act = b.dataset.bulk;
      const picked = () => state.draft.projects.filter((p) => ui.sel.has(p.id));
      const n = ui.sel.size;
      if (act === 'clear') { ui.sel.clear(); drawTable(); return; }
      if (act === 'feat' || act === 'unfeat') {
        mutate({ key: 'projects', label: `批次${act === 'feat' ? '設定' : '取消'}精選（${n} 個）` }, () => picked().forEach((p) => { p.featured = act === 'feat'; }));
        drawTable();
      }
      if (act === 'del') {
        if (await confirmDialog({ title: '刪除專案', message: `確定要刪除選取的 ${n} 個專案嗎？這只會影響草稿。`, confirmLabel: '刪除', danger: true })) {
          mutate({ key: 'projects', label: `批次刪除專案（${n} 個）` }, (d) => { d.projects = d.projects.filter((p) => !ui.sel.has(p.id)); });
          ui.sel.clear();
          rerender();
        }
      }
      if (act === 'cat') {
        const body = document.createElement('div');
        body.innerHTML = fld('新的分類', `<input id="b-cat" list="b-catlist" maxlength="40" placeholder="輸入或選擇分類"><datalist id="b-catlist">${categories().map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>`);
        openModal({
          title: `變更 ${n} 個專案的分類`, size: 'sm', body,
          footer: [{ label: '取消' }, {
            label: '變更', kind: 'primary',
            onClick: () => {
              const v = $('#b-cat', body).value.trim();
              if (!v) { $('#b-cat', body).focus(); return false; }
              mutate({ key: 'projects', label: `批次變更分類為「${v}」（${n} 個）` }, () => picked().forEach((p) => { p.category = v; }));
              rerender();
            },
          }],
        });
      }
      if (act === 'status') {
        const body = document.createElement('div');
        body.innerHTML = fld('新的狀態', `<select id="b-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`);
        openModal({
          title: `變更 ${n} 個專案的狀態`, size: 'sm', body,
          footer: [{ label: '取消' }, {
            label: '變更', kind: 'primary',
            onClick: () => {
              const v = $('#b-status', body).value;
              mutate({ key: 'projects', label: `批次變更狀態為「${STATUS[v]}」（${n} 個）` }, () => picked().forEach((p) => { p.status = v; }));
              rerender();
            },
          }],
        });
      }
    });
  },
};
