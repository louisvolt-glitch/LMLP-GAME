// =====================================================================
//  CHARGE INSTABLE — deuxième série de 20 modules (logique, manuel et 3D)
//  À charger après desamorcage-donnees.js (et après desamorcage-3d.js pour la 3D).
// =====================================================================
(function () {
const W = typeof window !== 'undefined' ? window : globalThis;
const DS = W.DS; if (!DS) return;
const { esc, pastille, regles, evalRegles, nb } = DS.outils;
const COUL = DS.COUL;
Object.assign(COUL, { rose: '#f472b6', brun: '#92400e', gris: '#9ca3af', argent: '#cbd5e1' });
const M = DS.MODULES;
const ajout = m => { if (!M.some(x => x.id === m.id)) M.push(m); };

// image du manuel dessinée avec la même fonction que l'écran 3D (dans le navigateur seulement)
function img(w, h, dessin, cls) {
    if (typeof document === 'undefined') return '';
    try { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const x = c.getContext('2d'); x.scale(2, 2); dessin(x, w, h); return `<img src="${c.toDataURL()}" width="${w}" height="${h}" class="${cls || ''}" style="vertical-align:middle;border-radius:8px" alt="">`; } catch (e) { return ''; }
}
function rond(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// ------------------------------- Illustrations partagées -------------------------------
const ASTRES = ['soleil', 'comète', 'géante gazeuse', 'planète rouge', 'lune', 'planète glacée', 'Terre'];
function dessAstre(ctx, t, cx, cy, r) {
    ctx.save();
    if (t === 'soleil') { ctx.strokeStyle = '#fde047'; ctx.lineWidth = r * .12; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * .75, cy + Math.sin(a) * r * .75); ctx.lineTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05); ctx.stroke(); } rond(ctx, cx, cy, r * .62, '#facc15'); rond(ctx, cx - r * .15, cy - r * .15, r * .3, '#fef08a'); }
    else if (t === 'comète') { const g = ctx.createLinearGradient(cx + r, cy - r * .6, cx - r * .2, cy + r * .1); g.addColorStop(0, 'rgba(147,197,253,0)'); g.addColorStop(1, 'rgba(191,219,254,.9)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - r * .3, cy - r * .1); ctx.lineTo(cx + r, cy - r * .9); ctx.lineTo(cx + r * .1, cy + r * .35); ctx.closePath(); ctx.fill(); rond(ctx, cx - r * .3, cy + r * .2, r * .32, '#e0f2fe'); }
    else if (t === 'géante gazeuse') { rond(ctx, cx, cy, r * .75, '#fb923c'); ctx.fillStyle = '#c2410c'; [-.35, 0, .3].forEach(d => ctx.fillRect(cx - r * .72, cy + d * r - r * .06, r * 1.44, r * .12)); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = r * .08; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.05, r * .28, -.35, 0, Math.PI * 2); ctx.stroke(); }
    else if (t === 'planète rouge') { rond(ctx, cx, cy, r * .75, '#dc2626'); rond(ctx, cx - r * .25, cy - r * .2, r * .14, '#7f1d1d'); rond(ctx, cx + r * .3, cy + r * .15, r * .1, '#7f1d1d'); rond(ctx, cx - r * .05, cy + r * .38, r * .08, '#7f1d1d'); }
    else if (t === 'lune') { rond(ctx, cx, cy, r * .72, '#9ca3af'); rond(ctx, cx - r * .2, cy - r * .15, r * .16, '#6b7280'); rond(ctx, cx + r * .28, cy + r * .2, r * .12, '#6b7280'); rond(ctx, cx + r * .2, cy - r * .35, r * .07, '#6b7280'); }
    else if (t === 'planète glacée') { rond(ctx, cx, cy, r * .75, '#7dd3fc'); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(cx, cy - r * .58, r * .42, r * .16, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy + r * .6, r * .36, r * .13, 0, 0, Math.PI * 2); ctx.fill(); }
    else { rond(ctx, cx, cy, r * .75, '#2563eb'); ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(cx - r * .2, cy - r * .1, r * .28, r * .2, .5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + r * .3, cy + r * .25, r * .2, r * .14, -.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
}
const PLANETES = [['Ardéa', 'bleu', 'anneau', 0, 4.2], ['Bryss', 'rouge', 'lisse', 2, 1.1], ['Cétali', 'vert', 'anneau', 1, 7.8], ['Dorne', 'violet', 'lisse', 0, 2.6], ['Elyra', 'orange', 'bandes', 1, 12.4],
    ['Fenrix', 'blanc', 'anneau', 2, 0.4], ['Gaïon', 'jaune', 'bandes', 0, 9.1], ['Hélvar', 'cyan', 'lisse', 1, 5.5], ['Isk', 'rose', 'anneau', 1, 3.3], ['Jovane', 'brun', 'bandes', 2, 15.7]];
function dessPlanete(ctx, k, cx, cy, r) {
    const [, c, f, lunes] = PLANETES[k], col = COUL[c];
    if (f === 'anneau') { ctx.strokeStyle = 'rgba(226,232,240,.85)'; ctx.lineWidth = r * .1; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.1, r * .32, -.3, Math.PI, Math.PI * 2); ctx.stroke(); }
    rond(ctx, cx, cy, r * .7, col);
    if (f === 'bandes') { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * .7, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,.28)'; [-.32, .02, .34].forEach(d => ctx.fillRect(cx - r, cy + d * r - r * .07, r * 2, r * .14)); ctx.restore(); }
    if (f === 'anneau') { ctx.strokeStyle = 'rgba(226,232,240,.85)'; ctx.lineWidth = r * .1; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.1, r * .32, -.3, 0, Math.PI); ctx.stroke(); }
    for (let l = 0; l < lunes; l++) rond(ctx, cx + r * (.95 - l * .35), cy - r * (.85 + l * .1), r * .12, '#e5e7eb');
}
const PHASES = ['nouvelle lune', 'premier croissant', 'premier quartier', 'gibbeuse croissante', 'pleine lune', 'gibbeuse décroissante', 'dernier quartier', 'dernier croissant'];
function dessPhase(ctx, k, cx, cy, r) {
    rond(ctx, cx, cy, r, '#1f2937');
    ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(1, r * .05); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (k === 0) return;
    if (k === 4) { rond(ctx, cx, cy, r, '#f1f5f9'); return; }
    const droite = k < 4, frac = [0, .25, .5, .75, 1, .75, .5, .25][k];   // partie éclairée
    ctx.save(); ctx.fillStyle = '#f1f5f9'; ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !droite);                // demi-disque du côté éclairé
    const e = Math.abs(1 - 2 * frac) * r;                                   // terminateur elliptique
    ctx.ellipse(cx, cy, e, r, 0, Math.PI / 2, -Math.PI / 2, frac > .5 ? !droite : droite);
    ctx.fill(); ctx.restore();
}
const VAISSEAUX = ['navette', 'cargo', 'sonde', 'chasseur'];
function dessVaisseau(ctx, t, cx, cy, s, c) {
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * .06;
    ctx.beginPath();
    if (t === 'navette') { ctx.moveTo(0, -s * .5); ctx.quadraticCurveTo(s * .22, -s * .1, s * .2, s * .35); ctx.lineTo(s * .45, s * .45); ctx.lineTo(-s * .45, s * .45); ctx.lineTo(-s * .2, s * .35); ctx.quadraticCurveTo(-s * .22, -s * .1, 0, -s * .5); ctx.fill(); }
    else if (t === 'cargo') { ctx.fillRect(-s * .45, -s * .22, s * .9, s * .44); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-s * .3, -s * .22, s * .06, s * .44); ctx.fillRect(0, -s * .22, s * .06, s * .44); ctx.fillStyle = c; ctx.fillRect(s * .45, -s * .1, s * .1, s * .2); }
    else if (t === 'sonde') { ctx.arc(0, 0, s * .16, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * .5, 0); ctx.lineTo(s * .5, 0); ctx.moveTo(0, -s * .5); ctx.lineTo(0, -s * .16); ctx.stroke(); ctx.fillRect(-s * .52, -s * .12, s * .16, s * .24); ctx.fillRect(s * .36, -s * .12, s * .16, s * .24); }
    else { ctx.moveTo(0, -s * .5); ctx.lineTo(s * .5, s * .4); ctx.lineTo(0, s * .2); ctx.lineTo(-s * .5, s * .4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
}
const GREC = [['α', 'alpha'], ['β', 'bêta'], ['γ', 'gamma'], ['δ', 'delta'], ['ε', 'epsilon'], ['ζ', 'zêta'], ['η', 'êta'], ['θ', 'thêta']];
const COMBI = ['casque', 'gants', 'bottes', 'réservoir'];
function dessCombi(ctx, t, cx, cy, s, c) {
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * .08; ctx.beginPath();
    if (t === 'casque') { ctx.arc(0, 0, s * .4, Math.PI * .9, Math.PI * .1); ctx.lineTo(s * .4, s * .3); ctx.lineTo(-s * .4, s * .3); ctx.closePath(); ctx.stroke(); ctx.fillRect(-s * .25, -s * .1, s * .5, s * .2); }
    else if (t === 'gants') { ctx.fillRect(-s * .22, -s * .05, s * .44, s * .4); [-.2, -.07, .06, .19].forEach(x => ctx.fillRect(x * s, -s * .35, s * .09, s * .32)); ctx.fillRect(s * .22, 0, s * .16, s * .09); }
    else if (t === 'bottes') { ctx.moveTo(-s * .15, -s * .4); ctx.lineTo(s * .1, -s * .4); ctx.lineTo(s * .1, s * .15); ctx.lineTo(s * .4, s * .22); ctx.lineTo(s * .4, s * .38); ctx.lineTo(-s * .15, s * .38); ctx.closePath(); ctx.fill(); }
    else { ctx.fillRect(-s * .18, -s * .3, s * .36, s * .65); ctx.beginPath(); ctx.arc(0, -s * .3, s * .18, Math.PI, 0); ctx.fill(); ctx.fillRect(-s * .06, -s * .5, s * .12, s * .1); }
    ctx.restore();
}
// chiffres xénolithes : un trait = 5, un point = 1, une coquille = 0
function dessChiffreX(ctx, n, cx, cy, s, c) {
    ctx.save(); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * .07;
    if (n === 0) { ctx.beginPath(); ctx.ellipse(cx, cy, s * .32, s * .18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * .22, cy); ctx.quadraticCurveTo(cx, cy - s * .12, cx + s * .22, cy); ctx.stroke(); ctx.restore(); return; }
    const barres = Math.floor(n / 5), points = n % 5, h = barres * s * .16 + (points ? s * .2 : 0);
    let y = cy - h / 2;
    if (points) { for (let k = 0; k < points; k++) rond(ctx, cx + (k - (points - 1) / 2) * s * .18, y + s * .07, s * .065, c); y += s * .2; }
    for (let k = 0; k < barres; k++) { ctx.fillRect(cx - s * .38, y, s * .76, s * .1); y += s * .16; }
    ctx.restore();
}

// =====================================================================
//  ★ — 1. Commutateurs de pont
// =====================================================================
const COM_COUL = ['rouge', 'bleu', 'vert', 'jaune', 'blanc'];
ajout({
    id: 'commutateurs', nom: 'Commutateurs de pont', diff: 1,
    gen(R) { return { s: [0, 1, 2, 3, 4].map(() => ({ c: R.pick(COM_COUL), h: R() < .5 })) }; },
    voulu(st, E) { const v = []; st.s.forEach((s, i) => { v[i] = s.c === 'rouge' ? true : s.c === 'bleu' ? false : s.c === 'vert' ? E.cellules >= 1 : s.c === 'jaune' ? !E.voyelle : (i ? v[i - 1] : true); }); return v; },
    act(st, E, a) {
        if (a.bascule != null) { st.s[a.bascule].h = !st.s[a.bascule].h; return; }
        if (a.valider) { const v = this.voulu(st, E); return st.s.every((s, i) => s.h === v[i]) ? 'ok' : 'err'; }
    },
    sol(st, E) { const v = this.voulu(st, E), k = st.s.findIndex((s, i) => s.h !== v[i]); return k < 0 ? [{ valider: 1 }] : [{ bascule: k }]; },
    manuel() {
        return `<p class="mn-p">Cinq commutateurs à levier, chacun coiffé d’un capuchon de couleur. Placez chaque levier <b>en haut</b> ou <b>en bas</b> selon la couleur de son capuchon, puis appuyez sur <b>VALIDER</b>. Les commutateurs se comptent de gauche à droite.</p>
            <table class="mn-table"><tr><th>Capuchon</th><th>Position du levier</th></tr>
            <tr><td>${pastille('rouge')} rouge</td><td>toujours <b>en haut</b></td></tr>
            <tr><td>${pastille('bleu')} bleu</td><td>toujours <b>en bas</b></td></tr>
            <tr><td>${pastille('vert')} vert</td><td><b>en haut</b> si la charge porte au moins une cellule d’énergie, sinon en bas</td></tr>
            <tr><td>${pastille('jaune')} jaune</td><td><b>en bas</b> si la matricule contient une voyelle, sinon en haut</td></tr>
            <tr><td>${pastille('blanc')} blanc</td><td>dans la <b>même position que le commutateur juste à sa gauche</b> (tel qu’il doit être). Le premier commutateur blanc à gauche de tout : en haut.</td></tr></table>`;
    }
});

// ★ — 2. Balise de détresse
const DET_N = { rouge: 3, bleu: 5, vert: 2, jaune: 4 };
ajout({
    id: 'detresse', nom: 'Balise de détresse', diff: 1,
    gen(R) { return { c: R.pick(Object.keys(DET_N)), n: 0 }; },
    cible(st, E) { return DET_N[st.c] + (E.cellules % 2 === 1 ? 1 : 0); },
    act(st, E, a) {
        if (a.signal) { st.n = Math.min(9, st.n + 1); return; }
        if (a.raz) { st.n = 0; return; }
        if (a.emettre) { const ok = st.n === this.cible(st, E); st.n = 0; return ok ? 'ok' : 'err'; }
    },
    sol(st, E) { const c = this.cible(st, E); return st.n === c ? [{ emettre: 1 }] : st.n > c ? [{ raz: 1 }] : [{ signal: 1 }]; },
    manuel() {
        return `<p class="mn-p">Un gyrophare tourne au sommet du module. Appuyez sur <b>SIGNAL</b> le bon nombre de fois (le compteur s’affiche), puis sur <b>ÉMETTRE</b>. <b>RAZ</b> remet le compteur à zéro.</p>
            <table class="mn-table"><tr><th>Couleur du gyrophare</th><th>Nombre de signaux</th></tr>${Object.keys(DET_N).map(c => `<tr><td>${pastille(c)} ${c}</td><td class="mn-num">${DET_N[c]}</td></tr>`).join('')}</table>
            ${regles(['Si la charge porte un nombre <b>impair</b> de cellules d’énergie (1 ou 3), ajoutez <b>1</b> signal.', 'Émettre avec un mauvais compte provoque une erreur et remet le compteur à zéro.'])}`;
    }
});

// ★ — 3. Hublots
ajout({
    id: 'hublots', nom: 'Hublots d’observation', diff: 1,
    gen(R) { return { h: R.shuffle(ASTRES).slice(0, 3) }; },
    solution(st, E) { const r = st.h.map(a => ASTRES.indexOf(a)); const v = E.emb === 'Mars' ? Math.max(...r) : Math.min(...r); return r.indexOf(v); },
    act(st, E, a) { if (a.hublot == null) return; return a.hublot === this.solution(st, E) ? 'ok' : 'err'; },
    sol(st, E) { return [{ hublot: this.solution(st, E) }]; },
    manuel() {
        return `<p class="mn-p">Trois hublots ronds montrent chacun un astre. Fermez (touchez) le hublot qui montre l’astre <b>le plus dangereux</b>, c’est-à-dire le plus haut dans la liste ci-dessous.</p>
            <table class="mn-table"><tr><th>Danger</th><th>Astre</th><th></th></tr>${ASTRES.map((a, i) => `<tr><td class="mn-num">${i + 1}</td><td><b>${a}</b></td><td>${img(46, 46, (x, w, h) => { x.fillStyle = '#020617'; x.fillRect(0, 0, w, h); dessAstre(x, a, w / 2, h / 2, 18); })}</td></tr>`).join('')}</table>
            ${regles(['Si l’<b>emblème de mission est Mars</b>, fermez au contraire le hublot de l’astre <b>le moins dangereux</b> (le plus bas dans la liste).'])}`;
    }
});

// ★ — 4. Réservoirs de carburant
ajout({
    id: 'reservoirs', nom: 'Réservoirs de carburant', diff: 1,
    gen(R) { return { r: [0, 1, 2, 3].map(() => ({ n: R.int(0, 9), c: R() < .5 ? 'orange' : 'bleu' })) }; },
    solution(st, E) {
        const inv = E.port('Plasma'), plusBas = (L, bas) => L.reduce((b, i) => b < 0 || (bas ? st.r[i].n < st.r[b].n : st.r[i].n > st.r[b].n) ? i : b, -1);
        const o = st.r.map((r, i) => r.c === 'orange' ? i : -1).filter(i => i >= 0), b = st.r.map((r, i) => r.c === 'bleu' ? i : -1).filter(i => i >= 0);
        return o.length ? plusBas(o, !inv) : plusBas(b, inv);
    },
    act(st, E, a) { if (a.reservoir == null) return; return a.reservoir === this.solution(st, E) ? 'ok' : 'err'; },
    sol(st, E) { return [{ reservoir: this.solution(st, E) }]; },
    manuel() {
        return `<p class="mn-p">Quatre réservoirs avec une étiquette <b>orange</b> ou <b>bleue</b> et un niveau de 0 à 9 affiché. Ravitaillez (touchez) un seul réservoir.</p>
            ${regles(['S’il y a au moins un réservoir <b>orange</b>, touchez l’orange qui a le <b>niveau le plus bas</b>.', 'Sinon, touchez le réservoir bleu qui a le <b>niveau le plus haut</b>.', 'Si la charge possède un <b>port Plasma</b>, inversez « plus bas » et « plus haut » dans les deux règles.', 'En cas d’égalité, touchez celui le plus à gauche.'])}`;
    }
});

// =====================================================================
//  ★★ — 5. Coordonnées d'approche
// =====================================================================
const ETOILES = [['ACHERNAR', 3, 8], ['BELLATRIX', 7, 1], ['CANOPUS', 0, 5], ['DUBHE', 9, 2], ['ELNATH', 4, 4], ['FOMALHAUT', 6, 9], ['GACRUX', 1, 7], ['HADAR', 8, 3], ['IZAR', 2, 0], ['MIRACH', 5, 6], ['NUNKI', 9, 9], ['POLARIS', 0, 1]];
ajout({
    id: 'coordonnees', nom: 'Coordonnées d’approche', diff: 2,
    gen(R) { return { e: R.int(0, ETOILES.length - 1), x: R.int(0, 9), y: R.int(0, 9) }; },
    cible(st, E) { let [, x, y] = ETOILES[st.e]; if (E.port('Quantique')) [x, y] = [y, x]; if (E.baliseOn('NAV')) x = (x + E.dernier) % 10; return [x, y]; },
    act(st, E, a) {
        if (a.x) { st.x = (st.x + a.x + 10) % 10; return; }
        if (a.y) { st.y = (st.y + a.y + 10) % 10; return; }
        if (a.engager) { const [x, y] = this.cible(st, E); return st.x === x && st.y === y ? 'ok' : 'err'; }
    },
    sol(st, E) { const [x, y] = this.cible(st, E); return st.x !== x ? [{ x: 1 }] : st.y !== y ? [{ y: 1 }] : [{ engager: 1 }]; },
    manuel() {
        return `<p class="mn-p">L’écran affiche le <b>nom d’une étoile</b>. Réglez les deux roues <b>X</b> et <b>Y</b> (0 à 9) sur les coordonnées d’approche de cette étoile, puis appuyez sur <b>ENGAGER</b>.</p>
            <table class="mn-table mn-2col"><tr><th>Étoile</th><th>X</th><th>Y</th></tr>${ETOILES.map(e => `<tr><td><b>${e[0]}</b></td><td class="mn-num">${e[1]}</td><td class="mn-num">${e[2]}</td></tr>`).join('')}</table>
            ${regles(['Si la charge possède un <b>port Quantique</b>, échangez X et Y.', 'Ensuite, si une <b>balise NAV est allumée</b>, ajoutez le dernier chiffre de la matricule à X (ne gardez que les unités).'])}`;
    }
});

// ★★ — 6. Ordre planétaire
ajout({
    id: 'planetes', nom: 'Ordre planétaire', diff: 2,
    gen(R) { return { p: R.shuffle(PLANETES.map((x, i) => i)).slice(0, 4), fait: [] }; },
    ordre(st, E) { const o = [0, 1, 2, 3].sort((a, b) => PLANETES[st.p[a]][4] - PLANETES[st.p[b]][4]); return E.baliseOn('SOL') ? o.reverse() : o; },
    act(st, E, a) {
        if (a.planete == null || st.fait.indexOf(a.planete) >= 0) return;
        if (this.ordre(st, E)[st.fait.length] === a.planete) { st.fait.push(a.planete); return st.fait.length === 4 ? 'ok' : undefined; }
        return 'err';
    },
    sol(st, E) { return [{ planete: this.ordre(st, E)[st.fait.length] }]; },
    manuel() {
        return `<p class="mn-p">Quatre boutons montrent des planètes du système Kélos, sans leur nom. Identifiez-les (couleur, anneau ou bandes, nombre de lunes) et touchez-les de la <b>plus proche</b> à la <b>plus éloignée</b> de leur étoile.</p>
            <table class="mn-table"><tr><th></th><th>Planète</th><th>Description</th><th>Distance</th></tr>
            ${PLANETES.map((p, k) => `<tr><td>${img(52, 44, (x, w, h) => { x.fillStyle = '#020617'; x.fillRect(0, 0, w, h); dessPlanete(x, k, w / 2, h / 2 + 3, 15); })}</td><td><b>${p[0]}</b></td><td class="mn-petit">${p[1]}, ${p[2] === 'lisse' ? 'surface lisse' : p[2] === 'bandes' ? 'à bandes sombres' : 'avec anneau'}, ${p[3]} lune${p[3] > 1 ? 's' : ''}</td><td class="mn-num">${String(p[4]).replace('.', ',')} UA</td></tr>`).join('')}</table>
            ${regles(['Si une <b>balise SOL est allumée</b>, touchez-les au contraire de la plus éloignée à la plus proche.', 'Une mauvaise planète provoque une erreur ; les planètes déjà validées restent acquises.'])}`;
    }
});

// ★★ — 7. Diagnostic de combinaison
const COMBI_C = ['vert', 'jaune', 'rouge', 'éteint'];
const COMBI_R = [
    { t: 'Si le <b>réservoir</b> est rouge, touchez le réservoir.', f: c => c[3] === 'rouge', k: () => 3 },
    { t: 'Sinon, si <b>exactement un voyant est éteint</b>, touchez-le.', f: c => nb(c, 'éteint') === 1, k: c => c.indexOf('éteint') },
    { t: 'Sinon, si le <b>casque et les bottes ont la même couleur</b>, touchez les gants.', f: c => c[0] === c[2], k: () => 1 },
    { t: 'Sinon, s’il y a <b>au moins deux voyants jaunes</b>, touchez le casque.', f: c => nb(c, 'jaune') >= 2, k: () => 0 },
    { t: 'Sinon, si la charge porte <b>au moins 3 cellules</b> d’énergie, touchez les bottes.', f: (c, E) => E.cellules >= 3, k: () => 2 },
    { t: 'Sinon, touchez le réservoir.', f: () => true, k: () => 3 }];
ajout({
    id: 'combinaison', nom: 'Diagnostic de combinaison', diff: 2,
    gen(R) { return { c: [0, 1, 2, 3].map(() => R.pick(COMBI_C)) }; },
    solution(st, E) { return evalRegles(COMBI_R, st.c, E); },
    act(st, E, a) { if (a.piece == null) return; return a.piece === this.solution(st, E) ? 'ok' : 'err'; },
    sol(st, E) { return [{ piece: this.solution(st, E) }]; },
    manuel() {
        return `<p class="mn-p">Le diagnostic de la combinaison spatiale affiche quatre pièces : <b>casque</b>, <b>gants</b>, <b>bottes</b> et <b>réservoir</b>, chacune avec un voyant (vert, jaune, rouge ou éteint). Touchez la pièce à remplacer.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0">${COMBI.map(t => `<figure class="mn-fig">${img(54, 54, (x, w, h) => { x.fillStyle = '#0f172a'; x.fillRect(0, 0, w, h); dessCombi(x, t, w / 2, h / 2, 40, '#e2e8f0'); })}<figcaption>${t}</figcaption></figure>`).join('')}</div>
            ${regles(COMBI_R.map(r => r.t))}`;
    }
});

// ★★ — 8. Anneau d'amarrage
const AMA_T = { navette: ['γ', 'α', 'η'], cargo: ['δ', 'θ', 'β'], sonde: ['ζ', 'ε', 'γ'], chasseur: ['β', 'η', 'ε'] };
const AMA_C = ['rouge', 'bleu', 'vert'];
ajout({
    id: 'amarrage', nom: 'Anneau d’amarrage', diff: 2,
    gen(R) { return { v: R.pick(VAISSEAUX), c: R.pick(AMA_C), ordre: R.shuffle(GREC.map(g => g[0])), rot: R.int(0, 7) }; },
    cible(st, E) { let L = AMA_T[st.v][AMA_C.indexOf(st.c)]; if (E.emb === 'Europe') { const i = GREC.findIndex(g => g[0] === L); L = GREC[(i + 1) % 8][0]; } return L; },
    enHaut(st) { return st.ordre[st.rot]; },
    act(st, E, a) {
        if (a.tourne) { st.rot = (st.rot + a.tourne + 8) % 8; return; }
        if (a.amarrer) return this.enHaut(st) === this.cible(st, E) ? 'ok' : 'err';
    },
    sol(st, E) { return this.enHaut(st) === this.cible(st, E) ? [{ amarrer: 1 }] : [{ tourne: 1 }]; },
    manuel() {
        return `<p class="mn-p">Un vaisseau se présente à l’amarrage (son icône et sa couleur sont affichées au centre). Faites tourner l’anneau (⟲ ⟳) pour amener le bon <b>secteur</b> (une lettre grecque) sous la <b>flèche du haut</b>, puis appuyez sur <b>AMARRER</b>.</p>
            <table class="mn-table"><tr><th>Vaisseau</th>${AMA_C.map(c => `<th>${pastille(c)} ${c}</th>`).join('')}</tr>
            ${VAISSEAUX.map(v => `<tr><td>${img(40, 40, (x, w, h) => { x.fillStyle = '#0f172a'; x.fillRect(0, 0, w, h); dessVaisseau(x, v, w / 2, h / 2, 30, '#e2e8f0'); })} <b>${v}</b></td>${AMA_T[v].map(L => `<td class="mn-num" style="font-size:18px">${L}</td>`).join('')}</tr>`).join('')}</table>
            ${regles(['Si l’<b>emblème de mission est Europe</b>, prenez la lettre <b>suivante</b> dans l’alphabet grec (après θ, on revient à α).'])}
            <h4 class="mn-h4">Alphabet grec</h4><p class="mn-p">${GREC.map(g => `<b style="font-size:17px">${g[0]}</b> ${g[1]}`).join(' · ')}</p>`;
    }
});

// ★★ — 9. Radio de bord
const RADIO = [['ORION', 2], ['VÉGA', 5], ['ALTAÏR', 7], ['SIRIUS', 1], ['RIGEL', 4], ['DENEB', 8], ['CASTOR', 3], ['POLLUX', 6], ['CAPELLA', 9], ['ANTARÈS', 2], ['SPICA', 5], ['ARCTURUS', 7]];
ajout({
    id: 'radio', nom: 'Radio de bord', diff: 2,
    gen(R) { return { m: R.int(0, RADIO.length - 1), n: R.int(1, 9), c: R.int(1, 9) }; },
    cible(st, E) { let c = RADIO[st.m][1] + st.n; if (E.balise('COM')) c += E.cellules; while (c > 9) c -= 9; return c; },
    act(st, E, a) {
        if (a.canal) { st.c = ((st.c - 1 + a.canal + 9) % 9) + 1; return; }
        if (a.emettre) return st.c === this.cible(st, E) ? 'ok' : 'err';
    },
    sol(st, E) { return st.c === this.cible(st, E) ? [{ emettre: 1 }] : [{ canal: 1 }]; },
    manuel() {
        return `<p class="mn-p">L’écran affiche un <b>indicatif d’appel</b> : un nom suivi d’un chiffre (ex. « ORION-7 »). Réglez le canal (1 à 9) avec ◀ ▶ puis appuyez sur <b>ÉMETTRE</b>.</p>
            ${regles(['Canal = <b>valeur du nom</b> (table) + <b>chiffre de l’indicatif</b>.', 'Si la charge a une <b>balise COM</b> (allumée ou non), ajoutez aussi le nombre de cellules d’énergie.', 'Tant que le résultat dépasse 9, retirez 9.'])}
            <table class="mn-table mn-2col"><tr><th>Nom</th><th>Valeur</th></tr>${RADIO.map(r => `<tr><td><b>${r[0]}</b></td><td class="mn-num">${r[1]}</td></tr>`).join('')}</table>
            <div class="mn-ex"><b>Exemple :</b> « DENEB-6 » → 8 + 6 = 14 → 14 − 9 = <b>canal 5</b>.</div>`;
    }
});

// =====================================================================
//  ★★★ — 10. Balance de masse
// =====================================================================
const MASSES = { rouge: 1, bleu: 2, vert: 3, jaune: 4 };
ajout({
    id: 'balance', nom: 'Balance de masse', diff: 3,
    masse(E) { return E.cellules + 2; },
    gen(R, E) {
        const m = this.masse(E), C = Object.keys(MASSES);
        for (let essai = 0; essai < 500; essai++) {
            const g = [0, 1, 2, 3].map(() => R() < .55 ? R.pick(C) : null), d = [0, 1, 2, 3].map(() => R() < .3 ? R.pick(C) : null);
            const L = g.reduce((t, c, i) => t + (c ? MASSES[c] * (i + 1) : 0), 0), Rf = d.reduce((t, c, i) => t + (c ? MASSES[c] * (i + 1) : 0), 0);
            const diff = L - Rf;
            if (diff > 0 && diff % m === 0 && diff / m >= 1 && diff / m <= 4 && !d[diff / m - 1]) return { g: g, d: d, p: R.int(1, 4) };
        }
        const g = [null, null, null, null];            // secours : un équilibre simple au cran 1
        if (m <= 4) g[m - 1] = 'rouge'; else if (m === 5) { g[0] = 'rouge'; g[1] = 'bleu'; } else g[2] = 'bleu';
        return { g: g, d: [null, null, null, null], p: 2 };
    },
    cible(st, E) { const L = st.g.reduce((t, c, i) => t + (c ? MASSES[c] * (i + 1) : 0), 0), Rf = st.d.reduce((t, c, i) => t + (c ? MASSES[c] * (i + 1) : 0), 0); return (L - Rf) / this.masse(E); },
    act(st, E, a) {
        if (a.pos) { st.p = Math.max(1, Math.min(4, st.p + a.pos)); return; }
        if (a.stabiliser) return st.p === this.cible(st, E) ? 'ok' : 'err';
    },
    sol(st, E) { const c = this.cible(st, E); return st.p === c ? [{ stabiliser: 1 }] : [{ pos: st.p < c ? 1 : -1 }]; },
    manuel() {
        return `<p class="mn-p">Un fléau de balance porte des blocs colorés sur ses deux bras, à des crans numérotés de <b>1</b> (près du pivot) à <b>4</b> (au bout). Sur le bras droit, un <b>contrepoids gris</b> glisse avec ◀ ▶. Placez-le pour que la balance soit à l’équilibre, puis appuyez sur <b>STABILISER</b>.</p>
            <table class="mn-table"><tr><th>Bloc</th><th>Masse</th></tr>${Object.keys(MASSES).map(c => `<tr><td>${pastille(c)} ${c}</td><td class="mn-num">${MASSES[c]}</td></tr>`).join('')}
            <tr><td>${pastille('gris')} contrepoids</td><td>nombre de cellules d’énergie <b>+ 2</b></td></tr></table>
            ${regles(['La force d’un bloc = sa <b>masse × son numéro de cran</b>.', 'Additionnez les forces du bras gauche, puis celles des blocs colorés du bras droit.', 'Le contrepoids doit compenser la différence : cran = (gauche − droite) ÷ masse du contrepoids.'])}
            <div class="mn-ex"><b>Exemple :</b> gauche : jaune au cran 2 (8) + rouge au cran 3 (3) = 11 ; droite : bleu au cran 1 (2). Différence 9. 1 cellule → contrepoids de 3 → cran <b>3</b>.</div>`;
    }
});

// ★★★ — 11. Phases lunaires
ajout({
    id: 'phases', nom: 'Codex des phases', diff: 3,
    gen(R) { return { p: [0, 1, 2, 3].map(() => R.int(0, 7)), s: '' }; },
    code(st, E) { const c = st.p.slice(); if (E.emb === 'Europe') c.reverse(); return c.join(''); },
    act(st, E, a) {
        if (a.chiffre != null) { if (st.s.length < 4) st.s += a.chiffre; return; }
        if (a.effacer) { st.s = ''; return; }
        if (a.entrer) { const ok = st.s === this.code(st, E); st.s = ''; return ok ? 'ok' : 'err'; }
    },
    sol(st, E) { const c = this.code(st, E); if (st.s === c) return [{ entrer: 1 }]; if (c.indexOf(st.s) !== 0) return [{ effacer: 1 }]; return [{ chiffre: c[st.s.length] }]; },
    manuel() {
        return `<p class="mn-p">Quatre lunes montrent chacune une <b>phase</b>. Chaque phase vaut un chiffre. Lisez les lunes de gauche à droite, tapez le code de quatre chiffres puis <b>OK</b>.</p>
            <table class="mn-table"><tr><th>Phase</th><th>Nom</th><th>Chiffre</th></tr>${PHASES.map((p, k) => `<tr><td>${img(40, 40, (x, w, h) => { x.fillStyle = '#020617'; x.fillRect(0, 0, w, h); dessPhase(x, k, w / 2, h / 2, 14); })}</td><td>${p}</td><td class="mn-num">${k}</td></tr>`).join('')}</table>
            ${regles(['La partie <b>claire</b> de la lune est la partie éclairée : à droite pour les phases croissantes (1 à 3), à gauche pour les décroissantes (5 à 7).', 'Si l’<b>emblème de mission est Europe</b>, tapez les chiffres dans l’ordre inverse (de droite à gauche).'])}`;
    }
});

// ★★★ — 12. Pulsar
const PULS_T = { blanc: ['II', 'IV', 'I', 'III'], bleu: ['III', 'I', 'IV', 'II'], rouge: ['IV', 'III', 'II', 'I'] };
const ROM = ['I', 'II', 'III', 'IV'];
ajout({
    id: 'pulsar', nom: 'Signal de pulsar', diff: 3,
    gen(R) { return { c: R.pick(Object.keys(PULS_T)), n: R.int(1, 4), vite: R() < .5 }; },
    cible(st) { let b = PULS_T[st.c][st.n - 1]; if (st.vite) b = ROM[(ROM.indexOf(b) + 1) % 4]; return b; },
    act(st, E, a) { if (!a.bouton) return; return a.bouton === this.cible(st) ? 'ok' : 'err'; },
    sol(st) { return [{ bouton: this.cible(st) }]; },
    manuel() {
        return `<p class="mn-p">Une lentille clignote en boucle : comptez le <b>nombre d’éclairs</b> de chaque salve (1 à 4), notez leur <b>couleur</b> et leur <b>rythme</b> (lent ou rapide). Appuyez ensuite sur le bon bouton (I, II, III ou IV).</p>
            <table class="mn-table"><tr><th>Couleur</th>${[1, 2, 3, 4].map(n => `<th>${n} éclair${n > 1 ? 's' : ''}</th>`).join('')}</tr>
            ${Object.keys(PULS_T).map(c => `<tr><td>${pastille(c)} ${c}</td>${PULS_T[c].map(b => `<td class="mn-num">${b}</td>`).join('')}</tr>`).join('')}</table>
            ${regles(['Si les éclairs sont <b>rapides</b>, prenez le bouton <b>suivant</b> (I → II → III → IV → I).', 'Une salve est séparée de la suivante par une longue pause.'])}`;
    }
});

// ★★★ — 13. Circuit de refroidissement (tuyaux)
const TUY_SORTIE = { violet: 0, cyan: 1, orange: 2 }, TUY_NOM = { violet: 'plasma violet', cyan: 'liquide cyan', orange: 'magma orange' };
const rotBits = (b, r) => { for (let k = 0; k < r; k++) b = ((b << 1) | (b >> 3)) & 15; return b; };   // haut 1, droite 2, bas 4, gauche 8 ; rotation horaire
const TUILES = { I: 5, L: 3, T: 7 };
function tuyOuverts(t) { return rotBits(TUILES[t.t], t.r); }
function tuyAtteint(st) {      // les tuiles alimentées depuis l'entrée (à gauche de la rangée du milieu)
    const ok = new Set(), file = [];
    const ouv = i => tuyOuverts(st.g[i]);
    if (ouv(3) & 8) { ok.add(3); file.push(3); }
    while (file.length) {
        const i = file.shift(), x = i % 3, y = Math.floor(i / 3), o = ouv(i);
        [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]].forEach(([b, dx, dy, op]) => {
            const nx = x + dx, ny = y + dy, n = ny * 3 + nx;
            if (o & b && nx >= 0 && nx < 3 && ny >= 0 && ny < 3 && (ouv(n) & op) && !ok.has(n)) { ok.add(n); file.push(n); }
        });
    }
    return ok;
}
ajout({
    id: 'tuyaux', nom: 'Circuit de refroidissement', diff: 3,
    sortie(st, E) { let r = TUY_SORTIE[st.l]; if (E.baliseOn('ORB')) r = (r + 1) % 3; return r; },
    gen(R, E) {
        const l = R.pick(Object.keys(TUY_SORTIE));
        const fin = (TUY_SORTIE[l] + (E.baliseOn('ORB') ? 1 : 0)) % 3;
        // chemin aléatoire de (rangée 1, colonne 0) à (fin, colonne 2), sans revenir en arrière
        let chemin;
        for (let essai = 0; essai < 200; essai++) {
            const p = [[1, 0]], vu = new Set(['1,0']);
            while (p.length < 12) {
                const [y, x] = p[p.length - 1]; if (x === 2 && y === fin) break;
                const v = [[y - 1, x], [y + 1, x], [y, x + 1]].filter(([a, b]) => a >= 0 && a < 3 && b < 3 && !vu.has(a + ',' + b));
                if (!v.length) break; const n = R.pick(v); p.push(n); vu.add(n.join(','));
            }
            const [y, x] = p[p.length - 1]; if (x === 2 && y === fin) { chemin = p; break; }
        }
        if (!chemin) { chemin = [[1, 0], [1, 1], [1, 2]]; if (fin === 0) chemin.push([0, 2]); else if (fin === 2) chemin.push([2, 2]); }
        if (chemin.length > 3 && chemin[chemin.length - 1][0] !== fin) chemin = [[1, 0], [1, 1], [1, 2]].concat(fin === 1 ? [] : [[fin, 2]]);
        const g = Array.from({ length: 9 }, () => ({ t: R.pick(['I', 'L', 'T']), r: 0 }));
        chemin.forEach(([y, x], k) => {
            const prec = k ? chemin[k - 1] : [1, -1], suiv = k < chemin.length - 1 ? chemin[k + 1] : [y, 3];
            const cote = ([a, b]) => a < y ? 1 : b > x ? 2 : a > y ? 4 : 8;
            const bits = cote(prec) | cote(suiv);
            const t = bits === 5 || bits === 10 ? 'I' : 'L';
            g[y * 3 + x] = { t: t, r: 0 };
            for (let r = 0; r < 4; r++) if ((rotBits(TUILES[t], r) & bits) === bits) { g[y * 3 + x].r = r; break; }
        });
        const st = { g: g, l: l };
        g.forEach(t => { t.bon = t.r; t.r = R.int(0, 3); });
        if (this.reussi(st, E)) g[3].r = (g[3].r + 1) % 4;
        return st;
    },
    reussi(st, E) { const r = this.sortie(st, E), i = r * 3 + 2; return tuyAtteint(st).has(i) && (tuyOuverts(st.g[i]) & 2) > 0; },
    act(st, E, a) {
        if (a.tuile != null) { st.g[a.tuile].r = (st.g[a.tuile].r + 1) % 4; return; }
        if (a.circuler) return this.reussi(st, E) ? 'ok' : 'err';
    },
    sol(st, E) {
        if (this.reussi(st, E)) return [{ circuler: 1 }];
        const k = st.g.findIndex(t => t.bon != null && t.r !== t.bon && rotBits(TUILES[t.t], t.r) !== rotBits(TUILES[t.t], t.bon));
        return k < 0 ? [{ circuler: 1 }] : [{ tuile: k }];
    },
    manuel() {
        return `<p class="mn-p">Neuf tuiles de tuyauterie (3 × 3) tournent d’un quart de tour à chaque toucher. Le liquide entre <b>par la gauche, au milieu</b>. Il doit ressortir <b>par la droite</b>, dans la bonne rangée. Une fois le circuit relié, appuyez sur <b>FAIRE CIRCULER</b>.</p>
            <table class="mn-table"><tr><th>Liquide (couleur du voyant)</th><th>Sortie</th></tr>${Object.keys(TUY_SORTIE).map(c => `<tr><td>${pastille(c)} ${TUY_NOM[c]}</td><td>rangée du <b>${['haut', 'milieu', 'bas'][TUY_SORTIE[c]]}</b></td></tr>`).join('')}</table>
            ${regles(['Si une <b>balise ORB est allumée</b>, la sortie descend d’une rangée (haut → milieu → bas → haut).', 'Les fuites ailleurs n’ont pas d’importance : seul compte le chemin jusqu’à la bonne sortie.', 'Faire circuler vers la mauvaise sortie (ou sans chemin) provoque une erreur.'])}
            <div class="mn-note">Ce module se résout surtout côté démineur : l’expert lui indique la sortie à atteindre et l’aide à vérifier le chemin.</div>`;
    }
});

// ★★★ — 14. Horloge interplanétaire
const HORL = [['MARS', 3, 0], ['LUNE', -5, 20], ['TITAN', 7, 0], ['EUROPE', -2, 40], ['VÉNUS', 11, 0], ['CÉRÈS', -8, 30]];
ajout({
    id: 'horloge', nom: 'Horloge interplanétaire', diff: 3,
    gen(R) { return { p: R.int(0, HORL.length - 1), h: R.int(0, 23), m: R.int(0, 11) * 5, sh: R.int(0, 23), sm: R.int(0, 11) * 5 }; },
    cible(st, E) {
        let t = st.h * 60 + st.m + HORL[st.p][1] * 60 + HORL[st.p][2] + E.cellules * 5;
        t = ((t % 1440) + 1440) % 1440; return [Math.floor(t / 60), t % 60];
    },
    act(st, E, a) {
        if (a.h) { st.sh = (st.sh + a.h + 24) % 24; return; }
        if (a.m) { st.sm = (st.sm + a.m * 5 + 60) % 60; return; }
        if (a.synchro) { const [h, m] = this.cible(st, E); return st.sh === h && st.sm === m ? 'ok' : 'err'; }
    },
    sol(st, E) { const [h, m] = this.cible(st, E); return st.sh !== h ? [{ h: 1 }] : st.sm !== m ? [{ m: 1 }] : [{ synchro: 1 }]; },
    manuel() {
        return `<p class="mn-p">L’écran du haut donne l’<b>heure locale</b> d’un astre (nom affiché). Convertissez-la en <b>heure de bord</b>, réglez-la sur l’écran du bas (heures et minutes, par pas de 5 minutes) et appuyez sur <b>SYNCHRONISER</b>.</p>
            <table class="mn-table"><tr><th>Astre</th><th>Décalage vers l’heure de bord</th></tr>${HORL.map(h => `<tr><td><b>${h[0]}</b></td><td>${h[1] > 0 ? '+' : '−'}${Math.abs(h[1])} h${h[2] ? ` et +${h[2]} min` : ''}</td></tr>`).join('')}</table>
            ${regles(['Ajoutez ensuite <b>5 minutes par cellule d’énergie</b>.', 'Les heures vont de 00 à 23 : après 23 h 55 on revient à 00 h 00, et avant 00 h 00 on repart de 23 h 55.'])}
            <div class="mn-ex"><b>Exemple :</b> LUNE 02:40, 2 cellules → 02:40 − 5 h = 21:40 (la veille), + 20 min = 22:00, + 10 min = <b>22:10</b>.</div>`;
    }
});

// ★★★ — 15. Barres de contrôle du réacteur
const BAR = ['α', 'β', 'γ'];
const BAR_T = { vert: ['β', 'γ', 'α'], orange: ['α', 'β', 'γ'], rouge: ['γ', 'α', 'β'] };
function barEtape(R) { return { t: R.int(300, 999), l: R.pick(['vert', 'orange', 'rouge']) }; }
ajout({
    id: 'barres', nom: 'Barres de contrôle', diff: 3,
    gen(R) { return { e: Array.from({ length: 8 }, () => barEtape(R)), k: 0, essai: 0 }; },
    etape(st) { return st.e[(st.k + st.essai * 3) % st.e.length]; },
    cible(st, E) { const x = this.etape(st), z = x.t < 500 ? 0 : x.t < 800 ? 1 : 2; let b = BAR_T[x.l][z]; if (E.ports.length >= 2) b = BAR[(BAR.indexOf(b) + 1) % 3]; return b; },
    act(st, E, a) {
        if (!a.barre) return;
        if (a.barre === this.cible(st, E)) { st.k++; return st.k >= 3 ? 'ok' : undefined; }
        st.essai++; return 'err';
    },
    sol(st, E) { return [{ barre: this.cible(st, E) }]; },
    manuel() {
        return `<p class="mn-p">Le cœur du réacteur affiche une <b>température</b> (en degrés) et un <b>voyant d’alerte</b>. Insérez la bonne barre de contrôle (α, β ou γ). Il faut stabiliser le réacteur <b>trois fois de suite</b> (trois témoins).</p>
            <table class="mn-table"><tr><th>Voyant</th><th>moins de 500°</th><th>500° à 799°</th><th>800° et plus</th></tr>${Object.keys(BAR_T).map(l => `<tr><td>${pastille(l)} ${l}</td>${BAR_T[l].map(b => `<td class="mn-num" style="font-size:17px">${b}</td>`).join('')}</tr>`).join('')}</table>
            ${regles(['Si la charge possède <b>au moins deux ports</b>, prenez la barre <b>suivante</b> (α → β → γ → α).', 'Une mauvaise barre provoque une erreur et affiche une nouvelle mesure (les stabilisations réussies restent acquises).'])}`;
    }
});

// =====================================================================
//  ★★★★ — 16. Matrice de téléportation
// =====================================================================
const TELE = [['KEP', '110010011'], ['ORB', '010111000'], ['VEG', '100110001'], ['TAU', '011001100'], ['LYR', '111100010'], ['NOX', '001011110'], ['ZEN', '101010001'], ['AXL', '000111100']];
ajout({
    id: 'teleport', nom: 'Matrice de téléportation', diff: 4,
    gen(R, E) { const st = { d: R.int(0, TELE.length - 1), p: Array.from({ length: 9 }, () => R() < .4 ? 1 : 0) }; if (E && this.voulu(st, E).every((v, i) => v === st.p[i])) st.p[4] = 1 - st.p[4]; return st; },
    voulu(st, E) {
        let m = [...TELE[st.d][1]].map(Number);
        if (E.baliseOn('COM')) m = [0, 1, 2].flatMap(y => [2, 1, 0].map(x => m[y * 3 + x]));
        if (E.dernier % 2 === 1) m = m.map(v => 1 - v);
        return m;
    },
    act(st, E, a) {
        if (a.pad != null) { st.p[a.pad] = 1 - st.p[a.pad]; return; }
        if (a.teleporter) { const v = this.voulu(st, E); return st.p.every((x, i) => x === v[i]) ? 'ok' : 'err'; }
    },
    sol(st, E) { const v = this.voulu(st, E), k = st.p.findIndex((x, i) => x !== v[i]); return k < 0 ? [{ teleporter: 1 }] : [{ pad: k }]; },
    manuel() {
        const grille = s => `<svg viewBox="0 0 36 36" width="60" height="60"><rect width="36" height="36" rx="4" fill="#020617"/>${[...s].map((v, i) => `<rect x="${2 + (i % 3) * 11.5}" y="${2 + Math.floor(i / 3) * 11.5}" width="9.5" height="9.5" rx="2" fill="${v === '1' ? '#22d3ee' : '#1e293b'}"/>`).join('')}</svg>`;
        return `<p class="mn-p">Neuf plots de téléportation (3 × 3) s’allument ou s’éteignent quand on les touche. L’écran affiche le <b>code de destination</b> (trois lettres). Allumez exactement les plots du motif de cette destination, puis appuyez sur <b>TÉLÉPORTER</b>.</p>
            <div class="mn-grille-fig">${TELE.map(t => `<figure class="mn-fig">${grille(t[1])}<figcaption><b>${t[0]}</b></figcaption></figure>`).join('')}</div>
            <h4 class="mn-h4">Corrections (dans cet ordre)</h4>
            ${regles(['Si une <b>balise COM est allumée</b>, retournez le motif comme dans un <b>miroir</b> : la colonne de gauche passe à droite et inversement.', 'Si le <b>dernier chiffre de la matricule est impair</b>, inversez tout : les plots allumés s’éteignent et les éteints s’allument.'])}`;
    }
});

// ★★★★ — 17. Suite xénolithe
const SUITE_R = { bleu: 'chaque terme ajoute toujours le même nombre (suite arithmétique)', vert: 'chaque terme est le double du précédent', rouge: 'chaque terme est la somme des deux précédents' };
ajout({
    id: 'suite', nom: 'Suite xénolithe', diff: 4,
    gen(R) {
        const c = R.pick(Object.keys(SUITE_R)); let t;
        if (c === 'bleu') { const a = R.int(0, 5), k = R.int(1, 4); t = [a, a + k, a + 2 * k, a + 3 * k]; }
        else if (c === 'vert') { const a = R.int(1, 2); t = [a, a * 2, a * 4, a * 8]; }
        else { const a = R.int(0, 3), b = R.int(1, 3); t = [a, b, a + b, a + 2 * b]; }
        return { c: c, t: t, s: '' };
    },
    suivant(st) { const t = st.t; return st.c === 'bleu' ? t[3] + (t[1] - t[0]) : st.c === 'vert' ? t[3] * 2 : t[2] + t[3]; },
    cible(st, E) { return this.suivant(st) + E.nbOn; },
    act(st, E, a) {
        if (a.chiffre != null) { if (st.s.length < 2) st.s += a.chiffre; return; }
        if (a.effacer) { st.s = ''; return; }
        if (a.entrer) { const ok = st.s !== '' && parseInt(st.s, 10) === this.cible(st, E); st.s = ''; return ok ? 'ok' : 'err'; }
    },
    sol(st, E) { const c = String(this.cible(st, E)); if (st.s === c) return [{ entrer: 1 }]; if (c.indexOf(st.s) !== 0) return [{ effacer: 1 }]; return [{ chiffre: c[st.s.length] }]; },
    manuel() {
        const ch = n => img(30, 34, (x, w, h) => { x.fillStyle = '#020617'; x.fillRect(0, 0, w, h); dessChiffreX(x, n, w / 2, h / 2, 26, '#fde68a'); });
        return `<p class="mn-p">Quatre nombres s’affichent en <b>chiffres xénolithes</b> dans un cadre coloré. Décodez-les, trouvez le <b>terme suivant</b> de la suite, ajoutez le <b>nombre de balises allumées</b> et tapez le résultat (puis <b>OK</b>).</p>
            <h4 class="mn-h4">Lire les chiffres xénolithes</h4>
            ${regles(['Un <b>trait</b> horizontal vaut <b>5</b>, un <b>point</b> vaut <b>1</b> : additionnez-les.', 'Une <b>coquille</b> (ovale avec un trait courbe) vaut <b>0</b>.'])}
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0">${Array.from({ length: 20 }, (x, n) => `<figure class="mn-fig" style="width:40px">${ch(n)}<figcaption>${n}</figcaption></figure>`).join('')}</div>
            <table class="mn-table"><tr><th>Cadre</th><th>Règle de la suite</th></tr>${Object.keys(SUITE_R).map(c => `<tr><td>${pastille(c)} ${c}</td><td>${SUITE_R[c]}</td></tr>`).join('')}</table>
            <div class="mn-ex"><b>Exemple :</b> cadre rouge, 1 · 2 · 3 · 5 → suivant 8 ; 2 balises allumées → tapez <b>10</b>.</div>`;
    }
});

// ★★★★ — 18. Calibrage laser
const LAS_REC = ['rouge', 'vert', 'bleu', 'jaune'];
function laserTrajet(st) {
    let y = st.e, x = -1, dx = 1, dy = 0;
    for (let pas = 0; pas < 40; pas++) {
        x += dx; y += dy;
        if (x < 0 || x > 3 || y < 0 || y > 3) return x > 3 ? y : -1;
        const m = st.m[y * 4 + x];
        if (m === '/') [dx, dy] = [-dy, -dx];
        else if (m === '\\') [dx, dy] = [dy, dx];
    }
    return -1;
}
ajout({
    id: 'laser', nom: 'Calibrage laser', diff: 4,
    cibleCouleur(E) { return { Mars: 'rouge', Europe: 'bleu', Titan: 'jaune', Io: 'vert' }[E.emb] || (E.cellules % 2 === 0 ? 'vert' : 'rouge'); },
    gen(R, E) {
        for (let essai = 0; essai < 400; essai++) {
            const rec = R.shuffle(LAS_REC), e = R.int(0, 3), m = Array(16).fill('');
            const cases = R.shuffle([...Array(16).keys()]).slice(0, R.int(5, 7)); cases.forEach(i => m[i] = R() < .5 ? '/' : '\\');
            const st = { rec: rec, e: e, m: m };
            const cible = rec.indexOf(this.cibleCouleur(E));
            if (laserTrajet(st) === cible) continue;                    // déjà juste : trop facile
            let solution = null;
            for (let k = 0; k < (1 << cases.length) && !solution; k++) {
                const m2 = m.slice(); cases.forEach((i, b) => m2[i] = (k >> b) & 1 ? '\\' : '/');
                if (laserTrajet({ e: e, m: m2 }) === cible) solution = m2;
            }
            if (solution) { st.bon = solution; return st; }
        }
        return { rec: LAS_REC.slice(), e: 0, m: Array(16).fill(''), bon: Array(16).fill('') };
    },
    act(st, E, a) {
        if (a.miroir != null) { if (st.m[a.miroir]) st.m[a.miroir] = st.m[a.miroir] === '/' ? '\\' : '/'; return; }
        if (a.tirer) return laserTrajet(st) === st.rec.indexOf(this.cibleCouleur(E)) ? 'ok' : 'err';
    },
    sol(st, E) { if (laserTrajet(st) === st.rec.indexOf(this.cibleCouleur(E))) return [{ tirer: 1 }]; const k = st.m.findIndex((x, i) => x && x !== st.bon[i]); return k < 0 ? [{ tirer: 1 }] : [{ miroir: k }]; },
    manuel() {
        return `<p class="mn-p">Un laser entre par la <b>gauche</b> d’une grille de 4 × 4 cases. Certaines cases contiennent un <b>miroir</b> incliné (<b>/</b> ou <b>\\</b>) qui dévie le rayon d’un quart de tour ; toucher un miroir le fait basculer. Sur le bord droit, quatre <b>récepteurs</b> colorés. Orientez les miroirs pour que le rayon atteigne le bon récepteur, puis appuyez sur <b>TIRER</b>.</p>
            <table class="mn-table"><tr><th>Emblème de mission</th><th>Récepteur visé</th></tr>
            <tr><td>Mars</td><td>${pastille('rouge')} rouge</td></tr><tr><td>Europe</td><td>${pastille('bleu')} bleu</td></tr><tr><td>Titan</td><td>${pastille('jaune')} jaune</td></tr><tr><td>Io</td><td>${pastille('vert')} vert</td></tr>
            <tr><td>Cérès</td><td>${pastille('vert')} vert si le nombre de cellules est pair, sinon ${pastille('rouge')} rouge</td></tr></table>
            ${regles(['Un rayon qui arrive sur <b>/</b> en allant vers la droite repart vers le <b>haut</b> ; sur <b>\\</b>, il repart vers le <b>bas</b>.', 'Le démineur voit le rayon seulement au moment du tir : faites-lui décrire la position des miroirs et tracez le chemin ensemble.', 'Un tir qui manque le bon récepteur provoque une erreur.'])}
            <div style="display:flex;gap:14px;flex-wrap:wrap;margin:6px 0">
                <figure class="mn-fig"><svg viewBox="0 0 60 60" width="110" height="110"><rect width="60" height="60" rx="5" fill="#020617"/><line x1="4" y1="38" x2="30" y2="38" stroke="#f43f5e" stroke-width="2.5"/><line x1="30" y1="38" x2="30" y2="6" stroke="#f43f5e" stroke-width="2.5"/><line x1="22" y1="46" x2="38" y2="30" stroke="#e2e8f0" stroke-width="3"/><polygon points="26,10 30,3 34,10" fill="#f43f5e"/></svg><figcaption>miroir <b>/</b> : le rayon monte</figcaption></figure>
                <figure class="mn-fig"><svg viewBox="0 0 60 60" width="110" height="110"><rect width="60" height="60" rx="5" fill="#020617"/><line x1="4" y1="22" x2="30" y2="22" stroke="#f43f5e" stroke-width="2.5"/><line x1="30" y1="22" x2="30" y2="54" stroke="#f43f5e" stroke-width="2.5"/><line x1="22" y1="14" x2="38" y2="30" stroke="#e2e8f0" stroke-width="3"/><polygon points="26,50 30,57 34,50" fill="#f43f5e"/></svg><figcaption>miroir <b>\\</b> : le rayon descend</figcaption></figure>
            </div>`;
    }
});

// =====================================================================
//  Modules récurrents — 19. Communications entrantes
// =====================================================================
const APPELS = [['Capitaine Vexx', 0], ['Station Hadès', 1], ['Cargo Pélican', 1], ['Flotte Noire', 0], ['Docteur Orla', 1], ['Contrôle Kepler', 1], ['Le Corsaire Rouge', 0], ['Sonde Ariane-9', 1],
    ['Amiral Toss', 1], ['Contrebandier Jax', 0], ['Colonie Titania', 1], ['Spectre-12', 0], ['Mère Supérieure Ilya', 1], ['Brigade Néon', 0], ['Phare de Cérès', 1], ['Inconnu', 0]];
ajout({
    id: 'appel', nom: 'Communications entrantes', diff: 2, besoin: true, duree: 30000,
    gen() { return { actif: 0, fin: 0, a: 0, prochain: 0 }; },
    activer(st, R) { st.a = R.int(0, APPELS.length - 1); },
    accepter(st, E) { const ami = APPELS[st.a][1] === 1; return E.baliseOn('COM') ? !ami : ami; },
    act(st, E, a) { if (!st.actif || a.rep == null) return; return !!a.rep === this.accepter(st, E) ? 'ok' : 'err'; },
    sol(st, E) { return st.actif ? [{ rep: this.accepter(st, E) ? 1 : 0 }] : []; },
    manuel() {
        return `<p class="mn-p"><b>Module récurrent.</b> Un appel entrant s’affiche avec le <b>nom de l’interlocuteur</b> et 30 secondes pour répondre. <b>ACCEPTEZ</b> les alliés, <b>REFUSEZ</b> les hostiles.</p>
            <table class="mn-table mn-2col"><tr><th>Interlocuteur</th><th>Statut</th></tr>${APPELS.slice().sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(a => `<tr><td>${esc(a[0])}</td><td>${a[1] ? '✅ allié' : '❌ hostile'}</td></tr>`).join('')}</table>
            ${regles(['Si une <b>balise COM est allumée</b>, le canal est piraté : <b>inversez</b> les réponses (refusez les alliés, acceptez les hostiles).'])}`;
    }
});

// 20. Refroidissement d'urgence (récurrent)
const REF_SYM = ['flocon', 'flamme', 'éclair', 'goutte'], REF_V = ['bleu', 'blanc', 'vert'];
const REF_T = { flocon: ['blanc', 'vert'], flamme: ['bleu', 'blanc'], 'éclair': ['vert', 'bleu'], goutte: ['bleu', 'vert'] };
const REF_ICONE = { flocon: '❄', flamme: '🔥', 'éclair': '⚡', goutte: '💧' };
ajout({
    id: 'refroidissement', nom: 'Refroidissement d’urgence', diff: 2, besoin: true, duree: 30000,
    gen() { return { actif: 0, fin: 0, s: 'flocon', prochain: 0 }; },
    activer(st, R) { st.s = R.pick(REF_SYM); },
    cible(st, E) { return REF_T[st.s][E.cellules >= 2 ? 1 : 0]; },
    act(st, E, a) { if (!st.actif || !a.vanne) return; return a.vanne === this.cible(st, E) ? 'ok' : 'err'; },
    sol(st, E) { return st.actif ? [{ vanne: this.cible(st, E) }] : []; },
    manuel() {
        return `<p class="mn-p"><b>Module récurrent.</b> Quand la température s’emballe, l’écran affiche un <b>symbole d’alerte</b> et un compte à rebours de 30 secondes. Ouvrez la bonne vanne de refroidissement (bleue, blanche ou verte).</p>
            <table class="mn-table"><tr><th>Symbole</th><th>Moins de 2 cellules</th><th>2 cellules ou plus</th></tr>${REF_SYM.map(s => `<tr><td>${REF_ICONE[s]} ${s}</td>${REF_T[s].map(v => `<td>${pastille(v)} ${v}</td>`).join('')}</tr>`).join('')}</table>`;
    }
});

// =====================================================================
//  3D (seulement si le moteur 3D est chargé)
// =====================================================================
function installer3D() {
    const D3 = W.DS3D; if (!D3 || !D3.CONSTRUIRE || D3.CONSTRUIRE.commutateurs) return;
    const { texte, mono, ecranFond, fleche, BTN } = D3.outils, C = D3.CONSTRUIRE;
    const hex = c => parseInt((COUL[c] || c).slice(1), 16);
    const T = () => W.THREE;
    Object.assign(C, {
        commutateurs(M) {
            const THREE = T();
            const lev = M.st.s.map((s, k) => {
                const x = -.36 + k * .18;
                M.boite(.1, .22, .03, x, .04, 0, 0x0b0d12);
                M.etiquette('HAUT', .12, .05, x, .22, { taille: 26, coul: '#64748b' });
                const g = new THREE.Group(); g.position.set(x, .04, .06); M.g.add(g);
                const tige = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .14, 10), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: .9 })); tige.position.y = .06; g.add(tige);
                const cap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .05, 14), new THREE.MeshStandardMaterial({ color: hex(s.c) })); cap.position.y = .13; g.add(cap);
                [tige, cap].forEach(o => { o.userData.mod = M; M.clic(o, () => M.act({ bascule: k })); });
                return g;
            });
            M.bouton({ w: .6, h: .14, x: 0, y: -.34, c: 0x15803d, texte: 'VALIDER', taille: 60 }, { valider: 1 });
            M.maj = () => lev.forEach((g, k) => { g.rotation.x = M.st.s[k].h ? .5 : Math.PI - .5; });
        },
        detresse(M) {
            const THREE = T();
            const gyro = M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .16, 24), new THREE.MeshStandardMaterial({ color: hex(M.st.c), emissive: hex(M.st.c), emissiveIntensity: 1, transparent: true, opacity: .85 })), 0, .23, .08);
            gyro.rotation.x = Math.PI / 2;
            const pl = new THREE.PointLight(hex(M.st.c), .6, 1.2); pl.position.set(0, .23, .3); M.g.add(pl);
            M.anime(() => { gyro.material.emissiveIntensity = .3 + Math.max(0, Math.sin(performance.now() / 120)) * 1.1; pl.intensity = gyro.material.emissiveIntensity * .4; });
            const e = M.ecran(.22, .14, -.3, .02, 220, 140, (ctx, w, h) => { ecranFond(ctx, w, h); mono(ctx, String(M.st.n), w / 2, h / 2 + 4, 100, '#4ade80'); });
            M.bouton({ w: .26, h: .14, x: .04, y: .02, c: 0xb91c1c, texte: 'SIGNAL', taille: 46 }, { signal: 1 });
            M.bouton({ w: .14, h: .14, x: .34, y: .02, c: BTN.c, texte: 'RAZ', taille: 50 }, { raz: 1 });
            M.bouton({ w: .7, h: .14, x: 0, y: -.32, c: 0x1d4ed8, texte: 'ÉMETTRE', taille: 56 }, { emettre: 1 });
            M.maj = () => e.maj();
        },
        hublots(M) {
            const THREE = T();
            const h = M.st.h.map((a, k) => {
                const x = -.31 + k * .31;
                M.ajouter(new THREE.Mesh(new THREE.TorusGeometry(.13, .025, 12, 32), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: .9, roughness: .3 })), x, .08, .02);
                const vitre = M.ecran(.24, .24, x, .08, 240, 240, (ctx, w, hh) => { ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, hh); for (let i = 0; i < 25; i++) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect((i * 97) % w, (i * 53) % hh, 2, 2); } dessAstre(ctx, a, w / 2, hh / 2, 82); });
                const volet = M.boite(.25, .25, .02, x, .08, .03, 0x374151); volet.visible = false;
                M.clic(vitre.mesh, () => { M.son('clic'); M.act({ hublot: k }); if (M.resolu) volet.visible = true; });
                return volet;
            });
            M.etiquette('FERMER LE HUBLOT DANGEREUX', .86, .07, 0, -.25, { taille: 30, coul: '#94a3b8' });
        },
        reservoirs(M) {
            M.st.r.forEach((r, k) => {
                const x = -.33 + k * .22;
                const e = M.ecran(.18, .52, x, .02, 180, 520, (ctx, w, h) => {
                    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, w, h);
                    const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#0ea5e9'); g.addColorStop(1, '#22d3ee');
                    ctx.fillStyle = r.c === 'orange' ? '#f97316' : '#2563eb'; ctx.fillRect(0, 0, w, 70); texte(ctx, r.c === 'orange' ? 'ORANGE' : 'BLEU', w / 2, 35, 34, '#fff');
                    ctx.fillStyle = 'rgba(56,189,248,.55)'; const hh = (h - 160) * r.n / 9; ctx.fillRect(16, h - 80 - hh, w - 32, hh);
                    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4; ctx.strokeRect(16, 80, w - 32, h - 160);
                    mono(ctx, String(r.n), w / 2, h - 40, 60, '#fde68a');
                });
                M.clic(e.mesh, () => M.act({ reservoir: k }));
            });
        },
        coordonnees(M) {
            M.ecran(.84, .18, 0, .34, 840, 180, (ctx, w, h) => { ecranFond(ctx, w, h, '#020617'); texte(ctx, '✦ ' + ETOILES[M.st.e][0], w / 2, h / 2, 70, '#fde68a'); });
            const ex = M.ecran(.2, .2, -.2, .03, 200, 200, (ctx, w, h) => { ecranFond(ctx, w, h); texte(ctx, 'X', w / 2, 30, 30, '#64748b'); mono(ctx, String(M.st.x), w / 2, h / 2 + 18, 110, '#4ade80'); });
            const ey = M.ecran(.2, .2, .2, .03, 200, 200, (ctx, w, h) => { ecranFond(ctx, w, h); texte(ctx, 'Y', w / 2, 30, 30, '#64748b'); mono(ctx, String(M.st.y), w / 2, h / 2 + 18, 110, '#4ade80'); });
            [[-.2, 'x'], [.2, 'y']].forEach(([x, k]) => { M.bouton({ w: .1, h: .09, x: x - .06, y: -.15, c: BTN.c, texte: '−', taille: 90 }, { [k]: -1 }); M.bouton({ w: .1, h: .09, x: x + .06, y: -.15, c: BTN.c, texte: '+', taille: 90 }, { [k]: 1 }); });
            M.bouton({ w: .6, h: .13, x: 0, y: -.36, c: 0x7c3aed, texte: 'ENGAGER', taille: 56 }, { engager: 1 });
            M.maj = () => { ex.maj(); ey.maj(); };
        },
        planetes(M) {
            const THREE = T();
            const leds = M.st.p.map((k, i) => {
                const x = i % 2 ? .2 : -.2, y = i < 2 ? .18 : -.2;
                M.bouton({ w: .3, h: .3, x: x, y: y, c: 0x0f172a, dessin: (ctx, w, h) => { ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h); dessPlanete(ctx, k, w / 2, h / 2 + 10, 78); } }, { planete: i });
                return M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1f2937 })), x + .17, y + .17, .02);
            });
            M.maj = () => leds.forEach((l, i) => { const on = M.st.fait.indexOf(i) >= 0; l.material.color.setHex(on ? 0x22c55e : 0x1f2937); l.material.emissive.setHex(on ? 0x22c55e : 0); l.material.emissiveIntensity = on ? 1.5 : 0; });
        },
        combinaison(M) {
            M.etiquette('DIAGNOSTIC COMBINAISON', .86, .08, 0, .4, { taille: 34, coul: '#a5b4fc' });
            COMBI.forEach((t, k) => {
                const x = k % 2 ? .2 : -.2, y = k < 2 ? .14 : -.24, c = M.st.c[k];
                M.bouton({ w: .34, h: .32, x: x, y: y, c: 0x1e293b, dessin: (ctx, w, h) => {
                    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h); dessCombi(ctx, t, w / 2, h / 2 - 10, 150, '#e2e8f0');
                    const lc = { vert: '#22c55e', jaune: '#facc15', rouge: '#ef4444', 'éteint': '#1f2937' }[c]; rond(ctx, w - 34, 34, 20, lc); ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w - 34, 34, 20, 0, Math.PI * 2); ctx.stroke();
                    texte(ctx, t.toUpperCase(), w / 2, h - 26, 30, '#94a3b8');
                } }, { piece: k });
            });
        },
        amarrage(M) {
            const e = M.ecran(.7, .7, -.06, .08, 560, 560, (ctx, w, h) => {
                ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2;
                ctx.strokeStyle = '#334155'; ctx.lineWidth = 50; ctx.beginPath(); ctx.arc(cx, cy, 210, 0, Math.PI * 2); ctx.stroke();
                M.st.ordre.forEach((L, i) => { const a = -Math.PI / 2 + (i - M.st.rot) * Math.PI / 4; texte(ctx, L, cx + Math.cos(a) * 210, cy + Math.sin(a) * 210, 50, i === M.st.rot ? '#fde68a' : '#cbd5e1'); });
                ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx + 22, 40); ctx.lineTo(cx - 22, 40); ctx.closePath(); ctx.fill();
                dessVaisseau(ctx, M.st.v, cx, cy, 170, COUL[M.st.c]);
            });
            M.bouton({ w: .12, h: .12, x: .4, y: .3, c: BTN.c, texte: '⟲', taille: 100 }, { tourne: -1 });
            M.bouton({ w: .12, h: .12, x: .4, y: .14, c: BTN.c, texte: '⟳', taille: 100 }, { tourne: 1 });
            M.bouton({ w: .6, h: .12, x: -.06, y: -.38, c: 0x0e7490, texte: 'AMARRER', taille: 56 }, { amarrer: 1 });
            M.maj = () => e.maj();
        },
        radio(M) {
            M.ecran(.84, .22, 0, .3, 840, 220, (ctx, w, h) => { ecranFond(ctx, w, h, '#0a0f02'); texte(ctx, 'APPEL ENTRANT', w / 2, 42, 32, '#84cc16'); mono(ctx, RADIO[M.st.m][0] + '-' + M.st.n, w / 2, 140, 92, '#d9f99d'); });
            const c = M.ecran(.3, .2, 0, -.02, 300, 200, (ctx, w, h) => { ecranFond(ctx, w, h, '#1a0f00'); texte(ctx, 'CANAL', w / 2, 34, 30, '#a16207'); mono(ctx, String(M.st.c), w / 2, 120, 120, '#fbbf24'); });
            M.bouton({ w: .14, h: .14, x: -.3, y: -.02, c: BTN.c, texte: '◀', taille: 90 }, { canal: -1 });
            M.bouton({ w: .14, h: .14, x: .3, y: -.02, c: BTN.c, texte: '▶', taille: 90 }, { canal: 1 });
            M.bouton({ w: .6, h: .13, x: 0, y: -.34, c: 0x4d7c0f, texte: 'ÉMETTRE', taille: 56 }, { emettre: 1 });
            M.maj = () => c.maj();
        },
        balance(M) {
            const THREE = T();
            const fleau = new THREE.Group(); fleau.position.set(0, .1, .08); M.g.add(fleau);
            M.boite(.05, .3, .04, 0, -.08, 0, 0x475569);
            const barre = new THREE.Mesh(new THREE.BoxGeometry(.86, .025, .03), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: .8 })); fleau.add(barre);
            const bloc = (c, cote, cran, gris) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .05), new THREE.MeshStandardMaterial({ color: gris ? 0x9ca3af : hex(c), metalness: gris ? .8 : .2 })); b.position.set(cote * cran * .1, .05, 0); fleau.add(b); return b; };
            for (let k = 1; k <= 4; k++) [-1, 1].forEach(s => { const t = new THREE.Mesh(new THREE.BoxGeometry(.006, .03, .032), new THREE.MeshStandardMaterial({ color: 0x334155 })); t.position.set(s * k * .1, -.02, .01); fleau.add(t); });
            M.st.g.forEach((c, i) => { if (c) bloc(c, -1, i + 1); });
            M.st.d.forEach((c, i) => { if (c) bloc(c, 1, i + 1); });
            const cp = bloc('gris', 1, M.st.p, true); cp.position.y = -.06; cp.scale.set(1, 1.2, 1);
            M.etiquette('1   2   3   4', .4, .05, .23, -.03, { taille: 30, coul: '#64748b' });
            M.bouton({ w: .14, h: .12, x: -.3, y: -.25, c: BTN.c, texte: '◀', taille: 80 }, { pos: -1 });
            M.bouton({ w: .14, h: .12, x: -.12, y: -.25, c: BTN.c, texte: '▶', taille: 80 }, { pos: 1 });
            M.bouton({ w: .36, h: .12, x: .2, y: -.25, c: 0x15803d, texte: 'STABILISER', taille: 44 }, { stabiliser: 1 });
            M.etiquette('CONTREPOIDS', .3, .05, -.21, -.37, { taille: 28, coul: '#94a3b8' });
            M.maj = () => { cp.position.x = M.st.p * .1; };
            M.anime(() => { fleau.rotation.z = Math.sin(performance.now() / 700) * .04; });
        },
        phases(M) {
            M.ecran(.86, .26, 0, .32, 860, 260, (ctx, w, h) => { ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h); M.st.p.forEach((k, i) => dessPhase(ctx, k, 110 + i * 213, h / 2, 90)); });
            const aff = M.ecran(.4, .12, -.22, .1, 400, 120, (ctx, w, h) => { ecranFond(ctx, w, h); mono(ctx, M.st.s.padEnd(4, '_').split('').join(' '), w / 2, h / 2 + 4, 76, '#4ade80'); });
            ['1', '2', '3', '4', '5', '6', '7', 'EFF', '0', 'OK'].forEach((t, k) => {
                const x = -.38 + (k % 5) * .19, y = -.08 - Math.floor(k / 5) * .14;
                M.bouton({ w: .16, h: .12, x: x, y: y, c: t === 'OK' ? 0x15803d : t === 'EFF' ? 0x9f1239 : BTN.c, texte: t, taille: t.length > 1 ? 46 : 72 }, t === 'OK' ? { entrer: 1 } : t === 'EFF' ? { effacer: 1 } : { chiffre: t });
            });
            M.etiquette('CODEX', .3, .07, .28, .1, { taille: 34, coul: '#94a3b8' });
            M.maj = () => aff.maj();
        },
        pulsar(M) {
            const THREE = T(), col = { blanc: 0xf8fafc, bleu: 0x3b82f6, rouge: 0xef4444 }[M.st.c];
            const len = M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.14, 28, 20), new THREE.MeshStandardMaterial({ color: 0x111827, emissive: col, emissiveIntensity: 0 })), 0, .14, .06);
            M.ajouter(new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 12, 32), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: .9 })), 0, .14, .05);
            const per = M.st.vite ? 170 : 420, cycle = per * M.st.n * 2 + 1800;
            M.anime(() => { const t = performance.now() % cycle, k = Math.floor(t / per), on = t < per * M.st.n * 2 && k % 2 === 0; len.material.emissiveIntensity = on ? 2.4 : 0; len.material.color.setHex(on ? col : 0x111827); });
            ROM.forEach((r, k) => M.bouton({ w: .18, h: .14, x: -.3 + k * .2, y: -.27, c: 0x334155, texte: r, taille: 70 }, { bouton: r }));
            M.etiquette('PULSAR', .3, .06, 0, -.42, { taille: 30, coul: '#64748b' });
        },
        tuyaux(M) {
            const ent = M.etiquette('▶', .06, .08, -.45, .02, { taille: 60, coul: '#22d3ee', fond: '#0b0d12' });
            const lc = COUL[M.st.l];
            const voyant = M.ecran(.2, .07, -.3, .42, 200, 70, (ctx, w, h) => { ctx.fillStyle = lc; ctx.fillRect(0, 0, w, h); texte(ctx, 'LIQUIDE', w / 2, h / 2, 34, '#0b0b14'); });
            const tuiles = M.st.g.map((t, i) => {
                const x = -.24 + (i % 3) * .22, y = .24 - Math.floor(i / 3) * .22;
                return M.bouton({ w: .2, h: .2, x: x, y: y, c: 0x1f2937, dessin: (ctx, w, h) => {
                    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h); const o = tuyOuverts(M.st.g[i]), cx = w / 2, cy = h / 2;
                    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 44; ctx.lineCap = 'butt';
                    [[1, cx, 0], [2, w, cy], [4, cx, h], [8, 0, cy]].forEach(([b, x2, y2]) => { if (o & b) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke(); } });
                    ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#020617'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
                } }, { tuile: i });
            });
            [0, 1, 2].forEach(r => M.etiquette('▶', .05, .07, .43, .24 - r * .22, { taille: 50, coul: '#475569', fond: '#0b0d12' }));
            M.bouton({ w: .5, h: .1, x: .1, y: -.42, c: 0x0e7490, texte: 'FAIRE CIRCULER', taille: 40 }, { circuler: 1 });
            M.maj = () => tuiles.forEach(t => t.userData.redessiner());
        },
        horloge(M) {
            M.ecran(.86, .26, 0, .3, 860, 260, (ctx, w, h) => { ecranFond(ctx, w, h, '#06131f'); texte(ctx, 'HEURE LOCALE · ' + HORL[M.st.p][0], w / 2, 50, 36, '#7dd3fc'); mono(ctx, `${String(M.st.h).padStart(2, '0')}:${String(M.st.m).padStart(2, '0')}`, w / 2, 160, 110, '#e0f2fe'); });
            const b = M.ecran(.5, .18, 0, -.03, 500, 180, (ctx, w, h) => { ecranFond(ctx, w, h, '#1a0f00'); texte(ctx, 'HEURE DE BORD', w / 2, 28, 26, '#a16207'); mono(ctx, `${String(M.st.sh).padStart(2, '0')}:${String(M.st.sm).padStart(2, '0')}`, w / 2, 112, 100, '#fbbf24'); });
            [[-.36, 'h', 1, '▲'], [-.36, 'h', -1, '▼'], [.36, 'm', 1, '▲'], [.36, 'm', -1, '▼']].forEach(([x, k, s, t]) => M.bouton({ w: .1, h: .08, x: x, y: s > 0 ? .02 : -.08, c: BTN.c, texte: t, taille: 60 }, { [k]: s }));
            M.etiquette('H', .06, .05, -.36, .1, { taille: 40, coul: '#64748b' }); M.etiquette('MIN', .1, .05, .36, .1, { taille: 34, coul: '#64748b' });
            M.bouton({ w: .66, h: .13, x: 0, y: -.34, c: 0x1d4ed8, texte: 'SYNCHRONISER', taille: 50 }, { synchro: 1 });
            M.maj = () => b.maj();
        },
        barres(M, THREE0, DS0, E) {
            const THREE = T();
            const e = M.ecran(.86, .32, 0, .28, 860, 320, (ctx, w, h) => {
                const x = M.def.etape(M.st), lc = { vert: '#22c55e', orange: '#f97316', rouge: '#ef4444' }[x.l];
                ecranFond(ctx, w, h, '#100604'); texte(ctx, 'TEMPÉRATURE DU CŒUR', w * .4, 50, 34, '#fca5a5');
                mono(ctx, x.t + '°', w * .4, 190, 140, '#fef2f2'); rond(ctx, w * .85, h / 2, 64, lc); ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w * .85, h / 2, 64, 0, Math.PI * 2); ctx.stroke();
            });
            const leds = [0, 1, 2].map(k => M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1f2937 })), -.4 + k * .07, .46, .01));
            BAR.forEach((b, k) => M.bouton({ w: .22, h: .3, x: -.26 + k * .26, y: -.22, c: 0x334155, dessin: (ctx, w, h) => { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#94a3b8'; ctx.fillRect(w * .4, 30, w * .2, h - 110); texte(ctx, b, w / 2, h - 50, 80, '#fde68a'); } }, { barre: b }));
            M.maj = () => { e.maj(); leds.forEach((l, k) => { const on = k < M.st.k; l.material.emissive.setHex(on ? 0x22c55e : 0); l.material.emissiveIntensity = on ? 1.6 : 0; l.material.color.setHex(on ? 0x86efac : 0x1f2937); }); };
        },
        teleport(M) {
            M.ecran(.4, .14, -.2, .38, 400, 140, (ctx, w, h) => { ecranFond(ctx, w, h, '#02121a'); mono(ctx, '⟶ ' + TELE[M.st.d][0], w / 2, h / 2 + 4, 76, '#67e8f9'); });
            const pads = M.st.p.map((v, i) => {
                const x = -.24 + (i % 3) * .19, y = .17 - Math.floor(i / 3) * .19;
                return M.bouton({ w: .16, h: .16, x: x, y: y, rond: true, c: 0x1e293b, dessin: (ctx, w, h) => { ctx.fillStyle = M.st.p[i] ? '#22d3ee' : '#0f172a'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .46, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = M.st.p[i] ? '#cffafe' : '#334155'; ctx.lineWidth = 10; ctx.stroke(); } }, { pad: i });
            });
            M.bouton({ w: .14, h: .52, x: .37, y: -.01, c: 0x0891b2, dessin: (ctx, w, h) => { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); texte(ctx, 'TÉLÉPORTER', 0, 0, 60, '#fff'); ctx.restore(); } }, { teleporter: 1 });
            M.maj = () => pads.forEach(p => p.userData.redessiner());
        },
        suite(M) {
            const fc = COUL[M.st.c];
            M.ecran(.86, .3, 0, .3, 860, 300, (ctx, w, h) => { ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = fc; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14); M.st.t.forEach((n, i) => dessChiffreX(ctx, n, 115 + i * 180, h / 2, 178, '#fde68a')); texte(ctx, '?', w - 70, h / 2, 90, '#f472b6'); });
            const aff = M.ecran(.36, .12, -.24, .07, 360, 120, (ctx, w, h) => { ecranFond(ctx, w, h); mono(ctx, M.st.s.padEnd(2, '_'), w / 2, h / 2 + 4, 86, '#4ade80'); });
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'EFF', '0', 'OK'].forEach((t, k) => {
                const x = -.06 + (k % 4) * .145, y = .07 - Math.floor(k / 4) * .14;
                M.bouton({ w: .13, h: .12, x: x, y: y, c: t === 'OK' ? 0x15803d : t === 'EFF' ? 0x9f1239 : BTN.c, texte: t, taille: t.length > 1 ? 44 : 70 }, t === 'OK' ? { entrer: 1 } : t === 'EFF' ? { effacer: 1 } : { chiffre: t });
            });
            M.maj = () => aff.maj();
        },
        laser(M) {
            let tir = 0;
            const e = M.ecran(.74, .74, -.05, .05, 592, 592, (ctx, w, h) => {
                ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h); const c = 118, o = 60;
                ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(o + i * c, o); ctx.lineTo(o + i * c, o + 4 * c); ctx.moveTo(o, o + i * c); ctx.lineTo(o + 4 * c, o + i * c); ctx.stroke(); }
                ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(8, o + M.st.e * c + c / 2 - 18); ctx.lineTo(44, o + M.st.e * c + c / 2); ctx.lineTo(8, o + M.st.e * c + c / 2 + 18); ctx.fill();
                M.st.rec.forEach((r, k) => { ctx.fillStyle = COUL[r]; ctx.fillRect(o + 4 * c + 10, o + k * c + 24, 34, c - 48); });
                M.st.m.forEach((m, i) => { if (!m) return; const x = o + (i % 4) * c, y = o + Math.floor(i / 4) * c; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 12; ctx.beginPath(); if (m === '/') { ctx.moveTo(x + 22, y + c - 22); ctx.lineTo(x + c - 22, y + 22); } else { ctx.moveTo(x + 22, y + 22); ctx.lineTo(x + c - 22, y + c - 22); } ctx.stroke(); });
                if (performance.now() - tir < 900) {   // tracé du rayon au moment du tir
                    let y = M.st.e, x = -1, dx = 1, dy = 0; ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 8; ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(o - 16, o + y * c + c / 2);
                    for (let pas = 0; pas < 40; pas++) { x += dx; y += dy; const px = o + x * c + c / 2, py = o + y * c + c / 2; if (x < 0 || x > 3 || y < 0 || y > 3) { ctx.lineTo(o + Math.max(-.2, Math.min(4.2, x + .5)) * c - (x > 3 ? c * .4 : 0), py); break; } ctx.lineTo(px, py); const m = M.st.m[y * 4 + x]; if (m === '/') [dx, dy] = [-dy, -dx]; else if (m === '\\') [dx, dy] = [dy, dx]; }
                    ctx.stroke(); ctx.shadowBlur = 0;
                }
            }, true);
            // zones cliquables sur les miroirs : on calcule la case touchée sur l'écran
            M.clic(e.mesh, h => {
                if (!h || !h.point) return;
                const p = M.g.worldToLocal(h.point.clone()), u = (p.x + .05) / .74 + .5, v = .5 - (p.y - .05) / .74;
                const X = Math.floor((u * 592 - 60) / 118), Y = Math.floor((v * 592 - 60) / 118);
                if (X >= 0 && X < 4 && Y >= 0 && Y < 4 && M.st.m[Y * 4 + X]) { M.son('clic'); M.act({ miroir: Y * 4 + X }); }
            });
            M.bouton({ w: .14, h: .3, x: .4, y: -.25, c: 0xb91c1c, dessin: (ctx, w, h) => { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); texte(ctx, 'TIRER', 0, 0, 70, '#fff'); ctx.restore(); } }, () => { tir = performance.now(); M.act({ tirer: 1 }); });
        },
        appel(M) {
            M.ecran(.86, .44, 0, .2, 860, 440, (ctx, w, h) => {
                const st = M.st; ecranFond(ctx, w, h, st.actif ? '#06131f' : '#05070a');
                if (!st.actif) { texte(ctx, '📡 AUCUN APPEL', w / 2, h / 2, 46, '#334155'); return; }
                const reste = Math.max(0, Math.ceil((st.fin - Date.now()) / 1000));
                texte(ctx, '📡 APPEL ENTRANT', w / 2, 60, 38, '#7dd3fc'); texte(ctx, APPELS[st.a][0], w / 2, 200, 70, '#f0f9ff'); mono(ctx, reste + ' s', w / 2, 340, 60, reste <= 10 ? '#f87171' : '#93c5fd');
            }, true);
            M.bouton({ w: .38, h: .17, x: -.21, y: -.28, c: 0x15803d, texte: 'ACCEPTER', taille: 50 }, { rep: 1 });
            M.bouton({ w: .38, h: .17, x: .21, y: -.28, c: 0x9f1239, texte: 'REFUSER', taille: 50 }, { rep: 0 });
        },
        refroidissement(M) {
            M.ecran(.86, .42, 0, .22, 860, 420, (ctx, w, h) => {
                const st = M.st; ecranFond(ctx, w, h, st.actif ? '#1a0505' : '#05070a');
                if (!st.actif) { texte(ctx, 'TEMPÉRATURE NOMINALE', w / 2, h / 2, 42, '#334155'); return; }
                const reste = Math.max(0, Math.ceil((st.fin - Date.now()) / 1000));
                texte(ctx, 'SURCHAUFFE', w / 2, 56, 40, '#fca5a5'); texte(ctx, REF_ICONE[st.s], w / 2, 200, 140, '#fff'); mono(ctx, reste + ' s', w / 2, 350, 56, reste <= 10 ? '#f87171' : '#fecaca');
            }, true);
            REF_V.forEach((v, k) => M.bouton({ w: .2, h: .2, rond: true, x: -.28 + k * .28, y: -.27, c: COUL[v] }, { vanne: v }));
        }
    });
}
installer3D();
DS.installer3D = installer3D;
DS.dessins = { dessAstre, dessPlanete, dessPhase, dessVaisseau, dessCombi, dessChiffreX };
})();
