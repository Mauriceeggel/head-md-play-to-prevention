// Avatars dessinés en SVG. mood : happy · laugh · neutral · sad · hood · turned · stop · gone · plain
function avatar(id, mood = 'neutral', size = 40, opts = {}) {
  const c = CHARS[id];
  const s = 'stroke="#2b2b2b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
  const wrap = inner => `<svg class="av" viewBox="0 0 100 100" width="${size}" height="${size}">${inner}</svg>`;

  if (mood === 'gone') {
    return wrap(`<circle cx="50" cy="50" r="38" fill="none" stroke="#b9b2a6" stroke-width="3" stroke-dasharray="6 7"/>`);
  }
  if (mood === 'plain') {
    // Dans la liste : on ne voit pas l'expression. Il faut ouvrir la conversation.
    return wrap(`<circle cx="50" cy="50" r="40" fill="${c.hair}" opacity=".85"/>
      <text x="50" y="62" text-anchor="middle" font-size="34" font-family="inherit" fill="#fff">${c.name[0]}</text>`);
  }

  const hood = mood === 'hood';
  const cap = opts.cap && !hood;
  let back = '', hairTop = '';
  switch (c.style) {
    case 'long':  back = `<path d="M18 58 Q16 20 50 20 Q84 20 82 58 L84 92 L16 92 Z" fill="${c.hair}" ${s}/>`;
                  hairTop = `<path d="M22 50 Q24 22 50 22 Q76 22 78 50 Q64 36 50 38 Q36 36 22 50 Z" fill="${c.hair}" ${s}/>`; break;
    case 'bob':   back = `<path d="M18 72 Q14 22 50 22 Q86 22 82 72 Z" fill="${c.hair}" ${s}/>`;
                  hairTop = `<path d="M22 50 Q24 22 50 22 Q76 22 78 50 Q50 40 22 50 Z" fill="${c.hair}" ${s}/>`; break;
    case 'spiky': hairTop = `<path d="M22 48 L27 24 L37 34 L45 16 L54 31 L64 17 L70 33 L79 48 Q50 34 22 48 Z" fill="${c.hair}" ${s}/>`; break;
    case 'bun':   hairTop = `<circle cx="50" cy="18" r="10" fill="${c.hair}" ${s}/><path d="M22 50 Q24 24 50 24 Q76 24 78 50 Q50 36 22 50 Z" fill="${c.hair}" ${s}/>`; break;
    case 'curly': hairTop = [[26,40],[32,28],[44,22],[56,22],[68,28],[74,40]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${c.hair}" ${s}/>`).join(''); break;
    default:      hairTop = `<path d="M22 48 Q24 22 50 22 Q76 22 78 48 Q66 34 50 36 Q34 34 22 48 Z" fill="${c.hair}" ${s}/>`;
  }

  const eyes = {
    happy:  `<path d="M36 54 q5 -6 10 0 M54 54 q5 -6 10 0" fill="none" ${s}/>`,
    laugh:  `<path d="M36 52 q5 -6 10 0 M54 52 q5 -6 10 0" fill="none" ${s}/>`,
    sad:    `<circle cx="41" cy="56" r="3" fill="#2b2b2b"/><circle cx="59" cy="56" r="3" fill="#2b2b2b"/><path d="M35 47 l10 3 M65 47 l-10 3" ${s}/>`,
    turned: `<circle cx="47" cy="54" r="3" fill="#2b2b2b"/><circle cx="64" cy="54" r="3" fill="#2b2b2b"/>`,
    hood:   `<circle cx="42" cy="59" r="2.6" fill="#2b2b2b"/><circle cx="58" cy="59" r="2.6" fill="#2b2b2b"/>`,
    stop:   `<circle cx="41" cy="54" r="3" fill="#2b2b2b"/><circle cx="59" cy="54" r="3" fill="#2b2b2b"/><path d="M35 46 l10 3 M65 46 l-10 3" ${s}/>`,
  }[mood] || `<circle cx="41" cy="54" r="3" fill="#2b2b2b"/><circle cx="59" cy="54" r="3" fill="#2b2b2b"/>`;

  const mouth = {
    happy:  `<path d="M40 66 q10 8 20 0" fill="none" ${s}/>`,
    laugh:  `<path d="M38 63 q12 15 24 0 z" fill="#7a2e2e" ${s}/>`,
    sad:    `<path d="M41 71 q9 -7 18 0" fill="none" ${s}/>`,
    turned: `<path d="M52 68 h9" ${s}/>`,
    hood:   `<path d="M44 71 q6 -3 12 0" fill="none" ${s}/>`,
    stop:   `<path d="M42 68 h16" ${s}/>`,
  }[mood] || `<path d="M42 68 h16" ${s}/>`;

  const blush = (mood === 'happy' || mood === 'laugh')
    ? `<circle cx="33" cy="64" r="4" fill="#ff9a9a" opacity=".5"/><circle cx="67" cy="64" r="4" fill="#ff9a9a" opacity=".5"/>` : '';

  return wrap(`
    ${hood ? `<path d="M12 100 L12 60 Q12 12 50 12 Q88 12 88 60 L88 100 Z" fill="#6c7a89" ${s}/>` : back}
    <path d="M18 100 Q20 84 50 84 Q80 84 82 100 Z" fill="${hood ? '#56626e' : c.shirt}" ${s}/>
    <circle cx="50" cy="56" r="27" fill="${c.skin}" ${s}/>
    ${hood ? `<path d="M20 62 Q18 20 50 20 Q82 20 80 62 Q74 36 50 36 Q26 36 20 62 Z" fill="#6c7a89" ${s}/>` : hairTop}
    ${cap ? `<path d="M23 44 Q50 12 77 44 Z" fill="#ffd23f" ${s}/><path d="M70 42 h20" ${s}/>` : ''}
    ${eyes}${mouth}${blush}
    ${mood === 'stop' ? `<text x="78" y="96" font-size="30">✋</text>` : ''}
  `);
}
