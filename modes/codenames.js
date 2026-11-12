// --- ASSISTANTS ÉQUIPES ---
window.cnOtherTeam = function(team) { return team === 'red' ? 'blue' : 'red'; };

// Noms des joueurs PRÉSENTS dans le salon qui appartiennent à une équipe
window.cnTeamNames = function(data, team) {
    const roles = (data.codenamesGame && data.codenamesGame.roles) || {};
    const present = new Set(Object.values(data.players || {}).map(p => p && p.name));
    return Object.keys(roles).filter(n => present.has(n) && roles[n].team === team);
};

// Équipe suivante : l'autre équipe si elle a des joueurs, sinon la même (mode coopératif)
window.cnNextTurn = function(data, currentTeam) {
    const other = window.cnOtherTeam(currentTeam);
    return window.cnTeamNames(data, other).length > 0 ? other : currentTeam;
};

// --- 3. CODENAMES ---
window.startCodenamesGame = function() {
    if (!window.isHost) return;

    let playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
    playersArr = playersArr.filter(p => p && !p.isBot && p.name);

    if (playersArr.length < 2) {
        showToast("⚠️ Il faut au moins 2 joueurs pour jouer à Codenames.");
        return;
    }

    // 1. Rôles : ceux choisis dans le salon (glisser-déposer), sinon répartition aléatoire
    let roles = {};
    const hasManual = playersArr.some(p => p.team === 'red' || p.team === 'blue');

    if (hasManual) {
        playersArr.forEach(p => {
            roles[p.name] = (p.team === 'red' || p.team === 'blue')
                ? { team: p.team, isSpymaster: p.role === 'spymaster' }
                : { team: 'spectator', isSpymaster: false };
        });
    } else {
        const shuffled = [...playersArr].sort(() => 0.5 - Math.random());
        if (shuffled.length < 4) {
            // Moins de 4 joueurs : tous dans la même équipe (coopératif)
            shuffled.forEach((p, i) => { roles[p.name] = { team: 'red', isSpymaster: i === 0 }; });
        } else {
            const mid = Math.ceil(shuffled.length / 2);
            shuffled.forEach((p, i) => {
                roles[p.name] = { team: i < mid ? 'red' : 'blue', isSpymaster: (i === 0 || i === mid) };
            });
        }
    }

    // 2. Chaque équipe présente : exactement 1 maître-espion et au moins 1 agent
    const teamsPresent = [];
    for (const team of ['red', 'blue']) {
        const names = Object.keys(roles).filter(n => roles[n].team === team);
        if (names.length === 0) continue;
        if (names.length < 2) {
            showToast(`⚠️ L'équipe ${team === 'red' ? 'Rouge' : 'Bleue'} doit avoir au moins 2 joueurs (1 Maître-Espion + 1 Agent).`);
            return;
        }
        const spies = names.filter(n => roles[n].isSpymaster);
        const keepSpy = spies.length > 0 ? spies[0] : names[0];
        names.forEach(n => { roles[n].isSpymaster = (n === keepSpy); });
        teamsPresent.push(team);
    }
    if (teamsPresent.length === 0) {
        showToast("⚠️ Aucun joueur n'est assigné à une équipe.");
        return;
    }

    // 3. Grille : l'équipe qui commence a 9 mots, l'autre 8 (ou 0 si elle est vide)
    const startTeam = teamsPresent.includes('red') ? 'red' : 'blue';
    const otherTeam = window.cnOtherTeam(startTeam);
    const otherCount = teamsPresent.includes(otherTeam) ? 8 : 0;

    const dictionary = [
        "AGENT", "EUROPE", "AVION", "MINE", "FEU", "NOTE", "BOMBE", "ROI", "LUNE", "CARTE",
        "MIEL", "OR", "TEMPLE", "MARS", "SCIE", "TOUR", "POISSON", "GHOST", "CHEF", "PAIX",
        "TABLE", "POMME", "CHAPEAU", "SALON", "BLANC", "PLAGE", "NINJA", "ROUGE", "MAGIE", "BOIS",
        "BATEAU", "CHAT", "VERRE", "PIED", "COEUR", "GLACE", "MUR", "TISSU", "LION", "POCHE",
        "ARC", "SABLE", "PAPIER", "VENT", "PORTE", "ETOILE", "LUNETTES", "VOITURE", "CLE", "FER"
    ];
    const selectedWords = [...dictionary].sort(() => 0.5 - Math.random()).slice(0, 25);

    const types = [
        ...Array(9).fill(startTeam),
        ...Array(otherCount).fill(otherTeam),
        ...Array(15 - otherCount).fill('neutral'),
        'assassin'
    ].sort(() => 0.5 - Math.random());

    const gridWords = selectedWords.map((w, idx) => ({ word: w, type: types[idx], revealed: false }));

    const roomCode = window.currentCodeSalon || state.roomCode;
    if (roomCode && window.mettreAJourSalonFirebase) {
        window.mettreAJourSalonFirebase(roomCode, {
            status: 'IN_GAME',
            selectedMode: 'codenames',
            codenamesGame: {
                words: gridWords,
                roles: roles,
                currentTurn: startTeam,
                redLeft: startTeam === 'red' ? 9 : otherCount,
                blueLeft: startTeam === 'blue' ? 9 : otherCount,
                currentClue: "",
                currentCount: 1,
                guessesMade: 0,
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
    const esc = (v) => (typeof escapeChatHTML === 'function') ? escapeChatHTML(v) : String(v);
    const roomCodeCn = window.currentCodeSalon || state.roomCode;

    // L'hôte garde la partie fluide si des joueurs quittent en cours de route
    if (window.isHost && gameData.status === "PLAYING" && roomCodeCn) {
        const cur = gameData.currentTurn;
        const members = window.cnTeamNames(data, cur).sort();
        if (members.length === 0 && window.cnTeamNames(data, window.cnOtherTeam(cur)).length > 0) {
            window.mettreAJourSalonFirebase(roomCodeCn, {
                "codenamesGame/currentTurn": window.cnOtherTeam(cur),
                "codenamesGame/currentClue": "",
                "codenamesGame/guessesMade": 0
            });
            return;
        }
        if (members.length > 0 && !members.some(n => gameData.roles[n].isSpymaster)) {
            window.mettreAJourSalonFirebase(roomCodeCn, { [`codenamesGame/roles/${members[0]}/isSpymaster`]: true });
            return;
        }
    }

    // Badge : rôle du joueur local
    const roleBadge = document.getElementById('codenames-role-badge');
    if (roleBadge) {
        const teamLabel = myRole.team === 'red' ? 'Équipe Rouge' : (myRole.team === 'blue' ? 'Équipe Bleue' : 'Spectateur');
        const teamColor = myRole.team === 'red' ? 'text-red-400' : (myRole.team === 'blue' ? 'text-blue-400' : 'text-slate-400');
        roleBadge.innerHTML = `<span class="${teamColor} font-bold">${teamLabel}</span>${myRole.team !== 'spectator' ? ' — ' + (myRole.isSpymaster ? '🕵️ Maître-Espion' : 'Agent') : ''}`;
    }
    
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
const hasVoted = !!(data.lobbyReturn && data.lobbyReturn[myName]);

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
            Indice actuel : <strong class="text-amber-400 text-lg uppercase mx-2 tracking-wider">${esc(gameData.currentClue)} (${gameData.currentCount})</strong>
            <span class="text-xs text-slate-300 ml-2">Coups restants : <b class="text-white">${guessesLeft}</b>${bonusText}</span>
            <button onclick="passCodenamesTurn()" class="ml-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow">Fin de tour</button>
        `;
    } else {
        const clueText = gameData.currentClue ? `${esc(gameData.currentClue)} (${gameData.currentCount})` : "En attente du Maître-Espion...";
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
    const count = Math.max(0, Math.min(9, parseInt(document.getElementById('cn-clue-count').value, 10) || 0));
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
                nextTurn = window.cnNextTurn(data, currentTeam);
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
            nextTurn = window.cnNextTurn(data, currentTeam);
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
        
        gameData.currentTurn = window.cnNextTurn(data, gameData.currentTurn);
        gameData.currentClue = "";
        gameData.guessesMade = 0; // <-- NOUVEAU
        window.mettreAJourSalonFirebase(roomCode, { codenamesGame: gameData });
    });
};

