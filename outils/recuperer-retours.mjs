// Recopie les retours des joueurs (bugs et idées) de Firebase vers le fichier RETOURS.md du dépôt.
// Lancé par la tâche GitHub .github/workflows/retours.yml (toutes les heures, ou à la main).
//   node outils/recuperer-retours.mjs lire     → ajoute les nouveaux messages en haut de RETOURS.md
//   node outils/recuperer-retours.mjs effacer  → efface de Firebase les messages recopiés (une fois RETOURS.md enregistré)
// Il faut le secret FIREBASE_SECRET (secret de base de données Firebase), rangé dans les secrets du dépôt GitHub.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = (process.env.FIREBASE_URL || 'https://lmlp-games-default-rtdb.firebaseio.com').replace(/\/$/, '');
const SECRET = process.env.FIREBASE_SECRET;
const FICHIER = 'RETOURS.md';
const LISTE = join(process.env.RUNNER_TEMP || '.', 'retours-recopies.json');   // ids à effacer (hors du dépôt)
const ENTETE = `# Retours des joueurs

Bugs signalés et idées proposées depuis le bouton 💬 du jeu.
Ce fichier est mis à jour automatiquement (les plus récents en haut).

<!-- NOUVEAUX RETOURS -->
`;

if (!SECRET) { console.error('Le secret FIREBASE_SECRET est absent : ajoutez-le dans Settings > Secrets and variables > Actions.'); process.exit(1); }
const action = process.argv[2];

async function appel(chemin, options) {
    const r = await fetch(`${BASE}/${chemin}.json?auth=${encodeURIComponent(SECRET)}`, options);
    if (!r.ok) throw new Error(`Firebase a répondu ${r.status} : ${await r.text()}`);
    return r.json();
}
const propre = s => String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();

if (action === 'lire') {
    const donnees = (await appel('retours')) || {};
    const ids = Object.keys(donnees).sort((a, b) => (donnees[b].t || 0) - (donnees[a].t || 0));
    await writeFile(LISTE, JSON.stringify(ids));
    if (!ids.length) { console.log('Aucun nouveau retour.'); process.exit(0); }
    const blocs = ids.map(id => {
        const d = donnees[id] || {};
        const quand = new Date(Number(d.t) || Date.now()).toLocaleString('fr-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
        const titre = d.type === 'idee' ? '💡 Idée' : '🐞 Bug';
        const infos = [`**${propre(d.pseudo) || 'anonyme'}**`, quand, d.mode ? `jeu : \`${propre(d.mode)}\`` : '', d.salon ? `salon ${propre(d.salon)}` : ''].filter(Boolean).join(' · ');
        const message = propre(d.message).split('\n').map(l => '> ' + l).join('\n');
        return `### ${titre} — ${infos}\n${message}\n\n<sub>Écran : ${propre(d.ecran) || '?'} · ${propre(d.navigateur).slice(0, 120)}</sub>\n\n- [ ] à traiter\n`;
    }).join('\n');
    let contenu;
    try { contenu = await readFile(FICHIER, 'utf8'); } catch (e) { contenu = ENTETE; }
    if (contenu.indexOf('<!-- NOUVEAUX RETOURS -->') < 0) contenu = ENTETE + '\n' + contenu;
    contenu = contenu.replace('<!-- NOUVEAUX RETOURS -->', '<!-- NOUVEAUX RETOURS -->\n\n' + blocs);
    await writeFile(FICHIER, contenu);
    console.log(`${ids.length} retour(s) ajouté(s) à ${FICHIER}.`);
} else if (action === 'effacer') {
    let ids = [];
    try { ids = JSON.parse(await readFile(LISTE, 'utf8')); } catch (e) {}
    if (!ids.length) { console.log('Rien à effacer.'); process.exit(0); }
    await appel('retours', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(ids.map(id => [id, null]))) });
    console.log(`${ids.length} retour(s) effacé(s) de Firebase.`);
} else {
    console.error('Utilisation : node outils/recuperer-retours.mjs lire|effacer');
    process.exit(1);
}
