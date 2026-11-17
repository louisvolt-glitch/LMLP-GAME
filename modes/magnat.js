// =====================================================================
//  MODE « MAGNAT GALACTIQUE » : jeu de commerce immobilier spatial (2 à 8 joueurs).
//  Achetez des colonies, percevez des loyers, construisez des avant-postes puis des
//  métropoles, négociez, hypothéquez... et poussez vos rivaux à la faillite.
//
//  Fonctionnement réseau : l'HÔTE est l'arbitre. Chaque joueur écrit seulement des
//  « actions » (salons/<code>/magnatGame/a/<clé>) ; l'hôte les applique dans l'ordre
//  avec magApply() et publie le nouvel état (salons/<code>/magnatGame/s).
//
//  Ce fichier contient : 1) les données du plateau  2) les règles (fonctions pures)
//                        3) la boucle de l'hôte      4) l'affichage
// =====================================================================

// ============================ 1) DONNÉES ============================
const MAG = {
    START_CASH: 1500,      // crédits de départ
    SALARY: 200,           // solde touché en passant par la Station Mère
    BAIL: 50,              // caution pour sortir de Quarantaine
    HOUSES: 32,            // avant-postes disponibles à la banque
    HOTELS: 12,            // métropoles disponibles à la banque
    AUCTION_SECONDS: 20,   // temps pour enchérir
    CARD_SECONDS: 15,      // une carte tirée reste affichée, puis son effet s'applique tout seul
    JAIL: 9,               // case Quarantaine
    LOG: 25
};

// Familles de colonies : couleur du plateau et prix d'une construction
const MAG_FAMILIES = {
    A: { name: 'Ceinture', color: '#94a3b8', cost: 50 },
    B: { name: 'Dômes', color: '#2dd4bf', cost: 50 },
    C: { name: 'Comptoirs', color: '#a78bfa', cost: 100 },
    D: { name: 'Forges', color: '#fb923c', cost: 100 },
    E: { name: 'Cités', color: '#fb7185', cost: 150 },
    F: { name: 'Jardins', color: '#a3e635', cost: 150 },
    G: { name: 'Citadelles', color: '#38bdf8', cost: 200 }
};

// Les 36 cases de l'anneau, dans le sens de la marche.
// t : start | prop (colonie) | portal | net (réseau) | tax | card | jail | free | gojail
const MAG_SPACES = [
    { t: 'start', n: 'Station Mère', i: '🚀' },
    { t: 'prop', f: 'A', n: 'Astéroïde Cendre', p: 60 },
    { t: 'card', d: 'a', n: 'Transmission', i: '📡' },
    { t: 'prop', f: 'A', n: 'Astéroïde Rouille', p: 60 },
    { t: 'tax', a: 150, n: "Taxe d'amarrage", i: '💸' },
    { t: 'portal', n: 'Portail Alpha', p: 200, i: '🌀' },
    { t: 'prop', f: 'B', n: 'Dôme Hydra', p: 100 },
    { t: 'prop', f: 'B', n: 'Dôme Lyra', p: 100 },
    { t: 'card', d: 'b', n: 'Cargaison', i: '📦' },
    { t: 'jail', n: 'Quarantaine', i: '🧪' },
    { t: 'prop', f: 'B', n: 'Dôme Vela', p: 120 },
    { t: 'prop', f: 'C', n: 'Comptoir Néon', p: 140 },
    { t: 'net', n: 'Réseau Solaire', p: 150, i: '🔆' },
    { t: 'prop', f: 'C', n: 'Comptoir Onyx', p: 140 },
    { t: 'portal', n: 'Portail Bêta', p: 200, i: '🌀' },
    { t: 'prop', f: 'C', n: 'Comptoir Opale', p: 160 },
    { t: 'prop', f: 'D', n: 'Forge Titan', p: 180 },
    { t: 'prop', f: 'D', n: 'Forge Vulcain', p: 180 },
    { t: 'free', n: 'Zone Franche', i: '🌌' },
    { t: 'prop', f: 'D', n: 'Forge Atlas', p: 200 },
    { t: 'card', d: 'a', n: 'Transmission', i: '📡' },
    { t: 'prop', f: 'E', n: 'Cité Rubis', p: 220 },
    { t: 'prop', f: 'E', n: 'Cité Grenat', p: 220 },
    { t: 'portal', n: 'Portail Gamma', p: 200, i: '🌀' },
    { t: 'prop', f: 'E', n: 'Cité Carmin', p: 240 },
    { t: 'prop', f: 'F', n: 'Jardin Hélios', p: 260 },
    { t: 'net', n: 'Réseau Quantique', p: 150, i: '🛰️' },
    { t: 'gojail', n: 'Patrouille', i: '🚨' },
    { t: 'prop', f: 'F', n: 'Jardin Aurore', p: 260 },
    { t: 'prop', f: 'F', n: 'Jardin Zénith', p: 280 },
    { t: 'card', d: 'b', n: 'Cargaison', i: '📦' },
    { t: 'prop', f: 'G', n: 'Citadelle Émeraude', p: 300 },
    { t: 'prop', f: 'G', n: 'Citadelle Saphir', p: 320 },
    { t: 'portal', n: 'Portail Delta', p: 200, i: '🌀' },
    { t: 'tax', a: 100, n: 'Taxe de prestige', i: '💎' },
    { t: 'prop', f: 'G', n: 'Citadelle Nova', p: 350 }
];
const MAG_N = MAG_SPACES.length;

// Cartes. x : gain | pay | start | goto | back | portal | jail | free | repairs | each | payeach | payper | skip
const MAG_CARDS = {
    a: [
        { x: 'start', txt: "Signal de détresse capté : rejoignez la Station Mère et touchez votre solde." },
        { x: 'portal', txt: "Une faille s'ouvre : avancez jusqu'au prochain Portail." },
        { x: 'jail', txt: "Contrôle de routine : la Patrouille vous place en Quarantaine." },
        { x: 'free', txt: "Sauf-conduit diplomatique : conservez cette carte pour sortir de Quarantaine." },
        { x: 'gain', v: 150, txt: "Vos brevets rapportent : recevez 150 crédits." },
        { x: 'pay', v: 40, txt: "Amende pour excès de vitesse lumière : payez 40 crédits." },
        { x: 'back', v: 3, txt: "Tempête solaire : reculez de 3 cases." },
        { x: 'goto', sp: 21, txt: "Cap sur Cité Rubis. Si vous passez par la Station Mère, touchez votre solde." },
        { x: 'goto', sp: 11, txt: "Cap sur Comptoir Néon. Si vous passez par la Station Mère, touchez votre solde." },
        { x: 'repairs', h: 25, H: 100, txt: "Révision de vos installations : payez 25 crédits par avant-poste et 100 par métropole." },
        { x: 'payeach', v: 25, txt: "Vous êtes élu porte-parole de la flotte : versez 25 crédits à chaque joueur." },
        { x: 'gain', v: 50, txt: "Dividendes de la banque orbitale : recevez 50 crédits." },
        { x: 'goto', sp: 35, txt: "Cap sur Citadelle Nova." },
        { x: 'gain', v: 100, txt: "Subvention d'exploration : recevez 100 crédits." }
    ],
    // Les 30 cartes Cargaison : le texte reprend celui de l'image magnat-visuel/cartes/cargaison-XX.jpg (XX = img)
    b: [
        { x: 'gain', v: 200, img: 1, txt: "Cargaison de minerai rare vendue : recevez 200 crédits." },
        { x: 'gain', v: 75, img: 2, txt: "Erreur du comptoir en votre faveur : recevez 75 crédits." },
        { x: 'pay', v: 100, img: 3, txt: "Réparation de la coque : payez 100 crédits." },
        { x: 'pay', v: 50, img: 4, txt: "Visite médicale obligatoire : payez 50 crédits." },
        { x: 'each', v: 20, img: 5, txt: "C'est votre anniversaire galactique : chaque joueur vous offre 20 crédits." },
        { x: 'free', img: 6, txt: "Sauf-conduit diplomatique : conservez cette carte pour sortir de Quarantaine." },
        { x: 'jail', img: 7, txt: "Contrebande découverte dans vos soutes : direction la Quarantaine." },
        { x: 'start', img: 8, txt: "Rappel de la flotte : retournez à la Station Mère et touchez votre solde." },
        { x: 'gain', v: 60, img: 9, txt: "Remboursement d'assurance : recevez 60 crédits." },
        { x: 'repairs', h: 40, H: 115, img: 10, txt: "Entretien des installations : payez 40 crédits par avant-poste et 115 par métropole." },
        { x: 'gain', v: 20, img: 11, txt: "Vous gagnez le concours d'holo-photo intergalactique : recevez 20 crédits." },
        { x: 'pay', v: 60, img: 12, txt: "Hausse des cours de l'antimatière : payez 60 crédits de taxe sur le carburant." },
        { x: 'gain', v: 120, img: 13, txt: "Héritage d'un lointain cousin de la Bordure Extérieure : recevez 120 crédits." },
        { x: 'gain', v: 45, img: 14, txt: "Vente de pièces détachées sur le marché noir : recevez 45 crédits." },
        { x: 'gain', v: 150, img: 15, txt: "Mission de convoyage risquée menée à bien : touchez une prime de 150 crédits." },
        { x: 'pay', v: 35, img: 16, txt: "Panne de propulseur ionique : immobilisé pour réparation, payez 35 crédits." },
        { x: 'gain', v: 100, img: 17, txt: "Excellents bilans trimestriels de la guilde commerciale : recevez 100 crédits." },
        { x: 'pay', v: 25, img: 18, txt: "Vaisseau mal garé sur les voies d'approche du Portail : payez 25 crédits d'amende." },
        { x: 'gain', v: 175, img: 19, txt: "Vos sondes découvrent un astéroïde de platine : recevez 175 crédits." },
        { x: 'pay', v: 80, img: 20, txt: "Cyber-attaque sur vos comptes de navigation : payez 80 crédits de sécurisation." },
        { x: 'pay', v: 50, img: 21, txt: "Mécénat scientifique : versez 50 crédits pour soutenir la recherche des cadets." },
        { x: 'gain', v: 110, img: 22, txt: "Votre écurie gagne la course de podracers : recevez 110 crédits de gains." },
        { x: 'pay', v: 30, img: 23, txt: "Redevance logistique exceptionnelle : payez 30 crédits à la banque." },
        { x: 'gain', v: 90, img: 24, txt: "Vous avez secouru une capsule en dérive : touchez une prime de 90 crédits." },
        { x: 'pay', v: 65, img: 25, txt: "Contrôle approfondi de la cargaison par les douanes : payez 65 crédits de taxes." },
        { x: 'gain', v: 130, img: 26, txt: "Un de vos brevets de bouclier est validé : recevez 130 crédits de royalties." },
        { x: 'payper', v: 15, img: 27, txt: "Krach temporaire sur les métaux lourds : payez 15 crédits par joueur pour renflouer le marché." },
        { x: 'gain', v: 85, img: 28, txt: "Aide gouvernementale pour vos dômes : recevez 85 crédits de subvention." },
        { x: 'skip', img: 29, txt: "Ordinateur de bord déréglé : perdez un tour à recalibrer le système de saut." },
        { x: 'gain', v: 150, img: 30, txt: "Élu meilleur négociant du secteur : recevez 150 crédits de la banque." }
    ]
};
const MAG_DECK_NAMES = { a: 'Transmission', b: 'Cargaison' };
const MAG_TOKEN_COLORS = ['#f43f5e', '#22d3ee', '#facc15', '#4ade80', '#c084fc', '#fb923c', '#f9a8d4', '#e2e8f0'];

// ============================ 2) RÈGLES (fonctions pures) ============================
function magOwnable(sp) { const c = MAG_SPACES[sp]; return !!c && (c.t === 'prop' || c.t === 'portal' || c.t === 'net'); }
function magFamilySpaces(f) { const out = []; MAG_SPACES.forEach((c, i) => { if (c.t === 'prop' && c.f === f) out.push(i); }); return out; }
function magOwn(s, sp) { return s.own['s' + sp] || null; }
function magOwnerOf(s, sp) { const o = magOwn(s, sp); return o ? o.o : ''; }
function magHouses(s, sp) { const o = magOwn(s, sp); return o ? (o.h || 0) : 0; }
function magAlive(s) { return s.order.filter(n => s.players[n] && !s.players[n].out); }
function magOwnsFamily(s, name, f) { return magFamilySpaces(f).every(sp => magOwnerOf(s, sp) === name); }
function magOwned(s, name) { const out = []; for (let i = 0; i < MAG_N; i++) if (magOwnerOf(s, i) === name) out.push(i); return out; }
function magCount(s, name, type) { return magOwned(s, name).filter(sp => MAG_SPACES[sp].t === type).length; }
function magMortgageValue(sp) { return Math.floor(MAG_SPACES[sp].p / 2); }
function magUnmortgageCost(sp) { return Math.ceil(magMortgageValue(sp) * 1.1); }
function magHouseCost(sp) { return MAG_FAMILIES[MAG_SPACES[sp].f].cost; }

// Loyers d'une colonie : [terrain nu, 1, 2, 3, 4 avant-postes, métropole]
function magRentTable(sp) {
    const b = Math.round(MAG_SPACES[sp].p / 10 - 4);
    return [b, b * 5, b * 14 + 10, b * 36 + 40, b * 48 + 80, b * 60 + 130];
}
function magRent(s, sp, diceSum) {
    const c = MAG_SPACES[sp], o = magOwn(s, sp);
    if (!o || o.m) return 0;
    if (c.t === 'portal') return 25 * Math.pow(2, magCount(s, o.o, 'portal') - 1);
    if (c.t === 'net') return (magCount(s, o.o, 'net') >= 2 ? 10 : 4) * (diceSum || 7);
    const table = magRentTable(sp), h = o.h || 0;
    if (h > 0) return table[h];
    return magOwnsFamily(s, o.o, c.f) ? table[0] * 2 : table[0];      // famille complète : loyer doublé
}
function magSupply(s) {
    let houses = MAG.HOUSES, hotels = MAG.HOTELS;
    Object.keys(s.own).forEach(k => { const h = s.own[k].h || 0; if (h === 5) hotels--; else houses -= h; });
    return { houses: houses, hotels: hotels };
}
// Fortune : crédits + propriétés (moitié si hypothéquées) + constructions
function magWorth(s, name) {
    const p = s.players[name];
    if (!p || p.out) return 0;
    let w = p.cash;
    magOwned(s, name).forEach(sp => {
        const o = magOwn(s, sp);
        w += o.m ? magMortgageValue(sp) : MAG_SPACES[sp].p;
        if (o.h) w += o.h * magHouseCost(sp);
    });
    return w;
}
// Qui doit agir maintenant ?
function magActor(s) {
    if (s.debts.length) return s.debts[0].who;
    if (s.auction) return s.auction.act[s.auction.i] || s.order[s.turn];
    return s.order[s.turn];
}
// Un joueur peut-il gérer ses biens maintenant ? (pendant son tour, ou pour régler une dette)
function magCanManage(s, name) {
    if (s.status !== 'PLAYING' || s.auction) return false;
    if (s.debts.length) return s.debts[0].who === name;
    return s.order[s.turn] === name && (s.phase === 'ROLL' || s.phase === 'END');
}

// ----- Vérifications (renvoient '' si l'action est permise, sinon la raison) -----
function magCheckBuild(s, name, sp) {
    const c = MAG_SPACES[sp], o = magOwn(s, sp);
    if (!c || c.t !== 'prop' || !o || o.o !== name) return "Ce n'est pas votre colonie.";
    if (s.debts.length) return "Réglez d'abord votre dette.";
    if (!magOwnsFamily(s, name, c.f)) return 'Il faut posséder toute la famille.';
    const fam = magFamilySpaces(c.f);
    if (fam.some(x => magOwn(s, x).m)) return 'Une colonie de la famille est hypothéquée.';
    const h = o.h || 0;
    if (h >= 5) return 'Déjà une métropole.';
    if (h > Math.min.apply(null, fam.map(x => magHouses(s, x)))) return 'Construisez de façon équilibrée sur la famille.';
    if (s.players[name].cash < magHouseCost(sp)) return 'Crédits insuffisants.';
    const sup = magSupply(s);
    if (h === 4 ? sup.hotels < 1 : sup.houses < 1) return 'La banque n\'a plus de construction disponible.';
    return '';
}
function magCheckSell(s, name, sp) {
    const c = MAG_SPACES[sp], o = magOwn(s, sp);
    if (!c || c.t !== 'prop' || !o || o.o !== name) return "Ce n'est pas votre colonie.";
    const h = o.h || 0;
    if (h <= 0) return 'Aucune construction à vendre.';
    if (h < Math.max.apply(null, magFamilySpaces(c.f).map(x => magHouses(s, x)))) return 'Vendez de façon équilibrée sur la famille.';
    return '';
}
function magCheckMortgage(s, name, sp) {
    const o = magOwn(s, sp);
    if (!magOwnable(sp) || !o || o.o !== name) return "Ce n'est pas votre propriété.";
    if (o.m) return 'Déjà hypothéquée.';
    const c = MAG_SPACES[sp];
    if (c.t === 'prop' && magFamilySpaces(c.f).some(x => magHouses(s, x) > 0)) return "Vendez d'abord les constructions de la famille.";
    return '';
}
function magCheckUnmortgage(s, name, sp) {
    const o = magOwn(s, sp);
    if (!magOwnable(sp) || !o || o.o !== name) return "Ce n'est pas votre propriété.";
    if (!o.m) return "Elle n'est pas hypothéquée.";
    if (s.debts.length) return "Réglez d'abord votre dette.";
    if (s.players[name].cash < magUnmortgageCost(sp)) return 'Crédits insuffisants.';
    return '';
}
function magTradable(s, name, sp) {
    const o = magOwn(s, sp);
    if (!magOwnable(sp) || !o || o.o !== name) return false;
    const c = MAG_SPACES[sp];
    return !(c.t === 'prop' && magFamilySpaces(c.f).some(x => magHouses(s, x) > 0));
}
function magCleanSide(side) {
    side = side || {};
    const props = (Array.isArray(side.props) ? side.props : Object.values(side.props || {})).map(Number).filter(n => Number.isInteger(n));
    return { cash: Math.max(0, Math.floor(Number(side.cash) || 0)), props: Array.from(new Set(props)), cards: Math.max(0, Math.floor(Number(side.cards) || 0)) };
}
function magCheckTrade(s, tr) {
    const a = s.players[tr.from], b = s.players[tr.to];
    if (!a || !b || a.out || b.out || tr.from === tr.to) return 'Partenaire invalide.';
    const g = tr.give, r = tr.get;
    if (!g.cash && !g.props.length && !g.cards && !r.cash && !r.props.length && !r.cards) return "L'échange est vide.";
    if (g.cash > a.cash || r.cash > b.cash) return 'Crédits insuffisants pour cet échange.';
    if (g.cards > (a.cards || 0) || r.cards > (b.cards || 0)) return 'Sauf-conduit indisponible.';
    if (!g.props.every(sp => magTradable(s, tr.from, sp)) || !r.props.every(sp => magTradable(s, tr.to, sp))) return 'Une propriété ne peut pas être échangée (constructions ou propriétaire).';
    return '';
}

// ----- État initial -----
function magShuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
}
function magNewGame(names, opts, now, rnd) {
    rnd = rnd || Math.random;
    opts = opts || {};
    const order = magShuffle(names, rnd);
    const players = {};
    order.forEach((n, i) => { players[n] = { cash: MAG.START_CASH, pos: 0, jail: 0, cards: 0, out: false, c: i % MAG_TOKEN_COLORS.length }; });
    const s = {
        status: 'PLAYING', startedAt: now, seq: 1, order: order, turn: 0, turnCount: 1, phase: 'ROLL',
        players: players, own: {}, dice: [1, 1], rollSeq: 0, dbl: 0, again: false, buy: -1,
        debts: [], auction: null, trade: null, card: null, log: [],
        deck: { a: magShuffle(MAG_CARDS.a.map((c, i) => i), rnd), b: magShuffle(MAG_CARDS.b.map((c, i) => i), rnd) }, di: { a: 0, b: 0 },
        timer: Math.max(20, Math.min(300, Number(opts.timer) || 90)),
        endAt: opts.minutes > 0 ? now + opts.minutes * 60000 : 0,
        dl: 0, dlAt: now, dlKey: '', outCount: 0
    };
    s.log.push(`La partie commence. ${order[0]} ouvre le jeu.`);
    magDeadline(s, now);
    return s;
}
// Firebase supprime les tableaux et objets vides : on les rétablit à la lecture
function magNorm(raw) {
    const s = JSON.parse(JSON.stringify(raw || {}));
    const arr = v => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : Object.values(v || {}));
    s.order = arr(s.order);
    s.players = s.players || {};
    Object.keys(s.players).forEach(n => { const p = s.players[n]; p.cash = p.cash || 0; p.pos = p.pos || 0; p.jail = p.jail || 0; p.cards = p.cards || 0; p.out = !!p.out; p.c = p.c || 0; p.skip = p.skip || 0; });
    s.own = (s.own && !Array.isArray(s.own)) ? s.own : {};
    s.dice = arr(s.dice); if (s.dice.length < 2) s.dice = [1, 1];
    s.debts = arr(s.debts);
    s.log = arr(s.log);
    s.deck = s.deck || {}; s.deck.a = arr(s.deck.a); s.deck.b = arr(s.deck.b);
    s.di = s.di || {}; s.di.a = s.di.a || 0; s.di.b = s.di.b || 0;
    if (s.auction) { s.auction.act = arr(s.auction.act); s.auction.i = s.auction.i || 0; s.auction.bid = s.auction.bid || 0; s.auction.by = s.auction.by || ''; }
    else s.auction = null;
    if (s.trade) { s.trade.give = magCleanSide(s.trade.give); s.trade.get = magCleanSide(s.trade.get); } else s.trade = null;
    s.card = s.card || null;
    if (s.card) s.card.p = !!s.card.p;
    s.rank = arr(s.rank);
    ['turn', 'rollSeq', 'dbl', 'dl', 'dlAt', 'endAt', 'outCount', 'seq', 'turnCount'].forEach(k => { s[k] = s[k] || 0; });
    if (typeof s.buy !== 'number') s.buy = -1;
    s.again = !!s.again; s.dlKey = s.dlKey || '';
    return s;
}

// ----- Briques de base -----
function magLog(s, txt) { s.log.push(txt); if (s.log.length > MAG.LOG) s.log = s.log.slice(-MAG.LOG); }
function magPay(s, who, amt, to) {
    s.players[who].cash -= amt;
    if (to && s.players[to] && !s.players[to].out) s.players[to].cash += amt;
}
// Fait payer un joueur ; s'il n'a pas assez de crédits, une dette est ouverte (il devra vendre ou hypothéquer)
function magCharge(s, who, amt, to, why) {
    amt = Math.floor(amt);
    if (amt <= 0 || !s.players[who] || s.players[who].out) return;
    if (s.players[who].cash >= amt) {
        magPay(s, who, amt, to);
        magLog(s, `${who} paie ${amt} cr${to ? ' à ' + to : ''}${why ? ' (' + why + ')' : ''}.`);
    } else {
        s.debts.push({ who: who, amt: amt, to: to || '', why: why || '' });
        magLog(s, `${who} doit ${amt} cr${to ? ' à ' + to : ''}${why ? ' (' + why + ')' : ''} mais manque de crédits.`);
    }
}
// Paie automatiquement les dettes dès que le débiteur a de quoi payer
function magFlushDebts(s) {
    while (s.debts.length) {
        const d = s.debts[0];
        const p = s.players[d.who];
        if (!p || p.out) { s.debts.shift(); continue; }
        if (p.cash < d.amt) break;
        magPay(s, d.who, d.amt, d.to);
        magLog(s, `${d.who} règle sa dette de ${d.amt} cr${d.to ? ' à ' + d.to : ''}.`);
        s.debts.shift();
    }
}
function magJail(s, name) {
    const p = s.players[name];
    p.pos = MAG.JAIL; p.jail = 1;
    s.again = false; s.dbl = 0; s.phase = 'END';
    magLog(s, `${name} est placé en Quarantaine.`);
}
// Tirage : la carte est d'abord MONTRÉE à tout le monde (étape CARD) ; son effet s'applique ensuite (action « card »)
function magDrawCard(s, name, deck) {
    if (s.di[deck] >= s.deck[deck].length) s.di[deck] = 0;
    const idx = s.deck[deck][s.di[deck]++];
    s.card = { d: deck, i: idx, by: name, k: s.seq, p: true };
    s.phase = 'CARD';
    magLog(s, `${name} tire une carte ${MAG_DECK_NAMES[deck]} : ${MAG_CARDS[deck][idx].txt}`);
}
function magCardEffect(s, name, card) {
    const p = s.players[name];
    if (card.x === 'gain') { p.cash += card.v; magLog(s, `${name} reçoit ${card.v} cr.`); }
    else if (card.x === 'pay') magCharge(s, name, card.v, '', 'carte');
    else if (card.x === 'payper') magCharge(s, name, card.v * magAlive(s).length, '', `carte : ${card.v} cr × ${magAlive(s).length} joueurs`);
    else if (card.x === 'skip') { p.skip = (p.skip || 0) + 1; magLog(s, `${name} passera son prochain tour.`); }
    else if (card.x === 'start') { p.pos = 0; p.cash += MAG.SALARY; magLog(s, `${name} rejoint la Station Mère : +${MAG.SALARY} cr.`); }
    else if (card.x === 'jail') magJail(s, name);
    else if (card.x === 'free') { p.cards = (p.cards || 0) + 1; magLog(s, `${name} conserve un sauf-conduit.`); }
    else if (card.x === 'each') magAlive(s).forEach(q => { if (q !== name) magCharge(s, q, card.v, name, 'carte'); });
    else if (card.x === 'payeach') magAlive(s).forEach(q => { if (q !== name) magCharge(s, name, card.v, q, 'carte'); });
    else if (card.x === 'repairs') {
        let total = 0;
        magOwned(s, name).forEach(sp => { const h = magHouses(s, sp); total += h === 5 ? card.H : h * card.h; });
        if (total > 0) magCharge(s, name, total, '', 'entretien'); else magLog(s, `${name} n'a aucune construction : rien à payer.`);
    }
    else if (card.x === 'goto') magMoveToDepth(s, name, card.sp, true, 0);
    else if (card.x === 'back') magMoveToDepth(s, name, (p.pos - card.v + MAG_N) % MAG_N, false, 0);
    else if (card.x === 'portal') {
        let t = p.pos;
        do { t = (t + 1) % MAG_N; } while (MAG_SPACES[t].t !== 'portal');
        magMoveToDepth(s, name, t, true, 0);
    }
}
function magMoveToDepth(s, name, target, salary, depth) {
    const p = s.players[name];
    if (salary && target < p.pos) { p.cash += MAG.SALARY; magLog(s, `${name} passe par la Station Mère : +${MAG.SALARY} cr.`); }
    p.pos = target;
    magLand(s, name, depth);
}
// Effet de la case sur laquelle le joueur vient d'arriver
function magLand(s, name, depth) {
    const p = s.players[name], sp = p.pos, c = MAG_SPACES[sp];
    s.phase = 'END';
    if (magOwnable(sp)) {
        const owner = magOwnerOf(s, sp);
        if (!owner) { s.phase = 'BUY'; s.buy = sp; magLog(s, `${name} arrive sur ${c.n}, libre (${c.p} cr).`); }
        else if (owner === name) magLog(s, `${name} arrive chez lui : ${c.n}.`);
        else if (magOwn(s, sp).m) magLog(s, `${name} arrive sur ${c.n} (hypothéquée) : pas de loyer.`);
        else magCharge(s, name, magRent(s, sp, s.dice[0] + s.dice[1]), owner, 'loyer ' + c.n);
    } else if (c.t === 'tax') magCharge(s, name, c.a, '', c.n);
    else if (c.t === 'card') magDrawCard(s, name, c.d);
    else if (c.t === 'gojail') magJail(s, name);
    else magLog(s, `${name} arrive sur ${c.n}.`);
}
function magGive(s, sp, name) { s.own['s' + sp] = { o: name, h: 0, m: false }; }
function magFinish(s) {
    s.status = 'FINISHED';
    s.auction = null; s.trade = null; s.debts = [];
    const alive = magAlive(s).map(n => ({ n: n, w: magWorth(s, n) })).sort((a, b) => b.w - a.w);
    const out = s.order.filter(n => s.players[n].out).sort((a, b) => (s.players[b].outAt || 0) - (s.players[a].outAt || 0)).map(n => ({ n: n, w: 0 }));
    s.rank = alive.concat(out);
    magLog(s, `Fin de la partie : ${s.rank[0].n} l'emporte !`);
}
function magNextTurn(s, now) {
    s.trade = null; s.dbl = 0; s.again = false; s.buy = -1;
    if (magAlive(s).length <= 1 || (s.endAt && now >= s.endAt)) { magFinish(s); return; }
    for (let k = 0; k < s.order.length * 4; k++) {
        s.turn = (s.turn + 1) % s.order.length;
        const q = s.players[s.order[s.turn]];
        if (q.out) continue;
        if (q.skip > 0) { q.skip--; magLog(s, `${s.order[s.turn]} passe son tour (carte Cargaison).`); continue; }
        break;
    }
    s.phase = 'ROLL'; s.turnCount++;
}
function magCloseAuction(s) {
    const a = s.auction;
    if (!a) return;
    if (a.act.length === 0 || (a.act.length === 1 && a.by === a.act[0])) {
        if (a.by) {
            s.players[a.by].cash -= a.bid;
            magGive(s, a.sp, a.by);
            magLog(s, `${a.by} remporte ${MAG_SPACES[a.sp].n} aux enchères pour ${a.bid} cr.`);
        } else magLog(s, `Personne n'enchérit : ${MAG_SPACES[a.sp].n} reste libre.`);
        s.auction = null; s.buy = -1; s.phase = 'END';
    }
}
function magSellAllBuildings(s, name) {
    magOwned(s, name).forEach(sp => {
        const o = magOwn(s, sp);
        if (o.h) { s.players[name].cash += Math.floor(o.h * magHouseCost(sp) / 2); o.h = 0; }
    });
}
function magBankrupt(s, name, to, now) {
    const p = s.players[name];
    magSellAllBuildings(s, name);
    const heir = (to && s.players[to] && !s.players[to].out && to !== name) ? to : '';
    if (heir) {
        s.players[heir].cash += Math.max(0, p.cash);
        s.players[heir].cards = (s.players[heir].cards || 0) + (p.cards || 0);
        magOwned(s, name).forEach(sp => { magOwn(s, sp).o = heir; });
    } else {
        magOwned(s, name).forEach(sp => { delete s.own['s' + sp]; });
    }
    p.cash = 0; p.cards = 0; p.out = true; p.jail = 0; p.outAt = ++s.outCount;
    s.debts = s.debts.filter(d => d.who !== name);
    if (s.trade && (s.trade.from === name || s.trade.to === name)) s.trade = null;
    magLog(s, `${name} fait faillite${heir ? ' : ses biens reviennent à ' + heir : ' : ses propriétés retournent à la banque'}.`);
    if (magAlive(s).length <= 1) { magFinish(s); return; }
    if (s.auction) {
        const a = s.auction, k = a.act.indexOf(name);
        if (k >= 0) { a.act.splice(k, 1); if (k < a.i) a.i--; if (a.i >= a.act.length) a.i = 0; }
        magCloseAuction(s);
    }
    if (s.order[s.turn] === name && !s.auction) magNextTurn(s, now);
}
// Échéance : repart à zéro à chaque fois que le joueur attendu ou l'étape change
function magDeadline(s, now) {
    if (s.status !== 'PLAYING') return;
    const a = s.auction;
    const key = [s.turnCount, s.phase, magActor(s), s.rollSeq, s.again ? 1 : 0, s.debts.length,
        a ? a.i + '/' + a.bid + '/' + a.act.length : ''].join(':');
    if (key !== s.dlKey) {
        s.dlKey = key; s.dlAt = now;
        s.dl = now + (a ? MAG.AUCTION_SECONDS : (s.phase === 'CARD' && !s.debts.length ? MAG.CARD_SECONDS : s.timer)) * 1000;
    }
}

// ----- Application d'une action. Renvoie le nouvel état, ou null si l'action est refusée -----
function magApply(s0, a, now, rnd) {
    if (!s0 || s0.status !== 'PLAYING' || !a || typeof a.by !== 'string') return null;
    const s = JSON.parse(JSON.stringify(s0));
    rnd = rnd || Math.random;
    const by = a.by, P = s.players, cur = s.order[s.turn];
    if (!P[by] || P[by].out) return null;
    const me = P[by];
    const myTurn = by === cur && !s.debts.length && !s.auction;
    const sp = Number(a.sp);

    switch (a.t) {
    case 'roll': {
        if (!myTurn || !(s.phase === 'ROLL' || (s.phase === 'END' && s.again))) return null;
        const d1 = 1 + Math.floor(rnd() * 6), d2 = 1 + Math.floor(rnd() * 6), dbl = d1 === d2, sum = d1 + d2;
        s.dice = [d1, d2]; s.rollSeq++; s.card = null; s.again = false;
        const go = () => {
            const from = me.pos, target = (from + sum) % MAG_N;
            magLog(s, `${by} lance ${d1} + ${d2} = ${sum}.`);
            if (from + sum >= MAG_N) { me.cash += MAG.SALARY; magLog(s, `${by} passe par la Station Mère : +${MAG.SALARY} cr.`); }
            me.pos = target;
            magLand(s, by, 0);
        };
        if (me.jail > 0) {
            if (dbl) { me.jail = 0; magLog(s, `${by} fait un double et sort de Quarantaine !`); go(); }
            else if (me.jail >= 3) { me.jail = 0; magLog(s, `${by} lance ${d1} + ${d2} : troisième échec, caution obligatoire.`); magCharge(s, by, MAG.BAIL, '', 'caution'); go(); }
            else { me.jail++; s.phase = 'END'; magLog(s, `${by} lance ${d1} + ${d2} : pas de double, il reste en Quarantaine.`); }
        } else {
            if (dbl) s.dbl++; else s.dbl = 0;
            if (s.dbl >= 3) { magLog(s, `${by} lance ${d1} + ${d2} : troisième double de suite !`); magJail(s, by); }
            else { go(); if (dbl && me.jail === 0 && !me.out) s.again = true; }
        }
        break;
    }
    case 'card': {
        if (!myTurn || s.phase !== 'CARD' || !s.card || !s.card.p) return null;
        const card = MAG_CARDS[s.card.d] && MAG_CARDS[s.card.d][s.card.i];
        s.card.p = false; s.phase = 'END';
        if (card) magCardEffect(s, by, card);
        if (me.jail > 0 || me.out) s.again = false;
        break;
    }
    case 'bail': {
        if (!myTurn || s.phase !== 'ROLL' || me.jail <= 0 || me.cash < MAG.BAIL) return null;
        me.cash -= MAG.BAIL; me.jail = 0;
        magLog(s, `${by} paie ${MAG.BAIL} cr de caution et sort de Quarantaine.`);
        break;
    }
    case 'usecard': {
        if (!myTurn || s.phase !== 'ROLL' || me.jail <= 0 || !(me.cards > 0)) return null;
        me.cards--; me.jail = 0;
        magLog(s, `${by} utilise un sauf-conduit et sort de Quarantaine.`);
        break;
    }
    case 'buy': {
        if (!myTurn || s.phase !== 'BUY' || !magOwnable(s.buy) || me.cash < MAG_SPACES[s.buy].p) return null;
        me.cash -= MAG_SPACES[s.buy].p;
        magGive(s, s.buy, by);
        magLog(s, `${by} achète ${MAG_SPACES[s.buy].n} pour ${MAG_SPACES[s.buy].p} cr.`);
        s.buy = -1; s.phase = 'END';
        break;
    }
    case 'auction': {
        if (!myTurn || s.phase !== 'BUY' || !magOwnable(s.buy)) return null;
        const alive = magAlive(s), k = alive.indexOf(by);
        s.auction = { sp: s.buy, bid: 0, by: '', act: alive.slice(k).concat(alive.slice(0, k)), i: 0 };
        s.phase = 'AUCTION';
        magLog(s, `${MAG_SPACES[s.buy].n} est mise aux enchères.`);
        break;
    }
    case 'bid': {
        const au = s.auction, amt = Math.floor(Number(a.amt) || 0);
        if (!au || s.debts.length || au.act[au.i] !== by || amt <= au.bid || amt > me.cash) return null;
        au.bid = amt; au.by = by; au.i = (au.i + 1) % au.act.length;
        magLog(s, `${by} enchérit à ${amt} cr.`);
        magCloseAuction(s);
        break;
    }
    case 'pass': {
        const au = s.auction;
        if (!au || s.debts.length || au.act[au.i] !== by) return null;
        au.act.splice(au.i, 1);
        if (au.i >= au.act.length) au.i = 0;
        magLog(s, `${by} se retire des enchères.`);
        magCloseAuction(s);
        break;
    }
    case 'build': {
        if (!magCanManage(s, by) || magCheckBuild(s, by, sp)) return null;
        me.cash -= magHouseCost(sp);
        const o = magOwn(s, sp); o.h = (o.h || 0) + 1;
        magLog(s, `${by} construit ${o.h === 5 ? 'une métropole' : 'un avant-poste'} sur ${MAG_SPACES[sp].n}.`);
        break;
    }
    case 'sell': {
        if (!magCanManage(s, by) || magCheckSell(s, by, sp)) return null;
        const o = magOwn(s, sp), half = Math.floor(magHouseCost(sp) / 2);
        if (o.h === 5 && magSupply(s).houses < 4) {
            // Pénurie d'avant-postes : la métropole ne peut pas être remplacée, toute la famille est vendue
            let total = 0;
            magFamilySpaces(MAG_SPACES[sp].f).forEach(x => { const ox = magOwn(s, x); total += (ox.h || 0) * half; ox.h = 0; });
            me.cash += total;
            magLog(s, `${by} vend toutes les constructions de la famille ${MAG_FAMILIES[MAG_SPACES[sp].f].name} (+${total} cr).`);
        } else {
            o.h--; me.cash += half;
            magLog(s, `${by} vend une construction sur ${MAG_SPACES[sp].n} (+${half} cr).`);
        }
        break;
    }
    case 'mortgage': {
        if (!magCanManage(s, by) || magCheckMortgage(s, by, sp)) return null;
        magOwn(s, sp).m = true; me.cash += magMortgageValue(sp);
        magLog(s, `${by} hypothèque ${MAG_SPACES[sp].n} (+${magMortgageValue(sp)} cr, la moitié de son prix).`);
        break;
    }
    case 'unmortgage': {
        if (!magCanManage(s, by) || magCheckUnmortgage(s, by, sp)) return null;
        magOwn(s, sp).m = false; me.cash -= magUnmortgageCost(sp);
        magLog(s, `${by} lève l'hypothèque de ${MAG_SPACES[sp].n} (−${magUnmortgageCost(sp)} cr : ${magMortgageValue(sp)} remboursés + ${magUnmortgageCost(sp) - magMortgageValue(sp)} d'intérêts).`);
        break;
    }
    case 'propose': {
        if (!myTurn || !(s.phase === 'ROLL' || s.phase === 'END') || s.trade) return null;
        const tr = { from: by, to: String(a.to || ''), give: magCleanSide(a.give), get: magCleanSide(a.get), k: s.seq };
        if (magCheckTrade(s, tr)) return null;
        s.trade = tr;
        magLog(s, `${by} propose un échange à ${tr.to}.`);
        break;
    }
    case 'accept': {
        const tr = s.trade;
        if (!tr || tr.to !== by || s.debts.length || s.auction) return null;
        tr.give = magCleanSide(tr.give); tr.get = magCleanSide(tr.get);
        if (magCheckTrade(s, tr)) { s.trade = null; magLog(s, "L'échange n'est plus possible : il est annulé."); break; }
        const A = P[tr.from], B = P[tr.to];
        A.cash += tr.get.cash - tr.give.cash; B.cash += tr.give.cash - tr.get.cash;
        A.cards = (A.cards || 0) + tr.get.cards - tr.give.cards; B.cards = (B.cards || 0) + tr.give.cards - tr.get.cards;
        tr.give.props.forEach(x => { magOwn(s, x).o = tr.to; });
        tr.get.props.forEach(x => { magOwn(s, x).o = tr.from; });
        s.trade = null;
        magLog(s, `${by} accepte l'échange proposé par ${tr.from}.`);
        break;
    }
    case 'decline': {
        const tr = s.trade;
        if (!tr || (tr.to !== by && tr.from !== by)) return null;
        s.trade = null;
        magLog(s, tr.to === by ? `${by} refuse l'échange.` : `${by} retire sa proposition d'échange.`);
        break;
    }
    case 'bankrupt': {
        if (!s.debts.length || s.debts[0].who !== by) return null;
        magBankrupt(s, by, s.debts[0].to, now);
        break;
    }
    case 'end': {
        if (!myTurn || s.phase !== 'END' || s.again) return null;
        magNextTurn(s, now);
        break;
    }
    default: return null;
    }

    if (s.status === 'PLAYING') {
        magFlushDebts(s);
        magDeadline(s, now);
    }
    s.seq++;
    return s;
}

// Action automatique quand le joueur attendu ne joue pas à temps (ou a quitté le salon)
function magAuto(s, now, rnd) {
    if (s.status !== 'PLAYING') return null;
    const who = magActor(s);
    if (s.debts.length) {
        // Liquidation automatique : on vend tout, on hypothèque tout ; si ça ne suffit pas, faillite
        let st = s, guard = 0;
        while (st && st.status === 'PLAYING' && st.debts.length && st.debts[0].who === who && guard++ < 200) {
            const owned = magOwned(st, who);
            const sell = owned.find(sp => !magCheckSell(st, who, sp));
            const mort = sell === undefined ? owned.find(sp => !magCheckMortgage(st, who, sp)) : undefined;
            const act = sell !== undefined ? { t: 'sell', sp: sell } : (mort !== undefined ? { t: 'mortgage', sp: mort } : { t: 'bankrupt' });
            st = magApply(st, Object.assign({ by: who }, act), now, rnd) || st;
            if (act.t === 'bankrupt') break;
        }
        return st === s ? null : st;
    }
    if (s.auction) return magApply(s, { by: who, t: 'pass' }, now, rnd);
    if (s.phase === 'CARD') return magApply(s, { by: who, t: 'card' }, now, rnd);
    if (s.phase === 'BUY') return magApply(s, { by: who, t: 'auction' }, now, rnd);
    if (s.phase === 'ROLL' || (s.phase === 'END' && s.again)) return magApply(s, { by: who, t: 'roll' }, now, rnd);
    if (s.phase === 'END') return magApply(s, { by: who, t: 'end' }, now, rnd);
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MAG, MAG_SPACES, MAG_FAMILIES, MAG_CARDS, MAG_N, magNewGame, magNorm, magApply, magAuto, magActor, magAlive, magWorth, magOwned, magOwn, magSupply,
        magCheckBuild, magCheckSell, magCheckMortgage, magCheckUnmortgage, magTradable, magRent, magRentTable, magFamilySpaces, magHouses, magOwnerOf, magCanManage, magCheckTrade };
}

// ============================ 3) BOUCLE DE L'HÔTE ============================
const magHost = { startedAt: 0, state: null, done: {} };
const magUI = { seenSess: '', seenSeq: 0, sess: '', sel: -1, sig: '', trOpen: false, tr: null, bid: '', bk: false, lastRoll: -1, shown: '' };

function magEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function magRoom() { return window.currentCodeSalon || state.roomCode; }
function magMe() { return window.myPlayerKey || state.username; }

// Un joueur envoie une action à l'hôte
function magSend(action) {
    const code = magRoom();
    if (!code || !window.update) return;
    const key = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    window.update(window.ref(window.db, `salons/${code}`), { [`magnatGame/a/${key}`]: Object.assign({ by: magMe() }, action) })
        .catch(err => console.error('Action Magnat non envoyée :', err));
}

// État le plus récent connu de l'hôte (son dernier calcul peut précéder le retour de Firebase)
function magHostState(g) {
    const s = magNorm(g.s);
    if (magHost.state && magHost.startedAt === s.startedAt && magHost.state.seq > s.seq) return magHost.state;
    return s;
}
function magHostWrite(s, removeKeys, players) {
    magHost.startedAt = s.startedAt; magHost.state = s;
    const updates = { 'magnatGame/s': JSON.parse(JSON.stringify(s)) };
    removeKeys.forEach(k => { updates['magnatGame/a/' + k] = null; });
    if (s.status === 'FINISHED') s.rank.forEach(r => { if (players && players[r.n]) updates[`players/${r.n}/score`] = r.w; });
    window.update(window.ref(window.db, `salons/${magRoom()}`), updates)
        .catch(err => console.error('Mise à jour Magnat impossible :', err));
}
function magHostProcess(data) {
    const g = data.magnatGame;
    if (!window.isHost || !g || !g.s) return;
    const keys = Object.keys(g.a || {}).sort().filter(k => !magHost.done[k]);
    if (!keys.length) return;
    let s = magHostState(g), changed = false;
    const now = Date.now();
    keys.forEach(k => {
        magHost.done[k] = true;
        let next = null;
        try { next = magApply(s, g.a[k], now); } catch (e) { console.error('Action Magnat invalide :', e); }
        if (next) { s = next; changed = true; }
    });
    if (changed) magHostWrite(s, keys, data.players);
    else {
        const updates = {};
        keys.forEach(k => { updates['magnatGame/a/' + k] = null; });
        window.update(window.ref(window.db, `salons/${magRoom()}`), updates).catch(err => console.error(err));
    }
}
// Chaque seconde : si le joueur attendu a dépassé son temps (ou a quitté le salon depuis 20 s), l'hôte joue à sa place
function magHostTick() {
    const room = window.currentRoom;
    if (!window.isHost || !room || room.status !== 'IN_GAME' || room.selectedMode !== 'magnat' || !room.magnatGame || !room.magnatGame.s) return;
    const s = magHostState(room.magnatGame);
    if (s.status !== 'PLAYING') return;
    const now = Date.now();
    const present = Object.values(room.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const absent = present.indexOf(magActor(s)) < 0;
    if (now > s.dl || (absent && now > s.dlAt + 20000)) {
        let next = null;
        try { next = magAuto(s, now); } catch (e) { console.error('Tour automatique impossible :', e); }
        if (next) magHostWrite(next, [], room.players);
    }
}

// ============================ 4) AFFICHAGE ============================
const MAG_RO = 352, MAG_RB = 330, MAG_RI = 236, MAG_C = 360;
function magPt(r, deg) { const a = deg * Math.PI / 180; return [MAG_C + r * Math.sin(a), MAG_C - r * Math.cos(a)]; }
function magArc(r1, r2, a0, a1) {
    const p = (r, a) => magPt(r, a).map(v => v.toFixed(1)).join(' ');
    return `M${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
}
function magTextRot(deg) { return deg >= 180 ? deg + 90 : deg - 90; }
function magColor(s, name) { const p = s.players[name]; return p ? MAG_TOKEN_COLORS[p.c % MAG_TOKEN_COLORS.length] : '#64748b'; }

// Plateau fixe : l'anneau de 36 cases
function magBoardSvg() {
    let cells = '', hits = '';
    MAG_SPACES.forEach((c, i) => {
        const th = i * 10, a0 = th - 5, a1 = th + 5;
        const corner = c.t === 'start' || c.t === 'jail' || c.t === 'free' || c.t === 'gojail';
        cells += `<path d="${magArc(MAG_RI, MAG_RO, a0, a1)}" fill="${corner ? '#12294a' : '#0b1a2e'}" stroke="#24476f" stroke-width="1"/>`;
        if (c.t === 'prop') cells += `<path d="${magArc(MAG_RB, MAG_RO, a0, a1)}" fill="${MAG_FAMILIES[c.f].color}" stroke="#0b1a2e" stroke-width="1"/>`;
        const words = c.n.split(' ');
        const l1 = c.t === 'prop' ? words[0] : (c.i || '');
        const l2 = c.t === 'prop' ? words.slice(1).join(' ') : (words.length > 2 ? words.slice(0, -1).join(' ') : words[0]);
        const l3 = c.t === 'prop' ? c.p + ' cr' : (words.length > 1 ? words[words.length - 1] : (c.p ? c.p + ' cr' : ''));
        const mid = c.t === 'prop' ? 281 : 290;
        const pt = magPt(mid, th);
        cells += `<g transform="translate(${pt[0].toFixed(1)} ${pt[1].toFixed(1)}) rotate(${magTextRot(th)})" text-anchor="middle" font-family="Arial, sans-serif" pointer-events="none">
            <text y="-9" font-size="${c.t === 'prop' ? 10 : 15}" font-weight="bold" fill="#f1f5f9">${magEsc(l1)}</text>
            <text y="3" font-size="9.5" fill="#e2e8f0">${magEsc(l2)}</text>
            <text y="14" font-size="9" fill="${c.t === 'prop' ? '#fbbf24' : '#e2e8f0'}">${magEsc(l3)}</text></g>`;
        hits += `<path data-sp="${i}" d="${magArc(MAG_RI, MAG_RO, a0, a1)}" fill="transparent" style="cursor:pointer"/>`;
    });
    return `<svg id="mag-svg" viewBox="0 0 720 720" style="width:100%;height:100%;display:block">
        <defs><radialGradient id="mag-space" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#132a4d"/><stop offset="100%" stop-color="#050b16"/></radialGradient></defs>
        <circle cx="360" cy="360" r="${MAG_RO + 4}" fill="#050b16" stroke="#00d2ff" stroke-width="2"/>
        <circle cx="360" cy="360" r="${MAG_RI}" fill="url(#mag-space)"/>
        ${cells}
        <g id="mag-dyn"></g>
        <g id="mag-tokens"></g>
        <g id="mag-hits">${hits}</g>
    </svg>`;
}

// Éléments qui changent : propriétaires, constructions, hypothèques, sélection
function magRenderDyn(s) {
    const dyn = document.getElementById('mag-dyn');
    if (!dyn) return;
    let html = '';
    for (let i = 0; i < MAG_N; i++) {
        const th = i * 10, o = magOwn(s, i);
        if (o) {
            html += `<path d="${magArc(MAG_RI - 9, MAG_RI - 1, th - 4.4, th + 4.4)}" fill="${magColor(s, o.o)}" stroke="#020617" stroke-width="1"/>`;
            if (o.m) {
                const pt = magPt(250, th);
                html += `<path d="${magArc(MAG_RI, MAG_RO, th - 5, th + 5)}" fill="rgba(2,6,23,.72)"/>
                    <text transform="translate(${pt[0].toFixed(1)} ${pt[1].toFixed(1)}) rotate(${magTextRot(th)})" text-anchor="middle" font-size="9" font-weight="bold" fill="#f87171" font-family="Arial, sans-serif">HYP.</text>`;
            }
            const h = o.h || 0;
            if (h === 5) { const pt = magPt(341, th); html += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="7" fill="#fbbf24" stroke="#78350f" stroke-width="2"/><circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.5" fill="#78350f"/>`; }
            else for (let k = 0; k < h; k++) { const pt = magPt(341, th + (k - (h - 1) / 2) * 2.1); html += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="4" fill="#f8fafc" stroke="#0f172a" stroke-width="1.5"/>`; }
        }
        if (i === magUI.sel) html += `<path d="${magArc(MAG_RI, MAG_RO, th - 5, th + 5)}" fill="rgba(255,255,255,.08)" stroke="#ffffff" stroke-width="2.5"/>`;
    }
    dyn.innerHTML = html;
}
// ============================ PIONS ET ANIMATIONS DE DÉPLACEMENT ============================
// Les pions sont conservés d'un affichage à l'autre. Quand un joueur change de case, son pion est animé :
//   - lancer de dés ou petit trajet : il saute de case en case le long de l'anneau, en laissant une traînée ;
//   - recul (carte) : il saute à reculons ;
//   - long trajet (carte, portail) : saut hyperspatial, il disparaît en vrille et réapparaît à l'arrivée ;
//   - Quarantaine : il tremble, est aspiré dans un éclair rouge et réapparaît en Quarantaine ;
//   - passage par la Station Mère : « +200 cr » s'envole de la case.
//
// MODÈLES DE PIONS : chaque pion du dossier magnat-visuel/pions/ existe en deux fichiers portant le même nom :
//   <key>.glb  le modèle 3D allégé (affiché en relief sur le plateau quand le moteur 3D est disponible)
//   <key>.png  son image (vignette du choix de pion, et pion 2D de secours sans moteur 3D)
// Chaque joueur choisit son pion (bouton « 🎭 Mon pion ») ; sans choix, il reçoit un pion selon son rang.
// bb = boîte englobante du modèle [minX, minY, minZ, maxX, maxY, maxZ], qui sert à le mettre à l'échelle.
// Pour ajouter un pion : déposer <key>.glb et <key>.png dans le dossier, puis ajouter une ligne ci-dessous.
const MAG_PIONS_DIR = './magnat-visuel/pions/';
const MAG_PIONS = [
    { key: "pion", nom: "Pion danseur", titre: "Idle Pawn Animation Test", auteur: "tobywallace", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/idle-pawn-animation-test-ce8cad3a82fa4b90a0e9c4d435655c6c", bb: [-4.9586, 0.5239, -3.4381, 6.7811, 21.7454, 7.0601] },
    { key: "steampunk", nom: "Lanterne steampunk", titre: "Steampunk Widget Chess Pawn Preliminary Sketch", auteur: "Dawnstar-Chronicles", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/steampunk-widget-chess-pawn-preliminary-sketch-ddd41eae4c064dbcb42a70fb80d9cb85", bb: [-3.6834, -0.0135, -2.7817, 3.5432, 13.167, 3.4674] },
    { key: "astronaute", nom: "Petit astronaute", titre: "OutHere Space Buddy", auteur: "OutHereVR", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/outhere-space-buddy-4fb60251c9f446d0ad70b672bb0bf9c2", bb: [-0.4321, -0.0023, -0.4872, 0.1818, 1.184, 0.1357] },
    { key: "cephalopode", nom: "Céphalopode spatial", titre: "Space cephalopod", auteur: "XennaDemonorph", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/space-cephalopod-ae8fefbd633c429998eb3c15ffeb8d4d", bb: [-2.1958, -3.4482, -3.6076, 2.1966, 1.7637, 1.163] },
    { key: "maintenance", nom: "Robot de maintenance", titre: "space maintenance robot", auteur: "norbyscook (Andy An)", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/space-maintenance-robot-a612ed4feea14fc390beeb3a47943054", bb: [-0.8487, -0.7145, -0.9326, 0.8487, 0.9071, 1.238] },
    { key: "combat", nom: "Robot de combat", titre: "Combat Steampunk Robot", auteur: "Milin Andrei", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/combat-steampunk-robot-81914abdc5b64b259d36ec7044118949", bb: [-3.079, -0.1635, -1.2198, 3.0889, 3.5228, 3.1277] },
    { key: "chasseur", nom: "Chasseur Hammerhead", titre: "Hammerhead Space Fighter", auteur: "Pedro B. Goulart", licence: "CC-BY-4.0", source: "https://sketchfab.com/3d-models/hammerhead-space-fighter-19daeb543508430c8807edbcf27a9741", bb: [-9.6506, -3.2085, -21.9412, 9.6506, 9.2428, 9.6893] },
    { key: "robot", nom: "Char araignée", titre: "robot_unity_test", auteur: "eelgod", licence: "CC-BY-NC-4.0", source: "https://sketchfab.com/3d-models/robot-unity-test-bd526b0b811a463f9b9fb8cf9f113d56", bb: [-17.2652, 3.6123, -19.4512, 17.2652, 33.6248, 18.8297] }
];
const MAG_PION_TAILLE = 54;            // taille d'un pion sur le plateau (le plateau fait 720 unités de large)
function magPionInfo(key) { return MAG_PIONS.find(x => x.key === key) || null; }
// Pion d'un joueur : son choix enregistré dans le salon, sinon un pion attribué selon son rang
function magPionDe(s, name) {
    const room = (window.currentRoom && window.currentRoom.players) || (window.magData && window.magData.players) || {};
    const choix = room[name] && room[name].pion;
    if (choix && magPionInfo(choix)) return choix;
    const p = s && s.players ? s.players[name] : null;
    return MAG_PIONS[(p ? p.c : 0) % MAG_PIONS.length].key;
}
const magPions = {};                   // clé -> 'ok' | 'non' | liste de fonctions en attente
function magPionImage(key, cb) {
    const st = magPions[key];
    if (st === 'ok') { cb(); return; }
    if (st === 'non') return;
    if (Array.isArray(st)) { st.push(cb); return; }
    magPions[key] = [cb];
    const img = new Image();
    img.onload = () => { const l = magPions[key]; magPions[key] = 'ok'; l.forEach(f => f()); };
    img.onerror = () => { magPions[key] = 'non'; };
    img.src = MAG_PIONS_DIR + key + '.png';
}
const magTok = {};                     // état d'animation de chaque pion : { pos, jail, gen, cible, fin }
const MAG_NS = 'http://www.w3.org/2000/svg';
function magFxLayer() {
    let fx = document.getElementById('mag-fx');
    const layer = document.getElementById('mag-tokens');
    if (!fx && layer) { fx = document.createElementNS(MAG_NS, 'g'); fx.setAttribute('id', 'mag-fx'); fx.setAttribute('pointer-events', 'none'); layer.parentNode.insertBefore(fx, layer); }
    return fx;
}
// Petit effet posé sur le plateau puis retiré : onde, point de traînée ou texte qui s'envole
function magFx(pt, inner, ms) {
    const fx = magFxLayer();
    if (!fx) return;
    const g = document.createElementNS(MAG_NS, 'g');
    g.setAttribute('transform', `translate(${pt[0].toFixed(1)} ${pt[1].toFixed(1)})`);
    g.innerHTML = inner;
    fx.appendChild(g);
    setTimeout(() => g.remove(), ms);
}
function magFxOnde(pt, color) { magFx(pt, `<circle class="mag-fx-onde" r="13" fill="none" stroke="${color}" stroke-width="3"/><circle class="mag-fx-onde2" r="13" fill="none" stroke="${color}" stroke-width="2"/>`, 900); }
function magFxTrace(pt, color) { magFx(pt, `<circle class="mag-fx-trace" r="6" fill="${color}"/>`, 750); }
function magFxTexte(pt, txt, color) { magFx(pt, `<text class="mag-fx-texte" text-anchor="middle" font-size="17" font-weight="bold" fill="${color}" stroke="#020617" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif">${magEsc(txt)}</text>`, 1500); }
function magTokPlace(g, pt, transition) { g.style.transition = transition; g.style.transform = `translate(${pt[0].toFixed(1)}px, ${pt[1].toFixed(1)}px)`; }
function magTokJoue(g, cls) {          // relance une animation CSS sur le dessin du pion
    const inn = g.querySelector('.mag-tok-in');
    if (!inn) return;
    inn.classList.remove('mag-hop', 'mag-land', 'mag-warp-out', 'mag-warp-in', 'mag-tremble');
    void inn.getBoundingClientRect();
    if (cls) inn.classList.add(cls);
}
// Saut de case en case (cases = liste des cases traversées, la dernière étant l'arrivée)
function magTokSauts(g, st, cases, color, fini) {
    const gen = st.gen, pas = cases.length > 8 ? 135 : 185;
    let i = 0, avant = magPt(214, st.pos * 10);
    const etape = () => {
        if (st.gen !== gen) return;
        const sp = cases[i], dernier = i === cases.length - 1;
        const pt = dernier ? st.fin : magPt(214, sp * 10);
        magFxTrace(avant, color);
        magTokPlace(g, pt, `transform ${pas - 25}ms cubic-bezier(.3,.6,.4,1)`);
        magTokJoue(g, 'mag-hop');
        if (sp === 0 && st.avance) magFxTexte(magPt(214, 0), '+' + MAG.SALARY + ' cr', '#6ee7b7');
        avant = pt; st.pos = sp; i++;
        if (dernier) setTimeout(() => { if (st.gen === gen) fini(); }, pas);
        else setTimeout(etape, pas);
    };
    etape();
}
// Disparition en vrille puis réapparition à l'arrivée (saut hyperspatial, ou capture par la Patrouille en rouge)
function magTokSaut(g, st, color, fini) {
    const gen = st.gen;
    magFxOnde(magPt(214, st.pos * 10), color);
    magTokJoue(g, 'mag-warp-out');
    setTimeout(() => {
        if (st.gen !== gen) return;
        magTokPlace(g, st.fin, 'none');
        st.pos = st.cible;
        magTokJoue(g, 'mag-warp-in');
        magFxOnde(st.fin, color);
        setTimeout(() => { if (st.gen === gen) fini(); }, 420);
    }, 400);
}
function magRenderTokens(s) {
    const layer = document.getElementById('mag-tokens');
    if (!layer) return;
    const calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const perSpace = {}, total = {};
    s.order.forEach(n => { const p = s.players[n]; if (!p.out) total[p.pos] = (total[p.pos] || 0) + 1; });
    s.order.forEach((n, idx) => {
        const p = s.players[n];
        let g = document.getElementById('mag-tok-' + idx);
        if (p.out) { if (g) g.remove(); if (magTok[idx]) magTok[idx].gen++; delete magTok[idx]; return; }
        const color = magColor(s, n);
        const k = perSpace[p.pos] = (perSpace[p.pos] || 0) + 1;
        const slot = k - 1;
        // jusqu'à 4 pions : une file vers le centre ; au-delà : deux files côte à côte
        const two = total[p.pos] > 4;
        const pt = magPt(214 - (two ? Math.floor(slot / 2) : slot) * 23.5, p.pos * 10 + (two ? (slot % 2 ? 4.2 : -4.2) : 0));
        let st = magTok[idx];
        const pion = magPionDe(s, n);
        if (!g || !st || st.sess !== s.startedAt || st.pion !== pion) {
            // premier affichage (ou retour dans la partie) : le pion est posé directement sur sa case
            if (g) g.remove();
            if (st) st.gen++;
            g = document.createElementNS(MAG_NS, 'g');
            g.setAttribute('id', 'mag-tok-' + idx);
            g.innerHTML = `<g class="mag-tok-in"><circle class="mag-tok-halo" r="17" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0"/><circle class="mag-tok-rond" r="12" fill="${color}" stroke="#020617" stroke-width="2.5"/><text text-anchor="middle" y="4" font-size="11" font-weight="bold" fill="#020617" font-family="Arial, sans-serif">${magEsc(String(n).charAt(0).toUpperCase())}</text><title>${magEsc(n)}</title></g>`;
            layer.appendChild(g);
            magTokPlace(g, pt, 'none');
            st = magTok[idx] = { sess: s.startedAt, pion: pion, pos: p.pos, jail: p.jail, gen: 0, cible: p.pos, fin: pt, occupe: false };
            // image du modèle choisi (remplacée par le modèle 3D quand le moteur 3D est prêt)
            const cible = g;
            g.dataset.pion = pion;
            magPionImage(pion, () => {
                const inn = cible.querySelector('.mag-tok-in'), rond = cible.querySelector('.mag-tok-rond'), txt = cible.querySelector('text');
                if (!inn || !rond || cible.querySelector('image')) return;
                const t = MAG_PION_TAILLE - 4;
                rond.setAttribute('r', '14'); rond.setAttribute('fill', color); rond.setAttribute('fill-opacity', '.28'); rond.setAttribute('stroke', color); rond.setAttribute('stroke-width', '2');
                rond.dataset.modele = '1';
                if (txt) txt.remove();
                const im = document.createElementNS(MAG_NS, 'image');
                im.setAttribute('href', MAG_PIONS_DIR + pion + '.png');
                im.setAttribute('x', -t / 2); im.setAttribute('y', -t / 2); im.setAttribute('width', t); im.setAttribute('height', t);
                im.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                im.style.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,.7))';
                inn.insertBefore(im, inn.querySelector('title'));
            });
        } else if (st.cible !== p.pos) {
            // le joueur a changé de case : on choisit l'animation
            const depuis = st.pos, avance = (p.pos - depuis + MAG_N) % MAG_N, recul = MAG_N - avance;
            const prison = p.jail > 0 && p.pos === MAG.JAIL && !(st.jail > 0);
            st.gen++; st.cible = p.pos; st.fin = pt; st.occupe = true;
            const fini = () => { st.occupe = false; st.pos = st.cible; magTokPlace(g, st.fin, 'transform .3s ease'); magTokJoue(g, 'mag-land'); magFxOnde(st.fin, prison ? '#f87171' : color); };
            if (calme || avance === 0) { st.pos = p.pos; st.occupe = false; magTokPlace(g, pt, calme ? 'none' : 'transform .45s ease'); }
            else if (prison) {
                const gen = st.gen;
                magTokJoue(g, 'mag-tremble');
                magFxTexte(magPt(214, depuis * 10), '🚨', '#f87171');
                setTimeout(() => { if (st.gen === gen) magTokSaut(g, st, '#f87171', fini); }, 420);
            } else if (avance === s.dice[0] + s.dice[1] || avance <= 12) {
                const cases = []; for (let i = 1; i <= avance; i++) cases.push((depuis + i) % MAG_N);
                st.avance = true; magTokSauts(g, st, cases, color, fini);
            } else if (recul <= 6) {
                const cases = []; for (let i = 1; i <= recul; i++) cases.push((depuis - i + MAG_N) % MAG_N);
                st.avance = false; magTokSauts(g, st, cases, color, fini);
            } else magTokSaut(g, st, '#a5f3fc', fini);
        } else {
            // même case : le pion se décale seulement si d'autres pions arrivent ou partent
            st.fin = pt;
            if (!st.occupe) magTokPlace(g, pt, 'transform .45s ease');
        }
        st.jail = p.jail;
        const rond = g.querySelector('.mag-tok-rond'), halo = g.querySelector('.mag-tok-halo');
        if (rond) { if (!rond.dataset.modele) rond.setAttribute('stroke', n === s.order[s.turn] ? '#ffffff' : '#020617'); rond.setAttribute('stroke-dasharray', p.jail > 0 ? '4 3' : ''); }
        if (halo) halo.setAttribute('opacity', rond && rond.dataset.modele && n === s.order[s.turn] ? '.9' : '0');
    });
    mag3dSync(s);
}

// ============================ PIONS EN 3D ============================
// Un canevas WebGL transparent est posé sur le plateau. Chaque pion y est un vrai modèle 3D qui suit, image par
// image, la position et les animations (sauts, vrille, écrasement) de son pion SVG. Le moteur 3D (three.js) est
// chargé seulement à l'ouverture de Magnat ; s'il est absent, refusé ou en panne, les pions restent des images.
const mag3d = { etat: '', items: {}, raf: 0, t0: 0, taille: 0 };
const MAG_3D_SCRIPTS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'];
function mag3dVoulu() { try { return localStorage.getItem('lmlp-3d') !== '0'; } catch (e) { return true; } }
function mag3dScript(src) {
    if (typeof sysChargerScript === 'function') return sysChargerScript(src);
    return new Promise((ok, ko) => { const el = document.createElement('script'); el.src = src; el.async = false; el.onload = ok; el.onerror = () => ko(new Error(src)); document.head.appendChild(el); });
}
function mag3dArret(definitif) {
    if (mag3d.raf) cancelAnimationFrame(mag3d.raf);
    mag3d.raf = 0;
    try { if (mag3d.renderer) mag3d.renderer.dispose(); } catch (e) {}
    if (mag3d.canvas) mag3d.canvas.remove();
    mag3d.renderer = mag3d.scene = mag3d.cam = mag3d.canvas = null;
    mag3d.items = {};
    document.querySelectorAll('.mag-tok-3d').forEach(g => g.classList.remove('mag-tok-3d'));
    mag3d.etat = definitif ? 'non' : (mag3d.etat === 'non' ? 'non' : (window.THREE && THREE.GLTFLoader ? 'pret' : ''));
}
function mag3dSync(s) {
    if (typeof window === 'undefined' || !document.getElementById('mag-board')) return;
    if (!mag3dVoulu()) { if (mag3d.canvas) mag3dArret(false); return; }
    if (mag3d.etat === 'non' || mag3d.etat === 'cours') return;
    if (mag3d.etat === '') {
        if (window.THREE && THREE.GLTFLoader) mag3d.etat = 'pret';
        else {
            mag3d.etat = 'cours';
            const besoin = window.THREE ? MAG_3D_SCRIPTS.slice(1) : MAG_3D_SCRIPTS;
            besoin.reduce((p, src) => p.then(() => mag3dScript(src)), Promise.resolve())
                .then(() => { mag3d.etat = window.THREE && THREE.GLTFLoader ? 'pret' : 'non'; const cur = magCurrent(); if (cur) mag3dSync(cur); })
                .catch(err => { mag3d.etat = 'non'; console.warn('Pions 3D indisponibles, pions en images :', err && err.message); });
            return;
        }
    }
    try {
        if (mag3d.canvas && !mag3d.canvas.isConnected) mag3dArret(false);      // nouveau plateau : on repart d'un canevas neuf
        if (!mag3d.canvas) mag3dInit();
        // un modèle par pion présent sur le plateau
        const vus = {};
        s.order.forEach((n, idx) => {
            const g = document.getElementById('mag-tok-' + idx);
            if (!g || s.players[n].out) return;
            vus[idx] = true;
            const key = g.dataset.pion, it = mag3d.items[idx];
            if (it && it.key === key && it.g === g) return;
            if (it) mag3dRetirer(idx);
            mag3dCharger(idx, key, g, magColor(s, n));
        });
        Object.keys(mag3d.items).forEach(idx => { if (!vus[idx]) mag3dRetirer(idx); });
        if (!mag3d.raf) mag3d.raf = requestAnimationFrame(mag3dImage);
    } catch (err) {
        console.warn('Pions 3D désactivés :', err);
        mag3dArret(true);
    }
}
function mag3dInit() {
    const board = document.getElementById('mag-board'), svg = document.getElementById('mag-svg');
    const canvas = document.createElement('canvas');
    canvas.id = 'mag-3d';
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
    svg.insertAdjacentElement('afterend', canvas);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    // repère du plateau : x vers la droite, y vers le bas (comme le SVG, 720 × 720) ; la profondeur suit y
    const cam = new THREE.OrthographicCamera(0, 720, 0, -720, -2000, 2000);
    cam.position.set(0, 0, 1000);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a6a, 1.05));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15); sun.position.set(0.5, 0.9, 1.2); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.45); rim.position.set(-1, 0.3, -0.6); scene.add(rim);
    mag3d.canvas = canvas; mag3d.renderer = renderer; mag3d.cam = cam; mag3d.scene = scene; mag3d.taille = 0; mag3d.t0 = performance.now();
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); mag3dArret(true); });
}
function mag3dRetirer(idx) {
    const it = mag3d.items[idx];
    if (!it) return;
    if (it.pivot && mag3d.scene) mag3d.scene.remove(it.pivot);
    if (it.g) it.g.classList.remove('mag-tok-3d');
    delete mag3d.items[idx];
}
function mag3dCharger(idx, key, g, color) {
    const info = magPionInfo(key);
    if (!info) return;
    const it = mag3d.items[idx] = { key: key, g: g, pivot: null, mixer: null, pret: false };
    new THREE.GLTFLoader().load(MAG_PIONS_DIR + key + '.glb', gltf => {
        if (mag3d.items[idx] !== it || !mag3d.scene) return;      // pion changé ou retiré pendant le chargement
        const obj = gltf.scene, bb = info.bb;
        const larg = Math.max(bb[3] - bb[0], bb[5] - bb[2]), haut = bb[4] - bb[1];
        const k = MAG_PION_TAILLE / Math.max(haut, larg * 0.9, 1e-6);
        obj.scale.setScalar(k);
        obj.position.set(-(bb[0] + bb[3]) / 2 * k, -bb[1] * k, -(bb[2] + bb[5]) / 2 * k);      // centré, les pieds à l'origine
        obj.traverse(o => { o.frustumCulled = false; });
        const tour = new THREE.Group(); tour.add(obj);                     // tourne sur lui-même
        const pivot = new THREE.Group(); pivot.add(tour);                 // posé sur la case, légèrement penché vers le joueur
        pivot.rotation.x = 0.32;
        it.pivot = pivot; it.tour = tour;
        if (gltf.animations && gltf.animations.length) { it.mixer = new THREE.AnimationMixer(obj); it.mixer.clipAction(gltf.animations[0]).play(); }
        mag3d.scene.add(pivot);
        it.pret = true;
        g.classList.add('mag-tok-3d');      // l'image 2D du pion est masquée, le disque de couleur reste comme socle
    }, undefined, err => { console.warn('Modèle 3D non chargé (' + key + ') : le pion reste en image.', err && err.message); });
}
function mag3dMatrice(el) {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return [1, 0, 0, 1, 0, 0];
    const v = t.slice(t.indexOf('(') + 1, -1).split(',').map(Number);
    return v.length === 6 ? v : [v[0], v[1], v[4], v[5], v[12], v[13]];
}
function mag3dImage(now) {
    mag3d.raf = 0;
    const board = document.getElementById('mag-board');
    if (!mag3d.renderer || !board || !mag3d.canvas || !mag3d.canvas.isConnected) { mag3dArret(false); return; }
    try {
        const dt = Math.min(0.1, (now - (mag3d.dernier || now)) / 1000); mag3d.dernier = now;
        const w = board.clientWidth;
        if (w && w !== mag3d.taille) {
            mag3d.taille = w;
            mag3d.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, document.body.classList.contains('mob') ? 1.5 : 2));
            mag3d.renderer.setSize(w, w, false);
        }
        const t = (now - mag3d.t0) / 1000;
        Object.keys(mag3d.items).forEach(idx => {
            const it = mag3d.items[idx];
            if (!it.pret) return;
            if (!it.g.isConnected) { it.pivot.visible = false; return; }
            const m = mag3dMatrice(it.g);                                   // position du pion SVG (en cours de glissement)
            const inn = it.g.querySelector('.mag-tok-in');
            const mi = inn ? mag3dMatrice(inn) : [1, 0, 0, 1, 0, 0];        // saut, écrasement, vrille en cours
            const sx = Math.hypot(mi[0], mi[1]), sy = Math.hypot(mi[2], mi[3]), rot = Math.atan2(mi[1], mi[0]);
            const op = inn ? parseFloat(getComputedStyle(inn).opacity) : 1;
            const x = m[4] + mi[4], y = m[5] + mi[5] * 1.6 + 13;            // les pieds un peu sous le centre du socle
            it.pivot.visible = op > 0.03 && sx > 0.02;
            it.pivot.position.set(x, -y, y * 0.6);                          // plus bas sur le plateau = devant
            it.pivot.scale.set(sx, sy, sx);
            it.tour.rotation.y = -0.5 + Math.sin(t * 0.9 + idx * 1.7) * 0.45 + rot * 2;
            if (it.mixer) it.mixer.update(dt);
        });
        mag3d.renderer.render(mag3d.scene, mag3d.cam);
        mag3d.raf = requestAnimationFrame(mag3dImage);
    } catch (err) {
        console.warn('Pions 3D désactivés :', err);
        mag3dArret(true);
    }
}

// ============================ CHOIX DU PION ============================
function magFermerPions() { const el = document.getElementById('mag-pions'); if (el) el.remove(); }
function magChoisirPion(key) {
    const moi = window.myPlayerKey, code = window.currentCodeSalon;
    if (!magPionInfo(key)) return;
    try { localStorage.setItem('lmlp-pion', key); } catch (e) {}
    if (moi && code && window.update && !window.estSpectateur) {
        window.update(window.ref(window.db, 'salons/' + code), { ['players/' + moi + '/pion']: key }).catch(err => console.error('Pion :', err));
    }
    if (typeof window.sfx === 'function') window.sfx('clic');
    magFermerPions();
}
// Un joueur qui a déjà choisi un pion lors d'une soirée précédente le retrouve automatiquement
function magPionMemoire(data) {
    const moi = window.myPlayerKey, code = window.currentCodeSalon;
    if (!moi || !code || window.estSpectateur || !data || !data.players || !data.players[moi] || data.players[moi].pion) return;
    let k = ''; try { k = localStorage.getItem('lmlp-pion') || ''; } catch (e) {}
    if (k && magPionInfo(k) && window.update) window.update(window.ref(window.db, 'salons/' + code), { ['players/' + moi + '/pion']: k }).catch(() => {});
}
function magBasculer3d() {
    try { localStorage.setItem('lmlp-3d', mag3dVoulu() ? '0' : '1'); } catch (e) {}
    if (mag3d.etat === 'non' && mag3dVoulu()) mag3d.etat = '';      // nouvel essai si l'utilisateur le redemande
    const cur = magCurrent(); if (cur) mag3dSync(cur);
    magOuvrirPions();
}
function magOuvrirPions() {
    magFermerPions();
    const room = window.currentRoom || window.magData || {}, players = room.players || {}, moi = window.myPlayerKey;
    const cur = magCurrent();
    const pris = {};
    Object.values(players).forEach(p => { if (p && p.name && !p.isBot) { const k = cur && cur.players && cur.players[p.name] ? magPionDe(cur, p.name) : p.pion; if (k) (pris[k] = pris[k] || []).push(p.name); } });
    const mien = players[moi] ? (cur && cur.players && cur.players[moi] ? magPionDe(cur, moi) : players[moi].pion) : '';
    const ov = document.createElement('div');
    ov.id = 'mag-pions';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(2,6,23,.82);display:flex;align-items:center;justify-content:center;padding:12px';
    ov.onclick = e => { if (e.target === ov) magFermerPions(); };
    const cartes = MAG_PIONS.map(m => {
        const qui = (pris[m.key] || []).filter(n => n !== moi);
        return `<button onclick="magChoisirPion('${m.key}')" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px 8px;border-radius:14px;cursor:pointer;font-family:inherit;border:2px solid ${m.key === mien ? '#34d399' : 'rgba(148,163,184,.3)'};background:${m.key === mien ? 'rgba(6,78,59,.55)' : 'rgba(15,23,42,.9)'}">
            <img src="${MAG_PIONS_DIR}${m.key}.png" alt="" loading="lazy" style="width:100%;max-width:104px;aspect-ratio:1/1;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))">
            <span style="font-weight:800;font-size:12px;color:#f8fafc;line-height:1.15">${magEsc(m.nom)}</span>
            <span style="font-size:10px;min-height:12px;color:${m.key === mien ? '#6ee7b7' : '#94a3b8'}">${m.key === mien ? '✓ Votre pion' : (qui.length ? 'Aussi : ' + magEsc(qui.join(', ')) : '')}</span>
        </button>`;
    }).join('');
    const credits = MAG_PIONS.map(m => `« <a href="${m.source}" target="_blank" rel="noopener" style="color:#7dd3fc">${magEsc(m.titre)}</a> » par ${magEsc(m.auteur)} (${m.licence})`).join(' · ');
    const etat3d = !mag3dVoulu() ? 'désactivés' : (mag3d.etat === 'non' ? 'indisponibles sur cet appareil' : 'activés');
    ov.innerHTML = `<div style="width:min(560px,100%);max-height:94vh;overflow-y:auto;background:#091424;border:1px solid #22d3ee;border-radius:18px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
            <span class="sci-font" style="font-weight:800;letter-spacing:.12em;font-size:15px;color:#a5f3fc">🎭 CHOISIR MON PION</span>
            <button onclick="magFermerPions()" style="border:1px solid #475569;background:transparent;color:#cbd5e1;border-radius:8px;padding:3px 10px;cursor:pointer;font-family:inherit">✕</button>
        </div>
        ${window.estSpectateur || !players[moi] ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:8px">Vous êtes spectateur : le choix du pion est réservé aux joueurs.</div>' : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px">${cartes}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(148,163,184,.2)">
            <span style="font-size:12px;color:#cbd5e1">Pions en 3D : <b style="color:#f8fafc">${etat3d}</b></span>
            <button onclick="magBasculer3d()" style="border:1px solid #475569;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit">${mag3dVoulu() ? 'Passer aux images (plus léger)' : 'Activer la 3D'}</button>
        </div>
        <details style="margin-top:8px;font-size:10px;color:#94a3b8;line-height:1.5"><summary style="cursor:pointer">Crédits des modèles 3D</summary>
            Modèles allégés pour le jeu à partir de : ${credits}. « Char araignée » : usage non commercial uniquement.</details>
    </div>`;
    document.body.appendChild(ov);
}
// Bouton « Choisir mon pion » affiché dans le salon (réglages de l'hôte et dossier de mission des autres joueurs)
function magBoutonPion() {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = '🎭 Choisir mon pion';
    b.onclick = magOuvrirPions;
    b.style.cssText = 'display:block;margin-top:6px;padding:6px 12px;border-radius:8px;border:1px solid #22d3ee;background:rgba(8,51,68,.7);color:#a5f3fc;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit';
    return b;
}

function magDie(n) {
    const dots = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] }[n] || [];
    return `<svg viewBox="0 0 40 40" style="width:42px;height:42px"><rect x="2" y="2" width="36" height="36" rx="8" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>${dots.map(d => `<circle cx="${d[0] * 10}" cy="${d[1] * 10}" r="3.6" fill="#0f172a"/>`).join('')}</svg>`;
}
function magPhaseText(s) {
    const cur = s.order[s.turn];
    if (s.debts.length) return `${s.debts[0].who} doit régler une dette`;
    if (s.auction) return `Enchères : au tour de ${s.auction.act[s.auction.i]}`;
    if (s.phase === 'ROLL') return s.players[cur].jail > 0 ? `${cur} est en Quarantaine` : `${cur} doit lancer les dés`;
    if (s.phase === 'CARD') return `${cur} a tiré une carte ${s.card ? MAG_DECK_NAMES[s.card.d] : ''}`;
    if (s.phase === 'BUY') return `${cur} : acheter ou mettre aux enchères ?`;
    return s.again ? `${cur} rejoue (double)` : `${cur} gère ses biens`;
}
function magRenderCenter(s) {
    const el = document.getElementById('mag-center');
    if (!el) return;
    const cur = s.order[s.turn];
    const rolled = s.rollSeq !== magUI.lastRoll;
    magUI.lastRoll = s.rollSeq;
    const card = s.card ? MAG_CARDS[s.card.d] && MAG_CARDS[s.card.d][s.card.i] : null;
    el.innerHTML = `<div id="mag-center-in" style="width:250px;display:flex;flex-direction:column;align-items:center;zoom:${magUI.cz || 1}">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">Tour ${s.turnCount}</div>
        <div style="font-size:17px;font-weight:900;color:${magColor(s, cur)};max-width:92%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${magEsc(cur)}</div>
        <div style="display:flex;gap:8px;margin:6px 0" class="${rolled && s.rollSeq > 0 ? 'mag-shake' : ''}">${magDie(s.dice[0])}${magDie(s.dice[1])}</div>
        <div style="font-size:11px;color:#e2e8f0;max-width:86%;line-height:1.25">${magEsc(magPhaseText(s))}</div>
        <div id="mag-timer" style="font-family:monospace;font-size:15px;font-weight:bold;color:#fbbf24;margin-top:3px"></div>
        ${card ? `<div style="margin-top:5px;max-width:84%;font-size:10px;line-height:1.25;color:#0f172a;background:${s.card.d === 'a' ? '#a5f3fc' : '#fde68a'};border-radius:8px;padding:5px 7px"><b>${s.card.d === 'a' ? '📡' : '📦'} ${MAG_DECK_NAMES[s.card.d]}</b> — ${magEsc(card.txt)}</div>` : ''}</div>`;
}
// ----- Cartes : piles (dos commun) et carte tirée montrée à tous -----
const MAG_CARD_DIR = './magnat-visuel/cartes/';
function magCardImg(deck, idx) {
    const c = MAG_CARDS[deck] && MAG_CARDS[deck][idx];
    return c && c.img ? MAG_CARD_DIR + 'cargaison-' + String(c.img).padStart(2, '0') + '.jpg' : '';
}
function magCardBackHtml(deck) {
    // Cargaison : image du dos fournie ; Transmission : dos dessiné (pas d'image pour ce paquet)
    const drawn = `<div class="mag-face-text" style="background:linear-gradient(160deg,#083344,#0c1a3a 60%,#1e1b4b)"><div style="font-size:26cqw">📡</div><div style="font-size:9.5cqw;font-weight:900;letter-spacing:.08em;color:#a5f3fc">TRANSMISSION</div></div>`;
    if (deck !== 'b') return drawn;
    return `<img src="${MAG_CARD_DIR}dos-cargaison.jpg" alt="" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="mag-face-text" style="display:none;background:linear-gradient(160deg,#3b2a06,#0c1a3a 60%,#1e1b4b)"><div style="font-size:26cqw">📦</div><div style="font-size:10cqw;font-weight:900;letter-spacing:.08em;color:#fde68a">CARGAISON</div></div>`;
}
function magCardFrontHtml(deck, idx) {
    const c = (MAG_CARDS[deck] && MAG_CARDS[deck][idx]) || { txt: '' };
    const text = `<div class="mag-face-text" style="${magCardImg(deck, idx) ? 'display:none;' : ''}background:${deck === 'a' ? 'linear-gradient(160deg,#0e7490,#0c1a3a 55%,#1e1b4b)' : 'linear-gradient(160deg,#92400e,#0c1a3a 55%,#1e1b4b)'}">
        <div style="font-size:10cqw;font-weight:900;letter-spacing:.08em;color:${deck === 'a' ? '#a5f3fc' : '#fde68a'}">${deck === 'a' ? 'TRANSMISSION' : 'CARGAISON'}</div>
        <div style="font-size:30cqw;line-height:1">${deck === 'a' ? '📡' : '📦'}</div>
        <div style="font-size:6.6cqw;line-height:1.3;color:#f1f5f9;background:rgba(2,6,23,.6);border:1px solid rgba(255,255,255,.25);border-radius:4cqw;padding:5cqw">${magEsc(c.txt)}</div></div>`;
    const img = magCardImg(deck, idx);
    return (img ? `<img src="${img}" alt="${magEsc(c.txt)}" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '') + text;
}
function magRenderCard(s) {
    const view = document.getElementById('mag-cardview');
    if (!view) return;
    const c = s.card, me = magMe();
    ['a', 'b'].forEach(d => { const pile = document.getElementById('mag-pile-' + d); if (pile) pile.classList.toggle('mag-pile-on', !!(c && c.p && c.d === d)); });
    if (!c || !c.p) { view.style.display = 'none'; view.dataset.k = ''; return; }
    const key = c.d + ':' + c.i + ':' + c.k + ':' + (s.debts.length ? 1 : 0) + ':' + me;
    if (view.dataset.k === key) return;
    const fresh = (view.dataset.k || '').split(':').slice(0, 3).join(':') !== c.d + ':' + c.i + ':' + c.k;
    view.dataset.k = key;
    const mine = c.by === me && s.order[s.turn] === me;
    view.style.display = 'flex';
    view.innerHTML = `
        <div class="mag-bigcard ${fresh ? 'mag-flip' : ''}">
            <div class="mag-face mag-face-front">${magCardFrontHtml(c.d, c.i)}</div>
            <div class="mag-face mag-face-back">${magCardBackHtml(c.d)}</div>
        </div>
        <div class="mag-cz" style="zoom:${magUI.cz || 1};display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:10px">
            <div style="font-size:13px;color:#e2e8f0"><b style="color:${magColor(s, c.by)}">${magEsc(c.by)}</b> a tiré une carte ${MAG_DECK_NAMES[c.d]}</div>
            ${mine && !s.debts.length
                ? `<button data-act="card" style="pointer-events:auto;cursor:pointer;padding:9px 18px;border-radius:10px;border:0;background:#059669;color:#fff;font-weight:800;font-size:13px">Appliquer l'effet</button>`
                : `<div style="font-size:12px;color:#94a3b8">En attente de ${magEsc(c.by)}...</div>`}
            <div style="font-size:11px;color:#fbbf24;font-family:monospace">Effet appliqué automatiquement dans <span id="mag-card-timer"></span> s</div>
        </div>`;
}
function magTickTimer() {
    const data = window.magData, g = data && data.magnatGame;
    if (!g || !g.s || g.s.status !== 'PLAYING') return;
    const now = Date.now();
    const el = document.getElementById('mag-timer');
    if (el) el.textContent = '⏱ ' + Math.max(0, Math.ceil(((g.s.dl || 0) - now) / 1000)) + ' s';
    const ct = document.getElementById('mag-card-timer');
    if (ct) ct.textContent = Math.max(0, Math.ceil(((g.s.dl || 0) - now) / 1000));
    let txt = 'Sans limite de temps';
    if (g.s.endAt) { const left = Math.max(0, Math.ceil((g.s.endAt - now) / 1000)); txt = left > 0 ? `Fin de partie dans ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Dernier tour'; }
    ['generic-game-timer', 'mag-top-timer'].forEach(id => { const top = document.getElementById(id); if (top) top.innerText = txt; });
}

// ----- Panneau latéral -----
const MAG_BTN = 'px-3 py-2 rounded-lg font-bold text-xs cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed ';
function magBtn(label, attrs, color, disabled, title) {
    return `<button ${attrs} ${disabled ? 'disabled' : ''} ${title ? `title="${magEsc(title)}"` : ''} class="${MAG_BTN}${color || 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600'}">${label}</button>`;
}
function magSideDesc(side) {
    const parts = [];
    if (side.cash) parts.push(side.cash + ' cr');
    side.props.forEach(sp => parts.push(MAG_SPACES[sp] ? MAG_SPACES[sp].n : '?'));
    if (side.cards) parts.push(side.cards + ' sauf-conduit' + (side.cards > 1 ? 's' : ''));
    return parts.length ? parts.map(magEsc).join(', ') : 'rien';
}
function magHint(html) { return `<div class="mag-hint">${html}</div>`; }
function magActionHtml(s, me) {
    const cur = s.order[s.turn], p = s.players[me];
    const GREEN = 'bg-emerald-600 hover:bg-emerald-500 text-white', BLUE = 'bg-indigo-600 hover:bg-indigo-500 text-white', RED = 'bg-red-700 hover:bg-red-600 text-white';
    let html = '';

    if (s.trade && s.trade.to === me) {
        html += `<div class="p-3 rounded-xl border border-amber-400/60 bg-amber-950/30 space-y-2">
            <div class="text-xs font-bold text-amber-300">🤝 ${magEsc(s.trade.from)} vous propose un échange</div>
            <div class="text-[11px] text-slate-200">Vous recevez : <b>${magSideDesc(s.trade.give)}</b></div>
            <div class="text-[11px] text-slate-200">Vous donnez : <b>${magSideDesc(s.trade.get)}</b></div>
            <div class="flex gap-2">${magBtn('Accepter', 'data-act="accept"', GREEN)}${magBtn('Refuser', 'data-act="decline"', RED)}</div></div>`;
    } else if (s.trade && s.trade.from === me) {
        html += `<div class="p-3 rounded-xl border border-amber-400/40 bg-amber-950/20 space-y-2">
            <div class="text-xs text-amber-200">🤝 Proposition envoyée à <b>${magEsc(s.trade.to)}</b> — en attente de sa réponse.</div>
            <div class="text-[11px] text-slate-300">Vous donnez : ${magSideDesc(s.trade.give)} · Vous recevez : ${magSideDesc(s.trade.get)}</div>
            ${magBtn('Retirer ma proposition', 'data-act="decline"')}</div>`;
    } else if (s.trade) {
        html += `<div class="p-2 rounded-xl border border-slate-700 bg-slate-900/70 text-[11px] text-slate-300">🤝 ${magEsc(s.trade.from)} propose un échange à ${magEsc(s.trade.to)}.</div>`;
    }

    let body;
    if (!p) body = `<div class="text-sm text-slate-300">Vous assistez à la partie en spectateur.</div>`;
    else if (p.out) body = `<div class="text-sm text-red-300 font-bold">Vous avez fait faillite. Vous pouvez suivre la fin de la partie.</div>`;
    else if (s.debts.length) {
        const d = s.debts[0];
        if (d.who === me) {
            body = `<div class="text-sm font-black text-red-300">Dette à régler : ${d.amt} cr ${d.to ? 'à ' + magEsc(d.to) : 'à la banque'}</div>
                <div class="text-[11px] text-slate-200">Il vous manque <b class="text-amber-300">${Math.max(0, d.amt - p.cash)} cr</b>. Vendez des constructions ou hypothéquez des propriétés : le paiement se fait automatiquement dès que vous avez assez de crédits.</div>
                <div class="flex gap-2 flex-wrap">${magBtn('🏠 Gérer mes propriétés', `data-act="props" data-n="${magEsc(me)}"`, 'bg-amber-500 hover:bg-amber-400 text-black')}</div>
                <div class="flex gap-2 flex-wrap">${magUI.bk
                    ? magBtn('Confirmer la faillite', 'data-act="bankrupt"', RED) + magBtn('Annuler', 'data-act="bkno"')
                    : magBtn('Déclarer faillite', 'data-act="bkask"', RED)}</div>`;
        } else body = `<div class="text-sm text-slate-200"><b>${magEsc(d.who)}</b> doit trouver ${d.amt} cr ${d.to ? 'pour ' + magEsc(d.to) : 'pour la banque'}...</div>`;
    } else if (s.auction) {
        const a = s.auction, c = MAG_SPACES[a.sp], mine = a.act[a.i] === me;
        const quick = [1, 10, 50, 100].map(inc => magBtn('+' + inc, `data-act="bid" data-amt="${a.bid + inc}"`, BLUE, a.bid + inc > p.cash)).join('');
        body = `<div class="text-[11px] uppercase tracking-widest text-amber-300">🔨 Enchères</div>
            <div class="text-sm font-black text-white">${magEsc(c.n)} <span class="text-slate-400 font-normal text-xs">(valeur ${c.p} cr)</span></div>
            <div class="text-xs text-slate-200">Meilleure offre : <b class="text-emerald-300 font-mono text-base">${a.bid} cr</b> ${a.by ? 'par ' + magEsc(a.by) : '(aucune)'}</div>
            <div class="text-[11px] text-slate-400">Encore en lice : ${a.act.map(magEsc).join(', ')}</div>
            ${mine ? `<div class="flex gap-1.5 flex-wrap items-center">${quick}</div>
                <div class="flex gap-1.5 items-center">
                    <input id="mag-bid" type="number" min="${a.bid + 1}" max="${p.cash}" value="${magEsc(magUI.bid)}" placeholder="Montant" class="w-24 bg-slate-950 border border-slate-600 rounded-lg px-2 py-2 text-white text-xs font-mono">
                    ${magBtn('Enchérir', 'data-act="bidinput"', GREEN)}${magBtn('Me retirer', 'data-act="pass"', RED)}</div>
                ${magHint("<b>+1 / +10 / +50 / +100</b> : surenchérir d'autant. <b>Enchérir</b> : proposer le montant saisi. <b>Me retirer</b> : abandonner cette enchère. Le dernier joueur en lice paie son offre et obtient la propriété.")}`
                : `<div class="text-xs text-slate-300">${a.act.indexOf(me) >= 0 ? `En attente de l'offre de <b>${magEsc(a.act[a.i])}</b>...` : 'Vous vous êtes retiré de cette enchère.'}</div>`}`;
    } else if (cur === me) {
        const canTrade = (s.phase === 'ROLL' || s.phase === 'END') && !s.trade;
        const trade = canTrade ? magBtn('🤝 Proposer un échange', 'data-act="tropen"') : '';
        if (s.phase === 'CARD') {
            body = `<div class="text-sm font-black text-amber-300">🃏 Vous avez tiré une carte ${s.card ? MAG_DECK_NAMES[s.card.d] : ''}</div>
                <div class="flex gap-2 flex-wrap">${magBtn("Appliquer l'effet de la carte", 'data-act="card"', GREEN)}</div>
                ${magHint(`La carte est montrée à tous les joueurs sur le plateau. Son effet s'applique quand vous validez, ou tout seul après ${MAG.CARD_SECONDS} secondes.`)}`;
        } else if (s.phase === 'ROLL' && p.jail > 0) {
            body = `<div class="text-sm font-black text-amber-300">🧪 Vous êtes en Quarantaine (tentative ${p.jail} / 3)</div>
                <div class="flex gap-2 flex-wrap">${magBtn('🎲 Tenter un double', 'data-act="roll"', GREEN)}
                ${magBtn(`Payer ${MAG.BAIL} cr`, 'data-act="bail"', BLUE, p.cash < MAG.BAIL)}
                ${p.cards > 0 ? magBtn('Utiliser un sauf-conduit', 'data-act="usecard"', BLUE) : ''}${trade}</div>
                ${magHint(`Un double vous libère et vous avancez. Sinon vous restez sur place ; au 3e échec la caution de ${MAG.BAIL} cr est obligatoire. Payer ou utiliser un sauf-conduit vous libère tout de suite, puis vous lancez les dés.`)}`;
        } else if (s.phase === 'ROLL') {
            body = `<div class="text-sm font-black text-emerald-300">C'est votre tour !</div>
                <div class="flex gap-2 flex-wrap">${magBtn('🎲 Lancer les dés', 'data-act="roll"', GREEN)}${trade}</div>
                ${magHint("<b>Lancer les dés</b> : vous avancez du total. Un double vous fait rejouer ; trois doubles de suite mènent en Quarantaine.<br><b>Proposer un échange</b> : offrez des crédits ou des propriétés à un autre joueur, qui accepte ou refuse.")}`;
        } else if (s.phase === 'BUY') {
            const c = MAG_SPACES[s.buy];
            body = `<div class="text-sm font-black text-white">${magEsc(c.n)} est libre</div>
                <div class="flex gap-2 flex-wrap">${magBtn(`Acheter pour ${c.p} cr`, 'data-act="buy"', GREEN, p.cash < c.p)}${magBtn('Mettre aux enchères', 'data-act="auction"', BLUE)}</div>
                ${magHint("<b>Acheter</b> : la propriété est à vous et vous rapportera un loyer.<br><b>Mettre aux enchères</b> : tous les joueurs, vous compris, peuvent miser ; elle part au plus offrant, parfois sous son prix.")}`;
        } else {
            body = `<div class="text-sm font-black text-emerald-300">${s.again ? 'Double ! Vous rejouez.' : 'Gérez vos biens, puis terminez votre tour.'}</div>
                <div class="flex gap-2 flex-wrap">${s.again ? magBtn('🎲 Relancer les dés', 'data-act="roll"', GREEN) : magBtn('Terminer mon tour', 'data-act="end"', GREEN)}${magBtn('🏠 Gérer mes propriétés', `data-act="props" data-n="${magEsc(me)}"`)}${trade}</div>
                ${magHint("<b>Gérer mes propriétés</b> : construire, vendre une construction, hypothéquer (vous touchez la moitié du prix, plus de loyer) ou lever une hypothèque.<br>" + (s.again ? "Vous avez fait un double : relancez les dés." : "<b>Terminer mon tour</b> passe la main au joueur suivant."))}`;
        }
    } else body = `<div class="text-sm text-slate-200">${magEsc(magPhaseText(s))}...</div>`;

    html += `<div class="p-3 rounded-xl border border-cyan-500/40 bg-slate-900/80 space-y-2">${body}</div>`;
    if (magUI.trOpen && p && !p.out && cur === me) html += magTradeFormHtml(s, me);
    return html;
}
function magTradeFormHtml(s, me) {
    const others = magAlive(s).filter(n => n !== me);
    const tr = magUI.tr = magUI.tr || { to: others[0] || '', give: {}, get: {}, gc: '', rc: '', gk: false, rk: false };
    if (others.indexOf(tr.to) < 0) { tr.to = others[0] || ''; tr.get = {}; tr.rk = false; }
    const chips = (name, sel, act) => {
        const list = magOwned(s, name).filter(sp => magTradable(s, name, sp));
        if (!list.length) return '<span class="text-[11px] text-slate-500 italic">aucune propriété échangeable</span>';
        return list.map(sp => { const c = MAG_SPACES[sp], on = !!sel[sp];
            return `<button data-act="${act}" data-sp="${sp}" class="px-2 py-1 rounded-lg text-[11px] cursor-pointer border ${on ? 'bg-emerald-700 border-emerald-300 text-white' : 'bg-slate-900 border-slate-600 text-slate-200'}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.f ? MAG_FAMILIES[c.f].color : '#cbd5e1'}"></span> ${magEsc(c.n)}${magOwn(s, sp).m ? ' (hyp.)' : ''}</button>`; }).join(' ');
    };
    const card = (has, on, act) => has > 0 ? ` <button data-act="${act}" class="px-2 py-1 rounded-lg text-[11px] cursor-pointer border ${on ? 'bg-emerald-700 border-emerald-300 text-white' : 'bg-slate-900 border-slate-600 text-slate-200'}">🎫 Sauf-conduit</button>` : '';
    const cash = (id, v, max) => `<input id="${id}" type="number" min="0" max="${max}" value="${magEsc(v)}" placeholder="0" class="w-24 bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-white text-xs font-mono"> <span class="text-[11px] text-slate-400">cr (max ${max})</span>`;
    return `<div class="p-3 rounded-xl border border-amber-400/50 bg-slate-900/90 space-y-2">
        <div class="flex justify-between items-center"><span class="text-xs font-bold text-amber-300">🤝 Proposer un échange</span>${magBtn('✕', 'data-act="trclose"')}</div>
        <div class="text-[11px] text-slate-300">Avec : <select id="mag-tr-to" class="bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-white text-xs">${others.map(n => `<option value="${magEsc(n)}" ${n === tr.to ? 'selected' : ''}>${magEsc(n)}</option>`).join('')}</select></div>
        <div class="text-[11px] font-bold text-slate-200">Vous donnez</div>
        <div>${cash('mag-tr-gc', tr.gc, s.players[me].cash)}</div>
        <div class="flex flex-wrap gap-1">${chips(me, tr.give, 'trg')}${card(s.players[me].cards, tr.gk, 'trgk')}</div>
        <div class="text-[11px] font-bold text-slate-200">Vous recevez</div>
        <div>${cash('mag-tr-rc', tr.rc, tr.to ? s.players[tr.to].cash : 0)}</div>
        <div class="flex flex-wrap gap-1">${tr.to ? chips(tr.to, tr.get, 'trr') + card(s.players[tr.to].cards, tr.rk, 'trrk') : ''}</div>
        <div class="text-[10px] text-slate-500">Les colonies d'une famille portant des constructions ne peuvent pas être échangées.</div>
        ${magBtn('Envoyer la proposition', 'data-act="trsend"', 'bg-emerald-600 hover:bg-emerald-500 text-white')}</div>`;
}
function magAvatar(name) {
    const room = (window.magData && window.magData.players) || {};
    const av = room[name] && room[name].avatar;
    return av && av.src ? String(av.src) : '';
}
function magAvatarHtml(s, name, size) {
    const src = magAvatar(name), col = magColor(s, name);
    const box = `width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${col};flex-shrink:0;box-shadow:0 0 10px ${col}66`;
    return src
        ? `<img src="${magEsc(src)}" alt="" style="${box};object-fit:cover;background:#020617">`
        : `<span style="${box};display:flex;align-items:center;justify-content:center;background:#0f172a;color:${col};font-weight:900;font-size:${Math.round(size * 0.45)}px">${magEsc(String(name).charAt(0).toUpperCase())}</span>`;
}
function magPlayersHtml(s, me) {
    const cur = s.order[s.turn];
    return s.order.map(n => {
        const p = s.players[n], col = magColor(s, n), turn = n === cur && !p.out, count = magOwned(s, n).length;
        const tags = (p.jail > 0 ? '<span title="En Quarantaine">🧪</span>' : '') + (p.skip > 0 ? '<span title="Passe son prochain tour">⏭️</span>' : '') + (p.cards > 0 ? `<span title="Sauf-conduit">🎫${p.cards > 1 ? '×' + p.cards : ''}</span>` : '');
        return `<div class="mag-player ${turn ? 'mag-player-on' : ''}" style="--mag-pc:${col};${p.out ? 'opacity:.4' : ''}">
            ${magAvatarHtml(s, n, 54)}
            <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:6px;min-width:0">
                    <span style="width:11px;height:11px;border-radius:50%;background:${col};flex-shrink:0"></span>
                    <span style="font-weight:800;font-size:14px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${magEsc(n)}</span>
                    ${n === me ? '<span style="font-size:9px;letter-spacing:.08em;color:#94a3b8;flex-shrink:0">VOUS</span>' : ''}
                    <span style="margin-left:auto;flex-shrink:0;font-size:12px">${tags}</span>
                </div>
                <div style="font-family:monospace;font-weight:800;font-size:19px;line-height:1.2;color:${p.out ? '#f87171' : '#6ee7b7'}">${p.out ? 'Faillite' : p.cash + ' cr'}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:3px">
                    <span style="font-size:10px;color:#64748b">${p.out ? '' : (turn ? '<span style="color:' + col + ';font-weight:800">▶ JOUE</span> · ' : '') + 'fortune ' + magWorth(s, n)}</span>
                    ${p.out ? '' : `<button data-act="props" data-n="${magEsc(n)}" class="mag-mini">🏠 Propriétés (${count})</button>`}
                </div>
            </div></div>`; }).join('') +
        `<div style="font-size:10px;color:#64748b;text-align:center">Banque : ${magSupply(s).houses} avant-postes · ${magSupply(s).hotels} métropoles</div>`;
}
function magStateLabel(s, sp) {
    const o = magOwn(s, sp);
    if (!o) return '';
    if (o.m) return '<span class="text-red-300">hypothéquée</span>';
    if (o.h === 5) return '<span class="text-amber-300">métropole</span>';
    if (o.h > 0) return `<span class="text-slate-100">${o.h} avant-poste${o.h > 1 ? 's' : ''}</span>`;
    return '';
}
// Boutons de gestion d'une propriété (uniquement pour son propriétaire)
function magManageBtns(s, me, sp) {
    const c = MAG_SPACES[sp], o = magOwn(s, sp), can = magCanManage(s, me);
    const b = (label, act, err, title) => `<button data-act="${act}" data-sp="${sp}" ${!can || err ? 'disabled' : ''} title="${magEsc(!can ? 'Possible pendant votre tour' : (err || title))}" class="mag-mini">${label}</button>`;
    const build = c.t === 'prop' ? b('＋ Construire', 'build', magCheckBuild(s, me, sp), `Construire (${magHouseCost(sp)} cr)`) + b('－ Vendre', 'sell', magCheckSell(s, me, sp), `Vendre une construction (+${Math.floor(magHouseCost(sp) / 2)} cr)`) : '';
    const mort = o.m ? b(`Lever (−${magUnmortgageCost(sp)})`, 'unmortgage', magCheckUnmortgage(s, me, sp), `Lever l'hypothèque (${magUnmortgageCost(sp)} cr)`) : b(`Hypothéquer (+${magMortgageValue(sp)})`, 'mortgage', magCheckMortgage(s, me, sp), `Hypothéquer (+${magMortgageValue(sp)} cr)`);
    return build + mort;
}
function magPropsHtml(s, name, me) {
    const owned = magOwned(s, name), mine = name === me;
    if (!owned.length) return `<div style="font-size:13px;color:#64748b;font-style:italic;padding:14px 0;text-align:center">${mine ? 'Vous ne possédez encore rien.' : 'Aucune propriété pour le moment.'}</div>`;
    return owned.map(sp => {
        const c = MAG_SPACES[sp], o = magOwn(s, sp);
        const full = c.t === 'prop' && magOwnsFamily(s, name, c.f);
        const houses = o.h === 5 ? '<span style="color:#fbbf24">★ métropole</span>' : (o.h > 0 ? '<span style="color:#f8fafc">' + '●'.repeat(o.h) + ' ' + o.h + ' avant-poste' + (o.h > 1 ? 's' : '') + '</span>' : '');
        const state = o.m ? '<span style="color:#f87171">hypothéquée — aucun loyer</span>' : `loyer ${magRent(s, sp, 7)} cr${c.t === 'net' ? ' (pour un 7)' : ''}${houses ? ' · ' + houses : ''}${full && !o.h ? ' · <span style="color:#6ee7b7">famille complète</span>' : ''}`;
        return `<div class="mag-prop">
            <span style="width:8px;align-self:stretch;border-radius:4px;background:${c.f ? MAG_FAMILIES[c.f].color : '#cbd5e1'};flex-shrink:0"></span>
            <div style="min-width:0;flex:1">
                <div style="font-weight:800;font-size:14px;color:#f8fafc">${magEsc(c.n)} <span style="font-weight:400;font-size:11px;color:#64748b">${c.f ? MAG_FAMILIES[c.f].name : (c.t === 'portal' ? 'Portail' : 'Réseau')} · ${c.p} cr</span></div>
                <div style="font-size:11px;color:#94a3b8">${state}</div>
            </div>
            ${mine ? `<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0">${magManageBtns(s, me, sp)}</div>` : ''}
        </div>`;
    }).join('');
}
function magRenderProps(s) {
    const modal = document.getElementById('mag-modal');
    if (!modal) return;
    const name = magUI.props, p = name ? s.players[name] : null, me = magMe();
    if (!p) { magUI.props = ''; modal.style.display = 'none'; modal.innerHTML = ''; return; }
    const old = document.getElementById('mag-props-list');
    const scroll = old ? old.scrollTop : 0;
    modal.style.display = 'flex';
    const z = magUI.pz || 1;
    modal.innerHTML = `<div class="mag-window mag-zoom" style="zoom:${z};width:${Math.round(Math.min(560, window.innerWidth * 0.92 / z))}px;max-height:${Math.round(window.innerHeight * 0.84 / z)}px">
        <div class="mag-window-h" style="border-color:${magColor(s, name)}">
            ${magAvatarHtml(s, name, 46)}
            <div style="min-width:0;flex:1">
                <div style="font-weight:900;font-size:16px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Propriétés de ${magEsc(name)}</div>
                <div style="font-size:12px;color:#94a3b8;font-family:monospace"><b style="color:#6ee7b7">${p.cash} cr</b> · ${magOwned(s, name).length} biens · fortune ${magWorth(s, name)}</div>
            </div>
            <button data-act="propsclose" class="mag-mini" style="font-size:15px;padding:6px 12px">✕</button>
        </div>
        ${name === me ? `<div style="font-size:11px;color:#94a3b8;padding:8px 16px 0">${magCanManage(s, me) ? 'Vous pouvez construire, vendre et hypothéquer maintenant.' : 'Vous pourrez modifier vos propriétés pendant votre tour.'}</div>` : ''}
        <div id="mag-props-list" class="mag-window-b">${magPropsHtml(s, name, me)}</div>
    </div>`;
    const list = document.getElementById('mag-props-list');
    if (list) list.scrollTop = scroll;
}
function magDetailHtml(s) {
    const sp = magUI.sel, c = MAG_SPACES[sp];
    if (!c) return `<div class="text-[11px] text-slate-500">Touchez une case du plateau pour voir son prix, ses loyers et son propriétaire.</div>`;
    const o = magOwn(s, sp);
    let info;
    if (c.t === 'prop') {
        const t = magRentTable(sp), h = o ? (o.h || 0) : -1;
        const labels = ['Terrain nu', '1 avant-poste', '2 avant-postes', '3 avant-postes', '4 avant-postes', 'Métropole'];
        info = `<div class="grid grid-cols-2 gap-x-3 text-[11px]">${t.map((v, i) => `<span class="${i === h && !(o && o.m) ? 'text-emerald-300 font-bold' : 'text-slate-300'}">${labels[i]}</span><span class="text-right font-mono ${i === h && !(o && o.m) ? 'text-emerald-300 font-bold' : 'text-slate-200'}">${v} cr</span>`).join('')}</div>
            <div class="text-[10px] text-slate-400">Famille ${MAG_FAMILIES[c.f].name} complète : loyer du terrain nu doublé. Construction : ${magHouseCost(sp)} cr. Hypothèque : ${magMortgageValue(sp)} cr.</div>`;
    } else if (c.t === 'portal') info = `<div class="text-[11px] text-slate-300">Loyer selon le nombre de Portails possédés : 25 / 50 / 100 / 200 cr. Hypothèque : ${magMortgageValue(sp)} cr.</div>`;
    else if (c.t === 'net') info = `<div class="text-[11px] text-slate-300">Loyer : 4 × le total des dés (10 × si le propriétaire possède les deux Réseaux). Hypothèque : ${magMortgageValue(sp)} cr.</div>`;
    else info = `<div class="text-[11px] text-slate-300">${{ start: `Chaque passage rapporte ${MAG.SALARY} cr.`, tax: `Payez ${c.a} cr à la banque.`, card: `Tirez une carte ${c.n}.`, jail: 'Simple visite... sauf si la Patrouille vous y envoie.', free: 'Zone de repos : rien ne se passe.', gojail: 'Vous êtes envoyé directement en Quarantaine.' }[c.t] || ''}</div>`;
    return `<div class="space-y-1">
        <div class="flex items-center justify-between gap-2"><span class="text-sm font-black text-white"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.f ? MAG_FAMILIES[c.f].color : '#64748b'}"></span> ${magEsc(c.n)}</span>
        ${c.p ? `<span class="text-xs font-mono text-amber-300">${c.p} cr</span>` : ''}</div>
        ${magOwnable(sp) ? `<div class="text-[11px] text-slate-300">Propriétaire : ${o ? `<b style="color:${magColor(s, o.o)}">${magEsc(o.o)}</b> ${magStateLabel(s, sp)}` : '<span class="text-slate-500">à vendre</span>'}</div>` : ''}
        ${info}
        ${o && o.o === magMe() ? `<div style="display:flex;gap:5px;flex-wrap:wrap;padding-top:4px">${magManageBtns(s, magMe(), sp)}</div>` : ''}</div>`;
}
function magLogHtml(s) {
    return `<div class="space-y-1 text-[11px] text-slate-300">${s.log.slice().reverse().map((l, i) => `<div class="${i === 0 ? 'text-white font-bold' : ''}">• ${magEsc(l)}</div>`).join('')}</div>`;
}
function magRenderSide(s) {
    if (!document.getElementById('mag-root')) return;
    const me = magMe();
    const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    put('mag-actions', magActionHtml(s, me));
    put('mag-players', magPlayersHtml(s, me));
    put('mag-detail', magDetailHtml(s));
    const dbox = document.getElementById('mag-detail-sec');
    if (dbox) dbox.style.display = MAG_SPACES[magUI.sel] ? '' : 'none';
    magRenderProps(s);
    put('mag-log', magLogHtml(s));
}
// Adapte la taille des panneaux et du centre du plateau à la taille de la fenêtre
function magFit() {
    const root = document.getElementById('mag-root'), board = document.getElementById('mag-board');
    if (!root || !board) return;
    const scale = Math.max(1, Math.min(1.9, window.innerWidth / 1500, window.innerHeight / 800));
    root.style.setProperty('--mag-side', Math.round(350 * scale) + 'px');
    magUI.pz = scale;
    root.querySelectorAll('.mag-zoom').forEach(el => { el.style.zoom = scale; });
    magUI.cz = Math.max(0.6, board.clientWidth / 640);
    root.querySelectorAll('.mag-cz').forEach(el => { el.style.zoom = magUI.cz; });
    const inner = document.getElementById('mag-center-in');
    if (inner) inner.style.zoom = magUI.cz;
}
function magRender(s, force) {
    if (!s.debts.length || s.debts[0].who !== magMe()) magUI.bk = false;
    if (s.order[s.turn] !== magMe()) magUI.trOpen = false;
    if (!s.auction) magUI.bid = '';
    const tr = magUI.tr || {};
    const sig = JSON.stringify([s.seq, s.order.map(n => magPionDe(s, n)).join(), magUI.props, magUI.sel, magUI.trOpen, tr.to, tr.give, tr.get, tr.gk, tr.rk, magUI.bk, magMe()]);
    if (!force && sig === magUI.sig) return;
    magUI.sig = sig;
    magSounds(s);
    magRenderDyn(s);
    magRenderTokens(s);
    magRenderCenter(s);
    magRenderCard(s);
    magRenderSide(s);
    magTickTimer();
    magFit();
}
// Sons : dés, carte tirée, crédits reçus, début de mon tour (rien au premier affichage)
function magSounds(s) {
    const me = magMe(), p = s.players[me], prev = magUI.snd;
    const now = { sess: s.startedAt, roll: s.rollSeq, card: s.card && s.card.p ? s.card.d + ':' + s.card.i + ':' + s.card.k : '', mine: s.status === 'PLAYING' && magActor(s) === me, cash: p ? p.cash : 0 };
    magUI.snd = now;
    if (!prev || prev.sess !== now.sess || typeof window.sfx !== 'function') return;
    if (now.roll !== prev.roll) window.sfx('des');
    else if (now.card && now.card !== prev.card) window.sfx('carte');
    else if (now.cash > prev.cash) window.sfx('argent');
    if (now.mine && !prev.mine) {
        setTimeout(() => window.sfx('tour'), 350);
        const sec = document.getElementById('mag-actions-sec'); if (sec) { sec.classList.remove('mag-myturn'); void sec.offsetWidth; sec.classList.add('mag-myturn'); }
    }
}
function magCurrent() { const d = window.magData; return d && d.magnatGame && d.magnatGame.s ? magNorm(d.magnatGame.s) : null; }

// Clics du panneau latéral
function magOnAct(d) {
    const s = magCurrent();
    if (!s) return;
    const act = d.act, sp = Number(d.sp);
    const tr = magUI.tr;
    if (['roll', 'bail', 'usecard', 'buy', 'auction', 'pass', 'end', 'accept', 'decline', 'bankrupt', 'card'].indexOf(act) >= 0) { if (act === 'bankrupt') magUI.bk = false; magSend({ t: act }); return; }
    if (['build', 'sell', 'mortgage', 'unmortgage'].indexOf(act) >= 0) { magSend({ t: act, sp: sp }); return; }
    if (act === 'bid') { magSend({ t: 'bid', amt: Number(d.amt) }); return; }
    if (act === 'bidinput') { const el = document.getElementById('mag-bid'); const v = Math.floor(Number(el && el.value) || 0); if (v > 0) { magUI.bid = ''; magSend({ t: 'bid', amt: v }); } return; }
    if (act === 'sel') magUI.sel = magUI.sel === sp ? -1 : sp;
    else if (act === 'props') magUI.props = magUI.props === d.n ? '' : String(d.n || '');
    else if (act === 'propsclose') magUI.props = '';
    else if (act === 'bkask') magUI.bk = true;
    else if (act === 'bkno') magUI.bk = false;
    else if (act === 'tropen') { magUI.trOpen = true; magUI.tr = null; }
    else if (act === 'trclose') magUI.trOpen = false;
    else if (act === 'trg' && tr) { if (tr.give[sp]) delete tr.give[sp]; else tr.give[sp] = true; }
    else if (act === 'trr' && tr) { if (tr.get[sp]) delete tr.get[sp]; else tr.get[sp] = true; }
    else if (act === 'trgk' && tr) tr.gk = !tr.gk;
    else if (act === 'trrk' && tr) tr.rk = !tr.rk;
    else if (act === 'trsend' && tr) {
        const offer = { t: 'propose', to: tr.to,
            give: { cash: Math.max(0, Math.floor(Number(tr.gc) || 0)), props: Object.keys(tr.give).map(Number), cards: tr.gk ? 1 : 0 },
            get: { cash: Math.max(0, Math.floor(Number(tr.rc) || 0)), props: Object.keys(tr.get).map(Number), cards: tr.rk ? 1 : 0 } };
        const err = magCheckTrade(s, { from: magMe(), to: offer.to, give: magCleanSide(offer.give), get: magCleanSide(offer.get) });
        if (err) { if (typeof showToast === 'function') showToast('⚠️ ' + err); return; }
        magUI.trOpen = false; magUI.tr = null;
        magSend(offer);
    }
    magRender(s);
}
const MAG_CSS = `
.mag-tok-3d image{visibility:hidden}
.mag-tok-in.mag-hop{animation:magHop .17s ease-out}
.mag-tok-in.mag-land{animation:magLand .4s ease-out}
.mag-tok-in.mag-warp-out{animation:magWarpOut .4s ease-in forwards}
.mag-tok-in.mag-warp-in{animation:magWarpIn .42s ease-out}
.mag-tok-in.mag-tremble{animation:magTremble .42s linear}
@keyframes magHop{0%{transform:translateY(0) scale(1)}45%{transform:translateY(-9px) scale(1.4)}100%{transform:translateY(0) scale(1)}}
@keyframes magLand{0%{transform:scale(1.5,.7)}40%{transform:scale(.85,1.2)}70%{transform:scale(1.1,.94)}100%{transform:scale(1)}}
@keyframes magWarpOut{0%{transform:scale(1) rotate(0);opacity:1}100%{transform:scale(0) rotate(540deg);opacity:0}}
@keyframes magWarpIn{0%{transform:scale(3.2) rotate(-200deg);opacity:0}60%{opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes magTremble{0%,100%{transform:translateX(0)}15%{transform:translateX(-5px) rotate(-10deg)}35%{transform:translateX(5px) rotate(10deg)}55%{transform:translateX(-4px) rotate(-8deg)}75%{transform:translateX(4px) rotate(8deg)}}
.mag-fx-onde{animation:magOnde .7s ease-out forwards}
.mag-fx-onde2{animation:magOnde .7s ease-out .15s forwards;opacity:0}
.mag-fx-trace{animation:magTrace .7s ease-out forwards}
.mag-fx-texte{animation:magTexte 1.4s ease-out forwards}
@keyframes magOnde{0%{transform:scale(.4);opacity:.95}100%{transform:scale(3);opacity:0}}
@keyframes magTrace{0%{transform:scale(1);opacity:.75}100%{transform:scale(.2);opacity:0}}
@keyframes magTexte{0%{transform:translateY(0) scale(.6);opacity:0}15%{transform:translateY(-6px) scale(1.15);opacity:1}100%{transform:translateY(-38px) scale(1);opacity:0}}
@keyframes magShake{0%{transform:rotate(0) scale(1)}25%{transform:rotate(-18deg) scale(1.15)}50%{transform:rotate(14deg) scale(1.1)}75%{transform:rotate(-8deg) scale(1.05)}100%{transform:rotate(0) scale(1)}}
.mag-shake{animation:magShake .55s ease}
#mag-root{--mag-side:350px;position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;gap:10px;padding:10px;box-sizing:border-box;background:radial-gradient(circle at 50% 40%,#0b1a30 0%,#040913 70%)}
#mag-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 16px;border:1px solid rgba(0,210,255,.35);border-radius:12px;background:rgba(9,20,36,.92);flex-shrink:0}
#mag-main{flex:1;min-height:0;display:grid;grid-template-columns:var(--mag-side) minmax(0,1fr) var(--mag-side);gap:12px}
.mag-col{display:flex;flex-direction:column;gap:10px;min-height:0;min-width:0}
#mag-boardwrap{container-type:size;display:flex;align-items:center;justify-content:center;min-height:0;min-width:0}
#mag-board{position:relative;width:min(100cqw,100cqh);height:min(100cqw,100cqh)}
.mag-sec{display:flex;flex-direction:column;min-height:0;border:1px solid var(--mag-acc,rgba(0,210,255,.4));border-radius:12px;background:rgba(9,20,36,.94);overflow:hidden;flex-shrink:0}
.mag-sec.mag-grow{flex:1 1 0;flex-shrink:1}
.mag-sec-h{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 12px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#04101f;background:var(--mag-acc,#22d3ee);flex-shrink:0}
.mag-sec-b{padding:10px 12px;overflow-y:auto;min-height:0}
.mag-sec-b>*+*{margin-top:8px}
.mag-hint{font-size:11px;line-height:1.45;color:#94a3b8;border-top:1px dashed rgba(148,163,184,.3);padding-top:6px}
.mag-hint b{color:#e2e8f0}
@keyframes magTurn{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}50%{box-shadow:0 0 28px 4px rgba(52,211,153,.85)}}
.mag-myturn{animation:magTurn .9s ease-in-out 2}
.mag-player{display:flex;align-items:center;gap:11px;padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.6)}
.mag-player-on{border-color:var(--mag-pc);background:rgba(8,47,73,.55);box-shadow:0 0 14px -4px var(--mag-pc)}
.mag-mini{padding:5px 9px;border-radius:8px;border:1px solid rgba(148,163,184,.45);background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit}
.mag-mini:hover:not(:disabled){background:#334155}
.mag-mini:disabled{opacity:.3;cursor:not-allowed}
#mag-modal{position:absolute;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.72);backdrop-filter:blur(2px)}
.mag-window{width:min(560px,92vw);max-height:84vh;display:flex;flex-direction:column;border:1px solid rgba(0,210,255,.5);border-radius:16px;background:#091424;box-shadow:0 20px 60px rgba(0,0,0,.8);overflow:hidden}
.mag-window-h{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:3px solid;background:rgba(15,23,42,.9)}
.mag-window-b{padding:8px 16px 14px;overflow-y:auto;min-height:0}
.mag-prop{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(148,163,184,.15)}
.mag-prop:last-child{border-bottom:0}
.mag-pile{position:absolute;bottom:.6%;width:10%;display:flex;flex-direction:column;align-items:center;gap:3%;pointer-events:none;z-index:2}
.mag-pile-cards{position:relative;width:100%;aspect-ratio:1536/2752;container-type:size}
.mag-pile-cards>div{position:absolute;inset:0;border-radius:7%;overflow:hidden;border:1px solid rgba(255,255,255,.35);box-shadow:0 2px 6px rgba(0,0,0,.6);background:#0c1a3a}
.mag-pile-cards>div:nth-child(1){transform:translate(-7%,-4%) rotate(-3deg)}
.mag-pile-cards>div:nth-child(2){transform:translate(-3.5%,-2%) rotate(-1.5deg)}
.mag-pile-cards img,.mag-face img{width:100%;height:100%;object-fit:cover;display:block}
.mag-pile-label{font-size:8.5px;font-weight:800;letter-spacing:0;text-transform:uppercase;color:#e2e8f0;text-shadow:0 1px 3px #000;white-space:nowrap}
@keyframes magPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(251,191,36,0))}50%{filter:drop-shadow(0 0 14px rgba(251,191,36,.95))}}
.mag-pile-on .mag-pile-cards{animation:magPulse 1s ease-in-out infinite}
#mag-cardview{position:absolute;inset:0;z-index:6;display:none;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle,rgba(2,6,23,.9) 0%,rgba(2,6,23,.78) 55%,rgba(2,6,23,0) 71%);pointer-events:none;perspective:1600px}
.mag-bigcard{position:relative;height:66%;aspect-ratio:1536/2752;transform-style:preserve-3d;container-type:size}
.mag-face{position:absolute;inset:0;border-radius:5%;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:2px solid rgba(255,255,255,.5);box-shadow:0 12px 40px rgba(0,0,0,.8),0 0 30px rgba(34,211,238,.35);background:#0c1a3a}
.mag-face-back{transform:rotateY(180deg)}
.mag-face-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:7cqw;box-sizing:border-box;font-family:Arial,sans-serif}
@keyframes magFlip{0%{transform:translateY(60%) scale(.25) rotateY(180deg)}55%{transform:translateY(0) scale(1.04) rotateY(180deg)}100%{transform:translateY(0) scale(1) rotateY(0)}}
.mag-flip{animation:magFlip 1.1s cubic-bezier(.2,.7,.2,1) both}
@media (max-width:1100px){
 #mag-root{overflow-y:auto}
 #mag-top{padding:6px 10px}
 #mag-top span{font-size:11px !important;letter-spacing:.08em !important;white-space:nowrap}
 #mag-main{display:flex;flex-direction:column;flex:none}
 #mag-boardwrap{container-type:normal;order:1}
 #mag-board{width:100%;height:auto;aspect-ratio:1/1;max-width:720px}
 #mag-col-right{order:2} #mag-col-left{order:3}
 #mag-modal{position:fixed}
 .mag-sec.mag-grow{flex:none;max-height:340px}
}`;
function magBuildLayout() {
    const content = document.getElementById('generic-game-content');
    if (!content) return;
    let st = document.getElementById('mag-style');
    if (!st) { st = document.createElement('style'); st.id = 'mag-style'; document.head.appendChild(st); }
    st.textContent = MAG_CSS;
    const sec = (title, id, acc, grow, extra) => `<div id="${id}-sec" class="mag-sec ${grow ? 'mag-grow' : ''}" style="--mag-acc:${acc}"><div class="mag-sec-h"><span>${title}</span>${extra || ''}</div><div id="${id}" class="mag-sec-b"></div></div>`;
    content.innerHTML = `
        <div id="mag-root">
            <div id="mag-top">
                <span class="sci-font" style="font-weight:800;letter-spacing:.2em;color:#a5b4fc;font-size:15px">🪐 MAGNAT GALACTIQUE</span>
                <span id="mag-top-timer" style="font-family:monospace;font-weight:bold;color:#fbbf24;font-size:15px"></span>
            </div>
            <div id="mag-main">
                <div id="mag-col-left" class="mag-col"><div class="mag-zoom mag-col" style="flex:1">
                    ${sec('👥 Joueurs', 'mag-players', '#22d3ee', true, '<button onclick="magOuvrirPions()" class="mag-mini" style="padding:1px 8px">🎭 Mon pion</button>')}
                </div></div>
                <div id="mag-boardwrap"><div id="mag-board">
                    ${magBoardSvg()}
                    <div id="mag-center" style="position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:none"></div>
                    <div id="mag-pile-b" class="mag-pile" style="left:.6%"><span class="mag-pile-label mag-cz">Cargaison</span><div class="mag-pile-cards"><div>${magCardBackHtml('b')}</div><div>${magCardBackHtml('b')}</div><div>${magCardBackHtml('b')}</div></div></div>
                    <div id="mag-pile-a" class="mag-pile" style="right:.6%"><span class="mag-pile-label mag-cz">Transmission</span><div class="mag-pile-cards"><div>${magCardBackHtml('a')}</div><div>${magCardBackHtml('a')}</div><div>${magCardBackHtml('a')}</div></div></div>
                    <div id="mag-cardview"></div>
                </div></div>
                <div id="mag-col-right" class="mag-col"><div class="mag-zoom mag-col" style="flex:1">
                    ${sec('🎮 Actions possibles', 'mag-actions', '#34d399', false)}
                    ${sec('🔎 Case sélectionnée', 'mag-detail', '#a78bfa', false, '<button data-act="sel" data-sp="-1" class="mag-mini" style="padding:1px 8px">✕</button>')}
                    ${sec('📜 Journal', 'mag-log', '#94a3b8', true)}
                </div></div>
            </div>
            <div id="mag-modal" data-act="propsclose"></div>
        </div>`;
    const root = document.getElementById('mag-root');
    document.getElementById('mag-svg').onclick = e => {
        const t = e.target.closest ? e.target.closest('[data-sp]') : null;
        if (!t) return;
        const sp = Number(t.getAttribute('data-sp'));
        magUI.sel = magUI.sel === sp ? -1 : sp;
        const s = magCurrent(); if (s) magRender(s);
    };
    root.onclick = e => {
        if (e.target.closest && e.target.closest('.mag-window') && !e.target.closest('.mag-window [data-act]')) return;   // clic dans la fenêtre : ne la ferme pas
        const b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (b && !b.disabled) magOnAct(b.dataset);
    };
    root.oninput = e => {
        const t = e.target;
        if (t.id === 'mag-bid') magUI.bid = t.value;
        else if (t.id === 'mag-tr-gc' && magUI.tr) magUI.tr.gc = t.value;
        else if (t.id === 'mag-tr-rc' && magUI.tr) magUI.tr.rc = t.value;
    };
    root.onchange = e => {
        if (e.target.id === 'mag-tr-to' && magUI.tr) {
            magUI.tr.to = e.target.value; magUI.tr.get = {}; magUI.tr.rk = false; magUI.tr.rc = '';
            const s = magCurrent(); if (s) magRender(s);
        }
    };
    if (!window.magResizeBound) { window.magResizeBound = true; window.addEventListener('resize', magFit); }
    // Préchargement des images de cartes, pour un affichage immédiat au tirage
    if (!window.magPreloaded) { window.magPreloaded = MAG_CARDS.b.map(c => { const im = new Image(); im.src = MAG_CARD_DIR + 'cargaison-' + String(c.img).padStart(2, '0') + '.jpg'; return im; }); }
    magFit();
    setTimeout(magFit, 60);
}

if (typeof window !== 'undefined') {
    // --------------------------- Lancement (hôte) ---------------------------
    window.startMagnatGame = function() {
        if (!window.isHost) return;
        const code = magRoom();
        if (!code || !window.mettreAJourSalonFirebase) return;
        const names = Object.values(state.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
        if (names.length < 2) {
            if (typeof showToast === 'function') showToast('⚠️ Il faut au moins 2 joueurs pour le mode Magnat Galactique !');
            return;
        }
        const timer = Math.max(30, Math.min(180, parseInt(document.getElementById('input-host-timer')?.value, 10) || 90));
        const minutes = Math.max(0, Math.min(180, parseInt(document.getElementById('setting-magnat-minutes')?.value, 10) || 0));
        const s = magNewGame(names, { timer: timer, minutes: minutes }, Date.now());
        magHost.startedAt = s.startedAt; magHost.state = s; magHost.done = {};
        const updates = { status: 'IN_GAME', selectedMode: 'magnat', 'settings/timer': timer, 'settings/magnatMinutes': minutes, magnatGame: { s: s } };
        Object.values(state.players || {}).forEach(p => { if (p && p.name) updates[`players/${p.name}/score`] = 0; });
        window.mettreAJourSalonFirebase(code, updates);
    };

    // --------------------------- Rendu (appelé à chaque mise à jour Firebase) ---------------------------
    window.renderMagnatScreen = function(data) {
        const g = data && data.magnatGame;
        if (!g || !g.s) return;
        const s = magNorm(g.s);
        const sess = String(s.startedAt);
        // Une écriture de l'hôte déclenche aussitôt un nouvel affichage, imbriqué dans celui-ci : on ne doit
        // jamais réafficher un état plus ancien que celui déjà à l'écran.
        if (magUI.seenSess === sess && s.seq < magUI.seenSeq) return;
        magUI.seenSess = sess; magUI.seenSeq = s.seq;
        window.magData = data;
        magPionMemoire(data);
        try { magShow(data, s, sess); }
        finally { if (window.isHost) magHostProcess(data); }      // l'arbitrage se fait APRÈS l'affichage
    };
    function magShow(data, s, sess) {

        if (!window.magTicker) window.magTicker = setInterval(() => { magTickTimer(); magHostTick(); }, 1000);

        if (s.status === 'FINISHED') {
            if (magUI.shown !== sess) {
                magUI.shown = sess;
                const lb = document.getElementById('final-leaderboard');
                if (lb) {
                    lb.innerHTML = s.rank.map((r, i) => `
                        <div class="flex justify-between items-center p-3 rounded-2xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-900 border border-slate-800'} text-xs">
                            <span class="font-bold">#${i + 1} - ${magEsc(r.n)} ${r.w > 0 ? '' : '<span class="text-slate-400 font-normal">(faillite)</span>'}</span>
                            <span class="font-mono text-emerald-400 font-bold text-sm">${r.w} cr</span>
                        </div>`).join('');
                }
                showScreen('screen-results');
                if (typeof window.sfx === 'function') window.sfx('victoire');
            }
            return;
        }

        if (magUI.sess !== sess || !document.getElementById('mag-root')) {
            magUI.sess = sess; magUI.sel = -1; magUI.props = ''; magUI.sig = ''; magUI.trOpen = false; magUI.tr = null; magUI.bid = ''; magUI.bk = false; magUI.lastRoll = s.rollSeq;
            showScreen('screen-generic-game');
            const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = 'Magnat Galactique';
            magBuildLayout();
        }
        magRender(s);
    }
}
