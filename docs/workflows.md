# WORKFLOWS

## Application interne de gestion de location de véhicules

---

# 1. Workflow général d'une location

Le processus principal de l'application est :

```text
Connexion utilisateur
        ↓
Création / sélection du client
        ↓
Sélection du véhicule
        ↓
Vérification de disponibilité
        ↓
Définition des dates et lieux
        ↓
Définition du prix
        ↓
Définition de la caution
        ↓
Création de la location
        ↓
Création du contrat
        ↓
Vérification du contrat
        ↓
Signature du client
        ↓
Signature du responsable
        ↓
Génération du PDF signé
        ↓
Archivage
        ↓
Départ du véhicule
        ↓
Inspection de départ
        ↓
Location en cours
        ↓
Retour du véhicule
        ↓
Inspection de retour
        ↓
Comparaison départ / retour
        ↓
Gestion éventuelle des dommages
        ↓
Paiement du solde
        ↓
Gestion de la caution
        ↓
Clôture de la location
        ↓
Véhicule disponible
```

---

# 2. Connexion

L'utilisateur ouvre l'application.

```text
Utilisateur
    ↓
Page de connexion
    ↓
Email + mot de passe
    ↓
Supabase Auth
    ↓
Vérification du compte
    ↓
Vérification du statut actif
    ↓
Chargement des permissions
    ↓
Dashboard
```

Si l'utilisateur est désactivé, l'accès doit être refusé.

---

# 3. Création d'un client

Un responsable peut créer un client.

```text
Clients
    ↓
Nouveau client
    ↓
Informations personnelles
    ↓
Pièce d'identité
    ↓
Adresse
    ↓
Téléphone
    ↓
Contact d'urgence
    ↓
Permis de conduire
    ↓
Documents
    ↓
Validation
    ↓
Client enregistré
```

Le client peut ensuite être utilisé dans une location.

---

# 4. Sélection du client pour une location

Lorsqu'une nouvelle location est créée :

```text
Nouvelle location
    ↓
Rechercher un client
    ↓
Client existant ?
    ├── Oui → sélectionner le client
    │
    └── Non → créer le client
                    ↓
                sélectionner le client
```

---

# 5. Sélection du véhicule

```text
Nouvelle location
    ↓
Sélection du véhicule
    ↓
Choix des dates
    ↓
Vérification de disponibilité
```

Le système doit vérifier :

* statut du véhicule ;
* locations existantes ;
* chevauchement des dates ;
* maintenance ;
* indisponibilité.

### Si disponible

```text
Véhicule disponible
        ↓
Sélection possible
```

### Si indisponible

```text
Véhicule indisponible
        ↓
Sélection impossible
        ↓
Choisir un autre véhicule
```

---

# 6. Création d'une location

```text
Client
  ↓
Véhicule
  ↓
Date/heure de départ
  ↓
Date/heure de retour
  ↓
Lieu de départ
  ↓
Lieu de retour
  ↓
Durée
  ↓
Prix
  ↓
Caution
  ↓
Observations
  ↓
Validation
```

Après validation :

```text
Location créée
    ↓
Statut location = prévu / en attente
    ↓
Contrat disponible à générer
```

---

# 7. Vérification du prix

Le système doit afficher clairement :

```text
Prix de location
+ éventuels frais applicables
= Total location
```

La caution doit rester séparée :

```text
Total location ≠ Caution
```

La caution ne doit pas être considérée automatiquement comme du chiffre d'affaires.

---

# 8. Paiement lors de la location

Le paiement est effectué directement auprès du responsable.

```text
Client remet l'argent
        ↓
Responsable reçoit le paiement
        ↓
Responsable ouvre la location
        ↓
Enregistre le montant reçu
        ↓
Le système calcule le solde
```

Calcul :

```text
Solde = Montant total - Montant reçu
```

### Exemple

```text
Montant location : 300 000 FCFA
Montant reçu :     200 000 FCFA
Solde :            100 000 FCFA
```

Statut :

```text
0 FCFA reçu
    → Non payé

Montant partiel
    → Partiellement payé

Total reçu
    → Payé
```

---

# 9. Gestion de la caution

La caution est gérée séparément.

```text
Caution prévue
      ↓
Le client verse la caution
      ↓
Responsable enregistre la réception
      ↓
Statut = Reçue
```

Au retour :

```text
Inspection retour
      ↓
Dommage constaté ?
      ├── Non
      │    ↓
      │  Restitution
      │    ↓
      │  Statut = Restituée
      │
      └── Oui
           ↓
        Évaluation
           ↓
        Retenue éventuelle
           ↓
        Statut = Retenue
```

Le système doit conserver :

* montant initial ;
* montant retenu ;
* montant restitué ;
* date ;
* observation.

---

# 10. Création du contrat

Après création de la location :

```text
Location
    ↓
Créer le contrat
    ↓
Sélection du modèle actif
    ↓
Sélection de la version
    ↓
Insertion des données
    ↓
Client
    ↓
Véhicule
    ↓
Dates
    ↓
Prix
    ↓
Caution
    ↓
Clauses
    ↓
Prévisualisation
```

---

# 11. Génération dynamique du contrat

Les données doivent être automatiquement injectées dans le modèle.

Exemple :

```text
{{company_name}}
{{client_first_name}}
{{client_last_name}}
{{vehicle_brand}}
{{vehicle_model}}
{{registration_number}}
{{start_date}}
{{end_date}}
{{rental_price}}
{{deposit_amount}}
```

Le système remplace les variables par les données réelles.

---

# 12. Signature du contrat

Le processus de signature est :

```text
Contrat généré
      ↓
Prévisualisation
      ↓
Signature du client
      ↓
Signature manuscrite sur écran
      ↓
Validation
      ↓
Signature du responsable
      ↓
Signature manuscrite sur écran
      ↓
Validation
      ↓
Contrat signé
```

La signature est réalisée :

* avec la souris ;
* avec le doigt ;
* avec un stylet.

Il n'y a pas d'OTP.

Il n'y a pas de SMS.

Il n'y a pas de code de confirmation.

Il n'y a pas de fournisseur externe de signature en V1.

---

# 13. Conservation de la version du contrat

Lorsqu'un contrat est créé :

```text
Modèle actif
    ↓
Version sélectionnée
    ↓
Contrat créé
    ↓
Version enregistrée avec le contrat
```

Si le Super Admin modifie ensuite le modèle :

```text
Ancien contrat signé
        ↓
RESTE INCHANGÉ
```

Le nouveau contrat utilisera la nouvelle version.

```text
Template V1
   ↓
Contrat A → V1

Modification
   ↓
Template V2
   ↓
Contrat B → V2
```

---

# 14. Génération du PDF signé

Après les signatures :

```text
Contrat
    ↓
Signatures ajoutées
    ↓
Génération du PDF
    ↓
PDF final
    ↓
Stockage Supabase Storage
    ↓
Référence enregistrée dans la base
```

Le PDF doit être accessible depuis la fiche du contrat.

---

# 15. Inspection de départ

Avant le départ du véhicule :

```text
Location validée
      ↓
Inspection départ
      ↓
Kilométrage
      ↓
Carburant
      ↓
Observations
      ↓
Photos
      ↓
Dommages existants
      ↓
Validation
      ↓
Inspection enregistrée
```

Photos possibles :

```text
Avant
Arrière
Gauche
Droite
Intérieur
Dommages
Autres
```

---

# 16. Début de la location

Après validation du départ :

```text
Inspection départ terminée
       ↓
Véhicule remis au client
       ↓
Location active
       ↓
Véhicule = En location
```

Le système doit empêcher une autre location de commencer sur le même véhicule pendant cette période.

---

# 17. Location en cours

Pendant la location :

```text
Location active
       ↓
Suivi de la date de retour
       ↓
Notifications éventuelles
```

Le système peut signaler :

* retour proche ;
* retard ;
* solde restant ;
* incident ;
* autre événement nécessitant une action.

---

# 18. Retour du véhicule

Lorsque le client retourne le véhicule :

```text
Location active
       ↓
Retour du véhicule
       ↓
Inspection retour
```

---

# 19. Inspection de retour

```text
Inspection retour
      ↓
Kilométrage
      ↓
Carburant
      ↓
Observations
      ↓
Photos
      ↓
Dommages
      ↓
Validation
```

---

# 20. Comparaison départ / retour

Le système doit comparer les données :

```text
INSPECTION DÉPART
        +
INSPECTION RETOUR
        ↓
COMPARAISON
```

Éléments comparés :

* kilométrage ;
* carburant ;
* dommages ;
* observations ;
* photos.

Exemple :

```text
Kilométrage départ : 45 000 km
Kilométrage retour : 45 850 km

Différence : 850 km
```

---

# 21. Gestion d'un dommage

Si un dommage est constaté :

```text
Dommage détecté
      ↓
Création d'un incident
      ↓
Description
      ↓
Photos
      ↓
Documents éventuels
      ↓
Coût estimé
      ↓
Statut
```

L'incident reste associé :

* à la location ;
* au véhicule ;
* éventuellement au client.

---

# 22. Incident

Types :

```text
Panne
Accident
Dommage
Infraction
Retard
Autre
```

Workflow :

```text
Incident
   ↓
Création
   ↓
Description
   ↓
Photos/documents
   ↓
Coût éventuel
   ↓
Traitement
   ↓
Résolution
   ↓
Historique conservé
```

---

# 23. Paiement du solde

Au retour :

```text
Vérification du montant total
       ↓
Vérification des paiements
       ↓
Solde restant ?
       ├── Non → Paiement terminé
       │
       └── Oui
             ↓
          Client paie
             ↓
          Responsable enregistre
             ↓
          Solde recalculé
```

Lorsque le solde est égal à zéro :

```text
Statut paiement = Payé
```

---

# 24. Clôture de la location

La location peut être clôturée lorsque les opérations nécessaires sont terminées.

```text
Retour effectué
     ↓
Inspection retour
     ↓
Paiements vérifiés
     ↓
Caution traitée
     ↓
Incidents traités si nécessaire
     ↓
Clôture
```

Puis :

```text
Location = Terminée
Véhicule = Disponible
```

---

# 25. Workflow maintenance

Lorsqu'un véhicule doit être entretenu :

```text
Véhicule
    ↓
Créer maintenance
    ↓
Type
    ↓
Date
    ↓
Kilométrage
    ↓
Garage / prestataire
    ↓
Coût
    ↓
Facture
    ↓
Enregistrement
```

Pendant la maintenance :

```text
Véhicule = Maintenance
```

Après la maintenance :

```text
Maintenance terminée
      ↓
Mise à jour kilométrage
      ↓
Prochaine maintenance
      ↓
Véhicule = Disponible
```

---

# 26. Workflow documents

```text
Document
    ↓
Sélection de l'objet
    ↓
Upload
    ↓
Stockage Supabase Storage
    ↓
Enregistrement du chemin dans PostgreSQL
    ↓
Association au client/véhicule/location/etc.
```

Les documents doivent rester accessibles uniquement aux utilisateurs autorisés.

---

# 27. Workflow notifications

Exemples :

### Contrat

```text
Contrat créé
    ↓
Signature manquante
    ↓
Notification
```

### Retour proche

```text
Date de retour proche
    ↓
Notification
```

### Retard

```text
Date de retour dépassée
    ↓
Véhicule non retourné
    ↓
Notification
```

### Maintenance

```text
Date/km maintenance proche
    ↓
Notification
```

### Document expirant

```text
Assurance / contrôle technique proche de l'expiration
    ↓
Notification
```

---

# 28. Workflow utilisateurs

Super Admin :

```text
Paramètres
    ↓
Utilisateurs
    ↓
Créer utilisateur
    ↓
Informations
    ↓
Type = Utilisateur / Responsable
    ↓
Permissions
    ↓
Enregistrer
```

Le Super Admin peut ensuite :

* modifier ;
* désactiver ;
* modifier les permissions.

---

# 29. Workflow audit

Pour une action importante :

```text
Action utilisateur
       ↓
Identification utilisateur
       ↓
Objet concerné
       ↓
Ancienne valeur
       ↓
Nouvelle valeur
       ↓
Date / heure
       ↓
Activity Log
```

Exemple :

```text
Utilisateur : Responsable A
Action : Modification du prix
Location : #LOC-00125

Ancienne valeur :
250 000 FCFA

Nouvelle valeur :
300 000 FCFA

Date :
[date/heure]
```

---

# 30. Workflow global résumé

```text
                    ┌──────────────┐
                    │    CLIENT    │
                    └──────┬───────┘
                           ↓
                    Création/sélection
                           ↓
                    ┌──────────────┐
                    │   VÉHICULE   │
                    └──────┬───────┘
                           ↓
                     Disponibilité
                           ↓
                    ┌──────────────┐
                    │   LOCATION   │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │   CONTRAT    │
                    └──────┬───────┘
                           ↓
                       Signature
                           ↓
                    ┌──────────────┐
                    │ PDF SIGNÉ    │
                    └──────┬───────┘
                           ↓
                  Inspection départ
                           ↓
                    🚗 LOCATION
                           ↓
                   Inspection retour
                           ↓
                 ┌─────────┴─────────┐
                 ↓                   ↓
             Dommage              Aucun
                 ↓                   ↓
             Incident            Caution
                 ↓                   ↓
                 └─────────┬─────────┘
                           ↓
                    Paiement final
                           ↓
                    Caution traitée
                           ↓
                    Clôture location
                           ↓
                    Véhicule disponible
```

---

# 31. Règle importante pour Claude

Claude doit respecter ces workflows comme référence fonctionnelle.

Avant de modifier un workflow métier, il doit :

1. identifier le workflow concerné ;
2. vérifier `business-rules.md` ;
3. vérifier `database.md` ;
4. vérifier les permissions ;
5. expliquer l'impact ;
6. demander validation avant une modification importante.

Aucune fonctionnalité de paiement en ligne, compte client ou signature OTP ne doit être ajoutée à la V1.
