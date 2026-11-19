// =====================================================================
//  MODE « TRANSMISSION VISUELLE » : un membre d'équipage dessine un mot,
//  les autres décodent la transmission en direct.
//
//  Tour de jeu :
//    CHOIX  (12 s) : le dessinateur choisit une fréquence parmi 3 mots (facile ×1, moyen ×1,25, difficile ×1,5)
//    DESSIN (réglable) : il dessine, les autres proposent des mots ; des lettres se dévoilent avec le temps
//    REVELE (7 s) : le mot est révélé, les points sont attribués
//  Points : décoder vite rapporte plus (+ bonus aux trois premiers) ; le dessinateur gagne pour chaque décodeur.
//
//  Données Firebase :
//    salons/<code>/dvGame          état de la partie (écrit par l'hôte ; le dessinateur écrit son choix de mot)
//    salons/<code>__dessin         traits du dessin en direct (hors du salon pour ne pas le réafficher ;
//                                  repli sur salons/<code>/dvTraits si les règles Firebase le refusent)
// =====================================================================

const DV = { W: 1000, H: 750, CHOIX: 12, REVELE: 7, VOTE: 25, TREVELE: 9, MULT: [1, 1.25, 1.5], NIV: ['FACILE', 'MOYEN', 'DIFFICILE'] };
const DV_COULEURS = ['#ffffff', '#94a3b8', '#1e293b', '#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#a16207'];
const DV_TAILLES = [4, 10, 20, 40];
const DV_REACTIONS = ['😂', '😮', '👏', '🔥', '🤔', '💀'];

const dvC = { sess: 0, g: null, data: null, vu: {}, traits: {}, local: {}, chemin: '', ecoute: null, tr: '', cv: null, cx: null, sale: true,
    outil: { c: '#ffffff', w: 10, e: 0, f: 0 }, envoye: {}, seq: 0, cur: null, flush: 0, chatVu: {}, trouveVu: {}, reacVu: {}, tic: 0, fini: '', galerieEcrite: {}, ticker: null, raf: 0 };
const dvH = { lock: '', utilises: new Set() };

function dvMe() { return window.myPlayerKey || (window.state && state.username); }
function dvSalon() { return window.currentCodeSalon || (window.state && state.roomCode); }
function dvEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dvNorm(s) { let k = String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ''); return k; }
function dvSing(k) { return k.length > 3 && /[sx]$/.test(k) ? k.slice(0, -1) : k; }
function dvLev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = []; for (let j = 0; j <= n; j++) p[j] = j;
    for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
function dvBon(essai, mot) { const a = dvSing(dvNorm(essai)), b = dvSing(dvNorm(mot)); return !!a && a === b; }
function dvProche(essai, mot) { const a = dvNorm(essai), b = dvNorm(mot); if (a.length < 3 || b.length < 4) return false; return dvLev(a, b) <= (b.length >= 9 ? 2 : 1); }
function dvMelange(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function dvHumains(data) { return Object.values((data && data.players) || {}).filter(p => p && p.name && !p.isBot); }
function dvPresent(data, n) { return dvHumains(data).some(p => p.name === n); }
function dvAvatar(n) { const p = dvHumains(window.currentRoom || dvC.data).find(x => x.name === n); return p && p.avatar && p.avatar.src ? p.avatar.src : null; }
function dvPastille(n, s) {
    const src = dvAvatar(n); s = s || 26;
    return src ? `<img src="${dvEsc(src)}" alt="" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;flex-shrink:0">`
        : `<span style="width:${s}px;height:${s}px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:#1e293b;color:#e2e8f0;font-weight:800;font-size:${Math.round(s * .45)}px">${dvEsc(String(n).charAt(0).toUpperCase())}</span>`;
}
function dvJeton(g) { return (g.startedAt || 0) + '_' + (g.tour || 0); }
function dvDessinateur(g) { const o = g.ordre || []; return o.length ? o[(g.tour || 0) % o.length] : ''; }
// heure locale à laquelle ce joueur a vu commencer la phase (évite les décalages d'horloge entre appareils)
function dvDebutPhase(g) { const k = dvJeton(g) + ':' + g.phase; if (!dvC.vu[k]) dvC.vu[k] = Date.now(); return dvC.vu[k]; }
function dvEcoule(g) { return (Date.now() - dvDebutPhase(g)) / 1000; }
function dvEcrire(upd) { const c = dvSalon(); if (!c || !window.update) return Promise.resolve(); return window.update(window.ref(window.db, 'salons/' + c), upd).catch(e => console.error('Transmission visuelle :', e)); }

// ------------------------------- Sons -------------------------------
function dvSon(nom) {
    if (typeof sysSon !== 'undefined' && !sysSon.on) return;
    if (typeof sysCtx !== 'function' || typeof sysNote !== 'function') { if (typeof window.sfx === 'function') window.sfx(nom === 'fin' ? 'victoire' : 'clic'); return; }
    try {
        const c = sysCtx(); if (!c) return;
        if (nom === 'debut') { sysNote(c, 220, 0, .35, 'sawtooth', .07, 880); sysBruit(c, .05, .45, 900, .18, 3600); sysNote(c, 1320, .32, .25, 'sine', .1); }
        else if (nom === 'choix') { [660, 880, 1320].forEach((f, i) => sysNote(c, f, i * .05, .12, 'triangle', .1)); }
        else if (nom === 'trouve') { [784, 988, 1175].forEach((f, i) => sysNote(c, f, i * .07, .18, 'triangle', .12)); }
        else if (nom === 'moi') { [523, 659, 784, 1047, 1319].forEach((f, i) => sysNote(c, f, i * .07, .3, 'triangle', .15)); sysBruit(c, .3, .4, 3000, .1, 8000); }
        else if (nom === 'presque') { sysNote(c, 880, 0, .08, 'square', .06); sysNote(c, 830, .09, .14, 'square', .06); }
        else if (nom === 'msg') sysNote(c, 1500, 0, .04, 'sine', .05);
        else if (nom === 'tic') sysNote(c, 1800, 0, .03, 'square', .05);
        else if (nom === 'revele') { sysBruit(c, 0, .5, 600, .25, 5000); [392, 523, 659, 784].forEach((f, i) => sysNote(c, f, .2 + i * .06, .5, 'triangle', .12)); }
        else if (nom === 'perdu') { sysBruit(c, 0, .7, 2400, .25, 200); sysNote(c, 440, 0, .5, 'sawtooth', .08, 110); }
        else if (nom === 'pop') sysNote(c, 500, 0, .08, 'sine', .12, 1300);
        else if (nom === 'fin' && typeof window.sfx === 'function') window.sfx('victoire');
    } catch (e) {}
}

// ------------------------------- Habillage -------------------------------
function dvStyle() {
    if (document.getElementById('dv-style')) return;
    const st = document.createElement('style'); st.id = 'dv-style';
    st.textContent = `
    #dv-root{width:100%;display:grid;gap:10px;grid-template-columns:1fr;color:#e2e8f0}
    @media (min-width:900px){#dv-root{grid-template-columns:minmax(0,1fr) 290px}#dv-cote{grid-row:1 / span 2;grid-column:2}}
    .dv-barre{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;border-radius:14px;border:1px solid rgba(34,211,238,.3);background:linear-gradient(90deg,rgba(8,47,73,.7),rgba(15,23,42,.85))}
    .dv-mot{flex:1;min-width:180px;text-align:center;font-family:ui-monospace,monospace;font-weight:900;font-size:clamp(16px,3.6vw,24px);letter-spacing:.12em;color:#fff}
    .dv-mot .l{display:inline-block;min-width:.85em;margin:0 1px;border-bottom:2px solid rgba(103,232,249,.7);text-align:center}
    .dv-mot .l.v{color:#fde68a;border-color:#fbbf24;animation:dvRetourne .5s ease}
    .dv-mot .sp{display:inline-block;width:.7em}
    @keyframes dvRetourne{0%{transform:rotateX(90deg)}100%{transform:none}}
    .dv-signal{position:relative;height:8px;border-radius:999px;background:#0f172a;overflow:hidden;border:1px solid #1e293b}
    .dv-signal i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#22d3ee,#a78bfa);box-shadow:0 0 10px #22d3ee;transition:width .25s linear}
    .dv-ecran{position:relative;width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;border:1px solid rgba(34,211,238,.35);
        background:radial-gradient(ellipse at 50% 40%,#0f2338 0%,#081424 60%,#050b16 100%);box-shadow:0 0 30px rgba(34,211,238,.12) inset,0 0 24px rgba(0,0,0,.5)}
    .dv-ecran::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.25;
        background-image:linear-gradient(rgba(34,211,238,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.18) 1px,transparent 1px);background-size:5% 6.667%}
    .dv-ecran::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
    .dv-ecran canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;z-index:1}
    .dv-ecran.dessine canvas{cursor:crosshair}
    .dv-coin{position:absolute;z-index:2;font:800 9px ui-monospace,monospace;letter-spacing:.2em;color:rgba(103,232,249,.75);pointer-events:none}
    .dv-voile{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;text-align:center;background:rgba(3,8,20,.86);backdrop-filter:blur(3px)}
    .dv-freq{cursor:pointer;width:min(240px,80%);padding:12px 14px;border-radius:14px;border:1px solid rgba(103,232,249,.4);background:rgba(8,47,73,.6);color:#fff;transition:transform .12s,box-shadow .2s;
        animation:dvIn .45s cubic-bezier(.2,.8,.2,1) both}
    .dv-freqs{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
    @media (max-width:600px){.dv-freqs{flex-direction:row;align-items:stretch;justify-content:center;gap:6px}.dv-freq{width:31%;padding:8px 5px}.dv-freq b{font-size:13px;line-height:1.15;overflow-wrap:anywhere}.dv-freq small{font-size:7px;letter-spacing:.1em}.dv-aide{display:none}.dv-voile{gap:8px;padding:10px}.dv-glitch{font-size:12px}}
    .dv-freq:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 0 22px rgba(34,211,238,.45)}
    .dv-freq b{display:block;font-size:20px;font-weight:900}
    .dv-freq small{font:800 9px ui-monospace,monospace;letter-spacing:.2em}
    @keyframes dvIn{from{opacity:0;transform:translateY(16px) scale(.95)}to{opacity:1;transform:none}}
    .dv-radar{width:110px;height:110px;border-radius:50%;border:2px solid rgba(34,211,238,.5);position:relative;background:radial-gradient(circle,rgba(34,211,238,.15),transparent 70%)}
    .dv-radar::before{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(34,211,238,.55),transparent 25%);animation:dvTourne 1.6s linear infinite}
    .dv-radar::after{content:'';position:absolute;inset:30%;border-radius:50%;border:1px solid rgba(34,211,238,.4)}
    @keyframes dvTourne{to{transform:rotate(360deg)}}
    .dv-glitch{font-weight:900;letter-spacing:.24em;font-size:clamp(14px,3vw,20px);color:#67e8f9;text-shadow:2px 0 #f0abfc,-2px 0 #22d3ee;animation:dvGlitch .6s steps(2) 3}
    @keyframes dvGlitch{0%{transform:translate(0)}25%{transform:translate(-3px,1px)}50%{transform:translate(3px,-1px);opacity:.7}75%{transform:translate(-1px,2px)}100%{transform:none}}
    .dv-grosmot{font-weight:900;font-size:clamp(28px,7vw,54px);color:#fff;text-shadow:0 0 26px rgba(250,204,21,.6)}
    .dv-grosmot span{display:inline-block;animation:dvLettre .5s cubic-bezier(.2,.8,.2,1) both}
    @keyframes dvLettre{from{opacity:0;transform:translateY(-30px) scale(1.6)}to{opacity:1;transform:none}}
    .dv-outils{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;padding:8px;border-radius:14px;border:1px solid rgba(34,211,238,.25);background:rgba(15,23,42,.8)}
    .dv-pastel{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,.15);transition:transform .1s}
    .dv-pastel.on{transform:scale(1.18);border-color:#fff;box-shadow:0 0 12px currentColor}
    .dv-tool{cursor:pointer;min-width:36px;height:36px;padding:0 9px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#0b1220;color:#e2e8f0;font-weight:800;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:4px}
    .dv-tool.on{border-color:#67e8f9;box-shadow:0 0 12px rgba(34,211,238,.5);color:#fff}
    .dv-tool .pt{display:inline-block;border-radius:50%;background:#e2e8f0}
    #dv-cote{display:flex;flex-direction:column;gap:8px;min-width:0}
    .dv-panneau{border-radius:14px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.8);padding:8px}
    .dv-titre{font:800 9px ui-monospace,monospace;letter-spacing:.2em;color:#67e8f9;margin-bottom:6px}
    .dv-joueur{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:9px;font-size:12px;transition:background .3s}
    .dv-joueur.ok{background:rgba(16,185,129,.18);box-shadow:0 0 0 1px rgba(52,211,153,.45) inset}
    .dv-joueur.dess{background:rgba(139,92,246,.2)}
    #dv-chat{height:190px;overflow-y:auto;font-size:12px;display:flex;flex-direction:column;gap:3px}
    @media (min-width:900px){#dv-chat{height:300px}}
    #dv-chat .m{animation:dvIn .25s ease both;word-break:break-word}
    #dv-chat .m.ok{color:#6ee7b7;font-weight:800}
    #dv-chat .m.f{color:#a7f3d0;opacity:.85}
    #dv-chat .m.p{color:#fde68a;font-weight:700}
    #dv-chat .m.sys{color:#94a3b8;font-style:italic}
    .dv-saisie{display:flex;gap:6px}
    .dv-saisie input{flex:1;min-width:0;background:#020617;border:1px solid rgba(34,211,238,.45);border-radius:10px;padding:9px 10px;color:#fff;font-size:14px;outline:none}
    .dv-saisie input:focus{border-color:#67e8f9;box-shadow:0 0 12px rgba(34,211,238,.35)}
    .dv-saisie button{border-radius:10px;padding:0 14px;font-weight:900;color:#fff;background:linear-gradient(90deg,#0891b2,#7c3aed);border:0;cursor:pointer}
    .dv-toast{position:absolute;left:50%;top:12px;z-index:5;transform:translateX(-50%);padding:7px 14px;border-radius:999px;font-weight:900;font-size:13px;white-space:nowrap;
        background:rgba(6,78,59,.92);border:1px solid #34d399;color:#d1fae5;box-shadow:0 0 18px rgba(52,211,153,.5);animation:dvToast 2.4s ease forwards}
    @keyframes dvToast{0%{opacity:0;transform:translate(-50%,-14px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-8px)}}
    .dv-reac{position:absolute;bottom:8px;z-index:3;font-size:30px;pointer-events:none;animation:dvMonte 2.4s ease-out forwards;text-align:center}
    .dv-reac i{display:block;font-style:normal;font:800 9px ui-monospace,monospace;color:#e0f2fe;text-shadow:0 0 4px #000}
    @keyframes dvMonte{0%{opacity:0;transform:translateY(0) scale(.6)}12%{opacity:1;transform:translateY(-16px) scale(1.15)}100%{opacity:0;transform:translateY(-220px)}}
    .dv-reacs{display:flex;gap:4px;justify-content:center;flex-wrap:wrap}
    .dv-reacs button{width:36px;height:36px;border-radius:10px;border:1px solid rgba(148,163,184,.25);background:#0b1220;font-size:18px;cursor:pointer}
    .dv-reacs button:active{transform:scale(.9)}
    .dv-galerie{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    .dv-galerie figure{margin:0;border-radius:12px;overflow:hidden;border:1px solid rgba(34,211,238,.3);background:#081424;animation:dvIn .5s ease both}
    .dv-galerie img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover}
    .dv-galerie figcaption{padding:5px 7px;font-size:11px;text-align:left}
    `;
    document.head.appendChild(st);
}

// ------------------------------- Lancement (hôte) -------------------------------
// mots de l'hôte : un par ligne ; leur niveau dépend de leur longueur
function dvLirePerso() {
    let txt = ''; const el = document.getElementById('setting-dessin-perso');
    if (el) txt = el.value; else { try { txt = localStorage.getItem('lmlp-dv-perso') || ''; } catch (e) {} }
    return [...new Set(String(txt).split(/\r?\n|,/).map(x => x.trim()).filter(x => x && x.length <= 40))];
}
function dvSeulementPerso() { const el = document.getElementById('setting-dessin-seul'); if (el) return !!el.checked; try { return localStorage.getItem('lmlp-dv-seul') === '1'; } catch (e) { return false; } }
window.dvMajPerso = function() {
    const el = document.getElementById('setting-dessin-perso'), seul = document.getElementById('setting-dessin-seul');
    try { if (el) localStorage.setItem('lmlp-dv-perso', el.value); if (seul) localStorage.setItem('lmlp-dv-seul', seul.checked ? '1' : '0'); } catch (e) {}
    const c = document.getElementById('setting-dessin-compte'); if (c) { const n = dvLirePerso().length; c.textContent = n ? `${n} mot${n > 1 ? 's' : ''} personnalisé${n > 1 ? 's' : ''}` : ''; }
};
window.dvChargerPerso = function() {
    const el = document.getElementById('setting-dessin-perso'), seul = document.getElementById('setting-dessin-seul');
    try { if (el && !el.value) el.value = localStorage.getItem('lmlp-dv-perso') || ''; if (seul) seul.checked = localStorage.getItem('lmlp-dv-seul') === '1'; } catch (e) {}
    window.dvMajPerso();
};
const dvNivPerso = m => m.length <= 6 ? 0 : m.length <= 10 ? 1 : 2;
function dvTirerChoix(theme, perso, seul) {
    const themes = theme && window.DV_MOTS && window.DV_MOTS[theme] ? [theme] : Object.keys(window.DV_MOTS || {});
    perso = perso || []; if (seul && !perso.length) seul = false;
    let recents = []; try { recents = JSON.parse(localStorage.getItem('lmlp-dv-recents') || '[]'); } catch (e) {}
    const pris = new Set();
    return [0, 1, 2].map(niv => {
        let pool = [];
        const mesMots = perso.filter(m => dvNivPerso(m) === niv && !pris.has(m));
        if (seul) pool = mesMots.length ? mesMots : perso.filter(m => !pris.has(m));
        else if (mesMots.length && Math.random() < .5) pool = mesMots;
        else themes.forEach(t => (window.DV_MOTS[t][niv] || []).forEach(m => pool.push(m)));
        if (!pool.length) pool = perso.length ? perso.slice() : ['fusée'];
        let libres = pool.filter(m => !dvH.utilises.has(m) && recents.indexOf(m) < 0);
        if (!libres.length) libres = pool.filter(m => !dvH.utilises.has(m));
        if (!libres.length) libres = pool;
        const m = libres[Math.floor(Math.random() * libres.length)]; dvH.utilises.add(m); pris.add(m);
        return { m: m, n: niv };
    });
}
function dvMemoriserMot(m) { try { const r = JSON.parse(localStorage.getItem('lmlp-dv-recents') || '[]').filter(x => x !== m); r.push(m); localStorage.setItem('lmlp-dv-recents', JSON.stringify(r.slice(-200))); } catch (e) {} }

window.startDessinGame = function() {
    if (!window.isHost) return;
    const code = dvSalon(); if (!code || !window.mettreAJourSalonFirebase) return;
    const players = (window.state && state.players) || {};
    const noms = Object.values(players).filter(p => p && p.name && !p.isBot).map(p => p.name);
    if (noms.length < 2) { if (typeof showToast === 'function') showToast('⚠️ Il faut au moins 2 joueurs pour Transmission visuelle !'); return; }
    const tpj = Math.max(1, Math.min(3, parseInt(document.getElementById('setting-dessin-tours')?.value, 10) || 2));
    const theme = document.getElementById('setting-dessin-theme')?.value || 'mixte';
    const duree = Math.max(40, Math.min(150, parseInt(document.getElementById('input-host-timer')?.value, 10) || 80));
    const mode = document.getElementById('setting-dessin-mode')?.value === 'tele' ? 'tele' : 'classique';
    const perso = dvLirePerso(), seul = dvSeulementPerso() && perso.length > 0;
    dvH.utilises = new Set();
    const go = pos => {
        const now = Date.now(), ordre = dvMelange(noms);
        const g = { v: 1, status: 'PLAYING', startedAt: now, ordre: ordre, tpj: tpj, total: ordre.length * tpj, theme: theme, duree: duree, pos: pos,
            tour: 0, phase: 'CHOIX', d: ordre[0], choix: dvTirerChoix(theme, perso, seul), perso: perso.length ? perso : null, seul: seul ? 1 : 0, mode: mode };
        if (mode === 'tele') {      // Télé-dessin : tout le monde dessine le même mot, puis vote
            const c = g.choix; Object.assign(g, { total: tpj * 2 + 1, phase: 'T_DESSIN', d: '', mot: c[Math.floor(Math.random() * 3)].m, niv: null, choix: null });
        }
        const updates = { status: 'IN_GAME', selectedMode: 'dessin', dvGame: g, dvTraits: null };
        Object.values(players).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
        window.set(window.ref(window.db, dvCheminTraits(code, pos)), { tr: dvJeton(g) }).catch(() => {});
        window.mettreAJourSalonFirebase(code, updates);
    };
    window.set(window.ref(window.db, 'salons/' + code + '__dessin'), { t: Date.now() }).then(() => go('ext')).catch(() => go('int'));
};
function dvCheminTraits(code, pos) { return pos === 'ext' ? 'salons/' + code + '__dessin' : 'salons/' + code + '/dvTraits'; }

// ------------------------------- Hôte : enchaînement -------------------------------
function dvHote() {
    const data = window.currentRoom || dvC.data, g = data && data.dvGame;
    if (!window.isHost || !g || g.status !== 'PLAYING' || data.status !== 'IN_GAME' || data.selectedMode !== 'dessin') return;
    const d = dvDessinateur(g), t = dvEcoule(g), cle = dvJeton(g) + ':' + g.phase;
    if (g.mode === 'tele') { dvHoteTele(data, g, t, cle); return; }
    if (g.phase === 'CHOIX') {
        if (!dvPresent(data, d)) { if (t > 1.5) dvAvancer(g, cle + ':absent'); return; }
        if (t > DV.CHOIX + 1.5 && dvH.lock !== cle) {          // le dessinateur n'a pas choisi : mot moyen
            dvH.lock = cle; const c = (g.choix || [])[1] || (g.choix || [])[0] || { m: 'fusée', n: 0 };
            dvEcrire({ 'dvGame/mot': c.m, 'dvGame/niv': c.n, 'dvGame/phase': 'DESSIN' });
        }
    } else if (g.phase === 'DESSIN') {
        const devins = dvHumains(data).map(p => p.name).filter(n => n !== d);
        const tr = g.trouves || {};
        const tous = devins.length > 0 && devins.every(n => tr[n]);
        if (tous || t > (g.duree || 80) + 1 || (!dvPresent(data, d) && t > 3)) dvTerminer(data, g, cle);
    } else if (g.phase === 'REVELE') {
        if (t > DV.REVELE) dvAvancer(g, cle);
    }
}
// ---- Télé-dessin : T_DESSIN (tous dessinent) → T_VOTE → T_REVELE ----
function dvTeleImages(g) { return (g.td && g.td['r' + (g.tour || 0)]) || {}; }
function dvTeleVotes(g) { return (g.tv && g.tv['r' + (g.tour || 0)]) || {}; }
function dvHoteTele(data, g, t, cle) {
    const presents = dvHumains(data).map(p => p.name);
    if (g.phase === 'T_DESSIN') {
        const im = dvTeleImages(g);
        if ((presents.length && presents.every(n => im[n])) || t > (g.duree || 80) + 2) {
            if (dvH.lock === cle) return; dvH.lock = cle; dvEcrire({ 'dvGame/phase': 'T_VOTE' }).catch(() => { dvH.lock = ''; });
        }
    } else if (g.phase === 'T_VOTE') {
        const im = dvTeleImages(g), v = dvTeleVotes(g), auteurs = Object.keys(im);
        const votants = presents.filter(n => auteurs.some(a => a !== n));
        if ((votants.length && votants.every(n => v[n])) || t > DV.VOTE + 2 || auteurs.length < 2 && t > 4) {
            if (dvH.lock === cle) return; dvH.lock = cle;
            const voix = {}; Object.keys(v).forEach(n => { if (im[v[n]] && v[n] !== n) voix[v[n]] = (voix[v[n]] || 0) + 1; });
            const max = Math.max(0, ...Object.values(voix)), gagnants = Object.keys(voix).filter(a => voix[a] === max && max > 0);
            const pts = {};
            Object.keys(voix).forEach(a => { pts[a] = (pts[a] || 0) + voix[a] * 100 + (gagnants.indexOf(a) >= 0 ? 50 : 0); });
            Object.keys(v).forEach(n => { if (gagnants.indexOf(v[n]) >= 0 && v[n] !== n) pts[n] = (pts[n] || 0) + 25; });
            const upd = { 'dvGame/phase': 'T_REVELE', 'dvGame/pts': pts, 'dvGame/voix': voix };
            dvHumains(data).forEach(p => { if (pts[p.name]) upd[`players/${p.name}/score`] = (p.score || 0) + pts[p.name]; });
            const g0 = gagnants[0] || auteurs[0];
            if (g0 && im[g0]) upd[`dvGame/galerie/t${g.tour || 0}`] = { d: g0, m: g.mot || '', img: im[g0].img, v: voix[g0] || 0 };
            if (g.mot) dvMemoriserMot(g.mot);
            dvEcrire(upd).catch(() => { dvH.lock = ''; });
        }
    } else if (g.phase === 'T_REVELE') {
        if (t > DV.TREVELE) {
            if (dvH.lock === cle) return; dvH.lock = cle;
            const t2 = (g.tour || 0) + 1;
            if (t2 >= (g.total || 3)) { dvEcrire({ 'dvGame/status': 'FINISHED', 'dvGame/phase': 'FIN', 'dvGame/td': null }); return; }
            const c = dvTirerChoix(g.theme, g.perso, g.seul);
            dvEcrire({ 'dvGame/tour': t2, 'dvGame/phase': 'T_DESSIN', 'dvGame/mot': c[Math.floor(Math.random() * 3)].m, 'dvGame/td': null, 'dvGame/tv': null,
                'dvGame/pts': null, 'dvGame/voix': null, 'dvGame/chat': null, 'dvGame/react': null }).catch(() => { dvH.lock = ''; });
        }
    }
}
function dvTerminer(data, g, cle) {
    if (dvH.lock === cle) return; dvH.lock = cle;
    const d = dvDessinateur(g), duree = g.duree || 80, mult = DV.MULT[g.niv || 0] || 1;
    const tr = g.trouves || {}, trouveurs = Object.keys(tr).filter(n => n !== d).sort((a, b) => (+tr[a].e || 0) - (+tr[b].e || 0));
    const pts = {}, bonus = [60, 30, 15];
    trouveurs.forEach((n, k) => {
        const reste = Math.max(0, duree - (+tr[n].e || 0)) / duree;
        pts[n] = Math.round((80 + 220 * reste + (bonus[k] || 0)) * mult / 5) * 5;
    });
    const devins = dvHumains(data).map(p => p.name).filter(n => n !== d);
    const dp = trouveurs.length ? Math.round((40 * trouveurs.length + (devins.length && trouveurs.length >= devins.length ? 60 : 0)) * mult / 5) * 5 : 0;
    if (dp && dvPresent(data, d)) pts[d] = dp;
    const upd = { 'dvGame/phase': 'REVELE', 'dvGame/pts': pts };
    dvHumains(data).forEach(p => { if (pts[p.name]) upd[`players/${p.name}/score`] = (p.score || 0) + pts[p.name]; });
    if (g.mot) dvMemoriserMot(g.mot);
    dvEcrire(upd).catch(() => { dvH.lock = ''; });
}
function dvAvancer(g, cle) {
    if (dvH.lock === cle) return; dvH.lock = cle;
    const data = window.currentRoom || dvC.data;
    let t = (g.tour || 0) + 1;
    while (t < (g.total || 0) && !dvPresent(data, (g.ordre || [])[t % (g.ordre || [1]).length])) t++;
    if (t >= (g.total || 0)) { dvEcrire({ 'dvGame/status': 'FINISHED', 'dvGame/phase': 'FIN' }); return; }
    const ng = Object.assign({}, g, { tour: t });
    const upd = { 'dvGame/tour': t, 'dvGame/phase': 'CHOIX', 'dvGame/d': dvDessinateur(ng), 'dvGame/choix': dvTirerChoix(g.theme, g.perso, g.seul),
        'dvGame/mot': null, 'dvGame/niv': null, 'dvGame/trouves': null, 'dvGame/chat': null, 'dvGame/react': null, 'dvGame/pts': null };
    window.set(window.ref(window.db, dvCheminTraits(dvSalon(), g.pos)), { tr: dvJeton(ng) }).catch(() => {});
    dvEcrire(upd).catch(() => { dvH.lock = ''; });
}

// ------------------------------- Rendu (chaque mise à jour du salon) -------------------------------
window.renderDessinScreen = function(data) {
    const g = data && data.dvGame; if (!g) return;
    dvStyle();
    dvC.data = data; dvC.g = g;
    if (g.status === 'FINISHED') { dvFin(data, g); return; }
    if (dvC.sess !== g.startedAt || !document.getElementById('dv-root')) dvConstruire(g);
    dvEcouterTraits(g);
    dvMaj(data, g);
    if (!dvC.ticker) dvC.ticker = setInterval(dvBoucle, 250);
};

function dvConstruire(g) {
    dvC.sess = g.startedAt; dvC.fini = ''; dvC.chatVu = {}; dvC.trouveVu = {}; dvC.reacVu = {}; dvC.galerieEcrite = {};
    if (typeof showScreen === 'function') showScreen('screen-generic-game');
    const t = document.getElementById('generic-game-title'); if (t) t.innerText = '🎨 Transmission visuelle';
    const zone = document.getElementById('generic-game-content'); if (!zone) return;
    zone.innerHTML = `
    <div id="dv-root">
      <div id="dv-gauche" style="display:flex;flex-direction:column;gap:8px;min-width:0">
        <div class="dv-barre">
            <div id="dv-qui" style="display:flex;align-items:center;gap:7px;font-size:12px;min-width:0"></div>
            <div id="dv-mot" class="dv-mot"></div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
                <span id="dv-tour" style="font:800 9px ui-monospace,monospace;letter-spacing:.18em;color:#94a3b8"></span>
                <span id="dv-temps" style="font:900 18px ui-monospace,monospace;color:#fbbf24">--</span></div>
        </div>
        <div class="dv-signal"><i id="dv-signal" style="width:100%"></i></div>
        <div id="dv-ecran" class="dv-ecran">
            <canvas id="dv-canvas" width="${DV.W}" height="${DV.H}"></canvas>
            <span class="dv-coin" style="left:10px;top:8px">● RÉCEPTION</span><span class="dv-coin" id="dv-coin" style="right:10px;bottom:8px"></span>
            <div id="dv-voile"></div><div id="dv-toasts"></div><div id="dv-reacs-zone"></div>
        </div>
        <div id="dv-outils"></div>
      </div>
      <div id="dv-cote">
        <div class="dv-panneau" style="display:flex;flex-direction:column;gap:6px">
            <div class="dv-saisie"><input id="dv-essai" maxlength="40" autocomplete="off" placeholder="Votre proposition…"><button id="dv-envoyer">➤</button></div>
            <div class="dv-reacs">${DV_REACTIONS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>
            <div class="dv-titre" style="margin:4px 0 0">CANAL DE DÉCODAGE</div>
            <div id="dv-chat"></div>
        </div>
        <div class="dv-panneau"><div class="dv-titre">ÉQUIPAGE</div><div id="dv-joueurs" style="display:flex;flex-direction:column;gap:2px"></div></div>
      </div>
    </div>`;
    dvC.cv = document.getElementById('dv-canvas'); dvC.cx = dvC.cv.getContext('2d'); dvC.sale = true;
    dvBrancherDessin();
    const inp = document.getElementById('dv-essai');
    document.getElementById('dv-envoyer').onclick = () => dvProposer();
    inp.onkeydown = e => { if (e.key === 'Enter') dvProposer(); };
    document.querySelectorAll('.dv-reacs button').forEach(b => b.onclick = () => dvReagir(b.dataset.e));
    if (!dvC.raf) { const boucle = () => { dvC.raf = requestAnimationFrame(boucle); if (dvC.sale) dvRedessiner(); }; dvC.raf = requestAnimationFrame(boucle); }
}

function dvEcouterTraits(g) {
    const chemin = dvCheminTraits(dvSalon(), g.pos);
    if (dvC.chemin === chemin && dvC.ecoute) return;
    if (dvC.ecoute) { try { dvC.ecoute(); } catch (e) {} }
    dvC.chemin = chemin;
    dvC.ecoute = window.onValue(window.ref(window.db, chemin), snap => {
        const v = snap.val() || {};
        dvC.tr = v.tr || ''; dvC.traits = v.s || {};
        dvC.sale = true;
    });
}

// ------------------------------- Mise à jour de l'interface -------------------------------
function dvMaj(data, g) {
    if (g.mode === 'tele') { dvMajTele(data, g); return; }
    const me = dvMe(), d = dvDessinateur(g), moiDess = me === d, jeton = dvJeton(g);
    dvDebutPhase(g);
    if (dvC.jeton !== jeton) {                     // nouveau tour
        dvC.jeton = jeton; dvC.local = {}; dvC.cur = null; dvC.sale = true;
        const ch = document.getElementById('dv-chat'); if (ch) ch.innerHTML = '';
        dvSysMsg(`📡 Tour ${(g.tour || 0) + 1} : ${d === me ? 'à vous de dessiner !' : dvEsc(d) + ' prend le crayon.'}`);
    }
    if (dvC.phaseVue !== jeton + g.phase) {
        dvC.phaseVue = jeton + g.phase;
        if (g.phase === 'DESSIN') dvSon('debut');
        if (g.phase === 'REVELE') { dvSon(Object.keys(g.pts || {}).filter(n => n !== d).length ? 'revele' : 'perdu'); if (moiDess) dvEcrireGalerie(g); }
        if (g.phase === 'CHOIX' && moiDess) dvSon('choix');
    }
    // en-tête
    const qui = document.getElementById('dv-qui');
    if (qui) qui.innerHTML = `${dvPastille(d, 28)}<div style="min-width:0"><div style="font:800 9px ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa">ÉMETTEUR</div><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:120px">${dvEsc(d)}${moiDess ? ' (toi)' : ''}</b></div>`;
    const tour = document.getElementById('dv-tour'); if (tour) tour.textContent = `TOUR ${(g.tour || 0) + 1}/${g.total || 1}`;
    const coin = document.getElementById('dv-coin'); if (coin) coin.textContent = g.phase === 'DESSIN' && g.niv != null ? `FRÉQUENCE ${DV.NIV[g.niv]} ×${String(DV.MULT[g.niv]).replace('.', ',')}` : '';
    const ecran = document.getElementById('dv-ecran'); if (ecran) ecran.classList.toggle('dessine', moiDess && g.phase === 'DESSIN');
    dvMajMot(g, moiDess);
    dvMajVoile(data, g, moiDess);
    dvMajOutils(g, moiDess && g.phase === 'DESSIN');
    dvMajJoueurs(data, g);
    dvMajChat(g, me, d);
    dvMajReactions(g);
    const inp = document.getElementById('dv-essai'), btn = document.getElementById('dv-envoyer');
    if (inp) {
        const trouve = !!(g.trouves && g.trouves[me]);
        const actif = !moiDess && g.phase === 'DESSIN';
        inp.disabled = !actif; if (btn) btn.disabled = !actif;
        inp.placeholder = moiDess ? 'Vous êtes l’émetteur : dessinez !' : g.phase !== 'DESSIN' ? 'En attente de la transmission…' : trouve ? 'Décodé ✓ — discutez avec les décodeurs' : 'Votre proposition…';
    }
}

// ===================== Télé-dessin (côté joueur) =====================
function dvMajTele(data, g) {
    const me = dvMe(), jeton = dvJeton(g), im = dvTeleImages(g), votes = dvTeleVotes(g);
    dvDebutPhase(g);
    if (dvC.jeton !== jeton) {
        dvC.jeton = jeton; dvC.local = {}; dvC.cur = null; dvC.sale = true; dvC.cacheSig = '';
        const ch = document.getElementById('dv-chat'); if (ch) ch.innerHTML = '';
        dvSysMsg(`📺 Manche ${(g.tour || 0) + 1} : tout le monde dessine <b>${dvEsc(String(g.mot || '').toUpperCase())}</b> !`);
    }
    if (dvC.phaseVue !== jeton + g.phase) {
        dvC.phaseVue = jeton + g.phase;
        if (g.phase === 'T_DESSIN') dvSon('debut');
        if (g.phase === 'T_VOTE') { dvEnvoyerDessinTele(g); dvSon('choix'); }
        if (g.phase === 'T_REVELE') dvSon('revele');
    }
    const qui = document.getElementById('dv-qui');
    if (qui) qui.innerHTML = `<span style="font-size:22px">📺</span><div style="min-width:0"><div style="font:800 9px ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa">TÉLÉ-DESSIN</div><b style="font-size:12px">${g.phase === 'T_DESSIN' ? 'Tout le monde dessine' : g.phase === 'T_VOTE' ? 'Votez pour le meilleur' : 'Résultat du vote'}</b></div>`;
    const tour = document.getElementById('dv-tour'); if (tour) tour.textContent = `MANCHE ${(g.tour || 0) + 1}/${g.total || 1}`;
    const coin = document.getElementById('dv-coin'); if (coin) coin.textContent = g.phase === 'T_DESSIN' ? (dvC.envoye[jeton] ? 'DESSIN ENVOYÉ ✓' : 'VOTRE ÉCRAN') : '';
    const mot = document.getElementById('dv-mot'); if (mot) { const h = `<span style="font-size:11px;letter-spacing:.2em;color:#94a3b8">DESSINEZ</span> <span style="color:#fde68a">${dvEsc(String(g.mot || '').toUpperCase())}</span>`; if (mot.dataset.sig !== h) { mot.dataset.sig = h; mot.innerHTML = h; } }
    const ecran = document.getElementById('dv-ecran'); if (ecran) ecran.classList.toggle('dessine', dvPeutDessiner());
    dvMajOutils(g, dvPeutDessiner());
    // voile : galerie de vote ou révélation
    const v = document.getElementById('dv-voile');
    if (v) {
        const auteurs = Object.keys(im).sort((a, b) => (dvNorm(a + g.startedAt) < dvNorm(b + g.startedAt) ? -1 : 1));
        const sig = g.phase + ':' + jeton + ':' + auteurs.join(',') + ':' + (votes[me] || '') + ':' + JSON.stringify(g.voix || {});
        if (v.dataset.cle !== sig) {
            v.dataset.cle = sig;
            if (g.phase === 'T_DESSIN') v.innerHTML = dvC.envoye[jeton] ? `<div class="dv-voile" style="background:rgba(3,8,20,.55)"><div class="dv-glitch">DESSIN TRANSMIS ✓</div><div style="font-size:13px;color:#cbd5e1">En attente des autres artistes… (${auteurs.length}/${dvHumains(data).length})</div></div>` : '';
            else {
                const voix = g.voix || {}, max = Math.max(0, ...Object.values(voix)), pts = g.pts || {};
                const cartes = auteurs.map((a, k) => {
                    const moi = a === me, vote = votes[me] === a, gagne = g.phase === 'T_REVELE' && voix[a] === max && max > 0;
                    return `<button class="dv-tvote" data-a="${dvEsc(a)}" ${g.phase !== 'T_VOTE' || moi || votes[me] ? 'disabled' : ''} style="position:relative;border-radius:10px;overflow:hidden;padding:0;cursor:${g.phase === 'T_VOTE' && !moi && !votes[me] ? 'pointer' : 'default'};
                        border:2px solid ${gagne ? '#fbbf24' : vote ? '#f0abfc' : 'rgba(103,232,249,.3)'};background:#081424;box-shadow:${gagne ? '0 0 22px rgba(251,191,36,.6)' : 'none'};animation:dvIn .4s ease both;animation-delay:${k * .06}s">
                        <img src="${dvEsc(im[a].img)}" style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover" alt="">
                        <div style="padding:3px 6px;font-size:11px;text-align:left;color:#e2e8f0;display:flex;justify-content:space-between;gap:4px">
                            <span>${g.phase === 'T_REVELE' ? (gagne ? '👑 ' : '') + dvEsc(a) : moi ? 'Votre dessin' : 'N°' + (k + 1)}</span>
                            <span style="color:#fde68a">${g.phase === 'T_REVELE' ? (voix[a] || 0) + ' ★' + (pts[a] ? ' · +' + pts[a] : '') : vote ? 'Votre vote ✓' : ''}</span></div></button>`;
                }).join('');
                v.innerHTML = `<div class="dv-voile" style="justify-content:flex-start;overflow:auto;background:rgba(3,8,20,.94)">
                    <div class="dv-glitch">${g.phase === 'T_VOTE' ? (votes[me] ? 'VOTE ENREGISTRÉ ✓' : 'VOTEZ POUR LE MEILLEUR DESSIN') : 'VERDICT DE L’ÉQUIPAGE'}</div>
                    <div style="display:grid;grid-template-columns:repeat(${auteurs.length > 2 ? 3 : 2},1fr);gap:8px;width:100%">${cartes || '<div style="color:#94a3b8">Aucun dessin reçu…</div>'}</div></div>`;
                v.querySelectorAll('.dv-tvote').forEach(b => b.onclick = () => {
                    const gg = dvC.g; if (!gg || gg.phase !== 'T_VOTE' || b.dataset.a === dvMe() || dvTeleVotes(gg)[dvMe()]) return;
                    dvSon('choix'); dvEcrire({ [`dvGame/tv/r${gg.tour || 0}/${dvMe()}`]: b.dataset.a });
                });
            }
        }
    }
    dvMajJoueurs(data, g);
    dvMajChat(g, me, '');
    dvMajReactions(g);
    const inp = document.getElementById('dv-essai'), btn = document.getElementById('dv-envoyer');
    if (inp) { inp.disabled = false; if (btn) btn.disabled = false; inp.placeholder = 'Discutez avec l’équipage…'; }
}
// envoie son dessin (image réduite) pour le vote
function dvEnvoyerDessinTele(g) {
    if (!g || g.mode !== 'tele') return;
    const jeton = dvJeton(g); if (dvC.envoye[jeton]) return; dvC.envoye[jeton] = 1;
    try {
        const c = document.createElement('canvas'); c.width = 480; c.height = 360;
        const x = c.getContext('2d'), calque = document.createElement('canvas'); calque.width = 480; calque.height = 360;
        const xc = calque.getContext('2d'); Object.keys(dvC.local).sort().forEach(k => dvTracer(xc, dvC.local[k], .48)); xc.globalCompositeOperation = 'source-over';
        x.fillStyle = '#0b1a2c'; x.fillRect(0, 0, 480, 360); x.drawImage(calque, 0, 0);
        dvEcrire({ [`dvGame/td/r${g.tour || 0}/${dvMe()}`]: { img: c.toDataURL('image/jpeg', .7) } });
    } catch (e) { console.error(e); }
    dvC.vu[jeton + ':cle'] = 0; const v = document.getElementById('dv-voile'); if (v) v.dataset.cle = '';
    dvSon('trouve'); dvMajOutils(g, false);
}

function dvIndices(g) {      // positions des lettres dévoilées
    const mot = g.mot || '', idx = [];
    for (let i = 0; i < mot.length; i++) if (/[a-zàâäéèêëîïôöùûüçœ]/i.test(mot[i])) idx.push(i);
    const frac = Math.min(1, dvEcoule(g) / (g.duree || 80));
    let n = frac >= .75 ? 2 : frac >= .5 ? 1 : 0;
    if (frac >= .75 && idx.length >= 8) n = 3;
    n = Math.min(n, Math.max(0, idx.length - 2));
    let h = 0; for (const ch of mot + dvJeton(g)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const ordre = idx.slice().sort((a, b) => ((a * 2654435761 + h) >>> 0) % 997 - ((b * 2654435761 + h) >>> 0) % 997);
    return new Set(ordre.slice(0, n));
}
function dvMajMot(g, moiDess) {
    const el = document.getElementById('dv-mot'); if (!el) return;
    let html = '';
    if (g.phase === 'CHOIX') html = `<span style="font-size:13px;letter-spacing:.2em;color:#94a3b8">RECHERCHE DE FRÉQUENCE…</span>`;
    else if (moiDess || g.phase === 'REVELE' || (g.trouves && g.trouves[dvMe()])) html = `<span style="color:${moiDess ? '#fde68a' : '#6ee7b7'}">${dvEsc(String(g.mot || '').toUpperCase())}</span>`;
    else {
        const vis = dvIndices(g), mot = g.mot || '';
        html = [...mot].map((ch, i) => ch === ' ' ? '<span class="sp"></span>' : /[-’']/.test(ch) ? `<span>${dvEsc(ch)}</span>`
            : `<span class="l ${vis.has(i) ? 'v' : ''}">${vis.has(i) ? dvEsc(ch.toUpperCase()) : '&nbsp;'}</span>`).join('')
            + `<div style="font-size:9px;letter-spacing:.2em;color:#64748b;margin-top:2px">${mot.split(/[ ]+/).map(w => w.replace(/[-’']/g, '').length).join(' · ')} LETTRES</div>`;
    }
    const sig = (g.phase || '') + '|' + html.length + '|' + html.slice(-120);
    if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.innerHTML = html; }
}
function dvMajVoile(data, g, moiDess) {
    const v = document.getElementById('dv-voile'); if (!v) return;
    const cle = dvJeton(g) + ':' + g.phase + ':' + (moiDess ? 1 : 0);
    if (v.dataset.cle === cle) return; v.dataset.cle = cle;
    const d = dvDessinateur(g);
    if (g.phase === 'CHOIX') {
        if (moiDess) {
            v.innerHTML = `<div class="dv-voile"><div class="dv-glitch">CHOISISSEZ UNE FRÉQUENCE</div>
                <div class="dv-aide" style="font-size:12px;color:#94a3b8">Plus le mot est difficile, plus il rapporte de points.</div>
                <div class="dv-freqs">${(g.choix || []).map((c, i) => `<button class="dv-freq" data-i="${i}" style="animation-delay:${.1 + i * .12}s;border-color:${['#4ade80', '#facc15', '#f43f5e'][c.n]}">
                    <small style="color:${['#4ade80', '#facc15', '#f43f5e'][c.n]}">${DV.NIV[c.n]} · ×${String(DV.MULT[c.n]).replace('.', ',')}</small><b>${dvEsc(c.m)}</b></button>`).join('')}</div></div>`;
            v.querySelectorAll('.dv-freq').forEach(b => b.onclick = () => {
                const c = (g.choix || [])[+b.dataset.i]; if (!c || (dvC.g && dvC.g.phase !== 'CHOIX')) return;
                dvSon('choix'); v.querySelectorAll('.dv-freq').forEach(x => x.disabled = true);
                dvEcrire({ 'dvGame/mot': c.m, 'dvGame/niv': c.n, 'dvGame/phase': 'DESSIN' });
            });
        } else {
            v.innerHTML = `<div class="dv-voile"><div class="dv-radar"></div><div class="dv-glitch" style="animation-iteration-count:infinite;animation-duration:2.4s">CALIBRAGE DE L’ÉMETTEUR</div>
                <div style="display:flex;align-items:center;gap:8px;font-size:14px">${dvPastille(d, 30)}<b>${dvEsc(d)}</b> choisit un mot…</div></div>`;
        }
    } else if (g.phase === 'REVELE') {
        const pts = g.pts || {}, trouveurs = Object.keys(pts).filter(n => n !== d).sort((a, b) => pts[b] - pts[a]);
        const ok = trouveurs.length > 0, mot = String(g.mot || '?').toUpperCase();
        v.innerHTML = `<div class="dv-voile" style="background:rgba(3,8,20,.8)">
            <div class="dv-glitch" style="color:${ok ? '#67e8f9' : '#fca5a5'}">${ok ? 'TRANSMISSION DÉCODÉE' : 'SIGNAL PERDU'}</div>
            <div class="dv-grosmot">${[...mot].map((ch, i) => `<span style="animation-delay:${.25 + i * .05}s">${ch === ' ' ? '&nbsp;' : dvEsc(ch)}</span>`).join('')}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:90%">
                ${trouveurs.map((n, k) => `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:rgba(6,78,59,.7);border:1px solid #34d399;font-size:12px;animation:dvIn .4s ease both;animation-delay:${.7 + k * .12}s">${dvPastille(n, 18)}<b>${dvEsc(n)}</b><span style="color:#6ee7b7">+${pts[n]}</span></span>`).join('')}
                ${pts[d] ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:rgba(76,29,149,.7);border:1px solid #a78bfa;font-size:12px;animation:dvIn .4s ease both;animation-delay:${.7 + trouveurs.length * .12}s">✏️ ${dvPastille(d, 18)}<b>${dvEsc(d)}</b><span style="color:#c4b5fd">+${pts[d]}</span></span>` : ''}
                ${!ok ? `<span style="font-size:12px;color:#94a3b8">Personne n’a décodé le signal de ${dvEsc(d)}.</span>` : ''}
            </div></div>`;
    } else v.innerHTML = '';
}
function dvMajOutils(g, actif) {
    const el = document.getElementById('dv-outils'); if (!el) return;
    const cle = actif ? 'on:' + dvC.outil.c + dvC.outil.w + dvC.outil.e + dvC.outil.f + (g.mode || '') : 'off';
    if (el.dataset.cle === cle) return; el.dataset.cle = cle;
    if (cle === 'off') { el.innerHTML = ''; return; }
    const o = dvC.outil;
    el.innerHTML = `<div class="dv-outils">
        ${DV_COULEURS.map(c => `<span class="dv-pastel ${!o.e && o.c === c ? 'on' : ''}" data-c="${c}" style="background:${c};color:${c}"></span>`).join('')}
        <span style="width:1px;height:26px;background:#334155;margin:0 2px"></span>
        ${DV_TAILLES.map(w => `<button class="dv-tool ${o.w === w ? 'on' : ''}" data-w="${w}" title="Épaisseur"><span class="pt" style="width:${Math.max(4, w / 2)}px;height:${Math.max(4, w / 2)}px"></span></button>`).join('')}
        <button class="dv-tool ${o.f ? 'on' : ''}" data-pot="1" title="Pot de peinture : remplit une zone">🪣</button>
        <button class="dv-tool ${o.e ? 'on' : ''}" data-gomme="1" title="Gomme">🧽</button>
        <button class="dv-tool" data-annuler="1" title="Annuler le dernier trait">↶</button>
        <button class="dv-tool" data-effacer="1" title="Tout effacer">🗑️</button>
        ${g.mode === 'tele' ? '<button class="dv-tool" data-fini="1" style="border-color:#34d399;color:#6ee7b7">✔ J’ai terminé</button>' : ''}</div>`;
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { dvC.outil.c = b.dataset.c; dvC.outil.e = 0; dvMajOutils(dvC.g, true); });
    el.querySelector('[data-pot]').onclick = () => { dvC.outil.f = dvC.outil.f ? 0 : 1; if (dvC.outil.f) dvC.outil.e = 0; dvMajOutils(dvC.g, true); };
    const fini = el.querySelector('[data-fini]'); if (fini) fini.onclick = () => dvEnvoyerDessinTele(dvC.g);
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { dvC.outil.w = +b.dataset.w; dvMajOutils(dvC.g, true); });
    el.querySelector('[data-gomme]').onclick = () => { dvC.outil.e = dvC.outil.e ? 0 : 1; if (dvC.outil.e) dvC.outil.f = 0; dvMajOutils(dvC.g, true); };
    el.querySelector('[data-annuler]').onclick = () => dvAnnuler();
    el.querySelector('[data-effacer]').onclick = () => dvEffacer();
}
function dvMajJoueurs(data, g) {
    const el = document.getElementById('dv-joueurs'); if (!el) return;
    const d = g.mode === 'tele' ? '' : dvDessinateur(g), pts = g.pts || {}, me = dvMe();
    const tr = g.mode === 'tele' ? (g.phase === 'T_DESSIN' ? dvTeleImages(g) : g.phase === 'T_VOTE' ? dvTeleVotes(g) : {}) : (g.trouves || {});
    const L = dvHumains(data).sort((a, b) => (b.score || 0) - (a.score || 0));
    el.innerHTML = L.map((p, k) => `<div class="dv-joueur ${p.name === d ? 'dess' : tr[p.name] ? 'ok' : ''}">
        <span style="width:14px;font:800 10px ui-monospace,monospace;color:#64748b">${k + 1}</span>${dvPastille(p.name, 22)}
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${p.name === me ? 'color:#a5b4fc;font-weight:800' : ''}">${dvEsc(p.name)}</span>
        ${p.name === d ? '✏️' : tr[p.name] ? '✅' : ''}${pts[p.name] ? `<span style="color:#6ee7b7;font-size:10px">+${pts[p.name]}</span>` : ''}
        <b style="font-family:ui-monospace,monospace;color:#fbbf24">${p.score || 0}</b></div>`).join('');
}
function dvSysMsg(html, cls) {
    const ch = document.getElementById('dv-chat'); if (!ch) return;
    const e = document.createElement('div'); e.className = 'm ' + (cls || 'sys'); e.innerHTML = html; ch.appendChild(e); ch.scrollTop = ch.scrollHeight;
}
function dvMajChat(g, me, d) {
    const ch = document.getElementById('dv-chat'); if (!ch) return;
    const jeSais = me === d || !!(g.trouves && g.trouves[me]);
    const evts = [];
    Object.keys(g.chat || {}).forEach(k => evts.push({ k: k, t: 'm', v: g.chat[k] }));
    Object.keys(g.trouves || {}).forEach(n => evts.push({ k: (g.trouves[n].k || '0') + '_' + n, t: 't', n: n }));
    evts.sort((a, b) => a.k < b.k ? -1 : 1).forEach(e => {
        const id = dvC.jeton + ':' + e.t + ':' + e.k;
        if (e.t === 't') {
            if (dvC.trouveVu[id]) return; dvC.trouveVu[id] = 1;
            dvSysMsg(`✅ <b>${dvEsc(e.n)}</b> a décodé le signal !`, 'ok');
            if (e.n !== me) { dvSon('trouve'); dvToast(`✅ ${e.n} a décodé le signal !`); }
            return;
        }
        if (dvC.chatVu[id]) return;
        const m = e.v || {};
        if (m.f && !jeSais) return;          // message réservé aux décodeurs : on le montrera plus tard
        dvC.chatVu[id] = 1;
        dvSysMsg(`<b style="color:${m.f ? '#6ee7b7' : '#a5b4fc'}">${dvEsc(m.n)}</b> : ${dvEsc(m.m)}`, m.f ? 'f' : '');
        if (m.n !== me) dvSon('msg');
    });
}
function dvToast(txt) {
    const z = document.getElementById('dv-toasts'); if (!z) return;
    const e = document.createElement('div'); e.className = 'dv-toast'; e.textContent = txt; z.appendChild(e); setTimeout(() => e.remove(), 2500);
}
function dvMajReactions(g) {
    const z = document.getElementById('dv-reacs-zone'); if (!z) return;
    Object.keys(g.react || {}).sort().forEach(k => {
        if (dvC.reacVu[k]) return; dvC.reacVu[k] = 1;
        const t = parseInt(k, 10); if (!(Date.now() - t < 5000)) return;
        const r = g.react[k] || {}, e = document.createElement('div'); e.className = 'dv-reac';
        e.style.left = (6 + Math.random() * 82) + '%'; e.innerHTML = `${dvEsc(r.e)}<i>${dvEsc(r.n)}</i>`;
        z.appendChild(e); setTimeout(() => e.remove(), 2500); dvSon('pop');
    });
}

// ------------------------------- Actions des joueurs -------------------------------
function dvProposer() {
    const g = dvC.g, inp = document.getElementById('dv-essai'); if (!g || !inp) return;
    const me = dvMe(), d = dvDessinateur(g), v = inp.value.trim().slice(0, 40);
    if (g.mode === 'tele') {
        if (!v) return; const now = Date.now(); if (dvC.dernierEssai && now - dvC.dernierEssai < 500) return; dvC.dernierEssai = now; inp.value = '';
        dvEcrire({ [`dvGame/chat/${now}_${dvNorm(me).slice(0, 10)}`]: { n: me, m: v, f: 0 } }); return;
    }
    if (!v || me === d || g.phase !== 'DESSIN') return;
    const now = Date.now(); if (dvC.dernierEssai && now - dvC.dernierEssai < 500) return; dvC.dernierEssai = now;
    inp.value = '';
    const trouve = !!(g.trouves && g.trouves[me]);
    if (!trouve && dvBon(v, g.mot)) {
        dvSon('moi'); dvToast('🎉 Signal décodé : ' + String(g.mot).toUpperCase());
        dvEcrire({ [`dvGame/trouves/${me}`]: { e: Math.round(dvEcoule(g) * 10) / 10, k: String(now) } });
        return;
    }
    if (trouve && dvNorm(v).indexOf(dvSing(dvNorm(g.mot))) >= 0) { dvSysMsg('🤐 Pas de spoiler : ce message contient le mot.', 'p'); return; }
    if (!trouve && dvProche(v, g.mot)) { dvSon('presque'); dvSysMsg(`🔥 <b>${dvEsc(v)}</b> : presque ! Vous brûlez…`, 'p'); return; }
    dvEcrire({ [`dvGame/chat/${now}_${dvNorm(me).slice(0, 10)}`]: { n: me, m: v, f: trouve ? 1 : 0 } });
}
function dvReagir(em) {
    const g = dvC.g; if (!g || ['DESSIN', 'REVELE', 'T_DESSIN', 'T_VOTE', 'T_REVELE'].indexOf(g.phase) < 0) return;
    const now = Date.now(); if (dvC.derReac && now - dvC.derReac < 600) return; dvC.derReac = now;
    dvEcrire({ [`dvGame/react/${now}_${dvNorm(dvMe()).slice(0, 10)}`]: { e: em, n: dvMe() } });
}

// ------------------------------- Dessin -------------------------------
function dvPeutDessiner() {
    const g = dvC.g; if (!g) return false;
    if (g.mode === 'tele') return g.phase === 'T_DESSIN' && !dvC.envoye[dvJeton(g)];
    return g.phase === 'DESSIN' && dvMe() === dvDessinateur(g) && dvC.tr === dvJeton(g);
}
const dvLocal = () => dvC.g && dvC.g.mode === 'tele';
function dvPoint(e) { const r = dvC.cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * DV.W), Math.round((e.clientY - r.top) / r.height * DV.H)]; }
function dvBrancherDessin() {
    const cv = dvC.cv;
    cv.onpointerdown = e => {
        if (!dvPeutDessiner()) return;
        e.preventDefault();
        if (dvC.outil.f) { dvRemplissage(dvPoint(e)); return; }
        try { cv.setPointerCapture(e.pointerId); } catch (x) {}
        dvNouveauTrait(dvPoint(e));
    };
    cv.onpointermove = e => {
        if (!dvC.cur) return; e.preventDefault();
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        (evs.length ? evs : [e]).forEach(ev => dvAjouterPoint(dvPoint(ev)));
    };
    const fin = () => { if (dvC.cur) { dvEnvoyerTrait(true); dvC.cur = null; } };
    cv.onpointerup = fin; cv.onpointercancel = fin; cv.onlostpointercapture = fin;
}
function dvRemplissage(p) {
    dvC.seq++;
    const id = 'k' + String(Date.now() % 1e9).padStart(9, '0') + String(dvC.seq % 100).padStart(2, '0');
    const op = { id: id, f: 1, c: dvC.outil.c, p: [p[0], p[1]] };
    dvC.local[id] = op; dvC.sale = true; dvSon('pop');
    if (!dvLocal() && dvC.chemin) window.update(window.ref(window.db, dvC.chemin + '/s'), { [id]: { f: 1, c: op.c, p: op.p.join(',') } }).catch(() => {});
}
function dvNouveauTrait(p) {
    dvC.seq++;
    const id = 'k' + String(Date.now() % 1e9).padStart(9, '0') + String(dvC.seq % 100).padStart(2, '0');
    dvC.cur = { id: id, c: dvC.outil.c, w: dvC.outil.w, e: dvC.outil.e, p: [p[0], p[1]] };
    dvC.local[id] = dvC.cur; dvC.sale = true; dvEnvoyerTrait(false);
}
function dvAjouterPoint(p) {
    const c = dvC.cur, n = c.p.length, dx = p[0] - c.p[n - 2], dy = p[1] - c.p[n - 1];
    if (dx * dx + dy * dy < 9) return;
    c.p.push(Math.max(-20, Math.min(DV.W + 20, p[0])), Math.max(-20, Math.min(DV.H + 20, p[1]))); dvC.sale = true;
    if (c.p.length > 640) { dvEnvoyerTrait(true); const der = [c.p[c.p.length - 2], c.p[c.p.length - 1]]; dvNouveauTrait(der); return; }   // trait trop long : on en commence un autre
    if (!dvC.flush) dvC.flush = setTimeout(() => { dvC.flush = 0; if (dvC.cur) dvEnvoyerTrait(false); }, 90);
}
function dvEnvoyerTrait(final) {
    const c = dvC.cur; if (!c || !dvC.chemin || dvLocal()) return;
    if (final && dvC.flush) { clearTimeout(dvC.flush); dvC.flush = 0; }
    const v = { c: c.c, w: c.w, p: c.p.join(',') }; if (c.e) v.e = 1;
    window.update(window.ref(window.db, dvC.chemin + '/s'), { [c.id]: v }).catch(() => {});
}
function dvAnnuler() {
    const ids = Object.keys(Object.assign({}, dvC.traits, dvC.local)).sort(); const id = ids[ids.length - 1]; if (!id) return;
    delete dvC.local[id]; dvC.traits[id] = undefined; delete dvC.traits[id]; dvC.sale = true;
    if (dvLocal()) return;
    window.update(window.ref(window.db, dvC.chemin + '/s'), { [id]: null }).catch(() => {});
}
function dvEffacer() {
    dvC.local = {}; dvC.traits = {}; dvC.cur = null; dvC.sale = true;
    if (dvLocal()) return;
    window.set(window.ref(window.db, dvC.chemin + '/s'), null).catch(() => {});
}
function dvTousLesTraits() {
    const g = dvC.g, moiDess = g && dvMe() === dvDessinateur(g);
    if (g && g.mode === 'tele') return dvC.local;
    const base = dvC.tr === (g ? dvJeton(g) : '') ? dvC.traits : {};
    return moiDess ? Object.assign({}, base, dvC.local) : base;
}
// pot de peinture : remplissage par diffusion à partir du point touché (même résultat chez tous les joueurs)
function dvRemplir(cx, x, y, coul) {
    const W = cx.canvas.width, H = cx.canvas.height; x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const im = cx.getImageData(0, 0, W, H), d = im.data, i0 = (y * W + x) * 4;
    const cible = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const h = String(coul || '#ffffff').replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (Math.abs(cible[0] - r) < 8 && Math.abs(cible[1] - g) < 8 && Math.abs(cible[2] - b) < 8 && cible[3] > 247) return;
    const TOL = 70, proche = j => cible[3] < 40 ? d[j + 3] < 110 : (Math.abs(d[j] - cible[0]) + Math.abs(d[j + 1] - cible[1]) + Math.abs(d[j + 2] - cible[2]) + Math.abs(d[j + 3] - cible[3]) <= TOL);
    const vu = new Uint8Array(W * H), pile = [x, y];
    while (pile.length) {
        let py = pile.pop(), px = pile.pop(), j = py * W + px;
        while (px >= 0 && !vu[j] && proche(j * 4)) { px--; j--; }
        px++; j++; let haut = false, bas = false;
        while (px < W && !vu[j] && proche(j * 4)) {
            vu[j] = 1; const k = j * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
            if (py > 0) { const u = j - W; if (!vu[u] && proche(u * 4)) { if (!haut) { pile.push(px, py - 1); haut = true; } } else haut = false; }
            if (py < H - 1) { const u = j + W; if (!vu[u] && proche(u * 4)) { if (!bas) { pile.push(px, py + 1); bas = true; } } else bas = false; }
            px++; j++;
        }
    }
    // on déborde d'un pixel sur le contour lissé des traits pour ne pas laisser de liseré
    const D = new Uint8Array(vu);
    for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) { const j = yy * W + xx; if (!vu[j] && (D[j - 1] || D[j + 1] || D[j - W] || D[j + W])) { const k = j * 4; if (d[k + 3] < 250) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; } } }
    cx.putImageData(im, 0, 0);
}
function dvTracer(cx, t, ech) {
    const pts = typeof t.p === 'string' ? t.p.split(',').map(Number) : (t.p || []);
    if (t.f) { cx.globalCompositeOperation = 'source-over'; if (pts.length >= 2) dvRemplir(cx, pts[0] * ech, pts[1] * ech, t.c); return; }
    if (pts.length < 2) return;
    cx.globalCompositeOperation = t.e ? 'destination-out' : 'source-over';
    cx.strokeStyle = t.c || '#fff'; cx.fillStyle = t.c || '#fff'; cx.lineWidth = (t.w || 10) * ech;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    if (pts.length < 4) { cx.beginPath(); cx.arc(pts[0] * ech, pts[1] * ech, (t.w || 10) * ech / 2, 0, Math.PI * 2); cx.fill(); return; }
    cx.beginPath(); cx.moveTo(pts[0] * ech, pts[1] * ech);
    for (let i = 2; i < pts.length - 2; i += 2) {
        const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
        cx.quadraticCurveTo(pts[i] * ech, pts[i + 1] * ech, mx * ech, my * ech);
    }
    cx.lineTo(pts[pts.length - 2] * ech, pts[pts.length - 1] * ech); cx.stroke();
}
function dvRedessiner() {
    dvC.sale = false; const cx = dvC.cx; if (!cx) return;
    cx.clearRect(0, 0, DV.W, DV.H);
    const T = dvTousLesTraits(), cles = Object.keys(T).filter(k => T[k]).sort();
    // cache : tous les traits sauf le dernier (celui en cours) sont dessinés une fois pour toutes
    const base = cles.slice(0, -1), sig = dvC.jeton + '|' + base.join(',') + '|' + base.reduce((n, k) => n + String(T[k].p).length, 0);
    if (!dvC.cache) { dvC.cache = document.createElement('canvas'); dvC.cache.width = DV.W; dvC.cache.height = DV.H; }
    if (dvC.cacheSig !== sig) {
        const cc = dvC.cache.getContext('2d'); cc.clearRect(0, 0, DV.W, DV.H);
        base.forEach(k => dvTracer(cc, T[k], 1)); cc.globalCompositeOperation = 'source-over'; dvC.cacheSig = sig;
    }
    cx.drawImage(dvC.cache, 0, 0);
    if (cles.length) dvTracer(cx, T[cles[cles.length - 1]], 1);
    cx.globalCompositeOperation = 'source-over';
}
function dvEcrireGalerie(g) {
    const cle = dvJeton(g); if (dvC.galerieEcrite[cle]) return; dvC.galerieEcrite[cle] = 1;
    const T = dvTousLesTraits(); if (!Object.keys(T).length) return;
    try {
        const c = document.createElement('canvas'); c.width = 240; c.height = 180;
        const x = c.getContext('2d'), calque = document.createElement('canvas'); calque.width = 240; calque.height = 180;
        const xc = calque.getContext('2d'); Object.keys(T).sort().forEach(k => dvTracer(xc, T[k], .24));
        x.fillStyle = '#0b1a2c'; x.fillRect(0, 0, 240, 180); x.drawImage(calque, 0, 0);
        dvEcrire({ [`dvGame/galerie/t${g.tour || 0}`]: { d: dvDessinateur(g), m: g.mot || '', img: c.toDataURL('image/jpeg', .62) } });
    } catch (e) {}
}

// ------------------------------- Boucle (minuteur, hôte, fin) -------------------------------
function dvBoucle() {
    const data = window.currentRoom || dvC.data, g = data && data.dvGame;
    if (!g || data.status !== 'IN_GAME' || data.selectedMode !== 'dessin') { dvArreter(); return; }
    if (g.status !== 'PLAYING' || !document.getElementById('dv-root')) return;
    if (window.isHost) dvHote();
    const t = dvEcoule(g), tot = g.phase === 'CHOIX' ? DV.CHOIX : (g.phase === 'DESSIN' || g.phase === 'T_DESSIN') ? (g.duree || 80) : g.phase === 'T_VOTE' ? DV.VOTE : g.phase === 'T_REVELE' ? DV.TREVELE : DV.REVELE;
    if (g.phase === 'T_DESSIN' && t >= (g.duree || 80)) dvEnvoyerDessinTele(g);
    const reste = Math.max(0, Math.ceil(tot - t));
    const tm = document.getElementById('dv-temps'); if (tm) { tm.textContent = reste + 's'; tm.style.color = g.phase === 'DESSIN' && reste <= 10 ? '#f87171' : '#fbbf24'; }
    const gt = document.getElementById('generic-game-timer'); if (gt) gt.innerText = (g.phase === 'DESSIN' || g.phase === 'T_DESSIN' || g.phase === 'T_VOTE') ? reste + 's' : g.phase === 'CHOIX' ? 'Choix du mot' : 'Résultat';
    const sg = document.getElementById('dv-signal'); if (sg) { sg.style.width = Math.max(0, 100 * (1 - t / tot)) + '%'; sg.style.background = g.phase === 'DESSIN' && reste <= 10 ? 'linear-gradient(90deg,#f43f5e,#fb923c)' : ''; }
    if ((g.phase === 'T_DESSIN' && !dvC.envoye[dvJeton(g)]) || g.phase === 'T_VOTE') { if (reste <= 10 && reste > 0 && dvC.tic !== reste) { dvC.tic = reste; dvSon('tic'); } }
    if (g.phase === 'DESSIN') {
        if (reste <= 10 && reste > 0 && dvC.tic !== reste) { dvC.tic = reste; dvSon('tic'); }
        dvMajMot(g, dvMe() === dvDessinateur(g));       // dévoile les lettres au fil du temps
    }
}
function dvArreter() {
    if (dvC.ticker) { clearInterval(dvC.ticker); dvC.ticker = null; }
    if (dvC.raf) { cancelAnimationFrame(dvC.raf); dvC.raf = 0; }
    if (dvC.ecoute) { try { dvC.ecoute(); } catch (e) {} dvC.ecoute = null; }
    dvC.chemin = ''; dvC.sess = 0; dvC.cur = null;
}
window.dvArreter = dvArreter;

function dvFin(data, g) {
    const cle = String(g.startedAt);
    if (dvC.fini === cle) return; dvC.fini = cle;
    dvArreter();
    if (window.isHost && g.pos === 'ext') window.set(window.ref(window.db, 'salons/' + dvSalon() + '__dessin'), null).catch(() => {});
    const L = dvHumains(data).sort((a, b) => (b.score || 0) - (a.score || 0));
    const podium = [1, 0, 2].map(i => L[i]).map((p, k) => !p ? '<div></div>' : `
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;animation:dvIn .6s ease both;animation-delay:${[.5, .9, .2][k]}s">
            ${[ '🥈', '🥇', '🥉'][k]}${dvPastille(p.name, [46, 60, 40][k])}<b style="font-size:13px">${dvEsc(p.name)}</b>
            <div style="width:100%;height:${[70, 100, 50][k]}px;border-radius:10px 10px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:6px;font:900 15px ui-monospace,monospace;
                background:linear-gradient(180deg,${['#94a3b8', '#f59e0b', '#b45309'][k]},rgba(15,23,42,.6));color:#0b0b14">${p.score || 0}</div></div>`).join('');
    const reste = L.slice(3).map((p, k) => `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:10px;background:#0f172a;border:1px solid #1e293b;font-size:12px"><span>#${k + 4} ${dvEsc(p.name)}</span><b style="color:#fbbf24">${p.score || 0} pts</b></div>`).join('');
    const gal = Object.keys(g.galerie || {}).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)).map((k, i) => {
        const x = g.galerie[k] || {};
        return `<figure style="animation-delay:${1 + i * .08}s"><img src="${dvEsc(x.img)}" alt=""><figcaption><b style="color:#fde68a">${dvEsc(String(x.m || '').toUpperCase())}</b><br><span style="color:#94a3b8">par ${dvEsc(x.d)}</span></figcaption></figure>`;
    }).join('');
    const lb = document.getElementById('final-leaderboard');
    if (lb) lb.innerHTML = `<div style="text-align:left;color:#e2e8f0">
        <div style="text-align:center;font:800 10px ui-monospace,monospace;letter-spacing:.24em;color:#67e8f9;margin-bottom:10px">🎨 TRANSMISSIONS TERMINÉES</div>
        <div style="display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:10px;align-items:end;max-width:420px;margin:0 auto 12px">${podium}</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">${reste}</div>
        ${gal ? `<div style="font:800 10px ui-monospace,monospace;letter-spacing:.2em;color:#a78bfa;margin:6px 0">ARCHIVES DES TRANSMISSIONS</div><div class="dv-galerie">${gal}</div>` : ''}
    </div>`;
    if (typeof showScreen === 'function') showScreen('screen-results');
    dvSon('fin');
}
