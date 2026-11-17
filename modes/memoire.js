// =====================================================================
//  MODE « SÉQUENCE MÉMOIRE » : des cases s'allument l'une après l'autre.
//  Mémorisez l'ordre puis reproduisez-le. La séquence s'allonge à chaque manche.
//  Une seule erreur arrête votre manche : vous marquez selon le nombre de cases
//  correctes, avec un bonus pour une séquence parfaite.
//  (utilise le moteur commun de manches.js)
// =====================================================================

const MEM_CELLS = 9;             // grille 3 × 3
const MEM_FIRST_LENGTH = 4;      // longueur de la séquence à la manche 1 (+1 par manche)
const MEM_MAX_LENGTH = 12;
const MEM_START_DELAY = 900;     // ms avant la première case
const MEM_ON = 480;              // ms pendant lesquelles une case reste allumée
const MEM_OFF = 220;             // ms entre deux cases
const MEM_PERFECT_BONUS = 20;
const MEM_FASTEST_BONUS = 15;    // séquence parfaite la plus rapide, à partir de 2 joueurs
// Habillage « Code d'accès du sas » : un glyphe et une note par touche du clavier de console
const MEM_GLYPHES = ['◇', '△', '○', '☐', '✶', '⬡', '▽', '◎', '✕'];
const MEM_NOTES = [0, 2, 4, 5, 7, 9, 10, 12, 14];   // rang dans la gamme de window.sfxNote (une hauteur par touche)
function memSon(i, d) { if (typeof window.sfxNote === 'function') window.sfxNote(MEM_NOTES[i] || 0, d); }

function memGrid(cellHtml) {
    let html = '';
    for (let i = 0; i < MEM_CELLS; i++) html += cellHtml(i);
    return html;
}

// Points d'une manche (hors bonus de rapidité) : 80 × proportion réussie, +20 si parfait
window.memoirePoints = function(correct, length) {
    length = Math.max(1, Number(length) || 1);
    const c = Math.max(0, Math.min(length, Math.floor(Number(correct) || 0)));
    return Math.round(80 * c / length) + (c === length ? MEM_PERFECT_BONUS : 0);
};

window.MANCHES_MODES.memoire = {
    title: 'Code d’accès du sas',
    minPlayers: 1, minRounds: 3, maxRounds: 12, defaultRounds: 6, revealSeconds: 8,
    fixedTimer: 30,         // remplacé manche par manche par rd.t (dépend de la longueur)

    prepare(count) {
        const rounds = [];
        for (let r = 0; r < count; r++) {
            const len = Math.min(MEM_MAX_LENGTH, MEM_FIRST_LENGTH + r);
            const s = [];
            while (s.length < len) {
                const c = Math.floor(Math.random() * MEM_CELLS);
                if (s.length && s[s.length - 1] === c) continue;       // jamais deux fois de suite la même case
                s.push(c);
            }
            const showSeconds = Math.ceil((MEM_START_DELAY + len * (MEM_ON + MEM_OFF)) / 1000);
            rounds.push({ s: s, t: showSeconds + 6 + len * 2 });
        }
        return rounds;
    },

    renderPlay(ctx) {
        const seq = mchArr(ctx.rd.s).map(Number);
        const mem = ctx.mem = { c: 0, phase: 'show' };
        ctx.el.innerHTML = `
            <div class="p-4 rounded-2xl text-center space-y-1 border border-slate-700" style="background:linear-gradient(#0f172a,#020617)">
                <div class="text-[11px] uppercase tracking-widest text-sky-300 font-mono">🔐 Sas verrouillé · code de ${seq.length} touches</div>
                <div id="mem-status" class="text-lg font-black text-white font-mono tracking-wider">Mémorisez le code…</div>
            </div>
            <div id="mem-console" class="max-w-xs mx-auto rounded-3xl border-2 border-slate-600 p-3 space-y-2" style="background:linear-gradient(#334155,#1e293b);box-shadow:inset 0 2px 0 #475569,0 10px 30px rgba(0,0,0,.5)">
                <div class="flex items-center justify-between px-1">
                    <span class="text-[9px] font-mono text-slate-400 tracking-[.25em]">SAS · PONT 2</span>
                    <span id="mem-led" style="width:10px;height:10px;border-radius:50%;background:#f59e0b;box-shadow:0 0 8px #f59e0b"></span>
                </div>
                <div id="mem-grid" class="grid grid-cols-3 gap-2 select-none">
                    ${memGrid(i => `<button data-i="${i}" class="mem-cell h-24 rounded-xl border-2 border-slate-900 cursor-pointer font-mono text-3xl text-slate-500"
                        style="touch-action:manipulation;transition:background .08s,color .08s,box-shadow .08s;background:linear-gradient(#1e293b,#0f172a);box-shadow:inset 0 -4px 0 #020617">${MEM_GLYPHES[i]}</button>`)}
                </div>
            </div>`;
        const status = document.getElementById('mem-status'), led = document.getElementById('mem-led'), consoleEl = document.getElementById('mem-console');
        const cells = Array.from(ctx.el.querySelectorAll('.mem-cell'));
        const timeouts = [];
        const later = (fn, ms) => { timeouts.push(setTimeout(fn, ms)); };
        ctx.onCleanup(() => timeouts.forEach(clearTimeout));
        const paint = (i, color) => {
            const c = cells[i]; if (!c) return;
            c.style.background = color || 'linear-gradient(#1e293b,#0f172a)';
            c.style.color = color ? '#020617' : '';
            c.style.boxShadow = color ? `0 0 18px ${color}, inset 0 -4px 0 rgba(0,0,0,.25)` : 'inset 0 -4px 0 #020617';
        };
        const setLed = c => { led.style.background = c; led.style.boxShadow = '0 0 8px ' + c; };

        // 1) Affichage de la séquence
        seq.forEach((cell, step) => {
            const at = MEM_START_DELAY + step * (MEM_ON + MEM_OFF);
            later(() => { paint(cell, '#38bdf8'); memSon(cell, MEM_ON / 1000); }, at);
            later(() => paint(cell, ''), at + MEM_ON);
        });
        // 2) Au joueur de la reproduire
        later(() => {
            mem.phase = 'input';
            status.textContent = `Saisissez le code (0 / ${seq.length})`;
            status.style.color = '#34d399';
            setLed('#22d3ee');
        }, MEM_START_DELAY + seq.length * (MEM_ON + MEM_OFF));

        cells.forEach((b, i) => {
            b.onpointerdown = e => {
                e.preventDefault();
                if (mem.phase !== 'input' || !ctx.isOpen()) return;
                if (i === seq[mem.c]) {
                    mem.c++;
                    paint(i, '#34d399');
                    memSon(i, 0.18);
                    later(() => paint(i, ''), 160);
                    status.textContent = `Saisissez le code (${mem.c} / ${seq.length})`;
                    if (mem.c >= seq.length) {
                        mem.phase = 'done';
                        status.textContent = '✔ ACCÈS AUTORISÉ · SAS OUVERT';
                        setLed('#22c55e');
                        if (typeof window.sfx === 'function') window.sfx('sas');
                        ctx.submit(mem.c);
                    }
                } else {
                    mem.phase = 'done';
                    paint(i, '#ef4444');
                    // alarme rouge : la console clignote et le sas reste verrouillé
                    status.textContent = '✖ CODE ERRONÉ · SAS VERROUILLÉ';
                    status.style.color = '#f87171';
                    setLed('#ef4444');
                    if (typeof window.sfx === 'function') window.sfx('alarme');
                    [0, 260, 520].forEach(t => {
                        later(() => { consoleEl.style.boxShadow = '0 0 0 3px #ef4444, 0 0 30px #ef4444'; }, t);
                        later(() => { consoleEl.style.boxShadow = ''; }, t + 130);
                    });
                    ctx.submit(mem.c);
                }
            };
        });
    },

    onTimeout(ctx) { return (ctx.mem && ctx.mem.c) || 0; },

    describe(answer, ctx) {
        const len = mchArr(ctx.rd.s).length;
        const c = Math.max(0, Math.min(len, Math.floor(Number(answer) || 0)));
        return c === len
            ? `<b class="text-emerald-300">Accès autorisé, code parfait !</b> (${c} / ${len})`
            : `Touches correctes : <b class="text-white font-mono">${c} / ${len}</b>`;
    },

    score({ rd, answers, names }) {
        const len = mchArr(rd.s).length;
        const p = {};
        let bestTl = -1, bestCount = 0;
        names.forEach(n => {
            const a = answers[n];
            const c = a ? Math.max(0, Math.min(len, Math.floor(Number(a.a) || 0))) : 0;
            p[n] = { pts: window.memoirePoints(c, len), c: c, perfect: c === len };
            if (c === len) {
                if (a.tl > bestTl) { bestTl = a.tl; bestCount = 1; }
                else if (a.tl === bestTl) bestCount++;
            }
        });
        if (names.length >= 2 && bestCount === 1) {
            names.forEach(n => {
                if (p[n].perfect && answers[n].tl === bestTl) { p[n].pts += MEM_FASTEST_BONUS; p[n].fastest = true; }
            });
        }
        return { p: p, info: {} };
    },

    renderReveal({ rd, res, me, names }) {
        const seq = mchArr(rd.s).map(Number);
        const grid = memGrid(i => {
            const steps = [];
            seq.forEach((c, k) => { if (c === i) steps.push(k + 1); });
            return `<div class="h-14 rounded-xl border ${steps.length ? 'border-sky-400/60 bg-sky-950/40 text-sky-200' : 'border-slate-800 bg-slate-900 text-slate-700'} flex flex-col items-center justify-center text-xs font-mono font-bold"><span class="text-base leading-none opacity-70">${MEM_GLYPHES[i]}</span>${steps.join(' · ')}</div>`;
        });
        const rows = names.map(n => Object.assign({ n: n, c: 0 }, res[n] || {}))
            .sort((a, b) => b.c - a.c)
            .map(r => `<div class="flex justify-between items-center gap-2 px-3 py-2 rounded-lg border ${r.perfect ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900'} text-xs">
                <span class="font-bold ${r.n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(r.n)}${r.fastest ? ' <span class="text-emerald-300">⚡ parfait le plus rapide</span>' : (r.perfect ? ' <span class="text-emerald-300">★ parfait</span>' : '')}</span>
                <span class="font-mono text-slate-200">${r.c} / ${seq.length}</span></div>`).join('');
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-2">
                <div class="text-[11px] uppercase tracking-widest text-sky-300">Le code de ${seq.length} touches (ordre de saisie)</div>
                <div class="grid grid-cols-3 gap-1.5 max-w-[14rem] mx-auto">${grid}</div>
            </div>
            <div class="space-y-1.5">${rows}</div>`;
    }
};
