/** Avvio del server: pianificazione dei backup automatici su Google Drive (solo runtime Node). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDriveScheduler } = await import('@/lib/googleDrive');
    startDriveScheduler();
  }
}
