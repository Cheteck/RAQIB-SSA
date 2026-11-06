import fs from 'fs';
import path from 'path';

export class PathGuard {
  private readonly normalizedRoot: string;
  private readonly realRoot: string;

  constructor(private allowedRoot: string) {
    this.allowedRoot = path.resolve(allowedRoot);
    this.realRoot = this.realpathDeep(this.allowedRoot);
    this.normalizedRoot = this.normalize(this.realRoot);
  }

  /**
   * Normalisation de casse sur Windows (systèmes de fichiers insensibles à la casse).
   */
  private normalize(p: string): string {
    return process.platform === 'win32' ? p.toLowerCase() : p;
  }

  /**
   * Résout les liens symboliques sur la plus longue portion existante du chemin.
   * Permet de valider un chemin qui n'existe pas encore (fichier à créer) tout
   * en refusant un chemin dont un ancêtre existant est un symlink sortant.
   */
  private realpathDeep(target: string): string {
    let current = target;
    const missing: string[] = [];

    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) break;
      missing.unshift(path.basename(current));
      current = parent;
    }

    let real = current;
    try {
      real = fs.realpathSync.native(current);
    } catch {
      try {
        real = fs.realpathSync(current);
      } catch {
        // Chemin inaccessible : on conserve la résolution logique.
      }
    }

    return missing.length ? path.join(real, ...missing) : real;
  }

  /**
   * Résout un chemin (relatif ou absolu) contre le root autorisé.
   * Utilisé par les outils qui doivent opérer sur le chemin canonique.
   */
  resolve(targetPath: string): string {
    return path.resolve(this.allowedRoot, targetPath);
  }

  validate(targetPath: string): { allowed: boolean; reason: string } {
    const resolved = this.resolve(targetPath);
    // Résolution des symlinks AVANT la comparaison de confinement.
    const realResolved = this.realpathDeep(resolved);

    // 1. Vérifier le confinement réel (pas un simple préfixe de chaîne).
    const normalizedResolved = this.normalize(realResolved);
    const rootWithSep = this.normalizedRoot.endsWith(path.sep)
      ? this.normalizedRoot
      : this.normalizedRoot + path.sep;
    const isContained =
      normalizedResolved === this.normalizedRoot ||
      normalizedResolved.startsWith(rootWithSep);

    if (!isContained) {
      return { allowed: false, reason: 'Access denied: Path outside allowed root' };
    }

    // 2. Vérifier les secrets (sur le chemin réel, pas seulement logique).
    if (this.isSecretFile(realResolved)) {
      return { allowed: false, reason: 'Access denied: Sensitive file access' };
    }

    return { allowed: true, reason: 'Allowed' };
  }

  isSecretFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return (
      fileName.startsWith('.env') ||
      fileName.endsWith('.key') ||
      fileName.endsWith('.pem') ||
      fileName.includes('credentials')
    );
  }

  isBinaryFile(filePath: string): boolean {
    // Liste simple d'extensions binaires à bloquer
    const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.pdf'];
    return binaryExtensions.some(ext => filePath.endsWith(ext));
  }
}
