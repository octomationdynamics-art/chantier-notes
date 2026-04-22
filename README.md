# Chantier Notes

PWA de dictée vocale avec transcription en direct (Web Speech API, FR) et synchronisation **Google Drive**.

Usage : relever des informations sur chantier à la voix, avoir la transcription texte, sauvegarde audio + texte dans Google Drive.

## Fonctionnalités MVP

- Enregistrement audio avec **pause/reprise**
- **Transcription en direct** (Web Speech API, gratuit)
- **Stockage local** hors-ligne (IndexedDB), resté accessible sans réseau
- **Upload Google Drive** (audio + texte) dans un dossier `Chantier Notes`
- **Renommer / supprimer** les notes
- **Liens Drive** directs (audio, texte, dossier, lien de partage anonyme)
- Installable comme app (PWA)
- Scope Drive minimal : `drive.file` — l'app ne peut voir que les fichiers qu'elle crée, jamais le reste de ton Drive

## Dév local

```bash
npm install
cp .env.example .env.local
# éditer .env.local avec VITE_GOOGLE_CLIENT_ID (voir DEPLOY.md)
npm run dev
```

Sans `VITE_GOOGLE_CLIENT_ID`, l'app fonctionne en local (enregistrement + transcription) mais sans sync Drive.

## Build production

```bash
npm run build
npm run preview
```

## Déploiement

App déployée : https://my-repository-notes-chantiers.vercel.app/

Configuration Google Cloud + installation mobile : voir **[DEPLOY.md](./DEPLOY.md)**.

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | — | Client ID OAuth Google (obligatoire pour Drive) |
| `VITE_DRIVE_FOLDER` | `Chantier Notes` | Nom du dossier dans Drive |
| `VITE_SPEECH_LANG` | `fr-FR` | Langue de reconnaissance vocale |

## Stack

- Vite + React 19 + TypeScript
- `vite-plugin-pwa` (service worker, installable)
- Google Identity Services (OAuth token flow, sans backend)
- Google Drive REST API v3
- IndexedDB (idb) pour le stockage hors-ligne
- Web Speech API (reconnaissance vocale navigateur)
