// =====================================================================
//  MODE « RÉFÉRENCES » : une image, 35 références de jeux vidéo.
//  Cliquez sur une référence, nommez le jeu. 3 vies, une erreur = une vie perdue.
//  Chaque joueur joue en parallèle sur la même image ; l'hôte calcule le classement.
// =====================================================================

// ---- Images disponibles (ajoutez-en d'autres ici) ----
// rect = [x0, y0, x1, y1] en pixels de l'image d'origine (w x h).
// aliases = réponses acceptées (accents, majuscules, ponctuation et petites fautes ignorés).
const REFERENCES_SETS = [
    {
        id: 'gamers-vault',
        title: "Gamer's Vault",
        src: './images/guess-game1.png',
        w: 1942, h: 1080,
        refs: [
            { id: 1,  name: 'Halo',                 item: 'Figurine',        rect: [5, 0, 115, 172],      aliases: ['halo', 'halo infinite', 'halo reach', 'halo combat evolved', 'halo 3', 'master chief'] },
            { id: 2,  name: 'Portal',               item: 'Cube',            rect: [180, 85, 312, 202],   aliases: ['portal', 'portal 2', 'portal 1', 'aperture science'] },
            { id: 3,  name: 'Skyrim',               item: 'Casque',          rect: [355, 320, 476, 492],  aliases: ['skyrim', 'the elder scrolls skyrim', 'the elder scrolls v skyrim', 'elder scrolls v skyrim', 'elder scrolls 5', 'the elder scrolls 5 skyrim', 'elder scrolls'] },
            { id: 4,  name: 'Journey',              item: 'Écharpe',         rect: [265, 195, 395, 665],  aliases: ['journey', 'journey thatgamecompany'] },
            { id: 5,  name: 'Overwatch',            item: 'Logo',            rect: [405, 650, 470, 720],  aliases: ['overwatch', 'overwatch 2', 'ow', 'ow2'] },
            { id: 6,  name: 'Horizon Zero Dawn',    item: 'Aloy (figurine)', rect: [395, 555, 462, 652],  aliases: ['horizon zero dawn', 'horizon', 'horizon forbidden west', 'horizon zero', 'horizon call of the mountain'] },
            { id: 7,  name: 'Dark Souls',           item: 'Affiche',         rect: [512, 250, 586, 442],  aliases: ['dark souls', 'darksouls', 'dark souls 1', 'dark souls 2', 'dark souls 3', 'dark souls remastered', 'souls'] },
            { id: 8,  name: 'God of War',           item: 'Poster',          rect: [545, 0, 648, 300],    aliases: ['god of war', 'god of war ragnarok', 'god of war 2018', 'gow', 'kratos'] },
            { id: 9,  name: 'Super Mario Bros.',    item: 'Champignon',      rect: [632, 322, 708, 408],  aliases: ['mario bros', 'super mario bros', 'super mario', 'mario', 'super mario bros 3', 'super mario world', 'super mario 64', 'super mario odyssey', 'new super mario bros', 'mario kart'] },
            { id: 10, name: 'Fallout',              item: 'Figurine',        rect: [825, 528, 873, 650],  aliases: ['fallout', 'fallout 3', 'fallout 4', 'fallout new vegas', 'fallout 76', 'fallout shelter', 'vault boy'] },
            { id: 11, name: 'Final Fantasy VII',    item: 'Épée',            rect: [515, 675, 586, 895],  aliases: ['final fantasy', 'final fantasy 7', 'final fantasy vii', 'ff7', 'ffvii', 'ff 7', 'ff', 'final fantasy 7 remake', 'final fantasy vii remake', 'final fantasy vii rebirth', 'final fantasy 7 rebirth', 'final fantasy vii crisis core', 'crisis core'] },
            { id: 12, name: 'Elden Ring',           item: 'Poster',          rect: [680, 778, 820, 990],  aliases: ['elden ring', 'eldenring', 'elden ring shadow of the erdtree', 'elden ring nightreign'] },
            { id: 13, name: 'Persona 5',            item: 'Masque de Joker', rect: [758, 745, 882, 832],  aliases: ['persona', 'persona 5', 'persona 5 royal', 'persona 5 strikers', 'persona 5 tactica', 'persona5', 'p5', 'p5r', 'persona 4', 'persona 3'] },
            { id: 14, name: 'The Last of Us',       item: 'Poster',          rect: [905, 805, 1068, 1056],aliases: ['the last of us', 'last of us', 'tlou', 'the last of us 2', 'the last of us part ii', 'the last of us part 2', 'last of us 2', 'tlou2', 'tlou 2', 'the last of us part i', 'the last of us part 1'] },
            { id: 15, name: 'Sonic',                item: 'Anneau doré',     rect: [1046, 984, 1104, 1034], aliases: ['sonic', 'sonic the hedgehog', 'sonic mania', 'sonic frontiers', 'sonic adventure', 'sonic generations', 'sonic 2', 'sonic the hedgehog 2', 'sonic superstars'] },
            { id: 16, name: 'Among Us',             item: 'Porte-clés',      rect: [1160, 826, 1216, 906],aliases: ['among us', 'amongus', 'among'] },
            { id: 17, name: 'Red Dead Redemption',  item: 'Poster',          rect: [1130, 905, 1252, 1076],aliases: ['red dead redemption', 'red dead redemption 2', 'red dead redemption ii', 'rdr', 'rdr2', 'rdr 2', 'red dead', 'red dead 2', 'red dead online', 'arthur morgan'] },
            { id: 18, name: 'Animal Crossing',      item: 'Feuille',         rect: [1245, 920, 1492, 1062],aliases: ['animal crossing', 'animal crossing new horizons', 'acnh', 'animal crossing new leaf', 'animal crossing pocket camp', 'animalcrossing'] },
            { id: 19, name: 'Minecraft',            item: 'Poster',          rect: [1340, 765, 1512, 925],aliases: ['minecraft', 'mine craft', 'minecraft java', 'minecraft bedrock', 'mc'] },
            { id: 20, name: 'Pac-Man',              item: 'Logo',            rect: [1195, 598, 1268, 680],aliases: ['pacman', 'pac man', 'pac-man', 'ms pacman', 'ms pac man', 'pac-man world', 'pacman championship edition'] },
            { id: 21, name: 'Celeste',              item: 'Fraise',          rect: [1890, 190, 1942, 298],aliases: ['celeste', 'celeste madeline'] },
            { id: 22, name: 'Hollow Knight',        item: 'Figurine',        rect: [1775, 115, 1886, 296],aliases: ['hollow knight', 'hollowknight', 'hollow knight silksong', 'silksong', 'hk'] },
            { id: 23, name: 'Tunic',                item: 'Figurine (renard)', rect: [1635, 700, 1730, 832], aliases: ['tunic', 'tunic game'] },
            { id: 24, name: 'Xenoblade Chronicles', item: 'Épée (Monado)',  rect: [1800, 470, 1858, 826], aliases: ['xenoblade chronicles', 'xenoblade', 'xenoblade chronicle', 'xenoblade chronicles 3', 'xenoblade chronicles 2', 'xenoblade chronicles 1', 'xenoblade 1', 'xenoblade 2', 'xenoblade 3', 'xenoblade chronicles definitive edition', 'xeno blade'] },
            { id: 25, name: 'Cyberpunk 2077',       item: 'Veste',           rect: [1295, 425, 1492, 646],aliases: ['cyberpunk 2077', 'cyberpunk', 'cyberpunk 2077 phantom liberty', 'cp2077', 'cyberpunk2077'] },
            { id: 26, name: 'Resident Evil',        item: 'Machine à écrire',rect: [940, 462, 1032, 582], aliases: ['resident evil', 'residentevil', 'biohazard', 're', 're2', 're4', 'resident evil 2', 'resident evil 4', 'resident evil 7', 'resident evil village', 'resident evil 3', 'resident evil remake', 'resident evil 1'] },
            { id: 27, name: 'Metal Gear Solid',     item: 'Boîte en carton', rect: [485, 940, 722, 1080], aliases: ['metal gear solid', 'metal gear', 'mgs', 'metal gear solid 3', 'mgs3', 'metal gear solid 2', 'metal gear solid 5', 'mgsv', 'mgs5', 'metal gear solid v', 'metal gear rising', 'metalgear'] },
            { id: 28, name: "Baldur's Gate",        item: 'Dé D20',          rect: [1065, 795, 1170, 910],aliases: ["baldur's gate", 'baldurs gate', "baldur's gate 3", 'baldurs gate 3', 'bg3', 'baldurs gate iii', "baldur's gate iii", 'baldur gate', 'baldur gate 3', 'baldurgate', 'baldurs gate 2', "baldur's gate 2"] },
            { id: 29, name: 'Mega Man',             item: 'Arme (Buster)',   rect: [1650, 392, 1816, 522],aliases: ['mega man', 'megaman', 'mega man x', 'megaman x', 'mega man 11', 'mega man 2', 'rockman', 'mega man battle network', 'megaman 2', 'mega man zero'] },
            { id: 30, name: 'Overcooked',           item: 'Toque de chef',   rect: [490, 888, 598, 998],  aliases: ['overcooked', 'overcooked 2', 'over cooked', 'overcooked all you can eat'] },
            { id: 31, name: 'Stardew Valley',       item: 'Poulet',          rect: [375, 132, 475, 252],  aliases: ['stardew valley', 'stardew', 'stardewvalley', 'stardew val'] },
            { id: 32, name: 'BioShock',             item: 'Casquette « Would you kindly »', rect: [1392, 588, 1536, 692], aliases: ['bioshock', 'bio shock', 'bioshock infinite', 'bioshock 2', 'bioshock remastered'] },
            { id: 33, name: 'Doom',                 item: 'Téléviseur',      rect: [562, 418, 812, 668],  aliases: ['doom', 'doom eternal', 'doom 2016', 'doom 2', 'doom 64', 'doom the dark ages', 'the dark ages', 'doom guy'] },
            { id: 34, name: 'Amnesia',              item: 'Lanterne',        rect: [1220, 755, 1300, 925],aliases: ['amnesia', 'amnesia the dark descent', 'amnesia: the dark descent', 'amnesia the bunker', 'amnesia rebirth', 'amnesia a machine for pigs', 'amnesia dark descent', 'the dark descent'] },
            { id: 35, name: 'Diablo',               item: "Pierre d'âme",    rect: [200, 655, 300, 806],  aliases: ['diablo', 'diablo 2', 'diablo 3', 'diablo 4', 'diablo iv', 'diablo ii', 'diablo iii', 'diablo immortal', 'diablo ii resurrected', 'diablo 2 resurrected'] }
        ]
    }
];

const REFERENCES_LIVES = 3;
const REFERENCES_POINTS = 100;      // par référence trouvée
const REFERENCES_SPEED_MAX = 50;    // bonus de rapidité maximal par référence (décroît avec le temps)
const REFERENCES_FINISH_BONUS = 2;  // points par seconde restante si les 35 sont trouvées

// --------------------------- Utilitaires ---------------------------
function refEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function refNorm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
        .replace(/^(the|le|la|les|l)\s+/, '');
}

function refLev(a, b) {      // distance de Damerau-Levenshtein (les inversions de lettres comptent pour 1 faute)
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = [];
    for (let i = 0; i <= m; i++) { d.push(new Array(n + 1).fill(0)); d[i][0] = i; }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const c = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[m][n];
}

// Vrai si la réponse correspond (à une petite faute près) à l'un des noms acceptés
window.referencesAnswerMatches = function(guess, ref) {
    const g = refNorm(guess).replace(/ /g, '');
    if (g.length < 2) return false;
    return ref.aliases.concat([ref.name]).some(a => {
        const n = refNorm(a).replace(/ /g, '');
        if (!n) return false;
        if (g === n) return true;
        const tol = n.length >= 10 ? 2 : (n.length >= 5 ? 1 : 0);
        return tol > 0 && Math.abs(g.length - n.length) <= tol && refLev(g, n) <= tol;
    });
};

// Référence touchée par un clic (coordonnées en pixels de l'image d'origine) ; la plus petite zone gagne
window.referencesHitTest = function(set, x, y) {
    const pad = 6;
    let best = null, bestArea = Infinity;
    set.refs.forEach(r => {
        const [x0, y0, x1, y1] = r.rect;
        if (x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad) {
            const area = (x1 - x0) * (y1 - y0);
            if (area < bestArea) { best = r; bestArea = area; }
        }
    });
    return best;
};

function refGetSet(id) {
    return REFERENCES_SETS.find(s => s.id === id) || REFERENCES_SETS[0];
}

function refFmtTime(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// --------------------------- Lancement (hôte) ---------------------------
window.startReferencesGame = function() {
    if (!window.isHost) return;
    const code = window.currentCodeSalon || state.roomCode;
    if (!code || !window.mettreAJourSalonFirebase) return;

    const timer = Math.max(60, Math.min(600, parseInt(document.getElementById('input-host-timer')?.value, 10) || 240));
    const set = REFERENCES_SETS[Math.floor(Math.random() * REFERENCES_SETS.length)];

    const updates = {
        status: 'IN_GAME',
        selectedMode: 'references',
        'settings/timer': timer,
        referencesGame: { status: 'PLAYING', setId: set.id, timer: timer, lives: REFERENCES_LIVES, startedAt: Date.now() }
    };
    Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
    window.mettreAJourSalonFirebase(code, updates);
};

// --------------------------- Rendu (appelé à chaque mise à jour Firebase) ---------------------------
window.renderReferencesScreen = function(data) {
    const g = data && data.referencesGame;
    if (!g) return;
    window.latestReferencesData = data;
    const sess = String(g.startedAt || 'references');

    if (g.status === 'FINISHED') {
        if (window.referencesShownResults !== sess) {
            window.referencesShownResults = sess;
            const rs = window.referencesState;
            if (rs) { rs.finished = true; clearInterval(rs.timerInterval); }
            const set = refGetSet(g.setId);
            const progress = g.progress || {};
            const ranking = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot)
                .sort((a, b) => (b.score || 0) - (a.score || 0));
            const lb = document.getElementById('final-leaderboard');
            if (lb) {
                lb.innerHTML = ranking.map((p, i) => {
                    const pr = progress[p.name] || {};
                    return `
                    <div class="flex justify-between items-center p-3 rounded-2xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-900 border border-slate-800'} text-xs">
                        <span class="font-bold">#${i + 1} - ${refEsc(p.name)} <span class="text-slate-400 font-normal">(${pr.found || 0}/${set.refs.length} références)</span></span>
                        <span class="font-mono text-emerald-400 font-bold text-sm">${p.score || 0} pts</span>
                    </div>`;
                }).join('');
            }
            showScreen('screen-results');
        }
        return;
    }

    // Démarre la partie une seule fois par session
    if (window.referencesSession !== sess) {
        window.referencesSession = sess;
        window.startReferencesMode(g);
    }
    referencesUpdateHud(data);
    if (window.isHost) referencesHostAdvance(data);
};

function referencesUpdateHud(data) {
    const el = document.getElementById('ref-players');
    const g = data && data.referencesGame;
    if (!el || !g) return;
    const set = refGetSet(g.setId);
    const progress = g.progress || {};
    el.innerHTML = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot).map(p => {
        const pr = progress[p.name] || {};
        const lives = pr.lives == null ? REFERENCES_LIVES : pr.lives;
        const hearts = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, REFERENCES_LIVES - lives));
        return `<span class="px-2 py-1 rounded-lg border ${pr.done ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-700 text-slate-300'} bg-slate-900/70">
            ${refEsc(p.name)} : ${pr.found || 0}/${set.refs.length} ${hearts} ${pr.done ? '✓' : ''}</span>`;
    }).join('');
}

// Hôte : quand tout le monde a fini (ou que le temps est largement dépassé), enregistre les scores
function referencesHostAdvance(data) {
    const g = data.referencesGame;
    if (!window.isHost || !g || g.status !== 'PLAYING') return;
    const present = Object.values(data.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const progress = g.progress || {};
    const allDone = present.length && present.every(n => progress[n] && progress[n].done);
    const overtime = g.startedAt && (Date.now() > g.startedAt + (Number(g.timer) || 240) * 1000 + 20000);
    if (!allDone && !overtime) return;

    const key = 'fin:' + g.startedAt;
    if (window.referencesLock === key) return;
    window.referencesLock = key;

    const updates = { 'referencesGame/status': 'FINISHED' };
    present.forEach(n => { updates[`players/${n}/score`] = (progress[n] && progress[n].score) || 0; });
    window.update(window.ref(window.db, `salons/${window.currentCodeSalon}`), updates)
        .catch(err => { window.referencesLock = null; console.error('Fin de partie Références impossible :', err); });
}

// --------------------------- Partie côté joueur ---------------------------
window.startReferencesMode = function(cfg) {
    cfg = cfg || {};
    showScreen('screen-generic-game');
    document.getElementById('generic-game-title').innerText = 'Références Gaming';

    if (window.referencesState) clearInterval(window.referencesState.timerInterval);
    const set = refGetSet(cfg.setId);
    const rs = window.referencesState = {
        set: set,
        lives: Number(cfg.lives) || REFERENCES_LIVES,
        found: {},            // id -> true
        order: [],            // ids trouvés dans l'ordre
        score: 0,
        wrong: 0,
        timeLeft: Number(cfg.timer) || 240,
        total: Number(cfg.timer) || 240,
        timerInterval: null,
        finished: false,
        selected: null,       // référence en cours de nommage
        zoom: 1
    };

    const content = document.getElementById('generic-game-content');
    if (!content) return;
    content.innerHTML = `
        <div class="w-full max-w-6xl mx-auto space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div id="ref-lives" class="text-lg tracking-widest"></div>
                <div class="text-slate-300">Trouvées : <b id="ref-found" class="text-emerald-400">0</b> / ${set.refs.length}</div>
                <div class="text-slate-300">Score : <b id="ref-score" class="text-amber-400">0</b></div>
                <div class="flex gap-1">
                    <button id="ref-zoom-out" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600" title="Dézoomer">🔍−</button>
                    <button id="ref-zoom-in" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600" title="Zoomer">🔍+</button>
                </div>
            </div>
            <div class="text-[11px] text-slate-400 text-center">Cliquez sur une référence à un jeu vidéo, puis tapez le nom du jeu. Chaque erreur vous coûte une vie.</div>
            <div id="ref-scroll" class="relative w-full overflow-auto rounded-2xl border border-slate-700 bg-black" style="max-height:72vh">
                <div id="ref-stage" class="relative select-none" style="width:100%;cursor:crosshair">
                    <img id="ref-img" src="${refEsc(set.src)}" alt="Références" draggable="false" class="block w-full h-auto" style="user-select:none;-webkit-user-drag:none">
                    <div id="ref-marks" class="absolute inset-0" style="pointer-events:none"></div>
                </div>
            </div>
            <div id="ref-error" class="hidden p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs text-center"></div>
            <div id="ref-players" class="flex flex-wrap gap-2 justify-center text-[11px] font-mono"></div>
            <div id="ref-list" class="flex flex-wrap gap-1.5 justify-center text-[11px]"></div>
        </div>
        <div id="ref-prompt" class="hidden fixed left-1/2 bottom-4 z-50 w-[92vw] max-w-md -translate-x-1/2 p-3 rounded-2xl bg-slate-900 border border-indigo-400/60 shadow-2xl space-y-2">
            <div class="text-xs text-indigo-200 font-bold">De quel jeu vidéo s'agit-il ?</div>
            <div class="flex gap-2">
                <input id="ref-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60" placeholder="Nom du jeu..." class="flex-1 min-w-0 bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                <button id="ref-submit" class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Valider</button>
                <button id="ref-cancel" class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">✕</button>
            </div>
        </div>`;

    const stage = document.getElementById('ref-stage');
    const img = document.getElementById('ref-img');
    img.onerror = () => {
        const er = document.getElementById('ref-error');
        if (er) { er.classList.remove('hidden'); er.innerHTML = `⚠️ Image introuvable : <b>${refEsc(set.src)}</b>. Vérifiez qu'elle est bien dans votre dépôt GitHub.`; }
    };
    stage.addEventListener('click', e => referencesOnClick(e));
    document.getElementById('ref-zoom-in').onclick = () => referencesSetZoom(rs.zoom + 0.5);
    document.getElementById('ref-zoom-out').onclick = () => referencesSetZoom(rs.zoom - 0.5);
    document.getElementById('ref-submit').onclick = () => referencesSubmit();
    document.getElementById('ref-cancel').onclick = () => referencesClosePrompt();
    const input = document.getElementById('ref-input');
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') referencesSubmit();
        else if (e.key === 'Escape') referencesClosePrompt();
    });
    input.addEventListener('keyup', e => e.stopPropagation());

    referencesRefresh();
    referencesRenderMarks();

    rs.timerInterval = setInterval(() => {
        if (rs.finished) { clearInterval(rs.timerInterval); return; }
        if (!document.getElementById('ref-stage')) { clearInterval(rs.timerInterval); return; }
        rs.timeLeft--;
        referencesRefresh();
        if (rs.timeLeft <= 0) referencesFinish('time');
    }, 1000);

    referencesPushProgress(false);
};

function referencesSetZoom(z) {
    const rs = window.referencesState; if (!rs) return;
    rs.zoom = Math.max(1, Math.min(4, z));
    const stage = document.getElementById('ref-stage');
    if (stage) stage.style.width = (rs.zoom * 100) + '%';
}

function referencesRefresh() {
    const rs = window.referencesState; if (!rs) return;
    const lives = document.getElementById('ref-lives');
    if (lives) lives.innerHTML = '❤️'.repeat(Math.max(0, rs.lives)) + '🖤'.repeat(Math.max(0, REFERENCES_LIVES - rs.lives));
    const f = document.getElementById('ref-found'); if (f) f.innerText = rs.order.length;
    const sc = document.getElementById('ref-score'); if (sc) sc.innerText = rs.score;
    const t = document.getElementById('generic-game-timer');
    if (t) t.innerText = rs.finished ? 'Terminé' : refFmtTime(rs.timeLeft);
}

function referencesRenderMarks() {
    const rs = window.referencesState; if (!rs) return;
    const marks = document.getElementById('ref-marks');
    if (marks) {
        const W = rs.set.w, H = rs.set.h;
        const debug = /[?&]refdebug=1/.test(location.search);
        marks.innerHTML = rs.set.refs.map(r => {
            const found = !!rs.found[r.id];
            if (!found && !debug) return '';
            const [x0, y0, x1, y1] = r.rect;
            const style = `left:${x0 / W * 100}%;top:${y0 / H * 100}%;width:${(x1 - x0) / W * 100}%;height:${(y1 - y0) / H * 100}%`;
            return `<div style="position:absolute;${style};border:2px solid ${found ? '#34d399' : '#f59e0b'};border-radius:10px;background:${found ? 'rgba(52,211,153,.18)' : 'rgba(245,158,11,.1)'};box-shadow:0 0 10px ${found ? '#34d399' : '#f59e0b'}">
                <span style="position:absolute;left:50%;top:100%;transform:translate(-50%,2px);white-space:nowrap;font:bold 11px sans-serif;color:#052e16;background:${found ? '#6ee7b7' : '#fbbf24'};padding:1px 6px;border-radius:6px">${found ? refEsc(r.name) : '#' + r.id + ' ' + refEsc(r.name)}</span>
            </div>`;
        }).join('');
    }
    const list = document.getElementById('ref-list');
    if (list) {
        list.innerHTML = rs.order.map(id => {
            const r = rs.set.refs.find(x => x.id === id);
            return r ? `<span class="px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-500/40 text-emerald-200">✓ ${refEsc(r.name)}</span>` : '';
        }).join('');
    }
}

function referencesOnClick(e) {
    const rs = window.referencesState;
    if (!rs || rs.finished) return;
    const img = document.getElementById('ref-img');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * rs.set.w;
    const y = (e.clientY - rect.top) / rect.height * rs.set.h;
    const hit = window.referencesHitTest(rs.set, x, y);
    if (!hit) { referencesClosePrompt(); return; }
    if (rs.found[hit.id]) { referencesToast(`✓ Déjà trouvé : ${hit.name}`, '#34d399'); return; }
    rs.selected = hit;
    const p = document.getElementById('ref-prompt');
    const input = document.getElementById('ref-input');
    if (p) p.classList.remove('hidden');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 30); }
    // anneau à l'endroit du clic (sans révéler la zone exacte)
    const marks = document.getElementById('ref-marks');
    if (marks) {
        let ring = document.getElementById('ref-ring');
        if (!ring) { ring = document.createElement('div'); ring.id = 'ref-ring'; marks.appendChild(ring); }
        ring.style.cssText = `position:absolute;left:${x / rs.set.w * 100}%;top:${y / rs.set.h * 100}%;width:34px;height:34px;margin:-17px 0 0 -17px;border:3px solid #818cf8;border-radius:50%;box-shadow:0 0 12px #818cf8;pointer-events:none`;
    }
}

function referencesClosePrompt() {
    const rs = window.referencesState; if (rs) rs.selected = null;
    const p = document.getElementById('ref-prompt'); if (p) p.classList.add('hidden');
    const ring = document.getElementById('ref-ring'); if (ring) ring.remove();
}

function referencesToast(text, color) {
    const t = document.getElementById('generic-game-timer');
    const old = document.getElementById('ref-toast'); if (old) old.remove();
    const d = document.createElement('div');
    d.id = 'ref-toast';
    d.textContent = text;
    d.style.cssText = `position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:60;padding:8px 16px;border-radius:12px;font:bold 14px sans-serif;color:#fff;background:${color};box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none`;
    document.body.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1600);
}

function referencesSubmit() {
    const rs = window.referencesState;
    if (!rs || rs.finished || !rs.selected) return;
    const input = document.getElementById('ref-input');
    const guess = input ? input.value.trim() : '';
    if (!guess) return;
    const ref = rs.selected;

    if (window.referencesAnswerMatches(guess, ref)) {
        const speed = Math.round(REFERENCES_SPEED_MAX * Math.max(0, rs.timeLeft) / rs.total);
        rs.found[ref.id] = true;
        rs.order.push(ref.id);
        rs.score += REFERENCES_POINTS + speed;
        referencesClosePrompt();
        referencesToast(`✅ ${ref.name} ! +${REFERENCES_POINTS + speed}`, '#059669');
        referencesRenderMarks();
        referencesRefresh();
        if (rs.order.length >= rs.set.refs.length) { referencesFinish('all'); return; }
        referencesPushProgress(false);
    } else {
        rs.lives--;
        rs.wrong++;
        referencesClosePrompt();
        referencesToast(rs.lives > 0 ? '❌ Mauvaise réponse ! −1 vie' : '💀 Plus de vies !', '#dc2626');
        const sc = document.getElementById('ref-scroll');
        if (sc) { sc.style.boxShadow = '0 0 0 3px #ef4444'; setTimeout(() => { sc.style.boxShadow = ''; }, 350); }
        referencesRefresh();
        if (rs.lives <= 0) { referencesFinish('lives'); return; }
        referencesPushProgress(false);
    }
}

function referencesFinish(reason) {
    const rs = window.referencesState;
    if (!rs || rs.finished) return;
    rs.finished = true;
    clearInterval(rs.timerInterval);
    referencesClosePrompt();
    if (reason === 'all') rs.score += Math.max(0, rs.timeLeft) * REFERENCES_FINISH_BONUS;
    referencesPushProgress(true);

    const missed = rs.set.refs.filter(r => !rs.found[r.id]);
    const why = reason === 'all' ? '🎉 Toutes les références trouvées !' : reason === 'lives' ? '💀 Plus de vies' : "⏰ Temps écoulé";
    const content = document.getElementById('generic-game-content');
    if (content) {
        content.innerHTML = `
            <div class="max-w-2xl mx-auto p-6 bg-slate-900 border border-slate-700 rounded-2xl text-center space-y-3">
                <div class="text-2xl font-black text-emerald-400">${why}</div>
                <div class="text-sm text-slate-300">Références trouvées : <b class="text-amber-400">${rs.order.length} / ${rs.set.refs.length}</b> · Score : <b class="text-amber-400">${rs.score}</b></div>
                ${missed.length ? `<div class="text-[11px] text-slate-400 text-left border-t border-slate-700 pt-3">
                    <div class="font-bold text-slate-300 mb-1">Références manquées :</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">${missed.map(r => `<div>#${r.id} <b class="text-slate-200">${refEsc(r.name)}</b> — ${refEsc(r.item)}</div>`).join('')}</div>
                </div>` : ''}
                <div class="text-amber-400 animate-pulse text-sm"><i class="fa-solid fa-hourglass-half"></i> En attente des autres joueurs...</div>
                <div id="ref-players" class="flex flex-wrap gap-2 justify-center text-[11px] font-mono"></div>
            </div>`;
        if (window.latestReferencesData) referencesUpdateHud(window.latestReferencesData);
    }
    const t = document.getElementById('generic-game-timer'); if (t) t.innerText = 'Terminé';
}

function referencesPushProgress(done) {
    const code = window.currentCodeSalon || state.roomCode;
    const me = window.myPlayerKey || state.username;
    const rs = window.referencesState;
    if (!code || !me || !rs || !window.update) return;
    window.update(window.ref(window.db, `salons/${code}`), {
        [`referencesGame/progress/${me}`]: { found: rs.order.length, lives: Math.max(0, rs.lives), score: rs.score, done: !!done }
    }).catch(err => console.error('Progression Références non envoyée :', err));
}
window.referencesPushProgress = referencesPushProgress;
