import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bangladeshcitizenreport.app',
  appName: 'Bangladesh Citizen Report',
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://frontend-ten-delta-a5irgspmf7.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
