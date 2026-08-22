import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';

export const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language || 'en';

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const handleLanguageChange = async (langCode) => {
    try {
      await i18n.changeLanguage(langCode);
      localStorage.setItem('language', langCode);

      // Persist language selection to backend profile if token exists
      const token = localStorage.getItem('token');
      if (token) {
        fetch('/api/v1/users/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredLanguage: langCode }),
        }).catch((err) => console.warn('Language profile sync warning:', err));
      }
    } catch (err) {
      console.error('Error changing system language:', err);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-1.5 shadow-md">
      <div className="flex items-center gap-1 px-2.5 text-slate-400 text-xs font-semibold">
        <Globe className="w-4 h-4 text-indigo-400" />
        <span className="hidden sm:inline">{t('app.language', 'Language')}:</span>
      </div>

      <div className="flex items-center gap-1">
        {languages.map((lang) => {
          const isActive = currentLang.startsWith(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-indigo-600 border-indigo-400/50 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              aria-label={`Switch language to ${lang.name}`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {isActive && <Check className="w-3 h-3 text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
