# GESTION DES PERMISSIONS

## 1. Types de comptes

La V1 possède uniquement deux types de comptes :

1. Super Admin
2. Utilisateur / Responsable

Il ne faut pas créer de rôle client.

---

# 2. Super Admin

Le Super Admin possède tous les droits.

| Module               | Accès |
| -------------------- | ----- |
| Dashboard            | Total |
| Véhicules            | Total |
| Clients              | Total |
| Locations            | Total |
| Contrats             | Total |
| Paiements            | Total |
| Cautions             | Total |
| Inspections          | Total |
| Maintenance          | Total |
| Incidents            | Total |
| Documents            | Total |
| Notifications        | Total |
| Utilisateurs         | Total |
| Permissions          | Total |
| Paramètres           | Total |
| Modèles de contrats  | Total |
| Versions de contrats | Total |
| Journal d'activité   | Total |
| Rapports             | Total |

---

# 3. Utilisateur / Responsable

Le compte Utilisateur / Responsable peut recevoir des permissions configurées par le Super Admin.

Les permissions doivent être définies au niveau des modules et actions.

---

# 4. Actions possibles

Pour chaque module, les permissions peuvent être :

* view
* create
* update
* delete
* export
* validate

---

# 5. Modules

Les modules concernés sont :

* dashboard ;
* vehicles ;
* clients ;
* rentals ;
* contracts ;
* payments ;
* deposits ;
* inspections ;
* maintenance ;
* incidents ;
* documents ;
* notifications ;
* reports ;
* users ;
* permissions ;
* settings ;
* contract_templates ;
* activity_logs.

---

# 6. Exemple

Le Super Admin peut créer un utilisateur avec :

```text
Véhicules
view = oui
create = oui
update = oui
delete = non

Clients
view = oui
create = oui
update = oui
delete = non

Locations
view = oui
create = oui
update = oui
delete = non

Paiements
view = oui
create = oui
update = oui
delete = non
```

---

# 7. Sécurité

Les permissions ne doivent pas être contrôlées uniquement dans Angular.

Le frontend peut masquer les boutons et menus non autorisés, mais la sécurité réelle doit être appliquée côté serveur avec Supabase/PostgreSQL RLS.

Un utilisateur ne possédant pas une permission ne doit pas pouvoir contourner l'interface pour accéder directement aux données.

---

# 8. Super Admin

Le Super Admin doit pouvoir :

* créer un utilisateur ;
* modifier un utilisateur ;
* désactiver un utilisateur ;
* attribuer des permissions ;
* retirer des permissions ;
* consulter les actions des utilisateurs.

---

# 9. Désactivation

Un utilisateur désactivé ne doit plus pouvoir accéder aux fonctionnalités protégées de l'application.

Son historique doit cependant être conservé afin que les anciennes actions restent attribuées au bon utilisateur.

---

# 10. Principe général

Les permissions doivent être configurables sans modifier le code Angular.

L'objectif est que le Super Admin puisse modifier les droits depuis l'interface d'administration.
