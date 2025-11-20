// services/settingsService.ts
import type { TradingSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

const SETTINGS_STORAGE_KEY = 'astibot_settings';
const LIVE_TRADING_CREDENTIALS_KEY = 'astibot_live_trading_credentials';

export interface LiveTradingCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Loads settings from localStorage
 * Returns DEFAULT_SETTINGS if no saved settings exist or if there's an error
 */
export function loadSettings(): TradingSettings {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(savedSettings);
    
    // Merge with default settings to ensure all fields exist (for backwards compatibility)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      telegramSettings: {
        ...DEFAULT_SETTINGS.telegramSettings,
        ...(parsed.telegramSettings || {}),
      },
    };
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves settings to localStorage
 */
export function saveSettings(settings: TradingSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
}

/**
 * Resets settings to default values
 */
export function resetSettings(): TradingSettings {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(LIVE_TRADING_CREDENTIALS_KEY);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error resetting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Loads live trading credentials from localStorage
 */
export function loadLiveTradingCredentials(): LiveTradingCredentials | null {
  try {
    const saved = localStorage.getItem(LIVE_TRADING_CREDENTIALS_KEY);
    if (!saved) {
      return null;
    }
    return JSON.parse(saved);
  } catch (error) {
    console.error('Error loading live trading credentials from localStorage:', error);
    return null;
  }
}

/**
 * Saves live trading credentials to localStorage
 */
export function saveLiveTradingCredentials(credentials: LiveTradingCredentials): void {
  try {
    localStorage.setItem(LIVE_TRADING_CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch (error) {
    console.error('Error saving live trading credentials to localStorage:', error);
  }
}

