////////////////////////////////////////////////////////////////
////////////////// --- JEU DE L'IMPOSTEUR --- //////////////////
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
        if (typeof showToast === 'function') showToast("⚠️ Il faut au moins 3 joueurs pour le mode Imposteur !");
        else alert("Il faut au moins 3 joueurs pour le mode Imposteur !");
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
                msg = `Égalité des votes (${top.join(', ')}) : l'Imposteur gagne !`;
            } else {
                const r = (g.roles[top[0]] || {}).role;
                msg = (r === 'impostor' || r === 'mrwhite')
                    ? `Victoire des Citoyens ! ${top[0]} était ${r === 'mrwhite' ? 'Mr. White' : "l'Imposteur"} !`
                    : `Victoire de l'Imposteur ! ${top[0]} était un citoyen innocent.`;
            }
            send({ 'impostorGame/status': 'SUMMARY', 'impostorGame/winnerMessage': msg });
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
        timerEl.innerText = { WORD_REVEAL: 'Révélation des mots', DISCUSSION: 'Phase de Discussion', VOTE: 'Phase de Vote', SUMMARY: 'Fin de Partie' }[g.status] || '';
    }

    if (!myRole) {
        mainArea.innerHTML = `<div class="p-6 bg-red-500/20 border border-red-500 rounded-xl text-red-400 font-bold">Vous n'avez pas de rôle dans cette partie. Attendez la prochaine.</div>`;
        if (window.isHost) impHostAdvance(data);
        return;
    }

    // On ne reconstruit l'HTML que si quelque chose de pertinent a changé (sinon le champ de saisie est effacé)
    const sig = JSON.stringify([g.startedAt, g.status, round, idx, g.writingData || null, g.readyToWriting || null,
        g.readyToVote || null, g.votes || null, g.readyToMenu || null, g.winnerMessage || null, present]);
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
            roleDesc = "Vous êtes l'<span class='text-red-400 font-black'>IMPOSTEUR</span> ! Votre mot est proche de celui des autres : bluffez pour survivre.";
            word = myRole.word;
        } else if (myRole.role === 'mrwhite') {
            roleDesc = "Vous êtes <span class='text-purple-400 font-black'>MR. WHITE</span> ! Vous n'avez pas de mot, fondez-vous dans la masse.";
            word = "??? (Aucun mot)";
        } else {
            roleDesc = "Vous êtes un <span class='text-emerald-400 font-black'>CITOYEN</span>.";
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
                ${ready ? btnWait : 'Aller à la phase de vote'}
            </button>`;

    } else if (g.status === 'VOTE') {
        const myVote = g.votes ? g.votes[me] : null;
        if (myVote) {
            mainArea.innerHTML = `
                <h3 class="text-3xl font-black text-emerald-400 mb-4"><i class="fa-solid fa-check-circle"></i> Vote enregistré</h3>
                <p class="text-lg text-slate-300 mb-6">Vous avez voté contre <strong class="text-white">${impEsc(myVote)}</strong>.</p>
                <div class="max-w-md mx-auto p-5 bg-slate-900 rounded-2xl border border-slate-700 text-amber-400 animate-pulse font-bold text-lg shadow-lg">
                    <i class="fa-solid fa-hourglass-half"></i> En attente du vote des autres joueurs...
                </div>`;
        } else {
            const buttons = present.filter(p => p !== me).map(p => `
                <button data-target="${impEsc(p)}" onclick="submitImpostorVote(this)" class="p-4 bg-slate-900 hover:bg-red-500/20 border border-slate-700 hover:border-red-500 rounded-xl font-bold text-base transition text-white shadow-md">
                    Voter contre ${impEsc(p)}
                </button>`).join('');
            mainArea.innerHTML = `
                <h3 class="text-3xl font-black text-red-400 mb-2">Qui est l'Imposteur ?</h3>
                <p class="text-sm text-slate-400 mb-8">Cliquez sur le joueur que vous suspectez d'être l'Imposteur ou Mr. White.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">${buttons}</div>`;
        }

    } else if (g.status === 'SUMMARY') {
        const roleName = { impostor: 'Imposteur', mrwhite: 'Mr. White', citizen: 'Citoyen' };
        const rows = Object.entries(g.roles || {}).map(([n, info]) => `
            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-sm shadow-sm">
                <div><strong class="text-white">${impEsc(n)}</strong> <span class="text-slate-400">(${roleName[info.role] || info.role})</span></div>
                <span class="font-mono text-amber-400 font-bold">Mot : ${impEsc(info.word)}</span>
            </div>`).join('');
        const ready = !!(g.readyToMenu && g.readyToMenu[me]);
        mainArea.innerHTML = `
            <h3 class="text-3xl font-black bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent mb-2">Récapitulatif de la Partie</h3>
            <div class="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-300 font-bold text-base mb-6 max-w-xl mx-auto">${impEsc(g.winnerMessage || 'Partie terminée.')}</div>
            <div class="max-w-xl mx-auto space-y-2 mb-8 text-left max-h-64 overflow-y-auto pr-2">${rows}</div>
            <button ${ready ? 'disabled' : ''} onclick="setImpostorReadyForMenu()" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${ready ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}">
                ${ready ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente du menu...' : 'Retour au salon'}
            </button>`;
    }
}
