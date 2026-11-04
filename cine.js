// --- 5. CINÉMATOPHILE ---

CINE_MOVIES.forEach(movie => {
    const img = new Image();
    img.src = movie.poster;
});

let cineTimerInterval = null;
let windowCineTextInterval = null;
let cineCurrentImg = new Image();
cineCurrentImg.crossOrigin = "Anonymous";

function renderCineScreen(data) {
    const gameData = data.cineGame;
    if (!gameData) return;
    
    // Stockage global temporaire pour actualiser le statut net en direct dans l'intervalle
    window.latestCineGameData = gameData;

    if (document.getElementById('screen-cine').classList.contains('hidden')) {
        showScreen('screen-cine');
    }

    const currentMovie = gameData.movies[gameData.currentRound - 1];
    document.getElementById('cine-round-indicator').innerHTML = `<i class="fa-solid fa-film"></i> Cinématophile - Manche ${gameData.currentRound}/${gameData.maxRounds}`;
    
    const winnerBox = document.getElementById('cine-winner-box');
    const inputArea = document.getElementById('cine-input-area');
    const nextBtn = document.getElementById('cine-next-btn');
    const timerDisplay = document.getElementById('cine-timer');
    const storyBox = document.getElementById('cine-story-box');
    const statusBar = document.getElementById('cine-players-status-bar');

    const myName = window.myPlayerKey || state.username;
    const playerStatusMap = gameData.playerStatus || {};
    const myStatus = playerStatusMap[myName] || { solved: false };

    // Rendu de la barre de statut des joueurs en continu (visible en permanence pour tous)
    if (statusBar && data.players) {
        const playersArr = Array.isArray(data.players) ? data.players : Object.values(data.players);
        statusBar.innerHTML = playersArr.filter(p => p && !p.isBot).map(p => {
            const pName = p.name || p.pseudo;
            const pStat = playerStatusMap[pName] || { solved: false };
            const badgeColor = pStat.solved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-400 border-slate-700';
            let icon = '<i class="fa-solid fa-hourglass-half animate-pulse text-amber-400"></i> Cherche...';
            let badgeColore = 'bg-slate-900 text-slate-400 border-slate-700';
            
            if (pStat.solved) {
                badgeColore = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                icon = '<i class="fa-solid fa-check text-emerald-400"></i> Trouvé !';
            } else if (pStat.timedOut || gameData.status === 'ROUND_OVER') {
                badgeColore = 'bg-red-500/20 text-red-300 border-red-500/40';
                icon = '<i class="fa-solid fa-xmark text-red-400"></i> Temps écoulé';
            }
            return `<div class="px-3 py-1.5 rounded-lg border ${badgeColore} flex items-center gap-2 font-mono"><span>${pName}</span> : <span>${icon}</span></div>`;
        }).join('');
    }

    if (gameData.status === 'PLAYING') {
        winnerBox.classList.add('hidden');
        
        if (myStatus.solved) {
            inputArea.classList.add('hidden');
        } else {
            inputArea.classList.remove('hidden');
        }

        nextBtn.classList.add('hidden');
        
        if (window.cineCurrentMovieTitle !== currentMovie.title) {
            window.cineCurrentMovieTitle = currentMovie.title;
            if (!myStatus.solved) document.getElementById('input-cine-guess').value = '';
            
            if (cineTimerInterval) clearInterval(cineTimerInterval);
            if (windowCineTextInterval) clearInterval(windowCineTextInterval);
            
            cineCurrentImg = new Image();
            cineCurrentImg.crossOrigin = "Anonymous";

            let isInitialized = false; 

            const initPosterGame = () => {
                if (isInitialized) return;
                isInitialized = true;

                window.cineTimeLeft = gameData.timer || 90;
                
                const getPixelSize = (timeLeft, isSolved) => {
                    if (isSolved) return 1; // Netteté parfaite immédiate dès que trouvé
                    let progress = Math.max(0, Math.min(1, 1 - (timeLeft / (gameData.timer || 90))));
                    return Math.max(1, Math.floor(60 * Math.pow(1 - progress, 0.6) + 2 * progress));
                };
                
                drawPixelatedPoster(cineCurrentImg, getPixelSize(window.cineTimeLeft, myStatus.solved));

                const fullText = currentMovie.storyText || "Le texte narratif de ce film n'a pas encore été configuré dans les données.";
                let currentCharIndex = 0;
                const typingSpeed = Math.max(20, Math.floor(((gameData.timer || 90) * 1000) / fullText.length));

                windowCineTextInterval = setInterval(() => {
                    if (currentCharIndex <= fullText.length) {
                        const displayedText = fullText.substring(0, currentCharIndex);
                        if (storyBox) {
                            storyBox.innerHTML = `${displayedText}<span class="animate-pulse font-black text-pink-500">_</span>`;
                            const textContainer = storyBox.parentElement;
                            if (textContainer) textContainer.scrollTop = textContainer.scrollHeight;
                        }
                        currentCharIndex++;
                    } else {
                        clearInterval(windowCineTextInterval);
                    }
                }, typingSpeed);

                cineTimerInterval = setInterval(() => {
                    window.cineTimeLeft--;
                    timerDisplay.innerText = window.cineTimeLeft + 's';

                    // Lecture dynamique du statut mis à jour pour basculer l'affiche en net instantanément
                    const latestStatusMap = (window.latestCineGameData && window.latestCineGameData.playerStatus) || {};
                    const isNowSolved = latestStatusMap[myName]?.solved || false;

                    drawPixelatedPoster(cineCurrentImg, getPixelSize(window.cineTimeLeft, isNowSolved));

                    if (window.cineTimeLeft <= 0) {
                        clearInterval(cineTimerInterval);
                        clearInterval(windowCineTextInterval);
                        if (window.isHost) {
                            // Marquer automatiquement les joueurs non-trouvés comme "Temps écoulé"
                            window.rejoindreSalonFirebaseGet(window.currentCodeSalon, (latestData) => {
                                const pStatuses = latestData.cineGame?.playerStatus || {};
                                const players = latestData.players || {};
                                const updates = { 'cineGame/status': 'ROUND_OVER' };
                                
                                Object.values(players).forEach(p => {
                                    if (p && !p.isBot) {
                                        const pName = p.name || p.pseudo;
                                        if (!pStatuses[pName]?.solved) {
                                            updates[`cineGame/playerStatus/${pName}`] = { solved: false, timedOut: true };
                                        }
                                    }
                                });
                                window.mettreAJourSalonFirebase(window.currentCodeSalon, updates);
                            });
                        }
                    }
                }, 1000);
            };

            cineCurrentImg.onload = initPosterGame;
            cineCurrentImg.src = currentMovie.poster;

            if (cineCurrentImg.complete && cineCurrentImg.naturalWidth > 0) {
                initPosterGame();
            }
        } else {
            const getPixelSize = (timeLeft, isSolved) => {
                if (isSolved) return 1;
                let progress = Math.max(0, Math.min(1, 1 - (timeLeft / (gameData.timer || 90))));
                return Math.max(1, Math.floor(60 * Math.pow(1 - progress, 0.6) + 2 * progress));
            };
            if (window.cineTimeLeft !== undefined) {
                drawPixelatedPoster(cineCurrentImg, getPixelSize(window.cineTimeLeft, myStatus.solved));
            }
        }
    } else if (gameData.status === 'ROUND_OVER') {
        clearInterval(cineTimerInterval);
        if (windowCineTextInterval) clearInterval(windowCineTextInterval);
        
        drawPixelatedPoster(cineCurrentImg, 1);
        window.cineCurrentMovieTitle = null; 
        
        if (storyBox) storyBox.innerHTML = currentMovie.storyText || "";
        
        inputArea.classList.add('hidden');
        winnerBox.classList.remove('hidden');
        
        winnerBox.innerHTML = `Fin de la manche ! Le film était : <strong class="text-white">${currentMovie.title}</strong>`;
        winnerBox.className = "w-full max-w-md p-4 bg-indigo-500/20 border border-indigo-500 rounded-xl text-indigo-300 font-bold mb-4 shadow-lg";

        // Le bouton s'affiche pour TOUT LE MONDE
        nextBtn.classList.remove('hidden');
        const hasVotedNext = window.hasVotedCineNext || (gameData.readyForNext && gameData.readyForNext[myName]);
        
        if (hasVotedNext) {
            nextBtn.disabled = true;
            nextBtn.className = "w-full max-w-md bg-slate-800 text-slate-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition shadow-lg";
            nextBtn.innerHTML = '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...';
        } else {
            nextBtn.disabled = false;
            nextBtn.className = "w-full max-w-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition";
            nextBtn.innerHTML = gameData.currentRound >= gameData.maxRounds ? 'Voir les résultats <i class="fa-solid fa-trophy ml-2"></i>' : 'Manche Suivante <i class="fa-solid fa-arrow-right ml-2"></i>';
        }
    }
}

// Fonction moteur pour dessiner l'image avec des "gros" pixels
function drawPixelatedPoster(img, pixelSize) {
    const canvas = document.getElementById('cine-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    canvas.width = 400; 
    canvas.height = 600;
    
    if (pixelSize <= 1) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return;
    }

    const smallWidth = Math.max(1, Math.floor(canvas.width / pixelSize));
    const smallHeight = Math.max(1, Math.floor(canvas.height / pixelSize));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = smallWidth;
    tempCanvas.height = smallHeight;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(img, 0, 0, smallWidth, smallHeight);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, smallWidth, smallHeight, 0, 0, canvas.width, canvas.height);
}

// Outil pour nettoyer les accents et caractères spéciaux
function normalizeGuess(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

window.submitCineGuess = function() {
    const input = document.getElementById('input-cine-guess');
    if (!input || !input.value.trim()) return;
    
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!roomCode) return;
    
    window.rejoindreSalonFirebaseGet(roomCode, (data) => {
        const gameData = data.cineGame;
        if (!gameData || gameData.status !== 'PLAYING') return;

        const currentMovie = gameData.movies[gameData.currentRound - 1];
        const guess = normalizeGuess(input.value);
        
        let isCorrect = (normalizeGuess(currentMovie.title) === guess);
        if (currentMovie.aliases) {
            currentMovie.aliases.forEach(alias => {
                if (normalizeGuess(alias) === guess) isCorrect = true;
            });
        }
        
        if (isCorrect) {
            const myName = window.myPlayerKey || state.username;
            const pts = 500 + ((window.cineTimeLeft || 0) * 20);
            let currentScore = data.players[myName]?.score || 0;
            
            const updates = {};
            updates[`cineGame/playerStatus/${myName}`] = { solved: true, timeFound: window.cineTimeLeft };
            updates[`players/${myName}/score`] = currentScore + pts;
            
            window.update(window.ref(window.db, `salons/${roomCode}`), updates).then(() => {
                window.rejoindreSalonFirebaseGet(roomCode, (freshData) => {
                    const players = freshData.players || {};
                    const playersArr = Array.isArray(players) ? players : Object.values(players);
                    const humanPlayers = playersArr.filter(p => p && (p.name || p.pseudo) && !p.isBot);
                    const playerStatus = freshData.cineGame?.playerStatus || {};
                    
                    const allFound = humanPlayers.length > 0 && humanPlayers.every(p => playerStatus[p.name || p.pseudo]?.solved);
                    // N'importe quel joueur peut déclencher la fin de manche dès que tout le monde a trouvé
                    if (allFound && freshData.cineGame?.status === 'PLAYING') {
                        window.mettreAJourSalonFirebase(roomCode, { 'cineGame/status': 'ROUND_OVER' });
                    }
                });
            });
        } else {
            input.classList.add('border-red-500');
            input.value = "";
            setTimeout(() => input.classList.remove('border-red-500'), 500);
        }
    });
};

window.nextCineRound = function() {
    const roomCode = window.currentCodeSalon || state.roomCode;
    const myName = window.myPlayerKey || state.username;
    if (!roomCode) return;
    
    window.hasVotedCineNext = true;
    const updates = {};
    updates[`cineGame/readyForNext/${myName}`] = true;
    
    // On met à jour Firebase. La vérification globale est gérée proprement 
    // soit ici, soit par l'écouteur en temps réel pour synchroniser tous les clients.
    window.update(window.ref(window.db, `salons/${roomCode}`), updates).then(() => {
        window.rejoindreSalonFirebaseGet(roomCode, (data) => {
            const gameData = data.cineGame;
            if (!gameData) return;
            
            const players = data.players || {};
            const playersArr = Array.isArray(players) ? players : Object.values(players);
            const humanPlayers = playersArr.filter(p => p && (p.name || p.pseudo) && !p.isBot);
            const readyMap = gameData.readyForNext || {};
            
            const allReady = humanPlayers.length > 0 && humanPlayers.every(p => readyMap[p.name || p.pseudo]);
            
            // Si tout le monde est prêt, n'importe quel client (Hôte ou invité) peut pousser la mise à jour globale
            if (allReady) {
                if (gameData.currentRound >= gameData.maxRounds) {
                    window.mettreAJourSalonFirebase(roomCode, { status: 'LOBBY', cineGame: null });
                    showFinalResults();
                } else {
                    window.mettreAJourSalonFirebase(roomCode, {
                        'cineGame/status': 'PLAYING',
                        'cineGame/currentRound': gameData.currentRound + 1,
                        'cineGame/playerStatus': null,
                        'cineGame/readyForNext': null,
                        'cineGame/winner': null
                    });
                }
            }
        });
    });
};