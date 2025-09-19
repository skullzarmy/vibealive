// Global test setup for Jest
import * as path from 'path';
import * as fs from 'fs-extra';

// Increase timeout for long-running operations
jest.setTimeout(30000);

// Mock console.log for cleaner test output in most cases
const originalConsoleLog = console.log;
beforeEach(() => {
  // Only mock console.log if not running specific tests that need output
  if (!process.env.JEST_CONSOLE_LOG) {
    console.log = jest.fn();
  }
});

afterEach(() => {
  if (!process.env.JEST_CONSOLE_LOG) {
    console.log = originalConsoleLog;
  }
});

// Global cleanup for test fixtures
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

beforeAll(async () => {
  // Ensure fixtures directory exists
  await fs.ensureDir(FIXTURES_DIR);
});

afterAll(async () => {
  // Clean up any remaining test fixtures
  try {
    const items = await fs.readdir(FIXTURES_DIR);
    for (const item of items) {
      const itemPath = path.join(FIXTURES_DIR, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory()) {
        await fs.remove(itemPath);
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Helper to create test projects
global.createTestProject = async (name: string, config: any = {}) => {
  const projectPath = path.join(FIXTURES_DIR, name);
  await fs.ensureDir(projectPath);
  
  // Default package.json
  const defaultPackageJson = {
    name,
    dependencies: {
      next: '^14.0.0',
      react: '^18.0.0',
    },
    ...config.packageJson,
  };
  
  await fs.writeJson(path.join(projectPath, 'package.json'), defaultPackageJson);
  
  // Create directory structure
  if (config.hasAppDir !== false) {
    await fs.ensureDir(path.join(projectPath, 'app'));
  }
  
  if (config.hasPagesDir) {
    await fs.ensureDir(path.join(projectPath, 'pages'));
  }
  
  if (config.hasTypeScript) {
    await fs.writeJson(path.join(projectPath, 'tsconfig.json'), {
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'es6'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        module: 'esnext',
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'preserve',
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    });
  }
  
  // Create test files
  if (config.files) {
    for (const [filePath, content] of Object.entries(config.files)) {
      const fullPath = path.join(projectPath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content as string);
    }
  }
  
  return projectPath;
};

// Declare global types for TypeScript
declare global {
  function createTestProject(name: string, config?: any): Promise<string>;
}

export {};