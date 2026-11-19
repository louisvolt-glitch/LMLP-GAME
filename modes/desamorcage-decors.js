// =====================================================================
//  « CHARGE INSTABLE » : les quatre décors de la salle autour de la charge.
//  Un décor est tiré au hasard à chaque partie (d'après la graine de la charge).
//    soute     : soute de vaisseau, hublots ouverts sur l'espace, néons, caisses
//    machines  : salle des machines, conduites continues, vannes, manomètres, vapeur
//    controle  : salle de contrôle, mur d'écrans animés qui réagissent à la partie
//    bunker    : bunker abandonné, lampe qui grésille, ventilateur, portes de métro
//  Les modèles 3D viennent de models/decor/ (versions allégées) ; s'ils ne chargent pas,
//  le décor dessiné reste en place et la partie reste jouable.
//  DS_DECORS(THREE, scene, ctx) ; ctx = { anims, chrono, sol, nom }
// =====================================================================
(function () {
const W = window;
const DOSSIER = './models/decor/';
const NOMS = ['soute', 'machines', 'controle', 'bunker'];

// ------------------------------- outils -------------------------------
function toile(w, h, dessin) { const c = document.createElement('canvas'); c.width = w; c.height = h; dessin(c.getContext('2d'), w, h); return c; }
function texture(THREE, c, rx, ry) { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry || rx); } t.anisotropy = 4; return t; }
function bruit(x, w, h, n, coul, taille) { for (let i = 0; i < n; i++) { x.fillStyle = coul; x.globalAlpha = Math.random() * .25; x.fillRect(Math.random() * w, Math.random() * h, taille || 2, taille || 2); } x.globalAlpha = 1; }
function rivets(x, x0, y0, w, h, pas, coul) { x.fillStyle = coul; for (let i = x0 + 8; i < x0 + w - 4; i += pas) { [y0 + 7, y0 + h - 7].forEach(y => { x.beginPath(); x.arc(i, y, 2.4, 0, 7); x.fill(); }); } }

// sol : on redessine la texture de la table
function sol(THREE, ctx, dessin, rep) {
    const t = texture(THREE, toile(512, 512, dessin), rep || 6);
    ctx.sol.material.map = t; ctx.sol.material.needsUpdate = true;
}
// mur plat (avec trous ronds éventuels pour les hublots)
function mur(THREE, scene, c, trous, opts) {
    opts = opts || {};
    const L = 30, H = 15, y0 = -1.6;
    const forme = new THREE.Shape(); forme.moveTo(-L / 2, 0); forme.lineTo(L / 2, 0); forme.lineTo(L / 2, H); forme.lineTo(-L / 2, H); forme.lineTo(-L / 2, 0);
    (trous || []).forEach(t => { const p = new THREE.Path(); p.absarc(t.x, t.y - y0, t.r, 0, Math.PI * 2, true); forme.holes.push(p); });
    const g = new THREE.ShapeGeometry(forme, 48), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + L / 2) / L, uv.getY(i) / H);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture(THREE, c), metalness: opts.metal || .3, roughness: opts.rugo || .8 }));
    m.position.set(0, y0, -10); m.receiveShadow = true; scene.add(m);
    return m;
}
// murs latéraux, en biais, pour fermer la pièce sur les côtés
function cotes(THREE, scene, c) {
    const t = texture(THREE, c);
    [-1, 1].forEach(s => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 15), new THREE.MeshStandardMaterial({ map: t, metalness: .3, roughness: .85 }));
        m.position.set(s * 14.5, 5.9, -3); m.rotation.y = -s * Math.PI / 2.4; m.receiveShadow = true; scene.add(m);
    });
}
// modèles glTF (mis en cache par nom)
function chargeur(THREE) {
    if (!THREE.GLTFLoader) return null;
    const L = new THREE.GLTFLoader(), cache = {};
    return nom => cache[nom] || (cache[nom] = new Promise((ok, ko) => L.load(DOSSIER + nom + '/scene.gltf', g => ok(g.scene), undefined, ko)));
}
// pose un modèle : hauteur h, position p (posé au sol, ou contre le mur si mur:1), rotation r autour de y
function poser(THREE, scene, charger, nom, d, apres) {
    if (!charger) return;
    charger(nom).then(modele => {
        const o = modele.clone(true), b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
        o.scale.setScalar(d.h / ((d.taille === 'l' ? Math.max(s.x, s.z) : s.y) || 1));
        const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3());
        const yBas = d.plafond ? d.p[1] - b2.max.y : d.mur ? d.p[1] - c.y : d.p[1] - b2.min.y;
        o.position.set(-c.x, yBas, d.mur ? -b2.min.z : -c.z);
        const g = new THREE.Group(); g.add(o); g.position.set(d.p[0], 0, d.p[2]); g.rotation.y = d.r || 0;
        o.traverse(n => { if (n.isMesh) { n.castShadow = !d.mur && !d.plafond; n.receiveShadow = true; } });
        scene.add(g);
        if (apres) apres(g, o);
    }).catch(() => {});
}
function lumiere(THREE, scene, coul, force, portee, x, y, z) { const l = new THREE.PointLight(coul, force, portee); l.position.set(x, y, z); scene.add(l); return l; }
function basique(THREE, coul, o) { return new THREE.MeshBasicMaterial(Object.assign({ color: coul, toneMapped: false }, o || {})); }

// ------------------------------- conduites (salle des machines) -------------------------------
// une conduite continue qui suit une ligne brisée, coudes arrondis, brides et colliers
function conduite(THREE, scene, pts, r, mat, matBride) {
    const P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const chemin = new THREE.CurvePath(), rayonCoude = Math.max(r * 2.6, .35);
    let depart = P[0].clone();
    for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i], c = P[i + 1];
        if (!c) { chemin.add(new THREE.LineCurve3(depart, b.clone())); break; }
        const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
        const k = Math.min(rayonCoude, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
        const avant = b.clone().addScaledVector(d1, -k), apres = b.clone().addScaledVector(d2, k);
        chemin.add(new THREE.LineCurve3(depart, avant));
        chemin.add(new THREE.QuadraticBezierCurve3(avant, b.clone(), apres));
        depart = apres;
    }
    const long = chemin.getLength();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(chemin, Math.max(24, Math.round(long * 10)), r, 14, false), mat.clone());
    tube.castShadow = true; tube.receiveShadow = true; scene.add(tube);
    // brides régulières et aux extrémités
    const pas = 1.6;
    for (let s = 0; s <= long + .01; s += pas) {
        const u = Math.min(1, s / long), p = chemin.getPointAt(u), t = chemin.getTangentAt(u);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.32, r * 1.32, r * .55, 18), matBride);
        b.position.copy(p); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t); b.castShadow = true; scene.add(b);
    }
    return chemin;
}
// vanne à volant (rouge ou bleue) posée sur une conduite
function vanne(THREE, scene, p, coul, axe, anims) {
    const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]);
    const corps = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .5, 16), new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: .8, roughness: .4 }));
    corps.rotation.x = Math.PI / 2; corps.position.z = .25; g.add(corps);
    const volant = new THREE.Group(); volant.position.z = .55; g.add(volant);
    const m = new THREE.MeshStandardMaterial({ color: coul, metalness: .5, roughness: .45 });
    volant.add(new THREE.Mesh(new THREE.TorusGeometry(.32, .045, 10, 30), m));
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.64, .05, .05), m); b.rotation.z = i * Math.PI / 4; volant.add(b); }
    volant.add(new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 10), m));
    if (axe) g.rotation.y = axe;
    scene.add(g);
    return volant;
}
// manomètre avec aiguille qui s'agite
function manometre(THREE, scene, p, anims, chrono) {
    const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); scene.add(g);
    const boitier = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .16, 28), new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: .9, roughness: .3 }));
    boitier.rotation.x = Math.PI / 2; g.add(boitier);
    const c = toile(256, 256, (x, w) => {
        x.fillStyle = '#f5f0e1'; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
        x.strokeStyle = '#111'; x.lineWidth = 3;
        for (let i = 0; i <= 10; i++) { const a = Math.PI * .75 + i / 10 * Math.PI * 1.5; x.beginPath(); x.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116); x.stroke(); }
        x.strokeStyle = '#dc2626'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 108, Math.PI * .75 + Math.PI * 1.2, Math.PI * .75 + Math.PI * 1.5); x.stroke();
        x.fillStyle = '#111'; x.font = 'bold 26px monospace'; x.textAlign = 'center'; x.fillText('BAR', 128, 196);
    });
    const cadran = new THREE.Mesh(new THREE.CircleGeometry(.38, 32), new THREE.MeshStandardMaterial({ map: texture(THREE, c), roughness: .5 }));
    cadran.position.z = .085; g.add(cadran);
    const aiguille = new THREE.Mesh(new THREE.BoxGeometry(.03, .3, .01), basique(THREE, 0x111111));
    aiguille.geometry.translate(0, .13, 0); aiguille.position.z = .1; g.add(aiguille);
    const base = Math.random() * .5;
    anims.push(now => { const stress = chrono.s && chrono.s < 30 ? .5 : 0; aiguille.rotation.z = Math.PI * .75 - (base + stress + .15 * Math.sin(now / 300 + base * 9) + .04 * Math.sin(now / 47)) * Math.PI; });
}
// jets de vapeur (petits nuages qui montent et s'effacent)
function vapeur(THREE, scene, p, anims, dir) {
    const c = toile(64, 64, x => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
    const t = texture(THREE, c), parts = [];
    for (let i = 0; i < 14; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
        s.userData.t0 = Math.random() * 2600; scene.add(s); parts.push(s);
    }
    const d = dir || [0, 1, 0];
    anims.push(now => parts.forEach(s => {
        const k = ((now + s.userData.t0) % 2600) / 2600, burst = Math.sin(now / 1900) > -.2 ? 1 : 0;
        s.position.set(p[0] + d[0] * k * 1.6 + Math.sin(k * 9 + s.userData.t0) * .12, p[1] + d[1] * k * 1.6 + k * .5, p[2] + d[2] * k * 1.6);
        s.scale.setScalar(.25 + k * 1.1); s.material.opacity = burst * .38 * (1 - k) * Math.min(1, k * 6);
    }));
}

// =====================================================================
//  1) SOUTE DE VAISSEAU
// =====================================================================
function soute(THREE, scene, ctx, charger) {
    sol(THREE, ctx, (x, w, h) => {
        x.fillStyle = '#121a2b'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#151f33' : '#111a2c'; x.fillRect(i * 256 + 3, j * 256 + 3, 250, 250); }
        x.strokeStyle = 'rgba(148,163,184,.12)'; for (let k = 0; k < 512; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 8, 8); x.stroke(); }
        x.fillStyle = 'rgba(34,211,238,.35)'; x.fillRect(0, 254, 512, 4); x.fillRect(254, 0, 4, 512);
        rivets(x, 0, 0, 256, 256, 30, 'rgba(203,213,225,.25)'); rivets(x, 256, 256, 256, 256, 30, 'rgba(203,213,225,.25)');
    }, 5);
    const hublots = [{ x: -7.4, y: 3.5, r: 1.9 }, { x: 6.8, y: 3.3, r: 2.3 }];
    const c = toile(2048, 1024, (x, w, h) => {
        x.fillStyle = '#1b2436'; x.fillRect(0, 0, w, h);
        const pw = 2048 / 10;
        for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) {
            const px = i * pw, py = 90 + j * 290;
            x.fillStyle = (i + j) % 2 ? '#212c42' : '#1e283d'; x.fillRect(px + 5, py, pw - 10, 280);
            x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 3; x.strokeRect(px + 5, py, pw - 10, 280);
            rivets(x, px + 5, py, pw - 10, 280, 22, 'rgba(203,213,225,.35)');
        }
        bruit(x, w, h, 4000, '#000', 3);
        // bandes et inscriptions
        x.fillStyle = '#0f172a'; x.fillRect(0, 0, w, 86); x.fillRect(0, 960, w, 64);
        for (let i = -40; i < w + 40; i += 56) { x.fillStyle = (i / 56) % 2 ? '#f59e0b' : '#111827'; x.beginPath(); x.moveTo(i, 1024); x.lineTo(i + 28, 966); x.lineTo(i + 56, 966); x.lineTo(i + 28, 1024); x.fill(); }
        x.fillStyle = 'rgba(226,232,240,.55)'; x.font = '900 46px monospace'; x.fillText('SOUTE C-7', 1024, 700);
        x.fillStyle = 'rgba(248,113,113,.6)'; x.font = '900 30px monospace'; x.fillText('☢ ZONE DE NEUTRALISATION', 800, 940);
        
    });
    mur(THREE, scene, c, hublots, { metal: .5, rugo: .6 });
    cotes(THREE, scene, toile(512, 512, (x, w, h) => { x.fillStyle = '#1a2233'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(0,0,0,.5)'; x.strokeRect(i * 128 + 4, 30, 120, 450); rivets(x, i * 128 + 4, 30, 120, 450, 20, 'rgba(203,213,225,.3)'); } }));
    // encadrement des hublots
    const cadre = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: .85, roughness: .35 });
    hublots.forEach(t => {
        const anneau = new THREE.Mesh(new THREE.TorusGeometry(t.r, .22, 14, 64), cadre); anneau.position.set(t.x, t.y, -9.85); scene.add(anneau);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), cadre); b.position.set(t.x + Math.cos(a) * (t.r + .1), t.y + Math.sin(a) * (t.r + .1), -9.65); scene.add(b); }
        const vitre = new THREE.Mesh(new THREE.CircleGeometry(t.r, 48), new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: .08, metalness: 1, roughness: 0 }));
        vitre.position.set(t.x, t.y, -9.95); scene.add(vitre);
    });
    // l'espace derrière : étoiles qui défilent + planète qui tourne
    const ciel = toile(1024, 512, (x, w, h) => { x.fillStyle = '#01030a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .9 + .1})`; const s = Math.random() < .05 ? 2.2 : 1; x.fillRect(Math.random() * w, Math.random() * h, s, s); } const gr = x.createRadialGradient(700, 200, 0, 700, 200, 260); gr.addColorStop(0, 'rgba(124,58,237,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
    const tc = texture(THREE, ciel, 1, 1); tc.wrapS = THREE.RepeatWrapping;
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), basique(THREE, 0xffffff, { map: tc, fog: false }));
    fond.position.set(0, 4, -16); scene.add(fond);
    const surface = toile(512, 256, (x, w, h) => { const cs = ['#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#4c1d95']; for (let y = 0; y < h; y += 6) { x.fillStyle = cs[Math.floor(Math.random() * cs.length)]; x.fillRect(0, y, w, 6 + Math.random() * 8); } bruit(x, w, h, 3000, '#000', 4); });
    const planete = new THREE.Mesh(new THREE.SphereGeometry(2.2, 48, 32), new THREE.MeshStandardMaterial({ map: texture(THREE, surface), roughness: 1, fog: false }));
    planete.position.set(8.4, 2.6, -15); scene.add(planete);
    const anneaux = new THREE.Mesh(new THREE.RingGeometry(2.8, 4, 64), basique(THREE, 0xc4b5fd, { side: THREE.DoubleSide, transparent: true, opacity: .45, fog: false }));
    anneaux.position.copy(planete.position); anneaux.rotation.set(1.25, .2, .3); scene.add(anneaux);
    const soleil = new THREE.DirectionalLight(0xffe4c4, .9); soleil.position.set(-4, 2, -8); soleil.target = planete; scene.add(soleil);
    const vaisseau = new THREE.Mesh(new THREE.ConeGeometry(.12, .5, 6), basique(THREE, 0xe2e8f0, { fog: false })); vaisseau.rotation.z = -Math.PI / 2; vaisseau.position.set(-12, 3.8, -15.5); scene.add(vaisseau);
    ctx.anims.push(now => {
        tc.offset.x = (now / 90000) % 1; planete.rotation.y = now / 9000;
        const k = (now % 24000) / 24000; vaisseau.position.x = -12 + k * 26; vaisseau.visible = k < .7;
    });
    // néons
    const neonM = basique(THREE, 0x22d3ee);
    [[0, 6.0], [0, -1.05]].forEach(([x0, y]) => { const n = new THREE.Mesh(new THREE.BoxGeometry(28, .06, .06), neonM); n.position.set(x0, y, -9.8); scene.add(n); });
    const neonL = lumiere(THREE, scene, 0x22d3ee, .9, 16, 0, 6, -7);
    ctx.anims.push(now => { neonL.intensity = .9 + .06 * Math.sin(now / 90); });
    // caisses de cargaison
    const caisse = toile(256, 256, (x, w, h) => {
        x.fillStyle = '#3f3f46'; x.fillRect(0, 0, w, h); x.fillStyle = '#52525b'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 32 + 2, w, 26);
        x.strokeStyle = '#f59e0b'; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14);
        x.fillStyle = '#fbbf24'; x.font = '900 40px monospace'; x.textAlign = 'center'; x.fillText('CARGO', 128, 120); x.font = '700 26px monospace'; x.fillText('C-' + Math.floor(10 + Math.random() * 89), 128, 160);
        bruit(x, w, h, 900, '#000', 3);
    });
    const mc = new THREE.MeshStandardMaterial({ map: texture(THREE, caisse), metalness: .5, roughness: .6 });
    [[-7.6, -1.6, -5.2, 1.6, .2], [-5.9, -1.6, -5.6, 1.4, -.15], [-7, 0, -5.4, 1.3, .4], [-4.6, -1.6, -3.8, 1.0, .5]].forEach(([x, y, z, s, r]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mc); b.position.set(x, y + s / 2, z); b.rotation.y = r; b.castShadow = b.receiveShadow = true; scene.add(b);
    });
    poser(THREE, scene, charger, 'chariot', { h: 2.1, p: [6.2, -1.6, -4], r: -.7 });
    poser(THREE, scene, charger, 'extincteur', { h: 1.4, p: [-3.4, -1.6, -6.5], r: .5 });
    poser(THREE, scene, charger, 'alarme', { h: .7, p: [-2.9, 2.9, -10], mur: 1 });
    poser(THREE, scene, charger, 'camera', { h: .9, p: [11, 4.1, -9], r: -.7 });
}

// =====================================================================
//  2) SALLE DES MACHINES
// =====================================================================
function machines(THREE, scene, ctx, charger) {
    sol(THREE, ctx, (x, w, h) => {
        x.fillStyle = '#1c1712'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 512; i += 12) for (let j = 0; j < 512; j += 24) { x.fillStyle = 'rgba(255,255,255,.05)'; x.save(); x.translate(i + (j / 24 % 2) * 6, j); x.rotate(.6); x.fillRect(-4, -1, 8, 2.5); x.restore(); }
        x.fillStyle = 'rgba(245,158,11,.5)'; x.fillRect(0, 0, 512, 6); bruit(x, w, h, 2500, '#000', 4);
    }, 5);
    const c = toile(2048, 1024, (x, w, h) => {
        x.fillStyle = '#2a211b'; x.fillRect(0, 0, w, h);
        for (let j = 0; j < h; j += 40) for (let i = -((j / 40) % 2) * 50; i < w; i += 100) { const v = 30 + Math.random() * 14; x.fillStyle = `rgb(${v + 22},${v + 10},${v})`; x.fillRect(i + 2, j + 2, 96, 36); }
        bruit(x, w, h, 9000, '#000', 3);
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        for (let i = -40; i < w + 40; i += 56) { x.fillStyle = (i / 56) % 2 ? '#d97706' : '#1c1917'; x.beginPath(); x.moveTo(i, 1024); x.lineTo(i + 28, 976); x.lineTo(i + 56, 976); x.lineTo(i + 28, 1024); x.fill(); }
        x.fillStyle = '#b45309'; x.fillRect(840, 830, 380, 70); x.fillStyle = '#1c1917'; x.font = '900 40px monospace'; x.textAlign = 'center'; x.fillText('⚠ HAUTE PRESSION', 1030, 880);
    });
    mur(THREE, scene, c, null, { rugo: .95 });
    cotes(THREE, scene, toile(512, 512, (x, w, h) => { x.fillStyle = '#241c17'; x.fillRect(0, 0, w, h); for (let j = 0; j < h; j += 20) for (let i = -((j / 20) % 2) * 25; i < w; i += 50) { x.fillStyle = '#33281f'; x.fillRect(i + 1, j + 1, 48, 18); } }));
    // conduites : texture métal du kit si elle charge, sinon couleur unie
    const tl = new THREE.TextureLoader(), tx = tl.load(DOSSIER + 'tuyaux/tx/modular_pipes_metal_diff.jpg');
    tx.encoding = THREE.sRGBEncoding; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(10, 1);
    const metal = new THREE.MeshStandardMaterial({ map: tx, color: 0xe7e5e4, metalness: .25, roughness: .5 });
    const cuivre = new THREE.MeshStandardMaterial({ map: tx, color: 0xe0915a, metalness: .3, roughness: .45 });
    const vert = new THREE.MeshStandardMaterial({ color: 0x3f6b4a, metalness: .4, roughness: .6 });
    const bride = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: .35, roughness: .45 });
    const z1 = -9.45, z2 = -8.9, z3 = -8.4;
    conduite(THREE, scene, [[-15, 4.0, z1], [-4.6, 4.0, z1], [-4.6, 1.4, z1], [-4.6, 1.4, z3], [-4.6, -1.6, z3]], .34, metal, bride);
    conduite(THREE, scene, [[-15, 2.8, z2], [-8.2, 2.8, z2], [-8.2, -1.6, z2]], .26, cuivre, bride);
    conduite(THREE, scene, [[15, 4.3, z1], [-2.4, 4.3, z1], [-2.4, 9.5, z1]], .3, metal, bride);
    conduite(THREE, scene, [[15, 3.4, z2], [7.6, 3.4, z2], [7.6, 1.6, z2], [4.6, 1.6, z2], [4.6, -1.6, z2]], .3, vert, bride);
    conduite(THREE, scene, [[15, 2.2, z1], [10.2, 2.2, z1], [10.2, -1.6, z1]], .4, metal, bride);
    conduite(THREE, scene, [[2.2, 9.5, z2], [2.2, 2.9, z2], [-1.2, 2.9, z2], [-1.2, 9.5, z2]], .16, cuivre, bride);
    // colliers muraux
    const collier = new THREE.MeshStandardMaterial({ color: 0x292524, metalness: .7, roughness: .5 });
    [[-11, 4.0], [-7, 4.0], [-11, 2.8], [6, 4.3], [11, 4.3], [12, 3.4], [12.4, 2.2]].forEach(([x, y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.16, .9, .9), collier); b.position.set(x, y, -9.55); scene.add(b); });
    // cuve / chaudière sur la droite
    const cuve = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 32), new THREE.MeshStandardMaterial({ map: tx, color: 0xd6d3d1, metalness: .3, roughness: .5 }));
    cuve.position.set(12.2, .2, -7.4); cuve.castShadow = true; scene.add(cuve);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), cuve.material); dome.position.set(12.2, 2, -7.4); scene.add(dome);
    [-.9, .9].forEach(dy => { const a = new THREE.Mesh(new THREE.TorusGeometry(1.32, .06, 8, 40), bride); a.rotation.x = Math.PI / 2; a.position.set(12.2, .2 + dy, -7.4); scene.add(a); });
    // vannes et manomètres
    const volants = [vanne(THREE, scene, [-4.6, 2.6, z1], 0xb91c1c), vanne(THREE, scene, [-8.2, 1.2, z2], 0x1d4ed8), vanne(THREE, scene, [10.2, .6, z1], 0xb91c1c), vanne(THREE, scene, [4.6, .2, z2], 0xca8a04)];
    ctx.anims.push(now => { volants[1].rotation.z = Math.sin(now / 2600) * .4; });
    manometre(THREE, scene, [-6.4, 2.0, -9.5], ctx.anims, ctx.chrono);
    manometre(THREE, scene, [8.8, 2.5, -9.4], ctx.anims, ctx.chrono);
    manometre(THREE, scene, [12.2, .9, -6.05], ctx.anims, ctx.chrono);
    vapeur(THREE, scene, [-2.4, 3.4, -9.0], ctx.anims, [0, .6, .5]);
    vapeur(THREE, scene, [7.6, 2.4, -8.6], ctx.anims, [-.3, .8, .4]);
    vapeur(THREE, scene, [-8.2, .2, -8.6], ctx.anims, [.4, .5, .5]);
    // lumière chaude qui vacille un peu
    const feu = lumiere(THREE, scene, 0xff8a3d, 1.4, 18, 9, 1.5, -6);
    const lampe = lumiere(THREE, scene, 0xffb36b, .8, 16, -6, 7, -7);
    ctx.anims.push(now => { feu.intensity = 1.25 + Math.sin(now / 130) * .1 + Math.sin(now / 47) * .06; });
    poser(THREE, scene, charger, 'chariot', { h: 2.1, p: [6.4, -1.6, -3.2], r: -.9 });
    poser(THREE, scene, charger, 'extincteur', { h: 1.4, p: [-6.6, -1.6, -6.8], r: .6 });
    poser(THREE, scene, charger, 'alarme', { h: .7, p: [-11.8, 1.2, -10], mur: 1 });
    poser(THREE, scene, charger, 'lampe', { h: 1.1, p: [-6.4, 4.4, -6.5], plafond: 1 });
}

// =====================================================================
//  3) SALLE DE CONTRÔLE
// =====================================================================
function controle(THREE, scene, ctx, charger) {
    sol(THREE, ctx, (x, w, h) => {
        x.fillStyle = '#0d1117'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#10161f' : '#0f141c'; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); }
        x.fillStyle = 'rgba(59,130,246,.18)'; x.fillRect(0, 254, 512, 4);
    }, 6);
    const c = toile(2048, 1024, (x, w, h) => {
        x.fillStyle = '#1f2937'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += 128) { x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(i, 0, 2, h); }
        x.fillStyle = '#0b0f16'; x.fillRect(0, 900, w, 124);
        x.fillStyle = 'rgba(96,165,250,.6)'; x.font = '900 40px monospace'; x.textAlign = 'center'; x.fillText('CENTRE DE SURVEILLANCE · NIVEAU −3', 1024, 60);
    });
    mur(THREE, scene, c, null, { metal: .4, rugo: .7 });
    cotes(THREE, scene, toile(256, 256, (x, w, h) => { x.fillStyle = '#121822'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 2, h); }));
    // écrans : chacun a son type de contenu, redessiné quelques fois par seconde
    const TYPES = ['radar', 'courbe', 'alerte', 'barres', 'journal', 'onde', 'carte', 'camera', 'radar', 'barres', 'courbe', 'journal'];
    const ecrans = [], cadreM = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: .6, roughness: .5 });
    const cols = [-11.4, -8.4, -5.4, 5.4, 8.4, 11.4], rangs = [3.7, 1.5];
    let k = 0;
    rangs.forEach(y => cols.forEach(xx => {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
        const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
        const cadre = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, .18), cadreM); cadre.position.set(xx, y, -9.85); scene.add(cadre);
        const e = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.62), basique(THREE, 0xffffff, { map: t })); e.position.set(xx, y, -9.74); scene.add(e);
        ecrans.push({ cv: cv, x: cv.getContext('2d'), t: t, type: TYPES[k % TYPES.length], g: Math.random() * 100, data: [] }); k++;
    }));
    // grand écran central au-dessus de la charge : état de la charge
    const gc = document.createElement('canvas'); gc.width = 512; gc.height = 160; const gt = new THREE.CanvasTexture(gc); gt.encoding = THREE.sRGBEncoding;
    const gcadre = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.4, .18), cadreM); gcadre.position.set(0, 3.5, -9.85); scene.add(gcadre);
    const ge = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.25), basique(THREE, 0xffffff, { map: gt })); ge.position.set(0, 3.5, -9.74); scene.add(ge);
    const lueur = lumiere(THREE, scene, 0x3b82f6, .9, 14, 0, 4.5, -7);
    lumiere(THREE, scene, 0xcbd5e1, .7, 20, 0, 3, -2);
    let dernier = 0, errVu = 0, flashErr = 0;
    function dessiner(E, now, alerte) {
        const x = E.x, w = 256, h = 160, vert = alerte ? '#f87171' : '#4ade80', bleu = alerte ? '#fca5a5' : '#38bdf8';
        x.fillStyle = alerte ? '#1a0606' : '#03080f'; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(148,163,184,.12)'; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let j = 0; j < h; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
        const t = now / 1000 + E.g;
        if (E.type === 'radar') {
            x.strokeStyle = vert; x.lineWidth = 1.5; [60, 40, 20].forEach(r => { x.beginPath(); x.arc(128, 80, r, 0, 7); x.stroke(); });
            const a = t * 2; x.fillStyle = alerte ? 'rgba(248,113,113,.25)' : 'rgba(74,222,128,.25)'; x.beginPath(); x.moveTo(128, 80); x.arc(128, 80, 64, a - .6, a); x.fill();
            x.fillStyle = vert; [[30, 1.2], [48, 3.9], [22, 5.1]].forEach(([r, b]) => { const al = Math.max(0, 1 - (((a - b) % 6.283) + 6.283) % 6.283 / 3); x.globalAlpha = al; x.beginPath(); x.arc(128 + Math.cos(b) * r, 80 + Math.sin(b) * r, 4, 0, 7); x.fill(); }); x.globalAlpha = 1;
        } else if (E.type === 'courbe' || E.type === 'onde') {
            x.strokeStyle = E.type === 'onde' ? bleu : vert; x.lineWidth = 2; x.beginPath();
            for (let i = 0; i <= w; i += 4) { const v = E.type === 'onde' ? Math.sin(i / 14 + t * 5) * 30 * (alerte ? 1.6 : 1) * Math.sin(i / 60 + t) : Math.sin(i / 30 + t) * 20 + Math.sin(i / 9 + t * 3) * 8; i ? x.lineTo(i, 80 + v) : x.moveTo(i, 80 + v); } x.stroke();
        } else if (E.type === 'barres') {
            for (let i = 0; i < 8; i++) { const v = (Math.sin(t * 2 + i) * .5 + .5) * (alerte ? 130 : 100) + 10; x.fillStyle = v > 110 ? '#f87171' : bleu; x.fillRect(14 + i * 30, h - 12 - v, 20, v); }
        } else if (E.type === 'journal') {
            x.font = '12px monospace'; x.fillStyle = vert;
            for (let i = 0; i < 9; i++) { const n = Math.floor(t * 2) + i; x.fillText(`> ${['SCAN', 'SYNC', 'PING', 'CHK', 'LOG', 'ACK'][n % 6]} ${(n * 7919 % 9000 + 1000).toString(16).toUpperCase()} ${alerte && i > 6 ? 'ERREUR' : 'OK'}`, 10, 18 + i * 16); }
        } else if (E.type === 'alerte') {
            const on = Math.floor(t * (alerte ? 4 : 1)) % 2;
            x.fillStyle = on ? (alerte ? '#dc2626' : '#b45309') : '#1c1917'; x.fillRect(20, 20, 216, 120);
            x.fillStyle = '#fff'; x.font = '900 46px sans-serif'; x.textAlign = 'center'; x.fillText('☢', 128, 82); x.font = '900 18px monospace'; x.fillText(alerte ? 'CRITIQUE' : 'VIGILANCE', 128, 122); x.textAlign = 'left';
        } else if (E.type === 'carte') {
            x.strokeStyle = bleu; x.lineWidth = 1.5; x.strokeRect(30, 25, 80, 50); x.strokeRect(120, 25, 100, 50); x.strokeRect(30, 85, 190, 50);
            x.fillStyle = Math.floor(t * 3) % 2 ? '#f87171' : 'rgba(0,0,0,0)'; x.beginPath(); x.arc(168, 50, 7, 0, 7); x.fill();
        } else if (E.type === 'camera') {
            x.fillStyle = '#0f172a'; x.fillRect(0, 0, w, h); x.fillStyle = '#334155'; x.fillRect(90, 60 + Math.sin(t) * 4, 80, 50);
            for (let j = 0; j < h; j += 3) { x.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; x.fillRect(0, j, w, 1); }
            x.fillStyle = '#f87171'; x.font = '12px monospace'; x.fillText('● REC  CAM-0' + (1 + (E.g | 0) % 8), 10, 16);
        }
        E.t.needsUpdate = true;
    }
    ctx.anims.push(now => {
        const ch = ctx.chrono;
        if (ch.err > errVu) { errVu = ch.err; flashErr = now; }
        const alerte = (ch.s && ch.s < 30 && !ch.fini) || now - flashErr < 2500 || ch.fini === 'boum';
        lueur.color.setHex(alerte ? 0xef4444 : 0x3b82f6); lueur.intensity = alerte ? .8 + .5 * (Math.sin(now / 120) * .5 + .5) : .9;
        if (now - dernier < 110) return; dernier = now;
        ecrans.forEach(E => dessiner(E, now, alerte));
        const x = gc.getContext('2d'); x.fillStyle = alerte ? '#1a0606' : '#020617'; x.fillRect(0, 0, 512, 160);
        x.textAlign = 'center'; x.fillStyle = alerte ? '#f87171' : '#38bdf8'; x.font = '700 22px monospace';
        x.fillText(ch.fini === 'ok' ? 'CHARGE NEUTRALISÉE' : ch.fini === 'boum' ? 'PERTE DU SIGNAL' : alerte ? '⚠ ALERTE · CHARGE INSTABLE ⚠' : 'SUIVI DE LA CHARGE', 256, 40);
        x.font = '900 64px monospace'; x.fillStyle = ch.fini === 'ok' ? '#4ade80' : alerte ? '#ef4444' : '#e2e8f0';
        const s = Math.max(0, ch.s || 0); x.fillText(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`, 256, 112);
        x.font = '700 18px monospace'; x.fillStyle = '#94a3b8'; x.fillText(`ERREURS ${ch.err || 0}/${(ch.max || 3) - 1}`, 256, 146);
        gt.needsUpdate = true;
    });
    // pupitres sous les écrans
    const pup = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: .5, roughness: .6 });
    [-8.4, 8.4].forEach(x0 => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.4, 1.6), pup); p.position.set(x0, -.9, -8.7); p.castShadow = p.receiveShadow = true; scene.add(p);
        const dessus = new THREE.Mesh(new THREE.BoxGeometry(9.4, .1, 1.9), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: .3, roughness: .4 })); dessus.position.set(x0, -.15, -8.6); dessus.rotation.x = .18; scene.add(dessus);
        for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.18, .06, .14), basique(THREE, [0x22c55e, 0xef4444, 0xf59e0b, 0x3b82f6][i % 4])); b.position.set(x0 - 4 + i * .47, -.06, -8.3 + (i % 2) * .25); b.userData.p = Math.random() * 5; scene.add(b); ctx.anims.push(now => { b.visible = Math.sin(now / 400 + b.userData.p * 7) > -.6; }); }
    });
    // lampes-cages suspendues qui oscillent doucement
    [[-6.5, -6.5], [6.5, -6.5]].forEach(([x0, z0], i) => {
        const l = lumiere(THREE, scene, 0xfde68a, .7, 10, x0, 5, z0);
        poser(THREE, scene, charger, 'lampe', { h: 1, p: [x0, 4.6, z0], plafond: 1 }, g => {
            const fil = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 6), basique(THREE, 0x111111)); fil.position.set(x0, 7.6, z0); scene.add(fil);
            ctx.anims.push(now => { g.rotation.z = Math.sin(now / 1400 + i) * .03; });
        });
    });
    // caméra de surveillance qui balaie la pièce
    poser(THREE, scene, charger, 'camera', { h: .9, p: [12.5, 4.3, -8.6], r: -.5 }, g => { ctx.anims.push(now => { g.rotation.y = -.5 + Math.sin(now / 2600) * .45; }); });
    poser(THREE, scene, charger, 'horloge', { h: .9, p: [-14, 3.2, -10], mur: 1 });
    poser(THREE, scene, charger, 'extincteur', { h: 1.4, p: [-14, -1.6, -6], r: .9 });
}

// =====================================================================
//  4) BUNKER ABANDONNÉ
// =====================================================================
function bunker(THREE, scene, ctx, charger) {
    scene.fog.color.setHex(0x040405); scene.background.setHex(0x040405); scene.fog.near = 9; scene.fog.far = 24;
    sol(THREE, ctx, (x, w, h) => {
        x.fillStyle = '#2a2a2b'; x.fillRect(0, 0, w, h); bruit(x, w, h, 12000, '#000', 3); bruit(x, w, h, 4000, '#fff', 2);
        x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.strokeRect(0, 0, 512, 512); x.beginPath(); x.moveTo(256, 0); x.lineTo(256, 512); x.moveTo(0, 256); x.lineTo(512, 256); x.stroke();
        x.fillStyle = 'rgba(30,20,10,.35)'; [[120, 340, 60], [400, 120, 45]].forEach(([a, b, r]) => { x.beginPath(); x.ellipse(a, b, r, r * .6, .4, 0, 7); x.fill(); });
    }, 4);
    ctx.sol.material.metalness = .1; ctx.sol.material.roughness = .95;
    const fissure = (x, x0, y0, n) => { x.strokeStyle = 'rgba(0,0,0,.75)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(x0, y0); let a = x0, b = y0; for (let i = 0; i < n; i++) { a += (Math.random() - .5) * 50; b += 18 + Math.random() * 30; x.lineTo(a, b); } x.stroke(); };
    const c = toile(2048, 1024, (x, w, h) => {
        x.fillStyle = '#3a3a3c'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += 256) for (let j = 0; j < h; j += 170) { x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 2; x.strokeRect(i, j, 256, 170); x.fillStyle = 'rgba(0,0,0,.25)'; [[20, 20], [236, 20], [20, 150], [236, 150]].forEach(([a, b]) => { x.beginPath(); x.arc(i + a, j + b, 5, 0, 7); x.fill(); }); }
        bruit(x, w, h, 25000, '#000', 3); bruit(x, w, h, 8000, '#fff', 2);
        for (let i = 0; i < 14; i++) { const gx = Math.random() * w; const gr = x.createLinearGradient(gx, 0, gx, 600); gr.addColorStop(0, 'rgba(60,40,20,.35)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = gr; x.fillRect(gx, 0, 20 + Math.random() * 40, 400 + Math.random() * 300); }
        fissure(x, 600, 100, 14); fissure(x, 1500, 60, 18); fissure(x, 1200, 500, 9);
        x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(0, 900, w, 124);
        x.fillStyle = 'rgba(234,179,8,.65)'; x.font = '900 70px monospace'; x.textAlign = 'center'; x.fillText('ABRI B-12', 1024, 700);
        x.fillStyle = 'rgba(220,38,38,.55)'; x.font = '900 36px monospace'; x.fillText('ACCÈS INTERDIT', 1024, 748);
        x.fillStyle = 'rgba(255,255,255,.18)'; x.font = '700 30px monospace'; x.fillText('|||| |||| ||', 1500, 640);
    });
    mur(THREE, scene, c, null, { metal: .05, rugo: 1 });
    cotes(THREE, scene, toile(512, 512, (x, w, h) => { x.fillStyle = '#323234'; x.fillRect(0, 0, w, h); bruit(x, w, h, 6000, '#000', 3); }));
    // lampe-cage qui grésille (la seule vraie lumière de la pièce)
    const grille = lumiere(THREE, scene, 0xfff1c1, 2.2, 18, 2.6, 3.2, -5);
    let panne = 0;
    ctx.anims.push(now => {
        if (now > panne && Math.random() < .015) panne = now + 80 + Math.random() * 380;
        grille.intensity = now < panne ? (Math.random() < .5 ? .08 : .8) : 2 + Math.sin(now / 60) * .08;
    });
    poser(THREE, scene, charger, 'lampe', { h: 1.1, p: [2.6, 4.0, -5], plafond: 1 }, g => {
        const fil = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 6), basique(THREE, 0x111111)); fil.position.set(2.6, 7, -5); scene.add(fil);
        ctx.anims.push(now => { g.rotation.z = Math.sin(now / 1100) * .05; g.rotation.x = Math.sin(now / 1700) * .04; grille.position.x = 2.6 + Math.sin(now / 1100) * .25; });
    });
    // ventilateur au plafond, pales qui tournent
    poser(THREE, scene, charger, 'ventilateur', { h: 3.2, taille: 'l', p: [-5.6, 4.3, -8.5], plafond: 1 }, (g, o) => {
        let pales = null; o.traverse(n => { if (/blade/i.test(n.name || '')) pales = pales || n; });
        ctx.anims.push(now => { if (pales) pales.rotation.y = now / 260; });
    });
    // lueur rouge de secours qui tourne au-dessus d'une porte
    const gyro = new THREE.SpotLight(0xff2020, 2.5, 18, .4, .6); gyro.position.set(-9.6, 3.3, -9.4); scene.add(gyro); scene.add(gyro.target);
    const bulbe = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 10), basique(THREE, 0xff3030)); bulbe.position.copy(gyro.position); scene.add(bulbe);
    ctx.anims.push(now => { const a = now / 500; gyro.target.position.set(-9.6 + Math.cos(a) * 6, -1.6, -6 + Math.sin(a) * 4); });
    poser(THREE, scene, charger, 'porte', { h: 4.4, p: [-9.6, -1.6, -10], mur: 1 });
    poser(THREE, scene, charger, 'porte', { h: 4.4, p: [9.6, -1.6, -10], mur: 1 });
    poser(THREE, scene, charger, 'panneau', { h: 1.2, p: [-4.4, -1.6, -2.6], r: .5 });
    poser(THREE, scene, charger, 'poubelle', { h: 1.6, p: [6.2, -1.6, -6.6], r: -.4 });
    poser(THREE, scene, charger, 'extincteur', { h: 1.4, p: [-6.8, -1.6, -8.6], r: .3 });
    poser(THREE, scene, charger, 'alarme', { h: .7, p: [4.6, 2.6, -10], mur: 1 });
    poser(THREE, scene, charger, 'horloge', { h: 1, p: [-5.2, 3.0, -10], mur: 1 }, g => { g.rotation.z = -.12; });
}

const DECORS = { soute: soute, machines: machines, controle: controle, bunker: bunker };
W.DS_DECORS = function (THREE, scene, ctx) {
    const nom = DECORS[ctx.nom] ? ctx.nom : NOMS[Math.floor(Math.random() * NOMS.length)];
    try { DECORS[nom](THREE, scene, ctx, chargeur(THREE)); } catch (e) { console.error('Décor', nom, e); }
    return nom;
};
W.DS_DECORS.noms = NOMS;
})();
