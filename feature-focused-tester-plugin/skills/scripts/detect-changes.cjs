const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\x1b[36m%s\x1b[0m', '=== Change Impact Analyzer ===');

try {
  let diffOutput = '';
  try {
    diffOutput = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
  } catch (err) {
    console.warn('Could not run git diff. Listing src files...');
  }

  const files = diffOutput
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.startsWith('src/') && (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx')));

  if (files.length === 0) {
    console.log('\x1b[33m%s\x1b[0m', 'No uncommitted source code changes detected in src/.');
    console.log('To run target verification on all files, please specify a file manually.');
    process.exit(0);
  }

  console.log(`\nDetected ${files.length} changed source file(s):`);
  files.forEach(file => {
    console.log(` - \x1b[32m${file}\x1b[0m`);
  });

  console.log('\n--- Suggested Test Mapping (by layer) ---');

  files.forEach(file => {
    const filename = path.basename(file);
    const nameWithoutExt = path.parse(filename).name;
    const isRepository = file.includes('src/data/repositories/');
    const isHook = file.includes('src/data/hooks/');

    // L2 — data layer: repositories live under their own __tests__ folder.
    if (isRepository) {
      const repoTest = path.join('src', 'data', 'repositories', '__tests__', `${nameWithoutExt}.test.js`);
      if (fs.existsSync(repoTest)) {
        console.log(`L2 Repository test: \x1b[36m${repoTest}\x1b[0m (for ${file})`);
      } else {
        console.log(`\x1b[33mL2 Missing repository test:\x1b[0m create \x1b[35m${repoTest}\x1b[0m (mock adapter + client, test storage + api modes)`);
      }
      return;
    }

    // L1 / L2 — components and hooks map to tests/unit/<Name>.test.(jsx|js)
    const unitJsx = path.join('tests', 'unit', `${nameWithoutExt}.test.jsx`);
    const unitJs = path.join('tests', 'unit', `${nameWithoutExt}.test.js`);
    const layer = isHook ? 'L2 hook' : 'L1 UI';

    if (fs.existsSync(unitJsx)) {
      console.log(`${layer} test found: \x1b[36m${unitJsx}\x1b[0m (for ${file})`);
    } else if (fs.existsSync(unitJs)) {
      console.log(`${layer} test found: \x1b[36m${unitJs}\x1b[0m (for ${file})`);
    } else {
      console.log(`\x1b[33m${layer} missing test:\x1b[0m create \x1b[35m${unitJsx}\x1b[0m for ${filename}.`);
    }
  });

  console.log('\n\x1b[32m%s\x1b[0m', 'Suggested Test Commands:');
  // `vitest run --related` takes SPACE-separated source paths (not comma-separated).
  console.log(`Unit/Hook (targeted): pnpm vitest run --related ${files.join(' ')}`);
  console.log('Repository (L2):      pnpm vitest run src/data/repositories/__tests__/');
  console.log('Flow (L3 E2E):        pnpm test:e2e');

} catch (error) {
  console.error('Error running change detection:', error.message);
  process.exit(1);
}
