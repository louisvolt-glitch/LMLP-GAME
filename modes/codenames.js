// --- NOMS DE CODE : FLOTTES RIVALES (habillage spatial du jeu d'équipes) ---
// Deux flottes (Écarlate = « red », Azur = « blue ») : l'Amiral transmet un indice, les Éclaireurs sondent les secteurs.
// Le secteur piégé est un trou noir qui engloutit la flotte qui le sonde.
window.cnFlotte = function(team, maj) { const n = team === 'red' ? 'Écarlate' : 'Azur'; return maj ? n.toUpperCase() : n; };
(function() {
    if (typeof document === 'undefined' || document.getElementById('cn-style')) return;
    const st = document.createElement('style'); st.id = 'cn-style';
    st.textContent = `
#codenames-grid > div{position:relative;overflow:hidden}
.cn-scan{animation:cnFlip .7s ease-out}
.cn-scan::after{content:"";position:absolute;left:0;right:0;top:-30%;height:30%;background:linear-gradient(180deg,rgba(34,211,238,0),rgba(34,211,238,.85),rgba(34,211,238,0));animation:cnScan .7s linear}
@keyframes cnScan{0%{top:-30%}100%{top:110%}}
@keyframes cnFlip{0%{transform:rotateY(90deg) scale(1.15);filter:brightness(2.2)}60%{transform:rotateY(0) scale(1.06);filter:brightness(1.5)}100%{transform:none;filter:none}}
#cn-trou{position:fixed;inset:0;z-index:10020;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,.96) 0%,rgba(2,6,23,.9) 45%,rgba(2,6,23,0) 75%);animation:cnTrouFond 3.4s ease-in-out forwards}
#cn-trou .disque{width:170px;height:170px;border-radius:50%;background:#000;box-shadow:0 0 0 6px #000,0 0 40px 18px rgba(168,85,247,.85),0 0 110px 50px rgba(249,115,22,.45);animation:cnTrou 3.4s ease-in-out forwards}
#cn-trou .txt{margin-top:26px;font-weight:900;letter-spacing:.14em;color:#e9d5ff;font-size:20px;text-align:center;text-shadow:0 0 14px #a855f7;padding:0 16px}
@keyframes cnTrou{0%{transform:scale(0) rotate(0)}30%{transform:scale(1.25) rotate(160deg)}80%{transform:scale(1) rotate(420deg)}100%{transform:scale(1.6) rotate(540deg)}}
@keyframes cnTrouFond{0%{opacity:0}15%{opacity:1}82%{opacity:1}100%{opacity:0}}
.cn-aspire{animation:cnAspire 1.4s ease-in forwards}
@keyframes cnAspire{0%{transform:none;opacity:1}100%{transform:scale(.2) rotate(40deg);opacity:.25;filter:blur(2px)}}`;
    document.head.appendChild(st);
})();
window.cnVu = { t: 0, sess: '' };

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
        showToast("⚠️ Il faut au moins 2 joueurs pour jouer à Noms de Code.");
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
            showToast(`⚠️ La Flotte ${cnFlotte(team)} doit avoir au moins 2 joueurs (1 Amiral + 1 Éclaireur).`);
            return;
        }
        const spies = names.filter(n => roles[n].isSpymaster);
        const keepSpy = spies.length > 0 ? spies[0] : names[0];
        names.forEach(n => { roles[n].isSpymaster = (n === keepSpy); });
        teamsPresent.push(team);
    }
    if (teamsPresent.length === 0) {
        showToast("⚠️ Aucun joueur n'est assigné à une flotte.");
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
        "ARC", "SABLE", "PAPIER", "VENT", "PORTE", "ETOILE", "LUNETTES", "VOITURE", "CLE", "FER",
        "COMETE", "FUSEE", "ORBITE", "GALAXIE", "SATELLITE", "ROBOT", "LASER", "PLANETE", "RADAR", "CAPSULE",
        "SOLEIL", "COSMOS", "CRATERE", "ANNEAU", "ECLIPSE", "SONDE", "METEORE", "BOUCLIER", "RADIO", "PILOTE",
        "ARBRE", "FORET", "MONTAGNE", "RIVIERE", "OCEAN", "DESERT", "VOLCAN", "ILE", "LAC", "NEIGE",
        "PLUIE", "ORAGE", "NUAGE", "TEMPETE", "VAGUE", "ROCHER", "GROTTE", "JUNGLE", "PRAIRIE", "FALAISE",
        "CHIEN", "CHEVAL", "VACHE", "MOUTON", "LOUP", "OURS", "RENARD", "AIGLE", "HIBOU", "SERPENT",
        "REQUIN", "BALEINE", "DAUPHIN", "TORTUE", "ABEILLE", "FOURMI", "ARAIGNEE", "PAPILLON", "SINGE", "TIGRE",
        "ZEBRE", "GIRAFE", "CANARD", "CORBEAU", "PIGEON", "SOURIS", "LAPIN", "DRAGON", "LICORNE", "PHENIX",
        "PAIN", "FROMAGE", "BEURRE", "SEL", "SUCRE", "CAFE", "THE", "VIN", "BIERE", "GATEAU",
        "CHOCOLAT", "CITRON", "ORANGE", "BANANE", "FRAISE", "CERISE", "RAISIN", "TOMATE", "CAROTTE", "OIGNON",
        "PIZZA", "SOUPE", "OEUF", "RIZ", "PATES", "MAISON", "CHATEAU", "EGLISE", "HOPITAL", "ECOLE",
        "PRISON", "USINE", "FERME", "HOTEL", "MUSEE", "THEATRE", "CINEMA", "STADE", "GARE", "PORT",
        "PONT", "TUNNEL", "ROUTE", "PLACE", "MARCHE", "BANQUE", "PHARE", "MOULIN", "PALAIS", "CABANE",
        "TENTE", "LIT", "CHAISE", "BUREAU", "LAMPE", "MIROIR", "TAPIS", "RIDEAU", "HORLOGE", "MONTRE",
        "CLOCHE", "BOUGIE", "BOITE", "SAC", "VALISE", "PANIER", "BOUTEILLE", "TASSE", "COUTEAU", "FOURCHE",
        "MARTEAU", "CLOU", "VIS", "PELLE", "CORDE", "CHAINE", "CADENAS", "ECHELLE", "BALAI", "SEAU",
        "TRAIN", "BUS", "VELO", "MOTO", "CAMION", "TAXI", "METRO", "NAVIRE", "CANOT", "VOILE",
        "ANCRE", "RADEAU", "ROUE", "MOTEUR", "VOLANT", "PNEU", "PHARES", "TETE", "MAIN", "BRAS",
        "JAMBE", "OEIL", "NEZ", "BOUCHE", "DENT", "LANGUE", "CHEVEU", "BARBE", "DOS", "VENTRE",
        "GENOU", "DOIGT", "ONGLE", "PEAU", "SANG", "OS", "CERVEAU", "REINE", "PRINCE", "SOLDAT",
        "PIRATE", "VOLEUR", "JUGE", "AVOCAT", "MEDECIN", "DOCTEUR", "POMPIER", "POLICE", "ESPION", "MAGICIEN",
        "CLOWN", "ACTEUR", "CHANTEUR", "PEINTRE", "BOUCHER", "FERMIER", "MARIN", "GEANT", "NAIN", "FEE",
        "SORCIER", "FANTOME", "VAMPIRE", "ZOMBIE", "MOMIE", "ANGE", "DEMON", "LIVRE", "LETTRE", "JOURNAL",
        "PAGE", "ENCRE", "CRAYON", "STYLO", "GOMME", "REGLE", "CAHIER", "TABLEAU", "ECRAN", "CLAVIER",
        "CABLE", "PILE", "AIMANT", "LOUPE", "BOUSSOLE", "BALANCE", "MUSIQUE", "PIANO", "GUITARE", "VIOLON",
        "TAMBOUR", "FLUTE", "TROMPETTE", "CHANSON", "DANSE", "BAL", "FETE", "CADEAU", "JEU", "CARTES",
        "DE", "PION", "ECHEC", "BALLE", "BALLON", "RAQUETTE", "FILET", "BUT", "COURSE", "SAUT",
        "NAGE", "BOXE", "SKI", "PATIN", "GUERRE", "ARMEE", "EPEE", "CANON", "FUSIL", "FLECHE",
        "ARMURE", "CASQUE", "TRESOR", "COURONNE", "TRONE", "DRAPEAU", "MEDAILLE", "COUPE", "TEMPS", "JOUR",
        "NUIT", "MATIN", "HIVER", "ETE", "PRINTEMPS", "AUTOMNE", "HEURE", "SIECLE", "AGE", "ROBE",
        "MANTEAU", "CHEMISE", "PANTALON", "JUPE", "GANT", "BOTTE", "CHAUSSURE", "CEINTURE", "CRAVATE", "BAGUE",
        "COLLIER", "BOUTON", "FIL", "AIGUILLE", "AMOUR", "PEUR", "JOIE", "COLERE", "REVE", "SECRET",
        "MENSONGE", "VERITE", "CHANCE", "DESTIN", "MORT", "VIE", "FORCE", "VITESSE", "SILENCE", "BRUIT",
        "OMBRE", "LUMIERE", "FLAMME", "FUMEE", "CENDRE", "POUSSIERE", "NOIR", "VERT", "BLEU", "JAUNE",
        "ROSE", "GRIS", "ARGENT", "DIAMANT", "PERLE", "CRISTAL", "MARBRE", "PIERRE", "BRIQUE", "CIMENT",
        "ACIER", "CUIVRE", "PLOMB", "NORD", "SUD", "EST", "OUEST", "CENTRE", "BORD", "COIN",
        "LIGNE", "CERCLE", "CARRE", "TRIANGLE", "CROIX", "POINT", "ANGLE", "AFRIQUE", "ASIE", "AMERIQUE",
        "PARIS", "LONDRES", "ROME", "BERLIN", "TOKYO", "EGYPTE", "CHINE", "INDE", "BRESIL", "CANADA",
        "MEXIQUE", "RUSSIE", "GRECE", "FUSION", "NEBULEUSE", "ASTRONAUTE", "STATION", "MODULE", "ANTENNE", "SIGNAL",
        "CODE", "VIRUS", "RESEAU", "ATOME", "ENERGIE", "GRAVITE", "VIDE", "TROU", "ALIEN", "OVNI",
        "TELESCOPE", "COMETES"
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
        const teamLabel = myRole.team === 'red' ? 'Flotte Écarlate' : (myRole.team === 'blue' ? 'Flotte Azur' : 'Spectateur');
        const teamColor = myRole.team === 'red' ? 'text-red-400' : (myRole.team === 'blue' ? 'text-blue-400' : 'text-slate-400');
        roleBadge.innerHTML = `<span class="${teamColor} font-bold">${teamLabel}</span>${myRole.team !== 'spectator' ? ' — ' + (myRole.isSpymaster ? '🎖️ Amiral' : '🛰️ Éclaireur') : ''}`;
    }
    
    // UI Scores et Tour
    const turnIndicator = document.getElementById('codenames-turn-indicator');
    if (gameData.status !== "PLAYING") {
        const isRedWin = gameData.status === 'RED_WIN';
        turnIndicator.innerHTML = `<i class="fa-solid fa-trophy"></i> Victoire de la Flotte ${isRedWin ? 'ÉCARLATE' : 'AZUR'} !`;
        turnIndicator.className = `font-bold text-sm ${isRedWin ? 'text-red-400' : 'text-blue-400'}`;
    } else {
        const isRedTurn = gameData.currentTurn === 'red';
        turnIndicator.innerHTML = `<i class="fa-solid fa-shuttle-space"></i> Tour de la Flotte ${isRedTurn ? 'Écarlate' : 'Azur'}`;
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
                ${gameData.trou ? '🕳️ La Flotte ' + cnFlotte(gameData.trou) + ' a sondé le trou noir et a été engloutie !<br>' : ''}🏆 La Flotte ${isRedWin ? 'Écarlate' : 'Azur'} remporte la victoire et +${pts} points !
            </div>
            ${hasVoted 
                ? '<button disabled class="w-full max-w-sm mx-auto py-3 bg-slate-800 text-slate-400 rounded-xl font-bold uppercase transition cursor-not-allowed text-base"><i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...</button>'
                : '<button onclick="backToLobby()" class="w-full max-w-sm mx-auto py-3 rounded-xl font-bold uppercase transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white text-base">Retour au Salon</button>'
            }
        `;
    } else if (isMyTurn && myRole.isSpymaster && !gameData.currentClue) {
        clueBox.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <input type="text" id="cn-clue-word" placeholder="Indice de l'Amiral (1 mot)..." class="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white text-sm">
                <input type="number" id="cn-clue-count" min="0" max="9" value="1" class="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white text-sm w-16 text-center">
                <button onclick="submitCodenamesClue()" class="bg-emerald-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-emerald-500 transition shadow">Transmettre</button>
            </div>
        `;
    } else if (isMyTurn && !myRole.isSpymaster && gameData.currentClue) {
        let maxGuesses = gameData.currentCount + 1;
        let guessesLeft = maxGuesses - (gameData.guessesMade || 0);
        let bonusText = (gameData.guessesMade === gameData.currentCount) ? " (Sonde bonus !)" : "";

        clueBox.innerHTML = `
            Indice de l'Amiral : <strong class="text-amber-400 text-lg uppercase mx-2 tracking-wider">${esc(gameData.currentClue)} (${gameData.currentCount})</strong>
            <span class="text-xs text-slate-300 ml-2">Sondes restantes : <b class="text-white">${guessesLeft}</b>${bonusText}</span>
            <button onclick="passCodenamesTurn()" class="ml-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow">Fin de tour</button>
        `;
    } else {
        const clueText = gameData.currentClue ? `${esc(gameData.currentClue)} (${gameData.currentCount})` : "En attente de l'Amiral...";
        clueBox.innerHTML = `Transmission : <strong class="text-amber-400 text-sm uppercase tracking-wider">${clueText}</strong>`;
    }

    // Génération de la Grille
    const grid = document.getElementById('codenames-grid');
    const wordsArray = Array.isArray(gameData.words) ? gameData.words : Object.values(gameData.words || {});
    const der = gameData.last || null;
    const sessCn = wordsArray.map(w => w.word).join('|');
    if (cnVu.sess !== sessCn) { cnVu.sess = sessCn; cnVu.t = der ? der.t : 0; }      // nouvelle grille (ou arrivée en cours) : pas d'animation
    const neuf = der && der.t !== cnVu.t ? der.i : -1;
    if (der) cnVu.t = der.t;
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
            <div ${clickAttr} class="p-2 sm:p-4 ${bgClass} border rounded-xl text-center font-bold text-xs sm:text-sm transition select-none flex items-center justify-center h-16 sm:h-20 ${cursorClass} ${w.revealed ? '' : 'shadow-md'} ${idx === neuf ? 'cn-scan' : ''}">
                ${w.type === 'assassin' && (w.revealed || myRole.isSpymaster || gameData.status !== "PLAYING") ? '🕳️ ' : ''}${w.word}
            </div>
        `;
    }).join('');
    if (neuf >= 0) {
        if (typeof window.sfx === 'function') window.sfx(wordsArray[neuf].type === 'assassin' ? 'coule' : 'carte');
        if (wordsArray[neuf].type === 'assassin') {
            // le trou noir engloutit la flotte qui l'a sondé
            const old = document.getElementById('cn-trou'); if (old) old.remove();
            const ov = document.createElement('div'); ov.id = 'cn-trou';
            ov.innerHTML = `<div class="disque"></div><div class="txt">TROU NOIR !<br><span style="font-size:14px;font-weight:700">La Flotte ${cnFlotte(gameData.trou || 'red')} est engloutie</span></div>`;
            document.body.appendChild(ov);
            grid.classList.add('cn-aspire');
            setTimeout(() => { ov.remove(); grid.classList.remove('cn-aspire'); }, 3400);
        }
    }
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
        gameData.last = { i: idx, t: Date.now() };      // secteur sondé à l'instant : animation de scan chez tout le monde
        if (wordObj.type === 'assassin') gameData.trou = currentTeam;
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

