import fs from 'node:fs';
import path from 'node:path';

describe('logicmonitor plugin scaffold', () => {
  const pluginRoot = path.resolve('plugins/logicmonitor');
  const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');

  it('has a valid plugin manifest', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.name).toBe('logicmonitor');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.skills).toBe('./skills/');
    expect(manifest.mcpServers).toBe('./.mcp.json');
    expect(manifest.interface?.displayName).toBe('LogicMonitor');
  });
});
