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

// Cartes. x : gain | pay | start | goto | back | portal | jail | free | repairs | each | payeach
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
    b: [
        { x: 'gain', v: 200, txt: "Cargaison de minerai rare vendue : recevez 200 crédits." },
        { x: 'gain', v: 75, txt: "Erreur du comptoir en votre faveur : recevez 75 crédits." },
        { x: 'pay', v: 100, txt: "Réparation de la coque : payez 100 crédits." },
        { x: 'pay', v: 50, txt: "Visite médicale obligatoire : payez 50 crédits." },
        { x: 'each', v: 20, txt: "C'est votre anniversaire galactique : chaque joueur vous offre 20 crédits." },
        { x: 'free', txt: "Sauf-conduit diplomatique : conservez cette carte pour sortir de Quarantaine." },
        { x: 'jail', txt: "Contrebande découverte dans vos soutes : direction la Quarantaine." },
        { x: 'start', txt: "Rappel de la flotte : retournez à la Station Mère et touchez votre solde." },
        { x: 'gain', v: 60, txt: "Remboursement d'assurance : recevez 60 crédits." },
        { x: 'repairs', h: 40, H: 115, txt: "Entretien des installations : payez 40 crédits par avant-poste et 115 par métropole." },
        { x: 'gain', v: 20, txt: "Vous gagnez le concours d'holo-photo : recevez 20 crédits." },
        { x: 'pay', v: 60, txt: "Taxe sur le carburant : payez 60 crédits." },
        { x: 'gain', v: 120, txt: "Héritage d'un lointain cousin : recevez 120 crédits." },
        { x: 'gain', v: 45, txt: "Vente de pièces détachées : recevez 45 crédits." }
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
    Object.keys(s.players).forEach(n => { const p = s.players[n]; p.cash = p.cash || 0; p.pos = p.pos || 0; p.jail = p.jail || 0; p.cards = p.cards || 0; p.out = !!p.out; p.c = p.c || 0; });
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
function magDraw(s, name, deck, depth) {
    if (s.di[deck] >= s.deck[deck].length) s.di[deck] = 0;
    const idx = s.deck[deck][s.di[deck]++];
    const card = MAG_CARDS[deck][idx];
    const p = s.players[name];
    s.card = { d: deck, i: idx, by: name, k: s.seq };
    magLog(s, `${name} tire une carte ${MAG_DECK_NAMES[deck]} : ${card.txt}`);
    if (card.x === 'gain') p.cash += card.v;
    else if (card.x === 'pay') magCharge(s, name, card.v, '', 'carte');
    else if (card.x === 'start') { p.pos = 0; p.cash += MAG.SALARY; }
    else if (card.x === 'jail') magJail(s, name);
    else if (card.x === 'free') p.cards = (p.cards || 0) + 1;
    else if (card.x === 'each') magAlive(s).forEach(q => { if (q !== name) magCharge(s, q, card.v, name, 'carte'); });
    else if (card.x === 'payeach') magAlive(s).forEach(q => { if (q !== name) magCharge(s, name, card.v, q, 'carte'); });
    else if (card.x === 'repairs') {
        let total = 0;
        magOwned(s, name).forEach(sp => { const h = magHouses(s, sp); total += h === 5 ? card.H : h * card.h; });
        if (total > 0) magCharge(s, name, total, '', 'entretien'); else magLog(s, `${name} n'a aucune construction : rien à payer.`);
    } else if (depth < 3) {
        if (card.x === 'goto') magMoveToDepth(s, name, card.sp, true, depth + 1);
        else if (card.x === 'back') magMoveToDepth(s, name, (p.pos - card.v + MAG_N) % MAG_N, false, depth + 1);
        else if (card.x === 'portal') {
            let t = p.pos;
            do { t = (t + 1) % MAG_N; } while (MAG_SPACES[t].t !== 'portal');
            magMoveToDepth(s, name, t, true, depth + 1);
        }
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
    else if (c.t === 'card') magDraw(s, name, c.d, depth || 0);
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
    do { s.turn = (s.turn + 1) % s.order.length; } while (s.players[s.order[s.turn]].out);
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
        s.dl = now + (a ? MAG.AUCTION_SECONDS : s.timer) * 1000;
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
        magLog(s, `${by} hypothèque ${MAG_SPACES[sp].n} (+${magMortgageValue(sp)} cr).`);
        break;
    }
    case 'unmortgage': {
        if (!magCanManage(s, by) || magCheckUnmortgage(s, by, sp)) return null;
        magOwn(s, sp).m = false; me.cash -= magUnmortgageCost(sp);
        magLog(s, `${by} lève l'hypothèque de ${MAG_SPACES[sp].n} (−${magUnmortgageCost(sp)} cr).`);
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
const magUI = { sess: '', sel: -1, sig: '', trOpen: false, tr: null, bid: '', bk: false, lastRoll: -1, shown: '' };

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
// Chaque seconde : si le joueur attendu a dépassé son temps (ou a quitté le salon), l'hôte joue à sa place
function magHostTick() {
    const room = window.currentRoom;
    if (!window.isHost || !room || room.status !== 'IN_GAME' || room.selectedMode !== 'magnat' || !room.magnatGame || !room.magnatGame.s) return;
    const s = magHostState(room.magnatGame);
    if (s.status !== 'PLAYING') return;
    const now = Date.now();
    const present = Object.values(room.players || {}).filter(p => p && p.name && !p.isBot).map(p => p.name);
    const absent = present.indexOf(magActor(s)) < 0;
    if (now > s.dl || (absent && now > s.dlAt + 3000)) {
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
// Pions : conservés d'un affichage à l'autre pour glisser d'une case à la suivante
function magRenderTokens(s) {
    const layer = document.getElementById('mag-tokens');
    if (!layer) return;
    const perSpace = {}, total = {};
    s.order.forEach(n => { const p = s.players[n]; if (!p.out) total[p.pos] = (total[p.pos] || 0) + 1; });
    s.order.forEach((n, idx) => {
        const p = s.players[n];
        let g = document.getElementById('mag-tok-' + idx);
        if (p.out) { if (g) g.remove(); return; }
        if (!g) {
            g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('id', 'mag-tok-' + idx);
            g.style.transition = 'transform .6s ease';
            g.innerHTML = `<circle r="12" fill="${magColor(s, n)}" stroke="#020617" stroke-width="2.5"/><text text-anchor="middle" y="4" font-size="11" font-weight="bold" fill="#020617" font-family="Arial, sans-serif">${magEsc(String(n).charAt(0).toUpperCase())}</text>`;
            layer.appendChild(g);
        }
        const k = perSpace[p.pos] = (perSpace[p.pos] || 0) + 1;
        const slot = k - 1;
        // jusqu'à 4 pions : une file vers le centre ; au-delà : deux files côte à côte
        const two = total[p.pos] > 4;
        const pt = magPt(214 - (two ? Math.floor(slot / 2) : slot) * 23.5, p.pos * 10 + (two ? (slot % 2 ? 4.2 : -4.2) : 0));
        g.style.transform = `translate(${pt[0].toFixed(1)}px, ${pt[1].toFixed(1)}px)`;
        const circle = g.firstChild;
        if (circle) { circle.setAttribute('stroke', n === s.order[s.turn] ? '#ffffff' : '#020617'); circle.setAttribute('stroke-dasharray', p.jail > 0 ? '4 3' : ''); }
    });
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
    el.innerHTML = `
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">Tour ${s.turnCount}</div>
        <div style="font-size:17px;font-weight:900;color:${magColor(s, cur)};max-width:92%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${magEsc(cur)}</div>
        <div style="display:flex;gap:8px;margin:6px 0" class="${rolled && s.rollSeq > 0 ? 'mag-shake' : ''}">${magDie(s.dice[0])}${magDie(s.dice[1])}</div>
        <div style="font-size:11px;color:#e2e8f0;max-width:86%;line-height:1.25">${magEsc(magPhaseText(s))}</div>
        <div id="mag-timer" style="font-family:monospace;font-size:15px;font-weight:bold;color:#fbbf24;margin-top:3px"></div>
        ${card ? `<div style="margin-top:5px;max-width:84%;font-size:10px;line-height:1.25;color:#0f172a;background:${s.card.d === 'a' ? '#a5f3fc' : '#fde68a'};border-radius:8px;padding:5px 7px"><b>${s.card.d === 'a' ? '📡' : '📦'} ${MAG_DECK_NAMES[s.card.d]}</b> — ${magEsc(card.txt)}</div>` : ''}`;
}
function magTickTimer() {
    const data = window.magData, g = data && data.magnatGame;
    if (!g || !g.s || g.s.status !== 'PLAYING') return;
    const now = Date.now();
    const el = document.getElementById('mag-timer');
    if (el) el.textContent = '⏱ ' + Math.max(0, Math.ceil(((g.s.dl || 0) - now) / 1000)) + ' s';
    const top = document.getElementById('generic-game-timer');
    if (top) {
        if (g.s.endAt) { const left = Math.max(0, Math.ceil((g.s.endAt - now) / 1000)); top.innerText = left > 0 ? `Fin dans ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Dernier tour'; }
        else top.innerText = 'Sans limite de temps';
    }
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
                <div class="text-[11px] text-slate-200">Il vous manque <b class="text-amber-300">${Math.max(0, d.amt - p.cash)} cr</b>. Vendez des constructions ou hypothéquez des propriétés (liste « Mes propriétés ») : le paiement se fait automatiquement dès que vous avez assez de crédits.</div>
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
                    ${magBtn('Enchérir', 'data-act="bidinput"', GREEN)}${magBtn('Me retirer', 'data-act="pass"', RED)}</div>`
                : `<div class="text-xs text-slate-300">${a.act.indexOf(me) >= 0 ? `En attente de l'offre de <b>${magEsc(a.act[a.i])}</b>...` : 'Vous vous êtes retiré de cette enchère.'}</div>`}`;
    } else if (cur === me) {
        const canTrade = (s.phase === 'ROLL' || s.phase === 'END') && !s.trade;
        const trade = canTrade ? magBtn('🤝 Proposer un échange', 'data-act="tropen"') : '';
        if (s.phase === 'ROLL' && p.jail > 0) {
            body = `<div class="text-sm font-black text-amber-300">🧪 Vous êtes en Quarantaine (tentative ${p.jail} / 3)</div>
                <div class="flex gap-2 flex-wrap">${magBtn('🎲 Tenter un double', 'data-act="roll"', GREEN)}
                ${magBtn(`Payer ${MAG.BAIL} cr`, 'data-act="bail"', BLUE, p.cash < MAG.BAIL)}
                ${p.cards > 0 ? magBtn('Utiliser un sauf-conduit', 'data-act="usecard"', BLUE) : ''}${trade}</div>`;
        } else if (s.phase === 'ROLL') {
            body = `<div class="text-sm font-black text-emerald-300">C'est votre tour !</div>
                <div class="flex gap-2 flex-wrap">${magBtn('🎲 Lancer les dés', 'data-act="roll"', GREEN)}${trade}</div>`;
        } else if (s.phase === 'BUY') {
            const c = MAG_SPACES[s.buy];
            body = `<div class="text-sm font-black text-white">${magEsc(c.n)} est libre</div>
                <div class="flex gap-2 flex-wrap">${magBtn(`Acheter pour ${c.p} cr`, 'data-act="buy"', GREEN, p.cash < c.p)}${magBtn('Mettre aux enchères', 'data-act="auction"', BLUE)}</div>`;
        } else {
            body = `<div class="text-sm font-black text-emerald-300">${s.again ? 'Double ! Vous rejouez.' : 'Gérez vos biens, puis terminez votre tour.'}</div>
                <div class="flex gap-2 flex-wrap">${s.again ? magBtn('🎲 Relancer les dés', 'data-act="roll"', GREEN) : magBtn('Terminer mon tour', 'data-act="end"', GREEN)}${trade}</div>`;
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
function magPlayersHtml(s, me) {
    const cur = s.order[s.turn];
    return `<div class="p-2 rounded-xl border border-slate-700 bg-slate-900/70 space-y-1">
        <div class="text-[10px] uppercase tracking-wider text-slate-400">Joueurs</div>
        ${s.order.map(n => { const p = s.players[n];
            return `<div class="flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs ${n === cur && !p.out ? 'bg-cyan-950/60 border border-cyan-500/50' : 'border border-transparent'} ${p.out ? 'opacity-40' : ''}">
                <span class="flex items-center gap-1.5 min-w-0"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${magColor(s, n)};border:2px solid #020617;flex-shrink:0"></span>
                <span class="truncate ${n === me ? 'font-black text-white' : 'text-slate-200'}">${magEsc(n)}</span>${p.jail > 0 ? ' 🧪' : ''}${p.cards > 0 ? ' 🎫' : ''}${p.out ? ' 💀' : ''}</span>
                <span class="shrink-0 font-mono"><b class="text-emerald-300">${p.out ? 'faillite' : p.cash + ' cr'}</b>${p.out ? '' : ` <span class="text-slate-500">· ${magOwned(s, n).length} biens · fortune ${magWorth(s, n)}</span>`}</span></div>`; }).join('')}
        <div class="text-[10px] text-slate-500 pt-1">Banque : ${magSupply(s).houses} avant-postes · ${magSupply(s).hotels} métropoles</div></div>`;
}
function magStateLabel(s, sp) {
    const o = magOwn(s, sp);
    if (!o) return '';
    if (o.m) return '<span class="text-red-300">hypothéquée</span>';
    if (o.h === 5) return '<span class="text-amber-300">métropole</span>';
    if (o.h > 0) return `<span class="text-slate-100">${o.h} avant-poste${o.h > 1 ? 's' : ''}</span>`;
    return '';
}
function magMineHtml(s, me) {
    const p = s.players[me];
    if (!p || p.out) return '';
    const owned = magOwned(s, me);
    const can = magCanManage(s, me);
    const rows = owned.map(sp => {
        const c = MAG_SPACES[sp], o = magOwn(s, sp);
        const small = 'px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed';
        const b = (label, act, err, title) => `<button data-act="${act}" data-sp="${sp}" ${!can || err ? 'disabled' : ''} title="${magEsc(err || title)}" class="${small}">${label}</button>`;
        const build = c.t === 'prop' ? b('＋', 'build', magCheckBuild(s, me, sp), `Construire (${magHouseCost(sp)} cr)`) + b('－', 'sell', magCheckSell(s, me, sp), `Vendre une construction (+${Math.floor(magHouseCost(sp) / 2)} cr)`) : '';
        const mort = o.m ? b('Lever', 'unmortgage', magCheckUnmortgage(s, me, sp), `Lever l'hypothèque (${magUnmortgageCost(sp)} cr)`) : b('Hyp.', 'mortgage', magCheckMortgage(s, me, sp), `Hypothéquer (+${magMortgageValue(sp)} cr)`);
        return `<div class="flex items-center justify-between gap-2 py-1 border-b border-slate-800 last:border-0">
            <button data-act="sel" data-sp="${sp}" class="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"><span style="display:inline-block;width:6px;height:22px;border-radius:3px;background:${c.f ? MAG_FAMILIES[c.f].color : '#cbd5e1'};flex-shrink:0"></span>
            <span class="min-w-0"><span class="block truncate text-xs text-slate-100">${magEsc(c.n)}</span><span class="block text-[10px]">${magStateLabel(s, sp) || '<span class="text-slate-500">loyer ' + magRent(s, sp, 7) + ' cr</span>'}</span></span></button>
            <span class="flex gap-1 shrink-0">${build}${mort}</span></div>`;
    }).join('');
    return `<div class="p-2 rounded-xl border border-slate-700 bg-slate-900/70">
        <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Mes propriétés (${owned.length}) ${can ? '' : '<span class="normal-case text-slate-500">— modifiables pendant votre tour</span>'}</div>
        ${rows || '<div class="text-[11px] text-slate-500 italic">Vous ne possédez encore rien.</div>'}</div>`;
}
function magDetailHtml(s) {
    const sp = magUI.sel, c = MAG_SPACES[sp];
    if (!c) return `<div class="p-2 rounded-xl border border-slate-800 bg-slate-900/50 text-[11px] text-slate-500">Touchez une case du plateau pour voir ses détails.</div>`;
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
    return `<div class="p-2 rounded-xl border border-slate-700 bg-slate-900/70 space-y-1">
        <div class="flex items-center justify-between gap-2"><span class="text-sm font-black text-white"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.f ? MAG_FAMILIES[c.f].color : '#64748b'}"></span> ${magEsc(c.n)}</span>
        ${c.p ? `<span class="text-xs font-mono text-amber-300">${c.p} cr</span>` : ''}</div>
        ${magOwnable(sp) ? `<div class="text-[11px] text-slate-300">Propriétaire : ${o ? `<b style="color:${magColor(s, o.o)}">${magEsc(o.o)}</b> ${magStateLabel(s, sp)}` : '<span class="text-slate-500">à vendre</span>'}</div>` : ''}
        ${info}</div>`;
}
function magLogHtml(s) {
    return `<div class="p-2 rounded-xl border border-slate-800 bg-black/40">
        <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Journal</div>
        <div class="space-y-0.5 text-[11px] text-slate-300" style="max-height:150px;overflow-y:auto">${s.log.slice(-12).reverse().map((l, i) => `<div class="${i === 0 ? 'text-white' : ''}">• ${magEsc(l)}</div>`).join('')}</div></div>`;
}
function magRenderSide(s) {
    const side = document.getElementById('mag-side');
    if (!side) return;
    const me = magMe();
    side.innerHTML = magActionHtml(s, me) + magPlayersHtml(s, me) + magDetailHtml(s) + magMineHtml(s, me) + magLogHtml(s);
}
function magRender(s, force) {
    if (!s.debts.length || s.debts[0].who !== magMe()) magUI.bk = false;
    if (s.order[s.turn] !== magMe()) magUI.trOpen = false;
    if (!s.auction) magUI.bid = '';
    const tr = magUI.tr || {};
    const sig = JSON.stringify([s.seq, magUI.sel, magUI.trOpen, tr.to, tr.give, tr.get, tr.gk, tr.rk, magUI.bk, magMe()]);
    if (!force && sig === magUI.sig) return;
    magUI.sig = sig;
    magRenderDyn(s);
    magRenderTokens(s);
    magRenderCenter(s);
    magRenderSide(s);
    magTickTimer();
}
function magCurrent() { const d = window.magData; return d && d.magnatGame && d.magnatGame.s ? magNorm(d.magnatGame.s) : null; }

// Clics du panneau latéral
function magOnAct(d) {
    const s = magCurrent();
    if (!s) return;
    const act = d.act, sp = Number(d.sp);
    const tr = magUI.tr;
    if (['roll', 'bail', 'usecard', 'buy', 'auction', 'pass', 'end', 'accept', 'decline', 'bankrupt'].indexOf(act) >= 0) { if (act === 'bankrupt') magUI.bk = false; magSend({ t: act }); return; }
    if (['build', 'sell', 'mortgage', 'unmortgage'].indexOf(act) >= 0) { magSend({ t: act, sp: sp }); return; }
    if (act === 'bid') { magSend({ t: 'bid', amt: Number(d.amt) }); return; }
    if (act === 'bidinput') { const el = document.getElementById('mag-bid'); const v = Math.floor(Number(el && el.value) || 0); if (v > 0) { magUI.bid = ''; magSend({ t: 'bid', amt: v }); } return; }
    if (act === 'sel') magUI.sel = magUI.sel === sp ? -1 : sp;
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
function magBuildLayout() {
    const content = document.getElementById('generic-game-content');
    if (!content) return;
    if (!document.getElementById('mag-style')) {
        const st = document.createElement('style');
        st.id = 'mag-style';
        st.textContent = '@keyframes magShake{0%{transform:rotate(0) scale(1)}25%{transform:rotate(-18deg) scale(1.15)}50%{transform:rotate(14deg) scale(1.1)}75%{transform:rotate(-8deg) scale(1.05)}100%{transform:rotate(0) scale(1)}}.mag-shake{animation:magShake .55s ease}';
        document.head.appendChild(st);
    }
    content.innerHTML = `
        <div id="mag-root" class="w-full grid grid-cols-1 lg:grid-cols-5 gap-3 items-start">
            <div class="lg:col-span-3">
                <div style="position:relative;width:100%;max-width:720px;margin:0 auto;aspect-ratio:1/1">
                    ${magBoardSvg()}
                    <div id="mag-center" style="position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none"></div>
                </div>
            </div>
            <div id="mag-side" class="lg:col-span-2 space-y-2"></div>
        </div>`;
    const svg = document.getElementById('mag-svg');
    svg.onclick = e => {
        const t = e.target.closest ? e.target.closest('[data-sp]') : null;
        if (!t) return;
        const sp = Number(t.getAttribute('data-sp'));
        magUI.sel = magUI.sel === sp ? -1 : sp;
        const s = magCurrent(); if (s) magRender(s);
    };
    const side = document.getElementById('mag-side');
    side.onclick = e => {
        const b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (b && !b.disabled) magOnAct(b.dataset);
    };
    side.oninput = e => {
        const t = e.target;
        if (t.id === 'mag-bid') magUI.bid = t.value;
        else if (t.id === 'mag-tr-gc' && magUI.tr) magUI.tr.gc = t.value;
        else if (t.id === 'mag-tr-rc' && magUI.tr) magUI.tr.rc = t.value;
    };
    side.onchange = e => {
        if (e.target.id === 'mag-tr-to' && magUI.tr) {
            magUI.tr.to = e.target.value; magUI.tr.get = {}; magUI.tr.rk = false; magUI.tr.rc = '';
            const s = magCurrent(); if (s) magRender(s);
        }
    };
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
        window.magData = data;
        if (window.isHost) magHostProcess(data);
        const s = magNorm(g.s);
        const sess = String(s.startedAt);

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
            }
            return;
        }

        if (magUI.sess !== sess || !document.getElementById('mag-root')) {
            magUI.sess = sess; magUI.sel = -1; magUI.sig = ''; magUI.trOpen = false; magUI.tr = null; magUI.bid = ''; magUI.bk = false; magUI.lastRoll = s.rollSeq;
            showScreen('screen-generic-game');
            const gt = document.getElementById('generic-game-title'); if (gt) gt.innerText = 'Magnat Galactique';
            magBuildLayout();
        }
        magRender(s);
    };
}
