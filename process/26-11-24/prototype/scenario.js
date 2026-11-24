// ───────────────────────────────────────────────────────────────
// SCÉNARIO — tout le contenu éditable du prototype est ici.
// Les temps (t) sont en secondes depuis le début de la journée (avant PACE).
// ───────────────────────────────────────────────────────────────

// Rythme : multiplie tous les temps (t) et durées éphémères (eph). 1 = rapide, 2 = deux fois plus lent.
const PACE = 2;
// Après le dernier message de la journée, délai (s) avant de pouvoir passer au jour suivant.
const NEXT_DAY_DELAY = 8;
// Délai (ms) avant qu'un personnage commence à écrire sa réponse.
const REPLY_DELAY = 2200;

const CHARS = {
  you:     { name: 'Toi',     skin: '#f2c9a0', hair: '#3b2a20', style: 'short',  shirt: '#9ad1d4' },
  lea:     { name: 'Léa',     skin: '#f5d0b0', hair: '#c0763a', style: 'long',   shirt: '#f4a6a6' },
  thomas:  { name: 'Thomas',  skin: '#e8b48c', hair: '#1f1a17', style: 'spiky',  shirt: '#7aa2e3' },
  ines:    { name: 'Inès',    skin: '#c98e66', hair: '#2a1d16', style: 'bun',    shirt: '#b8a1e3' },
  sarah:   { name: 'Sarah',   skin: '#8d5a3b', hair: '#1a1210', style: 'curly',  shirt: '#9fd89f' },
  camille: { name: 'Camille', skin: '#f6d6bf', hair: '#6b4a2e', style: 'bob',    shirt: '#ffd59a' },
};

// Les membres du groupe portent la casquette jaune : le « code » du groupe.
const GROUP_CODE = ['lea', 'thomas', 'ines'];

// Les conversations apparaissent au fil de l'histoire (au premier message reçu).
const CONVS = [
  { id: 'camille',   title: 'Camille',        type: 'dm',      with: 'camille' },
  { id: 'thomas_dm', title: 'Thomas',         type: 'dm',      with: 'thomas' },
  { id: 'team',      title: 'la team 🦆',     type: 'group',   members: ['lea', 'thomas', 'ines'] },
  { id: 'sarah',     title: 'Sarah',          type: 'dm',      with: 'sarah' },
  { id: 'memes',     title: '@memes_college', type: 'account' },
];

const START_FLAMES = { thomas: 190, lea: 140, ines: 96, sarah: 12, camille: 30 };

// Paliers de légitimité face à Thomas.
// ≥ stop : il arrête · ≥ negotiate : il négocie (Léa peut faire basculer) · en dessous : il se moque.
const LEGIT = { stop: 170, negotiate: 100 };
// Flamme minimale avec Léa pour qu'elle te soutienne devant le groupe.
const LEA_ALLY = 80;

// Attention : nombre de conversations DIFFÉRENTES que tu peux suivre chaque jour.
// Rouvrir une conversation déjà suivie aujourd'hui est gratuit.
const ATTENTION = [3, 3, 3];

// Circulation de la vidéo : vues au début de chaque jour, et vues ajoutées par seconde.
const VIEWS = [{ start: 3, rate: 0.2 }, { start: 47, rate: 1.5 }, { start: 212, rate: 4 }];

// Vocabulaire. origin = d'où vient le mot (la couleur) : toi · groupe · appris
// tone = ce que le jeu en fait : answer (oui/non/jsp, un seul à la fois) · join · neutral · dodge · support · oppose
// from = qui te l'a appris (en le disant)
const FRAGMENTS = {
  oui:       { label: 'oui',               origin: 'toi',    tone: 'answer', value: 'oui' },
  non:       { label: 'non',               origin: 'toi',    tone: 'answer', value: 'non' },
  jsp:       { label: 'jsp',               origin: 'toi',    tone: 'answer', value: 'jsp',  from: 'ines' },
  ok:        { label: 'ok',                origin: 'toi',    tone: 'neutral',               from: 'lea' },
  lol:       { label: '😂',                origin: 'groupe', tone: 'join',                  from: 'ines' },
  skull:     { label: '💀',                origin: 'groupe', tone: 'join',                  from: 'thomas' },
  mdr:       { label: 'mdrrr',             origin: 'groupe', tone: 'join',                  from: 'thomas' },
  chut:      { label: '🤫',                origin: 'groupe', tone: 'join',                  from: 'lea' },
  hamster:   { label: '🐹',                origin: 'groupe', tone: 'join',                  from: 'thomas' },
  sticker:   { label: '🐹🎤',              origin: 'groupe', tone: 'join', kind: 'sticker', from: 'thomas' },
  pourrire:  { label: "c'est pour rire",   origin: 'groupe', tone: 'join',                  from: 'thomas' },
  pasmoi:    { label: "c'est pas moi",     origin: 'appris', tone: 'dodge',                 from: 'lea' },
  jesuisla:  { label: 'je suis là',        origin: 'appris', tone: 'support',               from: 'sarah' },
  desole:    { label: 'désolé·e',          origin: 'appris', tone: 'support',               from: 'camille' },
  cava:      { label: 'ça va ?',           origin: 'appris', tone: 'support',               from: 'sarah' },
  plusdrole: { label: "c'est plus drôle",  origin: 'appris', tone: 'oppose',                from: 'sarah' },
  trop:      { label: "c'est un peu trop", origin: 'appris', tone: 'oppose',                from: 'lea' },
  arrete:    { label: 'arrête',            origin: 'appris', tone: 'oppose',                from: 'camille' },
  supprime:  { label: 'supprime',          origin: 'appris', tone: 'oppose',                from: 'camille' },
};

// Au début, on ne sait dire que oui ou non. Les autres mots s'apprennent en lisant (teach).
const START_INVENTORY = ['oui', 'non'];

// Réponses aux questions (ask). « oui / non / jsp » ne sont utilisables que quand une question attend une réponse.
// reply : [[qui, texte, mots appris en lisant ce message], …] · flame · flags · conformity · log : souvenir
const ANSWERS = {
  maths: {
    oui: { reply: [['camille', 'tu me sauves 🙏 tu me montres demain ?']], flame: { camille: 5 }, log: "Tu as dit à Camille que tu avais fait l'exo de maths." },
    non: { reply: [['camille', 'tant pis 😅']] },
    jsp: { reply: [['camille', '😅']] },
  },
  seen: {
    oui: { reply: [['thomas', 'LA NOTE DE FIN 💀💀']], flame: { thomas: 8 }, conformity: 1 },
    non: { reply: [['thomas', "va voir 😂 léa va t'ajouter"]] },
    jsp: { reply: [['thomas', '??']] },
  },
  secret: {
    oui: { reply: [['lea', '🤐🤐 merci']], flame: { lea: 10 }, flags: { promisedSecret: true }, conformity: 1, log: 'Tu as promis à Léa de ne rien dire.' },
    non: { reply: [['lea', "??? c'est une blague hein"], ['thomas', 'oh là 😂']], flame: { lea: -15 }, flags: { refusedSecret: true }, log: 'Tu as refusé de garder le secret de Léa.' },
    jsp: { reply: [['lea', 'mdr ok']] },
  },
  sticker: {
    oui: { reply: [['sarah', "elle a pas l'air bien. tu pourrais lui écrire ? juste lui dire que t'es là.", ['jesuisla']]], flame: { sarah: 10 } },
    non: { reply: [['sarah', "regarde le groupe. elle a pas l'air bien."]] },
    jsp: { reply: [['sarah', "regarde le groupe. elle a pas l'air bien."]] },
  },
  video: {
    oui: { reply: [['camille', "…pourquoi personne m'a rien dit 😞 t'es même pas désolé·e ?", ['desole']]], flame: { camille: 10 }, flags: { toldTruth: true }, log: 'Tu as dit la vérité à Camille.' },
    non: { reply: [['camille', 'ok… merci 🙏']], flags: { lied: true }, log: 'Tu as dit à Camille que non.' },
    jsp: { reply: [['camille', 'ok.']], flags: { evasive: true }, log: 'Tu as répondu « jsp » à Camille.' },
  },
  say: {
    oui: { reply: [['sarah', "genre juste « c'est plus drôle ». parfois ça suffit.", ['plusdrole']]], flame: { sarah: 10 }, flags: { toldSarahYes: true } },
    non: { reply: [['sarah', 'ok… je comprends.']] },
    jsp: { reply: [['sarah', "réfléchis-y. genre juste « c'est plus drôle ».", ['plusdrole']]] },
  },
  compil: {
    oui: { reply: [['thomas', 'JE SAVAIS 😂']], flame: { thomas: 12 }, conformity: 1, log: 'Tu as dit à Thomas que sa compil était la meilleure.' },
    non: { reply: [['thomas', "t'es jaloux 🙄"]], flame: { thomas: -10 }, log: "Tu as dit à Thomas que sa compil n'était pas la meilleure." },
    jsp: { reply: [['thomas', '??']] },
  },
  stop: {
    oui: { reply: [['camille', 'merci… 🫶']], flame: { camille: 10 }, flags: { promisedCamille: true }, log: "Tu as promis à Camille de leur dire d'arrêter." },
    non: { reply: [['camille', 'ok.']], flags: { refusedCamille: true }, log: 'Tu as dit non à Camille.' },
    jsp: { reply: [['camille', '…']], log: 'Tu as répondu « jsp » à Camille.' },
  },
};

// Événements. kind : text (défaut) · video · sticker · poll · system · post · unlock · mood
// ask : la question attend oui/non/jsp · eph : message éphémère (s) · teach : mots appris en lisant
// unless / if : flag qui empêche / conditionne l'événement
const BEATS = [
  {
    day: 'Vendredi', clock: '21:10',
    events: [
      { t: 1,    conv: 'camille', from: 'camille', text: "hello ! t'as fait l'exo 4 de maths ? 🙏", ask: 'maths' },
      { t: 8,    conv: 'thomas_dm', from: 'thomas', text: "t'as vu ce que Léa a envoyé ?? 💀", ask: 'seen', teach: ['skull'] },
      { t: 14,   conv: 'team', kind: 'system', text: "Léa t'a ajouté·e à « la team 🦆 »" },
      { t: 15,   conv: 'team', kind: 'system', text: "📸 Léa a fait une capture d'un snap privé de Camille" },
      { t: 16,   conv: 'team', from: 'lea', kind: 'video', label: '🎤 camille_karaoke.mp4' },
      { t: 18,   conv: 'team', from: 'lea', text: "elle m'a dit de la montrer à personne 🤫", teach: ['chut'] },
      { t: 21,   conv: 'team', from: 'thomas', text: 'PTDRRRR LA NOTE DE FIN mdrrr', teach: ['mdr'] },
      { t: 23,   conv: 'team', from: 'ines', text: '😂😂😂', teach: ['lol'] },
      { t: 29,   conv: 'team', from: 'thomas', text: 'elle chante comme un hamster 🐹', teach: ['hamster'] },
      { t: 33,   conv: 'team', from: 'ines', text: 'jsp mdr elle le saura jamais', teach: ['jsp'] },
      { t: 38,   conv: 'team', from: 'lea', text: 'vous dites rien hein 🤐', ask: 'secret' },
    ],
  },
  {
    day: 'Samedi', clock: '15:02',
    events: [
      { t: 1,   conv: 'team', from: 'thomas', kind: 'sticker', text: "j'en ai fait un sticker", teach: ['sticker'] },
      { t: 5,   conv: 'team', from: 'thomas', kind: 'poll', text: 'on le poste sur @memes_college ?', options: ['oui 🔥', 'non'] },
      { t: 8,   conv: 'team', from: 'ines', text: 'OUI 😂' },
      { t: 12,  conv: 'sarah', from: 'sarah', text: "salut… t'as vu le sticker qui tourne sur Camille ?", ask: 'sticker' },
      { t: 16,  conv: 'camille', from: 'camille', text: "c'est vrai que Léa a montré ma vidéo ?? 😶", eph: 22, ask: 'video', mood: 'sad' },
      { t: 22,  conv: 'team', from: 'lea', text: "bon ok mais c'est pas moi qui poste hein", teach: ['ok', 'pasmoi'] },
      { t: 30,  conv: 'team', from: 'thomas', text: "c'est posté 🫡 @memes_college", unless: 'stoppedThomas' },
      { t: 31,  conv: 'memes', kind: 'post', unless: 'stoppedThomas' },
      { t: 40,  conv: 'sarah', from: 'sarah', text: 'tu pourrais dire un truc dans le groupe ?', ask: 'say' },
    ],
  },
  {
    day: 'Lundi', clock: '07:48',
    events: [
      { t: 0.2, kind: 'mood', who: 'camille', mood: 'hood' },
      { t: 1,   conv: 'team', from: 'thomas', kind: 'video', label: '📼 compil_du_weekend.mp4', unless: 'stoppedThomas' },
      { t: 3,   conv: 'team', from: 'thomas', text: 'LA COMPIL 🎤🐹🔥 envoyez à tout le monde', unless: 'stoppedThomas' },
      { t: 3,   conv: 'team', from: 'ines', text: 'le sticker tourne encore sur insta mdr 🐹', if: 'stoppedThomas' },
      { t: 5,   conv: 'team', from: 'ines', text: 'jsuis morte 💀💀', unless: 'stoppedThomas' },
      { t: 8,   conv: 'thomas_dm', from: 'thomas', text: "t'as vu ma compil ? dis-moi que c'est la meilleure 😂", ask: 'compil', unless: 'stoppedThomas' },
      { t: 12,  conv: 'camille', from: 'camille', text: "tout le monde m'envoie le sticker. dis-leur d'arrêter stp. qu'ils suppriment.", eph: 25, ask: 'stop', teach: ['arrete', 'supprime'] },
      { t: 18,  conv: 'sarah', from: 'sarah', text: "si toi tu leur dis, ils t'écouteront. et demande à Camille si ça va.", teach: ['cava'] },
      { t: 30,  conv: 'team', from: 'lea', text: "ça devient un peu trop non ? c'est un peu trop là", teach: ['trop'], unless: 'stoppedThomas' },
      { t: 40,  conv: 'team', from: 'thomas', text: "allez quoi c'est pour rire 🙄", teach: ['pourrire'], unless: 'stoppedThomas' },
    ],
  },
];
