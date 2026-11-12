////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
////////////////// --- JEU DE L'IMPOSTEUR --- //////////////////
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////

// Initialisation et lancement de la partie Impostor par l'hôte
window.startImpostorGame = function() {
    if (!window.isHost) return;

    let playersRaw = state.players || {};
    let playersArr = Array.isArray(playersRaw) ? playersRaw : Object.values(playersRaw);
    playersArr = playersArr.filter(p => p && (p.name || p.pseudo));

    if (playersArr.length < 3) {
        alert("Il faut au moins 3 joueurs pour lancer le mode Imposteur !");
        return;
    }

    // 1. Choisir une paire de mots aléatoire parmi IMPOSTOR_PAIRS
    const randomPair = IMPOSTOR_PAIRS[Math.floor(Math.random() * IMPOSTOR_PAIRS.length)];
    
    // 2. Mélanger les joueurs pour attribuer les rôles (algorithme robuste Fisher-Yates)
    let shuffledPlayers = [...playersArr];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }
    
    let roles = {};
    // Le premier est l'imposteur
    let impostorPlayer = shuffledPlayers[0];
    roles[impostorPlayer.name || impostorPlayer.pseudo] = {
        role: 'impostor',
        word: randomPair.impostor
    };

    // Vérifier si on ajoute Mr. White (si 5 joueurs ou plus)
    let mrWhitePlayerName = null;
    let startIndex = 1;
    if (playersArr.length >= 5 && shuffledPlayers.length > 1) {
        let mrWhitePlayer = shuffledPlayers[1];
        mrWhitePlayerName = mrWhitePlayer.name || mrWhitePlayer.pseudo;
        roles[mrWhitePlayerName] = {
            role: 'mrwhite',
            word: '???' // Mr. White n'a aucun mot
        };
        startIndex = 2;
    }

    // Attribuer le mot citoyen aux autres
    for (let i = startIndex; i < shuffledPlayers.length; i++) {
        let pName = shuffledPlayers[i].name || shuffledPlayers[i].pseudo;
        roles[pName] = {
            role: 'citizen',
            word: randomPair.citizen
        };
    }

    // Récupération stricte des paramètres synchronisés depuis Firebase
    const impostorSettings = (window.currentRoom && window.currentRoom.settings) ? window.currentRoom.settings : (state.settings || {});
    const maxRounds = parseInt(impostorSettings.impostorRounds, 10) || 2;
    const timerVal = parseInt(impostorSettings.impostorTimer, 10) || 20;

    // AJOUT CRUCIAL : On crée un ordre de tour et ON LE MÉLANGE SÉPARÉMENT
    // Sinon l'Imposteur (qui est toujours l'index 0 de shuffledPlayers) jouerait systématiquement en premier !
    let turnOrder = shuffledPlayers.filter(p => !p.isBot).map(p => p.name || p.pseudo);
    for (let i = turnOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }

    const impostorGameState = {
        status: 'WORD_REVEAL', // Phases: WORD_REVEAL -> WRITING -> DISCUSSION -> VOTE -> SUMMARY
        pair: randomPair,
        roles: roles,
        turnOrder: turnOrder,
        currentTurnIndex: 0,
        currentRound: 1,
        maxRounds: maxRounds,
        roundTimer: timerVal,
        writingData: {}, 
        readyToWriting: {}, 
        readyToDiscussion: {}, 
        readyToVote: {}, 
        votes: {}, 
        readyToMenu: {} 
    };

    if (window.currentCodeSalon && window.mettreAJourSalonFirebase) {
        window.mettreAJourSalonFirebase(window.currentCodeSalon, {
            status: 'IN_GAME',
            selectedMode: 'impostor',
            impostorGame: impostorGameState
        });
    }
}

// 1. Bouton "Aller à la phase d'écriture"
window.setImpostorReadyForWriting = function() {
    const myName = window.myPlayerKey || state.username;
    const roomCode = state.roomCode;
    if (!roomCode) return;

    const path = `salons/${roomCode}/impostorGame/readyToWriting/${myName}`;
    window.set(window.ref(window.db, path), true).then(() => {
        checkAllPlayersReadyForWriting(roomCode);
    });
}

window.checkAllPlayersReadyForWriting = function(roomCode) {
    window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
        const data = snapshot.val();
        if (!data || !data.impostorGame) return;

        let players = data.players || {};
        let humanPlayers = Object.values(players).filter(p => !p.isBot);
        let readyMap = data.impostorGame.readyToWriting || {};

        let allReady = humanPlayers.length > 0 && humanPlayers.every(p => readyMap[p.name || p.pseudo]);
        
        // CORRECTION : On a retiré "&& window.isHost" pour que le dernier joueur déclenche la phase
        if (allReady) {
            window.mettreAJourSalonFirebase(roomCode, {
                "impostorGame/status": "WRITING",
                "impostorGame/currentRound": 1
            });
        }
    });
}

// 2. Soumission des indices d'écriture (CHACUN SON TOUR)
window.submitImpostorClue = function() {
    const clueInput = document.getElementById('input-impostor-clue');
    if (!clueInput || !clueInput.value.trim()) {
        alert("Veuillez écrire un indice valide !");
        return;
    }
    const clue = clueInput.value.trim();
    const myName = window.myPlayerKey || state.username;
    const roomCode = state.roomCode;
    if (!roomCode) return;

    window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
        let data = snapshot.val();
        let gameData = data.impostorGame;
        let currentRound = gameData.currentRound || 1;
        let currentTurnIndex = gameData.currentTurnIndex || 0;
        let turnOrder = gameData.turnOrder || [];
        
        let updates = {};
        updates[`impostorGame/writingData/${currentRound}/${myName}`] = clue;
        
        let newTurnIndex = currentTurnIndex + 1;
        
        // Vérifie si tout le monde a joué ce tour
        if (newTurnIndex >= turnOrder.length) {
            let maxRounds = gameData.maxRounds || 2;
            if (currentRound < maxRounds) {
                updates[`impostorGame/currentRound`] = currentRound + 1;
                updates[`impostorGame/currentTurnIndex`] = 0; // On recommence au joueur 1
            } else {
                updates[`impostorGame/status`] = "DISCUSSION";
            }
        } else {
            // C'est au tour du joueur suivant
            updates[`impostorGame/currentTurnIndex`] = newTurnIndex;
        }
        
        window.update(window.ref(window.db, `salons/${roomCode}`), updates);
    });
}

// 3. Bouton "Aller à la phase de vote" (depuis la discussion)
window.setImpostorReadyForVote = function() {
    const myName = window.myPlayerKey || state.username;
    const roomCode = state.roomCode;
    if (!roomCode) return;

    const path = `salons/${roomCode}/impostorGame/readyToVote/${myName}`;
    window.set(window.ref(window.db, path), true).then(() => {
        checkAllPlayersReadyForVote(roomCode);
    });
}

window.checkAllPlayersReadyForVote = function(roomCode) {
    window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
        const data = snapshot.val();
        if (!data || !data.impostorGame) return;

        let players = data.players || {};
        let humanPlayers = Object.values(players).filter(p => !p.isBot);
        let readyMap = data.impostorGame.readyToVote || {};

        let allReady = humanPlayers.length > 0 && humanPlayers.every(p => readyMap[p.name || p.pseudo]);

        if (allReady) {
            window.mettreAJourSalonFirebase(roomCode, {
                "impostorGame/status": "VOTE"
            });
        }
    });
}

// 4. Soumission du vote
window.submitImpostorVote = function(targetPlayer) {
    const myName = window.myPlayerKey || state.username;
    const roomCode = state.roomCode;
    if (!roomCode) return;

    const path = `salons/${roomCode}/impostorGame/votes/${myName}`;
    window.set(window.ref(window.db, path), targetPlayer).then(() => {
        checkAllPlayersVoted(roomCode);
    });
}

window.checkAllPlayersVoted = function(roomCode) {
    window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
        const data = snapshot.val();
        if (!data || !data.impostorGame) return;

        let players = data.players || {};
        let humanPlayers = Object.values(players).filter(p => !p.isBot);
        let votesMap = data.impostorGame.votes || {};

        let allVoted = humanPlayers.length > 0 && humanPlayers.every(p => votesMap[p.name || p.pseudo]);

        if (allVoted) {
            // Calculer les résultats du vote
            let voteCounts = {};
            for (let target of Object.values(votesMap)) {
                voteCounts[target] = (voteCounts[target] || 0) + 1;
            }

            // Trouver celui qui a le plus de votes
            let mostVoted = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);

            let roles = data.impostorGame.roles || {};
            let suspectRole = roles[mostVoted]?.role;

            let winnerMessage = "";
            if (suspectRole === 'impostor' || suspectRole === 'mrwhite') {
                winnerMessage = `Victoire des Citoyens ! ${mostVoted} était l'Imposteur / Mr. White !`;
            } else {
                winnerMessage = `Victoire de l'Imposteur ! ${mostVoted} était un citoyen innocent.`;
            }

            window.mettreAJourSalonFirebase(roomCode, {
                "impostorGame/status": "SUMMARY",
                "impostorGame/winnerMessage": winnerMessage
            });
        }
    });
}

// 5. Bouton "Retour au salon" (récapitulatif) unanime
window.setImpostorReadyForMenu = function() {
    const myName = window.myPlayerKey || state.username;
    const roomCode = state.roomCode;
    if (!roomCode) return;

    const path = `salons/${roomCode}/impostorGame/readyToMenu/${myName}`;
    window.set(window.ref(window.db, path), true).then(() => {
        checkAllPlayersReadyForMenu(roomCode);
    });
}

window.checkAllPlayersReadyForMenu = function(roomCode) {
    window.get(window.ref(window.db, `salons/${roomCode}`)).then((snapshot) => {
        const data = snapshot.val();
        if (!data || !data.impostorGame) return;

        let players = data.players || {};
        let humanPlayers = Object.values(players).filter(p => !p.isBot);
        let menuMap = data.impostorGame.readyToMenu || {};

        let allReady = humanPlayers.length > 0 && humanPlayers.every(p => menuMap[p.name || p.pseudo]);

        if (allReady) {
            window.mettreAJourSalonFirebase(roomCode, {
                status: 'LOBBY',
                impostorGame: null
            });
        }
    });
}

// AJOUT de la fonction renderImpostorScreen
window.renderImpostorScreen = function(data) {
    const mainArea = document.getElementById('impostor-main-area');
    const timerEl = document.getElementById('impostor-timer');
    if (!mainArea) return;

    const gameData = data.impostorGame;
    if (!gameData) {
        mainArea.innerHTML = `<div class="text-xl font-bold text-slate-400">Préparation de la partie en cours...</div>`;
        return;
    }

    const myName = window.myPlayerKey || state.username;
    const myRoleInfo = gameData.roles ? gameData.roles[myName] : null;

    if (!myRoleInfo) {
        mainArea.innerHTML = `<div class="p-6 bg-red-500/20 border border-red-500 rounded-xl text-red-400 font-bold">Erreur : Vous n'avez pas de rôle pour cette partie. Attendez la manche suivante.</div>`;
        return;
    }

    // Nettoyer le timer de la phase d'écriture s'il est actif dans une autre phase
    if (gameData.status !== 'WRITING' && window.impostorTimerInterval) {
        clearInterval(window.impostorTimerInterval);
        window.impostorTimerInterval = null;
    }

    // --- PHASE 1 : RÉVÉLATION DES MOTS ---
    if (gameData.status === 'WORD_REVEAL') {
        if (timerEl) timerEl.innerText = "Révélation des mots";
        
        let roleDesc = "";
        let wordDisplay = "";
        if (myRoleInfo.role === 'impostor') {
            roleDesc = "Vous êtes l' <span class='text-red-400 font-black'>IMPOSTEUR</span> ! Bluffer pour survivre.";
            wordDisplay = myRoleInfo.word;
        } else if (myRoleInfo.role === 'mrwhite') {
            roleDesc = "Vous êtes <span class='text-purple-400 font-black'>MR. WHITE</span> ! Vous n'avez pas de mot, fondez-vous dans la masse.";
            wordDisplay = "??? (Aucun mot)";
        } else {
            roleDesc = "Vous êtes un <span class='text-emerald-400 font-black'>CITOYEN</span>.";
            wordDisplay = myRoleInfo.word;
        }

        const isReady = gameData.readyToWriting && gameData.readyToWriting[myName];

        mainArea.innerHTML = `
            <h3 class="text-2xl font-black text-white mb-2">Votre Rôle Secret</h3>
            <p class="text-sm text-slate-300 mb-6">${roleDesc}</p>
            
            <div class="p-6 bg-slate-900 border border-slate-700 rounded-2xl max-w-sm mx-auto mb-6 shadow-xl">
                <span class="text-xs text-slate-400 uppercase font-mono block mb-1">Votre mot secret :</span>
                <span class="text-3xl font-black text-amber-400 tracking-wider">${wordDisplay}</span>
            </div>

            <div class="space-y-3">
                <button ${isReady ? 'disabled' : ''} onclick="setImpostorReadyForWriting()" id="btn-ready-writing" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${isReady ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}">
                    ${isReady ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres...' : 'Aller à la phase d\'écriture'}
                </button>
            </div>
        `;
    }
    // --- PHASE 2 : ÉCRITURE DES MOTS (AVEC COMPTE À REBOURS ACTIF) ---
    else if (gameData.status === 'WRITING') {
        let turnOrder = gameData.turnOrder || Object.keys(gameData.roles || {});
        let currentTurnIndex = gameData.currentTurnIndex || 0;
        let activePlayer = turnOrder[currentTurnIndex];
        let isMyTurn = (activePlayer === myName);
        
        let turnChanged = (window.impostorCurrentTurn !== currentTurnIndex) || (window.impostorCurrentRound !== gameData.currentRound);
        
        // Initialiser ou relancer le timer si le tour vient de changer
        if (turnChanged || !window.impostorTimerInterval) {
            if (window.impostorTimerInterval) clearInterval(window.impostorTimerInterval);
            window.impostorCurrentTurn = currentTurnIndex;
            window.impostorCurrentRound = gameData.currentRound;
            window.impostorCurrentTime = gameData.roundTimer || 20;

            window.impostorTimerInterval = setInterval(() => {
                window.impostorCurrentTime--;
                let tDisp = document.getElementById('impostor-timer-display');
                if (tDisp) tDisp.innerText = window.impostorCurrentTime + 's';

                if (window.impostorCurrentTime <= 0) {
                    clearInterval(window.impostorTimerInterval);
                    if (isMyTurn) {
                        let input = document.getElementById('input-impostor-clue');
                        if (input && input.value.trim() === '') {
                            input.value = "(Temps écoulé)"; // Soumission auto
                        }
                        if (typeof submitImpostorClue === 'function') submitImpostorClue();
                    }
                }
            }, 1000);
        }

        if (timerEl) {
            timerEl.innerHTML = `Tour ${gameData.currentRound} / ${gameData.maxRounds} - <span id="impostor-timer-display" class="text-amber-400 font-black">${window.impostorCurrentTime}s</span>`;
        }
        
        let roundData = gameData.writingData ? gameData.writingData[gameData.currentRound] || {} : {};
        
        let playersListHtml = turnOrder.map((pName, idx) => {
            let status = "";
            let wordOrStatus = "";
            let isPast = idx < currentTurnIndex;
            let isCurrent = idx === currentTurnIndex;
            
            if (isPast || roundData[pName]) {
                status = '<i class="fa-solid fa-check text-emerald-400"></i>';
                wordOrStatus = `<span class="text-white font-bold">"${roundData[pName] || '...'}"</span>`;
            } else if (isCurrent) {
                status = '<i class="fa-solid fa-pen text-amber-400 animate-pulse"></i>';
                wordOrStatus = `<span class="text-amber-400 italic">En train d'écrire...</span>`;
            } else {
                status = '<i class="fa-solid fa-clock text-slate-500"></i>';
                wordOrStatus = `<span class="text-slate-500 italic">En attente</span>`;
            }
            
            let bgClass = isCurrent ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900 border-slate-800";
            
            return `
                <div class="p-3 rounded-xl border ${bgClass} flex justify-between items-center text-sm transition-all shadow-sm">
                    <div class="flex items-center gap-2">
                        ${status} <span class="font-bold ${isCurrent ? 'text-amber-400' : 'text-slate-300'}">${pName}</span>
                    </div>
                    <div>${wordOrStatus}</div>
                </div>
            `;
        }).join('');

        let inputAreaHtml = "";
        if (isMyTurn) {
            inputAreaHtml = `
                <div class="max-w-md mx-auto space-y-3 mt-6">
                    <div class="text-emerald-400 font-bold text-sm mb-2 animate-pulse"><i class="fa-solid fa-keyboard"></i> C'est à votre tour !</div>
                    <input type="text" id="input-impostor-clue" placeholder="Votre mot indice..." class="w-full bg-slate-900 border border-emerald-500 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-emerald-400 font-mono text-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <button onclick="submitImpostorClue()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition">
                        Soumettre mon Indice
                    </button>
                </div>
            `;
        } else {
            inputAreaHtml = `
                <div class="max-w-md mx-auto mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-sm">
                    <i class="fa-solid fa-hourglass-half animate-spin"></i> En attente de <strong class="text-amber-400">${activePlayer}</strong>...
                </div>
            `;
        }

        mainArea.innerHTML = `
            <h3 class="text-2xl font-black text-indigo-300 mb-2">Phase d'Écriture</h3>
            <p class="text-xs text-slate-400 mb-4">Chaque joueur écrit un mot à tour de rôle pour prouver son identité.</p>
            <div class="max-w-md mx-auto space-y-2 mb-4">
                ${playersListHtml}
            </div>
            ${inputAreaHtml}
        `;
    }
    // --- PHASE 3 : DISCUSSION ---
    else if (gameData.status === 'DISCUSSION') {
        if (timerEl) timerEl.innerText = "Phase de Discussion";

        let allCluesHtml = "";
        if (gameData.writingData) {
            for (let r = 1; r <= gameData.maxRounds; r++) {
                if (gameData.writingData[r]) {
                    allCluesHtml += `<div class="text-sm font-bold text-indigo-400 mb-2 mt-4">--- Tour ${r} ---</div>`;
                    for (let [player, clue] of Object.entries(gameData.writingData[r])) {
                        allCluesHtml += `<div class="p-3 bg-slate-900 rounded-xl mb-2 flex justify-between text-sm font-mono border border-slate-800"><span class="text-slate-400">${player}:</span> <strong class="text-white text-base">"${clue}"</strong></div>`;
                    }
                }
            }
        }

        const isReadyVote = gameData.readyToVote && gameData.readyToVote[myName];

        mainArea.innerHTML = `
            <h3 class="text-2xl font-black text-indigo-300 mb-2">Ouvrez le débat !</h3>
            <p class="text-sm text-slate-400 mb-4">Voici tous les indices écrits :</p>
            <!-- Zone élargie pour lire sans scroll -->
            <div class="max-w-3xl mx-auto w-full bg-slate-950/80 border border-slate-800 p-6 rounded-2xl overflow-y-auto mb-6 text-left space-y-2 min-h-[250px] shadow-inner">
                ${allCluesHtml || '<span class="text-slate-500 italic">Aucun indice enregistré.</span>'}
            </div>

            <!-- Bouton sécurisé avec sablier -->
            <button ${isReadyVote ? 'disabled' : ''} onclick="setImpostorReadyForVote()" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${isReadyVote ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}">
                ${isReadyVote ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres...' : 'Aller à la phase de vote'}
            </button>
        `;
    }
    // --- PHASE 4 : VOTE ---
    else if (gameData.status === 'VOTE') {
        if (timerEl) timerEl.innerText = "Phase de Vote";

        let myVote = gameData.votes ? gameData.votes[myName] : null;

        // Attente dynamique de ceux qui n'ont pas voté
        if (myVote) {
            mainArea.innerHTML = `
                <h3 class="text-3xl font-black text-emerald-400 mb-4"><i class="fa-solid fa-check-circle"></i> Vote enregistré</h3>
                <p class="text-lg text-slate-300 mb-6">Vous avez voté contre <strong class="text-white">${myVote}</strong>.</p>
                <div class="max-w-md mx-auto p-5 bg-slate-900 rounded-2xl border border-slate-700 text-amber-400 animate-pulse font-bold text-lg shadow-lg">
                    <i class="fa-solid fa-hourglass-half"></i> En attente du vote des autres joueurs...
                </div>
            `;
        } else {
            let playersList = Object.keys(gameData.roles || {});
            let voteButtonsHtml = playersList.filter(p => p !== myName).map(p => `
                <button onclick="submitImpostorVote('${p}')" class="p-4 bg-slate-900 hover:bg-red-500/20 border border-slate-700 hover:border-red-500 rounded-xl font-bold text-base transition text-white shadow-md">
                    Voter contre ${p}
                </button>
            `).join('');

            mainArea.innerHTML = `
                <h3 class="text-3xl font-black text-red-400 mb-2">Qui est l'Imposteur ?</h3>
                <p class="text-sm text-slate-400 mb-8">Cliquez sur le joueur que vous suspectez d'être l'imposteur ou Mr. White.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                    ${voteButtonsHtml}
                </div>
            `;
        }
    }
    // --- PHASE 5 : RÉCAPITULATIF FINAL ---
    else if (gameData.status === 'SUMMARY') {
        if (timerEl) timerEl.innerText = "Fin de Partie";

        let winnerText = gameData.winnerMessage || "Partie terminée.";
        let rolesSummaryHtml = "";
        for (let [pName, info] of Object.entries(gameData.roles || {})) {
            rolesSummaryHtml += `
                <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-sm shadow-sm">
                    <div>
                        <strong class="text-white">${pName}</strong> 
                        <span class="text-slate-400">(${info.role})</span>
                    </div>
                    <span class="font-mono text-amber-400 font-bold">Mot : ${info.word}</span>
                </div>
            `;
        }

        const isReadyMenu = gameData.readyToMenu && gameData.readyToMenu[myName];

        mainArea.innerHTML = `
            <h3 class="text-3xl font-black bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent mb-2">Récapitulatif de la Partie</h3>
            <div class="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-300 font-bold text-base mb-6 max-w-xl mx-auto">
                ${winnerText}
            </div>
            
            <div class="max-w-xl mx-auto space-y-2 mb-8 text-left max-h-64 overflow-y-auto pr-2">
                ${rolesSummaryHtml}
            </div>

            <!-- Bouton sécurisé qui évite le blocage des autres -->
            <button ${isReadyMenu ? 'disabled' : ''} onclick="setImpostorReadyForMenu()" class="w-full max-w-sm mx-auto py-3.5 rounded-xl font-bold uppercase transition-all shadow-lg ${isReadyMenu ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}">
                ${isReadyMenu ? '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente du menu...' : 'Retour au salon'}
            </button>
        `;
    }
}




