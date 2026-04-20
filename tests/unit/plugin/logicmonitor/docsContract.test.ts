import fs from 'node:fs';
import path from 'node:path';

describe('logicmonitor plugin docs contract', () => {
  const pluginReadmePath = path.resolve('plugins/logicmonitor/README.md');
  const rootReadmePath = path.resolve('README.md');
  const testsReadmePath = path.resolve('tests/README.md');

  it('documents both plugin modes and the advanced-local truth sources', () => {
    expect(fs.existsSync(pluginReadmePath)).toBe(true);

    const readme = fs.readFileSync(pluginReadmePath, 'utf8');

    expect(readme).toContain('Standard');
    expect(readme).toContain('Advanced local');
    expect(readme).toContain('scripts/start-logicmonitor-mcp.sh');
    expect(readme).toContain('LM_SESSION_LISTENER_BASE_URL');
  });

  it('keeps the top-level docs aligned with the plugin workflow', () => {
    const rootReadme = fs.readFileSync(rootReadmePath, 'utf8');
    const testsReadme = fs.readFileSync(testsReadmePath, 'utf8');

    expect(rootReadme).toContain('## Codex Plugin');
    expect(rootReadme).toContain('plugins/logicmonitor/');
    expect(rootReadme).toContain('Standard');
    expect(rootReadme).toContain('Advanced local');
    expect(rootReadme).toContain('source of truth');

    expect(testsReadme).toContain('## Plugin Contract Tests');
    expect(testsReadme).toContain('tests/unit/plugin/logicmonitor');
    expect(testsReadme).not.toContain('npm run test:watch');
    expect(testsReadme).not.toContain('npm run test:integration');
    expect(testsReadme).not.toContain('npm run test:coverage');
  });
});
