///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
////////////////// --- MODE ANOMALIES 3D --- //////////////////
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////

// --- LISTE DES ANOMALIES 3D (Style Exit 8) ---
const THEMES_CONFIG = {
            metro: {
                wallTexture: 'https://images.unsplash.com/photo-1617391764619-3c7d674eb8f7?auto=format&fit=crop&w=1024&q=80',
                floorTexture: 'https://images.unsplash.com/photo-1596205739343-41bbd9c7bb7f?auto=format&fit=crop&w=1024&q=80',
                lightColor: 0xfffbeb,
                anomalies: {
                    1: "Une seule dalle du plafond est décalée de 5 centimètres",
                    2: "Noir complet (Coupure de courant)",
                    3: "Portes du métro qui s'ouvrent sur le vide",
                    4: "Le panneau indique une direction satanique",
                    5: "Les bandes podotactiles jaunes sont inversées avec le béton",
                    6: "Une ombre immense est projetée au fond du couloir sans source",
                    7: "L'affiche publicitaire vous fixe des yeux",
                    8: "Le couloir est plus étroit de 30 centimètres"
                }
            },
            hopital: {
                wallTexture: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=1024&q=80',
                floorTexture: 'https://images.unsplash.com/photo-1581404118991-381bb4542289?auto=format&fit=crop&w=1024&q=80',
                lightColor: 0xe0f2fe,
                anomalies: {
                    1: "Le néon central clignote en morse (S.O.S)",
                    2: "Bruit de respiration artificielle",
                    3: "Une porte respire imperceptiblement (échelle dynamique)",
                    4: "Le mur de gypse est percé, montrant de l'isolant acoustique",
                    5: "Plafond qui s'effondre partiellement",
                    6: "Une porte d'isolement est grande ouverte",
                    7: "L'extincteur a disparu",
                    8: "Le couloir s'incline de 5 degrés vers le bas"
                }
            },
            hotel: {
                wallTexture: 'https://images.unsplash.com/photo-1615800098779-1be32e60cca3?auto=format&fit=crop&w=1024&q=80',
                floorTexture: 'https://images.unsplash.com/photo-1533256926955-4c07c2dc1b9f?auto=format&fit=crop&w=1024&q=80',
                lightColor: 0xffedd5,
                anomalies: {
                    1: "Les motifs géométriques de la moquette pivotent de 90 degrés",
                    2: "Deux portes portent le numéro 237",
                    3: "La poignée d'une porte est montée à l'envers",
                    4: "Le papier peint pèle subtilement",
                    5: "La hauteur du couloir rétrécit brutalement",
                    6: "Les ombres des chaises sont projetées dans la mauvaise direction",
                    7: "Tableaux dont les personnages ont disparu",
                    8: "Lumières qui s'éteignent une à une derrière vous"
                }
            }
        };

const textureLoader = new THREE.TextureLoader();
const textureCache = {};

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

window.startAnomalyMode = function() {
            showScreen('screen-generic-game');
            document.getElementById('generic-game-title').innerText = "Couloir des Anomalies 3D";
            
            state.anomalyGame = {
                stage: 0,
                maxStageReached: 0,
                theme: (window.currentRoom && window.currentRoom.settings && window.currentRoom.settings.anomalyTheme) || 'metro', // NOUVEAU
                targetStages: (window.currentRoom && window.currentRoom.settings && window.currentRoom.settings.anomalyStages) || state.anomalySettings.targetStages || 8,
                timeLeft: (window.currentRoom && window.currentRoom.settings && window.currentRoom.settings.anomalyTimer) || state.anomalySettings.maxTime || 300,
                // ... (laissez le reste de l'objet tel quel)
                timerInterval: null,
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
            
            // CORRECTION : Éviter le crash en convertissant l'objet Firebase en tableau
            const playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
            playersArr.forEach(p => {
                if (p) p.maxStage = 0;
            });

            document.getElementById('generic-game-content').innerHTML = `
                <div class="space-y-3 w-full relative">
                    <div class="flex justify-between items-center px-2">
                        <span class="text-xs font-bold text-indigo-400">Sortie actuelle : <span id="anomaly-stage-display" class="text-amber-400 text-sm font-black">Sortie 0</span> / ${state.anomalyGame.targetStages}</span>
                        <span class="text-[11px] text-slate-400 font-medium">Contrôles : ZQSD ou Flèches | Souris pour regarder | <b class="text-indigo-300">Shift</b> pour courir</span>
                    </div>

                    <div id="anomaly-canvas-container" class="relative cursor-pointer rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                        <div class="absolute top-2 left-2 z-10 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-300 pointer-events-none">
                            <i class="fa-solid fa-mouse mr-1 text-indigo-400"></i> Cliquez pour capturer la souris
                        </div>
                        <div id="anomaly-hint-banner" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/95 px-5 py-2.5 rounded-full border border-indigo-500/30 text-xs text-indigo-300 pointer-events-none text-center shadow-lg transition-opacity duration-500">
                            <b class="text-emerald-400"><i class="fa-solid fa-shield-halved"></i> Sortie 0 : Observez bien la référence (0 anomalie)</b>
                        </div>
                    </div>
                </div>
            `;

            clearInterval(state.anomalyGame.timerInterval);
            state.anomalyGame.timerInterval = setInterval(() => {
                state.anomalyGame.timeLeft--;
                const timerEl = document.getElementById('generic-game-timer');
                if (timerEl) {
                    let mins = Math.floor(state.anomalyGame.timeLeft / 60);
                    let secs = state.anomalyGame.timeLeft % 60;
                    timerEl.innerText = `Temps : ${mins}:${secs < 10 ? '0' : ''}${secs}`;
                }
                if (state.anomalyGame.timeLeft <= 0) {
                    clearInterval(state.anomalyGame.timerInterval);
                    finishAnomalyGame();
                }
            }, 1000);
            
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

window.anomalyRequestLock = function() {
            const container = document.getElementById('anomaly-canvas-container');
            if (container) {
                try { container.requestPointerLock(); } catch(e) {}
            }
}

window.handleKeyDown = function(e) {
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'z' || key === 'arrowup') state.anomalyGame.keys['forward'] = true;
            if (key === 's' || key === 'arrowdown') state.anomalyGame.keys['backward'] = true;
            if (key === 'a' || key === 'q' || key === 'arrowleft') state.anomalyGame.keys['left'] = true;
            if (key === 'd' || key === 'arrowright') state.anomalyGame.keys['right'] = true;
            if (e.key === 'Shift') state.anomalyGame.keys['shift'] = true;
}

window.handleKeyUp = function(e) {
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
                container.addEventListener('click', anomalyRequestLock);
                window.anomalyEventsBound = true;
            }

            // GESTION DU MOTEUR
            if (!state.anomalyData.renderer) {
                const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
                renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                
                // NOUVEAU : Traitement colorimétrique réaliste
                renderer.outputEncoding = THREE.sRGBEncoding;
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 0.8; // Assombrit légèrement l'image globale

                container.appendChild(renderer.domElement);
                state.anomalyData.renderer = renderer;

                // Réticule (Crosshair) pour le confort
                const crosshair = document.createElement('div');
                crosshair.style.position = 'absolute';
                crosshair.style.top = '50%'; crosshair.style.left = '50%';
                crosshair.style.width = '6px'; crosshair.style.height = '6px';
                crosshair.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                crosshair.style.borderRadius = '50%';
                crosshair.style.transform = 'translate(-50%, -50%)';
                crosshair.style.pointerEvents = 'none';
                container.appendChild(crosshair);

                window.addEventListener('resize', () => {
                    if (state.anomalyData.camera && state.anomalyData.renderer && document.getElementById('screen-generic-game').classList.contains('hidden') === false) {
                        state.anomalyData.camera.aspect = container.clientWidth / container.clientHeight;
                        state.anomalyData.camera.updateProjectionMatrix();
                        state.anomalyData.renderer.setSize(container.clientWidth, container.clientHeight);
                    }
                });
            }

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
            flashlight.castShadow = true;
            scene.add(flashlight);
            scene.add(flashlight.target);
            
            // ... Gardez la logique des néons, mais baissez leur intensité
            let pointLights = [];
            let emissiveMats = [];

            // GÉOMÉTRIE & MATÉRIAUX RÉALISTES
            const themeData = THEMES_CONFIG[currentTheme];
            const maxAnisotropy = state.anomalyData.renderer.capabilities.getMaxAnisotropy();
            
            // Chargement dynamique des textures avec exceptions visuelles
            let wTexUrl = themeData.wallTexture;
            let fTexUrl = themeData.floorTexture;

            if (hasAnomaly && currentTheme === 'hotel' && anomalyId === 4) wTexUrl = 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=512&q=80'; // Papier peint s'écaille (Briques)
            
            const wallTex = loadRealTexture(wTexUrl, 6, 2);
            wallTex.anisotropy = maxAnisotropy;
            const floorTex = loadRealTexture(fTexUrl, 2, 15);
            floorTex.anisotropy = maxAnisotropy;

            if (hasAnomaly && currentTheme === 'hotel' && anomalyId === 1) {
                floorTex.rotation = Math.PI / 2; // Moquette inversée
            }

            // Modifiez la déclaration de floorMat et wallMat dans GÉOMÉTRIE & MATÉRIAUX
            const floorMat = new THREE.MeshStandardMaterial({ 
                map: floorTex, 
                roughness: 0.8, 
                metalness: 0.1,
                bumpMap: floorTex, // Utilise l'image pour créer du relief
                bumpScale: 0.015
            });
            const wallMat = new THREE.MeshStandardMaterial({ 
                map: wallTex, 
                roughness: 0.6, 
                metalness: 0.05,
                bumpMap: wallTex,
                bumpScale: 0.01
            });
            
            const ceilingColor = currentTheme === 'hopital' ? 0xd1d5db : (currentTheme === 'hotel' ? 0x78716c : 0x1e293b);
            const ceilingMat = new THREE.MeshStandardMaterial({ color: ceilingColor, roughness: 0.9 });
            const doorMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.4 });

            let ceilingHeight = 3.2;
            if (hasAnomaly && ((currentTheme === 'hopital' && anomalyId === 5) || (currentTheme === 'hotel' && anomalyId === 5))) {
                ceilingHeight = 2.1; // Plafond s'effondre / rétrécit
            }
            
            const wallDist = 3.5;

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
                    pl.castShadow = true;
                    pointLights.push(pl);
                    corridorGroup.add(pl);
                }
            }

            // Portes
            [-18, -6, 6].forEach((zPos, dIdx) => {
                const doorGroup = new THREE.Group();
                const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 1.4), doorMat);
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

            // Anomalies Physiques (Sang / Encombrements)
            if (hasAnomaly && currentTheme === 'hopital' && anomalyId === 3) {
                const bloodMat = new THREE.MeshStandardMaterial({color: 0x7f1d1d, roughness: 0.1, transparent: true, opacity: 0.8});
                for(let i=0; i<5; i++) {
                    const splat = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random(), 16), bloodMat);
                    splat.rotation.x = -Math.PI/2;
                    splat.position.set((Math.random()-0.5)*2, 0.01, -10 + (Math.random()-0.5)*10);
                    corridorGroup.add(splat);
                }
            }

            const extGroup = new THREE.Group();
            const extincteur = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 16), new THREE.MeshStandardMaterial({color:0xdc2626, metalness:0.3}));
            extGroup.add(extincteur);
            extGroup.position.set(-wallDist + 0.2, 1.0, -12);
            corridorGroup.add(extGroup);

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

window.renderLoop = function() {
                if (document.getElementById('screen-generic-game').classList.contains('hidden')) {
                    return; 
                }
                
                const delta = clock.getDelta(); // Temps écoulé depuis la dernière frame

                // Animations en direct
                if (hasAnomaly) {
                    if (currentTheme === 'hopital' && anomalyId === 3) {
                        doorGroup.scale.set(1, 1 + Math.sin(Date.now() * 0.002) * 0.02, 1); // La porte respire
                    }
                    if (currentTheme === 'hotel' && anomalyId === 8) {
                        pointLights.forEach((pl) => {
                            if (camera.position.z < pl.position.z) pl.intensity = 0; 
                        });
                    }
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

                    if (state.anomalyGame.stage >= state.anomalyGame.targetStages) {
                        clearInterval(state.anomalyGame.timerInterval);
                        if (document.pointerLockElement) document.exitPointerLock();
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
            clearInterval(state.anomalyGame.timerInterval);
            if (document.pointerLockElement) document.exitPointerLock();
            
            const playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
            
            playersArr.forEach(p => {
                if (p && p.isBot) {
                    p.maxStage = Math.floor(Math.random() * (state.anomalyGame.targetStages + 1));
                    p.score = p.maxStage * 1000;
                } else if (p) {
                    p.maxStage = state.anomalyGame.maxStageReached;
                    p.score = state.anomalyGame.maxStageReached * 1000;
                }
            });

            if (window.isHost && window.currentCodeSalon) {
                const updates = {};
                playersArr.forEach(p => {
                    if (p && p.name) updates[`players/${p.name}/score`] = p.score;
                });
                window.update(window.ref(window.db, `salons/${window.currentCodeSalon}`), updates);
            }

            if (typeof showFinalResults === 'function') {
                showFinalResults();
            }
}

