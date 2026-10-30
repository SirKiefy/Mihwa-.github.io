// fullscreen viewer, grows out from wherever you clicked
export function mountLightbox(el, photos, { caption, onChange } = {}) {
  const ink = el.querySelector('.lb-img--ink');
  const col = el.querySelector('.lb-img--col');
  const cap = el.querySelector('.lb-cap');
  const num = el.querySelector('.lb-num');
  const toggles = [...el.querySelectorAll('.lb-toggle button')];
  const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六'];
  let index = 0, lastFocus = null;

  function view(v) {
    el.dataset.view = v;
    toggles.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  }
  toggles.forEach((b) => b.addEventListener('click', () => view(b.dataset.view)));

  function show(i) {
    index = (i + photos.length) % photos.length;
    const ph = photos[index];
    ink.src = ph.inkUrl;
    col.src = ph.url;
    num.textContent = NUM[index] || String(index + 1);
    cap.textContent = caption ? caption(index) : '';
    onChange && onChange(index);
  }
  function open(i, e, v = 'col') {
    lastFocus = document.activeElement;
    el.style.setProperty('--ox', `${e && e.clientX != null ? e.clientX : innerWidth / 2}px`);
    el.style.setProperty('--oy', `${e && e.clientY != null ? e.clientY : innerHeight / 2}px`);
    view(v);
    show(i);
    el.hidden = false;
    el.classList.remove('is-open');
    void el.offsetWidth;
    el.classList.add('is-open');
    document.documentElement.classList.add('lb-lock');
    el.querySelector('.lb-close').focus({ preventScroll: true });
  }
  function close() {
    el.classList.remove('is-open');
    document.documentElement.classList.remove('lb-lock');
    setTimeout(() => { el.hidden = true; }, 500);
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  el.querySelector('.lb-close').addEventListener('click', close);
  el.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
  el.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('lb-stage')) close(); });
  addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
  let sx = null;
  el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    sx = null;
  });
  return { open, close, refresh: () => { if (!el.hidden) show(index); } };
}
