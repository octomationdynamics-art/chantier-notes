const env = import.meta.env

export const config = {
  googleClientId: env.VITE_GOOGLE_CLIENT_ID ?? '',
  driveFolderName: env.VITE_DRIVE_FOLDER ?? 'Chantier Notes',
  speechLang: env.VITE_SPEECH_LANG ?? 'fr-FR',
} as const

export function isConfigured() {
  return config.googleClientId.length > 0
}
