# Guide d'installation (Google Drive)

## État actuel

- App déployée : **https://my-repository-notes-chantiers.vercel.app/**
- Repo : https://github.com/octomationdynamics-art/chantier-notes

Tant que la variable `VITE_GOOGLE_CLIENT_ID` n'est pas configurée, l'app fonctionne **en local** sur ton téléphone (enregistrement + transcription + stockage dans le navigateur), mais **rien n'est envoyé vers Google Drive**.

## 1. Créer un Client ID Google OAuth (≈ 7 min, une seule fois)

### 1.1 Créer un projet Google Cloud

1. Va sur **https://console.cloud.google.com/projectcreate**.
2. Connecte-toi avec ton compte Google.
3. Nom du projet : `Chantier Notes` → **Créer**.
4. Attends que le projet soit créé (10 s), puis **sélectionne-le** en haut de l'écran.

### 1.2 Activer l'API Google Drive

1. Va sur **https://console.cloud.google.com/apis/library/drive.googleapis.com**.
2. Vérifie que le projet sélectionné est `Chantier Notes`.
3. Clique sur **Activer**.

### 1.3 Configurer l'écran de consentement OAuth

1. Va sur **https://console.cloud.google.com/apis/credentials/consent**.
2. Type d'utilisateur : **Externe** → **Créer**.
3. Remplis les champs obligatoires :
   - **Nom de l'application** : `Chantier Notes`
   - **Adresse e-mail de support** : ton adresse Gmail
   - **Adresse e-mail du développeur** : ton adresse Gmail
4. Clique **Enregistrer et continuer** → **Enregistrer et continuer** (Scopes, pas besoin d'ajouter ici) → **Enregistrer et continuer** (Utilisateurs test : ajoute ton propre email).
5. Bouton **Retour au tableau de bord**.

*(Tant que l'app est en mode "Testing", seuls les utilisateurs test que tu ajoutes peuvent se connecter. Pour toi seul, c'est parfait. Pas besoin de la publier.)*

### 1.4 Créer le Client ID OAuth

1. Va sur **https://console.cloud.google.com/apis/credentials**.
2. **+ Créer des identifiants** → **ID client OAuth**.
3. Type d'application : **Application Web**.
4. Nom : `Chantier Notes Web`.
5. **Origines JavaScript autorisées** — clique **+ Ajouter un URI** et mets :
   - `https://my-repository-notes-chantiers.vercel.app`
   - `http://localhost:5173` *(pour dev local, optionnel)*
6. **URI de redirection autorisés** : laisse vide *(pas utile avec le flow token)*.
7. Clique **Créer**.
8. Une popup s'affiche avec ton **ID client** → **copie-le** (finit par `.apps.googleusercontent.com`).

## 2. Brancher le Client ID à Vercel

1. Va sur **https://vercel.com/dashboard** → projet `my-repository-notes-chantiers`.
2. **Settings** → **Environment Variables**.
3. Ajoute :
   - **Key** : `VITE_GOOGLE_CLIENT_ID`
   - **Value** : l'ID client copié à l'étape 1.4
   - **Environments** : cocher `Production`, `Preview`, `Development`
4. Clique **Save**.
5. Onglet **Deployments** → menu `...` du dernier deploy → **Redeploy** → *décocher "Use existing Build Cache"* si demandé → **Redeploy**.
6. Attends ~1 min que le nouveau deploy soit live.

## 3. Installer l'app sur mobile

Ouvre https://my-repository-notes-chantiers.vercel.app/ dans :

- **Android Chrome** : menu ⋮ → **Installer l'application** (ou *Ajouter à l'écran d'accueil*).
- **iOS Safari** : bouton Partager 📤 → **Sur l'écran d'accueil**.

L'icône apparaît sur l'écran d'accueil, l'app s'ouvre en plein écran sans barre d'URL.

## 4. Premier usage

1. Ouvre l'app → bouton **Se connecter**.
2. Une popup Google s'ouvre → sélectionne ton compte Gmail.
3. Accepte l'accès : l'app demande juste la permission **"Voir, modifier, créer et supprimer uniquement les fichiers Google Drive que vous utilisez avec cette app"** (scope `drive.file` = isolé, on ne voit jamais tes autres fichiers Drive).
4. Fais un enregistrement → dès la fin, audio + texte sont uploadés dans un dossier **`Chantier Notes`** à la racine de ton Drive.

## Dépannage

| Problème | Solution |
|---|---|
| "Google Drive non configuré" après deploy | `VITE_GOOGLE_CLIENT_ID` manquante ou build non refait (redéployer sans cache). |
| "Error 400: redirect_uri_mismatch" | L'origine JS dans Google Cloud ne matche pas ton URL Vercel exactement. Vérifie qu'il y a bien `https://my-repository-notes-chantiers.vercel.app` **sans** slash final. |
| "Access blocked: Chantier Notes has not completed Google verification" | En mode Testing, tu dois t'être ajouté comme *utilisateur test* (section 1.3 étape 4). |
| Popup bloquée | Autorise les popups pour `my-repository-notes-chantiers.vercel.app` dans les paramètres du navigateur. |
| Reconnaissance vocale silencieuse | Non supportée sur Firefox. Fonctionne sur Chrome/Edge (Android/desktop) et Safari iOS 14.5+. |
| Token expiré au bout d'1 h | L'app refresh automatiquement au prochain upload ; si ça ne marche pas, déconnexion / reconnexion. |
