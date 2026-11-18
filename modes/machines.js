// =====================================================================
//  MODE « SALLE DES MACHINES » (coopératif, temps réel)
//  Le vaisseau tombe en panne. Chaque membre d'équipage est responsable d'un secteur du vaisseau (vu de haut)
//  et déplace son astronaute jusqu'aux consoles. Chacun reçoit des ordres qui concernent presque toujours
//  le secteur d'un autre : il faut les crier ! 10 ordres réussis = saut hyperespace vers le secteur suivant.
//  Un ordre raté abîme la coque. Moins de 4 joueurs : des androïdes tiennent les secteurs libres.
//
//  Fichiers : modes/machines-vaisseaux.js (plans des 18 vaisseaux, chargé à la demande),
//             machine-visuel/vaisseaux/*.jpg (images), machine-visuel/astronaute.webp (+ masque de la combinaison).
//  Données Firebase : salons/<code>/smGame/s   état de la partie (écrit par l'hôte seulement)
//                     salons/<code>/smGame/a   actions des joueurs (crier, utiliser une console), traitées par l'hôte
//                     salons/<code>__machines  positions des astronautes (hors du salon pour ne pas le réafficher
//                                              à chaque pas ; repli dans salons/<code>/smPos si c'est refusé)
//                     players/<nom>/smCouleur  couleur choisie dans le salon
// =====================================================================

const SM = { W: 86, H: 48, CELL: 20, IMG_W: 1720, IMG_H: 960, BUT: 10, DIR: './machine-visuel/', FRAME: 96, AX: 0.5, AY: 0.835, MARCHE: 12, REPOS: 8, PORTEE: 1.75,
    MARCHE_V: 4.2, COURSE_V: 7.2, ENDU_PERTE: 0.3, ENDU_GAIN: 0.2, ENDU_REPRISE: 0.35 };     // vitesses en cases/s ; endurance de 0 à 1
const SM_SECTEURS = [
    { n: 'Réacteurs', c: '251,146,60' }, { n: 'Pilotage', c: '34,211,238' },
    { n: 'Navigation', c: '167,139,250' }, { n: 'Soute', c: '74,222,128' }
];
const SM_COULEURS = [
    { k: 'rouge', n: 'Rouge', h: '#ef4444' }, { k: 'bleu', n: 'Bleu', h: '#3b82f6' }, { k: 'vert', n: 'Vert', h: '#22c55e' },
    { k: 'jaune', n: 'Jaune', h: '#facc15' }, { k: 'orange', n: 'Orange', h: '#f97316' }, { k: 'violet', n: 'Violet', h: '#a855f7' },
    { k: 'rose', n: 'Rose', h: '#f472b6' }, { k: 'cyan', n: 'Cyan', h: '#22d3ee' }, { k: 'blanc', n: 'Blanc', h: '#f8fafc' },
    { k: 'noir', n: 'Noir', h: '#3f3f46', t: '#a1a1aa' }, { k: 'marron', n: 'Marron', h: '#a16207' }, { k: 'lime', n: 'Citron vert', h: '#a3e635' }
];
const SM_NOMS = ['Condensateur quantique', 'Purgeur de plasma', 'Gyrostabilisateur', 'Valve à tachyons', 'Bobine de flux', 'Hyperpropulseur',
    'Déflecteur arrière', 'Pompe à neutrinos', 'Injecteur d’antimatière', 'Relais gravitationnel', 'Capteur à bosons', 'Turbine ionique',
    'Filtre à photons', 'Ventilateur cryogénique', 'Compensateur d’inertie', 'Grappin magnétique', 'Réacteur auxiliaire', 'Sonde à muons',
    'Collecteur stellaire', 'Bouclier de proue', 'Régulateur de gravité', 'Accumulateur à fusion', 'Antenne subspatiale', 'Recycleur d’oxygène',
    'Amortisseur sonique', 'Tuyère vectorielle', 'Batterie à positrons', 'Calibreur de radar'];
const SM_TYPES = ['bouton', 'bouton', 'inter', 'curseur'];        // console j de chaque secteur
const SM_ANDROIDES = ['Zara', 'Milo', 'Kiki', 'Nox'];

// ============================ 1) OUTILS COMMUNS (sans navigateur) ============================
const smCacheGrille = {};
function smGrille(ship) {
    if (smCacheGrille[ship]) return smCacheGrille[ship];
    const v = (typeof window !== 'undefined' && window.SM_VAISSEAUX ? window.SM_VAISSEAUX : (typeof SM_VAISSEAUX_NODE !== 'undefined' ? SM_VAISSEAUX_NODE : []))[ship];
    if (!v) return null;
    const sol = new Uint8Array(SM.W * SM.H), sec = new Int8Array(SM.W * SM.H).fill(-1);
    v.g.forEach((ligne, y) => { for (let x = 0; x < SM.W; x++) { const c = ligne[x]; if (c >= '0' && c <= '3') { sol[y * SM.W + x] = 1; sec[y * SM.W + x] = +c; } } });
    const consoles = v.c.map((c, i) => ({ id: 'c' + c[2] + (i % 4), x: c[0], y: c[1], s: c[2], j: i % 4, type: SM_TYPES[i % 4], b: !!c[3] }));
    return smCacheGrille[ship] = { v, sol, sec, consoles, departs: v.d };
}
function smEstLibre(G, x, y, feux) {
    if (x < 0 || y < 0 || x >= SM.W || y >= SM.H || !G.sol[y * SM.W + x]) return false;
    return !(feux && feux[y * SM.W + x]);
}
function smCasesFeu(s) {        // ensemble des cases en feu (clé = indice de case)
    const out = {};
    Object.values((s && s.feux) || {}).forEach(f => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out[(f.y + dy) * SM.W + f.x + dx] = 1; });
    return out;
}
// Chemin le plus court (8 directions, pas de coin coupé) d'une case à une autre ; null si impossible
function smChemin(G, dep, arr, feux) {
    const W = SM.W, cle = (x, y) => y * W + x;
    if (dep[0] === arr[0] && dep[1] === arr[1]) return [];
    const vu = new Int32Array(W * SM.H).fill(-2), file = [cle(dep[0], dep[1])];
    vu[file[0]] = -1;
    for (let i = 0; i < file.length; i++) {
        const k = file[i], x = k % W, y = (k / W) | 0;
        if (x === arr[0] && y === arr[1]) {
            const p = []; let c = k;
            while (vu[c] !== -1) { p.unshift([c % W, (c / W) | 0]); c = vu[c]; }
            return p;
        }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (!smEstLibre(G, nx, ny, feux)) continue;
            if (dx && dy && (!smEstLibre(G, x + dx, y, feux) || !smEstLibre(G, x, y + dy, feux))) continue;
            const n = cle(nx, ny);
            if (vu[n] !== -2) continue;
            vu[n] = k; file.push(n);
        }
    }
    return null;
}
// Chemin vers une case ; si elle est occupée (console, mur), vers la case libre voisine la plus proche
function smCheminVers(G, dep, x, y, feux) {
    if (smEstLibre(G, x, y, feux)) return smChemin(G, dep, [x, y], feux);
    let mieux = null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || !smEstLibre(G, x + dx, y + dy, feux)) continue;
        const ch = smChemin(G, dep, [x + dx, y + dy], feux);
        if (ch && (!mieux || ch.length < mieux.length)) mieux = ch;
    }
    return mieux;
}
function smCaseLibreProche(G, x, y, feux) {         // la case libre la plus proche (pour poser un astronaute)
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (smEstLibre(G, x + dx, y + dy, feux)) return [x + dx, y + dy];
    }
    return [x, y];
}
function smTexte(nom, type, v) {
    if (type === 'bouton') return `Activez : ${nom} !`;
    if (type === 'inter') return `${v ? 'Allumez' : 'Éteignez'} : ${nom} !`;
    return `Réglez : ${nom} sur ${v} !`;
}
function smMelange(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function smAlea(a, b) { return a + Math.random() * (b - a); }
function smEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function smCouleurInfo(k) { return SM_COULEURS.find(c => c.k === k) || null; }
// Une couleur par joueur : les choix enregistrés d'abord (dans l'ordre des joueurs), puis la première couleur libre
function smCouleursAttribuees(noms, players) {
    const out = {}, pris = {};
    noms.forEach(n => { const k = players && players[n] && players[n].smCouleur; if (k && smCouleurInfo(k) && !pris[k]) { pris[k] = 1; out[n] = k; } });
    noms.forEach((n, i) => {
        if (out[n]) return;
        for (let j = 0; j < SM_COULEURS.length; j++) { const k = SM_COULEURS[(i + j) % SM_COULEURS.length].k; if (!pris[k]) { pris[k] = 1; out[n] = k; return; } }
        out[n] = SM_COULEURS[i % SM_COULEURS.length].k;
    });
    return out;
}

// ============================ 2) MOTEUR DE LA PARTIE (hôte) ============================
// Nouvelle partie : équipage (humains + androïdes), noms des consoles, état initial
function smNouvellePartie(noms, players, opts, now) {
    const ship = opts.ship, G = smGrille(ship);
    const crew = {}, couleurs = smCouleursAttribuees(noms, players);
    noms.forEach((n, i) => { crew[n] = { sec: i % 4, col: couleurs[n], bot: 0, nom: n }; });
    const libres = SM_COULEURS.map(c => c.k).filter(k => !Object.values(couleurs).includes(k));
    for (let k = noms.length; k < 4; k++) {
        const cle = 'bot' + k;
        crew[cle] = { sec: k, col: libres[k - noms.length] || SM_COULEURS[k].k, bot: 1, nom: SM_ANDROIDES[k] + ' 🤖' };
    }
    const nomsConsoles = smMelange(SM_NOMS), cons = {}, etiquettes = {};
    G.consoles.forEach((c, i) => { etiquettes[c.id] = nomsConsoles[i]; cons[c.id] = c.type === 'curseur' ? 0 : false; });
    return {
        v: 1, startedAt: now, seq: 1, hn: now, status: 'PLAYING', ship: ship, obj: opts.obj, pos: opts.pos || 'int',
        crew: crew, noms: etiquettes, cons: cons, ord: {}, log: [{ k: 1, t: 'Moteurs en surchauffe ! Tenez le vaisseau jusqu’au saut hyperespace.', c: 'info' }],
        feux: {}, noir: 0, saut: 0, degat: 0, flash: {}, niveau: 1, prog: 0, coque: 100, total: 0, fait: {}, fin: null, lk: 1
    };
}
function smNormaliser(s) {
    s = JSON.parse(JSON.stringify(s || {}));
    ['crew', 'noms', 'cons', 'ord', 'feux', 'flash', 'fait'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    s.log = Array.isArray(s.log) ? s.log.filter(Boolean) : Object.values(s.log || {}).filter(Boolean);
    Object.keys(s.cons).forEach(k => { if (s.cons[k] === undefined) s.cons[k] = false; });
    return s;
}
function smDire(s, t, c, n) { s.lk = (s.lk || 0) + 1; s.log.push({ k: s.lk, t: t, c: c || '', n: n || '' }); while (s.log.length > 8) s.log.shift(); }
function smDureeOrdre(s) { return Math.max(11, 20 - s.niveau * 1.5) * 1000; }

// Moteur : un objet par partie, tenu par l'hôte (s = état partagé, b = positions et cerveaux des androïdes)
function smMoteur(s) {
    return { s: s, pend: {}, b: {}, cri: {}, prochInc: 0, pos: {} };
}
function smNouvelOrdre(M, n, now) {
    const s = M.s, G = smGrille(s.ship), m = s.crew[n];
    if (!m || s.status !== 'PLAYING' || s.saut) return;
    const prises = {}; Object.values(s.ord).forEach(o => { prises[o.c] = 1; });
    const ailleurs = Math.random() > 0.12;
    let choix = G.consoles.filter(c => (ailleurs ? c.s !== m.sec : c.s === m.sec) && !prises[c.id]);
    if (!choix.length) choix = G.consoles.filter(c => !prises[c.id]);
    if (!choix.length) { M.pend[n] = now + 600; return; }
    const c = choix[Math.floor(Math.random() * choix.length)];
    let v = true;
    if (c.type === 'inter') v = !s.cons[c.id];
    if (c.type === 'curseur') { do { v = Math.floor(Math.random() * 6); } while (v === s.cons[c.id]); }
    s.ord[n] = { c: c.id, v: v, t0: now, d: smDureeOrdre(s), cr: 0 };
    if (m.bot) M.cri[n] = now + smAlea(600, 1600);
}
function smCrier(M, n, now) {
    const s = M.s, o = s.ord[n];
    if (!o || o.cr) return false;
    o.cr = now;
    const G = smGrille(s.ship), c = G.consoles.find(x => x.id === o.c);
    smDire(s, smTexte(s.noms[o.c], c.type, o.v), 'cri', n);
    // les androïdes responsables de ce secteur y vont
    Object.keys(s.crew).forEach(k => { if (s.crew[k].bot && s.crew[k].sec === c.s) smConfier(M, k, c, o.v, now, o.t0 + o.d); });
    return true;
}
function smConfier(M, k, c, cible, now, fin) {
    const s = M.s, b = M.b[k]; if (!b) return;
    const reussit = Math.random() < Math.max(0.72, 0.96 - s.niveau * 0.04);
    const v = c.type === 'bouton' ? true : reussit ? cible : (c.type === 'inter' ? !cible : (cible + 1 + Math.floor(Math.random() * 4)) % 6);
    b.file = (b.file || []).filter(t => t.c !== c.id);
    b.file.push({ c: c.id, v: v, des: now + smAlea(400, 1000), fin: fin || 0 });
}
function smAgir(M, by, cid, v, now) {
    const s = M.s, G = smGrille(s.ship), c = G.consoles.find(x => x.id === cid);
    if (!c || s.status !== 'PLAYING' || s.saut) return false;
    if (c.type === 'curseur') v = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    else v = c.type === 'bouton' ? true : !!v;
    s.cons[cid] = c.type === 'bouton' ? false : v;
    s.flash[cid] = now;
    const n = Object.keys(s.ord).find(k => s.ord[k].c === cid && (c.type === 'bouton' || s.ord[k].v === v));
    if (n) smReussite(M, n, by, now);
    return true;
}
function smReussite(M, n, by, now) {
    const s = M.s;
    delete s.ord[n]; delete M.cri[n];
    s.prog++; s.total++; s.fait[by] = (s.fait[by] || 0) + 1;
    const qui = (s.crew[by] && s.crew[by].nom) || by, pour = (s.crew[n] && s.crew[n].nom) || n;
    smDire(s, by === n ? `✔ ${qui} a exécuté son propre ordre` : `✔ Ordre de ${pour} exécuté par ${qui}`, 'ok');
    if (s.prog >= SM.BUT) return smSaut(M, now);
    M.pend[n] = now + smAlea(700, 1400);
}
function smEchec(M, n, now) {
    const s = M.s, o = s.ord[n], G = smGrille(s.ship), c = G.consoles.find(x => x.id === o.c);
    smDire(s, `✖ Trop tard : ${s.noms[o.c]} (${SM_SECTEURS[c.s].n}). Coque endommagée !`, 'ko');
    delete s.ord[n]; delete M.cri[n];
    s.coque = Math.max(0, s.coque - 12); s.degat = now;
    if (s.coque <= 0) return smFin(M, false, now);
    M.pend[n] = now + 1200;
}
function smSaut(M, now) {
    const s = M.s;
    s.ord = {}; M.pend = {}; M.cri = {};
    Object.values(M.b).forEach(b => { b.file = []; });
    if (s.obj && s.niveau >= s.obj) { smDire(s, `🚀 Dernier saut hyperespace : le vaisseau est sauvé !`, 'info'); return smFin(M, true, now); }
    s.saut = now + 2200;
    smDire(s, `🚀 SAUT HYPERESPACE vers le secteur ${s.niveau + 1} !`, 'info');
}
function smFin(M, victoire, now) {
    const s = M.s;
    s.status = 'FINISHED'; s.ord = {}; s.feux = {}; s.noir = 0; s.saut = 0;
    s.fin = { victoire: !!victoire, t: now };
    smDire(s, victoire ? '🏆 Mission accomplie !' : '💥 Le vaisseau est perdu…', victoire ? 'ok' : 'ko');
}
function smScore(s, n) { return (s.fait[n] || 0) * 10 + (s.niveau - 1) * 20 + (s.fin && s.fin.victoire ? 100 : 0); }
function smIncident(M, now) {
    const s = M.s, G = smGrille(s.ship);
    if (Math.random() < 0.55) {
        // incendie : bloque un passage (3 × 3 cases) entre deux secteurs, sans couper le vaisseau en deux
        const passages = [];
        for (let y = 1; y < SM.H - 1; y++) for (let x = 1; x < SM.W - 1; x++) {
            const k = y * SM.W + x; if (!G.sol[k]) continue;
            if ([1, -1, SM.W, -SM.W].some(d => G.sec[k + d] >= 0 && G.sec[k + d] !== G.sec[k])) passages.push([x, y]);
        }
        for (const [x, y] of smMelange(passages).slice(0, 12)) {
            const essai = Object.assign({}, s.feux, { ['f' + now]: { x: x, y: y, f: now + 10000 } });
            const feux = smCasesFeu({ feux: essai });
            const occupe = Object.values(M.pos).some(p => p && Math.abs(Math.round(p.x) - x) <= 1 && Math.abs(Math.round(p.y) - y) <= 1);
            if (occupe || !smToutRelie(G, feux)) continue;
            s.feux = essai;
            smDire(s, `🔥 INCENDIE entre deux secteurs ! Le passage est bloqué, faites le tour.`, 'ko');
            return;
        }
    }
    s.noir = now + 8000;
    smDire(s, '🔦 PANNE DE COURANT ! Vous ne voyez plus qu’autour de vous.', 'ko');
}
function smToutRelie(G, feux) {
    let dep = -1, total = 0;
    for (let k = 0; k < G.sol.length; k++) if (G.sol[k] && !feux[k]) { total++; if (dep < 0) dep = k; }
    if (dep < 0) return false;
    const vu = new Uint8Array(G.sol.length), file = [dep]; vu[dep] = 1;
    for (let i = 0; i < file.length; i++) {
        const k = file[i];
        for (const d of [1, -1, SM.W, -SM.W]) { const n = k + d; if (n >= 0 && n < vu.length && !vu[n] && G.sol[n] && !feux[n]) { vu[n] = 1; file.push(n); } }
    }
    return file.length === total;
}
function smPlacerAndroide(M, k) {
    const s = M.s, G = smGrille(s.ship), m = s.crew[k], d = G.departs[m.sec];
    const p = M.pos[k] || null;
    const [x, y] = p ? [Math.round(p.x), Math.round(p.y)] : smCaseLibreProche(G, d[0] + 1, d[1], null);
    M.b[k] = { x: x, y: y, d: 0, w: 0, chemin: [], file: [], flane: Date.now() + smAlea(1500, 4000), attente: 0 };
}
// Une étape de simulation de l'hôte (dt en secondes). Renvoie true si l'état partagé a changé.
function smEtape(M, now, dt, presents) {
    const s = M.s; let change = false;
    if (s.status !== 'PLAYING') return false;
    // joueurs partis : un androïde prend leur poste ; joueur revenu : il reprend la main
    if (presents) Object.keys(s.crew).forEach(n => {
        const m = s.crew[n]; if (n.indexOf('bot') === 0) return;
        const la = !!presents[n];
        if (!la && !m.bot) {
            m.bot = 1; m.nom = n + ' 🤖'; smPlacerAndroide(M, n);
            if (s.ord[n] && !s.ord[n].cr) M.cri[n] = now + 800;
            smDire(s, `📡 ${n} a perdu la liaison : un androïde prend son poste.`, 'info'); change = true;
        }
        else if (la && m.bot) { m.bot = 0; m.nom = n; delete M.b[n]; smDire(s, `📡 ${n} a repris son poste.`, 'info'); change = true; }
    });
    Object.keys(s.crew).forEach(n => { if (s.crew[n].bot && !M.b[n]) smPlacerAndroide(M, n); });
    if (s.saut) {
        if (now < s.saut) return change;
        s.saut = 0; s.niveau++; s.prog = 0; s.coque = Math.min(100, s.coque + 10); s.feux = {}; s.noir = 0;
        smDire(s, `Secteur ${s.niveau} : les pannes s’accélèrent. Coque réparée de 10 %.`, 'info');
        Object.keys(s.crew).forEach((n, i) => { M.pend[n] = now + 600 + i * 500; });
        M.prochInc = now + smAlea(14000, 22000);
        change = true;
    }
    if (!M.prochInc) M.prochInc = now + smAlea(14000, 22000);
    // ordres expirés
    for (const n of Object.keys(s.ord)) {
        const o = s.ord[n];
        if (now - o.t0 > o.d) { smEchec(M, n, now); change = true; if (s.status !== 'PLAYING') return true; }
    }
    // nouveaux ordres (au départ, chacun en reçoit un, l'un après l'autre)
    Object.keys(s.crew).forEach((n, i) => {
        if (s.ord[n] || s.saut) return;
        if (M.pend[n] === undefined) M.pend[n] = now + 1200 + i * 1100;
        if (now >= M.pend[n]) { delete M.pend[n]; smNouvelOrdre(M, n, now); change = true; }
    });
    // les androïdes crient leurs ordres
    Object.keys(M.cri).forEach(n => { if (now >= M.cri[n]) { delete M.cri[n]; if (smCrier(M, n, now)) change = true; } });
    // cerveau et déplacement des androïdes
    const G = smGrille(s.ship), feux = smCasesFeu(s);
    Object.keys(M.b).forEach(k => {
        const b = M.b[k], m = s.crew[k]; if (!m || !m.bot) return;
        const t = b.file && b.file[0];
        if (t && now >= t.des) {
            const c = G.consoles.find(x => x.id === t.c);
            if (Math.hypot(c.x - b.x, c.y - b.y) < 1.6 && !b.chemin.length) {
                b.file.shift();
                if (smAgir(M, k, c.id, t.v, now)) change = true;
                b.flane = now + smAlea(1500, 3500);
            } else if (!b.chemin.length && now >= b.attente) {
                const ch = smCheminVers(G, [Math.round(b.x), Math.round(b.y)], c.x, c.y, feux);
                if (ch) b.chemin = ch; else b.attente = now + 700;      // passage bloqué par un incendie : il réessaie
            }
        } else if (!t && now > b.flane && !b.chemin.length) {
            b.flane = now + smAlea(2500, 6000);
            const cases = [];
            for (let i = 0; i < 30; i++) { const x = Math.floor(Math.random() * SM.W), y = Math.floor(Math.random() * SM.H); if (G.sec[y * SM.W + x] === m.sec && smEstLibre(G, x, y, feux)) cases.push([x, y]); }
            const d = G.departs[m.sec], proches = cases.filter(c => Math.hypot(c[0] - d[0], c[1] - d[1]) < 9);
            const cible = (proches.length ? proches : cases)[0];
            if (cible) b.chemin = smChemin(G, [Math.round(b.x), Math.round(b.y)], cible, feux) || [];
        }
        b.r = t && t.fin && t.fin - now < 8000 ? 1 : 0;          // ordre urgent : il court
        smAvancer(b, G, feux, (b.r ? 5.6 : 3.4) * dt);
    });
    // incidents à partir du secteur 2
    if (s.niveau >= 2 && now > M.prochInc && !s.saut) { M.prochInc = now + Math.max(11000, smAlea(19000, 27000) - s.niveau * 1200); smIncident(M, now); change = true; }
    Object.keys(s.feux).forEach(k => { if (s.feux[k].f < now) { delete s.feux[k]; change = true; } });
    if (s.noir && s.noir < now) { s.noir = 0; change = true; }
    Object.keys(s.flash).forEach(k => { if (now - s.flash[k] > 1500) { delete s.flash[k]; } });
    return change;
}
function smAvancer(p, G, feux, pas) {        // suit son chemin de case en case
    let reste = pas, bouge = false;
    while (reste > 0 && p.chemin.length) {
        const [tx, ty] = p.chemin[0];
        if (!smEstLibre(G, tx, ty, feux)) { p.chemin = []; break; }
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        if (d > 1e-6) p.d = smDirection(dx, dy);
        if (d <= reste) { p.x = tx; p.y = ty; p.chemin.shift(); reste -= d; }
        else { p.x += dx / d * reste; p.y += dy / d * reste; reste = 0; }
        bouge = true;
    }
    p.w = bouge ? 1 : 0;
}
function smDirection(dx, dy) { return ((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) % 8) + 8) % 8; }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SM, SM_COULEURS, SM_TYPES, smGrille, smChemin, smCheminVers, smEstLibre, smCasesFeu, smNouvellePartie, smNormaliser, smMoteur, smEtape, smCrier, smAgir, smScore, smToutRelie, smCouleursAttribuees, smTexte, smAvancer, smDirection };
}

// ============================ 3) DANS LE NAVIGATEUR ============================
if (typeof window !== 'undefined') (function () {
    // anciens navigateurs : rectangle arrondi dessiné comme un simple rectangle
    if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
    const salon = () => window.currentCodeSalon || (typeof state !== 'undefined' && state.roomCode);
    const moi = () => window.myPlayerKey || (typeof state !== 'undefined' && state.username);
    const son = n => { if (typeof window.sfx === 'function') { try { window.sfx(n); } catch (e) {} } };

    // ---------------- Astronautes : planche d'animation et recoloriage de la combinaison ----------------
    const spr = { base: null, masque: null, pret: false, attente: [], teintes: {} };
    function smChargerSprites(cb) {
        if (spr.pret) { if (cb) cb(); return; }
        if (cb) spr.attente.push(cb);
        if (spr.base) return;
        let n = 0; const fini = () => { if (++n < 2) return; spr.pret = true; spr.attente.splice(0).forEach(f => f()); };
        spr.base = new Image(); spr.base.onload = fini; spr.base.src = SM.DIR + 'astronaute.webp';
        spr.masque = new Image(); spr.masque.onload = fini; spr.masque.src = SM.DIR + 'astronaute-masque.webp';
    }
    function smTeinte(k) {
        if (spr.teintes[k]) return spr.teintes[k];
        if (!spr.pret) return null;
        const info = smCouleurInfo(k) || SM_COULEURS[0];
        const W = spr.base.naturalWidth, H = spr.base.naturalHeight;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d'); g.drawImage(spr.base, 0, 0);
        const m = document.createElement('canvas'); m.width = W; m.height = H;
        const gm = m.getContext('2d'); gm.drawImage(spr.masque, 0, 0);
        try {
            const im = g.getImageData(0, 0, W, H), mk = gm.getImageData(0, 0, W, H).data, d = im.data;
            const r = parseInt(info.h.slice(1, 3), 16), gg = parseInt(info.h.slice(3, 5), 16), b = parseInt(info.h.slice(5, 7), 16);
            for (let i = 0; i < d.length; i += 4) {
                const a = mk[i + 3] / 255; if (!a) continue;
                const l = (d[i] + d[i + 1] + d[i + 2]) / 765 * 1.22;
                d[i] = d[i] * (1 - a) + Math.min(255, r * l) * a; d[i + 1] = d[i + 1] * (1 - a) + Math.min(255, gg * l) * a; d[i + 2] = d[i + 2] * (1 - a) + Math.min(255, b * l) * a;
            }
            g.putImageData(im, 0, 0);
        } catch (e) { /* page ouverte en fichier local : pas de recoloriage possible, combinaison blanche */ }
        return spr.teintes[k] = cv;
    }
    // Dessine un astronaute : (px, py) = position de ses pieds, taille = côté de l'image
    function smDessinerAstro(g, k, dir, image, px, py, taille) {
        const cv = smTeinte(k); if (!cv) return;
        const F = SM.FRAME;
        g.drawImage(cv, image * F, dir * F, F, F, px - taille * SM.AX, py - taille * SM.AY, taille, taille);
    }

    // ---------------- Choix de la couleur (dans le salon) ----------------
    function smFermerCouleurs() { const el = document.getElementById('sm-couleurs'); if (el) el.remove(); }
    window.smChoisirCouleur = function (k) {
        const me = moi(), code = salon();
        const joueurs = (window.currentRoom && window.currentRoom.players) || {};
        const autre = Object.keys(joueurs).find(n => n !== me && joueurs[n] && joueurs[n].smCouleur === k);
        if (autre) { if (typeof showToast === 'function') showToast('🎨 Cette couleur est déjà prise par ' + autre + '.'); son('erreur'); return; }
        try { localStorage.setItem('lmlp-sm-couleur', k); } catch (e) {}
        if (me && code && window.update && !window.estSpectateur) window.update(window.ref(window.db, 'salons/' + code), { ['players/' + me + '/smCouleur']: k }).catch(err => console.error('Couleur :', err));
        son('clic'); smFermerCouleurs();
    };
    window.smFermerCouleurs = smFermerCouleurs;
    window.smOuvrirCouleurs = function () {
        smFermerCouleurs();
        const room = window.currentRoom || {}, joueurs = room.players || {}, me = moi();
        const noms = Object.keys(joueurs).filter(n => joueurs[n] && !joueurs[n].isBot);
        const attrib = smCouleursAttribuees(noms, joueurs), mien = attrib[me] || '';
        const prises = {}; noms.forEach(n => { const k = joueurs[n].smCouleur; if (k && attrib[n] === k && n !== me) prises[k] = n; });
        const ov = document.createElement('div');
        ov.id = 'sm-couleurs';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(2,6,23,.84);display:flex;align-items:center;justify-content:center;padding:12px';
        ov.onclick = e => { if (e.target === ov) smFermerCouleurs(); };
        ov.innerHTML = `<div style="width:min(560px,100%);max-height:94vh;overflow-y:auto;background:#091424;border:1px solid #22d3ee;border-radius:18px;padding:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
                <span class="sci-font" style="font-weight:800;letter-spacing:.12em;font-size:15px;color:#a5f3fc">🎨 COULEUR DE MON ASTRONAUTE</span>
                <button onclick="smFermerCouleurs()" style="border:1px solid #475569;background:transparent;color:#cbd5e1;border-radius:8px;padding:3px 10px;cursor:pointer;font-family:inherit">✕</button>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Pour le jeu <b style="color:#e2e8f0">Salle des machines</b>. Chaque couleur ne peut être prise que par un seul joueur.</div>
            ${window.estSpectateur || !joueurs[me] ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:8px">Vous êtes spectateur : le choix de la couleur est réservé aux joueurs.</div>' : ''}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px">${SM_COULEURS.map(c => {
                const qui = prises[c.k] || '', choisie = c.k === mien;
                return `<button ${qui ? 'disabled' : `onclick="smChoisirCouleur('${c.k}')"`} style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px 7px;border-radius:14px;cursor:${qui ? 'not-allowed' : 'pointer'};font-family:inherit;border:2px solid ${choisie ? '#34d399' : 'rgba(148,163,184,.3)'};background:${choisie ? 'rgba(6,78,59,.55)' : 'rgba(15,23,42,.9)'};opacity:${qui ? .45 : 1}">
                    <canvas data-c="${c.k}" width="96" height="96" style="width:84px;height:84px"></canvas>
                    <span style="font-weight:800;font-size:12px;color:${c.t || c.h}">${c.n}</span>
                    <span style="font-size:10px;min-height:12px;color:${choisie ? '#6ee7b7' : '#fbbf24'}">${choisie ? '✓ Votre couleur' : (qui ? '🔒 ' + smEsc(qui) : '')}</span></button>`;
            }).join('')}</div>
            <details style="margin-top:10px;font-size:10px;color:#94a3b8;line-height:1.5"><summary style="cursor:pointer">Crédits de l’astronaute</summary>
                D’après « <a href="https://sketchfab.com/3d-models/little-astronaut-12184db58b1f44c987537b5607c32098" target="_blank" rel="noopener" style="color:#7dd3fc">Little Astronaut</a> » par Jelle Vermandere (CC-BY-4.0), animation de marche précalculée en images.</details>
        </div>`;
        document.body.appendChild(ov);
        // aperçu animé : chaque astronaute respire et tourne lentement sur lui-même
        smChargerSprites(() => {
            const t0 = performance.now();
            const anime = t => {
                if (!document.body.contains(ov)) return;
                const dir = Math.floor((t - t0) / 900) % 8, im = SM.MARCHE + Math.floor((t - t0) / 500) % SM.REPOS;
                ov.querySelectorAll('canvas[data-c]').forEach(cv => { const g = cv.getContext('2d'); g.clearRect(0, 0, 96, 96); smDessinerAstro(g, cv.dataset.c, dir, im, 48, 92, 96 * 1.06); });
                requestAnimationFrame(anime);
            };
            requestAnimationFrame(anime);
        });
    };
    // Bouton affiché dans le salon (réglages de l'hôte et dossier de mission des autres joueurs)
    window.smBoutonCouleur = function () {
        if (window.smCouleurMemoire) window.smCouleurMemoire(window.currentRoom);
        const b = document.createElement('button');
        b.type = 'button';
        const room = window.currentRoom || {}, j = room.players || {}, me = moi();
        const k = smCouleursAttribuees(Object.keys(j).filter(n => j[n] && !j[n].isBot), j)[me], info = smCouleurInfo(k);
        b.innerHTML = `🎨 Couleur de mon astronaute${info ? ` : <b style="color:${info.t || info.h}">${info.n}</b>` : ''}`;
        b.onclick = window.smOuvrirCouleurs;
        b.style.cssText = 'display:block;margin-top:6px;padding:6px 12px;border-radius:8px;border:1px solid #22d3ee;background:rgba(8,51,68,.7);color:#a5f3fc;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit';
        return b;
    };
    // un joueur retrouve la couleur choisie lors d'une soirée précédente
    window.smCouleurMemoire = function (data) {
        const me = moi(), code = salon();
        if (!me || !code || window.estSpectateur || !data || !data.players || !data.players[me] || data.players[me].smCouleur || data.status === 'IN_GAME') return;
        if (window._smMemoireFaite === code) return;
        window._smMemoireFaite = code;
        let k = ''; try { k = localStorage.getItem('lmlp-sm-couleur') || ''; } catch (e) {}
        if (!k || !smCouleurInfo(k) || Object.values(data.players).some(p => p && p.name !== me && p.smCouleur === k)) return;
        window.update(window.ref(window.db, 'salons/' + code), { ['players/' + me + '/smCouleur']: k }).catch(() => {});
    };

    // ---------------- Lancement (hôte) ----------------
    window.startMachinesGame = function () {
        if (!window.isHost) return;
        const code = salon();
        if (!code || !window.mettreAJourSalonFirebase || !window.SM_VAISSEAUX) return;
        const players = state.players || {};
        const noms = Object.values(players).filter(p => p && p.name && !p.isBot).map(p => p.name);
        if (!noms.length) return;
        const objectif = parseInt(document.getElementById('setting-machines-obj')?.value, 10);
        const choix = parseInt(document.getElementById('setting-machines-ship')?.value, 10);
        const ship = choix >= 1 && choix <= window.SM_VAISSEAUX.length ? choix - 1 : Math.floor(Math.random() * window.SM_VAISSEAUX.length);
        const go = pos => {
            const now = Date.now();
            const s = smNouvellePartie(smMelange(noms), players, { ship: ship, obj: isNaN(objectif) ? 5 : objectif, pos: pos }, now);
            smH.M = smMoteur(s); smH.sess = now; smH.done = {}; smH.sale = false;
            const updates = { status: 'IN_GAME', selectedMode: 'machines', 'settings/smObj': s.obj, smGame: { s: s }, smPos: null };
            Object.values(players).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
            window.mettreAJourSalonFirebase(code, updates);
        };
        // positions hors du salon si les règles Firebase le permettent (sinon, dans le salon)
        window.set(window.ref(window.db, 'salons/' + code + '__machines'), { t: Date.now() }).then(() => go('ext')).catch(() => go('int'));
    };

    // ---------------- Hôte : simulation, actions des joueurs, écriture ----------------
    const smH = { M: null, sess: 0, done: {}, sale: false, ecrit: 0, ecritPos: 0, tick: 0, avant: 0 };
    function smHoteEtat(g) {
        const s = smNormaliser(g.s);
        if (smH.M && smH.sess === s.startedAt) return smH.M;
        // nouvel hôte (l'ancien est parti) : il reprend la partie là où elle en est
        smH.M = smMoteur(s); smH.sess = s.startedAt; smH.done = {};
        smH.M.pos = Object.assign({}, smC.net);
        return smH.M;
    }
    function smHoteActions(data) {
        const g = data.smGame;
        if (!window.isHost || !g || !g.s) return;
        const M = smHoteEtat(g), now = Date.now();
        const cles = Object.keys(g.a || {}).sort().filter(k => !smH.done[k]);
        if (!cles.length) return;
        cles.forEach(k => {
            smH.done[k] = 1;
            const a = g.a[k]; if (!a || !M.s.crew[a.by] || M.s.crew[a.by].bot) return;
            if (a.t === 'crie' && smCrier(M, a.by, now)) smH.sale = true;
            if (a.t === 'agir') {
                const G = smGrille(M.s.ship), c = G.consoles.find(x => x.id === a.c), p = M.pos[a.by];
                if (c && (!p || Math.hypot(c.x - p.x, c.y - p.y) <= SM.PORTEE + 0.8) && smAgir(M, a.by, a.c, a.v, now)) smH.sale = true;
            }
        });
        smH.aEffacer = (smH.aEffacer || []).concat(cles);
        smHoteEcrire(true);
    }
    function smHoteEcrire(force) {
        const M = smH.M, code = salon(); if (!M || !code) return;
        const now = Date.now();
        if (!force && (!smH.sale || now - smH.ecrit < 150)) return;
        smH.ecrit = now; smH.sale = false;
        M.s.seq = (M.s.seq || 0) + 1; M.s.hn = now;
        const up = { 'smGame/s': JSON.parse(JSON.stringify(M.s)) };
        (smH.aEffacer || []).forEach(k => { up['smGame/a/' + k] = null; }); smH.aEffacer = [];
        if (M.s.status === 'FINISHED') {
            const players = (window.currentRoom && window.currentRoom.players) || {};
            Object.keys(M.s.crew).forEach(n => { if (players[n]) up[`players/${n}/score`] = smScore(M.s, n); });
        }
        window.update(window.ref(window.db, 'salons/' + code), up).catch(err => console.error('Salle des machines :', err));
        if (M.s.status === 'FINISHED' && M.s.pos === 'ext') window.set(window.ref(window.db, 'salons/' + code + '__machines'), null).catch(() => {});
    }
    function smHoteTick() {
        const room = window.currentRoom;
        if (!window.isHost || !room || room.status !== 'IN_GAME' || room.selectedMode !== 'machines' || !room.smGame || !room.smGame.s) return;
        const M = smHoteEtat(room.smGame);
        const now = Date.now(), dt = Math.min(0.25, Math.max(0, (now - (smH.avant || now)) / 1000)); smH.avant = now;
        if (!dt) return;        // horloge arrêtée : partie en pause
        M.pos = Object.assign({}, smC.net);
        if (smC.moi && smC.pos) M.pos[moi()] = smC.pos;
        const presents = {}; Object.keys(room.players || {}).forEach(n => { if (room.players[n] && !room.players[n].isBot) presents[n] = 1; });
        if (smEtape(M, now, dt, presents)) smH.sale = true;
        smHoteEcrire(false);
        // positions des androïdes, 6 fois par seconde
        if (now - smH.ecritPos > 160 && smC.cheminPos && M.s.status === 'PLAYING') {
            smH.ecritPos = now; const up = {};
            Object.keys(M.b).forEach(k => { const b = M.b[k]; if (M.s.crew[k] && M.s.crew[k].bot) up[k] = { x: +b.x.toFixed(2), y: +b.y.toFixed(2), d: b.d, w: b.w, r: b.w && b.r ? 1 : 0, s: M.s.startedAt }; });
            if (Object.keys(up).length) window.update(window.ref(window.db, smC.cheminPos), up).catch(() => {});
        }
    }

    // ---------------- Client : affichage et commandes ----------------
    const smC = {
        sess: 0, s: null, G: null, img: null, imgPret: false, cv: null, g: null, raf: 0, ecoute: null, cheminPos: '',
        net: {}, aff: {}, pos: null, chemin: [], touches: new Set(), dernierEnvoi: 0, envoye: '', avant: 0, horloge: 0,
        decalage: 0, holoCle: '', sel: null, selId: '', fermee: '', nuages: [], course: { endu: 1, epuise: false, repos: 0, bouton: false, maj: false }, logVu: 0, niveauVu: 0, coqueVu: 100, degatVu: 0, tremble: 0, cam: null, pointeur: null, moi: false, finVue: 0, voile: null
    };
    window.smC = smC;     // (pour les tests)
    window.smTest = { viser: c => smViser(c), utiliser: (c, v) => smUtiliser(c, v), proche: () => smConsoleProche() };
    const tempsHote = () => Date.now() + smC.decalage;

    function smEnvoyer(action) {
        const code = salon(); if (!code || !window.update) return;
        const k = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        window.update(window.ref(window.db, 'salons/' + code), { ['smGame/a/' + k]: Object.assign({ by: moi() }, action) }).catch(err => console.error('Action non envoyée :', err));
    }
    function smStyles() {
        if (document.getElementById('sm-style')) return;
        const st = document.createElement('style'); st.id = 'sm-style';
        st.textContent = `
        #sm-root{width:100%;display:flex;flex-direction:column;gap:8px;font-family:ui-monospace,Consolas,monospace;color:#e2e8f0}
        #sm-root .hud{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:center;background:#0b1526;border:1px solid #1e3a5f;border-radius:10px;padding:7px 12px}
        #sm-root .jauge{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b}
        #sm-root .barre{height:9px;border-radius:5px;background:#0f172a;border:1px solid #1e293b;overflow:hidden;margin-top:3px}
        #sm-root .barre i{display:block;height:100%;transition:width .25s}
        #sm-root .niv{text-align:right;font-size:10px;color:#64748b;letter-spacing:.1em}
        #sm-root .niv b{display:block;font-size:20px;color:#fbbf24;line-height:1.1}
        #sm-cadre{position:relative;width:100%;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f;background:#01030a}
        #sm-cadre canvas{display:block;width:100%;touch-action:none;cursor:pointer}
        #sm-cadre.degat{animation:smDegat .5s}
        @keyframes smDegat{30%{box-shadow:inset 0 0 0 3px #f87171,0 0 40px rgba(248,113,113,.6)}}
        #sm-root .bas{display:grid;grid-template-columns:1fr 1.3fr;gap:8px}
        #sm-root .boite{background:#0b1526;border:1px solid #1e3a5f;border-radius:10px;padding:8px 11px;min-height:104px}
        #sm-root .boite h3{margin:0 0 5px;font-size:10px;letter-spacing:.2em;color:#64748b;text-transform:uppercase;font-weight:700}
        #sm-ordre{font-size:15px;font-weight:800;color:#fff;min-height:38px;line-height:1.25}
        #sm-root .t{height:6px;background:#1e293b;border-radius:3px;margin-top:6px;overflow:hidden}
        #sm-root .t i{display:block;height:100%;background:#34d399}
        #sm-crier{margin-top:7px;width:100%;padding:8px;border-radius:8px;border:1px solid #fbbf24;background:rgba(251,191,36,.12);color:#fbbf24;font-weight:800;letter-spacing:.06em;cursor:pointer;font-size:13px;font-family:inherit}
        #sm-crier:disabled{opacity:.35;cursor:default}
        #sm-log{display:flex;flex-direction:column-reverse;gap:2px;max-height:104px;overflow:hidden}
        #sm-log .m{font-size:11.5px;line-height:1.3}
        #sm-log .m .qui{color:#fbbf24;font-weight:800}
        #sm-log .ok{color:#34d399}#sm-log .ko{color:#f87171}#sm-log .info{color:#a5b4fc}
        #sm-root .aide{font-size:10.5px;color:#64748b;text-align:center}
        #sm-fin{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.82);padding:12px;z-index:5}
        #sm-fin .carte{max-width:460px;width:100%;background:#0b1526;border:1px solid rgba(34,211,238,.5);border-radius:14px;padding:16px;text-align:center;max-height:100%;overflow:auto}
        /* console holographique, affichée sur la carte à côté de l'équipement */
        #sm-holo{position:absolute;left:0;top:0;z-index:3;width:218px;pointer-events:none;opacity:0;transition:opacity .15s;will-change:transform}
        #sm-holo.vu{opacity:1;pointer-events:auto}
        #sm-holo .in{position:relative;border-radius:12px;padding:8px 10px 7px;color:#e2e8f0;
            background:linear-gradient(180deg,rgba(var(--c),.18),rgba(2,8,23,.86) 38%),repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);
            border:1px solid rgba(var(--c),.85);box-shadow:0 0 18px rgba(var(--c),.45),inset 0 0 14px rgba(var(--c),.18);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
        #sm-holo.neuf .in{animation:smHolo .22s ease-out}
        @keyframes smHolo{from{transform:scale(.82) translateY(8px);opacity:0;filter:brightness(2)}}
        #sm-holo .in::after{content:'';position:absolute;left:var(--fx,50%);width:12px;height:12px;margin-left:-6px;transform:rotate(45deg);background:rgba(2,8,23,.9);border:1px solid rgba(var(--c),.85)}
        #sm-holo:not(.dessous) .in::after{bottom:-7px;border-top:none;border-left:none}
        #sm-holo.dessous .in::after{top:-7px;border-bottom:none;border-right:none}
        #sm-holo .tete{display:flex;align-items:center;gap:6px;margin-bottom:6px}
        #sm-holo .tete i{width:8px;height:8px;border-radius:50%;background:rgb(var(--c));box-shadow:0 0 8px rgb(var(--c));flex-shrink:0}
        #sm-holo .tete b{font-size:12.5px;line-height:1.15;flex:1;min-width:0}
        #sm-holo .tete span{display:block;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:rgba(var(--c),1);font-weight:700}
        #sm-holo .x{border:none;background:transparent;color:#94a3b8;font-size:14px;cursor:pointer;padding:0 2px;font-family:inherit}
        #sm-holo .corps{display:flex;justify-content:center;align-items:center;min-height:62px}
        #sm-holo .off .corps{opacity:.35;filter:grayscale(.6);pointer-events:none}
        #sm-holo .pied{font-size:10px;text-align:center;color:#94a3b8;margin-top:5px;letter-spacing:.04em}
        #sm-holo .pied b{color:#fbbf24}
        #sm-holo .hb-bouton{width:56px;height:56px;border-radius:50%;border:3px solid rgba(255,255,255,.15);cursor:pointer;background:radial-gradient(circle at 35% 30%,#fecaca,#dc2626 58%,#7f1d1d);box-shadow:0 5px 0 #450a0a,0 0 18px rgba(239,68,68,.6)}
        #sm-holo .hb-bouton.bleu{background:radial-gradient(circle at 35% 30%,#cffafe,#0891b2 58%,#164e63);box-shadow:0 5px 0 #083344,0 0 18px rgba(34,211,238,.6)}
        #sm-holo .hb-bouton:active{transform:translateY(4px);box-shadow:0 1px 0 #000}
        #sm-holo .hb-inter{position:relative;width:132px;height:42px;border-radius:21px;border:1px solid #334155;background:#0f172a;cursor:pointer;font-family:inherit;color:#64748b;font-weight:900;font-size:11px;letter-spacing:.12em;padding-left:38px;transition:background .2s,border-color .2s}
        #sm-holo .hb-inter .bille{position:absolute;left:5px;top:5px;width:30px;height:30px;border-radius:50%;background:linear-gradient(#e2e8f0,#94a3b8);transition:left .2s}
        #sm-holo .hb-inter.on{background:rgba(52,211,153,.18);border-color:#34d399;color:#34d399;padding-left:0;padding-right:38px}
        #sm-holo .hb-inter.on .bille{left:95px;background:linear-gradient(#bbf7d0,#22c55e);box-shadow:0 0 12px #22c55e}
        #sm-holo .hb-cur{display:flex;align-items:center;gap:6px}
        #sm-holo .hb-cur>button{width:34px;height:34px;border-radius:9px;border:1px solid #334155;background:#0f172a;color:#22d3ee;font-size:18px;font-weight:900;cursor:pointer;font-family:inherit}
        #sm-holo .crans{display:flex;gap:3px;align-items:flex-end;height:38px}
        #sm-holo .crans button{width:15px;border:none;border-radius:3px;background:#1e293b;cursor:pointer;padding:0}
        #sm-holo .crans button.on{background:#22d3ee;box-shadow:0 0 8px rgba(34,211,238,.7)}
        #sm-holo .hb-val{font-size:11px;color:#22d3ee;text-align:center;margin-top:2px;font-weight:800}
        /* bouton de course et endurance */
        #sm-courir{position:absolute;right:10px;bottom:10px;z-index:2;width:62px;height:62px;border-radius:50%;border:none;cursor:pointer;padding:0;font-family:inherit;
            background:conic-gradient(var(--ec,#34d399) calc(var(--e,1)*360deg),rgba(30,41,59,.85) 0);box-shadow:0 4px 14px rgba(0,0,0,.5)}
        #sm-courir span{position:absolute;inset:5px;border-radius:50%;background:rgba(2,8,23,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px;line-height:1;color:#e2e8f0}
        #sm-courir span em{font-style:normal;font-size:8.5px;letter-spacing:.12em;margin-top:2px;font-weight:800;color:#94a3b8}
        #sm-courir.on span{background:rgba(6,78,59,.9);box-shadow:inset 0 0 12px rgba(52,211,153,.7)}
        #sm-courir.on span em{color:#6ee7b7}
        #sm-courir.epuise span{background:rgba(69,10,10,.9)}
        #sm-courir.epuise span em{color:#fca5a5}
        @media (max-width:760px){#sm-root .bas{grid-template-columns:1fr}#sm-root .boite{min-height:0}#sm-ordre{font-size:13.5px;min-height:0}#sm-log{max-height:84px}#sm-holo{width:196px}}`;
        document.head.appendChild(st);
    }
    function smConstruire() {
        smStyles();
        const zone = document.getElementById('generic-game-content'); if (!zone) return;
        zone.innerHTML = `<div id="sm-root">
            <div class="hud">
                <div class="jauge">Coque <span id="sm-coque-txt">100 %</span><div class="barre"><i id="sm-coque" style="width:100%;background:#34d399"></i></div></div>
                <div class="jauge">Saut hyperespace <span id="sm-prog-txt">0 / ${SM.BUT}</span><div class="barre"><i id="sm-prog" style="width:0;background:#22d3ee"></i></div></div>
                <div class="niv">SECTEUR<b id="sm-niv">1</b></div>
            </div>
            <div id="sm-cadre"><canvas id="sm-cv"></canvas><div id="sm-holo"></div>
                <button id="sm-courir" title="Courir (Maj)"><span>🏃<em>COURIR</em></span></button></div>
            <div class="bas">
                <div class="boite"><h3>Ton ordre</h3><div id="sm-ordre">…</div><div class="t"><i id="sm-ordre-t"></i></div><button id="sm-crier">📢 Crier l’ordre</button></div>
                <div class="boite journal"><h3>Intercom</h3><div id="sm-log"></div></div>
            </div>
            <div class="aide">Touchez la carte pour vous déplacer (ou ↑ ↓ ← → / ZQSD), 🏃 ou Maj pour courir. Passez près d’un équipement ou touchez-le pour ouvrir sa console. Criez vos ordres à voix haute… ou avec 📢 (C) !</div>
        </div>`;
        smC.cv = document.getElementById('sm-cv'); smC.g = smC.cv.getContext('2d');
        smC.holoCle = ''; smC.logVu = 0; smC.sel = null; smC.fermee = '';
        document.getElementById('sm-crier').onclick = () => { smEnvoyer({ t: 'crie' }); son('clic'); };
        const courir = document.getElementById('sm-courir');
        courir.onclick = () => { smC.course.bouton = !smC.course.bouton; son('clic'); };
        if (!smC.moi) courir.style.display = 'none';
        const cv = smC.cv;
        const versMonde = e => {
            const r = cv.getBoundingClientRect(), cam = smC.cam; if (!cam) return null;
            return [(e.clientX - r.left) * (cv.width / r.width) / cam.e + cam.x, (e.clientY - r.top) * (cv.height / r.height) / cam.e + cam.y];
        };
        cv.onpointerdown = e => {
            const w = versMonde(e); if (!w) return;
            smC.pointeur = { id: e.pointerId, t: 0, console: false };
            try { cv.setPointerCapture(e.pointerId); } catch (x) {}
            // toucher un équipement : sa console s'ouvre et l'astronaute y va
            const C = SM.CELL, c = smC.G && smC.G.consoles.find(k => Math.hypot((k.x + .5) * C - w[0], (k.y + .5) * C - w[1]) < C * 1.35);
            if (c && smC.s && smC.s.status === 'PLAYING') {
                smC.pointeur.console = true; smC.sel = { id: c.id, par: 'clic' }; smC.fermee = '';
                const p = smC.pos;
                if (p && Math.hypot(c.x - p.x, c.y - p.y) > SM.PORTEE - .1) smViser([c.x, c.y]);
                son('clic');
                return;
            }
            if (smC.sel && smC.sel.par === 'clic') smC.sel = null;
            smViser([Math.floor(w[0] / C), Math.floor(w[1] / C)]);
        };
        cv.onpointermove = e => {
            if (!smC.pointeur || smC.pointeur.id !== e.pointerId || smC.pointeur.console) return;
            const t = performance.now(); if (t - smC.pointeur.t < 140) return; smC.pointeur.t = t;
            const w = versMonde(e); if (w) smViser([Math.floor(w[0] / SM.CELL), Math.floor(w[1] / SM.CELL)]);
        };
        cv.onpointerup = cv.onpointercancel = () => { smC.pointeur = null; };
    }
    function smViser(c) {
        if (!c || !smC.pos || !smC.G || !smC.s || smC.s.status !== 'PLAYING') return;
        const feux = smCasesFeu(smC.s);
        const ch = smCheminVers(smC.G, [Math.round(smC.pos.x), Math.round(smC.pos.y)], c[0], c[1], feux);
        if (ch) smC.chemin = ch;
    }
    function smClavier(e, bas) {
        const s = smC.s; if (!s || !document.getElementById('sm-root')) return;
        const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
        const k = (e.key || '').toLowerCase();
        if (k === 'shift') { smC.course.maj = bas; return; }
        const fleches = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'z', 'q', 's', 'd', 'w', 'a'];
        if (fleches.includes(k)) { if (bas) { smC.touches.add(k); smC.chemin = []; } else smC.touches.delete(k); e.preventDefault(); return; }
        if (!bas || s.status !== 'PLAYING') return;
        if (k === 'c') { smEnvoyer({ t: 'crie' }); son('clic'); }
        const c = smConsoleProche();
        if (c && k === 'e') { if (c.type === 'bouton') smUtiliser(c, true); if (c.type === 'inter') smUtiliser(c, !s.cons[c.id]); }
        if (c && c.type === 'curseur' && /^[0-5]$/.test(k)) smUtiliser(c, Number(k));
    }
    document.addEventListener('keydown', e => smClavier(e, true));
    document.addEventListener('keyup', e => smClavier(e, false));
    window.addEventListener('blur', () => { smC.touches.clear(); smC.course.maj = false; });

    function smConsoleProche() {
        if (!smC.pos || !smC.G) return null;
        let mieux = null, dm = SM.PORTEE;
        smC.G.consoles.forEach(c => { const d = Math.hypot(c.x - smC.pos.x, c.y - smC.pos.y); if (d < dm) { dm = d; mieux = c; } });
        return mieux;
    }
    function smUtiliser(c, v) {
        const s = smC.s; if (!s || s.status !== 'PLAYING') return;
        smEnvoyer({ t: 'agir', c: c.id, v: v });
        if (c.type !== 'bouton') s.cons[c.id] = v;         // affichage immédiat, l'hôte confirmera
        s.flash[c.id] = tempsHote();
        smC.holoCle = '';
        son('clic');
    }
    // Console holographique : s'ouvre quand on passe à côté d'un équipement ou quand on le touche
    function smMajHolo() {
        const s = smC.s, G = smC.G, el = document.getElementById('sm-holo'); if (!el || !s || !G || !smC.cam) return;
        const proche = s.status === 'PLAYING' && !s.saut && smC.moi ? smConsoleProche() : null;
        if (smC.fermee && (!proche || proche.id !== smC.fermee)) smC.fermee = '';
        let sel = smC.sel;
        if (sel && sel.par === 'clic' && proche && proche.id === sel.id) sel.par = 'arrive';
        if (sel && sel.par !== 'clic' && (!proche || proche.id !== sel.id)) sel = null;
        if (!sel && proche && proche.id !== smC.fermee) sel = { id: proche.id, par: 'proche' };
        if (s.status !== 'PLAYING' || s.saut || !smC.moi) sel = null;
        smC.sel = sel; smC.selId = sel ? sel.id : '';
        if (!sel) { el.classList.remove('vu'); smC.holoCle = ''; return; }
        const c = G.consoles.find(x => x.id === sel.id), pret = !!proche && proche.id === c.id, val = s.cons[c.id];
        const cle = c.id + ':' + val + ':' + pret;
        if (cle !== smC.holoCle) {
            const neuf = !smC.holoCle || smC.holoCle.split(':')[0] !== c.id;
            smC.holoCle = cle;
            let corps = '';
            if (c.type === 'bouton') corps = `<button class="hb-bouton${c.j === 1 ? ' bleu' : ''}" data-a="b" aria-label="Activer"></button>`;
            if (c.type === 'inter') corps = `<button class="hb-inter ${val ? 'on' : ''}" data-a="i"><span class="bille"></span>${val ? 'ALLUMÉ' : 'ÉTEINT'}</button>`;
            if (c.type === 'curseur') {
                const v = Number(val) || 0;
                corps = `<div><div class="hb-cur"><button data-d="-1">−</button><div class="crans">${[0, 1, 2, 3, 4, 5].map(i => `<button data-v="${i}" class="${i <= v ? 'on' : ''}" style="height:${12 + i * 5}px" aria-label="${i}"></button>`).join('')}</div><button data-d="1">+</button></div><div class="hb-val">RÉGLAGE ${v}</div></div>`;
            }
            const aide = pret ? (c.type === 'curseur' ? 'Touches <b>0</b> à <b>5</b>' : 'Touche <b>E</b>') : '🚶 En route vers l’équipement…';
            el.innerHTML = `<div class="in ${pret ? '' : 'off'}" style="--c:${SM_SECTEURS[c.s].c}">
                <div class="tete"><i></i><b>${smEsc(s.noms[c.id])}<span>${SM_SECTEURS[c.s].n}${c.b ? ' · borne' : ''}</span></b><button class="x" aria-label="Fermer">✕</button></div>
                <div class="corps">${corps}</div><div class="pied">${aide}</div></div>`;
            el.querySelector('.x').onclick = () => { smC.fermee = c.id; smC.sel = null; son('clic'); };
            const b = el.querySelector('[data-a="b"]'); if (b) b.onclick = () => smUtiliser(c, true);
            const i = el.querySelector('[data-a="i"]'); if (i) i.onclick = () => smUtiliser(c, !val);
            el.querySelectorAll('[data-d]').forEach(x => { x.onclick = () => { const v = Number(val) || 0, n = Math.max(0, Math.min(5, v + Number(x.dataset.d))); if (n !== v) smUtiliser(c, n); }; });
            el.querySelectorAll('[data-v]').forEach(x => { x.onclick = () => { const n = Number(x.dataset.v); if (n !== (Number(val) || 0)) smUtiliser(c, n); }; });
            if (neuf) { el.classList.remove('neuf'); void el.offsetWidth; el.classList.add('neuf'); }
        }
        el.classList.add('vu');
        // position : au-dessus de l'équipement (ou en dessous s'il n'y a pas la place)
        const cv = smC.cv, cam = smC.cam, r = cv.clientWidth / cv.width, C = SM.CELL;
        const sx = ((c.x + .5) * C - cam.x) * cam.e * r, sy = ((c.y + .5) * C - cam.y) * cam.e * r;
        const w = el.offsetWidth, h = el.offsetHeight, W = cv.clientWidth, H = cv.clientHeight, marge = C * 1.45 * cam.e * r + 10;
        let top = sy - marge - h, dessous = false;
        if (top < 6) { top = sy + marge; dessous = true; }
        top = Math.max(6, Math.min(H - h - 6, top));
        const left = Math.max(6, Math.min(W - w - 6, sx - w / 2));
        el.classList.toggle('dessous', dessous);
        el.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
        el.style.setProperty('--fx', Math.max(14, Math.min(w - 14, sx - left)) + 'px');
    }
    function smMajInterface() {
        const s = smC.s; if (!s) return;
        const el = id => document.getElementById(id);
        if (!el('sm-root')) return;
        const c = el('sm-coque'); c.style.width = s.coque + '%'; c.style.background = s.coque > 50 ? '#34d399' : s.coque > 25 ? '#fbbf24' : '#f87171';
        el('sm-coque-txt').textContent = s.coque + ' %';
        el('sm-prog').style.width = (s.prog / SM.BUT * 100) + '%'; el('sm-prog-txt').textContent = `${s.prog} / ${SM.BUT}`;
        el('sm-niv').textContent = s.niveau + (s.obj ? ' / ' + s.obj : '');
        const gt = el('generic-game-timer'); if (gt) gt.textContent = s.obj ? `Objectif : ${s.obj} secteurs` : 'Survie';
        const o = smC.moi && s.ord[moi()], G = smC.G;
        const cons = o && G ? G.consoles.find(x => x.id === o.c) : null;
        el('sm-ordre').textContent = o && cons ? smTexte(s.noms[o.c], cons.type, o.v) : (s.saut ? '— saut hyperespace en cours —' : (smC.moi ? '…' : 'Vous regardez la partie.'));
        const b = el('sm-crier'); b.disabled = !o || !!o.cr; b.textContent = o && o.cr ? '📢 Ordre crié' : '📢 Crier l’ordre';
        if (!smC.moi) b.style.display = 'none';
        const derniers = s.log.slice(-7), vu = derniers.length ? derniers[derniers.length - 1].k : 0;
        if (vu !== smC.logVu) {
            smC.logVu = vu;
            el('sm-log').innerHTML = derniers.slice().reverse().map(m => {
                if (m.c === 'cri') { const qui = (s.crew[m.n] && s.crew[m.n].nom) || m.n; return `<div class="m"><span class="qui">${smEsc(qui)} :</span> « ${smEsc(m.t)} »</div>`; }
                return `<div class="m ${m.c}">${smEsc(m.t)}</div>`;
            }).join('');
        }
    }

    // Caméra : tout le vaisseau si l'écran est assez grand, sinon on suit son astronaute
    function smCamera() {
        const cv = smC.cv, W = cv.width, H = cv.height;
        const fit = Math.min(W / SM.IMG_W, H / SM.IMG_H), dpr = Math.min(2, window.devicePixelRatio || 1), mini = (W / dpr < 700 ? 15 : 11) * dpr / SM.CELL;
        const e = Math.max(fit, mini);
        let cx = SM.IMG_W / 2, cy = SM.IMG_H / 2;
        if (e > fit + 1e-6 && smC.pos) { cx = (smC.pos.x + .5) * SM.CELL; cy = (smC.pos.y + .5) * SM.CELL; }
        const vw = W / e, vh = H / e;
        let x = cx - vw / 2, y = cy - vh / 2;
        x = vw >= SM.IMG_W ? (SM.IMG_W - vw) / 2 : Math.max(0, Math.min(SM.IMG_W - vw, x));
        y = vh >= SM.IMG_H ? (SM.IMG_H - vh) / 2 : Math.max(0, Math.min(SM.IMG_H - vh, y));
        smC.cam = { x, y, e };
    }
    function smTaille() {
        const cv = smC.cv, cadre = document.getElementById('sm-cadre'); if (!cv || !cadre) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const L = cadre.clientWidth || 600;
        const H = L < 700 ? Math.max(300, window.innerHeight * 0.52) : Math.max(240, Math.min(L * SM.IMG_H / SM.IMG_W, window.innerHeight * 0.64));
        const w = Math.round(L * dpr), h = Math.round(H * dpr);
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cv.style.height = H + 'px'; }
    }
    // Calque des secteurs (teinte légère, plus marquée pour son propre secteur)
    function smCalqueSecteurs() {
        const G = smC.G, s = smC.s, me = smC.moi ? s.crew[moi()] : null;
        const cv = document.createElement('canvas'); cv.width = SM.W; cv.height = SM.H;
        const g = cv.getContext('2d'), im = g.createImageData(SM.W, SM.H);
        for (let k = 0; k < SM.W * SM.H; k++) {
            const sc = G.sec[k]; if (sc < 0) continue;
            const [r, gg, b] = SM_SECTEURS[sc].c.split(',').map(Number), mien = me && me.sec === sc;
            im.data[k * 4] = r; im.data[k * 4 + 1] = gg; im.data[k * 4 + 2] = b; im.data[k * 4 + 3] = mien ? 48 : 18;
        }
        g.putImageData(im, 0, 0);
        smC.calque = cv;
        smC.centres = SM_SECTEURS.map((x, i) => { let sx = 0, sy = 0, n = 0; for (let k = 0; k < G.sec.length; k++) if (G.sec[k] === i) { sx += k % SM.W; sy += (k / SM.W) | 0; n++; } return n ? [sx / n, sy / n] : [0, 0]; });
    }

    function smBoucle(t) {
        smC.raf = requestAnimationFrame(smBoucle);
        const salle = window.currentRoom;
        if (!document.getElementById('sm-cv') || (salle && (salle.status !== 'IN_GAME' || salle.selectedMode !== 'machines'))) { cancelAnimationFrame(smC.raf); smC.raf = 0; smArreter(); return; }
        const now = Date.now(), dt = Math.min(0.06, Math.max(0, (now - (smC.horloge || now)) / 1000)); smC.horloge = now;
        const s = smC.s; if (!s || !smC.G) return;
        smTaille();
        if (smC.moi && smC.pos && s.status === 'PLAYING' && !s.saut && dt > 0) smDeplacer(dt);
        smEnvoyerPos(now);
        smAnimerAutres(dt);
        // minuteur de son ordre
        const o = smC.moi && s.ord[moi()], bar = document.getElementById('sm-ordre-t');
        if (bar) { const r = o ? Math.max(0, 1 - (tempsHote() - o.t0) / o.d) : 0; bar.style.width = r * 100 + '%'; bar.style.background = r > .5 ? '#34d399' : r > .25 ? '#fbbf24' : '#f87171'; }
        smDessiner(now, dt);
        smMajHolo();
        smMajCourse();
    }
    // Course : plus rapide, mais l'endurance se vide ; à zéro, il faut souffler avant de pouvoir recourir
    function smMajCourse() {
        const b = document.getElementById('sm-courir'), k = smC.course; if (!b) return;
        b.style.setProperty('--e', k.endu.toFixed(3));
        b.style.setProperty('--ec', k.epuise ? '#f87171' : k.endu < .35 ? '#fbbf24' : '#34d399');
        b.classList.toggle('on', !!k.bouton && !k.epuise);
        b.classList.toggle('epuise', !!k.epuise);
        const em = b.querySelector('em'); if (em) em.textContent = k.epuise ? 'SOUFFLE' : (k.bouton ? 'COURSE' : 'COURIR');
    }
    function smDeplacer(dt) {
        const p = smC.pos, G = smC.G, feux = smCasesFeu(smC.s), K = smC.course;
        const veut = !!(K.maj || K.bouton) && !K.epuise;
        const v = (veut ? SM.COURSE_V : SM.MARCHE_V) * dt;
        const T = smC.touches;
        const ancien = [p.x, p.y];
        if (T.size) {
            let dx = 0, dy = 0;
            if (T.has('arrowleft') || T.has('q') || T.has('a')) dx--;
            if (T.has('arrowright') || T.has('d')) dx++;
            if (T.has('arrowup') || T.has('z') || T.has('w')) dy--;
            if (T.has('arrowdown') || T.has('s')) dy++;
            if (dx || dy) {
                const n = Math.hypot(dx, dy);
                const glisse = (ddx, ddy) => {
                    const nx = p.x + ddx, ny = p.y + ddy, r = .3;
                    if ([[nx - r, ny - r], [nx + r, ny - r], [nx - r, ny + r], [nx + r, ny + r]].every(([x, y]) => smEstLibre(G, Math.round(x), Math.round(y), feux))) { p.x = nx; p.y = ny; }
                };
                glisse(dx / n * v, 0); glisse(0, dy / n * v);
                p.d = smDirection(dx, dy);
            }
        } else { p.chemin = smC.chemin; smAvancer(p, G, feux, v); smC.chemin = p.chemin; }
        const d = Math.hypot(p.x - ancien[0], p.y - ancien[1]);
        p.w = d > 1e-4 ? 1 : 0;
        p.r = p.w && veut ? 1 : 0;
        p.phase = ((p.phase || 0) + d / 1.5) % 1;
        // endurance
        if (p.r) { K.endu = Math.max(0, K.endu - SM.ENDU_PERTE * dt); K.repos = 0; if (K.endu <= 0) { K.epuise = true; son('erreur'); } }
        else { K.repos += dt; if (K.repos > 0.7) K.endu = Math.min(1, K.endu + SM.ENDU_GAIN * dt * (p.w ? 0.6 : 1)); }
        if (K.epuise && K.endu >= SM.ENDU_REPRISE) K.epuise = false;
        if (p.r) smPoussiere(p, dt);
        // pris dans un incendie (il vient d'apparaître) : on est poussé vers la case libre la plus proche
        if (!smEstLibre(G, Math.round(p.x), Math.round(p.y), feux)) { const c = smCaseLibreProche(G, Math.round(p.x), Math.round(p.y), feux); p.x = c[0]; p.y = c[1]; smC.chemin = []; }
    }
    function smPoussiere(p, dt) {          // petits nuages sous les pieds quand on court
        p.pouss = (p.pouss || 0) + dt;
        if (p.pouss < 0.07) return;
        p.pouss = 0;
        smC.nuages.push({ x: p.x + (Math.random() - .5) * .4, y: p.y + .3 + (Math.random() - .5) * .2, t: Date.now() });
        if (smC.nuages.length > 80) smC.nuages.shift();
    }
    function smEnvoyerPos(now) {
        if (!smC.moi || !smC.pos || !smC.cheminPos || now - smC.dernierEnvoi < 150 || !smC.s || smC.s.status !== 'PLAYING') return;
        const p = smC.pos, cle = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.d},${p.w},${p.r}`;
        if (cle === smC.envoye) return;
        smC.dernierEnvoi = now; smC.envoye = cle;
        window.update(window.ref(window.db, smC.cheminPos), { [moi()]: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), d: p.d, w: p.w, r: p.r || 0, s: smC.sess } }).catch(() => {});
    }
    function smAnimerAutres(dt) {
        const s = smC.s;
        Object.keys(s.crew).forEach(n => {
            if (smC.moi && n === moi()) return;
            const cible = smC.net[n]; if (!cible || cible.s !== s.startedAt) return;
            let a = smC.aff[n];
            if (!a || Math.hypot(a.x - cible.x, a.y - cible.y) > 4) a = smC.aff[n] = { x: cible.x, y: cible.y, d: cible.d || 0, phase: 0, w: 0 };
            const k = Math.min(1, dt * 10), ox = a.x, oy = a.y;
            a.x += (cible.x - a.x) * k; a.y += (cible.y - a.y) * k;
            const d = Math.hypot(a.x - ox, a.y - oy);
            a.d = cible.d || 0; a.w = cible.w || d > 0.004 ? 1 : 0; a.r = cible.r ? 1 : 0;
            a.phase = ((a.phase || 0) + (a.w ? Math.max(d, 0) / 1.5 : 0)) % 1;
            if (a.r && a.w) smPoussiere(a, dt);
        });
    }
    function smLignes(g, txt, max) {
        const mots = String(txt).split(' '), out = []; let l = '';
        mots.forEach(m => { const e = l ? l + ' ' + m : m; if (g.measureText(e).width > max && l) { out.push(l); l = m; } else l = e; });
        out.push(l); return out;
    }
    // Noms des équipements : sous l'équipement, sinon à côté ou au-dessus, sans se chevaucher
    function smEtiquettes(g, tp, px) {
        const cle = smC.G.v.f + ':' + tp.toFixed(2) + ':' + Object.values(smC.s.noms).join('|');
        if (smC.etiqCle === cle) return smC.etiq;
        const C = SM.CELL, h = tp * 1.1, places = [];
        smC.G.consoles.forEach(c => places.push({ x0: (c.x - .6) * C, y0: (c.y - 1.5) * C, x1: (c.x + 1.6) * C, y1: (c.y + 1.6) * C }));
        const touche = r => places.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
        g.font = `700 ${tp}px ui-monospace, Consolas, monospace`;
        const out = smC.G.consoles.map(c => {
            const ls = smLignes(g, smC.s.noms[c.id], C * 4.6), w = Math.max(...ls.map(l => g.measureText(l).width)) + 4 * px, H = ls.length * h;
            const x = (c.x + .5) * C, y = (c.y + .5) * C;
            const essais = [[x, y + C * 1.15], [x + C * 1.2 + w / 2, y - H / 2], [x - C * 1.2 - w / 2, y - H / 2], [x, y - C * 1.6 - H], [x, y + C * 1.15 + H]];
            let choix = essais[0];
            for (const e of essais) { const r = { x0: e[0] - w / 2, y0: e[1], x1: e[0] + w / 2, y1: e[1] + H }; if (!touche(r)) { choix = e; break; } }
            places.push({ x0: choix[0] - w / 2, y0: choix[1], x1: choix[0] + w / 2, y1: choix[1] + H });
            return { id: c.id, s: c.s, cx: c.x, cy: c.y, ls, x: choix[0], y: choix[1], h };
        });
        smC.etiqCle = cle; smC.etiq = out;
        return out;
    }
    // Équipement relié à une console : halo, crochets holographiques et pastille d'état au-dessus
    function smDessinerConsoles(g, now, th, px) {
        const s = smC.s, G = smC.G, C = SM.CELL, me = smC.moi ? s.crew[moi()] : null;
        G.consoles.forEach(c => {
            const x = (c.x + .5) * C, y = (c.y + .5) * C, col = SM_SECTEURS[c.s].c, val = s.cons[c.id];
            const actif = c.id === smC.selId, mien = !me || me.sec === c.s;
            const eclat = s.flash[c.id] ? Math.max(0, 1 - (th - s.flash[c.id]) / 700) : 0;
            const pulse = .5 + .5 * Math.sin(now / 520 + c.x * .7);
            if (c.b) {      // borne autonome posée au sol
                g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, y + C * .42, C * .55, C * .2, 0, 0, 6.3); g.fill();
                const gr = g.createLinearGradient(x - C * .45, 0, x + C * .45, 0); gr.addColorStop(0, '#334155'); gr.addColorStop(.5, '#64748b'); gr.addColorStop(1, '#1e293b');
                g.fillStyle = gr; g.beginPath(); g.roundRect(x - C * .42, y - C * .55, C * .84, C * .98, 4); g.fill();
                g.fillStyle = `rgba(${col},${.75 + .25 * pulse})`; g.beginPath(); g.roundRect(x - C * .3, y - C * .45, C * .6, C * .38, 2); g.fill();
            }
            g.save(); g.globalCompositeOperation = 'lighter';
            const r = C * (1.45 + .15 * pulse) * (actif ? 1.15 : 1);
            const halo = g.createRadialGradient(x, y, 0, x, y, r);
            halo.addColorStop(0, `rgba(${col},${(mien ? .3 : .16) + .1 * pulse + eclat * .6})`); halo.addColorStop(.6, `rgba(${col},${(mien ? .1 : .05) + eclat * .2})`); halo.addColorStop(1, `rgba(${col},0)`);
            g.fillStyle = halo; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
            // balayage holographique
            const k = (now / 1500 + c.x * .13) % 1, hh = C * .95;
            g.strokeStyle = `rgba(${col},${.5 * Math.sin(k * Math.PI)})`; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(x - hh * .85, y - hh + 2 * hh * k); g.lineTo(x + hh * .85, y - hh + 2 * hh * k); g.stroke();
            g.restore();
            // crochets aux quatre coins
            const h = C * (actif ? 1.08 + Math.sin(now / 170) * .05 : .95), L = C * .4;
            g.strokeStyle = actif ? '#ffffff' : `rgba(${col},${mien ? .95 : .55})`; g.lineWidth = actif ? 2.6 : 1.7;
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => { g.beginPath(); g.moveTo(x + sx * h, y + sy * (h - L)); g.lineTo(x + sx * h, y + sy * h); g.lineTo(x + sx * (h - L), y + sy * h); g.stroke(); }));
            // pastille d'état
            const bw = C * 1.35, bh = C * .58, bx = x - bw / 2, by = y - h - C * .32 - bh;
            g.fillStyle = 'rgba(2,8,23,.82)'; g.strokeStyle = `rgba(${col},${mien ? .9 : .5})`; g.lineWidth = 1.2;
            g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fill(); g.stroke();
            const cy = by + bh / 2;
            if (c.type === 'bouton') { g.fillStyle = c.j === 1 ? '#22d3ee' : '#ef4444'; g.shadowColor = g.fillStyle; g.shadowBlur = 6; g.beginPath(); g.arc(x, cy, bh * .28, 0, 6.3); g.fill(); g.shadowBlur = 0; }
            if (c.type === 'inter') {
                g.fillStyle = val ? 'rgba(52,211,153,.35)' : '#1e293b'; g.beginPath(); g.roundRect(x - bw * .28, cy - bh * .24, bw * .56, bh * .48, bh * .24); g.fill();
                g.fillStyle = val ? '#34d399' : '#64748b'; g.beginPath(); g.arc(x + (val ? bw * .16 : -bw * .16), cy, bh * .2, 0, 6.3); g.fill();
            }
            if (c.type === 'curseur') {
                const v = Number(val) || 0;
                for (let i = 0; i < 6; i++) { const hb = bh * (.22 + i * .09); g.fillStyle = i <= v ? '#22d3ee' : '#1e293b'; g.fillRect(x - bw * .33 + i * bw * .12, cy + bh * .3 - hb, bw * .08, hb); }
            }
        });
    }
    function smDessiner(now, dt) {
        const s = smC.s, G = smC.G, g = smC.g, cv = smC.cv; if (!g) return;
        smCamera();
        const cam = smC.cam, C = SM.CELL, th = tempsHote();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#01030a'; g.fillRect(0, 0, cv.width, cv.height);
        const tremble = smC.tremble > now ? (Math.random() - .5) * 10 : 0;
        g.setTransform(cam.e, 0, 0, cam.e, -cam.x * cam.e + tremble, -cam.y * cam.e + tremble * .6);
        if (smC.imgPret) g.drawImage(smC.img, 0, 0, SM.IMG_W, SM.IMG_H);
        if (smC.calque) { g.imageSmoothingEnabled = false; g.drawImage(smC.calque, 0, 0, SM.IMG_W, SM.IMG_H); g.imageSmoothingEnabled = true; }
        const px = 1 / cam.e;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `900 ${Math.max(13, 15 * px)}px ui-monospace, Consolas, monospace`;
        (smC.centres || []).forEach((c, i) => { g.fillStyle = `rgba(${SM_SECTEURS[i].c},.35)`; g.fillText(SM_SECTEURS[i].n.toUpperCase(), (c[0] + .5) * C, (c[1] + .5) * C); });
        // incendies
        Object.values(s.feux).forEach(f => {
            for (let k = 0; k < 9; k++) {
                const a = now / 90 + k * 1.7, rx = (f.x + .5) * C + Math.sin(a) * C * .9, ry = (f.y + .5) * C + Math.cos(a * 1.3) * C * .8;
                const gr = g.createRadialGradient(rx, ry, 0, rx, ry, C * 1.2);
                gr.addColorStop(0, 'rgba(254,240,138,.95)'); gr.addColorStop(.5, 'rgba(249,115,22,.7)'); gr.addColorStop(1, 'rgba(239,68,68,0)');
                g.fillStyle = gr; g.beginPath(); g.arc(rx, ry, C * 1.2, 0, 6.3); g.fill();
            }
        });
        smDessinerConsoles(g, now, th, px);
        // noms : ceux de son secteur, et ceux des équipements proches
        const taillePolice = Math.max(9, 10.5 * px), me = smC.moi ? s.crew[moi()] : null, p0 = smC.pos;
        const etiq = smEtiquettes(g, taillePolice, px);
        g.font = `700 ${taillePolice}px ui-monospace, Consolas, monospace`;
        etiq.forEach(e => {
            const proche = p0 && Math.hypot(e.cx - p0.x, e.cy - p0.y) < 6;
            if (me && e.s !== me.sec && !proche) return;
            e.ls.forEach((l, k) => {
                const ty = e.y + e.h * (k + .5);
                g.lineWidth = 3 * px; g.strokeStyle = 'rgba(2,6,23,.85)'; g.strokeText(l, e.x, ty); g.fillStyle = 'rgba(241,245,249,.95)'; g.fillText(l, e.x, ty);
            });
        });
        // poussière de course
        smC.nuages = smC.nuages.filter(n => now - n.t < 520);
        smC.nuages.forEach(n => { const k = (now - n.t) / 520; g.fillStyle = `rgba(203,213,225,${.35 * (1 - k)})`; g.beginPath(); g.arc((n.x + .5) * C, (n.y + .5) * C, C * (.18 + k * .32), 0, 6.3); g.fill(); });
        // astronautes (du fond vers l'avant)
        const liste = [];
        Object.keys(s.crew).forEach(n => {
            const m = s.crew[n];
            const p = smC.moi && n === moi() ? smC.pos : smC.aff[n];
            if (p) liste.push({ n, m, p });
        });
        liste.sort((a, b) => a.p.y - b.p.y);
        const T = C * 3.7;
        liste.forEach(({ n, m, p }) => {
            const x = (p.x + .5) * C, y = (p.y + .5) * C + C * .35, mien = smC.moi && n === moi();
            g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(x, y, C * .62, C * .26, 0, 0, 6.3); g.fill();
            if (mien) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, C * .82, C * .36, 0, 0, 6.3); g.stroke(); }
            const image = p.w ? Math.floor((p.phase || 0) * SM.MARCHE) % SM.MARCHE : SM.MARCHE + Math.floor((now + n.length * 300) / 500) % SM.REPOS;
            // en courant, l'astronaute se penche un peu vers l'avant
            if (p.r && p.w) { const a = [0, 1, 1, 1, 0, -1, -1, -1][p.d || 0] * .12; g.save(); g.translate(x, y); g.rotate(a); smDessinerAstro(g, m.col, p.d || 0, image, 0, 0, T); g.restore(); }
            else smDessinerAstro(g, m.col, p.d || 0, image, x, y, T);
            const info = smCouleurInfo(m.col);
            g.font = `800 ${Math.max(10, 11 * px)}px ui-monospace, Consolas, monospace`;
            g.lineWidth = 3 * px; g.strokeStyle = 'rgba(2,6,23,.9)'; g.strokeText(m.nom, x, y - T * .86); g.fillStyle = info ? (info.t || info.h) : '#fff'; g.fillText(m.nom, x, y - T * .86);
            // jauge d'endurance sous son propre astronaute
            const K = smC.course;
            if (mien && (K.endu < .999 || p.r)) {
                const bw = C * 1.8, bh = Math.max(4, 4.5 * px), bx = x - bw / 2, by = y + C * .55;
                g.fillStyle = 'rgba(2,6,23,.8)'; g.beginPath(); g.roundRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, bh); g.fill();
                g.fillStyle = K.epuise ? '#f87171' : K.endu < .35 ? '#fbbf24' : '#34d399';
                g.beginPath(); g.roundRect(bx, by, Math.max(bh, bw * K.endu), bh, bh / 2); g.fill();
            }
        });
        // ordres criés : bulle au-dessus de celui qui crie
        liste.forEach(({ n, p }) => {
            const o = s.ord[n]; if (!o || !o.cr || th - o.cr > 3800) return;
            const c = G.consoles.find(x => x.id === o.c); if (!c) return;
            const txt = '📢 ' + smTexte(s.noms[o.c], c.type, o.v);
            g.font = `800 ${Math.max(10, 11.5 * px)}px ui-monospace, Consolas, monospace`;
            const ls = smLignes(g, txt, 210 * px), lh = Math.max(10, 11.5 * px) * 1.2;
            const w = Math.max(...ls.map(l => g.measureText(l).width)) + 14 * px, h = ls.length * lh + 8 * px;
            const x = (p.x + .5) * C, by = (p.y + .5) * C - T * 1.05 - h;
            g.fillStyle = '#fbbf24'; g.beginPath(); g.roundRect(x - w / 2, by, w, h, 7 * px); g.fill();
            g.fillStyle = '#1c1917'; ls.forEach((l, k) => g.fillText(l, x, by + 4 * px + lh * (k + .5)));
        });
        // panne de courant : on ne voit qu'autour de soi
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (s.noir && s.noir > th) {
            const p = smC.pos || { x: SM.W / 2, y: SM.H / 2 };
            const sx = ((p.x + .5) * C - cam.x) * cam.e, sy = ((p.y + .5) * C - cam.y) * cam.e, r = C * 3.2 * cam.e;
            const gr = g.createRadialGradient(sx, sy, r * .6, sx, sy, r * 2.2);
            gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.95)');
            g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
            if (Math.sin(now / 160) > 0) { g.fillStyle = 'rgba(239,68,68,.1)'; g.fillRect(0, 0, cv.width, cv.height); }
        }
        if (s.saut && s.saut > th) { const k = 1 - (s.saut - th) / 2200; g.fillStyle = `rgba(224,242,254,${Math.max(0, Math.sin(k * Math.PI)) * .55})`; g.fillRect(0, 0, cv.width, cv.height); }
    }

    // Événements visibles par tous : dégâts, saut, fin
    function smEvenements(s) {
        if (s.degat && s.degat !== smC.degatVu) {
            if (smC.degatVu) {
                smC.tremble = Date.now() + 450; son('alarme');
                const cadre = document.getElementById('sm-cadre'); if (cadre) { cadre.classList.remove('degat'); void cadre.offsetWidth; cadre.classList.add('degat'); }
            }
            smC.degatVu = s.degat;
        }
        if (s.saut && s.saut !== smC.sautVu) { smC.sautVu = s.saut; if (typeof window.sautHyperespace === 'function') window.sautHyperespace(); else son('warp'); }
        const mien = smC.moi && s.ord[moi()];
        if (mien && mien.t0 !== smC.ordreVu) { smC.ordreVu = mien.t0; son('sonar'); }
        if (s.status === 'FINISHED' && smC.finVue !== s.startedAt) { smC.finVue = s.startedAt; son(s.fin && s.fin.victoire ? 'victoire' : 'coule'); smAfficherFin(s); }
    }
    function smAfficherFin(s) {
        const cadre = document.getElementById('sm-cadre'); if (!cadre || document.getElementById('sm-fin')) return;
        const gagne = s.fin && s.fin.victoire;
        const lignes = Object.keys(s.crew).map(n => ({ n, m: s.crew[n], f: s.fait[n] || 0 })).sort((a, b) => b.f - a.f).map(r => {
            const info = smCouleurInfo(r.m.col);
            return `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border-bottom:1px solid rgba(148,163,184,.15);font-size:13px">
                <span style="font-weight:800;color:${info ? (info.t || info.h) : '#fff'}">${smEsc(r.m.nom)}</span><span style="color:#cbd5e1">${r.f} ordre${r.f > 1 ? 's' : ''} exécuté${r.f > 1 ? 's' : ''}${r.n.indexOf('bot') === 0 ? '' : ` · <b style="color:#6ee7b7">${smScore(s, r.n)} pts</b>`}</span></div>`;
        }).join('');
        const d = document.createElement('div'); d.id = 'sm-fin';
        d.innerHTML = `<div class="carte">
            <div style="font-size:42px;line-height:1">${gagne ? '🏆' : '💥'}</div>
            <div class="sci-font" style="font-weight:900;letter-spacing:.12em;font-size:18px;color:${gagne ? '#6ee7b7' : '#f87171'};margin:6px 0">${gagne ? 'MISSION ACCOMPLIE' : 'VAISSEAU PERDU'}</div>
            <div style="color:#cbd5e1;font-size:13px;margin-bottom:10px">${gagne ? `L’équipage a franchi les ${s.obj} secteurs` : `L’équipage a tenu jusqu’au secteur ${s.niveau}`} avec <b style="color:#fff">${s.total}</b> ordres exécutés.</div>
            <div style="text-align:left;margin-bottom:12px">${lignes}</div>
            <button onclick="backToLobby()" class="neon-glow-btn w-full font-bold py-3 rounded-xl uppercase tracking-wider text-xs cursor-pointer">Retour au salon</button></div>`;
        cadre.appendChild(d);
    }

    function smEcouterPositions(s) {
        const code = salon();
        const chemin = s.pos === 'ext' ? 'salons/' + code + '__machines' : 'salons/' + code + '/smPos';
        if (smC.cheminPos === chemin && smC.ecoute) return;
        if (smC.ecoute) { try { smC.ecoute(); } catch (e) {} }
        smC.cheminPos = chemin; smC.net = {};
        smC.ecoute = window.onValue(window.ref(window.db, chemin), snap => { const v = snap.val() || {}; delete v.t; smC.net = v; });
    }
    function smArreter() {
        if (smC.ecoute) { try { smC.ecoute(); } catch (e) {} smC.ecoute = null; }
        smC.cheminPos = ''; smC.sess = 0; smC.s = null;
        if (window.smTicker) { clearInterval(window.smTicker); window.smTicker = null; }
    }
    window.smArreter = smArreter;

    // ---------------- Rendu (appelé à chaque mise à jour du salon) ----------------
    window.renderMachinesScreen = function (data) {
        const g = data && data.smGame;
        if (!g || !g.s) return;
        if (!window.SM_VAISSEAUX) return;               // plans des vaisseaux pas encore chargés
        const s = smNormaliser(g.s);
        if (smC.s && smC.sess === s.startedAt && s.seq < smC.s.seq) { if (window.isHost) smHoteActions(data); return; }   // ne jamais revenir en arrière
        try {
            if (smC.sess !== s.startedAt || !document.getElementById('sm-root')) {
                smC.sess = s.startedAt; smC.G = smGrille(s.ship); smC.s = s;
                smC.moi = !!s.crew[moi()] && !window.estSpectateur;
                smC.aff = {}; smC.chemin = []; smC.repris = false; smC.envoye = '';
                smC.course = { endu: 1, epuise: false, repos: 0, bouton: false, maj: false }; smC.nuages = []; smC.etiqCle = ''; smC.degatVu = s.degat; smC.sautVu = s.saut; smC.finVue = s.status === 'FINISHED' ? -1 : 0; smC.ordreVu = 0;
                showScreen('screen-generic-game');
                const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = '⚙️ Salle des machines';
                smConstruire();
                smC.imgPret = false; smC.img = new Image(); smC.img.onload = () => { smC.imgPret = true; }; smC.img.src = SM.DIR + 'vaisseaux/' + smC.G.v.f;
                smChargerSprites();
                smCalqueSecteurs();
                // position de départ : celle déjà envoyée (retour dans la partie), sinon le départ de son secteur
                if (smC.moi) {
                    const m = s.crew[moi()], d = smC.G.departs[m.sec];
                    const rang = Object.keys(s.crew).filter(n => s.crew[n].sec === m.sec).indexOf(moi());
                    const c = smCaseLibreProche(smC.G, d[0] + (rang % 2 ? -1 : 0), d[1] + (rang > 1 ? 1 : 0), null);
                    smC.pos = { x: c[0], y: c[1], d: 0, w: 0, phase: 0, chemin: [] };
                } else smC.pos = null;
                if (!smC.raf) smC.raf = requestAnimationFrame(smBoucle);
            }
            if (s.hn && s.hn !== smC.hnVu) { smC.hnVu = s.hn; smC.decalage = s.hn - Date.now(); }
            smC.s = s;
            smEcouterPositions(s);
            // retour dans la partie : on reprend sa dernière position connue
            if (smC.moi && !smC.repris && smC.net[moi()] && smC.net[moi()].s === s.startedAt) { smC.repris = true; Object.assign(smC.pos, { x: smC.net[moi()].x, y: smC.net[moi()].y }); }
            smMajInterface();
            smEvenements(s);
            if (!window.smTicker) window.smTicker = setInterval(smHoteTick, 100);
        } finally { if (window.isHost) smHoteActions(data); }
    };
})();
