// =====================================================================
//  CHARGE INSTABLE — la charge en 3D (Three.js r128) et ses 20 modules cliquables
//  DS3D.creer(conteneur, charge, opts) -> { chrono(sec, err, max), exploser(), desamorcer(), detruire() }
//  opts : son(nom), onErreur(i), onResolu(i), onAlerte(i)
// =====================================================================
(function () {
const W = window;
const T = () => W.THREE;

// emplacements : 0 = minuteur (face avant, en haut au milieu), puis le reste de la face avant, puis la face arrière
const EMPL = [[0, 0, 1], [0, 0, 0], [0, 0, 2], [0, 1, 0], [0, 1, 1], [0, 1, 2], [1, 0, 0], [1, 0, 1], [1, 0, 2], [1, 1, 0], [1, 1, 1], [1, 1, 2]];
const PAS = 1.1, LARG = 3.62, HAUT = 2.5, PROF = 1.0;
const COUL_HEX = c => parseInt(String(W.DS.COUL[c] || c).replace('#', ''), 16);

function texte(ctx, t, x, y, taille, coul, align, police) {
    const larg = ctx.canvas.width * .92;      // le texte se réduit pour tenir dans la largeur
    let z = taille; ctx.font = `${police || '800'} ${z}px "Segoe UI", Roboto, Arial, sans-serif`;
    const m = ctx.measureText(t).width; if (m > larg) { z = Math.floor(z * larg / m); ctx.font = `${police || '800'} ${z}px "Segoe UI", Roboto, Arial, sans-serif`; }
    ctx.fillStyle = coul; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
}
function mono(ctx, t, x, y, taille, coul, align) {
    let z = taille; ctx.font = `700 ${z}px "Courier New", ui-monospace, monospace`;
    const m = ctx.measureText(t).width, larg = ctx.canvas.width * .94; if (m > larg) z = Math.floor(z * larg / m);
    ctx.font = `700 ${z}px "Courier New", ui-monospace, monospace`; ctx.fillStyle = coul; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
}

W.DS3D = { creer: creer };

function creer(el, charge, opts) {
    const THREE = T(), DS = W.DS, E = charge.E;
    const son = n => { try { opts.son && opts.son(n); } catch (e) {} };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, W.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d); scene.fog = new THREE.Fog(0x05070d, 12, 26);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    const camBase = new THREE.Vector3(0, 1.1, 8.2), cam = { pos: camBase.clone(), cible: new THREE.Vector3(0, 0, 0), pos2: camBase.clone(), cible2: new THREE.Vector3() };
    camera.position.copy(camBase);

    // ---- éclairage ----
    scene.add(new THREE.HemisphereLight(0x8fa6ff, 0x0b0b14, 0.55));
    const cle = new THREE.DirectionalLight(0xffffff, 1.15); cle.position.set(3.5, 6, 6); cle.castShadow = true; cle.shadow.mapSize.set(1024, 1024);
    Object.assign(cle.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(cle);
    const contre = new THREE.DirectionalLight(0x22d3ee, 0.6); contre.position.set(-5, 3, -6); scene.add(contre);
    const alarme = new THREE.PointLight(0xff2222, 0, 12); alarme.position.set(0, 3, 3); scene.add(alarme);
    const lueur = new THREE.PointLight(0x38bdf8, 0.5, 9); lueur.position.set(0, -1, 4); scene.add(lueur);

    // ---- table ----
    const tc = document.createElement('canvas'); tc.width = tc.height = 512; const tx = tc.getContext('2d');
    tx.fillStyle = '#0b1020'; tx.fillRect(0, 0, 512, 512); tx.strokeStyle = 'rgba(56,189,248,.18)'; tx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { tx.beginPath(); tx.moveTo(i, 0); tx.lineTo(i, 512); tx.moveTo(0, i); tx.lineTo(512, i); tx.stroke(); }
    const ttex = new THREE.CanvasTexture(tc); ttex.wrapS = ttex.wrapT = THREE.RepeatWrapping; ttex.repeat.set(6, 6); ttex.encoding = THREE.sRGBEncoding;
    const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: ttex, metalness: .4, roughness: .7 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -1.6; table.receiveShadow = true; scene.add(table);

    // ---- la charge ----
    const pivot = new THREE.Group(); scene.add(pivot);
    const corps = new THREE.Group(); pivot.add(corps);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a414e, metalness: .7, roughness: .58 });
    const coque = new THREE.Mesh(new THREE.BoxGeometry(LARG, HAUT, PROF), metal); coque.castShadow = true; corps.add(coque);
    [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {      // coins renforcés
        const c = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .22), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: .6, roughness: .5 }));
        c.position.set(sx * (LARG / 2 - .06), sy * (HAUT / 2 - .06), sz * (PROF / 2 - .06)); corps.add(c);
    })));
    const bandes = new THREE.MeshStandardMaterial({ color: 0x111318, metalness: .3, roughness: .8 });
    [-1, 1].forEach(sz => { const f = new THREE.Mesh(new THREE.BoxGeometry(LARG - .1, HAUT - .1, .02), bandes); f.position.z = sz * (PROF / 2 + .005); corps.add(f); });

    // ---- côtés : matricule, emblème, cellules, balises, ports ----
    function plaqueTexte(w, h, pw, ph, dessin, mat) {
        const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d'); dessin(x, pw, ph);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
        return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat ? new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: .1 }) : new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    }
    const droite = plaqueTexte(.9, .5, 360, 200, (x, w, h) => {
        x.fillStyle = '#f8fafc'; x.fillRect(0, 0, w, h); x.fillStyle = '#e11d48'; x.fillRect(0, 0, w, 44);
        texte(x, 'MATRICULE', w / 2, 23, 26, '#fff'); mono(x, E.mat, w / 2, 120, 76, '#0f172a');
        x.strokeStyle = '#0f172a'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
    }, true);
    droite.position.set(LARG / 2 + .003, .3, 0); droite.rotation.y = Math.PI / 2; corps.add(droite);
    const gauche = plaqueTexte(.62, .62, 256, 256, (x, w, h) => {
        x.fillStyle = '#0f172a'; x.beginPath(); x.arc(w / 2, h / 2, 124, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#facc15'; x.lineWidth = 8; x.stroke();
        const coul = { Mars: '#ef4444', Europe: '#93c5fd', Titan: '#f59e0b', Io: '#fde047', 'Cérès': '#a8a29e' }[E.emb];
        x.fillStyle = coul; x.beginPath(); x.arc(w / 2, 104, 46, 0, Math.PI * 2); x.fill();
        if (E.emb === 'Titan') { x.strokeStyle = '#fde68a'; x.lineWidth = 6; x.beginPath(); x.ellipse(w / 2, 104, 76, 18, -.3, 0, Math.PI * 2); x.stroke(); }
        texte(x, 'MISSION', w / 2, 172, 22, '#facc15'); texte(x, E.emb.toUpperCase(), w / 2, 204, 34, '#fff');
    }, true);
    gauche.position.set(-LARG / 2 - .003, .1, 0); gauche.rotation.y = -Math.PI / 2; corps.add(gauche);
    // cellules d'énergie (dessus) : cylindres couchés dans un support
    for (let k = 0; k < E.cellules; k++) {
        const x0 = -1.3 + k * .5;
        const sup = new THREE.Mesh(new THREE.BoxGeometry(.42, .08, .3), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: .5, roughness: .5 }));
        sup.position.set(x0, HAUT / 2 + .04, .12); corps.add(sup);
        const cel = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .38, 20), new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: .3, roughness: .35, emissive: 0x0a3d1f }));
        cel.rotation.z = Math.PI / 2; cel.position.set(x0, HAUT / 2 + .14, .12); corps.add(cel);
        const bout = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .44, 12), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: .9, roughness: .2 }));
        bout.rotation.z = Math.PI / 2; bout.position.copy(cel.position); corps.add(bout);
    }
    // balises (dessous et dessus) : plaque avec voyant et trois lettres
    E.balises.forEach((b, k) => {
        const dessus = k % 2 === 1;
        const p = plaqueTexte(.62, .24, 248, 96, (x, w, h) => {
            x.fillStyle = '#111827'; x.fillRect(0, 0, w, h); x.strokeStyle = '#475569'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
            mono(x, b.n, 150, h / 2, 54, '#e2e8f0');
        }, true);
        const led = new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 12), new THREE.MeshStandardMaterial({ color: b.on ? 0xfff1a8 : 0x2b2b2b, emissive: b.on ? 0xffd84d : 0x000000, emissiveIntensity: b.on ? 1.6 : 0 }));
        const x0 = (dessus ? .9 : -1.2) + (dessus ? 0 : k * .75);
        if (dessus) { p.rotation.x = -Math.PI / 2; p.position.set(x0, HAUT / 2 + .003, -.25); led.position.set(x0 - .2, HAUT / 2 + .03, -.25); }
        else { p.rotation.x = Math.PI / 2; p.position.set(x0, -HAUT / 2 - .003, .1); led.position.set(x0 - .2, -HAUT / 2 - .03, .1); }
        corps.add(p); corps.add(led);
    });
    // ports (dessous)
    E.ports.forEach((n, k) => {
        const p = plaqueTexte(.62, .3, 248, 120, (x, w, h) => {
            x.fillStyle = '#1e293b'; x.fillRect(0, 0, w, h);
            const forme = { Plasma: '#a855f7', Quantique: '#22d3ee', Fibre: '#f97316', Gravitonique: '#84cc16' }[n];
            x.fillStyle = '#020617'; x.fillRect(20, 18, w - 40, 50); x.strokeStyle = forme; x.lineWidth = 6; x.strokeRect(20, 18, w - 40, 50);
            for (let i = 0; i < 6; i++) { x.fillStyle = forme; x.fillRect(36 + i * 32, 34, 14, 18); }
            texte(x, n.toUpperCase(), w / 2, 94, 26, '#e2e8f0');
        }, true);
        p.rotation.x = Math.PI / 2; p.position.set(-1.2 + (E.balises.filter((b, i) => i % 2 === 0).length + k) * .75, -HAUT / 2 - .003, -.2);
        if (p.position.x > 1.4) { p.position.x -= 2.6; p.position.z = .3; }
        corps.add(p);
    });

    // ================= Modules =================
    const cliquables = [], anims = [], mods = [];
    function mat(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: typeof c === 'number' ? c : COUL_HEX(c), metalness: .35, roughness: .5 }, o || {})); }
    function fabrique(i, m) {
        const def = DS.MODULES.find(d => d.id === m.id);
        const [face, row, col] = EMPL[m.slot];
        const g = new THREE.Group();
        g.position.set((col - 1) * PAS * (face ? -1 : 1), (row ? -.55 : .55), face ? -PROF / 2 - .012 : PROF / 2 + .012);
        if (face) g.rotation.y = Math.PI;
        corps.add(g);
        const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, .05), mat(0x232833, { metalness: .6, roughness: .45 }));
        plaque.position.z = .005; plaque.castShadow = true; plaque.receiveShadow = true; g.add(plaque);
        const cadre = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.04, .03), mat(0x0b0d12)); cadre.position.z = -.008; g.add(cadre);
        const Mo = { i: i, id: m.id, def: def, st: m.st, R: m.R, g: g, resolu: false, face: face, x: g.position.x, y: g.position.y, plaque: plaque, maj: () => {} };
        plaque.userData.mod = Mo;
        // ---- outils pour construire le module ----
        Mo.ajouter = (mesh, x, y, z) => { mesh.position.set(x || 0, y || 0, (z || 0) + .03); mesh.castShadow = true; g.add(mesh); mesh.userData.mod = Mo; return mesh; };
        Mo.boite = (w, h, d, x, y, z, c, o) => Mo.ajouter(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)), x, y, (z || 0) + d / 2);
        Mo.ecran = (w, h, x, y, pw, ph, dessin, anime) => {
            const c = document.createElement('canvas'); c.width = pw; c.height = ph; const ctx = c.getContext('2d');
            const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
            const cadre = Mo.boite(w + .04, h + .04, .02, x, y, 0, 0x05070a);
            const ecr = Mo.ajouter(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })), x, y, .022);
            const o = { mesh: ecr, maj: () => { dessin(ctx, pw, ph, Date.now()); t.needsUpdate = true; } };
            o.maj(); if (anime) anims.push(() => o.maj());
            return o;
        };
        Mo.etiquette = (txt, w, h, x, y, o) => Mo.ecran(w, h, x, y, Math.round(w * 400), Math.round(h * 400), (ctx, pw, ph) => {
            ctx.fillStyle = (o && o.fond) || '#0f141c'; ctx.fillRect(0, 0, pw, ph); texte(ctx, txt, pw / 2, ph / 2, (o && o.taille) || ph * .55, (o && o.coul) || '#cbd5e1');
        });
        Mo.bouton = (o, action) => {
            const d = o.d || .06;
            const base = o.rond ? new THREE.Mesh(new THREE.CylinderGeometry(o.w / 2, o.w / 2 * 1.05, d, 28), mat(o.c || 0x64748b, { metalness: .3, roughness: .4 }))
                : new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, d), mat(o.c || 0x64748b, { metalness: .3, roughness: .4 }));
            if (o.rond) base.rotation.x = Math.PI / 2;
            const b = new THREE.Group(); b.add(base); base.position.z = d / 2;
            if (o.texte || o.dessin) {
                const pw = 256, ph = Math.round(256 * (o.h || o.w) / o.w), c = document.createElement('canvas'); c.width = pw; c.height = ph; const ctx = c.getContext('2d');
                const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
                const dess = () => { ctx.clearRect(0, 0, pw, ph); if (o.dessin) o.dessin(ctx, pw, ph); else texte(ctx, o.texte, pw / 2, ph / 2, o.taille || ph * .42, o.tc || '#fff'); t.needsUpdate = true; };
                dess(); b.userData.redessiner = dess;
                const pl = new THREE.Mesh(o.rond ? new THREE.CircleGeometry(o.w / 2 * .92, 28) : new THREE.PlaneGeometry(o.w * .94, o.h * .94), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
                pl.position.z = d + .002; b.add(pl);
            }
            b.position.set(o.x, o.y, .03); g.add(b); base.castShadow = true;
            b.userData.mod = Mo; base.userData.mod = Mo;
            const clic = () => { b.userData.appui = performance.now(); son(o.son || 'clic'); if (typeof action === 'function') action(); else Mo.act(action); };
            base.userData.clic = clic; cliquables.push(base);
            if (b.children[1]) { b.children[1].userData.clic = clic; b.children[1].userData.mod = Mo; cliquables.push(b.children[1]); }
            anims.push(() => { const t = b.userData.appui ? (performance.now() - b.userData.appui) / 160 : 1; b.position.z = .03 - (t < 1 ? Math.sin(t * Math.PI) * .025 : 0); });
            b.base = base; return b;
        };
        Mo.anime = fn => anims.push(fn);
        Mo.son = son;
        Mo.clic = (mesh, fn) => { mesh.userData.clic = fn; mesh.userData.mod = Mo; cliquables.push(mesh); };
        Mo.act = a => {
            if (Mo.resolu || charge.fini) return;
            let r; try { r = def.act(Mo.st, E, a, Date.now()); } catch (e) { console.error(e); }
            Mo.maj();
            if (r === 'ok') { if (def.besoin) { Mo.st.actif = 0; Mo.programmer(); son('ok'); Mo.maj(); } else Mo.reussir(); }
            else if (r === 'err') Mo.erreur();
        };
        // voyant d'état
        if (!def.besoin) {
            Mo.voyant = Mo.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.04, 16, 12), mat(0x334155, { emissive: 0x000000 })), .42, .42, .02);
            Mo.voyant.material = Mo.voyant.material.clone();
        }
        Mo.reussir = () => { Mo.resolu = true; Mo.voyant.material.color.setHex(0x22c55e); Mo.voyant.material.emissive.setHex(0x22c55e); Mo.voyant.material.emissiveIntensity = 2; son('ok'); opts.onResolu && opts.onResolu(i); };
        Mo.erreur = () => {
            son('erreur'); Mo.flash = performance.now(); alarmeFlash = performance.now(); secousse = performance.now();
            if (Mo.voyant && !Mo.resolu) { Mo.voyant.material.emissive.setHex(0xff1f1f); Mo.voyant.material.emissiveIntensity = 2.5; setTimeout(() => { if (!Mo.resolu) { Mo.voyant.material.emissiveIntensity = 0; Mo.voyant.material.emissive.setHex(0); } }, 700); }
            opts.onErreur && opts.onErreur(i);
        };
        Mo.programmer = () => { Mo.st.prochain = Date.now() + 25000 + Mo.R() * 30000; };
        try { (CONSTRUIRE[m.id] || (() => {}))(Mo, THREE, DS, E); Mo.maj(); } catch (e) { console.error('Module', m.id, e); }
        mods.push(Mo);
        return Mo;
    }

    // minuteur
    const chronoEtat = { s: 0, err: 0, max: 3, fini: '' };
    // ---- décor de la salle (voir desamorcage-decors.js), tiré au hasard à chaque partie ----
    const decorNom = W.DS_DECORS ? W.DS_DECORS(THREE, scene, { anims: anims, chrono: chronoEtat, sol: table, nom: opts.decor }) : '';
    const minuteur = (() => {
        const g = new THREE.Group(); g.position.set(0, .55, PROF / 2 + .012); corps.add(g);
        const pl = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .05), mat(0x1a1d24, { metalness: .6 })); g.add(pl);
        const c = document.createElement('canvas'); c.width = 512; c.height = 400; const ctx = c.getContext('2d');
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
        const ecr = new THREE.Mesh(new THREE.PlaneGeometry(.86, .67), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); ecr.position.z = .03; g.add(ecr);
        return { maj() {
            ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 512, 400);
            ctx.strokeStyle = '#3f1d1d'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 384);
            const s = Math.max(0, chronoEtat.s), mm = Math.floor(s / 60), ss = Math.floor(s % 60), cc = Math.floor((s % 1) * 100);
            const txt = chronoEtat.fini === 'ok' ? 'NEUTRE' : s < 60 ? `${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
            mono(ctx, '88:88', 256, 150, 150, '#2a0a0a'); mono(ctx, txt, 256, 150, chronoEtat.fini === 'ok' ? 110 : 150, chronoEtat.fini === 'ok' ? '#4ade80' : '#ff2a2a');
            texte(ctx, 'ERREURS', 256, 270, 26, '#64748b');
            for (let k = 0; k < chronoEtat.max - 1; k++) { const x = 256 + (k - (chronoEtat.max - 2) / 2) * 90; mono(ctx, '✕', x, 330, 70, k < chronoEtat.err ? '#ff3030' : '#2a0a0a'); }
            t.needsUpdate = true;
        } };
    })();

    charge.mods.forEach((m, i) => fabrique(i, m));
    // emplacements vides : cache d'acier vissé
    const occupes = new Set(charge.mods.map(m => m.slot).concat([0]));
    EMPL.forEach((e, s) => {
        if (occupes.has(s)) return;
        const [face, row, col] = e, c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .04), mat(0x2b303b, { metalness: .8, roughness: .35 }));
        c.position.set((col - 1) * PAS * (face ? -1 : 1), row ? -.55 : .55, face ? -PROF / 2 - .01 : PROF / 2 + .01); corps.add(c);
        [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]].forEach(([x, y]) => { const v = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .02, 10), mat(0x9ca3af, { metalness: .9 })); v.rotation.x = Math.PI / 2; v.position.set(c.position.x + x, c.position.y + y, c.position.z + (face ? -.03 : .03)); corps.add(v); });
    });
    // modules récurrents : première alerte un peu après le début
    mods.forEach(Mo => { if (Mo.def.besoin) Mo.st.prochain = Date.now() + 35000 + Mo.R() * 20000; });

    scene.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial && !m.userData.lin) { m.userData.lin = 1; m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); } });
    mods.forEach(Mo => Mo.g.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial) { const c = m.color, e = m.emissive;
        c.setHex = function (h) { THREE.Color.prototype.setHex.call(this, h); return this.convertSRGBToLinear(); };
        if (e) e.setHex = function (h) { THREE.Color.prototype.setHex.call(this, h); return this.convertSRGBToLinear(); }; } }));

    // ================= Caméra, rotation, zoom =================
    const rot = { y: -.35, x: .22, ty: -.35, tx: .22 };
    let zoom = null, alarmeFlash = 0, secousse = 0, fin = null, finT = 0;
    function viser(Mo) {
        zoom = Mo;
        try { opts.onZoom && opts.onZoom(Mo ? Mo.i : -1); } catch (e) {}
        if (!Mo) { rot.tx = .22; rot.ty = rot.ty; cam.pos2.copy(camBase); cam.cible2.set(0, 0, 0); return; }
        rot.tx = 0; rot.ty = Mo.face ? Math.PI : 0;
        const x = Mo.face ? -Mo.g.position.x : Mo.g.position.x;
        cam.pos2.set(x, Mo.g.position.y + .05, 2.55); cam.cible2.set(x, Mo.g.position.y, 0);
    }
    viser(null);
    const ray = new THREE.Raycaster(), souris = new THREE.Vector2();
    let appui = null;
    function toucher(ev) {
        const r = renderer.domElement.getBoundingClientRect();
        souris.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(souris, camera);
        return ray.intersectObjects(corps.children, true);
    }
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', ev => { appui = { x: ev.clientX, y: ev.clientY, ry: rot.ty, rx: rot.tx, glisse: false }; try { dom.setPointerCapture(ev.pointerId); } catch (e) {} });
    dom.addEventListener('pointermove', ev => {
        if (appui) {
            const dx = ev.clientX - appui.x, dy = ev.clientY - appui.y;
            if (!appui.glisse && Math.hypot(dx, dy) > 7) { appui.glisse = true; if (zoom) viser(null); appui.ry = rot.ty; appui.rx = rot.tx; appui.x = ev.clientX; appui.y = ev.clientY; }
            if (appui.glisse) { rot.ty = appui.ry + (ev.clientX - appui.x) * .008; rot.tx = Math.max(-1.35, Math.min(1.35, appui.rx + (ev.clientY - appui.y) * .008)); }
            return;
        }
        if (ev.pointerType === 'mouse') { const h = toucher(ev).find(x => x.object.userData.clic || x.object.userData.mod); dom.style.cursor = h && (h.object.userData.clic && zoom || h.object.userData.mod) ? 'pointer' : 'grab'; }
    });
    dom.addEventListener('pointerup', ev => {
        const a = appui; appui = null; if (!a || a.glisse || fin) return;
        const h = toucher(ev)[0];
        if (!h) { if (zoom) viser(null); return; }
        const o = h.object, Mo = o.userData.mod;
        if (Mo && zoom === Mo && o.userData.clic) { o.userData.clic(h); return; }
        if (Mo && zoom !== Mo) { viser(Mo); son('zoom'); return; }
        if (!Mo && zoom) viser(null);
    });
    dom.addEventListener('wheel', ev => { ev.preventDefault(); if (zoom) { if (ev.deltaY > 0) viser(null); return; } camBase.z = Math.max(5.2, Math.min(11, camBase.z + ev.deltaY * .004)); cam.pos2.copy(camBase); }, { passive: false });
    const clavier = ev => { if (ev.key === 'Escape' && zoom) viser(null); };
    W.addEventListener('keydown', clavier);

    // ================= Boucle =================
    let raf = 0, dernier = performance.now();
    function taille() { const w = el.clientWidth || 800, h = el.clientHeight || 600; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    taille(); const ro = W.ResizeObserver ? new ResizeObserver(taille) : null; if (ro) ro.observe(el); else W.addEventListener('resize', taille);
    function boucle() {
        raf = requestAnimationFrame(boucle);
        const now = performance.now(), dt = Math.min(.05, (now - dernier) / 1000); dernier = now;
        const k = 1 - Math.pow(.0025, dt);
        rot.y += (rot.ty - rot.y) * k; rot.x += (rot.tx - rot.x) * k;
        pivot.rotation.set(rot.x, rot.y, 0);
        cam.pos.lerp(cam.pos2, k); cam.cible.lerp(cam.cible2, k);
        camera.position.copy(cam.pos);
        const sec = now - secousse < 350 ? (1 - (now - secousse) / 350) * .06 : 0;
        if (sec) camera.position.add(new THREE.Vector3((Math.random() - .5) * sec, (Math.random() - .5) * sec, 0));
        camera.lookAt(cam.cible);
        alarme.intensity = now - alarmeFlash < 500 ? 4 * (1 - (now - alarmeFlash) / 500) : (chronoEtat.s < 30 && !fin ? 1.2 * (Math.sin(now / 160) * .5 + .5) : 0);
        anims.forEach(f => { try { f(now); } catch (e) {} });
        // modules récurrents
        const t = Date.now();
        mods.forEach(Mo => {
            if (!Mo.def.besoin || fin) return;
            const st = Mo.st;
            if (!st.actif && st.prochain && t > st.prochain) { st.actif = 1; st.fin = t + Mo.def.duree; Mo.def.activer(st, Mo.R); son('alerte'); Mo.maj(); opts.onAlerte && opts.onAlerte(Mo.i); }
            else if (st.actif && t > st.fin) { st.actif = 0; Mo.programmer(); Mo.maj(); Mo.erreur(); }
        });
        if (fin === 'boum') { const p = (now - finT) / 1000; flashBoum(p); }
        minuteur.maj();
        renderer.render(scene, camera);
    }
    boucle();

    // ---- fin : explosion ou neutralisation ----
    const eclat = new THREE.PointLight(0xffaa55, 0, 30); eclat.position.set(0, 1, 2); scene.add(eclat);
    let debris = null;
    function flashBoum(p) {
        eclat.intensity = p < .25 ? 60 * p / .25 : Math.max(0, 60 * (1 - (p - .25) / 1.5));
        renderer.toneMappingExposure = 1.15 + Math.max(0, 3 * (1 - p));
        if (debris) debris.children.forEach(d => { d.position.addScaledVector(d.userData.v, .016); d.userData.v.y -= .16 * .016 * 10; d.rotation.x += .1; d.rotation.y += .07; });
        if (p < 1.2) secousse = performance.now() - 50;
    }
    return {
        chrono(s, err, max) { chronoEtat.s = s; chronoEtat.err = err; chronoEtat.max = max || 3; },
        modules: mods,
        exploser() {
            if (fin) return; fin = 'boum'; finT = performance.now(); charge.fini = true; viser(null); son('boum');
            debris = new THREE.Group(); scene.add(debris);
            for (let k = 0; k < 70; k++) {
                const d = new THREE.Mesh(new THREE.BoxGeometry(.06 + Math.random() * .16, .06 + Math.random() * .12, .04), mat(k % 3 ? 0x3a414e : 0xf59e0b, { emissive: k % 4 ? 0x000000 : 0xff5500, emissiveIntensity: 1.5 }));
                d.userData.v = new THREE.Vector3((Math.random() - .5) * 9, Math.random() * 7, (Math.random() - .3) * 7); debris.add(d);
            }
            setTimeout(() => { corps.visible = false; }, 220);
        },
        desamorcer() { if (fin) return; fin = 'ok'; chronoEtat.fini = 'ok'; charge.fini = true; viser(null); rot.tx = .15; rot.ty = 0; lueur.color.setHex(0x22c55e); lueur.intensity = 2.5; },
        detruire() { cancelAnimationFrame(raf); W.removeEventListener('keydown', clavier); if (ro) ro.disconnect(); renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); if (dom.parentNode) dom.parentNode.removeChild(dom); },
        viser: i => viser(i == null ? null : mods[i]), // pour les tests
        decor: () => decorNom,
        projeter: o => { const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(camera); const r = dom.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
        tourner: (ry, rx) => { rot.ty = ry; rot.tx = rx; },
        cliquer: (i, f) => f(mods[i])
    };
}

// =====================================================================
//  Construction de chaque module (coordonnées locales : -0.5 à 0.5, z vers l'extérieur)
// =====================================================================
const BTN = { c: 0x475569, tc: '#f1f5f9' };
const ecranFond = (ctx, w, h, c) => { ctx.fillStyle = c || '#03120c'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.06)'; for (let y = 0; y < h; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } };
function fleche(ctx, w, h, dir, coul) {
    ctx.fillStyle = coul || '#e2e8f0'; ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate({ H: 0, D: Math.PI / 2, B: Math.PI, G: -Math.PI / 2 }[dir]);
    ctx.beginPath(); ctx.moveTo(0, -h * .28); ctx.lineTo(w * .26, h * .14); ctx.lineTo(-w * .26, h * .14); ctx.closePath(); ctx.fill(); ctx.restore();
}
function symbole(ctx, s, x, y, r, coul) {
    ctx.fillStyle = coul; ctx.beginPath();
    if (s === 'cercle') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (s === 'carre') ctx.rect(x - r * .85, y - r * .85, r * 1.7, r * 1.7);
    else if (s === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * .8); ctx.lineTo(x - r, y + r * .8); ctx.closePath(); }
    else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    ctx.fill();
}
const CONSTRUIRE = {
    conduits(M, THREE, DS) {
        const n = M.st.c.length;
        M.boite(.08, .82, .1, -.4, -.02, 0, 0x111827); M.boite(.08, .82, .1, .4, -.02, 0, 0x111827);
        const fils = M.st.c.map((c, k) => {
            const y = .3 - k * (.62 / Math.max(1, n - 1)) - .02;
            const tube = M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .72, 14), new THREE.MeshStandardMaterial({ color: parseInt(DS.COUL[c].slice(1), 16), roughness: .45, metalness: .1 })), 0, y, .07);
            tube.rotation.z = Math.PI / 2;
            const b1 = M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .28, 12), tube.material), -.22, y, .07); b1.rotation.z = Math.PI / 2 + .25; b1.visible = false;
            const b2 = M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .28, 12), tube.material), .22, y - .03, .07); b2.rotation.z = Math.PI / 2 - .25; b2.visible = false;
            M.clic(tube, () => { M.son('coupe'); M.act({ coupe: k }); });
            return { tube, b1, b2 };
        });
        M.maj = () => fils.forEach((f, k) => { const c = M.st.coupes.indexOf(k) >= 0; f.tube.visible = !c; f.b1.visible = f.b2.visible = c; if (c) f.tube.userData.clic = null; });
    },
    valve(M, THREE, DS) {
        const anneau = M.ajouter(new THREE.Mesh(new THREE.TorusGeometry(.25, .03, 12, 40), new THREE.MeshStandardMaterial({ color: parseInt(DS.COUL[M.st.col].slice(1), 16), emissive: parseInt(DS.COUL[M.st.col].slice(1), 16), emissiveIntensity: .35 })), -.14, .07, .03);
        const molette = M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.21, .21, .08, 32), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: .85, roughness: .3 })), -.14, .07, .04);
        molette.rotation.x = Math.PI / 2;
        const aiguille = M.ajouter(new THREE.Mesh(new THREE.BoxGeometry(.035, .17, .03), new THREE.MeshStandardMaterial({ color: 0x111827 })), -.14, .07, .1);
        const ecr = M.ecran(.26, .2, .3, .26, 260, 200, (ctx, w, h) => { ecranFond(ctx, w, h); mono(ctx, String(M.st.v), w / 2, h / 2 + 6, 150, '#4ade80'); });
        M.etiquette('PRESSION', .26, .07, .3, .41, { taille: 30 });
        M.bouton({ w: .14, h: .14, x: .23, y: -.03, c: BTN.c, texte: '−', taille: 150 }, { moins: 1 });
        M.bouton({ w: .14, h: .14, x: .39, y: -.03, c: BTN.c, texte: '+', taille: 150 }, { plus: 1 });
        M.bouton({ w: .78, h: .16, x: 0, y: -.36, c: 0x9f1239, texte: 'VERROUILLER', taille: 34 }, { verrou: 1 });
        M.maj = () => { ecr.maj(); };
        M.clic(molette, () => M.act({ plus: 1 }));
        M.anime(() => { const cible = -M.st.v * Math.PI * 2 / 10; aiguille.rotation.z += (cible - aiguille.rotation.z) * .2; aiguille.position.x = -.14 - Math.sin(aiguille.rotation.z) * .09; aiguille.position.y = .07 + Math.cos(aiguille.rotation.z) * .09; });
    },
    constellations(M, THREE, DS, E) {
        M.ecran(.82, .16, 0, .36, 820, 160, (ctx, w, h) => { ecranFond(ctx, w, h, '#020617'); texte(ctx, DS.CONST[M.st.k][0].toUpperCase(), w / 2, h / 2, 54, '#7dd3fc'); });
        const etoiles = [];
        for (let i = 0; i < 16; i++) {
            const x = -.3 + (i % 4) * .2, y = .16 - Math.floor(i / 4) * .17;
            const s = M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.05, 18, 14), new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, metalness: .2, roughness: .3 })), x, y, .03);
            M.clic(s, () => { s.userData.t = performance.now(); M.act({ etoile: i }); });
            etoiles.push(s);
        }
        M.maj = () => { const fait = M.def.ordre(M.st, E).slice(0, M.st.pos); etoiles.forEach((s, i) => { const on = fait.indexOf(i) >= 0; s.material.emissive.setHex(on ? 0x38bdf8 : 0x000000); s.material.emissiveIntensity = on ? 1.6 : 0; s.material.color.setHex(on ? 0xbae6fd : 0x1e293b); }); };
        M.maj();
    },
    glyphes(M, THREE, DS, E) {
        const leds = [];
        M.st.g.forEach((gi, k) => {
            const x = k % 2 ? .2 : -.2, y = k < 2 ? .14 : -.24;
            M.bouton({ w: .3, h: .3, x: x, y: y, c: 0xd6d3d1, dessin: (ctx, w, h) => { ctx.fillStyle = '#e7e5e4'; ctx.fillRect(0, 0, w, h); DS.glypheCanvas(ctx, gi, w * .14, h * .14, w * .72, '#1c1917', 1.1); } }, { touche: k });
            leds.push(M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1f2937 })), x, y + .19, .02));
        });
        M.maj = () => leds.forEach((l, k) => { const on = M.st.fait.indexOf(k) >= 0; l.material.color.setHex(on ? 0x22c55e : 0x1f2937); l.material.emissive.setHex(on ? 0x22c55e : 0); l.material.emissiveIntensity = on ? 1.5 : 0; });
    },
    jauges(M, THREE, DS) {
        const curs = M.st.j.map((j, k) => {
            const x = -.32 + k * .24;
            M.boite(.05, .5, .02, x, .02, 0, 0x0b0d12);
            for (let n = 0; n <= 5; n++) M.boite(.1, .006, .006, x, -.21 + n * .092, .02, 0x64748b);
            const c = M.boite(.13, .05, .05, x, -.21, .02, j.c);
            M.ecran(.14, .1, x, .36, 140, 100, (ctx, w, h) => { ctx.fillStyle = '#0f141c'; ctx.fillRect(0, 0, w, h); symbole(ctx, j.s, w / 2, h / 2, 34, '#e2e8f0'); });
            M.bouton({ w: .095, h: .08, x: x - .05, y: -.34, c: BTN.c, texte: '▲', taille: 50 }, { haut: k });
            M.bouton({ w: .095, h: .08, x: x + .05, y: -.34, c: BTN.c, texte: '▼', taille: 50 }, { bas: k });
            return c;
        });
        M.bouton({ w: .13, h: .58, x: .4, y: -.06, c: 0x0e7490, dessin: (ctx, w, h) => { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); texte(ctx, 'INJECTER', 0, 0, 70, '#fff'); ctx.restore(); } }, { injecter: 1 });
        M.maj = () => curs.forEach((c, k) => { c.position.y = -.21 + M.st.j[k].n * .092; });
        M.maj();
    },
    cristaux(M, THREE, DS) {
        M.boite(.92, .08, .14, 0, -.32, 0, 0x1f2937);
        M.st.c.forEach((c, k) => {
            const x = -.36 + k * .18, col = parseInt(DS.COUL[c.c].slice(1), 16);
            const geo = c.f === 'prisme' ? new THREE.CylinderGeometry(.055, .055, .26, 6) : c.f === 'aiguille' ? new THREE.ConeGeometry(.05, .36, 7) : new THREE.SphereGeometry(.075, 20, 16);
            const m = M.ajouter(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: c.b ? col : 0x000000, emissiveIntensity: c.b ? 1.4 : 0, metalness: .1, roughness: .15, transparent: true, opacity: .92 })), x, c.f === 'orbe' ? -.17 : -.1, .1);
            M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .05, 16), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: .7 })), x, -.27, .1);
            M.clic(m, () => M.act({ cristal: k }));
            M.g.userData['c' + k] = m;
        });
        M.etiquette('RÉSONANCE', .5, .08, 0, .38, { taille: 32, coul: '#a5b4fc' });
    },
    synchro(M, THREE, DS) {
        const e = M.ecran(.84, .62, 0, .12, 600, 440, (ctx, w, h, now) => {
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2, R = 160;
            ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            const pc = DS.COUL[M.st.p]; const gr = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy, 70); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, pc); gr.addColorStop(1, '#000');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 66, 0, Math.PI * 2); ctx.fill();
            DS.SYNC_ANG.forEach((a, k) => { const r = a * Math.PI / 180, x = cx + Math.cos(r) * R, y = cy + Math.sin(r) * R; ctx.fillStyle = DS.COUL[M.st.b[k]]; ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#020617'; ctx.lineWidth = 4; ctx.stroke(); });
            const a = M.def.angle(M.st, Date.now()) * Math.PI / 180, sx = cx + Math.cos(a) * R, sy = cy + Math.sin(a) * R;
            ctx.fillStyle = '#e2e8f0'; ctx.fillRect(sx - 10, sy - 7, 20, 14); ctx.fillStyle = '#38bdf8'; ctx.fillRect(sx - 26, sy - 4, 13, 8); ctx.fillRect(sx + 13, sy - 4, 13, 8);
        }, true);
        M.bouton({ w: .5, h: .16, x: 0, y: -.36, c: 0x1d4ed8, texte: 'SYNC', taille: 70 }, () => M.act({ sync: 1, t: Date.now() }));
    },
    fusibles(M, THREE, DS) {
        const leds = M.st.f.map((f, k) => {
            const x = -.375 + k * .15;
            const verre = M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .32, 16), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: .45, roughness: .05 })), x, -.02, .07);
            M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .05, 16), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: .9 })), x, .15, .07);
            M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .05, 16), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: .9 })), x, -.19, .07);
            M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.052, .052, .04, 16), new THREE.MeshStandardMaterial({ color: parseInt(DS.COUL[f.t].slice(1), 16) })), x, .08, .07);
            M.ajouter(new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .26, 6), new THREE.MeshStandardMaterial({ color: 0x78716c })), x, -.02, .07);
            M.etiquette(String(k + 1), .08, .06, x, -.29, { taille: 34 });
            M.clic(verre, () => { M.act({ fusible: k }); });
            return M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 10), new THREE.MeshStandardMaterial({ color: 0x1f2937 })), x, .27, .02);
        });
        M.bouton({ w: .5, h: .12, x: -.05, y: -.41, c: 0x9a3412, texte: 'RÉARMER', taille: 52 }, { rearmer: 1 });
        M.maj = () => leds.forEach((l, k) => { const on = M.st.f[k].on; l.material.color.setHex(on ? 0xfde68a : 0x1f2937); l.material.emissive.setHex(on ? 0xf59e0b : 0); l.material.emissiveIntensity = on ? 1.8 : 0; });
        M.maj();
    },
    sas(M, THREE, DS) {
        const portes = M.st.p.map((p, k) => {
            const x = k % 2 ? .21 : -.21, y = k < 2 ? .2 : -.2;
            M.boite(.38, .34, .02, x, y, 0, 0x020617);
            const b = M.bouton({ w: .36, h: .32, x: x, y: y, d: .05, c: DS.COUL[p.c], dessin: (ctx, w, h) => {
                ctx.fillStyle = DS.COUL[p.c]; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < w; i += 22) ctx.fillRect(i, 0, 3, h);
                ctx.fillStyle = 'rgba(2,6,23,.75)'; ctx.fillRect(w * .08, h * .12, w * .84, h * .76);
                texte(ctx, DS.SAS_ICONE[p.s], w * .32, h / 2, 90, '#fff'); mono(ctx, String(p.n), w * .72, h / 2 + 4, 96, '#fde68a');
            } }, { porte: k });
            return b;
        });
        M.maj = () => portes.forEach((b, k) => { const o = M.st.ouv.indexOf(k) >= 0; b.position.y = (k < 2 ? .2 : -.2) + (o ? .13 : 0); b.scale.y = o ? .2 : 1; });
    },
    transmission(M, THREE, DS) {
        const gl = M.def.glyphes(M.st);
        M.ecran(.86, .3, 0, .3, 860, 300, (ctx, w, h) => { ecranFond(ctx, w, h, '#06131f'); const t = Math.min(110, (w - 40) / gl.length); gl.forEach((g, k) => DS.glypheCanvas(ctx, g, w / 2 - t * gl.length / 2 + k * t + t * .1, h / 2 - t * .4, t * .8, '#67e8f9', 1)); });
        const f = M.ecran(.5, .16, 0, -.06, 500, 160, (ctx, w, h) => { ecranFond(ctx, w, h, '#1a0f00'); mono(ctx, DS.freq(M.st.f).toFixed(3) + ' MHz', w / 2, h / 2 + 4, 72, '#fbbf24'); });
        M.bouton({ w: .14, h: .14, x: -.37, y: -.06, c: BTN.c, texte: '◀', taille: 90 }, { moins: 1 });
        M.bouton({ w: .14, h: .14, x: .37, y: -.06, c: BTN.c, texte: '▶', taille: 90 }, { plus: 1 });
        M.bouton({ w: .6, h: .14, x: 0, y: -.35, c: 0x0f766e, texte: 'ÉMETTRE', taille: 56 }, { emettre: 1 });
        M.maj = () => f.maj();
    },
    circuit(M, THREE, DS, E) {
        const porte = (ctx, p, x, y, s) => {
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 5; ctx.beginPath();
            if (p === 'ET' || p === 'NON-ET') { ctx.moveTo(x, y - s); ctx.lineTo(x + s * .7, y - s); ctx.arc(x + s * .7, y, s, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x, y + s); ctx.closePath(); }
            else { ctx.moveTo(x - s * .1, y - s); ctx.quadraticCurveTo(x + s * 1.1, y - s, x + s * 1.8, y); ctx.quadraticCurveTo(x + s * 1.1, y + s, x - s * .1, y + s); ctx.quadraticCurveTo(x + s * .5, y, x - s * .1, y - s); }
            ctx.stroke();
            if (p === 'OUX') { ctx.beginPath(); ctx.moveTo(x - s * .4, y - s); ctx.quadraticCurveTo(x + s * .2, y, x - s * .4, y + s); ctx.stroke(); }
            if (p === 'NON-ET' || p === 'NON-OU') { ctx.beginPath(); ctx.arc(x + s * 1.95, y, s * .22, 0, Math.PI * 2); ctx.stroke(); }
        };
        const e = M.ecran(.86, .56, 0, .14, 860, 560, (ctx, w, h) => {
            ecranFond(ctx, w, h, '#020a12');
            const x = M.def.etape(M.st);
            [['A', x.a, 120], ['B', x.b, 260], ['C', x.c, 430]].forEach(([n, v, y]) => {
                ctx.fillStyle = v ? '#fde047' : '#1e293b'; ctx.beginPath(); ctx.arc(70, y, 34, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4; ctx.stroke();
                texte(ctx, n, 70, y, 34, v ? '#1c1917' : '#94a3b8');
            });
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.moveTo(104, 120); ctx.lineTo(230, 150); ctx.moveTo(104, 260); ctx.lineTo(230, 230);
            ctx.moveTo(400, 190); ctx.lineTo(500, 260); ctx.moveTo(104, 430); ctx.lineTo(500, 340); ctx.moveTo(700, 300); ctx.lineTo(800, 300); ctx.stroke();
            porte(ctx, x.g1, 240, 190, 70); porte(ctx, x.g2, 520, 300, 80);
            texte(ctx, '?', 818, 300, 60, '#f472b6');
        });
        const leds = [0, 1, 2].map(k => M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1f2937 })), -.4 + k * .07, .45, .01));
        const lev = M.bouton({ w: .3, h: .14, x: -.22, y: -.33, c: 0x334155, dessin: (ctx, w, h) => { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h); texte(ctx, 'SORTIE ' + M.st.levier, w / 2, h / 2, 40, M.st.levier ? '#fde047' : '#94a3b8'); } }, () => M.act({ levier: M.st.levier ? 0 : 1 }));
        M.bouton({ w: .32, h: .14, x: .23, y: -.33, c: 0x15803d, texte: 'VALIDER', taille: 46 }, { valider: 1 });
        M.maj = () => { e.maj(); lev.userData.redessiner(); leds.forEach((l, k) => { const on = k < M.st.k; l.material.emissive.setHex(on ? 0x22c55e : 0); l.material.emissiveIntensity = on ? 1.6 : 0; l.material.color.setHex(on ? 0x86efac : 0x1f2937); }); };
        M.maj();
    },
    binaire(M, THREE, DS) {
        const col = parseInt(DS.COUL[M.st.col].slice(1), 16);
        [0, 1, 2, 3, 4, 5].forEach(k => { const on = M.st.n >> (5 - k) & 1; M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 12), new THREE.MeshStandardMaterial({ color: on ? col : 0x111827, emissive: on ? col : 0, emissiveIntensity: on ? 1.7 : 0 })), -.35 + k * .14, .37, .03); });
        const aff = M.ecran(.44, .13, -.2, .2, 440, 130, (ctx, w, h) => { ecranFond(ctx, w, h); mono(ctx, M.st.s.padEnd(2, '_'), w / 2, h / 2 + 4, 90, '#4ade80'); });
        const T = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'EFF', '0', 'OK'];
        T.forEach((t, k) => { const x = -.3 + (k % 3) * .17, y = .03 - Math.floor(k / 3) * .135;
            M.bouton({ w: .15, h: .115, x: x, y: y, c: t === 'OK' ? 0x15803d : t === 'EFF' ? 0x9f1239 : BTN.c, texte: t, taille: t.length > 1 ? 50 : 76 }, t === 'OK' ? { entrer: 1 } : t === 'EFF' ? { effacer: 1 } : { chiffre: t }); });
        M.etiquette('DÉCODEUR', .3, .07, .3, .2, { taille: 30, coul: '#94a3b8' });
        M.maj = () => aff.maj();
    },
    asteroides(M, THREE, DS) {
        const e = M.ecran(.62, .62, -.15, .1, 480, 480, (ctx, w, h) => {
            ctx.fillStyle = '#001408'; ctx.fillRect(0, 0, w, h); const c = w / 6;
            ctx.strokeStyle = 'rgba(74,222,128,.25)'; ctx.lineWidth = 2; for (let i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, h); ctx.moveTo(0, i * c); ctx.lineTo(w, i * c); ctx.stroke(); }
            const s = M.st.s, v = M.st.v;
            ctx.fillStyle = '#4ade80'; ctx.save(); ctx.translate((s % 6 + .5) * c, (Math.floor(s / 6) + .5) * c); ctx.rotate(Math.PI / 4); ctx.fillRect(-c * .22, -c * .22, c * .44, c * .44); ctx.restore();
            ctx.fillStyle = '#f8fafc'; ctx.beginPath(); const x = (v % 6 + .5) * c, y = (Math.floor(v / 6) + .5) * c; ctx.moveTo(x, y - c * .32); ctx.lineTo(x + c * .26, y + c * .26); ctx.lineTo(x - c * .26, y + c * .26); ctx.closePath(); ctx.fill();
        });
        M.etiquette('SECTEUR ' + DS.SECTEURS[M.st.k].toUpperCase(), .62, .09, -.15, -.32, { taille: 34, coul: '#86efac', fond: '#03120c' });
        [['H', .36, .25], ['G', .25, .09], ['D', .47, .09], ['B', .36, -.07]].forEach(([d, x, y]) => M.bouton({ w: .1, h: .1, x: x, y: y, c: BTN.c, dessin: (ctx, w, h) => { ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, w, h); fleche(ctx, w, h, d); } }, { dir: d }));
        M.maj = () => e.maj();
    },
    spectre(M, THREE, DS, E) {
        const dec = M.def.decalage(E);
        M.ecran(.86, .3, 0, .28, 860, 300, (ctx, w, h) => {
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);
            const g = ctx.createLinearGradient(0, 0, w, 0); ['#7c3aed', '#2563eb', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444'].forEach((c, i) => g.addColorStop(i / 6, c));
            ctx.globalAlpha = .12; ctx.fillStyle = g; ctx.fillRect(0, 30, w, h - 90); ctx.globalAlpha = 1;
            for (let i = 0; i < 8; i++) mono(ctx, String(i + 1), 54 + i * 107, h - 28, 34, '#475569');
            DS.ELEM[M.st.e][1].forEach(([p, c]) => { const x = 30 + (p + dec) * 107; ctx.fillStyle = DS.COUL[c]; ctx.shadowColor = DS.COUL[c]; ctx.shadowBlur = 24; ctx.fillRect(x, 30, 46, h - 90); ctx.shadowBlur = 0; });
        });
        const sel = M.ecran(.5, .14, 0, -.06, 500, 140, (ctx, w, h) => { ecranFond(ctx, w, h, '#120a1f'); texte(ctx, DS.ELEM[M.st.sel][0], w / 2, h / 2, 66, '#e9d5ff'); });
        M.bouton({ w: .13, h: .13, x: -.37, y: -.06, c: BTN.c, texte: '◀', taille: 90 }, { moins: 1 });
        M.bouton({ w: .13, h: .13, x: .37, y: -.06, c: BTN.c, texte: '▶', taille: 90 }, { plus: 1 });
        M.bouton({ w: .6, h: .14, x: 0, y: -.35, c: 0x6d28d9, texte: 'ANALYSER', taille: 56 }, { analyser: 1 });
        M.maj = () => sel.maj();
    },
    quarantaine(M, THREE, DS) {
        const img = {};
        const tuiles = M.st.g.map((s, i) => {
            const x = -.3 + (i % 4) * .2, y = .34 - Math.floor(i / 4) * .19;
            return M.bouton({ w: .18, h: .17, x: x, y: y, c: 0x1f2937, dessin: (ctx, w, h) => {
                ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, w, h);
                if (!img[s]) { const im = new Image(); im.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(DS.quaSVG(s, 200).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); img[s] = im; im.onload = () => tuiles.forEach(t => t.userData.redessiner && t.userData.redessiner()); }
                if (img[s].complete && img[s].naturalWidth) ctx.drawImage(img[s], w * .14, h * .12, w * .72, h * .76);
                if (M.st.q[i]) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 18; ctx.strokeRect(9, 9, w - 18, h - 18); }
            } }, { case: i });
        });
        M.bouton({ w: .5, h: .08, x: 0, y: -.44, c: 0x991b1b, texte: 'CONFINER', taille: 70 }, { confiner: 1 });
        M.maj = () => tuiles.forEach(t => t.userData.redessiner());
    },
    chiffre(M, THREE, DS, E) {
        const code = M.def.code(M.st, E);
        M.ecran(.86, .34, 0, .24, 860, 340, (ctx, w, h) => { ecranFond(ctx, w, h, '#100616'); texte(ctx, 'MESSAGE CHIFFRÉ', w / 2, 50, 34, '#a78bfa'); mono(ctx, code.split('').join(' '), w / 2, 190, code.length > 6 ? 86 : 100, '#f0abfc'); });
        ['rouge', 'vert', 'bleu', 'jaune'].forEach((c, k) => M.bouton({ w: .17, h: .17, rond: true, x: -.3 + k * .2, y: -.26, c: DS.COUL[c] }, { bouton: c }));
    },
    telemetrie(M, THREE, DS, E) {
        const tr = DS.TRAJ[M.st.t][0], pts = DS.trajPoints(tr), coul = { blanc: '#e2e8f0', rouge: '#ef4444', vert: '#22c55e' }[M.st.c];
        M.ecran(.6, .6, -.16, .1, 480, 480, (ctx, w, h) => {
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 22, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = coul; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => { const X = w / 2 + x * w * .4, Y = h / 2 + y * h * .4; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
            for (let k = 0; k < M.st.l; k++) { ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(60 + k * 46, 50, 14, 0, Math.PI * 2); ctx.fill(); }
        });
        const leds = [0, 1, 2, 3, 4].map(k => M.ajouter(new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1f2937 })), -.4 + k * .1, -.33, .01));
        [['H', .36, .25], ['G', .25, .09], ['D', .47, .09], ['B', .36, -.07]].forEach(([d, x, y]) => M.bouton({ w: .1, h: .1, x: x, y: y, c: 0x7c2d12, dessin: (ctx, w, h) => { ctx.fillStyle = '#9a3412'; ctx.fillRect(0, 0, w, h); fleche(ctx, w, h, d, '#fed7aa'); } }, { dir: d }));
        M.etiquette('PROPULSEURS', .3, .07, .36, -.22, { taille: 28, coul: '#fdba74' });
        M.maj = () => leds.forEach((l, k) => { const on = k < M.st.pos; l.material.emissive.setHex(on ? 0xf59e0b : 0); l.material.emissiveIntensity = on ? 1.6 : 0; l.material.color.setHex(on ? 0xfde68a : 0x1f2937); });
    },
    derivation(M, THREE, DS) {
        M.ecran(.5, .1, -.14, .42, 500, 100, (ctx, w, h) => { ecranFond(ctx, w, h, '#120404'); mono(ctx, 'CIBLE : ▒▒', w / 2, h / 2 + 3, 60, '#7f1d1d'); });
        const inter = M.st.l.map((l, k) => {
            const y = .24 - k * .165;
            M.ecran(.24, .13, -.24, y, 240, 130, (ctx, w, h) => { ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = l.c === 'rouge' ? '#ef4444' : '#f1f5f9'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, w - 12, h - 12); mono(ctx, String(l.v), w / 2, h / 2 + 4, 92, '#fde68a'); });
            M.boite(.2, .07, .02, .06, y, 0, 0x0b0d12);
            const lev = M.bouton({ w: .1, h: .07, x: .06, y: y, c: 0xe5e7eb }, { inter: k });
            return lev;
        });
        M.bouton({ w: .13, h: .6, x: .38, y: -.02, c: 0xb45309, dessin: (ctx, w, h) => { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); texte(ctx, 'DÉRIVER', 0, 0, 72, '#fff'); ctx.restore(); } }, { deriver: 1 });
        M.maj = () => inter.forEach((b, k) => { b.position.x = M.st.l[k].on ? .1 : .02; b.base.material.color.setHex(M.st.l[k].on ? 0x22c55e : 0xe5e7eb); });
        M.maj();
    },
    boucliers(M, THREE, DS) {
        const e = M.ecran(.86, .42, 0, .22, 860, 420, (ctx, w, h) => {
            const st = M.st;
            if (!st.actif) { ecranFond(ctx, w, h, '#05070a'); texte(ctx, 'BOUCLIERS STABLES', w / 2, h / 2, 46, '#334155'); return; }
            const c = DS.COUL[st.col], reste = Math.max(0, Math.ceil((st.fin - Date.now()) / 1000));
            ctx.fillStyle = c; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(30, 30, w - 60, h - 60);
            texte(ctx, 'RECHARGE REQUISE', w / 2, 110, 48, '#fff'); mono(ctx, String(reste).padStart(2, '0'), w / 2, 270, 150, reste <= 10 ? '#fca5a5' : '#fff');
        }, true);
        DS.BOU_SYM.forEach((s, k) => M.bouton({ w: .18, h: .18, x: -.31 + k * .205, y: -.26, c: 0x334155, dessin: (ctx, w, h) => { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, w, h); symbole(ctx, s, w / 2, h / 2, w * .3, '#f1f5f9'); } }, { sym: s }));
        M.etiquette('MODULE RÉCURRENT', .5, .06, 0, -.44, { taille: 26, coul: '#64748b' });
    },
    radiations(M, THREE, DS) {
        M.ecran(.86, .44, 0, .2, 860, 440, (ctx, w, h) => {
            const st = M.st;
            ecranFond(ctx, w, h, st.actif ? '#1a1300' : '#05070a');
            if (!st.actif) { texte(ctx, '☢ NIVEAU NORMAL', w / 2, h / 2, 50, '#334155'); return; }
            const reste = Math.max(0, Math.ceil((st.fin - Date.now()) / 1000));
            texte(ctx, '☢ QUESTION DE CONTRÔLE', w / 2, 70, 40, '#fde047'); mono(ctx, 'R-' + String(st.q + 1).padStart(2, '0'), w / 2, 220, 150, '#facc15'); mono(ctx, reste + ' s', w / 2, 360, 60, reste <= 10 ? '#f87171' : '#fde68a');
        }, true);
        M.bouton({ w: .36, h: .18, x: -.21, y: -.28, c: 0x15803d, texte: 'OUI', taille: 90 }, { rep: 1 });
        M.bouton({ w: .36, h: .18, x: .21, y: -.28, c: 0x9f1239, texte: 'NON', taille: 90 }, { rep: 0 });
    }
};
W.DS3D.CONSTRUIRE = CONSTRUIRE;
W.DS3D.outils = { texte: texte, mono: mono, ecranFond: ecranFond, fleche: fleche, symbole: symbole, BTN: BTN };
})();
