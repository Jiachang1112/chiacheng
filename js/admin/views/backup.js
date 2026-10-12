import { state, replaceDraft, discardDraft, diffSummary } from '../core.js';
import * as cloud from '../cloud.js';
import { $, esc, toast, confirmDialog, openModal, download, fmtBytes, fmtDateTime, ago, blockHead } from '../ui.js';
import { normalize, DEFAULT_DATA, isObj } from '../../data.js';

const LIMIT = 1000 * 1024; // Firestore 單一文件上限約 1 MiB

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const sizeOf = (o) => new Blob([JSON.stringify(o)]).size;

// 讀進來的檔案：支援純 JSON，也支援舊版的「let SITE_DATA = {…};」
function parseFile(text) {
  const t = text.trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('檔案裡找不到資料。請選擇從這個後台匯出的 .json 檔。');
  let obj;
  try {
    obj = JSON.parse(t.slice(a, b + 1));
  } catch (e) {
    throw new Error('檔案格式不正確，無法讀取。請選擇從這個後台匯出的 .json 檔。');
  }
  if (!isObj(obj) || !['hero', 'projects', 'about', 'stack', 'logs'].some((k) => k in obj)) {
    throw new Error('這個檔案看起來不是網站資料（沒有姓名、專案等內容）。');
  }
  return obj;
}

export default {
  title: '備份',
  render(root) {
    root.innerHTML = `
    <section class="block">
      ${blockHead('資料大小', '網站內容整份存在 Firestore 的一份文件裡，上限約 1 MB。頭像和封面圖直接嵌在資料裡，是最占空間的部分。')}
      <div id="meter"></div>
    </section>

    <section class="block">
      ${blockHead('匯出與匯入', '匯出是 .json 檔，可以當備份，也可以拿到另一個環境匯入。匯入只會換掉草稿，要按「發布」才會上線。')}
      <div class="btn-row">
        <button type="button" class="btn" id="exDraft">匯出草稿</button>
        <button type="button" class="btn" id="exPub"${state.published ? '' : ' disabled'}>匯出線上版本</button>
        <button type="button" class="btn" id="imp">匯入檔案…</button>
        <input type="file" id="impFile" accept=".json,application/json,.js,.txt" hidden>
      </div>
    </section>

    <section class="block">
      ${blockHead('發布紀錄', '每次發布都會留下一份，保留最近 20 份。還原只會放進草稿，不會直接改動線上網站。', '<button type="button" class="btn btn-sm" id="hreload">載入紀錄</button>')}
      <div id="hist"><p class="empty-s">按「載入紀錄」查看。</p></div>
    </section>

    <section class="block">
      ${blockHead('重設')}
      <div class="btn-row">
        <button type="button" class="btn" id="discard"${state.published ? '' : ' disabled'}>放棄草稿，回到線上版本</button>
        <button type="button" class="btn btn-danger" id="reset">重設為預設內容</button>
      </div>
      <p class="hint">重設只會換掉草稿。真的不滿意時，也可以從上面的發布紀錄還原。</p>
    </section>`;

    // ---- 大小 ----
    const meter = $('#meter', root);
    const drawMeter = () => {
      const n = sizeOf(normalize(state.draft));
      const pct = Math.min(100, (n / LIMIT) * 100);
      const cls = pct > 90 ? 'bad' : pct > 70 ? 'warn' : '';
      const avatar = state.draft.hero.avatar.startsWith('data:') ? state.draft.hero.avatar.length : 0;
      const covers = state.draft.projects.reduce((s, p) => s + (p.cover.startsWith('data:') ? p.cover.length : 0), 0);
      meter.innerHTML = `
        <div class="meter ${cls}" role="img" aria-label="已使用 ${pct.toFixed(0)}%"><span style="width:${pct}%"></span></div>
        <p><strong>${fmtBytes(n)}</strong> / 約 ${fmtBytes(LIMIT)}（${pct.toFixed(0)}%）</p>
        <p class="hint">頭像 ${fmtBytes(avatar)}、專案封面 ${fmtBytes(covers)}，其餘是文字內容。${pct > 70 ? '快滿了，建議改用外部圖片網址。' : ''}</p>`;
    };
    drawMeter();

    // ---- 匯出 ----
    $('#exDraft', root).addEventListener('click', () => {
      download(`chiacheng-draft-${stamp()}.json`, JSON.stringify(normalize(state.draft), null, 2));
      toast('已匯出草稿', 'ok');
    });
    $('#exPub', root).addEventListener('click', () => {
      download(`chiacheng-published-${stamp()}.json`, JSON.stringify(state.published, null, 2));
      toast('已匯出線上版本', 'ok');
    });

    // ---- 匯入 ----
    $('#imp', root).addEventListener('click', () => $('#impFile', root).click());
    $('#impFile', root).addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      let incoming;
      try {
        if (f.size > 3 * 1024 * 1024) throw new Error('檔案太大（超過 3 MB），不像是網站資料。');
        incoming = normalize(parseFile(await f.text()));
      } catch (err) {
        toast(err.message, 'err');
        return;
      }
      const lines = diffSummary(normalize(state.draft), incoming);
      const body = document.createElement('div');
      body.innerHTML = `
        <p class="modal-text">這個檔案會取代目前的草稿：</p>
        <ul class="difflist">${(lines.length ? lines : ['和目前草稿沒有差別']).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <p class="hint">檔案大小 ${fmtBytes(f.size)}。取代後仍可以按「放棄變更」回到線上版本。</p>`;
      openModal({
        title: '匯入網站資料',
        body,
        size: 'sm',
        footer: [
          { label: '取消' },
          { label: '取代草稿', kind: 'primary', onClick: () => { replaceDraft(incoming, `匯入檔案「${f.name}」`); toast('已匯入（草稿）', 'ok'); } },
        ],
      });
    });

    // ---- 歷史 ----
    const hist = $('#hist', root);
    let items = null;
    const drawHist = () => {
      hist.innerHTML = items.length
        ? `<div class="hlist">${items.map((h, i) => `
          <div class="hrow">
            <span class="hwhen"><strong>${esc(fmtDateTime(h.savedAt))}</strong><small>${esc(ago(h.savedAt))}${i === 0 ? '・最新' : ''}</small></span>
            <span class="hlabel">${esc(h.label || '發布')}<small>${esc(fmtBytes(h.size))}</small></span>
            <span class="hbtns">
              <button type="button" class="btn btn-sm" data-dl="${i}">下載</button>
              <button type="button" class="btn btn-sm" data-restore="${i}">還原到草稿</button>
            </span>
          </div>`).join('')}</div>`
        : '<p class="empty-s">還沒有發布紀錄。下一次發布後就會出現在這裡。</p>';
    };
    const loadHist = async () => {
      const btn = $('#hreload', root);
      btn.disabled = true;
      hist.innerHTML = '<p class="empty-s">載入中…</p>';
      try {
        items = await cloud.listHistory();
        drawHist();
      } catch (err) {
        hist.innerHTML = `<p class="err">${esc(cloud.explain(err))}</p>`;
      } finally {
        btn.disabled = false;
        btn.textContent = '重新載入';
      }
    };
    $('#hreload', root).addEventListener('click', loadHist);
    hist.addEventListener('click', async (e) => {
      const dl = e.target.closest('[data-dl]');
      const rs = e.target.closest('[data-restore]');
      const h = items && items[+(dl ? dl.dataset.dl : rs ? rs.dataset.restore : -1)];
      if (!h) return;
      if (dl) {
        download(`chiacheng-${h.savedAt.slice(0, 10).replace(/-/g, '')}.json`, h.json);
        return;
      }
      let data;
      try {
        data = normalize(JSON.parse(h.json));
      } catch (err) {
        toast('這份紀錄已損毀，無法還原。', 'err');
        return;
      }
      if (!(await confirmDialog({ title: '還原到草稿', message: `把 ${esc(fmtDateTime(h.savedAt))} 的版本放進草稿，目前草稿的內容會被取代。`, confirmLabel: '還原' }))) return;
      replaceDraft(data, `還原 ${fmtDateTime(h.savedAt)} 的版本`);
      toast('已還原到草稿，確認後按「發布」才會上線。', 'ok');
    });

    // ---- 重設 ----
    $('#discard', root).addEventListener('click', async () => {
      if (!state.dirty) return toast('草稿和線上版本一樣，沒有可放棄的變更。');
      if (await confirmDialog({ title: '放棄草稿', message: '草稿裡尚未發布的修改都會消失。', confirmLabel: '放棄草稿', danger: true })) {
        discardDraft();
        toast('已回到線上版本', 'ok');
      }
    });
    $('#reset', root).addEventListener('click', async () => {
      if (await confirmDialog({ title: '重設為預設內容', message: '草稿會換成最初的預設內容（姓名、專案等全部換掉）。不會影響線上網站，要發布才會生效。', confirmLabel: '重設草稿', danger: true })) {
        replaceDraft(DEFAULT_DATA, '重設為預設內容');
        toast('已重設草稿', 'ok');
      }
    });
  },
};
