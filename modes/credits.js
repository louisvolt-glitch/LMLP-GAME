// =====================================================================
//  CRÉDITS ET RETOURS DES JOUEURS
//  - un bouton 💬 en bas à gauche (à côté du son et de la pause), visible partout ;
//  - « Crédits » : les auteurs des modèles 3D, illustrations et outils utilisés ;
//  - « Signaler un bug » / « Proposer une idée » : le message est enregistré dans Firebase
//    (dossier retours/), puis une tâche GitHub (.github/workflows/retours.yml) le recopie
//    dans le fichier RETOURS.md du dépôt. Aucune clé GitHub n'est mise dans le site.
// =====================================================================

const CREDITS_LICENCES = {
    'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/deed.fr',
    'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
    'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/deed.fr',
    'CC-BY-NC-SA-4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr',
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/deed.fr',
    'SKETCHFAB Standard': 'https://sketchfab.com/licenses',
    'MIT': 'https://opensource.org/license/mit'
};

// [ce que c'est dans le jeu, titre d'origine, auteur, licence, adresse]
const CREDITS_MAGNAT = [
    ['Pion classique', 'Idle Pawn Animation Test', 'tobywallace', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/idle-pawn-animation-test-ce8cad3a82fa4b90a0e9c4d435655c6c'],
    ['Pion steampunk', 'Steampunk Widget Chess Pawn Preliminary Sketch', 'Dawnstar-Chronicles', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/steampunk-widget-chess-pawn-preliminary-sketch-ddd41eae4c064dbcb42a70fb80d9cb85'],
    ['Pion astronaute', 'OutHere Space Buddy', 'OutHereVR', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/outhere-space-buddy-4fb60251c9f446d0ad70b672bb0bf9c2'],
    ['Pion céphalopode', 'Space cephalopod', 'XennaDemonorph', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/space-cephalopod-ae8fefbd633c429998eb3c15ffeb8d4d'],
    ['Pion robot de maintenance', 'space maintenance robot', 'norbyscook (Andy An)', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/space-maintenance-robot-a612ed4feea14fc390beeb3a47943054'],
    ['Pion robot de combat', 'Combat Steampunk Robot', 'Milin Andrei', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/combat-steampunk-robot-81914abdc5b64b259d36ec7044118949'],
    ['Pion chasseur', 'Hammerhead Space Fighter', 'Pedro B. Goulart', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/hammerhead-space-fighter-19daeb543508430c8807edbcf27a9741'],
    ['Pion robot', 'robot_unity_test', 'eelgod', 'CC-BY-NC-4.0', 'https://sketchfab.com/3d-models/robot-unity-test-bd526b0b811a463f9b9fb8cf9f113d56'],
    ['Fond du plateau (image calculée à partir du nuage de points)', 'Need some space?', 'Loïc Norgeot', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/need-some-space-d6521362b37b48e3a82bce4911409303']
];
const CREDITS_ANOMALIES = [
    ['Banc', 'Retro Bench', 'Alexandre Orlans', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/retro-bench-95d5315c300945afb0abe31de3ab0903'],
    ['Poubelle du métro', 'Plastic round bin', 'Sousinho', 'SKETCHFAB Standard', 'https://sketchfab.com/3d-models/plastic-round-bin-cf7c9f627f344138a291a431c42beaae'],
    ['Porte de l’hôpital', 'Hospital door', '4dimension', 'CC-BY-SA-4.0', 'https://sketchfab.com/3d-models/hospital-door-8fbf4d24642e410ca2d645ae99a02398'],
    ['Porte double de l’hôpital', 'Hospital Door', 'anasrar', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/hospital-door-46e99d254ff34f45ad8ae7cb40321406'],
    ['Porte de l’hôtel', 'Door', 'hoschu', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/door-adf292f437f24151918a3b16ecef52d2'],
    ['Porte du métro', 'Door', 'DJMaesen', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/door-2738468b94d74c5f827e7e5df7be8359'],
    ['Lampe en cage, ventilateur de plafond, console, extincteur, cadres, alarme incendie, tuyaux, cabine téléphonique, caméra de surveillance, canapé, chariot à outils, horloge, panneau « sol glissant », fauteuil roulant',
        'Modèles Poly Haven', 'Poly Haven', 'CC0', 'https://polyhaven.com/models']
];
const CREDITS_MACHINES = [
    ['Astronaute (animation de marche précalculée en images)', 'Little Astronaut', 'Jelle Vermandere', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/little-astronaut-12184db58b1f44c987537b5607c32098'],
    ['Plans des 18 vaisseaux', 'créés avec Gemini', 'Google', '', 'https://gemini.google.com'],
    ['Extincteur', 'Fire extinguisher', 'Just8', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/fire-extinguisher-32053a83d480423ead43e954dad5fc41'],
    ['Clé à molette', 'Clé à boulon', 'Nicolas (nicolas-lissarrague)', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/cle-a-boulon-0e9456fdc64f44d8b8280720e270e0eb'],
    ['Son : moteur du vaisseau', 'Motor vehículo futurista grande', 'pepe827', 'Freesound', 'https://freesound.org/s/602912/'],
    ['Son : alarme', 'Two tone alarm repeating', 'theprinternet', 'Freesound', 'https://freesound.org/s/696175/'],
    ['Son : incendie', 'Big fire loop', 'robinhood76', 'Freesound', 'https://freesound.org/s/612277/'],
    ['Son : brèche dans la coque', 'Hull breach', 'jobro', 'Freesound', 'https://freesound.org/s/244112/'],
    ['Son : pas sur le métal', 'Metal mesh stairs steps', 'garuda1982', 'Freesound', 'https://freesound.org/s/555386/'],
    ['Son : démarrage des consoles', 'Turning on game console', 'harrisong024', 'Freesound', 'https://freesound.org/s/620320/'],
    ['Son : radio de l’intercom', 'MCC5500 keyup astro', 'nmcarpenter', 'Freesound', 'https://freesound.org/s/84397/']
];
const CREDITS_DIVERS = [
    ['Illustrations des cartes (Missive Stellaire, Cargaison et Transmission de Magnat)', 'créées avec Gemini', 'Google', '', 'https://gemini.google.com'],
    ['Affiches de films (Archives terrestres)', 'utilisées à titre d’illustration', 'leurs studios et ayants droit', '', ''],
    ['Moteur 3D', 'three.js', 'les auteurs de three.js', 'MIT', 'https://threejs.org'],
    ['Mise en page', 'Tailwind CSS', 'Tailwind Labs', 'MIT', 'https://tailwindcss.com'],
    ['Icônes', 'Font Awesome Free', 'Fonticons', '', 'https://fontawesome.com/license/free'],
    ['Polices Orbitron, Rajdhani et Share Tech Mono', 'Google Fonts', 'leurs créateurs', '', 'https://fonts.google.com'],
    ['Base de données en temps réel', 'Firebase', 'Google', '', 'https://firebase.google.com'],
    ['Cartes et vues de rue (Atterrissage d’urgence)', 'Google Maps Platform', 'Google', '', 'https://developers.google.com/maps']
];

function credEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function credLigne(l) {
    const [quoi, titre, auteur, licence, url] = l;
    const lien = url ? `<a href="${credEsc(url)}" target="_blank" rel="noopener" style="color:#7dd3fc">« ${credEsc(titre)} »</a>` : `« ${credEsc(titre)} »`;
    const lic = licence ? (CREDITS_LICENCES[licence] ? ` · <a href="${CREDITS_LICENCES[licence]}" target="_blank" rel="noopener" style="color:#94a3b8">${credEsc(licence)}</a>` : ` · ${credEsc(licence)}`) : '';
    return `<li style="padding:5px 0;border-bottom:1px solid rgba(148,163,184,.12)"><b style="color:#e2e8f0">${credEsc(quoi)}</b><br><span style="color:#94a3b8">${lien} par ${credEsc(auteur)}${lic}</span></li>`;
}
function credSection(titre, lignes, note) {
    return `<details ${titre.indexOf('Marché') >= 0 ? '' : 'open'} style="margin-bottom:10px"><summary style="cursor:pointer;font-weight:900;color:#fcd34d;letter-spacing:.06em;padding:6px 0">${credEsc(titre)} <span style="color:#64748b;font-weight:600">(${lignes.length})</span></summary>
        ${note ? `<div style="font-size:11px;color:#94a3b8;margin:2px 0 6px">${note}</div>` : ''}<ul style="list-style:none;margin:0;padding:0;font-size:12px">${lignes.map(credLigne).join('')}</ul></details>`;
}

// ---------------- Fenêtres ----------------
function credFenetre(id, titre, contenu) {
    const ancien = document.getElementById(id); if (ancien) ancien.remove();
    const ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;z-index:10080;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.82);backdrop-filter:blur(4px);padding:14px';
    ov.innerHTML = `<div style="width:100%;max-width:620px;max-height:88vh;display:flex;flex-direction:column;border-radius:18px;border:1px solid rgba(0,210,255,.5);background:#071222;box-shadow:0 0 40px rgba(0,210,255,.18);color:#e2e8f0;font-family:Rajdhani,system-ui,sans-serif">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(148,163,184,.2)">
            <div style="font-family:Orbitron,sans-serif;font-weight:800;letter-spacing:.12em;font-size:14px;color:#67e8f9">${titre}</div>
            <button data-fermer style="background:none;border:0;color:#94a3b8;font-size:22px;cursor:pointer;line-height:1" aria-label="Fermer">×</button>
        </div>
        <div data-contenu style="padding:12px 16px;overflow-y:auto">${contenu}</div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.hasAttribute('data-fermer')) ov.remove(); });
    document.body.appendChild(ov);
    return ov;
}

window.ouvrirCredits = function() {
    const lots = (window.ENCH_CATALOGUE || []).map(l => [l.n, l.cr[0], l.cr[1], l.cr[2], l.cr[3]]);
    credFenetre('cred-credits', '📜 CRÉDITS', `
        <p style="font-size:12px;color:#94a3b8;margin:0 0 10px">Ce jeu entre amis utilise le travail de nombreux créateurs. Merci à eux ! Les modèles 3D ont été allégés pour le web (textures réduites, maillages simplifiés).</p>
        ${lots.length ? credSection('Marché noir de la station — les lots 3D', lots, 'Touchez le titre pour dérouler la liste. Modèles publiés sur Sketchfab.') : ''}
        ${credSection('Magnat Galactique — pions et plateau', CREDITS_MAGNAT)}
        ${credSection('Salle des machines — astronaute et vaisseaux', CREDITS_MACHINES)}
        ${credSection('Anomalies — objets des couloirs', CREDITS_ANOMALIES)}
        ${credSection('Illustrations, outils et services', CREDITS_DIVERS)}`);
};

// ---------------- Retours des joueurs ----------------
const RETOUR_MAX = 1000, RETOUR_ATTENTE = 60 * 1000;       // longueur maximale, délai entre deux envois
window.ouvrirRetour = function(type) {
    type = type === 'idee' ? 'idee' : 'bug';
    const ov = credFenetre('cred-retour', '💬 VOTRE AVIS COMPTE', `
        <div style="display:flex;gap:8px;margin-bottom:10px">
            <button data-type="bug" class="cred-type" style="flex:1;padding:9px;border-radius:10px;cursor:pointer;font-weight:800">🐞 Signaler un bug</button>
            <button data-type="idee" class="cred-type" style="flex:1;padding:9px;border-radius:10px;cursor:pointer;font-weight:800">💡 Proposer une idée</button>
        </div>
        <div id="cred-aide" style="font-size:12px;color:#94a3b8;margin-bottom:6px"></div>
        <textarea id="cred-texte" maxlength="${RETOUR_MAX}" rows="6" style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#e2e8f0;padding:10px;font-size:14px;resize:vertical;font-family:inherit"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;color:#64748b">
            <span id="cred-contexte"></span><span id="cred-compte">0 / ${RETOUR_MAX}</span>
        </div>
        <div id="cred-etat" style="min-height:18px;font-size:12px;margin-top:6px"></div>
        <button id="cred-envoyer" style="width:100%;margin-top:6px;padding:11px;border-radius:12px;border:0;background:#059669;color:#fff;font-weight:900;letter-spacing:.06em;cursor:pointer">ENVOYER</button>
        <p style="font-size:10px;color:#64748b;margin:8px 0 0">Votre message, votre pseudo et le jeu en cours sont transmis à l’équipe du site. N’y mettez pas d’informations personnelles.</p>`);
    const texte = ov.querySelector('#cred-texte'), aide = ov.querySelector('#cred-aide'), etat = ov.querySelector('#cred-etat');
    const ctx = retourContexte();
    ov.querySelector('#cred-contexte').textContent = ctx.mode ? 'Jeu : ' + ctx.mode : '';
    const choisir = t => {
        type = t;
        ov.querySelectorAll('.cred-type').forEach(b => {
            const on = b.getAttribute('data-type') === t;
            b.style.background = on ? (t === 'bug' ? '#7f1d1d' : '#713f12') : '#0f172a';
            b.style.border = '1px solid ' + (on ? (t === 'bug' ? '#f87171' : '#fbbf24') : '#334155');
            b.style.color = on ? '#fff' : '#94a3b8';
        });
        aide.textContent = t === 'bug' ? 'Que s’est-il passé ? Dans quel jeu, et que faisiez-vous juste avant ?' : 'Quelle amélioration ou quel nouveau jeu aimeriez-vous voir ?';
        texte.placeholder = t === 'bug' ? 'Ex. : dans Missive, je ne peux pas jouer l’Espionne…' : 'Ex. : un mode où l’on doit deviner…';
    };
    ov.querySelectorAll('.cred-type').forEach(b => { b.onclick = () => choisir(b.getAttribute('data-type')); });
    texte.oninput = () => { ov.querySelector('#cred-compte').textContent = texte.value.length + ' / ' + RETOUR_MAX; };
    choisir(type);
    setTimeout(() => texte.focus(), 50);
    ov.querySelector('#cred-envoyer').onclick = () => {
        const msg = texte.value.trim();
        if (msg.length < 5) { etat.style.color = '#fca5a5'; etat.textContent = 'Écrivez quelques mots de plus.'; return; }
        let dernier = 0; try { dernier = Number(localStorage.getItem('lmlp-retour-dernier')) || 0; } catch (e) {}
        const reste = Math.ceil((dernier + RETOUR_ATTENTE - Date.now()) / 1000);
        if (reste > 0) { etat.style.color = '#fde68a'; etat.textContent = `Merci ! Attendez encore ${reste} s avant d’envoyer un autre message.`; return; }
        if (!(window.db && window.ref && window.set)) { etat.style.color = '#fca5a5'; etat.textContent = 'Connexion au serveur indisponible. Réessayez dans un instant.'; return; }
        const bouton = ov.querySelector('#cred-envoyer'); bouton.disabled = true; bouton.style.opacity = '.6';
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const donnees = { type: type, message: msg.slice(0, RETOUR_MAX), pseudo: ctx.pseudo.slice(0, 40), mode: ctx.mode.slice(0, 40), salon: ctx.salon.slice(0, 20),
            ecran: ctx.ecran.slice(0, 40), navigateur: navigator.userAgent.slice(0, 200), t: Date.now() };
        window.set(window.ref(window.db, 'retours/' + id), donnees).then(() => {
            try { localStorage.setItem('lmlp-retour-dernier', String(Date.now())); } catch (e) {}
            ov.querySelector('[data-contenu]').innerHTML = `<div style="text-align:center;padding:24px 8px"><div style="font-size:44px">${type === 'bug' ? '🛠️' : '🚀'}</div>
                <div style="font-weight:900;font-size:18px;margin:8px 0">Message bien reçu, merci !</div>
                <div style="font-size:13px;color:#94a3b8">Il sera lu par l’équipe du Poste de Commandement.</div>
                <button data-fermer style="margin-top:16px;padding:9px 22px;border-radius:10px;border:0;background:#0e7490;color:#fff;font-weight:800;cursor:pointer">Fermer</button></div>`;
            if (typeof window.sfx === 'function') window.sfx('victoire');
        }).catch(err => {
            console.warn('Envoi du retour impossible :', err);
            bouton.disabled = false; bouton.style.opacity = '1';
            etat.style.color = '#fca5a5'; etat.textContent = 'L’envoi a échoué. Vérifiez la connexion et réessayez.';
        });
    };
};

function retourContexte() {
    const salon = window._joinedRoom || '', room = window.currentRoom || {};
    const ecran = Array.from(document.querySelectorAll('[id^="screen-"]')).find(e => !e.classList.contains('hidden') && e.offsetParent !== null);
    const pseudo = (window.state && (state.username || '')) || window.myPlayerKey || (document.getElementById('input-username') || {}).value || '';
    return { salon: String(salon), mode: String(room.selectedMode || ''), ecran: ecran ? ecran.id : '', pseudo: String(pseudo || 'anonyme') };
}

// ---------------- Bouton 💬 (à côté du son et de la pause) ----------------
function credBouton() {
    if (document.getElementById('cred-bouton')) return;
    const b = document.createElement('button');
    b.id = 'cred-bouton'; b.title = 'Crédits · signaler un bug · proposer une idée'; b.textContent = '💬';
    b.style.cssText = 'position:fixed;left:96px;bottom:8px;z-index:60;width:36px;height:36px;border-radius:50%;border:1px solid rgba(0,210,255,.5);background:rgba(9,20,36,.9);color:#e2e8f0;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center';
    const menu = document.createElement('div');
    menu.id = 'cred-menu';
    menu.style.cssText = 'position:fixed;left:96px;bottom:52px;z-index:10050;display:none;flex-direction:column;gap:6px;padding:8px;border-radius:14px;border:1px solid rgba(0,210,255,.5);background:rgba(4,10,22,.97);box-shadow:0 8px 30px rgba(0,0,0,.5)';
    const item = (txt, fn) => { const i = document.createElement('button'); i.textContent = txt; i.style.cssText = 'text-align:left;white-space:nowrap;padding:8px 12px;border-radius:9px;border:0;background:rgba(30,41,59,.8);color:#e2e8f0;font-weight:700;font-size:13px;cursor:pointer'; i.onclick = () => { menu.style.display = 'none'; fn(); }; menu.appendChild(i); };
    item('🐞 Signaler un bug', () => window.ouvrirRetour('bug'));
    item('💡 Proposer une idée', () => window.ouvrirRetour('idee'));
    item('📜 Crédits', () => window.ouvrirCredits());
    b.onclick = e => { e.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'; };
    document.addEventListener('click', e => { if (!menu.contains(e.target) && e.target !== b) menu.style.display = 'none'; });
    document.body.appendChild(menu); document.body.appendChild(b);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', credBouton); else credBouton();
