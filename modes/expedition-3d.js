// =====================================================================
//  « EXPÉDITION SUR L'ÉPAVE » : partie 3D (Three.js r128 + GLTFLoader).
//  Tout est facultatif : si la 3D ne charge pas, le mode reste jouable.
//    EX3D.charger()            -> promesse (moteur 3D prêt ou non)
//    EX3D.scene(el)            -> scène de l'équipage : astronautes à bord / au vaisseau
//                                 .maj({ dedans:[{n,c}], dehors:[{n,c}], phase, rentrent:[], continuent:[], cle })
//    EX3D.objet(el, nom, opts) -> petite vitrine qui fait tourner un modèle (cristal, relique, sac, coffre)
//  Modèles : expedition-visuel/modeles/*.glb
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
//  Scène de l'équipage : l'épave à gauche, notre vaisseau à droite
// =====================================================================
const ANIM = { attente: 'idle', marche: 'walk', course: 'run', peur: 'scared_01', joie: 'cheer' };
EX3D.scene = function (el) {
    const THREE = W.THREE; if (!THREE) return null;
    const r = rendu(el, false), sc = new THREE.Scene();
    sc.background = new THREE.Color(0x060a14); sc.fog = new THREE.Fog(0x060a14, 9, 22);
    const cam = new THREE.PerspectiveCamera(32, 1, .1, 60); cam.position.set(0, 2.6, 10.5); cam.lookAt(0, .9, 0);
    sc.add(new THREE.HemisphereLight(0x9fb7ff, 0x0b0b14, .55));
    const torche = new THREE.SpotLight(0xfff1c1, 2.2, 16, .55, .6); torche.position.set(-3, 5, 4); torche.target.position.set(-3, 0, 0); sc.add(torche, torche.target);
    const rouge = new THREE.PointLight(0xff2a2a, 0, 12); rouge.position.set(-3, 3, 2); sc.add(rouge);
    const cyan = new THREE.PointLight(0x22d3ee, 1.1, 10); cyan.position.set(4.6, 2.5, 2.5); sc.add(cyan);
    const chaud = new THREE.PointLight(0xffb36b, .9, 9); chaud.position.set(5.4, 1.5, 1); sc.add(chaud);
    // sol : grille de l'épave à gauche, plateforme du vaisseau à droite
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(13, 8), new THREE.MeshStandardMaterial({ color: 0x141a26, metalness: .7, roughness: .55 }));
    sol.rotation.x = -Math.PI / 2; sol.position.set(-2.4, 0, -1); sc.add(sol);
    const grille = new THREE.GridHelper(13, 26, 0x1f2937, 0x1f2937); grille.position.set(-2.4, .01, -1); sc.add(grille);
    const quai = new THREE.Mesh(new THREE.BoxGeometry(4.2, .16, 5), new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: .6, roughness: .4, emissive: 0x0c4a6e, emissiveIntensity: .25 }));
    quai.position.set(5.6, .08, -.6); sc.add(quai);
    const bord = new THREE.Mesh(new THREE.BoxGeometry(4.2, .04, .06), new THREE.MeshBasicMaterial({ color: 0x22d3ee })); bord.position.set(5.6, .18, 1.9); sc.add(bord);
    const sas = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: .8, roughness: .35, emissive: 0x0e7490, emissiveIntensity: .35 }));
    sas.position.set(3.35, 1.3, -.8); sc.add(sas);
    // décor : cristaux dans l'épave, vaisseau amarré
    [[-6.6, -2.4, .9, 'cristal-grappe'], [-4.4, -3.2, 1.1, 'cristaux-geode'], [-1.6, -2.8, .7, 'cristal'], [.9, -3.4, .8, 'cristal-grappe']].forEach(([x, z, h, n], i) => {
        modele(n).then(g => { const o = cadrer(THREE, g.scene, h); o.position.x += x; o.position.z += z; o.rotation.y = i * 1.3; sc.add(o); }).catch(() => {});
    });
    const lueurs = [[-6.6, -2.4, 0x38bdf8], [-4.4, -3.2, 0xa855f7], [.9, -3.4, 0x38bdf8]].map(([x, z, c]) => { const l = new THREE.PointLight(c, .8, 4); l.position.set(x, 1, z + .6); sc.add(l); return l; });
    modele('vaisseau').then(g => { const o = cadrer(THREE, g.scene, 4.2); o.position.x += 6.4; o.position.z += -3.2; o.position.y += .2; o.rotation.y = -Math.PI / 2 + .35; sc.add(o); }).catch(() => {});
    // capsule de secours (évacuation)
    let capsule = null, capsuleT = -1;
    modele('capsule').then(g => { capsule = cadrer(THREE, g.scene, 1.4); capsule.visible = false; sc.add(capsule); }).catch(() => {});

    const acteurs = {};   // nom -> { g, mix, actions, cible:{x,z}, x, z, etat, label }
    const etiquettes = document.createElement('div'); etiquettes.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; el.appendChild(etiquettes);
    const horloge = new THREE.Clock(); let mort = false, desastre = 0;

    function creer(n, coul) {
        const a = { x: 3.4, z: 0, cible: { x: 3.4, z: 0 }, etat: '', g: null, mix: null, actions: {}, pret: false, opacite: 1 };
        a.label = document.createElement('div');
        a.label.style.cssText = 'position:absolute;transform:translate(-50%,-100%);font:800 11px system-ui,sans-serif;color:#fff;padding:1px 6px;border-radius:999px;background:rgba(2,6,23,.75);white-space:nowrap;border:1px solid ' + coul;
        a.label.textContent = n; etiquettes.appendChild(a.label);
        acteurs[n] = a;
        modele('astronaute').then(g => {
            if (mort || !acteurs[n]) return;
            const o = cadrer(THREE, g.scene, 1.55), teinte = new THREE.Color(coul);
            o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.lerp(teinte, .55); m.castShadow = true; m.frustumCulled = false; } });
            const grp = new THREE.Group(); grp.add(o); sc.add(grp); a.g = grp; a.mix = new THREE.AnimationMixer(o);
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
    function places(liste, x0, x1, z0) {
        const n = liste.length; return liste.map((p, i) => ({ n: p.n, x: n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1), z: z0 + (i % 2) * .7 }));
    }
    let derniere = '';
    function maj(e) {
        const tous = e.dedans.concat(e.dehors), noms = tous.map(p => p.n);
        Object.keys(acteurs).forEach(n => { if (noms.indexOf(n) < 0) { const a = acteurs[n]; if (a.g) sc.remove(a.g); a.label.remove(); delete acteurs[n]; } });
        tous.forEach(p => { if (!acteurs[p.n]) { const a = creer(p.n, p.c); if (e.dedans.some(q => q.n === p.n)) { a.x = -2; a.cible.x = -2; } } });
        const nouvelle = derniere !== e.cle; derniere = e.cle;
        const largeur = Math.min(8.2, 1.2 * Math.max(1, e.dedans.length));
        places(e.dedans, -2.4 - largeur / 2, -2.4 + largeur / 2, -.2).forEach(p => { const a = acteurs[p.n]; a.cible = { x: p.x, z: p.z }; });
        places(e.dehors, 4.3, 6.9, -.4).forEach(p => { const a = acteurs[p.n]; a.cible = { x: p.x, z: p.z - .3 }; });
        if (!nouvelle) return;
        desastre = e.phase === 'DESASTRE' ? performance.now() : 0;
        if (desastre && capsule) { capsule.visible = true; capsuleT = performance.now(); }
        tous.forEach(p => {
            const a = acteurs[p.n];
            if (e.phase === 'DESASTRE' && (e.victimes || []).indexOf(p.n) >= 0) { jouer(a, 'peur'); a.fuite = performance.now() + 1500; }
            else if (e.phase === 'DECISION' && (e.rentrent || []).indexOf(p.n) >= 0) jouer(a, 'course');
            else if (e.phase === 'DEPART') jouer(a, 'marche');
            else if (e.phase === 'BILAN' && (e.gagnants || []).indexOf(p.n) >= 0) jouer(a, 'joie');
            else if (Math.abs(a.x - a.cible.x) < .05) jouer(a, 'attente');
        });
    }
    const ro = new ResizeObserver(() => taille(r, cam, el)); ro.observe(el); taille(r, cam, el);
    const v = new THREE.Vector3();
    (function boucle() {
        if (mort) return; requestAnimationFrame(boucle);
        const dt = Math.min(.05, horloge.getDelta()), t = performance.now();
        torche.position.x = -3 + Math.sin(t / 1300) * 1.6; torche.target.position.x = -3 + Math.sin(t / 1300) * 2.4;
        lueurs.forEach((l, i) => { l.intensity = .7 + Math.sin(t / 500 + i * 2) * .25; });
        rouge.intensity = desastre && t - desastre < 6000 ? 2.5 * (Math.sin(t / 90) * .5 + .5) : 0;
        Object.values(acteurs).forEach(a => {
            if (!a.g) return;
            if (a.fuite && t > a.fuite) { a.fuite = 0; a.x = 4.6; a.z = a.cible.z; a.opacite = 0; }   // évacué par la capsule
            const dx = a.cible.x - a.x, dz = a.cible.z - a.z, d = Math.hypot(dx, dz);
            const vit = a.etat === 'course' ? 3.4 : a.etat === 'marche' ? 1.6 : 2.2;
            if (d > .03 && a.etat !== 'peur') {
                const pas = Math.min(d, vit * dt); a.x += dx / d * pas; a.z += dz / d * pas;
                a.g.rotation.y = Math.atan2(dx, dz);
                if (a.etat === 'attente' || a.etat === 'joie') jouer(a, d > 1 ? 'course' : 'marche');
            } else if (a.etat === 'course' || a.etat === 'marche') { jouer(a, 'attente'); a.g.rotation.y = 0; }
            else a.g.rotation.y += (0 - a.g.rotation.y) * .1;
            a.opacite = Math.min(1, a.opacite + dt * 1.5); a.g.visible = a.opacite > .05;
            a.g.position.set(a.x, 0, a.z); a.mix.update(dt);
            v.set(a.x, 1.85, a.z).project(cam);
            a.label.style.left = ((v.x + 1) / 2 * el.clientWidth) + 'px'; a.label.style.top = ((1 - v.y) / 2 * el.clientHeight) + 'px';
            a.label.style.opacity = a.g.visible ? 1 : 0;
        });
        if (capsule && capsule.visible) {
            const k = (t - capsuleT) / 2600;
            if (k > 1) capsule.visible = false;
            else { capsule.position.set(-2 + k * 11, .9 + Math.sin(k * Math.PI) * 2.2, .6); capsule.rotation.z = -k * 6; capsule.rotation.y = Math.PI / 2; }
        }
        r.render(sc, cam);
    })();
    return { maj: maj, detruire() { mort = true; ro.disconnect(); r.dispose(); el.innerHTML = ''; } };
};
})();
