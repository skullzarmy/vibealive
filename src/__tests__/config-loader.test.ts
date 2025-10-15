import * as path from 'node:path';
import * as fs from 'fs-extra';
import { loadConfig, extractNextVersion } from '../config/config-loader';
import type { OutputFormat } from '../types';

describe('config-loader', () => {
  let testProjectCounter = 0;

  const getTestProjectPath = () => {
    testProjectCounter++;
    return path.join(__dirname, 'fixtures', `config-test-project-${testProjectCounter}`);
  };

  let currentTestProjectPath: string;

  beforeEach(async () => {
    currentTestProjectPath = getTestProjectPath();
    await fs.ensureDir(currentTestProjectPath);
  });

  afterEach(async () => {
    await fs.remove(currentTestProjectPath);
    // Clear require cache to prevent interference between tests
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('config-test-project')) {
        delete require.cache[key];
      }
    });
  });

  describe('loadConfig', () => {
    it('should load default config for minimal Next.js project', async () => {
      // Create minimal Next.js project
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      const config = await loadConfig(currentTestProjectPath);

      expect(config.projectRoot).toBe(currentTestProjectPath);
      expect(config.nextVersion).toBe('14.0.0');
      expect(config.routerType).toBe('app');
      expect(config.typescript).toBe(false);
      expect(config.excludePatterns).toContain('node_modules/**');
      expect(config.includePatterns).toContain('**/*.{js,jsx,ts,tsx}');
    });

    it('should detect TypeScript projects', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          typescript: '^5.0.0',
        },
      });

      await fs.writeJson(path.join(currentTestProjectPath, 'tsconfig.json'), {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'es6'],
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      const config = await loadConfig(currentTestProjectPath);

      expect(config.typescript).toBe(true);
    });

    it('should detect pages router projects', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^12.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'pages'));

      const config = await loadConfig(currentTestProjectPath);

      expect(config.routerType).toBe('pages');
      expect(config.nextVersion).toBe('12.0.0');
    });

    it('should detect hybrid router projects', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^13.4.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));
      await fs.ensureDir(path.join(currentTestProjectPath, 'pages'));

      const config = await loadConfig(currentTestProjectPath);

      expect(config.routerType).toBe('hybrid');
    });

    it('should load config from .vibealive.config.js', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      // Create config file
      await fs.writeFile(
        path.join(currentTestProjectPath, '.vibealive.config.js'),
        `module.exports = {
          excludePatterns: ['**/custom-exclude/**'],
          confidenceThreshold: 95,
          outputFormats: ['json', 'md']
        };`
      );

      const config = await loadConfig(currentTestProjectPath);

      expect(config.excludePatterns).toContain('**/custom-exclude/**');
      expect(config.confidenceThreshold).toBe(95);
      expect(config.outputFormats).toEqual(['json', 'md']);
    });

    it('should load config from next-analyzer.config.js', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      await fs.writeFile(
        path.join(currentTestProjectPath, 'next-analyzer.config.js'),
        `module.exports = {
          excludePatterns: ['**/legacy/**'],
          plugins: ['custom-plugin']
        };`
      );

      const config = await loadConfig(currentTestProjectPath);

      expect(config.excludePatterns).toContain('**/legacy/**');
      expect(config.plugins).toContain('custom-plugin');
    });

    it('should prioritize .vibealive.config.js over next-analyzer.config.js', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      // Create both config files - .vibealive.config.js should take precedence
      await fs.writeFile(
        path.join(currentTestProjectPath, '.vibealive.config.js'),
        `module.exports = {
          excludePatterns: ['**/exclude1/**'],
          confidenceThreshold: 90
        };`
      );

      await fs.writeFile(
        path.join(currentTestProjectPath, 'next-analyzer.config.js'),
        `module.exports = {
          excludePatterns: ['**/exclude2/**'],
          outputFormats: ['json']
        };`
      );

      const config = await loadConfig(currentTestProjectPath);

      // Should use .vibealive.config.js settings
      expect(config.excludePatterns).toContain('**/exclude1/**');
      expect(config.excludePatterns).not.toContain('**/exclude2/**');
      expect(config.confidenceThreshold).toBe(90);
      // outputFormats should be default since it's not in .vibealive.config.js
      expect(config.outputFormats).toEqual(['json', 'md']);
    });

    it('should handle missing package.json', async () => {
      await expect(loadConfig(currentTestProjectPath)).rejects.toThrow('package.json not found');
    });

    it('should handle non-Next.js projects', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
        },
      });

      await expect(loadConfig(currentTestProjectPath)).rejects.toThrow(
        'Next.js not found in dependencies'
      );
    });

    it('should handle projects without app or pages directory', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await expect(loadConfig(currentTestProjectPath)).rejects.toThrow(
        'Neither app/ nor pages/ directory found'
      );
    });

    it('should apply command line overrides', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      const overrides = {
        confidenceThreshold: 85,
        exclude: ['**/override/**'],
        format: ['md'] as OutputFormat[],
      };

      const config = await loadConfig(currentTestProjectPath, overrides);

      expect(config.confidenceThreshold).toBe(85);
      expect(config.excludePatterns).toContain('**/override/**');
      expect(config.outputFormats).toEqual(['md']);
    });
  });

  describe('extractNextVersion', () => {
    it('should extract version from dependencies', () => {
      const packageJson = {
        dependencies: {
          next: '^14.0.0',
        },
      };

      const version = extractNextVersion(packageJson);
      expect(version).toBe('14.0.0');
    });

    it('should extract version from devDependencies', () => {
      const packageJson = {
        devDependencies: {
          next: '~13.5.0',
        },
      };

      const version = extractNextVersion(packageJson);
      expect(version).toBe('13.5.0');
    });

    it('should extract version from peerDependencies', () => {
      const packageJson = {
        peerDependencies: {
          next: '>=14.0.0',
        },
      };

      const version = extractNextVersion(packageJson);
      expect(version).toBe('>=14.0.0');
    });

    it('should return null if Next.js not found', () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
        },
      };

      const version = extractNextVersion(packageJson);
      expect(version).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle malformed config files gracefully', async () => {
      await fs.writeJson(path.join(currentTestProjectPath, 'package.json'), {
        name: 'test-project',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      });

      await fs.ensureDir(path.join(currentTestProjectPath, 'app'));

      // Create malformed config file
      await fs.writeFile(
        path.join(currentTestProjectPath, '.vibealive.config.js'),
        `module.exports = {
          excludePatterns: [
            // Missing closing bracket and quote
        };`
      );

      // Should not throw but should log warning and continue with defaults
      const config = await loadConfig(currentTestProjectPath);
      expect(config.projectRoot).toBe(currentTestProjectPath);
    });
  });
});
