const QUIZ_CATEGORIES_DATA = {};
const categoriesMeta = [
            { key: 'geo', name: '🌍 Géographie Mondiale' },
            { key: 'history', name: '🏛️ Histoire & Civilisations' },
            { key: 'science', name: '🔬 Sciences & Nature' },
            { key: 'cinema', name: '🎬 Cinéma & Culture Pop' },
            { key: 'tech', name: '🎮 Jeux Vidéo & Tech' },
            { key: 'sport', name: '⚽ Sports & Olympiades' },
            { key: 'music', name: '🎵 Musique & Concerts' },
            { key: 'gastronomy', name: '🍳 Gastronomie & Vins' },
            { key: 'literature', name: '📚 Littérature & Poésie' },
            { key: 'art', name: '🎨 Art & Architecture' },
            { key: 'mythology', name: '⚡ Mythologie & Légendes' },
            { key: 'astronomy', name: '🚀 Astronomie & Espace' },
            { key: 'nature', name: '🌿 Faune & Flore' },
            { key: 'economy', name: '💰 Économie & Entreprises' },
            { key: 'philosophy', name: '🧠 Philosophie & Pensée' },
            { key: 'automotive', name: '🏎️ Automobile & Mécanique' },
            { key: 'popculture', name: '🌟 Séries TV & Médias' },
            { key: 'inventions', name: '💡 Inventions & Innovations' },
            { key: 'languages', name: '🗣️ Langues & Linguistique' },
            { key: 'pets', name: '🐾 Animaux de Compagnie' }
        ];

window.categoriesMeta = categoriesMeta;

window.initQuizCategoriesChecklist = function() {
            const container = document.getElementById('quiz-categories-checklist');
            if (!container || typeof categoriesMeta === 'undefined') return;
            
            container.innerHTML = categoriesMeta.map(cat => `
                <label class="flex items-center gap-2 cursor-pointer hover:text-white select-none">
                    <input type="checkbox" value="${cat.key}" class="quiz-cat-checkbox accent-command-cyan" checked onclick="setTimeout(updateHostSettings, 10)">
                    <span>${cat.name}</span>
                </label>
            `).join('');
        }

	    categoriesMeta.forEach(cat => {
   		 QUIZ_CATEGORIES_DATA[cat.key] = { 
        		name: cat.name, 
       			easy: pools[cat.key] ? pools[cat.key].easy : [], 
        		medium: pools[cat.key] ? pools[cat.key].medium : [], 
        		hard: pools[cat.key] ? pools[cat.key].hard : [] 
    		};

        });

window.startQuizMode = function() {
    let seq = [];
    let checkedBoxes = document.querySelectorAll('.quiz-cat-checkbox:checked');
    let cats = checkedBoxes.length > 0 ? Array.from(checkedBoxes).map(cb => cb.value) : (state.quizSettings.categories || ['geo']);
    
    const totalQ = parseInt(state.quizSettings.questionsCount, 10) || 10;

    state.quizGame.totalQuestions = totalQ;
    state.quizGame.categoriesSequence = [];

    for (let i = 0; i < totalQ; i++) {
        seq.push(cats[i % cats.length]);
    }
    
    state.quizGame.categoriesSequence = seq.sort(() => Math.random() - 0.5);
    state.quizGame.currentIndex = 0;
    state.quizGame.answersLog = [];
    
    prepareNextQuizQuestion();
}

window.prepareNextQuizQuestion = function() {
    let seq = state.quizGame.categoriesSequence;
    // Conversion sécurisée si Firebase renvoie un objet au lieu d'un tableau
    let seqArr = Array.isArray(seq) ? seq : (seq ? Object.values(seq) : []);
    let maxQuestions = state.quizGame.totalQuestions || state.quizSettings?.questionsCount || 10;

    // Vérification stricte de la fin du quiz
    if (state.quizGame.currentIndex >= maxQuestions || (seqArr.length > 0 && state.quizGame.currentIndex >= seqArr.length)) {
        showQuizFinalRecap();
        return;
    }

    let catKey = seqArr[state.quizGame.currentIndex % seqArr.length] || 'geo';
    state.quizGame.pendingCategoryKey = catKey;

    const categoryMetaObj = categoriesMeta.find(c => c.key === catKey) || { name: 'Culture Générale' };
    state.quizGame.pendingCategoryName = categoryMetaObj.name;

    showScreen('screen-quiz-difficulty');

    const badge = document.getElementById('diff-theme-badge');
    if (badge) {
        badge.innerText = state.quizGame.pendingCategoryName;
    }

}

window.chooseQuizDifficulty = function(diff) {
    if (typeof window.state === 'undefined') window.state = {};
    if (!window.state.quizGame) window.state.quizGame = {};

    let seq = window.state.quizGame.categoriesSequence;
    let seqArr = Array.isArray(seq) ? seq : (seq ? Object.values(seq) : []);
    
    if (seqArr.length === 0) {
        const checkedBoxes = document.querySelectorAll('.quiz-cat-checkbox:checked');
        if (checkedBoxes.length > 0) {
            seqArr = Array.from(checkedBoxes).map(cb => cb.value);
        } else {
            seqArr = ['geo'];
        }
        window.state.quizGame.categoriesSequence = seqArr;
    }

    state.quizGame.pendingDifficulty = diff;

    const currentIndex = state.quizGame.currentIndex || 0;
    const categoryKey = seqArr[currentIndex % seqArr.length] || 'geo';
    const categoryMetaObj = categoriesMeta.find(c => c.key === categoryKey) || { name: 'Culture Générale' };
    const categoryName = categoryMetaObj.name;

    if (!QUIZ_CATEGORIES_DATA[categoryKey] || !QUIZ_CATEGORIES_DATA[categoryKey][diff]) {
        console.error(`Catégorie "${categoryKey}" ou difficulté "${diff}" introuvable.`);
        return;
    }

    let pool = QUIZ_CATEGORIES_DATA[categoryKey][diff];
    let originalQObj = pool[Math.floor(Math.random() * pool.length)];

    // CORRECTION : On clone l'objet pour éviter de corrompre la source d'origine
    let qClone = JSON.parse(JSON.stringify(originalQObj));

    let optionsAvecIndex = qClone.opts.map((opt, index) => {
        return { texte: opt, estLaBonneReponse: (index === qClone.correct) };
    });

    // Mélange indépendant pour ce joueur
    optionsAvecIndex.sort(() => Math.random() - 0.5);

    qClone.opts = optionsAvecIndex.map(o => o.texte);
    qClone.correct = optionsAvecIndex.findIndex(o => o.estLaBonneReponse);
    qClone.categoryName = categoryName;
    qClone.difficulty = diff;

    // Stocke la question propre à ce joueur dans son état local
    state.quizGame.currentQuestionObj = qClone;

    // On ne pousse plus la question globale sur Firebase pour ne pas écraser les autres, 
    // on indique juste que ce joueur a choisi sa difficulté.
    if (window.currentCodeSalon && window.mettreAJourSalonFirebase) {
        window.mettreAJourSalonFirebase(window.currentCodeSalon, {
            [`quizGame/difficultiesChosen/${window.myPlayerKey || state.username}`]: diff
        });
    }

    startQuizScreen();
}

window.startQuizScreen = function() {
    showScreen('screen-quiz');
    clearInterval(state.quizGame.timerInterval);

    if (typeof state.quizGame.currentIndex === 'undefined') {
        state.quizGame.currentIndex = 0;
    }
    // Correction du nombre total de questions (récupération sécurisée)
    const totalQ = state.quizGame.totalQuestions || state.quizSettings?.questionsCount || (window.currentRoom?.settings?.questionsCount) || 10;
    
// Priorité à la valeur Firebase envoyée par l'hôte
    const timerSetting = (window.currentRoom && window.currentRoom.settings && window.currentRoom.settings.timer) ? window.currentRoom.settings.timer : (state.quizSettings?.timer || 20);
    state.quizGame.timeleft = parseInt(timerSetting, 10);
    
    // Nettoyage des réponses du tour précédent
    state.quizGame.currentRoundAnswers = {};

    let qobj = state.quizGame.currentQuestionObj;
    if (!qobj) return;

    // Affichage correct de la progression (ex: Question 1 / 10)
    document.getElementById('quiz-progress').innerText = `Question ${state.quizGame.currentIndex + 1} / ${totalQ}`;
    document.getElementById('quiz-chosen-diff-badge').innerText = `Difficulté : ${(qobj.difficulty || 'easy').toUpperCase()}`;
    document.getElementById('quiz-question-text').innerText = qobj.q;
    
    // Affichage correct de la catégorie choisie
    document.getElementById('quiz-category-badge').innerText = qobj.categoryName || 'Culture Générale';

    let grid = document.getElementById('quiz-options-grid');
    grid.innerHTML = qobj.opts.map((opt, idx) => `
        <button onclick="answerQuizQuestion(${idx})" class="p-4 bg-slate-900 border border-slate-700 hover:border-indigo-500 rounded-2xl transition text-white font-bold text-sm">
            ${opt}
        </button>
    `).join('');

// MODIFICATION 2D : Retirer l'ancien message d'attente
    const oldWaitMsg = document.getElementById('quiz-wait-msg');
    if (oldWaitMsg) oldWaitMsg.remove();

// Gestion du timer intelligente
    document.getElementById('quiz-timer').innerText = `${state.quizGame.timeleft}s`;
    
    state.quizGame.timerInterval = setInterval(() => {
        // Décrémenter le temps seulement s'il reste du temps
        if (state.quizGame.timeleft > 0) {
            state.quizGame.timeleft--;
            document.getElementById('quiz-timer').innerText = `${state.quizGame.timeleft}s`;
        }

        let myKey = window.myPlayerKey || state.username;

        // 1. Si le chrono est à 0 et que le joueur n'a pas cliqué, on soumet automatiquement une mauvaise réponse (-1)
        if (state.quizGame.timeleft <= 0) {
            if (!state.quizGame.currentRoundAnswers || !state.quizGame.currentRoundAnswers[myKey]) {
                answerQuizQuestion(-1);
            }
        }

        // 2. Vérifier si tous les joueurs humains ont répondu
        let allAnswered = false;
        if (state.quizGame.currentRoundAnswers && state.players) {
            const playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players);
            const humanPlayers = playersArr.filter(p => !p.isBot);
            const answersKeys = Object.keys(state.quizGame.currentRoundAnswers);
            
            // Si le nombre de réponses correspond au nombre de joueurs humains = tout le monde a fini
            allAnswered = humanPlayers.length > 0 && humanPlayers.every(p => answersKeys.includes(p.name || p.pseudo));
        }

        // 3. Le tour se termine UNIQUEMENT SI tout le monde a répondu (soit manuellement, soit car tous les timers sont à 0)
        if (allAnswered) {
            clearInterval(state.quizGame.timerInterval);
            
            if (!state.quizGame.currentRoundAnswers) state.quizGame.currentRoundAnswers = {};
            
            // Sécurité de rattrapage
            if (!state.quizGame.currentRoundAnswers[myKey]) {
                state.quizGame.currentRoundAnswers[myKey] = { choice: -1, isCorrect: false, pointEarned: 0 };
            }
            
            let finalChoice = state.quizGame.currentRoundAnswers[myKey].choice;
            showQuizSummaryScreen(finalChoice, qobj);
     	}

     }, 1000);
}

window.answerQuizQuestion = function(selIdx) {
    let qobj = state.quizGame.currentQuestionObj;

    const optionButtons = document.querySelectorAll('#quiz-options-grid button');

    optionButtons.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === qobj.correct) {
            btn.classList.add('bg-emerald-500/20', 'border-emerald-500', 'text-emerald-300');
        } else if (idx === selIdx && selIdx !== qobj.correct) {
            btn.classList.add('bg-red-500/20', 'border-red-500', 'text-red-300');
        } else {
            btn.classList.add('opacity-50');
        }
    });

    let mult = qobj.difficulty === 'hard' ? 3.5 : (qobj.difficulty === 'medium' ? 2.0 : 1.0);
    let timeLeftVal = typeof state.quizGame.timeleft === 'number' ? state.quizGame.timeleft : 0;
    let earned = selIdx === qobj.correct ? Math.round((1000 + timeLeftVal * 20) * mult) : 0;

    let myKey = window.myPlayerKey || state.username;
    if (!state.players) state.players = {};
    if (!state.players[myKey]) state.players[myKey] = { name: myKey, score: 0 };
    if (typeof state.players[myKey].score !== 'number') state.players[myKey].score = 0;

    if (!state.quizGame.currentRoundAnswers) state.quizGame.currentRoundAnswers = {};
    
    state.quizGame.currentRoundAnswers[myKey] = { 
        questionObj: qobj,
        choice: selIdx, 
        isCorrect: selIdx === qobj.correct, 
        pointEarned: earned 
    };

    if (selIdx === qobj.correct) {
        state.players[myKey].score += earned;
    }

    // Gestion des bots éventuels
    const playersArr = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
    playersArr.forEach((p) => {
        if (p.isBot) {
            let correct = Math.random() < 0.7;
            let bchoice = correct ? qobj.correct : (qobj.correct + 1) % 4;
            let bearned = correct ? Math.round(1000 * mult) : 0;
            p.score += bearned;
            state.quizGame.currentRoundAnswers[p.name] = { 
                questionObj: qobj,
                choice: bchoice, 
                isCorrect: correct, 
                pointEarned: bearned 
            };
        }
    });

    if (typeof window.mettreAJourSalonFirebase === 'function' && window.currentCodeSalon) {
        if (window.currentCodeSalon) {
            const updates = {};
            updates[`players/${myKey}`] = state.players[myKey];
            updates[`quizGame/currentRoundAnswers/${myKey}`] = state.quizGame.currentRoundAnswers[myKey];
            
            window.update(window.ref(window.db, `salons/${window.currentCodeSalon}`), updates);

            let waitMsg = document.getElementById('quiz-wait-msg');
            if (!waitMsg) {
                waitMsg = document.createElement('div');
                waitMsg.id = 'quiz-wait-msg';
                waitMsg.className = 'text-center text-amber-400 font-bold mt-4 animate-pulse';
                document.getElementById('quiz-options-grid').parentElement.appendChild(waitMsg);
            }

            waitMsg.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Réponse enregistrée. En attente des autres joueurs...';
        }
    }
}

window.showQuizSummaryScreen = function(selIdx, qObj) {
    showScreen('screen-quiz-summary');
    
    let myKey = window.myPlayerKey || state.username;
    let roundAnswers = state.quizGame.currentRoundAnswers || {};
    let myAnswer = roundAnswers[myKey] || { pointEarned: 0 };
    let activeQObj = myAnswer.questionObj || qObj;

    if (!state.quizGame.answersLog) state.quizGame.answersLog = [];
    // Utiliser currentIndex pour éviter les doublons lors des re-rendus
    if (state.quizGame.answersLog.length === state.quizGame.currentIndex) {
        let choiceText = "Non répondu";
        if (myAnswer.choice !== undefined && myAnswer.choice !== -1 && activeQObj.opts) {
            choiceText = activeQObj.opts[myAnswer.choice];
        }
        let correctText = activeQObj.opts ? activeQObj.opts[activeQObj.correct] : "Inconnu";

        state.quizGame.answersLog.push({
            question: activeQObj.q,
            playerChoice: choiceText,
            correctAnswer: correctText,
            isCorrect: myAnswer.isCorrect,
            points: myAnswer.pointEarned || 0
        });
    }

    const roundPointsEl = document.getElementById('quiz-round-points');
    if (roundPointsEl) {
        roundPointsEl.innerText = `+${myAnswer.pointEarned || 0} pts`;
        roundPointsEl.className = (myAnswer.pointEarned || 0) > 0 ? "font-mono text-sm text-emerald-400 font-bold" : "font-mono text-sm text-slate-400 font-bold";
    }

    // 1. Affichage de la question du joueur local
    const titleEl = document.getElementById('summary-question-title');
    if (titleEl) titleEl.innerText = activeQObj.q;

    // 2. Affichage de la bonne réponse
    const correctEl = document.getElementById('summary-correct-answer');
    if (correctEl) correctEl.innerText = activeQObj.opts[activeQObj.correct] || 'Réponse';

    // 3. Affichage de l'explication
    const explEl = document.getElementById('summary-explanation');
    if (explEl) explEl.innerText = activeQObj.exp || "Aucune explication disponible pour cette question.";

    // 4. Affichage détaillé des questions et réponses de chaque joueur dans le résumé
    const answersContainer = document.getElementById('summary-players-answers');
    if (answersContainer) {
        answersContainer.innerHTML = '';

        let playersRaw = state.players || {};
        let playersArr = Array.isArray(playersRaw) ? playersRaw : Object.values(playersRaw);

        playersArr.forEach(p => {
            const playerName = p.name || p.pseudo;
            if (!playerName) return;

            const pData = roundAnswers[playerName];
            let chosenText = "N'a pas répondu";
            let badgeClass = "border-slate-700 bg-slate-950/80 text-slate-400";
            let iconHtml = '<i class="fa-regular fa-circle text-slate-500"></i> En attente';
            let playerQText = pData && pData.questionObj ? pData.questionObj.q : "Question non disponible";
            let playerOpts = pData && pData.questionObj ? pData.questionObj.opts : [];

            if (pData && pData.choice !== undefined && pData.choice !== -1) {
                const choiceIdx = pData.choice;
                chosenText = playerOpts[choiceIdx] || "Réponse invalide";
                
                if (pData.isCorrect) {
                    badgeClass = "border-emerald-500 bg-emerald-500/15 text-emerald-300";
                    iconHtml = '<i class="fa-solid fa-check text-emerald-400"></i> Correct';
                } else {
                    badgeClass = "border-red-500 bg-red-500/15 text-red-300";
                    iconHtml = '<i class="fa-solid fa-xmark text-red-400"></i> Incorrect';
                }
            } else {
                badgeClass = "border-amber-500/30 bg-amber-500/10 text-amber-300";
                iconHtml = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i> Non répondu';
            }

            answersContainer.innerHTML += `
                <div class="p-3.5 rounded-xl border ${badgeClass} flex flex-col gap-1.5 shadow-sm">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-white text-xs"><i class="fa-solid fa-user text-indigo-400"></i> [${playerName}]</span>
                        <span class="text-xs font-bold flex items-center gap-1.5">${iconHtml}</span>
                    </div>
                    <div class="text-xs text-slate-300 italic">Question : "${playerQText}"</div>
                    <div class="text-xs font-mono font-bold text-indigo-200">Réponse : "${chosenText}"</div>
                </div>
            `;
        });
    }
}

window.nextQuizQuestionOrFinish = function() {
    let myKey = window.myPlayerKey || state.username;
    let roomCode = window.currentCodeSalon || state.roomCode;

    // 1. Mettre à jour l'interface du bouton localement pour afficher le sablier tout de suite
    const btn = document.querySelector('#screen-quiz-summary button') || event.target;
    if (btn) {
        btn.disabled = true;
        btn.className = "w-full bg-slate-800 text-slate-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition shadow-lg";
        btn.innerHTML = '<i class="fa-solid fa-hourglass-half animate-spin"></i> En attente des autres joueurs...';
    }

    if (!roomCode || !window.db) {
        // Mode secours local si pas de salon Firebase
        setTimeout(() => { executeActualNextQuizQuestion(); }, 1000);
        return;
    }

    // 2. Enregistrer sur Firebase que ce joueur est prêt pour la suite
    const updates = {};
    updates[`quizGame/readyForNext/${myKey}`] = true;
    window.update(window.ref(window.db, `salons/${roomCode}`), updates);
};

function executeActualNextQuizQuestion() {
    state.quizGame.currentIndex++;
    
    let roomCode = window.currentCodeSalon || state.roomCode;
    
    // Seul l'hôte nettoie les votes sur Firebase pour tout le monde
    if (roomCode && window.isHost) {
        const updates = {};
        updates[`quizGame/currentIndex`] = state.quizGame.currentIndex;
        updates[`quizGame/readyForNext`] = null;
        updates[`quizGame/currentRoundAnswers`] = null;
        window.update(window.ref(window.db, `salons/${roomCode}`), updates);
    }

    // EXÉCUTÉ PAR TOUS LES JOUEURS : Réinitialisation locale du bouton de résumé
    const summaryScreen = document.getElementById('screen-quiz-summary');
    if (summaryScreen) {
        const btn = summaryScreen.querySelector('button');
        if (btn) {
            btn.disabled = false;
            btn.className = "w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-indigo-500/20";
            btn.innerHTML = 'Question Suivante <i class="fa-solid fa-arrow-right ml-2"></i>';
        }
    }
    
    // Prépare la question suivante
    prepareNextQuizQuestion();
}

window.showQuizFinalRecap = function() {
    showScreen('screen-quiz-recap');
    
    // Conversion sécurisée de l'objet Firebase en tableau avant le tri
    let playersArray = Array.isArray(state.players) ? state.players : Object.values(state.players || {});
    let sorted = playersArray.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    const lbContainer = document.getElementById('quiz-final-leaderboard');
    if (lbContainer) {
        lbContainer.innerHTML = sorted.map((p, i) => `
            <div class="flex justify-between items-center p-3 rounded-2xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-900 border border-slate-800'} text-xs">
                <span class="font-bold">#${i + 1} - ${p.name || p.pseudo}</span>
                <span class="font-mono text-emerald-400 font-bold text-sm">${p.score} pts</span>
            </div>
        `).join('');
    }

    const historyContainer = document.getElementById('quiz-history-table');
    if (historyContainer) {
        if (state.quizGame.answersLog && state.quizGame.answersLog.length > 0) {
            historyContainer.innerHTML = state.quizGame.answersLog.map((log, idx) => {
                const badgeClass = log.isCorrect 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/30 text-red-400";
                const icon = log.isCorrect 
                    ? '<i class="fa-solid fa-check"></i>' 
                    : '<i class="fa-solid fa-xmark"></i>';
                
                return `
                    <div class="p-4 rounded-xl border ${badgeClass} text-sm mb-2 shadow-sm">
                        <div class="font-bold text-slate-200 mb-2">Q${idx + 1}: ${log.question}</div>
                        <div class="flex justify-between items-center text-xs">
                            <span>Votre réponse : <strong class="text-white">${log.playerChoice}</strong></span>
                            <span class="font-bold">${icon} ${log.points} pts</span>
                        </div>
                        ${!log.isCorrect ? `<div class="text-xs text-emerald-300 mt-2 pt-2 border-t border-slate-700/50">Bonne réponse : ${log.correctAnswer}</div>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            historyContainer.innerHTML = `<div class="text-slate-400 text-xs italic text-center p-4">Aucun historique disponible.</div>`;
        }
    }

}

