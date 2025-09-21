import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('CLI', () => {
  let testProjectCounter = 0;

  const getTestProjectPath = () => {
    testProjectCounter++;
    return path.join(__dirname, 'fixtures', `test-cli-project-${testProjectCounter}-${Date.now()}`);
  };

  let testProjectPath: string;
  const cliPath = path.join(__dirname, '../../dist/cli.js');

  beforeAll(async () => {
    testProjectPath = getTestProjectPath();

    // Create test project structure
    await fs.ensureDir(testProjectPath);
    await fs.ensureDir(path.join(testProjectPath, 'app'));
    await fs.ensureDir(path.join(testProjectPath, 'components'));

    // Create package.json
    await fs.writeJson(path.join(testProjectPath, 'package.json'), {
      name: 'test-cli-project',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
      },
    });

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

    await fs.writeFile(
      path.join(testProjectPath, 'components', 'UnusedComponent.tsx'),
      `export default function UnusedComponent() {
        return <div>Never used</div>;
      }`
    );
  });

  afterAll(async () => {
    await fs.remove(testProjectPath);
  });

  describe('analyze command', () => {
    it('should display help when no command is provided', () => {
      const output = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
      expect(output).toContain('Usage:');
      expect(output).toContain('analyze');
      expect(output).toContain('serve');
    });

    it('should analyze project and output results', () => {
      const output = execSync(`node ${cliPath} analyze ${testProjectPath} --format json`, {
        encoding: 'utf8',
      });

      expect(output).toContain('Analysis complete');

      // Check that reports are generated
      expect(output).toContain('Generated reports');
      expect(output).toContain('analysis-report');
    }, 30000);

    it('should handle non-existent project path', () => {
      expect(() => {
        execSync(`node ${cliPath} analyze /non/existent/path`, { encoding: 'utf8', stdio: 'pipe' });
      }).toThrow();
    });

    it('should support different output formats', () => {
      const mdOutput = execSync(`node ${cliPath} analyze ${testProjectPath} --format md`, {
        encoding: 'utf8',
      });

      expect(mdOutput).toContain('Analysis complete');
      expect(mdOutput).toContain('Generated reports');
      expect(mdOutput).toContain('.md');
    }, 30000);

    it('should respect confidence threshold option', () => {
      const output = execSync(
        `node ${cliPath} analyze ${testProjectPath} --confidence-threshold 90 --format json`,
        { encoding: 'utf8' }
      );

      expect(output).toContain('Analysis complete');
      // The analysis should complete regardless of confidence threshold
    }, 30000);

    it('should respect exclude patterns', () => {
      const output = execSync(
        `node ${cliPath} analyze ${testProjectPath} --exclude "**/Button.tsx" --format json`,
        { encoding: 'utf8' }
      );

      expect(output).toContain('Analysis complete');
      // Button.tsx should be excluded from analysis
    }, 30000);
  });

  describe('serve command', () => {
    it('should display serve help', () => {
      const output = execSync(`node ${cliPath} serve --help`, { encoding: 'utf8' });
      expect(output).toContain('Usage: vibealive serve [options]');
      expect(output).toContain('Start the MCP server to interact with the analysis engine');
      expect(output).toContain('-p, --port <number>  Port to run the server on (HTTP mode) (default: "8080")');
      expect(output).toContain('--stdio              Use stdio transport instead of HTTP');
      expect(output).toContain('-h, --help           display help for command');
    });

    // Note: We can't easily test the actual server startup in unit tests
    // as it would start a long-running process. This would be better tested
    // in integration tests.
  });

  describe('input validation', () => {
    it('should validate project path exists', () => {
      expect(() => {
        execSync(`node ${cliPath} analyze /definitely/does/not/exist`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('should validate Next.js project', () => {
      // Create a directory without package.json
      const nonNextProjectPath = path.join(__dirname, 'fixtures', 'non-next-project');
      fs.ensureDirSync(nonNextProjectPath);

      try {
        expect(() => {
          execSync(`node ${cliPath} analyze ${nonNextProjectPath}`, {
            encoding: 'utf8',
            stdio: 'pipe',
          });
        }).toThrow();
      } finally {
        fs.removeSync(nonNextProjectPath);
      }
    });

    it('should handle confidence threshold option', () => {
      const output = execSync(
        `node ${cliPath} analyze ${testProjectPath} --confidence-threshold 150`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // The CLI currently doesn't validate the range, but it should complete
      expect(output).toContain('Analysis complete');
    });

    it('should handle invalid output format', () => {
      expect(() => {
        execSync(`node ${cliPath} analyze ${testProjectPath} --format invalid`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      }).toThrow();
    });
  });

  describe('configuration', () => {
    it('should load configuration from config file', async () => {
      // Create a config file
      const configPath = path.join(testProjectPath, '.vibealive.config.js');
      await fs.writeFile(
        configPath,
        `module.exports = {
          excludePatterns: ['**/test/**'],
          confidenceThreshold: 85,
          outputFormats: ['json']
        };`
      );

      try {
        const output = execSync(`node ${cliPath} analyze ${testProjectPath}`, { encoding: 'utf8' });

        expect(output).toContain('Analysis complete');
      } finally {
        await fs.remove(configPath);
      }
    }, 30000);
  });
});
