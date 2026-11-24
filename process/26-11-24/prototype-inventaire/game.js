// Moteur : afficher la conversation, garder des mots, composer, envoyer.
const $ = s => document.querySelector(s);
const WAIT = text => 1400 + text.length * 40; // temps « Camille écrit… »

// Tous les mots qu'on peut garder dans le scénario (pour le récapitulatif)
const ALL_WORDS = [...new Set(
  Object.values(NODES)
    .flatMap(n => [...n.lines, ...n.rules.flatMap(r => r.reply), ...n.else.reply])
    .map(l => l.text || l).join(' ')
    .match(/\[[^\]]+\]/g).map(b => b.slice(1, -1).split('|').pop())
)];

const S = {
  inventory: [...START], draft: [], flags: {}, trust: 0,
  node: null, phase: 'idle', seen: new Set(), used: new Set(), said: [], note: '',
};

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parse(text) {
  return esc(text).replace(/\[([^\]|]+)(?:\|([^\]]+))?\]/g, (_, shown, key) => {
    key = key || shown;
    S.seen.add(key);
    const taken = S.inventory.includes(key) ? ' taken' : '';
    return `<span class="word${taken}" data-k="${key}">${shown}</span>`;
  });
}

function addLine(who, html, cls = '') {
  const p = document.createElement('p');
  p.className = `line ${cls}`;
  p.innerHTML = who ? `<span class="who">${who} :</span> ${html}` : html;
  $('#log').appendChild(p);
  p.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

// ---- Déroulé ----

function runNode(id) {
  S.node = NODES[id];
  if (S.node.day) addLine('', `— ${S.node.day} —`, 'sep');
  say(S.node.lines, () => { S.phase = 'waiting'; render(); });
}

function say(lines, done) {
  const list = lines.filter(l => typeof l === 'string' || S.flags[l.if]).map(l => l.text || l);
  S.phase = 'typing';
  render();
  let i = 0;
  (function step() {
    if (i >= list.length) return done();
    const dots = typing();
    setTimeout(() => {
      dots.remove();
      addLine(PERSON, parse(list[i++]));
      render();
      setTimeout(step, 500);
    }, WAIT(list[i]));
  })();
}

// Trois points animés pendant que la personne écrit
function typing() {
  const p = document.createElement('p');
  p.className = 'line typing';
  p.innerHTML = `<span class="who">${PERSON} :</span> <span class="dots"><i>.</i><i>.</i><i>.</i></span>`;
  $('#log').appendChild(p);
  p.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return p;
}

function matches(r, msg) {
  if (r.has && !r.has.every(w => msg.includes(w))) return false;
  if (r.any && !r.any.some(w => msg.includes(w))) return false;
  return true;
}

function send() {
  if (S.phase !== 'waiting' || !S.draft.length) return;
  const msg = [...S.draft];
  S.draft = [];
  S.said.push(msg.join(' '));
  msg.forEach(w => S.used.add(w));
  addLine('Toi', esc(msg.join(' ')), 'me');

  const r = GLOBAL.find(g => g.when(msg)) || S.node.rules.find(x => matches(x, msg)) || S.node.else;
  S.trust += r.trust || 0;
  if (r.flag) S.flags[r.flag] = true;

  const next = S.node.next;
  say(r.reply, () => {
    if (!next) return setTimeout(end, 1500);
    if (NODES[next].day) {
      S.phase = 'between';
      render();
      $('#next').textContent = `Passer à ${NODES[next].day.toLowerCase()} →`;
      $('#next').onclick = () => runNode(next);
    } else {
      setTimeout(() => runNode(next), 1200);
    }
  });
}

// ---- Inventaire et brouillon ----

const arriving = new Set(); // mots en train de glisser vers l'inventaire

function keep(k, from) {
  if (S.inventory.includes(k)) return;
  const start = from && from.getBoundingClientRect();
  S.inventory.push(k);
  arriving.add(k);
  document.querySelectorAll('.word').forEach(el => { if (el.dataset.k === k) el.classList.add('taken'); });
  flash(`« ${k} » ajouté à tes mots.`);
  const target = [...document.querySelectorAll('#inventory button')].find(b => b.dataset.k === k);
  if (!start || !target) return land(k);
  slide(k, start, target);
}

// Le mot quitte le texte et glisse jusqu'à sa place dans l'inventaire
function slide(k, start, target) {
  const end = target.getBoundingClientRect();
  const ghost = document.createElement('span');
  ghost.className = 'ghost';
  ghost.textContent = k;
  Object.assign(ghost.style, { left: start.left + 'px', top: start.top + 'px' });
  document.body.appendChild(ghost);
  const dx = end.left + 9 - start.left;
  const dy = end.top + (end.height - start.height) / 2 - start.top;
  ghost.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 40}px)`, offset: 0.4 },
    { transform: `translate(${dx}px, ${dy}px)` },
  ], { duration: 750, easing: 'ease-in-out' }).onfinish = () => { ghost.remove(); land(k); };
}

function land(k) {
  arriving.delete(k);
  render();
}

function toggle(k) {
  if (S.phase === 'end') return;
  const i = S.draft.indexOf(k);
  if (i >= 0) { S.draft.splice(i, 1); return render(); }
  // pas deux mots qui se contredisent : le nouveau remplace l'ancien
  OPPOSITES.forEach(pair => {
    if (pair.includes(k)) S.draft = S.draft.filter(w => w === k || !pair.includes(w));
  });
  if (S.draft.length >= MAX_WORDS) return flash(`${MAX_WORDS} mots maximum.`);
  S.draft.push(k);
  render();
}

let flashTimer;
function flash(text) {
  S.note = text;
  render();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { S.note = ''; render(); }, 2200);
}

// ---- Affichage ----

function statusText() {
  if (S.note) return S.note;
  if (S.phase === 'typing') return '';
  if (S.phase === 'between') return '';
  if (S.phase !== 'waiting') return '';
  const untaken = [...document.querySelectorAll('.word:not(.taken)')].length;
  if (S.inventory.length === START.length && untaken) return 'Clique sur un mot souligné pour le garder.';
  if (!S.draft.length) return 'À toi. Choisis un ou plusieurs de tes mots.';
  return 'Envoie quand tu veux.';
}

function render() {
  $('#status').textContent = statusText();
  $('#next').hidden = S.phase !== 'between';
  $('#draft').textContent = S.draft.length ? S.draft.join(' ') : '…';
  $('#send').disabled = S.phase !== 'waiting' || !S.draft.length;
  $('#inventory').innerHTML = S.inventory.map(k =>
    `<button type="button" data-k="${k}" aria-pressed="${S.draft.includes(k)}"${arriving.has(k) ? ' class="arriving"' : ''}>${esc(k)}</button>`
  ).join('');
}

function list(title, items) {
  return `<p>${title}</p><p class="indent">${items.length ? items.map(esc).join('<br>') : '(aucun)'}</p>`;
}

function end() {
  S.phase = 'end';
  render();
  const kept = S.inventory.filter(w => !START.includes(w));
  $('#composer').hidden = true;
  $('#end').hidden = false;
  $('#end').innerHTML = `
    <p>— Fin —</p>
    <p>${OUTCOMES.find(o => S.trust >= o.min).text}</p>
    ${list('Ce que tu as dit :', S.said)}
    ${list('Mots gardés mais jamais dits :', kept.filter(w => !S.used.has(w)))}
    ${list('Mots lus mais pas gardés :', [...S.seen].filter(w => !S.inventory.includes(w)))}
    ${list("Mots que Camille n'a jamais écrits (à cause de tes réponses) :", ALL_WORDS.filter(w => !S.seen.has(w)))}
    <p><button type="button" onclick="location.reload()">Recommencer</button></p>`;
  $('#end').scrollIntoView({ behavior: 'smooth' });
}

// ---- Démarrage ----

document.addEventListener('click', e => {
  const w = e.target.closest('.word');
  if (w && !w.classList.contains('taken')) return keep(w.dataset.k, w);
  const b = e.target.closest('#inventory button');
  if (b) toggle(b.dataset.k);
});
$('#send').addEventListener('click', send);

$('#intro').innerHTML = INTRO.map(t => `<p>${esc(t)}</p>`).join('');
render();
setTimeout(() => runNode('vu'), 1500);
