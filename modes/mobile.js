// =====================================================================
//  VERSION TÉLÉPHONE DU SALON (écrans de moins de 768 px de large)
//  Le salon devient une petite application à quatre onglets :
//      🎮 Jeux    : les jeux en tuiles (remplace la bibliothèque en liste)
//      🚀 Mission : le jeu choisi, ses règles et ses réglages
//      👥 Équipe  : les joueurs connectés
//      💬 Chat    : la discussion
//  Une barre d'action fixe garde « Prêt » (et « Lancer » pour l'hôte) sous le pouce.
//  Rien n'est recréé : les blocs existants du salon sont simplement montrés ou
//  masqués selon l'onglet. Sur ordinateur, ce fichier ne change rien.
// =====================================================================
// Jeux qui ne fonctionnent pas sur téléphone : ils n'apparaissent pas dans les tuiles
const MOB_EXCLUS = { anomaly: true };
const MOB = { q: null, tab: 'jeux', built: false, deployHome: null, filter: '', unread: false };

const MOB_CSS = `
body.mob { padding: 0 !important; }
body.mob #screen-lobby { border: 0 !important; box-shadow: none !important; background: transparent !important; padding: 0 0 9.6rem 0 !important; height: auto !important; min-height: 100dvh; backdrop-filter: none; display: block; }
body.mob #screen-lobby > .absolute { display: none; }
/* ----- en-tête compact ----- */
body.mob #screen-lobby > header { position: sticky; top: 0; z-index: 30; display: flex; flex-direction: row; align-items: center; margin: 0 0 .6rem 0; padding: .5rem 3rem .5rem .6rem; background: rgba(4,10,22,.96); border-bottom: 1px solid rgba(0,210,255,.35); backdrop-filter: blur(8px); }
body.mob #screen-lobby > header > div:first-child { display: none; }
body.mob #screen-lobby > header > div:last-child { gap: .4rem; flex-wrap: nowrap; overflow-x: auto; width: 100%; scrollbar-width: none; }
body.mob #screen-lobby > header > div:last-child > * { flex-shrink: 0; padding: .35rem .6rem; border-radius: 999px; font-size: .72rem; }
body.mob #screen-lobby > header > div:last-child > div:last-child { display: none; }
body.mob.mob-lobby #sys-son { top: .45rem !important; right: .45rem !important; left: auto !important; bottom: auto !important; width: 2.1rem !important; height: 2.1rem !important; z-index: 35 !important; }
body.mob #toast { top: 3.4rem; right: .6rem; left: .6rem; max-width: none; }
body.mob #toast.translate-x-full { visibility: hidden; }
/* ----- un seul bloc visible à la fois ----- */
body.mob #screen-lobby > section, body.mob #screen-lobby > .grid { display: block !important; margin: 0 !important; overflow: visible !important; flex: none !important; }
body.mob [data-mob] { display: none !important; }
body.mob #mob-games { display: none; }
body.mob[data-mtab="jeux"] #mob-games { display: block; }
body.mob[data-mtab="mission"] [data-mob="proto"], body.mob[data-mtab="mission"] [data-mob="settings"],
body.mob[data-mtab="equipe"] [data-mob="team"], body.mob[data-mtab="chat"] [data-mob="chat"] { display: flex !important; }
body.mob [data-mob] { margin: 0 .6rem .7rem .6rem; border-radius: 16px !important; min-height: 0 !important; height: auto !important; }
/* ----- onglet Mission ----- */
body.mob [data-mob="proto"] .aspect-video { display: none; }
body.mob [data-mob="proto"] .perspective-grid { display: none; }
body.mob [data-mob="proto"] > div.justify-between { display: none; }
body.mob [data-mob="proto"] .flex-wrap.border-t { display: none; }
body.mob #active-protocol-title { font-size: 1.35rem; }
body.mob #active-protocol-desc { font-size: .9rem; min-height: 0; }
body.mob #protocol-rules-list { font-size: .82rem; }
body.mob [data-mob="settings"] { min-height: 12rem !important; }
body.mob [data-mob="settings"] .text-\\[11px\\], body.mob [data-mob="settings"] .text-xs { font-size: .85rem; }
body.mob [data-mob="settings"] input[type="number"], body.mob [data-mob="settings"] select { padding: .6rem .7rem; border-radius: 10px; font-size: 16px; }
body.mob [data-mob="settings"] input[type="range"] { height: 1.6rem; }
body.mob [data-mob="settings"] button[onclick="launchGame()"] { display: none; }
body.mob #quiz-categories-checklist { max-height: 18rem; font-size: .9rem; }
/* ----- onglet Équipe ----- */
body.mob #operators-grid { grid-template-columns: repeat(2, 1fr) !important; grid-template-rows: none !important; grid-auto-rows: 9.5rem; gap: .6rem; min-height: 0; }
body.mob #operators-grid > div { border-radius: 12px; }
body.mob #operators-grid .text-\\[8px\\] { font-size: .8rem; border-radius: 8px; }
/* ----- onglet Chat ----- */
body.mob[data-mtab="chat"] [data-mob="chat"] { height: calc(100dvh - 13.6rem) !important; }
body.mob #chat-messages { font-size: .9rem; border-radius: 12px; padding: .7rem; }
body.mob #chat-input { font-size: 16px; padding: .65rem .8rem; border-radius: 12px 0 0 12px; }
body.mob [data-mob="chat"] button[onclick="sendChatMessage()"] { border-radius: 0 12px 12px 0; padding: 0 1rem; }
/* ----- tuiles des jeux ----- */
#mob-games { display: none; padding: 0 .6rem; }      /* jamais affiché sur ordinateur */
.mob-h { font-family: 'Orbitron', sans-serif; font-weight: 800; letter-spacing: .12em; font-size: .78rem; color: #7dd3fc; text-transform: uppercase; margin: 1rem .2rem .5rem; display: flex; align-items: center; gap: .5rem; }
.mob-h::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(0,210,255,.5), transparent); }
.mob-hero { border-radius: 18px; padding: 1rem; background: linear-gradient(135deg, rgba(0,210,255,.18), rgba(99,102,241,.2) 60%, rgba(4,10,22,.6)); border: 1px solid rgba(0,210,255,.45); color: #e2e8f0; }
.mob-search { width: 100%; box-sizing: border-box; margin-top: .7rem; padding: .7rem .9rem; border-radius: 12px; border: 1px solid rgba(0,210,255,.35); background: rgba(2,8,20,.8); color: #e0f2fe; font-size: 16px; outline: none; }
.mob-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .6rem; }
.mob-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: .15rem; padding: .8rem .75rem; min-height: 6.6rem; border-radius: 16px; border: 1px solid rgba(148,163,184,.28); background: linear-gradient(160deg, rgba(15,30,55,.95), rgba(4,10,22,.95)); color: #e2e8f0; text-align: left; cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; }
.mob-tile:active { transform: scale(.97); }
.mob-tile .ic { font-size: 1.9rem; line-height: 1; }
.mob-tile .nm { font-weight: 800; font-size: .95rem; color: #f8fafc; line-height: 1.15; margin-top: .25rem; }
.mob-tile .mt { font-size: .68rem; color: #94a3b8; }
.mob-tile-on { border-color: #34d399; box-shadow: 0 0 18px -3px #34d399; background: linear-gradient(160deg, rgba(6,78,59,.75), rgba(4,10,22,.95)); }
.mob-tile-on::after { content: "✓"; position: absolute; top: .5rem; right: .6rem; width: 1.4rem; height: 1.4rem; border-radius: 50%; background: #34d399; color: #022c22; font-weight: 900; font-size: .85rem; display: flex; align-items: center; justify-content: center; }
.mob-tile-lock { opacity: .78; }
/* ----- barre d'action et onglets ----- */
#mob-action, #mob-tabs { display: none; }
body.mob.mob-lobby #mob-action { display: flex; position: fixed; left: 0; right: 0; bottom: 3.9rem; z-index: 40; gap: .5rem; align-items: stretch; padding: .5rem .6rem; background: rgba(4,10,22,.97); border-top: 1px solid rgba(0,210,255,.35); backdrop-filter: blur(8px); }
#mob-action .game { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: .5rem; padding: .3rem .6rem; border-radius: 12px; border: 1px solid rgba(148,163,184,.3); background: rgba(15,30,55,.8); color: #e2e8f0; font-family: inherit; text-align: left; cursor: pointer; }
#mob-action .game b { display: block; font-size: .8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc; }
#mob-action .game small { display: block; font-size: .62rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#mob-action #deploy-btn { flex: 0 0 auto; width: auto !important; margin: 0 !important; padding: 0 .9rem !important; min-height: 2.9rem; border-radius: 12px !important; font-size: 0 !important; letter-spacing: .06em !important; }
#mob-action #deploy-btn::after { content: "PRÊT ?"; font-size: .8rem; }
#mob-action #deploy-btn.bg-emerald-500::after { content: "✓ PRÊT"; }
#mob-launch { flex: 0 0 auto; padding: 0 .9rem; min-height: 2.9rem; border-radius: 12px; border: 0; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: .8rem; letter-spacing: .06em; cursor: pointer; box-shadow: 0 0 16px rgba(245,158,11,.5); }
body.mob.mob-lobby #mob-tabs { display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; height: 3.9rem; padding-bottom: env(safe-area-inset-bottom); background: #030915; border-top: 1px solid rgba(0,210,255,.25); }
#mob-tabs button { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .1rem; border: 0; background: transparent; color: #64748b; font-family: inherit; font-size: .66rem; letter-spacing: .06em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#mob-tabs button .ic { font-size: 1.35rem; line-height: 1; filter: grayscale(1) opacity(.6); transition: transform .15s; }
#mob-tabs button.on { color: #67e8f9; }
#mob-tabs button.on .ic { filter: none; transform: translateY(-2px) scale(1.12); }
#mob-tabs button.on::before { content: ""; position: absolute; top: 0; left: 22%; right: 22%; height: 3px; border-radius: 0 0 4px 4px; background: #22d3ee; box-shadow: 0 0 10px #22d3ee; }
#mob-tabs .badge { position: absolute; top: .45rem; left: 56%; min-width: 1.05rem; height: 1.05rem; padding: 0 .25rem; border-radius: 999px; background: #0e7490; color: #ecfeff; font-size: .6rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }
#mob-tabs .badge.alert { background: #f43f5e; }
/* ----- écran de connexion ----- */
body.mob #screen-home { padding: 1rem .8rem; }
body.mob #screen-home > div { padding: 1.4rem 1.1rem; border-radius: 22px; }
/* ===================== ÉCRANS DE JEU D'ORIGINE SUR TÉLÉPHONE ===================== */
/* champs de saisie : 16 px minimum, sinon l'iPhone zoome dans la page à chaque saisie */
body.mob main input[type="text"], body.mob main input[type="number"], body.mob main input:not([type]), body.mob main textarea, body.mob main select { font-size: 16px !important; }
/* place réservée en bas pour les boutons Son / Pause, qui ne recouvrent plus le dernier élément */
body.mob main[id^="screen-"]:not(#screen-home) { padding-bottom: 4.2rem !important; }
body.mob:not(.mob-lobby) #sys-son, body.mob:not(.mob-lobby) #sys-menu { opacity: .82; }
/* ----- Quiz ----- */
body.mob #screen-quiz { padding: .6rem !important; }
body.mob #screen-quiz-summary, body.mob #screen-quiz-recap, body.mob #screen-round-summary { padding-left: .4rem; padding-right: .4rem; }
/* ----- Cinématophile : l'affiche ne pousse plus le champ de réponse hors de l'écran ----- */
body.mob #screen-cine { padding-left: .6rem !important; padding-right: .6rem !important; gap: .5rem !important; }
body.mob #cine-canvas { height: 40dvh; width: auto; max-width: 100%; }
body.mob #cine-story-panel { padding: .7rem !important; max-height: 22dvh; font-size: .8rem; }
body.mob #cine-input-area { position: sticky; bottom: 0; z-index: 5; padding: .4rem 0; background: linear-gradient(180deg, rgba(4,9,19,0), #040913 35%); }
body.mob #cine-input-area button { padding: .8rem 1rem; }
body.mob #cine-players-status-bar { gap: .3rem !important; font-size: .68rem; }
/* ----- Codenames : en-tête sur deux lignes, cartes plus hautes, saisie de l'indice sur toute la largeur ----- */
body.mob #screen-codenames { padding-left: .45rem !important; padding-right: .45rem !important; gap: .5rem !important; }
body.mob #screen-codenames > div:first-child { flex-wrap: wrap; padding: .5rem .7rem; gap: .3rem .6rem; }
body.mob #codenames-turn-indicator { white-space: nowrap; font-size: .9rem; }
body.mob #codenames-role-badge { order: 3; flex-basis: 100%; text-align: left; font-size: .75rem; }
body.mob #codenames-role-badge br { display: none; }
body.mob #codenames-clue-box { padding: .6rem; line-height: 1.7; }
body.mob #codenames-clue-box > .flex { gap: .4rem; }
body.mob #cn-clue-word { flex: 1; min-width: 0; padding: .6rem .7rem; border-radius: 10px; }
body.mob #cn-clue-count { width: 3.2rem; padding: .6rem .2rem; border-radius: 10px; }
body.mob #codenames-clue-box button { padding: .65rem .9rem; border-radius: 10px; font-size: .8rem; }
body.mob #codenames-clue-box button[onclick="passCodenamesTurn()"] { display: block; margin: .5rem auto 0; }
body.mob #codenames-grid { gap: .32rem !important; }
body.mob #codenames-grid > div { height: 4.5rem; padding: .15rem; font-size: .68rem; border-radius: 10px; overflow-wrap: anywhere; line-height: 1.15; }
/* composition des équipes dans le salon : étiquettes assez grandes pour le doigt */
body.mob #host-settings-codenames [draggable] { padding: .55rem .6rem; font-size: .85rem; border-radius: 10px; }
body.mob #host-settings-codenames button { padding: .45rem .7rem; font-size: .75rem; border-radius: 10px; }
body.mob #team-unassigned-container { gap: .4rem; }
/* ----- Petit Bac ----- */
body.mob #screen-petitsbac { padding: .5rem !important; }
body.mob #screen-petitsbac button { min-height: 2.3rem; }
body.mob #screen-petitsbac table { font-size: .72rem; }
/* ----- Imposteur ----- */
body.mob #screen-impostor { padding: .6rem !important; }
/* ----- GeoGuessr : vue plein écran, carte repliée qui s'agrandit d'un toucher ----- */
body.mob #screen-game-geoguessr { padding: .4rem .4rem 0 !important; }
body.mob #screen-game-geoguessr > * + * { margin-top: .4rem !important; }
body.mob #pano-container { height: calc(100dvh - 5.4rem); min-height: 0; }
body.mob #minimap-box, body.mob #minimap-box:hover { width: 46vw; height: 9.5rem; right: .5rem; bottom: .5rem; transition: width .2s, height .2s; }
body.mob #minimap-box.geo-grand, body.mob #minimap-box.geo-grand:hover { width: calc(100% - 1rem); height: 62%; }
body.mob #minimap-box button { padding: .55rem 0; font-size: .8rem; }
#geo-carte-btn { display: none; }
body.mob #geo-capsule { top: 3.6rem !important; max-width: 92% !important; width: max-content; font-size: 10px !important; }
body.mob #geo-carte-btn { display: flex; align-items: center; gap: .35rem; position: absolute; top: .75rem; right: .75rem; z-index: 21; padding: .5rem .75rem; border-radius: 12px; border: 1px solid rgba(34,211,238,.5); background: rgba(15,23,42,.92); color: #a5f3fc; font-weight: 700; font-size: .75rem; font-family: inherit; }
body.mob #screen-game-geoguessr button[onclick="returnToGeoSpawn()"] { padding: .5rem .7rem; }
body.mob #round-summary-map { height: 38dvh; }
/* ----- fenêtre « placer un joueur » (Codenames), utilisable aussi à la souris ----- */
`;

function mobEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Liste des jeux, lue dans la bibliothèque existante (catégorie, clé, nom, icône, description)
function mobGames() {
    const out = [];
    document.querySelectorAll('#protocols-list-container > div').forEach(cat => {
        const head = cat.querySelector(':scope > div');
        const title = head ? head.innerText.replace(/\[|\]|\(\d+\)/g, '').trim() : '';
        const items = [];
        cat.querySelectorAll('[id^="protocol-btn-"]').forEach(btn => {
            if (MOB_EXCLUS[btn.id.replace('protocol-btn-', '')]) return;      // jeu non proposé sur téléphone
            const m = (btn.getAttribute('onclick') || '').match(/selectProtocol\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'([^']*)'\)/);
            if (m) items.push({ key: m[4], name: m[1], icon: m[2], desc: m[3], el: btn, label: (btn.querySelector('span') || btn).innerText.trim() });
        });
        if (items.length) out.push({ title: title, items: items });
    });
    return out;
}
function mobSelected() {
    const key = (typeof state !== 'undefined' && state.selectedMode) || '';
    let found = null;
    mobGames().forEach(c => c.items.forEach(g => { if (g.key === key) found = g; }));
    return found;
}
function mobRenderGames() {
    const box = document.getElementById('mob-games-list');
    if (!box) return;
    const key = (typeof state !== 'undefined' && state.selectedMode) || '';
    const f = MOB.filter.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const data = (typeof protocolData !== 'undefined') ? protocolData : {};
    let html = '';
    mobGames().forEach(cat => {
        const items = cat.items.filter(g => !f || norm(g.name + ' ' + g.label + ' ' + g.desc).indexOf(f) >= 0);
        if (!items.length) return;
        html += `<div class="mob-h">${mobEsc(cat.title)}</div><div class="mob-grid">` + items.map(g => {
            const d = data[g.key] || {};
            return `<button class="mob-tile ${g.key === key ? 'mob-tile-on' : ''} ${window.isHost ? '' : 'mob-tile-lock'}" data-game="${mobEsc(g.key)}">
                <span class="ic">${g.icon}</span><span class="nm">${mobEsc(g.name)}</span>
                <span class="mt">${mobEsc((d.players || '').toLowerCase())}${d.duration ? ' · ' + mobEsc(d.duration.toLowerCase()) : ''}</span></button>`;
        }).join('') + '</div>';
    });
    box.innerHTML = html || '<div style="color:#94a3b8;text-align:center;padding:2rem 0">Aucun jeu ne correspond à cette recherche.</div>';
    const hero = document.getElementById('mob-hero-text');
    if (hero) hero.innerHTML = window.isHost
        ? '<b style="font-size:1.05rem;color:#f8fafc">Choisissez un jeu</b><br><span style="font-size:.8rem;color:#bae6fd">Touchez une tuile, réglez la partie dans l\'onglet Mission, puis lancez.</span>'
        : '<b style="font-size:1.05rem;color:#f8fafc">L\'hôte choisit le jeu</b><br><span style="font-size:.8rem;color:#bae6fd">Parcourez le catalogue en attendant, et touchez « Prêt » quand vous l\'êtes.</span>';
}
function mobRenderBars() {
    const sel = mobSelected();
    const g = document.getElementById('mob-action-game');
    if (g) g.innerHTML = sel
        ? `<span style="font-size:1.5rem;line-height:1">${sel.icon}</span><span style="min-width:0"><b>${mobEsc(sel.name)}</b><small>${window.isHost ? 'Régler la partie ›' : 'Voir les règles ›'}</small></span>`
        : `<span style="font-size:1.5rem;line-height:1">🎮</span><span style="min-width:0"><b>Aucun jeu choisi</b><small>${window.isHost ? 'Choisir un jeu ›' : "En attente de l'hôte"}</small></span>`;
    const launch = document.getElementById('mob-launch');
    if (launch) launch.style.display = window.isHost && sel ? '' : 'none';
    const players = Object.values((typeof state !== 'undefined' && state.players) || {}).filter(p => p && p.name);
    const ready = players.filter(p => p.isReady).length;
    const bt = document.getElementById('mob-badge-team');
    if (bt) { bt.textContent = ready + '/' + players.length; bt.className = 'badge' + (players.length && ready === players.length ? '' : ' alert'); bt.style.display = players.length ? '' : 'none'; }
    const bc = document.getElementById('mob-badge-chat');
    if (bc) bc.style.display = MOB.unread ? '' : 'none';
    document.querySelectorAll('#mob-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === MOB.tab));
}
function mobTab(tab) {
    MOB.tab = tab;
    document.body.setAttribute('data-mtab', tab);
    if (tab === 'chat') { MOB.unread = false; const box = document.getElementById('chat-messages'); if (box) box.scrollTop = box.scrollHeight; }
    window.scrollTo(0, 0);
    mobRenderBars();
}
// Appelé par systeme.js à chaque mise à jour du salon
function mobRefresh() {
    if (!MOB.built || !document.body.classList.contains('mob')) return;
    mobRenderGames();
    mobRenderBars();
}
function mobBuild() {
    if (MOB.built) return;
    const lobby = document.getElementById('screen-lobby');
    const lib = document.getElementById('protocols-list-container'), title = document.getElementById('active-protocol-title');
    const settings = document.getElementById('host-settings-container'), team = document.getElementById('operators-grid'), chat = document.getElementById('chat-input');
    if (!lobby || !lib || !title || !settings || !team || !chat) return;
    MOB.built = true;
    const st = document.createElement('style'); st.id = 'mob-style'; st.textContent = MOB_CSS; document.head.appendChild(st);
    // repérage des blocs existants du salon
    lib.closest('section > div').setAttribute('data-mob', 'lib');
    title.closest('section > div').setAttribute('data-mob', 'proto');
    settings.parentElement.setAttribute('data-mob', 'settings');
    team.parentElement.setAttribute('data-mob', 'team');
    chat.closest('#screen-lobby > .grid > div').setAttribute('data-mob', 'chat');

    const games = document.createElement('div');
    games.id = 'mob-games';
    games.innerHTML = `<div class="mob-hero"><div id="mob-hero-text"></div><input id="mob-search" class="mob-search" type="search" placeholder="🔎 Rechercher un jeu..." autocomplete="off"></div><div id="mob-games-list"></div>`;
    lobby.insertBefore(games, lobby.querySelector(':scope > section'));
    games.addEventListener('click', e => {
        const t = e.target.closest ? e.target.closest('[data-game]') : null;
        if (!t) return;
        const btn = document.getElementById('protocol-btn-' + t.dataset.game);
        if (btn) btn.click();                       // même action que la bibliothèque (réservée à l'hôte)
        if (window.isHost) setTimeout(() => mobTab('mission'), 180);
    });
    games.addEventListener('input', e => { if (e.target.id === 'mob-search') { MOB.filter = e.target.value; mobRenderGames(); } });

    const action = document.createElement('div');
    action.id = 'mob-action';
    action.innerHTML = `<button id="mob-action-game" class="game"></button><button id="mob-launch" style="display:none">🚀 LANCER</button>`;
    document.body.appendChild(action);
    document.getElementById('mob-action-game').onclick = () => mobTab(mobSelected() || !window.isHost ? 'mission' : 'jeux');
    document.getElementById('mob-launch').onclick = () => { if (typeof launchGame === 'function') launchGame(); };

    const tabs = document.createElement('div');
    tabs.id = 'mob-tabs';
    tabs.innerHTML = [['jeux', '🎮', 'Jeux'], ['mission', '🚀', 'Mission'], ['equipe', '👥', 'Équipe'], ['chat', '💬', 'Chat']].map(t =>
        `<button data-tab="${t[0]}"><span class="ic">${t[1]}</span>${t[2]}${t[0] === 'equipe' ? '<span id="mob-badge-team" class="badge" style="display:none"></span>' : ''}${t[0] === 'chat' ? '<span id="mob-badge-chat" class="badge alert" style="display:none">●</span>' : ''}</button>`).join('');
    document.body.appendChild(tabs);
    tabs.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('[data-tab]') : null; if (b) mobTab(b.dataset.tab); });

    // la barre d'onglets n'apparaît que lorsque le salon est à l'écran
    const sync = () => document.body.classList.toggle('mob-lobby', lobby.style.display !== 'none' && !lobby.classList.contains('hidden'));
    new MutationObserver(sync).observe(lobby, { attributes: true, attributeFilter: ['style', 'class'] });
    sync();
    // pastille « nouveau message » quand on n'est pas sur l'onglet Chat
    const box = document.getElementById('chat-messages');
    if (box) new MutationObserver(() => { if (document.body.classList.contains('mob') && MOB.tab !== 'chat' && box.children.length > 1) { MOB.unread = true; mobRenderBars(); } }).observe(box, { childList: true });
}
function mobApply() {
    mobBuild();
    if (!MOB.built) return;
    const on = MOB.q.matches;
    const deploy = document.getElementById('deploy-btn'), action = document.getElementById('mob-action');
    if (on && !document.body.classList.contains('mob')) {
        document.body.classList.add('mob');
        document.body.setAttribute('data-mtab', MOB.tab);
        if (deploy && action) { MOB.deployHome = { parent: deploy.parentElement, next: deploy.nextSibling }; action.insertBefore(deploy, document.getElementById('mob-launch')); }
    } else if (!on && document.body.classList.contains('mob')) {
        document.body.classList.remove('mob');
        document.body.removeAttribute('data-mtab');
        if (deploy && MOB.deployHome) MOB.deployHome.parent.insertBefore(deploy, MOB.deployHome.next);      // le bouton « Prêt » retourne à sa place d'origine
    }
    mobRefresh();
}
if (typeof window !== 'undefined' && window.matchMedia) {
    MOB.q = window.matchMedia('(max-width: 767px)');
    window.addEventListener('load', () => {
        mobApply();
        if (MOB.q.addEventListener) MOB.q.addEventListener('change', mobApply); else if (MOB.q.addListener) MOB.q.addListener(mobApply);
    });
}


// ===================== CODENAMES : COMPOSER LES ÉQUIPES AU DOIGT =====================
// Toucher (ou cliquer) un joueur ouvre une petite fenêtre pour le placer, en plus du glisser-déposer
// d'origine, qui ne fonctionne pas sur un écran tactile.
function cnFermer() { const el = document.getElementById('cn-choix'); if (el) el.remove(); }
function cnChoisir(nom) {
    cnFermer();
    if (!window.isHost || typeof state === 'undefined' || !state.players || !state.players[nom]) return;
    const p = state.players[nom], ici = (p.team || 'unassigned') + ':' + (p.team && p.team !== 'unassigned' ? (p.role || 'agent') : 'agent');
    const choix = [
        ['blue', 'spymaster', '🎖️ Amiral Azur', '#1d4ed8', '#bfdbfe'], ['red', 'spymaster', '🎖️ Amiral Écarlate', '#be123c', '#fecdd3'],
        ['blue', 'agent', '🛰️ Éclaireur Azur', '#1e3a8a', '#bfdbfe'], ['red', 'agent', '🛰️ Éclaireur Écarlate', '#881337', '#fecdd3']
    ];
    const ov = document.createElement('div');
    ov.id = 'cn-choix';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;background:rgba(2,6,23,.72);display:flex;align-items:flex-end;justify-content:center;padding:12px';
    ov.onclick = e => { if (e.target === ov) cnFermer(); };
    const box = document.createElement('div');
    box.style.cssText = 'width:min(440px,100%);background:#091424;border:1px solid #22d3ee;border-radius:18px;padding:16px;margin-bottom:max(0px,env(safe-area-inset-bottom))';
    const titre = document.createElement('div');
    titre.style.cssText = 'color:#e2e8f0;font-weight:800;font-size:15px;margin-bottom:12px;text-align:center';
    titre.textContent = 'Où placer ' + nom + ' ?';
    box.appendChild(titre);
    const grille = document.createElement('div');
    grille.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    const bouton = (texte, fond, couleur, team, role) => {
        const b = document.createElement('button');
        const actif = ici === team + ':' + role;
        b.textContent = texte + (actif ? ' ✓' : '');
        b.style.cssText = 'padding:14px 8px;border-radius:12px;border:2px solid ' + (actif ? '#fbbf24' : 'transparent') + ';background:' + fond + ';color:' + couleur + ';font-weight:800;font-size:13px;cursor:pointer;font-family:inherit';
        b.onclick = () => {
            cnFermer();
            // même traitement que le glisser-déposer d'origine
            dropOperator({ preventDefault() {}, dataTransfer: { getData: () => nom } }, team, role);
        };
        return b;
    };
    choix.forEach(c => grille.appendChild(bouton(c[2], c[3], c[4], c[0], c[1])));
    box.appendChild(grille);
    const reserve = bouton('↩️ Remettre dans la réserve', '#1e293b', '#cbd5e1', 'unassigned', 'agent');
    reserve.style.width = '100%'; reserve.style.marginTop = '8px';
    box.appendChild(reserve);
    ov.appendChild(box);
    document.body.appendChild(ov);
}

// ===================== GEOGUESSR : BOUTON POUR AGRANDIR LA CARTE (téléphone) =====================
function geoBasculerCarte() {
    const box = document.getElementById('minimap-box'), btn = document.getElementById('geo-carte-btn');
    if (!box) return;
    const grand = box.classList.toggle('geo-grand');
    if (btn) btn.textContent = grand ? '✕ Réduire la carte' : '🗺️ Agrandir la carte';
    // la carte doit recalculer sa taille une fois l'animation terminée
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
}
document.addEventListener('DOMContentLoaded', () => {
    const pano = document.getElementById('pano-container');
    if (!pano || document.getElementById('geo-carte-btn')) return;
    const b = document.createElement('button');
    b.id = 'geo-carte-btn'; b.type = 'button'; b.textContent = '🗺️ Agrandir la carte';
    b.onclick = geoBasculerCarte;
    pano.appendChild(b);
});
