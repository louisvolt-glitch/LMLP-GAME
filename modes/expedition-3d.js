// =====================================================================
//  « EXPÉDITION SUR L'ÉPAVE » : partie 3D (Three.js r128 + GLTFLoader).
//  Tout est facultatif : si la 3D ne charge pas, le mode reste jouable.
//    EX3D.charger()            -> promesse (moteur 3D prêt ou non)
//    EX3D.scene(el, {video})   -> le couloir de l'épave vu depuis le sas : .maj(e), .gemmes([{de,a,k}]), .porte(bool), .alarme(couleur)
//    EX3D.objet(el, nom, opts) -> petite vitrine qui fait tourner un modèle (cristal, relique, sac, coffre)
//  Modèles : expedition-web/modeles/*.glb
// =====================================================================
(function () {
const W = window, DOSSIER = './expedition-web/modeles/';
const EX3D = W.EX3D = { pret: false };
let promesse = null;

function script(src) {
    if (typeof W.sysChargerScript === 'function') return W.sysChargerScript(src);
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
}
EX3D.charger = function () {
    if (promesse) return promesse;
    promesse = (W.THREE ? Promise.resolve() : script('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js').catch(() => script('./bibliotheques/three.min.js')))
        .then(() => W.THREE.GLTFLoader ? null : script('./bibliotheques/GLTFLoader.js'))
        .then(() => { EX3D.pret = !!(W.THREE && W.THREE.GLTFLoader); return EX3D.pret; })
        .catch(() => false);
    return promesse;
};

// ---- chargement des modèles (fichier mis en cache ; chaque usage reçoit sa propre copie) ----
const tampons = {};
function tampon(nom) {
    return tampons[nom] || (tampons[nom] = fetch(DOSSIER + nom + '.glb').then(r => { if (!r.ok) throw new Error(nom); return r.arrayBuffer(); }));
}
function modele(nom) {
    return tampon(nom).then(buf => new Promise((ok, ko) => new W.THREE.GLTFLoader().parse(buf, DOSSIER, ok, ko)));
}
function cadrer(THREE, objet, hauteur) {
    const b = new THREE.Box3().setFromObject(objet), t = b.getSize(new THREE.Vector3());
    const k = hauteur / (Math.max(t.x, t.y, t.z) || 1); objet.scale.multiplyScalar(k);
    const b2 = new THREE.Box3().setFromObject(objet), c = b2.getCenter(new THREE.Vector3());
    objet.position.x -= c.x; objet.position.z -= c.z; objet.position.y -= b2.min.y;
    return objet;
}
function rendu(el, alpha) {
    const THREE = W.THREE, r = new THREE.WebGLRenderer({ antialias: true, alpha: !!alpha, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(2, W.devicePixelRatio || 1)); r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(r.domElement); return r;
}
function taille(r, cam, el) { const w = el.clientWidth || 1, h = el.clientHeight || 1; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }

// =====================================================================
//  Vitrine : un objet qui tourne et flotte (cristal, relique, sac, coffre)
// =====================================================================
EX3D.objet = function (el, nom, opts) {
    opts = opts || {};
    const THREE = W.THREE; if (!THREE) return null;
    const r = rendu(el, true), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .05, 50);
    cam.position.set(0, .55, 3.1); cam.lookAt(0, .45, 0);
    sc.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 1.1));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(2, 3, 3); sc.add(d);
    const lueur = new THREE.PointLight(opts.lueur || 0x67e8f9, 1.6, 4); lueur.position.set(0, .4, .9); sc.add(lueur);
    const pivot = new THREE.Group(); sc.add(pivot);
    let actuel = null, nomActuel = '', mort = false, t0 = performance.now(), saut = 0;
    function changer(n, h) {
        if (n === nomActuel) return; nomActuel = n;
        modele(n).then(g => {
            if (mort || nomActuel !== n) return;
            if (actuel) pivot.remove(actuel);
            actuel = cadrer(THREE, g.scene, h || opts.hauteur || 1); pivot.add(actuel); saut = performance.now();
        }).catch(() => {});
    }
    changer(nom);
    const ro = new ResizeObserver(() => taille(r, cam, el)); ro.observe(el); taille(r, cam, el);
    (function boucle() {
        if (mort) return; requestAnimationFrame(boucle);
        const t = (performance.now() - t0) / 1000, s = Math.min(1, (performance.now() - saut) / 450);
        pivot.rotation.y = t * (opts.vitesse || .8); pivot.position.y = Math.sin(t * 1.7) * .05;
        pivot.scale.setScalar(.6 + .4 * (1 - Math.pow(1 - s, 3)) + (s < 1 ? Math.sin(s * Math.PI) * .12 : 0));
        lueur.intensity = 1.4 + Math.sin(t * 3) * .4;
        r.render(sc, cam);
    })();
    return {
        changer: changer,
        lueur: c => lueur.color.setHex(c),
        detruire() { mort = true; ro.disconnect(); r.dispose(); if (r.domElement.parentNode) r.domElement.remove(); }
    };
};

// =====================================================================
//  Scène de l'équipage : le couloir de l'épave vu depuis le sas de notre vaisseau.
//  Au fond : la porte de la salle (la vidéo de la salle y est projetée).
//  Devant : le sas éclairé où attendent ceux qui sont rentrés.
// =====================================================================
const ANIM = { attente: 'idle', marche: 'walk', course: 'run', peur: 'scared_01', joie: 'cheer' };
function toile(w, h, dessin) {
    const THREE = W.THREE, c = document.createElement('canvas'); c.width = w; c.height = h; dessin(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
}
function salissure(x, w, h, n, a) {
    for (let i = 0; i < n; i++) { const v = Math.random() < .5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    for (let i = 0; i < n / 40; i++) { x.strokeStyle = `rgba(0,0,0,${Math.random() * a * 2})`; x.lineWidth = 1; x.beginPath(); const px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); x.lineTo(px + (Math.random() - .5) * 60, py + (Math.random() - .5) * 60); x.stroke(); }
}
function texSol() {
    return toile(512, 512, (x, w, h) => {
        x.fillStyle = '#2b313b'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const px = i * 128, py = j * 128, g = x.createLinearGradient(px, py, px + 128, py + 128);
            const b = 38 + Math.random() * 14; g.addColorStop(0, `rgb(${b + 6},${b + 10},${b + 16})`); g.addColorStop(1, `rgb(${b - 8},${b - 6},${b - 2})`);
            x.fillStyle = g; x.fillRect(px + 3, py + 3, 122, 122);
            if ((i + j) % 3 === 0) { x.fillStyle = 'rgba(255,255,255,.05)'; for (let a = 0; a < 122; a += 12) for (let c = 0; c < 122; c += 12) { x.save(); x.translate(px + 8 + a, py + 8 + c); x.rotate((a + c) % 24 ? .8 : -.8); x.fillRect(-4, -1, 8, 2); x.restore(); } }
            x.fillStyle = '#11151b'; [[6, 6], [116, 6], [6, 116], [116, 116]].forEach(([a, c]) => { x.beginPath(); x.arc(px + a + 3, py + c + 3, 3.2, 0, 7); x.fill(); x.fillStyle = '#6b7280'; x.beginPath(); x.arc(px + a + 2.4, py + c + 2.4, 1.3, 0, 7); x.fill(); x.fillStyle = '#11151b'; });
        }
        salissure(x, w, h, 5000, .18);
        const r = x.createRadialGradient(w * .7, h * .3, 10, w * .7, h * .3, 200); r.addColorStop(0, 'rgba(60,30,10,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, w, h);
    });
}
function texMur() {
    return toile(512, 512, (x, w, h) => {
        x.fillStyle = '#262c36'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) {
            const px = i * 128; x.fillStyle = i % 2 ? '#2f3642' : '#2a303b'; x.fillRect(px + 4, 4, 120, 300);
            x.fillStyle = '#20252e'; x.fillRect(px + 4, 316, 120, 190);
            x.fillStyle = 'rgba(0,0,0,.45)'; for (let k = 0; k < 6; k++) x.fillRect(px + 20, 340 + k * 14, 88, 6);
            x.strokeStyle = 'rgba(255,255,255,.06)'; x.strokeRect(px + 8.5, 8.5, 111, 291);
        }
        x.fillStyle = '#e0a800'; x.fillRect(150, 140, 50, 22); x.fillStyle = '#111'; x.font = 'bold 13px monospace'; x.fillText('B-07', 155, 156);
        salissure(x, w, h, 4000, .2);
        const g = x.createLinearGradient(0, h, 0, h * .6); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
}
function texDanger() {
    return toile(256, 64, (x, w, h) => {
        x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8b400';
        for (let i = -64; i < w; i += 32) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 16, h); x.lineTo(i + 16 + h, 0); x.lineTo(i + h, 0); x.fill(); }
        salissure(x, w, h, 900, .35);
    });
}
function texCone() {
    const t = toile(4, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.75, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    t.encoding = W.THREE.LinearEncoding; return t;
}

EX3D.scene = function (el, opts) {
    opts = opts || {};
    const THREE = W.THREE; if (!THREE) return null;
    const r = rendu(el, false), sc = new THREE.Scene();
    const FOND = new THREE.Color(0x05080f); sc.background = FOND.clone(); sc.fog = new THREE.FogExp2(0x05080f, .075);
    const cam = new THREE.PerspectiveCamera(54, 1, .1, 60), camBase = new THREE.Vector3(0, 1.95, 5.7), camVise = new THREE.Vector3(0, 1.2, -6);
    const metal = (c, m, ro) => new THREE.MeshStandardMaterial({ color: c, metalness: m == null ? .75 : m, roughness: ro == null ? .45 : ro });
    const lum = (c, i) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: i == null ? 1.6 : i });
    const ciel = new THREE.HemisphereLight(0x8fa8d8, 0x0a0a12, .35); sc.add(ciel);
    const L = 20, Z0 = 3.6, ZC = Z0 - L / 2;
    // ---- couloir : sol, murs, plafond
    const tSol = texSol(); tSol.repeat.set(1.1, 5);
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(4.4, L), new THREE.MeshStandardMaterial({ map: tSol, metalness: .55, roughness: .62 }));
    sol.rotation.x = -Math.PI / 2; sol.position.set(0, 0, ZC); sc.add(sol);
    const tMur = texMur(); tMur.repeat.set(5, 1);
    [-1, 1].forEach(c => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, 3.2), new THREE.MeshStandardMaterial({ map: tMur, metalness: .6, roughness: .55 })); m.rotation.y = -c * Math.PI / 2; m.position.set(c * 2.2, 1.6, ZC); sc.add(m); });
    const plafond = new THREE.Mesh(new THREE.PlaneGeometry(4.4, L), metal(0x151a22, .7, .6)); plafond.rotation.x = Math.PI / 2; plafond.position.set(0, 3.2, ZC); sc.add(plafond);
    // nervures, tuyaux, bandes lumineuses
    const mNerv = metal(0x3a414d, .85, .38);
    for (let z = .2; z > -15; z -= 2.2) {
        [-1, 1].forEach(c => { const b = new THREE.Mesh(new THREE.BoxGeometry(.28, 3.2, .32), mNerv); b.position.set(c * 2.04, 1.6, z); sc.add(b);
            const eq = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .3), mNerv); eq.position.set(c * 1.85, 2.95, z); eq.rotation.z = c * .785; sc.add(eq); });
        const p = new THREE.Mesh(new THREE.BoxGeometry(4.4, .26, .32), mNerv); p.position.set(0, 3.08, z); sc.add(p);
    }
    const mTuyau = metal(0x6b5a48, .9, .35), mTuyau2 = metal(0x4b5563, .8, .4);
    [[-1.82, 2.7, .09, mTuyau], [-1.62, 2.85, .05, mTuyau2], [1.8, 2.75, .11, mTuyau2], [1.9, .45, .07, mTuyau]].forEach(([x, y, rr, m]) => {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, L, 10), m); t.rotation.x = Math.PI / 2; t.position.set(x, y, ZC); sc.add(t);
    });
    const mBande = lum(0x0891b2, 1.2);
    [-1, 1].forEach(c => { const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, 15.4), mBande); b.position.set(c * 2.16, .06, -7.3); sc.add(b); });
    // plafonniers (certains grésillent)
    const plafonniers = [];
    [-1.2, -5.6, -10].forEach((z, i) => {
        const m = lum(0xcfe8ff, 2); const b = new THREE.Mesh(new THREE.BoxGeometry(1, .05, .3), m); b.position.set(0, 3.05, z); sc.add(b);
        const l = new THREE.PointLight(0xbcd7ff, .9, 7, 1.6); l.position.set(0, 2.8, z); sc.add(l);
        plafonniers.push({ m: m, l: l, base: i === 1 ? .55 : .9, grille: i === 1 });
    });
    // débris et câbles
    const mCaisse = metal(0x4a3f2c, .3, .8);
    [[-1.6, -4.2, .5, .4], [1.55, -6.8, .7, .55], [-1.5, -11.3, .6, .45], [1.6, -12.2, .45, .45], [1.45, -2.4, .35, .3]].forEach(([x, z, s, hh], i) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(s, hh, s * .9), i % 2 ? mCaisse : mNerv); b.position.set(x, hh / 2, z); b.rotation.y = i * .7; sc.add(b);
    });
    const dalle = new THREE.Mesh(new THREE.BoxGeometry(1.1, .05, .7), mNerv); dalle.position.set(-1.3, 1.2, -8.4); dalle.rotation.set(.3, .2, 1.05); sc.add(dalle);
    const mCable = metal(0x111111, .2, .9);
    [[-.9, -3.6], [.6, -8.6], [-.3, -12.8]].forEach(([x, z]) => {
        const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 3.18, z), new THREE.Vector3(x + .3, 2.3, z - .4), new THREE.Vector3(x + .1, 1.9, z - .9), new THREE.Vector3(x - .3, 3.18, z - 1.6)]);
        sc.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, .025, 6), mCable));
    });
    // ---- porte de la salle, au fond (la vidéo de la salle y est projetée)
    const ZP = -15, tDanger = texDanger();
    const mCadre = new THREE.MeshStandardMaterial({ map: tDanger, metalness: .5, roughness: .6 });
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), metal(0x1b2029, .7, .5)); fond.position.set(0, 1.6, ZP - .01);
    const tFond = tMur.clone(); tFond.needsUpdate = true; tFond.repeat.set(1, 1); fond.material.map = tFond; sc.add(fond);
    [[-1.25, 1.3, .3, 2.6], [1.25, 1.3, .3, 2.6], [0, 2.72, 2.8, .26]].forEach(([x, y, w, hh]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, .3), mCadre); b.position.set(x, y, ZP + .05); sc.add(b); });
    let ecran = null, tVid = null;
    if (opts.video) {
        tVid = new THREE.VideoTexture(opts.video); tVid.encoding = THREE.sRGBEncoding; tVid.minFilter = THREE.LinearFilter;
        ecran = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.59), new THREE.MeshBasicMaterial({ map: tVid, toneMapped: false, fog: false }));
        ecran.position.set(0, 1.3, ZP - .25); sc.add(ecran);
    }
    const mPorte = metal(0x59606b, .85, .35);
    const vantaux = [-1, 1].map(c => { const v = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.59, .14), mPorte); v.position.set(c * .56, 1.3, ZP - .08); sc.add(v);
        const raie = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.2, .02), lum(0xf59e0b, 1.4)); raie.position.set(-c * .5, 0, .08); v.add(raie); return v; });
    const lumSalle = new THREE.PointLight(0x67e8f9, 0, 9, 1.4); lumSalle.position.set(0, 1.4, ZP + 1); sc.add(lumSalle);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.set(0, 1.3, ZP + .3); sc.add(halo);
    let ouverture = 0, ouvertureCible = 0;
    // ---- sas de notre vaisseau, au premier plan
    const ZS = .4;
    [[-1.95, 1.45, .5, 2.9], [1.95, 1.45, .5, 2.9], [0, 3.0, 4.4, .42]].forEach(([x, y, w, hh]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, .5), mCadre); b.position.set(x, y, ZS); sc.add(b); });
    const tSas = texSol(); tSas.repeat.set(1.1, .85);
    const solSas = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), new THREE.MeshStandardMaterial({ map: tSas, color: 0x9fb4d0, metalness: .7, roughness: .35 }));
    solSas.rotation.x = -Math.PI / 2; solSas.position.set(0, .005, ZS + 1.9); sc.add(solSas);
    const ligneSas = new THREE.Mesh(new THREE.BoxGeometry(3.4, .012, .05), lum(0x22d3ee, 2)); ligneSas.position.set(0, .01, ZS + .3); sc.add(ligneSas);
    const lumSas = new THREE.PointLight(0xffc98a, 1.25, 6, 1.5); lumSas.position.set(0, 2.7, ZS + 2.2); sc.add(lumSas);
    const voyant = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), lum(0x22c55e, 3)); voyant.position.set(1.95, 2.55, ZS + .27); sc.add(voyant);
    // ---- gyrophares d'alarme
    const gyros = [-1.3, 1.3].map(x => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .14, 12), lum(0xff1f1f, .15)); b.position.set(x, 3.08, -3.4); sc.add(b);
        const l = new THREE.PointLight(0xff2020, 0, 9, 1.4); l.position.set(x, 2.7, -3.4); sc.add(l); return { b: b, l: l }; });
    // ---- lampes torches : deux vraies lumières + des cônes de lumière pour chacun
    const torches = [0, 1].map(() => { const s = new THREE.SpotLight(0xfff1c8, 0, 11, .42, .55, 1.3); sc.add(s, s.target); return s; });
    const tCone = texCone();
    const geoCone = new THREE.ConeGeometry(.62, 3, 24, 1, true);
    // ---- poussière
    const nP = 380, pos = new Float32Array(nP * 3);
    for (let i = 0; i < nP; i++) { pos[i * 3] = (Math.random() - .5) * 4.2; pos[i * 3 + 1] = Math.random() * 3.1; pos[i * 3 + 2] = 3 - Math.random() * 18; }
    const gP = new THREE.BufferGeometry(); gP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const poussiere = new THREE.Points(gP, new THREE.PointsMaterial({ color: 0xaac4e0, size: .028, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    sc.add(poussiere);
    // ---- cristaux : modèle partagé (repli : octaèdre lumineux)
    let proto = null;
    modele('cristal').then(g => { proto = cadrer(THREE, g.scene, .24); }).catch(() => {});
    const mGemme = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e7490, emissiveIntensity: 1.2, metalness: .1, roughness: .2 });
    function gemme() { const o = proto ? proto.clone() : new THREE.Mesh(new THREE.OctahedronGeometry(.09), mGemme); if (!proto) o.scale.y = 1.7; return o; }
    const tas = new THREE.Group(); sc.add(tas);
    function majTas(n) {
        n = Math.min(24, n || 0);
        while (tas.children.length > n) tas.remove(tas.children[tas.children.length - 1]);
        while (tas.children.length < n) { const o = gemme(), k = tas.children.length; o.position.set((Math.random() - .5) * 2.4, 0, -12.2 - Math.random() * 2.2); o.rotation.set(Math.random() * .6, Math.random() * 6, Math.random() * .6); o.userData.k = k; tas.add(o); }
    }
    const vols = [];
    // ---- capsule de secours (évacuation)
    let capsule = null, capsuleT = -1;
    modele('capsule').then(g => { capsule = cadrer(THREE, g.scene, 1.3); capsule.visible = false; sc.add(capsule); }).catch(() => {});

    const acteurs = {};
    const etiquettes = document.createElement('div'); etiquettes.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; el.appendChild(etiquettes);
    const horloge = new THREE.Clock(); let mort = false, desastre = 0, alarme = 0, couleurDanger = null, menace = false, noir = false, secousse = 0;

    function creer(n, coul) {
        const a = { x: (Math.random() - .5) * 2.4, z: 2.6, cible: { x: 0, z: 2.6, rot: 0 }, rot: 0, etat: '', g: null, mix: null, actions: {}, pret: false, opacite: 1, flash: 0 };
        a.label = document.createElement('div');
        a.label.style.cssText = 'position:absolute;transform:translate(-50%,-100%);font:800 10px system-ui,sans-serif;color:#fff;padding:1px 6px;border-radius:999px;background:rgba(2,6,23,.72);white-space:nowrap;border:1px solid ' + coul + ';transition:transform .2s';
        etiquettes.appendChild(a.label);
        acteurs[n] = a;
        modele('astronaute').then(g => {
            if (mort || !acteurs[n]) return;
            const o = cadrer(THREE, g.scene, 1.55), teinte = new THREE.Color(coul);
            o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.lerp(teinte, .5); m.frustumCulled = false; } });
            const grp = new THREE.Group(); grp.add(o); sc.add(grp); a.g = grp; a.mix = new THREE.AnimationMixer(o);
            const pivot = new THREE.Group(); pivot.position.set(0, 1.42, .12); pivot.rotation.x = .2; grp.add(pivot);
            a.cone = new THREE.Mesh(geoCone, new THREE.MeshBasicMaterial({ color: 0xfff1c8, alphaMap: tCone, transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            a.cone.rotation.x = -Math.PI / 2; a.cone.position.z = 1.5; pivot.add(a.cone);
            (g.animations || []).forEach(c => { a.actions[c.name] = a.mix.clipAction(c); });
            a.pret = true; const e = a.etat; a.etat = ''; jouer(a, e || 'attente');
        }).catch(() => {});
        return a;
    }
    function jouer(a, etat, unefois) {
        if (a.etat === etat) return; a.etat = etat; if (!a.pret) return;
        const act = a.actions[ANIM[etat]] || a.actions.idle; if (!act) return;
        Object.values(a.actions).forEach(x => { if (x !== act) x.fadeOut(.25); });
        act.reset(); act.setLoop(unefois ? THREE.LoopOnce : THREE.LoopRepeat); act.clampWhenFinished = !!unefois; act.fadeIn(.25).play();
    }
    let derniere = '';
    function maj(e) {
        const tous = e.dedans.concat(e.dehors), noms = tous.map(p => p.n);
        Object.keys(acteurs).forEach(n => { if (noms.indexOf(n) < 0) { const a = acteurs[n]; if (a.g) sc.remove(a.g); a.label.remove(); delete acteurs[n]; } });
        tous.forEach(p => { if (!acteurs[p.n]) creer(p.n, p.c); acteurs[p.n].label.textContent = p.n + (p.sac != null ? '  🎒' + p.sac : ''); acteurs[p.n].dedans = e.dedans.indexOf(p) >= 0; });
        // dans l'épave : rangs de 4 en travers du couloir, légèrement décalés
        e.dedans.forEach((p, i) => { const rg = Math.floor(i / 4), j = i % 4, m = Math.min(4, e.dedans.length - rg * 4);
            acteurs[p.n].cible = { x: m === 1 ? 0 : -1.25 + 2.5 * j / (m - 1), z: -3.1 - rg * 1.7 - (j % 2) * .4, rot: Math.PI }; });
        // dans le sas : de part et d'autre, pour laisser voir le couloir
        e.dehors.forEach((p, i) => { const c = i % 2 ? 1 : -1, rg = Math.floor(i / 2); acteurs[p.n].cible = { x: c * (.98 + (rg % 2) * .34), z: .95 + rg * .36, rot: -c * .4 }; });
        noir = !!e.noir; menace = !!e.menace;
        if (e.salle) { lumSalle.color.set(e.salle); halo.material.color.set(e.salle); }
        majTas(e.sol);
        const nouvelle = derniere !== e.cle; derniere = e.cle;
        if (!nouvelle) return;
        couleurDanger = e.phase === 'DESASTRE' && e.danger ? new THREE.Color(e.danger) : null;
        desastre = e.phase === 'DESASTRE' ? performance.now() : 0;
        if (desastre) { secousse = performance.now(); if (capsule) { capsule.visible = true; capsuleT = performance.now() + 900; } }
        tous.forEach(p => {
            const a = acteurs[p.n];
            if (e.phase === 'DESASTRE' && (e.victimes || []).indexOf(p.n) >= 0) { jouer(a, 'peur'); a.fuite = performance.now() + 1700; }
            else if (e.phase === 'DECISION' && (e.rentrent || []).indexOf(p.n) >= 0) jouer(a, 'course');
            else if (e.phase === 'DEPART') jouer(a, 'marche');
            else if (e.phase === 'BILAN' && (e.gagnants || []).indexOf(p.n) >= 0) jouer(a, 'joie');
        });
    }
    // cristaux qui volent en courbe : de la porte, du sol ou d'un joueur, vers un joueur
    function depart(de) {
        if (de === 'porte') return new THREE.Vector3((Math.random() - .5) * 1.4, 1 + Math.random() * .8, ZP + .4);
        if (de === 'sol') { const o = tas.children[Math.floor(Math.random() * tas.children.length)]; return o ? o.position.clone().setY(.15) : new THREE.Vector3(0, .2, -13); }
        const a = acteurs[de]; return a ? new THREE.Vector3(a.x, 1.15, a.z) : new THREE.Vector3(0, 1, -6);
    }
    function gemmes(liste) {
        const t = performance.now();
        (liste || []).forEach(v => { for (let i = 0; i < Math.min(8, v.k || 0); i++) {
            const o = gemme(); o.visible = false; sc.add(o);
            vols.push({ o: o, de: v.de, a: v.a, t0: t + 120 * i + Math.random() * 90, dur: 1100 + Math.random() * 300, p0: null });
        } });
    }
    function porte(ouvert) { ouvertureCible = ouvert ? 1 : 0; }
    function sonner(c) { alarme = performance.now(); if (c) couleurDanger = new THREE.Color(c); }
    // cadrage : le cadre du sas remplit la largeur, quelle que soit la forme du panneau
    function cadrage() { taille(r, cam, el); const lg = Math.tan(cam.fov * Math.PI / 360) * cam.aspect; camBase.z = Math.max(4.2, Math.min(7.4, .4 + 2.35 / lg)); }
    const ro = new ResizeObserver(cadrage); ro.observe(el); cadrage();
    const v = new THREE.Vector3(), p1 = new THREE.Vector3(), tmp = new THREE.Vector3();
    (function boucle() {
        if (mort) return; requestAnimationFrame(boucle);
        const dReel = Math.min(.25, horloge.getDelta()), dt = Math.min(.05, dReel), t = performance.now();
        // caméra : léger balancement, secousse aux catastrophes
        const sec = secousse && t - secousse < 900 ? (1 - (t - secousse) / 900) * .08 : 0;
        cam.position.set(camBase.x + Math.sin(t / 2100) * .12 + (Math.random() - .5) * sec, camBase.y + Math.sin(t / 1700) * .04 + (Math.random() - .5) * sec, camBase.z);
        cam.lookAt(camVise);
        // porte du fond + vidéo
        ouverture += (ouvertureCible - ouverture) * Math.min(1, dt * 3.2);
        vantaux[0].position.x = -.56 - ouverture * 1.05; vantaux[1].position.x = .56 + ouverture * 1.05;
        lumSalle.intensity = ouverture * (2.2 + Math.sin(t / 230) * .25); halo.material.opacity = ouverture * .11;
        if (tVid && opts.video && opts.video.videoWidth) {
            const va = opts.video.videoWidth / opts.video.videoHeight, pa = 2.2 / 2.59;
            if (va > pa) { tVid.repeat.set(pa / va, 1); tVid.offset.set((1 - pa / va) / 2, 0); } else { tVid.repeat.set(1, va / pa); tVid.offset.set(0, (1 - va / pa) / 2); }
        }
        // éclairage selon l'ambiance
        ciel.intensity = noir ? .05 : .35;
        plafonniers.forEach((p, i) => {
            let k = noir ? 0 : p.base;
            if (p.grille || menace) k *= (Math.random() < (menace ? .08 : .04) ? .1 : 1) * (.85 + Math.sin(t / 60 + i) * .15);
            p.l.intensity = k; p.m.emissiveIntensity = k * 2;
        });
        const enAlarme = (desastre && t - desastre < 7000) || (alarme && t - alarme < 5000);
        gyros.forEach((g, i) => { const k = enAlarme ? Math.max(0, Math.sin(t / 140 + i * Math.PI)) : menace ? .12 + Math.sin(t / 700) * .1 : 0; g.l.intensity = k * 2.6; g.b.material.emissiveIntensity = .15 + k * 3; });
        if (couleurDanger && desastre) { sc.fog.color.lerpColors(FOND, couleurDanger, .18 + Math.sin(t / 90) * .06); lumSalle.color.copy(couleurDanger); lumSalle.intensity = 3 * (Math.random() < .15 ? .2 : 1); }
        else sc.fog.color.lerp(FOND, .05);
        sc.background.copy(sc.fog.color);
        sc.fog.density = noir ? .11 : .075;
        voyant.material.emissive.setHex(enAlarme ? 0xff2020 : 0x22c55e);
        // poussière
        const pa = gP.attributes.position.array;
        for (let i = 0; i < nP; i++) { pa[i * 3 + 1] -= dt * .04; pa[i * 3] += Math.sin(t / 3000 + i) * dt * .02; if (pa[i * 3 + 1] < 0) pa[i * 3 + 1] = 3.1; }
        gP.attributes.position.needsUpdate = true;
        // astronautes
        let nT = 0;
        torches.forEach(s => s.intensity = 0);
        Object.values(acteurs).forEach(a => {
            if (!a.g) return;
            if (a.fuite && t > a.fuite) { a.fuite = 0; a.x = a.cible.x; a.z = a.cible.z; a.opacite = 0; jouer(a, 'attente'); }
            const dx = a.cible.x - a.x, dz = a.cible.z - a.z, d = Math.hypot(dx, dz);
            const vit = a.etat === 'course' ? 3.3 : a.etat === 'marche' ? 1.5 : 2.1;
            let rotV = a.cible.rot;
            if (d > .03 && a.etat !== 'peur') {
                const pas = Math.min(d, vit * dReel); a.x += dx / d * pas; a.z += dz / d * pas; rotV = Math.atan2(dx, dz);
                if (a.etat === 'attente' || a.etat === 'joie') jouer(a, d > 1.2 ? 'course' : 'marche');
            } else if (a.etat === 'course' || a.etat === 'marche') jouer(a, 'attente');
            let dr = rotV - a.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); a.rot += dr * Math.min(1, dReel * 7);
            a.g.rotation.y = a.rot;
            a.opacite = Math.min(1, a.opacite + dt * 1.2); a.g.visible = a.opacite > .05;
            a.g.position.set(a.x, 0, a.z); a.mix.update(dReel);
            // lampe : allumée dans l'épave
            const dansEpave = a.dedans && a.z < .2;
            if (a.cone) a.cone.material.opacity = dansEpave ? (noir ? .2 : .12) * (.9 + Math.sin(t / 90 + a.x) * .05) : 0;
            if (dansEpave && nT < 2) { const s = torches[nT++]; s.intensity = noir ? 3 : 1.7; s.position.set(a.x, 1.5, a.z - .2); tmp.set(Math.sin(a.rot), 0, Math.cos(a.rot)); s.target.position.set(a.x + tmp.x * 4, .2, a.z + tmp.z * 4); }
            v.set(a.x, 1.78, a.z).project(cam);
            a.label.style.left = ((v.x + 1) / 2 * el.clientWidth) + 'px'; a.label.style.top = ((1 - v.y) / 2 * el.clientHeight) + 'px';
            a.label.style.opacity = a.g.visible && v.z < 1 ? 1 : 0;
            a.label.style.transform = 'translate(-50%,-100%)' + (t - a.flash < 260 ? ' scale(1.25)' : '');
        });
        // cristaux en vol (courbe de Bézier)
        for (let i = vols.length - 1; i >= 0; i--) {
            const f = vols[i]; if (t < f.t0) continue;
            const cible = acteurs[f.a];
            if (!f.p0) { f.p0 = depart(f.de); f.o.visible = true; }
            const k = Math.min(1, (t - f.t0) / f.dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            const p2 = cible ? tmp.set(cible.x, 1.12, cible.z + (cible.dedans ? .25 : -.15)) : tmp.set(0, 1, 2);
            p1.copy(f.p0).add(p2).multiplyScalar(.5); p1.y += 1.6;
            const u = 1 - e; f.o.position.set(u * u * f.p0.x + 2 * u * e * p1.x + e * e * p2.x, u * u * f.p0.y + 2 * u * e * p1.y + e * e * p2.y, u * u * f.p0.z + 2 * u * e * p1.z + e * e * p2.z);
            f.o.rotation.y += dt * 9; f.o.scale.setScalar(1 - Math.max(0, k - .85) * 4);
            if (k >= 1) { sc.remove(f.o); vols.splice(i, 1); if (cible) cible.flash = t; }
        }
        // capsule de secours
        if (capsule && capsule.visible && t > capsuleT) {
            const k = (t - capsuleT) / 2400;
            if (k > 1) capsule.visible = false;
            else { capsule.position.set(Math.sin(k * 3) * .5, 1.6 + k * 1.1, ZP + 1 + k * 19); capsule.rotation.set(0, Math.PI, Math.sin(k * 9) * .2); }
        }
        r.render(sc, cam);
    })();
    return { maj: maj, gemmes: gemmes, porte: porte, alarme: sonner, detruire() { mort = true; ro.disconnect(); r.dispose(); el.innerHTML = ''; } };
};
})();
