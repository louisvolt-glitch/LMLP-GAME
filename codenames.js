// --- LOGIQUE DRAG & DROP CODENAMES ---
window.initCodenamesDragDrop = function() {
    if (!window.isHost) return;
    const pool = document.getElementById('cn-pool');
    if (!pool) return;
    
    let playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
    playersArr = playersArr.filter(p => p && !p.isBot && p.name);
    
    // Réinitialise les boîtes
    document.getElementById('cn-red-spy').innerHTML = '';
    document.getElementById('cn-red-op').innerHTML = '';
    document.getElementById('cn-blue-spy').innerHTML = '';
    document.getElementById('cn-blue-op').innerHTML = '';
    pool.innerHTML = '';
    
    // Ajoute les joueurs disponibles dans le Pool
    playersArr.forEach(p => {
        const safeName = p.name.replace(/'/g, "\\'");
        pool.innerHTML += `<div id="drag-${safeName}" draggable="true" ondragstart="drag(event)" data-name="${p.name}" class="text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white px-2 py-1.5 rounded cursor-grab border border-slate-500 select-none shadow-sm flex items-center gap-2"><i class="fa-solid fa-user text-indigo-300"></i> ${p.name}</div>`;
    });
};

window.allowDrop = function(ev) {
    ev.preventDefault();
};

window.drag = function(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
};

window.drop = function(ev, targetZone) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const draggedElement = document.getElementById(data);
    if (!draggedElement) return;

    // Trouver la vraie boîte de destination même si on lâche sur un autre joueur
    let targetContainer = ev.target;
    while(targetContainer && !targetContainer.id.startsWith('cn-')) {
        targetContainer = targetContainer.parentElement;
    }
    if (!targetContainer) return;

    // Bloquer à 1 seul joueur dans les cases Maître-Espion
    if (targetZone === 'red-spy' || targetZone === 'blue-spy') {
        if (targetContainer.children.length >= 1) {
            // Renvoie le joueur actuel dans le pool avant de le remplacer
            document.getElementById('cn-pool').appendChild(targetContainer.children[0]);
        }
    }
    
    targetContainer.appendChild(draggedElement);
};

// --- 3. CODENAMES ---
window.startCodenamesGame = function() {
    if (!window.isHost) return;

    let playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
    playersArr = playersArr.filter(p => p && !p.isBot && p.name);

    if (playersArr.length < 4) {
    alert("Il faut au moins 4 joueurs (2 Maîtres-Espions, 2 Opérateurs) !");
    return;
    }

    let roles = {};

    const redSpy = document.getElementById('cn-red-spy')?.children;
    const blueSpy = document.getElementById('cn-blue-spy')?.children;
    const redOps = document.getElementById('cn-red-op')?.children;
    const blueOps = document.getElementById('cn-blue-op')?.children;

    let manualConfigured = (redSpy && redSpy.length > 0) || (blueSpy && blueSpy.length > 0) || (redOps && redOps.length > 0) || (blueOps && blueOps.length > 0);

    if (manualConfigured) {
        if (redSpy && redSpy.length > 0) roles[redSpy[0].dataset.name] = { team: 'red', isSpymaster: true };
        if (blueSpy && blueSpy.length > 0) roles[blueSpy[0].dataset.name] = { team: 'blue', isSpymaster: true };
        
        if (redOps) Array.from(redOps).forEach(el => roles[el.dataset.name] = { team: 'red', isSpymaster: false });
        if (blueOps) Array.from(blueOps).forEach(el => roles[el.dataset.name] = { team: 'blue', isSpymaster: false });
        
        playersArr.forEach(p => {
            if (!roles[p.name]) roles[p.name] = { team: 'spectator', isSpymaster: false };
        });
    } else {
        let shuffled = [...playersArr].sort(() => 0.5 - Math.random());
        
        // CORRECTION: À 2 joueurs, on les force dans l'équipe Rouge (coop)
        if (shuffled.length === 2) {
            roles[shuffled[0].name] = { team: 'red', isSpymaster: true };
            roles[shuffled[1].name] = { team: 'red', isSpymaster: false };
        } else {
            let mid = Math.ceil(shuffled.length / 2);
            shuffled.forEach((p, idx) => {
                let team = idx < mid ? 'red' : 'blue';
                let isSpymaster = (idx === 0 || idx === mid);
                roles[p.name] = { team: team, isSpymaster: isSpymaster };
            });
        }
    }

    const dictionary = [
        "AGENT", "EUROPE", "AVION", "MINE", "FEU", "NOTE", "BOMBE", "ROI", "LUNE", "CARTE", 
        "MIEL", "OR", "TEMPLE", "MARS", "SCIANT", "TOUR", "POISSON", "GHOST", "CHEF", "PAIX", 
        "TABLE", "POMME", "CHAPEAU", "SALON", "BLANC", "PLAGE", "NINJA", "ROUGE", "MAGIE", "BOIS", 
        "BATEAU", "CHAT", "VERRE", "PIED", "COEUR", "GLACE", "MUR", "TISSU", "LION", "POCHE",
        "ARC", "SABLE", "PAPIER", "VENT", "PORTE", "ETOILE", "LUNETTES", "VOITURE", "CLE", "FER"
    ];
    let selectedWords = dictionary.sort(() => 0.5 - Math.random()).slice(0, 25);

    let types = [
        ...Array(9).fill('red'),
        ...Array(8).fill('blue'),
        ...Array(7).fill('neutral'),
        'assassin'
    ].sort(() => 0.5 - Math.random());

    let gridWords = selectedWords.map((w, idx) => ({
        word: w,
        type: types[idx],
        revealed: false
    }));

    const roomCode = window.currentCodeSalon || state.roomCode;
    if (roomCode && window.mettreAJourSalonFirebase) {
        window.mettreAJourSalonFirebase(roomCode, {
    status: 'IN_GAME',
    selectedMode: 'codenames',
    codenamesGame: {
        words: gridWords,
        roles: roles,
        currentTurn: 'red',
        redLeft: 9,
        blueLeft: 8,
        currentClue: "",
        currentCount: 1,
        guessesMade: 0, // <-- NOUVEAU : Suivi des essais
        status: "PLAYING"
    }
});
    }
}

// Fonction de rendu (appelée à chaque changement Firebase)
window.renderCodenamesScreen = function(data) {
    const gameData = data.codenamesGame;
    if (!gameData) return;

    const myName = window.myPlayerKey || state.username;
    const myRole = (gameData.roles && gameData.roles[myName]) ? gameData.roles[myName] : { team: 'spectator', isSpymaster: false };
    const isMyTurn = (myRole.team === gameData.currentTurn);
    
    // UI Scores et Tour
    const turnIndicator = document.getElementById('codenames-turn-indicator');
    if (gameData.status !== "PLAYING") {
        const isRedWin = gameData.status === 'RED_WIN';
        turnIndicator.innerHTML = `<i class="fa-solid fa-trophy"></i> Victoire de l'équipe ${isRedWin ? 'ROUGE' : 'BLEUE'} !`;
        turnIndicator.className = `font-bold text-sm ${isRedWin ? 'text-red-400' : 'text-blue-400'}`;
    } else {
        const isRedTurn = gameData.currentTurn === 'red';
        turnIndicator.innerHTML = `<i class="fa-solid fa-user-secret"></i> Tour de l'Équipe ${isRedTurn ? 'Rouge' : 'Bleue'}`;
        turnIndicator.className = `font-bold text-sm ${isRedTurn ? 'text-red-400' : 'text-blue-400'}`;
    }

    document.getElementById('score-red').innerText = gameData.redLeft;
    document.getElementById('score-blue').innerText = gameData.blueLeft;

    // UI Boîte d'indices
    const clueBox = document.getElementById('codenames-clue-box');
    if (gameData.status !== "PLAYING") {
        const isRedWin = gameData.status === 'RED_WIN';
        const pts = gameData.pointsWon || 1000;
        
        // Vérifie si le joueur local a déjà voté pour le retour au salon
const hasVoted = window.hasVotedForLobby || (data.quizGame && data.quizGame.lobbyVotes && data.quizGame.lobbyVotes[myName]);

        clueBox.innerHTML = `
            <div class="text-xl font-black ${isRedWin ? 'text-red-400' : 'text-blue-400'} mb-4">
                🏆 L'équipe ${isRedWin ? 'Rouge' : 'Bleue'} remporte la victoire et +${pts} points !
            </div>
            ${hasVoted 
                ? '<button disabled class="w-full max-w-sm mx-auto py-3 bg-slate-800 text-slate-400 rounded-xl font-bold uppercase transition cursor-not-allowed text-base"><i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...</button>'
                : '<button onclick="backToLobby()" class="w-full max-w-sm mx-auto py-3 rounded-xl font-bold uppercase transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white text-base">Retour au Salon</button>'
            }
        `;
    } else if (isMyTurn && myRole.isSpymaster && !gameData.currentClue) {
        clueBox.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <input type="text" id="cn-clue-word" placeholder="Indice (1 mot)..." class="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white text-sm">
                <input type="number" id="cn-clue-count" min="0" max="9" value="1" class="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white text-sm w-16 text-center">
                <button onclick="submitCodenamesClue()" class="bg-emerald-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-emerald-500 transition shadow">Transmettre</button>
            </div>
        `;
    } else if (isMyTurn && !myRole.isSpymaster && gameData.currentClue) {
        let maxGuesses = gameData.currentCount + 1;
        let guessesLeft = maxGuesses - (gameData.guessesMade || 0);
        let bonusText = (gameData.guessesMade === gameData.currentCount) ? " (Essai bonus !)" : "";

        clueBox.innerHTML = `
            Indice actuel : <strong class="text-amber-400 text-lg uppercase mx-2 tracking-wider">${gameData.currentClue} (${gameData.currentCount})</strong>
            <span class="text-xs text-slate-300 ml-2">Coups restants : <b class="text-white">${guessesLeft}</b>${bonusText}</span>
            <button onclick="passCodenamesTurn()" class="ml-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow">Fin de tour</button>
        `;
    } else {
        const clueText = gameData.currentClue ? `${gameData.currentClue} (${gameData.currentCount})` : "En attente du Maître-Espion...";
        clueBox.innerHTML = `Indice en cours : <strong class="text-amber-400 text-sm uppercase tracking-wider">${clueText}</strong>`;
    }

    // Génération de la Grille
    const grid = document.getElementById('codenames-grid');
    const wordsArray = Array.isArray(gameData.words) ? gameData.words : Object.values(gameData.words || {});
    grid.innerHTML = wordsArray.map((w, idx) => {
        let bgClass = "bg-slate-900 border-slate-700 text-white"; 
        let cursorClass = "";
        let clickAttr = "";

        if (w.revealed) {
            if (w.type === 'red') bgClass = "bg-red-600 border-red-500 text-white opacity-50";
            else if (w.type === 'blue') bgClass = "bg-blue-600 border-blue-500 text-white opacity-50";
            else if (w.type === 'assassin') bgClass = "bg-black border-slate-800 text-red-600 opacity-50";
            else bgClass = "bg-amber-100 border-amber-300 text-slate-800 opacity-50";
        } else {
            // Afficher les couleurs si le joueur est espion OU si la partie est terminée
            if (myRole.isSpymaster || gameData.status !== "PLAYING") {
                if (w.type === 'red') bgClass = "bg-red-900/30 border-red-700/50 text-red-300";
                else if (w.type === 'blue') bgClass = "bg-blue-900/30 border-blue-700/50 text-blue-300";
                else if (w.type === 'assassin') bgClass = "bg-slate-950 border-slate-700 text-slate-400";
                else bgClass = "bg-amber-900/30 border-amber-700/50 text-amber-200";
            } else if (isMyTurn && gameData.currentClue && gameData.status === "PLAYING") {
                cursorClass = "cursor-pointer hover:border-indigo-400 hover:bg-slate-800";
                clickAttr = `onclick="clickCodenamesWord(${idx})"`;
            }
        }

        return `
            <div ${clickAttr} class="p-2 sm:p-4 ${bgClass} border rounded-xl text-center font-bold text-xs sm:text-sm transition select-none flex items-center justify-center h-16 sm:h-20 ${cursorClass} ${w.revealed ? '' : 'shadow-md'}">
                ${w.word}
            </div>
        `;
    }).join('');
};

window.submitCodenamesClue = function() {
    const word = document.getElementById('cn-clue-word').value.trim();
    const count = parseInt(document.getElementById('cn-clue-count').value);
    const roomCode = window.currentCodeSalon || state.roomCode;
    
    if (!word || !roomCode) return;
    window.mettreAJourSalonFirebase(roomCode, {
        "codenamesGame/currentClue": word,
        "codenamesGame/currentCount": count,
        "codenamesGame/guessesMade": 0 // <-- NOUVEAU
    });
};

window.clickCodenamesWord = function(idx) {
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!roomCode) return;
    
    window.rejoindreSalonFirebaseGet(roomCode, (data) => {
        let gameData = data.codenamesGame;
        if (!gameData || gameData.status !== "PLAYING") return;
        
        let wordObj = gameData.words[idx];
        if (wordObj.revealed) return; 
        
        wordObj.revealed = true;
        let currentTeam = gameData.currentTurn;
        let nextTurn = currentTeam;
        let status = "PLAYING";

        // Ajoute un essai au compteur
        gameData.guessesMade = (gameData.guessesMade || 0) + 1;

        if (wordObj.type === 'assassin') {
            status = currentTeam === 'red' ? 'BLUE_WIN' : 'RED_WIN';
        } else if (wordObj.type === currentTeam) {
            // Bonne réponse
            if (currentTeam === 'red') {
                gameData.redLeft--;
                if (gameData.redLeft <= 0) status = 'RED_WIN';
            } else {
                gameData.blueLeft--;
                if (gameData.blueLeft <= 0) status = 'BLUE_WIN';
            }
            
            // Si le max d'essais est atteint (Nombre de l'espion + 1 bonus), le tour passe
            if (status === "PLAYING" && gameData.guessesMade > gameData.currentCount) {
                nextTurn = currentTeam === 'red' ? 'blue' : 'red';
                gameData.currentClue = "";
                gameData.guessesMade = 0;
            }
        } else {
            // Mauvais choix : fin de tour immédiate
            if (wordObj.type === (currentTeam === 'red' ? 'blue' : 'red')) {
                if (currentTeam === 'red') {
                    gameData.blueLeft--;
                    if (gameData.blueLeft <= 0) status = 'BLUE_WIN';
                } else {
                    gameData.redLeft--;
                    if (gameData.redLeft <= 0) status = 'RED_WIN';
                }
            }
            nextTurn = currentTeam === 'red' ? 'blue' : 'red';
            gameData.currentClue = "";
            gameData.guessesMade = 0;
        }

        gameData.currentTurn = nextTurn;
        gameData.status = status;

        // Distribuer les points en cas de victoire
        if (status === 'RED_WIN' || status === 'BLUE_WIN') {
            let winningTeam = status === 'RED_WIN' ? 'red' : 'blue';
            let pointsWon = 1000;
            gameData.pointsWon = pointsWon; // Pour l'affichage UI
            
            let updates = { codenamesGame: gameData };
            Object.keys(gameData.roles || {}).forEach(pName => {
                if (gameData.roles[pName].team === winningTeam) {
                    let currentScore = data.players[pName]?.score || 0;
                    updates[`players/${pName}/score`] = currentScore + pointsWon;
                }
            });
            window.update(window.ref(window.db, `salons/${roomCode}`), updates);
        } else {
            window.mettreAJourSalonFirebase(roomCode, { codenamesGame: gameData });
        }
    });
};

window.passCodenamesTurn = function() {
    const roomCode = window.currentCodeSalon || state.roomCode;
    if (!roomCode) return;
    
    window.rejoindreSalonFirebaseGet(roomCode, (data) => {
        let gameData = data.codenamesGame;
        if (!gameData || gameData.status !== "PLAYING") return;
        
        gameData.currentTurn = gameData.currentTurn === 'red' ? 'blue' : 'red';
        gameData.currentClue = "";
        gameData.guessesMade = 0; // <-- NOUVEAU
        window.mettreAJourSalonFirebase(roomCode, { codenamesGame: gameData });
    });
};

