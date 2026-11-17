////////////////////////////////////////////////////////////////
////////////////// --- L'INFILTRÉ (jeu de l'imposteur, habillage spatial) --- //////////////////
// Un équipage à bord d'un vaisseau, un Infiltré parmi eux. Le vote ouvre le sas d'éjection.
////////////////////////////////////////////////////////////////
// Phases (impostorGame.status) :
//   WORD_REVEAL -> WRITING (un indice chacun son tour) -> DISCUSSION -> VOTE -> SUMMARY -> retour au salon
// Toutes les transitions sont faites par l'HÔTE (impHostAdvance), les joueurs n'écrivent que leurs propres données.

// IMPOSTOR_PAIRS est défini dans constantes.js (chargé avant ce fichier)

window.impostorTimerInterval = null;
window.latestImpData = null;
window.impSig = null;
window.impTurnKey = null;
window.impLocalTurnStart = 0;
window.impAutoSentKey = null;
window.impLock = null;

function impEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function impList(v) { return Array.isArray(v) ? v : Object.values(v || {}); }
function impHumans(data) {
    return Object.values(data.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
}
function impRoom() { return window.currentCodeSalon || state.roomCode; }
function impMe() { return window.myPlayerKey || state.username; }
function impUpdate(updates) {
    const code = impRoom();
    if (!code) return Promise.resolve();
    return window.update(window.ref(window.db, `salons/${code}`), updates);
}
function impShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ---------------------------------------------------------------------
//  LANCEMENT (hôte)
// ---------------------------------------------------------------------
window.startImpostorGame = function() {
    if (!window.isHost) return;

    const names = Object.values(state.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    if (names.length < 3) {
        if (typeof showToast === 'function') showToast("⚠️ Il faut au moins 3 membres d'équipage pour L'Infiltré !");
        else alert("Il faut au moins 3 membres d'équipage pour L'Infiltré !");
        return;
    }

    const pair = IMPOSTOR_PAIRS[Math.floor(Math.random() * IMPOSTOR_PAIRS.length)];
    const shuffled = impShuffle(names);

    const roles = {};
    roles[shuffled[0]] = { role: 'impostor', word: pair.impostor };
    let start = 1;
    if (names.length >= 5) {                       // Mr. White à partir de 5 joueurs
        roles[shuffled[1]] = { role: 'mrwhite', word: '???' };
        start = 2;
    }
    for (let i = start; i < shuffled.length; i++) roles[shuffled[i]] = { role: 'citizen', word: pair.citizen };

    const rounds = Math.max(1, Math.min(5, parseInt(document.getElementById('setting-impostor-rounds')?.value, 10) || 2));
    const timer = Math.max(10, Math.min(90, parseInt(document.getElementById('input-host-timer')?.value, 10) || 30));

    window.mettreAJourSalonFirebase(impRoom(), {
        status: 'IN_GAME',
        selectedMode: 'impostor',
        'settings/timer': timer,
        'settings/impostorRounds': rounds,
        impostorGame: {
            status: 'WORD_REVEAL',
            pair: pair,
            roles: roles,
            turnOrder: impShuffle(names),          // ordre de jeu indépendant des rôles
            currentTurnIndex: 0,
            currentRound: 1,
            maxRounds: rounds,
            roundTimer: timer,
            turnStart: 0,
            startedAt: Date.now()
        }
    });
};

// ---------------------------------------------------------------------
//  ACTIONS DES JOUEURS (chacun n'écrit que ses propres données)
// ---------------------------------------------------------------------
window.setImpostorReadyForWriting = function() {
    impUpdate({ [`impostorGame/readyToWriting/${impMe()}`]: true }).catch(e => console.error(e));
};
// Dernière chance de l'Infiltré démasqué : il propose le mot de l'équipage
const IMP_GUESS_SECONDS = 30;
function impMotCle(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^((les|le|la|une|un|des)\s+|l['’]\s*)/, '').replace(/[^a-z0-9]/g, '').replace(/(s|x)$/, '');
}
window.submitImpostorGuess = function() {
    const el = document.getElementById('imp-guess-input');
    const mot = el ? el.value.trim().slice(0, 40) : '';
    if (!mot) { if (el) el.focus(); return; }
    impUpdate({ 'impostorGame/guess/word': mot, 'impostorGame/guess/sent': true }).catch(e => console.error(e));
};
window.setImpostorReadyForVote = function() {
    impUpdate({ [`impostorGame/readyToVote/${impMe()}`]: true }).catch(e => console.error(e));
};
window.setImpostorReadyForMenu = function() {
    impUpdate({ [`impostorGame/readyToMenu/${impMe()}`]: true }).catch(e => console.error(e));
};

window.submitImpostorClue = function(auto) {
    const data = window.latestImpData;
    if (!data || !data.impostorGame || data.impostorGame.status !== 'WRITING') return;
    const g = data.impostorGame;
    const me = impMe();
    const order = impList(g.turnOrder);
    if (order[g.currentTurnIndex || 0] !== me) return;

    const input = document.getElementById('input-impostor-clue');
    let clue = input ? input.value.trim() : '';
    if (!clue) {
        if (auto !== true) { alert("Veuillez écrire un indice valide !"); return; }
        clue = "(Temps écoulé)";
    }
    const round = g.currentRound || 1;
    if (input) input.disabled = true;
    impUpdate({ [`impostorGame/writingData/${round}/${me}`]: clue.slice(0, 40) })
        .catch(e => { if (input) input.disabled = false; console.error(e); });
};

window.submitImpostorVote = function(btn) {
    const target = (btn && btn.dataset) ? btn.dataset.target : btn;
    if (!target) return;
    impUpdate({ [`impostorGame/votes/${impMe()}`]: target }).catch(e => console.error(e));
};

// ---------------------------------------------------------------------
//  HÔTE : fait avancer les phases
// ---------------------------------------------------------------------
function impHostAdvance(data) {
    if (!window.isHost || !data || !data.impostorGame) return;
    const g = data.impostorGame;
    const present = impHumans(data);
    if (!present.length) return;
    const now = Date.now();
    const round = g.currentRound || 1;
    const idx = g.currentTurnIndex || 0;

    const key = `${g.startedAt}:${g.status}:${round}:${idx}`;
    if (window.impLock === key) return;
    const send = (updates) => {
        window.impLock = key;
        impUpdate(updates).catch(e => { window.impLock = null; console.error('Transition Imposteur impossible :', e); });
    };

    if (g.status === 'WORD_REVEAL') {
        const ready = g.readyToWriting || {};
        if (present.every(n => ready[n])) {
            send({ 'impostorGame/status': 'WRITING', 'impostorGame/currentRound': 1,
                   'impostorGame/currentTurnIndex': 0, 'impostorGame/turnStart': now });
        }

    } else if (g.status === 'WRITING') {
        const order = impList(g.turnOrder);
        const active = order[idx];
        const clues = (g.writingData && g.writingData[round]) || {};
        const absent = !present.includes(active);
        const timedOut = g.turnStart && (now - g.turnStart) > ((g.roundTimer || 30) + 4) * 1000;

        if (clues[active] || absent || timedOut) {
            const updates = {};
            if (!clues[active] && !absent) updates[`impostorGame/writingData/${round}/${active}`] = "(Temps écoulé)";
            let ni = idx + 1;
            if (ni >= order.length) {
                if (round < (g.maxRounds || 2)) {
                    updates['impostorGame/currentRound'] = round + 1;
                    ni = 0;
                } else {
                    updates['impostorGame/status'] = 'DISCUSSION';
                }
            }
            updates['impostorGame/currentTurnIndex'] = ni;
            updates['impostorGame/turnStart'] = now;
            send(updates);
        }

    } else if (g.status === 'DISCUSSION') {
        const ready = g.readyToVote || {};
        if (present.every(n => ready[n])) send({ 'impostorGame/status': 'VOTE' });

    } else if (g.status === 'VOTE') {
        const votes = g.votes || {};
        if (present.every(n => votes[n])) {
            const counts = {};
            present.forEach(n => { counts[votes[n]] = (counts[votes[n]] || 0) + 1; });
            const max = Math.max(...Object.values(counts));
            const top = Object.keys(counts).filter(k => counts[k] === max);
            let msg;
            if (top.length > 1) {
                msg = `Égalité des votes (${top.join(', ')}) : le sas reste fermé, l'Infiltré gagne !`;
            } else {
                const r = (g.roles[top[0]] || {}).role;
                msg = (r === 'impostor' || r === 'mrwhite')
                    ? `Victoire de l'équipage ! ${top[0]} était ${r === 'mrwhite' ? 'le Clandestin' : "l'Infiltré"} !`
                    : `Victoire de l'Infiltré ! ${top[0]} était un membre d'équipage innocent.`;
            }
            // joueur expulsé par le sas (vide en cas d'égalité) : sert à l'animation d'éjection chez tout le monde
            const ejecte = top.length > 1 ? { name: '', egalite: top.join(', ') } : { name: top[0], role: (g.roles[top[0]] || {}).role || 'citizen' };
            const demasque = top.length === 1 && (ejecte.role === 'impostor' || ejecte.role === 'mrwhite') && present.indexOf(top[0]) >= 0;
            if (demasque) {
                // Dernière chance : l'Infiltré démasqué peut encore gagner en devinant le mot de l'équipage
                send({ 'impostorGame/status': 'GUESS', 'impostorGame/guess': { name: top[0], role: ejecte.role, at: Date.now(), word: '' } });
            } else send({ 'impostorGame/status': 'SUMMARY', 'impostorGame/winnerMessage': msg, 'impostorGame/ejecte': ejecte });
        }

    } else if (g.status === 'GUESS') {
        const q = g.guess || {};
        const fini = !!q.sent || present.indexOf(q.name) < 0 || Date.now() - (q.at || 0) > (IMP_GUESS_SECONDS + 1) * 1000;
        if (fini) {
            const mot = (g.pair && g.pair.citizen) || '';
            const ok = !!q.word && impMotCle(q.word) === impMotCle(mot);
            const qui = q.role === 'mrwhite' ? 'le Clandestin' : "l'Infiltré";
            const msg = ok
                ? `${q.name} était ${qui}... mais il a deviné le mot de l'équipage (« ${mot} ») : il s'échappe et gagne !`
                : `Victoire de l'équipage ! ${q.name} était ${qui} et n'a pas trouvé le mot (« ${mot} »)${q.word ? ' : il a proposé « ' + q.word + ' »' : ''}.`;
            send({ 'impostorGame/status': 'SUMMARY', 'impostorGame/winnerMessage': msg, 'impostorGame/ejecte': { name: q.name, role: q.role, sauve: ok } });
        }

    } else if (g.status === 'SUMMARY') {
        const ready = g.readyToMenu || {};
        if (present.every(n => ready[n])) {
            const updates = { status: 'LOBBY', impostorGame: null, lobbyReturn: null };
            Object.keys(data.players || {}).forEach(k => { updates[`players/${k}/isReady`] = false; });
            send(updates);
        }
    }
}

// Horloge : affichage du temps restant + envoi automatique de l'indice + garde-fous de l'hôte
function impTick() {
    const data = window.latestImpData;
    if (!data || !data.impostorGame || data.status !== 'IN_GAME') {
        clearInterval(window.impostorTimerInterval);
        window.impostorTimerInterval = null;
        return;
    }
    const g = data.impostorGame;
    if (g.status === 'WRITING') {
        const left = Math.max(0, Math.ceil((g.roundTimer || 30) - (Date.now() - window.impLocalTurnStart) / 1000));
        const el = document.getElementById('impostor-timer-display');
        if (el) el.innerText = left + 's';
        const order = impList(g.turnOrder);
        const me = impMe();
        if (left <= 0 && order[g.currentTurnIndex || 0] === me && window.impAutoSentKey !== window.impTurnKey) {
            window.impAutoSentKey = window.impTurnKey;
            window.submitImpostorClue(true);
        }
    }
    if (g.status === 'GUESS' && g.guess) {
        const el = document.getElementById('imp-guess-left');
        if (el) el.innerText = Math.max(0, Math.ceil(IMP_GUESS_SECONDS - (Date.now() - (g.guess.at || 0)) / 1000)) + ' s';
    }
    if (window.isHost) impHostAdvance(data);
}

// ---------------------------------------------------------------------
//  AFFICHAGE
// ---------------------------------------------------------------------
window.renderImpostorScreen = function(data) {
    const mainArea = document.getElementById('impostor-main-area');
    const timerEl = document.getElementById('impostor-timer');
    if (!mainArea) return;

    const g = data.impostorGame;
    if (!g) {
        mainArea.innerHTML = `<div class="text-xl font-bold text-slate-400">Préparation de la partie en cours...</div>`;
        return;
    }
    window.latestImpData = data;
    if (!window.impostorTimerInterval) window.impostorTimerInterval = setInterval(impTick, 1000);

    const me = impMe();
    const myRole = g.roles ? g.roles[me] : null;
    const present = impHumans(data);
    const round = g.currentRound || 1;
    const idx = g.currentTurnIndex || 0;
    const order = impList(g.turnOrder);

    // Le chrono local repart à chaque changement de tour
    if (g.status === 'WRITING') {
        const tk = `${g.startedAt}:${round}:${idx}`;
        if (window.impTurnKey !== tk) { window.impTurnKey = tk; window.impLocalTurnStart = Date.now(); }
        if (timerEl) {
            const left = Math.max(0, Math.ceil((g.roundTimer || 30) - (Date.now() - window.impLocalTurnStart) / 1000));
            timerEl.innerHTML = `Tour ${round} / ${g.maxRounds} - <span id="impostor-timer-display" class="text-amber-400 font-black">${left}s</span>`;
        }
    } else if (timerEl) {
        timerEl.innerText = { WORD_REVEAL: 'Transmission du mot de passe', DISCUSSION: 'Conseil de bord', VOTE: 'Sas d\'éjection', GUESS: 'Dernière chance', SUMMARY: 'Rapport de mission' }[g.status] || '';
    }

    if (!myRole) {
        mainArea.innerHTML = `<div class="p-6 bg-red-500/20 border border-red-500 rounded-xl text-red-400 font-bold">Vous n'avez pas de rôle dans cette partie. Attendez la prochaine.</div>`;
        if (window.isHost) impHostAdvance(data);
        return;
    }

    // On ne reconstruit l'HTML que si quelque chose de pertinent a changé (sinon le champ de saisie est effacé)
    const sig = JSON.stringify([g.startedAt, g.status, round, idx, g.writingData || null, g.readyToWriting || null,
        g.readyToVote || null, g.votes || null, g.readyToMenu || null, g.winnerMessage || null, g.guess ? [g.guess.name, !!g.guess.sent] : null, present]);
    if (sig !== window.impSig) {
        window.impSig = sig;
        impBuildHtml(mainArea, g, me, myRole, present, order, round, idx);
    }
    if (window.isHost) impHostAdvance(data);
};

function impBuildHtml(mainArea, g, me, myRole, present, order, round, idx) {
    const btnWait = '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres...';

    if (g.status === 'WORD_REVEAL') {
        let roleDesc, word;
        if (myRole.role === 'impostor') {
            roleDesc = "Vous êtes l'<span class='text-red-400 font-black'>INFILTRÉ</span> ! Votre mot est proche de celui de l'équipage : bluffez pour rester à bord.";
            word = myRole.word;
        } else if (myRole.role === 'mrwhite') {
            roleDesc = "Vous êtes le <span class='text-purple-400 font-black'>CLANDESTIN</span> ! Vous n'avez pas de mot, fondez-vous dans l'équipage.";
            word = "??? (Aucun mot)";
        } else {
            roleDesc = "Vous êtes un <span class='text-emerald-400 font-black'>MEMBRE D'ÉQUIPAGE</span>.";
            word = myRole.word;
        }
        const ready = !!(g.readyToWriting && g.readyToWriting[me]);
        mainArea.innerHTML = `
            <h3 class="text-2xl font-black text-white mb-2">Votre Rôle Secret</h3>
            <p class="text-sm text-slate-300 mb-6">${roleDesc}</p>
            <div class="p-6 bg-slate-900 border border-slate-700 rounded-2xl max-w-sm mx-auto mb-6 shadow-xl">
                <span class="text-xs text-slate-400 uppercase font-mono block mb-1">Votre mot secret :</span>
                <span class="text-3xl font-black text-amber-400 tracking-wider">${impEsc(word)}</span>
            </div>
            <button ${ready ? 'disabled' : ''} onclick="setImpostorReadyForWriting()" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${ready ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}">
                ${ready ? btnWait : "Aller à la phase d'écriture"}
            </button>`;

    } else if (g.status === 'WRITING') {
        const active = order[idx];
        const isMyTurn = active === me;
        const clues = (g.writingData && g.writingData[round]) || {};

        const list = order.map((n, i) => {
            const isCurrent = i === idx;
            let status, text;
            if (clues[n]) {
                status = '<i class="fa-solid fa-check text-emerald-400"></i>';
                text = `<span class="text-white font-bold">"${impEsc(clues[n])}"</span>`;
            } else if (i < idx) {
                status = '<i class="fa-solid fa-minus text-slate-500"></i>';
                text = '<span class="text-slate-500 italic">—</span>';
            } else if (isCurrent) {
                status = '<i class="fa-solid fa-pen text-amber-400 animate-pulse"></i>';
                text = '<span class="text-amber-400 italic">En train d\'écrire...</span>';
            } else {
                status = '<i class="fa-solid fa-clock text-slate-500"></i>';
                text = '<span class="text-slate-500 italic">En attente</span>';
            }
            return `<div class="p-3 rounded-xl border ${isCurrent ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-900 border-slate-800'} flex justify-between items-center text-sm shadow-sm">
                <div class="flex items-center gap-2">${status} <span class="font-bold ${isCurrent ? 'text-amber-400' : 'text-slate-300'}">${impEsc(n)}</span></div>
                <div>${text}</div></div>`;
        }).join('');

        const inputHtml = isMyTurn ? `
            <div class="max-w-md mx-auto space-y-3 mt-6">
                <div class="text-emerald-400 font-bold text-sm mb-2 animate-pulse"><i class="fa-solid fa-keyboard"></i> C'est à votre tour !</div>
                <input type="text" id="input-impostor-clue" maxlength="40" autocomplete="off" placeholder="Votre mot indice..."
                    onkeydown="if(event.key==='Enter') submitImpostorClue()"
                    class="w-full bg-slate-900 border border-emerald-500 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-emerald-400 font-mono text-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <button onclick="submitImpostorClue()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition">Soumettre mon Indice</button>
            </div>` : `
            <div class="max-w-md mx-auto mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-sm">
                <i class="fa-solid fa-hourglass-half animate-spin"></i> En attente de <strong class="text-amber-400">${impEsc(active)}</strong>...
            </div>`;

        mainArea.innerHTML = `
            <h3 class="text-2xl font-black text-indigo-300 mb-2">Phase d'Écriture</h3>
            <p class="text-xs text-slate-400 mb-4">Chaque joueur écrit un mot à tour de rôle pour prouver son identité.</p>
            <div class="max-w-md mx-auto space-y-2 mb-4">${list}</div>${inputHtml}`;
        const inp = document.getElementById('input-impostor-clue');
        if (inp) inp.focus();

    } else if (g.status === 'DISCUSSION') {
        let html = '';
        for (let r = 1; r <= (g.maxRounds || 1); r++) {
            const rd = g.writingData && g.writingData[r];
            if (!rd) continue;
            html += `<div class="text-sm font-bold text-indigo-400 mb-2 mt-4">--- Tour ${r} ---</div>`;
            order.forEach(n => {
                if (rd[n]) html += `<div class="p-3 bg-slate-900 rounded-xl mb-2 flex justify-between text-sm font-mono border border-slate-800"><span class="text-slate-400">${impEsc(n)}:</span> <strong class="text-white text-base">"${impEsc(rd[n])}"</strong></div>`;
            });
        }
        const ready = !!(g.readyToVote && g.readyToVote[me]);
        mainArea.innerHTML = `
            <h3 class="text-2xl font-black text-indigo-300 mb-2">Ouvrez le débat !</h3>
            <p class="text-sm text-slate-400 mb-4">Voici tous les indices écrits :</p>
            <div class="max-w-3xl mx-auto w-full bg-slate-950/80 border border-slate-800 p-6 rounded-2xl overflow-y-auto mb-6 text-left space-y-2 min-h-[250px] shadow-inner">
                ${html || '<span class="text-slate-500 italic">Aucun indice enregistré.</span>'}
            </div>
            <button ${ready ? 'disabled' : ''} onclick="setImpostorReadyForVote()" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${ready ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}">
                ${ready ? btnWait : 'Ouvrir le sas d\'éjection'}
            </button>`;

    } else if (g.status === 'VOTE') {
        const myVote = g.votes ? g.votes[me] : null;
        if (myVote) {
            mainArea.innerHTML = `
                <h3 class="text-3xl font-black text-emerald-400 mb-4"><i class="fa-solid fa-check-circle"></i> Vote verrouillé</h3>
                <p class="text-lg text-slate-300 mb-6">Vous voulez éjecter <strong class="text-white">${impEsc(myVote)}</strong>.</p>
                <div class="max-w-md mx-auto p-5 bg-slate-900 rounded-2xl border border-slate-700 text-amber-400 animate-pulse font-bold text-lg shadow-lg">
                    <i class="fa-solid fa-hourglass-half"></i> En attente du vote du reste de l'équipage...
                </div>`;
        } else {
            const buttons = present.filter(p => p !== me).map(p => `
                <button data-target="${impEsc(p)}" onclick="submitImpostorVote(this)" class="p-4 bg-slate-900 hover:bg-red-500/20 border border-slate-700 hover:border-red-500 rounded-xl font-bold text-base transition text-white shadow-md">
                    🚪 Éjecter ${impEsc(p)}
                </button>`).join('');
            mainArea.innerHTML = `
                <h3 class="text-3xl font-black text-red-400 mb-2">Qui passe par le sas ?</h3>
                <p class="text-sm text-slate-400 mb-8">Désignez le membre d'équipage que vous suspectez d'être l'Infiltré ou le Clandestin.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">${buttons}</div>`;
        }

    } else if (g.status === 'GUESS') {
        const q = g.guess || {}, qui = q.role === 'mrwhite' ? 'le Clandestin' : "l'Infiltré";
        const reste = `<span id="imp-guess-left" style="font-family:monospace;font-weight:800;color:#fbbf24">${IMP_GUESS_SECONDS} s</span>`;
        if (q.name === me) {
            mainArea.innerHTML = `
                <h3 style="font-size:1.7rem;font-weight:900;color:#f87171;margin-bottom:.4rem">🚨 Vous êtes démasqué !</h3>
                <p style="color:#e2e8f0;margin-bottom:1rem">Dernière chance avant le sas : devinez le <b>mot de l'équipage</b> et vous vous échappez. ${reste}</p>
                ${q.sent ? '<div style="color:#94a3b8"><i class="fa-solid fa-hourglass-half"></i> Proposition envoyée...</div>' : `
                <div style="display:flex;gap:.5rem;max-width:26rem;margin:0 auto">
                    <input id="imp-guess-input" type="text" maxlength="40" autocomplete="off" placeholder="Le mot de l'équipage..." onkeydown="if(event.key==='Enter') submitImpostorGuess()" style="flex:1;min-width:0;background:#0f172a;border:1px solid #f87171;border-radius:12px;padding:.8rem 1rem;color:#fff;font-size:16px">
                    <button onclick="submitImpostorGuess()" style="padding:.8rem 1.1rem;border-radius:12px;border:0;background:#dc2626;color:#fff;font-weight:800;cursor:pointer;font-family:inherit">Tenter</button>
                </div>
                <p style="font-size:.8rem;color:#94a3b8;margin-top:.8rem">Les accents, les majuscules et le pluriel ne comptent pas.</p>`}`;
            const champ = document.getElementById('imp-guess-input'); if (champ) champ.focus();
        } else {
            mainArea.innerHTML = `
                <h3 style="font-size:1.7rem;font-weight:900;color:#6ee7b7;margin-bottom:.4rem">🚨 ${impEsc(q.name)} est démasqué !</h3>
                <p style="color:#e2e8f0;margin-bottom:.6rem">C'était bien ${qui}. Mais il lui reste une <b>dernière chance</b> : s'il devine votre mot, il s'échappe et gagne.</p>
                <div style="display:inline-block;padding:.9rem 1.4rem;border-radius:14px;border:1px dashed #fbbf24;background:rgba(69,26,3,.4);color:#fde68a;font-weight:700">
                    <i class="fa-solid fa-hourglass-half animate-spin"></i> ${impEsc(q.name)} cherche le mot de l'équipage... ${reste}</div>`;
        }

    } else if (g.status === 'SUMMARY') {
        const roleName = { impostor: 'Infiltré', mrwhite: 'Clandestin', citizen: 'Équipage' };
        if (window.impSasVu !== g.startedAt) { window.impSasVu = g.startedAt; impSas(g, roleName); }      // animation du sas, une fois par partie
        const rows = Object.entries(g.roles || {}).map(([n, info]) => `
            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-sm shadow-sm">
                <div><strong class="text-white">${impEsc(n)}</strong> <span class="text-slate-400">(${roleName[info.role] || info.role})</span></div>
                <span class="font-mono text-amber-400 font-bold">Mot : ${impEsc(info.word)}</span>
            </div>`).join('');
        const ready = !!(g.readyToMenu && g.readyToMenu[me]);
        mainArea.innerHTML = `
            <h3 class="text-3xl font-black bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent mb-2">Rapport de mission</h3>
            <div class="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-300 font-bold text-base mb-6 max-w-xl mx-auto">${impEsc(g.winnerMessage || 'Partie terminée.')}</div>
            <div class="max-w-xl mx-auto space-y-2 mb-8 text-left max-h-64 overflow-y-auto pr-2">${rows}</div>
            <button ${ready ? 'disabled' : ''} onclick="setImpostorReadyForMenu()" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${ready ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}">
                ${ready ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente du menu...' : 'Retour au salon'}
            </button>`;
    }
}

// ---------- Sas d'éjection : le joueur désigné est expulsé dans l'espace, puis son rôle est révélé ----------
function impSas(g, roleName) {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('imp-sas-style')) {
        const st = document.createElement('style'); st.id = 'imp-sas-style';
        st.textContent = `
#imp-sas{position:fixed;inset:0;z-index:10020;overflow:hidden;background:radial-gradient(circle at 50% 45%,#0b1a30 0%,#02040a 75%);display:flex;align-items:center;justify-content:center;animation:impSasFond 5.2s ease forwards}
#imp-sas .etoiles{position:absolute;inset:-50%;background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#cbd5e1,transparent),radial-gradient(1.5px 1.5px at 45% 80%,#fff,transparent),radial-gradient(1px 1px at 85% 15%,#e2e8f0,transparent),radial-gradient(1px 1px at 10% 70%,#fff,transparent);background-size:260px 260px;animation:impEtoiles 5.2s linear forwards}
#imp-sas .porte{position:absolute;top:0;bottom:0;width:50%;background:repeating-linear-gradient(0deg,#1e293b 0 38px,#172033 38px 42px);border:3px solid #475569;box-shadow:inset 0 0 60px rgba(0,0,0,.7)}
#imp-sas .porte.g{left:0;animation:impPorteG 5.2s ease-in-out forwards}
#imp-sas .porte.d{right:0;animation:impPorteD 5.2s ease-in-out forwards}
#imp-sas .porte::after{content:"⚠ SAS";position:absolute;top:50%;font-weight:900;letter-spacing:.2em;color:#fbbf24;font-size:22px;transform:translateY(-50%)}
#imp-sas .porte.g::after{right:18px}#imp-sas .porte.d::after{left:18px}
#imp-sas .corps{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;animation:impCorps 5.2s ease-in forwards}
#imp-sas .corps img,#imp-sas .corps .rond{width:110px;height:110px;border-radius:50%;border:4px solid #f87171;object-fit:cover;background:#0f172a;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:900;color:#f87171;box-shadow:0 0 30px rgba(248,113,113,.7)}
#imp-sas .corps b{color:#fff;font-size:20px;letter-spacing:.06em}
#imp-sas .verdict{position:absolute;left:0;right:0;bottom:16%;text-align:center;font-weight:900;font-size:24px;letter-spacing:.08em;padding:0 16px;opacity:0;animation:impVerdict 5.2s ease forwards}
#imp-sas .alerte{position:absolute;left:0;right:0;top:12%;text-align:center;font-weight:900;letter-spacing:.3em;color:#f87171;font-size:18px;animation:impAlerte .5s steps(2) 5}
@keyframes impPorteG{0%,18%{transform:translateX(0)}34%,100%{transform:translateX(-101%)}}
@keyframes impPorteD{0%,18%{transform:translateX(0)}34%,100%{transform:translateX(101%)}}
@keyframes impCorps{0%,30%{transform:scale(1) rotate(0);opacity:1}62%{transform:scale(.16) rotate(540deg) translate(120px,-320px);opacity:.9}70%,100%{transform:scale(0) rotate(720deg) translate(200px,-600px);opacity:0}}
@keyframes impVerdict{0%,62%{opacity:0;transform:scale(.7)}70%,90%{opacity:1;transform:scale(1)}100%{opacity:0}}
@keyframes impAlerte{0%{opacity:1}100%{opacity:.15}}
@keyframes impEtoiles{0%{transform:scale(1)}100%{transform:scale(1.5) rotate(8deg)}}
@keyframes impSasFond{0%,90%{opacity:1}100%{opacity:0}}`;
        document.head.appendChild(st);
    }
    const old = document.getElementById('imp-sas'); if (old) old.remove();
    const e = g.ejecte || {};
    const ov = document.createElement('div'); ov.id = 'imp-sas';
    if (!e.name) {
        // égalité : personne n'est expulsé
        ov.innerHTML = `<div class="etoiles"></div><div class="porte g" style="animation:none"></div><div class="porte d" style="animation:none"></div>
            <div class="verdict" style="bottom:42%;color:#fbbf24;animation:impVerdict 3.4s ease forwards;animation-delay:-2s">ÉGALITÉ DES VOTES<br><span style="font-size:15px;color:#e2e8f0">Le sas reste fermé : l'Infiltré est toujours à bord.</span></div>`;
        document.body.appendChild(ov);
        setTimeout(() => ov.remove(), 3000);
        return;
    }
    if (e.sauve) {
        // le mot a été deviné : le sas ne s'ouvre pas
        ov.innerHTML = `<div class="etoiles"></div><div class="porte g" style="animation:none"></div><div class="porte d" style="animation:none"></div>
            <div class="verdict" style="bottom:40%;color:#f87171;animation:impVerdict 3.6s ease forwards;animation-delay:-2s">${impEsc(e.name)} A DEVINÉ LE MOT !<br><span style="font-size:15px;color:#e2e8f0">Le sas reste fermé : ${e.role === 'mrwhite' ? 'le Clandestin' : "l'Infiltré"} s'échappe et gagne.</span></div>`;
        document.body.appendChild(ov);
        if (typeof window.sfx === 'function') window.sfx('coule');
        setTimeout(() => ov.remove(), 3300);
        return;
    }
    const room = window.currentRoom || {}, pl = (room.players || {})[e.name] || {};
    const src = pl.avatar && pl.avatar.src;
    const coupable = e.role === 'impostor' || e.role === 'mrwhite';
    const visage = document.createElement(src ? 'img' : 'div');
    if (src) visage.src = src; else { visage.className = 'rond'; visage.textContent = String(e.name).charAt(0).toUpperCase(); }
    ov.innerHTML = `<div class="etoiles"></div><div class="corps"><b></b></div><div class="porte g"></div><div class="porte d"></div><div class="alerte">ÉJECTION EN COURS</div><div class="verdict"></div>`;
    ov.querySelector('.corps').insertBefore(visage, ov.querySelector('.corps b'));
    ov.querySelector('.corps b').textContent = e.name;
    const v = ov.querySelector('.verdict');
    v.style.color = coupable ? '#6ee7b7' : '#f87171';
    v.textContent = e.name + (coupable ? ' était ' + (e.role === 'mrwhite' ? 'le Clandestin' : "l'Infiltré") + ' !' : " était un membre d'équipage innocent...");
    document.body.appendChild(ov);
    if (typeof window.sfx === 'function') {
        window.sfx('alarme');                               // alerte d'éjection
        setTimeout(() => window.sfx('sas'), 900);           // les portes s'ouvrent (18 % de 5,2 s)
        setTimeout(() => window.sfx(coupable ? 'victoire' : 'coule'), 3500);
    }
    setTimeout(() => ov.remove(), 5200);
}
