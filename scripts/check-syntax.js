const { readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directories = ['client/js', 'server', 'test', 'scripts'];
let checked = 0;
let failed = false;

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      checkDirectory(filePath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', filePath], {
        stdio: 'inherit'
      });
      checked += 1;
      if (result.status !== 0) failed = true;
    }
  }
}

for (const directory of directories) {
  checkDirectory(path.join(root, directory));
}

if (checked === 0) {
  console.error('No JavaScript files were checked.');
  process.exitCode = 1;
} else if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed for ${checked} JavaScript files.`);
}
