// =====================================================================
//  TRANSMISSION VISUELLE : mots à dessiner
//  Par thème, trois niveaux : [facile, moyen, difficile]
//  (le dessinateur choisit un mot de chaque niveau ; plus c'est dur, plus ça rapporte)
// =====================================================================
window.DV_MOTS = {
    espace: [
        ["fusée", "étoile", "lune", "soleil", "planète", "astronaute", "comète", "satellite", "robot", "extraterrestre", "soucoupe volante", "télescope",
         "casque", "drapeau", "cratère", "météorite", "antenne", "hublot", "radar", "laser"],
        ["station spatiale", "trou noir", "anneaux de Saturne", "galaxie", "constellation", "combinaison spatiale", "navette", "astéroïde", "éclipse",
         "rover martien", "voie lactée", "sabre laser", "téléporteur", "pilote", "base lunaire", "carburant", "cockpit", "atterrissage", "apesanteur", "radio"],
        ["supernova", "nébuleuse", "décollage", "gravité", "hyperespace", "trou de ver", "aurore boréale", "pluie de météores", "invasion extraterrestre",
         "capsule d’hibernation", "sortie extravéhiculaire", "panne de moteur", "contrôle de mission", "compte à rebours", "colonie martienne",
         "big bang", "orbite", "éruption solaire", "rayon tracteur", "champ de force"]
    ],
    quotidien: [
        ["maison", "voiture", "chaise", "lit", "téléphone", "lunettes", "parapluie", "clé", "livre", "horloge", "ballon", "chaussure", "chapeau",
         "cadeau", "bougie", "lampe", "brosse à dents", "ciseaux", "fenêtre", "porte"],
        ["ordinateur", "télécommande", "machine à laver", "escalier", "réveil", "aspirateur", "valise", "sac à dos", "trottinette", "bicyclette",
         "baignoire", "micro-ondes", "piscine", "boîte aux lettres", "tondeuse", "frigo", "guitare", "appareil photo", "casque audio", "ascenseur"],
        ["embouteillage", "déménagement", "lave-vaisselle", "feu d’artifice", "manège", "parc d’attractions", "hôpital", "anniversaire", "bibliothèque",
         "grande roue", "caisse enregistreuse", "carte au trésor", "montagnes russes", "cinéma", "salle de sport", "gratte-ciel", "jeu vidéo",
         "bonhomme de neige", "château de sable", "selfie"]
    ],
    animaux: [
        ["chat", "chien", "poisson", "oiseau", "serpent", "lapin", "vache", "cochon", "canard", "souris", "escargot", "papillon", "araignée",
         "tortue", "abeille", "girafe", "éléphant", "lion", "cheval", "fourmi"],
        ["pieuvre", "requin", "dauphin", "kangourou", "pingouin", "hibou", "crocodile", "chauve-souris", "dinosaure", "licorne", "coccinelle",
         "méduse", "flamant rose", "hérisson", "écureuil", "baleine", "zèbre", "panda", "renard", "grenouille"],
        ["caméléon", "hippocampe", "paresseux", "ornithorynque", "toile d’araignée", "fourmilière", "nid d’oiseau", "dragon", "phénix", "sirène",
         "cactus", "volcan", "cascade", "arc-en-ciel", "tornade", "forêt tropicale", "désert", "iceberg", "marée haute", "éclair"]
    ],
    nourriture: [
        ["pomme", "banane", "pizza", "gâteau", "glace", "carotte", "œuf", "pain", "fromage", "bonbon", "fraise", "cerise", "citron",
         "frites", "café", "biscuit", "sandwich", "tomate", "lait", "chocolat"],
        ["hamburger", "spaghettis", "sushi", "croissant", "popcorn", "barbe à papa", "hot-dog", "ananas", "pastèque", "brocoli", "champignon",
         "crêpe", "soupe", "tacos", "beigne", "sucette", "poulet rôti", "omelette", "milk-shake", "brochette"],
        ["fondue", "pique-nique", "barbecue", "buffet", "recette", "boulangerie", "poutine", "lasagnes", "sirop d’érable", "fontaine de chocolat",
         "pièce montée", "épicerie", "plateau-repas", "brunch", "smoothie", "raclette", "soupe aux algues", "repas d’astronaute", "cuisinier", "indigestion"]
    ],
    actions: [
        ["dormir", "courir", "nager", "danser", "manger", "lire", "pleurer", "rire", "chanter", "sauter", "voler", "pêcher", "marcher",
         "dessiner", "boire", "jongler", "skier", "applaudir", "crier", "pousser"],
        ["faire du vélo", "se brosser les dents", "faire la cuisine", "jouer au foot", "prendre une photo", "faire du surf", "escalader",
         "éternuer", "bâiller", "se maquiller", "planter un arbre", "faire du ski", "jouer de la guitare", "faire la vaisselle", "se cacher",
         "tomber", "rêver", "faire un câlin", "patiner", "plonger"],
        ["faire la grasse matinée", "rater son bus", "avoir le hoquet", "faire un vœu", "chercher ses clés", "se perdre", "réparer un moteur",
         "faire une sieste", "faire du yoga", "gagner une course", "marcher sur la Lune", "flotter en apesanteur", "décoller", "faire un tour de magie",
         "construire un robot", "avoir peur", "faire un selfie", "attraper un rhume", "tricher", "s’endormir au cinéma"]
    ]
};
window.DV_THEMES = { mixte: '🎲 Mixte', espace: '🚀 Espace', quotidien: '🏠 Vie quotidienne', animaux: '🐙 Animaux et nature', nourriture: '🍕 Nourriture', actions: '🏃 Actions' };
