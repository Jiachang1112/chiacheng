// 桌燈光暈跟隨滑鼠微微移動（尊重 reduced motion）
(function () {
  const glow = document.querySelector(".hero-glow");
  if (!glow) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const hero = document.querySelector(".hero");
  hero.addEventListener("pointermove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    glow.style.setProperty("--gx", x + "%");
    glow.style.setProperty("--gy", y + "%");
  });
})();

// 目前年份
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
