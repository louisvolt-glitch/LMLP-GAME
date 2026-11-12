// --- LOGIQUE DU PETIT BAC ---
let currentBacLetter = 'A';
let bacCategories = [
    		// --- Classiques ---
    		"Pays / Ville", "Prénom", "Animal", "Fruit / Légume", "Métier", "Objet",
    		"Couleur", "Plante / Fleur", "Vêtement", "Partie du corps", "Nourriture / Boisson",
    		"Sport", "Marque", "Film", "Série TV", "Chanteur / Groupe",
    		"Livre / Auteur", "Jeu vidéo", "Monument", "Matière",
    
    		// --- Pop Culture & Divertissement ---
    		"Personnage de fiction", "Super-héros / Super-vilain", "Dessin animé", "Jeu de société",
    		"Instrument de musique", "Style musical", "Chanson connue", "Jeu d'arcade / Rétrogaming",
    		"Créature fantastique / Monstre", "Pokémon", "Arme médiévale / Fantastique", "Objet magique",
    		"Super-pouvoir", "Plateforme de streaming", "Réseau social", "Hashtag / Tendance web",
    		"Application mobile", "Émission de télévision", "Youtubeur / Streamer", "Studio de jeux vidéo",

    		// --- Géographie & Lieux ---
    		"Capitale", "Fleuve / Rivière", "Montagne / Chaîne de montagnes", "Océan / Mer",
    		"Île / Archipel", "Désert", "Monument historique", "Merveille du monde",
    		"Région / Province", "Continent", "Nom de rue / Avenue", "Type de bâtiment",
    		"Lieu de vacances", "Parc d'attractions", "Aéroport international", "Stade de sport",
    		"Pont célèbre", "Château / Palais", "Musée", "Forêt / Jungle",

    		// --- Cuisine & Gastronomie ---
    		"Plat cuisiné", "Fromage", "Dessert / Pâtisserie", "Épice / Condiment",
    		"Boisson alcoolisée", "Cocktail", "Ustensile de cuisine", "Fast-food / Restauration rapide",
    		"Recette de pizza", "Confiserie / Bonbon", "Type de pain", "Céréale / Graine",
    		"Légumineuse", "Fruit de mer / Poisson", "Mode de cuisson", "Marque de chocolat",

    		// --- Nature, Science & Quotidien ---
    		"Oiseau", "Mammifère marin", "Insecte / Arachnide", "Race de chien",
    		"Race de chat", "Reptile / Amphibien", "Arbre", "Phénomène météorologique",
    		"Élément chimique", "Planète / Corps céleste", "Constellation", "Outil de bricolage",
    		"Meuble de maison", "Appareil électroménager", "Véhicule", "Marque de voiture",
    		"Pièce d'une maison", "Fourniture scolaire", "Moyen de transport en commun", "Type de tissu / Matière vestimentaire",

    		// --- Adjectifs, Verbes & Divers ---
    		"Adjectif qualificatif", "Verbe d'action", "Métier difficile", "Chose qu'on trouve dans une cuisine",
    		"Chose qu'on trouve dans un garage", "Chose qu'on achète en pharmacie", "Chose rouge",
    		"Chose invisible", "Chose qui fait peur", "Chose qui fait du bruit", "Chose qu'on jette à la poubelle",
    		"Chose qu'on garde secret", "Chose qu'on emporte sur une île déserte", "Cadeau d'anniversaire idéal",
    		"Excuse pour arriver en retard", "Mot de 4 lettres maximum", "Mot de plus de 10 lettres"
	];

// =====================================================================
//  PETIT BAC — multijoueur synchronisé via Firebase (salons/{code}/bacGame)
//  Phases : PLAYING (écrire) → VOTING (valider les mots des autres)
//           → ROUND_SCORES (points de la manche) → ... → FINISHED
// =====================================================================
const BAC_VOTE_TIME = 30;      // secondes pour voter
const BAC_STOP_TIME = 15;      // temps restant aux autres quand quelqu'un termine en premier

let bacTickInterval = null;
window.bacPhaseKey = null;
window.bacTimeLeft = 0;
window.bacCapped = false;
window.bacSubmitted = false;
window.bacVotesSent = false;
window.bacMyVotes = {};
window.bacTransitionKey = null;
window.latestBacData = null;

// Utilitaire conservé : certains modes l'utilisent pour changer d'écran
window.switchScreen = function(screenId) {
    document.querySelectorAll('main').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

function bacNormalize(str) {
    return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function bacEsc(v) { return (typeof escapeChatHTML === 'function') ? escapeChatHTML(v) : String(v); }
function bacList(v) { return Array.isArray(v) ? v : Object.values(v || {}); }
function bacHumanNames(data) {
    return Object.values(data.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name).sort();
}

// Tirage de toutes les manches : une lettre différente et des catégories différentes par manche
window.prepareBacGame = function(rounds, perRound) {
    const letters = [..."ABCDEFGHIJKLMNOPRSTUV"].sort(() => Math.random() - 0.5);
    const pool = [...bacCategories].sort(() => Math.random() - 0.5);
    const out = [];
    for (let r = 0; r < rounds; r++) {
        const cats = [];
        for (let i = 0; i < perRound; i++) cats.push(pool[(r * perRound + i) % pool.length]);
        out.push({ letter: letters[r % letters.length], categories: cats });
    }
    return out;
};

// Lancement (hôte) : lit les paramètres du salon
window.startPetitsBacGame = function() {
    if (!window.isHost) return;
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!roomCode || !window.mettreAJourSalonFirebase) return;

    const rounds = Math.max(1, Math.min(10, parseInt(document.getElementById('setting-petitsbac-rounds')?.value, 10) || 3));
    const perRound = Math.max(3, Math.min(8, parseInt(document.getElementById('setting-petitsbac-categories')?.value, 10) || 5));
    const timer = Math.max(20, Math.min(180, parseInt(document.getElementById('input-host-timer')?.value, 10) || 60));

    const updates = {
        status: 'IN_GAME',
        selectedMode: 'petitsbac',
        'settings/timer': timer,
        'settings/bacRounds': rounds,
        'settings/bacCategories': perRound,
        bacGame: {
            status: 'PLAYING',
            currentRound: 1,
            maxRounds: rounds,
            timer: timer,
            rounds: window.prepareBacGame(rounds, perRound),
            startedAt: Date.now(),
            roundStart: Date.now()
        }
    };
    Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(roomCode, updates);
};

// ---------------------------------------------------------------------
//  AFFICHAGE (appelé à chaque mise à jour Firebase)
// ---------------------------------------------------------------------
window.renderPetitsBacScreen = function(data) {
    const g = data && data.bacGame;
    if (!g) return;
    window.latestBacData = data;

    const me = window.myPlayerKey || state.username;
    const round = Number(g.currentRound) || 1;
    const sessionKey = String(g.startedAt || 'bac');
    const rd = bacList(g.rounds)[round - 1] || { letter: '?', categories: [] };
    const cats = bacList(rd.categories);

    if (g.status === 'FINISHED') {
        if (bacTickInterval) { clearInterval(bacTickInterval); bacTickInterval = null; }
        const resultsScreen = document.getElementById('screen-results');
        const shown = resultsScreen && !resultsScreen.classList.contains('hidden') && resultsScreen.style.display !== 'none';
        const ranking = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot)
            .sort((a, b) => (b.score || 0) - (a.score || 0));
        const lb = document.getElementById('final-leaderboard');
        if (lb) {
            lb.innerHTML = ranking.map((p, i) => `
                <div class="flex justify-between items-center p-3 rounded-2xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-900 border border-slate-800'} text-xs">
                    <span class="font-bold">#${i + 1} - ${bacEsc(p.name)}</span>
                    <span class="font-mono text-emerald-400 font-bold text-sm">${p.score || 0} pts</span>
                </div>`).join('');
        }
        if (!shown) showScreen('screen-results');
        return;
    }

    const screen = document.getElementById('screen-petitsbac');
    if (screen && screen.classList.contains('hidden')) showScreen('screen-petitsbac');

    // En-tête commun
    const ind = document.getElementById('bac-round-indicator');
    if (ind) ind.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Manche ${round} / ${g.maxRounds}`;
    const letterEl = document.getElementById('bac-letter-display');
    if (letterEl) letterEl.innerText = rd.letter;

    const show = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };
    show('bac-phase-play', g.status === 'PLAYING');
    show('bac-phase-vote', g.status === 'VOTING');
    show('bac-phase-scores', g.status === 'ROUND_SCORES');

    const label = document.getElementById('bac-phase-label');
    if (label) label.innerText = g.status === 'PLAYING' ? 'Écrivez un mot par catégorie'
        : g.status === 'VOTING' ? 'Votez : les mots des autres sont-ils valides ?'
        : 'Résultats de la manche';

    if (g.status === 'PLAYING') bacRenderPlay(data, g, me, round, sessionKey, rd, cats);
    else if (g.status === 'VOTING') bacRenderVote(data, g, me, round, sessionKey, rd, cats);
    else if (g.status === 'ROUND_SCORES') bacRenderScores(data, g, me, round, cats);

    if (!bacTickInterval) bacTickInterval = setInterval(bacTick, 1000);
    if (window.isHost) bacHostAdvance(data);
};

function bacRenderPlay(data, g, me, round, sessionKey, rd, cats) {
    const phaseKey = `${sessionKey}:${round}:PLAY`;
    const answers = (g.answers && g.answers[round]) || {};
    const timerEl = document.getElementById('bac-timer');

    if (window.bacPhaseKey !== phaseKey) {
        window.bacPhaseKey = phaseKey;
        window.bacSubmitted = false;
        window.bacCapped = false;
        window.bacTimeLeft = Number(g.timer) || 60;
        if (timerEl) timerEl.innerText = window.bacTimeLeft + 's';

        const container = document.getElementById('bac-categories-inputs');
        if (container) {
            container.innerHTML = cats.map((cat, i) => `
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span class="text-xs sm:text-sm font-bold text-slate-300 sm:w-56">${bacEsc(cat)}</span>
                    <input type="text" id="bac-input-${i}" maxlength="40" autocomplete="off"
                        class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 uppercase transition w-full"
                        placeholder="Commençant par ${bacEsc(rd.letter)}..."
                        onkeydown="if(event.key==='Enter'){const n=document.getElementById('bac-input-${i + 1}'); if(n) n.focus();}">
                </div>`).join('');
            const first = document.getElementById('bac-input-0');
            if (first) first.focus();
        }
    }

    // « BAC ! » : quand quelqu'un termine en premier, les autres n'ont plus que quelques secondes
    if (g.stopCalled === round && !window.bacCapped) {
        window.bacCapped = true;
        if (window.bacTimeLeft > BAC_STOP_TIME) window.bacTimeLeft = BAC_STOP_TIME;
        if (timerEl) timerEl.innerText = window.bacTimeLeft + 's';
    }

    const iSubmitted = !!answers[me] || window.bacSubmitted;
    cats.forEach((c, i) => { const el = document.getElementById('bac-input-' + i); if (el) el.disabled = iSubmitted; });
    const btn = document.getElementById('bac-submit-btn');
    if (btn) {
        btn.disabled = iSubmitted;
        btn.classList.toggle('opacity-50', iSubmitted);
        btn.classList.toggle('cursor-not-allowed', iSubmitted);
        btn.innerHTML = iSubmitted ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...' : 'TERMINER — BAC !';
    }

    const status = document.getElementById('bac-play-status');
    if (status) {
        status.innerHTML = bacHumanNames(data).map(n => answers[n]
            ? `<div class="px-3 py-1.5 rounded-lg border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono"><i class="fa-solid fa-check"></i> ${bacEsc(n)}</div>`
            : `<div class="px-3 py-1.5 rounded-lg border bg-slate-900 text-slate-400 border-slate-700 font-mono"><i class="fa-solid fa-pen animate-pulse text-amber-400"></i> ${bacEsc(n)}</div>`).join('');
    }
}

window.submitBacAnswers = function(early) {
    if (window.bacSubmitted) return;
    const data = window.latestBacData;
    if (!data || !data.bacGame || data.bacGame.status !== 'PLAYING') return;
    const g = data.bacGame;
    const round = Number(g.currentRound) || 1;
    const me = window.myPlayerKey || state.username;
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!roomCode) return;

    const cats = bacList((bacList(g.rounds)[round - 1] || {}).categories);
    const words = {};
    cats.forEach((c, i) => {
        const el = document.getElementById('bac-input-' + i);
        words[i] = el ? el.value.trim().slice(0, 40) : '';
    });

    window.bacSubmitted = true;
    const updates = { [`bacGame/answers/${round}/${me}`]: { ts: Date.now(), words: words } };
    if (early === true && window.bacTimeLeft > BAC_STOP_TIME && g.stopCalled !== round) {
        updates['bacGame/stopCalled'] = round;
    }
    window.update(window.ref(window.db, `salons/${roomCode}`), updates)
        .catch(err => { window.bacSubmitted = false; console.error('Envoi des réponses impossible :', err); });
};

function bacRenderVote(data, g, me, round, sessionKey, rd, cats) {
    const phaseKey = `${sessionKey}:${round}:VOTE`;
    const done = (g.votesDone && g.votesDone[round]) || {};
    const timerEl = document.getElementById('bac-timer');

    if (window.bacPhaseKey !== phaseKey) {
        window.bacPhaseKey = phaseKey;
        window.bacVotesSent = false;
        window.bacMyVotes = {};
        window.bacTimeLeft = BAC_VOTE_TIME;
        if (timerEl) timerEl.innerText = window.bacTimeLeft + 's';

        const answers = (g.answers && g.answers[round]) || {};
        const humans = bacHumanNames(data);
        const letterN = bacNormalize(rd.letter);
        let votable = 0;

        const html = cats.map((cat, i) => {
            const rows = humans.map(n => {
                const word = (((answers[n] || {}).words || {})[i] || '').trim();
                if (!word) return `<div class="text-[11px] text-slate-600 px-1">${bacEsc(n)} : —</div>`;
                const okLetter = bacNormalize(word).startsWith(letterN);
                if (n === me) {
                    return `<div class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-sm">
                        <span class="text-slate-400">Vous : <b class="text-white">${bacEsc(word)}</b></span>
                        ${okLetter ? '' : '<span class="text-[10px] text-red-400">mauvaise lettre</span>'}</div>`;
                }
                if (!okLetter) {
                    return `<div class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/60 border border-red-900/40 text-sm">
                        <span class="text-slate-400">${bacEsc(n)} : <b class="line-through text-slate-500">${bacEsc(word)}</b></span>
                        <span class="text-[10px] text-red-400">mauvaise lettre</span></div>`;
                }
                votable++;
                return `<div data-answerer="${bacEsc(n)}" data-cat="${i}" class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-sm">
                    <span class="text-slate-300">${bacEsc(n)} : <b class="text-white">${bacEsc(word)}</b></span>
                    <div class="flex gap-2 shrink-0">
                        <button type="button" data-v="1" onclick="castBacVote(this)" class="px-3 py-1 rounded-lg border text-xs font-bold transition bg-emerald-500/20 border-emerald-500 text-emerald-300"><i class="fa-solid fa-check"></i> Valide</button>
                        <button type="button" data-v="0" onclick="castBacVote(this)" class="px-3 py-1 rounded-lg border text-xs font-bold transition bg-slate-800 border-slate-700 text-slate-400"><i class="fa-solid fa-xmark"></i> Refusé</button>
                    </div></div>`;
            }).join('');
            return `<div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <div class="text-[11px] uppercase tracking-wider font-bold text-indigo-300">${bacEsc(cat)}</div>${rows}</div>`;
        }).join('');

        const container = document.getElementById('vote-grid-container');
        if (container) container.innerHTML = html;
        window.bacVotableCount = votable;
    }

    const iDone = !!done[me] || window.bacVotesSent;
    const btn = document.getElementById('bac-vote-btn');
    if (btn) {
        btn.disabled = iDone;
        btn.classList.toggle('opacity-50', iDone);
        btn.classList.toggle('cursor-not-allowed', iDone);
        btn.innerHTML = iDone ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...' : 'VALIDER MES VOTES';
    }
    document.querySelectorAll('#vote-grid-container button').forEach(b => { b.disabled = iDone; });

    // Rien à voter (ex. seul dans le salon) : on valide tout de suite
    if (!iDone && !window.bacVotableCount) setTimeout(() => window.submitBacVotes(), 500);
}

window.castBacVote = function(btn) {
    const row = btn.closest('[data-answerer]');
    if (!row || window.bacVotesSent) return;
    const who = row.dataset.answerer, cat = row.dataset.cat, v = Number(btn.dataset.v);
    if (!window.bacMyVotes[who]) window.bacMyVotes[who] = {};
    window.bacMyVotes[who][cat] = v;
    row.querySelectorAll('button').forEach(b => {
        const on = Number(b.dataset.v) === v;
        b.className = 'px-3 py-1 rounded-lg border text-xs font-bold transition ' + (on
            ? (v === 1 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-red-500/20 border-red-500 text-red-300')
            : 'bg-slate-800 border-slate-700 text-slate-400');
    });
};

window.submitBacVotes = function() {
    if (window.bacVotesSent) return;
    const data = window.latestBacData;
    if (!data || !data.bacGame || data.bacGame.status !== 'VOTING') return;
    const round = Number(data.bacGame.currentRound) || 1;
    const me = window.myPlayerKey || state.username;
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!roomCode) return;

    const updates = { [`bacGame/votesDone/${round}/${me}`]: true };
    document.querySelectorAll('#vote-grid-container [data-answerer]').forEach(row => {
        const who = row.dataset.answerer, cat = row.dataset.cat;
        const v = (window.bacMyVotes[who] && window.bacMyVotes[who][cat] !== undefined) ? window.bacMyVotes[who][cat] : 1;
        updates[`bacGame/votes/${round}/${me}/${who}/${cat}`] = v;   // 1 = valide, 0 = refusé
    });

    window.bacVotesSent = true;
    window.update(window.ref(window.db, `salons/${roomCode}`), updates)
        .catch(err => { window.bacVotesSent = false; console.error('Envoi des votes impossible :', err); });
};

// ---------------------------------------------------------------------
//  CALCUL DES POINTS (exécuté par l'hôte)
//  Mot valide (bonne lettre + majorité des autres joueurs) : 10 pts s'il est unique, 5 pts s'il est en double
// ---------------------------------------------------------------------
function bacComputeRound(data, g, round, humans) {
    const rd = bacList(g.rounds)[round - 1] || { letter: '?', categories: [] };
    const cats = bacList(rd.categories);
    const letterN = bacNormalize(rd.letter);
    const answers = (g.answers && g.answers[round]) || {};
    const votes = (g.votes && g.votes[round]) || {};

    const result = {};
    humans.forEach(n => { result[n] = { total: 0, cells: {} }; });

    cats.forEach((cat, ci) => {
        const validOnes = [];
        humans.forEach(n => {
            const word = (((answers[n] || {}).words || {})[ci] || '').trim();
            let valid = word.length > 0 && bacNormalize(word).startsWith(letterN);
            if (valid) {
                let yes = 0, no = 0;
                humans.forEach(v => {
                    if (v === n) return;
                    const vote = (((votes[v] || {})[n]) || {})[ci];
                    if (vote === 0) no++; else yes++;   // pas de vote = valide
                });
                valid = yes >= no;                       // égalité = valide
            }
            result[n].cells[ci] = { word: word, valid: valid, pts: 0 };
            if (valid) validOnes.push(n);
        });

        const counts = {};
        validOnes.forEach(n => { const k = bacNormalize(result[n].cells[ci].word); counts[k] = (counts[k] || 0) + 1; });
        validOnes.forEach(n => {
            const k = bacNormalize(result[n].cells[ci].word);
            const pts = counts[k] === 1 ? 10 : 5;
            result[n].cells[ci].pts = pts;
            result[n].total += pts;
        });
    });
    return result;
}

function bacRenderScores(data, g, me, round, cats) {
    const phaseKey = `${g.startedAt}:${round}:SCORES`;
    window.bacPhaseKey = phaseKey;
    const scores = (g.roundScores && g.roundScores[round]) || {};
    const humans = bacHumanNames(data);

    const head = humans.map(n => `<th class="px-2 py-2 text-left ${n === me ? 'text-cyan-300' : 'text-slate-300'}">${bacEsc(n)}</th>`).join('');
    const rows = cats.map((cat, ci) => {
        const cells = humans.map(n => {
            const c = ((scores[n] || {}).cells || {})[ci] || { word: '', valid: false, pts: 0 };
            if (!c.word) return '<td class="px-2 py-2 text-slate-600">—</td>';
            return c.valid
                ? `<td class="px-2 py-2"><span class="text-emerald-300 font-bold">${bacEsc(c.word)}</span> <span class="text-[10px] text-emerald-500">+${c.pts}</span></td>`
                : `<td class="px-2 py-2"><span class="line-through text-red-400">${bacEsc(c.word)}</span> <span class="text-[10px] text-red-500">0</span></td>`;
        }).join('');
        return `<tr class="border-t border-slate-800"><td class="px-2 py-2 text-[11px] text-indigo-300 font-bold">${bacEsc(cat)}</td>${cells}</tr>`;
    }).join('');
    const totals = humans.map(n => `<td class="px-2 py-2 font-black text-amber-300">+${(scores[n] || {}).total || 0}</td>`).join('');
    const overall = humans.map(n => `<td class="px-2 py-1 text-xs text-slate-400">${((data.players[n] || {}).score) || 0} pts</td>`).join('');

    const box = document.getElementById('bac-scores-container');
    if (box) box.innerHTML = `<table class="w-full text-sm bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <thead><tr class="bg-slate-950/60"><th class="px-2 py-2 text-left text-slate-500">Catégorie</th>${head}</tr></thead>
        <tbody>${rows}
            <tr class="border-t-2 border-slate-700 bg-slate-950/40"><td class="px-2 py-2 text-xs uppercase text-slate-400">Manche</td>${totals}</tr>
            <tr><td class="px-2 py-1 text-xs uppercase text-slate-500">Total</td>${overall}</tr>
        </tbody></table>`;

    const btn = document.getElementById('bac-next-btn');
    if (btn) {
        const voted = !!(g.readyForNext && g.readyForNext[me]);
        btn.disabled = voted;
        btn.classList.toggle('opacity-50', voted);
        btn.classList.toggle('cursor-not-allowed', voted);
        btn.innerHTML = voted ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...'
            : (round >= Number(g.maxRounds) ? 'Voir le classement final <i class="fa-solid fa-trophy ml-2"></i>' : 'Manche suivante <i class="fa-solid fa-arrow-right ml-2"></i>');
    }
    const timerEl = document.getElementById('bac-timer');
    if (timerEl) timerEl.innerText = '—';
}

window.nextBacRound = function() {
    const roomCode = window.currentCodeSalon || state.roomCode;
    const me = window.myPlayerKey || state.username;
    if (!roomCode || !me) return;
    window.update(window.ref(window.db, `salons/${roomCode}`), { [`bacGame/readyForNext/${me}`]: true })
        .catch(err => console.error('Vote manche suivante impossible :', err));
};

// ---------------------------------------------------------------------
//  HÔTE : fait avancer les phases (tout le monde a fini / temps dépassé)
// ---------------------------------------------------------------------
function bacHostAdvance(data) {
    if (!window.isHost || !data || !data.bacGame) return;
    const g = data.bacGame;
    const round = Number(g.currentRound) || 1;
    const humans = bacHumanNames(data);
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!humans.length || !roomCode) return;

    const key = `${g.startedAt}:${round}:${g.status}`;
    if (window.bacTransitionKey === key) return;
    const now = Date.now();
    const send = (updates) => {
        window.bacTransitionKey = key;
        window.update(window.ref(window.db, `salons/${roomCode}`), updates)
            .catch(err => { window.bacTransitionKey = null; console.error('Transition Petit Bac impossible :', err); });
    };

    if (g.status === 'PLAYING') {
        const answers = (g.answers && g.answers[round]) || {};
        const allIn = humans.every(n => answers[n]);
        const overdue = g.roundStart && (now - g.roundStart) > ((Number(g.timer) || 60) + 20) * 1000;
        if (allIn || overdue) send({ 'bacGame/status': 'VOTING', 'bacGame/voteStart': now });

    } else if (g.status === 'VOTING') {
        const done = (g.votesDone && g.votesDone[round]) || {};
        const allDone = humans.every(n => done[n]);
        const overdue = g.voteStart && (now - g.voteStart) > (BAC_VOTE_TIME + 15) * 1000;
        if (allDone || overdue) {
            const result = bacComputeRound(data, g, round, humans);
            const updates = { 'bacGame/status': 'ROUND_SCORES' };
            humans.forEach(n => {
                updates[`bacGame/roundScores/${round}/${n}`] = { total: result[n].total, cells: result[n].cells };
                updates[`players/${n}/score`] = (((data.players || {})[n] || {}).score || 0) + result[n].total;
            });
            send(updates);
        }

    } else if (g.status === 'ROUND_SCORES') {
        const ready = g.readyForNext || {};
        if (humans.every(n => ready[n])) {
            if (round >= Number(g.maxRounds)) {
                send({ 'bacGame/status': 'FINISHED', 'bacGame/readyForNext': null });
            } else {
                send({ 'bacGame/status': 'PLAYING', 'bacGame/currentRound': round + 1, 'bacGame/readyForNext': null, 'bacGame/roundStart': now });
            }
        }
    }
}

// Horloge : compte à rebours local + envoi automatique à 0 + vérifications de l'hôte
function bacTick() {
    const data = window.latestBacData;
    if (!data || !data.bacGame) return;
    const g = data.bacGame;
    if (g.status === 'FINISHED') { clearInterval(bacTickInterval); bacTickInterval = null; return; }

    if (g.status === 'PLAYING' || g.status === 'VOTING') {
        if (window.bacTimeLeft > 0) window.bacTimeLeft--;
        const timerEl = document.getElementById('bac-timer');
        if (timerEl) timerEl.innerText = window.bacTimeLeft + 's';
        if (window.bacTimeLeft <= 0) {
            if (g.status === 'PLAYING' && !window.bacSubmitted) window.submitBacAnswers(false);
            if (g.status === 'VOTING' && !window.bacVotesSent) window.submitBacVotes();
        }
    }
    if (window.isHost) bacHostAdvance(data);
}
