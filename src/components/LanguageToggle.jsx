'use client';
import { useEffect } from 'react';
import { setLanguageClient } from '@/lib/i18n';

export default function LanguageToggle() {
  const setLang = (lang) => {
    setLanguageClient(lang);
    // Save in cookie for persistence (SSR friendly)
    document.cookie = `inventser_lang=${lang};path=/;max-age=31536000`;
    // Reload to apply changes immediately (optional)
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
      <button 
        onClick={() => setLang('es')} 
        style={{ 
          padding: '4px 8px', 
          border: '1px solid #ccc', 
          borderRadius: 4, 
          background: '#f0f0f0', 
          cursor: 'pointer' 
        }}
      >
        ES
      </button>
      <button 
        onClick={() => setLang('en')} 
        style={{ 
          padding: '4px 8px', 
          border: '1px solid #ccc', 
          borderRadius: 4, 
          background: '#f0f0f0', 
          cursor: 'pointer' 
        }}
      >
        EN
      </button>
    </div>
  );
}