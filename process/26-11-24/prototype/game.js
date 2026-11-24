// ───────────────────────────────────────────────────────────────
// MOTEUR — attention · flammes · vocabulaire · hésitation · avatars
// ───────────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const TICK = 0.1;                 // s
const DECAY_EVERY = 3 * PACE;     // s : une conversation négligée fait baisser la flamme
const DECAY = 3;
const DECAY_BY = { camille: 1 };  // une relation faible s'use plus lentement… mais elle part de bas
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S, loop;

function newState() {
  return {
    beat: -1, t: 0, running: false, ready: false, readyAt: 0, open: null, fired: new Set(),
    flames: { ...START_FLAMES },
    convs: Object.fromEntries(CONVS.map(c => [c.id, { msgs: [], unread: 0, visible: false, lastAt: 0 }])),
    inventory: [...START_INVENTORY], draft: [],
    log: [], flags: {}, conformity: 0, decayAcc: 0, msgId: 0, seq: 0,
    moods: { lea: 'happy', thomas: 'laugh', ines: 'laugh', sarah: 'neutral', camille: 'happy', you: 'neutral' },
    typing: {}, holding: false, flash: {}, holdReact: {}, hesitated: {},
    attention: 0, views: 0, followers: 138, openedToday: new Set(),
    coachDone: {}, coachShown: null, sentOnce: false, learnedOnce: false, justUnlocked: [],
  };
}

// ── utilitaires ────────────────────────────────────────────────
const conv = id => CONVS.find(c => c.id === id);
const beat = () => BEATS[S.beat];
function clock() {
  const [h, m] = beat().clock.split(':').map(Number);
  const tot = h * 60 + m + Math.floor(S.t / (3 * PACE));
  return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}
function log(text, icon = '•') { S.log.push({ day: beat().day, clock: clock(), text, icon }); }
function later(ms, fn) { const b = S.beat; setTimeout(() => { if (S.running && S.beat === b) fn(); }, ms); }
function hasCap(id) {
  if (id === 'you') return S.conformity >= 2 && !S.flags.stoppedThomas;
  return GROUP_CODE.includes(id) && !(id === 'thomas' && S.flags.stoppedThomas);
}
function av(id, size, forceMood) { return avatar(id, forceMood || S.moods[id], size, { cap: hasCap(id) }); }
function flameTier(v) { return v === 0 ? 'out' : v >= LEGIT.stop ? 'xl' : v >= LEGIT.negotiate ? 'l' : v >= 40 ? 'm' : 's'; }
const TIER_WORD = { xl: 'brûlante', l: 'forte', m: 'tiède', s: 'faible', out: 'éteinte' };
function changeFlame(id, d) {
  if (!(id in S.flames) || !d) return;
  const before = S.flames[id];
  S.flames[id] = Math.max(0, before + d);
  S.flash[id] = d < 0 ? 'down' : 'up';
  setTimeout(() => { delete S.flash[id]; renderList(); renderPanel(); }, 700);
  if (id === 'camille' && before > 0 && S.flames[id] === 0 && !S.flags.camilleFlameOut) {
    S.flags.camilleFlameOut = true;
    log("Ta flamme avec Camille s'est éteinte.", '🔥');
  }
}
function pendingAsk(cid) {
  return [...S.convs[cid].msgs].reverse().find(m => m.ask && !m.answered && !m.expired);
}

// ── boucle ─────────────────────────────────────────────────────
function startBeat(i) {
  S.beat = i; S.t = 0; S.fired = new Set(); S.running = true; S.ready = false; S.typing = {};
  S.readyAt = Math.max(...beat().events.map(e => e.t)) * PACE + NEXT_DAY_DELAY;
  S.attention = ATTENTION[i]; S.openedToday = new Set();
  S.views = Math.max(S.views, VIEWS[i].start);
  CONVS.forEach(c => { if (S.convs[c.id].visible && c.type !== 'account') S.convs[c.id].msgs.push({ id: ++S.msgId, kind: 'day', text: `${beat().day} ${beat().clock}` }); });
  $('#overlay').classList.remove('show');
  renderAll();
}

function tick() {
  if (!S.running) return;
  S.t += TICK;
  beat().events.forEach((e, i) => {
    if (S.fired.has(i) || e.t * PACE > S.t) return;
    S.fired.add(i);
    fire(e);
  });

  // la vidéo circule
  if (S.views > 0) S.views += VIEWS[S.beat].rate * TICK * (S.flags.stoppedThomas ? 0.3 : 1);
  if (S.convs.memes.visible) S.followers += TICK * (S.beat + 1) * 0.2;

  // éphémères
  CONVS.forEach(c => S.convs[c.id].msgs.forEach(m => {
    if (m.expiresAt == null || m.expired || S.t < m.expiresAt) return;
    m.expired = true;
    const who = CHARS[m.from].name;
    if (!m.opened) { log(`Le message de ${who} a expiré sans être lu.`, '⏳'); S.flags[`missed_${S.beat}`] = true; }
    else if (!m.replied) { log(`Tu as vu le message de ${who}. Tu n'as pas répondu à temps.`, '👁'); S.flags[`seenNoReply_${S.beat}`] = true; }
    renderConv(); renderList(); renderComposer();
  }));

  // attention : ce qui n'est pas lu s'use (seulement tant que la journée est en cours)
  S.decayAcc += TICK;
  if (S.decayAcc >= DECAY_EVERY && !S.ready) {
    S.decayAcc = 0;
    CONVS.forEach(c => {
      if (!S.convs[c.id].unread || S.open === c.id || c.type === 'account') return;
      if (c.type === 'group') c.members.forEach(m => changeFlame(m, -DECAY));
      else changeFlame(c.with, -(DECAY_BY[c.with] ?? DECAY));
    });
  }

  if (!S.ready && S.t >= S.readyAt) {
    S.ready = true; renderNext();
    toast('Tu peux passer au jour suivant quand tu veux');
  }
  renderStatus(); renderLive(); renderCoach();
}

function fire(e) {
  if (e.unless && S.flags[e.unless]) return;
  if (e.if && !S.flags[e.if]) return;
  if (e.mood) S.moods[e.who || e.from] = e.mood;
  if (e.kind === 'mood') { renderAll(); return; }
  if (e.kind === 'unlock') { unlock(e.fragments, e.text); return; }
  addMsg(e.conv, { from: e.from, kind: e.kind || 'text', text: e.text, label: e.label, options: e.options,
    eph: e.eph && e.eph * PACE, ask: e.ask, teach: e.teach });
}

function addMsg(convId, m) {
  m.id = ++S.msgId;
  if (m.eph) m.expiresAt = S.t + m.eph;
  const c = S.convs[convId];
  const isNew = !c.visible;
  c.visible = true; c.lastAt = ++S.seq;
  c.msgs.push(m);
  const viewing = S.open === convId;
  if (viewing) readMsg(m);
  else if (m.from !== 'you' && m.kind !== 'day') { c.unread++; if (m.from || m.kind === 'post' || isNew) notify(convId, m, isNew); }
  renderList(); if (viewing) { renderConv(); renderComposer(); }
}

function readMsg(m) {
  if (m.expiresAt != null && !m.expired && !m.opened) m.opened = true;
  if (m.teach && !m.taught) {
    m.taught = true;
    const fresh = m.teach.filter(k => !S.inventory.includes(k));
    m.learned = fresh;
    if (fresh.length) later(700, () => { S.learnedOnce = true; unlock(fresh, `Tu as appris « ${fresh.map(k => FRAGMENTS[k].label).join(' », « ')} » (${CHARS[m.from].name})`); renderConv(); });
  }
}

function unlock(ids, text) {
  const fresh = ids.filter(id => !S.inventory.includes(id));
  if (!fresh.length) return;
  S.inventory.push(...fresh);
  S.justUnlocked = fresh;
  setTimeout(() => { S.justUnlocked = []; renderComposer(); }, 2500);
  toast(text || `Nouveaux mots : ${fresh.map(id => FRAGMENTS[id].label).join(' · ')}`);
  renderComposer(); renderPanel();
}

function endBeat() {
  if (!S.running) return;
  $('#coach').classList.remove('show');
  S.running = false; S.ready = false; renderNext();
  if (S.holding) cancelHold(true);
  if (S.beat < BEATS.length - 1) {
    const n = BEATS[S.beat + 1];
    showOverlay(`<div class="day">${n.day}</div><div class="time">${n.clock}</div><div class="batt">👁 tu pourras suivre ${ATTENTION[S.beat + 1]} conversations</div>`);
    closeConv();
    setTimeout(() => startBeat(S.beat + 1), 2400);
  } else {
    showOverlay(`<div class="day">…</div>`);
    setTimeout(showMemories, 1600);
  }
}

// ── navigation (l'attention se dépense en ouvrant) ─────────────
function openConv(id) {
  if (!S.running || S.open === id) return;
  if (!S.openedToday.has(id)) {
    if (S.attention <= 0) { toast(`Tu suis déjà ${ATTENTION[S.beat]} conversations aujourd'hui`); flashEyes(); return; }
    S.attention--; S.openedToday.add(id);
    toast(S.attention === 0 ? 'Tu ne pourras plus suivre de nouvelle conversation aujourd\'hui' : `👁 Tu suis cette conversation · encore ${S.attention} possible${S.attention > 1 ? 's' : ''} aujourd'hui`);
  }
  S.open = id;
  const c = S.convs[id];
  c.unread = 0;
  c.msgs.forEach(readMsg);
  S.draft = [];
  $('#phone').classList.add('in-conv');
  renderAll();
}
function closeConv() { S.open = null; S.draft = []; $('#phone').classList.remove('in-conv'); renderAll(); }

// ── réponses des personnages : ils écrivent, puis envoient ─────
function replies(cid, list, done, start = REPLY_DELAY) {
  let t = start;
  list.forEach(([from, text, teach], i) => {
    const dur = 1300 + text.length * 45;
    later(t, () => { S.typing[cid] = from; renderConv(); renderList(); });
    later(t + dur, () => {
      delete S.typing[cid];
      addMsg(cid, { from, kind: 'text', text, teach });
      if (i === list.length - 1 && done) done();
    });
    t += dur + 1100;
  });
  if (!list.length && done) later(start, done);
}
function systemLater(cid, text, ms) { later(ms, () => addMsg(cid, { kind: 'system', text })); }

// ── envoyer ────────────────────────────────────────────────────
function send() {
  const id = S.open, frags = S.draft.map(k => ({ key: k, ...FRAGMENTS[k] }));
  if (!id || !frags.length) return;
  S.draft = []; S.sentOnce = true;
  addMsg(id, { from: 'you', kind: 'frags', frags });
  S.convs[id].msgs.forEach(m => { if (m.expiresAt != null && !m.expired && m.from !== 'you') m.replied = true; });
  const tones = new Set(frags.map(f => f.tone));
  S.moods.you = tones.has('oppose') ? 'stop' : tones.has('join') ? 'laugh' : 'neutral';
  const answer = frags.find(f => f.tone === 'answer'), ask = pendingAsk(id);
  if (answer && ask) answerAsk(id, ask, answer.value, frags);
  else respond(id, frags);
  renderAll();
}

function answerAsk(cid, ask, value, frags) {
  ask.answered = value;
  const r = ANSWERS[ask.ask]?.[value] || {};
  const laughs = frags.some(f => f.tone === 'join');
  if (cid === 'camille' && laughs) {
    // « oui 😂 » à Camille : la réponse blesse, quelle qu'elle soit
    S.flags.mockedCamille = true; S.moods.camille = 'hood';
    replies(cid, [['camille', '…tu trouves ça drôle ?']]);
    log(`Tu as répondu « ${frags.map(f => f.label).join(' ')} » à Camille.`, '😂');
    return;
  }
  Object.entries(r.flame || {}).forEach(([k, d]) => changeFlame(k, d));
  Object.assign(S.flags, r.flags || {});
  S.conformity += r.conformity || 0;
  if (r.log) log(r.log, '💬');
  replies(cid, r.reply || []);
}

function toneOf(frags) {
  const has = t => frags.some(f => f.tone === t);
  if (has('oppose') && has('join')) return 'ambiguous';
  if (has('support') && has('join')) return 'hurt';
  if (has('oppose')) return 'oppose';
  if (has('support')) return 'support';
  if (has('join')) return 'join';
  if (has('dodge')) return 'dodge';
  return 'neutral';
}

function respond(id, frags) {
  const tone = toneOf(frags), said = frags.map(f => f.label).join(' ');
  const c = conv(id), pub = id === 'team';

  if (id === 'team' || id === 'thomas_dm') {
    if (tone === 'oppose') return opposeThomas(pub, said);
    if (tone === 'ambiguous') {
      replies(id, [['thomas', 'mdr même toi tu rigoles 😂']]);
      log(`Tu as écrit « ${said} ». Personne ne l'a pris au sérieux.`, '🙃');
      return;
    }
    if (tone === 'join') {
      S.conformity++;
      replies(id, pub ? [['thomas', '😂😂😂'], ['ines', '🔥']] : [['thomas', 'JE SAVAIS 😂']]);
      (pub ? ['thomas', 'lea', 'ines'] : ['thomas']).forEach(m => changeFlame(m, 12));
      if (frags.some(f => f.kind === 'sticker')) { S.flags.sharedSticker = true; log(`Tu as renvoyé le sticker 🐹🎤 dans « ${c.title} ».`, '🐹'); }
      else log(`Tu as réagi « ${said} » dans « ${c.title} ».`, '😂');
      return;
    }
    if (tone === 'dodge') {
      replies(id, [['thomas', "personne a dit que c'était toi 😂"]]);
      log(`Tu as écrit « ${said} » dans « ${c.title} ».`, '🙈');
      return;
    }
    if (tone === 'support' || tone === 'hurt') {
      replies(id, [[pub ? 'lea' : 'thomas', pub ? "t'es là pour qui ? 😅" : 'hein ? 😅']]);
      log(`Tu as écrit « ${said} » dans « ${c.title} ».`, '💬');
      return;
    }
    return replies(id, [[pub ? 'ines' : 'thomas', '??']]);
  }

  if (id === 'camille') {
    if (tone === 'support') {
      S.flags[`supported_${S.beat}`] = true; S.flags.supported = true;
      replies(id, [['camille', S.beat === 0 ? '?? 😅' : 'merci… 🫶']]);
      changeFlame('camille', 20);
      log(`Tu as écrit « ${said} » à Camille.`, '🫶');
    } else if (tone === 'oppose') {
      replies(id, [['camille', "c'est à eux qu'il faut le dire…"]]);
      log(`Tu as écrit « ${said} » à Camille.`, '💬');
    } else if (tone === 'dodge') {
      S.flags.dodged = true;
      replies(id, [['camille', "j'ai pas dit que c'était toi."]]);
      log(`Tu as répondu « ${said} » à Camille.`, '🙈');
    } else if (tone === 'neutral') {
      replies(id, [['camille', '…ok']]);
    } else if (tone === 'join' || tone === 'hurt' || tone === 'ambiguous') {
      S.flags.mockedCamille = true; S.moods.camille = S.beat === 0 ? 'neutral' : 'hood';
      replies(id, [['camille', tone === 'hurt' ? '…tu te moques de moi ?' : '…']]);
      log(`Tu as envoyé « ${said} » à Camille.`, '😂');
    }
    return;
  }

  if (id === 'sarah') {
    if (tone === 'join' || tone === 'hurt' || tone === 'ambiguous') { replies(id, [['sarah', 'sérieux ?']]); changeFlame('sarah', -5); }
    else if (tone === 'dodge' || tone === 'neutral') { replies(id, [['sarah', "c'est pas la question…"]]); }
    else { replies(id, [['sarah', "merci. faut juste que quelqu'un le dise au groupe."]]); changeFlame('sarah', 10); }
  }
}

// Paliers : arrêter · négocier (Léa peut faire basculer) · se moquer
function opposeThomas(pub, said) {
  const id = pub ? 'team' : 'thomas_dm';
  const where = pub ? 'devant tout le groupe' : 'en privé';
  if (S.flags.stoppedThomas) { replies(id, [['thomas', "c bon j'ai arrêté 🙄"]]); return; }
  const f = S.flames.thomas;
  const stop = (lines, cost, why) => {
    S.flags.stoppedThomas = true;   // tout de suite : même si on passe au jour suivant avant la fin des réponses
    replies(id, lines, () => {
      S.moods.thomas = 'turned';
      addMsg(id, { kind: 'system', text: '🗑 Thomas a supprimé un média' });
      renderAll();
    });
    changeFlame('thomas', cost); if (pub) changeFlame('ines', -20);
    log(`Tu as écrit « ${said} » à Thomas ${where}. ${why}`, '✋');
  };
  if (f >= LEGIT.stop) {
    stop([['thomas', pub ? "…ok ok 🙄 c'était pour rire" : "…ok. je l'enlève. mais c'était drôle hein"]].concat(pub ? [['lea', "ouais c'est mieux"]] : []),
      pub ? -60 : -40, 'Il a arrêté.');
  } else if (f >= LEGIT.negotiate) {
    if (pub && S.flames.lea >= LEA_ALLY) {
      stop([['thomas', 'ok mais je la laisse dans le groupe 🙄'], ['lea', 'non mais supprime, c\'est bon'], ['thomas', '…ok ok 🙄']],
        -45, 'Léa t\'a soutenu·e. Thomas a arrêté.');
      S.flags.leaAlly = true;
    } else {
      replies(id, [['thomas', pub ? "ok mais je la laisse dans le groupe, pas ailleurs 🙄" : "ok… je la poste plus. mais je la garde"]]);
      S.flags.thomasNegotiated = true;
      changeFlame('thomas', pub ? -35 : -25);
      log(`Tu as écrit « ${said} » à Thomas ${where}. Il a négocié : la vidéo reste.`, '✋');
    }
  } else {
    replies(id, [['thomas', "t'es qui toi 💀"]].concat(pub ? [['ines', '😂😂']] : []));
    changeFlame('thomas', -25);
    log(`Tu as écrit « ${said} » à Thomas ${where}. Il s'est moqué de toi : votre flamme était trop faible.`, '✋');
  }
}

function vote(msgId, option) {
  const m = S.convs.team.msgs.find(x => x.id === msgId);
  if (!m || m.voted != null || !S.running) return;
  m.voted = option;
  if (option === 0) { S.conformity++; S.flags.votedYes = true; changeFlame('thomas', 10); replies('team', [['thomas', '🔥🔥']]); log('Tu as voté « oui » pour poster le sticker.', '🗳'); }
  else { S.flags.votedNo = true; changeFlame('thomas', -10); replies('team', [['thomas', 'boooh 🙄']]); log('Tu as voté « non » au sondage.', '🗳'); }
  renderConv();
}

// ── hésitation : plus c'est difficile à dire, plus il faut maintenir ──
function holdTime() {
  const frags = S.draft.map(k => FRAGMENTS[k]);
  const pub = conv(S.open).type === 'group';
  const has = t => frags.some(f => f.tone === t);
  if (frags.every(f => f.tone === 'join')) return 0;   // suivre le groupe : immédiat
  if (has('oppose')) return pub ? 3200 : 1500;
  if (has('support')) return pub ? 2000 : 1200;
  return 600;                                           // oui / non / jsp
}
let holdStart = 0, holdRaf = null, holdNeed = 0;
function startHold(ev) {
  ev.preventDefault();
  if (!S.running || !S.open) return;
  if (!S.draft.length) { $('#send').classList.add('shake'); setTimeout(() => $('#send').classList.remove('shake'), 400); return; }
  holdNeed = holdTime();
  if (holdNeed === 0) { send(); return; }
  S.holding = true; holdStart = performance.now();
  renderSeen();
  const step = now => {
    if (!S.holding) return;
    const el = now - holdStart, p = Math.min(1, el / holdNeed);
    $('#send').style.setProperty('--p', p);
    if (S.open === 'team' && holdNeed >= 1500) {
      if (el > 800 && !S.holdReact[`${S.beat}a`]) { S.holdReact[`${S.beat}a`] = true; addMsg('team', { from: 'ines', text: '👀' }); }
      if (el > 2000 && !S.holdReact[`${S.beat}b`]) { S.holdReact[`${S.beat}b`] = true; addMsg('team', { from: 'thomas', text: 'tu vas dire quoi ? 😂' }); }
    }
    if (p >= 1) { endHold(); send(); return; }
    holdRaf = requestAnimationFrame(step);
  };
  holdRaf = requestAnimationFrame(step);
}
function endHold() {
  S.holding = false; cancelAnimationFrame(holdRaf);
  $('#send').style.setProperty('--p', 0);
  renderSeen();
}
function cancelHold(silent) {
  if (!S.holding) return;
  const elapsed = performance.now() - holdStart;
  endHold();
  if (silent || elapsed < 300) return;
  const key = `${S.beat}_${S.open}`;
  if (!S.hesitated[key]) {
    S.hesitated[key] = true; S.flags.hesitated = true;
    log(`Tu as commencé à écrire « ${S.draft.map(k => FRAGMENTS[k].label).join(' ')} » dans « ${conv(S.open).title} », puis tu as lâché.`, '…');
  }
  if (S.open === 'team') replies('team', [['ines', 'bon ? 😭']], null, 1200);
}

// ── composer : pas de mots contradictoires ─────────────────────
function pick(k) {
  if (S.draft.includes(k)) return;
  const f = FRAGMENTS[k];
  // une seule réponse à la fois : « oui » remplace « non »
  const clash = S.draft.findIndex(x => FRAGMENTS[x].tone === 'answer' && f.tone === 'answer');
  if (clash >= 0) { S.draft[clash] = k; renderComposer(); return; }
  if (S.draft.length >= 2) { $('#draft').classList.add('shake'); setTimeout(() => $('#draft').classList.remove('shake'), 400); toast('Deux mots maximum'); return; }
  S.draft.push(k); renderComposer();
}
function flashEyes() { const e = document.querySelector('.eyes'); if (e) { e.classList.add('shake'); setTimeout(() => e.classList.remove('shake'), 400); } }

// ── guidage du premier jour ────────────────────────────────────
const COACH = [
  { id: 'open',   where: 'list', when: () => S.beat === 0 && !S.open && S.convs.camille.visible && !S.openedToday.has('camille'),
    text: '👆 Camille t\'écrit. Touche sa conversation pour l\'ouvrir.' },
  { id: 'answer', where: 'conv', when: () => S.open === 'camille' && S.beat === 0 && !S.draft.length && !S.sentOnce && pendingAsk('camille'),
    text: '👇 Elle te pose une question. Choisis un mot en bas : <b>oui</b> ou <b>non</b>.' },
  { id: 'hold',   where: 'conv', when: () => S.open && S.draft.length && holdTime() > 0 && !S.sentOnce,
    text: '👉 <b>Maintiens</b> ➤ jusqu\'à ce que le cercle soit plein.' },
  { id: 'back',   where: 'conv', when: () => S.beat === 0 && S.open === 'camille' && S.sentOnce,
    text: '👈 Reviens à la liste avec ‹ en haut à gauche.' },
  { id: 'eyes',   where: 'list', when: () => S.beat === 0 && !S.open && S.openedToday.size >= 1, timed: 7000,
    text: '👁 En haut à droite : le nombre de conversations que tu peux <b>suivre</b> aujourd\'hui. Tu ne pourras pas tout suivre : choisis où tu regardes.' },
  { id: 'learn',  where: 'conv', when: () => S.learnedOnce && S.open, timed: 7000,
    text: '✨ Tu as appris un mot en le lisant. Tes mots viennent de ce que les autres te disent : <span class="frag mini toi">toi</span> <span class="frag mini groupe">groupe</span> <span class="frag mini appris">appris</span>' },
  { id: 'harder', where: 'conv', when: () => S.open && S.draft.some(k => ['oppose', 'support'].includes(FRAGMENTS[k].tone)), timed: 6000,
    text: '⏳ Certains mots sont plus difficiles à dire : il faut maintenir plus longtemps, surtout devant le groupe.' },
];
function renderCoach() {
  if (!S || S.beat < 0 || !S.running) { $('#coach').classList.remove('show'); return; }
  const cur = S.coachShown && COACH.find(c => c.id === S.coachShown);
  if (cur && !cur.timed && !cur.when()) { S.coachDone[cur.id] = true; S.coachShown = null; }
  if (cur && cur.timed && S.coachDone[cur.id]) S.coachShown = null;
  const step = COACH.find(c => !S.coachDone[c.id] && c.when());
  const el = $('#coach');
  if (!step) { el.classList.remove('show'); S.coachShown = null; return; }
  if (S.coachShown !== step.id) {
    S.coachShown = step.id;
    el.innerHTML = step.text;
    if (step.timed) { const id = step.id; setTimeout(() => { S.coachDone[id] = true; renderCoach(); }, step.timed); }
  }
  el.className = `coach show ${step.where}`;
}

// ── rendu ──────────────────────────────────────────────────────
function renderAll() { renderCoach(); renderNext(); renderStatus(); renderList(); renderConv(); renderComposer(); renderPanel(); }

function renderStatus() {
  if (S.beat < 0) return;
  const total = ATTENTION[S.beat];
  const eyes = Array.from({ length: total }, (_, i) => `<i class="${i < S.attention ? 'on' : ''}">👁</i>`).join('');
  $('#status').innerHTML = `<span>${beat().day}</span><b>${clock()}</b><span class="eyes ${S.attention === 0 ? 'empty' : ''}" title="conversations que tu peux encore suivre aujourd'hui">${eyes}</span>`;
}

function flameTag(id) {
  const tier = flameTier(S.flames[id]);
  return `<span class="flame t-${tier} ${S.flash[id] || ''}" title="flamme ${TIER_WORD[tier]}">🔥</span>`;
}

const fmt = n => Math.floor(n).toLocaleString('fr-CH');
function preview(cid, m) {
  if (S.typing[cid]) return `<span class="eph">${CHARS[S.typing[cid]].name} écrit…</span>`;
  if (!m) return '';
  if (m.expiresAt != null) return m.expired ? '<i>⏳ message expiré</i>' : `<span class="eph">📩 message éphémère</span>`;
  if (m.kind === 'video') return '🎬 vidéo';
  if (m.kind === 'sticker') return '🐹 sticker';
  if (m.kind === 'poll') return '🗳 sondage';
  if (m.kind === 'post') return `nouvelle publication · <span class="followers">${fmt(S.followers)}</span> abonnés`;
  if (m.kind === 'frags') return 'toi : ' + esc(m.frags.map(f => f.label).join(' '));
  if (m.kind === 'system') return `<i>${esc(m.text)}</i>`;
  return (m.from ? CHARS[m.from].name + ' : ' : '') + esc(m.text || '');
}

function accountPic(size) {
  return `<svg class="av" viewBox="0 0 100 100" width="${size}" height="${size}"><circle cx="50" cy="50" r="40" fill="#2b2b2b"/><text x="50" y="64" text-anchor="middle" font-size="40">🙈</text></svg>`;
}

function renderList() {
  if (S.beat < 0) return;
  const empty = S.attention <= 0;
  $('#listinfo').innerHTML = S.attention > 0
    ? `👁 Tu peux suivre encore <b>${S.attention}</b> nouvelle${S.attention > 1 ? 's' : ''} conversation${S.attention > 1 ? 's' : ''} aujourd'hui`
    : `👁 Tu ne peux plus suivre de nouvelle conversation aujourd'hui`;
  const rows = CONVS.filter(c => S.convs[c.id].visible).sort((a, b) => S.convs[b.id].lastAt - S.convs[a.id].lastAt);
  $('#list').innerHTML = rows.map(c => {
    const st = S.convs[c.id];
    const last = [...st.msgs].reverse().find(m => m.kind !== 'day');
    const pic = c.type === 'group' ? `<div class="stack">${c.members.map(m => avatar(m, 'plain', 26)).join('')}</div>`
      : c.type === 'account' ? accountPic(44) : avatar(c.with, 'plain', 44);
    const eph = last && last.expiresAt != null && !last.expired ? `<span class="ring" data-id="${last.id}"></span>` : '';
    const flames = c.type === 'group' ? c.members.map(m => `<span><small>${CHARS[m].name[0]}</small>${flameTag(m)}</span>`).join('')
      : c.type === 'account' ? '' : flameTag(c.with);
    return `<button class="row ${st.unread ? 'unread' : ''} ${empty && !S.openedToday.has(c.id) ? 'locked' : ''} ${S.openedToday.has(c.id) ? 'followed' : ''}" data-open="${c.id}">
      <div class="pic">${pic}${eph}</div>
      <div class="meta"><div class="title">${esc(c.title)} ${st.unread ? `<span class="badge">${st.unread}</span>` : ''}</div>
      <div class="prev">${last ? preview(c.id, last) : ''}</div></div>
      <div class="flames">${flames}</div></button>`;
  }).join('') || '<p class="emptylist">…</p>';
}

function renderMsg(m, c) {
  if (m.kind === 'day') return `<div class="dayline">${esc(m.text)}</div>`;
  if (m.kind === 'system') return `<div class="sys">${esc(m.text)}</div>`;
  const mine = m.from === 'you';
  let body;
  if (m.expiresAt != null && m.expired) body = `<div class="bubble expired">⏳ message expiré</div>`;
  else if (m.kind === 'video') body = `<div class="bubble media">▶︎ ${esc(m.label)}<span class="views">👁 <b class="viewcount">${fmt(S.views)}</b> vues</span></div>`;
  else if (m.kind === 'sticker') body = `${m.text ? `<div class="bubble">${esc(m.text)}</div>` : ''}<div class="sticker">🐹🎤</div>`;
  else if (m.kind === 'poll') {
    const votes = m.voted != null ? [2 + (m.voted === 0), m.voted === 1 ? 1 : 0] : null;
    body = `<div class="bubble poll"><b>${esc(m.text)}</b>${m.options.map((o, i) =>
      `<button class="opt ${m.voted === i ? 'on' : ''}" data-vote="${m.id}" data-opt="${i}" ${m.voted != null ? 'disabled' : ''}>${esc(o)}${votes ? ` <span>${votes[i]}</span>` : ''}</button>`).join('')}
      ${m.voted == null ? '<small>Thomas et Inès ont voté</small>' : ''}</div>`;
  }
  else if (m.kind === 'frags') {
    const words = m.frags.filter(f => f.kind !== 'sticker').map(f => f.label).join(' ');
    body = (words ? `<div class="bubble">${esc(words)}</div>` : '') + (m.frags.some(f => f.kind === 'sticker') ? `<div class="sticker">🐹🎤</div>` : '');
  }
  else body = `<div class="bubble ${m.expiresAt != null ? 'ephb' : ''}">${highlight(m)}${m.expiresAt != null ? `<span class="ring" data-id="${m.id}"></span>` : ''}</div>`;
  if (m.learned && m.learned.length && !(m.expiresAt != null && m.expired)) body += `<div class="learned">${m.learned.map(k => `<span class="frag mini ${FRAGMENTS[k].origin}">+ ${esc(FRAGMENTS[k].label)}</span>`).join(' ')}</div>`;
  const who = !mine && c.type === 'group' ? `<div class="who">${CHARS[m.from].name}</div>` : '';
  return `<div class="msg ${mine ? 'mine' : ''}">${!mine ? av(m.from, 30) : ''}<div>${who}${body}</div></div>`;
}

// les mots qu'on peut apprendre sont surlignés dans le message
function highlight(m) {
  let html = esc(m.text);
  (m.teach || []).forEach(k => {
    const l = esc(FRAGMENTS[k].label);
    const i = html.toLowerCase().indexOf(l.toLowerCase());
    if (i >= 0) html = html.slice(0, i) + `<mark class="${FRAGMENTS[k].origin}">${html.slice(i, i + l.length)}</mark>` + html.slice(i + l.length);
  });
  return html;
}

function renderConv() {
  if (!S.open) return;
  const c = conv(S.open), st = S.convs[S.open];
  $('#phone').classList.toggle('account', c.type === 'account');
  if (c.type === 'account') {
    $('#convhead').innerHTML = `<button id="back" aria-label="Retour">‹</button>${accountPic(52)}<div><b>${esc(c.title)}</b><small>compte privé</small></div>`;
    $('#msgs').innerHTML = `<div class="profile">${accountPic(110)}
      <h3>${esc(c.title)}</h3><p class="stats"><b>${S.flags.stoppedThomas ? 37 : 38}</b> publications · <b class="followers">${fmt(S.followers)}</b> abonnés</p>
      <p>DM si t'as un meme à proposer 👀</p><div class="locked">🔒 Ce compte est privé</div>
      <p class="legend">Tu ne vois pas ce qui y est posté. Mais tout le monde sait ce qui y est.</p></div>`;
    $('#seen').innerHTML = '';
    return;
  }
  const head = c.type === 'group'
    ? `<div class="stack big">${c.members.map(m => av(m, 34)).join('')}</div><div><b>${esc(c.title)}</b><small>${c.members.map(m => CHARS[m].name).join(', ')}, toi</small></div>`
    : `<div class="headav">${av(c.with, 52)}</div><div><b>${esc(c.title)}</b><small>${flameTag(c.with)}</small></div>`;
  $('#convhead').innerHTML = `<button id="back" aria-label="Retour">‹</button>${head}`;
  const box = $('#msgs');
  const typing = S.typing[S.open] ? `<div class="msg typingmsg">${av(S.typing[S.open], 30)}<div>${c.type === 'group' ? `<div class="who">${CHARS[S.typing[S.open]].name}</div>` : ''}<div class="bubble dots"><i></i><i></i><i></i></div></div></div>` : '';
  box.innerHTML = st.msgs.map(m => renderMsg(m, c)).join('') + typing;
  box.scrollTop = box.scrollHeight;
  renderSeen();
}

function renderSeen() {
  if (!S.open || conv(S.open).type === 'account') return;
  const c = conv(S.open);
  const people = c.type === 'group' ? c.members : [c.with];
  $('#seen').innerHTML = `<span>Vu par</span>${people.map(p => `<span class="seenav">${av(p, 24)}</span>`).join('')}
    <span class="seenav me ${S.holding ? 'writing' : ''}">${av('you', 24)}${S.holding ? '<em>…</em>' : ''}</span>
    ${S.holding ? `<span class="hint">${c.type === 'group' ? 'ils voient que tu écris' : 'en train d\'écrire…'}</span>` : ''}`;
}

function renderComposer() {
  if (!S.open || conv(S.open).type === 'account') return;
  const ask = pendingAsk(S.open);
  const need = S.draft.length ? holdTime() : 0;
  $('#draft').innerHTML = (S.draft.length
    ? S.draft.map((k, i) => `<button class="frag ${FRAGMENTS[k].origin} in" data-unpick="${i}">${esc(FRAGMENTS[k].label)}</button>`).join('')
    : `<span class="placeholder">${ask ? 'on attend ta réponse…' : 'compose avec tes mots ↓'}</span>`)
    + (S.draft.length ? `<span class="holdhint">${need === 0 ? 'touche pour envoyer' : `maintiens ${(need / 1000).toFixed(1).replace('.0', '')} s`}</span>` : '');
  const ORDER = { toi: 0, groupe: 1, appris: 2 };
  $('#chips').innerHTML = [...S.inventory].sort((a, b) => ORDER[FRAGMENTS[a].origin] - ORDER[FRAGMENTS[b].origin]).map(k => {
    const f = FRAGMENTS[k];
    const off = f.tone === 'answer' && !ask;
    const title = f.from ? `appris de ${CHARS[f.from].name}` : f.origin === 'groupe' ? 'mot du groupe' : 'tes mots';
    return `<button class="frag ${f.origin} ${off ? 'off' : ''} ${(S.justUnlocked || []).includes(k) ? 'new' : ''}" data-pick="${k}" ${off ? 'disabled' : ''} title="${title}">${esc(f.label)}${f.from ? `<sup>${CHARS[f.from].name[0]}</sup>` : ''}</button>`;
  }).join('');
}

// éléments qui bougent sans tout redessiner
function renderLive() {
  document.querySelectorAll('.ring[data-id]').forEach(r => {
    const m = Object.values(S.convs).flatMap(c => c.msgs).find(x => x.id == r.dataset.id);
    if (m && m.expiresAt != null) r.style.setProperty('--left', Math.max(0, (m.expiresAt - S.t) / m.eph));
  });
  document.querySelectorAll('.viewcount').forEach(v => v.textContent = fmt(S.views));
  document.querySelectorAll('.followers').forEach(v => v.textContent = fmt(S.followers));
}

function renderPanel() {
  if (S.beat < 0) return;
  const max = 260;
  $('#state').innerHTML = `
    <h3>Flammes (cachées au joueur)</h3>
    ${Object.keys(S.flames).map(id => `<div class="bar"><span>${CHARS[id].name}</span>
      <div><i style="width:${Math.min(100, S.flames[id] / max * 100)}%"></i>${id === 'thomas' ? `<u style="left:${LEGIT.negotiate / max * 100}%"></u><u class="hi" style="left:${LEGIT.stop / max * 100}%"></u>` : ''}${id === 'lea' ? `<u class="ally" style="left:${LEA_ALLY / max * 100}%"></u>` : ''}</div><b>${S.flames[id]}</b></div>`).join('')}
    <p class="legend">Thomas : il négocie au-dessus de ${LEGIT.negotiate}, il arrête au-dessus de ${LEGIT.stop}. Léa : elle te soutient au-dessus de ${LEA_ALLY}.</p>
    <h3>Vocabulaire</h3><p>${S.inventory.map(k => `<span class="frag mini ${FRAGMENTS[k].origin}">${esc(FRAGMENTS[k].label)}</span>`).join(' ')}</p>
    <h3>Conformité</h3><p>${S.conformity} ${hasCap('you') ? '— ton avatar porte la casquette du groupe 🧢' : ''}</p>
    <h3>Attention</h3><p>${S.attention} / ${ATTENTION[S.beat]} conversations encore suivables · suivies : ${[...S.openedToday].map(id => conv(id).title).join(', ') || '—'}</p>
    <h3>Traces</h3><p>${S.log.length} souvenir(s)</p>`;
}

function renderNext() {
  const btn = $('#next');
  if (!S || !S.ready) { btn.classList.remove('show'); return; }
  const n = BEATS[S.beat + 1];
  btn.innerHTML = n ? `Passer à ${n.day.toLowerCase()} →` : 'Terminer →';
  btn.classList.add('show');
}

// ── notifications ──────────────────────────────────────────────
let notifTimer;
function notify(convId, m, isNew) {
  const n = $('#notif'), c = conv(convId);
  const pic = c.type === 'account' ? accountPic(28) : avatar(m.from || (c.type === 'group' ? c.members[0] : c.with), 'plain', 28);
  const text = isNew && c.type === 'group' ? "t'a ajouté·e au groupe" : isNew && c.type === 'account' ? 'nouveau compte : nouvelle publication'
    : m.expiresAt != null ? '📩 message éphémère' : m.kind === 'text' ? esc(m.text) : preview(convId, m);
  n.innerHTML = `${pic}<div><b>${esc(c.title)}</b><span>${text}</span></div>`;
  n.dataset.open = convId;
  n.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => n.classList.remove('show'), 2800);
}
let toastTimer;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function showOverlay(html) { $('#overlay').innerHTML = html; $('#overlay').classList.add('show'); }

// ── fin : Souvenirs, puis le téléphone de Camille ──────────────
function showMemories() {
  $('#overlay').classList.remove('show');
  $('#notif').classList.remove('show'); $('#toast').classList.remove('show');
  const days = [...new Set(S.log.map(l => l.day))];
  const flames = Object.keys(START_FLAMES).map(id =>
    `<li>${avatar(id, 'plain', 22)} ${CHARS[id].name} <b>${TIER_WORD[flameTier(START_FLAMES[id])]} → ${TIER_WORD[flameTier(S.flames[id])]}</b></li>`).join('');
  $('#end').innerHTML = `
    <div class="endhead">${av('you', 64)}<div><h2>Souvenirs</h2><small>ce que ton téléphone a gardé</small></div></div>
    ${S.log.length ? days.map(d => `<h4>${d}</h4>${S.log.filter(l => l.day === d).map(l =>
      `<div class="mem"><span class="ic">${l.icon}</span><div><small>${l.clock}</small><p>${esc(l.text)}</p></div></div>`).join('')}`).join('')
      : '<div class="mem"><span class="ic">·</span><p>Tu n\'as rien envoyé. Ton téléphone n\'a gardé que des « Vu ».</p></div>'}
    <h4>La vidéo</h4><div class="mem"><span class="ic">👁</span><p>Vue ${fmt(S.views)} fois.</p></div>
    <h4>Flammes</h4><ul class="fl">${flames}</ul>
    <button class="cta" id="toCamille">Voir depuis le téléphone de Camille →</button>`;
  $('#phone').className = 'phone ending';
  $('#end').scrollTop = 0;
}

function showCamille() {
  const F = S.flags, notes = [];
  notes.push(['Vendredi', "J'ai envoyé la vidéo qu'à Léa. Juste à elle."]);
  if (S.log.some(l => l.day === 'Vendredi' && l.icon === '😂')) notes.push(['Samedi', "Quelqu'un m'a montré des captures du groupe. Il y avait ta réaction dessous."]);
  else notes.push(['Samedi', 'Je ne sais pas qui a vu. Tout le monde, sûrement.']);
  if (F.promisedSecret) notes.push(['Samedi', 'Léa a dit que tout le monde avait promis de ne rien dire. Toi aussi.']);
  if (F.toldTruth) notes.push(['Samedi', "Tu m'as dit la vérité. C'est la seule personne qui l'a fait."]);
  else if (F.lied) notes.push(['Samedi', "Tu m'as dit que non. J'ai appris le soir même que c'était faux."]);
  else if (F.evasive) notes.push(['Samedi', 'Tu m\'as répondu « jsp ». Tout le monde savait.']);
  else if (F.seenNoReply_1) notes.push(['Samedi', 'Tu as ouvert mon message. « Vu ». Rien.']);
  else if (F.missed_1) notes.push(['Samedi', "Je t'ai écrit. Mon message a disparu. Je ne sais même pas si tu l'as lu."]);
  if (F.votedYes) notes.push(['Samedi', 'Il y avait un sondage pour me poster. Je sais qui a voté.']);
  if (F.sharedSticker) notes.push(['Dimanche', "Le sticker. Je l'ai reçu je sais pas combien de fois. Une fois, ça venait de toi."]);
  if (F.mockedCamille) notes.push(['Dimanche', "Tu m'as envoyé quelque chose qui riait. Je n'ai pas su quoi répondre."]);
  if (F.supported_1 || F.supported_2) notes.push([F.supported_2 ? 'Lundi' : 'Samedi', "Tu m'as écrit. Je n'ai pas répondu tout de suite, mais je l'ai lu."]);
  if (F.stoppedThomas) notes.push(['Lundi', F.leaAlly ? 'Léa a fini par dire stop, elle aussi. Ça a suffi.' : "Quelqu'un a dit stop. La vidéo a arrêté de tourner dans le groupe."]);
  else if (F.thomasNegotiated) notes.push(['Lundi', "Ils ont arrêté de la poster. Mais ils l'ont gardée."]);
  else notes.push(['Lundi', 'La compil tournait encore à midi. Je suis restée aux toilettes pendant la pause.']);
  if (F.promisedCamille && !F.stoppedThomas && !F.thomasNegotiated) notes.push(['Lundi', "Tu m'avais dit oui."]);
  else if (F.missed_2 || F.seenNoReply_2) notes.push(['Lundi', "J'ai demandé de l'aide une deuxième fois. Le message a expiré."]);
  notes.push(['Mardi', `La vidéo a été vue ${fmt(S.views)} fois. Je ne veux pas la revoir. Peut-être que lundi prochain, ça ira mieux.`]);
  const better = F.stoppedThomas || F.supported || F.toldTruth;
  $('#end').innerHTML = `
    <div class="endhead cam">${avatar('camille', better ? 'sad' : 'hood', 64)}<div><h2>Notes de Camille</h2><small>son téléphone, la même semaine</small></div></div>
    ${notes.map(([d, t]) => `<div class="note"><small>${d}</small><p>${esc(t)}</p></div>`).join('')}
    <blockquote>Parfois, la différence entre rire <i>avec</i> quelqu'un et rire <i>de</i> quelqu'un, c'est de lui laisser encore la possibilité de dire stop.</blockquote>
    <button class="cta ghost" id="restart">Rejouer</button>`;
  $('#end').scrollTop = 0;
}

// ── démarrage & événements ─────────────────────────────────────
function boot() {
  S = newState();
  clearInterval(loop);
  $('#phone').className = 'phone';
  ['#end', '#list', '#status', '#msgs', '#convhead', '#seen', '#listinfo'].forEach(s => $(s).innerHTML = '');
  $('#coach').classList.remove('show');
  $('#state').innerHTML = '<p class="legend">L\'état du jeu apparaîtra ici.</p>';
  renderNext();
  showOverlay(`<div class="intro">${avatar('you', 'neutral', 90)}<h1>Juste entre nous</h1>
    <p>Vendredi soir. Ton téléphone vibre.</p>
    <p class="small">3 jours · à ton rythme<br>Tu n'as pas de clavier : tu réponds avec les mots que tu connais.<br>On te guidera au début.</p>
    <button class="cta" id="start">Commencer</button></div>`);
  loop = setInterval(tick, TICK * 1000);
}

document.addEventListener('click', e => {
  const t = e.target.closest('button, #notif');
  if (!t) return;
  if (t.id === 'start') return startBeat(0);
  if (t.id === 'restart' || t.id === 'restart2') return boot();
  if (t.id === 'toCamille') return showCamille();
  if (t.id === 'back') return closeConv();
  if (t.id === 'next') return endBeat();
  if (t.id === 'notif') { t.classList.remove('show'); if (S.running) { if (S.open) closeConv(); openConv(t.dataset.open); } return; }
  if (t.dataset.open) return openConv(t.dataset.open);
  if (t.dataset.vote) return vote(+t.dataset.vote, +t.dataset.opt);
  if (t.dataset.pick) { pick(t.dataset.pick); return; }
  if (t.dataset.unpick) { S.draft.splice(+t.dataset.unpick, 1); renderComposer(); return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'd' || e.key === 'D') document.body.classList.toggle('design');
});
const sendBtn = document.getElementById('send');
sendBtn.addEventListener('pointerdown', startHold);
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => sendBtn.addEventListener(ev, () => cancelHold(false)));
sendBtn.addEventListener('contextmenu', e => e.preventDefault());

boot();
