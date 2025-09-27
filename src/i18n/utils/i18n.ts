import * as fs from 'fs-extra';
import * as path from 'path';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'pt' | 'ru' | 'it' | 'ko';
export type InterpolationValues = Record<string, string | number>;

interface LocaleData {
  [key: string]: string | LocaleData;
}

class I18n {
  private currentLocale: Locale = 'en';
  private loadedLocales: Map<Locale, LocaleData> = new Map();
  private fallbackLocale: Locale = 'en';

  constructor() {
    // Initialize with system locale detection
    this.currentLocale = this.detectSystemLocale();
  }

  /**
   * Detect system locale from environment variables
   */
  private detectSystemLocale(): Locale {
    const envLocale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
    const localeCode = envLocale.split('.')[0].split('_')[0].toLowerCase();
    
    const supportedLocales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru', 'it', 'ko'];
    
    return supportedLocales.includes(localeCode as Locale) ? (localeCode as Locale) : 'en';
  }

  /**
   * Set the current locale
   */
  setLocale(locale: Locale): void {
    this.currentLocale = locale;
  }

  /**
   * Get the current locale
   */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Load locale data from JSON file
   */
  private async loadLocaleData(locale: Locale): Promise<LocaleData> {
    if (this.loadedLocales.has(locale)) {
      return this.loadedLocales.get(locale)!;
    }

    try {
      const localeDir = path.join(__dirname, '..', 'locales');
      const localeFile = path.join(localeDir, `${locale}.json`);
      
      if (await fs.pathExists(localeFile)) {
        const data = await fs.readJson(localeFile);
        this.loadedLocales.set(locale, data);
        return data;
      }
    } catch (error) {
      // If loading fails, we'll fall back to the fallback locale
    }

    // If not the fallback locale, try to load fallback
    if (locale !== this.fallbackLocale) {
      return this.loadLocaleData(this.fallbackLocale);
    }

    // Return empty object if even fallback fails
    return {};
  }

  /**
   * Get a nested value from locale data using dot notation
   */
  private getNestedValue(data: LocaleData, key: string): string | undefined {
    const keys = key.split('.');
    let current: any = data;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Interpolate values into a string template
   */
  private interpolate(template: string, values: InterpolationValues = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values[key]?.toString() || match;
    });
  }

  /**
   * Translate a key to the current locale
   */
  async t(key: string, values: InterpolationValues = {}): Promise<string> {
    const localeData = await this.loadLocaleData(this.currentLocale);
    let translation = this.getNestedValue(localeData, key);

    // If not found and not using fallback locale, try fallback
    if (!translation && this.currentLocale !== this.fallbackLocale) {
      const fallbackData = await this.loadLocaleData(this.fallbackLocale);
      translation = this.getNestedValue(fallbackData, key);
    }

    // If still not found, return the key itself as fallback
    if (!translation) {
      translation = key;
    }

    return this.interpolate(translation, values);
  }

  /**
   * Synchronous version of translate for cases where async is not possible
   * Note: This requires the locale to be pre-loaded
   */
  tSync(key: string, values: InterpolationValues = {}): string {
    const localeData = this.loadedLocales.get(this.currentLocale) || {};
    let translation = this.getNestedValue(localeData, key);

    // If not found and not using fallback locale, try fallback
    if (!translation && this.currentLocale !== this.fallbackLocale) {
      const fallbackData = this.loadedLocales.get(this.fallbackLocale) || {};
      translation = this.getNestedValue(fallbackData, key);
    }

    // If still not found, return the key itself as fallback
    if (!translation) {
      translation = key;
    }

    return this.interpolate(translation, values);
  }

  /**
   * Preload locale data for synchronous access
   */
  async preloadLocale(locale: Locale): Promise<void> {
    await this.loadLocaleData(locale);
  }

  /**
   * Check if a locale is supported
   */
  isLocaleSupported(locale: string): locale is Locale {
    const supportedLocales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru', 'it', 'ko'];
    return supportedLocales.includes(locale as Locale);
  }

  /**
   * Get list of supported locales
   */
  getSupportedLocales(): Locale[] {
    return ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru', 'it', 'ko'];
  }
}

// Create singleton instance
const i18n = new I18n();

// Export convenience functions
export const t = i18n.t.bind(i18n);
export const tSync = i18n.tSync.bind(i18n);
export const setLocale = i18n.setLocale.bind(i18n);
export const getLocale = i18n.getLocale.bind(i18n);
export const preloadLocale = i18n.preloadLocale.bind(i18n);
export const isLocaleSupported = i18n.isLocaleSupported.bind(i18n);
export const getSupportedLocales = i18n.getSupportedLocales.bind(i18n);

export default i18n;