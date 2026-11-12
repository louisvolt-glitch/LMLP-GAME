const DEFAULT_API_KEY = "AIzaSyCoCDduQzs1y82FX6cB7kO0tBPOVFJknIM";
     
window.loadGoogleMapsApi = function(callback) {  
            if (window.google && window.google.maps) {
                if (callback) callback();
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${DEFAULT_API_KEY}&libraries=geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => { if (callback) callback(); };
            document.head.appendChild(script);
        }

const GLOBAL_UNIQUE_POOL = [];

        baseRealCoords.forEach(([lat, lng]) => {
            GLOBAL_UNIQUE_POOL.push({ coords: [lat, lng] });
            for (let i = 1; i <= 20; i++) {
                GLOBAL_UNIQUE_POOL.push({ coords: [lat + (Math.sin(i) * 0.03), lng + (Math.cos(i) * 0.03)] });
            }
        });

window.startNextRound = function() {
            // Nettoyage de l'ancien timer pour éviter les conflits
            clearInterval(state.geoTimerInterval);

            // SÉCURITÉ : Récupération des paramètres de manches et de temps
            if (window.currentRoom && window.currentRoom.settings) {
                state.settings.rounds = window.currentRoom.settings.geoRounds || window.currentRoom.settings.rounds || 5;
                state.settings.timer = window.currentRoom.settings.geoTimer || window.currentRoom.settings.timer || 45;
            }

            if (!state.activeLocations || state.activeLocations.length === 0) {
                if (window.currentRoom && window.currentRoom.activeLocations) {
                    state.activeLocations = Array.isArray(window.currentRoom.activeLocations) 
                        ? window.currentRoom.activeLocations 
                        : Object.values(window.currentRoom.activeLocations);
                } else {
                    let pool = [...GLOBAL_UNIQUE_POOL].sort(() => Math.random() - 0.5);
                    state.activeLocations = pool.slice(0, state.settings.rounds);
                }
            }

            const totalRounds = state.settings.rounds || state.activeLocations.length;
            if (state.currentRound >= totalRounds) { 
                showFinalResults(); 
                return; 
            }
            
            state.currentLocation = state.activeLocations[state.currentRound];
            if (!state.currentLocation || !state.currentLocation.coords) {
                state.currentLocation = { coords: [48.8566, 2.3522] };
            }

            // Réinitialisation complète pour la nouvelle manche
            state.userGuessCoords = null;
            state.googleMarkerGuess = null;

            // Réinitialiser le HTML de la minimap pour réafficher le bouton de validation
            const minimapBox = document.getElementById('minimap-box');
            if (minimapBox) {
                minimapBox.innerHTML = `
                    <div id="geoguessr-map" class="w-full h-[calc(100%-40px)] rounded-xl"></div>
                    <button onclick="submitGeoGuess()" class="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl transition text-xs shadow-lg mt-2 flex items-center justify-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-check-circle"></i> Valider mon Repère
                    </button>
                `;
            }

            showScreen('screen-game-geoguessr');
            
            const roundIndicator = document.getElementById('round-indicator');
            if (roundIndicator) {
                roundIndicator.innerText = `Manche ${state.currentRound + 1} / ${totalRounds}`;
            }

            let holder = document.getElementById('streetview-holder');
            holder.innerHTML = `<div id="sv-native" class="w-full h-full"></div>`;
            
            const loadPano = (loc, attempt = 0) => {
                // CORRECTION 1 : Retrait du Math.random(). Tous les joueurs chargent la coordonnée stricte.
                let latLng = new google.maps.LatLng(loc.coords[0], loc.coords[1]);
                
                new google.maps.StreetViewService().getPanorama({ 
                    location: latLng, 
                    radius: 2000,
                    source: google.maps.StreetViewSource.OUTDOOR 
                }, (data, status) => {
                    if (status === google.maps.StreetViewStatus.OK && data && data.copyright && data.copyright.includes('Google')) {
                        
                        state.currentLocation.coords = [data.location.latLng.lat(), data.location.latLng.lng()];

                        state.nativePano = new google.maps.StreetViewPanorama(document.getElementById('sv-native'), {
                            position: data.location.latLng, 
                            pov: { heading: 0, pitch: 0 }, 
                            zoom: 1, 
                            showRoadLabels: false, 
                            addressControl: false,
                            linksControl: true,    
                            panControl: true,      
                            enableCloseButton: false
                        });
                        setTimeout(() => {
                            google.maps.event.trigger(state.nativePano, 'resize');
                        }, 200);
                    } else {
                        // CORRECTION 2 : Utilisation d'un index de secours "déterministe" partagé par tous les joueurs.
                        let nextIndex = (Math.floor(Math.abs(loc.coords[0] * 100)) + state.currentRound + attempt) % GLOBAL_UNIQUE_POOL.length;
                        loadPano(GLOBAL_UNIQUE_POOL[nextIndex], attempt + 1);
                    }
                });
            };
            loadPano(state.currentLocation, 1);

            state.googleMapGuess = new google.maps.Map(document.getElementById('geoguessr-map'), { 
                center: { lat: 20, lng: 0 }, 
                zoom: 1, 
                streetViewControl: false, 
                mapTypeControl: false,
                scrollwheel: true, // Autorise explicitement le zoom avec la molette de la souris
                gestureHandling: 'auto'
            });

            state.googleMapGuess.addListener('click', (e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                state.userGuessCoords = [lat, lng]; // Sauvegarde les coordonnées du joueur

                if (state.googleMarkerGuess) {
                    // Déplace le marqueur existant
                    state.googleMarkerGuess.setPosition(e.latLng);
                } else {
                    // Crée le marqueur s'il n'existe pas encore
                    state.googleMarkerGuess = new google.maps.Marker({
                        position: e.latLng,
                        map: state.googleMapGuess,
                        title: "Mon Repère"
                    });
                }
            });

            state.geoTimer = state.settings.timer;
            const timerEl = document.getElementById('geo-timer');
            if (timerEl) timerEl.innerText = `${state.geoTimer}s`;

            state.geoTimerInterval = setInterval(() => {
                state.geoTimer--;
                if (timerEl) timerEl.innerText = `${state.geoTimer}s`;
                if (state.geoTimer <= 0) { 
                    clearInterval(state.geoTimerInterval); 
                    submitGeoGuess(); 
                }
            }, 1000);
        }

window.returnToGeoSpawn = function() {
            if (state.nativePano && state.currentLocation && state.currentLocation.coords) {
                state.nativePano.setPosition(new google.maps.LatLng(state.currentLocation.coords[0], state.currentLocation.coords[1]));
            }
        };

window.submitGeoGuess = function() {
            clearInterval(state.geoTimerInterval);
            let target = state.currentLocation.coords;
            
            // Gérer le cas où le joueur n'a PAS mis de point (temps écoulé)
            let hasGuessed = state.userGuessCoords !== null;
            let dist = hasGuessed ? Math.round(google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(target[0], target[1]), new google.maps.LatLng(state.userGuessCoords[0], state.userGuessCoords[1])) / 1000) : '?';
            let pts = hasGuessed ? Math.max(0, Math.round(5000 * Math.exp(-dist / 2000))) : 0;
            
            let myKey = window.myPlayerKey || state.username;
            
            // Enregistrement local et sur Firebase du guess de ce joueur
            if (!state.players) state.players = {};
            if (!state.players[myKey]) state.players[myKey] = { name: myKey, score: 0 };
            state.players[myKey].score = (state.players[myKey].score || 0) + pts;
            
            // Si pas deviné, on force à null pour ne pas envoyer la vraie réponse
            state.players[myKey].lastGuess = hasGuessed ? state.userGuessCoords : null;
            state.players[myKey].lastDist = dist;
            state.players[myKey].lastPts = pts;

            let roomCode = window.currentCodeSalon || state.roomCode;
            if (roomCode && window.db) {
                const guessPayload = {
                    score: state.players[myKey].score,
                    guess: hasGuessed ? state.userGuessCoords : null,
                    dist: dist,
                    pts: pts,
                    submitted: true
                };
                const updates = {};
                updates[`geoGame/guesses/${myKey}`] = guessPayload;
                updates[`players/${myKey}/score`] = state.players[myKey].score;
                
                window.update(window.ref(window.db, `salons/${roomCode}`), updates);
            }

            // Afficher un message d'attente sur le bouton ou l'écran
            const minimapBox = document.getElementById('minimap-box');
            if (minimapBox) {
                minimapBox.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center p-4 space-y-2">
                        <i class="fa-solid fa-hourglass-half text-amber-400 text-2xl animate-spin"></i>
                        <span class="text-xs font-bold text-white">Repère validé.</span>
                        <span class="text-[11px] text-slate-400">En attente des autres joueurs...</span>
                    </div>
                `;
            }

            // Vérifier si tous les joueurs ont soumis
            checkAllGeoGuessesSubmitted();
        }

window.checkAllGeoGuessesSubmitted = function() {
            let roomCode = window.currentCodeSalon || state.roomCode;
            if (!roomCode) {
                showRoundSummary(state.players[window.myPlayerKey || state.username].lastDist, state.players[window.myPlayerKey || state.username].lastPts);
                return;
            }

            window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
                const data = snapshot.val();
                if (!data) return;

                let players = data.players || {};
                
                // SÉCURITÉ : Protéger contre les tableaux contenant des éléments null
                let playersArr = Array.isArray(players) ? players : Object.values(players);
                let humanPlayers = playersArr.filter(p => p && !p.isBot);
                let guesses = (data.geoGame && data.geoGame.guesses) ? data.geoGame.guesses : {};

                let allDone = humanPlayers.length > 0 && humanPlayers.every(p => {
                    const playerName = p.name || p.pseudo;
                    return playerName && guesses[playerName] && guesses[playerName].submitted;
                });
                
                const geoScreen = document.getElementById('screen-game-geoguessr');

                // On s'assure qu'on ne déclenche la page de résumé que si on est bien sur la carte
                if ((allDone || humanPlayers.length === 0) && geoScreen && !geoScreen.classList.contains('hidden')) {
                    let myKey = window.myPlayerKey || state.username;
                    let myData = guesses[myKey] || { dist: 20000, pts: 0 };
                    if (typeof showRoundSummary === 'function') {
                        showRoundSummary(myData.dist, myData.pts);
                    }
                }
            });
}

window.showRoundSummary = function(dist, pts) {
            showScreen('screen-round-summary');
            document.getElementById('round-score-info').innerText = `+${pts} pts (${dist} km)`;
            
            let roomCode = window.currentCodeSalon || state.roomCode;
            
            // Récupérer les données de la manche sur Firebase pour afficher les distances de tous les joueurs
            if (roomCode) {
                window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
                    const data = snapshot.val();
                    renderSummaryDetails(data);
                });
            } else {
                renderSummaryDetails(null);
            }
        }

window.renderSummaryDetails = function(data) {
            let playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
            let guesses = (data && data.geoGame && data.geoGame.guesses) ? data.geoGame.guesses : {};

            // Afficher la liste des joueurs avec leur score et leur distance respective
            document.getElementById('round-scores-list').innerHTML = playersArr.map(p => {
                const pName = p.name || p.pseudo;
                const pGuessData = guesses[pName] || { dist: '?', pts: 0 };
                
                // --- NOUVEAU BLOC : Priorité aux données du Guess pour éviter les décalages de synchronisation ---
            const totalScore = pGuessData.score !== undefined ? pGuessData.score : (p.score || 0);
            const roundPts = pGuessData.pts !== undefined ? pGuessData.pts : 0;
            
            return `
                <div class="flex justify-between items-center p-2.5 bg-slate-900 rounded-xl text-xs border border-slate-800">
                    <span class="font-bold text-white">${pName}</span>
                    <div class="flex items-center gap-3">
                        <span class="text-amber-400 font-mono">${pGuessData.dist !== '?' ? pGuessData.dist + ' km' : 'N/A'}</span>
                        <span class="text-emerald-400 font-mono font-bold">+${roundPts} pts (Total: ${totalScore})</span>
                    </div>
                </div>
            `;
            }).join('');

            setTimeout(() => {
                let target = state.currentLocation.coords;
                state.summaryGoogleMap = new google.maps.Map(document.getElementById('round-summary-map'), { 
                    center: { lat: target[0], lng: target[1] }, 
                    zoom: 3 
                });

                let targetLatLng = new google.maps.LatLng(target[0], target[1]);
                let bounds = new google.maps.LatLngBounds();
                bounds.extend(targetLatLng);

                new google.maps.Marker({ 
                    position: targetLatLng, 
                    map: state.summaryGoogleMap,
                    title: "Emplacement Réel",
                    icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                });

                // Définition d'une palette de couleurs et d'icônes pour différencier les joueurs
                const playerColors = ['#FF3366', '#3388FF', '#33FF88', '#FFCC33', '#9933FF', '#FF8833', '#33FFFF'];
                const iconUrls = [
                    "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                    "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                    "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                    "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
                    "http://maps.google.com/mapfiles/ms/icons/purple-dot.png",
                    "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
                    "http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png"
                ];

                let validGuesses = 0; // AJOUT 1 : Compteur de repères valides

                Object.keys(guesses).forEach((pName, index) => {
                    let gData = guesses[pName];
                    if (gData && gData.guess) {
                        validGuesses++; // On incrémente si le joueur a bien placé un repère
                        
                        let guessLatLng = new google.maps.LatLng(gData.guess[0], gData.guess[1]);
                        bounds.extend(guessLatLng);
                        
                        // Assigner une couleur unique basée sur l'index du joueur
                        let pColor = playerColors[index % playerColors.length];
                        let pIcon = iconUrls[index % iconUrls.length];

                        new google.maps.Marker({
                            position: guessLatLng,
                            map: state.summaryGoogleMap,
                            title: `${pName} (${gData.dist} km)`,
                            icon: pIcon,
                            label: {
                                text: pName,
                                color: "#111827", 
                                fontSize: "12px",
                                fontWeight: "bold",
                                className: "bg-white/80 px-1 rounded shadow-sm mt-8" 
                            }
                        });

                        new google.maps.Polyline({
                            path: [targetLatLng, guessLatLng],
                            geodesic: true,
                            strokeColor: pColor,
                            strokeOpacity: 0.9,
                            strokeWeight: 3, 
                            map: state.summaryGoogleMap
                        });
                    }
                });

                // AJOUT 2 : Logique de zoom conditionnel
                if (validGuesses > 0) {
                    // S'il y a des joueurs qui ont deviné, on cadre sur tous les points
                    state.summaryGoogleMap.fitBounds(bounds);
                    
                    // (Sécurité) Empêcher la carte de trop zoomer si les repères sont tous très proches
                    const listener = google.maps.event.addListener(state.summaryGoogleMap, "idle", function() { 
                        if (state.summaryGoogleMap.getZoom() > 6) { 
                            state.summaryGoogleMap.setZoom(6); 
                        } 
                        google.maps.event.removeListener(listener); 
                    });
                } else {
                    // Si PERSONNE n'a deviné, on centre sur la cible avec un dé-zoom de niveau Continent (4)
                    state.summaryGoogleMap.setCenter(targetLatLng);
                    state.summaryGoogleMap.setZoom(4); 
                }

            }, 300);
}

window.nextRoundOrFinish = function() {
    let myKey = window.myPlayerKey || state.username;
    let roomCode = window.currentCodeSalon || state.roomCode;

    // 1. Mettre à jour l'interface IMMÉDIATEMENT (avant la requête Firebase)
    const btn = document.getElementById('next-round-btn');
    if (btn) {
        btn.disabled = true;
        btn.className = "w-full bg-slate-800 text-slate-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition";
        btn.innerHTML = '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...';
    }

    if (!roomCode) {
        // Secours si testé en local sans salon Firebase
        setTimeout(() => { executeActualNextRoundOrFinish(); }, 1500);
        return;
    }

    // 2. Enregistrer que le joueur est prêt pour la prochaine manche dans Firebase
    const updates = {};
    updates[`geoGame/readyForNextRound/${myKey}`] = true;
    window.update(window.ref(window.db, `salons/${roomCode}`), updates);
}

window.executeActualNextRoundOrFinish = function() {
    state.currentRound++;
    
    let roomCode = window.currentCodeSalon || state.roomCode;
    if (roomCode && window.isHost) {
        // L'hôte réinitialise les soumissions ET le statut "prêt" pour la nouvelle manche
        const updates = {};
        updates[`geoGame/guesses`] = null;
        updates[`geoGame/readyForNextRound`] = null;
        updates[`currentRound`] = state.currentRound;
        window.update(window.ref(window.db, `salons/${roomCode}`), updates);
    }

    // Rétablir le bouton à son état normal pour la prochaine manche
    const btn = document.getElementById('next-round-btn');
    if (btn) {
        btn.disabled = false;
        btn.className = "w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg";
        btn.innerHTML = 'Manche Suivante <i class="fa-solid fa-arrow-right ml-2"></i>';
    }

    if (state.currentRound >= state.settings.rounds) {
        showFinalResults();
    } else {
        startNextRound();
    }
}
