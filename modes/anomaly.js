///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
////////////////// --- MODE ANOMALIES 3D --- //////////////////
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////

// --- LISTE DES ANOMALIES 3D (Style Exit 8) ---
const THEMES_CONFIG = {
            metro: {
                pbr: true,   // textures locales dans ./textures/metro/ (mur, sol, plafond)
                fallback: { wall: 0xd8dde3, floor: 0x7c828a, ceiling: 0x2b3340 },
                wallTexture: 'https://images.unsplash.com/photo-1617391764619-3c7d674eb8f7?auto=format&fit=crop&w=1024&q=80',
                floorTexture: 'https://images.unsplash.com/photo-1596205739343-41bbd9c7bb7f?auto=format&fit=crop&w=1024&q=80',
                lightColor: 0xfffbeb,
                anomalies: {
                    1: "Les néons du couloir virent au rouge",
                    2: "Noir complet (Coupure de courant)",
                    3: "Portes du métro qui s'ouvrent sur le vide",
                    4: "Le panneau indique une direction satanique",
                    5: "Une bande jaune brillante apparaît au sol",
                    6: "Une silhouette sombre se tient au fond du couloir",
                    7: "L'affiche publicitaire vous fixe des yeux",
                    8: "Le couloir est plus étroit"
                }
            },
            hopital: {
                pbr: false,  // passer à true quand ./textures/hopital/ est rempli
                fallback: { wall: 0xcfd8dc, floor: 0x9aa7ad, ceiling: 0xd1d5db },
                wallTexture: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=1024&q=80',
                floorTexture: 'https://images.unsplash.com/photo-1581404118991-381bb4542289?auto=format&fit=crop&w=1024&q=80',
                lightColor: 0xe0f2fe,
                anomalies: {
                    1: "Une grosse caisse bloque le couloir",
                    2: "Le couloir palpite comme s'il respirait",
                    3: "Une porte respire imperceptiblement (échelle dynamique)",
                    4: "Un trou sombre est percé dans le mur",
                    5: "Plafond qui s'effondre partiellement",
                    6: "Une porte d'isolement est grande ouverte",
                    7: "L'extincteur a disparu",
                    8: "Le couloir est penché sur le côté"
                }
            },
            hotel: {
                pbr: false,  // passer à true quand ./textures/hotel/ est rempli
                fallback: { wall: 0x8d6e63, floor: 0x5b2c2c, ceiling: 0x78716c },
                wallTexture: 'https://images.unsplash.com/photo-1615800098779-1be32e60cca3?auto=format&fit=crop&w=1024&q=80',
                floorTexture: 'https://images.unsplash.com/photo-1533256926955-4c07c2dc1b9f?auto=format&fit=crop&w=1024&q=80',
                lightColor: 0xffedd5,
                anomalies: {
                    1: "Les motifs géométriques de la moquette pivotent de 90 degrés",
                    2: "Une porte est peinte en rouge",
                    3: "Un landau sombre bloque le couloir",
                    4: "Le papier peint pèle subtilement",
                    5: "La hauteur du couloir rétrécit brutalement",
                    6: "Le couloir est plus étroit",
                    7: "Tableaux dont les personnages ont disparu",
                    8: "Lumières qui s'éteignent une à une derrière vous"
                }
            }
        };

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');   // obligatoire pour utiliser des images d'un autre domaine dans WebGL
const textureCache = {};

// --- Textures PBR locales : ./textures/<décor>/<surface>_color.jpg, _normal.jpg, _rough.jpg ---
// Si un fichier est introuvable, la surface retombe sur une couleur unie (le jeu ne plante pas).
const pbrCache = {};
window.loadPBRTexture = function(url, rx, ry, isColor) {
    const key = url + '|' + rx + '|' + ry;
    if (pbrCache[key]) return pbrCache[key];
    const tex = textureLoader.load(url, undefined, undefined, () => {
        tex.userData.failed = true;
        (tex.userData.users || []).forEach(u => {          // retire la texture manquante des matériaux déjà créés
            u.mat[u.prop] = null;
            if (u.prop === 'map') u.mat.color.setHex(u.fallback);
            u.mat.needsUpdate = true;
        });
    });
    tex.userData.users = [];
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    if (isColor) tex.encoding = THREE.sRGBEncoding;
    pbrCache[key] = tex;
    return tex;
};

window.makeSurfaceMaterial = function(theme, surface, rx, ry, rotation, fallbackColor) {
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 0.85, metalness: 0.0 });
    if (!THEMES_CONFIG[theme].pbr) return mat;
    const maxAniso = state.anomalyData.renderer ? state.anomalyData.renderer.capabilities.getMaxAnisotropy() : 4;
    const base = `./textures/${theme}/${surface}_`;
    [['map', 'color', true], ['normalMap', 'normal', false], ['roughnessMap', 'rough', false]].forEach(([prop, file, isColor]) => {
        const tex = window.loadPBRTexture(base + file + '.jpg', rx, ry, isColor);
        tex.anisotropy = maxAniso;
        tex.rotation = rotation || 0;
        if (tex.userData.failed) return;
        mat[prop] = tex;
        tex.userData.users.push({ mat: mat, prop: prop, fallback: fallbackColor });
        if (prop === 'map') mat.color.setHex(0xffffff);
        if (prop === 'roughnessMap') mat.roughness = 1.0;
    });
    return mat;
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
                <span class="text-[11px] text-slate-400 font-medium">Contrôles : ZQSD ou Flèches | Souris pour regarder | <b class="text-indigo-300">Shift</b> pour courir</span>
            </div>
            <div id="anomaly-progress" class="flex flex-wrap gap-2 px-2 text-[11px] font-mono"></div>

            <div id="anomaly-canvas-container" class="relative cursor-pointer rounded-xl overflow-hidden shadow-2xl border border-slate-700">
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

    const tick = () => {
        const g = state.anomalyGame;
        if (!g || g.finished) return;
        g.timeLeft--;
        const timerEl = document.getElementById('generic-game-timer');
        if (timerEl) {
            const mins = Math.floor(Math.max(0, g.timeLeft) / 60), secs = Math.max(0, g.timeLeft) % 60;
            timerEl.innerText = `Temps : ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        if (g.timeLeft <= 0) finishAnomalyGame();
    };
    tick();
    state.anomalyGame.timerInterval = setInterval(tick, 1000);

    setupAnomalyStage(10);
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

            // NETTOYAGE COMPLET POUR ÉVITER LES FUITES DE MÉMOIRE WEBGL
            if (state.anomalyData.scene) {
                state.anomalyData.scene.traverse(child => {
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
                window.anomalyEventsBound = true;
            }

            // GESTION DU MOTEUR : un seul renderer réutilisé, replacé dans le nouveau conteneur à chaque partie
            if (!state.anomalyData.renderer) {
                const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                renderer.outputEncoding = THREE.sRGBEncoding;
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 1.0;
                state.anomalyData.renderer = renderer;
            }
            if (state.anomalyData.renderer.domElement.parentNode !== container) {
                container.insertBefore(state.anomalyData.renderer.domElement, container.firstChild);
            }
            state.anomalyData.renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);

            if (state.anomalyData.animId) cancelAnimationFrame(state.anomalyData.animId);

            const scene = new THREE.Scene();
            const currentTheme = state.anomalyGame.theme || 'metro';
            
            // Logique de Noir Complet (Blackout)
            const isBlackout = hasAnomaly && ((currentTheme === 'metro' && anomalyId === 2) || (currentTheme === 'hotel' && anomalyId === 8));
            const fogColor = isBlackout ? 0x020202 : 0x0f172a;
            scene.background = new THREE.Color(fogColor);
            scene.fog = new THREE.Fog(fogColor, 5, isBlackout ? 15 : 25);
            state.anomalyData.scene = scene;

            const camera = new THREE.PerspectiveCamera(70, (container.clientWidth || 800) / (container.clientHeight || 500), 0.1, 100);
            camera.rotation.order = 'YXZ';
            state.anomalyData.camera = camera;

            // Modifiez les LUMIÈRES existantes
            const ambIntensity = isBlackout ? 0.01 : 0.05; // Très faible luminosité de base
            const ambientLight = new THREE.AmbientLight(0xffffff, ambIntensity);
            scene.add(ambientLight);

            // NOUVEAU : Lampe torche du joueur
            const flashlight = new THREE.SpotLight(0xfff5e6, 2.5);
            flashlight.angle = Math.PI / 5.5; // Faisceau resserré
            flashlight.penumbra = 0.4;        // Bords flous
            flashlight.distance = 25;
            flashlight.castShadow = false;   // aucune surface ne reçoit d'ombre : inutile et coûteux
            scene.add(flashlight);
            scene.add(flashlight.target);
            
            // ... Gardez la logique des néons, mais baissez leur intensité
            let pointLights = [];
            let emissiveMats = [];

            // GÉOMÉTRIE & MATÉRIAUX RÉALISTES
            const themeData = THEMES_CONFIG[currentTheme];
            const maxAnisotropy = state.anomalyData.renderer.capabilities.getMaxAnisotropy();
            
            const fb = themeData.fallback;
            const floorRot = (hasAnomaly && currentTheme === 'hotel' && anomalyId === 1) ? Math.PI / 2 : 0;   // Hôtel 1 : moquette pivotée
            const brickWall = hasAnomaly && currentTheme === 'hotel' && anomalyId === 4;                        // Hôtel 4 : le papier peint pèle

            // Mur ~2 m par motif, sol et plafond carrés (le couloir fait 7 m x 60 m)
            const wallMat = brickWall
                ? window.makeSurfaceMaterial(currentTheme, 'wall_alt', 37, 2, 0, 0x7c2d12)
                : window.makeSurfaceMaterial(currentTheme, 'wall', 37, 2, 0, fb.wall);
            const floorMat = window.makeSurfaceMaterial(currentTheme, 'floor', 4, 34, floorRot, fb.floor);
            if (!themeData.pbr && currentTheme === 'hotel') {
                const carpet = window.getCarpetTexture();
                carpet.repeat.set(6, 40); carpet.rotation = floorRot;
                floorMat.map = carpet; floorMat.color.setHex(0xffffff); floorMat.needsUpdate = true;
            }
            const ceilingMat = window.makeSurfaceMaterial(currentTheme, 'ceiling', 3, 26, 0, fb.ceiling);

            const doorMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.4 });

            let ceilingHeight = 3.2;
            if (hasAnomaly && ((currentTheme === 'hopital' && anomalyId === 5) || (currentTheme === 'hotel' && anomalyId === 5))) {
                ceilingHeight = 2.1; // Plafond s'effondre / rétrécit
            }
            
            const narrow = hasAnomaly && ((currentTheme === 'metro' && anomalyId === 8) || (currentTheme === 'hotel' && anomalyId === 6));
            const wallDist = narrow ? 2.5 : 3.5;

            // Structure principale (Groupe permettant des rotations globales)
            const corridorGroup = new THREE.Group();
            scene.add(corridorGroup);

            const floor = new THREE.Mesh(new THREE.PlaneGeometry(wallDist * 2, 60), floorMat);
            floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -10); corridorGroup.add(floor);

            const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(wallDist * 2, 60), ceilingMat);
            ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, ceilingHeight, -10); corridorGroup.add(ceiling);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, ceilingHeight, 60), wallMat);
            leftWall.position.set(-wallDist - 0.25, ceilingHeight/2, -10); corridorGroup.add(leftWall);
            
            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, ceilingHeight, 60), wallMat);
            rightWall.position.set(wallDist + 0.25, ceilingHeight/2, -10); corridorGroup.add(rightWall);

	    // Ajoutez ceci juste après avoir créé leftWall et rightWall
            const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
            
            const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 60), baseboardMat);
            leftBaseboard.position.set(-wallDist + 0.25, 0.075, -10);
            corridorGroup.add(leftBaseboard);
            
            const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 60), baseboardMat);
            rightBaseboard.position.set(wallDist - 0.25, 0.075, -10);
            corridorGroup.add(rightBaseboard);

            // Vertige extrême (Hôpital 8)
            if (hasAnomaly && currentTheme === 'hopital' && anomalyId === 8) {
                corridorGroup.rotation.z = Math.PI / 12; // Incline le couloir
            }

            // Néons
            let neonColor = themeData.lightColor;
            if (hasAnomaly && currentTheme === 'metro' && anomalyId === 1) neonColor = 0xff0000;
            
            for (let z = 10; z >= -30; z -= 8) {
                const neonMat = new THREE.MeshStandardMaterial({ emissive: neonColor, emissiveIntensity: isBlackout ? 0 : 1, color: 0xffffff });
                emissiveMats.push(neonMat);
                const neonM = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.4), neonMat);
                neonM.position.set(0, ceilingHeight - 0.05, z); corridorGroup.add(neonM);
                
                if (!isBlackout) {
                    const pl = new THREE.PointLight(neonColor, 1.2, 15);
                    pl.position.set(0, ceilingHeight - 0.3, z);
                    pl.castShadow = false;
                    pointLights.push(pl);
                    corridorGroup.add(pl);
                }
            }

            // Portes
            let breathingDoor = null;
            [-18, -6, 6].forEach((zPos, dIdx) => {
                const doorGroup = new THREE.Group();
                const redDoor = hasAnomaly && currentTheme === 'hotel' && anomalyId === 2 && dIdx === 1;
                const thisDoorMat = redDoor ? new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.2, roughness: 0.5 }) : doorMat;
                const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 1.4), thisDoorMat);
                if (hasAnomaly && currentTheme === 'hopital' && anomalyId === 3 && dIdx === 1) breathingDoor = doorGroup;
                doorMesh.position.set(0, 1.2, 0);
                
                const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 12), new THREE.MeshStandardMaterial({color:0x94a3b8, metalness: 0.8}));
                handle.rotation.z = Math.PI/2;
                handle.position.set(0.06, 1.2, 0.5);
                
                doorGroup.add(doorMesh); doorGroup.add(handle);

                // Hôpital #6: Porte isolement ouverte
                if (hasAnomaly && currentTheme === 'hopital' && anomalyId === 6 && dIdx === 1) {
                    doorGroup.rotation.y = Math.PI / 4; 
                    const redGlow = new THREE.PointLight(0xff0000, 2, 5);
                    redGlow.position.set(-1, 1, 0);
                    doorGroup.add(redGlow);
                }
                
                // Metro #3: Portes ouvertes sur le vide
                if (hasAnomaly && currentTheme === 'metro' && anomalyId === 3 && dIdx === 1) {
                    doorGroup.position.set(-wallDist - 0.5, 0, zPos); 
                    const voidHole = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5), new THREE.MeshBasicMaterial({color: 0x000000}));
                    voidHole.position.set(-wallDist + 0.01, 1.2, zPos);
                    voidHole.rotation.y = Math.PI / 2;
                    corridorGroup.add(voidHole);
                } else {
                    doorGroup.position.set(-wallDist, 0, zPos);
                    corridorGroup.add(doorGroup);
                }
            });

            // Affiches
            const posterOffsets = [-12, 0];
            posterOffsets.forEach((zPos, idx) => {
                let pTex = createPosterTexture('normal');
                if (hasAnomaly && currentTheme === 'metro' && anomalyId === 7 && idx === 1) pTex = createPosterTexture('eyes'); // L'affiche fixe
                
                const posterMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.2 });
                const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.25), posterMat);
                poster.rotation.y = -Math.PI / 2;
                
                // Hotel #7: Tableaux vides
                if (hasAnomaly && currentTheme === 'hotel' && anomalyId === 7) {
                    posterMat.map = null; posterMat.color.setHex(0xffffff);
                }
                
                poster.position.set(wallDist - 0.01, 1.5, zPos);
                corridorGroup.add(poster);
            });

            // Anomalies visuelles supplémentaires
            if (hasAnomaly && currentTheme === 'metro' && anomalyId === 5) {
                const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 60), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
                strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.02, -10); corridorGroup.add(strip);
            }
            if (hasAnomaly && currentTheme === 'metro' && anomalyId === 6) {
                const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                shadow.position.set(0, 1.3, -20); corridorGroup.add(shadow);
            }
            if (hasAnomaly && currentTheme === 'hopital' && anomalyId === 4) {
                const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ color: 0x050505 }));
                hole.rotation.y = Math.PI / 2; hole.position.set(-wallDist + 0.02, 1.2, -4); corridorGroup.add(hole);
            }

            const extGroup = new THREE.Group();
            const extincteur = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 16), new THREE.MeshStandardMaterial({color:0xdc2626, metalness:0.3}));
            extGroup.add(extincteur);
            extGroup.position.set(-wallDist + 0.2, 1.0, -12);
            if (!(hasAnomaly && currentTheme === 'hopital' && anomalyId === 7)) corridorGroup.add(extGroup);   // Hôpital 7 : extincteur disparu

            // Objets bloquants (Chaises / Landau)
            if (hasAnomaly) {
                if (currentTheme === 'hopital' && anomalyId === 1) {
                    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({color:0x333333}));
                    box.position.set(0, 0.75, -8); corridorGroup.add(box);
                } else if (currentTheme === 'hotel' && anomalyId === 3) {
                    const baby = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({color:0x111111}));
                    baby.position.set(0, 0.6, -8); corridorGroup.add(baby);
                }
            }

            // Panneau de Sortie Jaune
            let isSatanic = (hasAnomaly && currentTheme === 'metro' && anomalyId === 4);
            const signTex = createStageSignTexture(state.anomalyGame.stage, isSatanic, 12);
            const signMat = new THREE.MeshBasicMaterial({ map: signTex });
            const signMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), signMat);
            signMesh.position.set(0, ceilingHeight - 0.5, -24);
            corridorGroup.add(signMesh);

	    const clock = new THREE.Clock();
            const flickerLight = pointLights[2] || null;
            let flickerUntil = 0, nextFlicker = Date.now() + 2000;

window.renderLoop = function() {
                if (document.getElementById('screen-generic-game').classList.contains('hidden') || state.anomalyGame.finished) {
                    return; 
                }
                
                const delta = clock.getDelta(); // Temps écoulé depuis la dernière frame

                // Animations en direct
                if (hasAnomaly) {
                    if (currentTheme === 'hopital' && anomalyId === 3 && breathingDoor) {
                        const k = Math.sin(Date.now() * 0.002) * 0.06;
                        breathingDoor.scale.set(1, 1 + k, 1 + k); // La porte respire
                    }
                    if (currentTheme === 'hotel' && anomalyId === 8) {
                        pointLights.forEach((pl) => {
                            if (camera.position.z < pl.position.z) pl.intensity = 0; 
                        });
                    }
                }

                // Néon qui vacille de temps en temps
                if (flickerLight && !(hasAnomaly && currentTheme === 'hotel' && anomalyId === 8)) {
                    const now = Date.now();
                    if (now > nextFlicker) { flickerUntil = now + 60 + Math.random() * 120; nextFlicker = now + 2500 + Math.random() * 6000; }
                    flickerLight.intensity = now < flickerUntil ? 0.2 : 1.2;
                }

                // Déplacements stabilisés par delta time
                const isSprinting = state.anomalyGame.keys['shift'];
                let speedMultiplier = 1.0;
                
                const baseSpeed = isSprinting ? 4.5 : 2.0; 
                const speed = baseSpeed * speedMultiplier * delta; 

                const forwardX = -Math.sin(state.anomalyGame.yaw);
                const forwardZ = -Math.cos(state.anomalyGame.yaw);
                const rightX = Math.cos(state.anomalyGame.yaw);
                const rightZ = -Math.sin(state.anomalyGame.yaw);

                let isMoving = false;
                if (state.anomalyGame.keys['forward']) { state.anomalyGame.playerX += forwardX * speed; state.anomalyGame.playerZ += forwardZ * speed; isMoving = true; }
                if (state.anomalyGame.keys['backward']) { state.anomalyGame.playerX -= forwardX * speed; state.anomalyGame.playerZ -= forwardZ * speed; isMoving = true; }
                if (state.anomalyGame.keys['left']) { state.anomalyGame.playerX -= rightX * speed; state.anomalyGame.playerZ -= rightZ * speed; isMoving = true; }
                if (state.anomalyGame.keys['right']) { state.anomalyGame.playerX += rightX * speed; state.anomalyGame.playerZ += rightZ * speed; isMoving = true; }

                // Collisions basiques
                const limitX = wallDist - 0.4;
                state.anomalyGame.playerX = Math.max(-limitX, Math.min(limitX, state.anomalyGame.playerX));
                
                if (hasAnomaly && ((currentTheme === 'hopital' && anomalyId === 1) || (currentTheme === 'hotel' && anomalyId === 3))) {
                    if (state.anomalyGame.playerZ < -6.5 && state.anomalyGame.playerZ > -9.5) {
                        if (state.anomalyGame.keys['forward']) state.anomalyGame.playerZ += 0.2;
                        if (state.anomalyGame.keys['backward']) state.anomalyGame.playerZ -= 0.2;
                    }
                }

                // Application
                if (isMoving) state.anomalyGame.walkTime += speed * 2;
                camera.position.x = state.anomalyGame.playerX;
                camera.position.z = state.anomalyGame.playerZ;
                
                let throb = 0;
                if (hasAnomaly && currentTheme === 'hopital' && anomalyId === 2) {
                    throb = Math.sin(Date.now() * 0.005) * 0.1; // Bruit de respiration / palpitant
                }
                camera.position.y = (1.6 + throb) + Math.sin(state.anomalyGame.walkTime) * 0.05;

                camera.rotation.y = state.anomalyGame.yaw;
                camera.rotation.x = state.anomalyGame.pitch;

		// Dans renderLoop(), juste après avoir défini la position et rotation de la caméra :
                
                flashlight.position.copy(camera.position);
                // Décale légèrement la lampe vers la droite du joueur (comme s'il la tenait)
                flashlight.position.x += Math.cos(state.anomalyGame.yaw) * 0.2; 
                flashlight.position.y -= 0.1;

                flashlight.target.position.set(
                    camera.position.x - Math.sin(state.anomalyGame.yaw) * 5,
                    camera.position.y - Math.sin(state.anomalyGame.pitch) * 5,
                    camera.position.z - Math.cos(state.anomalyGame.yaw) * 5
                );

                // --- LOGIQUE DE BOUCLE INFINIE ---
                let wentForward = state.anomalyGame.playerZ < -26;
                let wentBackward = state.anomalyGame.playerZ > 12;

                if (wentForward || wentBackward) {
                    if (state.anomalyGame.isTransitioning) return;
                    state.anomalyGame.isTransitioning = true;
                    
                    let success = (wentForward && !hasAnomaly) || (wentBackward && hasAnomaly);
                    
                    state.anomalyGame.historyLog.push({
                        stage: state.anomalyGame.stage,
                        hasAnomaly: state.anomalyGame.hasAnomaly,
                        anomalyId: state.anomalyGame.anomalyId,
                        anomalyName: state.anomalyGame.hasAnomaly ? (THEMES_CONFIG[currentTheme].anomalies[state.anomalyGame.anomalyId] || "Anomalie") : "Normal",
                        action: wentForward ? "Avancé" : "Demi-tour",
                        success: success
                    });

                    if (success) state.anomalyGame.stage++; 
                    else state.anomalyGame.stage = 0;

                    if (state.anomalyGame.stage > state.anomalyGame.maxStageReached) {
                        state.anomalyGame.maxStageReached = state.anomalyGame.stage;
                    }
                    window.anomalyPushProgress(false);

                    if (state.anomalyGame.stage >= state.anomalyGame.targetStages) {
                        finishAnomalyGame();
                        return;
                    }
                    
                    triggerBlinkTransition(() => {
                        state.anomalyGame.isTransitioning = false;
                        let spawnZ = wentForward ? 10 : -24;
                        setupAnomalyStage(spawnZ);
                    });
                    return;
                }

                state.anomalyData.renderer.render(scene, camera);
                state.anomalyData.animId = requestAnimationFrame(renderLoop);
            }
            renderLoop();
}

window.finishAnomalyGame = function() {
    const g = state.anomalyGame;
    if (!g || g.finished) return;
    g.finished = true;
    clearInterval(g.timerInterval);
    if (document.pointerLockElement) document.exitPointerLock();
    if (state.anomalyData.animId) cancelAnimationFrame(state.anomalyData.animId);

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
