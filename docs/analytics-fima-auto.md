# Analytique de FIMA AUTO — principes tirés de Shopify Analytics

Document de recherche et de proposition. Rédigé le 2 novembre 2026.

Objectif : comprendre comment Shopify construit son module Analytics (tableau de bord, vue en direct, bibliothèque de rapports) pour en tirer des principes réutilisables, puis proposer une version adaptée à FIMA AUTO. On ne copie pas Shopify : on garde ce qui sert une agence de location et de transferts au Bénin.

---

## 1. En bref

**Ce qu'on retient de Shopify (en 6 idées)**

1. **Une mesure = une définition, écrite une seule fois.** Chaque chiffre (« ventes nettes », « commandes ») a une formule et un schéma d'origine. Tout l'écran (carte, rapport, graphique) lit la même définition.
2. **Un rapport est une question enregistrée, pas du code.** « Cette mesure, découpée par cette dimension, sur cette période, comparée à cette autre période. » Changer de rapport, c'est changer ces paramètres.
3. **Des tables plates, au grain le plus fin, sans jointure à écrire.** Les mesures sont « additives » autant que possible, pour qu'on puisse regrouper comme dans un tableur sans double compte.
4. **Le tableau de bord est un ensemble de cartes qui mènent chacune à un rapport** (clic = exploration plus détaillée).
5. **Le « direct » est borné et expliqué** : fenêtres de temps annoncées (5 min, 10 min, « depuis minuit »), délais assumés. Techniquement, Shopify a fait évoluer ce direct par étapes (batch d'abord, flux ensuite, poussée serveur ensuite).
6. **La cohérence est une exigence de produit** : un chiffre doit être le même partout, ou la différence doit être expliquée.

**Ce que FIMA AUTO a aujourd'hui** : trois endroits calculent le « revenu » séparément (tableau de bord, Rapports, résultat net), tous dans le navigateur, à partir de tables entières, sans vue en direct. C'est exactement le problème que le principe n°1 résout.

**Ma proposition** (détaillée en section 5) : un catalogue de mesures dans la base, une fonction qui répond à « mesure × dimension × période », une bibliothèque d'une douzaine de rapports décrits par des données, des cartes de tableau de bord configurables, et une vue en direct de l'activité interne alimentée par Supabase Realtime. Trois étapes, de la plus utile à la plus ambitieuse.

---

## 2. Méthode et niveau de confiance

Sources lues en entier : aide Shopify (rapports, Live View, rapport de ventes), documentation développeur ShopifyQL (syntaxe, schéma `sales`), et quatre articles du blog d'ingénierie de Shopify. Les liens sont en section 9.

Chaque affirmation de ce document porte l'un de ces repères :

- **[Source]** : écrit dans la page citée.
- **[Déduction]** : ma lecture, non écrite telle quelle.
- **[Hypothèse]** : à vérifier avant de s'y fier.

**Limites à connaître**

- Shopify ne publie pas l'architecture interne de la **Vue en direct**. L'article sur l'analytique « en contexte » (2021) décrit une architecture batch + flux pour les pages Commandes, **pas** pour la Vue en direct. Les articles sur la « carte en direct » du Black Friday (2021, 2022) décrivent un autre produit, avec une poussée serveur. Ce que je dis du « direct » vient de ces trois sources, rapprochées avec prudence.
- Les articles sur le modèle de données datent de 2022 et 2023. La documentation actuelle (version d'API 2026-10) a évolué : par exemple la clause `HAVING` existe maintenant, et plusieurs mesures de « retours » sont remplacées par des mesures d'« annulations de ventes ».
- Sur les pages d'aide, je n'ai **pas** trouvé la sauvegarde, la planification ni le partage de rapports. Je ne peux donc pas dire que Shopify les propose.
- Les pages de détail de chaque clause du langage ShopifyQL, et celle des rapports personnalisés, n'ont pas été lues.

---

## 3. Les principes, fiche par fiche

### Fiche 1 — Le tableau de bord est un ensemble de cartes qui mènent à des rapports

- **[Source]** Le tableau de bord est personnalisable et regroupe des cartes appelées « metrics » ; chacune donne une valeur rapide (exemples : ventes nettes par canal, sessions par type d'appareil). Un clic mène au rapport correspondant. Une exploration personnalisée crée aussi une carte dans la bibliothèque du tableau de bord.
- **[Source]** Les variations en pourcentage sont calculées « à armes égales » : « aujourd'hui » est comparé à « hier » *au même instant de la journée*.
- **[Déduction]** Une carte et un rapport partagent la même définition ; la carte est le rapport en miniature.
- **Pour FIMA AUTO :** les cartes sont des couples (mesure, période, comparaison) ; elles mènent à un rapport détaillé.

### Fiche 2 — Des tables plates au grain le plus fin, des mesures additives

- **[Source]** Les modèles sont des tables plates, agrégées au grain le plus bas du domaine et à un attribut temporel, sans jointure, expression de table commune ni fonction de fenêtrage à écrire. Un modèle regroupe toutes les mesures d'un domaine. Les modèles se recoupent volontairement, ce qui permet de recouper un chiffre.
- **[Source]** Le **grain** (« que représente une ligne ? ») est la décision centrale. Le schéma `sales` enregistre un événement par ligne : une commande peut produire plusieurs lignes quand des remboursements suivent.
- **[Source]** Trois sortes de mesures :
  - *additive* : on peut la sommer sur toute dimension (ex. ventes brutes) ;
  - *semi-additive* : sommable sur certaines dimensions seulement (ex. « clients ayant commandé » : sommer par jour compte deux fois un client) ;
  - *non additive* : jamais sommable (ex. un pourcentage de remise).
- **[Source]** Des cumuls pré-calculés (par exemple les ventes quotidiennes par produit) accélèrent les requêtes ; la construction est incrémentale.
- **[Source]** Les auteurs partent d'une liste de questions métier, vérifient le grain avec des données fictives, et contrôlent qualité, cohérence entre écrans, fraîcheur et performance.
- **Pour FIMA AUTO :** définir le grain de chaque domaine (une ligne par location, par encaissement, par transfert, par dépense) et classer chaque mesure (additive, semi-additive, ratio). C'est ce qui évitera un « panier moyen » faux ou un client compté deux fois.

### Fiche 3 — Un rapport est une requête déclarative

- **[Source]** Une requête commence par `FROM` (le jeu de données), puis `SHOW` (mesures et dimensions), et accepte `WHERE`, `GROUP BY`, `TIMESERIES`, `WITH` (totaux, variation en %), `HAVING`, `SINCE/UNTIL/DURING` (période), `COMPARE TO` (comparaison), `ORDER BY`, `LIMIT`, `VISUALIZE` (graphique). Seul `FROM` est obligatoire ; l'ordre des autres clauses est libre.
- **[Source]** Les périodes ont des noms (`last_month`, `last_quarter`) et des décalages (`-30d`). La comparaison à la période précédente est native.
- **[Source]** Les auteurs ont voulu que l'utilisateur non technique n'écrive pas de SQL.
- **[Source]** Les rapports par défaut sont paramétrables : ajout ou retrait de colonnes (mesures, dimensions), filtres, plage de dates, dimension de regroupement (heure, jour, semaine, mois, trimestre, année, jour de la semaine…), comparaison de périodes, export CSV. Un rapport peut être repris comme nouvelle exploration.
- **[Non trouvé]** La syntaxe pour définir sa propre mesure n'est pas dans les pages lues.
- **Pour FIMA AUTO :** pas de langage de requête. Un rapport est un petit objet de données (section 5.4) interprété par une fonction de la base.

### Fiche 4 — Le « direct » est borné, expliqué, et monté par étapes

- **[Source, aide]** La Vue en direct montre une carte et un globe avec les visiteurs récents et les commandes, et des cartes de chiffres avec des fenêtres annoncées : « visiteurs maintenant » = actifs dans les 5 dernières minutes ; « comportement des clients » = sessions des 10 dernières minutes (panier actif, paiement en cours, achat) ; « ventes totales », « sessions », « commandes » = depuis minuit, heure locale.
- **[Source, aide]** Limites assumées : les chiffres peuvent différer d'autres outils (méthodes de comptage, filtrage des robots) ; un message de délai peut apparaître et se résorbe « en général en 1 à 2 heures ». Un mode « diffusion » masque les chiffres pour partager l'écran.
- **[Source, ingénierie 2021]** Pour l'analytique en contexte, l'équipe a commencé par un pipeline **batch**, puis ajouté un flux ; l'historique vient du batch, le flux ne sert que les données les plus récentes pas encore dans le batch (architecture « lambda »). Raison donnée : limiter la pression sur l'infrastructure de flux. Leçon : prototyper le modèle en batch avant de passer en flux.
- **[Source, ingénierie 2022]** Pour la carte en direct du Black Friday, Shopify a comparé interrogation régulière, WebSocket et poussée serveur. Il a retenu les **Server-Sent Events** (poussée du serveur vers le navigateur) : unidirectionnel, simple, basé sur HTTP, reconnexion automatique, et suppression de l'étape d'interrogation. L'interrogation régulière, plus simple, « passe mal à l'échelle » et gaspille des ressources quand rien ne change. Chiffres donnés : livraison au client en quelques millisecondes une fois la donnée disponible, environ 21 secondes de bout en bout. Conclusion de l'article : choisir l'outil le mieux adapté, rester simple.
- **[Hypothèse]** La Vue en direct de l'admin utilise un mécanisme comparable ; je n'en ai pas la preuve.
- **Pour FIMA AUTO :** les volumes sont minuscules (des dizaines d'événements par jour, pas des milliards). Le principe à garder est la **poussée simple** et les **fenêtres de temps annoncées**, pas la machinerie.

### Fiche 5 — La fraîcheur est déclarée

- **[Source]** À l'ouverture d'un rapport de ventes, les données sont à jour « à environ une minute près » ; on peut rouvrir ou actualiser.
- **Pour FIMA AUTO :** afficher « mis à jour à HH:MM » sur chaque rapport et chaque carte, avec un bouton d'actualisation.

### Fiche 6 — Les définitions, les exclusions et les permissions sont explicites

- **[Source]** Les rapports de ventes incluent les commandes ouvertes, archivées, en attente et annulées ; ils excluent les commandes supprimées et de test ; les rétrofacturations n'y figurent pas ; ils mesurent la valeur des ventes, pas les paiements.
- **[Source]** La définition de « ventes totales » de la Vue en direct diffère de celle des rapports de ventes (cette dernière inclut en plus droits et frais) : c'est un piège de cohérence que Shopify documente.
- **[Source]** Les mesures et leur vocabulaire évoluent : plusieurs mesures de « retours » sont marquées dépréciées et remplacées par des « annulations de ventes ». Une définition change donc avec une version.
- **[Source]** L'accès aux rapports et tableaux de bord demande une permission « Analytics ».
- **Pour FIMA AUTO :** une page « Définitions » qui liste chaque mesure, sa formule et ce qu'elle exclut ; une permission dédiée.

---

## 4. État des lieux de FIMA AUTO

Constat sur le code actuel :

| Sujet | Aujourd'hui | Conséquence |
|---|---|---|
| Revenu | Calculé dans `dashboard.ts` (encaissements), dans `reports.ts` (encaissements + transferts terminés), et dans le résultat net (déduction de la part partenaires, de la maintenance, du marketing) | Trois définitions voisines ; risque de chiffres qui divergent |
| Où on calcule | Dans le navigateur, après avoir téléchargé les tables entières (paiements, locations…) | Lent et coûteux quand les données grossiront |
| Direct | Aucun flux. Des alertes calculées au chargement de la page Notifications, des notifications push, un suivi de transfert rafraîchi toutes les 30 s | Pas de « vue en direct » de l'activité |
| Rapports | Un seul écran (synthèse sur période) + export CSV | Pas de bibliothèque ni de rapports paramétrables |
| Tableau de bord | Cartes fixes, non configurables | — |
| Permissions | Module `reports` ; module `marketing` pour les dépenses | Pas de permission pour les définitions ni pour des rapports enregistrés |
| Fuseau horaire | Africa/Porto-Novo, géré dans le tableau de bord | À conserver partout |

Atouts à garder : la base Postgres avec RLS (les chiffres respectent déjà les droits), le fuseau horaire, la traçabilité (journal d'activité), les notifications push, et les nouveaux domaines de données (transferts, marketing, partenaires).

---

## 5. Proposition d'architecture

### 5.1 Catalogue de mesures

Un tableau (en base) où chaque mesure a : un identifiant, un libellé, une définition en français, la source, le grain, l'additivité, ce qui est exclu. Première liste proposée :

| Mesure | Définition | Additivité |
|---|---|---|
| Revenus de location encaissés | Somme des paiements enregistrés sur la période | additive |
| Revenus des transferts | Prix confirmé des transferts terminés (à défaut le prix annoncé) | additive |
| Revenu total | Location + transferts | additive |
| Part des partenaires | Jours loués × prix demandé par le partenaire, locations commencées sur la période, hors annulées | additive |
| Coûts de maintenance | Somme des coûts de maintenance de la période | additive |
| Dépenses marketing | Somme des dépenses ; dont « en nature » (véhicules prêtés) valorisées au prix de location | additive |
| **Résultat net** | Revenu total − part des partenaires − maintenance − marketing | additive (différence de mesures additives) |
| Locations | Nombre de locations commencées, hors annulées | additive |
| Jours loués | Somme des jours facturables | additive |
| Taux d'occupation | Jours loués / (véhicules disponibles × jours de la période) | **non additive** (rapport) |
| Revenu moyen par location | Revenu de location / locations | **non additive** |
| Clients actifs | Clients distincts ayant loué sur la période | **semi-additive** |
| Nouveaux clients | Clients dont la première location tombe dans la période | additive |
| Transferts demandés / terminés / annulés | Comptages par statut | additives |
| Taux de confirmation des transferts | Confirmés / demandés | non additive |
| Délai moyen de confirmation | Temps entre la demande et la confirmation | non additive |
| Coût d'acquisition (étape 3) | Dépenses d'un canal / nouveaux clients de ce canal | non additive |

Règle : **une mesure non additive est toujours recalculée à partir de ses composants additifs**, jamais sommée. C'est ce que montre Shopify avec son pourcentage de remise.

### 5.2 Dimensions

Temps (jour, semaine, mois, trimestre, année, jour de la semaine), véhicule, catégorie, propriétaire (agence / partenaire) et partenaire, client, mode de location (avec ou sans chauffeur), trajet de transfert, chauffeur, statut, canal de dépense marketing, campagne, et plus tard canal d'acquisition du client.

### 5.3 Couche de données

- Des **vues plates** (une par domaine, au grain le plus fin) : locations (une ligne par location), encaissements (une ligne par paiement), transferts (une ligne par demande), dépenses marketing, maintenance. Chaque vue respecte la RLS (`security_invoker`) : un compte ne voit que ses lignes.
- Une **fonction de base** qui répond à « ces mesures, par cette dimension, sur cette période, avec cette comparaison, ces filtres » en agrégeant **dans la base** et non plus dans le navigateur. Le fuseau Africa/Porto-Novo est appliqué une seule fois, ici.
- Les mesures du catalogue sont les seules entrées autorisées : pas de calcul libre côté navigateur.
- **Pas d'entrepôt de données séparé** : à cette échelle, Postgres avec des index suffit. Si les volumes grossissent, on ajoutera des cumuls pré-calculés (par jour et par véhicule), comme le fait Shopify.

### 5.4 Un rapport décrit par des données

Un rapport est un petit objet, par exemple :

```json
{
  "id": "revenu-par-vehicule",
  "title": "Revenu par véhicule",
  "metrics": ["revenu_location", "locations", "jours_loues"],
  "groupBy": ["vehicule"],
  "period": "ce_mois",
  "compare": "periode_precedente",
  "filters": { "proprietaire": "tous" },
  "chart": "barres_horizontales",
  "top": 10
}
```

- Les rapports livrés d'office forment la **bibliothèque** (une douzaine de départ, section 6).
- L'utilisateur peut changer les filtres, la période, les colonnes, la comparaison, puis **exporter en CSV**.
- Plus tard : **enregistrer** son rapport (une ligne en base par rapport, avec son propriétaire et un partage en lecture), et le **proposer comme carte du tableau de bord**.

### 5.5 Tableau de bord configurable

Une carte = une mesure + une période + une comparaison (ex. « Revenu du mois, comparé au mois précédent à la même date »). Chaque carte mène au rapport correspondant. La comparaison « à armes égales » de Shopify s'applique : on compare le 1ᵉʳ au 12 du mois au 1ᵉʳ au 12 du mois précédent, pas à un mois entier. Chaque utilisateur choisit et ordonne ses cartes (enregistré par utilisateur).

### 5.6 Vue en direct (activité interne)

Trois niveaux, du plus simple au plus ambitieux :

1. **Calcul au chargement** : ce qu'on fait aujourd'hui.
2. **Rafraîchissement automatique** toutes les 30 secondes (déjà utilisé sur le suivi de transfert).
3. **Poussée par Supabase Realtime** : la base signale chaque nouvelle réservation, demande de transfert ou changement de statut, et l'écran se met à jour sans rechargement. C'est l'équivalent, à petite échelle, de la leçon des événements poussés par le serveur.

**Recommandation :** niveau 3 pour l'écran « En ce moment », niveau 1 ou 2 pour tout le reste. Cartes avec fenêtres annoncées, comme Shopify :

- véhicules actuellement en location (depuis le départ jusqu'au retour) ;
- retours attendus dans les 24 prochaines heures, et locations en retard ;
- transferts du jour par statut (nouvelle, confirmée, chauffeur en route, arrivé) ;
- nouvelles demandes de la dernière heure ;
- revenus du jour (depuis minuit, heure de Porto-Novo).

**Pas d'architecture lambda** (batch + flux) : elle sert à protéger un flux sous de très gros volumes. Ici, des requêtes sur tables indexées suffisent.

**Hors périmètre pour l'instant :** les visiteurs du site en temps réel (carte, globe, paniers). Cela demande un système de mesure d'audience, un choix sur les cookies et le consentement, et la gestion des robots. À réétudier plus tard.

### 5.7 Gouvernance

- Une page **« Définitions »** : formule, source, exclusions de chaque mesure.
- La **fraîcheur** affichée sur chaque carte et rapport.
- Les **exclusions** écrites : locations annulées, demandes de transfert annulées, paiements sans location, données de test.
- Une **permission dédiée** (voir, créer et enregistrer des rapports) en plus des droits existants.
- Un **numéro de version des définitions** : quand une formule change, on le note, pour comprendre pourquoi un ancien export diffère.

---

## 6. Bibliothèque de rapports proposée (départ)

1. Résultat net de la période (la cascade actuelle, devenue un rapport).
2. Revenu par mois (série temporelle, avec comparaison à l'an passé).
3. Revenu par véhicule.
4. Revenu par catégorie et par propriétaire (agence ou partenaire).
5. Locations par jour de la semaine et par mois.
6. Taux d'occupation par véhicule.
7. Part des partenaires par partenaire.
8. Clients : nouveaux et récurrents.
9. Transferts : demandes, confirmations, annulations par trajet et par chauffeur.
10. Avec chauffeur ou sans chauffeur : revenu et nombre de locations.
11. Dépenses marketing par canal et par campagne.
12. Coûts de maintenance par véhicule.

---

## 7. Ce qu'on ne copie pas

| Chez Shopify | Pourquoi pas ici |
|---|---|
| Langage de requête ShopifyQL | FIMA AUTO n'a pas d'utilisateurs qui écrivent des requêtes ; les rapports sont des objets paramétrés |
| Entrepôt de données séparé, flux Kafka/Flink, architecture lambda | Échelle sans commune mesure ; Postgres + index suffit |
| Carte et globe des visiteurs | Pas de boutique en ligne à fort trafic ; coût et vie privée |
| Filtre des robots, sessions | Sans objet tant qu'on ne mesure pas l'audience |
| Dizaines de dimensions (SKU, devises, POS…) | Sans objet pour la location |

---

## 8. Plan par étapes

**Étape 1 — Fondation (le plus utile)**
- Catalogue de mesures et page « Définitions ».
- Vues plates et fonction d'agrégation dans la base, avec le fuseau de Porto-Novo.
- Les 12 rapports de la bibliothèque, filtres et export CSV.
- Le tableau de bord actuel et les Rapports lisent la même source : fin des définitions dupliquées.
- Effort : moyen. Une migration. Risque principal : faire concorder les chiffres actuels avec les nouveaux (on compare avant de basculer).

**Étape 2 — Direct et personnalisation**
- Écran « En ce moment » alimenté par Supabase Realtime.
- Tableau de bord à cartes configurables et comparaison « à armes égales ».
- Rapports enregistrés et partagés en lecture.
- Effort : moyen à important. Une à deux migrations.

**Étape 3 — Acquisition et prévision**
- Question facultative « Comment nous avez-vous connus ? » à l'inscription et à la demande de transfert, puis coût d'acquisition et rentabilité par canal.
- Éventuellement : prévisions simples d'occupation, alertes sur seuils (ex. taux d'occupation bas).
- À faire quand quelques semaines de dépenses marketing et de clients seront saisies.

---

## 9. Décisions à prendre

1. **Vue en direct :** activité interne seulement (recommandé), ou aussi les visiteurs du site plus tard ?
2. **Définition du revenu :** on garde les encaissements enregistrés comme revenu de location (comme aujourd'hui), et le prix des transferts terminés pour les transferts ?
3. **Coûts d'incidents :** les inclure dans le résultat net, ou les exclure (selon que le client rembourse) ?
4. **Droits :** qui voit le résultat net et les marges ? Un module « Analytics » séparé de « Rapports » ?
5. **Basculement :** on remplace les écrans actuels à l'étape 1, ou on les garde en parallèle quelques semaines pour comparer ?

---

## 10. Sources

Aide Shopify
- Vue en direct : <https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/live-view>
- Rapports et analytique : <https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports>
- Rapport de ventes : <https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report>
- Écarts de données de l'ancien Analytics (comparaisons « à armes égales ») : <https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/new-analytics/analytics-updates>

Documentation développeur (version d'API 2026-10)
- Syntaxe ShopifyQL : <https://shopify.dev/docs/api/shopifyql/latest/syntax>
- Schéma `sales` : <https://shopify.dev/docs/api/shopifyql/latest/schemas/sales_revenue/sales>

Blog d'ingénierie de Shopify
- « How Shopify Built An In-Context Analytics Experience » (25 mai 2021) : <https://shopify.engineering/shopify-in-context-analytics>
- « Using Server Sent Events to Simplify Real-time Streaming at Scale » (30 novembre 2022) : <https://shopify.engineering/server-sent-events-data-streaming>
- « Introducing ShopifyQL: Our New Commerce Data Querying Language » (22 juin 2022) : <https://shopify.engineering/shopify-commerce-data-querying-language-shopifyql>
- « ShopifyQL Notebooks: Simplifying Querying with Commerce Data Models » (14 février 2023) : <https://shopify.engineering/building-commerce-data-models-with-shopifyql>
- À lire plus tard (repérés, non lus en entier) : « Scaling Shopify's BFCM Live Map: An Apache Flink Redesign » et « Capturing Every Change From Shopify's Sharded Monolith » sur le même blog.

Code de FIMA AUTO consulté : `web/src/lib/data/dashboard.ts`, `reports.ts`, `notifications.ts` (alertes en direct), `components/staff/dashboard-charts.tsx`.
