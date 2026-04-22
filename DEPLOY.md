# Guide d'installation

Trois étapes : déployer, configurer Azure, installer sur mobile.

## 1. Déployer sur Vercel (≈ 3 min)

### Option A — via l'interface web (recommandé, aucun CLI)

1. Ouvrir **https://vercel.com/new** (créer un compte gratuit si besoin, peut utiliser ton compte GitHub).
2. Cliquer sur **"Import Git Repository"** et sélectionner le repo `chantier-notes`.
3. Framework preset : **Vite** (détecté auto).
4. **Sans configurer** les variables d'environnement pour le moment, cliquer **"Deploy"**.
5. Note ton URL de prod (ex : `https://chantier-notes-abc123.vercel.app`).

## 2. Créer l'app Azure (≈ 5 min)

Tu vas enregistrer une app Microsoft pour que l'utilisateur (toi) puisse autoriser l'accès à ton OneDrive.

1. Aller sur **https://portal.azure.com** (se connecter avec `f.laine@empeering.fr`).
2. Barre de recherche → **"App registrations"** → **"+ Nouvelle inscription"**.
3. Remplir :
   - **Nom** : `Chantier Notes`
   - **Types de comptes pris en charge** : *"Comptes dans n'importe quel annuaire Microsoft Entra ID – multilocataire – et comptes Microsoft personnels"* (3ᵉ option).
   - **URI de redirection** : type **"Application monopage (SPA)"**, valeur = `https://TON-URL-VERCEL.vercel.app` (celle notée à l'étape 1).
4. Cliquer **"S'inscrire"**.
5. Sur la page de l'app, copier **"ID d'application (client)"** → c'est ton `VITE_AZURE_CLIENT_ID`.
6. Dans le menu gauche, **"Authentification"** → vérifier qu'il y a bien un URI de redirection de type **SPA** pointant vers ton URL Vercel. Ajouter aussi `http://localhost:5173` pour le dev local si besoin. **Enregistrer**.
7. Dans le menu gauche, **"Autorisations d'API"** → **"+ Ajouter une autorisation"** → **"Microsoft Graph"** → **"Autorisations déléguées"** → cocher :
   - `Files.ReadWrite`
   - `User.Read`
   - `offline_access`
8. Cliquer **"Ajouter les autorisations"**. *(Pas besoin de consentement admin pour un compte perso/mono-user.)*

## 3. Brancher Azure au déploiement

1. Revenir dans Vercel → ton projet → **Settings** → **Environment Variables**.
2. Ajouter :
   - `VITE_AZURE_CLIENT_ID` = le client ID copié à l'étape 2.5
   - `VITE_ONEDRIVE_FOLDER` = `Chantier Notes` *(ou autre nom)*
3. Onglet **Deployments** → redéployer (bouton "..." sur le dernier deploy → **Redeploy**).

## 4. Installer sur mobile

Ouvrir l'URL Vercel dans le navigateur du téléphone :

- **Android (Chrome)** : menu ⋮ → **"Installer l'application"** ou **"Ajouter à l'écran d'accueil"**.
- **iOS (Safari)** : bouton Partager 📤 → **"Sur l'écran d'accueil"**.

L'icône apparaît sur l'écran d'accueil, l'app s'ouvre en plein écran.

## 5. Autoriser OneDrive

1. Ouvrir l'app → bouton **"Se connecter"** en haut.
2. Se connecter avec `f.laine@empeering.fr`.
3. Accepter les autorisations demandées.
4. Faire un premier enregistrement → il sera uploadé automatiquement dans `OneDrive > Chantier Notes`.

## Dépannage

- **"Azure non configuré"** : `VITE_AZURE_CLIENT_ID` non défini dans Vercel ou redéploiement oublié.
- **Popup bloqué à la connexion** : autoriser les popups pour le site, ou l'app basculera en mode redirect.
- **Reconnaissance vocale ne marche pas** : n'est supportée que sur Chrome/Edge (Android) et Safari (iOS 14.5+). Sur Firefox, l'enregistrement audio fonctionne mais pas la transcription live.
- **Erreur "AADSTS50011" (redirect URI mismatch)** : l'URI dans Azure ne correspond pas exactement à ton URL Vercel (attention aux `/` en fin).
