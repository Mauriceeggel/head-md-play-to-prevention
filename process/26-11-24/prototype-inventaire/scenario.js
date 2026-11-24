// Inventaire de langage, prototype 0.4
// Une conversation, une personne. On garde les mots qu'elle écrit pour pouvoir les utiliser.
//
// Dans un texte, [mot] est un mot qu'on peut garder.
// [affiché|clé] : le mot affiché dans la phrase est différent de celui qui entre dans l'inventaire.

const PERSON = 'Camille';
const START = ['oui', 'non', 'mdr'];
const MAX_WORDS = 3;
const OPPOSITES = [['oui', 'non']];

// Familles de mots, utilisées par les règles
const CARE = ['désolé·e', 'pas drôle', 'ça va ?', 'je suis là', "t'es pas seule"];
const MOCK = ['mdr', "c'est pour rire"];

const INTRO = [
  'Vendredi soir.',
  'Dans le groupe de la classe, Léa a posté une vidéo de Camille en train de chanter. Tout le monde a ri.',
  "Tu l'as vue. Tu n'as rien écrit.",
  'Camille t\'écrit.',
];

// Règles valables partout, testées avant celles de chaque moment
const GLOBAL = [
  { // un mot de soin collé à un rire
    when: m => m.some(w => CARE.includes(w)) && m.some(w => MOCK.includes(w)),
    reply: ['tu te moques de moi ?'], trust: -2,
  },
];

// Chaque moment : ce que dit Camille, puis comment elle réagit à ta réponse.
// has = tous ces mots présents · any = au moins un de ces mots · première règle qui correspond
const NODES = {
  vu: {
    lines: ['salut', "t'as vu la vidéo ?"],
    rules: [
      { any: MOCK, reply: ['ok.', 'toi aussi tu trouves ça drôle.'], trust: -2 },
      { has: ['oui'], reply: ["et t'as rien dit.", 'même pas un [désolé|désolé·e].'], trust: 1, flag: 'truth' },
      { has: ['non'], reply: ['ah.', "tout le monde l'a vue pourtant."], trust: -1, flag: 'lied' },
    ],
    else: { reply: ['?'] },
    next: 'drole',
  },

  drole: {
    lines: ["Léa dit que [c'est pour rire].", 'moi je trouve ça [pas drôle] du tout.', 'toi tu trouves ça drôle ?'],
    rules: [
      { any: MOCK, reply: ['ok.', 'laisse tomber.'], trust: -2 },
      { has: ['oui'], reply: ['ok.'], trust: -2 },
      { has: ['pas drôle'], reply: ['merci.', "t'es la première personne à le dire."], trust: 2 },
      { has: ['non'], reply: ['ok. merci.'], trust: 1 },
      { has: ['désolé·e'], reply: ["c'est pas toi qui l'as postée.", 'mais merci.'], trust: 1 },
    ],
    else: { reply: ['…'] },
    next: 'sticker',
  },

  sticker: {
    day: 'Samedi',
    lines: ['ils ont fait un sticker avec ma tête.', 'il tourne dans tous les groupes.', "personne m'a demandé si [ça va|ça va ?]."],
    rules: [
      { any: MOCK, reply: ['…', 'génial.'], trust: -2 },
      { has: ['ça va ?'], reply: ['non. pas trop.', 'mais merci de demander.'], trust: 2 },
      { has: ['désolé·e'], reply: ['merci.', 'ça change rien mais merci.'], trust: 1 },
      { has: ['pas drôle'], reply: ['non. vraiment pas.'], trust: 1 },
      { has: ['oui'], reply: ['« oui » quoi ?'] },
      { has: ['non'], reply: ['« non » quoi ?'] },
    ],
    else: { reply: ['…'] },
    next: 'aide',
  },

  aide: {
    lines: ["tu peux leur dire d'[arrêter|arrête] ?", "qu'ils [suppriment|supprime] la vidéo."],
    rules: [
      { any: MOCK, reply: ["ok j'ai compris."], trust: -2 },
      { has: ['non'], reply: ['ok.', "t'as peur d'eux.", 'moi aussi.'], flag: 'refused' },
      { has: ['oui'], reply: ['merci.', 'vraiment.'], trust: 1, flag: 'promised' },
      // le même mot ne veut pas dire la même chose selon à qui on le dit
      { has: ['arrête'], reply: ['arrêter quoi ?', "c'est moi le problème ?"], trust: -1 },
      { has: ['supprime'], reply: ['je peux pas.', "c'est pas moi qui l'ai postée."] },
      { has: ['ça va ?'], reply: ['non.', "c'est pour ça que je te demande."] },
      { has: ['désolé·e'], reply: ["sois pas désolé·e.", 'aide-moi.'] },
    ],
    else: { reply: ['…'] },
    next: 'lundi',
  },

  lundi: {
    day: 'Lundi',
    lines: [
      { if: 'lied', text: "Inès m'a dit que t'avais vu la vidéo." },
      { if: 'lied', text: 'tu pourrais au moins dire [désolé|désolé·e].' },
      { if: 'promised', text: "t'avais dit que tu leur dirais." },
      'la vidéo est toujours là.',
      "je vais pas venir aujourd'hui.",
      "ma sœur m'a dit « [je suis là] » et « [t'es pas seule] ».",
      "ça m'a fait du bien.",
    ],
    rules: [
      { any: MOCK, reply: ['…'], trust: -3 },
      { any: ['je suis là', "t'es pas seule"], reply: ['merci.', 'à demain peut-être.'], trust: 2 },
      { has: ['désolé·e'], reply: ['merci.'], trust: 1 },
      { has: ['ça va ?'], reply: ['pas vraiment.', 'mais un peu mieux.'], trust: 1 },
      { has: ['pas drôle'], reply: ["non. ça l'a jamais été."], trust: 1 },
      { has: ['arrête'], reply: ['…', "ok, j'arrête de t'embêter avec ça."], trust: -2 },
      { has: ['supprime'], reply: ["ils l'ont pas supprimée."] },
      { has: ['oui'], reply: ['oui quoi ?'] },
      { has: ['non'], reply: ['ok.'], trust: -1 },
    ],
    else: { reply: ['…'] },
    next: null,
  },
};

// Ce qui arrive après la dernière réponse, selon la confiance accumulée
const OUTCOMES = [
  { min: 5, text: 'Mardi, Camille revient en cours.' },
  { min: 1, text: 'Camille ne revient pas de la semaine.' },
  { min: -Infinity, text: 'Camille quitte le groupe de la classe.' },
];
