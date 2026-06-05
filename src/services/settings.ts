export interface AppSettings {
  threadCount: number;
  autoSave: boolean;
  ignoreMemoryWarning: boolean;
}

const STORAGE_KEY = 'ncm_pwa_settings';

const defaultSettings: AppSettings = {
  threadCount: 4,
  autoSave: true,
  ignoreMemoryWarning: false,
};

export const settingsService = {
  get(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    try {
      const parsed = JSON.parse(raw);
      // Ensure values are correct types
      return {
        threadCount: typeof parsed.threadCount === 'number' ? Math.max(1, Math.min(16, parsed.threadCount)) : defaultSettings.threadCount,
        autoSave: typeof parsed.autoSave === 'boolean' ? parsed.autoSave : defaultSettings.autoSave,
        ignoreMemoryWarning: typeof parsed.ignoreMemoryWarning === 'boolean' ? parsed.ignoreMemoryWarning : defaultSettings.ignoreMemoryWarning,
      };
    } catch {
      return defaultSettings;
    }
  },

  set(settings: Partial<AppSettings>): AppSettings {
    const current = this.get();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }
};
