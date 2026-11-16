// =====================================================================
//  MODE « ESPRIT COMMUN » : une consigne, un seul mot.
//  Le but n'est pas d'être original mais de penser COMME LES AUTRES :
//  vous marquez des points pour chaque joueur qui a écrit la même réponse que vous.
//  (utilise le moteur commun de manches.js)
// =====================================================================

const TELE_PROMPTS = [
    "Un fruit rouge", "Un animal de la ferme", "Un super-héros", "Une marque de voiture", "Un instrument de musique",
    "Une couleur de l'arc-en-ciel", "Un sport d'hiver", "Un sport avec un ballon", "Un légume vert", "Une capitale européenne",
    "Un personnage de Disney", "Un métier dangereux", "Un objet dans une cuisine", "Une chose que l'on trouve à la plage",
    "Un animal de la jungle", "Une saveur de crème glacée", "Un jeu de société", "Un jeu vidéo très connu", "Une planète du système solaire",
    "Un pays d'Asie", "Un pays d'Afrique", "Un dessert", "Une boisson chaude", "Un moyen de transport", "Une fleur",
    "Un animal marin", "Un objet dans une trousse d'école", "Un vêtement d'hiver", "Une garniture de pizza", "Un réseau social",
    "Une chose qui fait peur", "Un personnage de conte de fées", "Un oiseau", "Un insecte", "Une ville des États-Unis",
    "Une matière scolaire", "Une pièce de la maison", "Un meuble", "Une fête de l'année", "Une chose que l'on emporte en camping",
    "Un film d'animation", "Un fromage", "Une chose ronde", "Une chose froide", "Une chose qui vole", "Un métal",
    "Un animal de compagnie", "Une partie du visage", "Un jour de la semaine", "Un mois de l'année", "Une épice ou un condiment",
    "Un sport olympique", "Un outil de bricolage", "Un personnage de Star Wars", "Un Pokémon", "Une langue parlée dans le monde",
    "Une chose que l'on fait le dimanche", "Un mot associé à « pirate »", "Un mot associé à « espace »", "Un mot associé à « Noël »"
];

const TELE_GROUP_BONUS = 25;    // bonus pour le(s) groupe(s) le(s) plus nombreux

// Clé de comparaison : minuscules, sans article, sans accents ni espaces, pluriel simple retiré
function teleKey(raw) {
    const s = String(raw == null ? '' : raw).toLowerCase().trim()
        .replace(/^(une|un|les|le|la|des|du)\s+/, '').replace(/^[ld]['’]\s*/, '');
    let k = mchNorm(s);
    if (k.length > 3 && /[sx]$/.test(k)) k = k.slice(0, -1);
    return k;
}
// Deux réponses sont identiques si les clés sont égales, ou à une faute de frappe près pour les mots assez longs
function teleSame(a, b) {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 5) return false;
    return mchLev(a, b) <= 1;
}

// Regroupe les réponses identiques : [{ word, key, names: [...] }]
window.telepathieGroups = function(answers, names) {
    const groups = [];
    names.forEach(n => {
        const a = answers[n];
        const raw = a ? String(a.a == null ? '' : a.a).trim() : '';
        const key = teleKey(raw);
        if (!key) return;
        const g = groups.find(x => teleSame(x.key, key));
        if (g) g.names.push(n);
        else groups.push({ word: raw.slice(0, 30), key: key, names: [n] });
    });
    return groups;
};

window.MANCHES_MODES.telepathie = {
    title: 'Esprit Commun',
    minPlayers: 2, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 9,

    prepare(count) {
        return mchShuffle(TELE_PROMPTS).slice(0, count).map(p => ({ p: p }));
    },

    renderPlay(ctx) {
        ctx.el.innerHTML = `
            <div class="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-4">
                <div class="text-[11px] uppercase tracking-widest text-fuchsia-300">🧠 Pensez comme les autres</div>
                <div class="text-2xl font-black text-white">${mchEsc(ctx.rd.p)}</div>
                <input type="text" id="tele-input" maxlength="30" autocomplete="off" placeholder="Un seul mot..."
                    class="w-full max-w-sm mx-auto block bg-slate-950 border border-fuchsia-500/50 rounded-xl px-4 py-3 text-white text-center text-lg focus:outline-none focus:border-fuchsia-300">
                <button id="tele-submit" class="w-full max-w-sm mx-auto block px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm cursor-pointer">Envoyer ma réponse</button>
                <div class="text-[11px] text-slate-400">Vous marquez pour chaque joueur qui a écrit la même chose que vous. Une réponse unique ne rapporte rien.</div>
            </div>`;
        const input = document.getElementById('tele-input');
        const send = () => {
            const v = input.value.trim().slice(0, 30);
            if (!teleKey(v)) { input.focus(); return; }
            ctx.submit(v);
        };
        document.getElementById('tele-submit').onclick = send;
        input.onkeydown = e => { if (e.key === 'Enter') send(); };
        input.focus();
    },

    onTimeout() {
        const input = document.getElementById('tele-input');
        return input ? input.value.trim().slice(0, 30) : '';
    },

    describe(answer) {
        const v = String(answer == null ? '' : answer).trim();
        return v ? `Votre réponse : <b class="text-white">${mchEsc(v)}</b>` : 'Aucune réponse envoyée.';
    },

    score({ answers, names }) {
        const groups = window.telepathieGroups(answers, names);
        const biggest = groups.reduce((m, g) => Math.max(m, g.names.length), 0);
        const others = Math.max(1, names.length - 1);
        const p = {};
        names.forEach(n => { p[n] = { pts: 0 }; });
        groups.forEach(g => {
            const k = g.names.length;
            g.names.forEach(n => {
                let pts = k >= 2 ? Math.round(100 * (k - 1) / others) : 0;
                if (k >= 2 && k === biggest) pts += TELE_GROUP_BONUS;
                p[n] = { pts: pts, same: k - 1 };
            });
        });
        return { p: p, info: {} };
    },

    renderReveal({ rd, answers, res, me, names }) {
        const groups = window.telepathieGroups(answers, names).sort((a, b) => b.names.length - a.names.length);
        const silent = names.filter(n => !groups.some(g => g.names.indexOf(n) >= 0));
        const cards = groups.map(g => {
            const k = g.names.length;
            const mine = g.names.indexOf(me) >= 0;
            const pts = (res[g.names[0]] && res[g.names[0]].pts) || 0;
            return `<div class="p-3 rounded-xl border ${k >= 2 ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900'} ${mine ? 'ring-1 ring-indigo-400' : ''}">
                <div class="flex justify-between items-center gap-2">
                    <span class="font-black text-white uppercase tracking-wide break-words">${mchEsc(g.word)}</span>
                    <span class="shrink-0 text-xs font-mono ${k >= 2 ? 'text-emerald-300' : 'text-slate-500'}">× ${k} · +${pts}</span>
                </div>
                <div class="text-[11px] text-slate-300 mt-1">${g.names.map(n => `<span class="${n === me ? 'text-indigo-300 font-bold' : ''}">${mchEsc(n)}</span>`).join(', ')}</div>
            </div>`;
        }).join('');
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center">
                <div class="text-[11px] uppercase tracking-widest text-fuchsia-300">La consigne était</div>
                <div class="text-xl font-black text-white">${mchEsc(rd.p)}</div>
            </div>
            <div class="space-y-2">${cards || '<div class="text-center text-slate-500 italic text-sm">Personne n\'a répondu.</div>'}</div>
            ${silent.length ? `<div class="text-[11px] text-slate-500 text-center">Sans réponse : ${silent.map(mchEsc).join(', ')}</div>` : ''}`;
    }
};
