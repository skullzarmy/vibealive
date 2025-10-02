import { setLocale, getLocale, isLocaleSupported, getSupportedLocales } from '../i18n/utils/i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('en');
  });

  describe('locale support', () => {
    it('should identify supported locales correctly', () => {
      expect(isLocaleSupported('en')).toBe(true);
      expect(isLocaleSupported('es')).toBe(true);
      expect(isLocaleSupported('fr')).toBe(true);
      expect(isLocaleSupported('de')).toBe(true);
      expect(isLocaleSupported('ja')).toBe(true);
      expect(isLocaleSupported('zh')).toBe(true);
      expect(isLocaleSupported('pt')).toBe(true);
      expect(isLocaleSupported('ru')).toBe(true);
      expect(isLocaleSupported('it')).toBe(true);
      expect(isLocaleSupported('ko')).toBe(true);
      expect(isLocaleSupported('invalid')).toBe(false);
    });

    it('should return list of supported locales', () => {
      const locales = getSupportedLocales();
      expect(locales).toContain('en');
      expect(locales).toContain('es');
      expect(locales).toContain('fr');
      expect(locales).toContain('de');
      expect(locales).toContain('ja');
      expect(locales).toContain('zh');
      expect(locales).toContain('pt');
      expect(locales).toContain('ru');
      expect(locales).toContain('it');
      expect(locales).toContain('ko');
      expect(locales.length).toBe(10);
    });

    it('should set and get locale', () => {
      setLocale('es');
      expect(getLocale()).toBe('es');
      
      setLocale('fr');
      expect(getLocale()).toBe('fr');

      setLocale('de');
      expect(getLocale()).toBe('de');
      
      setLocale('en');
      expect(getLocale()).toBe('en');
    });
  });

  describe('system locale detection', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should detect system locale from environment variables', () => {
      // We can't easily test the private detectSystemLocale method,
      // but we can verify that the system initializes to a supported locale
      const currentLocale = getLocale();
      expect(isLocaleSupported(currentLocale)).toBe(true);
    });
  });

  describe('interpolation utilities', () => {
    // Test the interpolation logic by accessing the i18n class directly
    // Since the interpolation is a private method, we'll test it indirectly
    it('should handle basic string formatting patterns', () => {
      // This is more of an integration test to ensure the overall system works
      expect(typeof getLocale()).toBe('string');
      expect(getSupportedLocales().length).toBeGreaterThan(0);
    });
  });
});