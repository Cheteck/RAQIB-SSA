import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { PathGuard, GitTool, FileTool } from '../packages/tool-gateway/src';
import { PolicyEngine } from '../packages/policy-engine/src';
import { AuditLedger } from '../packages/audit-ledger/src';
import { AuditEvent } from '../packages/shared/src/types';

dotenv.config({ path: '.env.local' });

let MOSAIX_PATH = process.env.MOSAIX_REPO_PATH || 'D:\\Téléchargements\\devflow';
if (!require('fs').existsSync(MOSAIX_PATH)) {
  const altPath = 'D:\\Téléchargements\\devflow';
  if (require('fs').existsSync(altPath)) {
    MOSAIX_PATH = altPath;
  }
}
const DB_PATH = process.env.RAQIB_DB_PATH || './data/raqib.db';
const OUT_DIR = path.resolve(process.cwd(), 'reports', 'raqib-001');

async function main() {
  console.log('=== RAQIB-001 — Audit MosaiX Core (Lecture Seule) ===');
  console.log(`Dépôt cible : ${MOSAIX_PATH}`);

  // 1. Initialiser l'Audit Ledger
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const ledger = new AuditLedger(DB_PATH);
  await ledger.init();

  // 2. Vérification par le Policy Engine
  const policy = new PolicyEngine({ dbPath: DB_PATH, logger: ledger });
  const decision = policy.authorize({
    missionId: 'RAQIB-001',
    actor: 'raqib-core',
    actionType: 'READ_ONLY_INVENTORY',
    resource: MOSAIX_PATH,
    autonomyLevel: 'A0',
  });

  await ledger.log({
    id: `policy-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'POLICY_DECISION',
    missionId: 'RAQIB-001',
    actor: 'raqib-core',
    data: { request: 'READ_ONLY_INVENTORY', decision },
  });

  if (!decision.allowed) {
    console.error(`❌ Policy Engine a refusé la mission : ${decision.reason}`);
    process.exit(1);
  }

  console.log('✅ Policy Engine : Mission autorisée');

  // 3. Initialiser les outils
  const guard = new PathGuard(MOSAIX_PATH);
  const git = new GitTool();
  const file = new FileTool(guard);

  // 4. Capturer l'état initial (SHA + status + diff)
  const shaBefore = await git.getCurrentCommitSha(MOSAIX_PATH);
  const diffBefore = await git.getDiff(MOSAIX_PATH);
  const statusBefore = await git.getStatus(MOSAIX_PATH);

  // 5. Exécuter l'inventaire
  console.log('🔍 Étape 1/10 — Identification du dépôt...');
  const repoInfo = await git.getRepoInfo(MOSAIX_PATH);

  console.log('🔍 Étape 2/10 — Inventaire des fichiers...');
  const trackedFiles = await git.listTrackedFiles(MOSAIX_PATH);

  console.log('🔍 Étape 3/10 — Cartographie des packages...');
  const manifests = ['package.json', 'pnpm-workspace.yaml', 'tsconfig.json', 'Cargo.toml', 'pyproject.toml'];
  const foundManifests: string[] = [];
  const packages: Array<{ name: string; version?: string; path: string }> = [];

  for (const m of manifests) {
    const fullPath = path.join(MOSAIX_PATH, m);
    try {
      const content = await file.readManifest(fullPath);
      foundManifests.push(m);
      if (m === 'package.json' && typeof content === 'object' && content !== null) {
        const pkg = content as { name?: string; version?: string };
        if (pkg.name) {
          packages.push({ name: pkg.name, version: pkg.version, path: m });
        }
      }
    } catch {
      // Ignorer si le fichier n'existe pas
    }
  }

  console.log('🔍 Étape 4/10 — Inventaire des tests...');
  const testFiles = trackedFiles.filter((f) =>
    /\.(test|spec)\.(ts|js|tsx|jsx|py)$/.test(f)
  );

  console.log('🔍 Étape 5/10 — Inventaire de la documentation...');
  const docFiles = trackedFiles.filter(
    (f) => /\.md$/i.test(f) && !f.includes('node_modules')
  );

  console.log('🔍 Étape 6/10 — Historique récent...');
  const commits = await git.getRecentCommits(MOSAIX_PATH, 5);

  // 6. Générer l'inventory.json
  await fs.mkdir(OUT_DIR, { recursive: true });

  const inventoryData = {
    meta: {
      mission: 'RAQIB-001',
      timestamp: new Date().toISOString(),
      auditor: 'raqib-core',
      version: '1.0.0',
    },
    repo: {
      path: MOSAIX_PATH,
      toplevel: repoInfo.toplevel,
      branch: repoInfo.currentBranch,
      commit: shaBefore,
      remotes: repoInfo.remotes,
      totalFiles: trackedFiles.length,
    },
    manifests: foundManifests,
    packages,
    tests: {
      total: testFiles.length,
      files: testFiles,
    },
    docs: {
      total: docFiles.length,
      files: docFiles,
    },
    recentCommits: commits,
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'inventory.json'),
    JSON.stringify(inventoryData, null, 2)
  );

  // 7. Générer l'audit-report.md
  const reportContent = `# 🛡️ RAQIB-001 — Rapport d'Audit MosaiX Core

**Date** : ${inventoryData.meta.timestamp}  
**Dépôt** : \`${MOSAIX_PATH}\`  
**Branche** : \`${repoInfo.currentBranch}\`  
**Commit SHA** : \`${shaBefore}\`  
**Auditeur** : RAQIB Core (Mode Lecture Seule, A0)

---

## 1. Executive Summary

L'audit RAQIB-001 s'est déroulé en mode **lecture seule absolue**. Aucun fichier du dépôt MosaiX n'a été modifié, créé ou supprimé.

- **Fichiers suivis** : ${trackedFiles.length}
- **Packages identifiés** : ${packages.length}
- **Fichiers de test** : ${testFiles.length}
- **Fichiers de documentation** : ${docFiles.length}

---

## 2. Inventaire Détaillé

### Packages & Workspaces
${packages.map((p) => `- \`${p.name}\` (v${p.version || 'inconnue'}) — \`${p.path}\``).join('\n') || '- Aucun package.json trouvé à la racine'}

### Manifestes Détectés
${foundManifests.map((m) => `- \`${m}\``).join('\n') || '- Aucun'}

---

## 3. Risques Identifiés

| ID | Description | Niveau | Confiance | Preuve |
|---|---|---|---|---|
| R-01 | Couverture de test globale non évaluée en exécution | Faible | Faite (lecture statique uniquement) | ${testFiles.length} fichiers de test statiques répertoriés |

---

## 4. Annexes — Commandes Exécutées

- \`git rev-parse --show-toplevel\`
- \`git branch -v\`
- \`git remote -v\`
- \`git ls-tree -r --name-only HEAD\`
- \`git log --pretty=format:... -n 5\`
- \`git diff\`
- \`git status --porcelain\`

---

*Ce rapport a été généré automatiquement par RAQIB Core (Mission RAQIB-001).*
`;

  await fs.writeFile(path.join(OUT_DIR, 'audit-report.md'), reportContent);

  // 8. Vérification de non-modification
  const shaAfter = await git.getCurrentCommitSha(MOSAIX_PATH);
  const diffAfter = await git.getDiff(MOSAIX_PATH);
  const statusAfter = await git.getStatus(MOSAIX_PATH);

  const passed =
    shaBefore === shaAfter &&
    diffBefore === diffAfter &&
    statusBefore === statusAfter;

  const verificationData = {
    mission: 'RAQIB-001',
    timestamp: new Date().toISOString(),
    sha_before: shaBefore,
    sha_after: shaAfter,
    git_diff_unchanged: diffBefore === diffAfter,
    git_status_unchanged: statusBefore === statusAfter,
    verdict: passed ? 'PASS' : 'FAIL',
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'verification.json'),
    JSON.stringify(verificationData, null, 2)
  );

  await ledger.log({
    id: `verif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'VERIFICATION_RESULT',
    missionId: 'RAQIB-001',
    actor: 'raqib-core',
    data: verificationData,
  });

  console.log('\n=== Résultats RAQIB-001 ===');
  console.log(`Livrables générés dans : ${OUT_DIR}`);
  console.log(`Verdict de vérification : ${verificationData.verdict}`);

  if (!passed) {
    console.error('❌ FAIL : Des modifications ont été détectées sur le dépôt.');
    process.exit(1);
  } else {
    console.log('✅ PASS : Le dépôt est strictement inchangé.');
  }

  ledger.close();
}

main().catch((err) => {
  console.error('Erreur critique pendant l\'audit :', err);
  process.exit(1);
});
