import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import appConfig from '../app.json';
import packageManifest from '../package.json';

describe('Android local development contract', () => {
  it('exposes a stable Android application id', () => {
    expect(appConfig.expo.android.package).toBe('dev.guilhermeluan.wisewarrior');
  });

  it('regenerates Android from app config before compiling it', () => {
    expect(packageManifest.scripts.android).toBe(
      'npm run prebuild:android && expo run:android',
    );
    expect(packageManifest.scripts['prebuild:android']).toBe(
      'expo prebuild --platform android --clean',
    );
  });

  it('configures SecureStore backup exclusion without enabling global cleartext', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-secure-store',
      { configureAndroidBackup: true },
    ]);
    expect(appConfig.expo.android).not.toHaveProperty('usesCleartextTraffic', true);
  });

  it('generates Android backup rules that exclude SecureStore credentials', () => {
    const projectDirectory = mkdtempSync(join(tmpdir(), 'wise-android-prebuild-'));

    try {
      cpSync(join(__dirname, '../app.json'), join(projectDirectory, 'app.json'));
      cpSync(join(__dirname, '../package.json'), join(projectDirectory, 'package.json'));
      cpSync(join(__dirname, '../assets'), join(projectDirectory, 'assets'), { recursive: true });
      symlinkSync(join(__dirname, '../../../node_modules'), join(projectDirectory, 'node_modules'));

      execFileSync(
        join(__dirname, '../../../node_modules/.bin/expo'),
        ['prebuild', '--platform', 'android', '--clean', '--no-install'],
        {
          cwd: projectDirectory,
          env: { ...process.env, EXPO_NO_GIT_STATUS: '1' },
          stdio: 'pipe',
        },
      );

      const manifest = readFileSync(
        join(projectDirectory, 'android/app/src/main/AndroidManifest.xml'),
        'utf8',
      );
      const backupRules = readFileSync(
        join(
          projectDirectory,
          'node_modules/expo-secure-store/android/src/main/res/xml/secure_store_backup_rules.xml',
        ),
        'utf8',
      );
      const extractionRules = readFileSync(
        join(
          projectDirectory,
          'node_modules/expo-secure-store/android/src/main/res/xml/secure_store_data_extraction_rules.xml',
        ),
        'utf8',
      );

      expect(manifest).toContain('android:fullBackupContent="@xml/secure_store_backup_rules"');
      expect(manifest).toContain(
        'android:dataExtractionRules="@xml/secure_store_data_extraction_rules"',
      );
      expect(backupRules).toContain('<exclude domain="sharedpref" path="SecureStore"/>');
      expect(extractionRules.match(/path="SecureStore"/g)).toHaveLength(2);
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});
