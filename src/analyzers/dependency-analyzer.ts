import * as fs from 'fs-extra';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import {
  AnalysisConfig,
  ProjectStructure,
  ComponentGraph,
  ComponentNode,
  DependencyEdge,
  ImportInfo,
  ExportInfo,
  ComponentType,
} from '../types';
import { ScannedFile } from '../scanners/file-scanner';
import { parse as jsoncParse } from 'jsonc-parser';

export class DependencyAnalyzer {
  private pathAliases: { alias: string; paths: string[] }[];

  constructor(
    private config: AnalysisConfig,
    private projectStructure: ProjectStructure
  ) {
    this.pathAliases = this.loadPathAliases();
  }

  public async buildDependencyGraph(files: ScannedFile[]): Promise<ComponentGraph> {
    const nodes: ComponentNode[] = [];
    const edges: DependencyEdge[] = [];

    // First pass: Create nodes for all files
    for (const file of files) {
      if (this.shouldAnalyzeFile(file)) {
        const node = await this.createComponentNode(file);
        if (node) {
          nodes.push(node);
        }
      }
    }

    // Second pass: Create edges based on imports
    for (const node of nodes) {
      for (const importInfo of node.imports) {
        const resolvedPath = this.resolveImport(importInfo.source, node.path);
        const targetNode = nodes.find((n) => n.path === resolvedPath);

        if (targetNode) {
          importInfo.imports.forEach((imp) => {
            edges.push({
              from: node.id,
              to: targetNode.id,
              type: importInfo.isDynamic
                ? 'dynamic-import'
                : importInfo.isLazy
                  ? 'lazy-import'
                  : 'import',
              importName: imp.name,
            });
          });
        }
      }
    }

    // Find cycles and orphans
    const cycles = this.findCycles(nodes, edges);
    // Use entry points from project structure instead of finding them again
    const entryPointPaths = new Set(this.projectStructure.entryPoints);
    const entryPoints = nodes.filter((node) => entryPointPaths.has(node.path));
    const orphans = this.findOrphans(nodes, edges, entryPoints);

    return {
      nodes,
      edges,
      cycles,
      orphans,
      entryPoints,
    };
  }

  private shouldAnalyzeFile(file: ScannedFile): boolean {
    // Only analyze JavaScript/TypeScript files
    return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file.extension);
  }

  private async createComponentNode(file: ScannedFile): Promise<ComponentNode | null> {
    try {
      if (!file.content) {
        return null;
      }

      const ast = this.parseFile(file.content, file.extension);
      const imports = this.extractImports(ast);
      const exports = this.extractExports(ast);
      const componentType = this.determineComponentType(file);

      return {
        id: this.generateNodeId(file.path),
        path: file.path,
        name: path.basename(file.path, file.extension),
        type: componentType,
        exports,
        imports,
      };
    } catch (error) {
      console.warn(`Failed to analyze file ${file.path}:`, error);
      return null;
    }
  }

  private parseFile(content: string, extension: string): any {
    const isTypeScript = /\.(ts|tsx)$/.test(extension);
    const isJSX = /\.(jsx|tsx)$/.test(extension);

    try {
      const plugins: any[] = [
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
      ];

      if (isTypeScript) {
        plugins.push('typescript');
      }

      if (isJSX) {
        plugins.push('jsx');
      }

      return parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins,
      });
    } catch (error) {
      throw new Error(`Failed to parse file: ${error}`);
    }
  }

  private extractImports(ast: any): ImportInfo[] {
    const imports: ImportInfo[] = [];

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const importSpecifiers = path.node.specifiers.map((spec) => {
          if (t.isImportDefaultSpecifier(spec)) {
            return { name: 'default', alias: spec.local.name };
          } else if (t.isImportNamespaceSpecifier(spec)) {
            return { name: '*', alias: spec.local.name };
          } else if (t.isImportSpecifier(spec)) {
            const importedName = t.isIdentifier(spec.imported)
              ? spec.imported.name
              : spec.imported.value;
            const localName = spec.local.name;
            return {
              name: importedName,
              alias: localName !== importedName ? localName : undefined,
              isTypeOnly: spec.importKind === 'type',
            };
          }
          return { name: 'unknown' };
        });

        imports.push({
          source,
          imports: importSpecifiers,
          isDynamic: false,
          isLazy: false,
        });
      },

      CallExpression(path) {
        // Dynamic imports
        if (t.isImport(path.node.callee) && path.node.arguments.length > 0) {
          const source = t.isStringLiteral(path.node.arguments[0])
            ? path.node.arguments[0].value
            : 'dynamic';

          imports.push({
            source,
            imports: [{ name: 'default' }],
            isDynamic: true,
            isLazy: false,
          });
        }

        // React.lazy
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object, { name: 'React' }) &&
          t.isIdentifier(path.node.callee.property, { name: 'lazy' })
        ) {
          if (
            path.node.arguments.length > 0 &&
            t.isArrowFunctionExpression(path.node.arguments[0])
          ) {
            const body = path.node.arguments[0].body;
            if (t.isCallExpression(body) && t.isImport(body.callee)) {
              const source = t.isStringLiteral(body.arguments[0])
                ? body.arguments[0].value
                : 'lazy';

              imports.push({
                source,
                imports: [{ name: 'default' }],
                isDynamic: true,
                isLazy: true,
              });
            }
          }
        }
      },
    });

    return imports;
  }

  private extractExports(ast: any): ExportInfo[] {
    const exports: ExportInfo[] = [];

    traverse(ast, {
      ExportDefaultDeclaration() {
        exports.push({
          name: 'default',
          type: 'default',
        });
      },

      ExportNamedDeclaration(path) {
        if (path.node.specifiers) {
          path.node.specifiers.forEach((spec) => {
            if (t.isExportSpecifier(spec)) {
              exports.push({
                name: t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value,
                type: 'named',
                isTypeOnly: spec.exportKind === 'type',
              });
            }
          });
        }

        if (path.node.declaration) {
          if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach((decl) => {
              if (t.isIdentifier(decl.id)) {
                exports.push({
                  name: decl.id.name,
                  type: 'named',
                });
              }
            });
          } else if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            exports.push({
              name: path.node.declaration.id.name,
              type: 'named',
            });
          } else if (t.isClassDeclaration(path.node.declaration) && path.node.declaration.id) {
            exports.push({
              name: path.node.declaration.id.name,
              type: 'named',
            });
          }
        }
      },
    });

    return exports;
  }

  private determineComponentType(file: ScannedFile): ComponentType {
    const relativePath = path.relative(this.config.projectRoot, file.path);
    const filename = path.basename(file.path, file.extension);

    // Check for Next.js special files
    if (filename === 'page') return 'page';
    if (filename === 'layout') return 'layout';
    if (filename === 'loading') return 'loading';
    if (filename === 'error') return 'error';
    if (filename === 'not-found') return 'not-found';

    // Check for hooks (files starting with 'use')
    if (filename.startsWith('use')) return 'hook';

    // Check for config files
    if (/config|\.config/.test(filename)) return 'config';

    // Check for utility files
    if (/util|helper|lib/.test(relativePath)) return 'util';

    // Default to component
    return 'component';
  }

  private resolveImport(source: string, fromPath: string): string | null {
    // 1. Handle Aliases by priority (longest alias first)
    for (const { alias, paths } of this.pathAliases) {
      if (source.startsWith(alias)) {
        const remainingPath = source.substring(alias.length);
        for (const p of paths) {
          const resolvedPath = path.join(p, remainingPath);
          const foundFile = this._findFileWithExtensions(resolvedPath);
          if (foundFile) {
            return foundFile;
          }
        }
      }
    }

    // 2. Handle Relative Imports
    if (source.startsWith('./') || source.startsWith('../')) {
      const fromDir = path.dirname(fromPath);
      const resolvedPath = path.resolve(fromDir, source);
      const foundFile = this._findFileWithExtensions(resolvedPath);
      if (foundFile) {
        return foundFile;
      }
    }

    // 3. Not a local file we can track (e.g., 'react', 'next')
    return null;
  }

  /**
   * Tries to find a file by checking for various extensions or if it's a directory with an index file.
   */
  private _findFileWithExtensions(basePath: string): string | null {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    // Check for file with exact name + extension
    for (const ext of extensions) {
      const filePath = basePath + ext;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
      }
    }

    // Check for directory with an index file
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of extensions) {
        const indexFile = path.join(basePath, 'index' + ext);
        if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
          return indexFile;
        }
      }
    }

    // Check for file with exact name if extension is already present
    if (
      extensions.includes(path.extname(basePath)) &&
      fs.existsSync(basePath) &&
      fs.statSync(basePath).isFile()
    ) {
      return basePath;
    }

    return null;
  }

  private generateNodeId(filePath: string): string {
    return path.relative(this.config.projectRoot, filePath);
  }

  private findCycles(nodes: ComponentNode[], edges: DependencyEdge[]): ComponentNode[][] {
    const cycles: ComponentNode[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.detectCycleDFS(node.id, nodes, edges, visited, recursionStack, [], cycles);
      }
    }

    return cycles;
  }

  private detectCycleDFS(
    nodeId: string,
    nodes: ComponentNode[],
    edges: DependencyEdge[],
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: ComponentNode[][]
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const outgoingEdges = edges.filter((edge) => edge.from === nodeId);

    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        this.detectCycleDFS(edge.to, nodes, edges, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(edge.to)) {
        // Found a cycle
        const cycleStart = path.indexOf(edge.to);
        const cyclePath = path.slice(cycleStart);
        const cycleNodes = cyclePath.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
        cycles.push(cycleNodes);
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
  }

  private findOrphans(
    nodes: ComponentNode[],
    edges: DependencyEdge[],
    entryPoints: ComponentNode[]
  ): ComponentNode[] {
    const reachable = new Set<string>();
    const queue = [...entryPoints.map((ep) => ep.id)];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (reachable.has(currentId)) continue;

      reachable.add(currentId);

      const outgoingEdges = edges.filter((edge) => edge.from === currentId);
      for (const edge of outgoingEdges) {
        if (!reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    return nodes.filter((node) => !reachable.has(node.id) && !this.isAutoInvokedFile(node.path));
  }

  private isAutoInvokedFile(filePath: string): boolean {
    const relativePath = path.relative(this.config.projectRoot, filePath);
    const filename = path.basename(filePath, path.extname(filePath));
    const fullFileName = path.basename(filePath);

    // App Router auto-invoked files
    if (this.projectStructure.hasAppDir) {
      const appRouterFiles = [
        'page',
        'layout',
        'loading',
        'error',
        'not-found',
        'route',
        'template',
        'default',
        'global-error',
      ];

      if (appRouterFiles.includes(filename) && relativePath.includes('app/')) {
        return true;
      }

      // Special App Router files
      if (
        relativePath.includes('app/') &&
        [
          'sitemap',
          'robots',
          'manifest',
          'favicon',
          'icon',
          'apple-icon',
          'opengraph-image',
          'twitter-image',
        ].includes(filename)
      ) {
        return true;
      }
    }

    // Pages Router auto-invoked files (all files in pages/ are auto-invoked)
    if (this.projectStructure.hasPagesDir && relativePath.includes('pages/')) {
      return true;
    }

    // Middleware
    if (filename === 'middleware') {
      return true;
    }

    // Next.js convention files
    const conventionFiles = ['_app', '_document', '404', '500'];
    if (conventionFiles.includes(filename) && relativePath.includes('pages/')) {
      return true;
    }

    // Essential config and system files
    const essentialPatterns = [
      /next\.config\./,
      /next-env\.d\.ts$/,
      /tailwind\.config\./,
      /postcss\.config\./,
      /eslint\.config\./,
      /prettier\.config\./,
      /\.eslintrc\./,
      /\.prettierrc\./,
      /tsconfig\.json$/,
      /jsconfig\.json$/,
      /package\.json$/,
      /\.d\.ts$/,
      /\.env$/,
      /jest\.config\./,
      /vitest\.config\./,
      /babel\.config\./,
      /webpack\.config\./,
      /vite\.config\./,
    ];

    return essentialPatterns.some(
      (pattern) => pattern.test(relativePath) || pattern.test(fullFileName)
    );
  }

  private isStrictEntryPoint(filePath: string): boolean {
    const relativePath = path.relative(this.config.projectRoot, filePath);
    const filename = path.basename(filePath, path.extname(filePath));

    if (this.projectStructure.hasAppDir && relativePath.includes('app/')) {
      return ['page', 'layout', 'route', 'middleware'].includes(filename);
    }

    if (this.projectStructure.hasPagesDir && relativePath.includes('pages/')) {
      return true;
    }

    return ['_app', '_document', 'middleware'].includes(filename);
  }

  private loadPathAliases(): { alias: string; paths: string[] }[] {
    const tsconfigPath = path.join(this.config.projectRoot, 'tsconfig.json');
    const jsconfigPath = path.join(this.config.projectRoot, 'jsconfig.json');
    let configPath: string | undefined;
    let fileContent: string;

    if (fs.existsSync(tsconfigPath)) {
      configPath = tsconfigPath;
    } else if (fs.existsSync(jsconfigPath)) {
      configPath = jsconfigPath;
    } else {
      return [];
    }

    try {
      fileContent = fs.readFileSync(configPath, 'utf-8');
      const config = jsoncParse(fileContent);
      const compilerOptions = config.compilerOptions || {};
      const paths = compilerOptions.paths || {};
      const baseUrl = path.resolve(this.config.projectRoot, compilerOptions.baseUrl || '.');

      const result: { alias: string; paths: string[] }[] = [];
      for (const alias in paths) {
        const aliasKey = alias.replace(/\/\*$/, '');
        const aliasValues = paths[alias] as string[];

        result.push({
          alias: aliasKey,
          paths: aliasValues.map((p) => path.resolve(baseUrl, p.replace(/\/\*$/, ''))),
        });
      }

      // Sort by longest alias first to handle cases like "@/components" and "@"
      result.sort((a, b) => b.alias.length - a.alias.length);
      return result;
    } catch (e) {
      console.warn(`Could not parse alias config at ${configPath}:`, e);
      return [];
    }
  }
}
