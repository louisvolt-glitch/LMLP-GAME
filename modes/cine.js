// --- 5. CINÉMATOPHILE ---

CINE_MOVIES.forEach(movie => {
    const img = new Image();
    img.src = movie.poster;
});

let cineTimerInterval = null;
let windowCineTextInterval = null;
let cineCurrentImg = new Image();
cineCurrentImg.crossOrigin = "Anonymous";

// Identifiants locaux pour distinguer une nouvelle partie d'une nouvelle manche.
window.cineGameSessionKey = window.cineGameSessionKey || null;
window.cineLastRenderedRound = window.cineLastRenderedRound || 0;
window.cineRoundKey = window.cineRoundKey || null;
window.cineTransitionInProgressKey = window.cineTransitionInProgressKey || null;

function stopCineIntervals() {
    if (cineTimerInterval) {
        clearInterval(cineTimerInterval);
        cineTimerInterval = null;
    }

    if (windowCineTextInterval) {
        clearInterval(windowCineTextInterval);
        windowCineTextInterval = null;
    }
}

// Passage sécurisé à la manche suivante.
function advanceCineRoundIfReady(data, gameData, roundNumber, sessionKey) {
    if (!window.isHost || gameData.status !== 'ROUND_OVER') return;

    const playersRaw = data.players || {};
    const playersArr = Array.isArray(playersRaw)
        ? playersRaw
        : Object.values(playersRaw);

    const humanPlayers = playersArr.filter(
        p => p && (p.name || p.pseudo) && !p.isBot
    );

    const readyMap = gameData.readyForNext || {};

    const allReady = humanPlayers.length > 0 &&
        humanPlayers.every(p => !!readyMap[p.name || p.pseudo]);

    if (!allReady) return;

    const transitionKey = `${sessionKey}:${roundNumber}`;

    // Empêcher plusieurs transitions pour la même manche.
    if (window.cineTransitionInProgressKey === transitionKey) return;

    const roomCode = window.currentCodeSalon || state.roomCode;

    if (!roomCode || typeof window.update !== 'function') return;

    // Verrou local posé AVANT l'appel Firebase.
    window.cineTransitionInProgressKey = transitionKey;

    let updates;

    if (roundNumber >= Number(gameData.maxRounds || 1)) {

        updates = {
            status: 'RESULTS',
            cineGame: null
        };

    } else {

        const resetPlayerStatus = {};

        humanPlayers.forEach(p => {
            const pName = p.name || p.pseudo;

            resetPlayerStatus[pName] = {
                solved: false,
                timedOut: false,
		lives: 3
            };
        });

        // Réinitialiser également le joueur local, y compris l'hôte.
        const localName = window.myPlayerKey || state.username;

        if (localName) {
            resetPlayerStatus[localName] = {
                solved: false,
                timedOut: false
            };
        }

        updates = {
            status: 'IN_GAME',
            'cineGame/status': 'PLAYING',
            'cineGame/currentRound': roundNumber + 1,
            'cineGame/playerStatus': resetPlayerStatus,
            'cineGame/readyForNext': null,
            'cineGame/winner': null
        };
    }

    window.update(
        window.ref(window.db, `salons/${roomCode}`),
        updates
    ).catch(error => {

        // En cas d'échec, autoriser une nouvelle tentative.
        if (window.cineTransitionInProgressKey === transitionKey) {
            window.cineTransitionInProgressKey = null;
        }

        console.error(
            'Erreur lors du passage à la manche suivante (Cinématophile) :',
            error
        );
    });
}


function renderCineScreen(data) {

    const gameData = data && data.cineGame;
    if (!gameData) return;

    // === AJOUTER CE BLOC : VÉRIFICATION GLOBALE CENTRALISÉE PAR L'HÔTE ===
    if (window.isHost && gameData.status === 'PLAYING') {
        const playersArr = Array.isArray(data.players) ? data.players : Object.values(data.players || {});
        const humanPlayers = playersArr.filter(p => p && (p.name || p.pseudo) && !p.isBot);
        const playerStatusMap = gameData.playerStatus || {};

        const isRoundFinished = humanPlayers.length > 0 && humanPlayers.every(p => {
            const status = playerStatusMap[p.name || p.pseudo] || {};
            return status.solved || status.timedOut; // Vérifie si Trouvé OU Plus de vie/Temps écoulé
        });

        if (isRoundFinished) {
            const roomCode = window.currentCodeSalon || state.roomCode;
            if (roomCode) {
                window.mettreAJourSalonFirebase(roomCode, {
                    'cineGame/status': 'ROUND_OVER'
                });
                return; // Stoppe l'affichage local et laisse Firebase déclencher la fin pour tout le monde
            }
        }
    }

    const movies = Array.isArray(gameData.movies)
        ? gameData.movies
        : Object.values(gameData.movies || {});

    const roundNumber = Number(gameData.currentRound) || 1;

    const currentMovie = movies[roundNumber - 1];

    if (!currentMovie) {
        console.error(
            'Cinématophile : film introuvable pour la manche',
            roundNumber,
            gameData.movies
        );
        return;
    }

    // Identification unique de la partie.
    const sessionKey = String(
        data.startedAt || gameData.startedAt || 'cine-session'
    );

    if (window.cineGameSessionKey !== sessionKey) {

        stopCineIntervals();

        window.cineGameSessionKey = sessionKey;
        window.cineLastRenderedRound = 0;
        window.cineRoundKey = null;
        window.cineTransitionInProgressKey = null;

        window.cineCurrentMovieRound = null;
        window.cineCurrentMovieTitle = null;

        window.cineTimeLeft = undefined;
        window.hasVotedCineNext = false;
    }

    // Ignorer les anciennes mises à jour Firebase.
    if (roundNumber < Number(window.cineLastRenderedRound || 0)) {
        return;
    }

    window.cineLastRenderedRound = roundNumber;
    window.latestCineGameData = gameData;

    const cineScreen = document.getElementById('screen-cine');

    if (cineScreen && cineScreen.classList.contains('hidden')) {
        showScreen('screen-cine');
    }

    const roundIndicator = document.getElementById('cine-round-indicator');

    if (roundIndicator) {
        roundIndicator.innerHTML =
            `<i class="fa-solid fa-film"></i> Cinématophile - Manche ${roundNumber}/${gameData.maxRounds}`;
    }

    const winnerBox = document.getElementById('cine-winner-box');
    const inputArea = document.getElementById('cine-input-area');
    const guessInput = document.getElementById('input-cine-guess');
    const nextBtn = document.getElementById('cine-next-btn');
    const timerDisplay = document.getElementById('cine-timer');
    const storyBox = document.getElementById('cine-story-box');
    const statusBar = document.getElementById('cine-players-status-bar');

    const myName = window.myPlayerKey || state.username;

    const playerStatusMap = gameData.playerStatus || {};

    const myStatus = playerStatusMap[myName] || {
        solved: false,
        timedOut: false,
	lives: 3
    };

    const isSolved = !!myStatus.solved;

    const myLives = myStatus.lives !== undefined ? myStatus.lives : 3;
    updateCineHeartsUI(myLives);

    const isBlocked = isSolved || myLives <= 0 || myStatus.timedOut;

    if (inputArea) {
        inputArea.classList.toggle('hidden', isSolved);
        inputArea.style.display = isSolved ? 'none' : 'flex';
    }
    
    if (guessInput) {
        guessInput.disabled = isBlocked;
        
        // On récupère aussi le bouton "Deviner" pour le bloquer
        const guessBtn = inputArea ? inputArea.querySelector('button') : null;
        if (guessBtn) guessBtn.disabled = isBlocked;
        
        if (myLives <= 0 && !isSolved) {
            guessInput.placeholder = "PLUS DE VIES POUR CETTE MANCHE !";
            guessInput.value = ""; 
            guessInput.classList.add('opacity-50', 'cursor-not-allowed'); 
            if (guessBtn) guessBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            // RÉINITIALISATION EXPLICITE ICI
            guessInput.placeholder = "Titre du film..."; 
            guessInput.classList.remove('opacity-50', 'cursor-not-allowed');
            if (guessBtn) guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // AFFICHAGE DU STATUT DES JOUEURS
    if (statusBar && data.players) {

        const playersArr = Array.isArray(data.players)
            ? data.players
            : Object.values(data.players);

        statusBar.innerHTML = playersArr
            .filter(p => p && !p.isBot)
            .map(p => {

                const pName = p.name || p.pseudo;

                if (!pName) return '';

                const pStat = playerStatusMap[pName] || {
                    solved: false
                };

                let icon =
                    '<i class="fa-solid fa-hourglass-half animate-pulse text-amber-400"></i> Cherche...';

                let badgeColore =
                    'bg-slate-900 text-slate-400 border-slate-700';

                if (pStat.solved) {

                    badgeColore =
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                    icon =
                        '<i class="fa-solid fa-check text-emerald-400"></i> Trouvé !';

                } else if (pStat.timedOut || gameData.status === 'ROUND_OVER') {

                    badgeColore =
                        'bg-red-500/20 text-red-300 border-red-700';

                    icon =
                        '<i class="fa-solid fa-xmark text-red-400"></i> Temps écoulé';
                }

                return `
                    <div class="px-3 py-1.5 rounded-lg border ${badgeColore} flex items-center gap-2 font-mono">
                        <span>${pName}</span> :
                        <span>${icon}</span>
                    </div>
                `;

            }).join('');
    }


    // =========================================================
    // MANCHE EN COURS
    // =========================================================

    if (gameData.status === 'PLAYING') {

        const roundKey =
            `${sessionKey}:${roundNumber}:${currentMovie.title}`;

        const isNewRound = window.cineRoundKey !== roundKey;


        // INITIALISATION D'UNE NOUVELLE MANCHE
        if (isNewRound) {

            window.cineRoundKey = roundKey;

            window.cineCurrentMovieTitle = currentMovie.title;
            window.cineCurrentMovieRound = roundNumber;

            window.hasVotedCineNext = false;
            window.cineTransitionInProgressKey = null;

            stopCineIntervals();

            window.cineTimeLeft = Number(gameData.timer) || 90;

            if (timerDisplay) {
                timerDisplay.innerText = `${window.cineTimeLeft}s`;
            }

            if (storyBox) {
                storyBox.innerHTML = '';
            }


            // Réinitialiser les anciens résultats.
            if (winnerBox) {

                winnerBox.classList.add('hidden');
                winnerBox.style.display = 'none';
                winnerBox.innerHTML = '';
            }


            // Masquer le bouton de manche suivante.
            if (nextBtn) {

                nextBtn.classList.add('hidden');
                nextBtn.style.display = 'none';
                nextBtn.disabled = false;
            }


            // Réactiver la zone de réponse.
            if (inputArea) {

                inputArea.classList.toggle('hidden', isSolved);

                inputArea.style.display =
                    isSolved ? 'none' : 'flex';
            }

            if (guessInput) {

                guessInput.value = '';
                guessInput.disabled = isSolved;
                guessInput.placeholder = "Titre du film..."; // <-- Réinitialise le placeholder ici
            }


            // Charger la nouvelle affiche.
            if (cineCurrentImg) {

                cineCurrentImg.onload = null;
                cineCurrentImg.onerror = null;
            }

            cineCurrentImg = new Image();
            cineCurrentImg.crossOrigin = 'Anonymous';

            let isInitialized = false;


            // INITIALISATION APRÈS CHARGEMENT DE L'AFFICHE
            const initPosterGame = () => {

                if (isInitialized) return;

                isInitialized = true;

                const timerDuration = Number(gameData.timer) || 90;

                window.cineTimeLeft = timerDuration;


                const getPixelSize = (timeLeft, solved) => {

                    if (solved) return 1;

                    const progress = Math.max(
                        0,
                        Math.min(1, 1 - (timeLeft / timerDuration))
                    );

                    return Math.max(
                        1,
                        Math.floor(
                            60 * Math.pow(1 - progress, 0.6) +
                            2 * progress
                        )
                    );
                };


                drawPixelatedPoster(
                    cineCurrentImg,
                    isSolved ? 1 : 60
                );


                // ANIMATION DU TEXTE
                const fullText = currentMovie.storyText ||
                    'Le texte narratif de ce film n\'a pas encore été configuré dans les données.';

                let currentCharIndex = 0;

                const typingSpeed = Math.max(
                    20,
                    Math.floor(
                        (timerDuration * 1000) /
                        Math.max(fullText.length, 1)
                    )
                );


                windowCineTextInterval = setInterval(() => {

                    if (currentCharIndex <= fullText.length) {

                        const displayedText =
                            fullText.substring(0, currentCharIndex);

                        if (storyBox) {

                            storyBox.innerHTML =
                                `${displayedText}<span class="animate-pulse font-black text-pink-500">_</span>`;

                            const textContainer = storyBox.parentElement;

                            if (textContainer) {
                                textContainer.scrollTop =
                                    textContainer.scrollHeight;
                            }
                        }

                        currentCharIndex++;

                    } else {

                        clearInterval(windowCineTextInterval);
                        windowCineTextInterval = null;
                    }

                }, typingSpeed);


                // CHRONOMÈTRE
                cineTimerInterval = setInterval(() => {

                    const latestGameData = window.latestCineGameData;

                    // Empêcher un ancien chronomètre d'agir
                    // sur une nouvelle manche.
                    if (
                        !latestGameData ||
                        latestGameData.status !== 'PLAYING' ||
                        Number(latestGameData.currentRound) !== roundNumber
                    ) {

                        clearInterval(cineTimerInterval);
                        cineTimerInterval = null;

                        return;
                    }


                    const freshStatusMap =
                        latestGameData.playerStatus || {};

                    const currentMyStatus =
                        freshStatusMap[myName] || { solved: false };


                    if (!currentMyStatus.solved) {

                        window.cineTimeLeft = Math.max(
                            0,
                            Number(window.cineTimeLeft || 0) - 1
                        );

                        if (timerDisplay) {
                            timerDisplay.innerText =
                                `${window.cineTimeLeft}s`;
                        }
                    }


                    drawPixelatedPoster(
                        cineCurrentImg,
                        getPixelSize(
                            window.cineTimeLeft,
                            !!currentMyStatus.solved
                        )
                    );


                    // TEMPS ÉCOULÉ
                    if (
                        window.cineTimeLeft <= 0 &&
                        !currentMyStatus.solved
                    ) {

                        stopCineIntervals();

                        const roomCode =
                            window.currentCodeSalon || state.roomCode;

                        if (!roomCode) return;

                        const timeoutUpdates = {};

                        timeoutUpdates[
                            `cineGame/playerStatus/${myName}`
                        ] = {
                            solved: false,
                            timedOut: true
                        };


                        window.update(
                            window.ref(
                                window.db,
                                `salons/${roomCode}`
                            ),
                            timeoutUpdates

                        ).then(() => {

                            if (!window.isHost) return;

                            window.rejoindreSalonFirebaseGet(
                                roomCode,
                                latestData => {

                                    // Vérifier que la manche est toujours la même.
                                    if (
                                        !latestData.cineGame ||
                                        latestData.cineGame.status !== 'PLAYING' ||
                                        Number(latestData.cineGame.currentRound) !== roundNumber
                                    ) {
                                        return;
                                    }


                                    const pStatuses =
                                        latestData.cineGame.playerStatus || {};

                                    const playersRaw =
                                        latestData.players || {};

                                    const players = Array.isArray(playersRaw)
                                        ? playersRaw
                                        : Object.values(playersRaw);

                                    const hostUpdates = {
                                        'cineGame/status': 'ROUND_OVER'
                                    };


                                    players.forEach(p => {

                                        if (p && !p.isBot) {

                                            const pName = p.name || p.pseudo;

                                            if (
                                                pName &&
                                                !pStatuses[pName]?.solved
                                            ) {

                                                hostUpdates[
                                                    `cineGame/playerStatus/${pName}`
                                                ] = {
                                                    solved: false,
                                                    timedOut: true
                                                };
                                            }
                                        }
                                    });


                                    window.mettreAJourSalonFirebase(
                                        roomCode,
                                        hostUpdates
                                    );
                                }
                            );

                        }).catch(error => {

                            console.error(
                                'Erreur de synchronisation du temps Cinématophile :',
                                error
                            );
                        });
                    }

                }, 1000);

            };


            cineCurrentImg.onload = initPosterGame;

            cineCurrentImg.onerror = () => {
                console.error(
                    'Impossible de charger l’affiche du film :',
                    currentMovie.poster
                );
            };

            cineCurrentImg.src = currentMovie.poster;


            if (
                cineCurrentImg.complete &&
                cineCurrentImg.naturalWidth > 0
            ) {
                initPosterGame();
            }
        }


        // RAFRAÎCHISSEMENT DE L'ÉTAT DU JOUEUR
        if (winnerBox) {

            winnerBox.classList.add('hidden');
            winnerBox.style.display = 'none';
            winnerBox.innerHTML = '';
        }

        if (nextBtn) {

            nextBtn.classList.add('hidden');
            nextBtn.style.display = 'none';
            nextBtn.disabled = false;
        }

        if (inputArea) {

            inputArea.classList.toggle('hidden', isSolved);

            inputArea.style.display =
                isSolved ? 'none' : 'flex';
        }

        if (guessInput) {
            guessInput.disabled = isSolved;
        }


        if (
            cineCurrentImg.complete &&
            cineCurrentImg.naturalWidth > 0 &&
            window.cineTimeLeft !== undefined
        ) {

            const timerDuration = Number(gameData.timer) || 90;

            const progress = Math.max(
                0,
                Math.min(
                    1,
                    1 - (window.cineTimeLeft / timerDuration)
                )
            );

            const pixelSize = isSolved
                ? 1
                : Math.max(
                    1,
                    Math.floor(
                        60 * Math.pow(1 - progress, 0.6) +
                        2 * progress
                    )
                );

            drawPixelatedPoster(cineCurrentImg, pixelSize);
        }


    // =========================================================
    // FIN DE MANCHE
    // =========================================================

    } else if (gameData.status === 'ROUND_OVER') {

        stopCineIntervals();


        if (
            cineCurrentImg &&
            cineCurrentImg.complete &&
            cineCurrentImg.naturalWidth > 0
        ) {

            drawPixelatedPoster(cineCurrentImg, 1);
        }


        if (storyBox) {
            storyBox.innerHTML = currentMovie.storyText || '';
        }


        if (inputArea) {

            inputArea.classList.add('hidden');
            inputArea.style.display = 'none';
        }

        if (guessInput) {
            guessInput.disabled = true;
        }


        if (winnerBox) {

            winnerBox.classList.remove('hidden');
            winnerBox.style.display = '';

            winnerBox.innerHTML =
                `Fin de la manche ! Le film était : <strong class="text-white">${currentMovie.title}</strong>`;

            winnerBox.className =
                'w-full max-w-md p-4 bg-indigo-500/20 border border-indigo-500 rounded-xl text-indigo-300 font-bold mb-4 shadow-lg';
        }


        // BOUTON POUR LA PROCHAINE MANCHE
        if (nextBtn) {

            nextBtn.classList.remove('hidden');
            nextBtn.style.display = '';

            const hasVotedNext = !!(
                window.hasVotedCineNext ||
                (gameData.readyForNext &&
                    gameData.readyForNext[myName])
            );


            if (hasVotedNext) {

                nextBtn.disabled = true;

                nextBtn.className =
                    'w-full max-w-md bg-slate-800 text-slate-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition shadow-lg';

                nextBtn.innerHTML =
                    '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...';

            } else {

                nextBtn.disabled = false;

                nextBtn.className =
                    'w-full max-w-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition';

                nextBtn.innerHTML =
                    roundNumber >= Number(gameData.maxRounds)
                        ? 'Voir les résultats <i class="fa-solid fa-trophy ml-2"></i>'
                        : 'Prêt pour la suite <i class="fa-solid fa-check ml-2"></i>';
            }
        }


        // Vérifier si tous les joueurs sont prêts.
        advanceCineRoundIfReady(
            data,
            gameData,
            roundNumber,
            sessionKey
        );
    }
}


// =============================================================
// AFFICHAGE DE L'AFFICHE PIXÉLISÉE
// =============================================================

function drawPixelatedPoster(img, pixelSize) {

    const canvas = document.getElementById('cine-canvas');

    if (!canvas) return;

    const ctx = canvas.getContext(
        '2d',
        { willReadFrequently: true }
    );

    canvas.width = 400;
    canvas.height = 600;


    if (pixelSize <= 1) {

        ctx.imageSmoothingEnabled = true;

        ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return;
    }


    const smallWidth = Math.max(
        1,
        Math.floor(canvas.width / pixelSize)
    );

    const smallHeight = Math.max(
        1,
        Math.floor(canvas.height / pixelSize)
    );


    const tempCanvas = document.createElement('canvas');

    tempCanvas.width = smallWidth;
    tempCanvas.height = smallHeight;

    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(
        img,
        0,
        0,
        smallWidth,
        smallHeight
    );

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
        tempCanvas,
        0,
        0,
        smallWidth,
        smallHeight,
        0,
        0,
        canvas.width,
        canvas.height
    );
}


// =============================================================
// NORMALISATION DES RÉPONSES
// =============================================================

function normalizeGuess(str) {

    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}


// =============================================================
// SOUMISSION D'UNE RÉPONSE
// =============================================================

window.submitCineGuess = function() {

    const input = document.getElementById('input-cine-guess');

    if (!input || !input.value.trim()) return;

    const roomCode =
        window.currentCodeSalon || state.roomCode;

    if (!roomCode) return;


    window.rejoindreSalonFirebaseGet(roomCode, (data) => {

        const gameData = data.cineGame;

        if (!gameData || gameData.status !== 'PLAYING') return;


	// VERIFICATION DE SÉCURITÉ : Interdire si le joueur a 0 vies, a déjà trouvé ou a eu un timeout
        const myName = window.myPlayerKey || state.username;
        const myStatus = gameData.playerStatus?.[myName] || {};
        if (myStatus.solved || myStatus.timedOut || (myStatus.lives !== undefined && myStatus.lives <= 0)) {
            return; // Bloque purement et simplement la soumission
        }

        const currentMovie =
            gameData.movies[gameData.currentRound - 1];

        if (!currentMovie) return;


        const guess = normalizeGuess(input.value);

        let isCorrect =
            normalizeGuess(currentMovie.title) === guess;


        if (currentMovie.aliases) {

            currentMovie.aliases.forEach(alias => {

                if (normalizeGuess(alias) === guess) {
                    isCorrect = true;
                }
            });
        }


        if (isCorrect) {

            const myName =
                window.myPlayerKey || state.username;

            const pts =
                500 + ((window.cineTimeLeft || 0) * 20);

            const currentScore =
                data.players[myName]?.score || 0;


            const updates = {};

            updates[
                `cineGame/playerStatus/${myName}`
            ] = {
                solved: true,
                timeFound: window.cineTimeLeft
            };

            updates[
                `players/${myName}/score`
            ] = currentScore + pts;


            window.update(
                window.ref(
                    window.db,
                    `salons/${roomCode}`
                ),
                updates

            ).then(() => {

                window.rejoindreSalonFirebaseGet(
                    roomCode,
                    (freshData) => {

                        const players =
                            freshData.players || {};

                        const playersArr = Array.isArray(players)
                            ? players
                            : Object.values(players);

                        const humanPlayers = playersArr.filter(
                            p => p && (p.name || p.pseudo) && !p.isBot
                        );

                        const playerStatus =
                            freshData.cineGame?.playerStatus || {};

                        // MODIFIÉ : La manche est finie si tout le monde a soit trouvé, soit perdu toutes ses vies
                        const isRoundFinished =
                            humanPlayers.length > 0 &&
                            humanPlayers.every(p => {
                                const status = playerStatus[p.name || p.pseudo] || {};
                                return status.solved || status.timedOut;
                            });

                        if (
                            isRoundFinished &&
                            freshData.cineGame?.status === 'PLAYING'
                        ) {

                            window.mettreAJourSalonFirebase(
                                roomCode,
                                {
                                    'cineGame/status': 'ROUND_OVER'
                                }
                            );
                        }
                    }
                );

            });

        } else {
            // Mauvaise réponse : on retire une vie
            const myName = window.myPlayerKey || state.username;
            const currentStatus = gameData.playerStatus?.[myName] || { solved: false, lives: 3 };
            let currentLives = currentStatus.lives !== undefined ? currentStatus.lives : 3;
            currentLives = Math.max(0, currentLives - 1);

            const updates = {};
            updates[`cineGame/playerStatus/${myName}/lives`] = currentLives;

            if (currentLives <= 0) {
                updates[`cineGame/playerStatus/${myName}/timedOut`] = true;
            }

            window.update(window.ref(window.db, `salons/${roomCode}`), updates).then(() => {
                // Si le joueur vient de perdre sa dernière vie, on vérifie si ça termine la manche pour tout le monde
                if (currentLives <= 0) {
                    window.rejoindreSalonFirebaseGet(roomCode, (freshData) => {
                        const players = freshData.players || {};
                        const playersArr = Array.isArray(players) ? players : Object.values(players);
                        const humanPlayers = playersArr.filter(p => p && (p.name || p.pseudo) && !p.isBot);
                        const playerStatus = freshData.cineGame?.playerStatus || {};

                        const isRoundFinished = humanPlayers.length > 0 && humanPlayers.every(p => {
                            const status = playerStatus[p.name || p.pseudo] || {};
                            return status.solved || status.timedOut;
                        });

                        if (isRoundFinished && freshData.cineGame?.status === 'PLAYING') {
                            window.mettreAJourSalonFirebase(roomCode, { 'cineGame/status': 'ROUND_OVER' });
                        }
                    });
                }
            });

            input.classList.add('border-red-500');
            input.value = "";
            setTimeout(() => {
                input.classList.remove('border-red-500');
            }, 500);
        }

    });
};


// =============================================================
// VOTE POUR LA MANCHE SUIVANTE
// =============================================================

window.nextCineRound = function() {

    const roomCode =
        window.currentCodeSalon || state.roomCode;

    const myName =
        window.myPlayerKey || state.username;

    if (!roomCode || !myName) return;


    window.hasVotedCineNext = true;


    const nextBtn =
        document.getElementById('cine-next-btn');

    if (nextBtn) {

        nextBtn.disabled = true;

        nextBtn.className =
            "w-full max-w-md bg-slate-800 text-slate-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition shadow-lg";

        nextBtn.innerHTML =
            '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...';
    }


    const updates = {};

    updates[
        `cineGame/readyForNext/${myName}`
    ] = true;


    window.update(
        window.ref(
            window.db,
            `salons/${roomCode}`
        ),
        updates
    ).catch(error => {

        window.hasVotedCineNext = false;

        console.error(
            'Erreur lors du vote pour la manche suivante :',
            error
        );
    });
};

function updateCineHeartsUI(lives) {
    const container = document.getElementById('cine-hearts-container');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= 3; i++) {
        if (i <= lives) {
            html += '<i class="fa-solid fa-heart text-red-500 drop-shadow"></i>';
        } else {
            html += '<i class="fa-solid fa-heart text-slate-700"></i>';
        }
    }
    container.innerHTML = html;
};