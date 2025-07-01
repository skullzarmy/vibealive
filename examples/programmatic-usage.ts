import { NextJSAnalyzer, AnalysisConfig } from '../src';
import * as path from 'path';

async function main() {
  console.log('Running programmatic analysis example...');

  const config: AnalysisConfig = {
    projectRoot: path.resolve(__dirname, '../../test-next-app'), // Adjust to your project
    excludePatterns: ['**/node_modules/**', '**/.next/**'],
    includePatterns: ['**/*.{js,jsx,ts,tsx}'],
    // These properties are required by the type, but may not be strictly
    // necessary if the analyzer can infer them.
    nextVersion: '14.0.0',
    routerType: 'app',
    typescript: true,
  };

  try {
    const analyzer = new NextJSAnalyzer(config);
    const report = await analyzer.analyze();

    console.log('✅ Analysis Complete!');
    console.log(`Found ${report.summary.unusedFiles} unused files.`);

    const unusedFilePaths = report.files
      .filter((f) => f.classification === 'UNUSED')
      .map((f) => f.path);

    console.log('Unused file paths:', unusedFilePaths);
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

main();
