import { state, mutate, rerender } from '../core.js';
import { $, $$, esc, bindPaths, setPath, toast, chipInput, confirmDialog, moveItem, blockHead } from '../ui.js';
import { uid, allTech } from '../../data.js';

const LABEL = { key: 'stack', label: '調整技術清單' };

// 專案用到、但還沒列在任何技術分類裡的項目
function missingTech() {
  const have = new Set();
  state.draft.stack.forEach((g) => g.items.forEach((i) => have.add(i.toLowerCase())));
  return allTech(state.draft).filter((t) => !have.has(t.name.toLowerCase()));
}

// 列在技術清單、但沒有任何專案用到的項目
function unusedTech() {
  const used = new Set(allTech(state.draft).map((t) => t.name.toLowerCase()));
  const out = [];
  state.draft.stack.forEach((g) => g.items.forEach((i) => { if (!used.has(i.toLowerCase())) out.push(i); }));
  return out;
}

export default {
  title: '技術',
  render(root) {
    root.innerHTML = `
    <section class="block" id="suggest"></section>
    <section class="block">
      ${blockHead('技術分類', '首頁的「技術」區塊會照這裡的分類和順序顯示，每個分類裡的項目用頓號連在一起。', '<button type="button" class="btn btn-sm" id="addGroup">新增分類</button>')}
      <div id="groups"></div>
    </section>`;

    const suggest = $('#suggest', root);
    const groupsEl = $('#groups', root);

    const drawSuggest = () => {
      const miss = missingTech();
      const unused = unusedTech();
      const groups = state.draft.stack;
      let html = blockHead('從專案整理', '專案裡填的技術標籤，和這份清單是分開的。這裡幫你找出還沒歸類的。');
      if (!miss.length) {
        html += '<p class="ok-s">專案用到的技術，都已經列在下面的清單裡了。</p>';
      } else {
        html += `
        <p>有 <strong>${miss.length}</strong> 項技術出現在專案裡，但還沒列進清單：</p>
        <div class="tagline-list">${miss.map((t) => `<span class="chip ro">${esc(t.name)}<small>${t.n}</small></span>`).join('')}</div>
        <div class="inline-form">
          <label for="sgTarget">全部加入到</label>
          <select id="sgTarget">
            ${groups.map((g, i) => `<option value="${i}">${esc(g.title || '未命名分類')}</option>`).join('')}
            <option value="new">新分類「其他」</option>
          </select>
          <button type="button" class="btn btn-sm btn-primary" id="sgApply">加入</button>
        </div>`;
      }
      if (unused.length) html += `<p class="hint">清單裡有 ${unused.length} 項目前沒有任何專案用到：${unused.map(esc).join('、')}。不影響顯示，只是提醒。</p>`;
      suggest.innerHTML = html;
    };

    const drawGroups = () => {
      const list = state.draft.stack;
      if (!list.length) {
        groupsEl.innerHTML = '<p class="empty-s">還沒有技術分類，首頁不會顯示「技術」區塊。</p>';
        return;
      }
      groupsEl.innerHTML = list.map((g, i) => `
      <div class="gcard" data-i="${i}">
        <div class="gcard-head">
          <input data-path="stack.${i}.title" value="${esc(g.title)}" placeholder="分類名稱" aria-label="分類名稱" maxlength="40">
          <span class="rbtns">
            <button type="button" class="btn-icon" data-act="up" aria-label="上移"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="btn-icon" data-act="down" aria-label="下移"${i === list.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" class="btn-icon danger" data-act="del" aria-label="刪除分類">×</button>
          </span>
        </div>
        <div data-chips="${i}"></div>
      </div>`).join('');
      $$('[data-chips]', groupsEl).forEach((host) => {
        const i = +host.dataset.chips;
        chipInput(host, {
          values: list[i].items,
          suggestions: allTech(state.draft).map((t) => t.name),
          placeholder: '輸入技術名稱，按 Enter 加入',
          onChange: (vals) => {
            mutate(LABEL, (d) => { d.stack[i].items = vals; });
            drawSuggest();
          },
        });
      });
    };

    drawSuggest();
    drawGroups();

    suggest.addEventListener('click', (e) => {
      if (e.target.id !== 'sgApply') return;
      const miss = missingTech();
      const t = $('#sgTarget', suggest).value;
      mutate(LABEL, (d) => {
        if (t === 'new') d.stack.push({ id: uid(), title: '其他', items: miss.map((m) => m.name) });
        else d.stack[+t].items.push(...miss.map((m) => m.name));
      });
      toast(`已加入 ${miss.length} 項技術（草稿）`, 'ok');
      drawSuggest();
      drawGroups();
    });

    $('#addGroup', root).addEventListener('click', () => {
      mutate(LABEL, (d) => d.stack.push({ id: uid(), title: '新分類', items: [] }));
      drawSuggest();
      drawGroups();
      const inputs = $$('.gcard-head input', groupsEl);
      const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
    });

    groupsEl.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = +b.closest('.gcard').dataset.i;
      const act = b.dataset.act;
      if (act === 'del') {
        const g = state.draft.stack[i];
        const ok = !g.items.length || (await confirmDialog({ title: '刪除分類', message: `確定要刪除「${esc(g.title)}」和裡面的 ${g.items.length} 個項目嗎？`, confirmLabel: '刪除', danger: true }));
        if (!ok) return;
        mutate(LABEL, (d) => d.stack.splice(i, 1));
      } else {
        mutate(LABEL, (d) => moveItem(d.stack, i, act === 'up' ? -1 : 1));
      }
      drawSuggest();
      drawGroups();
    });

    bindPaths(groupsEl, (path, v) => mutate(LABEL, (d) => setPath(d, path, v)));
  },
};
