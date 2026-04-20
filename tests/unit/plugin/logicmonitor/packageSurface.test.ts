import fs from 'node:fs';
import path from 'node:path';

describe('logicmonitor plugin package surface', () => {
  const packageJsonPath = path.resolve('package.json');

  it('publishes the plugin tree alongside the server build output', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.files).toContain('dist/**/*');
    expect(packageJson.files).toContain('plugins/logicmonitor/**/*');
  });
});
