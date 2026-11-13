///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
////////////////// --- MODE ANOMALIES 3D --- //////////////////
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////

// =============================================================
// MODÈLES 3D : chemin dans ./models/, axe « profondeur » (x ou z) et sens de la face avant (+1 / -1).
// Si un objet apparaît à l'envers (dos au couloir), mets front: -1 pour ce modèle.
// =============================================================
const MODELS = {
    bench:      { path: 'bench/scene.gltf',                                   depth: 'z', front: 1 },
    bin:        { path: 'bin_metro/scene.gltf',                               depth: 'z', front: 1 },
    door_metro: { path: 'door_metro/scene.gltf',                              depth: 'z', front: 1 },
    door_hosp:  { path: 'door_hospital/scene.gltf',                           depth: 'x', front: 1 },
    door_hotel: { path: 'door_hotel/scene.gltf',                              depth: 'x', front: 1 },
    dbl_door:   { path: 'double_door_hospital/scene.gltf',                    depth: 'z', front: 1 },
    ext:        { path: 'extinguisher/korean_fire_extinguisher_01_2k.gltf',   depth: 'z', front: 1 },
    alarm:      { path: 'fire_alarm/fire_alarm_2k.gltf',                      depth: 'z', front: 1 },
    phone:      { path: 'payphone/korean_public_payphone_01_2k.gltf',         depth: 'z', front: 1 },
    clock:      { path: 'wall_clock/wall_clock_2k.gltf',                      depth: 'z', front: 1 },
    camera:     { path: 'security_camera/security_camera_02_2k.gltf',         depth: 'z', front: 1 },
    lamp:       { path: 'caged_hanging_light/caged_hanging_light_2k.gltf',    depth: 'z', front: 1 },
    fan:        { path: 'ceiling_fan/ceiling_fan_2k.gltf',                    depth: 'z', front: 1 },
    console:    { path: 'classic_Console/ClassicConsole_01_2k.gltf',          depth: 'z', front: 1 },
    frame1:     { path: 'fancy_picture_frame/fancy_picture_frame_01_2k.gltf', depth: 'z', front: 1 },
    frame2:     { path: 'fancy_picture_frame2/fancy_picture_frame_02_2k.gltf',depth: 'z', front: 1 },
    frame3:     { path: 'hanging_picture_frame/hanging_picture_frame_03_2k.gltf', depth: 'z', front: 1 },
    sofa:       { path: 'sofa/Sofa_01_2k.gltf',                               depth: 'z', front: 1 },
    cart:       { path: 'tool_cart/tool_cart_2k.gltf',                        depth: 'z', front: 1 },
    wheelchair: { path: 'wheelchair/wheelchair_01_2k.gltf',                   depth: 'z', front: 1 },
    wet:        { path: 'wet_floor_sign/WetFloorSign_01_2k.gltf',             depth: 'z', front: 1 }
};

// =============================================================
// DÉCORS : textures (./textures/<texDir>/), éclairage HDR (./hdr/), ambiance (brouillard, lumière)
// =============================================================
const THEMES_CONFIG = {
    metro: {
        pbr: true, texDir: 'metro',
        hdr: 'metro_vijzelgracht_2k.hdr', envIntensity: 0.55,
        fallback: { wall: 0xd8dde3, floor: 0x7c828a, ceiling: 0x2b3340 },
        lightColor: 0xfffbeb, fogColor: 0x0c1118, fogNear: 5, fogFar: 26, ambient: 0.05,
        posters: true, anomalies: {}
    },
    hopital: {
        pbr: true, texDir: 'hospital',
        hdr: 'hospital_room_2_2k.hdr', envIntensity: 0.5,
        fallback: { wall: 0xcfd8dc, floor: 0x9aa7ad, ceiling: 0xd1d5db },
        lightColor: 0xe0f2fe, fogColor: 0x0b1411, fogNear: 4, fogFar: 24, ambient: 0.05,
        posters: false, anomalies: {}
    },
    hotel: {
        pbr: true, texDir: 'hotel',
        hdr: 'entrance_hall_2k.hdr', envIntensity: 0.45,
        fallback: { wall: 0x8d6e63, floor: 0x5b2c2c, ceiling: 0x78716c },
        lightColor: 0xffedd5, fogColor: 0x140c08, fogNear: 4, fogFar: 24, ambient: 0.05,
        posters: false, anomalies: {}
    }
};

// =============================================================
// DISPOSITION NORMALE DES OBJETS (identique à chaque sortie : c'est la « référence » à mémoriser)
// side : L (mur gauche) / R (mur droit) / C (centre) | z : position le long du couloir
// h : hauteur voulue (m) | len : longueur voulue | yb : hauteur du bas | top : distance sous le plafond
// solid : on ne peut pas traverser | spin : rotation (rad/s) | clock : aiguilles animées
// =============================================================
const PROP_LAYOUT = {
    metro: [
        { id: 'door1', k: 'door_metro', side: 'L', z: -18, h: 2.3 },
        { id: 'door2', k: 'door_metro', side: 'L', z: -6,  h: 2.3 },
        { id: 'door3', k: 'door_metro', side: 'L', z: 6,   h: 2.3 },
        { id: 'ext',   k: 'ext',   side: 'L', z: -12, h: 0.7 },
        { id: 'alarm', k: 'alarm', side: 'L', z: -12, h: 0.18, yb: 1.3 },
        { id: 'bench', k: 'bench', side: 'R', z: -6,  len: 1.8, solid: true },
        { id: 'clock', k: 'clock', side: 'R', z: -6,  h: 0.4, yb: 2.15, clock: true },
        { id: 'bin',   k: 'bin',   side: 'R', z: -9.5, h: 0.95, solid: true },
        { id: 'phone', k: 'phone', side: 'R', z: -18.5, h: 0.85, yb: 0.95 },
        { id: 'cam',   k: 'camera', side: 'R', z: 2, h: 0.25, top: 0.4, yaw: 0.5 },
        { id: 'lamp1', k: 'lamp',  side: 'C', z: -10, len: 0.9, top: 0, face: 'back' },
        { id: 'lamp2', k: 'lamp',  side: 'C', z: -18, len: 0.9, top: 0, face: 'back' }
    ],
    hopital: [
        { id: 'door1', k: 'door_hosp', side: 'L', z: -18, h: 2.3 },
        { id: 'door2', k: 'door_hosp', side: 'L', z: -6,  h: 2.3 },
        { id: 'door3', k: 'door_hosp', side: 'L', z: 6,   h: 2.3 },
        { id: 'ext',   k: 'ext',   side: 'L', z: -12, h: 0.7 },
        { id: 'alarm', k: 'alarm', side: 'L', z: -12, h: 0.18, yb: 1.3 },
        { id: 'dbl',   k: 'dbl_door', side: 'R', z: -14, h: 2.3 },
        { id: 'cart',  k: 'cart',  side: 'R', z: -8,  h: 0.95, solid: true },
        { id: 'chair', k: 'wheelchair', side: 'R', z: 2, h: 1.0, solid: true },
        { id: 'clock', k: 'clock', side: 'R', z: -20, h: 0.4, yb: 2.3, clock: true },
        { id: 'cam',   k: 'camera', side: 'R', z: -2, h: 0.25, top: 0.4, yaw: 0.5 }
    ],
    hotel: [
        { id: 'door1', k: 'door_hotel', side: 'L', z: -18, h: 2.3 },
        { id: 'door2', k: 'door_hotel', side: 'L', z: -6,  h: 2.3 },
        { id: 'door3', k: 'door_hotel', side: 'L', z: 6,   h: 2.3 },
        { id: 'frameA', k: 'frame2', side: 'L', z: -12, h: 0.8, yb: 1.3 },
        { id: 'alarm', k: 'alarm', side: 'L', z: 0, h: 0.18, yb: 1.3 },
        { id: 'ext',   k: 'ext',   side: 'L', z: -9, h: 0.7 },
        { id: 'sofa',  k: 'sofa',  side: 'R', z: -8, h: 0.8, solid: true },
        { id: 'frameC', k: 'frame3', side: 'R', z: -2, h: 0.55, yb: 1.35 },
        { id: 'clock', k: 'clock', side: 'R', z: -12.5, h: 0.4, yb: 2.0, clock: true },
        { id: 'console', k: 'console', side: 'R', z: -17, h: 0.95, solid: true },
        { id: 'frameB', k: 'frame1', side: 'R', z: -17, h: 0.5, yb: 1.5 },
        { id: 'fan',   k: 'fan', side: 'C', z: -14, len: 1.3, top: 0, face: 'back', spin: 0.9 }
    ]
};

// =============================================================
// FABRIQUES D'ANOMALIES. Chaque anomalie = { name, fx(P) } ; fx modifie les paramètres de construction P :
// P.hide(id) · P.mod(id, {...}) · P.add(objet) · P.anim.push(fn(t, dt, S)) · P.post.push(fn(S))
// =============================================================
function anomalyCanvasText(lines, w, h, color, font) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = font;
    g.shadowColor = color; g.shadowBlur = 18;
    const step = h / (lines.length + 1);
    lines.forEach((l, i) => g.fillText(l, w / 2 + (Math.random() * 6 - 3), step * (i + 1) + (Math.random() * 6 - 3)));
    g.shadowBlur = 0;
    g.fillStyle = color;
    for (let i = 0; i < 14; i++) {              // coulures
        const x = w * 0.15 + Math.random() * w * 0.7;
        g.fillRect(x, h * 0.55, 3 + Math.random() * 3, 20 + Math.random() * 70);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
}

function anomalyBloodTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
    const g = c.getContext('2d');
    for (let i = 0; i < 70; i++) {
        const x = 256 + (Math.random() - 0.5) * 300, y = Math.random() * 1024, r = 4 + Math.random() * 28;
        g.fillStyle = `rgba(${70 + Math.random() * 40},4,4,${0.55 + Math.random() * 0.4})`;
        g.beginPath(); g.ellipse(x, y, r, r * (0.6 + Math.random() * 0.8), Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(90,5,5,0.85)'; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {               // traînées
        g.lineWidth = 8 + Math.random() * 18;
        g.beginPath(); g.moveTo(256 + (Math.random() - 0.5) * 120, 1024);
        g.bezierCurveTo(256 + (Math.random() - 0.5) * 200, 800, 256 + (Math.random() - 0.5) * 200, 400, 256 + (Math.random() - 0.5) * 120, 40 + Math.random() * 300);
        g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
}

function anomalySilhouette() {
    const g = new THREE.Group();
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eye = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const add = (geo, mat, x, y, z, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rz) m.rotation.z = rz; g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.2, 0.25, 0.85, 12), black, 0, 1.25, 0);        // torse
    add(new THREE.SphereGeometry(0.16, 14, 12), black, 0, 1.85, 0);                 // tête
    add(new THREE.CylinderGeometry(0.1, 0.09, 0.85, 8), black, -0.11, 0.42, 0);     // jambes
    add(new THREE.CylinderGeometry(0.1, 0.09, 0.85, 8), black, 0.11, 0.42, 0);
    add(new THREE.CylinderGeometry(0.05, 0.04, 0.95, 8), black, -0.29, 1.15, 0);    // bras pendants
    add(new THREE.CylinderGeometry(0.05, 0.04, 0.95, 8), black, 0.29, 1.15, 0);
    add(new THREE.SphereGeometry(0.022, 8, 8), eye, -0.06, 1.88, 0.14);             // yeux
    add(new THREE.SphereGeometry(0.022, 8, 8), eye, 0.06, 1.88, 0.14);
    return g;
}

const AN = {
    redNeons:   () => ({ name: "Les néons virent au rouge",      fx: P => { P.neonColor = 0xff1a1a; } }),
    blackout:   () => ({ name: "Coupure de courant totale",       fx: P => { P.blackout = true; } }),
    narrow:     () => ({ name: "Le couloir est plus étroit",      fx: P => { P.wallDist = 2.5; } }),
    lowCeiling: () => ({ name: "Le plafond est plus bas",         fx: P => { P.ceilingHeight = 2.1; } }),
    tilt:       () => ({ name: "Le couloir est penché sur le côté", fx: P => { P.tilt = Math.PI / 12; } }),
    fog:        () => ({ name: "Une brume épaisse envahit le couloir", fx: P => { P.fogNear = 1.5; P.fogFar = 11; } }),
    throb:      () => ({ name: "Le couloir palpite comme s'il respirait", fx: P => { P.camThrob = 0.1; } }),
    wallTint:   (c, n) => ({ name: n, fx: P => { P.wallTint = c; } }),
    sign:       () => ({ name: "Le panneau de sortie indique « NE PAS SORTIR »", fx: P => { P.satanic = true; } }),
    eyes:       () => ({ name: "L'affiche vous fixe des yeux", fx: P => { P.eyesPoster = true; } }),
    carpet:     () => ({ name: "Les motifs de la moquette ont pivoté de 90 degrés", fx: P => { P.floorRot = Math.PI / 2; } }),

    strobe: () => ({ name: "Les néons clignotent frénétiquement", fx: P => {
        P.anim.push((t, dt, S) => {
            const on = Math.floor(t * 14) % 2 === 0;
            S.noFlicker = true;
            S.lamps.forEach(l => { if (l.light) l.light.intensity = on ? 1.6 : 0; l.mat.emissiveIntensity = on ? 1.4 : 0; });
        });
    } }),
    neonsDie: () => ({ name: "Les néons s'éteignent un à un derrière vous", fx: P => {
        P.anim.push((t, dt, S) => {
            S.noFlicker = true;
            S.lamps.forEach(l => { if (S.camera.position.z < l.z - 0.5) { if (l.light) l.light.intensity = 0; l.mat.emissiveIntensity = 0; } });
        });
    } }),

    hide:   (id, n) => ({ name: n, fx: P => P.hide(id) }),
    flip:   (id, n) => ({ name: n, fx: P => P.mod(id, { flip: true }) }),
    tint:   (id, c, n) => ({ name: n, fx: P => P.mod(id, { tint: c }) }),
    shift:  (id, dz, n) => ({ name: n, fx: P => P.mod(id, { dz: dz }) }),
    mirror: (id, n) => ({ name: n, fx: P => P.mod(id, { flipSide: true }) }),
    blank:  (ids, n) => ({ name: n, fx: P => ids.forEach(i => P.mod(i, { blank: true })) }),
    float:  (id, n) => ({ name: n, fx: P => {
        P.mod(id, { dy: 0.55 });
        P.anim.push((t, dt, S) => {
            const o = S.props[id]; if (!o) return;
            if (o.userData.y0 == null) o.userData.y0 = o.position.y;
            o.position.y = o.userData.y0 + Math.sin(t * 1.5) * 0.12;
        });
    } }),
    spin:   (id, v, n) => ({ name: n, fx: P => P.mod(id, { spin: v }) }),
    clockSpin: (f, n) => ({ name: n, fx: P => { P.clockSpeed = f; } }),
    sway:   (ids, n) => ({ name: n, fx: P => {
        P.anim.push((t, dt, S) => ids.forEach((id, i) => { const o = S.props[id]; if (o) o.rotation.z = Math.sin(t * 1.4 + i) * 0.35; }));
    } }),

    block: (def, n) => ({ name: n, fx: P => P.add(Object.assign({ solid: true, side: 'C', face: 'back' }, def)) }),
    approach: (def, from, to, speed, n) => ({ name: n, fx: P => P.add(Object.assign({}, def, {
        side: 'C', face: 'back', z: from,
        onPlaced: (o, S) => S.anim.push((t, dt) => { o.position.z = Math.min(to, o.position.z + speed * dt); })
    })) }),

    silhouette: (n) => ({ name: n || "Une silhouette sombre se tient au fond du couloir", fx: P => P.post.push(S => {
        const s = anomalySilhouette(); s.position.set(0.4, 0, -21); S.group.add(s);
    }) }),
    silhouetteApproach: () => ({ name: "Une silhouette avance lentement vers vous", fx: P => P.post.push(S => {
        const s = anomalySilhouette(); s.position.set(-0.5, 0, -24); S.group.add(s);
        S.anim.push((t, dt) => { s.position.z = Math.min(-4, s.position.z + 0.35 * dt); });
    }) }),

    blood: () => ({ name: "Des traces de sang maculent le sol", fx: P => P.post.push(S => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(S.wallDist * 0.9, 12), new THREE.MeshStandardMaterial({
            map: anomalyBloodTexture(), transparent: true, depthWrite: false, roughness: 0.15, metalness: 0,
            polygonOffset: true, polygonOffsetFactor: -2
        }));
        m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, -12); S.group.add(m);
    }) }),
    strip: () => ({ name: "Une bande jaune brillante apparaît au sol", fx: P => P.post.push(S => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 60), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, -10); S.group.add(m);
    }) }),
    wallText: (lines, z, n) => ({ name: n || "Un message est écrit sur le mur", fx: P => P.post.push(S => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.9), new THREE.MeshBasicMaterial({
            map: anomalyCanvasText(lines, 1024, 330, '#b30000', 'bold 110px sans-serif'), transparent: true, depthWrite: false }));
        m.rotation.y = -Math.PI / 2; m.position.set(S.wallDist - 0.015, 1.7, z); S.group.add(m);
    }) }),
    hole: (z, n) => ({ name: n, fx: P => P.post.push(S => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), new THREE.MeshBasicMaterial({ color: 0x030303 }));
        m.rotation.y = Math.PI / 2; m.position.set(-S.wallDist + 0.03, 1.1, z); S.group.add(m);
    }) }),
    alarmFlash: (z, n) => ({ name: n || "L'alarme incendie clignote en rouge", fx: P => P.post.push(S => {
        const pl = new THREE.PointLight(0xff0000, 0, 9);
        pl.position.set(-S.wallDist + 0.6, 1.8, z); S.group.add(pl);
        S.anim.push(t => { pl.intensity = Math.sin(t * 7) > 0 ? 3.5 : 0.1; });
    }) }),
    camFollow: (id, n) => ({ name: n || "La caméra de surveillance vous suit du regard", fx: P => {
        P.anim.push((t, dt, S) => {
            const o = S.props[id]; if (!o) return;
            const target = Math.atan2(S.camera.position.x - o.position.x, S.camera.position.z - o.position.z);
            o.rotation.y = target - (o.userData.faceAngle || 0);
        });
    } }),
    wet: (n) => AN.block({ id: 'x_wet', k: 'wet', x: 0.6, z: -9, h: 0.65 }, n || "Un panneau « sol glissant » est apparu")
};

// Bruit associé à chaque type d'anomalie (voir SFX dans la partie son)
const SFX_BY_FACTORY = {
    redNeons: 'buzz', blackout: 'slam', narrow: 'creak', lowCeiling: 'creak', tilt: 'creak', fog: 'whisper',
    throb: 'heartbeat', wallTint: 'heartbeat', sign: 'whisper', eyes: 'whisper', carpet: 'creak', strobe: 'buzz',
    neonsDie: 'buzz', hide: 'creak', flip: 'slam', tint: 'heartbeat', shift: 'slam', mirror: 'creak', blank: 'whisper',
    float: 'creak', spin: 'whirr', clockSpin: 'tick', sway: 'creak', block: 'slam', approach: 'rattle',
    silhouette: 'heartbeat', silhouetteApproach: 'heartbeat', blood: 'drip', strip: 'static', wallText: 'whisper',
    hole: 'whisper', alarmFlash: 'alarm', camFollow: 'static', wet: 'creak'
};
Object.keys(SFX_BY_FACTORY).forEach(k => {
    const f = AN[k];
    AN[k] = function() { const r = f.apply(null, arguments); r.sfx = SFX_BY_FACTORY[k]; return r; };
});

const ANOMALY_DEFS = {};
function defineAnomalies(theme, list) {
    ANOMALY_DEFS[theme] = {};
    THEMES_CONFIG[theme].anomalies = {};
    list.forEach((a, i) => { ANOMALY_DEFS[theme][i + 1] = a; THEMES_CONFIG[theme].anomalies[i + 1] = a.name; });
}

// ------------------------------- MÉTRO -------------------------------
defineAnomalies('metro', [
    AN.redNeons(), AN.blackout(), AN.sign(), AN.narrow(), AN.lowCeiling(), AN.strip(),
    AN.silhouette(), AN.silhouetteApproach(), AN.eyes(),
    AN.float('bench', "Le banc flotte au-dessus du sol"),
    AN.flip('bench', "Le banc est renversé"),
    AN.mirror('bench', "Le banc est de l'autre côté du couloir"),
    AN.hide('bin', "La poubelle a disparu"),
    AN.hide('phone', "Le téléphone public a disparu"),
    AN.hide('ext', "L'extincteur a disparu"),
    AN.block({ id: 'x_bin', k: 'bin', x: 0.3, z: -8, h: 0.95 }, "Une poubelle est posée au milieu du couloir"),
    AN.wet(),
    AN.camFollow('cam'),
    AN.clockSpin(60, "L'horloge tourne à toute vitesse"),
    AN.wallText(['ILS SONT', 'DERRIÈRE TOI'], -16.5, "« ILS SONT DERRIÈRE TOI » est écrit sur le mur"),
    AN.alarmFlash(-12),
    AN.blood(),
    AN.shift('door2', 2.6, "Une porte a changé de place"),
    AN.hide('clock', "L'horloge murale a disparu"),
    AN.fog(), AN.neonsDie(), AN.strobe(), AN.tilt(),
    AN.wallTint(0xe08a8a, "Les murs prennent une teinte rougeâtre"),
    AN.sway(['lamp1', 'lamp2'], "Les lampes se balancent dans le vide")
]);

// ------------------------------ HÔPITAL ------------------------------
defineAnomalies('hopital', [
    AN.redNeons(), AN.blackout(), AN.narrow(), AN.lowCeiling("Le plafond s'est partiellement effondré"), AN.tilt(), AN.fog(),
    AN.strobe(), AN.neonsDie(), AN.silhouette(), AN.silhouetteApproach(), AN.blood(), AN.throb(),
    AN.wallText(['VOUS N\'ÊTES', 'PAS SORTI'], -16.5, "« VOUS N'ÊTES PAS SORTI » est écrit sur le mur"),
    AN.hide('ext', "L'extincteur a disparu"),
    AN.hide('cart', "Le chariot médical a disparu"),
    AN.hide('chair', "Le fauteuil roulant a disparu"),
    AN.hide('dbl', "La porte à battants a disparu"),
    AN.hide('clock', "L'horloge murale a disparu"),
    AN.flip('chair', "Le fauteuil roulant est renversé"),
    AN.float('cart', "Le chariot flotte au-dessus du sol"),
    AN.block({ id: 'x_chair', k: 'wheelchair', x: 0, z: -8, h: 1.0 }, "Un fauteuil roulant est au milieu du couloir"),
    AN.approach({ id: 'x_chair2', k: 'wheelchair', h: 1.0 }, -22, -4, 0.45, "Un fauteuil roulant avance tout seul"),
    AN.tint('door3', 0xff3030, "Une porte est rouge sang"),
    AN.shift('door2', 2.6, "Une porte a changé de place"),
    { name: "Une porte respire imperceptiblement", sfx: 'heartbeat', fx: P => P.anim.push((t, dt, S) => {
        const o = S.props.door2; if (!o) return;
        const k = 1 + Math.sin(t * 2) * 0.05; o.scale.set(1, k, k);
    }) },
    AN.camFollow('cam'),
    AN.clockSpin(-40, "L'horloge tourne à l'envers à toute vitesse"),
    AN.alarmFlash(-12),
    AN.hole(-1, "Un trou noir est percé dans le mur"),
    AN.wet(),
    AN.wallTint(0x9fc7a0, "Les murs ont une teinte verdâtre malsaine")
]);

// ------------------------------- HÔTEL -------------------------------
defineAnomalies('hotel', [
    AN.redNeons(), AN.blackout(), AN.narrow(), AN.lowCeiling("La hauteur du couloir rétrécit brutalement"), AN.fog(),
    AN.carpet(),
    AN.tint('door2', 0xff2a2a, "Une porte est peinte en rouge"),
    AN.shift('door2', 2.6, "Une porte a changé de place"),
    AN.block({ id: 'x_sofa', k: 'sofa', x: 0, z: -8, h: 0.8 }, "Un canapé bloque le milieu du couloir"),
    AN.hide('sofa', "Le canapé a disparu"),
    AN.mirror('sofa', "Le canapé est de l'autre côté du couloir"),
    AN.hide('console', "La console a disparu"),
    AN.blank(['frameA', 'frameB', 'frameC'], "Les personnages des tableaux ont disparu"),
    AN.flip('frameA', "Un tableau est accroché à l'envers"),
    AN.hide('frameB', "Un tableau a disparu"),
    AN.hide('clock', "L'horloge murale a disparu"),
    AN.clockSpin(60, "L'horloge tourne à toute vitesse"),
    AN.spin('fan', 9, "Le ventilateur de plafond tourne très vite"),
    AN.spin('fan', 0, "Le ventilateur de plafond s'est arrêté"),
    AN.hide('fan', "Le ventilateur de plafond a disparu"),
    AN.neonsDie(), AN.strobe(), AN.silhouette(), AN.silhouetteApproach(), AN.blood(),
    AN.wallText(['SORTEZ', 'MAINTENANT'], -22, "« SORTEZ MAINTENANT » est écrit sur le mur"),
    AN.alarmFlash(0),
    AN.hide('ext', "L'extincteur a disparu"),
    AN.wet(),
    AN.wallTint(0x6e4a3f, "Le papier peint noircit comme s'il moisissait"),
    AN.throb()
]);


const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');   // obligatoire pour utiliser des images d'un autre domaine dans WebGL
const textureCache = {};

// --- Textures PBR locales : ./textures/<décor>/<surface>_color.jpg, _normal.jpg, _rough.jpg ---
// Si un fichier est introuvable, la surface retombe sur une couleur unie (le jeu ne plante pas).
const pbrCache = {};
window.loadPBRTexture = function(url, rx, ry, isColor) {
    const key = url + '|' + rx + '|' + ry;
    if (pbrCache[key]) return pbrCache[key];
    const tex = textureLoader.load(url, () => {
        tex._pbr.loaded = true;
        tex._pbr.waiters.splice(0).forEach(f => f(true));
    }, undefined, () => {
        tex._pbr.failed = true;
        (tex._pbr.users || []).forEach(u => {          // retire la texture manquante des matériaux déjà créés
            u.mat[u.prop] = null;
            if (u.prop === 'map') u.mat.color.setHex(u.fallback);
            u.mat.needsUpdate = true;
        });
        tex._pbr.waiters.splice(0).forEach(f => f(false));
    });
    tex._pbr = { failed: false, loaded: false, users: [], waiters: [] };   // THREE r128 : pas de champ userData sur les textures
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    if (isColor) tex.encoding = THREE.sRGBEncoding;
    pbrCache[key] = tex;
    return tex;
};

window.whenTextureReady = function(tex, cb) {
    if (tex._pbr.loaded) cb(true);
    else if (tex._pbr.failed) cb(false);
    else tex._pbr.waiters.push(cb);
};

window.makeSurfaceMaterial = function(theme, surface, rx, ry, rotation, fallbackColor) {
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 0.85, metalness: 0.0 });
    if (!THEMES_CONFIG[theme].pbr) return mat;
    const maxAniso = state.anomalyData.renderer ? state.anomalyData.renderer.capabilities.getMaxAnisotropy() : 4;
    const base = `./textures/${THEMES_CONFIG[theme].texDir || theme}/${surface}_`;
    [['map', 'color', true], ['normalMap', 'normal', false], ['roughnessMap', 'rough', false]].forEach(([prop, file, isColor]) => {
        const tex = window.loadPBRTexture(base + file + '.jpg', rx, ry, isColor);
        tex.anisotropy = maxAniso;
        tex.rotation = rotation || 0;
        if (tex._pbr.failed) return;
        mat[prop] = tex;
        tex._pbr.users.push({ mat: mat, prop: prop, fallback: fallbackColor });
        if (prop === 'map') mat.color.setHex(0xffffff);
        if (prop === 'roughnessMap') mat.roughness = 1.0;
    });
    return mat;
};

// --- Modèles 3D (GLTF) : ./models/<chemin de MODELS> ---
// Chargé une seule fois, puis cloné à chaque couloir. Si le fichier est absent, le jeu continue sans l'objet.
const modelCache = {};
window.loadGLTFModel = function(key, cb, onFail) {
    const spec = MODELS[key];
    if (!spec) { if (onFail) onFail(); return; }
    const m = modelCache[key];
    if (m && m.failed) { if (onFail) onFail(); return; }
    if (m && m.obj) { cb(m.obj.clone(true)); return; }
    if (m) { m.waiting.push(cb); if (onFail) m.failWaiting.push(onFail); return; }
    if (!THREE.GLTFLoader) { modelCache[key] = { failed: true }; if (onFail) onFail(); return; }
    const entry = modelCache[key] = { obj: null, failed: false, waiting: [cb], failWaiting: onFail ? [onFail] : [] };
    new THREE.GLTFLoader().load(`./models/${spec.path}`, gltf => {
        gltf.scene.traverse(c => { c.userData.keep = true; });   // ressources partagées : ne pas les détruire au nettoyage
        entry.obj = gltf.scene;
        const w = entry.waiting; entry.waiting = []; entry.failWaiting = [];
        w.forEach(f => f(entry.obj.clone(true)));
    }, undefined, err => {
        entry.failed = true;
        const fw = entry.failWaiting; entry.waiting = []; entry.failWaiting = [];
        console.warn('Modèle 3D introuvable (ignoré) :', spec.path, err && err.message);
        fw.forEach(f => f());
    });
};

// --- Éclairage HDR (./hdr/*.hdr) : reflets et lumière d'ambiance réalistes ---
const envCache = {};
let envPmrem = null;
window.ensureRGBELoader = function(cb) {
    if (THREE.RGBELoader) { cb(true); return; }
    if (window._rgbeQueue) { window._rgbeQueue.push(cb); return; }
    window._rgbeQueue = [cb];
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/RGBELoader.js';
    const done = ok => { const q = window._rgbeQueue || []; window._rgbeQueue = null; q.forEach(f => f(ok)); };
    s.onload = () => done(!!THREE.RGBELoader);
    s.onerror = () => done(false);
    document.head.appendChild(s);
};
window.loadThemeEnvironment = function(theme, cb, onFail) {
    const file = THEMES_CONFIG[theme] && THEMES_CONFIG[theme].hdr;
    const renderer = window.ensureAnomalyRenderer();
    if (!file || !renderer) { if (onFail) onFail(); return; }
    const c = envCache[theme];
    if (c && c.tex) { cb(c.tex); return; }
    if (c && c.failed) { if (onFail) onFail(); return; }
    if (c) { c.waiting.push(cb); if (onFail) c.failWaiting.push(onFail); return; }
    const entry = envCache[theme] = { tex: null, failed: false, waiting: [cb], failWaiting: onFail ? [onFail] : [] };
    const fail = () => { entry.failed = true; const fw = entry.failWaiting; entry.waiting = []; entry.failWaiting = []; fw.forEach(f => f()); };
    window.ensureRGBELoader(ok => {
        if (!ok) { fail(); return; }
        envPmrem = envPmrem || new THREE.PMREMGenerator(renderer);
        new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load(`./hdr/${file}`, hdr => {
            const rt = envPmrem.fromEquirectangular(hdr);
            hdr.dispose();
            entry.tex = rt.texture;
            const w = entry.waiting; entry.waiting = []; entry.failWaiting = [];
            w.forEach(f => f(entry.tex));
        }, undefined, err => { console.warn('HDR introuvable (ignoré) :', file, err && err.message); fail(); });
    });
};

// --- Renderer WebGL unique (créé tôt pour pouvoir envoyer les textures au GPU pendant le chargement) ---
window.ensureAnomalyRenderer = function() {
    state.anomalyData = state.anomalyData || {};
    if (!state.anomalyData.renderer) {
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.domElement.style.display = 'block';
        state.anomalyData.renderer = renderer;
    }
    return state.anomalyData.renderer;
};

// --- PRÉCHARGEMENT : télécharge et envoie au GPU textures, modèles et HDR d'un décor ---
const EXTRA_MODELS = { metro: ['bin', 'wet'], hopital: ['wheelchair', 'wet'], hotel: ['sofa', 'wet'] };
const SURFACE_REPEATS = { wall: [37, 2], floor: [4, 34], ceiling: [3, 26] };
const preloadJobs = {};
const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'alphaMap'];

window.preloadAnomalyAssets = function(theme, onProgress, onDone) {
    if (!THEMES_CONFIG[theme]) theme = 'metro';
    let job = preloadJobs[theme];
    if (!job) { job = preloadJobs[theme] = { done: false, ratio: 0, text: 'Chargement...', progress: [], finish: [], failed: [] }; runAnomalyPreload(theme, job); }
    if (onProgress) { job.progress.push(onProgress); onProgress(job.ratio, job.text); }
    if (onDone) { if (job.done) onDone(); else job.finish.push(onDone); }
    return job;
};

function runAnomalyPreload(theme, job) {
    const renderer = window.ensureAnomalyRenderer();
    const themeData = THEMES_CONFIG[theme];
    const uploads = new Set();
    let total = 0, done = 0, finished = false;

    const report = (text) => {
        if (text) job.text = text;
        job.ratio = total ? Math.min(0.8, 0.8 * done / total) : 0;
        job.progress.forEach(f => f(job.ratio, job.text));
    };
    const complete = () => {
        if (job.done) return;
        job.done = true; job.ratio = 1; job.text = 'Prêt !';
        job.progress.forEach(f => f(1, job.text));
        const fin = job.finish; job.finish = []; fin.forEach(f => f());
    };
    const warmUp = () => {
        if (finished) return; finished = true;
        const list = Array.from(uploads);
        let i = 0;
        const next = () => {
            if (i >= list.length) { complete(); return; }
            try { if (renderer.initTexture) renderer.initTexture(list[i]); } catch (e) { /* ignoré */ }
            i++;
            job.ratio = 0.8 + 0.2 * i / list.length;
            job.text = 'Préparation de la carte graphique...';
            job.progress.forEach(f => f(job.ratio, job.text));
            setTimeout(next, 0);
        };
        next();
    };
    const step = () => { done++; report(); if (done >= total) warmUp(); };

    // textures du couloir
    if (themeData.pbr) {
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        Object.keys(SURFACE_REPEATS).forEach(surface => {
            const [rx, ry] = SURFACE_REPEATS[surface];
            [['color', true], ['normal', false], ['rough', false]].forEach(([file, isColor]) => {
                total++;
                const tex = window.loadPBRTexture(`./textures/${themeData.texDir || theme}/${surface}_${file}.jpg`, rx, ry, isColor);
                tex.anisotropy = maxAniso;
                window.whenTextureReady(tex, ok => { if (ok) uploads.add(tex); else job.failed.push(`${surface}_${file}.jpg`); step(); });
            });
        });
    }
    // modèles 3D
    const keys = new Set((PROP_LAYOUT[theme] || []).map(d => d.k));
    (EXTRA_MODELS[theme] || []).forEach(k => keys.add(k));
    keys.forEach(k => {
        if (!MODELS[k]) return;
        total++;
        window.loadGLTFModel(k, obj => {
            obj.traverse(m => {
                if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
                TEX_SLOTS.forEach(slot => { if (m.material[slot] && m.material[slot].image) uploads.add(m.material[slot]); });
            });
            step();
        }, () => { job.failed.push(k); step(); });
    });
    // éclairage HDR
    if (themeData.hdr) { total++; window.loadThemeEnvironment(theme, step, () => { job.failed.push('HDR ' + themeData.hdr); step(); }); }

    report('Chargement du décor...');
    if (!total) { complete(); return; }
    setTimeout(() => { if (!finished) { console.warn('Préchargement trop long : on lance la partie quand même.'); warmUp(); } }, 45000);
}

// Appelé dès que l'hôte choisit le mode Anomalies : commence à télécharger pendant l'attente au salon
let warmTimer = null, warmTheme = null;
window.warmupAnomaly = function(theme) {
    if (!theme || !THEMES_CONFIG[theme] || preloadJobs[theme]) return;
    warmTheme = theme; clearTimeout(warmTimer);
    warmTimer = setTimeout(() => { if (warmTheme === theme) window.preloadAnomalyAssets(theme); }, 2000);
};

// Moquette rayée générée par le code (décor sans textures) : tourne de 90° pour l'anomalie « Hôtel 1 »
let carpetTexCache = null;
window.getCarpetTexture = function() {
    if (carpetTexCache) return carpetTexCache;
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#5b2c2c'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#c9a227';
    for (let x = 0; x < 256; x += 64) g.fillRect(x + 28, 0, 8, 256);
    g.fillStyle = '#7a3b3b';
    for (let x = 0; x < 256; x += 64) g.fillRect(x + 10, 0, 4, 256);
    carpetTexCache = new THREE.CanvasTexture(c);
    carpetTexCache.wrapS = carpetTexCache.wrapT = THREE.RepeatWrapping;
    carpetTexCache.encoding = THREE.sRGBEncoding;
    return carpetTexCache;
};

window.loadRealTexture = function(url, repeatX = 1, repeatY = 1) {
            if (textureCache[url]) return textureCache[url];
            const tex = textureLoader.load(url);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX, repeatY);
            textureCache[url] = tex;
            return tex;
}

window.createSubwayWallTexture = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 512, 512); // Mur blanc
            
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3;
            for (let y = 0; y < 512; y += 32) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
                let offset = (y / 32) % 2 === 0 ? 0 : 32;
                for (let x = 0; x < 512; x += 64) {
                    ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + 32); ctx.stroke();
                }
            }
            // Bande verte signature de métro
            ctx.fillStyle = '#059669'; ctx.fillRect(0, 224, 512, 32);
            ctx.fillStyle = '#047857'; ctx.fillRect(0, 256, 512, 16);
            
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 3);
            return tex;
}

window.createTactileFloorTexture = function(hasAnomaly, anomalyId) {
            const canvas = document.createElement('canvas');
            canvas.width = 1024; canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 0, 1024, 1024); // Béton gris
            
            // Texture granuleuse
            for(let i=0; i<15000; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#cbd5e1' : '#64748b';
                ctx.fillRect(Math.random()*1024, Math.random()*1024, 2, 2);
            }

            // Bande podotactile jaune
            if (!(hasAnomaly && anomalyId === 17)) {
                ctx.fillStyle = '#eab308'; ctx.fillRect(448, 0, 128, 1024);
                ctx.fillStyle = '#ca8a04';
                for(let y=0; y<1024; y+=32) {
                    for(let x=464; x<576; x+=32) {
                        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.fill();
                    }
                }
            }
            
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4;
            for(let i=0; i<=1024; i+=256) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 20); // S'étire sur la longueur
            return tex;
}

window.createPosterTexture = function(type) {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 384;
            const ctx = canvas.getContext('2d');
            
            if (type === 'eyes') {
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 384);
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.ellipse(80, 192, 40, 20, 0, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(176, 192, 40, 20, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#f00';
                ctx.beginPath(); ctx.arc(80, 192, 10, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(176, 192, 10, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 384);
                ctx.fillStyle = '#3b82f6'; ctx.fillRect(10, 10, 236, 150);
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 32px sans-serif'; ctx.fillText('VOYAGEZ', 20, 200);
                ctx.font = '18px sans-serif'; ctx.fillText('Découvrez le monde.', 20, 240);
            }
            return new THREE.CanvasTexture(canvas);
}

window.createStageSignTexture = function(stage, hasAnomaly, anomalyId) {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fde047'; ctx.fillRect(0, 0, 512, 256);
            ctx.strokeStyle = '#000000'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 496, 240);
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            
            if (hasAnomaly && anomalyId === 12) {
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 50px sans-serif'; ctx.fillText('NE PAS', 256, 90);
                ctx.fillText('SORTIR', 256, 160);
            } else {
                ctx.font = 'bold 70px sans-serif'; ctx.fillText('SORTIE', 256, 90);
                ctx.font = 'bold 110px sans-serif'; ctx.fillText(stage, 256, 190);
            }
            return new THREE.CanvasTexture(canvas);
}

// =============================================================
// SON : tout est synthétisé par le navigateur (Web Audio) : aucun fichier n'est nécessaire.
// Pour utiliser tes propres sons, remplis SOUND_FILES (chemins relatifs, ex. 'sounds/metro/ambiance_loop.mp3').
// =============================================================
const SOUND_FILES = {
    ambience: { metro: null, hopital: null, hotel: null },   // boucle d'ambiance par décor
    sfx: {}                                                   // ex. { whisper: 'sounds/whisper.mp3', slam: 'sounds/door_slam.mp3' }
};
const SFX_POOL = ['creak', 'whisper', 'slam', 'static', 'drip'];   // bruits au hasard quand l'anomalie n'a pas de son attitré
const AMB_PROFILES = {
    metro:   { base: 55, air: 420,  airQ: 0.6, airGain: 0.030, buzz: 0.010 },
    hopital: { base: 50, air: 1800, airQ: 0.8, airGain: 0.018, buzz: 0.016 },
    hotel:   { base: 62, air: 300,  airQ: 0.5, airGain: 0.035, buzz: 0.004 }
};

window.anomalyAudio = (function() {
    let ctx = null, master = null, noise = null, amb = null, ambTheme = null, timers = [];
    let muted = false;
    try { muted = localStorage.getItem('anomalyMuted') === '1'; } catch (e) { /* ignoré */ }
    const bufCache = {};

    function init() {
        if (ctx) return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.9;
        master.connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return ctx;
    }
    function unlock() { if (init() && ctx.state === 'suspended') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } }

    const now = () => ctx.currentTime;
    function noiseSrc(loop) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = !!loop; return s; }
    function outTo(node, p) {
        if (p && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = p; node.connect(pn); pn.connect(master); }
        else node.connect(master);
    }
    function env(g, t0, attack, peak, dur) {
        g.gain.cancelScheduledValues(t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
    }
    function tone(type, f0, f1, dur, peak, p, t0) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t0);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        env(g, t0, 0.01, peak, dur);
        o.connect(g); outTo(g, p);
        o.start(t0); o.stop(t0 + dur + 0.1);
    }
    function burst(type, freq, q, dur, peak, p, t0, attack) {
        const a = attack || 0.005;
        const s = noiseSrc(false), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = type; f.frequency.value = freq; f.Q.value = q;
        env(g, t0, a, peak, dur);
        s.connect(f); f.connect(g); outTo(g, p);
        s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + a + 0.1);
    }

    const SFX = {
        step:  (o) => { const t = now(); burst('lowpass', o.hard ? 1500 : 520, 0.7, 0.09, o.loud || 0.17, (Math.random() - 0.5) * 0.3, t); tone('sine', 70, 45, 0.08, 0.10, 0, t); },
        whoosh:() => burst('bandpass', 600, 0.8, 0.35, 0.12, 0, now(), 0.12),
        chime: () => { const t = now(); tone('sine', 880, 880, 0.35, 0.07, 0, t); tone('sine', 1320, 1320, 0.3, 0.045, 0, t + 0.09); },
        fail:  () => { const t = now(); tone('sine', 150, 38, 0.9, 0.35, 0, t); burst('lowpass', 220, 0.5, 0.7, 0.25, 0, t); },
        slam:  () => { const t = now(); tone('sine', 90, 28, 0.7, 0.5, (Math.random() - 0.5) * 1.4, t); burst('lowpass', 300, 0.5, 0.5, 0.4, 0, t); },
        creak: () => {
            const t = now(), p = Math.random() * 1.6 - 0.8;
            const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
            const l = ctx.createOscillator(), lg = ctx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(60, t + 1.4);
            f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 8;
            l.frequency.value = 17; lg.gain.value = 14; l.connect(lg); lg.connect(o.frequency);
            env(g, t, 0.15, 0.09, 1.3);
            o.connect(f); f.connect(g); outTo(g, p);
            o.start(t); l.start(t); o.stop(t + 1.6); l.stop(t + 1.6);
        },
        whisper: () => {
            const t = now(), p = Math.random() * 1.8 - 0.9;
            for (let i = 0; i < 7; i++) burst('bandpass', 1800 + Math.random() * 2400, 1.4, 0.18 + Math.random() * 0.12, 0.07, p, t + i * (0.16 + Math.random() * 0.12), 0.05);
        },
        heartbeat: () => {
            const t = now();
            for (let i = 0; i < 5; i++) { tone('sine', 58, 38, 0.16, 0.5, 0, t + i * 0.9); tone('sine', 52, 36, 0.14, 0.32, 0, t + i * 0.9 + 0.27); }
        },
        alarm: () => { const t = now(); for (let i = 0; i < 12; i++) tone('square', i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.28, 0.035, 0, t + i * 0.32); },
        static: () => { const t = now(); for (let i = 0; i < 4; i++) burst('highpass', 3000, 0.7, 0.12, 0.1, (Math.random() - 0.5) * 1.2, t + Math.random() * 1.2); },
        tick:  () => { const t = now(); for (let i = 0; i < 30; i++) burst('bandpass', 2400, 8, 0.03, 0.09, 0.5, t + i * 0.1); },
        rattle:() => { const t = now(), p = (Math.random() - 0.5) * 1.2; for (let i = 0; i < 16; i++) burst('lowpass', 220 + Math.random() * 90, 0.8, 0.2, 0.15, p, t + i * 0.22); },
        drip:  () => { const t = now(), p = (Math.random() - 0.5) * 1.4; tone('sine', 1800, 900, 0.12, 0.08, p, t); tone('sine', 1500, 800, 0.12, 0.05, p, t + 0.65); },
        whirr: () => burst('bandpass', 900, 1.0, 2.8, 0.07, 0, now(), 0.5),
        buzz:  () => { const t = now(); tone('sawtooth', 100, 100, 3, 0.035, 0, t); burst('highpass', 4000, 0.7, 3, 0.03, 0, t, 0.3); }
    };

    function loadBuffer(url, cb) {
        if (bufCache[url]) { cb(bufCache[url]); return; }
        fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then(ab => new Promise((ok, ko) => ctx.decodeAudioData(ab, ok, ko)))
            .then(buf => { bufCache[url] = buf; cb(buf); })
            .catch(err => console.warn('Son introuvable (ignoré) :', url, err && err.message));
    }
    function play(name, opts) {
        if (muted || !init()) return;
        const file = SOUND_FILES.sfx[name];
        if (file) {
            loadBuffer(file, buf => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = 0.8; s.connect(g); outTo(g, 0); s.start(); });
            return;
        }
        if (SFX[name]) { try { SFX[name](opts || {}); } catch (e) { /* un son ne doit jamais casser le jeu */ } }
    }

    function stopAmbience() {
        if (!amb) return;
        const old = amb; amb = null; ambTheme = null;
        old.out.gain.setTargetAtTime(0.0001, now(), 0.3);
        setTimeout(() => { old.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); }, 1800);
    }
    function startAmbience(theme, level) {
        if (!init()) return;
        if (amb && ambTheme === theme) { amb.out.gain.setTargetAtTime(level, now(), 0.4); return; }
        stopAmbience();
        const c = AMB_PROFILES[theme] || AMB_PROFILES.metro;
        const out = ctx.createGain();
        out.gain.value = 0.0001; out.gain.setTargetAtTime(level, now(), 0.8);
        out.connect(master);
        const nodes = [];
        const file = SOUND_FILES.ambience[theme];
        let buzzGain = ctx.createGain(); buzzGain.gain.value = 0;
        if (file) {
            loadBuffer(file, buf => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.loop = true; g.gain.value = 0.7; s.connect(g); g.connect(out); s.start(); nodes.push(s); });
        } else {
            [c.base, c.base * 1.5 + 0.7].forEach((f, i) => {            // drone grave : deux oscillateurs légèrement désaccordés
                const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
                o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = f;
                lp.type = 'lowpass'; lp.frequency.value = 180; g.gain.value = i ? 0.05 : 0.035;
                o.connect(lp); lp.connect(g); g.connect(out); o.start(); nodes.push(o);
            });
            const n = noiseSrc(true), bf = ctx.createBiquadFilter(), ng = ctx.createGain();   // souffle d'air
            bf.type = 'bandpass'; bf.frequency.value = c.air; bf.Q.value = c.airQ; ng.gain.value = c.airGain;
            n.connect(bf); bf.connect(ng); ng.connect(out); n.start(); nodes.push(n);
            const bo = ctx.createOscillator(), bh = ctx.createBiquadFilter();                   // grésillement des néons
            bo.type = 'square'; bo.frequency.value = 100; bh.type = 'highpass'; bh.frequency.value = 900;
            bo.connect(bh); bh.connect(buzzGain); buzzGain.connect(out); bo.start(); nodes.push(bo);
        }
        amb = { out: out, nodes: nodes, buzzGain: buzzGain, buzzBase: c.buzz };
        ambTheme = theme;
    }

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    // Appelé à chaque nouveau couloir : ambiance + bruit lié à l'anomalie (et parfois un faux bruit dans un couloir normal)
    function onScene(info) {
        if (!init()) return;
        clearTimers();
        startAmbience(info.theme, info.blackout ? 0.25 : 1);
        if (amb) amb.buzzGain.gain.setTargetAtTime(info.blackout ? 0 : amb.buzzBase, now(), 0.2);
        if (info.hasAnomaly) {
            const name = info.sfx || SFX_POOL[Math.floor(Math.random() * SFX_POOL.length)];
            later(1500 + Math.random() * 5500, () => play(name));
        } else if (info.stage > 0 && Math.random() < 0.2) {
            later(2500 + Math.random() * 7000, () => play(Math.random() < 0.5 ? 'creak' : 'drip'));
        }
    }
    function stopAll() { clearTimers(); stopAmbience(); }
    function setMuted(m) {
        muted = !!m;
        try { localStorage.setItem('anomalyMuted', muted ? '1' : '0'); } catch (e) { /* ignoré */ }
        if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.05);
    }

    return {
        unlock: unlock, play: play, onScene: onScene, stopAll: stopAll,
        step: (theme, sprint) => play('step', { hard: theme !== 'hotel', loud: sprint ? 0.26 : 0.17 }),
        isMuted: () => muted,
        toggleMute: () => { setMuted(!muted); if (!muted) unlock(); return muted; }
    };
})();

window.anomalyUpdateMuteBtn = function() {
    const b = document.getElementById('anomaly-mute-btn');
    if (b) b.innerHTML = window.anomalyAudio.isMuted() ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
};
window.anomalyToggleMute = function() { window.anomalyAudio.toggleMute(); window.anomalyUpdateMuteBtn(); };

window.anomalyToggleFullscreen = function() {
    const c = document.getElementById('anomaly-canvas-container');
    if (!c) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
        const req = c.requestFullscreen || c.webkitRequestFullscreen;
        if (req) { const r = req.call(c); if (r && r.catch) r.catch(() => {}); }
    }
};
window.anomalyOnFullscreenChange = function() {
    const b = document.getElementById('anomaly-fs-btn');
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (b) b.innerHTML = on ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
    setTimeout(() => { if (window.anomalyResize) window.anomalyResize(); }, 100);
};
if (!document.getElementById('anomaly-fs-style')) {     // en plein écran, le conteneur prend tout l'écran
    const st = document.createElement('style');
    st.id = 'anomaly-fs-style';
    st.textContent = '#anomaly-canvas-container:fullscreen{width:100vw!important;height:100vh!important;border-radius:0!important;border:0!important}#anomaly-canvas-container:-webkit-full-screen{width:100vw!important;height:100vh!important;border-radius:0!important;border:0!important}';
    document.head.appendChild(st);
}

// Lancement (hôte) : lit les paramètres du salon
window.startAnomalyGame = function() {
    if (!window.isHost) return;
    const code = window.currentCodeSalon || state.roomCode;
    if (!code || !window.mettreAJourSalonFirebase) return;

    const stages = Math.max(1, Math.min(20, parseInt(document.getElementById('setting-anomaly-stages')?.value, 10) || 8));
    const theme = document.getElementById('setting-anomaly-theme')?.value || 'metro';
    const timer = Math.max(60, Math.min(600, parseInt(document.getElementById('input-host-timer')?.value, 10) || 300));

    const updates = {
        status: 'IN_GAME',
        selectedMode: 'anomaly',
        'settings/timer': timer,
        'settings/anomalyStages': stages,
        'settings/anomalyTheme': theme,
        'settings/anomalyTimer': timer,
        anomalyGame: { status: 'PLAYING', targetStages: stages, theme: theme, timer: timer, startedAt: Date.now() }
    };
    Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(code, updates);
};

// Appelé à chaque mise à jour Firebase pendant le mode Anomalies
window.renderAnomalyScreen = function(data) {
    const g = data && data.anomalyGame;
    if (!g) return;
    window.latestAnomalyData = data;
    const sess = String(g.startedAt || 'anomaly');

    if (g.status === 'FINISHED') {
        if (window.anomalyShownResults !== sess) {
            window.anomalyShownResults = sess;
            if (state.anomalyGame) { state.anomalyGame.finished = true; clearInterval(state.anomalyGame.timerInterval); }
            if (document.pointerLockElement) document.exitPointerLock();
            window.anomalyAudio.stopAll();
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
            const ranking = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot)
                .sort((x, y) => (y.score || 0) - (x.score || 0));
            const progress = g.progress || {};
            const lb = document.getElementById('final-leaderboard');
            if (lb) {
                lb.innerHTML = ranking.map((p, i) => `
                    <div class="flex justify-between items-center p-3 rounded-2xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-900 border border-slate-800'} text-xs">
                        <span class="font-bold">#${i + 1} - ${anomalyEsc(p.name)} <span class="text-slate-400 font-normal">(sortie ${(progress[p.name] || {}).max || 0}/${g.targetStages})</span></span>
                        <span class="font-mono text-emerald-400 font-bold text-sm">${p.score || 0} pts</span>
                    </div>`).join('');
            }
            showScreen('screen-results');
        }
        return;
    }

    // Démarre la partie une seule fois par session (et non à chaque mise à jour Firebase)
    if (window.anomalySession !== sess) {
        window.anomalySession = sess;
        window.startAnomalyMode(g);
    }
    anomalyUpdateHud(data);
    if (window.isHost) anomalyHostAdvance(data);
};

function anomalyEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function anomalyUpdateHud(data) {
    const el = document.getElementById('anomaly-progress');
    if (!el) return;
    const g = data.anomalyGame;
    const progress = g.progress || {};
    el.innerHTML = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot).map(p => {
        const pr = progress[p.name] || {};
        return `<span class="px-2 py-1 rounded-lg border ${pr.done ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-700 text-slate-300'} bg-slate-900/70">
            ${anomalyEsc(p.name)} : ${pr.max || 0}/${g.targetStages} ${pr.done ? '✓' : ''}</span>`;
    }).join('');
}

// Hôte : quand tous les joueurs présents ont fini, calcule les scores et termine la partie
function anomalyHostAdvance(data) {
    const g = data.anomalyGame;
    if (!window.isHost || !g || g.status !== 'PLAYING') return;
    const present = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const progress = g.progress || {};
    if (!present.length || !present.every(n => progress[n] && progress[n].done)) return;

    const key = 'fin:' + g.startedAt;
    if (window.anomalyLock === key) return;
    window.anomalyLock = key;

    const updates = { 'anomalyGame/status': 'FINISHED' };
    present.forEach(n => { updates[`players/${n}/score`] = (progress[n].max || 0) * 1000 + (progress[n].bonus || 0); });
    window.update(window.ref(window.db, `salons/${window.currentCodeSalon}`), updates)
        .catch(err => { window.anomalyLock = null; console.error('Fin de partie Anomalies impossible :', err); });
}

window.anomalyPushProgress = function(done) {
    const code = window.currentCodeSalon || state.roomCode;
    const me = window.myPlayerKey || state.username;
    const g = state.anomalyGame;
    if (!code || !me || !g || !window.update) return;
    const bonus = (done && g.maxStageReached >= g.targetStages) ? Math.max(0, g.timeLeft) * 2 : 0;
    window.update(window.ref(window.db, `salons/${code}`), {
        [`anomalyGame/progress/${me}`]: { stage: g.stage, max: g.maxStageReached, done: !!done, bonus: bonus }
    }).catch(err => console.error('Progression Anomalies non envoyée :', err));
};

window.startAnomalyMode = function(cfg) {
    cfg = cfg || {};
    state.anomalyData = state.anomalyData || {};
    showScreen('screen-generic-game');
    document.getElementById('generic-game-title').innerText = "Couloir des Anomalies 3D";

    if (state.anomalyGame) clearInterval(state.anomalyGame.timerInterval);

    state.anomalyGame = {
        stage: 0,
        maxStageReached: 0,
        theme: THEMES_CONFIG[cfg.theme] ? cfg.theme : 'metro',
        targetStages: Number(cfg.targetStages) || 8,
        timeLeft: Number(cfg.timer) || 300,
        timerInterval: null,
        finished: false,
        hasAnomaly: false,
        anomalyId: -1,
        playerX: 0,
        playerZ: 10,
        yaw: 0,
        pitch: 0,
        walkTime: 0,
        isTransitioning: false,
        keys: {},
        historyLog: []
    };

    document.getElementById('generic-game-content').innerHTML = `
        <div class="space-y-3 w-full relative">
            <div class="flex justify-between items-center px-2 flex-wrap gap-2">
                <span class="text-xs font-bold text-indigo-400">Sortie actuelle : <span id="anomaly-stage-display" class="text-amber-400 text-sm font-black">Sortie 0</span> / ${state.anomalyGame.targetStages}</span>
                <span class="text-[11px] text-slate-400 font-medium">Contrôles : ZQSD ou Flèches | Souris pour regarder | <b class="text-indigo-300">Shift</b> courir | <b class="text-indigo-300">F</b> plein écran | <b class="text-indigo-300">M</b> son</span>
            </div>
            <div id="anomaly-progress" class="flex flex-wrap gap-2 px-2 text-[11px] font-mono"></div>

            <div id="anomaly-canvas-container" class="relative cursor-pointer rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-black" style="width:100%;height:clamp(380px,70vh,720px)">
                <div id="anomaly-loading" class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center transition-opacity duration-500">
                    <div class="text-lg font-black text-indigo-300 tracking-wide"><i class="fa-solid fa-door-open mr-2"></i>Chargement du couloir...</div>
                    <div class="w-64 max-w-full h-2 rounded-full bg-slate-800 overflow-hidden"><div id="anomaly-loading-bar" class="h-full bg-indigo-500 transition-all duration-300" style="width:0%"></div></div>
                    <div id="anomaly-loading-text" class="text-[11px] text-slate-400 font-mono">Chargement du décor...</div>
                    <div id="anomaly-loading-tip" class="text-xs text-slate-300 max-w-sm leading-relaxed"></div>
                </div>
                <div class="absolute top-2 right-2 z-20 flex gap-2">
                    <button id="anomaly-mute-btn" type="button" title="Son (M)" class="w-8 h-8 rounded-lg bg-slate-950/80 border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"><i class="fa-solid fa-volume-high"></i></button>
                    <button id="anomaly-fs-btn" type="button" title="Plein écran (F)" class="w-8 h-8 rounded-lg bg-slate-950/80 border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"><i class="fa-solid fa-expand"></i></button>
                </div>
                <div class="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-slate-950/70 px-3 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-200 font-mono pointer-events-none">
                    Sortie <b id="anomaly-hud-stage" class="text-amber-400">0</b> / ${state.anomalyGame.targetStages} · <span id="anomaly-hud-time">--:--</span>
                </div>
                <div class="absolute top-2 left-2 z-10 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-300 pointer-events-none">
                    <i class="fa-solid fa-mouse mr-1 text-indigo-400"></i> Cliquez pour capturer la souris
                </div>
                <div style="position:absolute;top:50%;left:50%;width:6px;height:6px;background:rgba(255,255,255,0.6);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:5"></div>
                <div style="position:absolute;inset:0;pointer-events:none;z-index:4;background:radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)"></div>
                <div style="position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0.10;mix-blend-mode:overlay;background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22/></svg>')"></div>
                <div id="anomaly-hint-banner" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/95 px-5 py-2.5 rounded-full border border-indigo-500/30 text-xs text-indigo-300 pointer-events-none text-center shadow-lg transition-opacity duration-500">
                    <b class="text-emerald-400"><i class="fa-solid fa-shield-halved"></i> Sortie 0 : Observez bien la référence (0 anomalie)</b>
                    <div class="text-[10px] text-slate-400 mt-1">Avancez si tout est normal, faites demi-tour s'il y a une anomalie.</div>
                </div>
            </div>
        </div>
    `;
    // Le conteneur est recréé à chaque partie : on (re)branche le clic ici
    document.getElementById('anomaly-canvas-container').addEventListener('click', anomalyRequestLock);
    const fsBtn = document.getElementById('anomaly-fs-btn'), muteBtn = document.getElementById('anomaly-mute-btn');
    if (fsBtn) fsBtn.addEventListener('click', e => { e.stopPropagation(); window.anomalyToggleFullscreen(); });
    if (muteBtn) muteBtn.addEventListener('click', e => { e.stopPropagation(); window.anomalyToggleMute(); });
    window.anomalyUpdateMuteBtn();

    const tick = () => {
        const g = state.anomalyGame;
        if (!g || g.finished) return;
        g.timeLeft--;
        const timerEl = document.getElementById('generic-game-timer');
        if (timerEl) {
            const mins = Math.floor(Math.max(0, g.timeLeft) / 60), secs = Math.max(0, g.timeLeft) % 60;
            timerEl.innerText = `Temps : ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        const hudT = document.getElementById('anomaly-hud-time');
        if (hudT) { const mm = Math.floor(Math.max(0, g.timeLeft) / 60), ss = Math.max(0, g.timeLeft) % 60; hudT.innerText = `${mm}:${ss < 10 ? '0' : ''}${ss}`; }
        if (g.timeLeft <= 0) finishAnomalyGame();
    };
    // Le chrono et la partie ne démarrent qu'une fois tout chargé (le temps de chargement n'est pas décompté)
    const gameObj = state.anomalyGame;
    const timerEl0 = document.getElementById('generic-game-timer');
    const hud0 = document.getElementById('anomaly-hud-time');
    if (hud0) hud0.innerText = `${Math.floor(gameObj.timeLeft / 60)}:${(gameObj.timeLeft % 60) < 10 ? '0' : ''}${gameObj.timeLeft % 60}`;
    if (timerEl0) {
        const m0 = Math.floor(gameObj.timeLeft / 60), s0 = gameObj.timeLeft % 60;
        timerEl0.innerText = `Temps : ${m0}:${s0 < 10 ? '0' : ''}${s0}`;
    }
    const tips = [
        "Observez bien la sortie 0 : c'est la référence, elle ne contient aucune anomalie.",
        "Une anomalie ? Faites demi-tour. Tout est normal ? Avancez.",
        "Les détails comptent : objets, lumières, textures, taille du couloir.",
        "Une erreur et vous retournez à la sortie 0."
    ];
    const tipEl = document.getElementById('anomaly-loading-tip');
    if (tipEl) tipEl.innerText = tips[Math.floor(Math.random() * tips.length)];

    let started = false;
    const go = () => {
        if (started) return; started = true;
        if (state.anomalyGame !== gameObj || gameObj.finished) return;
        window.anomalyAudio.unlock();
        const failed = window.preloadAnomalyAssets(gameObj.theme).failed || [];
        const cont = document.getElementById('anomaly-canvas-container');
        if (failed.length && cont) {
            console.warn('Fichiers introuvables :', failed);
            const bn = document.createElement('div');
            bn.className = 'absolute bottom-2 left-2 z-20 bg-red-950/90 border border-red-500/50 text-red-200 text-[10px] px-2 py-1 rounded-lg max-w-[92%] pointer-events-none';
            bn.textContent = '⚠ Fichiers introuvables (vérifie qu\'ils sont sur GitHub) : ' + failed.join(', ');
            cont.appendChild(bn);
        }
        tick();
        gameObj.timerInterval = setInterval(tick, 1000);
        setupAnomalyStage(10);
        setTimeout(() => {                       // laisse la première image se dessiner avant de retirer l'écran de chargement
            const o = document.getElementById('anomaly-loading');
            if (!o) return;
            o.style.opacity = '0';
            setTimeout(() => { if (o.parentNode) o.parentNode.removeChild(o); }, 600);
        }, 900);
    };
    window.preloadAnomalyAssets(gameObj.theme, (ratio, text) => {
        const bar = document.getElementById('anomaly-loading-bar'), txt = document.getElementById('anomaly-loading-text');
        if (bar) bar.style.width = Math.round(ratio * 100) + '%';
        if (txt) txt.innerText = `${text} ${Math.round(ratio * 100)} %`;
    }, go);
}

window.triggerBlinkTransition = function(callback) {
            let overlay = document.getElementById('anomaly-blink-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'anomaly-blink-overlay';
                overlay.className = 'absolute inset-0 bg-black z-50 transition-opacity duration-150 pointer-events-none opacity-0';
                document.getElementById('anomaly-canvas-container').appendChild(overlay);
            }
            
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
            
            setTimeout(() => {
                callback();
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0');
            }, 150);
}

window.setupAnomalyStage = function(spawnZ) {
            if (state.anomalyGame.stage === 0) {
                state.anomalyGame.hasAnomaly = false;
                state.anomalyGame.anomalyId = -1;
            } else {
                state.anomalyGame.hasAnomaly = Math.random() < 0.5;
                state.anomalyGame.anomalyId = state.anomalyGame.hasAnomaly ? getRandomAnomalyId() : -1;
            }

            state.anomalyGame.playerZ = spawnZ; // Conserve X, Yaw et Pitch pour l'illusion de continuité
            state.anomalyGame.keys = {};

            const stageDisplay = document.getElementById('anomaly-stage-display');
            if (stageDisplay) stageDisplay.innerText = `Sortie ${state.anomalyGame.stage}`;
            const hudStage = document.getElementById('anomaly-hud-stage');
            if (hudStage) hudStage.innerText = state.anomalyGame.stage;

            const hintBanner = document.getElementById('anomaly-hint-banner');
            if (hintBanner) {
                if (state.anomalyGame.stage === 0) {
                    hintBanner.innerHTML = '<b class="text-emerald-400"><i class="fa-solid fa-shield-halved"></i> Sortie 0 : Observez bien la référence (0 anomalie)</b>';
                } else {
                    hintBanner.style.opacity = '0'; // Cache le tutoriel pour l'immersion après la sortie 0
                }
            }

            setTimeout(() => {
                initThreeAnomalyScene(state.anomalyGame.hasAnomaly, state.anomalyGame.anomalyId);
                const container = document.getElementById('anomaly-canvas-container');
                if (container) {
                    try { container.requestPointerLock(); } catch(e) {}
                }
            }, 50);
}

window.getRandomAnomalyId = function() {
            const theme = state.anomalyGame.theme || 'metro';
            const keys = Object.keys(THEMES_CONFIG[theme].anomalies).map(Number);
            return keys[Math.floor(Math.random() * keys.length)];
}

window.anomalyMouseMove = function(e) {
            const container = document.getElementById('anomaly-canvas-container');
            if (!container || !state.anomalyData.renderer) return;
            if (document.pointerLockElement === container || document.pointerLockElement === state.anomalyData.renderer.domElement) {
                state.anomalyGame.yaw -= e.movementX * 0.0025;
                state.anomalyGame.pitch -= e.movementY * 0.0025;
                state.anomalyGame.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, state.anomalyGame.pitch));
            }
}

window.anomalyResize = function() {
            const container = document.getElementById('anomaly-canvas-container');
            const d = state.anomalyData;
            if (!container || !d.camera || !d.renderer || !container.clientWidth) return;
            d.camera.aspect = container.clientWidth / container.clientHeight;
            d.camera.updateProjectionMatrix();
            d.renderer.setSize(container.clientWidth, container.clientHeight);
}

window.anomalyRequestLock = function() {
            if (window.anomalyAudio) window.anomalyAudio.unlock();
            const container = document.getElementById('anomaly-canvas-container');
            if (container) {
                try { container.requestPointerLock(); } catch(e) {}
            }
}

window.handleKeyDown = function(e) {
            if (!state.anomalyGame || state.anomalyGame.finished) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key.startsWith('Arrow')) e.preventDefault();
            const key = e.key.toLowerCase();
            if (window.anomalyAudio) window.anomalyAudio.unlock();
            if (key === 'f' && !e.repeat) { window.anomalyToggleFullscreen(); return; }
            if (key === 'm' && !e.repeat) { window.anomalyToggleMute(); return; }
            if (key === 'w' || key === 'z' || key === 'arrowup') state.anomalyGame.keys['forward'] = true;
            if (key === 's' || key === 'arrowdown') state.anomalyGame.keys['backward'] = true;
            if (key === 'a' || key === 'q' || key === 'arrowleft') state.anomalyGame.keys['left'] = true;
            if (key === 'd' || key === 'arrowright') state.anomalyGame.keys['right'] = true;
            if (e.key === 'Shift') state.anomalyGame.keys['shift'] = true;
}

window.handleKeyUp = function(e) {
            if (!state.anomalyGame) return;
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'z' || key === 'arrowup') state.anomalyGame.keys['forward'] = false;
            if (key === 's' || key === 'arrowdown') state.anomalyGame.keys['backward'] = false;
            if (key === 'a' || key === 'q' || key === 'arrowleft') state.anomalyGame.keys['left'] = false;
            if (key === 'd' || key === 'arrowright') state.anomalyGame.keys['right'] = false;
            if (e.key === 'Shift') state.anomalyGame.keys['shift'] = false;
}

window.initThreeAnomalyScene = function(hasAnomaly, anomalyId) {
            const container = document.getElementById('anomaly-canvas-container');
            if (!container) return;

            // NETTOYAGE COMPLET POUR ÉVITER LES FUITES DE MÉMOIRE WEBGL (les modèles partagés sont conservés)
            if (state.anomalyData.scene) {
                state.anomalyData.scene.traverse(child => {
                    if (child.userData && child.userData.keep) return;
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
            }

            // Attachement unique des événements
            if (!window.anomalyEventsBound) {
                window.addEventListener('keydown', handleKeyDown);
                window.addEventListener('keyup', handleKeyUp);
                document.addEventListener('mousemove', anomalyMouseMove);
                window.addEventListener('resize', window.anomalyResize);
                document.addEventListener('fullscreenchange', window.anomalyOnFullscreenChange);
                document.addEventListener('webkitfullscreenchange', window.anomalyOnFullscreenChange);
                window.anomalyEventsBound = true;
            }

            // GESTION DU MOTEUR : un seul renderer réutilisé, replacé dans le nouveau conteneur à chaque partie
            window.ensureAnomalyRenderer();
            if (state.anomalyData.renderer.domElement.parentNode !== container) {
                container.insertBefore(state.anomalyData.renderer.domElement, container.firstChild);
            }
            state.anomalyData.renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);

            if (state.anomalyData.animId) cancelAnimationFrame(state.anomalyData.animId);

            const currentTheme = state.anomalyGame.theme || 'metro';
            const themeData = THEMES_CONFIG[currentTheme];
            const anomalyDef = hasAnomaly ? (ANOMALY_DEFS[currentTheme] || {})[anomalyId] : null;

            // ---- PARAMÈTRES DE CONSTRUCTION (l'anomalie les modifie avant que le couloir soit bâti) ----
            const P = {
                wallDist: 3.5, ceilingHeight: 3.2,
                neonColor: themeData.lightColor, blackout: false,
                fogColor: themeData.fogColor, fogNear: themeData.fogNear, fogFar: themeData.fogFar,
                ambient: themeData.ambient, envIntensity: themeData.envIntensity,
                tilt: 0, floorRot: 0, wallTint: null, satanic: false, eyesPoster: false,
                camThrob: 0, clockSpeed: 1,
                hidden: new Set(), mods: {}, extras: [], anim: [], post: [],
                hide(id) { this.hidden.add(id); },
                mod(id, o) { this.mods[id] = Object.assign(this.mods[id] || {}, o); },
                add(d) { this.extras.push(d); }
            };
            if (anomalyDef) anomalyDef.fx(P);

            const isBlackout = P.blackout;
            if (isBlackout) { P.fogColor = 0x020202; P.fogNear = 5; P.fogFar = 15; P.ambient = 0.01; P.envIntensity = 0; }

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(P.fogColor);
            scene.fog = new THREE.Fog(P.fogColor, P.fogNear, P.fogFar);
            state.anomalyData.scene = scene;

            const camera = new THREE.PerspectiveCamera(70, (container.clientWidth || 800) / (container.clientHeight || 500), 0.1, 100);
            camera.rotation.order = 'YXZ';
            state.anomalyData.camera = camera;

            // Contexte partagé par les animations et les objets
            const S = {
                scene: scene, camera: camera, group: null, props: {}, lamps: [], colliders: [],
                anim: P.anim, wallDist: P.wallDist, ceilingHeight: P.ceilingHeight,
                clocks: [], spinners: [], noFlicker: false
            };

            scene.add(new THREE.AmbientLight(0xffffff, P.ambient));

            // Lampe torche du joueur
            const flashlight = new THREE.SpotLight(0xfff5e6, 2.5);
            flashlight.angle = Math.PI / 5.5; flashlight.penumbra = 0.4; flashlight.distance = 25;
            flashlight.castShadow = false;
            scene.add(flashlight); scene.add(flashlight.target);

            // ---- MATÉRIAUX DU COULOIR ----
            const fb = themeData.fallback;
            const wallMat = window.makeSurfaceMaterial(currentTheme, 'wall', 37, 2, 0, fb.wall);
            if (P.wallTint != null) wallMat.color.setHex(P.wallTint);
            const floorMat = window.makeSurfaceMaterial(currentTheme, 'floor', 4, 34, P.floorRot, fb.floor);
            const ceilingMat = window.makeSurfaceMaterial(currentTheme, 'ceiling', 3, 26, 0, fb.ceiling);
            [wallMat, floorMat, ceilingMat].forEach(m => { m.envMapIntensity = P.envIntensity; });

            const wallDist = P.wallDist, ceilingHeight = P.ceilingHeight;

            // ---- STRUCTURE (groupe permettant les rotations globales) ----
            const corridorGroup = new THREE.Group();
            scene.add(corridorGroup);
            S.group = corridorGroup;

            const floor = new THREE.Mesh(new THREE.PlaneGeometry(wallDist * 2, 60), floorMat);
            floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -10); corridorGroup.add(floor);

            const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(wallDist * 2, 60), ceilingMat);
            ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, ceilingHeight, -10); corridorGroup.add(ceiling);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, ceilingHeight, 60), wallMat);
            leftWall.position.set(-wallDist - 0.25, ceilingHeight / 2, -10); corridorGroup.add(leftWall);
            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, ceilingHeight, 60), wallMat);
            rightWall.position.set(wallDist + 0.25, ceilingHeight / 2, -10); corridorGroup.add(rightWall);

            // Plinthes collées aux murs
            const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
            [-1, 1].forEach(sd => {
                const bb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 60), baseboardMat);
                bb.position.set(sd * (wallDist - 0.02), 0.075, -10); corridorGroup.add(bb);
            });

            if (P.tilt) corridorGroup.rotation.z = P.tilt;

            // ---- NÉONS ----
            const flickerBase = 1.2;
            for (let z = 10; z >= -30; z -= 8) {
                const neonMat = new THREE.MeshStandardMaterial({ emissive: P.neonColor, emissiveIntensity: isBlackout ? 0 : 1, color: 0xffffff });
                const neonM = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.4), neonMat);
                neonM.position.set(0, ceilingHeight - 0.05, z); corridorGroup.add(neonM);
                let pl = null;
                if (!isBlackout) {
                    pl = new THREE.PointLight(P.neonColor, flickerBase, 15);
                    pl.position.set(0, ceilingHeight - 0.3, z);
                    corridorGroup.add(pl);
                }
                S.lamps.push({ light: pl, mat: neonMat, z: z });
            }

            // ---- AFFICHES (métro) ----
            if (themeData.posters) {
                [-12, 0].forEach((zPos, idx) => {
                    const pTex = (P.eyesPoster && idx === 1) ? createPosterTexture('eyes') : createPosterTexture('normal');
                    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.25), new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.2 }));
                    poster.rotation.y = -Math.PI / 2;
                    poster.position.set(wallDist - 0.01, 1.5, zPos);
                    corridorGroup.add(poster);
                });
            }

            // ---- PANNEAU DE SORTIE ----
            const signTex = createStageSignTexture(state.anomalyGame.stage, P.satanic, 12);
            const signMat = new THREE.MeshBasicMaterial({ map: signTex });
            [0, Math.PI].forEach(ry => {            // une face de chaque côté (visible dans les deux sens)
                const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), signMat);
                sg.rotation.y = ry; sg.position.set(0, ceilingHeight - 0.5, ry ? -25.02 : -25);
                corridorGroup.add(sg);
            });

            // ---- OBJETS 3D ----
            const v3 = () => new THREE.Vector3();
            const placeProp = (d) => {
                if (P.hidden.has(d.id)) return;
                const spec = MODELS[d.k]; if (!spec) return;
                const mo = P.mods[d.id] || {};
                window.loadGLTFModel(d.k, obj => {
                    if (state.anomalyData.scene !== scene) return;       // la scène a changé pendant le chargement

                    // matériaux : intensité de l'environnement, teinte, tableaux vides
                    obj.traverse(m => {
                        if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
                        if (mo.tint != null || mo.blank) m.material = m.material.clone();
                        const mat = m.material;
                        if (mo.tint != null && mat.color) mat.color.setHex(mo.tint);
                        if (mo.blank && /canvas|artwork/i.test(mat.name || '')) { mat.map = null; if (mat.color) mat.color.setHex(0x060606); mat.needsUpdate = true; }
                        mat.envMapIntensity = P.envIntensity;
                    });

                    const side = mo.flipSide ? (d.side === 'L' ? 'R' : 'L') : (d.side || 'C');
                    const inner = new THREE.Group();
                    inner.add(obj);
                    inner.updateMatrixWorld(true);
                    const s0 = new THREE.Box3().setFromObject(inner).getSize(v3());

                    // échelle
                    let k = 1;
                    if (d.h) k = d.h / Math.max(s0.y, 0.0001);
                    else if (d.len) k = d.len / Math.max(s0.x, s0.z, 0.0001);
                    k *= (mo.scale || 1);

                    // orientation : la face avant regarde vers le couloir (ou comme demandé)
                    const face = d.face === 'fwd' ? [0, -1] : d.face === 'back' ? [0, 1] : (side === 'L' ? [1, 0] : side === 'R' ? [-1, 0] : [0, 1]);
                    const f = spec.depth === 'x' ? [spec.front, 0] : [0, spec.front];
                    const theta = Math.atan2(face[0], face[1]) - Math.atan2(f[0], f[1]) + (d.yaw || 0) + (mo.yaw || 0);
                    inner.scale.setScalar(k);
                    inner.rotation.y = theta;
                    inner.updateMatrixWorld(true);

                    // pivot au centre de l'objet : les rotations / retournements se font sur place
                    const box = new THREE.Box3().setFromObject(inner);
                    const size = box.getSize(v3()), ctr = box.getCenter(v3());
                    inner.position.set(-ctr.x, -ctr.y, -ctr.z);
                    const outer = new THREE.Group();
                    outer.add(inner);
                    outer.userData.faceAngle = theta;
                    outer.userData.size = { x: size.x, y: size.y, z: size.z };

                    let x = d.x || 0;
                    if (side === 'L') x = -wallDist + size.x / 2 + 0.02;
                    else if (side === 'R') x = wallDist - size.x / 2 - 0.02;
                    const y = (d.top != null) ? (ceilingHeight - d.top - size.y / 2) : ((d.yb || 0) + size.y / 2);
                    outer.position.set(x + (mo.dx || 0), y + (mo.dy || 0), (d.z || 0) + (mo.dz || 0));
                    if (mo.flip) outer.rotation.x = Math.PI;
                    corridorGroup.add(outer);
                    S.props[d.id] = outer;

                    if (d.solid && !mo.noSolid) {
                        S.colliders.push({ minX: outer.position.x - size.x / 2, maxX: outer.position.x + size.x / 2,
                                           minZ: outer.position.z - size.z / 2, maxZ: outer.position.z + size.z / 2 });
                    }
                    const spin = mo.spin != null ? mo.spin : d.spin;
                    if (spin) S.spinners.push({ obj: outer, speed: spin });
                    if (d.clock) {
                        const hand = n => outer.getObjectByName(n);
                        S.clocks.push({ sec: hand('wall_clock_second_hand'), min: hand('wall_clock_minute_hand'), hour: hand('wall_clock_hours_hand') });
                    }
                    if (d.onPlaced) d.onPlaced(outer, S);
                });
            };
            (PROP_LAYOUT[currentTheme] || []).forEach(placeProp);
            P.extras.forEach(placeProp);

            // ---- ÉLÉMENTS PROPRES À L'ANOMALIE (décalques, silhouettes, lumières...) ----
            P.post.forEach(fn => fn(S));

            // ---- ÉCLAIRAGE HDR ----
            if (!isBlackout && themeData.hdr) {
                window.loadThemeEnvironment(currentTheme, env => {
                    if (state.anomalyData.scene !== scene) return;
                    scene.environment = env;
                });
            }

            window.anomalyAudio.onScene({ theme: currentTheme, hasAnomaly: !!anomalyDef, sfx: anomalyDef && anomalyDef.sfx, blackout: isBlackout, stage: state.anomalyGame.stage });
            let lastStep = 0;

            const clock = new THREE.Clock();
            const flickerLight = S.lamps[2] ? S.lamps[2].light : null;
            let flickerUntil = 0, nextFlicker = Date.now() + 2000;
            const g = state.anomalyGame;

            const hitCollider = (x, z) => S.colliders.some(c => x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35);

            const loop = function() {
                if (document.getElementById('screen-generic-game').classList.contains('hidden') || g.finished) { window.anomalyAudio.stopAll(); return; }

                const delta = Math.min(clock.getDelta(), 0.1);
                const t = clock.elapsedTime;

                // Animations propres à l'anomalie
                P.anim.forEach(fn => { try { fn(t, delta, S); } catch (e) { /* une animation ne doit jamais casser le jeu */ } });

                // Objets animés en permanence (ventilateur, aiguilles)
                S.spinners.forEach(sp => { sp.obj.rotation.y += sp.speed * delta; });
                S.clocks.forEach(c => {
                    if (c.sec) c.sec.rotateZ(-delta * (Math.PI * 2 / 60) * P.clockSpeed);
                    if (c.min) c.min.rotateZ(-delta * (Math.PI * 2 / 3600) * P.clockSpeed);
                    if (c.hour) c.hour.rotateZ(-delta * (Math.PI * 2 / 43200) * P.clockSpeed);
                });

                // Néon qui vacille de temps en temps
                if (flickerLight && !S.noFlicker) {
                    const now = Date.now();
                    if (now > nextFlicker) { flickerUntil = now + 60 + Math.random() * 120; nextFlicker = now + 2500 + Math.random() * 6000; }
                    flickerLight.intensity = now < flickerUntil ? 0.2 : flickerBase;
                }

                // Déplacements stabilisés par delta time
                const speed = (g.keys['shift'] ? 4.5 : 2.0) * delta;
                const forwardX = -Math.sin(g.yaw), forwardZ = -Math.cos(g.yaw);
                const rightX = Math.cos(g.yaw), rightZ = -Math.sin(g.yaw);
                let dx = 0, dz = 0;
                if (g.keys['forward'])  { dx += forwardX * speed; dz += forwardZ * speed; }
                if (g.keys['backward']) { dx -= forwardX * speed; dz -= forwardZ * speed; }
                if (g.keys['left'])     { dx -= rightX * speed;   dz -= rightZ * speed; }
                if (g.keys['right'])    { dx += rightX * speed;   dz += rightZ * speed; }
                const isMoving = dx !== 0 || dz !== 0;

                // Collisions : murs et objets solides (axe par axe pour glisser le long des obstacles)
                const limitX = wallDist - 0.4;
                const stuck = hitCollider(g.playerX, g.playerZ);
                const nx = Math.max(-limitX, Math.min(limitX, g.playerX + dx));
                if (stuck || !hitCollider(nx, g.playerZ)) g.playerX = nx;
                const nz = g.playerZ + dz;
                if (stuck || !hitCollider(g.playerX, nz)) g.playerZ = nz;

                if (isMoving) {
                    g.walkTime += speed * 2;
                    const stepIdx = Math.floor(g.walkTime / Math.PI);
                    if (stepIdx !== lastStep) { lastStep = stepIdx; window.anomalyAudio.step(currentTheme, !!g.keys['shift']); }
                }
                camera.position.x = g.playerX;
                camera.position.z = g.playerZ;
                const throb = P.camThrob ? Math.sin(Date.now() * 0.005) * P.camThrob : 0;
                camera.position.y = (1.6 + throb) + Math.sin(g.walkTime) * 0.05;
                camera.rotation.y = g.yaw;
                camera.rotation.x = g.pitch;

                // Lampe torche tenue de la main droite
                flashlight.position.copy(camera.position);
                flashlight.position.x += Math.cos(g.yaw) * 0.2;
                flashlight.position.y -= 0.1;
                flashlight.target.position.set(
                    camera.position.x - Math.sin(g.yaw) * 5,
                    camera.position.y - Math.sin(g.pitch) * 5,
                    camera.position.z - Math.cos(g.yaw) * 5
                );

                // --- LOGIQUE DE BOUCLE INFINIE ---
                const wentForward = g.playerZ < -26;
                const wentBackward = g.playerZ > 12;
                if (wentForward || wentBackward) {
                    if (g.isTransitioning) return;
                    g.isTransitioning = true;

                    const success = (wentForward && !hasAnomaly) || (wentBackward && hasAnomaly);
                    g.historyLog.push({
                        stage: g.stage,
                        hasAnomaly: g.hasAnomaly,
                        anomalyId: g.anomalyId,
                        anomalyName: g.hasAnomaly ? (THEMES_CONFIG[currentTheme].anomalies[g.anomalyId] || "Anomalie") : "Normal",
                        action: wentForward ? "Avancé" : "Demi-tour",
                        success: success
                    });

                    if (success) g.stage++; else g.stage = 0;
                    if (g.stage > g.maxStageReached) g.maxStageReached = g.stage;
                    window.anomalyPushProgress(false);

                    if (g.stage >= g.targetStages) { finishAnomalyGame(); return; }

                    window.anomalyAudio.play(success ? 'chime' : 'fail');
                    triggerBlinkTransition(() => {
                        g.isTransitioning = false;
                        setupAnomalyStage(wentForward ? 10 : -12);
                    });
                    return;
                }

                state.anomalyData.renderer.render(scene, camera);
                state.anomalyData.animId = requestAnimationFrame(loop);
            };
            loop();
}

window.finishAnomalyGame = function() {
    const g = state.anomalyGame;
    if (!g || g.finished) return;
    g.finished = true;
    clearInterval(g.timerInterval);
    if (document.pointerLockElement) document.exitPointerLock();
    if (state.anomalyData.animId) cancelAnimationFrame(state.anomalyData.animId);
    window.anomalyAudio.stopAll();

    // Score calculé par l'hôte quand tout le monde a fini : ici on envoie seulement notre progression
    window.anomalyPushProgress(true);

    const content = document.getElementById('generic-game-content');
    if (content) {
        content.innerHTML = `
            <div class="max-w-md mx-auto p-8 bg-slate-900 border border-slate-700 rounded-2xl text-center space-y-3">
                <div class="text-2xl font-black text-emerald-400">Terminé !</div>
                <div class="text-sm text-slate-300">Sortie atteinte : <b class="text-amber-400">${g.maxStageReached} / ${g.targetStages}</b></div>
                <div class="text-amber-400 animate-pulse text-sm"><i class="fa-solid fa-hourglass-half"></i> En attente des autres joueurs...</div>
                <div id="anomaly-progress" class="flex flex-wrap gap-2 justify-center text-[11px] font-mono"></div>
            </div>`;
        if (window.latestAnomalyData) anomalyUpdateHud(window.latestAnomalyData);
    }
    const timerEl = document.getElementById('generic-game-timer');
    if (timerEl) timerEl.innerText = 'Terminé';
}
