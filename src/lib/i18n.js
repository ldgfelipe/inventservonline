/* i18n simple sin dependencias externas.
   - translations: objeto con clave->texto para es y en.
   - setLanguage(l): cambia el idioma actual (también guarda en cookie).
   - t(key): devuelve la traducción o la propia clave si no existe.
*/
const translations = {
  es: {
    // Admin / Marketing
    admin: "Administrador",
    marketing: "Marketing",
    pixels: "Pixeles",
    freemium: "Freemium",
    resumen: "Resumen",
    campanas: "Campanas",
    trafico: "Trafico",
    correo: "Correo",
    bajas: "Bajas",
    // UI generic
    welcome: "Bienvenido",
    logout: "Cerrar sesión",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    create: "Crear",
    update: "Actualizar",
    // Layout / Pixeles
    head_code: "Código en <head> (JavaScript)",
    body_open_code: "Código después de abrir <body>",
    body_close_code: "Código antes de cerrar </body>",
    ga_measurement_id: "Google Analytics 4 (Measurement ID)",
    gtm_id: "Google Tag Manager (Container ID)",
    head_placeholder: "window.dataLayer = window.dataLayer || [];",
    body_open_placeholder: "",
    body_close_placeholder: "",
    // Table headers (admin)
    total_empresas: "Total empresas",
    freemium: "Freemium",
    pagadas: "Pagadas",
    score_promedio: "Score promedio",
    alta_probabilidad: "Alta probabilidad",
    // ... add more as needed
  },
  en: {
    admin: "Admin",
    marketing: "Marketing",
    pixels: "Pixels",
    freemium: "Freemium",
    resumen: "Summary",
    campanas: "Campaigns",
    trafico: "Traffic",
    correo: "Email",
    bajas: "Bounces",
    // UI generic
    welcome: "Welcome",
    logout: "Log out",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    update: "Update",
    // Layout / Pixeles
    head_code: "Code in <head> (JavaScript)",
    body_open_code: "Code after opening <body>",
    body_close_code: "Code before closing </body>",
    ga_measurement_id: "Google Analytics 4 (Measurement ID)",
    gtm_id: "Google Tag Manager (Container ID)",
    head_placeholder: "window.dataLayer = window.dataLayer || [];",
    body_open_placeholder: "",
    body_close_placeholder: "",
    // Table headers (admin)
    total_empresas: "Total companies",
    freemium: "Freemium",
    pagadas: "Paid",
    score_promedio: "Average score",
    alta_probabilidad: "High probability",
    // ... add more as needed
  },
};

let currentLang = 'es'; // default

export function setLanguage(l) {
  currentLang = l;
  // guardar en cookie para persistir entre recargas
  try {
    document.cookie = `inventser_lang=${l};path=/;max-age=31536000`;
  } catch (e) {
    // ignored in SSR
  }
}

export function t(key) {
  return translations[currentLang][key] || key;
}

export default { setLanguage, t, currentLang };