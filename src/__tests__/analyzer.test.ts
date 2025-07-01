import { NextJSAnalyzer } from '../analyzer';
import { ConfigLoader } from '../config/config-loader';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('NextJSAnalyzer', () => {
  const testProjectPath = path.join(__dirname, 'fixtures', 'test-project');

  beforeAll(async () => {
    // Create test project structure
    await fs.ensureDir(testProjectPath);
    await fs.ensureDir(path.join(testProjectPath, 'app'));
    await fs.ensureDir(path.join(testProjectPath, 'components'));

    // Create package.json
    await fs.writeJson(path.join(testProjectPath, 'package.json'), {
      name: 'test-project',
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

  it('should detect project structure correctly', async () => {
    const config = await ConfigLoader.loadConfig(testProjectPath);

    expect(config.projectRoot).toBe(testProjectPath);
    expect(config.nextVersion).toBe('14.0.0');
    expect(config.routerType).toBe('app');
    expect(config.typescript).toBe(false);
  });

  it('should analyze files and identify unused components', async () => {
    const config = await ConfigLoader.loadConfig(testProjectPath);
    const analyzer = new NextJSAnalyzer(config);

    const report = await analyzer.analyze();

    expect(report.metadata.totalFiles).toBeGreaterThan(0);
    expect(report.files).toBeDefined();
    expect(report.summary).toBeDefined();

    // Should find the unused component
    const unusedFiles = report.files.filter((f) => f.classification === 'UNUSED');
    expect(unusedFiles.length).toBeGreaterThan(0);

    const unusedComponent = unusedFiles.find((f) => f.path.includes('UnusedComponent'));
    expect(unusedComponent).toBeDefined();
  });

  it('should identify auto-invoked files correctly', async () => {
    const config = await ConfigLoader.loadConfig(testProjectPath);
    const analyzer = new NextJSAnalyzer(config);

    const report = await analyzer.analyze();

    // page.tsx should be classified as AUTO_INVOKED
    const pageFile = report.files.find((f) => f.path.includes('page.tsx'));
    expect(pageFile).toBeDefined();
    expect(pageFile?.classification).toBe('AUTO_INVOKED');
  });
});
