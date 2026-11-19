// =====================================================================
//  MODE « CHARGE INSTABLE » : un démineur face à la charge (grand écran, 3D),
//  les autres membres d'équipage ont le manuel de neutralisation sur leur téléphone.
//
//  Données Firebase : salons/<code>/dsGame
//    { v, status:'PLAYING'|'FINISHED', startedAt, seed, niveau, dem, err, res:{i:1}, reste, fin:{ok, raison, reste} }
//  Le démineur fait tourner la charge chez lui et publie l'état (erreurs, modules neutralisés, minuteur).
//  Fichiers chargés à la demande : three.min.js, desamorcage-donnees.js, desamorcage-3d.js
// =====================================================================

const dsC = { sess: 0, role: '', vue: null, charge: null, ecoule: 0, der: 0, err: 0, res: {}, ecrit: 0, fini: '', raf: 0, page: 'couverture', ticker: null, tic: -1, sig: '' };

function dsMoi() { return window.myPlayerKey || (window.state && state.username); }
function dsSalon() { return window.currentCodeSalon || (window.state && state.roomCode); }
function dsEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dsHumains(data) { return Object.values((data && data.players) || {}).filter(p => p && p.name && !p.isBot); }
function dsEcrire(upd) { const c = dsSalon(); if (!c || !window.update) return Promise.resolve(); return window.update(window.ref(window.db, 'salons/' + c), upd).catch(e => console.error('Charge instable :', e)); }
function dsFmt(s) { s = Math.max(0, s); const m = Math.floor(s / 60), x = Math.floor(s % 60); return s < 60 ? `${String(x).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}` : `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; }

// ------------------------------- Sons -------------------------------
function dsSon(nom) {
    if (typeof sysSon !== 'undefined' && !sysSon.on) return;
    if (typeof sysCtx !== 'function' || typeof sysNote !== 'function') { if (typeof window.sfx === 'function') window.sfx(nom === 'boum' ? 'coule' : nom === 'erreur' ? 'erreur' : 'clic'); return; }
    try {
        const c = sysCtx(); if (!c) return;
        if (nom === 'clic') { sysNote(c, 1500, 0, .03, 'square', .05); sysBruit(c, 0, .03, 3000, .08); }
        else if (nom === 'coupe') { sysBruit(c, 0, .08, 5200, .35, 1800); sysNote(c, 900, 0, .05, 'square', .05, 300); }
        else if (nom === 'zoom') sysBruit(c, 0, .22, 400, .12, 1600);
        else if (nom === 'ok') { [880, 1175, 1568].forEach((f, i) => sysNote(c, f, i * .07, .22, 'sine', .14)); }
        else if (nom === 'erreur') { sysNote(c, 120, 0, .45, 'sawtooth', .22, 70); sysNote(c, 180, 0, .3, 'square', .1); sysBruit(c, 0, .3, 300, .2); }
        else if (nom === 'alerte') { [0, .18, .36].forEach(t => { sysNote(c, 988, t, .12, 'square', .07); sysNote(c, 740, t + .09, .09, 'square', .07); }); }
        else if (nom === 'tic') sysNote(c, 2200, 0, .02, 'square', .035);
        else if (nom === 'tac') sysNote(c, 1650, 0, .02, 'square', .03);
        else if (nom === 'boum') { sysBruit(c, 0, 2.2, 900, .9, 40); sysNote(c, 70, 0, 1.6, 'sawtooth', .35, 25); sysNote(c, 45, .05, 2, 'sine', .4, 20); }
        else if (nom === 'victoire') { [523, 659, 784, 1047, 1319].forEach((f, i) => sysNote(c, f, i * .1, .45, 'triangle', .15)); }
    } catch (e) {}
}

// ------------------------------- Habillage (manuel + vue démineur) -------------------------------
function dsStyle() {
    if (document.getElementById('ds-style')) return;
    const st = document.createElement('style'); st.id = 'ds-style';
    st.textContent = `
    #ds-root{position:fixed;inset:0;z-index:10000;background:#05070d;color:#e2e8f0;font-family:system-ui,'Segoe UI',sans-serif;overflow:hidden;user-select:none}
    #ds-scene{position:absolute;inset:0}
    .ds-hud{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:10px 14px;pointer-events:none;background:linear-gradient(180deg,rgba(2,6,23,.85),transparent)}
    .ds-hud > *{pointer-events:auto}
    .ds-titre{font:900 13px ui-monospace,monospace;letter-spacing:.24em;color:#fca5a5}
    .ds-pill{padding:5px 11px;border-radius:999px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.8);font:800 12px ui-monospace,monospace;letter-spacing:.08em}
    .ds-btn{cursor:pointer;padding:7px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.85);color:#e2e8f0;font-weight:800;font-size:12px}
    .ds-btn:hover{border-color:#fca5a5}
    .ds-aide{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:rgba(2,6,23,.75);border:1px solid rgba(148,163,184,.25);font-size:12px;color:#cbd5e1;text-align:center;transition:opacity .6s}
    .ds-fin{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.72);animation:dsIn .6s ease both}
    .ds-carte{max-width:460px;width:92%;padding:22px;border-radius:20px;text-align:center;border:1px solid rgba(148,163,184,.3);background:linear-gradient(180deg,#0b1222,#050814)}
    @keyframes dsIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
    @keyframes dsClign{50%{opacity:.35}}
    /* --- manuel --- */
    .mn-app{display:grid;grid-template-columns:1fr;gap:10px;width:100%;max-width:980px;margin:0 auto;color:#e2e8f0}
    @media (min-width:900px){.mn-app{grid-template-columns:260px 1fr}.mn-nav{position:sticky;top:8px;max-height:calc(100vh - 140px);overflow:auto}#mn-sommaire{display:none}}
    @media (max-width:899px){.mn-nav.ferme #mn-liste{display:none}}
    #mn-sommaire{cursor:pointer;width:100%;margin-bottom:6px;padding:9px;border-radius:9px;border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.1);color:#fde68a;font-weight:800;font-size:13px;text-align:left}
    .mn-etat{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:14px;border:1px solid rgba(248,113,113,.35);background:linear-gradient(90deg,rgba(69,10,10,.6),rgba(15,23,42,.85))}
    .mn-chrono{font:900 26px ui-monospace,monospace;color:#f87171;letter-spacing:.06em;min-width:96px}
    .mn-nav{border-radius:14px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.85);padding:8px}
    .mn-nav input{width:100%;box-sizing:border-box;background:#020617;border:1px solid rgba(251,191,36,.4);border-radius:9px;padding:8px 10px;color:#fff;font-size:13px;outline:none;margin-bottom:6px}
    .mn-groupe{font:800 9px ui-monospace,monospace;letter-spacing:.18em;color:#fbbf24;margin:8px 4px 3px}
    .mn-lien{display:block;width:100%;text-align:left;cursor:pointer;padding:6px 8px;border-radius:8px;border:0;background:transparent;color:#cbd5e1;font-size:13px}
    .mn-lien:hover{background:rgba(251,191,36,.08)}
    .mn-lien.on{background:rgba(251,191,36,.16);color:#fde68a;font-weight:800}
    .mn-page{border-radius:16px;border:1px solid rgba(251,191,36,.25);background:linear-gradient(180deg,#141006,#0b0a07 40%,#0a0c12);padding:16px 18px;line-height:1.55;font-size:14px;min-width:0;box-shadow:0 0 30px rgba(251,191,36,.05) inset}
    .mn-entete{display:flex;justify-content:space-between;gap:10px;align-items:baseline;border-bottom:1px dashed rgba(251,191,36,.35);padding-bottom:8px;margin-bottom:10px}
    .mn-entete h3{margin:0;font-size:20px;font-weight:900;color:#fde68a;letter-spacing:.02em}
    .mn-entete span{font:800 12px ui-monospace,monospace;color:#fbbf24;white-space:nowrap}
    .mn-p{margin:8px 0}
    .mn-h4{margin:14px 0 6px;font:900 11px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#fbbf24}
    .mn-regles{margin:6px 0 6px 0;padding-left:24px;list-style:decimal}
    .mn-regles li::marker{color:#fbbf24;font-weight:800}
    .mn-regles li{margin:5px 0}
    .mn-table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
    .mn-table th,.mn-table td{border:1px solid rgba(148,163,184,.25);padding:5px 7px;vertical-align:middle;text-align:left}
    .mn-table th{background:rgba(251,191,36,.08);color:#fde68a;font-size:12px}
    .mn-2col{columns:auto}
    .mn-num{text-align:center!important;font-family:ui-monospace,monospace;font-weight:800}
    .mn-petit{font-size:11px;color:#94a3b8}
    .mn-mono{font-family:ui-monospace,monospace}
    .mn-pc{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;border:1px solid rgba(255,255,255,.35)}
    .mn-note{margin:10px 0;padding:8px 10px;border-left:3px solid #38bdf8;background:rgba(14,116,144,.15);border-radius:0 8px 8px 0;font-size:13px}
    .mn-ex{margin:10px 0;padding:8px 10px;border:1px dashed rgba(251,191,36,.5);border-radius:10px;background:rgba(251,191,36,.06);font-size:13px}
    .mn-grille-fig{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:8px;margin:8px 0}
    .mn-fig{margin:0;text-align:center;font-size:11px;color:#cbd5e1}
    .mn-fig svg{max-width:100%;height:auto}
    .mn-glyphes{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px;margin:8px 0}
    .mn-gly{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:10px;border:1px solid rgba(148,163,184,.2);background:rgba(2,6,23,.6);font-size:11px;text-align:center}
    .mn-gly span{color:#94a3b8;font-size:10px}
    .mn-lettre{font-size:16px;color:#67e8f9}
    .mn-alpha{display:flex;flex-wrap:wrap;gap:3px;margin:8px 0}
    .mn-alpha span{display:flex;flex-direction:column;align-items:center;width:24px;padding:2px 0;border-radius:6px;background:rgba(2,6,23,.7);border:1px solid rgba(148,163,184,.2)}
    .mn-alpha i{font-style:normal;font-size:9px;color:#64748b}
    .mn-couv{text-align:center;padding:18px 6px 10px}
    .mn-couv-logo{font-size:54px;color:#fbbf24;text-shadow:0 0 30px rgba(251,191,36,.5)}
    .mn-couv-t{font:900 22px ui-monospace,monospace;letter-spacing:.18em;color:#fde68a}
    .mn-couv-s{font-size:13px;color:#cbd5e1;margin-top:4px}
    .mn-couv-r{margin:12px auto 0;max-width:420px;padding:6px 10px;border:2px solid #ef4444;color:#fca5a5;font:800 11px ui-monospace,monospace;letter-spacing:.08em;transform:rotate(-1.5deg)}
    .mn-pied{display:flex;justify-content:space-between;gap:8px;margin-top:14px}
    .mn-pied button{cursor:pointer;flex:1;padding:9px;border-radius:10px;border:1px solid rgba(251,191,36,.35);background:rgba(251,191,36,.08);color:#fde68a;font-weight:800;font-size:12px}
    .mn-pied button:disabled{opacity:.3;cursor:default}
    .mn-trouve{background:rgba(250,204,21,.35);color:#fff;border-radius:3px}
    `;
    document.head.appendChild(st);
}

// ------------------------------- Lancement (hôte) -------------------------------
window.startDesamorcageGame = function() {
    if (!window.isHost) return;
    const code = dsSalon(); if (!code || !window.mettreAJourSalonFirebase) return;
    const players = (window.state && state.players) || {};
    const noms = Object.values(players).filter(p => p && p.name && !p.isBot).map(p => p.name);
    if (noms.length < 2) { if (typeof showToast === 'function') showToast('⚠️ Il faut au moins 2 joueurs : un démineur et un expert !'); return; }
    if (!window.DS) { if (typeof showToast === 'function') showToast('⏳ Chargement du manuel en cours…'); return; }
    const choisi = document.getElementById('setting-ds-demineur')?.value;
    const dem = noms.indexOf(choisi) >= 0 ? choisi : noms[Math.floor(Math.random() * noms.length)];
    const niveau = document.getElementById('setting-ds-niveau')?.value || 'officier';
    const now = Date.now();
    const g = { v: 1, status: 'PLAYING', startedAt: now, seed: Math.floor(Math.random() * 2e9), niveau: niveau, dem: dem, err: 0, res: null, reste: (window.DS.NIVEAUX[niveau] || window.DS.NIVEAUX.officier).duree };
    const upd = { status: 'IN_GAME', selectedMode: 'desamorcage', dsGame: g };
    Object.values(players).forEach(p => { if (p && p.name) upd[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(code, upd);
};

// liste « Démineur » des réglages de l'hôte, tenue à jour quand des joueurs arrivent ou partent
function dsMajListeDemineur() {
    const sel = document.getElementById('setting-ds-demineur'); if (!sel) return;
    const noms = Object.values((window.state && state.players) || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const sig = noms.join('\u0001'); if (sel.dataset.sig === sig) return; sel.dataset.sig = sig;
    const garde = noms.indexOf(sel.value) >= 0 ? sel.value : '';
    sel.innerHTML = '<option value="">🎲 Au hasard</option>' + noms.map(n => `<option value="${dsEsc(n)}">${dsEsc(n)}</option>`).join('');
    sel.value = garde;
}
window.dsMajListeDemineur = dsMajListeDemineur;

// ------------------------------- Rendu -------------------------------
window.renderDesamorcageScreen = function(data) {
    const g = data && data.dsGame; if (!g || !window.DS) return;
    if (dsC.quitte === g.startedAt) return;          // ce joueur est déjà reparti vers le salon
    dsStyle();
    const me = dsMoi(), role = me === g.dem ? 'dem' : 'expert';
    if (dsC.sess !== g.startedAt || dsC.role !== role) dsNouvelleSession(g, role);
    if (role === 'dem') dsMajDemineur(data, g); else dsMajExpert(data, g);
    if (!dsC.ticker) dsC.ticker = setInterval(dsSurveiller, 500);
};

function dsNouvelleSession(g, role) {
    dsArreter();
    dsC.sess = g.startedAt; dsC.role = role; dsC.fini = ''; dsC.err = 0; dsC.res = {}; dsC.ecoule = 0; dsC.der = performance.now(); dsC.tic = -1; dsC.sig = '';
    dsC.charge = window.DS.charge(g.seed, g.niveau);
    if (role === 'dem') dsConstruireDemineur(g); else dsConstruireExpert(g);
}

// ---------- Démineur : la charge en plein écran ----------
function dsConstruireDemineur(g) {
    if (typeof showScreen === 'function') showScreen('screen-generic-game');
    const zone = document.getElementById('generic-game-content'); if (zone) zone.innerHTML = '<div class="text-center text-slate-400 py-10">💣 La charge est affichée en plein écran.</div>';
    const N = dsC.charge.N;
    const root = document.createElement('div'); root.id = 'ds-root';
    root.innerHTML = `<div id="ds-scene"></div>
        <div class="ds-hud">
            <span class="ds-titre">☢ CHARGE INSTABLE</span><span class="ds-pill" style="color:#fde68a">${dsEsc(N.n.toUpperCase())}</span>
            <span style="flex:1"></span>
            <span class="ds-pill" id="ds-h-mod">MODULES 0/${dsC.charge.mods.filter(m => !window.DS.MODULES.find(d => d.id === m.id).besoin).length}</span>
            <span class="ds-pill" id="ds-h-err" style="color:#f87171">ERREURS 0/${N.erreurs - 1}</span>
            <button class="ds-btn" id="ds-plein" title="Plein écran">⛶</button>
        </div>
        <div class="ds-aide" id="ds-aide">🖱️ Glissez pour tourner la charge · Touchez un module pour zoomer · Échap ou glisser pour revenir<br><b style="color:#fca5a5">Vous n’avez pas le manuel : décrivez tout ce que vous voyez à vos experts !</b></div>`;
    document.body.appendChild(root);
    document.getElementById('ds-plein').onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen(); } catch (e) {} };
    try { if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => {}); } catch (e) {}
    setTimeout(() => { const a = document.getElementById('ds-aide'); if (a) a.style.opacity = '.35'; }, 9000);
    if (!window.DS3D || !window.THREE) { root.insertAdjacentHTML('beforeend', '<div class="ds-fin"><div class="ds-carte">⚠️ Le moteur 3D n’a pas pu être chargé. Vérifiez la connexion puis relancez.</div></div>'); return; }
    dsC.vue = window.DS3D.creer(document.getElementById('ds-scene'), dsC.charge, {
        son: dsSon,
        onErreur: () => { dsC.err++; dsPublier(true); const N2 = dsC.charge.N; if (dsC.err >= N2.erreurs) dsTerminer(false, 'erreurs'); },
        onResolu: i => { dsC.res[i] = 1; dsPublier(true); const tous = dsC.charge.mods.every((m, k) => window.DS.MODULES.find(d => d.id === m.id).besoin || dsC.res[k]); if (tous) dsTerminer(true, 'neutralisée'); },
        onAlerte: () => {}
    });
    const boucle = () => {
        dsC.raf = requestAnimationFrame(boucle);
        const now = performance.now(), dt = Math.min(.25, (now - dsC.der) / 1000); dsC.der = now;
        if (dsC.fini) return;
        dsC.ecoule += dt * (1 + .25 * dsC.err);
        const reste = N.duree - dsC.ecoule;
        dsC.vue.chrono(reste, dsC.err, N.erreurs);
        const sec = Math.floor(reste * (reste < 30 ? 2 : 1));
        if (sec !== dsC.tic) { dsC.tic = sec; dsSon(sec % 2 ? 'tac' : 'tic'); }
        if (reste <= 0) dsTerminer(false, 'temps');
        else if (now - dsC.ecrit > 1000) dsPublier(false);
    };
    dsC.raf = requestAnimationFrame(boucle);
}
function dsPublier(force) {
    const N = dsC.charge.N, reste = Math.max(0, Math.round((N.duree - dsC.ecoule) * 10) / 10);
    dsC.ecrit = performance.now();
    const upd = { 'dsGame/reste': reste, 'dsGame/vit': 1 + .25 * dsC.err };
    if (force) { upd['dsGame/err'] = dsC.err; upd['dsGame/res'] = Object.assign({}, dsC.res); }
    dsEcrire(upd);
    const hm = document.getElementById('ds-h-mod'), he = document.getElementById('ds-h-err');
    if (hm) hm.textContent = `MODULES ${Object.keys(dsC.res).length}/${dsC.charge.mods.filter(m => !window.DS.MODULES.find(d => d.id === m.id).besoin).length}`;
    if (he) he.textContent = `ERREURS ${dsC.err}/${N.erreurs - 1}`;
}
function dsTerminer(ok, raison) {
    if (dsC.fini) return; dsC.fini = ok ? 'ok' : 'boum';
    const N = dsC.charge.N, reste = Math.max(0, Math.round(N.duree - dsC.ecoule));
    if (ok) { dsC.vue && dsC.vue.desamorcer(); dsSon('victoire'); } else { dsC.vue && dsC.vue.exploser(); }
    const data = window.currentRoom || {}, upd = { 'dsGame/status': 'FINISHED', 'dsGame/err': dsC.err, 'dsGame/res': Object.assign({}, dsC.res), 'dsGame/reste': reste, 'dsGame/fin': { ok: ok, raison: raison, reste: reste, t: Date.now() } };
    if (ok) {      // points : neutralisation + temps restant, pour tout l'équipage
        const bonus = { recrue: 100, officier: 200, commandant: 350, legende: 500 }[(data.dsGame || {}).niveau] || 200;
        dsHumains(data).forEach(p => { upd[`players/${p.name}/score`] = (p.score || 0) + bonus + reste; });
    }
    dsEcrire(upd);
}
function dsMajDemineur(data, g) {
    if (g.status === 'FINISHED' && document.getElementById('ds-root') && !document.getElementById('ds-fin')) {
        const f = g.fin || {};
        if (!dsC.fini) { dsC.fini = f.ok ? 'ok' : 'boum'; if (dsC.vue) f.ok ? dsC.vue.desamorcer() : dsC.vue.exploser(); }
        setTimeout(() => dsCarteFin(document.getElementById('ds-root'), g, true), f.ok ? 1200 : 2600);
    }
}

// ---------- Experts : le manuel ----------
function dsConstruireExpert(g) {
    if (typeof showScreen === 'function') showScreen('screen-generic-game');
    const t = document.getElementById('generic-game-title'); if (t) t.innerText = '☢ Charge instable · manuel de neutralisation';
    const zone = document.getElementById('generic-game-content'); if (!zone) return;
    dsC.pages = window.DS.manuel();
    zone.innerHTML = `<div class="mn-app">
        <div class="mn-etat" style="grid-column:1/-1" id="mn-etat"></div>
        <div class="mn-nav ferme" id="mn-nav"><button id="mn-sommaire">☰ Sommaire</button><input id="mn-cherche" placeholder="🔍 Rechercher un module, un mot…" autocomplete="off"><div id="mn-liste"></div></div>
        <div class="mn-page" id="mn-page"></div></div>`;
    const inp = document.getElementById('mn-cherche');
    inp.oninput = () => { document.getElementById('mn-nav').classList.toggle('ferme', !inp.value); dsListe(inp.value); };
    document.getElementById('mn-sommaire').onclick = () => document.getElementById('mn-nav').classList.toggle('ferme');
    dsListe(''); dsOuvrir(dsC.page || 'couverture');
}
function dsListe(q) {
    const el = document.getElementById('mn-liste'); if (!el) return;
    const n = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const qq = n(q.trim());
    let groupe = '', html = '';
    dsC.pages.forEach(p => {
        if (qq && n(p.titre + ' ' + p.html.replace(/<[^>]+>/g, ' ')).indexOf(qq) < 0) return;
        if (p.groupe !== groupe) { groupe = p.groupe; html += `<div class="mn-groupe">${dsEsc(groupe)}</div>`; }
        html += `<button class="mn-lien ${p.id === dsC.page ? 'on' : ''}" data-p="${p.id}">${dsEsc(p.titre)}</button>`;
    });
    el.innerHTML = html || '<div class="mn-petit" style="padding:6px">Aucun résultat.</div>';
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
        dsOuvrir(b.dataset.p, q);
        const nav = document.getElementById('mn-nav'); if (nav && window.innerWidth < 900) { nav.classList.add('ferme'); const pg = document.getElementById('mn-page'); if (pg) pg.scrollIntoView({ block: 'start' }); }
    });
}
function dsOuvrir(id, q) {
    const P = dsC.pages, k = Math.max(0, P.findIndex(p => p.id === id)), p = P[k];
    dsC.page = p.id;
    const el = document.getElementById('mn-page'); if (!el) return;
    const etoiles = p.diff ? (p.besoin ? '♻ RÉCURRENT · ' : '') + '★'.repeat(p.diff) + '☆'.repeat(4 - p.diff) : '';
    let html = p.html;
    const qq = (q || '').trim();
    if (qq.length >= 3) { const re = new RegExp('(>[^<]*?)(' + qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); html = html.replace(re, '$1<mark class="mn-trouve">$2</mark>'); }
    el.innerHTML = `<div class="mn-entete"><h3>${dsEsc(p.titre)}</h3><span>${etoiles}</span></div>${html}
        <div class="mn-pied"><button data-n="-1" ${k ? '' : 'disabled'}>◀ ${k ? dsEsc(P[k - 1].titre) : ''}</button><button data-n="1" ${k < P.length - 1 ? '' : 'disabled'}>${k < P.length - 1 ? dsEsc(P[k + 1].titre) : ''} ▶</button></div>`;
    el.querySelectorAll('.mn-pied button').forEach(b => b.onclick = () => { const j = k + +b.dataset.n; if (P[j]) { dsOuvrir(P[j].id); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    document.querySelectorAll('#mn-liste .mn-lien').forEach(b => b.classList.toggle('on', b.dataset.p === p.id));
    const som = document.getElementById('mn-sommaire'); if (som) som.textContent = `☰ Sommaire · ${p.titre}`;
}
function dsMajExpert(data, g) {
    const el = document.getElementById('mn-etat'); if (!el) return;
    const C = dsC.charge, N = C.N, total = C.mods.filter(m => !window.DS.MODULES.find(d => d.id === m.id).besoin).length;
    const res = Object.keys(g.res || {}).length, err = g.err || 0;
    if (g.status === 'FINISHED') {
        if (el.dataset.fin !== String(g.startedAt)) { el.dataset.fin = String(g.startedAt); dsSon(g.fin && g.fin.ok ? 'victoire' : 'boum'); dsCarteFin(null, g, false); }
        return;
    }
    if (dsC.errVu != null && err > dsC.errVu) { dsSon('erreur'); el.animate && el.animate([{ background: 'rgba(220,38,38,.6)' }, { background: '' }], { duration: 700 }); }
    if (dsC.resVu != null && res > dsC.resVu) dsSon('ok');
    dsC.errVu = err; dsC.resVu = res;
    dsC.resteRecu = g.reste; dsC.resteT = performance.now(); dsC.vit = g.vit || 1;
    el.innerHTML = `<span class="mn-chrono" id="mn-chrono">${dsFmt(g.reste || 0)}</span>
        <span class="ds-pill" style="color:#f87171">✕ ${err}/${N.erreurs - 1}</span>
        <span class="ds-pill" style="color:#86efac">✔ ${res}/${total} modules</span>
        <span class="ds-pill" style="color:#fde68a">${dsEsc(N.n)}</span>
        <span style="flex:1"></span>
        <span class="mn-petit">Démineur : <b style="color:#fca5a5">${dsEsc(g.dem)}</b> · vous êtes <b>expert</b></span>`;
}
function dsCarteFin(parent, g, demineur) {
    const f = g.fin || {}, ok = !!f.ok;
    const raison = ok ? `Charge neutralisée avec <b>${dsFmt(f.reste || 0)}</b> restantes !` : f.raison === 'temps' ? 'Le minuteur a atteint zéro.' : f.raison === 'erreurs' ? 'Trop d’erreurs : la charge a explosé.' : f.raison === 'abandon' ? 'Le démineur a quitté la partie.' : 'La charge a explosé.';
    const html = `<div class="ds-carte">
        <div style="font-size:52px">${ok ? '🛡️' : '💥'}</div>
        <div style="font:900 20px ui-monospace,monospace;letter-spacing:.14em;color:${ok ? '#86efac' : '#fca5a5'}">${ok ? 'CHARGE NEUTRALISÉE' : 'EXPLOSION'}</div>
        <div style="margin:10px 0 14px;color:#cbd5e1;font-size:14px">${raison}<br><span style="font-size:12px;color:#94a3b8">Démineur : ${dsEsc(g.dem)} · erreurs : ${g.err || 0} · modules : ${Object.keys(g.res || {}).length}</span></div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="ds-btn" style="background:#0e7490;border-color:#22d3ee" onclick="dsQuitter()">Retour au salon</button>
            ${window.isHost ? '<button class="ds-btn" onclick="dsRevanche()">🔁 Nouvelle charge</button>' : ''}
        </div></div>`;
    if (parent) { if (document.getElementById('ds-fin')) return; const d = document.createElement('div'); d.className = 'ds-fin'; d.id = 'ds-fin'; d.innerHTML = html; parent.appendChild(d); }
    else { const z = document.getElementById('mn-etat'); if (z) { z.style.display = 'block'; z.style.background = ok ? 'rgba(6,78,59,.5)' : 'rgba(69,10,10,.7)'; z.innerHTML = html.replace('class="ds-carte"', 'class="ds-carte" style="margin:0 auto"'); } }
}
window.dsQuitter = function() {
    const g = window.currentRoom && window.currentRoom.dsGame; dsC.quitte = g ? g.startedAt : 0; dsArreter();
    const z = document.getElementById('generic-game-content'); if (z) z.innerHTML = '<div class="text-center text-slate-300 py-10"><i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs…</div>';
    if (typeof backToLobby === 'function') backToLobby();
};
window.dsRevanche = function() { const g = window.currentRoom && window.currentRoom.dsGame; dsC.quitte = g ? g.startedAt : 0; dsArreter(); if (typeof demanderRevanche === 'function') demanderRevanche(); };

// ------------------------------- Surveillance (fin de partie, départ du démineur, minuteur des experts) -------------------------------
function dsSurveiller() {
    const data = window.currentRoom, g = data && data.dsGame;
    if (!g || data.status !== 'IN_GAME' || data.selectedMode !== 'desamorcage') { dsArreter(); return; }
    if (dsC.role === 'expert' && g.status === 'PLAYING' && dsC.resteRecu != null) {
        const r = dsC.resteRecu - (performance.now() - dsC.resteT) / 1000 * (dsC.vit || 1), el = document.getElementById('mn-chrono');
        if (el) { el.textContent = dsFmt(Math.max(0, r)); el.style.animation = r < 30 ? 'dsClign 1s steps(2) infinite' : ''; }
    }
    if (window.isHost && g.status === 'PLAYING' && !dsHumains(data).some(p => p.name === g.dem)) {     // le démineur est parti
        dsC.absent = dsC.absent || Date.now();
        if (Date.now() - dsC.absent > 8000) { dsC.absent = 0; dsEcrire({ 'dsGame/status': 'FINISHED', 'dsGame/fin': { ok: false, raison: 'abandon', reste: g.reste || 0, t: Date.now() } }); }
    } else dsC.absent = 0;
}
function dsArreter() {
    if (dsC.raf) { cancelAnimationFrame(dsC.raf); dsC.raf = 0; }
    if (dsC.vue) { try { dsC.vue.detruire(); } catch (e) {} dsC.vue = null; }
    const r = document.getElementById('ds-root'); if (r) r.remove();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    if (dsC.ticker) { clearInterval(dsC.ticker); dsC.ticker = null; }
    dsC.sess = 0; dsC.role = ''; dsC.errVu = dsC.resVu = null; dsC.resteRecu = null;
}
window.dsArreter = dsArreter;
