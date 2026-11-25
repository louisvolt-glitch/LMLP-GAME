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

// durées (s) ; REVELE : couloir + ouverture du sas avant de découvrir la salle ; COMPTE : compte à rebours avant de révéler les choix
const EX = { SALLE: 5.6, REVELE: 2.1, DECISION: 6.4, COMPTE: 3, DESASTRE: 9.2, BILAN: 7, DEPART: 6.6, CHOIX_DEF: 15 };
const EX_PORTE = { FERME: 1.0, OUVRE: 1.35 };        // instants (s) : la porte apparaît, puis s'ouvre
const EX_OBJETS = {
    scanner:    { i: '📡', n: 'Scanner', d: 'À utiliser pendant le choix : montre en secret si la salle suivante est dangereuse.' },
    extincteur: { i: '🧯', n: 'Extincteur', d: 'Automatique : éteint le prochain incendie tant que vous êtes dans l’épave.' },
    grappin:    { i: '🪝', n: 'Grappin', d: 'Armez-le pendant le choix : si vous continuez, il vole des cristaux au plus riche de ceux qui rentrent.' },
    bouclier:   { i: '🛡️', n: 'Bouclier', d: 'Automatique : si une évacuation vous surprend dans l’épave, vous sauvez la moitié de votre sac.' },
    balise:     { i: '📍', n: 'Balise de rappel', d: 'Armez-la pendant le choix : vous rentrez au vaisseau (même si vous aviez choisi de continuer) et vous raflez tous les cristaux au sol avant les autres.' },
    drone:      { i: '🛸', n: 'Drone éclaireur', d: 'À utiliser pendant le choix : montre à tout le monde ce que contient la salle suivante.' },
    lunette:    { i: '🥽', n: 'Vision nocturne', d: 'Automatique : vous voyez tout dans le noir (épave Nyx) : quantités de cristaux et risque.' },
    scellant:   { i: '🧪', n: 'Mousse scellante', d: 'Automatique : colmate la prochaine fuite d’oxygène tant que vous êtes dans l’épave.' },
    combinaison:{ i: '☢️', n: 'Kit anti-radiations', d: 'Automatique : vous protège des prochaines radiations tant que vous êtes dans l’épave.' },
    leurre:     { i: '🔊', n: 'Leurre sonore', d: 'Automatique : fait fuir la prochaine créature tant que vous êtes dans l’épave.' },
    foreuse:    { i: '⛏️', n: 'Foreuse à cristaux', d: 'Automatique : quand vous rentrez au vaisseau, vous forez 3 cristaux de plus.' }
};
const EX_SALLES_OBJETS = Object.keys(EX_OBJETS);      // chaque objet a sa vidéo de salle
// objet qui annule un danger quand son porteur est dans l'épave
const EX_PROTECTION = { feu: 'extincteur', oxy: 'scellant', rad: 'combinaison', xeno: 'leurre' };
const EX_FOREUSE = 3;
// enchère secrète : une mise payée avec le sac ne compte que pour la moitié (2 💎 du sac = 1 point d'enchère)
const EX_SAC_DIVISE = 2;
const EX_GRAPPIN = 3;                                 // cristaux volés par le grappin
// effet de chaque épave (même ordre que EX_NOMS_EPAVES)
const EX_EFFETS = [
    { i: '☢️', t: 'Réacteur éventré', d: 'Une relique de plus, mais deux fois plus de radiations.', dangers: { rad: 6 }, reliques: 1 },
    { i: '⏱️', t: 'Courant coupé', d: 'Moins de temps pour choisir (−4 s).', choix: -4 },
    { i: '💎', t: 'Filon riche', d: 'Chaque salle de cristaux en contient 2 de plus.', bonus: 2 },
    { i: '👾', t: 'Nid xénomorphe', d: 'Créatures ×2, mais cristaux ×1,5.', dangers: { xeno: 6 }, mult: 1.5 },
    { i: '🧰', t: 'Soute à matériel', d: 'Deux objets de plus à trouver.', objets: 2 },
    { i: '⚡', t: 'Orage magnétique', d: 'Courts-circuits ×2, cristaux +1 par salle.', dangers: { elec: 6 }, bonus: 1 },
    { i: '🔇', t: 'Silence radio', d: 'Impossible de voir qui a déjà choisi.', silence: 1 },
    { i: '💨', t: 'Coque percée', d: 'Fuites d’oxygène ×2, mais cristaux ×1,5.', dangers: { oxy: 6 }, mult: 1.5 },
    { i: '🕊️', t: 'Épave calme', d: 'Seulement 2 cartes de chaque danger.', dangers: { oxy: 2, xeno: 2, rad: 2, feu: 2, elec: 2 } },
    { i: '🌑', t: 'Dans le noir', d: 'La lampe ne montre que la moitié : quantités de cristaux et risque cachés.', noir: 1 }
];
function exEffet(g) { return EX_EFFETS[(g && g.epaveId) || 0] || {}; }
function exDuree(g) { return Math.max(6, (g.duree || EX.CHOIX_DEF) + (exEffet(g).choix || 0)); }
const EX_TRESORS = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];
const EX_DANGERS = {
    oxy:  { i: '💨', n: 'Fuite d’oxygène', c: '#38bdf8', d: 'Les réserves d’air se vident !' },
    xeno: { i: '👾', n: 'Créature xénomorphe', c: '#a3e635', d: 'Quelque chose bouge dans les conduits…' },
    rad:  { i: '☢️', n: 'Radiations', c: '#facc15', d: 'Le compteur Geiger s’affole.' },
    feu:  { i: '🔥', n: 'Incendie', c: '#fb923c', d: 'Les flammes gagnent les coursives.' },
    elec: { i: '⚡', n: 'Court-circuit', c: '#c084fc', d: 'Des arcs électriques jaillissent des murs.' }
};
const EX_RELIQUES = [5, 5, 5, 10, 10];
const EX_FICHIERS_EPAVES = ['epave-leviathan', 'epave-station-ombre7', 'epave-prospecteur', 'epave-cargo-kerberos', 'epave-vagabond', 'epave-fregate-aurore', 'epave-silence-orion', 'epave-atlas', 'epave-albatros', 'epave-croiseur-nyx'];   // même ordre que les noms
const EX_NOMS_EPAVES = ['Le Léviathan', 'Station Ombre-7', 'Le Prospecteur', 'Cargo Kerberos', 'Le Vagabond', 'Frégate Aurore', 'Le Silence d’Orion', 'Minéralier Atlas', 'L’Albatros', 'Croiseur Nyx'];

const exC = { sess: null, cleSalle: '', clePhase: '', fini: '', ticker: null, tic: -1, vue: '', vitrine: null, vitrineNom: '', stage: null, moi: null, moiNom: '', grince: 0, vusAvant: '', compte: -1, scan: null, alarmeJusqua: 0 };
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
const EX_MEDIA = './expedition-visuel/';
// sons d'origine (dossier expedition-visuel/sound) : [fichier, début (s), durée max (s)]
const EX_SON = {
    tic: ['11325622-clock-ticking-sound-effect-240503', .25, .55], alarme: ['jeremayjimenez-bermuda-eas-alarm-2025-my-own-alarm-441470', 0, 3],
    evacuation: ['soundreality-explosion-fx-343683'], relique: ['freesound_community-mystic-whistle-105455', .25, 5],
    'danger-rad': ['alex_jauk-geiger-counter-sound-effect-187940', .6, 3.5], 'danger-xeno': ['flutie8211-low-pitch-alien-noise-person-screaming-499466', .95, 3.5],
    'danger-elec': ['freesound_community-electric-90746'], 'danger-oxy': ['freesound_community-short-gas-leak-98286'], 'danger-feu': ['gregorquendel-designed-fire-winds-swoosh-04-116788', 0, 3.5],
    amarrage: ['universfield-sharp-metallic-punch-124466', .2, 2.5], retour: ['dragon-studio-sci-fi-portal-jump-05-416165'], decollage: ['freesound_community-alien-ship-takeoff-28339', .15, 4.5],
    victoire: ['emand_edroff-victory-bell-success-fanfare-576275'], pas: ['freesound_community-pasos-sobre-metal-36986', .5, 2.8],
    lampe: ['lesiakower-torch-turned-on-flashlight-click-457506'], ramasse: ['freesound_community-snd_fragment_retrievewav-14728'], sac: ['freeeverythingxx-object-fall-soft-275694'],
    coffre: ['u_ys7j2hx6e9-safe-open-close-443345'], cristaux: ['universfield-magic-twinkle-244951'], clic: ['soundshelfstudio-sci-fi-ui-click-sound-596258'],
    'sas-ouverture': ['sas-ouverture'], 'sas-fermeture': ['sas-fermeture'],
    'grince-1': ['audiopapkin-squeak-metal-ps-016-389413'], 'grince-2': ['audiopapkin-squeak-metal-ps-027-389425'], 'grince-3': ['dragon-studio-groaning-metal-511322', 0, 5],
    'ambiance-epave': ['ambiance-epave'], 'ambiance-vaisseau': ['ambiance-vaisseau'], tension: ['tension'], respiration: ['respiration-casque']
};
function exSonURL(nom) { const f = EX_SON[nom]; return EX_MEDIA + 'sound/' + (f ? f[0] : nom) + '.mp3'; }
const EX_SONS_FICHIERS = { salle: ['lampe', 'pas'], gemmes: ['cristaux'], desastre: ['evacuation', 'alarme'], relique: ['relique'], choix: ['clic'],
    retour: ['retour', 'sas-fermeture'], continuer: ['pas'], tic: ['tic'], depart: ['amarrage', 'sas-ouverture'], fin: ['victoire'], danger: ['alarme'] };
const exAudios = {};
function exSonActif() { return typeof sysSon === 'undefined' || sysSon.on; }
// joue un fichier ; renvoie une promesse rejetée s'il n'existe pas ou si le navigateur refuse
function exFichier(nom, vol, delai) {
    if (!exSonActif()) return Promise.resolve();
    return new Promise((ok, ko) => setTimeout(() => {
        try {
            const f = EX_SON[nom] || [], a = new Audio(exSonURL(nom)), v = vol == null ? .8 : vol; a.volume = v;
            if (f[1]) a.currentTime = f[1];
            if (f[2]) setTimeout(() => { const t0 = Date.now(), fond = setInterval(() => { const k = 1 - (Date.now() - t0) / 250; if (k <= 0) { clearInterval(fond); a.pause(); } else a.volume = v * k; }, 30); }, f[2] * 1000);
            a.onerror = ko; const p = a.play(); if (p && p.catch) p.then(ok, ko); else ok();
        } catch (e) { ko(e); }
    }, delai || 0));
}
// ambiances en boucle : volume visé par piste, fondu dans la boucle d'affichage
function exAmbianceCible(cibles) {
    ['ambiance-epave', 'ambiance-vaisseau', 'tension', 'respiration'].forEach(n => {
        let a = exAudios[n];
        const v = exSonActif() ? (cibles[n] || 0) : 0;
        if (!a && v > 0) { try { a = exAudios[n] = new Audio(exSonURL(n)); a.loop = true; a.volume = 0; a.cible = 0; } catch (e) { return; } }
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
    const g = { v: 2, status: 'PLAYING', startedAt: Date.now(), nb: nb, duree: duree, joueurs: noms, coffre: coffre, retires: [], reliquesTirees: 0, expe: 0, stats: {}, objets: {} };
    exPreparerExpedition(g);
    const updates = { status: 'IN_GAME', selectedMode: 'expedition', exGame: g };
    Object.values(players).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(code, updates);
};
// nouvelle expédition : paquet mélangé, tout le monde à bord, sacs vides
function exPreparerExpedition(g) {
    g.expe = (g.expe || 0) + 1;
    g.epaveId = Math.floor(Math.random() * EX_NOMS_EPAVES.length); g.epave = EX_NOMS_EPAVES[g.epaveId];
    const E = exEffet(g), retires = exArr(g.retires);
    const paquet = EX_TRESORS.map(v => ({ k: 't', v: Math.round(v * (E.mult || 1)) + (E.bonus || 0) }));
    Object.keys(EX_DANGERS).forEach(h => { const n = ((E.dangers || {})[h] || 3) - retires.filter(r => r === h).length; for (let i = 0; i < n; i++) paquet.push({ k: 'h', h: h }); });
    // reliques : celles des expéditions précédentes non emportées restent dans l'épave
    const tirees = Math.min(EX_RELIQUES.length, (g.reliquesTirees || 0) + 1); g.reliquesTirees = tirees;
    const prises = exArr(g.reliquesPrises);
    for (let i = 0; i < tirees; i++) if (prises.indexOf(i) < 0 && exArr(g.reliquesPerdues).indexOf(i) < 0) paquet.push({ k: 'a', v: EX_RELIQUES[i], id: i });
    if (E.reliques) paquet.push({ k: 'a', v: 5, id: 100 + g.expe });
    // objets à usage unique
    const types = Object.keys(EX_OBJETS);
    for (let i = 0; i < 2 + (E.objets || 0); i++) paquet.push({ k: 'o', o: types[Math.floor(Math.random() * types.length)] });
    g.paquet = exMelange(paquet);
    g.chemin = []; g.sac = {}; g.dedans = {};
    exArr(g.joueurs).forEach(n => { g.dedans[n] = 1; g.sac[n] = 0; });
    g.vus = {}; g.choix = null; g.dec = null; g.desastre = null; g.gainExpe = {}; g.grappin = null; g.balise = null; g.drone = null;
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
        if (tous && t >= 1.2 || t >= exDuree(g) + .8) { exH.lock = cle; exDecider(g); }
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
    ['coffre', 'sac', 'dedans', 'vus', 'gainExpe', 'stats', 'reliques', 'choix', 'objets', 'grappin', 'balise', 'mises'].forEach(k => { if (!g[k] || typeof g[k] !== 'object') g[k] = {}; });
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
        // un objet de protection porté par un explorateur à bord annule le danger
        const prot = EX_PROTECTION[carte.h];
        if (prot) { const p = dedans.find(n => ((g.objets[n] || {})[prot] || 0) > 0); if (p) { g.objets[p][prot]--; salle.eteint = p; salle.prot = prot; } }
        if (!salle.eteint) g.vus[carte.h] = (g.vus[carte.h] || 0) + 1;
        if (!salle.eteint && g.vus[carte.h] >= 2) {      // évacuation : les sacs de ceux qui sont à bord sont perdus
            phase = 'DESASTRE';
            // le bouclier sauve la moitié du sac (mise directement au coffre)
            const pertes = {}, sauves = {};
            dedans.forEach(n => {
                let sac = g.sac[n] || 0; const ob = g.objets[n] || {};
                if ((ob.bouclier || 0) > 0 && sac > 0) { const k = Math.floor(sac / 2); ob.bouclier--; g.objets[n] = ob; sauves[n] = k; sac -= k;
                    g.coffre[n] = (g.coffre[n] || 0) + k; g.gainExpe[n] = (g.gainExpe[n] || 0) + k; }
                pertes[n] = sac; g.sac[n] = 0; g.dedans[n] = 0;
            });
            g.desastre = { h: carte.h, pertes: pertes, sauves: sauves };
            g.retires = exArr(g.retires).concat([carte.h]);
            g.stats.desastres = (g.stats.desastres || 0) + 1;
        }
    } else if (carte.k === 'a') salle.pris = 0;
    // objet : mis aux enchères secrètes pendant le choix (attribué à la révélation des choix)
    chemin.push(salle);
    g.paquet = paquet; g.chemin = chemin; g.phase = phase; g.t0 = Date.now(); g.choix = null; g.drone = null; g.mises = null;
    exEcrire({ exGame: exNettoyer(g) });
}
function exDecider(g0) {
    const g = exCopie(g0), data = window.currentRoom;
    const presents = new Set(exHumains(data).map(p => p.name));
    const dedans = exDedans(g), ch = g.choix || {};
    // un joueur absent ou qui n'a pas répondu rentre au vaisseau (choix prudent)
    // balise de rappel armée : son porteur rentre quoi qu'il ait choisi
    const balises = dedans.filter(n => g.balise[n] && ((g.objets[n] || {}).balise || 0) > 0);
    const rentrent = dedans.filter(n => ch[n] !== 'c' || !presents.has(n) || balises.indexOf(n) >= 0), continuent = dedans.filter(n => rentrent.indexOf(n) < 0);
    const chemin = exArr(g.chemin), gains = {}, rel = {}, bonus = [];
    // état d'avant la décision : affiché pendant le compte à rebours
    const avant = { dedans: dedans.slice(), sac: Object.assign({}, g.sac), coffre: Object.assign({}, g.coffre), sol: chemin.map(s => [s.r || 0, s.pris || 0]) };
    // enchère secrète de l'objet de la salle : la plus forte mise l'emporte, seul le gagnant paie
    let enchere = null; const der = chemin[chemin.length - 1];
    if (der && der.k === 'o' && der.qui == null) {
        const offres = dedans.map(n => {
            const m = g.mises[n]; if (!m || !(m.n > 0)) return null;
            const src = m.src === 's' ? 's' : 'c', dispo = src === 's' ? (g.sac[n] || 0) : (g.coffre[n] || 0), k = Math.min(Math.floor(m.n), dispo);
            return k > 0 ? { n: n, k: k, src: src, val: src === 's' ? k / EX_SAC_DIVISE : k } : null;
        }).filter(Boolean);
        if (offres.length) {
            const max = Math.max.apply(null, offres.map(o => o.val)), top = offres.filter(o => o.val === max), w = top[Math.floor(Math.random() * top.length)];
            if (w.src === 's') g.sac[w.n] -= w.k; else g.coffre[w.n] -= w.k;
            g.objets[w.n] = g.objets[w.n] || {}; g.objets[w.n][der.o] = (g.objets[w.n][der.o] || 0) + 1;
            der.qui = w.n; enchere = { o: der.o, qui: w.n, k: w.k, src: w.src, offres: offres, egalite: top.length > 1 };
        } else { der.qui = ''; enchere = { o: der.o, qui: '', offres: [] }; }
    }
    rentrent.forEach(n => gains[n] = 0);
    // la balise rafle d'abord tout le sol (partagé entre les porteurs de balise)
    if (balises.length) {
        chemin.forEach(s => { if (s.k === 't' && s.r > 0) { const p = Math.floor(s.r / balises.length); if (p) { balises.forEach(n => gains[n] += p); s.r -= p * balises.length; } } });
        balises.forEach(n => { g.objets[n].balise--; bonus.push({ n: n, o: 'balise' }); });
    }
    // la foreuse ajoute des cristaux à qui rentre
    rentrent.forEach(n => { const ob = g.objets[n] || {}; if ((ob.foreuse || 0) > 0) { ob.foreuse--; g.objets[n] = ob; gains[n] += EX_FOREUSE; bonus.push({ n: n, o: 'foreuse', k: EX_FOREUSE }); } });
    if (rentrent.length) {
        chemin.forEach(s => {
            if (s.k === 't' && s.r > 0) { const p = Math.floor(s.r / rentrent.length); if (p) { rentrent.forEach(n => gains[n] += p); s.r -= p * rentrent.length; } }
            if (s.k === 'a' && !s.pris && rentrent.length === 1) {
                s.pris = 1; const n = rentrent[0]; gains[n] += s.v; rel[n] = (rel[n] || 0) + 1;
                if (s.id < 100) g.reliquesPrises = exArr(g.reliquesPrises).concat([s.id]);
                g.reliques[n] = (g.reliques[n] || 0) + 1;
            }
        });
    }
    const total = {}; rentrent.forEach(n => total[n] = (g.sac[n] || 0) + gains[n]);
    // grappins armés par ceux qui continuent : ils volent le plus riche de ceux qui rentrent
    const vols = [];
    if (rentrent.length) continuent.forEach(h => {
        const ob = g.objets[h] || {}; if (!g.grappin[h] || !(ob.grappin > 0)) return;
        const cible = rentrent.slice().sort((a, b) => total[b] - total[a])[0], n = Math.min(EX_GRAPPIN, total[cible] || 0);
        if (n <= 0) return;
        total[cible] -= n; g.sac[h] = (g.sac[h] || 0) + n; ob.grappin--; g.objets[h] = ob; vols.push({ de: cible, a: h, n: n });
    });
    rentrent.forEach(n => {
        g.coffre[n] = (g.coffre[n] || 0) + total[n];
        g.gainExpe[n] = (g.gainExpe[n] || 0) + total[n];
        if (total[n] > ((g.stats.record || {}).v || 0)) g.stats.record = { n: n, v: total[n], e: g.expe };
        g.sac[n] = 0; g.dedans[n] = 0;
    });
    // emporter une relique déclenche l'alarme de l'épave : un danger de plus rôde dans les salles suivantes
    let alarme = '';
    if (Object.keys(rel).length && continuent.length) {
        const types = Object.keys(EX_DANGERS); alarme = types[Math.floor(Math.random() * types.length)];
        const p = exArr(g.paquet); p.splice(Math.min(p.length, 1 + Math.floor(Math.random() * 3)), 0, { k: 'h', h: alarme }); g.paquet = p;
    }
    g.chemin = chemin; g.grappin = null; g.balise = null; g.drone = null; g.mises = null;
    g.dec = { r: rentrent, c: continuent, gains: gains, rel: rel, vols: vols, alarme: alarme, avant: avant, bonus: bonus, enchere: enchere };
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
    exSon('choix'); exFichier(v === 'r' ? 'sas-ouverture' : 'clic', .5).catch(() => {}); exEcrire({ [`exGame/choix/${me}`]: v });
};
// scanner : regarde en secret la salle suivante (le résultat n'est montré qu'à soi)
window.exScanner = function () {
    const g = window.currentRoom && window.currentRoom.exGame, me = exMe();
    if (!g || g.phase !== 'CHOIX' || !(g.dedans || {})[me]) return;
    const n = ((g.objets || {})[me] || {}).scanner || 0, cle = g.expe + ':' + exArr(g.chemin).length;
    if (n <= 0 || (exC.scan && exC.scan.cle === cle)) return;
    const p = exArr(g.paquet)[0]; let txt, ok = true;
    if (!p) txt = 'Plus aucune salle à explorer.';
    else if (p.k === 'h') { const D = EX_DANGERS[p.h] || {}; ok = false;
        txt = (g.vus || {})[p.h] ? `☠️ ${D.i} ${D.n} : c’est l’évacuation assurée !` : `⚠️ ${D.i} ${D.n} derrière la porte (pas encore fatal).`; }
    else txt = '✅ Aucun danger dans la salle suivante.';
    exC.scan = { cle: cle, txt: txt, ok: ok };
    exFichier('tic', .6).catch(() => {}); exFichier(ok ? 'clic' : 'alarme', .35, 300).catch(() => {});
    exEcrire({ [`exGame/objets/${me}/scanner`]: n - 1 });
};
// enchère secrète : réglage local de la mise, puis envoi
function exSalleEnVente(g) { const d = exArr(g && g.chemin).slice(-1)[0]; return d && d.k === 'o' && d.qui == null ? d : null; }
function exMiseMax(g, src) { const me = exMe(); return src === 's' ? ((g.sac || {})[me] || 0) : ((g.coffre || {})[me] || 0); }
function exMiseLocale(g) {
    const cle = g.expe + ':' + exArr(g.chemin).length, envoyee = (g.mises || {})[exMe()];
    if (!exC.mise || exC.mise.cle !== cle) exC.mise = { cle: cle, n: envoyee ? envoyee.n : 0, src: envoyee ? envoyee.src : 'c' };
    exC.mise.n = Math.max(0, Math.min(exC.mise.n, exMiseMax(g, exC.mise.src)));
    return exC.mise;
}
window.exMiseAjuste = function (d) { const R = window.currentRoom, g = R && R.exGame; if (!g) return; const m = exMiseLocale(g); m.n += d; exMiseLocale(g); exFichier('clic', .4).catch(() => {}); exMaj(R, g); };
window.exMiseSource = function (src) { const R = window.currentRoom, g = R && R.exGame; if (!g) return; const m = exMiseLocale(g); m.src = src; exMiseLocale(g); exMaj(R, g); };
window.exMiser = function () {
    const R = window.currentRoom, g = R && R.exGame, me = exMe();
    if (!g || g.phase !== 'CHOIX' || !(g.dedans || {})[me] || !exSalleEnVente(g)) return;
    const m = exMiseLocale(g);
    exFichier(m.n > 0 ? 'coffre' : 'clic', .6).catch(() => {});
    exEcrire({ [`exGame/mises/${me}`]: m.n > 0 ? { n: m.n, src: m.src } : null });
};
// balise : armée ou désarmée pendant le choix
window.exBalise = function () {
    const g = window.currentRoom && window.currentRoom.exGame, me = exMe();
    if (!g || g.phase !== 'CHOIX' || !(g.dedans || {})[me] || !(((g.objets || {})[me] || {}).balise > 0)) return;
    exFichier('clic', .6).catch(() => {});
    exEcrire({ [`exGame/balise/${me}`]: (g.balise || {})[me] ? null : 1 });
};
// drone : montre à tous la salle suivante
window.exDrone = function () {
    const g = window.currentRoom && window.currentRoom.exGame, me = exMe();
    if (!g || g.phase !== 'CHOIX' || !(g.dedans || {})[me] || g.drone) return;
    const n = ((g.objets || {})[me] || {}).drone || 0; if (n <= 0) return;
    const p = exArr(g.paquet)[0] || { k: 'fin' };
    exFichier('decollage', .5).catch(() => {});
    exEcrire({ [`exGame/objets/${me}/drone`]: n - 1, 'exGame/drone': { qui: me, k: p.k, h: p.h || '', o: p.o || '', v: p.v || 0 } });
};
// grappin : armé ou désarmé pendant le choix
window.exGrappin = function () {
    const g = window.currentRoom && window.currentRoom.exGame, me = exMe();
    if (!g || g.phase !== 'CHOIX' || !(g.dedans || {})[me] || !(((g.objets || {})[me] || {}).grappin > 0)) return;
    exFichier('clic', .6).catch(() => {});
    exEcrire({ [`exGame/grappin/${me}`]: (g.grappin || {})[me] ? null : 1 });
};

// ------------------------------- Affichage -------------------------------
const EX_FISSURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'%3E%3Cpath d='M3 6 L13 15 L9 20 L18 33 M13 15 L23 11 L26 19 L34 14 M23 11 L21 2 M26 19 L31 30' stroke='white' stroke-width='1.3' fill='none' opacity='.9' stroke-linecap='round'/%3E%3C/svg%3E")`;
function exStyle() {
    if (document.getElementById('ex-style')) return;
    const st = document.createElement('style'); st.id = 'ex-style';
    st.textContent = `
    #screen-generic-game.ex-large{max-width:min(1680px,100%)!important}
    #screen-generic-game.ex-large>div:first-child{display:none!important}
    #ex-root{display:flex;flex-direction:column;gap:8px;color:#e2e8f0;width:100%;margin:0 auto;position:relative}
    .ex-barre{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:7px 12px;border-radius:14px;background:linear-gradient(90deg,rgba(8,47,73,.7),rgba(30,27,75,.6));border:1px solid rgba(34,211,238,.3)}
    .ex-b-g{flex:1 1 200px;min-width:0}
    .ex-titre{font:900 11px ui-monospace,monospace;letter-spacing:.22em;color:#67e8f9}
    .ex-sous{font-size:12px;color:#94a3b8}
    .ex-effet{display:flex;align-items:center;gap:7px;padding:4px 10px;border-radius:10px;background:rgba(15,23,42,.75);border:1px solid rgba(167,139,250,.45);font-size:11px;color:#ddd6fe;max-width:330px;line-height:1.25}
    .ex-effet .i{font-size:18px}.ex-effet b{color:#fff;display:block;font-size:11px;letter-spacing:.04em}
    .ex-effet:empty{display:none}
    .ex-risque{display:flex;flex-direction:column;gap:3px;min-width:140px}
    .ex-risque .l{font:800 9px ui-monospace,monospace;letter-spacing:.16em;color:#94a3b8;display:flex;justify-content:space-between;gap:8px}
    .ex-risque .l b{color:#fff}
    .ex-risque .j{height:7px;border-radius:9px;background:#1e293b;overflow:hidden}.ex-risque .j i{display:block;height:100%;border-radius:9px;transition:width .6s,background .6s}
    .ex-chrono{font:900 20px ui-monospace,monospace;color:#fbbf24;min-width:40px;text-align:right}
    .ex-dangers{display:flex;gap:6px}
    .ex-dg{position:relative;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:#0f172a;border:1px solid #334155;filter:grayscale(.75);opacity:.7;transition:filter .3s,opacity .3s}
    .ex-dg small{position:absolute;bottom:0;right:3px;font:800 9px ui-monospace,monospace;color:#94a3b8;filter:none}
    .ex-dg.vu{filter:none;opacity:1;border-color:var(--c);background:color-mix(in srgb,var(--c) 26%,#0f172a);animation:exClign 1s linear infinite}
    .ex-dg.vu::after{content:'';position:absolute;inset:0;border-radius:inherit;background:${EX_FISSURE} center/100% 100% no-repeat;pointer-events:none}
    .ex-dg.vu small{color:#fff}
    @keyframes exClign{0%,45%{box-shadow:0 0 16px var(--c)}55%,100%{box-shadow:0 0 0 transparent;border-color:#475569}}
    .ex-dg.out{opacity:.22}
    .ex-dg.casse{animation:exCasse .7s ease,exClign 1s linear .7s infinite}
    @keyframes exCasse{0%{transform:scale(1.7)}35%{transform:scale(.88) rotate(-9deg)}65%{transform:rotate(6deg)}100%{transform:none}}
    .ex-tremble{animation:exTremble .5s linear}
    @keyframes exTremble{15%,55%{transform:translate(-2px,1px)}35%,75%{transform:translate(2px,-1px)}100%{transform:none}}
    .ex-progres{height:5px;border-radius:9px;background:#1e293b;overflow:hidden}.ex-progres i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa);transition:width .25s linear}
    .ex-corps{display:flex;flex-direction:column;gap:10px}
    .ex-gauche,.ex-droite{display:contents}
    .ex-bas{display:contents}
    .ex-vue{order:1}#ex-zone-action{order:2}.ex-cartes{order:3}.ex-bande{order:4}.ex-moi{order:5}
    #ex-root.ex-pc{overflow:hidden}
    .ex-pc .ex-corps{flex:1;min-height:0;display:flex;flex-direction:row;gap:12px}
    .ex-pc .ex-gauche,.ex-pc .ex-droite{display:flex;flex-direction:column;gap:10px;min-height:0;min-width:0}
    .ex-pc .ex-gauche{flex:0 0 auto;height:100%;aspect-ratio:9/16;max-width:46%}
    .ex-pc .ex-droite{flex:1}
    .ex-pc .ex-vue{flex:1;min-height:0;height:auto}
    .ex-pc .ex-cartes{flex:1;min-height:0;grid-auto-rows:minmax(0,1fr)}
    .ex-pc .ex-bas{display:flex;gap:10px;align-items:stretch;flex:0 0 auto}
    .ex-pc .ex-bas #ex-zone-action{flex:1 1 60%;min-width:0;display:flex;flex-direction:column;justify-content:center}
    .ex-pc .ex-bas .ex-moi{flex:1 1 40%;min-width:0}
    .ex-pc .ex-stage{flex:1;min-height:150px;height:auto}
    .ex-pc .ex-salle{width:80px;min-height:96px;padding:6px 4px}.ex-pc .ex-salle .ic{font-size:24px}.ex-pc .ex-salle .val{font-size:17px}.ex-pc .ex-vaisseau{width:94px;padding:6px}
    .ex-pc .ex-btn{min-height:62px}
    .ex-vue{position:relative;height:clamp(320px,64vh,720px);border-radius:16px;overflow:hidden;background:#000;border:1px solid rgba(148,163,184,.25)}
    .ex-vue video{position:absolute;display:block}
    #ex-vid-flou{inset:-30px;width:calc(100% + 60px);height:calc(100% + 60px);object-fit:cover;filter:blur(22px) brightness(.45) saturate(1.2)}
    #ex-vid{inset:0;width:100%;height:100%;object-fit:contain}
    .ex-vue.large #ex-vid{object-fit:cover}
    .ex-vue.large #ex-vid-flou{display:none}
    .ex-vue-bas{position:absolute;left:0;right:0;bottom:0;height:45%;background:linear-gradient(0deg,rgba(2,6,23,.85),transparent);pointer-events:none;z-index:2}
    #ex-legende{position:absolute;left:14px;bottom:12px;right:calc(min(32%,200px) + 8px);color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:6}
    #ex-legende .t{font:900 11px ui-monospace,monospace;letter-spacing:.22em;color:#67e8f9}
    #ex-legende .g{font:900 clamp(18px,2.6vw,32px) system-ui,sans-serif;letter-spacing:.02em;animation:exArrive .6s ease both}
    #ex-legende .p{font-size:13px;color:#e2e8f0;opacity:.92}
    #ex-obj3d{position:absolute;right:6px;bottom:4px;width:min(30%,200px);height:min(60%,200px);pointer-events:none;z-index:6}
    .ex-vue.eteint #ex-vid{filter:saturate(.15) brightness(.75) contrast(1.1)}.ex-vue.eteint #ex-vid-flou{filter:blur(22px) brightness(.35) saturate(.1)}
    .ex-vue.eteint .ex-vue-bas{background:linear-gradient(0deg,rgba(203,213,225,.35),rgba(203,213,225,.12) 60%,transparent)}
    .ex-vue.flash::after{content:'';position:absolute;inset:0;background:var(--c,#fff);mix-blend-mode:screen;animation:exFlash .7s ease-out both;pointer-events:none;z-index:7}
    @keyframes exFlash{from{opacity:.75}to{opacity:0}}
    #ex-porte{position:absolute;inset:0;z-index:5;pointer-events:none;display:none}
    #ex-porte.ferme,#ex-porte.ouvre{display:block}
    #ex-porte .v{position:absolute;top:0;bottom:0;width:50.5%;background:linear-gradient(90deg,#2c323c,#59606b 45%,#3b4250);transition:transform .8s cubic-bezier(.65,0,.3,1)}
    #ex-porte .v::before{content:'';position:absolute;left:0;right:0;top:44%;height:9%;background:repeating-linear-gradient(-45deg,#e8b400 0 14px,#16181c 14px 28px);opacity:.9}
    #ex-porte .v.g{left:0;transform:translateX(-100%)}#ex-porte .v.d{right:0;transform:translateX(100%)}
    #ex-porte .v.g::after,#ex-porte .v.d::after{content:'';position:absolute;top:0;bottom:0;width:4px;background:#f59e0b;box-shadow:0 0 22px 4px #f59e0b}
    #ex-porte .v.g::after{right:0}#ex-porte .v.d::after{left:0}
    #ex-porte.ferme .v{transform:none;transition:transform .28s ease-out}
    #ex-porte.ouvre .v.g{transform:translateX(-103%)}#ex-porte.ouvre .v.d{transform:translateX(103%)}
    #ex-porte .plaque{position:absolute;left:50%;top:22%;transform:translateX(-50%);font:900 13px ui-monospace,monospace;letter-spacing:.24em;color:#fde68a;background:#16181c;border:2px solid #e8b400;padding:6px 12px;border-radius:6px;z-index:2;transition:opacity .2s}
    #ex-porte.ouvre .plaque{opacity:0}
    #ex-lampe{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0}
    .ex-vue.lampe #ex-lampe{background:radial-gradient(circle at 50% 50%,transparent 0 9%,rgba(0,0,0,.95) 23%);background-size:260% 260%;animation:exLampe 2.4s ease-out both}
    @keyframes exLampe{0%{opacity:1;background-position:18% 72%}35%{background-position:82% 35%}62%{background-position:42% 55%;background-size:260% 260%}86%{opacity:1;background-size:800% 800%;background-position:50% 50%}100%{opacity:0;background-size:900% 900%;background-position:50% 50%}}
    .ex-vue.noir #ex-lampe{opacity:1;background:radial-gradient(circle at 50% 50%,transparent 0 13%,rgba(0,0,0,.9) 32%);background-size:230% 230%;animation:exNoir 8s ease-in-out infinite alternate}
    @keyframes exNoir{0%{background-position:30% 62%}50%{background-position:70% 38%}100%{background-position:46% 56%}}
    .ex-voile{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;text-align:center;padding:16px;pointer-events:none}
    .ex-voile.desastre{background:radial-gradient(circle,color-mix(in srgb,var(--c) 45%,transparent),rgba(10,0,0,.85));animation:exAlerte .5s ease both}
    .ex-voile.compte{background:radial-gradient(circle,rgba(2,6,23,.3),rgba(2,6,23,.88))}
    .ex-voile .chiffre{font:900 clamp(80px,12vw,150px) ui-monospace,monospace;line-height:1;color:#fff;text-shadow:0 0 40px #22d3ee;animation:exBoum .7s cubic-bezier(.2,1.6,.4,1) both}
    .ex-voile.choix{justify-content:flex-end;align-items:stretch;padding:12px}
    .ex-rev{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:rgba(2,6,23,.84);border:1px solid rgba(148,163,184,.3);border-radius:14px;padding:10px 12px;text-align:left;animation:exArrive .5s ease both}
    .ex-rev h4{font:800 10px ui-monospace,monospace;letter-spacing:.18em;margin:0 0 4px}
    .ex-rev .pp{display:flex;flex-wrap:wrap;gap:6px}
    .ex-rev .p{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;animation:exCarte .6s ease both}
    .ex-rev .ev{grid-column:1/-1;font-size:13px;padding-top:6px;border-top:1px solid #1e293b}
    .ex-voile .gros{font-size:70px;animation:exBoum .8s cubic-bezier(.2,1.6,.4,1) both}
    .ex-voile .msg{font:900 22px system-ui,sans-serif;letter-spacing:.06em;text-shadow:0 0 18px rgba(0,0,0,.8)}
    @keyframes exAlerte{0%{opacity:0}20%{opacity:1}30%{opacity:.6}40%{opacity:1}}
    @keyframes exBoum{0%{transform:scale(3);opacity:0}100%{transform:none;opacity:1}}
    .ex-secoue{animation:exSecoue .55s linear}
    @keyframes exSecoue{10%,50%,90%{transform:translate(-6px,2px)}30%,70%{transform:translate(6px,-2px)}100%{transform:none}}
    @keyframes exArrive{from{transform:translateY(-16px) scale(.6);opacity:0}}
    @keyframes exCarte{0%{transform:rotateY(90deg)}100%{transform:none}}
    .ex-bande{position:relative;border-radius:14px;border:1px solid rgba(148,163,184,.2);background:rgba(6,10,20,.85);flex:0 0 auto}
    .ex-couloir{display:flex;gap:8px;align-items:stretch;padding:8px;overflow-x:auto;scroll-behavior:smooth}
    .ex-vaisseau{flex:0 0 auto;width:110px;border-radius:12px;border:1px dashed rgba(34,211,238,.45);background:rgba(8,47,73,.45);padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
    .ex-salle{flex:0 0 auto;width:100px;min-height:140px;border-radius:12px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:3px;position:relative;background:linear-gradient(180deg,#1e293b,#0f172a);border:1px solid #334155}
    .ex-salle.neuve{animation:exRevele .9s cubic-bezier(.2,1.3,.4,1) both}
    @keyframes exRevele{0%{opacity:0;transform:perspective(600px) rotateY(90deg) translateX(-30px)}60%{opacity:1;transform:perspective(600px) rotateY(-10deg)}100%{transform:none}}
    .ex-salle .num{font:800 9px ui-monospace,monospace;letter-spacing:.14em;color:#94a3b8}
    .ex-salle .ic{font-size:34px;line-height:1;filter:drop-shadow(0 0 10px rgba(255,255,255,.18))}
    .ex-salle .val{font:900 20px ui-monospace,monospace}
    .ex-salle .nom{font-size:10px;text-align:center;line-height:1.15}
    .ex-salle.t{border-color:rgba(34,211,238,.45)}.ex-salle.t .val{color:#67e8f9}
    .ex-salle.h{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 30%,#1e1b2e),#140c14);border-color:var(--c)}
    .ex-salle.h.eteint{filter:grayscale(.8);border-style:dashed}
    .ex-salle.a{background:linear-gradient(180deg,#3b2a0a,#1a1205);border-color:#f59e0b}.ex-salle.a .val{color:#fbbf24}
    .ex-salle.a.pris{opacity:.45}
    .ex-salle.o{border-color:#a78bfa;background:linear-gradient(180deg,#2e1065,#0f0a1f)}
    .ex-salle.photo{background-size:cover;background-position:center;text-shadow:0 1px 6px #000}
    .ex-salle.photo::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(2,6,23,.15),rgba(2,6,23,.78));z-index:1}
    .ex-salle.photo>*{position:relative;z-index:2}
    .ex-salle.photo>.vign{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:0;pointer-events:none}
    .ex-sol{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;min-height:10px;max-width:86px}
    .ex-sol i{width:7px;height:7px;transform:rotate(45deg);background:#22d3ee;box-shadow:0 0 6px #22d3ee}
    .ex-stage{position:relative;height:clamp(210px,34vh,300px);border-radius:16px;overflow:hidden;border:1px solid rgba(148,163,184,.22);background:#05080f}
    .ex-stage-t{position:absolute;left:10px;top:8px;z-index:3;font:800 9px ui-monospace,monospace;letter-spacing:.2em;color:#94a3b8;pointer-events:none;display:flex;gap:6px;align-items:center}
    .ex-stage-t i{width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:exLed 1.2s infinite}
    .ex-stage::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.55));z-index:2}
    .ex-cartes{display:grid;grid-template-columns:repeat(var(--nc,2),minmax(0,1fr));gap:10px}
    .ex-carte{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;border-radius:14px;border:1px solid var(--c);background:linear-gradient(180deg,rgba(8,47,73,.45),rgba(15,23,42,.92));padding:22px 6px 8px;min-height:200px;overflow:hidden;transition:background .6s,border-color .6s,transform .2s}
    .ex-pc .ex-carte{min-height:0}
    .ex-carte.vaisseau{background:linear-gradient(180deg,rgba(120,53,15,.42),rgba(15,23,42,.92))}
    .ex-carte.mort{background:linear-gradient(180deg,rgba(127,29,29,.6),rgba(15,23,42,.92));border-color:#ef4444}
    .ex-carte.moi{box-shadow:inset 0 0 0 1px var(--c),0 0 18px color-mix(in srgb,var(--c) 35%,transparent)}
    .ex-carte .etat{position:absolute;left:9px;top:6px;font:800 9px ui-monospace,monospace;letter-spacing:.14em;color:var(--c);white-space:nowrap}
    .ex-carte.vaisseau .etat{color:#fdba74}.ex-carte.mort .etat{color:#fca5a5}
    .ex-carte .obj{position:absolute;right:7px;top:4px;font-size:13px;letter-spacing:1px}
    .ex-carte .fig{flex:1 1 auto;min-height:0;width:100%;display:block}
    .ex-carte .repli{flex:1 1 auto;display:flex;align-items:center;justify-content:center}
    .a3d .ex-carte .repli{display:none}.ex-carte .fig{display:none}.a3d .ex-carte .fig{display:block}
    .ex-carte .socle{width:70%;height:12px;margin-top:-9px;border-radius:50%;background:radial-gradient(ellipse at center,var(--c),transparent 70%);opacity:.55;flex:0 0 auto}
    .ex-carte .nom{font-weight:800;font-size:14px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
    .ex-carte .val{font:800 12px ui-monospace,monospace;color:#67e8f9}.ex-carte .val.c{color:#fbbf24}.ex-carte .val.x{color:#64748b}
    .ex-carte .equip{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:6px;flex:0 0 auto}
    .ex-carte .equip:empty{display:none}
    .ex-tuile{position:relative;width:46px;height:46px;border-radius:10px;border:1px solid #334155;background:rgba(2,6,23,.72);padding:0;cursor:help;color:#fff}
    .ex-tuile canvas{position:absolute;inset:0;width:100%;height:100%;display:none}
    .a3d .ex-tuile canvas{display:block}.a3d .ex-tuile .em{display:none}
    .ex-tuile .em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px}
    .ex-tuile small{position:absolute;right:3px;bottom:1px;font:800 9px ui-monospace,monospace;color:#e2e8f0;z-index:1}
    .ex-tuile.actif{border-color:#22d3ee;cursor:pointer;animation:exObj 1.3s infinite}
    .ex-tuile.arme{border-color:#f43f5e;background:#4c0519;box-shadow:0 0 12px #f43f5e;cursor:pointer}
    .ex-tuile[aria-disabled]{cursor:help}
    #ex-aide{position:fixed;z-index:10000;max-width:270px;padding:8px 11px;border-radius:10px;background:rgba(2,6,23,.96);border:1px solid #a78bfa;color:#e2e8f0;font:13px/1.4 system-ui,sans-serif;pointer-events:none;display:none;box-shadow:0 10px 28px rgba(0,0,0,.55)}
    #ex-aide b{color:#fff}
    .ex-enchere{margin-top:8px;padding:9px 11px;border-radius:12px;border:1px solid #a78bfa;background:linear-gradient(90deg,rgba(46,16,101,.55),rgba(15,23,42,.85))}
    .ex-enchere .t{font:800 10px ui-monospace,monospace;letter-spacing:.16em;color:#c4b5fd;margin-bottom:6px}
    .ex-enchere .ligne{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .ex-enchere .pm{width:34px;height:34px;border-radius:9px;border:1px solid #7c3aed;background:#1e1b4b;color:#fff;font-weight:900;font-size:18px;cursor:pointer}
    .ex-enchere .n{min-width:34px;text-align:center;font:900 22px ui-monospace,monospace;color:#fde68a}
    .ex-enchere .src{display:flex;border-radius:9px;overflow:hidden;border:1px solid #475569}
    .ex-enchere .src button{padding:7px 10px;background:#0f172a;color:#cbd5e1;border:0;font-size:12px;font-weight:700;cursor:pointer}
    .ex-enchere .src button.sel{background:#7c3aed;color:#fff}
    .ex-enchere .ok{margin-left:auto;padding:8px 16px;border-radius:9px;border:1px solid #fbbf24;background:#78350f;color:#fde68a;font-weight:900;letter-spacing:.06em;cursor:pointer}
    .ex-enchere .p{margin-top:6px;font-size:11px;color:#cbd5e1}
    .ex-carte .choix{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font:900 13px ui-monospace,monospace;letter-spacing:.12em;padding:6px 10px;border-radius:10px;background:rgba(2,6,23,.85);border:1px solid currentColor;animation:exCarte .6s ease both;white-space:nowrap}
    .ex-recoit{animation:exRecoit .45s ease}
    @keyframes exRecoit{40%{transform:scale(1.05);filter:brightness(1.5)}}
    .ex-gemme{position:fixed;z-index:9999;width:13px;height:13px;margin:-6px 0 0 -6px;background:var(--g,#22d3ee);box-shadow:0 0 14px var(--g,#22d3ee);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);pointer-events:none}
    .ex-eq{border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.78);padding:7px 10px;display:flex;flex-direction:column;gap:5px;flex:0 0 auto}
    .ex-eq .ligne{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:26px}
    .ex-eq .lt{font:800 9px ui-monospace,monospace;letter-spacing:.14em;color:#94a3b8;min-width:96px;flex:0 0 auto;white-space:nowrap}
    .ex-p{display:inline-flex;align-items:center;gap:5px;padding:2px 8px 2px 2px;border-radius:999px;background:#0b1222;border:1px solid #1e293b;font-size:11px;max-width:100%}
    .ex-p.moi{border-color:#22d3ee;box-shadow:0 0 8px rgba(34,211,238,.35)}
    .ex-p b{max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ex-p .s{font:800 10px ui-monospace,monospace;color:#67e8f9}.ex-p .s.c{color:#fbbf24}.ex-p .s.x{color:#64748b}
    .ex-p .e{font-size:12px}
    .ex-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .ex-btn{position:relative;padding:12px 16px;min-height:72px;font:800 17px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;cursor:pointer;border:0;color:var(--t);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:transform .1s, filter .2s, opacity .2s;isolation:isolate;background:transparent}
    .ex-btn::before{content:'';position:absolute;inset:0;background:var(--b);z-index:-1}
    .ex-btn::after{content:'';position:absolute;inset:2px;background:var(--f);z-index:-1}
    .ex-btn,.ex-btn::before,.ex-btn::after{clip-path:var(--cp)}
    .ex-btn small{font:600 11px system-ui,sans-serif;opacity:.85;letter-spacing:.02em;color:var(--t)}
    .ex-btn .ex-led{position:absolute;top:9px;width:7px;height:7px;border-radius:50%;background:var(--b);box-shadow:0 0 8px var(--b);animation:exLed 1.4s infinite}
    .ex-btn.go .ex-led{left:14%}.ex-btn.back .ex-led{right:14%}
    @keyframes exLed{50%{opacity:.25}}
    .ex-btn .ex-rayure{position:absolute;inset:2px;z-index:-1;clip-path:var(--cp);background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 2px,transparent 2px 4px)}
    .ex-btn:hover{filter:drop-shadow(0 0 10px var(--b));transform:translateY(-1px)}.ex-btn:active{transform:scale(.97)}
    .ex-btn.go{--b:#34d399;--f:#0b2a1e;--t:#6ee7b7;--cp:polygon(7% 0,100% 0,100% 72%,93% 100%,0 100%,0 28%)}
    .ex-btn.back{--b:#fb923c;--f:#33180a;--t:#fdba74;--cp:polygon(0 0,93% 0,100% 28%,100% 100%,7% 100%,0 72%)}
    .ex-btn.sel{--f:var(--b);--t:#0b1020;filter:drop-shadow(0 0 14px var(--b))}
    .ex-btn.sel small{color:#0b1020}
    .ex-btn.sel .ex-led{background:#0b1020;box-shadow:none;animation:none}
    .ex-btn.off{opacity:.3;filter:grayscale(.6)}
    .ex-img-go .ex-btn.go,.ex-img-back .ex-btn.back{--cp:none;background:var(--img) center/100% 100% no-repeat;text-shadow:0 2px 6px #000;--t:#fff;aspect-ratio:900/345;min-height:0!important;height:auto;padding:4% 9% 4% 14%;filter:none}
    .ex-img-go .ex-btn.go:hover,.ex-img-back .ex-btn.back:hover{filter:brightness(1.15)}.ex-img-go .ex-btn.go.off,.ex-img-back .ex-btn.back.off{filter:grayscale(.7) brightness(.7);opacity:.6}
    .ex-img-go .ex-btn.go .ex-led,.ex-img-back .ex-btn.back .ex-led{display:none}
    .ex-img-go .ex-btn.go.sel,.ex-img-back .ex-btn.back.sel{filter:drop-shadow(0 0 12px var(--b))}
    .ex-img-go .ex-btn.go{--img:var(--bouton-continuer)}.ex-img-back .ex-btn.back{--img:var(--bouton-rentrer)}
    .ex-img-go .ex-btn.go.sel{--img:var(--bouton-continuer-actif,var(--bouton-continuer));--t:#fff}
    .ex-img-back .ex-btn.back.sel{--img:var(--bouton-rentrer-actif,var(--bouton-rentrer));--t:#fff}
    .ex-img-go .ex-btn.go.sel small,.ex-img-back .ex-btn.back.sel small{color:#fff}
    .ex-img-go .ex-btn.go::before,.ex-img-go .ex-btn.go::after,.ex-img-go .ex-btn.go .ex-rayure,.ex-img-back .ex-btn.back::before,.ex-img-back .ex-btn.back::after,.ex-img-back .ex-btn.back .ex-rayure{display:none}
    .ex-info{text-align:center;padding:11px;border-radius:14px;background:rgba(15,23,42,.82);border:1px solid #334155;font-size:14px}
    .ex-bilan{display:grid;gap:4px}
    .ex-bilan div{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 10px;border-radius:10px;background:#0f172a;border:1px solid #1e293b;font-size:13px;animation:exArrive .5s ease both}
    .ex-panneau{border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.82);padding:9px 10px}
    .ex-ptitre{font:800 10px ui-monospace,monospace;letter-spacing:.2em;color:#94a3b8;margin-bottom:6px;display:flex;justify-content:space-between;gap:6px}
    .ex-moi{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:14px;background:linear-gradient(90deg,rgba(120,53,15,.45),rgba(15,23,42,.75));border:1px solid rgba(245,158,11,.45);flex:0 0 auto}
    .ex-moi:empty{display:none}
    #ex-mon-objet{position:relative;width:58px;height:58px;flex:0 0 auto}
    .ex-moi .txt{flex:1;min-width:0;font-size:11px;color:#cbd5e1}.ex-moi .txt b{font-size:13px;color:#fde68a;display:block}
    .ex-scan{margin-top:4px;padding:4px 8px;border-radius:8px;font-size:12px;background:rgba(2,6,23,.6);border:1px solid #334155;animation:exArrive .4s ease both}
    .ex-inv{display:flex;gap:6px}
    .ex-obj{position:relative;width:46px;height:46px;border-radius:10px;border:1px solid #475569;background:#0f172a;font-size:21px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;transition:transform .1s}
    .ex-obj:active{transform:scale(.94)}
    .ex-obj small{position:absolute;bottom:1px;right:4px;font:800 9px ui-monospace,monospace;color:#e2e8f0}
    .ex-obj.actif{border-color:#22d3ee;animation:exObj 1.3s infinite}
    @keyframes exObj{50%{box-shadow:0 0 14px rgba(34,211,238,.7)}}
    .ex-obj.arme{border-color:#f43f5e;background:#4c0519;box-shadow:0 0 14px #f43f5e;animation:none}
    .ex-obj.passif,.ex-obj[disabled]{cursor:default}.ex-obj[disabled]{opacity:.5}
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
    if (!exC.ticker) exC.ticker = setInterval(exBoucle, 120);
};

function exConstruire(g) {
    exC.sess = g.startedAt; exC.fini = ''; exC.cleSalle = ''; exC.clePhase = ''; exC.nbSalles = 0; exC.vusAvant = ''; exC.compte = -1; exC.scan = null;
    if (typeof showScreen === 'function') showScreen('screen-generic-game');
    const ecran = document.getElementById('screen-generic-game'); if (ecran) ecran.classList.add('ex-large');
    const t = document.getElementById('generic-game-title'); if (t) t.innerText = '🛰️ Expédition sur l’épave';
    const zone = document.getElementById('generic-game-content'); if (!zone) return;
    zone.innerHTML = `
    <div id="ex-root">
        <div class="ex-barre">
            <div class="ex-b-g"><div class="ex-titre" id="ex-titre"></div><div class="ex-sous" id="ex-sous"></div></div>
            <div class="ex-effet" id="ex-effet"></div>
            <div class="ex-risque" id="ex-risque"></div>
            <div class="ex-dangers" id="ex-dangers"></div>
            <div class="ex-chrono" id="ex-chrono"></div>
        </div>
        <div class="ex-progres"><i id="ex-temps" style="width:0%"></i></div>
        <div class="ex-corps">
            <div class="ex-gauche">
                <div class="ex-vue" id="ex-scene">
                    <video id="ex-vid-flou" muted playsinline preload="auto"></video>
                    <video id="ex-vid" muted playsinline preload="auto"></video>
                    <div id="ex-lampe"></div>
                    <div class="ex-vue-bas"></div>
                    <div id="ex-porte"><div class="v g"></div><div class="v d"></div><div class="plaque" id="ex-plaque"></div></div>
                    <div id="ex-legende"></div>
                    <div id="ex-obj3d"></div>
                    <div id="ex-voile"></div>
                </div>
            </div>
            <div class="ex-droite">
                <div class="ex-cartes" id="ex-cartes"></div>
                <div class="ex-bande"><div class="ex-couloir" id="ex-couloir"></div></div>
                <div class="ex-bas">
                    <div id="ex-zone-action"></div>
                    <div class="ex-moi" id="ex-moi"></div>
                </div>
            </div>
        </div>
    </div>`;
    exImagesBoutons();
    exAideInit();
    exAjuster();
    if (!exC.redim) { exC.redim = true; window.addEventListener('resize', exAjuster); }
    exMedias3D();
}
// sur PC : tout tient dans l'écran
function exAjuster() {
    const root = document.getElementById('ex-root'); if (!root) return;
    const pc = window.innerWidth >= 1000 && window.innerHeight >= 560;
    root.classList.toggle('ex-pc', pc);
    if (pc) {
        const ecran = document.getElementById('screen-generic-game'); if (ecran && ecran.scrollTop) ecran.scrollTop = 0;
        const h = Math.max(540, Math.floor(window.innerHeight - root.getBoundingClientRect().top - 14));
        if (root._h !== h) { root._h = h; root.style.height = h + 'px'; }
    } else if (root._h) { root._h = 0; root.style.height = ''; }
}
// visuels des boutons (expedition-web/interface/) : utilisés s'ils existent
function exImagesBoutons() {
    const root = document.getElementById('ex-root'); if (!root) return;
    [['bouton-continuer', 'ex-img-go'], ['bouton-rentrer', 'ex-img-back'], ['bouton-continuer-actif'], ['bouton-rentrer-actif']].forEach(([n, cl]) => {
        const im = new Image(), url = EX_MEDIA + 'interface/' + n + '.webp';
        im.onload = () => { root.style.setProperty('--' + n, `url("${url}")`); if (cl) root.classList.add(cl); };
        im.src = url;
    });
}
// ---- 3D : scène de l'équipage + vitrines (chargées à la demande, facultatives)
function exDetruire3D() {
    ['equipe', 'vignettes', 'vitrine', 'moi'].forEach(k => { if (exC[k]) { try { exC[k].detruire(); } catch (e) {} exC[k] = null; } });
    exC.vitrineNom = ''; exC.moiNom = '';
}
function exMedias3D() {
    exDetruire3D();
    if (!window.EX3D) return;
    window.EX3D.charger().then(ok => {
        if (!ok || !document.getElementById('ex-root')) return;
        if (!exC.equipe) exC.equipe = window.EX3D.equipe();
        if (!exC.vignettes) exC.vignettes = window.EX3D.vignettes();
        const root = document.getElementById('ex-root'); if (root && exC.equipe) root.classList.add('a3d');
        const d = window.currentRoom; if (d && d.exGame) exMaj(d, d.exGame, true);
    });
}

// fichier vidéo de la salle (le même pour tous : tiré de la graine de la partie)
function exHash(t) { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
function exClipSalle(g, s, catastrophe) {
    if (!s) return '';
    if (s.k === 'h') return 'danger/danger-' + s.h + '-' + (catastrophe ? 'b' : 'a');
    if (s.k === 'a') return 'reliques/' + EX_CLIP_RELIQUE[(s.id || 0) % 4];
    if (s.k === 'o' && EX_SALLES_OBJETS.indexOf(s.o) >= 0) return 'equipement/equipement-' + s.o;
    return 'cristaux/cristaux-' + String(exHash(g.startedAt + ':' + g.expe + ':' + s.n) % 12 + 1).padStart(2, '0');
}
const EX_MODELE_RELIQUE = ['relique-statuette', 'relique-orbe', 'relique-masque', 'relique-monolithe'];
const EX_CLIP_RELIQUE = ['relique-statue', 'relique-orbe', 'relique-mask', 'relique-monolithe'];
function exModeleSalle(s) {
    if (!s) return '';
    if (s.k === 't') return s.v >= 13 ? 'cristaux-geode' : s.v >= 6 ? 'cristal-grappe' : 'cristal';
    if (s.k === 'a') return EX_MODELE_RELIQUE[(s.id || 0) % 4];
    if (s.k === 'o') return 'objet-' + s.o;
    return '';
}
function exCouleurSalle(s) { return !s ? '#67e8f9' : s.k === 'h' ? (s.eteint ? '#94a3b8' : (EX_DANGERS[s.h] || {}).c) : s.k === 'a' ? '#fbbf24' : s.k === 'o' ? '#a78bfa' : '#67e8f9'; }
function exPhoto(g, s) { return exClipSalle(g, s, false) ? ` photo"${s.k === 'h' ? ' style="--c:' + (EX_DANGERS[s.h] || {}).c + '"' : ''}` : ''; }
// vignette : une image tirée de la vidéo de la salle (pas de fichier en plus)
function exVignette(g, s) { const c = exClipSalle(g, s, false); return c ? `<video class="vign" muted playsinline preload="metadata" src="${encodeURI(EX_MEDIA + c + '.mp4')}#t=4"></video>` : ''; }
function exSalleHTML(s, neuve, g, noir) { return exSalleHTML0(s, neuve, g, noir).replace(/^(<div[^>]*>)/, '$1' + exVignette(g, s)); }
function exSalleHTML0(s, neuve, g, noir) {
    const cl = (k) => `ex-salle ${k}${neuve ? ' neuve' : ''}${exPhoto(g, s)}`;
    if (s.k === 't') return `<div class="${cl('t')}"><span class="num">SALLE ${s.n}</span><span class="ic">💎</span><span class="val">${noir ? '?' : s.v}</span>
        <span class="nom">${noir ? 'dans le noir' : s.part ? s.part + ' chacun' : 'personne'}</span><div class="ex-sol" title="Cristaux restés au sol">${noir ? '' : '<i></i>'.repeat(Math.min(s.r || 0, 14))}</div></div>`;
    if (s.k === 'h') { const D = EX_DANGERS[s.h] || {};
        return `<div class="${cl('h' + (s.eteint ? ' eteint' : ''))}"><span class="num">SALLE ${s.n}</span><span class="ic">${s.eteint ? (EX_OBJETS[s.prot || 'extincteur'] || {}).i : D.i}</span><span class="nom" style="color:${D.c};font-weight:800">${exEsc(D.n)}</span><span class="nom" style="color:#cbd5e1">${s.eteint ? 'neutralisé' : 'danger'}</span></div>`; }
    if (s.k === 'o') { const O = EX_OBJETS[s.o] || {};
        return `<div class="${cl('o')}" data-aide="${exAideObjet(s.o)}"><span class="num">SALLE ${s.n}</span><span class="ic">${O.i}</span><span class="nom" style="color:#ddd6fe;font-weight:800">${exEsc(O.n)}</span><span class="nom" style="color:#cbd5e1">${s.qui ? '→ ' + exEsc(s.qui) : s.qui === '' ? 'abandonné' : '🔨 enchère'}</span></div>`; }
    return `<div class="${cl('a' + (s.pris ? ' pris' : ''))}"><span class="num">SALLE ${s.n}</span><span class="ic">🗿</span><span class="val">${s.v}</span><span class="nom" style="color:#fde68a">${s.pris ? 'emportée' : 'relique alien'}</span></div>`;
}

// ---- ce que voient les joueurs à cet instant : la salle n'est révélée qu'après l'ouverture du sas,
//      et les choix ne sont dévoilés qu'après le compte à rebours
function exEtatVue(g) {
    const t = exEcoule(g); let phase = g.phase;
    let chemin = exArr(g.chemin), dedans = exDedans(g), paquet = exArr(g.paquet);
    const sac = Object.assign({}, g.sac || {}), coffre = Object.assign({}, g.coffre || {}), vus = Object.assign({}, g.vus || {});
    let objets = g.objets || {};
    if ((g.phase === 'SALLE' || g.phase === 'DESASTRE') && t < EX.REVELE && chemin.length) {
        phase = 'PORTE';
        const der = chemin[chemin.length - 1];
        chemin = chemin.slice(0, -1); paquet = [der].concat(paquet);
        if (der.k === 'h' && !der.eteint) vus[der.h] = Math.max(0, (vus[der.h] || 0) - 1);
        if (g.phase === 'DESASTRE' && g.desastre) { const p = g.desastre.pertes || {}, sv = g.desastre.sauves || {}; dedans = Object.keys(p); dedans.forEach(n => { sac[n] = p[n] + (sv[n] || 0); coffre[n] = (coffre[n] || 0) - (sv[n] || 0); }); }
        if (der.k === 't' && der.part) dedans.forEach(n => sac[n] = Math.max(0, (sac[n] || 0) - der.part));
        if (der.k === 'o' && der.qui) { objets = JSON.parse(JSON.stringify(objets)); objets[der.qui] = objets[der.qui] || {}; objets[der.qui][der.o] = Math.max(0, (objets[der.qui][der.o] || 0) - 1); }
    } else if (g.phase === 'DECISION' && t < EX.COMPTE) {
        phase = 'COMPTE';
        const av = (g.dec || {}).avant;
        if (av) {
            dedans = exArr(av.dedans); Object.assign(sac, av.sac || {}); Object.assign(coffre, av.coffre || {});
            const sol = exArr(av.sol); chemin = chemin.map((s, i) => sol[i] ? Object.assign({}, s, { r: sol[i][0], pris: sol[i][1] }) : s);
        }
        const en = (g.dec || {}).enchere;
        if (en) {
            chemin = chemin.map((s, i) => i === chemin.length - 1 && s.k === 'o' ? Object.assign({}, s, { qui: null }) : s);
            if (en.qui) { objets = JSON.parse(JSON.stringify(objets)); objets[en.qui][en.o] = Math.max(0, (objets[en.qui][en.o] || 1) - 1); }
        }
    }
    const fatal = paquet.filter(c => c.k === 'h' && vus[c.h]).length;
    return { phase: phase, t: t, chemin: chemin, dedans: dedans, sac: sac, coffre: coffre, vus: vus, objets: objets, paquetN: paquet.length,
        risque: paquet.length ? fatal / paquet.length : 0, noir: !!exEffet(g).noir && !(((g.objets || {})[exMe()] || {}).lunette > 0), silence: !!exEffet(g).silence };
}

function exMaj(data, g, force) {
    const me = exMe(), E = exEtatVue(g), chemin = E.chemin, dedans = E.dedans, joueurs = exArr(g.joueurs);
    const salleN = chemin.length, clePhase = g.expe + ':' + exArr(g.chemin).length + ':' + E.phase, nouvellePhase = exC.clePhase !== clePhase || force;
    const der = chemin[salleN - 1], Ef = exEffet(g), root = document.getElementById('ex-root');
    // ---- barre du haut
    const titre = document.getElementById('ex-titre'); if (titre) titre.textContent = `EXPÉDITION ${g.expe}/${g.nb} · ${String(g.epave || '').toUpperCase()}`;
    const sous = document.getElementById('ex-sous');
    if (sous) sous.textContent = { DEPART: 'L’équipage s’amarre à l’épave…', PORTE: 'Ouverture du sas…', CHOIX: `Salle ${salleN} : continuer ou rentrer ?`, COMPTE: 'Choix verrouillés…', BILAN: 'Retour au vaisseau : bilan de l’expédition', DESASTRE: 'ÉVACUATION !' }[E.phase] || `Salle ${salleN} explorée`;
    exHTML(document.getElementById('ex-effet'), Ef.t ? `<span class="i">${Ef.i}</span><span><b>${exEsc(Ef.t.toUpperCase())}</b>${exEsc(Ef.d)}</span>` : '');
    const rq = document.getElementById('ex-risque');
    if (rq) { const pc = Math.round(E.risque * 100), col = pc >= 30 ? '#f43f5e' : pc >= 15 ? '#fb923c' : pc > 0 ? '#facc15' : '#34d399';
        exHTML(rq, `<div class="l"><span>RISQUE D’ÉVACUATION</span><b>${E.noir ? '??' : pc + ' %'}</b></div><div class="j"><i style="width:${E.noir ? 100 : Math.max(3, pc)}%;background:${E.noir ? 'repeating-linear-gradient(90deg,#334155 0 6px,#1e293b 6px 12px)' : col}"></i></div>`); }
    const dg = document.getElementById('ex-dangers');
    if (dg) {
        const vusCle = Object.keys(E.vus).filter(h => E.vus[h]).sort().join(',');
        const casse = exC.vusAvant !== '' && exC.vusAvant !== vusCle && exC.vusAvant.split(',').length < vusCle.split(',').length ? vusCle.split(',').filter(h => exC.vusAvant.split(',').indexOf(h) < 0) : [];
        const paquet = exArr(g.paquet);
        exHTML(dg, Object.keys(EX_DANGERS).map(h => { const D = EX_DANGERS[h], n = paquet.filter(c => c.k === 'h' && c.h === h).length + (E.phase === 'PORTE' && exArr(g.chemin).slice(-1).some(c => c.k === 'h' && c.h === h) ? 1 : 0);
            return `<span class="ex-dg${E.vus[h] ? ' vu' : ''}${n <= 0 ? ' out' : ''}${casse.indexOf(h) >= 0 ? ' casse' : ''}" style="--c:${D.c}" title="${exEsc(D.n)} : ${n} carte(s) encore dans l’épave${E.vus[h] ? ' — déjà sorti : le prochain déclenche l’évacuation !' : ''}">${D.i}<small>${n}</small></span>`; }).join(''));
        exC.vusAvant = vusCle;
    }
    // ---- couloir des salles
    const couloir = document.getElementById('ex-couloir');
    if (couloir) {
        const cle = g.expe + ':' + E.noir + ':' + chemin.map(s => s.k + (s.r || 0) + (s.pris ? 'p' : '')).join(',');
        if (exC.cleSalle !== cle) {
            const nouvelle = salleN > (exC.nbSalles || 0) && exC.cleSalle.split(':')[0] === String(g.expe);
            const restant = E.paquetN;
            couloir.innerHTML = `<div class="ex-vaisseau"><span style="font-size:28px">🚀</span><span style="font:800 9px ui-monospace,monospace;letter-spacing:.14em;color:#67e8f9">SAS</span>
                <span style="font-size:10px;color:#94a3b8;text-align:center">${restant} salle${restant > 1 ? 's' : ''} inexplorée${restant > 1 ? 's' : ''}</span></div>`
                + chemin.map((s, i) => exSalleHTML(s, nouvelle && i === salleN - 1, g, E.noir)).join('')
                + (g.phase !== 'BILAN' && dedans.length ? `<div class="ex-salle" style="opacity:.55;border-style:dashed;justify-content:center"><span class="ic">${E.phase === 'PORTE' ? '🚪' : '❔'}</span><span class="nom" style="color:#94a3b8">${E.phase === 'PORTE' ? 'ouverture…' : 'salle suivante'}</span></div>` : '');
            couloir.scrollLeft = couloir.scrollWidth;
            if (nouvelle) exRevelation(g, E, chemin[salleN - 1], me);
            exC.cleSalle = cle; exC.nbSalles = salleN;
        }
    }
    // ---- voile : compte à rebours, révélation des choix, désastre
    const voile = document.getElementById('ex-voile');
    const dec = g.dec || {}, decR = exArr(dec.r), decC = exArr(dec.c);
    if (voile && nouvellePhase) {
        exC.compte = -1;
        if (E.phase === 'DESASTRE' && g.desastre) {
            const D = EX_DANGERS[g.desastre.h] || {}, p = g.desastre.pertes || {};
            const sv = g.desastre.sauves || {}, perdus = Object.keys(p).map(n => `${exEsc(n)} perd ${p[n]} 💎${sv[n] ? ` (🛡️ bouclier : ${sv[n]} 💎 sauvés)` : ''}`).join(' · ');
            voile.className = 'ex-voile desastre'; voile.style.setProperty('--c', D.c);
            voile.innerHTML = `<div class="gros">${D.i}</div><div class="msg" style="color:#fff">${exEsc(D.n).toUpperCase()} !</div><div style="color:#fecaca;font-weight:700">Évacuation d’urgence : les sacs restés à bord sont perdus.</div><div style="color:#fff;font-size:13px">${perdus || 'Personne n’était à bord.'}</div>`;
            const sc = document.getElementById('ex-scene'); if (sc) { sc.classList.remove('ex-secoue'); void sc.offsetWidth; sc.classList.add('ex-secoue'); }
            exSon('desastre');
        } else if (E.phase === 'COMPTE') { voile.className = 'ex-voile compte'; voile.innerHTML = ''; }
        else if (E.phase === 'DECISION') {
            const pers = (L, coul) => L.map((n, i) => `<div class="p" style="animation-delay:${i * .08}s">${exPastille(n, 34)}<span style="color:${coul}">${exEsc(n)}</span></div>`).join('') || '<span class="ex-sous">personne</span>';
            const ev = [];
            Object.keys(dec.rel || {}).forEach(n => ev.push(`🗿 <b>${exEsc(n)}</b> rentre seul et emporte la relique !`));
            exArr(dec.vols).forEach(v => ev.push(`🪝 <b>${exEsc(v.a)}</b> lance son grappin et vole ${v.n} 💎 à <b>${exEsc(v.de)}</b> !`));
            if (dec.enchere) {
                const en = dec.enchere, O = EX_OBJETS[en.o] || {};
                const offres = exArr(en.offres).map(o => `${exEsc(o.n)} ${o.k} ${o.src === 's' ? '🎒 (vaut ' + (o.k / EX_SAC_DIVISE) + ')' : '🔒'}`).join(' · ');
                ev.push(en.qui ? `🔨 Enchère ${O.i} ${exEsc(O.n)} : ${offres} → <b>${exEsc(en.qui)}</b> l’emporte pour ${en.k} 💎 de son ${en.src === 's' ? 'sac' : 'coffre'}${en.egalite ? ' (égalité tirée au sort)' : ''} !`
                    : `🔨 Personne n’a misé sur ${O.i} ${exEsc(O.n)} : il reste dans l’épave.`);
                if (en.qui) setTimeout(() => exSon('relique'), 500);
            }
            exArr(dec.bonus).forEach(b => ev.push(b.o === 'balise' ? `📍 <b>${exEsc(b.n)}</b> déclenche sa balise de rappel et rafle le sol !` : `⛏️ <b>${exEsc(b.n)}</b> fore ${b.k} 💎 de plus en partant.`));
            if (dec.alarme) { const D = EX_DANGERS[dec.alarme] || {}; ev.push(`<span style="color:#fca5a5">🚨 ALARME : la relique a réveillé l’épave. Un danger ${D.i} de plus rôde dans les salles suivantes !</span>`); }
            voile.className = 'ex-voile choix';
            voile.innerHTML = `<div class="ex-rev"><div><h4 style="color:#6ee7b7">🚀 CONTINUENT</h4><div class="pp">${pers(decC, '#6ee7b7')}</div></div>
                <div><h4 style="color:#fdba74">🏃 RENTRENT</h4><div class="pp">${pers(decR, '#fdba74')}</div></div>${ev.length ? `<div class="ev">${ev.join('<br>')}</div>` : ''}</div>`;
            exSon(decR.indexOf(me) >= 0 ? 'retour' : 'continuer');
            if (Object.keys(dec.rel || {}).length) setTimeout(() => exSon('relique'), 300);
            if (exArr(dec.vols).length) exFichier('ramasse', .7, 600).catch(() => {});
            if (dec.alarme) { exC.alarmeJusqua = Date.now() + 9000; exFichier('alarme', .8, 900).catch(() => exSonSynthese('danger')); if (root) { root.classList.remove('ex-tremble'); void root.offsetWidth; root.classList.add('ex-tremble'); } }
        } else { voile.className = ''; voile.innerHTML = ''; }
    }
    // ---- cartes d'équipage
    const ch = g.choix || {}, objets = E.objets;
    exCartes(g, E, me, decR, decC);
    // ---- zone d'action
    const za = document.getElementById('ex-zone-action');
    if (za) {
        const moiDedans = dedans.indexOf(me) >= 0, joueur = joueurs.indexOf(me) >= 0;
        if (E.phase === 'CHOIX' && moiDedans) {
            const mon = ch[me], restes = chemin.reduce((s, x) => s + (x.k === 't' ? x.r || 0 : 0), 0), rel = chemin.filter(x => x.k === 'a' && !x.pris).length;
            exHTML(za, `<div class="ex-actions">
                <button class="ex-btn go${mon === 'c' ? ' sel' : mon ? ' off' : ''}" onclick="exChoisir('c')"><span class="ex-rayure"></span><span class="ex-led"></span>CONTINUER<small>Sac en jeu : ${E.sac[me] || 0} 💎</small></button>
                <button class="ex-btn back${mon === 'r' ? ' sel' : mon ? ' off' : ''}" onclick="exChoisir('r')"><span class="ex-rayure"></span><span class="ex-led"></span>RENTRER<small>Au sol : ${E.noir ? '?' : restes} 💎${rel ? ` + ${rel} 🗿 (si seul)` : ''}</small></button></div>${exPanneauEnchere(g, E)}`);
        } else if (E.phase === 'CHOIX') {
            exHTML(za, `<div class="ex-info">${joueur ? '🚀 Vous êtes à l’abri. ' : '👀 '}Les explorateurs choisissent en secret…${E.silence ? ' <b>(silence radio)</b>' : ` <b>${Object.keys(ch).filter(n => dedans.indexOf(n) >= 0).length}/${dedans.length}</b> ont décidé.`}</div>`);
        } else if (E.phase === 'COMPTE') exHTML(za, `<div class="ex-info">🔒 Tous les choix sont verrouillés… révélation dans un instant !</div>`);
        else if (E.phase === 'DECISION') {
            exHTML(za, `<div class="ex-info">${decR.length ? `🏃 ${decR.map(exEsc).join(', ')} ${decR.length > 1 ? 'rentrent' : 'rentre'} au vaisseau` : 'Personne ne rentre'}. ${decC.length ? `🚀 ${decC.length} ${decC.length > 1 ? 'continuent' : 'continue'} l’exploration.` : 'L’épave est désertée.'}</div>`);
        } else if (E.phase === 'BILAN') {
            const gains = g.gainExpe || {};
            exHTML(za, `<div class="ex-panneau"><div class="ex-ptitre"><span>📦 BILAN · EXPÉDITION ${g.expe}</span><span>${g.expe < g.nb ? 'suivante dans un instant' : 'fin de la mission'}</span></div>
                <div class="ex-bilan">${joueurs.slice().sort((a, b) => (gains[b] || 0) - (gains[a] || 0)).map((n, i) => `<div style="animation-delay:${i * .08}s"><span style="display:flex;align-items:center;gap:8px">${exPastille(n, 22)}${exEsc(n)}</span><b style="color:${gains[n] ? '#67e8f9' : '#f87171'}">${gains[n] ? '+' + gains[n] + ' 💎 à l’abri' : 'rien rapporté'}</b></div>`).join('')}</div></div>`);
        } else if (E.phase === 'DESASTRE') exHTML(za, '');
        else if (E.phase === 'DEPART') exHTML(za, `<div class="ex-info">🛰️ Amarrage à <b>${exEsc(g.epave)}</b>${Ef.t ? ` · ${Ef.i} ${exEsc(Ef.t)}` : ''}</div>`);
        else if (E.phase === 'PORTE') exHTML(za, `<div class="ex-info">🚪 Ouverture du sas de la salle ${salleN + 1}…</div>`);
        else exHTML(za, moiDedans ? `<div class="ex-info">🔦 Vous explorez la salle ${salleN}…</div>` : `<div class="ex-info">📡 L’équipage explore la salle ${salleN}…</div>`);
    }
    // ---- moi : coffre, objets, scanner
    const mo = document.getElementById('ex-moi');
    if (mo) {
        if (joueurs.indexOf(me) < 0) exHTML(mo, '');
        else {
            const o = objets[me] || {}, choixOk = E.phase === 'CHOIX' && dedans.indexOf(me) >= 0, cleScan = g.expe + ':' + exArr(g.chemin).length;
            const scan = exC.scan && exC.scan.cle === cleScan ? exC.scan : null, arme = !!(g.grappin || {})[me];
            const boutons = [
                o.scanner > 0 ? `<button class="ex-obj${choixOk && !scan ? ' actif' : ''}" ${choixOk && !scan ? '' : 'disabled'} onclick="exScanner()" title="${EX_OBJETS.scanner.n} : ${EX_OBJETS.scanner.d}">📡<small>×${o.scanner}</small></button>` : '',
                o.grappin > 0 ? `<button class="ex-obj${arme ? ' arme' : choixOk ? ' actif' : ''}" ${choixOk ? '' : 'disabled'} onclick="exGrappin()" title="${EX_OBJETS.grappin.n} : ${EX_OBJETS.grappin.d}${arme ? ' (ARMÉ)' : ''}">🪝<small>×${o.grappin}</small></button>` : '',
                o.balise > 0 ? `<button class="ex-obj${(g.balise || {})[me] ? ' arme' : choixOk ? ' actif' : ''}" ${choixOk ? '' : 'disabled'} onclick="exBalise()" title="${EX_OBJETS.balise.n} : ${EX_OBJETS.balise.d}${(g.balise || {})[me] ? ' (ARMÉE)' : ''}">📍<small>×${o.balise}</small></button>` : '',
                o.drone > 0 ? `<button class="ex-obj${choixOk && !g.drone ? ' actif' : ''}" ${choixOk && !g.drone ? '' : 'disabled'} onclick="exDrone()" title="${EX_OBJETS.drone.n} : ${EX_OBJETS.drone.d}">🛸<small>×${o.drone}</small></button>` : '']
                .concat(['extincteur', 'scellant', 'combinaison', 'leurre', 'bouclier', 'foreuse', 'lunette'].map(k => o[k] > 0 ? `<span class="ex-obj passif" title="${EX_OBJETS[k].n} : ${EX_OBJETS[k].d}">${EX_OBJETS[k].i}<small>×${o[k]}</small></span>` : '')).join('');
            const txt = `<b>🔒 Mon coffre : ${E.coffre[me] || 0} 💎${(g.reliques || {})[me] ? ' · 🗿×' + g.reliques[me] : ''}</b>${arme ? '<span style="color:#fda4af">🪝 Grappin armé : continuez pour voler celui qui rentre.</span>' : (g.balise || {})[me] ? '<span style="color:#fda4af">📍 Balise armée : vous rentrez et raflez le sol.</span>' : boutons ? 'Vos objets sont sur votre carte : cliquez pour les utiliser, survolez pour l’aide.' : 'Les coffres des autres restent secrets.'}${scan ? `<div class="ex-scan" style="color:${scan.ok ? '#86efac' : '#fca5a5'}">📡 ${exEsc(scan.txt)}</div>` : ''}`;
            const h = `<div id="ex-mon-objet"></div><div class="txt">${txt}</div>`;
            // le modèle 3D du sac/coffre est dans #ex-mon-objet : on ne reconstruit que le texte et les objets
            if (!document.getElementById('ex-mon-objet') || !mo.contains(document.getElementById('ex-mon-objet'))) { mo.innerHTML = h; mo._h = ''; exC.moiNom = ''; if (exC.moi) { try { exC.moi.detruire(); } catch (e) {} exC.moi = null; } }
            exHTML(mo.querySelector('.txt'), txt);
        }
    }
    exMediasMaj(g, E, clePhase, nouvellePhase);
    exC.clePhase = clePhase;
}
// ---- aide au survol : tout élément portant data-aide (objets 3D, vitrine, salles) affiche son utilité
function exAideObjet(o) { const O = EX_OBJETS[o] || {}; return exEsc(`<b>${O.i || ''} ${exEsc(O.n || '')}</b><br>${exEsc(O.d || '')}`); }
function exAideInit() {
    if (exC.aideInit) return; exC.aideInit = true;
    const b = document.createElement('div'); b.id = 'ex-aide'; document.body.appendChild(b);
    const cacher = () => { b.style.display = 'none'; };
    document.addEventListener('mousemove', e => {
        const t = e.target && e.target.closest ? e.target.closest('[data-aide]') : null;
        if (!t || !document.getElementById('ex-root')) { cacher(); return; }
        const h = t.getAttribute('data-aide'); if (b._h !== h) { b._h = h; b.innerHTML = h; }
        b.style.display = 'block';
        const w = b.offsetWidth, hh = b.offsetHeight;
        b.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px';
        b.style.top = (e.clientY + 18 + hh > window.innerHeight ? e.clientY - hh - 12 : e.clientY + 18) + 'px';
    });
    document.addEventListener('scroll', cacher, true);
}
// ---- panneau de l'enchère secrète (salle d'équipement, pendant le choix)
function exPanneauEnchere(g, E) {
    const salle = exSalleEnVente(g); if (!salle) return '';
    const O = EX_OBJETS[salle.o] || {}, m = exMiseLocale(g), me = exMe(), envoyee = (g.mises || {})[me];
    const coffre = (g.coffre || {})[me] || 0, sac = (g.sac || {})[me] || 0, val = m.src === 's' ? m.n / EX_SAC_DIVISE : m.n;
    return `<div class="ex-enchere" data-aide="${exAideObjet(salle.o)}">
        <div class="t">🔨 ENCHÈRE SECRÈTE · ${O.i} ${exEsc(O.n).toUpperCase()}</div>
        <div class="ligne">
            <button class="pm" onclick="exMiseAjuste(-1)" aria-label="Moins">−</button><b class="n">${m.n}</b><button class="pm" onclick="exMiseAjuste(1)" aria-label="Plus">+</button>
            <div class="src"><button class="${m.src === 'c' ? 'sel' : ''}" onclick="exMiseSource('c')">🔒 Coffre · ${coffre}</button><button class="${m.src === 's' ? 'sel' : ''}" onclick="exMiseSource('s')">🎒 Sac · ${sac} <small>(×½)</small></button></div>
            <button class="ok" onclick="exMiser()">${m.n > 0 ? (envoyee ? 'Modifier' : 'Miser') : (envoyee ? 'Retirer' : 'Passer')}</button>
        </div>
        <div class="p">${envoyee ? `✅ Mise envoyée : ${envoyee.n} 💎 ${envoyee.src === 's' ? 'du sac' : 'du coffre'}. ` : 'Personne ne voit votre mise. '}Valeur d’enchère : <b>${val}</b>. Le sac ne vaut que la moitié (2 💎 = 1 point), mais vous videz des cristaux que vous risquez de perdre. Seul le gagnant paie.</div>
    </div>`;
}
// ---- cartes d'équipage : une carte par joueur, avec son astronaute 3D animé
function exCarteEl(n) { const r = document.getElementById('ex-cartes'); return r ? r.querySelector('.ex-carte[data-n="' + (window.CSS && CSS.escape ? CSS.escape(n) : n) + '"]') : null; }
function exCartes(g, E, me, decR, decC) {
    const zone = document.getElementById('ex-cartes'); if (!zone) return;
    const joueurs = exArr(g.joueurs), dedans = E.dedans, ch = g.choix || {}, objets = E.objets, n = joueurs.length;
    const cle = joueurs.join('|');
    if (zone._cle !== cle) {
        zone._cle = cle;
        zone.style.setProperty('--nc', n <= 4 ? Math.max(2, n) : n <= 6 ? 3 : n <= 8 ? 4 : 5);
        zone.innerHTML = joueurs.map(p => `<div class="ex-carte${p === me ? ' moi' : ''}" data-n="${exEsc(p)}" style="--c:${exCouleur(p)}">
            <span class="etat"></span><canvas class="fig"></canvas><div class="repli">${exPastille(p, 64)}</div><div class="socle"></div>
            <div class="nom">${exEsc(p)}</div><div class="val"></div><div class="equip"></div></div>`).join('');
    }
    const victimes = E.phase === 'DESASTRE' && g.desastre ? Object.keys(g.desastre.pertes || {}) : [];
    const gains = g.gainExpe || {}, liste = [];
    joueurs.forEach(p => {
        const el = exCarteEl(p); if (!el) return;
        const aBord = dedans.indexOf(p) >= 0, mort = victimes.indexOf(p) >= 0;
        let etat = aBord ? 'À BORD' : 'AU VAISSEAU', anim = 'attente', choix = '';
        if (mort) { etat = 'ÉVACUÉ'; anim = 'mort-' + g.desastre.h; }
        else if (E.phase === 'DEPART') anim = 'marche';
        else if (aBord && E.phase === 'CHOIX') etat += p === me ? (ch[p] ? (ch[p] === 'c' ? ' · 🚀' : ' · 🏃') : ' · ⏳') : E.silence ? ' · ❔' : ch[p] ? ' · ✅' : ' · ⏳';
        else if (aBord && E.phase === 'COMPTE') etat += ' · 🔒';
        else if (E.phase === 'DECISION' && decR.indexOf(p) >= 0) { anim = 'rentre'; choix = '<span class="choix" style="color:#fdba74">🏃 RENTRE</span>'; }
        else if (E.phase === 'DECISION' && decC.indexOf(p) >= 0) { anim = 'marche'; choix = '<span class="choix" style="color:#6ee7b7">🚀 CONTINUE</span>'; }
        else if (E.phase === 'BILAN' && gains[p] > 0) anim = 'joie';
        if (aBord && E.phase === 'SALLE') { const der = E.chemin[E.chemin.length - 1]; if (der && der.k === 'h' && !der.eteint) anim = 'peur'; }
        el.classList.toggle('vaisseau', !aBord && !mort); el.classList.toggle('mort', mort);
        exHTML(el.querySelector('.etat'), etat);
        exInventaire(el.querySelector('.equip'), g, E, p, me);
        const val = el.querySelector('.val');
        if (aBord) { val.className = 'val'; exHTML(val, '🎒 ' + (E.sac[p] || 0)); }
        else if (p === me) { val.className = 'val c'; exHTML(val, '🔒 ' + (E.coffre[p] || 0)); }
        else { val.className = 'val x'; exHTML(val, '🔒 coffre secret'); }
        let bulle = el.querySelector('.choix'); if (bulle && !choix) bulle.remove();
        if (choix && !bulle) el.insertAdjacentHTML('beforeend', choix);
        liste.push({ n: p, c: exCouleur(p), canvas: el.querySelector('.fig'), etat: anim });
    });
    if (exC.equipe) exC.equipe.maj(liste);
    if (exC.vignettes) exC.vignettes.maj(Array.from(zone.querySelectorAll('.ex-tuile canvas')).map(c => ({ canvas: c, nom: 'objet-' + c.dataset.o })));
}
// inventaire d'un joueur : ses objets en 3D ; sur sa propre carte, ceux qui s'utilisent sont des boutons
const EX_OBJETS_ACTIFS = { scanner: 'exScanner', grappin: 'exGrappin', balise: 'exBalise', drone: 'exDrone' };
function exInventaire(zone, g, E, p, me) {
    if (!zone) return;
    const o = (E.objets || {})[p] || {}, moi = p === me, choixOk = moi && E.phase === 'CHOIX' && E.dedans.indexOf(me) >= 0;
    const scanFait = exC.scan && exC.scan.cle === g.expe + ':' + exArr(g.chemin).length;
    const html = Object.keys(EX_OBJETS).filter(k => o[k] > 0).map(k => {
        const O = EX_OBJETS[k], fn = moi && EX_OBJETS_ACTIFS[k];
        const arme = (k === 'grappin' && (g.grappin || {})[me]) || (k === 'balise' && (g.balise || {})[me]);
        const dispo = fn && choixOk && !(k === 'scanner' && scanFait) && !(k === 'drone' && g.drone);
        const cl = arme ? ' arme' : dispo ? ' actif' : '';
        const attr = (dispo || arme) ? `onclick="${fn}()"` : 'aria-disabled="true"';
        const aide = exAideObjet(k) + (arme ? exEsc('<br><span style="color:#fda4af">● ARMÉ</span>') : dispo ? exEsc('<br><span style="color:#67e8f9">Cliquez pour l’utiliser.</span>') : '');
        return `<button class="ex-tuile${cl}" ${attr} data-aide="${aide}"><span class="em">${O.i}</span><canvas data-o="${k}"></canvas>${o[k] > 1 ? `<small>×${o[k]}</small>` : ''}</button>`;
    }).join('');
    // ne reconstruit que si quelque chose change (les cases 3D gardent leur canvas)
    if (zone._h !== html) { zone._h = html; zone.innerHTML = html; }
}
// cristaux qui volent en courbe d'un élément à un autre
function exVolGemmes(de, vers, n, coul) {
    if (!de || !vers || !n) return;
    const a = de.getBoundingClientRect(), b = vers.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height * .62, x1 = b.left + b.width / 2, y1 = b.top + b.height * .55;
    for (let i = 0; i < Math.min(n, 10); i++) {
        const e = document.createElement('i'); e.className = 'ex-gemme'; e.style.left = x0 + 'px'; e.style.top = y0 + 'px'; if (coul) e.style.setProperty('--g', coul);
        document.body.appendChild(e);
        const dx = x1 - x0 + (Math.random() - .5) * 40, dy = y1 - y0, h = -110 - Math.random() * 90;
        const an = e.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: `translate(${dx * .5}px,${dy * .5 + h}px) scale(1.3) rotate(180deg)`, opacity: 1, offset: .5 },
            { transform: `translate(${dx}px,${dy}px) scale(.6) rotate(360deg)`, opacity: .9 }], { duration: 950 + Math.random() * 300, delay: i * 85, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
        an.onfinish = () => { e.remove(); vers.classList.remove('ex-recoit'); void vers.offsetWidth; vers.classList.add('ex-recoit'); };
    }
}
// au moment où la salle est dévoilée (après l'ouverture du sas)
function exRevelation(g, E, s, me) {
    const root = document.getElementById('ex-root'), dedans = E.dedans, moiDedans = dedans.indexOf(me) >= 0;
    const menace = Object.keys(E.vus).some(h => E.vus[h]);
    if (s.k === 't') {
        exSon('gemmes');
        if (s.part) { const vue = document.getElementById('ex-scene'); dedans.forEach((n, i) => setTimeout(() => exVolGemmes(vue, exCarteEl(n), s.part), i * 120)); }
        if (s.part && moiDedans) exFichier('ramasse', .6, 900).then(() => exFichier('sac', .7, 250)).catch(() => {});
    } else if (s.k === 'h') {
        if (s.eteint) { exFichier('danger-' + s.h, .5).catch(() => {}); exFichier('sas-fermeture', .6, 900).catch(() => exSonSynthese('retour')); }
        else if (g.phase !== 'DESASTRE') {
            exFichier('danger-' + s.h, .9).catch(() => exSonSynthese('danger'));
            const sc = document.getElementById('ex-scene'); if (sc) { sc.style.setProperty('--c', (EX_DANGERS[s.h] || {}).c); sc.classList.remove('flash'); void sc.offsetWidth; sc.classList.add('flash'); }
        }
    } else if (s.k === 'a') exSon('relique');
    else if (s.k === 'o') exFichier('ramasse', .8).then(() => exFichier('sac', .7, 200)).catch(() => exSonSynthese('gemmes'));
    // l'écran tremble quand on est à un danger de l'évacuation
    if (menace && root && g.phase !== 'DESASTRE') { root.classList.remove('ex-tremble'); void root.offsetWidth; root.classList.add('ex-tremble'); }
}
// ---- vidéo de la vue principale (même source = pas de redémarrage)
function exVue(clip, large) {
    const v = document.getElementById('ex-vid'), f = document.getElementById('ex-vid-flou'), sc = document.getElementById('ex-scene');
    if (!v || !clip || exC.vue === clip) return; exC.vue = clip;
    if (sc) sc.classList.toggle('large', !!large);
    // vidéos d'origine en pleine qualité ; les salles (8-10 s) bouclent, les plans uniques non
    const src = encodeURI(EX_MEDIA + clip + '.mp4'), boucle = /^(cristaux|reliques|equipement)\/|danger-.*-a$|transition-couloir$/.test(clip);
    v.src = src; v.loop = boucle; v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => {});
    // fond flou seulement pour les vidéos horizontales (épaves, transitions)
    if (f) { if (large) { f.src = src; f.loop = boucle; const q = f.play(); if (q && q.catch) q.catch(() => {}); } else { f.removeAttribute('src'); f.load(); } }
}
function exVueSelonTemps(g, E) {
    const chemin = exArr(g.chemin), t = E.t, der = chemin[chemin.length - 1];
    if (g.phase === 'DEPART') exVue(t < 3.3 ? 'épaves/' + EX_FICHIERS_EPAVES[(g.epaveId || 0) % EX_FICHIERS_EPAVES.length] : 'bonus/transition-amarrage', true);
    else if (E.phase === 'PORTE') exVue(t < EX_PORTE.OUVRE ? 'bonus/transition-couloir' : exClipSalle(g, der, g.phase === 'DESASTRE'), false);
    else if (g.phase === 'DESASTRE') exVue(t < 3.4 + EX.REVELE ? exClipSalle(g, der, true) : 'bonus/transition-evacuation', t >= 3.4 + EX.REVELE);
    else if (g.phase === 'BILAN') exVue('bonus/transition-retour', true);
    else if (der) exVue(exClipSalle(g, der, false), false);
}
// porte du sas (vue + 3D), compte à rebours, chronomètre : animés par la boucle
function exAnimer(g, E) {
    const porte = document.getElementById('ex-porte'), sc = document.getElementById('ex-scene');
    if (porte) {
        const etat = E.phase !== 'PORTE' ? '' : E.t < EX_PORTE.FERME ? '' : E.t < EX_PORTE.OUVRE ? 'ferme' : 'ouvre';
        if (porte.className !== etat) {
            if (etat === 'ferme') { const pl = document.getElementById('ex-plaque'); if (pl) pl.textContent = 'SALLE ' + (E.chemin.length + 1); exFichier('pas', .5).catch(() => {}); }
            if (etat === 'ouvre') { exFichier('sas-ouverture', .85).catch(() => exSonSynthese('salle'));
                if (sc && !E.noir) { sc.classList.remove('lampe'); void sc.offsetWidth; sc.classList.add('lampe'); } }
            porte.className = etat;
        }
    }
    if (sc) sc.classList.toggle('noir', E.noir && ['PORTE', 'SALLE', 'CHOIX', 'COMPTE', 'DECISION'].indexOf(E.phase) >= 0);
    const der = E.chemin[E.chemin.length - 1];
    if (sc) sc.classList.toggle('eteint', !!(der && der.k === 'h' && der.eteint && ['SALLE', 'CHOIX', 'COMPTE', 'DECISION'].indexOf(E.phase) >= 0));
    // compte à rebours avant la révélation des choix
    const voile = document.getElementById('ex-voile');
    if (E.phase === 'COMPTE' && voile) {
        const n = Math.max(1, EX.COMPTE - Math.floor(E.t));
        if (exC.compte !== n) { exC.compte = n; voile.innerHTML = `<div class="chiffre">${n}</div><div class="msg" style="color:#cbd5e1;font-size:15px">RÉVÉLATION DES CHOIX</div>`; exSon('tic'); exFichier('tic', .7).catch(() => {}); }
    }
}
// ---- légende, vitrine 3D, scène de l'équipage, objet personnel, ambiance
function exMediasMaj(g, E, clePhase, nouvellePhase) {
    const chemin = E.chemin, der = chemin[chemin.length - 1], me = exMe(), dedans = E.dedans, joueurs = exArr(g.joueurs), dec = g.dec || {};
    exVueSelonTemps(g, E);
    exAnimer(g, E);
    // légende de la salle
    const lg = document.getElementById('ex-legende');
    if (lg) {
        let h = '';
        if (der && ['SALLE', 'CHOIX'].indexOf(E.phase) >= 0) {
            if (der.k === 't') h = E.noir ? `<div class="t">SALLE ${der.n} · DANS LE NOIR</div><div class="g">💎 Des cristaux…</div><div class="p">Impossible de les compter à la lampe. Votre sac : ${E.sac[me] || 0} 💎</div>`
                : `<div class="t">SALLE ${der.n}</div><div class="g">💎 ${der.v} cristaux</div><div class="p">${der.part ? der.part + ' pour chaque explorateur' : 'personne pour les ramasser'}${der.r ? ' · ' + der.r + ' restent au sol' : ''}</div>`;
            else if (der.k === 'h' && der.eteint) { const O = EX_OBJETS[der.prot || 'extincteur'] || {}, D = EX_DANGERS[der.h] || {}; h = `<div class="t">SALLE ${der.n} · DANGER MAÎTRISÉ</div><div class="g" style="color:#cbd5e1">${O.i} ${exEsc(D.n)} neutralisé</div><div class="p">${exEsc(der.eteint)} a utilisé son objet « ${exEsc(O.n)} » : ce danger ne compte pas.</div>`; }
            else if (der.k === 'h') { const D = EX_DANGERS[der.h] || {}; h = `<div class="t">SALLE ${der.n} · DANGER</div><div class="g" style="color:${D.c}">${D.i} ${exEsc(D.n)}</div><div class="p">${exEsc(D.d)} Encore un et c’est l’évacuation !</div>`; }
            else if (der.k === 'o') { const O = EX_OBJETS[der.o] || {}; h = `<div class="t">SALLE ${der.n} · ÉQUIPEMENT</div><div class="g" style="color:#c4b5fd">${O.i} ${exEsc(O.n)}</div><div class="p">${der.qui == null ? '🔨 Enchère secrète : misez pendant le choix pour l’obtenir.' : der.qui ? exEsc(der.qui) + ' l’a obtenu.' : 'Personne n’a misé : il reste dans l’épave.'} ${exEsc(O.d)}</div>`; }
            else h = `<div class="t">SALLE ${der.n}</div><div class="g" style="color:#fbbf24">🗿 Relique alien · ${der.v} pts</div><div class="p">Seul un explorateur qui rentre seul pourra l’emporter… et l’épave n’aime pas ça.</div>`;
            // le drone a montré la salle suivante à tout le monde
            if (g.drone && E.phase === 'CHOIX') {
                const d = g.drone, D = EX_DANGERS[d.h] || {}, O = EX_OBJETS[d.o] || {};
                const quoi = d.k === 'h' ? `${D.i} ${exEsc(D.n)}${(E.vus || {})[d.h] ? ' (fatal !)' : ''}` : d.k === 't' ? `💎 ${E.noir ? 'des' : d.v} cristaux` : d.k === 'a' ? '🗿 une relique' : d.k === 'o' ? `${O.i} ${exEsc(O.n)}` : 'plus rien';
                h += `<div class="p" style="margin-top:6px;padding:5px 9px;border-radius:8px;background:rgba(2,6,23,.75);border:1px solid #a78bfa;display:inline-block">🛸 Drone de ${exEsc(d.qui)} : salle suivante = <b>${quoi}</b></div>`;
            }
        } else if (E.phase === 'DEPART') { const Ef = exEffet(g); h = `<div class="t">EXPÉDITION ${g.expe}/${g.nb}</div><div class="g">${exEsc(g.epave)}</div><div class="p">${Ef.t ? Ef.i + ' ' + exEsc(Ef.t) + ' : ' + exEsc(Ef.d) : 'Approche et amarrage…'}</div>`; }
        exHTML(lg, h);
    }
    if (nouvellePhase && E.phase === 'DESASTRE' && g.desastre) {
        const sc = document.getElementById('ex-scene'); if (sc) { sc.style.setProperty('--c', (EX_DANGERS[g.desastre.h] || {}).c || '#f00'); sc.classList.remove('flash'); void sc.offsetWidth; sc.classList.add('flash'); }
        exFichier('danger-' + g.desastre.h, .9).catch(() => {});
    }
    if (!window.EX3D || !window.EX3D.pret) { exAmbianceMaj(g, E); return; }
    // vitrine : le cristal, la relique ou l'objet de la salle
    const o3 = document.getElementById('ex-obj3d'), mod = ['SALLE', 'CHOIX', 'COMPTE', 'DECISION'].indexOf(E.phase) >= 0 ? exModeleSalle(der) : '';
    if (o3) {
        const aide = mod && der.k === 'o' ? exAideObjet(der.o) : mod && der.k === 'a' ? exEsc(`<b>🗿 Relique alien · ${der.v} pts</b><br>Emportée seulement par un explorateur qui rentre seul. Elle déclenche l’alarme de l’épave.`) : '';
        if (aide) { o3.setAttribute('data-aide', aide); o3.style.pointerEvents = 'auto'; } else { o3.removeAttribute('data-aide'); o3.style.pointerEvents = 'none'; }
        if (!mod && exC.vitrine) { exC.vitrine.detruire(); exC.vitrine = null; exC.vitrineNom = ''; }
        else if (mod && exC.vitrineNom !== mod) {
            exC.vitrineNom = mod;
            if (!exC.vitrine) exC.vitrine = window.EX3D.objet(o3, mod, { hauteur: mod.indexOf('relique') === 0 ? 1.1 : .95 });
            else exC.vitrine.changer(mod);
            if (exC.vitrine) exC.vitrine.lueur(der.k === 'a' ? 0xfbbf24 : der.k === 'o' ? 0xa78bfa : mod === 'cristaux-geode' ? 0xa855f7 : 0x67e8f9);
        }
    }
    // cristaux qui volent à la révélation des choix : du couloir vers ceux qui rentrent, d'une carte à l'autre pour le grappin
    if (nouvellePhase && E.phase === 'DECISION') {
        const bande = document.getElementById('ex-couloir');
        Object.keys(dec.gains || {}).forEach((n, i) => { if (dec.gains[n] > 0) setTimeout(() => exVolGemmes(bande, exCarteEl(n), dec.gains[n]), 300 + i * 150); });
        exArr(dec.vols).forEach(x => setTimeout(() => exVolGemmes(exCarteEl(x.de), exCarteEl(x.a), x.n, '#f43f5e'), 1200));
    }
    // mon objet : sac pendant l'exploration, coffre (ouvert quand je dépose) au vaisseau
    const mo = document.getElementById('ex-mon-objet');
    if (mo && joueurs.indexOf(me) >= 0) {
        const depose = (E.phase === 'DECISION' && exArr(dec.r).indexOf(me) >= 0) || (E.phase === 'BILAN' && (g.gainExpe || {})[me] > 0);
        const n = dedans.indexOf(me) >= 0 ? ((E.sac[me] || 0) > 0 ? 'sac-ouvert' : 'sac-ferme') : depose ? 'coffre-ouvert' : 'coffre-ferme';
        if (exC.moiNom !== n) {
            if (!exC.moi) exC.moi = window.EX3D.objet(mo, n, { hauteur: .95, vitesse: .5, lueur: 0xfbbf24 }); else exC.moi.changer(n);
            exC.moiNom = n;
            if (n === 'coffre-ouvert' && nouvellePhase) exFichier('coffre', .8, 300).catch(() => {});
        }
    }
    exAmbianceMaj(g, E);
}
function exAmbianceMaj(g, E) {
    if (!g || g.status !== 'PLAYING') { exAmbianceStop(); return; }
    E = E || exEtatVue(g);
    const aBord = ['DEPART', 'PORTE', 'SALLE', 'CHOIX', 'COMPTE', 'DECISION', 'DESASTRE'].indexOf(E.phase) >= 0, menace = Object.keys(E.vus).some(h => E.vus[h]);
    const alarme = (exC.alarmeJusqua || 0) > Date.now();
    exAmbianceCible({ 'ambiance-epave': aBord ? .32 : 0, 'respiration': aBord && E.dedans.indexOf(exMe()) >= 0 ? (E.phase === 'COMPTE' ? .3 : .14) : 0,
        'tension': aBord && (menace || alarme || E.phase === 'COMPTE') ? (alarme || E.phase === 'COMPTE' ? .5 : .28) : 0, 'ambiance-vaisseau': g.phase === 'BILAN' ? .3 : 0 });
}

function exBoucle() {
    const data = window.currentRoom, g = data && data.exGame;
    if (!g || data.status !== 'IN_GAME' || data.selectedMode !== 'expedition') { exArreter(); return; }
    if (g.status !== 'PLAYING' || !document.getElementById('ex-root')) return;
    if (window.isHost) exHote();
    exAjuster();
    const E = exEtatVue(g);
    // passage d'une étape visuelle à l'autre (ouverture du sas, fin du compte à rebours)
    if (g.expe + ':' + exArr(g.chemin).length + ':' + E.phase !== exC.clePhase) { exMaj(data, g); return; }
    exVueSelonTemps(g, E); exAnimer(g, E); exAmbianceFondu();
    if (['SALLE', 'CHOIX'].indexOf(E.phase) >= 0 && Date.now() > exC.grince) { if (exC.grince) exFichier('grince-' + (1 + Math.floor(Math.random() * 3)), .35).catch(() => {}); exC.grince = Date.now() + 9000 + Math.random() * 14000; }
    const t = E.t, tot = g.phase === 'CHOIX' ? exDuree(g) : g.phase === 'SALLE' ? EX.SALLE : g.phase === 'DECISION' ? EX.DECISION : g.phase === 'DESASTRE' ? EX.DESASTRE : g.phase === 'BILAN' ? EX.BILAN : EX.DEPART;
    const reste = Math.max(0, Math.ceil(tot - t));
    const bar = document.getElementById('ex-temps'); if (bar) { bar.style.width = Math.max(0, 100 * (1 - t / tot)) + '%'; bar.style.background = g.phase === 'CHOIX' && reste <= 5 ? 'linear-gradient(90deg,#f43f5e,#fb923c)' : ''; }
    const ch = document.getElementById('ex-chrono'); if (ch) { const txt = g.phase === 'CHOIX' ? reste + 's' : ''; if (ch.textContent !== txt) ch.textContent = txt; }
    if (g.phase === 'CHOIX' && (g.dedans || {})[exMe()] && !(g.choix || {})[exMe()] && reste <= 5 && reste > 0 && exC.tic !== reste) { exC.tic = reste; exSon('tic'); }
}
function exArreter() {
    if (exC.ticker) { clearInterval(exC.ticker); exC.ticker = null; }
    exAmbianceStop(); exDetruire3D(); exC.vue = '';
    const ecran = document.getElementById('screen-generic-game'); if (ecran) ecran.classList.remove('ex-large');
}

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
