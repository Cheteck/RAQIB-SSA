import fs from 'fs';
import path from 'path';

/**
 * Emergency Stop indépendant — activable sans intervention code.
 * Deux mécanismes parallèles :
 *  1. Variable d'environnement RAQIB_EMERGENCY_STOP=true
 *  2. Fichier data/emergency.lock
 */
export class EmergencyStop {
  private lockPath: string;

  constructor(dataDir: string = './data') {
    this.lockPath = path.join(dataDir, 'emergency.lock');
  }

  /** Retourne true si l'arrêt d'urgence est actif. */
  isActive(): boolean {
    // Env var
    if (process.env.RAQIB_EMERGENCY_STOP === 'true') return true;

    // Fichier lock
    return fs.existsSync(this.lockPath);
  }

  /** Active l'arrêt d'urgence en écrivant data/emergency.lock. */
  async activate(reason: string): Promise<void> {
    await fs.promises.writeFile(
      this.lockPath,
      JSON.stringify({
        activatedAt: new Date().toISOString(),
        reason,
      }),
      'utf8',
    );
    process.env.RAQIB_EMERGENCY_STOP = 'true';
  }

  /** Désactive l'arrêt d'urgence (supprime le lock, log dans audit). */
  async deactivate(confirmedBy: string): Promise<void> {
    try {
      await fs.promises.unlink(this.lockPath);
    } catch {
      // Fichier n'existe pas, ok
    }
    process.env.RAQIB_EMERGENCY_STOP = 'false';
  }
}
