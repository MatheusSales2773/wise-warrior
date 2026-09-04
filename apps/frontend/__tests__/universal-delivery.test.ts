import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('universal delivery contract', () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'wise-m1-bundles-'));

  afterAll(() => rmSync(outputDirectory, { force: true, recursive: true }));

  it('exports JavaScript bundles for every supported platform', () => {
    execFileSync('npm', ['run', 'export:bundles', '--', '--output-dir', outputDirectory], {
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        EXPO_PUBLIC_API_URL: 'https://api.test.invalid/v1',
      },
      stdio: 'pipe',
    });

    for (const platform of ['web', 'ios', 'android']) {
      expect(readdirSync(join(outputDirectory, '_expo/static/js', platform))).not.toHaveLength(0);
    }
  }, 30_000);
});
