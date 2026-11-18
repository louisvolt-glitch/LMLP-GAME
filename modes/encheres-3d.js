// =====================================================================
//  MISE SECRÈTE : LOTS EN 3D
//  Chaque lot mis aux enchères est un modèle 3D (dossier encheres-visuel/modeles/)
//  qui tourne sur lui-même. Les modèles viennent de Sketchfab ; ils ont été allégés
//  pour le web (textures réduites, maillages simplifiés) : voir encheres-visuel/modeles/CREDITS.txt.
//  three.js et son chargeur glTF sont chargés à la demande (les mêmes que pour Magnat).
//  Si un modèle ne se charge pas, on affiche une icône à la place.
//
//  enchMonter3D(element, nomDuLot) : affiche le lot dans l'élément (un seul lot animé à la fois).
//  enchPrecharger(nomDuLot)        : télécharge un modèle à l'avance (le lot de la manche suivante).
//  enchCredit(nomDuLot)            : petite ligne de crédit de l'auteur du modèle.
// =====================================================================

const ENCH_DIR = window.ENCH_DIR || './encheres-visuel/modeles/';      // la page d'aperçu (dossier outils) le remplace
const ENCH_SCRIPTS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
                      'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'];
// f = fichier (sans .glb), n = nom du lot affiché, cr = [titre d'origine, auteur, licence, adresse]
const ENCH_CATALOGUE = [
    { f: "robot-de-collection-des-annees-60", n: "Robot de collection des années 60", cr: ["1960sRobot_Xiruo_Ma_z5580227", "XiruoMa", "CC-BY-4.0", "https://sketchfab.com/3d-models/1960srobot-xiruo-ma-z5580227-e803ea97310a405e8e46f10d5dbf9ca3"] },
    { f: "balise-extraterrestre", n: "Balise extraterrestre", cr: ["Alien Beacon", "Sahir Virmani", "CC-BY-4.0", "https://sketchfab.com/3d-models/alien-beacon-dbf31251971c408d9185a7d034673acd"] },
    { f: "oeuf-extraterrestre", n: "Œuf extraterrestre", cr: ["Alien egg", "Julio César", "CC-BY-4.0", "https://sketchfab.com/3d-models/alien-egg-4407c29df6e94f2a93334408ba339506"] },
    { f: "plante-extraterrestre", n: "Plante extraterrestre", cr: ["Alien Plant", "azzajess", "CC-BY-NC-4.0", "https://sketchfab.com/3d-models/alien-plant-d0b102cb3e994ba19325e68c35685d62"] },
    { f: "masque-extraterrestre-ancien", n: "Masque extraterrestre ancien", cr: ["Ancient Alien Mask", "cyberreno", "CC-BY-4.0", "https://sketchfab.com/3d-models/ancient-alien-mask-2f52b7f3f91443638f99a29a3d5055d4"] },
    { f: "carapace-d-un-dieu-ancien", n: "Carapace d'un dieu ancien", cr: ["Ancient God", "KaeGeeRow", "CC-BY-4.0", "https://sketchfab.com/3d-models/ancient-god-ec4a8ec3dd7e4601afc1506b14997818"] },
    { f: "burger-terrien-legendaire", n: "Burger terrien légendaire", cr: ["Back Yard Burgers - Classic Burger", "Ehsan Abbasi", "CC-BY-SA-4.0", "https://sketchfab.com/3d-models/back-yard-burgers-classic-burger-6e13942ff76d4129b06e097cdd060adb"] },
    { f: "bonsai-de-la-terre", n: "Bonsaï de la Terre", cr: ["Bonsai", "Vermos", "CC-BY-4.0", "https://sketchfab.com/3d-models/bonsai-8b73fd97545b468288cd9ba03c93d358"] },
    { f: "echiquier-du-capitaine", n: "Échiquier du capitaine", cr: ["CHESS BOARD", "Kmunawwar703", "CC-BY-4.0", "https://sketchfab.com/3d-models/chess-board-d7c57b9b15e24498973cb2d2dc14cbcf"] },
    { f: "specimen-en-bocal", n: "Spécimen en bocal", cr: ["Creature Specimen Jar", "Michael V", "SKETCHFAB Standard", "https://sketchfab.com/3d-models/creature-specimen-jar-8254ff1e5aea4c68bafa60feab242726"] },
    { f: "cristal-d-energie", n: "Cristal d'énergie", cr: ["Crystal", "xNiru", "CC-BY-4.0", "https://sketchfab.com/3d-models/crystal-d963c19d8132441eb0666c513d558583"] },
    { f: "robot-de-compagnie", n: "Robot de compagnie", cr: ["cute robot", "victory_mirosya", "CC-BY-4.0", "https://sketchfab.com/3d-models/cute-robot-6aadb75f596742ada2814ad4593f0032"] },
    { f: "couronne-du-dragon", n: "Couronne du dragon", cr: ["Dragon Crown", "CrazyMoralFreak", "CC-BY-4.0", "https://sketchfab.com/3d-models/dragon-crown-1c3e9c10984d43ec82f26bf8f7c08907"] },
    { f: "guitare-electrique-terrienne", n: "Guitare électrique terrienne", cr: ["Electric guitar (Dragons) v1.2", "3DWorkbench", "CC-BY-4.0", "https://sketchfab.com/3d-models/electric-guitar-dragons-v12-3589a97c506e40bcb02d8ce4d8ac29b9"] },
    { f: "aquarium-de-poche", n: "Aquarium de poche", cr: ["Fish Bowl: Household Props 1", "Daniel O'Neil", "CC-BY-4.0", "https://sketchfab.com/3d-models/fish-bowl-household-props-1-26c4469c1fd94e899b5ded8b41da0b39"] },
    { f: "fossile-d-ammonite", n: "Fossile d'ammonite", cr: ["Fossilized Ammonite, Natural History Museum", "Thomas Flynn", "CC-BY-4.0", "https://sketchfab.com/3d-models/fossilized-ammonite-natural-history-museum-5c1280e4c47c45d2bfe59c7e53131834"] },
    { f: "orbes-des-anciens", n: "Orbes des anciens", cr: ["Futuristic Orbs Set", "zaina", "CC-BY-4.0", "https://sketchfab.com/3d-models/futuristic-orbs-set-d05876578dbe40fab0975bdbdd931877"] },
    { f: "service-a-the-futuriste", n: "Service à thé futuriste", cr: ["Futuristic Sci-Fi Cup & Plate 3D Model", "Doran", "CC-BY-4.0", "https://sketchfab.com/3d-models/futuristic-sci-fi-cup-plate-3d-model-295512f6131d4ca889fde922ccfeb8d8"] },
    { f: "champignon-luminescent", n: "Champignon luminescent", cr: ["Glowing Mushroom", "Jakob_Forseth", "CC-BY-4.0", "https://sketchfab.com/3d-models/glowing-mushroom-4d69b432b067413d9d7bac74f02155c0"] },
    { f: "paire-de-reacteurs-dorsaux", n: "Paire de réacteurs dorsaux", cr: ["Halo Reach Jetpacks", "Elite Big Speakerman", "CC-BY-4.0", "https://sketchfab.com/3d-models/halo-reach-jetpacks-2abf5665d9d7477aae90ffff1e56b22d"] },
    { f: "carte-planetaire-holographique", n: "Carte planétaire holographique", cr: ["Hologram Planetary Map", "DennisGray", "CC-BY-4.0", "https://sketchfab.com/3d-models/hologram-planetary-map-4e60b10f849241319e6e243482dd1b2b"] },
    { f: "sablier-temporel", n: "Sablier temporel", cr: ["Hourglass", "• Less •", "CC-BY-4.0", "https://sketchfab.com/3d-models/hourglass-a453e90d47b74260b5e5ccd5a965fe3e"] },
    { f: "moto-antigravite", n: "Moto antigravité", cr: ["Hoverbike Post apocalypse", "sarayel", "CC-BY-SA-4.0", "https://sketchfab.com/3d-models/hoverbike-post-apocalypse-50f67d1f9e2c43e2b1383f32834a880d"] },
    { f: "tablette-gravee", n: "Tablette gravée", cr: ["Low Reproduction Tablet", "Corkum", "CC-BY-4.0", "https://sketchfab.com/3d-models/low-reproduction-tablet-3f02ef756b2746de85ad98ed2a9e50f6"] },
    { f: "plante-carnivore", n: "Plante carnivore", cr: ["#LowPolyPlantChallenge | Carnivorous flower", "Ligul3D", "CC-BY-4.0", "https://sketchfab.com/3d-models/lowpolyplantchallenge-carnivorous-flower-5cb258f984a1449a835875ae278e26e5"] },
    { f: "capsule-de-survie", n: "Capsule de survie", cr: ["Lucisus Escape Pod - Green Variant", "3DJam", "CC-BY-4.0", "https://sketchfab.com/3d-models/lucisus-escape-pod-green-variant-2ae46cdf439e4704bb217c1d0411a8ab"] },
    { f: "module-lunaire", n: "Module lunaire", cr: ["Lunar Ship LK LANDER", "leopro", "CC-BY-4.0", "https://sketchfab.com/3d-models/lunar-ship-lk-lander-e8de5a44582d41e99fb1ebeed6664e4d"] },
    { f: "rover-martien", n: "Rover martien", cr: ["Mars rover", "Lezalit", "CC-BY-4.0", "https://sketchfab.com/3d-models/mars-rover-28da0a9e0c294be2aa6dfa8dc9b52363"] },
    { f: "trousse-medicale", n: "Trousse médicale", cr: ["Medkit", "DJMaesen", "CC-BY-4.0", "https://sketchfab.com/3d-models/medkit-bda966f7d9ac42a1bcd6e77481be0897"] },
    { f: "meteorite", n: "Météorite", cr: ["Meteorite", "laboratorija", "CC-BY-NC-SA-4.0", "https://sketchfab.com/3d-models/meteorite-f649328ea80c426eb500477c6d6e4734"] },
    { f: "puce-prototype", n: "Puce prototype", cr: ["Microchip - Prototype", "re1monsen", "CC-BY-4.0", "https://sketchfab.com/3d-models/microchip-prototype-7d00abe914664a17b4bf18c6e851e7eb"] },
    { f: "rations-de-survie", n: "Rations de survie", cr: ["Military Ration Meal Pouch", "Sousinho", "CC-BY-4.0", "https://sketchfab.com/3d-models/military-ration-meal-pouch-4d639ba0289f49739a6dd9e3ec697f7b"] },
    { f: "obelisque-noir", n: "Obélisque noir", cr: ["Monolith", "RBG_illustrations", "CC-BY-4.0", "https://sketchfab.com/3d-models/monolith-b6bb0cb5f1ed4ffdac959266f03490b8"] },
    { f: "casque-d-astronaute", n: "Casque d'astronaute", cr: ["NASA Astronaut Helmet", "cyberreno", "CC-BY-4.0", "https://sketchfab.com/3d-models/nasa-astronaut-helmet-679860b28b1746e58f4f2d8b0221c16a"] },
    { f: "montre-du-capitaine", n: "Montre du capitaine", cr: ["Old pocket watch", "Maxim Lukyanov", "CC-BY-4.0", "https://sketchfab.com/3d-models/old-pocket-watch-3de961297e0d4f228d0f5d01527ee64f"] },
    { f: "bouteille-d-oxygene", n: "Bouteille d'oxygène", cr: ["Oxygen Cylinder", "Alexander Troianovskyi", "CC-BY-4.0", "https://sketchfab.com/3d-models/oxygen-cylinder-e7419671f8124cab870d7a1a4d68b180"] },
    { f: "replicateur-a-cafe", n: "Réplicateur à café", cr: ["Portable Replicator - Coffee Selected", "nickheitzman", "CC-BY-4.0", "https://sketchfab.com/3d-models/portable-replicator-coffee-selected-fa53f027fd9142eba76b7cf775102c2d"] },
    { f: "artefact-pyramidal", n: "Artefact pyramidal", cr: ["Pyramid", "quedlin", "CC-BY-4.0", "https://sketchfab.com/3d-models/pyramid-b47c6d297832428faee5c28a874949b7"] },
    { f: "pistolet-a-rayons", n: "Pistolet à rayons", cr: ["RAY GUN", "XOIAL", "SKETCHFAB Standard", "https://sketchfab.com/3d-models/ray-gun-fc0703bc4ddc47d8b7098ff3ce5e4bbb"] },
    { f: "lingots-d-or", n: "Lingots d'or", cr: ["Realistic Gold Bar", "Seth Santos", "CC-BY-4.0", "https://sketchfab.com/3d-models/realistic-gold-bar-194d2227c82549fcba14a37342ea3d08"] },
    { f: "bobine-tesla", n: "Bobine Tesla", cr: ["Red Alert 2 - Soviet Tesla coil", "Ska-Ara", "CC-BY-4.0", "https://sketchfab.com/3d-models/red-alert-2-soviet-tesla-coil-deffdea10a0b4742bae2d6d16a743c67"] },
    { f: "console-de-jeu-retro", n: "Console de jeu rétro", cr: ["Retro console Amiga CD32", "Scar56", "CC-BY-4.0", "https://sketchfab.com/3d-models/retro-console-amiga-cd32-db60410314e1467381d3751c213c3696"] },
    { f: "fusee-vintage", n: "Fusée vintage", cr: ["Retro Rocket", "Cristian Brevis Acevedo", "CC-BY-SA-4.0", "https://sketchfab.com/3d-models/retro-rocket-47b4764184cf490da90b6944c6466f90"] },
    { f: "bras-robotique", n: "Bras robotique", cr: ["Robot arm wip 2", "3DHaupt", "CC-BY-4.0", "https://sketchfab.com/3d-models/robot-arm-wip-2-cb006bfafc20421f9f6f674f127f918b"] },
    { f: "canard-en-caoutchouc-d-astronaute", n: "Canard en caoutchouc d'astronaute", cr: ["Rubber Duck Toy", "Prince Obrymec", "SKETCHFAB Standard", "https://sketchfab.com/3d-models/rubber-duck-toy-2fcdc70227df4aafb1d96be15fa622f0"] },
    { f: "combinaison-spatiale", n: "Combinaison spatiale", cr: ["Rust Space Suit", "Homless_Models", "CC-BY-4.0", "https://sketchfab.com/3d-models/rust-space-suit-c9b05b4878d64c68945ba8858c523a68"] },
    { f: "satellite-d-observation", n: "Satellite d'observation", cr: ["Satellite", "Daan van Leeuwen", "CC-BY-NC-4.0", "https://sketchfab.com/3d-models/satellite-d232fe608c874009bad9613c8093a972"] },
    { f: "antenne-longue-portee", n: "Antenne longue portée", cr: ["Satellite Dish", "MRowa", "CC-BY-SA-4.0", "https://sketchfab.com/3d-models/satellite-dish-7df50342811d44fba81c7e953838d069"] },
    { f: "console-de-commandement", n: "Console de commandement", cr: ["Sci-Fi Computer Desk Console", "Inditrion Dradnon", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-computer-desk-console-28c67457f2ef4973a0bbc8b667bb183f"] },
    { f: "appareil-mysterieux", n: "Appareil mystérieux", cr: ["Sci-Fi Device", "klawsklaws", "SKETCHFAB Standard", "https://sketchfab.com/3d-models/sci-fi-device-71e11de3d0a245529c7cc4f831603af6"] },
    { f: "outil-de-decoupe-laser", n: "Outil de découpe laser", cr: ["Sci-fi Gun / Tool", "Koyshem", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-gun-tool-e04a6cd043d440868c45bd0248e96f0f"] },
    { f: "casque-de-combat", n: "Casque de combat", cr: ["Sci-Fi Helmet", "Udon-San", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-helmet-785f5cfd848940b1a4a0b8ddeefc9ef1"] },
    { f: "carte-d-acces", n: "Carte d'accès", cr: ["Sci-fi Key Card", "MattyDMakesGames", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-key-card-dd5733bc673e436590b9186dbbf0f387"] },
    { f: "nacelle-spatiale-personnelle", n: "Nacelle spatiale personnelle", cr: ["Sci-Fi Personal Space Pod Ship(weekly challenge)", "futaba@blender", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-personal-space-pod-shipweekly-challenge-b158f01dd4a9416fb689ca4401856e7a"] },
    { f: "plateforme-de-teleportation", n: "Plateforme de téléportation", cr: ["Sci-Fi Platform / Teleporter Pad–Unity & Unreal", "DevPoly3D", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-platform-teleporter-padunity-unreal-ec178b39b6da429ea8d5a26f0981be77"] },
    { f: "generateur-de-bouclier", n: "Générateur de bouclier", cr: ["Sci-Fi Shield Generator", "Harri Snellman", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-shield-generator-e69f4eeaf4034cd2aee03b89396d1882"] },
    { f: "coffre-de-pirate-spatial", n: "Coffre de pirate spatial", cr: ["Sci Fi Chest #TreasureChestChallenge.", "Smoggybeard", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-chest-treasurechestchallenge-6c3be42b1f3e4327900edba1475c5311"] },
    { f: "noyau-d-energie", n: "Noyau d'énergie", cr: ["Sci Fi Energy Core 1", "FilipZelinka", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-energy-core-1-a5aefe7b281f46529aed2ec9d873bc52"] },
    { f: "cellule-de-fusion", n: "Cellule de fusion", cr: ["Sci Fi Power Cell", "roger.soucy", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-power-cell-814eedf8b7b345948d733f4f923cbecf"] },
    { f: "conteneur-de-stockage", n: "Conteneur de stockage", cr: ["Sci Fi Storage", "alekseewa", "CC-BY-4.0", "https://sketchfab.com/3d-models/sci-fi-storage-aca88e6de01140fab3cc51b7814a23a5"] },
    { f: "module-de-navigation", n: "Module de navigation", cr: ["SciFi Gadget", "re1monsen", "CC-BY-4.0", "https://sketchfab.com/3d-models/scifi-gadget-f5d644350c894f3094786a251267b99e"] },
    { f: "drone-eclaireur", n: "Drone éclaireur", cr: ["Scouting Drone - Lemon 1", "Nils Folker", "CC-BY-4.0", "https://sketchfab.com/3d-models/scouting-drone-lemon-1-38c48e9f455a4b92b6b6d7571381c613"] },
    { f: "statue-du-serpent", n: "Statue du serpent", cr: ["Snake Statue", "Ville Seppänen", "CC-BY-4.0", "https://sketchfab.com/3d-models/snake-statue-794b77a3e4654a669cf259d20dc89ec7"] },
    { f: "chaussette-perdue-en-apesanteur", n: "Chaussette perdue en apesanteur", cr: ["Sock hung", "RubaQewar", "CC-BY-4.0", "https://sketchfab.com/3d-models/sock-hung-2fdf44f9e3024c8fac2c9c7383bcde79"] },
    { f: "panneau-solaire-deployable", n: "Panneau solaire déployable", cr: ["Solar Panel", "Edwin", "CC-BY-4.0", "https://sketchfab.com/3d-models/solar-panel-0f444052d1e64ccfb065fb8d00405f19"] },
    { f: "cargo-de-transport", n: "Cargo de transport", cr: ["Space Cargo Ship Transporter", "Inditrion Dradnon", "CC-BY-4.0", "https://sketchfab.com/3d-models/space-cargo-ship-transporter-76c18dcb6a0043d6ab05ed9f9c26330b"] },
    { f: "station-spatiale-miniature", n: "Station spatiale miniature", cr: ["Space Station 3", "re1monsen", "CC-BY-4.0", "https://sketchfab.com/3d-models/space-station-3-a7a6ad10261149cab31aa394bfcf8940"] },
    { f: "vaisseau-crabe", n: "Vaisseau-crabe", cr: ["SPACESHIP EAV 2 \"CRAB\"", "Ilya Shevchuk", "CC-BY-4.0", "https://sketchfab.com/3d-models/spaceship-eav-2-crab-f4bfa996007e4a6fbd0f31fa807230ce"] },
    { f: "sphere-espion", n: "Sphère espion", cr: ["Spy Drone", "MRowa", "CC-BY-SA-4.0", "https://sketchfab.com/3d-models/spy-drone-f3ee55e6cdd94f398ce05b99cc193e11"] },
    { f: "prototype-furtif", n: "Prototype furtif", cr: ["Stealth Spaceship JJ-1", "jungle_jim", "CC-BY-4.0", "https://sketchfab.com/3d-models/stealth-spaceship-jj-1-0b15e3c2f7a644c997b066dc569d6fbc"] },
    { f: "lunette-de-laiton", n: "Lunette de laiton", cr: ["Steampunk Telescope", "Alex P.", "CC-BY-4.0", "https://sketchfab.com/3d-models/steampunk-telescope-eeae8668106246398fc7956d2fb225e5"] },
    { f: "boussole-cosmique", n: "Boussole cosmique", cr: ["Stylized Magic Compass", "MAR.COS.", "CC-BY-4.0", "https://sketchfab.com/3d-models/stylized-magic-compass-4f935b708d194be5b8a51369756c5caa"] },
    { f: "vaisseau-minier", n: "Vaisseau minier", cr: ["Termite Mk.I / Space Engineers", "ltanailov", "CC-BY-4.0", "https://sketchfab.com/3d-models/termite-mki-space-engineers-92d92c12a8ff46b486fd44bfc0b58db8"] },
    { f: "grille-pain-spatial", n: "Grille-pain spatial", cr: ["Toaster", "Artem P", "CC-BY-4.0", "https://sketchfab.com/3d-models/toaster-0dd620043178479db6752ab103b1e04e"] },
    { f: "antimatiere-instable", n: "Antimatière instable", cr: ["Unstable Antimatter", "tamminen", "CC-BY-4.0", "https://sketchfab.com/3d-models/unstable-antimatter-d057d7fd6d07417fb479934d2bfc1eb4"] },
    { f: "globe-terrestre-ancien", n: "Globe terrestre ancien", cr: ["Vintage globe", "AnnaBelle Fibonacci", "CC-BY-4.0", "https://sketchfab.com/3d-models/vintage-globe-5ae174f9d26f40b99eebe3427153438f"] },
    { f: "gramophone", n: "Gramophone", cr: ["Vintage Gramophone", "3dvachevsky", "CC-BY-4.0", "https://sketchfab.com/3d-models/vintage-gramophone-9a3c1a9c5a3a41f199ac720ece8f8937"] },
    { f: "meca-de-combat", n: "Méca de combat", cr: ["ZBrush for Concept - Mech Design D.ver", "Moon dong hwa", "SKETCHFAB Standard", "https://sketchfab.com/3d-models/zbrush-for-concept-mech-design-dver-a421f87ebeb94b6684c28769b028dd4a"] }];
window.ENCH_CATALOGUE = ENCH_CATALOGUE;
const ENCH_PAR_NOM = {};
ENCH_CATALOGUE.forEach(l => { ENCH_PAR_NOM[l.n] = l; });

const ench3d = { etat: '', promesse: null, actif: null, cache: {} };

function ench3dEchapper(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Charge three.js puis le chargeur glTF (une seule fois)
function ench3dCharger() {
    if (window.THREE && THREE.GLTFLoader) return Promise.resolve();
    if (ench3d.promesse) return ench3d.promesse;
    const charger = typeof sysChargerScript === 'function' ? sysChargerScript : (src => new Promise((ok, ko) => {
        const el = document.createElement('script'); el.src = src; el.async = false; el.onload = ok; el.onerror = () => ko(new Error(src)); document.head.appendChild(el);
    }));
    const besoin = window.THREE ? ENCH_SCRIPTS.slice(1) : ENCH_SCRIPTS;
    ench3d.promesse = besoin.reduce((p, src) => p.then(() => charger(src)), Promise.resolve())
        .then(() => { if (!(window.THREE && THREE.GLTFLoader)) throw new Error('three.js indisponible'); })
        .catch(e => { ench3d.promesse = null; throw e; });
    return ench3d.promesse;
}

// Télécharge un modèle (gardé en mémoire) et calcule une fois son cadrage
function ench3dModele(f) {
    if (!ench3d.cache[f]) {
        ench3d.cache[f] = new Promise((ok, ko) => {
            new THREE.GLTFLoader().load(ENCH_DIR + f + '.glb', gltf => {
                const T = THREE, racine = gltf.scene;
                racine.updateMatrixWorld(true);
                const boite = new T.Box3().setFromObject(racine);
                const taille = boite.getSize(new T.Vector3()), centre = boite.getCenter(new T.Vector3());
                const maxi = Math.max(taille.x, taille.y, taille.z) || 1;
                gltf.cadrage = { centre: centre, echelle: 2.1 / maxi, plat: taille.y < 0.3 * Math.max(taille.x, taille.z) };
                racine.traverse(o => { if (o.isMesh) o.frustumCulled = false; });      // évite des pièces qui disparaissent en tournant
                ok(gltf);
            }, undefined, err => { delete ench3d.cache[f]; ko(err); });
        });
    }
    return ench3d.cache[f];
}

window.enchPrecharger = function(nom) {
    const lot = ENCH_PAR_NOM[nom];
    if (!lot) return;
    ench3dCharger().then(() => ench3dModele(lot.f)).catch(() => {});
};

window.enchCredit = function(nom) {
    const lot = ENCH_PAR_NOM[nom];
    if (!lot) return '';
    const [titre, auteur, licence, url] = lot.cr;
    return `Modèle 3D : <a href="${ench3dEchapper(url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">« ${ench3dEchapper(titre)} »</a> par ${ench3dEchapper(auteur)} · ${ench3dEchapper(licence)}`;
};

// Petit « studio » pour les reflets des matériaux métalliques (sans lui, le métal paraît noir)
function ench3dEnvironnement(T, renderer) {
    const studio = new T.Scene();
    studio.background = new T.Color(0x1e293b);
    const panneau = (couleur, x, y, z, l, h) => {
        const m = new T.Mesh(new T.PlaneGeometry(l, h), new T.MeshBasicMaterial({ color: couleur, side: T.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
    };
    panneau(0xffffff, 0, 6, 2, 8, 4);        // grande lumière au-dessus
    panneau(0xbfdbfe, -6, 1, 3, 3, 5);       // côté gauche bleuté
    panneau(0xfde68a, 6, 1, -2, 3, 5);       // côté droit chaud
    panneau(0x334155, 0, -5, 0, 12, 12);     // sol sombre
    const pm = new T.PMREMGenerator(renderer);
    const tex = pm.fromScene(studio, 0.04).texture;
    pm.dispose();
    studio.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
}

function ench3dArreter() {
    const a = ench3d.actif;
    if (!a) return;
    ench3d.actif = null;
    cancelAnimationFrame(a.raf);
    try { if (a.ro) a.ro.disconnect(); } catch (e) {}
    try { if (a.mixer) a.mixer.stopAllAction(); } catch (e) {}
    try { if (a.fx) a.fx.detruire(); } catch (e) {}
    try { if (a.fit && a.modele) a.fit.remove(a.modele); } catch (e) {}       // le modèle reste en mémoire pour la prochaine fois
    try { if (a.env) a.env.dispose(); a.renderer.dispose(); } catch (e) {}
    if (a.canvas && a.canvas.parentNode) a.canvas.parentNode.removeChild(a.canvas);
}

function ench3dSecours(el, texte) {
    if (el && el.isConnected) el.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#94a3b8;font-size:12px"><div style="font-size:56px;line-height:1">📦</div>${texte || ''}</div>`;
}

// Surprises déjà jouées (une seule fois par lot et par manche, même si l'écran se redessine)
const ench3dJoues = {};

// opts : { mode: 'mise' | 'revelation', surprise: 'adjuge' | 'invendu', cle: identifiant unique de la manche }
window.enchMonter3D = function(el, nom, opts) {
    if (!el) return false;
    opts = opts || {};
    const lot = ENCH_PAR_NOM[nom];
    if (!lot) { ench3dSecours(el); return false; }
    // même lot, même écran : l'écran a seulement été redessiné, on raccroche l'affichage en cours (sans tout recharger)
    const a = ench3d.actif;
    if (a && a.nom === nom && a.mode === (opts.mode || 'mise')) {
        el.innerHTML = ''; el.style.position = el.style.position || 'relative';
        el.appendChild(a.canvas); a.fx && a.fx.doms.forEach(d => el.appendChild(d));
        a.el = el; a.horsPage = 0;
        if (a.ro) { a.ro.disconnect(); a.ro.observe(el); }
        if (a.fxCtx) a.fxCtx.el = el;
        ench3dCliquable(el, a);
        return true;
    }
    ench3dSecours(el, 'Chargement du lot…');
    const jeton = {};
    el._ench3d = jeton;                         // si l'écran change pendant le chargement, on abandonne
    ench3dCharger().then(() => ench3dModele(lot.f)).then(gltf => {
        if (!el.isConnected || el._ench3d !== jeton) return;
        ench3dAfficher(el, gltf, lot, opts);
    }).catch(err => { console.warn('Lot 3D indisponible :', lot.f, err && err.message); ench3dSecours(el); });
    return true;
};

// Pendant les mises, toucher le lot le fait tournoyer
function ench3dCliquable(el, a) {
    if (a.mode !== 'mise' || !a.fx) return;
    el.style.cursor = 'pointer';
    el.title = 'Touchez le lot pour l’inspecter';
    el.onclick = () => { if (fxPret(a)) { a.fx.mouvement('toupie', 1.2); fxSon('pop'); } };
}
function fxPret(a) { return a && a.fx && ench3d.actif === a; }

function ench3dAfficher(el, gltf, lot, opts) {
    ench3dArreter();
    const T = window.THREE;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { ench3dSecours(el); return; }            // pas de WebGL sur cet appareil
    el.innerHTML = '';
    if (!el.style.position) el.style.position = 'relative';
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(canvas);

    const scene = new T.Scene();
    let env = null;
    try { env = ench3dEnvironnement(T, renderer); scene.environment = env; } catch (e) {}
    const cam = new T.PerspectiveCamera(35, 1, 0.05, 100);
    cam.position.set(0, 0.55, 5.4); cam.lookAt(0, 0, 0);
    const ciel = new T.HemisphereLight(0xe0f2fe, 0x1e293b, 0.8); scene.add(ciel);
    const cle = new T.DirectionalLight(0xffffff, 1.4); cle.position.set(3, 4, 5); scene.add(cle);
    const contre = new T.DirectionalLight(0x38bdf8, 0.9); contre.position.set(-4, 2, -3); scene.add(contre);

    // inclinaison (objets plats) > mouvements des effets > rotation > cadrage > modèle
    const c = gltf.cadrage;
    const incline = new T.Group(), mouv = new T.Group(), tourne = new T.Group(), fit = new T.Group();
    if (c.plat) incline.rotation.x = 0.85;          // un objet plat est penché vers les joueurs
    fit.scale.setScalar(c.echelle);
    fit.position.set(-c.centre.x * c.echelle, -c.centre.y * c.echelle, -c.centre.z * c.echelle);
    const modele = gltf.scene;
    if (modele.parent) modele.parent.remove(modele);
    fit.add(modele); tourne.add(fit); mouv.add(tourne); incline.add(mouv); scene.add(incline);
    // socle holographique
    const socle = new T.Mesh(new T.RingGeometry(1.0, 1.25, 64), new T.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.3, side: T.DoubleSide }));
    socle.rotation.x = -Math.PI / 2; socle.position.y = -1.3; scene.add(socle);

    let mixer = null;
    if (gltf.animations && gltf.animations.length) {
        try { mixer = new T.AnimationMixer(modele); gltf.animations.forEach(a => mixer.clipAction(a).play()); } catch (e) { mixer = null; }
    }
    const taille = () => {
        const cible = actif.el, w = Math.max(1, cible.clientWidth), h = Math.max(1, cible.clientHeight);
        renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    const actif = { renderer, canvas, raf: 0, ro: null, mixer, fit, modele, env, el, nom: lot.n, mode: opts.mode || 'mise', horsPage: 0 };
    taille();
    if (window.ResizeObserver) { actif.ro = new ResizeObserver(taille); actif.ro.observe(el); }
    ench3d.actif = actif;

    // --- effets spéciaux ---
    if (typeof window.enchCreerFx === 'function' && window.enchEffets) {
        try {
            actif.fxCtx = { scene, cam, mouv, lumieres: [ciel, cle, contre], el };
            const fx = actif.fx = window.enchCreerFx(T, actif.fxCtx);
            const recette = window.enchEffets.surprises[lot.f] || {};
            const amb = recette.a || ['etincelles'];
            fx.ambiance(amb[0], amb[1]);
            if (opts.surprise && opts.cle && !ench3dJoues[opts.cle]) {
                ench3dJoues[opts.cle] = true;
                fx.apres(0.5, () => {
                    if (opts.surprise === 'invendu') window.enchEffets.invendu(fx);
                    else {
                        (recette.s || window.enchEffets.defaut)(fx);
                        if (Math.random() < 0.08) window.enchEffets.collector(fx);      // bonus rare
                    }
                });
            }
            ench3dCliquable(el, actif);
        } catch (e) { console.warn('Effets indisponibles :', e); actif.fx = null; }
    }

    const t0 = performance.now();
    let avant = t0;
    const boucle = () => {
        if (ench3d.actif !== actif) return;
        // l'écran a changé : on attend un peu (il est peut-être seulement redessiné) avant de libérer le moteur
        if (!canvas.isConnected) { if (++actif.horsPage > 45) { ench3dArreter(); return; } actif.raf = requestAnimationFrame(boucle); return; }
        actif.horsPage = 0;
        const maintenant = performance.now(), t = (maintenant - t0) / 1000, dt = Math.min(0.1, (maintenant - avant) / 1000);
        tourne.rotation.y = t * 0.8;
        incline.position.y = Math.sin(t * 1.6) * 0.07;
        socle.material.opacity = 0.22 + (Math.sin(t * 2) + 1) * 0.08;
        if (mixer) mixer.update(dt);
        if (actif.fx) actif.fx.maj(dt);
        avant = maintenant;
        renderer.render(scene, cam);
        actif.raf = requestAnimationFrame(boucle);
    };
    boucle();
}
