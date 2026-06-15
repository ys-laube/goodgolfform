import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

const forbiddenBackendProviderPackages = [
  '@apollo/client',
  '@aws-amplify/backend',
  '@aws-amplify/ui-react',
  '@firebase/app',
  '@supabase/supabase-js',
  'amplify',
  'aws-amplify',
  'firebase',
  'graphql',
  'pocketbase',
] as const;

type PackageManifest = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

const manifest = packageJson as PackageManifest;
const declaredPackages = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
};

describe('G003 shared room backend contract', () => {
  it('keeps the shared-room boundary free of hosted backend provider SDK coupling', () => {
    for (const packageName of forbiddenBackendProviderPackages) {
      expect(declaredPackages).not.toHaveProperty(packageName);
    }
  });
});
