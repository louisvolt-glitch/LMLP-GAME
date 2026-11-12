// --- LOGIQUE DU PETIT BAC ---
let currentBacLetter = 'A';
let bacCategories = [
    		// --- Classiques ---
    		"Pays / Ville", "Prénom", "Animal", "Fruit / Légume", "Métier", "Objet",
    		"Couleur", "Plante / Fleur", "Vêtement", "Partie du corps", "1 / 2 - Nourriture / Boisson",
    		"Sport", "Marque", "Film", "Série TV", "Chanteur / Groupe",
    		"Livre / Auteur", "Jeu vidéo", "Monument", "Matière",
    
    		// --- Pop Culture & Divertissement ---
    		"Personnage de fiction", "Super-héros / Super-vilain", "Dessin animé", "Jeu de société",
    		"Instrument de musique", "Style musical", "Chanson connue", "Jeu d'arcade / Rétrogaming",
    		"Créature fantastique / Monstre", "Pokémon", "Arme médiévale / Fantastique", "Objet magique",
    		"Super-pouvoir", "Plateforme de streaming", "Réseau social", "Hashtag / Tendance web",
    		"Application mobile", "Émission de télévision", "Youtubeur / Streamer", "Studio de jeux vidéo",

    		// --- Géographie & Lieux ---
    		"Capitale", "Fleuve / Rivère", "Montagne / Chaîne de montagnes", "Océan / Mer",
    		"Île / Archipel", "Désert", "Monument historique", "Merveille du monde",
    		"Région / Province", "Continent", "Nom de rue / Avenue", "Type de bâtiment",
    		"Lieu de vacances", "Parc d'attractions", "Aéroport international", "Stade de sport",
    		"Pont célèbre", "Château / Palais", "Musée", "Forêt / Jungle",

    		// --- Cuisine & Gastronomie ---
    		"Plat cuisiné", "Fromage", "Dessert / Pâtisserie", "Épice / Condiment",
    		"Boisson alcoolisée", "Cocktail", "Ustensile de cuisine", "Fast-food / Restauration rapide",
    		"Recette de pizza", "Confiserie / Bonbon", "Type de pain", "Céréale / Graine",
    		"Légumineuse", "Fruit de mer / Poisson", "Mode de cuisson", "Marque de chocolat",

    		// --- Nature, Science & Quotidien ---
    		"Oiseau", "Mammifère marin", "Insecte / Arachnide", "Race de chien",
    		"Race de chat", "Reptile / Amphibien", "Arbre", "Phénomène météorologique",
    		"Élément chimique", "Planète / Corps céleste", "Constellation", "Outil de bricolage",
    		"Meuble de maison", "Appareil électroménager", "Véhicule", "Marque de voiture",
    		"Pièce d'une maison", "Fourniture scolaire", "Moyen de transport en commun", "Type de tissu / Matière vestimentaire",

    		// --- Adjectifs, Verbes & Divers ---
    		"Adjectif qualificatif", "Verbe d'action", "Métier difficile", "Chose qu'on trouve dans une cuisine",
    		"Chose qu'on trouve dans un garage", "Chose qu'on achète en pharmacie", "Chose rouge",
    		"Chose invisible", "Chose qui fait peur", "Chose qui fait du bruit", "Chose qu'on jette à la poubelle",
    		"Chose qu'on garde secret", "Chose qu'on emporte sur une île déserte", "Cadeau d'anniversaire idéal",
    		"Excuse pour arriver en retard", "Mot de 4 lettres maximum", "Mot de plus de 10 lettres"
	];

let bacPlayerAnswers = {};
let currentBacCategories = [];
let totalBacRounds = 3;

window.switchScreen = function(screenId) {
    		document.querySelectorAll('main').forEach(el => el.classList.add('hidden'));
    		const target = document.getElementById(screenId);
    		if (target) target.classList.remove('hidden');
}

window.startNextBacRound = function() {

		// 1. Rendre l'écran du Petit Bac visible
    		switchScreen('screen-petitsbac'); // <-- AJOUTEZ CETTE LIGNE ICI

   		state.currentRound = state.currentRound || 1; // Sécurité si non initialisé
 
    		// 1. Choisir une lettre aléatoire (excluant les lettres rares si besoin: Q, W, X, Y, Z)
    		const letters = "ABCDEFGHIJKLMNOPRSTUV";
    		currentBacLetter = letters[Math.floor(Math.random() * letters.length)];
    
    		document.getElementById('bac-letter-display').innerText = currentBacLetter;
    		document.getElementById('bac-round-indicator').innerText = `Manche ${state.currentRound} / ${totalBacRounds}`;

    		// 2. Générer les inputs pour chaque catégorie
    		const container = document.getElementById('bac-categories-inputs');
    		container.innerHTML = '';
    
    		currentBacCategories.forEach((cat, index) => {
        		container.innerHTML += `
            			<div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                			<span class="text-xs font-bold text-slate-300 w-40">${cat}</span>
                			<input type="text" id="bac-input-${index}" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 uppercase transition w-full" placeholder="Commençant par ${currentBacLetter}..." autocomplete="off">
            			</div>
        		`;
    		});

		// Démarrer le compte à rebours (ex: 60 secondes)
		const timerSelect = document.getElementById('setting-petitsbac-timer');
		let timeleft = timerSelect ? (parseInt(timerSelect.value) || 60) : 60;

		const timerDisplay = document.getElementById('bac-timer');
		if (timerDisplay) {
 		   timerDisplay.innerText = timeleft + 's';
		}

		if (window.bactimerInterval) {
 		   clearInterval(window.bactimerInterval);
		}

		window.bactimerInterval = setInterval(() => {
   		 timeleft--;
    
   		 if (timerDisplay) {
        		timerDisplay.innerText = timeleft + 's';
   		 }

   		 if (timeleft <= 0) {
       		 clearInterval(window.bactimerInterval);
       		 submitBacAnswers(); // Soumission automatique à la fin du temps
    		}
		}, 1000);
}

window.startPetitsBacGame = function() {

		state.currentRound = 1;

		const roundsInput = document.getElementById('setting-petitsbac-rounds');
		totalBacRounds = roundsInput ? parseInt(roundsInput.value) : 3;

    		// Récupérer le nombre de catégories configuré par l'hôte (entre 3 et 8)
    		const categoryCountInput = document.getElementById('setting-petitsbac-categories');
    		const numCategories = categoryCountInput ? parseInt(categoryCountInput.value) : 5;

   		 // Mélanger la banque de catégories existante (bacCategories) et en prendre un sous-ensemble aléatoire
    		const shuffledPool = [...bacCategories].sort(() => 0.5 - Math.random());
    		currentBacCategories = shuffledPool.slice(0, numCategories);

		// Lancer proprement la première manche via startNextBacRound (qui gère la lettre, les inputs et le timer)
    		startNextBacRound();

}

window.calculateBacScores = function() {
    		// Logique d'attribution des points (10 si unique, 5 si partagé, 0 si vide/incorrect)
    		state.players.forEach(p => {
        		if (!p.score) p.score = 0;
        		// Attribution fictive pour la démo de manche
        		p.score += Math.floor(Math.random() * 30) + 10;
    		});

    		if (state.currentRound < totalBacRounds) {
        		state.currentRound++;
        		// Afficher un résumé intermédiaire puis passer à la manche suivante
        		setTimeout(() => {
            			startNextBacRound();
        		}, 3000);
    		} else {
        		// Fin de partie : afficher le classement final
        		showFinalResults();
    		}
}

window.endPetitsBacRound = function(letter, currentRoundAnswers) {
    		state.petitsBacLog.push({
        		round: state.currentRound,
        		letter: letter,
        		// On sauvegarde une copie des joueurs/réponses pour cette manche
        		playerResults: state.players.map(p => ({
            			name: p.name,
            			answers: currentRoundAnswers[p.name] || {},
            			scoreEarned: p.lastRoundScore || 0
        		}))
    		});
}

window.startVotingPhase = function() {
    document.getElementById('screen-petitsbac').classList.add('hidden');
    document.getElementById('screen-petitsbac-vote').classList.remove('hidden');
    
    const container = document.getElementById('vote-grid-container');
    container.innerHTML = "";

    currentRoundVotes = {};

    // 1. Démarrer le compte à rebours de vote (ex: 20 secondes)
    let voteTimeLeft = 20;
    const voteTimerDisplay = document.getElementById('vote-timer');
    if (voteTimerDisplay) voteTimerDisplay.innerText = voteTimeLeft + 's';

    if (window.voteTimerInterval) clearInterval(window.voteTimerInterval);
    window.voteTimerInterval = setInterval(() => {
        voteTimeLeft--;
        if (voteTimerDisplay) voteTimerDisplay.innerText = voteTimeLeft + 's';
        if (voteTimeLeft <= 0) {
            clearInterval(window.voteTimerInterval);
            submitVotes(); // Validation automatique des votes à la fin du temps
        }
    }, 1000);

    // 2. Parcourir toutes les réponses des joueurs par catégorie
    Object.keys(state.currentRoundAnswers).forEach(playerName => {
        const answers = state.currentRoundAnswers[playerName];
        Object.keys(answers).forEach(cat => {
            const word = answers[cat];
            if (!word) return; // Ignorer les réponses vides

            const voteKey = `${playerName}_${cat}`;
            currentRoundVotes[voteKey] = { yes: 0, no: 0, voters: [] };

            const card = document.createElement('div');
            card.className = "bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between";
            card.innerHTML = `
                <div>
                    <span class="text-[10px] text-indigo-400 uppercase font-bold block">${cat} (${playerName})</span>
                    <span class="text-white font-bold text-base">"${word}"</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="castVote('${voteKey}', 'yes', this)" class="px-3 py-1.5 bg-slate-800 hover:bg-emerald-500/20 text-emerald-400 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-check"></i> Confirmé
                    </button>
                    <button type="button" onclick="castVote('${voteKey}', 'no', this)" class="px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-xmark"></i> Rejeté
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });

    // Simuler automatiquement les votes des bots
    simulateBotsVotes();
}

window.submitBacAnswers = function() {

    if (typeof timeleft !== 'undefined' && timeleft > 15) {
        timeleft = 15; // Descendre le compteur à 15 secondes
        
        // Mettre à jour l'affichage visuel du timer
        const timerDisplay = document.getElementById('bac-timer');
        if (timerDisplay) {
            timerDisplay.innerText = timeleft + 's';
        }
        
        // Optionnel : Empêcher la soumission immédiate pour laisser le joueur modifier 
        // ses réponses pendant ces 15 secondes restantes, en retournant simplement ici :
        return; 
    }

    if (window.bactimerInterval) {
        clearInterval(window.bactimerInterval);
    }

    const currentLetter = document.getElementById('bac-letter-display').innerText;

    let playerAnswers = {};
    
    // Parcourir les catégories dynamiques de la manche actuelle
    currentBacCategories.forEach((cat, index) => {
        const input = document.getElementById(`bac-input-${index}`);
        let val = input ? input.value.trim() : "";
        
        // Vérification si le mot commence par la bonne lettre
        if (val.length > 0 && val[0].toUpperCase() !== currentLetter) {
            val = ""; // Rejeté si mauvaise lettre
        }
        playerAnswers[cat] = val;
    });

    // Enregistrer les réponses du joueur local
    state.currentRoundAnswers[state.username] = playerAnswers;

    // Simuler les réponses des bots s'il y a des bots
    state.players.forEach(p => {
        if (p.isBot) {
            state.currentRoundAnswers[p.name] = generateBotBacAnswers(currentLetter);
        }
    });

    // Masquer l'écran du petit bac et lancer la phase de vote
    document.getElementById('screen-petitsbac').classList.add('hidden');
    startVotingPhase();
}

window.generateBotBacAnswers = function(letter) {
    		let botAns = {};
    		// Logique simple pour générer des mots factices de bots commençant par la lettre
    		const sampleWords = ["Arbre", "Bateau", "Chat", "Dinosaure", "Éléphant", "Fleur", "Girafe", "Hibou", "Igloo", "Jardin", "Kangaroo", "Lune", "Maison", "Nuage", "Oiseau", "Pomme", "Quai", "Rose", "Soleil", "Train", "Ustensile", "Voile", "Wagon", "Xylophone", "Yacht", "Zèbre"];
    		const validWords = sampleWords.filter(w => w.toUpperCase().startsWith(letter));
    
    		currentBacCategories.forEach(cat => {
        		if (Math.random() > 0.3 && validWords.length > 0) {
            			botAns[cat] = validWords[Math.floor(Math.random() * validWords.length)];
        		} else {
            			botAns[cat] = "";
        		}
    		});
    		return botAns;
}

window.castVote = function(voteKey, choice, btnElement) {
    		const parent = btnElement.parentElement;
    		parent.querySelectorAll('button').forEach(b => b.classList.remove('ring-2', 'ring-indigo-500'));
    		btnElement.classList.add('ring-2', 'ring-indigo-500');

    		currentRoundVotes[voteKey].myVote = choice;
}

window.simulateBotsVotes = function() {
    		state.players.forEach(p => {
        		if (p.isBot) {
            			Object.keys(currentRoundVotes).forEach(voteKey => {
                			// Les bots votent "yes" majoritairement (ex: 80% de chance)
                			const botChoice = Math.random() > 0.2 ? 'yes' : 'no';
                			if (!currentRoundVotes[voteKey].botVotes) currentRoundVotes[voteKey].botVotes = { yes: 0, no: 0 };
                			currentRoundVotes[voteKey].botVotes[botChoice]++;
            			});
        		}
    		});
}

window.submitVotes = function() {

    if (window.voteTimerInterval) {
        clearInterval(window.voteTimerInterval);
    }

    const container = document.getElementById('vote-grid-container');
    if (!container) return;

    // Récupérer tous les éléments de réponse de l'écran de vote
    const items = container.querySelectorAll('[data-player]');
    
    // Objet temporaire pour comptabiliser les votes validés par le joueur local
    const myVotes = {};
    items.forEach(item => {
        const player = item.dataset.player;
        const cat = item.dataset.category;
        const isValid = item.dataset.valid === 'true';

        if (!myVotes[player]) myVotes[player] = {};
        myVotes[player][cat] = isValid;
    });

    // Fusionner ou enregistrer dans currentRoundVotes si vous gérez le multijoueur/bots
    // (Exemple de structure basée sur votre logique précédente)
    Object.keys(myVotes).forEach(player => {
        Object.keys(myVotes[player]).forEach(cat => {
            const voteKey = `${player}_${cat}`;
            if (!currentRoundVotes[voteKey]) {
                currentRoundVotes[voteKey] = { myVote: 'no', botVotes: { yes: 0, no: 0 } };
            }
            // Mémoriser le choix 'yes' (validé) ou 'no' (rejeté)
            currentRoundVotes[voteKey].myVote = myVotes[player][cat] ? 'yes' : 'no';
        });
    });

    // Calculer les résultats par majorité
    Object.keys(currentRoundVotes).forEach(voteKey => {
        const data = currentRoundVotes[voteKey];
        let yesCount = (data.myVote === 'yes' ? 1 : 0) + (data.botVotes ? data.botVotes.yes : 0);
        let noCount = (data.noCount === 'yes' ? 1 : 0) + (data.botVotes ? data.botVotes.no : 0); // Ajusté selon la structure de vos données

        const [playerName, cat] = voteKey.split('_');

        // La majorité l'emporte
        if (yesCount > noCount) {
            // Attribuer des points (ex: 2 points si valide)
            // Assurez-vous que l'objet 'state' ou votre tableau de joueurs est accessible ici
            if (typeof state !== 'undefined' && state.players) {
                const p = state.players.find(x => x.name === playerName);
                if (p) {
                    p.score = (p.score || 0) + 2;
                }
            }
        }
    });

    // Masquer l'écran de vote
    document.getElementById('screen-petitsbac-vote').classList.add('hidden');

    // Passer à la manche suivante ou aux résultats finaux
    state.currentRound++;
    if (typeof totalBacRounds !== 'undefined' && state.currentRound > totalBacRounds) {
        if (typeof showFinalResults === 'function') showFinalResults();
    } else {
        if (typeof startNextBacRound === 'function') startNextBacRound(); // Fonction qui initialise la manche suivante du Petit Bac
    }
}