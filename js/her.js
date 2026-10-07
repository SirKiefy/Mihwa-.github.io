// ─────────────────────────────────────────────────────────────────────────────
//  ✎  EVERYTHING ABOUT HER LIVES HERE.
//
//  Photos: put image files in  photos/  and write each name in PHOTOS below,
//  e.g.  src: 'photos/01.jpg'.  Empty entries show a placeholder painting.
//  Every photo is repainted in ink automatically; her colours come back on hover.
//
//  THOUGHTS and MEMORIES below are EXAMPLES (marked `example: true`).
//  Replace them with her real words and your real memories together.
//  Every text has English (en), French (fr) and Korean (ko).
// ─────────────────────────────────────────────────────────────────────────────

export const HER = {
  name: { latin: 'Mihwa', ko: '미화', hanja: '美花' },
  instagram: 'mulnaengmyeonn',
  heroPhoto: 0,      // the photo in the ink at the top (index in PHOTOS)

  bio: {
    en: ['International relations', 'Human rights · diplomacy', 'Fashion, always'],
    fr: ['Relations internationales', 'Droits humains · diplomatie', 'La mode, toujours'],
    ko: ['국제관계학', '인권 · 외교', '패션은 언제나'],
  },

  // short, true things about her
  notes: [
    { k: { en: 'Studies', fr: 'Études', ko: '전공' }, v: { en: 'International relations (Bachelor’s), with a Master’s ahead', fr: 'Relations internationales (licence), un master en vue', ko: '국제관계학 학사, 다음은 석사' } },
    { k: { en: 'Roots', fr: 'Racines', ko: '뿌리' }, v: { en: 'Korean & French', fr: 'Coréennes & françaises', ko: '한국 & 프랑스' } },
    { k: { en: 'Cares about', fr: 'Se bat pour', ko: '마음 쓰는 것' }, v: { en: 'Human rights and equality, LGBTQ+ rights included', fr: 'Les droits humains et l’égalité, droits LGBTQ+ compris', ko: '인권과 평등, 성소수자의 권리까지' } },
    { k: { en: 'Loves', fr: 'Adore', ko: '좋아하는 것' }, v: { en: 'Fashion and Korean ink painting (수묵화)', fr: 'La mode et la peinture à l’encre coréenne (수묵화)', ko: '패션, 그리고 수묵화' } },
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
  { example: true, seal: '界', en: 'Every border has people on both sides.', fr: 'Chaque frontière a des gens des deux côtés.', ko: '모든 국경의 양쪽에는 사람이 있어.' },
  { example: true, seal: '勇', en: 'Wear what makes you brave.', fr: 'Porte ce qui te rend courageuse.', ko: '용감해지는 옷을 입어.' },
  { example: true, seal: '冷', en: 'Mul-naengmyeon is a personality.', fr: 'Le mul-naengmyeon, c’est une personnalité.', ko: '물냉면은 하나의 성격이야.' },
];

// ✎ EXAMPLES — replace with your real memories together. `photo` picks an image from PHOTOS.
export const MEMORIES = [
  {
    example: true, photo: 1, when: { en: '', fr: '', ko: '' },
    title: { en: 'Two time zones', fr: 'Deux fuseaux horaires', ko: '두 개의 시간대' },
    text: {
      en: 'A message sent at midnight in Seoul, read over breakfast in Paris, and answered anyway.',
      fr: 'Un message envoyé à minuit à Séoul, lu au petit-déjeuner à Paris, et auquel elle a répondu quand même.',
      ko: '서울의 자정에 보낸 메시지를 파리의 아침에 읽고, 그래도 답해 준 사람.',
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
      fr: 'La première fois qu’elle a décrit l’avenir qu’elle veut : la diplomatie, les droits, les tenues. Tout semblait possible.',
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
      fr: 'Apprendre comment le monde se parle : traités, frontières, et les gens entre les deux.',
      ko: '세계가 스스로와 대화하는 법을 배우는 중. 조약과 국경, 그리고 그 사이의 사람들.',
    },
  },
  {
    seal: '碩', when: { en: 'Next', fr: 'Ensuite', ko: '다음' },
    title: { en: 'A Master’s', fr: 'Un master', ko: '석사 과정' },
    text: {
      en: 'Going deeper: diplomacy, human rights, and the fine print that decides them.',
      fr: 'Aller plus loin : diplomatie, droits humains, et les petites lignes qui en décident.',
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
      en: 'How you show up matters, in a negotiation room or on the street.',
      fr: 'La façon dont on se présente compte, en salle de négociation comme dans la rue.',
      ko: '협상장에서든 거리에서든, 어떻게 나타나는지가 중요하니까.',
    },
  },
];

// ✎ The letter at the end. One string per paragraph.
export const LETTER = {
  en: {
    body: [
      'Dear Mihwa,',
      'This little site is an album with only you in it. The ink is for the paintings you love, the colours are yours, and so are all the poses.',
      'Keep studying the world. It is lucky to have someone like you paying such close attention to it, and caring so much about the people in it.',
      'And never change your handle. Mul-naengmyeon is the correct choice.',
    ],
    sign: '— your friend',
  },
  fr: {
    body: [
      'Chère Mihwa,',
      'Ce petit site est un album où il n’y a que toi. L’encre, c’est pour les peintures que tu aimes ; les couleurs sont les tiennes, et les poses aussi.',
      'Continue d’étudier le monde. Il a de la chance que quelqu’un comme toi le regarde d’aussi près, et tienne autant aux gens qui l’habitent.',
      'Et ne change jamais de pseudo : le mul-naengmyeon, c’est le bon choix.',
    ],
    sign: '— avec toute mon affection',
  },
  ko: {
    body: [
      '미화에게,',
      '이 작은 사이트는 너만 담긴 화첩이야. 먹은 네가 좋아하는 수묵화를 위해, 색은 너의 것, 포즈도 전부 네 거야.',
      '계속 세상을 공부해 줘. 너처럼 세상을 자세히 들여다보고, 그 안의 사람들을 이렇게 아끼는 사람이 있다는 건 세상한테 행운이니까.',
      '그리고 아이디는 절대 바꾸지 마. 물냉면이 정답이야.',
    ],
    sign: '— 너의 친구가',
  },
};
