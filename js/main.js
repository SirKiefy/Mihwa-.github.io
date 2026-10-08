// ─────────────────────────────────────────────────────────────────────────────
//  Mihwa · 미화 — an album in ink.
//  Every photo is repainted as an ink painting, and each part of the page
//  (her words, her memories, her path, her colours, her other side, and why
//  she is loved) sits on one sheet of hanji where the ink spreads in as you
//  arrive.
// ─────────────────────────────────────────────────────────────────────────────
import { LANGS, STRINGS } from './i18n.js?v=84ce73c042';
import { HER, PHOTOS, LETTER, THOUGHTS, MEMORIES, PATH, REASONS } from './her.js?v=84ce73c042';
import { loadPhotos } from './fx/placeholder.js?v=84ce73c042';
import { inkify } from './fx/inkify.js?v=84ce73c042';
import { extractPalette } from './fx/palette.js?v=84ce73c042';
import { mountLightbox } from './fx/lightbox.js?v=84ce73c042';
import { makeGrainDataURL } from './scene/inktex.js?v=84ce73c042';
import { setSound, pluck, phrase, shot, ping, glass, purr, meow } from './audio.js?v=84ce73c042';
import { skyAt, moonPhase, moonIndex, MOON_NAMES, fetchWeather, WEATHER_NAMES } from './fx/live.js?v=84ce73c042';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const root = document.documentElement;
const IG_URL = `https://www.instagram.com/${HER.instagram}/`;
const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
/** an anchor for the ink field: <i class="ink" data-ink="…"> */
function ink(type, style, data = {}) {
  const e = document.createElement('i');
  e.className = 'ink';
  e.dataset.ink = type;
  Object.entries(data).forEach(([k, v]) => { e.dataset[k] = String(v); });
  Object.assign(e.style, style);
  return e;
}

root.style.setProperty('--grain', `url(${makeGrainDataURL()})`);

// the living parts of the page, filled in by boot()
let field = null, hero = null, screen = null, homes = null, lightbox = null, photos = [];
let scope = null, wanted = null, love = null, cat = null;

// ─────────────────────────── language ───────────────────────────
function guessLang() {
  const saved = store.get('mihwa-lang');
  if (LANGS.includes(saved)) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : 'en';
}
let lang = guessLang();
const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k;
const locale = () => ({ en: 'en-GB', fr: 'fr-FR', ko: 'ko-KR' }[lang]);
const onLang = [];

function applyLang() {
  root.lang = lang;
  $$('[data-i18n]').forEach((e) => {
    const k = e.dataset.i18n;
    if (k === 'letter.sign') e.textContent = LETTER[lang].sign;
    else if (k === 'hero.hint' && !finePointer) e.textContent = t('hero.hint.touch');
    else e.textContent = t(k);
  });
  $$('[data-i18n-label]').forEach((e) => e.setAttribute('aria-label', t(e.dataset.i18nLabel)));
  $$('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); e.setAttribute('aria-label', t(e.dataset.i18nTitle)); });
  const body = $('[data-i18n-html="letter.body"]');
  // the letter is written in English for every language; keep its own typography
  const letterLang = JSON.stringify(LETTER[lang]) === JSON.stringify(LETTER.en) ? 'en' : lang;
  body.lang = letterLang;
  $('[data-i18n="letter.sign"]').lang = letterLang;
  body.innerHTML = '';
  LETTER[lang].body.forEach((para) => body.appendChild(el('p', null, para)));
  if (LETTER[lang].ps) {
    const ps = el('p', 'letter-ps', LETTER[lang].ps);
    ps.lang = 'ko';
    body.appendChild(ps);
  }
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  onLang.forEach((fn) => fn(lang));
  requestAnimationFrame(layoutAll);
}
$$('.lang button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  store.set('mihwa-lang', lang);
  applyLang();
  pluck(LANGS.indexOf(lang) * 2 + 3, { gain: 0.14 });
}));

// ─────────────────────────── sound ───────────────────────────
const soundBtn = $('.sound');
soundBtn.addEventListener('click', () => {
  const on = soundBtn.getAttribute('aria-pressed') !== 'true';
  soundBtn.setAttribute('aria-pressed', String(on));
  setSound(on);
  if (on) phrase(2);
});

// ─────────────────────────── static bits ───────────────────────────
$('#hero-ig').href = IG_URL;
$('#hero-ig').textContent = `@${HER.instagram}`;
$('#ig-follow').href = IG_URL;
$('#ig-avatar').href = IG_URL;
$('#ig-handle').textContent = `@${HER.instagram}`;

// ─────────────────────────── cursor ───────────────────────────
if (finePointer) {
  const cursor = $('.cursor'), cDot = $('.cursor-dot'), cRing = $('.cursor-ring');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  document.body.classList.add('has-cursor');
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; cDot.style.transform = `translate3d(${mx}px, ${my}px, 0)`; }, { passive: true });
  const loop = () => { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2; cRing.style.transform = `translate3d(${rx}px, ${ry}px, 0)`; requestAnimationFrame(loop); };
  loop();
  document.addEventListener('pointerover', (e) => cursor.classList.toggle('is-hover', !!e.target.closest('a, button, input, .fan, .ig-tile, #screen-gl, #globe-gl')));
}

// ─────────────────────────── two homes: live clocks, sun and weather ───────────────────────────
function haversine(a, b) {
  const R = 6371, r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const SEOUL = { id: 'seoul', tz: 'Asia/Seoul', lat: 37.5665, lon: 126.978, home: true, name: { en: 'Seoul', fr: 'Séoul', ko: '서울' } };
const PARIS = { id: 'paris', tz: 'Europe/Paris', lat: 48.8566, lon: 2.3522, home: true, name: { en: 'Paris', fr: 'Paris', ko: '파리' } };
const HOMES = [SEOUL, PARIS];
function tzOffset(tz, d) { return Math.round((new Date(d.toLocaleString('en-US', { timeZone: tz })) - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }))) / 36e5); }
function fmtDur(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? t('dur.hm').replace('{h}', h).replace('{m}', String(m).padStart(2, '0')) : t('dur.m').replace('{m}', m);
}
let timeOffset = 0, weather = null;
const cityEls = HOMES.map((p) => {
  const card = $(`#city-${p.id}`);
  return { p, card, hm: $('.hm', card), sec: $('.sec', card), date: $('.city-date', card), sky: $('.sky-text', card), wx: $('.city-wx', card) };
});
function tickClocks() {
  const now = new Date(Date.now() + timeOffset);
  cityEls.forEach(({ p, card, hm, sec, date, sky }) => {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: p.tz }).formatToParts(now);
    const get = (type) => parts.find((x) => x.type === type)?.value ?? '';
    hm.textContent = `${get('hour')}:${get('minute')}`;
    sec.textContent = `:${get('second')}`;
    date.textContent = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: p.tz }).format(now);
    const s = skyAt(p.lat, p.lon, now);
    card.dataset.sky = s.state;
    sky.textContent = s.next ? t(s.next === 'set' ? 'homes.set' : 'homes.rise').replace('{t}', fmtDur(s.in)) : '';
  });
  const diff = Math.abs(tzOffset(SEOUL.tz, now) - tzOffset(PARIS.tz, now));
  const dist = (Math.round(haversine(SEOUL, PARIS) / 10) * 10).toLocaleString(locale());
  const moonName = MOON_NAMES[lang][moonIndex(moonPhase(now))];
  const moon = lang === 'ko' ? moonName : moonName.toLocaleLowerCase(locale());
  $('#homes-facts').textContent = `${t('homes.facts').replace('{d}', dist).replace('{h}', diff)} · ${t('homes.moon').replace('{m}', moon)}`;
}
function showWeather() {
  cityEls.forEach(({ wx }, i) => {
    const w = weather && weather[i];
    wx.hidden = !w || w.temp == null;
    if (!wx.hidden) wx.textContent = `${Math.round(w.temp)}°C · ${WEATHER_NAMES[lang][w.kind]}`;
  });
}
onLang.push(tickClocks, showWeather);
setInterval(tickClocks, 1000);

// move through the day: the sun sweeps across the globe and both clocks follow
const scrub = $('#scrub'), scrubOut = $('#scrub-out'), scrubNow = $('#scrub-now');
function setOffset(mins) {
  timeOffset = mins * 60000;
  if (homes) homes.setTimeOffset(timeOffset);
  scrubNow.hidden = mins === 0;
  scrubOut.textContent = mins === 0 ? t('homes.now') : `${mins > 0 ? '+' : '−'}${fmtDur(Math.abs(mins) * 60000)}`;
  tickClocks();
}
scrub.addEventListener('input', () => setOffset(Number(scrub.value)));
scrubNow.addEventListener('click', () => {
  const from = Number(scrub.value), t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 700);
    const v = Math.round(from * (1 - (1 - (1 - k) ** 3)) / 10) * 10;
    scrub.value = String(v);
    setOffset(k < 1 ? v : 0);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});
onLang.push(() => setOffset(Number(scrub.value)));

// ─────────────────────────── about her & bio ───────────────────────────
onLang.push(() => {
  const dl = $('#notes');
  dl.innerHTML = '';
  HER.notes.forEach((n) => {
    const row = el('div');
    row.append(el('dt', null, n.k[lang]), el('dd', null, n.v[lang]));
    dl.appendChild(row);
  });
  const bio = $('#ig-bio');
  bio.innerHTML = '';
  (HER.bio[lang] || []).forEach((line) => bio.appendChild(el('li', null, line)));
});

// ─────────────────────────── her words ───────────────────────────
const quotesEl = $('#quotes');
const quoteEls = THOUGHTS.map((q, i) => {
  const fig = el('figure', 'quote');
  fig.append(
    ink('bloom', { left: '-4%', top: '0', width: '100%', height: '100%' }, { seed: (2.7 + i * 3.3).toFixed(2), dark: i % 2 ? 0.16 : 0.2, delay: 0.15 }),
    el('span', 'q-mark', '“'),
  );
  const bq = el('blockquote');
  const seal = el('span', 'seal seal--md', q.seal || '言');
  seal.setAttribute('aria-hidden', 'true');
  fig.append(bq, seal);
  quotesEl.appendChild(fig);
  return { q, bq };
});
onLang.push(() => quoteEls.forEach(({ q, bq }) => { bq.textContent = q[lang] ?? q.en; }));

// ─────────────────────────── her path ───────────────────────────
const pathEl = $('#path-list');
const stationEls = PATH.map((s, i) => {
  const st = el('article', 'station');
  const seal = el('span', 'seal', s.seal);
  seal.setAttribute('aria-hidden', 'true');
  const when = el('p', 'station-when');
  const h = el('h3');
  const p = el('p');
  st.append(seal, when, h, p);
  pathEl.appendChild(st);
  return { s, st, seal, when, h, p, i };
});
onLang.push(() => stationEls.forEach(({ s, when, h, p }) => {
  when.textContent = s.when[lang];
  h.textContent = s.title[lang];
  p.textContent = s.text[lang];
}));
// the brush path is re-drawn to fit wherever the stations end up
const pathInk = el('div', 'path-ink');
pathInk.setAttribute('aria-hidden', 'true');
pathEl.prepend(pathInk);
let pathKey = '';
function layoutPath() {
  const box = pathEl.getBoundingClientRect();
  const pts = stationEls.map(({ seal }) => {
    const r = seal.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  });
  const key = pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join('|');
  if (key === pathKey) return false;
  pathKey = key;
  pathInk.innerHTML = '';
  stationEls.forEach(({ st }, i) => {
    const r = st.getBoundingClientRect();
    pathInk.appendChild(ink('bloom', {
      left: `${r.left - box.left - 30}px`, top: `${r.top - box.top - 40}px`, width: `${r.width + 60}px`, height: `${r.height + 80}px`,
    }, { seed: (1.3 + i * 2.9).toFixed(2), dark: mobile ? 0.12 : 0.17, delay: 0.1 }));
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const down = b.x >= a.x;
    pathInk.appendChild(ink('line', {
      left: `${Math.min(a.x, b.x)}px`, top: `${a.y}px`, width: `${Math.max(1, Math.abs(b.x - a.x))}px`, height: `${b.y - a.y}px`,
    }, { dir: down ? 'down' : 'back', px: mobile ? 9 : 13, bow: (i % 2 ? -0.8 : 0.8) * (Math.abs(b.x - a.x) < 20 ? 0.3 : 1), dark: 0.9, dry: 1, seed: (3.1 + i * 1.7).toFixed(2), dur: 1.3, delay: 0.3 }));
  }
  const last = stationEls[stationEls.length - 1].st.getBoundingClientRect();
  pathInk.appendChild(ink('range', {
    left: '-8%', top: `${last.bottom - box.top + 10}px`, width: '116%', height: '200px',
  }, { seed: 9.4, dark: 0.34, h: 0.7 }));
  return true;
}

// ─────────────────────────── memories: the handscroll ───────────────────────────
const memSec = $('#memories');
const memTrack = $('#mem-track');
const memWindow = $('.scroll-window');
memSec.style.height = `${MEMORIES.length * 75 + 110}vh`;
const memEls = MEMORIES.map((m, i) => {
  const card = el('article', 'memory');
  const fan = el('button', 'fan');
  fan.type = 'button';
  const imInk = el('img', 'inked'); imInk.alt = '';
  const imCol = el('img', 'col'); imCol.alt = '';
  fan.append(imInk, imCol);
  fan.insertAdjacentHTML('beforeend', '<svg class="fan-edge" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path d="M0.02 0.36 A0.66 0.66 0 0 1 0.98 0.36 L0.73 0.98 A0.3 0.3 0 0 0 0.27 0.98 Z"/></svg>');
  const when = el('p', 'memory-when');
  const h = el('h3');
  const p = el('p');
  card.append(fan, when, h, p);
  memTrack.appendChild(card);
  return { m, card, fan, imInk, imCol, when, h, p, i };
});
onLang.push(() => memEls.forEach(({ m, when, h, p, i, fan }) => {
  when.textContent = m.when?.[lang] || `其${NUM[i] || i + 1}`;
  h.textContent = m.title[lang];
  p.textContent = m.text[lang];
  fan.setAttribute('aria-label', m.title[lang]);
}));
let memSpan = 0;
function layoutMemories() {
  if (!memEls.length) return;
  const ww = memWindow.clientWidth;
  const cw = memEls[0].card.getBoundingClientRect().width || 320;
  const gap = Math.max(40, Math.min(140, ww * 0.08));
  const pad = Math.max(24, (ww - cw) * (mobile ? 0.5 : 0.12));
  memEls.forEach(({ card }, i) => { card.style.left = `${pad + i * (cw + gap)}px`; });
  const width = pad * 2 + memEls.length * cw + (memEls.length - 1) * gap;
  memTrack.style.width = `${width}px`;
  memSpan = Math.max(0, width - ww);
  updateMemories();
}
function updateMemories() {
  const r = memSec.getBoundingClientRect();
  const p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight)));
  memTrack.style.transform = `translate3d(${(-p * memSpan).toFixed(1)}px, 0, 0)`;
}

// ─────────────────────────── her colours, as pigments ───────────────────────────
// traditional Korean colour names; each of her colours is matched to the nearest
const PIGMENTS = [
  { ko: '먹색', en: 'Ink black', fr: 'Noir d’encre', rgb: [28, 26, 23] },
  { ko: '주홍', en: 'Vermilion', fr: 'Vermillon', rgb: [217, 80, 43] },
  { ko: '황토', en: 'Yellow ochre', fr: 'Ocre jaune', rgb: [200, 150, 62] },
  { ko: '쪽빛', en: 'Indigo', fr: 'Indigo', rgb: [43, 74, 122] },
  { ko: '비색', en: 'Celadon', fr: 'Céladon', rgb: [143, 181, 163] },
  { ko: '연분홍', en: 'Blossom pink', fr: 'Rose pâle', rgb: [240, 183, 176] },
  { ko: '소색', en: 'Raw silk', fr: 'Soie écrue', rgb: [232, 220, 196] },
  { ko: '잿빛', en: 'Ash', fr: 'Cendre', rgb: [142, 138, 132] },
  { ko: '은회색', en: 'Silver grey', fr: 'Gris argent', rgb: [192, 188, 182] },
  { ko: '미색', en: 'Rice white', fr: 'Blanc de riz', rgb: [243, 236, 216] },
  { ko: '밤색', en: 'Chestnut', fr: 'Châtaigne', rgb: [107, 62, 38] },
  { ko: '황갈색', en: 'Tawny', fr: 'Fauve', rgb: [178, 134, 92] },
  { ko: '자주', en: 'Plum', fr: 'Prune', rgb: [125, 42, 79] },
  { ko: '녹두', en: 'Mung bean', fr: 'Haricot mungo', rgb: [122, 143, 69] },
  { ko: '살구', en: 'Apricot', fr: 'Abricot', rgb: [240, 167, 115] },
];
// CIE Lab, so that "nearest" means nearest to the eye
function lab([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function nearestPigments(colours) {
  const d2 = (a, b) => { const A = lab(a), B = lab(b); return (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2; };
  const lum = (c) => lab(c)[0];
  const used = new Map();
  return colours.map((c) => {
    const ranked = PIGMENTS.map((p) => ({ p, d: d2(c.rgb, p.rgb) })).sort((a, b) => a.d - b.d);
    // prefer a pigment not used yet, unless it is a much worse match
    const free = ranked.find((r) => !used.has(r.p));
    const pick = free && free.d < ranked[0].d * 2 + 60 ? free : ranked[0];
    const n = used.get(pick.p) || 0;
    used.set(pick.p, n + 1);
    if (!n) return pick.p;
    // the same pigment again: name it by shade, 연 (pale) or 진 (deep)
    const pale = lum(c.rgb) > lum(pick.p.rgb);
    return {
      ko: (pale ? '연' : '진') + pick.p.ko,
      en: `${pale ? 'Pale' : 'Deep'} ${pick.p.en.toLowerCase()}`,
      fr: `${pick.p.fr} ${pale ? 'pâle' : 'profond'}`,
    };
  });
}

// ─────────────────────────── her real posts, embedded from Instagram ───────────────────────────
// Instagram's script loads only when the section comes near, then turns the quotes into posts.
const igPosts = $('#ig-posts');
if (igPosts) {
  new IntersectionObserver((es, io) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = () => window.instgrm?.Embeds?.process();
    document.body.appendChild(s);
  }, { rootMargin: '600px 0px' }).observe(igPosts);
}

// ─────────────────────────── footer: the eternal question ───────────────────────────
$('#noodle').addEventListener('click', (e) => {
  const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
  e.currentTarget.setAttribute('aria-expanded', String(open));
  $('#noodle-a').hidden = !open;
  if (open) phrase(5);
});
// and the other eternal question
$('#avo').addEventListener('click', (e) => {
  const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
  e.currentTarget.setAttribute('aria-expanded', String(open));
  $('#avo-a').hidden = !open;
  if (open) meow();
});

// ─────────────────────────── the seal on the letter ───────────────────────────
const letterSeal = $('#letter-seal');
new IntersectionObserver((es, io) => es.forEach((e) => {
  if (e.isIntersecting) { letterSeal.classList.add('is-stamped'); setTimeout(() => pluck(0, { gain: 0.24 }), 550); io.disconnect(); }
}), { threshold: 0.5 }).observe(letterSeal);

// seals press into the paper as they arrive
root.classList.add('js-seals');
const sealIO = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('is-pressed'); sealIO.unobserve(e.target); }
}), { threshold: 0.6 });
$$('main .seal:not(.letter-seal)').forEach((s) => sealIO.observe(s));

applyLang();

// ─────────────────────────── boot: fonts → photos → ink → scenes ───────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 60 }) : setTimeout(r, 0)));
const fonts = document.fonts
  ? Promise.race([Promise.all([
    document.fonts.load('40px "Nanum Brush Script"', '미화 초상 생각'),
    document.fonts.load('italic 40px "Instrument Serif"', 'Mihwa'),
    document.fonts.load('900 40px "Noto Serif KR"', '首爾巴里一二三四五六七八'),
  ]), wait(2500)])
  : Promise.resolve();


function layoutAll() {
  layoutMemories();
  const moved = layoutPath();
  if (field && moved) field.scan();
}

async function boot() {
  await fonts.catch(() => {});
  photos = await loadPhotos(PHOTOS, t('placeholder'));

  // repaint every photo in ink (on the CPU, one at a time so the page stays responsive)
  for (const ph of photos) {
    await idle();
    const src = ph.image || ph.canvas;
    const c = inkify(src, { max: mobile ? 700 : 1000, color: ph.placeholder ? 0.05 : 0.14, seed: ph.index + 1 });
    ph.inkCanvas = c;
    ph.inkUrl = c.toDataURL('image/jpeg', 0.9);
  }
  const heroPh = photos[HER.heroPhoto] || photos[0];

  lightbox = mountLightbox($('#lightbox'), photos, {
    caption: (i) => PHOTOS[i].caption?.[lang] ?? '',
    onChange: () => pluck(Math.floor(Math.random() * 6) + 2, { gain: 0.1 }),
  });
  onLang.push(() => lightbox.refresh());
  const open = (i, e, v) => lightbox.open(i, e, v);

  // memories: each one painted on a fan
  memEls.forEach(({ m, fan, imInk, imCol }) => {
    const ph = photos[m.photo] || photos[0];
    imInk.src = ph.inkUrl;
    imCol.src = ph.url;
    fan.addEventListener('click', (e) => open(ph.index, e, 'ink'));
  });

  // her colours, ground as pigments
  const pal = extractPalette(photos, 6);
  const names = nearestPigments(pal);
  const dishes = $('#dishes');
  const dishEls = pal.map((c, i) => {
    const d = el('figure', 'dish');
    const bowl = el('div', 'dish-bowl');
    bowl.style.setProperty('--c', c.hex);
    const cap = el('figcaption');
    const name = el('span', 'dish-name', names[i].ko);
    const tr = el('span', 'dish-en');
    cap.append(name, tr, el('span', 'dish-hex', c.hex.toLowerCase()));
    d.append(bowl, cap);
    dishes.appendChild(d);
    return { tr, p: names[i] };
  });
  const dishText = () => dishEls.forEach(({ tr, p }) => { tr.textContent = lang === 'ko' ? '' : p[lang]; });
  dishText();
  onLang.push(dishText);

  // instagram card: ink first, colour on hover
  $('#ig-avatar-img').src = heroPh.url;
  const grid = $('#ig-grid');
  photos.slice(0, 9).forEach((ph, i) => {
    const b = el('button', 'ig-tile');
    b.type = 'button';
    const a = el('img', 'inked'); a.src = ph.inkUrl; a.alt = ''; a.loading = 'lazy';
    const c = el('img', 'col'); c.src = ph.url; c.alt = ''; c.loading = 'lazy';
    b.append(a, c);
    b.addEventListener('click', (e) => open(i, e, 'col'));
    grid.appendChild(b);
  });
  const tileCaps = () => $$('.ig-tile', grid).forEach((b, i) => b.setAttribute('aria-label', PHOTOS[i].caption?.[lang] ?? ''));
  tileCaps();
  onLang.push(tileCaps);

  // her other side: the scope, the wanted poster and the dog tags;
  // and the plum branch of reasons she is loved
  const sound = { shot, ping, glass, pluck };
  const part = async (name, make) => {
    try { return await make(); } catch (err) { console.warn(`${name} unavailable`, err); return null; }
  };
  scope = await part('scope', async () => (await import('./fx/scope.js?v=84ce73c042')).createScope($('#scope'), { t, reduceMotion, mobile, sound }));
  wanted = await part('wanted poster', async () => (await import('./fx/wanted.js?v=84ce73c042')).mountWanted($('#wanted'), {
    photo: photos[HER.wantedPhoto ?? HER.heroPhoto] || heroPh, t, reduceMotion, sound,
  }));
  // the reasons are written by hand in her.js; until there is one, the section stays out of the page
  const reasonText = (r) => (r && (r[lang] || r.en || r.fr || r.ko || '')).trim();
  if (REASONS.some((r) => reasonText(r))) {
    love = await part('plum branch', async () => (await import('./fx/blossoms.js?v=84ce73c042')).createBlossoms($('#love-branch'), {
      reasons: () => REASONS.map(reasonText).filter(Boolean), t, reduceMotion, mobile, sound,
    }));
  } else {
    $('#love').remove();
    $('.rail a[href="#love"]')?.closest('li')?.remove();
  }
  [scope, wanted, love].forEach((api) => api && onLang.push(() => api.relabel()));

  // her baby, keeping the house avocado-free
  cat = await part('her baby', async () => (await import('./fx/cat.js?v=84ce73c042')).createCat($('#cat'), {
    t, reduceMotion, mobile, sound: { purr, meow, pluck }, name: HER.cat?.name || '',
  }));
  if (cat) onLang.push(() => cat.relabel());

  // the gentle storm behind the letter
  const stormCanvas = $('#letter .storm-canvas');
  const storm = await part('storm', async () => (await import('./fx/storm.js?v=84ce73c042')).createStorm(stormCanvas, { reduceMotion, mobile }));
  if (!storm) stormCanvas.classList.add('storm-fallback');

  layoutAll();

  // the sheet of hanji, and all the ink on it
  try {
    const { createInkField } = await import('./fx/inkfield.js?v=84ce73c042');
    field = createInkField($('#ink-field'), { reduceMotion });
  } catch (err) { console.warn('ink field unavailable', err); field = null; }
  if (!field) $('#ink-field').hidden = true;

  // hero: her portrait, in moving ink
  try {
    const { createInkHero } = await import('./fx/fluid.js?v=84ce73c042');
    hero = createInkHero($('#ink-gl'), { source: heroPh.inkCanvas, reduceMotion, mobile, color: 1 });
  } catch (err) { console.warn('ink hero unavailable', err); hero = null; }
  if (hero) {
    const heroLayout = () => {
      const portrait = innerWidth / innerHeight < 0.9;
      hero.setLayout(portrait
        ? { rect: [0.02, 0.3, 0.98, 0.99], blob: [0.5, 0.65], blobR: [0.5, 0.4] }
        : { rect: [0.4, 0.03, 0.97, 0.97], blob: [0.68, 0.5], blobR: [0.56, 0.6] });
    };
    heroLayout();
    addEventListener('resize', heroLayout);
    const heroSec = $('#hero');
    heroSec.addEventListener('pointermove', (e) => hero.pointer(e.clientX, e.clientY), { passive: true });
    heroSec.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return;
      hero.burst(e.clientX, e.clientY);
      pluck(Math.floor(Math.random() * 10), { pan: (e.clientX / innerWidth) * 1.6 - 0.8, gain: 0.16 });
    });
  } else {
    $('#ink-gl').hidden = true;
    const img = $('#hero-fallback');
    img.src = heroPh.inkUrl;
    img.hidden = false;
  }

  // the folding screen of portraits
  try {
    const { createScreen } = await import('./fx/screen.js?v=84ce73c042');
    screen = createScreen($('#screen-gl'), photos, { reduceMotion, onOpen: (i, e) => open(i, e, 'col') });
  } catch (err) { console.warn('folding screen unavailable', err); screen = null; }
  if (screen) {
    screen.setCaptions(lang);
    onLang.push((l) => screen.setCaptions(l));
  } else {
    // no WebGL: show the ink paintings as a simple album instead
    const sec = $('#screen');
    sec.classList.add('is-flat');
    const flat = el('div', 'screen-flat');
    photos.slice(0, 8).forEach((ph, i) => {
      const b = el('button', 'ig-tile');
      b.type = 'button';
      const a = el('img', 'inked'); a.src = ph.inkUrl; a.alt = '';
      const c = el('img', 'col'); c.src = ph.url; c.alt = '';
      b.append(a, c);
      b.addEventListener('click', (e) => open(i, e, 'col'));
      flat.appendChild(b);
    });
    $('#screen .sticky').appendChild(flat);
  }

  // two homes, on a live globe
  try {
    const { createHomes } = await import('./fx/homes.js?v=84ce73c042');
    homes = createHomes($('#globe-gl'), HOMES, { mobile, reduceMotion });
  } catch (err) { console.warn('globe unavailable', err); homes = null; }
  if (homes) {
    homes.setTimeOffset(timeOffset);
    const svg = $('#leaders');
    const lines = HOMES.map((p) => ({ path: $(`#lead-${p.id}`), dot: $(`#lead-${p.id}-dot`), card: $(`#city-${p.id}`) }));
    const citiesEl = $('.cities');
    let lastFocus;
    homes.onFrame((proj, focus) => {
      const box = svg.getBoundingClientRect();
      const narrow = box.width < 821;
      proj.forEach((m, i) => {
        const L = lines[i];
        const r = L.card.getBoundingClientRect();
        const ax = narrow ? r.left + r.width / 2 - box.left : r.right - box.left;
        const ay = narrow ? r.top - box.top : r.top + r.height / 2 - box.top;
        const bx = m.x, by = m.y + 10;
        const cx = narrow ? ax : ax + (bx - ax) * 0.6, cy = narrow ? ay + (by - ay) * 0.6 : ay;
        L.path.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
        L.dot.setAttribute('cx', bx.toFixed(1));
        L.dot.setAttribute('cy', by.toFixed(1));
        const o = Math.max(0, Math.min(1, (m.facing - 0.05) / 0.25));
        L.path.style.opacity = String(o);
        L.dot.style.opacity = String(o);
      });
      if (focus !== lastFocus) {
        lastFocus = focus;
        citiesEl.classList.toggle('has-focus', !!focus);
        lines.forEach((L, i) => L.card.classList.toggle('is-focus', HOMES[i].id === focus));
      }
    });
    fetchWeather(HOMES).then((w) => { weather = w; showWeather(); });
    setInterval(() => fetchWeather(HOMES).then((w) => { if (w) { weather = w; showWeather(); } }), 15 * 60000);
  } else {
    $('#homes').classList.add('is-flat');
  }

  if (!hero && !screen) $('.webgl-fallback').hidden = false;

  // run each canvas only while it is on screen
  const watch = (target, api) => api && new IntersectionObserver((es) => es.forEach((e) => api.setActive(e.isIntersecting)), { rootMargin: '10% 0px' }).observe(target);
  watch($('#hero'), hero);
  watch($('#screen'), screen);
  watch($('#homes'), homes);
  watch($('#scope'), scope);
  watch($('#wanted'), wanted);
  if (love) watch($('#love'), love);
  watch($('#letter'), storm);
  watch($('#cat'), cat);
  onScroll();

  await wait(reduceMotion ? 0 : 300);
  $('#loader').classList.add('is-done');
  document.body.classList.add('is-ready');
  // fonts and images may have shifted things while loading
  setTimeout(layoutAll, 600);
}

// ─────────────────────────── scroll ───────────────────────────
const railLinks = $$('.rail a');
const screenHead = $('#screen .sec-head--over');
function onScroll() {
  if (screen) {
    const r = $('#screen').getBoundingClientRect();
    const p = -r.top / Math.max(1, r.height - innerHeight);
    screen.setProgress(p);
    // the title steps aside as the screen unfolds across the page
    const k = Math.max(0, Math.min(1, (p - 0.1) / 0.2));
    screenHead.style.opacity = String(1 - k * k * (3 - 2 * k));
  }
  updateMemories();
  if (homes) {
    const r = $('#homes').getBoundingClientRect();
    homes.setProgress(-r.top / Math.max(1, r.height - innerHeight));
  }
  document.body.classList.toggle('scrolled', scrollY > innerHeight * 0.6);
  const c = innerHeight * 0.5;
  let active = railLinks[0];
  railLinks.forEach((a) => { const s = $(a.getAttribute('href')); if (s && s.getBoundingClientRect().top <= c) active = a; });
  railLinks.forEach((a) => a.classList.toggle('is-active', a === active));
}
let queued = false;
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; onScroll(); }); } }, { passive: true });
let resizeT = 0;
addEventListener('resize', () => {
  onScroll();
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { layoutAll(); if (field) field.scan(); }, 150);
});

boot().then(() => field && field.scan()).catch((err) => {
  console.error(err);
  $('#loader').classList.add('is-done');
  document.body.classList.add('is-ready');
});
