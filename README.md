# Chantier Notes

PWA de dictée vocale avec transcription temps réel (Web Speech API, FR) et synchronisation OneDrive via Microsoft Graph.

Usage : relever des informations sur chantier à la voix, obtenir la transcription texte, sauvegarde audio + texte dans OneDrive.

## Fonctionnalités MVP

- Enregistrement audio avec **pause/reprise**
- **Transcription en direct** (Web Speech API, gratuit)
- **Stockage local** hors-ligne (IndexedDB), resté accessible sans réseau
- **Upload OneDrive** (audio + texte) dans un dossier `Chantier Notes`
- **Renommer / supprimer** les notes
- **Liens OneDrive** directs (audio, texte, dossier, lien de partage)
- Installable comme app (PWA)

## Dév local

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# éditer .env.local avec VITE_AZURE_CLIENT_ID (voir DEPLOY.md)
npm run dev
```

Sans `VITE_AZURE_CLIENT_ID`, l'app fonctionne en local (enregistrement + transcription) mais sans sync OneDrive.

## Build production

```bash
npm run build
npm run preview
```

## Déploiement

Voir [DEPLOY.md](./DEPLOY.md) pour :
1. Créer l'app Azure (OAuth OneDrive)
2. Déployer sur Vercel
3. Installer la PWA sur mobile

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `VITE_AZURE_CLIENT_ID` | — | Client ID de l'app Azure (obligatoire pour OneDrive) |
| `VITE_AZURE_AUTHORITY` | `https://login.microsoftonline.com/common` | Tenant MS (common = multi-tenant) |
| `VITE_ONEDRIVE_FOLDER` | `Chantier Notes` | Nom du dossier racine dans OneDrive |
| `VITE_SPEECH_LANG` | `fr-FR` | Langue de reconnaissance vocale |
