// =====================================================================
//  MODE « CONSEIL DE BORD » : « Qui à bord est le plus susceptible de… ? »
//  Chaque motion est votée en secret, puis le Conseil révèle le verdict.
//  Six formats de motion :
//    joueur  : vote nominatif (un membre de l'équipage)
//    duel    : deux membres tirés au sort, qui des deux ?
//    ordreEq : classer l'équipage du plus au moins susceptible
//    tierEq  : tier list de l'équipage (S → D)
//    tier    : tier list d'objets (S → D)
//    ordre   : classement d'objets
//    dilemme : « Tu préfères… »
//    aveu    : aveu anonyme (oui / non) + combien ont avoué
//  Points : être en accord avec la majorité / le consensus de l'équipage.
//  (utilise le moteur commun de manches.js ; questions dans conseil-questions.js)
// =====================================================================

const CDB_FORMATS = {
    joueur:  { n: 'VOTE NOMINATIF', i: '🗳️', t: 20, poids: 28, min: 3 },
    duel:    { n: 'DUEL AU CONSEIL', i: '⚔️', t: 15, poids: 10, min: 3 },
    ordreEq: { n: 'CLASSEMENT DE L’ÉQUIPAGE', i: '📋', t: 30, poids: 12, min: 3 },
    tierEq:  { n: 'TIER LIST DE L’ÉQUIPAGE', i: '📊', t: 35, poids: 8, min: 3 },
    tier:    { n: 'TIER LIST', i: '📊', t: 45, poids: 12, min: 1 },
    ordre:   { n: 'CLASSEMENT', i: '📋', t: 35, poids: 8, min: 1 },
    dilemme: { n: 'DILEMME', i: '⚖️', t: 15, poids: 12, min: 2 },
    aveu:    { n: 'AVEU ANONYME', i: '🤫', t: 25, poids: 10, min: 2 }
};
const CDB_TIERS_NOMS = ['S', 'A', 'B', 'C', 'D'];
const CDB_TIERS_COUL = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#38bdf8'];
const CDB_TIERS_OBJ = ['Légendaire', 'Excellent', 'Correct', 'Bof', 'À éjecter'];
const CDB_TIERS_EQ = ['Sans aucun doute', 'Très probable', 'Possible', 'Peu probable', 'Jamais de la vie'];
const CDB_REACTIONS = ['😂', '😱', '👏', '🔥', '💀', '❤️'];
const CDB_SUSPENSE = 1.5;      // secondes de « dépouillement » avant le verdict

// ------------------------------- Sons -------------------------------
function cdbSon(nom) {
    if (typeof sysSon !== 'undefined' && !sysSon.on) return;
    if (typeof sysCtx !== 'function' || typeof sysNote !== 'function') { if (typeof window.sfx === 'function') window.sfx(nom === 'verdict' ? 'victoire' : 'clic'); return; }
    try {
        const c = sysCtx(); if (!c) return;
        if (nom === 'vote') { sysNote(c, 523, 0, 0.09, 'triangle', 0.14); sysNote(c, 784, 0.07, 0.16, 'triangle', 0.14); }
        else if (nom === 'choix') sysNote(c, 1100, 0, 0.05, 'square', 0.05);
        else if (nom === 'roulement') { for (let k = 0; k < 16; k++) sysBruit(c, k * 0.085, 0.07, 260 + k * 18, 0.12 + k * 0.012); }
        else if (nom === 'verdict') { sysBruit(c, 0, 0.35, 180, 0.5, 60); [523, 659, 784, 1047].forEach((f, i) => sysNote(c, f, 0.05 + i * 0.09, 0.4, 'triangle', 0.15)); sysNote(c, 1568, 0.45, 0.6, 'sine', 0.08); }
        else if (nom === 'tampon') { sysBruit(c, 0, 0.18, 140, 0.6, 50); sysNote(c, 90, 0, 0.2, 'sine', 0.3, 40); }
        else if (nom === 'case') sysNote(c, 300 + Math.random() * 400, 0, 0.12, 'sine', 0.12, 160);
        else if (nom === 'compte') sysNote(c, 880, 0, 0.05, 'square', 0.05);
        else if (nom === 'pop') { sysNote(c, 600, 0, 0.08, 'sine', 0.14, 1400); }
    } catch (e) {}
}

// ------------------------------- Habillage -------------------------------
function cdbStyle() {
    if (document.getElementById('cdb-style')) return;
    const st = document.createElement('style'); st.id = 'cdb-style';
    st.textContent = `
    .cdb-carte{position:relative;border-radius:18px;padding:16px;border:1px solid rgba(167,139,250,.35);overflow:hidden;
        background:radial-gradient(ellipse at 50% -20%,rgba(124,58,237,.35),transparent 60%),linear-gradient(180deg,#0d0a24,#070512);box-shadow:0 0 30px rgba(124,58,237,.15) inset}
    .cdb-carte::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.35;
        background-image:radial-gradient(1px 1px at 12% 20%,#fff,transparent),radial-gradient(1px 1px at 82% 14%,#e9d5ff,transparent),radial-gradient(1px 1px at 64% 78%,#fff,transparent),radial-gradient(1px 1px at 30% 88%,#c4b5fd,transparent);}
    .cdb-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid rgba(196,181,253,.5);background:rgba(76,29,149,.35);
        color:#ddd6fe;font-size:10px;font-weight:800;letter-spacing:.16em}
    .cdb-q{font-size:clamp(18px,4.2vw,26px);font-weight:900;color:#fff;line-height:1.25;text-shadow:0 0 18px rgba(167,139,250,.45)}
    .cdb-q b{color:#f0abfc}
    .cdb-btn{cursor:pointer;transition:transform .12s,box-shadow .2s,border-color .2s,background .2s;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.75);border-radius:14px;color:#e2e8f0}
    .cdb-btn:hover{border-color:rgba(196,181,253,.7);transform:translateY(-1px)}
    .cdb-btn:active{transform:scale(.97)}
    .cdb-btn.sel{border-color:#f0abfc;background:rgba(112,26,117,.35);box-shadow:0 0 0 2px rgba(240,171,252,.35),0 0 22px rgba(232,121,249,.35)}
    .cdb-go{cursor:pointer;width:100%;padding:13px;border-radius:14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:13px;color:#fff;border:0;
        background:linear-gradient(90deg,#7c3aed,#c026d3);box-shadow:0 0 22px rgba(192,38,211,.4)}
    .cdb-go:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
    .cdb-tier{display:flex;align-items:stretch;min-height:46px;border-radius:10px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.6);cursor:pointer}
    .cdb-tier .l{flex:0 0 74px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#0b0b14;font-weight:900;font-size:18px;line-height:1}
    .cdb-tier .l small{font-size:8px;font-weight:800;letter-spacing:.04em;margin-top:2px;text-align:center;padding:0 3px}
    .cdb-tier .z{flex:1;display:flex;flex-wrap:wrap;gap:6px;padding:6px;align-items:center}
    .cdb-pion{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:10px;background:#111827;border:1px solid rgba(148,163,184,.3);color:#f1f5f9;font-size:12px;font-weight:700;cursor:pointer;user-select:none}
    .cdb-pion.sel{border-color:#f0abfc;box-shadow:0 0 0 2px rgba(240,171,252,.4),0 0 14px rgba(232,121,249,.5);transform:translateY(-2px)}
    .cdb-rang{flex:0 0 26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;background:#4c1d95;color:#fff;border:1px solid #a78bfa}
    .cdb-stamp{display:inline-block;padding:6px 16px;border:3px solid #fbbf24;border-radius:10px;color:#fde68a;font-weight:900;letter-spacing:.16em;font-size:12px;transform:rotate(-4deg);
        background:rgba(120,53,15,.35);box-shadow:0 0 22px rgba(251,191,36,.35)}
    .cdb-suspense{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(7,5,18,.94);color:#e9d5ff;font-weight:900;letter-spacing:.2em;font-size:13px}
    .cdb-suspense .urne{font-size:42px;animation:cdbSecoue .18s infinite alternate}
    @keyframes cdbSecoue{from{transform:rotate(-8deg) translateY(0)}to{transform:rotate(8deg) translateY(-3px)}}
    @keyframes cdbIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
    @keyframes cdbChute{0%{opacity:0;transform:translateY(-26px) scale(.7)}70%{opacity:1;transform:translateY(3px) scale(1.04)}100%{opacity:1;transform:none}}
    @keyframes cdbBarre{from{width:0}}
    @keyframes cdbOut{0%,80%{opacity:1}100%{opacity:0;visibility:hidden}}
    @keyframes cdbTampon{0%{opacity:0;transform:rotate(-4deg) scale(2.6)}60%{opacity:1;transform:rotate(-4deg) scale(.92)}100%{opacity:1;transform:rotate(-4deg) scale(1)}}
    @keyframes cdbLueur{0%,100%{box-shadow:0 0 0 1px #fbbf24,0 0 18px rgba(251,191,36,.35)}50%{box-shadow:0 0 0 2px #fde68a,0 0 34px rgba(251,191,36,.7)}}
    @keyframes cdbMonte{0%{opacity:0;transform:translateY(0) scale(.6)}12%{opacity:1;transform:translateY(-20px) scale(1.15)}100%{opacity:0;transform:translateY(-240px) scale(1)}}
    .cdb-anim .cdb-a{animation:cdbIn .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
    .cdb-anim .cdb-c{animation:cdbChute .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
    .cdb-anim .cdb-b{animation:cdbBarre 1.1s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
    .cdb-anim .cdb-suspense{animation:cdbOut ${CDB_SUSPENSE + .3}s ease both}
    .cdb-anim .cdb-stamp{animation:cdbTampon .45s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
    .cdb-or{animation:cdbLueur 1.6s ease-in-out infinite}
    .cdb-fige *,.cdb-fige{animation:none!important}
    .cdb-fige .cdb-suspense{display:none}
    .cdb-reac{position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden}
    .cdb-reac span{position:absolute;bottom:90px;font-size:34px;animation:cdbMonte 2.6s ease-out forwards;text-align:center}
    .cdb-reac span i{display:block;font-style:normal;font-size:10px;font-weight:800;color:#f5d0fe;text-shadow:0 0 4px #000}
    `;
    document.head.appendChild(st);
}

// ------------------------------- Outils -------------------------------
function cdbPoidsAleatoire(liste) {
    const tot = liste.reduce((t, x) => t + x[1], 0); let r = Math.random() * tot;
    for (const x of liste) { r -= x[1]; if (r <= 0) return x[0]; }
    return liste[liste.length - 1][0];
}
function cdbVus() { try { return JSON.parse(localStorage.getItem('lmlp-cdb-vus') || '[]'); } catch (e) { return []; } }
function cdbMemoriser(ids) {
    try { const v = cdbVus().filter(x => ids.indexOf(x) < 0).concat(ids); localStorage.setItem('lmlp-cdb-vus', JSON.stringify(v.slice(-450))); } catch (e) {}
}
// tire un élément d'une banque, en évitant ceux de la partie puis ceux des parties récentes
function cdbTirer(banque, prefixe, pris, vus) {
    const libres = banque.map((x, i) => i).filter(i => !pris.has(prefixe + i));
    const frais = libres.filter(i => vus.indexOf(prefixe + i) < 0);
    const pool = frais.length ? frais : (libres.length ? libres : banque.map((x, i) => i));
    const i = pool[Math.floor(Math.random() * pool.length)];
    pris.add(prefixe + i);
    return i;
}
function cdbTexte(rd, fort) {
    const b = s => fort ? `<b>${mchEsc(s)}</b>` : mchEsc(s);
    switch (rd.f) {
        case 'joueur': return `Qui à bord est le plus susceptible de ${b(rd.q)} ?`;
        case 'duel': return `Entre ${b(rd.duo[0])} et ${b(rd.duo[1])}, qui est le plus susceptible de ${b(rd.q)} ?`;
        case 'ordreEq': return `Classez l’équipage, du plus au moins susceptible de ${b(rd.q)}.`;
        case 'tierEq': return `Tier list de l’équipage : qui est susceptible de ${b(rd.q)} ?`;
        case 'tier': return `Tier list : ${b(rd.q)}`;
        case 'ordre': return `Classez : ${b(rd.q)}`;
        case 'dilemme': return `Tu préfères…`;
        case 'aveu': return `« ${b(rd.q)} »`;
    }
    return '';
}
function cdbEntete(rd) {
    const F = CDB_FORMATS[rd.f] || {};
    return `<div class="text-center space-y-3">
        <div class="cdb-chip">${F.i || ''} ${F.n || ''}</div>${rd.perso ? ' <div class="cdb-chip" style="border-color:#fbbf24;color:#fde68a;background:rgba(120,53,15,.35)">✍️ QUESTION DE L’ÉQUIPAGE</div>' : ''}
        <div class="cdb-q">${cdbTexte(rd, true)}</div>
    </div>`;
}
function cdbLibelleItem(rd, i) { return rd.i[i]; }
function cdbEstEquipage(rd) { return rd.f === 'ordreEq' || rd.f === 'tierEq'; }
function cdbPionHtml(rd, i, extra) {
    const nom = rd.i[i];
    return `${cdbEstEquipage(rd) ? mchPastille(nom, 22) : ''}<span>${mchEsc(nom)}</span>${extra || ''}`;
}
function cdbOrdreComplet(a, n) {
    const L = (Array.isArray(a) ? a : mchArr(a)).map(Number).filter(x => x >= 0 && x < n);
    const vus = new Set(), out = [];
    L.forEach(x => { if (!vus.has(x)) { vus.add(x); out.push(x); } });
    for (let i = 0; i < n; i++) if (!vus.has(i)) out.push(i);
    return out;
}
function cdbTiersDe(a, n) {    // chaîne de chiffres → tableau de tiers (non placé = B)
    const s = String(a == null ? '' : a);
    const out = [];
    for (let i = 0; i < n; i++) { const v = parseInt(s.charAt(i), 10); out.push(v >= 0 && v <= 4 ? v : 2); }
    return out;
}
function cdbVotesParCible(answers, names) {
    const v = {};
    names.forEach(n => { const a = answers[n]; if (!a || a.a === '' || a.a == null) return; const c = String(a.a); (v[c] = v[c] || []).push(n); });
    return v;
}
// moyennes : classement (position moyenne) ou tier (tier moyen)
function cdbConsensus(rd, answers, names) {
    const n = rd.i.length, somme = new Array(n).fill(0); let k = 0;
    const parJoueur = {};
    names.forEach(nm => {
        const a = answers[nm]; if (!a || a.a === '' || a.a == null) return;
        const v = rd.f === 'tier' || rd.f === 'tierEq' ? cdbTiersDe(a.a, n) : (() => { const o = cdbOrdreComplet(a.a, n), pos = new Array(n); o.forEach((it, p) => pos[it] = p); return pos; })();
        parJoueur[nm] = v; v.forEach((x, i) => somme[i] += x); k++;
    });
    const moy = somme.map(x => k ? x / k : 0);
    return { moy, parJoueur, k };
}

// ------------------------------- Réactions -------------------------------
function cdbReactions(g) {
    const R = (g.react && g.react['r' + g.round]) || {};
    window.cdbReacVues = window.cdbReacVues || {};
    let cadre = document.getElementById('cdb-reac');
    if (!cadre) { cadre = document.createElement('div'); cadre.id = 'cdb-reac'; cadre.className = 'cdb-reac'; document.body.appendChild(cadre); }
    Object.keys(R).sort().forEach(k => {
        if (window.cdbReacVues[k]) return; window.cdbReacVues[k] = 1;
        const t = parseInt(k, 10); if (!(Date.now() - t < 5000)) return;
        const r = R[k] || {}, e = document.createElement('span');
        e.style.left = (8 + Math.random() * 80) + '%';
        e.innerHTML = `${mchEsc(r.e || '👏')}<i>${mchEsc(r.n || '')}</i>`;
        cadre.appendChild(e); setTimeout(() => e.remove(), 2700);
        cdbSon('pop');
    });
}
window.cdbReagir = function(em) {
    const g = window.mchData && window.mchData.mancheGame; if (!g || g.phase !== 'REVEAL') return;
    const now = Date.now(); if (window.cdbDerReac && now - window.cdbDerReac < 500) return; window.cdbDerReac = now;
    const me = mchMe();
    window.update(window.ref(window.db, `salons/${mchRoom()}`), { [`mancheGame/react/r${g.round}/${now}_${mchNorm(me).slice(0, 12)}`]: { e: em, n: me } }).catch(() => {});
};

// ------------------------------- Questions personnalisées de l'hôte -------------------------------
// Une question par ligne :
//   « se perdre dans la station »            → situation (« Qui est le plus susceptible de… »)
//   « Pizza / Burger »                        → dilemme (« Tu préfères… »)
//   « J'ai déjà… » ou « Je… »                 → aveu anonyme
window.cdbLirePerso = function() {
    let txt = '';
    const el = document.getElementById('setting-cdb-perso');
    if (el) txt = el.value; else { try { txt = localStorage.getItem('lmlp-cdb-perso') || ''; } catch (e) {} }
    const out = { s: [], d: [], a: [] };
    String(txt).split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
        if (l.indexOf('/') > 0) { const [x, y] = l.split('/').map(v => v.trim()); if (x && y) out.d.push([x, y]); return; }
        if (/^(j['’]|je\s)/i.test(l)) { out.a.push(l.replace(/[.?!]+$/, '')); return; }
        let q = l.replace(/^qui (à bord )?est (le|la) plus susceptible d['e]\s*/i, '').replace(/[?.!]+$/, '').trim();
        if (q) out.s.push(q);
    });
    return out;
};
window.cdbSeulementPerso = function() {
    const el = document.getElementById('setting-cdb-seul');
    if (el) return !!el.checked;
    try { return localStorage.getItem('lmlp-cdb-seul') === '1'; } catch (e) { return false; }
};
// enregistre la saisie de l'hôte et met à jour le compteur
window.cdbMajPerso = function() {
    const el = document.getElementById('setting-cdb-perso'), seul = document.getElementById('setting-cdb-seul');
    try { if (el) localStorage.setItem('lmlp-cdb-perso', el.value); if (seul) localStorage.setItem('lmlp-cdb-seul', seul.checked ? '1' : '0'); } catch (e) {}
    const p = window.cdbLirePerso(), c = document.getElementById('setting-cdb-compte');
    if (c) c.textContent = `${p.s.length} situation${p.s.length > 1 ? 's' : ''} · ${p.d.length} dilemme${p.d.length > 1 ? 's' : ''} · ${p.a.length} aveu${p.a.length > 1 ? 'x' : ''}`;
};
window.cdbChargerPerso = function() {
    const el = document.getElementById('setting-cdb-perso'), seul = document.getElementById('setting-cdb-seul');
    try { if (el && !el.value) el.value = localStorage.getItem('lmlp-cdb-perso') || ''; if (seul) seul.checked = localStorage.getItem('lmlp-cdb-seul') === '1'; } catch (e) {}
    window.cdbMajPerso();
};

// ------------------------------- Mode -------------------------------
window.MANCHES_MODES.conseil = {
    title: 'Conseil de bord',
    minPlayers: 3, minRounds: 3, maxRounds: 12, defaultRounds: 10, revealSeconds: 12,

    prepare(count, names) {
        const n = names.length, vus = cdbVus(), pris = new Set(), rounds = [];
        // questions personnalisées de l'hôte : utilisées en priorité (et seules si « seulement mes questions »)
        const perso = window.cdbLirePerso ? window.cdbLirePerso() : { s: [], d: [], a: [] }, seul = window.cdbSeulementPerso && window.cdbSeulementPerso();
        const P = { s: mchShuffle(perso.s), d: mchShuffle(perso.d), a: mchShuffle(perso.a) };
        const typeDe = f => (f === 'dilemme' ? 'd' : f === 'aveu' ? 'a' : (f === 'tier' || f === 'ordre') ? 'x' : 's');
        let dispo = Object.keys(CDB_FORMATS).filter(f => n >= CDB_FORMATS[f].min).map(f => [f, CDB_FORMATS[f].poids]);
        const nbPerso = perso.s.length + perso.d.length + perso.a.length;
        if (seul && nbPerso) dispo = dispo.filter(x => { const t = typeDe(x[0]); return t !== 'x' && perso[t].length; });
        let prec = '';
        for (let r = 0; r < count; r++) {
            let choix = dispo.filter(x => x[0] !== prec); if (!choix.length) choix = dispo;
            // tant qu'il reste des questions personnalisées, on favorise leurs formats
            const avecPerso = choix.filter(x => { const t = typeDe(x[0]); return t !== 'x' && P[t].length; });
            if (avecPerso.length && (seul || Math.random() < .7)) choix = avecPerso;
            let f = r === 0 && (!seul || perso.s.length) && choix.some(x => x[0] === 'joueur') ? 'joueur' : cdbPoidsAleatoire(choix);
            prec = f;
            const rd = { f: f, t: CDB_FORMATS[f].t };
            const t = typeDe(f), pq = t !== 'x' && P[t].length ? P[t].shift() : null;
            if (pq != null) {          // question personnalisée
                if (t === 's') { rd.q = pq; rd.perso = 1; if (f === 'duel') rd.duo = mchShuffle(names).slice(0, 2); if (f === 'ordreEq' || f === 'tierEq') { rd.i = mchShuffle(names).slice(0, 8); rd.t += rd.i.length * 3; } }
                else if (t === 'd') { rd.o = Math.random() < .5 ? pq.slice() : pq.slice().reverse(); rd.perso = 1; }
                else { rd.q = pq; rd.perso = 1; }
                rounds.push(rd); continue;
            }
            if (seul && nbPerso) { P.s = mchShuffle(perso.s); P.d = mchShuffle(perso.d); P.a = mchShuffle(perso.a); r--; if (rounds.length >= count) break; continue; }   // on recycle les questions personnalisées
            if (f === 'joueur' || f === 'duel' || f === 'ordreEq' || f === 'tierEq') {
                rd.q = window.CDB_SUSCEPTIBLE[cdbTirer(window.CDB_SUSCEPTIBLE, 's', pris, vus)];
                if (f === 'duel') rd.duo = mchShuffle(names).slice(0, 2);
                if (f === 'ordreEq' || f === 'tierEq') { rd.i = mchShuffle(names).slice(0, 8); rd.t += rd.i.length * 3; }
            } else if (f === 'tier') {
                const k = cdbTirer(window.CDB_TIERS, 't', pris, vus); rd.q = window.CDB_TIERS[k].t; rd.i = mchShuffle(window.CDB_TIERS[k].i);
            } else if (f === 'ordre') {
                const k = cdbTirer(window.CDB_ORDRES, 'o', pris, vus); rd.q = window.CDB_ORDRES[k].t; rd.i = mchShuffle(window.CDB_ORDRES[k].i);
            } else if (f === 'dilemme') {
                const k = cdbTirer(window.CDB_DILEMMES, 'd', pris, vus); rd.o = Math.random() < .5 ? window.CDB_DILEMMES[k].slice() : window.CDB_DILEMMES[k].slice().reverse();
            } else if (f === 'aveu') {
                rd.q = window.CDB_AVEUX[cdbTirer(window.CDB_AVEUX, 'a', pris, vus)];
            }
            rounds.push(rd);
        }
        cdbMemoriser([...pris]);
        return rounds;
    },

    renderPlay(ctx) {
        cdbStyle();
        const rd = ctx.rd, el = ctx.el, me = ctx.me;
        const sel = window.cdbSel = { round: ctx.round, v: null };
        const go = (txt, actif) => `<button id="cdb-go" class="cdb-go" ${actif ? '' : 'disabled'}>${txt || 'Transmettre mon vote'}</button>`;
        const envoyer = v => { cdbSon('vote'); ctx.submit(v); };
        const carte = inner => `<div class="cdb-carte space-y-4">${cdbEntete(rd)}${inner}</div>`;

        if (rd.f === 'joueur' || rd.f === 'duel') {
            const cands = rd.f === 'duel' ? rd.duo : ctx.names;
            el.innerHTML = carte(`
                <div class="${rd.f === 'duel' ? 'grid grid-cols-2 gap-3 relative' : 'grid grid-cols-2 sm:grid-cols-3 gap-2'}">
                    ${cands.map(nm => `<button class="cdb-btn cdb-cand p-3 flex ${rd.f === 'duel' ? 'flex-col py-5' : ''} items-center gap-2 justify-center" data-n="${mchEsc(nm)}">
                        ${mchPastille(nm, rd.f === 'duel' ? 64 : 36)}<span class="font-bold ${rd.f === 'duel' ? 'text-lg' : 'text-sm'} truncate">${mchEsc(nm)}${nm === me ? ' <span class="text-[10px] text-fuchsia-300">(toi)</span>' : ''}</span></button>`).join('')}
                    ${rd.f === 'duel' ? '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:900;font-size:22px;color:#fde68a;text-shadow:0 0 14px #f59e0b;pointer-events:none">⚡VS⚡</div>' : ''}
                </div>
                ${go('', false)}
                <div class="text-[11px] text-slate-400 text-center">Vote secret · vous marquez si vous votez comme la majorité de l’équipage.</div>`);
            el.querySelectorAll('.cdb-cand').forEach(b => b.onclick = () => {
                el.querySelectorAll('.cdb-cand').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
                sel.v = b.dataset.n; document.getElementById('cdb-go').disabled = false; cdbSon('choix');
            });
            document.getElementById('cdb-go').onclick = () => { if (sel.v != null) envoyer(sel.v); };
        }
        else if (rd.f === 'dilemme') {
            el.innerHTML = carte(`
                <div class="grid sm:grid-cols-2 gap-3 relative">
                    ${rd.o.map((o, i) => `<button class="cdb-btn cdb-opt p-5 text-center" data-i="${i}">
                        <div class="text-[10px] font-black tracking-[.2em] ${i ? 'text-cyan-300' : 'text-fuchsia-300'}">OPTION ${i ? 'B' : 'A'}</div>
                        <div class="text-lg font-black text-white mt-1">${mchEsc(o)}</div></button>`).join('')}
                </div>
                ${go('Je choisis', false)}`);
            el.querySelectorAll('.cdb-opt').forEach(b => b.onclick = () => {
                el.querySelectorAll('.cdb-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
                sel.v = +b.dataset.i; document.getElementById('cdb-go').disabled = false; cdbSon('choix');
            });
            document.getElementById('cdb-go').onclick = () => { if (sel.v != null) envoyer(sel.v); };
        }
        else if (rd.f === 'aveu') {
            const N = ctx.names.length;
            sel.v = { r: null, g: null };
            el.innerHTML = carte(`
                <div class="text-[11px] text-center text-slate-300">Personne ne saura ce que vous avez répondu : seul le nombre d’aveux sera révélé.</div>
                <div class="grid grid-cols-2 gap-3">
                    <button class="cdb-btn cdb-rep p-4 font-black text-lg" data-r="1">✅ OUI<div class="text-[10px] font-bold text-slate-400 tracking-wide">c’est déjà arrivé</div></button>
                    <button class="cdb-btn cdb-rep p-4 font-black text-lg" data-r="0">❌ NON<div class="text-[10px] font-bold text-slate-400 tracking-wide">jamais de la vie</div></button>
                </div>
                <div id="cdb-pari" class="space-y-2" style="opacity:.35;pointer-events:none">
                    <div class="text-center text-sm font-bold text-fuchsia-200">Combien de membres de l’équipage ont répondu OUI ? <span class="text-slate-400 font-normal">(toi compris, sur ${N})</span></div>
                    <div class="flex flex-wrap gap-1.5 justify-center">${Array.from({ length: N + 1 }, (x, k) => `<button class="cdb-btn cdb-nb w-11 h-11 font-black text-lg" data-k="${k}">${k}</button>`).join('')}</div>
                </div>
                ${go('Envoyer mon aveu', false)}`);
            const maj = () => { document.getElementById('cdb-go').disabled = !(sel.v.r != null && sel.v.g != null); };
            el.querySelectorAll('.cdb-rep').forEach(b => b.onclick = () => {
                el.querySelectorAll('.cdb-rep').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel.v.r = +b.dataset.r;
                const p = document.getElementById('cdb-pari'); p.style.opacity = 1; p.style.pointerEvents = ''; cdbSon('choix'); maj();
            });
            el.querySelectorAll('.cdb-nb').forEach(b => b.onclick = () => {
                el.querySelectorAll('.cdb-nb').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel.v.g = +b.dataset.k; cdbSon('choix'); maj();
            });
            document.getElementById('cdb-go').onclick = () => { if (sel.v.r != null && sel.v.g != null) envoyer(sel.v); };
        }
        else if (rd.f === 'ordre' || rd.f === 'ordreEq') {
            sel.v = [];
            const dessiner = () => {
                const n = rd.i.length;
                el.innerHTML = carte(`
                    <div class="text-[11px] text-center text-slate-300">Touchez dans l’ordre, du <b class="text-fuchsia-200">premier</b> au <b class="text-cyan-200">dernier</b>. Touchez de nouveau pour retirer.</div>
                    <div class="grid gap-2">${rd.i.map((x, i) => { const p = sel.v.indexOf(i);
                        return `<button class="cdb-btn cdb-it flex items-center gap-3 px-3 py-2.5 text-left ${p >= 0 ? 'sel' : ''}" data-i="${i}">
                            <span class="cdb-rang" style="${p >= 0 ? '' : 'background:#0f172a;border-color:#334155;color:#475569'}">${p >= 0 ? p + 1 : '·'}</span>
                            ${cdbEstEquipage(rd) ? mchPastille(x, 28) : ''}<span class="font-bold text-sm">${mchEsc(x)}</span></button>`; }).join('')}</div>
                    <div class="flex gap-2"><button id="cdb-raz" class="cdb-btn px-4 text-xs font-bold">Effacer</button>${go('Valider mon classement', sel.v.length === n)}</div>`);
                el.querySelectorAll('.cdb-it').forEach(b => b.onclick = () => {
                    const i = +b.dataset.i, p = sel.v.indexOf(i);
                    if (p >= 0) sel.v.splice(p, 1); else sel.v.push(i);
                    if (sel.v.length === n - 1) { for (let k = 0; k < n; k++) if (sel.v.indexOf(k) < 0) { sel.v.push(k); break; } }   // le dernier se place tout seul
                    cdbSon('choix'); dessiner();
                });
                document.getElementById('cdb-raz').onclick = () => { sel.v = []; dessiner(); };
                document.getElementById('cdb-go').onclick = () => { if (sel.v.length === n) envoyer(sel.v.slice()); };
            };
            dessiner();
        }
        else if (rd.f === 'tier' || rd.f === 'tierEq') {
            const n = rd.i.length, noms = rd.f === 'tierEq' ? CDB_TIERS_EQ : CDB_TIERS_OBJ;
            sel.v = new Array(n).fill(9); let choisi = -1;
            const dessiner = () => {
                const pion = i => `<span class="cdb-pion ${choisi === i ? 'sel' : ''}" data-i="${i}">${cdbPionHtml(rd, i)}</span>`;
                const reste = sel.v.map((t, i) => t === 9 ? i : -1).filter(i => i >= 0);
                el.innerHTML = carte(`
                    <div class="text-[11px] text-center text-slate-300">Touchez un élément, puis la rangée où le placer.</div>
                    <div class="space-y-1.5">${CDB_TIERS_NOMS.map((T, t) => `
                        <div class="cdb-tier" data-t="${t}"><div class="l" style="background:${CDB_TIERS_COUL[t]}">${T}<small>${noms[t]}</small></div>
                            <div class="z">${sel.v.map((x, i) => x === t ? pion(i) : '').join('')}</div></div>`).join('')}</div>
                    <div class="p-2 rounded-xl border border-dashed border-slate-600 min-h-[48px] flex flex-wrap gap-1.5 items-center" data-t="9">
                        ${reste.length ? reste.map(pion).join('') : '<span class="text-[11px] text-emerald-300 mx-auto">Tout est classé ✓</span>'}</div>
                    ${go('Valider ma tier list', reste.length === 0)}`);
                el.querySelectorAll('.cdb-pion').forEach(p => p.onclick = e => {
                    e.stopPropagation(); const i = +p.dataset.i;
                    if (choisi >= 0 && choisi !== i) {          // un élément est en main : on le dépose dans la rangée touchée
                        const z = p.closest('[data-t]'); if (z) { sel.v[choisi] = +z.dataset.t; choisi = sel.v.findIndex(x => x === 9); cdbSon('case'); dessiner(); return; }
                    }
                    choisi = choisi === i ? -1 : i; cdbSon('choix'); dessiner();
                });
                el.querySelectorAll('[data-t]').forEach(z => z.onclick = () => {
                    if (choisi < 0) return; sel.v[choisi] = +z.dataset.t;
                    // on enchaîne avec le prochain élément à classer
                    const suiv = sel.v.findIndex(x => x === 9); choisi = suiv; cdbSon('case'); dessiner();
                });
                document.getElementById('cdb-go').onclick = () => { if (sel.v.every(x => x !== 9)) envoyer(sel.v.join('')); };
            };
            choisi = 0; dessiner();
        }
    },

    onTimeout(ctx) {
        const s = window.cdbSel, rd = ctx.rd;
        if (!s || s.round !== ctx.round || s.v == null) return '';
        if (rd.f === 'aveu') return s.v.r == null ? '' : { r: s.v.r, g: s.v.g == null ? 0 : s.v.g };
        if (rd.f === 'ordre' || rd.f === 'ordreEq') return s.v.length ? cdbOrdreComplet(s.v, rd.i.length) : '';
        if (rd.f === 'tier' || rd.f === 'tierEq') return s.v.some(x => x !== 9) ? s.v.map(x => x === 9 ? 2 : x).join('') : '';
        return s.v;
    },

    describe(a, ctx) {
        const rd = ctx.rd;
        if (a === '' || a == null) return 'Aucun vote transmis.';
        if (rd.f === 'joueur' || rd.f === 'duel') return `Vous avez voté pour <b class="text-white">${mchEsc(a)}</b>.`;
        if (rd.f === 'dilemme') return `Votre choix : <b class="text-white">${mchEsc(rd.o[+a])}</b>`;
        if (rd.f === 'aveu') return `Aveu enregistré 🤫 · votre pari : <b class="text-white">${mchEsc(a.g)}</b> aveu${a.g > 1 ? 'x' : ''}`;
        if (rd.f === 'ordre' || rd.f === 'ordreEq') return 'Classement transmis : ' + cdbOrdreComplet(a, rd.i.length).map((i, p) => `${p + 1}. ${mchEsc(rd.i[i])}`).join(' · ');
        return 'Tier list transmise au Conseil.';
    },

    score({ rd, answers, names }) {
        const p = {}; names.forEach(n => p[n] = { pts: 0 });
        const repondu = names.filter(n => answers[n] && answers[n].a !== '' && answers[n].a != null);
        if (rd.f === 'joueur' || rd.f === 'duel' || rd.f === 'dilemme') {
            const v = cdbVotesParCible(answers, names), max = Math.max(0, ...Object.values(v).map(x => x.length));
            const gagnants = Object.keys(v).filter(k => v[k].length === max);
            if (rd.f === 'dilemme' && gagnants.length > 1) repondu.forEach(n => p[n] = { pts: 50 });
            else gagnants.forEach(k => v[k].forEach(n => p[n] = { pts: 100, maj: 1 }));
        } else if (rd.f === 'aveu') {
            const oui = repondu.filter(n => +answers[n].a.r === 1).length;
            repondu.forEach(n => { const d = Math.abs((+answers[n].a.g || 0) - oui); p[n] = { pts: d === 0 ? 150 : d === 1 ? 60 : 0, ex: d === 0 ? 1 : 0 }; });
        } else {
            const C = cdbConsensus(rd, answers, names), n = rd.i.length;
            const tier = rd.f === 'tier' || rd.f === 'tierEq';
            const ref = tier ? C.moy : (() => { const o = C.moy.map((m, i) => [m, i]).sort((a, b) => a[0] - b[0]), pos = new Array(n); o.forEach((x, k) => pos[x[1]] = k); return pos; })();
            const maxD = tier ? 2 * n : Math.floor(n * n / 2) || 1;
            Object.keys(C.parJoueur).forEach(nm => {
                const d = C.parJoueur[nm].reduce((t, x, i) => t + Math.abs(x - ref[i]), 0);
                p[nm] = { pts: Math.round(150 * Math.max(0, 1 - d / maxD)) };
            });
        }
        return { p: p, info: {} };
    },

    renderReveal({ rd, answers, res, me, names, g }) {
        cdbStyle();
        const cle = (g.startedAt || 0) + ':' + g.round;
        const premiere = window.cdbRevealVu !== cle;
        if (premiere) {
            window.cdbRevealVu = cle;
            cdbSon('roulement');
            setTimeout(() => cdbSon(rd.f === 'joueur' || rd.f === 'duel' ? 'tampon' : 'verdict'), CDB_SUSPENSE * 1000);
            if (rd.f === 'tier' || rd.f === 'tierEq') for (let k = 0; k < rd.i.length; k++) setTimeout(() => cdbSon('case'), (CDB_SUSPENSE + .5 + k * .28) * 1000);
            if (rd.f === 'ordre' || rd.f === 'ordreEq') for (let k = 0; k < rd.i.length; k++) setTimeout(() => cdbSon('case'), (CDB_SUSPENSE + .4 + k * .45) * 1000);
        }
        setTimeout(() => { cdbReactions(g); cdbCompteur(premiere); }, 0);
        const S = CDB_SUSPENSE, D = x => `--d:${(S + x).toFixed(2)}s`;
        const repondu = names.filter(n => answers[n] && answers[n].a !== '' && answers[n].a != null);
        let corps = '';

        if (rd.f === 'joueur' || rd.f === 'duel') {
            const v = cdbVotesParCible(answers, names);
            const cands = rd.f === 'duel' ? rd.duo.slice() : Object.keys(v);
            const max = Math.max(0, ...cands.map(c => (v[c] || []).length));
            const tri = cands.sort((a, b) => (v[b] || []).length - (v[a] || []).length);
            const elus = tri.filter(c => max > 0 && (v[c] || []).length === max);
            if (!repondu.length) corps = `<div class="text-center text-slate-400 italic">Aucun vote : le Conseil est resté muet.</div>`;
            else if (rd.f === 'duel') {
                const [A, B] = rd.duo, na = (v[A] || []).length, nb = (v[B] || []).length, tot = Math.max(1, na + nb), pa = Math.round(100 * na / tot);
                const cote = (nm, k, pct, d) => `<div class="cdb-a flex flex-col items-center gap-2 ${elus.indexOf(nm) >= 0 && elus.length === 1 ? 'cdb-or' : ''} rounded-2xl p-3" style="${D(d)}">
                    ${mchPastille(nm, 60)}<div class="font-black text-white">${mchEsc(nm)}</div>
                    <div class="text-2xl font-black ${k === Math.max(na, nb) ? 'text-amber-300' : 'text-slate-400'}">${k} vote${k > 1 ? 's' : ''}</div>
                    <div class="flex flex-wrap justify-center gap-1">${(v[nm] || []).map(x => mchPastille(x, 18)).join('')}</div></div>`;
                corps = `<div class="grid grid-cols-2 gap-3">${cote(A, na, pa, 0)}${cote(B, nb, 100 - pa, .15)}</div>
                    <div class="h-4 rounded-full overflow-hidden flex border border-slate-700 bg-slate-900">
                        <div class="cdb-b h-full" style="width:${pa}%;background:linear-gradient(90deg,#c026d3,#f0abfc);${D(.3)}"></div>
                        <div class="cdb-b h-full" style="width:${100 - pa}%;background:linear-gradient(90deg,#67e8f9,#0891b2);${D(.3)}"></div></div>`;
            } else {
                corps = `<div class="space-y-2">${tri.map((c, k) => {
                    const nb = (v[c] || []).length, elu = elus.indexOf(c) >= 0;
                    return `<div class="cdb-a flex items-center gap-3 p-2 rounded-xl ${elu ? 'cdb-or bg-amber-950/30' : 'bg-slate-900/70'}" style="${D(.15 * (tri.length - 1 - k))}">
                        <div class="relative">${mchPastille(c, 40)}${elu ? '<span style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:16px">👑</span>' : ''}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between text-sm"><b class="text-white truncate">${mchEsc(c)}</b><span class="font-mono ${elu ? 'text-amber-300' : 'text-slate-400'}">${nb} vote${nb > 1 ? 's' : ''}</span></div>
                            <div class="h-2 mt-1 rounded-full bg-slate-800 overflow-hidden"><div class="cdb-b h-full rounded-full" style="width:${Math.round(100 * nb / Math.max(1, max))}%;background:${elu ? 'linear-gradient(90deg,#f59e0b,#fde68a)' : 'linear-gradient(90deg,#7c3aed,#c084fc)'};${D(.3 + .1 * k)}"></div></div>
                            <div class="flex flex-wrap gap-1 mt-1 cdb-a" style="${D(1.1)}">${(v[c] || []).map(x => mchPastille(x, 16)).join('')}</div>
                        </div></div>`; }).join('')}</div>`;
            }
            if (elus.length) corps += `<div class="text-center pt-1"><span class="cdb-stamp" style="${D(elus.length === 1 ? .9 : .6)}">${elus.length === 1
                ? `🏅 TITRE DÉCERNÉ À ${mchEsc(elus[0]).toUpperCase()}` : `⚖️ ÉGALITÉ : ${elus.map(mchEsc).join(' & ').toUpperCase()}`}</span></div>`;
        }
        else if (rd.f === 'dilemme') {
            const v = cdbVotesParCible(answers, names), na = (v['0'] || []).length, nb = (v['1'] || []).length, tot = Math.max(1, na + nb);
            const opt = (i, k, d) => { const pct = Math.round(100 * k / tot), gag = k > (i ? na : nb);
                return `<div class="cdb-a p-3 rounded-xl ${gag ? 'cdb-or bg-amber-950/25' : 'bg-slate-900/70'}" style="${D(d)}">
                    <div class="flex justify-between gap-2 items-baseline"><b class="text-white">${mchEsc(rd.o[i])}</b><span class="text-2xl font-black ${gag ? 'text-amber-300' : 'text-slate-400'}">${pct}%</span></div>
                    <div class="h-2.5 mt-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="cdb-b h-full rounded-full" style="width:${pct}%;background:${i ? 'linear-gradient(90deg,#0891b2,#67e8f9)' : 'linear-gradient(90deg,#a21caf,#f0abfc)'};${D(d + .2)}"></div></div>
                    <div class="flex flex-wrap gap-1 mt-1.5">${(v[String(i)] || []).map(x => mchPastille(x, 18)).join('')}</div></div>`; };
            const rebelle = (na === 1 && nb >= 2) ? v['0'][0] : (nb === 1 && na >= 2) ? v['1'][0] : null;
            corps = `<div class="space-y-2">${opt(0, na, 0)}${opt(1, nb, .15)}</div>
                ${na === nb ? `<div class="text-center"><span class="cdb-stamp" style="${D(.8)}">⚖️ ÉQUIPAGE DIVISÉ</span></div>` : ''}
                ${rebelle ? `<div class="cdb-a text-center text-sm text-fuchsia-200" style="${D(1)}">🦄 Esprit rebelle : <b>${mchEsc(rebelle)}</b> est seul de son avis !</div>` : ''}`;
        }
        else if (rd.f === 'aveu') {
            const oui = repondu.filter(n => +answers[n].a.r === 1).length, tot = repondu.length;
            const exacts = repondu.filter(n => (+answers[n].a.g || 0) === oui);
            corps = `<div class="cdb-a text-center" style="${D(0)}">
                    <div class="text-[11px] tracking-[.2em] text-slate-400 font-bold">AVEUX ENREGISTRÉS</div>
                    <div class="text-6xl font-black text-white" style="text-shadow:0 0 30px rgba(232,121,249,.6)"><span id="cdb-compte" data-c="${oui}">${oui}</span><span class="text-2xl text-slate-500"> / ${tot}</span></div>
                    <div class="text-sm text-fuchsia-200">membre${oui > 1 ? 's' : ''} de l’équipage ${oui > 1 ? 'ont' : 'a'} avoué 🤫</div></div>
                <div class="cdb-a grid grid-cols-2 sm:grid-cols-4 gap-1.5" style="${D(1.2)}">${repondu.map(n => { const gs = +answers[n].a.g || 0, ok = gs === oui;
                    return `<div class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${ok ? 'bg-emerald-950/50 border border-emerald-500/50' : 'bg-slate-900 border border-slate-800'}">${mchPastille(n, 18)}<span class="truncate flex-1">${mchEsc(n)}</span><b class="${ok ? 'text-emerald-300' : 'text-slate-400'}">${gs}${ok ? ' ✓' : ''}</b></div>`; }).join('')}</div>
                ${exacts.length ? `<div class="text-center"><span class="cdb-stamp" style="${D(1.6)}">🔮 ${exacts.length > 1 ? 'MÉDIUMS' : 'MÉDIUM'} : ${exacts.map(mchEsc).join(', ').toUpperCase()}</span></div>` : ''}`;
        }
        else {
            const C = cdbConsensus(rd, answers, names), n = rd.i.length, tier = rd.f === 'tier' || rd.f === 'tierEq';
            const mien = C.parJoueur[me];
            if (!C.k) corps = `<div class="text-center text-slate-400 italic">Aucune réponse : le Conseil est resté muet.</div>`;
            else if (tier) {
                const noms = rd.f === 'tierEq' ? CDB_TIERS_EQ : CDB_TIERS_OBJ;
                const final = C.moy.map(m => Math.max(0, Math.min(4, Math.round(m))));
                let rang = 0;
                corps = `<div class="space-y-1.5">${CDB_TIERS_NOMS.map((T, t) => {
                    const ici = final.map((x, i) => x === t ? i : -1).filter(i => i >= 0).sort((a, b) => C.moy[a] - C.moy[b]);
                    return `<div class="cdb-tier cdb-a" style="cursor:default;${D(.05 * t)}"><div class="l" style="background:${CDB_TIERS_COUL[t]}">${T}<small>${noms[t]}</small></div>
                        <div class="z">${ici.map(i => `<span class="cdb-pion cdb-c" style="cursor:default;${D(.5 + .28 * rang++)}">${cdbPionHtml(rd, i, mien ? `<span class="text-[9px] font-black ml-1 px-1 rounded" style="background:${CDB_TIERS_COUL[mien[i]]};color:#0b0b14" title="ton classement">${CDB_TIERS_NOMS[mien[i]]}</span>` : '')}</span>`).join('')}</div></div>`; }).join('')}</div>
                    ${mien ? '<div class="text-[10px] text-center text-slate-500">La petite étiquette indique ton propre classement.</div>' : ''}`;
            } else {
                const ordre = C.moy.map((m, i) => [m, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
                corps = `<div class="space-y-1.5">${ordre.map((i, p) => {
                    const moiP = mien ? mien[i] + 1 : null, top = p === 0;
                    return `<div class="cdb-a flex items-center gap-3 px-3 py-2 rounded-xl ${top ? 'cdb-or bg-amber-950/30' : 'bg-slate-900/70'}" style="${D(.4 + .45 * (n - 1 - p))}">
                        <span class="cdb-rang" style="${top ? 'background:#f59e0b;border-color:#fde68a;color:#1c1917' : ''}">${p + 1}</span>
                        ${cdbEstEquipage(rd) ? mchPastille(rd.i[i], 30) : ''}<b class="flex-1 text-white text-sm">${mchEsc(rd.i[i])}${top ? ' 👑' : ''}</b>
                        ${moiP ? `<span class="text-[10px] font-mono ${moiP === p + 1 ? 'text-emerald-300' : 'text-slate-500'}">toi : ${moiP}${moiP === 1 ? 'er' : 'e'}</span>` : ''}</div>`; }).join('')}</div>`;
            }
        }

        const pts = (res[me] && res[me].pts) || 0;
        return `<div class="cdb-carte space-y-4 ${premiere ? 'cdb-anim' : 'cdb-fige'}">
            <div class="cdb-suspense"><div class="urne">🗳️</div>DÉPOUILLEMENT DU CONSEIL…</div>
            ${cdbEntete(rd)}
            ${corps}
            ${names.indexOf(me) >= 0 ? `<div class="cdb-a text-center text-sm" style="${D(1.4)}">${pts > 0 ? `<span class="text-emerald-300 font-black">+${pts} pts</span> <span class="text-slate-400">· en phase avec l’équipage</span>` : '<span class="text-slate-400">Pas de point cette fois : l’équipage pensait autrement.</span>'}</div>` : ''}
            <div class="flex justify-center gap-1.5 flex-wrap pt-1">${CDB_REACTIONS.map(e => `<button onclick="cdbReagir('${e}')" class="cdb-btn w-11 h-11 text-xl">${e}</button>`).join('')}</div>
        </div>`;
    }
};

// compteur animé des aveux (seulement à la première apparition)
function cdbCompteur(premiere) {
    const el = document.getElementById('cdb-compte'); if (!el) return;
    const cible = +el.dataset.c || 0;
    if (!premiere || window.cdbCompteurVu === window.cdbRevealVu) { el.textContent = cible; return; }
    window.cdbCompteurVu = window.cdbRevealVu;
    el.textContent = 0; let k = 0;
    const t0 = setTimeout(function pas() {
        const e = document.getElementById('cdb-compte'); if (!e) return;
        if (k >= cible) { e.textContent = cible; return; }
        k++; e.textContent = k; cdbSon('compte'); setTimeout(pas, Math.max(90, 520 / Math.max(1, cible)));
    }, CDB_SUSPENSE * 1000 + 300);
}
