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
    "Une chose que l'on fait le dimanche", "Un mot associé à « pirate »", "Un mot associé à « espace »", "Un mot associé à « Noël »",
    // --- consignes spatiales ---
    "Un objet indispensable dans une capsule", "Un nom de vaisseau", "Une chose qui flotte en apesanteur", "Un aliment d'astronaute",
    "Un métier à bord d'une station spatiale", "Un extraterrestre célèbre", "Une chose que l'on voit depuis l'espace", "Un film qui se passe dans l'espace",
    "Une chose qui manquerait sur Mars", "Un mot associé à « fusée »", "Une constellation ou une étoile", "Un bruit dans un vaisseau"
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

// ---- Révélation illustrée : la constellation ----
// Chaque groupe de réponses identiques forme une constellation : les avatars sont des étoiles reliées.
// Le groupe le plus nombreux (au moins 2 joueurs) est la « fréquence dominante », au centre.
function teleConstellation(groups, me) {
    if (!groups.length) return '';
    const tri = groups.slice().sort((a, b) => b.names.length - a.names.length);
    const dominant = tri[0].names.length >= 2 ? tri[0] : null;
    const H = 240;
    // centres des amas : le premier au centre, les suivants sur une ellipse
    const autour = tri.length - 1;
    const centres = tri.map((g, i) => {
        if (i === 0 && tri.length > 1 && dominant) return { x: 50, y: 48 };
        const idx = dominant ? i - 1 : i, tot = dominant ? autour : tri.length;
        if (tot === 1 && !dominant) return { x: 50, y: 48 };
        const a = (dominant ? 0 : -Math.PI / 2) + (2 * Math.PI * idx) / Math.max(1, tot);     // seul autre groupe : à droite
        return { x: 50 + Math.cos(a) * 33, y: 48 + Math.sin(a) * 28 };
    });
    let lignes = '', etoiles = '', etiquettes = '';
    tri.forEach((g, i) => {
        const c = centres[i], k = g.names.length, dom = g === dominant;
        const rx = k === 1 ? 0 : Math.min(16, (dom ? 7 : 5) + k * 1.8), ry = rx * 1.6;
        const pts = g.names.map((n, j) => {
            const a = -Math.PI / 2 + (2 * Math.PI * j) / k + i * 0.7;
            return { n: n, x: Math.max(5, Math.min(95, c.x + Math.cos(a) * rx)), y: Math.max(8, Math.min(88, c.y + Math.sin(a) * ry)) };
        });
        if (k >= 2) {
            const coul = dom ? '#f0abfc' : '#67e8f9';
            for (let j = 0; j < k; j++) {
                const A = pts[j], B = pts[(j + 1) % k];
                if (k === 2 && j === 1) break;
                lignes += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${coul}" stroke-opacity="${dom ? 0.9 : 0.6}" stroke-width="${dom ? 2 : 1.3}" vector-effect="non-scaling-stroke" stroke-dasharray="${dom ? '' : '3 3'}"/>`;
            }
        }
        pts.forEach(p => {
            const halo = dom ? '0 0 0 2px #f0abfc, 0 0 16px #e879f9' : (k >= 2 ? '0 0 0 2px #67e8f9, 0 0 8px #22d3ee88' : '0 0 0 1px #475569');
            const op = k >= 2 ? 1 : 0.55;
            etoiles += `<div style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);opacity:${op};z-index:2">${mchPastille(p.n, dom ? 30 : 24, 'box-shadow:' + halo + (p.n === me ? ';outline:2px solid #818cf8;outline-offset:2px' : ''))}</div>`;
        });
        const ly = Math.max(...pts.map(p => p.y)) + (dom ? 10 : 8);
        etiquettes += `<div style="position:absolute;left:${c.x}%;top:${Math.min(96, ly)}%;transform:translate(-50%,-50%);z-index:3;white-space:nowrap;text-align:center;
                        font-size:${dom ? 12 : 10}px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${dom ? '#f5d0fe' : (k >= 2 ? '#a5f3fc' : '#64748b')};text-shadow:0 0 6px #000">
                        ${mchEsc(g.word)}${dom ? '<div style="font-size:8px;letter-spacing:.2em;color:#e879f9">◆ FRÉQUENCE DOMINANTE ◆</div>' : ''}</div>`;
    });
    return `
        <div style="position:relative;height:${H}px;margin:4px 0;border-radius:16px;overflow:hidden;border:1px solid #1e293b;
                    background:radial-gradient(ellipse at 50% 45%, #2a1240 0%, #0b0a1e 55%, #04050c 100%);">
            <div style="position:absolute;inset:0;opacity:.6;background-image:radial-gradient(1px 1px at 8% 15%,#fff,transparent),radial-gradient(1px 1px at 22% 70%,#e9d5ff,transparent),radial-gradient(1px 1px at 41% 30%,#fff,transparent),radial-gradient(1px 1px at 63% 85%,#fff,transparent),radial-gradient(1px 1px at 77% 22%,#e9d5ff,transparent),radial-gradient(1px 1px at 90% 58%,#fff,transparent),radial-gradient(1px 1px at 52% 8%,#fff,transparent)"></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;z-index:1">${lignes}</svg>
            ${etoiles}${etiquettes}
        </div>`;
}

window.MANCHES_MODES.telepathie = {
    title: 'Liaison psychique',
    minPlayers: 2, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 9,

    prepare(count) {
        return mchShuffle(TELE_PROMPTS).slice(0, count).map(p => ({ p: p }));
    },

    renderPlay(ctx) {
        ctx.el.innerHTML = `
            <div class="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-4">
                <div class="text-[11px] uppercase tracking-widest text-fuchsia-300">🧠 Liaison psychique · synchronisez-vous avec l'équipage</div>
                <div class="text-2xl font-black text-white">${mchEsc(ctx.rd.p)}</div>
                <input type="text" id="tele-input" maxlength="30" autocomplete="off" placeholder="Un seul mot..."
                    class="w-full max-w-sm mx-auto block bg-slate-950 border border-fuchsia-500/50 rounded-xl px-4 py-3 text-white text-center text-lg focus:outline-none focus:border-fuchsia-300">
                <button id="tele-submit" class="w-full max-w-sm mx-auto block px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm cursor-pointer">Émettre ma pensée</button>
                <div class="text-[11px] text-slate-400">Vous marquez pour chaque membre d'équipage sur la même fréquence que vous. Une pensée isolée ne rapporte rien.</div>
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
            ${teleConstellation(groups, me)}
            <div class="space-y-2">${cards || '<div class="text-center text-slate-500 italic text-sm">Personne n\'a répondu.</div>'}</div>
            ${silent.length ? `<div class="text-[11px] text-slate-500 text-center">Sans réponse : ${silent.map(mchEsc).join(', ')}</div>` : ''}`;
    }
};
