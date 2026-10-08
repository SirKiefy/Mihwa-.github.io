# 미화 · Mihwa

An album in ink for Mihwa. The whole site is one sheet of hanji paper. Every photo of her is repainted as a Korean ink painting (수묵화), and ink spreads into each part of the page as you scroll to it.

| Leaf | What happens |
| --- | --- |
| **미화 · her portrait** | Her photo, repainted in ink, inside an ink bloom. A GPU fluid simulation carries ink through the water around her: move the cursor or a finger to stir it, click to drop more. |
| **초상 · portraits** | Her photos on an eight-panel folding screen (병풍) with indigo silk mounts. It unfolds as you scroll. Hover a panel and her real colours seep back into the ink. Click to open it. |
| **생각 · in her words** | Things she says, set in brush lettering with a seal each. |
| **추억 · best memories** | A handscroll that unrolls as you scroll, with each memory painted on a fan. |
| **길 · her path** | Bachelor's → Master's → diplomacy → human rights & NGOs → fashion, joined by one brush stroke that zigzags between the seals. |
| **멋 · her style** | Her colours, pulled from her photos and ground like pigments into little dishes. Each gets a traditional Korean colour name. Beside them is a card about her. |
| **두 집 · two homes** | A full-screen live stage after 일월오봉도, the royal screen of the sun, the moon and the five peaks. The globe is lit by where the sun really is right now: the night side is indigo ink with city lights in gold, and the sky shows tonight's real moon phase. A paper crane flies the red thread between Seoul and Paris. Scrolling flies from one home to the other. Each city has a card with a live clock, sunrise/sunset countdown and weather, and a slider moves the sun through the day. |
| **Instagram** | Her handle, bio and a 3×3 grid (ink first, colour on hover), linking to [@mulnaengmyeonn](https://www.instagram.com/mulnaengmyeonn/). |
| **편지 · a letter** | A personal note, sealed with a 美花 stamp. |

Everything is in **English, French and Korean** (toggle at the top right). Sound is off by default. The button next to the languages turns on soft gayageum plucks.

## ✎ Make it hers

Everything about her lives in **`js/her.js`**:

- **`PHOTOS`**: put image files in `photos/` and write each name as `src: 'photos/01.jpg'` (JPG or PNG, about 1600 px on the long side). Rewrite the captions to fit each photo. An empty `src` shows a soft placeholder portrait.
- **`heroPhoto`**: which photo is painted at the top.
- **`THOUGHTS`**: her words. The four there now are *examples* (marked `example: true`). Replace them with things she actually says.
- **`MEMORIES`**: your best memories together, each with a photo (`photo` is its index in `PHOTOS`), an optional date in `when`, a title and a few lines. These are *examples* too.
- **`PATH`**: her path, from now to where she's going.
- **`bio`** and **`notes`**: the short lines about her.
- **`LETTER`**: the letter at the end. Write your own words there.

Every text has an English (`en`), French (`fr`) and Korean (`ko`) version.

The ink paintings are made in the browser from whatever photos you add, so nothing needs to be prepared by hand.

## Run it locally

It is a static site with no build step:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open <http://localhost:8080>. Opening `index.html` directly from disk won't work, because browsers block ES modules on `file://`.

## Publish it

`.github/workflows/pages.yml` deploys the site to **GitHub Pages** on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

If the repository is public, her photos will be public too.

## How it's made

- **Photo → ink painting** (`js/fx/inkify.js`): a Kuwahara filter to flatten the photo into brush-sized patches, banded ink washes with noisy edges, pigment pooling where washes dry, difference-of-Gaussians brush lines with dry-brush breaks, granulation and bleed, all on hanji.
- **The sheet of hanji** (`js/fx/inkfield.js`): one WebGL2 layer behind the page paints the paper and every mark on it (blooms, ensō circles, brush strokes and misty mountain ridges). Marks are anchored to `<i class="ink">` elements in the layout and paint themselves in when they scroll into view.
- **Ink hero** (`js/fx/fluid.js`): a stable-fluids simulation (advection, vorticity confinement, pressure projection), rendered as ink in water.
- **Folding screen** (`js/fx/screen.js`): three.js with custom shaders for the silk mount, the painting, the colour wash on hover and the brush captions.
- **Pigments** (`js/fx/palette.js`): k-means over her photos, matched to traditional colour names in CIE Lab.
- **Live globe** (`js/fx/homes.js`, `js/fx/live.js`): the sun's position from the NOAA formulae, sunrise and sunset found by searching the sun's altitude, the moon's phase from the synodic month, and the current weather from [Open-Meteo](https://open-meteo.com/) (no key; if the network blocks it, the weather line simply doesn't appear). The layers sit at different depths, so they part as the pointer moves. The ones that never change are painted once into a texture. Coastlines are Natural Earth 1:50m (public domain).
- Every canvas only runs while it's on screen. The site respects `prefers-reduced-motion`, works with keyboard and touch, and falls back gracefully without WebGL.

```
index.html
css/style.css
js/
  her.js           ✎ everything about her: photos, words, memories, path, letter
  i18n.js          interface text (EN / FR / KO)
  main.js          wiring: language, scroll, sections, lightbox
  audio.js         gayageum plucks
  fx/              ink painting, ink field, fluid, folding screen, palette, lightbox, live globe
  data/            coastlines and city lights
  scene/           shared shader code and ink textures
  ink/brush.js     seal stamp and small ink helpers
photos/            her photos go here
vendor/three/      three.js r180 (MIT)
```
