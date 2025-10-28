import packageJson from '../package.json' with { type: 'json' };

type PackageMetadata = {
  name?: string;
  version?: string;
  description?: string;
};

const metadata = packageJson as PackageMetadata;

export const APP_NAME = metadata.name ?? 'logicmonitor-api-mcp';
export const APP_VERSION = metadata.version ?? '0.0.0';
export const APP_DESCRIPTION = metadata.description ?? '';

export const APP_INFO = Object.freeze({
  name: APP_NAME,
  version: APP_VERSION,
  description: APP_DESCRIPTION
});
