import appConfig from '../app.json';
import packageManifest from '../package.json';

describe('Android local development contract', () => {
  it('exposes a stable Android application id', () => {
    expect(appConfig.expo.android.package).toBe('dev.guilhermeluan.wisewarrior');
  });

  it('provides the Expo local Android compilation command', () => {
    expect(packageManifest.scripts.android).toBe('expo run:android');
  });

  it('configures SecureStore backup exclusion without enabling global cleartext', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-secure-store',
      { configureAndroidBackup: true },
    ]);
    expect(appConfig.expo.android).not.toHaveProperty('usesCleartextTraffic', true);
  });
});
