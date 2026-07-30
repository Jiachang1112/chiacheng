/* ==========================================================================
   chiacheng1112.com — 深夜手記 Late Notes
   一個關於「深夜書桌」的個人部落格視覺系統
   ========================================================================== */

:root {
  /* 色彩系統 */
  --paper: #12161B;       /* 主背景：深藍黑，像關了大燈只留桌燈的房間 */
  --paper-raised: #171D24;/* 卡片／面板背景，比主背景稍亮 */
  --paper-line: #232A33;  /* 分隔線、邊框 */
  --ink: #EDEAE0;         /* 主要文字：暖白 */
  --ink-dim: #8D96A1;     /* 次要文字：冷灰藍 */
  --lamp: #E8A33D;        /* 主色：桌燈琥珀光 */
  --lamp-soft: rgba(232, 163, 61, 0.14);
  --teal: #4F7A9C;        /* 輔色：夜藍青，用於連結標籤 */
  --teal-soft: rgba(79, 122, 156, 0.16);

  --serif: "Fraunces", Georgia, "Noto Serif TC", serif;
  --sans: "Inter", "Noto Sans TC", -apple-system, sans-serif;
  --mono: "IBM Plex Mono", "Noto Sans Mono TC", monospace;

  --max-w: 960px;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

::selection { background: var(--lamp-soft); color: var(--lamp); }

:focus-visible {
  outline: 2px solid var(--lamp);
  outline-offset: 3px;
  border-radius: 2px;
}

img { max-width: 100%; display: block; }

.wrap {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 28px;
}

.eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lamp);
}

/* ---------- Nav ---------- */

.site-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(18, 22, 27, 0.82);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--paper-line);
}

.site-nav .wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.brand {
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.brand strong { font-family: var(--serif); font-size: 18px; font-weight: 600; }
.brand span { color: var(--lamp); }

.nav-links { display: flex; gap: 28px; font-size: 14px; color: var(--ink-dim); }
.nav-links a { position: relative; padding: 4px 0; transition: color .2s; }
.nav-links a:hover { color: var(--ink); }
.nav-links a::after {
  content: "";
  position: absolute; left: 0; bottom: -2px;
  width: 0; height: 1px; background: var(--lamp);
  transition: width .25s ease;
}
.nav-links a:hover::after { width: 100%; }

/* ---------- Hero ---------- */

.hero {
  position: relative;
  overflow: hidden;
  padding: 120px 0 96px;
  isolation: isolate;
}

.hero-glow {
  position: absolute;
  inset: -20% -10% auto -10%;
  height: 620px;
  background: radial-gradient(circle at var(--gx, 50%) var(--gy, 20%),
              var(--lamp-soft) 0%, transparent 60%);
  z-index: -1;
  transition: background-position .3s ease;
  pointer-events: none;
}

.hero .eyebrow { margin-bottom: 18px; }

.hero h1 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: clamp(40px, 7vw, 68px);
  line-height: 1.08;
  margin: 0 0 22px;
  letter-spacing: -0.01em;
}

.hero h1 em {
  font-style: normal;
  color: var(--lamp);
}

.hero p.lede {
  font-size: 18px;
  color: var(--ink-dim);
  max-width: 480px;
  margin: 0 0 36px;
}

.hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease;
}
.btn:hover { transform: translateY(-2px); }

.btn-primary { background: var(--lamp); color: #1B1305; }
.btn-primary:hover { background: #f2b458; }

.btn-ghost { border-color: var(--paper-line); color: var(--ink); }
.btn-ghost:hover { border-color: var(--lamp); color: var(--lamp); }

/* ---------- Section headers ---------- */

.section { padding: 88px 0; border-top: 1px solid var(--paper-line); }
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 44px;
  gap: 20px;
  flex-wrap: wrap;
}
.section-head h2 {
  font-family: var(--serif);
  font-size: 30px;
  font-weight: 600;
  margin: 8px 0 0;
}
.section-head .count { font-family: var(--mono); font-size: 13px; color: var(--ink-dim); }

/* ---------- Entries (blog list) ---------- */

.entry {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: 24px;
  align-items: start;
  padding: 28px 0;
  border-top: 1px solid var(--paper-line);
  transition: background .2s ease;
}
.entry:first-of-type { border-top: 1px solid var(--paper-line); }

.entry-meta {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-dim);
  padding-top: 6px;
}
.entry-meta .no { color: var(--lamp); display: block; margin-bottom: 4px; }

.entry-body h3 {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 10px;
}
.entry-body h3 a { transition: color .2s; }
.entry-body h3 a:hover { color: var(--lamp); }

.entry-body p {
  margin: 0;
  color: var(--ink-dim);
  font-size: 15px;
  max-width: 60ch;
}

.entry-tags { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.tag {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--teal);
  background: var(--teal-soft);
  padding: 3px 8px;
  border-radius: 2px;
}

.entry-arrow {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink-dim);
  padding-top: 8px;
  white-space: nowrap;
  transition: color .2s, transform .2s;
}
.entry:hover .entry-arrow { color: var(--lamp); transform: translateX(3px); }

@media (max-width: 640px) {
  .entry { grid-template-columns: 1fr; gap: 8px; }
  .entry-arrow { display: none; }
}

/* ---------- About ---------- */

.about-grid {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 40px;
  align-items: start;
}

.monogram {
  width: 120px;
  height: 120px;
  border-radius: 4px;
  background: var(--paper-raised);
  border: 1px solid var(--paper-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-size: 40px;
  color: var(--lamp);
  position: relative;
}
.monogram::after {
  content: "";
  position: absolute;
  inset: 8px;
  border: 1px solid var(--paper-line);
  border-radius: 2px;
}

.about-text p { color: var(--ink-dim); max-width: 62ch; margin: 0 0 16px; }
.about-text strong { color: var(--ink); font-weight: 600; }

.facts {
  list-style: none;
  padding: 0;
  margin: 24px 0 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px 28px;
  font-size: 14px;
}
.facts li { border-top: 1px solid var(--paper-line); padding-top: 10px; }
.facts b { display: block; font-family: var(--mono); font-size: 11px; color: var(--lamp); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }

@media (max-width: 640px) {
  .about-grid { grid-template-columns: 1fr; }
  .monogram { width: 88px; height: 88px; font-size: 30px; }
}

/* ---------- Links (跳轉連結區) ---------- */

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.link-tag {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--paper-raised);
  border: 1px solid var(--paper-line);
  border-radius: 4px;
  position: relative;
  transition: border-color .2s ease, transform .2s ease;
}
.link-tag:hover { border-color: var(--lamp); transform: translateY(-2px); }

.link-tag .icon {
  width: 34px; height: 34px;
  border-radius: 3px;
  background: var(--lamp-soft);
  color: var(--lamp);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 13px;
  flex-shrink: 0;
}

.link-tag .label { font-size: 14px; font-weight: 600; color: var(--ink); }
.link-tag .sub { font-size: 12px; color: var(--ink-dim); font-family: var(--mono); }

.link-tag::after {
  content: "↗";
  position: absolute;
  top: 14px; right: 14px;
  color: var(--ink-dim);
  font-size: 13px;
  transition: color .2s;
}
.link-tag:hover::after { color: var(--lamp); }

/* ---------- Footer ---------- */

footer {
  border-top: 1px solid var(--paper-line);
  padding: 40px 0;
}
footer .wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-dim);
}
footer a:hover { color: var(--lamp); }
