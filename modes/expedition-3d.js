// =====================================================================
//  « EXPÉDITION SUR L'ÉPAVE » : partie 3D (Three.js r128 + GLTFLoader).
//  Tout est facultatif : si la 3D ne charge pas, le mode reste jouable.
//    EX3D.charger()            -> promesse (moteur 3D prêt ou non)
//    EX3D.equipe()             -> les astronautes des cartes d'équipage : .maj([{n, c, canvas, etat}]), .detruire()
//    EX3D.objet(el, nom, opts) -> petite vitrine qui fait tourner un modèle (cristal, relique, objet, sac, coffre)
//  Modèles : expedition-web/modeles/*.glb, versions allégées des originaux d'expedition-visuel.
//    EX3D.vignettes()          -> petits objets 3D qui tournent dans l'inventaire des cartes : .maj([{canvas, nom}])
// =====================================================================
(function () {
const W = window, DOSSIER = './expedition-web/modeles/';
// modèles allégés (≈ 2 Mo chacun) tirés des originaux d'expedition-visuel : même nom que dans le jeu
function fichier(nom) { return nom + '.glb'; }
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
    return tampons[nom] || (tampons[nom] = fetch(encodeURI(DOSSIER + fichier(nom))).then(r => { if (!r.ok) throw new Error(nom); return r.arrayBuffer(); }));
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
//  Équipage : un astronaute animé par carte de joueur.
//  Un seul moteur 3D dessine chaque astronaute à tour de rôle, puis copie l'image dans le canvas de sa carte.
// =====================================================================
const ANIM = { attente: 'idle', marche: 'walk', course: 'run', peur: 'scared_01', joie: 'cheer' };
// animations de mort (une par danger), jouées l'une après l'autre puis figées
const MORTS = {
    feu: ['getting burned by fire', 'dead on ground'], oxy: ['suffocating', 'dead on ground'],
    elec: ['electrocuting', 'electrocuted spasm'], rad: ['getting knee on ground and then concassing full body on ground'], xeno: ['dead on ground']
};
EX3D.equipe = function () {
    const THREE = W.THREE; if (!THREE) return null;
    const toile = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; r.setClearColor(0, 0);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xcfe0ff, 0x1b2233, 1.0));
    const d = new THREE.DirectionalLight(0xffffff, 1.3); d.position.set(2, 4, 5); sc.add(d);
    const contre = new THREE.DirectionalLight(0x67e8f9, .9); contre.position.set(-3, 2, -3); sc.add(contre);
    const cam = new THREE.PerspectiveCamera(30, .75, .05, 50);
    const acteurs = {}, horloge = new THREE.Clock(); let mort = false, dernier = 0;
    function teinter(o, coul) { const t = new THREE.Color(coul); o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.lerp(t, .5); m.frustumCulled = false; } }); }
    function poser(a, nomModele, suite) {
        const jeton = a.jeton = (a.jeton || 0) + 1;
        modele(nomModele).then(g => {
            if (mort || !acteurs[a.n] || a.jeton !== jeton) return;
            const o = cadrer(THREE, g.scene, 1.6); teinter(o, a.c);
            if (a.obj) a.grp.remove(a.obj);
            a.obj = o; a.grp.add(o); a.mix = new THREE.AnimationMixer(o); a.actions = {}; a.clips = g.animations || [];
            a.clips.forEach(c => { a.actions[c.name] = a.mix.clipAction(c); });
            a.pret = true; suite();
        }).catch(() => {});
    }
    function jouer(a, nomClip, unefois) {
        const act = a.actions[nomClip] || a.actions.idle || Object.values(a.actions)[0]; if (!act) return null;
        Object.values(a.actions).forEach(x => { if (x !== act) x.fadeOut(.25); });
        act.reset(); act.setLoop(unefois ? THREE.LoopOnce : THREE.LoopRepeat); act.clampWhenFinished = !!unefois; act.fadeIn(.25).play();
        return act;
    }
    function appliquer(a) {
        if (!a.pret) return;
        const e = a.etat;
        if (e.indexOf('mort-') === 0) {
            const h = e.slice(5), seq = MORTS[h] || ['dead on ground'];
            if (a.modele !== 'mort-' + h) { a.modele = 'mort-' + h; a.pret = false; poser(a, 'mort-' + h, () => appliquer(a)); return; }
            let i = 0; const suivant = () => { const act = jouer(a, seq[i], true); if (!act) return; const fin = ev => { if (ev.action !== act) return; a.mix.removeEventListener('finished', fin); if (++i < seq.length) suivant(); }; a.mix.addEventListener('finished', fin); };
            suivant(); return;
        }
        if (a.modele !== 'astronaute') { a.modele = 'astronaute'; a.pret = false; poser(a, 'astronaute', () => appliquer(a)); return; }
        if (e === 'rentre') { jouer(a, ANIM.course); a.ensuite = performance.now() + 1800; return; }
        jouer(a, ANIM[e] || ANIM.attente);
    }
    function maj(liste) {
        const noms = liste.map(x => x.n);
        Object.keys(acteurs).forEach(n => { if (noms.indexOf(n) < 0) { sc.remove(acteurs[n].grp); delete acteurs[n]; } });
        liste.forEach((x, i) => {
            let a = acteurs[x.n];
            if (!a) { a = acteurs[x.n] = { n: x.n, c: x.c, grp: new THREE.Group(), etat: '', modele: '', i: i }; sc.add(a.grp); a.modele = 'astronaute'; poser(a, 'astronaute', () => appliquer(a)); }
            a.canvas = x.canvas; a.i = i;
            if (a.etat !== x.etat) { a.etat = x.etat; a.ensuite = 0; appliquer(a); }
        });
    }
    (function boucle() {
        if (mort) return; requestAnimationFrame(boucle);
        const t = performance.now(); if (t - dernier < 33) return;               // ~30 images/s suffisent
        const dt = Math.min(.1, horloge.getDelta()); dernier = t;
        const liste = Object.values(acteurs);
        liste.forEach(a => { a.grp.visible = false; if (a.mix) a.mix.update(dt); });
        liste.forEach(a => {
            const cv = a.canvas; if (!a.obj || !cv || !cv.isConnected) return;
            const w = Math.max(1, Math.round(cv.clientWidth * Math.min(2, W.devicePixelRatio || 1))), h = Math.max(1, Math.round(cv.clientHeight * Math.min(2, W.devicePixelRatio || 1)));
            if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
            if (toile.width !== w || toile.height !== h) r.setSize(w, h, false);
            if (a.ensuite && t > a.ensuite) { a.ensuite = 0; jouer(a, ANIM.joie); }
            const couche = a.etat.indexOf('mort-') === 0, court = a.etat === 'rentre' && a.ensuite;
            a.grp.visible = true;
            a.grp.rotation.y = court ? 1.25 : a.etat === 'marche' ? -.45 : .3 * (a.i % 2 ? -1 : 1) + Math.sin(t / 2400 + a.i) * .12;
            cam.aspect = w / h; cam.fov = couche ? 34 : 30; cam.updateProjectionMatrix();
            const loin = Math.max(4, 3.2 / Math.min(1, cam.aspect * 1.4));
            if (couche) { cam.position.set(0, 1.35, loin); cam.lookAt(0, .65, 0); } else { cam.position.set(0, .95, loin); cam.lookAt(0, .8, 0); }
            r.render(sc, cam); a.grp.visible = false;
            const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.drawImage(toile, 0, 0, w, h);
        });
    })();
    return { maj: maj, detruire() { mort = true; r.dispose(); } };
};

// =====================================================================
//  Inventaire : chaque objet d'un joueur tourne dans une petite case de sa carte.
// =====================================================================
EX3D.vignettes = function () {
    const THREE = W.THREE; if (!THREE) return null;
    const toile = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; r.setClearColor(0, 0);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x223344, 1.1));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(2, 3, 4); sc.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, .05, 50); cam.position.set(0, 1.05, 3.6); cam.lookAt(0, .72, 0);
    let items = [], mort = false, dernier = 0;
    function maj(liste) {
        const garde = [];
        liste.forEach(x => {
            let it = items.find(i => i.canvas === x.canvas);
            if (!it) it = { canvas: x.canvas, nom: '', grp: null, k: Math.random() * 6 };
            if (it.nom !== x.nom) {
                it.nom = x.nom; if (it.grp) sc.remove(it.grp); it.grp = null;
                const jeton = it.jeton = (it.jeton || 0) + 1;
                modele(x.nom).then(g => { if (mort || it.jeton !== jeton) return; const grp = new THREE.Group(); grp.add(cadrer(THREE, g.scene, 1.45)); grp.visible = false; sc.add(grp); it.grp = grp; }).catch(() => {});
            }
            garde.push(it);
        });
        items.filter(i => garde.indexOf(i) < 0).forEach(i => { if (i.grp) sc.remove(i.grp); });
        items = garde;
    }
    (function boucle() {
        if (mort) return; requestAnimationFrame(boucle);
        const t = performance.now(); if (t - dernier < 66) return; dernier = t;   // ~15 images/s
        items.forEach(it => {
            const cv = it.canvas; if (!it.grp || !cv || !cv.isConnected) return;
            const px = Math.min(2, W.devicePixelRatio || 1), w = Math.max(1, Math.round(cv.clientWidth * px)), h = Math.max(1, Math.round(cv.clientHeight * px));
            if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
            if (toile.width !== w || toile.height !== h) r.setSize(w, h, false);
            cam.aspect = w / h; cam.updateProjectionMatrix();
            it.grp.visible = true; it.grp.rotation.y = t / 1500 + it.k; r.render(sc, cam); it.grp.visible = false;
            const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.drawImage(toile, 0, 0, w, h);
        });
    })();
    return { maj: maj, detruire() { mort = true; r.dispose(); } };
};
})();
