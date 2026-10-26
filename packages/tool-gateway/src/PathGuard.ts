import path from 'path';

export class PathGuard {
  constructor(private allowedRoot: string) {
    this.allowedRoot = path.resolve(allowedRoot);
  }

  validate(targetPath: string): { allowed: boolean; reason: string } {
    const resolved = path.resolve(this.allowedRoot, targetPath);
    
    // 1. Vérifier que le chemin est bien dans le root
    if (!resolved.startsWith(this.allowedRoot)) {
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
