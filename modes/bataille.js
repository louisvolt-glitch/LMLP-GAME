// =====================================================================
//  MODE « BATAILLE STELLAIRE » : duel de flottes spatiales à 2 joueurs.
//  Chaque amiral cache 5 vaisseaux sur une grille de 10 × 10, puis les deux
//  tirent à tour de rôle sur le secteur adverse : manqué, touché ou détruit.
//  Le premier qui anéantit toute la flotte ennemie gagne.
//  S'il y a plus de 2 joueurs dans le salon, 2 duellistes sont tirés au sort
//  et les autres assistent au combat en spectateurs.
//
//  Fonctionnement réseau (comme Magnat Galactique) : l'HÔTE est l'arbitre.
//  Les joueurs écrivent des actions (bsGame/a/<clé>), l'hôte les applique avec
//  bsApply() et publie l'état (bsGame/s).
// =====================================================================

// ============================ 1) DONNÉES ET RÈGLES ============================
const BS = { N: 10, PLACE_SECONDS: 90, LOG: 12 };
const BS_SHIPS = [
    { n: 'Croiseur amiral', l: 5, c: '#f59e0b' },
    { n: 'Destroyer', l: 4, c: '#38bdf8' },
    { n: 'Frégate', l: 3, c: '#a78bfa' },
    { n: 'Corvette', l: 3, c: '#34d399' },
    { n: 'Chasseur', l: 2, c: '#fb7185' }
];
const BS_EMPTY = '.'.repeat(BS.N * BS.N);       // '.' pas encore visé, 'o' manqué, 'x' touché

function bsCells(ship) {
    const out = [], len = BS_SHIPS[ship.k].l;
    for (let i = 0; i < len; i++) out.push((ship.y + (ship.v ? i : 0)) * BS.N + ship.x + (ship.v ? 0 : i));
    return out;
}
function bsFits(ship) {
    const def = BS_SHIPS[ship.k];
    if (!def || !Number.isInteger(ship.x) || !Number.isInteger(ship.y) || ship.x < 0 || ship.y < 0) return false;
    return ship.v ? (ship.x < BS.N && ship.y + def.l <= BS.N) : (ship.y < BS.N && ship.x + def.l <= BS.N);
}
// Un vaisseau peut-il être ajouté à une flotte ? (dans la grille, sans chevauchement)
function bsCanAdd(fleet, ship) {
    if (!bsFits(ship) || fleet.some(f => f.k === ship.k)) return false;
    const used = {};
    fleet.forEach(f => bsCells(f).forEach(c => { used[c] = true; }));
    return bsCells(ship).every(c => !used[c]);
}
function bsCleanFleet(raw) {
    const arr = Array.isArray(raw) ? raw : Object.values(raw || {});
    return arr.filter(Boolean).map(f => ({ k: Number(f.k), x: Number(f.x) || 0, y: Number(f.y) || 0, v: !!f.v }));
}
function bsValidFleet(raw) {
    const fleet = bsCleanFleet(raw);
    if (fleet.length !== BS_SHIPS.length) return false;
    const done = [];
    for (const f of fleet) { if (!bsCanAdd(done, f)) return false; done.push(f); }
    return true;
}
function bsRandomFleet(rnd) {
    rnd = rnd || Math.random;
    const fleet = [];
    BS_SHIPS.forEach((def, k) => {
        for (let guard = 0; guard < 500; guard++) {
            const ship = { k: k, x: Math.floor(rnd() * BS.N), y: Math.floor(rnd() * BS.N), v: rnd() < 0.5 };
            if (bsCanAdd(fleet, ship)) { fleet.push(ship); return; }
        }
    });
    return fleet;
}
function bsOther(s, name) { return s.duel[0] === name ? s.duel[1] : s.duel[0]; }
// Vaisseaux détruits d'une flotte, d'après les tirs reçus : tableau de booléens (un par vaisseau)
function bsSunk(fleet, shots) {
    const out = BS_SHIPS.map(() => false);
    fleet.forEach(f => { out[f.k] = bsCells(f).every(c => shots[c] === 'x'); });
    return out;
}
function bsHits(shots) { return (String(shots || '').match(/x/g) || []).length; }
function bsShotCount(shots) { return (String(shots || '').match(/[xo]/g) || []).length; }
function bsCoord(x, y) { return 'ABCDEFGHIJ'[x] + (y + 1); }
function bsActor(s) { return s.phase === 'BATTLE' ? s.duel[s.turn] : ''; }
function bsLog(s, txt) { s.log.push(txt); if (s.log.length > BS.LOG) s.log = s.log.slice(-BS.LOG); }

function bsNewGame(duel, opts, now, rnd) {
    opts = opts || {};
    const s = {
        status: 'PLAYING', startedAt: now, seq: 1, phase: 'PLACE', duel: duel.slice(0, 2), turn: 0,
        fleet: {}, ready: {}, shots: {}, n: 0, last: null, winner: '', log: [],
        timer: Math.max(10, Math.min(120, Number(opts.timer) || 30)), again: opts.again !== false,
        dl: 0, dlAt: now, dlKey: ''
    };
    s.duel.forEach(n => { s.shots[n] = BS_EMPTY; });
    s.turn = (rnd || Math.random)() < 0.5 ? 0 : 1;
    bsLog(s, `Duel : ${s.duel[0]} contre ${s.duel[1]}. Placez vos flottes !`);
    bsDeadline(s, now);
    return s;
}
// Firebase supprime les tableaux et objets vides : on les rétablit à la lecture
function bsNorm(raw) {
    const s = JSON.parse(JSON.stringify(raw || {}));
    const arr = v => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : Object.values(v || {}));
    s.duel = arr(s.duel);
    s.fleet = s.fleet || {}; s.ready = s.ready || {}; s.shots = s.shots || {};
    s.duel.forEach(n => { s.fleet[n] = bsCleanFleet(s.fleet[n]); s.ready[n] = !!s.ready[n]; s.shots[n] = (String(s.shots[n] || '') + BS_EMPTY).slice(0, BS.N * BS.N); });
    s.log = arr(s.log);
    s.last = s.last || null;
    if (s.last) { s.last.x = s.last.x || 0; s.last.y = s.last.y || 0; if (typeof s.last.k !== 'number') s.last.k = -1; }
    ['turn', 'n', 'seq', 'dl', 'dlAt', 'timer'].forEach(k => { s[k] = s[k] || 0; });
    s.again = !!s.again; s.winner = s.winner || ''; s.dlKey = s.dlKey || '';
    return s;
}
function bsDeadline(s, now) {
    if (s.status !== 'PLAYING') return;
    const key = s.phase + ':' + s.turn + ':' + s.n;
    if (key !== s.dlKey) { s.dlKey = key; s.dlAt = now; s.dl = now + (s.phase === 'PLACE' ? BS.PLACE_SECONDS : s.timer) * 1000; }
}

// Application d'une action. Renvoie le nouvel état, ou null si l'action est refusée.
function bsApply(s0, a, now, rnd) {
    if (!s0 || s0.status !== 'PLAYING' || !a || typeof a.by !== 'string') return null;
    const s = JSON.parse(JSON.stringify(s0));
    const by = a.by;
    if (s.duel.indexOf(by) < 0) return null;

    if (a.t === 'place') {
        if (s.phase !== 'PLACE' || !bsValidFleet(a.fleet)) return null;
        s.fleet[by] = bsCleanFleet(a.fleet); s.ready[by] = true;
        bsLog(s, `${by} a déployé sa flotte.`);
        if (s.duel.every(n => s.ready[n])) {
            s.phase = 'BATTLE';
            bsLog(s, `Le combat commence : ${s.duel[s.turn]} ouvre le feu.`);
        }
    } else if (a.t === 'edit') {
        if (s.phase !== 'PLACE' || !s.ready[by]) return null;
        s.ready[by] = false;
        bsLog(s, `${by} modifie le placement de sa flotte.`);
    } else if (a.t === 'fire') {
        const x = Number(a.x), y = Number(a.y);
        if (s.phase !== 'BATTLE' || s.duel[s.turn] !== by) return null;
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= BS.N || y >= BS.N) return null;
        const idx = y * BS.N + x, mine = s.shots[by];
        if (mine[idx] !== '.') return null;
        const foe = bsOther(s, by), fleet = s.fleet[foe];
        const target = fleet.find(f => bsCells(f).indexOf(idx) >= 0);
        s.shots[by] = mine.slice(0, idx) + (target ? 'x' : 'o') + mine.slice(idx + 1);
        s.n++;
        let r = 'm', k = -1;
        if (target) {
            r = 'h';
            if (bsCells(target).every(c => s.shots[by][c] === 'x')) { r = 's'; k = target.k; }
        }
        s.last = { by: by, x: x, y: y, r: r, k: k };
        bsLog(s, `${by} tire en ${bsCoord(x, y)} : ${r === 'm' ? 'manqué' : (r === 'h' ? 'touché !' : BS_SHIPS[k].n + ' détruit !')}`);
        if (bsSunk(fleet, s.shots[by]).every((v, i) => v || !fleet.some(f => f.k === i))) {
            s.status = 'FINISHED'; s.winner = by;
            bsLog(s, `Toute la flotte de ${foe} est détruite : ${by} remporte la bataille !`);
        } else if (!(target && s.again)) {
            s.turn = 1 - s.turn;
        }
    } else return null;

    bsDeadline(s, now);
    s.seq++;
    return s;
}
// Temps écoulé (ou joueur absent) : placement aléatoire, ou tir au hasard
function bsAuto(s, now, rnd) {
    if (s.status !== 'PLAYING') return null;
    rnd = rnd || Math.random;
    if (s.phase === 'PLACE') {
        let st = s;
        s.duel.forEach(n => { if (!st.ready[n]) st = bsApply(st, { by: n, t: 'place', fleet: bsRandomFleet(rnd) }, now, rnd) || st; });
        return st === s ? null : st;
    }
    const by = s.duel[s.turn], free = [];
    for (let i = 0; i < BS.N * BS.N; i++) if (s.shots[by][i] === '.') free.push(i);
    if (!free.length) return null;
    const idx = free[Math.floor(rnd() * free.length)];
    return bsApply(s, { by: by, t: 'fire', x: idx % BS.N, y: Math.floor(idx / BS.N) }, now, rnd);
}
function bsScore(s, name) { return bsHits(s.shots[name]) * 10 + (s.winner === name ? 100 : 0); }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BS, BS_SHIPS, bsNewGame, bsNorm, bsApply, bsAuto, bsRandomFleet, bsValidFleet, bsCells, bsSunk, bsHits, bsOther, bsCanAdd, bsScore, bsActor, bsPickDuel };
}

// ============================ 2) BOUCLE DE L'HÔTE ============================
const bsHost = { startedAt: 0, state: null, done: {} };
const bsUI = { seenSess: '', seenSeq: 0, sess: '', sig: '', fleet: [], sel: 0, v: false, hover: null, shown: '' };

function bsEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function bsRoom() { return window.currentCodeSalon || state.roomCode; }
function bsMe() { return window.myPlayerKey || state.username; }
function bsSend(action) {
    const code = bsRoom();
    if (!code || !window.update) return;
    const key = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    window.update(window.ref(window.db, `salons/${code}`), { [`bsGame/a/${key}`]: Object.assign({ by: bsMe() }, action) })
        .catch(err => console.error('Action Bataille non envoyée :', err));
}
function bsHostState(g) {
    const s = bsNorm(g.s);
    if (bsHost.state && bsHost.startedAt === s.startedAt && bsHost.state.seq > s.seq) return bsHost.state;
    return s;
}
function bsHostWrite(s, removeKeys, players) {
    bsHost.startedAt = s.startedAt; bsHost.state = s;
    const updates = { 'bsGame/s': JSON.parse(JSON.stringify(s)) };
    removeKeys.forEach(k => { updates['bsGame/a/' + k] = null; });
    if (s.status === 'FINISHED') s.duel.forEach(n => { if (players && players[n]) updates[`players/${n}/score`] = bsScore(s, n); });
    window.update(window.ref(window.db, `salons/${bsRoom()}`), updates)
        .catch(err => console.error('Mise à jour Bataille impossible :', err));
}
function bsHostProcess(data) {
    const g = data.bsGame;
    if (!window.isHost || !g || !g.s) return;
    const keys = Object.keys(g.a || {}).sort().filter(k => !bsHost.done[k]);
    if (!keys.length) return;
    let s = bsHostState(g), changed = false;
    const now = Date.now();
    keys.forEach(k => {
        bsHost.done[k] = true;
        let next = null;
        try { next = bsApply(s, g.a[k], now); } catch (e) { console.error('Action Bataille invalide :', e); }
        if (next) { s = next; changed = true; }
    });
    if (changed) bsHostWrite(s, keys, data.players);
    else {
        const updates = {};
        keys.forEach(k => { updates['bsGame/a/' + k] = null; });
        window.update(window.ref(window.db, `salons/${bsRoom()}`), updates).catch(err => console.error(err));
    }
}
function bsHostTick() {
    const room = window.currentRoom;
    if (!window.isHost || !room || room.status !== 'IN_GAME' || room.selectedMode !== 'bataille' || !room.bsGame || !room.bsGame.s) return;
    const s = bsHostState(room.bsGame);
    if (s.status !== 'PLAYING') return;
    const now = Date.now();
    const present = Object.values(room.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const waiting = s.phase === 'PLACE' ? s.duel.filter(n => !s.ready[n]) : [s.duel[s.turn]];
    const absent = waiting.length > 0 && waiting.every(n => present.indexOf(n) < 0);
    if (now > s.dl || (absent && now > s.dlAt + 3000)) {
        let next = null;
        try { next = bsAuto(s, now); } catch (e) { console.error('Tour automatique impossible :', e); }
        if (next) bsHostWrite(next, [], room.players);
    }
}

// ============================ 3) AFFICHAGE ============================
const BS_C = 100, BS_M = 70;       // taille d'une case et marge des coordonnées (unités du dessin)
const BS_CSS = `
#bs-root{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;gap:.7vw;padding:.7vw;box-sizing:border-box;background:radial-gradient(circle at 50% 30%,#0b1a30 0%,#040913 72%);color:#e2e8f0;font-size:clamp(12px,1vw,22px)}
#bs-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:.5em 1em;border:1px solid rgba(0,210,255,.35);border-radius:12px;background:rgba(9,20,36,.92);flex-shrink:0}
#bs-banner{flex-shrink:0;text-align:center;padding:.45em 1em;border-radius:12px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);font-weight:800;font-size:1.25em;min-height:1.6em}
#bs-main{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:1vw}
.bs-col{display:flex;flex-direction:column;gap:.5vw;min-height:0;min-width:0;border:1px solid var(--bs-acc,rgba(0,210,255,.35));border-radius:14px;background:rgba(9,20,36,.7);padding:.6vw}
.bs-col-on{box-shadow:0 0 22px -4px var(--bs-acc)}
.bs-head{display:flex;align-items:center;gap:.7em;flex-shrink:0;min-width:0}
.bs-av{width:2.6em;height:2.6em;border-radius:50%;border:3px solid var(--bs-acc);object-fit:cover;flex-shrink:0;background:#020617;display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--bs-acc)}
.bs-wrap{flex:1;min-height:0;container-type:size;display:flex;align-items:center;justify-content:center}
.bs-wrap svg{width:min(100cqw,100cqh);height:min(100cqw,100cqh);display:block}
.bs-fleet{display:flex;flex-wrap:wrap;gap:.4em;justify-content:center;flex-shrink:0;font-size:.72em}
.bs-chip{display:flex;align-items:center;gap:.4em;padding:.2em .6em;border-radius:999px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.8);white-space:nowrap}
.bs-chip-dead{border-color:#ef4444;color:#fca5a5;text-decoration:line-through;background:rgba(127,29,29,.35)}
.bs-chip-sel{border-color:#fbbf24;box-shadow:0 0 10px rgba(251,191,36,.7);cursor:pointer}
.bs-chip-pick{cursor:pointer}
.bs-pips{display:inline-flex;gap:2px}.bs-pips i{width:.55em;height:.55em;border-radius:2px;display:inline-block}
.bs-btn{padding:.55em 1em;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f1f5f9;font-weight:800;font-size:.85em;cursor:pointer}
.bs-btn:hover{background:#334155}.bs-btn:disabled{opacity:.4;cursor:not-allowed}
.bs-btn-go{background:#059669;border-color:#34d399}.bs-btn-go:hover{background:#10b981}
.bs-panel{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:.8em;justify-content:center;padding:0 1em}
.bs-cell{cursor:default}.bs-fire .bs-cell{cursor:crosshair}.bs-fire .bs-cell:hover{fill:rgba(248,113,113,.35)}
.bs-place .bs-cell{cursor:pointer}
@keyframes bsPing{0%{r:18;opacity:1}100%{r:62;opacity:0}}
.bs-ping{animation:bsPing 1.1s ease-out infinite}
@media (max-width:900px){#bs-root{overflow-y:auto}#bs-main{display:flex;flex-direction:column;flex:none}.bs-wrap{container-type:normal;flex:none}.bs-wrap svg{width:100%;height:auto;max-width:560px}.bs-panel{flex:none;padding:1em}}`;

function bsColor(i) { return i === 0 ? '#22d3ee' : '#f472b6'; }
function bsAvatarHtml(name) {
    const d = window.bsData, p = d && d.players && d.players[name];
    const src = p && p.avatar && p.avatar.src;
    return src ? `<img class="bs-av" src="${bsEsc(src)}" alt="">` : `<span class="bs-av">${bsEsc(String(name).charAt(0).toUpperCase())}</span>`;
}
// Grille fixe d'un secteur
function bsBoardSvg(id) {
    const size = BS_M + BS.N * BS_C + 10;
    let stars = '', lines = '', labels = '', cells = '';
    let seed = id.length * 7919 + 13;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) stars += `<circle cx="${(BS_M + rnd() * BS.N * BS_C).toFixed(0)}" cy="${(BS_M + rnd() * BS.N * BS_C).toFixed(0)}" r="${(1 + rnd() * 2.2).toFixed(1)}" fill="#e2e8f0" opacity="${(0.15 + rnd() * 0.5).toFixed(2)}"/>`;
    for (let i = 0; i <= BS.N; i++) {
        const p = BS_M + i * BS_C;
        lines += `<line x1="${p}" y1="${BS_M}" x2="${p}" y2="${BS_M + BS.N * BS_C}"/><line x1="${BS_M}" y1="${p}" x2="${BS_M + BS.N * BS_C}" y2="${p}"/>`;
    }
    for (let i = 0; i < BS.N; i++) {
        labels += `<text x="${BS_M + i * BS_C + BS_C / 2}" y="${BS_M - 20}" text-anchor="middle">${'ABCDEFGHIJ'[i]}</text><text x="${BS_M - 34}" y="${BS_M + i * BS_C + BS_C / 2 + 14}" text-anchor="middle">${i + 1}</text>`;
        for (let x = 0; x < BS.N; x++) cells += `<rect class="bs-cell" data-b="${id}" data-x="${x}" data-y="${i}" x="${BS_M + x * BS_C}" y="${BS_M + i * BS_C}" width="${BS_C}" height="${BS_C}" fill="transparent"/>`;
    }
    return `<svg id="${id}" viewBox="0 0 ${size} ${size}">
        <rect x="${BS_M}" y="${BS_M}" width="${BS.N * BS_C}" height="${BS.N * BS_C}" rx="14" fill="#06101f"/>
        ${stars}
        <g stroke="rgba(56,189,248,.28)" stroke-width="2">${lines}</g>
        <g fill="#7dd3fc" font-family="Arial, sans-serif" font-size="38" font-weight="bold">${labels}</g>
        <g id="${id}-ships" pointer-events="none"></g>
        <g id="${id}-marks" pointer-events="none"></g>
        <g id="${id}-hover" pointer-events="none"></g>
        <g id="${id}-cells">${cells}</g>
    </svg>`;
}
// Dessin d'un vaisseau (pointe à droite, réacteurs à gauche ; pivoté si vertical)
function bsShipSvg(ship, mode) {
    const def = BS_SHIPS[ship.k], L = def.l * BS_C, H = BS_C;
    const col = mode === 'dead' ? '#7f1d1d' : (mode === 'bad' ? '#ef4444' : def.c);
    const stroke = mode === 'dead' ? '#f87171' : '#f8fafc';
    const op = mode === 'ghost' || mode === 'bad' ? 0.55 : 1;
    const tf = ship.v
        ? `translate(${BS_M + (ship.x + 1) * BS_C} ${BS_M + ship.y * BS_C}) rotate(90)`
        : `translate(${BS_M + ship.x * BS_C} ${BS_M + ship.y * BS_C})`;
    let windows = '';
    for (let i = 0; i < def.l - 1; i++) windows += `<rect x="${BS_C * 0.55 + i * BS_C}" y="${H * 0.42}" width="${BS_C * 0.42}" height="${H * 0.16}" rx="6" fill="#0f172a" opacity=".55"/>`;
    return `<g transform="${tf}" opacity="${op}">
        <path d="M14 ${H * 0.3} L4 ${H * 0.18} L4 ${H * 0.82} L14 ${H * 0.7} Z" fill="#fbbf24" opacity="${mode === 'dead' ? 0.25 : 0.9}"/>
        <path d="M16 ${H * 0.22} L${L - H * 0.62} ${H * 0.16} Q${L - 6} ${H * 0.5} ${L - H * 0.62} ${H * 0.84} L16 ${H * 0.78} Z" fill="${col}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M${H * 0.5} ${H * 0.22} L${H * 0.2} ${H * 0.04} L${H * 0.95} ${H * 0.2} Z M${H * 0.5} ${H * 0.78} L${H * 0.2} ${H * 0.96} L${H * 0.95} ${H * 0.8} Z" fill="${col}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
        <ellipse cx="${L - H * 0.72}" cy="${H * 0.5}" rx="${H * 0.2}" ry="${H * 0.14}" fill="#e0f2fe" opacity=".9"/>
        ${windows}</g>`;
}
function bsMarkSvg(x, y, ch) {
    const cx = BS_M + x * BS_C + BS_C / 2, cy = BS_M + y * BS_C + BS_C / 2;
    if (ch === 'o') return `<circle cx="${cx}" cy="${cy}" r="14" fill="#94a3b8" opacity=".85"/><circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="#94a3b8" stroke-width="3" opacity=".45"/>`;
    let pts = '';
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 20 : 42, a = i * Math.PI / 8; pts += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `; }
    return `<polygon points="${pts}" fill="#f97316" stroke="#7c2d12" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="13" fill="#fde047"/>`;
}
// Remplit une grille : vaisseaux visibles, tirs reçus, dernier tir
function bsFillBoard(id, ships, shots, last) {
    const gs = document.getElementById(id + '-ships'), gm = document.getElementById(id + '-marks');
    if (!gs || !gm) return;
    gs.innerHTML = ships.map(sh => bsShipSvg(sh.ship, sh.mode)).join('');
    let marks = '';
    for (let i = 0; i < BS.N * BS.N; i++) if (shots[i] !== '.') marks += bsMarkSvg(i % BS.N, Math.floor(i / BS.N), shots[i]);
    if (last) {
        const cx = BS_M + last.x * BS_C + BS_C / 2, cy = BS_M + last.y * BS_C + BS_C / 2;
        marks += `<circle class="bs-ping" cx="${cx}" cy="${cy}" r="18" fill="none" stroke="#fef08a" stroke-width="5"/>`;
    }
    gm.innerHTML = marks;
}
function bsChips(fleetDefShown, sunk, opts) {
    opts = opts || {};
    return BS_SHIPS.map((def, k) => {
        const dead = sunk && sunk[k];
        const cls = 'bs-chip' + (dead ? ' bs-chip-dead' : '') + (opts.sel === k ? ' bs-chip-sel' : '') + (opts.pick ? ' bs-chip-pick' : '');
        const done = opts.placed && opts.placed.indexOf(k) >= 0;
        return `<span class="${cls}" ${opts.pick ? `data-act="ship" data-k="${k}"` : ''} style="${done ? 'opacity:.45' : ''}">
            <span class="bs-pips">${('<i style="background:' + (dead ? '#ef4444' : def.c) + '"></i>').repeat(def.l)}</span>${def.n}${done ? ' ✓' : ''}</span>`;
    }).join('');
}

function bsHoverShip() {
    const h = bsUI.hover;
    if (!h || bsUI.sel < 0 || bsUI.fleet.some(f => f.k === bsUI.sel)) return null;
    return { k: bsUI.sel, x: h.x, y: h.y, v: bsUI.v };
}
function bsRenderHover() {
    const g = document.getElementById('bs-a-hover');
    if (!g) return;
    const ship = bsHoverShip();
    g.innerHTML = ship && bsFits(ship) ? bsShipSvg(ship, bsCanAdd(bsUI.fleet, ship) ? 'ghost' : 'bad') : '';
}
function bsNextUnplaced() {
    for (let k = 0; k < BS_SHIPS.length; k++) if (!bsUI.fleet.some(f => f.k === k)) return k;
    return -1;
}

function bsRender(s, force) {
    const me = bsMe(), my = s.duel.indexOf(me), duelist = my >= 0;
    const sig = JSON.stringify([s.seq, bsUI.fleet, bsUI.sel, bsUI.v, me]);
    if (!force && sig === bsUI.sig) return;
    bsUI.sig = sig;
    const over = s.status === 'FINISHED';
    // Qui est affiché à gauche / à droite : le joueur voit SA flotte à gauche ; un spectateur voit les deux duellistes
    const left = duelist ? me : s.duel[0], right = duelist ? bsOther(s, me) : s.duel[1];
    const li = s.duel.indexOf(left), ri = s.duel.indexOf(right);
    const placing = s.phase === 'PLACE' && duelist && !s.ready[me];
    const actor = bsActor(s);

    // ----- bandeau -----
    const banner = document.getElementById('bs-banner');
    let txt, bcol = '#e2e8f0';
    if (over) { txt = `🏆 ${bsEsc(s.winner)} remporte la bataille !`; bcol = '#fde047'; }
    else if (s.phase === 'PLACE') {
        if (placing) txt = 'Déployez votre flotte : choisissez un vaisseau, puis une case de votre secteur.';
        else if (duelist) txt = `Flotte déployée. En attente de ${bsEsc(bsOther(s, me))}...`;
        else txt = `Les amiraux déploient leurs flottes (${s.duel.filter(n => s.ready[n]).length} / 2 prêts)...`;
    } else {
        const l = s.last;
        const res = l ? `${bsEsc(l.by)} → ${bsCoord(l.x, l.y)} : ${l.r === 'm' ? 'manqué' : (l.r === 'h' ? '<span style="color:#fb923c">touché !</span>' : '<span style="color:#f87171">' + BS_SHIPS[l.k].n + ' détruit !</span>')} · ` : '';
        txt = res + (actor === me ? '<span style="color:#6ee7b7">À vous de tirer : visez une case du secteur ennemi.</span>' : `Au tour de ${bsEsc(actor)}.`);
    }
    banner.innerHTML = txt; banner.style.color = bcol;

    // ----- colonne gauche -----
    const colA = document.getElementById('bs-col-a'), colB = document.getElementById('bs-col-b');
    colA.style.setProperty('--bs-acc', bsColor(li)); colB.style.setProperty('--bs-acc', bsColor(ri));
    colA.classList.toggle('bs-col-on', !over && s.phase === 'BATTLE' && actor === right);      // la flotte visée est celle de gauche quand « right » tire
    colB.classList.toggle('bs-col-on', !over && s.phase === 'BATTLE' && actor === left);
    const head = (name, sub) => `${bsAvatarHtml(name)}<div style="min-width:0"><div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${bsEsc(name)}${name === me ? ' <span style="font-size:.6em;color:#94a3b8">VOUS</span>' : ''}</div><div style="font-size:.72em;color:#94a3b8">${sub}</div></div>`;
    const shotsOnLeft = s.shots[right], shotsOnRight = s.shots[left];
    const sunkLeft = bsSunk(s.fleet[left], shotsOnLeft), sunkRight = bsSunk(s.fleet[right], shotsOnRight);
    const stat = (name, foe) => `${bsShotCount(s.shots[name])} tirs · ${bsHits(s.shots[name])} touches`;
    document.getElementById('bs-head-a').innerHTML = head(left, duelist ? 'Votre flotte — ' + (s.phase === 'PLACE' ? 'déploiement' : sunkLeft.filter(Boolean).length + ' / 5 vaisseaux perdus') : stat(left));
    document.getElementById('bs-head-b').innerHTML = head(right, duelist ? 'Secteur ennemi — ' + sunkRight.filter(Boolean).length + ' / 5 vaisseaux détruits' : stat(right));

    // flotte de gauche : visible pour son propriétaire, à la fin, ou vaisseau par vaisseau une fois détruit
    const show = (name, sunk, all) => s.fleet[name].filter(f => all || sunk[f.k]).map(f => ({ ship: f, mode: sunk[f.k] ? 'dead' : '' }));
    const svgA = document.getElementById('bs-a'), svgB = document.getElementById('bs-b');
    svgA.classList.toggle('bs-place', placing);
    if (placing) bsFillBoard('bs-a', bsUI.fleet.map(f => ({ ship: f, mode: '' })), BS_EMPTY, null);
    else bsFillBoard('bs-a', show(left, sunkLeft, duelist || over), shotsOnLeft, s.last && s.last.by === right ? s.last : null);
    bsRenderHover();
    document.getElementById('bs-fleet-a').innerHTML = placing
        ? bsChips(null, null, { pick: true, sel: bsUI.sel, placed: bsUI.fleet.map(f => f.k) })
        : bsChips(null, s.phase === 'PLACE' ? null : sunkLeft);

    // ----- colonne droite : panneau de déploiement, ou secteur adverse -----
    const wrapB = document.getElementById('bs-wrap-b'), panel = document.getElementById('bs-panel');
    const showPanel = s.phase === 'PLACE' && duelist;
    wrapB.style.display = showPanel ? 'none' : '';
    panel.style.display = showPanel ? '' : 'none';
    if (showPanel) {
        const all = bsUI.fleet.length === BS_SHIPS.length;
        panel.innerHTML = placing ? `
            <div style="font-weight:900;font-size:1.15em;color:#fde68a">🛠️ Déploiement de la flotte</div>
            <div style="font-size:.85em;color:#cbd5e1;line-height:1.5">1. Choisissez un vaisseau dans la liste sous votre secteur.<br>2. Touchez une case pour le poser (l'aperçu vert indique un emplacement libre).<br>3. Touchez un vaisseau déjà posé pour le reprendre.<br>Les vaisseaux ne peuvent pas se chevaucher. L'adversaire ne voit pas votre secteur.</div>
            <div style="display:flex;flex-wrap:wrap;gap:.5em">
                <button class="bs-btn" data-act="rotate">🔄 Pivoter (${bsUI.v ? 'vertical' : 'horizontal'})</button>
                <button class="bs-btn" data-act="random">🎲 Placement aléatoire</button>
                <button class="bs-btn" data-act="clear" ${bsUI.fleet.length ? '' : 'disabled'}>🧹 Tout retirer</button>
            </div>
            <button class="bs-btn bs-btn-go" data-act="ready" ${all ? '' : 'disabled'} style="font-size:1.05em;padding:.8em">${all ? '✅ Valider ma flotte' : `Placez encore ${BS_SHIPS.length - bsUI.fleet.length} vaisseau${BS_SHIPS.length - bsUI.fleet.length > 1 ? 'x' : ''}`}</button>
            <div style="font-size:.75em;color:#94a3b8">Astuce : la touche R ou un clic droit fait aussi pivoter. Sans validation à la fin du temps, la flotte est placée au hasard.</div>`
            : `<div style="font-weight:900;font-size:1.15em;color:#6ee7b7">✅ Flotte déployée</div>
            <div style="font-size:.9em;color:#cbd5e1">En attente de ${bsEsc(bsOther(s, me))}...</div>
            <button class="bs-btn" data-act="edit">✏️ Modifier mon placement</button>`;
    } else {
        svgB.classList.toggle('bs-fire', !over && duelist && s.phase === 'BATTLE' && actor === me);
        bsFillBoard('bs-b', show(right, sunkRight, over), shotsOnRight, s.last && s.last.by === left ? s.last : null);
    }
    document.getElementById('bs-fleet-b').innerHTML = showPanel ? '' : bsChips(null, sunkRight);

    // ----- pied : journal + fin de partie -----
    document.getElementById('bs-log').innerHTML = s.log.slice(-3).reverse().map((l, i) => `<span style="${i ? 'opacity:.55' : 'color:#f8fafc;font-weight:700'}">${bsEsc(l)}</span>`).join(' &nbsp;·&nbsp; ');
    const end = document.getElementById('bs-end');
    end.style.display = over ? '' : 'none';
    bsTick();
}
function bsCurrent() { const d = window.bsData; return d && d.bsGame && d.bsGame.s ? bsNorm(d.bsGame.s) : null; }
function bsTick() {
    const s = bsCurrent(), el = document.getElementById('bs-timer');
    if (!s || !el) return;
    if (s.status !== 'PLAYING') { el.textContent = 'Combat terminé'; return; }
    el.textContent = (s.phase === 'PLACE' ? 'Déploiement : ' : 'Tir : ') + Math.max(0, Math.ceil((s.dl - Date.now()) / 1000)) + ' s';
}

function bsOnCell(b, x, y) {
    const s = bsCurrent(), me = bsMe();
    if (!s || s.status !== 'PLAYING' || s.duel.indexOf(me) < 0) return;
    if (s.phase === 'PLACE' && b === 'bs-a' && !s.ready[me]) {
        const idx = y * BS.N + x;
        const ship = { k: bsUI.sel, x: x, y: y, v: bsUI.v };
        if (bsUI.sel >= 0 && bsCanAdd(bsUI.fleet, ship)) {
            bsUI.fleet.push(ship);
            bsUI.sel = bsNextUnplaced();
        } else {
            const hit = bsUI.fleet.find(f => bsCells(f).indexOf(idx) >= 0);      // reprendre un vaisseau posé
            if (hit) { bsUI.fleet = bsUI.fleet.filter(f => f !== hit); bsUI.sel = hit.k; bsUI.v = hit.v; }
        }
        bsRender(s);
    } else if (s.phase === 'BATTLE' && b === 'bs-b' && s.duel[s.turn] === me && s.shots[me][y * BS.N + x] === '.') {
        bsSend({ t: 'fire', x: x, y: y });
    }
}
function bsOnAct(d) {
    const s = bsCurrent();
    if (!s) return;
    if (d.act === 'ship') { bsUI.sel = Number(d.k); bsUI.fleet = bsUI.fleet.filter(f => f.k !== bsUI.sel); }
    else if (d.act === 'rotate') bsUI.v = !bsUI.v;
    else if (d.act === 'random') { bsUI.fleet = bsRandomFleet(); bsUI.sel = -1; }
    else if (d.act === 'clear') { bsUI.fleet = []; bsUI.sel = 0; }
    else if (d.act === 'ready') { if (bsValidFleet(bsUI.fleet)) bsSend({ t: 'place', fleet: bsUI.fleet }); return; }
    else if (d.act === 'edit') { bsSend({ t: 'edit' }); return; }
    bsRender(s);
}
function bsBuildLayout() {
    const content = document.getElementById('generic-game-content');
    if (!content) return;
    let st = document.getElementById('bs-style');
    if (!st) { st = document.createElement('style'); st.id = 'bs-style'; document.head.appendChild(st); }
    st.textContent = BS_CSS;
    content.innerHTML = `
        <div id="bs-root">
            <div id="bs-top">
                <span class="sci-font" style="font-weight:800;letter-spacing:.2em;color:#a5b4fc">🛸 BATAILLE STELLAIRE</span>
                <span id="bs-log" style="flex:1;min-width:0;font-size:.72em;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center"></span>
                <span id="bs-timer" style="font-family:monospace;font-weight:bold;color:#fbbf24;white-space:nowrap"></span>
            </div>
            <div id="bs-banner"></div>
            <div id="bs-main">
                <div id="bs-col-a" class="bs-col">
                    <div id="bs-head-a" class="bs-head"></div>
                    <div class="bs-wrap">${bsBoardSvg('bs-a')}</div>
                    <div id="bs-fleet-a" class="bs-fleet"></div>
                </div>
                <div id="bs-col-b" class="bs-col">
                    <div id="bs-head-b" class="bs-head"></div>
                    <div id="bs-wrap-b" class="bs-wrap">${bsBoardSvg('bs-b')}</div>
                    <div id="bs-panel" class="bs-panel" style="display:none"></div>
                    <div id="bs-fleet-b" class="bs-fleet"></div>
                </div>
            </div>
            <div id="bs-end" style="display:none;flex-shrink:0;text-align:center">
                <button onclick="backToLobby()" class="bs-btn bs-btn-go" style="font-size:1.05em;padding:.8em 2em">Retour au salon</button>
            </div>
        </div>`;
    const root = document.getElementById('bs-root');
    root.onclick = e => {
        const t = e.target.closest ? e.target : null;
        if (!t) return;
        const cell = t.closest('.bs-cell');
        if (cell) { bsOnCell(cell.getAttribute('data-b'), Number(cell.getAttribute('data-x')), Number(cell.getAttribute('data-y'))); return; }
        const b = t.closest('[data-act]');
        if (b && !b.disabled) bsOnAct(b.dataset);
    };
    root.onmousemove = e => {
        const cell = e.target.closest ? e.target.closest('.bs-cell') : null;
        const h = cell && cell.getAttribute('data-b') === 'bs-a' ? { x: Number(cell.getAttribute('data-x')), y: Number(cell.getAttribute('data-y')) } : null;
        if ((h && bsUI.hover && h.x === bsUI.hover.x && h.y === bsUI.hover.y) || (!h && !bsUI.hover)) return;
        bsUI.hover = h; bsRenderHover();
    };
    root.oncontextmenu = e => {
        if (e.target.closest && e.target.closest('#bs-a')) { e.preventDefault(); bsUI.v = !bsUI.v; const s = bsCurrent(); if (s) bsRender(s); }
    };
    if (!window.bsKeyBound) {
        window.bsKeyBound = true;
        document.addEventListener('keydown', e => {
            if ((e.key === 'r' || e.key === 'R') && document.getElementById('bs-root') && document.getElementById('bs-root').offsetParent !== null) {
                const s = bsCurrent();
                if (s && s.phase === 'PLACE' && s.status === 'PLAYING') { bsUI.v = !bsUI.v; bsRender(s); }
            }
        });
    }
}

// Duellistes : ceux choisis par l'hôte ; une place laissée « au hasard » est tirée parmi les autres joueurs
function bsPickDuel(names, p1, p2, rnd) {
    rnd = rnd || Math.random;
    let a = names.indexOf(p1) >= 0 ? p1 : '', b = names.indexOf(p2) >= 0 && p2 !== a ? p2 : '';
    const pool = names.filter(n => n !== a && n !== b);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    if (!a) a = pool.shift();
    if (!b) b = pool.shift();
    return [a, b];
}
// Salon : listes « Duelliste 1 / 2 » de l'hôte, tenues à jour quand des joueurs arrivent ou partent
function bsRefreshDuelSelects() {
    const names = Object.values((typeof state !== 'undefined' && state.players) || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    let changed = false;
    ['setting-bataille-p1', 'setting-bataille-p2'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const sig = names.join('\u0001');
        if (sel.dataset.sig === sig) return;
        sel.dataset.sig = sig;
        const keep = names.indexOf(sel.value) >= 0 ? sel.value : '';
        if (keep !== sel.value) changed = true;
        sel.innerHTML = '<option value="">🎲 Au hasard</option>' + names.map(n => `<option value="${bsEsc(n)}">${bsEsc(n)}</option>`).join('');
        sel.value = keep;
    });
    if (changed && window.isHost && typeof updateHostSettings === 'function') updateHostSettings();
}
// Un même joueur ne peut pas occuper les deux places
function bsDuelChanged(which) {
    const a = document.getElementById('setting-bataille-p1'), b = document.getElementById('setting-bataille-p2');
    if (a && b && a.value && a.value === b.value) (which === 1 ? b : a).value = '';
}

if (typeof window !== 'undefined') {
    // --------------------------- Lancement (hôte) ---------------------------
    window.startBatailleGame = function() {
        if (!window.isHost) return;
        const code = bsRoom();
        if (!code || !window.mettreAJourSalonFirebase) return;
        const names = Object.values(state.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
        if (names.length < 2) {
            if (typeof showToast === 'function') showToast('⚠️ Il faut 2 joueurs pour le mode Bataille Stellaire !');
            return;
        }
        const duel = bsPickDuel(names, document.getElementById('setting-bataille-p1')?.value, document.getElementById('setting-bataille-p2')?.value);
        const timer = Math.max(10, Math.min(60, parseInt(document.getElementById('input-host-timer')?.value, 10) || 30));
        const again = (document.getElementById('setting-bataille-again')?.value || '1') === '1';
        const s = bsNewGame(duel, { timer: timer, again: again }, Date.now());
        bsHost.startedAt = s.startedAt; bsHost.state = s; bsHost.done = {};
        const updates = { status: 'IN_GAME', selectedMode: 'bataille', 'settings/timer': timer, 'settings/bsAgain': again ? '1' : '0', bsGame: { s: s } };
        Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
        window.mettreAJourSalonFirebase(code, updates);
    };

    // --------------------------- Rendu (appelé à chaque mise à jour Firebase) ---------------------------
    window.renderBatailleScreen = function(data) {
        const g = data && data.bsGame;
        if (!g || !g.s) return;
        const s = bsNorm(g.s);
        const sess = String(s.startedAt);
        // jamais d'affichage d'un état plus ancien que celui déjà à l'écran (écritures imbriquées de l'hôte)
        if (bsUI.seenSess === sess && s.seq < bsUI.seenSeq) return;
        bsUI.seenSess = sess; bsUI.seenSeq = s.seq;
        window.bsData = data;
        try {
            if (!window.bsTicker) window.bsTicker = setInterval(() => { bsTick(); bsHostTick(); }, 1000);
            if (bsUI.sess !== sess || !document.getElementById('bs-root')) {
                bsUI.sess = sess; bsUI.sig = ''; bsUI.fleet = []; bsUI.sel = 0; bsUI.v = false; bsUI.hover = null;
                showScreen('screen-generic-game');
                const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = 'Bataille Stellaire';
                bsBuildLayout();
            }
            bsRender(s);
        } finally { if (window.isHost) bsHostProcess(data); }      // l'arbitrage se fait APRÈS l'affichage
    };
}
