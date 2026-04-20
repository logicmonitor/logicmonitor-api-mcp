import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('logicmonitor plugin doctor workflow', () => {
  const doctorPath = path.resolve('plugins/logicmonitor/scripts/doctor.sh');

  function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'logicmonitor-doctor-'));
  }

  function writeExecutable(filePath: string, content: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    fs.chmodSync(filePath, 0o755);
  }

  it('exists and is executable', () => {
    expect(fs.existsSync(doctorPath)).toBe(true);

    const mode = fs.statSync(doctorPath).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it('checks standard and advanced-local prerequisites', () => {
    expect(fs.existsSync(doctorPath)).toBe(true);

    const doctor = fs.readFileSync(doctorPath, 'utf8');

    expect(doctor).toContain('LM_ACCOUNT');
    expect(doctor).toContain('LM_BEARER_TOKEN');
    expect(doctor).toContain('.env.codex.local');
    expect(doctor).toContain('LM_SESSION_LISTENER_BASE_URL');
    expect(doctor).toContain('/api/v1/portals');
  });

  it('succeeds in standard mode when bearer-token prerequisites are present', () => {
    const result = spawnSync('zsh', [doctorPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOGICMONITOR_PLUGIN_MODE: 'standard',
        LM_ACCOUNT: 'test-account',
        LM_BEARER_TOKEN: 'test-token',
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[ok] mode: standard');
    expect(result.stdout).toContain('[ok] LM_ACCOUNT is set');
    expect(result.stdout).toContain('[ok] LM_BEARER_TOKEN is set');
  });

  it('warns when portal discovery returns None in advanced-local mode', () => {
    const checkoutRoot = makeTempDir();
    const fakeBin = makeTempDir();
    const envFile = path.join(checkoutRoot, '.env.codex.local');

    writeExecutable(path.join(checkoutRoot, 'scripts/start-logicmonitor-mcp.sh'), '#!/bin/zsh\nexit 0\n');
    writeExecutable(path.join(fakeBin, 'curl'), '#!/bin/zsh\necho None\n');
    fs.mkdirSync(path.join(checkoutRoot, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(checkoutRoot, 'dist/index.js'), 'console.log("stub");\n', 'utf8');
    fs.writeFileSync(envFile, 'LM_SESSION_LISTENER_BASE_URL=http://listener.test\n', 'utf8');

    const result = spawnSync('zsh', [doctorPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOGICMONITOR_PLUGIN_MODE: 'advanced-local',
        LOGICMONITOR_PLUGIN_CHECKOUT_ROOT: checkoutRoot,
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[ok] portal discovery endpoint responded: /api/v1/portals');
    expect(result.stdout).toContain('[warn] portal discovery returned None');
  });

  it('fails cleanly when portal discovery is unreachable in advanced-local mode', () => {
    const checkoutRoot = makeTempDir();
    const fakeBin = makeTempDir();
    const envFile = path.join(checkoutRoot, '.env.codex.local');

    writeExecutable(path.join(checkoutRoot, 'scripts/start-logicmonitor-mcp.sh'), '#!/bin/zsh\nexit 0\n');
    writeExecutable(
      path.join(fakeBin, 'curl'),
      '#!/bin/zsh\necho connection refused >&2\nexit 22\n'
    );
    fs.mkdirSync(path.join(checkoutRoot, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(checkoutRoot, 'dist/index.js'), 'console.log("stub");\n', 'utf8');
    fs.writeFileSync(envFile, 'LM_SESSION_LISTENER_BASE_URL=http://listener.test\n', 'utf8');

    const result = spawnSync('zsh', [doctorPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOGICMONITOR_PLUGIN_MODE: 'advanced-local',
        LOGICMONITOR_PLUGIN_CHECKOUT_ROOT: checkoutRoot,
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[fail] portal discovery request failed: connection refused');
  });
});
