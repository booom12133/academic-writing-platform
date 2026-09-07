'use strict';

const fs = require('node:fs');
const path = require('node:path');

function assertProductionToolingPinned(root = path.resolve(__dirname, '..')) {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  const buildScript = fs.readFileSync(
    path.join(root, 'scripts', 'build.sh'),
    'utf8',
  );
  const violations = [];
  if (packageJson.scripts?.postinstall) {
    violations.push(
      'package.json postinstall must not perform an implicit network install',
    );
  }
  if (/@latest\b/u.test(buildScript)) {
    violations.push('scripts/build.sh contains a floating @latest tool');
  }
  if (violations.length > 0) throw new Error(violations.join('; '));
}

if (require.main === module) {
  try {
    assertProductionToolingPinned();
    console.log('Production reproducible-build tooling PASS.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { assertProductionToolingPinned };
