// =====================================================================
//  MODE « RÉFLEXES ÉCLAIR » : une série de mini-épreuves de rapidité.
//  Chaque manche tire une épreuve (Feu vert, Tir de précision, Couleur piège,
//  Suite logique). Chacun la joue sur son écran : le temps réalisé donne les points.
//  (utilise le moteur commun de manches.js)
// =====================================================================

// best = temps qui rapporte 100 points, worst = temps à partir duquel on ne marque plus que le minimum
const RFX_KINDS = {
    signal: { name: 'Saut hyperespace', icon: '🌀', best: 180, worst: 700,
        rule: "Moteurs en charge… Enclenchez le saut dès que le voyant passe au VERT. Trop tôt = moteurs noyés : 0 point." },
    cibles: { name: 'Défense anti-astéroïdes', icon: '☄️', best: 2200, worst: 6500,
        rule: "Pulvérisez les 6 astéroïdes qui foncent sur le vaisseau, le plus vite possible." },
    stroop: { name: 'Alerte de quart', icon: '🚨', best: 2500, worst: 9000,
        rule: "Un voyant s'allume : indiquez la COULEUR de sa lumière, pas le mot affiché. Erreur = +1 s." },
    suite: { name: 'Allumage du réacteur', icon: '⚛️', best: 3000, worst: 11000,
        rule: "Activez les cellules du réacteur de 1 à 9, dans l'ordre. Erreur = +0,5 s." }
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

// ----- Décor commun : champ d'étoiles animé sur un <canvas> -----
// vitesse() renvoie la vitesse courante : faible = dérive, forte = traînées du saut hyperespace.
function rfxEtoiles(ctx, canvas, vitesse) {
    const c = canvas.getContext('2d');
    const etoiles = Array.from({ length: 140 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    let raf = 0, fini = false;
    const dessine = () => {
        if (fini) return;
        const w = canvas.width = canvas.clientWidth, h = canvas.height = canvas.clientHeight;
        const v = vitesse();
        c.fillStyle = v > 0.05 ? 'rgba(2,6,23,0.35)' : '#020617';
        c.fillRect(0, 0, w, h);
        etoiles.forEach(e => {
            const z0 = e.z;
            e.z -= v * 0.02 + 0.0008;
            if (e.z <= 0.02) { e.x = Math.random() * 2 - 1; e.y = Math.random() * 2 - 1; e.z = 1; return; }
            const px = w / 2 + (e.x / e.z) * w * 0.35, py = h / 2 + (e.y / e.z) * h * 0.35;
            const qx = w / 2 + (e.x / z0) * w * 0.35, qy = h / 2 + (e.y / z0) * h * 0.35;
            const lum = Math.min(1, 1.2 - e.z);
            c.strokeStyle = `rgba(${v > 0.05 ? '165,243,252' : '226,232,240'},${lum})`;
            c.lineWidth = Math.max(0.6, (1 - e.z) * 2.2);
            c.beginPath(); c.moveTo(qx, qy); c.lineTo(px, py); c.stroke();
        });
        raf = requestAnimationFrame(dessine);
    };
    dessine();
    ctx.onCleanup(() => { fini = true; cancelAnimationFrame(raf); });
}
const RFX_FOND_ETOILES = "background-color:#020617;background-image:radial-gradient(1px 1px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 80%,#cbd5e1,transparent),radial-gradient(1.5px 1.5px at 55% 35%,#fff,transparent),radial-gradient(1px 1px at 75% 70%,#e2e8f0,transparent),radial-gradient(1px 1px at 90% 15%,#fff,transparent),radial-gradient(1px 1px at 45% 92%,#cbd5e1,transparent)";
function rfxSon(nom) { if (typeof window.sfx === 'function') window.sfx(nom); }

// ----- Épreuve : Saut hyperespace (ex-Feu vert) -----
function rfxPlaySignal(ctx, zone, finish) {
    zone.innerHTML = `
        <div id="rfx-panel" class="relative w-full h-64 rounded-2xl overflow-hidden select-none cursor-pointer border border-slate-700" style="touch-action:manipulation;background:#020617">
            <canvas id="rfx-ciel" class="absolute inset-0 w-full h-full"></canvas>
            <div class="absolute inset-x-0 bottom-0 p-4 flex flex-col items-center gap-2" style="background:linear-gradient(transparent,rgba(2,6,23,.95))">
                <div id="rfx-voyant" style="width:26px;height:26px;border-radius:50%;background:#dc2626;box-shadow:0 0 18px #dc2626"></div>
                <div id="rfx-msg" class="font-mono font-black tracking-widest text-red-300 text-lg">MOTEURS EN CHARGE…</div>
            </div>
        </div>`;
    const panel = document.getElementById('rfx-panel'), voyant = document.getElementById('rfx-voyant'), msg = document.getElementById('rfx-msg');
    let vitesse = 0, t0 = 0, over = false;
    rfxEtoiles(ctx, document.getElementById('rfx-ciel'), () => vitesse);
    const timeout = setTimeout(() => {
        if (over) return;
        voyant.style.background = '#22c55e'; voyant.style.boxShadow = '0 0 24px #22c55e';
        msg.textContent = 'SAUTEZ !'; msg.className = 'font-mono font-black tracking-widest text-emerald-300 text-2xl';
        t0 = performance.now();
    }, Number(ctx.rd.d) || 2500);
    ctx.onCleanup(() => clearTimeout(timeout));
    panel.onpointerdown = e => {
        e.preventDefault();
        if (over) return;
        over = true;
        clearTimeout(timeout);
        if (t0) {
            const ms = Math.max(1, Math.round(performance.now() - t0));
            vitesse = 3;                                    // traînées du saut
            msg.textContent = 'SAUT ENCLENCHÉ · ' + rfxTime(ms);
            rfxSon('warp');
            setTimeout(() => finish(ms), 650);              // le temps est mesuré au clic, l'animation ne compte pas
        } else {
            voyant.style.background = '#7f1d1d'; voyant.style.boxShadow = 'none';
            msg.textContent = 'MOTEURS NOYÉS · FAUX DÉPART';
            rfxSon('erreur');
            setTimeout(() => finish(0), 500);               // 0 = faux départ
        }
    };
}

// ----- Épreuve : Défense anti-astéroïdes (ex-Tir de précision) -----
function rfxAsteroide(graine) {
    // forme irrégulière stable : rayons de bordure tirés à partir de la position
    const r = n => 38 + ((graine * (n + 3) * 9301 + 49297) % 233280) / 233280 * 24;
    return `border-radius:${r(1)}% ${r(2)}% ${r(3)}% ${r(4)}% / ${r(5)}% ${r(6)}% ${r(7)}% ${r(8)}%;` +
        'background:radial-gradient(circle at 30% 30%,#a8a29e 0 8%,transparent 9%),radial-gradient(circle at 65% 60%,#57534e 0 10%,transparent 11%),radial-gradient(circle at 40% 70%,#44403c 0 7%,transparent 8%),radial-gradient(circle at 35% 30%,#a8a29e,#57534e 60%,#292524);' +
        'box-shadow:inset -6px -6px 12px rgba(0,0,0,.6),0 0 12px rgba(251,146,60,.35)';
}
function rfxPlayCibles(ctx, zone, finish) {
    const pts = mchArr(ctx.rd.p);
    zone.innerHTML = `
        <div id="rfx-count" class="text-center text-xs text-orange-300 font-mono tracking-widest">ASTÉROÏDE 1 / ${pts.length}</div>
        <div id="rfx-field" class="relative w-full h-72 rounded-2xl border border-slate-700 overflow-hidden select-none" style="touch-action:manipulation;${RFX_FOND_ETOILES}">
            <div class="absolute inset-0 pointer-events-none" style="background:radial-gradient(circle at 50% 50%,transparent 0 30%,rgba(34,211,238,.06) 31%,transparent 32%,transparent 60%,rgba(34,211,238,.06) 61%,transparent 62%)"></div>
        </div>`;
    const field = document.getElementById('rfx-field'), count = document.getElementById('rfx-count');
    let i = 0;
    const t0 = performance.now();
    const eclat = (x, y) => {
        const b = document.createElement('div');
        b.style.cssText = `position:absolute;left:calc(${x}% + 28px);top:calc(${y}% + 28px);width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%) scale(1);
            background:radial-gradient(circle,#fff,#fdba74 40%,#ea580c 70%,transparent 72%);pointer-events:none;transition:transform .35s ease-out,opacity .35s ease-out;opacity:1`;
        field.appendChild(b);
        requestAnimationFrame(() => { b.style.transform = 'translate(-50%,-50%) scale(9)'; b.style.opacity = '0'; });
        setTimeout(() => b.remove(), 400);
    };
    const show = () => {
        const p = mchArr(pts[i]);
        const x = Number(p[0]) || 0, y = Number(p[1]) || 0;
        const old = document.getElementById('rfx-target'); if (old) old.remove();
        const t = document.createElement('button');
        t.id = 'rfx-target'; t.className = 'absolute cursor-pointer';
        t.style.cssText = `left:${x}%;top:${y}%;width:56px;height:56px;border:none;transform:rotate(${(x * 7 + y * 3) % 360}deg);${rfxAsteroide(x * 100 + y + i)}`;
        field.appendChild(t);
        count.textContent = `ASTÉROÏDE ${i + 1} / ${pts.length}`;
        t.onpointerdown = e => {
            e.preventDefault();
            eclat(x, y);
            rfxSon('touche');
            i++;
            if (i >= pts.length) { t.remove(); finish(Math.max(1, Math.round(performance.now() - t0))); }
            else show();
        };
    };
    show();
}

// ----- Épreuve : Alerte de quart (ex-Couleur piège) -----
function rfxPlayStroop(ctx, zone, finish) {
    const items = mchArr(ctx.rd.s);
    zone.innerHTML = `
        <div id="rfx-count" class="text-center text-xs text-slate-300 font-mono tracking-widest"></div>
        <div class="relative rounded-2xl border-2 border-slate-600 p-3" style="background:linear-gradient(#1e293b,#0f172a)">
            <div class="text-[9px] font-mono text-slate-400 tracking-[.25em] mb-2 text-center">PANNEAU D'ALERTE · PONT 3</div>
            <div id="rfx-word" class="h-28 flex items-center justify-center text-5xl font-black tracking-wider select-none rounded-xl font-mono border-2 border-slate-800"
                 style="background:#020617;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px)"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
            ${RFX_COLORS.map((c, idx) => `<button data-c="${idx}" class="rfx-color py-4 rounded-xl border-2 border-slate-600 text-slate-100 font-mono font-bold tracking-widest cursor-pointer flex items-center justify-center gap-2"
                style="touch-action:manipulation;background:linear-gradient(#334155,#1e293b);box-shadow:inset 0 -3px 0 #0f172a">
                <span style="width:9px;height:9px;border-radius:50%;background:#e2e8f0;box-shadow:0 0 6px #e2e8f0"></span>${c[0]}</button>`).join('')}
        </div>`;
    const word = document.getElementById('rfx-word'), count = document.getElementById('rfx-count');
    let i = 0, penalty = 0;
    const t0 = performance.now();
    const show = () => {
        const it = mchArr(items[i]).map(Number);
        const ink = RFX_COLORS[it[1]][1];
        word.textContent = RFX_COLORS[it[0]][0];
        word.style.color = ink;
        word.style.textShadow = `0 0 14px ${ink}, 0 0 2px ${ink}`;
        word.style.borderColor = '';
        count.textContent = `ALERTE ${i + 1} / ${items.length}` + (penalty ? ` · pénalité +${penalty / 1000} s` : '');
    };
    zone.querySelectorAll('.rfx-color').forEach(b => {
        b.onpointerdown = e => {
            e.preventDefault();
            if (i >= items.length) return;
            const ink = Number(mchArr(items[i])[1]);
            if (Number(b.getAttribute('data-c')) === ink) {
                rfxSon('clic');
                i++;
                if (i >= items.length) finish(Math.max(1, Math.round(performance.now() - t0 + penalty)));
                else show();
            } else {
                penalty += 1000;
                rfxSon('erreur');
                word.style.borderColor = '#ef4444';
                count.textContent = `ALERTE ${i + 1} / ${items.length} · pénalité +${penalty / 1000} s`;
            }
        };
    });
    show();
}

// ----- Épreuve : Allumage du réacteur (ex-Suite logique) -----
function rfxPlaySuite(ctx, zone, finish) {
    const order = mchArr(ctx.rd.o).map(Number);
    const fmtPen = pen => (pen / 1000).toString().replace('.', ',');
    zone.innerHTML = `
        <div id="rfx-count" class="text-center text-xs text-cyan-300 font-mono tracking-widest">CELLULE SUIVANTE : 1</div>
        <div class="max-w-xs mx-auto rounded-2xl border-2 border-slate-600 p-3 space-y-3" style="background:radial-gradient(circle at 50% 50%,#0c4a6e55,#0f172a 70%)">
            <div class="grid grid-cols-3 gap-2">
                ${order.map(n => `<button data-n="${n}" class="rfx-num h-20 rounded-full border-2 border-slate-600 text-slate-200 text-2xl font-black font-mono cursor-pointer"
                    style="touch-action:manipulation;background:radial-gradient(circle,#334155,#0f172a)">${n}</button>`).join('')}
            </div>
            <div class="h-2 rounded-full bg-slate-800 overflow-hidden"><div id="rfx-jauge" style="height:100%;width:0;background:linear-gradient(90deg,#0891b2,#67e8f9);transition:width .15s"></div></div>
            <div class="text-[9px] font-mono text-slate-400 tracking-[.25em] text-center">PUISSANCE DU RÉACTEUR</div>
        </div>`;
    const count = document.getElementById('rfx-count'), jauge = document.getElementById('rfx-jauge');
    let next = 1, penalty = 0;
    const t0 = performance.now();
    zone.querySelectorAll('.rfx-num').forEach(b => {
        b.onpointerdown = e => {
            e.preventDefault();
            if (b.disabled || next > order.length) return;
            if (Number(b.getAttribute('data-n')) === next) {
                b.disabled = true;
                b.style.background = 'radial-gradient(circle,#a5f3fc,#0891b2 60%,#164e63)';
                b.style.borderColor = '#67e8f9'; b.style.color = '#082f49';
                b.style.boxShadow = '0 0 16px #22d3ee';
                if (typeof window.sfxNote === 'function') window.sfxNote(next + 2, 0.12);
                jauge.style.width = Math.round(100 * next / order.length) + '%';
                next++;
                if (next > order.length) { count.textContent = 'RÉACTEUR EN LIGNE'; rfxSon('depart'); finish(Math.max(1, Math.round(performance.now() - t0 + penalty))); }
                else count.textContent = `CELLULE SUIVANTE : ${next}` + (penalty ? ` · pénalité +${fmtPen(penalty)} s` : '');
            } else {
                penalty += 500;
                rfxSon('erreur');
                b.style.borderColor = '#ef4444';
                setTimeout(() => { if (!b.disabled) b.style.borderColor = ''; }, 250);
                count.textContent = `CELLULE SUIVANTE : ${next} · pénalité +${fmtPen(penalty)} s`;
            }
        };
    });
}

window.MANCHES_MODES.reflexes = {
    title: 'Simulateur de pilotage',
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
                <div class="text-[11px] uppercase tracking-widest text-yellow-300 font-mono">🕹️ Simulateur de pilotage · manœuvre</div>
                <div class="text-xl font-black text-white">${k.icon} ${k.name}</div>
                <div class="text-xs text-slate-300">${mchEsc(k.rule)}</div>
            </div>
            <div id="rfx-zone" class="space-y-2">
                <button id="rfx-ready" class="w-full py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider cursor-pointer">Prêt au décollage — démarrer</button>
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
        return ctx.rd.k === 'signal' ? 'Moteurs noyés ou temps écoulé : manœuvre ratée.' : 'Manœuvre non terminée à temps.';
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
                <span class="font-bold ${r.n === me ? 'text-indigo-300' : 'text-slate-200'}">${mchEsc(r.n)}${r.fastest ? ' <span class="text-emerald-300">🏅 meilleur pilote</span>' : ''}</span>
                <span class="font-mono ${r.ms > 0 ? 'text-yellow-300 font-bold text-sm' : 'text-slate-500 italic'}">${r.ms > 0 ? rfxTime(r.ms) : 'raté'}</span></div>`).join('');
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center">
                <div class="text-[11px] uppercase tracking-widest text-yellow-300">Manœuvre</div>
                <div class="text-xl font-black text-white">${k.icon} ${k.name}</div>
            </div>
            <div class="space-y-1.5">${rows}</div>`;
    }
};
