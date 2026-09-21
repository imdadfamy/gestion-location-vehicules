# CAHIER DES CHARGES

## Application interne de gestion de location de véhicules — Bénin

## 1. Présentation du projet

L'objectif est de développer une application web interne permettant de centraliser et informatiser la gestion d'une activité de location de véhicules.

L'application doit remplacer les contrats papier et les suivis manuels par un système permettant de gérer les véhicules, clients, locations, contrats, signatures, paiements, cautions, inspections, incidents, maintenance et documents.

La version 1 est exclusivement destinée au personnel interne de l'entreprise.

Il n'existe pas de compte client dans la V1.

---

## 2. Objectifs

L'application doit permettre de :

* gérer le parc automobile ;
* gérer les clients ;
* gérer les locations ;
* vérifier la disponibilité des véhicules ;
* générer les contrats de location ;
* gérer les versions des contrats ;
* faire signer les contrats directement sur écran ;
* générer et archiver les contrats PDF signés ;
* enregistrer les paiements effectués directement auprès du client ;
* gérer les cautions ;
* effectuer les états des lieux départ et retour ;
* gérer les incidents ;
* gérer la maintenance ;
* centraliser les documents ;
* recevoir des notifications internes ;
* suivre l'activité grâce à un tableau de bord ;
* conserver un historique des actions effectuées.

---

## 3. Utilisateurs

La V1 comporte uniquement deux types de comptes.

### 3.1 Super Admin

Le Super Admin possède tous les droits.

Il peut notamment :

* créer/modifier/désactiver les utilisateurs ;
* gérer les permissions ;
* gérer les véhicules ;
* gérer les clients ;
* gérer les locations ;
* gérer les contrats ;
* gérer les paiements ;
* gérer les cautions ;
* gérer la maintenance ;
* gérer les incidents ;
* gérer les documents ;
* gérer les paramètres de l'entreprise ;
* gérer les modèles de contrats ;
* gérer les clauses ;
* gérer les versions des contrats ;
* consulter le tableau de bord ;
* consulter les rapports ;
* consulter les journaux d'activité.

### 3.2 Utilisateur / Responsable

Le compte Utilisateur / Responsable est destiné au personnel opérationnel.

Ses droits sont configurables par le Super Admin.

---

## 4. Gestion des clients

Les informations suivantes doivent pouvoir être enregistrées :

* nom ;
* prénom ;
* pièce d'identité ;
* numéro de pièce d'identité ;
* adresse / résidence ;
* téléphone ;
* contact d'urgence ;
* permis de conduire ;
* numéro du permis ;
* date d'expiration du permis ;
* documents associés ;
* historique des locations.

---

## 5. Gestion des véhicules

Chaque véhicule doit pouvoir contenir :

* marque ;
* modèle ;
* immatriculation ;
* couleur ;
* année ;
* kilométrage ;
* carburant ;
* transmission ;
* catégorie ;
* prix de location ;
* montant de caution.

### Statuts

Un véhicule peut avoir les statuts :

* Disponible ;
* En location ;
* En maintenance ;
* Indisponible.

### Documents

Les documents du véhicule peuvent comprendre :

* carte grise ;
* assurance ;
* contrôle technique ;
* photos ;
* autres documents.

L'application doit conserver l'historique :

* des locations ;
* des maintenances ;
* des incidents.

---

## 6. Gestion des locations

Une location doit permettre de sélectionner :

1. un client ;
2. un véhicule disponible ;
3. une date et heure de départ ;
4. une date et heure de retour ;
5. un lieu de départ ;
6. un lieu de retour ;
7. une durée ;
8. un prix ;
9. une caution.

Le système doit empêcher les chevauchements de locations pour un même véhicule.

---

## 7. Contrats

Le contrat doit être généré à partir des informations enregistrées dans l'application.

Il doit notamment contenir :

* informations de l'entreprise ;
* informations du client ;
* pièce d'identité ;
* adresse ;
* téléphone ;
* contact d'urgence ;
* informations du véhicule ;
* durée de location ;
* dates ;
* prix ;
* caution ;
* conditions générales ;
* signatures ;
* dates des signatures.

Le contenu doit pouvoir être adapté depuis l'administration.

---

## 8. Modèles et versions des contrats

Le Super Admin doit pouvoir :

* créer un modèle ;
* modifier un modèle ;
* ajouter une clause ;
* modifier une clause ;
* supprimer une clause ;
* réorganiser les clauses ;
* créer une nouvelle version.

Lorsqu'un contrat est signé, la version exacte utilisée doit être conservée.

Une modification ultérieure du modèle ne doit jamais modifier un contrat déjà signé.

---

## 9. Signature électronique interne

La V1 utilis
