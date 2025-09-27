import * as fs from 'fs-extra';
import * as path from 'path';
import { AnalysisReport, OutputFormat, Locale } from '../types';
import { t, tSync, setLocale, preloadLocale } from '../i18n/utils/i18n';

export class ReportGenerator {
  private locale: Locale = 'en';

  constructor(private outputDir: string, locale?: Locale) {
    if (locale) {
      this.locale = locale;
      setLocale(locale);
    }
    // Preload the locale for synchronous access
    this.initializeLocale();
  }

  private async initializeLocale(): Promise<void> {
    try {
      await preloadLocale(this.locale);
    } catch (error) {
      // Fallback to English if locale loading fails
      await preloadLocale('en');
    }
  }

  public async generateReports(
    report: AnalysisReport,
    formats: OutputFormat[] = ['json', 'md']
  ): Promise<string[]> {
    const generatedFiles: string[] = [];

    await fs.ensureDir(this.outputDir);

    for (const format of formats) {
      const filePath = await this.generateReport(report, format);
      generatedFiles.push(filePath);
    }

    return generatedFiles;
  }

  private async generateReport(report: AnalysisReport, format: OutputFormat): Promise<string> {
    switch (format) {
      case 'json':
        return this.generateJSONReport(report);
      case 'md':
        return this.generateMarkdownReport(report);
      case 'tsv':
        return this.generateTSVReport(report);
      case 'csv':
        return this.generateCSVReport(report);
      default:
        throw new Error(tSync('cli.validation.unsupportedFormat', { format }));
    }
  }

  private async getUniqueFilePath(
    baseName: string,
    extension: string,
    force: boolean // Keep parameter for backward compatibility
  ): Promise<string> {
    // Always include timestamp for better report tracking and to avoid overwrites
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-'); // YYYY-MM-DDTHH-MM-SS format
    const filePath = path.join(this.outputDir, `${baseName}-${timestamp}.${extension}`);

    return filePath;
  }

  private async generateJSONReport(
    report: AnalysisReport,
    force: boolean = false
  ): Promise<string> {
    const filePath = await this.getUniqueFilePath('analysis-report', 'json', force);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }

  private async generateMarkdownReport(
    report: AnalysisReport,
    force: boolean = false
  ): Promise<string> {
    const filePath = await this.getUniqueFilePath('analysis-report', 'md', force);

    const markdown = `${tSync('reports.markdown.title')}

${tSync('reports.markdown.executiveSummary')}

${tSync('reports.markdown.project', { project: report.metadata.projectRoot })}
${tSync('reports.markdown.nextVersion', { version: report.metadata.nextVersion || 'N/A' })}
${tSync('reports.markdown.routerType', { routerType: report.metadata.routerType })}
${tSync('reports.markdown.analysisDate', { date: new Date(report.metadata.analysisDate).toLocaleDateString() })}
${tSync('reports.markdown.analysisTime', { time: new Date(report.metadata.analysisDate).toLocaleTimeString() })}
${tSync('reports.markdown.totalFiles', { count: report.metadata.totalFiles })}
${tSync('reports.markdown.totalComponents', { count: report.metadata.totalComponents })}
${tSync('reports.markdown.totalApiEndpoints', { count: report.metadata.totalApiEndpoints })}

${this.generateNextJSHealthSection(report)}

${tSync('reports.markdown.keyFindings')}

${tSync('reports.markdown.unusedFiles')}
${tSync('reports.markdown.unusedFilesCount', { count: report.summary.unusedFiles })}
${tSync('reports.markdown.potentialSavings', { size: this.formatBytes(report.summary.potentialSavings.estimatedBundleSize) })}

${tSync('reports.markdown.deadCode')}
${tSync('reports.markdown.deadCodeCount', { count: report.summary.deadCode })}

${tSync('reports.markdown.redundantApis')}
${tSync('reports.markdown.redundantApisCount', { count: report.summary.redundantApis })}

${this.generateBundleAnalysisSection(report)}

${tSync('reports.markdown.fileAnalysis')}

${tSync('reports.markdown.unusedFilesSection', { count: report.files.filter((f) => f.classification === 'UNUSED').length })}

${this.generateFileTable(report.files.filter((f) => f.classification === 'UNUSED'))}

${tSync('reports.markdown.deadCodeSection', { count: report.files.filter((f) => f.classification === 'DEAD_CODE').length })}

${this.generateFileTable(report.files.filter((f) => f.classification === 'DEAD_CODE'))}

${tSync('reports.markdown.apiAnalysis')}

${tSync('reports.markdown.unusedApisSection', { count: report.apiEndpoints.filter((api) => api.classification === 'UNUSED').length })}

${this.generateAPITable(report.apiEndpoints.filter((api) => api.classification === 'UNUSED'))}

${tSync('reports.markdown.recommendations')}

${report.recommendations
  .map(
    (rec) =>
      `### ${rec.type}: ${rec.target}
- **Confidence**: ${rec.confidence}%
- **Impact**: ${rec.impact}
- **Description**: ${rec.description}
- **Actions**: 
${rec.actions.map((action) => `  - \`${action}\``).join('\n')}
`
  )
  .join('\n')}

${tSync('reports.markdown.dependencyGraph')}

${tSync('reports.markdown.entryPoints')}
${report.graph.entryPoints.map((ep) => `- ${ep.name} (${ep.path})`).join('\n')}

${tSync('reports.markdown.orphanedComponents', { count: report.graph.orphans.length })}
${report.graph.orphans.map((orphan) => `- ${orphan.name} (${orphan.path})`).join('\n')}

${tSync('reports.markdown.circularDependencies', { count: report.graph.cycles.length })}
${report.graph.cycles
  .map(
    (cycle, index) =>
      `${tSync('reports.markdown.cycle', { index: index + 1 })}
${cycle.map((node) => `- ${node.name}`).join(' → ')} → ${cycle[0].name}
`
  )
  .join('\n')}

${tSync('reports.markdown.safeDeletions')}

${tSync('reports.markdown.safeDeletionsDescription')}

${report.summary.safeDeletions.map((file) => `- \`${file}\``).join('\n')}

---

${tSync('reports.markdown.generatedBy', { date: new Date().toLocaleString() })}
`;

    await fs.writeFile(filePath, markdown);
    return filePath;
  }

  private generateNextJSHealthSection(report: AnalysisReport): string {
    if (!report.nextjsAnalysis) return '';

    const { projectHealth, patterns, packages, setupIssues } = report.nextjsAnalysis;

    let section = `${tSync('reports.health.title', { score: projectHealth.score })}

${tSync('reports.health.strengths')}
${projectHealth.strengths.map((strength) => `- ${strength}`).join('\n')}

${tSync('reports.health.improvements')}
${projectHealth.improvements.map((improvement) => `- ${improvement}`).join('\n')}

`;

    // Advanced Routing Patterns
    if (patterns.length > 0) {
      section += `${tSync('reports.health.routingPatterns')}

${tSync('reports.tables.routingPatternHeaders')}
${tSync('reports.tables.routingPatternSeparator')}
${patterns
  .map(
    (pattern) =>
      `| ${pattern.type} | \`${pattern.path}\` | ${pattern.purpose} | ${pattern.isValid ? tSync('status.valid') : tSync('status.invalid')} |`
  )
  .join('\n')}

`;
    }

    // Package Analysis
    const installedPackages = packages.filter((p) => p.installed);
    if (installedPackages.length > 0) {
      section += `${tSync('reports.health.ecosystemPackages')}

${tSync('reports.tables.packageHeaders')}
${tSync('reports.tables.packageSeparator')}
${installedPackages
  .map(
    (pkg) =>
      `| \`${pkg.name}\` | ${pkg.version || 'N/A'} | ${this.getStatusIcon(pkg.setupStatus)} ${pkg.setupStatus} | ${pkg.purpose} |`
  )
  .join('\n')}

`;
    }

    // Setup Issues
    if (setupIssues.length > 0) {
      const errorIssues = setupIssues.filter((i) => i.severity === 'error');
      const warningIssues = setupIssues.filter((i) => i.severity === 'warning');
      const infoIssues = setupIssues.filter((i) => i.severity === 'info');

      section += `${tSync('reports.health.setupIssues')}

`;

      if (errorIssues.length > 0) {
        section += `${tSync('reports.health.criticalIssues', { count: errorIssues.length })}
${errorIssues
  .map(
    (issue) => `
**${issue.title}**
${issue.description}

${tSync('reports.health.recommendations')}
${issue.recommendations.map((rec) => `- ${rec}`).join('\n')}
`
  )
  .join('\n')}

`;
      }

      if (warningIssues.length > 0) {
        section += `${tSync('reports.health.warnings', { count: warningIssues.length })}
${warningIssues
  .map(
    (issue) => `
**${issue.title}**
${issue.description}

${tSync('reports.health.recommendations')}
${issue.recommendations.map((rec) => `- ${rec}`).join('\n')}
`
  )
  .join('\n')}

`;
      }

      if (infoIssues.length > 0) {
        section += `${tSync('reports.health.optimizationOpportunities', { count: infoIssues.length })}
${infoIssues
  .map(
    (issue) => `
**${issue.title}**
${issue.description}

${tSync('reports.health.recommendations')}
${issue.recommendations.map((rec) => `- ${rec}`).join('\n')}
`
  )
  .join('\n')}

`;
      }
    }

    return section;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'complete':
        return tSync('status.complete');
      case 'partial':
        return tSync('status.partial');
      case 'missing':
        return tSync('status.missing');
      case 'misconfigured':
        return tSync('status.misconfigured');
      default:
        return tSync('status.unknown');
    }
  }

  private generateBundleAnalysisSection(report: AnalysisReport): string {
    if (!report.bundleAnalysis) {
      return '';
    }

    const bundle = report.bundleAnalysis;

    return `${tSync('reports.bundle.title')}

${tSync('reports.bundle.currentImpact')}
${tSync('reports.bundle.totalBundleSize', { size: this.formatBytes(bundle.totalBundleSize) })}
${tSync('reports.bundle.gzippedSize', { size: this.formatBytes(bundle.gzippedSize) })}
${tSync('reports.bundle.unusedCodeSize', { 
  size: this.formatBytes(bundle.unusedCodeSize), 
  percentage: bundle.potentialSavings.percentage.toFixed(1) 
})}

${tSync('reports.bundle.potentialSavings')}
${tSync('reports.bundle.rawSizeReduction', { size: this.formatBytes(bundle.potentialSavings.bytes) })}
${tSync('reports.bundle.gzippedReduction', { size: this.formatBytes(bundle.potentialSavings.gzipped) })}
${tSync('reports.bundle.bundleSizeImprovement', { percentage: bundle.potentialSavings.percentage.toFixed(1) })}

${tSync('reports.bundle.topUnusedModules')}
${
  bundle.moduleBreakdown
    .filter((m) => m.isUnused)
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map(
      (m) =>
        `- \`${path.relative(process.cwd(), m.path)}\` - ${this.formatBytes(m.size)} (${this.formatBytes(m.gzippedSize)} gzipped)`
    )
    .join('\n') || tSync('reports.bundle.noUnusedModules')
}

${tSync('reports.bundle.optimizationRecommendations')}
${
  bundle.recommendations.length > 0
    ? bundle.recommendations
        .map(
          (rec) =>
            `- **${rec.type}**: ${rec.description}\n  - Potential saving: ${this.formatBytes(rec.potentialSaving)}\n  - Action: ${rec.action}`
        )
        .join('\n\n')
    : tSync('reports.bundle.noRecommendations')
}

`;
  }

  private generateFileTable(files: any[]): string {
    if (files.length === 0) {
      return tSync('reports.tables.noFilesFound');
    }

    const headers = tSync('reports.tables.fileTableHeaders');
    const separator = tSync('reports.tables.fileTableSeparator');

    const rows = files.map((file) => {
      const relativePath = path.relative(process.cwd(), file.path);
      return `| \`${relativePath}\` | ${file.type} | ${file.confidence}% | ${file.reasons.join(', ')} |`;
    });

    return [headers, separator, ...rows].join('\n');
  }

  private generateAPITable(apis: any[]): string {
    if (apis.length === 0) {
      return tSync('reports.tables.noApisFound');
    }

    const headers = tSync('reports.tables.apiTableHeaders');
    const separator = tSync('reports.tables.apiTableSeparator');

    const rows = apis.map((api) => {
      const relativePath = path.relative(process.cwd(), api.filePath);
      return `| \`${api.path}\` | ${api.methods.join(', ')} | \`${relativePath}\` | ${api.confidence}% | ${api.reasons.join(', ')} |`;
    });

    return [headers, separator, ...rows].join('\n');
  }

  private async generateTSVReport(report: AnalysisReport, force: boolean = false): Promise<string> {
    const filePath = await this.getUniqueFilePath('analysis-report', 'tsv', force);

    const headers = [
      tSync('reports.csv.headers.type'),
      tSync('reports.csv.headers.path'),
      tSync('reports.csv.headers.usageCount'),
      tSync('reports.csv.headers.classification'),
      tSync('reports.csv.headers.confidence'),
      tSync('reports.csv.headers.reasons')
    ].join('\t');
    const rows = [headers];

    // Add file data
    report.files.forEach((file) => {
      const relativePath = path.relative(process.cwd(), file.path);
      rows.push(
        [
          'File',
          relativePath,
          file.usageLocations.length.toString(),
          file.classification,
          file.confidence.toString(),
          file.reasons.join('; '),
        ].join('\t')
      );
    });

    // Add API data
    report.apiEndpoints.forEach((api) => {
      const relativePath = path.relative(process.cwd(), api.filePath);
      rows.push(
        [
          'API',
          `${api.path} (${relativePath})`,
          api.callSites.length.toString(),
          api.classification,
          api.confidence.toString(),
          api.reasons.join('; '),
        ].join('\t')
      );
    });

    await fs.writeFile(filePath, rows.join('\n'));
    return filePath;
  }

  private async generateCSVReport(report: AnalysisReport, force: boolean = false): Promise<string> {
    const filePath = await this.getUniqueFilePath('analysis-report', 'csv', force);

    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = [
      tSync('reports.csv.headers.type'),
      tSync('reports.csv.headers.path'),
      tSync('reports.csv.headers.usageCount'),
      tSync('reports.csv.headers.classification'),
      tSync('reports.csv.headers.confidence'),
      tSync('reports.csv.headers.reasons')
    ]
      .map(escapeCSV)
      .join(',');
    const rows = [headers];

    // Add file data
    report.files.forEach((file) => {
      const relativePath = path.relative(process.cwd(), file.path);
      rows.push(
        [
          'File',
          relativePath,
          file.usageLocations.length.toString(),
          file.classification,
          file.confidence.toString(),
          file.reasons.join('; '),
        ]
          .map(escapeCSV)
          .join(',')
      );
    });

    // Add API data
    report.apiEndpoints.forEach((api) => {
      const relativePath = path.relative(process.cwd(), api.filePath);
      rows.push(
        [
          'API',
          `${api.path} (${relativePath})`,
          api.callSites.length.toString(),
          api.classification,
          api.confidence.toString(),
          api.reasons.join('; '),
        ]
          .map(escapeCSV)
          .join(',')
      );
    });

    await fs.writeFile(filePath, rows.join('\n'));
    return filePath;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
