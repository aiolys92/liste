// ============================================
// DOFUS BUG TRACKER - DONNÉES PARTAGÉES
// ============================================

const BugData = {
  // Données des bugs (stockage en mémoire)
  bugs: [
    {
      id: "DFS-10842",
      type: "Bug",
      category: "Gameplay",
      priority: "Critique",
      title: "Téléportation aléatoire en combat",
      description: "Le personnage se téléporte aléatoirement sur une case adjacente lors de l'utilisation de certains sorts de déplacement en combat JCJ, faussant le positionnement tactique.",
      state: "En cours",
      date: "2025-03-10"
    },
    {
      id: "DFS-10841",
      type: "Bug",
      category: "Interface",
      priority: "Haute",
      title: "Fenêtre d'inventaire qui se ferme toute seule",
      description: "La fenêtre d'inventaire se ferme automatiquement lors du clic sur un item équipé si l'interface de comparaison est ouverte en simultané.",
      state: "Nouveau",
      date: "2025-03-09"
    },
    {
      id: "DFS-10840",
      type: "Régression",
      category: "Combat",
      priority: "Critique",
      title: "Calcul des dommages Feu incorrect après 1.90",
      description: "Suite à la mise à jour 1.90.0, les dommages de type Feu sont calculés avec un coefficient erroné (+15%) pour les classes Enutrof et Xélor uniquement.",
      state: "En cours",
      date: "2025-03-09"
    },
    {
      id: "DFS-10839",
      type: "Bug",
      category: "Quête",
      priority: "Haute",
      title: "Quête 'Le Trident d'Ogrest' bloquée",
      description: "Impossible de valider l'étape 3 de la quête 'Le Trident d'Ogrest' : le PNJ Djakissi ne propose pas le dialogue attendu malgré les conditions remplies.",
      state: "Résolu",
      date: "2025-03-08"
    },
    {
      id: "DFS-10838",
      type: "Bug",
      category: "Graphismes",
      priority: "Basse",
      title: "Artefact visuel sur la map Frigost zone 2",
      description: "Des lignes noires horizontales apparaissent de manière sporadique dans la zone Frigost niveau 2 (coordonnées -78, -56), uniquement avec les paramètres graphiques en Qualité Élevée.",
      state: "En attente",
      date: "2025-03-07"
    },
    {
      id: "DFS-10837",
      type: "Bug",
      category: "Serveur",
      priority: "Critique",
      title: "Déconnexion massive serveur Draconiros",
      description: "Vague de déconnexions forcées sur le serveur Draconiros entre 20h et 22h depuis 3 jours consécutifs. Les joueurs sont redirigés vers l'écran de connexion sans message d'erreur.",
      state: "Résolu",
      date: "2025-03-07"
    },
    {
      id: "DFS-10836",
      type: "Amélioration",
      category: "Interface",
      priority: "Basse",
      title: "Ajouter un filtre par serveur dans le chat",
      description: "Proposition d'ajout d'un filtre permettant de masquer les messages de certains canaux globaux depuis l'interface de chat, pour améliorer la lisibilité.",
      state: "En attente",
      date: "2025-03-06"
    },
    {
      id: "DFS-10835",
      type: "Bug",
      category: "Audio",
      priority: "Moyenne",
      title: "Son de combat en boucle après la victoire",
      description: "La musique de combat continue de jouer en boucle après la fin d'un combat (victoire ou fuite), jusqu'au prochain changement de zone ou rechargement complet du client.",
      state: "Fermé",
      date: "2025-03-05"
    },
    {
      id: "DFS-10834",
      type: "Bug",
      category: "Gameplay",
      priority: "Haute",
      title: "Sort Iop 'Epée Divine' ne consomme pas le PA",
      description: "Le sort 'Épée Divine' du Iop peut être lancé sans consommer de Points d'Action dans certaines conditions spécifiques (état 'Enflammé' + buff 'Poigne Virile' actif simultanément).",
      state: "En cours",
      date: "2025-03-05"
    },
    {
      id: "DFS-10833",
      type: "Bug",
      category: "Texte",
      priority: "Mineure",
      title: "Description incorrecte du Donjon Maison d'Alama",
      description: "La description de la quête 'Donjon Maison d'Alama' mentionne un niveau requis de 120 alors que le niveau réel est 130. Erreur de contenu uniquement.",
      state: "Fermé",
      date: "2025-03-04"
    },
    {
      id: "DFS-10832",
      type: "Régression",
      category: "Interface",
      priority: "Haute",
      title: "Barre de sort disparaît en éditeur de profil",
      description: "Depuis la dernière mise à jour, la barre de raccourcis de sorts disparaît lorsqu'on ouvre la fenêtre d'édition du profil de personnage et ne réapparaît pas à la fermeture.",
      state: "Résolu",
      date: "2025-03-03"
    },
    {
      id: "DFS-10831",
      type: "Bug",
      category: "Gameplay",
      priority: "Moyenne",
      title: "Récolte impossible sur certaines cases en zone Sauvage",
      description: "Certaines cases de récolte (blé, lin, chanvre) dans la zone Plaines des Porkass sont marquées comme disponibles mais ne déclenchent aucune action lors du clic.",
      state: "Nouveau",
      date: "2025-03-03"
    },
    {
      id: "DFS-10830",
      type: "Bug",
      category: "Combat",
      priority: "Critique",
      title: "Invocations persistent entre les combats",
      description: "Les invocations (familiers de combat) ne sont pas supprimées correctement à la fin du combat dans les zones de donjon, ce qui crée des entités fantômes bloquant les cases.",
      state: "En cours",
      date: "2025-03-02"
    },
    {
      id: "DFS-10829",
      type: "Bug",
      category: "Graphismes",
      priority: "Basse",
      title: "Ombre du personnage désynchronisée lors de l'animation d'attaque",
      description: "L'ombre du sprite du personnage reste à la position d'origine pendant l'animation d'attaque à distance, créant une incohérence visuelle légère mais perceptible.",
      state: "Rejeté",
      date: "2025-03-01"
    },
    {
      id: "DFS-10828",
      type: "Amélioration",
      category: "Interface",
      priority: "Moyenne",
      title: "Historique de chat sauvegardé entre les sessions",
      description: "Demande de fonctionnalité : conserver un historique des 100 derniers messages de chat entre les sessions de jeu, accessible après reconnexion.",
      state: "En attente",
      date: "2025-02-28"
    }
  ],

  // Enums
  types: ["Bug", "Amélioration", "Régression"],
  categories: ["Gameplay", "Interface", "Graphismes", "Audio", "Serveur", "Texte", "Combat", "Quête"],
  priorities: ["Critique", "Haute", "Moyenne", "Basse", "Mineure"],
  states: ["Nouveau", "En cours", "Résolu", "Fermé", "Rejeté", "En attente"],

  // Slugifier pour les classes CSS
  toSlug(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  },

  // Formater une date
  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  // Générer un ID unique
  generateId() {
    const max = Math.max(...this.bugs.map(b => parseInt(b.id.replace('DFS-', ''))));
    return `DFS-${max + 1}`;
  },

  // Créer le HTML d'un badge
  renderBadge(type, value) {
    const slug = this.toSlug(value);
    const icons = {
      type: { Bug: '⚠', Amélioration: '✦', Régression: '↩' },
      priority: { Critique: '🔴', Haute: '🟠', Moyenne: '🟡', Basse: '🔵', Mineure: '🟣' },
      state: {},
      category: {}
    };
    return `<span class="badge badge-${type}-${slug}">${value}</span>`;
  }
};
