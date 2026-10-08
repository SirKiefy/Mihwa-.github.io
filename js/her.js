// ─────────────────────────────────────────────────────────────────────────────
//  ✎  EVERYTHING ABOUT HER LIVES HERE.
//
//  Photos: put image files in  photos/  and write each name in PHOTOS below,
//  e.g.  src: 'photos/01.jpg'.  Empty entries show a placeholder painting.
//  Every photo is repainted in ink automatically; her colours come back on hover.
//
//  THOUGHTS and MEMORIES below are EXAMPLES (marked `example: true`).
//  REASONS (why you love her) starts empty for you to write.
//  Replace them with her real words and your real memories together.
//  Every text has English (en), French (fr) and Korean (ko). In French, the
//  space before : ; ? ! is a no-break space, so they never start a new line.
// ─────────────────────────────────────────────────────────────────────────────

export const HER = {
  name: { latin: 'Mihwa', ko: '미화', hanja: '美花' },
  instagram: 'mulnaengmyeonn',
  heroPhoto: 0,      // the photo in the ink at the top (index in PHOTOS)
  wantedPhoto: 4,    // the photo on the wanted poster

  bio: {
    en: ['International relations', 'Human rights · diplomacy', 'Fashion, ink & a steady aim'],
    fr: ['Relations internationales', 'Droits humains · diplomatie', 'Mode, encre & main sûre'],
    ko: ['국제관계학', '인권 · 외교', '패션 · 수묵화 · 명사수'],
  },

  // short, true things about her
  notes: [
    { k: { en: 'Studies', fr: 'Études', ko: '전공' }, v: { en: 'International relations (Bachelor’s), with a Master’s ahead', fr: 'Relations internationales (licence), un master en vue', ko: '국제관계학 학사, 다음은 석사' } },
    { k: { en: 'Roots', fr: 'Racines', ko: '뿌리' }, v: { en: 'Korean & French', fr: 'Coréennes & françaises', ko: '한국 & 프랑스' } },
    { k: { en: 'Cares about', fr: 'Se bat pour', ko: '마음 쓰는 것' }, v: { en: 'Human rights and equality, LGBTQ+ rights included', fr: 'Les droits humains et l’égalité, droits LGBTQ+ compris', ko: '인권과 평등, 성소수자의 권리까지' } },
    { k: { en: 'Loves', fr: 'Adore', ko: '좋아하는 것' }, v: { en: 'Fashion, Korean ink painting (수묵화), military history, and anything with a scope', fr: 'La mode, la peinture à l’encre coréenne (수묵화), l’histoire militaire, et tout ce qui a une lunette de visée', ko: '패션, 수묵화, 밀리터리, 그리고 조준경 달린 건 전부' } },
    { k: { en: 'Plays', fr: 'Côté jeux', ko: '게임' }, v: { en: 'DayZ, as a sniper (obviously), and Red Dead Redemption 2, which she adores', fr: 'DayZ, en sniper (évidemment), et Red Dead Redemption 2, qu’elle adore', ko: 'DayZ는 당연히 저격수로, 그리고 인생 게임 레드 데드 리뎀션 2' } },
    { k: { en: 'Handle', fr: 'Pseudo', ko: '아이디' }, v: { en: '@mulnaengmyeonn, like the cold noodles', fr: '@mulnaengmyeonn, comme les nouilles froides', ko: '@mulnaengmyeonn, 그 물냉면 맞아요' } },
  ],
};

// aspect: width / height, used only for placeholders
export const PHOTOS = [
  { src: '', aspect: 4 / 5, caption: { en: 'the look', fr: 'le regard', ko: '그 눈빛' } },
  { src: '', aspect: 4 / 5, caption: { en: 'golden hour', fr: 'l’heure dorée', ko: '골든 아워' } },
  { src: '', aspect: 3 / 4, caption: { en: 'mid-laugh', fr: 'en plein fou rire', ko: '웃음 터진 순간' } },
  { src: '', aspect: 1, caption: { en: 'the outfit', fr: 'la tenue', ko: '오늘의 착장' } },
  { src: '', aspect: 4 / 5, caption: { en: 'the pose', fr: 'la pose', ko: '그 포즈' } },
  { src: '', aspect: 3 / 4, caption: { en: 'Seoul mood', fr: 'humeur Séoul', ko: '서울 무드' } },
  { src: '', aspect: 4 / 5, caption: { en: 'Paris mood', fr: 'humeur Paris', ko: '파리 무드' } },
  { src: '', aspect: 4 / 5, caption: { en: 'main character', fr: 'personnage principal', ko: '주인공' } },
  { src: '', aspect: 1, caption: { en: 'soft focus', fr: 'flou doux', ko: '소프트 포커스' } },
  { src: '', aspect: 3 / 4, caption: { en: 'caught off guard', fr: 'prise au dépourvu', ko: '방심한 순간' } },
  { src: '', aspect: 4 / 5, caption: { en: 'iconic', fr: 'iconique', ko: '레전드' } },
  { src: '', aspect: 4 / 5, caption: { en: 'last frame', fr: 'dernière image', ko: '마지막 컷' } },
];

// ✎ EXAMPLES — replace with things she actually says.
export const THOUGHTS = [
  { example: true, seal: '交', en: 'Diplomacy is just kindness with a dress code.', fr: 'La diplomatie, c’est de la gentillesse avec un code vestimentaire.', ko: '외교는 드레스 코드가 있는 다정함이야.' },
  { example: true, seal: '界', en: 'Every border has people on both sides.', fr: 'Il y a des gens des deux côtés de chaque frontière.', ko: '국경 양쪽에는 언제나 사람이 있어.' },
  { example: true, seal: '服', en: 'A good outfit is a quiet argument.', fr: 'Une belle tenue, c’est un argument silencieux.', ko: '잘 고른 옷은 조용한 설득이야.' },
  { example: true, seal: '冷', en: 'Mul-naengmyeon is non-negotiable.', fr: 'Le mul-naengmyeon, c’est non négociable.', ko: '물냉면은 협상 불가야.' },
];

// ✎ EXAMPLES — replace with your real memories together. `photo` picks an image from PHOTOS.
export const MEMORIES = [
  {
    example: true, photo: 1, when: { en: '', fr: '', ko: '' },
    title: { en: 'Two time zones', fr: 'Deux fuseaux horaires', ko: '두 개의 시간대' },
    text: {
      en: 'A message sent at midnight in Paris, read over breakfast in Seoul, and answered before the coffee went cold.',
      fr: 'Un message parti de Paris à minuit, lu à Séoul au petit-déjeuner ; la réponse est arrivée avant que le café refroidisse.',
      ko: '파리의 자정에 보낸 메시지를 서울의 아침 식탁에서 읽고, 커피가 식기도 전에 답해 준 사람.',
    },
  },
  {
    example: true, photo: 4, when: { en: '', fr: '', ko: '' },
    title: { en: 'Attempt number thirty-seven', fr: 'Essai numéro trente-sept', ko: '서른일곱 번째 컷' },
    text: {
      en: 'Thirty-six takes, one perfect pose, zero regrets.',
      fr: 'Trente-six essais, une pose parfaite, zéro regret.',
      ko: '서른여섯 번의 시도, 완벽한 포즈 하나, 후회는 제로.',
    },
  },
  {
    example: true, photo: 8, when: { en: '', fr: '', ko: '' },
    title: { en: 'Mul-naengmyeon season', fr: 'La saison du mul-naengmyeon', ko: '물냉면의 계절' },
    text: {
      en: 'A hot afternoon, two bowls of cold noodles, and a very serious debate about bibim.',
      fr: 'Un après-midi brûlant, deux bols de nouilles froides, et un débat très sérieux sur le bibim.',
      ko: '무더운 오후, 물냉면 두 그릇, 그리고 비냉에 대한 아주 진지한 토론.',
    },
  },
  {
    example: true, photo: 7, when: { en: '', fr: '', ko: '' },
    title: { en: 'The future, out loud', fr: 'L’avenir, à voix haute', ko: '소리 내어 말한 미래' },
    text: {
      en: 'The first time she described the future she wants: the diplomacy, the rights, the outfits. It all sounded completely possible.',
      fr: 'La première fois qu’elle a décrit l’avenir qu’elle veut : la diplomatie, les droits, les tenues. Tout semblait possible.',
      ko: '그녀가 원하는 미래를 처음 이야기해 준 날. 외교와 인권, 그리고 옷까지. 전부 정말 가능해 보였어.',
    },
  },
];

// Her path: from where she is now to where she's going.
export const PATH = [
  {
    seal: '學', when: { en: 'Now', fr: 'Maintenant', ko: '지금' },
    title: { en: 'Bachelor’s in International Relations', fr: 'Licence en relations internationales', ko: '국제관계학 학사' },
    text: {
      en: 'Learning how the world talks to itself: treaties, borders, and the people in between.',
      fr: 'Apprendre comment le monde se parle : traités, frontières, et les gens entre les deux.',
      ko: '세계가 스스로와 대화하는 법을 배우는 중. 조약과 국경, 그리고 그 사이의 사람들.',
    },
  },
  {
    seal: '碩', when: { en: 'Next', fr: 'Ensuite', ko: '다음' },
    title: { en: 'A Master’s', fr: 'Un master', ko: '석사 과정' },
    text: {
      en: 'Going deeper: diplomacy, human rights, and the fine print that decides them.',
      fr: 'Aller plus loin : diplomatie, droits humains, et les petites lignes qui en décident.',
      ko: '더 깊이. 외교와 인권, 그리고 그것을 결정하는 세부 조항들.',
    },
  },
  {
    seal: '交', when: { en: 'Then', fr: 'Puis', ko: '그다음' },
    title: { en: 'Diplomacy', fr: 'La diplomatie', ko: '외교' },
    text: {
      en: 'Speaking for people, not only for countries, and doing it beautifully.',
      fr: 'Parler au nom des gens, pas seulement des pays, et le faire avec élégance.',
      ko: '나라만이 아니라 사람을 대변하는 일. 그것도 아름답게.',
    },
  },
  {
    seal: '權', when: { en: 'And', fr: 'Et', ko: '그리고' },
    title: { en: 'Human rights & NGOs', fr: 'Droits humains & ONG', ko: '인권 · NGO' },
    text: {
      en: 'Standing up for people who are easy to overlook, and for equality, LGBTQ+ rights included.',
      fr: 'Défendre celles et ceux qu’on oublie trop vite, et l’égalité, droits LGBTQ+ compris.',
      ko: '쉽게 잊히는 사람들 편에 서는 일. 성소수자의 권리를 포함한 모두의 평등을 위해.',
    },
  },
  {
    seal: '衣', when: { en: 'Always', fr: 'Toujours', ko: '언제나' },
    title: { en: 'Fashion, the whole way', fr: 'La mode, tout du long', ko: '패션, 처음부터 끝까지' },
    text: {
      en: 'Fashion is a language too, and she speaks it fluently, at the negotiating table or on the street.',
      fr: 'La mode est aussi une langue, qu’elle parle couramment, à la table des négociations comme dans la rue.',
      ko: '패션도 하나의 언어니까. 협상장에서든 거리에서든, 유창하게.',
    },
  },
];

// ✎ WHY YOU LOVE HER: yours to write. Each reason becomes one blossom on the plum
//   branch in "Why I love you". One short sentence each, written to her.
//   English is enough; add fr and ko if you like, otherwise the English shows in
//   every language. The section stays hidden until there is at least one.
//   The shape of one reason:
//     { en: 'One reason, in your own words.' },
//     { en: '…', fr: '…', ko: '…' },
export const REASONS = [
];

// ✎ The letter at the end. One string per paragraph; the first one is the greeting.
export const LETTER = {
  en: {
    body: [
      'Dear Mihwa,',
      'I love you. Saying it once never felt like enough, so I painted you a whole album. Everything in it is ink, and the colour only comes back where you are, which is more or less how my life works too.',
      'You are heading for a Master’s, then diplomacy, then a lifetime of standing up for people who need someone on their side. I have never doubted you for a second, and I will be cheering at every step.',
      'On the globe in this album, a red thread runs between Seoul and Paris, your two homes. There is one between us too: however far apart we are, it never breaks, and I am always holding my end.',
      'I love your steady aim and your soft heart: perfectly still behind a scope in Chernarus, in tears at the end of Red Dead. Keep both. The world could use exactly that combination.',
      'And never change your handle. Mul-naengmyeon is the correct choice, and you are my favourite person in the whole world.',
    ],
    sign: '— with all my love',
  },
  fr: {
    body: [
      'Ma chère Mihwa,',
      'Je t’aime. Le dire une seule fois ne m’a jamais suffi, alors je t’ai peint un album entier. Tout y est à l’encre, et la couleur ne revient que là où tu es ; dans ma vie, c’est un peu pareil.',
      'Tu files vers un master, puis la diplomatie, puis une vie entière à défendre celles et ceux qui ont besoin de quelqu’un à leurs côtés. Je n’ai jamais douté de toi une seule seconde, et je t’applaudirai à chaque étape.',
      'Sur le globe de cet album, un fil rouge relie Séoul et Paris, tes deux maisons. Il y en a un entre nous aussi : quelle que soit la distance, il ne casse jamais, et moi, je tiens toujours mon bout.',
      'J’aime ta main sûre et ton cœur tendre : immobile derrière ta lunette à Chernarus, en larmes à la fin de Red Dead. Garde les deux : le monde a bien besoin de ce mélange-là.',
      'Et ne change jamais de pseudo. Le mul-naengmyeon reste le bon choix, et toi, tu restes la personne que je préfère au monde.',
    ],
    sign: '— avec tout mon amour',
  },
  ko: {
    body: [
      '사랑하는 미화에게',
      '사랑해. 한 번 말하는 걸로는 도저히 모자라서, 아예 화첩 한 권을 그렸어. 여기 있는 건 전부 먹으로 그렸는데, 색은 네가 있는 곳에서만 돌아와. 사실 내 삶도 거의 그래.',
      '너는 석사를 마치고 외교의 길로, 그리고 곁에 누군가가 필요한 사람들 편에 서는 삶으로 걸어가겠지. 난 너를 한 번도 의심한 적 없어. 네가 내딛는 걸음마다 제일 크게 응원할게.',
      '이 화첩 속 지구본에는 붉은 실 하나가 너의 두 집, 서울과 파리를 잇고 있어. 우리 사이에도 그런 실이 있어. 아무리 멀리 떨어져 있어도 끊어지지 않고, 한쪽 끝은 언제나 내가 꼭 붙잡고 있을게.',
      '흔들림 없는 조준도, 여린 마음도 다 사랑해. 체르나러스에서는 조준경을 들여다보며 미동도 없다가, 레드 데드 엔딩에서는 펑펑 우는 너. 둘 다 잃지 마. 세상에 필요한 게 딱 그 조합이니까.',
      '그리고 아이디는 절대 바꾸지 마. 물냉면이 정답이고, 넌 세상에서 내가 제일 좋아하는 사람이야.',
    ],
    sign: '— 사랑을 가득 담아',
  },
};
