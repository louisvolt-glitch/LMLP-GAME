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

// ------------------------------- Types de lots (objectifs de collection) -------------------------------
const ENCH_TYPES = {
    '🧬 Vivant': ["Œuf extraterrestre", "Plante extraterrestre", "Spécimen en bocal", "Champignon luminescent", "Plante carnivore", "Bonsaï de la Terre", "Aquarium de poche", "Fossile d'ammonite", "Carapace d'un dieu ancien"],
    '🏺 Relique': ["Masque extraterrestre ancien", "Couronne du dragon", "Orbes des anciens", "Tablette gravée", "Obélisque noir", "Artefact pyramidal", "Statue du serpent", "Sablier temporel", "Balise extraterrestre", "Météorite", "Globe terrestre ancien", "Lunette de laiton", "Boussole cosmique", "Lingots d'or", "Coffre de pirate spatial", "Montre du capitaine", "Échiquier du capitaine", "Archive cryptée", "Carte stellaire"],
    '⚙️ Technologie': ["Cristal d'énergie", "Carte planétaire holographique", "Puce prototype", "Bobine Tesla", "Antenne longue portée", "Console de commandement", "Appareil mystérieux", "Générateur de bouclier", "Noyau d'énergie", "Cellule de fusion", "Module de navigation", "Panneau solaire déployable", "Plateforme de téléportation", "Sphère espion", "Antimatière instable", "Carte d'accès", "Réplicateur à café", "Noyau quantique", "Bouclier plasma", "Réacteur miniature", "Scanner orbital", "Générateur de champ", "Puce neuronale"],
    '🚀 Véhicule': ["Moto antigravité", "Capsule de survie", "Module lunaire", "Rover martien", "Fusée vintage", "Nacelle spatiale personnelle", "Cargo de transport", "Station spatiale miniature", "Vaisseau-crabe", "Prototype furtif", "Vaisseau minier", "Satellite d'observation", "Drone éclaireur", "Paire de réacteurs dorsaux"],
    '🔫 Équipement': ["Pistolet à rayons", "Outil de découpe laser", "Casque de combat", "Méca de combat", "Bras robotique", "Casque d'astronaute", "Combinaison spatiale", "Bouteille d'oxygène", "Trousse médicale", "Rations de survie", "Conteneur de stockage", "Balise de détresse"],
    '🎁 Curiosité': ["Robot de collection des années 60", "Burger terrien légendaire", "Robot de compagnie", "Guitare électrique terrienne", "Service à thé futuriste", "Console de jeu rétro", "Canard en caoutchouc d'astronaute", "Chaussette perdue en apesanteur", "Grille-pain spatial", "Gramophone"]
};
window.enchType = function(nom) { return Object.keys(ENCH_TYPES).find(t => ENCH_TYPES[t].indexOf(nom) >= 0) || '🎁 Curiosité'; };

// ------------------------------- Événements du marché -------------------------------
const ENCH_EVENTS = {
    police:  { i: '🚨', n: 'Descente de police', d: 'La mise unique la plus haute est saisie : son auteur paie et repart les mains vides. C’est la deuxième mise unique qui remporte le lot.' },
    inverse: { i: '🎭', n: 'Enchère inversée', d: 'Pour ce lot, c’est la mise la plus BASSE (et unique, au moins 1 crédit) qui l’emporte.' },
    flash:   { i: '💸', n: 'Vente flash', d: 'Le gagnant ne paie que la moitié de sa mise.' },
    double:  { i: '📦', n: 'Lot double', d: 'Ce lot rapporte le double de points.' },
    rumeur:  { i: '☠️', n: 'Rumeur de malédiction', d: 'On dit que ce lot est maudit… S’il l’est vraiment, son gagnant ne marque rien et perd 20 crédits de plus. Réponse au dépouillement !' },
    subvention: { i: '🎁', n: 'Subvention de la station', d: 'Après cette vente, chaque joueur reçoit 15 crédits supplémentaires.' }
};
// ------------------------------- Objectifs secrets -------------------------------
const ENCH_OBJ = {
    collection: { n: 'Collectionneur', d: t => `Remporter 3 lots de type ${t}`, b: 150 },
    paire:      { n: 'Amateur éclairé', d: t => `Remporter 2 lots de type ${t}`, b: 80 },
    eclectique: { n: 'Éclectique', d: () => 'Remporter des lots de 3 types différents', b: 120 },
    radin:      { n: 'Radin', d: () => 'Finir avec au moins 50 crédits et au moins 1 lot', b: 100 },
    flambeur:   { n: 'Flambeur', d: () => 'Dépenser tous ses crédits (finir à 0)', b: 90 },
    grosCoup:   { n: 'Le gros coup', d: () => 'Remporter le lot qui vaut le plus de points', b: 100 },
    saboteur:   { n: 'Saboteur', d: () => 'Faire annuler au moins 2 mises par égalité', b: 80 }
};
// bilan d'un joueur sur toute la partie (manches déjà dépouillées + celle en cours)
function enchBilan(g, nom, actuel) {
    const rounds = mchArr(g.rounds), res = Object.assign({}, g.results || {});
    if (actuel) res['r' + g.round] = actuel;
    const lots = [], egalites = { n: 0 };
    Object.keys(res).forEach(k => {
        const r = res[k] && res[k].p && res[k].p[nom], rd = rounds[parseInt(k.slice(1), 10) - 1];
        if (!r || !rd) return;
        if (r.won && !r.conf) lots.push(rd);
        if (r.tie) egalites.n++;
    });
    let credits = ENCH_BUDGET; Object.keys(res).forEach(k => { const r = res[k] && res[k].p && res[k].p[nom]; if (r && r.paid) credits -= Number(r.paid) || 0; });
    return { lots: lots, types: lots.map(l => window.enchType(l.n)), egalites: egalites.n, credits: Math.max(0, credits) };
}
function enchObjectifAtteint(o, B, g) {
    const nbType = t => B.types.filter(x => x === t).length;
    if (o.k === 'collection') return nbType(o.t) >= 3;
    if (o.k === 'paire') return nbType(o.t) >= 2;
    if (o.k === 'eclectique') return new Set(B.types).size >= 3;
    if (o.k === 'radin') return B.credits >= 50 && B.lots.length >= 1;
    if (o.k === 'flambeur') return B.credits === 0;
    if (o.k === 'grosCoup') { const max = Math.max(...mchArr(g.rounds).map(r => (Number(r.v) || 0) * (r.ev === 'double' ? 2 : 1))); return B.lots.some(l => (Number(l.v) || 0) * (l.ev === 'double' ? 2 : 1) === max); }
    if (o.k === 'saboteur') return B.egalites >= 2;
    return false;
}
function enchTexteObjectif(o) { const O = ENCH_OBJ[o.k]; return O ? `${O.n} : ${O.d(o.t)} (+${O.b} pts)` : ''; }

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

function enchMonObjectif(g, nom) { const o = (mchArr(g && g.rounds)[0] || {}).obj; return o ? o[nom] : null; }
if (typeof document !== 'undefined' && document.head && !document.getElementById('ench-style2')) {
    const st = document.createElement('style'); st.id = 'ench-style2';
    st.textContent = '@keyframes enchEv{0%{opacity:0;transform:scale(1.15) rotate(-1deg)}60%{opacity:1;transform:scale(.98)}100%{transform:none}}';
    document.head.appendChild(st);
}

window.MANCHES_MODES.encheres = {
    title: 'Marché noir de la station',
    minPlayers: 2, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 9,

    prepare(count, names) {
        const lots = enchTirerLots(count);
        let values = [];
        while (values.length < count) values = values.concat(mchShuffle(ENCH_VALUES));
        const rounds = values.slice(0, count).map((v, i) => ({ v: v, n: lots[i % lots.length] }));
        // événements : jamais au premier lot, environ un lot sur trois, sans répéter deux fois de suite le même
        let prec = '';
        rounds.forEach((rd, i) => {
            if (i === 0 || Math.random() > .38) { prec = ''; return; }
            const ev = mchShuffle(Object.keys(ENCH_EVENTS).filter(e => e !== prec))[0];
            rd.ev = ev; prec = ev;
            if (ev === 'rumeur') rd.maudit = Math.random() < .55 ? 1 : 0;
        });
        // objectifs secrets : un par joueur (différents autant que possible)
        const comptes = {}; rounds.forEach(r => { const t = window.enchType(r.n); comptes[t] = (comptes[t] || 0) + 1; });
        const types3 = Object.keys(comptes).filter(t => comptes[t] >= 3), types2 = Object.keys(comptes).filter(t => comptes[t] >= 2);
        const possibles = Object.keys(ENCH_OBJ).filter(k => (k !== 'collection' || types3.length) && (k !== 'paire' || types2.length) && (k !== 'eclectique' || Object.keys(comptes).length >= 3));
        let pioche = [];
        const obj = {};
        (names || []).forEach(n => {
            if (!pioche.length) pioche = mchShuffle(possibles);
            const k = pioche.shift(), o = { k: k };
            if (k === 'collection') o.t = mchShuffle(types3)[0];
            if (k === 'paire') o.t = mchShuffle(types2)[0];
            obj[n] = o;
        });
        if (rounds[0]) rounds[0].obj = obj;
        return rounds;
    },

    renderPlay(ctx) {
        const budget = window.encheresBudget(ctx.g, ctx.me);
        const upcoming = mchArr(ctx.g.rounds).slice(ctx.round).map(r => r.v);
        ctx.el.innerHTML = `
            <div class="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-4">
                <div class="text-[11px] uppercase tracking-widest text-amber-300">🕶️ Marché noir · lot en vente sous le manteau</div>
                <div id="ench-lot3d" class="mx-auto rounded-2xl" style="width:100%;max-width:340px;height:240px;background:radial-gradient(ellipse at 50% 60%,rgba(56,189,248,.14),rgba(2,6,23,0) 65%)"></div>
                <div class="text-xl font-black text-white">${mchEsc(ctx.rd.n)}</div>
                <div class="text-[11px] text-cyan-300 -mt-3">${window.enchType(ctx.rd.n)}</div>
                ${ctx.rd.ev && ENCH_EVENTS[ctx.rd.ev] ? `<div class="ench-ev" style="margin:0 auto;max-width:420px;padding:8px 12px;border-radius:12px;border:2px solid #f59e0b;background:rgba(120,53,15,.35);animation:enchEv .6s ease both">
                    <div style="font-weight:900;color:#fde68a;letter-spacing:.06em">${ENCH_EVENTS[ctx.rd.ev].i} ${ENCH_EVENTS[ctx.rd.ev].n.toUpperCase()}</div>
                    <div style="font-size:12px;color:#fef3c7">${ENCH_EVENTS[ctx.rd.ev].d}</div></div>` : ''}
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
                ${(() => { const o = enchMonObjectif(ctx.g, ctx.me); if (!o) return ''; const B = enchBilan(ctx.g, ctx.me), ok = enchObjectifAtteint(o, B, ctx.g);
                    return `<div style="margin:2px auto 0;max-width:420px;padding:7px 10px;border-radius:10px;border:1px dashed ${ok ? '#34d399' : '#a78bfa'};background:rgba(76,29,149,.18);font-size:12px;color:#ddd6fe">🎯 <b>Objectif secret</b> · ${mchEsc(enchTexteObjectif(o))}${ok ? ' <b style="color:#6ee7b7">✓ atteint pour l’instant</b>' : ''}
                        <div style="font-size:10px;color:#a78bfa;margin-top:2px">Vos lots : ${B.lots.length ? B.lots.map(l => mchEsc(l.n) + ' (' + window.enchType(l.n).split(' ')[0] + ')').join(', ') : 'aucun'}</div></div>`; })()}
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
        const counts = {}; Object.values(bids).forEach(b => { if (b > 0) counts[b] = (counts[b] || 0) + 1; });
        const uniques = Object.keys(counts).map(Number).filter(b => counts[b] === 1).sort((a, b) => b - a);
        const qui = b => Object.keys(bids).find(n => bids[n] === b) || null;
        let winner = null, saisi = null;
        if (rd.ev === 'inverse') winner = uniques.length ? qui(uniques[uniques.length - 1]) : null;
        else if (rd.ev === 'police') { saisi = uniques.length ? qui(uniques[0]) : null; winner = uniques.length > 1 ? qui(uniques[1]) : null; }
        else winner = window.encheresWinner(bids);
        const maudit = rd.ev === 'rumeur' && rd.maudit;
        const valeur = (Number(rd.v) || 0) * (rd.ev === 'double' ? 2 : 1);
        const p = {};
        names.forEach(n => {
            const won = n === winner, budget = window.encheresBudget(g, n);
            let paid = won || n === saisi ? bids[n] : 0;
            if (won && rd.ev === 'flash') paid = Math.ceil(bids[n] / 2);
            if (won && maudit) paid = Math.min(budget, bids[n] + 20);
            if (rd.ev === 'subvention') paid -= 15;
            p[n] = { pts: won && !maudit ? valeur : 0, bid: bids[n], paid: paid, won: won, conf: n === saisi ? 1 : 0, tie: bids[n] > 0 && counts[bids[n]] > 1 ? 1 : 0, left: budget - paid };
        });
        // dernier lot : les objectifs secrets sont révélés et rapportent leur bonus
        const info = { w: winner || '', s: saisi || '' };
        if (g.round >= g.maxRounds) {
            const obj = (mchArr(g.rounds)[0] || {}).obj || {}, bilan = {};
            names.forEach(n => {
                const o = obj[n]; if (!o) return;
                const B = enchBilan(g, n, { p: p }), ok = enchObjectifAtteint(o, B, g);
                bilan[n] = { k: o.k, t: o.t || '', ok: ok ? 1 : 0 };
                if (ok) { const b = ENCH_OBJ[o.k].b; p[n].pts += g.maxRounds > 1 ? Math.ceil(b / 2) : b; p[n].obj = b; }      // la manche finale est doublée par le moteur
            });
            info.obj = bilan;
        }
        return { p: p, info: info };
    },

    renderReveal({ rd, res, info, me, names, g }) {
        const rows = names.map(n => Object.assign({ n: n, bid: 0, left: ENCH_BUDGET }, res[n] || {}));
        const counts = {};
        rows.forEach(r => { if (r.bid > 0) counts[r.bid] = (counts[r.bid] || 0) + 1; });
        const list = rows.sort((a, b) => b.bid - a.bid).map(r => {
            let tag;
            if (r.won) tag = '<span class="text-emerald-300 font-bold">🏆 remporte le lot</span>';
            else if (r.conf) tag = '<span class="text-amber-300 font-bold">🚨 mise saisie par la police</span>';
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
            ${rd.ev && ENCH_EVENTS[rd.ev] ? `<div style="padding:8px 12px;border-radius:12px;border:1px solid #f59e0b;background:rgba(120,53,15,.3);text-align:center;font-size:12px;color:#fef3c7">
                <b style="color:#fde68a">${ENCH_EVENTS[rd.ev].i} ${ENCH_EVENTS[rd.ev].n}</b> · ${rd.ev === 'police' ? (info.s ? `${mchEsc(info.s)} s’est fait saisir sa mise par la police !` : 'la police repart bredouille.')
                    : rd.ev === 'rumeur' ? (rd.maudit ? '☠️ <b>Le lot était bien maudit !</b>' + (info.w ? ` ${mchEsc(info.w)} ne marque rien et perd 20 crédits.` : '') : '😮‍💨 Fausse alerte : le lot n’était pas maudit.')
                    : rd.ev === 'flash' ? 'le gagnant ne paie que la moitié de sa mise.' : rd.ev === 'double' ? 'ce lot comptait double !' : rd.ev === 'inverse' ? 'la plus petite mise unique l’emportait.' : 'chacun reçoit 15 crédits.'}</div>` : ''}
            <div class="space-y-1.5">${list}</div>
            ${info.obj ? `<div style="padding:10px;border-radius:14px;border:1px solid #a78bfa;background:rgba(76,29,149,.2)">
                <div style="text-align:center;font-weight:900;letter-spacing:.14em;color:#ddd6fe;font-size:12px;margin-bottom:6px">🎯 OBJECTIFS SECRETS RÉVÉLÉS</div>
                ${Object.keys(info.obj).map(n => { const o = info.obj[n], O = ENCH_OBJ[o.k] || { n: '?', d: () => '', b: 0 };
                    return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;border-top:1px solid rgba(167,139,250,.2)"><span><b class="${n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(n)}</b> · ${mchEsc(O.n)} <span style="color:#a5b4fc">(${mchEsc(O.d(o.t))})</span></span><b style="color:${o.ok ? '#6ee7b7' : '#f87171'};white-space:nowrap">${o.ok ? '✓ +' + O.b : '✗'}</b></div>`; }).join('')}</div>` : ''}`;
    }
};
