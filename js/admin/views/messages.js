import { state, emit } from '../core.js';
import * as cloud from '../cloud.js';
import { $, esc, toast, confirmDialog, fmtDateTime, ago, blockHead } from '../ui.js';

const ui = { filter: 'all', items: null, error: '', loading: false, open: null };

function syncUnread() {
  state.unread = (ui.items || []).filter((m) => !m.read).length;
  emit('unread');
}

export async function refreshUnread() {
  try {
    ui.items = await cloud.listMessages();
    ui.error = '';
  } catch (e) {
    ui.error = cloud.explain(e);
    return;
  }
  syncUnread();
}

export default {
  title: '訊息',
  render(root) {
    root.innerHTML = '<div id="mbox"></div>';
    const box = $('#mbox', root);

    const draw = () => {
      if (ui.loading) {
        box.innerHTML = '<p class="empty-s">載入中…</p>';
        return;
      }
      const enabled = state.draft.settings.contactForm.enabled;
      const head = blockHead('訪客留言', enabled ? '' : '聯絡表單目前是關閉的。到「外觀」開啟後，首頁才會出現表單。', '<button type="button" class="btn btn-sm" id="mreload">重新整理</button>');
      if (ui.error) {
        box.innerHTML = `<section class="block">${head}<p class="err">${esc(ui.error)}</p></section>`;
        return;
      }
      const all = ui.items || [];
      const list = ui.filter === 'unread' ? all.filter((m) => !m.read) : all;
      const unread = all.filter((m) => !m.read).length;
      box.innerHTML = `
      <section class="block">
        ${head}
        <div class="toolbar">
          <div class="seg" role="group" aria-label="篩選">
            <button type="button" class="${ui.filter === 'all' ? 'on' : ''}" data-f="all" aria-pressed="${ui.filter === 'all'}">全部 ${all.length}</button>
            <button type="button" class="${ui.filter === 'unread' ? 'on' : ''}" data-f="unread" aria-pressed="${ui.filter === 'unread'}">未讀 ${unread}</button>
          </div>
        </div>
        ${list.length ? list.map((m) => {
          const open = ui.open === m.id;
          return `
          <article class="msg${m.read ? '' : ' unread'}${open ? ' open' : ''}" data-id="${esc(m.id)}">
            <button type="button" class="msg-head" data-act="toggle" aria-expanded="${open}">
              <span class="msg-who">${esc(m.name || '（未留名）')}</span>
              <span class="msg-prev">${esc(m.message.replace(/\s+/g, ' ').slice(0, 80))}</span>
              <span class="msg-when" title="${esc(fmtDateTime(m.createdAt))}">${esc(ago(m.createdAt))}</span>
            </button>
            ${open ? `
            <div class="msg-body">
              <p class="msg-text">${esc(m.message)}</p>
              <p class="hint">${esc(m.name)} · ${esc(m.email)} · ${esc(fmtDateTime(m.createdAt))}</p>
              <div class="btn-row">
                <a class="btn btn-sm btn-primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('回覆你在網站上的留言')}">用 Email 回覆</a>
                <button type="button" class="btn btn-sm" data-act="read">${m.read ? '標為未讀' : '標為已讀'}</button>
                <button type="button" class="btn btn-sm btn-danger" data-act="del">刪除</button>
              </div>
            </div>` : ''}
          </article>`;
        }).join('') : `<p class="empty-s">${all.length ? '沒有未讀的留言。' : '還沒有收到留言。'}</p>`}
      </section>`;
    };

    const load = async () => {
      ui.loading = true;
      draw();
      await refreshUnread();
      ui.loading = false;
      draw();
    };

    box.addEventListener('click', async (e) => {
      if (e.target.closest('#mreload')) return load();
      const f = e.target.closest('[data-f]');
      if (f) {
        ui.filter = f.dataset.f;
        return draw();
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.closest('.msg').dataset.id;
      const m = ui.items.find((x) => x.id === id);
      if (!m) return;
      try {
        if (b.dataset.act === 'toggle') {
          ui.open = ui.open === id ? null : id;
          if (ui.open && !m.read) {
            m.read = true;
            syncUnread();
            cloud.setMessageRead(id, true).catch(() => { m.read = false; syncUnread(); });
          }
          draw();
        } else if (b.dataset.act === 'read') {
          await cloud.setMessageRead(id, !m.read);
          m.read = !m.read;
          syncUnread();
          draw();
        } else if (b.dataset.act === 'del') {
          if (!(await confirmDialog({ title: '刪除留言', message: `確定要刪除 ${esc(m.name || '這則')} 的留言嗎？刪除後無法復原。`, confirmLabel: '刪除', danger: true }))) return;
          await cloud.deleteMessage(id);
          ui.items = ui.items.filter((x) => x.id !== id);
          if (ui.open === id) ui.open = null;
          syncUnread();
          draw();
          toast('已刪除留言', 'ok');
        }
      } catch (err) {
        toast(cloud.explain(err), 'err');
      }
    });

    if (ui.items) draw();
    load();
  },
};
