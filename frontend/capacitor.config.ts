import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bangladeshcitizenreport.app',
  appName: 'Nirapotta',
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://nirapotta-citizen-platform.vercel.app',
    cleartext: Boolean(process.env.CAPACITOR_SERVER_URL && process.env.CAPACITOR_SERVER_URL.startsWith('http://')),
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
