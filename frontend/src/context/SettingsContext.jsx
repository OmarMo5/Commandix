import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const SettingsContext = createContext(null);

const DEFAULTS = { appName: 'Commandix', logoUrl: null };

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings({ appName: data.app_name || DEFAULTS.appName, logoUrl: data.logo_url || null });
    } catch {
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshSettings(); }, []);

  useEffect(() => {
    document.title = settings.appName;
  }, [settings.appName]);

  return (
    <SettingsContext.Provider value={{ ...settings, refreshSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
