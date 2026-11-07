import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LocalWorkspace } from '../../coding-engine/packages/project/src/workspace';
import { applyPatchTool } from '../../coding-engine/packages/tools/src/apply-patch';

/**
 * F-06 — la suppression doit être réelle et confinée.
 *
 * Deux exigences distinctes :
 *   1. `deleteFile` supprime effectivement, et échoue explicitement sinon ;
 *   2. le confinement est ancré sur la racine du workspace, jamais sur le chemin
 *      demandé : `..`, chemins absolus et symlinks sortants sont refusés.
 */

describe('F-06 — suppression réelle et confinement', () => {
  const baseDir = path.join(process.cwd(), 'data', 'test-f06');
  const root = path.join(baseDir, 'workspace');
  const outside = path.join(baseDir, 'outside');
  let workspace: LocalWorkspace;

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    workspace = new LocalWorkspace({ id: 'ws-f06', root });
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  describe('suppression réelle', () => {
    it('supprime le fichier et retourne une preuve observée', async () => {
      const target = path.join(root, 'obsolete.ts');
      fs.writeFileSync(target, 'export const obsolete = true;', 'utf8');

      const result = await applyPatchTool.execute(
        { filePath: 'obsolete.ts', diff: '', operation: 'delete' },
        { taskId: 'task-f06', workspace }
      );

      expect(result.success).toBe(true);
      expect(result.observed).toBe(true);
      expect(result.evidenceRef).toMatch(/deleteFile/);
      expect(fs.existsSync(target)).toBe(false);
    });

    it('échoue explicitement si le fichier est absent (aucun faux succès)', async () => {
      await expect(
        applyPatchTool.execute(
          { filePath: 'absent.ts', diff: '', operation: 'delete' },
          { taskId: 'task-f06', workspace }
        )
      ).rejects.toThrow(/file not found for deletion/);
    });

    it('refuse de revendiquer une suppression si le workspace ne sait pas supprimer', async () => {
      await expect(
        applyPatchTool.execute(
          { filePath: 'x.ts', diff: '', operation: 'delete' },
          { taskId: 'task-f06', workspace: { writeFile: async () => undefined } as any }
        )
      ).rejects.toThrow(/does not support deleteFile/);
    });

    it('ne supprime pas un répertoire (unlink échoue, pas de faux succès)', async () => {
      fs.mkdirSync(path.join(root, 'directory'));
      await expect(
        applyPatchTool.execute(
          { filePath: 'directory', diff: '', operation: 'delete' },
          { taskId: 'task-f06', workspace }
        )
      ).rejects.toThrow();
      expect(fs.existsSync(path.join(root, 'directory'))).toBe(true);
    });
  });

  describe('écriture vérifiée', () => {
    it('écrit puis vérifie l’existence du fichier', async () => {
      const result = await applyPatchTool.execute(
        { filePath: 'src/new.ts', diff: '+export const n = 1;', operation: 'create' },
        { taskId: 'task-f06', workspace }
      );

      expect(result.success).toBe(true);
      expect(result.observed).toBe(true);
      expect(fs.readFileSync(path.join(root, 'src', 'new.ts'), 'utf8')).toBe('export const n = 1;');
    });
  });

  describe('confinement', () => {
    it('refuse une traversée .. vers un fichier hors racine', async () => {
      const victim = path.join(outside, 'victim.ts');
      fs.writeFileSync(victim, 'keep me', 'utf8');

      await expect(workspace.deleteFile('../outside/victim.ts')).rejects.toThrow(
        /outside workspace root/
      );
      expect(fs.existsSync(victim)).toBe(true);
    });

    it('refuse un chemin absolu hors racine', async () => {
      const victim = path.join(outside, 'absolute.ts');
      fs.writeFileSync(victim, 'keep me', 'utf8');

      await expect(workspace.deleteFile(victim)).rejects.toThrow(/outside workspace root/);
      expect(fs.existsSync(victim)).toBe(true);
    });

    it('refuse une écriture hors racine', async () => {
      await expect(workspace.writeFile('../outside/written.ts', 'x')).rejects.toThrow(
        /outside workspace root/
      );
      expect(fs.existsSync(path.join(outside, 'written.ts'))).toBe(false);
    });

    it('refuse un symlink de répertoire qui sort de la racine', async () => {
      const link = path.join(root, 'escape');
      try {
        // Junction Windows : ne requiert pas de privilège administrateur.
        fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
      } catch {
        // Environnement sans support de symlink : on ne simule pas le test.
        return;
      }

      const victim = path.join(outside, 'via-link.ts');
      fs.writeFileSync(victim, 'keep me', 'utf8');

      await expect(workspace.deleteFile('escape/via-link.ts')).rejects.toThrow(
        /outside workspace root/
      );
      expect(fs.existsSync(victim)).toBe(true);
    });

    it('autorise un nom de fichier contenant .. sans traverser', async () => {
      const tricky = path.join(root, '..hidden.ts');
      fs.writeFileSync(tricky, 'ok', 'utf8');

      expect(await workspace.deleteFile('..hidden.ts')).toBe(true);
      expect(fs.existsSync(tricky)).toBe(false);
    });
  });
});
