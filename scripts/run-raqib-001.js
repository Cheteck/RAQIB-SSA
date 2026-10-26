require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoPath = process.env.MOSAIX_REPO_PATH || 'D:\\Téléchargements\\devflow';
const outDir = path.join(__dirname, '..', 'reports', 'raqib-001');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: repoPath, encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('RAQIB-001 - Audit en lecture seule');
  console.log('Repo:', repoPath);
  
  fs.mkdirSync(outDir, { recursive: true });
  
  const beforeDiff = run('git diff');
  const beforeStatus = run('git status --short');
  
  const inventory = {
    mission: 'RAQIB-001',
    timestamp: new Date().toISOString(),
    repo: {
      path: repoPath,
      toplevel: run('git rev-parse --show-toplevel'),
      branch: run('git branch --show-current'),
      commit: run('git rev-parse HEAD'),
      remote: run('git remote -v')
    },
    files: {
      tracked: run('git ls-tree -r --name-only HEAD')?.split('\n').filter(Boolean) || []
    },
    manifests: [],
    packages: [],
    tests: [],
    docs: []
  };
  
  // Find manifests
  const manifests = ['package.json', 'tsconfig.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
  for (const m of manifests) {
    if (fs.existsSync(path.join(repoPath, m))) {
      inventory.manifests.push(m);
      try {
        if (m === 'package.json') {
          const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, m), 'utf8'));
          inventory.packages.push({ name: pkg.name, version: pkg.version, type: 'package.json' });
        }
      } catch(e) {}
    }
  }
  
  // Find tests and docs
  for (const f of inventory.files.tracked) {
    if (f.match(/\.(test|spec)\.(ts|js|tsx|jsx|py)$/)) inventory.tests.push(f);
    if (f.match(/\.md$/i) && !f.includes('node_modules')) inventory.docs.push(f);
  }
  
  fs.writeFileSync(path.join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2));
  
  // Verification
  const afterDiff = run('git diff');
  const afterStatus = run('git status --short');
  
  const verification = {
    mission: 'RAQIB-001',
    timestamp: new Date().toISOString(),
    before: { diff: beforeDiff, status: beforeStatus },
    after: { diff: afterDiff, status: afterStatus },
    modified: (beforeDiff !== afterDiff) || (beforeStatus !== afterStatus),
    passed: (beforeDiff === afterDiff) && (beforeStatus === afterStatus)
  };
  
  fs.writeFileSync(path.join(outDir, 'verification.json'), JSON.stringify(verification, null, 2));
  
  // Report
  const report = `# RAQIB-001 - Audit MosaiX/Devflow (Lecture Seule)

**Date**: ${inventory.timestamp}  
**Repo**: ${inventory.repo.path}  
**Branche**: ${inventory.repo.branch}  
**Commit**: ${inventory.repo.commit}

## Résumé
- Fichiers suivis: ${inventory.files.tracked.length}
- Manifests: ${inventory.manifests.join(', ') || 'aucun'}
- Fichiers de test: ${inventory.tests.length}
- Fichiers documentation: ${inventory.docs.length}

## Manifests trouvés
${inventory.manifests.map(m => '- ' + m).join('\n') || '- Aucun'}

## Packages
${inventory.packages.map(p => '- ' + p.name + (p.version ? ' (' + p.version + ')' : '')).join('\n') || '- Aucun'}

## Vérification non-modification
- Avant: diff=${beforeDiff ? 'YES' : 'NO'}, status=${beforeStatus ? 'YES' : 'NO'}
- Après: diff=${afterDiff ? 'YES' : 'NO'}, status=${afterStatus ? 'YES' : 'NO'}
- **Résultat**: ${verification.passed ? '✅ DÉPÔT INCHANGÉ' : '❌ MODIFICATION DÉTECTÉE'}

## Limites
- Audit en lecture seule uniquement
- Analyse basique (inventaire + manifestes)
- Pas d'analyse approfondie du code
`;
  
  fs.writeFileSync(path.join(outDir, 'audit-report.md'), report);
  
  console.log('\n✅ Audit terminé');
  console.log('Rapports dans:', outDir);
  console.log('Vérification:', verification.passed ? 'PASS' : 'FAIL');
}

main().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
