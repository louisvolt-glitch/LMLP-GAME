// =====================================================================
//  MODE « MARCHÉ NOIR DE LA STATION » : des enchères à l'aveugle.
//  Chaque joueur reçoit 100 crédits pour TOUTE la partie. À chaque manche un lot
//  est mis en jeu : tout le monde mise en secret. La mise la plus haute ET unique
//  remporte le lot et paie sa mise. Les mises identiques s'annulent entre elles.
//  (utilise le moteur commun de manches.js)
// =====================================================================

const ENCH_BUDGET = 100;
const ENCH_VALUES = [20, 30, 40, 50, 60, 80, 100];
// Lots de secours si le catalogue 3D (encheres-3d.js) n'est pas chargé
const ENCH_LOTS = [
    "Cristal d'énergie", "Module de navigation", "Noyau quantique", "Drone éclaireur", "Carte stellaire", "Bouclier plasma",
    "Cellule de fusion", "Antenne longue portée", "Prototype furtif", "Archive cryptée", "Réacteur miniature", "Balise de détresse",
    "Scanner orbital", "Générateur de champ", "Puce neuronale", "Capsule de survie"
];

// Tirage des lots : on évite ceux des parties récentes (mémorisés sur l'appareil de l'hôte)
// pour qu'une même pièce ne revienne pas d'une partie à l'autre.
const ENCH_RECENTS_CLE = 'lmlp-ench-recents';
function enchTirerLots(count) {
    const tous = (window.ENCH_CATALOGUE && window.ENCH_CATALOGUE.length) ? window.ENCH_CATALOGUE.map(l => l.n) : ENCH_LOTS;
    let recents = [];
    try { recents = JSON.parse(localStorage.getItem(ENCH_RECENTS_CLE) || '[]'); } catch (e) {}
    const neufs = mchShuffle(tous.filter(n => recents.indexOf(n) < 0));
    const vus = mchShuffle(tous.filter(n => recents.indexOf(n) >= 0));
    const lots = neufs.concat(vus).slice(0, Math.min(count, tous.length));
    try {
        const garder = Math.max(0, tous.length - count);            // on garde en mémoire autant de lots qu'on peut éviter
        localStorage.setItem(ENCH_RECENTS_CLE, JSON.stringify(lots.concat(recents.filter(n => lots.indexOf(n) < 0)).slice(0, garder)));
    } catch (e) {}
    return lots;
}

// Tampon « ADJUGÉ / INVENDU » : il s'abat sur le lot après la surprise (une seule fois par manche)
const enchTampons = {};
if (typeof document !== 'undefined' && document.head && !document.getElementById('ench-style')) {
    const st = document.createElement('style'); st.id = 'ench-style';
    st.textContent = '@keyframes enchTampon{0%{opacity:0;transform:rotate(-12deg) scale(3)}70%{opacity:1;transform:rotate(-12deg) scale(.9)}100%{opacity:1;transform:rotate(-12deg) scale(1)}}' +
        '.ench-tampon{opacity:0;animation:enchTampon .35s cubic-bezier(.2,1.6,.4,1) 2.6s forwards;z-index:6}';
    document.head.appendChild(st);
}

// Crédits restants d'un joueur avant la manche en cours (budget de départ moins les mises payées)
window.encheresBudget = function(g, name) {
    let left = ENCH_BUDGET;
    const results = (g && g.results) || {};
    Object.keys(results).forEach(k => {
        const r = results[k] && results[k].p && results[k].p[name];
        if (r && r.paid) left -= Number(r.paid) || 0;
    });
    return Math.max(0, left);
};

// Détermine le gagnant : la mise la plus haute qui n'a été faite que par un seul joueur
window.encheresWinner = function(bids) {
    const counts = {};
    Object.values(bids).forEach(b => { if (b > 0) counts[b] = (counts[b] || 0) + 1; });
    const unique = Object.keys(counts).map(Number).filter(b => counts[b] === 1).sort((a, b) => b - a);
    if (!unique.length) return null;
    return Object.keys(bids).find(n => bids[n] === unique[0]) || null;
};

window.MANCHES_MODES.encheres = {
    title: 'Marché noir de la station',
    minPlayers: 2, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 9,

    prepare(count) {
        const lots = enchTirerLots(count);
        let values = [];
        while (values.length < count) values = values.concat(mchShuffle(ENCH_VALUES));
        return values.slice(0, count).map((v, i) => ({ v: v, n: lots[i % lots.length] }));
    },

    renderPlay(ctx) {
        const budget = window.encheresBudget(ctx.g, ctx.me);
        const upcoming = mchArr(ctx.g.rounds).slice(ctx.round).map(r => r.v);
        ctx.el.innerHTML = `
            <div class="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-4">
                <div class="text-[11px] uppercase tracking-widest text-amber-300">🕶️ Marché noir · lot en vente sous le manteau</div>
                <div id="ench-lot3d" class="mx-auto rounded-2xl" style="width:100%;max-width:340px;height:240px;background:radial-gradient(ellipse at 50% 60%,rgba(56,189,248,.14),rgba(2,6,23,0) 65%)"></div>
                <div class="text-xl font-black text-white">${mchEsc(ctx.rd.n)}</div>
                ${typeof window.enchCredit === 'function' && window.enchCredit(ctx.rd.n) ? `<div class="text-[10px] text-slate-500 -mt-3">${window.enchCredit(ctx.rd.n)}</div>` : ''}
                <div class="text-4xl font-black text-emerald-400 font-mono">${Number(ctx.rd.v) || 0} <span class="text-base text-emerald-300">pts</span></div>
                <div class="text-sm text-slate-300">Vos crédits restants : <b class="text-amber-300 font-mono text-lg">${budget}</b></div>
                <div class="flex items-center justify-center gap-2 max-w-sm mx-auto">
                    <button data-d="-10" class="ench-step px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">−10</button>
                    <button data-d="-1" class="ench-step px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">−1</button>
                    <input type="number" id="ench-input" min="0" max="${budget}" step="1" value="0"
                        class="w-24 bg-slate-950 border border-amber-500/50 rounded-xl px-2 py-3 text-white text-center font-mono text-xl focus:outline-none focus:border-amber-300">
                    <button data-d="1" class="ench-step px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">+1</button>
                    <button data-d="10" class="ench-step px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">+10</button>
                </div>
                <button id="ench-submit" class="w-full max-w-sm mx-auto block px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm cursor-pointer">Miser en secret</button>
                <div class="text-[11px] text-slate-400">La mise la plus haute et <b>unique</b> gagne le lot et paie sa mise. Les mises identiques s'annulent. Miser 0 = passer son tour.</div>
                <div class="text-[11px] text-slate-500">${upcoming.length ? 'Lots à venir : ' + upcoming.map(v => v + ' pts').join(' · ') : 'Dernier lot de la partie : les crédits restants ne valent plus rien.'}</div>
            </div>`;
        if (typeof window.enchMonter3D === 'function') window.enchMonter3D(document.getElementById('ench-lot3d'), ctx.rd.n, { mode: 'mise' });      // le lot tourne en 3D
        const suivant = mchArr(ctx.g.rounds)[ctx.round];                                      // on télécharge déjà le lot suivant
        if (suivant && typeof window.enchPrecharger === 'function') window.enchPrecharger(suivant.n);
        const input = document.getElementById('ench-input');
        const read = () => Math.max(0, Math.min(budget, Math.floor(Number(input.value) || 0)));
        ctx.el.querySelectorAll('.ench-step').forEach(b => {
            b.onclick = () => { input.value = Math.max(0, Math.min(budget, read() + Number(b.getAttribute('data-d')))); };
        });
        input.onchange = () => { input.value = read(); };
        input.onkeydown = e => { if (e.key === 'Enter') ctx.submit(read()); };
        document.getElementById('ench-submit').onclick = () => ctx.submit(read());
    },

    onTimeout() { return 0; },      // pas de mise validée à temps : le joueur passe son tour

    describe(answer) {
        const b = Math.floor(Number(answer) || 0);
        return b > 0 ? `Votre mise secrète : <b class="text-amber-300 font-mono">${b}</b> crédits` : 'Vous passez votre tour (mise de 0).';
    },

    score({ rd, answers, names, g }) {
        const bids = {};
        names.forEach(n => {
            const a = answers[n];
            const budget = window.encheresBudget(g, n);
            bids[n] = a ? Math.max(0, Math.min(budget, Math.floor(Number(a.a) || 0))) : 0;
        });
        const winner = window.encheresWinner(bids);
        const p = {};
        names.forEach(n => {
            const won = n === winner;
            const paid = won ? bids[n] : 0;
            p[n] = { pts: won ? (Number(rd.v) || 0) : 0, bid: bids[n], paid: paid, won: won, left: window.encheresBudget(g, n) - paid };
        });
        return { p: p, info: { w: winner || '' } };
    },

    renderReveal({ rd, res, info, me, names, g }) {
        const rows = names.map(n => Object.assign({ n: n, bid: 0, left: ENCH_BUDGET }, res[n] || {}));
        const counts = {};
        rows.forEach(r => { if (r.bid > 0) counts[r.bid] = (counts[r.bid] || 0) + 1; });
        const list = rows.sort((a, b) => b.bid - a.bid).map(r => {
            let tag;
            if (r.won) tag = '<span class="text-emerald-300 font-bold">🏆 remporte le lot</span>';
            else if (r.bid > 0 && counts[r.bid] > 1) tag = '<span class="text-red-300">✕ mise annulée (égalité)</span>';
            else if (r.bid > 0) tag = '<span class="text-slate-400">mise trop basse</span>';
            else tag = '<span class="text-slate-500 italic">passe son tour</span>';
            return `<div class="flex justify-between items-center gap-2 px-3 py-2 rounded-lg border ${r.won ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900'} text-xs">
                <span class="font-bold ${r.n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(r.n)} <span class="font-normal">${tag}</span></span>
                <span class="text-right shrink-0"><b class="text-amber-300 font-mono text-sm">${r.bid}</b> <span class="text-slate-500">· reste ${r.left}</span></span></div>`;
        }).join('');
        // le lot reste affiché en 3D à la révélation, avec un tampon « ADJUGÉ » ou « INVENDU »
        const cle = [rd.n, g && g.round, g && (g.sess || g.startedAt || '')].join('|');
        const premiere = !enchTampons[cle]; enchTampons[cle] = true;          // l'écran se redessine souvent : le tampon ne s'abat qu'une fois
        setTimeout(() => { if (typeof window.enchMonter3D === 'function') window.enchMonter3D(document.getElementById('ench-rev3d'), rd.n, { mode: 'revelation', surprise: info.w ? 'adjuge' : 'invendu', cle: cle }); }, 0);
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-1">
                <div class="relative mx-auto" style="width:100%;max-width:320px;height:210px">
                    <div id="ench-rev3d" style="position:absolute;inset:0"></div>
                    <div class="${premiere ? 'ench-tampon' : ''}" style="position:absolute;right:4px;top:10px;transform:rotate(-12deg);border:3px solid ${info.w ? '#34d399' : '#f87171'};color:${info.w ? '#34d399' : '#f87171'};padding:2px 10px;border-radius:8px;font-weight:900;letter-spacing:.15em;font-size:15px;background:rgba(2,6,23,.6);pointer-events:none">${info.w ? 'ADJUGÉ' : 'INVENDU'}</div>
                </div>
                <div class="text-sm font-bold text-slate-200">${mchEsc(rd.n)} · <span class="text-emerald-400 font-mono">${Number(rd.v) || 0} pts</span></div>
                <div class="text-lg font-black ${info.w ? 'text-emerald-400' : 'text-red-300'}">${info.w ? mchEsc(info.w) + ' remporte le lot !' : 'Personne ne remporte le lot !'}</div>
            </div>
            <div class="space-y-1.5">${list}</div>`;
    }
};
