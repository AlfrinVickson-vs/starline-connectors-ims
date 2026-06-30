import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../api/apiService';

const CompanyContext = createContext(null);

export const CompanyProvider = ({ children }) => {
  const [companySettings, setCompanySettings] = useState({
    company_name: 'Starline Connectors',
    company_logo: null
  });

  const fetchPublicSettings = useCallback(async () => {
    try {
      const { data } = await settingsAPI.getPublic();
      if (data.success && data.settings) {
        setCompanySettings(data.settings);
      }
    } catch {
      // silent fail for public settings
    }
  }, []);

  useEffect(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  // Expose a method to force refresh for when Settings.jsx saves
  const refreshCompanySettings = useCallback(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  return (
    <CompanyContext.Provider value={{ ...companySettings, refreshCompanySettings }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
};
