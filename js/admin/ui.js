// 後台共用的小元件：提示訊息、對話框、標籤輸入、時間格式…
import { esc } from '../data.js';

export { esc };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function debounce(fn, ms = 250) {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.flush = () => {
    clearTimeout(t);
    fn();
  };
  return d;
}

// 用 "projects.3.name" 這種路徑讀寫物件
export function getPath(o, path) {
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}
export function setPath(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const target = ks.reduce((a, k) => a[k], o);
  target[last] = v;
}

// ============ 時間 ============
const p2 = (n) => String(n).padStart(2, '0');
export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function ago(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return '剛剛';
  if (s < 3600) return Math.floor(s / 60) + ' 分鐘前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小時前';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
  return fmtDateTime(iso).slice(0, 10);
}

export function fmtBytes(n) {
  return n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ============ 提示訊息 ============
export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6500 : 3200);
}

// ============ 對話框 ============
const modals = [];
let modalSeq = 0;

document.addEventListener('keydown', (e) => {
  const top = modals[modals.length - 1];
  if (!top) return;
  if (e.key === 'Escape' && top.closable) {
    e.stopPropagation();
    top.close();
  }
  if (e.key === 'Tab') {
    const f = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', top.el).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}, true);

// footer: [{label, kind:'primary'|'danger'|'', onClick(api) → 回傳 false 代表不要關閉}]
export function openModal({ title, body, footer = [], size = 'md', closable = true, onClose }) {
  const id = 'm' + ++modalSeq;
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="modal-head"><h2 id="${id}">${esc(title)}</h2>${closable ? '<button type="button" class="btn-icon" data-close aria-label="關閉">×</button>' : ''}</div>
      <div class="modal-body"></div>
      ${footer.length ? '<div class="modal-foot"></div>' : ''}
    </div>`;
  const bodyEl = $('.modal-body', back);
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.append(body);
  const prev = document.activeElement;
  let closed = false;
  const api = {
    el: back,
    body: bodyEl,
    close(result) {
      if (closed) return;
      closed = true;
      const i = modals.indexOf(api);
      if (i >= 0) modals.splice(i, 1);
      back.remove();
      if (!modals.length) document.body.classList.remove('modal-open');
      if (prev && prev.focus) prev.focus();
      if (onClose) onClose(result);
    },
    closable,
    setBusy(busy, label) {
      $$('.modal-foot button', back).forEach((b) => (b.disabled = busy));
      const primary = $('.modal-foot .btn-primary, .modal-foot .btn-danger', back);
      if (primary) {
        if (busy) {
          primary.dataset.label = primary.textContent;
          if (label) primary.textContent = label;
        } else if (primary.dataset.label) primary.textContent = primary.dataset.label;
      }
    },
  };
  const foot = $('.modal-foot', back);
  footer.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (f.kind ? ' btn-' + f.kind : '');
    b.textContent = f.label;
    b.addEventListener('click', async () => {
      const r = f.onClick ? await f.onClick(api) : undefined;
      if (r !== false) api.close(f.value);
    });
    foot.append(b);
  });
  back.addEventListener('mousedown', (e) => {
    if (e.target === back && closable) api.close();
  });
  back.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });
  document.body.append(back);
  document.body.classList.add('modal-open');
  modals.push(api);
  const first = $('input:not([type=hidden]), textarea, select', bodyEl) || $('.modal-foot .btn-primary, .modal-foot .btn-danger', back) || $('.modal', back);
  if (first) {
    if (!first.hasAttribute('tabindex') && first.classList.contains('modal')) first.setAttribute('tabindex', '-1');
    first.focus();
  }
  return api;
}

export function confirmDialog({ title, message, confirmLabel = '確定', cancelLabel = '取消', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      size: 'sm',
      body: `<p class="modal-text">${message}</p>`,
      footer: [
        { label: cancelLabel, onClick: () => { answered = true; resolve(false); } },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } },
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

// ============ 標籤輸入（技術標籤用） ============
export function chipInput(host, { values = [], suggestions = [], placeholder = '輸入後按 Enter', onChange }) {
  let vals = [...values];
  const lid = 'dl' + Math.random().toString(36).slice(2, 8);
  host.classList.add('chipbox');

  function draw(focus) {
    host.innerHTML =
      vals.map((v, i) => `<span class="chip">${esc(v)}<button type="button" data-i="${i}" aria-label="移除 ${esc(v)}">×</button></span>`).join('') +
      `<input class="chip-in" list="${lid}" placeholder="${esc(vals.length ? '' : placeholder)}" aria-label="新增項目" autocomplete="off">` +
      `<datalist id="${lid}">${suggestions.filter((s) => !vals.some((v) => v.toLowerCase() === s.toLowerCase())).map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>`;
    if (focus) $('.chip-in', host).focus();
  }
  function add(raw, focus) {
    let changed = false;
    String(raw).split(/[,，、\n]/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
      if (!vals.some((v) => v.toLowerCase() === s.toLowerCase())) {
        vals.push(s);
        changed = true;
      }
    });
    draw(focus);
    if (changed && onChange) onChange([...vals]);
  }
  host.addEventListener('keydown', (e) => {
    if (!e.target.matches('.chip-in')) return;
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      if (e.target.value.trim()) add(e.target.value, true);
    } else if (e.key === 'Backspace' && !e.target.value && vals.length) {
      vals.pop();
      draw(true);
      if (onChange) onChange([...vals]);
    }
  });
  host.addEventListener('input', (e) => {
    // 從建議清單挑選時
    if (e.target.matches('.chip-in') && e.inputType === 'insertReplacementText') add(e.target.value, true);
  });
  host.addEventListener('focusout', (e) => {
    if (e.target.matches('.chip-in') && e.target.value.trim()) add(e.target.value, false);
  });
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) {
      vals.splice(+b.dataset.i, 1);
      draw(true);
      if (onChange) onChange([...vals]);
    } else if (e.target === host) {
      $('.chip-in', host).focus();
    }
  });
  draw(false);
  return { get values() { return [...vals]; } };
}

// 表單欄位的外框
export function fld(label, inner, hint = '', cls = '') {
  return `<div class="field ${cls}"><label>${label}</label>${inner}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

// 在容器上用 data-path 自動綁定輸入欄位 → 呼叫 onSet(path, value, el)
export function bindPaths(root, onSet) {
  const handler = (e) => {
    const el = e.target.closest('[data-path]');
    if (!el || !root.contains(el)) return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else v = el.value;
    onSet(el.dataset.path, v, el);
  };
  // 文字、核取方塊、下拉選單、顏色、日期在現代瀏覽器都會觸發 input，只聽這個就夠，避免重複觸發
  root.addEventListener('input', handler);
}

// 陣列內交換位置；成功回傳 true
export function moveItem(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

// 區塊標題（每個畫面的小節都用這個）
export function blockHead(title, desc = '', right = '') {
  return `<div class="block-head"><div><h2>${title}</h2>${desc ? `<p class="hint">${desc}</p>` : ''}</div>${right ? `<div class="block-act">${right}</div>` : ''}</div>`;
}
