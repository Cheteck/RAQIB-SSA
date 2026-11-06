import { describe, it, expect } from 'vitest';
import path from 'path';
import { PathGuard } from '../../packages/tool-gateway/src/PathGuard';

describe('PathGuard — confinement des chemins (MOSAIX-001 v2)', () => {
  const root = path.resolve(process.cwd(), 'target-repo');
  const guard = new PathGuard(root);

  it('autorise un chemin relatif à l’intérieur du root', () => {
    expect(guard.validate('src/index.ts').allowed).toBe(true);
    expect(guard.validate('.').allowed).toBe(true);
    expect(guard.validate('packages/core/package.json').allowed).toBe(true);
  });

  it('refuse un chemin absolu hors du root', () => {
    const outside = process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd';
    expect(guard.validate(outside).allowed).toBe(false);
  });

  it('refuse un répertoire frère partageant le préfixe du root (CWE-22)', () => {
    // Régression : `startsWith(root)` acceptait `target-repo-evil/...`
    expect(guard.validate('../target-repo-evil/secret.ts').allowed).toBe(false);
    expect(guard.validate('../target-repos/secret.ts').allowed).toBe(false);
  });

  it('refuse les traversées remontant hors du root', () => {
    expect(guard.validate('../../etc/passwd').allowed).toBe(false);
    expect(guard.validate('src/../../outside.txt').allowed).toBe(false);
  });

  it('refuse les fichiers sensibles même dans le root', () => {
    expect(guard.validate('.env').allowed).toBe(false);
    expect(guard.validate('.env.local').allowed).toBe(false);
    expect(guard.validate('config/credentials.json').allowed).toBe(false);
    expect(guard.validate('certs/server.pem').allowed).toBe(false);
    expect(guard.validate('keys/id.key').allowed).toBe(false);
  });

  it('accepte le root lui-même', () => {
    expect(guard.validate(root).allowed).toBe(true);
  });

  it('refuse un chemin qui remonte hors du root puis y revient par préfixe', () => {
    const sibling = path.join(root, '..', path.basename(root) + '-evil', 'x.txt');
    expect(guard.validate(sibling).allowed).toBe(false);
  });
});
