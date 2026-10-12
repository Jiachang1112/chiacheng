/* 裝置偵測（前台與後台共用）
   以一般 <script> 放在 <head> 載入，頁面畫出來之前就決定好 <html data-device="mobile|desktop">，
   所以不會先閃一下電腦版再跳成手機版。

   判斷方式（auto）：
   - 視窗寬度 ≤ 720px → 手機（含電腦上把視窗縮得很窄）
   - 觸控裝置（粗指標或 UA 標示為 mobile）而且短邊 ≤ 520px → 手機，橫放也算
   - 其餘 → 電腦（平板直放 820px 以上維持電腦版）

   手動切換：網址加 ?view=mobile / desktop / auto，或呼叫 Device.set()；選擇會記在 localStorage。
   在手機上強制看電腦版時，會把 viewport 設成 1100px 寬（和瀏覽器的「電腦版網站」一樣）。
   後台即時預覽（?embed=1）不吃手動設定，單純看 iframe 的寬度。 */
(function () {
  'use strict';
  var KEY = 'chiacheng_view';
  var root = document.documentElement;
  var embed = /[?&]embed=1(&|$)/.test(location.search);
  var vp = document.querySelector('meta[name="viewport"]');
  var listeners = [];
  var mode = 'auto';
  var current = 'desktop';
  var timer = 0;

  function valid(v) { return v === 'mobile' || v === 'desktop' || v === 'auto'; }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) {
    try {
      if (v === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch (e) { /* 無痕模式存不了就只在這次有效 */ }
  }
  function mm(q) { return !!(window.matchMedia && matchMedia(q).matches); }

  function detect() {
    var w = window.innerWidth || root.clientWidth || 0;
    var h = window.innerHeight || root.clientHeight || 0;
    if (!w) return 'desktop';
    if (w <= 720) return 'mobile';
    var ua = navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean'
      ? navigator.userAgentData.mobile
      : /Android.+Mobile|iPhone|iPod|Windows Phone|Mobile.+Firefox/i.test(navigator.userAgent || '');
    if ((mm('(pointer: coarse)') || ua) && Math.min(w, h) <= 520) return 'mobile';
    return 'desktop';
  }

  function viewport(dev) {
    if (!vp || embed) return;
    // 手機硬要看電腦版：和瀏覽器的「電腦版網站」一樣，用 1100px 寬的畫面縮小顯示
    var wide = mode === 'desktop' && dev === 'desktop' && mm('(pointer: coarse)') && Math.min(screen.width, screen.height) <= 600;
    vp.setAttribute('content', wide ? 'width=1100, viewport-fit=cover' : 'width=device-width, initial-scale=1, viewport-fit=cover');
  }

  function apply(announce) {
    var next = mode === 'auto' ? detect() : mode;
    var changed = next !== current;
    current = next;
    root.setAttribute('data-device', next);
    if (mode === 'auto') root.removeAttribute('data-forced');
    else root.setAttribute('data-forced', mode);
    viewport(next);
    if (announce && (changed || announce === 'force')) {
      listeners.slice().forEach(function (fn) { try { fn(current, mode); } catch (e) { /* 其中一個監聽出錯不該影響別人 */ } });
      try { window.dispatchEvent(new CustomEvent('devicechange', { detail: { device: current, mode: mode } })); } catch (e) { /* 舊瀏覽器 */ }
    }
  }

  function later() {
    clearTimeout(timer);
    timer = setTimeout(function () { if (mode === 'auto') apply(true); }, 120);
  }

  // ---- 初始設定 ----
  if (!embed) {
    var m = /[?&]view=(mobile|desktop|auto)(&|$)/.exec(location.search);
    if (m) write(m[1]);
    var saved = read();
    if (valid(saved)) mode = saved;
  }
  apply(false);
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);

  window.Device = {
    current: function () { return current; },
    mode: function () { return mode; },
    isMobile: function () { return current === 'mobile'; },
    set: function (v) {
      if (!valid(v) || embed) return;
      mode = v;
      write(v);
      apply('force');
    },
    onChange: function (fn) { listeners.push(fn); },
  };
})();
