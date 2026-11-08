# RÈGLES MÉTIER

## 1. Comptes

Il existe uniquement deux types de comptes en V1 :

* Super Admin
* Utilisateur / Responsable

Il n'existe aucun compte client en V1.

Les clients sont créés et gérés par le personnel interne.

---

## 2. Permissions

Le Super Admin possède tous les droits.

Les permissions des Utilisateurs / Responsables sont configurables par le Super Admin.

Le système ne doit pas créer d'autres rôles métier sans demande explicite.

---

## 3. Clients

Un client peut posséder plusieurs locations.

Un client peut avoir plusieurs documents.

Les informations du client doivent être conservées dans son historique.

---

### Lecture automatique des pièces

Quand une photo de pièce d'identité, de permis ou d'**autre pièce** (passeport, deuxième pièce…) est ajoutée, partout où l'on peut en ajouter (assistant de location de l'équipe, fiche client de l'équipe, assistant du partenaire, dossier du client), elle est lue automatiquement pour proposer le prénom, le nom, le numéro de pièce, le numéro de permis et sa date d'expiration.

* La lecture ne fait que **proposer** : seuls les champs encore **vides** sont remplis. Un champ déjà saisi n'est jamais écrasé, même s'il a été modifié à la main avant ou pendant la lecture ; tout reste modifiable et effaçable.
* Si tous les champs concernés sont **déjà remplis** avant l'ajout de la pièce, il n'y a aucune lecture : la pièce est simplement conservée.
* La lecture se fait dans le navigateur ; l'image n'est envoyée à aucun service. Un échec, un PDF ou une pièce illisible ne bloque jamais : on saisit à la main.
* L'agent ou le client vérifie toujours les informations avant d'enregistrer.

## 4. Véhicules

Un véhicule ne peut pas être réservé pour deux locations qui se chevauchent.

Un véhicule doit être considéré comme indisponible pendant une période de location active.

Un véhicule en maintenance ne doit pas pouvoir être affecté à une nouvelle location.

Un véhicule marqué comme indisponible ne doit pas pouvoir être affecté à une nouvelle location.

### Tarifs selon la durée

Un véhicule a un prix de base par jour et, en option, des paliers « à partir de N jours (ou N mois), X FCFA par jour ». Chaque seuil se règle librement, en jours ou en mois, et l'équipe comme le partenaire peut ajouter ou retirer des paliers sans intervention technique.

* Un mois compte 30 jours ; toute journée commencée est comptée. Seuil minimum : 2 jours.
* Le palier le plus élevé atteint s'applique à tous les jours de la location (palier « 10 jours » et palier « 1 mois » : 45 jours donnent le palier « 1 mois »). Sans palier atteint, le prix de base s'applique.
* Le total d'une location = jours × prix par jour applicable (+ supplément chauffeur par jour s'il y en a un). Le total est proposé à la création de la location et reste modifiable par l'équipe.
* Une location créée garde son total enregistré : modifier les paliers ensuite ne change jamais une location ou un contrat existant.
* Véhicule de partenaire : le partenaire saisit ses propres paliers (prix qu'il souhaite toucher par jour) tant que le véhicule n'est pas validé ; ensuite seule l'équipe les modifie. La part du partenaire suit ses paliers (jours × son prix pour la durée). L'équipe fixe les paliers de prix client et vérifie la marge minimale à chaque seuil.
* Calcul unique : fonctions `vehicle_client_daily_price` et `vehicle_partner_daily_price` (base de données) et `web/src/lib/pricing.ts`.

### Rentabilité du parc

Chaque véhicule de l'agence peut avoir un prix d'achat (et une date d'achat facultative), saisi par une personne ayant la permission « Rentabilité du parc ». Les véhicules de partenaires n'ont pas de prix d'achat.

* Un véhicule est rentabilisé quand ses encaissements de location, moins ses coûts de maintenance, atteignent son prix d'achat.
* Seuls comptent les encaissements et les coûts postérieurs à la date d'achat ; sans date, tout l'historique est compté.
* Les coûts d'incidents (remboursables par le client) et les transferts ne sont pas comptés.
* La date de rentabilisation estimée suit le résultat moyen des 90 derniers jours ; sans activité récente, elle n'est pas estimable.

---

## 5. Locations

Une location doit obligatoirement être liée à :

* un client ;
* un véhicule ;
* une date de départ ;
* une date de retour ;
* un prix.

Le système doit vérifier la disponibilité du véhicule avant la création ou modification d'une location.

### Clôture forcée par un responsable

Une location se termine normalement toute seule (inspection de retour faite, paiement complet, caution restituée ou retenue, aucun incident ouvert). Un responsable peut exceptionnellement la **terminer à la main**, par exemple quand un point bloquant ne pourra jamais être réglé.

* **Qui** : un compte qui a la permission « Valider » sur le module Locations (le Super Admin l'a toujours). La vérification est faite côté serveur.
* **Quand** : seulement pour une location « en cours » ou « en retard ». Une location en attente, annulée ou déjà terminée ne peut pas être clôturée de force.
* **Motif obligatoire** : le responsable écrit pourquoi (3 caractères au minimum). Le motif, la date et l'auteur sont conservés dans l'historique des statuts, marqués « clôture forcée », et visibles dans la fiche location.
* **Effets** : la location passe à « Terminée » et le véhicule est remis disponible, comme pour une clôture normale. Les points non réglés (solde, caution, incidents) ne sont **pas** effacés : le paiement, la caution et les incidents gardent leur état et restent à traiter dans leurs écrans.
* La clôture forcée est définitive : une location terminée ne revient pas en arrière.

---

## 6. Paiements

Les paiements sont enregistrés manuellement.

Aucun paiement en ligne n'est nécessaire en V1.

Le système ne doit pas intégrer Stripe ou un autre système de paiement en ligne.

Le responsable reçoit directement le paiement du client.

L'application enregistre uniquement l'opération.

Le solde est calculé à partir :

`Montant total - Montant reçu`

Statuts :

* Non payé ;
* Partiellement payé ;
* Payé.

---

## 7. Caution

La caution est indépendante du prix de location.

Elle ne doit pas être automatiquement comptabilisée comme chiffre d'affaires.

Statuts :

* Non reçue ;
* Reçue ;
* Restituée ;
* Retenue.

Une caution peut être retenue notamment lorsqu'un dommage ou une autre situation justifie une retenue selon les règles de l'entreprise.

---

## 8. Contrats

Chaque contrat doit être associé à une location.

Le contrat doit utiliser une version précise du modèle de contrat.

Une fois signé, le contenu historique du contrat doit être conservé.

Modifier un modèle de contrat ne doit jamais modifier les anciens contrats signés.

---

## 9. Signature

La signature V1 est manuscrite et numérique.

Le signataire dessine directement sur l'écran.

Aucun OTP n'est utilisé.

Aucun SMS de confirmation n'est utilisé.

Aucun fournisseur externe de signature n'est utilisé en V1.

La signature validée doit être sauvegardée avec le contrat.

### Lien de signature pour le locataire

Un responsable peut envoyer au locataire un lien pour signer le contrat à distance, sans compte client, sans OTP ni SMS.

* Le lien n'est proposé qu'une fois le contrat en attente de signature **et déjà signé par le responsable**. Seul le locataire signe par lien.
* Le lien contient un code secret long et aléatoire ; la base n'en garde que l'empreinte. Il est valable 7 jours pour signer et ne sert qu'une fois pour signer.
* Générer un nouveau lien annule l'ancien. Le droit de le générer est la permission Valider du module Contrats.
* **Contrats d'un partenaire** : le partenaire peut générer le lien pour les contrats de **ses propres locations** (jamais pour ceux de l'agence ou d'un autre partenaire), sans permission particulière. Même parcours : il signe d'abord comme loueur, copie le lien, le locataire signe sur son téléphone, le contrat est finalisé et archivé, et le partenaire est prévenu. Le locataire voit le contrat avec les informations de l'entreprise du partenaire.
* Après la signature du locataire, le contrat est finalisé tout de suite : PDF généré dans le navigateur du locataire, archivé, contrat « Signé ». Le locataire peut télécharger son contrat sur le même lien pendant 30 jours.
* Si la finalisation échoue (connexion coupée), le contrat reste « en attente » avec les deux signatures et le responsable le finalise avec le bouton existant.
* La signature par lien enregistre la date, l'appareil et l'adresse IP. Ce n'est pas une preuve d'identité : celui qui détient le lien peut signer.

---

## 10. Contrat signé

Après signature, le système doit conserver :

* le contenu utilisé ;
* la version du modèle ;
* les signatures ;
* les dates de signature ;
* les informations du signataire ;
* le PDF final.

Le contrat signé ne doit pas pouvoir être silencieusement modifié.

---

## 11. Inspection

Une inspection de départ peut être associée au début de la location.

Une inspection de retour est réalisée lors de la restitution du véhicule.

Les données doivent permettre de comparer :

* kilométrage ;
* carburant ;
* dommages ;
* observations ;
* photos.

---

## 12. Maintenance

Un véhicule en maintenance ne peut pas être attribué à une nouvelle location.

Les informations de maintenance doivent être conservées dans l'historique du véhicule.

---

## 13. Documents

Les documents doivent être liés à leur objet métier.

Exemples :

Client → permis

Véhicule → assurance

Location → contrat

Maintenance → facture

Incident → justificatif

---

## 14. Audit

Les actions sensibles doivent être enregistrées.

Exemples :

* création ;
* modification ;
* désactivation ;
* changement de prix ;
* changement de statut ;
* création de contrat ;
* modification de modèle ;
* nouvelle version de contrat ;
* signature ;
* enregistrement d'un paiement ;
* restitution ou retenue d'une caution.

---

## 15. Sécurité

L'accès aux données doit être contrôlé côté serveur.

Supabase Auth doit être utilisé pour l'authentification.

PostgreSQL Row Level Security (RLS) doit être utilisé pour contrôler les accès aux données.

La clé `service_role` de Supabase ne doit jamais être exposée dans l'application Angular.

---

## 16. Historique

Les données importantes ne doivent pas être supprimées sans conserver une trace lorsque l'historique métier l'exige.

Les actions administratives importantes doivent apparaître dans le journal d'activité.

---

## 17. Partenaire autonome (en cours de conception, branche `partenaire-autonome`)

Un partenaire peut louer lui-même ses véhicules, avec son identité et son contrat. Rien de cette section n'est en production.

### Validation des véhicules (inchangée)

Tout véhicule ajouté par un partenaire reste soumis à la validation de l'équipe (Super Admin ou Responsable autorisé). Tant qu'il n'est pas validé, il n'apparaît ni sur le site public ni dans l'assistant de location, et le partenaire ne peut pas le louer. Cette règle s'applique aussi aux partenaires autonomes.

### Profil du partenaire

Page « Mon profil » dans l'espace partenaire : nom commercial, logo, téléphone, numéro WhatsApp, adresse. Le partenaire la renseigne lui-même. Le numéro WhatsApp sert à la redirection des réservations du site public (voir plus bas) ; s'il est absent, la redirection retombe sur le numéro de l'agence.

**Informations de l'entreprise du partenaire sur ses contrats** : comme l'agence (Paramètres), le partenaire renseigne dans « Mon profil » les informations de son entreprise : nom de l'entreprise, adresse, téléphone, e-mail, **RCCM** et **IFU** (le logo se règle dans « Mon contrat »). Elles sont imprimées en tête de chacun de ses contrats, comme loueur, à la place de celles de l'agence. Le téléphone imprimé est son téléphone d'entreprise (et non son numéro WhatsApp, qui sert aux réservations du site). Un champ vide n'est simplement pas imprimé (nom manquant : le nom du contact est utilisé). Un contrat déjà créé garde les informations qu'il avait à sa création ; seuls les nouveaux contrats utilisent les valeurs à jour. L'assistant de location prévient le partenaire tant que le nom, l'adresse ou le téléphone de l'entreprise manquent.

### Contrat personnalisé

* Sans contrat propre, les locations du partenaire utilisent le modèle de l'agence (par défaut).
* Le partenaire peut téléverser son contrat en PDF. Le système en extrait le contenu (clauses dans l'ordre, logo, couleurs), repère les champs variables (client, véhicule, dates, prix, caution…) et régénère le contrat avec la logique habituelle de la plateforme. Le partenaire contrôle l'aperçu et corrige les champs mal repérés.
* La section des pièces d'identité du client garde toujours le format de la plateforme.
* Avant activation, l'équipe relit et valide le contrat du partenaire. Une fois validé, toutes les locations créées depuis son espace utilisent ce contrat.
* Versionnement obligatoire : chaque modification crée une version. Un contrat signé garde son texte, son logo et ses coordonnées figés ; une modification ultérieure du modèle ne le change jamais.
* Limites connues : un PDF scanné se lit mal (préférer un PDF numérique) ; le contenu est reproduit fidèlement, pas la mise en page au pixel près.

### Locations du partenaire

* Parcours unique et continu : véhicule → client → dates et prix → caution → contrat → signature. Pas d'étape « contrat » séparée à rejoindre après coup.
* Onglet « Contrats » : liste des contrats signés du partenaire. Il gère aussi les inspections (départ et retour) de ses propres locations.
* Le partenaire ne voit que ses véhicules, ses clients, ses locations et ses contrats ; l'équipe voit tout. Le calendrier est commun avec l'agence : un véhicule ne peut pas être loué deux fois sur des périodes qui se chevauchent.
* Décisions retenues pour l'instant (modifiables) : **aucune commission** de l'agence sur les locations faites par le partenaire ; ces locations (et leurs paiements) sont **exclues** des chiffres de l'agence et de la part du partenaire sur les locations de l'agence ; les **clients du partenaire sont séparés** de ceux de l'agence (colonne `owner_partner_id`).
* Livré : clients, location, paiement (à la création ou par le solde), contrat (modèle actif de l'agence par défaut, identité du partenaire comme loueur), signatures (locataire, loueur) avec PDF archivé, photos de la pièce d'identité et du permis du locataire, inspections de départ et de retour avec photos, caution (reçue, restituée ou retenue avec motif) et clôture automatique. Les règles de l'agence s'appliquent telles quelles : contrat signé + inspection de départ = location « en cours » ; la location se termine quand l'inspection de retour est faite, que le paiement est complet et que la caution est restituée ou retenue.
* **Contrat personnalisé** : le partenaire importe son contrat en PDF (page « Mon contrat »). Le serveur en lit le texte, sans service externe, et le découpe en sections et clauses (titres numérotés ou en majuscules, en-têtes et pieds de page répétés retirés, lignes « à remplir » et zones de signature écartées). Le partenaire relit et corrige, ajoute son logo (PNG, JPEG ou WebP, 2 Mo) et envoie la version pour validation. L'équipe relit chaque clause (Contrats partenaires) et valide ou refuse avec un motif ; le partenaire est prévenu. Une version validée sert à toutes les nouvelles locations du partenaire ; sans version validée, le modèle de l'agence s'applique. Chaque envoi est une nouvelle version, jamais modifiée ensuite ; un contrat déjà créé garde son texte et son logo figés. Les parties variables (loueur, locataire, véhicule, durée, prix, pièces d'identité, signatures) restent générées par la plateforme.
* Limites connues : un PDF scanné (photo) ne donne presque pas de texte : il faut un PDF numérique ou saisir les clauses à la main ; le découpage est une aide, la relecture du partenaire fait foi ; la mise en page d'origine n'est pas reproduite.
* Reste : les incidents côté partenaire.

### Réservation sur le site public

* Plus de création de compte obligatoire : le visiteur renseigne son nom, son téléphone et ses dates, puis le site ouvre WhatsApp avec un message prérempli (véhicule, dates, prix estimé, référence). La création de compte reste proposée, en option.
* Destinataire : véhicule de l'agence → numéro WhatsApp de l'agence ; véhicule d'un partenaire → numéro WhatsApp du partenaire (à défaut, celui de l'agence).
* La demande est enregistrée avant la redirection (suivi, canal d'acquisition, retrouvable par le partenaire ou l'équipe), avec une limite de demandes par numéro comme pour les transferts.

### Demandes concernant un véhicule partenaire (réservations et transferts)

* Le partenaire a une seule page « Demandes » : ses demandes de réservation du site et les transferts (par exemple aéroport → destination) qui concernent un de ses véhicules.
* **Transferts** : ils restent gérés par l'équipe. Dès que l'équipe lie un véhicule partenaire à un transfert (ou que le visiteur le choisit sur le site), le partenaire est notifié et répond « Disponible » ou « Indisponible ». Sa réponse est vue par l'équipe (notification et badge dans la gestion des transferts). Si l'équipe change de véhicule, la réponse est remise à zéro et le nouveau partenaire est notifié. La réponse du partenaire n'assigne ni ne confirme rien : l'équipe décide.
* **Ce que le partenaire voit d'un transfert** : trajet, date et heure de prise en charge, nombre de passagers et de bagages, véhicule, statut et sa réponse. Il ne voit jamais le nom ni le téléphone du client, ni le prix de la course, ni le numéro de vol, ni les notes. Il ne voit que les transferts de ses propres véhicules.
* **Alerte** : le menu « Demandes » affiche le nombre de demandes à traiter (réservations « nouvelles » + transferts sans réponse dont la prise en charge est à venir), et le tableau de bord du partenaire un bandeau avec le même chiffre. Les notifications sont aussi envoyées sur le téléphone s'il a activé les alertes.
* **Créer la location** : sur une demande de réservation, le bouton ouvre l'assistant de location déjà rempli (véhicule, dates, nom et téléphone du client). À l'enregistrement de la location, la demande passe en « Réservation conclue ». Rien n'est créé sans que le partenaire valide les étapes de l'assistant.

## 18. Logos des partenaires sur le site public (branche `partenaires-logos`)

Une section « Nos partenaires » du site public fait défiler les logos des partenaires.

* **Accord obligatoire** : le partenaire coche lui-même, à côté de son logo (page « Mon contrat »), « J'accepte que mon logo apparaisse sur le site public de FIMA AUTO ». La case est décochée par défaut ; la décocher retire le logo du site aussitôt.
* **Partenaire publiable** : compte actif, nom commercial renseigné, logo envoyé et accord donné. Le contrat personnalisé n'est pas une condition.
* **Seuil** : la section n'apparaît que lorsque le nombre de partenaires publiables atteint le seuil (5 par défaut, modifiable dans l'éditeur « Site web », section « Logos partenaires »). En dessous, elle reste invisible. Chaque nouveau partenaire publiable s'ajoute tout seul au défilement ; si le nombre retombe sous le seuil (logo retiré, accord retiré, compte désactivé), la section se cache.
* **Ce qui est public** : le nom commercial et le logo, rien d'autre (ni contrat, ni coordonnées). Le logo n'est lisible publiquement que tant que le partenaire est publiable.
* Le logo n'est pas cliquable (V1). Pas de page dédiée : une section de l'accueil, que l'équipe peut masquer ou déplacer comme les autres.
