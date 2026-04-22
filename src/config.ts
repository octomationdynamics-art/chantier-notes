const env = import.meta.env

export const config = {
  azureClientId: env.VITE_AZURE_CLIENT_ID ?? '',
  azureAuthority: env.VITE_AZURE_AUTHORITY ?? 'https://login.microsoftonline.com/common',
  oneDriveFolderName: env.VITE_ONEDRIVE_FOLDER ?? 'Chantier Notes',
  speechLang: env.VITE_SPEECH_LANG ?? 'fr-FR',
} as const

export function isConfigured() {
  return config.azureClientId.length > 0
}
