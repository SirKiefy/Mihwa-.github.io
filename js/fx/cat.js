// Her baby: a slate-grey cat, nearly black, loafing on his cat tree by the
// window, plus an avocado that really should know better.
//
// The room is painted once into .cat-bg. Everything that moves is on .cat-fg.
// He's a little rig of pre-painted parts (body, haunch, chest, neck, head,
// ears, legs, paws, a fluffy tail) posed every frame, and his face is drawn
// live on a sphere so his head can actually turn.
//
// createCat(root, { t, reduceMotion, mobile, sound, name }) gives back
// { setActive, relabel, destroy }, or null if there's no 2D canvas.
import { rng, noise1, stamp, stroke, sealStamp } from '../ink/brush.js?v=b516bf9492';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = (k) => { k = clamp(k); return k * k * k; };
const easeInOut = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeBack = (k) => { k = clamp(k) - 1; return 1 + 2.4 * k * k * k + 1.4 * k * k; };
// up and back down again as k goes from 0 to 1
const hump = (k) => Math.sin(Math.PI * clamp(k));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a).toFixed(3)})`;
const mix = (c1, c2, k) => [0, 1, 2].map((i) => Math.round(c1[i] + (c2[i] - c1[i]) * k));
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const dprNow = () => Math.min(2, window.devicePixelRatio || 1);

// colours
const INKC = [24, 22, 22];
const FUR_DARK = [14, 15, 20];
const SHEEN = [172, 185, 210];
const EAR_IN = [138, 108, 118];
const BEAN = [160, 114, 130];
const WHISKER = 'rgba(238,238,244,.72)';
const WOOD = [204, 156, 102];
const WOOD_L = [226, 186, 132];
const WOOD_D = [152, 104, 60];
const WOOD_INK = [92, 58, 32];
const CREAM = [247, 242, 230];
const CREAM_S = [222, 211, 190];
const CREAM_D = [184, 170, 146];
const CREAM_INK = [128, 114, 96];
const SISAL = [226, 210, 176];
const SISAL_D = [172, 148, 110];
const SISAL_LINE = [138, 112, 76];
const LEAF_D = [62, 96, 56];
const LEAF = [102, 140, 80];
const LEAF_L = [164, 194, 122];
const SKY = [240, 243, 230];
const AVO_SKIN = [40, 66, 32];
const AVO_SKIN_L = [84, 118, 50];
const SEAL_RGB = [184, 50, 42];
const TREAT = [190, 128, 74];

// soft round dabs for things drawn every frame; same look as brush.js stamp(),
// but cached by the colour array itself so nothing gets built per call
const SOFT = new Map();
function soft(rgb, hard) {
  let m = SOFT.get(rgb);
  if (!m) { m = new Map(); SOFT.set(rgb, m); }
  let c = m.get(hard);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = rgb;
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  gr.addColorStop(hard, `rgba(${r},${gg},${b},0.85)`);
  gr.addColorStop(0.75, `rgba(${r},${gg},${b},0.25)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  m.set(hard, c);
  return c;
}
function dab(g, x, y, r, rgb, alpha, hard) {
  if (alpha <= 0.002 || r <= 0.2) return;
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(soft(rgb, hard), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}
const SHADOW = [60, 46, 34];
const AVO_SHADOW = [60, 44, 30];
const BLUSH = [232, 120, 110];
const GLOW = [255, 250, 236];
const MOUTH_S = 'rgb(70,26,36)';
const TONGUE_S = 'rgb(214,124,136)';

// his coat, from deep shadow to where the window light catches it
const COAT = [[0, [8, 9, 12]], [0.2, [14, 15, 20]], [0.4, [22, 24, 30]], [0.6, [34, 37, 45]], [0.8, [53, 57, 69]], [1, [94, 101, 122]]];
function coat(v, out) {
  v = clamp(v);
  let i = 1;
  while (i < COAT.length - 1 && COAT[i][0] < v) i++;
  const [a, ca] = COAT[i - 1], [b, cb] = COAT[i];
  const k = (v - a) / (b - a);
  out[0] = ca[0] + (cb[0] - ca[0]) * k;
  out[1] = ca[1] + (cb[1] - ca[1]) * k;
  out[2] = ca[2] + (cb[2] - ca[2]) * k;
  return out;
}

// text (English is the fallback if the page doesn't have a key)
export const CAT_STRINGS = {
  en: {
    'cat.label': 'Her baby, a slate-grey cat with green eyes, loafing on his cat tree by the window, a pompom dangling below him and a short stack of books nearby. On the floor: a jar of treats, and an avocado looking far too pleased with itself.',
    'cat.label.named': '{name}, her baby: a slate-grey cat with green eyes, loafing on his cat tree by the window, a pompom dangling below him and a short stack of books nearby. On the floor: a jar of treats, and an avocado looking far too pleased with itself.',
    'cat.caption': 'Her baby keeps watch by the window, and this house is strictly avocado-free.',
    'cat.caption.named': '{name}, her baby, keeps watch by the window, and this house is strictly avocado-free.',
    'cat.hint': 'Fling the avocado or toss it up to him: he knows what to do. Stroke his back, scratch his chin, tap the jar for a treat or a book to open it, and look under More for a laser, a brush, hats and some ink.',
    'cat.hint.touch': 'Fling the avocado with your finger or toss it up to him: he knows what to do. Stroke his back, scratch his chin, tap the jar for a treat or a book to open it, and look under More for a laser, a brush, hats and some ink.',
    'cat.btns': 'Play with her baby',
    'cat.btns.named': 'Play with {name}',
    'cat.btn.poke': 'Poke the avocado',
    'cat.btn.swat': 'Let him handle it',
    'cat.btn.pet': 'Pet her baby',
    'cat.btn.pet.named': 'Pet {name}',
    'cat.btn.boop': 'Boop his nose',
    'cat.btn.treat': 'Give a treat',
    'cat.btn.toy': 'Dangle the pompom',
    'cat.count.0': 'Avocado bullied: not yet',
    'cat.count.1': 'Avocado bullied: {n} time',
    'cat.count.n': 'Avocado bullied: {n} times',
    'cat.m.1': 'And so it begins.',
    'cat.m.3': 'It’s starting to sweat.',
    'cat.m.5': 'It had it coming.',
    'cat.m.10': 'Mimi would be proud.',
    'cat.m.15': 'He hasn’t even stood up yet.',
    'cat.m.25': 'Okay, it has learned its lesson.',
    'cat.m.40': 'It has not learned its lesson.',
    'cat.m.60': 'Somewhere, a bowl of guacamole is trembling.',
    'cat.m.100': 'One hundred. He accepts payment in treats.',
    'cat.tally.pets': 'Pets: {n}',
    'cat.tally.treats': 'Treats: {n}',
    'cat.say.back': 'You stroke his back. He purrs, eyes squeezed shut into two happy little arcs.',
    'cat.say.chin': 'You scratch under his chin. He leans in and purrs louder.',
    'cat.say.head': 'You pat his head. His ears go flat for a second.',
    'cat.say.over': 'Too much petting! A gentle warning swat, no claws. Give him a moment.',
    'cat.say.grumpy': 'He’s had enough petting for now.',
    'cat.say.boop': 'Boop! A slow blink, a twitch of the nose, and a little mrrp.',
    'cat.say.treat': 'A treat! He sniffs it, crunches it, and licks his lips.',
    'cat.say.toy': 'The pompom wiggles. He wiggles back, then pounces.',
    'cat.say.swat': 'He swats it right off the platform.',
    'cat.say.push': 'He pushes it off the edge, slowly, staring right at you.',
    'cat.say.bury': 'He scratches at the cushion to bury it, like something gross.',
    'cat.say.sit': 'He just sits on it. Problem solved.',
    'cat.say.wake': 'He wakes up and blinks at you.',
    'cat.say.buck': 'Not on his back! A bounce of the hips, a lash of the tail, and off it flies.',
    'cat.say.sleep': 'He drifts off to sleep, breathing slow and deep.',
    'cat.say.busy': 'He’s busy right now. Try again in a moment.',
    'cat.more': 'More things to do',
    'cat.g.play': 'Play',
    'cat.g.care': 'Care',
    'cat.g.chat': 'Chat',
    'cat.g.dress': 'Dress up',
    'cat.g.art': 'Art',
    'cat.btn.laser': 'Laser pointer',
    'cat.btn.brush': 'Brush him',
    'cat.btn.nip': 'Catnip',
    'cat.btn.psst': 'Psst psst',
    'cat.btn.blink': 'Slow blink',
    'cat.btn.hat': 'Try on a hat',
    'cat.btn.paint': 'Paw painting',
    'cat.btn.book': 'Open a book',
    'cat.tally.art': 'Masterpieces: {n}',
    'cat.psst.word': 'psst psst',
    'cat.book.0': 'Toji',
    'cat.book.1': 'The Red and the Black',
    'cat.book.2': 'the Kim Hong-do album',
    'cat.book.3': 'The Art of War',
    'cat.book.4': 'On War',
    'cat.say.laser.on': 'A red dot! His pupils go huge and his eyes lock on.',
    'cat.say.laser.pounce': 'He pounces, then peeks under his paw. Nothing there. Suspicious.',
    'cat.say.laser.off': 'The laser clicks off. He keeps staring at the spot where it was.',
    'cat.say.brush': 'You brush him, head to tail. Little tufts of fur float off and he purrs.',
    'cat.say.brush.wrong': 'Tail to head? His fur puffs right up and he gives you a look.',
    'cat.say.psst': 'Psst psst. His ears swivel forward and he turns to you: mrrp?',
    'cat.say.ignore': 'Psst psst, again? He looks pointedly out of the window, ears sideways.',
    'cat.say.blink': 'You slow-blink at him. He slow-blinks right back, which in cat means he trusts you.',
    'cat.say.hat.none': 'Hat off. He looks relieved, and a little smug.',
    'cat.say.hat.beret': 'A little French beret. He looks mildly unimpressed.',
    'cat.say.hat.gat': 'A tiny gat, black horsehair and amber beads. He tolerates it.',
    'cat.say.hat.crown': 'A crown of plum blossoms. He wears it like he was born to.',
    'cat.say.hat.shake': 'He shakes his head and the hat goes flying.',
    'cat.say.nip': 'Catnip! A sniff, a nibble, then he rubs his cheek all over the cushion, very silly.',
    'cat.say.nip.nap': 'All that excitement: he flops down into a catnip nap.',
    'cat.say.nip.wait': 'He’s had plenty of catnip for now. Maybe a bit later.',
    'cat.say.paint': 'Ink on one paw, a sheet of hanji: he stamps a masterpiece and signs it with a little red seal.',
    'cat.say.paint.done': 'Masterpiece finished. There will never be another quite like it.',
    'cat.say.paint.wall': 'Masterpiece finished. It goes up on the wall.',
    'cat.say.book.0': 'You open Toji. He settles across the pages like he’s been reading it for years.',
    'cat.say.book.1': 'You open The Red and the Black. He lies down right in the middle of a chapter.',
    'cat.say.book.2': 'You open the Kim Hong-do album. Now there’s a cat in it too.',
    'cat.say.book.3': 'You open The Art of War. He takes the high ground: the open pages.',
    'cat.say.book.4': 'You open On War. He has found the centre of gravity, and he is lying on it.',
    'cat.say.nudge': 'He nudges {book} off the sill, slowly, looking right at you.',
  },
  fr: {
    'cat.label': 'Son bébé, un chat gris ardoise aux yeux verts, pattes repliées sous lui sur son arbre à chat près de la fenêtre, un pompon suspendu en dessous et une petite pile de livres à côté. Par terre : un bocal de friandises, et un avocat, l’air bien trop content de lui.',
    'cat.label.named': '{name}, son bébé : un chat gris ardoise aux yeux verts, pattes repliées sous lui sur son arbre à chat près de la fenêtre, un pompon suspendu en dessous et une petite pile de livres à côté. Par terre : un bocal de friandises, et un avocat, l’air bien trop content de lui.',
    'cat.caption': 'Son bébé monte la garde près de la fenêtre, et ici, les avocats sont strictement interdits.',
    'cat.caption.named': '{name}, son bébé, monte la garde près de la fenêtre, et ici, les avocats sont strictement interdits.',
    'cat.hint': 'Lancez l’avocat ou envoyez-le-lui là-haut : il sait quoi faire. Caressez-lui le dos, grattez-lui le menton, tapotez le bocal pour une friandise ou un livre pour l’ouvrir, et ouvrez « D’autres jeux » pour un laser, une brosse, des chapeaux et de l’encre.',
    'cat.hint.touch': 'Lancez l’avocat du doigt ou envoyez-le-lui là-haut : il sait quoi faire. Caressez-lui le dos, grattez-lui le menton, touchez le bocal pour une friandise ou un livre pour l’ouvrir, et ouvrez « D’autres jeux » pour un laser, une brosse, des chapeaux et de l’encre.',
    'cat.btns': 'Jouer avec son bébé',
    'cat.btns.named': 'Jouer avec {name}',
    'cat.btn.poke': 'Piquer l’avocat',
    'cat.btn.swat': 'Le laisser faire',
    'cat.btn.pet': 'Caresser son bébé',
    'cat.btn.pet.named': 'Caresser {name}',
    'cat.btn.boop': 'Boop sur le nez',
    'cat.btn.treat': 'Donner une friandise',
    'cat.btn.toy': 'Agiter le pompon',
    'cat.count.0': 'Avocat malmené : pas encore',
    'cat.count.1': 'Avocat malmené : {n} fois',
    'cat.count.n': 'Avocat malmené : {n} fois',
    'cat.m.1': 'Et c’est parti.',
    'cat.m.3': 'L’avocat commence à transpirer.',
    'cat.m.5': 'Il l’a bien cherché.',
    'cat.m.10': 'Mimi serait fière.',
    'cat.m.15': 'Et son bébé ne s’est même pas levé.',
    'cat.m.25': 'Bon, il a compris la leçon.',
    'cat.m.40': 'Il n’a pas compris la leçon.',
    'cat.m.60': 'Quelque part, un bol de guacamole tremble.',
    'cat.m.100': 'Cent. Il accepte d’être payé en friandises.',
    'cat.tally.pets': 'Caresses : {n}',
    'cat.tally.treats': 'Friandises : {n}',
    'cat.say.back': 'Vous lui caressez le dos. Il ronronne, les yeux plissés en deux petits arcs heureux.',
    'cat.say.chin': 'Vous lui grattez le menton. Il se penche vers vous et ronronne plus fort.',
    'cat.say.head': 'Vous lui tapotez la tête. Ses oreilles s’aplatissent un instant.',
    'cat.say.over': 'Trop de caresses ! Un petit coup de patte d’avertissement, sans les griffes. Laissez-le souffler un moment.',
    'cat.say.grumpy': 'Il a eu assez de caresses pour l’instant.',
    'cat.say.boop': 'Boop ! Un lent clignement d’yeux, le nez qui frémit, et un petit « mrrp ».',
    'cat.say.treat': 'Une friandise ! Il la renifle, la croque et se lèche les babines.',
    'cat.say.toy': 'Le pompon s’agite. Il se trémousse, puis il bondit.',
    'cat.say.swat': 'D’un coup de patte, il l’envoie valser hors de la plateforme.',
    'cat.say.push': 'Il le pousse lentement dans le vide, en vous regardant droit dans les yeux.',
    'cat.say.bury': 'Il gratte le coussin pour l’enterrer, comme un truc dégoûtant.',
    'cat.say.sit': 'Il s’assoit dessus, tout simplement. Problème réglé.',
    'cat.say.wake': 'Il se réveille et cligne des yeux vers vous.',
    'cat.say.buck': 'Pas sur son dos ! Un coup de reins, un coup de queue, et l’avocat s’envole.',
    'cat.say.sleep': 'Il s’endort, la respiration lente et profonde.',
    'cat.say.busy': 'Il est occupé pour l’instant. Réessayez dans un moment.',
    'cat.more': 'D’autres jeux',
    'cat.g.play': 'Jouer',
    'cat.g.care': 'Soins',
    'cat.g.chat': 'Parler',
    'cat.g.dress': 'Se déguiser',
    'cat.g.art': 'Art',
    'cat.btn.laser': 'Pointeur laser',
    'cat.btn.brush': 'Le brosser',
    'cat.btn.nip': 'Herbe à chat',
    'cat.btn.psst': 'Psst psst',
    'cat.btn.blink': 'Cligner lentement',
    'cat.btn.hat': 'Essayer un chapeau',
    'cat.btn.paint': 'Peinture à la patte',
    'cat.btn.book': 'Ouvrir un livre',
    'cat.tally.art': 'Chefs-d’œuvre : {n}',
    'cat.psst.word': 'psst psst',
    'cat.book.0': '« Toji »',
    'cat.book.1': '« Le Rouge et le Noir »',
    'cat.book.2': 'l’album de Kim Hong-do',
    'cat.book.3': '« L’Art de la guerre »',
    'cat.book.4': '« De la guerre »',
    'cat.say.laser.on': 'Un point rouge ! Ses pupilles deviennent immenses, ses yeux ne le lâchent plus.',
    'cat.say.laser.pounce': 'Il bondit, puis jette un œil sous sa patte. Rien. C’est louche.',
    'cat.say.laser.off': 'Le laser s’éteint. Il fixe encore l’endroit où était le point.',
    'cat.say.brush': 'Vous le brossez de la tête à la queue. De petites touffes de poils s’envolent et il ronronne.',
    'cat.say.brush.wrong': 'De la queue vers la tête ? Ses poils se hérissent et il vous lance un regard.',
    'cat.say.psst': 'Psst psst. Ses oreilles pivotent vers l’avant et il se tourne vers vous : « mrrp ? »',
    'cat.say.ignore': 'Psst psst, encore ? Il regarde ostensiblement par la fenêtre, les oreilles sur les côtés.',
    'cat.say.blink': 'Vous clignez lentement des yeux vers lui. Il vous répond de même : en langage chat, ça veut dire qu’il vous fait confiance.',
    'cat.say.hat.none': 'Plus de chapeau. Il a l’air soulagé, et un peu fier de lui.',
    'cat.say.hat.beret': 'Un petit béret. Il n’a pas l’air très impressionné.',
    'cat.say.hat.gat': 'Un minuscule gat, en crin noir avec des perles d’ambre. Il le tolère.',
    'cat.say.hat.crown': 'Une couronne de fleurs de prunier. Il la porte comme s’il était né avec.',
    'cat.say.hat.shake': 'Il secoue la tête et le chapeau s’envole.',
    'cat.say.nip': 'De l’herbe à chat ! Il renifle, grignote, puis se frotte la joue partout sur le coussin, complètement fou.',
    'cat.say.nip.nap': 'Trop d’émotions : il s’affale dans une sieste à l’herbe à chat.',
    'cat.say.nip.wait': 'Il a eu assez d’herbe à chat pour l’instant. Un peu plus tard, peut-être.',
    'cat.say.paint': 'De l’encre sur une patte, une feuille de hanji : il tamponne un chef-d’œuvre et le signe d’un petit sceau rouge.',
    'cat.say.paint.done': 'Chef-d’œuvre terminé. Il n’y en aura jamais d’autre tout à fait pareil.',
    'cat.say.paint.wall': 'Chef-d’œuvre terminé. Il est accroché au mur.',
    'cat.say.book.0': 'Vous ouvrez « Toji ». Il s’installe sur les pages comme s’il le lisait depuis des années.',
    'cat.say.book.1': 'Vous ouvrez « Le Rouge et le Noir ». Il se couche en plein milieu d’un chapitre.',
    'cat.say.book.2': 'Vous ouvrez l’album de Kim Hong-do. Maintenant, il y a un chat dedans aussi.',
    'cat.say.book.3': 'Vous ouvrez « L’Art de la guerre ». Il prend les hauteurs : les pages ouvertes.',
    'cat.say.book.4': 'Vous ouvrez « De la guerre ». Il a trouvé le centre de gravité, et il est couché dessus.',
    'cat.say.nudge': 'Il pousse {book} hors du rebord de la fenêtre, lentement, en vous regardant droit dans les yeux.',
  },
  ko: {
    'cat.label': '미화네 아기: 초록 눈의 짙은 회색 고양이가 창가 캣타워 위에서 식빵을 굽고 있고, 그 아래엔 폼폼 장난감이 대롱대롱 매달려 있고, 옆에는 책 몇 권이 쌓여 있어요. 바닥에는 간식 통 하나와, 괜히 잘난 척하는 아보카도 하나가 있어요.',
    'cat.label.named': '미화네 아기 {name}: 초록 눈의 짙은 회색 고양이가 창가 캣타워 위에서 식빵을 굽고 있고, 그 아래엔 폼폼 장난감이 대롱대롱 매달려 있고, 옆에는 책 몇 권이 쌓여 있어요. 바닥에는 간식 통 하나와, 괜히 잘난 척하는 아보카도 하나가 있어요.',
    'cat.caption': '창가를 지키는 미화네 아기. 이 집은 아보카도 출입 금지예요.',
    'cat.caption.named': '창가를 지키는 미화네 아기, {name}. 이 집은 아보카도 출입 금지예요.',
    'cat.hint': '아보카도를 휙 던지거나 아기 쪽으로 올려 보내 보세요. 알아서 처리해 줄 거예요. 등을 쓰다듬고, 턱을 긁어 주고, 간식 통이나 책을 눌러 보고, ‘더 놀기’에서 레이저, 빗, 모자, 먹물도 찾아보세요.',
    'cat.hint.touch': '아보카도를 손가락으로 휙 던지거나 아기 쪽으로 올려 보내 보세요. 알아서 처리해 줄 거예요. 등을 쓰다듬고, 턱을 긁어 주고, 간식 통이나 책을 톡 눌러 보고, ‘더 놀기’에서 레이저, 빗, 모자, 먹물도 찾아보세요.',
    'cat.btns': '아기랑 놀기',
    'cat.btns.named': '{name}하고 놀기',
    'cat.btn.poke': '아보카도 콕 찌르기',
    'cat.btn.swat': '아기한테 맡기기',
    'cat.btn.pet': '아기 쓰다듬기',
    'cat.btn.pet.named': '{name} 쓰다듬기',
    'cat.btn.boop': '코 톡 누르기',
    'cat.btn.treat': '간식 주기',
    'cat.btn.toy': '폼폼 흔들기',
    'cat.count.0': '아보카도 괴롭힌 횟수: 아직 없음',
    'cat.count.1': '아보카도 괴롭힌 횟수: {n}번',
    'cat.count.n': '아보카도 괴롭힌 횟수: {n}번',
    'cat.m.1': '자, 이제 시작이에요.',
    'cat.m.3': '아보카도가 식은땀을 흘리기 시작했어요.',
    'cat.m.5': '자업자득이에요.',
    'cat.m.10': '미미가 자랑스러워할 거예요.',
    'cat.m.15': '아기는 아직 일어나지도 않았어요.',
    'cat.m.25': '좋아요, 이제 정신 차렸겠죠.',
    'cat.m.40': '아니요, 아직 정신 못 차렸네요.',
    'cat.m.60': '어딘가에서 과카몰리 한 그릇이 떨고 있어요.',
    'cat.m.100': '백 번! 수고비는 간식으로 받는대요.',
    'cat.tally.pets': '쓰다듬기: {n}번',
    'cat.tally.treats': '간식: {n}개',
    'cat.say.back': '등을 쓰다듬어 주니 눈을 행복하게 꼭 감고 골골거려요.',
    'cat.say.chin': '턱 밑을 긁어 주니 몸을 기대 오며 더 크게 골골거려요.',
    'cat.say.head': '머리를 토닥이니 귀가 잠깐 납작해져요.',
    'cat.say.over': '너무 많이 쓰다듬었어요! 발톱 없이 살짝 경고 냥펀치. 잠깐 쉬게 해 주세요.',
    'cat.say.grumpy': '지금은 쓰다듬기 그만이래요.',
    'cat.say.boop': '콕! 천천히 눈을 깜빡이고 코를 씰룩이더니 작게 “냥” 해요.',
    'cat.say.treat': '간식이다! 킁킁 냄새를 맡고, 오독오독 씹고, 입맛을 다셔요.',
    'cat.say.toy': '폼폼이 흔들리자 엉덩이를 씰룩씰룩하더니 덮쳐요.',
    'cat.say.swat': '냥펀치 한 방에 아보카도가 날아가요.',
    'cat.say.push': '이쪽을 빤히 쳐다보면서 아보카도를 천천히 밀어 떨어뜨려요.',
    'cat.say.bury': '더러운 걸 묻듯이 쿠션을 박박 긁어요.',
    'cat.say.sit': '그냥 깔고 앉아 버렸어요. 해결 완료.',
    'cat.say.wake': '잠에서 깨어 이쪽을 보며 눈을 깜빡여요.',
    'cat.say.buck': '감히 등 위에! 엉덩이를 들썩이고 꼬리를 휙 휘두르자 아보카도가 날아가요.',
    'cat.say.sleep': '숨소리가 느려지더니 새근새근 잠이 들었어요.',
    'cat.say.busy': '지금은 바빠요. 조금 있다가 다시 해 보세요.',
    'cat.more': '더 놀기',
    'cat.g.play': '놀이',
    'cat.g.care': '돌봄',
    'cat.g.chat': '대화',
    'cat.g.dress': '꾸미기',
    'cat.g.art': '예술',
    'cat.btn.laser': '레이저 포인터',
    'cat.btn.brush': '빗질해 주기',
    'cat.btn.nip': '캣닢 주기',
    'cat.btn.psst': '살짝 불러 보기',
    'cat.btn.blink': '천천히 눈 깜빡이기',
    'cat.btn.hat': '모자 씌우기',
    'cat.btn.paint': '발도장 그림',
    'cat.btn.book': '책 펼치기',
    'cat.tally.art': '걸작: {n}점',
    'cat.psst.word': '나비야~',
    'cat.book.0': '『토지』',
    'cat.book.1': '『적과 흑』',
    'cat.book.2': '김홍도 화첩',
    'cat.book.3': '『손자병법』',
    'cat.book.4': '『전쟁론』',
    'cat.say.laser.on': '빨간 점이다! 동공이 커다래지고 눈이 점에 딱 고정돼요.',
    'cat.say.laser.pounce': '와락 덮치고는 앞발을 살짝 들어 확인해요. 아무것도 없네요. 수상해요.',
    'cat.say.laser.off': '레이저가 꺼졌어요. 그래도 점이 있던 자리를 한참 쳐다봐요.',
    'cat.say.brush': '머리에서 꼬리 쪽으로 빗질해 주니 털 뭉치가 둥실 날아가고 골골거려요.',
    'cat.say.brush.wrong': '꼬리에서 머리 쪽으로요? 털이 부스스 곤두서고, 어이없다는 듯 이쪽을 봐요.',
    'cat.say.psst': '나비야~ 하고 부르니 귀가 앞으로 쫑긋, 고개를 돌리고 “냥?” 해요.',
    'cat.say.ignore': '또 불러요? 귀를 옆으로 눕히고 대놓고 창밖만 봐요.',
    'cat.say.blink': '천천히 눈을 깜빡여 주니 아기도 천천히 깜빡여 줘요. 고양이 말로 “믿어요”라는 뜻이래요.',
    'cat.say.hat.none': '모자를 벗겼어요. 후련하고 조금 의기양양한 표정이에요.',
    'cat.say.hat.beret': '작은 프랑스 베레모. 별로 감동한 눈치는 아니에요.',
    'cat.say.hat.gat': '검은 말총에 호박 구슬 끈까지 단 작은 갓. 그럭저럭 참아 주네요.',
    'cat.say.hat.crown': '매화 화관. 원래부터 쓰고 태어난 것처럼 잘 어울려요.',
    'cat.say.hat.shake': '고개를 털털 흔들자 모자가 날아가요.',
    'cat.say.nip': '캣닢이다! 킁킁, 냠냠 하더니 쿠션에 볼을 마구 비벼요. 완전 신났어요.',
    'cat.say.nip.nap': '너무 신났는지 그대로 털썩, 캣닢 낮잠에 빠졌어요.',
    'cat.say.nip.wait': '캣닢은 이만하면 충분해요. 조금 있다가 다시 줘요.',
    'cat.say.paint': '한쪽 앞발에 먹물을 묻혀 한지에 발도장을 꾹꾹 찍고, 작은 빨간 낙관으로 서명해요.',
    'cat.say.paint.done': '걸작 완성! 세상에 단 하나뿐인 작품이에요.',
    'cat.say.paint.wall': '걸작 완성! 벽에 걸어 줬어요.',
    'cat.say.book.0': '『토지』를 펼치니 오래전부터 읽던 책인 양 그 위에 자리를 잡아요.',
    'cat.say.book.1': '『적과 흑』을 펼치니 딱 읽던 부분 위에 드러누워요.',
    'cat.say.book.2': '김홍도 화첩을 펼치니, 이제 그림 속에 고양이도 한 마리 있어요.',
    'cat.say.book.3': '『손자병법』을 펼치니 높은 곳부터 차지해요. 바로 펼친 책 위요.',
    'cat.say.book.4': '『전쟁론』을 펼치니 무게중심을 찾았대요. 바로 그 위에 누워 있어요.',
    'cat.say.nudge': '창턱 위 {book}에 앞발을 대고 천천히 밀어 떨어뜨려요. 이쪽을 빤히 보면서요.',
  },
};
const MILESTONES = [1, 3, 5, 10, 15, 25, 40, 60, 100];

// markup
const ICON_AVO = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2.2c2 0 2.9 1.9 3.3 3.9.4 1.8 2.6 3.2 2.6 6.3 0 3.3-2.6 5.4-5.9 5.4S4.1 15.7 4.1 12.4c0-3.1 2.2-4.5 2.6-6.3C7.1 4.1 8 2.2 10 2.2z"/><circle cx="10" cy="12.6" r="2.6"/></svg>';
const ICON_PAW = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><ellipse cx="10" cy="13.4" rx="4.1" ry="3.3"/><circle cx="4.6" cy="8.6" r="1.7"/><circle cx="8" cy="5.4" r="1.8"/><circle cx="12" cy="5.4" r="1.8"/><circle cx="15.4" cy="8.6" r="1.7"/></svg>';
const ICON_PET = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 16.4S3.2 12.3 3.2 7.6A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6.8 1.6c0 4.7-6.8 8.8-6.8 8.8z"/></svg>';
const ICON_BOOP = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M2.8 2.6l4.5 3.3c1.8-.6 3.6-.6 5.4 0l4.5-3.3-.2 7.1c.5 4.6-3 7.3-7 7.3s-7.5-2.7-7-7.3zM8.6 11.2h2.8L10 12.9z"/></svg>';
const ICON_TREAT = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2 10c2.3-3.6 6.2-4.9 9.8-3.6L16.4 3l-1 7 1 7-4.6-3.4C8.2 14.9 4.3 13.6 2 10z"/><circle cx="6.4" cy="9.2" r="1" fill="#f8f4ec"/></svg>';
const ICON_TOY = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 1.2v7.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="10" cy="13.4" r="4.4"/><path d="M5 11.2l-1.6-.9M15 11.2l1.6-.9M4.9 15.4l-1.5.8M15.1 15.4l1.5.8M10 18.6v1" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
const ICON_MORE = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.2 7.6L10 12.4l4.8-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_LASER = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="3.1"/><path d="M10 1.8v3.4M10 14.8v3.4M1.8 10h3.4M14.8 10h3.4M4.2 4.2l2.3 2.3M13.5 13.5l2.3 2.3M15.8 4.2l-2.3 2.3M4.2 15.8l2.3-2.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const ICON_BRUSH = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2.6 11.6c0-3 2.6-5 6-5s6 2 6 5z"/><path d="M13.4 7.8l4.4-4.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3.6 13.2v3M5.8 13.2v3.4M8 13.2v3.4M10.2 13.2v3.4M12.4 13.2v3.4M14.4 13.2v3" fill="none" stroke="currentColor" stroke-width=".9" stroke-linecap="round"/></svg>';
const ICON_NIP = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M8.6 18.4C9.4 13 10.4 8 12.6 3.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9.4 13.6C6 14.6 3 13 2.6 10.4c2.8-.6 5.6.4 6.8 3.2zM10 12.6c3.2.6 6-.8 6.8-3.4-2.8-.8-5.6.2-6.8 3.4zM11 8.4C8.6 8.8 6.4 7.4 6.2 5.4c2.2-.4 4.2.6 4.8 3zM11.6 7.8c2.4.2 4.2-1 4.6-3-2.2-.4-4 .6-4.6 3z"/><circle class="cat-ic-flower" cx="12.8" cy="2.6" r="1.6"/></svg>';
const ICON_PSST = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3.4 4.6l3.6 2.2c1.6-.6 3.2-.6 4.6 0l3.6-2.2-.4 5.4c.4 3.6-2.4 5.8-5.4 5.8s-5.8-2.2-5.4-5.8z"/><path d="M16.2 13.4c1 .6 1.6 1.6 1.6 2.8M17.8 11c1.4.9 2 2.5 1.8 4" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
const ICON_BLINK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2.4 9.4c2.2 3.8 13 3.8 15.2 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 12.4l-1.2 1.8M8.4 13.4l-.5 2.1M11.6 13.4l.5 2.1M15 12.4l1.2 1.8" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
const ICON_HAT = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2.4 12.6c-.4-3.8 3.4-6.6 8-6.6 4.4 0 7.6 2.2 7.2 5.2-.2 1.6-2.6 2.4-7.6 2.4-5.4 0-7.4-.2-7.6-1z"/><path d="M11 6.2c.2-1.2.8-2.2 1.8-2.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3.4 14.6c2.6.8 10.6.8 13.2 0" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
const ICON_PAINT = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><ellipse cx="8.6" cy="12.6" rx="3.6" ry="2.9"/><circle cx="3.9" cy="8.4" r="1.5"/><circle cx="6.9" cy="5.6" r="1.6"/><circle cx="10.4" cy="5.6" r="1.6"/><circle cx="13.3" cy="8.4" r="1.5"/><rect class="cat-ic-seal" x="14.2" y="13.4" width="4.2" height="4.2" rx=".6"/></svg>';
const ICON_BOOK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M1.8 5c3-1.2 5.8-.8 8.2 1 2.4-1.8 5.2-2.2 8.2-1v11.2c-3-1.2-5.8-.8-8.2 1-2.4-1.8-5.2-2.2-8.2-1z"/><path d="M10 6v10.8" fill="none" stroke="#f8f4ec" stroke-width=".9"/></svg>';

/** The inside of the fragment (the outer element is `<div class="cat" id="cat">`). */
export const CAT_INNER = `
  <div class="cat-stage" role="img">
    <canvas class="cat-bg" aria-hidden="true"></canvas>
    <canvas class="cat-fg" aria-hidden="true"></canvas>
    <span class="cat-grab" aria-hidden="true"></span>
    <span class="cat-grab cat-grab--toy" aria-hidden="true"></span>
    <span class="cat-grab cat-grab--dot" aria-hidden="true"></span>
  </div>
  <p class="cat-caption"><span class="cat-caption-main"></span> <span class="cat-caption-hint"></span></p>
  <div class="cat-bar">
    <p class="cat-count" aria-live="polite"><span class="cat-count-n"></span> <span class="cat-count-note"></span></p>
    <div class="cat-btns" role="group">
      <button type="button" class="cat-btn cat-btn--poke">${ICON_AVO}<span class="cat-btn-text" data-ck="cat.btn.poke"></span></button>
      <button type="button" class="cat-btn cat-btn--swat">${ICON_PAW}<span class="cat-btn-text" data-ck="cat.btn.swat"></span></button>
      <button type="button" class="cat-btn cat-btn--pet">${ICON_PET}<span class="cat-btn-text cat-btn-pet"></span></button>
      <button type="button" class="cat-btn cat-btn--boop">${ICON_BOOP}<span class="cat-btn-text" data-ck="cat.btn.boop"></span></button>
      <button type="button" class="cat-btn cat-btn--treat">${ICON_TREAT}<span class="cat-btn-text" data-ck="cat.btn.treat"></span></button>
      <button type="button" class="cat-btn cat-btn--toy">${ICON_TOY}<span class="cat-btn-text" data-ck="cat.btn.toy"></span></button>
    </div>
    <button type="button" class="cat-more" aria-expanded="false" aria-controls="cat-more">${ICON_MORE}<span class="cat-more-text" data-ck="cat.more"></span></button>
    <div class="cat-more-panel" id="cat-more" hidden>
      <div class="cat-group" role="group" aria-labelledby="cat-g-play"><p class="cat-group-name" id="cat-g-play" data-ck="cat.g.play"></p><div class="cat-group-btns">
        <button type="button" class="cat-btn cat-btn--laser" aria-pressed="false">${ICON_LASER}<span class="cat-btn-text" data-ck="cat.btn.laser"></span></button>
      </div></div>
      <div class="cat-group cat-group--2" role="group" aria-labelledby="cat-g-care"><p class="cat-group-name" id="cat-g-care" data-ck="cat.g.care"></p><div class="cat-group-btns">
        <button type="button" class="cat-btn cat-btn--brush">${ICON_BRUSH}<span class="cat-btn-text" data-ck="cat.btn.brush"></span></button>
        <button type="button" class="cat-btn cat-btn--nip">${ICON_NIP}<span class="cat-btn-text" data-ck="cat.btn.nip"></span></button>
      </div></div>
      <div class="cat-group cat-group--2" role="group" aria-labelledby="cat-g-chat"><p class="cat-group-name" id="cat-g-chat" data-ck="cat.g.chat"></p><div class="cat-group-btns">
        <button type="button" class="cat-btn cat-btn--psst">${ICON_PSST}<span class="cat-btn-text" data-ck="cat.btn.psst"></span></button>
        <button type="button" class="cat-btn cat-btn--blink">${ICON_BLINK}<span class="cat-btn-text" data-ck="cat.btn.blink"></span></button>
      </div></div>
      <div class="cat-group" role="group" aria-labelledby="cat-g-dress"><p class="cat-group-name" id="cat-g-dress" data-ck="cat.g.dress"></p><div class="cat-group-btns">
        <button type="button" class="cat-btn cat-btn--hat">${ICON_HAT}<span class="cat-btn-text" data-ck="cat.btn.hat"></span></button>
      </div></div>
      <div class="cat-group cat-group--2" role="group" aria-labelledby="cat-g-art"><p class="cat-group-name" id="cat-g-art" data-ck="cat.g.art"></p><div class="cat-group-btns">
        <button type="button" class="cat-btn cat-btn--paint">${ICON_PAINT}<span class="cat-btn-text" data-ck="cat.btn.paint"></span></button>
        <button type="button" class="cat-btn cat-btn--book">${ICON_BOOK}<span class="cat-btn-text" data-ck="cat.btn.book"></span></button>
      </div></div>
    </div>
    <p class="cat-tally" hidden><span class="cat-tally-pets"></span> <span class="cat-tally-treats"></span> <span class="cat-tally-art"></span></p>
  </div>
  <p class="cat-say" role="status" aria-live="polite"></p>
`;
/** The complete fragment to put in the page. */
export const CAT_HTML = `<div class="cat" id="cat">${CAT_INNER}</div>`;

// geometry helpers

// closed Catmull-Rom through the control points
function closedSpline(ctrl, step = 1.5) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}
const toPath = (pts, close = true) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
};
const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
const ellipsePts = (rx, ry, n = 16, wob = 0, seed = 1) => {
  const R = rng(seed);
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU, k = 1 + (R() - 0.5) * wob; return [Math.cos(a) * rx * k, Math.sin(a) * ry * k]; });
};

// an offscreen canvas painted in its own units (u = css px per unit). It's painted
// on the cpu (thousands of little strokes sent to the gpu hold up the page's frames,
// scrolling too, while it works through them), then moved onto a plain canvas in
// one go so drawing it every frame stays cheap. With `later` the caller paints
// some more first and settles it itself
function makeSprite(x0, y0, x1, y1, u, dpr, paint, later) {
  const c = document.createElement('canvas');
  const k = u * dpr;
  c.width = Math.max(1, Math.ceil((x1 - x0) * k));
  c.height = Math.max(1, Math.ceil((y1 - y0) * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  paint(g);
  const sp = { c, x0, y0, w: x1 - x0, h: y1 - y0 };
  return later ? sp : settle(sp);
}
function settle(sp) {
  const c = document.createElement('canvas');
  c.width = sp.c.width; c.height = sp.c.height;
  c.getContext('2d').drawImage(sp.c, 0, 0);
  sp.c.width = sp.c.height = 0;
  sp.c = c;
  return sp;
}
const blit = (g, sp, x = 0, y = 0) => g.drawImage(sp.c, x + sp.x0, y + sp.y0, sp.w, sp.h);
// draw a sprite painted in s-units at (x, y)
const blit2 = (g, sp, x, y, s) => g.drawImage(sp.c, x + sp.x0 * s, y + sp.y0 * s, sp.w * s, sp.h * s);

// short hair marks inside a path (used for the plush and the props)
function hairs(g, path, hit, R, { box, n, flow, pick, len = [4, 9], width = [0.5, 1.25], bend = 0.35 }) {
  const [bx0, by0, bx1, by1] = box;
  for (let i = 0; i < n; i++) {
    const x = bx0 + R() * (bx1 - bx0), y = by0 + R() * (by1 - by0);
    if (!hit.isPointInPath(path, x, y)) continue;
    const a = flow(x, y) + (R() - 0.5) * 0.5;
    const pk = pick(x, y, R);
    if (!pk) continue;
    const L = lerp(len[0], len[1], R()) * (pk[2] ?? 1);
    const dx = Math.cos(a) * L, dy = Math.sin(a) * L, b = (R() - 0.5) * L * bend;
    g.strokeStyle = rgba(pk[0], pk[1]);
    g.lineWidth = lerp(width[0], width[1], R());
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + dx * 0.5 - (dy / L) * b, y + dy * 0.5 + (dx / L) * b, x + dx, y + dy);
    g.stroke();
  }
}

// the fur painter
//
// For each part: rasterise the outline, take a distance field to get a soft
// rounded height map (plus a few bumps where there's anatomy under the fur),
// light it like the window is up and to the right, then lay strokes along the
// fur's flow, coloured from that lighting so they keep the form. A fringe of
// hairs round the edge does the silhouette, and catches the rim light on top.
// It comes back as a few jobs, so a big part can be painted over a few idle moments.

const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const KEY = norm3(0.5, -0.74, 0.46);
const FRONT = norm3(0.12, -0.42, 0.9);
// halfway between the window and you, for the sheen
const HALF = norm3(KEY[0], KEY[1], KEY[2] + 1);
// warm light bouncing up off the cream cushion
const BOUNCE = [150, 122, 88];

// smooth value noise from a small table, cheap enough per pixel
const NT = (() => { const R = rng(97), t = new Float32Array(64 * 64); for (let i = 0; i < t.length; i++) t[i] = R(); return t; })();
function noise2(x, y, seed = 0) {
  x += seed * 17.3; y += seed * 7.1;
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = xi & 63, x1 = (xi + 1) & 63, y0 = (yi & 63) << 6, y1 = ((yi + 1) & 63) << 6;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = NT[y0 + x0] + (NT[y0 + x1] - NT[y0 + x0]) * u, b = NT[y1 + x0] + (NT[y1 + x1] - NT[y1 + x0]) * u;
  return a + (b - a) * v;
}
function dist2Seg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const k = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l) : 0;
  const ex = px - ax - dx * k, ey = py - ay - dy * k;
  return ex * ex + ey * ey;
}

function chamfer(d, W, H) {
  const B = 1.4142;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + B);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + B);
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + B);
        if (x > 0) v = Math.min(v, d[i + W - 1] + B);
      }
      d[i] = v;
    }
  }
}

function blurF(a, W, H, r, passes) {
  const tmp = new Float32Array(a.length), n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) {
        tmp[row + x] = acc / n;
        acc += a[row + Math.min(x + r + 1, W - 1)] - a[row + Math.max(x - r, 0)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc / n;
        acc += tmp[Math.min(y + r + 1, H - 1) * W + x] - tmp[Math.max(y - r, 0) * W + x];
      }
    }
  }
}

// strand colours: a tint toward the sheen (light strands), and alpha and width steps
const TINTS = [0, 0.2, 0.34, 0.58];
const ALPHAS = [0.22, 0.34, 0.48, 0.62];
const WIDTHS = [0.34, 0.5, 0.72, 2.3];

function furJobs(g, o) {
  const [x0, y0, x1, y1] = o.box;
  const R = rng(o.seed || 7);
  const decal = o.mask || null;
  const pts = decal ? null : closedSpline(o.outline, 0.7);
  const path = decal ? null : toPath(pts);
  const q = o.q || 1.6;
  const W = Math.ceil((x1 - x0) * q), H = Math.ceil((y1 - y0) * q), N = W * H;
  const ins = new Uint8Array(N), V = new Float32Array(N), RIM = new Float32Array(N);
  let dist = null, alpha = null, area = 0;
  const at = (x, y) => {
    const k = Math.floor((x - x0) * q), j = Math.floor((y - y0) * q);
    return k < 0 || j < 0 || k >= W || j >= H ? -1 : j * W + k;
  };
  const inside = (x, y) => { const i = at(x, y); return i >= 0 && ins[i] === 1; };
  const c = [0, 0, 0];
  const shade = o.shade || coat;

  // the shape and its height map first, then the light on it
  let mc = null, mg = null, h = null, near = null;
  const form = () => {
    mc = document.createElement('canvas');
    mc.width = W; mc.height = H;
    mg = mc.getContext('2d', { willReadFrequently: true });
    h = new Float32Array(N);
    if (decal) {
      // a soft-edged patch laid over a part that's already painted
      alpha = new Float32Array(N);
      for (let j = 0, i = 0; j < H; j++) {
        for (let k = 0; k < W; k++, i++) {
          const m = decal(x0 + (k + 0.5) / q, y0 + (j + 0.5) / q);
          alpha[i] = m;
          if (m > 0.5) { ins[i] = 1; area++; }
          h[i] = (o.base || 0) * q;
        }
      }
    } else {
      mg.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
      mg.fill(path);
      const md = mg.getImageData(0, 0, W, H).data;
      dist = new Float32Array(N);
      for (let i = 0; i < N; i++) { ins[i] = md[i * 4 + 3] > 127 ? 1 : 0; area += ins[i]; dist[i] = ins[i] ? 1e6 : 0; }
      chamfer(dist, W, H);
      const rr = (o.round || 20) * q;
      for (let i = 0; i < N; i++) {
        if (!ins[i]) continue;
        const t = Math.min(1, dist[i] / rr);
        h[i] = rr * Math.sqrt(1 - (1 - t) * (1 - t));
      }
    }
    area /= q * q;
    // anatomy under the fur: round bumps, softer oval ones, and grooves
    const bumps = o.bumps || [], ovals = o.ovals || [], grooves = o.grooves || [];
    if (bumps.length || ovals.length || grooves.length) {
      for (let j = 0, i = 0; j < H; j++) {
        for (let k = 0; k < W; k++, i++) {
          if (!ins[i] && !(alpha && alpha[i] > 0)) continue;
          const x = x0 + (k + 0.5) / q, y = y0 + (j + 0.5) / q;
          const fade = dist ? Math.min(1, dist[i] / ((o.round || 20) * q) * 2.5) : 1;
          let v = 0;
          for (const b of bumps) {
            const dx = x - b[0], dy = y - b[1], r2 = 2 * b[2] * b[2], d2 = dx * dx + dy * dy;
            if (d2 < r2 * 4.5) v += b[3] * fade * Math.exp(-d2 / r2);
          }
          for (const b of ovals) {
            const dx = (x - b[0]) / b[2], dy = (y - b[1]) / b[3], dd = 1 - dx * dx - dy * dy;
            if (dd > 0) v += b[4] * fade * dd * dd;
          }
          for (const gv of grooves) {
            let dmin = 1e9;
            for (let n = 1; n < gv.pts.length; n++) dmin = Math.min(dmin, dist2Seg(x, y, gv.pts[n - 1][0], gv.pts[n - 1][1], gv.pts[n][0], gv.pts[n][1]));
            v -= gv.h * Math.exp(-dmin / (gv.w * gv.w));
          }
          h[i] += v * q;
        }
      }
    }
    blurF(h, W, H, Math.max(1, Math.round(q * 1.3)), 2);
    // a 3px apron round the shape so the clipped edge stays the right colour
    near = ins.slice();
    if (!decal) {
      for (let p = 0; p < 3; p++) {
        const src = near.slice();
        for (let i = W; i < N - W; i++) if (!src[i] && (src[i - 1] || src[i + 1] || src[i - W] || src[i + W])) near[i] = 1;
      }
    }
  };
  const light = () => {
    const [Lx, Ly, Lz] = o.light || KEY;
    const img = mg.createImageData(W, H), px = img.data;
    const rimK = o.rim ?? 1, tone = o.tone ?? 1, amb = o.amb ?? 0.1;
    const kB = o.bounce ?? 0.14, kS = o.sheen ?? 0.26, seed = o.seed || 3;
    for (let j = 1; j < H - 1; j++) {
      for (let k = 1; k < W - 1; k++) {
        const i = j * W + k;
        if (decal ? alpha[i] <= 0.004 : !near[i]) continue;
        const gx = (h[i + 1] - h[i - 1]) * 0.5, gy = (h[i + W] - h[i - W]) * 0.5;
        let nx = -gx, ny = -gy, nz = 1;
        const l = Math.sqrt(nx * nx + ny * ny + 1);
        nx /= l; ny /= l; nz /= l;
        const dif = clamp((nx * Lx + ny * Ly + nz * Lz + 0.3) / 1.3);
        const fil = clamp(-nx * 0.5 - ny * 0.12 + nz * 0.82);
        const e = 1 - nz, nl = Math.sqrt(nx * nx + ny * ny) + 1e-6;
        const rd = clamp((nx * 0.6 - ny * 0.8) / nl);
        const x = x0 + (k + 0.5) / q, y = y0 + (j + 0.5) / q;
        const ao = o.ao ? o.ao(x, y) : 1;
        // a soft mottle, so it reads as fur and not as airbrush
        const mott = 0.9 + 0.2 * noise2(x / 14, y / 14, seed);
        const v = clamp((amb + dif * 0.72 + fil * 0.2) * ao * tone * mott * (o.lum ? o.lum(x, y) : 1));
        const rim = clamp(e * 1.8) ** 2 * rd * rd * rimK * Math.min(1, ao * 1.15) * (o.rimAt ? o.rimAt(x, y) : 1);
        V[i] = v; RIM[i] = rim;
        shade(v, c);
        if (o.paint) o.paint(x, y, v, c);
        const m = Math.min(0.7, rim * 0.62);
        const s1 = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), s2 = s1 * s1, s4 = s2 * s2, sh = s4 * s4 * s2 * kS * ao;
        const bo = Math.max(0, ny) * (1 - nz * 0.5) * kB;
        const p4 = i * 4;
        for (let ch = 0; ch < 3; ch++) px[p4 + ch] = c[ch] + (SHEEN[ch] - c[ch]) * m + SHEEN[ch] * sh + BOUNCE[ch] * bo;
        let a = 255;
        if (decal) a = 255 * alpha[i];
        else if (o.fade) { const fw = o.fade(x, y); if (fw > 0) a = 255 * smooth(0, fw, dist[i] / q); }
        if (o.alphaAt) a *= o.alphaAt(x, y);
        px[p4 + 3] = a;
      }
    }
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.clearRect(0, 0, W, H);
    mg.putImageData(img, 0, 0);
    g.save();
    if (path) g.clip(path);
    g.imageSmoothingEnabled = true;
    g.drawImage(mc, x0, y0, W / q, H / q);
    g.restore();
    h = near = null;
  };

  // strokes, batched by colour so thousands of them stay cheap to paint
  const bins = new Map();
  const add = (v, ti, ai, wi, xa, ya, xc, yc, xb, yb) => {
    const vi = Math.round(clamp(v) * 40);
    const key = ((ti * 41 + vi) * 4 + ai) * 4 + wi;
    let b = bins.get(key);
    if (!b) { b = { key, ti, vi, ai, wi, d: [] }; bins.set(key, b); }
    b.d.push(xa, ya, xc, yc, xb, yb);
  };
  // one stroke is a little clump of 1 to 3 hairs side by side
  const hairAt = (x, y, a, L, v, ti, ai, wi, clump) => {
    const ca = Math.cos(a), sa = Math.sin(a), dx = ca * L, dy = sa * L, b = (R() - 0.5) * L * 0.4;
    const n = 1 + Math.floor(R() * (clump || 1));
    for (let j = 0; j < n; j++) {
      const off = (j - (n - 1) / 2) * 0.85, sx = x - sa * off, sy = y + ca * off;
      add(v, ti, ai, wi, sx, sy, sx + dx * 0.5 - sa * b, sy + dy * 0.5 + ca * b, sx + dx + (R() - 0.5) * 0.4, sy + dy + (R() - 0.5) * 0.4);
    }
  };
  // inside strokes stay inside, so the silhouette is the fringe's job alone
  const flush = (clip) => {
    const order = [...bins.values()].sort((a, b) => a.key - b.key);
    bins.clear();
    g.save();
    if (clip && path) g.clip(path);
    g.lineCap = 'round';
    const wm = o.wmul || 1;
    for (const b of order) {
      shade(b.vi / 40, c);
      const t = TINTS[b.ti];
      g.strokeStyle = rgba([lerp(c[0], SHEEN[0], t), lerp(c[1], SHEEN[1], t), lerp(c[2], SHEEN[2], t)], ALPHAS[b.ai] * (b.wi === 3 ? 0.5 : 1));
      g.lineWidth = WIDTHS[b.wi] * wm;
      g.beginPath();
      const dd = b.d;
      for (let i = 0; i < dd.length; i += 6) { g.moveTo(dd[i], dd[i + 1]); g.quadraticCurveTo(dd[i + 2], dd[i + 3], dd[i + 4], dd[i + 5]); }
      g.stroke();
    }
    g.restore();
  };
  const ok = (x, y, i) => {
    if (i < 0 || !ins[i]) return false;
    if (decal && alpha[i] < 0.6) return false;
    if (o.fade) { const fw = o.fade(x, y); if (fw > 0 && dist[i] / q < fw * 0.75) return false; }
    return !o.keep || o.keep(x, y);
  };
  const [l0, l1] = o.len || [3, 7];
  const lenAt = o.lenAt || (() => 1);
  const pLight = o.lightP ?? 0.36, hi = o.hi ?? 0.28;
  // light strands lean toward the sheen, dark ones sink to about half the local colour
  const strand = (x, y, i, L, ai0, wi, clump) => {
    const v = V[i], rim = RIM[i];
    const a = o.flow(x, y) + (R() - 0.5) * 0.5;
    if (R() < pLight + rim * 0.8) {
      const m = hi * (0.6 + R() * 0.6);
      const ti = rim > 0.3 ? 3 : m > 0.24 ? 2 : 1;
      hairAt(x, y, a, L, v + 0.02, ti, ai0, wi, clump);
    } else {
      hairAt(x, y, a, L, v * (0.42 + R() * 0.2), 0, ai0, wi, clump);
    }
  };
  // long guard hairs over painterly clumps
  const guard = () => {
    const nFine = Math.round(area * (o.density ?? 0.4));
    const nClump = Math.round(area * (o.clump ?? 0.025));
    for (let n = 0; n < nClump; n++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), i = at(x, y);
      if (!ok(x, y, i)) continue;
      const v = V[i] * (0.85 + R() * 0.3);
      hairAt(x, y, o.flow(x, y) + (R() - 0.5) * 0.3, l1 * (1.2 + R() * 0.6) * lenAt(x, y), v, 0, 0, 3, 1);
    }
    for (let n = 0; n < nFine; n++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), i = at(x, y);
      if (!ok(x, y, i)) continue;
      strand(x, y, i, lerp(l0, l1, R()) * lenAt(x, y), Math.floor(R() * 2), R() < 0.6 ? 0 : 1, 2);
    }
    flush(true);
  };
  // then a short soft undercoat over them
  const under = () => {
    const n2 = Math.round(area * (o.density ?? 0.4) * (o.under ?? 0.8));
    for (let n = 0; n < n2; n++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), i = at(x, y);
      if (!ok(x, y, i)) continue;
      strand(x, y, i, lerp(l0, l1, R()) * 0.55 * lenAt(x, y), Math.floor(R() * 2), 0, 2);
    }
    flush(true);
  };
  // the fringe round the silhouette, and whatever the part adds on top
  const edge = () => {
    if (o.fringe && pts) {
      const [f0, f1] = o.fringeLen || [2, 5];
      const nPer = o.fringeN ?? 2, lk = o.lean ?? 0.75;
      for (let p = 0; p < pts.length; p += 2) {
        const [x, y] = pts[p];
        const a0 = pts[(p - 2 + pts.length) % pts.length], a1 = pts[(p + 2) % pts.length];
        let nx = a1[1] - a0[1], ny = -(a1[0] - a0[0]);
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        if (inside(x + nx * 1.5, y + ny * 1.5)) { nx = -nx; ny = -ny; }
        const fl = o.fringe(x, y, nx, ny);
        if (!fl) continue;
        const i = at(x - nx * 2.5, y - ny * 2.5);
        const v = i >= 0 ? V[i] : 0.3, rim = i >= 0 ? RIM[i] : 0;
        const an = Math.atan2(ny, nx), af = o.flow(x, y);
        const lean = clamp(wrapA(af - an), -1.4, 1.4) * lk;
        const cnt = Math.floor(nPer) + (R() < nPer % 1 ? 1 : 0);
        for (let k = 0; k < cnt; k++) {
          const a = an + lean + (R() - 0.5) * 0.7;
          const L = lerp(f0, f1, R()) * fl;
          const lit = R() < 0.25 + rim * 1.5;
          const vv = lit ? v + 0.04 + R() * 0.1 : v * (0.5 + R() * 0.25);
          const sx = x - Math.cos(a) * 1.3, sy = y - Math.sin(a) * 1.3;
          hairAt(sx, sy, a, L + 1.3, vv, lit ? (rim > 0.3 ? 3 : rim > 0.1 ? 2 : 1) : 0, lit ? 2 : 1 + Math.floor(R() * 2), R() < 0.5 ? 0 : 1, 1);
        }
      }
      flush();
    }
    if (o.after) o.after(g, { at, V, RIM, R, path, pts, inside });
  };
  return [form, light, guard, under, edge];
}
function fur(g, o) {
  for (const f of furJobs(g, o)) f();
}

// his parts, in cat units: origin at the centre of the top platform, y down.
// The head and face use head units (HS of them per cat unit).

// the loaf: back sloping down from high hips to the shoulders, chest under the head
const TORSO = [[110, 9], [70, 13], [20, 14], [-40, 14], [-96, 14], [-126, 10], [-141, -6], [-147, -32], [-143, -62], [-128, -88], [-102, -106], [-66, -113], [-30, -107], [4, -99], [34, -96], [58, -98], [80, -94], [100, -82], [114, -60], [120, -34], [118, -10]];
// the thigh, a big round shape over the back of the torso
const HAUNCH = [[-42, 12], [-80, 15], [-118, 12], [-138, 0], [-147, -26], [-144, -56], [-130, -82], [-106, -98], [-78, -97], [-58, -82], [-46, -58], [-40, -32], [-37, -8]];
// his chest, under the head
const CHEST = [[60, -86], [88, -95], [114, -89], [130, -71], [139, -46], [137, -20], [129, 0], [115, 12], [94, 15], [74, 11], [60, -4], [54, -30], [53, -60]];
const NECK = ellipsePts(27, 36, 18, 0.08, 4);
// a round, full-cheeked head
const SKULL = [[0, -45], [17, -43], [31, -37], [41, -27], [47, -13], [51, 1], [55, 11], [58, 19], [53, 27], [43, 35], [28, 41], [13, 45], [0, 46.5], [-13, 45], [-28, 41], [-43, 35], [-53, 27], [-58, 19], [-55, 11], [-51, 1], [-47, -13], [-41, -27], [-31, -37], [-17, -43]];
// his left ear (screen left); the other one is its mirror
const EAR_L = [[-19, 5], [-20, -6], [-17, -18], [-12, -29], [-6, -37], [-1.5, -41], [2, -39], [5.5, -31], [10, -19], [14, -7], [17, 5]];
const EAR_L_IN = [[-12, 3], [-13, -7], [-10.5, -18], [-6.5, -27], [-2, -33], [1, -30], [4.5, -20], [8.5, -9], [10.5, 3]];
const LEG = [[-6, -11.5], [14, -11.5], [32, -10.5], [47, -9], [56, -7], [60, 0], [56, 7], [47, 9], [32, 10.5], [14, 11.5], [-6, 11.5], [-10, 0]];
const PAW = [[-13, 0], [-12, -8], [-4, -11.5], [4, -11.5], [10, -10.5], [14.5, -7.5], [17.5, -3.6], [18.5, 0], [17.5, 3.6], [14.5, 7.5], [10, 10.5], [4, 11.5], [-4, 11.5], [-12, 8]];
const PAW_TUCK = [[-15, 1], [-16, -5], [-12, -11], [-3, -13.5], [7, -13], [13.5, -10.5], [17, -5.5], [17.5, 0.5], [11, 3], [-5, 3]];

const HS = 1.06;
const HEAD_REST = [102, -97];
// the right edge of his face (cheek fur and whiskers) at rest, turned to look right
const HEAD_RIGHT = 180;
const NECK_PIVOT = [78, -58];
const SHOULDER_N = [94, -34];
const SHOULDER_F = [74, -30];
const PAW_N = [114, 13];
const PAW_F = [80, 12];
const TAIL_ROOT = [-126, 6];
// where the eyes sit in head units (for the eye-sized pieces)
const EYE_W = 12.5, EYE_H = 10.4;

// top of the back, per column, for the flow field
function topLine(outline) {
  const pts = closedSpline(outline, 1);
  const top = new Float32Array(360).fill(1e9);
  for (const [x, y] of pts) { const i = Math.round(x) + 180; if (i >= 0 && i < 360 && y < top[i]) top[i] = y; }
  for (let i = 1; i < 360; i++) if (top[i] > 1e8) top[i] = top[i - 1];
  for (let i = 358; i >= 0; i--) if (top[i] > 1e8) top[i] = top[i + 1];
  return (x) => top[clamp(Math.round(x) + 180, 0, 359)];
}

// fur over the hip turns round in a whorl, then runs down the back of the thigh
const HIP = [-100, -50];
const angMix = (a, wa, b, wb) => Math.atan2(Math.sin(a) * wa + Math.sin(b) * wb, Math.cos(a) * wa + Math.cos(b) * wb);
function hipFlow(x, y, base) {
  const hx = x - HIP[0], hy = y - HIP[1], hr = Math.hypot(hx, hy) || 1;
  const wrap = Math.atan2(-hx / hr + (hy / hr) * 0.3, hy / hr + (hx / hr) * 0.3);
  const w = smooth(64, 18, hr);
  return angMix(wrap, w, base, 1 - w * 0.85);
}

const BACK_Y = topLine(TORSO);
function torsoFlow(x, y) {
  const by = BACK_Y(x), v = clamp((y - by) / Math.max(20, 12 - by));
  let a = Math.PI - 0.22 - 1.0 * v;
  a -= smooth(-96, -146, x) * (0.9 - 0.4 * v);
  a += smooth(70, 116, x) * 0.9 * v;
  return a;
}

function paintTorso(g, q) {
  return furJobs(g, {
    box: [-160, -126, 132, 24], outline: TORSO, seed: 11, round: 44, q,
    bumps: [[56, -84, 20, 7], [6, -50, 44, 10], [88, -12, 15, 5], [-60, -96, 26, 5]],
    ao: (x, y) => (1 - 0.6 * smooth(-40, 14, y)) * (1 - 0.18 * smooth(60, 116, x) * smooth(-70, -10, y)),
    flow: (x, y) => hipFlow(x, y, torsoFlow(x, y)),
    len: [5, 9], density: 0.5, clump: 0.03,
    fringe: (x, y) => (y > 2 ? 0 : 1), fringeLen: [0.9, 2.8], fringeN: 1.6, lean: 0.9,
    after: (g) => {
      // the crease in front of his thigh
      for (let k = 0; k <= 8; k++) { const u = k / 8; stamp(g, lerp(-58, -34, u) + 4, lerp(-82, 6, u), 9, FUR_DARK, 0.18, 0.3); }
      // a light, broken ink line along his back, like the rest of the room
      const top = closedSpline(TORSO, 3).filter(([x, y]) => x < 74 && x > -132 && y < -60).sort((p, q) => q[0] - p[0]);
      stroke(g, { pts: top.map(([x, y]) => [x, y + 1.2]), width: 2.2, dry: 0.86, tone: 0.42, bleed: 0.06, rgb: INKC, seed: 21, bristles: 5 });
    },
  });
}

function paintHaunch(g, q) {
  return furJobs(g, {
    box: [-160, -112, -26, 26], outline: HAUNCH, seed: 12, round: 34, q,
    bumps: [[-100, -50, 30, 9], [-118, -78, 18, 4]],
    ao: (x, y) => (1 - 0.55 * smooth(-30, 14, y)) * (1 - 0.22 * smooth(-70, -42, x)),
    // the window only catches the outside edge, where it's also his silhouette
    rimAt: (x, y) => 0.08 + 0.92 * smooth(-124, -138, x) * smooth(-10, -40, y),
    // the top and front melt into his body, so the thigh reads by its shape and its whorl
    fade: (x, y) => (x > -134 && y < -14 ? 8 : x > -60 ? 5 : 0),
    flow: (x, y) => hipFlow(x, y, Math.PI - 0.35 - 0.9 * clamp((y + 96) / 100)),
    len: [5, 9], density: 0.5, clump: 0.03,
    fringe: (x, y) => (y > 2 || x > -132 ? 0 : 1), fringeLen: [0.9, 2.8], fringeN: 1.6, lean: 0.9,
    after: (g) => {
      stroke(g, { pts: [[-128, -86], [-140, -66], [-146, -36], [-140, -6]], width: 2.2, dry: 0.8, tone: 0.32, bleed: 0.06, rgb: INKC, seed: 23, bristles: 5 });
    },
  });
}

function paintChest(g, q) {
  const jobs = furJobs(g, {
    box: [46, -104, 148, 24], outline: CHEST, seed: 13, round: 26, tone: 1.06, q,
    bumps: [[108, -36, 24, 7]],
    ao: (x, y) => (1 - 0.45 * smooth(-14, 14, y)) * (0.86 + 0.14 * smooth(-80, -50, y)),
    flow: (x, y) => Math.PI / 2 + (x - 100) * 0.012 - smooth(-90, -60, y) * 0.5,
    len: [5, 9.5], density: 0.55, clump: 0.04,
    lenAt: (x, y) => 0.8 + 0.5 * smooth(-60, 0, y),
    rimAt: (x) => 0.15 + 0.85 * smooth(86, 106, x),
    fringe: (x, y) => (x < 84 && y < 0 ? 0 : y > -30 ? 1.3 : 0.8), fringeLen: [1.8, 4.6], fringeN: 2,
  });
  // melt the back edge into his body
  jobs.push(() => {
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(50, 0, 94, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(46, -104, 48, 128);
    g.globalCompositeOperation = 'source-over';
  });
  return jobs;
}

function paintNeck(g) {
  fur(g, {
    box: [-34, -44, 34, 44], outline: NECK, seed: 14, round: 18, tone: 0.92, rimAt: () => 0.1,
    flow: (x, y) => Math.PI / 2 + 0.3 + x * 0.01,
    len: [3, 6], density: 0.4, clump: 0.03,
    fringe: () => 1, fringeLen: [1.6, 4],
  });
}

function paintSkull(g, q) {
  return furJobs(g, {
    box: [-66, -54, 66, 56], outline: SKULL, seed: 31, round: 32, q,
    bumps: [[-32, 18, 15, 4], [32, 18, 15, 4], [0, -20, 24, 5], [0, 14, 16, 3]],
    ao: (x, y) => 1 - 0.06 * smooth(26, 48, y),
    // the lower cheeks and chin are a touch lighter, so his face doesn't end in a dark band
    lum: (x, y) => 1 + 0.1 * smooth(14, 40, y) * (1 - 0.4 * smooth(30, 50, Math.abs(x))),
    flow: (x, y) => Math.atan2(y - 16, x) + (y < 0 ? 0.1 * Math.sign(x) : 0) + (Math.abs(x) > 34 && y > 0 ? 0.25 * Math.sign(x) : 0),
    len: [3, 6], density: 0.6, clump: 0.025,
    // short and fine over the face, a little fuller on the cheeks
    lenAt: (x, y) => (Math.abs(x) > 40 && y > 0 ? 1.15 : 1) * (1 - 0.3 * smooth(34, 18, Math.abs(x)) * smooth(-30, -16, y) * smooth(34, 22, y)),
    fringe: (x, y) => (Math.abs(x) > 40 && y > 4 && y < 34 ? 1 : 0.7),
    fringeLen: [1.2, 2.6], fringeN: 2, lean: 1,
  });
}

function earShape(side) { return side < 0 ? EAR_L : mirror(EAR_L); }
function earInner(side) { return side < 0 ? EAR_L_IN : mirror(EAR_L_IN); }

// a soft mask of a path on a little grid, sampled by unit coordinates
function maskOf(path, x0, y0, x1, y1, q, blur) {
  const W = Math.ceil((x1 - x0) * q), H = Math.ceil((y1 - y0) * q);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
  g.fill(path);
  const d = g.getImageData(0, 0, W, H).data, a = new Float32Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  if (blur) blurF(a, W, H, Math.max(1, Math.round(blur * q)), 2);
  return (x, y) => a[clamp(Math.floor((y - y0) * q), 0, H - 1) * W + clamp(Math.floor((x - x0) * q), 0, W - 1)];
}

function paintEarFront(g, side) {
  const inner = toPath(closedSpline(earInner(side), 0.5));
  const cup = maskOf(inner, -26, -48, 26, 10, 3, 1.4);
  const pink = mix(EAR_IN, [170, 150, 160], 0.2);
  const R2 = rng(57 + side);
  fur(g, {
    box: [-26, -48, 26, 10], outline: earShape(side), seed: 51 + side, round: 7, tone: 0.95,
    // the inside is a cup: lit on the wall that faces the window, deep at the bottom
    ovals: [[-side * 0.5, -13, 9, 17, -6]],
    paint: (x, y, v, c) => {
      const m = cup(x, y);
      if (m <= 0.01) return;
      const k = (0.42 + v * 0.95) * (1 - 0.45 * smooth(-8, 4, y));
      mix3(c, pink, k, m);
    },
    keep: (x, y) => cup(x, y) < 0.2,
    flow: (x) => -Math.PI / 2 - x * 0.025, len: [2, 4], density: 0.7, clump: 0.02, lightP: 0.4,
    fringe: (x, y) => (y < 2 ? 1 : 0), fringeLen: [1.2, 3.2],
    after: (g) => {
      // the furnishings: pale tufts growing from inside
      g.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const u = R2();
        const x = lerp(-side * 9, side * 6, R2()) * (1 - u * 0.5), y = 2 - u * 22;
        const a = -Math.PI / 2 + side * (0.15 + R2() * 0.5) * (R2() < 0.3 ? -1 : 1);
        const L = 4 + R2() * 8;
        g.strokeStyle = rgba([214, 214, 226], 0.25 + R2() * 0.35);
        g.lineWidth = 0.35 + R2() * 0.3;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + side * 1.5, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
      g.strokeStyle = rgba(FUR_DARK, 0.3); g.lineWidth = 0.6;
      g.stroke(inner);
      earInk(g, side, 51);
    },
  });
}
// a dry-brush ink line up one side of the ear and down the other, like the room's outlines
function earInk(g, side, seed) {
  const pts = earShape(side).slice(1, -1).map(([x, y]) => [x * 0.97, y * 0.98 + 0.3]);
  stroke(g, { pts, width: 1.3, dry: 0.55, tone: 0.55, bleed: 0.05, rgb: INKC, seed: seed + side, bristles: 5 });
}
const mix3 = (c, rgb, k, m) => { for (let i = 0; i < 3; i++) c[i] += (rgb[i] * k - c[i]) * m; };

function paintEarBack(g, side) {
  fur(g, {
    box: [-26, -48, 26, 10], outline: earShape(side), seed: 61 + side, round: 9, tone: 0.82,
    flow: (x) => -Math.PI / 2 + x * 0.02, len: [2, 4.5], density: 0.7, clump: 0.03,
    fringe: (x, y) => (y < 2 ? 1 : 0), fringeLen: [1.2, 3.2],
    after: (g) => earInk(g, side, 61),
  });
}
// a copy of an ear with its base faded, for when it comes round in front of his head
function fadedBase(sp) {
  const c = document.createElement('canvas');
  c.width = sp.c.width; c.height = sp.c.height;
  const g = c.getContext('2d');
  g.drawImage(sp.c, 0, 0);
  const k = c.height / sp.h;
  const gr = g.createLinearGradient(0, (10 - sp.y0) * k, 0, (-9 - sp.y0) * k);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  return { c, x0: sp.x0, y0: sp.y0, w: sp.w, h: sp.h };
}

// the face is a few soft patches laid over the skull where they turn with him:
// the muzzle round the nose, and a socket and brow round each eye
const ell = (x, y, cx, cy, rx, ry) => { const dx = (x - cx) / rx, dy = (y - cy) / ry; return Math.sqrt(dx * dx + dy * dy); };
const PADS = [[-8.2, 6.4], [8.2, 6.4]];
function padAt(x, y) {
  let m = 0;
  for (const [px, py] of PADS) m = Math.max(m, 1 - ell(x, y, px, py, 11, 8.5) ** 2);
  return clamp(m);
}
// whisker pads, the bridge of the nose, the lip line; origin at the nose
function paintMuzzle(g) {
  const R = rng(41);
  fur(g, {
    box: [-26, -32, 26, 26], seed: 41, q: 3.2, base: 0, tone: 1,
    // the pads and the bridge only, so an open mouth isn't covered up
    mask: (x, y) => Math.max(
      smooth(1, 0.55, Math.min(ell(x, y, -8.2, 5.6, 13.5, 9.6), ell(x, y, 8.2, 5.6, 13.5, 9.6))),
      smooth(1, 0.5, ell(x, y, 0, -9, 6.4, 18))),
    ovals: [[-8.6, 6, 10.5, 8.5, 6.5], [8.6, 6, 10.5, 8.5, 6.5], [0, -8, 6, 14, 2.5], [0, 15, 9, 5, 1.2]],
    grooves: [{ pts: [[0, 2.6], [0, 6.6]], w: 1.1, h: 1.4 }, { pts: [[-8.5, 8.6], [-4.4, 9.8], [0, 6.8], [4.4, 9.8], [8.5, 8.6]], w: 1.3, h: 1.6 }],
    lum: (x, y) => 1 + 0.3 * padAt(x, y) + 0.06 * (1 - clamp(ell(x, y, 0, -8, 4, 14))),
    flow: (x, y) => (y > -2 ? Math.atan2(y - 3, x) : -Math.PI / 2 + x * 0.05),
    len: [1.4, 3], density: 0.75, clump: 0, under: 0.6, lightP: 0.45, hi: 0.32,
    after: (g) => {
      // where the whiskers grow from
      g.fillStyle = rgba(FUR_DARK, 0.5);
      for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        if (c === 3 && r === 0) continue;
        g.beginPath();
        g.arc(sx * (5.6 + c * 2.4 + R() * 0.5), 5.4 + r * 2.2 + c * 0.5, 0.5, 0, TAU);
        g.fill();
      }
    },
  });
}

// the chin, which drops when he opens his mouth
function paintChin(g) {
  fur(g, {
    box: [-14, -6, 14, 14], seed: 43, q: 3.2, base: 0,
    mask: (x, y) => smooth(1, 0.5, ell(x, y, 0, 3.6, 11, 8)),
    ovals: [[0, 3.6, 9, 6.5, 2.2]],
    lum: () => 1.12,
    flow: (x) => Math.PI / 2 + x * 0.06,
    len: [1.5, 3.2], density: 0.8, clump: 0, under: 0.5, lightP: 0.42,
  });
}

// round each eye: a soft hollow for the eye, the brow ridge catching the light above it
function paintSocket(g, side) {
  fur(g, {
    box: [-24, -27, 24, 15], seed: 47 + side, q: 3, base: 0,
    mask: (x, y) => smooth(1, 0.6, ell(x, y, 0, -5, 21, 18)),
    ovals: [[0, 0.6, 15, 11, -4.5], [side * 2.5, -14, 14, 6, 3.6]],
    lum: (x, y) => 1 + 0.1 * smooth(-6, -14, y),
    // up and out over the brow, out and down under the eye
    flow: (x, y) => (y < -6 ? -Math.PI / 2 + side * 0.5 + x * 0.015 : side > 0 ? 0.45 + y * 0.01 : Math.PI - 0.45 - y * 0.01),
    len: [1.4, 3.2], density: 0.7, clump: 0, under: 0.5,
    keep: (x, y) => ell(x, y, 0, 0, EYE_W + 1.5, EYE_H * 0.9 + 1.5) > 1,
  });
}

// green, a darker ring, a lighter ring round the pupil, and light pooling low
function paintIris(g) {
  const R = rng(45);
  const gr = g.createRadialGradient(0, 1.5, 0.5, 0, 0, 10);
  gr.addColorStop(0, 'rgb(206,206,112)');
  gr.addColorStop(0.32, 'rgb(162,190,92)');
  gr.addColorStop(0.66, 'rgb(98,152,76)');
  gr.addColorStop(0.88, 'rgb(58,108,62)');
  gr.addColorStop(1, 'rgb(28,48,34)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
  g.save();
  g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.clip();
  stamp(g, 0.5, 5.5, 6.5, [224, 232, 150], 0.4, 0.3);
  g.lineCap = 'round';
  for (let i = 0; i < 130; i++) {
    const a = R() * TAU, r0 = 2.4 + R() * 2, r1 = 6.5 + R() * 3.2;
    g.strokeStyle = R() < 0.5 ? rgba([226, 232, 160], 0.14 + R() * 0.14) : rgba([30, 60, 34], 0.14 + R() * 0.16);
    g.lineWidth = 0.25 + R() * 0.35;
    const a1 = a + (R() - 0.5) * 0.2;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(18,30,22,.75)';
  g.lineWidth = 1.3;
  g.beginPath(); g.arc(0, 0, 9.4, 0, TAU); g.stroke();
}

// the nose leather: light on top where the window catches it, darker underneath
function paintNose(g) {
  const p = new Path2D();
  p.moveTo(-4.8, -2.6);
  p.quadraticCurveTo(0, -4.4, 4.8, -2.6);
  p.quadraticCurveTo(5.4, -1.6, 4.2, 0.2);
  p.quadraticCurveTo(2, 2.6, 0.7, 3.4);
  p.quadraticCurveTo(0, 3.8, -0.7, 3.4);
  p.quadraticCurveTo(-2, 2.6, -4.2, 0.2);
  p.quadraticCurveTo(-5.4, -1.6, -4.8, -2.6);
  const gr = g.createLinearGradient(0, -4, 0, 4);
  gr.addColorStop(0, 'rgb(112,110,126)');
  gr.addColorStop(0.55, 'rgb(80,78,92)');
  gr.addColorStop(1, 'rgb(50,48,60)');
  g.fillStyle = gr;
  g.fill(p);
  g.fillStyle = 'rgba(26,24,32,.85)';
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 2.3, 0.4, 1.1, 0.7, sx * 0.5, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(214,214,228,.55)';
  g.beginPath(); g.ellipse(-1.2, -2.4, 1.6, 0.6, -0.1, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(22,20,28,.7)'; g.lineWidth = 0.5;
  g.stroke(p);
}

function paintLeg(g) {
  fur(g, {
    box: [-12, -16, 64, 16], outline: LEG, seed: 71, round: 9, light: FRONT, tone: 0.95,
    flow: (x, y) => 0.12 * Math.sign(y), len: [2.5, 5], density: 0.7, clump: 0.03,
    fringe: (x) => (x > 2 ? 1 : 0), fringeLen: [1.4, 3.4],
  });
  // fade the root so it melts into the chest
  g.globalCompositeOperation = 'destination-out';
  const gr = g.createLinearGradient(-10, 0, 14, 0);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(-12, -16, 26, 32);
  g.globalCompositeOperation = 'source-over';
}

function paintPaw(g, beans) {
  fur(g, {
    box: [-18, -16, 23, 16], outline: PAW, seed: beans ? 73 : 72, round: 8, light: FRONT, tone: beans ? 0.85 : 1.05,
    flow: (x, y) => 0.25 * Math.sign(y) * smooth(4, 16, x), len: [2, 4], density: 0.8, clump: 0.02,
    fringe: () => 1, fringeLen: [1, 2.6],
    after: (g) => {
      g.lineCap = 'round';
      if (beans) {
        // toe beans, and the big pad
        g.fillStyle = rgba(BEAN, 1);
        g.beginPath();
        g.moveTo(-6, -4); g.quadraticCurveTo(-1, -8, 4, -4.5); g.quadraticCurveTo(7, 0, 4, 4.5); g.quadraticCurveTo(-1, 8, -6, 4); g.quadraticCurveTo(-8.5, 0, -6, -4);
        g.fill();
        for (const [bx, by, r] of [[9, -7.2, 2.7], [12.6, -2.6, 2.8], [12.6, 2.6, 2.8], [9, 7.2, 2.7]]) {
          g.beginPath(); g.ellipse(bx, by, r, r * 0.86, 0, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(232,196,206,.55)';
        g.beginPath(); g.ellipse(-1, -2.4, 3, 1.6, -0.3, 0, TAU); g.fill();
        for (const [bx, by] of [[9, -7.2], [12.6, -2.6], [12.6, 2.6], [9, 7.2]]) { g.beginPath(); g.arc(bx - 0.6, by - 0.8, 0.9, 0, TAU); g.fill(); }
      } else {
        g.strokeStyle = rgba(FUR_DARK, 0.85); g.lineWidth = 0.9;
        for (const [ax, ay, bx, by] of [[9, -5.6, 16.4, -3.4], [10, 0, 18, 0], [9, 5.6, 16.4, 3.4]]) { g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2 + 1, (ay + by) / 2, bx, by); g.stroke(); }
        g.strokeStyle = rgba(SHEEN, 0.3); g.lineWidth = 1;
        g.beginPath(); g.moveTo(-6, -9.5); g.quadraticCurveTo(6, -12, 14, -7); g.stroke();
      }
    },
  });
}

function paintTuck(g, far) {
  fur(g, {
    box: [-22, -20, 24, 7], outline: PAW_TUCK, seed: far ? 75 : 74, round: 8, tone: far ? 0.8 : 1.05,
    ao: (x, y) => 1 - 0.4 * smooth(-4, 3, y),
    flow: (x, y) => 0.15 + smooth(4, 16, x) * 1.2, len: [2, 4], density: 0.8, clump: 0.02,
    fringe: (x, y) => (y < 0 ? 1 : 0.4), fringeLen: [1, 2.6],
    after: (g) => {
      g.lineCap = 'round';
      g.strokeStyle = rgba(FUR_DARK, far ? 0.7 : 0.85); g.lineWidth = 0.9;
      for (const x of [7, 11, 14.6]) { g.beginPath(); g.moveTo(x - 1, -9.5 + (x - 7) * 0.4); g.quadraticCurveTo(x + 0.4, -4, x - 0.2, 1.5); g.stroke(); }
      g.strokeStyle = rgba(SHEEN, far ? 0.18 : 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(-10, -11); g.quadraticCurveTo(2, -14.5, 13, -10); g.stroke();
    },
  });
}

// the tail, painted straight along +x and bent along a chain when drawn;
// local up becomes his right side when it hangs, so the light still works
const TAIL_LEN = 153;
function paintTail(g) {
  const top = [], bot = [];
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * (TAIL_LEN + 4), r = lerp(12.5, 8.6, i / 12) * (i === 12 ? 0.75 : 1);
    top.push([x, -r]); bot.unshift([x, r]);
  }
  return furJobs(g, {
    box: [-8, -18, TAIL_LEN + 22, 18], outline: [[-6, 0], ...top, [TAIL_LEN + 14, 0], ...bot], seed: 81, round: 11,
    light: norm3(0.05, -0.78, 0.62), rim: 0.8,
    ao: (x) => 1 - 0.25 * smooth(20, -6, x),
    flow: (x, y) => y * 0.025, len: [3.4, 7], density: 0.6, clump: 0.04,
    lenAt: (x) => 1 + smooth(TAIL_LEN - 30, TAIL_LEN + 10, x) * 0.6,
    fringe: (x) => (x < 4 ? 0 : x > TAIL_LEN - 6 ? 2 : 1), fringeLen: [1.4, 3.6], fringeN: 1.8,
  });
}

// his sprites, painted once per layout (u = css px per cat unit), a job at a
// time so the painting can be spread over a few idle moments
function* catGen(u, dpr, out) {
  const hu = u * HS, q = 1.6;
  function* big(key, box, uu, paint) {
    let jobs = null;
    out[key] = makeSprite(box[0], box[1], box[2], box[3], uu, dpr, (g) => { jobs = paint(g); }, true);
    for (const j of jobs) { j(); yield; }
    settle(out[key]);
  }
  yield* big('torso', [-160, -126, 132, 24], u, (g) => paintTorso(g, 1.3));
  yield* big('haunch', [-160, -112, -26, 26], u, (g) => paintHaunch(g, 1.3));
  yield* big('chest', [46, -104, 148, 24], u, (g) => paintChest(g, q));
  yield* big('skull', [-66, -54, 66, 56], hu, (g) => paintSkull(g, q));
  out.neck = makeSprite(-34, -44, 34, 44, u, dpr, paintNeck);
  yield;
  out.muzzle = makeSprite(-26, -32, 26, 26, hu, dpr, paintMuzzle);
  yield;
  out.chin = makeSprite(-14, -6, 14, 14, hu, dpr, paintChin);
  out.nose = makeSprite(-6.5, -5.5, 6.5, 5, hu * 2, dpr, paintNose);
  out.iris = makeSprite(-11, -11, 11, 11, hu * 1.4, dpr, paintIris);
  yield;
  out.sockL = makeSprite(-24, -27, 24, 15, hu, dpr, (g) => paintSocket(g, -1));
  out.sockR = makeSprite(-24, -27, 24, 15, hu, dpr, (g) => paintSocket(g, 1));
  yield;
  out.earFL = makeSprite(-26, -48, 26, 10, hu, dpr, (g) => paintEarFront(g, -1));
  out.earFR = makeSprite(-26, -48, 26, 10, hu, dpr, (g) => paintEarFront(g, 1));
  out.earFLf = fadedBase(out.earFL);
  out.earFRf = fadedBase(out.earFR);
  yield;
  out.earBL = makeSprite(-26, -48, 26, 10, hu, dpr, (g) => paintEarBack(g, -1));
  out.earBR = makeSprite(-26, -48, 26, 10, hu, dpr, (g) => paintEarBack(g, 1));
  yield;
  out.leg = makeSprite(-12, -16, 64, 16, u, dpr, paintLeg);
  out.pawT = makeSprite(-18, -16, 23, 16, u, dpr, (g) => paintPaw(g, false));
  out.pawB = makeSprite(-18, -16, 23, 16, u, dpr, (g) => paintPaw(g, true));
  yield;
  out.tuckN = makeSprite(-22, -20, 24, 7, u, dpr, (g) => paintTuck(g, false));
  out.tuckF = makeSprite(-22, -20, 24, 7, u, dpr, (g) => paintTuck(g, true));
  yield;
  yield* big('tail', [-8, -18, TAIL_LEN + 22, 18], u, paintTail);
}
function catSprites(u, dpr) {
  const out = {};
  for (const x of catGen(u, dpr, out)) void x;
  return out;
}

// a pose: every channel the rig understands, at rest
function restPose(o = {}) {
  return Object.assign(o, {
    bx: 0, by: 0, lift: 0, breath: 0, rumpY: 0, rumpA: 0,
    hx: 0, hy: 0, yaw: 0.22, pitch: 0.05, roll: 0,
    earFL: 0, earFR: 0, earSL: 0, earSR: 0, earTL: 0, earTR: 0,
    lidU: 0.04, lidL: 0.04, happy: 0, joy: 0, brow: 0, pupil: 0.3, gx: 0, gy: 0,
    jaw: 0, tongue: 0, lick: 0, fangs: 0, grin: 0, noseTw: 0, whisk: 0, chew: 0, wrinkle: 0,
    nUp: 0, nX: PAW_N[0], nY: PAW_N[1], nBeans: 0, nRot: 0,
    fUp: 0, fX: PAW_F[0], fY: PAW_F[1], fBeans: 0, fRot: 0,
    tPh: 0, tAmp: 0.12, tCurl: 0.5, tLift: 0, tFlick: 0, puff: 0,
  });
}

// a point on his face (lon/lat on a sphere of radius r, in head units),
// seen with the head's yaw and pitch; also the surface's east and south
// directions there, so flat things (eyes, nose) can be drawn on it
const FP = { x: 0, y: 0, z: 0, nx: 0, ny: 0, ex: 0, ey: 0, sx: 0, sy: 0 };
function faceProj(lon, lat, r, yaw, pitch) {
  const a = lon + yaw, ca = Math.cos(a), sa = Math.sin(a), cl = Math.cos(lat), sl = Math.sin(lat);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const X = sa * cl, Y = -sl, Z = ca * cl;
  FP.nx = X; FP.ny = Y * cp + Z * sp; FP.z = -Y * sp + Z * cp;
  FP.x = FP.nx * r; FP.y = FP.ny * r;
  FP.ex = ca; FP.ey = -sa * sp;
  FP.sx = sa * sl; FP.sy = cl * cp + ca * sl * sp;
}
const FACE_R = 44;
const EYE_LON = 0.47, EYE_LAT = 0.06;
const NOSE_LAT = -0.27;

// where his head is: a 2D matrix from head units to cat units
const HM = new Float64Array(6);
function headMatrix(P) {
  const ang = P.pitch * 0.32;
  const vx = HEAD_REST[0] - NECK_PIVOT[0], vy = HEAD_REST[1] - NECK_PIVOT[1];
  const c = Math.cos(ang), s = Math.sin(ang);
  const cx = NECK_PIVOT[0] + P.bx + vx * c - vy * s + P.hx;
  const cy = NECK_PIVOT[1] + P.by - P.lift + vx * s + vy * c + P.hy + P.breath * 1.2;
  const cr = Math.cos(P.roll) * HS, sr = Math.sin(P.roll) * HS;
  HM[0] = cr; HM[1] = sr; HM[2] = -sr; HM[3] = cr; HM[4] = cx; HM[5] = cy;
  return HM;
}
// head units to cat units, and back
const PT = { x: 0, y: 0 };
function headToCat(x, y) { PT.x = HM[4] + HM[0] * x + HM[2] * y; PT.y = HM[5] + HM[1] * x + HM[3] * y; return PT; }
function catToHead(x, y) {
  const det = HM[0] * HM[3] - HM[1] * HM[2], dx = x - HM[4], dy = y - HM[5];
  PT.x = (HM[3] * dx - HM[2] * dy) / det; PT.y = (-HM[1] * dx + HM[0] * dy) / det;
  return PT;
}
// a face point straight to cat units (for paws reaching his mouth, treats, etc.)
// (with the same limits on the turn and the nod that drawHead uses)
function facePoint(P, lon, lat, r) {
  headMatrix(P);
  const yw = clamp(P.yaw, -FACE_YAW, FACE_YAW), pc = clamp(P.pitch, FACE_UP, FACE_DOWN);
  faceProj(lon, lat, r, yw, pc);
  return headToCat(FP.x + yw * 2.5 + (P.yaw - yw) * 9, FP.y + pc * 2 + (P.pitch - pc) * 12);
}
// a point in head units to cat units, shifted the way drawHead shifts the face
function headPoint(P, x, y) {
  headMatrix(P);
  const yw = clamp(P.yaw, -FACE_YAW, FACE_YAW), pc = clamp(P.pitch, FACE_UP, FACE_DOWN);
  return headToCat(x + (P.yaw - yw) * 9, y + (P.pitch - pc) * 12);
}

// the tail bends along its length as one smooth curve, sampled finely so the
// slices of the sprite never open up into notches on the outside of a bend
const TAIL_N = 15, TAIL_SEG = 10.2, TAIL_M = 45, TAIL_DS = (TAIL_N * TAIL_SEG) / TAIL_M;
const tailX = new Float32Array(TAIL_M + 1), tailY = new Float32Array(TAIL_M + 1), tailA = new Float32Array(TAIL_M);
// how thick it is along its length (with the fur), for things that bump into it
const tailR = (u) => lerp(13, 9.5, u);
function tailChain(P) {
  let x = TAIL_ROOT[0] + P.bx * 0.4, y = TAIL_ROOT[1] + P.rumpY * 0.5;
  tailX[0] = x; tailY[0] = y;
  // pushed aside by something: everything past the spot it was pushed at swings over
  const bend = P.tBend || 0, bu = P.tBendU || 0.5;
  for (let i = 0; i < TAIL_M; i++) {
    const u = (i + 0.75) / TAIL_M;
    let a = Math.PI / 2 + 0.55 * (1 - smooth(0, 0.3, u)) + P.tLift * (1 - u) * 0.9;
    a += P.tAmp * Math.sin(P.tPh - u * 2.6) * smooth(0.08, 1, u);
    a -= P.tCurl * smooth(0.55, 1, u) * 1.55;
    a += P.tFlick * smooth(0.5, 1, u);
    if (bend) a += bend * smooth(bu - 0.35, bu, u);
    tailA[i] = a;
    x += Math.cos(a) * TAIL_DS; y += Math.sin(a) * TAIL_DS;
    tailX[i + 1] = x; tailY[i + 1] = y;
  }
}

// thin slices of the straight tail sprite along the curve, tip first so the base sits on top
function drawTail(g, SP, P) {
  tailChain(P);
  const sp = SP.tail, k = sp.c.width / sp.w, ov = 1.1, puff = P.puff || 0;
  for (let i = TAIL_M - 1; i >= 0; i--) {
    const xa = i === 0 ? sp.x0 : i * TAIL_DS - ov, xb = i === TAIL_M - 1 ? sp.x0 + sp.w : (i + 1) * TAIL_DS + ov;
    g.save();
    g.translate(tailX[i], tailY[i]);
    g.rotate(tailA[i]);
    // all fluffed up, bottle-brush style
    if (puff > 0.01) g.scale(1, 1 + 0.5 * puff * smooth(0, 0.3, (i + 0.5) / TAIL_M));
    g.drawImage(sp.c, (xa - sp.x0) * k, 0, (xb - xa) * k, sp.c.height, xa - i * TAIL_DS, sp.y0, xb - xa, sp.h);
    g.restore();
  }
}

function drawLeg(g, SP, ax, ay, px, py, up, beans, rot, ink = 0) {
  const dx = px - ax, dy = py - ay, d = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
  g.save();
  g.translate(ax, ay); g.rotate(a);
  g.globalAlpha = clamp((up - 0.12) * 4);
  g.scale(clamp(d / 54, 0.55, 1.6), 1);
  blit(g, SP.leg);
  g.restore();
  g.save();
  g.translate(px, py); g.rotate(a + rot);
  const al = clamp((up - 0.08) * 6);
  g.globalAlpha = al;
  blit(g, beans > 0.5 ? SP.pawB : SP.pawT);
  // still wet from the ink dish
  if (ink > 0.02) for (const [x, y, r] of [[12.6, -6.6, 3], [15.4, -2, 3.2], [15.4, 2.6, 3.2], [12.6, 7, 3], [5, 0, 6.2]]) dab(g, x, y, r, INK_RGB, 0.8 * ink * al, 0.55);
  g.restore();
  g.globalAlpha = 1;
}
// his fur standing up along his back (cat units, along the top of the loaf)
const PUFF_PTS = (() => {
  const R = rng(213), out = [];
  for (let x = -138; x <= 70; x += 2.4) {
    const y = BACK_Y(x), dy = BACK_Y(x + 3) - BACK_Y(x - 3), l = Math.hypot(6, dy) || 1;
    out.push([x, y, dy / l, -6 / l, R(), R()]);
  }
  return out;
})();
function drawPuff(g, k) {
  g.lineCap = 'round';
  for (const [x, y, nx, ny, r1, r2] of PUFF_PTS) {
    const len = (3 + 7 * r1) * k, a = Math.atan2(ny, nx) + (r2 - 0.5) * 0.9;
    const x0 = x - nx * 2, y0 = y + 2 - ny * 2;
    g.strokeStyle = r2 < 0.3 ? rgba(SHEEN, 0.4 * k) : rgba([26, 28, 34], 0.9 * k);
    g.lineWidth = 0.8 + r1 * 0.9;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5 + (r1 - 0.5) * 2, y0 + Math.sin(a) * len * 0.5, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); g.stroke();
  }
}

// the near ear or the far one; returns how much it faces us (below 0, we see its back)
const EM = new Float64Array(6);
function earMatrix(side, P) {
  // the ears ride high on the skull, so they only follow some of the nod
  // (and never come down in front of his forehead)
  faceProj(side * 1.0, 0.7, FACE_R, P.yaw, P.pitch * 0.35);
  const fl = side < 0 ? P.earFL : P.earFR, sw = side < 0 ? P.earSL : P.earSR, tw = side < 0 ? P.earTL : P.earTR;
  const ang = Math.atan2(FP.ny - 0.7, FP.nx) + side * (fl * 1.05 + sw * 0.22) + tw;
  const ul = 0.9 - fl * 0.28;
  const ux = Math.cos(ang) * ul, uy = Math.sin(ang) * ul;
  const facing = Math.cos(P.yaw * 0.9 + side * (0.35 + sw * 1.5 + fl * 0.5)) * Math.cos(P.pitch * 0.6);
  const wl = Math.max(0.5, 0.35 + 0.65 * Math.abs(facing)) / ul;
  EM[0] = -uy * wl; EM[1] = ux * wl; EM[2] = -ux; EM[3] = -uy;
  EM[4] = FP.x + P.yaw * 2.5; EM[5] = FP.y + P.pitch * 2;
  return facing;
}

// a point along a cubic, for the wet line under the eye
const BZ = { x: 0, y: 0 };
function bez(t, ax, ay, bx, by, cx, cy, dx, dy) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  BZ.x = a * ax + b * bx + c * cx + d * dx; BZ.y = a * ay + b * by + c * cy + d * dy;
  return BZ;
}
function eyeShape(g, xi, yi, xo, yo, c1x, c1y, c2x, c2y, c3x, c3y, c4x, c4y) {
  g.beginPath();
  g.moveTo(xi, yi);
  g.bezierCurveTo(c1x, c1y, c2x, c2y, xo, yo);
  g.bezierCurveTo(c3x, c3y, c4x, c4y, xi, yi);
  g.closePath();
}

// a soft warm flush under the eye when he's happy
function blush(g, side, k) {
  if (k <= 0.02) return;
  dab(g, side * 1.5, EYE_H * 1.55, 9.5, BLUSH, 0.3 * k, 0.25);
  dab(g, side * 3.5, EYE_H * 1.45, 5, [246, 150, 140], 0.18 * k, 0.4);
}
function drawEye(g, SP, P, side) {
  const ew = EYE_W, eh = EYE_H, hp = P.happy, jy = clamp(P.joy);
  // when he's pleased the outer corner eases down and the upper lid stays
  // round; the lower lid only lifts a little, so it never turns into a squint
  const xi = -side * ew, xo = side * ew, yi = 2, yo = -1.8 + 1.6 * hp;
  const lo = clamp(1 - P.lidL);
  // joy closes them right up
  let up = clamp(1 - Math.max(P.lidU, smooth(0, 0.7, jy)));
  if (up >= 0.07) up = lerp(up, Math.max(up, 0.72 * clamp((up - 0.07) / 0.4)), clamp(hp * 1.5));
  const br = P.brow * (1 - jy) - 0.5 * hp;
  g.lineCap = 'round';
  g.strokeStyle = '#0c0d11';
  if (up < 0.07) {
    // closed: a soft happy ^ (both corners level, so the two eyes match),
    // or a sleepy curve
    const k = clamp(Math.max(hp, jy)), nw = 1 - 0.14 * k;
    const y0 = lerp(yi, 1.6, k), y1 = lerp(yo, 1.6, k), cy = lerp(eh * 0.5, -eh * 0.9, k);
    g.lineWidth = lerp(2.1, 2.7, k);
    g.beginPath(); g.moveTo(xi * nw, y0 + 0.5); g.quadraticCurveTo(0, cy + 0.5, xo * nw, y1 + 0.5); g.stroke();
    if (k < 0.5) { g.lineWidth = 1.1; g.beginPath(); g.moveTo(xi, yi + 0.5); g.lineTo(xi - side * 2.4, yi + 2.6); g.stroke(); }
    return;
  }
  // a pleased eye: the lower lid pushes up a touch
  const c1x = xi * 0.4, c1y = yi - eh * 1.56 * up * (1 - 0.5 * Math.max(0, br));
  const c2x = xo * 0.45, c2y = yo - eh * 1.36 * up * (1 - 0.4 * Math.max(0, -br));
  const c3x = xo * 0.5, c3y = Math.max(c2y + 2.5, yo + eh * (1.08 * lo - 0.9 * hp));
  const c4x = xi * 0.4, c4y = Math.max(c1y + 2.5, yi + eh * (0.98 * lo - 0.85 * hp));
  // the dark rim round it
  g.save();
  g.scale(1.14, 1.2);
  eyeShape(g, xi, yi, xo, yo, c1x, c1y, c2x, c2y, c3x, c3y, c4x, c4y);
  g.fillStyle = 'rgba(12,12,16,.75)';
  g.fill();
  g.restore();
  g.save();
  eyeShape(g, xi, yi, xo, yo, c1x, c1y, c2x, c2y, c3x, c3y, c4x, c4y);
  g.clip();
  g.fillStyle = '#16221a';
  g.fillRect(-ew - 2, -eh * 2, ew * 2 + 4, eh * 4);
  const ix = P.gx * ew * 0.32, iy = P.gy * eh * 0.3 + 0.4, ri = eh * 1.04, sc = ri / 10;
  g.drawImage(SP.iris.c, ix - 11 * sc, iy - 11 * sc, 22 * sc, 22 * sc);
  // the pupil: a slit when he's calm, wide and round when something moves
  const pw = ri * (0.12 + 0.72 * P.pupil);
  g.fillStyle = '#060709';
  g.beginPath(); g.ellipse(ix, iy, pw, ri * 0.93, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(70,96,120,.35)';
  g.beginPath(); g.ellipse(ix + pw * 0.3, iy + 3.2, pw * 0.5, 4.2, 0, 0, TAU); g.fill();
  // the upper lid's shadow
  g.strokeStyle = 'rgba(8,16,10,.26)';
  g.lineWidth = 2;
  g.globalAlpha = 1 - 0.6 * hp;
  for (let k = 1; k <= 3; k++) {
    g.beginPath(); g.moveTo(xi, yi + k * 1.1); g.bezierCurveTo(c1x, c1y + k * 1.6, c2x, c2y + k * 1.6, xo, yo + k * 1.1); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.beginPath(); g.ellipse(ix + 3, iy - 3.6, 2.2, 1.7, -0.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath(); g.arc(ix - 3, iy + 3.9, 0.95, 0, TAU); g.fill();
  g.restore();
  g.strokeStyle = '#0c0d11';
  g.lineWidth = 1.9;
  g.beginPath(); g.moveTo(xi, yi); g.bezierCurveTo(c1x, c1y, c2x, c2y, xo, yo); g.stroke();
  g.lineWidth = 0.95;
  g.beginPath(); g.moveTo(xo, yo); g.bezierCurveTo(c3x, c3y, c4x, c4y, xi, yi); g.stroke();
  g.lineWidth = 1.25;
  g.beginPath(); g.moveTo(xi, yi); g.lineTo(xi - side * 2.6, yi + 2.5); g.stroke();
  // the wet of the lower lid catching the light
  g.strokeStyle = 'rgba(150,160,180,.35)';
  g.lineWidth = 0.7;
  g.beginPath();
  for (let i = 0; i <= 6; i++) {
    const p = bez(0.2 + i * 0.1, xo, yo, c3x, c3y, c4x, c4y, xi, yi);
    i ? g.lineTo(p.x, p.y + 1.1) : g.moveTo(p.x, p.y + 1.1);
  }
  g.stroke();
}

function browWhiskers(g, side, k) {
  g.strokeStyle = WHISKER;
  g.lineWidth = 0.5;
  for (let j = 0; j < 3; j++) {
    const x = side * (1 + j * 3), y = -15.5 - j * 0.8;
    const L = (12 + j * 2) * k;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + side * L * 0.35, y - L * 0.7, x + side * L * 0.8, y - L * 0.95); g.stroke();
  }
}

// nose, lips, an open mouth when he needs one (origin at the nose)
function drawMouth(g, SP, P) {
  const J = P.jaw;
  // the jaw and chin drop when he opens up
  blit(g, SP.chin, P.chew * 1.2, 15 + J * 25);
  const mw = 5.5 + J * 9, top = 9.2, bot = 9.6 + J * 26;
  if (J > 0.02) {
    g.fillStyle = MOUTH_S;
    g.beginPath();
    g.moveTo(-mw, top);
    g.quadraticCurveTo(0, top - 1.2, mw, top);
    g.quadraticCurveTo(mw * 0.95, bot - 1, 0, bot);
    g.quadraticCurveTo(-mw * 0.95, bot - 1, -mw, top);
    g.fill();
    // the dark of his throat
    if (J > 0.3) {
      g.fillStyle = 'rgba(28,8,14,.75)';
      g.beginPath(); g.ellipse(0, top + (bot - top) * 0.42, mw * 0.5, (bot - top) * 0.3, 0, 0, TAU); g.fill();
    }
    g.fillStyle = TONGUE_S;
    g.beginPath(); g.ellipse(0, bot - 1.8 - J * 2, mw * 0.62, 1.4 + J * 3.4, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.ellipse(0, bot - 1.8 - J * 2, mw * 0.62, 1.2, 0, 0, Math.PI); g.fill();
    if (P.fangs > 0.05) {
      g.globalAlpha = clamp(P.fangs);
      g.fillStyle = 'rgb(250,248,240)';
      for (let sx = -1; sx <= 1; sx += 2) { g.beginPath(); g.moveTo(sx * (mw - 2.8), bot - 0.6); g.lineTo(sx * (mw - 1.2), bot - 0.6); g.lineTo(sx * (mw - 1.9), bot - 3.4 * P.fangs); g.fill(); }
      g.globalAlpha = 1;
    }
    g.strokeStyle = 'rgba(12,10,12,.9)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-mw, top); g.quadraticCurveTo(0, top - 1.2, mw, top); g.stroke();
  }
  blit(g, SP.muzzle);
  // the top fangs hang down past the lip
  if (J > 0.02 && P.fangs > 0.05) {
    g.globalAlpha = clamp(P.fangs);
    g.fillStyle = 'rgb(250,248,240)';
    for (let sx = -1; sx <= 1; sx += 2) { g.beginPath(); g.moveTo(sx * (mw - 3.2), top + 0.4); g.lineTo(sx * (mw - 1), top + 0.4); g.lineTo(sx * (mw - 2), top + 4.8 * P.fangs + 0.8); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
  }
  // tongue out: a blep, or licking his lips
  if (P.tongue > 0.02 && J < 0.25) {
    const t = P.tongue, lk = P.lick;
    g.fillStyle = TONGUE_S;
    g.beginPath();
    g.ellipse(lk * 3.4, 10.2 + t * 2.2 - lk * 3, 2.5 + t * 0.6, 1.3 + t * 1.7, lk * 0.7, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(150,70,84,.6)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(lk * 3.4, 9.4 - lk * 3); g.lineTo(lk * 3.4, 10.6 + t * 2.6 - lk * 3); g.stroke();
  }
  // a wrinkled nose when the avocado is around
  const wr = P.wrinkle;
  if (wr > 0.05) {
    g.strokeStyle = rgba(FUR_DARK, 0.75 * wr);
    g.lineWidth = 0.85;
    for (let i = 0; i < 3; i++) {
      const y = -10.5 - i * 2.3;
      g.beginPath(); g.moveTo(-3.4 + i * 0.4, y + 0.9); g.quadraticCurveTo(0, y - 0.9, 3.4 - i * 0.4, y + 0.9); g.stroke();
    }
  }
  // the nose
  g.save();
  g.translate(0, P.noseTw * 1.1 - 1.3 - wr * 0.6);
  g.scale(1.75 + P.noseTw * 0.08, 1.75 - P.noseTw * 0.1 + wr * 0.08);
  blit(g, SP.nose);
  g.restore();
  // lips: the little line down from the nose and its two curls
  // (a bit bolder when he's happy, so the little smile reads)
  const cy = 8.8 - P.grin * 1.4, jy = clamp(P.joy);
  g.strokeStyle = 'rgba(10,10,13,.92)'; g.lineWidth = 1.05 + 0.35 * jy; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 5 + P.noseTw); g.lineTo(0, 7.4);
  if (J <= 0.02) {
    g.moveTo(0, 7.4); g.quadraticCurveTo(-2.5, 10.6 + P.grin * 0.6, -6.6, cy);
    g.moveTo(0, 7.4); g.quadraticCurveTo(2.5, 10.6 + P.grin * 0.6, 6.6, cy - wr * 1.2);
  }
  g.stroke();
  // a little light catching the lower lip, so the mouth reads on such dark fur
  if (J <= 0.02) {
    g.strokeStyle = rgba([150, 158, 180], 0.28 + 0.14 * jy); g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-5.8, cy + 1.6); g.quadraticCurveTo(-2.4, 11.8 + P.grin * 0.6, 0, 9);
    g.quadraticCurveTo(2.4, 11.8 + P.grin * 0.6, 5.8, cy + 1.6);
    g.stroke();
  }
}

// whiskers grow from the pads; the far side is drawn first, behind the muzzle
function whiskers(g, P, side, M) {
  const vis = clamp(0.5 + 0.5 * Math.cos(P.yaw + side * 0.75));
  const wk = P.whisk;
  g.strokeStyle = WHISKER;
  g.lineWidth = 0.55;
  for (let j = 0; j < 5; j++) {
    const lx = side * (5.4 + j * 0.9), ly = 5.6 + j * 1.5;
    const x = M[4] + M[0] * lx + M[2] * ly, y = M[5] + M[1] * lx + M[3] * ly;
    let a = -0.24 + j * 0.13 * (1 + wk * 0.35) - wk * 0.12 + (wk < 0 ? wk * 0.35 : 0);
    a = side > 0 ? a : Math.PI - a;
    const L = (40 - j * 2.6) * (0.5 + 0.5 * vis) * (wk < 0 ? 1 + wk * 0.25 : 1 + wk * 0.08);
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * L * 0.55, y + Math.sin(a) * L * 0.55 - 2.5, ex, ey + 3 + j * 0.4);
    g.stroke();
  }
}

// his face only turns and nods so far; past that the whole head just shifts a little
const FACE_YAW = 0.8, FACE_UP = -0.45, FACE_DOWN = 0.42;
const MM = new Float64Array(6);
function drawHead(g, SP, P, extra) {
  headMatrix(P);
  g.save();
  g.transform(HM[0], HM[1], HM[2], HM[3], HM[4], HM[5]);
  const yaw0 = P.yaw, yw = clamp(yaw0, -FACE_YAW, FACE_YAW);
  const pitch0 = P.pitch, pc = clamp(pitch0, FACE_UP, FACE_DOWN);
  P.yaw = yw; P.pitch = pc;
  g.translate((yaw0 - yw) * 9, (pitch0 - pc) * 12);
  const ox = yw * 2.5, oy = pc * 2;
  // the ears sit behind the skull; turning away, the back of one fades in over its
  // front (same outline, so it never pops)
  for (let side = -1; side <= 1; side += 2) {
    const fa = smooth(-0.3, 0.3, earMatrix(side, P));
    g.save();
    g.transform(EM[0], EM[1], EM[2], EM[3], EM[4], EM[5]);
    if (fa < 0.995) blit(g, side < 0 ? SP.earBL : SP.earBR);
    if (fa > 0.005) { g.globalAlpha = fa; blit(g, side < 0 ? SP.earFL : SP.earFR); g.globalAlpha = 1; }
    g.restore();
  }
  blit(g, SP.skull, ox, oy);
  // only if he ducks his head right down does an ear come round in front of it,
  // and then it fades in rather than jumping forward
  for (let side = -1; side <= 1; side += 2) {
    const fa = smooth(0, 0.3, earMatrix(side, P)), ah = smooth(-23, -19, FP.y) * fa;
    if (ah < 0.01) continue;
    g.save();
    g.transform(EM[0], EM[1], EM[2], EM[3], EM[4], EM[5]);
    g.globalAlpha = ah;
    blit(g, side < 0 ? SP.earFLf : SP.earFRf);
    g.restore();
  }
  // the muzzle frame, used for whisker roots too
  faceProj(0, NOSE_LAT, FACE_R * 1.1, P.yaw, P.pitch);
  MM[0] = FP.ex; MM[1] = FP.ey; MM[2] = FP.sx; MM[3] = FP.sy; MM[4] = FP.x + ox; MM[5] = FP.y + oy;
  const far = P.yaw >= 0 ? 1 : -1;
  // the hollows round his eyes and the brows over them, then the eyes, far one first
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 2; i++) {
      const side = i ? -far : far;
      faceProj(side * EYE_LON, EYE_LAT, FACE_R, P.yaw, P.pitch);
      if (FP.z < 0.08) continue;
      // never squeezed into a slit: the far eye keeps a bit of width
      const k = Math.max(1, 0.45 / (Math.abs(FP.ex) || 1));
      g.save();
      g.transform(FP.ex * k, FP.ey * k, FP.sx, FP.sy, FP.x + ox, FP.y + oy);
      if (pass === 0) { blit(g, side < 0 ? SP.sockL : SP.sockR); blush(g, side, P.joy * clamp(FP.z * 1.6)); }
      else { drawEye(g, SP, P, side); browWhiskers(g, side, clamp(FP.z * 1.4)); }
      g.restore();
    }
  }
  g.save();
  g.transform(MM[0], MM[1], MM[2], MM[3], MM[4], MM[5]);
  drawMouth(g, SP, P);
  g.restore();
  // both sets of whiskers over the muzzle, so neither jumps in front of it as he turns
  whiskers(g, P, far, MM);
  whiskers(g, P, -far, MM);
  if (extra) extra(g, ox, oy);
  g.restore();
  P.yaw = yaw0; P.pitch = pitch0;
}


// the whole cat, back to front; hk.under runs just after the platform's lip
// (things he sits on or scratches at), hk.front just before his head
function drawCat(g, SP, P, hk) {
  // a soft shadow where he presses into the cushion
  g.save();
  g.scale(1, 0.32);
  for (let x = -130; x <= 110; x += 20) dab(g, x + P.bx * 0.5, 30, 34, SHADOW, 0.07, 0.3);
  g.restore();
  drawTail(g, SP, P);
  g.save();
  g.translate(P.bx, P.by);
  const br = P.breath;
  g.save();
  g.translate(0, 12); g.scale(1 + br * 0.004, 1 + br * 0.016); g.translate(0, -12);
  g.save();
  g.translate(-40, 0); g.scale(1, 1 - P.lift / 260 + 0.03 * (P.puff || 0)); g.translate(40, 0);
  blit(g, SP.torso);
  if (P.puff > 0.02) drawPuff(g, P.puff);
  g.restore();
  g.save();
  g.translate(-92, 12 + P.rumpY); g.rotate(P.rumpA); g.translate(92, -12);
  blit(g, SP.haunch);
  g.restore();
  g.restore();
  g.translate(0, -P.lift);
  // far leg, mostly hidden behind his chest
  if (P.fUp > 0.15) drawLeg(g, SP, SHOULDER_F[0], SHOULDER_F[1], P.fX, P.fY, P.fUp, P.fBeans, P.fRot);
  g.restore();
  if (hk && hk.lip) hk.lip();
  if (hk && hk.under) hk.under();
  g.save();
  g.translate(P.bx, P.by - P.lift);
  // the neck fills in when his head goes down for something
  const hm = headMatrix(P);
  const nx0 = NECK_PIVOT[0] - 6, ny0 = NECK_PIVOT[1] + 6;
  const hx = hm[4] - P.bx, hy = hm[5] - P.by + P.lift + 20;
  const dl = Math.hypot(hx - nx0, hy - ny0);
  g.save();
  g.translate((nx0 + hx) / 2, (ny0 + hy) / 2);
  g.rotate(Math.atan2(hy - ny0, hx - nx0) - Math.PI / 2);
  g.scale(1, clamp(dl / 60, 0.6, 2));
  blit(g, SP.neck);
  g.restore();
  g.save();
  g.translate(0, br * 1.1);
  blit(g, SP.chest);
  g.restore();
  // both front paws peek out from under him
  if (P.fUp <= 0.15) blit(g, SP.tuckF, PAW_F[0], PAW_F[1]);
  g.restore();
  if (hk && hk.front) hk.front();
  if (P.nUp <= 0.15) blit(g, SP.tuckN, PAW_N[0] + P.bx, PAW_N[1] + P.by - P.lift);
  drawHead(g, SP, P, hk && hk.head);
  if (P.nUp > 0.15) nearLeg(g, SP, P);
}
function nearLeg(g, SP, P) {
  g.save();
  g.translate(P.bx, P.by - P.lift);
  drawLeg(g, SP, SHOULDER_N[0], SHOULDER_N[1], P.nX, P.nY, P.nUp, P.nBeans, P.nRot, P.ink || 0);
  g.restore();
}

// a plush cream disc of the cat tree, centred on its top face
function paintDisc(g, hit, rx, ry, th, seed) {
  const R = rng(seed);
  const rim = new Path2D();
  rim.moveTo(rx, 0);
  rim.lineTo(rx, th);
  rim.ellipse(0, th, rx, ry, 0, 0, Math.PI);
  rim.lineTo(-rx, 0);
  rim.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true);
  rim.closePath();
  const top = new Path2D();
  top.ellipse(0, 0, rx, ry, 0, 0, TAU);
  // underside shadow
  stamp(g, 0, th + ry * 0.8, rx * 0.9, [90, 74, 58], 0.12, 0.2);
  // rim: a soft cylinder
  let gr = g.createLinearGradient(-rx, 0, rx, 0);
  gr.addColorStop(0, rgba(CREAM_D, 1));
  gr.addColorStop(0.3, rgba(CREAM_S, 1));
  gr.addColorStop(0.62, rgba(mix(CREAM_S, CREAM, 0.5), 1));
  gr.addColorStop(1, rgba(CREAM_D, 1));
  g.fillStyle = gr;
  g.fill(rim);
  g.save();
  g.clip(rim);
  const vg = g.createLinearGradient(0, ry * 0.4, 0, th + ry);
  vg.addColorStop(0, 'rgba(255,252,244,0)');
  vg.addColorStop(1, 'rgba(120,100,80,0.25)');
  g.fillStyle = vg;
  g.fill(rim);
  hairs(g, rim, hit, R, {
    box: [-rx, 0, rx, th + ry], n: rx * th * 0.9, len: [1.5, 3.5], width: [0.4, 0.9], bend: 1,
    flow: () => Math.PI / 2 + (R() - 0.5) * 2,
    pick: (x, y, r) => (r() < 0.5 ? [CREAM_INK, 0.12 + r() * 0.12] : [[255, 252, 244], 0.3 + r() * 0.3]),
  });
  g.restore();
  // top face: lit from the window on the right
  gr = g.createLinearGradient(-rx, -ry, rx, ry);
  gr.addColorStop(0, rgba(mix(CREAM, CREAM_S, 0.55), 1));
  gr.addColorStop(0.6, rgba(CREAM, 1));
  gr.addColorStop(1, rgba([252, 249, 240], 1));
  g.fillStyle = gr;
  g.fill(top);
  g.save();
  g.clip(top);
  stamp(g, -rx * 0.35, -ry * 0.1, rx * 0.5, CREAM_D, 0.12, 0.2);
  hairs(g, top, hit, R, {
    box: [-rx, -ry, rx, ry], n: rx * ry * 0.9, len: [1.2, 3], width: [0.4, 0.9], bend: 1,
    flow: () => R() * TAU,
    pick: (x, y, r) => (r() < 0.55 ? [CREAM_INK, 0.08 + r() * 0.12] : [[255, 253, 248], 0.4 + r() * 0.3]),
  });
  g.restore();
  // soft ink outlines
  const front = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; front.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  const bottom = front.map(([x, y]) => [x, y + th]);
  stroke(g, { pts: front, width: 1.4, dry: 0.55, tone: 0.42, bleed: 0.1, rgb: CREAM_INK, seed: seed + 1, bristles: 5 });
  stroke(g, { pts: bottom, width: 1.8, dry: 0.5, tone: 0.55, bleed: 0.15, rgb: CREAM_INK, seed: seed + 2, bristles: 5 });
  const back = [];
  for (let i = 0; i <= 20; i++) { const a = Math.PI + (i / 20) * Math.PI; back.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  stroke(g, { pts: back, width: 1.1, dry: 0.7, tone: 0.28, bleed: 0.05, rgb: CREAM_INK, seed: seed + 3, bristles: 4 });
  stroke(g, { pts: [[-rx, 0], [-rx - 0.4, th * 0.5], [-rx, th]], width: 1.4, dry: 0.5, tone: 0.45, rgb: CREAM_INK, seed: seed + 4, bristles: 4 });
  stroke(g, { pts: [[rx, 0], [rx + 0.4, th * 0.5], [rx, th]], width: 1.2, dry: 0.6, tone: 0.32, rgb: CREAM_INK, seed: seed + 5, bristles: 4 });
}

// a sisal-wrapped post from y0 down to y1, ending on an ellipse
function paintPost(g, x, y0, y1, w, s, seed) {
  const R = rng(seed);
  const hw = w / 2, e = hw * 0.28;
  const path = new Path2D();
  path.moveTo(x - hw, y0);
  path.lineTo(x - hw, y1);
  path.ellipse(x, y1, hw, e, 0, Math.PI, 0, true);
  path.lineTo(x + hw, y0);
  path.closePath();
  const gr = g.createLinearGradient(x - hw, 0, x + hw, 0);
  gr.addColorStop(0, rgba(SISAL_D, 1));
  gr.addColorStop(0.36, rgba(SISAL, 1));
  gr.addColorStop(0.66, rgba(mix(SISAL, [246, 236, 214], 0.5), 1));
  gr.addColorStop(1, rgba(mix(SISAL_D, SISAL, 0.3), 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  g.lineCap = 'round';
  for (let y = y0 + R() * 3; y < y1 + e; y += (3 + R() * 1.2) * s) {
    g.beginPath();
    g.moveTo(x - hw, y);
    g.quadraticCurveTo(x, y + e * 1.5, x + hw, y + (R() - 0.5) * s);
    g.strokeStyle = rgba(SISAL_LINE, 0.2 + R() * 0.22);
    g.lineWidth = (0.6 + R() * 0.8) * s;
    g.stroke();
  }
  for (let i = 0; i < (y1 - y0) * 1.2; i++) {
    const px = x + (R() - 0.5) * w, py = y0 + R() * (y1 - y0), a = R() * TAU, L = (1 + R() * 3) * s;
    g.strokeStyle = R() < 0.5 ? rgba([252, 244, 228], 0.35) : rgba(SISAL_LINE, 0.2);
    g.lineWidth = 0.5 * s;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); g.stroke();
  }
  g.restore();
  stroke(g, { pts: [[x - hw, y0], [x - hw - 0.4 * s, (y0 + y1) / 2], [x - hw, y1]], width: 1.6 * s, dry: 0.6, tone: 0.5, rgb: [96, 78, 56], seed: seed + 1, bristles: 4 });
  stroke(g, { pts: [[x + hw, y0], [x + hw + 0.3 * s, (y0 + y1) / 2], [x + hw, y1]], width: 1.3 * s, dry: 0.7, tone: 0.34, rgb: [96, 78, 56], seed: seed + 2, bristles: 4 });
}


// the avocado (s units, origin at its centre of mass)

const AVO = [[0, -54], [8.5, -52], [14.5, -45], [17.5, -34], [20, -22], [25.5, -10], [29.5, 2], [29.5, 13], [24, 20.5], [13, 24.2], [0, 25], [-13, 24.2], [-24, 20.5], [-29.5, 13], [-29.5, 2], [-25.5, -10], [-20, -22], [-17.5, -34], [-14.5, -45], [-8.5, -52]];
const AVO_SHAPES = [{ x: 0, y: -4, r: 28 }, { x: 0, y: -38, r: 16 }];
const AVO_EYES = [[-7.5, -21], [7.5, -21]];

function paintAvocado(g) {
  const R = rng(61);
  const pts = closedSpline(AVO, 0.8);
  const path = toPath(pts);
  // skin
  let gr = g.createLinearGradient(-30, 20, 24, -50);
  gr.addColorStop(0, rgba([30, 50, 26], 1));
  gr.addColorStop(0.55, rgba(AVO_SKIN, 1));
  gr.addColorStop(1, rgba(AVO_SKIN_L, 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  for (let i = 0; i < 260; i++) {
    const x = (R() - 0.5) * 62, y = -56 + R() * 82;
    g.fillStyle = R() < 0.5 ? 'rgba(14,26,10,.35)' : 'rgba(150,180,90,.25)';
    g.beginPath(); g.arc(x, y, 0.35 + R() * 0.6, 0, TAU); g.fill();
  }
  g.restore();
  // flesh
  const fp = AVO.map(([x, y]) => [x * 0.84, -6 + (y + 6) * 0.87]);
  const flesh = toPath(closedSpline(fp, 0.8));
  gr = g.createRadialGradient(-2, -2, 2, 0, -6, 34);
  gr.addColorStop(0, 'rgb(244,238,170)');
  gr.addColorStop(0.5, 'rgb(222,228,138)');
  gr.addColorStop(0.8, 'rgb(184,210,96)');
  gr.addColorStop(1, 'rgb(136,176,64)');
  g.fillStyle = gr;
  g.fill(flesh);
  g.save();
  g.clip(flesh);
  stamp(g, 10, -36, 9, [252, 250, 210], 0.35, 0.2);
  for (let i = 0; i < 90; i++) {
    const x = (R() - 0.5) * 50, y = -46 + R() * 66;
    g.strokeStyle = rgba([150, 170, 70], 0.12);
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + (R() - 0.5) * 3); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(112,150,44,.55)';
  g.lineWidth = 1.1;
  g.stroke(flesh);
  // the pit, a round belly
  gr = g.createRadialGradient(-4, 0, 1, 0, 4, 13);
  gr.addColorStop(0, 'rgb(186,128,76)');
  gr.addColorStop(0.6, 'rgb(140,90,50)');
  gr.addColorStop(1, 'rgb(98,60,32)');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 4.5, 12, 12.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(236,196,150,.55)';
  g.beginPath(); g.ellipse(-4.5, -1.5, 3.4, 2.2, -0.6, 0, TAU); g.fill();
  stroke(g, { pts: [[-12, 4], [-9, 13], [0, 17], [9, 13], [12, 4]], width: 1.2, dry: 0.4, tone: 0.5, rgb: [70, 40, 20], seed: 62, bristles: 4 });
  // a confident outline, in two strokes like a painter would
  const half = Math.floor(pts.length / 2);
  stroke(g, { pts: [...pts.slice(0, half + 1)], width: 2.2, dry: 0.4, tone: 0.85, bleed: 0.1, rgb: [16, 26, 12], seed: 63, bristles: 7 });
  stroke(g, { pts: [...pts.slice(half), pts[0]], width: 2.4, dry: 0.45, tone: 0.9, bleed: 0.1, rgb: [16, 26, 12], seed: 64, bristles: 7 });
}


// the room, a part at a time (each yield is a place to pause between slices)
function* roomGen(g, L, hit, SP) {
  const { W, H, s } = L;
  const R = rng(71);
  // wall, with daylight round the window
  let gr = g.createLinearGradient(0, 0, 0, L.wallBase);
  gr.addColorStop(0, 'rgba(226,212,184,0.0)');
  gr.addColorStop(0.25, 'rgba(226,212,184,0.22)');
  gr.addColorStop(1, 'rgba(214,198,168,0.34)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, L.wallBase);
  const wcx = (L.win.x0 + L.win.x1) / 2, wcy = (L.win.y0 + L.win.y1) / 2;
  stamp(g, wcx, wcy, Math.max(L.win.x1 - L.win.x0, L.win.y1 - L.win.y0) * 0.9, [252, 249, 238], 0.5, 0.2);

  yield;
  yield* windowGen(g, L, R);
  yield;
  if (L.sign) { paintSign(g, L, SP); yield; }

  // floor: warm boards, the skirting line, and light from the window
  gr = g.createLinearGradient(0, L.wallBase, 0, H);
  gr.addColorStop(0, 'rgba(196,166,124,0.42)');
  gr.addColorStop(1, 'rgba(206,182,146,0.12)');
  g.fillStyle = gr;
  g.fillRect(0, L.wallBase, W, H - L.wallBase);
  for (let i = 0; i < 5; i++) {
    const y = L.wallBase + (H - L.wallBase) * (0.18 + i * 0.19) * (1 + i * 0.08);
    if (y > H - 4) break;
    stroke(g, { pts: [[-10, y], [W * 0.5, y + (R() - 0.5) * 2], [W + 10, y + (R() - 0.5) * 2]], width: 1.1, dry: 0.85, tone: 0.18 + i * 0.03, rgb: [120, 86, 52], seed: 80 + i, bristles: 3 });
  }
  const lx0 = L.win.x0 + 40 * s, lx1 = L.win.x1 - 10 * s;
  for (let i = 0; i < 18; i++) {
    const u = i / 17, k = R();
    const y = lerp(L.wallBase + 6 * s, H - 10, k);
    const x = lerp(lx0, lx1, u) + (y - L.wallBase) * 0.7;
    stamp(g, x, y, (34 + R() * 26) * s, [255, 251, 238], 0.13, 0.15);
  }
  stroke(g, { pts: [[-10, L.wallBase], [W * 0.3, L.wallBase + 1], [W * 0.7, L.wallBase - 0.5], [W + 10, L.wallBase]], width: 2.4, dry: 0.7, tone: 0.45, rgb: [70, 50, 34], seed: 90, bristles: 6 });
  yield;

  // the cat tree: base, posts, lower platform, upper post; the top platform is a sprite
  stamp(g, L.base.x, L.floorY + 2 * s, L.base.rx * 1.05, [70, 54, 40], 0.16, 0.15);
  stamp(g, L.base.x - L.base.rx * 0.3, L.floorY, L.base.rx * 0.6, [70, 54, 40], 0.1, 0.15);
  g.save(); g.translate(L.base.x, L.base.y); g.scale(s, s);
  paintDisc(g, hit, L.base.rx / s, L.base.ry / s, L.base.th / s, 120);
  g.restore();
  yield;
  paintPost(g, L.post.x, L.low.y, L.base.y, L.post.w, s, 130);
  paintPost(g, L.post2.x, L.low.y + L.low.th, L.base.y, L.post2.w, s, 140);
  yield;
  g.save(); g.translate(L.low.x, L.low.y); g.scale(s, s);
  paintDisc(g, hit, L.low.rx / s, L.low.ry / s, L.low.th / s, 150);
  g.restore();
  yield;
  paintPost(g, L.post.x, L.plat.y + L.plat.th, L.low.y, L.post.w, s, 160);
  // shadow of the top platform on the post
  stamp(g, L.post.x, L.plat.y + L.plat.th + 10 * s, 26 * s, [80, 60, 40], 0.16, 0.2);
  blit2(g, SP.plat, L.plat.x, L.plat.y, s);
  yield;

  // let the room fade into the page at its edges
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const fw = L.narrow ? 14 : Math.min(160, W * 0.13);
  for (const [a, b] of [[0, fw], [W, W - fw]]) {
    gr = g.createLinearGradient(a, 0, b, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(Math.min(a, b), 0, fw, H);
  }
  gr = g.createLinearGradient(0, H - 46, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, H - 46, W, 46);
  gr = g.createLinearGradient(0, 0, 0, 30);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 30);
  g.restore();
}
function paintRoom(g, L, hit, SP) {
  for (const x of roomGen(g, L, hit, SP)) void x;
}
function* windowGen(g, L, R) {
  const { s } = L;
  const { x0, y0, x1, y1 } = L.win;
  const f = 15 * s;
  const gx0 = x0 + f, gy0 = y0 + f, gx1 = x1 - f, gy1 = y1 - f * 0.8;
  const gw = gx1 - gx0, gh = gy1 - gy0;
  // daylight and blurred green outside
  g.save();
  g.beginPath(); g.rect(gx0, gy0, gw, gh); g.clip();
  let gr = g.createLinearGradient(0, gy0, 0, gy1);
  gr.addColorStop(0, rgba(SKY, 1));
  gr.addColorStop(0.45, rgba(mix(SKY, LEAF_L, 0.55), 1));
  gr.addColorStop(1, rgba(mix(LEAF, LEAF_L, 0.4), 1));
  g.fillStyle = gr;
  g.fillRect(gx0, gy0, gw, gh);
  const big = Math.max(gw, gh);
  for (let i = 0; i < 26; i++) {
    const x = gx0 + R() * gw, y = gy0 + gh * (0.3 + R() * 0.8);
    stamp(g, x, y, big * (0.12 + R() * 0.16), R() < 0.5 ? LEAF_D : LEAF, 0.16 + R() * 0.2, 0.15);
  }
  for (let i = 0; i < 12; i++) {
    const x = gx0 + R() * gw, y = gy0 + gh * R() * 0.5;
    stamp(g, x, y, big * (0.1 + R() * 0.12), SKY, 0.35 + R() * 0.3, 0.15);
  }
  yield;
  // bokeh
  for (let i = 0; i < 46; i++) {
    const x = gx0 + R() * gw, y = gy0 + R() * gh * 0.85, r = (5 + R() * 12) * s;
    const light = R() < 0.7;
    stamp(g, x, y, r, light ? [246, 250, 232] : LEAF_L, (light ? 0.28 : 0.2) + R() * 0.25, 0.75);
  }
  // a reflection or two on the glass
  g.globalCompositeOperation = 'lighter';
  for (const [k, w] of [[0.62, 26], [0.74, 10]]) {
    g.beginPath();
    const bx = gx0 + gw * k;
    g.moveTo(bx, gy0); g.lineTo(bx + w * s, gy0); g.lineTo(bx + w * s - gh * 0.55, gy1); g.lineTo(bx - gh * 0.55, gy1); g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fill();
  }
  g.restore();
  yield;
  // frame: warm light wood
  const frame = new Path2D();
  frame.rect(x0, y0, x1 - x0, y1 - y0);
  frame.rect(gx0, gy0, gw, gh);
  const midX = gx0 + gw * 0.56, mw = f * 0.55;
  g.fillStyle = rgba(WOOD, 1);
  g.fill(frame, 'evenodd');
  g.fillRect(midX - mw / 2, gy0, mw, gh);
  g.save();
  g.clip(frame, 'evenodd');
  for (let i = 0; i < 40; i++) {
    const vert = i % 2 === 0;
    const x = vert ? (R() < 0.5 ? x0 + R() * f : x1 - f + R() * f) : x0 + R() * (x1 - x0);
    const y = vert ? y0 + R() * (y1 - y0) : (R() < 0.5 ? y0 + R() * f : y1 - f + R() * f);
    const L2 = (40 + R() * 120) * s;
    g.strokeStyle = rgba(R() < 0.6 ? WOOD_D : WOOD_L, 0.25 + R() * 0.2);
    g.lineWidth = (0.6 + R()) * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(vert ? x + (R() - 0.5) * s : x + L2, vert ? y + L2 : y + (R() - 0.5) * s); g.stroke();
  }
  stamp(g, x1 - f * 0.5, (y0 + y1) / 2, (y1 - y0) * 0.5, WOOD_D, 0.08, 0.2);
  g.restore();
  yield;
  // the glass sits a little deeper than the frame
  g.strokeStyle = rgba(WOOD_INK, 0.45);
  g.lineWidth = 2 * s;
  g.strokeRect(gx0 + s, gy0 + s, gw - 2 * s, gh - 2 * s);
  g.fillStyle = rgba(WOOD_L, 0.6);
  g.fillRect(midX - mw / 2, gy0, mw * 0.35, gh);
  const ol = (pts, w, tone, seed) => stroke(g, { pts, width: w * s, dry: 0.55, tone, bleed: 0.12, rgb: WOOD_INK, seed, bristles: 5 });
  ol([[x0, y1], [x0 - 0.5, (y0 + y1) / 2], [x0, y0]], 2.4, 0.6, 201);
  ol([[x0, y0], [(x0 + x1) / 2, y0 + 0.5], [x1, y0]], 2.4, 0.55, 209);
  ol([[x1, y0], [x1 + 0.5, (y0 + y1) / 2], [x1, y1]], 2.2, 0.5, 202);
  yield;
  ol([[gx0, gy1], [gx0, (gy0 + gy1) / 2], [gx0, gy0]], 1.4, 0.35, 203);
  ol([[gx0, gy0], [(gx0 + gx1) / 2, gy0], [gx1, gy0]], 1.4, 0.35, 210);
  ol([[midX - mw / 2, gy0], [midX - mw / 2, gy1]], 1.2, 0.35, 204);
  ol([[midX + mw / 2, gy0], [midX + mw / 2, gy1]], 1.2, 0.3, 205);
  yield;
  // the sill
  const sx0 = x0 - 12 * s, sx1 = x1 + 12 * s, st = 12 * s;
  stamp(g, (sx0 + sx1) / 2, y1 + st + 8 * s, (sx1 - sx0) * 0.4, [90, 66, 44], 0.1, 0.2);
  g.fillStyle = rgba(WOOD_L, 1);
  g.fillRect(sx0, y1 - 3 * s, sx1 - sx0, 6 * s);
  g.fillStyle = rgba(mix(WOOD, WOOD_D, 0.35), 1);
  g.fillRect(sx0, y1 + 3 * s, sx1 - sx0, st - 3 * s);
  ol([[sx0, y1 - 3 * s], [sx1, y1 - 3 * s]], 1.6, 0.45, 206);
  ol([[sx0, y1 + st], [(sx0 + sx1) / 2, y1 + st + 0.5], [sx1, y1 + st]], 2.2, 0.55, 207);
  ol([[sx0, y1 - 3 * s], [sx0, y1 + st]], 1.4, 0.5, 208);
}

function paintSign(g, L, SP) {
  const { s } = L;
  const { x, y } = L.sign;
  g.save();
  g.translate(x, y);
  g.rotate(-0.06);
  const w = 74 * s, h = 96 * s;
  g.save();
  g.shadowColor = 'rgba(70,48,24,0.25)';
  g.shadowBlur = 10 * s;
  g.shadowOffsetY = 5 * s;
  g.fillStyle = '#faf6ec';
  g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
  g.strokeStyle = 'rgba(160,140,110,.5)';
  g.lineWidth = 0.8;
  g.strokeRect(-w / 2 + 4 * s, -h / 2 + 4 * s, w - 8 * s, h - 8 * s);
  // a little avocado, firmly crossed out
  g.save();
  g.translate(0, -10 * s);
  g.rotate(0.12);
  g.scale(0.5, 0.5);
  blit2(g, SP.avo, 0, 14 * s, s);
  g.restore();
  const ring = [];
  for (let i = 0; i <= 40; i++) { const a = -2.2 + (i / 40) * TAU * 1.04; ring.push([Math.cos(a) * 25 * s, -12 * s + Math.sin(a) * 25 * s]); }
  stroke(g, { pts: ring, width: 4 * s, dry: 0.3, tone: 0.9, bleed: 0.2, rgb: SEAL_RGB, seed: 301, bristles: 8 });
  stroke(g, { pts: [[-17 * s, -29 * s], [17 * s, 5 * s]], width: 4.4 * s, dry: 0.3, tone: 0.9, bleed: 0.2, rgb: SEAL_RGB, seed: 302, bristles: 8 });
  g.fillStyle = 'rgba(30,26,24,.9)';
  g.font = `${19 * s}px "Nanum Brush Script", "Gowun Batang", cursive`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('출입금지', 0, 31 * s);
  // a strip of tape
  g.fillStyle = 'rgba(232,220,190,.75)';
  g.save(); g.translate(0, -h / 2); g.rotate(0.08); g.fillRect(-12 * s, -5 * s, 24 * s, 10 * s); g.restore();
  g.restore();
}

// a glass jar of fish treats with a cork lid (s units, origin at the bottom middle)
function treatPath(g, x, y, a, k) {
  g.save();
  g.translate(x, y); g.rotate(a); g.scale(k, k);
  g.beginPath();
  g.moveTo(5.6, 0);
  g.bezierCurveTo(5.2, -2.6, 1.6, -3.4, -1.4, -2.6);
  g.lineTo(-4.6, -0.6); g.lineTo(-7.6, -3.2); g.lineTo(-6.8, 0); g.lineTo(-7.6, 3.2); g.lineTo(-4.6, 0.6);
  g.lineTo(-1.4, 2.6);
  g.bezierCurveTo(1.6, 3.4, 5.2, 2.6, 5.6, 0);
  g.closePath();
  g.restore();
}
function paintTreat(g) {
  treatPath(g, 0, 0, 0, 1);
  const gr = g.createLinearGradient(0, -3, 0, 3);
  gr.addColorStop(0, 'rgb(214,160,98)'); gr.addColorStop(1, 'rgb(160,100,52)');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(92,52,24,.85)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = 'rgba(60,32,16,.9)';
  g.beginPath(); g.arc(2.8, -0.7, 0.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,236,200,.5)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(-0.5, -1.8); g.quadraticCurveTo(2, -2.4, 4, -1.4); g.stroke();
}
function paintJar(g) {
  const R = rng(141);
  stamp(g, 0, 1, 30, [70, 54, 40], 0.2, 0.2);
  const body = new Path2D();
  body.moveTo(-16, -44); body.quadraticCurveTo(-22, -43, -22, -36);
  body.lineTo(-22, -7); body.quadraticCurveTo(-22, 0, -14, 0);
  body.lineTo(14, 0); body.quadraticCurveTo(22, 0, 22, -7);
  body.lineTo(22, -36); body.quadraticCurveTo(22, -43, 16, -44);
  body.closePath();
  g.fillStyle = 'rgba(226,236,232,.6)';
  g.fill(body);
  g.save();
  g.clip(body);
  for (let i = 0; i < 34; i++) {
    const y = -2 - Math.pow(R(), 0.8) * 26, x = (R() - 0.5) * 40;
    treatPath(g, x, y, R() * TAU, 0.9 + R() * 0.3);
    g.fillStyle = rgba(mix(TREAT, [226, 176, 112], R() * 0.6), 1);
    g.fill();
    g.strokeStyle = 'rgba(92,52,24,.5)'; g.lineWidth = 0.5; g.stroke();
  }
  // glass: a cool tint, the far wall of the jar, and two bright streaks
  const gr = g.createLinearGradient(-22, 0, 22, 0);
  gr.addColorStop(0, 'rgba(150,170,166,.35)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.05)');
  gr.addColorStop(0.8, 'rgba(255,255,255,.12)');
  gr.addColorStop(1, 'rgba(130,150,148,.4)');
  g.fillStyle = gr;
  g.fillRect(-23, -46, 46, 47);
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillRect(-16.5, -38, 2.6, 30);
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.fillRect(-12, -38, 1.2, 22);
  g.fillRect(15, -34, 1.4, 16);
  g.restore();
  // a paper label with a little fish on it
  g.save();
  g.translate(1, -30); g.rotate(-0.04);
  g.fillStyle = '#f8f2e4';
  g.fillRect(-12, -7, 24, 14);
  g.strokeStyle = 'rgba(150,120,90,.55)'; g.lineWidth = 0.6;
  g.strokeRect(-10.5, -5.5, 21, 11);
  treatPath(g, 0, 0, 0, 1.15);
  g.strokeStyle = 'rgba(40,30,26,.85)'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = 'rgba(40,30,26,.9)'; g.beginPath(); g.arc(3.4, -0.8, 0.55, 0, TAU); g.fill();
  g.restore();
  // the cork
  g.fillStyle = rgba(WOOD, 1);
  g.beginPath();
  g.moveTo(-15, -44); g.lineTo(-14, -52); g.quadraticCurveTo(0, -55, 14, -52); g.lineTo(15, -44); g.quadraticCurveTo(0, -42, -15, -44);
  g.fill();
  g.fillStyle = rgba(WOOD_L, 1);
  g.beginPath(); g.ellipse(0, -52, 14, 2.6, 0, 0, TAU); g.fill();
  for (let i = 0; i < 18; i++) { g.fillStyle = rgba(WOOD_D, 0.3); g.beginPath(); g.arc((R() - 0.5) * 26, -44 - R() * 8, 0.5, 0, TAU); g.fill(); }
  const ol = (pts, w, tone, seed, rgb = [70, 66, 62]) => stroke(g, { pts, width: w, dry: 0.55, tone, bleed: 0.1, rgb, seed, bristles: 4 });
  ol([[-22, -36], [-22.4, -20], [-22, -7], [-18, -0.5], [-8, 0.2]], 1.4, 0.5, 142);
  ol([[22, -36], [22.3, -20], [22, -7], [18, -0.5], [8, 0.2]], 1.2, 0.4, 143);
  ol([[-8, 0.2], [8, 0.2]], 1.2, 0.45, 144);
  ol([[-15, -44], [-14, -52], [0, -54.6], [14, -52], [15, -44]], 1.2, 0.5, 145, WOOD_INK);
}

// a sparrow outside the window, and a leaf on the wind
function drawBird(g, x, y, sc, flip, flap, peck) {
  g.save();
  g.translate(x, y); g.scale(sc * flip, sc);
  g.fillStyle = '#5e4c3e';
  g.beginPath(); g.moveTo(-5, -1); g.lineTo(-12, -4.5); g.lineTo(-11, -1); g.lineTo(-5, 2); g.fill();
  g.fillStyle = '#86694f';
  g.beginPath(); g.ellipse(0, 0, 7, 5.2, -0.15, 0, TAU); g.fill();
  g.fillStyle = '#dccbb2';
  g.beginPath(); g.ellipse(1.8, 2.2, 4.6, 2.9, -0.2, 0, TAU); g.fill();
  const hy = -3.4 + peck * 3.2, hx = 5.4 + peck * 1.2;
  g.fillStyle = '#6f5644';
  g.beginPath(); g.arc(hx, hy, 3.6, 0, TAU); g.fill();
  g.fillStyle = '#e4d6c0';
  g.beginPath(); g.ellipse(hx + 1, hy + 1.6, 2.2, 1.4, 0, 0, TAU); g.fill();
  g.fillStyle = '#2e2620';
  g.beginPath(); g.moveTo(hx + 3.2, hy - 0.8); g.lineTo(hx + 6.4, hy + 0.3); g.lineTo(hx + 3.2, hy + 1); g.fill();
  g.fillStyle = '#141010';
  g.beginPath(); g.arc(hx + 1.4, hy - 0.8, 0.75, 0, TAU); g.fill();
  if (flap === null) {
    g.fillStyle = '#5e4a3a';
    g.beginPath(); g.ellipse(-1.2, -0.6, 5, 2.8, -0.25, 0, TAU); g.fill();
    g.strokeStyle = '#3a2e26'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(0, 4.6); g.lineTo(-0.4, 7.6); g.moveTo(2.2, 4.4); g.lineTo(2.2, 7.6); g.stroke();
  } else {
    const w = Math.sin(flap);
    g.fillStyle = '#5e4a3a';
    g.beginPath(); g.moveTo(-3, -1); g.quadraticCurveTo(-2, -1 - 9 * w, 3, -1 - 11 * w); g.lineTo(2, -1); g.fill();
  }
  g.restore();
}
function drawLeaf(g, x, y, sc, a) {
  g.save();
  g.translate(x, y); g.rotate(a); g.scale(sc, sc * (0.55 + 0.45 * Math.abs(Math.cos(a * 1.7))));
  g.fillStyle = '#b4b04e';
  g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(0, -5, 7, 0); g.quadraticCurveTo(0, 5, -7, 0); g.fill();
  g.strokeStyle = 'rgba(96,90,30,.7)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(-8.5, 0.6); g.lineTo(6, 0); g.stroke();
  g.restore();
}

// the pompom, painted once
function paintPom(g) {
  const R = rng(77);
  stamp(g, 0, 2, 19, CREAM_D, 0.3, 0.45);
  const gr = g.createRadialGradient(-5, -6, 1.5, 0, 0, 15);
  gr.addColorStop(0, 'rgb(255,253,246)'); gr.addColorStop(0.7, rgba(CREAM, 1)); gr.addColorStop(1, rgba(CREAM_S, 1));
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 13.8, 0, TAU); g.fill();
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const a = R() * TAU, r0 = 15 * (0.55 + R() * 0.3), r1 = 15 * (0.95 + R() * 0.24);
    const lower = Math.sin(a) > 0.2;
    g.strokeStyle = lower && R() < 0.6 ? rgba(CREAM_INK, 0.3) : 'rgba(255,252,244,.85)';
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + 0.12) * r1, Math.sin(a + 0.12) * r1); g.stroke();
  }
}

// a little grooming brush (s units): a walnut back on a pad of fine silver pins,
// the pins' tips at the origin, the handle angled up and back to the left
const WALNUT = [112, 72, 44], WALNUT_L = [150, 104, 66];
function paintBrushTool(g) {
  const R = rng(171);
  // the handle
  g.save();
  g.translate(-11, -6); g.rotate(-2.62);
  let gr = g.createLinearGradient(0, -2.6, 0, 2.6);
  gr.addColorStop(0, rgba(WALNUT_L, 1)); gr.addColorStop(1, rgba(WALNUT, 1));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, -2.4); g.quadraticCurveTo(12, -2.2, 20, -2.8); g.quadraticCurveTo(24, 0, 20, 2.8); g.quadraticCurveTo(12, 2.4, 0, 2.6); g.closePath();
  g.fill();
  g.strokeStyle = rgba(WOOD_INK, 0.6); g.lineWidth = 0.6; g.stroke();
  g.fillStyle = 'rgba(40,24,14,.6)';
  g.beginPath(); g.arc(18.5, 0, 1, 0, TAU); g.fill();
  g.restore();
  // the pins
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = -12 + i * 0.95;
    g.strokeStyle = rgba(R() < 0.5 ? [176, 180, 190] : [222, 224, 230], 0.95);
    g.lineWidth = 0.45;
    g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x + (R() - 0.5) * 0.6, -0.2 + R() * 0.4); g.stroke();
  }
  // the dark pad and the wooden back
  g.fillStyle = 'rgb(48,40,38)';
  g.beginPath(); g.roundRect ? g.roundRect(-13, -5.6, 26, 2.4, 1.2) : g.rect(-13, -5.6, 26, 2.4); g.fill();
  gr = g.createLinearGradient(0, -11, 0, -5);
  gr.addColorStop(0, rgba(WALNUT_L, 1)); gr.addColorStop(1, rgba(WALNUT, 1));
  g.fillStyle = gr;
  g.beginPath(); g.roundRect ? g.roundRect(-14, -10.6, 28, 5.4, 2.6) : g.rect(-14, -10.6, 28, 5.4); g.fill();
  g.strokeStyle = 'rgba(255,236,206,.35)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(-11, -9.6); g.lineTo(10, -9.6); g.stroke();
  g.strokeStyle = rgba(WOOD_INK, 0.7); g.lineWidth = 0.6;
  g.beginPath(); g.roundRect ? g.roundRect(-14, -10.6, 28, 5.4, 2.6) : g.rect(-14, -10.6, 28, 5.4); g.stroke();
}

// a small saucer of ink for his paw (s units, origin at the middle of its top)
function paintDish(g) {
  stamp(g, 0, 4, 15, [70, 54, 40], 0.22, 0.3);
  let gr = g.createLinearGradient(-12, 0, 12, 0);
  gr.addColorStop(0, 'rgb(196,204,196)'); gr.addColorStop(0.45, 'rgb(240,242,236)'); gr.addColorStop(1, 'rgb(206,212,204)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-12.5, 0); g.quadraticCurveTo(-11.5, 4.6, 0, 4.8); g.quadraticCurveTo(11.5, 4.6, 12.5, 0); g.closePath(); g.fill();
  g.fillStyle = 'rgb(236,240,232)';
  g.beginPath(); g.ellipse(0, 0, 12.5, 4.2, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(110,150,128,.75)'; g.lineWidth = 0.8;
  g.beginPath(); g.ellipse(0, 0, 11.6, 3.7, 0, 0, TAU); g.stroke();
  gr = g.createRadialGradient(-2, -0.5, 0.5, 0, 0.3, 9);
  gr.addColorStop(0, 'rgb(40,40,46)'); gr.addColorStop(0.7, 'rgb(14,14,18)'); gr.addColorStop(1, 'rgb(8,8,10)');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 0.3, 8.8, 2.8, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.ellipse(-3.4, -0.5, 3.2, 0.55, -0.05, 0, TAU); g.fill();
  stroke(g, { pts: [[-12.5, 0], [-11.6, 3.4], [-5, 4.8], [5, 4.8], [11.6, 3.4], [12.5, 0]], width: 1, dry: 0.5, tone: 0.5, rgb: [70, 70, 66], seed: 175, bristles: 4 });
}

// a sprig of catnip: soft grey-green heart-shaped leaves in pairs, a lilac tip
function catnipLeaf(g, x, y, a, sz, R) {
  g.save();
  g.translate(x, y); g.rotate(a); g.scale(sz, sz);
  g.beginPath();
  g.moveTo(0, 0);
  // serrated edges, wide near the stem, coming to a point
  for (let i = 0; i <= 8; i++) { const u = i / 8, w = Math.sin(Math.PI * Math.pow(u, 0.75)) * 0.55 * (i % 2 ? 0.88 : 1); g.lineTo(u * 1.6, -w); }
  for (let i = 8; i >= 0; i--) { const u = i / 8, w = Math.sin(Math.PI * Math.pow(u, 0.75)) * 0.55 * (i % 2 ? 0.88 : 1); g.lineTo(u * 1.6, w); }
  g.closePath();
  const gr = g.createLinearGradient(0, -0.6, 0, 0.6);
  gr.addColorStop(0, 'rgb(150,176,128)'); gr.addColorStop(1, 'rgb(98,128,86)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(52,76,44,.7)'; g.lineWidth = 0.08; g.stroke();
  g.beginPath(); g.moveTo(0.05, 0); g.lineTo(1.4, 0); g.stroke();
  g.fillStyle = 'rgba(236,240,226,.35)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(0.3 + R() * 1.1, (R() - 0.5) * 0.6, 0.05, 0, TAU); g.fill(); }
  g.restore();
}
function paintSprig(g) {
  const R = rng(181);
  const pt = (u) => [lerp(-14, 13, u), 4 - 9 * u - 4 * Math.sin(Math.PI * u)];
  g.strokeStyle = 'rgb(92,116,72)'; g.lineWidth = 1.1; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 12; i++) { const [x, y] = pt(i / 12); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  for (let i = 0; i < 3; i++) {
    const u = 0.22 + i * 0.27, [x, y] = pt(u), sz = 6.2 - i * 1.2;
    catnipLeaf(g, x, y, -2.1 + i * 0.15, sz, R);
    catnipLeaf(g, x, y, 0.55 + i * 0.1, sz * 0.92, R);
  }
  const [tx, ty] = pt(1);
  for (let i = 0; i < 9; i++) {
    const k = i / 9;
    g.fillStyle = rgba(i % 2 ? [190, 160, 214] : [214, 190, 230], 0.95);
    g.beginPath(); g.arc(tx + 3 * k + (R() - 0.5), ty - 2 * k + (R() - 0.5) * 1.6, 1.1 - k * 0.4, 0, TAU); g.fill();
  }
}

// a plum blossom, pale pink with a deep centre (for his crown)
function paintBlossom(g) {
  const R = rng(191);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2 + (R() - 0.5) * 0.15, x = Math.cos(a) * 2.7, y = Math.sin(a) * 2.7;
    const gr = g.createRadialGradient(x * 0.4, y * 0.4, 0.3, x, y, 2.9);
    gr.addColorStop(0, 'rgb(236,150,170)'); gr.addColorStop(0.5, 'rgb(250,222,228)'); gr.addColorStop(1, 'rgb(255,244,246)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, 2.8, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(176,80,104,.45)'; g.lineWidth = 0.22; g.stroke();
  }
  g.fillStyle = 'rgb(176,40,66)';
  g.beginPath(); g.arc(0, 0, 1.2, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(90,40,30,.8)'; g.lineWidth = 0.18;
  for (let i = 0; i < 9; i++) {
    const a = R() * TAU, r = 1.8 + R() * 0.7;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke();
    g.fillStyle = 'rgb(236,190,80)';
    g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 0.3, 0, TAU); g.fill();
  }
}

// his hats, drawn live so they turn with him (head units, origin where the
// hat sits on top of his head; sq is how much of the top we see, yw his turn)
function drawHat(g, SP, kind, sq, yw) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 1) {
    // a French beret: a soft wool disc pulled over to one side, and its little stalk
    const lean = 5 * Math.cos(yw) + 2, top = -6 - 4 * sq;
    let gr = g.createRadialGradient(lean - 6, top - 5, 2, lean, top, 26);
    gr.addColorStop(0, 'rgb(190,62,64)'); gr.addColorStop(0.6, 'rgb(150,38,46)'); gr.addColorStop(1, 'rgb(96,20,28)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(lean, top, 23, 8 + 12 * sq, -0.1, 0, TAU);
    g.fill();
    // where it pulls in round his head
    g.fillStyle = 'rgb(84,18,26)';
    g.beginPath(); g.ellipse(0, 0, 15.5, 3 + 9 * sq, 0, 0, Math.PI); g.lineTo(-15.5, 0); g.fill();
    g.fillStyle = 'rgba(255,220,214,.12)';
    for (let i = 0; i < 18; i++) { const a = i * 2.39, r = 4 + (i * 7.3) % 17; g.beginPath(); g.arc(lean + Math.cos(a) * r, top + Math.sin(a) * r * (0.35 + sq), 0.7, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(40,8,12,.75)'; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(lean, top, 23, 8 + 12 * sq, -0.1, 0, TAU); g.stroke();
    const sx = lean + 3 * Math.sin(yw), sy = top - 8 - 10 * sq;
    g.strokeStyle = 'rgb(70,14,22)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(sx, sy + 2); g.quadraticCurveTo(sx + 1, sy - 1, sx + 2.4, sy - 3); g.stroke();
    gr = null;
  } else if (kind === 2) {
    // a little gat: a see-through brim of black horsehair, a tall crown, a strap of amber beads
    const br = 31, bry = 3 + 13 * sq;
    for (const side of [-1, 1]) {
      const th = side * 1.25 + yw, z = Math.cos(th);
      if (z < -0.1) continue;
      for (let k = 0; k < 6; k++) {
        const x = Math.sin(th) * (br - 4) + side * k * 0.8, y = 1 + k * 3.4;
        g.fillStyle = 'rgb(206,142,58)';
        g.beginPath(); g.arc(x, y, 1.35, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,236,190,.7)';
        g.beginPath(); g.arc(x - 0.4, y - 0.4, 0.45, 0, TAU); g.fill();
      }
    }
    g.fillStyle = 'rgba(14,14,18,.5)';
    g.beginPath(); g.ellipse(0, 0, br, bry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(52,52,60,.55)'; g.lineWidth = 0.35;
    for (let r = 12; r < br; r += 2.6) { g.beginPath(); g.ellipse(0, 0, r, r * bry / br, 0, 0, TAU); g.stroke(); }
    g.strokeStyle = 'rgba(8,8,10,.9)'; g.lineWidth = 0.9;
    g.beginPath(); g.ellipse(0, 0, br, bry, 0, 0, TAU); g.stroke();
    const ch = 21, cw0 = 10.5, cw1 = 9.4;
    g.fillStyle = 'rgba(10,10,14,.86)';
    g.beginPath();
    g.moveTo(-cw0, 0); g.lineTo(-cw1, -ch); g.ellipse(0, -ch, cw1, cw1 * (0.15 + 0.5 * sq), 0, Math.PI, 0); g.lineTo(cw0, 0);
    g.ellipse(0, 0, cw0, cw0 * (0.15 + 0.5 * sq), 0, 0, Math.PI);
    g.fill();
    g.strokeStyle = 'rgba(80,80,92,.35)'; g.lineWidth = 0.3;
    for (let i = -8; i <= 8; i++) { const x0 = i * 1.2, x1 = i * 1.08; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, -ch); g.stroke(); }
    g.fillStyle = 'rgb(26,26,32)';
    g.beginPath(); g.ellipse(0, -ch, cw1, cw1 * (0.15 + 0.5 * sq), 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgb(36,36,42)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, -2, cw0 - 0.2, (cw0 - 0.2) * (0.15 + 0.5 * sq), 0, 0, Math.PI); g.stroke();
    g.strokeStyle = 'rgba(190,196,212,.35)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-cw1 + 2.4, -ch + 2); g.lineTo(-cw0 + 2.4, -3); g.stroke();
  } else if (kind === 3) {
    // a crown of plum blossoms: a twig ring with flowers all round it, the far ones dimmer
    const rx = 23, ry = 2.5 + 11 * sq, n = 9;
    const ring = (a0, a1) => { g.beginPath(); for (let i = 0; i <= 16; i++) { const a = lerp(a0, a1, i / 16); const x = Math.cos(a) * rx, y = Math.sin(a) * ry; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    g.strokeStyle = 'rgb(66,44,34)'; g.lineWidth = 1.5;
    ring(Math.PI, TAU);
    const sp = SP.blossom;
    const flowers = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + yw + 0.2; flowers.push([a, Math.sin(a)]); }
    flowers.sort((p, q) => p[1] - q[1]);
    for (const [a, z] of flowers) {
      if (z >= 0) continue;
      g.globalAlpha = 0.8;
      g.save(); g.translate(Math.cos(a) * rx, Math.sin(a) * ry); g.scale(0.85, 0.85 * (0.6 + 0.4 * sq)); blit(g, sp); g.restore();
    }
    g.globalAlpha = 1;
    ring(0, Math.PI);
    for (const [a, z] of flowers) {
      if (z < 0) continue;
      g.save(); g.translate(Math.cos(a) * rx, Math.sin(a) * ry); g.rotate(Math.cos(a) * 0.4); g.scale(1.1, 1.1 * (0.7 + 0.3 * sq)); blit(g, sp); g.restore();
    }
    g.fillStyle = 'rgb(150,40,62)';
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI + 0.4 + yw; if (Math.sin(a) < 0) continue; g.beginPath(); g.ellipse(Math.cos(a) * rx * 1.04, Math.sin(a) * ry - 1.4, 1.4, 1.9, a, 0, TAU); g.fill(); }
  }
}

// paper and ink for his paintings: a sheet of hanji with long fibres in it
const ART_W = 100, ART_H = 70, ART_PX = 2.6;
function makeHanji(seed) {
  const c = document.createElement('canvas');
  c.width = Math.round(ART_W * ART_PX); c.height = Math.round(ART_H * ART_PX);
  const g = c.getContext('2d');
  const R = rng(seed);
  g.scale(ART_PX, ART_PX);
  g.fillStyle = 'rgb(247,241,227)';
  g.fillRect(0, 0, ART_W, ART_H);
  for (let i = 0; i < 140; i++) {
    const x = R() * ART_W, y = R() * ART_H, a = R() * TAU, L = 3 + R() * 12;
    g.strokeStyle = R() < 0.6 ? rgba([214, 198, 166], 0.35) : rgba([255, 253, 246], 0.6);
    g.lineWidth = 0.15 + R() * 0.2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * L * 0.5, y + Math.sin(a + 0.5) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  // soft, slightly darker deckled edges
  const gr = g.createRadialGradient(ART_W / 2, ART_H / 2, ART_H * 0.3, ART_W / 2, ART_H / 2, ART_W * 0.62);
  gr.addColorStop(0, 'rgba(200,180,140,0)'); gr.addColorStop(1, 'rgba(200,180,140,.22)');
  g.fillStyle = gr;
  g.fillRect(0, 0, ART_W, ART_H);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
// one paw print in ink (paper units): the big pad and four toes, drier as the ink runs out
const INK_RGB = [20, 18, 22];
function pawPrint(g, x, y, rot, sz, ink, R) {
  const c = document.createElement('canvas'), px = ART_PX * 2;
  c.width = c.height = Math.ceil(22 * sz * px);
  const h = c.getContext('2d');
  h.setTransform(px * sz, 0, 0, px * sz, c.width / 2, c.height / 2);
  h.fillStyle = rgba(INK_RGB, 0.65 + 0.3 * ink);
  h.beginPath();
  h.moveTo(-4.6, 4.2); h.quadraticCurveTo(-6.2, 0.6, -3.2, -0.6); h.quadraticCurveTo(0, -2, 3.2, -0.6); h.quadraticCurveTo(6.2, 0.6, 4.6, 4.2);
  h.quadraticCurveTo(2.4, 6.6, 0, 5.2); h.quadraticCurveTo(-2.4, 6.6, -4.6, 4.2);
  h.fill();
  for (const [tx, ty, a] of [[-5.6, -4, -0.4], [-2, -6.6, -0.12], [2, -6.6, 0.12], [5.6, -4, 0.4]]) { h.beginPath(); h.ellipse(tx, ty, 2, 2.6, a, 0, TAU); h.fill(); }
  // dry brush: the less ink, the more paper shows through
  h.globalCompositeOperation = 'destination-out';
  const holes = Math.round(30 + (1 - ink) * 160);
  for (let i = 0; i < holes; i++) {
    h.globalAlpha = 0.3 + R() * 0.7;
    h.beginPath(); h.arc((R() - 0.5) * 15, (R() - 0.55) * 15, 0.2 + R() * (0.3 + (1 - ink) * 0.6), 0, TAU); h.fill();
  }
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(c, -c.width / (2 * ART_PX * 2), -c.height / (2 * ART_PX * 2), c.width / (ART_PX * 2), c.height / (ART_PX * 2));
  g.restore();
  // a little bleed into the paper round the edge
  stamp(g, x, y, 6.5 * sz, INK_RGB, 0.05 * ink, 0.4);
}

// her books, each one lying flat with its spine to us
const BOOKS = [
  { title: '토지', col: [50, 58, 100], band: [214, 182, 110], w: 46, h: 7.2 },
  { title: 'Le Rouge et le Noir', col: [146, 32, 38], col2: [28, 24, 26], band: [214, 182, 110], w: 42, h: 6 },
  { title: '단원 화첩', col: [226, 212, 178], band: [184, 50, 42], w: 48, h: 5.2, ink: true },
  { title: '孫子兵法', col: [44, 74, 58], band: [208, 176, 104], w: 38, h: 6.4 },
  { title: 'Vom Kriege', col: [86, 58, 44], band: [212, 180, 112], w: 44, h: 7.6 },
];
function drawBookSpine(g, b, w, h) {
  // the top cover, seen a little from above, then the spine
  g.fillStyle = rgba(mix(b.col, [255, 250, 240], 0.18), 1);
  g.beginPath(); g.moveTo(-w / 2, -h); g.lineTo(w / 2, -h); g.lineTo(w / 2 - 2.2, -h - 3.4); g.lineTo(-w / 2 + 2.6, -h - 3.4); g.closePath(); g.fill();
  const gr = g.createLinearGradient(0, -h, 0, 0);
  gr.addColorStop(0, rgba(mix(b.col, [255, 255, 255], 0.14), 1)); gr.addColorStop(1, rgba(mix(b.col, [0, 0, 0], 0.25), 1));
  g.fillStyle = gr;
  g.beginPath(); g.roundRect ? g.roundRect(-w / 2, -h, w, h, 1.2) : g.rect(-w / 2, -h, w, h); g.fill();
  if (b.col2) { g.fillStyle = rgba(b.col2, 1); g.fillRect(w / 2 - w * 0.42, -h, w * 0.42 - 0.6, h); }
  g.strokeStyle = rgba(b.band, 0.85); g.lineWidth = 0.55;
  for (const x of [-w / 2 + 4, w / 2 - 4]) { g.beginPath(); g.moveTo(x, -h + 0.6); g.lineTo(x, -0.6); g.stroke(); }
  g.fillStyle = rgba(b.ink ? [60, 44, 34] : b.band, 0.95);
  g.font = `${(h * 0.62).toFixed(2)}px "Gowun Batang", "Noto Serif KR", Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(b.title, -1, -h / 2 + 0.3, w - 11);
  if (b.ink) { g.fillStyle = rgba(SEAL_RGB, 0.9); g.fillRect(w / 2 - 7.8, -h + 1.2, 2.4, 2.4); }
  g.strokeStyle = 'rgba(40,28,22,.55)'; g.lineWidth = 0.5;
  g.beginPath(); g.roundRect ? g.roundRect(-w / 2, -h, w, h, 1.2) : g.rect(-w / 2, -h, w, h); g.stroke();
}
// a book open on the cushion, in its own flat units (90 x 60), k from shut (0) to open (1)
function drawOpenBook(g, b, k, i, R) {
  const col = b.col;
  // the cover, a touch bigger than the pages
  g.fillStyle = rgba(mix(col, [0, 0, 0], 0.15), 1);
  if (k > 0.5) { g.beginPath(); g.roundRect ? g.roundRect(-48, -33, 96, 66, 2.5) : g.rect(-48, -33, 96, 66); g.fill(); }
  else { g.beginPath(); g.rect(-1, -33, 49, 66); g.fill(); }
  // the right-hand pages
  const page = (x0, x1, left) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, left ? 'rgb(244,238,222)' : 'rgb(226,216,196)'); gr.addColorStop(0.12, 'rgb(250,246,234)'); gr.addColorStop(0.88, 'rgb(250,246,234)'); gr.addColorStop(1, left ? 'rgb(226,216,196)' : 'rgb(244,238,222)');
    g.fillStyle = gr;
    g.fillRect(Math.min(x0, x1), -29, Math.abs(x1 - x0), 58);
  };
  page(0, 44, false);
  if (k > 0.5) page(-44, 0, true);
  // what's printed on them
  const lines = (x0, x1, y0, y1, step, rgb) => {
    g.strokeStyle = rgba(rgb || [120, 112, 104], 0.6); g.lineWidth = 0.9;
    for (let y = y0; y < y1; y += step) { const e = x1 - (R() < 0.18 ? (x1 - x0) * R() * 0.6 : 0); g.beginPath(); g.moveTo(x0, y); g.lineTo(e, y); g.stroke(); }
  };
  const right = () => {
    if (i === 3) { g.strokeStyle = 'rgba(70,60,52,.6)'; g.lineWidth = 0.9; for (let x = 38; x > 6; x -= 4.2) for (let y = -24; y < 22; y += 3.2) if (R() < 0.85) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 1.8); g.stroke(); } }
    else if (i === 2) {
      // a little ink landscape: two peaks, a pine, a seal
      stroke(g, { pts: [[8, 14], [16, -2], [22, 6], [30, -12], [40, 12]], width: 2.4, dry: 0.5, tone: 0.75, rgb: INK_RGB, seed: 200 + i, bristles: 6 });
      stroke(g, { pts: [[14, 18], [14, 4]], width: 1.4, dry: 0.4, tone: 0.8, rgb: INK_RGB, seed: 210, bristles: 4 });
      stamp(g, 14, 4, 4, [40, 60, 40], 0.5, 0.4);
      g.fillStyle = rgba(SEAL_RGB, 0.85); g.fillRect(34, 18, 4, 4);
    } else if (i === 4) {
      // a little diagram: two fronts, arrows, a hill
      lines(5, 39, -24, -6, 3.2);
      g.strokeStyle = 'rgba(60,50,44,.75)'; g.lineWidth = 1;
      g.strokeRect(9, 2, 8, 4); g.strokeRect(27, 12, 8, 4);
      g.beginPath(); g.moveTo(18, 6); g.lineTo(26, 12); g.moveTo(26, 12); g.lineTo(23.5, 11.6); g.moveTo(26, 12); g.lineTo(25, 9.8); g.stroke();
      g.beginPath(); g.moveTo(6, 22); g.quadraticCurveTo(14, 14, 22, 22); g.stroke();
    } else lines(5, 39, -24, 25, 3.2);
  };
  right();
  if (k > 0.5) {
    if (i === 3) { g.strokeStyle = 'rgba(70,60,52,.6)'; g.lineWidth = 0.9; for (let x = -6; x > -40; x -= 4.2) for (let y = -24; y < 22; y += 3.2) if (R() < 0.85) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 1.8); g.stroke(); } }
    else if (i === 1) { g.fillStyle = 'rgba(146,32,38,.85)'; g.font = '9px Georgia, serif'; g.fillText('L', -38, -19); lines(-31, -5, -24, -14, 3.2); lines(-39, -5, -12, 25, 3.2); }
    else lines(-39, -5, -24, 25, 3.2);
    // the gutter
    const gr = g.createLinearGradient(-6, 0, 6, 0);
    gr.addColorStop(0, 'rgba(120,100,70,0)'); gr.addColorStop(0.5, 'rgba(120,100,70,.35)'); gr.addColorStop(1, 'rgba(120,100,70,0)');
    g.fillStyle = gr; g.fillRect(-6, -29, 12, 58);
  }
  // the cover swinging over, while it opens
  if (k < 1) {
    const x = 44 * Math.cos(Math.PI * k);
    g.fillStyle = Math.abs(x) < 2 ? rgba(col, 1) : x > 0 ? rgba(mix(col, [255, 255, 255], 0.1), 1) : 'rgb(240,232,214)';
    g.beginPath(); g.moveTo(0, -31); g.lineTo(x, -31 - Math.sin(Math.PI * k) * 6); g.lineTo(x, 31 - Math.sin(Math.PI * k) * 6); g.lineTo(0, 31); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,28,22,.45)'; g.lineWidth = 0.6; g.stroke();
  }
  g.strokeStyle = 'rgba(70,56,44,.5)'; g.lineWidth = 0.6;
  g.strokeRect(k > 0.5 ? -44 : 0, -29, k > 0.5 ? 88 : 44, 58);
}

// how long each thing he does lasts, and what can interrupt what
const PRI = {
  sleep: 0, groom: 1, yawn: 1, window: 1, tilt: 1, wake: 1, love: 1, glare: 1, unimpressed: 1, bookrest: 1, nudge: 1,
  pat: 2, boop: 2, brush: 2, huff: 2, psst: 2, ignore: 2, blinkback: 2, shake: 2,
  eat: 3, bat: 3, pounce: 3, laser: 3, nip: 3, paint: 3, book: 3, warn: 4, swat: 5, buck: 5, push: 5, bury: 5, sit: 5,
};
const DUR = {
  sleep: 1e12, groom: 3800, yawn: 2200, window: 5200, tilt: 1000, wake: 1300, love: 1700, glare: 1900, pat: 900, boop: 1500, eat: 4600, bat: 380, pounce: 2000, warn: 720, swat: 600, buck: 1300, push: 3500, bury: 2900, sit: 3800,
  laser: 1e9, brush: 3600, huff: 1500, psst: 1500, ignore: 2600, blinkback: 2000, unimpressed: 1800, shake: 900, nip: 7600, paint: 1e9, book: 2700, bookrest: 12000, nudge: 3000,
};
const DUR_RM = {
  pat: 800, boop: 1200, eat: 2600, bat: 600, pounce: 1400, warn: 900, swat: 1100, buck: 900, push: 2000, bury: 1700, sit: 2400, tilt: 900, wake: 400,
  brush: 1800, huff: 1000, psst: 1100, ignore: 1600, blinkback: 1300, unimpressed: 1200, shake: 500, nip: 3400, book: 1400, bookrest: 8000, nudge: 1600,
};
// the less important things he does that a passing pointer shouldn't cut short
const STICKY = new Set(['wake', 'tilt', 'unimpressed', 'bookrest', 'nudge']);
const BULLY = ['swat', 'push', 'bury', 'sit'];

export function createCat(root, { t = (k) => k, reduceMotion = false, mobile = false, sound = {}, name = '' } = {}) {
  if (!root) return null;
  if (!root.querySelector('.cat-more-panel') || !root.querySelector('.cat-grab--dot')) {
    root.classList.add('cat');
    root.innerHTML = CAT_INNER;
  }
  const $ = (q) => root.querySelector(q);
  const stage = $('.cat-stage'), bgC = $('.cat-bg'), fgC = $('.cat-fg');
  const grabEl = $('.cat-grab:not(.cat-grab--toy):not(.cat-grab--dot)'), toyEl = $('.cat-grab--toy'), dotEl = $('.cat-grab--dot');
  const fg = fgC.getContext && fgC.getContext('2d');
  if (!fg || !bgC.getContext('2d')) return null;
  const capMain = $('.cat-caption-main'), capHint = $('.cat-caption-hint');
  const countN = $('.cat-count-n'), countNote = $('.cat-count-note');
  const btnRow = $('.cat-btns'), petText = $('.cat-btn-pet');
  const moreBtn = $('.cat-more'), morePanel = $('.cat-more-panel');
  const btn = {
    poke: $('.cat-btn--poke'), swat: $('.cat-btn--swat'), pet: $('.cat-btn--pet'), boop: $('.cat-btn--boop'), treat: $('.cat-btn--treat'), toy: $('.cat-btn--toy'),
    laser: $('.cat-btn--laser'), brush: $('.cat-btn--brush'), nip: $('.cat-btn--nip'), psst: $('.cat-btn--psst'), blink: $('.cat-btn--blink'),
    hat: $('.cat-btn--hat'), paint: $('.cat-btn--paint'), book: $('.cat-btn--book'),
  };
  const tally = $('.cat-tally'), tallyPets = $('.cat-tally-pets'), tallyTreats = $('.cat-tally-treats'), tallyArt = $('.cat-tally-art');
  const sayEl = $('.cat-say');
  const touchy = matchMedia('(hover: none)').matches;
  const hit = document.createElement('canvas').getContext('2d');
  const nm = String(name || '').trim();
  const tt = (k) => {
    let v = null;
    try { v = t(k); } catch { v = null; }
    return v && v !== k ? v : (CAT_STRINGS.en[k] ?? k);
  };
  const play = (n, ...a) => { try { sound && typeof sound[n] === 'function' && sound[n](...a); } catch { /* no sound is fine */ } };
  const RM = !!reduceMotion;
  const now0 = () => performance.now();
  const idle = window.requestIdleCallback ? (f, o) => window.requestIdleCallback(f, o) : (f) => setTimeout(f, 30);
  // painting comes in slices: one after another while he's on screen (or
  // about to be), in idle moments otherwise
  const slice = (f) => (active ? setTimeout(f, 0) : idle(f, { timeout: 1200 }));
  const budget = (dl) => (active ? 14 : dl && dl.timeRemaining ? clamp(dl.timeRemaining(), 6, 30) : 10);

  let L = null, SP = null, CS = null, spKey = '', csKey = '', W = 0, H = 0, dpr = 0;
  let active = true, destroyed = false, ready = false, raf = 0, last = 0, lastDraw = 0;
  const ac = new AbortController();
  const opt = { signal: ac.signal };
  const timers = new Set();
  const later = (f, ms) => { const id = setTimeout(() => { timers.delete(id); if (!destroyed) f(); }, ms); timers.add(id); return id; };

  // the avocado
  const A = {
    x: 0, y: 0, vx: 0, vy: 0, ang: 0, w: 0, sq: 0, sqv: 0, sqA: -Math.PI / 2,
    alpha: 1, scale: 1, grab: null, place: null, fade: null, sleeping: true, restT: 0, leanT: 0, grounded: false,
    face: 'smug', faceUntil: 0, worriedAt: -1e9, touchedCat: false, lastMove: -1e9, fast: false,
    carry: null, under: false, mash: 0, sink: 0, mound: 0, away: 0, sent: false, hop: null,
  };
  // his pose: P is what's drawn, T is where it's heading this frame
  const P = restPose(), T = restPose(), REST = restPose();
  const KEYS = Object.keys(REST).filter((k) => k !== 'tPh');
  const RATE = {};
  for (const k of KEYS) RATE[k] = 9;
  for (const k of ['nX', 'nY', 'nUp', 'fX', 'fY', 'fUp', 'jaw', 'noseTw', 'tongue', 'lick', 'chew', 'tFlick', 'earTL', 'earTR', 'gx', 'gy']) RATE[k] = 20;
  for (const k of ['lidU', 'lidL', 'earFL', 'earFR', 'earSL', 'earSR']) RATE[k] = 13;
  for (const k of ['yaw', 'pitch', 'roll', 'hx', 'hy']) RATE[k] = 6.5;
  RATE.pupil = 3;
  RATE.joy = 7;
  RATE.puff = 12;
  const rate = { ...RATE };
  // the rest of him: moods, timers, what he's up to
  const C = {
    act: null, swat: null, lastBully: '', bph: 0, blink: null, blinkAt: 0, tw: null, twAt: 0, curlPh: 0,
    happy: 0, petZone: 'back', petUntil: 0, stim: 0, stimAt: 0, stimKick: 0, stimMax: 4.4, grumpyUntil: 0,
    disgust: 0, blepAt: 0, blepUntil: 0, alert: 0, meowAt: -1e9, mrrpAt: -1e9, lastSwat: -1e9,
    lastUser: 0, idleAt: 0, zAt: 0, avoSeenAt: 0, toyT: -1e9, toyStill: 0, batAt: -1e9, pounceAt: -1e9, agit: 0, swishUntil: 0,
    boopSayT: -1e9, faceUntil: 0, batN: 0, autoN: 0,
    // his tail when something bumps it: how far it's bent, how fast, where, and the flick back
    tb: 0, tbv: 0, tbu: 0.6, tailTouch: -1e9, flickAt: -1e9, flickDir: 0, flickHit: true,
    // still staring where the laser was, fur standing up, ink on his paw
    stare: null, puffAt: -1e9, ink: 0,
  };
  const LK = { mode: 0, x: 0, y: 0, pupil: 0.3, flat: false };
  const pom = { x: 0, y: 0, vx: 0, vy: 0, held: null, hx: 0, hy: 0, auto: null, pinned: null, still: 0, speed: 0 };
  const treat = { on: false, state: '', t0: 0, x: 0, y: 0, x0: 0, y0: 0, a: 0 };
  const win = { kind: '', t0: 0, x: 0, y: 0, px: 0, py: 0, fx: 0, fy: 0, flip: 1, dur: 0, perched: false };
  const fx = { purrs: [], words: [], seals: [], rings: [], strokes: [], zs: [], scratches: [], calls: [] };
  // the laser dot (stage px); with a mouse it follows the pointer, else it dances on its own
  const laser = { on: false, x: 0, y: 0, until: 0, auto: null, user: false, drag: null, lastMove: -1e9, t0: 0, caught: -1e9, said: false };
  // the brush, and the fluff it pulls out: tufts in the air, and a little pile on the cushion
  const brush = { on: false, until: 0, x: 0, y: 0, a: 0, lastX: null, lastT: -1e9, dist: 0, against: 0, sayT: -1e9 };
  const tufts = [], pile = { n: 0 };
  // hats: 0 none, 1 beret, 2 gat, 3 plum blossoms; and one flying off
  const hat = { i: 0, t0: -1e9, off: null };
  const nip = { at: -1e9, sprig: null };
  // paintings: the one on the go, the one on the wall, how many so far
  const art = { n: 0, cur: null, wall: null, fly: null };
  // her books: which are on the stack (bottom first), the one open in front of him, one on the floor
  const books = { stack: [0, 1, 2, 3, 4], open: -1, k: 0, fly: null, fallen: null, next: 0, cache: new Map() };
  const chat = { psst: [], you: null };
  const pointer = { x: 0, y: 0, t: -1e9 };
  const pet = { dist: 0, lastX: null, dir: 0, flips: 0, t: 0, spawnT: 0, sayT: -1e9, sayZone: '', zone: '' };
  let tapCat = null, jarT = -1e9, treatQ = 0;
  let count = 0, lastMilestone = 0, lastPurr = -1e9, pets = 0, treats = 0, petIdx = 0;

  // layout
  function computeLayout(w, h) {
    const narrow = w < 600;
    let s = narrow ? Math.min(w / 360, (h - 110) / 440) : Math.min((h - 70) / 440, w / 820);
    s = clamp(s, 0.55, 1.3);
    const floorY = h - (narrow ? 62 : 54);
    const topY = floorY - 272 * s;
    const catX = narrow ? clamp(w * 0.46, 168 * s, w - 158 * s) : w * 0.38;
    const plat = { x: catX, y: topY, rx: 98 * s, ry: 25 * s, th: 22 * s };
    const low = { x: catX + 62 * s, y: topY + 152 * s, rx: (narrow ? 104 : 118) * s, ry: 28 * s, th: 20 * s };
    const base = { x: catX + (narrow ? 4 : 22) * s, y: floorY - 12 * s, rx: (narrow ? 84 : 132) * s, ry: 22 * s, th: 12 * s };
    const post = { x: catX - 8 * s, w: 34 * s };
    const post2 = { x: low.x + (narrow ? 34 : 58) * s, w: 30 * s };
    const win = narrow
      ? { x0: w * 0.09, y0: 14, x1: w - 12, y1: topY + 36 * s }
      : { x0: catX - 74 * s, y0: Math.max(16, topY - 250 * s), x1: Math.min(w - 60, catX + 440 * s), y1: topY + 36 * s };
    const sign = !narrow && catX - 180 * s > 120 ? { x: Math.max(70 * s, (catX - 180 * s) * 0.55), y: topY - 60 * s } : null;
    const f = 15 * s;
    const o = {
      W: w, H: h, s, narrow, floorY, topY, catX, plat, low, base, post, post2, win, sign,
      wallBase: floorY - 30 * s,
      // (far enough out from the post that a free swing never reaches it)
      pom: { x: catX + 70 * s, y: topY + 39 * s, len: 74 * s, r: 14 * s },
      home: { x: narrow ? w - 32 * s : Math.min(w - 90 * s, catX + 330 * s) },
      jar: { x: narrow ? clamp((base.x - base.rx) * 0.5, 30 * s, base.x - base.rx - 24 * s) : Math.max(60 * s, base.x - base.rx - 70 * s), y: floorY + 4 * s },
      glass: { x0: win.x0 + f, y0: win.y0 + f, x1: win.x1 - f, y1: win.y1 - f * 0.8 },
      G: 2500 * s,
    };
    // colliders: capsules (a to b, radius); flat ones can be stood on
    const cap = (ax, ay, bx, by, r, x = {}) => ({ ax, ay, bx, by, r, e: 0.35, mu: 0.5, ...x });
    o.cols = [
      cap(plat.x - plat.rx + 10 * s, topY + 10 * s, plat.x + plat.rx - 10 * s, topY + 10 * s, 10 * s, { flat: true, e: 0.3 }),
      cap(catX - 104 * s, topY - 54 * s, catX + 64 * s, topY - 52 * s, 50 * s, { cat: true, e: 0.25, mu: 0.3 }),
      cap(catX + HEAD_REST[0] * s, topY + HEAD_REST[1] * s, catX + HEAD_REST[0] * s, topY + HEAD_REST[1] * s, 50 * s, { cat: true, e: 0.25, mu: 0.3 }),
      cap(post.x, topY + 26 * s, post.x, base.y, post.w / 2),
      cap(low.x - low.rx + 10 * s, low.y + 10 * s, low.x + low.rx - 10 * s, low.y + 10 * s, 10 * s, { flat: true, e: 0.3 }),
      cap(post2.x, low.y + 24 * s, post2.x, base.y, post2.w / 2),
      cap(base.x - base.rx + 8 * s, base.y + 6 * s, base.x + base.rx - 8 * s, base.y + 6 * s, 6 * s, { flat: true, e: 0.3 }),
      cap(win.x0 - 8 * s, win.y1 + 4 * s, win.x1 + 8 * s, win.y1 + 4 * s, 4 * s, { flat: true, e: 0.3, sill: true }),
    ];
    // her books: on the sill right beside him if there's room, else on the middle platform
    const fwE = narrow ? 14 : Math.min(160, w * 0.13);
    const sillTop = win.y1 - 3 * s;
    const onSill = !narrow && (win.x1 - catX) / s > 210 && (w - fwE - catX) / s > 212;
    o.books = onSill ? { x: catX + 178 * s, y: sillTop, sill: true } : { x: low.x + low.rx * 0.6, y: low.y + 7 * s, sill: false };
    const stackH = BOOKS.reduce((a, b) => a + b.h, 0) + 3.4;
    o.cols.push(cap(o.books.x - 20 * s, o.books.y - stackH * s + 4 * s, o.books.x + 20 * s, o.books.y - stackH * s + 4 * s, 4 * s, { flat: true, e: 0.3, sill: onSill, books: true }));
    // the ink dish sits on the sill just past his paws
    o.dish = { x: catX + 132 * s, y: sillTop - 4.6 * s };
    // a spot on the wall for his latest masterpiece, if there is one
    const aw = 66 * s, ah = aw * (ART_H / ART_W);
    o.wall = null;
    if (!narrow) {
      const rx0 = win.x1 + 18 * s, rx1 = w - fwE - 8 * s;
      if (rx1 - rx0 > aw + 12 * s) o.wall = { x: (rx0 + rx1) / 2, y: win.y0 + 70 * s, w: aw, h: ah };
      else if (sign && sign.y + 48 * s + 34 * s + ah < floorY - 120 * s && sign.x - aw / 2 > 10) o.wall = { x: sign.x + 4 * s, y: sign.y + 48 * s + 30 * s + ah / 2, w: aw, h: ah };
    }
    o.chest = { x: catX + 86 * s, y: topY - 40 * s };
    o.bang = `italic ${30 * s}px "Instrument Serif", Georgia, serif`;
    return o;
  }
  const cx = (x) => (x - L.catX) / L.s;
  const cy = (y) => (y - L.topY) / L.s;

  // the first surface straight below (x, y): the y an object would rest on
  function surfaceBelow(x, y) {
    let best = L.floorY;
    for (const c of L.cols) {
      if (!c.flat) continue;
      if (x < c.ax || x > c.bx) continue;
      const top = c.ay - c.r;
      if (top >= y - 2 && top < best) best = top;
    }
    return best;
  }
  const avoBottom = () => 25 * L.s;
  // the ground under x: the floor, or the base of the cat tree
  function groundAt(x) {
    const b = L.cols[6];
    return x > b.ax && x < b.bx ? b.ay - b.r : L.floorY;
  }
  function restOnFloorAt(x) {
    A.x = clamp(x, 34 * L.s, L.W - 34 * L.s);
    A.y = groundAt(A.x) - avoBottom();
    A.vx = A.vy = A.w = 0; A.ang = 0; A.sleeping = true; A.away = 0; A.sent = false; A.hop = null;
  }
  function resetToy() {
    pom.x = L.pom.x; pom.y = L.pom.y + L.pom.len; pom.vx = pom.vy = 0;
    pom.held = null; pom.pinned = null;
  }

  // painting
  // with `then`, the props are painted a sprite at a time (the old ones
  // stretch to fit meanwhile) and then() runs once they're in
  let propJob = null;
  function buildSprites(then) {
    const { s } = L;
    const key = `${s.toFixed(4)}|${dpr}`;
    if (!CS) { CS = catSprites(s, dpr); csKey = key; }
    else if (key !== csKey) rebuildCat(key);
    else rebuild = null;
    propJob = null;
    if (key === spKey && SP) { if (then) then(); return; }
    if (!then) { spKey = key; SP = propSprites(s, dpr); return; }
    const out = {}, it = propGen(s, dpr, out), job = propJob = {};
    const run = (dl) => {
      if (destroyed || job !== propJob) return;
      const t1 = now0(), b = Math.min(6, budget(dl));
      let done = false;
      do done = it.next().done; while (!done && now0() - t1 < b);
      if (!done) { slice(run); return; }
      propJob = null;
      SP = out; spKey = key;
      then();
    };
    slice(run);
  }
  function propSprites(s, dpr) {
    const out = {};
    for (const x of propGen(s, dpr, out)) void x;
    return out;
  }
  // the room's props: the top platform, the avocado, the jar, a treat, the pompom, the seal
  function* propGen(s, dpr, SP) {
    SP.plat = makeSprite(-108, -36, 108, 64, s, dpr, (g) => paintDisc(g, hit, 98, 25, 22, 110), true);
    yield;
    SP.avo = makeSprite(-36, -60, 36, 32, s, dpr, paintAvocado);
    yield;
    SP.jar = makeSprite(-32, -60, 32, 8, s, dpr, paintJar);
    SP.treat = makeSprite(-9, -5, 7, 5, s, dpr, paintTreat);
    SP.pom = makeSprite(-20, -20, 20, 22, s, dpr, paintPom);
    yield;
    // the newer things: a brush, an ink dish, a sprig of catnip, a plum blossom for his crown
    SP.brush = makeSprite(-34, -26, 16, 2, s * 1.3, dpr, paintBrushTool);
    SP.dish = makeSprite(-16, -6, 16, 8, s, dpr, paintDish);
    SP.sprig = makeSprite(-18, -18, 18, 9, s, dpr, paintSprig);
    SP.blossom = makeSprite(-6.5, -6.5, 6.5, 6.5, s * HS * 1.3, dpr, paintBlossom);
    yield;
    // the front lip of the top platform, drawn over his belly so he sits in the plush
    SP.lip = makeSprite(-108, -36, 108, 64, s, dpr, (g) => {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(SP.plat.c, 0, 0);
      g.restore();
      const top = new Path2D(); top.ellipse(0, 0, 98, 25, 0, 0, TAU);
      g.save(); g.clip(top);
      for (let x = -88; x <= 88; x += 4) stamp(g, x, 6.5, 6, [60, 50, 42], 0.09, 0.3);
      g.restore();
      // keep only what's in front of him: below a gentle curve across the cushion
      g.globalCompositeOperation = 'destination-in';
      const keep = new Path2D();
      keep.moveTo(-110, 6);
      for (let x = -110; x <= 110; x += 4) keep.lineTo(x, 4.5 + 2.2 * (1 - (x / 100) ** 2) + noise1(x * 0.15, 3) * 1.2);
      keep.lineTo(110, 70); keep.lineTo(-110, 70); keep.closePath();
      g.filter = `blur(${(0.7 * s * dpr).toFixed(2)}px)`;
      g.fillStyle = '#000';
      g.setTransform(s * dpr, 0, 0, s * dpr, 108 * s * dpr, 36 * s * dpr);
      g.fill(keep);
      g.filter = 'none';
    });
    settle(SP.plat);
    yield;
    // the seal: forbidden
    const sz = Math.round(54 * s * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(sz * 1.2);
    sealStamp(c.getContext('2d'), c.width / 2, c.height / 2, sz / 0.62, '禁', { seed: 9, alpha: 0.94 });
    SP.seal = { c, size: c.width / dpr };
  }

  // after a resize he's repainted a part at a time, a little after the last
  // change; the old sprites stretch to fit until then
  let rebuild = null, rebuildT = 0, settleT = 0;
  function rebuildCat(key) {
    if (rebuild && rebuild.key === key) return;
    rebuild = { key, s: L.s, d: dpr, it: null, out: {} };
    clearTimeout(rebuildT);
    timers.delete(rebuildT);
    rebuildT = later(() => { const job = rebuild; slice((dl) => rebuildStep(job, dl)); }, 150);
  }
  function rebuildStep(job, dl) {
    if (destroyed || !job || job !== rebuild) return;
    if (!job.it) job.it = catGen(job.s, job.d, job.out);
    const t1 = now0(), b = budget(dl);
    let done = false;
    do done = job.it.next().done; while (!done && now0() - t1 < b);
    if (!done) { slice((d) => rebuildStep(job, d)); return; }
    rebuild = null;
    CS = job.out; csKey = job.key;
    if (ready && L) { draw(now0()); kick(); }
  }

  function paintBg() {
    roomJob = null;
    const g = bgC.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, bgC.width, bgC.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    signFont = brushReady();
    paintRoom(g, L, hit, SP);
  }
  // the same, a part at a time on a canvas of its own, swapped in when it's done
  // (the old room stays up meanwhile)
  let roomJob = null;
  function paintBgSoon() {
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    signFont = brushReady();
    const job = roomJob = { c, it: roomGen(g, L, hit, SP) };
    const run = (dl) => {
      if (destroyed || job !== roomJob) return;
      // its parts are big ones, so a small budget: two never pile up into one long task
      const t1 = now0(), b = Math.min(6, budget(dl));
      let done = false;
      do done = job.it.next().done; while (!done && now0() - t1 < b);
      if (!done) { slice(run); return; }
      roomJob = null;
      bgC.width = c.width; bgC.height = c.height;
      bgC.getContext('2d').drawImage(c, 0, 0);
      c.width = c.height = 0;
      draw(now0()); kick();
    };
    slice(run);
  }
  // the sign is in Nanum Brush Script: repaint the room once when that font arrives
  // (with the text, since Google serves Korean fonts in unicode-range slices)
  let signFont = false;
  const SIGN_TEXT = '출입금지';
  const brushReady = () => { try { return !document.fonts || document.fonts.check('20px "Nanum Brush Script"', SIGN_TEXT); } catch { return true; } };

  function relayout(force = false) {
    const w = stage.clientWidth, h = stage.clientHeight, d = dprNow();
    if (!w || !h) return;
    if (!force && w === W && h === H && d === dpr) return;
    const old = L;
    // while it's being resized, the old room just stretches with its canvas
    // (css does that for free) and gets painted properly once things settle
    const settling = !!old && !force;
    W = w; H = h; dpr = d;
    for (const c of settling ? [fgC] : [bgC, fgC]) {
      c.width = Math.round(w * d);
      c.height = Math.round(h * d);
    }
    L = computeLayout(w, h);
    if (settling) {
      clearTimeout(settleT);
      timers.delete(settleT);
      roomJob = null; propJob = null;
      settleT = later(() => {
        if (!L) return;
        // the props first, then the room, each in slices of their own
        buildSprites(() => { if (!destroyed && L) paintBgSoon(); });
      }, 160);
    } else {
      buildSprites();
      paintBg();
    }
    grabEl.style.width = grabEl.style.height = `${Math.round(78 * L.s)}px`;
    grabEl.style.marginLeft = grabEl.style.marginTop = `${-Math.round(39 * L.s)}px`;
    toyEl.style.width = toyEl.style.height = `${Math.round(52 * L.s)}px`;
    toyEl.style.marginLeft = toyEl.style.marginTop = `${-Math.round(26 * L.s)}px`;
    dotEl.style.width = dotEl.style.height = `${Math.round(64 * L.s)}px`;
    dotEl.style.marginLeft = dotEl.style.marginTop = `${-Math.round(32 * L.s)}px`;
    // the newer things: anything in mid-air just gets where it was going
    if (old) { laser.x = clamp(laser.x * (w / old.W), 6, w - 6); laser.y = clamp(laser.y * (h / old.H), 6, h - 6); }
    laser.drag = null;
    pile.n = Math.min(60, pile.n + tufts.length); tufts.length = 0;
    if (books.fly) { if (books.fly.back && !books.stack.includes(books.fly.i)) books.stack.push(books.fly.i); books.fly = null; }
    if (books.fallen) { const fb = books.fallen; if (!fb.landed) { fb.x = fb.x1; fb.rot = fb.r1; fb.landed = true; } fb.y = bookFloor(fb.x); }
    books.cache.clear();
    if (art.fly) { if (art.fly.wall && L.wall && !art.fly.quiet) art.wall = { c: art.fly.c }; art.fly = null; }
    hat.off = null;
    C.stare = null;
    // the avocado keeps its place in the room; if he had it in his paws, that's
    // over: the action just ends and it goes back to its spot on the floor
    if (A.hop) { A.hop = null; A.sleeping = true; }
    if (A.carry || A.under) {
      if (C.act) { C.act.hit = true; endAct(C.act, now0()); }
      finishCarry();
    } else if (!old || A.sleeping) restOnFloorAt(old ? A.x * (w / old.W) : L.home.x);
    else { A.x *= w / old.W; A.y = Math.min(A.y * (h / old.H), L.floorY - avoBottom()); }
    if (A.place) { A.place = null; restOnFloorAt(L.home.x); }
    if (!A.fade) A.alpha = 1;
    A.scale = 1;
    dropToy();
    resetToy();
    if (treat.on) { treat.state = 'rest'; placeTreat(); }
    win.kind = '';
    draw(now0());
    kick();
  }

  // the avocado: physics
  const avoMass = 1;
  const inertia = () => 0.42 * (26 * L.s) ** 2;
  // one contact against a surface with normal (nx, ny); the shape being tested is in K
  const K = { I: 1, impact: 0, impN: 0, ox: 0, oy: 0, rad: 0 };
  function contact(nx, ny, pen, e, mu, col) {
    if (pen <= 0) return;
    const { s } = L, I = K.I;
    A.x += nx * pen; A.y += ny * pen;
    const px = K.ox - nx * K.rad, py = K.oy - ny * K.rad;
    const vcx = A.vx - A.w * py, vcy = A.vy + A.w * px;
    const vn = vcx * nx + vcy * ny;
    if (ny < -0.55) A.grounded = true;
    if (col && col.cat) A.touchedCat = true;
    if (vn >= 0) return;
    const rn = px * ny - py * nx;
    const ee = vn < -90 * s ? e : 0;
    const j = (-(1 + ee) * vn) / (1 / avoMass + (rn * rn) / I);
    A.vx += (j * nx) / avoMass; A.vy += (j * ny) / avoMass; A.w += (rn * j) / I;
    const tx = -ny, ty = nx;
    const vt = (A.vx - A.w * py) * tx + (A.vy + A.w * px) * ty;
    const rt = px * ty - py * tx;
    let jt = -vt / (1 / avoMass + (rt * rt) / I);
    jt = clamp(jt, -mu * j, mu * j);
    A.vx += (jt * tx) / avoMass; A.vy += (jt * ty) / avoMass; A.w += (rt * jt) / I;
    if (-vn > K.impact) { K.impact = -vn; K.impN = Math.atan2(ny, nx); }
  }
  function wake() { A.sleeping = false; A.restT = 0; A.leanT = 0; A.hop = null; }

  function stepAvocado(h, now) {
    const { s } = L;
    if (A.carry) return true;
    if (A.grab && RM) { A.ang = 0; A.w = 0; A.lastMove = now; return true; }
    if (A.grab) {
      const gx = A.grab.tx, gy = A.grab.ty;
      const nvx = (gx - A.x) * 22, nvy = (gy - A.y) * 22;
      A.vx = lerp(A.vx, nvx, 0.5); A.vy = lerp(A.vy, nvy, 0.5);
      A.x += A.vx * h; A.y += A.vy * h;
      A.x = clamp(A.x, 20 * s, L.W - 20 * s);
      A.y = clamp(A.y, 30 * s, L.floorY - avoBottom());
      const ta = clamp(A.vx / (1800 * s), -0.7, 0.7);
      A.w += ((ta - A.ang) * 120 - A.w * 14) * h;
      A.ang += A.w * h;
      A.lastMove = now;
      return true;
    }
    if (A.hop) {
      const k = clamp((now - A.hop.t0) / 480), x1 = L.low.x + L.low.rx - 34 * s, y1 = L.low.y - avoBottom();
      A.x = lerp(A.hop.x0, x1, easeInOut(k)); A.y = lerp(A.hop.y0, y1, k) - Math.sin(Math.PI * k) * 30 * s;
      A.ang = A.hop.a0 * (1 - k); A.vx = A.vy = A.w = 0;
      A.lastMove = now;
      if (k >= 1) { A.hop = null; A.sleeping = true; A.sqv -= 5; A.sqA = -Math.PI / 2; }
      return true;
    }
    if (A.place || A.sleeping || RM) return false;
    if (A.away && A.y > (A.away === 2 ? L.low.y + 30 * s : L.topY + 60 * s)) A.away = 0;
    A.vy += L.G * h;
    A.vx *= 1 - 0.05 * h;
    A.x += A.vx * h; A.y += A.vy * h; A.ang += A.w * h;
    A.grounded = false;
    K.I = inertia();
    const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
    K.impact = 0; K.impN = 0;
    for (const sh of AVO_SHAPES) {
      const ox = (sh.x * ca - sh.y * sa) * s, oy = (sh.x * sa + sh.y * ca) * s;
      const rad = sh.r * s;
      K.ox = ox; K.oy = oy; K.rad = rad;
      const cx2 = A.x + ox, cy2 = A.y + oy;
      contact(0, -1, cy2 + rad - L.floorY, 0.38, 0.6);
      contact(1, 0, rad - cx2, 0.5, 0.4);
      contact(-1, 0, cx2 + rad - L.W, 0.5, 0.4);
      contact(0, 1, rad - cy2, 0.4, 0.4);
      for (const c of L.cols) {
        // sent off by him: it falls past him and the cushion, and the sill only
        // catches it out of his reach (on a phone that's none of it)
        if (A.away && (c.cat || c === L.cols[0] || (c.sill && sillReach(A.x)))) continue;
        // pushed off the front: it drops past the middle platform and the post too
        if (A.away === 2 && (c === L.cols[3] || c === L.cols[4] || (c.books && !c.sill))) continue;
        // flat things only hold it up from above, and down on the cushion it's
        // in front of him, so he can't shove it down through it
        if (c.flat && A.y > c.ay) continue;
        if (c.cat && A.y > c.ay && Math.abs(A.x - L.plat.x) < L.plat.rx) continue;
        const qx0 = A.x + ox, qy0 = A.y + oy;
        const dx = c.bx - c.ax, dy = c.by - c.ay, ll = dx * dx + dy * dy;
        const k = ll ? clamp(((qx0 - c.ax) * dx + (qy0 - c.ay) * dy) / ll) : 0;
        const qx = c.ax + dx * k, qy = c.ay + dy * k;
        let nx = qx0 - qx, ny = qy0 - qy;
        const d = Math.hypot(nx, ny);
        const pen = rad + c.r - d;
        if (pen <= 0) continue;
        if (d < 1e-4) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
        contact(nx, ny, pen, c.e, c.mu, c);
      }
    }
    const impact = K.impact;
    if (impact > 160 * s) {
      A.sqv -= Math.min(10, impact / (170 * s));
      A.sqA = K.impN;
      if (A.fast && impact > 500 * s) setFace('dizzy', 1500);
      A.fast = false;
    }
    // back on its feet: a smug little rock upright
    const spd = Math.hypot(A.vx, A.vy);
    if (A.grounded) {
      // knocked down onto the middle platform right behind the pompom: it hops on
      // along it, so it doesn't hide the toy (or get in the way of a finger after it)
      if (A.sent && spd < 90 * s && behindToy()) {
        A.sent = false;
        A.hop = { t0: now, x0: A.x, y0: A.y, a0: wrapA(A.ang) };
        setFace('worried', 900);
        return true;
      }
      A.w *= 1 - 2.2 * h;
      if (spd < 260 * s) A.w += (-wrapA(A.ang) * 34 - A.w * 3.5) * h;
      if (spd < 10 * s && Math.abs(A.w) < 0.12 && Math.abs(wrapA(A.ang)) < 0.03) {
        A.restT += h;
        if (A.restT > 0.3) { A.sleeping = true; A.vx = A.vy = A.w = 0; A.ang = 0; A.away = 0; A.sent = false; }
      } else A.restT = 0;
      // propped against a post, only creeping upright: it can just stay like that
      if (spd < 6 * s && Math.abs(A.w) < 0.2) {
        A.leanT += h;
        if (A.leanT > 1.5 && !A.sleeping) { A.sleeping = true; A.vx = A.vy = A.w = 0; A.away = 0; A.sent = false; }
      } else A.leanT = 0;
    } else A.restT = A.leanT = 0;
    if (spd > 30 * s) A.lastMove = now;
    if (spd > 900 * s) A.fast = true;
    // never lose it
    if (!(A.x > -50 && A.x < L.W + 50 && A.y > -200 && A.y < L.H + 50)) restOnFloorAt(L.home.x);
    return !A.sleeping;
  }

  function setFace(f, ms) { A.face = f; A.faceUntil = now0() + ms; }

  // the toy: a cord from under the top platform, a pompom at the end. On its own
  // the cord hardly stretches, so it swings like a pendulum and settles (no
  // slingshot when it's let go of far away); a hand can pull it out a good way.
  // It never goes lower than the middle platform, and it can't go through his tail
  function stepToy(dt, now) {
    const { s } = L, o = L.pom;
    if (pom.pinned) {
      pom.x = L.catX + (pom.pinned.x + P.bx) * s;
      pom.y = L.topY + (pom.pinned.y + P.by - P.lift) * s;
      pom.vx = pom.vy = 0;
      return true;
    }
    if (pom.auto) autoHand(now);
    if (pom.held && !RM) {
      const kx = (pom.hx - pom.x) * 26, ky = (pom.hy - pom.y) * 26;
      pom.vx = lerp(pom.vx, kx, 0.45); pom.vy = lerp(pom.vy, ky, 0.45);
    }
    tailChain(P);
    // it's light and fluffy: the air never lets it go fast, so it never swings far
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, vmax = 220 * s;
    for (let i = 0; i < n; i++) {
      if (pom.held) {
        if (RM) { pom.x = pom.hx; pom.y = pom.hy; pom.vx = pom.vy = 0; } else { pom.x += pom.vx * h; pom.y += pom.vy * h; }
      } else if (RM) {
        pom.x = o.x; pom.y = o.y + o.len; pom.vx = pom.vy = 0;
      } else {
        pom.vy += 1500 * s * h;
        const dx = pom.x - o.x, dy = pom.y - o.y, d = Math.hypot(dx, dy) || 1;
        if (d > o.len) {
          // stiff, and damped along its length
          const nx = dx / d, ny = dy / d, f = (d - o.len) * 900 + (pom.vx * nx + pom.vy * ny) * 50;
          pom.vx -= nx * f * h; pom.vy -= ny * f * h;
        }
        pom.vx *= 1 - 1.3 * h; pom.vy *= 1 - 1.3 * h;
        const sp = Math.hypot(pom.vx, pom.vy);
        if (sp > vmax) { pom.vx *= vmax / sp; pom.vy *= vmax / sp; }
        pom.x += pom.vx * h; pom.y += pom.vy * h;
      }
      toyLimits(now);
    }
    // a breath of air keeps it swaying a little
    if (!pom.held && !RM) pom.vx += Math.sin(now / 1300) * 6 * s * dt;
    pom.speed = Math.hypot(pom.vx, pom.vy);
    return pom.held || pom.speed > 30 * s;
  }
  // where the pompom is allowed to be: on its cord, above the middle platform, off his tail
  function toyLimits(now) {
    const { s } = L, o = L.pom, r = o.r;
    let dx = pom.x - o.x, dy = pom.y - o.y, d = Math.hypot(dx, dy);
    const mx = o.len * (pom.held ? 2.5 : 1.7);
    if (d > mx) {
      dx /= d; dy /= d;
      pom.x = o.x + dx * mx; pom.y = o.y + dy * mx;
      const vr = pom.vx * dx + pom.vy * dy;
      if (vr > 0) { pom.vx -= dx * vr; pom.vy -= dy * vr; }
    }
    const floor = L.low.y + 6 * s - r;
    if (pom.y > floor) { pom.y = floor; if (pom.vy > 0) pom.vy *= -0.25; pom.vx *= 0.92; }
    tailContact(now);
    pom.x = clamp(pom.x, r, L.W - r); pom.y = clamp(pom.y, r, floor);
  }
  // the pompom against his tail (in cat units): it's pushed back out, and the
  // tail gives a little where it was pushed. The cord must never cross the tail
  // either, so if it does (the tail swept over it) the pompom goes back along
  // the cord to the near side
  function tailContact(now) {
    const { s } = L;
    let px = (pom.x - L.catX) / s, py = (pom.y - L.topY) / s;
    const rp = L.pom.r / s - 1, ox = (L.pom.x - L.catX) / s, oy = (L.pom.y - L.topY) / s;
    const cdx = px - ox, cdy = py - oy;
    let tMin = 1, ci = -1;
    for (let i = 0; i < TAIL_M; i++) {
      const ax = tailX[i], ay = tailY[i], ex = tailX[i + 1] - ax, ey = tailY[i + 1] - ay;
      const den = cdx * ey - cdy * ex;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((ax - ox) * ey - (ay - oy) * ex) / den, w = ((ax - ox) * cdy - (ay - oy) * cdx) / den;
      if (t > 0 && t < tMin && w >= 0 && w <= 1) { tMin = t; ci = i; }
    }
    let bi = -1, bu = 0, bx = 0, by = 0, best = 0;
    if (ci >= 0) {
      const cl = Math.hypot(cdx, cdy) || 1, rr = tailR(ci / TAIL_M) + rp;
      const t = Math.max(0, tMin - rr / cl);
      const nx = ox + cdx * t - px, ny = oy + cdy * t - py, nl = Math.hypot(nx, ny) || 1;
      px += nx; py += ny;
      bi = ci; bu = ci / TAIL_M; bx = nx / nl; by = ny / nl; best = Math.min(8, nl);
    }
    // then out of the deepest overlap
    let pen = 0, ox2 = 0, oy2 = 0, oi = -1, ou = 0;
    for (let i = 0; i < TAIL_M; i++) {
      const ax = tailX[i], ay = tailY[i], ex = tailX[i + 1] - ax, ey = tailY[i + 1] - ay;
      const ll = ex * ex + ey * ey, k = ll ? clamp(((px - ax) * ex + (py - ay) * ey) / ll) : 0;
      const qx = ax + ex * k, qy = ay + ey * k;
      const u = (i + k) / TAIL_M, rr = tailR(u) + rp;
      const nx = px - qx, ny = py - qy, dd = Math.hypot(nx, ny);
      if (dd >= rr || dd < 1e-4 || rr - dd <= pen) continue;
      pen = rr - dd; ox2 = nx / dd; oy2 = ny / dd; oi = i; ou = u;
    }
    if (oi >= 0) {
      px += ox2 * pen; py += oy2 * pen;
      if (pen >= best) { best = pen; bx = ox2; by = oy2; bi = oi; bu = ou; }
    }
    if (bi < 0) return;
    pom.x = L.catX + px * s; pom.y = L.topY + py * s;
    const vn = pom.vx * bx + pom.vy * by;
    if (vn < 0) { pom.vx -= bx * vn * 1.3; pom.vy -= by * vn * 1.3; }
    // the tail gives way: more the further down it was pushed
    const a = tailA[bi], side = bx * Math.sin(a) - by * Math.cos(a);
    C.tbv += side * Math.min(best, 6) * 7 * (0.4 + bu);
    C.tbu = lerp(C.tbu, bu, 0.3);
    C.tailTouch = now;
    // and then flicks back at it, as tails do
    if (!RM && now - C.flickAt > 900) { C.flickAt = now + 140; C.flickDir = -Math.sign(side) || 1; C.flickHit = false; }
  }
  // the tail springing back after a bump, and its flick knocking the pompom away
  function stepTail(dt, now) {
    if (RM) { C.tb = C.tbv = 0; return false; }
    let hot = false;
    if (C.tb || C.tbv) {
      C.tbv += (-55 * C.tb - 7 * C.tbv) * dt;
      C.tb = clamp(C.tb + C.tbv * dt, -0.5, 0.5);
      if (Math.abs(C.tb) === 0.5) C.tbv *= 0.5;
      if (Math.abs(C.tb) < 0.002 && Math.abs(C.tbv) < 0.01) C.tb = C.tbv = 0;
      hot = true;
    }
    const fe = now - C.flickAt;
    if (fe > -200 && fe < 420) {
      hot = true;
      if (!C.flickHit && fe > 170) {
        C.flickHit = true;
        if (!pom.held && !pom.pinned && now - C.tailTouch < 400) { pom.vx -= C.flickDir * 260 * L.s; pom.vy -= 80 * L.s; }
        play('swish', { gain: 0.05 });
      }
    }
    return hot;
  }
  // the toy button: an invisible hand takes the pompom for a little dance
  function autoHand(now) {
    const { s } = L, e = now - pom.auto.t0, xMax = L.W - 40 * s;
    // beside his face if there's room for it there, else low in front of his paws
    // (never right over his eyes)
    const room = (xMax - L.catX) / s >= 186;
    const ax = room ? L.catX + 186 * s : L.catX + Math.min(150, (L.W - 30 * s - L.catX) / s - 16) * s;
    const ay = L.topY - (room ? 92 : 24) * s, wig = room ? 1 : 0.45;
    if (e < 700) { const k = easeInOut(e / 700); pom.hx = lerp(pom.auto.x0, ax, k); pom.hy = lerp(pom.auto.y0, ay, k); }
    else if (e < 2300) { const k = (e - 700) / 1000; pom.hx = Math.min(ax + Math.sin(k * 5.2) * 46 * s * wig, xMax); pom.hy = ay + Math.sin(k * 7.4) * 20 * s * wig - 10 * s * wig; }
    else if (e < 4200) { pom.hx = Math.min(room ? L.catX + 172 * s : ax, xMax); pom.hy = (room ? L.topY - 66 * s : ay) + Math.sin(e / 300) * 2 * s; }
    else { pom.held = null; pom.auto = null; }
  }

  // bullying
  function bully() {
    count++;
    renderCount(true);
  }
  function poke(px, py) {
    const now = now0();
    const { s } = L;
    setFace('worried', 1700);
    A.worriedAt = now;
    play('pluck', 0, { gain: 0.24, pan: clamp((A.x / L.W) * 1.4 - 0.7, -0.7, 0.7) });
    fx.rings.push({ x: px ?? A.x, y: py ?? A.y - 6 * s, t0: now });
    if (!RM && !A.place && !A.carry) {
      wake();
      const side = px != null ? Math.sign(A.x - px) || (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
      if (A.grounded || A.sleeping || Math.abs(A.vy) < 50 * s) A.vy = -240 * s;
      A.vx += side * 70 * s;
      A.w += side * (5 + Math.random() * 3);
    }
    A.sqv -= 7; A.sqA = -Math.PI / 2;
    bully();
    kick();
  }

  function inZone() {
    const { s } = L;
    const d = Math.hypot(A.x - L.chest.x, A.y - L.chest.y);
    if (d < 182 * s && A.y < L.topY + 44 * s && A.x > L.catX - 160 * s) return true;
    // sitting on his back, even up on the rump: that won't be tolerated either
    return A.grounded && !A.grab && A.y < L.topY - 70 * s && A.x > L.catX - 170 * s && A.x < L.catX + 130 * s;
  }
  // would it be in his reach, sat on the window sill at x?
  function sillReach(x) {
    const { s } = L, c = L.cols[7];
    return x > L.catX - 170 * s && Math.hypot(x - L.chest.x, c.ay - c.r - avoBottom() - L.chest.y) < 196 * s;
  }
  // on the middle platform, right where the pompom hangs
  function behindToy() {
    const { s } = L, lo = L.cols[4];
    return Math.abs(A.y + avoBottom() - (lo.ay - lo.r)) < 14 * s && Math.abs(A.x - L.pom.x) < 52 * s;
  }
  // resting on the cushion in front of him, where he can deal with it properly
  function onPlatform() {
    const { s } = L;
    return Math.abs(A.y + avoBottom() - L.topY) < 9 * s && A.x > L.catX - 40 * s && A.x < L.catX + 100 * s;
  }
  function pickBully() {
    if (!onPlatform()) return 'swat';
    if (C.nextBully) { const k = C.nextBully; C.nextBully = ''; return k; }
    // the classic first, then he mixes it up
    if (!C.lastBully) return 'swat';
    const opts = BULLY.filter((k) => k !== C.lastBully);
    return opts[Math.floor(Math.random() * opts.length)];
  }
  function startBully(kind) {
    const a = start(kind);
    if (!a) return;
    C.lastBully = kind;
    C.lastSwat = now0();
    C.autoN++;
    wake();
    say(`cat.say.${kind}`);
  }
  function handleIt() {
    if (!L || (C.act && PRI[C.act.kind] === 5) || A.place || A.carry) return;
    const now = now0();
    noteUser(now);
    if (A.grab) endGrab(null);
    A.place = { t0: now, landed: false };
    A.touchedCat = false; A.away = 0; A.sent = false; A.hop = null;
    kick();
  }
  function seal(x, y, now) {
    fx.seals.push({ x, y, t0: now, rot: (Math.random() - 0.5) * 0.3 });
    play('pluck', 1, { gain: 0.26, pan: clamp((x / L.W) * 1.4 - 0.7, -0.7, 0.7) });
    play('pluck', 6, { gain: 0.08 });
    bully();
  }
  function swatHit(now) {
    const { s } = L;
    const side = A.x >= L.catX + 20 * s ? 1 : -1;
    seal(A.x, A.y - 12 * s, now);
    A.place = null;
    A.touchedCat = false;
    if (RM) {
      // no flight: it fades out of his reach and comes back on the floor
      fadeAvo(() => restOnFloorAt(side > 0 ? Math.max(L.home.x, L.catX + 230 * s) : 60 * s), 260, 420);
      setFace('dizzy', 1600);
      return;
    }
    // no room for a big fling (a phone): knocked off the edge low and hard
    // instead, so it doesn't sail up across his face into the wall
    if (cramped(side)) sendOff(side * (360 + Math.random() * 120) * s, -(60 + Math.random() * 80) * s, side * (8 + Math.random() * 5));
    else sendOff(side * (820 + Math.random() * 300) * s, -(520 + Math.random() * 240) * s, side * (11 + Math.random() * 7));
    A.sqv -= 8; A.sqA = Math.PI;
    A.fast = true;
    setFace('squeeze', 900);
  }
  const cramped = (side) => (side > 0 ? L.W - A.x : A.x) < 250 * L.s;
  // sent packing: on its way out it can't land back within his reach
  // (deep: it goes on past the middle platform too)
  function sendOff(vx, vy, w, deep) {
    wake();
    A.vx = vx; A.vy = vy; A.w = w;
    A.away = deep ? 2 : 1;
    A.sent = true;
  }
  function fadeAvo(mid, outMs, delayIn) {
    A.fade = { t0: now0(), outMs, delayIn, mid, midDone: false };
  }
  // if a carry gets cut short (resize, a new action), put the avocado somewhere sensible
  function finishCarry() {
    if (!A.carry && !A.under) return;
    A.carry = null; A.under = false; A.mash = 0; A.sink = 0; A.mound = 0;
    if (L) restOnFloorAt(L.home.x);
  }

  // grabbing the avocado
  function local(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function onAvocado(x, y, pad) {
    if (!L || A.alpha < 0.5 || A.carry) return false;
    const { s } = L;
    const ca = Math.cos(-A.ang), sa = Math.sin(-A.ang);
    const dx = x - A.x, dy = y - A.y;
    const lx = (dx * ca - dy * sa) / s, ly = (dx * sa + dy * ca) / s;
    return AVO_SHAPES.some((sh) => Math.hypot(lx - sh.x, ly - sh.y) < sh.r + pad / s);
  }
  const onToy = (x, y, pad) => L && !pom.pinned && Math.hypot(x - pom.x, y - pom.y) < L.pom.r + pad + 4 * L.s;
  const onJar = (x, y) => L && Math.abs(x - L.jar.x) < 26 * L.s && y > L.jar.y - 60 * L.s && y < L.jar.y + 6 * L.s;

  // which part of him is under the pointer
  const TOP = topLine(TORSO);
  function zoneAt(x, y) {
    if (!L) return null;
    const ux = cx(x), uy = cy(y);
    headMatrix(P);
    const hp = catToHead(ux, uy);
    const yw = clamp(P.yaw, -FACE_YAW, FACE_YAW), pc = clamp(P.pitch, FACE_UP, FACE_DOWN);
    const hx = hp.x - yw * 2.5 - (P.yaw - yw) * 9, hy = hp.y - pc * 2 - (P.pitch - pc) * 12;
    if ((hx / 60) ** 2 + ((hy - 2) / 50) ** 2 < 1 || (hy < -20 && hy > -80 && Math.abs(hx) < 54)) {
      faceProj(0, NOSE_LAT, FACE_R * 1.1, yw, pc);
      if (Math.hypot(hx - FP.x, hy - FP.y + 1.3) < 11) return 'nose';
      if (hy < -15) return 'head';
      if (hy > 13 || Math.abs(hx - FP.x) > 30) return 'chin';
      return 'face';
    }
    const bx = ux - P.bx, by = uy - P.by;
    if (bx > -152 && bx < 142 && by < 16 && by > TOP(bx) - 6) return by < TOP(bx) + 36 && bx < 92 ? 'back' : 'body';
    return null;
  }

  function startGrab(e, x, y) {
    const now = now0();
    A.grab = { id: e.pointerId, ox: A.x - x, oy: A.y - y, tx: A.x, ty: A.y, x0: x, y0: y, t0: now, moved: 0, samples: [[x, y, now]] };
    A.place = null; A.away = 0; A.sent = false;
    A.scale = 1;
    if (!A.fade) A.alpha = 1;
    wake();
    setFace('squeeze', 1e9);
    stage.classList.add('is-grabbing');
    try { stage.setPointerCapture(e.pointerId); } catch { /* fine */ }
    kick();
  }
  function moveGrab(x, y) {
    const g = A.grab, now = now0();
    g.moved += Math.hypot(x - g.samples[g.samples.length - 1][0], y - g.samples[g.samples.length - 1][1]);
    g.samples.push([x, y, now]);
    while (g.samples.length > 2 && now - g.samples[0][2] > 90) g.samples.shift();
    g.tx = x + g.ox; g.ty = y + g.oy;
    if (RM) { A.x = clamp(g.tx, 20 * L.s, L.W - 20 * L.s); A.y = clamp(g.ty, 30 * L.s, L.floorY - avoBottom()); }
    kick();
  }
  function endGrab(e) {
    const g = A.grab;
    if (!g) return;
    A.grab = null;
    stage.classList.remove('is-grabbing');
    const now = now0();
    const { s } = L;
    const quick = g.moved < 8 && now - g.t0 < 400;
    if (quick && e) { A.vx = A.vy = 0; A.w *= 0.3; setFace('smug', 0); poke(...local(e)); return; }
    // velocity from the last few samples
    const a = g.samples[0], b = g.samples[g.samples.length - 1];
    const dt = Math.max(16, b[2] - a[2]) / 1000;
    let vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt;
    // cut short (scrolled away, the touch cancelled) or held still: it's just let go of, no throw
    if (!e || now - b[2] > 120) { vx = 0; vy = 0; }
    const sp = Math.hypot(vx, vy), max = 2600 * s;
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    // let go low in front of him, over the cushion: it sits on the cushion
    const bot = A.y + avoBottom();
    if (sp < 450 * s && Math.abs(A.x - L.plat.x) < L.plat.rx - 12 * s && bot > L.topY - 60 * s && bot < L.topY + (L.plat.ry + L.plat.th) * 1.1) {
      A.y = L.topY - avoBottom(); A.ang = 0; A.w = 0;
      if (!RM) { A.vx = A.vy = 0; A.sleeping = true; A.lastMove = now; setFace('worried', 1200); kick(); return; }
    }
    if (RM) {
      setFace('worried', 1200);
      if (inZone()) { startBully(onPlatform() ? pickBully() : 'swat'); kick(); return; }
      const x = A.x;
      fadeAvo(() => { A.x = x; A.y = surfaceBelow(x, A.y + 20 * s) - avoBottom(); A.ang = 0; A.sleeping = true; }, 160, 200);
      if (sp > 450 * s) bully();
      kick();
      return;
    }
    A.vx = vx; A.vy = vy;
    A.w += clamp(vx / (32 * s), -14, 14) * 0.5 + (Math.random() - 0.5) * 4;
    A.fast = sp > 700 * s;
    setFace(sp > 450 * s ? 'squeeze' : 'worried', sp > 450 * s ? 700 : 1200);
    wake();
    if (sp > 450 * s) bully();
    kick();
  }

  // grabbing the pompom
  function grabToy(e, x, y) {
    pom.auto = null;
    pom.held = { id: e.pointerId, ox: pom.x - x, oy: pom.y - y };
    pom.hx = pom.x; pom.hy = pom.y;
    stage.classList.add('is-grabbing');
    try { stage.setPointerCapture(e.pointerId); } catch { /* fine */ }
    C.toyT = now0();
    kick();
  }
  function dropToy() {
    if (!pom.held) return;
    pom.held = null; pom.auto = null;
    stage.classList.remove('is-grabbing');
    kick();
  }
  function autoDangle() {
    if (!L) return;
    const now = now0();
    noteUser(now);
    // already pinned under his paws, or busy with something that beats a toy
    const a = C.act, busy = a && PRI[a.kind] >= 3 && a.kind !== 'bat' && a.kind !== 'pounce';
    if (pom.pinned || busy) say('cat.say.busy');
    if (pom.pinned) return;
    pom.held = { id: -1 };
    pom.auto = { t0: now, x0: pom.x, y0: pom.y };
    pom.hx = pom.x; pom.hy = pom.y;
    C.toyT = now;
    if (!busy) say('cat.say.toy');
    kick();
  }

  // treats
  // on the cushion in front of him, where you can see it
  const TREAT_AT = [54, 15];
  function placeTreat() {
    treat.x = L.catX + TREAT_AT[0] * L.s; treat.y = L.topY + TREAT_AT[1] * L.s; treat.a = -0.3;
  }
  function tossTreat() {
    if (!L) return;
    const now = now0();
    noteUser(now);
    jarT = now;
    play('rattle', { gain: 0.2 });
    // one at a time: a couple more wait their turn, the rest is just a rattle
    if (treat.on || (C.act && C.act.kind === 'eat')) { treatQ = Math.min(2, treatQ + 1); kick(); return; }
    launchTreat(now);
  }
  function launchTreat(now) {
    jarT = now;
    treat.on = true; treat.state = RM ? 'rest' : 'fly'; treat.t0 = now;
    treat.x0 = L.jar.x; treat.y0 = L.jar.y - 58 * L.s;
    if (RM) placeTreat(); else { treat.x = treat.x0; treat.y = treat.y0; }
    if (RM) start('eat');
    say('cat.say.treat');
    kick();
  }

  // petting
  function petNow(zone, now, ms, fromButton) {
    noteUser(now);
    if (now < C.grumpyUntil) {
      if (fromButton) say('cat.say.grumpy');
      return false;
    }
    const fresh = now > C.petUntil + 600 || C.petZone !== zone;
    C.petZone = zone;
    C.petUntil = Math.max(C.petUntil, now + ms);
    if (fromButton) C.stim += zone === 'head' ? 0.9 : zone === 'chin' ? 0.5 : 0.7;
    if (fresh) { pets++; renderTally(); }
    // a new spot is always worth saying; the same one again only now and then
    if (fromButton || (fresh && (zone !== pet.sayZone || now - pet.sayT > 5000))) { pet.sayT = now; pet.sayZone = zone; say(`cat.say.${zone}`); }
    if (now - lastPurr > 1700) {
      lastPurr = now;
      play('purr', { gain: zone === 'chin' ? 0.34 : 0.24, seconds: 1.9 });
    }
    kick();
    return true;
  }
  function petButton() {
    if (!L) return;
    const now = now0();
    const zone = ['back', 'chin', 'head'][petIdx++ % 3];
    if (!petNow(zone, now, zone === 'head' ? 1300 : 2400, true)) return;
    if (zone === 'head') { start('pat'); maybeShake(0.45); }
    if (!RM) fx.strokes.push({ t0: now, zone });
  }
  function boop(fromButton) {
    if (!L) return;
    const now = now0();
    noteUser(now);
    const a = start('boop');
    // busy with something more important: say so, rather than nothing at all
    if (!a) { if (fromButton) say('cat.say.busy'); return; }
    const n = facePoint(P, 0, NOSE_LAT, FACE_R * 1.1);
    fx.rings.push({ x: L.catX + n.x * L.s, y: L.topY + n.y * L.s, t0: now });
    if (fromButton || now - C.boopSayT > 4000) { C.boopSayT = now; say('cat.say.boop'); }
  }
  function meow(now) {
    if (now - C.meowAt < 450) return;
    C.meowAt = now;
    word('야옹', 30);
    play('meow', { gain: 0.16 });
    kick();
  }
  function word(text, size) {
    fx.words.push({ t0: now0(), text, size, side: Math.random() < 0.5 ? -1 : 1 });
  }

  // someone's here: keep him awake, push the next idle thing back. A passing
  // pointer only stops the idle things; a press or a click also gets him off a book
  function noteUser(now, strong) {
    C.lastUser = now;
    C.idleAt = Math.max(C.idleAt, now + 4500);
    const a = C.act;
    if (a && a.kind === 'sleep') {
      C.act = null;
      if (!RM) start('wake');
      if (a.asleep) say('cat.say.wake');
    } else if (a && PRI[a.kind] === 1 && (!STICKY.has(a.kind) || (strong && a.kind === 'bookrest'))) endAct(a, now);
  }
  // is he in the middle of something that can't wait?
  const busyWith = (p = 3) => C.act && PRI[C.act.kind] >= p;
  // putting the laser or the brush away for something else
  function toolsAway(now) { laserOff(now, true); brushOff(); }

  // the laser pointer
  function laserAt(x, y, now) {
    x = clamp(x, 6, L.W - 6); y = clamp(y, 6, L.H - 6);
    if (Math.hypot(x - laser.x, y - laser.y) > 1.5 * L.s) laser.lastMove = now;
    laser.x = x; laser.y = y;
  }
  // a little dance for the dot when nobody's steering it (cat units: where, how long
  // to get there, how long to stay); the last stop holds until he pounces on it
  const DOT_PATH = [[-170, 250, 0, 500], [30, 196, 520, 260], [150, -2, 480, 1300], [236, -112, 300, 360], [-70, -176, 650, 650], [140, -6, 600, 2600]];
  function laserToggle(byKeys) {
    if (!L) return;
    const now = now0();
    if (laser.on) { laserOff(now); return; }
    if (busyWith(4)) { say('cat.say.busy'); return; }
    brushOff();
    laser.on = true; laser.t0 = now; laser.until = now + 16000; laser.user = false; laser.drag = null; laser.said = false;
    const p = DOT_PATH[0];
    laserAt(L.catX + p[0] * L.s, L.topY + p[1] * L.s, now);
    // from the keyboard (or a tap) it dances straight away; with a mouse it waits a moment to be picked up
    laser.auto = { t0: now + (byKeys || touchy ? 250 : 1300), i: 0, x0: laser.x, y0: laser.y, at: 0 };
    stage.classList.add('is-laser');
    btn.laser.setAttribute('aria-pressed', 'true');
    play('click', { gain: 0.1 });
    say('cat.say.laser.on');
    // (busy with something, he finishes that first and then he's on it)
    if (!busyWith(3)) start('laser');
    kick();
  }
  function laserOff(now, quiet) {
    if (!laser.on) return;
    laser.on = false; laser.auto = null; laser.drag = null;
    C.stare = { x: laser.x, y: laser.y, until: now + 1800 };
    stage.classList.remove('is-laser');
    btn.laser.setAttribute('aria-pressed', 'false');
    const a = C.act;
    if (a && a.kind === 'laser' && (a.phase || 'watch') === 'watch') endAct(a, now);
    if (!quiet) { play('click', { gain: 0.08 }); say('cat.say.laser.off'); }
    kick();
  }
  function stepLaser(now) {
    if (!laser.on) return false;
    const { s } = L;
    if (now > laser.until || (laser.user && now - laser.lastMove > 7000)) { laserOff(now); return true; }
    const au = laser.auto;
    if (au && now >= au.t0) {
      const p = DOT_PATH[au.i], e = now - au.t0;
      const tx = clamp(L.catX + p[0] * s, 10, L.W - 10), ty = clamp(L.topY + p[1] * s, 10, L.H - 10);
      const k = RM ? 1 : p[2] ? easeInOut(e / p[2]) : 1;
      laserAt(lerp(au.x0, tx, k), lerp(au.y0, ty, k), now);
      // a little shiver while it sits still, like a hand holding it
      if (!RM && e > p[2]) { laser.x += Math.sin(now / 90) * 0.6 * s; laser.y += Math.cos(now / 70) * 0.5 * s; }
      const last = au.i === DOT_PATH.length - 1;
      // the last stop: it stays until he lands on it, then it's gone from under his paws
      if (last && laser.caught > au.t0 + p[2]) { if (now - laser.caught > 120) laserOff(now, true); }
      else if (e > p[2] + p[3]) {
        if (last) laserOff(now);
        else {
          // it waits for him to finish a pounce before it runs off again
          const a = C.act;
          if (!(a && a.kind === 'laser' && (a.phase === 'crouch' || a.phase === 'lunge'))) { au.i++; au.t0 = now; au.x0 = laser.x; au.y0 = laser.y; }
        }
      }
    }
    if (laser.on && (!C.act || PRI[C.act.kind] < 3)) start('laser');
    return true;
  }
  // can he get his paws on it from where he is? (cat units)
  function dotInReach() {
    const ux = cx(laser.x), uy = cy(laser.y);
    return laser.on && ux > 46 && ux < Math.min(245, (L.W - 24 * L.s - L.catX) / L.s) && uy > -140 && uy < 30 && Math.hypot(ux - SHOULDER_N[0], uy - SHOULDER_N[1]) < 175;
  }

  // the brush: a pass along his back, then it stays out a while for you to use
  function brushGo() {
    if (!L) return;
    const now = now0();
    laserOff(now, true);
    if (busyWith(3)) { say('cat.say.busy'); return; }
    if (now < C.grumpyUntil) { say('cat.say.grumpy'); return; }
    brush.on = true; brush.until = now + 10000;
    stage.classList.add('is-brush');
    const a = start('brush');
    if (a) say('cat.say.brush');
    kick();
  }
  function brushOff() {
    if (!brush.on) return;
    brush.on = false; brush.lastX = null;
    stage.classList.remove('is-brush');
    if (C.act && C.act.kind === 'brush') endAct(C.act, now0());
  }
  // a stroke the right way (head to tail): a tuft comes away, he loves it
  function brushed(x, y, now) {
    spawnTuft(x, y, now);
    noteUser(now);
    if (now < C.grumpyUntil) return;
    const fresh = now > C.petUntil + 600 || C.petZone !== 'brush';
    C.petZone = 'brush';
    C.petUntil = Math.max(C.petUntil, now + 1100);
    if (fresh) { pets++; renderTally(); }
    if (now - brush.sayT > 6000) { brush.sayT = now; say('cat.say.brush'); }
    if (now - lastPurr > 1700) { lastPurr = now; play('purr', { gain: 0.24, seconds: 1.9 }); }
    play('swish', { gain: 0.04 });
  }
  // the wrong way (tail to head): fur up, and a look
  function brushedWrong(now) {
    C.puffAt = now;
    C.stim += 0.8;
    C.petUntil = 0;
    if (start('huff')) { say('cat.say.brush.wrong'); play('huff', { gain: 0.14 }); }
  }
  // the fluff pile lives on the cushion, in front of his belly (cat units)
  const PILE = [-66, 15];
  function spawnTuft(x, y, now) {
    if (RM) { pile.n = Math.min(60, pile.n + 1); return; }
    if (tufts.length > 26) return;
    tufts.push({ x: cx(x), y: cy(y), vx: (Math.random() - 0.5) * 30, vy: -(26 + Math.random() * 30), t0: now, seed: Math.random() * 100, rot: Math.random() * TAU });
  }
  function stepTufts(dt, now) {
    if (!tufts.length) return false;
    for (let i = tufts.length - 1; i >= 0; i--) {
      const f = tufts[i], e = now - f.t0;
      if (e < 1100) {
        // drifting up and away, slowing, on little eddies
        f.x += (f.vx + Math.sin(e / 260 + f.seed) * 22) * dt; f.y += f.vy * dt;
        f.vx *= 1 - 1.2 * dt; f.vy *= 1 - 1.4 * dt; f.rot += dt * 1.4;
      } else {
        // then settling down onto the pile
        const k = 1 - Math.exp(-dt * 3.2);
        f.x += (PILE[0] + Math.sin(f.seed) * 10 - f.x) * k; f.y += (PILE[1] - 2 - f.y) * k + Math.sin(e / 200 + f.seed) * 6 * dt; f.rot += dt * 0.8;
        if (Math.hypot(PILE[0] + Math.sin(f.seed) * 10 - f.x, PILE[1] - 2 - f.y) < 3 || e > 4200) { tufts.splice(i, 1); pile.n = Math.min(60, pile.n + 1); }
      }
    }
    return true;
  }

  // psst psst
  function psst() {
    if (!L) return;
    const now = now0();
    chat.psst = chat.psst.filter((t) => now - t < 12000);
    chat.psst.push(now);
    fx.calls.push({ t0: now, text: tt('cat.psst.word') });
    play('psst', { gain: 0.14 });
    if (busyWith(3)) { say('cat.say.busy'); kick(); return; }
    // the third time in a row, he's decided you can wait
    const tooMuch = chat.psst.length >= 3;
    const a = start(tooMuch ? 'ignore' : 'psst');
    say(a ? (tooMuch ? 'cat.say.ignore' : 'cat.say.psst') : 'cat.say.busy');
    kick();
  }
  // you slow-blink at him, and he slow-blinks back
  function slowBlink() {
    if (!L) return;
    const now = now0();
    if (busyWith(2) && C.act.kind !== 'blinkback') { say('cat.say.busy'); return; }
    chat.you = { t0: now };
    say('cat.say.blink');
    later(() => { if (L && !busyWith(2)) start('blinkback'); }, RM ? 300 : 1000);
    kick();
  }

  // dressing up: the next hat, and he's not impressed
  const HAT_SAY = ['cat.say.hat.none', 'cat.say.hat.beret', 'cat.say.hat.gat', 'cat.say.hat.crown'];
  function nextHat() {
    if (!L) return;
    const now = now0();
    if (C.act && C.act.kind === 'shake') return;
    hat.off = null;
    hat.i = (hat.i + 1) % 4;
    hat.t0 = now;
    play('swish', { gain: 0.05 });
    say(HAT_SAY[hat.i]);
    if (hat.i) start('unimpressed');
    kick();
  }
  // now and then, a hat gets shaken off (after a pat on the head, say)
  function maybeShake(p) {
    // (once the pat itself is over)
    if (hat.i && Math.random() < p) later(() => { if (hat.i && !busyWith(2)) start('shake'); }, RM ? 850 : 950);
  }
  // off it goes (cat units)
  function hatFlies(now) {
    const top = headPoint(P, 0, -44);
    const side = Math.random() < 0.5 ? -1 : 1;
    hat.off = { i: hat.i, x: top.x, y: top.y, vx: side * (120 + Math.random() * 60), vy: -260, rot: 0, vr: side * (5 + Math.random() * 4), t0: now };
    hat.i = 0;
    play('swish', { gain: 0.07 });
  }

  // catnip, once in a while
  const NIP_WAIT = 45000, SPRIG_AT = [30, 15];
  function giveNip() {
    if (!L) return;
    const now = now0();
    if (now - nip.at < NIP_WAIT) { say('cat.say.nip.wait'); return; }
    toolsAway(now);
    if (busyWith(3)) { say('cat.say.busy'); return; }
    nip.at = now;
    nip.sprig = { t0: now, x0: cx(L.jar.x), y0: cy(L.jar.y - 58 * L.s), fade: 0, crushed: 0 };
    start('nip');
    say('cat.say.nip');
    kick();
  }
  // where the sprig is (cat units): tossed up from the floor by the jar, then on the cushion
  function sprigPos(now) {
    const sp = nip.sprig, e = RM ? 1 : clamp((now - sp.t0) / 700);
    PT.x = lerp(sp.x0, SPRIG_AT[0], e); PT.y = lerp(sp.y0, SPRIG_AT[1], e) - Math.sin(Math.PI * e) * 140;
    return PT;
  }

  // paw painting: the sheet of hanji on the cushion in front of him, in its own
  // units (ART_W x ART_H) laid flat onto the cushion
  const PAPER = { ox: 4, oy: 0, ux: 0.74, uy: -0.02, vx: -0.07, vy: 0.28 };
  const paperPt = (u, v) => { PT.x = PAPER.ox + PAPER.ux * u + PAPER.vx * v; PT.y = PAPER.oy + PAPER.uy * u + PAPER.vy * v; return PT; };
  function paintGo() {
    if (!L) return;
    const now = now0();
    toolsAway(now);
    if (art.cur || busyWith(3)) { say('cat.say.busy'); return; }
    const seed = (Math.random() * 1e9) | 0, R = rng(seed);
    // each one different: how many prints, where, which way up, how much ink, any smudges
    const n = 3 + Math.floor(R() * 4), st = [];
    for (let i = 0; i < n; i++) {
      let u = 16 + R() * 66, v = 12 + R() * 44;
      if (u > 72 && v > 46) u -= 22;
      st.push({ u, v, rot: (R() - 0.5) * 1.8 + (R() < 0.2 ? Math.PI : 0), sz: 1 + R() * 0.4, smudge: R() < 0.3 ? R() * TAU : null, dip: i === 0 || (i === 3 && R() < 0.8) || R() < 0.12 });
    }
    const tl = [];
    let t = RM ? 300 : 1100, ink = 0;
    for (const p of st) {
      if (p.dip) { tl.push({ t, kind: 'dip', d: RM ? 300 : 700 }); t += RM ? 300 : 700; ink = 1; }
      p.ink = ink; ink = Math.max(0.2, ink - 0.2 - R() * 0.12);
      const d = RM ? 350 : p.smudge !== null ? 950 : 720;
      tl.push({ t, kind: 'stamp', p, d }); t += d;
    }
    for (const [kind, d, dr] of [['sign', 1000, 500], ['admire', 1300, 700], ['hang', 1000, 400]]) { tl.push({ t, kind, d: RM ? dr : d }); t += RM ? dr : d; }
    art.cur = { seed, R, c: makeHanji(seed), st, tl, end: t, t0: now, splat: R() < 0.6 };
    start('paint');
    say('cat.say.paint');
    kick();
  }
  // a print lands on the paper
  function inkPrint(p) {
    const cur = art.cur;
    if (!cur) return;
    const g = cur.c.getContext('2d');
    g.save();
    g.scale(ART_PX, ART_PX);
    pawPrint(g, p.u, p.v, p.rot, p.sz, p.ink, cur.R);
    if (p.smudge !== null) {
      const dx = Math.cos(p.smudge), dy = Math.sin(p.smudge);
      stroke(g, { pts: [[p.u, p.v], [p.u + dx * 7, p.v + dy * 6], [p.u + dx * 15, p.v + dy * 11]], width: 7 * p.sz, dry: 0.75, tone: 0.55 * p.ink + 0.2, rgb: INK_RGB, seed: cur.seed % 997, bristles: 9 });
    }
    if (cur.splat && p.ink > 0.6) for (let i = 0; i < 4; i++) stamp(g, p.u + (cur.R() - 0.5) * 22, p.v + (cur.R() - 0.5) * 18, 0.5 + cur.R() * 1.1, INK_RGB, 0.7, 0.7);
    g.restore();
  }
  function signArt() {
    const cur = art.cur;
    if (!cur) return;
    const g = cur.c.getContext('2d');
    sealStamp(g, (ART_W - 11) * ART_PX, (ART_H - 11) * ART_PX, 10 * ART_PX, '猫', { seed: cur.seed % 89, alpha: 0.9 });
  }
  function artDone(now) {
    const cur = art.cur;
    if (!cur) return;
    art.n++;
    renderTally();
    // up onto the wall, if there's a bit of wall for it
    art.fly = { c: cur.c, t0: now, wall: !!L.wall };
    art.cur = null;
    say(L.wall ? 'cat.say.paint.wall' : 'cat.say.paint.done');
  }

  // books: tap one (or the button) and it comes over and falls open in front of him
  const BOOK_SAY = ['cat.say.book.0', 'cat.say.book.1', 'cat.say.book.2', 'cat.say.book.3', 'cat.say.book.4'];
  const BOOK_AT = [54, 13];
  // where a book in the stack sits (cat units, its spine's bottom middle)
  function stackPos(j) {
    const b = L.books, list = books.stack;
    let y = cy(b.y);
    for (let k = 0; k < j; k++) y -= BOOKS[list[k]].h;
    PT.x = cx(b.x) + Math.sin(list[j] * 2.3) * 2.6; PT.y = y;
    return PT;
  }
  function openBook(i) {
    if (!L) return;
    const now = now0();
    // one at a time: the open one goes back first, and one still on its way back
    // goes straight onto the pile
    if (books.open >= 0 && C.act && (C.act.kind === 'book' || C.act.kind === 'bookrest')) endAct(C.act, now);
    if (books.open >= 0) bookBack(now);
    if (books.fly && books.fly.back) { if (!books.stack.includes(books.fly.i)) books.stack.push(books.fly.i); books.fly = null; }
    toolsAway(now);
    if (busyWith(3)) { say('cat.say.busy'); return; }
    if (i === undefined) {
      // the button goes through them in turn (off the floor first, if one's there)
      if (books.fallen) i = books.fallen.i;
      else { const list = books.stack; i = list[(books.next++) % list.length]; }
    }
    let from;
    if (books.fallen && books.fallen.i === i) { from = { x: books.fallen.x, y: books.fallen.y, rot: books.fallen.rot }; books.fallen = null; }
    else {
      const j = books.stack.indexOf(i);
      if (j < 0) return;
      const p = stackPos(j);
      from = { x: p.x, y: p.y - BOOKS[i].h / 2, rot: 0 };
      books.stack.splice(j, 1);
    }
    books.open = i; books.k = 0;
    books.fly = { i, t0: now, from, back: false };
    const a = start('book', { i });
    if (!a) { bookBack(now); say('cat.say.busy'); return; }
    play('swish', { gain: 0.05 });
    kick();
  }
  function bookBack(now) {
    const i = books.open;
    if (i < 0) return;
    books.open = -1;
    books.fly = { i, t0: now, back: true, k0: books.k };
    books.k = 0;
  }
  function stepBooks(dt, now) {
    let hot = false;
    const f = books.fly;
    if (f) {
      hot = true;
      const dur = RM ? 1 : f.back ? 650 : 620;
      if (now - f.t0 >= dur) {
        books.fly = null;
        if (f.back && !books.stack.includes(f.i)) books.stack.push(f.i);
      }
    }
    if (books.open >= 0 && !books.fly) {
      const a = C.act, opening = a && a.kind === 'book' && now - a.t0 > (RM ? 0 : 640);
      if (opening || (a && a.kind === 'bookrest')) books.k = RM ? 1 : Math.min(1, books.k + dt / 0.38);
      if (books.k < 1) hot = true;
    }
    const fb = books.fallen;
    if (fb && !fb.landed) {
      hot = true;
      if (RM) { fb.x = fb.x1; fb.y = fb.y1; fb.rot = fb.r1; fb.landed = true; }
      else {
        fb.vy += 1500 * dt; fb.x += fb.vx * dt; fb.y += fb.vy * dt; fb.rot += fb.vr * dt;
        if (fb.y >= fb.y1) { fb.y = fb.y1; fb.landed = true; fb.rot = fb.r1; play('thump', { gain: 0.16 }); fx.rings.push({ x: L.catX + fb.x * L.s, y: L.topY + fb.y * L.s, t0: now }); }
      }
    }
    return hot;
  }
  // where a book falling off at x (cat units) comes to rest: the middle platform or the floor
  function bookFloor(x) {
    const lo = L.low, X = L.catX + x * L.s;
    if (Math.abs(X - lo.x) < lo.rx * 0.9) return cy(lo.y + 6 * L.s);
    return cy(groundAt(X) - 1 * L.s);
  }
  // is there a book under (x, y)? the fallen one first (it's in front), then the stack, top down
  function bookAt(x, y) {
    if (!L) return -1;
    const ux = cx(x), uy = cy(y), pad = 4;
    const fb = books.fallen;
    if (fb && fb.landed && Math.abs(ux - fb.x) < BOOKS[fb.i].w / 2 + pad && uy > fb.y - BOOKS[fb.i].h - 4 - pad && uy < fb.y + pad) return fb.i;
    for (let j = books.stack.length - 1; j >= 0; j--) {
      const i = books.stack[j], p = stackPos(j);
      if (Math.abs(ux - p.x) < BOOKS[i].w / 2 + pad && uy > p.y - BOOKS[i].h - (j === books.stack.length - 1 ? 4 : 0) - pad && uy < p.y + pad * 0.5) return i;
    }
    return -1;
  }

  // a hat dropping on, or flying off (cat units)
  function stepHat(dt, now) {
    let hot = !RM && hat.i && now - hat.t0 < 450;
    const h = hat.off;
    if (h) {
      if (RM || now - h.t0 > 1500) hat.off = null;
      else { h.vy += 900 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; hot = true; }
    }
    return hot;
  }
  function stepNip(now) {
    const sp = nip.sprig;
    if (!sp) return false;
    if (sp.fade && now - sp.fade > 1200) { nip.sprig = null; return true; }
    return now - sp.t0 < 760 || !!sp.fade;
  }
  // a finished painting on its way up to the wall (or fading, if there's no wall for it)
  function stepArt(now) {
    const f = art.fly;
    if (!f) return false;
    const end = f.quiet ? 700 : RM ? ART_HOLD + 200 : f.wall && L.wall ? ART_WALL : ART_FADE;
    if (now - f.t0 >= end) { if (f.wall && L.wall && !f.quiet) art.wall = { c: f.c }; art.fly = null; }
    return true;
  }

  // the visitor's side of things, drawn small at the bottom of the room
  const youAt = () => { PT.x = clamp(L.catX + (L.narrow ? 120 : 210) * L.s, 60, L.W - 60); PT.y = L.H - 26 * L.s; return PT; };

  // pointer events
  stage.addEventListener('pointerdown', (e) => {
    if (!L || (e.button !== undefined && e.button > 0)) return;
    const [x, y] = local(e);
    const now = now0();
    pointer.x = x; pointer.y = y; pointer.t = now;
    noteUser(now, true);
    C.autoN = 0;
    const pad = e.pointerType === 'touch' ? 14 : 6;
    // the avocado is drawn over the pompom, so right on it, it wins
    if (onAvocado(x, y, 0)) { e.preventDefault(); startGrab(e, x, y); return; }
    if (e.target === toyEl || onToy(x, y, pad)) { e.preventDefault(); grabToy(e, x, y); return; }
    if (e.target === grabEl || onAvocado(x, y, pad)) { e.preventDefault(); startGrab(e, x, y); return; }
    // with the laser on, a finger (or a press) puts the dot right there and drags it about
    if (laser.on) {
      e.preventDefault();
      laser.drag = e.pointerId; laser.user = true; laser.auto = null;
      laserAt(x, y, now);
      try { stage.setPointerCapture(e.pointerId); } catch { /* fine */ }
      kick();
      return;
    }
    if (onJar(x, y)) { tossTreat(); return; }
    // he's drawn over the books, so he comes first
    const z = zoneAt(x, y);
    if (z) {
      tapCat = { id: e.pointerId, x, y, t0: now, moved: 0, zone: z };
      if (brush.on) { brush.lastX = x; brush.x = x; brush.y = y; brush.lastT = now; }
      return;
    }
    const b = bookAt(x, y);
    if (b >= 0) openBook(b);
  }, opt);
  stage.addEventListener('pointermove', (e) => {
    if (!L) return;
    const [x, y] = local(e);
    const now = now0();
    if (A.grab && e.pointerId === A.grab.id) { moveGrab(x, y); return; }
    if (pom.held && pom.held.id === e.pointerId) { pom.hx = x + pom.held.ox; pom.hy = y + pom.held.oy; pointer.x = x; pointer.y = y; pointer.t = now; kick(); return; }
    // steering the dot: a mouse just moves it, a finger drags it
    if (laser.on && (laser.drag === e.pointerId || (e.pointerType === 'mouse' && laser.drag === null))) {
      laser.user = true; laser.auto = null;
      laserAt(x, y, now);
      laser.until = Math.max(laser.until, Math.min(laser.t0 + 30000, now + 6000));
      C.lastUser = now;
      kick();
      return;
    }
    if (e.pointerType === 'mouse' || e.buttons) { pointer.x = x; pointer.y = y; pointer.t = now; noteUser(now); }
    if (tapCat && tapCat.id === e.pointerId) { tapCat.moved += Math.hypot(x - tapCat.x, y - tapCat.y); tapCat.x = x; tapCat.y = y; }
    const z = zoneAt(x, y);
    if (e.pointerType === 'mouse') stage.style.cursor = onToy(x, y, 6) || onAvocado(x, y, 6) ? 'grab' : z || onJar(x, y) || bookAt(x, y) >= 0 ? 'pointer' : '';
    // brushing: along his back, head to tail is the right way
    if (brush.on && (e.pointerType === 'mouse' || e.buttons)) {
      const onBack = z === 'back' || z === 'body';
      if (now - brush.lastT > 400 || brush.lastX === null) { brush.lastX = x; brush.dist = 0; brush.against = 0; }
      brush.x = x; brush.y = y; brush.lastT = now;
      if (onBack) {
        const dx = x - brush.lastX;
        if (C.act && C.act.kind === 'brush') endAct(C.act, now);
        brush.until = now + 8000;
        brush.a = lerp(brush.a, clamp(dx * 0.05, -0.4, 0.4), 0.3);
        if (dx < 0) { brush.dist -= dx; brush.against = Math.max(0, brush.against + dx * 0.5); }
        else { brush.against += dx; brush.dist = Math.max(0, brush.dist - dx * 0.5); }
        if (brush.dist > 24 * L.s) { brush.dist = 0; brushed(x, y + 6 * L.s, now); }
        if (brush.against > 80 * L.s) { brush.against = 0; brush.dist = 0; brushedWrong(now); }
      }
      brush.lastX = x;
      kick();
      return;
    }
    // stroking him: back and forth over his fur
    if (z && z !== 'nose' && (e.pointerType === 'mouse' || e.buttons)) {
      if (now - pet.t > 650) { pet.dist = 0; pet.flips = 0; pet.lastX = x; pet.dir = 0; }
      const dx = x - (pet.lastX ?? x);
      pet.dist += Math.abs(dx) + Math.abs(e.movementY || 0) * 0.4;
      const dir = Math.abs(dx) > 1.5 ? Math.sign(dx) : 0;
      if (dir && pet.dir && dir !== pet.dir) pet.flips++;
      if (dir) pet.dir = dir;
      pet.lastX = x; pet.t = now;
      if (pet.dist > 70 && (pet.flips >= 1 || pet.dist > 170)) {
        const zone = z === 'head' ? 'head' : z === 'chin' || z === 'face' ? 'chin' : 'back';
        petNow(zone, now, 900, false);
        pet.zone = zone;
      }
    }
    kick();
  }, opt);
  const up = (e) => {
    if (A.grab && e.pointerId === A.grab.id) endGrab(e.type === 'pointerup' ? e : null);
    if (pom.held && pom.held.id === e.pointerId) dropToy();
    if (laser.drag === e.pointerId) laser.drag = null;
    if (tapCat && tapCat.id === e.pointerId) {
      const now = now0();
      if (e.type === 'pointerup' && tapCat.moved < 10 && now - tapCat.t0 < 450) {
        const z = tapCat.zone;
        if (z === 'nose') boop(false);
        else if (z === 'head') { if (petNow('head', now, 900, false)) { start('pat'); maybeShake(0.45); } }
        else if (z === 'chin') petNow('chin', now, 1500, false);
        else meow(now);
      }
      tapCat = null;
    }
  };
  stage.addEventListener('pointerup', up, opt);
  stage.addEventListener('pointercancel', up, opt);
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { pointer.t = -1e9; brush.lastT = -1e9; } }, opt);
  for (const el of [grabEl, toyEl, dotEl]) el.addEventListener('contextmenu', (e) => e.preventDefault(), opt);

  // a button press is someone doing something (capture: before the button's own handler)
  root.querySelector('.cat-bar').addEventListener('click', (e) => {
    if (!e.target.closest('.cat-btn')) return;
    C.autoN = 0;
    noteUser(now0(), true);
  }, { capture: true, signal: ac.signal });
  btn.poke.addEventListener('click', () => { if (!L || A.grab || A.carry) return; noteUser(now0()); poke(null, null); }, opt);
  btn.swat.addEventListener('click', () => handleIt(), opt);
  btn.pet.addEventListener('click', () => petButton(), opt);
  btn.boop.addEventListener('click', () => boop(true), opt);
  btn.treat.addEventListener('click', () => tossTreat(), opt);
  btn.toy.addEventListener('click', () => autoDangle(), opt);
  // a click with detail 0 came from the keyboard
  btn.laser.addEventListener('click', (e) => laserToggle(e.detail === 0), opt);
  btn.brush.addEventListener('click', () => brushGo(), opt);
  btn.nip.addEventListener('click', () => giveNip(), opt);
  btn.psst.addEventListener('click', () => psst(), opt);
  btn.blink.addEventListener('click', () => slowBlink(), opt);
  btn.hat.addEventListener('click', () => nextHat(), opt);
  btn.paint.addEventListener('click', () => paintGo(), opt);
  btn.book.addEventListener('click', () => openBook(), opt);
  // more things to do, tucked away until asked for (remembered for next time)
  const setMore = (open) => {
    moreBtn.setAttribute('aria-expanded', String(open));
    morePanel.hidden = !open;
    root.classList.toggle('is-more', open);
  };
  moreBtn.addEventListener('click', () => {
    const open = moreBtn.getAttribute('aria-expanded') !== 'true';
    setMore(open);
    try { localStorage.setItem('cat-more', open ? '1' : '0'); } catch { /* private mode */ }
  }, opt);
  try { if (localStorage.getItem('cat-more') === '1') setMore(true); } catch { /* fine */ }

  // the things he does: one at a time, the more important ones win
  function start(kind, data) {
    if (!L) return null;
    const now = now0();
    const cur = C.act;
    if (cur && (PRI[cur.kind] > PRI[kind] || (PRI[cur.kind] === 5 && PRI[kind] === 5))) return null;
    if (cur) endAct(cur, now);
    const a = { kind, t0: now, dur: (RM && DUR_RM[kind]) || DUR[kind], hit: false, init: false, pawOver: false };
    if (data) Object.assign(a, data);
    C.act = a;
    if (kind === 'swat' || kind === 'buck') C.swat = a;
    if (kind === 'warn' || kind === 'swat' || kind === 'push' || kind === 'bury' || kind === 'sit') C.petUntil = 0;
    kick();
    return a;
  }
  function endAct(a, now) {
    if (C.act === a) C.act = null;
    if (C.swat === a) C.swat = null;
    // let him finish one thing before he thinks of the next
    if (PRI[a.kind] > 1) C.idleAt = Math.max(C.idleAt, now + 4000);
    // cut short with the avocado still in his paws: let it go somewhere sensible
    if (!a.hit && (a.kind === 'push' || a.kind === 'bury' || a.kind === 'sit') && A.carry) {
      a.hit = true;
      finishCarry();
      seal(A.x, A.y - 12 * L.s, now);
    }
    if (a.kind === 'pounce') pom.pinned = null;
    // a painting cut short is kept if it was signed, else it just fades away
    if (a.kind === 'paint' && art.cur) {
      if (a.signed) artDone(now);
      else { art.fly = { c: art.cur.c, t0: now, wall: false, quiet: true }; art.cur = null; }
    }
    if (a.kind === 'nip' && nip.sprig && !nip.sprig.fade) nip.sprig.fade = now;
    if (a.kind === 'nudge') books.push = 0;
    if (a.kind === 'book' || a.kind === 'bookrest') {
      // the flop onto the pages, done: he stays there a while, the book stays open
      if (a.kind === 'book' && a.done && start('bookrest', { i: a.i })) return;
      if (books.open === a.i) bookBack(now);
    }
    if (a.kind === 'eat') {
      // keep looking at you for a moment after a treat
      if (a.hit) C.faceUntil = now + 600;
      if (treatQ > 0 && !treat.on) { treatQ--; later(() => { if (L && !treat.on) launchTreat(now0()); }, 360); }
    }
  }
  // x, y in cat units; legs are drawn in his own shifted frame
  function paw(w, x, y, up, beans = 0, rot = 0, fast = 0) {
    const ox = P.bx, oy = P.by - P.lift;
    if (w === 'n') {
      T.nX = x - ox; T.nY = y - oy; T.nUp = up; T.nBeans = beans; T.nRot = rot;
      if (fast) rate.nX = rate.nY = rate.nUp = fast;
    } else {
      T.fX = x - ox; T.fY = y - oy; T.fUp = up; T.fBeans = beans; T.fRot = rot;
      if (fast) rate.fX = rate.fY = rate.fUp = fast;
    }
  }
  // a quick strike: cock the paw, hit the target, follow through, come home
  function strike(k, tx, ty, ck, beansUp) {
    const S0 = SHOULDER_N[0], S1 = SHOULDER_N[1];
    let dx = tx - S0, dy = ty - S1;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const reach = clamp(d - 18, 30, 165);
    const Tx = S0 + dx * reach, Ty = S1 + dy * reach;
    const cx0 = S0 + ck[0], cy0 = S1 + ck[1];
    const thx = Tx + dx * 12, thy = Ty + dy * 12;
    if (RM) { if (k < 0.85) paw('n', Tx, Ty, 1, 0, 0, 1e3); else paw('n', PAW_N[0], PAW_N[1], 0, 0, 0, 1e3); return; }
    let px, py, beans = 0;
    if (k < 0.36) { const u = easeOut(k / 0.36); px = lerp(PAW_N[0], cx0, u); py = lerp(PAW_N[1], cy0, u); beans = beansUp; }
    else if (k < 0.48) { const u = easeIn((k - 0.36) / 0.12); px = lerp(cx0, Tx, u); py = lerp(cy0, Ty, u); }
    else if (k < 0.6) { const u = easeOut((k - 0.48) / 0.12); px = lerp(Tx, thx, u); py = lerp(Ty, thy, u); }
    else { const u = easeInOut((k - 0.6) / 0.4); px = lerp(thx, PAW_N[0], u); py = lerp(thy, PAW_N[1], u); }
    paw('n', px, py, k < 0.95 ? 1 : 0, beans, 0, 1e3);
  }

  // where he looks during an action (1: a point, 2: straight at you)
  function actLook(a, e, now) {
    const { s } = L;
    switch (a.kind) {
      case 'swat': case 'bury':
        if (!a.hit || a.kind === 'swat') { LK.mode = 1; LK.x = A.x; LK.y = A.y - 10 * s; LK.pupil = 0.7; } else LK.mode = 2;
        break;
      case 'sit': if (e < (RM ? 500 : 1000)) { LK.mode = 1; LK.x = A.x; LK.y = A.y - 10 * s; } else LK.mode = 2; break;
      case 'push': if (e < 450 && !a.hit) { LK.mode = 1; LK.x = A.x; LK.y = A.y - 20 * s; LK.pupil = 0.5; } else LK.mode = 2; break;
      case 'buck': case 'glare': LK.mode = 1; LK.x = A.x; LK.y = A.y - 10 * s; LK.pupil = a.kind === 'buck' ? 0.8 : 0.35; LK.flat = true; break;
      case 'boop': case 'love': case 'tilt': case 'wake': case 'yawn': case 'pat': LK.mode = 2; break;
      case 'warn': LK.mode = 1; LK.x = a.lx ?? pointer.x; LK.y = a.ly ?? pointer.y; LK.pupil = 0.8; break;
      case 'bat': case 'pounce': LK.mode = 1; LK.x = pom.x; LK.y = pom.y; LK.pupil = 1; break;
      case 'window': if (win.kind) { LK.mode = 1; LK.x = win.x; LK.y = win.y; LK.pupil = 1; } break;
      case 'eat':
        if (treat.on) { LK.mode = 1; LK.x = treat.x; LK.y = treat.y; }
        // done eating: a happy look straight at you
        else if (e > (RM ? 1700 : 2900)) LK.mode = 2;
        LK.pupil = 0.7;
        break;
      case 'laser': {
        const ph = a.phase || 'watch';
        if (ph === 'peek' && a.pk) { LK.mode = 1; LK.x = a.pk.x; LK.y = a.pk.y; LK.pupil = 0.8; }
        else if (laser.on) { LK.mode = 1; LK.x = laser.x; LK.y = laser.y; LK.pupil = 1; }
        else if (a.tx !== undefined) { LK.mode = 1; LK.x = L.catX + a.tx * s; LK.y = L.topY + a.ty * s; LK.pupil = 1; }
        break;
      }
      case 'brush': case 'blinkback': case 'psst': case 'shake': case 'bookrest': LK.mode = 2; break;
      case 'huff': case 'unimpressed': LK.mode = 2; LK.flat = true; break;
      // pointedly looking anywhere but at you
      case 'ignore': LK.mode = 1; LK.x = L.catX + 400 * s; LK.y = L.topY - 190 * s; LK.pupil = 0.3; LK.flat = true; break;
      case 'nip':
        if (nip.sprig && e < (RM ? 600 : 2100)) { const p = sprigPos(now); LK.mode = 1; LK.x = L.catX + p.x * s; LK.y = L.topY + p.y * s; LK.pupil = 0.9; }
        else LK.mode = 2;
        break;
      case 'paint':
        if (a.look) { LK.mode = 1; LK.x = L.catX + a.look.x * s; LK.y = L.topY + a.look.y * s; LK.pupil = 0.6; } else LK.mode = 2;
        break;
      case 'book':
        if (e < (RM ? 400 : 1300)) { LK.mode = 1; LK.x = L.catX + BOOK_AT[0] * s; LK.y = L.topY + BOOK_AT[1] * s; LK.pupil = 0.55; } else LK.mode = 2;
        break;
      case 'nudge':
        if (e < (RM ? 600 : 1300) && books.stack.length) { const p = stackPos(books.stack.length - 1); LK.mode = 1; LK.x = L.catX + p.x * s; LK.y = L.topY + p.y * s; }
        else LK.mode = 2;
        break;
      default: break;
    }
  }
  // lying down across an open book, k from 0 to 1
  // (his paws are already on it: it's under him, in front of his chest)
  function bookFlop(k) {
    T.hx -= 22 * k; T.hy += 44 * k; T.pitch = lerp(T.pitch, 0.3, k); T.roll += 0.16 * k; T.yaw = lerp(T.yaw, 0.12, k);
    contentFace(k); T.tCurl += 0.3 * k; T.tAmp = 0.06;
    rate.hx = rate.hy = rate.pitch = 4;
  }

  function actPose(a, e, now) {
    const { s } = L;
    const k = clamp(e / a.dur);
    switch (a.kind) {
      case 'swat': {
        if (!a.hit) { a.tx = cx(A.x); a.ty = cy(A.y - 14 * s); if (a.ty < -40) a.tx = Math.max(a.tx, 166); }
        strike(k, a.tx, a.ty, [46, -40], 1);
        T.earFL = T.earFR = 0.55; T.brow = 0.7; T.lidU = 0.3; T.happy = 0; T.whisk = -0.5;
        T.bx = 4 * hump(k);
        a.pawOver = true;
        if (!a.hit && k >= (RM ? 0.25 : 0.48)) { a.hit = true; if (inZone() || A.place) swatHit(now); }
        break;
      }
      case 'push': {
        // it gets nudged across the cushion toward the front edge, one slow
        // shove at a time, his eyes on you the whole time; it teeters there,
        // one last tap, and over it goes
        if (!a.init) { a.init = true; A.carry = 'push'; A.place = null; A.vx = A.vy = A.w = 0; a.x0 = cx(A.x); a.y0 = cy(A.y); a.ang0 = A.ang; a.n = -1; }
        const sx0 = 46, sy0 = -19, dx = -9, dy = 5;
        const tIn = RM ? 200 : 520, nud = RM ? 330 : 470, tE = tIn + nud * 3, tT = tE + (RM ? 300 : 620), tGo = tT + (RM ? 120 : 200);
        let px = PAW_N[0], py = PAW_N[1], beans = 0, up = 1;
        if (!a.hit) {
          const ky = easeInOut(clamp(e / tIn));
          let axc = lerp(a.x0, sx0, ky), ayc = lerp(a.y0, sy0, ky), ang = a.ang0 * (1 - ky);
          if (e < tIn) {
            const u = easeOut(e / tIn);
            px = lerp(PAW_N[0], axc + 38, u); py = lerp(PAW_N[1], ayc - 12, u) - 10 * hump(u);
          } else if (e < tE) {
            // in against its side, shove, and back off a little
            const i = Math.floor((e - tIn) / nud), u = (e - tIn - i * nud) / nud;
            const pk = RM ? (u > 0.5 ? 1 : 0) : smooth(0.25, 0.75, u);
            axc = sx0 + dx * (i + pk); ayc = sy0 + dy * (i + pk);
            if (u < 0.25) { const v = easeOut(u / 0.25); px = lerp(axc + 38, axc + 30, v); py = lerp(ayc - 12, ayc - 4, v); }
            else if (u < 0.75) { px = axc + 30; py = ayc - 4; }
            else { const v = easeInOut((u - 0.75) / 0.25); px = lerp(axc + 30, axc + 38, v); py = lerp(ayc - 4, ayc - 12, v); }
            if (!RM) ang = -0.08 * Math.sin(pk * Math.PI);
            if (i === 2 && u > 0.75) beans = 1;
            if (u > 0.3 && a.n !== i) { a.n = i; play('pluck', 7, { gain: 0.05 }); }
          } else {
            // right at the edge: it wobbles, he waits, beans up
            axc = sx0 + dx * 3; ayc = sy0 + dy * 3;
            const te = e - tE;
            if (!a.teeter) { a.teeter = true; A.worriedAt = now; setFace('worried', 1800); }
            ang = RM ? -0.1 : -0.15 * Math.sin(te / 65) * (0.65 + 0.35 * Math.sin(te / 210));
            px = axc + 38; py = ayc - 22; beans = 1;
            if (e >= tT) {
              const v = clamp((e - tT) / (tGo - tT));
              px = lerp(axc + 38, axc + 29, v); py = lerp(ayc - 22, ayc - 6, easeIn(v));
              if (v >= 1) {
                a.hit = true; A.carry = null; a.hx = px; a.hy = py; a.goneT = now;
                A.x = L.catX + axc * s; A.y = L.topY + ayc * s; A.ang = ang;
                seal(A.x, A.y - 12 * s, now);
                setFace('squeeze', 900);
                if (RM) fadeAvo(() => restOnFloorAt(Math.max(L.home.x, L.catX + 230 * s)), 220, 420);
                // off the front of the cushion, not back onto it, and down to the bottom
                else { sendOff(65 * s, 60 * s, 0.5, true); A.fast = false; }
              }
            }
          }
          if (!a.hit) { A.x = L.catX + axc * s; A.y = L.topY + ayc * s; A.ang = ang; }
        }
        if (a.hit) {
          if (a.goneT === undefined) { a.goneT = now - 450; a.hx = PAW_N[0]; a.hy = PAW_N[1]; }
          const v = easeInOut(clamp((now - a.goneT) / 450));
          px = lerp(a.hx, PAW_N[0], v); py = lerp(a.hy, PAW_N[1], v); up = 1 - v;
          T.grin = 0.35;
        }
        paw('n', px, py, up, beans, 0.2, 30);
        T.lidU = 0.5; T.lidL = 0.15; T.brow = 0.25; T.happy = 0; T.whisk = -0.1; T.tongue = 0;
        T.earSL = T.earSR = 0.1; T.earFL = T.earFR = 0;
        a.pawOver = true;
        break;
      }
      case 'buck': {
        // off my back: a bounce of the hips, a lash of the tail, a glare over his shoulder
        if (!a.init) { a.init = true; a.side = A.x < L.catX + 40 * s ? -1 : 1; A.vx = A.vy = A.w = 0; A.sleeping = true; }
        const tK = RM ? 200 : 300;
        T.earFL = T.earFR = 0.95; T.brow = 1; T.lidU = 0.35; T.happy = 0; T.whisk = -0.8; T.grin = -0.6; T.wrinkle = 0.5;
        T.tAmp = 1; T.tLift = 0.5 * hump(k * 1.4);
        rate.yaw = rate.pitch = 14;
        if (!RM) {
          if (e < 220) { T.rumpY = 5 * easeOut(e / 220); T.lift = -2; }
          else if (e < 520) { const v = hump((e - 220) / 300); T.rumpY = 5 - 19 * v; T.rumpA = -0.1 * v; T.lift = 8 * v; T.by = -3 * v; }
          T.tFlick = Math.sin(e / 45) * 0.7 * (1 - k);
          rate.rumpY = rate.rumpA = rate.lift = rate.by = 30;
        }
        if (!a.hit && e >= tK) {
          a.hit = true;
          seal(A.x, A.y - 12 * s, now);
          A.place = null; A.touchedCat = false;
          if (RM) { fadeAvo(() => restOnFloorAt(a.side < 0 ? 60 * s : Math.max(L.home.x, L.catX + 230 * s)), 260, 420); setFace('dizzy', 1600); }
          else {
            sendOff(a.side * (300 + Math.random() * 160) * s, -(760 + Math.random() * 200) * s, a.side * (10 + Math.random() * 6));
            A.sqv -= 8; A.sqA = -Math.PI / 2; A.fast = true;
            setFace('squeeze', 900);
          }
        }
        break;
      }
      case 'bury': {
        if (!a.init) { a.init = true; A.carry = 'bury'; A.place = null; a.ax = cx(A.x); A.vx = A.vy = A.w = 0; A.ang = 0; }
        const tS = RM ? 300 : 520, tE = RM ? 1100 : 2100;
        if (e < tS) { T.noseTw = RM ? 0.5 : Math.sin(e / 40) * 0.8; T.pitch += 0.16; T.whisk = 0.4; }
        if (e >= tS && e < tE) {
          // rake the cushion toward it, like covering something gross
          const n = RM ? 1 : 4, seg = (tE - tS) / n, i = Math.min(n - 1, Math.floor((e - tS) / seg)), u = ((e - tS) - i * seg) / seg;
          const x0 = a.ax + 52, x1 = a.ax + 32;
          let px, py;
          if (RM) { px = x1; py = 6; }
          else if (u < 0.3) { const v = easeOut(u / 0.3); px = lerp(x1 + 4, x0, v); py = lerp(4, -14, v); }
          else if (u < 0.45) { const v = easeIn((u - 0.3) / 0.15); px = x0; py = lerp(-14, 6, v); }
          else { const v = easeInOut((u - 0.45) / 0.55); px = lerp(x0, x1, v); py = 6; }
          paw('n', px, py, 1, 0, 0.6, 32);
          if (u >= 0.45 && a.sc !== i) { a.sc = i; fx.scratches.push({ t0: now, x: a.ax + 42, y: 9 + i * 1.6, i }); }
        } else if (e >= tE) {
          const v = easeInOut((e - tE) / (a.dur - tE));
          paw('n', lerp(a.ax + 32, PAW_N[0], v), lerp(6, PAW_N[1], v), 1 - v, 0, 0.6, 20);
          if (e < tE + 500) T.lidU = Math.max(T.lidU, hump((e - tE) / 500));
          T.happy = 0.5;
        }
        // it sinks into the fluff as the heap grows round it
        if (!a.hit) { A.sink = 0.75 * smooth(tS, tE, e); A.mound = RM ? smooth(tS, tE, e) : smooth(tS + 120, tE, e); }
        if (!a.hit && e >= tE) {
          a.hit = true;
          // stamped on the cushion just under the heap, not on it
          seal(A.x + 6 * s, A.y + 52 * s, now);
          A.carry = null;
          // the mound stays a moment, then it all fades and the avocado turns up on the floor
          fadeAvo(() => { A.sink = 0; A.mound = 0; restOnFloorAt(L.home.x); }, RM ? 300 : 600, RM ? 400 : 700);
        }
        a.pawOver = true;
        break;
      }
      case 'sit': {
        if (!a.init) { a.init = true; A.carry = 'sit'; A.place = null; a.x0 = A.x; a.x1 = L.catX + 106 * s; A.vx = A.vy = A.w = 0; A.ang = 0; }
        const tA = RM ? 300 : 700, tB = RM ? 500 : 1050, tC = RM ? 1900 : 3000;
        if (e < tA && !a.hit) {
          // paw over the top, then pull it in under his chest
          const u = e / tA, ax = cx(A.x), ay = cy(A.y) - 48;
          if (u < 0.45) { const v = easeOut(u / 0.45); paw('n', lerp(PAW_N[0], ax, v), lerp(PAW_N[1], ay, v) - 20 * hump(v), 1, 0, 0.3, 25); }
          else {
            const v = easeInOut((u - 0.45) / 0.55);
            A.x = lerp(a.x0, a.x1, v);
            A.under = v > 0.05;
            paw('n', cx(A.x) - 4, cy(A.y) - 44, 1 - v * 0.5, 0, 0.3, 25);
          }
          A.y = L.topY - avoBottom();
        } else if (!a.hit) {
          A.x = a.x1; A.under = true;
          A.mash = RM ? 1 : smooth(tA, tB, e);
          T.lift = 9; rate.lift = 8;
        }
        if (e >= tB && e < tC) {
          contentFace(1); T.tCurl = 1.2; T.tAmp = 0.05;
          if (!a.purr && e > tB + 200) { a.purr = true; play('purr', { gain: 0.2, seconds: 1.6 }); }
        }
        if (!a.hit && e >= tC) {
          a.hit = true;
          A.under = false; A.mash = 0; A.carry = null;
          A.y = L.topY - avoBottom() - 4 * s;
          seal(A.x, A.y - 12 * s, now);
          setFace('squeeze', 900);
          if (RM) fadeAvo(() => restOnFloorAt(Math.max(L.home.x, L.catX + 230 * s)), 200, 420);
          else { if (cramped(1)) sendOff(360 * s, -80 * s, 7); else sendOff(560 * s, -420 * s, 9); A.fast = true; A.sqv -= 8; A.sqA = Math.PI; }
        }
        if (e >= tC) T.by += 3 * hump((e - tC) / 400);
        break;
      }
      case 'warn': {
        if (!a.init) {
          a.init = true;
          let tx = 178, ty = -72;
          if (now - pointer.t < 1500) { tx = Math.max(150, cx(pointer.x)); ty = clamp(cy(pointer.y), -60, 0); }
          // aimed at your hand, but it always stops short
          const dx = tx - SHOULDER_N[0], dy = ty - SHOULDER_N[1], d = Math.hypot(dx, dy) || 1, r = clamp(d - 16, 40, 110);
          a.tx = SHOULDER_N[0] + (dx / d) * r; a.ty = SHOULDER_N[1] + (dy / d) * r;
          a.lx = L.catX + tx * s; a.ly = L.topY + ty * s;
          C.grumpyUntil = now + 3400; C.stim = C.stimMax * 0.25; C.petUntil = 0;
          say('cat.say.over');
        }
        // wound up low and out to the side, well clear of his own face
        strike(k, a.tx, a.ty, [52, -14], 1);
        T.earSL = T.earSR = 0.95; T.earFL = T.earFR = 0.45; T.brow = 0.7; T.lidU = 0.12; T.happy = 0; T.joy = 0; T.whisk = -0.9; T.grin = -0.6;
        rate.lidU = rate.happy = rate.earSL = rate.earSR = 30;
        T.tAmp = 0.6;
        if (!a.hit && k >= 0.5) { a.hit = true; fx.rings.push({ x: L.catX + a.tx * s, y: L.topY + a.ty * s, t0: now }); play('pluck', 3, { gain: 0.08 }); }
        break;
      }
      case 'boop': {
        const pull = hump(clamp(e / 280));
        T.hx -= 3 * pull; T.pitch -= 0.06 * pull; T.earFL += 0.25 * pull; T.earFR += 0.25 * pull;
        T.noseTw = RM ? 0 : e < 700 ? Math.sin(e / 36) * (1 - e / 700) : 0;
        const b0 = RM ? 150 : 240, b1 = RM ? 600 : 720, b2 = RM ? 800 : 920, b3 = RM ? 1100 : 1320;
        const lid = e < b0 ? 0 : e < b1 ? easeInOut((e - b0) / (b1 - b0)) : e < b2 ? 1 : 1 - easeInOut((e - b2) / (b3 - b2));
        T.lidU *= 1 - pull; contentFace(lid); T.whisk = 0.4;
        if (!a.hit && e >= (RM ? 300 : 430)) { a.hit = true; C.mrrpAt = now; word('냥?', 26); play('mrrp', { gain: 0.16 }); }
        break;
      }
      case 'love': {
        const lid = e < 300 ? 0 : e < 800 ? easeInOut((e - 300) / 500) : e < 1050 ? 1 : 1 - easeInOut((e - 1050) / 500);
        contentFace(lid);
        break;
      }
      case 'pat': {
        const f = e < 140 ? e / 140 : e < 420 ? 1 : 1 - (e - 420) / 480;
        // ears pressed down under the hand, eyes squeezed happily shut
        T.earFL = T.earFR = Math.max(T.earFL, 0.6 * f); T.earSL = T.earSR = Math.max(T.earSL, 0.2 * f);
        contentFace(f); T.hy += 2.5 * f; T.pitch += 0.06 * f;
        rate.earFL = rate.earFR = 24;
        break;
      }
      case 'eat': {
        const tL = RM ? 1 : 500, tS = RM ? 400 : 1300, tB = RM ? 600 : 1500, tC = RM ? 1700 : 3000, tK = RM ? 2100 : 3500;
        // sniff from just above it, then down for the bite, then up to chew
        if (e < tS) { T.pitch = 0.5; T.hx = -34; T.hy = 34; T.yaw = -0.04; T.gx = -0.3; T.gy = 0.8; }
        else if (e < tB) { T.pitch = 0.62; T.hx = -48; T.hy = 52; T.yaw = -0.04; T.gx = -0.2; T.gy = 0.6; }
        else if (e < tC) { T.pitch = 0.22; T.hx = -8; T.hy = 18; T.yaw = 0.12; T.gx = 0; T.gy = 0.2; }
        else { T.yaw = 0.1; T.pitch = 0.04; }
        rate.hx = rate.hy = rate.pitch = 5;
        if (e >= tL && e < tS) { T.noseTw = RM ? 0.5 : Math.sin(e / 34) * 0.9; T.whisk = 0.7; T.lidU = 0.25; }
        if (e >= tS && e < tB) T.jaw = 0.35;
        if (!a.hit && e >= tB - 50) { a.hit = true; treat.on = false; treats++; renderTally(); play('chew', { gain: 0.22 }); word('냠냠', 24); }
        if (e >= tB && e < tC) {
          const c = (e - tB) / 300;
          T.jaw = RM ? 0.15 : 0.1 + 0.16 * (0.5 - 0.5 * Math.cos(c * TAU));
          T.chew = RM ? 0 : Math.sin(c * TAU);
          T.roll += RM ? 0 : 0.05 * Math.sin(c * TAU);
          // eyes shut with how good it is
          T.joy = 0.95; T.grin = 0.3;
          rate.jaw = 30;
        }
        if (e >= tC && e < tK) { const v = (e - tC) / (tK - tC); T.tongue = 1; T.lick = RM ? 0.5 : hump((v * 2) % 1); T.jaw = 0; T.joy = 0.95; }
        if (e >= tK) {
          contentFace(1); T.tCurl = 1.2;
          if (!a.m) {
            a.m = true; C.mrrpAt = now; play('mrrp', { gain: 0.12 });
            // a heart and a purr or two over his head
            headMatrix(P);
            for (let i = 0; i < 3; i++) { const q = headToCat(-34 + i * 36, -46 - (i % 2) * 10); fx.purrs.push({ t0: now + i * 180, x: q.x, y: q.y, seed: i === 1 ? 0 : 1 + i * 3 }); }
          }
        }
        break;
      }
      case 'bat': {
        if (!a.hit) { a.tx = cx(pom.x); a.ty = cy(pom.y); }
        strike(k, a.tx, a.ty, [30, -44], 1);
        T.pupil = 1; T.whisk = 0.9; T.earSL = T.earSR = 0; T.lidU = 0; T.happy = 0;
        if (!a.hit && k >= 0.46) {
          a.hit = true;
          const px = P.nX + P.bx, py = P.nY + P.by - P.lift, tx = cx(pom.x), ty = cy(pom.y);
          const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy) || 1;
          if (d < 40) {
            pom.vx += (dx / d) * 520 * s + 120 * s; pom.vy += (dy / d) * 300 * s - 240 * s;
            if (pom.held) { pom.x += 16 * s; pom.y -= 10 * s; }
            play('pluck', 4, { gain: 0.1 });
          }
        }
        break;
      }
      case 'pounce': {
        const tW = RM ? 300 : 850, tL = RM ? 400 : 1150, tH = RM ? 1000 : 1600;
        if (e < tW) {
          // the crouch: head down, the butt wiggle getting bigger, the tip of the tail twitching
          const w = smooth(0, tW, e);
          if (!RM) { T.rumpY = -7 + Math.sin(e / 30) * (2.4 + 2 * w); T.rumpA = Math.sin(e / 44) * (0.04 + 0.04 * w); T.tFlick = Math.sin(e / 42) * 0.6; T.tAmp = 0.3; }
          T.by = 3; T.lift = -3; T.hy += 6 + 5 * w; T.pitch += 0.15 * w; T.earFL = T.earFR = 0; rate.rumpY = rate.rumpA = 30;
          a.tx = cx(pom.x); a.ty = cy(pom.y);
        } else if (e < tH) {
          const v = RM ? 1 : easeOut((e - tW) / (tL - tW));
          // the lunge, but only as far as there's room for his face on a narrow screen
          const room = clamp((L.W - 6 * s - L.catX) / s - HEAD_RIGHT, 0, 30);
          T.bx = 24 * v * (room / 30); T.by = -10 * v - 4 * v * (1 - room / 30); T.hx += 6 * v * (room / 30);
          const tx = clamp(a.tx, 120, Math.min(235, (L.W - 40 * s - L.catX) / s)), ty = clamp(a.ty, -130, 8);
          paw('n', tx, ty, 1, 0, 0, 40);
          paw('f', tx - 14, ty + 10, 1, 0, 0, 40);
          rate.bx = rate.by = 25;
          if (!a.hit && e >= (tW + tL) / 2) {
            a.hit = true;
            if (Math.hypot(cx(pom.x) - tx, cy(pom.y) - ty) < 95) {
              pom.pinned = { x: tx + 4, y: ty + 2 };
              if (pom.held) { pom.held = null; pom.auto = null; stage.classList.remove('is-grabbing'); }
              play('pluck', 5, { gain: 0.12 });
            }
          }
        } else if (pom.pinned) pom.pinned = null;
        T.pupil = 1; T.lidU = 0; T.whisk = 0.9; T.earSL = T.earSR = 0; T.happy = 0;
        break;
      }
      case 'groom': {
        const m = facePoint(P, 0, -0.55, FACE_R * 1.05), mx = m.x + 8, my = m.y + 12;
        if (e < 500) { const v = easeOut(e / 500); paw('n', lerp(PAW_N[0], mx, v), lerp(PAW_N[1], my, v), 1, 1, -0.8); T.pitch = 0.22; T.yaw = 0.3; }
        else if (e < 1800) {
          const c = ((e - 500) % 325) / 325;
          paw('n', mx, my, 1, 1, -0.8);
          T.pitch = 0.22 + 0.08 * hump(c); T.yaw = 0.3; T.tongue = 1; T.jaw = 0.12; T.lidU = 0.7;
        } else if (e < 3200) {
          const c = ((e - 1800) % 700) / 700;
          const p0 = facePoint(P, 0.55, -0.25, FACE_R), x0 = p0.x + 6, y0 = p0.y + 4;
          const p1 = facePoint(P, 0.85, 0.6, FACE_R), x1 = p1.x + 4, y1 = p1.y;
          const v = hump(c);
          paw('n', lerp(x0, x1, v), lerp(y0, y1, v), 1, 0, -1.2, 25);
          T.roll = 0.22; T.yaw = -0.2; T.pitch = 0.12; T.lidU = 1; T.happy = 0; T.earFR = 0.5 * v;
        } else { const v = easeInOut((e - 3200) / 600); paw('n', lerp(mx, PAW_N[0], v), lerp(my, PAW_N[1], v), 1 - v, 0, 0); }
        T.gx = 0; T.gy = 0;
        break;
      }
      case 'yawn': {
        const J = e < 700 ? easeInOut(e / 700) : e < 1300 ? 1 : e < 1700 ? 1 - easeInOut((e - 1300) / 400) : 0;
        T.jaw = J; T.fangs = J; T.lidU = lerp(T.lidU, 1, smooth(0, 0.4, J)); T.happy = 0.35 * J; T.pitch = -0.35 * J; T.yaw = 0.1;
        T.earFL = T.earFR = 0.45 * J; T.earSL = T.earSR = 0.2 * J; T.whisk = -0.4 * J; T.hy -= 3 * J;
        rate.jaw = 8;
        if (e > 1700) { T.tongue = 1; T.lick = hump((e - 1700) / 500); }
        break;
      }
      case 'window': {
        if (!win.kind) { a.dur = 0; break; }
        T.pupil = 1; T.whisk = 0.8; T.lidU = 0; T.earSL = T.earSR = 0; T.earFL = T.earFR = 0; T.happy = 0;
        if (win.kind === 'bird' && win.perched) {
          T.jaw = 0.1 + 0.09 * Math.sin(e / 30); rate.jaw = 40;
          T.tFlick = Math.sin(e / 70) * 0.25;
          if (!a.chat) { a.chat = true; play('chatter', { gain: 0.14 }); }
        }
        break;
      }
      case 'tilt': {
        const v = hump(k);
        T.roll += 0.34 * v * a.dir; T.pupil = 0.6;
        if (a.dir > 0) T.earSR += 0.6 * v; else T.earSL += 0.6 * v;
        break;
      }
      case 'sleep': {
        T.lidU = 1; T.happy = 0; T.hy += 16; T.pitch = 0.4; T.roll = -0.08; T.yaw = 0.1; T.gx = 0; T.gy = 0;
        T.earSL = T.earSR = 0.22; T.tAmp = 0.02; T.tCurl = 0.95; T.whisk = -0.2; T.grin = 0.2;
        rate.hy = rate.pitch = 1.2;
        if (!a.asleep && e > 2600) { a.asleep = true; say('cat.say.sleep'); }
        if (!RM && a.asleep && now - C.zAt > 1800) {
          C.zAt = now;
          headMatrix(P);
          const z = headToCat(34, -52);
          fx.zs.push({ t0: now, x: z.x, y: z.y });
        }
        break;
      }
      case 'wake': {
        T.lidU = lerp(1, 0.1, smooth(0, 0.7, k));
        const J = hump(clamp((k - 0.2) / 0.5)) * 0.55;
        T.jaw = J; T.fangs = J; T.pitch = -0.2 * hump(clamp((k - 0.2) / 0.6));
        break;
      }
      case 'laser': {
        // eyes locked on the dot, pupils huge, tail tip going; in reach and still, the
        // butt wiggle, the pounce, and a look under his paws for what he caught
        const ph = a.phase || 'watch';
        T.pupil = 1; T.whisk = 0.8; T.lidU = 0; T.happy = 0; T.joy = 0; T.earSL = T.earSR = 0; T.earFL = T.earFR = 0;
        T.tAmp = 0.3;
        if (!RM) T.tFlick = Math.sin(now / 55) * 0.35;
        const reach = dotInReach();
        if (ph === 'watch') {
          if (!laser.on) { a.dur = 0; break; }
          const still = now - laser.lastMove;
          if (reach && !RM) {
            const w = smooth(100, 500, still);
            T.rumpY = -4 * w + Math.sin(now / 32) * 1.6 * w; T.rumpA = Math.sin(now / 46) * 0.03 * w; T.hy += 4 * w; T.pitch += 0.08 * w;
            rate.rumpY = rate.rumpA = 30;
          }
          if (reach && still > 450 && now - (a.lastP || -1e9) > 1500) { a.phase = 'crouch'; a.p0 = now; a.tx = cx(laser.x); a.ty = cy(laser.y); }
        } else if (ph === 'crouch') {
          const ec = now - a.p0, tW = RM ? 250 : 650, w = smooth(0, tW, ec);
          if (!RM) { T.rumpY = -7 + Math.sin(ec / 30) * (2.4 + 2 * w); T.rumpA = Math.sin(ec / 44) * (0.04 + 0.04 * w); T.tFlick = Math.sin(ec / 42) * 0.6; }
          T.by = 3; T.lift = -3; T.hy += 6 + 5 * w; T.pitch += 0.15 * w; rate.rumpY = rate.rumpA = 30;
          // it can still creep a little before he goes
          if (reach) { a.tx = lerp(a.tx, cx(laser.x), 0.2); a.ty = lerp(a.ty, cy(laser.y), 0.2); }
          if (ec >= tW) { a.phase = 'lunge'; a.p0 = now; a.hit = false; }
        } else if (ph === 'lunge') {
          const el = now - a.p0, v = RM ? 1 : easeOut(el / 260);
          const room = clamp((L.W - 6 * s - L.catX) / s - HEAD_RIGHT, 0, 30), fwd = clamp((a.tx - 60) / 80) * (room / 30);
          T.bx = 24 * v * fwd; T.by = -8 * v; T.hx += 6 * v * fwd; T.hy += 4;
          const tx = clamp(a.tx, 50, Math.min(235, (L.W - 40 * s - L.catX) / s)), ty = clamp(a.ty, -130, 10);
          paw('n', tx, ty, 1, 0, 0, 40); paw('f', tx - 14, ty + 8, 1, 0, 0, 40);
          rate.bx = rate.by = 25;
          a.pawOver = true;
          if (!a.hit && el > (RM ? 0 : 200)) { a.hit = true; a.lastP = now; laser.caught = now; a.ptx = tx; a.pty = ty; play('pluck', 5, { gain: 0.1 }); }
          if (el > (RM ? 300 : 520)) { a.phase = 'peek'; a.p0 = now; a.q = false; a.tdir = Math.random() < 0.5 ? -1 : 1; }
        } else if (ph === 'peek') {
          // paws stay down a moment, then one comes up, beans to his face: empty
          const ep = now - a.p0, up1 = RM ? (ep > 200 ? 1 : 0) : smooth(250, 650, ep), back = RM ? (ep > 900 ? 1 : 0) : smooth(1500, 1900, ep);
          const px = lerp(a.ptx, 132, up1), py = lerp(a.pty, -40, up1);
          paw('n', lerp(px, PAW_N[0], back), lerp(py, PAW_N[1], back), 1 - back, up1 > 0.5 && back < 0.5 ? 1 : 0, -0.9 * up1 * (1 - back), 16);
          paw('f', a.ptx - 14, a.pty + 8, 1 - (RM ? up1 : smooth(200, 650, ep)), 0, 0, 16);
          a.pk = { x: L.catX + (P.nX + P.bx) * s, y: L.topY + (P.nY + P.by - P.lift) * s };
          const tilt = RM ? 1 : hump(clamp(ep / 1900));
          T.roll += 0.3 * tilt * a.tdir; T.earSL += 0.3 * tilt; T.earSR += 0.3 * tilt; T.pupil = 0.75; T.whisk = 0.2;
          a.pawOver = up1 < 0.3;
          if (!a.q && ep > (RM ? 200 : 650)) { a.q = true; word('?', 34); if (!laser.said) { laser.said = true; say('cat.say.laser.pounce'); } }
          if (ep > (RM ? 1100 : 1900)) { a.phase = 'watch'; a.pk = null; if (!laser.on) a.dur = 0; }
        }
        break;
      }
      case 'brush': {
        // three strokes down his back, neck to hips, a tuft or two coming away each time
        const n = RM ? 1 : 3, seg = a.dur / n, i = Math.min(n - 1, Math.floor(e / seg)), u = (e - i * seg) / seg;
        const lift = u < 0.14 ? 1 - u / 0.14 : u > 0.86 ? (u - 0.86) / 0.14 : 0, kk = clamp((u - 0.14) / 0.72);
        // along the top of his back, from behind his head to his hips
        const bx = lerp(30, -110, RM ? 0.5 : easeInOut(kk)), by = BACK_Y(bx) + 4;
        brush.x = L.catX + (bx + P.bx) * s; brush.y = L.topY + (by + P.by - lift * 16) * s; brush.lastT = now;
        brush.a = Math.atan2(BACK_Y(bx - 4) - BACK_Y(bx + 4), -8) + Math.PI;
        if (!RM && lift === 0 && now - (a.tf || 0) > 170) { a.tf = now; spawnTuft(brush.x, brush.y + 5 * s, now); }
        if (RM && !a.r) { a.r = true; for (let j = 0; j < 3; j++) spawnTuft(0, 0, now); }
        C.petZone = 'brush'; C.petUntil = Math.max(C.petUntil, now + 300);
        if (!a.init) { a.init = true; pets++; renderTally(); }
        if (a.sw !== i) { a.sw = i; play('swish', { gain: 0.045 }); }
        if (!a.purr) { a.purr = true; lastPurr = now; play('purr', { gain: 0.24, seconds: 2.6 }); }
        break;
      }
      case 'huff': {
        // fur up, ears out sideways, a pout and a look
        T.earSL += 0.55; T.earSR += 0.55; T.brow = 0.45; T.lidU = 0.16; T.grin = -0.7; T.whisk = -0.5; T.joy = 0; T.happy = 0;
        T.hx -= 3; T.pitch -= 0.05;
        if (!a.w && e > (RM ? 0 : 250)) { a.w = true; word('흥!', 28); }
        C.swishUntil = Math.max(C.swishUntil, now + 600);
        break;
      }
      case 'psst': {
        // his ears swivel round to the sound, his head comes round, and a little mrrp?
        const kk = smooth(0, 200, e) * (1 - smooth(a.dur - 300, a.dur, e));
        T.earSL = T.earSR = 0; T.earFL = T.earFR = 0; T.earTL = 0.28 * kk; T.earTR = -0.28 * kk;
        T.pupil = 0.75; T.lidU = 0; T.roll += 0.1 * kk; T.whisk = 0.4;
        rate.earTL = rate.earTR = 14;
        if (!a.hit && e > (RM ? 150 : 380)) { a.hit = true; C.mrrpAt = now; word('냥?', 26); play('mrrp', { gain: 0.15 }); }
        break;
      }
      case 'ignore': {
        // ears turned out sideways, chin up, looking anywhere else
        T.earSL += 0.6; T.earSR += 0.6; T.lidU = 0.3; T.grin = -0.2; T.whisk = -0.2; T.pitch -= 0.12; T.joy = 0; T.happy = 0;
        C.swishUntil = Math.max(C.swishUntil, now + 400);
        break;
      }
      case 'blinkback': {
        const lid = RM ? (e < 900 ? 1 : 0) : e < 250 ? 0 : e < 800 ? easeInOut((e - 250) / 550) : e < 1250 ? 1 : 1 - easeInOut((e - 1250) / 650);
        contentFace(lid); T.lidU = Math.max(T.lidU, lid);
        rate.lidU = rate.joy = 30;
        if (!a.hit && e > (RM ? 100 : 900)) {
          a.hit = true;
          const q = headPoint(P, 30, -60);
          fx.purrs.push({ t0: now, x: q.x, y: q.y, seed: 0 });
          play('purr', { gain: 0.16, seconds: 1.4 });
        }
        break;
      }
      case 'unimpressed': {
        // a long flat look from under the hat, then a slow blink: fine, he'll allow it
        const kk = smooth(0, 300, e);
        T.lidU = lerp(T.lidU, 0.18, kk); T.earSL += 0.3 * kk; T.earSR += 0.3 * kk; T.grin = -0.35 * kk; T.whisk = -0.2 * kk; T.roll += 0.06 * kk; T.joy = 0;
        if (e > 1100) { const b = RM ? 0 : hump(clamp((e - 1100) / 650)); T.lidU = Math.max(T.lidU, b); T.joy = b; }
        break;
      }
      case 'shake': {
        const v = RM ? 0 : Math.sin(e / 36) * (1 - clamp(e / a.dur));
        T.roll += 0.42 * v; T.hx += 4 * v; T.earSL = T.earSR = 0.5 + 0.4 * Math.abs(v); T.lidU = 0.85; T.joy = 0;
        rate.roll = rate.hx = 40; rate.earSL = rate.earSR = 30;
        if (!a.hit && e > (RM ? 100 : 160)) { a.hit = true; if (hat.i) { hatFlies(now); say('cat.say.hat.shake'); } }
        break;
      }
      case 'nip': {
        const sp = nip.sprig;
        const tF = RM ? 0 : 700, tS = RM ? 600 : 1500, tN = RM ? 900 : 2100, tSilly = RM ? 2600 : 5600;
        if (e < tF) { T.pupil = 0.8; T.whisk = 0.6; }
        else if (e < tS) {
          // a good long sniff
          T.pitch = 0.5; T.hx = -44; T.hy = 42; T.yaw = -0.05; T.gx = -0.2; T.gy = 0.7; T.noseTw = RM ? 0.5 : Math.sin(e / 34) * 0.9; T.whisk = 0.7;
          rate.hx = rate.hy = rate.pitch = 5;
        } else if (e < tN) {
          // a nibble
          T.pitch = 0.55; T.hx = -48; T.hy = 48; T.jaw = RM ? 0.15 : 0.08 + 0.12 * hump(((e - tS) / 220) % 1); rate.jaw = 30;
          if (sp) sp.crushed = smooth(tS, tN, e);
          if (!a.purr) { a.purr = true; play('purr', { gain: 0.3, seconds: 3.6 }); }
        } else if (e < tSilly) {
          // silly: rubbing his cheek all over the cushion, eyes squeezed shut, and now and then a wide-eyed blep
          const c = (e - tN) / 260, ph = ((e - tN) % 1500) / 1500;
          const derp = RM ? 0 : smooth(0.5, 0.62, ph) * (1 - smooth(0.85, 0.97, ph));
          T.hx = -34 + (RM ? 0 : Math.sin(c * 1.6) * 9); T.hy = 44; T.pitch = 0.3; T.roll = 0.45 + (RM ? 0 : Math.sin(c * 1.6) * 0.14); T.yaw = 0.2;
          rate.hx = rate.roll = 12;
          contentFace(1 - derp); T.pupil = 1;
          if (derp > 0.3) { T.tongue = 1; T.lick = 0; }
          T.tAmp = 0.5;
          if (!RM) { T.tFlick = Math.sin(e / 48) * 0.5; T.rumpA = Math.sin(e / 140) * 0.04; }
          if (!a.w && e > tN + 300) { a.w = true; word('냥~', 28); }
        } else {
          // and over he goes, into a catnip nap
          // (eyes stay shut the whole way: the happy arcs just soften into sleepy ones)
          const kk = smooth(tSilly, a.dur, e);
          T.lidU = 1; T.hy += lerp(44, 16, kk); T.pitch = lerp(0.3, 0.4, kk); T.roll = lerp(0.45, -0.08, kk); T.hx = lerp(-34, 0, kk); T.yaw = 0.1; T.joy = 1 - kk;
          T.tAmp = 0.05; T.tCurl = 0.95; T.whisk = -0.2;
          if (sp && !sp.fade) sp.fade = now;
        }
        if (e >= a.dur) {
          a.done = true;
          endAct(a, now);
          const z = start('sleep');
          if (z) { z.asleep = true; z.nip = true; }
          say('cat.say.nip.nap');
          return;
        }
        break;
      }
      case 'paint': {
        const cur = art.cur;
        if (!cur) { a.dur = 0; break; }
        a.dur = cur.end;
        let st = null;
        for (const q of cur.tl) if (e >= q.t) st = q;
        // each step starts from wherever his paw is
        if (st !== a.st) { a.st = st; a.lx = P.nUp > 0.5 ? P.nX + P.bx : PAW_N[0]; a.ly = P.nUp > 0.5 ? P.nY + P.by - P.lift : PAW_N[1]; }
        const u = st ? clamp((e - st.t) / st.d) : 0;
        T.pitch = 0.2; T.hy += 6; T.yaw = 0.08; T.whisk = 0.5; T.pupil = 0.6;
        let px = 0, py = 0, up = 0, rot = 0;
        a.look = null;
        if (!st) {
          // the sheet slides in, and he looks it over
          T.pitch = 0.3; T.noseTw = e > 500 && !RM ? Math.sin(e / 36) * 0.6 : 0;
          a.look = paperPt(ART_W / 2, ART_H / 2); a.look = { x: a.look.x, y: a.look.y };
        } else if (st.kind === 'dip') {
          // down into the ink and back up, wet
          const dx = cx(L.dish.x), dy = cy(L.dish.y) + 1;
          const kk = u < 0.45 ? easeOut(u / 0.45) : u < 0.6 ? 1 : 1 - easeInOut((u - 0.6) / 0.4);
          px = lerp(a.lx, dx, kk); py = lerp(a.ly, dy, kk) - (u < 0.45 ? 16 * hump(u / 0.45) : 0); up = 1; rot = 0.3;
          if (u > 0.42 && !st.done) { st.done = true; C.ink = 1; play('dab', { gain: 0.08 }); }
          a.look = { x: dx, y: dy };
        } else if (st.kind === 'stamp') {
          const p = st.p, q = paperPt(p.u, p.v), tx = q.x, ty = q.y;
          // over, down, maybe a smear, and up
          const kk = u < 0.4 ? easeInOut(u / 0.4) : 1;
          const lift = u < 0.4 ? 12 * hump(kk) + 4 * (1 - kk) : u < 0.55 ? 4 * (1 - (u - 0.4) / 0.15) : u > 0.86 ? 10 * (u - 0.86) / 0.14 : 0;
          px = lerp(a.lx, tx, kk); py = lerp(a.ly, ty, kk) - lift; up = 1; rot = p.rot * 0.25;
          if (u >= 0.55 && !st.done) { st.done = true; inkPrint(p); C.ink = Math.max(0.2, p.ink - 0.25); play('dab', { gain: 0.1 }); }
          if (st.done && p.smudge !== null && u > 0.6) { const sm = smooth(0.6, 0.85, u); px += Math.cos(p.smudge) * 15 * PAPER.ux * sm; py += Math.sin(p.smudge) * 11 * PAPER.vy * sm; }
          a.look = { x: tx, y: ty };
        } else if (st.kind === 'sign') {
          // and a press of the little red seal in the corner
          const q = paperPt(ART_W - 11, ART_H - 11), qx = q.x, qy = q.y;
          const kk = u < 0.45 ? easeInOut(u / 0.45) : u < 0.7 ? 1 : 1 - easeInOut((u - 0.7) / 0.3);
          px = lerp(a.lx, qx, kk); py = lerp(a.ly, qy, kk) - (u < 0.45 ? 10 * hump(u / 0.45) : 0); up = kk > 0.05 ? 1 : 0;
          if (u > 0.45 && !st.done) { st.done = true; a.signed = true; signArt(); play('pluck', 1, { gain: 0.14 }); fx.rings.push({ x: L.catX + qx * s, y: L.topY + qy * s, t0: now }); }
          a.look = { x: qx, y: qy };
        } else if (st.kind === 'admire') {
          contentFace(0.7); T.pitch = 0.12;
          if (!st.done) { st.done = true; word('냥!', 28); C.mrrpAt = now; play('mrrp', { gain: 0.12 }); }
        } else if (st.kind === 'hang') {
          if (!st.done) { st.done = true; artDone(now); }
        }
        if (up) paw('n', px, py, up, 0, rot, RM ? 1e3 : 22);
        break;
      }
      case 'book': {
        // it comes over and falls open; he has a look, then lies right down across it
        const tO = RM ? 200 : 640, tL = RM ? 400 : 1300, tF = RM ? 700 : 2100;
        if (e < tL) {
          T.pitch = 0.25; T.pupil = 0.6;
          if (e > tO && !RM) T.noseTw = Math.sin(e / 36) * 0.5;
          if (e > tO && !a.pg) { a.pg = true; play('page', { gain: 0.14 }); }
        } else {
          bookFlop(RM ? 1 : smooth(tL, tF, e));
          if (!a.said && e > tL + 200) { a.said = true; say(BOOK_SAY[a.i]); }
        }
        if (e >= a.dur) a.done = true;
        break;
      }
      case 'bookrest': {
        bookFlop(1);
        if (!a.purr && e > 400) { a.purr = true; play('purr', { gain: 0.18, seconds: 2.2 }); }
        break;
      }
      case 'nudge': {
        // a paw on the top book, eased over the edge of the sill, slowly, eyes on you
        const list = books.stack;
        if (!a.i && a.i !== 0) { if (!list.length || !L.books.sill || books.fallen) { a.dur = 0; break; } a.i = list[list.length - 1]; }
        const j = list.indexOf(a.i);
        if (j < 0 && !a.hit) { a.dur = 0; break; }
        const tR = RM ? 300 : 800, tP = RM ? 1000 : 2300;
        const b = BOOKS[a.i];
        if (!a.hit) {
          const p = stackPos(j), hx0 = p.x - b.w / 2 + 3, hy0 = p.y - b.h * 0.6;
          let px, py;
          if (e < tR) { const kk = easeOut(e / tR); px = lerp(PAW_N[0], hx0, kk); py = lerp(PAW_N[1], hy0, kk) - 12 * hump(kk); }
          else {
            const kk = (e - tR) / (tP - tR);
            books.push = 18 * (RM ? (kk > 0.5 ? 1 : 0) : smooth(0, 1, kk) * (1 + 0.05 * Math.sin(kk * 20)));
            px = hx0 + books.push; py = hy0;
          }
          a.px = px; a.py = py;
          paw('n', px, py, 1, 0, 0, 25);
          if (e >= tP) { a.hit = true; a.ht = now; dropBook(a.i, now); say('cat.say.nudge', { book: tt(`cat.book.${a.i}`) }); }
        } else {
          const kk = easeInOut(clamp((now - a.ht) / 600));
          paw('n', lerp(a.px, PAW_N[0], kk), lerp(a.py, PAW_N[1], kk), 1 - kk, 0, 0, 25);
          T.grin = 0.35;
        }
        T.lidU = 0.3; T.whisk = -0.1;
        break;
      }
      default: break;
    }
    if (e >= a.dur) endAct(a, now);
  }
  // the top book goes over the edge
  function dropBook(i, now) {
    const j = books.stack.indexOf(i);
    if (j < 0) return;
    const p = stackPos(j), x = p.x + books.push, y = p.y;
    books.stack.splice(j, 1);
    books.push = 0;
    const x1 = x + 46;
    books.fallen = { i, x, y, vx: 60, vy: -30, rot: 0, vr: 2.4, x1, y1: bookFloor(x1), r1: (Math.random() - 0.5) * 0.12, landed: false, t0: now };
  }

  // drop effects that have run their course; true if any are left
  function life(arr, ms, now) {
    for (let i = arr.length - 1; i >= 0; i--) if (now - arr[i].t0 > ms) arr.splice(i, 1);
    return arr.length > 0;
  }

  // the loop
  function update(dt, now) {
    const { s } = L;
    let hot = false;
    // avocado
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) if (stepAvocado(h, now)) hot = true;
    if (Math.abs(A.sq) > 0.002 || Math.abs(A.sqv) > 0.01) {
      if (RM) { A.sq = 0; A.sqv = 0; } else {
        for (let i = 0; i < n; i++) { A.sqv += (-460 * A.sq - 16 * A.sqv) * h; A.sq += A.sqv * h; }
        A.sq = clamp(A.sq, -0.38, 0.3);
        hot = true;
      }
    }
    if (A.face !== 'smug' && now > A.faceUntil && !A.grab) A.face = 'smug';
    if (A.fade) {
      const e = now - A.fade.t0, f = A.fade;
      if (e < f.outMs) A.alpha = 1 - e / f.outMs;
      else {
        if (!f.midDone) { f.midDone = true; f.mid && f.mid(); }
        A.alpha = clamp((e - f.outMs - f.delayIn * 0.3) / (f.delayIn * 0.7));
        if (e > f.outMs + f.delayIn) { A.alpha = 1; A.fade = null; }
      }
      hot = true;
    }
    // "let him handle it": up onto the platform, a smug moment, then he decides
    if (A.place) {
      const p = A.place, e = now - p.t0;
      const px = L.catX + 62 * s, py = L.topY - avoBottom();
      if (RM) {
        if (e < 180) A.alpha = 1 - e / 180;
        else { A.x = px; A.y = py; A.ang = 0; A.alpha = clamp((e - 180) / 200); }
        if (e > 900) startBully(pickBully());
      } else {
        if (e < 170) A.scale = 1 - easeIn(e / 170);
        else if (e < 470) {
          const k = (e - 170) / 300;
          A.x = px; A.y = py - 80 * s * (1 - k * k); A.ang = 0; A.w = 0;
          A.scale = Math.min(1, easeBack(clamp(k * 1.8)));
        } else {
          if (!p.landed) { p.landed = true; A.x = px; A.y = py; A.ang = 0; A.scale = 1; A.sqv -= 6; A.sqA = -Math.PI / 2; setFace('smug', 0); }
          if (e > 850) startBully(pickBully());
        }
      }
      A.vx = A.vy = 0;
      A.sleeping = true;
      hot = true;
    }
    // it came near him on its own
    const bullying = C.act && PRI[C.act.kind] === 5;
    if (!bullying && !A.grab && !A.place && !A.fade && !A.carry && !A.away && now - C.lastSwat > 500 && inZone()) {
      const slow = Math.hypot(A.vx, A.vy) < 720 * s;
      if (C.autoN > 0) {
        // he's already dealt with it once and nobody's done a thing since:
        // it just slinks off out of his way, no bullying on a loop
        if (slow && (A.sleeping || A.grounded)) { C.avoSeenAt = 0; A.vx = A.vy = A.w = 0; A.sleeping = true; setFace('worried', 900); fadeAvo(() => restOnFloorAt(L.home.x), 260, 420); }
      } else if (onPlatform() && slow && (A.sleeping || A.grounded)) {
        if (!C.avoSeenAt) C.avoSeenAt = now;
        else if (now - C.avoSeenAt > (RM ? 200 : 420)) { C.avoSeenAt = 0; startBully(pickBully()); }
      } else if (slow || A.touchedCat) startBully(A.y < L.topY - 60 * s && A.x < L.catX + 60 * s ? 'buck' : 'swat');
    } else if (!inZone()) C.avoSeenAt = 0;
    if (!inZone()) A.touchedCat = false;
    if (A.carry || A.under) hot = true;

    // the pompom, and his tail if it got bumped
    if (stepToy(dt, now)) hot = true;
    if (stepTail(dt, now)) hot = true;
    const toyHot = !!(pom.held || pom.pinned || pom.speed > 160 * s);
    if (toyHot) C.toyT = now;
    if (pom.speed > 260 * s || !pom.held) C.toyStill = now;
    if (toyHot && !pom.pinned && L) {
      const tx = cx(pom.x), ty = cy(pom.y);
      const d = Math.hypot(tx - SHOULDER_N[0], ty - SHOULDER_N[1]);
      const free = !C.act || PRI[C.act.kind] < 3;
      // a couple of quick bats, and if you keep holding it there he goes for the full pounce
      const pounce = free && pom.held && d < 200 && tx > 80 && now - C.pounceAt > 2600 && (now - C.toyStill > (RM ? 400 : 850) || C.batN >= 2);
      if (pounce && now - C.batAt > 450) { C.pounceAt = now; C.batN = 0; start('pounce'); }
      else if (free && d < 128 && tx > 70 && ty < 24 && now - C.batAt > 650) { C.batAt = now; C.batN++; start('bat'); }
    }

    // the treat, flying up to him
    if (treat.on) {
      hot = true;
      if (treat.state === 'fly') {
        const e = (now - treat.t0) / 700;
        const x1 = L.catX + TREAT_AT[0] * s, y1 = L.topY + TREAT_AT[1] * s;
        if (e >= 1) { treat.state = 'rest'; placeTreat(); play('pluck', 7, { gain: 0.06 }); }
        else {
          treat.x = lerp(treat.x0, x1, e);
          treat.y = lerp(treat.y0, y1, e) - Math.sin(Math.PI * e) * 150 * s;
          treat.a = e * 9;
        }
      }
      if (treat.state === 'rest' && (!C.act || PRI[C.act.kind] < 3)) start('eat');
    }
    if (now - jarT < 500) hot = true;

    // out of the window
    if (stepWindowLife(now)) hot = true;

    // the laser, fluff in the air, books, hats, catnip, paintings
    if (stepLaser(now)) hot = true;
    if (stepTufts(dt, now)) hot = true;
    if (stepBooks(dt, now)) hot = true;
    if (stepHat(dt, now)) hot = true;
    if (stepNip(now)) hot = true;
    if (stepArt(now)) hot = true;
    if (brush.on) {
      if (now > brush.until && !(C.act && C.act.kind === 'brush')) brushOff();
      else if (now - brush.lastT < 1500) hot = true;
    }
    // he licks the ink off his paw, more or less
    if (C.ink > 0 && !(C.act && C.act.kind === 'paint')) { C.ink = Math.max(0, C.ink - dt * 0.35); hot = true; }
    if (chat.you && now - chat.you.t0 > 2400) chat.you = null;
    if (chat.you) hot = true;
    if (life(fx.calls, 1600, now)) hot = true;
    if (now - C.puffAt < 2500 || (C.stare && now < C.stare.until)) hot = true;

    // too much petting (it wears off by the clock, so also while nothing's running)
    const petting = now < C.petUntil;
    const sdt = clamp((now - C.stimAt) / 1000, 0, 60);
    C.stimAt = now;
    if (petting) C.stim += dt * (C.petZone === 'head' ? 0.5 : C.petZone === 'chin' ? 0.28 : 0.4);
    else C.stim = Math.max(0, C.stim - sdt * 0.28);
    if (C.stim >= C.stimMax && (!C.act || PRI[C.act.kind] < 4)) {
      C.stimMax = 3.8 + Math.random() * 1.2;
      start('warn');
    }

    // left alone for a while: little things, then a nap
    if (!RM && !C.act && now > C.idleAt && now - C.lastUser > 3500 && !A.grab && !A.carry && !pom.held && !treat.on) {
      if (now - C.lastUser > 42000) start('sleep');
      else {
        const r = Math.random();
        // a hat that's been on a while, or a book that's just asking to be pushed off the sill
        if (hat.i && now - hat.t0 > 20000 && r < 0.3) start('shake');
        else if (r < 0.22) start('groom');
        else if (r < 0.34) start('yawn');
        else if (r < 0.6) { if (spawnWindow(now)) start('window', { dur: 1e9 }); }
        else if (r < 0.72) start('love');
        else if (r < 0.8) start('tilt', { dir: Math.random() < 0.5 ? -1 : 1 });
        else if (r < 0.9 && A.alpha > 0.5 && A.sleeping) start('glare');
        else if (r < 0.97 && L.books.sill && !books.fallen && books.open < 0 && !books.fly && books.stack.length > 2) start('nudge');
        else C.swishUntil = now + 2600;
      }
      C.idleAt = now + 6500 + Math.random() * 6500;
    }

    pose(dt, now);

    // effects
    if (petting && !RM && now - pet.spawnT > 320) {
      pet.spawnT = now;
      let px = -100 + Math.random() * 140, py = -112 - Math.random() * 10;
      if (C.petZone === 'chin' || C.petZone === 'head') { headMatrix(P); const q = headToCat(C.petZone === 'chin' ? 30 + Math.random() * 20 : -10 + Math.random() * 30, C.petZone === 'chin' ? 40 : -66); px = q.x; py = q.y; }
      fx.purrs.push({ t0: now, x: px, y: py, seed: Math.random() * 100 });
    } else if (petting && RM && fx.purrs.length < 3) fx.purrs.push({ t0: now, x: -90 + fx.purrs.length * 55, y: -120 - (fx.purrs.length % 2) * 14, seed: fx.purrs.length * 7 });
    if (life(fx.purrs, 1500, now)) hot = true;
    if (life(fx.words, 1300, now)) hot = true;
    if (life(fx.seals, 1600, now)) hot = true;
    if (life(fx.rings, 500, now)) hot = true;
    if (life(fx.strokes, 2300, now)) hot = true;
    if (life(fx.zs, 2600, now)) hot = true;
    if (life(fx.scratches, 1800, now)) hot = true;
    // (with reduced motion, a nap or lying on a book is a still picture: nothing to run for)
    const resting = RM && C.act && (C.act.kind === 'sleep' || (C.act.kind === 'bookrest' && !books.fly && books.k >= 1));
    if ((C.act && !resting) || C.happy > 0.01 || petting || now - A.worriedAt < 1800 || A.face !== 'smug' || A.grab) hot = true;
    if (now - C.meowAt < 700 || now - C.mrrpAt < 400 || now < C.grumpyUntil) hot = true;
    if (C.stim > 0.01) {
      if (!RM) hot = true;
      // with reduced motion nothing runs just for that: one more frame once it's worn off
      else if (!petting && !C.stimKick && C.stim > C.stimMax * 0.6) C.stimKick = later(() => { C.stimKick = 0; kick(); }, ((C.stim - C.stimMax * 0.6) / 0.28) * 1000 + 50);
    }
    return hot;
  }

  // his content face, k from 0 to 1: eyes closed in soft ^ ^ arcs, a little closed
  // smile, whiskers and ears relaxed, looking your way
  function contentFace(k) {
    if (k <= 0) return;
    T.joy = Math.max(T.joy, k);
    T.grin = lerp(T.grin, 0.6, k); T.brow = lerp(T.brow, 0, k); T.happy *= 1 - k;
    T.whisk = lerp(T.whisk, -0.15, k);
    T.earSL += 0.14 * k; T.earSR += 0.14 * k;
    T.yaw = lerp(T.yaw, 0.12, k); T.gx *= 1 - k; T.gy *= 1 - k;
    T.jaw *= 1 - k; T.fangs *= 1 - k;
  }

  // settle the pose: rest, where he's looking, his moods, what he's doing, then ease toward it
  function pose(dt, now) {
    const { s } = L;
    for (let i = 0; i < KEYS.length; i++) T[KEYS[i]] = REST[KEYS[i]];
    Object.assign(rate, RATE);
    const a = C.act, e = a ? now - a.t0 : 0;
    // where to look
    LK.mode = 0; LK.pupil = 0.28; LK.flat = false;
    const toyHot = pom.held || pom.pinned || pom.speed > 160 * s;
    if (toyHot) { LK.mode = 1; LK.x = pom.x; LK.y = pom.y; LK.pupil = 0.95; }
    else if (treat.on && treat.state === 'fly') { LK.mode = 1; LK.x = treat.x; LK.y = treat.y; LK.pupil = 0.75; }
    else if (A.alpha > 0.4 && (A.grab || A.place || A.carry || now - A.lastMove < 1400)) { LK.mode = 1; LK.x = A.x; LK.y = A.y - 10 * s; LK.pupil = A.fast ? 0.92 : 0.62; }
    else if (!RM && now - pointer.t < 2600) { LK.mode = 1; LK.x = pointer.x; LK.y = pointer.y; LK.pupil = 0.45; }
    else {
      // idle: mostly out of the window, sometimes at you, now and then a glare at the avocado
      const mode = RM ? 1 : [0, 1, 0, 2, 1, 0][Math.floor(now / 5200) % 6];
      if (mode === 0) { LK.mode = 1; LK.x = L.catX + 380 * s + Math.sin(now / 4100) * 60 * s; LK.y = L.topY - 150 * s + Math.sin(now / 2900) * 30 * s; }
      else if (mode === 1) LK.mode = 2;
      else { LK.mode = 1; LK.x = A.x; LK.y = A.y; }
    }
    if (now < C.faceUntil || C.happy > 0.25) LK.mode = 2;
    // the laser's gone, but he's still staring at where it was
    if (C.stare && now < C.stare.until) { LK.mode = 1; LK.x = C.stare.x; LK.y = C.stare.y; LK.pupil = 0.85; }
    if (a) actLook(a, e, now);
    headMatrix(P);
    const hx = L.catX + HM[4] * s, hy = L.topY + HM[5] * s;
    if (LK.mode === 2) { T.yaw = 0.04; T.pitch = 0.02; T.gx = 0; T.gy = 0; }
    else if (LK.mode === 1) {
      const yawD = Math.atan2(LK.x - hx, 240 * s), pitchD = Math.atan2(LK.y - hy, 260 * s);
      T.yaw = clamp(0.1 + yawD * 0.85, -0.85, 0.95);
      // a glare keeps his chin up, so you still see the look on his face
      T.pitch = clamp(pitchD * 0.75, -0.48, LK.flat ? 0.3 : 0.6);
      T.gx = clamp((0.1 + yawD - P.yaw) * 1.7, -1, 1);
      T.gy = clamp((pitchD - P.pitch) * 1.7, -1, 1);
    }
    T.pupil = LK.pupil;
    T.roll = P.yaw * 0.05 - P.pitch * 0.04 + (RM ? 0 : Math.sin(now / 3700) * 0.03);
    // tail
    // always a little hook at the end, never hanging dead straight
    C.curlPh += dt * 0.55;
    T.tCurl = RM ? 0.8 : 0.82 + 0.2 * Math.sin(C.curlPh);
    const agitT = A.grab || A.place || A.carry || now - A.lastMove < 900 ? 1 : 0;
    C.agit = RM ? 0 : C.agit + (agitT - C.agit) * (1 - Math.exp(-dt * (agitT ? 4 : 0.8)));
    let tAmp = 0.12 + 0.3 * C.agit, tSpd = 1.05 + 2.6 * C.agit;
    if (now < C.swishUntil) { tAmp += 0.3; tSpd += 1.5; }

    // moods
    const petting = now < C.petUntil && now >= C.grumpyUntil;
    C.happy = RM ? (petting ? 1 : 0) : C.happy + ((petting ? 1 : 0) - C.happy) * (1 - Math.exp(-dt * (petting ? 6 : 2.2)));
    // being petted: eyes shut into happy little arcs, a closed smile, ears
    // relaxed and eased back a touch, and his head leaning into the hand
    if (C.happy > 0.01) {
      const hh = C.happy, z = C.petZone;
      contentFace(hh);
      if (z === 'chin') { T.pitch = lerp(T.pitch, -0.24, hh); T.roll += 0.16 * hh; T.hx += 4 * hh; }
      else if (z === 'head') { T.pitch = lerp(T.pitch, 0.12, hh); T.earFL += 0.3 * hh; T.earFR += 0.3 * hh; T.hy += 2 * hh; T.roll -= 0.05 * hh; }
      else { T.pitch = lerp(T.pitch, 0.04, hh); T.roll += 0.1 * hh; }
      T.tCurl += 0.4 * hh; tAmp -= 0.06 * hh;
    }
    const sig = smooth(C.stimMax * 0.6, C.stimMax, C.stim);
    const grumpy = now < C.grumpyUntil ? clamp((C.grumpyUntil - now) / 1200) : 0;
    const cross = Math.max(sig, grumpy);
    if (cross > 0) {
      // airplane ears and a pout: cross, but more grumpy than glaring
      T.earSL += 0.7 * cross; T.earSR += 0.7 * cross; T.lidU = lerp(T.lidU, 0.16, cross); T.happy *= 1 - cross; T.joy *= 1 - cross;
      T.brow = Math.max(T.brow, 0.4 * cross); T.whisk = lerp(T.whisk, -0.5, cross); T.grin = lerp(T.grin, -0.6, cross); T.hx -= 3 * grumpy;
      tAmp += 0.45 * cross; tSpd += 5 * cross;
    }
    // that avocado is far too close
    const near = A.alpha > 0.5 && !A.under && !A.sink && Math.hypot(A.x - hx, A.y - hy) < 200 * s;
    const dT = near || (a && a.kind === 'bury') ? 1 : a && a.kind === 'glare' ? 0.75 : 0;
    C.disgust = RM ? dT : C.disgust + (dT - C.disgust) * (1 - Math.exp(-dt * (dT ? 5 : 2)));
    const dg = C.disgust;
    if (dg > 0.01) {
      T.hx -= 6 * dg; T.pitch -= 0.06 * dg; T.lidU = lerp(T.lidU, 0.48, dg); T.lidL = lerp(T.lidL, 0.45, dg); T.brow = lerp(T.brow, 0.9, dg);
      T.earSL += 0.45 * dg; T.earSR += 0.45 * dg; T.earFL += 0.15 * dg; T.earFR += 0.15 * dg;
      T.whisk = lerp(T.whisk, -0.7, dg); T.grin = lerp(T.grin, -0.9, dg); T.happy *= 1 - dg; T.joy *= 1 - dg; T.wrinkle = dg;
      if (!RM && dg > 0.6 && now > C.blepAt) { C.blepUntil = now + 750; C.blepAt = now + 2600 + Math.random() * 2400; }
      if (now < C.blepUntil) T.tongue = 1;
    }
    // something worth hunting
    const al = toyHot || (a && a.kind === 'window') ? 1 : 0;
    if (al) { T.whisk = 0.8; T.lidU = Math.min(T.lidU, 0.05); T.earSL = T.earSR = 0; if (!RM) T.tFlick = Math.sin(now / 60) * 0.18; }
    // sleepy when nobody's around
    const drowsy = RM || (a && a.kind !== 'sleep' && a.kind !== 'love') ? 0 : smooth(26000, 40000, now - C.lastUser);
    T.lidU = Math.max(T.lidU, 0.6 * drowsy);
    // fur up after a brush the wrong way, the tail gone bottle-brush and lashing
    const pe = now - C.puffAt;
    T.puff = pe < 2400 ? 1 - smooth(1400, 2400, pe) : 0;
    if (T.puff > 0) { tAmp += 0.35 * T.puff; tSpd += 3 * T.puff; }

    T.tAmp = tAmp;
    if (a) actPose(a, e, now);
    // the flick back at whatever bumped his tail
    const fe = now - C.flickAt;
    if (!RM && fe > 0 && fe < 420) { T.tFlick += C.flickDir * 0.85 * hump(fe / 420); rate.tFlick = 30; }
    if (C.act && C.act.kind === 'sleep') tSpd = 0.3;

    // little sounds with an open mouth
    const mk = (now - C.meowAt) / 600;
    if (mk < 1) { T.jaw = Math.max(T.jaw, 0.55 * hump(mk)); T.fangs = Math.max(T.fangs, 0.3 * hump(mk)); rate.jaw = 25; }
    const rk = (now - C.mrrpAt) / 320;
    if (rk < 1) { T.jaw = Math.max(T.jaw, 0.26 * hump(rk)); rate.jaw = 25; }
    // blinks: quick ones, and slow ones (a cat's "I love you")
    if (!RM) {
      const intent = a && PRI[a.kind] >= 3 && a.kind !== 'eat';
      if (intent) { C.blink = null; C.blinkAt = Math.max(C.blinkAt, now + 600); }
      if (!C.blink && now > C.blinkAt) C.blink = { t0: now, slow: Math.random() < 0.4 };
      if (C.blink) {
        const d = C.blink.slow ? [300, 420, 380] : [80, 50, 110];
        const be = now - C.blink.t0;
        const lid = be < d[0] ? easeInOut(be / d[0]) : be < d[0] + d[1] ? 1 : 1 - easeInOut((be - d[0] - d[1]) / d[2]);
        T.lidU = Math.max(T.lidU, lid); rate.lidU = 40;
        // a slow one closes into the same soft arcs as a happy face
        if (C.blink.slow) { T.joy = Math.max(T.joy, lid); rate.joy = 40; }
        if (be > d[0] + d[1] + d[2]) { C.blink = null; C.blinkAt = now + 2200 + Math.random() * 4200; }
      }
      // ear twitches
      if (!C.tw && now > C.twAt) C.tw = { t0: now, ear: Math.random() < 0.5 ? 'L' : 'R', n: Math.random() < 0.35 ? 2 : 1 };
      if (C.tw) {
        const te = (now - C.tw.t0) / 170;
        const v = te < C.tw.n ? Math.sin(Math.PI * (te % 1)) * 0.38 : 0;
        if (C.tw.ear === 'L') T.earTL = -v; else T.earTR = v;
        rate.earTL = rate.earTR = 40;
        if (te >= C.tw.n) { C.tw = null; C.twAt = now + 2600 + Math.random() * 5200; }
      }
    }
    T.earFL = clamp(T.earFL); T.earFR = clamp(T.earFR); T.earSL = clamp(T.earSL); T.earSR = clamp(T.earSR);
    // ease toward it all
    for (let i = 0; i < KEYS.length; i++) {
      const k = KEYS[i];
      const r = k === 'pupil' ? (T.pupil > P.pupil ? 6 : 1.4) : rate[k];
      const v = RM ? T[k] : P[k] + (T[k] - P[k]) * (1 - Math.exp(-dt * r));
      // one bad number must never stick
      P[k] = Number.isFinite(v) ? v : Number.isFinite(T[k]) ? T[k] : REST[k];
    }
    if (!RM) P.tPh += dt * tSpd;
    P.tBend = C.tb; P.tBendU = C.tbu; P.ink = C.ink;
    const sleeping = C.act && C.act.kind === 'sleep';
    C.bph += dt * TAU / (sleeping ? 4.4 : C.happy > 0.5 ? 2.6 : 3.4);
    P.breath = RM ? 0 : (Math.sin(C.bph) * 0.5 + 0.5) * (sleeping ? 1.5 : 1);
  }

  // a bird or a leaf, outside the window
  function spawnWindow(now) {
    const G = L.glass, { s } = L;
    const hx = L.catX + HEAD_REST[0] * s;
    const left = G.x0 + 26 * s, right = G.x1 - 26 * s;
    const roomL = hx - 80 * s - left, roomR = right - hx - 80 * s;
    if (Math.max(roomL, roomR) < 30 * s) return false;
    const px = roomR >= roomL ? lerp(hx + 80 * s, right, 0.3 + Math.random() * 0.6) : lerp(left, hx - 80 * s, 0.1 + Math.random() * 0.6);
    win.kind = Math.random() < 0.62 ? 'bird' : 'leaf';
    win.t0 = now;
    win.px = px; win.py = G.y1 - 9 * s;
    const fromRight = px > hx;
    win.fx = px + (fromRight ? 150 : -150) * s; win.fy = G.y0 - 30 * s;
    win.flip = fromRight ? -1 : 1;
    win.dur = win.kind === 'bird' ? 5200 : 4400;
    win.perched = false;
    win.x = win.fx; win.y = win.fy;
    return true;
  }
  function stepWindowLife(now) {
    if (!win.kind) return false;
    const e = now - win.t0, { s } = L;
    if (e > win.dur) { win.kind = ''; win.perched = false; return false; }
    if (win.kind === 'bird') {
      if (e < 900) {
        const k = easeOut(e / 900);
        win.x = lerp(win.fx, win.px, k); win.y = lerp(win.fy, win.py, k) - Math.sin(k * Math.PI) * 20 * s; win.perched = false;
      } else if (e < 4000) {
        const hop = e > 2000 && e < 2300 ? (e - 2000) / 300 : e >= 2300 ? 1 : 0;
        win.x = win.px - hop * 9 * s * win.flip; win.y = win.py - Math.sin(Math.PI * clamp(hop)) * 6 * s * (hop < 1 ? 1 : 0);
        win.perched = true;
      } else {
        const k = easeIn((e - 4000) / 1200);
        win.x = win.px - 9 * s * win.flip - k * 220 * s * win.flip; win.y = win.py - k * 170 * s; win.perched = false;
      }
    } else {
      const k = e / win.dur;
      win.x = win.px + Math.sin(k * 7) * 24 * s - (k - 0.5) * 50 * s;
      win.y = lerp(L.glass.y0 - 10 * s, L.glass.y1 + 6 * s, k);
    }
    return true;
  }

  // drawing
  let nowDraw = 0;
  const toStage = (g) => { g.save(); g.scale(1 / L.s, 1 / L.s); g.translate(-L.catX, -L.topY); };
  const HOOKS = {
    lip: () => blit(fg, SP.lip),
    // things lying on the cushion in front of him: under his chest and paws, over the plush
    under: () => {
      drawScratches(fg, nowDraw);
      drawPile(fg);
      drawSheet(fg, nowDraw);
      drawBookOpen(fg);
      if (nip.sprig) drawSprig(fg, nowDraw, true);
    },
    front: () => {
      if (A.under) { toStage(fg); drawAvocado(fg, nowDraw); fg.restore(); }
      if (treat.on && treat.state === 'rest') { toStage(fg); drawTreat(fg); fg.restore(); }
    },
    head: (g, ox, oy) => drawHatOn(g, ox, oy),
  };

  function draw(now) {
    if (!L || !SP || !CS) return;
    nowDraw = now;
    const g = fg;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, fgC.width, fgC.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { s } = L;
    drawWindowLife(g, now);
    // on the wall, on the sill (or the middle platform), all behind him
    drawWallArt(g);
    g.save(); g.translate(L.catX, L.topY); g.scale(s, s);
    drawStack(g);
    drawDish(g, now);
    g.restore();
    drawAvoShadow(g);
    drawJar(g, now);
    // the string always goes behind him (held up in front of his face, it would
    // cut across it), the pompom in front unless it's under his paws
    drawString(g);
    if (pom.pinned) drawPom(g);
    g.save();
    g.translate(L.catX, L.topY);
    g.scale(s, s);
    drawCat(g, CS, P, HOOKS);
    drawStrokes(g, now);
    drawPurrs(g, now);
    drawZs(g, now);
    drawWords(g, now);
    g.restore();
    if (!pom.pinned) drawPom(g);
    drawRings(g, now);
    if (!A.under) drawAvocado(g, now);
    // the paw lands on top of the avocado
    if (C.act && C.act.pawOver && P.nUp > 0.15) {
      g.save(); g.translate(L.catX, L.topY); g.scale(s, s);
      nearLeg(g, CS, P);
      g.restore();
    }
    if (treat.on && treat.state === 'fly') drawTreat(g);
    drawSeals(g, now);
    // things in the air: fluff, the brush, a book, a hat, the catnip, a painting
    g.save(); g.translate(L.catX, L.topY); g.scale(s, s);
    drawTufts(g, now);
    drawBookFly(g, now);
    drawHatOff(g, now);
    if (nip.sprig) drawSprig(g, now, false);
    g.restore();
    drawBrush(g, now);
    drawArtFly(g, now);
    // the laser dot lands on whatever's there, so it's on top of everything
    drawLaser(g, now);
    drawYou(g, now);
    // the grab handles follow the avocado, the pompom and the dot
    handle(grabEl, HA, A.x, A.y - 14 * s, A.alpha > 0.5 && !A.carry && !laser.on);
    handle(toyEl, HT, pom.x, pom.y, !pom.pinned && !laser.on);
    handle(dotEl, HD, laser.x, laser.y, laser.on);
    lastDraw = now;
  }

  // the new things' drawing
  function drawPile(g) {
    if (pile.n < 1) return;
    // a little dust bunny of his fur on the cushion, a few wisps heaped together
    const r = Math.min(15, 4 + 1.8 * Math.sqrt(pile.n)), [px, py] = PILE;
    dab(g, px, py + 2, r * 1.4, SHADOW, 0.12, 0.3);
    const n = Math.min(9, 2 + Math.floor(pile.n / 2));
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, rr = r * 0.55 * (((i * 7) % 5) / 5);
      wisp(g, px + Math.cos(a) * rr, py - r * 0.3 + Math.sin(a) * rr * 0.4, r * 0.55, i * 3.1, 1);
    }
  }
  // a tuft of his fur: a hazy grey wisp with a tangle of fine curly hairs, the
  // tips catching the light so it still shows when it drifts over him
  function wisp(g, x, y, r, seed, a) {
    dab(g, x, y, r * 1.3, [96, 102, 120], 0.26 * a, 0.15);
    dab(g, x, y, r * 0.7, [46, 50, 62], 0.32 * a, 0.25);
    g.lineCap = 'round';
    // fine hairs, every which way, a little wavy
    for (let i = 0; i < 14; i++) {
      const an = i * 2.39996 + seed, L2 = r * (0.9 + ((i * 7 + seed) % 5) * 0.18), w = (((i * 3 + seed) % 3) - 1) * r * 0.35;
      const ca = Math.cos(an), sa = Math.sin(an), x0 = x - ca * L2 * 0.5, y0 = y - sa * L2 * 0.5;
      g.strokeStyle = i % 4 ? rgba([36, 40, 50], 0.7 * a) : rgba([182, 194, 218], 0.6 * a);
      g.lineWidth = 0.4;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x - sa * w, y + ca * w, x0 + ca * L2, y0 + sa * L2); g.stroke();
    }
  }
  function drawTufts(g, now) {
    for (const f of tufts) {
      const e = now - f.t0, a = clamp(clamp(e / 150) * (e > 3800 ? 1 - (e - 3800) / 400 : 1));
      g.save();
      g.translate(f.x, f.y); g.rotate(f.rot);
      wisp(g, 0, 0, 5.5, f.seed, a);
      g.restore();
    }
  }
  function drawBrush(g, now) {
    const auto = C.act && C.act.kind === 'brush';
    if (!SP.brush || !(auto || (brush.on && now - brush.lastT < 1500))) return;
    const a = auto ? 1 : clamp(1 - (now - brush.lastT - 1000) / 500);
    g.save();
    g.globalAlpha = a;
    g.translate(brush.x, brush.y);
    g.rotate(brush.a);
    blit2(g, SP.brush, 0, 0, L.s * 1.3);
    g.restore();
  }
  function drawLaser(g, now) {
    if (!laser.on) return;
    const { s } = L, fl = RM ? 1 : 0.86 + 0.14 * Math.sin(now / 37) * Math.sin(now / 53);
    dab(g, laser.x, laser.y, 15 * s, [255, 50, 40], 0.2 * fl, 0.2);
    dab(g, laser.x, laser.y, 6 * s, [255, 30, 30], 0.8, 0.5);
    dab(g, laser.x, laser.y, 2.6 * s, [255, 214, 204], 0.95, 0.6);
  }
  // the ink dish on the sill while he paints (cat units)
  function drawDish(g, now) {
    const a = C.act && C.act.kind === 'paint' ? clamp((now - C.act.t0) / 300) : art.cur ? 1 : 0;
    if (a <= 0 || !SP.dish) return;
    g.globalAlpha = a;
    blit(g, SP.dish, cx(L.dish.x), cy(L.dish.y));
    g.globalAlpha = 1;
  }
  // the sheet of hanji on the cushion (cat units), sliding in at the start
  function drawSheet(g, now) {
    const cur = art.cur;
    if (!cur) return;
    const k = RM ? 1 : easeOut(clamp((now - cur.t0) / 500));
    g.save();
    g.globalAlpha = k;
    g.translate(0, (1 - k) * 12);
    g.transform(PAPER.ux, PAPER.uy, PAPER.vx, PAPER.vy, PAPER.ox, PAPER.oy);
    dab(g, ART_W / 2 + 2, ART_H / 2 + 6, ART_W * 0.6, SHADOW, 0.22, 0.4);
    g.drawImage(cur.c, 0, 0, ART_W, ART_H);
    g.strokeStyle = 'rgba(140,118,90,.55)'; g.lineWidth = 1;
    g.strokeRect(0, 0, ART_W, ART_H);
    g.restore();
  }
  // the latest masterpiece, taped up on the wall
  function drawWallArt(g) {
    const w = L.wall;
    if (!w || !art.wall) return;
    drawFramed(g, art.wall.c, w.x, w.y, w.w, w.h, -0.035, 1);
  }
  function drawFramed(g, c, x, y, w, h, rot, a) {
    const { s } = L, fw = Math.min(160, L.W * 0.13);
    g.save();
    g.globalAlpha = a * clamp(Math.min(x, L.W - x) / fw, 0.45, 1);
    g.translate(x, y); g.rotate(rot);
    dab(g, 2 * s, 5 * s, Math.max(w, h) * 0.62, SHADOW, 0.16, 0.3);
    g.drawImage(c, -w / 2, -h / 2, w, h);
    g.strokeStyle = 'rgba(150,130,100,.35)'; g.lineWidth = 0.6;
    g.strokeRect(-w / 2, -h / 2, w, h);
    // two bits of tape
    g.fillStyle = 'rgba(232,220,190,.78)';
    for (const sx of [-1, 1]) { g.save(); g.translate(sx * (w / 2 - 4 * s), -h / 2); g.rotate(sx * 0.6); g.fillRect(-7 * s, -2.6 * s, 14 * s, 5.2 * s); g.restore(); }
    g.restore();
  }
  // a finished painting: it stands up off the cushion so you can see it properly,
  // then goes up onto the wall (or, with no wall for it, fades; it still counts)
  const ART_SHOW = 550, ART_HOLD = 1650, ART_WALL = 2650, ART_FADE = 2350;
  function artMats() {
    const { s } = L, sw = (L.narrow ? 74 : 84) * s, sh = sw * (ART_H / ART_W);
    const sx = clamp(L.catX + 20 * s, sw / 2 + 8, L.W - sw / 2 - 8), sy = L.topY - 26 * s;
    const lying = [PAPER.ux * s, PAPER.uy * s, PAPER.vx * s, PAPER.vy * s, L.catX + PAPER.ox * s, L.topY + PAPER.oy * s];
    const shown = [sw / ART_W, 0, 0, sh / ART_H, sx - sw / 2, sy - sh / 2];
    const w = L.wall;
    const hung = w ? [w.w / ART_W, 0, 0, w.h / ART_H, w.x - w.w / 2, w.y - w.h / 2] : shown;
    return [lying, shown, hung];
  }
  function drawArtFly(g, now) {
    const f = art.fly;
    if (!f) return;
    const { s } = L, e = now - f.t0, [M0, M1, M2] = artMats();
    let M, a = 1;
    if (f.quiet) { M = M0; a = 1 - clamp(e / 700); }
    else if (RM) M = e < ART_HOLD ? M1 : M2;
    else if (e < ART_SHOW) { const k = easeInOut(e / ART_SHOW); M = M0.map((v, i) => lerp(v, M1[i], k)); M[5] -= Math.sin(Math.PI * k) * 24 * s; }
    else if (e < ART_HOLD) { M = M1.slice(); M[5] += Math.sin((e - ART_SHOW) / 260) * 1.5 * s; }
    else if (f.wall && L.wall) { const k = easeInOut(clamp((e - ART_HOLD) / (ART_WALL - ART_HOLD))); M = M1.map((v, i) => lerp(v, M2[i], k)); M[5] -= Math.sin(Math.PI * k) * 50 * s; }
    else { const k = clamp((e - ART_HOLD) / (ART_FADE - ART_HOLD)); M = M1.slice(); M[5] -= 20 * s * easeOut(k); a = 1 - easeIn(k); }
    g.save();
    g.globalAlpha = clamp(a);
    g.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    if (!f.quiet && e > ART_SHOW * 0.6) dab(g, ART_W / 2 + 3, ART_H / 2 + 5, ART_W * 0.6, SHADOW, 0.18, 0.3);
    g.drawImage(f.c, 0, 0, ART_W, ART_H);
    g.strokeStyle = 'rgba(150,130,100,.4)'; g.lineWidth = 0.4;
    g.strokeRect(0, 0, ART_W, ART_H);
    g.restore();
  }
  // the stack of books, and one that's been pushed off onto the floor (cat units)
  function drawStack(g) {
    const list = books.stack;
    for (let j = 0; j < list.length; j++) {
      const i = list[j], p = stackPos(j), b = BOOKS[i];
      g.save();
      g.translate(p.x + (j === list.length - 1 ? books.push || 0 : 0), p.y);
      g.rotate(Math.sin(i * 1.7) * 0.015);
      if (j === 0) dab(g, 0, 1, b.w * 0.6, SHADOW, 0.14, 0.3);
      drawBookSpine(g, b, b.w, b.h);
      g.restore();
    }
    const fb = books.fallen;
    if (fb) {
      const b = BOOKS[fb.i];
      g.save();
      g.translate(fb.x, fb.y); g.rotate(fb.rot);
      if (fb.landed) dab(g, 0, 1, b.w * 0.6, SHADOW, 0.16, 0.3);
      drawBookSpine(g, b, b.w, b.h);
      g.restore();
    }
  }
  // the open book lying in front of him (cat units), drawn from a picture of its pages
  const BOOK_MAP = [0.74, -0.02, -0.07, 0.28];
  function bookPages(i) {
    const key = `${i}|${L.s.toFixed(3)}|${dpr}`;
    let c = books.cache.get(key);
    if (c) return c;
    if (books.cache.size > 10) books.cache.clear();
    const k = 1.6 * L.s * dpr;
    c = document.createElement('canvas');
    c.width = Math.ceil(96 * k); c.height = Math.ceil(66 * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 48 * k, 33 * k);
    drawOpenBook(g, BOOKS[i], 1, i, rng(300 + i));
    books.cache.set(key, c);
    return c;
  }
  function drawBookOpen(g) {
    const i = books.open;
    if (i < 0 || books.fly) return;
    g.save();
    g.transform(BOOK_MAP[0], BOOK_MAP[1], BOOK_MAP[2], BOOK_MAP[3], BOOK_AT[0], BOOK_AT[1]);
    dab(g, 2, 6, 60, SHADOW, 0.16, 0.3);
    if (books.k >= 1) g.drawImage(bookPages(i), -48, -33, 96, 66);
    else drawOpenBook(g, BOOKS[i], books.k, i, rng(300 + i));
    g.restore();
  }
  // a book on its way over to him, or back to the pile (cat units)
  function drawBookFly(g, now) {
    const f = books.fly;
    if (!f) return;
    const b = BOOKS[f.i], e = RM ? 1 : clamp((now - f.t0) / (f.back ? 650 : 620));
    const k = easeInOut(e);
    let x0, y0, r0, x1, y1;
    const to = { x: BOOK_AT[0], y: BOOK_AT[1] + 4 };
    if (!f.back) { x0 = f.from.x; y0 = f.from.y; r0 = f.from.rot; x1 = to.x; y1 = to.y; }
    else {
      // back onto the top of the pile
      const n = books.stack.length;
      let tx = cx(L.books.x), ty = cy(L.books.y);
      if (n) { const p = stackPos(n - 1); tx = p.x; ty = p.y - BOOKS[books.stack[n - 1]].h; }
      x0 = to.x; y0 = to.y; r0 = 0; x1 = tx; y1 = ty - b.h / 2;
    }
    const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(Math.PI * k) * 46;
    // it turns over in the air: spine first, cover down by the time it lands (and the other way back)
    const flat = f.back ? 1 - smooth(0, 0.35, e) : smooth(0.65, 1, e);
    g.save();
    g.translate(x, y);
    if (flat < 1) {
      g.save(); g.globalAlpha = 1 - flat; g.rotate(lerp(r0, 0, k) + Math.sin(Math.PI * k) * 0.5 * (f.back ? -1 : 1)); g.translate(0, b.h / 2); drawBookSpine(g, b, b.w, b.h); g.restore();
    }
    if (flat > 0) {
      g.globalAlpha = flat;
      g.transform(BOOK_MAP[0], BOOK_MAP[1], BOOK_MAP[2], BOOK_MAP[3], 0, 0);
      drawOpenBook(g, b, 0, f.i, rng(300 + f.i));
    }
    g.restore();
  }
  function drawSprig(g, now, resting) {
    const sp = nip.sprig;
    const flying = !RM && now - sp.t0 < 700;
    if (flying === resting || !SP.sprig) return;
    const p = sprigPos(now), fade = sp.fade ? clamp(1 - (now - sp.fade) / 1200) : 1;
    g.save();
    g.globalAlpha = fade * (1 - 0.5 * sp.crushed);
    g.translate(p.x, p.y);
    g.rotate(flying ? (now - sp.t0) / 90 : -0.2 + 0.3 * sp.crushed);
    g.scale(1, 1 - 0.35 * sp.crushed);
    blit(g, SP.sprig);
    g.restore();
  }
  // his hat (head units, drawn by drawHead on top of his head)
  function drawHatOn(g, ox, oy) {
    if (!hat.i || !SP.blossom) return;
    const k = RM ? 1 : easeOut(clamp((nowDraw - hat.t0) / 380));
    faceProj(0, 1.08, FACE_R, P.yaw, P.pitch);
    const sq = clamp(0.34 + 0.55 * P.pitch, 0.12, 0.6);
    g.save();
    g.translate(FP.x + ox, FP.y + oy - (1 - k) * 34);
    g.globalAlpha = k;
    drawHat(g, SP, hat.i, sq, P.yaw);
    g.restore();
  }
  function drawHatOff(g, now) {
    const h = hat.off;
    if (!h || !SP.blossom) return;
    g.save();
    g.globalAlpha = clamp(1 - (now - h.t0 - 900) / 600);
    g.translate(h.x, h.y); g.rotate(h.rot); g.scale(HS, HS);
    drawHat(g, SP, h.i, 0.4, 0);
    g.restore();
  }
  // you, slow-blinking at him, and you, calling him (bottom of the room)
  function drawYou(g, now) {
    const { s } = L, p = youAt(), px = p.x, py = p.y;
    if (chat.you) {
      const e = now - chat.you.t0;
      const shut = RM ? (e < 1200 ? 1 : 0) : e < 300 ? 0 : e < 900 ? easeInOut((e - 300) / 600) : e < 1300 ? 1 : 1 - easeInOut((e - 1300) / 700);
      const a = clamp(e / 200) * clamp((2400 - e) / 400);
      g.save();
      g.globalAlpha = a * 0.85;
      g.strokeStyle = 'rgb(40,30,26)'; g.fillStyle = 'rgb(40,30,26)'; g.lineCap = 'round';
      g.lineWidth = 1.5 * s;
      for (const sx of [-1, 1]) {
        const ex = px + sx * 11 * s, w = 7 * s, top = lerp(-4.2, 0.8, shut) * s, bot = lerp(3.6, 0.8, shut) * s;
        g.beginPath(); g.moveTo(ex - w, py); g.quadraticCurveTo(ex, py + top * 1.6 - (shut > 0.9 ? 3 * s : 0), ex + w, py); g.stroke();
        if (shut < 0.9) {
          g.beginPath(); g.moveTo(ex - w, py); g.quadraticCurveTo(ex, py + bot * 1.4, ex + w, py); g.stroke();
          g.globalAlpha = a * 0.85 * (1 - shut);
          g.beginPath(); g.arc(ex, py + 0.3 * s, 2.1 * s * (1 - shut * 0.6), 0, TAU); g.fill();
          g.globalAlpha = a * 0.85;
        }
      }
      g.restore();
    }
    for (const m of fx.calls) {
      const e = (now - m.t0) / 1600;
      g.save();
      g.globalAlpha = clamp(e < 0.15 ? e / 0.15 : 1 - (e - 0.6) / 0.4) * 0.9;
      g.translate(px + 26 * s, py - 14 * s - (RM ? 0 : e * 16 * s));
      g.rotate(-0.08);
      g.font = `${Math.round(24 * s)}px "Nanum Pen Script", "Gowun Batang", cursive`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(22,17,15,.92)';
      g.fillText(m.text, 0, 0);
      g.restore();
    }
  }

  const HA = { x: -1e9, y: -1e9, on: null }, HT = { x: -1e9, y: -1e9, on: null }, HD = { x: -1e9, y: -1e9, on: null };
  function handle(el, h, x, y, on) {
    if (Math.abs(x - h.x) > 0.25 || Math.abs(y - h.y) > 0.25) { h.x = x; h.y = y; el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; }
    if (on !== h.on) { h.on = on; el.style.visibility = on ? 'visible' : 'hidden'; }
  }

  function drawWindowLife(g, now) {
    if (!win.kind) return;
    const G = L.glass, e = now - win.t0, { s } = L;
    g.save();
    g.beginPath(); g.rect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0); g.clip();
    g.globalAlpha = 0.9;
    if (win.kind === 'bird') {
      const peck = win.perched ? Math.max(hump((e - 1400) / 220), hump((e - 2700) / 220), hump((e - 3350) / 200)) : 0;
      drawBird(g, win.x, win.y, 1.3 * s, win.flip, win.perched ? null : e / 38, peck);
    } else drawLeaf(g, win.x, win.y, 1.4 * s, e / 600 + Math.sin(e / 420));
    g.restore();
  }

  function drawJar(g, now) {
    const e = now - jarT, wob = e < 500 && !RM ? Math.sin(e / 32) * 0.09 * (1 - e / 500) : 0;
    g.save();
    g.translate(L.jar.x, L.jar.y);
    g.rotate(wob);
    blit2(g, SP.jar, 0, 0, L.s);
    g.restore();
  }
  function drawTreat(g) {
    g.save();
    g.translate(treat.x, treat.y);
    g.rotate(treat.a);
    blit2(g, SP.treat, 0, 0, L.s * 1.45);
    g.restore();
  }
  function drawString(g) {
    const { s } = L, o = L.pom;
    // tied on at the side of the pompom that faces the anchor
    let dx = o.x - pom.x, dy = o.y - pom.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const ex = pom.x + dx * 10 * s, ey = pom.y + dy * 10 * s;
    // taut it's straight, slack it droops (more the slacker it is), and it trails a swing a little
    const sag = Math.sqrt(Math.max(0, o.len * o.len - d * d)) * 0.42;
    g.strokeStyle = 'rgba(176,160,132,.95)';
    g.lineWidth = 1.1 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(o.x, o.y);
    g.quadraticCurveTo((o.x + ex) / 2 - clamp(pom.vx * 0.01, -8 * s, 8 * s), (o.y + ey) / 2 + sag, ex, ey);
    g.stroke();
    g.fillStyle = 'rgba(120,104,82,.8)';
    g.beginPath(); g.arc(o.x, o.y, 1.6 * s, 0, TAU); g.fill();
  }
  function drawPom(g) {
    const { s } = L;
    g.save();
    g.translate(pom.x, pom.y);
    g.rotate(clamp(pom.vx / (900 * s), -0.5, 0.5));
    blit2(g, SP.pom, 0, 0, s);
    g.restore();
  }

  function drawScratches(g, now) {
    g.lineCap = 'round';
    g.strokeStyle = 'rgb(112,96,76)';
    g.lineWidth = 1.4;
    for (const f of fx.scratches) {
      const e = (now - f.t0) / 1800;
      g.globalAlpha = 0.75 * clamp(e < 0.12 ? e / 0.12 : 1 - (e - 0.12) / 0.88);
      g.beginPath();
      for (let j = 0; j < 3; j++) { g.moveTo(f.x + 12 - j * 1.6, f.y - 2.6 + j * 2.6); g.quadraticCurveTo(f.x + 1, f.y + 0.6 + j * 2.6, f.x - 11 - j * 1.6, f.y - 1.4 + j * 2.6); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // a soft hand of light gliding over the spot the pet button picked
  const BACK_PATH = [[70, -102], [34, -100], [0, -104], [-34, -112], [-70, -117], [-104, -110]];
  function strokeAt(zone, u) {
    if (zone === 'back') {
      const f = u * (BACK_PATH.length - 1), i = Math.min(BACK_PATH.length - 2, Math.floor(f)), r = f - i;
      PT.x = lerp(BACK_PATH[i][0], BACK_PATH[i + 1][0], r); PT.y = lerp(BACK_PATH[i][1], BACK_PATH[i + 1][1], r);
      return PT;
    }
    headMatrix(P);
    return zone === 'chin' ? headToCat(lerp(-26, 30, u), 46 - Math.sin(u * Math.PI) * 4) : headToCat(lerp(-30, 26, u), -46 - Math.sin(u * Math.PI) * 4);
  }
  function drawStrokes(g, now) {
    for (const st of fx.strokes) {
      const e = (now - st.t0) / 2300;
      const k = (e * 3) % 1;
      for (let j = 0; j < 8; j++) {
        const u = clamp(easeInOut(k) - j * 0.035);
        const p = strokeAt(st.zone, st.zone === 'back' ? u : 1 - u);
        dab(g, p.x, p.y, (st.zone === 'back' ? 14 : 10) - j, GLOW, (0.22 - j * 0.025) * Math.sin(Math.PI * k), 0.3);
      }
    }
  }

  function drawPurrs(g, now) {
    g.lineCap = 'round';
    for (const p of fx.purrs) {
      const e = (now - p.t0) / 1500;
      const a = Math.sin(Math.PI * clamp(e)) * 0.85;
      const x = p.x + (RM ? 0 : Math.sin(e * 5 + p.seed) * 6), y = p.y - (RM ? 0 : e * 46);
      if (p.seed % 3 < 1) {
        // now and then a little cinnabar heart
        const k = 0.75 + 0.25 * Math.sin(Math.PI * clamp(e * 2.5));
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(p.seed) * 0.25);
        g.scale(k, k);
        g.globalAlpha = a * 0.85;
        g.fillStyle = 'rgb(184,50,42)';
        g.beginPath();
        g.moveTo(0, 5.5);
        g.bezierCurveTo(-7.5, 0, -6.5, -6.5, -3.2, -6.5);
        g.bezierCurveTo(-1.4, -6.5, -0.3, -5.2, 0, -3.6);
        g.bezierCurveTo(0.3, -5.2, 1.4, -6.5, 3.2, -6.5);
        g.bezierCurveTo(6.5, -6.5, 7.5, 0, 0, 5.5);
        g.fill();
        g.restore();
        continue;
      }
      // a purr: a little wavering ink line, like the hum it is
      g.globalAlpha = a * 0.9;
      g.strokeStyle = 'rgb(52,44,40)';
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= 20; i++) {
        const u = i / 20, px = x - 11 + u * 22, py = y + Math.sin(u * TAU * 2.5 + 0.4) * 2.2 * (0.6 + 0.4 * Math.sin(Math.PI * u));
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // his little words, in pen, over his head (kept inside the picture on narrow screens)
  function drawWords(g, now) {
    headMatrix(P);
    for (const m of fx.words) {
      const e = (now - m.t0) / 1300;
      const pop = RM ? 1 : easeBack(clamp(e * 4));
      const a = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
      const mx = Math.min(HM[4] + 50 + P.yaw * 8, (L.W - 34 - L.catX) / L.s);
      const my = Math.max(HM[5] - 56, (30 - L.topY) / L.s) - (RM ? 0 : e * 14);
      g.save();
      g.translate(mx, my);
      g.rotate(-0.12);
      g.scale(pop * m.size / 30, pop * m.size / 30);
      g.globalAlpha = clamp(a);
      g.font = '30px "Nanum Pen Script", "Gowun Batang", cursive';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(22,17,15,.92)';
      g.fillText(m.text, 0, 0);
      g.strokeStyle = 'rgba(22,17,15,.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-26, 12); g.quadraticCurveTo(-30, 18, -34, 22); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }
  function drawZs(g, now) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgb(40,32,28)';
    g.font = 'italic 20px "Instrument Serif", Georgia, serif';
    for (const z of fx.zs) {
      const e = (now - z.t0) / 2600, k = 0.8 + e * 0.5;
      g.globalAlpha = 0.85 * hump(e);
      g.save();
      g.translate(z.x + e * 26 + Math.sin(e * 6) * 4, z.y - e * 46);
      g.scale(k, k);
      g.fillText('z', 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function drawSeals(g, now) {
    if (!SP.seal) return;
    for (const f of fx.seals) {
      const e = (now - f.t0) / 1600;
      const pressK = RM ? 1 : easeOut(clamp(e / 0.1));
      const sc = RM ? 1 : lerp(1.7, 1, pressK);
      const a = e < 0.1 ? (RM ? clamp(e / 0.1) : pressK) : e < 0.68 ? 1 : 1 - (e - 0.68) / 0.32;
      const sz = SP.seal.size;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.rot);
      g.scale(sc, sc);
      g.globalAlpha = clamp(a) * 0.95;
      g.drawImage(SP.seal.c, -sz / 2, -sz / 2, sz, sz);
      g.restore();
    }
  }
  function drawRings(g, now) {
    g.strokeStyle = 'rgb(24,22,22)';
    g.lineWidth = 1.4;
    for (const r of fx.rings) {
      const e = (now - r.t0) / 500;
      g.globalAlpha = 0.35 * (1 - e);
      g.beginPath(); g.arc(r.x, r.y, (RM ? 14 : 6 + e * 22) * L.s, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawAvoShadow(g) {
    const { s } = L;
    if (A.alpha <= 0.01 || A.under) return;
    const surf = surfaceBelow(A.x, A.y);
    const hgt = Math.max(0, surf - (A.y + avoBottom()));
    const k = clamp(1 - hgt / (260 * s));
    if (k <= 0) return;
    g.save();
    g.globalAlpha = A.alpha * k * A.scale;
    g.translate(A.x, surf - 1 * s);
    g.scale(1, 0.22);
    dab(g, 0, 0, 30 * s * (0.6 + 0.4 * k), AVO_SHADOW, 0.28, 0.3);
    g.restore();
  }

  function drawAvocado(g, now) {
    const { s } = L;
    if (A.alpha <= 0.01 || A.scale <= 0.01) return;
    g.save();
    // sinking into the cushion: what's gone under its surface isn't drawn,
    // and when it all fades it goes a little before the heap does
    g.globalAlpha = A.alpha * (A.sink ? A.alpha * A.alpha : 1) * (1 - 0.4 * A.sink);
    if (A.sink) {
      g.beginPath();
      g.rect(A.x - 80 * s, A.y + avoBottom() - 200 * s, 160 * s, 200 * s + 1.5 * s);
      g.clip();
    }
    g.translate(A.x, A.y + A.sink * 46 * s);
    // squashed flat under him
    if (A.mash) {
      const b = avoBottom();
      g.translate(0, b);
      g.scale(1 + 0.3 * A.mash, 1 - 0.5 * A.mash);
      g.translate(0, -b);
    }
    // squash along the last impact normal
    if (A.sq) {
      g.rotate(A.sqA);
      g.scale(1 + A.sq, 1 - A.sq * 0.75);
      g.rotate(-A.sqA);
    }
    g.rotate(A.ang);
    g.scale(A.scale * s, A.scale * s);
    blit(g, SP.avo);
    drawAvoFace(g, now);
    g.restore();
    if (A.mound > 0.01) drawMound(g);
    // the sweat drop and the little "!"
    const wk = now - A.worriedAt;
    if (wk < 1700 && A.alpha > 0.5 && !A.under) {
      const a = wk < 1300 ? 1 : 1 - (wk - 1300) / 400;
      // places on the avocado (its own frame, so they turn with it and never land on its face)
      const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
      const fl = A.x > L.W - 64 * s ? -1 : 1;
      const dx0 = A.x + (22 * fl * ca + 44 * sa) * s, dy0 = A.y + (22 * fl * sa - 44 * ca) * s;
      const ex0 = A.x + (-20 * fl * ca + 52 * sa) * s, ey0 = A.y + (-20 * fl * sa - 52 * ca) * s;
      g.save();
      g.globalAlpha = clamp(a);
      const dy = RM ? 0 : Math.min(1, wk / 900) * 7 * s;
      g.translate(dx0, dy0 + dy);
      g.beginPath();
      g.moveTo(0, -8 * s);
      g.bezierCurveTo(3.2 * s, -3 * s, 5 * s, 0, 5 * s, 2.4 * s);
      g.arc(0, 2.4 * s, 5 * s, 0, Math.PI);
      g.bezierCurveTo(-5 * s, 0, -3.2 * s, -3 * s, 0, -8 * s);
      g.fillStyle = 'rgba(188,218,238,.95)';
      g.fill();
      g.strokeStyle = 'rgba(62,98,138,.8)'; g.lineWidth = 1.1 * s; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.beginPath(); g.ellipse(-1.6 * s, 2 * s, 1.2 * s, 1.8 * s, 0.3, 0, TAU); g.fill();
      g.restore();
      if (wk < 900) {
        const pop = RM ? 1 : easeBack(clamp(wk / 220));
        g.save();
        g.globalAlpha = clamp(wk < 650 ? 1 : 1 - (wk - 650) / 250);
        g.translate(ex0, ey0);
        g.rotate(-0.15);
        g.scale(pop, pop);
        g.fillStyle = 'rgb(184,50,42)';
        g.font = L.bang;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('!', 0, 0);
        g.restore();
      }
    }
  }

  const moundY = (u, base, hgt, m) => base - hgt * Math.pow(Math.max(0, 1 - u * u), 0.6) + Math.sin(u * 9.3) * 1.4 * m;
  // fluff raked up from the cushion: a low heap round its base, kept on the
  // cushion (nothing hangs off the front of it)
  function drawMound(g) {
    const { s } = L, m = A.mound, al = A.alpha, hgt = 30 * m, base = 25, half = 22 + 14 * m;
    g.save();
    g.beginPath();
    g.rect(L.catX - L.plat.rx, L.topY - 200 * s, L.plat.rx * 2, 200 * s);
    g.moveTo(L.catX + L.plat.rx, L.topY);
    g.ellipse(L.catX, L.topY, L.plat.rx, L.plat.ry, 0, 0, TAU);
    g.clip();
    g.translate(A.x - 2 * s, A.y);
    g.scale(s, s);
    // where it presses into the cushion
    for (let x = -half; x <= half; x += 8) dab(g, x, base + 3, 11, CREAM_D, 0.3 * al * m, 0.3);
    // the heap: a soft cream dome, lit along its top, flecked like the cushion
    g.globalAlpha = al;
    g.fillStyle = 'rgb(228,219,200)';
    g.beginPath();
    g.moveTo(-half - 3, base + 2);
    for (let i = 0; i <= 16; i++) { const u = i / 8 - 1; g.lineTo(u * half, moundY(u, base, hgt, m)); }
    g.lineTo(half + 3, base + 2);
    g.quadraticCurveTo(0, base + 9, -half - 3, base + 2);
    g.fill();
    for (let i = 0; i <= 12; i++) {
      const u = i / 6 - 1, r = 4.5 + Math.abs(Math.sin(i * 1.9)) * 2.5;
      dab(g, u * half * 0.94, moundY(u, base, hgt, m) + r * 0.55, r, CREAM, 0.9 * al, 0.55);
    }
    for (let x = -half + 6; x < half - 4; x += 9) dab(g, x, base + 3, 6, CREAM_D, 0.3 * al, 0.4);
    // soft round ends and a soft foot, not a cut-out shape
    dab(g, -half, base, 5, CREAM_S, 0.8 * al, 0.5);
    dab(g, half, base, 5, CREAM_S, 0.8 * al, 0.5);
    for (let x = -half; x <= half; x += 7) dab(g, x, base + 5.5 - 3 * (x / half) ** 2, 4.5, CREAM_S, 0.55 * al, 0.4);
    g.globalAlpha = 0.45 * al;
    g.fillStyle = 'rgb(128,114,96)';
    for (let i = 0; i < 16; i++) {
      const u = Math.sin(i * 12.9898) * 0.8, y = lerp(moundY(u, base, hgt, m) + 3, base, Math.abs(Math.sin(i * 4.1)));
      g.fillRect(u * half, y, 1.1, 0.8);
    }
    g.globalAlpha = 0.4 * al;
    g.strokeStyle = 'rgb(128,114,96)';
    g.lineWidth = 0.8;
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const u = i / 8 - 1; i ? g.lineTo(u * half, moundY(u, base, hgt, m) - 0.5) : g.moveTo(u * half, moundY(u, base, hgt, m) - 0.5); }
    g.stroke();
    g.globalAlpha = 1;
    g.restore();
  }

  function drawAvoFace(g, now) {
    const face = A.under ? 'worried' : A.face;
    // its dot eyes glance at the pointer, or at him
    const recent = now - pointer.t < 2600;
    const lx = recent ? pointer.x : L.catX + HEAD_REST[0] * L.s, ly = recent ? pointer.y : L.topY + HEAD_REST[1] * L.s;
    const ddx = lx - A.x, ddy = ly - (A.y - 20 * L.s), dl = Math.hypot(ddx, ddy) || 1;
    const ca = Math.cos(-A.ang), sa = Math.sin(-A.ang);
    const gx = ((ddx * ca - ddy * sa) / dl) * 1.3, gy = ((ddx * sa + ddy * ca) / dl) * 1;
    const ink = 'rgba(22,17,15,.95)';
    // blush
    dab(g, -13.5, -13, 4.6, BLUSH, face === 'smug' ? 0.32 : 0.45, 0.4);
    dab(g, 13.5, -13, 4.6, BLUSH, face === 'smug' ? 0.32 : 0.45, 0.4);
    g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    if (face === 'smug') {
      for (const [ex, ey] of AVO_EYES) {
        g.beginPath(); g.arc(ex + gx, ey + gy + 0.6, 2.1, 0, TAU); g.fill();
        // heavy, unimpressed lids
        g.fillStyle = 'rgb(230,230,150)';
        g.beginPath(); g.rect(ex - 3.4, ey - 3.4, 6.8, 2.9); g.fill();
        g.fillStyle = ink;
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(ex - 3.2, ey - 0.4); g.lineTo(ex + 3.2, ey - 0.7); g.stroke();
      }
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-3.6, -12.8); g.quadraticCurveTo(0.6, -10.6, 4.4, -13.9); g.stroke();
    } else if (face === 'worried') {
      for (const [ex, ey] of AVO_EYES) {
        g.beginPath(); g.arc(ex + gx * 0.5, ey, 2.5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.beginPath(); g.arc(ex + gx * 0.5 - 0.8, ey - 0.9, 0.8, 0, TAU); g.fill();
        g.fillStyle = ink;
      }
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-10.5, -26); g.lineTo(-5, -28.2); g.moveTo(10.5, -26); g.lineTo(5, -28.2); g.stroke();
      g.beginPath();
      g.moveTo(-3.6, -12.4); g.quadraticCurveTo(-1.8, -14, 0, -12.4); g.quadraticCurveTo(1.8, -10.8, 3.6, -12.4);
      g.stroke();
    } else if (face === 'squeeze') {
      g.lineWidth = 1.4;
      for (const [ex, ey] of AVO_EYES) {
        const d = ex < 0 ? 1 : -1;
        g.beginPath(); g.moveTo(ex - d * 2.6, ey - 2.6); g.lineTo(ex + d * 2.2, ey); g.lineTo(ex - d * 2.6, ey + 2.6); g.stroke();
      }
      g.beginPath(); g.ellipse(0, -11.8, 2.3, 2.8, 0, 0, TAU); g.fill();
    } else {
      // dizzy: little spirals
      g.lineWidth = 0.9;
      for (const [ex, ey] of AVO_EYES) {
        g.beginPath();
        for (let i = 0; i <= 24; i++) { const a = i * 0.55 + now / 120, r = 0.4 + i * 0.13; const px = ex + Math.cos(a) * r, py = ey + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-4, -12.2); g.quadraticCurveTo(-2, -14, 0, -12.2); g.quadraticCurveTo(2, -10.4, 4, -12.2); g.stroke();
    }
  }

  // loop control
  function frame(now) {
    if (!active || destroyed || document.hidden || !ready) { raf = 0; return; }
    // -1 while the frame runs, so a start() from in here can't open a second loop
    raf = -1;
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    const hot = update(dt, now);
    // idle life (breathing, blinking, the tail) is gentle: about 30 fps is plenty,
    // and asleep he barely moves, so less than that
    const napping = C.act && C.act.kind === 'sleep' && C.act.asleep;
    const gap = napping ? 55 : !RM && !hot ? 30 : 0;
    if (!gap || now - lastDraw > gap) draw(now);
    raf = hot || !RM ? requestAnimationFrame(frame) : 0;
  }
  function kick() {
    if (raf || !active || destroyed || document.hidden || !ready) return;
    last = now0();
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf > 0) cancelAnimationFrame(raf); raf = 0; } else kick();
  }, opt);

  // text
  let sayT = 0, wokeAt = -1e9;
  function say(key, vars) {
    let text = vars ? fmt(tt(key), vars) : tt(key), wait = 60;
    const now = now0();
    // just woken up by this: that line mustn't get lost under this one (both
    // together if it isn't out yet, else this one a moment after it)
    if (key === 'cat.say.wake') wokeAt = now;
    else if (now - wokeAt < 1000) {
      if (now - wokeAt < 60) text = `${tt('cat.say.wake')} ${text}`;
      else wait = wokeAt + 1000 - now;
      wokeAt = -1e9;
    }
    clearTimeout(sayT);
    timers.delete(sayT);
    // cleared first, so the same line twice still gets read out
    if (wait <= 60) sayEl.textContent = '';
    sayT = later(() => { sayEl.textContent = text; }, wait);
  }
  function renderCount(bump) {
    const key = count === 0 ? 'cat.count.0' : count === 1 ? 'cat.count.1' : 'cat.count.n';
    const str = tt(key);
    const [before, after] = str.split('{n}');
    countN.textContent = '';
    if (after === undefined) countN.textContent = str;
    else {
      const b = document.createElement('b');
      b.textContent = String(count);
      countN.append(before, b, after);
    }
    let m = 0;
    for (const v of MILESTONES) if (count >= v) m = v;
    countNote.textContent = m ? tt(`cat.m.${m}`) : '';
    if (bump && m && m !== lastMilestone && !RM) {
      countNote.classList.remove('is-new');
      void countNote.offsetWidth;
      countNote.classList.add('is-new');
    }
    lastMilestone = m;
  }
  function renderTally() {
    tally.hidden = !(pets || treats || art.n);
    tallyPets.textContent = fmt(tt('cat.tally.pets'), { n: pets });
    tallyTreats.textContent = fmt(tt('cat.tally.treats'), { n: treats });
    tallyArt.textContent = art.n ? fmt(tt('cat.tally.art'), { n: art.n }) : '';
  }
  let lang = document.documentElement.lang;
  function relabel() {
    root.querySelectorAll('[data-ck]').forEach((el) => { el.textContent = tt(el.dataset.ck); });
    capMain.textContent = nm ? fmt(tt('cat.caption.named'), { name: nm }) : tt('cat.caption');
    capHint.textContent = tt(touchy ? 'cat.hint.touch' : 'cat.hint');
    petText.textContent = nm ? fmt(tt('cat.btn.pet.named'), { name: nm }) : tt('cat.btn.pet');
    btnRow.setAttribute('aria-label', nm ? fmt(tt('cat.btns.named'), { name: nm }) : tt('cat.btns'));
    stage.setAttribute('aria-label', nm ? fmt(tt('cat.label.named'), { name: nm }) : tt('cat.label'));
    renderCount(false);
    renderTally();
    // a new language: he tilts his head at the strange new words
    const lg = document.documentElement.lang;
    if (lg !== lang) { lang = lg; if (ready && L) start('tilt', { dir: Math.random() < 0.5 ? -1 : 1 }); }
  }

  // sizing
  let sizeQueued = false;
  const ro = new ResizeObserver(() => {
    if (sizeQueued || !ready) return;
    sizeQueued = true;
    requestAnimationFrame(() => { sizeQueued = false; if (!destroyed) relayout(); });
  });
  ro.observe(stage);
  const watchDpr = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { watchDpr(); if (ready) relayout(); }, { once: true, signal: ac.signal });
  };
  watchDpr();
  const onFonts = () => { if (!destroyed && ready && L && L.sign && !signFont && brushReady()) paintBgSoon(); };
  if (document.fonts) {
    document.fonts.load('20px "Nanum Brush Script"', SIGN_TEXT).then(onFonts, () => {});
    document.fonts.load('20px "Nanum Pen Script"', '야옹냥냠?').catch(() => {});
    document.fonts.addEventListener('loadingdone', onFonts, opt);
  }

  relabel();
  const t0 = now0();
  C.blinkAt = t0 + 1500;
  C.twAt = t0 + 2500;
  C.lastUser = t0;
  C.idleAt = t0 + 6000;
  // his sprites a part at a time in idle moments, then the room: each is a fair
  // bit of brushwork, and splitting it up keeps a scroll from hitching while he wakes up
  const wakeUp = () => {
    if (destroyed) return;
    ready = true;
    relayout(true);
  };
  idle(() => {
    if (destroyed) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) { idle(wakeUp, { timeout: 1200 }); return; }
    dpr = dprNow();
    const s = computeLayout(w, h).s, out = {};
    const it = catGen(s, dpr, out);
    const run = (dl) => {
      if (destroyed) return;
      const t1 = now0(), b = budget(dl);
      let done = false;
      do done = it.next().done; while (!done && now0() - t1 < b);
      if (!done) { slice(run); return; }
      CS = out; csKey = `${s.toFixed(4)}|${dpr}`;
      // the props in a slice of their own, then the room and off he goes
      slice(() => {
        if (destroyed) return;
        SP = propSprites(s, dpr); spKey = csKey;
        slice(wakeUp);
      });
    };
    run();
  }, { timeout: 1200 });

  return {
    setActive(on) {
      active = !!on;
      if (!active) {
        cancelAnimationFrame(raf); raf = 0;
        if (A.grab) endGrab(null);
        dropToy();
        tapCat = null;
        laser.drag = null;
      } else kick();
    },
    relabel,
    destroy() {
      destroyed = true;
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      ac.abort();
      for (const id of timers) clearTimeout(id);
      timers.clear();
    },
    // for tests and the curious
    _debug: {
      A, C, P, pom, treat, win, fx, laser, brush, books, art, hat, nip, pile, tufts,
      get L() { return L; },
      laserOn: (keys) => laserToggle(keys), brushGo, giveNip, psst, slowBlink, nextHat, paintGo, openBook, inkPrint,
      poke: () => poke(null, null), handleIt, pet: () => btn.pet.click(), meow: () => meow(now0()),
      boop: () => boop(false), toss: () => tossTreat(), toy: autoDangle, start, zoneAt,
      bully: (k) => { C.nextBully = k; handleIt(); },
      windowLife: () => { if (spawnWindow(now0())) start('window', { dur: 1e9 }); },
      idleFor: (ms) => { C.lastUser = now0() - ms; C.idleAt = 0; kick(); },
    },
  };
}
