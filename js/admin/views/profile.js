import { state, mutate } from '../core.js';
import { $, esc, fld, bindPaths, setPath, toast, fmtBytes, moveItem, blockHead } from '../ui.js';
import { safeImg } from '../../data.js';

const LABEL = { key: 'profile', label: '修改基本資料' };

// 縮成最長邊 640px 的 JPEG，轉成 data URL（約 100KB 內，直接存在資料裡，不需要另外的圖片空間）
async function toAvatar(file) {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔。');
  if (file.size > 15 * 1024 * 1024) throw new Error('圖片超過 15MB，請先縮小。');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('無法讀取這張圖片，請換一張。'));
      i.src = url;
    });
    const s = Math.min(1, 640 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * s));
    const h = Math.max(1, Math.round(img.height * s));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, w, h);
    x.drawImage(img, 0, 0, w, h);
    let q = 0.86;
    let out = c.toDataURL('image/jpeg', q);
    while (out.length > 200000 && q > 0.45) {
      q -= 0.08;
      out = c.toDataURL('image/jpeg', q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default {
  title: '基本資料',
  render(root) {
    const d = state.draft;
    const isData = d.hero.avatar.startsWith('data:');
    root.innerHTML = `
    <section class="block">
      ${blockHead('首頁', '網站最上方的內容。姓名會變成超大標題，也會出現在頂欄和頁尾。')}
      <div class="form-grid">
        ${fld('姓名', `<input data-path="hero.name" value="${esc(d.hero.name)}" maxlength="40">`)}
        ${fld('標語', `<input data-path="hero.tagline" value="${esc(d.hero.tagline)}" maxlength="80">`, '一句話，顯示在姓名下方。')}
      </div>
      ${fld('簡介', `<textarea data-path="hero.intro" rows="3">${esc(d.hero.intro)}</textarea>`)}
      <div class="field">
        <label>頭像</label>
        <div class="avatar-row">
          <div class="avatar-prev" id="avPrev"></div>
          <div class="avatar-ctl">
            <div class="btn-row">
              <button type="button" class="btn btn-sm" id="avPick">上傳圖片</button>
              <button type="button" class="btn btn-sm btn-ghost" id="avClear">移除頭像</button>
              <input type="file" id="avFile" accept="image/*" hidden>
            </div>
            <input id="avUrl" placeholder="或貼上圖片網址（https://…）" value="${isData ? '' : esc(d.hero.avatar)}" aria-label="頭像網址">
            <p class="hint" id="avInfo"></p>
          </div>
        </div>
        <p class="hint">沒有頭像時，首頁只顯示文字。上傳的圖片會自動縮小並直接存進網站資料。</p>
      </div>
    </section>

    <section class="block">
      ${blockHead('關於', '用空一行分段。支援 **粗體**、[文字](網址)、「- 」開頭的清單。')}
      <textarea data-path="about.body" rows="9" aria-label="關於內容">${esc(d.about.body)}</textarea>
    </section>

    <section class="block">
      ${blockHead('聯絡方式', '沒有填的項目不會顯示。全部都沒填，聯絡區塊會自動隱藏。')}
      <div class="form-grid">
        ${fld('Email', `<input data-path="contact.email" type="email" value="${esc(d.contact.email)}" placeholder="you@example.com">`)}
        ${fld('GitHub', `<input data-path="contact.github" value="${esc(d.contact.github)}" placeholder="https://github.com/你的帳號">`)}
      </div>
      <div class="field"><label>其他連結</label>
        <div class="rlist" id="others"></div>
        <div class="btn-row"><button type="button" class="btn btn-sm" id="addOther">新增連結</button></div>
      </div>
    </section>

    <section class="block">
      ${blockHead('搜尋引擎', 'Google 搜尋結果的標題與說明，已搬到獨立的「搜尋結果」頁，那裡有即時預覽。', '<a class="btn btn-sm" href="#/seo">前往「搜尋結果」</a>')}
    </section>`;


    // ---- 頭像 ----
    const prev = $('#avPrev', root);
    const info = $('#avInfo', root);
    const drawAvatar = () => {
      const a = state.draft.hero.avatar;
      const ok = safeImg(a);
      prev.innerHTML = ok ? `<img src="${esc(ok)}" alt="頭像預覽">` : '<span>沒有頭像</span>';
      info.textContent = !a ? '' : a.startsWith('data:') ? `已上傳的圖片，約 ${fmtBytes(a.length)}。` : ok ? '使用外部圖片網址。' : '網址格式不正確，前台不會顯示。';
    };
    drawAvatar();
    $('#avPick', root).addEventListener('click', () => $('#avFile', root).click());
    $('#avFile', root).addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const data = await toAvatar(f);
        mutate(LABEL, (x) => { x.hero.avatar = data; });
        $('#avUrl', root).value = '';
        drawAvatar();
        toast('頭像已更新（草稿）', 'ok');
      } catch (err) {
        toast(err.message, 'err');
      }
    });
    $('#avClear', root).addEventListener('click', () => {
      mutate(LABEL, (x) => { x.hero.avatar = ''; });
      $('#avUrl', root).value = '';
      drawAvatar();
    });
    $('#avUrl', root).addEventListener('input', (e) => {
      mutate(LABEL, (x) => { x.hero.avatar = e.target.value.trim(); });
      drawAvatar();
    });

    // ---- 其他連結 ----
    const others = $('#others', root);
    const drawOthers = () => {
      const list = state.draft.contact.other;
      others.innerHTML = list.length
        ? list.map((o, i) => `
        <div class="rrow">
          <input data-path="contact.other.${i}.label" value="${esc(o.label)}" placeholder="名稱，例如 LINE" aria-label="連結名稱">
          <input data-path="contact.other.${i}.url" value="${esc(o.url)}" placeholder="https://…" aria-label="連結網址">
          <span class="rbtns">
            <button type="button" class="btn-icon" data-act="up" data-i="${i}" aria-label="上移"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="btn-icon" data-act="down" data-i="${i}" aria-label="下移"${i === list.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" class="btn-icon danger" data-act="del" data-i="${i}" aria-label="刪除">×</button>
          </span>
        </div>`).join('')
        : '<p class="empty-s">還沒有其他連結。</p>';
    };
    drawOthers();
    others.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = +b.dataset.i;
      mutate(LABEL, (x) => {
        const l = x.contact.other;
        if (b.dataset.act === 'up') moveItem(l, i, -1);
        if (b.dataset.act === 'down') moveItem(l, i, 1);
        if (b.dataset.act === 'del') l.splice(i, 1);
      });
      drawOthers();
    });
    $('#addOther', root).addEventListener('click', () => {
      mutate(LABEL, (x) => x.contact.other.push({ label: '', url: '' }));
      drawOthers();
      const last = state.draft.contact.other.length - 1;
      const el = $(`[data-path="contact.other.${last}.label"]`, root);
      if (el) el.focus();
    });

    bindPaths(root, (path, v) => {
      mutate(LABEL, (x) => setPath(x, path, v));
    });
  },
};
