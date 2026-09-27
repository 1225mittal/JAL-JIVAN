import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const STORAGE_SETTINGS_KEY = 'jal_jivan_damage_workflow_config';
export const APP_SETTINGS_TABLE = 'app_settings';
export const CONFIG_ROW_ID = 'damage_workflow_config';

export const DEFAULT_DAMAGE_WORKFLOW_CONFIG = {
  // Step 1: Product Intake & Dual-Photo OCR (सामान दर्ज करने के नियम)
  intake: {
    require_front_photo: true,
    require_back_photo: true,
    allow_groq_ocr_autofill: true,
    require_mrp: true,
    require_expiry: true,
    require_batch: false,
    require_net_weight: false
  },
  // Step 2: Godown Rack Management (गोदाम रैक सेटिंग्स)
  rack: {
    enable_rack_allocation: true,
    require_rack_selection: false,
    show_rack_in_salesman_list: true
  },
  // Step 3: Company & Salesman Rules (कंपनी एवं सेल्समैन नियम)
  rules: {
    require_company_and_distributor: true,
    enable_visit_day_schedule: true,
    enable_return_window_rules: true,
    filter_today_visits_by_default: false
  },
  // Step 4: 3-Stage Settlement Pipeline (3-स्टेप वापसी प्रक्रिया)
  pipeline: {
    enable_step1_return_slip: true,
    require_slip_photo: true,
    enable_step2_driver_pickup: true,
    enable_step3_credit_received: true
  },
  // Hardware & Accessibility Options (हार्डवेयर एवं अन्य)
  hardware: {
    enable_external_usb_headcam: true,
    enable_voice_commands: true
  }
};

// Deep merge helper so all keys are guaranteed to exist even if schema evolves
function mergeConfigWithDefaults(savedConfig) {
  if (!savedConfig || typeof savedConfig !== 'object') {
    return { ...DEFAULT_DAMAGE_WORKFLOW_CONFIG };
  }
  const merged = {};
  for (const section of Object.keys(DEFAULT_DAMAGE_WORKFLOW_CONFIG)) {
    merged[section] = {
      ...DEFAULT_DAMAGE_WORKFLOW_CONFIG[section],
      ...(savedConfig[section] || {})
    };
  }
  return merged;
}

const AppSettingsContext = createContext({
  config: DEFAULT_DAMAGE_WORKFLOW_CONFIG,
  updateToggle: async () => {},
  isConfigEnabled: () => true,
  resetToDefaults: async () => {},
  loading: false,
  syncStatus: 'synced',
  refreshSettings: async () => {}
});

export function AppSettingsProvider({ children }) {
  // Initialize from localStorage for instant, zero-flicker load
  const [config, setConfig] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem(STORAGE_SETTINGS_KEY);
        if (local) {
          return mergeConfigWithDefaults(JSON.parse(local));
        }
      }
    } catch (e) {
      console.warn('Failed reading damage workflow settings from localStorage:', e);
    }
    return DEFAULT_DAMAGE_WORKFLOW_CONFIG;
  });

  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'saving' | 'local' | 'error'

  // Fetch settings from Supabase table `app_settings`
  const fetchRemoteSettings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSyncStatus('local');
      return;
    }

    try {
      setLoading(true);
      // Attempt querying with .or('id.eq...,key.eq...') to support both schema styles
      const { data, error } = await supabase
        .from(APP_SETTINGS_TABLE)
        .select('*')
        .or(`id.eq.${CONFIG_ROW_ID},key.eq.${CONFIG_ROW_ID}`)
        .maybeSingle();

      if (!error && data) {
        // Value might be stored in 'value', 'data', 'config', or 'settings'
        const rawValue = data.value || data.config || data.data || data.settings || data;
        const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        if (parsed && typeof parsed === 'object') {
          const merged = mergeConfigWithDefaults(parsed);
          setConfig(merged);
          try {
            localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(merged));
          } catch (e) {}
          setSyncStatus('synced');
          return;
        }
      }
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Supabase app_settings fetch notice (using cached/local config):', err.message);
      setSyncStatus('local');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRemoteSettings();
  }, [fetchRemoteSettings]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let channel = null;
    try {
      channel = supabase
        .channel('app-settings-workflow-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: APP_SETTINGS_TABLE },
          (payload) => {
            const row = payload.new || payload.old;
            if (row && (row.id === CONFIG_ROW_ID || row.key === CONFIG_ROW_ID)) {
              const rawVal = row.value || row.config || row.data || row.settings || row;
              const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
              if (parsed && typeof parsed === 'object') {
                const merged = mergeConfigWithDefaults(parsed);
                setConfig(merged);
                try {
                  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(merged));
                } catch (e) {}
                setSyncStatus('synced');
              }
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription notice for app_settings:', err.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Update a single toggle
  const updateToggle = useCallback(async (section, toggleKey, booleanValue) => {
    setConfig((prev) => {
      const updatedSection = {
        ...(prev[section] || {}),
        [toggleKey]: Boolean(booleanValue)
      };
      const newConfig = {
        ...prev,
        [section]: updatedSection
      };

      // Persist to localStorage immediately
      try {
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(newConfig));
      } catch (e) {}

      // Asynchronously sync to Supabase
      if (isSupabaseConfigured) {
        setSyncStatus('saving');
        (async () => {
          try {
            const payload = {
              id: CONFIG_ROW_ID,
              key: CONFIG_ROW_ID,
              value: newConfig,
              updated_at: new Date().toISOString()
            };
            const { error } = await supabase
              .from(APP_SETTINGS_TABLE)
              .upsert([payload]);
            if (error) {
              console.warn('Supabase upsert app_settings warning (saved locally):', error.message);
              setSyncStatus('local');
            } else {
              setSyncStatus('synced');
            }
          } catch (e) {
            console.warn('Failed syncing toggle to cloud (saved locally):', e.message);
            setSyncStatus('local');
          }
        })();
      }

      return newConfig;
    });
  }, []);

  // Reset to system defaults
  const resetToDefaults = useCallback(async () => {
    setConfig(DEFAULT_DAMAGE_WORKFLOW_CONFIG);
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(DEFAULT_DAMAGE_WORKFLOW_CONFIG));
    } catch (e) {}

    if (isSupabaseConfigured) {
      setSyncStatus('saving');
      try {
        await supabase
          .from(APP_SETTINGS_TABLE)
          .upsert([
            {
              id: CONFIG_ROW_ID,
              key: CONFIG_ROW_ID,
              value: DEFAULT_DAMAGE_WORKFLOW_CONFIG,
              updated_at: new Date().toISOString()
            }
          ]);
        setSyncStatus('synced');
      } catch (e) {
        setSyncStatus('local');
      }
    }
  }, []);

  // Helper function to check if a specific config key is enabled
  const isConfigEnabled = useCallback((section, key, defaultValue = true) => {
    if (!config || !config[section]) return defaultValue;
    const val = config[section][key];
    return typeof val === 'boolean' ? val : defaultValue;
  }, [config]);

  const contextValue = useMemo(() => ({
    config,
    updateToggle,
    isConfigEnabled,
    resetToDefaults,
    loading,
    syncStatus,
    refreshSettings: fetchRemoteSettings
  }), [config, updateToggle, isConfigEnabled, resetToDefaults, loading, syncStatus, fetchRemoteSettings]);

  return (
    <AppSettingsContext.Provider value={contextValue}>
      {children}
    </AppSettingsContext.Provider>
  );
}

// Hook for consuming app workflow settings
export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}

export default AppSettingsContext;
