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

## 4. Véhicules

Un véhicule ne peut pas être réservé pour deux locations qui se chevauchent.

Un véhicule doit être considéré comme indisponible pendant une période de location active.

Un véhicule en maintenance ne doit pas pouvoir être affecté à une nouvelle location.

Un véhicule marqué comme indisponible ne doit pas pouvoir être affecté à une nouvelle location.

---

## 5. Locations

Une location doit obligatoirement être liée à :

* un client ;
* un véhicule ;
* une date de départ ;
* une date de retour ;
* un prix.

Le système doit vérifier la disponibilité du véhicule avant la création ou modification d'une location.

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
