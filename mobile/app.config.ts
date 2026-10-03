import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

/** Keep in sync with `config/androidRelease.ts` (checked by android-release-check). */
const ANDROID_APPLICATION_ID = 'com.mealplanatic.app';
const ANDROID_VERSION_CODE = 1;

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = (appJson.expo ?? config) as ExpoConfig;
  return {
    ...base,
    android: {
      ...base.android,
      package: ANDROID_APPLICATION_ID,
      versionCode: ANDROID_VERSION_CODE,
    },
  };
};
