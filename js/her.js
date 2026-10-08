// ─────────────────────────────────────────────────────────────────────────────
//  ✎  EVERYTHING ABOUT HER LIVES HERE.
//
//  Photos: put image files in  photos/  and write each name in PHOTOS below,
//  e.g.  src: 'photos/01.jpg'.  Empty entries show a placeholder painting.
//  Every photo is repainted in ink automatically; her colours come back on hover.
//
//  THOUGHTS and MEMORIES below are EXAMPLES (marked `example: true`).
//  REASONS (what you admire about her) starts empty for you to write.
//  Replace them with her real words and your real memories together.
//  Every text has English (en), French (fr) and Korean (ko). In French, the
//  space before : ; ? ! is a no-break space, so they never start a new line.
// ─────────────────────────────────────────────────────────────────────────────

export const HER = {
  name: { latin: 'Mihwa', ko: '미화', hanja: '美花' },
  instagram: 'mulnaengmyeonn',
  heroPhoto: 0,      // the photo in the ink at the top (index in PHOTOS)
  wantedPhoto: 4,    // the photo on the wanted poster
  // ✎ her baby, the cat: write his name here when you know it (until then he is "her baby")
  cat: { name: '' },

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
    { k: { en: 'Loves', fr: 'Adore', ko: '좋아하는 것' }, v: { en: 'Her cat above all, then fashion, Korean ink painting (수묵화), military history, and anything with a scope', fr: 'Son chat avant tout, puis la mode, la peinture à l’encre coréenne (수묵화), l’histoire militaire, et tout ce qui a une lunette de visée', ko: '무엇보다 고양이, 그다음 패션, 수묵화, 밀리터리, 그리고 조준경 달린 건 전부' } },
    { k: { en: 'Hates', fr: 'Déteste', ko: '싫어하는 것' }, v: { en: 'Avocado. Passionately.', fr: 'L’avocat (le fruit, pas le métier). Passionnément.', ko: '아보카도. 진심으로.' } },
    { k: { en: 'Plays', fr: 'Côté jeux', ko: '게임' }, v: { en: 'DayZ in Chernarus and Arma 3 on Altis, as a sniper (obviously), and Red Dead Redemption 2, which she adores', fr: 'DayZ à Chernarus et Arma 3 sur Altis, en sniper (évidemment), et Red Dead Redemption 2, qu’elle adore', ko: 'DayZ(체르나루스)와 Arma 3(알티스)에선 당연히 저격수, 그리고 인생 게임 레드 데드 리뎀션 2' } },
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
  // with the students and teachers of France, autumn 2026
  { example: true, seal: '校', en: 'More teachers, real classrooms, schools that aren’t falling apart. That’s not too much to ask.', fr: 'Plus de profs, de vraies salles de classe, des écoles qui ne tombent pas en ruine. Ce n’est pas trop demander.', ko: '선생님은 더 많이, 교실은 제대로, 무너지지 않는 학교. 그게 그렇게 무리한 부탁이야?' },
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

// ✎ WHAT YOU ADMIRE ABOUT HER: yours to write. Each one becomes a blossom on the
//   plum branch in "Why you’re one of a kind". One short sentence each, written to her.
//   English is enough; add fr and ko if you like, otherwise the English shows in
//   every language. The section stays hidden until there is at least one.
//   The shape of one reason:
//     { en: 'One reason, in your own words.' },
//     { en: '…', fr: '…', ko: '…' },
export const REASONS = [
];

// ✎ The letter at the end: the author’s own letter to her, written by them in
//   their own words. It stays in English and is not translated: the same text
//   shows in every language. One string per paragraph; the first one is the greeting.
const LETTER_TEXT = {
  body: [
    'Dear Mimi,',
    'I made this lil site, like I promised! I hope you like it.',
    'I’m so glad to have met you. Even if you piss me off sometimes, I have so many good memories with you, both in Lyon and online, and I really treasure you.',
    'I hope the world treats you better, since I truly believe you deserve so much better, darling. You have worked so hard, with all those late nights staying up studying and trying your best to manage everything on your own. I want you to know you don’t have to. I’m here for you.',
    'You are truly one hell of a woman, and I can’t wait to see how far you go, lil stormy girl.',
  ],
  // ✎ one last line in Korean, just above the sign (delete `ps` to remove it)
  ps: '사랑해 ♡',
  sign: '— always here for you',
};

export const LETTER = {
  en: LETTER_TEXT,
  fr: LETTER_TEXT,
  ko: LETTER_TEXT,
};
