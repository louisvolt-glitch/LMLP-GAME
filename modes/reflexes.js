// =====================================================================
//  MODE « RÉFLEXES ÉCLAIR » : une série de mini-épreuves de rapidité.
//  Chaque manche tire une épreuve (Feu vert, Tir de précision, Couleur piège,
//  Suite logique). Chacun la joue sur son écran : le temps réalisé donne les points.
//  (utilise le moteur commun de manches.js)
// =====================================================================

// best = temps qui rapporte 100 points, worst = temps à partir duquel on ne marque plus que le minimum
const RFX_KINDS = {
    signal: { name: 'Feu vert', icon: '🚦', best: 180, worst: 700,
        rule: "Touchez le panneau dès qu'il devient VERT. Trop tôt = faux départ : 0 point." },
    cibles: { name: 'Tir de précision', icon: '🎯', best: 2200, worst: 6500,
        rule: "Touchez les 6 cibles qui apparaissent, le plus vite possible." },
    stroop: { name: 'Couleur piège', icon: '🎨', best: 2500, worst: 9000,
        rule: "Choisissez la COULEUR dans laquelle le mot est écrit, pas le mot lui-même. Erreur = +1 s." },
    suite: { name: 'Suite logique', icon: '🔢', best: 3000, worst: 11000,
        rule: "Touchez les nombres de 1 à 9 dans l'ordre croissant. Erreur = +0,5 s." }
};
const RFX_COLORS = [['ROUGE', '#ef4444'], ['BLEU', '#3b82f6'], ['VERT', '#22c55e'], ['JAUNE', '#eab308']];
const RFX_MIN_POINTS = 5;        // épreuve terminée, même très lentement
const RFX_FASTEST_BONUS = 25;    // joueur le plus rapide, à partir de 2 joueurs
const RFX_TARGETS = 6;
const RFX_STROOP_ITEMS = 5;

function rfxRand(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function rfxTime(ms) {
    ms = Math.round(Number(ms) || 0);
    return ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(2).replace('.', ',') + ' s';
}

// Points d'un temps réalisé (0 = épreuve ratée)
window.reflexesPoints = function(kind, ms) {
    const k = RFX_KINDS[kind];
    ms = Number(ms) || 0;
    if (!k || ms <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (k.worst - ms) / (k.worst - k.best)));
    return Math.max(RFX_MIN_POINTS, Math.round(100 * ratio));
};

// ----- Épreuve : Feu vert -----
function rfxPlaySignal(ctx, zone, finish) {
    zone.innerHTML = `<div id="rfx-panel" class="w-full h-64 rounded-2xl flex items-center justify-center text-2xl font-black text-white select-none cursor-pointer" style="background:#b91c1c;touch-action:manipulation">ATTENDEZ...</div>`;
    const panel = document.getElementById('rfx-panel');
    let t0 = 0, over = false;
    const timeout = setTimeout(() => {
        if (over) return;
        panel.style.background = '#16a34a';
        panel.textContent = 'TOUCHEZ !';
        t0 = performance.now();
    }, Number(ctx.rd.d) || 2500);
    ctx.onCleanup(() => clearTimeout(timeout));
    panel.onpointerdown = e => {
        e.preventDefault();
        if (over) return;
        over = true;
        clearTimeout(timeout);
        finish(t0 ? Math.max(1, Math.round(performance.now() - t0)) : 0);      // 0 = faux départ
    };
}

// ----- Épreuve : Tir de précision -----
function rfxPlayCibles(ctx, zone, finish) {
    const pts = mchArr(ctx.rd.p);
    zone.innerHTML = `
        <div id="rfx-count" class="text-center text-xs text-slate-300 font-mono">Cible 1 / ${pts.length}</div>
        <div id="rfx-field" class="relative w-full h-72 rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden select-none" style="touch-action:manipulation"></div>`;
    const field = document.getElementById('rfx-field'), count = document.getElementById('rfx-count');
    let i = 0;
    const t0 = performance.now();
    const show = () => {
        const p = mchArr(pts[i]);
        field.innerHTML = `<button id="rfx-target" class="absolute rounded-full cursor-pointer" style="left:${Number(p[0]) || 0}%;top:${Number(p[1]) || 0}%;width:56px;height:56px;background:radial-gradient(circle,#fff 0 18%,#ef4444 19% 45%,#fff 46% 62%,#ef4444 63% 100%);border:2px solid #fecaca;box-shadow:0 0 14px rgba(239,68,68,.7)"></button>`;
        count.textContent = `Cible ${i + 1} / ${pts.length}`;
        document.getElementById('rfx-target').onpointerdown = e => {
            e.preventDefault();
            i++;
            if (i >= pts.length) finish(Math.max(1, Math.round(performance.now() - t0)));
            else show();
        };
    };
    show();
}

// ----- Épreuve : Couleur piège -----
function rfxPlayStroop(ctx, zone, finish) {
    const items = mchArr(ctx.rd.s);
    zone.innerHTML = `
        <div id="rfx-count" class="text-center text-xs text-slate-300 font-mono"></div>
        <div id="rfx-word" class="h-28 flex items-center justify-center text-5xl font-black tracking-wider select-none rounded-2xl bg-slate-950 border border-slate-700"></div>
        <div class="grid grid-cols-2 gap-2">
            ${RFX_COLORS.map((c, idx) => `<button data-c="${idx}" class="rfx-color py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold cursor-pointer" style="touch-action:manipulation">${c[0]}</button>`).join('')}
        </div>`;
    const word = document.getElementById('rfx-word'), count = document.getElementById('rfx-count');
    let i = 0, penalty = 0;
    const t0 = performance.now();
    const show = () => {
        const it = mchArr(items[i]).map(Number);
        word.textContent = RFX_COLORS[it[0]][0];
        word.style.color = RFX_COLORS[it[1]][1];
        word.style.borderColor = '';
        count.textContent = `Mot ${i + 1} / ${items.length}` + (penalty ? ` · pénalité +${penalty / 1000} s` : '');
    };
    zone.querySelectorAll('.rfx-color').forEach(b => {
        b.onpointerdown = e => {
            e.preventDefault();
            if (i >= items.length) return;
            const ink = Number(mchArr(items[i])[1]);
            if (Number(b.getAttribute('data-c')) === ink) {
                i++;
                if (i >= items.length) finish(Math.max(1, Math.round(performance.now() - t0 + penalty)));
                else show();
            } else {
                penalty += 1000;
                word.style.borderColor = '#ef4444';
                count.textContent = `Mot ${i + 1} / ${items.length} · pénalité +${penalty / 1000} s`;
            }
        };
    });
    show();
}

// ----- Épreuve : Suite logique -----
function rfxPlaySuite(ctx, zone, finish) {
    const order = mchArr(ctx.rd.o).map(Number);
    zone.innerHTML = `
        <div id="rfx-count" class="text-center text-xs text-slate-300 font-mono">Prochain nombre : 1</div>
        <div class="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            ${order.map(n => `<button data-n="${n}" class="rfx-num h-20 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-2xl font-black cursor-pointer" style="touch-action:manipulation">${n}</button>`).join('')}
        </div>`;
    const count = document.getElementById('rfx-count');
    let next = 1, penalty = 0;
    const t0 = performance.now();
    zone.querySelectorAll('.rfx-num').forEach(b => {
        b.onpointerdown = e => {
            e.preventDefault();
            if (b.disabled || next > order.length) return;
            if (Number(b.getAttribute('data-n')) === next) {
                b.disabled = true;
                b.style.background = '#065f46'; b.style.borderColor = '#34d399'; b.style.opacity = '.6';
                next++;
                if (next > order.length) finish(Math.max(1, Math.round(performance.now() - t0 + penalty)));
                else count.textContent = `Prochain nombre : ${next}` + (penalty ? ` · pénalité +${(penalty / 1000).toString().replace('.', ',')} s` : '');
            } else {
                penalty += 500;
                b.style.borderColor = '#ef4444';
                setTimeout(() => { if (!b.disabled) b.style.borderColor = ''; }, 250);
                count.textContent = `Prochain nombre : ${next} · pénalité +${(penalty / 1000).toString().replace('.', ',')} s`;
            }
        };
    });
}

window.MANCHES_MODES.reflexes = {
    title: 'Réflexes Éclair',
    minPlayers: 1, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 7,
    fixedTimer: 30,         // durée maximale d'une épreuve

    prepare(count) {
        let kinds = [];
        while (kinds.length < count) kinds = kinds.concat(mchShuffle(Object.keys(RFX_KINDS)));
        return kinds.slice(0, count).map(k => {
            if (k === 'signal') return { k: k, d: rfxRand(1500, 5000) };
            if (k === 'cibles') {
                const p = [];
                for (let i = 0; i < RFX_TARGETS; i++) p.push([rfxRand(3, 82), rfxRand(4, 76)]);
                return { k: k, p: p };
            }
            if (k === 'stroop') {
                const s = [];
                for (let i = 0; i < RFX_STROOP_ITEMS; i++) {
                    const w = rfxRand(0, 3);
                    let ink = rfxRand(0, 3);
                    if (ink === w) ink = (ink + rfxRand(1, 3)) % 4;      // le mot et l'encre ne coïncident jamais
                    s.push([w, ink]);
                }
                return { k: k, s: s };
            }
            return { k: 'suite', o: mchShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]) };
        });
    },

    renderPlay(ctx) {
        const kind = RFX_KINDS[ctx.rd.k] ? ctx.rd.k : 'suite';
        const k = RFX_KINDS[kind];
        ctx.el.innerHTML = `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-1">
                <div class="text-[11px] uppercase tracking-widest text-yellow-300">⚡ Épreuve</div>
                <div class="text-xl font-black text-white">${k.icon} ${k.name}</div>
                <div class="text-xs text-slate-300">${mchEsc(k.rule)}</div>
            </div>
            <div id="rfx-zone" class="space-y-2">
                <button id="rfx-ready" class="w-full py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider cursor-pointer">Je suis prêt — démarrer</button>
            </div>`;
        const zone = document.getElementById('rfx-zone');
        const finish = ms => { if (ctx.isOpen()) ctx.submit(Math.max(0, Math.round(ms))); };
        document.getElementById('rfx-ready').onclick = () => {
            if (!ctx.isOpen()) return;
            if (kind === 'signal') rfxPlaySignal(ctx, zone, finish);
            else if (kind === 'cibles') rfxPlayCibles(ctx, zone, finish);
            else if (kind === 'stroop') rfxPlayStroop(ctx, zone, finish);
            else rfxPlaySuite(ctx, zone, finish);
        };
    },

    onTimeout() { return 0; },      // épreuve non terminée à temps

    describe(answer, ctx) {
        const ms = Number(answer) || 0;
        if (ms > 0) return `Votre temps : <b class="text-yellow-300 font-mono text-lg">${rfxTime(ms)}</b>`;
        return ctx.rd.k === 'signal' ? 'Faux départ ou temps écoulé : épreuve ratée.' : 'Épreuve non terminée à temps.';
    },

    score({ rd, answers, names }) {
        const p = {};
        let best = Infinity, bestCount = 0;
        names.forEach(n => {
            const ms = answers[n] ? Math.max(0, Math.round(Number(answers[n].a) || 0)) : 0;
            p[n] = { pts: window.reflexesPoints(rd.k, ms), ms: ms };
            if (ms > 0 && ms < best) { best = ms; bestCount = 1; }
            else if (ms > 0 && ms === best) bestCount++;
        });
        if (names.length >= 2 && bestCount === 1) {
            names.forEach(n => { if (p[n].ms === best) { p[n].pts += RFX_FASTEST_BONUS; p[n].fastest = true; } });
        }
        return { p: p, info: {} };
    },

    renderReveal({ rd, res, me, names }) {
        const k = RFX_KINDS[rd.k] || RFX_KINDS.suite;
        const rows = names.map(n => Object.assign({ n: n, ms: 0 }, res[n] || {}))
            .sort((a, b) => (a.ms > 0 ? a.ms : Infinity) - (b.ms > 0 ? b.ms : Infinity))
            .map(r => `<div class="flex justify-between items-center gap-2 px-3 py-2 rounded-lg border ${r.fastest ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900'} text-xs">
                <span class="font-bold ${r.n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(r.n)}${r.fastest ? ' <span class="text-emerald-300">⚡ le plus rapide</span>' : ''}</span>
                <span class="font-mono ${r.ms > 0 ? 'text-yellow-300 font-bold text-sm' : 'text-slate-500 italic'}">${r.ms > 0 ? rfxTime(r.ms) : 'raté'}</span></div>`).join('');
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center">
                <div class="text-[11px] uppercase tracking-widest text-yellow-300">Épreuve</div>
                <div class="text-xl font-black text-white">${k.icon} ${k.name}</div>
            </div>
            <div class="space-y-1.5">${rows}</div>`;
    }
};
