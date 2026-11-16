// =====================================================================
//  SYSTÈME : fonctions communes à toute l'application
//    1) pseudos sûrs (caractères interdits par Firebase, doublons)
//    2) retour automatique dans le salon après un rafraîchissement de page
//    3) nettoyage : un salon vide est supprimé, un salon disparu est rétabli
//    4) sons (synthétisés, aucun fichier audio)
//    5) classement de la soirée (cumul sur tout le salon)
//    6) revanche (l'hôte relance le même jeu sans repasser par le salon)
//  index.html appelle : nettoyerPseudo(), systemeSurSalon(), salonDisparu(),
//  systemeApresConnexion(), reconnexionAuto(), demanderRevanche(), quitterSalon().
// =====================================================================

// ============================ 1) PSEUDOS ============================
// Identifiant de ce navigateur : sert à reconnaître un joueur qui revient (même pseudo, même appareil)
const SYS_NAVIGATEUR = typeof window !== 'undefined';
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
const SESSION_KEY = 'lmlp-session', SESSION_MAX_AGE = 6 * 3600 * 1000;
function sessionLire() {
    try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return s && s.room && s.name && Date.now() - (s.t || 0) < SESSION_MAX_AGE ? s : null;
    } catch (e) { return null; }
}
function sessionEcrire() {
    try {
        if (!state.roomCode || !window.myPlayerKey) return;
        localStorage.setItem(SESSION_KEY, JSON.stringify({ room: state.roomCode, name: window.myPlayerKey, avatar: state.avatar && state.avatar.id, t: Date.now() }));
        localStorage.setItem('lmlp-pseudo', window.myPlayerKey);
    } catch (e) {}
}
function sessionEffacer() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

// Appelé par index.html dès qu'un joueur est entré dans un salon (création ou connexion)
function systemeApresConnexion() { sessionEcrire(); sysBoutons(); }

// Au chargement de la page : pseudo mémorisé, puis retour automatique dans le salon quitté par un rafraîchissement
function reconnexionAuto() {
    try {
        const pseudo = localStorage.getItem('lmlp-pseudo');
        const input = document.getElementById('input-username');
        if (pseudo && input) { input.value = nettoyerPseudo(pseudo); if (typeof updatePlayerProfile === 'function') updatePlayerProfile(); }
    } catch (e) {}
    const s = sessionLire();
    if (!s) return;
    let tries = 0;
    const go = () => {
        if (!window.get || !window.db || !window.ref) { if (tries++ < 50) setTimeout(go, 100); return; }      // Firebase pas encore chargé
        window.get(window.ref(window.db, 'salons/' + s.room)).then(snap => {
            const existe = snap.exists() && snap.val() && snap.val().status;
            document.getElementById('input-username').value = s.name;
            document.getElementById('input-room').value = s.room;
            const idx = (typeof AVATARS !== 'undefined' ? AVATARS : []).findIndex(a => a.id === s.avatar);
            if (idx >= 0 && typeof selectAvatar === 'function') selectAvatar(idx);
            if (typeof showToast === 'function') showToast(existe ? '🔄 Retour dans le salon ' + s.room + '...' : '🔄 Le salon ' + s.room + ' était vide : il est recréé.');
            if (existe) joinRoom(); else createRoom();
        }).catch(err => console.error('Reconnexion impossible :', err));
    };
    go();
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
