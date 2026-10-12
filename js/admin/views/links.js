import { state, mutate } from '../core.js';
import * as cloud from '../cloud.js';
import { $, esc, bindPaths, setPath, toast, moveItem, blockHead, confirmDialog } from '../ui.js';
import { uid, safeUrl } from '../../data.js';

const LABEL = { key: 'links', label: '修改常用連結' };

export default {
  title: '連結',
  render(root) {
    root.innerHTML = `
    <section class="block">
      ${blockHead('常用連結', '想讓訪客一眼找到的外部連結，例如作品集、粉絲專頁、預約表單。首頁會多一個「連結」區塊；沒有任何連結時不會顯示。', '<button type="button" class="btn btn-sm" id="addLink">新增連結</button>')}
      <div class="rlist wide" id="llist"></div>
    </section>
    <section class="block">
      ${blockHead('匯入舊版後台的連結', '以前的 admin.html 會把連結寫進 links 集合，但首頁從來沒有顯示過。可以在這裡一次匯入到草稿，已經有的網址不會重複。')}
      <div class="btn-row"><button type="button" class="btn btn-sm" id="importLegacy">匯入舊連結</button></div>
    </section>`;
    const list = $('#llist', root);
    const draw = () => {
      const items = state.draft.links;
      list.innerHTML = items.length
        ? items.map((l, i) => `
        <div class="rrow three">
          <input data-path="links.${i}.title" value="${esc(l.title)}" placeholder="標題" aria-label="標題" maxlength="60">
          <input data-path="links.${i}.url" value="${esc(l.url)}" placeholder="https://…" aria-label="網址">
          <input data-path="links.${i}.note" value="${esc(l.note)}" placeholder="一句說明（選填）" aria-label="說明" maxlength="100">
          <span class="rbtns">
            <button type="button" class="btn-icon" data-act="up" data-i="${i}" aria-label="上移"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="btn-icon" data-act="down" data-i="${i}" aria-label="下移"${i === items.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" class="btn-icon danger" data-act="del" data-i="${i}" aria-label="刪除">×</button>
          </span>
          ${l.url && !safeUrl(l.url) ? '<p class="err full">網址格式不正確，前台不會顯示這個連結。</p>' : ''}
        </div>`).join('')
        : '<p class="empty-s">還沒有連結。</p>';
    };
    draw();

    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = +b.dataset.i;
      mutate(LABEL, (d) => {
        if (b.dataset.act === 'up') moveItem(d.links, i, -1);
        if (b.dataset.act === 'down') moveItem(d.links, i, 1);
        if (b.dataset.act === 'del') d.links.splice(i, 1);
      });
      draw();
    });
    // 網址欄位離開時才重畫，才能顯示格式錯誤，又不會打字打到一半失去游標
    list.addEventListener('focusout', (e) => {
      if (e.target.matches('[data-path$=".url"]')) draw();
    });
    bindPaths(list, (path, v) => mutate(LABEL, (d) => setPath(d, path, v)));

    $('#addLink', root).addEventListener('click', () => {
      mutate(LABEL, (d) => d.links.push({ id: uid(), title: '', url: '', note: '' }));
      draw();
      const last = state.draft.links.length - 1;
      const el = $(`[data-path="links.${last}.title"]`, list);
      if (el) el.focus();
    });

    $('#importLegacy', root).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const old = await cloud.fetchLegacyLinks();
        const have = new Set(state.draft.links.map((l) => safeUrl(l.url)));
        const add = old.filter((l) => !have.has(safeUrl(l.url)));
        if (!old.length) toast('舊的 links 集合裡沒有資料。');
        else if (!add.length) toast('舊連結都已經在清單裡了。');
        else {
          mutate({ key: 'links', label: `匯入舊版連結（${add.length} 個）` }, (d) => add.forEach((l) => d.links.push({ id: uid(), title: l.title, url: l.url, note: '' })));
          draw();
          toast(`已匯入 ${add.length} 個連結（草稿）`, 'ok');
        }
      } catch (err) {
        toast(cloud.explain(err), 'err');
      } finally {
        btn.disabled = false;
      }
    });
  },
};
