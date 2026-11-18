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
const SM_CABLES = [{ k: 'rouge', h: '#ef4444' }, { k: 'bleu', h: '#3b82f6' }, { k: 'jaune', h: '#facc15' }];
const SM_PRISES = ['A', 'B', 'C'];
const SM_TYPES_SUP = ['inter', 'curseur', 'levier', 'molette', 'code', 'cable'];
const smCacheGrille = {};
function smGrille(ship) {
    if (smCacheGrille[ship]) return smCacheGrille[ship];
    const v = (typeof window !== 'undefined' && window.SM_VAISSEAUX ? window.SM_VAISSEAUX : (typeof SM_VAISSEAUX_NODE !== 'undefined' ? SM_VAISSEAUX_NODE : []))[ship];
    if (!v) return null;
    const N = SM.W * SM.H, sol = new Uint8Array(N), sec = new Int8Array(N).fill(-1), espace = new Uint8Array(N);
    v.g.forEach((ligne, y) => { for (let x = 0; x < SM.W; x++) { const c = ligne[x], k = y * SM.W + x; if (c >= '0' && c <= '3') { sol[k] = 1; sec[k] = +c; } else if (c === ' ') espace[k] = 1; } });
    const consoles = v.c.map((c, i) => ({ id: 'c' + c[2] + (i % 4), x: c[0], y: c[1], s: c[2], j: i % 4, type: SM_TYPES[i % 4], b: !!c[3] }));
    // cases de sol proches de la coque extérieure (où une brèche peut s'ouvrir)
    const bord = [];
    for (let y = 3; y < SM.H - 3; y++) for (let x = 3; x < SM.W - 3; x++) {
        if (!sol[y * SM.W + x]) continue;
        let pres = false;
        for (let dy = -3; dy <= 3 && !pres; dy++) for (let dx = -3; dx <= 3; dx++) if (espace[(y + dy) * SM.W + x + dx]) { pres = true; break; }
        if (pres) bord.push([x, y]);
    }
    return smCacheGrille[ship] = { v, sol, sec, espace, consoles, departs: v.d, bord };
}
// Chaque partie tire les types de commandes : un bouton par secteur, et trois commandes différentes parmi les autres
function smAppliquerTypes(s) {
    const G = smGrille(s.ship); if (!G) return;
    G.consoles.forEach(c => { c.type = (s.types && s.types[c.id]) || SM_TYPES[c.j]; });
}
function smValeurInitiale(type) {
    return { bouton: false, inter: false, curseur: 0, levier: false, molette: 0, code: '0000', cable: 'ABC' }[type];
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
    if (type === 'levier') return `${v ? 'Abaissez' : 'Relevez'} le levier : ${nom} !`;
    if (type === 'molette') return `Tournez la molette : ${nom} sur ${v} !`;
    if (type === 'code') return `Entrez le code ${v} : ${nom} !`;
    if (type === 'cable') { const [c, p] = String(v).split(':'); return `Branchez le câble ${c} sur la prise ${p} : ${nom} !`; }
    return `Réglez : ${nom} sur ${v} !`;
}
// Texte complet d'un ordre (simple, à deux en même temps, ou en chaîne)
function smTexteOrdre(s, o) {
    const G = smGrille(s.ship), c1 = G.consoles.find(x => x.id === o.c);
    if (!c1) return '';
    if (o.k === 'duo') return `EN MÊME TEMPS : activez ${s.noms[o.c]} et ${s.noms[o.c2]} !`;
    const t1 = smTexte(s.noms[o.c], c1.type, o.v);
    if (o.k === 'chaine') {
        const c2 = G.consoles.find(x => x.id === o.c2);
        const t2 = smTexte(s.noms[o.c2], c2.type, o.v2);
        return t1.replace(/ !$/, '') + ', PUIS ' + t2.charAt(0).toLowerCase() + t2.slice(1);
    }
    return t1;
}
// Une action sur une console : nouvel état, et est-ce qu'elle correspond à la valeur demandée ?
function smEtatApres(type, etat, v) {
    if (type === 'bouton') return false;
    if (type === 'cable') {
        const [c, p] = String(v).split(':'), i = SM_CABLES.findIndex(x => x.k === c), e = String(etat || 'ABC').split('');
        if (i < 0 || SM_PRISES.indexOf(p) < 0) return etat;
        const j = e.indexOf(p); const ancien = e[i]; e[i] = p; if (j >= 0 && j !== i) e[j] = ancien;      // le câble qui occupait la prise prend l'ancienne place
        return e.join('');
    }
    return v;
}
function smNormVal(type, v) {
    if (type === 'curseur') return Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    if (type === 'molette') return Math.max(0, Math.min(9, Math.round(Number(v) || 0)));
    if (type === 'code') return String(v || '').replace(/\D/g, '').slice(0, 4).padStart(4, '0');
    if (type === 'cable') return String(v || '');
    return type === 'bouton' ? true : !!v;
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
// Nouvelle partie : équipage (humains + androïdes), noms et types des consoles, état initial
function smNouvellePartie(noms, players, opts, now) {
    const ship = opts.ship, G = smGrille(ship);
    const crew = {}, couleurs = smCouleursAttribuees(noms, players);
    noms.forEach((n, i) => { crew[n] = { sec: i % 4, col: couleurs[n], bot: 0, nom: n }; });
    const libres = SM_COULEURS.map(c => c.k).filter(k => !Object.values(couleurs).includes(k));
    for (let k = noms.length; k < 4; k++) {
        const cle = 'bot' + k;
        crew[cle] = { sec: k, col: libres[k - noms.length] || SM_COULEURS[k].k, bot: 1, nom: SM_ANDROIDES[k] + ' 🤖' };
    }
    const nomsConsoles = smMelange(SM_NOMS), cons = {}, etiquettes = {}, types = {};
    for (let k = 0; k < 4; k++) {
        const liste = smMelange(['bouton'].concat(smMelange(SM_TYPES_SUP).slice(0, 3)));
        G.consoles.filter(c => c.s === k).forEach((c, j) => { types[c.id] = liste[j]; });
    }
    G.consoles.forEach((c, i) => { etiquettes[c.id] = nomsConsoles[i]; cons[c.id] = smValeurInitiale(types[c.id]); });
    return {
        v: 2, startedAt: now, seq: 1, hn: now, status: 'PLAYING', ship: ship, obj: opts.obj, pos: opts.pos || 'int',
        crew: crew, noms: etiquettes, types: types, cons: cons, ord: {}, log: [{ k: 1, t: 'Moteurs en surchauffe ! Tenez le vaisseau jusqu’au saut hyperespace.', c: 'info' }],
        feux: {}, grille: {}, breche: 0, gaz: 0, gravite: 0, noir: 0, saut: 0, degat: 0, flash: {}, niveau: 1, prog: 0, coque: 100, total: 0, fait: {}, fin: null, lk: 1
    };
}
function smNormaliser(s) {
    s = JSON.parse(JSON.stringify(s || {}));
    ['crew', 'noms', 'cons', 'ord', 'feux', 'flash', 'fait', 'types', 'grille'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    s.log = Array.isArray(s.log) ? s.log.filter(Boolean) : Object.values(s.log || {}).filter(Boolean);
    Object.values(s.ord).forEach(o => { if (!o.p || typeof o.p !== 'object') o.p = {}; if (!o.k) o.k = 'simple'; if (!o.e) o.e = 0; });
    ['breche', 'gaz'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = 0; });
    return s;
}
function smDire(s, t, c, n) { s.lk = (s.lk || 0) + 1; s.log.push({ k: s.lk, t: t, c: c || '', n: n || '' }); while (s.log.length > 8) s.log.shift(); }
function smDureeOrdre(s) { return Math.max(11, 20 - s.niveau * 1.5) * 1000; }

// Moteur : un objet par partie, tenu par l'hôte (s = état partagé, b = positions et cerveaux des androïdes)
function smMoteur(s) {
    smAppliquerTypes(s);
    return { s: s, pend: {}, b: {}, cri: {}, prochInc: 0, pos: {} };
}
// valeur à demander pour une console, différente de son état actuel
function smCibleAleatoire(s, c) {
    const e = s.cons[c.id];
    if (c.type === 'bouton') return true;
    if (c.type === 'inter' || c.type === 'levier') return !e;
    if (c.type === 'curseur') { let v; do { v = Math.floor(Math.random() * 6); } while (v === e); return v; }
    if (c.type === 'molette') { let v; do { v = Math.floor(Math.random() * 10); } while (v === e); return v; }
    if (c.type === 'code') { let v; do { v = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (v === e); return v; }
    if (c.type === 'cable') {
        const etat = String(e || 'ABC'), i = Math.floor(Math.random() * 3), autres = SM_PRISES.filter(p => p !== etat[i]);
        return SM_CABLES[i].k + ':' + autres[Math.floor(Math.random() * autres.length)];
    }
    return true;
}
function smCorrespond(type, cible, v) { return type === 'bouton' || String(cible) === String(v); }
function smNouvelOrdre(M, n, now) {
    const s = M.s, G = smGrille(s.ship), m = s.crew[n];
    if (!m || s.status !== 'PLAYING' || s.saut) return;
    const prises = {}; Object.values(s.ord).forEach(o => { prises[o.c] = 1; if (o.c2) prises[o.c2] = 1; });
    const libres = G.consoles.filter(c => !prises[c.id]);
    const choisir = (liste, ailleurs, sec) => {
        let l = liste.filter(c => (ailleurs ? c.s !== sec : c.s === sec));
        if (!l.length) l = liste;
        return l.length ? l[Math.floor(Math.random() * l.length)] : null;
    };
    const r = Math.random(), d = smDureeOrdre(s);
    // ordre à deux : deux boutons de deux secteurs différents, en même temps
    if (s.niveau >= 2 && r < 0.15) {
        const boutons = libres.filter(c => c.type === 'bouton');
        const a = choisir(boutons, true, m.sec), b = a && choisir(boutons.filter(c => c.s !== a.s), true, m.sec);
        if (a && b && a.s !== b.s) {
            s.ord[n] = { k: 'duo', c: a.id, v: true, c2: b.id, v2: true, t0: now, d: d * 1.45, cr: 0, p: {}, e: 0 };
            if (m.bot) M.cri[n] = now + smAlea(600, 1600);
            return;
        }
    }
    // ordre en chaîne : une première action, PUIS une seconde
    if (s.niveau >= 2 && r < 0.36) {
        const a = choisir(libres, true, m.sec), b = a && choisir(libres.filter(c => c.id !== a.id && c.type !== 'bouton'), true, a.s);
        if (a && b) {
            const va = smCibleAleatoire(s, a), vb = smCibleAleatoire(s, b);
            s.ord[n] = { k: 'chaine', c: a.id, v: va, c2: b.id, v2: vb, t0: now, d: d * 1.5, cr: 0, p: {}, e: 0 };
            if (m.bot) M.cri[n] = now + smAlea(600, 1600);
            return;
        }
    }
    const c = choisir(libres, Math.random() > 0.12, m.sec);
    if (!c) { M.pend[n] = now + 600; return; }
    s.ord[n] = { k: 'simple', c: c.id, v: smCibleAleatoire(s, c), t0: now, d: d, cr: 0, p: {}, e: 0 };
    if (m.bot) M.cri[n] = now + smAlea(600, 1600);
}
function smCrier(M, n, now) {
    const s = M.s, o = s.ord[n];
    if (!o || o.cr) return false;
    o.cr = now;
    smDire(s, smTexteOrdre(s, o), 'cri', n);
    smConfierOrdre(M, n, o, now);
    return true;
}
// Les androïdes responsables des secteurs concernés s'en chargent
function smConfierOrdre(M, n, o, now) {
    const s = M.s, G = smGrille(s.ship), c1 = G.consoles.find(x => x.id === o.c), c2 = o.c2 ? G.consoles.find(x => x.id === o.c2) : null;
    const pour = (c, v, extra) => Object.keys(s.crew).forEach(k => { if (s.crew[k].bot && s.crew[k].sec === c.s) smConfier(M, k, c, v, now, o, n, extra); });
    if (o.k === 'duo') { pour(c1, true, { duo: o.c2 }); pour(c2, true, { duo: o.c }); }
    else if (o.k === 'chaine') { pour(c1, o.v, { etape: 0 }); pour(c2, o.v2, { etape: 1 }); }
    else pour(c1, o.v, {});
}
function smConfier(M, k, c, cible, now, o, n, extra) {
    const s = M.s, b = M.b[k]; if (!b) return;
    const reussit = Math.random() < Math.max(0.72, 0.96 - s.niveau * 0.04);
    let v = cible;
    if (!reussit && c.type !== 'bouton') {      // les androïdes se trompent parfois
        if (c.type === 'inter' || c.type === 'levier') v = !cible;
        else if (c.type === 'curseur') v = (cible + 1 + Math.floor(Math.random() * 4)) % 6;
        else if (c.type === 'molette') v = (cible + 1 + Math.floor(Math.random() * 8)) % 10;
    }
    b.file = (b.file || []).filter(t => t.c !== c.id);
    b.file.push(Object.assign({ c: c.id, v: v, des: now + smAlea(400, 1000), fin: o ? o.t0 + o.d : 0, n: n, t0: o ? o.t0 : 0 }, extra || {}));
}
function smAgir(M, by, cid, v, now) {
    const s = M.s, G = smGrille(s.ship), c = G.consoles.find(x => x.id === cid);
    if (!c || s.status !== 'PLAYING' || s.saut || s.grille[cid]) return false;
    v = smNormVal(c.type, v);
    s.cons[cid] = smEtatApres(c.type, s.cons[cid], v);
    s.flash[cid] = now;
    for (const n of Object.keys(s.ord)) {
        const o = s.ord[n];
        if (o.k === 'simple' && o.c === cid && smCorrespond(c.type, o.v, v)) { smReussite(M, n, by, now); return true; }
        if (o.k === 'chaine') {
            if (!o.e && o.c === cid && smCorrespond(c.type, o.v, v)) { o.e = 1; smDire(s, `⛓️ Étape 1 / 2 réussie : maintenant ${s.noms[o.c2]} !`, 'ok'); return true; }
            if (o.e === 1 && o.c2 === cid && smCorrespond(c.type, o.v2, v)) { smReussite(M, n, by, now); return true; }
        }
        if (o.k === 'duo' && (o.c === cid || o.c2 === cid)) {
            o.p[cid] = now;
            const autre = cid === o.c ? o.c2 : o.c;
            if (o.p[autre] && now - o.p[autre] <= 1500) { smReussite(M, n, by, now); return true; }
            // un androïde qui attend sur l'autre console réagit aussitôt
            Object.values(M.b).forEach(b => { const t = b.file && b.file[0]; if (t && t.c === autre && t.duo) { t.go = 1; t.des = now + smAlea(250, 650); } });
            return true;
        }
    }
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
function smDegats(M, n, now, txt) {
    const s = M.s;
    s.coque = Math.max(0, s.coque - n); s.degat = now;
    if (txt) smDire(s, txt, 'ko');
    if (s.coque <= 0) smFin(M, false, now);
}
function smEchec(M, n, now) {
    const s = M.s, o = s.ord[n], G = smGrille(s.ship), c = G.consoles.find(x => x.id === o.c);
    delete s.ord[n]; delete M.cri[n];
    smDegats(M, 12, now, `✖ Trop tard : ${s.noms[o.c]}${o.c2 ? ' et ' + s.noms[o.c2] : ''} (${SM_SECTEURS[c.s].n}). Coque endommagée !`);
    if (s.status === 'PLAYING') M.pend[n] = now + 1200;
}
function smSaut(M, now) {
    const s = M.s;
    s.ord = {}; M.pend = {}; M.cri = {};
    Object.values(M.b).forEach(b => { b.file = []; b.feu = ''; b.sas = 0; });
    s.feux = {}; s.breche = 0; s.gaz = 0; s.gravite = 0; s.noir = 0;
    if (s.obj && s.niveau >= s.obj) { smDire(s, `🚀 Dernier saut hyperespace : le vaisseau est sauvé !`, 'info'); return smFin(M, true, now); }
    s.saut = now + 2200;
    smDire(s, `🚀 SAUT HYPERESPACE vers le secteur ${s.niveau + 1} !`, 'info');
}
function smFin(M, victoire, now) {
    const s = M.s;
    s.status = 'FINISHED'; s.ord = {}; s.feux = {}; s.noir = 0; s.saut = 0; s.breche = 0; s.gaz = 0; s.gravite = 0;
    s.fin = { victoire: !!victoire, t: now };
    smDire(s, victoire ? '🏆 Mission accomplie !' : '💥 Le vaisseau est perdu…', victoire ? 'ok' : 'ko');
}
function smScore(s, n) { return (s.fait[n] || 0) * 10 + (s.niveau - 1) * 20 + (s.fin && s.fin.victoire ? 100 : 0); }

// ---- Incidents ----
function smIncident(M, now) {
    const s = M.s, G = smGrille(s.ship);
    const possibles = [['feu', 25], ['grille', 18], ['gaz', 15], ['noir', 13]];
    if (!s.breche) possibles.push(['breche', s.niveau >= 2 ? 15 : 0]);
    if (!s.gravite || s.gravite < now) possibles.push(['gravite', s.niveau >= 3 ? 12 : 0]);
    const tot = possibles.reduce((a, p) => a + p[1], 0); let r = Math.random() * tot, choix = 'feu';
    for (const [k, w] of possibles) { if ((r -= w) < 0) { choix = k; break; } }
    if (choix === 'feu' && smAllumerFeu(M, now)) return;
    if (choix === 'grille') {
        const libres = G.consoles.filter(c => !s.grille[c.id]);
        if (libres.length && Object.keys(s.grille).length < 2) {
            const c = libres[Math.floor(Math.random() * libres.length)];
            s.grille[c.id] = now;
            smDire(s, `⚡ COURT-CIRCUIT : ${s.noms[c.id]} (${SM_SECTEURS[c.s].n}) est grillé. Réparez-le avant de l’utiliser !`, 'ko');
            return;
        }
    }
    if (choix === 'gaz' && !s.gaz) {
        const cases = smCasesSol(G, 40); const c = cases[Math.floor(Math.random() * cases.length)];
        if (c) { s.gaz = { x: c[0], y: c[1], r: 3.6, f: now + 15000 }; smDire(s, `☣️ FUITE DE GAZ en ${SM_SECTEURS[G.sec[c[1] * SM.W + c[0]]].n} ! La zone ralentit et épuise.`, 'ko'); return; }
    }
    if (choix === 'breche' && smOuvrirBreche(M, now)) return;
    if (choix === 'gravite') { s.gravite = now + 10000; smDire(s, '🌀 GÉNÉRATEUR DE GRAVITÉ EN PANNE ! Vous flottez…', 'ko'); return; }
    s.noir = now + 8000;
    smDire(s, '🔦 PANNE DE COURANT ! Éclairage de secours seulement.', 'ko');
}
function smCasesSol(G, n) {
    const out = [];
    for (let i = 0; i < n * 8 && out.length < n; i++) { const x = Math.floor(Math.random() * SM.W), y = Math.floor(Math.random() * SM.H); if (G.sol[y * SM.W + x]) out.push([x, y]); }
    return out;
}
function smAllumerFeu(M, now) {
    const s = M.s, G = smGrille(s.ship);
    if (Object.keys(s.feux).length >= 2) return false;
    // un incendie bloque un passage (3 × 3 cases) entre deux secteurs, sans couper le vaisseau en deux
    const passages = [];
    for (let y = 1; y < SM.H - 1; y++) for (let x = 1; x < SM.W - 1; x++) {
        const k = y * SM.W + x; if (!G.sol[k]) continue;
        if ([1, -1, SM.W, -SM.W].some(d => G.sec[k + d] >= 0 && G.sec[k + d] !== G.sec[k])) passages.push([x, y]);
    }
    for (const [x, y] of smMelange(passages).slice(0, 14)) {
        const essai = Object.assign({}, s.feux, { ['f' + now]: { x: x, y: y, f: now + 30000, d: now + 8000 } });
        const feux = smCasesFeu({ feux: essai });
        const occupe = Object.values(M.pos).concat(Object.values(M.b)).some(p => p && Math.abs(Math.round(p.x) - x) <= 1 && Math.abs(Math.round(p.y) - y) <= 1);
        if (occupe || !smToutRelie(G, feux)) continue;
        s.feux = essai;
        smDire(s, `🔥 INCENDIE ! Le passage est bloqué : éteignez-le avec l’extincteur ou faites le tour.`, 'ko');
        return true;
    }
    return false;
}
function smOuvrirBreche(M, now) {
    const s = M.s, G = smGrille(s.ship);
    for (const [x, y] of smMelange(G.bord).slice(0, 20)) {
        const sec = G.sec[y * SM.W + x];
        // le sas d'urgence se trouve plus loin dans le même secteur
        const dist = smDistances(G, x, y), cand = [];
        for (let k = 0; k < dist.length; k++) if (dist[k] >= 9 && dist[k] <= 15 && G.sec[k] === sec) cand.push(k);
        if (!cand.length) continue;
        const k = cand[Math.floor(Math.random() * cand.length)];
        s.breche = { x: x, y: y, s: sec, sx: k % SM.W, sy: (k / SM.W) | 0, f: now + 18000 };
        smDire(s, `💨 BRÈCHE DANS LA COQUE (${SM_SECTEURS[sec].n}) ! Fermez le sas d’urgence avant d’être aspirés !`, 'ko');
        return true;
    }
    return false;
}
function smDistances(G, x0, y0) {        // distance en pas (4 directions) depuis une case
    const d = new Int16Array(SM.W * SM.H).fill(-1), file = [y0 * SM.W + x0]; d[file[0]] = 0;
    for (let i = 0; i < file.length; i++) {
        const k = file[i];
        for (const e of [1, -1, SM.W, -SM.W]) { const n = k + e; if (n >= 0 && n < d.length && d[n] < 0 && G.sol[n]) { d[n] = d[k] + 1; file.push(n); } }
    }
    return d;
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
// Aspiration vers une brèche : vitesse (cases/s) à ajouter à un astronaute
function smAspiration(s, x, y) {
    const b = s && s.breche; if (!b) return null;
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy), R = 9;
    if (d >= R) return null;
    const f = 3.1 * (1 - d / R) + 0.4;
    return { vx: dx / (d || 1) * f, vy: dy / (d || 1) * f, d: d };
}
function smDansGaz(s, x, y) { const g = s && s.gaz; return !!g && Math.hypot(g.x - x, g.y - y) < g.r; }

// Actions des joueurs liées aux incidents (vérifiées par l'hôte)
function smEteindre(M, by, id, now) {
    const s = M.s, f = s.feux[id]; if (!f) return false;
    delete s.feux[id];
    smDire(s, `🧯 ${(s.crew[by] && s.crew[by].nom) || by} a éteint l’incendie.`, 'ok');
    s.fait[by] = (s.fait[by] || 0) + 1;
    return true;
}
function smReparer(M, by, cid, now) {
    const s = M.s; if (!s.grille[cid]) return false;
    delete s.grille[cid];
    smDire(s, `🔧 ${(s.crew[by] && s.crew[by].nom) || by} a réparé ${s.noms[cid]}.`, 'ok');
    s.fait[by] = (s.fait[by] || 0) + 1;
    return true;
}
function smFermerSas(M, by, now) {
    const s = M.s; if (!s.breche) return false;
    s.breche = 0;
    smDire(s, `🚪 ${(s.crew[by] && s.crew[by].nom) || by} a fermé le sas d’urgence. Brèche colmatée !`, 'ok');
    s.fait[by] = (s.fait[by] || 0) + 1;
    return true;
}
function smAspire(M, by, now) {
    const s = M.s;
    smDegats(M, 6, now, `🌌 ${(s.crew[by] && s.crew[by].nom) || by} a été aspiré par la brèche ! Coque endommagée.`);
    return true;
}

function smPlacerAndroide(M, k) {
    const s = M.s, G = smGrille(s.ship), m = s.crew[k], d = G.departs[m.sec];
    const p = M.pos[k] || null;
    const [x, y] = p ? [Math.round(p.x), Math.round(p.y)] : smCaseLibreProche(G, d[0] + 1, d[1], null);
    M.b[k] = { x: x, y: y, d: 0, w: 0, chemin: [], file: [], flane: Date.now() + smAlea(1500, 4000), attente: 0, o: 0 };
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
        M.prochInc = now + smAlea(12000, 20000);
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
    // incendies qui durent : ils rongent la coque
    for (const k of Object.keys(s.feux)) {
        const f = s.feux[k];
        if (f.f < now) { delete s.feux[k]; change = true; continue; }
        if (now >= f.d) { f.d = now + 7000; smDegats(M, 3, now, '🔥 L’incendie ronge la coque !'); change = true; if (s.status !== 'PLAYING') return true; }
    }
    // brèche jamais refermée : grosse perte de pression, puis elle se colmate seule
    if (s.breche && now > s.breche.f) { s.breche = 0; smDegats(M, 15, now, '💨 Le sas n’a pas été fermé à temps : perte massive de pression !'); change = true; if (s.status !== 'PLAYING') return true; }
    if (s.gaz && now > s.gaz.f) { s.gaz = 0; smDire(s, '☣️ Fuite de gaz colmatée.', 'info'); change = true; }
    if (s.gravite && now > s.gravite) { s.gravite = 0; smDire(s, '🌀 Gravité rétablie.', 'info'); change = true; }
    if (s.noir && s.noir < now) { s.noir = 0; change = true; }
    // cerveau et déplacement des androïdes
    if (smCerveaux(M, now, dt)) change = true;
    // incidents à partir du secteur 2
    if (s.niveau >= 2 && now > M.prochInc && !s.saut) { M.prochInc = now + Math.max(10000, smAlea(17000, 25000) - s.niveau * 1200); smIncident(M, now); change = true; }
    Object.keys(s.flash).forEach(k => { if (now - s.flash[k] > 1500) { delete s.flash[k]; } });
    return change;
}
function smCerveaux(M, now, dt) {
    const s = M.s, G = smGrille(s.ship), feux = smCasesFeu(s); let change = false;
    Object.keys(M.b).forEach(k => {
        const b = M.b[k], m = s.crew[k]; if (!m || !m.bot) return;
        b.o = 0;
        if (b.stun && now < b.stun) { b.w = 0; return; }          // aspiré par une brèche : il reprend ses esprits
        // on oublie les tâches dont l'ordre a disparu ou changé
        while (b.file && b.file.length && b.file[0].n && (!s.ord[b.file[0].n] || s.ord[b.file[0].n].t0 !== b.file[0].t0)) b.file.shift();
        const t = b.file && b.file[0];
        const aller = (x, y) => { if (b.chemin.length || now < b.attente) return; const ch = smCheminVers(G, [Math.round(b.x), Math.round(b.y)], x, y, feux); if (ch) b.chemin = ch; else b.attente = now + 700; };
        if (t && now >= t.des) {
            const c = G.consoles.find(x => x.id === t.c);
            if (Math.hypot(c.x - b.x, c.y - b.y) < 1.6 && !b.chemin.length) {
                const o = t.n ? s.ord[t.n] : null;
                if (s.grille[c.id]) {                                // équipement grillé : 3 s de réparation à la clé
                    b.o = 'cle'; b.ox = c.x; b.oy = c.y;
                    if (!b.rep) b.rep = now + 3000;
                    else if (now >= b.rep) { b.rep = 0; if (smReparer(M, k, c.id, now)) change = true; }
                } else if (t.etape === 1 && (!o || o.e !== 1)) {
                    // ordre en chaîne : il attend que la première étape soit faite
                } else if (t.duo) {
                    b.pret = c.id;
                    const partenaire = Object.values(M.b).find(x => x !== b && x.pret === t.duo);
                    if (partenaire || t.go) {
                        b.file.shift(); b.pret = '';
                        if (smAgir(M, k, c.id, true, now)) change = true;
                        if (partenaire && s.ord[t.n]) { const tp = partenaire.file[0]; partenaire.file.shift(); partenaire.pret = ''; if (tp && smAgir(M, Object.keys(M.b).find(x => M.b[x] === partenaire), tp.c, true, now + 1)) change = true; }
                        b.flane = now + smAlea(1500, 3500);
                    }
                } else {
                    b.file.shift();
                    if (smAgir(M, k, c.id, t.v, now)) change = true;
                    b.flane = now + smAlea(1500, 3500);
                }
            } else aller(c.x, c.y);
        } else if (!t) {
            b.rep = 0;
            // sas d'urgence dans son secteur : il va le fermer
            if (s.breche && s.breche.s === m.sec) {
                const B = s.breche;
                if (Math.hypot(B.sx - b.x, B.sy - b.y) < 1.6 && !b.chemin.length) { b.o = 'cle'; b.ox = B.sx; b.oy = B.sy; if (!b.sas) b.sas = now + 1800; else if (now >= b.sas) { b.sas = 0; if (smFermerSas(M, k, now)) change = true; } }
                else aller(B.sx, B.sy);
            } else {
                b.sas = 0;
                // incendie dans son secteur : il l'éteint
                const id = Object.keys(s.feux).find(i => G.sec[s.feux[i].y * SM.W + s.feux[i].x] === m.sec || (s.feux[i].y > 0 && Math.hypot(s.feux[i].x - b.x, s.feux[i].y - b.y) < 8));
                if (id) {
                    const f = s.feux[id];
                    if (Math.hypot(f.x - b.x, f.y - b.y) < 2.6 && !b.chemin.length) { b.o = 'ext'; b.ox = f.x; b.oy = f.y; if (!b.feuT) b.feuT = now + 2600; else if (now >= b.feuT) { b.feuT = 0; if (smEteindre(M, k, id, now)) change = true; } }
                    else { b.feuT = 0; if (!b.chemin.length) { const c = smCaseLibreProche(G, f.x + (b.x < f.x ? -2 : 2), f.y, feux); aller(c[0], c[1]); } }
                } else if (now > b.flane && !b.chemin.length) {          // il flâne dans son secteur
                    b.flane = now + smAlea(2500, 6000);
                    const cases = [];
                    for (let i = 0; i < 30; i++) { const x = Math.floor(Math.random() * SM.W), y = Math.floor(Math.random() * SM.H); if (G.sec[y * SM.W + x] === m.sec && smEstLibre(G, x, y, feux)) cases.push([x, y]); }
                    const d = G.departs[m.sec], proches = cases.filter(c => Math.hypot(c[0] - d[0], c[1] - d[1]) < 9);
                    const cible = (proches.length ? proches : cases)[0];
                    if (cible) b.chemin = smChemin(G, [Math.round(b.x), Math.round(b.y)], cible, feux) || [];
                }
            }
        }
        b.r = t && t.fin && t.fin - now < 8000 ? 1 : 0;          // ordre urgent : il court
        let v = b.r ? 5.6 : 3.4;
        if (smDansGaz(s, b.x, b.y)) { v *= .55; b.r = 0; }
        if (s.gravite) v *= .7;
        smAvancer(b, G, feux, v * dt);
        // aspiration par la brèche
        const a = smAspiration(s, b.x, b.y);
        if (a) {
            const nx = b.x + a.vx * dt * .6, ny = b.y + a.vy * dt * .6;
            if (smEstLibre(G, Math.round(nx), Math.round(ny), feux)) { b.x = nx; b.y = ny; }
            if (a.d < .9) {
                const d = G.departs[m.sec], c = smCaseLibreProche(G, d[0], d[1], feux);
                b.x = c[0]; b.y = c[1]; b.chemin = []; b.stun = now + 3000;
                smAspire(M, k, now); change = true;
            }
        }
    });
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
    module.exports = { SM, SM_COULEURS, SM_TYPES, SM_CABLES, smGrille, smChemin, smCheminVers, smEstLibre, smCasesFeu, smNouvellePartie, smNormaliser, smMoteur, smEtape, smCrier, smAgir, smScore, smToutRelie, smCouleursAttribuees, smTexte, smTexteOrdre, smAvancer, smDirection, smEtatApres, smNormVal, smEteindre, smReparer, smFermerSas, smAspire, smAspiration, smDansGaz, smIncident, smAppliquerTypes };
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
    const smOutils = {};
    function smChargerOutils() { if (smOutils.cle) return; ['cle', 'ext'].forEach(k => { const im = new Image(); im.src = SM.DIR + (k === 'cle' ? 'outil-cle.png' : 'outil-extincteur.png'); smOutils[k] = im; }); }
    function smChargerSprites(cb) {
        if (spr.pret) { if (cb) cb(); return; }
        if (cb) spr.attente.push(cb);
        if (spr.base) return;
        let n = 0; const fini = () => { if (++n < 2) return; spr.pret = true; spr.attente.splice(0).forEach(f => f()); };
        smChargerOutils();
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
            const P = M.pos[a.by], pres = (x, y, r) => !P || Math.hypot(x - P.x, y - P.y) <= r;
            if (a.t === 'eteint' && M.s.feux[a.f] && pres(M.s.feux[a.f].x, M.s.feux[a.f].y, 3.6) && smEteindre(M, a.by, a.f, now)) smH.sale = true;
            if (a.t === 'repare') { const c = smGrille(M.s.ship).consoles.find(x => x.id === a.c); if (c && pres(c.x, c.y, SM.PORTEE + .9) && smReparer(M, a.by, a.c, now)) smH.sale = true; }
            if (a.t === 'sas' && M.s.breche && pres(M.s.breche.sx, M.s.breche.sy, 2.8) && smFermerSas(M, a.by, now)) smH.sale = true;
            if (a.t === 'aspire' && M.s.breche && smAspire(M, a.by, now)) smH.sale = true;
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
            Object.keys(M.b).forEach(k => { const b = M.b[k]; if (M.s.crew[k] && M.s.crew[k].bot) up[k] = { x: +b.x.toFixed(2), y: +b.y.toFixed(2), d: b.d, w: b.w, r: b.w && b.r ? 1 : 0, s: M.s.startedAt, o: b.o || 0, ox: b.ox || 0, oy: b.oy || 0, st: b.stun && b.stun > now ? 1 : 0 }; });
            if (Object.keys(up).length) window.update(window.ref(window.db, smC.cheminPos), up).catch(() => {});
        }
    }

    // ---------------- Client : affichage et commandes ----------------
    const smC = {
        sess: 0, s: null, G: null, img: null, imgPret: false, cv: null, g: null, raf: 0, ecoute: null, cheminPos: '',
        net: {}, aff: {}, pos: null, chemin: [], touches: new Set(), dernierEnvoi: 0, envoye: '', avant: 0, horloge: 0,
        decalage: 0, holoCle: '', sel: null, selId: '', fermee: '', nuages: [], vel: { x: 0, y: 0 }, etourdi: 0, pas: {}, traces: [], parts: [], appels: {}, appel: 0, saisie: '', cableSel: '', finAnim: null, maintien: null, lampes: [], fissures: [], emetteurs: [], course: { endu: 1, epuise: false, repos: 0, bouton: false, maj: false }, logVu: 0, niveauVu: 0, coqueVu: 100, degatVu: 0, tremble: 0, cam: null, pointeur: null, moi: false, finVue: 0, voile: null
    };
    window.smC = smC;     // (pour les tests)
    window.smTest = { viser: c => smViser(c), utiliser: (c, v) => smUtiliser(c, v), proche: () => smConsoleProche(), cible: () => smCibleProche(), tenir: t => smDebutMaintien(t, false), moteur: () => smH.M, incident: () => smH.M && smIncident(smH.M, Date.now()) };
    const tempsHote = () => Date.now() + smC.decalage;

    function smEnvoyer(action) {
        const code = salon(); if (!code || !window.update) return;
        const k = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        window.update(window.ref(window.db, 'salons/' + code), { ['smGame/a/' + k]: Object.assign({ by: moi() }, action) }).catch(err => console.error('Action non envoyée :', err));
    }
    // ---------------- Sons du vaisseau (spatialisés) et voix de l'ordinateur de bord ----------------
    const SM_SONS = { moteur: 'moteur', alarme: 'alarme', feu: 'feu', breche: 'breche', console: 'console', radio: 'radio', pas1: 'pas-1', pas2: 'pas-2', pas3: 'pas-3', pas4: 'pas-4', pas5: 'pas-5', pas6: 'pas-6' };
    const smA = { ctx: null, maitre: null, buf: {}, demande: false, boucles: {}, maj: 0 };
    function smSonActif() { return typeof sysSon === 'undefined' || sysSon.on; }
    function smAudio() {
        if (!smA.ctx) {
            smA.ctx = (typeof sysCtx === 'function' && sysCtx()) || (window.AudioContext || window.webkitAudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null);
            if (!smA.ctx) return null;
            smA.maitre = smA.ctx.createGain(); smA.maitre.connect(smA.ctx.destination);
        }
        if (smA.ctx.state === 'suspended') smA.ctx.resume().catch(() => {});
        if (!smA.demande) {
            smA.demande = true;
            Object.keys(SM_SONS).forEach(k => {
                fetch(SM.DIR + 'sons/' + SM_SONS[k] + '.wav').then(r => r.arrayBuffer()).then(ab => new Promise((ok, ko) => smA.ctx.decodeAudioData(ab, ok, ko))).then(b => { smA.buf[k] = b; }).catch(() => {});
            });
        }
        return smA.ctx;
    }
    ['pointerdown', 'keydown'].forEach(e => document.addEventListener(e, () => { if (smA.ctx && smA.ctx.state === 'suspended') smA.ctx.resume().catch(() => {}); }, true));
    // position d'un son par rapport à son astronaute : à gauche, à droite, près ou loin
    function smSpatial(x, y) {
        const r = smC.pos || (smC.cam ? { x: (smC.cam.x + smC.cv.width / smC.cam.e / 2) / SM.CELL, y: (smC.cam.y + smC.cv.height / smC.cam.e / 2) / SM.CELL } : { x: SM.W / 2, y: SM.H / 2 });
        const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
        return { pan: Math.max(-1, Math.min(1, dx / 10)), g: 1 / (1 + d / 5) };
    }
    function smJouer(nom, gain, pan, vitesse) {
        const ctx = smA.ctx, b = smA.buf[nom]; if (!ctx || !b || !smSonActif()) return;
        const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = vitesse || 1;
        const g = ctx.createGain(); g.gain.value = gain;
        let n = src.connect(g);
        if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan || 0; n = g.connect(p); }
        n.connect(smA.maitre); src.start();
    }
    function smBoucleSon(cle, nom, gain, pan, vitesse) {
        const ctx = smA.ctx; if (!ctx) return;
        let b = smA.boucles[cle];
        if (!b) {
            if (!smA.buf[nom]) return;
            const src = ctx.createBufferSource(); src.buffer = smA.buf[nom]; src.loop = true;
            const g = ctx.createGain(); g.gain.value = 0;
            const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            src.connect(g); if (p) { g.connect(p); p.connect(smA.maitre); } else g.connect(smA.maitre);
            src.start(0, Math.random() * smA.buf[nom].duration);
            b = smA.boucles[cle] = { src, g, p };
        }
        const t = ctx.currentTime;
        b.g.gain.setTargetAtTime(gain, t, .25);
        if (b.p) b.p.pan.setTargetAtTime(pan || 0, t, .2);
        if (vitesse) b.src.playbackRate.setTargetAtTime(vitesse, t, .4);
        b.vu = true;
    }
    function smMajSons(now) {
        if (now - smA.maj < 100) return; smA.maj = now;
        const ctx = smAudio(); if (!ctx || !smA.maitre) return;
        smA.maitre.gain.setTargetAtTime(smSonActif() ? 1 : 0, ctx.currentTime, .1);
        const s = smC.s; Object.values(smA.boucles).forEach(b => { b.vu = false; });
        if (s && s.status === 'PLAYING') {
            const dmg = 1 - s.coque / 100, th = tempsHote();
            smBoucleSon('moteur', 'moteur', .14 + dmg * .22, 0, (1 - dmg * .12) * (s.saut && s.saut > th ? 1.5 : 1));
            if (smAlerte(s)) smBoucleSon('alarme', 'alarme', .11, 0);
            Object.keys(s.feux).slice(0, 3).forEach(k => { const f = s.feux[k], sp = smSpatial(f.x, f.y); smBoucleSon('feu' + k, 'feu', .55 * sp.g, sp.pan); });
            if (s.breche) { const sp = smSpatial(s.breche.x, s.breche.y); smBoucleSon('breche', 'breche', .9 * sp.g + .08, sp.pan); }
        }
        Object.keys(smA.boucles).forEach(k => {
            const b = smA.boucles[k]; if (b.vu) return;
            b.g.gain.setTargetAtTime(0, ctx.currentTime, .2);
            setTimeout(() => { try { b.src.stop(); } catch (e) {} }, 800);
            delete smA.boucles[k];
        });
    }
    function smCouperSons() {
        Object.keys(smA.boucles).forEach(k => { try { smA.boucles[k].src.stop(); } catch (e) {} delete smA.boucles[k]; });
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    }
    // Voix de synthèse du navigateur. Par défaut seul l'écran de l'hôte parle (pour éviter l'écho de tous les téléphones).
    const smV = { file: [], parle: false, dernier: {} };
    function smVoixVoulue() { let v = null; try { v = localStorage.getItem('lmlp-sm-voix'); } catch (e) {} return v === null ? !!window.isHost : v === '1'; }
    function smDireVoix(txt, prio, cle) {
        const sy = window.speechSynthesis; if (!sy || !smSonActif() || !smVoixVoulue()) return;
        const now = Date.now();
        if (cle && smV.dernier[cle] && now - smV.dernier[cle] < 9000) return;
        if (cle) smV.dernier[cle] = now;
        if (prio >= 2) { smV.file = []; sy.cancel(); }
        else if (smV.file.length > 2) return;
        smV.file.push(txt);
        if (!sy.speaking) smVoixSuivante();
    }
    function smVoixSuivante() {
        const sy = window.speechSynthesis, txt = smV.file.shift(); if (!sy || !txt) return;
        const u = new SpeechSynthesisUtterance(txt);
        const voix = sy.getVoices().filter(v => /^fr/i.test(v.lang));
        u.voice = voix.find(v => /google|thomas|amélie|amelie|daniel/i.test(v.name)) || voix[0] || null;
        u.lang = 'fr-FR'; u.pitch = .55; u.rate = 1.04; u.volume = .95;
        u.onend = u.onerror = () => setTimeout(smVoixSuivante, 250);
        try { sy.speak(u); } catch (e) {}
    }

    // ---------------- Interface ----------------
    function smStyles() {
        if (document.getElementById('sm-style')) return;
        const st = document.createElement('style'); st.id = 'sm-style';
        st.textContent = `
        #sm-root{width:100%;display:flex;flex-direction:column;gap:8px;font-family:ui-monospace,Consolas,monospace;color:#e2e8f0}
        #sm-root .hud{display:grid;grid-template-columns:1fr 1fr auto auto;gap:12px;align-items:center;background:#0b1526;border:1px solid #1e3a5f;border-radius:10px;padding:7px 12px}
        #sm-root .jauge{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b}
        #sm-root .barre{height:9px;border-radius:5px;background:#0f172a;border:1px solid #1e293b;overflow:hidden;margin-top:3px}
        #sm-root .barre i{display:block;height:100%;transition:width .25s}
        #sm-root .niv{text-align:right;font-size:10px;color:#64748b;letter-spacing:.1em}
        #sm-root .niv b{display:block;font-size:20px;color:#fbbf24;line-height:1.1}
        #sm-voix{border:1px solid #334155;background:#0f172a;color:#94a3b8;border-radius:8px;padding:5px 7px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.1}
        #sm-voix.on{border-color:#22d3ee;color:#a5f3fc}
        #sm-cadre{position:relative;width:100%;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f;background:#01030a}
        #sm-cadre canvas{display:block;width:100%;touch-action:none;cursor:pointer}
        #sm-cadre.degat{animation:smDegat .5s}
        @keyframes smDegat{30%{box-shadow:inset 0 0 0 3px #f87171,0 0 40px rgba(248,113,113,.6)}}
        #sm-root .bas{display:grid;grid-template-columns:1fr 1.3fr;gap:8px}
        #sm-root .boite{background:#0b1526;border:1px solid #1e3a5f;border-radius:10px;padding:8px 11px;min-height:104px}
        #sm-root .boite h3{margin:0 0 5px;font-size:10px;letter-spacing:.2em;color:#64748b;text-transform:uppercase;font-weight:700}
        #sm-ordre{font-size:15px;font-weight:800;color:#fff;min-height:38px;line-height:1.25}
        #sm-ordre .etape{display:inline-block;font-size:10px;letter-spacing:.12em;color:#fbbf24;border:1px solid #fbbf24;border-radius:6px;padding:1px 5px;margin-right:6px;vertical-align:2px}
        #sm-root .t{height:6px;background:#1e293b;border-radius:3px;margin-top:6px;overflow:hidden}
        #sm-root .t i{display:block;height:100%;background:#34d399}
        #sm-crier{margin-top:7px;width:100%;padding:8px;border-radius:8px;border:1px solid #fbbf24;background:rgba(251,191,36,.12);color:#fbbf24;font-weight:800;letter-spacing:.06em;cursor:pointer;font-size:13px;font-family:inherit}
        #sm-crier:disabled{opacity:.35;cursor:default}
        #sm-log{display:flex;flex-direction:column-reverse;gap:2px;max-height:104px;overflow:hidden}
        #sm-log .m{font-size:11.5px;line-height:1.3}
        #sm-log .m .qui{color:#fbbf24;font-weight:800}
        #sm-log .ok{color:#34d399}#sm-log .ko{color:#f87171}#sm-log .info{color:#a5b4fc}
        #sm-root .aide{font-size:10.5px;color:#64748b;text-align:center}
        #sm-fin{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.82);padding:12px;z-index:5;animation:smApparait .5s}
        @keyframes smApparait{from{opacity:0}}
        #sm-fin .carte{max-width:460px;width:100%;background:#0b1526;border:1px solid rgba(34,211,238,.5);border-radius:14px;padding:16px;text-align:center;max-height:100%;overflow:auto}
        /* console holographique, affichée sur la carte à côté de l'équipement */
        #sm-holo{position:absolute;left:0;top:0;z-index:3;width:226px;pointer-events:none;opacity:0;transition:opacity .15s;will-change:transform}
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
        #sm-holo .corps{display:flex;justify-content:center;align-items:center;min-height:62px;position:relative}
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
        /* levier */
        #sm-holo .hb-levier{position:relative;width:70px;height:80px;border:none;background:transparent;cursor:grab;touch-action:none}
        #sm-holo .hb-levier .fente{position:absolute;left:29px;top:6px;width:12px;height:68px;border-radius:6px;background:#020617;border:1px solid #334155;box-shadow:inset 0 0 6px #000}
        #sm-holo .hb-levier .manche{position:absolute;left:17px;top:2px;width:36px;height:22px;border-radius:9px;background:linear-gradient(#fca5a5,#b91c1c);box-shadow:0 3px 0 #450a0a,0 0 10px rgba(239,68,68,.5);transition:top .18s cubic-bezier(.5,1.6,.6,1)}
        #sm-holo .hb-levier.bas .manche{top:56px}
        #sm-holo .hb-levier em{position:absolute;right:-34px;top:31px;font-style:normal;font-size:10px;font-weight:900;letter-spacing:.12em;color:#fca5a5}
        /* molette */
        #sm-holo .hb-molette{position:relative;width:118px;height:118px}
        #sm-holo .hb-molette .cadran{position:absolute;left:29px;top:29px;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#475569,#0f172a);border:2px solid #22d3ee;box-shadow:0 0 12px rgba(34,211,238,.45);transition:transform .25s}
        #sm-holo .hb-molette .cadran i{position:absolute;left:27px;top:4px;width:4px;height:18px;border-radius:2px;background:#22d3ee}
        #sm-holo .hb-molette .cadran b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff}
        #sm-holo .hb-molette button{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:1px solid #334155;background:#0f172a;color:#94a3b8;font-size:11px;font-weight:800;cursor:pointer;padding:0;font-family:inherit}
        #sm-holo .hb-molette button.on{border-color:#22d3ee;color:#020617;background:#22d3ee}
        /* clavier à code */
        #sm-holo .hb-code{display:flex;flex-direction:column;align-items:center;gap:5px}
        #sm-holo .hb-code .ecran{font-size:20px;letter-spacing:.35em;color:#34d399;background:#020617;border:1px solid #334155;border-radius:6px;padding:2px 4px 2px 10px;text-shadow:0 0 8px #34d399;min-width:110px;text-align:center}
        #sm-holo .hb-code .pave{display:grid;grid-template-columns:repeat(3,34px);gap:4px}
        #sm-holo .hb-code .pave button{height:26px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-weight:800;cursor:pointer;font-family:inherit}
        #sm-holo .hb-code .pave button:active{background:#22d3ee;color:#020617}
        /* câbles */
        #sm-holo .hb-cable{position:relative;width:190px;height:96px;touch-action:none}
        #sm-holo .hb-cable svg{position:absolute;inset:0;pointer-events:none}
        #sm-holo .hb-cable button{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;cursor:pointer;padding:0;font-family:inherit;font-weight:900;font-size:11px}
        #sm-holo .hb-cable .fiche{border:3px solid #0f172a;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
        #sm-holo .hb-cable .fiche.sel{box-shadow:0 0 0 3px #fff,0 0 14px #fff}
        #sm-holo .hb-cable .prise{border:2px dashed #64748b;background:#020617;color:#cbd5e1}
        /* maintien (réparer, éteindre, fermer le sas) */
        #sm-holo .hb-tenir{width:178px;padding:10px 8px;border-radius:10px;border:1px solid rgba(var(--c),.9);background:rgba(var(--c),.14);color:#fff;font-weight:900;font-size:12px;letter-spacing:.04em;cursor:pointer;font-family:inherit;touch-action:none;user-select:none;-webkit-user-select:none;position:relative;overflow:hidden}
        #sm-holo .hb-tenir img{width:28px;height:28px;vertical-align:middle;margin-right:6px;filter:drop-shadow(0 2px 3px #000)}
        #sm-holo .hb-tenir .prog{position:absolute;left:0;bottom:0;height:4px;width:0;background:rgb(var(--c));box-shadow:0 0 8px rgb(var(--c))}
        #sm-holo .alerte{font-size:11px;color:#fca5a5;text-align:center;margin-bottom:5px;font-weight:800}
        /* boutons sur la carte : course et appel */
        #sm-courir,#sm-appel{position:absolute;bottom:10px;z-index:2;width:62px;height:62px;border-radius:50%;border:none;cursor:pointer;padding:0;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.5)}
        #sm-courir{right:10px;background:conic-gradient(var(--ec,#34d399) calc(var(--e,1)*360deg),rgba(30,41,59,.85) 0)}
        #sm-appel{right:80px;width:52px;height:52px;bottom:15px;background:rgba(30,41,59,.85)}
        #sm-courir span,#sm-appel span{position:absolute;inset:5px;border-radius:50%;background:rgba(2,8,23,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:21px;line-height:1;color:#e2e8f0}
        #sm-courir span em,#sm-appel span em{font-style:normal;font-size:8.5px;letter-spacing:.12em;margin-top:2px;font-weight:800;color:#94a3b8}
        #sm-appel:active span{background:#7f1d1d}
        #sm-courir.on span{background:rgba(6,78,59,.9);box-shadow:inset 0 0 12px rgba(52,211,153,.7)}
        #sm-courir.on span em{color:#6ee7b7}
        #sm-courir.epuise span{background:rgba(69,10,10,.9)}
        #sm-courir.epuise span em{color:#fca5a5}
        @media (max-width:760px){#sm-root .bas{grid-template-columns:1fr}#sm-root .boite{min-height:0}#sm-ordre{font-size:13.5px;min-height:0}#sm-log{max-height:84px}#sm-holo{width:206px}#sm-root .hud{grid-template-columns:1fr 1fr auto;gap:8px}#sm-voix{grid-column:1 / -1}}`;
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
                <button id="sm-voix" title="Voix de l’ordinateur de bord sur cet appareil">🗣️ Voix</button>
            </div>
            <div id="sm-cadre"><canvas id="sm-cv"></canvas><div id="sm-holo"></div>
                <button id="sm-appel" title="Attirer l’attention (V)"><span>🗣️<em>!!!</em></span></button>
                <button id="sm-courir" title="Courir (Maj)"><span>🏃<em>COURIR</em></span></button></div>
            <div class="bas">
                <div class="boite"><h3>Ton ordre</h3><div id="sm-ordre">…</div><div class="t"><i id="sm-ordre-t"></i></div><button id="sm-crier">📢 Crier l’ordre</button></div>
                <div class="boite journal"><h3>Intercom</h3><div id="sm-log"></div></div>
            </div>
            <div class="aide">Touchez la carte pour vous déplacer (ou ↑ ↓ ← → / ZQSD), 🏃 ou Maj pour courir, 🗣️ ou V pour attirer l’attention. Passez près d’un équipement ou touchez-le pour ouvrir sa console. Criez vos ordres… ou avec 📢 (C) !</div>
        </div>`;
        smC.cv = document.getElementById('sm-cv'); smC.g = smC.cv.getContext('2d');
        smC.holoCle = ''; smC.logVu = 0; smC.sel = null; smC.fermee = '';
        document.getElementById('sm-crier').onclick = () => { smEnvoyer({ t: 'crie' }); son('clic'); };
        const voix = document.getElementById('sm-voix');
        const majVoix = () => { const on = smVoixVoulue(); voix.classList.toggle('on', on); voix.textContent = on ? '🗣️ Voix : oui' : '🔇 Voix : non'; };
        voix.onclick = () => { try { localStorage.setItem('lmlp-sm-voix', smVoixVoulue() ? '0' : '1'); } catch (e) {} majVoix(); if (smVoixVoulue()) smDireVoix('Voix de bord activée.', 2); else window.speechSynthesis && window.speechSynthesis.cancel(); };
        majVoix();
        const courir = document.getElementById('sm-courir');
        courir.onclick = () => { smC.course.bouton = !smC.course.bouton; son('clic'); };
        document.getElementById('sm-appel').onclick = smAppeler;
        if (!smC.moi) { courir.style.display = 'none'; document.getElementById('sm-appel').style.display = 'none'; }
        const cv = smC.cv;
        const versMonde = e => {
            const r = cv.getBoundingClientRect(), cam = smC.cam; if (!cam) return null;
            return smEcranVersMonde((e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height));
        };
        cv.onpointerdown = e => {
            smAudio();
            const w = versMonde(e); if (!w) return;
            smC.pointeur = { id: e.pointerId, t: 0, cible: false };
            try { cv.setPointerCapture(e.pointerId); } catch (x) {}
            // toucher un équipement, un incendie ou le sas : sa console s'ouvre et l'astronaute y va
            const cible = smCibleSous(w[0], w[1]);
            if (cible && smC.s && smC.s.status === 'PLAYING') {
                smC.pointeur.cible = true; smC.sel = Object.assign({ par: 'clic' }, cible); smC.fermee = '';
                const p = smC.pos, pt = smPointCible(cible);
                if (p && pt && !smAPortee(cible)) smViser([pt[0], pt[1]]);
                son('clic');
                return;
            }
            if (smC.sel && smC.sel.par === 'clic') smC.sel = null;
            smViser([Math.floor(w[0] / SM.CELL), Math.floor(w[1] / SM.CELL)]);
        };
        cv.onpointermove = e => {
            if (!smC.pointeur || smC.pointeur.id !== e.pointerId || smC.pointeur.cible) return;
            const t = performance.now(); if (t - smC.pointeur.t < 140) return; smC.pointeur.t = t;
            const w = versMonde(e); if (w) smViser([Math.floor(w[0] / SM.CELL), Math.floor(w[1] / SM.CELL)]);
        };
        cv.onpointerup = cv.onpointercancel = () => { smC.pointeur = null; };
    }
    function smEcranVersMonde(sx, sy) {      // inverse de la transformation de la caméra (sans le roulis)
        const cam = smC.cam; return [sx / cam.e + cam.x, sy / cam.e + cam.y];
    }
    function smAppeler() {
        if (!smC.moi || !smC.s || smC.s.status !== 'PLAYING') return;
        smC.appel = Date.now(); smC.envoye = ''; smC.dernierEnvoi = 0;
        smJouer('radio', .5, 0, 1.1); son('clic');
    }
    // ce qui se trouve sous le doigt : sas d'urgence, incendie ou équipement
    function smCibleSous(wx, wy) {
        const s = smC.s, C = SM.CELL; if (!s) return null;
        if (s.breche && Math.hypot((s.breche.sx + .5) * C - wx, (s.breche.sy + .5) * C - wy) < C * 1.4) return { k: 'sas', id: 'sas' };
        for (const id of Object.keys(s.feux)) { const f = s.feux[id]; if (Math.hypot((f.x + .5) * C - wx, (f.y + .5) * C - wy) < C * 2) return { k: 'feu', id }; }
        const c = smC.G && smC.G.consoles.find(k => Math.hypot((k.x + .5) * C - wx, (k.y + .5) * C - wy) < C * 1.35);
        return c ? { k: 'c', id: c.id } : null;
    }
    function smPointCible(t) {
        const s = smC.s;
        if (t.k === 'sas') return s.breche ? [s.breche.sx, s.breche.sy] : null;
        if (t.k === 'feu') { const f = s.feux[t.id]; if (!f) return null; const c = smC.pos && smCaseLibreProche(smC.G, f.x + (smC.pos.x < f.x ? -2 : 2), f.y, smCasesFeu(s)); return c; }
        const c = smC.G.consoles.find(x => x.id === t.id); return c ? [c.x, c.y] : null;
    }
    function smPortee(t) { return t.k === 'sas' ? 1.9 : t.k === 'feu' ? 2.7 : SM.PORTEE; }
    function smCentreCible(t) {
        const s = smC.s;
        if (t.k === 'sas') return s.breche ? [s.breche.sx, s.breche.sy] : null;
        if (t.k === 'feu') { const f = s.feux[t.id]; return f ? [f.x, f.y] : null; }
        const c = smC.G.consoles.find(x => x.id === t.id); return c ? [c.x, c.y] : null;
    }
    function smAPortee(t) { const p = smC.pos, c = smCentreCible(t); return !!(p && c && Math.hypot(c[0] - p.x, c[1] - p.y) < smPortee(t)); }
    function smCibleProche() {        // ce qui est à portée de son astronaute, par ordre d'urgence
        const s = smC.s, p = smC.pos; if (!p || !s) return null;
        if (s.breche && smAPortee({ k: 'sas' })) return { k: 'sas', id: 'sas' };
        const f = Object.keys(s.feux).find(id => smAPortee({ k: 'feu', id })); if (f) return { k: 'feu', id: f };
        const c = smConsoleProche(); return c ? { k: 'c', id: c.id } : null;
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
        const sel = smC.sel && smAPortee(smC.sel) ? smC.sel : null;
        if (k === 'e' && !bas) { if (smC.maintien && smC.maintien.clavier) smC.maintien = null; return; }
        if (!bas || s.status !== 'PLAYING' || e.repeat) return;
        if (k === 'c') { smEnvoyer({ t: 'crie' }); son('clic'); }
        if (k === 'v') smAppeler();
        if (!sel) return;
        if (sel.k !== 'c' || s.grille[sel.id]) { if (k === 'e') smDebutMaintien(sel, true); return; }
        const c = smC.G.consoles.find(x => x.id === sel.id), val = s.cons[c.id];
        if (k === 'e') { if (c.type === 'bouton') smUtiliser(c, true); if (c.type === 'inter' || c.type === 'levier') smUtiliser(c, !val); }
        if (/^[0-9]$/.test(k)) {
            if (c.type === 'curseur' && +k <= 5) smUtiliser(c, +k);
            if (c.type === 'molette') smUtiliser(c, +k);
            if (c.type === 'code') smTaperCode(c, k);
        }
        if (k === 'backspace' && c.type === 'code') smTaperCode(c, '⌫');
    }
    document.addEventListener('keydown', e => smClavier(e, true));
    document.addEventListener('keyup', e => smClavier(e, false));
    window.addEventListener('blur', () => { smC.touches.clear(); smC.course.maj = false; smC.maintien = null; });

    function smConsoleProche() {
        if (!smC.pos || !smC.G) return null;
        let mieux = null, dm = SM.PORTEE;
        smC.G.consoles.forEach(c => { const d = Math.hypot(c.x - smC.pos.x, c.y - smC.pos.y); if (d < dm) { dm = d; mieux = c; } });
        return mieux;
    }
    function smUtiliser(c, v) {
        const s = smC.s; if (!s || s.status !== 'PLAYING' || s.grille[c.id]) return;
        smEnvoyer({ t: 'agir', c: c.id, v: v });
        if (c.type !== 'bouton') s.cons[c.id] = smEtatApres(c.type, s.cons[c.id], smNormVal(c.type, v));      // affichage immédiat, l'hôte confirmera
        s.flash[c.id] = tempsHote();
        smC.holoCle = '';
        son('clic');
    }
    function smTaperCode(c, k) {
        if (k === '⌫') smC.saisie = smC.saisie.slice(0, -1);
        else if (k === '✓') { if (smC.saisie.length) { smUtiliser(c, smC.saisie.padStart(4, '0')); smC.saisie = ''; } }
        else if (smC.saisie.length < 4) smC.saisie += k;
        if (smC.saisie.length === 4) { const code = smC.saisie; smC.saisie = ''; smUtiliser(c, code); setTimeout(() => { smC.holoCle = ''; }, 0); }
        const ec = document.querySelector('#sm-holo .ecran'); if (ec) ec.textContent = (smC.saisie + '____').slice(0, 4);
        son('clic');
    }
    // Maintenir un bouton : réparer un équipement grillé, éteindre un incendie, fermer le sas d'urgence
    const SM_MAINTIEN = { c: 2800, feu: 2400, sas: 1700 };
    function smDebutMaintien(t, clavier) {
        if (!smAPortee(t)) return;
        smC.maintien = { k: t.k, id: t.id, t0: Date.now(), duree: SM_MAINTIEN[t.k], clavier: !!clavier };
    }
    function smMajMaintien(now) {
        const m = smC.maintien; if (!m) return;
        if (!smAPortee(m) || !smC.s || smC.s.status !== 'PLAYING') { smC.maintien = null; return; }
        const k = Math.min(1, (now - m.t0) / m.duree);
        const bar = document.querySelector('#sm-holo .prog'); if (bar) bar.style.width = (k * 100) + '%';
        if (k >= 1) {
            if (m.k === 'c') smEnvoyer({ t: 'repare', c: m.id });
            if (m.k === 'feu') smEnvoyer({ t: 'eteint', f: m.id });
            if (m.k === 'sas') smEnvoyer({ t: 'sas' });
            smC.maintien = null; smC.holoCle = '';
            smJouer('console', .35, 0, 1.6);
        }
    }
    function smOutilActuel() {      // outil en main pendant un maintien : clé ou extincteur, et ce qu'il vise
        const m = smC.maintien; if (!m) return null;
        const c = smCentreCible(m); if (!c) return null;
        return { o: m.k === 'feu' ? 'ext' : 'cle', x: c[0], y: c[1] };
    }

    // ---- Contenu de la console holographique selon le type de commande ----
    function smCorpsConsole(c, val) {
        if (c.type === 'bouton') return `<button class="hb-bouton${c.j === 1 ? ' bleu' : ''}" data-a="b" aria-label="Activer"></button>`;
        if (c.type === 'inter') return `<button class="hb-inter ${val ? 'on' : ''}" data-a="i"><span class="bille"></span>${val ? 'ALLUMÉ' : 'ÉTEINT'}</button>`;
        if (c.type === 'levier') return `<button class="hb-levier ${val ? 'bas' : ''}" data-a="l" aria-label="Levier"><span class="fente"></span><span class="manche"></span><em>${val ? 'BAS' : 'HAUT'}</em></button>`;
        if (c.type === 'curseur') {
            const v = Number(val) || 0;
            return `<div><div class="hb-cur"><button data-d="-1">−</button><div class="crans">${[0, 1, 2, 3, 4, 5].map(i => `<button data-v="${i}" class="${i <= v ? 'on' : ''}" style="height:${12 + i * 5}px" aria-label="${i}"></button>`).join('')}</div><button data-d="1">+</button></div><div class="hb-val">RÉGLAGE ${v}</div></div>`;
        }
        if (c.type === 'molette') {
            const v = Number(val) || 0;
            return `<div class="hb-molette"><div class="cadran" style="transform:rotate(${v * 36}deg)"><i></i></div><div class="cadran" style="background:none;border:none;box-shadow:none"><b>${v}</b></div>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const a = (i * 36 - 90) * Math.PI / 180; return `<button data-v="${i}" class="${i === v ? 'on' : ''}" style="left:${59 + Math.cos(a) * 49}px;top:${59 + Math.sin(a) * 49}px">${i}</button>`; }).join('')}</div>`;
        }
        if (c.type === 'code') return `<div class="hb-code"><div class="ecran">${(smC.saisie + '____').slice(0, 4)}</div><div class="pave">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div></div>`;
        if (c.type === 'cable') {
            const e = String(val || 'ABC'), Y = i => 16 + i * 32;
            const lignes = SM_CABLES.map((cb, i) => { const j = SM_PRISES.indexOf(e[i]); return `<path d="M24 ${Y(i)} C 90 ${Y(i)}, 100 ${Y(j)}, 166 ${Y(j)}" stroke="${cb.h}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>`; }).join('');
            return `<div class="hb-cable"><svg viewBox="0 0 190 96">${lignes}</svg>
                ${SM_CABLES.map((cb, i) => `<button class="fiche${smC.cableSel === cb.k ? ' sel' : ''}" data-cab="${cb.k}" style="left:14px;top:${Y(i)}px;background:${cb.h}" aria-label="Câble ${cb.k}"></button>`).join('')}
                ${SM_PRISES.map((p, j) => `<button class="prise" data-pri="${p}" style="left:176px;top:${Y(j)}px">${p}</button>`).join('')}</div>`;
        }
        return '';
    }
    function smLierConsole(el, c, val) {
        const q = s => el.querySelector(s), qa = s => el.querySelectorAll(s);
        if (q('[data-a="b"]')) q('[data-a="b"]').onclick = () => smUtiliser(c, true);
        if (q('[data-a="i"]')) q('[data-a="i"]').onclick = () => smUtiliser(c, !val);
        const lev = q('[data-a="l"]');
        if (lev) {        // on tire le levier (glisser), ou on le touche
            let y0 = null, fait = false;
            lev.onpointerdown = e => { y0 = e.clientY; fait = false; try { lev.setPointerCapture(e.pointerId); } catch (x) {} };
            lev.onpointermove = e => { if (y0 === null || fait) return; const dy = e.clientY - y0; if ((!val && dy > 18) || (val && dy < -18)) { fait = true; smUtiliser(c, !val); } };
            lev.onpointerup = () => { if (y0 !== null && !fait) smUtiliser(c, !val); y0 = null; };
        }
        qa('[data-d]').forEach(x => { x.onclick = () => { const v = Number(val) || 0, n = Math.max(0, Math.min(5, v + Number(x.dataset.d))); if (n !== v) smUtiliser(c, n); }; });
        qa('[data-v]').forEach(x => { x.onclick = () => { const n = Number(x.dataset.v); if (n !== (Number(val) || 0)) smUtiliser(c, n); }; });
        qa('[data-k]').forEach(x => { x.onclick = () => smTaperCode(c, x.dataset.k); });
        // câbles : toucher une fiche puis une prise, ou glisser la fiche jusqu'à la prise
        qa('[data-cab]').forEach(x => {
            x.onpointerdown = e => { smC.cableSel = x.dataset.cab; qa('[data-cab]').forEach(y => y.classList.toggle('sel', y === x)); try { x.releasePointerCapture(e.pointerId); } catch (z) {} };
        });
        const branche = p => { if (!smC.cableSel) return; const v = smC.cableSel + ':' + p; smC.cableSel = ''; smUtiliser(c, v); };
        qa('[data-pri]').forEach(x => { x.onclick = () => branche(x.dataset.pri); x.onpointerup = () => branche(x.dataset.pri); });
    }
    // Console holographique : s'ouvre quand on passe à côté d'un équipement (ou d'un incendie, du sas) ou quand on le touche
    function smMajHolo() {
        const s = smC.s, G = smC.G, el = document.getElementById('sm-holo'); if (!el || !s || !G || !smC.cam) return;
        const proche = s.status === 'PLAYING' && !s.saut && smC.moi ? smCibleProche() : null;
        const meme = (a, b) => a && b && a.k === b.k && a.id === b.id;
        if (smC.fermee && (!proche || proche.k + proche.id !== smC.fermee)) smC.fermee = '';
        let sel = smC.sel;
        if (sel && !smCentreCible(sel)) sel = null;          // incendie éteint, sas fermé…
        if (sel && sel.par === 'clic' && meme(proche, sel)) sel.par = 'arrive';
        if (sel && sel.par !== 'clic' && !meme(proche, sel)) sel = null;
        if (!sel && proche && proche.k + proche.id !== smC.fermee) sel = Object.assign({ par: 'proche' }, proche);
        if (s.status !== 'PLAYING' || s.saut || !smC.moi) sel = null;
        smC.sel = sel; smC.selId = sel && sel.k === 'c' ? sel.id : '';
        if (!sel) { el.classList.remove('vu'); smC.holoCle = ''; smC.maintien = null; return; }
        const pret = smAPortee(sel), centre = smCentreCible(sel);
        const c = sel.k === 'c' ? G.consoles.find(x => x.id === sel.id) : null, val = c ? s.cons[c.id] : null, grille = c && s.grille[c.id];
        const cle = sel.k + sel.id + ':' + JSON.stringify(val) + ':' + pret + ':' + !!grille;
        if (cle !== smC.holoCle) {
            const neuf = !smC.holoCle || smC.holoCle.split(':')[0] !== sel.k + sel.id;
            smC.holoCle = cle;
            if (neuf) { smC.saisie = ''; smC.cableSel = ''; }
            let titre, sous, coul, corps, aide;
            const tenir = (img, txt) => `<button class="hb-tenir" data-tenir="1"><img src="${SM.DIR}${img}" alt="">${txt}<span class="prog"></span></button>`;
            if (sel.k === 'sas') { titre = 'Sas d’urgence'; sous = 'Brèche dans la coque'; coul = '251,191,36'; corps = tenir('outil-cle.png', 'MAINTENIR : FERMER'); aide = pret ? 'Maintenez (ou touche <b>E</b>)' : '🚶 En route vers le sas…'; }
            else if (sel.k === 'feu') { titre = 'Incendie'; sous = 'Passage bloqué'; coul = '249,115,22'; corps = tenir('outil-extincteur.png', 'MAINTENIR : ÉTEINDRE'); aide = pret ? 'Maintenez (ou touche <b>E</b>)' : '🚶 En route vers l’incendie…'; }
            else {
                titre = s.noms[c.id]; sous = SM_SECTEURS[c.s].n + (c.b ? ' · borne' : ''); coul = SM_SECTEURS[c.s].c;
                if (grille) { corps = `<div><div class="alerte">⚡ ÉQUIPEMENT GRILLÉ</div>${tenir('outil-cle.png', 'MAINTENIR : RÉPARER')}</div>`; aide = pret ? 'Maintenez (ou touche <b>E</b>) pendant 3 s' : '🚶 En route vers l’équipement…'; }
                else {
                    corps = smCorpsConsole(c, val);
                    aide = !pret ? '🚶 En route vers l’équipement…' : ({ curseur: 'Touches <b>0</b> à <b>5</b>', molette: 'Touches <b>0</b> à <b>9</b>', code: 'Tapez les <b>4 chiffres</b>', cable: 'Touchez une fiche, puis une prise', levier: 'Tirez le levier (ou <b>E</b>)' })[c.type] || 'Touche <b>E</b>';
                }
            }
            el.innerHTML = `<div class="in ${pret ? '' : 'off'}" style="--c:${coul}">
                <div class="tete"><i></i><b>${smEsc(titre)}<span>${smEsc(sous)}</span></b><button class="x" aria-label="Fermer">✕</button></div>
                <div class="corps">${corps}</div><div class="pied">${aide}</div></div>`;
            el.querySelector('.x').onclick = () => { smC.fermee = sel.k + sel.id; smC.sel = null; son('clic'); };
            const bt = el.querySelector('[data-tenir]');
            if (bt) {
                const stop = () => { if (smC.maintien && !smC.maintien.clavier) smC.maintien = null; const b = el.querySelector('.prog'); if (b && !smC.maintien) b.style.width = '0'; };
                bt.onpointerdown = e => { e.preventDefault(); try { bt.setPointerCapture(e.pointerId); } catch (x) {} smDebutMaintien(sel, false); };
                bt.onpointerup = bt.onpointercancel = bt.onlostpointercapture = stop;
                bt.oncontextmenu = e => e.preventDefault();
            } else if (c) smLierConsole(el, c, val);
            if (neuf) { el.classList.remove('neuf'); void el.offsetWidth; el.classList.add('neuf'); }
        }
        el.classList.add('vu');
        // position : au-dessus de la cible (ou en dessous s'il n'y a pas la place)
        const cv = smC.cv, r = cv.clientWidth / cv.width, C = SM.CELL;
        const [ex, ey] = smMondeVersEcran((centre[0] + .5) * C, (centre[1] + .5) * C);
        const sx = ex * r, sy = ey * r;
        const w = el.offsetWidth, h = el.offsetHeight, W = cv.clientWidth, H = cv.clientHeight, marge = C * (sel.k === 'feu' ? 2 : 1.45) * smC.cam.e * r + 10;
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
        const o = smC.moi && s.ord[moi()];
        const etiquette = o ? (o.k === 'duo' ? '<span class="etape">À DEUX</span>' : o.k === 'chaine' ? `<span class="etape">ÉTAPE ${o.e ? 2 : 1} / 2</span>` : '') : '';
        el('sm-ordre').innerHTML = o ? etiquette + smEsc(smTexteOrdre(s, o)) : (s.saut ? '— saut hyperespace en cours —' : (smC.moi ? '…' : 'Vous regardez la partie.'));
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
    function smMondeVersEcran(wx, wy) { const cam = smC.cam; return [(wx - cam.x) * cam.e, (wy - cam.y) * cam.e]; }
    function smTaille() {
        const cv = smC.cv, cadre = document.getElementById('sm-cadre'); if (!cv || !cadre) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const L = cadre.clientWidth || 600;
        const H = L < 700 ? Math.max(300, window.innerHeight * 0.52) : Math.max(240, Math.min(L * SM.IMG_H / SM.IMG_W, window.innerHeight * 0.64));
        const w = Math.round(L * dpr), h = Math.round(H * dpr);
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cv.style.height = H + 'px'; }
    }
    // Préparation du décor d'un vaisseau : teinte des secteurs, masque de l'espace, lampes, fissures
    function smPreparerDecor() {
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
        // masque de l'espace (là où les étoiles défilent), adouci
        const m = document.createElement('canvas'); m.width = SM.W; m.height = SM.H;
        const gm = m.getContext('2d'), mi = gm.createImageData(SM.W, SM.H);
        for (let k = 0; k < SM.W * SM.H; k++) if (G.espace[k]) { mi.data[k * 4 + 3] = 255; }
        gm.putImageData(mi, 0, 0);
        smC.masqueCiel = m;
        smC.ciel = document.createElement('canvas'); smC.ciel.width = SM.IMG_W / 2; smC.ciel.height = SM.IMG_H / 2;
        smC.etoiles = Array.from({ length: 200 }, () => ({ x: Math.random() * SM.IMG_W / 2, y: Math.random() * SM.IMG_H / 2, z: .25 + Math.random() * .75 }));
        // tirage pseudo-aléatoire propre au vaisseau (même décor pour tous les joueurs)
        let graine = (s.ship + 1) * 9301 + 49297;
        const rnd = () => { graine = (graine * 9301 + 49297) % 233280; return graine / 233280; };
        smC.lampes = [];
        for (let y = 4; y < SM.H; y += 8) for (let x = 5; x < SM.W; x += 10) {
            const c = smCaseLibreProche(G, x, y, null);
            if (G.sol[c[1] * SM.W + c[0]] && Math.hypot(c[0] - x, c[1] - y) < 4) smC.lampes.push({ x: c[0], y: c[1], ph: rnd() * 6.3, secours: smC.lampes.length % 3 === 0 });
        }
        // fissures : elles apparaissent sur les murs et les équipements quand la coque s'abîme
        const murs = [];
        for (let y = 1; y < SM.H - 1; y++) for (let x = 1; x < SM.W - 1; x++) { const k = y * SM.W + x; if (!G.sol[k] && !G.espace[k] && (G.sol[k - 1] || G.sol[k + 1] || G.sol[k - SM.W] || G.sol[k + SM.W])) murs.push([x, y]); }
        smC.fissures = [];
        for (let i = 0; i < 34 && murs.length; i++) {
            const [x, y] = murs[Math.floor(rnd() * murs.length)];
            const branches = [];
            const pousse = (px, py, a, long, prof) => {
                const pts = [[px, py]];
                for (let k = 0; k < 4; k++) { a += (rnd() - .5) * 1.2; px += Math.cos(a) * long; py += Math.sin(a) * long; pts.push([px, py]); if (prof < 2 && rnd() < .35) pousse(px, py, a + (rnd() < .5 ? .9 : -.9), long * .7, prof + 1); }
                branches.push(pts);
            };
            pousse((x + rnd()) * SM.CELL, (y + rnd()) * SM.CELL, rnd() * 6.3, SM.CELL * (.35 + rnd() * .35), 0);
            smC.fissures.push(branches);
        }
        smC.emetteurs = G.consoles.map(c => [c.x, c.y]).concat(smC.lampes.map(l => [l.x, l.y]));
    }
    function smAlerte(s) { return s.status === 'PLAYING' && (s.coque <= 35 || Object.keys(s.feux).length > 0 || !!s.breche || !!s.gaz || !!s.gravite || Object.keys(s.grille).length > 0); }

    function smBoucle(t) {
        smC.raf = requestAnimationFrame(smBoucle);
        const salle = window.currentRoom;
        if (!document.getElementById('sm-cv') || (salle && (salle.status !== 'IN_GAME' || salle.selectedMode !== 'machines'))) { cancelAnimationFrame(smC.raf); smC.raf = 0; smArreter(); return; }
        const now = Date.now(), dt = Math.min(0.06, Math.max(0, (now - (smC.horloge || now)) / 1000)); smC.horloge = now;
        const s = smC.s; if (!s || !smC.G) return;
        smTaille();
        if (smC.moi && smC.pos && s.status === 'PLAYING' && !s.saut && dt > 0) smDeplacer(dt, now);
        smMajMaintien(now);
        smEnvoyerPos(now);
        smAnimerAutres(dt);
        const o = smC.moi && s.ord[moi()], bar = document.getElementById('sm-ordre-t');
        if (bar) { const r = o ? Math.max(0, 1 - (tempsHote() - o.t0) / o.d) : 0; bar.style.width = r * 100 + '%'; bar.style.background = r > .5 ? '#34d399' : r > .25 ? '#fbbf24' : '#f87171'; }
        smDessiner(now, dt);
        smMajHolo();
        smMajCourse();
        smMajSons(now);
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
    function smDeplacer(dt, now) {
        const s = smC.s, p = smC.pos, G = smC.G, feux = smCasesFeu(s), K = smC.course;
        const ancien = [p.x, p.y];
        const libre = (x, y) => { const r = .3; return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].every(([a, b]) => smEstLibre(G, Math.round(a), Math.round(b), feux)); };
        const glisse = (ddx, ddy) => { if (libre(p.x + ddx, p.y + ddy)) { p.x += ddx; p.y += ddy; return true; } return false; };
        if (smC.etourdi > now) { p.w = 0; p.r = 0; return; }           // aspiré par la brèche : il reprend ses esprits
        if (smC.maintien) { smC.chemin = []; }                         // on ne bouge pas en réparant
        const gaz = smDansGaz(s, p.x, p.y);
        const veut = !!(K.maj || K.bouton) && !K.epuise && !gaz;
        const vmax = (veut ? SM.COURSE_V : SM.MARCHE_V) * (gaz ? .55 : 1);
        // direction voulue : touches du clavier, ou prochaine case du chemin
        const T = smC.touches; let dir = null;
        if (T.size) {
            let dx = 0, dy = 0;
            if (T.has('arrowleft') || T.has('q') || T.has('a')) dx--;
            if (T.has('arrowright') || T.has('d')) dx++;
            if (T.has('arrowup') || T.has('z') || T.has('w')) dy--;
            if (T.has('arrowdown') || T.has('s')) dy++;
            if (dx || dy) { const n = Math.hypot(dx, dy); dir = { x: dx / n, y: dy / n }; }
        } else if (smC.chemin.length) {
            while (smC.chemin.length && Math.hypot(smC.chemin[0][0] - p.x, smC.chemin[0][1] - p.y) < (s.gravite ? .5 : .05)) smC.chemin.shift();
            if (smC.chemin.length) { const [tx, ty] = smC.chemin[0]; if (!smEstLibre(G, tx, ty, feux)) smC.chemin = []; else { const dx = tx - p.x, dy = ty - p.y, n = Math.hypot(dx, dy) || 1; dir = { x: dx / n, y: dy / n }; } }
        }
        const V = smC.vel;
        if (s.gravite) {
            // apesanteur : on accélère doucement, on glisse sur son élan et on rebondit sur les murs
            if (dir) { V.x += dir.x * 5.5 * dt; V.y += dir.y * 5.5 * dt; }
            V.x *= (1 - .25 * dt); V.y *= (1 - .25 * dt);
            const v = Math.hypot(V.x, V.y), lim = vmax * 1.15; if (v > lim) { V.x *= lim / v; V.y *= lim / v; }
            if (!glisse(V.x * dt, 0)) V.x *= -.4;
            if (!glisse(0, V.y * dt)) V.y *= -.4;
            if (Math.hypot(V.x, V.y) > .2) p.d = smDirection(V.x, V.y);
        } else {
            V.x = 0; V.y = 0;
            if (dir && T.size) { glisse(dir.x * vmax * dt, 0); glisse(0, dir.y * vmax * dt); p.d = smDirection(dir.x, dir.y); }
            else if (smC.chemin.length) { p.chemin = smC.chemin; smAvancer(p, G, feux, vmax * dt); smC.chemin = p.chemin; }
        }
        // aspiration par la brèche
        const a = smAspiration(s, p.x, p.y);
        if (a) {
            glisse(a.vx * dt, 0); glisse(0, a.vy * dt);
            if (a.d < .9) {
                smEnvoyer({ t: 'aspire' });
                const m = s.crew[moi()], d = G.departs[m.sec], c = smCaseLibreProche(G, d[0], d[1], feux);
                p.x = c[0]; p.y = c[1]; smC.chemin = []; V.x = V.y = 0; smC.etourdi = now + 3000; smC.tremble = now + 600;
                smJouer('breche', .8, 0, 1.4);
            }
        }
        const d = Math.hypot(p.x - ancien[0], p.y - ancien[1]);
        p.w = d > 1e-4 ? 1 : 0;
        p.r = p.w && veut ? 1 : 0;
        p.phase = ((p.phase || 0) + d / 1.5) % 1;
        // endurance (le gaz l'épuise)
        if (p.r) { K.endu = Math.max(0, K.endu - SM.ENDU_PERTE * dt); K.repos = 0; }
        else if (gaz) { K.endu = Math.max(0, K.endu - .28 * dt); K.repos = 0; }
        else { K.repos += dt; if (K.repos > 0.7) K.endu = Math.min(1, K.endu + SM.ENDU_GAIN * dt * (p.w ? 0.6 : 1)); }
        if (K.endu <= 0 && !K.epuise) { K.epuise = true; son('erreur'); }
        if (K.epuise && K.endu >= SM.ENDU_REPRISE) K.epuise = false;
        if (p.r) smPoussiere(p, dt);
        smTraces('moi', p, s.gravite);
        // pris dans un incendie (il vient d'apparaître) : on est poussé vers la case libre la plus proche
        if (!smEstLibre(G, Math.round(p.x), Math.round(p.y), feux)) { const c = smCaseLibreProche(G, Math.round(p.x), Math.round(p.y), feux); p.x = c[0]; p.y = c[1]; smC.chemin = []; }
    }
    // Traces de pas qui s'effacent, et bruit de pas sur le métal
    function smTraces(cle, p, flotte) {
        if (flotte || !p.w) return;
        const t = smC.pas[cle] || (smC.pas[cle] = { x: p.x, y: p.y, cote: 1 });
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        if (d < (p.r ? .75 : .55)) return;
        const a = Math.atan2(p.y - t.y, p.x - t.x);
        t.x = p.x; t.y = p.y; t.cote = -t.cote;
        smC.traces.push({ x: p.x, y: p.y, a, cote: t.cote, t: Date.now() });
        if (smC.traces.length > 260) smC.traces.shift();
        const sp = cle === 'moi' ? { pan: 0, g: 1 } : smSpatial(p.x, p.y);
        smJouer('pas' + (1 + Math.floor(Math.random() * 6)), (cle === 'moi' ? .32 : .22 * sp.g) * (p.r ? 1.35 : 1), sp.pan, .9 + Math.random() * .25);
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
        const p = smC.pos, o = smOutilActuel();
        const etat = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), d: p.d, w: p.w, r: p.r || 0, s: smC.sess, o: o ? o.o : 0, ox: o ? o.x : 0, oy: o ? o.y : 0, ap: smC.appel || 0, st: smC.etourdi > now ? 1 : 0 };
        const cle = JSON.stringify(etat);
        if (cle === smC.envoye) return;
        smC.dernierEnvoi = now; smC.envoye = cle;
        window.update(window.ref(window.db, smC.cheminPos), { [moi()]: etat }).catch(() => {});
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
            a.o = cible.o || 0; a.ox = cible.ox; a.oy = cible.oy; a.st = cible.st;
            a.phase = ((a.phase || 0) + (a.w ? Math.max(d, 0) / 1.5 : 0)) % 1;
            if (cible.ap && cible.ap !== a.apVu) { if (a.apVu !== undefined) { smC.appels[n] = Date.now(); const sp = smSpatial(a.x, a.y); smJouer('radio', .5 * sp.g + .1, sp.pan, 1.1); } a.apVu = cible.ap; }
            if (a.r && a.w) smPoussiere(a, dt);
            smTraces(n, a, s.gravite);
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
            const x = (c.x + .5) * C, y = (c.y + .5) * C, val = s.cons[c.id], grille = !!s.grille[c.id];
            const col = grille ? '248,113,113' : SM_SECTEURS[c.s].c;
            const actif = c.id === smC.selId, mien = !me || me.sec === c.s;
            const eclat = s.flash[c.id] ? Math.max(0, 1 - (th - s.flash[c.id]) / 700) : 0;
            const pulse = grille ? (Math.random() < .5 ? 1 : 0) : .5 + .5 * Math.sin(now / 520 + c.x * .7);
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
            const k = (now / 1500 + c.x * .13) % 1, hh = C * .95;
            g.strokeStyle = `rgba(${col},${.5 * Math.sin(k * Math.PI)})`; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(x - hh * .85, y - hh + 2 * hh * k); g.lineTo(x + hh * .85, y - hh + 2 * hh * k); g.stroke();
            g.restore();
            const h = C * (actif ? 1.08 + Math.sin(now / 170) * .05 : .95), L = C * .4;
            g.strokeStyle = actif ? '#ffffff' : `rgba(${col},${mien ? .95 : .55})`; g.lineWidth = actif ? 2.6 : 1.7;
            [-1, 1].forEach(sx => [-1, 1].forEach(sy => { g.beginPath(); g.moveTo(x + sx * h, y + sy * (h - L)); g.lineTo(x + sx * h, y + sy * h); g.lineTo(x + sx * (h - L), y + sy * h); g.stroke(); }));
            // pastille d'état
            const bw = C * 1.35, bh = C * .58, bx = x - bw / 2, by = y - h - C * .32 - bh;
            g.fillStyle = 'rgba(2,8,23,.82)'; g.strokeStyle = `rgba(${col},${mien ? .9 : .5})`; g.lineWidth = 1.2;
            g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fill(); g.stroke();
            const cy = by + bh / 2;
            g.textAlign = 'center'; g.textBaseline = 'middle';
            if (grille) { g.font = `900 ${bh * .8}px ui-monospace, Consolas, monospace`; g.fillStyle = '#fca5a5'; g.fillText('⚡', x, cy + 1); return; }
            if (c.type === 'bouton') { g.fillStyle = c.j === 1 ? '#22d3ee' : '#ef4444'; g.shadowColor = g.fillStyle; g.shadowBlur = 6; g.beginPath(); g.arc(x, cy, bh * .28, 0, 6.3); g.fill(); g.shadowBlur = 0; }
            if (c.type === 'inter') {
                g.fillStyle = val ? 'rgba(52,211,153,.35)' : '#1e293b'; g.beginPath(); g.roundRect(x - bw * .28, cy - bh * .24, bw * .56, bh * .48, bh * .24); g.fill();
                g.fillStyle = val ? '#34d399' : '#64748b'; g.beginPath(); g.arc(x + (val ? bw * .16 : -bw * .16), cy, bh * .2, 0, 6.3); g.fill();
            }
            if (c.type === 'curseur') { const v = Number(val) || 0; for (let i = 0; i < 6; i++) { const hb = bh * (.22 + i * .09); g.fillStyle = i <= v ? '#22d3ee' : '#1e293b'; g.fillRect(x - bw * .33 + i * bw * .12, cy + bh * .3 - hb, bw * .08, hb); } }
            if (c.type === 'levier') { g.fillStyle = '#020617'; g.fillRect(x - bw * .05, cy - bh * .32, bw * .1, bh * .64); g.fillStyle = '#ef4444'; g.beginPath(); g.roundRect(x - bw * .16, cy + (val ? bh * .05 : -bh * .34), bw * .32, bh * .28, 3); g.fill(); }
            if (c.type === 'molette') { g.font = `900 ${bh * .62}px ui-monospace, Consolas, monospace`; g.fillStyle = '#22d3ee'; g.fillText('⟳' + (Number(val) || 0), x, cy + 1); }
            if (c.type === 'code') { g.font = `900 ${bh * .5}px ui-monospace, Consolas, monospace`; g.fillStyle = '#34d399'; g.fillText(String(val || '0000'), x, cy + 1); }
            if (c.type === 'cable') { const e = String(val || 'ABC'); SM_CABLES.forEach((cb, i) => { const j = SM_PRISES.indexOf(e[i]); g.strokeStyle = cb.h; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - bw * .3, cy - bh * .25 + i * bh * .25); g.lineTo(x + bw * .3, cy - bh * .25 + j * bh * .25); g.stroke(); }); }
        });
    }
    // Particules : fumée, étincelles, mousse d'extincteur, débris aspirés, confettis, explosions
    function smParticule(p) { smC.parts.push(p); if (smC.parts.length > 420) smC.parts.splice(0, smC.parts.length - 420); }
    function smEmettre(now, dt) {
        const s = smC.s, C = SM.CELL, dmg = 1 - s.coque / 100, R = Math.random;
        if (s.status !== 'PLAYING') return;
        const em = smC.emetteurs;
        if (dmg > .12 && R() < dmg * dmg * .9) { const e = em[Math.floor(R() * em.length)]; smParticule({ k: 'fumee', x: (e[0] + .5 + (R() - .5)) * C, y: (e[1] + .5) * C, vx: (R() - .5) * 8, vy: -12 - R() * 10, t: now, vie: 2200 + R() * 1200, r: C * (.4 + R() * .4) }); }
        if (dmg > .25 && R() < dmg * .05) { const e = em[Math.floor(R() * em.length)]; smEtincelles((e[0] + .5) * C, (e[1] + .5) * C, 7 + Math.floor(R() * 6), now); }
        Object.keys(s.grille).forEach(id => {
            const c = smC.G.consoles.find(x => x.id === id); if (!c) return;
            if (R() < .45) smParticule({ k: 'fumee', x: (c.x + .5 + (R() - .5) * .6) * C, y: (c.y + .3) * C, vx: (R() - .5) * 6, vy: -16 - R() * 10, t: now, vie: 2000, r: C * (.35 + R() * .35), noir: 1 });
            if (R() < .07) smEtincelles((c.x + .5) * C, (c.y + .5) * C, 9, now);
        });
        if (s.breche) {     // débris aspirés vers la brèche
            const b = s.breche;
            for (let i = 0; i < 3; i++) { const a = R() * 6.3, d = 2 + R() * 7; smParticule({ k: 'debris', x: (b.x + .5 + Math.cos(a) * d) * C, y: (b.y + .5 + Math.sin(a) * d) * C, cx: (b.x + .5) * C, cy: (b.y + .5) * C, t: now, vie: 900 }); }
        }
    }
    function smEtincelles(x, y, n, now) {
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, v = 60 + Math.random() * 140; smParticule({ k: 'etincelle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: now, vie: 350 + Math.random() * 350 }); }
    }
    function smDessinerParticules(g, now, dt) {
        const C = SM.CELL;
        smC.parts = smC.parts.filter(p => now - p.t < p.vie);
        smC.parts.forEach(p => {
            const k = (now - p.t) / p.vie;
            if (p.k === 'fumee') {
                p.x += p.vx * dt; p.y += p.vy * dt;
                const r = p.r * (1 + k * 1.8), a = (p.noir ? .5 : .32) * Math.sin(Math.PI * Math.min(1, k * 1.3));
                const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                gr.addColorStop(0, p.noir ? `rgba(30,30,34,${a})` : `rgba(148,163,184,${a})`); gr.addColorStop(1, 'rgba(100,116,139,0)');
                g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.3); g.fill();
            } else if (p.k === 'etincelle' || p.k === 'mousse') {
                const ox = p.x, oy = p.y;
                p.vy += (p.k === 'etincelle' ? 260 : 20) * dt; p.vx *= (1 - (p.k === 'mousse' ? 2.5 : .5) * dt); p.vy *= (1 - (p.k === 'mousse' ? 2.5 : .5) * dt);
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.k === 'etincelle') { g.strokeStyle = `rgba(254,240,138,${1 - k})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ox, oy); g.lineTo(p.x, p.y); g.stroke(); }
                else { g.fillStyle = `rgba(241,245,249,${.75 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, C * (.12 + k * .35), 0, 6.3); g.fill(); }
            } else if (p.k === 'debris') {
                const x = p.x + (p.cx - p.x) * k * k, y = p.y + (p.cy - p.y) * k * k;
                g.strokeStyle = `rgba(203,213,225,${.6 * (1 - k)})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (p.cx - x) * .12, y + (p.cy - y) * .12); g.stroke();
            } else if (p.k === 'confetti') {
                p.vy += 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot = (p.rot || 0) + dt * 8;
                g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.globalAlpha = 1 - k; g.fillRect(-4, -2, 8, 4); g.restore();
            } else if (p.k === 'boum') {
                const r = p.r * (.3 + k * 1.2), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                gr.addColorStop(0, `rgba(255,251,235,${1 - k})`); gr.addColorStop(.35, `rgba(251,146,60,${.9 * (1 - k)})`); gr.addColorStop(1, 'rgba(127,29,29,0)');
                g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.3); g.fill();
            }
        });
    }
    // Étoiles qui défilent autour du vaisseau (plus vite à chaque secteur, en traînées pendant le saut)
    function smDessinerCiel(g, now, dt, th) {
        const s = smC.s, cv = smC.ciel; if (!cv || !smC.masqueCiel) return;
        const c = cv.getContext('2d'), W = cv.width, H = cv.height;
        const saut = s.saut && s.saut > th, vit = (26 + 9 * (s.niveau - 1)) * (saut ? 26 : 1) * (s.status === 'PLAYING' || saut ? 1 : .2);
        c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
        smC.etoiles.forEach(e => {
            e.x -= vit * e.z * dt; if (e.x < -40) { e.x = W + Math.random() * 30; e.y = Math.random() * H; }
            const l = Math.max(1, vit * e.z * .045);
            c.strokeStyle = `rgba(226,232,240,${.35 + e.z * .6})`; c.lineWidth = .6 + e.z;
            c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + l, e.y); c.stroke();
        });
        c.globalCompositeOperation = 'destination-in';
        c.imageSmoothingEnabled = true; c.drawImage(smC.masqueCiel, 0, 0, W, H);
        g.drawImage(cv, 0, 0, SM.IMG_W, SM.IMG_H);
    }
    function smDessiner(now, dt) {
        const s = smC.s, G = smC.G, g = smC.g, cv = smC.cv; if (!g) return;
        smCamera();
        const cam = smC.cam, C = SM.CELL, th = tempsHote(), dmg = 1 - s.coque / 100;
        const fin = smC.finAnim, tf = fin ? now - fin.t0 : 0;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#01030a'; g.fillRect(0, 0, cv.width, cv.height);
        // le vaisseau tangue ; secousse aux dégâts ; il s'étire vers l'avant pendant le saut
        const choc = smC.tremble > now ? (smC.tremble - now) / 600 : 0, chocFin = fin && !fin.v ? Math.max(0, 1 - tf / 2600) : 0;
        const amp = choc * 14 + chocFin * 22;
        const roulis = Math.sin(now / 1700) * .0035 * (1 + dmg * 2) + (Math.random() - .5) * .02 * (choc + chocFin);
        const saut = s.saut && s.saut > th ? Math.sin((1 - (s.saut - th) / 2200) * Math.PI) : 0;
        const tx = (Math.random() - .5) * amp, ty = (Math.random() - .5) * amp * .6 + Math.sin(now / 1300) * 2;
        const cx = cv.width / 2, cy = cv.height / 2;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.translate(cx + tx, cy + ty); g.rotate(roulis); g.scale(1 + saut * .16, 1 - saut * .05); g.translate(-cx, -cy);
        g.transform(cam.e, 0, 0, cam.e, -cam.x * cam.e, -cam.y * cam.e);
        if (smC.imgPret) g.drawImage(smC.img, 0, 0, SM.IMG_W, SM.IMG_H);
        smDessinerCiel(g, now, dt, th);
        if (smC.calque) { g.imageSmoothingEnabled = false; g.drawImage(smC.calque, 0, 0, SM.IMG_W, SM.IMG_H); g.imageSmoothingEnabled = true; }
        // fissures (de plus en plus nombreuses quand la coque s'abîme)
        const nf = Math.floor(Math.max(0, dmg - .08) * 1.25 * smC.fissures.length);
        smC.fissures.slice(0, nf).forEach(br => br.forEach(pts => {
            g.strokeStyle = 'rgba(10,10,14,.85)'; g.lineWidth = 2.2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
            g.strokeStyle = 'rgba(226,232,240,.22)'; g.lineWidth = .8; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + 1, p[1] + 1) : g.moveTo(p[0] + 1, p[1] + 1)); g.stroke();
        }));
        const px = 1 / cam.e;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `900 ${Math.max(13, 15 * px)}px ui-monospace, Consolas, monospace`;
        (smC.centres || []).forEach((c, i) => { g.fillStyle = `rgba(${SM_SECTEURS[i].c},.35)`; g.fillText(SM_SECTEURS[i].n.toUpperCase(), (c[0] + .5) * C, (c[1] + .5) * C); });
        // fuite de gaz
        if (s.gaz) {
            const z = s.gaz;
            for (let k = 0; k < 7; k++) {
                const a = now / 2400 + k * .9, rx = (z.x + .5 + Math.cos(a) * z.r * .45) * C, ry = (z.y + .5 + Math.sin(a * 1.3) * z.r * .4) * C, r = z.r * C * (.55 + .15 * Math.sin(now / 700 + k));
                const gr = g.createRadialGradient(rx, ry, 0, rx, ry, r); gr.addColorStop(0, 'rgba(132,204,22,.28)'); gr.addColorStop(1, 'rgba(132,204,22,0)');
                g.fillStyle = gr; g.beginPath(); g.arc(rx, ry, r, 0, 6.3); g.fill();
            }
        }
        // traces de pas
        smC.traces = smC.traces.filter(t => now - t.t < 4000);
        smC.traces.forEach(t => {
            const k = 1 - (now - t.t) / 4000, ox = -Math.sin(t.a) * C * .16 * t.cote, oy = Math.cos(t.a) * C * .16 * t.cote;
            g.save(); g.translate((t.x + .5) * C + ox, (t.y + .5) * C + C * .35 + oy); g.rotate(t.a); g.fillStyle = `rgba(15,23,42,${.42 * k})`; g.beginPath(); g.ellipse(0, 0, C * .17, C * .09, 0, 0, 6.3); g.fill(); g.restore();
        });
        // brèche : trou dans la coque
        if (s.breche) {
            const b = s.breche, x = (b.x + .5) * C, y = (b.y + .5) * C, p = .5 + .5 * Math.sin(now / 120);
            const gr = g.createRadialGradient(x, y, 0, x, y, C * 1.6); gr.addColorStop(0, '#000'); gr.addColorStop(.45, 'rgba(15,23,42,.9)'); gr.addColorStop(1, 'rgba(239,68,68,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, C * 1.6, 0, 6.3); g.fill();
            g.strokeStyle = `rgba(239,68,68,${.4 + .5 * p})`; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(x, y, C * (2.2 + p * .4), 0, 6.3); g.stroke(); g.setLineDash([]);
            // sas d'urgence à fermer
            const sx = (b.sx + .5) * C, sy = (b.sy + .5) * C, rest = Math.max(0, (b.f - th) / 18000);
            g.fillStyle = 'rgba(2,8,23,.85)'; g.strokeStyle = `rgba(251,191,36,${.6 + .4 * p})`; g.lineWidth = 2.5;
            g.beginPath(); g.roundRect(sx - C * .8, sy - C * .8, C * 1.6, C * 1.6, 5); g.fill(); g.stroke();
            for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#0f172a' : '#fbbf24'; g.fillRect(sx - C * .7 + i * C * .35, sy - C * .15, C * .35, C * .3); }
            g.strokeStyle = '#fbbf24'; g.lineWidth = 3; g.beginPath(); g.arc(sx, sy, C * 1.15, -Math.PI / 2, -Math.PI / 2 + rest * 6.283); g.stroke();
            g.font = `900 ${Math.max(9, 10 * px)}px ui-monospace, Consolas, monospace`; g.fillStyle = '#fbbf24'; g.fillText('SAS', sx, sy - C * 1.5);
        }
        smDessinerConsoles(g, now, th, px);
        // incendies
        Object.values(s.feux).forEach(f => {
            for (let k = 0; k < 9; k++) {
                const a = now / 90 + k * 1.7, rx = (f.x + .5) * C + Math.sin(a) * C * .9, ry = (f.y + .5) * C + Math.cos(a * 1.3) * C * .8;
                const gr = g.createRadialGradient(rx, ry, 0, rx, ry, C * 1.2);
                gr.addColorStop(0, 'rgba(254,240,138,.95)'); gr.addColorStop(.5, 'rgba(249,115,22,.7)'); gr.addColorStop(1, 'rgba(239,68,68,0)');
                g.fillStyle = gr; g.beginPath(); g.arc(rx, ry, C * 1.2, 0, 6.3); g.fill();
            }
            if (Math.random() < .3) smParticule({ k: 'fumee', x: (f.x + .5 + (Math.random() - .5) * 2) * C, y: (f.y) * C, vx: (Math.random() - .5) * 8, vy: -20, t: now, vie: 1800, r: C * .5, noir: 1 });
        });
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
            const m = s.crew[n], mien = smC.moi && n === moi();
            let p = mien ? smC.pos : smC.aff[n];
            if (mien && p) { const o = smOutilActuel(); p = Object.assign({}, p, { o: o ? o.o : 0, ox: o && o.x, oy: o && o.y, st: smC.etourdi > now ? 1 : 0 }); }
            if (p) liste.push({ n, m, p });
        });
        liste.sort((a, b) => a.p.y - b.p.y);
        const T = C * 3.7, flotte = !!s.gravite, centreV = [SM.W / 2, SM.H / 2];
        liste.forEach(({ n, m, p }, idx) => {
            let x = (p.x + .5) * C, y = (p.y + .5) * C + C * .35, mien = smC.moi && n === moi();
            let rot = 0, echelle = 1, alpha = 1;
            if (flotte) { y -= C * (.35 + .25 * Math.sin(now / 420 + idx)); rot = Math.sin(now / 760 + idx) * .28; }
            // fin de partie : saut de joie, ou éjection dans l'espace
            if (fin && fin.v) y -= Math.abs(Math.sin(tf / 190 + idx)) * C * 1.1;
            if (fin && !fin.v && tf > 900) { const k = (tf - 900) / 1000, ax = p.x - centreV[0], ay = p.y - centreV[1], n2 = Math.hypot(ax, ay) || 1; x += ax / n2 * k * k * C * 9; y += ay / n2 * k * k * C * 9; rot = k * 5 * (idx % 2 ? 1 : -1); echelle = Math.max(.2, 1 - k * .35); alpha = Math.max(0, 1 - k * .45); }
            g.save(); g.globalAlpha = alpha;
            g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse((p.x + .5) * C, (p.y + .5) * C + C * .35, C * (flotte ? .4 : .62), C * (flotte ? .16 : .26), 0, 0, 6.3); g.fill();
            if (mien) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse((p.x + .5) * C, (p.y + .5) * C + C * .35, C * .82, C * .36, 0, 0, 6.3); g.stroke(); }
            const image = p.w && !flotte ? Math.floor((p.phase || 0) * SM.MARCHE) % SM.MARCHE : SM.MARCHE + Math.floor((now + n.length * 300) / 500) % SM.REPOS;
            if (p.r && p.w && !flotte) rot += [0, 1, 1, 1, 0, -1, -1, -1][p.d || 0] * .12;     // en courant, il se penche vers l'avant
            g.translate(x, y); g.rotate(rot); g.scale(echelle, echelle);
            smDessinerAstro(g, m.col, p.d || 0, image, 0, 0, T);
            g.restore();
            // outil en main : clé à molette ou extincteur, tourné vers sa cible
            if (p.o && smOutils[p.o] && smOutils[p.o].complete) {
                const versD = (p.ox || 0) >= p.x ? 1 : -1, im = smOutils[p.o];
                g.save(); g.translate(x + versD * C * .55, y - C * 1.05);
                if (versD < 0) g.scale(-1, 1);
                if (p.o === 'cle') { g.rotate(-.6 + Math.sin(now / 85) * .5); g.drawImage(im, -C * .2, -C * .8, C * 1.6, C * 1.6); }
                else { g.rotate(.35); g.drawImage(im, -C * .7, -C * .9, C * 1.5, C * 1.5); }
                g.restore();
                if (p.o === 'ext' && Math.random() < .85) for (let i = 0; i < 3; i++) { const tx2 = (p.ox + .5) * C, ty2 = (p.oy + .5) * C, sx = x + versD * C * .9, sy = y - C * 1.1, a = Math.atan2(ty2 - sy, tx2 - sx) + (Math.random() - .5) * .45, v = 120 + Math.random() * 90; smParticule({ k: 'mousse', x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: now, vie: 700 }); }
                if (p.o === 'cle' && Math.random() < .12) smEtincelles((p.ox + .5) * C, (p.oy + .5) * C, 4, now);
            }
            // étourdi après avoir été aspiré
            if (p.st) for (let i = 0; i < 3; i++) { const a = now / 260 + i * 2.1; g.fillStyle = '#fde047'; g.font = `${C * .6}px sans-serif`; g.fillText('★', x + Math.cos(a) * C * .7, y - T * .82 + Math.sin(a) * C * .2); }
            const info = smCouleurInfo(m.col);
            g.font = `800 ${Math.max(10, 11 * px)}px ui-monospace, Consolas, monospace`;
            g.lineWidth = 3 * px; g.strokeStyle = 'rgba(2,6,23,.9)'; g.strokeText(m.nom, x, y - T * .86); g.fillStyle = info ? (info.t || info.h) : '#fff'; g.fillText(m.nom, x, y - T * .86);
            // jauge d'endurance (et de maintien) sous son propre astronaute
            const K = smC.course;
            if (mien && (K.endu < .999 || p.r)) {
                const bw = C * 1.8, bh = Math.max(4, 4.5 * px), bx = x - bw / 2, by = y + C * .55;
                g.fillStyle = 'rgba(2,6,23,.8)'; g.beginPath(); g.roundRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, bh); g.fill();
                g.fillStyle = K.epuise ? '#f87171' : K.endu < .35 ? '#fbbf24' : '#34d399';
                g.beginPath(); g.roundRect(bx, by, Math.max(bh, bw * K.endu), bh, bh / 2); g.fill();
            }
            if (mien && smC.maintien) { const k = Math.min(1, (now - smC.maintien.t0) / smC.maintien.duree); g.strokeStyle = '#fbbf24'; g.lineWidth = 3; g.beginPath(); g.arc(x, y - T * .45, C * .9, -Math.PI / 2, -Math.PI / 2 + k * 6.283); g.stroke(); }
            // « !!! » pour attirer l'attention
            const ap = mien ? smC.appel : smC.appels[n];
            if (ap && now - ap < 2600) {
                const k = (now - ap) / 2600, by = y - T * 1.12 - Math.sin(now / 60) * 2;
                g.strokeStyle = `rgba(248,113,113,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y - T * .4, C * (1 + k * 3), 0, 6.3); g.stroke();
                g.fillStyle = '#ef4444'; g.beginPath(); g.roundRect(x - C * 1.1, by - C * .55, C * 2.2, C * 1.1, C * .4); g.fill();
                g.font = `900 ${C * .8}px ui-monospace, Consolas, monospace`; g.fillStyle = '#fff'; g.fillText('!!!', x, by + 1);
            }
        });
        // ordres criés : bulle au-dessus de celui qui crie
        liste.forEach(({ n, p }) => {
            const o = s.ord[n]; if (!o || !o.cr || th - o.cr > 3800) return;
            const txt = '📢 ' + smTexteOrdre(s, o);
            g.font = `800 ${Math.max(10, 11.5 * px)}px ui-monospace, Consolas, monospace`;
            const ls = smLignes(g, txt, 210 * px), lh = Math.max(10, 11.5 * px) * 1.2;
            const w = Math.max(...ls.map(l => g.measureText(l).width)) + 14 * px, h = ls.length * lh + 8 * px;
            const x = (p.x + .5) * C, by = (p.y + .5) * C - T * 1.05 - h;
            g.fillStyle = '#fbbf24'; g.beginPath(); g.roundRect(x - w / 2, by, w, h, 7 * px); g.fill();
            g.fillStyle = '#1c1917'; ls.forEach((l, k) => g.fillText(l, x, by + 4 * px + lh * (k + .5)));
        });
        smEmettre(now, dt);
        smDessinerParticules(g, now, dt);
        // éclairage : lampes des pièces, puis alerte rouge clignotante
        const alerte = smAlerte(s), noir = s.noir && s.noir > th, pulse = .5 + .5 * Math.sin(now / 260);
        if (!noir) {
            g.save(); g.globalCompositeOperation = 'lighter';
            smC.lampes.forEach(l => {
                const x = (l.x + .5) * C, y = (l.y + .5) * C, sc = Math.random() < dmg * .015 ? 0 : 1;      // les lampes grésillent quand le vaisseau est abîmé
                const r = C * 4.2, a = alerte ? .05 + .17 * pulse : .055 + .015 * Math.sin(now / 900 + l.ph);
                const gr = g.createRadialGradient(x, y, 0, x, y, r);
                gr.addColorStop(0, alerte ? `rgba(255,40,40,${a * sc})` : `rgba(191,219,254,${a * sc})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
            });
            g.restore();
        }
        // fin de partie perdue : explosions
        if (fin && !fin.v && tf < 2600 && Math.random() < .35) smParticule({ k: 'boum', x: (4 + Math.random() * (SM.W - 8)) * C, y: (8 + Math.random() * (SM.H - 16)) * C, t: now, vie: 700, r: C * (3 + Math.random() * 4) });
        if (fin && fin.v && tf < 3000 && Math.random() < .8) for (let i = 0; i < 3; i++) smParticule({ k: 'confetti', x: Math.random() * SM.IMG_W, y: -10, vx: (Math.random() - .5) * 60, vy: 60 + Math.random() * 90, t: now, vie: 3500, c: SM_COULEURS[Math.floor(Math.random() * SM_COULEURS.length)].h });
        // panne de courant : seulement la lampe frontale et l'éclairage de secours
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (alerte && !noir) { g.fillStyle = `rgba(220,38,38,${.06 + .11 * pulse})`; g.fillRect(0, 0, cv.width, cv.height); }
        if (noir) {
            if (!smC.ombre || smC.ombre.width !== cv.width || smC.ombre.height !== cv.height) { smC.ombre = document.createElement('canvas'); smC.ombre.width = cv.width; smC.ombre.height = cv.height; }
            const o = smC.ombre.getContext('2d');
            o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, cv.width, cv.height); o.fillStyle = 'rgba(0,0,0,.94)'; o.fillRect(0, 0, cv.width, cv.height);
            o.globalCompositeOperation = 'destination-out';
            const trou = (wx, wy, r, a) => { const [sx, sy] = smMondeVersEcran(wx, wy), gr = o.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = gr; o.beginPath(); o.arc(sx, sy, r, 0, 6.3); o.fill(); };
            const p = smC.pos || { x: SM.W / 2, y: SM.H / 2 };
            trou((p.x + .5) * C, (p.y + .5) * C, C * 4.4 * cam.e, 1);
            smC.lampes.forEach(l => { if (l.secours) trou((l.x + .5) * C, (l.y + .5) * C, C * 2.6 * cam.e, .55 + .25 * Math.sin(now / 180 + l.ph)); });
            g.drawImage(smC.ombre, 0, 0);
            g.save(); g.globalCompositeOperation = 'lighter';
            smC.lampes.forEach(l => { if (!l.secours) return; const [sx, sy] = smMondeVersEcran((l.x + .5) * C, (l.y + .5) * C), r = C * 2.2 * cam.e, gr = g.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(251,146,60,${.25 + .1 * Math.sin(now / 180 + l.ph)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r, 0, 6.3); g.fill(); });
            g.restore();
        }
        if (saut) { g.fillStyle = `rgba(224,242,254,${saut * .5})`; g.fillRect(0, 0, cv.width, cv.height); }
        if (fin && !fin.v && tf < 400) { g.fillStyle = `rgba(255,237,213,${1 - tf / 400})`; g.fillRect(0, 0, cv.width, cv.height); }
    }

    // Événements visibles par tous : dégâts, saut, incidents, fin (avec la voix de l'ordinateur de bord)
    function smEvenements(s) {
        const av = smC.prec, now = Date.now();
        smC.prec = s;
        if (!av) {          // début de partie (ou retour dans la partie)
            if (s.status === 'PLAYING' && s.total === 0 && s.niveau === 1) {
                smJouer('console', .5, 0, 1);
                smDireVoix('Système de bord activé. Bienvenue à bord, équipage.', 1);
                smDireVoix('Avaries détectées sur plusieurs systèmes. Tous à vos postes.', 1);
            }
            smC.degatVu = s.degat; smC.sautVu = s.saut;
            return;
        }
        if (s.degat && s.degat !== smC.degatVu) {
            smC.tremble = now + 600; son('alarme');
            const cadre = document.getElementById('sm-cadre'); if (cadre) { cadre.classList.remove('degat'); void cadre.offsetWidth; cadre.classList.add('degat'); }
            smC.degatVu = s.degat;
            const seuil = [75, 50, 25, 10].find(v => av.coque > v && s.coque <= v);
            if (seuil === 75) smDireVoix('Intégrité de la coque : soixante-quinze pour cent.', 1);
            else if (seuil === 50) smDireVoix('Attention. Intégrité de la coque : cinquante pour cent.', 2);
            else if (seuil === 25) smDireVoix('Alerte. Intégrité de la coque critique : vingt-cinq pour cent.', 2);
            else if (seuil === 10) smDireVoix('Alerte maximale. Rupture de la coque imminente.', 2);
            else if (s.status === 'PLAYING') smDireVoix(Math.random() < .5 ? 'Délai dépassé. Le système a subi des dommages.' : 'Commande non exécutée. Dommages enregistrés.', 0, 'echec');
        }
        if (s.prog >= SM.BUT - 2 && av.prog < SM.BUT - 2 && s.niveau === av.niveau) smDireVoix('Plus que deux réparations avant le saut.', 0);
        if (s.saut && s.saut !== smC.sautVu) {
            smC.sautVu = s.saut;
            if (typeof window.sautHyperespace === 'function') window.sautHyperespace(); else son('warp');
            smDireVoix('Moteurs hyperespace chargés. Saut dans trois… deux… un…', 2);
        }
        if (s.niveau > av.niveau) {
            smDireVoix(`Saut réussi. Bienvenue dans le secteur ${s.niveau}.`, 1);
            if (av.niveau === 1) smDireVoix('Nouveau secteur hostile. Les pannes vont s’accélérer.', 1);
        }
        // incidents
        const nf = Object.keys(s.feux).length, af = Object.keys(av.feux).length;
        if (nf > af) smDireVoix('Incendie détecté. Passage bloqué. Utilisez l’extincteur.', 1, 'feu');
        if (!nf && af && s.status === 'PLAYING' && !s.saut) smDireVoix('Incendie maîtrisé.', 0, 'feufin');
        if (s.noir && !av.noir) smDireVoix('Panne de courant générale. Éclairage de secours activé.', 1);
        if (!s.noir && av.noir && s.status === 'PLAYING') smDireVoix('Alimentation principale rétablie.', 0);
        if (s.breche && !av.breche) smDireVoix('Brèche dans la coque. Dépressurisation en cours. Fermez le sas.', 2);
        if (!s.breche && av.breche && s.status === 'PLAYING' && s.log.some(l => l.t.indexOf('🚪') === 0 && l.k > (av.lk || 0))) smDireVoix('Sas fermé. Pression stabilisée.', 0);
        if (s.gaz && !av.gaz) smDireVoix('Fuite de gaz toxique. Évitez la zone.', 1);
        if (s.gravite && !av.gravite) smDireVoix('Défaillance du générateur de gravité. Tenez-vous prêts.', 1);
        if (Object.keys(s.grille).length > Object.keys(av.grille).length) smDireVoix('Court-circuit détecté. Un équipement doit être réparé.', 1, 'grille');
        // nouvelles lignes de l'intercom : ordres criés (radio), liaisons perdues
        s.log.filter(l => l.k > (av.lk || 0)).forEach(l => {
            if (l.c === 'cri') { const p = smC.aff[l.n] || (l.n === moi() ? smC.pos : null), sp = p ? smSpatial(p.x, p.y) : { g: 1, pan: 0 }; smJouer('radio', .35 * sp.g + .1, sp.pan, 1); }
            if (l.t.indexOf('📡') === 0) smDireVoix(l.t.indexOf('repris') > 0 ? 'Liaison rétablie. Bon retour à votre poste.' : 'Liaison perdue avec un membre d’équipage. Un androïde prend le relais.', 0);
            if (l.t.indexOf('🔧') === 0) smJouer('console', .3, 0, 1.4);
        });
        const mien = smC.moi && s.ord[moi()];
        if (mien && mien.t0 !== smC.ordreVu) { smC.ordreVu = mien.t0; son('sonar'); }
        if (s.status === 'FINISHED' && smC.finVue !== s.startedAt) {
            smC.finVue = s.startedAt;
            const gagne = s.fin && s.fin.victoire;
            smC.finAnim = { t0: now, v: gagne };
            son(gagne ? 'victoire' : 'coule');
            smDireVoix(gagne ? 'Saut final réussi. Le vaisseau est hors de danger. Excellent travail, équipage.' : 'Intégrité de la coque nulle. Évacuation impossible. Fin de transmission.', 2);
            setTimeout(() => smAfficherFin(s), gagne ? 2400 : 2800);
        }
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
        smC.cheminPos = ''; smC.sess = 0; smC.s = null; smC.prec = null;
        smCouperSons();
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
                smC.course = { endu: 1, epuise: false, repos: 0, bouton: false, maj: false }; smC.nuages = []; smC.etiqCle = ''; smC.degatVu = s.degat; smC.sautVu = s.saut; smC.finVue = s.status === 'FINISHED' ? s.startedAt : 0; smC.ordreVu = 0;
                smC.prec = null; smC.vel = { x: 0, y: 0 }; smC.etourdi = 0; smC.pas = {}; smC.traces = []; smC.parts = []; smC.appels = {}; smC.appel = 0; smC.saisie = ''; smC.cableSel = ''; smC.finAnim = null; smC.maintien = null;
                smAppliquerTypes(s);
                if (s.status === 'FINISHED') setTimeout(() => smAfficherFin(s), 50);
                showScreen('screen-generic-game');
                const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = '⚙️ Salle des machines';
                smConstruire();
                smC.imgPret = false; smC.img = new Image(); smC.img.onload = () => { smC.imgPret = true; }; smC.img.src = SM.DIR + 'vaisseaux/' + smC.G.v.f;
                smChargerSprites();
                smPreparerDecor();
                smAudio();
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
