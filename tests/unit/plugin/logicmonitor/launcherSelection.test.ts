import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('logicmonitor plugin launcher selection', () => {
  const mcpConfigPath = path.resolve('plugins/logicmonitor/.mcp.json');
  const launchScriptPath = path.resolve('plugins/logicmonitor/scripts/launch.sh');

  function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'logicmonitor-launch-'));
  }

  function writeExecutable(filePath: string, content: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    fs.chmodSync(filePath, 0o755);
  }

  it('routes the plugin server through the launcher script', () => {
    expect(fs.existsSync(mcpConfigPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    expect(config.mcpServers?.logicmonitor?.args).toEqual(['./scripts/launch.sh']);
  });

  it('forces stdio and supports all declared modes', () => {
    expect(fs.existsSync(launchScriptPath)).toBe(true);

    const script = fs.readFileSync(launchScriptPath, 'utf8');
    expect(script).toContain('--stdio');
    expect(script).toContain('standard');
    expect(script).toContain('advanced-local');
    expect(script).toContain('auto');
  });

  it('runs the packaged stdio entrypoint in standard mode', () => {
    const fakeBin = makeTempDir();

    writeExecutable(
      path.join(fakeBin, 'node'),
      '#!/bin/zsh\nprintf "node:%s\\n" "$*"\n'
    );

    const result = spawnSync('zsh', [launchScriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOGICMONITOR_PLUGIN_MODE: 'standard',
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('node:');
    expect(result.stdout).toContain('dist/index.js --stdio');
  });

  it('selects advanced-local mode in auto when the checkout prerequisites exist', () => {
    const checkoutRoot = makeTempDir();
    writeExecutable(
      path.join(checkoutRoot, 'scripts/start-logicmonitor-mcp.sh'),
      '#!/bin/zsh\necho advanced-local-selected\n'
    );
    fs.mkdirSync(path.join(checkoutRoot, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(checkoutRoot, 'dist/index.js'), 'console.log("stub");\n', 'utf8');
    fs.writeFileSync(
      path.join(checkoutRoot, '.env.codex.local'),
      'LM_SESSION_LISTENER_BASE_URL=http://listener.test\n',
      'utf8'
    );

    const result = spawnSync('zsh', [launchScriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOGICMONITOR_PLUGIN_MODE: 'auto',
        LOGICMONITOR_PLUGIN_CHECKOUT_ROOT: checkoutRoot,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('advanced-local-selected');
  });
});
