import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Rótulo do dispositivo gravado em cada versão e em cada log (RNF-08),
// ex.: "android 15 · Pixel 8 · app 0.1.0" ou "web · Windows · app 0.1.0".
export function deviceLabel(): string {
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const parts =
    Platform.OS === 'web'
      ? ['web', Device.osName ?? navigatorPlatform()]
      : [Platform.OS, String(Platform.Version), Device.modelName ?? undefined];
  return [...parts.filter(Boolean), `app ${appVersion}`].join(' · ');
}

function navigatorPlatform(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.platform || undefined : undefined;
}
