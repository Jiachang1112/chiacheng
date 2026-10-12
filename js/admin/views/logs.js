import { state, mutate, rerender } from '../core.js';
import { $, $$, esc, fld, openModal, confirmDialog, toast } from '../ui.js';
import { uid, today, fmtDate, mdLite } from '../../data.js';

const ui = { q: '' };

function sorted() {
  const q = ui.q.trim().toLowerCase();
  return state.draft.logs
    .slice()
    .filter((l) => !q || (l.title + ' ' + l.content).toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
}

// 在 textarea 選取的文字前後加符號
function wrap(ta, before, after, placeholder) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const mid = value.slice(s, e) || placeholder;
  ta.value = value.slice(0, s) + before + mid + after + value.slice(e);
  ta.focus();
  ta.setSelectionRange(s + before.length, s + before.length + mid.length);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function openEditor(id) {
  const isNew = !id;
  const src = isNew
    ? { id: uid(), date: today(), title: '', content: '', pinned: false }
    : { ...state.draft.logs.find((l) => l.id === id) };
  if (!src.id) return;

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      ${fld('日期', `<input type="date" id="l-date" value="${/^\d{4}-\d{2}-\d{2}$/.test(src.date) ? src.date : ''}">`)}
      <div class="field"><label>置頂</label><label class="check"><input type="checkbox" id="l-pin"${src.pinned ? ' checked' : ''}> 放在日誌最上面</label></div>
    </div>
    ${fld('標題（選填）', `<input id="l-title" value="${esc(src.title)}" maxlength="80">`)}
    <div class="field">
      <label for="l-content">內容</label>
      <div class="md-tools" role="toolbar" aria-label="格式工具">
        <button type="button" class="btn btn-sm" data-md="bold">粗體</button>
        <button type="button" class="btn btn-sm" data-md="link">連結</button>
        <button type="button" class="btn btn-sm" data-md="list">清單</button>
        <button type="button" class="btn btn-sm" data-md="code">程式碼</button>
      </div>
      <textarea id="l-content" rows="8">${esc(src.content)}</textarea>
      <p class="err" id="l-err" hidden>標題和內容至少要填一個。</p>
    </div>
    <div class="field"><label>預覽</label><div class="md-prev md" id="l-prev"></div></div>`;
  const ta = $('#l-content', body);
  const prev = $('#l-prev', body);
  const draw = () => { prev.innerHTML = mdLite(ta.value) || '<p class="hint">還沒有內容。</p>'; };
  draw();
  ta.addEventListener('input', draw);
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-md]');
    if (!b) return;
    const k = b.dataset.md;
    if (k === 'bold') wrap(ta, '**', '**', '粗體文字');
    if (k === 'code') wrap(ta, '`', '`', '程式碼');
    if (k === 'link') wrap(ta, '[', '](https://)', '連結文字');
    if (k === 'list') {
      const { selectionStart: s, selectionEnd: en, value } = ta;
      const a = value.lastIndexOf('\n', s - 1) + 1;
      const seg = value.slice(a, en) || '項目';
      ta.value = value.slice(0, a) + seg.split('\n').map((l) => (/^\s*[-*]\s/.test(l) ? l : '- ' + l)).join('\n') + value.slice(en);
      ta.focus();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const save = () => {
    const title = $('#l-title', body).value.trim();
    const content = ta.value.trim();
    $('#l-err', body).hidden = !!(title || content);
    if (!title && !content) return false;
    const out = { id: src.id, date: $('#l-date', body).value || today(), title, content, pinned: $('#l-pin', body).checked };
    mutate({ key: 'logs', label: isNew ? '新增日誌' : '修改日誌' }, (d) => {
      if (isNew) d.logs.unshift(out);
      else d.logs[d.logs.findIndex((l) => l.id === src.id)] = out;
    });
    toast(isNew ? '已新增日誌（草稿）' : '已更新日誌（草稿）', 'ok');
    rerender();
  };
  openModal({ title: isNew ? '新增日誌' : '編輯日誌', body, size: 'lg', footer: [{ label: '取消' }, { label: '儲存', kind: 'primary', onClick: save }] });
}

export default {
  title: '日誌',
  render(root) {
    root.innerHTML = `
    <div class="toolbar">
      <input type="search" id="lq" placeholder="搜尋日誌" value="${esc(ui.q)}" aria-label="搜尋日誌">
      <span class="grow"></span>
      <button type="button" class="btn btn-primary" id="lnew">新增日誌</button>
    </div>
    <div id="llist"></div>`;
    const list = $('#llist', root);
    const draw = () => {
      const items = sorted();
      if (!items.length) {
        list.innerHTML = `<p class="empty-s">${state.draft.logs.length ? '沒有符合的日誌。' : '還沒有日誌。寫下開發進度或隨筆，會顯示在首頁的「日誌」區塊。'}</p>`;
        return;
      }
      list.innerHTML = items.map((l) => {
        const first = (l.title || l.content).replace(/\s+/g, ' ').slice(0, 70);
        return `
        <div class="lrow" data-id="${esc(l.id)}">
          <span class="ldate">${esc(fmtDate(l.date))}</span>
          <span class="lmain"><button type="button" class="linkish" data-act="edit">${esc(first)}</button>${l.pinned ? '<span class="pin">置頂</span>' : ''}</span>
          <span class="lacts"><button type="button" class="btn btn-sm" data-act="edit">編輯</button><button type="button" class="btn-icon danger" data-act="del" aria-label="刪除">×</button></span>
        </div>`;
      }).join('');
    };
    draw();
    $('#lq', root).addEventListener('input', (e) => { ui.q = e.target.value; draw(); });
    $('#lnew', root).addEventListener('click', () => openEditor(null));
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.closest('.lrow').dataset.id;
      if (b.dataset.act === 'edit') openEditor(id);
      if (b.dataset.act === 'del') {
        if (await confirmDialog({ title: '刪除日誌', message: '確定要刪除這篇日誌嗎？這只會影響草稿。', confirmLabel: '刪除', danger: true })) {
          mutate({ key: 'logs', label: '刪除日誌' }, (d) => d.logs.splice(d.logs.findIndex((l) => l.id === id), 1));
          draw();
        }
      }
    });
  },
};
