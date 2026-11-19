// =====================================================================
//  CHARGE INSTABLE — données, logique des modules et manuel de neutralisation
//  (aucune 3D ici : ce fichier sert à la fois au démineur, aux experts et aux tests)
//
//  Chaque module : { id, nom, diff (1 à 4), besoin (module récurrent),
//     gen(R, E)            -> état du module (aléatoire, à partir de la graine de la partie)
//     act(st, E, a, now)   -> 'ok' (module neutralisé) | 'err' (erreur) | undefined (progression)
//     sol(st, E, now)      -> prochaine(s) action(s) qui mènent à la solution (tests, démonstration)
//     manuel()             -> HTML de la page du manuel }
// =====================================================================
(function () {
const W = typeof window !== 'undefined' ? window : globalThis;

// ------------------------------- Hasard reproductible -------------------------------
function dsRng(seed) {
    let a = seed >>> 0;
    const R = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    R.int = (x, y) => x + Math.floor(R() * (y - x + 1));
    R.pick = arr => arr[Math.floor(R() * arr.length)];
    R.shuffle = arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    return R;
}

// ------------------------------- L'engin (la charge) -------------------------------
const DS_BALISES = ['ORB', 'NAV', 'COM', 'GRV', 'LUX', 'SOL', 'CRY'];
const DS_PORTS = ['Plasma', 'Quantique', 'Fibre', 'Gravitonique'];
const DS_EMBLEMES = ['Mars', 'Europe', 'Titan', 'Io', 'Cérès'];
const DS_VOY = 'AEIOUY';
function dsEngin(R) {
    const L = 'ABCDEFGHJKLMNPQRSTUVXYZ', D = '0123456789';
    const mat = [R.pick(L), R.pick(L), R.pick(D), R.pick(L), R.pick(D), R.pick(D)].join('');
    const nb = R.int(0, 3);
    const balises = R.shuffle(DS_BALISES).slice(0, nb).map(n => ({ n: n, on: R() < .5 }));
    const ports = R.shuffle(DS_PORTS).slice(0, R.int(0, 3));
    return dsCompleter({ mat: mat, cellules: R.int(0, 4), balises: balises, ports: ports, emb: R.pick(DS_EMBLEMES) });
}
// ajoute les propriétés calculées utilisées par les règles
function dsCompleter(E) {
    const ch = [...E.mat].filter(c => /\d/.test(c)).map(Number);
    E.chiffres = ch;
    E.dernier = ch[ch.length - 1];
    E.somme = ch.reduce((t, x) => t + x, 0);
    E.voyelle = [...E.mat].some(c => DS_VOY.indexOf(c) >= 0);
    E.debutVoyelle = DS_VOY.indexOf(E.mat[0]) >= 0;
    E.balise = n => E.balises.some(b => b.n === n);
    E.baliseOn = n => E.balises.some(b => b.n === n && b.on);
    E.nbOn = E.balises.filter(b => b.on).length;
    E.port = n => E.ports.indexOf(n) >= 0;
    return E;
}

// ------------------------------- Glyphes xénolithes (24) -------------------------------
// mini-langage sur une grille 10 × 10 : P x,y x,y… (ligne brisée) | C x,y,r (cercle) | D x,y,r (point plein) | A x,y,r,a0,a1 (arc, degrés, sens horaire à l'écran)
const DS_GLYPHES = [
    ['Œil', 'C5,5,3.6|D5,5,1.3'], ['Trident', 'P5,9 5,2|P2,2 2,5 8,5 8,2'], ['Lune', 'A5,5,4,60,300|A7.2,5,2.8,105,255'],
    ['Sablier', 'P2,1 8,1 2,9 8,9 2,1'], ['Étoile', 'P5,1 6.2,4 9,4 6.8,6 7.6,9 5,7.2 2.4,9 3.2,6 1,4 3.8,4 5,1'], ['Fourche', 'P5,1 5,5 2,9|P5,5 8,9'],
    ['Peigne', 'P1,2 9,2|P2,2 2,8|P5,2 5,8|P8,2 8,8'], ['Serpent', 'P2,2 8,2 8,5 2,5 2,8 8,8'], ['Ancre', 'P5,1 5,9|P2,6 5,9 8,6|P3,3 7,3'],
    ['Œil barré', 'C5,5,3.6|P1.5,8.5 8.5,1.5'], ['Grille', 'P3.5,1 3.5,9|P6.5,1 6.5,9|P1,3.5 9,3.5|P1,6.5 9,6.5'], ['Flèche double', 'P1,5 9,5|P3,3 1,5 3,7|P7,3 9,5 7,7'],
    ['Pyramide', 'P5,1 9,9 1,9 5,1|D5,6.3,1'], ['Couronne', 'P1,8 1,3 3.5,6 5,2 6.5,6 9,3 9,8 1,8'], ['Clé', 'C3,5,2|P5,5 9,5 9,7|P7,5 7,7'],
    ['Éclair', 'P6,1 3,5.5 6,5.5 4,9'], ['Cible', 'C5,5,4|C5,5,2'], ['Losange', 'P5,1 9,5 5,9 1,5 5,1|P5,1 5,9'],
    ['Antenne', 'P5,9 5,4|A5,4,2,200,340|A5,4,3.6,200,340'], ['Escalier', 'P1,9 1,7 3.6,7 3.6,4.6 6.3,4.6 6.3,2.2 9,2.2'], ['Pince', 'P2,1 5,5 8,1|P5,5 5,9|P3,9 7,9'],
    ['Soleil', 'C5,5,2|P5,0.8 5,2.2|P5,7.8 5,9.2|P0.8,5 2.2,5|P7.8,5 9.2,5'], ['Vagues', 'P1,4 3,2 5,4 7,2 9,4|P1,8 3,6 5,8 7,6 9,8'], ['Porte', 'P2,9 2,1 8,1 8,9|D6.5,5.5,0.8']
];
const DS_MASSE = [17, 3, 22, 9, 1, 14, 6, 20, 11, 24, 4, 15, 8, 19, 2, 13, 23, 7, 16, 10, 21, 5, 18, 12];
const DS_LETTRE = 'NAEROSTLUCIMPDBGHVFQJXKY';
function dsSegments(def) {
    return def.split('|').map(s => {
        const t = s[0], r = s.slice(1);
        if (t === 'P') return { t: 'P', p: r.trim().split(/\s+/).map(q => q.split(',').map(Number)) };
        const v = r.split(',').map(Number);
        return { t: t, v: v };
    });
}
function dsGlypheSVG(i, taille, coul) {
    const s = taille || 40, c = coul || '#e2e8f0';
    const corps = dsSegments(DS_GLYPHES[i][1]).map(g => {
        if (g.t === 'P') return `<polyline points="${g.p.map(p => p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (g.t === 'C') return `<circle cx="${g.v[0]}" cy="${g.v[1]}" r="${g.v[2]}" fill="none" stroke="${c}" stroke-width=".9"/>`;
        if (g.t === 'D') return `<circle cx="${g.v[0]}" cy="${g.v[1]}" r="${g.v[2]}" fill="${c}"/>`;
        if (g.t === 'A') { const [x, y, r, a0, a1] = g.v, p = a => [x + r * Math.cos(a * Math.PI / 180), y + r * Math.sin(a * Math.PI / 180)];
            const A = p(a0), B = p(a1), grand = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
            return `<path d="M${A[0].toFixed(2)},${A[1].toFixed(2)} A${r},${r} 0 ${grand} 1 ${B[0].toFixed(2)},${B[1].toFixed(2)}" fill="none" stroke="${c}" stroke-width=".9" stroke-linecap="round"/>`; }
        return '';
    }).join('');
    return `<svg viewBox="0 0 10 10" width="${s}" height="${s}" style="overflow:visible">${corps}</svg>`;
}
function dsGlypheCanvas(ctx, i, x, y, taille, coul, epais) {
    const k = taille / 10;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.strokeStyle = coul; ctx.fillStyle = coul; ctx.lineWidth = (epais || 0.9); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    dsSegments(DS_GLYPHES[i][1]).forEach(g => {
        ctx.beginPath();
        if (g.t === 'P') { g.p.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
        else if (g.t === 'C') { ctx.arc(g.v[0], g.v[1], g.v[2], 0, Math.PI * 2); ctx.stroke(); }
        else if (g.t === 'D') { ctx.arc(g.v[0], g.v[1], g.v[2], 0, Math.PI * 2); ctx.fill(); }
        else if (g.t === 'A') { ctx.arc(g.v[0], g.v[1], g.v[2], g.v[3] * Math.PI / 180, g.v[4] * Math.PI / 180); ctx.stroke(); }
    });
    ctx.restore();
}

// ------------------------------- Petits outils -------------------------------
const COUL = { rouge: '#e11d48', bleu: '#2563eb', jaune: '#facc15', blanc: '#f1f5f9', noir: '#111827', vert: '#16a34a', orange: '#f97316',
    violet: '#8b5cf6', cyan: '#22d3ee', magenta: '#e879f9', ambre: '#f59e0b', bleue: '#3b82f6', verte: '#22c55e', violette: '#a855f7' };
const ORD = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième'];
const nb = (arr, v) => arr.filter(x => x === v).length;
const dernierIdx = (arr, v) => arr.lastIndexOf(v);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pastille = c => `<span class="mn-pc" style="background:${COUL[c] || c}"></span>`;
const SYMBOLES = { losange: '◆', cercle: '●', triangle: '▲', carre: '■' };
const SYM_NOM = { losange: 'losange', cercle: 'cercle', triangle: 'triangle', carre: 'carré' };
function regles(liste) { return `<ol class="mn-regles">${liste.map(r => `<li>${r}</li>`).join('')}</ol>`; }
function evalRegles(rs, ...args) { for (const r of rs) if (r.f(...args)) return r.k(...args); return null; }

// =====================================================================
//  LES MODULES
// =====================================================================
const M = [];

// ---------- 1. Conduits d'alimentation ----------
const COND_COUL = ['rouge', 'bleu', 'jaune', 'blanc', 'noir', 'vert'];
const COND = {
    3: [
        { t: "S'il n'y a <b>aucun conduit vert</b>, coupez le <b>deuxième</b> conduit.", f: c => nb(c, 'vert') === 0, k: () => 1 },
        { t: "Sinon, si le <b>dernier</b> conduit est <b>blanc</b>, coupez le <b>dernier</b> conduit.", f: c => c[c.length - 1] === 'blanc', k: c => c.length - 1 },
        { t: "Sinon, s'il y a <b>plus d'un conduit bleu</b>, coupez le <b>dernier conduit bleu</b>.", f: c => nb(c, 'bleu') > 1, k: c => dernierIdx(c, 'bleu') },
        { t: "Sinon, coupez le <b>premier</b> conduit.", f: () => true, k: () => 0 }],
    4: [
        { t: "Si le <b>dernier chiffre de la matricule est pair</b> et qu'il y a au moins un conduit rouge, coupez le <b>dernier conduit rouge</b>.", f: (c, E) => E.dernier % 2 === 0 && nb(c, 'rouge') > 0, k: c => dernierIdx(c, 'rouge') },
        { t: "Sinon, s'il n'y a <b>aucun conduit jaune</b>, coupez le <b>troisième</b> conduit.", f: c => nb(c, 'jaune') === 0, k: () => 2 },
        { t: "Sinon, s'il y a <b>exactement un conduit noir</b>, coupez le <b>premier</b> conduit.", f: c => nb(c, 'noir') === 1, k: () => 0 },
        { t: "Sinon, s'il y a <b>plus d'un conduit vert</b>, coupez le <b>dernier conduit vert</b>.", f: c => nb(c, 'vert') > 1, k: c => dernierIdx(c, 'vert') },
        { t: "Sinon, coupez le <b>deuxième</b> conduit.", f: () => true, k: () => 1 }],
    5: [
        { t: "Si le <b>dernier</b> conduit est <b>noir</b> et qu'une <b>balise NAV est allumée</b>, coupez le <b>quatrième</b> conduit.", f: (c, E) => c[c.length - 1] === 'noir' && E.baliseOn('NAV'), k: () => 3 },
        { t: "Sinon, s'il y a <b>exactement un conduit rouge</b> et <b>plus d'un conduit jaune</b>, coupez le <b>premier</b> conduit.", f: c => nb(c, 'rouge') === 1 && nb(c, 'jaune') > 1, k: () => 0 },
        { t: "Sinon, s'il n'y a <b>aucun conduit blanc</b>, coupez le <b>deuxième</b> conduit.", f: c => nb(c, 'blanc') === 0, k: () => 1 },
        { t: "Sinon, si la charge porte <b>au moins deux cellules d'énergie</b>, coupez le <b>dernier</b> conduit.", f: (c, E) => E.cellules >= 2, k: c => c.length - 1 },
        { t: "Sinon, coupez le <b>troisième</b> conduit.", f: () => true, k: () => 2 }],
    6: [
        { t: "S'il n'y a <b>aucun conduit jaune</b> et que la <b>matricule contient une voyelle</b>, coupez le <b>troisième</b> conduit.", f: (c, E) => nb(c, 'jaune') === 0 && E.voyelle, k: () => 2 },
        { t: "Sinon, s'il y a <b>exactement un conduit jaune</b> et <b>plus d'un conduit blanc</b>, coupez le <b>quatrième</b> conduit.", f: c => nb(c, 'jaune') === 1 && nb(c, 'blanc') > 1, k: () => 3 },
        { t: "Sinon, s'il n'y a <b>aucun conduit rouge</b>, coupez le <b>dernier</b> conduit.", f: c => nb(c, 'rouge') === 0, k: c => c.length - 1 },
        { t: "Sinon, si la charge possède un <b>port Plasma</b>, coupez le <b>cinquième</b> conduit.", f: (c, E) => E.port('Plasma'), k: () => 4 },
        { t: "Sinon, coupez le <b>quatrième</b> conduit.", f: () => true, k: () => 3 }]
};
M.push({
    id: 'conduits', nom: 'Conduits d’alimentation', diff: 1,
    gen(R) { const n = R.int(3, 6); return { c: Array.from({ length: n }, () => R.pick(COND_COUL)), coupes: [] }; },
    solution(st, E) { return evalRegles(COND[st.c.length], st.c, E); },
    act(st, E, a) {
        if (a.coupe == null || st.coupes.indexOf(a.coupe) >= 0) return;
        st.coupes.push(a.coupe);
        return a.coupe === this.solution(st, E) ? 'ok' : 'err';
    },
    sol(st, E) { return [{ coupe: this.solution(st, E) }]; },
    manuel() {
        return `<p class="mn-p">Entre 3 et 6 conduits colorés traversent le module à l'horizontale. Un seul doit être coupé. Les conduits se comptent <b>de haut en bas</b> : le « premier » est celui du haut.</p>
            <p class="mn-p">Couleurs possibles : ${COND_COUL.map(c => pastille(c) + ' ' + c).join(' · ')}.</p>
            ${[3, 4, 5, 6].map(n => `<h4 class="mn-h4">${n} conduits</h4>${regles(COND[n].map(r => r.t))}`).join('')}
            <div class="mn-note">Couper le mauvais conduit déclenche une erreur, mais le module reste actif : continuez à suivre la même règle.</div>`;
    }
});

// ---------- 2. Valve de pression ----------
M.push({
    id: 'valve', nom: 'Valve de pression', diff: 1,
    gen(R) { return { col: R.pick(['rouge', 'bleu', 'vert']), v: R.int(0, 9) }; },
    cible(st, E) {
        let t = st.col === 'rouge' ? E.somme : st.col === 'bleu' ? E.dernier * 3 : (E.ports.length + E.balises.length) * 4 + E.cellules;
        t %= 10; if (E.baliseOn('GRV')) t = 9 - t; return t;
    },
    act(st, E, a) {
        if (a.plus) st.v = (st.v + 1) % 10;
        else if (a.moins) st.v = (st.v + 9) % 10;
        else if (a.verrou) return st.v === this.cible(st, E) ? 'ok' : 'err';
    },
    sol(st, E) { const c = this.cible(st, E); return st.v === c ? [{ verrou: 1 }] : [{ plus: 1 }]; },
    manuel() {
        return `<p class="mn-p">Une grosse molette entourée d'un anneau coloré règle la pression de 0 à 9 (affichée sur le petit écran). Réglez la pression cible avec les touches <b>−</b> et <b>+</b>, puis appuyez sur <b>VERROUILLER</b>.</p>
            <h4 class="mn-h4">Calcul de la pression cible</h4>
            <table class="mn-table"><tr><th>Anneau</th><th>Valeur de départ</th></tr>
            <tr><td>${pastille('rouge')} Rouge</td><td>la somme de tous les chiffres de la matricule</td></tr>
            <tr><td>${pastille('bleu')} Bleu</td><td>le dernier chiffre de la matricule, multiplié par 3</td></tr>
            <tr><td>${pastille('vert')} Vert</td><td>(nombre de ports + nombre de balises) × 4, plus le nombre de cellules d'énergie</td></tr></table>
            ${regles(['Ne gardez que le <b>chiffre des unités</b> de cette valeur (ex. : 23 → 3).', 'Si une <b>balise GRV est allumée</b>, remplacez le résultat par <b>9 moins le résultat</b>.', 'Réglez la molette sur ce chiffre et verrouillez.'])}
            <div class="mn-ex"><b>Exemple :</b> anneau bleu, matricule KX4R72 → 2 × 3 = 6. Balise GRV allumée → 9 − 6 = <b>3</b>.</div>`;
    }
});

// ---------- 3. Constellations ----------
const CONST = [
    ['Le Grand Calmar', [0, 5, 10, 15, 11]], ['La Comète Ivre', [3, 6, 9, 12]], ['Le Phare', [1, 2, 6, 10, 14]], ['La Méduse', [4, 1, 2, 7, 11]],
    ['Le Cerf-Volant', [2, 5, 8, 13]], ['L’Hippocampe', [0, 1, 5, 9, 8]], ['La Lanterne', [12, 8, 9, 13]], ['Le Serpentaire Bleu', [3, 2, 6, 5, 4]],
    ['La Balance Brisée', [8, 4, 5, 6, 10]], ['Le Petit Robot', [15, 14, 10, 6, 7]], ['La Harpe d’Orion', [12, 13, 14, 11, 7]], ['Le Chat Cosmique', [0, 4, 9, 13, 14]]
];
function constSVG(seq, taille) {
    const s = taille || 120, pos = i => [15 + (i % 4) * 30, 15 + Math.floor(i / 4) * 30];
    let o = `<svg viewBox="0 0 120 120" width="${s}" height="${s}"><rect x="0" y="0" width="120" height="120" rx="10" fill="#020617" stroke="#1e3a5f"/>`;
    for (let i = 0; i < 16; i++) { const [x, y] = pos(i); o += `<circle cx="${x}" cy="${y}" r="3" fill="#334155"/>`; }
    o += `<polyline points="${seq.map(i => pos(i).join(',')).join(' ')}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    seq.forEach((i, k) => { const [x, y] = pos(i); o += `<circle cx="${x}" cy="${y}" r="9" fill="#0c4a6e" stroke="#7dd3fc"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#f0f9ff">${k + 1}</text>`; });
    return o + '</svg>';
}
M.push({
    id: 'constellations', nom: 'Constellations', diff: 1,
    gen(R) { return { k: R.int(0, CONST.length - 1), pos: 0 }; },
    ordre(st, E) { const s = CONST[st.k][1].slice(); return E.emb === 'Io' ? s.reverse() : s; },
    act(st, E, a) {
        if (a.etoile == null) return;
        const s = this.ordre(st, E);
        if (a.etoile === s[st.pos]) { st.pos++; return st.pos >= s.length ? 'ok' : undefined; }
        st.pos = 0; return 'err';
    },
    sol(st, E) { return [{ etoile: this.ordre(st, E)[st.pos] }]; },
    manuel() {
        return `<p class="mn-p">Un petit écran affiche le <b>nom d'une constellation</b>. En dessous, 16 étoiles forment une grille de 4 × 4. Touchez les étoiles de la constellation <b>dans l'ordre indiqué</b> par les numéros ci-dessous.</p>
            ${regles(['Repérez le nom affiché sur le module.', 'Faites toucher les étoiles dans l’ordre 1, 2, 3…', 'Si l’<b>emblème de mission est Io</b>, touchez-les dans l’<b>ordre inverse</b> (en commençant par le plus grand numéro).', 'Une étoile incorrecte provoque une erreur et remet la séquence à zéro.'])}
            <div class="mn-grille-fig">${CONST.map(c => `<figure class="mn-fig">${constSVG(c[1], 110)}<figcaption>${esc(c[0])}</figcaption></figure>`).join('')}</div>
            <div class="mn-note">Pour décrire une étoile, comptez les colonnes de gauche à droite et les rangées de haut en bas (ex. : « 2<sup>e</sup> rangée, 3<sup>e</sup> colonne »).</div>`;
    }
});

// ---------- 4. Glyphes xénolithes ----------
M.push({
    id: 'glyphes', nom: 'Clavier xénolithe', diff: 2,
    gen(R) { return { g: R.shuffle(DS_GLYPHES.map((x, i) => i)).slice(0, 4), fait: [] }; },
    ordre(st, E) { const o = st.g.map((g, k) => k).sort((a, b) => DS_MASSE[st.g[a]] - DS_MASSE[st.g[b]]); return E.baliseOn('CRY') ? o.reverse() : o; },
    act(st, E, a) {
        if (a.touche == null || st.fait.indexOf(a.touche) >= 0) return;
        const o = this.ordre(st, E);
        if (o[st.fait.length] === a.touche) { st.fait.push(a.touche); return st.fait.length === 4 ? 'ok' : undefined; }
        return 'err';
    },
    sol(st, E) { return [{ touche: this.ordre(st, E)[st.fait.length] }]; },
    manuel() {
        return `<p class="mn-p">Quatre touches portent chacune un <b>glyphe xénolithe</b>. Chaque glyphe a une <b>masse</b> (voir la table ci-dessous ou l'annexe B). Appuyez sur les quatre touches de la <b>plus légère à la plus lourde</b>.</p>
            ${regles(['Identifiez les quatre glyphes avec le démineur.', 'Classez-les par masse croissante.', 'Si une <b>balise CRY est allumée</b>, appuyez de la plus lourde à la plus légère.', 'Une mauvaise touche provoque une erreur, mais les touches déjà validées restent allumées.'])}
            <div class="mn-glyphes">${DS_GLYPHES.map((g, i) => `<div class="mn-gly">${dsGlypheSVG(i, 36)}<b>${esc(g[0])}</b><span>masse ${DS_MASSE[i]}</span></div>`).join('')}</div>`;
    }
});

// ---------- 5. Jauges du réacteur ----------
const JAUGE_COUL = ['rouge', 'bleu', 'vert', 'jaune'], JAUGE_SYM = ['losange', 'cercle', 'triangle', 'carre'];
const JAUGE_T = { rouge: [3, 1, 4, 2], bleu: [5, 2, 0, 3], vert: [1, 4, 2, 5], jaune: [0, 3, 5, 1] };
M.push({
    id: 'jauges', nom: 'Jauges du réacteur', diff: 2,
    gen(R) { return { j: [0, 1, 2].map(() => ({ c: R.pick(JAUGE_COUL), s: R.pick(JAUGE_SYM), n: R.int(0, 5) })) }; },
    cible(j, E) { return Math.min(5, JAUGE_T[j.c][JAUGE_SYM.indexOf(j.s)] + (E.port('Quantique') ? 1 : 0)); },
    act(st, E, a) {
        if (a.haut != null) st.j[a.haut].n = Math.min(5, st.j[a.haut].n + 1);
        else if (a.bas != null) st.j[a.bas].n = Math.max(0, st.j[a.bas].n - 1);
        else if (a.injecter) return st.j.every(j => j.n === this.cible(j, E)) ? 'ok' : 'err';
    },
    sol(st, E) { const k = st.j.findIndex(j => j.n !== this.cible(j, E)); if (k < 0) return [{ injecter: 1 }]; return [st.j[k].n < this.cible(st.j[k], E) ? { haut: k } : { bas: k }]; },
    manuel() {
        return `<p class="mn-p">Trois jauges verticales (niveaux 0 à 5). Chacune a un <b>curseur coloré</b> et un <b>symbole</b> gravé au-dessus. Réglez chaque jauge au niveau donné par la table, puis appuyez sur <b>INJECTER</b>.</p>
            <table class="mn-table"><tr><th>Curseur</th>${JAUGE_SYM.map(s => `<th>${SYMBOLES[s]} ${SYM_NOM[s]}</th>`).join('')}</tr>
            ${JAUGE_COUL.map(c => `<tr><td>${pastille(c)} ${c}</td>${JAUGE_T[c].map(v => `<td class="mn-num">${v}</td>`).join('')}</tr>`).join('')}</table>
            ${regles(['Si la charge possède un <b>port Quantique</b>, ajoutez 1 à chaque niveau (sans dépasser 5).', 'Les trois jauges doivent être justes au moment d’injecter, sinon c’est une erreur.'])}`;
    }
});

// ---------- 6. Cristaux de résonance ----------
const CRIS_COUL = ['rouge', 'bleu', 'vert', 'violet', 'ambre'], CRIS_FORME = ['prisme', 'aiguille', 'orbe'];
const CRIS = [
    { t: "Si <b>exactement un cristal brille</b>, touchez-le.", f: c => c.filter(x => x.b).length === 1, k: c => c.findIndex(x => x.b) },
    { t: "Sinon, si <b>exactement un cristal est une aiguille</b>, touchez-le.", f: c => c.filter(x => x.f === 'aiguille').length === 1, k: c => c.findIndex(x => x.f === 'aiguille') },
    { t: "Sinon, si <b>un seul cristal est violet</b>, touchez-le.", f: c => c.filter(x => x.c === 'violet').length === 1, k: c => c.findIndex(x => x.c === 'violet') },
    { t: "Sinon, si la <b>matricule contient une voyelle</b>, touchez le cristal qui brille le plus à gauche (ou le premier cristal si aucun ne brille).", f: (c, E) => E.voyelle, k: c => Math.max(0, c.findIndex(x => x.b)) },
    { t: "Sinon, touchez le cristal du <b>milieu</b>.", f: () => true, k: () => 2 }];
M.push({
    id: 'cristaux', nom: 'Cristaux de résonance', diff: 2,
    gen(R) { return { c: [0, 1, 2, 3, 4].map(() => ({ c: R.pick(CRIS_COUL), f: R.pick(CRIS_FORME), b: R() < .4 })) }; },
    solution(st, E) { return evalRegles(CRIS, st.c, E); },
    act(st, E, a) { if (a.cristal == null) return; return a.cristal === this.solution(st, E) ? 'ok' : 'err'; },
    sol(st, E) { return [{ cristal: this.solution(st, E) }]; },
    manuel() {
        return `<p class="mn-p">Cinq cristaux sont alignés sur un socle, numérotés de gauche à droite. Chacun a une couleur (${CRIS_COUL.map(c => pastille(c) + ' ' + c).join(', ')}), une forme (<b>prisme</b> à six faces, <b>aiguille</b> pointue, <b>orbe</b> ronde) et peut <b>briller</b> ou rester terne. Un seul cristal est en dissonance : touchez-le.</p>
            ${regles(CRIS.map(r => r.t))}
            <div class="mn-note">Appliquez la première règle qui convient, et seulement celle-là.</div>`;
    }
});

// ---------- 7. Synchronisation orbitale ----------
const SYNC_PLANETE = ['orange', 'bleue', 'verte', 'violette'], SYNC_BAL = ['rouge', 'jaune', 'cyan', 'blanc'];
const SYNC_T = { orange: 'cyan', bleue: 'rouge', verte: 'blanc', violette: 'jaune' };
const SYNC_ANG = [270, 0, 90, 180];   // haut, droite, bas, gauche (degrés à l'écran)
M.push({
    id: 'synchro', nom: 'Synchronisation orbitale', diff: 2,
    gen(R) { return { p: R.pick(SYNC_PLANETE), b: R.shuffle(SYNC_BAL), per: 3500 + R.int(0, 1500), ph: R.int(0, 359) }; },
    angle(st, now) { return (st.ph + 360 * (now % 1e9) / st.per) % 360; },
    cibleIdx(st, E) { let k = st.b.indexOf(SYNC_T[st.p]); if (E.cellules >= 2) k = (k + 2) % 4; return k; },
    act(st, E, a, now) {
        if (!a.sync) return;
        const d = Math.abs(((this.angle(st, a.t || now) - SYNC_ANG[this.cibleIdx(st, E)]) % 360 + 540) % 360 - 180);
        return d <= 28 ? 'ok' : 'err';
    },
    sol(st, E, now) {   // prochain instant où le satellite passe sur la bonne balise
        const cible = SYNC_ANG[this.cibleIdx(st, E)], a = this.angle(st, now), d = ((cible - a) % 360 + 360) % 360;
        return [{ sync: 1, t: now + d / 360 * st.per }];
    },
    manuel() {
        return `<p class="mn-p">Un écran montre une <b>planète</b> avec un <b>satellite</b> qui tourne autour. Quatre balises colorées (${SYNC_BAL.map(c => pastille(c) + ' ' + c).join(', ')}) sont placées en haut, à droite, en bas et à gauche. Appuyez sur <b>SYNC</b> au moment exact où le satellite passe sur la bonne balise.</p>
            <table class="mn-table"><tr><th>Couleur de la planète</th><th>Balise visée</th></tr>
            ${SYNC_PLANETE.map(p => `<tr><td>${pastille(p)} ${p}</td><td>${pastille(SYNC_T[p])} ${SYNC_T[p]}</td></tr>`).join('')}</table>
            ${regles(['Si la charge porte <b>au moins deux cellules d’énergie</b>, visez plutôt la balise <b>opposée</b> (celle d’en face, de l’autre côté de la planète).', 'Le satellite doit être sur la balise ou tout près. Un appui à contretemps provoque une erreur.'])}`;
    }
});

// ---------- 8. Panneau de fusibles ----------
const FUS_TAG = ['rouge', 'vert', 'bleu'];
const FUS = [
    { rouge: ['la matricule contient une voyelle', E => E.voyelle], vert: ['la charge a au moins 2 cellules d’énergie', E => E.cellules >= 2], bleu: ['au moins une balise est allumée', E => E.nbOn > 0] },
    { rouge: ['le dernier chiffre de la matricule est impair', E => E.dernier % 2 === 1], vert: ['la charge a un port Fibre', E => E.port('Fibre')], bleu: ['l’emblème est Mars ou Titan', E => E.emb === 'Mars' || E.emb === 'Titan'] },
    { rouge: ['la charge a un port Plasma', E => E.port('Plasma')], vert: ['la somme des chiffres de la matricule dépasse 10', E => E.somme > 10], bleu: ['la charge n’a aucune cellule d’énergie', E => E.cellules === 0] },
    { rouge: ['l’emblème est Europe', E => E.emb === 'Europe'], vert: ['la charge a une balise COM (allumée ou non)', E => E.balise('COM')], bleu: ['le dernier chiffre est 0, 1 ou 2', E => E.dernier <= 2] },
    { rouge: ['la charge a au moins 3 cellules d’énergie', E => E.cellules >= 3], vert: ['la matricule commence par une voyelle', E => E.debutVoyelle], bleu: ['la charge a au moins deux ports', E => E.ports.length >= 2] },
    { rouge: ['toujours', () => true], vert: ['jamais', () => false], bleu: ['le fusible n°1 doit être allumé', null] }
];
M.push({
    id: 'fusibles', nom: 'Panneau de fusibles', diff: 2,
    gen(R) { return { f: [0, 1, 2, 3, 4, 5].map(() => ({ t: R.pick(FUS_TAG), on: R() < .5 })) }; },
    voulu(st, E) {
        const v = [];
        st.f.forEach((f, i) => { const r = FUS[i][f.t]; v[i] = r[1] ? r[1](E) : v[0]; });
        return v;
    },
    act(st, E, a) {
        if (a.fusible != null) st.f[a.fusible].on = !st.f[a.fusible].on;
        else if (a.rearmer) { const v = this.voulu(st, E); return st.f.every((f, i) => f.on === v[i]) ? 'ok' : 'err'; }
    },
    sol(st, E) { const v = this.voulu(st, E), k = st.f.findIndex((f, i) => f.on !== v[i]); return k < 0 ? [{ rearmer: 1 }] : [{ fusible: k }]; },
    manuel() {
        return `<p class="mn-p">Six fusibles, numérotés de 1 à 6 de gauche à droite, portent chacun une <b>bague colorée</b> (rouge, vert ou bleu). Un voyant au-dessus indique s'il est <b>allumé</b>. Touchez un fusible pour l'allumer ou l'éteindre, puis appuyez sur <b>RÉARMER</b>.</p>
            <p class="mn-p">Un fusible doit être <b>allumé</b> si la condition de la case (n° du fusible, couleur de sa bague) est vraie, et <b>éteint</b> sinon.</p>
            <table class="mn-table"><tr><th>N°</th>${FUS_TAG.map(t => `<th>${pastille(t)} bague ${t}e</th>`).join('')}</tr>
            ${FUS.map((l, i) => `<tr><td class="mn-num">${i + 1}</td>${FUS_TAG.map(t => `<td>${esc(l[t][0])}</td>`).join('')}</tr>`).join('')}</table>`;
    }
});

// ---------- 9. Sas de confinement ----------
const SAS_COUL = ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet'], SAS_SYM = ['hexagone', 'cercle', 'triangle', 'croix', 'vague', 'étoile'];
const SAS_ICONE = { hexagone: '⬡', cercle: '◯', triangle: '△', croix: '✕', vague: '∿', 'étoile': '✦' };
const SAS_ORDRE = {
    Mars: ['par couleur, dans l’ordre de l’arc-en-ciel : rouge, orange, jaune, vert, bleu, violet', (a, b) => SAS_COUL.indexOf(a.c) - SAS_COUL.indexOf(b.c)],
    Europe: ['par numéro, du plus petit au plus grand', (a, b) => a.n - b.n],
    Titan: ['par numéro, du plus grand au plus petit', (a, b) => b.n - a.n],
    Io: ['par symbole : hexagone, cercle, triangle, croix, vague, étoile', (a, b) => SAS_SYM.indexOf(a.s) - SAS_SYM.indexOf(b.s)],
    'Cérès': ['par couleur, dans l’ordre inverse de l’arc-en-ciel : violet, bleu, vert, jaune, orange, rouge', (a, b) => SAS_COUL.indexOf(b.c) - SAS_COUL.indexOf(a.c)]
};
M.push({
    id: 'sas', nom: 'Sas de confinement', diff: 2,
    gen(R) { const c = R.shuffle(SAS_COUL), s = R.shuffle(SAS_SYM), n = R.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]); return { p: [0, 1, 2, 3].map(i => ({ c: c[i], s: s[i], n: n[i] })), ouv: [] }; },
    ordre(st, E) { return st.p.map((p, i) => i).sort((a, b) => SAS_ORDRE[E.emb][1](st.p[a], st.p[b])); },
    act(st, E, a) {
        if (a.porte == null || st.ouv.indexOf(a.porte) >= 0) return;
        if (this.ordre(st, E)[st.ouv.length] === a.porte) { st.ouv.push(a.porte); return st.ouv.length === 4 ? 'ok' : undefined; }
        return 'err';
    },
    sol(st, E) { return [{ porte: this.ordre(st, E)[st.ouv.length] }]; },
    manuel() {
        return `<p class="mn-p">Quatre portes de sas portent chacune une <b>couleur</b>, un <b>symbole</b> et un <b>numéro</b>. Ouvrez-les une par une (touchez une porte pour l'ouvrir) dans l'ordre qui dépend de l'<b>emblème de mission</b> collé sur la charge.</p>
            <table class="mn-table"><tr><th>Emblème</th><th>Ordre d’ouverture</th></tr>${DS_EMBLEMES.map(e => `<tr><td><b>${e}</b></td><td>${SAS_ORDRE[e][0]}</td></tr>`).join('')}</table>
            <p class="mn-p">Symboles : ${SAS_SYM.map(s => `<b>${SAS_ICONE[s]}</b> ${s}`).join(' · ')}.</p>
            <div class="mn-note">Ouvrir une porte trop tôt provoque une erreur ; les portes déjà ouvertes restent ouvertes.</div>`;
    }
});

// ---------- 10. Transmission xénolithe ----------
const TRANS = [['ORBITE', 3.545], ['COMETE', 3.510], ['PULSAR', 3.580], ['QUASAR', 3.525], ['NEBULE', 3.570], ['GALAXIE', 3.505], ['SATURNE', 3.555], ['ECLIPSE', 3.535],
    ['PLASMA', 3.515], ['PHOTON', 3.560], ['NEUTRON', 3.540], ['VORTEX', 3.595], ['AURORE', 3.520], ['CRATERE', 3.575], ['FUSION', 3.530], ['METEORE', 3.565]];
const freq = k => +(3.500 + k * 0.005).toFixed(3);
M.push({
    id: 'transmission', nom: 'Transmission xénolithe', diff: 3,
    gen(R) { return { m: R.int(0, TRANS.length - 1), f: R.int(0, 20) }; },
    glyphes(st) { return [...TRANS[st.m][0]].map(L => DS_LETTRE.indexOf(L)); },
    act(st, E, a) {
        if (a.plus) st.f = Math.min(20, st.f + 1);
        else if (a.moins) st.f = Math.max(0, st.f - 1);
        else if (a.emettre) return Math.abs(freq(st.f) - TRANS[st.m][1]) < 1e-6 ? 'ok' : 'err';
    },
    sol(st) { const c = Math.round((TRANS[st.m][1] - 3.5) / 0.005); return st.f === c ? [{ emettre: 1 }] : [st.f < c ? { plus: 1 } : { moins: 1 }]; },
    manuel() {
        return `<p class="mn-p">Un écran affiche un mot écrit en <b>glyphes xénolithes</b>. Décodez-le lettre par lettre avec l'alphabet ci-dessous, trouvez le mot dans la table des fréquences, puis faites régler la fréquence (touches ◀ ▶, de 3,500 à 3,600 MHz) et appuyez sur <b>ÉMETTRE</b>.</p>
            <h4 class="mn-h4">Alphabet xénolithe</h4>
            <div class="mn-glyphes">${DS_GLYPHES.map((g, i) => `<div class="mn-gly">${dsGlypheSVG(i, 32)}<b class="mn-lettre">${DS_LETTRE[i]}</b><span>${esc(g[0])}</span></div>`).join('')}</div>
            <h4 class="mn-h4">Table des fréquences</h4>
            <table class="mn-table mn-2col">${TRANS.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(t => `<tr><td><b>${t[0]}</b></td><td class="mn-num">${t[1].toFixed(3)} MHz</td></tr>`).join('')}</table>
            <div class="mn-note">Le mot se lit de gauche à droite. Émettre sur une mauvaise fréquence provoque une erreur.</div>`;
    }
});

// ---------- 11. Circuit logique ----------
const PORTES = ['ET', 'OU', 'OUX', 'NON-ET', 'NON-OU'];
const PORTE_F = { 'ET': (a, b) => a & b, 'OU': (a, b) => a | b, 'OUX': (a, b) => a ^ b, 'NON-ET': (a, b) => 1 - (a & b), 'NON-OU': (a, b) => 1 - (a | b) };
const PORTE_DESC = {
    'ET': 'un « D » : côté gauche plat, côté droit arrondi', 'OU': 'un bouclier pointu vers la droite, entrée creusée',
    'OUX': 'comme le bouclier OU, avec une <b>deuxième courbe</b> à l’entrée', 'NON-ET': 'le « D » du ET, avec un <b>petit rond</b> à la sortie', 'NON-OU': 'le bouclier OU, avec un <b>petit rond</b> à la sortie' };
function porteSVG(p) {
    const D = '<path d="M8,6 L22,6 A14,14 0 0 1 22,34 L8,34 Z" fill="none" stroke="#e2e8f0" stroke-width="2"/>';
    const O = '<path d="M6,6 Q20,6 34,20 Q20,34 6,34 Q14,20 6,6 Z" fill="none" stroke="#e2e8f0" stroke-width="2"/>';
    const X = '<path d="M1,6 Q9,20 1,34" fill="none" stroke="#e2e8f0" stroke-width="2"/>';
    const B = x => `<circle cx="${x}" cy="20" r="3" fill="none" stroke="#e2e8f0" stroke-width="2"/>`;
    const c = { 'ET': D, 'OU': O, 'OUX': O + X, 'NON-ET': D + B(39), 'NON-OU': O + B(37) }[p];
    return `<svg viewBox="0 0 44 40" width="66" height="60">${c}</svg>`;
}
function circuitEtape(R) { return { a: R.int(0, 1), b: R.int(0, 1), c: R.int(0, 1), g1: R.pick(PORTES), g2: R.pick(PORTES) }; }
M.push({
    id: 'circuit', nom: 'Circuit logique', diff: 3,
    gen(R) { return { e: [circuitEtape(R), circuitEtape(R), circuitEtape(R), circuitEtape(R), circuitEtape(R), circuitEtape(R)], k: 0, essai: 0, levier: 0 }; },
    sortie(x, E) { const v = b => E.baliseOn('LUX') ? 1 - b : b; return PORTE_F[x.g2](PORTE_F[x.g1](v(x.a), v(x.b)), v(x.c)); },
    etape(st) { return st.e[(st.k + st.essai * 3) % st.e.length]; },
    act(st, E, a) {
        if (a.levier != null) { st.levier = a.levier ? 1 : 0; return; }
        if (!a.valider) return;
        if (st.levier === this.sortie(this.etape(st), E)) { st.k++; return st.k >= 3 ? 'ok' : undefined; }
        st.essai++; return 'err';
    },
    sol(st, E) { const s = this.sortie(this.etape(st), E); return st.levier === s ? [{ valider: 1 }] : [{ levier: s }]; },
    manuel() {
        return `<p class="mn-p">L'écran montre trois voyants d'entrée <b>A</b>, <b>B</b> et <b>C</b> (allumé = 1, éteint = 0) et deux portes logiques. La première porte combine <b>A</b> et <b>B</b> ; la seconde combine ce résultat avec <b>C</b>. Placez le levier sur la sortie finale (<b>0</b> ou <b>1</b>) puis appuyez sur <b>VALIDER</b>. Il faut réussir <b>trois circuits</b> d'affilée (trois témoins sur le module).</p>
            <table class="mn-table"><tr><th>Symbole</th><th>Porte</th><th>Description</th><th>La sortie vaut 1 si…</th></tr>
            ${PORTES.map(p => `<tr><td>${porteSVG(p)}</td><td><b>${p}</b></td><td>${PORTE_DESC[p]}</td><td>${{ 'ET': 'les deux entrées valent 1', 'OU': 'au moins une entrée vaut 1', 'OUX': 'les entrées sont différentes', 'NON-ET': 'au moins une entrée vaut 0', 'NON-OU': 'les deux entrées valent 0' }[p]}</td></tr>`).join('')}</table>
            ${regles(['Si une <b>balise LUX est allumée</b>, les voyants mentent : un voyant allumé vaut <b>0</b> et un voyant éteint vaut <b>1</b>.', 'Une mauvaise réponse provoque une erreur et affiche un nouveau circuit (les circuits déjà réussis restent acquis).'])}
            <div class="mn-ex"><b>Exemple :</b> A = 1, B = 0, porte 1 = OU → 1. C = 1, porte 2 = OUX → 1 et 1 sont égaux → <b>0</b>.</div>`;
    }
});

// ---------- 12. Décodeur binaire ----------
M.push({
    id: 'binaire', nom: 'Décodeur binaire', diff: 3,
    gen(R) { return { n: R.int(1, 63), col: R.pick(['cyan', 'magenta', 'ambre']), s: '' }; },
    cible(st, E) { let t = st.col === 'cyan' ? st.n + E.cellules : st.col === 'magenta' ? st.n - E.dernier : st.n * 2; return ((t % 64) + 64) % 64; },
    act(st, E, a) {
        if (a.chiffre != null) { if (st.s.length < 2) st.s += a.chiffre; return; }
        if (a.effacer) { st.s = ''; return; }
        if (a.entrer) { const ok = st.s !== '' && parseInt(st.s, 10) === this.cible(st, E); st.s = ''; return ok ? 'ok' : 'err'; }
    },
    sol(st, E) { const c = String(this.cible(st, E)); if (st.s === c) return [{ entrer: 1 }]; if (c.indexOf(st.s) !== 0) return [{ effacer: 1 }]; return [{ chiffre: c[st.s.length] }]; },
    manuel() {
        return `<p class="mn-p">Une rangée de <b>six diodes</b> affiche un nombre en binaire : de gauche à droite, elles valent <b>32, 16, 8, 4, 2, 1</b>. Additionnez les valeurs des diodes allumées, transformez le nombre selon la couleur des diodes, puis tapez le résultat au clavier et appuyez sur <b>OK</b>.</p>
            <table class="mn-table"><tr><th>Couleur des diodes</th><th>Transformation</th></tr>
            <tr><td>${pastille('cyan')} cyan</td><td>ajoutez le nombre de cellules d’énergie</td></tr>
            <tr><td>${pastille('magenta')} magenta</td><td>soustrayez le dernier chiffre de la matricule</td></tr>
            <tr><td>${pastille('ambre')} ambre</td><td>multipliez par 2</td></tr></table>
            ${regles(['Si le résultat est <b>64 ou plus</b>, retirez 64.', 'Si le résultat est <b>négatif</b>, ajoutez 64.', 'Tapez le nombre (un ou deux chiffres). <b>EFF</b> efface la saisie.'])}
            <div class="mn-ex"><b>Exemple :</b> diodes ●○●○○● = 32 + 8 + 1 = 41, couleur ambre → 82 → 82 − 64 = <b>18</b>.</div>`;
    }
});

// ---------- 13. Champ d'astéroïdes ----------
const SECTEURS = ['Kepler', 'Orion', 'Véga', 'Altaïr', 'Rigel', 'Sirius', 'Deneb', 'Antarès'];
const CARTES = SECTEURS.map((s, k) => {             // 8 cartes 6 × 6 fixes : toutes les cases libres communiquent
    const R = dsRng(1000 + k * 77);
    for (let essai = 0; essai < 500; essai++) {
        const bloc = new Set(R.shuffle([...Array(36).keys()]).slice(0, 9 + (k % 3)));
        const libres = [...Array(36).keys()].filter(i => !bloc.has(i));
        const vu = new Set([libres[0]]), file = [libres[0]];
        while (file.length) { const c = file.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const x = c % 6 + dx, y = Math.floor(c / 6) + dy, n = y * 6 + x; if (x >= 0 && x < 6 && y >= 0 && y < 6 && !bloc.has(n) && !vu.has(n)) { vu.add(n); file.push(n); } }); }
        if (vu.size === libres.length) return [...bloc];
    }
    return [];
});
function distances(carte, depart) {
    const bloc = new Set(carte), d = { [depart]: 0 }, file = [depart];
    while (file.length) { const c = file.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const x = c % 6 + dx, y = Math.floor(c / 6) + dy, n = y * 6 + x; if (x >= 0 && x < 6 && y >= 0 && y < 6 && !bloc.has(n) && d[n] == null) { d[n] = d[c] + 1; file.push(n); } }); }
    return d;
}
function carteSVG(k, taille) {
    const s = taille || 132, bloc = new Set(CARTES[k]);
    let o = `<svg viewBox="0 0 66 66" width="${s}" height="${s}"><rect width="66" height="66" rx="4" fill="#020617" stroke="#1e3a5f"/>`;
    for (let i = 0; i < 36; i++) { const x = 3 + (i % 6) * 10, y = 3 + Math.floor(i / 6) * 10;
        o += bloc.has(i) ? `<circle cx="${x + 5}" cy="${y + 5}" r="4" fill="#78716c" stroke="#a8a29e" stroke-width=".6"/><circle cx="${x + 3.6}" cy="${y + 4}" r=".9" fill="#57534e"/>` : `<rect x="${x + 4.4}" y="${y + 4.4}" width="1.2" height="1.2" fill="#334155"/>`; }
    return o + '</svg>';
}
M.push({
    id: 'asteroides', nom: 'Champ d’astéroïdes', diff: 3,
    gen(R) {
        const k = R.int(0, 7), bloc = new Set(CARTES[k]), libres = [...Array(36).keys()].filter(i => !bloc.has(i));
        let v = R.pick(libres), d = distances(CARTES[k], v), loin = libres.filter(i => d[i] >= 5);
        if (!loin.length) loin = libres.filter(i => i !== v);
        return { k: k, v: v, s: R.pick(loin) };
    },
    act(st, E, a) {
        if (!a.dir) return;
        const dx = { G: -1, D: 1, H: 0, B: 0 }[a.dir], dy = { G: 0, D: 0, H: -1, B: 1 }[a.dir];
        const x = st.v % 6 + dx, y = Math.floor(st.v / 6) + dy;
        if (x < 0 || x > 5 || y < 0 || y > 5) return;
        const n = y * 6 + x;
        if (CARTES[st.k].indexOf(n) >= 0) return 'err';
        st.v = n; return n === st.s ? 'ok' : undefined;
    },
    sol(st) {
        const d = distances(CARTES[st.k], st.s);
        for (const [dir, dx, dy] of [['G', -1, 0], ['D', 1, 0], ['H', 0, -1], ['B', 0, 1]]) { const x = st.v % 6 + dx, y = Math.floor(st.v / 6) + dy, n = y * 6 + x; if (x >= 0 && x < 6 && y >= 0 && y < 6 && d[n] === d[st.v] - 1) return [{ dir: dir }]; }
        return [];
    },
    manuel() {
        return `<p class="mn-p">Un radar de 6 × 6 cases montre le <b>vaisseau</b> (triangle blanc) et la <b>balise de sortie</b> (losange vert). Les astéroïdes sont <b>invisibles</b> pour le démineur. Guidez le vaisseau jusqu'à la sortie avec les flèches, sans jamais entrer dans une case occupée par un astéroïde.</p>
            ${regles(['Lisez le <b>nom du secteur</b> affiché sous le radar pour choisir la bonne carte.', 'Une flèche déplace le vaisseau d’une case. Heurter un astéroïde provoque une erreur (le vaisseau ne bouge pas).', 'Les bords du radar sont infranchissables (sans erreur).'])}
            <div class="mn-grille-fig">${SECTEURS.map((s, k) => `<figure class="mn-fig">${carteSVG(k, 128)}<figcaption>Secteur ${s}</figcaption></figure>`).join('')}</div>
            <div class="mn-note">Repérez-vous en colonnes (1 à 6 de gauche à droite) et rangées (1 à 6 de haut en bas).</div>`;
    }
});

// ---------- 14. Spectre chimique ----------
const ELEM = [['Xénon-7', [[0, 'violet'], [3, 'cyan'], [5, 'rouge']]], ['Argonite', [[1, 'vert'], [2, 'jaune'], [6, 'rouge']]], ['Lumium', [[0, 'jaune'], [4, 'jaune'], [6, 'cyan']]],
    ['Cryolite', [[2, 'cyan'], [3, 'violet'], [4, 'cyan']]], ['Vortexium', [[1, 'rouge'], [3, 'rouge'], [5, 'vert']]], ['Hélion', [[0, 'orange'], [2, 'vert'], [6, 'violet']]],
    ['Plasmine', [[1, 'violet'], [4, 'orange'], [5, 'jaune']]], ['Nébulite', [[0, 'cyan'], [1, 'cyan'], [5, 'orange']]], ['Quarkium', [[2, 'rouge'], [4, 'vert'], [6, 'orange']]],
    ['Solarine', [[3, 'jaune'], [5, 'violet'], [6, 'vert']]]];
function spectreSVG(bandes, decal) {
    let o = '<svg viewBox="0 0 168 34" width="168" height="34"><rect width="168" height="34" rx="4" fill="#020617" stroke="#1e3a5f"/>';
    for (let i = 0; i < 8; i++) o += `<text x="${10 + i * 21}" y="31" font-size="6" fill="#475569" text-anchor="middle">${i + 1}</text>`;
    bandes.forEach(([p, c]) => { o += `<rect x="${6 + (p + (decal || 0)) * 21}" y="4" width="8" height="20" rx="1" fill="${COUL[c]}"/>`; });
    return o + '</svg>';
}
M.push({
    id: 'spectre', nom: 'Spectromètre', diff: 3,
    gen(R) { return { e: R.int(0, ELEM.length - 1), sel: R.int(0, ELEM.length - 1) }; },
    decalage(E) { return E.port('Gravitonique') ? 1 : 0; },
    act(st, E, a) {
        if (a.plus) st.sel = (st.sel + 1) % ELEM.length;
        else if (a.moins) st.sel = (st.sel + ELEM.length - 1) % ELEM.length;
        else if (a.analyser) return st.sel === st.e ? 'ok' : 'err';
    },
    sol(st) { return st.sel === st.e ? [{ analyser: 1 }] : [{ plus: 1 }]; },
    noms: ELEM.map(e => e[0]),
    manuel() {
        return `<p class="mn-p">L'écran du haut montre un <b>spectre</b> : trois raies colorées sur huit positions numérotées de 1 à 8. Identifiez l'élément, faites-le choisir avec ◀ ▶ sur l'écran du bas, puis appuyez sur <b>ANALYSER</b>.</p>
            ${regles(['Si la charge possède un <b>port Gravitonique</b>, le capteur est déréglé : toutes les raies sont <b>décalées d’une position vers la droite</b>. Lisez-les une position plus à gauche.'])}
            <table class="mn-table">${ELEM.map(e => `<tr><td><b>${e[0]}</b></td><td>${spectreSVG(e[1])}</td><td class="mn-petit">${e[1].map(([p, c]) => `${c} en ${p + 1}`).join(', ')}</td></tr>`).join('')}</table>`;
    }
});

// ---------- 15. Grille de quarantaine ----------
const QUA_SYM = ['virus', 'spore', 'cristal', 'larve', 'oeil', 'vide'];
const QUA_NOM = { virus: 'Virus', spore: 'Spores', cristal: 'Cristal', larve: 'Larve', oeil: 'Œil', vide: 'Case vide' };
function quaSVG(s, t) {
    const z = t || 34, c = '#e2e8f0';
    const d = {
        virus: `<circle cx="10" cy="10" r="4" fill="none" stroke="${c}" stroke-width="1.2"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${10 + 4 * Math.cos(r)}" y1="${10 + 4 * Math.sin(r)}" x2="${10 + 7 * Math.cos(r)}" y2="${10 + 7 * Math.sin(r)}" stroke="${c}" stroke-width="1.2"/><circle cx="${10 + 7.6 * Math.cos(r)}" cy="${10 + 7.6 * Math.sin(r)}" r=".9" fill="${c}"/>`; }).join('')}`,
        spore: `<circle cx="6" cy="7" r="2.2" fill="${c}"/><circle cx="14" cy="7" r="2.2" fill="${c}"/><circle cx="10" cy="14" r="2.2" fill="${c}"/>`,
        cristal: `<path d="M10,2 L16,10 L10,18 L4,10 Z" fill="none" stroke="${c}" stroke-width="1.3"/><path d="M4,10 L16,10" stroke="${c}" stroke-width="1"/>`,
        larve: `<path d="M2,12 Q5,6 8,12 T14,12 T20,10" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`,
        oeil: `<path d="M2,10 Q10,2 18,10 Q10,18 2,10 Z" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="10" cy="10" r="2.6" fill="${c}"/>`,
        vide: ''
    }[s];
    return `<svg viewBox="0 0 20 20" width="${z}" height="${z}">${d}</svg>`;
}
M.push({
    id: 'quarantaine', nom: 'Grille de quarantaine', diff: 4,
    gen(R) {
        const poids = ['virus', 'spore', 'spore', 'cristal', 'larve', 'larve', 'oeil', 'vide', 'vide', 'vide'];
        let g; do { g = Array.from({ length: 16 }, () => R.pick(poids)); } while (g.indexOf('virus') < 0);
        return { g: g, q: Array(16).fill(0) };
    },
    voulu(st, E) {
        const g = st.g, at = (x, y) => (x < 0 || x > 3 || y < 0 || y > 3) ? null : g[y * 4 + x];
        return g.map((s, i) => {
            const x = i % 4, y = Math.floor(i / 4), bord = x === 0 || x === 3 || y === 0 || y === 3;
            if (s === 'virus') return 1;
            if (s === 'spore') return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'virus') ? 1 : 0;
            if (s === 'larve') return (E.baliseOn('ORB') ? !bord : bord) ? 1 : 0;
            if (s === 'oeil') return [0, 1, 2, 3].some(yy => at(x, yy) === 'cristal') ? 1 : 0;
            if (s === 'cristal') return E.cellules >= 3 ? 1 : 0;
            return 0;
        });
    },
    act(st, E, a) {
        if (a.case != null) { st.q[a.case] = 1 - st.q[a.case]; return; }
        if (a.confiner) { const v = this.voulu(st, E); return st.q.every((q, i) => q === v[i]) ? 'ok' : 'err'; }
    },
    sol(st, E) { const v = this.voulu(st, E), k = st.q.findIndex((q, i) => q !== v[i]); return k < 0 ? [{ confiner: 1 }] : [{ case: k }]; },
    manuel() {
        return `<p class="mn-p">Une grille de 4 × 4 cases contient des formes de vie. Touchez une case pour la placer en <b>quarantaine</b> (cadre rouge) ou l'en retirer. Quand toutes les bonnes cases sont en quarantaine, et seulement elles, appuyez sur <b>CONFINER</b>.</p>
            <table class="mn-table"><tr><th>Symbole</th><th>Forme de vie</th><th>Mettre en quarantaine…</th></tr>
            <tr><td>${quaSVG('virus')}</td><td>Virus</td><td><b>toujours</b>.</td></tr>
            <tr><td>${quaSVG('spore')}</td><td>Spores</td><td>si la case <b>touche un virus</b> par un côté (pas en diagonale).</td></tr>
            <tr><td>${quaSVG('larve')}</td><td>Larve</td><td>si la case est <b>sur le bord</b> de la grille. Si une <b>balise ORB est allumée</b>, c’est l’inverse : seulement si elle n’est <b>pas</b> sur le bord.</td></tr>
            <tr><td>${quaSVG('oeil')}</td><td>Œil</td><td>si sa <b>colonne</b> contient au moins un cristal.</td></tr>
            <tr><td>${quaSVG('cristal')}</td><td>Cristal</td><td>seulement si la charge porte <b>au moins 3 cellules d’énergie</b>.</td></tr>
            <tr><td>—</td><td>Case vide</td><td><b>jamais</b>.</td></tr></table>
            <div class="mn-note">Conseil : faites décrire la grille rangée par rangée, de haut en bas, et notez-la sur papier.</div>`;
    }
});

// ---------- 16. Chiffre stellaire ----------
const CHIF = [['ASTRE', 'rouge'], ['NOVAE', 'bleu'], ['SONDE', 'vert'], ['FUSEE', 'jaune'], ['PLUTON', 'vert'], ['VENUS', 'rouge'], ['TITAN', 'bleu'], ['OBERON', 'jaune'], ['CERES', 'bleu'], ['MERCURE', 'vert'],
    ['URANUS', 'jaune'], ['CALYPSO', 'rouge'], ['PHOBOS', 'jaune'], ['DEIMOS', 'vert'], ['CASSINI', 'rouge'], ['KEPLER', 'bleu'], ['HUBBLE', 'vert'], ['APOLLO', 'jaune'], ['GEMINI', 'rouge'], ['ARTEMIS', 'bleu']];
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
M.push({
    id: 'chiffre', nom: 'Chiffre stellaire', diff: 4,
    gen(R) { return { m: R.int(0, CHIF.length - 1) }; },
    cle(E) { const k = (E.dernier + E.nbOn) % 26; return k === 0 ? 13 : k; },
    code(st, E) { const k = this.cle(E); return [...CHIF[st.m][0]].map(L => ABC[(ABC.indexOf(L) + k) % 26]).join(''); },
    act(st, E, a) { if (!a.bouton) return; return a.bouton === CHIF[st.m][1] ? 'ok' : 'err'; },
    sol(st) { return [{ bouton: CHIF[st.m][1] }]; },
    manuel() {
        return `<p class="mn-p">L'écran affiche un mot chiffré. Chaque lettre a été <b>avancée</b> dans l'alphabet d'un même nombre de rangs : la <b>clé</b>. Reculez chaque lettre de ce nombre de rangs pour retrouver le mot (après A, on repart de Z), puis appuyez sur le bouton de la couleur indiquée dans la table.</p>
            ${regles(['Clé = <b>dernier chiffre de la matricule + nombre de balises allumées</b>.', 'Si la clé vaut <b>0</b>, utilisez <b>13</b>.', 'Reculez chaque lettre affichée de « clé » rangs.'])}
            <div class="mn-alpha">${[...ABC].map((L, i) => `<span><b>${L}</b><i>${i}</i></span>`).join('')}</div>
            <table class="mn-table mn-2col">${CHIF.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(c => `<tr><td><b>${c[0]}</b></td><td>${pastille(c[1])} ${c[1]}</td></tr>`).join('')}</table>
            <div class="mn-ex"><b>Exemple :</b> clé 3, écran « DVWUH » → D−3 = A, V−3 = S, W−3 = T, U−3 = R, H−3 = E → <b>ASTRE</b> → bouton rouge.</div>`;
    }
});

// ---------- 17. Télémétrie d'orbite ----------
const TRAJ = [['cercle', 'HDBG'], ['ellipse', 'DDGH'], ['huit', 'GHDB'], ['spirale', 'HHDB'], ['triangle', 'BGHD'], ['étoile', 'DHGG'], ['boucle', 'BDHH'], ['zigzag', 'GDGB']];
const DIR_NOM = { H: '▲ haut', B: '▼ bas', G: '◀ gauche', D: '▶ droite' };
function trajPoints(nom) {
    const P = [], N = 90;
    for (let i = 0; i <= N; i++) {
        const t = i / N * Math.PI * 2;
        let x, y;
        if (nom === 'cercle') { x = Math.cos(t) * .8; y = Math.sin(t) * .8; }
        else if (nom === 'ellipse') { x = Math.cos(t) * .9; y = Math.sin(t) * .45; }
        else if (nom === 'huit') { x = Math.sin(t) * .85; y = Math.sin(t) * Math.cos(t) * .9; }
        else if (nom === 'spirale') { const r = .12 + .7 * i / N; x = Math.cos(t * 2.5) * r; y = Math.sin(t * 2.5) * r; }
        else if (nom === 'boucle') { const r = .35 + .5 * Math.cos(t); x = r * Math.cos(t) * .95 - .1; y = r * Math.sin(t) * .95; }
        else { x = 0; y = 0; }
        P.push([x, y]);
    }
    if (nom === 'triangle') return [[0, -.8], [.75, .6], [-.75, .6], [0, -.8]];
    if (nom === 'étoile') { const q = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? .35 : .85; q.push([Math.cos(a) * r, Math.sin(a) * r]); } return q; }
    if (nom === 'zigzag') return [[-.85, .5], [-.5, -.5], [-.15, .5], [.2, -.5], [.55, .5], [.85, -.3]];
    return P;
}
function trajSVG(nom, coul) {
    const p = trajPoints(nom).map(([x, y]) => `${(50 + x * 40).toFixed(1)},${(50 + y * 40).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 100 100" width="84" height="84"><rect width="100" height="100" rx="8" fill="#020617" stroke="#1e3a5f"/><circle cx="50" cy="50" r="5" fill="#475569"/><polyline points="${p}" fill="none" stroke="${coul || '#e2e8f0'}" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}
const TOURNE = { H: 'D', D: 'B', B: 'G', G: 'H' };
M.push({
    id: 'telemetrie', nom: 'Télémétrie d’orbite', diff: 4,
    gen(R) { return { t: R.int(0, TRAJ.length - 1), l: R.int(1, 3), c: R.pick(['blanc', 'rouge', 'vert']), pos: 0 }; },
    seq(st, E) {
        let s = [...TRAJ[st.t][1]];
        if (st.l === 2) s.reverse();
        if (st.l === 3) s = s.map(d => TOURNE[d]);
        if (st.c === 'rouge') { const x = s[0]; s[0] = s[s.length - 1]; s[s.length - 1] = x; }
        if (st.c === 'vert' && E.voyelle) s.push('H');
        return s;
    },
    act(st, E, a) {
        if (!a.dir) return;
        const s = this.seq(st, E);
        if (a.dir === s[st.pos]) { st.pos++; return st.pos >= s.length ? 'ok' : undefined; }
        st.pos = 0; return 'err';
    },
    sol(st, E) { return [{ dir: this.seq(st, E)[st.pos] }]; },
    manuel() {
        return `<p class="mn-p">L'écran trace la <b>trajectoire</b> d'une sonde autour d'un astre, avec une, deux ou trois <b>lunes</b> (petits points) et une couleur de tracé. Actionnez les quatre propulseurs (▲ ▼ ◀ ▶) dans le bon ordre. Les témoins du module comptent les poussées réussies.</p>
            <div class="mn-grille-fig">${TRAJ.map(t => `<figure class="mn-fig">${trajSVG(t[0])}<figcaption><b>${t[0]}</b><br>${[...t[1]].map(d => DIR_NOM[d].split(' ')[0]).join(' ')}</figcaption></figure>`).join('')}</div>
            <h4 class="mn-h4">Modifications (dans cet ordre)</h4>
            ${regles(['<b>2 lunes</b> : inversez la séquence (la dernière poussée devient la première).', '<b>3 lunes</b> : tournez chaque direction d’un quart de tour dans le sens des aiguilles d’une montre (▲ → ▶ → ▼ → ◀ → ▲).', 'Tracé <b>rouge</b> : échangez la première et la dernière poussée.', 'Tracé <b>vert</b> : si la matricule contient une voyelle, ajoutez une poussée ▲ à la fin.', 'Une mauvaise poussée provoque une erreur et remet la séquence à zéro.'])}`;
    }
});

// ---------- 18. Dérivation d'énergie ----------
M.push({
    id: 'derivation', nom: 'Dérivation d’énergie', diff: 4,
    cible(E) { const t = (E.somme % 10) + 2 * E.cellules + E.ports.length; return t === 0 ? 10 : t; },
    gen(R, E) {
        const T = this.cible(E);
        for (let essai = 0; essai < 400; essai++) {
            const l = [0, 1, 2, 3].map(() => ({ v: R.int(1, 9), c: R() < .3 ? 'rouge' : 'blanc', on: R() < .5 }));
            const ok = [...Array(16).keys()].slice(1).some(m => l.reduce((t, x, i) => t + (m >> i & 1 ? x.v * (x.c === 'rouge' ? 2 : 1) : 0), 0) === T);
            if (ok) return { l: l };
        }
        return { l: [{ v: Math.min(9, T), c: 'blanc', on: false }, { v: Math.max(1, T - 9), c: 'blanc', on: false }, { v: 3, c: 'rouge', on: true }, { v: 5, c: 'blanc', on: false }] };
    },
    total(st) { return st.l.reduce((t, x) => t + (x.on ? x.v * (x.c === 'rouge' ? 2 : 1) : 0), 0); },
    act(st, E, a) {
        if (a.inter != null) { st.l[a.inter].on = !st.l[a.inter].on; return; }
        if (a.deriver) return this.total(st) === this.cible(E) ? 'ok' : 'err';
    },
    sol(st, E) {
        const T = this.cible(E);
        if (this.total(st) === T) return [{ deriver: 1 }];
        for (let m = 1; m < 16; m++) if (st.l.reduce((t, x, i) => t + (m >> i & 1 ? x.v * (x.c === 'rouge' ? 2 : 1) : 0), 0) === T) { const k = st.l.findIndex((x, i) => x.on !== !!(m >> i & 1)); return [{ inter: k }]; }
        return [];
    },
    manuel() {
        return `<p class="mn-p">Quatre lignes d'énergie affichent chacune une <b>valeur</b> (1 à 9) dans un cadre <b>blanc</b> ou <b>rouge</b>, avec un interrupteur. L'écran « CIBLE » est volontairement brouillé : c'est à vous de calculer la puissance à atteindre. Activez les bonnes lignes, puis appuyez sur <b>DÉRIVER</b>.</p>
            ${regles(['Puissance cible = <b>(somme des chiffres de la matricule, chiffre des unités seulement)</b> + <b>2 × le nombre de cellules d’énergie</b> + <b>le nombre de ports</b>.', 'Si le résultat vaut <b>0</b>, la cible est <b>10</b>.', 'Une ligne activée dans un cadre blanc apporte sa valeur ; dans un cadre <b>rouge</b>, elle apporte <b>le double</b>.', 'La somme des lignes activées doit être exactement égale à la cible. Il peut exister plusieurs bonnes combinaisons.'])}
            <div class="mn-ex"><b>Exemple :</b> matricule KX4R72 → 4 + 7 + 2 = 13 → on garde <b>3</b> ; 2 cellules → + 4 ; 1 port → + 1. Cible = <b>8</b>.<br>Lignes : 5 (blanc), 3 (rouge), 6 (blanc), 1 (rouge). Activez le <b>6</b> et le <b>1 rouge</b> (qui compte 2) : 6 + 2 = 8 ✓.</div>
            <div class="mn-note">Une combinaison juste existe toujours. Le démineur peut actionner les interrupteurs autant qu’il veut : seule la touche DÉRIVER est vérifiée.</div>`;
    }
});

// ---------- 19. Recharge des boucliers (récurrent) ----------
const BOU_COUL = ['rouge', 'bleu', 'vert', 'violet'], BOU_SYM = ['losange', 'cercle', 'triangle', 'carre'];
const BOU_T = { pair: { rouge: 'triangle', bleu: 'carre', vert: 'losange', violet: 'cercle' }, impair: { rouge: 'cercle', bleu: 'losange', vert: 'carre', violet: 'triangle' } };
M.push({
    id: 'boucliers', nom: 'Recharge des boucliers', diff: 2, besoin: true, duree: 30000,
    gen(R) { return { actif: 0, fin: 0, col: 'rouge', prochain: 0, R2: R.int(1, 1e6) }; },
    activer(st, R) { st.col = R.pick(BOU_COUL); },
    act(st, E, a) {
        if (!st.actif || !a.sym) return;
        return a.sym === BOU_T[E.cellules % 2 === 0 ? 'pair' : 'impair'][st.col] ? 'ok' : 'err';
    },
    sol(st, E) { return st.actif ? [{ sym: BOU_T[E.cellules % 2 === 0 ? 'pair' : 'impair'][st.col] }] : []; },
    manuel() {
        return `<p class="mn-p"><b>Module récurrent</b> : il ne se neutralise jamais. De temps en temps, il se réveille avec une alarme et un compte à rebours de 30 secondes : l'écran prend la couleur du bouclier à recharger. Appuyez sur le bon symbole avant la fin du compte à rebours, sinon c'est une erreur.</p>
            <table class="mn-table"><tr><th>Bouclier</th><th>Nombre de cellules <b>pair</b> (0, 2, 4)</th><th>Nombre de cellules <b>impair</b> (1, 3)</th></tr>
            ${BOU_COUL.map(c => `<tr><td>${pastille(c)} ${c}</td><td>${SYMBOLES[BOU_T.pair[c]]} ${SYM_NOM[BOU_T.pair[c]]}</td><td>${SYMBOLES[BOU_T.impair[c]]} ${SYM_NOM[BOU_T.impair[c]]}</td></tr>`).join('')}</table>`;
    }
});

// ---------- 20. Détecteur de radiations (récurrent) ----------
const RAD = [
    ['La matricule contient-elle une voyelle ?', E => E.voyelle], ['La charge a-t-elle au moins deux cellules d’énergie ?', E => E.cellules >= 2],
    ['Au moins une balise est-elle allumée ?', E => E.nbOn > 0], ['La charge possède-t-elle un port Plasma ?', E => E.port('Plasma')],
    ['Le dernier chiffre de la matricule est-il pair ?', E => E.dernier % 2 === 0], ['L’emblème de mission est-il Titan ?', E => E.emb === 'Titan'],
    ['La charge a-t-elle exactement une cellule d’énergie ?', E => E.cellules === 1], ['Y a-t-il une balise NAV (allumée ou non) ?', E => E.balise('NAV')],
    ['La charge possède-t-elle au moins deux ports ?', E => E.ports.length >= 2], ['La matricule commence-t-elle par une consonne ?', E => !E.debutVoyelle],
    ['La somme des chiffres de la matricule dépasse-t-elle 12 ?', E => E.somme > 12], ['La charge a-t-elle un port Fibre ou un port Quantique ?', E => E.port('Fibre') || E.port('Quantique')]];
M.push({
    id: 'radiations', nom: 'Détecteur de radiations', diff: 3, besoin: true, duree: 35000,
    gen(R) { return { actif: 0, fin: 0, q: 0, prochain: 0 }; },
    activer(st, R) { st.q = R.int(0, RAD.length - 1); },
    act(st, E, a) {
        if (!st.actif || a.rep == null) return;
        return (a.rep ? true : false) === !!RAD[st.q][1](E) ? 'ok' : 'err';
    },
    sol(st, E) { return st.actif ? [{ rep: RAD[st.q][1](E) ? 1 : 0 }] : []; },
    manuel() {
        return `<p class="mn-p"><b>Module récurrent</b>. Quand il se réveille, l'écran affiche un <b>code de question</b> (R-01 à R-12) et un compte à rebours de 35 secondes. Trouvez la question correspondante, faites vérifier la réponse sur la charge, puis le démineur appuie sur <b>OUI</b> ou <b>NON</b>.</p>
            <table class="mn-table">${RAD.map((r, i) => `<tr><td class="mn-num">R-${String(i + 1).padStart(2, '0')}</td><td>${r[0]}</td></tr>`).join('')}</table>`;
    }
});

// =====================================================================
//  Partie : choix des modules selon le niveau
// =====================================================================
const NIVEAUX = {
    recrue:    { n: 'Recrue', mods: 3, diffMax: 2, besoins: 0, duree: 300, erreurs: 3 },
    officier:  { n: 'Officier', mods: 5, diffMax: 3, besoins: 0, duree: 330, erreurs: 3 },
    commandant: { n: 'Commandant', mods: 7, diffMax: 4, besoins: 1, duree: 420, erreurs: 3 },
    legende:   { n: 'Légende', mods: 9, diffMax: 4, besoins: 2, duree: 540, erreurs: 3 }
};
// construit la charge complète à partir de la graine (identique chez tous les joueurs)
function dsCharge(seed, niveau) {
    const R = dsRng(seed), N = NIVEAUX[niveau] || NIVEAUX.officier;
    const E = dsEngin(R);
    const normaux = M.filter(m => !m.besoin && m.diff <= N.diffMax), besoins = M.filter(m => m.besoin);
    let choix = R.shuffle(normaux).slice(0, N.mods);
    if (N.diffMax >= 3) {     // au moins un module de la difficulté maximale
        if (!choix.some(m => m.diff === N.diffMax)) { const fort = R.pick(normaux.filter(m => m.diff === N.diffMax)); choix[choix.length - 1] = fort; }
    }
    const tous = choix.concat(R.shuffle(besoins).slice(0, N.besoins));
    const slots = R.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, tous.length);     // case 0 = minuteur
    const mods = tous.map((def, i) => ({ id: def.id, slot: slots[i], st: def.gen(R, E), R: dsRng(seed + 17 * (i + 1)) }));
    return { E: E, N: N, mods: mods };
}

// =====================================================================
//  Le manuel complet : pages d'introduction, modules, annexes
// =====================================================================
function etoiles(n) { return '★'.repeat(n) + '☆'.repeat(4 - n); }
function dsManuel() {
    const P = [];
    P.push({ id: 'couverture', groupe: 'Introduction', titre: 'Couverture', html: `
        <div class="mn-couv"><div class="mn-couv-logo">☢</div>
        <div class="mn-couv-t">MANUEL DE NEUTRALISATION</div><div class="mn-couv-s">Charges instables — édition de bord, révision 4.2</div>
        <div class="mn-couv-r">Document réservé aux experts de l’équipage. Ne jamais le montrer au démineur.</div></div>
        <p class="mn-p">Une charge instable a été découverte à bord. Un seul membre d’équipage, le <b>démineur</b>, est face à elle : il la voit, la manipule, mais n’a <b>aucune</b> instruction. Vous, les <b>experts</b>, avez ce manuel mais ne voyez pas la charge. Seule la parole relie les deux.</p>
        <p class="mn-p">Ce manuel décrit les ${M.filter(m => !m.besoin).length} modules de neutralisation connus, les ${M.filter(m => m.besoin).length} modules récurrents, et la façon d’identifier la charge elle-même.</p>` });
    P.push({ id: 'regles', groupe: 'Introduction', titre: 'Règles générales', html: `
        <h4 class="mn-h4">La charge</h4>
        <p class="mn-p">La charge est un boîtier à deux faces (avant et arrière), chacune pouvant accueillir jusqu’à six modules. Le <b>minuteur</b> occupe toujours le haut de la face avant. Les quatre côtés portent des informations indispensables : matricule, cellules d’énergie, balises, ports et emblème de mission (voir l’annexe A).</p>
        <h4 class="mn-h4">Neutraliser</h4>
        ${regles(['La charge est neutralisée quand <b>tous les modules</b> (sauf les modules récurrents) ont leur voyant <b>vert</b>.', 'Chaque erreur allume un ✕ sur le minuteur et <b>accélère le compte à rebours</b> de 25 %.', 'À la <b>troisième erreur</b>, ou quand le minuteur atteint zéro, la charge explose.', 'Les modules peuvent être traités dans n’importe quel ordre.'])}
        <h4 class="mn-h4">Modules récurrents</h4>
        <p class="mn-p">Certains modules ne se neutralisent jamais : ils se réveillent de temps en temps avec un compte à rebours et réclament une réponse rapide. Ignorez-les et ce sera une erreur à chaque fois.</p>
        <h4 class="mn-h4">Conseils aux experts</h4>
        ${regles(['Commencez par demander au démineur de lire <b>tous les côtés</b> de la charge et notez-les : presque tous les modules en ont besoin.', 'Faites décrire le module avant de chercher sa page : sa forme, ses écrans, ses boutons.', 'Répartissez-vous les pages entre experts pour aller plus vite.', 'En cas de doute, faites relire : une erreur coûte cher.'])}
        <h4 class="mn-h4">Niveaux de difficulté</h4>
        <table class="mn-table"><tr><th>Niveau</th><th>Modules</th><th>Récurrents</th><th>Minuteur</th></tr>
        ${Object.values(NIVEAUX).map(n => `<tr><td><b>${n.n}</b></td><td class="mn-num">${n.mods}</td><td class="mn-num">${n.besoins}</td><td class="mn-num">${Math.floor(n.duree / 60)} min ${n.duree % 60 ? (n.duree % 60) + ' s' : ''}</td></tr>`).join('')}</table>
        <p class="mn-p">Chaque module porte une difficulté de ${etoiles(1)} à ${etoiles(4)}.</p>` });
    P.push({ id: 'annexeA', groupe: 'Annexes', titre: 'Annexe A — Identifier la charge', html: `
        <h4 class="mn-h4">Matricule</h4>
        <p class="mn-p">Étiquette blanche à bandeau rouge sur un côté de la charge : six caractères (lettres et chiffres), par exemple <b class="mn-mono">KX4R72</b>.</p>
        ${regles(['Les <b>voyelles</b> sont A, E, I, O, U et Y.', 'Le <b>dernier chiffre</b> est le chiffre le plus à droite.', 'La <b>somme des chiffres</b> additionne seulement les chiffres (KX4R72 → 4 + 7 + 2 = 13).'])}
        <h4 class="mn-h4">Cellules d’énergie</h4>
        <p class="mn-p">Cylindres verts couchés sur le dessus de la charge (de 0 à 4). Comptez-les toutes.</p>
        <h4 class="mn-h4">Balises</h4>
        <p class="mn-p">Petites plaques noires portant trois lettres et un voyant, sur le dessus ou le dessous. Une balise est <b>allumée</b> si son voyant jaune brille. Balises connues : ${DS_BALISES.map(b => `<b class="mn-mono">${b}</b>`).join(', ')}.</p>
        <h4 class="mn-h4">Ports</h4>
        <p class="mn-p">Prises rectangulaires sous la charge, avec leur nom écrit dessous : ${DS_PORTS.map(p => `<b>${p}</b>`).join(', ')}.</p>
        <h4 class="mn-h4">Emblème de mission</h4>
        <p class="mn-p">Médaillon rond collé sur un côté, avec une planète et le nom de la mission : ${DS_EMBLEMES.map(e => `<b>${e}</b>`).join(', ')}.</p>
        <div class="mn-ex"><b>Fiche à remplir dès le début :</b><br>Matricule : ______ · Voyelle : oui / non · Dernier chiffre : __ · Somme : __<br>Cellules : __ · Balises (allumées ?) : ________ · Ports : ________ · Emblème : ________</div>` });
    [1, 2, 3, 4].forEach(d => M.filter(m => !m.besoin && m.diff === d).forEach(m => P.push({ id: m.id, groupe: 'Modules ' + etoiles(d), titre: m.nom, diff: d, html: m.manuel() })));
    M.filter(m => m.besoin).forEach(m => P.push({ id: m.id, groupe: 'Modules récurrents', titre: m.nom, diff: m.diff, besoin: true, html: m.manuel() }));
    P.push({ id: 'annexeB', groupe: 'Annexes', titre: 'Annexe B — Glyphes xénolithes', html: `
        <p class="mn-p">Les 24 glyphes connus, avec leur nom d’usage, leur <b>masse</b> (Clavier xénolithe) et la <b>lettre</b> qu’ils représentent (Transmission xénolithe).</p>
        <table class="mn-table"><tr><th>Glyphe</th><th>Nom</th><th>Masse</th><th>Lettre</th></tr>
        ${DS_GLYPHES.map((g, i) => [i, g]).sort((a, b) => a[1][0].localeCompare(b[1][0], 'fr')).map(([i, g]) => `<tr><td>${dsGlypheSVG(i, 30)}</td><td>${esc(g[0])}</td><td class="mn-num">${DS_MASSE[i]}</td><td class="mn-num"><b>${DS_LETTRE[i]}</b></td></tr>`).join('')}</table>` });
    P.push({ id: 'annexeC', groupe: 'Annexes', titre: 'Annexe C — Aide-mémoire', html: `
        <h4 class="mn-h4">Ordre de l’arc-en-ciel</h4><p class="mn-p">${['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet'].map(c => pastille(c) + ' ' + c).join(' → ')}</p>
        <h4 class="mn-h4">Binaire sur six diodes</h4>
        <table class="mn-table"><tr>${[32, 16, 8, 4, 2, 1].map(v => `<th class="mn-num">${v}</th>`).join('')}</tr><tr>${['●', '○', '●', '○', '○', '●'].map(v => `<td class="mn-num">${v}</td>`).join('')}</tr></table>
        <p class="mn-p">Exemple ci-dessus : 32 + 8 + 1 = 41.</p>
        <h4 class="mn-h4">Rangs de l’alphabet</h4><div class="mn-alpha">${[...ABC].map((L, i) => `<span><b>${L}</b><i>${i}</i></span>`).join('')}</div>
        <h4 class="mn-h4">Rotation horaire</h4><p class="mn-p">▲ haut → ▶ droite → ▼ bas → ◀ gauche → ▲ haut</p>
        <h4 class="mn-h4">Symboles des boutons</h4><p class="mn-p">◆ losange · ● cercle · ▲ triangle · ■ carré</p>` });
    return P;
}

W.DS = { outils: { esc: esc, pastille: pastille, regles: regles, evalRegles: evalRegles, nb: nb }, ABC: ABC, manuel: dsManuel, rng: dsRng, engin: dsEngin, completer: dsCompleter, charge: dsCharge, MODULES: M, NIVEAUX: NIVEAUX, BALISES: DS_BALISES, PORTS: DS_PORTS, EMBLEMES: DS_EMBLEMES,
    GLYPHES: DS_GLYPHES, MASSE: DS_MASSE, LETTRE: DS_LETTRE, glypheSVG: dsGlypheSVG, glypheCanvas: dsGlypheCanvas, COUL: COUL, SYMBOLES: SYMBOLES,
    CONST: CONST, CARTES: CARTES, SECTEURS: SECTEURS, ELEM: ELEM, TRANS: TRANS, freq: freq, PORTE_F: PORTE_F, PORTES: PORTES, CHIF: CHIF, TRAJ: TRAJ, trajPoints: trajPoints,
    QUA_SYM: QUA_SYM, BOU_COUL: BOU_COUL, BOU_SYM: BOU_SYM, RAD: RAD, SAS_ICONE: SAS_ICONE, SYNC_ANG: SYNC_ANG, COND_COUL: COND_COUL, JAUGE_SYM: JAUGE_SYM, quaSVG: quaSVG, porteSVG: porteSVG,
    spectreSVG: spectreSVG, ORD: ORD };
if (typeof module !== 'undefined') module.exports = W.DS;
})();
