// =====================================================================
//  SYSTÈME : fonctions communes à toute l'application
//    1) pseudos sûrs (caractères interdits par Firebase, doublons)
//    2) retour automatique dans le salon après un rafraîchissement de page
//    3) nettoyage : un salon vide est supprimé, un salon disparu est rétabli
//    4) sons (synthétisés, aucun fichier audio)
//    5) classement de la soirée (cumul sur tout le salon)
//    6) revanche (l'hôte relance le même jeu sans repasser par le salon)
//    7) pause pour tous et vote de retour au salon, disponibles dans tous les jeux
//  index.html appelle : nettoyerPseudo(), systemeSurSalon(), salonDisparu(),
//  systemeApresConnexion(), reconnexionAuto(), demanderRevanche(), quitterSalon().
// =====================================================================

// ============================ 0) HORLOGE DE JEU (pour la pause) ============================
// Tous les jeux mesurent le temps avec Date.now() et des setInterval. Pendant une pause :
//   - Date.now() s'arrête (et repart ensuite décalé de la durée de la pause, pareil chez tous les joueurs) ;
//   - les minuteries rapides des jeux (setInterval de 5 s ou moins) sont suspendues.
// Ainsi chronomètres et échéances se figent dans tous les modes, sans modifier chacun d'eux.
const SYS_NAVIGATEUR0 = typeof window !== 'undefined';
const SYS_REAL_NOW = Date.now.bind(Date);                 // l'heure réelle, pour ce fichier
const sysClock = { total: 0, pauseAt: 0, gele: false };   // total = durée cumulée des pauses du salon ; pauseAt = début de la pause en cours
if (SYS_NAVIGATEUR0) {
    Date.now = function() {
        const r = SYS_REAL_NOW();
        return Math.round(r - sysClock.total - (sysClock.pauseAt ? Math.max(0, r - sysClock.pauseAt) : 0));
    };
    const sysRealSetInterval = window.setInterval.bind(window);
    window.sysRealSetInterval = sysRealSetInterval;
    window.setInterval = function(fn, ms) {
        if (typeof fn !== 'function' || !(ms <= 5000)) return sysRealSetInterval.apply(window, arguments);      // minuteries longues (réseau) : intactes
        const args = Array.prototype.slice.call(arguments, 2);
        return sysRealSetInterval(function() { if (sysClock.pauseAt || sysClock.gele) return; fn.apply(window, args); }, ms);
    };
}

// ============================ 1) PSEUDOS ============================
// Identifiant de ce navigateur : sert à reconnaître un joueur qui revient (même pseudo, même appareil)
const SYS_NAVIGATEUR = SYS_NAVIGATEUR0;
const sysMonCid = (function() {
    if (!SYS_NAVIGATEUR) return 'test';
    try {
        let id = localStorage.getItem('lmlp-cid');
        if (!id) { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem('lmlp-cid', id); }
        return id;
    } catch (e) { return 'tmp' + Math.random().toString(36).slice(2, 10); }
})();
if (SYS_NAVIGATEUR) window.monCid = sysMonCid;

// Firebase interdit . # $ [ ] / dans une clé : on les retire, ainsi que les caractères invisibles
function nettoyerPseudo(raw) {
    return String(raw == null ? '' : raw)
        .replace(/[.#$\[\]\/\\<>"'`&]/g, '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 16)
        .trim();
}
// Si le pseudo est déjà porté par un AUTRE joueur du salon, on ajoute un numéro
function pseudoLibre(nom, players, cid) {
    players = players || {};
    const pris = n => players[n] && players[n].cid !== cid;
    if (!pris(nom)) return nom;
    const base = nom.slice(0, 13);
    for (let i = 2; i < 50; i++) { const essai = base + '_' + i; if (!pris(essai)) return essai; }
    return base + '_' + Math.floor(Math.random() * 900 + 100);
}

// ============================ 2) RETOUR DANS LE SALON ============================
const SESSION_KEY = 'lmlp-session', SESSION_MAX_AGE = 12 * 3600 * 1000;
function sessionLire() {
    try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return s && s.room && s.name && SYS_REAL_NOW() - (s.t || 0) < SESSION_MAX_AGE ? s : null;
    } catch (e) { return null; }
}
function sessionEcrire() {
    try {
        if (!state.roomCode || !window.myPlayerKey) return;
        localStorage.setItem(SESSION_KEY, JSON.stringify({ room: state.roomCode, name: window.myPlayerKey, avatar: state.avatar && state.avatar.id, t: SYS_REAL_NOW() }));
        localStorage.setItem('lmlp-pseudo', window.myPlayerKey);
    } catch (e) {}
}
function sessionEffacer() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

// Appelé par index.html dès qu'un joueur est entré dans un salon (création ou connexion)
function systemeApresConnexion() { sessionEcrire(); sysBoutons(); }

// Au chargement de la page : on ne rejoint RIEN automatiquement. On pré-remplit seulement le pseudo et le code
// du dernier salon : il suffit de toucher « Rejoindre » pour revenir dans la partie avec le même nom.
function reconnexionAuto() {
    try {
        const pseudo = localStorage.getItem('lmlp-pseudo');
        const input = document.getElementById('input-username');
        if (pseudo && input) { input.value = nettoyerPseudo(pseudo); if (typeof updatePlayerProfile === 'function') updatePlayerProfile(); }
        const s = sessionLire();
        if (!s) return;
        const room = document.getElementById('input-room');
        if (room && !room.value) room.value = s.room;
        const idx = (typeof AVATARS !== 'undefined' ? AVATARS : []).findIndex(a => a.id === s.avatar);
        if (idx >= 0 && typeof selectAvatar === 'function') selectAvatar(idx);
    } catch (e) {}
}
function quitterSalon() {
    sessionEffacer();
    const code = window.currentCodeSalon, me = window.myPlayerKey;
    const fin = () => { location.reload(); };
    if (code && me && window.db && window.set) {
        window._joinedRoom = null; window._lastMyPlayer = null;      // empêche la réinscription automatique
        const humans = Object.values((window.currentRoom && window.currentRoom.players) || {}).filter(p => p && !p.isBot && p.name);
        const cible = humans.length <= 1 ? 'salons/' + code : 'salons/' + code + '/players/' + me;      // dernier joueur : le salon est supprimé
        window.set(window.ref(window.db, cible), null).then(fin).catch(fin);
    } else fin();
}

// ============================ 3) NETTOYAGE DES SALONS ============================
// Un joueur seul dans son salon arme la suppression du salon à sa déconnexion ; dès qu'un autre arrive, on désarme.
let sysArme = null;
function sysNettoyage(data, code) {
    if (!window.onDisconnect || !window.db || !window.ref || !window.myPlayerKey) return;
    const humans = Object.values(data.players || {}).filter(p => p && !p.isBot && p.name);
    const seul = humans.length === 1 && humans[0].name === window.myPlayerKey;
    const etat = code + ':' + seul;
    if (sysArme === etat) return;
    sysArme = etat;
    try {
        const od = window.onDisconnect(window.ref(window.db, 'salons/' + code));
        if (seul) od.remove(); else if (od.cancel) od.cancel().then(() => {
            // l'annulation efface aussi notre propre « retrait à la déconnexion » : on le réarme
            window.onDisconnect(window.ref(window.db, 'salons/' + code + '/players/' + window.myPlayerKey)).remove();
        });
    } catch (e) { console.error('Nettoyage du salon :', e); }
}
// Le salon a disparu alors qu'on y était (coupure réseau d'un joueur seul) : on le rétablit
function salonDisparu(code) {
    if (!window.myPlayerKey || window._joinedRoom !== code || !window.set || window._retablit) return;
    window._retablit = true;
    sysArme = null;
    window.set(window.ref(window.db, 'salons/' + code), {
        host: window.myPlayerKey, status: 'LOBBY', selectedMode: state.selectedMode || '', createdAt: Date.now(),
        players: { [window.myPlayerKey]: { name: window.myPlayerKey, avatar: state.avatar, isHost: true, isBot: false, score: 0, isReady: false, cid: window.monCid } }
    }).then(() => { if (typeof showToast === 'function') showToast('Salon ' + code + ' rétabli.'); })
      .catch(err => console.error('Salon non rétabli :', err))
      .finally(() => { setTimeout(() => { window._retablit = false; }, 2000); });
}

// ============================ 4) SONS ============================
const sysSon = { ctx: null, on: true };
try { if (SYS_NAVIGATEUR) sysSon.on = localStorage.getItem('lmlp-son') !== '0'; } catch (e) {}
function sysCtx() {
    if (!sysSon.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; sysSon.ctx = new AC(); }
    if (sysSon.ctx.state === 'suspended') sysSon.ctx.resume().catch(() => {});
    return sysSon.ctx;
}
// Une note : fréquence (Hz), début (s), durée (s), forme d'onde, volume, fréquence d'arrivée (glissando)
function sysNote(ctx, f, t, d, type, vol, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + t;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + d + 0.03);
}
// Un souffle (bruit filtré) : début, durée, fréquence du filtre, volume, fréquence d'arrivée
function sysBruit(ctx, t, d, f, vol, f2) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * d)), buf = ctx.createBuffer(1, n, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = ctx.currentTime + t;
    src.buffer = buf; flt.type = 'bandpass'; flt.Q.value = 0.9;
    flt.frequency.setValueAtTime(f, t0);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start(t0); src.stop(t0 + d + 0.02);
}
const SYS_SONS = {
    des: c => { [0, 0.07, 0.15, 0.24, 0.36].forEach((t, i) => sysBruit(c, t, 0.05, 1800 + i * 250, 0.35)); },
    carte: c => { sysBruit(c, 0, 0.18, 900, 0.3, 4200); sysNote(c, 880, 0.14, 0.12, 'triangle', 0.08); },
    tour: c => { sysNote(c, 660, 0, 0.14, 'sine', 0.2); sysNote(c, 990, 0.13, 0.22, 'sine', 0.2); },
    depart: c => { [392, 523, 659, 784].forEach((f, i) => sysNote(c, f, i * 0.09, 0.2, 'triangle', 0.16)); },
    victoire: c => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => sysNote(c, f, i * 0.12, 0.28, 'triangle', 0.18)); },
    argent: c => { sysNote(c, 1320, 0, 0.09, 'square', 0.07); sysNote(c, 1760, 0.08, 0.2, 'square', 0.07); },
    touche: c => { sysBruit(c, 0, 0.35, 700, 0.5, 120); sysNote(c, 180, 0, 0.3, 'sawtooth', 0.18, 50); },
    rate: c => { sysNote(c, 320, 0, 0.22, 'sine', 0.2, 110); sysBruit(c, 0.02, 0.2, 500, 0.12, 200); },
    coule: c => { sysBruit(c, 0, 0.8, 900, 0.55, 70); sysNote(c, 240, 0, 0.7, 'sawtooth', 0.2, 35); sysNote(c, 520, 0.05, 0.5, 'square', 0.06, 90); },
    elimine: c => { sysNote(c, 392, 0, 0.18, 'sawtooth', 0.14, 300); sysNote(c, 262, 0.17, 0.4, 'sawtooth', 0.14, 120); },
    erreur: c => { sysNote(c, 160, 0, 0.2, 'square', 0.1); },
    clic: c => { sysNote(c, 1200, 0, 0.04, 'square', 0.05); }
};
const sysSfx = function(nom) {
    if (!sysSon.on || !SYS_SONS[nom]) return;
    try { const c = sysCtx(); if (c) SYS_SONS[nom](c); } catch (e) {}
};
if (SYS_NAVIGATEUR) window.sfx = sysSfx;
function basculerSon() {
    sysSon.on = !sysSon.on;
    try { localStorage.setItem('lmlp-son', sysSon.on ? '1' : '0'); } catch (e) {}
    sysBoutons();
    if (sysSon.on) window.sfx('tour');
}

// ============================ 5) CLASSEMENT DE LA SOIRÉE ============================
// Points par partie selon le rang : 1er = 3, 2e = 2, 3e = 1 (les ex æquo partagent le meilleur rang).
const SOIREE_POINTS = [3, 2, 1];
function soireeResultat(joueurs, base) {
    // joueurs : [{name, score}] ; base : scores au début de la partie. Renvoie null s'il n'y a rien à classer.
    base = base || {};
    let gains = joueurs.map(p => ({ n: p.name, g: (Number(p.score) || 0) - (Number(base[p.name]) || 0) }));
    if (gains.some(x => x.g < 0)) gains = joueurs.map(p => ({ n: p.name, g: Number(p.score) || 0 }));      // le mode a remis les scores à zéro
    if (!gains.length || gains.every(x => x.g === gains[0].g && x.g <= 0)) return null;
    gains.sort((a, b) => b.g - a.g);
    const out = {};
    let rang = 0;
    gains.forEach((x, i) => { if (i > 0 && x.g < gains[i - 1].g) rang = i; out[x.n] = { pts: SOIREE_POINTS[rang] || 0, win: rang === 0 && x.g > 0 }; });
    return out;
}
let soireeVerrou = '';
function soireeSuivre(data, code, prevStatus) {
    if (!window.isHost || !window.update || prevStatus === undefined || prevStatus === data.status) return;
    const humans = Object.values(data.players || {}).filter(p => p && !p.isBot && p.name);
    if (prevStatus === 'LOBBY' && data.status === 'IN_GAME') {
        const scores = {};
        humans.forEach(p => { scores[p.name] = Number(p.score) || 0; });
        window.update(window.ref(window.db, 'salons/' + code), { soireeBase: { mode: data.selectedMode || '', t: Date.now(), scores: scores } }).catch(() => {});
    } else if (prevStatus === 'IN_GAME' && data.status === 'LOBBY' && data.soireeBase) {
        const cle = code + ':' + data.soireeBase.t;
        if (soireeVerrou === cle) return;
        soireeVerrou = cle;
        const res = soireeResultat(humans.map(p => ({ name: p.name, score: p.score })), data.soireeBase.scores);
        const updates = { soireeBase: null };
        if (res) {
            const cur = data.soiree || {};
            Object.keys(res).forEach(n => {
                const c = cur[n] || {};
                updates['soiree/' + n] = { pts: (c.pts || 0) + res[n].pts, wins: (c.wins || 0) + (res[n].win ? 1 : 0), games: (c.games || 0) + 1 };
            });
        }
        window.update(window.ref(window.db, 'salons/' + code), updates).catch(err => { soireeVerrou = ''; console.error('Classement de la soirée :', err); });
    }
}
function soireeEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function soireeHtml(data) {
    const s = (data && data.soiree) || {};
    const rows = Object.keys(s).map(n => ({ n: n, pts: s[n].pts || 0, wins: s[n].wins || 0, games: s[n].games || 0 }))
        .sort((a, b) => b.pts - a.pts || b.wins - a.wins);
    if (!rows.length) return '<div style="color:#94a3b8;font-size:13px;padding:14px 0;text-align:center">Aucune partie terminée pour le moment.<br>Le classement se remplit à la fin de chaque jeu.</div>';
    const players = (data && data.players) || {};
    return rows.map((r, i) => {
        const av = players[r.n] && players[r.n].avatar && players[r.n].avatar.src;
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid rgba(148,163,184,.2);${i === 0 ? 'background:rgba(251,191,36,.12);border-radius:8px' : ''}">
            <span style="width:26px;text-align:center;font-weight:900;color:${i === 0 ? '#fbbf24' : '#94a3b8'}">${i === 0 ? '🏆' : '#' + (i + 1)}</span>
            ${av ? `<img src="${soireeEsc(av)}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #22d3ee">` : ''}
            <span style="flex:1;min-width:0;font-weight:800;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${soireeEsc(r.n)}${players[r.n] ? '' : ' <span style="font-weight:400;color:#64748b;font-size:11px">(parti)</span>'}</span>
            <span style="font-size:11px;color:#94a3b8;white-space:nowrap">${r.wins} victoire${r.wins > 1 ? 's' : ''} · ${r.games} partie${r.games > 1 ? 's' : ''}</span>
            <span style="font-family:monospace;font-weight:900;font-size:18px;color:#6ee7b7;min-width:52px;text-align:right">${r.pts} pts</span></div>`;
    }).join('');
}
function ouvrirSoiree() {
    let m = document.getElementById('sys-soiree');
    if (!m) {
        m = document.createElement('div');
        m.id = 'sys-soiree';
        m.style.cssText = 'position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.78);padding:12px';
        m.onclick = e => { if (e.target === m || (e.target.closest && e.target.closest('[data-close]'))) m.remove(); };
        document.body.appendChild(m);
    }
    m.innerHTML = `<div style="width:min(520px,100%);max-height:86vh;display:flex;flex-direction:column;border:1px solid #fbbf24;border-radius:14px;background:#091424;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.8)">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fbbf24;color:#04101f;font-weight:900;letter-spacing:.12em">🏆 CLASSEMENT DE LA SOIRÉE<button data-close="1" style="border:0;background:rgba(2,6,23,.25);border-radius:6px;padding:2px 9px;font-weight:900;cursor:pointer">✕</button></div>
        <div id="sys-soiree-body" style="padding:10px 14px;overflow-y:auto">${soireeHtml(window.currentRoom)}</div>
        <div style="padding:8px 14px;font-size:11px;color:#94a3b8;border-top:1px solid rgba(148,163,184,.2)">À chaque partie : 3 points au premier, 2 au deuxième, 1 au troisième. Le cumul dure tant que le salon existe.</div>
    </div>`;
}

// ============================ 6) REVANCHE ============================
// L'hôte relance le même jeu avec les mêmes réglages : bref passage par le salon, puis nouveau départ.
function demanderRevanche() {
    if (!window.isHost) { if (typeof showToast === 'function') showToast("Seul l'Hôte peut lancer une revanche."); return; }
    const code = window.currentCodeSalon;
    if (!code || !window.update || window._revancheEnCours) return;
    window._revancheEnCours = true;
    const updates = { status: 'LOBBY', lobbyReturn: null, revanche: Date.now() };
    Object.keys((window.currentRoom && window.currentRoom.players) || {}).forEach(k => { updates['players/' + k + '/isReady'] = false; });
    window.update(window.ref(window.db, 'salons/' + code), updates).then(() => {
        setTimeout(() => {
            window._revanche = true;      // launchGame() ne réclame pas que tout le monde soit « prêt »
            try { launchGame(); } finally { window._revanche = false; window._revancheEnCours = false; }
        }, 900);
    }).catch(err => { window._revancheEnCours = false; console.error('Revanche impossible :', err); });
}

// ============================ 7) PAUSE ET RETOUR AU SALON ============================
function sysMoi() { return window.myPlayerKey || (typeof state !== 'undefined' ? state.username : ''); }
function sysEcrire(updates) {
    const code = window.currentCodeSalon;
    if (!code || !window.update) return Promise.resolve();
    return window.update(window.ref(window.db, 'salons/' + code), updates).catch(err => console.error('Système :', err));
}
function sysHumains(data) { return Object.values((data && data.players) || {}).filter(p => p && !p.isBot && p.name).map(p => p.name); }
// N'importe quel joueur met la partie en pause, ou la relance, pour tout le monde
function basculerPause() {
    const room = window.currentRoom;
    if (!room || room.status !== 'IN_GAME') return;
    sysFermerMenu();
    if (room.pause) sysEcrire({ pause: null, pauseTotal: (room.pauseTotal || 0) + Math.max(0, SYS_REAL_NOW() - (room.pause.t || SYS_REAL_NOW())) });
    else sysEcrire({ pause: { by: sysMoi(), t: SYS_REAL_NOW() } });
}
// Proposer à tous de retourner au salon : il faut que chaque joueur accepte
function demanderRetourSalon() {
    const room = window.currentRoom;
    if (!room || room.status !== 'IN_GAME' || room.quitVote) return;
    sysFermerMenu();
    sysEcrire({ quitVote: { by: sysMoi(), t: SYS_REAL_NOW(), yes: { [sysMoi()]: true } } });
}
function repondreRetourSalon(oui) {
    const room = window.currentRoom;
    if (!room || !room.quitVote) return;
    if (oui) sysEcrire({ ['quitVote/yes/' + sysMoi()]: true });
    else sysEcrire({ quitVote: null, quitRefus: { by: sysMoi(), t: SYS_REAL_NOW() } });
}
function sysFermerMenu() { const m = document.getElementById('sys-menu-pop'); if (m) m.remove(); }
function sysOuvrirMenu() {
    if (document.getElementById('sys-menu-pop')) { sysFermerMenu(); return; }
    const m = document.createElement('div');
    m.id = 'sys-menu-pop';
    m.style.cssText = 'position:fixed;left:8px;bottom:52px;z-index:10050;display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:14px;border:1px solid rgba(0,210,255,.5);background:rgba(4,10,22,.97);box-shadow:0 10px 40px rgba(0,0,0,.7);min-width:230px';
    const b = 'padding:11px 14px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f1f5f9;font-weight:800;font-size:13px;text-align:left;cursor:pointer;font-family:inherit';
    m.innerHTML = `<button style="${b}" onclick="basculerPause()">⏸️ Mettre en pause pour tous</button>
        <button style="${b}" onclick="demanderRetourSalon()">🏠 Retour au salon <span style="font-weight:400;color:#94a3b8">(vote de tous)</span></button>
        <button style="${b};background:transparent;border-color:transparent;color:#94a3b8;text-align:center" onclick="sysFermerMenu()">Fermer</button>`;
    document.body.appendChild(m);
}
let sysVoteVu = 0, sysRefusVu = 0, sysAbandonVu = 0;
function sysPauseEtVote(data, code) {
    const enJeu = data.status === 'IN_GAME', moi = sysMoi(), humains = sysHumains(data), now = SYS_REAL_NOW();
    // ----- horloge de jeu commune -----
    sysClock.total = Number(data.pauseTotal) || 0;
    sysClock.pauseAt = enJeu && data.pause ? (Number(data.pause.t) || now) : 0;
    if (enJeu) sysClock.gele = false;
    if (data.abandon && data.abandon !== sysAbandonVu) {
        const neuf = sysAbandonVu !== 0 || now - data.abandon < 8000;
        sysAbandonVu = data.abandon;
        if (neuf) { if (!enJeu) sysClock.gele = true; if (typeof showToast === 'function') showToast('🏠 Tous les joueurs ont accepté : retour au salon.'); }      // les minuteries de la partie abandonnée restent à l'arrêt
    }

    // ----- bouton de menu, visible pendant les parties -----
    let btn = document.getElementById('sys-menu');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'sys-menu';
        btn.title = 'Pause / retour au salon';
        btn.textContent = '⏸️';
        btn.style.cssText = 'position:fixed;left:52px;bottom:8px;z-index:10040;width:36px;height:36px;border-radius:50%;border:1px solid rgba(251,191,36,.6);background:rgba(9,20,36,.92);color:#e2e8f0;font-size:15px;cursor:pointer;line-height:1;display:none';
        btn.onclick = sysOuvrirMenu;
        document.body.appendChild(btn);
    }
    btn.style.display = enJeu ? '' : 'none';
    if (!enJeu) sysFermerMenu();

    // ----- écran de pause -----
    let ov = document.getElementById('sys-pause');
    if (enJeu && data.pause) {
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'sys-pause';
            ov.style.cssText = 'position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.86);backdrop-filter:blur(5px);padding:16px';
            document.body.appendChild(ov);
            if (typeof window.sfx === 'function') window.sfx('clic');
        }
        ov.innerHTML = `<div style="width:min(420px,100%);text-align:center;border:1px solid #fbbf24;border-radius:18px;background:#091424;padding:26px 20px;box-shadow:0 0 50px rgba(251,191,36,.25)">
            <div style="font-size:54px;line-height:1">⏸️</div>
            <div class="sci-font" style="font-weight:800;letter-spacing:.14em;font-size:20px;color:#fde68a;margin-top:8px">PARTIE EN PAUSE</div>
            <div style="color:#cbd5e1;font-size:14px;margin:8px 0 18px">Mise en pause par <b style="color:#f8fafc">${soireeEsc(data.pause.by || '?')}</b>. Les chronomètres sont arrêtés pour tout le monde.</div>
            <button onclick="basculerPause()" style="width:100%;padding:14px;border-radius:12px;border:0;background:#059669;color:#fff;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">▶️ Reprendre la partie</button>
            <button onclick="demanderRetourSalon()" style="width:100%;margin-top:8px;padding:11px;border-radius:12px;border:1px solid #475569;background:transparent;color:#cbd5e1;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">🏠 Proposer le retour au salon</button>
        </div>`;
    } else if (ov) ov.remove();

    // ----- vote de retour au salon -----
    let dlg = document.getElementById('sys-vote');
    const v = enJeu ? data.quitVote : null;
    if (v) {
        const oui = v.yes || {}, attente = humains.filter(n => !oui[n]);
        if (!dlg) { dlg = document.createElement('div'); dlg.id = 'sys-vote'; dlg.style.cssText = 'position:fixed;inset:0;z-index:10070;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.8);padding:16px'; document.body.appendChild(dlg); }
        const aVote = !!oui[moi] || humains.indexOf(moi) < 0;
        dlg.innerHTML = `<div style="width:min(440px,100%);text-align:center;border:1px solid #22d3ee;border-radius:18px;background:#091424;padding:22px 20px">
            <div style="font-size:44px;line-height:1">🏠</div>
            <div class="sci-font" style="font-weight:800;letter-spacing:.1em;font-size:17px;color:#a5f3fc;margin-top:6px">RETOUR AU SALON ?</div>
            <div style="color:#cbd5e1;font-size:14px;margin:8px 0 6px"><b style="color:#f8fafc">${soireeEsc(v.by || '?')}</b> propose d'arrêter cette partie et de retourner au salon. Tous les joueurs doivent accepter.</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:14px">${humains.map(n => `<span style="display:inline-block;margin:2px 4px;padding:2px 8px;border-radius:999px;border:1px solid ${oui[n] ? '#34d399' : '#475569'};color:${oui[n] ? '#6ee7b7' : '#94a3b8'}">${oui[n] ? '✓' : '…'} ${soireeEsc(n)}</span>`).join('')}</div>
            ${aVote ? `<div style="color:#fbbf24;font-size:13px">En attente de ${attente.length} joueur${attente.length > 1 ? 's' : ''}...</div><button onclick="repondreRetourSalon(false)" style="margin-top:10px;padding:9px 16px;border-radius:10px;border:1px solid #475569;background:transparent;color:#cbd5e1;font-size:12px;cursor:pointer;font-family:inherit">Annuler le vote</button>`
                : `<div style="display:flex;gap:10px"><button onclick="repondreRetourSalon(true)" style="flex:1;padding:13px;border-radius:12px;border:0;background:#059669;color:#fff;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">Accepter</button><button onclick="repondreRetourSalon(false)" style="flex:1;padding:13px;border-radius:12px;border:0;background:#b91c1c;color:#fff;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">Refuser</button></div>`}
            <div style="font-size:11px;color:#64748b;margin-top:10px">Sans réponse de tous dans <span id="sys-vote-left">${Math.max(0, 45 - Math.floor((now - (v.t || now)) / 1000))}</span> s, la partie continue.</div>
        </div>`;
        if (v.t !== sysVoteVu) { sysVoteVu = v.t; if (typeof window.sfx === 'function') window.sfx('tour'); }
        // l'hôte tranche : tout le monde a accepté → retour au salon ; délai dépassé → vote annulé
        if (window.isHost) {
            if (humains.length && attente.length === 0) {
                const updates = { status: 'LOBBY', quitVote: null, lobbyReturn: null, soireeBase: null, pause: null, abandon: now };
                if (data.pause) updates.pauseTotal = (data.pauseTotal || 0) + Math.max(0, now - (data.pause.t || now));
                Object.keys(data.players || {}).forEach(k => { updates['players/' + k + '/isReady'] = false; });
                sysEcrire(updates);
            } else if (now - (v.t || now) > 45000) sysEcrire({ quitVote: null, quitRefus: { by: '', t: now } });
        }
    } else if (dlg) dlg.remove();
    if (data.quitRefus && data.quitRefus.t !== sysRefusVu) {
        const neuf = sysRefusVu !== 0 || now - data.quitRefus.t < 8000;
        sysRefusVu = data.quitRefus.t;
        if (neuf && typeof showToast === 'function') showToast(data.quitRefus.by ? data.quitRefus.by + ' a refusé : la partie continue.' : 'Vote expiré : la partie continue.');
    }
    // une pause ou un vote oubliés hors partie sont effacés par l'hôte
    if (!enJeu && window.isHost && (data.pause || data.quitVote)) {
        const updates = { quitVote: null, pause: null };
        if (data.pause) updates.pauseTotal = (data.pauseTotal || 0) + Math.max(0, now - (data.pause.t || now));
        sysEcrire(updates);
    }
}
// Compte à rebours du vote et expiration (tourne même pendant une pause)
if (SYS_NAVIGATEUR0) window.sysRealSetInterval(() => {
    const room = window.currentRoom, el = document.getElementById('sys-vote-left');
    if (!room || !room.quitVote) return;
    const left = 45 - Math.floor((SYS_REAL_NOW() - (room.quitVote.t || 0)) / 1000);
    if (el) el.textContent = Math.max(0, left);
    if (left < 0 && window.isHost && room.status === 'IN_GAME') sysEcrire({ quitVote: null, quitRefus: { by: '', t: SYS_REAL_NOW() } });
}, 1000);

// ============================ BOUTONS ET SUIVI DU SALON ============================
function sysBoutons() {
    // bouton son (toujours visible) + boutons du salon (classement, quitter) + boutons « Revanche » réservés à l'hôte
    let b = document.getElementById('sys-son');
    if (!b) {
        b = document.createElement('button');
        b.id = 'sys-son';
        b.title = 'Activer / couper les sons';
        b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:60;width:36px;height:36px;border-radius:50%;border:1px solid rgba(0,210,255,.5);background:rgba(9,20,36,.9);color:#e2e8f0;font-size:16px;cursor:pointer;line-height:1';
        b.onclick = basculerSon;
        document.body.appendChild(b);
    }
    b.textContent = sysSon.on ? '🔊' : '🔇';
    document.querySelectorAll('.btn-revanche').forEach(el => { el.style.display = window.isHost ? '' : 'none'; });
}
let sysRevancheVue = 0;
// Appelé par index.html à chaque mise à jour du salon
function systemeSurSalon(data, code, prevStatus) {
    try {
        sysPauseEtVote(data, code);
        sysNettoyage(data, code);
        soireeSuivre(data, code, prevStatus);
        sysBoutons();
        if (typeof mobRefresh === 'function') mobRefresh();      // version téléphone du salon (mobile.js)
        const body = document.getElementById('sys-soiree-body');
        if (body) body.innerHTML = soireeHtml(data);
        if (prevStatus === 'LOBBY' && data.status === 'IN_GAME') window.sfx('depart');
        if (data.revanche && data.revanche !== sysRevancheVue) {
            const neuf = sysRevancheVue !== 0 || Date.now() - data.revanche < 5000;
            sysRevancheVue = data.revanche;
            if (neuf && typeof showToast === 'function') showToast('🔁 Revanche ! La partie redémarre...');
        }
        if (Date.now() - (window._sessionVue || 0) > 60000) { window._sessionVue = Date.now(); sessionEcrire(); }
    } catch (e) { console.error('Système :', e); }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { nettoyerPseudo, pseudoLibre, soireeResultat };
