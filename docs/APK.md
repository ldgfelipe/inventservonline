# APK Inventser Scanner — Guía de build

## Arquitectura
Capacitor WebView que carga `https://inventser.online` + plugin de escaneo nativo **MLKit** (QR + EAN-13/EAN-8/Code128/Code39/UPC/ITF). Reutiliza la sesión JWT del web (localStorage `inventarios_sesion`).

## Requisitos
- Node 20+, Android Studio Hedgehog+, JDK 17
- Cuenta Google Developer si subirás a Play Store (sideload no lo necesita)

## Instalación
```bash
npm install
npm install @capacitor/core @capacitor/android @capacitor/cli @capacitor/app @capacitor/camera
npm install @capacitor-community/barcode-scanner
npx cap init --app-id com.inventser.online.app --app-name "Inventser Scanner"
npx cap add android
npx cap sync
# Edita capacitor.config.ts: server.url = https://inventser.online
npx cap open android
```

## Build
- En Android Studio: `Build > Build APK(s)` para debug
- Release: `Generate Signed Bundle / APK` con keystore propio. Guarda el `.jks` y contraseña.
- Sube el APK a `public/apk/inventser-scanner-v1.apk` y enlázalo en `/descargar`.

## Vinculación QR (pairing)
1. Admin en desktop va a `/scan` → recibe `pairing_code` (tabla `pairing_codes` a crear en migración, expira 5 min).
2. En APK, pantalla “Escanear para vincular” → abre scanner → llama a `POST /api/pairings { code }` con `Authorization: Bearer <jwt>` del admin (ya logueado en APK).
3. APK guarda `device_id` y `empresa_id` de la respuesta.

## Permisos requeridos (AndroidManifest)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

## Notas scanner
- El escaneo nativo trabaja offline (MLKit) y luego sincroniza al presionar guardar.
- En iOS se usa `@capacitor-community/barcode-scanner` con `NSCameraUsageDescription`. Requiere macOS + cuenta Apple Developer.
- La web sigue funcionando en navegadores: `BarcodeDetector` (Chrome) + `jsQR` fallback + foto.

## Uso
```bash
npm run build
npx cap sync android
npx cap open android
```
