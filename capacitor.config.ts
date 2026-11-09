import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inventser.online.app',
  appName: 'Inventser Scanner',
  webDir: '.next',
  server: {
    // Remoto: carga tu sitio real con HTTPS (ideal para APK de escaneo)
    url: 'https://inventser.online',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    BarcodeScanner: {
      // iOS necesita mensaje; Android usa permiso CAMERA
    },
  },
};

export default config;
