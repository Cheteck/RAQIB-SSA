import path from 'path';

export class PathGuard {
  private readonly normalizedRoot: string;

  constructor(private allowedRoot: string) {
    this.allowedRoot = path.resolve(allowedRoot);
    this.normalizedRoot = this.normalize(this.allowedRoot);
  }

  /**
   * Normalisation de casse sur Windows (systèmes de fichiers insensibles à la casse).
   */
  private normalize(p: string): string {
    return process.platform === 'win32' ? p.toLowerCase() : p;
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

    // 1. Vérifier le confinement réel (pas un simple préfixe de chaîne).
    //    Ancêtre exact OU enfant du root séparé par un séparateur de chemin.
    const normalizedResolved = this.normalize(resolved);
    const rootWithSep = this.normalizedRoot.endsWith(path.sep)
      ? this.normalizedRoot
      : this.normalizedRoot + path.sep;
    const isContained =
      normalizedResolved === this.normalizedRoot ||
      normalizedResolved.startsWith(rootWithSep);

    if (!isContained) {
      return { allowed: false, reason: 'Access denied: Path outside allowed root' };
    }

    // 2. Vérifier les secrets
    if (this.isSecretFile(resolved)) {
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
