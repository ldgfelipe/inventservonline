'use client';
import { useEffect } from 'react';

export default function GoogleTranslate() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);

    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'es',
          includedLanguages: 'en,fr,pt',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        }, 'google_translate_element');
      }
    };
  }, []);

  return (
    <div id="google_translate_element" style={{ position: 'fixed', bottom: '10px', right: '10px', zIndex: 9999 }} />
  );
}
