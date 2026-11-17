// =====================================================================
//  MODE « MISSIVE STELLAIRE » : jeu de cartes de bluff et de déduction (2 à 8 joueurs).
//  Chacun tente de faire parvenir sa missive à la Souveraine de la station.
//  À son tour, on pioche une carte puis on joue l'une de ses deux cartes et on
//  applique son effet. La manche est gagnée par le dernier joueur en lice, ou par
//  celui qui tient la carte la plus forte quand la pioche est vide.
//  Le premier à réunir assez de sceaux remporte la partie.
//
//  Fonctionnement réseau (comme Magnat Galactique) : l'HÔTE est l'arbitre.
//  Les joueurs écrivent des actions (msGame/a/<clé>), l'hôte les applique avec
//  msApply() et publie l'état (msGame/s).
// =====================================================================

// ============================ 1) DONNÉES ET RÈGLES ============================
const MS = { END_SECONDS: 15, LOG: 30 };
// v = valeur, q = exemplaires dans le paquet de 18 cartes (doublé à partir de 5 joueurs)
// Ordre et effets repris de l'édition 2019 du jeu original (Garde, Prêtre, Baron, Servante, Prince, Chancelier, Roi, Comtesse, Princesse).
const MS_CARDS = {
    1: { n: 'Sentinelle', i: '🤖', q: 5, c: '#64748b', t: "Désignez un joueur et nommez une carte (sauf Sentinelle). S'il la tient, il est éliminé de la manche." },
    2: { n: 'Analyste', i: '🔭', q: 2, c: '#0891b2', t: "Regardez en secret la carte d'un autre joueur." },
    3: { n: 'Duelliste', i: '⚔️', q: 2, c: '#b45309', t: "Comparez en secret votre carte avec celle d'un autre joueur : la plus faible est éliminée." },
    4: { n: 'Champ de force', i: '🛡️', q: 2, c: '#059669', t: "Jusqu'à votre prochain tour, aucune carte ne peut vous viser." },
    5: { n: 'Téléporteur', i: '🌀', q: 2, c: '#7c3aed', t: "Un joueur de votre choix (vous compris) défausse sa carte et en pioche une nouvelle." },
    6: { n: 'Quartier-maître', i: '📦', q: 2, c: '#0d9488', t: "Piochez 2 cartes de la soute. Gardez-en une parmi vos 3 et remettez les 2 autres sous la pioche, dans l'ordre de votre choix." },
    7: { n: 'Diplomate', i: '🤝', q: 1, c: '#be185d', t: "Échangez votre carte avec celle d'un autre joueur." },
    8: { n: 'Stratège', i: '🧠', q: 1, c: '#4338ca', t: "Aucun effet, mais vous DEVEZ la jouer si vous tenez aussi le Téléporteur ou le Diplomate." },
    9: { n: 'Souveraine', i: '👑', q: 1, c: '#b91c1c', t: "Si vous la jouez ou la défaussez, vous êtes éliminé de la manche." }
};
const MS_MAX = 9;               // valeur de la carte la plus forte (la Souveraine)
const MS_RANGS = Object.keys(MS_CARDS).map(Number).sort((a, b) => b - a);   // 9, 8, ..., 1

function msShuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
}
function msLog(s, txt) { s.log.push(txt); if (s.log.length > MS.LOG) s.log = s.log.slice(-MS.LOG); }
function msAlive(s) { return s.order.filter(n => !s.r.out[n]); }
function msActor(s) { return s.r.phase === 'PLAY' ? s.order[s.r.turn] : (s.r.phase === 'QM' && s.r.qm ? s.r.qm.by : ''); }
// Joueurs qu'une carte peut viser : en lice, non protégés (et pas soi-même, sauf pour le Téléporteur)
function msTargets(s, by, card) {
    const others = msAlive(s).filter(n => n !== by && !s.r.prot[n]);
    return card === 5 ? others.concat([by]) : others;
}
function msNeedsTarget(card) { return card === 1 || card === 2 || card === 3 || card === 5 || card === 7; }
// La Stratège (8) doit être jouée si l'autre carte est le Téléporteur (5) ou le Diplomate (7)
function msForced(hand) { return hand.length === 2 && hand.indexOf(8) >= 0 && (hand.indexOf(5) >= 0 || hand.indexOf(7) >= 0); }
function msSum(arr) { return arr.reduce((a, b) => a + b, 0); }

function msNewRound(s, starter, rnd) {
    let deck = [];
    Object.keys(MS_CARDS).forEach(v => { for (let i = 0; i < MS_CARDS[v].q * (s.order.length > 4 ? 2 : 1); i++) deck.push(Number(v)); });
    deck = msShuffle(deck, rnd);
    const r = { deck: deck, aside: 0, shown: [], hands: {}, out: {}, prot: {}, disc: {}, turn: 0, phase: 'PLAY', winners: [], reason: '', last: null, peek: null, duel: null, qm: null };
    r.aside = r.deck.pop();
    if (s.order.length === 2) r.shown = [r.deck.pop(), r.deck.pop(), r.deck.pop()];
    s.order.forEach(n => { r.hands[n] = [r.deck.pop()]; r.out[n] = false; r.prot[n] = false; r.disc[n] = []; });
    r.turn = Math.max(0, s.order.indexOf(starter));
    r.hands[s.order[r.turn]].push(r.deck.pop());
    s.r = r; s.round++;
    msLog(s, `— Manche ${s.round} : ${s.order[r.turn]} commence. —`);
}
function msNewGame(names, opts, now, rnd) {
    rnd = rnd || Math.random;
    opts = opts || {};
    const order = msShuffle(names, rnd);
    const s = {
        status: 'PLAYING', startedAt: now, seq: 1, order: order, tokens: {}, round: 0, log: [],
        goal: Math.max(1, Math.min(7, Number(opts.goal) || 3)),
        timer: Math.max(15, Math.min(120, Number(opts.timer) || 45)),
        dl: 0, dlAt: now, dlKey: '', r: null
    };
    order.forEach(n => { s.tokens[n] = 0; });
    msNewRound(s, order[0], rnd);
    msDeadline(s, now);
    return s;
}
// Firebase supprime les tableaux et objets vides : on les rétablit à la lecture
function msNorm(raw) {
    const s = JSON.parse(JSON.stringify(raw || {}));
    const arr = v => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : Object.values(v || {}));
    s.order = arr(s.order); s.log = arr(s.log); s.tokens = s.tokens || {};
    const r = s.r = s.r || {};
    r.deck = arr(r.deck).map(Number); r.shown = arr(r.shown).map(Number); r.winners = arr(r.winners);
    r.hands = r.hands || {}; r.out = r.out || {}; r.prot = r.prot || {}; r.disc = r.disc || {};
    s.order.forEach(n => { s.tokens[n] = s.tokens[n] || 0; r.hands[n] = arr(r.hands[n]).map(Number); r.disc[n] = arr(r.disc[n]).map(Number); r.out[n] = !!r.out[n]; r.prot[n] = !!r.prot[n]; });
    r.aside = r.aside || 0; r.turn = r.turn || 0; r.phase = r.phase || 'PLAY'; r.reason = r.reason || '';
    r.last = r.last || null; r.peek = r.peek || null; r.duel = r.duel || null; r.qm = r.qm || null;
    ['seq', 'round', 'goal', 'timer', 'dl', 'dlAt'].forEach(k => { s[k] = s[k] || 0; });
    s.dlKey = s.dlKey || '';
    return s;
}
function msDeadline(s, now) {
    if (s.status !== 'PLAYING') return;
    const key = s.round + ':' + s.r.phase + ':' + s.r.turn + ':' + msSum(s.order.map(n => s.r.disc[n].length));
    if (key !== s.dlKey) { s.dlKey = key; s.dlAt = now; s.dl = now + (s.r.phase === 'END' ? MS.END_SECONDS : s.timer) * 1000; }
}
function msEliminate(s, name, why) {
    const r = s.r;
    r.out[name] = true; r.prot[name] = false;
    r.hands[name].forEach(c => r.disc[name].push(c));
    r.hands[name] = [];
    msLog(s, `${name} est éliminé de la manche${why ? ' (' + why + ')' : ''}.`);
}
function msEndRound(s, winners, reason) {
    const r = s.r;
    r.phase = 'END'; r.winners = winners; r.reason = reason;
    winners.forEach(n => { s.tokens[n] = (s.tokens[n] || 0) + 1; });
    msLog(s, `${winners.join(' et ')} ${winners.length > 1 ? 'remportent' : 'remporte'} la manche (${reason}) et gagne${winners.length > 1 ? 'nt' : ''} un sceau.`);
}
// Fin du tour : la manche est-elle terminée ? sinon le joueur suivant pioche
function msAfterPlay(s, by) {
    const r = s.r, alive = msAlive(s);
    if (alive.length === 1) { msEndRound(s, alive, 'dernier joueur en lice'); return; }
    if (alive.length === 0) { msEndRound(s, [], 'personne'); return; }
    if (r.deck.length === 0) {
        // pioche vide : la carte la plus forte gagne ; égalité → total des cartes défaussées
        const best = Math.max.apply(null, alive.map(n => r.hands[n][0] || 0));
        let top = alive.filter(n => (r.hands[n][0] || 0) === best);
        if (top.length > 1) {
            const sum = Math.max.apply(null, top.map(n => msSum(r.disc[n])));
            top = top.filter(n => msSum(r.disc[n]) === sum);
        }
        msEndRound(s, top, `carte la plus forte : ${MS_CARDS[best] ? MS_CARDS[best].n : '—'}`);
        return;
    }
    let t = s.order.indexOf(by);
    do { t = (t + 1) % s.order.length; } while (r.out[s.order[t]]);
    r.turn = t;
    const next = s.order[t];
    r.prot[next] = false;
    r.hands[next].push(r.deck.pop());
}

// Application d'une action. Renvoie le nouvel état, ou null si l'action est refusée.
function msApply(s0, a, now, rnd) {
    if (!s0 || s0.status !== 'PLAYING' || !a || typeof a.by !== 'string') return null;
    const s = JSON.parse(JSON.stringify(s0));
    rnd = rnd || Math.random;
    const by = a.by, r = s.r;
    if (s.order.indexOf(by) < 0) return null;

    if (a.t === 'next') {
        if (r.phase !== 'END') return null;
        const champions = s.order.filter(n => s.tokens[n] >= s.goal);
        if (champions.length) {
            s.status = 'FINISHED';
            msLog(s, `${champions.join(' et ')} ${champions.length > 1 ? 'remportent' : 'remporte'} la partie !`);
        } else {
            msNewRound(s, r.winners[0] || s.order[r.turn] || s.order[0], rnd);
        }
    } else if (a.t === 'play') {
        if (r.phase !== 'PLAY' || s.order[r.turn] !== by) return null;
        const hand = r.hands[by], i = Number(a.i);
        if (hand.length !== 2 || (i !== 0 && i !== 1)) return null;
        const card = hand[i], keep = hand[1 - i];
        if (msForced(hand) && card !== 8) return null;
        const targets = msTargets(s, by, card);
        let target = '';
        if (msNeedsTarget(card) && targets.length) {
            target = String(a.target || '');
            if (targets.indexOf(target) < 0) return null;
        }
        const guess = Number(a.guess);
        if (card === 1 && target && !(Number.isInteger(guess) && guess >= 2 && guess <= MS_MAX)) return null;

        r.hands[by] = [keep]; r.disc[by].push(card);
        r.peek = null; r.duel = null;
        r.last = { by: by, c: card, target: target, guess: card === 1 && target ? guess : 0, res: '', k: s.seq };
        const C = MS_CARDS[card];
        msLog(s, `${by} joue ${C.n} (${card})${target && target !== by ? ' sur ' + target : ''}.`);
        const noTarget = msNeedsTarget(card) && !target;
        if (noTarget) { r.last.res = 'Aucun joueur ne peut être visé : la carte est sans effet.'; msLog(s, r.last.res); }
        else if (card === 1) {
            if (r.hands[target][0] === guess) { r.last.res = `Bien vu : ${target} tenait ${MS_CARDS[guess].n} !`; msLog(s, `${by} annonce ${MS_CARDS[guess].n} : exact !`); msEliminate(s, target, 'démasqué par la Sentinelle'); }
            else { r.last.res = `${by} annonce ${MS_CARDS[guess].n} : raté.`; msLog(s, r.last.res); }
        } else if (card === 2) {
            r.peek = { by: by, target: target, c: r.hands[target][0], k: s.seq };
            r.last.res = `${by} regarde en secret la carte de ${target}.`;
        } else if (card === 3) {
            const mine = r.hands[by][0], theirs = r.hands[target][0];
            r.duel = { a: by, b: target, ca: mine, cb: theirs, k: s.seq };
            if (mine === theirs) { r.last.res = 'Duel : égalité, personne n\'est éliminé.'; msLog(s, r.last.res); }
            else { const loser = mine < theirs ? by : target; r.last.res = `Duel : ${loser} avait la carte la plus faible.`; msEliminate(s, loser, 'perd le duel'); }
        } else if (card === 4) {
            r.prot[by] = true; r.last.res = `${by} est sous protection jusqu'à son prochain tour.`;
        } else if (card === 5) {
            const d = r.hands[target][0];
            r.hands[target] = []; r.disc[target].push(d);
            msLog(s, `${target} défausse ${MS_CARDS[d].n} (${d}).`);
            if (d === 9) { r.last.res = `${target} défausse la Souveraine !`; msEliminate(s, target, 'a défaussé la Souveraine'); }
            else {
                let drawn = 0;
                if (r.deck.length) drawn = r.deck.pop();
                else { drawn = r.aside; r.aside = 0; }      // pioche vide : on prend la carte écartée
                if (drawn) r.hands[target].push(drawn);
                r.last.res = `${target} défausse ${MS_CARDS[d].n} et pioche une nouvelle carte.`;
            }
        } else if (card === 6) {
            // Quartier-maître : pioche jusqu'à 2 cartes, le joueur choisira ensuite laquelle garder (phase « QM »)
            const n = Math.min(2, r.deck.length);
            for (let k = 0; k < n; k++) r.hands[by].push(r.deck.pop());
            if (n) {
                r.phase = 'QM'; r.qm = { by: by, n: n };
                r.last.res = `${by} fouille la soute : ${n} carte${n > 1 ? 's' : ''} piochée${n > 1 ? 's' : ''}, il en gardera une seule.`;
                msLog(s, r.last.res);
                msDeadline(s, now);
                s.seq++;
                return s;                       // le tour se termine quand il a choisi (action « keep »)
            }
            r.last.res = 'La soute est vide : le Quartier-maître est sans effet.'; msLog(s, r.last.res);
        } else if (card === 7) {
            const mine = r.hands[by]; r.hands[by] = r.hands[target]; r.hands[target] = mine;
            r.last.res = `${by} et ${target} échangent leurs cartes.`; msLog(s, r.last.res);
        } else if (card === 8) {
            r.last.res = 'La Stratège est jouée : aucun effet.';
        } else if (card === 9) {
            r.last.res = `${by} a joué la Souveraine !`; msEliminate(s, by, 'a joué la Souveraine');
        }
        msAfterPlay(s, by);
    } else if (a.t === 'keep') {
        // Quartier-maître : garder une carte, remettre les autres sous la pioche
        if (r.phase !== 'QM' || !r.qm || r.qm.by !== by) return null;
        const hand = r.hands[by], i = Number(a.i);
        if (hand.length < 2 || !Number.isInteger(i) || i < 0 || i >= hand.length) return null;
        const keep = hand[i], rest = hand.filter((c, k) => k !== i);
        // fond = index (dans les cartes rendues) de celle qui va tout au fond de la pioche
        const fond = rest.length === 2 && Number(a.fond) === 1 ? 1 : 0;
        const ordre = rest.length === 2 ? [rest[fond], rest[1 - fond]] : rest;   // du fond vers le haut
        r.deck = ordre.concat(r.deck);          // on pioche par la fin du tableau : le début est le fond
        r.hands[by] = [keep];
        r.phase = 'PLAY'; r.qm = null;
        msLog(s, `${by} remet ${rest.length} carte${rest.length > 1 ? 's' : ''} sous la pioche.`);
        msAfterPlay(s, by);
    } else return null;

    msDeadline(s, now);
    s.seq++;
    return s;
}
// Coup automatique (temps écoulé ou joueur absent) : la carte la plus faible permise, cible et annonce au hasard
function msAuto(s, now, rnd) {
    if (s.status !== 'PLAYING') return null;
    rnd = rnd || Math.random;
    if (s.r.phase === 'END') return msApply(s, { by: s.order[0], t: 'next' }, now, rnd);
    if (s.r.phase === 'QM' && s.r.qm) {        // Quartier-maître : garde la carte la plus forte
        const h = s.r.hands[s.r.qm.by];
        return msApply(s, { by: s.r.qm.by, t: 'keep', i: h.indexOf(Math.max.apply(null, h)), fond: 0 }, now, rnd);
    }
    const by = s.order[s.r.turn], hand = s.r.hands[by];
    if (hand.length !== 2) return null;
    let i = msForced(hand) ? hand.indexOf(8) : (hand[0] <= hand[1] ? 0 : 1);
    if (hand[i] === 9) i = 1 - i;
    const targets = msTargets(s, by, hand[i]);
    const others = targets.filter(n => n !== by);
    const pool = others.length ? others : targets;
    return msApply(s, { by: by, t: 'play', i: i, target: pool.length ? pool[Math.floor(rnd() * pool.length)] : '', guess: 2 + Math.floor(rnd() * (MS_MAX - 1)) }, now, rnd);
}
function msScore(s, name) { return (s.tokens[name] || 0) * 100; }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MS, MS_CARDS, MS_MAX, msNewGame, msNorm, msApply, msAuto, msAlive, msTargets, msNeedsTarget, msForced, msActor, msSum };
}

// ============================ 2) BOUCLE DE L'HÔTE ============================
const msHost = { startedAt: 0, state: null, done: {} };
const msUI = { seenSess: '', seenSeq: 0, sess: '', sig: '', sel: -1, target: '', guess: 0, shown: '', fond: 0, qmSeq: -1 };

function msEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function msRoom() { return window.currentCodeSalon || state.roomCode; }
function msMe() { return window.myPlayerKey || state.username; }
function msSend(action) {
    const code = msRoom();
    if (!code || !window.update) return;
    const key = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    window.update(window.ref(window.db, `salons/${code}`), { [`msGame/a/${key}`]: Object.assign({ by: msMe() }, action) })
        .catch(err => console.error('Action Missive non envoyée :', err));
}
function msHostState(g) {
    const s = msNorm(g.s);
    if (msHost.state && msHost.startedAt === s.startedAt && msHost.state.seq > s.seq) return msHost.state;
    return s;
}
function msHostWrite(s, removeKeys, players) {
    msHost.startedAt = s.startedAt; msHost.state = s;
    const updates = { 'msGame/s': JSON.parse(JSON.stringify(s)) };
    removeKeys.forEach(k => { updates['msGame/a/' + k] = null; });
    if (s.status === 'FINISHED') s.order.forEach(n => { if (players && players[n]) updates[`players/${n}/score`] = msScore(s, n); });
    window.update(window.ref(window.db, `salons/${msRoom()}`), updates)
        .catch(err => console.error('Mise à jour Missive impossible :', err));
}
function msHostProcess(data) {
    const g = data.msGame;
    if (!window.isHost || !g || !g.s) return;
    const keys = Object.keys(g.a || {}).sort().filter(k => !msHost.done[k]);
    if (!keys.length) return;
    let s = msHostState(g), changed = false;
    const now = Date.now();
    keys.forEach(k => {
        msHost.done[k] = true;
        let next = null;
        try { next = msApply(s, g.a[k], now); } catch (e) { console.error('Action Missive invalide :', e); }
        if (next) { s = next; changed = true; }
    });
    if (changed) msHostWrite(s, keys, data.players);
    else {
        const updates = {};
        keys.forEach(k => { updates['msGame/a/' + k] = null; });
        window.update(window.ref(window.db, `salons/${msRoom()}`), updates).catch(err => console.error(err));
    }
}
function msHostTick() {
    const room = window.currentRoom;
    if (!window.isHost || !room || room.status !== 'IN_GAME' || room.selectedMode !== 'missive' || !room.msGame || !room.msGame.s) return;
    const s = msHostState(room.msGame);
    if (s.status !== 'PLAYING') return;
    const now = Date.now();
    const present = Object.values(room.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const actor = msActor(s);
    const absent = actor && present.indexOf(actor) < 0;
    if (now > s.dl || (absent && now > s.dlAt + 20000)) {
        let next = null;
        try { next = msAuto(s, now); } catch (e) { console.error('Tour automatique impossible :', e); }
        if (next) msHostWrite(next, [], room.players);
    }
}

// ============================ 3) AFFICHAGE ============================
const MS_CSS = `
.ms-hand .ms-card{transition:transform .18s ease,box-shadow .18s ease}
.ms-hand .ms-card.ms-pick:hover{transform:translateY(-.5em)}
.ms-hand .ms-card.ms-sel{transform:translateY(-1em) scale(1.04)}
.ms-hand .ms-card.ms-leve{animation:msLeve .28s cubic-bezier(.3,1.5,.5,1)}
.ms-card.ms-pioche{animation:msPioche .62s cubic-bezier(.25,.8,.3,1) backwards}
.ms-card.ms-pose{animation:msPose .32s ease-out}
.ms-card.ms-tombe{animation:msTombe .45s cubic-bezier(.3,1.4,.5,1) .35s backwards}
.ms-card.ms-retourne{animation:msRetourne .6s ease-out}
@keyframes msLeve{0%{transform:translateY(0)}60%{transform:translateY(-12%)}100%{transform:translateY(-7%)}}
@keyframes msPioche{0%{transform:translate(var(--dx),var(--dy)) scale(.45) rotateY(180deg);filter:brightness(.25)}55%{filter:brightness(.25)}60%{transform:translate(calc(var(--dx)*.15),calc(var(--dy)*.15)) scale(1.08) rotateY(90deg)}100%{transform:none;filter:none}}
@keyframes msPose{0%{transform:scale(1.7)}60%{transform:scale(.9)}100%{transform:scale(1)}}
@keyframes msTombe{0%{transform:translateY(-1.4em) scale(1.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes msRetourne{0%{transform:rotateY(180deg) scale(.8);filter:brightness(.2)}50%{transform:rotateY(90deg) scale(1.05);filter:brightness(.2)}100%{transform:none;filter:none}}
#ms-duel{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2em;background:rgba(2,6,23,.9);cursor:pointer;animation:msDuelFond 4.2s ease forwards}
#ms-duel .titre{font-weight:900;letter-spacing:.2em;font-size:1.5em;color:#fcd34d;text-align:center}#ms-duel .titre span{display:block;font-size:.42em;letter-spacing:.06em;color:#cbd5e1;font-weight:400;margin-top:.3em}
#ms-duel .arene{display:flex;align-items:center;gap:1.6em}
#ms-duel .cote{display:flex;flex-direction:column;align-items:center;gap:.5em}#ms-duel .nom{font-weight:800;color:#f8fafc}
#ms-duel .moi{animation:msDuelG .55s cubic-bezier(.2,.9,.3,1.2) backwards}#ms-duel .lui{animation:msDuelD .55s cubic-bezier(.2,.9,.3,1.2) backwards}
#ms-duel .vs{font-weight:900;font-size:2.2em;color:#f87171;animation:msDuelVs .5s ease-out .45s backwards}
#ms-duel .verdict{font-weight:800;font-size:1.05em;text-align:center;padding:0 1em;animation:msDuelVerdict .5s ease 1.5s backwards}
#ms-duel.gagne .verdict{color:#6ee7b7}#ms-duel.perd .verdict{color:#fca5a5}#ms-duel.egal .verdict{color:#fde68a}
#ms-duel.gagne .lui .ms-card,#ms-duel.perd .moi .ms-card{animation:msDuelPerdu .7s ease 1.5s forwards}
#ms-duel.gagne .moi .ms-card,#ms-duel.perd .lui .ms-card{animation:msDuelGagne .7s ease 1.5s forwards}
@keyframes msDuelG{0%{transform:translateX(-60vw) rotate(-25deg)}100%{transform:none}}
@keyframes msDuelD{0%{transform:translateX(60vw) rotate(25deg)}100%{transform:none}}
@keyframes msDuelVs{0%{transform:scale(4);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes msDuelVerdict{0%{opacity:0;transform:translateY(.6em)}100%{opacity:1;transform:none}}
@keyframes msDuelPerdu{0%{transform:none;filter:none}30%{transform:translateX(-.4em) rotate(-4deg)}60%{transform:translateX(.4em) rotate(4deg)}100%{transform:translateY(.8em) rotate(8deg) scale(.9);filter:grayscale(1) brightness(.5)}}
@keyframes msDuelGagne{0%{transform:none}100%{transform:scale(1.08);box-shadow:0 0 2em .3em rgba(110,231,183,.8)}}
@keyframes msDuelFond{0%{opacity:0}6%,90%{opacity:1}100%{opacity:0}}
#ms-root{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;gap:.6vw;padding:.7vw;box-sizing:border-box;background:radial-gradient(circle at 50% 35%,#1b1035 0%,#0a0a1c 55%,#040913 100%);color:#e2e8f0;font-size:clamp(12px,1vw,22px);font-family:inherit}
#ms-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:.5em 1em;border:1px solid rgba(196,181,253,.4);border-radius:12px;background:rgba(15,12,35,.9);flex-shrink:0}
#ms-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) clamp(260px,24vw,520px);gap:.8vw}
#ms-table{display:flex;flex-direction:column;gap:.6vw;min-height:0;min-width:0}
#ms-side{display:flex;flex-direction:column;gap:.6vw;min-height:0}
.ms-box{border:1px solid rgba(148,163,184,.28);border-radius:14px;background:rgba(13,16,38,.82);padding:.6em .8em;min-height:0}
.ms-box-h{font-size:.68em;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c4b5fd;margin-bottom:.4em}
#ms-foes{display:flex;flex-wrap:wrap;gap:.6vw;justify-content:center;flex-shrink:0}
.ms-foe{display:flex;align-items:center;gap:.6em;padding:.45em .7em;border-radius:14px;border:1px solid rgba(148,163,184,.3);background:rgba(13,16,38,.85);min-width:13em;flex:0 1 auto}
.ms-foe-on{border-color:#fbbf24;box-shadow:0 0 16px -2px #fbbf24}
.ms-foe-out{opacity:.45}
.ms-foe-pick{cursor:pointer;border-color:#34d399;box-shadow:0 0 14px -2px #34d399}
.ms-foe-sel{background:rgba(6,95,70,.6);border-color:#6ee7b7}
.ms-av{width:2.5em;height:2.5em;border-radius:50%;border:2px solid #a78bfa;object-fit:cover;flex-shrink:0;background:#020617;display:flex;align-items:center;justify-content:center;font-weight:900;color:#c4b5fd}
.ms-card{position:relative;width:var(--w,7em);aspect-ratio:5/7;border-radius:.6em;border:2px solid rgba(255,255,255,.55);background:linear-gradient(160deg,var(--c,#334155),#0b1026 78%);box-shadow:0 6px 18px rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:.45em .35em;box-sizing:border-box;text-align:center;flex-shrink:0;container-type:inline-size;overflow:hidden}
.ms-card .v{position:absolute;top:3cqw;left:5cqw;font-weight:900;font-size:17cqw;color:#fff;text-shadow:0 2px 4px #000}
.ms-card .q{position:absolute;top:5cqw;right:6cqw;font-size:8cqw;color:rgba(255,255,255,.7)}
.ms-card .ic{font-size:34cqw;line-height:1;margin-top:11cqw}
.ms-card .nm{font-weight:900;font-size:11.5cqw;color:#fff;line-height:1.05}
.ms-card .tx{font-size:6.6cqw;line-height:1.25;color:#e2e8f0;background:rgba(2,6,23,.55);border-radius:3cqw;padding:3cqw}
.ms-back{background:repeating-linear-gradient(135deg,#312e81 0 8%,#1e1b4b 8% 16%);align-items:center;justify-content:center}
.ms-back span{font-size:36cqw;filter:drop-shadow(0 2px 6px #000)}
.ms-mini{--w:3.6em;border-width:1px;border-radius:.3em;padding:0;justify-content:center}
.ms-card:not(.ms-mini){aspect-ratio:1536/2752;overflow:hidden}
.ms-card .ms-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;pointer-events:none;user-select:none}
.ms-mini-art{background-size:cover;background-position:50% 42%}
.ms-mini-art .v{font-size:46cqw;text-shadow:0 0 3px #000,0 0 6px #000,0 1px 2px #000}
.ms-mini .v{position:static;font-size:42cqw}.ms-mini .ic{font-size:30cqw;margin:0}
.ms-hand .ms-card{--w:clamp(110px,min(17vw,25vh),420px);transition:transform .15s}
.ms-hand .ms-pick{cursor:pointer}.ms-hand .ms-pick:hover{transform:translateY(-4%)}
.ms-hand .ms-sel{transform:translateY(-7%);border-color:#6ee7b7;box-shadow:0 0 26px rgba(52,211,153,.8)}
.ms-hand .ms-no{filter:grayscale(.8) brightness(.6)}
.ms-btn{padding:.55em 1.1em;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f1f5f9;font-weight:800;font-size:.85em;cursor:pointer}
.ms-btn:hover{background:#334155}.ms-btn:disabled{opacity:.4;cursor:not-allowed}
.ms-btn-go{background:#059669;border-color:#34d399}.ms-btn-go:hover{background:#10b981}
.ms-btn-on{background:#065f46;border-color:#6ee7b7}
.ms-ref{display:flex;gap:.5em;align-items:flex-start;padding:.3em 0;border-bottom:1px solid rgba(148,163,184,.15);font-size:.72em;line-height:1.3}
.ms-ref b{color:#f8fafc}
.ms-num{flex-shrink:0;width:1.7em;height:1.7em;border-radius:.35em;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;background:var(--c)}
@keyframes msTurn{0%,100%{filter:none}50%{filter:drop-shadow(0 0 14px rgba(52,211,153,.95))}}
.ms-myturn{animation:msTurn .9s ease-in-out 2}
#ms-end{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.8)}
@media (max-width:900px){#ms-root{overflow-y:auto}#ms-main{display:flex;flex-direction:column;flex:none}#ms-table,#ms-side{min-height:auto}}`;

function msAvatarHtml(name) {
    const d = window.msData, p = d && d.players && d.players[name];
    const src = p && p.avatar && p.avatar.src;
    return src ? `<img class="ms-av" src="${msEsc(src)}" alt="">` : `<span class="ms-av">${msEsc(String(name).charAt(0).toUpperCase())}</span>`;
}
// ---- Illustrations des cartes (dossier missive-visuel/cartes/) ----
// Chaque carte illustrée contient déjà son numéro, son nom et son effet. Si une image manque,
// la carte dessinée en CSS (numéro, icône, texte) reste visible en dessous.
const MS_IMG_DIR = './missive-visuel/cartes/';
function msImg(v) { return MS_IMG_DIR + (MS_CARDS[v] ? 'carte-' + v : 'dos') + '.jpg'; }
function msPrechargerImages() {
    if (msPrechargerImages.fait) return;
    msPrechargerImages.fait = true;
    MS_RANGS.concat([0]).forEach(v => { const im = new Image(); im.src = msImg(v); });
}
function msCardHtml(v, cls, attrs, w) {
    const C = MS_CARDS[v], width = w ? `--w:${w};` : '';
    const img = `<img class="ms-art" src="${msImg(v)}" alt="" draggable="false" onerror="this.remove()">`;
    if (!C) return `<div class="ms-card ms-back ${cls || ''}" style="${width}" ${attrs || ''}><span>✉️</span>${img}</div>`;
    return `<div class="ms-card ${cls || ''}" style="${width}--c:${C.c}" title="${C.n} (${v}) : ${msEsc(C.t)}" ${attrs || ''}>
        <span class="v">${v}</span><span class="q">× ${C.q}</span>
        <span class="ic">${C.i}</span><span class="nm">${C.n}</span><span class="tx">${C.t}</span>${img}</div>`;
}
// Petite carte (défausses, mains adverses) : l'illustration en fond, le numéro bien lisible par-dessus
function msMiniHtml(v) {
    const C = MS_CARDS[v];
    return C ? `<div class="ms-card ms-mini ms-mini-art" style="--c:${C.c};background-image:url('${msImg(v)}')" title="${C.n} (${v})"><span class="v">${v}</span></div>`
             : `<div class="ms-card ms-mini ms-back ms-mini-art" style="background-image:url('${msImg(0)}')"></div>`;
}
function msSeals(n, goal) { return '<span style="color:#fbbf24;letter-spacing:.1em">' + '◆'.repeat(n) + '</span><span style="color:#475569;letter-spacing:.1em">' + '◇'.repeat(Math.max(0, goal - n)) + '</span>'; }

function msRender(s, force) {
    const me = msMe(), r = s.r, playing = s.order.indexOf(me) >= 0;
    const actor = msActor(s), myTurn = actor === me;
    if (!myTurn) { msUI.sel = -1; msUI.target = ''; msUI.guess = 0; }
    const qmMoi = myTurn && r.phase === 'QM';
    if (qmMoi && msUI.qmSeq !== s.seq) { msUI.qmSeq = s.seq; msUI.sel = -1; msUI.fond = 0; }      // nouvelle fouille : rien de choisi
    const sig = JSON.stringify([s.seq, msUI.sel, msUI.target, msUI.guess, msUI.fond, me]);
    if (!force && sig === msUI.sig) return;
    msUI.sig = sig;
    msSounds(s, me);

    const hand = playing ? r.hands[me] : [];
    const selCard = myTurn && r.phase === 'PLAY' && msUI.sel >= 0 ? hand[msUI.sel] : 0;
    const targets = selCard ? msTargets(s, me, selCard) : [];
    const needT = selCard && msNeedsTarget(selCard) && targets.length > 0;
    if (needT && targets.indexOf(msUI.target) < 0) msUI.target = targets.length === 1 ? targets[0] : '';
    if (!needT) msUI.target = '';
    const needG = selCard === 1 && needT;

    // ----- bandeau du haut -----
    document.getElementById('ms-round').innerHTML = `Manche ${s.round} · objectif ${s.goal} sceau${s.goal > 1 ? 'x' : ''}`;

    // ----- joueurs (tous, dans l'ordre du tour) -----
    document.getElementById('ms-foes').innerHTML = s.order.map(n => {
        const out = r.out[n], on = n === actor, pick = needT && targets.indexOf(n) >= 0;
        const cards = r.phase === 'END' ? r.hands[n].map(msMiniHtml).join('') : (n === me ? '' : r.hands[n].map(() => msMiniHtml(0)).join(''));
        return `<div data-foe="${msEsc(n)}" class="ms-foe ${on ? 'ms-foe-on' : ''} ${out ? 'ms-foe-out' : ''} ${pick ? 'ms-foe-pick' : ''} ${pick && msUI.target === n ? 'ms-foe-sel' : ''}" ${pick ? `data-act="target" data-n="${msEsc(n)}"` : ''}>
            ${msAvatarHtml(n)}
            <div style="min-width:0;flex:1">
                <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${msEsc(n)}${n === me ? ' <span style="font-size:.6em;color:#94a3b8">VOUS</span>' : ''} ${r.prot[n] ? '<span title="Protégé par un Champ de force">🛡️</span>' : ''}${out ? ' <span style="color:#f87171;font-size:.7em">éliminé</span>' : ''}</div>
                <div style="font-size:.8em">${msSeals(s.tokens[n], s.goal)} ${on ? '<span style="color:#fbbf24;font-size:.8em;font-weight:800">▶ joue</span>' : ''}</div>
                <div style="display:flex;gap:.2em;flex-wrap:wrap;margin-top:.2em;min-height:1.2em">${r.disc[n].map(msMiniHtml).join('') || '<span style="font-size:.6em;color:#475569">aucune carte jouée</span>'}</div>
            </div>
            <div style="display:flex;gap:.2em;flex-shrink:0">${cards}</div>
        </div>`;
    }).join('');

    // ----- centre : pioche, cartes écartées, dernier coup, informations secrètes -----
    const last = r.last;
    let secret = '';
    if (r.peek && r.peek.by === me) secret = `<div class="ms-box" style="border-color:#22d3ee;display:flex;align-items:center;gap:.8em"><div>${msCardHtml(r.peek.c, '', '', '8em')}</div><div><b style="color:#67e8f9">🔭 Vous seul le voyez :</b><br>${msEsc(r.peek.target)} tient <b>${MS_CARDS[r.peek.c].n} (${r.peek.c})</b>.</div></div>`;
    else if (r.peek && r.peek.target === me) secret = `<div class="ms-box" style="border-color:#22d3ee"><b style="color:#67e8f9">🔭 ${msEsc(r.peek.by)} a vu votre carte.</b></div>`;
    if (r.duel && (r.duel.a === me || r.duel.b === me)) {
        const d = r.duel, mine = d.a === me ? d.ca : d.cb, theirs = d.a === me ? d.cb : d.ca, foe = d.a === me ? d.b : d.a;
        secret = `<div class="ms-box" style="border-color:#f59e0b"><b style="color:#fcd34d">⚔️ Duel (visible de vous deux seulement) :</b> vous <b>${MS_CARDS[mine].n} (${mine})</b> contre ${msEsc(foe)} <b>${MS_CARDS[theirs].n} (${theirs})</b>.</div>`;
    }
    document.getElementById('ms-center').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:1.2em;flex-wrap:wrap">
            <div style="text-align:center"><div id="ms-deck" style="position:relative;display:inline-block">${msCardHtml(0, '', '', '6.5em')}<span style="position:absolute;right:-.5em;bottom:-.4em;background:#fbbf24;color:#0f172a;font-weight:900;border-radius:999px;padding:.05em .5em;font-size:.9em">${r.deck.length}</span></div><div style="font-size:.62em;color:#94a3b8;margin-top:.4em">PIOCHE</div></div>
            <div style="text-align:center;opacity:${r.aside ? 1 : .25}">${r.phase === 'END' && r.aside ? msCardHtml(r.aside, '', '', '6.5em') : msCardHtml(0, '', '', '6.5em')}<div style="font-size:.62em;color:#94a3b8;margin-top:.4em">CARTE ÉCARTÉE</div></div>
            ${r.shown.length ? `<div style="text-align:center"><div style="display:flex;gap:.3em">${r.shown.map(msMiniHtml).join('')}</div><div style="font-size:.62em;color:#94a3b8;margin-top:.4em">HORS JEU (2 JOUEURS)</div></div>` : ''}
            <div class="ms-box" style="flex:1;min-width:14em;max-width:34em">
                <div class="ms-box-h">Dernier coup</div>
                ${last ? `<div style="display:flex;align-items:center;gap:.7em"><span id="ms-last-card">${msCardHtml(last.c, '', '', '5.5em')}</span><div style="font-size:.9em;line-height:1.35"><b>${msEsc(last.by)}</b> joue <b>${MS_CARDS[last.c].n}</b>${last.target && last.target !== last.by ? ' sur <b>' + msEsc(last.target) + '</b>' : ''}${last.guess ? ' et annonce <b>' + MS_CARDS[last.guess].n + '</b>' : ''}.<br><span style="color:#fde68a">${msEsc(last.res)}</span></div></div>` : '<div style="font-size:.85em;color:#94a3b8">La manche commence.</div>'}
            </div>
        </div>${secret}`;

    // ----- ma main et mes actions -----
    const forced = myTurn && r.phase === 'PLAY' && msForced(hand);
    let handHtml = '';
    if (!playing) handHtml = '<div style="color:#94a3b8">Vous assistez à la partie en spectateur.</div>';
    else if (r.out[me]) handHtml = '<div style="color:#f87171;font-weight:800">Vous êtes éliminé de cette manche. Patientez jusqu\'à la suivante.</div>';
    else handHtml = hand.map((c, i) => {
        const blocked = forced && c !== 8;
        return msCardHtml(c, (myTurn ? (blocked ? 'ms-no' : 'ms-pick') : '') + (msUI.sel === i ? ' ms-sel' : ''), myTurn && !blocked ? `data-act="card" data-i="${i}"` : '');
    }).join('');
    document.getElementById('ms-hand').innerHTML = handHtml;

    let act = '';
    if (r.phase === 'END') act = '';
    else if (!playing || r.out[me]) act = `<div style="color:#94a3b8">Au tour de <b>${msEsc(actor)}</b>.</div>`;
    else if (!myTurn) act = `<div>Votre carte est secrète. Au tour de <b style="color:#fbbf24">${msEsc(actor)}</b>...</div>`;
    else if (qmMoi) {
        // Quartier-maître : garder une carte, ranger les autres sous la pioche
        const steps = [`<div style="font-weight:900;color:#5eead4;font-size:1.1em">📦 Quartier-maître : inventaire de la soute</div>`];
        steps.push(`<div style="font-size:.85em;color:#cbd5e1">1. Touchez la carte que vous <b>gardez</b>. Les autres retournent sous la pioche.</div>`);
        const rest = msUI.sel >= 0 ? hand.map((c, k) => ({ c: c, k: k })).filter(x => x.k !== msUI.sel) : [];
        if (msUI.sel >= 0) {
            steps.push(`<div style="font-size:.85em">Vous gardez : <b>${MS_CARDS[hand[msUI.sel]].n} (${hand[msUI.sel]})</b></div>`);
            if (rest.length === 2) steps.push(`<div style="font-size:.85em;color:#cbd5e1">2. Laquelle va <b>tout au fond</b> de la pioche ? ${rest.map((x, j) => `<button class="ms-btn ${msUI.fond === j ? 'ms-btn-on' : ''}" data-act="fond" data-v="${j}">${MS_CARDS[x.c].i} ${MS_CARDS[x.c].n} (${x.c})</button>`).join(' ')}</div>`);
            steps.push(`<div><button class="ms-btn ms-btn-go" data-act="keep" style="font-size:1em;padding:.7em 1.6em">Valider l'inventaire</button></div>`);
        }
        act = steps.join('');
    }
    else {
        const steps = [];
        steps.push(`<div style="font-weight:900;color:#6ee7b7;font-size:1.1em">À vous de jouer !</div>`);
        if (forced) steps.push(`<div style="font-size:.8em;color:#fca5a5">Vous tenez la Stratège avec le Téléporteur ou le Diplomate : vous devez jouer la Stratège.</div>`);
        if (!selCard) steps.push(`<div style="font-size:.85em;color:#cbd5e1">1. Choisissez la carte à jouer. L'autre reste dans votre main.</div>`);
        else {
            steps.push(`<div style="font-size:.85em">Carte choisie : <b>${MS_CARDS[selCard].n} (${selCard})</b></div>`);
            if (msNeedsTarget(selCard) && !targets.length) steps.push(`<div style="font-size:.8em;color:#fde68a">Tous les autres joueurs sont protégés : la carte sera jouée sans effet.</div>`);
            if (needT) steps.push(`<div style="font-size:.85em;color:#cbd5e1">2. Choisissez un joueur${selCard === 5 ? ' (vous pouvez vous viser)' : ''} : ${targets.map(n => `<button class="ms-btn ${msUI.target === n ? 'ms-btn-on' : ''}" data-act="target" data-n="${msEsc(n)}">${msEsc(n)}${n === me ? ' (vous)' : ''}</button>`).join(' ')}</div>`);
            if (needG) steps.push(`<div style="font-size:.85em;color:#cbd5e1">3. Quelle carte tient-il ? ${MS_RANGS.filter(v => v >= 2).reverse().map(v => `<button class="ms-btn ${msUI.guess === v ? 'ms-btn-on' : ''}" data-act="guess" data-v="${v}" title="${MS_CARDS[v].n}">${v} ${MS_CARDS[v].i}</button>`).join(' ')}</div>`);
            const ok = (!needT || msUI.target) && (!needG || msUI.guess);
            steps.push(`<div><button class="ms-btn ms-btn-go" data-act="play" ${ok ? '' : 'disabled'} style="font-size:1em;padding:.7em 1.6em">Jouer ${MS_CARDS[selCard].n}</button></div>`);
        }
        act = steps.join('');
    }
    document.getElementById('ms-act').innerHTML = act;

    // ----- aide-mémoire et journal -----
    const seen = {};      // cartes déjà visibles de tous (défausses + cartes hors jeu)
    s.order.forEach(n => r.disc[n].forEach(c => { seen[c] = (seen[c] || 0) + 1; }));
    r.shown.forEach(c => { seen[c] = (seen[c] || 0) + 1; });
    const mult = s.order.length > 4 ? 2 : 1;
    // compteur des cartes jouées, rang par rang : ✕ = déjà vue de tous, ◆ = dans ma main, ● = encore cachée
    const maMain = {};
    (r.hands[me] || []).forEach(c => { maMain[c] = (maMain[c] || 0) + 1; });
    const compteur = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3em;margin-bottom:.45em">` + MS_RANGS.map(v => {
        const C = MS_CARDS[v], total = C.q * mult, vues = Math.min(total, seen[v] || 0), main = Math.min(total - vues, maMain[v] || 0), cachees = total - vues - main;
        return `<div title="${C.n} : ${vues} jouée${vues > 1 ? 's' : ''} sur ${total}" style="display:flex;align-items:center;gap:.25em;padding:.2em .3em;border-radius:.5em;background:rgba(15,23,42,.7);border:1px solid ${cachees ? 'rgba(148,163,184,.3)' : 'rgba(148,163,184,.12)'};opacity:${cachees ? 1 : .5}">
            <span class="ms-num" style="--c:${C.c}">${v}</span>
            <span style="font-size:.62em;letter-spacing:.05em;line-height:1;word-break:break-all"><span style="color:#f87171">${'✕'.repeat(vues)}</span><span style="color:#67e8f9">${'◆'.repeat(main)}</span><span style="color:#fbbf24">${'●'.repeat(cachees)}</span></span>
        </div>`; }).join('') + `</div><div style="font-size:.6em;color:#94a3b8;margin-bottom:.4em"><span style="color:#f87171">✕</span> déjà jouée · <span style="color:#67e8f9">◆</span> dans votre main · <span style="color:#fbbf24">●</span> encore cachée</div>`;
    document.getElementById('ms-ref').innerHTML = compteur + MS_RANGS.map(v => { const C = MS_CARDS[v], left = C.q * mult - (seen[v] || 0);
        return `<div class="ms-ref" style="${left <= 0 ? 'opacity:.4' : ''}"><span class="ms-num" style="--c:${C.c}">${v}</span><div><b>${C.i} ${C.n}</b> <span style="color:#fbbf24">${left} / ${C.q * mult} en jeu</span><br><span style="color:#cbd5e1">${C.t}</span></div></div>`; }).join('');
    document.getElementById('ms-log').innerHTML = s.log.slice().reverse().map((l, i) => `<div style="${i ? 'color:#94a3b8' : 'color:#f8fafc;font-weight:700'}">• ${msEsc(l)}</div>`).join('');

    msAnimer(s, me);

    // ----- fin de manche / fin de partie -----
    const end = document.getElementById('ms-end');
    if (r.phase === 'END') {
        const over = s.status === 'FINISHED';
        const champions = s.order.filter(n => s.tokens[n] >= s.goal);
        const rows = s.order.slice().sort((a, b) => s.tokens[b] - s.tokens[a]).map(n => `<div style="display:flex;align-items:center;gap:.7em;padding:.35em .2em;border-bottom:1px solid rgba(148,163,184,.2)">
            ${msAvatarHtml(n)}<div style="flex:1;min-width:0;text-align:left"><b>${msEsc(n)}</b> ${r.winners.indexOf(n) >= 0 ? '<span style="color:#6ee7b7;font-size:.8em">+1 sceau</span>' : ''}${r.out[n] ? ' <span style="color:#f87171;font-size:.75em">éliminé</span>' : ''}<br>${msSeals(s.tokens[n], s.goal)}</div>
            <div style="display:flex;gap:.2em">${r.hands[n].map(msMiniHtml).join('')}</div></div>`).join('');
        end.style.display = 'flex';
        end.innerHTML = `<div class="ms-box" style="width:min(34em,92vw);max-height:86vh;overflow-y:auto;text-align:center;border-color:#fbbf24;background:#0d1026">
            <div style="font-size:1.3em;font-weight:900;color:#fde047">${over ? '🏆 ' + champions.map(msEsc).join(' et ') + (champions.length > 1 ? ' remportent' : ' remporte') + ' la partie !' : (r.winners.length ? '✉️ ' + r.winners.map(msEsc).join(' et ') + (r.winners.length > 1 ? ' remportent' : ' remporte') + ' la manche ' + s.round : 'Manche ' + s.round + ' sans vainqueur')}</div>
            <div style="font-size:.8em;color:#cbd5e1;margin:.3em 0 .6em">${msEsc(r.reason)}</div>
            ${rows}
            <div style="margin-top:.8em">${over
                ? '<button onclick="backToLobby()" class="ms-btn ms-btn-go" style="font-size:1em;padding:.7em 2em">Retour au salon</button> <button onclick="demanderRevanche()" class="btn-revanche ms-btn" style="font-size:1em;padding:.7em 1.4em;display:' + (window.isHost ? '' : 'none') + '">🔁 Revanche (hôte)</button> <button onclick="ouvrirSoiree()" class="ms-btn" style="font-size:1em;padding:.7em 1.4em">🏆 Soirée</button>'
                : (playing ? `<button class="ms-btn ms-btn-go" data-act="next" style="font-size:1em;padding:.7em 2em">${champions.length ? 'Voir le résultat final' : 'Manche suivante'}</button>` : '') + `<div style="font-size:.7em;color:#94a3b8;margin-top:.4em">Suite automatique dans <span id="ms-end-timer"></span> s</div>`}</div>
        </div>`;
    } else { end.style.display = 'none'; end.innerHTML = ''; }
    msTick();
}
// Sons : carte jouée, élimination, début de mon tour, fin de manche (rien au premier affichage)
// ============================ ANIMATIONS DES CARTES ============================
// Après chaque affichage, on compare avec l'affichage précédent pour animer ce qui vient de se passer :
// carte piochée (elle vole de la pioche à la main en se retournant), carte choisie (elle se soulève),
// carte jouée ou défaussée (elle vole jusqu'au « dernier coup »), et duel montré face à face aux deux duellistes.
function msRect(el) { return el ? el.getBoundingClientRect() : null; }
function msVol(html, de, vers, ms, fin) {
    if (!de || !vers || !de.width || !vers.width) { if (fin) fin(); return; }
    const root = document.getElementById('ms-root') || document.body;
    const el = document.createElement('div');
    el.className = 'ms-vol';
    el.style.cssText = `position:fixed;z-index:10015;left:${de.left + de.width / 2}px;top:${de.top + de.height / 2}px;font-size:${getComputedStyle(root).fontSize};pointer-events:none;transform:translate(-50%,-50%) scale(1);transition:transform ${ms}ms cubic-bezier(.3,.7,.3,1),opacity ${ms}ms ease-in`;
    el.innerHTML = html;
    root.appendChild(el);
    void el.getBoundingClientRect();
    const dx = vers.left + vers.width / 2 - (de.left + de.width / 2), dy = vers.top + vers.height / 2 - (de.top + de.height / 2);
    el.style.transform = `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${dy.toFixed(0)}px)) scale(${Math.max(0.3, Math.min(1.4, vers.width / Math.max(1, el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width : de.width))).toFixed(2)}) rotate(${dx > 0 ? 8 : -8}deg)`;
    setTimeout(() => { el.remove(); if (fin) fin(); }, ms + 30);
}
function msFoeEl(name) { return [...document.querySelectorAll('#ms-foes .ms-foe')].find(e => e.dataset.foe === name) || null; }
function msAnimer(s, me) {
    const r = s.r, avant = msUI.vu;
    const tot = {}; s.order.forEach(n => { tot[n] = r.disc[n].length; });
    const maintenant = { cle: s.startedAt + ':' + s.round, main: (r.hands[me] || []).slice(), disc: tot, last: r.last ? r.last.by + ':' + r.last.c + ':' + tot[r.last.by] : '', acteur: msActor(s), sel: msUI.sel, duel: r.duel ? r.duel.k : 0, peek: r.peek ? r.peek.k : 0 };
    msUI.vu = maintenant;
    if (!avant || avant.cle !== maintenant.cle) return;      // premier affichage ou nouvelle manche : rien à animer
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const deck = msRect(document.getElementById('ms-deck'));
    // 1) carte choisie dans ma main : elle se soulève
    if (maintenant.sel >= 0 && maintenant.sel !== avant.sel) { const c = document.querySelectorAll('#ms-hand .ms-card')[maintenant.sel]; if (c) c.classList.add('ms-leve'); }
    // 2) carte jouée : elle vole de son joueur jusqu'au « dernier coup »
    if (maintenant.last && maintenant.last !== avant.last && r.last) {
        const cible = document.getElementById('ms-last-card'), origine = r.last.by === me ? document.getElementById('ms-hand') : msFoeEl(r.last.by);
        if (cible) { cible.style.visibility = 'hidden'; msVol(msCardHtml(r.last.c, '', '', '5.5em'), msRect(origine), msRect(cible), 520, () => { cible.style.visibility = ''; cible.firstElementChild && cible.firstElementChild.classList.add('ms-pose'); }); }
    }
    // 3) cartes défaussées (jouées, ou perdues sur un Téléporteur / une élimination) : la dernière « tombe » dans la rangée du joueur
    s.order.forEach(n => {
        if (tot[n] > (avant.disc[n] || 0)) { const f = msFoeEl(n); if (f) { const minis = f.querySelectorAll('.ms-mini:not(.ms-back)'); for (let k = 0; k < tot[n] - (avant.disc[n] || 0); k++) { const m = minis[tot[n] - 1 - k]; if (m) m.classList.add('ms-tombe'); } } }
    });
    // 4) pioche : ma nouvelle carte arrive de la pioche en se retournant ; chez les autres, un dos de carte vole vers le joueur
    const cartes = document.querySelectorAll('#ms-hand .ms-card');
    if (maintenant.main.length > avant.main.length && deck && cartes.length) {
        const c = cartes[cartes.length - 1], cr = msRect(c);
        c.style.setProperty('--dx', (deck.left + deck.width / 2 - (cr.left + cr.width / 2)).toFixed(0) + 'px');
        c.style.setProperty('--dy', (deck.top + deck.height / 2 - (cr.top + cr.height / 2)).toFixed(0) + 'px');
        c.classList.add('ms-pioche');
        if (typeof window.sfx === 'function') window.sfx('carte');
    } else if (maintenant.acteur && maintenant.acteur !== avant.acteur && maintenant.acteur !== me && r.phase === 'PLAY') {
        const f = msFoeEl(maintenant.acteur);
        msVol(msCardHtml(0, '', '', '6.5em'), deck, msRect(f && (f.querySelector('.ms-back') || f)), 480);
    } else if (maintenant.main.length === avant.main.length && maintenant.main.join() !== avant.main.join() && maintenant.acteur !== me && cartes.length && deck) {
        // ma carte a été remplacée (Téléporteur, Diplomate) : la nouvelle arrive
        const c = cartes[0], cr = msRect(c);
        c.style.setProperty('--dx', (deck.left + deck.width / 2 - (cr.left + cr.width / 2)).toFixed(0) + 'px');
        c.style.setProperty('--dy', (deck.top + deck.height / 2 - (cr.top + cr.height / 2)).toFixed(0) + 'px');
        c.classList.add('ms-pioche');
    }
    // 5) duel : les deux cartes face à face, pour les deux duellistes seulement
    if (maintenant.duel && maintenant.duel !== avant.duel && r.duel && (r.duel.a === me || r.duel.b === me)) msDuel(r.duel, me);
    if (maintenant.peek && maintenant.peek !== avant.peek && r.peek && r.peek.by === me) { const c = document.querySelector('#ms-center .ms-box .ms-card:not(.ms-mini)'); if (c) c.classList.add('ms-retourne'); }
}
function msDuel(d, me) {
    const old = document.getElementById('ms-duel'); if (old) old.remove();
    const root = document.getElementById('ms-root');
    if (!root) return;
    const mine = d.a === me ? d.ca : d.cb, theirs = d.a === me ? d.cb : d.ca, foe = d.a === me ? d.b : d.a;
    const issue = mine === theirs ? 0 : (mine > theirs ? 1 : -1);
    const ov = document.createElement('div');
    ov.id = 'ms-duel';
    ov.className = issue > 0 ? 'gagne' : (issue < 0 ? 'perd' : 'egal');
    ov.innerHTML = `<div class="titre">⚔️ DUEL <span>— vous êtes les deux seuls à voir ces cartes</span></div>
        <div class="arene">
            <div class="cote moi"><div class="nom">Vous</div>${msCardHtml(mine, '', '', '13em')}</div>
            <div class="vs">VS</div>
            <div class="cote lui"><div class="nom">${msEsc(foe)}</div>${msCardHtml(theirs, '', '', '13em')}</div>
        </div>
        <div class="verdict">${issue > 0 ? 'Votre carte est la plus forte : ' + msEsc(foe) + ' est éliminé !' : (issue < 0 ? 'Votre carte est la plus faible : vous êtes éliminé...' : 'Égalité : personne n\'est éliminé.')}</div>`;
    ov.onclick = () => ov.remove();
    root.appendChild(ov);
    setTimeout(() => { if (ov.isConnected) ov.remove(); }, 4200);
}

function msSounds(s, me) {
    const r = s.r, prev = msUI.snd;
    const now = { sess: s.startedAt, k: r.last ? r.last.k : -1, round: s.round, mine: s.status === 'PLAYING' && msActor(s) === me, out: !!r.out[me], end: r.phase === 'END' };
    msUI.snd = now;
    if (!prev || prev.sess !== now.sess || typeof window.sfx !== 'function') return;
    if (now.out && !prev.out && now.round === prev.round) window.sfx('elimine');
    else if (now.k !== prev.k && now.k >= 0) window.sfx('carte');
    if (now.end && !prev.end) { if (r.winners.indexOf(me) >= 0) setTimeout(() => window.sfx('victoire'), 500); }
    else if (now.mine && !prev.mine) {
        setTimeout(() => window.sfx('tour'), 400);
        const a = document.getElementById('ms-act'); if (a) { a.classList.remove('ms-myturn'); void a.offsetWidth; a.classList.add('ms-myturn'); }
    }
}
function msCurrent() { const d = window.msData; return d && d.msGame && d.msGame.s ? msNorm(d.msGame.s) : null; }
function msTick() {
    const s = msCurrent(), el = document.getElementById('ms-timer');
    if (!s || !el) return;
    if (s.status !== 'PLAYING') { el.textContent = 'Partie terminée'; return; }
    const left = Math.max(0, Math.ceil((s.dl - Date.now()) / 1000));
    el.textContent = s.r.phase === 'END' ? 'Fin de manche' : '⏱ ' + left + ' s';
    const et = document.getElementById('ms-end-timer'); if (et) et.textContent = left;
}
function msOnAct(d) {
    const s = msCurrent();
    if (!s) return;
    const me = msMe();
    if (d.act === 'next') { msSend({ t: 'next' }); return; }
    if (msActor(s) !== me) return;
    if (d.act === 'card') { const i = Number(d.i); msUI.sel = msUI.sel === i ? -1 : i; msUI.target = ''; msUI.guess = 0; msUI.fond = 0; }
    else if (d.act === 'target') msUI.target = d.n || '';
    else if (d.act === 'guess') msUI.guess = Number(d.v) || 0;
    else if (d.act === 'fond') msUI.fond = Number(d.v) === 1 ? 1 : 0;
    else if (d.act === 'keep') {
        if (msUI.sel < 0) return;
        msSend({ t: 'keep', i: msUI.sel, fond: msUI.fond });
        return;
    }
    else if (d.act === 'play') {
        if (msUI.sel < 0) return;
        msSend({ t: 'play', i: msUI.sel, target: msUI.target, guess: msUI.guess });
        return;
    }
    msRender(s);
}
function msBuildLayout() {
    msPrechargerImages();
    const content = document.getElementById('generic-game-content');
    if (!content) return;
    let st = document.getElementById('ms-style');
    if (!st) { st = document.createElement('style'); st.id = 'ms-style'; document.head.appendChild(st); }
    st.textContent = MS_CSS;
    content.innerHTML = `
        <div id="ms-root">
            <div id="ms-top">
                <span class="sci-font" style="font-weight:800;letter-spacing:.2em;color:#c4b5fd">✉️ MISSIVE STELLAIRE</span>
                <span id="ms-round" style="font-size:.8em;color:#e2e8f0"></span>
                <span id="ms-timer" style="font-family:monospace;font-weight:bold;color:#fbbf24;white-space:nowrap"></span>
            </div>
            <div id="ms-main">
                <div id="ms-table">
                    <div id="ms-foes"></div>
                    <div id="ms-center" style="display:flex;flex-direction:column;gap:.6vw;flex-shrink:0"></div>
                    <div class="ms-box" style="flex:1;display:flex;gap:1.2em;align-items:center;justify-content:center;flex-wrap:wrap;overflow-y:auto">
                        <div id="ms-hand" class="ms-hand" style="display:flex;gap:1em;align-items:center;justify-content:center"></div>
                        <div id="ms-act" style="display:flex;flex-direction:column;gap:.6em;max-width:30em;min-width:14em"></div>
                    </div>
                </div>
                <div id="ms-side">
                    <div class="ms-box" style="flex:0 1 auto;overflow-y:auto"><div class="ms-box-h">Les cartes (de la plus forte à la plus faible)</div><div id="ms-ref"></div></div>
                    <div class="ms-box" style="flex:1 1 8em;overflow-y:auto"><div class="ms-box-h">Journal</div><div id="ms-log" style="font-size:.72em;line-height:1.45"></div></div>
                </div>
            </div>
            <div id="ms-end"></div>
        </div>`;
    document.getElementById('ms-root').onclick = e => {
        const b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (b && !b.disabled) msOnAct(b.dataset);
    };
}

if (typeof window !== 'undefined') {
    // --------------------------- Lancement (hôte) ---------------------------
    window.startMissiveGame = function() {
        if (!window.isHost) return;
        const code = msRoom();
        if (!code || !window.mettreAJourSalonFirebase) return;
        const names = Object.values(state.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
        if (names.length < 2) {
            if (typeof showToast === 'function') showToast('⚠️ Il faut au moins 2 joueurs pour le mode Missive Stellaire !');
            return;
        }
        const timer = Math.max(15, Math.min(120, parseInt(document.getElementById('input-host-timer')?.value, 10) || 45));
        const goal = Math.max(1, Math.min(7, parseInt(document.getElementById('setting-missive-goal')?.value, 10) || 3));
        const s = msNewGame(names, { timer: timer, goal: goal }, Date.now());
        msHost.startedAt = s.startedAt; msHost.state = s; msHost.done = {};
        const updates = { status: 'IN_GAME', selectedMode: 'missive', 'settings/timer': timer, 'settings/msGoal': goal, msGame: { s: s } };
        Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
        window.mettreAJourSalonFirebase(code, updates);
    };

    // --------------------------- Rendu (appelé à chaque mise à jour Firebase) ---------------------------
    window.renderMissiveScreen = function(data) {
        const g = data && data.msGame;
        if (!g || !g.s) return;
        const s = msNorm(g.s);
        const sess = String(s.startedAt);
        // jamais d'affichage d'un état plus ancien que celui déjà à l'écran (écritures imbriquées de l'hôte)
        if (msUI.seenSess === sess && s.seq < msUI.seenSeq) return;
        msUI.seenSess = sess; msUI.seenSeq = s.seq;
        window.msData = data;
        try {
            if (!window.msTicker) window.msTicker = setInterval(() => { msTick(); msHostTick(); }, 1000);
            if (msUI.sess !== sess || !document.getElementById('ms-root')) {
                msUI.sess = sess; msUI.sig = ''; msUI.sel = -1; msUI.target = ''; msUI.guess = 0;
                showScreen('screen-generic-game');
                const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = 'Missive Stellaire';
                msBuildLayout();
            }
            msRender(s);
        } finally { if (window.isHost) msHostProcess(data); }      // l'arbitrage se fait APRÈS l'affichage
    };
}
