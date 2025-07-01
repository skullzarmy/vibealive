// Main exports for the npm package
export { NextJSAnalyzer } from './analyzer';
export { FileScanner } from './scanners/file-scanner';
export { DependencyAnalyzer } from './analyzers/dependency-analyzer';
export { APIAnalyzer } from './analyzers/api-analyzer';
export { ReportGenerator } from './generators/report-generator';
export * from './types';

// Default export for convenience
export { NextJSAnalyzer as default } from './analyzer';
