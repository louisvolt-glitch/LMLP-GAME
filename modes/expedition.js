// =====================================================================
//  MODE « EXPÉDITION SUR L'ÉPAVE » : jeu de stop ou encore (inspiré de Diamant).
//
//  La partie dure plusieurs expéditions (3, 5 ou 7). À chaque expédition, l'équipage
//  entre dans une épave et révèle une salle après l'autre :
//    💎 cristaux : partagés équitablement entre ceux qui sont encore à bord ;
//                  le reste de la division reste au sol de la salle.
//    ⚠️ danger   : 5 types (3 cartes chacun). Si le MÊME danger apparaît deux fois,
//                  c'est l'évacuation : ceux qui sont encore à bord perdent leur sac.
//    🗿 relique  : une relique alien par expédition ; seul un explorateur qui rentre
//                  SEUL peut l'emporter (5 points, 10 pour les deux dernières).
//  Après chaque salle, chacun choisit en secret : 🚀 Continuer ou 🏃 Rentrer.
//  Ceux qui rentrent se partagent les cristaux restés au sol sur le chemin, puis
//  mettent tout leur sac à l'abri dans leur coffre (définitif). Le coffre de chacun
//  reste secret jusqu'à la fin ; le plus gros coffre gagne.
//
//  Données Firebase : salons/<code>/exGame (écrit par l'hôte ; chaque joueur écrit
//  seulement exGame/choix/<son nom>).
// =====================================================================

const EX = { SALLE: 3.6, DECISION: 3.4, DESASTRE: 7.2, BILAN: 7, DEPART: 6.6, CHOIX_DEF: 15 };
const EX_TRESORS = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];
const EX_DANGERS = {
    oxy:  { i: '💨', n: 'Fuite d’oxygène', c: '#38bdf8', d: 'Les réserves d’air se vident !' },
    xeno: { i: '👾', n: 'Créature xénomorphe', c: '#a3e635', d: 'Quelque chose bouge dans les conduits…' },
    rad:  { i: '☢️', n: 'Radiations', c: '#facc15', d: 'Le compteur Geiger s’affole.' },
    feu:  { i: '🔥', n: 'Incendie', c: '#fb923c', d: 'Les flammes gagnent les coursives.' },
    elec: { i: '⚡', n: 'Court-circuit', c: '#c084fc', d: 'Des arcs électriques jaillissent des murs.' }
};
const EX_RELIQUES = [5, 5, 5, 10, 10];
const EX_FICHIERS_EPAVES = ['leviathan', 'ombre7', 'prospecteur', 'kerberos', 'vagabond', 'aurore', 'orion', 'atlas', 'albatros', 'nyx'];   // même ordre que les noms
const EX_NOMS_EPAVES = ['Le Léviathan', 'Station Ombre-7', 'Le Prospecteur', 'Cargo Kerberos', 'Le Vagabond', 'Frégate Aurore', 'Le Silence d’Orion', 'Minéralier Atlas', 'L’Albatros', 'Croiseur Nyx'];

const exC = { sess: null, cleSalle: '', clePhase: '', fini: '', ticker: null, tic: -1, vuDesastre: '', vue: '', vitrine: null, vitrineNom: '', stage: null, moi: null, moiNom: '', grince: 0 };
const exH = { lock: '' };

// ------------------------------- Utilitaires -------------------------------
function exMe() { return window.myPlayerKey || (window.state && state.username); }
function exSalon() { return window.currentCodeSalon || (window.state && state.roomCode); }
function exEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function exMelange(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function exArr(v) { return Array.isArray(v) ? v.filter(x => x != null) : Object.keys(v || {}).sort((a, b) => a - b).map(k => v[k]); }
function exHumains(data) { return Object.values((data && data.players) || {}).filter(p => p && p.name && !p.isBot); }
function exEcrire(upd) { const c = exSalon(); if (!c || !window.update) return Promise.resolve(); return window.update(window.ref(window.db, 'salons/' + c), upd).catch(e => console.error('Expédition :', e)); }
function exHTML(el, h) { if (el && el._h !== h) { el._h = h; el.innerHTML = h; } }
function exEcoule(g) { return (Date.now() - (g.t0 || 0)) / 1000; }
function exDedans(g) { return Object.keys(g.dedans || {}).filter(n => g.dedans[n]); }
function exAvatar(n) { const p = exHumains(window.currentRoom).find(x => x.name === n); return p && p.avatar && p.avatar.src ? p.avatar.src : null; }
function exCouleur(n) { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h},70%,60%)`; }
function exPastille(n, s) {
    s = s || 34; const src = exAvatar(n);
    return src ? `<img src="${exEsc(src)}" alt="" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;border:2px solid ${exCouleur(n)}">`
        : `<span style="width:${s}px;height:${s}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.round(s * .42)}px;color:#0b1020;background:${exCouleur(n)}">${exEsc(String(n).slice(0, 1).toUpperCase())}</span>`;
}

// ------------------------------- Sons -------------------------------
// ------------------------------- Médias : sons, ambiances, vidéos (expedition-visuel/) -------------------------------
const EX_MEDIA = './expedition-web/';
const EX_SONS_FICHIERS = { salle: ['lampe', 'pas'], gemmes: ['cristaux'], desastre: ['evacuation', 'alarme'], relique: ['relique'], choix: ['clic'],
    retour: ['retour', 'sas-fermeture'], continuer: ['pas'], tic: ['tic'], depart: ['amarrage', 'sas-ouverture'], fin: ['victoire'], danger: ['alarme'] };
const exAudios = {};
function exSonActif() { return typeof sysSon === 'undefined' || sysSon.on; }
// joue un fichier ; renvoie une promesse rejetée s'il n'existe pas ou si le navigateur refuse
function exFichier(nom, vol, delai) {
    if (!exSonActif()) return Promise.resolve();
    return new Promise((ok, ko) => setTimeout(() => {
        try {
            const a = new Audio(EX_MEDIA + 'sons/' + nom + '.mp3'); a.volume = vol == null ? .8 : vol;
            a.onerror = ko; const p = a.play(); if (p && p.catch) p.then(ok, ko); else ok();
        } catch (e) { ko(e); }
    }, delai || 0));
}
// ambiances en boucle : volume visé par piste, fondu dans la boucle d'affichage
function exAmbianceCible(cibles) {
    ['ambiance-epave', 'ambiance-vaisseau', 'tension', 'respiration'].forEach(n => {
        let a = exAudios[n];
        const v = exSonActif() ? (cibles[n] || 0) : 0;
        if (!a && v > 0) { try { a = exAudios[n] = new Audio(EX_MEDIA + 'sons/' + n + '.mp3'); a.loop = true; a.volume = 0; a.cible = 0; } catch (e) { return; } }
        if (!a) return;
        a.cible = v;
        if (v > 0 && a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
    });
}
function exAmbianceFondu() {
    Object.values(exAudios).forEach(a => {
        const d = (a.cible || 0) - a.volume; a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(d) * Math.min(Math.abs(d), .04)));
        if (a.volume <= .001 && !a.cible && !a.paused) a.pause();
    });
}
function exAmbianceStop() { Object.values(exAudios).forEach(a => { a.cible = 0; try { a.pause(); } catch (e) {} }); }

function exSon(nom) {
    if (!exSonActif()) return;
    const f = EX_SONS_FICHIERS[nom];
    if (f && !exC.sansFichiers) {
        exFichier(f[0], .85).then(() => { if (f[1]) exFichier(f[1], .7, nom === 'depart' ? 1400 : 350).catch(() => {}); })
            .catch(() => { exC.sansFichiers = true; exSonSynthese(nom); });
        return;
    }
    exSonSynthese(nom);
}
function exSonSynthese(nom) {
    if (typeof sysSon !== 'undefined' && !sysSon.on) return;
    if (typeof sysCtx !== 'function' || typeof sysNote !== 'function') { if (typeof window.sfx === 'function') window.sfx(nom === 'fin' ? 'victoire' : 'clic'); return; }
    try {
        const c = sysCtx(); if (!c) return;
        const bruit = (typeof sysBruit === 'function') ? sysBruit : () => {};
        if (nom === 'salle') { bruit(c, 0, .35, 400, .12, 2400); sysNote(c, 180, 0, .3, 'sawtooth', .05, 90); }
        else if (nom === 'gemmes') [1319, 1568, 1976, 2349].forEach((f, i) => sysNote(c, f, .05 + i * .06, .22, 'sine', .08));
        else if (nom === 'danger') { sysNote(c, 440, 0, .18, 'square', .07); sysNote(c, 330, .2, .3, 'square', .07); }
        else if (nom === 'desastre') { bruit(c, 0, 1.1, 3000, .35, 120); sysNote(c, 220, 0, .9, 'sawtooth', .1, 40); [880, 660, 880, 660].forEach((f, i) => sysNote(c, f, .5 + i * .22, .18, 'square', .06)); }
        else if (nom === 'relique') [523, 784, 1047, 1568].forEach((f, i) => sysNote(c, f, i * .09, .5, 'triangle', .09));
        else if (nom === 'choix') sysNote(c, 700, 0, .07, 'triangle', .12, 1100);
        else if (nom === 'retour') { sysNote(c, 300, 0, .45, 'sine', .1, 900); bruit(c, 0, .4, 1500, .1, 6000); }
        else if (nom === 'continuer') sysNote(c, 200, 0, .3, 'triangle', .1, 160);
        else if (nom === 'tic') sysNote(c, 1800, 0, .03, 'square', .05);
        else if (nom === 'depart') { bruit(c, 0, 1, 200, .2, 1800); [262, 330, 392, 523].forEach((f, i) => sysNote(c, f, .3 + i * .1, .4, 'triangle', .1)); }
        else if (nom === 'fin') [523, 659, 784, 1047, 1319].forEach((f, i) => sysNote(c, f, i * .1, .5, 'triangle', .13));
    } catch (e) {}
}

// ------------------------------- Lancement (hôte) -------------------------------
window.startExpeditionGame = function () {
    if (!window.isHost) return;
    const code = exSalon(); if (!code || !window.mettreAJourSalonFirebase) return;
    const players = (window.state && state.players) || {};
    const noms = Object.values(players).filter(p => p && p.name && !p.isBot).map(p => p.name);
    if (noms.length < 2) { if (typeof showToast === 'function') showToast('⚠️ Il faut au moins 2 joueurs pour l’Expédition sur l’épave !'); return; }
    const nb = [3, 5, 7].indexOf(parseInt(document.getElementById('setting-ex-nb')?.value, 10)) >= 0 ? parseInt(document.getElementById('setting-ex-nb').value, 10) : 5;
    const duree = Math.max(8, Math.min(30, parseInt(document.getElementById('input-host-timer')?.value, 10) || EX.CHOIX_DEF));
    const coffre = {}; noms.forEach(n => coffre[n] = 0);
    const g = { v: 1, status: 'PLAYING', startedAt: Date.now(), nb: nb, duree: duree, joueurs: noms, coffre: coffre, retires: [], reliquesTirees: 0, expe: 0, stats: {} };
    exPreparerExpedition(g);
    const updates = { status: 'IN_GAME', selectedMode: 'expedition', exGame: g };
    Object.values(players).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(code, updates);
};
// nouvelle expédition : paquet mélangé, tout le monde à bord, sacs vides
function exPreparerExpedition(g) {
    g.expe = (g.expe || 0) + 1;
    const retires = exArr(g.retires);
    const paquet = EX_TRESORS.map(v => ({ k: 't', v: v }));
    Object.keys(EX_DANGERS).forEach(h => { const n = 3 - retires.filter(r => r === h).length; for (let i = 0; i < n; i++) paquet.push({ k: 'h', h: h }); });
    // reliques : celles des expéditions précédentes non emportées restent dans l'épave
    const tirees = Math.min(EX_RELIQUES.length, (g.reliquesTirees || 0) + 1); g.reliquesTirees = tirees;
    const prises = exArr(g.reliquesPrises);
    for (let i = 0; i < tirees; i++) if (prises.indexOf(i) < 0 && exArr(g.reliquesPerdues).indexOf(i) < 0) paquet.push({ k: 'a', v: EX_RELIQUES[i], id: i });
    g.paquet = exMelange(paquet);
    g.chemin = []; g.sac = {}; g.dedans = {};
    exArr(g.joueurs).forEach(n => { g.dedans[n] = 1; g.sac[n] = 0; });
    g.vus = {}; g.choix = null; g.dec = null; g.desastre = null; g.gainExpe = {};
    g.epaveId = Math.floor(Math.random() * EX_NOMS_EPAVES.length); g.epave = EX_NOMS_EPAVES[g.epaveId];
    g.phase = 'DEPART'; g.t0 = Date.now();
}

// ------------------------------- Hôte : enchaînement -------------------------------
function exHote() {
    const data = window.currentRoom, g = data && data.exGame;
    if (!window.isHost || !g || g.status !== 'PLAYING' || data.status !== 'IN_GAME' || data.selectedMode !== 'expedition') return;
    const t = exEcoule(g), cle = g.expe + ':' + exArr(g.chemin).length + ':' + g.phase;
    if (exH.lock === cle) return;
    const presents = new Set(exHumains(data).map(p => p.name));
    if (g.phase === 'DEPART' && t >= EX.DEPART) { exH.lock = cle; exRevelerSalle(g); }
    else if (g.phase === 'SALLE' && t >= EX.SALLE) { exH.lock = cle; exEcrire({ 'exGame/phase': 'CHOIX', 'exGame/t0': Date.now(), 'exGame/choix': null }); }
    else if (g.phase === 'CHOIX') {
        const dedans = exDedans(g), ch = g.choix || {};
        const tous = dedans.every(n => ch[n] || !presents.has(n));
        if (tous && t >= 1.2 || t >= (g.duree || EX.CHOIX_DEF) + .8) { exH.lock = cle; exDecider(g); }
    }
    else if (g.phase === 'DECISION' && t >= EX.DECISION) { exH.lock = cle; if (exDedans(g).length && exArr(g.paquet).length) exRevelerSalle(g); else exFinExpedition(g); }
    else if (g.phase === 'DESASTRE' && t >= EX.DESASTRE) { exH.lock = cle; exFinExpedition(g); }
    else if (g.phase === 'BILAN' && t >= EX.BILAN) {
        exH.lock = cle;
        if (g.expe >= g.nb) { exTerminer(g); return; }
        const n = exCopie(g); exPreparerExpedition(n);
        exEcrire({ exGame: exNettoyer(n) });
    }
}
// copie de travail : Firebase supprime les objets vides, on remet les valeurs par défaut
function exCopie(g0) {
    const g = JSON.parse(JSON.stringify(g0));
    ['coffre', 'sac', 'dedans', 'vus', 'gainExpe', 'stats', 'reliques', 'choix'].forEach(k => { if (!g[k] || typeof g[k] !== 'object') g[k] = {}; });
    return g;
}
// Firebase n'accepte pas undefined
function exNettoyer(o) { return JSON.parse(JSON.stringify(o, (k, v) => v === undefined ? null : v)); }
function exRevelerSalle(g0) {
    const g = exCopie(g0);
    const paquet = exArr(g.paquet), chemin = exArr(g.chemin), dedans = exDedans(g);
    const carte = paquet.shift(); if (!carte) { exFinExpedition(g0); return; }
    const salle = Object.assign({}, carte, { n: chemin.length + 1 });
    let phase = 'SALLE';
    if (carte.k === 't') {
        const part = Math.floor(carte.v / dedans.length); salle.r = carte.v - part * dedans.length; salle.part = part;
        dedans.forEach(n => { g.sac[n] = (g.sac[n] || 0) + part; });
    } else if (carte.k === 'h') {
        g.vus = g.vus || {}; g.vus[carte.h] = (g.vus[carte.h] || 0) + 1;
        if (g.vus[carte.h] >= 2) {      // évacuation : les sacs de ceux qui sont à bord sont perdus
            phase = 'DESASTRE';
            const pertes = {}; dedans.forEach(n => { pertes[n] = g.sac[n] || 0; g.sac[n] = 0; g.dedans[n] = 0; });
            g.desastre = { h: carte.h, pertes: pertes };
            g.retires = exArr(g.retires).concat([carte.h]);
            g.stats.desastres = (g.stats.desastres || 0) + 1;
        }
    } else if (carte.k === 'a') salle.pris = 0;
    chemin.push(salle);
    g.paquet = paquet; g.chemin = chemin; g.phase = phase; g.t0 = Date.now(); g.choix = null;
    exEcrire({ exGame: exNettoyer(g) });
}
function exDecider(g0) {
    const g = exCopie(g0), data = window.currentRoom;
    const presents = new Set(exHumains(data).map(p => p.name));
    const dedans = exDedans(g), ch = g.choix || {};
    // un joueur absent ou qui n'a pas répondu rentre au vaisseau (choix prudent)
    const rentrent = dedans.filter(n => ch[n] !== 'c' || !presents.has(n));
    const chemin = exArr(g.chemin), gains = {}, rel = {};
    rentrent.forEach(n => gains[n] = 0);
    if (rentrent.length) {
        chemin.forEach(s => {
            if (s.k === 't' && s.r > 0) { const p = Math.floor(s.r / rentrent.length); if (p) { rentrent.forEach(n => gains[n] += p); s.r -= p * rentrent.length; } }
            if (s.k === 'a' && !s.pris && rentrent.length === 1) {
                s.pris = 1; const n = rentrent[0]; gains[n] += s.v; rel[n] = (rel[n] || 0) + 1;
                g.reliquesPrises = exArr(g.reliquesPrises).concat([s.id]);
                g.reliques = g.reliques || {}; g.reliques[n] = (g.reliques[n] || 0) + 1;
            }
        });
        rentrent.forEach(n => {
            const total = (g.sac[n] || 0) + gains[n];
            g.coffre[n] = (g.coffre[n] || 0) + total;
            g.gainExpe[n] = (g.gainExpe[n] || 0) + total;
            if (total > ((g.stats.record || {}).v || 0)) g.stats.record = { n: n, v: total, e: g.expe };
            g.sac[n] = 0; g.dedans[n] = 0;
        });
    }
    g.chemin = chemin;
    g.dec = { r: rentrent, c: dedans.filter(n => rentrent.indexOf(n) < 0), gains: gains, rel: rel };
    g.phase = 'DECISION'; g.t0 = Date.now();
    exEcrire({ exGame: exNettoyer(g) });
}
function exFinExpedition(g0) {
    const g = exCopie(g0);
    // toutes les cartes sont révélées : ceux qui sont encore à bord rentrent avec leur sac
    exDedans(g).forEach(n => { g.coffre[n] = (g.coffre[n] || 0) + (g.sac[n] || 0); g.gainExpe[n] = (g.gainExpe[n] || 0) + (g.sac[n] || 0); g.sac[n] = 0; g.dedans[n] = 0; });
    // reliques restées dans l'épave : perdues pour de bon
    exArr(g.chemin).forEach(s => { if (s.k === 'a' && !s.pris) g.reliquesPerdues = exArr(g.reliquesPerdues).concat([s.id]); });
    g.historique = exArr(g.historique).concat([{ e: g.expe, ep: g.epave, s: exArr(g.chemin).length, d: g.desastre ? g.desastre.h : '', gains: g.gainExpe || {} }]);
    g.phase = 'BILAN'; g.t0 = Date.now();
    exEcrire({ exGame: exNettoyer(g) });
}
function exTerminer(g) {
    const upd = { 'exGame/status': 'FINISHED', 'exGame/phase': 'FIN' };
    Object.keys(g.coffre || {}).forEach(n => { upd[`players/${n}/score`] = g.coffre[n] || 0; });
    exEcrire(upd);
}

// ------------------------------- Choix d'un joueur -------------------------------
window.exChoisir = function (v) {
    const g = window.currentRoom && window.currentRoom.exGame, me = exMe();
    if (!g || g.phase !== 'CHOIX' || !(g.dedans || {})[me]) return;
    exSon('choix'); exEcrire({ [`exGame/choix/${me}`]: v });
};

// ------------------------------- Affichage -------------------------------
function exStyle() {
    if (document.getElementById('ex-style')) return;
    const st = document.createElement('style'); st.id = 'ex-style';
    st.textContent = `
    #ex-root{display:flex;flex-direction:column;gap:10px;color:#e2e8f0;width:100%;max-width:1200px;margin:0 auto;position:relative}
    .ex-barre{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 12px;border-radius:14px;background:linear-gradient(90deg,rgba(8,47,73,.7),rgba(30,27,75,.6));border:1px solid rgba(34,211,238,.3)}
    .ex-titre{font:900 11px ui-monospace,monospace;letter-spacing:.22em;color:#67e8f9}
    .ex-sous{font-size:12px;color:#94a3b8}
    .ex-progres{height:5px;border-radius:9px;background:#1e293b;overflow:hidden}.ex-progres i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa);transition:width .25s linear}
    .ex-dangers{display:flex;gap:6px;flex-wrap:wrap}
    .ex-dg{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:12px;border:1px solid #334155;background:#0f172a;color:#64748b;transition:all .3s}
    .ex-dg.vu{color:#fff;border-color:var(--c);background:color-mix(in srgb,var(--c) 22%,#0f172a);box-shadow:0 0 12px color-mix(in srgb,var(--c) 55%,transparent);animation:exPulse 1.4s ease-in-out infinite}
    .ex-dg.out{opacity:.35;text-decoration:line-through}
    @keyframes exPulse{50%{box-shadow:0 0 22px color-mix(in srgb,var(--c) 80%,transparent)}}
    .ex-scene{position:relative;border-radius:16px;overflow:hidden;border:1px solid rgba(148,163,184,.25);background:radial-gradient(ellipse at 20% 50%,#13213b 0%,#070b16 70%);min-height:230px}
    .ex-etoiles{position:absolute;inset:0;background-image:radial-gradient(1px 1px at 20% 30%,#fff8,transparent),radial-gradient(1px 1px at 70% 20%,#fff6,transparent),radial-gradient(1.5px 1.5px at 40% 80%,#fff7,transparent),radial-gradient(1px 1px at 85% 65%,#fff5,transparent),radial-gradient(1px 1px at 10% 85%,#fff6,transparent);background-size:300px 200px;animation:exDefile 60s linear infinite;opacity:.6}
    @keyframes exDefile{to{background-position:-300px 0}}
    .ex-vue{position:relative;height:clamp(260px,48vh,500px);border-radius:16px;overflow:hidden;background:#000;border:1px solid rgba(148,163,184,.25)}
    .ex-vue video{position:absolute;display:block}
    #ex-vid-flou{inset:-30px;width:calc(100% + 60px);height:calc(100% + 60px);object-fit:cover;filter:blur(22px) brightness(.45) saturate(1.2)}
    #ex-vid{inset:0;width:100%;height:100%;object-fit:contain}
    .ex-vue.large #ex-vid{object-fit:cover}
    .ex-vue.large #ex-vid-flou{display:none}
    .ex-vue-bas{position:absolute;left:0;right:0;bottom:0;height:45%;background:linear-gradient(0deg,rgba(2,6,23,.85),transparent);pointer-events:none}
    #ex-legende{position:absolute;left:14px;bottom:12px;right:180px;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none}
    #ex-legende .t{font:900 11px ui-monospace,monospace;letter-spacing:.22em;color:#67e8f9}
    #ex-legende .g{font:900 clamp(18px,3vw,30px) system-ui,sans-serif;letter-spacing:.02em;animation:exArrive .6s ease both}
    #ex-legende .p{font-size:13px;color:#e2e8f0;opacity:.9}
    #ex-obj3d{position:absolute;right:6px;bottom:4px;width:min(30%,190px);height:min(60%,190px);pointer-events:none}
    .ex-vue.flash::after{content:'';position:absolute;inset:0;background:var(--c,#fff);mix-blend-mode:screen;animation:exFlash .7s ease-out both;pointer-events:none}
    @keyframes exFlash{from{opacity:.75}to{opacity:0}}
    .ex-scene-couloir{min-height:0}
    .ex-scene-couloir .ex-couloir{padding:10px 12px}
    .ex-salle.photo{background-size:cover;background-position:center;text-shadow:0 1px 6px #000}
    .ex-salle.photo::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(2,6,23,.15),rgba(2,6,23,.75));z-index:0}
    .ex-salle.photo>*{position:relative;z-index:1}
    .ex-stage{position:relative;height:clamp(170px,26vh,240px);border-radius:16px;overflow:hidden;border:1px solid rgba(148,163,184,.2);background:#060a14}
    .ex-stage:empty{display:none}
    .ex-moi{display:flex;align-items:stretch;gap:8px}
    #ex-mon-objet{position:relative;width:76px;min-height:64px;flex:0 0 auto;border-radius:12px;background:radial-gradient(circle,rgba(34,211,238,.18),transparent 70%)}
    #ex-mon-objet:empty{display:none}
    @media (max-width:700px){.ex-vue{height:min(118vw,420px)}#ex-legende{right:118px}#ex-obj3d{width:120px;height:160px;right:0}}
    .ex-couloir{position:relative;display:flex;gap:10px;align-items:stretch;padding:16px 16px 14px;overflow-x:auto;scroll-behavior:smooth}
    .ex-vaisseau{flex:0 0 auto;width:120px;border-radius:14px;border:1px dashed rgba(34,211,238,.45);background:rgba(8,47,73,.45);padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px}
    .ex-salle{flex:0 0 auto;width:104px;min-height:150px;border-radius:14px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:4px;position:relative;
        background:linear-gradient(180deg,#1e293b,#0f172a);border:1px solid #334155;transform-origin:50% 50%}
    .ex-salle.neuve{animation:exRevele .9s cubic-bezier(.2,1.3,.4,1) both}
    @keyframes exRevele{0%{opacity:0;transform:perspective(600px) rotateY(90deg) translateX(-30px)}60%{opacity:1;transform:perspective(600px) rotateY(-10deg)}100%{transform:none}}
    .ex-salle .num{font:800 9px ui-monospace,monospace;letter-spacing:.16em;color:#64748b}
    .ex-salle .ic{font-size:38px;line-height:1;filter:drop-shadow(0 0 10px rgba(255,255,255,.18))}
    .ex-salle .val{font:900 22px ui-monospace,monospace}
    .ex-salle .nom{font-size:10px;text-align:center;line-height:1.2}
    .ex-salle.t{border-color:rgba(34,211,238,.45)}.ex-salle.t .val{color:#67e8f9}
    .ex-salle.h{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 30%,#1e1b2e),#140c14);border-color:var(--c)}
    .ex-salle.a{background:linear-gradient(180deg,#3b2a0a,#1a1205);border-color:#f59e0b}.ex-salle.a .val{color:#fbbf24}
    .ex-salle.a.pris{opacity:.45}
    .ex-sol{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;min-height:12px;max-width:90px}
    .ex-sol i{width:8px;height:8px;transform:rotate(45deg);background:#22d3ee;box-shadow:0 0 6px #22d3ee}
    .ex-equipage{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media (max-width:700px){.ex-equipage{grid-template-columns:1fr}.ex-salle{width:86px;min-height:128px}.ex-salle .ic{font-size:30px}.ex-vaisseau{width:96px}}
    .ex-panneau{border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.75);padding:10px}
    .ex-ptitre{font:800 10px ui-monospace,monospace;letter-spacing:.2em;color:#94a3b8;margin-bottom:6px;display:flex;justify-content:space-between;gap:6px}
    .ex-joueurs{display:flex;flex-wrap:wrap;gap:8px}
    .ex-j{display:flex;flex-direction:column;align-items:center;gap:3px;width:70px;position:relative;transition:transform .4s}
    .ex-j b{font-size:11px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ex-j .sac{font:800 11px ui-monospace,monospace;color:#67e8f9}
    .ex-j .etat{position:absolute;top:-6px;right:6px;font-size:16px}
    .ex-j.arrive{animation:exArrive .8s ease both}
    @keyframes exArrive{from{transform:translateY(-16px) scale(.6);opacity:0}}
    .ex-j.carte{animation:exCarte .7s ease both}
    @keyframes exCarte{0%{transform:rotateY(90deg)}100%{transform:none}}
    .ex-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .ex-btn{padding:16px 10px;border-radius:14px;font:900 16px system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;border:2px solid;transition:transform .12s, box-shadow .2s;color:#fff;display:flex;flex-direction:column;align-items:center;gap:3px}
    .ex-btn small{font:600 11px system-ui,sans-serif;opacity:.8;letter-spacing:0}
    .ex-btn:hover{transform:translateY(-2px)}.ex-btn:active{transform:scale(.97)}
    .ex-btn.go{background:linear-gradient(180deg,#15803d,#14532d);border-color:#4ade80}
    .ex-btn.back{background:linear-gradient(180deg,#b45309,#7c2d12);border-color:#fb923c}
    .ex-btn.sel{box-shadow:0 0 0 3px #fff,0 0 26px rgba(255,255,255,.4)}
    .ex-btn.off{opacity:.35}
    .ex-info{text-align:center;padding:12px;border-radius:14px;background:rgba(15,23,42,.8);border:1px solid #334155;font-size:14px}
    .ex-voile{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;text-align:center;padding:16px;pointer-events:none}
    .ex-voile.desastre{background:radial-gradient(circle,color-mix(in srgb,var(--c) 45%,transparent),rgba(10,0,0,.85));animation:exAlerte .5s ease both}
    .ex-voile .gros{font-size:70px;animation:exBoum .8s cubic-bezier(.2,1.6,.4,1) both}
    .ex-voile .msg{font:900 22px system-ui,sans-serif;letter-spacing:.06em;text-shadow:0 0 18px rgba(0,0,0,.8)}
    @keyframes exAlerte{0%{opacity:0}20%{opacity:1}30%{opacity:.6}40%{opacity:1}}
    @keyframes exBoum{0%{transform:scale(3);opacity:0}100%{transform:none;opacity:1}}
    .ex-secoue{animation:exSecoue .55s linear}
    @keyframes exSecoue{10%,50%,90%{transform:translate(-6px,2px)}30%,70%{transform:translate(6px,-2px)}100%{transform:none}}
    .ex-gemme{position:fixed;z-index:50;pointer-events:none;width:12px;height:12px;transform:rotate(45deg);background:#67e8f9;box-shadow:0 0 10px #22d3ee;transition:all .9s cubic-bezier(.3,.1,.3,1)}
    .ex-bilan{display:grid;gap:5px}
    .ex-bilan div{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#0f172a;border:1px solid #1e293b;font-size:13px;animation:exArrive .5s ease both}
    .ex-coffre{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:linear-gradient(90deg,rgba(120,53,15,.5),rgba(15,23,42,.6));border:1px solid rgba(245,158,11,.5);font-size:13px}
    `;
    document.head.appendChild(st);
}

window.renderExpeditionScreen = function (data) {
    exC.data = data;
    const g = data && data.exGame; if (!g) return;
    exStyle();
    if (g.status === 'FINISHED') { exFin(data, g); return; }
    if (exC.sess !== g.startedAt || !document.getElementById('ex-root')) exConstruire(g);
    exMaj(data, g);
    if (!exC.ticker) exC.ticker = setInterval(exBoucle, 250);
};

function exConstruire(g) {
    exC.sess = g.startedAt; exC.fini = ''; exC.cleSalle = ''; exC.clePhase = ''; exC.vuDesastre = ''; exC.nbSalles = 0;
    if (typeof showScreen === 'function') showScreen('screen-generic-game');
    const t = document.getElementById('generic-game-title'); if (t) t.innerText = '🛰️ Expédition sur l’épave';
    const zone = document.getElementById('generic-game-content'); if (!zone) return;
    zone.innerHTML = `
    <div id="ex-root">
        <div class="ex-barre">
            <div><div class="ex-titre" id="ex-titre"></div><div class="ex-sous" id="ex-sous"></div></div>
            <div class="ex-dangers" id="ex-dangers"></div>
        </div>
        <div class="ex-progres"><i id="ex-temps" style="width:0%"></i></div>
        <div class="ex-vue" id="ex-scene">
            <video id="ex-vid-flou" muted playsinline preload="auto"></video>
            <video id="ex-vid" muted playsinline preload="auto"></video>
            <div class="ex-vue-bas"></div>
            <div id="ex-legende"></div>
            <div id="ex-obj3d"></div>
            <div id="ex-voile"></div>
        </div>
        <div class="ex-scene ex-scene-couloir"><div class="ex-etoiles"></div><div class="ex-couloir" id="ex-couloir"></div></div>
        <div id="ex-zone-action"></div>
        <div class="ex-stage" id="ex-stage"></div>
        <div class="ex-equipage">
            <div class="ex-panneau"><div class="ex-ptitre"><span>🛰️ DANS L’ÉPAVE</span><span id="ex-nb-dedans"></span></div><div class="ex-joueurs" id="ex-dedans"></div></div>
            <div class="ex-panneau"><div class="ex-ptitre"><span>🚀 À L’ABRI DANS LE VAISSEAU</span><span id="ex-nb-dehors"></span></div><div class="ex-joueurs" id="ex-dehors"></div></div>
        </div>
        <div class="ex-moi"><div id="ex-mon-objet"></div><div id="ex-mon-coffre" style="flex:1"></div></div>
    </div>`;
    exMedias3D();
}
// ---- 3D : scène de l'équipage + vitrines (chargées à la demande, facultatives)
function exDetruire3D() {
    ['stage', 'vitrine', 'moi'].forEach(k => { if (exC[k]) { try { exC[k].detruire(); } catch (e) {} exC[k] = null; } });
    exC.vitrineNom = ''; exC.moiNom = '';
}
function exMedias3D() {
    exDetruire3D();
    if (!window.EX3D) return;
    window.EX3D.charger().then(ok => {
        if (!ok || !document.getElementById('ex-root')) return;
        const st = document.getElementById('ex-stage'); if (st && !exC.stage) exC.stage = window.EX3D.scene(st);
        const d = window.currentRoom; if (d && d.exGame) exMaj(d, d.exGame, true);
    });
}

// fichier vidéo de la salle (le même pour tous : tiré de la graine de la partie)
function exHash(t) { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
function exClipSalle(g, s, catastrophe) {
    if (!s) return '';
    if (s.k === 't') return 'salles/cristaux-' + String(exHash(g.startedAt + ':' + g.expe + ':' + s.n) % 12 + 1).padStart(2, '0');
    if (s.k === 'h') return 'salles/danger-' + s.h + '-' + (catastrophe ? 'b' : 'a');
    return 'salles/relique-' + ((s.id || 0) % 4 + 1);
}
const EX_MODELE_RELIQUE = ['relique-statuette', 'relique-orbe', 'relique-masque', 'relique-monolithe'];
function exModeleSalle(s) {
    if (!s) return '';
    if (s.k === 't') return s.v >= 13 ? 'cristaux-geode' : s.v >= 6 ? 'cristal-grappe' : 'cristal';
    if (s.k === 'a') return EX_MODELE_RELIQUE[(s.id || 0) % 4];
    return '';
}
function exPhoto(g, s) { const c = exClipSalle(g, s, false); return c ? ` photo" style="background-image:url('${EX_MEDIA}${c}.jpg')${s.k === 'h' ? ';--c:' + (EX_DANGERS[s.h] || {}).c : ''}` : ''; }
function exSalleHTML(s, neuve, g) {
    if (s.k === 't') return `<div class="ex-salle t${neuve ? ' neuve' : ''}${g ? exPhoto(g, s) : ''}"><span class="num">SALLE ${s.n}</span><span class="ic">💎</span><span class="val">${s.v}</span>
        <span class="nom">${s.part ? s.part + ' chacun' : 'personne'}</span><div class="ex-sol" title="Cristaux restés au sol">${'<i></i>'.repeat(Math.min(s.r || 0, 16))}</div></div>`;
    if (s.k === 'h') { const D = EX_DANGERS[s.h] || {}; return `<div class="ex-salle h${neuve ? ' neuve' : ''}${g ? exPhoto(g, s) : '" style="--c:' + D.c}"><span class="num">SALLE ${s.n}</span><span class="ic">${D.i}</span><span class="nom" style="color:${D.c};font-weight:800">${exEsc(D.n)}</span><span class="nom" style="color:#94a3b8">danger</span></div>`; }
    return `<div class="ex-salle a${s.pris ? ' pris' : ''}${neuve ? ' neuve' : ''}${g ? exPhoto(g, s) : ''}"><span class="num">SALLE ${s.n}</span><span class="ic">🗿</span><span class="val">${s.v}</span><span class="nom" style="color:#fde68a">${s.pris ? 'emportée' : 'relique alien'}</span></div>`;
}

function exMaj(data, g, force) {
    const me = exMe(), chemin = exArr(g.chemin), dedans = exDedans(g), joueurs = exArr(g.joueurs);
    const salleN = chemin.length, clePhase = g.expe + ':' + salleN + ':' + g.phase;
    // ---- barre du haut
    const titre = document.getElementById('ex-titre'); if (titre) titre.textContent = `EXPÉDITION ${g.expe}/${g.nb} · ${String(g.epave || '').toUpperCase()}`;
    const sous = document.getElementById('ex-sous');
    if (sous) sous.textContent = g.phase === 'DEPART' ? 'L’équipage s’amarre à l’épave…' : g.phase === 'CHOIX' ? `Salle ${salleN} : continuer ou rentrer ?` : g.phase === 'BILAN' ? 'Retour au vaisseau : bilan de l’expédition' : `Salle ${salleN} explorée`;
    const dg = document.getElementById('ex-dangers');
    if (dg) { const retires = exArr(g.retires), vus = g.vus || {};
        exHTML(dg, Object.keys(EX_DANGERS).map(h => { const D = EX_DANGERS[h], n = 3 - retires.filter(r => r === h).length;
            return `<span class="ex-dg${vus[h] ? ' vu' : ''}${n <= 0 ? ' out' : ''}" style="--c:${D.c}" title="${exEsc(D.n)} : ${n} carte(s) dans l’épave${vus[h] ? ' — déjà vu, le prochain déclenche l’évacuation !' : ''}">${D.i}${vus[h] ? ' ⚠' : ''}</span>`; }).join('')); }
    // ---- couloir des salles
    const couloir = document.getElementById('ex-couloir');
    if (couloir) {
        const cle = g.expe + ':' + chemin.map(s => s.k + (s.r || 0) + (s.pris ? 'p' : '')).join(',');
        if (exC.cleSalle !== cle) {
            const nouvelle = exC.nbSalles !== salleN && salleN > (exC.nbSalles || 0) && exC.cleSalle.split(':')[0] === String(g.expe);
            couloir.innerHTML = `<div class="ex-vaisseau"><span style="font-size:34px">🚀</span><span style="font:800 9px ui-monospace,monospace;letter-spacing:.14em;color:#67e8f9">SAS</span>
                <span style="font-size:10px;color:#94a3b8;text-align:center">${exArr(g.paquet).length} salle${exArr(g.paquet).length > 1 ? 's' : ''} inexplorée${exArr(g.paquet).length > 1 ? 's' : ''}</span></div>`
                + chemin.map((s, i) => exSalleHTML(s, nouvelle && i === salleN - 1, g)).join('')
                + (g.phase !== 'BILAN' && dedans.length ? `<div class="ex-salle" style="opacity:.5;border-style:dashed;justify-content:center"><span class="ic">❔</span><span class="nom" style="color:#64748b">salle suivante</span></div>` : '');
            couloir.scrollLeft = couloir.scrollWidth;
            if (nouvelle) { const s = chemin[salleN - 1];
                if (s.k === 't') { exSon('salle'); setTimeout(() => { exSon('gemmes'); if (s.part && g.dedans && g.dedans[me]) { exGemmesVersMoi(s.part); exFichier('ramasse', .6, 700).then(() => exFichier('sac', .7, 250)).catch(() => {}); } }, 1500); }
                else if (s.k === 'h') { exSon('salle'); exFichier('danger-' + s.h, .9, 900).catch(() => setTimeout(() => exSonSynthese('danger'), 400)); }
                else { exSon('salle'); setTimeout(() => exSon('relique'), 400); } }
            exC.cleSalle = cle; exC.nbSalles = salleN;
        }
    }
    // ---- voile (départ, désastre)
    const voile = document.getElementById('ex-voile');
    if (voile && exC.clePhase !== clePhase) {
        if (g.phase === 'DEPART') { voile.className = ''; voile.innerHTML = ''; exSon('depart'); }
        else if (g.phase === 'DESASTRE' && g.desastre) {
            const D = EX_DANGERS[g.desastre.h] || {}, p = g.desastre.pertes || {};
            const perdus = Object.keys(p).map(n => `${exEsc(n)} perd ${p[n]} 💎`).join(' · ');
            voile.className = 'ex-voile desastre'; voile.style.setProperty('--c', D.c);
            voile.innerHTML = `<div class="gros">${D.i}</div><div class="msg" style="color:#fff">${exEsc(D.n).toUpperCase()} !</div><div style="color:#fecaca;font-weight:700">Évacuation d’urgence : les sacs restés à bord sont perdus.</div><div style="color:#fff;font-size:13px">${perdus || 'Personne n’était à bord.'}</div>`;
            const sc = document.getElementById('ex-scene'); if (sc) { sc.classList.remove('ex-secoue'); void sc.offsetWidth; sc.classList.add('ex-secoue'); }
            exSon('desastre');
        } else { voile.className = ''; voile.innerHTML = ''; }
    }
    // ---- équipage
    const ch = g.choix || {}, dec = g.dec || {}, decR = exArr(dec.r), decC = exArr(dec.c);
    const dehors = joueurs.filter(n => dedans.indexOf(n) < 0);
    const jHTML = (n, ou) => {
        let etat = '';
        if (g.phase === 'CHOIX' && ou === 'dedans') etat = ch[n] ? '✅' : '⏳';
        if (g.phase === 'DECISION') etat = decR.indexOf(n) >= 0 ? '🏃' : decC.indexOf(n) >= 0 ? '🚀' : '';
        const anim = g.phase === 'DECISION' ? (decR.indexOf(n) >= 0 && ou === 'dehors' ? ' arrive' : decC.indexOf(n) >= 0 ? ' carte' : '') : '';
        const gain = g.phase === 'DECISION' && dec.gains && dec.gains[n] != null ? `<span class="sac" style="color:#fbbf24">+${dec.gains[n]} récupérés</span>` : '';
        const sac = ou === 'dedans' ? `<span class="sac">🎒 ${(g.sac || {})[n] || 0}</span>` : (n === me ? `<span class="sac" style="color:#fbbf24">🔒 ${(g.coffre || {})[n] || 0}</span>` : `<span class="sac" style="color:#64748b">🔒 ?</span>`);
        return `<div class="ex-j${anim}" style="${n === me ? 'filter:drop-shadow(0 0 6px #22d3ee)' : ''}">${exPastille(n, 38)}<span class="etat">${etat}</span><b>${exEsc(n)}</b>${sac}${gain}</div>`;
    };
    const zd = document.getElementById('ex-dedans'); exHTML(zd, dedans.map(n => jHTML(n, 'dedans')).join('') || '<span class="ex-sous">Plus personne à bord.</span>');
    const zh = document.getElementById('ex-dehors'); exHTML(zh, dehors.map(n => jHTML(n, 'dehors')).join('') || '<span class="ex-sous">Tout le monde explore encore.</span>');
    const nd = document.getElementById('ex-nb-dedans'); if (nd) nd.textContent = dedans.length;
    const nh = document.getElementById('ex-nb-dehors'); if (nh) nh.textContent = dehors.length;
    // ---- zone d'action
    const za = document.getElementById('ex-zone-action');
    if (za) {
        const moiDedans = dedans.indexOf(me) >= 0, joueur = joueurs.indexOf(me) >= 0;
        if (g.phase === 'CHOIX' && moiDedans) {
            const mon = ch[me], restes = chemin.reduce((s, x) => s + (x.k === 't' ? x.r || 0 : 0), 0), rel = chemin.filter(x => x.k === 'a' && !x.pris).length;
            exHTML(za, `<div class="ex-actions">
                <button class="ex-btn go${mon === 'c' ? ' sel' : mon ? ' off' : ''}" onclick="exChoisir('c')">🚀 CONTINUER<small>Sac en jeu : ${(g.sac || {})[me] || 0} 💎</small></button>
                <button class="ex-btn back${mon === 'r' ? ' sel' : mon ? ' off' : ''}" onclick="exChoisir('r')">🏃 RENTRER<small>Au sol : ${restes} 💎${rel ? ` + ${rel} 🗿 (si vous rentrez seul)` : ''}</small></button></div>`);
        } else if (g.phase === 'CHOIX') {
            exHTML(za, `<div class="ex-info">${joueur ? '🚀 Vous êtes à l’abri. ' : '👀 '}Les explorateurs choisissent en secret… <b>${Object.keys(ch).filter(n => dedans.indexOf(n) >= 0).length}/${dedans.length}</b> ont décidé.</div>`);
        } else if (g.phase === 'DECISION') {
            const txtR = decR.length ? `🏃 ${decR.map(exEsc).join(', ')} ${decR.length > 1 ? 'rentrent' : 'rentre'} au vaisseau` : 'Personne ne rentre';
            const relTxt = Object.keys(dec.rel || {}).map(n => ` · 🗿 ${exEsc(n)} emporte la relique`).join('');
            exHTML(za, `<div class="ex-info">${txtR}${relTxt}. ${decC.length ? `🚀 ${decC.length} ${decC.length > 1 ? 'continuent' : 'continue'} l’exploration.` : 'L’épave est désertée.'}</div>`);
            if (exC.clePhase !== clePhase) { exSon(decR.indexOf(me) >= 0 ? 'retour' : 'continuer'); if (Object.keys(dec.rel || {}).length) setTimeout(() => exSon('relique'), 300); }
        } else if (g.phase === 'BILAN') {
            const gains = g.gainExpe || {};
            exHTML(za, `<div class="ex-panneau"><div class="ex-ptitre"><span>📦 BILAN DE L’EXPÉDITION ${g.expe}</span><span>${g.expe < g.nb ? 'expédition suivante dans un instant' : 'fin de la mission'}</span></div>
                <div class="ex-bilan">${joueurs.slice().sort((a, b) => (gains[b] || 0) - (gains[a] || 0)).map((n, i) => `<div style="animation-delay:${i * .08}s"><span style="display:flex;align-items:center;gap:8px">${exPastille(n, 26)}${exEsc(n)}</span><b style="color:${gains[n] ? '#67e8f9' : '#f87171'}">${gains[n] ? '+' + gains[n] + ' 💎 mis à l’abri' : 'rien rapporté'}</b></div>`).join('')}</div></div>`);
        } else if (g.phase === 'DESASTRE') exHTML(za, '');
        else exHTML(za, g.phase === 'SALLE' && moiDedans ? `<div class="ex-info">🔦 Vous explorez la salle ${salleN}…</div>` : '');
    }
    // ---- mon coffre
    const mc = document.getElementById('ex-mon-coffre');
    exHTML(mc, joueurs.indexOf(me) >= 0 ? `<div class="ex-coffre">🔒 <b>Mon coffre (secret) : ${(g.coffre || {})[me] || 0} 💎</b><span style="color:#94a3b8;margin-left:auto">${(g.reliques || {})[me] ? '🗿 × ' + g.reliques[me] + ' · ' : ''}les coffres des autres seront révélés à la fin</span></div>` : '');
    exMediasMaj(g, clePhase, exC.clePhase !== clePhase || force);
    exC.clePhase = clePhase;
}
// ---- vidéo de la vue principale (même source = pas de redémarrage)
function exVue(clip, large) {
    const v = document.getElementById('ex-vid'), f = document.getElementById('ex-vid-flou'), sc = document.getElementById('ex-scene');
    if (!v || !clip || exC.vue === clip) return; exC.vue = clip;
    if (sc) sc.classList.toggle('large', !!large);
    const src = EX_MEDIA + clip + '.mp4', poster = EX_MEDIA + clip + '.jpg';
    [v, f].forEach(el => { el.poster = poster; el.src = src; el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(() => {}); });
}
function exVueSelonTemps(g) {
    const chemin = exArr(g.chemin), t = exEcoule(g), der = chemin[chemin.length - 1];
    if (g.phase === 'DEPART') exVue(t < 3.3 ? 'epaves/' + EX_FICHIERS_EPAVES[(g.epaveId || 0) % EX_FICHIERS_EPAVES.length] : 'bonus/amarrage', true);
    else if (g.phase === 'DESASTRE') exVue(t < 3.4 ? exClipSalle(g, der, true) : 'bonus/evacuation', t >= 3.4);
    else if (g.phase === 'BILAN') exVue('bonus/retour', true);
    else if (der) exVue(exClipSalle(g, der, false), false);
}
// ---- légende, vitrine 3D, scène de l'équipage, objet personnel, ambiance
function exMediasMaj(g, clePhase, nouvellePhase) {
    const chemin = exArr(g.chemin), der = chemin[chemin.length - 1], me = exMe(), dedans = exDedans(g), joueurs = exArr(g.joueurs);
    exVueSelonTemps(g);
    // légende de la salle
    const lg = document.getElementById('ex-legende');
    if (lg) {
        let h = '';
        if (der && ['SALLE', 'CHOIX', 'DECISION'].indexOf(g.phase) >= 0) {
            if (der.k === 't') h = `<div class="t">SALLE ${der.n}</div><div class="g">💎 ${der.v} cristaux</div><div class="p">${der.part ? der.part + ' pour chaque explorateur' : 'personne pour les ramasser'}${der.r ? ' · ' + der.r + ' restent au sol' : ''}</div>`;
            else if (der.k === 'h') { const D = EX_DANGERS[der.h] || {}; h = `<div class="t">SALLE ${der.n} · DANGER</div><div class="g" style="color:${D.c}">${D.i} ${exEsc(D.n)}</div><div class="p">${exEsc(D.d)} Encore un et c’est l’évacuation !</div>`; }
            else h = `<div class="t">SALLE ${der.n}</div><div class="g" style="color:#fbbf24">🗿 Relique alien · ${der.v} pts</div><div class="p">Seul un explorateur qui rentre seul pourra l’emporter.</div>`;
        } else if (g.phase === 'DEPART') h = `<div class="t">EXPÉDITION ${g.expe}/${g.nb}</div><div class="g">${exEsc(g.epave)}</div><div class="p">Approche et amarrage…</div>`;
        exHTML(lg, h);
    }
    if (nouvellePhase && g.phase === 'DESASTRE' && g.desastre) {
        const sc = document.getElementById('ex-scene'); if (sc) { sc.style.setProperty('--c', (EX_DANGERS[g.desastre.h] || {}).c || '#f00'); sc.classList.remove('flash'); void sc.offsetWidth; sc.classList.add('flash'); }
        exFichier('danger-' + g.desastre.h, .9).catch(() => {});
    }
    if (!window.EX3D || !window.EX3D.pret) { exAmbianceMaj(g); return; }
    // vitrine : le cristal ou la relique de la salle
    const o3 = document.getElementById('ex-obj3d'), mod = ['SALLE', 'CHOIX', 'DECISION'].indexOf(g.phase) >= 0 ? exModeleSalle(der) : '';
    if (o3) {
        if (!mod && exC.vitrine) { exC.vitrine.detruire(); exC.vitrine = null; exC.vitrineNom = ''; }
        else if (mod && exC.vitrineNom !== mod) {
            exC.vitrineNom = mod;
            if (!exC.vitrine) exC.vitrine = window.EX3D.objet(o3, mod, { hauteur: mod.indexOf('relique') === 0 ? 1.1 : .95 });
            else exC.vitrine.changer(mod);
            if (exC.vitrine) exC.vitrine.lueur(der.k === 'a' ? 0xfbbf24 : mod === 'cristaux-geode' ? 0xa855f7 : 0x67e8f9);
        }
    }
    // scène de l'équipage
    if (exC.stage) {
        const dec = g.dec || {}, gains = g.gainExpe || {};
        exC.stage.maj({ cle: clePhase, phase: g.phase, dedans: dedans.map(n => ({ n: n, c: exCouleur(n) })), dehors: joueurs.filter(n => dedans.indexOf(n) < 0).map(n => ({ n: n, c: exCouleur(n) })),
            rentrent: exArr(dec.r), victimes: g.desastre ? Object.keys(g.desastre.pertes || {}) : [], gagnants: Object.keys(gains).filter(n => gains[n] > 0) });
    }
    // mon objet : sac pendant l'exploration, coffre (ouvert quand je dépose) au vaisseau
    const mo = document.getElementById('ex-mon-objet');
    if (mo && joueurs.indexOf(me) >= 0) {
        const depose = (g.phase === 'DECISION' && exArr((g.dec || {}).r).indexOf(me) >= 0) || (g.phase === 'BILAN' && (g.gainExpe || {})[me] > 0);
        const n = dedans.indexOf(me) >= 0 ? ((g.sac || {})[me] > 0 ? 'sac-ouvert' : 'sac-ferme') : depose ? 'coffre-ouvert' : 'coffre-ferme';
        if (exC.moiNom !== n) {
            if (!exC.moi) exC.moi = window.EX3D.objet(mo, n, { hauteur: .95, vitesse: .5, lueur: 0xfbbf24 }); else exC.moi.changer(n);
            exC.moiNom = n;
            if (n === 'coffre-ouvert' && nouvellePhase) exFichier('coffre', .8, 300).catch(() => {});
        }
    }
    exAmbianceMaj(g);
}
function exAmbianceMaj(g) {
    if (!g || g.status !== 'PLAYING') { exAmbianceStop(); return; }
    const aBord = ['DEPART', 'SALLE', 'CHOIX', 'DECISION', 'DESASTRE'].indexOf(g.phase) >= 0, menace = Object.keys(g.vus || {}).some(h => g.vus[h]);
    exAmbianceCible({ 'ambiance-epave': aBord ? .32 : 0, 'respiration': aBord && exDedans(g).indexOf(exMe()) >= 0 ? .14 : 0, 'tension': aBord && menace ? .28 : 0, 'ambiance-vaisseau': g.phase === 'BILAN' ? .3 : 0 });
}
// petite animation : les cristaux volent vers mon sac
function exGemmesVersMoi(n) {
    const src = document.querySelector('.ex-salle.neuve'), dst = Array.from(document.querySelectorAll('#ex-dedans .ex-j')).find(e => e.style.filter);
    if (!src || !dst) return;
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    for (let i = 0; i < Math.min(n, 10); i++) {
        const d = document.createElement('i'); d.className = 'ex-gemme';
        d.style.left = (a.left + a.width / 2 + (Math.random() - .5) * 30) + 'px'; d.style.top = (a.top + a.height / 2) + 'px';
        document.body.appendChild(d);
        setTimeout(() => { d.style.left = (b.left + b.width / 2) + 'px'; d.style.top = (b.top + 10) + 'px'; d.style.opacity = '.2'; d.style.transform = 'rotate(225deg) scale(.6)'; }, 40 + i * 70);
        setTimeout(() => d.remove(), 1200 + i * 70);
    }
}

function exBoucle() {
    const data = window.currentRoom, g = data && data.exGame;
    if (!g || data.status !== 'IN_GAME' || data.selectedMode !== 'expedition') { exArreter(); return; }
    if (g.status !== 'PLAYING' || !document.getElementById('ex-root')) return;
    if (window.isHost) exHote();
    exVueSelonTemps(g); exAmbianceFondu();
    if (['SALLE', 'CHOIX'].indexOf(g.phase) >= 0 && Date.now() > exC.grince) { if (exC.grince) exFichier('grince-' + (1 + Math.floor(Math.random() * 3)), .35).catch(() => {}); exC.grince = Date.now() + 9000 + Math.random() * 14000; }
    const t = exEcoule(g), tot = g.phase === 'CHOIX' ? (g.duree || EX.CHOIX_DEF) : g.phase === 'SALLE' ? EX.SALLE : g.phase === 'DECISION' ? EX.DECISION : g.phase === 'DESASTRE' ? EX.DESASTRE : g.phase === 'BILAN' ? EX.BILAN : EX.DEPART;
    const reste = Math.max(0, Math.ceil(tot - t));
    const bar = document.getElementById('ex-temps'); if (bar) { bar.style.width = Math.max(0, 100 * (1 - t / tot)) + '%'; bar.style.background = g.phase === 'CHOIX' && reste <= 5 ? 'linear-gradient(90deg,#f43f5e,#fb923c)' : ''; }
    const gt = document.getElementById('generic-game-timer'); if (gt) gt.innerText = g.phase === 'CHOIX' ? reste + 's' : `Expédition ${g.expe}/${g.nb}`;
    if (g.phase === 'CHOIX' && (g.dedans || {})[exMe()] && !(g.choix || {})[exMe()] && reste <= 5 && reste > 0 && exC.tic !== reste) { exC.tic = reste; exSon('tic'); }
}
function exArreter() { if (exC.ticker) { clearInterval(exC.ticker); exC.ticker = null; } exAmbianceStop(); exDetruire3D(); exC.vue = ''; }

// ------------------------------- Fin de partie -------------------------------
function exFin(data, g) {
    const cle = String(g.startedAt);
    if (exC.fini === cle) return; exC.fini = cle;
    exArreter();
    const coffre = g.coffre || {}, rel = g.reliques || {};
    const L = exArr(g.joueurs).map(n => ({ n: n, s: coffre[n] || 0, r: rel[n] || 0 })).sort((a, b) => (b.s - a.s) || (b.r - a.r));
    const podium = [1, 0, 2].map(i => L[i]).map((p, k) => !p ? '<div></div>' : `
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;animation:exArrive .7s ease both;animation-delay:${[.5, .9, .2][k]}s">
            ${['🥈', '🥇', '🥉'][k]}${exPastille(p.n, [46, 60, 40][k])}<b style="font-size:13px">${exEsc(p.n)}</b>
            <div style="width:100%;height:${[70, 100, 50][k]}px;border-radius:10px 10px 0 0;display:flex;flex-direction:column;align-items:center;padding-top:6px;font:900 15px ui-monospace,monospace;
                background:linear-gradient(180deg,${['#94a3b8', '#22d3ee', '#b45309'][k]},rgba(15,23,42,.6));color:#0b0b14">${p.s} 💎${p.r ? `<span style="font-size:11px">🗿×${p.r}</span>` : ''}</div></div>`).join('');
    const reste = L.slice(3).map((p, k) => `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:10px;background:#0f172a;border:1px solid #1e293b;font-size:12px"><span>#${k + 4} ${exEsc(p.n)}</span><b style="color:#67e8f9">${p.s} 💎</b></div>`).join('');
    const hist = exArr(g.historique).map(h => { const D = EX_DANGERS[h.d];
        const best = Object.keys(h.gains || {}).sort((a, b) => h.gains[b] - h.gains[a])[0];
        return `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 10px;border-radius:8px;background:#0b1222;font-size:12px"><span>Exp. ${h.e} · ${exEsc(h.ep)} · ${h.s} salles</span><span style="color:${D ? D.c : '#86efac'}">${D ? D.i + ' ' + exEsc(D.n) : '✓ sans évacuation'}${best && h.gains[best] ? ` · meilleur butin : ${exEsc(best)} (${h.gains[best]})` : ''}</span></div>`; }).join('');
    const rec = (g.stats || {}).record;
    const lb = document.getElementById('final-leaderboard');
    if (lb) lb.innerHTML = `<div style="text-align:left;color:#e2e8f0">
        <div style="text-align:center;font:800 10px ui-monospace,monospace;letter-spacing:.24em;color:#67e8f9;margin-bottom:10px">🛰️ COFFRES OUVERTS : FIN DE LA MISSION</div>
        <div style="display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:10px;align-items:end;max-width:420px;margin:0 auto 12px">${podium}</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">${reste}</div>
        ${rec ? `<div style="text-align:center;font-size:12px;color:#fde68a;margin-bottom:8px">🏅 Plus gros retour : ${exEsc(rec.n)}, ${rec.v} 💎 d’un coup (expédition ${rec.e})</div>` : ''}
        <div style="font:800 10px ui-monospace,monospace;letter-spacing:.2em;color:#a78bfa;margin:6px 0">JOURNAL DES EXPÉDITIONS</div>
        <div style="display:flex;flex-direction:column;gap:4px">${hist}</div>
    </div>`;
    if (typeof showScreen === 'function') showScreen('screen-results');
    exSon('fin');
}
