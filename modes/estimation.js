// =====================================================================
//  MODE « AU PLUS PROCHE » : une question dont la réponse est un nombre.
//  Personne ne connaît la valeur exacte : plus votre estimation est proche,
//  plus vous marquez. Bonus pour le joueur le plus proche et pour la valeur exacte.
//  (utilise le moteur commun de manches.js)
// =====================================================================

// v = bonne réponse, tol = écart à partir duquel on ne marque plus rien,
// eps = écart toléré pour être considéré « exact » (facultatif).
const EST_QUESTIONS = [
    // ------------------------ Monuments & géographie ------------------------
    { id: 'eiffel', q: "Quelle est la hauteur de la tour Eiffel, antennes comprises ?", v: 330, unit: 'm', tol: 150, info: "330 m depuis l'installation d'une nouvelle antenne en 2022." },
    { id: 'eiffel-marches', q: "Combien de marches faut-il gravir pour atteindre le sommet de la tour Eiffel ?", v: 1665, unit: 'marches', tol: 900, info: "1 665 marches du sol au sommet." },
    { id: 'tour-cn', q: "Quelle est la hauteur de la Tour CN de Toronto ?", v: 553, unit: 'm', tol: 250, info: "553 m : elle a longtemps été la plus haute structure autoportante du monde." },
    { id: 'everest', q: "Quelle est l'altitude du mont Everest ?", v: 8849, unit: 'm', tol: 3000, info: "8 849 m selon la mesure officielle sino-népalaise de 2020." },
    { id: 'mont-blanc', q: "Quelle est l'altitude du mont Blanc ?", v: 4806, unit: 'm', tol: 2000, eps: 4, info: "Environ 4 806 m : la hauteur varie de quelques mètres selon l'épaisseur de neige." },
    { id: 'mariannes', q: "Quelle est la profondeur approximative de la fosse des Mariannes, le point le plus profond des océans ?", v: 10935, unit: 'm', tol: 5000, eps: 60, info: "Environ 10 935 m sous la surface." },
    { id: 'nil', q: "Quelle est la longueur approximative du Nil ?", v: 6650, unit: 'km', tol: 3000, eps: 50, info: "Environ 6 650 km." },
    { id: 'terre-diametre', q: "Quel est le diamètre de la Terre à l'équateur ?", v: 12756, unit: 'km', tol: 6000, eps: 10, info: "12 756 km à l'équateur." },
    { id: 'terre-lune', q: "Quelle est la distance moyenne entre la Terre et la Lune ?", v: 384400, unit: 'km', tol: 200000, eps: 500, info: "384 400 km en moyenne." },
    { id: 'onu', q: "Combien d'États sont membres de l'ONU ?", v: 193, unit: 'États', tol: 80, info: "193 États membres." },
    { id: 'departements', q: "Combien de départements compte la France ?", v: 101, unit: 'départements', tol: 40, info: "101 départements : 96 en métropole et 5 en outre-mer." },
    { id: 'canada', q: "Combien de provinces et territoires compte le Canada, au total ?", v: 13, unit: '', tol: 7, info: "10 provinces et 3 territoires." },
    { id: 'usa-bandes', q: "Combien de bandes compte le drapeau des États-Unis ?", v: 13, unit: 'bandes', tol: 8, info: "13 bandes, pour les 13 colonies d'origine." },
    { id: 'ue-etoiles', q: "Combien d'étoiles figurent sur le drapeau européen ?", v: 12, unit: 'étoiles', tol: 8, info: "12 étoiles, quel que soit le nombre de pays membres." },

    // ------------------------ Histoire ------------------------
    { id: 'bastille', q: "En quelle année a eu lieu la prise de la Bastille ?", v: 1789, unit: '', tol: 60, year: true, info: "Le 14 juillet 1789." },
    { id: 'napoleon', q: "En quelle année est né Napoléon Bonaparte ?", v: 1769, unit: '', tol: 50, year: true, info: "Le 15 août 1769, à Ajaccio." },
    { id: 'confederation', q: "En quelle année la Confédération canadienne a-t-elle été créée ?", v: 1867, unit: '', tol: 50, year: true, info: "Le 1er juillet 1867." },
    { id: 'telephone', q: "En quelle année Alexander Graham Bell a-t-il breveté le téléphone ?", v: 1876, unit: '', tol: 50, year: true, info: "Brevet accordé en mars 1876." },
    { id: 'titanic', q: "En quelle année le Titanic a-t-il fait naufrage ?", v: 1912, unit: '', tol: 25, year: true, info: "Dans la nuit du 14 au 15 avril 1912." },
    { id: 'lune', q: "En quelle année l'être humain a-t-il marché sur la Lune pour la première fois ?", v: 1969, unit: '', tol: 15, year: true, info: "Mission Apollo 11, juillet 1969." },
    { id: 'mur-berlin', q: "En quelle année le mur de Berlin est-il tombé ?", v: 1989, unit: '', tol: 15, year: true, info: "Le 9 novembre 1989." },
    { id: 'cent-ans', q: "Combien d'années a réellement duré la guerre de Cent Ans ?", v: 116, unit: 'ans', tol: 60, info: "116 ans, de 1337 à 1453." },

    // ------------------------ Sciences & corps humain ------------------------
    { id: 'os', q: "Combien d'os compte le squelette d'un adulte ?", v: 206, unit: 'os', tol: 100, info: "206 os chez l'adulte." },
    { id: 'dents', q: "Combien de dents compte une dentition adulte complète, dents de sagesse comprises ?", v: 32, unit: 'dents', tol: 16, info: "32 dents." },
    { id: 'cotes', q: "Combien de côtes compte le corps humain ?", v: 24, unit: 'côtes', tol: 14, info: "24 côtes, soit 12 paires." },
    { id: 'elements', q: "Combien d'éléments chimiques compte le tableau périodique ?", v: 118, unit: 'éléments', tol: 50, info: "118 éléments reconnus." },
    { id: 'lumiere', q: "Quelle est la vitesse de la lumière dans le vide, en kilomètres par seconde ?", v: 299792, unit: 'km/s', tol: 150000, eps: 300, info: "299 792 km/s." },
    { id: 'son', q: "Quelle est la vitesse du son dans l'air à 20 °C, en mètres par seconde ?", v: 343, unit: 'm/s', tol: 200, eps: 3, info: "Environ 343 m/s." },
    { id: 'fahrenheit', q: "À combien de degrés Fahrenheit l'eau bout-elle au niveau de la mer ?", v: 212, unit: '°F', tol: 110, info: "212 °F, soit 100 °C." },
    { id: 'zero-absolu', q: "Quelle est la température du zéro absolu, en degrés Celsius ?", v: -273.15, unit: '°C', tol: 150, eps: 0.5, info: "−273,15 °C : la température la plus basse possible." },
    { id: 'mars', q: "Combien de jours terrestres dure une année sur Mars ?", v: 687, unit: 'jours', tol: 350, info: "687 jours terrestres." },
    { id: 'pieuvre', q: "Combien de cœurs possède une pieuvre ?", v: 3, unit: 'cœurs', tol: 4, info: "3 cœurs : deux pour les branchies, un pour le reste du corps." },
    { id: 'elephant', q: "Combien de mois dure environ la gestation d'une éléphante ?", v: 22, unit: 'mois', tol: 14, eps: 0.5, info: "Environ 22 mois : la plus longue gestation des mammifères terrestres." },

    // ------------------------ Jeux, sport & culture ------------------------
    { id: 'piano', q: "Combien de touches compte un piano standard ?", v: 88, unit: 'touches', tol: 45, info: "88 touches : 52 blanches et 36 noires." },
    { id: 'harpe', q: "Combien de cordes compte une harpe de concert ?", v: 47, unit: 'cordes', tol: 30, info: "47 cordes." },
    { id: 'beethoven', q: "Combien de symphonies Beethoven a-t-il achevées ?", v: 9, unit: 'symphonies', tol: 7, info: "9 symphonies." },
    { id: 'echiquier', q: "Combien de cases compte un échiquier ?", v: 64, unit: 'cases', tol: 35, info: "64 cases (8 × 8)." },
    { id: 'sudoku', q: "Combien de cases compte une grille de sudoku classique ?", v: 81, unit: 'cases', tol: 45, info: "81 cases (9 × 9)." },
    { id: 'monopoly', q: "Combien de cases compte le plateau du Monopoly ?", v: 40, unit: 'cases', tol: 22, info: "40 cases." },
    { id: 'tarot', q: "Combien de cartes compte un jeu de tarot français ?", v: 78, unit: 'cartes', tol: 40, info: "78 cartes." },
    { id: 'grec', q: "Combien de lettres compte l'alphabet grec ?", v: 24, unit: 'lettres', tol: 12, info: "24 lettres, d'alpha à oméga." },
    { id: 'marathon', q: "Quelle est la distance d'un marathon, en kilomètres ?", v: 42.195, unit: 'km', tol: 18, eps: 0.2, info: "42,195 km." },
    { id: 'hockey', q: "Combien de minutes dure le temps réglementaire d'un match de hockey de la LNH ?", v: 60, unit: 'min', tol: 30, info: "60 minutes : trois périodes de 20 minutes." },
    { id: 'pokemon', q: "Combien de Pokémon compte la toute première génération ?", v: 151, unit: 'Pokémon', tol: 90, info: "151, de Bulbizarre à Mew." },
    { id: 'harry-potter', q: "Combien de films compte la saga principale Harry Potter ?", v: 8, unit: 'films', tol: 6, info: "8 films, le dernier livre ayant été adapté en deux parties." },
    { id: 'star-wars', q: "En quelle année le tout premier film Star Wars est-il sorti ?", v: 1977, unit: '', tol: 15, year: true, info: "En mai 1977 aux États-Unis." },
    { id: 'playstation', q: "En quelle année la première PlayStation est-elle sortie au Japon ?", v: 1994, unit: '', tol: 10, year: true, info: "En décembre 1994." },
    { id: 'google', q: "En quelle année l'entreprise Google a-t-elle été fondée ?", v: 1998, unit: '', tol: 10, year: true, info: "En septembre 1998." },
    { id: 'iphone', q: "En quelle année le premier iPhone a-t-il été commercialisé ?", v: 2007, unit: '', tol: 8, year: true, info: "En juin 2007." },
    { id: 'minecraft', q: "En quelle année la version 1.0 de Minecraft est-elle sortie ?", v: 2011, unit: '', tol: 8, year: true, info: "En novembre 2011." }
];

const EST_EXACT_BONUS = 50;     // estimation exacte
const EST_CLOSEST_BONUS = 25;   // joueur(s) le(s) plus proche(s), à partir de 2 joueurs

function estGet(id) { return EST_QUESTIONS.find(q => q.id === id) || EST_QUESTIONS[0]; }
function estVal(q, n) {
    const txt = q.year ? String(Math.round(n)) : mchFmt(n);
    return txt.replace('-', '−') + (q.unit ? ' ' + q.unit : '');
}
// Lit un nombre saisi par le joueur : « 1 665 », « 42,195 », « −273 »
function estParse(raw) {
    const s = String(raw == null ? '' : raw).replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
}

// Points d'une estimation (hors bonus du plus proche)
window.estimationPoints = function(q, guess) {
    const diff = Math.abs(guess - q.v);
    const exact = diff <= (q.eps || 0);
    let pts = Math.round(100 * Math.max(0, 1 - diff / q.tol));
    if (exact) pts = 100 + EST_EXACT_BONUS;
    return { pts: pts, diff: diff, exact: exact };
};

window.MANCHES_MODES.estimation = {
    title: 'Au Plus Proche',
    minPlayers: 1, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 10,

    prepare(count) {
        return mchShuffle(EST_QUESTIONS).slice(0, count).map(q => ({ q: q.id }));
    },

    renderPlay(ctx) {
        const q = estGet(ctx.rd.q);
        ctx.el.innerHTML = `
            <div class="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-4">
                <div class="text-[11px] uppercase tracking-widest text-cyan-300">🎯 Estimez au plus proche</div>
                <div class="text-lg font-black text-white">${mchEsc(q.q)}</div>
                <div class="flex items-center justify-center gap-2 max-w-sm mx-auto">
                    <input type="text" inputmode="decimal" id="est-input" autocomplete="off" placeholder="Votre estimation"
                        class="flex-1 min-w-0 bg-slate-950 border border-cyan-500/50 rounded-xl px-4 py-3 text-white text-center font-mono text-xl focus:outline-none focus:border-cyan-300">
                    ${q.unit ? `<span class="text-slate-300 font-bold text-sm shrink-0">${mchEsc(q.unit)}</span>` : ''}
                </div>
                <div id="est-error" class="text-xs text-red-400 h-4"></div>
                <button id="est-submit" class="w-full max-w-sm mx-auto block px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm cursor-pointer">Valider mon estimation</button>
                <div class="text-[11px] text-slate-400">Plus vous êtes proche, plus vous marquez. Sans réponse : 0 point.</div>
            </div>`;
        const input = document.getElementById('est-input');
        const send = () => {
            const n = estParse(input.value);
            if (n === null) {
                const err = document.getElementById('est-error');
                if (err) err.textContent = 'Entrez un nombre (chiffres uniquement).';
                return;
            }
            ctx.submit(n);
        };
        document.getElementById('est-submit').onclick = send;
        input.onkeydown = e => { if (e.key === 'Enter') send(); };
        input.focus();
    },

    // Temps écoulé : on envoie ce qui est déjà saisi, si c'est un nombre valide
    onTimeout() {
        const input = document.getElementById('est-input');
        const n = input ? estParse(input.value) : null;
        return n === null ? '' : n;
    },

    describe(answer, ctx) {
        if (answer === '' || answer == null) return 'Aucune estimation envoyée.';
        return `Votre estimation : <b class="text-white">${mchEsc(estVal(estGet(ctx.rd.q), Number(answer)))}</b>`;
    },

    score({ rd, answers, names }) {
        const q = estGet(rd.q);
        const p = {};
        let best = Infinity;
        names.forEach(n => {
            const a = answers[n];
            if (!a || a.a === '' || !isFinite(Number(a.a))) { p[n] = { pts: 0, none: true }; return; }
            const r = window.estimationPoints(q, Number(a.a));
            p[n] = { pts: r.pts, guess: Number(a.a), diff: r.diff, exact: r.exact };
            if (r.diff < best) best = r.diff;
        });
        if (names.length >= 2 && isFinite(best)) {
            names.forEach(n => {
                if (!p[n].none && p[n].diff === best) { p[n].pts += EST_CLOSEST_BONUS; p[n].closest = true; }
            });
        }
        return { p: p, info: {} };
    },

    renderReveal({ rd, res, me, names }) {
        const q = estGet(rd.q);
        const rows = names.map(n => Object.assign({ n: n }, res[n] || { pts: 0, none: true }))
            .sort((a, b) => (a.none ? Infinity : a.diff) - (b.none ? Infinity : b.diff))
            .map(r => {
                const detail = r.none
                    ? '<span class="text-slate-500 italic">pas de réponse</span>'
                    : `<b class="text-white font-mono">${mchEsc(estVal(q, r.guess))}</b> <span class="text-slate-400">· écart ${mchEsc(estVal(q, r.diff).replace('−', ''))}</span>`;
                const badge = r.exact ? ' <span class="text-amber-300">★ exact</span>' : (r.closest ? ' <span class="text-emerald-300">🎯 le plus proche</span>' : '');
                return `<div class="flex justify-between items-center gap-2 px-3 py-2 rounded-lg border ${r.closest || r.exact ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900'} text-xs">
                    <span class="font-bold ${r.n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(r.n)}${badge}</span>
                    <span class="text-right">${detail}</span></div>`;
            }).join('');
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-2">
                <div class="text-sm font-bold text-slate-200">${mchEsc(q.q)}</div>
                <div class="text-3xl font-black text-emerald-400 font-mono">${mchEsc(estVal(q, q.v))}</div>
                <div class="text-xs text-slate-400">${mchEsc(q.info)}</div>
            </div>
            <div class="space-y-1.5">${rows}</div>`;
    }
};
