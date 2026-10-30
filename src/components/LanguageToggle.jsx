'use client';
import { useState, useEffect } from 'react';

export default function LanguageToggle() {
  const [lang, setLang] = useState('es');

  useEffect(() => {
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('inventser_lang='));
    if (cookie) {
      const value = cookie.split('=')[1];
      if (value === 'es' || value === 'en') setLang(value);
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setLang(value);
    document.cookie = `inventser_lang=${value};path=/;max-age=31536000`;
    window.location.reload();
  };

  return (
    <select
      value={lang}
      onChange={handleChange}
      style={{
        padding: '4px 8px',
        border: '1px solid #ccc',
        borderRadius: 4,
        background: '#fff',
        fontSize: 13,
        cursor: 'pointer',
      }}
      aria-label="Seleccionar idioma"
    >
      <option value="es">Español</option>
      <option value="en">English</option>
    </select>
  );
}
