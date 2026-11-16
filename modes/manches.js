// =====================================================================
//  MOTEUR « MANCHES » : base commune des modes
//    Au Plus Proche (estimation.js), Esprit Commun (telepathie.js),
//    Mise Secrète (encheres.js), Réflexes Éclair (reflexes.js),
//    Séquence Mémoire (memoire.js).
//
//  Tout le monde joue la même manche en même temps. À la fin du temps (ou quand
//  tous ont répondu), l'HÔTE calcule les points, la manche est révélée, puis la
//  suivante démarre. Les joueurs n'écrivent que leur propre réponse.
//
//  Chaque mode s'enregistre dans window.MANCHES_MODES[cle] = {
//      title, minPlayers, minRounds, maxRounds, defaultRounds, revealSeconds, fixedTimer,
//      prepare(nbManches, noms)        -> tableau des données de manche (hôte)
//      renderPlay(ctx)                 -> construit la zone de jeu, appelle ctx.submit(reponse)
//      onTimeout(ctx)                  -> réponse envoyée si le temps est écoulé (facultatif)
//      describe(reponse, ctx)          -> texte affiché après l'envoi (facultatif)
//      score({rd, answers, names, g})  -> { p: { nom: { pts, ... } }, info: {...} }
//      renderReveal({rd, answers, res, info, me, names, g}) -> HTML de la révélation
//  }
//  Données Firebase : salons/<code>/mancheGame
// =====================================================================

window.MANCHES_MODES = window.MANCHES_MODES || {};

// --------------------------- Utilitaires ---------------------------
function mchEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function mchShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
}
function mchArr(v) { return Array.isArray(v) ? v : Object.values(v || {}); }
function mchMe() { return window.myPlayerKey || state.username; }
function mchRoom() { return window.currentCodeSalon || state.roomCode; }
function mchHumans(data) {
    return Object.values((data && data.players) || {}).filter(p => p && p.name && !p.isBot);
}
function mchNorm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
}
function mchLev(a, b) {      // distance de Levenshtein
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}
function mchFmt(n) {
    const v = Number(n);
    if (!isFinite(v)) return String(n);
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
function mchRoundTimer(g, rd) { return Number(rd && rd.t) || Number(g && g.timer) || 20; }
function mchAnswers(g, round) { return (g.answers && g.answers['r' + round]) || {}; }
function mchResults(g, round) { return (g.results && g.results['r' + round]) || {}; }

// --------------------------- Lancement (hôte) ---------------------------
window.startManchesGame = function(modeKey) {
    if (!window.isHost) return;
    const def = window.MANCHES_MODES[modeKey];
    const code = mchRoom();
    if (!def || !code || !window.mettreAJourSalonFirebase) return;

    const names = Object.values(state.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    if (names.length < (def.minPlayers || 1)) {
        if (typeof showToast === 'function') showToast(`⚠️ Il faut au moins ${def.minPlayers} joueurs pour le mode ${def.title} !`);
        return;
    }

    const minR = def.minRounds || 3, maxR = def.maxRounds || 12;
    const wanted = parseInt(document.getElementById('setting-manches-rounds')?.value, 10) || def.defaultRounds || 6;
    const count = Math.max(minR, Math.min(maxR, wanted));
    const timer = def.fixedTimer || Math.max(5, Math.min(90, parseInt(document.getElementById('input-host-timer')?.value, 10) || 20));

    const rounds = def.prepare(count, names);
    if (!rounds || !rounds.length) {
        if (typeof showToast === 'function') showToast(`⚠️ Impossible de préparer le mode ${def.title}.`);
        return;
    }

    const updates = {
        status: 'IN_GAME',
        selectedMode: modeKey,
        'settings/timer': timer,
        'settings/manchesRounds': rounds.length,
        mancheGame: {
            mode: modeKey, status: 'PLAYING', phase: 'ANSWER', round: 1, maxRounds: rounds.length, timer: timer,
            rounds: rounds, startedAt: Date.now(), roundStartedAt: Date.now()
        }
    };
    Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(code, updates);
};

// --------------------------- Rendu (appelé à chaque mise à jour Firebase) ---------------------------
window.renderManchesScreen = function(data) {
    const g = data && data.mancheGame;
    if (!g || g.mode !== data.selectedMode) return;       // partie d'un autre mode encore en mémoire
    const def = window.MANCHES_MODES[g.mode];
    if (!def) return;
    window.mchData = data;
    const sess = g.mode + ':' + String(g.startedAt || 0);

    if (g.status === 'FINISHED') {
        if (window.mchShownResults !== sess) {
            window.mchShownResults = sess;
            mchStopRound();
            clearInterval(window.mchTicker); window.mchTicker = null;
            const ranking = mchHumans(data).sort((a, b) => (b.score || 0) - (a.score || 0));
            const lb = document.getElementById('final-leaderboard');
            if (lb) {
                lb.innerHTML = ranking.map((p, i) => `
                    <div class="flex justify-between items-center p-3 rounded-2xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-900 border border-slate-800'} text-xs">
                        <span class="font-bold">#${i + 1} - ${mchEsc(p.name)}</span>
                        <span class="font-mono text-emerald-400 font-bold text-sm">${p.score || 0} pts</span>
                    </div>`).join('');
            }
            showScreen('screen-results');
        }
        return;
    }

    const roundKey = sess + ':' + g.round;
    if (g.phase === 'REVEAL') {
        if (window.mchRevealKey !== roundKey) { window.mchRevealKey = roundKey; mchShowReveal(data, def); }
        else mchUpdateReveal(data, def);
    } else {
        if (window.mchRoundKey !== roundKey) { window.mchRoundKey = roundKey; mchStartRound(data, def, sess); }
        mchUpdateProgress(data);
    }

    if (!window.mchTicker) {
        window.mchTicker = setInterval(() => {
            mchTickReveal();
            if (window.isHost) mchHostCheck();
        }, 1000);
    }
    if (window.isHost) mchHostCheck();
};

// Arrête proprement la manche en cours côté joueur (chronos et animations du mode)
function mchStopRound() {
    const st = window.mchState;
    if (!st) return;
    clearInterval(st.timerInterval);
    st.closed = true;
    const fns = st.cleanups || [];
    st.cleanups = [];
    fns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

// --------------------------- Manche : saisie du joueur ---------------------------
function mchStartRound(data, def, sess) {
    mchStopRound();
    showScreen('screen-generic-game');
    const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = def.title;
    const g = data.mancheGame;
    const rd = mchArr(g.rounds)[g.round - 1] || {};
    const timer = mchRoundTimer(g, rd);
    const me = mchMe();
    const already = mchAnswers(g, g.round)[me];

    const elapsed = Math.floor((Date.now() - (g.roundStartedAt || Date.now())) / 1000);
    const st = window.mchState = {
        def: def, rd: rd, timer: timer, round: g.round, sess: sess,
        timeLeft: Math.max(0, Math.min(timer, timer - Math.max(0, elapsed))),
        submitted: !!already, closed: false, timerInterval: null, cleanups: []
    };

    const content = document.getElementById('generic-game-content');
    if (!content) return;
    content.innerHTML = `
        <div id="mch-box" class="w-full max-w-2xl mx-auto space-y-3">
            <div class="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div class="text-[11px] uppercase tracking-widest text-indigo-300">Manche ${g.round} / ${g.maxRounds}</div>
                <div class="text-xl font-mono font-bold text-amber-400" id="mch-timer"></div>
            </div>
            <div id="mch-play" class="space-y-3"></div>
            <div id="mch-progress" class="flex flex-wrap gap-2 justify-center text-[11px] font-mono"></div>
        </div>`;
    const play = document.getElementById('mch-play');

    const ctx = st.ctx = {
        g: g, data: data, rd: rd, round: g.round, me: me, timer: timer, el: play,
        names: mchHumans(data).map(p => p.name),
        timeLeft: () => st.timeLeft,
        isOpen: () => window.mchState === st && !st.submitted && !st.closed,
        onCleanup: fn => { st.cleanups.push(fn); },
        submit: answer => mchSubmit(st, answer)
    };

    const tick = () => {
        const t = document.getElementById('mch-timer');
        const tl = document.getElementById('generic-game-timer');
        if (t) t.textContent = st.submitted ? 'Envoyé ✓' : '⏱ ' + st.timeLeft + ' s';
        if (tl) tl.innerText = st.timeLeft + 's';
    };
    st.tick = tick;

    if (already) {
        mchShowWaiting(st, already.a);
    } else {
        try { def.renderPlay(ctx); }
        catch (e) { console.error('Affichage de la manche impossible :', e); }
    }

    tick();
    st.timerInterval = setInterval(() => {
        if (window.mchState !== st || st.closed || !document.getElementById('mch-box')) { clearInterval(st.timerInterval); return; }
        if (st.submitted) { tick(); return; }
        st.timeLeft--;
        tick();
        if (st.timeLeft <= 0) {
            let a = null;
            try { a = def.onTimeout ? def.onTimeout(ctx) : null; } catch (e) { console.error(e); }
            mchSubmit(st, a);
        }
    }, 1000);
}

function mchShowWaiting(st, answer) {
    const play = document.getElementById('mch-play');
    if (!play) return;
    let txt = '';
    try { txt = st.def.describe ? st.def.describe(answer, st.ctx) : ''; } catch (e) { txt = ''; }
    play.innerHTML = `
        <div class="p-6 bg-slate-900/80 border border-emerald-500/40 rounded-2xl text-center space-y-2">
            <div class="text-emerald-400 font-black text-lg"><i class="fa-solid fa-check-circle"></i> Réponse envoyée</div>
            ${txt ? `<div class="text-slate-200 text-sm">${txt}</div>` : ''}
            <div class="text-xs text-slate-400"><i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...</div>
        </div>`;
}

function mchSubmit(st, answer) {
    if (!st || st.submitted || st.closed || window.mchState !== st) return;
    st.submitted = true;
    const fns = st.cleanups || [];
    st.cleanups = [];
    fns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    const a = (answer === undefined || answer === null) ? '' : answer;
    mchShowWaiting(st, a);
    if (st.tick) st.tick();
    const code = mchRoom(), me = mchMe();
    if (!code || !me || !window.update) return;
    window.update(window.ref(window.db, `salons/${code}`), {
        [`mancheGame/answers/r${st.round}/${me}`]: { a: a, tl: Math.max(0, st.timeLeft), ok: true }
    }).catch(err => console.error('Réponse non envoyée :', err));
}

function mchUpdateProgress(data) {
    const el = document.getElementById('mch-progress');
    const g = data && data.mancheGame;
    if (!el || !g) return;
    const answers = mchAnswers(g, g.round);
    el.innerHTML = mchHumans(data).map(p =>
        `<span class="px-2 py-1 rounded-lg border ${answers[p.name] ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-700 text-slate-400'} bg-slate-900/70">${mchEsc(p.name)} ${answers[p.name] ? '✓' : '…'}</span>`).join('');
}

// --------------------------- Révélation ---------------------------
function mchShowReveal(data, def) {
    mchStopRound();
    showScreen('screen-generic-game');
    const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = def.title;
    const tl = document.getElementById('generic-game-timer'); if (tl) tl.innerText = 'Résultat';
    const content = document.getElementById('generic-game-content');
    if (!content) return;
    content.innerHTML = `<div id="mch-reveal" class="w-full max-w-2xl mx-auto space-y-3"></div>`;
    mchUpdateReveal(data, def);
}

function mchUpdateReveal(data, def) {
    const g = data.mancheGame, root = document.getElementById('mch-reveal');
    if (!root) return;
    const rd = mchArr(g.rounds)[g.round - 1] || {};
    const me = mchMe();
    const answers = mchAnswers(g, g.round);
    const result = mchResults(g, g.round);
    const res = result.p || {};
    const info = result.info || {};
    const players = mchHumans(data);
    const names = players.map(p => p.name);
    const last = g.round >= g.maxRounds;
    const secs = def.revealSeconds || 8;
    const left = Math.max(0, Math.ceil(((Number(g.revealAt) || 0) + secs * 1000 - Date.now()) / 1000));

    let top = '';
    try { top = def.renderReveal({ rd: rd, answers: answers, res: res, info: info, me: me, names: names, g: g }); }
    catch (e) { console.error('Révélation impossible :', e); }

    const board = players.map(p => ({ n: p.name, pts: (res[p.name] && res[p.name].pts) || 0, total: p.score || 0 }))
        .sort((a, b) => b.total - a.total).map(r =>
        `<div class="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span class="font-bold ${r.n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(r.n)}</span>
            <span><b class="text-emerald-400">+${r.pts}</b> <span class="text-slate-400 font-mono">· total ${r.total}</span></span></div>`).join('');

    root.innerHTML = `
        <div class="text-[11px] uppercase tracking-widest text-indigo-300 text-center">Manche ${g.round} / ${g.maxRounds} · Résultat</div>
        ${top}
        <div class="text-[10px] uppercase tracking-wider text-slate-400 pt-1">Classement</div>
        <div class="space-y-1.5">${board}</div>
        <div class="text-center text-xs text-amber-300">${last ? 'Résultats finaux' : 'Manche suivante'} dans <span id="mch-left">${left}</span> s
            ${window.isHost ? ' <button id="mch-next" class="ml-2 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">Passer</button>' : ''}</div>`;
    const nx = document.getElementById('mch-next');
    if (nx) nx.onclick = () => mchAdvance();
}

// Décompte de la révélation (met à jour seulement le chiffre, pour ne pas recréer les boutons)
function mchTickReveal() {
    const data = window.mchData, g = data && data.mancheGame, el = document.getElementById('mch-left');
    if (!el || !g || !g.revealAt) return;
    const def = window.MANCHES_MODES[g.mode] || {};
    el.textContent = Math.max(0, Math.ceil((g.revealAt + (def.revealSeconds || 8) * 1000 - Date.now()) / 1000));
}

// --------------------------- Hôte : enchaînement des phases ---------------------------
function mchHostCheck() {
    const data = window.mchData;
    const g = data && data.mancheGame;
    if (!window.isHost || !g || g.status !== 'PLAYING') return;
    if (!window.currentRoom || window.currentRoom.status !== 'IN_GAME' || window.currentRoom.selectedMode !== g.mode) return;
    const def = window.MANCHES_MODES[g.mode];
    if (!def) return;
    const present = mchHumans(data).map(p => p.name);
    if (g.phase === 'ANSWER') {
        const rd = mchArr(g.rounds)[g.round - 1] || {};
        const ans = mchAnswers(g, g.round);
        const allIn = present.length && present.every(n => ans[n]);
        const late = Date.now() > (g.roundStartedAt || 0) + mchRoundTimer(g, rd) * 1000 + 4000;
        if (allIn || late) mchReveal(data, def);
    } else if (g.phase === 'REVEAL') {
        if (g.revealAt && Date.now() > g.revealAt + (def.revealSeconds || 8) * 1000) mchAdvance();
    }
}

function mchReveal(data, def) {
    const g = data.mancheGame;
    const key = 'rev:' + g.mode + ':' + g.startedAt + ':' + g.round;
    if (window.mchLock === key) return;
    window.mchLock = key;
    const players = mchHumans(data);
    const names = players.map(p => p.name);
    const rd = mchArr(g.rounds)[g.round - 1] || {};
    const raw = mchAnswers(g, g.round);
    const answers = {};
    names.forEach(n => { if (raw[n]) answers[n] = { a: raw[n].a == null ? '' : raw[n].a, tl: Number(raw[n].tl) || 0 }; });

    let out = { p: {}, info: {} };
    try { out = def.score({ rd: rd, answers: answers, names: names, g: g }) || out; }
    catch (e) { console.error('Calcul des points impossible :', e); }
    const resP = out.p || {};

    const updates = { 'mancheGame/phase': 'REVEAL', 'mancheGame/revealAt': Date.now() };
    players.forEach(p => {
        const r = Object.assign({ pts: 0 }, resP[p.name] || {});
        r.pts = Math.max(0, Math.round(Number(r.pts) || 0));
        updates[`mancheGame/results/r${g.round}/p/${p.name}`] = r;
        updates[`players/${p.name}/score`] = (p.score || 0) + r.pts;
    });
    if (out.info && Object.keys(out.info).length) updates[`mancheGame/results/r${g.round}/info`] = out.info;
    window.update(window.ref(window.db, `salons/${mchRoom()}`), updates)
        .catch(err => { window.mchLock = null; console.error('Révélation impossible :', err); });
}

function mchAdvance() {
    const data = window.mchData, g = data && data.mancheGame;
    if (!window.isHost || !g || g.status !== 'PLAYING' || g.phase !== 'REVEAL') return;
    const key = 'adv:' + g.mode + ':' + g.startedAt + ':' + g.round;
    if (window.mchLock === key) return;
    window.mchLock = key;
    const updates = g.round >= g.maxRounds
        ? { 'mancheGame/status': 'FINISHED' }
        : { 'mancheGame/phase': 'ANSWER', 'mancheGame/round': g.round + 1, 'mancheGame/roundStartedAt': Date.now() };
    window.update(window.ref(window.db, `salons/${mchRoom()}`), updates)
        .catch(err => { window.mchLock = null; console.error('Manche suivante impossible :', err); });
}
