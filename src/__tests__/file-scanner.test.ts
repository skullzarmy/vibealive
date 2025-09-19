import { FileScanner } from '../scanners/file-scanner';
import { AnalysisConfig, ProjectStructure } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('FileScanner', () => {
  const testProjectPath = path.join(__dirname, 'fixtures', 'file-scanner-test');
  let config: AnalysisConfig;
  let projectStructure: ProjectStructure;

  beforeEach(async () => {
    await fs.ensureDir(testProjectPath);
    await fs.ensureDir(path.join(testProjectPath, 'app'));
    await fs.ensureDir(path.join(testProjectPath, 'components'));
    await fs.ensureDir(path.join(testProjectPath, 'lib'));
    await fs.ensureDir(path.join(testProjectPath, 'public'));

    config = {
      projectRoot: testProjectPath,
      nextVersion: '14.0.0',
      routerType: 'app',
      typescript: true,
      excludePatterns: ['**/node_modules/**', '**/.next/**'],
      includePatterns: ['**/*.{js,jsx,ts,tsx}'],
    };

    projectStructure = {
      nextVersion: '14.0.0',
      routerType: 'app',
      typescript: true,
      hasAppDir: true,
      hasPagesDir: false,
      configFiles: [],
      entryPoints: [],
      publicAssets: [],
    };
  });

  afterEach(async () => {
    await fs.remove(testProjectPath);
  });

  describe('scanFiles', () => {
    it('should scan and process TypeScript files', async () => {
      // Create test files
      await fs.writeFile(
        path.join(testProjectPath, 'app', 'page.tsx'),
        `export default function HomePage() {
          return <div>Home</div>;
        }`
      );

      await fs.writeFile(
        path.join(testProjectPath, 'components', 'Button.tsx'),
        `export default function Button() {
          return <button>Click me</button>;
        }`
      );

      const scanner = new FileScanner(config, projectStructure);
      const files = await scanner.scanFiles();

      expect(files.length).toBeGreaterThan(0);
      
      const pageFile = files.find(f => f.path.includes('page.tsx'));
      expect(pageFile).toBeDefined();
      expect(pageFile!.isTypeScript).toBe(true);
      expect(pageFile!.isReact).toBe(true);
      expect(pageFile!.extension).toBe('.tsx');

      const buttonFile = files.find(f => f.path.includes('Button.tsx'));
      expect(buttonFile).toBeDefined();
      expect(buttonFile!.isTypeScript).toBe(true);
      expect(buttonFile!.isReact).toBe(true);
    });

    it('should scan JavaScript files', async () => {
      await fs.writeFile(
        path.join(testProjectPath, 'lib', 'utils.js'),
        `export function formatDate(date) {
          return date.toLocaleDateString();
        }`
      );

      const scanner = new FileScanner(config, projectStructure);
      const files = await scanner.scanFiles();

      const utilsFile = files.find(f => f.path.includes('utils.js'));
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.isTypeScript).toBe(false);
      expect(utilsFile!.isReact).toBe(false);
      expect(utilsFile!.extension).toBe('.js');
    });

    it('should exclude files based on patterns', async () => {
      // Create files that should be excluded
      await fs.ensureDir(path.join(testProjectPath, 'node_modules', 'some-package'));
      await fs.writeFile(
        path.join(testProjectPath, 'node_modules', 'some-package', 'index.js'),
        'module.exports = {};'
      );

      await fs.ensureDir(path.join(testProjectPath, '.next', 'static'));
      await fs.writeFile(
        path.join(testProjectPath, '.next', 'static', 'chunks.js'),
        'window.chunks = {};'
      );

      // Create files that should be included
      await fs.writeFile(
        path.join(testProjectPath, 'app', 'page.tsx'),
        `export default function HomePage() { return <div>Home</div>; }`
      );

      const scanner = new FileScanner(config, projectStructure);
      const files = await scanner.scanFiles();

      // Should include the page file
      expect(files.some(f => f.path.includes('page.tsx'))).toBe(true);
      
      // Should exclude node_modules and .next files
      expect(files.some(f => f.path.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.path.includes('.next'))).toBe(false);
    });

    it('should calculate file sizes correctly', async () => {
      const content = 'export default function Test() { return <div>Test</div>; }';
      await fs.writeFile(path.join(testProjectPath, 'test.tsx'), content);

      const scanner = new FileScanner(config, projectStructure);
      const files = await scanner.scanFiles();

      const testFile = files.find(f => f.path.includes('test.tsx'));
      expect(testFile).toBeDefined();
      expect(testFile!.size).toBe(content.length);
    });

    it('should handle include patterns correctly', async () => {
      // Create files of different types
      await fs.writeFile(path.join(testProjectPath, 'component.tsx'), 'export default function Component() {}');
      await fs.writeFile(path.join(testProjectPath, 'utils.ts'), 'export const utils = {};');
      await fs.writeFile(path.join(testProjectPath, 'styles.css'), '.container { display: flex; }');
      await fs.writeFile(path.join(testProjectPath, 'data.json'), '{"key": "value"}');

      const scanner = new FileScanner(config, projectStructure);
      const files = await scanner.scanFiles();

      // Should include TypeScript files
      expect(files.some(f => f.path.includes('component.tsx'))).toBe(true);
      expect(files.some(f => f.path.includes('utils.ts'))).toBe(true);
      
      // Should exclude other file types based on include patterns
      expect(files.some(f => f.path.includes('styles.css'))).toBe(false);
      expect(files.some(f => f.path.includes('data.json'))).toBe(false);
    });

    it('should handle custom include patterns', async () => {
      const customConfig = {
        ...config,
        includePatterns: ['**/*.{ts,tsx,css}'],
      };

      await fs.writeFile(path.join(testProjectPath, 'component.tsx'), 'export default function Component() {}');
      await fs.writeFile(path.join(testProjectPath, 'styles.css'), '.container { display: flex; }');
      await fs.writeFile(path.join(testProjectPath, 'script.js'), 'console.log("hello");');

      const scanner = new FileScanner(customConfig, projectStructure);
      const files = await scanner.scanFiles();

      expect(files.some(f => f.path.includes('component.tsx'))).toBe(true);
      expect(files.some(f => f.path.includes('styles.css'))).toBe(true);
      expect(files.some(f => f.path.includes('script.js'))).toBe(false);
    });
  });

  describe('isAutoInvokedFile', () => {
    it('should identify App Router auto-invoked files', () => {
      const scanner = new FileScanner(config, projectStructure);

      const autoInvokedFiles = [
        path.join(testProjectPath, 'app', 'page.tsx'),
        path.join(testProjectPath, 'app', 'layout.tsx'),
        path.join(testProjectPath, 'app', 'loading.tsx'),
        path.join(testProjectPath, 'app', 'error.tsx'),
        path.join(testProjectPath, 'app', 'not-found.tsx'),
        path.join(testProjectPath, 'app', 'route.ts'),
        path.join(testProjectPath, 'app', 'template.tsx'),
        path.join(testProjectPath, 'app', 'default.tsx'),
        path.join(testProjectPath, 'app', 'global-error.tsx'),
      ];

      autoInvokedFiles.forEach(filePath => {
        expect(scanner.isAutoInvokedFile(filePath)).toBe(true);
      });
    });

    it('should identify Pages Router auto-invoked files', () => {
      const pagesConfig = {
        ...config,
        routerType: 'pages' as const,
      };

      const pagesStructure = {
        ...projectStructure,
        routerType: 'pages' as const,
        hasAppDir: false,
        hasPagesDir: true,
      };

      const scanner = new FileScanner(pagesConfig, pagesStructure);

      const pagesFiles = [
        path.join(testProjectPath, 'pages', 'index.tsx'),
        path.join(testProjectPath, 'pages', '_app.tsx'),
        path.join(testProjectPath, 'pages', '_document.tsx'),
        path.join(testProjectPath, 'pages', '404.tsx'),
        path.join(testProjectPath, 'pages', 'api', 'users.ts'),
      ];

      pagesFiles.forEach(filePath => {
        expect(scanner.isAutoInvokedFile(filePath)).toBe(true);
      });
    });

    it('should identify middleware files', () => {
      const scanner = new FileScanner(config, projectStructure);

      expect(scanner.isAutoInvokedFile(path.join(testProjectPath, 'middleware.ts'))).toBe(true);
      expect(scanner.isAutoInvokedFile(path.join(testProjectPath, 'middleware.js'))).toBe(true);
    });

    it('should identify Next.js convention files', () => {
      const scanner = new FileScanner(config, projectStructure);

      const conventionFiles = [
        path.join(testProjectPath, 'next.config.js'),
        path.join(testProjectPath, 'next.config.mjs'),
        path.join(testProjectPath, 'next.config.ts'),
      ];

      conventionFiles.forEach(filePath => {
        expect(scanner.isAutoInvokedFile(filePath)).toBe(true);
      });
    });

    it('should not identify regular components as auto-invoked', () => {
      const scanner = new FileScanner(config, projectStructure);

      const regularFiles = [
        path.join(testProjectPath, 'components', 'Button.tsx'),
        path.join(testProjectPath, 'lib', 'utils.ts'),
        path.join(testProjectPath, 'hooks', 'useCustomHook.ts'),
      ];

      regularFiles.forEach(filePath => {
        expect(scanner.isAutoInvokedFile(filePath)).toBe(false);
      });
    });

    it('should handle hybrid router projects', () => {
      const hybridConfig = {
        ...config,
        routerType: 'hybrid' as const,
      };

      const hybridStructure = {
        ...projectStructure,
        routerType: 'hybrid' as const,
        hasAppDir: true,
        hasPagesDir: true,
      };

      const scanner = new FileScanner(hybridConfig, hybridStructure);

      // Should identify both app and pages auto-invoked files
      expect(scanner.isAutoInvokedFile(path.join(testProjectPath, 'app', 'page.tsx'))).toBe(true);
      expect(scanner.isAutoInvokedFile(path.join(testProjectPath, 'pages', '_app.tsx'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle files that cannot be read', async () => {
      // Create a file with restricted permissions (if possible)
      const restrictedFile = path.join(testProjectPath, 'restricted.tsx');
      await fs.writeFile(restrictedFile, 'export default function Restricted() {}');
      
      // Change permissions to make it unreadable (this might not work on all systems)
      try {
        await fs.chmod(restrictedFile, 0o000);
      } catch {
        // Skip this test if we can't change permissions
        return;
      }

      const scanner = new FileScanner(config, projectStructure);
      
      // Should not throw but should warn and continue
      const files = await scanner.scanFiles();
      expect(Array.isArray(files)).toBe(true);
      
      // Restore permissions for cleanup
      try {
        await fs.chmod(restrictedFile, 0o644);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should handle empty files', async () => {
      await fs.writeFile(path.join(testProjectPath, 'empty.tsx'), '');

      const scanner = new FileScanner(config, projectStructure);
      const files = await scanner.scanFiles();

      const emptyFile = files.find(f => f.path.includes('empty.tsx'));
      expect(emptyFile).toBeDefined();
      expect(emptyFile!.size).toBe(0);
    });

    it('should handle binary files gracefully', async () => {
      // Create a binary file (simulated with some binary content)
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      await fs.writeFile(path.join(testProjectPath, 'image.png'), binaryContent);

      // Add PNG to include patterns to test behavior
      const binaryConfig = {
        ...config,
        includePatterns: ['**/*.{ts,tsx,png}'],
      };

      const scanner = new FileScanner(binaryConfig, projectStructure);
      const files = await scanner.scanFiles();

      // Should include the file but handle it gracefully
      const binaryFile = files.find(f => f.path.includes('image.png'));
      expect(binaryFile).toBeDefined();
      expect(binaryFile!.size).toBe(4);
    });
  });
});