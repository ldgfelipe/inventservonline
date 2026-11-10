# 📱 APK Inventser Scanner — Guía de build

Este documento explica cómo generar el APK del escáner de códigos para distribución interna (sideload).

---

## 📦 Requisitos previos

| Herramienta | Versión | Instalación |
|-------------|---------|-------------|
| Node.js | 20+ | `nvm install 20 && nvm use 20` |
| npm | 10+ | `npm install -g npm` |
| Android Studio | Arctic Fox (2020.3.1)+ | [Descargar](https://developer.android.com/studio) |
| JDK | 17 | Incluido en Android Studio |
| Keystore (para release) | - | `keytool -genkey -v -keystore keystore.jks -alias inventser -keyalg RSA -keysize 2048 -validity 10000` |

---

## 🚀 Build paso a paso

### 1. Preparar proyecto

```bash
# Desde la raíz del repo
git checkout main
git pull origin main

# Instalar dependencias web (solo si faltan)
npm install

# Verificar build web
npm run build
```

### 2. Instalar Capacitor

```bash
# Versiones compatibles (Capacitor 5.x)
npm install --save-dev \
  @capacitor/cli@5.0.4 \
  @capacitor/core@5.0.4 \
  @capacitor/android@5.1.0 \
  @capacitor/app
# Opcional: cámara (no necesaria para nuestro scanner web)
# npm install @capacitor/camera
```

### 3. Inicializar app Android

```bash
# Inicializar Capacitor en el proyecto
npx cap init "Inventser Scanner" com.inventser.online.app --web-dir .next

# Añadir plataforma Android
npx cap add android

# Sincronizar assets HTML/CSS/JS
npx cap copy

# Actualizar configuración nativa
npx cap sync
```

### 4. Modificar `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inventser.online.app',
  appName: 'Inventser Scanner',
  webDir: '.next',
  bundledWebRuntime: false,
  server: {
    // App carga el sitio web online (requiere HTTPS)
    url: 'https://inventser.online',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureSystemVisibility: true,
  },
  plugins: {
    BarcodeScanner: {
      // N/A - usamos el community plugin en Android
    },
  },
};

export default config;
```

### 5. Agregar plugin de escaneo

```bash
npm install @capacitor-community/barcode-scanner
npx cap sync
```

### 6. Generar APK (Desarrollo)

1. Abrir Android Studio:
   ```bash
   npx cap open android
   ```

2. En Android Studio:
   - **Build → Build APK(s)**
   - Ubicación: `app/build/outputs/apk/debug/app-debug.apk`

### 7. Generar APK (Release)

1. Crear keystore si no existe:
   ```bash
   keytool -genkey -v -keystore keystore.jks -alias inventser -keyalg RSA -keysize 2048 -validity 10000
   mv keystore.jks android/app/
   ```

2. En `android/settings.gradle` agregar:
   ```gradle
   storeFile file('app/keystore.jks')
   storePassword 'TU_PASSWORD'
   keyAlias 'inventser'
   keyPassword 'TU_PASSWORD'
   ```

3. En Android Studio:
   - **Build → Generate Signed Bundle/APK**
   - Seleccionar APK → `app-release.apk`

### 8. Subir a Cloudflare R2

```bash
# Crear bucket en Cloudflare Dashboard → R2 → "app-assets"

# Usar wrangler (instalar si no)
npm install -g wrangler

# Crear r2-binding (opcional desde dashboard)

# Subir APK
wrangler r2 bucket put inventser-assets
wrangler r2 object put inventser-assets/apk/inventser-scanner-v1.apk < app-release.apk

# Obtener URL pública (R2 expone URL pública)
# Ejemplo: https://pub-xxxxxxxx.r2.cloudflarestorage.com/apk/inventser-scanner-v1.apk
```

---

## 📱 Pantalla de vinculación (pairing)

El flujo de emparejamiento permite asociar el móvil con la cuenta del usuario:

1. Admin visita `/scan` → genera código único de 8 dígitos (tabla `pairing_codes`, expiración 5 min)
2. Móvil: pantalla "Vincular mi cuenta" → escanea QR del desktop
3. App llama a `POST /api/pairings` con `{ code, token }`
4. Backend valida, guarda `device_id`, `empresa_id`, `usuario_id`, `ultimo_visto`
5. App sincroniza: historial de escaneos, creación de productos

### Endpoint `POST /api/pairings`

```typescript
// Body: { code: string, token: string }
// Response: { ok: true, empresa_id, usuario_id, dispositivo_id }
// Errores: 400 (código inválido), 401 (token inválido), 409 (ya vinculado)
```

---

## 🔧 Permisos necesarios

### AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-feature android:name="android.hardware.camera" android:required="true"/>
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false"/>

<application
    android:usesCleartextTraffic="false">
    <!-- Necesario para WebView desde HTTPS -->
</application>
```

---

## 📄 Enlaces de descarga

| Variable | Valor |
|----------|-------|
| Web (desktop) | `https://inventser.online/scan` |
| QR / Link | `we.me/#scan` o `https://inventser.online/scan` |
| APK Cloudflare | `https://pub-{id}.r2.cloudflarestorage.com/apk/inventser-scanner-v1.apk` |
| Fallback web | Si no instala, abre `/scan` en el navegador del móvil |

---

## 🛠️ Comandos útiles

```bash
# Ver logs de Android
npx cap open android    # luego View → Log Files

# Limpiar build
rm -rf android/app/build

# Sincronizar cambios web
npx cap copy
npx cap sync

# Verificar permisos
adb shell pm list permissions -g -d | grep CAMERA
```

---

## 🚨 Solución de problemas

| Síntoma | Posible causa | Solución |
|---------|---------------|----------|
| Cámara negra | Permiso denegado | Ir a Ajustes → App → Permisos → Cámara |
| WebView en blanco | `http://` en vez de `https://` | Asegurar que `server.url` usa HTTPS |
| BarcodeScanner no funciona | Plugin no sincronizado | `npx cap sync android` |
| Error de firma APK | Keystore incorrecto | Regenerate o usar release keystore |

---

## 📚 Referencias

- [Capacitor Docs](https://capacitorjs.com/docs)
- [@capacitor-community/barcode-scanner](https://github.com/capawesome-team/capacitor-community-barcode-scanner)
- [ML Kit Barcode Scanning](https://developers.google.com/ml-kit/vision/barcode-scanning)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)

---

## ✅ Check-list para desarrollo

- [ ] Verificar `capacitor.config.ts` con URL correcta
- [ ] Ejecutar `npx cap copy && npx cap sync`
- [ ] Abrir Android Studio y compilar debug
- [ ] Probar escáner QR y códigos de barras en móvil
- [ ] Probar flujo de pairing (desktop → móvil)
- [ ] Generar APK de release
- [ ] Subir a Cloudflare R2
- [ ] Probar descarga directa en móvil real
- [ ] Crear ícono enlace en landing: "Descargar app móvil →"`