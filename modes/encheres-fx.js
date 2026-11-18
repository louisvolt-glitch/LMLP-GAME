// =====================================================================
//  MARCHÉ NOIR DE LA STATION : EFFETS SPÉCIAUX DES LOTS
//  - pendant les mises : une ambiance propre au lot (bulles, étincelles, notes de musique…),
//    et toucher le lot le fait tournoyer ;
//  - quand le lot est ADJUGÉ : une surprise propre à chaque objet (la fusée décolle, le canard
//    fait coin-coin, la bobine Tesla lance des éclairs, l'œuf éclot…) ;
//  - quand il reste INVENDU : il coule tristement ;
//  - de temps en temps, une « édition collector » dorée en bonus.
//  Les effets n'existent que sur l'écran de chaque joueur : ils ne changent rien au jeu.
// =====================================================================

// ---------------- Sons (synthétisés, comme le reste du site) ----------------
const FX_SONS = {
    coin: c => { sysNote(c, 900, 0, 0.12, 'square', 0.09, 1500); sysNote(c, 1400, 0.14, 0.16, 'square', 0.09, 700); },
    pieces: c => { for (let i = 0; i < 7; i++) sysNote(c, 1700 + Math.random() * 900, i * 0.07, 0.14, 'triangle', 0.07); },
    tonnerre: c => { sysBruit(c, 0, 1.3, 700, 0.5, 70); sysNote(c, 55, 0, 0.9, 'sawtooth', 0.12, 30); },
    zap: c => { for (let i = 0; i < 7; i++) sysBruit(c, i * 0.09, 0.07, 3200, 0.22, 1400); sysNote(c, 120, 0, 0.6, 'sawtooth', 0.07, 90); },
    laser: c => { sysNote(c, 1700, 0, 0.32, 'sawtooth', 0.09, 180); sysNote(c, 1300, 0.12, 0.3, 'square', 0.05, 150); },
    fusee: c => { sysBruit(c, 0, 1.8, 180, 0.35, 2200); sysNote(c, 70, 0, 1.6, 'sawtooth', 0.07, 320); },
    melodie: c => { [523, 659, 784, 659, 698, 880, 784].forEach((f, i) => sysNote(c, f, i * 0.2, 0.32, 'triangle', 0.09)); },
    accord: c => { [82, 123, 165, 247].forEach(f => { sysNote(c, f, 0, 1.3, 'sawtooth', 0.06); sysNote(c, f * 1.01, 0, 1.3, 'square', 0.03); }); },
    bip8: c => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => sysNote(c, f, i * 0.08, 0.08, 'square', 0.06)); },
    piece8: c => { sysNote(c, 988, 0, 0.08, 'square', 0.08); sysNote(c, 1319, 0.08, 0.4, 'square', 0.08); },
    mystere: c => { sysNote(c, 110, 0, 2.4, 'sine', 0.13, 103); sysNote(c, 165, 0.1, 2.2, 'sine', 0.08, 158); sysNote(c, 233, 0.4, 1.8, 'sine', 0.05); },
    tictac: c => { for (let i = 0; i < 8; i++) sysNote(c, i % 2 ? 1900 : 1450, i * 0.24, 0.03, 'square', 0.08); },
    pop: c => { sysNote(c, 380, 0, 0.09, 'sine', 0.2, 950); },
    cloche: c => { sysNote(c, 1320, 0, 1.3, 'sine', 0.12); sysNote(c, 2640, 0, 0.8, 'sine', 0.05); sysNote(c, 1980, 0.02, 1, 'sine', 0.04); },
    bulles: c => { for (let i = 0; i < 9; i++) sysNote(c, 300 + Math.random() * 500, i * 0.1 + Math.random() * 0.05, 0.08, 'sine', 0.12, 900 + Math.random() * 500); },
    crac: c => { sysBruit(c, 0, 0.05, 3200, 0.4); sysBruit(c, 0.18, 0.05, 2600, 0.35); sysBruit(c, 0.4, 0.14, 1800, 0.45); },
    ding: c => { sysNote(c, 300, 0, 0.22, 'triangle', 0.1, 950); sysNote(c, 1760, 0.25, 0.9, 'sine', 0.14); },
    teleport: c => { for (let i = 0; i < 6; i++) sysNote(c, 300 + i * 250, i * 0.07, 0.3, 'sine', 0.07, 2600); },
    moteur: c => { sysNote(c, 50, 0, 1.4, 'sawtooth', 0.1, 120); sysBruit(c, 0, 1.4, 400, 0.12, 900); },
    grogne: c => { sysNote(c, 95, 0, 0.7, 'sawtooth', 0.14, 55); sysBruit(c, 0, 0.7, 320, 0.18, 140); },
    cristal: c => { [1568, 2093, 2637, 3136, 4186].forEach((f, i) => sysNote(c, f, i * 0.07, 0.7, 'sine', 0.06)); },
    souffle: c => { sysBruit(c, 0, 1.1, 5200, 0.25, 3600); },
    robot: c => { [600, 900, 420, 1250, 800].forEach((f, i) => sysNote(c, f, i * 0.11, 0.09, 'square', 0.06)); },
    boom: c => { sysBruit(c, 0, 1, 1300, 0.55, 50); sysNote(c, 90, 0, 0.7, 'sine', 0.3, 35); },
    gong: c => { sysNote(c, 98, 0, 2.8, 'sine', 0.2); sysNote(c, 147, 0, 2.2, 'sine', 0.1); sysBruit(c, 0, 0.15, 900, 0.2); },
    choeur: c => { [220, 277, 330, 440].forEach((f, i) => sysNote(c, f, i * 0.15, 2.6, 'sine', 0.06, f * 0.995)); },
    croque: c => { sysBruit(c, 0, 0.12, 2600, 0.4, 900); sysBruit(c, 0.35, 0.12, 2400, 0.35, 800); },
    magie: c => { [784, 988, 1175, 1319, 1568, 1976, 2349, 2637].forEach((f, i) => sysNote(c, f, i * 0.05, 0.3, 'sine', 0.06)); },
    aspire: c => { sysNote(c, 2200, 0, 0.9, 'sine', 0.12, 70); sysBruit(c, 0, 0.9, 4200, 0.2, 180); },
    ressort: c => { sysNote(c, 220, 0, 0.5, 'triangle', 0.12, 1100); sysNote(c, 330, 0.08, 0.4, 'sine', 0.05, 900); },
    plouf: c => { sysBruit(c, 0, 0.4, 900, 0.35, 200); sysNote(c, 600, 0.02, 0.25, 'sine', 0.12, 180); },
    vent: c => { sysBruit(c, 0, 1.8, 600, 0.18, 1600); },
    fanfare: c => { [523, 523, 523, 659, 784, 1047].forEach((f, i) => sysNote(c, f, [0, 0.12, 0.24, 0.36, 0.56, 0.8][i], i === 5 ? 0.7 : 0.11, 'square', 0.07)); }
};
function fxSon(nom) {
    try {
        if (FX_SONS[nom]) {
            if (typeof sysSon !== 'undefined' && !sysSon.on) return;
            const c = typeof sysCtx === 'function' ? sysCtx() : null;
            if (c) FX_SONS[nom](c);
        } else if (typeof window.sfx === 'function') window.sfx(nom);      // sons communs : victoire, argent, warp, sonar, sas, alarme, coule…
    } catch (e) {}
}

// ---------------- Textures des particules ----------------
const fxTextures = {};
function fxTexture(T, cle) {
    if (fxTextures[cle]) return fxTextures[cle];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    if (cle === 'rond') {
        const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    } else if (cle === 'etoile') {
        g.translate(32, 32); g.fillStyle = '#fff';
        for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4 * k); g.beginPath(); g.moveTo(0, -30); g.lineTo(5, 0); g.lineTo(0, 30); g.lineTo(-5, 0); g.fill(); g.beginPath(); g.moveTo(-30, 0); g.lineTo(0, 5); g.lineTo(30, 0); g.lineTo(0, -5); g.fill(); }
    } else if (cle === 'carre') {
        g.fillStyle = '#fff'; g.fillRect(14, 14, 36, 36);
    } else {                                    // un emoji ou un caractère
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '50px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        g.fillStyle = '#fff'; g.fillText(cle, 32, 35);
    }
    const tex = new T.CanvasTexture(cv);
    if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
    return fxTextures[cle] = tex;
}

// ---------------- Boîte à outils ----------------
window.enchCreerFx = function(T, ctx) {
    // ctx : { scene, cam, mouv (groupe que les mouvements déplacent), lumieres, el }
    const fx = { t: 0, taches: [], objets: [], doms: [] };
    const scene = ctx.scene, alea = (a, b) => a + Math.random() * (b - a);
    const choisir = l => l[Math.floor(Math.random() * l.length)];
    const ajouter = f => { fx.taches.push(f); };
    const retenir = o => { fx.objets.push(o); scene.add(o); return o; };
    const oublier = o => {
        scene.remove(o);
        o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material && x.material.dispose) x.material.dispose(); });
        fx.objets = fx.objets.filter(y => y !== o);
    };

    fx.maj = dt => {
        fx.t += dt;
        // les effets lancés pendant ce passage (ex. « 1 s plus tard… ») sont gardés pour le passage suivant
        const encours = fx.taches; fx.taches = [];
        const garder = encours.filter(f => { try { return f(dt, fx.t) !== false; } catch (e) { if (window.ENCH_FX_DEBUG) window.ENCH_FX_DEBUG(e); return false; } });
        fx.taches = garder.concat(fx.taches);
    };
    fx.detruire = () => {
        fx.taches = [];
        fx.objets.slice().forEach(oublier);
        fx.doms.forEach(d => d.remove()); fx.doms = [];
        ctx.mouv.position.set(0, 0, 0); ctx.mouv.rotation.set(0, 0, 0); ctx.mouv.scale.set(1, 1, 1);
    };
    fx.apres = (s, fn) => { const t0 = fx.t; ajouter(() => { if (fx.t - t0 >= s) { fn(); return false; } }); };
    fx.son = (nom, s) => { if (s) fx.apres(s, () => fxSon(nom)); else fxSon(nom); };

    // --- particules lumineuses (nuage de points, chaque point s'éteint en fin de vie) ---
    fx.particules = o => {
        const max = o.n || 60, tex = fxTexture(T, o.texture || 'rond');
        const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
        const mat = new T.PointsMaterial({ size: o.taille || 0.18, map: tex, vertexColors: true, transparent: true, depthWrite: false,
            blending: o.normal ? T.NormalBlending : T.AdditiveBlending, sizeAttenuation: true });
        const pts = retenir(new T.Points(geo, mat)); pts.frustumCulled = false;
        const couleurs = (o.couleurs || [0xffffff]).map(c => new T.Color(c));
        const P = [];
        const naitre = () => {
            const o0 = typeof o.origine === 'function' ? o.origine() : (o.origine || [0, 0, 0]);
            const v = typeof o.vitesse === 'function' ? o.vitesse() : [alea(-1, 1), alea(-1, 1), alea(-1, 1)];
            P.push({ p: o0.slice(), v: v, age: 0, vie: alea(o.vie ? o.vie[0] : 0.6, o.vie ? o.vie[1] : 1.4), c: choisir(couleurs) });
        };
        const duree = o.duree == null ? 0 : o.duree;              // 0 = tout d'un coup ; Infinity = en continu
        if (!duree) for (let k = 0; k < max; k++) naitre();
        const debit = duree ? (o.debit || max / Math.min(duree, 2)) : 0;
        let reserve = 0;
        ajouter(dt => {
            if (duree && fx.t < (o._fin || (o._fin = fx.t + duree))) { reserve += debit * dt; while (reserve >= 1 && P.length < max) { naitre(); reserve--; } }
            const g = o.gravite || 0, frein = o.frein || 0;
            for (let k = P.length - 1; k >= 0; k--) {
                const q = P[k]; q.age += dt;
                if (q.age >= q.vie) { P.splice(k, 1); continue; }
                q.v[1] -= g * dt; if (frein) { const f = Math.max(0, 1 - frein * dt); q.v[0] *= f; q.v[1] *= f; q.v[2] *= f; }
                if (o.tourbillon) { const x = q.p[0], z = q.p[2], a = o.tourbillon * dt; q.p[0] = x * Math.cos(a) - z * Math.sin(a); q.p[2] = x * Math.sin(a) + z * Math.cos(a); }
                q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt;
            }
            for (let k = 0; k < max; k++) {
                const q = P[k];
                if (!q) { pos[k * 3 + 1] = -999; col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 0; continue; }
                pos[k * 3] = q.p[0]; pos[k * 3 + 1] = q.p[1]; pos[k * 3 + 2] = q.p[2];
                const r = q.age / q.vie, f = r < 0.15 ? r / 0.15 : 1 - (r - 0.15) / 0.85;
                col[k * 3] = q.c.r * f; col[k * 3 + 1] = q.c.g * f; col[k * 3 + 2] = q.c.b * f;
            }
            geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
            const fini = duree === Infinity ? false : (fx.t >= (o._fin || 0) && P.length === 0);
            if (fini) { oublier(pts); return false; }
        });
    };

    // --- petits objets-images (emojis) qui volent, tournent et s'effacent ---
    fx.emojis = o => {
        const n = o.n || 12;
        const naitre = () => {
            const m = new T.SpriteMaterial({ map: fxTexture(T, choisir(o.emojis)), transparent: true, depthWrite: false });
            const s = retenir(new T.Sprite(m)); const t = o.taille || 0.35; s.scale.set(t, t, t);
            const o0 = typeof o.origine === 'function' ? o.origine() : (o.origine || [0, 0, 0]);
            s.position.set(o0[0], o0[1], o0[2]);
            const v = typeof o.vitesse === 'function' ? o.vitesse() : [alea(-1.5, 1.5), alea(1.5, 3.5), alea(-1, 1)];
            const vie = alea(o.vie ? o.vie[0] : 1.2, o.vie ? o.vie[1] : 2), rot = alea(-3, 3) * (o.rotation == null ? 1 : o.rotation);
            let age = 0;
            ajouter(dt => {
                age += dt; if (age >= vie) { oublier(s); return false; }
                v[1] -= (o.gravite == null ? 3 : o.gravite) * dt;
                s.position.x += v[0] * dt; s.position.y += v[1] * dt; s.position.z += v[2] * dt;
                m.rotation += rot * dt; m.opacity = Math.min(1, (vie - age) / 0.4);
            });
        };
        if (o.duree) { let fait = 0; const t0 = fx.t; ajouter(() => { const cible = Math.min(n, Math.floor((fx.t - t0) / o.duree * n)); while (fait < cible) { naitre(); fait++; } if (fait >= n) return false; }); }
        else for (let k = 0; k < n; k++) naitre();
    };

    // --- mouvements du lot (un à la fois) ---
    const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const MOUVEMENTS = {
        saut: p => ({ y: 0.7 * Math.abs(Math.sin(Math.PI * 3 * p)) * (1 - p) }),
        decollage: p => p < 0.2 ? { x: alea(-0.04, 0.04), z: alea(-0.04, 0.04) }
            : p < 0.55 ? { y: Math.pow((p - 0.2) / 0.35, 2) * 7 }
            : p < 0.62 ? { y: 7 } : { y: 7 * (1 - ease((p - 0.62) / 0.38)) },
        toupie: p => ({ ry: Math.PI * 6 * ease(p) }),
        retourne: p => ({ rx: Math.PI * 2 * ease(p), y: Math.sin(Math.PI * p) * 0.6 }),
        tonneau: p => ({ rz: Math.PI * 2 * ease(p), x: Math.sin(Math.PI * 2 * p) * 0.5 }),
        tremble: p => ({ x: alea(-0.08, 0.08) * (1 - p), z: alea(-0.08, 0.08) * (1 - p), rz: alea(-0.06, 0.06) * (1 - p) }),
        pulse: p => { const s = 1 + 0.35 * Math.sin(Math.PI * p); return { s: s }; },
        teleporte: p => ({ s: p < 0.4 ? 1 - ease(p / 0.4) : p < 0.6 ? 0.001 : ease((p - 0.6) / 0.4), ry: Math.PI * 6 * p }),
        flotte: p => ({ y: Math.sin(Math.PI * p) * 0.7, rx: Math.sin(p * 9) * 0.35 * Math.sin(Math.PI * p), rz: Math.cos(p * 7) * 0.4 * Math.sin(Math.PI * p) }),
        chute: p => ({ y: p < 0.45 ? 6 * (1 - ease(p / 0.45)) : Math.abs(Math.sin((p - 0.45) / 0.55 * Math.PI * 2)) * 0.35 * (1 - (p - 0.45) / 0.55) }),
        ecrase: p => { const k = Math.sin(Math.PI * 4 * p) * (1 - p); return { sy: 1 - 0.35 * k, sx: 1 + 0.2 * k, sz: 1 + 0.2 * k }; },
        vol: p => ({ x: 2.4 * Math.sin(Math.PI * 2 * p), z: 1.6 * (Math.cos(Math.PI * 2 * p) - 1), rz: -0.5 * Math.sin(Math.PI * 2 * p) }),
        leve: p => ({ y: Math.sin(Math.PI * p) * 1.1, s: 1 + Math.sin(Math.PI * p) * 0.15 }),
        coule: p => ({ y: -Math.sin(Math.PI * Math.min(1, p * 1.2)) * 0.9, rz: Math.sin(Math.PI * p) * 0.35, s: 1 - Math.sin(Math.PI * p) * 0.2 }),
        bascule: p => ({ rx: Math.sin(Math.PI * 4 * p) * 0.5 * (1 - p) }),
        valse: p => ({ ry: Math.PI * 4 * ease(p), x: Math.sin(Math.PI * 2 * p) * 0.8, y: Math.abs(Math.sin(Math.PI * 4 * p)) * 0.3 })
    };
    let mouvement = null;
    fx.mouvement = (nom, duree) => {
        const f = MOUVEMENTS[nom]; if (!f) return;
        const m = { f: f, t0: fx.t, d: duree || 1.6 };
        mouvement = m;
        ajouter(() => {
            if (mouvement !== m) return false;
            const p = Math.min(1, (fx.t - m.t0) / m.d), r = m.f(p) || {};
            const s = r.s == null ? 1 : r.s;
            ctx.mouv.position.set(r.x || 0, r.y || 0, r.z || 0);
            ctx.mouv.rotation.set(r.rx || 0, r.ry || 0, r.rz || 0);
            ctx.mouv.scale.set(s * (r.sx || 1), s * (r.sy || 1), s * (r.sz || 1));
            if (p >= 1) { ctx.mouv.position.set(0, 0, 0); ctx.mouv.rotation.set(0, 0, 0); ctx.mouv.scale.set(1, 1, 1); mouvement = null; return false; }
        });
    };

    // --- lumières ---
    fx.flash = (couleur, force, duree) => {
        const l = retenir(new T.PointLight(couleur, 0, 12)); l.position.set(0, 0.8, 2.4);
        const f = force || 6, d = duree || 0.7, t0 = fx.t;
        ajouter(() => { const p = (fx.t - t0) / d; if (p >= 1) { oublier(l); return false; } l.intensity = f * (1 - p) * (p < 0.08 ? p / 0.08 : 1); });
    };
    fx.lueur = (couleur, force, vitesse, duree) => {
        const l = retenir(new T.PointLight(couleur, 0, 8)); l.position.set(0, 0.3, 1.6);
        const t0 = fx.t, d = duree || Infinity;
        ajouter(() => { const e = fx.t - t0; if (e >= d) { oublier(l); return false; } l.intensity = (force || 1.5) * (0.6 + 0.4 * Math.sin(e * (vitesse || 3))); });
    };
    fx.obscurite = (duree, niveau) => {
        const L = ctx.lumieres || [], base = L.map(l => l.intensity), t0 = fx.t, d = duree || 2, n = niveau == null ? 0.12 : niveau;
        ajouter(() => {
            const p = Math.min(1, (fx.t - t0) / d), k = p < 0.15 ? 1 - (1 - n) * p / 0.15 : p > 0.85 ? n + (1 - n) * (p - 0.85) / 0.15 : n;
            L.forEach((l, i) => { l.intensity = base[i] * k; });
            if (p >= 1) { L.forEach((l, i) => { l.intensity = base[i]; }); return false; }
        });
    };
    fx.strobo = (couleurs, duree) => {
        const l = retenir(new T.PointLight(couleurs[0], 0, 12)); l.position.set(0, 1, 2.5);
        const t0 = fx.t, d = duree || 1.5;
        ajouter(() => { const e = fx.t - t0; if (e >= d) { oublier(l); return false; } const k = Math.floor(e * 12); l.color.set(couleurs[k % couleurs.length]); l.intensity = k % 2 ? 0 : 5; });
    };

    // --- ondes de choc, faisceaux, éclairs ---
    fx.onde = (couleur, o) => {
        o = o || {};
        const m = new T.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending });
        const r = retenir(new T.Mesh(new T.RingGeometry(0.85, 1, 64), m));
        if (o.vertical) r.position.set(0, o.y || 0, 0); else { r.rotation.x = -Math.PI / 2; r.position.y = o.y == null ? -1.2 : o.y; }
        const t0 = fx.t, d = o.duree || 1, fin = o.taille || 3.2;
        ajouter(() => { const p = (fx.t - t0) / d; if (p >= 1) { oublier(r); return false; } const s = 0.4 + (fin - 0.4) * ease(p); r.scale.set(s, s, s); m.opacity = 0.85 * (1 - p); });
    };
    fx.faisceau = (couleur, duree, rayon) => {
        const m = new T.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending });
        const b = retenir(new T.Mesh(new T.CylinderGeometry(rayon || 0.9, rayon || 0.9, 9, 32, 1, true), m)); b.position.y = 3.2;
        const t0 = fx.t, d = duree || 2;
        ajouter(() => { const p = (fx.t - t0) / d; if (p >= 1) { oublier(b); return false; } m.opacity = 0.35 * Math.sin(Math.PI * p) * (0.8 + 0.2 * Math.sin(fx.t * 30)); b.rotation.y += 0.05; });
    };
    fx.eclairs = (couleur, duree, n, rayon) => {
        const d = duree || 1.2, R = rayon || 1.5, t0 = fx.t;
        const lignes = Array.from({ length: n || 3 }, () => {
            const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(10 * 3), 3));
            const l = retenir(new T.Line(geo, new T.LineBasicMaterial({ color: couleur, transparent: true }))); l.frustumCulled = false; return l;
        });
        let prochain = 0;
        ajouter(() => {
            const e = fx.t - t0; if (e >= d) { lignes.forEach(oublier); return false; }
            if (fx.t < prochain) return; prochain = fx.t + 0.06;
            lignes.forEach(l => {
                const a = alea(0, Math.PI * 2), h = alea(-0.4, 1), A = [0, 0.7, 0], Bp = [Math.cos(a) * R, h, Math.sin(a) * R];
                const pos = l.geometry.attributes.position;
                for (let j = 0; j < 10; j++) { const f = j / 9, b = j && j < 9 ? 0.18 : 0; pos.setXYZ(j, A[0] + (Bp[0] - A[0]) * f + alea(-b, b), A[1] + (Bp[1] - A[1]) * f + alea(-b, b), A[2] + (Bp[2] - A[2]) * f + alea(-b, b)); }
                pos.needsUpdate = true; l.material.opacity = Math.random() < 0.25 ? 0 : 1;
            });
        });
    };
    fx.secousse = (force, duree) => {
        const base = ctx.cam.position.clone(), t0 = fx.t, d = duree || 0.6, f = force || 0.12;
        ajouter(() => { const p = (fx.t - t0) / d; if (p >= 1) { ctx.cam.position.copy(base); return false; } ctx.cam.position.set(base.x + alea(-f, f) * (1 - p), base.y + alea(-f, f) * (1 - p), base.z); });
    };

    // --- bulle de bande dessinée par-dessus le lot ---
    fx.bulle = (texte, couleur, duree) => {
        if (!ctx.el) return;
        const b = document.createElement('div');
        b.textContent = texte;
        b.style.cssText = `position:absolute;left:50%;top:10%;transform:translate(-50%,0) scale(.2) rotate(-6deg);opacity:0;z-index:5;pointer-events:none;
            background:#fff;color:${couleur || '#0f172a'};font-weight:900;font-size:clamp(13px,3.6vw,20px);letter-spacing:.04em;padding:6px 14px;border-radius:16px;
            border:3px solid #0f172a;box-shadow:4px 4px 0 #0f172a;white-space:nowrap;transition:transform .25s cubic-bezier(.3,1.7,.5,1),opacity .2s`;
        ctx.el.appendChild(b); fx.doms.push(b);
        requestAnimationFrame(() => { b.style.opacity = '1'; b.style.transform = 'translate(-50%,0) scale(1) rotate(-6deg)'; });
        fx.apres(duree || 2.2, () => { b.style.opacity = '0'; b.style.transform = 'translate(-50%,-20px) scale(.9) rotate(-6deg)'; });
    };

    // --- ambiances (en continu pendant les mises) ---
    const autour = (r, y0, y1) => () => { const a = alea(0, Math.PI * 2), rr = alea(0.3, r || 1.3); return [Math.cos(a) * rr, alea(y0 == null ? -1 : y0, y1 == null ? 1 : y1), Math.sin(a) * rr]; };
    fx.ambiance = (type, couleur) => {
        const c = couleur || 0x7dd3fc;
        const A = {
            etincelles: () => fx.particules({ n: 40, duree: Infinity, debit: 10, origine: autour(1.3), vitesse: () => [0, alea(0.05, 0.2), 0], vie: [0.6, 1.4], taille: 0.14, couleurs: [c, 0xffffff], texture: 'etoile' }),
            bulles: () => fx.particules({ n: 40, duree: Infinity, debit: 10, origine: autour(1, -1.3, -0.8), vitesse: () => [alea(-0.05, 0.05), alea(0.5, 1), alea(-0.05, 0.05)], vie: [2, 3], taille: 0.12, couleurs: [0xbae6fd, 0xe0f2fe] }),
            fumee: () => fx.particules({ n: 30, duree: Infinity, debit: 7, origine: autour(0.4, 0.6, 0.9), vitesse: () => [alea(-0.1, 0.1), alea(0.3, 0.6), alea(-0.1, 0.1)], vie: [1.5, 2.5], taille: 0.5, couleurs: [0x475569, 0x64748b] }),
            braises: () => fx.particules({ n: 40, duree: Infinity, debit: 12, origine: autour(0.9, -1.2, -0.6), vitesse: () => [alea(-0.15, 0.15), alea(0.4, 0.9), alea(-0.15, 0.15)], vie: [1, 2], taille: 0.12, couleurs: [0xf97316, 0xfbbf24, 0xef4444] }),
            notes: () => fx.particules({ n: 14, duree: Infinity, debit: 2.5, origine: autour(1, 0.2, 0.8), vitesse: () => [alea(-0.2, 0.2), alea(0.3, 0.5), 0], vie: [2, 3], taille: 0.32, couleurs: [c, 0xffffff], texture: '♪', normal: true }),
            orbite: () => fx.particules({ n: 30, duree: Infinity, debit: 8, origine: autour(1.4, -0.3, 0.3), vitesse: () => [0, 0, 0], tourbillon: 1.2, vie: [1.5, 2.5], taille: 0.12, couleurs: [c] }),
            poussiere: () => fx.particules({ n: 50, duree: Infinity, debit: 12, origine: autour(1.8, -1.2, 1.2), vitesse: () => [alea(-0.05, 0.05), alea(-0.05, 0.05), alea(-0.05, 0.05)], vie: [2, 4], taille: 0.05, couleurs: [0xfde68a, 0xffffff] }),
            arcs: () => { fx.lueur(c, 1.2, 9); const boucle = () => { fx.eclairs(c, 0.15, 1, 1.2); fx.apres(alea(0.8, 2), boucle); }; boucle(); },
            pixels: () => fx.particules({ n: 30, duree: Infinity, debit: 6, origine: autour(1.3), vitesse: () => [0, alea(0.2, 0.4), 0], vie: [1, 2], taille: 0.12, couleurs: [0xf43f5e, 0x22c55e, 0x3b82f6, 0xfacc15], texture: 'carre' }),
            neige: () => fx.particules({ n: 50, duree: Infinity, debit: 12, origine: () => [alea(-1.8, 1.8), 1.8, alea(-1, 1)], vitesse: () => [alea(-0.1, 0.1), alea(-0.5, -0.3), 0], vie: [3, 4], taille: 0.08, couleurs: [0xffffff, 0xe0f2fe] }),
            lueur: () => fx.lueur(c, 2.2, 2.5),
            gaz: () => fx.particules({ n: 40, duree: Infinity, debit: 10, origine: autour(0.8), vitesse: () => [alea(-0.2, 0.2), alea(-0.1, 0.3), alea(-0.2, 0.2)], vie: [1.2, 2.2], taille: 0.35, couleurs: [c] }),
            donnees: () => fx.particules({ n: 30, duree: Infinity, debit: 6, origine: autour(1.3, -1, 0), vitesse: () => [0, alea(0.3, 0.6), 0], vie: [1.5, 2.5], taille: 0.22, couleurs: [c], texture: Math.random() < 0.5 ? '0' : '1', normal: true })
        };
        (A[type] || A.etincelles)();
    };

    // --- effets tout prêts réutilisés par plusieurs lots ---
    fx.gerbe = (couleurs, n, force) => fx.particules({ n: n || 80, origine: [0, 0, 0], vitesse: () => { const a = alea(0, Math.PI * 2), e = alea(-0.3, 1.2), v = alea(1.5, force || 4); return [Math.cos(a) * v * Math.cos(e), Math.sin(e) * v, Math.sin(a) * v * Math.cos(e)]; }, gravite: 2.5, frein: 0.8, vie: [0.6, 1.4], taille: 0.16, couleurs: couleurs });
    fx.pluie = (emojis, n, duree) => fx.emojis({ emojis: emojis, n: n || 18, duree: duree || 1.2, origine: () => [alea(-2, 2), 2.6, alea(-0.8, 0.8)], vitesse: () => [alea(-0.3, 0.3), alea(-1.5, -0.5), 0], gravite: 2, vie: [1.6, 2.2] });
    fx.jaillir = (emojis, n) => fx.emojis({ emojis: emojis, n: n || 12, origine: [0, 0.4, 0], vitesse: () => [alea(-2, 2), alea(2.5, 4.5), alea(-0.8, 0.8)], gravite: 4.5, vie: [1.2, 1.8] });
    fx.monter = (emojis, n, duree) => fx.emojis({ emojis: emojis, n: n || 10, duree: duree || 1.5, origine: () => [alea(-1, 1), alea(-0.5, 0.5), alea(-0.3, 0.6)], vitesse: () => [alea(-0.3, 0.3), alea(0.8, 1.4), 0], gravite: 0, vie: [1.4, 2], rotation: 0.3 });
    return fx;
};

// =====================================================================
//  LES SURPRISES : une par lot (clé = nom du fichier du modèle)
//  a = ambiance pendant les mises [type, couleur] ; s = surprise quand le lot est adjugé
// =====================================================================
const ENCH_SURPRISES = {
    'antenne-longue-portee': { a: ['orbite', 0xf472b6], s: fx => { fx.son('sonar'); [0, 0.4, 0.8].forEach(t => fx.apres(t, () => fx.onde(0xf472b6, { vertical: true, y: 0.4, taille: 4 }))); fx.mouvement('bascule', 2); fx.apres(1.3, () => { fx.bulle('📡 Signal extraterrestre capté !', '#be185d'); fx.son('robot'); fx.monter(['👽', '🛸', '📶'], 8); }); } },
    'antimatiere-instable': { a: ['gaz', 0xa855f7], s: fx => { fx.son('aspire'); fx.mouvement('teleporte', 1.6); fx.particules({ n: 120, origine: () => { const a = Math.random() * 6.3, r = 2.5; return [Math.cos(a) * r, Math.random() * 2 - 1, Math.sin(a) * r]; }, vitesse: () => [0, 0, 0], tourbillon: 4, frein: 0, vie: [0.7, 0.8], taille: 0.15, couleurs: [0xa855f7, 0xe879f9] }); fx.apres(0.75, () => { fx.son('boom'); fx.flash(0xc084fc, 12, 0.9); fx.secousse(0.2, 0.7); fx.gerbe([0xa855f7, 0xffffff, 0xe879f9], 140, 6); fx.onde(0xe879f9, { vertical: true, y: 0, taille: 5 }); fx.bulle('⚠️ CONFINEMENT ROMPU !', '#7e22ce'); }); } },
    'appareil-mysterieux': { a: ['lueur', 0xf97316], s: fx => { fx.son('mystere'); fx.obscurite(2.8, 0.1); fx.mouvement('tremble', 1.2); fx.apres(1.2, () => { fx.son('laser'); fx.flash(0xf97316, 8, 0.6); fx.mouvement('toupie', 1.4); fx.gerbe([0xf97316, 0xfde047], 70, 4); fx.bulle('❓ Personne ne sait à quoi ça sert…'); }); } },
    'aquarium-de-poche': { a: ['bulles'], s: fx => { fx.son('bulles'); fx.particules({ n: 80, duree: 1.5, origine: () => [Math.random() - 0.5, 0, Math.random() - 0.5], vitesse: () => [Math.random() - 0.5, 2 + Math.random() * 2, Math.random() - 0.5], gravite: 0.5, vie: [1, 1.8], taille: 0.15, couleurs: [0xbae6fd, 0xffffff] }); fx.mouvement('bascule', 1.6); fx.apres(0.6, () => { fx.jaillir(['🐟', '🐠', '🐡'], 6); fx.son('plouf'); fx.bulle('🐠 Blub blub !', '#0369a1'); }); } },
    'artefact-pyramidal': { a: ['poussiere'], s: fx => { fx.son('choeur'); fx.obscurite(3, 0.15); fx.faisceau(0xfde047, 2.8, 0.25); fx.mouvement('leve', 2.6); fx.apres(0.9, () => { fx.monter(['𓂀', '𓋹', '𓆣', '☥'], 10, 1.4); fx.bulle('𓂀 Les anciens se sont réveillés', '#a16207'); }); } },
    'balise-extraterrestre': { a: ['lueur', 0x22d3ee], s: fx => { fx.son('alarme'); fx.strobo([0xef4444, 0x22d3ee], 1.6); fx.mouvement('tremble', 1); fx.apres(1, () => { fx.faisceau(0x86efac, 1.8, 1.1); fx.son('teleport'); fx.jaillir(['👽'], 3); fx.bulle('👽 Ils arrivent…', '#15803d'); }); } },
    'bobine-tesla': { a: ['arcs', 0x93c5fd], s: fx => { fx.son('zap'); fx.eclairs(0xbfdbfe, 2.2, 5, 2.2); fx.strobo([0xffffff, 0x60a5fa], 2); fx.secousse(0.08, 2); fx.apres(1.6, () => { fx.son('tonnerre'); fx.flash(0x93c5fd, 10, 0.6); fx.bulle('⚡ 1,21 GIGAWATTS !', '#1d4ed8'); }); } },
    'bonsai-de-la-terre': { a: ['poussiere'], s: fx => { fx.son('magie'); fx.mouvement('pulse', 1.5); fx.pluie(['🌸', '🍃', '🌸'], 24, 2); fx.flash(0xf9a8d4, 3, 1.2); fx.bulle('🌸 100 ans de patience', '#be185d'); } },
    'boussole-cosmique': { a: ['etincelles', 0x67e8f9], s: fx => { fx.son('cristal'); fx.mouvement('toupie', 2.2); fx.particules({ n: 90, duree: 1.8, origine: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 1.4, Math.random() - 0.5, Math.sin(a) * 1.4]; }, vitesse: () => [0, 0.3, 0], tourbillon: 3, vie: [0.8, 1.4], taille: 0.14, couleurs: [0x67e8f9, 0xffffff], texture: 'etoile' }); fx.apres(1.6, () => fx.bulle('🧭 Le nord ? Par là… ou là.', '#0e7490')); } },
    'bouteille-d-oxygene': { a: ['neige'], s: fx => { fx.son('souffle'); fx.particules({ n: 100, duree: 1.4, origine: [0, 1, 0], vitesse: () => [(Math.random() - 0.5) * 1.5, 3 + Math.random(), (Math.random() - 0.5) * 1.5], frein: 1.2, vie: [0.8, 1.5], taille: 0.45, couleurs: [0xe2e8f0, 0xcbd5e1] }); fx.mouvement('decollage', 2.6); fx.apres(1.1, () => fx.bulle('💨 Pschhhhhhh !', '#334155')); } },
    'bras-robotique': { a: ['etincelles', 0xfbbf24], s: fx => { fx.son('robot'); fx.mouvement('valse', 2.4); fx.apres(0.5, () => { fx.particules({ n: 60, duree: 1.2, origine: [0.6, 0.3, 0.4], vitesse: () => [Math.random() * 2, Math.random() * 2, Math.random()], gravite: 4, vie: [0.4, 0.9], taille: 0.1, couleurs: [0xfbbf24, 0xffffff] }); fx.bulle('🦾 Je peux aussi faire la vaisselle !', '#a16207'); }); } },
    'burger-terrien-legendaire': { a: ['fumee'], s: fx => { fx.son('croque'); fx.mouvement('ecrase', 1.2); fx.jaillir(['🍟', '🧀', '🥓', '🥬'], 14); fx.apres(0.9, () => { fx.son('fanfare'); fx.bulle('🍔 Miam ! Recette d’origine terrienne', '#b45309'); }); } },
    'canard-en-caoutchouc-d-astronaute': { a: ['bulles'], s: fx => { fx.son('coin'); fx.mouvement('saut', 1.6); fx.son('coin', 0.5); fx.son('coin', 1); fx.apres(0.3, () => { fx.jaillir(['🦆', '🫧'], 10); fx.bulle('🦆 COIN ! COIN !', '#ca8a04'); }); } },
    'capsule-de-survie': { a: ['braises'], s: fx => { fx.son('fusee'); fx.mouvement('decollage', 2.8); fx.particules({ n: 140, duree: 1.6, origine: () => [Math.random() * 0.4 - 0.2, -1, Math.random() * 0.4 - 0.2], vitesse: () => [(Math.random() - 0.5) * 0.8, -2 - Math.random() * 2, (Math.random() - 0.5) * 0.8], vie: [0.4, 0.9], taille: 0.3, couleurs: [0xf97316, 0xfde047, 0xef4444] }); fx.apres(0.6, () => fx.bulle('🚀 Éjection d’urgence !', '#c2410c')); } },
    'carapace-d-un-dieu-ancien': { a: ['poussiere'], s: fx => { fx.son('gong'); fx.secousse(0.15, 1.2); fx.mouvement('tremble', 1.5); fx.onde(0xfde047, { taille: 4, duree: 1.4 }); fx.apres(1.2, () => { fx.mouvement('leve', 1.8); fx.flash(0xfde047, 7, 1.2); fx.bulle('🐢 Le dieu tortue vous bénit (lentement)', '#4d7c0f'); }); } },
    'cargo-de-transport': { a: ['etincelles', 0x60a5fa], s: fx => { fx.son('moteur'); fx.mouvement('vol', 2.6); fx.apres(1.4, () => { fx.jaillir(['📦', '📦', '🪙'], 10); fx.son('pieces'); fx.bulle('📦 Livraison express !', '#1d4ed8'); }); } },
    'carte-d-acces': { a: ['donnees', 0x22c55e], s: fx => { fx.son('bip8'); fx.mouvement('toupie', 1.2); fx.apres(0.9, () => { fx.son('sas'); fx.flash(0x22c55e, 7, 0.8); fx.onde(0x22c55e, { vertical: true, y: 0.2 }); fx.bulle('✅ ACCÈS AUTORISÉ — niveau Oméga', '#15803d'); }); } },
    'carte-planetaire-holographique': { a: ['orbite', 0xfde047], s: fx => { fx.son('magie'); fx.faisceau(0x38bdf8, 2.6, 1.3); fx.particules({ n: 120, duree: 2, origine: () => [0, 0.2, 0], vitesse: () => { const a = Math.random() * 6.3, v = 0.5 + Math.random() * 1.2; return [Math.cos(a) * v, (Math.random() - 0.5) * 0.2, Math.sin(a) * v]; }, tourbillon: 2, vie: [1.2, 2], taille: 0.1, couleurs: [0xfde047, 0x38bdf8, 0xffffff] }); fx.apres(1.2, () => fx.bulle('🪐 Vous êtes ici. Enfin… à peu près.', '#0369a1')); } },
    'casque-d-astronaute': { a: ['neige'], s: fx => { fx.son('souffle'); fx.mouvement('flotte', 2.8); fx.monter(['⭐', '🌍', '🌕'], 8, 1.6); fx.apres(1, () => fx.bulle('👨‍🚀 Houston, on a un acheteur !', '#1e3a8a')); } },
    'casque-de-combat': { a: ['lueur', 0xef4444], s: fx => { fx.son('alarme'); fx.strobo([0xef4444, 0x111827], 1.2); fx.mouvement('pulse', 1); fx.apres(1, () => { fx.son('laser'); fx.flash(0xef4444, 8, 0.6); fx.bulle('🪖 Mode combat activé', '#b91c1c'); }); } },
    'cellule-de-fusion': { a: ['lueur', 0x38bdf8], s: fx => { fx.son('warp'); fx.mouvement('pulse', 1.4); fx.lueur(0x38bdf8, 6, 18, 1.6); fx.apres(1.2, () => { fx.flash(0x38bdf8, 10, 0.8); fx.gerbe([0x38bdf8, 0xffffff], 100, 5); fx.onde(0x7dd3fc, { vertical: true, y: 0, taille: 4.5 }); fx.bulle('🔋 Chargée à 1000 % !', '#0369a1'); }); } },
    'champignon-luminescent': { a: ['etincelles', 0x4ade80], s: fx => { fx.son('magie'); fx.obscurite(3, 0.08); fx.lueur(0x4ade80, 4, 4, 3); fx.particules({ n: 120, duree: 2.2, origine: () => [Math.random() * 2 - 1, 0.6, Math.random() * 2 - 1], vitesse: () => [(Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4], vie: [1.5, 2.5], taille: 0.12, couleurs: [0x4ade80, 0xa3e635, 0x22d3ee] }); fx.apres(1, () => fx.bulle('🍄 Ne pas manger. Sérieusement.', '#15803d')); } },
    'chaussette-perdue-en-apesanteur': { a: ['poussiere'], s: fx => { fx.son('vent'); fx.mouvement('flotte', 3); fx.apres(0.8, () => { fx.jaillir(['🧦'], 5); fx.bulle('🧦 Retrouvée après 300 ans !', '#7c3aed'); }); } },
    'coffre-de-pirate-spatial': { a: ['poussiere'], s: fx => { fx.son('ressort'); fx.mouvement('tremble', 0.8); fx.apres(0.7, () => { fx.son('pieces'); fx.son('victoire', 0.3); fx.flash(0xfde047, 9, 1.2); fx.jaillir(['🪙', '💎', '🪙', '💰', '👑'], 26); fx.bulle('🏴‍☠️ Le trésor du capitaine Nébuleuse !', '#a16207'); }); } },
    'combinaison-spatiale': { a: ['neige'], s: fx => { fx.son('souffle'); fx.mouvement('valse', 2.6); fx.apres(0.8, () => { fx.monter(['🕺', '✨'], 8); fx.son('melodie'); fx.bulle('🕺 La danse de l’apesanteur', '#7c3aed'); }); } },
    'console-de-commandement': { a: ['donnees', 0x38bdf8], s: fx => { fx.son('robot'); fx.strobo([0x22d3ee, 0xf43f5e, 0x22c55e], 1.4); fx.apres(1, () => { fx.son('alarme'); fx.monter(['🔴', '🟢', '🔵', '⚠️'], 12, 1); fx.bulle('🖥️ Ne touchez PAS au gros bouton rouge', '#b91c1c'); }); } },
    'console-de-jeu-retro': { a: ['pixels'], s: fx => { fx.son('piece8'); fx.mouvement('saut', 1.4); fx.particules({ n: 60, origine: [0, 0.3, 0], vitesse: () => [(Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 2], gravite: 5, vie: [0.8, 1.4], taille: 0.2, couleurs: [0xf43f5e, 0x22c55e, 0x3b82f6, 0xfacc15], texture: 'carre' }); fx.apres(0.6, () => { fx.son('bip8'); fx.jaillir(['🍄', '⭐', '🪙'], 8); fx.bulle('🎮 1UP ! Nouvelle vie !', '#16a34a'); }); } },
    'conteneur-de-stockage': { a: ['poussiere'], s: fx => { fx.son('sas'); fx.mouvement('tremble', 1); fx.apres(0.9, () => { fx.son('pop'); fx.jaillir(['🥫', '🔩', '🧸', '🧦', '📼', '🪀'], 16); fx.bulle('📦 Il y avait quoi, là-dedans ?!', '#475569'); }); } },
    'couronne-du-dragon': { a: ['braises'], s: fx => { fx.son('grogne'); fx.secousse(0.12, 0.8); fx.particules({ n: 160, duree: 1.4, origine: () => [-2.2, 0.2, 0.3], vitesse: () => [4 + Math.random() * 2, (Math.random() - 0.4) * 1.2, (Math.random() - 0.5) * 0.6], frein: 0.6, vie: [0.6, 1.1], taille: 0.35, couleurs: [0xf97316, 0xfde047, 0xef4444] }); fx.apres(0.9, () => { fx.mouvement('leve', 1.6); fx.flash(0xfde047, 8, 1); fx.bulle('🐉 Longue vie au roi ! (le dragon veut la récupérer)', '#b45309'); }); } },
    'cristal-d-energie': { a: ['etincelles', 0x22d3ee], s: fx => { fx.son('cristal'); fx.mouvement('leve', 2.2); fx.lueur(0x22d3ee, 5, 12, 2); fx.apres(1, () => { fx.flash(0x67e8f9, 10, 0.8); fx.particules({ n: 140, origine: [0, 0.2, 0], vitesse: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 4, (Math.random() - 0.5) * 0.4, Math.sin(a) * 4]; }, frein: 1.5, vie: [0.6, 1.2], taille: 0.16, couleurs: [0x22d3ee, 0xffffff], texture: 'etoile' }); fx.bulle('💎 Pureté : 99,98 %', '#0e7490'); }); } },
    'drone-eclaireur': { a: ['orbite', 0xa3e635], s: fx => { fx.son('moteur'); fx.mouvement('vol', 2.4); fx.apres(1.2, () => { fx.son('sonar'); fx.faisceau(0xa3e635, 1.2, 0.5); fx.bulle('🛸 Zone scannée : 1 acheteur détecté', '#4d7c0f'); }); } },
    'echiquier-du-capitaine': { a: ['poussiere'], s: fx => { fx.son('cloche'); fx.mouvement('retourne', 1.6); fx.jaillir(['♟️', '♞', '♛', '♜', '♝'], 12); fx.apres(1.2, () => fx.bulle('♟️ Échec et mat… au porte-monnaie', '#334155')); } },
    'fossile-d-ammonite': { a: ['poussiere'], s: fx => { fx.son('gong'); fx.mouvement('toupie', 2); fx.particules({ n: 80, duree: 1.4, origine: () => [0, 0, 0], vitesse: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 0.6, Math.random() * 0.3, Math.sin(a) * 0.6]; }, tourbillon: 5, vie: [1, 1.6], taille: 0.12, couleurs: [0xd6d3d1, 0xfde68a] }); fx.apres(1.2, () => fx.bulle('🐚 400 millions d’années. Bon état.', '#78716c')); } },
    'fusee-vintage': { a: ['etincelles', 0xfde047], s: fx => { fx.son('fusee'); fx.secousse(0.08, 0.6); fx.mouvement('decollage', 3); fx.particules({ n: 160, duree: 1.8, origine: () => [Math.random() * 0.3 - 0.15, -1.1, Math.random() * 0.3 - 0.15], vitesse: () => [(Math.random() - 0.5) * 1.2, -1.5 - Math.random() * 2, (Math.random() - 0.5) * 1.2], vie: [0.4, 1], taille: 0.35, couleurs: [0xf97316, 0xfde047, 0x94a3b8] }); fx.apres(0.5, () => fx.bulle('🚀 3… 2… 1… DÉCOLLAGE !', '#c2410c')); } },
    'generateur-de-bouclier': { a: ['lueur', 0x60a5fa], s: fx => { fx.son('warp'); fx.mouvement('pulse', 1.2); [0, 0.3, 0.6].forEach(t => fx.apres(t, () => fx.onde(0x60a5fa, { vertical: true, y: 0, taille: 3.5 }))); fx.apres(0.9, () => { fx.particules({ n: 160, origine: () => { const u = Math.random() * 6.3, v = Math.acos(2 * Math.random() - 1); return [1.6 * Math.sin(v) * Math.cos(u), 1.6 * Math.cos(v), 1.6 * Math.sin(v) * Math.sin(u)]; }, vitesse: () => [0, 0, 0], vie: [0.8, 1.4], taille: 0.12, couleurs: [0x93c5fd, 0xffffff] }); fx.bulle('🛡️ Boucliers à 100 %', '#1d4ed8'); }); } },
    'globe-terrestre-ancien': { a: ['poussiere'], s: fx => { fx.son('vent'); fx.mouvement('toupie', 2.4); fx.apres(1.4, () => { fx.jaillir(['🌍', '🗺️', '⛵'], 6); fx.bulle('🌍 La Terre, autrefois. Jolie, non ?', '#1e40af'); }); } },
    'gramophone': { a: ['notes', 0xfde68a], s: fx => { fx.son('melodie'); fx.mouvement('bascule', 2.4); fx.monter(['🎵', '🎶', '🎼'], 14, 1.8); fx.apres(1, () => fx.bulle('🎶 Le tube de l’an 1925 !', '#92400e')); } },
    'grille-pain-spatial': { a: ['fumee'], s: fx => { fx.son('tictac'); fx.mouvement('tremble', 1.8); fx.apres(1.9, () => { fx.son('ding'); fx.mouvement('saut', 1); fx.emojis({ emojis: ['🍞'], n: 2, origine: [0, 0.8, 0], vitesse: () => [(Math.random() - 0.5) * 0.6, 5, 0], gravite: 6, vie: [1.4, 1.6] }); fx.bulle('🍞 DING ! Petit-déjeuner servi', '#b45309'); }); } },
    'guitare-electrique-terrienne': { a: ['notes', 0xf43f5e], s: fx => { fx.son('accord'); fx.strobo([0xf43f5e, 0xa855f7, 0xfde047], 1.6); fx.secousse(0.1, 1.2); fx.mouvement('tonneau', 1.4); fx.monter(['🤘', '🎸', '⚡', '🔥'], 12, 1.4); fx.apres(0.6, () => fx.bulle('🤘 SOLO DE L’ESPACE !', '#be123c')); } },
    'lingots-d-or': { a: ['etincelles', 0xfde047], s: fx => { fx.son('pieces'); fx.son('victoire', 0.4); fx.flash(0xfde047, 9, 1.4); fx.pluie(['🪙', '💰', '🪙'], 26, 1.6); fx.mouvement('pulse', 1.2); fx.apres(0.7, () => fx.bulle('💰 Placement sûr !', '#a16207')); } },
    'lunette-de-laiton': { a: ['poussiere'], s: fx => { fx.son('cloche'); fx.mouvement('bascule', 1.8); fx.apres(0.6, () => { fx.faisceau(0xfde68a, 1.6, 0.18); fx.monter(['⭐', '🌟', '☄️'], 10, 1.2); fx.bulle('🔭 Terre en vue ! Ah non, c’est une comète', '#a16207'); }); } },
    'masque-extraterrestre-ancien': { a: ['gaz', 0x86efac], s: fx => { fx.son('choeur'); fx.obscurite(3, 0.08); fx.lueur(0x22c55e, 5, 6, 2.6); fx.mouvement('leve', 2.6); fx.apres(1.2, () => { fx.son('grogne'); fx.bulle('👁️ … il vous regarde', '#166534'); }); } },
    'meca-de-combat': { a: ['etincelles', 0xfb923c], s: fx => { fx.son('robot'); fx.mouvement('saut', 1.6); fx.apres(0.5, () => { fx.son('boom'); fx.secousse(0.2, 0.6); fx.onde(0xfb923c, { taille: 4.5 }); fx.particules({ n: 80, origine: [0, -1.2, 0], vitesse: () => [(Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3], gravite: 3, vie: [0.6, 1.2], taille: 0.3, couleurs: [0x78716c, 0xa8a29e] }); fx.bulle('🤖 MÉCA PRÊT AU COMBAT', '#c2410c'); }); } },
    'meteorite': { a: ['braises'], s: fx => { fx.son('vent'); fx.mouvement('chute', 1.8); fx.particules({ n: 120, duree: 0.8, origine: () => [Math.random() * 0.6 - 0.3, 3 + Math.random(), 0], vitesse: () => [0, 2, 0], vie: [0.3, 0.6], taille: 0.4, couleurs: [0xf97316, 0xfde047] }); fx.apres(0.85, () => { fx.son('boom'); fx.secousse(0.25, 0.8); fx.flash(0xf97316, 10, 0.7); fx.onde(0xf97316, { taille: 5 }); fx.gerbe([0x78716c, 0xf97316], 90, 5); fx.bulle('☄️ IMPACT CONFIRMÉ !', '#c2410c'); }); } },
    'module-de-navigation': { a: ['donnees', 0x38bdf8], s: fx => { fx.son('sonar'); fx.mouvement('toupie', 1.8); fx.onde(0x38bdf8, { y: 0, taille: 4 }); fx.apres(1, () => { fx.son('robot'); fx.monter(['🧭', '📍', '🗺️'], 8); fx.bulle('📍 Recalcul de l’itinéraire…', '#0369a1'); }); } },
    'module-lunaire': { a: ['poussiere'], s: fx => { fx.son('fusee'); fx.mouvement('chute', 2.4); fx.apres(1.1, () => { fx.onde(0xe2e8f0, { taille: 4, duree: 1.4 }); fx.particules({ n: 120, origine: [0, -1.2, 0], vitesse: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 2.5, Math.random() * 0.6, Math.sin(a) * 2.5]; }, frein: 1.5, vie: [0.8, 1.6], taille: 0.4, couleurs: [0x94a3b8, 0xcbd5e1] }); fx.bulle('🌕 L’Aigle s’est posé', '#334155'); }); } },
    'montre-du-capitaine': { a: ['poussiere'], s: fx => { fx.son('tictac'); fx.mouvement('bascule', 2); fx.particules({ n: 90, duree: 1.8, origine: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 1.5, Math.random() * 0.4 - 0.2, Math.sin(a) * 1.5]; }, vitesse: () => [0, 0, 0], tourbillon: -3, vie: [1, 1.5], taille: 0.1, couleurs: [0xfde68a, 0xffffff], texture: 'etoile' }); fx.apres(2, () => { fx.son('cloche'); fx.bulle('⏱️ Vous êtes pile à l’heure', '#a16207'); }); } },
    'moto-antigravite': { a: ['braises'], s: fx => { fx.son('moteur'); fx.mouvement('tonneau', 1.4); fx.apres(1.3, () => { fx.mouvement('vol', 1.6); fx.particules({ n: 100, duree: 1.4, origine: () => [0, -0.2, 0], vitesse: () => [(Math.random() - 0.5) * 0.4, -0.3, -1.5], vie: [0.4, 0.8], taille: 0.25, couleurs: [0x38bdf8, 0xa855f7] }); fx.bulle('🏍️ VROOOUUUM (sans roues)', '#6d28d9'); }); } },
    'nacelle-spatiale-personnelle': { a: ['orbite', 0xfde68a], s: fx => { fx.son('warp'); fx.mouvement('tonneau', 1.6); fx.apres(1.2, () => { fx.mouvement('vol', 1.6); fx.monter(['✨', '⭐'], 10); fx.bulle('🛰️ Votre taxi de l’espace est arrivé', '#a16207'); }); } },
    'noyau-d-energie': { a: ['lueur', 0x60a5fa], s: fx => { fx.son('aspire'); fx.mouvement('pulse', 1.2); fx.particules({ n: 100, duree: 1, origine: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 2, Math.random() - 0.5, Math.sin(a) * 2]; }, vitesse: () => [0, 0, 0], tourbillon: 5, vie: [0.6, 1], taille: 0.12, couleurs: [0x93c5fd] }); fx.apres(1.1, () => { fx.son('boom'); fx.flash(0x60a5fa, 12, 0.9); fx.onde(0x93c5fd, { vertical: true, y: 0, taille: 5 }); fx.gerbe([0x60a5fa, 0xffffff], 120, 6); fx.bulle('⚛️ Surcharge contrôlée… presque', '#1d4ed8'); }); } },
    'obelisque-noir': { a: ['gaz', 0x334155], s: fx => { fx.son('choeur'); fx.obscurite(3.2, 0.03); fx.faisceau(0xe0e7ff, 3, 0.15); fx.mouvement('leve', 3); fx.apres(1.6, () => { fx.bulle('⬛ …', '#0f172a'); fx.son('gong'); }); } },
    'oeuf-extraterrestre': { a: ['gaz', 0x84cc16], s: fx => { fx.son('crac'); fx.mouvement('tremble', 1.8); fx.apres(0.9, () => { fx.son('grogne'); fx.mouvement('saut', 1); fx.jaillir(['🥚', '👾', '💚'], 10); fx.particules({ n: 80, origine: [0, 0.8, 0], vitesse: () => [(Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3], gravite: 4, vie: [0.6, 1.2], taille: 0.2, couleurs: [0x84cc16, 0xd9f99d] }); fx.bulle('🥚 … ça a bougé.', '#3f6212'); }); } },
    'orbes-des-anciens': { a: ['orbite', 0x22d3ee], s: fx => { fx.son('magie'); fx.mouvement('toupie', 2.2); fx.obscurite(2.4, 0.15); fx.particules({ n: 120, duree: 2, origine: () => { const a = Math.random() * 6.3; return [Math.cos(a) * 1.2, (Math.random() - 0.5) * 1.2, Math.sin(a) * 1.2]; }, vitesse: () => [0, 0.2, 0], tourbillon: 4, vie: [1, 1.5], taille: 0.14, couleurs: [0x22d3ee, 0xa855f7] }); fx.apres(1.2, () => fx.bulle('🔮 Les orbes s’alignent…', '#6d28d9')); } },
    'outil-de-decoupe-laser': { a: ['etincelles', 0xef4444], s: fx => { fx.son('laser'); fx.son('laser', 0.35); fx.mouvement('bascule', 1.4); fx.particules({ n: 140, duree: 1.4, origine: [0.8, 0, 0.5], vitesse: () => [1 + Math.random() * 2, Math.random() * 2, (Math.random() - 0.5) * 2], gravite: 5, vie: [0.3, 0.8], taille: 0.1, couleurs: [0xfde047, 0xef4444, 0xffffff] }); fx.apres(0.8, () => fx.bulle('🔥 Découpe parfaite. Gardez vos doigts', '#b91c1c')); } },
    'paire-de-reacteurs-dorsaux': { a: ['braises'], s: fx => { fx.son('fusee'); fx.mouvement('decollage', 2.6); fx.particules({ n: 140, duree: 1.6, origine: () => [Math.random() > 0.5 ? 0.5 : -0.5, -0.6, 0], vitesse: () => [(Math.random() - 0.5) * 0.6, -2 - Math.random() * 2, (Math.random() - 0.5) * 0.6], vie: [0.3, 0.8], taille: 0.3, couleurs: [0x38bdf8, 0xffffff, 0xf97316] }); fx.apres(0.7, () => fx.bulle('🎒 Accrochez-vous !', '#c2410c')); } },
    'panneau-solaire-deployable': { a: ['poussiere'], s: fx => { fx.son('magie'); fx.flash(0xfde047, 6, 2); fx.particules({ n: 60, duree: 1.5, origine: () => [Math.random() * 4 - 2, 2.5, 0], vitesse: () => [0, -2.5, 0], vie: [1, 1.2], taille: 0.1, couleurs: [0xfde047] }); fx.mouvement('pulse', 1.6); fx.apres(1, () => fx.bulle('☀️ +100 % d’énergie gratuite', '#a16207')); } },
    'pistolet-a-rayons': { a: ['lueur', 0xa3e635], s: fx => { fx.son('laser'); fx.mouvement('tonneau', 1); [0.2, 0.5, 0.8].forEach(t => fx.apres(t, () => { fx.son('laser'); fx.particules({ n: 30, origine: [1, 0.1, 0], vitesse: () => [6 + Math.random() * 3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3], vie: [0.3, 0.5], taille: 0.18, couleurs: [0xa3e635, 0xffffff] }); })); fx.apres(1, () => fx.bulle('🔫 PIOU PIOU PIOU !', '#4d7c0f')); } },
    'plante-carnivore': { a: ['gaz', 0x65a30d], s: fx => { fx.son('grogne'); fx.mouvement('ecrase', 1.4); fx.apres(0.5, () => { fx.son('croque'); fx.jaillir(['🪰', '🦟', '🍃'], 8); fx.bulle('🌱 Elle a encore faim', '#3f6212'); }); } },
    'plante-extraterrestre': { a: ['etincelles', 0xc084fc], s: fx => { fx.son('grogne'); fx.mouvement('valse', 2.4); fx.particules({ n: 100, duree: 1.6, origine: [0, 0.8, 0], vitesse: () => [(Math.random() - 0.5) * 1.5, 1 + Math.random(), (Math.random() - 0.5) * 1.5], gravite: 0.6, vie: [1, 1.8], taille: 0.15, couleurs: [0xc084fc, 0x7dd3fc, 0xfde68a] }); fx.apres(1, () => fx.bulle('🌺 Elle chante ? Elle chante.', '#7e22ce')); } },
    'plateforme-de-teleportation': { a: ['lueur', 0x22c55e], s: fx => { fx.son('teleport'); fx.faisceau(0x22c55e, 2.2, 1.1); fx.mouvement('teleporte', 2); fx.apres(1, () => { fx.flash(0x86efac, 9, 0.6); fx.jaillir(['👽', '🐄', '🧍'], 3); fx.bulle('🌀 Quelqu’un est arrivé ! (une vache)', '#15803d'); }); } },
    'prototype-furtif': { a: ['gaz', 0x334155], s: fx => { fx.son('warp'); fx.mouvement('teleporte', 2.2); fx.obscurite(2, 0.2); fx.apres(1.1, () => { fx.bulle('🥷 Où est-il passé ?', '#1e293b'); }); fx.apres(1.8, () => { fx.mouvement('tonneau', 1); fx.son('moteur'); }); } },
    'puce-prototype': { a: ['donnees', 0x22c55e], s: fx => { fx.son('bip8'); fx.particules({ n: 80, duree: 1.4, origine: () => [Math.random() * 2 - 1, 0, Math.random() * 2 - 1], vitesse: () => [0, 1.5, 0], vie: [0.6, 1.2], taille: 0.25, couleurs: [0x22c55e], texture: Math.random() < 0.5 ? '0' : '1', normal: true }); fx.mouvement('pulse', 1.2); fx.apres(0.9, () => fx.bulle('💾 Contient : 1 To de mèmes', '#15803d')); } },
    'rations-de-survie': { a: ['fumee'], s: fx => { fx.son('croque'); fx.mouvement('ecrase', 1.2); fx.jaillir(['🥫', '🍫', '🧃', '🥜'], 12); fx.apres(0.8, () => fx.bulle('🥫 Goût « poulet-ish »', '#4d7c0f')); } },
    'replicateur-a-cafe': { a: ['fumee'], s: fx => { fx.son('souffle'); fx.mouvement('tremble', 1.4); fx.particules({ n: 80, duree: 2, origine: () => [Math.random() * 0.4 - 0.2, 1, Math.random() * 0.4 - 0.2], vitesse: () => [(Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3], vie: [1.2, 2], taille: 0.45, couleurs: [0xe2e8f0, 0x94a3b8] }); fx.apres(1.5, () => { fx.son('ding'); fx.jaillir(['☕'], 3); fx.bulle('☕ Thé. Earl Grey. Chaud.', '#78350f'); }); } },
    'robot-de-collection-des-annees-60': { a: ['etincelles', 0xfb923c], s: fx => { fx.son('robot'); fx.mouvement('valse', 2.4); fx.apres(0.5, () => { fx.son('robot'); fx.bulle('🤖 BIP BOUP. J’AIME. LES HUMAINS.', '#c2410c'); fx.monter(['⚙️', '🔩', '💡'], 8); }); } },
    'robot-de-compagnie': { a: ['etincelles', 0x2dd4bf], s: fx => { fx.son('robot'); fx.mouvement('saut', 1.6); fx.jaillir(['💖', '💙', '✨'], 12); fx.apres(0.6, () => fx.bulle('🥹 Il vous a choisi !', '#0f766e')); } },
    'rover-martien': { a: ['poussiere'], s: fx => { fx.son('moteur'); fx.mouvement('bascule', 2); fx.particules({ n: 100, duree: 1.6, origine: () => [Math.random() * 2 - 1, -1.1, Math.random() - 0.5], vitesse: () => [(Math.random() - 0.5), 0.5 + Math.random(), -0.5], vie: [0.8, 1.4], taille: 0.35, couleurs: [0xc2410c, 0xfb923c] }); fx.apres(1.1, () => fx.bulle('🔴 Échantillon martien n°1 : de la poussière', '#c2410c')); } },
    'sablier-temporel': { a: ['poussiere'], s: fx => { fx.son('tictac'); fx.mouvement('retourne', 1.8); fx.particules({ n: 100, duree: 1.8, origine: () => [0, 0.3, 0], vitesse: () => [0, -0.6, 0], vie: [0.6, 1], taille: 0.07, couleurs: [0xfde68a] }); fx.apres(1.6, () => { fx.son('warp'); fx.flash(0xfde68a, 6, 0.8); fx.bulle('⏳ Le temps a reculé de 5 secondes', '#a16207'); }); } },
    'satellite-d-observation': { a: ['orbite', 0x93c5fd], s: fx => { fx.son('sonar'); fx.mouvement('tonneau', 2); fx.onde(0x93c5fd, { vertical: true, y: 0, taille: 4 }); fx.apres(1, () => { fx.faisceau(0x93c5fd, 1.4, 0.4); fx.bulle('🛰️ Souriez, vous êtes filmé', '#1e40af'); }); } },
    'service-a-the-futuriste': { a: ['fumee'], s: fx => { fx.son('cloche'); fx.mouvement('bascule', 1.6); fx.apres(0.5, () => { fx.jaillir(['🫖', '🍪', '🍰'], 8); fx.bulle('🫖 L’heure du thé intergalactique', '#0e7490'); }); } },
    'specimen-en-bocal': { a: ['bulles'], s: fx => { fx.son('bulles'); fx.mouvement('tremble', 1.6); fx.lueur(0x84cc16, 4, 8, 2); fx.apres(1.1, () => { fx.son('grogne'); fx.flash(0x84cc16, 6, 0.4); fx.bulle('🧪 Il a cligné de l’œil ?!', '#3f6212'); }); } },
    'sphere-espion': { a: ['orbite', 0xf472b6], s: fx => { fx.son('sonar'); fx.mouvement('vol', 2.2); fx.apres(1, () => { fx.flash(0xffffff, 10, 0.3); fx.son('pop'); fx.bulle('📸 Clic ! Photo envoyée au QG', '#be185d'); }); } },
    'station-spatiale-miniature': { a: ['orbite', 0xfde68a], s: fx => { fx.son('warp'); fx.mouvement('toupie', 2.6); fx.monter(['🚀', '🛸', '🛰️'], 8, 1.6); fx.apres(1.4, () => fx.bulle('🏠 Bienvenue chez vous, commandant', '#1e3a8a')); } },
    'statue-du-serpent': { a: ['gaz', 0x4d7c0f], s: fx => { fx.son('souffle'); fx.obscurite(2.6, 0.15); fx.lueur(0x84cc16, 4, 5, 2.4); fx.mouvement('valse', 2.4); fx.apres(1, () => { fx.jaillir(['🐍', '🐍', '💎'], 6); fx.bulle('🐍 Sssssuperbe acquisition…', '#3f6212'); }); } },
    'tablette-gravee': { a: ['poussiere'], s: fx => { fx.son('gong'); fx.mouvement('leve', 2.2); fx.faisceau(0xfde68a, 2.2, 0.6); fx.apres(1, () => { fx.monter(['📜', '✨', '𓂀'], 8); fx.bulle('📜 Traduction : « Ne pas vendre aux enchères »', '#92400e'); }); } },
    'trousse-medicale': { a: ['etincelles', 0xef4444], s: fx => { fx.son('magie'); fx.mouvement('pulse', 1.4); fx.monter(['❤️', '➕', '💊', '🩹'], 14, 1.4); fx.flash(0xef4444, 5, 1); fx.apres(0.8, () => fx.bulle('➕ +50 points de vie', '#b91c1c')); } },
    'vaisseau-crabe': { a: ['etincelles', 0xfb923c], s: fx => { fx.son('moteur'); fx.mouvement('valse', 2.6); fx.apres(0.8, () => { fx.jaillir(['🦀', '🦀'], 4); fx.bulle('🦀 Il ne marche que de côté', '#c2410c'); }); } },
    'vaisseau-minier': { a: ['braises'], s: fx => { fx.son('moteur'); fx.mouvement('tremble', 1.6); fx.particules({ n: 140, duree: 1.6, origine: [0, 0, 1], vitesse: () => [(Math.random() - 0.5) * 3, Math.random() * 3, 1 + Math.random() * 2], gravite: 5, vie: [0.6, 1.2], taille: 0.22, couleurs: [0x78716c, 0xfde047, 0xa8a29e] }); fx.apres(1.1, () => { fx.jaillir(['💎', '🪨', '💎', '⛏️'], 10); fx.son('pieces'); fx.bulle('⛏️ Filon de cristaux trouvé !', '#a16207'); }); } }
};

// Surprise par défaut (lot sans recette)
function enchSurpriseParDefaut(fx) { fx.son('magie'); fx.mouvement('saut', 1.4); fx.gerbe([0xfde047, 0x38bdf8, 0xffffff], 80, 4); fx.bulle('✨ Adjugé !'); }
// Lot invendu : il coule tristement
function enchInvendu(fx) { fx.son('coule'); fx.mouvement('coule', 2.4); fx.particules({ n: 40, origine: [0, -1.1, 0], vitesse: () => [(Math.random() - 0.5) * 1.5, Math.random() * 0.4, (Math.random() - 0.5) * 1.5], frein: 1, vie: [0.8, 1.4], taille: 0.3, couleurs: [0x64748b, 0x94a3b8] }); fx.apres(0.6, () => fx.bulle('😢 Personne n’en veut…', '#475569')); }
// Bonus rare : édition collector dorée
function enchCollector(fx) { fx.apres(2.8, () => { fx.son('fanfare'); fx.flash(0xfde047, 10, 1.4); fx.pluie(['✨', '⭐', '🌟'], 20, 1.2); fx.bulle('🌟 ÉDITION COLLECTOR !', '#a16207', 2.6); }); }

window.enchEffets = { surprises: ENCH_SURPRISES, defaut: enchSurpriseParDefaut, invendu: enchInvendu, collector: enchCollector };
